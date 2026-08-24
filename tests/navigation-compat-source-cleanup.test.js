const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('app-shell.html','utf8');
const navigationCompat=fs.readFileSync('navigation-compat.js','utf8');
const {
  NAV_MARKER,
  GOAL_CARD_MARKER,
  removeNavigationCompatSource
}=require('../scripts/remove-navigation-compat-source.js');

const LEGACY_FUNCTIONS=['bindNav','profileSwitcher','bindProfileSwitcher'];

test('navigation compatibility source is owned by navigation-compat.js',()=>{
  for(const name of LEGACY_FUNCTIONS){
    assert.match(navigationCompat,new RegExp(`function\\s+${name}\\s*\\(`));
    assert.match(navigationCompat,new RegExp(`root\\.${name}=${name}`));
  }
});

test('cleanup removes only legacy navigation/profile helper block',()=>{
  const cleaned=removeNavigationCompatSource(shell);
  assert.notEqual(cleaned,shell);
  for(const name of LEGACY_FUNCTIONS){
    assert.doesNotMatch(cleaned,new RegExp(`\\bfunction\\s+${name}\\s*\\(`));
  }
  assert.ok(cleaned.includes(GOAL_CARD_MARKER));
  assert.ok(cleaned.includes('function goalCard(goal){'));
  assert.ok(cleaned.includes('function openModal(html){'));
});

test('cleanup is idempotent after physical removal',()=>{
  const once=removeNavigationCompatSource(shell);
  assert.equal(removeNavigationCompatSource(once),once);
});

test('cleanup fails closed when an unexpected helper appears in the block',()=>{
  const navStart=shell.indexOf(NAV_MARKER);
  assert.ok(navStart>=0);
  const injected=shell.slice(0,navStart+NAV_MARKER.length)+
    '\nfunction sharedUnexpectedHelper(){}\n'+
    shell.slice(navStart+NAV_MARKER.length);
  assert.throws(
    ()=>removeNavigationCompatSource(injected),
    /unexpected helper sharedUnexpectedHelper/
  );
});

test('cleanup fails closed when the next boundary is damaged',()=>{
  const damaged=shell.replace(GOAL_CARD_MARKER,'/* damaged goal-card boundary */');
  assert.throws(
    ()=>removeNavigationCompatSource(damaged),
    /GOAL CARD boundary missing/
  );
});
