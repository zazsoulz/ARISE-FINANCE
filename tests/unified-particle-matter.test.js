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

function mean(values){
  return values.reduce((sum,value)=>sum+value,0)/values.length;
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

test('dense regions visually cohere while cloud particles become smaller and more individually legible',()=>{
  const matter=loadMatter();
  const population=matter.createParticlePopulation(1600);
  const denseRadii=[];
  const denseHalos=[];
  const cloudRadii=[];
  const cloudHalos=[];
  for(const particle of population){
    const state=matter.sampleParticle(particle,0);
    if(state.progress>0.08&&state.progress<0.20){
      denseRadii.push(state.radius);
      denseHalos.push(state.haloRadius);
    }
    if(state.progress>0.42&&state.progress<0.56){
      cloudRadii.push(state.radius);
      cloudHalos.push(state.haloRadius);
    }
  }
  assert.ok(denseRadii.length>80&&cloudRadii.length>80,'appearance bands must be sufficiently sampled');
  assert.ok(mean(denseRadii)>mean(cloudRadii)*1.6,'dense matter should use larger particle cores than the exposed cloud');
  assert.ok(mean(denseHalos)>mean(cloudHalos)*2,'dense matter should gain cohesion from the same particles rather than a separate overlay');
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
    assert.equal(canvas.dataset.flowPopulation,'1280');
    assert.equal(controller.population.length,1280);
    assert.equal(rafCalls,0,'reduced motion must not schedule animation frames');
  }finally{
    globalThis.matchMedia=previousMatchMedia;
    globalThis.requestAnimationFrame=previousRaf;
    globalThis.cancelAnimationFrame=previousCancel;
    globalThis.devicePixelRatio=previousDpr;
  }
});

test('unified home flow suppresses the legacy texture renderer before render and reuses the canonical canvas',()=>{
  const previous={
    renderHome:globalThis.renderHome,
    document:globalThis.document,
    matchMedia:globalThis.matchMedia,
    requestAnimationFrame:globalThis.requestAnimationFrame,
    cancelAnimationFrame:globalThis.cancelAnimationFrame,
    devicePixelRatio:globalThis.devicePixelRatio
  };
  let suppressionActive=false;
  let suppressionRemoved=false;
  let legacyCalls=0;
  let cloneCalls=0;
  const context={
    setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},
    set globalCompositeOperation(_value){},
    set fillStyle(_value){}
  };
  const canvas={
    clientWidth:390,clientHeight:570,width:0,height:0,isConnected:true,
    dataset:{},style:{},classList:{add(){}},
    getContext(){return context;},
    removeAttribute(name){delete this.dataset[name];},
    cloneNode(){cloneCalls+=1;return this;}
  };
  try{
    globalThis.matchMedia=()=>({matches:true});
    globalThis.requestAnimationFrame=()=>1;
    globalThis.cancelAnimationFrame=()=>{};
    globalThis.devicePixelRatio=1;
    globalThis.document={
      head:{appendChild(style){suppressionActive=true;style.__attached=true;}},
      createElement(){
        return {
          dataset:{},textContent:'',
          remove(){suppressionActive=false;suppressionRemoved=true;this.__attached=false;}
        };
      },
      querySelector(selector){return selector==='.arise-flow-canvas'?canvas:null;}
    };
    globalThis.renderHome=()=>{
      legacyCalls+=1;
      assert.equal(suppressionActive,true,'legacy render must execute while the old texture source is suppressed');
    };
    const matter=loadMatter();
    matter.installUnifiedHomeFlow();
    globalThis.renderHome();
    assert.equal(legacyCalls,1);
    assert.equal(suppressionRemoved,true,'temporary suppression must be removed after the legacy screen shell renders');
    assert.equal(suppressionActive,false);
    assert.equal(cloneCalls,0,'canonical canvas must not be replaced just to stop the legacy renderer');
    assert.equal(canvas.dataset.flowArchitecture,'unified-particle-matter');
    assert.equal(canvas.dataset.flowRenderer,'particle2d');
  }finally{
    globalThis.renderHome=previous.renderHome;
    globalThis.document=previous.document;
    globalThis.matchMedia=previous.matchMedia;
    globalThis.requestAnimationFrame=previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame=previous.cancelAnimationFrame;
    globalThis.devicePixelRatio=previous.devicePixelRatio;
    delete globalThis.ARISE_PARTICLE_MATTER;
    delete globalThis.__ARISE_UNIFIED_PARTICLE_FLOW_INSTALLED__;
  }
});
