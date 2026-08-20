(function(root){
  "use strict";

  const META_KEY="ariseSync";
  const pull=root.ARISE_SYNC_PULL;
  const conflicts=root.ARISE_SYNC_CONFLICTS;
  if(!pull||typeof pull.pullAll!=="function"||!conflicts)return;

  const originalPullAll=pull.pullAll;
  const rid=entity=>entity&&entity[META_KEY]&&entity[META_KEY].remoteId||null;

  function api(){return root.ARISE_SUPABASE;}
  function client(){return api()&&api().getClient?api().getClient():null;}

  function detachQueuedRemoteId(profile,entityName,localId){
    const box=root.ARISE_SYNC_OUTBOX;
    if(!box||typeof box.list!=="function")return;
    for(const mutation of box.list(profile,entityName)){
      if(String(mutation.entityLocalId)===String(localId))mutation.entityRemoteId=null;
    }
  }

  function reconcileCollection(profile,collection,entityName,remoteIds){
    const items=Array.isArray(profile&&profile[collection])?profile[collection]:[];
    const kept=[];
    let removed=0;
    let detached=0;
    let conflictsKept=0;

    for(const item of items){
      const remoteId=rid(item);
      if(!remoteId||remoteIds.has(String(remoteId))){
        kept.push(item);
        continue;
      }

      const decision=typeof conflicts.resolveAbsence==="function"
        ? conflicts.resolveAbsence({localMeta:item[META_KEY]||{}})
        : ((item[META_KEY]&&item[META_KEY].dirty)?{winner:"local"}:{winner:"remote_delete"});

      if(decision.winner==="remote_delete"){
        removed++;
        continue;
      }

      if(decision.winner==="conflict"){
        kept.push(item);
        conflictsKept++;
        continue;
      }

      item[META_KEY]={...(item[META_KEY]||{}),remoteId:null,dirty:true};
      delete item[META_KEY].syncedAt;
      delete item[META_KEY].conflict;
      detachQueuedRemoteId(profile,entityName,item.id);
      kept.push(item);
      detached++;
    }

    profile[collection]=kept;
    return {removed,detached,conflictsKept};
  }

  function hydrateGoalClosure(profile,remoteGoals){
    const byRemote=new Map((profile.goals||[]).map(goal=>[String(rid(goal)||""),goal]));
    for(const row of remoteGoals||[]){
      const goal=byRemote.get(String(row.id||""));
      if(!goal)continue;
      if(row.status==="closed"){
        goal.status="closed";
        goal.autoAllocate=false;
      }
      goal.closedAt=row.closed_at||goal.closedAt||"";
      goal.closureBalance=row.closure_balance==null?(goal.closureBalance??null):Math.max(0,Number(row.closure_balance)||0);
      goal.closureDestination=row.closure_destination||goal.closureDestination||"";
    }
  }

  async function remoteBundle(profileId){
    const c=client();
    if(!c)return null;
    const [categories,goals,transactions]=await Promise.all([
      c.from("finance_categories").select("id").eq("profile_id",profileId),
      c.from("finance_goals").select("id,status,closed_at,closure_balance,closure_destination").eq("profile_id",profileId),
      c.from("finance_transactions").select("id").eq("profile_id",profileId).is("deleted_at",null)
    ]);
    for(const result of [categories,goals,transactions])if(result.error)throw result.error;
    return {categories:categories.data||[],goals:goals.data||[],transactions:transactions.data||[]};
  }

  async function reconcileProfile(profile){
    const profileId=rid(profile);
    if(!profileId)return {removed:0,detached:0,conflictsKept:0};
    const bundle=await remoteBundle(profileId);
    if(!bundle)return {removed:0,detached:0,conflictsKept:0};

    hydrateGoalClosure(profile,bundle.goals);
    const categoryResult=reconcileCollection(profile,"categories","category",new Set(bundle.categories.map(row=>String(row.id))));
    const goalResult=reconcileCollection(profile,"goals","goal",new Set(bundle.goals.map(row=>String(row.id))));
    const transactionResult=reconcileCollection(profile,"transactions","transaction",new Set(bundle.transactions.map(row=>String(row.id))));

    return {
      removed:categoryResult.removed+goalResult.removed+transactionResult.removed,
      detached:categoryResult.detached+goalResult.detached+transactionResult.detached,
      conflictsKept:categoryResult.conflictsKept+goalResult.conflictsKept+transactionResult.conflictsKept
    };
  }

  pull.pullAll=async function(){
    const result=await originalPullAll();
    if(!result||result.status!=="pulled")return result;

    let removed=0;
    let detached=0;
    let conflictsKept=0;
    for(const profile of state.profiles||[]){
      const reconciled=await reconcileProfile(profile);
      removed+=reconciled.removed;
      detached+=reconciled.detached;
      conflictsKept+=reconciled.conflictsKept;
    }

    if(removed||detached){
      root.ARISE_SYNC_SILENT=true;
      try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
    }

    return {...result,remoteDeletesApplied:removed,remoteDeleteConflictsDetached:detached,remoteDeleteConflictsKept:conflictsKept};
  };

  root.ARISE_SYNC_CONFLICT_HARDENING={reconcileCollection,reconcileProfile,hydrateGoalClosure};
})(typeof globalThis!=="undefined"?globalThis:window);
