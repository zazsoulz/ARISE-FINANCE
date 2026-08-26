const test=require('node:test');
const assert=require('node:assert/strict');
const {CANONICAL_TABLES,runPreflight}=require('../scripts/beta-supabase-preflight.js');

function response(status,body){
  return {
    ok:status>=200&&status<300,
    status,
    async text(){return body===undefined?'':JSON.stringify(body);}
  };
}

const env={
  SUPABASE_URL:'https://example.supabase.co/',
  SUPABASE_PUBLISHABLE_KEY:'public-key',
  ARISE_BETA_EMAIL:'qa@example.com',
  ARISE_BETA_PASSWORD:'secret'
};

test('beta Supabase preflight authenticates once and only reads canonical finance tables',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(url.includes('/auth/v1/token'))return response(200,{access_token:'session-token'});
    return response(200,[]);
  };

  const result=await runPreflight({env,fetchImpl});
  assert.equal(result.ok,true);
  assert.deepEqual(result.tables.map(item=>item.table),CANONICAL_TABLES);
  assert.equal(calls.length,1+CANONICAL_TABLES.length);
  assert.equal(calls[0].options.method,'POST');
  assert.match(calls[0].url,/\/auth\/v1\/token\?grant_type=password$/);

  const restCalls=calls.slice(1);
  assert.ok(restCalls.every(call=>call.options.method==='GET'),'financial REST checks must be read-only');
  assert.ok(restCalls.every(call=>call.options.headers.Authorization==='Bearer session-token'));
  assert.deepEqual(restCalls.map(call=>new URL(call.url).pathname.split('/').pop()),CANONICAL_TABLES);
  assert.ok(restCalls.every(call=>!/(^|\/)(profiles|goals|transactions|allocations)$/.test(new URL(call.url).pathname)),'compatibility-era tables must not enter beta preflight');
});

test('beta Supabase preflight fails closed before network access when credentials are incomplete',async()=>{
  let calls=0;
  await assert.rejects(
    runPreflight({env:{...env,ARISE_BETA_PASSWORD:''},fetchImpl:async()=>{calls++;return response(500,{})}}),
    /ARISE_BETA_PASSWORD/
  );
  assert.equal(calls,0);
});

test('beta Supabase preflight rejects an auth response without a session token',async()=>{
  await assert.rejects(
    runPreflight({env,fetchImpl:async()=>response(200,{user:{id:'qa'}})}),
    /no access token/i
  );
});

test('beta Supabase preflight surfaces a canonical table failure without continuing silently',async()=>{
  let restReads=0;
  const fetchImpl=async(url)=>{
    if(url.includes('/auth/v1/token'))return response(200,{access_token:'session-token'});
    restReads++;
    return restReads===2?response(403,{message:'RLS denied'}):response(200,[]);
  };
  await assert.rejects(runPreflight({env,fetchImpl}),/HTTP 403/);
  assert.equal(restReads,2,'preflight should stop at the first failing canonical table');
});
