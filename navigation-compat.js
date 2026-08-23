(function(root){
  "use strict";

  function bindNav(){
    document
      .querySelectorAll("[data-page]")
      .forEach(button=>{
        button.onclick=()=>{
          activePage=button.dataset.page;
          render();
        };
      });
  }

  function profileSwitcher(){
    const profile=activeProfile();
    if(state.profiles.length<=1) return "";
    return `
      <div class="profile-switch">
        <span class="small muted">Профиль</span>
        <select id="profileSwitch">
          ${state.profiles.map(p=>`
            <option value="${p.id}" ${p.id===profile.id?"selected":""}>
              ${escapeHTML(p.name)}
            </option>`).join("")}
        </select>
      </div>`;
  }

  function bindProfileSwitcher(){
    const select=document.getElementById("profileSwitch");
    if(!select) return;
    select.onchange=()=>switchProfile(select.value);
  }

  root.bindNav=bindNav;
  root.profileSwitcher=profileSwitcher;
  root.bindProfileSwitcher=bindProfileSwitcher;
  root.ARISE_NAVIGATION_COMPAT={bindNav,profileSwitcher,bindProfileSwitcher};
})(typeof globalThis!=="undefined"?globalThis:window);
