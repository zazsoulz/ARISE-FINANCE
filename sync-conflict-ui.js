(function(root){
  "use strict";

  const META_KEY="ariseSync";
  const previousRenderTopbar=root.renderTopbar;

  function meta(entity){return entity&&entity[META_KEY]&&typeof entity[META_KEY]==="object"?entity[META_KEY]:null;}

  function collectConflicts(){
    const rows=[];
    for(const profile of state.profiles||[]){
      if(meta(profile)&&meta(profile).conflict){
        rows.push({profileId:profile.id,entity:"profile",localId:profile.id,label:`Профиль · ${profile.name||"Без названия"}`,conflict:meta(profile).conflict});
      }
      for(const category of profile.categories||[]){
        if(meta(category)&&meta(category).conflict)rows.push({profileId:profile.id,entity:"category",localId:category.id,label:`Категория · ${category.name||"Без названия"}`,conflict:meta(category).conflict});
      }
      for(const goal of profile.goals||[]){
        if(meta(goal)&&meta(goal).conflict)rows.push({profileId:profile.id,entity:"goal",localId:goal.id,label:`Цель · ${goal.name||"Без названия"}`,conflict:meta(goal).conflict});
      }
      for(const tx of profile.transactions||[]){
        if(meta(tx)&&meta(tx).conflict){
          const name=tx.source||tx.categoryName||tx.type||"Операция";
          rows.push({profileId:profile.id,entity:"transaction",localId:tx.id,label:`Операция · ${name}`,conflict:meta(tx).conflict});
        }
      }
    }
    return rows;
  }

  function locate(descriptor){
    const profile=(state.profiles||[]).find(item=>String(item.id)===String(descriptor.profileId));
    if(!profile)return {profile:null,entity:null};
    if(descriptor.entity==="profile")return {profile,entity:profile};
    const collection=descriptor.entity==="category"?"categories":descriptor.entity==="goal"?"goals":"transactions";
    return {profile,entity:(profile[collection]||[]).find(item=>String(item.id)===String(descriptor.localId))||null};
  }

  function mutationIds(profile,descriptor){
    const box=root.ARISE_SYNC_OUTBOX;
    if(!box||typeof box.list!=="function"||descriptor.entity==="profile")return [];
    return box.list(profile,descriptor.entity)
      .filter(item=>String(item.entityLocalId)===String(descriptor.localId))
      .map(item=>item.id);
  }

  function acknowledgeMutations(profile,ids){
    const box=root.ARISE_SYNC_OUTBOX;
    if(!box||typeof box.ack!=="function")return;
    for(const id of ids)box.ack(profile,id);
  }

  async function keepLocal(descriptor){
    const found=locate(descriptor);
    if(!found.entity)throw new Error("Конфликтующие данные больше не найдены.");
    const current=meta(found.entity)||{};
    const conflict=current.conflict;
    if(!conflict) return {status:"already_resolved"};
    const previous={...current,conflict:{...conflict}};
    current.syncedAt=conflict.remoteUpdatedAt||current.syncedAt||new Date().toISOString();
    current.dirty=true;
    delete current.conflict;
    try{
      const result=await root.ARISE_SYNC.pushAll();
      if(result&&result.status==="conflict")throw new Error("Появился новый конфликт во время синхронизации.");
      return result||{status:"synced"};
    }catch(error){
      found.entity[META_KEY]=previous;
      throw error;
    }
  }

  async function acceptRemote(descriptor){
    const found=locate(descriptor);
    if(!found.entity)throw new Error("Конфликтующие данные больше не найдены.");
    const current=meta(found.entity)||{};
    if(!current.conflict)return {status:"already_resolved"};
    const previous={...current,conflict:{...current.conflict}};
    const pending=mutationIds(found.profile,descriptor);
    current.dirty=false;
    delete current.conflict;
    delete current.changedAt;
    try{
      const result=await root.ARISE_SYNC_PULL.pullAll();
      if(!result||result.status!=="pulled")throw new Error("Не удалось получить серверную версию.");
      const currentProfile=(state.profiles||[]).find(item=>String(item.id)===String(descriptor.profileId))||found.profile;
      acknowledgeMutations(currentProfile,pending);
      root.ARISE_SYNC_SILENT=true;
      try{saveState();}finally{root.ARISE_SYNC_SILENT=false;}
      return result;
    }catch(error){
      const retry=locate(descriptor).entity||found.entity;
      retry[META_KEY]=previous;
      throw error;
    }
  }

  function conflictTime(conflict){
    const value=conflict&&conflict.remoteUpdatedAt;
    if(!value)return "серверная версия изменилась";
    const date=new Date(value);
    return Number.isNaN(date.getTime())?"серверная версия изменилась":`сервер изменён ${date.toLocaleString("ru-RU")}`;
  }

  function showConflicts(){
    const conflicts=collectConflicts();
    if(!conflicts.length){toast("Конфликтов синхронизации нет.");return;}
    openModal(`
      <div class="kicker">СИНХРОНИЗАЦИЯ</div>
      <h2 class="title">Нужно выбрать версию</h2>
      <div class="sub" style="margin-top:7px">ARISE остановил запись, потому что эти данные изменились локально и на другом устройстве после общей синхронизации. Ничего не будет перезаписано без твоего выбора.</div>
      <div style="margin-top:18px">
        ${conflicts.map((item,index)=>`
          <div class="row" style="align-items:flex-start">
            <div class="row-left">
              <strong>${escapeHTML(item.label)}</strong>
              <div class="tiny muted" style="margin-top:4px">${escapeHTML(conflictTime(item.conflict))}</div>
            </div>
            <div class="actions" style="margin-top:0">
              <button type="button" class="btn small-btn" data-conflict-action="local" data-conflict-index="${index}">Оставить мою</button>
              <button type="button" class="btn small-btn" data-conflict-action="remote" data-conflict-index="${index}">Принять серверную</button>
            </div>
          </div>`).join("")}
      </div>
      <div class="actions"><button type="button" class="btn" id="closeSyncConflicts">Закрыть</button></div>
    `);
    document.getElementById("closeSyncConflicts").onclick=closeModal;
    document.querySelectorAll("[data-conflict-action]").forEach(button=>{
      button.onclick=async()=>{
        const item=conflicts[Number(button.dataset.conflictIndex)];
        if(!item)return;
        const action=button.dataset.conflictAction;
        button.disabled=true;
        try{
          if(action==="local")await keepLocal(item);else await acceptRemote(item);
          closeModal();
          toast(action==="local"?"Локальная версия сохранена.":"Серверная версия принята.");
          render();
          if(collectConflicts().length)showConflicts();
        }catch(error){
          button.disabled=false;
          toast(error.message||"Не удалось разрешить конфликт.");
        }
      };
    });
  }

  if(typeof previousRenderTopbar==="function"){
    root.renderTopbar=function(){
      const html=previousRenderTopbar();
      const count=collectConflicts().length;
      if(!count)return html;
      const button=`<button type="button" class="btn small-btn danger" data-sync-conflicts title="Открыть конфликты синхронизации">Конфликт${count>1?` · ${count}`:""}</button>`;
      return html.replace("</header>",button+"</header>");
    };
  }

  if(root.addEventListener){
    root.addEventListener("click",event=>{
      const button=event.target&&event.target.closest?event.target.closest("[data-sync-conflicts]"):null;
      if(button){event.preventDefault();showConflicts();}
    });
    root.addEventListener("arise:sync",event=>{
      if(event&&event.detail&&event.detail.status==="conflict"&&typeof render==="function")render();
    });
  }

  root.ARISE_SYNC_CONFLICT_UI={collectConflicts,locate,keepLocal,acceptRemote,showConflicts,mutationIds};
})(typeof globalThis!=="undefined"?globalThis:window);
