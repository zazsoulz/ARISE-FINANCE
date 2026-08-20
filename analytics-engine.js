(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_ANALYTICS=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const core=root&&root.ARISE_FINANCE_CORE||(typeof require!=="undefined"?require('./financial-core.js'):null);
  const reserveAnalytics=root&&root.ARISE_RESERVE_ANALYTICS||(typeof require!=="undefined"?require('./reserve-analytics.js'):null);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const monthKey=value=>{
    if(typeof value==='string'&&/^\d{4}-\d{2}/.test(value))return value.slice(0,7);
    const d=new Date(value||Date.now());if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const monthIndex=key=>{const match=/^(\d{4})-(\d{2})$/.exec(String(key||''));return match?Number(match[1])*12+Number(match[2])-1:null;};
  const monthFromIndex=index=>`${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`;

  function transactionMonths(profile){return [...new Set((profile&&profile.transactions||[]).map(tx=>monthKey(tx.month||tx.date)).filter(Boolean))].sort();}
  function months(profile,{through=null}={}){
    const actual=transactionMonths(profile);
    const requestedEnd=monthKey(through||new Date());
    if(!actual.length)return requestedEnd?[requestedEnd]:[];
    const start=monthIndex(actual[0]);
    const latest=monthIndex(actual[actual.length-1]);
    const requested=monthIndex(requestedEnd);
    const end=Math.max(latest,requested==null?latest:requested);
    if(start==null||end==null)return actual;
    const result=[];
    for(let index=start;index<=end&&result.length<240;index++)result.push(monthFromIndex(index));
    return result;
  }
  function categoryName(profile,id){const found=(profile&&profile.categories||[]).find(item=>String(item.id)===String(id));return found&&found.name||'Без категории';}
  function sourceName(tx){return String(tx&&tx.source||'Источник не указан').trim()||'Источник не указан';}
  function expenseName(tx){return String(tx&&tx.categoryName||(!tx||!tx.categoryId?'Не распределено':'Без категории')).trim()||'Без категории';}

  function monthly(profile,key){
    if(!core)throw new Error('Financial core is required.');
    const stats=core.monthStats(profile,key);
    const txs=(profile.transactions||[]).filter(tx=>monthKey(tx.month||tx.date)===key);
    const incomeSources={};
    const expenseGroups={};
    for(const tx of txs){
      if(tx.type==='income'){
        const source=sourceName(tx);incomeSources[source]=(incomeSources[source]||0)+Math.max(0,num(tx.amount));
      }else if(tx.type==='expense'){
        const name=expenseName(tx);expenseGroups[name]=(expenseGroups[name]||0)+Math.max(0,num(tx.amount));
      }
    }
    const categorySpent={};
    for(const [id,value] of Object.entries(stats.categorySpent||{})){
      const name=categoryName(profile,id);categorySpent[name]=(categorySpent[name]||0)+Math.max(0,num(value));
    }
    return {
      month:key,income:Math.max(0,num(stats.income)),expenses:Math.max(0,num(stats.expenses)),savedToReserve:Math.max(0,num(stats.reserve)),reserveWithdrawn:Math.max(0,num(stats.reserveWithdrawn)),freeEnd:Math.max(0,num(stats.free)),uncontrolled:Math.max(0,num(stats.uncontrolled)),operations:Math.max(0,num(stats.operationCount)),
      incomeCount:txs.filter(tx=>tx.type==='income').length,expenseCount:txs.filter(tx=>tx.type==='expense').length,incomeSources,expenseGroups,categorySpent,goalAllocated:{...(stats.goalAllocated||{})}
    };
  }

  function delta(current,previous){const now=num(current),before=num(previous),difference=now-before;return {current:now,previous:before,difference,percent:before===0?(now===0?0:null):difference/before*100};}
  function compare(profile,currentMonth,previousMonth){
    const current=monthly(profile,currentMonth),previous=monthly(profile,previousMonth);
    return {current,previous,income:delta(current.income,previous.income),expenses:delta(current.expenses,previous.expenses),reserve:delta(current.savedToReserve,previous.savedToReserve),free:delta(current.freeEnd,previous.freeEnd),uncontrolled:delta(current.uncontrolled,previous.uncontrolled)};
  }
  function series(profile,limit=12){const keys=months(profile).slice(-Math.max(1,Math.round(limit)||12));return keys.map(key=>monthly(profile,key));}
  function composition(map){
    const entries=Object.entries(map||{}).map(([name,value])=>[name,Math.max(0,num(value))]);
    const total=entries.reduce((sum,[,value])=>sum+value,0);
    return entries.map(([name,value])=>({name,value,share:total>0?value/total:0,total})).sort((a,b)=>b.value-a.value);
  }
  function incomeSources(profile,{month=null}={}){
    if(month)return composition(monthly(profile,month).incomeSources).map(item=>({...item,count:(profile.transactions||[]).filter(tx=>tx.type==='income'&&monthKey(tx.month||tx.date)===month).length}));
    const totals={};let count=0;
    for(const tx of profile&&profile.transactions||[]){if(tx.type!=='income')continue;const value=Math.max(0,num(tx.amount)),source=sourceName(tx);totals[source]=(totals[source]||0)+value;count++;}
    return composition(totals).map(item=>({...item,count}));
  }
  function expenseComposition(profile,{month=null}={}){
    if(month)return composition(monthly(profile,month).expenseGroups);
    const totals={};for(const tx of profile&&profile.transactions||[]){if(tx.type!=='expense')continue;const name=expenseName(tx);totals[name]=(totals[name]||0)+Math.max(0,num(tx.amount));}
    return composition(totals);
  }
  function goals(profile,date=new Date()){
    if(!core)return [];
    return (profile&&profile.goals||[]).map(goal=>{const balance=core.goalBalance(profile,goal),remaining=core.goalRemaining(profile,goal),projection=core.goalProjection(profile,goal,date);return {id:goal.id,name:goal.name,status:goal.status||'active',target:Math.max(0,num(goal.target)),balance,remaining,priority:num(goal.priority),deadline:goal.deadline||'',projection};});
  }
  function reserve(profile,{essentialMonthlySpend=0}={}){
    if(!core)return null;
    const balance=core.reserveBalance(profile),target=Math.max(0,num(profile&&profile.settings&&profile.settings.reserve&&profile.settings.reserve.target));
    return {balance,target,progress:reserveAnalytics?reserveAnalytics.reserveProgress({reserveBalance:balance,targetBalance:target}):null,runway:reserveAnalytics?reserveAnalytics.reserveRunway({reserveBalance:balance,monthlyEssentialSpend:essentialMonthlySpend}):null};
  }
  function lifetime(profile){
    const keys=months(profile),rows=keys.map(key=>monthly(profile,key));
    const incomes=(profile&&profile.transactions||[]).filter(tx=>tx.type==='income').map(tx=>Math.max(0,num(tx.amount)));
    const expenses=(profile&&profile.transactions||[]).filter(tx=>tx.type==='expense').map(tx=>Math.max(0,num(tx.amount)));
    const sum=arr=>arr.reduce((a,b)=>a+b,0);
    return {months:keys.length,totalIncome:sum(incomes),totalExpenses:sum(expenses),incomeTransactions:incomes.length,expenseTransactions:expenses.length,averageMonthlyIncome:rows.length?sum(rows.map(row=>row.income))/rows.length:0,averageMonthlyExpenses:rows.length?sum(rows.map(row=>row.expenses))/rows.length:0,maxIncome:incomes.length?Math.max(...incomes):0,minIncome:incomes.length?Math.min(...incomes):0};
  }

  return {monthKey,monthIndex,monthFromIndex,transactionMonths,months,monthly,delta,compare,series,composition,incomeSources,expenseComposition,goals,reserve,lifetime};
});
