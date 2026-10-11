// Run: python3 -m http.server 8123 --bind 127.0.0.1 &  then  node tools/tests/finale.mjs  (needs playwright + chromium)
import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const results=[]; const ok=(n,c)=>{results.push(!!c);console.log(c?'PASS':'FAIL',n)};
const ALL_LEVELS = Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,3]));
const ALL_CHARS = ['puffy','kudi','jeli','okto','mantra','lumi','bubu'];
const DEX = ['clownfish','seahorse','turtle','manta','octopus','lanternfish','angler','vampsquid'];
async function page(save){
  const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.addInitScript(([s])=>{ if(!localStorage.getItem('seeded')){localStorage.setItem('hop_save',s);localStorage.setItem('seeded','1')} },[JSON.stringify({best:1234,pearls:0,char:'puffy',...save})]);
  await p.goto('http://127.0.0.1:8123/?debug'); await p.waitForTimeout(700); return p;
}
const vis = (p,sel)=>p.isVisible(sel);
// A: already-complete save -> no surprise screen, 🏆 button works
{ const p=await page({levels:ALL_LEVELS,owned:ALL_CHARS,dex:DEX});
  ok('A: finale not forced at boot', !(await vis(p,'#finale')) && await vis(p,'#menu'));
  ok('A: menu shows finale button', await vis(p,'#menu-finale'));
  await p.click('#menu-finale'); await p.waitForTimeout(400);
  const stats=await p.textContent('#finale-stats');
  ok('A: finale shows 20/20, 60/60, 7/7, 8/8', ['20/20','60/60','7/7','8/8','1234 m'].every(x=>stats.includes(x)));
  ok('A: perfect note', (await p.textContent('#finale-note')).includes('Perfect'));
  ok('A: 7 character canvases', (await p.$$('#finale-chars canvas')).length===7);
  await p.click('#finale-close'); await p.waitForTimeout(200);
  ok('A: back to menu', await vis(p,'#menu') && !(await vis(p,'#finale'))); ok('A: no errors',!p.errs.length); }
// incomplete save has no button
{ const p=await page({levels:{1:1},owned:['puffy'],dex:[]}); ok('no finale button before completion', !(await vis(p,'#menu-finale'))); }
// B: buying the last character completes the game
{ const p=await page({pearls:3000,levels:ALL_LEVELS,owned:ALL_CHARS.filter(c=>c!=='lumi'),dex:DEX});
  ok('B: button hidden before last purchase', !(await vis(p,'#menu-finale')));
  await p.click('#menu .open-shop'); await p.waitForTimeout(300);
  await p.evaluate(()=>[...document.querySelectorAll('#shop-grid .char-card, #shop-grid button')].find(c=>/Lumi/.test(c.textContent)).click());
  await p.waitForTimeout(500);
  ok('B: finale opens right after buying', await vis(p,'#finale') && !(await vis(p,'#shop')));
  await p.click('#finale-close'); await p.waitForTimeout(200);
  ok('B: menu has button', await vis(p,'#menu') && await vis(p,'#menu-finale'));
  await p.reload(); await p.waitForTimeout(700);
  ok('B: not shown again after reload, button stays', !(await vis(p,'#finale')) && await vis(p,'#menu-finale')); ok('B: no errors',!p.errs.length); }
// C: clearing the last level -> stars screen first, finale on leaving it
{ const lv={...ALL_LEVELS}; delete lv[20];
  const p=await page({levels:lv,owned:ALL_CHARS,dex:DEX});
  await p.click('#menu .open-levels'); await p.waitForTimeout(300);
  await p.evaluate(()=>[...document.querySelectorAll('#levels-grid .lv')].pop().click()); await p.waitForTimeout(500);
  await p.evaluate(()=>window.__dbg().levelComplete()); await p.waitForTimeout(400);
  ok('C: level-done screen first', await vis(p,'#level-done') && !(await vis(p,'#finale')));
  await p.click('#done-map'); await p.waitForTimeout(400);
  ok('C: finale after leaving level-done', await vis(p,'#finale') && !(await vis(p,'#level-done')));
  await p.click('#finale-close'); await p.waitForTimeout(200); ok('C: lands on menu', await vis(p,'#menu')); ok('C: no errors',!p.errs.length); }
// D: last creature found during a run -> finale at game over
{ const p=await page({levels:ALL_LEVELS,owned:ALL_CHARS.filter(c=>c!=='bubu'),dex:DEX.slice(0,7)});
  ok('D: no finale button before 8/8', !(await vis(p,'#menu-finale')));
  await p.click('#play'); await p.waitForTimeout(400);
  await p.evaluate(()=>{const d=window.__dbg(); d.save.dex.push('vampsquid'); d.unlockSecret();}); // what touching the 8th creature does
  await p.evaluate(()=>{const d=window.__dbg(); d.player.invuln=0; d.gameOver({label:'test'})});
  await p.waitForTimeout(3500);
  ok('D: finale shown at game over', await vis(p,'#finale') && !(await vis(p,'#over')));
  await p.click('#finale-close'); await p.waitForTimeout(200);
  ok('D: menu + button after', await vis(p,'#menu') && await vis(p,'#menu-finale')); ok('D: no errors',!p.errs.length); }
await b.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
