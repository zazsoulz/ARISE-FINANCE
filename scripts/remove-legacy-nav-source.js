const fs=require('node:fs');

const NAV_MARKER=`/* =========================================================\n   NAV\n========================================================= */`;
const PROFILE_MARKER=`/* =========================================================\n   PROFILE SWITCHER\n========================================================= */`;
const RENDER_NAV_RETIREMENT=`    ["renderNav",\`/* =========================================================\\n   HOME\\n========================================================= */\`],\n`;

function removeLegacyNavSource(source){
  const navStart=source.indexOf(NAV_MARKER);
  const profileStart=source.indexOf(PROFILE_MARKER);

  if(navStart<0){
    if(/\bconst\s+NAV_ITEMS\s*=/.test(source)||/\bfunction\s+renderNav\s*\(/.test(source)){
      throw new Error('Legacy navigation source is malformed: marker missing.');
    }
    return source;
  }

  if(profileStart<0||profileStart<=navStart){
    throw new Error('Legacy navigation source is malformed: profile-switch boundary missing.');
  }

  const block=source.slice(navStart,profileStart);
  const hasItems=/\bconst\s+NAV_ITEMS\s*=/.test(block);
  const hasRenderer=/\bfunction\s+renderNav\s*\(/.test(block);
  const hasBind=/\bfunction\s+bindNav\s*\(/.test(block);

  if(!hasItems&&!hasRenderer){
    if(!hasBind){
      throw new Error('Legacy navigation source is malformed: bindNav boundary helper missing.');
    }
    return source;
  }

  if(!hasItems){
    throw new Error('Legacy navigation source is malformed: NAV_ITEMS missing.');
  }
  if(!hasRenderer){
    throw new Error('Legacy navigation source is malformed: renderNav missing.');
  }
  if(!hasBind){
    throw new Error('Legacy navigation source is malformed: bindNav boundary helper missing.');
  }

  const bindStart=block.indexOf('function bindNav(');
  if(bindStart<0) throw new Error('Legacy navigation source is malformed: bindNav start missing.');

  const bindSource=block.slice(bindStart).trimEnd();
  return source.slice(0,navStart)+NAV_MARKER+'\n\n'+bindSource+'\n\n\n'+source.slice(profileStart);
}

function removeRenderNavRetirementEntry(source){
  if(source.includes(RENDER_NAV_RETIREMENT)){
    return source.replace(RENDER_NAV_RETIREMENT,'');
  }

  const registryStart=source.indexOf('const LEGACY_RENDERER_RETIREMENT=[');
  if(registryStart<0) return source;
  const registryEnd=source.indexOf('];',registryStart);
  if(registryEnd<0){
    throw new Error('Legacy renderer retirement registry is malformed.');
  }
  const registry=source.slice(registryStart,registryEnd+2);
  if(registry.includes('"renderNav"')){
    throw new Error('Legacy renderNav retirement entry is malformed.');
  }

  return source;
}

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const shellPath=argv[1]||'app-shell.html';
  const indexPath=argv[2]||'index.html';
  const shellSource=fs.readFileSync(shellPath,'utf8');
  const indexSource=fs.readFileSync(indexPath,'utf8');
  const cleanedShell=removeLegacyNavSource(shellSource);
  const cleanedIndex=removeRenderNavRetirementEntry(indexSource);
  const shellChanged=cleanedShell!==shellSource;
  const indexChanged=cleanedIndex!==indexSource;

  if(mode==='--check'){
    if(!shellChanged&&!indexChanged){
      console.log('Legacy navigation source and retirement entry are already removed.');
      return;
    }
    if(shellChanged!==indexChanged){
      throw new Error('Physical navigation cleanup is not atomic: shell and retirement registry are out of sync.');
    }
    console.log('Legacy navigation source and retirement entry can be removed atomically.');
    return;
  }

  if(mode==='--write'){
    if(shellChanged!==indexChanged){
      throw new Error('Physical navigation cleanup is not atomic: refusing partial write.');
    }
    if(shellChanged){
      fs.writeFileSync(shellPath,cleanedShell);
      fs.writeFileSync(indexPath,cleanedIndex);
    }
    console.log(shellChanged?'Legacy navigation source and retirement entry removed.':'No legacy navigation source found.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module){
  run();
}

module.exports={NAV_MARKER,PROFILE_MARKER,RENDER_NAV_RETIREMENT,removeLegacyNavSource,removeRenderNavRetirementEntry};
