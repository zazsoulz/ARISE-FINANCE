(function(root){
  "use strict";

  const DB_NAME="arise-finance-local";
  const DB_VERSION=1;
  const STORES={
    accounts:"accounts",
    profiles:"profiles",
    categories:"categories",
    goals:"goals",
    transactions:"transactions",
    meta:"meta"
  };

  let dbPromise=null;

  function supported(){return typeof indexedDB!=="undefined";}

  function requestResult(request){
    return new Promise((resolve,reject)=>{
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("IndexedDB request failed"));
    });
  }

  function transactionDone(tx){
    return new Promise((resolve,reject)=>{
      tx.oncomplete=()=>resolve();
      tx.onabort=()=>reject(tx.error||new Error("IndexedDB transaction aborted"));
      tx.onerror=()=>reject(tx.error||new Error("IndexedDB transaction failed"));
    });
  }

  function ensureStore(db,name,keyPath,indexes=[]){
    if(db.objectStoreNames.contains(name)) return null;
    const store=db.createObjectStore(name,{keyPath});
    for(const [indexName,indexKeyPath,options] of indexes){
      store.createIndex(indexName,indexKeyPath,options||{});
    }
    return store;
  }

  function open(){
    if(!supported()) return Promise.resolve(null);
    if(dbPromise) return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        ensureStore(db,STORES.accounts,"accountId");
        ensureStore(db,STORES.profiles,["accountId","profileId"],[
          ["byAccount","accountId",{unique:false}]
        ]);
        ensureStore(db,STORES.categories,["accountId","profileId","entityId"],[
          ["byProfile",["accountId","profileId"],{unique:false}]
        ]);
        ensureStore(db,STORES.goals,["accountId","profileId","entityId"],[
          ["byProfile",["accountId","profileId"],{unique:false}]
        ]);
        ensureStore(db,STORES.transactions,["accountId","profileId","entityId"],[
          ["byProfile",["accountId","profileId"],{unique:false}]
        ]);
        ensureStore(db,STORES.meta,"accountId");
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>db.close();
        resolve(db);
      };
      request.onerror=()=>reject(request.error||new Error("IndexedDB open failed"));
      request.onblocked=()=>console.warn("ARISE IndexedDB upgrade is blocked by another tab");
    });
    return dbPromise;
  }

  async function deleteByIndex(store,indexName,key){
    const index=store.index(indexName);
    const range=IDBKeyRange.only(key);
    await new Promise((resolve,reject)=>{
      const request=index.openCursor(range);
      request.onerror=()=>reject(request.error||new Error("IndexedDB cursor failed"));
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor){resolve();return;}
        cursor.delete();
        cursor.continue();
      };
    });
  }

  function cleanState(next){
    const cloneValue=JSON.parse(JSON.stringify(next||{}));
    if(cloneValue.account) delete cloneValue.account.password;
    return cloneValue;
  }

  async function saveState(accountId,nextState){
    if(!accountId||!supported()) return {status:"unsupported"};
    const db=await open();
    if(!db) return {status:"unsupported"};
    const stateValue=cleanState(nextState);
    const names=Object.values(STORES);
    const tx=db.transaction(names,"readwrite");
    const accountStore=tx.objectStore(STORES.accounts);
    const profileStore=tx.objectStore(STORES.profiles);
    const categoryStore=tx.objectStore(STORES.categories);
    const goalStore=tx.objectStore(STORES.goals);
    const transactionStore=tx.objectStore(STORES.transactions);
    const metaStore=tx.objectStore(STORES.meta);

    accountStore.put({accountId,account:stateValue.account||{}});

    await deleteByIndex(profileStore,"byAccount",accountId);
    for(const store of [categoryStore,goalStore,transactionStore]){
      const index=store.index("byProfile");
      await new Promise((resolve,reject)=>{
        const request=index.openCursor();
        request.onerror=()=>reject(request.error||new Error("IndexedDB cursor failed"));
        request.onsuccess=()=>{
          const cursor=request.result;
          if(!cursor){resolve();return;}
          const value=cursor.value;
          if(value&&value.accountId===accountId) cursor.delete();
          cursor.continue();
        };
      });
    }

    for(const profile of stateValue.profiles||[]){
      const profileId=String(profile.id);
      const profileRecord={...profile};
      delete profileRecord.categories;
      delete profileRecord.goals;
      delete profileRecord.transactions;
      profileStore.put({accountId,profileId,profile:profileRecord});

      for(const category of profile.categories||[]){
        categoryStore.put({accountId,profileId,entityId:String(category.id),value:category});
      }
      for(const goal of profile.goals||[]){
        goalStore.put({accountId,profileId,entityId:String(goal.id),value:goal});
      }
      for(const transaction of profile.transactions||[]){
        transactionStore.put({accountId,profileId,entityId:String(transaction.id),value:transaction});
      }
    }

    metaStore.put({
      accountId,
      activeProfileId:stateValue.activeProfileId||null,
      version:stateValue.version||1,
      savedAt:new Date().toISOString()
    });

    await transactionDone(tx);
    return {status:"saved",accountId};
  }

  async function rowsByIndex(store,indexName,key){
    return requestResult(store.index(indexName).getAll(IDBKeyRange.only(key)));
  }

  async function loadState(accountId){
    if(!accountId||!supported()) return null;
    const db=await open();
    if(!db) return null;
    const names=Object.values(STORES);
    const tx=db.transaction(names,"readonly");
    const accountRow=await requestResult(tx.objectStore(STORES.accounts).get(accountId));
    const metaRow=await requestResult(tx.objectStore(STORES.meta).get(accountId));
    const profileRows=await rowsByIndex(tx.objectStore(STORES.profiles),"byAccount",accountId);
    const categoriesStore=tx.objectStore(STORES.categories);
    const goalsStore=tx.objectStore(STORES.goals);
    const transactionsStore=tx.objectStore(STORES.transactions);

    if(!accountRow&&!profileRows.length) return null;

    const profiles=[];
    for(const row of profileRows){
      const profileId=row.profileId;
      const [categoryRows,goalRows,transactionRows]=await Promise.all([
        rowsByIndex(categoriesStore,"byProfile",[accountId,profileId]),
        rowsByIndex(goalsStore,"byProfile",[accountId,profileId]),
        rowsByIndex(transactionsStore,"byProfile",[accountId,profileId])
      ]);
      profiles.push({
        ...(row.profile||{}),
        categories:categoryRows.map(item=>item.value),
        goals:goalRows.map(item=>item.value),
        transactions:transactionRows.map(item=>item.value)
      });
    }

    return {
      version:metaRow&&metaRow.version||1,
      account:accountRow&&accountRow.account||{},
      profiles,
      activeProfileId:metaRow&&metaRow.activeProfileId||profiles[0]&&profiles[0].id||null,
      __indexedDbSavedAt:metaRow&&metaRow.savedAt||null
    };
  }

  async function deleteAccount(accountId){
    if(!accountId||!supported()) return false;
    const db=await open();
    if(!db) return false;
    const tx=db.transaction(Object.values(STORES),"readwrite");
    tx.objectStore(STORES.accounts).delete(accountId);
    tx.objectStore(STORES.meta).delete(accountId);
    await deleteByIndex(tx.objectStore(STORES.profiles),"byAccount",accountId);
    for(const storeName of [STORES.categories,STORES.goals,STORES.transactions]){
      const store=tx.objectStore(storeName);
      await new Promise((resolve,reject)=>{
        const request=store.openCursor();
        request.onerror=()=>reject(request.error||new Error("IndexedDB cursor failed"));
        request.onsuccess=()=>{
          const cursor=request.result;
          if(!cursor){resolve();return;}
          if(cursor.value&&cursor.value.accountId===accountId) cursor.delete();
          cursor.continue();
        };
      });
    }
    await transactionDone(tx);
    return true;
  }

  root.ARISE_INDEXED_DB={supported,open,saveState,loadState,deleteAccount,DB_NAME,DB_VERSION,STORES};
})(typeof globalThis!=="undefined"?globalThis:window);
