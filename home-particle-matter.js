(function(root){
  "use strict";

  const TAU=Math.PI*2;
  const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smoothstep=(a,b,value)=>{
    const t=clamp((value-a)/(b-a));
    return t*t*(3-2*t);
  };

  function hash(value){
    const x=Math.sin(value*127.1+311.7)*43758.5453123;
    return x-Math.floor(x);
  }

  function createParticlePopulation(count){
    return Array.from({length:count},(_,index)=>{
      const seed=hash(index+1);
      const lane=hash(index+19.17)*2-1;
      const depth=hash(index+53.41);
      const toneSeed=hash(index+91.73);
      return {
        id:index,
        phase:hash(index+7.31),
        lane,
        depth,
        seed,
        tone:toneSeed<0.18?"cool":toneSeed>0.76?"warm":"pale",
        speed:mix(0.028,0.049,hash(index+131.9)),
        radius:mix(0.50,1.32,depth)
      };
    });
  }

  function toneColor(tone,alpha){
    if(tone==="cool")return `rgba(151,190,193,${alpha})`;
    if(tone==="warm")return `rgba(224,188,111,${alpha})`;
    return `rgba(229,224,209,${alpha})`;
  }

  function sampleParticle(particle,time){
    const progress=(particle.phase+time*particle.speed)%1;
    const cloud=smoothstep(0.24,0.43,progress)*(1-smoothstep(0.60,0.76,progress));
    const grain=smoothstep(0.12,0.28,progress)*(1-smoothstep(0.68,0.82,progress));
    const reconverge=smoothstep(0.56,0.76,progress);
    const reservoir=smoothstep(0.76,0.98,progress);
    const topWidth=mix(0.055,0.086,smoothstep(0.02,0.20,progress));
    const cloudWidth=mix(topWidth,0.285,cloud);
    const streamWidth=mix(cloudWidth,0.092,reconverge);
    const width=mix(streamWidth,0.31,reservoir);
    const travellingNoise=Math.sin((progress*8.7+particle.seed*4.9+time*0.14)*TAU);
    const secondaryNoise=Math.sin((progress*4.1+particle.depth*2.3-time*0.09)*TAU);
    const weave=Math.sin((progress*5.4+particle.seed*2.8+time*0.07)*TAU)*(1-cloud)*0.012;
    const center=0.5+travellingNoise*0.016+secondaryNoise*0.009+weave;
    const cloudDrift=cloud*Math.sin((particle.seed*3.2+progress*1.7+time*0.05)*TAU)*0.08;
    let x=center+particle.lane*width+cloudDrift;
    let y=-0.035+progress*1.055;
    if(reservoir>0){
      const angle=(particle.seed*TAU)+(progress*8.0)+(time*0.05);
      x+=Math.cos(angle)*0.035*reservoir*(0.4+particle.depth*0.6);
      y-=Math.abs(Math.sin(angle))*0.020*reservoir;
    }
    const dense=1-cloud*0.80;
    const radius=particle.radius*mix(1.52,0.62,cloud)*mix(1,1.18,reservoir);
    const haloRadius=radius*mix(2.15,1.35,cloud);
    const alpha=mix(0.20,0.58,dense)*mix(0.72,1,particle.depth)*(0.86+grain*0.14);
    const haloAlpha=alpha*mix(0.26,0.08,cloud);
    return {x,y,progress,cloud,grain,reconverge,reservoir,dense,radius,haloRadius,alpha,haloAlpha};
  }

  function sizeCanvas(canvas){
    const ratio=Math.min(1.35,Math.max(1,Number(root.devicePixelRatio)||1));
    const width=Math.max(1,Math.round(canvas.clientWidth*ratio));
    const height=Math.max(1,Math.round(canvas.clientHeight*ratio));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    return {width,height,ratio};
  }

  function drawParticle(context,particle,state,width,height,ratio){
    const x=state.x*width;
    const y=state.y*height;
    const haloRadius=Math.max(0.65,state.haloRadius*ratio);
    const coreRadius=Math.max(0.42,state.radius*ratio);
    if(state.haloAlpha>0.012){
      context.beginPath();
      context.arc(x,y,haloRadius,0,TAU);
      context.fillStyle=toneColor(particle.tone,state.haloAlpha);
      context.fill();
    }
    context.beginPath();
    context.arc(x,y,coreRadius,0,TAU);
    context.fillStyle=toneColor(particle.tone,state.alpha);
    context.fill();
  }

  function drawPopulation(context,canvas,population,time){
    const {width,height,ratio}=sizeCanvas(canvas);
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,width,height);
    context.globalCompositeOperation="lighter";
    for(const particle of population){
      const state=sampleParticle(particle,time);
      if(state.y<-0.03||state.y>1.03||state.x<-0.08||state.x>1.08)continue;
      drawParticle(context,particle,state,width,height,ratio);
    }
    context.globalCompositeOperation="source-over";
  }

  function startUnifiedParticleMatter(canvas){
    if(!canvas)return null;
    canvas.style.background="none";
    canvas.dataset.flowArchitecture="unified-particle-matter";
    const context=canvas.getContext&&canvas.getContext("2d",{alpha:true});
    if(!context){
      canvas.dataset.flowRenderer="static";
      canvas.dataset.flowMotion="unsupported";
      return {stop(){}};
    }
    const reducedMotion=Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    const compact=(canvas.clientWidth||0)<520;
    const population=createParticlePopulation(compact?1280:2200);
    canvas.dataset.flowPopulation=String(population.length);
    canvas.dataset.flowRenderer="particle2d";
    canvas.dataset.flowPopulationOwner="home-particle-matter";
    canvas.classList.add("is-running");
    let stopped=false;
    let handle=0;
    let frames=0;
    let elapsed=0;
    let previous=root.performance?.now?.()||Date.now();
    const draw=stamp=>{
      if(stopped||!canvas.isConnected)return;
      const now=Number(stamp)||previous;
      if(frames>0)elapsed+=Math.min(1/30,Math.max(0,(now-previous)/1000));
      previous=now;
      drawPopulation(context,canvas,population,reducedMotion?0.43:elapsed);
      frames+=1;
      canvas.dataset.flowFrames=String(frames);
      canvas.dataset.flowTime=(reducedMotion?0.43:elapsed).toFixed(3);
      canvas.dataset.flowMotion=reducedMotion?"reduced":"active";
      if(!reducedMotion)handle=root.requestAnimationFrame(draw);
    };
    draw(previous);
    return {
      population,
      stop(){
        stopped=true;
        if(handle)root.cancelAnimationFrame(handle);
      }
    };
  }

  function installUnifiedHomeFlow(){
    if(root.__ARISE_UNIFIED_PARTICLE_FLOW_INSTALLED__)return;
    if(typeof root.renderHome!=="function")return;
    const legacyRenderHome=root.renderHome;
    root.renderHome=function(){
      legacyRenderHome.apply(this,arguments);
      const oldCanvas=root.document?.querySelector?.(".arise-flow-canvas");
      if(!oldCanvas)return;
      const canvas=oldCanvas.cloneNode(false);
      canvas.removeAttribute("data-flow-renderer");
      canvas.removeAttribute("data-flow-frames");
      canvas.removeAttribute("data-flow-time");
      oldCanvas.replaceWith(canvas);
      startUnifiedParticleMatter(canvas);
    };
    root.__ARISE_UNIFIED_PARTICLE_FLOW_INSTALLED__=true;
  }

  root.ARISE_PARTICLE_MATTER={
    createParticlePopulation,
    sampleParticle,
    drawPopulation,
    startUnifiedParticleMatter,
    installUnifiedHomeFlow
  };
  installUnifiedHomeFlow();
})(typeof globalThis!=="undefined"?globalThis:window);