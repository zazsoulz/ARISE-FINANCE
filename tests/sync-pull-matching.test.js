const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('sync-pull.js','utf8');

test('server pull matches unsynced local categories before appending remote rows',()=>{
  for(const token of [
    'findLocalCategory(remoteRow,target.categories,claimedCategories)',
    'normalizeName(item.name)===normalizeName(remoteRow.name)',
    'localCategoryType(item)===(remoteRow.rule_type==="fixed"?"fixed":"percentage")',
    'remoteId:remoteRow.id'
  ]) assert.ok(source.includes(token),token+' missing');
});

test('server pull matches unsynced goals by name and discriminating goal fields',()=>{
  for(const token of [
    'findLocalGoal(remoteRow,target.goals,claimedGoals)',
    'Number(item.target||0)===Number(remoteRow.target_amount||0)',
    'String(item.deadline||"")===String(remoteRow.deadline||"")'
  ]) assert.ok(source.includes(token),token+' missing');
});
