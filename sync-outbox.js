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
    if(index>=0) meta[OUTBOX_KEY][index]={...meta[OUTBOX_KEY][index],...next,createdAt:meta[OUTBOX_KEY][index].createdAt||next.createdAt};
    else meta[OUTBOX_KEY].push(next);
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

  function transactionSnapshot(tx){
    if(!tx||typeof tx!=="object") return "";
    const copy={...tx};
    delete copy[META_KEY];
    return JSON.stringify(copy);
  }

  function recordTransactionChanges(previousProfile,nextProfile){
    if(!nextProfile) return 0;
    const previous=previousProfile&&Array.isArray(previousProfile.transactions)?previousProfile.transactions:[];
    const current=Array.isArray(nextProfile.transactions)?nextProfile.transactions:[];
    const previousById=new Map(previous.map(tx=>[String(tx.id),tx]));
    const currentById=new Map(current.map(tx=>[String(tx.id),tx]));
    let count=0;

    for(const tx of current){
      const old=previousById.get(String(tx.id));
      if(!old||transactionSnapshot(old)!==transactionSnapshot(tx)){
        enqueue(nextProfile,{entity:"transaction",entityLocalId:tx.id,entityRemoteId:tx[META_KEY]&&tx[META_KEY].remoteId||null,action:"upsert"});
        count++;
      }
    }

    for(const old of previous){
      if(currentById.has(String(old.id))) continue;
      enqueue(nextProfile,{entity:"transaction",entityLocalId:old.id,entityRemoteId:old[META_KEY]&&old[META_KEY].remoteId||null,action:"delete"});
      count++;
    }
    return count;
  }

  root.ARISE_SYNC_OUTBOX={ensureMeta,enqueue,list,ack,fail,recordTransactionChanges};
})(typeof globalThis!=="undefined"?globalThis:window);
