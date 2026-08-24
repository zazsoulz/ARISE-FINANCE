const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('flow-motion.css','utf8');

function pos(value){return index.indexOf(value);}

test('organic flow motion loads immediately after the canonical A1-V3 stylesheet',()=>{
  const base=pos('./arise-v3.css');
  const motion=pos('./flow-motion.css');
  const analytics=pos('./analytics-ui.css');
  assert.ok(base>=0,'arise-v3.css missing');
  assert.ok(motion>base,'flow-motion.css must load after arise-v3.css');
  assert.ok(analytics>motion,'flow motion should stay below screen-specific analytics styling');
});

test('route-following drift and particle animation are visually retired',()=>{
  assert.match(css,/\.arise-flow-drift,\s*\n\.arise-flow-particles\s*\{[\s\S]*?display:none!important/);
  assert.doesNotMatch(css,/stroke-dashoffset/);
  assert.doesNotMatch(css,/animateMotion/);
});

test('the flow body itself owns the calm always-on motion',()=>{
  for(const selector of ['.arise-flow-sheets','.arise-flow-contours','.arise-flow-hairs','.arise-flow-aura','.arise-flow-ribbon','.arise-flow-main']){
    assert.ok(css.includes(selector),selector+' missing from organic motion layer');
  }
  for(const keyframe of ['ariseFlowBody','ariseFlowContours','ariseFlowHairs','ariseFlowAura','ariseFlowRibbon','ariseFlowCore','arisePoolSettle']){
    assert.ok(css.includes('@keyframes '+keyframe),keyframe+' missing');
  }
});

test('organic motion remains restrained and reduced-motion safe',()=>{
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css,/animation:none!important/);
  assert.match(css,/transform:none!important/);
  assert.doesNotMatch(css,/animation-duration:\s*[0-3](?:\.|s)/);
});
