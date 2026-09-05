(function(root){
  "use strict";

  function toast(message){
    if(typeof root.toast==="function")root.toast(message);
  }

  function openAuthForSync(){
    if(typeof root.renderAuth==="function"){
      root.renderAuth();
      return true;
    }
    toast("Вход сейчас недоступен. Локальные финансовые данные сохранены на устройстве.");
    return false;
  }

  function syncUnavailable(){
    const sync=root.ARISE_SYNC;
    return !sync||typeof sync.pushAll!=="function";
  }

  function handleSyncAction(){
    const product=root.ARISE_PRODUCT_UI;
    if(!product||typeof product.syncState!=="function")return {handled:false,result:false};
    const state=product.syncState();

    if(state.kind==="local"){
      return {handled:true,result:openAuthForSync()};
    }

    if(state.kind!=="offline"&&state.kind!=="conflict"&&state.kind!=="syncing"&&syncUnavailable()){
      toast("Синхронизация сейчас недоступна. Локальные изменения сохранены — можно продолжать работу на устройстве.");
      return {handled:true,result:false};
    }

    return {handled:false,result:false};
  }

  if(root.addEventListener){
    root.addEventListener("click",event=>{
      const button=event.target&&event.target.closest?event.target.closest(".product-sync"):null;
      if(!button)return;
      const outcome=handleSyncAction();
      if(!outcome.handled)return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);
  }

  root.ARISE_SYNC_ACTION_UI={openAuthForSync,syncUnavailable,handleSyncAction};
})(typeof globalThis!=="undefined"?globalThis:window);
