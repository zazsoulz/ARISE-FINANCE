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

  function remoteId(entity){
    return entity&&entity.ariseSync&&entity.ariseSync.remoteId||null;
  }

  function ensureProfileSync(profile){
    if(!profile.ariseSync||typeof profile.ariseSync!=="object") profile.ariseSync={};
    return profile.ariseSync;
  }

  function recordCategoryDeletions(previous,next){
    if(!previous||!Array.isArray(previous.profiles)||!next||!Array.isArray(next.profiles)) return;

    for(const oldProfile of previous.profiles){
      const oldRemoteId=remoteId(oldProfile);
      const currentProfile=next.profiles.find(profile=>
        String(profile.id)===String(oldProfile.id)||
        (oldRemoteId&&remoteId(profile)===oldRemoteId)
      );
      if(!currentProfile) continue;

      const currentLocalIds=new Set((currentProfile.categories||[]).map(category=>String(category.id)));
      const currentRemoteIds=new Set((currentProfile.categories||[]).map(remoteId).filter(Boolean));
      const deleted=[];

      for(const oldCategory of oldProfile.categories||[]){
        const id=remoteId(oldCategory);
        if(!id) continue;
        if(currentLocalIds.has(String(oldCategory.id))||currentRemoteIds.has(id)) continue;
        deleted.push(id);
      }

      if(deleted.length){
        const meta=ensureProfileSync(currentProfile);
        meta.deletedCategoryIds=[...new Set([...(meta.deletedCategoryIds||[]),...deleted])];
        meta.dirty=true;
        meta.changedAt=new Date().toISOString();
      }
    }
  }

  function write(){
    const key=activeAccountId?accountKey(activeAccountId):GUEST_KEY;
    if(state.account) delete state.account.password;

    if(!root.ARISE_SYNC_SILENT){
      const previous=read(key);
      recordCategoryDeletions(previous,state);
    }

    localStorage.setItem(key,JSON.stringify(state));
    if(!root.ARISE_SYNC_SILENT&&root.dispatchEvent){
      root.dispatchEvent(new CustomEvent("arise:local-change",{detail:{accountId:activeAccountId,at:new Date().toISOString()}}));
    }
  }

  root.saveState=write;

  function activate(accountId){
    if(!accountId) throw new Error("Account id is required.");
    activeAccountId=String(accountId);
    localStorage.setItem(LAST_ACCOUNT_KEY,activeAccountId);

    const existing=read(accountKey(activeAccountId));
    if(existing){
      state=existing;
      return state;
    }

    const claimedBy=localStorage.getItem(LEGACY_CLAIM_KEY);
    if(!claimedBy){
      state=sanitize(bootLegacyState);
      localStorage.setItem(LEGACY_CLAIM_KEY,activeAccountId);
    }else{
      state=sanitize(defaultState());
    }
    write();
    return state;
  }

  function deactivate(){
    activeAccountId=null;
    localStorage.removeItem(LAST_ACCOUNT_KEY);
    state=sanitize(defaultState());
    state.account.registered=false;
    write();
    return state;
  }

  function preloadLastAccount(){
    const last=localStorage.getItem(LAST_ACCOUNT_KEY);
    if(!last) return false;
    const existing=read(accountKey(last));
    if(!existing) return false;
    activeAccountId=last;
    state=existing;
    return true;
  }

  function currentAccountId(){return activeAccountId;}

  preloadLastAccount();
  root.ARISE_LOCAL_ACCOUNTS={activate,deactivate,currentAccountId,accountKey,recordCategoryDeletions};
})(typeof globalThis!=="undefined"?globalThis:window);
