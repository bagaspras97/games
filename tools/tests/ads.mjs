// Run: python3 -m http.server 8123 --bind 127.0.0.1 &  then  node tools/tests/ads.mjs  (needs playwright + chromium)
import { chromium } from 'playwright';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const results=[]; const ok=(n,c)=>{results.push([n,!!c]);console.log(c?'PASS':'FAIL',n)};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
async function fresh(seed, url='http://127.0.0.1:8123/?debug'){
  const ctx=await b.newContext({viewport:{width:1280,height:720}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  if(seed) await p.addInitScript(([s])=>{ if(!localStorage.getItem('seeded')){localStorage.setItem('hop_save',s);localStorage.setItem('seeded','1');localStorage.setItem('hop_tutorial','1')} },[JSON.stringify(seed)]);
  await p.goto(url); await p.waitForTimeout(700); p.errs=errs; return p;
}
const waitAd=async(p,ms=4500)=>{await p.waitForSelector('.fake-ad',{timeout:2000});await p.waitForTimeout(ms);return !(await p.$('.fake-ad'))};
const st=p=>p.evaluate(()=>window.__dbg().state);
async function die(p,playing=false){ // start free run, wait until game over panel
  if(!playing) await p.click('#play'); await p.waitForTimeout(400);
  await p.evaluate(()=>{const d=window.__dbg(); d.player.invuln=0; d.gameOver({label:'test'})});
  await p.waitForFunction(()=>window.__dbg().state==='over',null,{timeout:15000});
}
// 1 shield start from menu
{ const p=await fresh(); await p.click('#menu .shield-start'); const gone=await waitAd(p,3800); ok('menu shield: ad ends & run starts', gone && await st(p)==='play'); ok('menu shield: no errors',!p.errs.length); }
// 2 free pearls
{ const p=await fresh(); await p.click('#menu .open-shop'); await p.click('#free-pearls'); const gone=await waitAd(p,3800); ok('free pearls: ad ends, +40', gone && (await p.textContent('#shop-pearls'))==='40'); ok('free pearls: state shop', await st(p)==='shop'); }
// 3 free pearls skip => no reward
{ const p=await fresh(); await p.click('#menu .open-shop'); await p.click('#free-pearls'); await p.waitForSelector('.fake-ad'); await p.click('.fake-ad button'); await p.waitForTimeout(300); ok('free pearls skip: no reward, shop back', (await p.textContent('#shop-pearls'))==='0' && await st(p)==='shop'); }
// 4 revive (+ over-panel shield + retry)
{ const p=await fresh(); await die(p);
  await p.click('#revive'); let gone=await waitAd(p,3800); ok('revive: ad ends, back to play', gone && await st(p)==='play');
  await p.waitForTimeout(300); await p.evaluate(()=>{const d=window.__dbg(); d.player.invuln=0; d.gameOver({label:'test'})});
  await p.waitForFunction(()=>window.__dbg().state==='over',null,{timeout:15000});
  ok('revive: only once (button hidden)', !(await p.isVisible('#revive')));
  await p.click('#over .shield-start'); gone=await waitAd(p,3800); ok('over shield: ad ends & run starts', gone && await st(p)==='play'); 
  ok('revive/shield: no errors',!p.errs.length); }
// 5 revive skip
{ const p=await fresh(); await die(p); await p.click('#revive'); await p.waitForSelector('.fake-ad'); await p.click('.fake-ad button'); await p.waitForTimeout(300); ok('revive skip: back to game over panel', await st(p)==='over' && await p.isVisible('#over')); }
// 6 interstitial on retry (3rd run)
{ const p=await fresh(); await p.evaluate(()=>{}); let sawAd=false;
  for(let i=0;i<3;i++){ await die(p,i>0); await p.click('#retry'); if(i==2){ try{await p.waitForSelector('.fake-ad',{timeout:1500});sawAd=true;}catch(e){} } await p.waitForTimeout(300); }
  // MIN_AD_GAP: lastAdAt starts 0 so first interstitial is allowed
  ok('retry interstitial shows at run 3', sawAd);
  if(sawAd){ await p.waitForTimeout(2500); ok('retry interstitial: ends & run starts', await st(p)==='play'); } }
// 7 missions x2 & streak x2
const day=today();
const seed={pearls:0,missions:{day,list:[],chars:[]},streak:{count:0,lastDay:null}};
async function missionSeed(){ // build via page: complete all missions
  const p=await fresh(); await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('hop_save')||'{}');}); return p; }
{ const p=await fresh();
  await p.evaluate(async()=>{const m=await import('/src/missions.js');const s={pearls:0,adPearls:{day:'',count:0},dex:[]};m.ensureDaily(s);s.missions.list.forEach(x=>{x.done=true;x.progress=x.target||1});const d=new Date();s.streak={count:1,lastDay:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};localStorage.setItem('hop_save',JSON.stringify(s));});
  await p.reload(); await p.waitForTimeout(700);
  await p.click('#menu .open-missions'); await p.waitForTimeout(300);
  const x2=await p.$$('#missions-list .ghost'); ok('missions: x2 buttons present', x2.length>0);
  const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('hop_save')).pearls||0);
  await x2[0].click(); let gone=await waitAd(p,3800);
  const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('hop_save')).pearls||0);
  ok('mission x2: ad ends, pearls up, state missions', gone && after>before && await st(p)==='missions');
  const sx2=await p.$('#streak .ghost, #streak button.ghost');
  if(sx2){ const b2=after; await sx2.click(); gone=await waitAd(p,3800); const a2=await p.evaluate(()=>JSON.parse(localStorage.getItem('hop_save')).pearls||0); ok('streak x2: ad ends, pearls up', gone && a2>b2 && await st(p)==='missions'); } else ok('streak x2 button found', false);
  ok('missions: no errors',!p.errs.length); }
// 8 timeout / error / never-resolve with mock SDK
for (const [name,body] of [['throws',"requestAd(){throw new Error('x')}"],['never',"requestAd(){}"],['adError',"requestAd(t,c){setTimeout(()=>c.adError('e'),100)}"]]) {
  const ctx=await b.newContext({viewport:{width:1280,height:720}}); const p=await ctx.newPage();
  await p.route('https://sdk.crazygames.com/**', r=>r.fulfill({contentType:'text/javascript',body:`window.CrazyGames={SDK:{init:async()=>{},game:{loadingStart(){},loadingStop(){},gameplayStart(){},gameplayStop(){},settings:{}},ad:{${body}},data:{setItem(){},getItem(){return null}}}}`}));
  await p.addInitScript(()=>{const st=window.setTimeout;window.setTimeout=(f,ms,...a)=>st(f,ms===45000?1500:ms,...a)});
  await p.goto('http://127.0.0.1:8123/?platform=crazygames&debug'); await p.waitForTimeout(800);
  await p.click('#menu .open-shop'); await p.click('#free-pearls'); await p.waitForTimeout(2500);
  ok(`sdk ${name}: game recovers (shop shown, button enabled)`, await p.isVisible('#shop') && await p.isEnabled('#free-pearls') && await st(p)==='shop'); }
await b.close();
const f=results.filter(r=>!r[1]).length; console.log(`\n${results.length-f}/${results.length} passed`);
