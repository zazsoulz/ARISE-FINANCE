#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const os=require("node:os");
const path=require("node:path");
const {chromium}=require("playwright");

async function main(){
  const previewPath=process.argv[2];
  assert.ok(previewPath,"Usage: node scripts/standalone-browser-smoke.js <standalone.html> [report.json]");
  const absolutePreview=path.resolve(previewPath);
  assert.ok(fs.existsSync(absolutePreview),"Standalone preview does not exist: "+absolutePreview);
  const html=fs.readFileSync(absolutePreview,"utf8");
  assert.ok(html.includes('data-arise-source="product-ui.css"'),"Product UI stylesheet was not inlined");
  assert.ok(html.includes('data-arise-source="financial-bootstrap.js"'),"Canonical bootstrap was not inlined");

  const reportPath=process.argv[3]||path.join(process.env.RUNNER_TEMP||os.tmpdir(),"arise-standalone-browser-report.json");
  const screenshotDir=process.env.RUNNER_TEMP||os.tmpdir();
  const report={previewBytes:Buffer.byteLength(html),viewports:[],passed:false};
  const server=http.createServer((request,response)=>{
    if(request.url!=="/"&&request.url!=="/index.html"){
      response.writeHead(404,{"content-type":"text/plain"});
      response.end("Not found");
      return;
    }
    response.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
    response.end(html);
  });
  await new Promise((resolve,reject)=>{
    server.once("error",reject);
    server.listen(0,"127.0.0.1",resolve);
  });
  const address=server.address();
  const origin="http://127.0.0.1:"+address.port+"/";
  const viewports=[
    {name:"mobile-320",width:320,height:740},
    {name:"mobile-390",width:390,height:844},
    {name:"tablet-768",width:768,height:1024},
    {name:"desktop-1440",width:1440,height:900}
  ];
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    for(const viewport of viewports){
      const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
      const pageErrors=[];
      page.on("pageerror",error=>pageErrors.push(error.message));
      await page.route("**/npm/@supabase/supabase-js@2*",route=>route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase={createClient:function(){return {auth:{getSession:function(){return Promise.resolve({data:{session:null},error:null});}}};}};"
      }));
      await page.goto(origin,{waitUntil:"load",timeout:30000});
      await page.waitForFunction(
        ()=>!!document.querySelector("#registerSubmit")||!!document.querySelector(".product-nav"),
        null,
        {timeout:15000}
      );
      await page.evaluate(()=>{
        if(!state||!state.account)throw new Error("ARISE state is unavailable after standalone bootstrap");
        state.account.registered=true;
        state.account.name="Browser QA";
        state.account.email="qa@example.com";
        saveState();
        render();
      });
      await page.waitForSelector(".product-nav",{state:"visible",timeout:15000});

      const screens=[
        {name:"home",selector:".arise-v3-home"},
        {name:"income",selector:".arise-v3-distribution"},
        {name:"goals",selector:".arise-v3-goals"},
        {name:"history",selector:".arise-v3-history"},
        {name:"analytics",selector:".arise-analytics"},
        {name:"settings",selector:"#settingsProfileName"}
      ];
      const screenResults=[];
      for(const screen of screens){
        if(screen.name==="settings"){
          await page.locator('.product-avatar[data-page="settings"]').click();
        }else{
          await page.locator('.product-nav [data-page="'+screen.name+'"]').click();
        }
        await page.waitForSelector(screen.selector,{state:"visible",timeout:10000});
        const metrics=await page.evaluate(()=>{
          const nav=document.querySelector(".product-nav");
          const items=Array.from(nav.querySelectorAll(".product-nav-item"));
          return {
            viewportWidth:window.innerWidth,
            documentWidth:document.documentElement.scrollWidth,
            bodyWidth:document.body.scrollWidth,
            navPosition:getComputedStyle(nav).position,
            minNavItemHeight:Math.min.apply(null,items.map(item=>item.getBoundingClientRect().height))
          };
        });
        assert.ok(metrics.documentWidth<=viewport.width+1,
          screen.name+" causes document horizontal overflow at "+viewport.width+"px: "+metrics.documentWidth+"px");
        assert.ok(metrics.bodyWidth<=viewport.width+1,
          screen.name+" causes body horizontal overflow at "+viewport.width+"px: "+metrics.bodyWidth+"px");
        if(viewport.width<=760){
          assert.equal(metrics.navPosition,"fixed","Mobile navigation must remain fixed at "+viewport.width+"px");
          assert.ok(metrics.minNavItemHeight>=44,
            "Mobile navigation touch target is below 44px on "+screen.name+" at "+viewport.width+"px");
        }else{
          assert.equal(metrics.navPosition,"sticky","Desktop/tablet navigation must remain in document flow");
        }
        screenResults.push({screen:screen.name,...metrics});
      }

      async function assertOpenSheetFits(label){
        const metrics=await page.evaluate(()=>{
          const overlay=document.getElementById("modal");
          const sheet=document.getElementById("sheet");
          const rect=sheet.getBoundingClientRect();
          return {
            open:overlay.classList.contains("open"),
            left:rect.left,
            right:rect.right,
            top:rect.top,
            bottom:rect.bottom,
            width:rect.width,
            height:rect.height,
            viewportWidth:window.innerWidth,
            viewportHeight:window.innerHeight
          };
        });
        assert.equal(metrics.open,true,label+" did not open a modal");
        assert.ok(metrics.width>0&&metrics.height>0,label+" modal has no visible sheet");
        assert.ok(metrics.left>=-1&&metrics.right<=viewport.width+1,
          label+" modal exceeds horizontal viewport bounds at "+viewport.width+"px");
        assert.ok(metrics.top>=-1&&metrics.bottom<=viewport.height+1,
          label+" modal exceeds vertical viewport bounds at "+viewport.width+"px");
        return metrics;
      }

      await page.locator('.product-nav [data-page="home"]').click();
      await page.waitForSelector(".arise-v3-home",{state:"visible"});
      await page.locator("[data-quick-income]").click();
      const incomeSheet=await assertOpenSheetFits("Quick income");
      await page.keyboard.press("Escape");
      await page.waitForFunction(()=>!document.getElementById("modal").classList.contains("open"));
      assert.equal(await page.evaluate(()=>document.activeElement.matches("[data-quick-income]")),true,
        "Quick income modal did not restore focus to its opener");
      await page.locator("[data-quick-expense]").click();
      const expenseSheet=await assertOpenSheetFits("Quick expense");
      await page.keyboard.press("Escape");
      await page.waitForFunction(()=>!document.getElementById("modal").classList.contains("open"));
      assert.equal(await page.evaluate(()=>document.activeElement.matches("[data-quick-expense]")),true,
        "Quick expense modal did not restore focus to its opener");

      await page.locator('.product-nav [data-page="goals"]').click();
      await page.waitForSelector("#createGoal",{state:"visible"});
      await page.locator("#createGoal").click();
      await page.waitForSelector("#goalName",{state:"visible"});
      const goalSheet=await assertOpenSheetFits("Goal creation");
      await page.keyboard.press("Escape");
      await page.waitForFunction(()=>!document.getElementById("modal").classList.contains("open"));
      assert.equal(await page.evaluate(()=>document.activeElement.id==="createGoal"),true,
        "Goal modal did not restore focus to its opener");

      assert.deepEqual(pageErrors,[],"Browser runtime errors at "+viewport.width+"px: "+pageErrors.join(" | "));
      const screenshotPath=path.join(screenshotDir,"arise-standalone-"+viewport.name+".png");
      await page.screenshot({path:screenshotPath,fullPage:true});
      report.viewports.push({
        name:viewport.name,
        width:viewport.width,
        height:viewport.height,
        screens:screenResults,
        modalChecks:{income:incomeSheet,expense:expenseSheet,goal:goalSheet},
        pageErrors,
        screenshot:screenshotPath
      });
      await page.close();
    }
    report.passed=true;
    fs.mkdirSync(path.dirname(path.resolve(reportPath)),{recursive:true});
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n","utf8");
    console.log("Standalone Chromium smoke passed: "+report.viewports.length+" viewports, "+report.viewports.reduce((sum,item)=>sum+item.screens.length,0)+" screens, modal bounds/focus checks passed.");
    console.log("Browser evidence: "+reportPath);
  }catch(error){
    report.error=error.stack||String(error);
    fs.mkdirSync(path.dirname(path.resolve(reportPath)),{recursive:true});
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n","utf8");
    throw error;
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
