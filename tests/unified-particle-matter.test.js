const test=require('node:test');
const assert=require('node:assert/strict');

function loadMatter(){
  const modulePath=require.resolve('../home-particle-matter.js');
  delete require.cache[modulePath];
  delete globalThis.ARISE_PARTICLE_MATTER;
  delete globalThis.__ARISE_UNIFIED_PARTICLE_FLOW_INSTALLED__;
  require(modulePath);
  return globalThis.ARISE_PARTICLE_MATTER;
}

function stddev(values){
  const mean=values.reduce((sum,value)=>sum+value,0)/values.length;
  return Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length);
}

test('one deterministic population expands into a cloud and reconverges without population swaps',()=>{
  const matter=loadMatter();
  const population=matter.createParticlePopulation(1200);
  assert.equal(population.length,1200);
  assert.equal(new Set(population.map(item=>item.id)).size,1200);

  const bands={top:[],cloud:[],stream:[],reservoir:[]};
  for(const particle of population){
    const state=matter.sampleParticle(particle,0);
    if(state.progress>0.05&&state.progress<0.18)bands.top.push(state.x);
    if(state.progress>0.40&&state.progress<0.56)bands.cloud.push(state.x);
    if(state.progress>0.68&&state.progress<0.76)bands.stream.push(state.x);
    if(state.progress>0.88&&state.progress<0.97)bands.reservoir.push(state.x);
  }

  for(const [name,values] of Object.entries(bands))assert.ok(values.length>60,`${name} band undersampled`);
  assert.ok(stddev(bands.cloud)>stddev(bands.top)*1.6,'cloud state must expose a much wider particle field than dense top flow');
  assert.ok(stddev(bands.cloud)>stddev(bands.stream)*1.5,'particles must reconverge after the cloud state');
  assert.ok(stddev(bands.reservoir)>stddev(bands.stream)*1.5,'the same particles must open into the connected lower reservoir');
});

test('color tendencies are intermingled rather than assigned as independent lanes',()=>{
  const matter=loadMatter();
  const population=matter.createParticlePopulation(500);
  const left=population.filter(item=>item.lane<-.35).map(item=>item.tone);
  const middle=population.filter(item=>Math.abs(item.lane)<.2).map(item=>item.tone);
  const right=population.filter(item=>item.lane>.35).map(item=>item.tone);
  for(const group of [left,middle,right]){
    assert.ok(group.includes('cool'));
    assert.ok(group.includes('pale'));
    assert.ok(group.includes('warm'));
  }
});

test('reduced motion draws one stable frame from the same particle population',()=>{
  const previousMatchMedia=globalThis.matchMedia;
  const previousRaf=globalThis.requestAnimationFrame;
  const previousCancel=globalThis.cancelAnimationFrame;
  const previousDpr=globalThis.devicePixelRatio;
  const matter=loadMatter();
  let rafCalls=0;
  globalThis.matchMedia=()=>({matches:true});
  globalThis.requestAnimationFrame=()=>{rafCalls+=1;return 1;};
  globalThis.cancelAnimationFrame=()=>{};
  globalThis.devicePixelRatio=1;

  const context={
    setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    set globalCompositeOperation(_value){},
    set fillStyle(_value){}
  };
  const canvas={
    clientWidth:390,clientHeight:570,width:0,height:0,isConnected:true,
    dataset:{},style:{},classList:{add(){}},
    getContext(){return context;}
  };
  try{
    const controller=matter.startUnifiedParticleMatter(canvas);
    assert.ok(controller);
    assert.equal(canvas.dataset.flowArchitecture,'unified-particle-matter');
    assert.equal(canvas.dataset.flowRenderer,'particle2d');
    assert.equal(canvas.dataset.flowMotion,'reduced');
    assert.equal(canvas.dataset.flowFrames,'1');
    assert.equal(canvas.dataset.flowTime,'0.430');
    assert.equal(canvas.dataset.flowPopulation,'920');
    assert.equal(controller.population.length,920);
    assert.equal(rafCalls,0,'reduced motion must not schedule animation frames');
  }finally{
    globalThis.matchMedia=previousMatchMedia;
    globalThis.requestAnimationFrame=previousRaf;
    globalThis.cancelAnimationFrame=previousCancel;
    globalThis.devicePixelRatio=previousDpr;
  }
});
