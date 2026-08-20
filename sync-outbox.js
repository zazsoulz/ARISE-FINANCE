(function(root){
  "use strict";

  const META_KEY="ariseSync";
  const OUTBOX_KEY="outbox";

  function ensureMeta(profile){
    if(!profile[META_KEY]||typeof profile[META_KEY]!=="object") profile[META_KEY]={};
    if(!Array.isArray(profile[META_KEY][OUTBOX_KEY])) profile[META_KEY][OUTBOX_KEY]=[];
    return profile[META_KEY];
  }

  function mutationKey(mutation){
    return String(mutation.entity||"")+":"+String(mutation.entityLocalId||mutation.entityRemoteId||"");
  }

  function enqueue(profile,mutation){
    const meta=ensureMeta(profile);
    const now=new Date().toISOString();
    const next={
      entity:String(mutation.entity||""),
      entityLocalId:mutation.entityLocalId==null?null:String(mutation.entityLocalId),
      entityRemoteId:mutation.entityRemoteId||null,
      action:mutation.action==="delete"?"delete":"upsert",
      createdAt:mutation.createdAt||now,
      updatedAt:now,
      attempts:0,
      lastError:null
    };
    next.id=mutationKey(next);
    const index=meta[OUTBOX_KEY].findIndex(item=>item.id===next.id);
    if(index>=0){
      const previous=meta[OUTBOX_KEY][index];
      meta[OUTBOX_KEY][index]={...previous,...next,createdAt:previous.createdAt||next.createdAt};
    }else{
      meta[OUTBOX_KEY].push(next);
    }
    meta.dirty=true;
    meta.changedAt=now;
    return next;
  }

  function list(profile,entity){
    const items=ensureMeta(profile)[OUTBOX_KEY];
    return entity?items.filter(item=>item.entity===entity):items.slice();
  }

  function ack(profile,id){
    const meta=ensureMeta(profile);
    const before=meta[OUTBOX_KEY].length;
    meta[OUTBOX_KEY]=meta[OUTBOX_KEY].filter(item=>item.id!==id);
    return before!==meta[OUTBOX_KEY].length;
  }

  function fail(profile,id,error){
    const meta=ensureMeta(profile);
    const item=meta[OUTBOX_KEY].find(entry=>entry.id===id);
    if(!item) return false;
    item.attempts=(Number(item.attempts)||0)+1;
    item.lastError=String(error&&error.message||error||"Sync failed");
    item.updatedAt=new Date().toISOString();
    return true;
  }

  function snapshot(entity){
    if(!entity||typeof entity!=="object") return "";
    const copy={...entity};
    delete copy[META_KEY];
    return JSON.stringify(copy);
  }

  function recordCollectionChanges(previousProfile,nextProfile,{collection,entity}){
    if(!nextProfile) return 0;
    const previous=previousProfile&&Array.isArray(previousProfile[collection])?previousProfile[collection]:[];
    const current=Array.isArray(nextProfile[collection])?nextProfile[collection]:[];
    const previousById=new Map(previous.map(item=>[String(item.id),item]));
    const currentById=new Map(current.map(item=>[String(item.id),item]));
    let count=0;

    for(const item of current){
      const old=previousById.get(String(item.id));
      if(!old||snapshot(old)!==snapshot(item)){
        enqueue(nextProfile,{entity,entityLocalId:item.id,entityRemoteId:item[META_KEY]&&item[META_KEY].remoteId||null,action:"upsert"});
        count++;
      }
    }

    for(const old of previous){
      if(currentById.has(String(old.id))) continue;
      enqueue(nextProfile,{entity,entityLocalId:old.id,entityRemoteId:old[META_KEY]&&old[META_KEY].remoteId||null,action:"delete"});
      count++;
    }
    return count;
  }

  function recordTransactionChanges(previousProfile,nextProfile){
    return recordCollectionChanges(previousProfile,nextProfile,{collection:"transactions",entity:"transaction"});
  }

  function recordCategoryChanges(previousProfile,nextProfile){
    return recordCollectionChanges(previousProfile,nextProfile,{collection:"categories",entity:"category"});
  }

  function recordGoalChanges(previousProfile,nextProfile){
    return recordCollectionChanges(previousProfile,nextProfile,{collection:"goals",entity:"goal"});
  }

  root.ARISE_SYNC_OUTBOX={
    ensureMeta,enqueue,list,ack,fail,snapshot,recordCollectionChanges,
    recordTransactionChanges,recordCategoryChanges,recordGoalChanges
  };
})(typeof globalThis!=="undefined"?globalThis:window);
