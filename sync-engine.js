(function(root){
  "use strict";

  const META_KEY="ariseSync";
  let running=false;
  let lastResult=null;

  function remote(){return root.ARISE_SUPABASE;}
  function client(){return remote()&&remote().getClient?remote().getClient():null;}
  function session(){return remote()&&remote().currentSession?remote().currentSession():null;}
  function online(){return typeof navigator==="undefined"||navigator.onLine!==false;}
  function ensureMeta(entity){if(!entity[META_KEY]||typeof entity[META_KEY]!=="object") entity[META_KEY]={};return entity[META_KEY];}
  function mark(entity,remoteId){const meta=ensureMeta(entity);if(remoteId)meta.remoteId=remoteId;meta.syncedAt=new Date().toISOString();meta.dirty=false;delete meta.conflict;return meta;}
  function markDirty(entity){const meta=ensureMeta(entity);meta.dirty=true;meta.changedAt=new Date().toISOString();}
  function remoteId(entity){return entity&&entity[META_KEY]&&entity[META_KEY].remoteId||null;}
  function conflictError(entity,label){
    const conflict=entity&&entity[META_KEY]&&entity[META_KEY].conflict;
    if(!conflict)return null;
    const error=new Error(`${label||"Данные"} изменены на другом устройстве после последней синхронизации. Синхронизация остановлена, чтобы не потерять изменения.`);
    error.code="ARISE_SYNC_CONFLICT";
    error.conflict=conflict;
    return error;
  }
  function assertNoConflict(entity,label){const error=conflictError(entity,label);if(error)throw error;}
  function currency(profile,value){return value||profile.settings&&profile.settings.currency||"RUB";}
  function isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));}

  async function getUser(){
    const s=session();
    if(s&&s.user)return s.user;
    const c=client();if(!c)return null;
    const {data,error}=await c.auth.getUser();if(error)throw error;
    return data.user||null;
  }

  async function loadServerProfiles(){const api=remote();return api&&api.listFinanceProfiles?api.listFinanceProfiles():[];}

  async function ensureProfile(localProfile,user,serverProfiles,index){
    const c=client();let id=remoteId(localProfile);if(id)return id;
    const used=new Set((state.profiles||[]).map(remoteId).filter(Boolean));
    const available=serverProfiles.filter(row=>!used.has(row.id));
    const candidate=available.find(row=>row.name===localProfile.name)||available[index]||null;
    if(candidate){id=candidate.id;mark(localProfile,id);return id;}
    const {data,error}=await c.from("finance_profiles").insert({user_id:user.id,name:localProfile.name||"Профиль",base_currency:currency(localProfile),settings:{...(localProfile.settings||{})}}).select("id").single();
    if(error)throw error;id=data.id;mark(localProfile,id);return id;
  }

  function migrateEntityTombstones(profile,{metaKey,entity}){
    const outbox=root.ARISE_SYNC_OUTBOX;
    if(!outbox||!outbox.enqueue||!outbox.list)return 0;
    const meta=ensureMeta(profile);
    const ids=[...new Set((meta[metaKey]||[]).filter(Boolean).map(String))];
    if(!ids.length){delete meta[metaKey];return 0;}
    const queued=new Set(outbox.list(profile,entity)
      .filter(item=>item.action==="delete"&&item.entityRemoteId)
      .map(item=>String(item.entityRemoteId)));
    let count=0;
    for(const id of ids){
      if(queued.has(id))continue;
      outbox.enqueue(profile,{entity,entityLocalId:null,entityRemoteId:id,action:"delete"});
      queued.add(id);count++;
    }
    delete meta[metaKey];
    return count;
  }

  function applyCategoryTombstones(profile){return migrateEntityTombstones(profile,{metaKey:"deletedCategoryIds",entity:"category"});}
  function applyGoalTombstones(profile){return migrateEntityTombstones(profile,{metaKey:"deletedGoalIds",entity:"goal"});}

  function seedEntityOutbox(profile,entity,collection){
    const outbox=root.ARISE_SYNC_OUTBOX;
    if(!outbox||!outbox.enqueue||!outbox.list)return 0;
    const queued=new Set(outbox.list(profile,entity).map(item=>String(item.entityLocalId)));
    let count=0;
    for(const item of profile[collection]||[]){
      if(remoteId(item)||queued.has(String(item.id)))continue;
      outbox.enqueue(profile,{entity,entityLocalId:item.id,action:"upsert"});
      queued.add(String(item.id));count++;
    }
    return count;
  }

  async function drainEntityOutbox(profile,profileId,user){
    const legacyCategoryDeletes=applyCategoryTombstones(profile);
    const legacyGoalDeletes=applyGoalTombstones(profile);
    const seededCategories=seedEntityOutbox(profile,"category","categories");
    const seededGoals=seedEntityOutbox(profile,"goal","goals");
    let drained=0;
    if(root.ARISE_ENTITY_OUTBOX&&root.ARISE_ENTITY_OUTBOX.drainProfile)drained=await root.ARISE_ENTITY_OUTBOX.drainProfile(profile,user.id);
    return {drained,seededCategories,seededGoals,legacyDeletes:legacyCategoryDeletes+legacyGoalDeletes};
  }

  function transactionType(tx){if(["income","expense","goal_contribution","goal_withdrawal","reserve_deposit","reserve_withdrawal","transfer"].includes(tx.type))return tx.type;return tx.type==="goalContribution"?"goal_contribution":"transfer";}

  async function findExistingTransaction(c,userId,tx){
    const known=remoteId(tx);if(known)return known;
    if(isUuid(tx.id)){
      const {data,error}=await c.from("finance_transactions").select("id").eq("user_id",userId).eq("client_mutation_id",tx.id).maybeSingle();
      if(error)throw error;if(data&&data.id)return data.id;
    }
    const {data,error}=await c.from("finance_transactions").select("id,payload").eq("user_id",userId).contains("payload",{localId:tx.id}).limit(1);
    if(error)throw error;
    return data&&data[0]&&data[0].id||null;
  }

  function transactionCurrencySnapshot(profile,tx){
    const base=currency(profile,tx.baseCurrency||tx.base_currency||profile.settings&&profile.settings.currency);
    const originalCurrency=tx.originalCurrency||tx.currency||base;
    const originalAmount=Math.max(0,Number(tx.originalAmount!=null?tx.originalAmount:tx.amount)||0);
    const baseAmount=Math.max(0,Number(tx.baseAmount!=null?tx.baseAmount:tx.amount)||0);
    const rate=Number(tx.exchangeRateToBase??tx.exchange_rate_to_base);
    return {
      originalAmount,
      originalCurrency,
      baseCurrency:base,
      baseAmount,
      exchangeRateToBase:Number.isFinite(rate)&&rate>0?rate:(originalCurrency===base?1:null),
      fxSource:tx.fxSource||tx.fx_source||(originalCurrency===base?"identity":null),
      fxFetchedAt:tx.fxFetchedAt||tx.fx_fetched_at||null
    };
  }

  async function syncTransaction(profile,profileId,user,tx){
    assertNoConflict(tx,"Операция");
    const c=client();
    const category=(profile.categories||[]).find(item=>item.id===tx.categoryId);
    const goal=(profile.goals||[]).find(item=>item.id===(tx.goalId||tx.goal_id));
    const fx=transactionCurrencySnapshot(profile,tx);
    const payload={
      profile_id:profileId,user_id:user.id,type:transactionType(tx),
      amount:fx.originalAmount,currency:fx.originalCurrency,
      base_currency:fx.baseCurrency,exchange_rate_to_base:fx.exchangeRateToBase,base_amount:fx.baseAmount,fx_source:fx.fxSource,fx_fetched_at:fx.fxFetchedAt,
      date:tx.date||new Date().toISOString().slice(0,10),source:String(tx.source||""),note:String(tx.note||""),
      category_id:category?remoteId(category):null,goal_id:goal?remoteId(goal):null,funding_source:tx.fundingSource||null,
      controlled_amount:Math.max(0,Number(tx.controlledAmount)||0),uncontrolled_amount:Math.max(0,Number(tx.uncontrolledAmount)||0),
      remainder:Math.max(0,Number(tx.remainder)||0),reserve_amount:Math.max(0,Number(tx.reserve)||0),client_mutation_id:isUuid(tx.id)?tx.id:null,
      payload:{localId:tx.id,month:tx.month||null,ledgerAmount:fx.baseAmount,allocations:tx.allocations||[],goalAllocations:tx.goalAllocations||[],fundingBreakdown:tx.fundingBreakdown||null}
    };
    let id=await findExistingTransaction(c,user.id,tx);let data,error;
    if(id)({data,error}=await c.from("finance_transactions").update(payload).eq("id",id).select("id").single());
    else({data,error}=await c.from("finance_transactions").insert(payload).select("id").single());
    if(error)throw error;id=data.id;mark(tx,id);

    if(tx.type==="income"){
      const rows=[];
      for(const item of tx.allocations||[]){const cat=(profile.categories||[]).find(c=>c.id===item.categoryId);rows.push({transaction_id:id,profile_id:profileId,user_id:user.id,allocation_type:"category",category_id:cat?remoteId(cat):null,goal_id:null,name_snapshot:String(item.name||cat&&cat.name||""),amount:Math.max(0,Number(item.amount)||0),rule_snapshot:{fixed:!!item.fixed,percent:Number(item.percent)||0}});}
      for(const item of tx.goalAllocations||[]){const g=(profile.goals||[]).find(goalItem=>goalItem.id===item.goalId);rows.push({transaction_id:id,profile_id:profileId,user_id:user.id,allocation_type:"goal",category_id:null,goal_id:g?remoteId(g):null,name_snapshot:String(item.name||g&&g.name||""),amount:Math.max(0,Number(item.amount)||0),rule_snapshot:{priority:Number(item.priority)||null}});}
      if(Number(tx.reserve)>0)rows.push({transaction_id:id,profile_id:profileId,user_id:user.id,allocation_type:"reserve",category_id:null,goal_id:null,name_snapshot:"Резерв",amount:Math.max(0,Number(tx.reserve)||0),rule_snapshot:{}});
      if(Number(tx.remainder)>0)rows.push({transaction_id:id,profile_id:profileId,user_id:user.id,allocation_type:"unallocated",category_id:null,goal_id:null,name_snapshot:"Не распределено",amount:Math.max(0,Number(tx.remainder)||0),rule_snapshot:{}});
      const {error:deleteError}=await c.from("finance_allocations").delete().eq("transaction_id",id);if(deleteError)throw deleteError;
      if(rows.length){const {error:insertError}=await c.from("finance_allocations").insert(rows);if(insertError)throw insertError;}
    }
  }

  function seedTransactionOutbox(profile){
    const outbox=root.ARISE_SYNC_OUTBOX;
    if(!outbox||!outbox.enqueue||!outbox.list)return 0;
    const queued=new Set(outbox.list(profile,"transaction").map(item=>String(item.entityLocalId)));
    let count=0;
    for(const tx of profile.transactions||[]){if(remoteId(tx)||queued.has(String(tx.id)))continue;outbox.enqueue(profile,{entity:"transaction",entityLocalId:tx.id,action:"upsert"});queued.add(String(tx.id));count++;}
    return count;
  }

  async function flushTransactionOutbox(profile,profileId,user){
    const outbox=root.ARISE_SYNC_OUTBOX;
    if(!outbox||!outbox.list)return 0;
    const c=client();let count=0;
    for(const mutation of outbox.list(profile,"transaction")){
      try{
        if(mutation.action==="delete"){
          let id=mutation.entityRemoteId||null;
          if(!id&&mutation.entityLocalId)id=await findExistingTransaction(c,user.id,{id:mutation.entityLocalId});
          if(id){const {error}=await c.from("finance_transactions").delete().eq("id",id).eq("profile_id",profileId);if(error)throw error;}
        }else{
          const tx=(profile.transactions||[]).find(item=>String(item.id)===String(mutation.entityLocalId));
          if(tx)await syncTransaction(profile,profileId,user,tx);
        }
        outbox.ack(profile,mutation.id);count++;
      }catch(error){if(outbox.fail)outbox.fail(profile,mutation.id,error);throw error;}
    }
    return count;
  }

  async function syncProfile(profile,profileId,user){
    assertNoConflict(profile,"Финансовый профиль");
    const c=client();
    const {error}=await c.from("finance_profiles").update({name:profile.name||"Профиль",base_currency:currency(profile),settings:{...(profile.settings||{})}}).eq("id",profileId);if(error)throw error;
    const entityResult=await drainEntityOutbox(profile,profileId,user);
    const seededTransactions=seedTransactionOutbox(profile);
    const transactionOutboxCount=await flushTransactionOutbox(profile,profileId,user);
    mark(profile,profileId);
    return {txCount:transactionOutboxCount,outboxCount:transactionOutboxCount+entityResult.drained,seededTransactions,seededEntities:entityResult.seededCategories+entityResult.seededGoals,legacyDeletes:entityResult.legacyDeletes};
  }

  function publish(result){
    lastResult=result;
    if(root.dispatchEvent)root.dispatchEvent(new CustomEvent("arise:sync",{detail:lastResult}));
    return lastResult;
  }

  async function pushAll(){
    if(running)return lastResult||{status:"busy"};
    if(!online())return {status:"offline"};
    const c=client();const user=await getUser();if(!c||!user)return {status:"signed_out"};
    running=true;const startedAt=new Date().toISOString();
    publish({status:"busy",startedAt});
    try{
      const serverProfiles=await loadServerProfiles();let txCount=0;let outboxCount=0;let seededTransactions=0;let seededEntities=0;let legacyDeletes=0;
      for(let i=0;i<(state.profiles||[]).length;i++){
        const profile=state.profiles[i];const profileId=await ensureProfile(profile,user,serverProfiles,i);const result=await syncProfile(profile,profileId,user);
        txCount+=result.txCount;outboxCount+=result.outboxCount;seededTransactions+=result.seededTransactions;seededEntities+=result.seededEntities;legacyDeletes+=result.legacyDeletes;
      }
      if(state.account)delete state.account.password;
      root.ARISE_SYNC_SILENT=true;try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      return publish({status:"synced",profiles:(state.profiles||[]).length,transactions:txCount,outboxMutations:outboxCount,seededTransactions,seededEntities,legacyDeletes,startedAt,finishedAt:new Date().toISOString()});
    }catch(error){
      console.error("ARISE sync",error);
      const status=error&&error.code==="ARISE_SYNC_CONFLICT"?"conflict":"error";
      publish({status,message:error.message||"Sync failed",conflict:error&&error.conflict||null,startedAt,finishedAt:new Date().toISOString()});
      if(status==="conflict")return lastResult;
      throw error;
    }finally{running=false;}
  }

  function schedule(){if(!online()||!session())return;clearTimeout(schedule.timer);schedule.timer=setTimeout(()=>pushAll().catch(()=>{}),700);}
  if(root.addEventListener){root.addEventListener("online",schedule);root.addEventListener("arise:local-change",schedule);}
  root.ARISE_SYNC={pushAll,schedule,markDirty,remoteId,conflictError,assertNoConflict,transactionCurrencySnapshot,migrateEntityTombstones,applyCategoryTombstones,applyGoalTombstones,seedEntityOutbox,drainEntityOutbox,seedTransactionOutbox,flushTransactionOutbox,lastResult:()=>lastResult};
})(typeof globalThis!=="undefined"?globalThis:window);
