const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

const analyticsUi=fs.readFileSync('analytics-ui.js','utf8');

test('analytics chart accessibility stays inside the canonical analytics UI layer',()=>{
  assert.equal(fs.existsSync('analytics-chart-accessibility.js'),false,'retired analytics chart override must stay removed');
  assert.match(analyticsUi,/ARISE_ANALYTICS_CHART_ACCESSIBILITY/);
});

test('analytics chart exposes keyboard-accessible monthly source data',()=>{
  const dom=new JSDOM('<div id="page"><section class="analytics-card"><div class="analytics-pulse"></div></section></div>',{runScripts:'outside-only'});
  const {window}=dom;
  window.ARISE_ANALYTICS={series:()=>[
    {month:'2026-07',income:100000,expenses:50000},
    {month:'2026-08',income:120000,expenses:60000}
  ]};
  window.ARISE_ANALYTICS_UI={getSelectedMonth:()=> '2026-08'};
  window.activeMonth='2026-08';
  window.activeProfile=()=>({});
  window.escapeHTML=value=>String(value);
  window.formatMonth=value=>value;
  window.money=value=>`${value} ₽`;
  window.renderAnalytics=()=>{};
  window.eval(analyticsUi);
  window.ARISE_ANALYTICS_CHART_ACCESSIBILITY.enhanceAnalyticsChart();

  const details=window.document.querySelector('.analytics-chart-details');
  assert.ok(details);
  assert.equal(details.querySelector('summary').textContent.trim(),'Данные графика');
  assert.equal(details.querySelectorAll('tbody tr').length,2);
  assert.equal(details.querySelector('caption').textContent,'Доход и расходы по месяцам');
  assert.equal(details.querySelector('tbody tr:last-child td:first-of-type').textContent,'120000 ₽');
  dom.window.close();
});
