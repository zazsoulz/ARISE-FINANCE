const fs=require('node:fs');

const NAV_MARKER=`/* =========================================================\n   NAV\n========================================================= */`;
const GOAL_CARD_MARKER=`/* =========================================================\n   GOAL CARD\n========================================================= */`;
const ALLOWED_FUNCTIONS=new Set(['bindNav','profileSwitcher','bindProfileSwitcher']);

function removeNavigationCompatSource(source){
  const navStart=source.indexOf(NAV_MARKER);

  if(navStart<0){
    const legacyNames=['bindNav','profileSwitcher','bindProfileSwitcher'];
    const remaining=legacyNames.find(name=>new RegExp(`\\bfunction\\s+${name}\\s*\\(`).test(source));
    if(remaining){
      throw new Error(`Navigation compatibility source is malformed: ${remaining} remains without NAV boundary.`);
    }
    return source;
  }

  const goalCardStart=source.indexOf(GOAL_CARD_MARKER,navStart+NAV_MARKER.length);
  if(goalCardStart<0||goalCardStart<=navStart){
    throw new Error('Navigation compatibility source is malformed: GOAL CARD boundary missing.');
  }

  const block=source.slice(navStart,goalCardStart);
  const functionNames=[...block.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]);
  const expected=['bindNav','profileSwitcher','bindProfileSwitcher'];

  for(const name of expected){
    const count=functionNames.filter(current=>current===name).length;
    if(count!==1){
      throw new Error(`Navigation compatibility source is malformed: expected one ${name}, found ${count}.`);
    }
  }

  const unexpected=functionNames.find(name=>!ALLOWED_FUNCTIONS.has(name));
  if(unexpected){
    throw new Error(`Navigation compatibility source contains unexpected helper ${unexpected}; refusing broad cleanup.`);
  }

  return source.slice(0,navStart)+source.slice(goalCardStart);
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const source=fs.readFileSync(shellPath,'utf8');
  const cleaned=removeNavigationCompatSource(source);
  const changed=cleaned!==source;

  if(mode==='--check'){
    console.log(changed
      ? 'Legacy navigation/profile compatibility helpers can be removed safely.'
      : 'Legacy navigation/profile compatibility helpers are already removed.');
    return;
  }

  if(mode==='--write'){
    if(changed) fs.writeFileSync(shellPath,cleaned);
    console.log(changed
      ? 'Legacy navigation/profile compatibility helpers removed.'
      : 'No legacy navigation/profile compatibility helpers found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module) run();

module.exports={NAV_MARKER,GOAL_CARD_MARKER,ALLOWED_FUNCTIONS,removeNavigationCompatSource};
