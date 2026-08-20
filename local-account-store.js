(function(root){
  "use strict";

  const BASE_KEY=typeof STORAGE_KEY!=="undefined"?STORAGE_KEY:"arise.finance.production.v1";
  const LAST_ACCOUNT_KEY=BASE_KEY+".lastAccountId";
  const LEGACY_CLAIM_KEY=BASE_KEY+".legacyClaimedBy";
  const GUEST_KEY=BASE_KEY+".guest";
  const bootLegacyState=clone(state);
  let activeAccountId=null;

  const accountKey=id=>BASE_KEY+".account."+id;

  function sanitize(next){
    const normalized=normalizeState(next||defaultState());
    if(normalized.account) delete normalized.account.password;
    return normalized;
  }

  function read(key){
    try{
      const raw=localStorage.getItem(key);
      return raw?sanitize(JSON.parse(raw)):null;
    }catch(error){
      console.error("ARISE local account read",error);
      return null;
    }
  }

  function hasVault(accountId){
    if(!accountId) return false;
    return !!read(accountKey(String(accountId)));
  }

  async function restoreFromIndexedDb(accountId){
    if(!accountId||hasVault(accountId)) return false;
    const idb=root.ARISE_INDEXED_DB;
    if(!idb||!idb.loadState) return false;
    try{
      const restored=await idb.loadState(String(accountId));
      if(!restored||!Array.isArray(restored.profiles)||!restored.profiles.length) return false;
      activeAccountId=String(accountId);
      state=sanitize(restored);
      localStorage.setItem(LAST_ACCOUNT_KEY,activeAccountId);
      localStorage.setItem(accountKey(activeAccountId),JSON.stringify(state));
      return true;
    }catch(error){
      console.error("ARISE IndexedDB restore",error);
      return false;
    }
  }

  function remoteId(entity){
    return entity&&entity.ariseSync&&entity.ariseSync.remoteId||null;
  }

  function ensureProfileSync(profile){
    if(!profile.ariseSync||typeof profile.ariseSync!=="object") profile.ariseSync={};
    return profile.ariseSync;
  }

  function findMatchingProfile(profiles,oldProfile){
    const oldRemoteId=remoteId(oldProfile);
    return (profiles||[]).find(profile=>
      String(profile.id)===String(oldProfile.id)||
      (oldRemoteId&&remoteId(profile)===oldRemoteId)
    )||null;
  }

  function recordEntityDeletions(previous,next,{collection,tombstoneKey}){
    if(!previous||!Array.isArray(previous.profiles)||!next||!Array.isArray(next.profiles)) return;

    for(const oldProfile of previous.profiles){
      const currentProfile=findMatchingProfile(next.profiles,oldProfile);
      if(!currentProfile) continue;

      const currentEntities=Array.isArray(currentProfile[collection])?currentProfile[collection]:[];
      const currentLocalIds=new Set(currentEntities.map(entity=>String(entity.id)));
      const currentRemoteIds=new Set(currentEntities.map(remoteId).filter(Boolean));
      const deleted=[];

      for(const oldEntity of oldProfile[collection]||[]){
        const id=remoteId(oldEntity);
        if(!id) continue;
        if(currentLocalIds.has(String(oldEntity.id))||currentRemoteIds.has(id)) continue;
        deleted.push(id);
      }

      if(deleted.length){
        const meta=ensureProfileSync(currentProfile);
        meta[tombstoneKey]=[...new Set([...(meta[tombstoneKey]||[]),...deleted])];
        meta.dirty=true;
        meta.changedAt=new Date().toISOString();
      }
    }
  }

  function recordCategoryDeletions(previous,next){
    recordEntityDeletions(previous,next,{collection:"categories",tombstoneKey:"deletedCategoryIds"});
  }

  function recordGoalDeletions(previous,next){
    recordEntityDeletions(previous,next,{collection:"goals",tombstoneKey:"deletedGoalIds"});
  }

  function recordMutationOutbox(previous,next){
    const outbox=root.ARISE_SYNC_OUTBOX;
    if(!outbox||!next||!Array.isArray(next.profiles)) return;
    const previousProfiles=previous&&Array.isArray(previous.profiles)?previous.profiles:[];

    for(const currentProfile of next.profiles){
      const previousProfile=findMatchingProfile(previousProfiles,currentProfile)||previousProfiles.find(profile=>String(profile.id)===String(currentProfile.id))||null;
      if(outbox.recordTransactionChanges) outbox.recordTransactionChanges(previousProfile,currentProfile);
      if(outbox.recordCategoryChanges) outbox.recordCategoryChanges(previousProfile,currentProfile);
      if(outbox.recordGoalChanges) outbox.recordGoalChanges(previousProfile,currentProfile);
    }
  }

  function mirrorIndexedDb(){
    const idb=root.ARISE_INDEXED_DB;
    if(!activeAccountId||!idb||!idb.saveState) return;
    Promise.resolve(idb.saveState(activeAccountId,state)).catch(error=>{
      console.error("ARISE IndexedDB mirror",error);
    });
  }

  function write(){
    const key=activeAccountId?accountKey(activeAccountId):GUEST_KEY;
    if(state.account) delete state.account.password;

    if(!root.ARISE_SYNC_SILENT){
      const previous=read(key);
      recordMutationOutbox(previous,state);
    }

    localStorage.setItem(key,JSON.stringify(state));
    mirrorIndexedDb();

    if(!root.ARISE_SYNC_SILENT&&root.dispatchEvent){
      root.dispatchEvent(new CustomEvent("arise:local-change",{detail:{accountId:activeAccountId,at:new Date().toISOString()}}));
    }
  }

  function writeSilently(){
    const previousSilent=root.ARISE_SYNC_SILENT;
    root.ARISE_SYNC_SILENT=true;
    try{write();}
    finally{root.ARISE_SYNC_SILENT=previousSilent;}
  }

  root.saveState=write;

  function activate(accountId){
    if(!accountId) throw new Error("Account id is required.");
    activeAccountId=String(accountId);
    localStorage.setItem(LAST_ACCOUNT_KEY,activeAccountId);

    const existing=read(accountKey(activeAccountId));
    if(existing){
      state=existing;
      mirrorIndexedDb();
      return state;
    }

    const claimedBy=localStorage.getItem(LEGACY_CLAIM_KEY);
    if(!claimedBy){
      state=sanitize(bootLegacyState);
      localStorage.setItem(LEGACY_CLAIM_KEY,activeAccountId);
    }else{
      state=sanitize(defaultState());
    }

    // The first local vault snapshot is a baseline, not a user mutation.
    // Persist it silently so server pull can attach canonical remote IDs before outbox seeding.
    writeSilently();
    return state;
  }

  function deactivate(){
    activeAccountId=null;
    localStorage.removeItem(LAST_ACCOUNT_KEY);
    state=sanitize(defaultState());
    state.account.registered=false;
    writeSilently();
    return state;
  }

  function preloadLastAccount(){
    const last=localStorage.getItem(LAST_ACCOUNT_KEY);
    if(!last) return false;
    const existing=read(accountKey(last));
    if(!existing) return false;
    activeAccountId=last;
    state=existing;
    mirrorIndexedDb();
    return true;
  }

  function currentAccountId(){return activeAccountId;}

  preloadLastAccount();
  root.ARISE_LOCAL_ACCOUNTS={
    activate,deactivate,currentAccountId,accountKey,hasVault,restoreFromIndexedDb,
    recordCategoryDeletions,recordGoalDeletions,recordMutationOutbox,mirrorIndexedDb,writeSilently
  };
})(typeof globalThis!=="undefined"?globalThis:window);
