const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const LEGACY_TABLES=[
  'profiles',
  'financial_settings',
  'goals',
  'transactions',
  'monthly_plans',
  'allocations'
];

function runtimeJavaScriptFiles(){
  return fs.readdirSync('.')
    .filter(name=>name.endsWith('.js'))
    .filter(name=>!name.startsWith('config.'))
    .sort();
}

function tableReferencePattern(table){
  const escaped=table.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`\\.from\\(\\s*['\"]${escaped}['\"]\\s*\\)`,'g');
}

test('browser runtime does not query compatibility-era Supabase tables directly',()=>{
  const violations=[];

  for(const file of runtimeJavaScriptFiles()){
    const source=fs.readFileSync(path.join('.',file),'utf8');
    for(const table of LEGACY_TABLES){
      if(tableReferencePattern(table).test(source)){
        violations.push(`${file}: .from(${JSON.stringify(table)})`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Legacy Supabase table dependency reintroduced:\n${violations.join('\n')}`
  );
});
