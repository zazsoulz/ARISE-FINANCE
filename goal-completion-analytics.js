(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.ARISE_GOAL_COMPLETION_ANALYTICS=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const history=root&&root.ARISE_GOAL_HISTORY||(typeof require!=="undefined"?require('./goal-history.js'):null);
  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const dateOnly=value=>String(value||"").slice(0,10);

  function completedGoal(profile,goal){
    if(!goal||goal.status!=="completed"||!history)return null;
    const info=history.analyzeGoal(profile,goal);
    return {
      id:goal.id,
      name:goal.name||"Цель",
      target:safe(goal.target),
      completedAt:dateOnly(goal.completedAt),
      createdAt:info.createdAt||dateOnly(goal.createdAt),
      actualMonths:info.actualMonths,
      initialForecastMonths:info.initialForecastMonths,
      forecastDifference:info.forecastDifference,
      contributed:info.contributed,
      withdrawn:info.withdrawn,
      contributionCount:info.contributionCount,
      averageMonthly:info.averageMonthly,
      completionMethod:"target_reached"
    };
  }

  function summary(profile){
    const goals=(profile&&profile.goals||[])
      .map(goal=>completedGoal(profile,goal))
      .filter(Boolean)
      .sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
    const withDuration=goals.filter(goal=>Number.isFinite(goal.actualMonths));
    const withForecast=goals.filter(goal=>Number.isFinite(goal.forecastDifference));
    const averageActualMonths=withDuration.length
      ?withDuration.reduce((sum,goal)=>sum+goal.actualMonths,0)/withDuration.length
      :null;
    return {
      total:goals.length,
      totalContributed:goals.reduce((sum,goal)=>sum+safe(goal.contributed),0),
      averageActualMonths,
      ahead:withForecast.filter(goal=>goal.forecastDifference<0).length,
      onForecast:withForecast.filter(goal=>goal.forecastDifference===0).length,
      behind:withForecast.filter(goal=>goal.forecastDifference>0).length,
      goals
    };
  }

  return {completedGoal,summary};
});
