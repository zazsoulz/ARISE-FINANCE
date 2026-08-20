const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function boot(){
  const profile={
    settings:{currency:'RUB',reserve:{targetBalance:100000}},
    goals:[{id:'trip',name:'Поездка',target:120000,deadline:'2026-12-31',monthlyContribution:30000}],
    transactions:[]
  };
  const ctx={
    console,globalThis:null,window:null,
    ARISE_FINANCE_CORE:{
      goalBalance:()=>20000,
      reserveBalance:()=>30000,
      goalDeadlineStatus:()=>({months:4}),
      validatePlan:plan=>{
        const allocated=(plan.allocations||[]).reduce((s,a)=>s+Number(a.amount||0),0)+(plan.goalAllocations||[]).reduce((s,a)=>s+Number(a.amount||0),0)+Number(plan.reserve||0);
        return {valid:allocated<=plan.total,remainder:Math.max(0,plan.total-allocated),difference:plan.total-allocated};
      }
    },
    ARISE_RESERVE_ANALYTICS:{
      reserveProgress:({reserveBalance,targetBalance})=>{
        const balance=Math.max(0,Math.round(Number(reserveBalance)||0));
        const target=Math.max(0,Math.round(Number(targetBalance)||0));
        if(!target)return {status:'no_target',remaining:null,percent:null};
        return {status:'ok',remaining:Math.max(0,target-balance),percent:Math.min(100,balance/target*100)};
      }
    },
    activeProfile:()=>profile,
    updateIncomePlanUI:()=>{},
    readIncomePlanFromUI:()=>({allocations:[],goalAllocations:[],reserve:0}),
    today:()=> '2026-08-20',
    money:v=>`${Math.round(Number(v)||0)} ₽`,
    escapeHTML:v=>String(v??''),
    document:{getElementById:()=>null}
  };
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('income-plan-consequences.js','utf8'),ctx,{filename:'income-plan-consequences.js'});
  return {ctx,profile};
}

test('reducing a goal contribution explains the new required deadline pace',()=>{
  const {ctx}=boot();
  const rows=ctx.ARISE_INCOME_PLAN_CONSEQUENCES.consequences({
    total:100000,baseCurrency:'RUB',date:'2026-08-20',remainder:30000,reserve:10000,allocations:[],goalAllocations:[{goalId:'trip',amount:60000}]
  },{allocations:[],goalAllocations:[{goalId:'trip',amount:20000}],reserve:10000});
  assert.ok(rows.some(row=>row.includes('Цель «Поездка»')&&row.includes('−40000 ₽')));
  assert.ok(rows.some(row=>row.includes('требуемый средний темп')&&row.includes('10000 ₽/мес. → 20000 ₽/мес.')));
});

test('reserve and unallocated changes are explained without mutating the plan',()=>{
  const {ctx}=boot();
  const plan={total:100000,baseCurrency:'RUB',date:'2026-08-20',remainder:10000,reserve:20000,allocations:[{categoryId:'life',name:'Жизнь',amount:50000}],goalAllocations:[{goalId:'trip',amount:20000}]};
  const edited={allocations:[{categoryId:'life',name:'Жизнь',amount:40000}],goalAllocations:[{goalId:'trip',amount:20000}],reserve:10000};
  const rows=ctx.ARISE_INCOME_PLAN_CONSEQUENCES.consequences(plan,edited);
  assert.ok(rows.some(row=>row.includes('Категория «Жизнь»')&&row.includes('−10000 ₽')));
  assert.ok(rows.some(row=>row.includes('Финансовая подушка')&&row.includes('−10000 ₽')));
  assert.ok(rows.some(row=>row.includes('Прогресс подушки после этого дохода')&&row.includes('50% → 40%')&&row.includes('50000 ₽ → 60000 ₽')));
  assert.ok(rows.some(row=>row.includes('Нераспределённый остаток')&&row.includes('10000 ₽ → 30000 ₽')));
  assert.equal(plan.reserve,20000);
  assert.equal(plan.allocations[0].amount,50000);
});

test('reserve target consequence is omitted when no reserve target is configured',()=>{
  const {ctx,profile}=boot();
  profile.settings.reserve.targetBalance=0;
  const rows=ctx.ARISE_INCOME_PLAN_CONSEQUENCES.consequences({
    total:50000,baseCurrency:'RUB',date:'2026-08-20',remainder:30000,reserve:20000,allocations:[],goalAllocations:[]
  },{allocations:[],goalAllocations:[],reserve:10000});
  assert.equal(rows.some(row=>row.includes('Прогресс подушки после этого дохода')),false);
});
