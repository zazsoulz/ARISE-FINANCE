const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");

const source=fs.readFileSync("analytics-ui.js","utf8");
const css=fs.readFileSync("product-ui.css","utf8");

function boot(){
  const dom=new JSDOM(`
    <section id="scope">
      <div class="analytics-pulse">
        <svg>
          <line class="analytics-terminal-guide" x1="20" x2="20"></line>
          <circle class="point-income" cx="10" cy="20"></circle>
          <circle class="point-income" cx="20" cy="30"></circle>
          <circle class="point-expense" cx="10" cy="40"></circle>
          <circle class="point-expense" cx="20" cy="50"></circle>
          <rect class="analytics-chart-hit" tabindex="0" role="button" aria-pressed="false" data-chart-label="Июль 2026" data-chart-income="100000" data-chart-expense="50000"></rect>
          <rect class="analytics-chart-hit" tabindex="0" role="button" aria-pressed="false" data-chart-label="Август 2026" data-chart-income="120000" data-chart-expense="60000"></rect>
        </svg>
      </div>
      <span data-pulse-period></span>
      <strong data-pulse-income></strong>
      <strong data-pulse-expense></strong>
    </section>
  `,{runScripts:"outside-only"});
  const {window}=dom;
  window.ARISE_ANALYTICS={};
  window.ARISE_FINANCE_CORE={};
  window.formatMonth=value=>String(value);
  window.escapeHTML=value=>String(value);
  window.money=value=>`${Number(value).toLocaleString("ru-RU")} ₽`;
  window.eval(source);
  const scope=window.document.getElementById("scope");
  window.ARISE_ANALYTICS_UI.bindPulseChart(scope);
  return {dom,window,scope};
}

test("analytics chart activates month targets with Enter and Space and exposes pressed state",()=>{
  const {dom,window,scope}=boot();
  const hits=[...scope.querySelectorAll(".analytics-chart-hit")];
  const period=scope.querySelector("[data-pulse-period]");
  const income=scope.querySelector("[data-pulse-income]");
  const expense=scope.querySelector("[data-pulse-expense]");
  const guide=scope.querySelector(".analytics-terminal-guide");

  assert.equal(hits[0].getAttribute("aria-pressed"),"false");
  assert.equal(hits[1].getAttribute("aria-pressed"),"true");
  assert.equal(period.textContent,"Август 2026");

  const enter=new window.KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true});
  hits[0].dispatchEvent(enter);
  assert.equal(enter.defaultPrevented,true);
  assert.equal(hits[0].getAttribute("aria-pressed"),"true");
  assert.equal(hits[1].getAttribute("aria-pressed"),"false");
  assert.equal(period.textContent,"Июль 2026");
  assert.equal(income.textContent,"100 000 ₽");
  assert.equal(expense.textContent,"50 000 ₽");
  assert.equal(guide.getAttribute("x1"),"10");

  const space=new window.KeyboardEvent("keydown",{key:" ",bubbles:true,cancelable:true});
  hits[1].dispatchEvent(space);
  assert.equal(space.defaultPrevented,true);
  assert.equal(hits[0].getAttribute("aria-pressed"),"false");
  assert.equal(hits[1].getAttribute("aria-pressed"),"true");
  assert.equal(period.textContent,"Август 2026");
  assert.equal(income.textContent,"120 000 ₽");
  assert.equal(expense.textContent,"60 000 ₽");
  dom.window.close();
});

test("analytics chart retains pointer and click activation",()=>{
  const {dom,scope}=boot();
  const hits=[...scope.querySelectorAll(".analytics-chart-hit")];
  hits[0].dispatchEvent(new dom.window.Event("pointerenter"));
  assert.equal(hits[0].getAttribute("aria-pressed"),"true");
  hits[1].dispatchEvent(new dom.window.MouseEvent("click",{bubbles:true}));
  assert.equal(hits[0].getAttribute("aria-pressed"),"false");
  assert.equal(hits[1].getAttribute("aria-pressed"),"true");
  assert.equal(scope.querySelector("[data-pulse-period]").textContent,"Август 2026");
  dom.window.close();
});

test("generated chart targets expose semantic button state and a visible keyboard focus style",()=>{
  const {dom,window}=boot();
  const markup=window.ARISE_ANALYTICS_UI.chartHits([
    {month:"2026-07",income:100000,expenses:50000},
    {month:"2026-08",income:120000,expenses:60000}
  ]);
  assert.equal((markup.match(/role="button"/g)||[]).length,2);
  assert.equal((markup.match(/tabindex="0"/g)||[]).length,2);
  assert.equal((markup.match(/aria-pressed="false"/g)||[]).length,2);
  assert.match(markup,/aria-label="2026-08: доход 120 000 ₽, расходы 60 000 ₽"/);
  assert.match(css,/\.analytics-chart-hit:focus-visible\{[^}]*stroke-width:2/s);
  assert.match(css,/\.analytics-chart-hit:focus-visible\{[^}]*vector-effect:non-scaling-stroke/s);
  dom.window.close();
});
