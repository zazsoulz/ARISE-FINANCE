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

  const homeFlowVertexShader=[
    "attribute vec2 aPosition;",
    "varying vec2 vUv;",
    "void main(){",
    "  vUv=aPosition*.5+.5;",
    "  gl_Position=vec4(aPosition,0.0,1.0);",
    "}"
  ].join("\n");

  const homeFlowFragmentShader=[
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "varying vec2 vUv;",
    "uniform float uTime;",
    "uniform float uCanvasAspect;",
    "float hash11(float point){",
    "  point=fract(point*0.1031);",
    "  point*=point+33.33;",
    "  point*=point+point;",
    "  return fract(point);",
    "}",
    "float hash21(vec2 point){",
    "  vec2 p=fract(point*vec2(123.34,345.45));",
    "  p+=dot(p,p+34.345);",
    "  return fract(p.x*p.y);",
    "}",
    "float noise1(float point){",
    "  float cell=floor(point);",
    "  float local=fract(point);",
    "  local=local*local*(3.0-2.0*local);",
    "  return mix(hash11(cell),hash11(cell+1.0),local);",
    "}",
    "float valueNoise(vec2 point){",
    "  vec2 cell=floor(point);",
    "  vec2 local=fract(point);",
    "  local=local*local*(3.0-2.0*local);",
    "  float a=hash21(cell);",
    "  float b=hash21(cell+vec2(1.0,0.0));",
    "  float c=hash21(cell+vec2(0.0,1.0));",
    "  float d=hash21(cell+vec2(1.0,1.0));",
    "  return mix(mix(a,b,local.x),mix(c,d,local.x),local.y);",
    "}",
    "float fbm(vec2 point){",
    "  float sum=0.0;",
    "  float amplitude=0.54;",
    "  for(int octave=0;octave<4;octave++){",
    "    sum+=valueNoise(point)*amplitude;",
    "    point=mat2(1.62,-1.08,1.08,1.62)*point+vec2(7.1,3.7);",
    "    amplitude*=0.48;",
    "  }",
    "  return sum;",
    "}",
    "float softLine(float distanceToLine,float radius){",
    "  return 1.0-smoothstep(radius,radius*3.4,distanceToLine);",
    "}",
    "void main(){",
    "  float down=1.0-vUv.y;",
    "  float x=vUv.x-0.5;",
    "  float time=uTime;",
    "  float travel=down-time*0.105;",
    "  float grow=smoothstep(0.015,0.76,down);",
    "  float trunkMask=smoothstep(0.004,0.025,down)*(1.0-smoothstep(0.73,0.88,down));",
    "  float broadWave=noise1(travel*4.7+2.4)*2.0-1.0;",
    "  float secondaryWave=noise1(travel*10.9+11.8)*2.0-1.0;",
    "  float center=(broadWave*0.018+secondaryWave*0.006)*grow;",
    "  float width=mix(0.006,0.126,pow(grow,0.78));",
    "  width*=0.88+0.22*noise1(travel*7.3+19.0);",
    "  float normalizedX=(x-center)/max(width,0.004);",
    "  float edgeCurrent=(noise1(travel*13.0+4.0)-0.5)*0.18;",
    "  float envelope=(1.0-smoothstep(0.55+edgeCurrent,1.18+edgeCurrent,abs(normalizedX)))*trunkMask;",
    "  vec2 advected=vec2(normalizedX*1.25,travel*8.2);",
    "  float warp=fbm(advected*vec2(0.72,0.54)+vec2(0.0,7.0))-0.5;",
    "  float sheetNoise=fbm(vec2(advected.x*1.8+warp*1.7,advected.y*1.25));",
    "  float sheets=smoothstep(0.30,0.82,sheetNoise)*envelope;",
    "  float strandEnergy=0.0;",
    "  vec3 strandColor=vec3(0.0);",
    "  for(int strandIndex=0;strandIndex<14;strandIndex++){",
    "    float strand=float(strandIndex);",
    "    float seed=hash11(strand*13.17+8.3);",
    "    float side=seed*2.0-1.0;",
    "    float strandTravel=down-time*(0.082+seed*0.055);",
    "    float lane=side*width*(0.28+0.66*hash11(strand+2.0));",
    "    float localCurrent=(noise1(strandTravel*(5.0+seed*3.8)+strand*5.7)-0.5)*width*(0.34+grow*0.32);",
    "    float curl=sin(strandTravel*(18.0+seed*8.0)+strand*2.1)*width*(0.025+0.085*grow);",
    "    float strandCenter=center+lane+localCurrent+curl;",
    "    float radius=mix(0.0011,0.0038,grow)*(0.64+seed*0.72);",
    "    float line=softLine(abs(x-strandCenter),radius)*trunkMask;",
    "    float packet=0.48+0.52*pow(0.5+0.5*sin(strandTravel*(54.0+seed*22.0)+strand*4.7),3.0);",
    "    line*=packet*(0.55+0.45*envelope);",
    "    vec3 cool=vec3(0.38,0.69,0.76);",
    "    vec3 ivory=vec3(0.91,0.92,0.84);",
    "    vec3 warm=vec3(0.95,0.68,0.31);",
    "    vec3 tone=side<0.0?mix(ivory,cool,min(1.0,-side*0.86)):mix(ivory,warm,min(1.0,side*0.86));",
    "    strandColor+=tone*line;",
    "    strandEnergy+=line;",
    "  }",
    "  float hairPhase=normalizedX*19.0+warp*7.0+travel*13.0;",
    "  float hairs=pow(0.5+0.5*sin(hairPhase),8.0)*envelope*(0.30+0.70*sheets);",
    "  float edgeMist=exp(-abs(abs(normalizedX)-0.92)*5.8)*trunkMask*(0.25+0.75*sheetNoise);",
    "  vec3 leftColor=vec3(0.34,0.64,0.72);",
    "  vec3 rightColor=vec3(0.92,0.62,0.27);",
    "  vec3 bodyTone=mix(leftColor,rightColor,smoothstep(-0.42,0.48,normalizedX));",
    "  vec3 color=bodyTone*(sheets*0.25+hairs*0.40+edgeMist*0.15)+strandColor*0.48;",
    "  float trunkAlpha=min(0.92,envelope*(0.10+sheets*0.30+hairs*0.44)+strandEnergy*0.20+edgeMist*0.14);",
    "  float poolGate=smoothstep(0.68,0.79,down)*(1.0-smoothstep(0.975,1.0,down));",
    "  vec2 poolPoint=vec2(x/0.34,(down-0.865)/0.145);",
    "  float poolRadius=length(poolPoint);",
    "  float poolAngle=atan(poolPoint.y,poolPoint.x);",
    "  float poolEdge=0.92+(valueNoise(vec2(poolAngle*2.2,1.0-time*0.12))-0.5)*0.13;",
    "  float poolEnvelope=(1.0-smoothstep(poolEdge,poolEdge+0.24,poolRadius))*poolGate;",
    "  float radialTravel=poolRadius-time*0.055;",
    "  float poolWarp=fbm(vec2(poolAngle*1.8+time*0.025,radialTravel*7.5))-0.5;",
    "  float rings=pow(0.5+0.5*sin(radialTravel*31.0+poolWarp*5.0),9.0)*poolEnvelope;",
    "  float poolVeins=pow(0.5+0.5*sin(poolAngle*9.0+poolRadius*15.0-poolWarp*8.0-time*0.62),12.0)*poolEnvelope;",
    "  vec3 poolTone=mix(leftColor,rightColor,smoothstep(-0.65,0.68,poolPoint.x));",
    "  color+=poolTone*(poolEnvelope*0.10+rings*0.31+poolVeins*0.19);",
    "  float poolAlpha=poolEnvelope*0.13+rings*0.34+poolVeins*0.17;",
    "  vec2 particlePoint=vec2((x-center)*92.0,(down-time*0.12)*112.0);",
    "  vec2 particleCell=floor(particlePoint);",
    "  vec2 particleLocal=fract(particlePoint)-0.5;",
    "  vec2 particleOffset=vec2(hash21(particleCell+2.7),hash21(particleCell+8.1))-0.5;",
    "  float particleSeed=hash21(particleCell+17.3);",
    "  float particle=(1.0-smoothstep(0.0,0.115,length(particleLocal-particleOffset*0.72)))*step(0.925,particleSeed);",
    "  particle*=max(envelope*0.78,poolEnvelope*0.38);",
    "  vec3 particleTone=mix(leftColor,rightColor,smoothstep(-0.08,0.10,x));",
    "  color+=particleTone*particle*0.58;",
    "  float alpha=clamp(trunkAlpha+poolAlpha+particle*0.44,0.0,0.96);",
    "  float source=1.0-smoothstep(0.0,0.025,length(vec2(x*1.35,(down-0.012)*uCanvasAspect)));",
    "  color+=vec3(0.97,0.84,0.55)*source*0.82;",
    "  alpha=max(alpha,source*0.94);",
    "  float canvasFade=smoothstep(0.0,0.014,vUv.y)*smoothstep(0.0,0.018,1.0-vUv.y);",
    "  gl_FragColor=vec4(color,alpha*canvasFade);",
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

  function createHomeFlowProgram(gl){
    const vertex=compileHomeFlowShader(gl,gl.VERTEX_SHADER,homeFlowVertexShader);
    const fragment=compileHomeFlowShader(gl,gl.FRAGMENT_SHADER,homeFlowFragmentShader);
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

  function sizeHomeFlowCanvas(canvas,maxRatio=1.4){
    const ratio=Math.min(maxRatio,Math.max(1,Number(root.devicePixelRatio)||1));
    const width=Math.max(1,Math.round(canvas.clientWidth*ratio));
    const height=Math.max(1,Math.round(canvas.clientHeight*ratio));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    return {width,height};
  }

  function startWebGLHomeFlow(canvas,reducedMotion){
    const gl=canvas.getContext("webgl",{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:"high-performance"})
      ||canvas.getContext("experimental-webgl",{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(!gl)return null;
    const program=createHomeFlowProgram(gl);
    const buffer=gl.createBuffer();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,"aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const uniforms={
      time:gl.getUniformLocation(program,"uTime"),
      canvasAspect:gl.getUniformLocation(program,"uCanvasAspect")
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
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
    const draw=now=>{
      if(stopped)return;
      if(!canvas.isConnected){stop();return;}
      const {width,height}=sizeHomeFlowCanvas(canvas,1.1);
      const stamp=Number(now)||previous;
      if(frames>0)elapsed+=Math.min(1/30,Math.max(0,(stamp-previous)/1000));
      previous=stamp;
      gl.viewport(0,0,width,height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(uniforms.time,elapsed);
      gl.uniform1f(uniforms.canvasAspect,width/height);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
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
    canvas.dataset.flowRenderer="webgl";
    canvas.classList.add("is-running");
    draw(started);
    return {stop};
  }

  function startCanvasHomeFlow(canvas,reducedMotion){
    const context=canvas.getContext("2d",{alpha:true});
    if(!context)return null;
    const {width,height}=sizeHomeFlowCanvas(canvas,1);
    context.clearRect(0,0,width,height);
    context.save();
    context.globalCompositeOperation="lighter";
    const gradient=context.createLinearGradient(width*.5,0,width*.5,height);
    gradient.addColorStop(0,"rgba(244,220,166,.92)");
    gradient.addColorStop(.46,"rgba(129,186,194,.55)");
    gradient.addColorStop(1,"rgba(218,168,83,.25)");
    context.strokeStyle=gradient;
    context.lineCap="round";
    for(let index=0;index<13;index+=1){
      const offset=(index-6)*width*.006;
      context.globalAlpha=.12+(index%4)*.045;
      context.lineWidth=1+(index%3)*.65;
      context.beginPath();
      context.moveTo(width*.5+offset*.08,height*.02);
      context.bezierCurveTo(width*.5-offset*.45,height*.31,width*.5+offset*1.8,height*.54,width*.5+offset*3.2,height*.77);
      context.bezierCurveTo(width*.5+offset*4.8,height*.86,width*.5+offset*8.5,height*.89,width*.5+offset*11,height*.91);
      context.stroke();
    }
    context.restore();
    canvas.dataset.flowRenderer="static2d";
    canvas.dataset.flowFrames="1";
    canvas.dataset.flowTime="0.000";
    canvas.dataset.flowMotion=reducedMotion?"reduced":"unsupported";
    canvas.classList.add("is-running");
    return {stop(){}};
  }

  function startHomeFluidFlow(canvas){
    if(!canvas)return null;
    const reducedMotion=Boolean(root.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if(typeof root.WebGLRenderingContext!=="function"&&typeof root.CanvasRenderingContext2D!=="function"){
      canvas.dataset.flowRenderer="static";
      canvas.dataset.flowFrames="1";
      canvas.dataset.flowTime="0.000";
      return {stop(){}};
    }
    let controller=null;
    let renderError="";
    try{
      controller=startWebGLHomeFlow(canvas,reducedMotion);
    }catch(error){
      renderError=String(error?.message||error).slice(0,160);
      canvas.dataset.flowError=renderError;
    }
    if(controller)return controller;
    let target=canvas;
    if(canvas.getContext("webgl")||canvas.getContext("experimental-webgl")){
      target=canvas.cloneNode(false);
      if(renderError)target.dataset.flowError=renderError;
      canvas.replaceWith(target);
    }
    controller=startCanvasHomeFlow(target,reducedMotion);
    if(!controller)target.dataset.flowRenderer="static";
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
