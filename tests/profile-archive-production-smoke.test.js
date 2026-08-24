const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {extractManifest}=require('../scripts/build-standalone-preview.js');

const shell=fs.readFileSync('app-shell.html','utf8');
const index=fs.readFileSync('index.html','utf8');
const financialMarker=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const uiMarker=`/* =========================================================\n   UI\n========================================================= */`;
const initMarker=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function effectiveShellScript(){
  const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length,1,'expected one inline shell script');
  let source=scripts[0][1];
  const financialStart=source.indexOf(financialMarker);
  const uiStart=source.indexOf(uiMarker);
  assert.ok(financialStart>=0&&uiStart>financialStart);
  source=source.slice(0,financialStart)+source.slice(uiStart);
  const initStart=source.indexOf(initMarker);
  assert.ok(initStart>=0);
  return source.slice(0,initStart);
}

function execute(context,source,filename='inline.js'){
  return new vm.Script(source,{filename}).runInContext(context);
}

async function boot(){
  const dom=new JSDOM(shell,{url:'https://arise.local/',runScripts:'outside-only',pretendToBeVisual:true});
  dom.window.alert=()=>{};
  dom.window.confirm=()=>true;
  const context=dom.getInternalVMContext();
  execute(context,effectiveShellScript(),'app-shell-effective.js');
  execute(context,`globalThis.__ARISE_LEGACY_FINANCIAL_STRIPPED__=true; state.account.registered=true; state.account.name='QA'; saveState();`,'seed-account.js');
  const manifest=extractManifest(index);
  for(const source of manifest.scripts){
    if(/^https?:\/\//i.test(source))continue;
    const path=source.replace(/^\.\//,'');
    const result=execute(context,fs.readFileSync(path,'utf8'),path);
    if(result&&typeof result.then==='function')await result;
  }
  return {dom,context,manifest};
}

test('production profile lifecycle archives a funded remote profile before removing local data',async()=>{
  const {dom,context,manifest}=await boot();
  assert.ok(manifest.scripts.includes('./profile-lifecycle.js'),'profile lifecycle missing from production manifest');

  const result=await execute(context,`(async()=>{
    const base=activeProfile();
    base.id='base-profile';
    const archived=createProfile('Archive me');
    archived.id='archive-profile';
    archived.transactions=[{id:'income-archive',type:'income',date:'2026-08-24',month:'2026-08',amount:5000,allocations:[],goalAllocations:[],reserve:0,remainder:5000}];
    archived.ariseSync={remoteId:'remote-archive',syncedAt:'2026-08-24T09:00:00.000Z',dirty:false};
    state.profiles=[base,archived];
    state.activeProfileId=archived.id;
    const calls=[];
    globalThis.ARISE_SUPABASE={
      currentSession:()=>({user:{id:'qa'}}),
      archiveFinanceProfile:async id=>{calls.push(id);return {id};}
    };
    await ARISE_PROFILE_LIFECYCLE.removeProfile(archived.id);
    return {calls,ids:state.profiles.map(profile=>profile.id),activeProfileId:state.activeProfileId};
  })()`,'archive-profile.js');

  assert.deepEqual([...result.calls],['remote-archive']);
  assert.deepEqual([...result.ids],['base-profile']);
  assert.equal(result.activeProfileId,'base-profile');
  dom.window.close();
});

test('production archived-profile recovery rehydrates server history and activates restored profile',async()=>{
  const {dom,context}=await boot();
  const result=await execute(context,`(async()=>{
    const remoteId='remote-restored';
    const calls=[];
    globalThis.ARISE_SUPABASE={
      currentSession:()=>({user:{id:'qa'}}),
      restoreFinanceProfile:async id=>{calls.push(['restore',id]);return {id,name:'Restored',base_currency:'RUB'};},
      listArchivedFinanceProfiles:async()=>[{id:remoteId,name:'Restored',base_currency:'RUB',archived_at:'2026-08-24T09:00:00.000Z'}]
    };
    globalThis.ARISE_SYNC_PULL={pullAll:async()=>{
      calls.push(['pull']);
      const restored=createProfile('Restored');
      restored.id='restored-local';
      restored.transactions=[{id:'restored-income',type:'income',date:'2026-08-01',month:'2026-08',amount:9000,allocations:[],goalAllocations:[],reserve:0,remainder:9000}];
      restored.ariseSync={remoteId,syncedAt:'2026-08-24T09:01:00.000Z',dirty:false};
      state.profiles.push(restored);
      saveState();
    }};
    const restored=await ARISE_PROFILE_LIFECYCLE.restoreArchivedProfile(remoteId);
    const active=activeProfile();
    return {ok:restored.ok,calls,activeId:active.id,remoteId:active.ariseSync.remoteId,transactions:active.transactions.length};
  })()`,'restore-profile.js');

  assert.equal(result.ok,true);
  assert.deepEqual([...result.calls[0]],['restore','remote-restored']);
  assert.deepEqual([...result.calls[1]],['pull']);
  assert.equal(result.activeId,'restored-local');
  assert.equal(result.remoteId,'remote-restored');
  assert.equal(result.transactions,1);
  dom.window.close();
});
