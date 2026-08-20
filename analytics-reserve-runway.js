(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  const reserveAnalytics=root.ARISE_RESERVE_ANALYTICS;
  const essential=root.ARISE_RESERVE_ESSENTIAL_SPEND;
  if(!core||!reserveAnalytics||!essential)return;

  const previousRenderAnalytics=root.renderAnalytics;
  if(typeof previousRenderAnalytics!=="function")return;

  const safe=value=>Math.max(0,Math.round(Number(value)||0));

  function reserveSettings(profile){
    return profile&&profile.settings&&profile.settings.reserve||{};
  }

  function reserveTarget(profile){
    const settings=reserveSettings(profile);
    return safe(settings.targetBalance||settings.target||0);
  }

  function runwayModel(profile){
    const settings=reserveSettings(profile);
    const configured=safe(settings.monthlyEssentialSpend);
    const categoryIds=essential.normalizeIds(settings.essentialCategoryIds||[]);
    const categoryModel=essential.averageEssentialSpend(profile,{categoryIds,months:3});
    const monthly=configured||categoryModel.monthlyAverage||0;
    const model=reserveAnalytics.reserveRunway({
      reserveBalance:core.reserveBalance(profile),
      monthlyEssentialSpend:monthly
    });

    return {
      ...model,
      source:configured?"configured":categoryModel.status==="ok"&&monthly>0?"essential_categories":"none",
      categoryEstimate:categoryModel.monthlyAverage||0,
      categoryModel
    };
  }

  function reserveCard(){
    return [...document.querySelectorAll(".analytics-card")].find(card=>
      [...card.querySelectorAll(".analytics-label")].some(label=>label.textContent.trim()==="Резерв")
    )||null;
  }

  function applyReserveAnalyticsModel(profile){
    const card=reserveCard();
    if(!card)return;

    const balance=safe(core.reserveBalance(profile));
    const target=reserveTarget(profile);
    const progress=reserveAnalytics.reserveProgress({reserveBalance:balance,targetBalance:target});
    const runway=runwayModel(profile);
    const months=runway.status==="ok"?runway.months:null;

    const headline=card.querySelector(".analytics-section-title > span");
    if(headline){
      headline.textContent=target>0?`${Math.round(progress.percent||0)}% цели`:"без цели";
    }

    const orbit=card.querySelector(".analytics-reserve-orbit");
    if(orbit){
      const orbitProgress=target>0
        ?Math.min(100,Math.round(progress.percent||0))
        :Math.min(100,months?months/6*100:0);
      orbit.style.setProperty("--p",String(orbitProgress));
    }

    const runwayText=card.querySelector(".analytics-reserve-center span");
    if(runwayText){
      runwayText.textContent=months==null
        ?"нужны обязательные расходы"
        :`≈ ${months.toLocaleString("ru-RU",{maximumFractionDigits:1})} мес. защиты`;
    }

    const note=card.querySelector(".analytics-note");
    if(note){
      if(runway.source==="configured"){
        note.textContent=`Runway рассчитан по заданным обязательным расходам ${money(runway.monthlyEssentialSpend)}/мес.`;
      }else if(runway.source==="essential_categories"){
        note.textContent=`Runway рассчитан по среднему факту выбранных обязательных категорий: ${money(runway.categoryEstimate)}/мес.`;
      }else if((reserveSettings(profile).essentialCategoryIds||[]).length){
        note.textContent="По выбранным обязательным категориям пока недостаточно истории для расчёта runway.";
      }else{
        note.textContent="Выбери обязательные категории или задай месячную сумму в настройках подушки. ARISE не считает все расходы обязательными автоматически.";
      }
    }
  }

  root.renderAnalytics=function(){
    const result=previousRenderAnalytics();
    applyReserveAnalyticsModel(activeProfile());
    return result;
  };

  root.ARISE_ANALYTICS_RESERVE_RUNWAY={reserveTarget,runwayModel,applyReserveAnalyticsModel};
})(typeof globalThis!=="undefined"?globalThis:window);
