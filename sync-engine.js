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
  function mark(entity,remoteId){const meta=ensureMeta(entity);if(remoteId) meta.remoteId=remoteId;meta.syncedAt=new Date().toISOString();meta.dirty=false;return meta;}
  function markDirty(entity){const meta=ensureMeta(entity);meta.dirty=true;meta.changedAt=new Date().toISOString();}
  function remoteId(entity){return entity&&entity[META_KEY]&&entity[META_KEY].remoteId||null;}
  function currency(profile,value){return value||profile.settings&&profile.settings.currency||"RUB";}
  function categoryRuleType(category){return category.type==="fixed"?"fixed":"percentage";}
  function isUuid(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));}

  async function getUser(){
    const s=session();
    if(s&&s.user) return s.user;
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

  async function applyCategoryTombstones(profile,profileId){
    const c=client();
    const meta=ensureMeta(profile);
    const ids=[...new Set((meta.deletedCategoryIds||[]).filter(Boolean))];
    if(!ids.length) return 0;

    for(const id of ids){
      const {error}=await c.from("finance_categories").delete().eq("id",id).eq("profile_id",profileId);
      if(error) throw error;
    }

    meta.deletedCategoryIds=[];
    return ids.length;
  }

  async function syncCategories(profile,profileId,user){
    const c=client();let count=0;
    await applyCategoryTombstones(profile,profileId);
    const {data:existing,error:existingError}=await c.from("finance_categories").select("id,name,rule_type").eq("profile_id",profileId);
    if(existingError)throw existingError;
    const claimed=new Set((profile.categories||[]).map(remoteId).filter(Boolean));
    for(const category of profile.categories||[]){
      const payload={profile_id:profileId,user_id:user.id,name:String(category.name||"Категория"),rule_type:categoryRuleType(category),percent:Math.max(0,Math.min(100,Math.round(Number(category.percent)||0))),fixed_amount:Math.max(0,Number(category.fixedAmount)||0),priority:Math.max(1,Math.min(5,Math.round(Number(category.priority)||3))),monthly_limit:category.limit===""||category.limit==null?null:Math.max(0,Number(category.limit)||0),enabled:category.enabled!==false,sort_order:Math.max(0,Number(category.sortOrder)||0)};
      let id=remoteId(category);
      if(!id){
        const candidate=(existing||[]).find(row=>!claimed.has(row.id)&&row.name===payload.name&&row.rule_type===payload.rule_type)||(existing||[]).find(row=>!claimed.has(row.id)&&row.name===payload.name);
        if(candidate){id=candidate.id;claimed.add(id);mark(category,id);}
      }
      let data,error;
      if(id)({data,error}=await c.from("finance_categories").update(payload).eq("id",id).select("id").single());
      else({data,error}=await c.from("finance_categories").insert(payload).select("id").single());
      if(error)throw error;claimed.add(data.id);mark(category,data.id);count++;
    }
    return count;
  }

  async function syncGoals(profile,profileId,user){
    const c=client();let count=0;
    for(const goal of profile.goals||[]){
      const payload={profile_id:profileId,user_id:user.id,name:String(goal.name||"Цель"),target_amount:Math.max(0,Number(goal.target)||0),ledger_start:Math.max(0,Number(goal.ledgerStart==null?goal.current:goal.ledgerStart)||0),currency:currency(profile,goal.currency),priority:Math.max(1,Math.min(5,Math.round(Number(goal.priority)||3))),deadline:goal.deadline||null,monthly_contribution:Math.max(0,Number(goal.monthlyContribution)||0),auto_allocate:goal.autoAllocate!==false,status:goal.status==="completed"?"completed":goal.status==="archived"?"archived":"active",note:String(goal.note||""),completed_at:goal.completedAt||null};
      const id=remoteId(goal);let data,error;
      if(id)({data,error}=await c.from("finance_goals").update(payload).eq("id",id).select("id").single());
      else({data,error}=await c.from("finance_goals").insert(payload).select("id").single());
      if(error)throw error;mark(goal,data.id);count++;
    }
    return count;
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

  async function syncTransaction(profile,profileId,user,tx){
    const c=client();
    const category=(profile.categories||[]).find(item=>item.id===tx.categoryId);
    const goal=(profile.goals||[]).find(item=>item.id===(tx.goalId||tx.goal_id));
    const payload={profile_id:profileId,user_id:user.id,type:transactionType(tx),amount:Math.max(0,Number(tx.amount)||0),currency:currency(profile,tx.currency),date:tx.date||new Date().toISOString().slice(0,10),source:String(tx.source||""),note:String(tx.note||""),category_id:category?remoteId(category):null,goal_id:goal?remoteId(goal):null,funding_source:tx.fundingSource||null,controlled_amount:Math.max(0,Number(tx.controlledAmount)||0),uncontrolled_amount:Math.max(0,Number(tx.uncontrolledAmount)||0),remainder:Math.max(0,Number(tx.remainder)||0),reserve_amount:Math.max(0,Number(tx.reserve)||0),client_mutation_id:isUuid(tx.id)?tx.id:null,payload:{localId:tx.id,month:tx.month||null,allocations:tx.allocations||[],goalAllocations:tx.goalAllocations||[],fundingBreakdown:tx.fundingBreakdown||null}};
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

  async function syncProfile(profile,profileId,user){
    const c=client();
    const {error}=await c.from("finance_profiles").update({name:profile.name||"Профиль",base_currency:currency(profile),settings:{...(profile.settings||{})}}).eq("id",profileId);if(error)throw error;
    await syncCategories(profile,profileId,user);await syncGoals(profile,profileId,user);
    let txCount=0;for(const tx of profile.transactions||[]){await syncTransaction(profile,profileId,user,tx);txCount++;}
    mark(profile,profileId);return txCount;
  }

  async function pushAll(){
    if(running)return lastResult||{status:"busy"};
    if(!online())return {status:"offline"};
    const c=client();const user=await getUser();if(!c||!user)return {status:"signed_out"};
    running=true;const startedAt=new Date().toISOString();
    try{
      const serverProfiles=await loadServerProfiles();let txCount=0;
      for(let i=0;i<(state.profiles||[]).length;i++){const profile=state.profiles[i];const profileId=await ensureProfile(profile,user,serverProfiles,i);txCount+=await syncProfile(profile,profileId,user);}
      if(state.account)delete state.account.password;
      root.ARISE_SYNC_SILENT=true;try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      lastResult={status:"synced",profiles:(state.profiles||[]).length,transactions:txCount,startedAt,finishedAt:new Date().toISOString()};
      if(root.dispatchEvent)root.dispatchEvent(new CustomEvent("arise:sync",{detail:lastResult}));return lastResult;
    }catch(error){
      console.error("ARISE sync",error);lastResult={status:"error",message:error.message||"Sync failed",startedAt,finishedAt:new Date().toISOString()};
      if(root.dispatchEvent)root.dispatchEvent(new CustomEvent("arise:sync",{detail:lastResult}));throw error;
    }finally{running=false;}
  }

  function schedule(){if(!online()||!session())return;clearTimeout(schedule.timer);schedule.timer=setTimeout(()=>pushAll().catch(()=>{}),700);}
  if(root.addEventListener){root.addEventListener("online",schedule);root.addEventListener("arise:local-change",schedule);}
  root.ARISE_SYNC={pushAll,schedule,markDirty,remoteId,applyCategoryTombstones,lastResult:()=>lastResult};
})(typeof globalThis!=="undefined"?globalThis:window);
