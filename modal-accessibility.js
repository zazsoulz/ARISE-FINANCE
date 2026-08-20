(function(root){
  "use strict";

  const originalOpen=root.openModal;
  const originalClose=root.closeModal;
  if(typeof originalOpen!=="function"||typeof originalClose!=="function")return;

  let opener=null;
  let titleSequence=0;

  function modal(){return typeof document!=="undefined"?document.getElementById("modal"):null;}
  function sheet(){return typeof document!=="undefined"?document.getElementById("sheet"):null;}
  function focusables(){
    const container=sheet();
    if(!container)return [];
    return [...container.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
  }
  function prepareDialog(){
    const overlay=modal();
    const container=sheet();
    if(!overlay||!container)return;
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    const title=container.querySelector(".title");
    if(title){
      if(!title.id)title.id=`arise-modal-title-${++titleSequence}`;
      overlay.setAttribute("aria-labelledby",title.id);
    }else{
      overlay.removeAttribute("aria-labelledby");
      overlay.setAttribute("aria-label","Диалог ARISE");
    }
    const first=focusables()[0]||container;
    if(first===container&&!container.hasAttribute("tabindex"))container.setAttribute("tabindex","-1");
    if(first&&typeof first.focus==="function")first.focus({preventScroll:true});
  }

  root.openModal=function(html){
    const active=typeof document!=="undefined"?document.activeElement:null;
    opener=active&&active!==document.body?active:null;
    const result=originalOpen.call(this,html);
    prepareDialog();
    return result;
  };

  root.closeModal=function(){
    const result=originalClose.apply(this,arguments);
    const target=opener;
    opener=null;
    if(target&&target.isConnected&&typeof target.focus==="function")target.focus({preventScroll:true});
    return result;
  };

  function trapTab(event){
    if(event.key!=="Tab")return;
    const overlay=modal();
    if(!overlay||!overlay.classList.contains("open"))return;
    const items=focusables();
    if(!items.length){event.preventDefault();sheet()?.focus();return;}
    const first=items[0],last=items[items.length-1],active=document.activeElement;
    if(event.shiftKey&&(active===first||!items.includes(active))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(active===last||!items.includes(active))){event.preventDefault();first.focus();}
  }

  if(typeof document!=="undefined")document.addEventListener("keydown",trapTab);

  root.ARISE_MODAL_ACCESSIBILITY={prepareDialog,focusables,trapTab};
})(typeof globalThis!=="undefined"?globalThis:window);
