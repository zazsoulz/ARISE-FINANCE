const fs=require('node:fs');

const NAV_MARKER=`/* =========================================================\n   NAV\n========================================================= */`;
const PROFILE_MARKER=`/* =========================================================\n   PROFILE SWITCHER\n========================================================= */`;

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

function run(argv=process.argv.slice(2)){
  const mode=argv[0]||'--check';
  const path=argv[1]||'app-shell.html';
  const source=fs.readFileSync(path,'utf8');
  const cleaned=removeLegacyNavSource(source);

  if(mode==='--check'){
    if(cleaned===source){
      console.log('Legacy NAV_ITEMS/renderNav source is already removed.');
      return;
    }
    console.log('Legacy NAV_ITEMS/renderNav source can be removed safely.');
    return;
  }

  if(mode==='--write'){
    if(cleaned!==source) fs.writeFileSync(path,cleaned);
    console.log(cleaned===source?'No legacy navigation source found.':'Legacy navigation source removed.');
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

if(require.main===module){
  run();
}

module.exports={NAV_MARKER,PROFILE_MARKER,removeLegacyNavSource};
