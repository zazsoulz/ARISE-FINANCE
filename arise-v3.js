(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const original={
    income:root.renderIncome,
    goals:root.renderGoals,
    history:root.renderHistory
  };

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

    return {
      income:safeAmount(raw.income),
      fixed,
      categories,
      reserve:safeAmount(raw.reserve),
      goals:sum(Object.values(raw.goalAllocated||{})),
      unallocated:safeAmount(raw.free)
    };
  }

  function node({side,kind,name,amount,total,color,page}){
    return `
      <button class="arise-flow-node ${side} ${kind}" style="--node-color:${color}" data-v3-page="${page}">
        <span class="node-name">${escapeHTML(name)}</span>
        <strong>${money(amount)}</strong>
        <small>${pct(amount,total)}%</small>
      </button>`;
  }

  root.renderTopbar=function(){
    const account=state.account;
    const letter=(account.name||"П").trim().slice(0,1).toUpperCase();
    return `
      <header class="topbar">
        <div class="logo">ARISE <span>FINANCE</span></div>
        <div class="user">
          <button class="avatar" data-page="settings" aria-label="Настройки профиля">
            ${account.avatar?`<img src="${escapeHTML(account.avatar)}" alt="">`:escapeHTML(letter)}
          </button>
        </div>
      </header>`;
  };

  root.renderNav=function(){
    const items=[
      ["home","Главная"],
      ["income","Распределение"],
      ["goals","Цели"],
      ["history","История"]
    ];
    return `<nav class="nav" aria-label="Основная навигация">${items.map(([id,label])=>`
      <button class="${activePage===id?"active":""}" data-page="${id}">${label}</button>`).join("")}</nav>`;
  };

  root.renderHome=function(){
    const profile=currentProfile();
    const data=groupMonth(profile,activeMonth);
    const page=document.getElementById("page");

    page.innerHTML=`
      <main class="arise-v3-home" aria-label="Финансовый поток за ${escapeHTML(formatMonth(activeMonth))}">
        <div class="arise-v3-month">${escapeHTML(formatMonth(activeMonth))}</div>
        <section class="arise-v3-income">
          <div class="arise-v3-income-label">Доход в месяце</div>
          <div class="arise-v3-income-value">${money(data.income)}</div>
          <div class="arise-v3-income-note">поступило</div>
        </section>

        <section class="arise-flow-stage" aria-label="Распределение дохода">
          <div class="arise-flow-source" aria-hidden="true"></div>
          <svg class="arise-flow-svg" viewBox="0 0 600 570" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="ariseTrunk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#eee6d6" stop-opacity=".88"/>
                <stop offset=".46" stop-color="#b7b4aa" stop-opacity=".64"/>
                <stop offset="1" stop-color="#c6a86b" stop-opacity=".62"/>
              </linearGradient>
            </defs>
            <path class="arise-flow-ghost" d="M300 18 C285 92 316 154 292 226 C266 302 284 373 300 480"/>
            <path class="arise-flow-ghost" d="M300 18 C321 99 282 164 309 244 C335 322 315 394 300 480"/>
            <path class="arise-flow-main" d="M300 18 C304 104 295 170 300 248 C305 334 292 411 300 480"/>
            <path class="arise-flow-main" d="M295 18 C286 118 315 184 291 276 C273 347 291 415 300 480" opacity=".42"/>
            <path class="arise-flow-main" d="M305 18 C319 112 286 189 311 275 C330 347 311 416 300 480" opacity=".36"/>

            <path class="arise-flow-branch" style="--branch:#c6a86b" d="M300 88 C249 92 211 101 172 112"/>
            <path class="arise-flow-drift" style="--branch:#c6a86b" d="M300 88 C249 92 211 101 172 112"/>
            <path class="arise-flow-branch" style="--branch:#c8b37f" d="M302 158 C358 157 394 165 430 180"/>
            <path class="arise-flow-drift" style="--branch:#c8b37f" d="M302 158 C358 157 394 165 430 180"/>
            <path class="arise-flow-branch" style="--branch:#9db6b4" d="M296 278 C246 280 208 292 171 306"/>
            <path class="arise-flow-drift" style="--branch:#9db6b4" d="M296 278 C246 280 208 292 171 306"/>
            <path class="arise-flow-branch" style="--branch:#c6a86b" d="M303 352 C357 350 394 356 430 372"/>
            <path class="arise-flow-drift" style="--branch:#c6a86b" d="M303 352 C357 350 394 356 430 372"/>
          </svg>

          ${node({side:"left",kind:"fixed",name:"Обязательное",amount:data.fixed,total:data.income,color:"#bda46f",page:"income"})}
          ${node({side:"right",kind:"categories",name:"Категории",amount:data.categories,total:data.income,color:"#c6ae78",page:"income"})}
          ${node({side:"left",kind:"reserve",name:"Резерв",amount:data.reserve,total:data.income,color:"#9eb9b7",page:"settings"})}
          ${node({side:"right",kind:"goals",name:"Цели",amount:data.goals,total:data.income,color:"#c4a261",page:"goals"})}

          <div class="arise-remainder">
            <div class="arise-remainder-label">Осталось</div>
            <div class="arise-remainder-value">${money(data.unallocated)}</div>
            <div class="arise-remainder-note">не распределено · ${pct(data.unallocated,data.income)}%</div>
          </div>
        </section>

        <button class="arise-v3-cta" id="homeIncome" data-v3-page="income">
          <span>${data.unallocated>0?"Распределить остаток":"Изменить распределение"}</span><span>→</span>
        </button>
      </main>`;

    page.querySelectorAll("[data-v3-page]").forEach(button=>{
      button.onclick=()=>{
        activePage=button.dataset.v3Page;
        render();
      };
    });
  };

  function secondary(name,renderer){
    if(typeof renderer!=="function") return;
    root[name]=function(){
      renderer();
      const page=document.getElementById("page");
      if(page) page.classList.add("arise-v3-secondary");
    };
  }

  secondary("renderIncome",original.income);
  secondary("renderGoals",original.goals);
  secondary("renderHistory",original.history);

  root.ARISE_V3={groupMonth};
})(typeof globalThis!=="undefined"?globalThis:window);
