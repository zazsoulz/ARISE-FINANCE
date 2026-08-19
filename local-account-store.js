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

  function write(){
    const key=activeAccountId?accountKey(activeAccountId):GUEST_KEY;
    if(state.account) delete state.account.password;
    localStorage.setItem(key,JSON.stringify(state));
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
  root.ARISE_LOCAL_ACCOUNTS={activate,deactivate,currentAccountId,accountKey};
})(typeof globalThis!=="undefined"?globalThis:window);
