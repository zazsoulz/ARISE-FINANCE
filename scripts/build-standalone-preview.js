#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const FINANCIAL_MARKER=`/* =========================================================\n   FINANCIAL ENGINE\n========================================================= */`;
const UI_MARKER=`/* =========================================================\n   UI\n========================================================= */`;
const INIT_MARKER=`/* =========================================================\n   INITIALIZATION\n========================================================= */`;

function assert(condition,message){
  if(!condition)throw new Error(message);
}

function extractManifest(indexSource){
  const scripts=[...indexSource.matchAll(/scriptOpen\+" src=\\"([^"\\]+)\\">"\+scriptClose/g)].map(match=>match[1]);
  const styles=[...indexSource.matchAll(/rel="stylesheet" href="\.\/([^"\\]+\.css)"/g)].map(match=>`./${match[1]}`);
  assert(scripts.length>0,"ARISE runtime script manifest was not found in index.html");
  assert(styles.length>0,"ARISE stylesheet manifest was not found in index.html");
  assert(scripts.at(-1)==="./financial-bootstrap.js","financial-bootstrap.js must remain the final runtime script");
  return {scripts,styles};
}

function stripLegacyRuntime(shellSource){
  const financialStart=shellSource.indexOf(FINANCIAL_MARKER);
  const uiStart=shellSource.indexOf(UI_MARKER);
  assert(financialStart>=0,"ARISE shell financial boundary was not found");
  assert(uiStart>financialStart,"ARISE shell UI boundary must follow the financial boundary");

  let html=shellSource.slice(0,financialStart)
    +"/* Financial state and calculations are provided by the external ARISE runtime. */\n"
    +"globalThis.__ARISE_LEGACY_FINANCIAL_STRIPPED__=true;\n\n"
    +shellSource.slice(uiStart);
  const scriptCloseTag="</scr"+"ipt>";
  const initStart=html.indexOf(INIT_MARKER);
  const scriptEnd=html.lastIndexOf(scriptCloseTag);
  assert(initStart>=0,"ARISE shell initialization boundary was not found");
  assert(scriptEnd>initStart,"ARISE shell script boundary was not found");
  html=html.slice(0,initStart)+"/* Initialization is deferred until the financial runtime is loaded. */\n\n"+html.slice(scriptEnd);
  return html;
}

function localPath(rootDir,source){
  const relative=source.replace(/^\.\//,"");
  const resolved=path.resolve(rootDir,relative);
  assert(resolved.startsWith(rootDir+path.sep),`Runtime asset escapes repository root: ${source}`);
  assert(fs.existsSync(resolved),`Runtime asset is missing: ${source}`);
  return resolved;
}

function safeInline(source,closingTag){
  return source.replace(new RegExp(`</${closingTag}`,"gi"),`<\\/${closingTag}`);
}

function assetMime(filePath){
  const extension=path.extname(filePath).toLowerCase();
  return ({".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".otf":"font/otf"})[extension]||"application/octet-stream";
}

function inlineCssAssets(rootDir,content){
  return content.replace(/url\((['"]?)(\.\/[^)'"\s]+)\1\)/g,(match,_quote,source)=>{
    const filePath=localPath(rootDir,source);
    const data=fs.readFileSync(filePath).toString("base64");
    return `url("data:${assetMime(filePath)};base64,${data}")`;
  });
}

function inlineStyles(rootDir,styles){
  return styles.map(source=>{
    const content=inlineCssAssets(rootDir,fs.readFileSync(localPath(rootDir,source),"utf8"));
    return `<style data-arise-source="${source.replace(/^\.\//,"")}">\n${safeInline(content,"style")}\n</style>`;
  }).join("\n");
}

function inlineScripts(rootDir,scripts){
  return scripts.map(source=>{
    if(/^https?:\/\//i.test(source))return `<script src="${source}"></script>`;
    const content=fs.readFileSync(localPath(rootDir,source),"utf8");
    return `<script data-arise-source="${source.replace(/^\.\//,"")}">\n${safeInline(content,"script")}\n</script>`;
  }).join("\n");
}

function buildStandalone({rootDir=ROOT,indexSource,shellSource}={}){
  const index=indexSource??fs.readFileSync(path.join(rootDir,"index.html"),"utf8");
  const shell=shellSource??fs.readFileSync(path.join(rootDir,"app-shell.html"),"utf8");
  const manifest=extractManifest(index);
  let html=stripLegacyRuntime(shell);
  const styles=`${inlineStyles(rootDir,manifest.styles)}\n<style id="arise-boot-hide">html{visibility:hidden}</style>`;
  const scripts=inlineScripts(rootDir,manifest.scripts);
  assert(/<\/head>/i.test(html),"ARISE shell closing head tag was not found");
  assert(/<\/body>/i.test(html),"ARISE shell closing body tag was not found");
  html=html.replace(/<\/head>/i,`${styles}\n</head>`);
  html=html.replace(/<\/body>/i,`${scripts}\n</body>`);
  return {html,manifest};
}

function writeStandalone(outputPath){
  const output=path.resolve(outputPath);
  const {html,manifest}=buildStandalone();
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,html,"utf8");
  return {output,bytes:Buffer.byteLength(html),manifest};
}

if(require.main===module){
  const output=process.argv[2]||path.join(ROOT,"ARISE-current-standalone.html");
  const result=writeStandalone(output);
  console.log(`Built ${result.output} (${result.bytes} bytes, ${result.manifest.scripts.length} scripts, ${result.manifest.styles.length} stylesheets)`);
}

module.exports={
  FINANCIAL_MARKER,
  UI_MARKER,
  INIT_MARKER,
  extractManifest,
  stripLegacyRuntime,
  inlineCssAssets,
  buildStandalone,
  writeStandalone
};
