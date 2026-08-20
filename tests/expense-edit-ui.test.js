const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><div id="sheet"></div>');
  const profile={
    settings:{currency:'RUB'},
    categories:[],
    transactions:[
      {id:'income-1',type:'income',amount:20000,remainder:20000,date:'2026-08-01',month:'2026-08'},
      {id:'expense-1',type:'expense',amount:20000,originalAmount:20000,originalCurrency:'RUB',baseAmount:20000,baseCurrency:'RUB',currency:'RUB',date:'2026-08-10',month:'2026-08',controlledAmount:20000,uncontrolledAmount:0,categoryId:null,source:'Старый расход',note:'',createdAt:'2026-08-10T10:00:00.000Z'}
    ]
  };
  const availableUnallocated=p=>Math.max(0,(p.transactions||[]).filter(tx=>tx.type==='income').reduce((s,tx)=>s+Number(tx.remainder||0),0)-(p.transactions||[]).filter(tx=>tx.type==='expense').reduce((s,tx)=>s+Math.min(Number(tx.amount||0),20000),0));
  const fundingApi={expenseFunding(p,{amount,categoryId}){const total=Math.max(0,Math.round(Number(amount)||0));const available=availableUnallocated(p);const controlled=Math.min(total,available);const uncontrolled=total-controlled;return {fundingSource:categoryId?'category':'unallocated',fundingSourceId:categoryId||null,controlledAmount:controlled,categoryControlledAmount:0,unallocatedControlledAmount:controlled,uncontrolledAmount:uncontrolled,fundingBreakdown:{category:0,unallocated:controlled,uncontrolled}};}};
  const ctx={
    console,document:dom.window.document,window:null,globalThis:null,
    ARISE_EXPENSE_FUNDING:fundingApi,
    ARISE_CURRENCY_RUNTIME:{planSnapshot:(p,amount,currency)=>({conversionPending:false,originalAmount:Number(amount),originalCurrency:currency||'RUB',baseAmount:Number(amount),baseCurrency:'RUB',exchangeRateToBase:1,fxSource:'identity',fxFetchedAt:null})},
    activeProfile:()=>profile,today:()=> '2026-08-20',monthKey:value=>String(value).slice(0,7),money:(v,c='RUB')=>`${v} ${c}`,escapeHTML:v=>String(v??''),toast:()=>{},render:()=>{},saveState:()=>{},closeModal:()=>{},openModal:html=>{dom.window.document.getElementById('sheet').innerHTML=html;},activeMonth:'2026-08'
  };
  ctx.window=ctx;ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('expense-edit-ui.js','utf8'),ctx,{filename:'expense-edit-ui.js'});
  return {ctx,dom,profile};
}

function fill(dom,{amount=30000}){
  const document=dom.window.document;
  const amountInput=document.getElementById('editExpenseAmount');
  amountInput.value=String(amount);
  document.getElementById('editExpenseCurrency').value='RUB';
  document.getElementById('editExpenseDate').value='2026-08-10';
  document.getElementById('editExpenseCategory').value='';
  document.getElementById('editExpenseSource').value='Исправленный расход';
  document.getElementById('editExpenseNote').value='Проверено';
  amountInput.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
}

test('expense edit reconciliation restores the original expense before recomputing balances',()=>{
  const {ctx,profile}=boot();
  const tx=profile.transactions.find(item=>item.id==='expense-1');
  const funding=ctx.ARISE_EXPENSE_EDIT.editFunding(profile,tx,{amount:30000,date:'2026-08-10',categoryId:null});
  assert.equal(funding.controlledAmount,20000);
  assert.equal(funding.uncontrolledAmount,10000);
});

test('editing into an uncontrolled expense requires explicit acceptance and preserves transaction identity',()=>{
  const {ctx,dom,profile}=boot();
  const tx=profile.transactions.find(item=>item.id==='expense-1');
  const originalCreatedAt=tx.createdAt;
  ctx.ARISE_EXPENSE_EDIT.showExpenseEditModal(tx.id);
  fill(dom,{amount:30000});
  assert.throws(()=>ctx.ARISE_EXPENSE_EDIT.applyEdit(profile,tx),/Подтверди неконтролируемую часть/);
  const accept=dom.window.document.getElementById('acceptExpenseEditUncontrolled');
  assert.ok(accept);accept.checked=true;
  ctx.ARISE_EXPENSE_EDIT.applyEdit(profile,tx);
  assert.equal(tx.id,'expense-1');
  assert.equal(tx.createdAt,originalCreatedAt);
  assert.equal(tx.amount,30000);
  assert.equal(tx.controlledAmount,20000);
  assert.equal(tx.uncontrolledAmount,10000);
  assert.equal(tx.reconciliationStatus,'accepted_uncontrolled');
  assert.equal(tx.fundingBreakdown.acceptedUncontrolled,10000);
});

test('editing back into controlled range resolves reconciliation and clears stale acceptance metadata',()=>{
  const {ctx,dom,profile}=boot();
  const tx=profile.transactions.find(item=>item.id==='expense-1');
  tx.reconciliationStatus='accepted_uncontrolled';
  tx.reconciliationAcceptedAt='2026-08-10T10:30:00.000Z';
  tx.fundingBreakdown={acceptedUncontrolled:10000};
  ctx.ARISE_EXPENSE_EDIT.showExpenseEditModal(tx.id);
  fill(dom,{amount:15000});
  ctx.ARISE_EXPENSE_EDIT.applyEdit(profile,tx);
  assert.equal(tx.controlledAmount,15000);
  assert.equal(tx.uncontrolledAmount,0);
  assert.equal(tx.reconciliationStatus,'resolved');
  assert.equal(tx.reconciliationAcceptedAt,undefined);
  assert.equal(tx.fundingBreakdown.acceptedUncontrolled,undefined);
});
