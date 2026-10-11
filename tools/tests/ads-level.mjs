// Run: python3 -m http.server 8123 --bind 127.0.0.1 &  then  node tools/tests/ads.mjs  (needs playwright + chromium)
import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>localStorage.setItem('hop_tutorial','1'));
await p.goto('http://127.0.0.1:8123/?debug'); await p.waitForTimeout(700);
await p.click('#menu .open-levels'); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#levels-grid .lv:not(.locked)').click());
await p.waitForTimeout(500);
let seen=false;
for(let i=0;i<4&&!seen;i++){
  await p.evaluate(()=>window.__dbg().levelComplete()); await p.waitForTimeout(300);
  await p.click('#done-next'); 
  try{ await p.waitForSelector('.fake-ad',{timeout:1200}); seen=true; }catch(e){ await p.waitForTimeout(300); }
}
console.log('interstitial seen on next level:', seen);
if(seen){ await p.waitForTimeout(2600); console.log('ad gone & playing:', !(await p.$('.fake-ad')) && await p.evaluate(()=>window.__dbg().state)==='play'); }
console.log('errors', errs); await b.close();
