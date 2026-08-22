const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function boot(page){
  const dom=new JSDOM('<!doctype html><div id="page"></div>',{runScripts:'outside-only'});
  const {window}=dom;
  const calls=[];
  window.activePage=page;
  window.render=()=>calls.push(['render',window.activePage]);
  window.showIncomeModal=()=>calls.push(['income']);
  window.showExpenseModal=()=>calls.push(['expense']);
  window.showGoalModal=()=>calls.push(['goal']);
  for(const name of ['renderIncome','renderGoals','renderHistory','renderAnalytics']){
    window[name]=function(){window.document.getElementById('page').innerHTML='<div class="empty">Пока здесь пусто.</div><div class="empty">Вторичный пустой блок.</div>';};
  }
  new vm.Script(fs.readFileSync('screen-state-ui.js','utf8'),{filename:'screen-state-ui.js'}).runInContext(dom.getInternalVMContext());
  return {dom,calls};
}

test('income empty states are accessible while only the primary state gets an action',()=>{
  const {dom,calls}=boot('income');
  dom.window.renderIncome();
  const empties=dom.window.document.querySelectorAll('.empty');
  for(const empty of empties){
    assert.equal(empty.getAttribute('role'),'status');
    assert.equal(empty.getAttribute('aria-live'),'polite');
  }
  assert.equal(empties[0].querySelectorAll('button').length,1);
  assert.equal(empties[1].querySelectorAll('button').length,0,'secondary empty cards stay concise');
  empties[0].querySelector('button').click();
  assert.deepEqual(calls,[['income']]);
  dom.window.close();
});

test('goals empty state creates a goal',()=>{
  const {dom,calls}=boot('goals');
  dom.window.renderGoals();
  dom.window.document.querySelector('.empty button').click();
  assert.deepEqual(calls,[['goal']]);
  dom.window.close();
});

test('history empty state offers both primary transaction actions',()=>{
  const {dom,calls}=boot('history');
  dom.window.renderHistory();
  const buttons=dom.window.document.querySelectorAll('.empty button');
  assert.deepEqual([...buttons].map(button=>button.textContent),['Добавить доход','Добавить расход']);
  buttons[0].click();
  buttons[1].click();
  assert.deepEqual(calls,[['income'],['expense']]);
  dom.window.close();
});

test('analytics empty state routes to distribution instead of a dead end',()=>{
  const {dom,calls}=boot('analytics');
  dom.window.renderAnalytics();
  dom.window.document.querySelector('.empty button').click();
  assert.equal(dom.window.activePage,'income');
  assert.deepEqual(calls,[['render','income']]);
  dom.window.close();
});

test('enhancing the same page twice does not duplicate actions or status setup',()=>{
  const {dom}=boot('income');
  dom.window.renderIncome();
  const api=dom.window.ARISE_SCREEN_STATE_UI;
  api.enhancePage('income');
  const empties=dom.window.document.querySelectorAll('.empty');
  assert.equal(empties[0].querySelectorAll('button').length,1);
  assert.equal(empties[0].dataset.stateSemantics,'true');
  assert.equal(empties[1].dataset.stateSemantics,'true');
  dom.window.close();
});
