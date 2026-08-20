const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(){
  const dom=new JSDOM('<!doctype html><body><section id="reserveLifecycle"><div class="row"></div><div class="row"></div></section></body>');
  const profile={
    settings:{currency:'RUB'},
    transactions:[
      {id:'old',type:'reserve_deposit',amount:10000,currency:'RUB',date:'2026-08-18',source:'Доход'},
      {id:'new',type:'reserve_withdrawal',amount:4000,currency:'RUB',date:'2026-08-20',note:'Непредвиденный расход',fundingBreakdown:{transfer:{sourceAccount:'reserve',destinationAccount:'unallocated'}}}
    ]
  };
  let modal='';
  let closed=false;
  const ctx={
    console,globalThis:null,window:null,document:dom.window.document,
    renderSettings:()=>{},activeProfile:()=>profile,
    escapeHTML:value=>String(value??''),money:(value,currency)=>`${value} ${currency||'RUB'}`,formatDate:value=>value,
    openModal:html=>{modal=html;dom.window.document.body.insertAdjacentHTML('beforeend',html);},
    closeModal:()=>{closed=true;}
  };
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('reserve-history-drilldown.js','utf8'),ctx,{filename:'reserve-history-drilldown.js'});
  return {ctx,dom,profile,getModal:()=>modal,isClosed:()=>closed};
}

test('reserve rows bind newest transaction first and are keyboard accessible',()=>{
  const {ctx,dom,profile}=boot();
  const bound=ctx.ARISE_RESERVE_HISTORY_DRILLDOWN.bindReserveRows(profile);
  const rows=[...dom.window.document.querySelectorAll('#reserveLifecycle .row')];
  assert.equal(bound,2);
  assert.equal(rows[0].dataset.reserveHistoryTx,'new');
  assert.equal(rows[1].dataset.reserveHistoryTx,'old');
  assert.equal(rows[0].getAttribute('role'),'button');
  assert.equal(rows[0].getAttribute('tabindex'),'0');
});

test('reserve transaction inspector shows transfer semantics and stable ID',()=>{
  const {ctx,profile,getModal}=boot();
  assert.equal(ctx.ARISE_RESERVE_HISTORY_DRILLDOWN.inspectReserveTransaction(profile,'new'),true);
  const html=getModal();
  assert.match(html,/Вывод из резерва/);
  assert.match(html,/reserve → unallocated/);
  assert.match(html,/Непредвиденный расход/);
  assert.match(html,/new/);
});

test('non-reserve transaction is not opened by reserve inspector',()=>{
  const {ctx,profile}=boot();
  profile.transactions.push({id:'income',type:'income',amount:1000,date:'2026-08-20'});
  assert.equal(ctx.ARISE_RESERVE_HISTORY_DRILLDOWN.inspectReserveTransaction(profile,'income'),false);
});
