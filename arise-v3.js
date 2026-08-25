(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const safeAmount=value=>Math.max(0,Math.round(Number(value)||0));
  const sum=values=>values.reduce((total,value)=>total+safeAmount(value),0);
  const pct=(value,total)=>total>0?Math.round(safeAmount(value)/safeAmount(total)*100):0;
  const currentProfile=()=>activeProfile();

  function groupMonth(profile,month){
    const raw=core.monthStats(profile,month);
    const byId=new Map((profile.categories||[]).map(item=>[String(item.id),item]));
    let fixed=0;
    let categories=0;
    for(const [id,value] of Object.entries(raw.categoryAllocated||{})){
      const category=byId.get(String(id));
      if(category&&category.type==="fixed") fixed+=safeAmount(value);
      else categories+=safeAmount(value);
    }
    return {income:safeAmount(raw.income),expenses:safeAmount(raw.expenses),fixed,categories,reserve:safeAmount(raw.reserve),goals:sum(Object.values(raw.goalAllocated||{})),unallocated:safeAmount(raw.free),uncontrolled:safeAmount(raw.uncontrolled)};
  }

  function flowIcon(kind){
    const paths={
      fixed:'<path d="M4 10.5 12 4l8 6.5v8.2a1.3 1.3 0 0 1-1.3 1.3h-4.2v-5.8h-5V20H5.3A1.3 1.3 0 0 1 4 18.7z"/>',
      categories:'<circle cx="7" cy="7" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="17" cy="7" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="17" cy="12" r="1"/><circle cx="7" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="17" cy="17" r="1"/>',
      reserve:'<path d="M12 3.5 19 6v5.4c0 4.4-2.7 7.5-7 9.1-4.3-1.6-7-4.7-7-9.1V6z"/>',
      goals:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.3"/><path d="m14.8 9.2 5.1-5.1M16.2 4.1h3.7v3.7"/>'
    };
    return `<span class="node-orbit" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${paths[kind]||paths.categories}</svg></span>`;
  }

  function node({side,kind,name,amount,total,color,page,delay=0}){
    return `<button class="arise-flow-node ${side} ${kind}" style="--node-color:${color};--node-delay:${delay}ms" data-v3-page="${page}">${flowIcon(kind)}<span class="node-copy"><span class="node-name">${escapeHTML(name)}</span><strong>${money(amount)}</strong><small>${pct(amount,total)}%</small></span></button>`;
  }

  function flowParticle(path,duration,begin,tone="warm",radius=1.7){
    return `<circle class="arise-flow-particle ${tone}" r="${radius}"><animateMotion dur="${duration}s" begin="${begin}s" repeatCount="indefinite" rotate="auto"><mpath href="#${path}"/></animateMotion></circle>`;
  }

  const HOME_FLOW_BODY_SHEETS=56;
  const HOME_FLOW_BODY_FILAMENTS=64;
  const HOME_FLOW_LANDING_STREAMS=32;
  const HOME_FLOW_POOL_RINGS=28;
  const HOME_FLOW_POOL_SPIRALS=44;
  const HOME_FLOW_BODY_PARTICLES=5200;
  const HOME_FLOW_LANDING_PARTICLES=800;
  const HOME_FLOW_POOL_PARTICLES=2000;

  function createHomeFlowRandom(seed=0x41a1f10){
    let state=seed>>>0;
    return ()=>{
      state=(Math.imul(state,1664525)+1013904223)>>>0;
      return state/4294967296;
    };
  }

  const homeFlowRibbonVertexShader=[
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "attribute vec4 aFlow;",
    "attribute vec4 aStyle;",
    "uniform float uTime;",
    "uniform float uCanvasAspect;",
    "uniform float uWidthScale;",
    "varying float vEdge;",
    "varying float vProgress;",
    "varying float vSeed;",
    "varying float vTone;",
    "varying float vAlpha;",
    "varying float vKind;",
    "varying float vWidth;",
    "varying float vDepth;",
    "varying float vLane;",
    "const float PI=3.14159265359;",
    "const float TAU=6.28318530718;",
    "float flowBell(float value,float center,float width){",
    "  float weight=clamp(1.0-abs(value-center)/(width*1.65),0.0,1.0);",
    "  return weight*weight*(3.0-2.0*weight);",
    "}",
    "vec3 bodyPosition(float progress,float lane,float depth,float seed){",
    "  float t=clamp(progress,0.0,1.0);",
    "  float family=floor(seed*5.0);",
    "  float familyPhase=family*(TAU/5.0);",
    "  float sourceGate=smoothstep(0.0,0.082,t);",
    "  float landingGate=1.0-0.76*smoothstep(0.865,1.0,t);",
    "  float shoulder=flowBell(t,0.245,0.205)*0.125;",
    "  float middle=flowBell(t,0.49,0.275)*0.184;",
    "  float lower=flowBell(t,0.72,0.225)*0.178;",
    "  float envelope=(shoulder+middle+lower)*sourceGate*landingGate+0.0038;",
    "  float centerline=(-flowBell(t,0.22,0.16)*0.018+flowBell(t,0.49,0.21)*0.027-flowBell(t,0.73,0.17)*0.018)*sin(PI*t);",
    "  centerline+=(sin(t*3.7-uTime*0.13)+0.34*sin(t*7.2+uTime*0.08+1.7))*0.0065*sin(PI*t);",
    "  float laneAbs=abs(lane);",
    "  float side=sign(lane+0.0001);",
    "  float phase=t*(6.05+family*0.16)+lane*1.34+familyPhase*0.22-uTime*(0.22+family*0.012+seed*0.035);",
    "  float fold=sin(phase)+0.36*sin(phase*1.87+familyPhase*0.42+depth*0.7);",
    "  float sideGain=side<0.0?0.88+0.25*flowBell(t,0.60,0.30):0.86+0.20*flowBell(t,0.43,0.22)+0.20*flowBell(t,0.74,0.19);",
    "  float crossX=lane*envelope*(0.61+0.35*laneAbs)*sideGain;",
    "  crossX+=envelope*fold*(0.14+0.18*laneAbs);",
    "  crossX+=envelope*(0.07+0.12*(1.0-laneAbs))*sin(t*PI*2.2+familyPhase*0.72-uTime*0.30)*sin(PI*t);",
    "  crossX+=side*flowBell(t,0.34,0.19)*envelope*0.085*sin(familyPhase*0.52+1.1);",
    "  crossX+=flowBell(t,0.69,0.22)*envelope*(0.08+0.12*laneAbs)*sin(t*7.0+familyPhase*0.31-uTime*0.18+lane);",
    "  crossX+=depth*envelope*0.055*sin(t*5.3+familyPhase*0.18+1.4);",
    "  float crossZ=depth*envelope*0.42+envelope*(0.055+0.085*laneAbs)*sin(phase*0.83+depth*1.7);",
    "  float x=0.5+centerline+crossX+crossZ*0.032;",
    "  float verticalFold=sin(t*5.45+familyPhase*0.26+lane*1.8-uTime*0.15)+0.32*sin(t*10.1+seed*8.0+uTime*0.09);",
    "  float y=0.026+t*0.838+verticalFold*envelope*(0.018+0.026*laneAbs);",
    "  float z=crossZ;",
    "  return vec3(x,y,z);",
    "}",
    "vec3 landingPosition(float progress,float reachSeed,float depth,float seed){",
    "  float t=clamp(progress,0.0,1.0);",
    "  float entry=0.69+fract(seed*6.73)*0.18;",
    "  float entryLane=cos(seed*TAU)*(0.08+reachSeed*0.82);",
    "  vec3 start=bodyPosition(entry,entryLane,depth*0.72,seed);",
    "  float angle=seed*TAU+(seed-0.5)*0.72+t*(0.72+reachSeed*0.92)-uTime*(0.052+depth*0.012);",
    "  float radius=0.028+reachSeed*0.425;",
    "  float endX=0.5+cos(angle)*radius;",
    "  float endY=0.906+sin(angle)*radius*0.118;",
    "  float ease=smoothstep(0.0,1.0,t);",
    "  float x=mix(start.x,endX,ease)+sin(PI*t)*sin(seed*19.0+uTime*0.17)*0.014;",
    "  float y=mix(start.y,endY,ease)+sin(PI*t)*(0.018+reachSeed*0.016);",
    "  float endZ=depth*0.029+sin(angle*2.0+seed*5.0)*0.007;",
    "  float z=mix(start.z,endZ,ease);",
    "  x+=z*0.038;",
    "  return vec3(x,y,z);",
    "}",
    "vec3 poolPosition(float progress,float radiusSeed,float depth,float seed,float kind){",
    "  float angularSpeed=0.032+0.019*(depth*0.5+0.5);",
    "  float angle;",
    "  float radius;",
    "  if(kind<1.5){",
    "    angle=progress*TAU+seed*0.38+uTime*angularSpeed*sign(depth+0.0001);",
    "    radius=0.024+radiusSeed*0.455;",
    "  }else{",
    "    angle=progress*TAU*(1.35+seed*0.92)+seed*TAU-uTime*(angularSpeed+0.017);",
    "    radius=0.016+pow(progress,0.82)*radiusSeed*0.455;",
    "  }",
    "  radius+=sin(angle*3.0-uTime*0.38+seed*11.0)*0.0062*(0.25+radiusSeed*0.75);",
    "  radius+=sin(angle*2.0+uTime*0.14+seed*7.0)*0.0085*radiusSeed;",
    "  float x=0.5+cos(angle)*radius;",
    "  float y=0.906+sin(angle)*radius*0.118+sin(angle*5.0+uTime*0.25+seed*6.0)*0.0015;",
    "  float z=depth*0.024+sin(angle*2.0+seed*4.0)*0.006;",
    "  x+=z*0.038;",
    "  return vec3(x,y,z);",
    "}",
    "vec3 flowPosition(float progress){",
    "  if(aStyle.w<0.5)return bodyPosition(progress,aFlow.z,aStyle.x,aFlow.w);",
    "  if(aStyle.w<2.5)return poolPosition(progress,aFlow.z,aStyle.x,aFlow.w,aStyle.w);",
    "  return landingPosition(progress,aFlow.z,aStyle.x,aFlow.w);",
    "}",
    "void main(){",
    "  float progress=aFlow.x;",
    "  vec3 center=flowPosition(progress);",
    "  vec2 normal;",
    "  if(aStyle.w<0.5&&aStyle.y<0.006){",
    "    normal=vec2(1.0,0.0);",
    "  }else if(aStyle.w<2.5){",
    "    vec2 radialPx=normalize(vec2((center.x-0.5)*uCanvasAspect,center.y-0.906)+vec2(0.00001));",
    "    normal=vec2(radialPx.x/uCanvasAspect,radialPx.y);",
    "  }else{",
    "    vec3 before=flowPosition(max(0.0,progress-0.0025));",
    "    vec3 after=flowPosition(min(1.0,progress+0.0025));",
    "    vec2 tangentPx=normalize(vec2((after.x-before.x)*uCanvasAspect,after.y-before.y)+vec2(0.00001));",
    "    normal=vec2(-tangentPx.y/uCanvasAspect,tangentPx.x);",
    "  }",
    "  float widthProfile=1.0;",
    "  if(aStyle.w<0.5){",
    "    float sourceTaper=0.16+0.84*smoothstep(0.0,0.12,progress);",
    "    float lowerTaper=1.0-0.58*smoothstep(0.84,1.0,progress);",
    "    float foldBreath=0.88+0.12*sin(progress*8.4-uTime*(0.18+aFlow.w*0.08)+aFlow.w*17.0);",
    "    widthProfile=sourceTaper*lowerTaper*foldBreath;",
    "  }else if(aStyle.w<2.5){",
    "    widthProfile=0.82+0.18*sin(progress*TAU*2.0-uTime*0.16+aFlow.w*19.0);",
    "  }else{",
    "    widthProfile=(0.28+0.72*smoothstep(0.0,0.13,progress))*(1.0-0.24*smoothstep(0.9,1.0,progress));",
    "  }",
    "  float perspective=clamp(1.0+center.z*1.8,0.72,1.24);",
    "  center.xy+=normal*aFlow.y*aStyle.y*uWidthScale*perspective*widthProfile;",
    "  gl_Position=vec4(center.x*2.0-1.0,1.0-center.y*2.0,center.z,1.0);",
    "  vEdge=aFlow.y;",
    "  vProgress=progress;",
    "  vSeed=aFlow.w;",
    "  vTone=clamp(smoothstep(0.385,0.615,center.x+sin(aFlow.w*31.0+aStyle.x*3.0)*0.021)+(aFlow.w-0.5)*0.08,0.0,1.0);",
    "  vAlpha=aStyle.z;",
    "  vKind=aStyle.w;",
    "  vWidth=aStyle.y;",
    "  vDepth=center.z;",
    "  vLane=aFlow.z;",
    "}"
  ].join("\n");

  const homeFlowRibbonFragmentShader=[
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform float uTime;",
    "uniform float uOpacity;",
    "uniform float uMaterialPass;",
    "varying float vEdge;",
    "varying float vProgress;",
    "varying float vSeed;",
    "varying float vTone;",
    "varying float vAlpha;",
    "varying float vKind;",
    "varying float vWidth;",
    "varying float vDepth;",
    "varying float vLane;",
    "void main(){",
    "  float absEdge=abs(vEdge);",
    "  float interior=1.0-smoothstep(0.68,1.0,absEdge);",
    "  float rim=smoothstep(0.46,0.74,absEdge)*(1.0-smoothstep(0.84,1.0,absEdge));",
    "  float filament=pow(max(0.0,1.0-absEdge),1.45);",
    "  float bodyPacket=0.54+0.46*pow(0.5+0.5*sin(vProgress*(74.0+vSeed*38.0)-uTime*(1.55+vSeed*1.35+abs(vDepth)*0.32)+vSeed*31.0),5.0);",
    "  float poolPacket=0.61+0.39*pow(0.5+0.5*sin(vProgress*(56.0+vSeed*29.0)-uTime*(0.82+vSeed*0.68)+vSeed*27.0),5.0);",
    "  float landingPacket=0.58+0.42*pow(0.5+0.5*sin(vProgress*(65.0+vSeed*22.0)-uTime*(1.12+vSeed*0.54)+vSeed*21.0),4.0);",
    "  float packet=vKind<0.5?bodyPacket:(vKind<2.5?poolPacket:landingPacket);",
    "  float micro=0.88+0.12*sin(vProgress*(132.0+vSeed*57.0)-uTime*(1.42+vSeed*0.86)+vSeed*53.0);",
    "  float bodyStart=0.002+fract(vSeed*17.31)*0.020;",
    "  float bodyEnd=0.965+fract(vSeed*31.73)*0.032;",
    "  float bodyLife=smoothstep(bodyStart,bodyStart+0.024,vProgress)*(1.0-smoothstep(bodyEnd-0.028,bodyEnd,vProgress));",
    "  float landingLife=smoothstep(0.0,0.055,vProgress)*(1.0-smoothstep(0.94,1.0,vProgress));",
    "  float spiralLife=smoothstep(0.0,0.035,vProgress)*(1.0-smoothstep(0.94,1.0,vProgress));",
    "  float poolLife=vKind<1.5?1.0:spiralLife;",
    "  float life=vKind<0.5?bodyLife:(vKind>2.5?landingLife:poolLife);",
    "  vec3 cool=vec3(0.46,0.78,0.86);",
    "  vec3 neutral=vec3(0.94,0.92,0.84);",
    "  vec3 warm=vec3(1.0,0.75,0.35);",
    "  vec3 color=vTone<0.5?mix(neutral,cool,min(1.0,(0.5-vTone)*2.15)):mix(neutral,warm,min(1.0,(vTone-0.5)*2.15));",
    "  color*=mix(1.0,1.13,vTone);",
    "  float depthLight=clamp(0.76+vDepth*1.70,0.55,1.12);",
    "  float coreRelief=mix(mix(1.16,0.84,smoothstep(0.04,0.78,abs(vLane))),1.0,step(0.5,vKind));",
    "  float regionGain=vKind<0.5?1.12:(vKind<2.5?1.58:1.30);",
    "  float alpha;",
    "  if(uMaterialPass<0.5){",
    "    float surfacePulse=0.83+0.17*sin(vProgress*(14.0+vSeed*4.0)-uTime*(0.68+vSeed*0.16)+vSeed*17.0);",
    "    float surfaceCore=vKind<0.5?mix(1.46,1.0,smoothstep(0.02,0.32,abs(vLane))):1.0;",
    "    alpha=vAlpha*(0.39+interior*1.08)*surfacePulse*surfaceCore*depthLight*coreRelief*life*regionGain*uOpacity;",
    "    color*=0.84+0.25*interior;",
    "  }else if(uMaterialPass<1.5){",
    "    float caustic=0.70+0.30*pow(0.5+0.5*sin(vProgress*(33.0+vSeed*13.0)-uTime*(0.64+vSeed*0.24)+vSeed*29.0),3.0);",
    "    float rimRegion=vKind<0.5?1.0:(vKind<2.5?0.76:0.54);",
    "    float bandCenter=sin(vProgress*(5.2+vSeed*2.6)-uTime*(0.78+vSeed*0.18)+vSeed*19.0)*0.38;",
    "    float foldBand=1.0-smoothstep(0.045,0.17,abs(vEdge-bandCenter));",
    "    alpha=vAlpha*(rim*1.05*rimRegion+foldBand*0.28+interior*0.10)*caustic*depthLight*coreRelief*life*regionGain*uOpacity;",
    "    color*=1.12+rim*0.28;",
    "  }else if(uMaterialPass<2.5){",
    "    alpha=vAlpha*filament*packet*micro*depthLight*coreRelief*life*regionGain*uOpacity;",
    "    color*=0.83+packet*0.28;",
    "  }else{",
    "    float halo=pow(max(0.0,1.0-absEdge),0.72);",
    "    alpha=vAlpha*halo*(0.42+0.18*packet)*depthLight*coreRelief*life*regionGain*uOpacity;",
    "    color*=0.62+0.16*packet;",
    "  }",
    "  gl_FragColor=vec4(color,alpha);",
    "}"
  ].join("\n");

  const homeFlowParticleVertexShader=[
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "attribute vec4 aParticle;",
    "attribute vec4 aParticleStyle;",
    "uniform float uTime;",
    "uniform float uPixelRatio;",
    "varying float vTone;",
    "varying float vAlpha;",
    "varying float vSource;",
    "const float PI=3.14159265359;",
    "const float TAU=6.28318530718;",
    "float flowBell(float value,float center,float width){",
    "  float weight=clamp(1.0-abs(value-center)/(width*1.65),0.0,1.0);",
    "  return weight*weight*(3.0-2.0*weight);",
    "}",
    "vec3 bodyPosition(float progress,float lane,float depth,float seed){",
    "  float t=clamp(progress,0.0,1.0);",
    "  float family=floor(seed*5.0);",
    "  float familyPhase=family*(TAU/5.0);",
    "  float sourceGate=smoothstep(0.0,0.082,t);",
    "  float landingGate=1.0-0.76*smoothstep(0.865,1.0,t);",
    "  float shoulder=flowBell(t,0.245,0.205)*0.125;",
    "  float middle=flowBell(t,0.49,0.275)*0.184;",
    "  float lower=flowBell(t,0.72,0.225)*0.178;",
    "  float envelope=(shoulder+middle+lower)*sourceGate*landingGate+0.0038;",
    "  float centerline=(-flowBell(t,0.22,0.16)*0.018+flowBell(t,0.49,0.21)*0.027-flowBell(t,0.73,0.17)*0.018)*sin(PI*t);",
    "  centerline+=(sin(t*3.7-uTime*0.13)+0.34*sin(t*7.2+uTime*0.08+1.7))*0.0065*sin(PI*t);",
    "  float laneAbs=abs(lane);",
    "  float side=sign(lane+0.0001);",
    "  float phase=t*(6.05+family*0.16)+lane*1.34+familyPhase*0.22-uTime*(0.22+family*0.012+seed*0.035);",
    "  float fold=sin(phase)+0.36*sin(phase*1.87+familyPhase*0.42+depth*0.7);",
    "  float sideGain=side<0.0?0.88+0.25*flowBell(t,0.60,0.30):0.86+0.20*flowBell(t,0.43,0.22)+0.20*flowBell(t,0.74,0.19);",
    "  float crossX=lane*envelope*(0.61+0.35*laneAbs)*sideGain;",
    "  crossX+=envelope*fold*(0.14+0.18*laneAbs);",
    "  crossX+=envelope*(0.07+0.12*(1.0-laneAbs))*sin(t*PI*2.2+familyPhase*0.72-uTime*0.30)*sin(PI*t);",
    "  crossX+=side*flowBell(t,0.34,0.19)*envelope*0.085*sin(familyPhase*0.52+1.1);",
    "  crossX+=flowBell(t,0.69,0.22)*envelope*(0.08+0.12*laneAbs)*sin(t*7.0+familyPhase*0.31-uTime*0.18+lane);",
    "  crossX+=depth*envelope*0.055*sin(t*5.3+familyPhase*0.18+1.4);",
    "  float crossZ=depth*envelope*0.42+envelope*(0.055+0.085*laneAbs)*sin(phase*0.83+depth*1.7);",
    "  float x=0.5+centerline+crossX+crossZ*0.032;",
    "  float verticalFold=sin(t*5.45+familyPhase*0.26+lane*1.8-uTime*0.15)+0.32*sin(t*10.1+seed*8.0+uTime*0.09);",
    "  float y=0.026+t*0.838+verticalFold*envelope*(0.018+0.026*laneAbs);",
    "  float z=crossZ;",
    "  return vec3(x,y,z);",
    "}",
    "vec3 landingPosition(float progress,float reachSeed,float depth,float seed){",
    "  float t=clamp(progress,0.0,1.0);",
    "  float entry=0.69+fract(seed*6.73)*0.18;",
    "  float entryLane=cos(seed*TAU)*(0.08+reachSeed*0.82);",
    "  vec3 start=bodyPosition(entry,entryLane,depth*0.72,seed);",
    "  float angle=seed*TAU+(seed-0.5)*0.72+t*(0.72+reachSeed*0.92)-uTime*(0.052+depth*0.012);",
    "  float radius=0.028+reachSeed*0.425;",
    "  float endX=0.5+cos(angle)*radius;",
    "  float endY=0.906+sin(angle)*radius*0.118;",
    "  float ease=smoothstep(0.0,1.0,t);",
    "  float x=mix(start.x,endX,ease)+sin(PI*t)*sin(seed*19.0+uTime*0.17)*0.014;",
    "  float y=mix(start.y,endY,ease)+sin(PI*t)*(0.018+reachSeed*0.016);",
    "  float endZ=depth*0.029+sin(angle*2.0+seed*5.0)*0.007;",
    "  float z=mix(start.z,endZ,ease);",
    "  x+=z*0.038;",
    "  return vec3(x,y,z);",
    "}",
    "void main(){",
    "  float kind=aParticleStyle.z;",
    "  vec3 position;",
    "  if(kind<0.5){",
    "    float progress=fract(aParticle.x+uTime*(0.019+aParticle.w*0.031+abs(aParticle.z)*0.004));",
    "    position=bodyPosition(progress,aParticle.y,aParticle.z,aParticle.w);",
    "  }else if(kind<1.5){",
    "    position=vec3(0.5,0.026,0.08);",
    "  }else if(kind<2.5){",
    "    float angle=aParticle.x*TAU+aParticle.w*TAU+uTime*(0.046+aParticle.w*0.051);",
    "    float radius=0.024+aParticle.y*0.455;",
    "    radius+=sin(angle*3.0-uTime*0.38+aParticle.w*11.0)*0.0062*(0.25+aParticle.y*0.75);",
    "    radius+=sin(angle*2.0+uTime*0.14+aParticle.w*7.0)*0.0085*aParticle.y;",
    "    position=vec3(0.5+cos(angle)*radius,0.906+sin(angle)*radius*0.118,aParticle.z*0.022);",
    "  }else if(kind<3.5){",
    "    float progress=fract(aParticle.x+uTime*(0.025+aParticle.w*0.026));",
    "    position=landingPosition(progress,aParticle.y,aParticle.z,aParticle.w);",
    "  }else{",
    "    position=vec3(0.5+sin(uTime*0.17)*0.006,0.878+sin(uTime*0.13+1.4)*0.002,0.07);",
    "  }",
    "  gl_Position=vec4(position.x*2.0-1.0,1.0-position.y*2.0,position.z,1.0);",
    "  gl_PointSize=aParticleStyle.x*uPixelRatio*(kind>0.5&&kind<1.5?1.0:clamp(1.0+position.z*4.0,0.72,1.32));",
    "  vTone=clamp(smoothstep(0.385,0.615,position.x+sin(aParticle.w*31.0+aParticle.z*3.0)*0.021)+(aParticle.w-0.5)*0.08,0.0,1.0);",
    "  vAlpha=aParticleStyle.y;",
    "  vSource=kind>3.5?2.0:step(0.5,kind)*(1.0-step(1.5,kind));",
    "}"
  ].join("\n");

  const homeFlowParticleFragmentShader=[
    "precision mediump float;",
    "varying float vTone;",
    "varying float vAlpha;",
    "varying float vSource;",
    "void main(){",
    "  float radius=length(gl_PointCoord-0.5);",
    "  float soft=1.0-smoothstep(0.08,0.5,radius);",
    "  vec3 cool=vec3(0.28,0.73,0.80);",
    "  vec3 neutral=vec3(0.78,0.82,0.77);",
    "  vec3 warm=vec3(1.0,0.69,0.25);",
    "  vec3 color=vTone<0.5?mix(neutral,cool,(0.5-vTone)*2.0):mix(neutral,warm,(vTone-0.5)*2.0);",
    "  if(vSource>0.5){",
    "    float core=1.0-smoothstep(vSource>1.5?0.0:0.08,vSource>1.5?0.16:0.25,radius);",
    "    color=vSource>1.5?mix(vec3(0.48,0.69,0.68),vec3(0.96,0.78,0.45),0.5+0.5*gl_PointCoord.x):mix(vec3(0.94,0.61,0.22),vec3(0.96,0.94,0.86),core);",
    "    soft=max(pow(soft,vSource>1.5?1.65:0.82),core);",
    "  }",
    "  gl_FragColor=vec4(color,vAlpha*soft);",
    "}"
  ].join("\n");

  function compileHomeFlowShader(gl,type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(gl.getShaderParameter(shader,gl.COMPILE_STATUS))return shader;
    const message=gl.getShaderInfoLog(shader)||"ARISE flow shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  function createHomeFlowProgram(gl,vertexSource,fragmentSource){
    const vertex=compileHomeFlowShader(gl,gl.VERTEX_SHADER,vertexSource);
    const fragment=compileHomeFlowShader(gl,gl.FRAGMENT_SHADER,fragmentSource);
    const program=gl.createProgram();
    gl.attachShader(program,vertex);
    gl.attachShader(program,fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if(gl.getProgramParameter(program,gl.LINK_STATUS))return program;
    const message=gl.getProgramInfoLog(program)||"ARISE flow shader link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  function appendHomeFlowRibbon(target,segments,lane,seed,depth,width,alpha,kind){
    const vertex=(progress,edge)=>[progress,edge,lane,seed,depth,width,alpha,kind];
    for(let segment=0;segment<segments-1;segment+=1){
      const start=segment/(segments-1);
      const end=(segment+1)/(segments-1);
      target.push(...vertex(start,-1),...vertex(start,1),...vertex(end,-1),...vertex(end,-1),...vertex(start,1),...vertex(end,1));
    }
  }

  function createHomeFlowRibbonGeometry(){
    const random=createHomeFlowRandom();
    const veils=[];
    const details=[];
    let veilRibbons=0;
    let detailRibbons=0;
    const addVeil=(segments,lane,seed,depth,width,alpha,kind)=>{
      appendHomeFlowRibbon(veils,segments,lane,seed,depth,width,alpha,kind);
      veilRibbons+=1;
    };
    const addDetail=(segments,lane,seed,depth,width,alpha,kind)=>{
      appendHomeFlowRibbon(details,segments,lane,seed,depth,width,alpha,kind);
      detailRibbons+=1;
    };
    for(let index=0;index<HOME_FLOW_BODY_SHEETS;index+=1){
      const hero=index<28;
      const core=index>=28&&index<44;
      const pair=hero?Math.floor(index/2):Math.floor((index-44)/2);
      const side=index%2===0?-1:1;
      const lane=hero?side*(.18+pair/13*.75):(core?((index-28)/15*2-1)*.18:side*(.28+pair/5*.55));
      const inner=core&&Math.abs(lane)<.08;
      const seed=(index*.61803398875+.071)%1;
      const depth=core?Math.sin(index*2.17)*.24:Math.sin(index*2.39996323)*.88;
      const width=hero?.028+(pair%5)*.0048:(inner?.024+((index-28)%3)*.0045:(core?.016+((index-28)%4)*.0038:.020+(pair%4)*.0042));
      const alpha=hero?.15+(pair%3)*.025:(inner?.29+((index-28)%3)*.025:(core?.20+((index-28)%3)*.028:.15+(pair%3)*.022));
      addVeil(62,lane,seed,depth,width,alpha,0);
    }
    for(let index=0;index<HOME_FLOW_BODY_FILAMENTS;index+=1){
      const core=index<20;
      const raw=random()*2-1;
      const lane=core?raw*.18:Math.sign(raw||1)*Math.pow(Math.abs(raw),.73);
      const depth=core?(random()*2-1)*.28:random()*2-1;
      addDetail(58,lane,random(),depth,core?.0009+random()*.0018:.0005+random()*.00125,core?.30+random()*.18:.23+random()*.18,0);
    }
    for(let index=0;index<HOME_FLOW_LANDING_STREAMS;index+=1){
      const core=index<14;
      const broad=!core&&index%6===0;
      const reach=core?.015+index/13*.13:.14+Math.pow(random(),.72)*.86;
      if(core||broad)addVeil(64,reach,random(),core?(random()*2-1)*.42:random()*2-1,core?.008+random()*.008:.016+random()*.018,core?.31+random()*.11:.20+random()*.08,3);
      else addDetail(64,reach,random(),random()*2-1,.0006+random()*.0015,.31+random()*.22,3);
    }
    for(let index=0;index<HOME_FLOW_POOL_RINGS;index+=1){
      const radius=(index+1)/(HOME_FLOW_POOL_RINGS+2);
      const broad=index%4===0;
      if(broad)addVeil(68,radius,random(),random()*2-1,.018+random()*.023,.20+random()*.10,1);
      else addDetail(68,radius,random(),random()*2-1,.00055+random()*.00155,.30+random()*.24,1);
    }
    for(let index=0;index<HOME_FLOW_POOL_SPIRALS;index+=1){
      const broad=index%4===0;
      if(broad)addVeil(76,.42+random()*.58,random(),random()*2-1,.018+random()*.024,.20+random()*.10,2);
      else addDetail(76,.42+random()*.58,random(),random()*2-1,.00055+random()*.00155,.29+random()*.24,2);
    }
    return {veilData:new Float32Array(veils),detailData:new Float32Array(details),veilRibbons,detailRibbons};
  }

  function createHomeFlowParticleGeometry(){
    const random=createHomeFlowRandom(0x9e3779b9);
    const particles=[];
    for(let index=0;index<HOME_FLOW_BODY_PARTICLES;index+=1){
      const raw=random()*2-1;
      const lane=Math.sign(raw||1)*Math.pow(Math.abs(raw),.73);
      const sparkle=random()>.925;
      particles.push(random(),lane,random()*2-1,random(),sparkle?1.25+random()*1.25:.50+random()*.72,sparkle?.18+random()*.18:.035+random()*.075,0,0);
    }
    for(let index=0;index<HOME_FLOW_LANDING_PARTICLES;index+=1){
      const core=index<160;
      const sparkle=random()>.91;
      particles.push(random(),core?random()*.18:.10+Math.pow(random(),.72)*.90,random()*2-1,random(),sparkle?1.25+random()*1.2:.52+random()*.72,sparkle?.19+random()*.18:(core?.055+random()*.09:.04+random()*.08),3,0);
    }
    for(let index=0;index<HOME_FLOW_POOL_PARTICLES;index+=1){
      const sparkle=random()>.92;
      particles.push(random(),Math.pow(random(),.62),random()*2-1,random(),sparkle?1.2+random()*1.2:.50+random()*.70,sparkle?.18+random()*.17:.038+random()*.078,2,0);
    }
    particles.push(0,0,0,0,44,.88,1,0);
    particles.push(0,0,0,.5,68,.16,4,0);
    return new Float32Array(particles);
  }

  function sizeHomeFlowCanvas(canvas,maxRatio=1.4){
    const ratio=Math.min(maxRatio,Math.max(1,Number(root.devicePixelRatio)||1));
    const width=Math.max(1,Math.round(canvas.clientWidth*ratio));
    const height=Math.max(1,Math.round(canvas.clientHeight*ratio));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    return {width,height};
  }

  function bindHomeFlowAttributes(gl,program,buffer,firstName,secondName){
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    const stride=8*Float32Array.BYTES_PER_ELEMENT;
    const first=gl.getAttribLocation(program,firstName);
    const second=gl.getAttribLocation(program,secondName);
    gl.enableVertexAttribArray(first);
    gl.enableVertexAttribArray(second);
    gl.vertexAttribPointer(first,4,gl.FLOAT,false,stride,0);
    gl.vertexAttribPointer(second,4,gl.FLOAT,false,stride,4*Float32Array.BYTES_PER_ELEMENT);
  }

  function startProcedural3DHomeFlow(canvas,reducedMotion){
    const gl=canvas.getContext("webgl",{alpha:true,antialias:true,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:"high-performance"})
      ||canvas.getContext("experimental-webgl",{alpha:true,antialias:true,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl)return null;
    const ribbonProgram=createHomeFlowProgram(gl,homeFlowRibbonVertexShader,homeFlowRibbonFragmentShader);
    const particleProgram=createHomeFlowProgram(gl,homeFlowParticleVertexShader,homeFlowParticleFragmentShader);
    const {veilData,detailData,veilRibbons,detailRibbons}=createHomeFlowRibbonGeometry();
    const particleData=createHomeFlowParticleGeometry();
    const veilBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,veilBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,veilData,gl.STATIC_DRAW);
    const detailBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,detailBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,detailData,gl.STATIC_DRAW);
    const particleBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,particleData,gl.STATIC_DRAW);
    const ribbonUniforms={
      time:gl.getUniformLocation(ribbonProgram,"uTime"),
      canvasAspect:gl.getUniformLocation(ribbonProgram,"uCanvasAspect"),
      widthScale:gl.getUniformLocation(ribbonProgram,"uWidthScale"),
      opacity:gl.getUniformLocation(ribbonProgram,"uOpacity"),
      materialPass:gl.getUniformLocation(ribbonProgram,"uMaterialPass")
    };
    const particleUniforms={
      time:gl.getUniformLocation(particleProgram,"uTime"),
      pixelRatio:gl.getUniformLocation(particleProgram,"uPixelRatio")
    };
    gl.clearColor(0,0,0,0);
    const started=root.performance?.now?.()||Date.now();
    let handle=0;
    let frames=0;
    let stopped=false;
    let elapsed=0;
    let previous=started;
    const stop=()=>{
      if(stopped)return;
      stopped=true;
      if(handle)root.cancelAnimationFrame(handle);
      gl.deleteBuffer(veilBuffer);
      gl.deleteBuffer(detailBuffer);
      gl.deleteBuffer(particleBuffer);
      gl.deleteProgram(ribbonProgram);
      gl.deleteProgram(particleProgram);
    };
    const draw=now=>{
      if(stopped)return;
      if(!canvas.isConnected){stop();return;}
      const {width,height}=sizeHomeFlowCanvas(canvas,1.35);
      const stamp=Number(now)||previous;
      if(frames>0)elapsed+=Math.min(1/30,Math.max(0,(stamp-previous)/1000));
      previous=stamp;
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      const time=reducedMotion?2.4:elapsed;
      gl.useProgram(ribbonProgram);
      gl.uniform1f(ribbonUniforms.time,time);
      gl.uniform1f(ribbonUniforms.canvasAspect,width/height);
      bindHomeFlowAttributes(gl,ribbonProgram,veilBuffer,"aFlow","aStyle");
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      gl.uniform1f(ribbonUniforms.materialPass,3);
      gl.uniform1f(ribbonUniforms.widthScale,1.56);
      gl.uniform1f(ribbonUniforms.opacity,.32);
      gl.drawArrays(gl.TRIANGLES,0,veilData.length/8);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(ribbonUniforms.materialPass,0);
      gl.uniform1f(ribbonUniforms.widthScale,1.12);
      gl.uniform1f(ribbonUniforms.opacity,.96);
      gl.drawArrays(gl.TRIANGLES,0,veilData.length/8);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
      gl.uniform1f(ribbonUniforms.materialPass,1);
      gl.uniform1f(ribbonUniforms.widthScale,1.12);
      gl.uniform1f(ribbonUniforms.opacity,.70);
      gl.drawArrays(gl.TRIANGLES,0,veilData.length/8);
      bindHomeFlowAttributes(gl,ribbonProgram,detailBuffer,"aFlow","aStyle");
      gl.uniform1f(ribbonUniforms.materialPass,2);
      gl.uniform1f(ribbonUniforms.widthScale,1);
      gl.uniform1f(ribbonUniforms.opacity,.34);
      gl.drawArrays(gl.TRIANGLES,0,detailData.length/8);
      gl.useProgram(particleProgram);
      bindHomeFlowAttributes(gl,particleProgram,particleBuffer,"aParticle","aParticleStyle");
      gl.uniform1f(particleUniforms.time,time);
      gl.uniform1f(particleUniforms.pixelRatio,Math.min(1.35,Math.max(1,Number(root.devicePixelRatio)||1)));
      gl.drawArrays(gl.POINTS,0,particleData.length/8);
      frames+=1;
      if(frames===1||frames%6===0){
        canvas.dataset.flowFrames=String(frames);
        canvas.dataset.flowTime=elapsed.toFixed(3);
      }
      if(reducedMotion){
        canvas.dataset.flowMotion="reduced";
      }else{
        handle=root.requestAnimationFrame(draw);
      }
    };
    canvas.dataset.flowRenderer="procedural-3d-webgl";
    canvas.dataset.flowRibbons=String(HOME_FLOW_BODY_SHEETS+HOME_FLOW_BODY_FILAMENTS+HOME_FLOW_LANDING_STREAMS+HOME_FLOW_POOL_RINGS+HOME_FLOW_POOL_SPIRALS);
    canvas.dataset.flowVeils=String(veilRibbons);
    canvas.dataset.flowDetails=String(detailRibbons);
    canvas.dataset.flowParticles=String(HOME_FLOW_BODY_PARTICLES+HOME_FLOW_LANDING_PARTICLES+HOME_FLOW_POOL_PARTICLES);
    canvas.classList.add("is-running");
    draw(started);
    return {stop};
  }

  function startHomeFluidFlow(canvas){
    if(!canvas)return null;
    const reducedMotion=Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    let controller=null;
    if(typeof root.WebGLRenderingContext==="function"){
      try{controller=startProcedural3DHomeFlow(canvas,reducedMotion);}catch(error){canvas.dataset.flowError=String(error?.message||error).slice(0,160);}
    }
    if(controller)return controller;
    canvas.dataset.flowRenderer="static";
    canvas.dataset.flowFrames="1";
    canvas.dataset.flowTime="0.000";
    canvas.classList.add("is-static");
    return {stop:()=>controller?.stop()};
  }

  function homeFlowScene(){
    return '<canvas class="arise-flow-canvas" aria-hidden="true"></canvas>';
  }

  function summaryFlowScene(){
    return `<svg class="v3-summary-flow" viewBox="0 0 600 315" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="summaryFlowGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8eed8" stop-opacity=".9"/><stop offset=".62" stop-color="#c9a65f" stop-opacity=".5"/><stop offset="1" stop-color="#8caeb0" stop-opacity=".14"/></linearGradient><filter id="summaryGlow" x="-300%" y="-80%" width="700%" height="260%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path class="v3-summary-aura" d="M24 18 C17 85 33 148 23 218 C18 255 25 279 48 298"/><path id="summaryFlowTrunk" class="v3-summary-trunk" d="M24 18 C17 85 33 148 23 218 C18 255 25 279 48 298"/><path id="summaryFlowOne" class="v3-summary-branch" d="M24 56 C38 56 51 56 72 56"/><path id="summaryFlowTwo" class="v3-summary-branch" d="M24 116 C39 116 52 116 72 116"/><path id="summaryFlowThree" class="v3-summary-branch cool" d="M24 176 C40 176 53 176 72 176"/><path id="summaryFlowFour" class="v3-summary-branch" d="M24 236 C40 236 53 236 72 236"/><g class="v3-summary-particles" filter="url(#summaryGlow)">${flowParticle("summaryFlowTrunk",6.8,-2.3,"ivory",1.8)}${flowParticle("summaryFlowOne",3.8,-1.1,"warm",1.5)}${flowParticle("summaryFlowTwo",4.2,-2.6,"warm",1.5)}${flowParticle("summaryFlowThree",4.1,-.7,"cool",1.5)}${flowParticle("summaryFlowFour",4.5,-3.1,"warm",1.5)}</g><path class="v3-summary-tail-art" d="M48 298 C178 264 361 286 584 244"/></svg>`;
  }

  function bindPageLinks(scope=document){
    scope.querySelectorAll("[data-v3-page]").forEach(button=>{button.onclick=()=>{activePage=button.dataset.v3Page;render();};});
  }

  function categoryRuleMeta(category){
    const priority=safeAmount(category?.priority)||1;
    if(category?.type==="fixed"){
      return `до ${money(category.fixedAmount||0)} в месяц · приоритет ${priority}`;
    }
    const percent=safeAmount(category?.percent);
    const limit=category?.limit!==null&&category?.limit!==""&&typeof category?.limit!=="undefined"?safeAmount(category.limit):null;
    return limit===null
      ? `${percent}% с каждого пополнения · без лимита · приоритет ${priority}`
      : `${percent}% с каждого пополнения · лимит ${money(limit)}/мес. · приоритет ${priority}`;
  }

  function goalPace(profile,goal){
    if(!goal.deadline) return {text:`без срока · приоритет ${safeAmount(goal.priority)||1}`,warning:false};
    const status=core.goalDeadlineStatus(profile,goal,`${activeMonth}-01`);
    const base=`до ${formatDate(goal.deadline)} · нужно ${money(status.requiredMonthly)}/мес.`;
    if(status.onTrack) return {text:`${base} · текущий план укладывается`,warning:false};
    return {text:`${base} · по текущему плану не хватает ${money(status.shortfall)}/мес.`,warning:true};
  }

  root.renderTopbar=function(){
    const account=state.account;
    const letter=(account.name||"П").trim().slice(0,1).toUpperCase();
    return `<header class="topbar"><div class="logo">ARISE <span>FINANCE</span></div><div class="user"><button class="avatar" data-page="settings" aria-label="Настройки профиля">${account.avatar?`<img src="${escapeHTML(account.avatar)}" alt="">`:escapeHTML(letter)}</button></div></header>`;
  };

  root.renderNav=function(){
    const items=[["home","Главная"],["income","Распределение"],["goals","Цели"],["history","История"]];
    return `<nav class="nav" aria-label="Основная навигация">${items.map(([id,label])=>`<button class="${activePage===id?"active":""}" data-page="${id}">${label}</button>`).join("")}</nav>`;
  };

  root.renderHome=function(){
    const profile=currentProfile();
    const data=groupMonth(profile,activeMonth);
    const page=document.getElementById("page");
    page.className="";
    page.innerHTML=`<main class="arise-v3-home" aria-label="Финансовый поток за ${escapeHTML(formatMonth(activeMonth))}">
      <div class="arise-v3-month">${escapeHTML(formatMonth(activeMonth))}</div>
      <section class="arise-v3-income"><div class="arise-v3-income-label">Доход в месяце</div><div class="arise-v3-income-value">${money(data.income)}</div><div class="arise-v3-income-note">поступило</div></section>
      <section class="arise-flow-stage" aria-label="Распределение дохода">
        ${homeFlowScene()}
        ${node({side:"left",kind:"fixed",name:"Обязательное",amount:data.fixed,total:data.income,color:"#d3b36e",page:"income",delay:120})}
        ${node({side:"right",kind:"categories",name:"Категории",amount:data.categories,total:data.income,color:"#e1c17a",page:"income",delay:210})}
        ${node({side:"left",kind:"reserve",name:"Резерв",amount:data.reserve,total:data.income,color:"#a9d0d1",page:"settings",delay:300})}
        ${node({side:"right",kind:"goals",name:"Цели",amount:data.goals,total:data.income,color:"#d0a65e",page:"goals",delay:390})}
        <div class="arise-remainder"><div class="arise-remainder-label">Не распределено</div><div class="arise-remainder-value">${money(data.unallocated)}</div><div class="arise-remainder-note">остаток сохраняется и переносится дальше</div></div>
      </section>
      ${data.uncontrolled>0?`<div class="v3-alert"><strong>${money(data.uncontrolled)} не объяснены системой</strong><span>ARISE покажет разбивку расходов и источник недостающих денег в истории.</span></div>`:""}
      <button class="arise-v3-cta" id="homeIncome" data-v3-page="income"><span>${data.unallocated>0?"Посмотреть распределение":"Изменить распределение"}</span><span>→</span></button>
    </main>`;
    bindPageLinks(page);
    startHomeFluidFlow(page.querySelector(".arise-flow-canvas"));
  };

  root.renderIncome=function(){
    const profile=currentProfile();
    const data=groupMonth(profile,activeMonth);
    const raw=core.monthStats(profile,activeMonth);
    const allocated=safeAmount(data.fixed+data.categories+data.reserve+data.goals);
    const allocatedPercent=pct(allocated,data.income);
    const rows=(profile.categories||[]).filter(c=>c.enabled!==false).map(category=>({category,amount:safeAmount(raw.categoryAllocated?.[category.id]||0)})).sort((a,b)=>safeAmount(b.category.priority)-safeAmount(a.category.priority));
    const page=document.getElementById("page");
    page.className="arise-v3-secondary arise-v3-distribution";
    page.innerHTML=`<div class="v3-page-head"><div class="v3-page-head-copy"><div class="v3-eyebrow">Распределение</div><h1>${money(data.income)}</h1><p>${escapeHTML(formatMonth(activeMonth))} · текущая картина</p><div class="v3-head-status"><i aria-hidden="true"></i><span>${allocatedPercent}% дохода уже направлено</span></div></div><button class="v3-round" id="incomeStart" aria-label="Добавить доход">+</button></div>
      <section class="v3-flow-summary" style="--allocated:${allocatedPercent}%" aria-label="${allocatedPercent}% дохода распределено">${summaryFlowScene()}<div class="v3-mini-source"></div><div class="v3-flow-caption"><span>Маршрут месяца</span><b>${allocatedPercent}% работает</b></div><div class="v3-summary-row" style="--i:0;--share:${pct(data.fixed,data.income)}%"><span>Обязательное</span><strong>${money(data.fixed)}</strong><em>${pct(data.fixed,data.income)}%</em></div><div class="v3-summary-row" style="--i:1;--share:${pct(data.categories,data.income)}%"><span>Категории</span><strong>${money(data.categories)}</strong><em>${pct(data.categories,data.income)}%</em></div><div class="v3-summary-row cool" style="--i:2;--share:${pct(data.reserve,data.income)}%"><span>Резерв</span><strong>${money(data.reserve)}</strong><em>${pct(data.reserve,data.income)}%</em></div><div class="v3-summary-row" style="--i:3;--share:${pct(data.goals,data.income)}%"><span>Цели</span><strong>${money(data.goals)}</strong><em>${pct(data.goals,data.income)}%</em></div><div class="v3-summary-tail"><div class="v3-summary-measure" aria-hidden="true"><i></i><b></b></div><span>Не распределено</span><strong>${money(data.unallocated)}</strong></div></section>
      <section class="v3-section"><div class="v3-section-title"><span>Правила месяца</span><button id="incomeSettings">Настроить</button></div><div class="v3-rule-list">${rows.length?rows.map((row,index)=>`<div class="v3-rule" style="--rule-share:${pct(row.amount,data.income)}%"><i class="v3-rule-index" aria-hidden="true">${String(index+1).padStart(2,"0")}</i><div><strong>${escapeHTML(row.category.name||"Категория")}</strong><span>${escapeHTML(categoryRuleMeta(row.category))}</span><span class="v3-rule-meter" aria-hidden="true"><b></b></span></div><b>${money(row.amount)}</b></div>`).join(""):`<div class="v3-empty">Категорий нет. Создай свои правила распределения.</div>`}</div></section>
      <details class="v3-section v3-soft-note"><summary><span>Как работает процент</span><em>О логике распределения</em><b aria-hidden="true">+</b></summary><p>Если месячный лимит не указан, выбранный процент распределяется с каждого нового пополнения в рамках месяца. Например, 10% означает 10% с каждого внесённого дохода. Все предложения видны до сохранения.</p></details>`;
    document.getElementById("incomeStart").onclick=showIncomeModal;
    document.getElementById("incomeSettings").onclick=()=>{activePage="settings";render();};
  };

  root.renderGoals=function(){
    const profile=currentProfile();
    const active=(profile.goals||[]).filter(goal=>goal.status!=="completed").sort((a,b)=>safeAmount(b.priority)-safeAmount(a.priority));
    const completed=(profile.goals||[]).filter(goal=>goal.status==="completed");
    const total=active.reduce((s,goal)=>s+safeAmount(core.goalBalance(profile,goal)),0);
    const targetTotal=active.reduce((s,goal)=>s+safeAmount(goal.target),0);
    const totalProgress=targetTotal?Math.min(100,Math.round(total/targetTotal*100)):0;
    const remaining=Math.max(0,targetTotal-total);
    const page=document.getElementById("page");
    page.className="arise-v3-secondary arise-v3-goals";
    page.innerHTML=`<div class="v3-page-head"><div class="v3-page-head-copy"><div class="v3-eyebrow">Все цели</div><h1>${money(total)}</h1><p>${active.length} ${active.length===1?"активная цель":"активных целей"} · ${money(remaining)} до общего результата</p><div class="v3-head-status"><i aria-hidden="true"></i><span>${totalProgress}% общего пути пройдено</span></div></div><button class="v3-round" id="createGoal" aria-label="Создать цель">+</button></div>
      ${active.length?`<section class="v3-goals-overview" style="--p:${totalProgress}%" aria-label="Общий прогресс целей ${totalProgress}%"><div class="v3-goals-overview-head"><span>Общий маршрут</span><strong>${totalProgress}%</strong></div><div class="v3-goals-horizon" aria-hidden="true"><i></i><b></b><em></em></div><div class="v3-goals-overview-stats"><div><span>Накоплено</span><strong>${money(total)}</strong></div><div><span>Общая цель</span><strong>${money(targetTotal)}</strong></div><div><span>Осталось</span><strong>${money(remaining)}</strong></div></div></section>`:""}
      <section class="v3-goal-list">${active.length?active.map((goal,index)=>{const balance=safeAmount(core.goalBalance(profile,goal));const target=safeAmount(goal.target);const progress=target?Math.min(100,Math.round(balance/target*100)):0;const pace=goalPace(profile,goal);return `<article class="v3-goal" style="--i:${index};--goal-progress:${progress}%" data-goal-id="${goal.id}"><div class="v3-goal-flow" aria-hidden="true"><i></i></div><div class="v3-goal-ring" style="--p:${progress};--dot-opacity:${progress>0?1:0}"><i class="goal-ring-terminal" aria-hidden="true"></i><span>${progress}%</span></div><div class="v3-goal-main"><div class="v3-goal-title"><strong>${escapeHTML(goal.name||"Цель")}</strong><em class="${pace.warning?"is-warning":"is-on-track"}">${pace.warning?"нужно ускорить":"по плану"}</em></div><div>${money(balance)} <span>из ${money(target)}</span></div><div class="v3-goal-track" aria-hidden="true"><i></i><b></b></div><small class="${pace.warning?"v3-warning":""}">${escapeHTML(pace.text)}</small></div><div class="v3-goal-actions"><button data-goal-fund="${goal.id}">Пополнить</button><button data-goal-edit="${goal.id}" aria-label="Изменить цель">•••</button></div></article>`;}).join(""):`<div class="v3-empty">Пока нет целей. Создай первую — ARISE покажет, какой темп нужен для выбранного срока.</div>`}</section>
      ${completed.length?`<section class="v3-section" data-completed-goals><div class="v3-section-title"><span>Достигнутые</span><b>${completed.length}</b></div>${completed.map(goal=>`<div class="v3-rule goal-completed-row" data-completed-goal-id="${escapeHTML(goal.id)}"><div><strong>${escapeHTML(goal.name)}</strong><span>${goal.completedAt?`Достигнута ${escapeHTML(formatDate(goal.completedAt))}`:"Цель достигнута"}</span></div><b>${money(goal.target)}</b></div>`).join("")}</section>`:""}`;
    document.getElementById("createGoal").onclick=()=>showGoalModal();
    page.querySelectorAll("[data-goal-fund]").forEach(button=>button.onclick=()=>showGoalFundModal(button.dataset.goalFund));
    page.querySelectorAll("[data-goal-edit]").forEach(button=>button.onclick=()=>showGoalModal(button.dataset.goalEdit));
  };

  function historyChartPoints(values,width=520,height=180,horizontalPad=0,verticalPad=14){
    const max=Math.max(1,...values.map(safeAmount));const min=Math.min(0,...values.map(value=>Number(value)||0));const span=Math.max(1,max-min);
    return values.map((value,index)=>{const x=values.length===1?width/2:horizontalPad+index*((width-horizontalPad*2)/(values.length-1));const y=height-verticalPad-((safeAmount(value)-min)/span)*(height-verticalPad*2);return [x,y];});
  }

  function monotoneChartPath(points){
    if(!points.length)return "";
    if(points.length===1)return `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    const slopes=points.slice(0,-1).map((point,index)=>(points[index+1][1]-point[1])/(points[index+1][0]-point[0]||1));
    const tangents=points.map((_point,index)=>{
      if(index===0)return slopes[0];
      if(index===points.length-1)return slopes[slopes.length-1];
      return slopes[index-1]*slopes[index]<=0?0:(slopes[index-1]+slopes[index])/2;
    });
    slopes.forEach((slope,index)=>{
      if(Math.abs(slope)<1e-8){tangents[index]=0;tangents[index+1]=0;return;}
      const a=tangents[index]/slope,b=tangents[index+1]/slope,length=Math.hypot(a,b);
      if(length>3){const scale=3/length;tangents[index]=scale*a*slope;tangents[index+1]=scale*b*slope;}
    });
    return points.slice(0,-1).reduce((result,point,index)=>{const next=points[index+1],dx=next[0]-point[0];return `${result} C${(point[0]+dx/3).toFixed(1)} ${(point[1]+tangents[index]*dx/3).toFixed(1)} ${(next[0]-dx/3).toFixed(1)} ${(next[1]-tangents[index+1]*dx/3).toFixed(1)} ${next[0].toFixed(1)} ${next[1].toFixed(1)}`;},`M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`);
  }

  function chartPath(values,width=520,height=180,horizontalPad=0,verticalPad=14){
    return monotoneChartPath(historyChartPoints(values,width,height,horizontalPad,verticalPad));
  }

  function chartAreaPath(values,width=520,height=180,horizontalPad=0,verticalPad=14){
    const points=historyChartPoints(values,width,height,horizontalPad,verticalPad);const line=monotoneChartPath(points);
    return line?`${line} L${points[points.length-1][0].toFixed(1)} ${height-verticalPad} L${points[0][0].toFixed(1)} ${height-verticalPad} Z`:"";
  }

  function chartDots(values,width=520,height=180,horizontalPad=0,verticalPad=14,months=[]){
    const points=historyChartPoints(values,width,height,horizontalPad,verticalPad);
    return points.map(([x,y],index)=>`<circle class="v3-chart-point${index===points.length-1?" is-terminal is-active":""}" style="--i:${index}" data-chart-index="${index}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${index===points.length-1?3.8:2.7}"><title>${months[index]?`${escapeHTML(formatMonth(months[index]))}: `:""}${money(values[index])}</title></circle>`).join("");
  }

  function historyChartHits(values,months,width=520,height=180,horizontalPad=42){
    if(!values.length)return "";
    const usable=width-horizontalPad*2;
    const step=values.length>1?usable/(values.length-1):usable;
    return values.map((value,index)=>{
      const center=values.length===1?width/2:horizontalPad+index*step;
      const left=index===0?horizontalPad:center-step/2;
      const right=index===values.length-1?width-horizontalPad:center+step/2;
      const label=months[index]?formatMonth(months[index]):`Период ${index+1}`;
      return `<rect class="v3-chart-hit" tabindex="0" role="button" x="${left.toFixed(1)}" y="0" width="${Math.max(1,right-left).toFixed(1)}" height="${height}" data-chart-index="${index}" data-chart-value="${safeAmount(value)}" data-chart-label="${escapeHTML(label)}" aria-label="${escapeHTML(label)}: ${money(value)}"/>`;
    }).join("");
  }

  function compactChartValue(value){
    const amount=safeAmount(value);
    if(amount>=1000000)return `${(amount/1000000).toLocaleString("ru-RU",{maximumFractionDigits:1})} млн`;
    if(amount>=1000)return `${(amount/1000).toLocaleString("ru-RU",{maximumFractionDigits:0})} тыс.`;
    return amount.toLocaleString("ru-RU",{maximumFractionDigits:0});
  }

  function historyChartGuides(values,width=520,height=180,horizontalPad=42,verticalPad=14){
    const max=Math.max(1,...values.map(safeAmount));
    return [.75,.5,.25].map(ratio=>{const y=height-verticalPad-ratio*(height-verticalPad*2);return `<line x1="${horizontalPad}" y1="${y.toFixed(1)}" x2="${width-horizontalPad}" y2="${y.toFixed(1)}"/>`;}).join("");
  }

  function historyTerminalGuide(values,width=520,height=180,horizontalPad=42,verticalPad=14){
    const points=historyChartPoints(values,width,height,horizontalPad,verticalPad);if(!points.length)return "";const [x]=points[points.length-1];
    return `<line class="v3-chart-terminal-guide" x1="${x.toFixed(1)}" y1="${verticalPad}" x2="${x.toFixed(1)}" y2="${height-verticalPad}"/>`;
  }

  function historyTrend(values,months){
    if(values.length<2)return `<em class="v3-chart-change is-neutral">первый период</em>`;
    const current=safeAmount(values[values.length-1]),previous=safeAmount(values[values.length-2]),difference=current-previous;
    const direction=difference>0?"is-up":difference<0?"is-down":"is-neutral";
    const percent=previous>0?`${Math.round(Math.abs(difference)/previous*100)}%`:difference?"новый доход":"0%";
    const dativeMonths=["январю","февралю","марту","апрелю","маю","июню","июлю","августу","сентябрю","октябрю","ноябрю","декабрю"];
    const monthNumber=Number(String(months[months.length-2]||"").slice(5,7));
    const label=dativeMonths[monthNumber-1]||"прошлому месяцу";
    return `<em class="v3-chart-change ${direction}">${difference>0?"↑":difference<0?"↓":"·"} ${percent} к ${escapeHTML(label)}</em>`;
  }

  function bindHistoryChart(scope){
    const plot=scope&&scope.querySelector(".v3-history-plot");
    if(!plot)return;
    const hits=[...plot.querySelectorAll(".v3-chart-hit")];
    const points=[...plot.querySelectorAll(".v3-chart-point")];
    const guide=plot.querySelector(".v3-chart-terminal-guide");
    const period=scope.querySelector("[data-history-period]");
    const value=scope.querySelector("[data-history-value]");
    const activate=index=>{
      const hit=hits[index],point=points[index];
      if(!hit||!point)return;
      points.forEach(item=>item.classList.remove("is-active"));
      point.classList.add("is-active");
      if(guide){guide.setAttribute("x1",point.getAttribute("cx"));guide.setAttribute("x2",point.getAttribute("cx"));}
      if(period)period.textContent=hit.dataset.chartLabel||"";
      if(value)value.textContent=money(hit.dataset.chartValue||0);
    };
    hits.forEach((hit,index)=>{
      hit.addEventListener("pointerenter",()=>activate(index));
      hit.addEventListener("focus",()=>activate(index));
      hit.addEventListener("click",()=>activate(index));
    });
    activate(Math.max(0,hits.length-1));
  }

  root.renderHistory=function(){
    const profile=currentProfile();
    const months=allMonths(profile).slice(-6);
    const incomes=months.map(month=>safeAmount(core.monthStats(profile,month).income));
    const historyWidth=520,historyHeight=180,historyPadX=42,historyPadY=14;
    const historyMax=Math.max(1,...incomes);
    const data=groupMonth(profile,activeMonth);
    const txs=monthTransactions(profile,activeMonth).slice().reverse().slice(0,14);
    const latestMonth=months[months.length-1]||activeMonth;
    const page=document.getElementById("page");
    page.className="arise-v3-secondary arise-v3-history";
    page.innerHTML=`<div class="v3-page-head"><div class="v3-page-head-copy"><div class="v3-eyebrow">История</div><h1>${escapeHTML(formatMonth(activeMonth))}</h1><p>${money(data.income)} доход · ${money(data.expenses)} расходы</p><div class="v3-head-status"><i aria-hidden="true"></i><span>${months.length} ${months.length===1?"месяц":"месяцев"} в текущем диапазоне</span></div></div><div class="v3-head-actions"><button id="historyIncome">+ доход</button><button id="historyExpense">− расход</button></div></div>
      ${data.uncontrolled>0?`<div class="v3-alert"><strong>${money(data.uncontrolled)} неконтролируемых средств</strong><span>Это часть расходов, которую нельзя покрыть выбранной категорией и нераспределённым остатком.</span></div>`:""}
      <section class="v3-history-chart"><div class="v3-chart-total"><div><span>Доход по месяцам</span>${historyTrend(incomes,months)}</div><div class="v3-chart-current" aria-live="polite"><small data-history-period>${escapeHTML(formatMonth(latestMonth))}</small><strong data-history-value>${money(incomes[incomes.length-1]||0)}</strong></div></div><div class="v3-history-plot"><div class="v3-chart-y-scale" aria-hidden="true"><span style="--y:28.9%">${compactChartValue(historyMax*.75)}</span><span style="--y:50%">${compactChartValue(historyMax*.5)}</span><span style="--y:71.1%">${compactChartValue(historyMax*.25)}</span></div><svg viewBox="0 0 ${historyWidth} ${historyHeight}" preserveAspectRatio="none" role="img" aria-label="Динамика дохода"><defs><linearGradient id="historyArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e1bd72" stop-opacity=".2"/><stop offset="1" stop-color="#e1bd72" stop-opacity="0"/></linearGradient><filter id="historyPointGlow" x="-400%" y="-400%" width="800%" height="800%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g class="v3-chart-grid">${historyChartGuides(incomes,historyWidth,historyHeight,historyPadX,historyPadY)}</g>${historyTerminalGuide(incomes,historyWidth,historyHeight,historyPadX,historyPadY)}<path class="v3-chart-area" d="${chartAreaPath(incomes,historyWidth,historyHeight,historyPadX,historyPadY)}"/><path class="v3-chart-glow" pathLength="1" d="${chartPath(incomes,historyWidth,historyHeight,historyPadX,historyPadY)}"/><path class="v3-chart-line" pathLength="1" d="${chartPath(incomes,historyWidth,historyHeight,historyPadX,historyPadY)}"/><g class="v3-chart-points" filter="url(#historyPointGlow)">${chartDots(incomes,historyWidth,historyHeight,historyPadX,historyPadY,months)}</g><g class="v3-chart-hits">${historyChartHits(incomes,months,historyWidth,historyHeight,historyPadX)}</g></svg></div><div class="v3-chart-months">${months.map(month=>`<span>${escapeHTML(formatMonth(month).slice(0,3))}</span>`).join("")}</div></section>
      <div class="v3-breakdown-head"><span>Структура текущего месяца</span><b>${money(data.income)}</b></div><section class="v3-breakdown">${[["Обязательное",data.fixed],["Категории",data.categories],["Резерв",data.reserve],["Цели",data.goals],["Не распределено",data.unallocated]].map(([name,value],index)=>`<div class="v3-break-row" style="--share:${pct(value,data.income)}%"><i class="v3-break-signal tone-${index}" aria-hidden="true"><b></b></i><span>${name}</span><strong>${money(value)}</strong><em>${index===4?"перенос":`${pct(value,data.income)}%`}</em></div>`).join("")}</section>
      <section class="v3-section"><div class="v3-section-title"><span>Операции месяца</span><b>${txs.length}</b></div><div class="v3-transactions">${txs.length?txs.map(tx=>historyTransaction(tx)).join(""):`<div class="v3-empty">Операций пока нет.</div>`}</div></section>`;
    document.getElementById("historyIncome").onclick=showIncomeModal;
    document.getElementById("historyExpense").onclick=showExpenseModal;
    bindHistoryChart(page);
  };

  root.ARISE_V3={groupMonth,historyChartPoints,monotoneChartPath,chartPath,chartAreaPath,chartDots,historyChartHits,compactChartValue,historyChartGuides,historyTrend,bindHistoryChart,categoryRuleMeta,goalPace,homeFlowScene,summaryFlowScene,startHomeFluidFlow};
})(typeof globalThis!=="undefined"?globalThis:window);
