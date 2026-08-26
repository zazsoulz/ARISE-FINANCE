'use strict';

const CANONICAL_TABLES=[
  'finance_profiles',
  'finance_categories',
  'finance_goals',
  'finance_transactions',
  'finance_allocations',
  'sync_receipts'
];

function required(env,name){
  const value=String(env[name]||'').trim();
  if(!value)throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeUrl(value){
  return value.replace(/\/+$/,'');
}

async function readJson(response,label){
  const text=await response.text();
  let body=null;
  if(text){
    try{body=JSON.parse(text);}catch(_error){body=text;}
  }
  if(!response.ok){
    const detail=typeof body==='string'?body:JSON.stringify(body);
    throw new Error(`${label} failed with HTTP ${response.status}${detail?`: ${detail}`:''}`);
  }
  return body;
}

async function runPreflight({env=process.env,fetchImpl=globalThis.fetch}={}){
  if(typeof fetchImpl!=='function')throw new Error('A fetch implementation is required.');

  const url=normalizeUrl(required(env,'SUPABASE_URL'));
  const apiKey=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
  if(!apiKey)throw new Error('Missing SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY.');
  const email=required(env,'ARISE_BETA_EMAIL');
  const password=required(env,'ARISE_BETA_PASSWORD');

  const authResponse=await fetchImpl(`${url}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{'apikey':apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const auth=await readJson(authResponse,'Supabase beta sign-in');
  const accessToken=String(auth&&auth.access_token||'').trim();
  if(!accessToken)throw new Error('Supabase beta sign-in returned no access token.');

  const headers={apikey:apiKey,Authorization:`Bearer ${accessToken}`};
  const checks=[];
  for(const table of CANONICAL_TABLES){
    const response=await fetchImpl(`${url}/rest/v1/${table}?select=*&limit=1`,{method:'GET',headers});
    await readJson(response,`Read ${table}`);
    checks.push({table,status:response.status});
  }

  return {ok:true,tables:checks};
}

if(require.main===module){
  runPreflight().then(result=>{
    console.log(`ARISE Supabase beta preflight passed: ${result.tables.length} canonical tables reachable through authenticated RLS.`);
  }).catch(error=>{
    console.error(error&&error.stack||error);
    process.exitCode=1;
  });
}

module.exports={CANONICAL_TABLES,runPreflight};
