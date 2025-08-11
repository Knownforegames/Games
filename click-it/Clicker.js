// Minimal game logic
const fmt = n => n>=1e9? (n/1e9).toFixed(2)+'b' : n>=1e6? (n/1e6).toFixed(2)+'m' : n>=1e3? (n/1e3).toFixed(2)+'k' : Math.floor(n);
const saveKey = 'clicker.save.v1';
let S = { score:0, perClick:1, mult:0, autos:0, crit:0.03, best:0 };
try { Object.assign(S, JSON.parse(localStorage.getItem(saveKey)||'{}')); } catch {}

const $ = id => document.getElementById(id);
const orb = $('orb'), scoreEl=$('score'), pcEl=$('perClick'), cpsEl=$('cps');
const multInfo=$('multInfo'), autoInfo=$('autoInfo'), critInfo=$('critInfo');
const buyMult=$('buyMult'), buyAuto=$('buyAuto'), buyCrit=$('buyCrit');

const priceMult = l => Math.floor(25 * Math.pow(1.3,l));
const priceAuto = n => Math.floor(50 * Math.pow(1.45,n));
const priceCrit = c => Math.floor(200 * Math.pow(1.9, Math.round(c*100)/5));
const cps = () => S.autos * (1 + S.mult * 0.1);

function ui(){
  scoreEl.textContent = fmt(S.score);
  pcEl.textContent = S.perClick.toFixed(2);
  cpsEl.textContent = cps().toFixed(2);
  multInfo.textContent = `Level ${S.mult} • Cost: ${fmt(priceMult(S.mult))}`;
  autoInfo.textContent = `Owned ${S.autos} • Cost: ${fmt(priceAuto(S.autos))}`;
  critInfo.textContent = `Chance ${(S.crit*100).toFixed(0)}% • Cost: ${fmt(priceCrit(S.crit))}`;
}
ui();

orb.addEventListener('click', ()=>{
  const crit = Math.random() < S.crit;
  S.score += S.perClick * (crit?5:1);
  ui();
});

setInterval(()=>{ S.score += cps() / 20; S.best = Math.max(S.best, cps()); ui(); }, 50);
setInterval(()=> localStorage.setItem(saveKey, JSON.stringify(S)), 1500);

buyMult.onclick = ()=>{ const c=priceMult(S.mult); if(S.score>=c){S.score-=c; S.mult++; S.perClick=+(S.perClick*1.25).toFixed(2); ui();}};
buyAuto.onclick = ()=>{ const c=priceAuto(S.autos); if(S.score>=c){S.score-=c; S.autos++; ui();}};
buyCrit.onclick = ()=>{ const c=priceCrit(S.crit); if(S.score>=c && S.crit<0.5){S.score-=c; S.crit=Math.min(0.5, S.crit+0.02); ui();}};

$('reset').onclick = ()=>{
  if(confirm('Reset your save?')){
    S = { score:0, perClick:1, mult:0, autos:0, crit:0.03, best:0 };
    ui(); localStorage.setItem(saveKey, JSON.stringify(S));
  }
};
