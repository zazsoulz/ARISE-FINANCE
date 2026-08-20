(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.ARISE_GOAL_HISTORY=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const safe=value=>Math.max(0,Math.round(Number(value)||0));
  const arr=value=>Array.isArray(value)?value:[];
  const dateOnly=value=>String(value||"").slice(0,10);
  const monthKey=value=>dateOnly(value).slice(0,7);

  function addMonths(dateString,months){
    if(!dateString||!Number.isFinite(Number(months)))return "";
    const d=new Date(`${dateOnly(dateString)}T12:00:00`);
    if(Number.isNaN(d.getTime()))return "";
    d.setMonth(d.getMonth()+Math.max(0,Math.round(Number(months))));
    return d.toISOString().slice(0,10);
  }

  function initialSnapshot(data){
    const target=safe(data&&data.target);
    const current=safe(data&&data.current);
    const monthly=safe(data&&data.monthlyContribution);
    const remaining=Math.max(0,target-current);
    const forecastMonths=remaining===0?0:(monthly>0?Math.ceil(remaining/monthly):null);
    const createdAt=dateOnly(data&&data.createdAt)||new Date().toISOString().slice(0,10);
    return {
      initialTarget:target,
      initialBalance:current,
      initialMonthlyContribution:monthly,
      initialDeadline:dateOnly(data&&data.deadline),
      initialForecastMonths:forecastMonths,
      initialForecastDate:forecastMonths===null?"":addMonths(createdAt,forecastMonths)
    };
  }

  function eventRows(profile,goal){
    const rows=[];
    const goalId=String(goal&&goal.id||"");
    const start=safe(Number.isFinite(Number(goal&&goal.ledgerStart))?goal.ledgerStart:goal&&goal.current);
    if(start>0)rows.push({type:"initial",date:dateOnly(goal.createdAt),amount:start,direction:1,label:"Стартовый баланс"});

    for(const tx of arr(profile&&profile.transactions)){
      const date=dateOnly(tx.date||tx.createdAt);
      if(tx.type==="income"){
        for(const allocation of arr(tx.goalAllocations)){
          if(String(allocation.goalId)!==goalId)continue;
          rows.push({type:"income_allocation",date,amount:safe(allocation.amount),direction:1,label:tx.source?`Распределение дохода · ${tx.source}`:"Распределение дохода",transactionId:tx.id});
        }
      }else if(tx.type==="goal_contribution"&&String(tx.goalId)===goalId){
        rows.push({type:"contribution",date,amount:safe(tx.amount),direction:1,label:tx.sourceAccount==="goal"?"Перевод из другой цели":tx.sourceAccount==="reserve"?"Пополнение из резерва":"Ручное пополнение",transactionId:tx.id});
      }else if(tx.type==="goal_withdrawal"&&String(tx.goalId)===goalId){
        rows.push({type:"withdrawal",date,amount:safe(tx.amount),direction:-1,label:"Вывод из цели",transactionId:tx.id});
      }
    }
    return rows.filter(row=>row.amount>0).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }

  function monthDistance(start,end){
    if(!start||!end)return null;
    const a=new Date(`${dateOnly(start)}T12:00:00`),b=new Date(`${dateOnly(end)}T12:00:00`);
    if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return null;
    const months=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
    return Math.max(1,months+1);
  }

  function analyzeGoal(profile,goal){
    const events=eventRows(profile,goal);
    const contributed=events.filter(e=>e.direction>0).reduce((s,e)=>s+e.amount,0);
    const withdrawn=events.filter(e=>e.direction<0).reduce((s,e)=>s+e.amount,0);
    const net=Math.max(0,contributed-withdrawn);
    const contributionEvents=events.filter(e=>e.direction>0&&e.type!=="initial");
    const months=new Set(contributionEvents.map(e=>monthKey(e.date)).filter(Boolean));
    const averageMonthly=months.size?Math.round(contributionEvents.reduce((s,e)=>s+e.amount,0)/months.size):0;
    const createdAt=dateOnly(goal&&goal.createdAt);
    const completedAt=dateOnly(goal&&goal.completedAt||goal&&goal.closedAt);
    const actualMonths=completedAt?monthDistance(createdAt,completedAt):null;
    const initialForecastMonths=Number.isFinite(Number(goal&&goal.initialForecastMonths))?Math.max(0,Math.round(Number(goal.initialForecastMonths))):null;
    const forecastDifference=initialForecastMonths!==null&&actualMonths!==null?actualMonths-initialForecastMonths:null;
    return {
      events,contributed,withdrawn,net,
      contributionCount:contributionEvents.length,
      contributionMonths:months.size,
      averageMonthly,
      createdAt,completedAt,actualMonths,
      initialForecastMonths,
      initialForecastDate:dateOnly(goal&&goal.initialForecastDate),
      forecastDifference
    };
  }

  if(root&&typeof root.createGoal==="function"){
    const baseCreateGoal=root.createGoal;
    root.createGoal=function(data){
      const goal=baseCreateGoal(data);
      const snapshot=initialSnapshot({...data,createdAt:goal.createdAt});
      for(const [key,value] of Object.entries(snapshot))if(typeof goal[key]==="undefined")goal[key]=value;
      return goal;
    };
  }

  return {initialSnapshot,eventRows,analyzeGoal,monthDistance,addMonths};
});
