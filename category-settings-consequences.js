(function(root){
  "use strict";

  const amount=value=>Math.max(0,Math.round(Number(value)||0));

  function value(editor,selector){
    return editor.querySelector(selector)?.value ?? "";
  }

  function checked(editor,selector){
    return !!editor.querySelector(selector)?.checked;
  }

  function formatAmount(value){
    if(typeof root.money==="function") return root.money(amount(value));
    return new Intl.NumberFormat("ru-RU").format(amount(value))+" ₽";
  }

  function describe(editor){
    const type=value(editor,".category-type");
    const percent=amount(value(editor,".category-percent"));
    const fixed=amount(value(editor,".category-fixed"));
    const priority=Math.max(1,amount(value(editor,".category-priority"))||1);
    const rawLimit=value(editor,".category-limit");
    const limit=rawLimit===""?null:amount(rawLimit);
    const enabled=checked(editor,".category-enabled");

    if(!enabled){
      return {
        tone:"muted",
        title:"Не участвует в автоматическом распределении",
        text:"Новые доходы не будут направляться в эту категорию, пока ты снова её не включишь. Уже сохранённые операции не меняются."
      };
    }

    let rule="";
    if(type==="fixed"){
      rule=fixed>0
        ? `ARISE будет стремиться направить сюда до ${formatAmount(fixed)} в месяц.`
        : "Фиксированная сумма сейчас равна нулю — автоматического пополнения по этому правилу не будет.";
    }else if(type==="percentage"){
      rule=percent>0
        ? `ARISE направляет ${percent}% с каждого нового дохода.`
        : "Процент сейчас равен нулю — автоматического пополнения по этому правилу не будет.";
    }else{
      rule="Категория получает только остаток, который не забрали более приоритетные правила.";
    }

    const cap=limit===null
      ? " Месячного лимита нет."
      : ` После ${formatAmount(limit)} за месяц категория перестанет получать новые автоматические распределения до следующего месяца.`;

    const priorityText=priority>=5
      ? " Высокий приоритет: при нехватке денег это правило обслуживается раньше большинства остальных."
      : priority<=2
        ? " Низкий приоритет: при нехватке денег более важные правила могут забрать доступную сумму раньше."
        : " Приоритет определяет очередь только когда денег недостаточно для всех правил.";

    return {tone:"normal",title:"Что изменит это правило",text:rule+cap+priorityText};
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
    const preview=ensurePreview(editor);
    const info=describe(editor);
    preview.className="category-consequence notice"+(info.tone==="muted"?" warning":"");
    preview.innerHTML=`<strong>${info.title}</strong><div class="tiny muted" style="margin-top:5px;line-height:1.55">${info.text}</div>`;

    const type=value(editor,".category-type");
    const percent=editor.querySelector(".category-percent")?.closest(".field");
    const fixed=editor.querySelector(".category-fixed")?.closest(".field");
    if(percent) percent.style.display=type==="percentage"?"":"none";
    if(fixed) fixed.style.display=type==="fixed"?"":"none";
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

  function install(){
    const oldRenderSettings=root.renderSettings;
    if(typeof oldRenderSettings!=="function") return;
    root.renderSettings=function(){
      const result=oldRenderSettings.apply(this,arguments);
      bind(document);
      return result;
    };
  }

  root.ARISE_CATEGORY_SETTINGS_CONSEQUENCES={describe,bind};
  install();
})(typeof globalThis!=="undefined"?globalThis:window);
