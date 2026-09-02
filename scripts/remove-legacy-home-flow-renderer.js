const fs=require('node:fs');
const path=require('node:path');

const LEGACY_TOKENS=[
  'homeFlowVertexShader',
  'homeFlowFragmentShader',
  'parseFlowTexture',
  'compileHomeFlowShader',
  'createHomeFlowProgram',
  'sizeHomeFlowCanvas',
  'startWebGLHomeFlow',
  'startCanvasHomeFlow',
  'startHomeFluidFlow'
];

const START_MARKER='  const homeFlowVertexShader=[';
const END_MARKER='  function homeFlowScene(){';
const START_CALL='    startHomeFluidFlow(page.querySelector(".arise-flow-canvas"));';
const EXPORT_FRAGMENT=',summaryFlowScene,startHomeFluidFlow};';
const CLEAN_EXPORT_FRAGMENT=',summaryFlowScene};';

function count(source,needle){
  return source.split(needle).length-1;
}

function assertCanonicalAnchors(source){
  if(count(source,END_MARKER)!==1)throw new Error('Expected exactly one canonical homeFlowScene anchor.');
  if(count(source,'  root.renderHome=function(){')!==1)throw new Error('Expected exactly one canonical renderHome owner.');
  if(!source.includes('    bindPageLinks(page);'))throw new Error('Canonical home interaction binding is missing.');
}

function legacyPresence(source){
  return LEGACY_TOKENS.filter(token=>source.includes(token));
}

function transform(source){
  if(typeof source!=='string')throw new TypeError('ARISE source must be UTF-8 text.');
  assertCanonicalAnchors(source);

  const present=legacyPresence(source);
  const hasStart=source.includes(START_MARKER);
  const startCallCount=count(source,START_CALL);
  const exportCount=count(source,EXPORT_FRAGMENT);

  if(present.length===0&&!hasStart&&startCallCount===0&&exportCount===0)return source;

  if(present.length!==LEGACY_TOKENS.length){
    throw new Error(`Partial legacy home-flow renderer detected: ${present.join(', ')||'none'}.`);
  }
  if(count(source,START_MARKER)!==1)throw new Error('Expected exactly one legacy home-flow block start.');
  if(startCallCount!==1)throw new Error('Expected exactly one legacy home-flow startup call.');
  if(exportCount!==1)throw new Error('Expected exactly one legacy home-flow export entry.');

  const start=source.indexOf(START_MARKER);
  const end=source.indexOf(END_MARKER);
  if(start<0||end<0||end<=start)throw new Error('Legacy home-flow block boundaries are invalid.');

  let next=source.slice(0,start)+source.slice(end);
  next=next.replace(`${START_CALL}\n`,'');
  next=next.replace(EXPORT_FRAGMENT,CLEAN_EXPORT_FRAGMENT);

  const leftovers=legacyPresence(next);
  if(leftovers.length)throw new Error(`Legacy home-flow symbols survived cleanup: ${leftovers.join(', ')}.`);
  if(next.includes(START_MARKER)||next.includes(START_CALL)||next.includes(EXPORT_FRAGMENT)){
    throw new Error('Legacy home-flow boundary/startup/export survived cleanup.');
  }
  assertCanonicalAnchors(next);
  return next;
}

function main(argv=process.argv.slice(2)){
  const check=argv.includes('--check');
  const fileArg=argv.find(arg=>!arg.startsWith('--'))||'arise-v3.js';
  const target=path.resolve(process.cwd(),fileArg);
  const source=fs.readFileSync(target,'utf8');
  const next=transform(source);
  if(check){
    process.stdout.write(next===source?'legacy home-flow renderer already retired\n':'legacy home-flow renderer can be retired safely\n');
    return;
  }
  if(next!==source)fs.writeFileSync(target,next);
  process.stdout.write(next===source?'legacy home-flow renderer already retired\n':'retired legacy home-flow renderer\n');
}

if(require.main===module)main();

module.exports={transform,LEGACY_TOKENS,START_MARKER,END_MARKER,START_CALL,EXPORT_FRAGMENT,CLEAN_EXPORT_FRAGMENT};
