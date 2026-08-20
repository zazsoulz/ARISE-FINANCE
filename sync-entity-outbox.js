(function(root){
  "use strict";

  const META_KEY="ariseSync";
  let running=false;

  function api(){return root.ARISE_SUPABASE;}
  function client(){return api()&&api().getClient?api().getClient():null;}
  function session(){return api()&&api().currentSession?api().currentSession():null;}
  function outbox(){return root.ARISE_SYNC_OUTBOX;}
  function rid(entity){return entity&&entity[META_KEY]&&entity[META_KEY].remoteId||null;}
  function online(){return typeof navigator==="undefined"||navigator.onLine!==false;}

  function mark(entity,remoteId){
    entity[META_KEY]={...(entity[META_KEY]||{}),remoteId,syncedAt:new Date().toISOString(),dirty:false};
    delete entity[META_KEY].conflict;
  }

  function assertNoConflict(entity,label){
    const conflict=entity&&entity[META_KEY]&&entity[META_KEY].conflict;
    if(!conflict)return;
    const error=new Error(`${label||"Данные"} изменены на другом устройстве после последней синхронизации. Изменение оставлено в очереди.`);
    error.code="ARISE_SYNC_CONFLICT";
    error.conflict=conflict;
    throw error;
  }

  function categoryPayload(profile,profileId,userId,category){
    return {
      profile_id:profileId,
      user_id:userId,
      name:String(category.name||"Категория"),
      rule_type:category.type==="fixed"?"fixed":"percentage",
      percent:Math.max(0,Math.min(100,Math.round(Number(category.percent)||0))),
      fixed_amount:Math.max(0,Number(category.fixedAmount)||0),
      priority:Math.max(1,Math.min(5,Math.round(Number(category.priority)||3))),
      monthly_limit:category.limit===""||category.limit==null?null:Math.max(0,Number(category.limit)||0),
      enabled:category.enabled!==false,
      sort_order:Math.max(0,Number(category.sortOrder)||0)
    };
  }

  function goalPayload(profile,profileId,userId,goal){
    const status=["active","completed","archived","closed"].includes(goal.status)?goal.status:"active";
    return {
      profile_id:profileId,
      user_id:userId,
      name:String(goal.name||"Цель"),
      target_amount:Math.max(0,Number(goal.target)||0),
      ledger_start:Math.max(0,Number(goal.ledgerStart==null?goal.current:goal.ledgerStart)||0),
      currency:goal.currency||profile.settings&&profile.settings.currency||"RUB",
      priority:Math.max(1,Math.min(5,Math.round(Number(goal.priority)||3))),
      deadline:goal.deadline||null,
      monthly_contribution:Math.max(0,Number(goal.monthlyContribution)||0),
      auto_allocate:goal.autoAllocate!==false&&status!=="closed",
      status,
      note:String(goal.note||""),
      completed_at:goal.completedAt||null,
      closed_at:goal.closedAt||null,
      closure_balance:goal.closureBalance==null?null:Math.max(0,Number(goal.closureBalance)||0),
      closure_destination:goal.closureDestination||null
    };
  }

  async function processMutation(profile,profileId,userId,mutation){
    const c=client();
    const box=outbox();
    const entityName=mutation.entity;
    const config=entityName==="category"
      ? {collection:"categories",table:"finance_categories",payload:categoryPayload,label:"Категория"}
      : entityName==="goal"
        ? {collection:"goals",table:"finance_goals",payload:goalPayload,label:"Цель"}
        : null;
    if(!config) return false;

    try{
      if(mutation.action==="delete"){
        const remoteId=mutation.entityRemoteId||null;
        if(remoteId){
          const {error}=await c.from(config.table).delete().eq("id",remoteId).eq("profile_id",profileId);
          if(error) throw error;
        }
      }else{
        const entity=(profile[config.collection]||[]).find(item=>String(item.id)===String(mutation.entityLocalId));
        if(!entity){
          box.ack(profile,mutation.id);
          return true;
        }
        assertNoConflict(entity,config.label);
        const payload=config.payload(profile,profileId,userId,entity);
        let remoteId=rid(entity)||mutation.entityRemoteId||null;
        let data,error;
        if(remoteId){
          ({data,error}=await c.from(config.table).update(payload).eq("id",remoteId).eq("profile_id",profileId).select("id").maybeSingle());
          if(!error&&!data)remoteId=null;
        }
        if(!remoteId){
          ({data,error}=await c.from(config.table).insert(payload).select("id").single());
        }
        if(error) throw error;
        remoteId=data.id;
        mark(entity,remoteId);
      }
      box.ack(profile,mutation.id);
      return true;
    }catch(error){
      if(box.fail) box.fail(profile,mutation.id,error);
      throw error;
    }
  }

  async function drainProfile(profile,userId){
    const box=outbox();
    const profileId=rid(profile);
    if(!box||!profileId) return 0;
    let count=0;
    for(const entity of ["category","goal"]){
      for(const mutation of box.list(profile,entity)){
        await processMutation(profile,profileId,userId,mutation);
        count++;
      }
    }
    return count;
  }

  async function drainAll(){
    if(running||!online()) return 0;
    const s=session();
    const c=client();
    if(!c||!s||!s.user) return 0;
    running=true;
    try{
      let count=0;
      for(const profile of state.profiles||[]) count+=await drainProfile(profile,s.user.id);
      if(count){
        root.ARISE_SYNC_SILENT=true;
        try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      }
      return count;
    }finally{
      running=false;
    }
  }

  function schedule(){
    if(!online()||!session()) return;
    clearTimeout(schedule.timer);
    schedule.timer=setTimeout(()=>drainAll().catch(error=>console.error("ARISE entity outbox",error)),300);
  }

  if(root.addEventListener){
    root.addEventListener("online",schedule);
    root.addEventListener("arise:local-change",schedule);
  }

  root.ARISE_ENTITY_OUTBOX={drainAll,drainProfile,processMutation,categoryPayload,goalPayload,assertNoConflict,schedule};
})(typeof globalThis!=="undefined"?globalThis:window);
