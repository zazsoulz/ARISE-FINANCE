(function(root){
  "use strict";

  const META_KEY="ariseSync";

  function api(){return root.ARISE_SUPABASE;}
  function client(){return api()&&api().getClient?api().getClient():null;}
  function session(){return api()&&api().currentSession?api().currentSession():null;}
  function rid(entity){return entity&&entity[META_KEY]&&entity[META_KEY].remoteId||null;}
  function meta(remoteId,syncedAt){return {remoteId,syncedAt:syncedAt||new Date().toISOString(),dirty:false};}

  function conflictDecision(remoteUpdated,localEntity){
    const localMeta=localEntity&&localEntity[META_KEY]||{};
    const policy=root.ARISE_SYNC_CONFLICTS;
    if(policy&&typeof policy.resolve==="function")return policy.resolve({localMeta,remoteUpdatedAt:remoteUpdated,localChangedAt:localMeta.changedAt});
    if(localMeta.dirty)return {winner:"local",reason:"local_dirty"};
    if(!localMeta.syncedAt)return {winner:"local",reason:"local_unsynced"};
    const remoteTime=new Date(remoteUpdated||0).getTime();
    const localTime=new Date(localMeta.syncedAt||0).getTime();
    return remoteTime>localTime?{winner:"remote",reason:"remote_newer"}:{winner:"local",reason:"local_newer_or_equal"};
  }

  function shouldUseRemote(remoteUpdated,localEntity){return conflictDecision(remoteUpdated,localEntity).winner==="remote";}
  function isEmptyLocalProfile(profile){return !(profile.transactions||[]).length&&!(profile.goals||[]).length;}
  function normalizeName(value){return String(value||"").trim().toLocaleLowerCase("ru");}
  function localCategoryType(category){return category&&category.type==="fixed"?"fixed":"percentage";}

  function findLocalCategory(remoteRow,localCategories,claimed){
    return (localCategories||[]).find(item=>{
      if(claimed.has(item)||rid(item))return false;
      return normalizeName(item.name)===normalizeName(remoteRow.name)&&localCategoryType(item)===(remoteRow.rule_type==="fixed"?"fixed":"percentage");
    })||(localCategories||[]).find(item=>!claimed.has(item)&&!rid(item)&&normalizeName(item.name)===normalizeName(remoteRow.name))||null;
  }

  function findLocalGoal(remoteRow,localGoals,claimed){
    const byName=(localGoals||[]).filter(item=>!claimed.has(item)&&!rid(item)&&normalizeName(item.name)===normalizeName(remoteRow.name));
    if(byName.length===1)return byName[0];
    return byName.find(item=>Number(item.target||0)===Number(remoteRow.target_amount||0)&&String(item.deadline||"")===String(remoteRow.deadline||""))||null;
  }

  function localCategoryFrom(row){
    return {id:uid(),name:row.name||"Категория",type:row.rule_type==="fixed"?"fixed":"percentage",percent:Number(row.percent)||0,fixedAmount:Number(row.fixed_amount)||0,priority:Number(row.priority)||3,limit:row.monthly_limit==null?null:Number(row.monthly_limit),enabled:row.enabled!==false,sortOrder:Number(row.sort_order)||0,color:"green",[META_KEY]:meta(row.id,row.updated_at)};
  }

  function localGoalFrom(row){
    const current=Math.max(0,Number(row.ledger_start)||0);
    return {id:uid(),name:row.name||"Цель",target:Math.max(0,Number(row.target_amount)||0),current,ledgerStart:current,currency:row.currency||"RUB",priority:Number(row.priority)||3,deadline:row.deadline||"",monthlyContribution:Math.max(0,Number(row.monthly_contribution)||0),autoAllocate:row.auto_allocate!==false,status:row.status||"active",note:row.note||"",createdAt:row.created_at?String(row.created_at).slice(0,10):today(),completedAt:row.completed_at||"",[META_KEY]:meta(row.id,row.updated_at)};
  }

  function allocationGroups(rows){
    const map=new Map();
    for(const row of rows||[]){if(!map.has(row.transaction_id))map.set(row.transaction_id,[]);map.get(row.transaction_id).push(row);}
    return map;
  }

  function localTransactionFrom(row,profile,allocationRows){
    const payload=row.payload&&typeof row.payload==="object"?row.payload:{};
    const byRemoteCategory=new Map((profile.categories||[]).map(c=>[rid(c),c]));
    const byRemoteGoal=new Map((profile.goals||[]).map(g=>[rid(g),g]));
    const rows=allocationRows||[];
    const allocations=rows.filter(a=>a.allocation_type==="category").map(a=>{const category=byRemoteCategory.get(a.category_id);return {categoryId:category?category.id:null,name:a.name_snapshot||category&&category.name||"Категория",amount:Number(a.amount)||0,percent:Number(a.rule_snapshot&&a.rule_snapshot.percent)||0,fixed:!!(a.rule_snapshot&&a.rule_snapshot.fixed)};});
    const goalAllocations=rows.filter(a=>a.allocation_type==="goal").map(a=>{const goal=byRemoteGoal.get(a.goal_id);return {goalId:goal?goal.id:null,name:a.name_snapshot||goal&&goal.name||"Цель",amount:Number(a.amount)||0,priority:Number(a.rule_snapshot&&a.rule_snapshot.priority)||goal&&goal.priority||3};});
    const category=byRemoteCategory.get(row.category_id);
    const goal=byRemoteGoal.get(row.goal_id);
    const originalAmount=Math.max(0,Number(row.amount)||0);
    const originalCurrency=row.currency||profile.settings.currency;
    const baseCurrency=row.base_currency||profile.settings.currency||originalCurrency;
    const baseAmount=Number.isFinite(Number(row.base_amount))?Math.max(0,Number(row.base_amount)):(Number.isFinite(Number(payload.ledgerAmount))?Math.max(0,Number(payload.ledgerAmount)):originalAmount);
    const rate=Number(row.exchange_rate_to_base);
    return {
      id:payload.localId||uid(),type:row.type,date:row.date||today(),month:payload.month||monthKey(row.date||today()),
      amount:baseAmount,currency:baseCurrency,
      originalAmount,originalCurrency,baseAmount,baseCurrency,
      exchangeRateToBase:Number.isFinite(rate)&&rate>0?rate:(originalCurrency===baseCurrency?1:null),
      fxSource:row.fx_source||(originalCurrency===baseCurrency?"identity":null),fxFetchedAt:row.fx_fetched_at||null,
      conversionPending:originalCurrency!==baseCurrency&&!Number.isFinite(rate)&&!Number.isFinite(Number(row.base_amount)),
      source:row.source||"",note:row.note||"",categoryId:category?category.id:null,categoryName:category?category.name:(row.type==="expense"?"Нераспределено":""),goalId:goal?goal.id:null,
      controlledAmount:Number(row.controlled_amount)||0,uncontrolledAmount:Number(row.uncontrolled_amount)||0,remainder:Number(row.remainder)||0,reserve:Number(row.reserve_amount)||0,fundingSource:row.funding_source||null,
      allocations:allocations.length?allocations:(payload.allocations||[]),goalAllocations:goalAllocations.length?goalAllocations:(payload.goalAllocations||[]),fundingBreakdown:payload.fundingBreakdown||null,
      createdAt:row.created_at||new Date().toISOString(),[META_KEY]:meta(row.id,row.updated_at)
    };
  }

  async function fetchProfileBundle(profileId){
    const c=client();
    const [categories,goals,transactions,allocations]=await Promise.all([
      c.from("finance_categories").select("*").eq("profile_id",profileId).order("sort_order"),
      c.from("finance_goals").select("*").eq("profile_id",profileId).order("created_at"),
      c.from("finance_transactions").select("*").eq("profile_id",profileId).is("deleted_at",null).order("created_at"),
      c.from("finance_allocations").select("*").eq("profile_id",profileId).order("created_at")
    ]);
    for(const result of [categories,goals,transactions,allocations])if(result.error)throw result.error;
    return {categories:categories.data||[],goals:goals.data||[],transactions:transactions.data||[],allocations:allocations.data||[]};
  }

  async function hydrateRemoteProfile(row,localProfile){
    const bundle=await fetchProfileBundle(row.id);
    const target=localProfile||createProfile(row.name||"Профиль");
    const replace=!localProfile||isEmptyLocalProfile(target);
    const useRemoteProfile=replace||shouldUseRemote(row.updated_at,target);

    if(useRemoteProfile){
      target.name=row.name||target.name||"Профиль";
      target.settings={...(target.settings||{}),...(row.settings||{}),currency:row.base_currency||target.settings&&target.settings.currency||"RUB"};
      target[META_KEY]=meta(row.id,row.updated_at);
    }else target[META_KEY]={...(target[META_KEY]||{}),remoteId:row.id};

    const categoryByRemote=new Map((target.categories||[]).map(item=>[rid(item),item]).filter(([id])=>id));
    const claimedCategories=new Set();
    const remoteCategories=[];
    for(const remoteRow of bundle.categories){
      let existing=categoryByRemote.get(remoteRow.id)||findLocalCategory(remoteRow,target.categories,claimedCategories);
      if(existing)claimedCategories.add(existing);
      if(existing&&!shouldUseRemote(remoteRow.updated_at,existing)){
        existing[META_KEY]={...(existing[META_KEY]||{}),remoteId:remoteRow.id,syncedAt:existing[META_KEY]&&existing[META_KEY].syncedAt||remoteRow.updated_at};
        remoteCategories.push(existing);continue;
      }
      const next=localCategoryFrom(remoteRow);if(existing)next.id=existing.id;remoteCategories.push(next);
    }
    if(replace)target.categories=remoteCategories;
    else{const matchedLocal=new Set([...claimedCategories]);const remoteIds=new Set(remoteCategories.map(rid));target.categories=[...(target.categories||[]).filter(item=>!matchedLocal.has(item)&&!remoteIds.has(rid(item))),...remoteCategories];}

    const goalByRemote=new Map((target.goals||[]).map(item=>[rid(item),item]).filter(([id])=>id));
    const claimedGoals=new Set();
    const remoteGoals=[];
    for(const remoteRow of bundle.goals){
      let existing=goalByRemote.get(remoteRow.id)||findLocalGoal(remoteRow,target.goals,claimedGoals);
      if(existing)claimedGoals.add(existing);
      if(existing&&!shouldUseRemote(remoteRow.updated_at,existing)){
        existing[META_KEY]={...(existing[META_KEY]||{}),remoteId:remoteRow.id,syncedAt:existing[META_KEY]&&existing[META_KEY].syncedAt||remoteRow.updated_at};
        remoteGoals.push(existing);continue;
      }
      const next=localGoalFrom(remoteRow);if(existing)next.id=existing.id;remoteGoals.push(next);
    }
    if(replace)target.goals=remoteGoals;
    else{const matchedLocal=new Set([...claimedGoals]);const remoteIds=new Set(remoteGoals.map(rid));target.goals=[...(target.goals||[]).filter(item=>!matchedLocal.has(item)&&!remoteIds.has(rid(item))),...remoteGoals];}

    const allocationMap=allocationGroups(bundle.allocations);
    const existingTxByRemote=new Map((target.transactions||[]).map(item=>[rid(item),item]));
    const existingTxByLocal=new Map((target.transactions||[]).map(item=>[item.id,item]));
    const remoteTransactions=[];
    for(const remoteRow of bundle.transactions){
      const localId=remoteRow.payload&&remoteRow.payload.localId;
      const existing=existingTxByRemote.get(remoteRow.id)||(localId&&existingTxByLocal.get(localId));
      if(existing){
        if(shouldUseRemote(remoteRow.updated_at,existing)){const next=localTransactionFrom(remoteRow,target,allocationMap.get(remoteRow.id)||[]);next.id=existing.id;remoteTransactions.push(next);}
        else{existing[META_KEY]={...(existing[META_KEY]||{}),remoteId:remoteRow.id};remoteTransactions.push(existing);}
        continue;
      }
      remoteTransactions.push(localTransactionFrom(remoteRow,target,allocationMap.get(remoteRow.id)||[]));
    }
    if(replace)target.transactions=remoteTransactions;
    else{const knownRemote=new Set(remoteTransactions.map(rid).filter(Boolean));const knownLocal=new Set(remoteTransactions.map(tx=>tx.id));target.transactions=[...(target.transactions||[]).filter(tx=>!knownRemote.has(rid(tx))&&!knownLocal.has(tx.id)),...remoteTransactions];}

    return normalizeProfile(target);
  }

  async function pullAll(){
    const c=client();const s=session();
    if(!c||!s||!s.user)return {status:"signed_out",imported:0};
    if(typeof navigator!=="undefined"&&navigator.onLine===false)return {status:"offline",imported:0};
    const rows=await api().listFinanceProfiles();
    let imported=0;
    const localByRemote=new Map((state.profiles||[]).map(p=>[rid(p),p]).filter(([id])=>id));
    const claimedLocal=new Set();const merged=[];
    for(const row of rows){
      let local=localByRemote.get(row.id)||null;
      if(!local)local=(state.profiles||[]).find(p=>!claimedLocal.has(p)&&!rid(p)&&p.name===row.name)||null;
      if(!local&&state.profiles&&state.profiles.length===1&&!rid(state.profiles[0])&&isEmptyLocalProfile(state.profiles[0]))local=state.profiles[0];
      if(local)claimedLocal.add(local);
      merged.push(await hydrateRemoteProfile(row,local));imported++;
    }
    for(const local of state.profiles||[])if(!claimedLocal.has(local)&&!merged.includes(local))merged.push(local);
    if(merged.length)state.profiles=merged;
    if(!state.profiles.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.profiles[0]&&state.profiles[0].id||null;
    if(state.account)delete state.account.password;
    root.ARISE_SYNC_SILENT=true;try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
    return {status:"pulled",imported};
  }

  root.ARISE_SYNC_PULL={pullAll,shouldUseRemote,conflictDecision,hydrateRemoteProfile,findLocalCategory,findLocalGoal,localTransactionFrom};
})(typeof globalThis!=="undefined"?globalThis:window);
