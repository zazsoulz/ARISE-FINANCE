(function(root){
  "use strict";

  const core=root.ARISE_FINANCE_CORE;
  if(!core)return;

  const baseCreateIncomeTransaction=core.createIncomeTransaction.bind(core);
  const integer=value=>Math.max(0,Math.round(Number(value)||0));
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const asArray=value=>Array.isArray(value)?value:[];
  const rid=entity=>entity&&entity.ariseSync&&entity.ariseSync.remoteId||null;

  function ruleMap(profile){
    const settings=profile&&profile.settings||(profile.settings={});
    if(!settings.goalFutureReroutes||typeof settings.goalFutureReroutes!=="object")settings.goalFutureReroutes={};
    return settings.goalFutureReroutes;
  }

  function sourceKeys(goal){return [rid(goal),goal&&goal.id].filter(Boolean).map(String);}

  function normalizeDestination(profile,value){
    const raw=String(value||"");
    if(raw==="free"||raw==="reserve")return raw;
    const [kind,id]=raw.split(":");
    if(!["category","goal"].includes(kind)||!id)return "free";
    const collection=kind==="category"?profile.categories:profile.goals;
    const target=asArray(collection).find(item=>String(item.id)===id||String(rid(item))===id);
    if(!target)return "free";
    if(kind==="category"&&target.enabled===false)return "free";
    if(kind==="goal"&&(target.status==="closed"||target.status==="completed"))return "free";
    return `${kind}:${target.id}`;
  }

  function canonicalDestination(profile,value){
    const normalized=normalizeDestination(profile,value);
    if(normalized==="free"||normalized==="reserve")return normalized;
    const [kind,id]=normalized.split(":");
    const collection=kind==="category"?profile.categories:profile.goals;
    const target=asArray(collection).find(item=>String(item.id)===id);
    return `${kind}:${rid(target)||target.id}`;
  }

  function ruleForGoal(profile,goal){
    if(!goal||goal.status!=="completed")return null;
    const map=ruleMap(profile);
    let stored=null;
    for(const key of sourceKeys(goal))if(map[key]){stored=map[key];break;}
    const destination=goal.futureDestination||stored&&stored.destination||"";
    const monthlyAmount=integer(goal.futureMonthlyAmount!=null?goal.futureMonthlyAmount:stored&&stored.monthlyAmount);
    if(!destination||monthlyAmount<=0)return null;
    return {destination:normalizeDestination(profile,destination),monthlyAmount,configuredAt:goal.futureRerouteConfiguredAt||stored&&stored.configuredAt||null};
  }

  function setRule(profile,goal,{destination,monthlyAmount,configuredAt}={}){
    if(!goal)throw new Error("Цель не найдена.");
    const amount=integer(monthlyAmount);
    if(amount<=0)throw new Error("Сумма перенаправления должна быть больше нуля.");
    const normalized=normalizeDestination(profile,destination);
    const canonical=canonicalDestination(profile,normalized);
    const timestamp=configuredAt||new Date().toISOString();
    const map=ruleMap(profile);
    for(const key of sourceKeys(goal))delete map[key];
    map[String(rid(goal)||goal.id)]={destination:canonical,monthlyAmount:amount,configuredAt:timestamp};
    goal.futureDestination=normalized;
    goal.futureMonthlyAmount=amount;
    goal.futureRerouteConfiguredAt=timestamp;
    return {destination:normalized,monthlyAmount:amount,configuredAt:timestamp};
  }

  function clearRule(profile,goal){
    const map=ruleMap(profile);
    for(const key of sourceKeys(goal))delete map[key];
    if(goal){delete goal.futureDestination;delete goal.futureMonthlyAmount;delete goal.futureRerouteConfiguredAt;}
  }

  function monthlyRerouted(transactions,date){
    const key=core.monthKey(date);const used={};
    for(const tx of asArray(transactions)){
      if(String(tx.month||core.monthKey(tx.date))!==key||tx.type!=="income")continue;
      const reroutes=asArray(tx.goalReroutes).length?tx.goalReroutes:asArray(tx.fundingBreakdown&&tx.fundingBreakdown.goalReroutes);
      for(const item of reroutes){
        const id=item.fromGoalId||item.fromGoalRemoteId;
        if(id)used[String(id)]=(used[String(id)]||0)+integer(item.amount);
      }
    }
    return used;
  }

  function categoryLimitRemaining(category,prior,current){
    if(category.limit===null||category.limit===""||typeof category.limit==="undefined")return Infinity;
    return Math.max(0,integer(category.limit)-integer(prior)-integer(current));
  }

  function planner(profile,income,date,transactions){
    const total=integer(income);
    const txs=Array.isArray(transactions)?transactions:asArray(profile&&profile.transactions);
    const prior=core.monthToDate(txs,date);
    const reroutedPrior=monthlyRerouted(txs,date);
    const rows=[];

    asArray(profile&&profile.categories).forEach((category,index)=>{
      if(!category||category.enabled===false)return;
      const used=integer(prior.categoryAllocated[category.id]||0);
      let desired=0;
      if(category.type==="fixed")desired=Math.max(0,integer(category.fixedAmount)-used);
      else if(category.type==="percentage"&&number(category.percent)>=1&&number(category.percent)<=100)desired=Math.floor(total*Math.round(number(category.percent))/100);
      else return;
      desired=Math.min(desired,categoryLimitRemaining(category,used,0));
      if(desired>0)rows.push({kind:"category",priority:number(category.priority),order:index,desired,category});
    });

    const reserve=profile&&profile.settings&&profile.settings.reserve;
    if(reserve&&reserve.enabled){
      const cap=reserve.limit===null||reserve.limit===""||typeof reserve.limit==="undefined"?Infinity:Math.max(0,integer(reserve.limit)-integer(prior.reserve));
      const desired=Math.min(Math.floor(total*Math.max(0,number(reserve.percent))/100),cap);
      if(desired>0)rows.push({kind:"reserve",priority:number(reserve.priority??3),order:10000,desired});
    }

    asArray(profile&&profile.goals).forEach((goal,index)=>{
      if(!goal)return;
      const reroute=ruleForGoal(profile,goal);
      if(goal.status==="completed"&&reroute){
        const priorAmount=Math.max(integer(reroutedPrior[String(goal.id)]||0),integer(reroutedPrior[String(rid(goal))]||0));
        const desired=Math.max(0,reroute.monthlyAmount-priorAmount);
        if(desired>0)rows.push({kind:"goal_reroute",priority:number(goal.priority),order:19000+index,desired,goal,reroute});
        return;
      }
      if(goal.status==="completed"||goal.status==="closed"||goal.autoAllocate===false)return;
      const remaining=core.goalRemaining(profile,goal);
      if(remaining<=0)return;
      const monthlyNeed=core.goalMonthlyNeed(profile,goal,date);
      const used=integer(prior.goalAllocated[goal.id]||0);
      const desired=Math.max(0,Math.min(remaining,monthlyNeed-used));
      if(desired>0)rows.push({kind:"goal",priority:number(goal.priority),order:20000+index,desired,goal,deadlineMonths:(()=>{const d=core.goalDeadlineStatus(profile,goal,date);return d.months;})()});
    });

    rows.sort((a,b)=>b.priority-a.priority||((a.kind==="goal"?a.deadlineMonths:Infinity)-(b.kind==="goal"?b.deadlineMonths:Infinity))||a.order-b.order);

    const allocations=[];const goalAllocations=[];const goalReroutes=[];
    const currentCategory={};const currentGoal={};
    let reserveAmount=0;let heldFree=0;let available=total;

    for(const row of rows){
      if(available<=0)break;
      if(row.kind==="goal_reroute"){
        const totalAmount=Math.min(available,integer(row.desired));
        if(totalAmount<=0)continue;
        const destination=row.reroute.destination;
        let applied=0;
        if(destination.startsWith("category:")){
          const targetId=destination.slice(9);
          const category=asArray(profile.categories).find(item=>String(item.id)===targetId);
          if(category&&category.enabled!==false){
            const cap=categoryLimitRemaining(category,prior.categoryAllocated[category.id]||0,currentCategory[category.id]||0);
            applied=Math.min(totalAmount,cap);
            if(applied>0){allocations.push({categoryId:category.id,name:category.name,amount:applied,percent:0,fixed:false,reroutedFromGoalId:row.goal.id});currentCategory[category.id]=(currentCategory[category.id]||0)+applied;}
          }
        }else if(destination.startsWith("goal:")){
          const targetId=destination.slice(5);
          const target=asArray(profile.goals).find(item=>String(item.id)===targetId);
          if(target&&target.status!=="closed"&&target.status!=="completed"){
            const cap=Math.max(0,core.goalRemaining(profile,target)-integer(currentGoal[target.id]||0));
            applied=Math.min(totalAmount,cap);
            if(applied>0){goalAllocations.push({goalId:target.id,name:target.name||"Цель",amount:applied,priority:integer(target.priority||3),deadline:target.deadline||"",reroutedFromGoalId:row.goal.id});currentGoal[target.id]=(currentGoal[target.id]||0)+applied;}
          }
        }else if(destination==="reserve"&&reserve&&reserve.enabled){
          const cap=reserve.limit===null||reserve.limit===""||typeof reserve.limit==="undefined"?Infinity:Math.max(0,integer(reserve.limit)-integer(prior.reserve)-reserveAmount);
          applied=Math.min(totalAmount,cap);reserveAmount+=applied;
        }
        const fallback=totalAmount-applied;
        heldFree+=fallback;
        goalReroutes.push({fromGoalId:row.goal.id,fromGoalRemoteId:rid(row.goal)||null,destination,amount:totalAmount,appliedAmount:applied,fallbackAmount:fallback});
        available-=totalAmount;
        continue;
      }

      if(row.kind==="category"){
        const category=row.category;
        const already=currentCategory[category.id]||0;
        let cap=categoryLimitRemaining(category,prior.categoryAllocated[category.id]||0,already);
        if(category.type==="fixed")cap=Math.min(cap,Math.max(0,integer(category.fixedAmount)-integer(prior.categoryAllocated[category.id]||0)-already));
        const amount=Math.min(available,integer(row.desired),cap);
        if(amount>0){allocations.push({categoryId:category.id,name:category.name,amount,percent:category.type==="percentage"?integer(category.percent):0,fixed:category.type==="fixed"});currentCategory[category.id]=already+amount;available-=amount;}
        continue;
      }

      if(row.kind==="reserve"){
        const cap=reserve&&reserve.limit!==null&&reserve.limit!==""&&typeof reserve.limit!=="undefined"?Math.max(0,integer(reserve.limit)-integer(prior.reserve)-reserveAmount):Infinity;
        const amount=Math.min(available,integer(row.desired),cap);
        if(amount>0){reserveAmount+=amount;available-=amount;}
        continue;
      }

      if(row.kind==="goal"){
        const already=currentGoal[row.goal.id]||0;
        const monthlyCap=Math.max(0,core.goalMonthlyNeed(profile,row.goal,date)-integer(prior.goalAllocated[row.goal.id]||0)-already);
        const goalCap=Math.max(0,core.goalRemaining(profile,row.goal)-already);
        const amount=Math.min(available,integer(row.desired),monthlyCap,goalCap);
        if(amount>0){goalAllocations.push({goalId:row.goal.id,name:row.goal.name||"Цель",amount,priority:integer(row.goal.priority||3),deadline:row.goal.deadline||""});currentGoal[row.goal.id]=already+amount;available-=amount;}
      }
    }

    const remainder=available+heldFree;
    return {valid:true,total,allocations,goalAllocations,reserve:reserveAmount,remainder,distributed:total-remainder,date,month:prior.key,goalReroutes};
  }

  function createIncomeTransaction(data){
    const tx=baseCreateIncomeTransaction(data);
    tx.goalReroutes=asArray(data&&data.goalReroutes).map(item=>({...item,amount:integer(item.amount),appliedAmount:integer(item.appliedAmount),fallbackAmount:integer(item.fallbackAmount)}));
    tx.fundingBreakdown={...(data&&data.fundingBreakdown||{}),goalReroutes:tx.goalReroutes.map(item=>({...item}))};
    return tx;
  }

  core.planIncome=planner;
  core.simulateIncome=planner;
  core.createIncomeTransaction=createIncomeTransaction;
  core.goalFutureRuleMap=ruleMap;
  core.goalFutureRule=ruleForGoal;
  core.setGoalFutureRule=setRule;
  core.clearGoalFutureRule=clearRule;
  core.goalFutureMonthlyRerouted=monthlyRerouted;
})(typeof globalThis!=="undefined"?globalThis:window);
