const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function storage(){
  const map=new Map();
  return {
    getItem:key=>map.has(String(key))?map.get(String(key)):null,
    setItem:(key,value)=>map.set(String(key),String(value)),
    removeItem:key=>map.delete(String(key)),
    dump:()=>Object.fromEntries(map)
  };
}

function boot(){
  const localStorage=storage();
  const context={
    console,
    localStorage,
    STORAGE_KEY:'arise.finance.production.v1',
    state:{version:1,account:{name:'Legacy',email:'legacy@example.com',avatar:'',password:'plaintext',notifications:true,registered:true},profiles:[{id:'legacy-profile',name:'Локальные деньги',categories:[],goals:[],transactions:[{id:'tx1',type:'income',amount:100}]}],activeProfileId:'legacy-profile'},
    clone:value=>JSON.parse(JSON.stringify(value)),
    normalizeState:value=>value,
    defaultState:()=>({version:1,account:{name:'',email:'',avatar:'',notifications:true,registered:false},profiles:[{id:'default-profile',name:'Мой профиль',categories:[],goals:[],transactions:[]}],activeProfileId:'default-profile'})
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('sync-outbox.js','utf8'),context);
  vm.runInContext(fs.readFileSync('local-account-store.js','utf8'),context);
  return {context,localStorage};
}

test('legacy data is claimed once by the first authenticated account and password is removed',()=>{
  const {context,localStorage}=boot();
  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  assert.equal(context.state.profiles[0].name,'Локальные деньги');
  assert.equal(context.state.account.password,undefined);
  context.saveState();
  const saved=JSON.parse(localStorage.getItem('arise.finance.production.v1.account.user-a'));
  assert.equal(saved.account.password,undefined);
  assert.equal(saved.profiles[0].transactions[0].amount,100);
});

test('different authenticated accounts never share local financial profiles',()=>{
  const {context}=boot();
  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  context.state.profiles[0].transactions.push({id:'private-a',type:'expense',amount:77});
  context.saveState();

  context.ARISE_LOCAL_ACCOUNTS.deactivate();
  context.ARISE_LOCAL_ACCOUNTS.activate('user-b');
  assert.equal(context.state.profiles[0].id,'default-profile');
  assert.equal(context.state.profiles[0].transactions.length,0);

  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  assert.equal(context.state.profiles[0].transactions.some(tx=>tx.id==='private-a'),true);
});

test('last authenticated vault can preload for offline startup',()=>{
  const {context,localStorage}=boot();
  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  context.state.account.registered=true;
  context.state.profiles[0].name='Offline A';
  context.saveState();

  const saved=localStorage.getItem('arise.finance.production.v1.account.user-a');
  assert.ok(saved);
  assert.equal(localStorage.getItem('arise.finance.production.v1.lastAccountId'),'user-a');
});

test('offline transaction change is persisted together with its sync outbox mutation',()=>{
  const {context,localStorage}=boot();
  context.ARISE_LOCAL_ACCOUNTS.activate('user-a');
  context.saveState();
  const profile=context.state.profiles[0];
  profile.transactions.push({id:'offline-expense',type:'expense',amount:450,date:'2026-08-20'});
  context.saveState();

  const saved=JSON.parse(localStorage.getItem('arise.finance.production.v1.account.user-a'));
  const savedProfile=saved.profiles[0];
  assert.equal(savedProfile.transactions.some(tx=>tx.id==='offline-expense'),true);
  const queued=savedProfile.ariseSync.outbox.filter(item=>item.entity==='transaction'&&item.entityLocalId==='offline-expense');
  assert.equal(queued.length,1);
  assert.equal(queued[0].action,'upsert');
});
