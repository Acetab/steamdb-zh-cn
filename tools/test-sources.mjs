import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=await readFile(new URL('../src/content.js',import.meta.url),'utf8');
const start=code.indexOf('  const sourceModes=');
const end=code.indexOf('  // 油猴本地词库缓存',start);
let mode='auto',reloads=0;
const urls=['https://raw.githubusercontent.com/Acetab/steamdb-zh-cn/main/translations.zh-CN.json','https://cdn.jsdelivr.net/gh/Acetab/steamdb-zh-cn@main/translations.zh-CN.json'];
const context={URL,remoteDictUrls:urls,STORAGE:{sourceMode:'test'},GM_getValue:()=>mode,GM_setValue:(key,value)=>mode=value,location:{reload(){reloads++}}};
vm.createContext(context);vm.runInContext(code.slice(start,end),context);
assert.deepEqual(Array.from(context.selectedSources('auto')),urls);
assert.deepEqual(Array.from(context.selectedSources('github')),[urls[0]]);
assert.deepEqual(Array.from(context.selectedSources('jsdelivr')),[urls[1]]);
assert.equal(context.selectedSources('local').length,0);
context.setSourceMode('jsdelivr');assert.equal(context.readSourceMode(),'jsdelivr');assert.equal(reloads,1);
mode='invalid';assert.equal(context.readSourceMode(),'auto');
console.log('PASS: 自动/单源/本地模式、来源隔离、设置保存及无效设置回退');
const requests=[];
context.GM_xmlhttpRequest=options=>{requests.push(options.url);options.onerror()};
context.console={warn(){}};
vm.runInContext(code.slice(code.indexOf('  function refreshRemoteDict()'),code.indexOf('  function loadDictionary()')),context);
for(const [choice,expected] of [['auto',urls],['github',[urls[0]]],['jsdelivr',[urls[1]]],['local',[]]]){
  mode=choice;requests.length=0;context.refreshRemoteDict();assert.deepEqual(requests,expected,choice+' 失败回退必须遵守用户选择');
}
console.log('PASS: 请求失败时实际来源链及仅本地零请求');
