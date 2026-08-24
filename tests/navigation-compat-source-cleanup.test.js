const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const navigationCompat=fs.readFileSync('navigation-compat.js','utf8');
const {
  NAV_FUNCTION_BOUNDARY,
  GOAL_CARD_MARKER,
  removeNavigationCompatSource
}=require('../scripts/remove-navigation-compat-source.js');

const LEGACY_FUNCTIONS=['bindNav','profileSwitcher','bindProfileSwitcher'];

function legacyFixture(){
  const boundary=shell.indexOf(GOAL_CARD_MARKER);
  assert.ok(boundary>=0,'GOAL CARD boundary missing from current shell');
  const block=`function bindNav(){\n  return true;\n}\n\nfunction profileSwitcher(){\n  return \"\";\n}\n\nfunction bindProfileSwitcher(){\n  return true;\n}\n\n`;
  return shell.slice(0,boundary)+block+shell.slice(boundary);
}

test('navigation compatibility source is owned by navigation-compat.js',()=>{
  for(const name of LEGACY_FUNCTIONS){
    assert.match(navigationCompat,new RegExp(`function\\s+${name}\\s*\\(`));
    assert.match(navigationCompat,new RegExp(`root\\.${name}=${name}`));
    assert.doesNotMatch(shell,new RegExp(`\\bfunction\\s+${name}\\s*\\(`));
  }
});

test('cleanup removes only legacy navigation/profile helper block',()=>{
  const fixture=legacyFixture();
  const cleaned=removeNavigationCompatSource(fixture);
  assert.notEqual(cleaned,fixture);
  assert.equal(cleaned,shell);
  for(const name of LEGACY_FUNCTIONS){
    assert.doesNotMatch(cleaned,new RegExp(`\\bfunction\\s+${name}\\s*\\(`));
  }
  assert.ok(cleaned.includes(GOAL_CARD_MARKER));
  assert.ok(cleaned.includes('function goalCard(goal){'));
  assert.ok(cleaned.includes('function openModal(html){'));
  assert.ok(cleaned.includes('.nav{'));
  assert.ok(cleaned.includes('.profile-switch{'));
});

test('cleanup is idempotent after physical removal',()=>{
  assert.equal(removeNavigationCompatSource(shell),shell);
});

test('cleanup fails closed when an unexpected helper appears in the block',()=>{
  const fixture=legacyFixture();
  const navStart=fixture.indexOf(NAV_FUNCTION_BOUNDARY);
  assert.ok(navStart>=0);
  const injected=fixture.slice(0,navStart+NAV_FUNCTION_BOUNDARY.length)+
    '\nfunction sharedUnexpectedHelper(){}\n'+
    fixture.slice(navStart+NAV_FUNCTION_BOUNDARY.length);
  assert.throws(
    ()=>removeNavigationCompatSource(injected),
    /unexpected helper sharedUnexpectedHelper/
  );
});

test('cleanup fails closed when the next boundary is damaged',()=>{
  const fixture=legacyFixture();
  const damaged=fixture.replace(GOAL_CARD_MARKER,'/* damaged goal-card boundary */');
  assert.throws(
    ()=>removeNavigationCompatSource(damaged),
    /GOAL CARD boundary missing/
  );
});
