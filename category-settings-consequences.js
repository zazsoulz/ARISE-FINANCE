(function(root){
  "use strict";

  const amount=value=>Math.max(0,Math.round(Number(value)||0));

  function field(editor,selector){
    return editor.querySelector(selector)?.value ?? "";
  }

  function enabled(editor){
    return !!editor.querySelector(".category-enabled")?.checked;
  }

  function money(value){
    if(typeof root.money==="function") return root.money(amount(value));
    return new Intl.NumberFormat("ru-RU").format(amount(value))+" ₽";
  }

  function describe(editor){
    const type=field(editor,".category-type");
    const percent=amount(field(editor,".category-percent"));
    const fixed=amount(field(editor,".category-fixed"));
    const priority=Math.max(1,amount(field(editor,".category-priority"))||1);
    const rawLimit=field(editor,".category-limit");
    const limit=rawLimit===""?null:amount(rawLimit);

    if(!enabled(editor)){
      return {
        warning:true,
        title:"Категория выключена",
        text:"Новые доходы не будут направляться сюда автоматически. Уже сохранённые операции не меняются."
      };
    }

    let rule;
    if(type==="fixed"){
      rule=fixed>0
        ? `До ${money(fixed)} в месяц будет направляться сюда раньше процентных правил.`
        : "Фиксированная сумма равна нулю — автоматического пополнения по этому правилу не будет.";
    }else if(type==="percentage"){
      rule=percent>0
        ? `${percent}% будет распределяться с каждого нового дохода в рамках месяца.`
        : "Процент равен нулю — автоматического пополнения по этому правилу не будет.";
    }else{
      rule="Это правило получает только остаток после остальных распределений.";
    }

    const cap=limit===null
      ? " Месячный лимит не задан."
      : ` После ${money(limit)} за месяц автоматическое пополнение остановится до следующего месяца.`;

    const priorityText=priority>=5
      ? " Высокий приоритет: при нехватке денег это правило обслуживается раньше большинства остальных."
      : priority<=2
        ? " Низкий приоритет: при нехватке денег более важные правила могут получить средства раньше."
        : " Приоритет влияет на очередь распределения, когда денег недостаточно для всех правил.";

    return {warning:false,title:"Что изменит это правило",text:rule+cap+priorityText};
  }

  function ensurePreview(editor){
    let preview=editor.querySelector(".category-consequence");
    if(preview) return preview;
    preview=document.createElement("div");
    preview.className="category-consequence notice";
    preview.style.marginTop="12px";
    const check=editor.querySelector(".check");
    if(check) check.insertAdjacentElement("beforebegin",preview);
    else editor.appendChild(preview);
    return preview;
  }

  function refresh(editor){
    const info=describe(editor);
    const preview=ensurePreview(editor);
    preview.className="category-consequence notice"+(info.warning?" warning":"");
    preview.innerHTML=`<strong>${info.title}</strong><div class="tiny muted" style="margin-top:5px;line-height:1.55">${info.text}</div>`;

    const type=field(editor,".category-type");
    const percentField=editor.querySelector(".category-percent")?.closest(".field");
    const fixedField=editor.querySelector(".category-fixed")?.closest(".field");
    if(percentField) percentField.style.display=type==="percentage"?"":"none";
    if(fixedField) fixedField.style.display=type==="fixed"?"":"none";
  }

  function bind(scope=document){
    scope.querySelectorAll("[data-category-editor]").forEach(editor=>{
      if(editor.dataset.consequenceBound==="1"){
        refresh(editor);
        return;
      }
      editor.dataset.consequenceBound="1";
      [".category-type",".category-percent",".category-fixed",".category-priority",".category-limit",".category-enabled"].forEach(selector=>{
        const control=editor.querySelector(selector);
        if(!control) return;
        control.addEventListener("input",()=>refresh(editor));
        control.addEventListener("change",()=>refresh(editor));
      });
      refresh(editor);
    });
  }

  const oldRenderSettings=root.renderSettings;
  if(typeof oldRenderSettings==="function"){
    root.renderSettings=function(){
      const result=oldRenderSettings.apply(this,arguments);
      bind(document);
      return result;
    };
  }

  root.ARISE_CATEGORY_SETTINGS_CONSEQUENCES={describe,bind};
})(typeof globalThis!=="undefined"?globalThis:window);
