/* Journey: templates and sets, their storage, the clocks that say when to change something, and the autopilot. */
import { cam, norm } from "./camera.js";
import { requestWorld, scene, selJT, setLook, setMirrors, setMotion, setOverlay } from "./choose.js";
import { clock } from "./clock.js";
import { $, toast } from "./dom.js";
import { deAt } from "./flight.js";
import { press, wakeHud } from "./input.js";
import { landH, landKind, landMode, lhead, lpos, setLand, setLandKind } from "./land.js";
import { LK } from "./landscapes.js";
import { liveAudio, soundChanged } from "./listen.js";
import { packD } from "./pack-worlds.js";
import { PALETTES, palOpen, setPalette } from "./palettes.js";
import { LOOKS, MOTIONS, OVERLAYS, mirrors, sel } from "./state.js";
import { keepAwake } from "./vr.js";
import { tr, warpThen } from "./warp.js";
import { WORLDS } from "./worlds.js";
export let jt; /* the template in use */
export let journey=false;   /* Journey is on */
export let jMove="travel";  /* "travel" flies and steers for you; "drift" leaves the flying to you and only changes the scenery */
export function jtReset(){jt=BUILTIN_T[0];}
export let CATS, BUILTIN_T, BUILTIN_S, jset;

export const MODE_LABEL={off:"off",keep:"as set",random:"random"};
export function catOf(k){for(var i=0;i<CATS.length;i++)if(CATS[i].k===k)return CATS[i];return null;}
export function normT(src,builtin){ /* fill in anything missing so every template is complete */
  var t={name:String(src.name||"Untitled").slice(0,28),builtin:!!builtin};
  CATS.forEach(function(c){
    var o=src[c.k]||{},mode=c.modes.indexOf(o.mode)>=0?o.mode:(c.k==="world"||c.k==="palette"?"random":"keep");
    var keys=c.opts.map(function(x){return x[0]});
    t[c.k]={mode:mode,every:Math.max(4,Math.min(600,+o.every||c.every)),
            set:Array.isArray(o.set)?o.set.map(String).filter(function(x){return keys.indexOf(x)>=0}):null};
  });
  t.world.trigger=(src.world&&src.world.trigger==="sound")?"sound":"timer";
  var nn=src.mirrors&&String(src.mirrors.none);t.mirrors.none=(nn==="50"||nn==="75")?nn:"even";
  return t;
}
export function normS(src,builtin){
  var items=(Array.isArray(src.items)?src.items:[]).map(function(it){return {tpl:String(it.tpl||""),min:Math.max(0.25,Math.min(120,+it.min||2))}});
  return {name:String(src.name||"Untitled set").slice(0,28),builtin:!!builtin,order:src.order==="random"?"random":"cycle",items:items};
}
export const store={tpls:[],sets:[],sel:"t:Classic"};
export function adopt(raw){ /* take templates and sets from saved or pasted data, skipping names the built-ins use */
  var bt=BUILTIN_T.map(function(t){return t.name}),bs=BUILTIN_S.map(function(x){return x.name}),seen={};
  var rt=Array.isArray(raw.templates)?raw.templates:raw.tpls; /* packs say "templates"; older backups say "tpls" */
  var tp=(Array.isArray(rt)?rt:[]).map(function(t){return normT(t,false)}).filter(function(t){if(bt.indexOf(t.name)>=0||seen["t"+t.name])return false;seen["t"+t.name]=1;return true});
  var st=(Array.isArray(raw.sets)?raw.sets:[]).map(function(x){return normS(x,false)}).filter(function(x){if(bs.indexOf(x.name)>=0||seen["s"+x.name])return false;seen["s"+x.name]=1;return true});
  return {tpls:tp,sets:st};
}
export function saveStore(){try{localStorage.setItem("mirrorfold-journeys",JSON.stringify(store))}catch(_){}}
export function allT(){return BUILTIN_T.concat(store.tpls)}
export function allS(){return BUILTIN_S.concat(store.sets)}
export function findT(n){var a=allT();for(var i=0;i<a.length;i++)if(a[i].name===n)return a[i];return null;}
export function findS(n){var a=allS();for(var i=0;i<a.length;i++)if(a[i].name===n)return a[i];return null;}

export function jCur(k){return k==="world"?scene.world.id:k==="palette"?PALETTES[sel.pi].name:k==="mirrors"?String(mirrors[sel.mi]):k==="motion"?MOTIONS[sel.moi].name:k==="filter"?LOOKS[sel.lki].name:k==="land"?(landMode?LK[landKind].id+(landMode===2?" over":" alone"):"none"):OVERLAYS[sel.ovi].name;}
export function jNone(k){return k==="mirrors"?"0":"none";}
function jIndex(k,key){var o=catOf(k).opts;for(var i=0;i<o.length;i++)if(o[i][0]===key)return i;return -1;}
export function jApply(k,key){ /* false means it could not start yet (a transition is running) and should be retried */
  var i=jIndex(k,key);
  if(i<0||key===jCur(k))return true;
  if(k==="world"){if(tr.warpDir!==0)return false;requestWorld(i);return true;}
  if(k==="mirrors")return warpThen(function(){setMirrors(i)});
  if(k==="land")return warpThen(function(){
    var sp=key.split(" "),kk;for(kk=0;kk<LK.length;kk++)if(LK[kk].id===sp[0])setLandKind(kk);
    setLand(key==="none"?0:sp[1]==="over"?2:1);
  });
  if(k==="palette")setPalette(i);else if(k==="motion")setMotion(i);else if(k==="filter")setLook(i);else setOverlay(i);
  return true;
}
export function jPool(k,cfg){
  var out=[];
  catOf(k).opts.forEach(function(o,i){
    if(cfg.set&&cfg.set.indexOf(o[0])<0)return;
    if(k==="palette"&&!palOpen(i))return;
    out.push(o[0]);
  });
  return out;
}
export function jPick(k,cfg,cur,pool){
  if(!pool.length)return cur;
  if(k==="mirrors"&&cfg.none!=="even"&&pool.indexOf("0")>=0){ /* weighted toward no mirrors */
    var rest=pool.filter(function(x){return x!=="0"});
    if(!rest.length||Math.random()<(cfg.none==="50"?0.5:0.75))return "0";
    return rest[Math.floor(Math.random()*rest.length)];
  }
  var others=pool.filter(function(x){return x!==cur});
  if(!others.length)return pool[0];
  return others[Math.floor(Math.random()*others.length)];
}
export function applyTemplate(t,announce){
  jt=t;
  CATS.forEach(function(c){
    var cfg=t[c.k];J[c.k].base=cfg.every;jReset(c.k);
    if(!journey||cfg.mode!=="random")return;
    var pool=jPool(c.k,cfg);
    if(pool.length&&pool.indexOf(jCur(c.k))<0)J[c.k].t=J[c.k].next+1; /* what is showing is not in this template's options: change at once */
  });
  if(announce)toast("Journey: "+t.name);
}
export function advanceSet(){
  var items=jset.s.items.filter(function(it){return findT(it.tpl)});
  if(!items.length){jset=null;applyTemplate(BUILTIN_T[0]);return;}
  var n=items.length,i=jset.idx;
  if(jset.s.order==="random"&&n>1){var r;do{r=Math.floor(Math.random()*n)}while(r===i);i=r;}else i=(i+1)%n;
  jset.idx=i;jset.t=0;jset.len=items[i].min*60;
  applyTemplate(findT(items[i].tpl),true);
}
export function selectJourney(sel){
  var kind=sel.charAt(0),name=sel.slice(2),S=kind==="s"?findS(name):null,T=kind==="t"?findT(name):null;
  if(S){store.sel=sel;jset={s:S,idx:-1,t:0,len:0};advanceSet();}
  else{if(!T){T=BUILTIN_T[0];sel="t:"+T.name;}store.sel=sel;jset=null;applyTemplate(T);}
  fillJT();saveStore();
}
export function fillJT(){
  selJT.textContent="";
  var g1=document.createElement("optgroup");g1.label="Templates";
  allT().forEach(function(t){var o=document.createElement("option");o.value="t:"+t.name;o.textContent="Journey: "+t.name;g1.appendChild(o)});
  var g2=document.createElement("optgroup");g2.label="Sets";
  allS().forEach(function(x){var o=document.createElement("option");o.value="s:"+x.name;o.textContent="Set: "+x.name;g2.appendChild(o)});
  selJT.appendChild(g1);selJT.appendChild(g2);
  selJT.value=store.sel;if(selJT.value!==store.sel){store.sel="t:Classic";selJT.value=store.sel;}
}
function setJMove(mv){
  jMove=mv==="drift"?"drift":"travel";$("bJMove").textContent="Movement "+jMove;
  try{localStorage.setItem("mirrorfold-move",jMove)}catch(_){}
}
export function setJourney(on){
  journey=on;press($("bJourney"),on);$("rowJourney").hidden=!on;
  if(on)selectJourney(store.sel);
  keepAwake();
}

/* Travel: steer toward open space. Over land that means toward whichever side is lower, keeping to the valleys with the view a little below level; in a world it means comparing the distance to the right, left, up and down. */
export function autopilot(fr){
  var dt=fr.dt,hands=fr.hands,dist=fr.dist,pk=fr.pk,m=fr.m;
  if(landMode){ /* over land the autopilot turns toward whichever side is lower, so it keeps to the valleys, and holds the view a little below level */
    var lrx=lhead[1],lrz=-lhead[0],lc=Math.cos(0.55)*1.3,ls=Math.sin(0.55)*1.3;
    var hL=landH(lpos[0]+lhead[0]*lc-lrx*ls,lpos[2]+lhead[1]*lc-lrz*ls,4),hR=landH(lpos[0]+lhead[0]*lc+lrx*ls,lpos[2]+lhead[1]*lc+lrz*ls,4);
    cam.lookX+=(Math.max(-0.5,Math.min(0.5,(hL-hR)*1.6))+0.08*Math.sin(clock.time*0.13))*dt*hands;
    cam.lookY+=(cam.F[1]+0.10)*0.6*dt*hands;
  }else{
    var pr=Math.min(1,Math.max(0.06,dist*5));
    var pd=function(sx,sy){
      var d=norm([cam.F[0]+0.7*(cam.R[0]*sx+cam.Up[0]*sy),cam.F[1]+0.7*(cam.R[1]*sx+cam.Up[1]*sy),cam.F[2]+0.7*(cam.R[2]*sx+cam.Up[2]*sy)]);
      return Math.abs(deAt(cam.pos[0]+d[0]*pr,cam.pos[1]+d[1]*pr,cam.pos[2]+d[2]*pr,m));
    };
    var dR=pk?packD[1]:pd(1,0),dL=pk?packD[2]:pd(-1,0),dU=pk?packD[3]:pd(0,1),dD=pk?packD[4]:pd(0,-1);
    cam.lookX+=((dR-dL)/(dR+dL+1e-6)*1.1+0.22*Math.sin(clock.time*0.13)+0.12*Math.sin(clock.time*0.37+1.3))*dt*hands;
    cam.lookY+=((dD-dU)/(dD+dU+1e-6)*1.1+0.16*Math.sin(clock.time*0.11+2.0)+0.10*Math.sin(clock.time*0.29))*dt*hands;
  }
}

/* Run Journey's clocks: move on through a set, and change whatever the template says is due. */
export function stepJourney(dt){
  for(var jk in J)J[jk].t+=dt;
  if(jset){jset.t+=dt;if(jset.t>jset.len)advanceSet();}
  for(var ci=0;ci<CATS.length;ci++){
    var ck=CATS[ci].k,cf=jt[ck];
    if(cf.mode==="off"){if(jCur(ck)!==jNone(ck))jApply(ck,jNone(ck));continue;}
    if(cf.mode!=="random")continue;
    var due=J[ck].t>J[ck].next;
    if(ck==="world"&&cf.trigger==="sound"&&liveAudio()){ /* wait for the music to shift, but never forever */
      due=(soundChanged&&J.world.t>Math.max(10,cf.every*0.25))||J.world.t>cf.every*2.5;
    }
    if(due&&jApply(ck,jPick(ck,cf,jCur(ck),jPool(ck,cf))))jReset(ck);
  }
}
/* journey clocks: each change has a target interval and fires within a fifth either side of it */
export const J={world:{base:55},palette:{base:21},mirrors:{base:20},motion:{base:24},filter:{base:27},overlay:{base:22},land:{base:80}};
export function jReset(k){J[k].t=0;J[k].next=J[k].base*(0.8+0.4*Math.random());}
function jResetAll(){for(var k in J)jReset(k);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
jResetAll();
/* ---------- journey templates ----------
   A template sets, for each of seven categories, whether a journey leaves it alone, forces it off, or changes it at random,
   how often, and from which options. A set plays several templates in turn. */
CATS=[
 {k:"world",label:"Worlds",every:55,modes:["keep","random"],opts:WORLDS.map(function(w){return [w.id,w.name]})},
 {k:"palette",label:"Palettes",every:21,modes:["keep","random"],opts:PALETTES.map(function(q){return [q.name,q.name]})},
 {k:"mirrors",label:"Mirrors",every:20,modes:["off","keep","random"],opts:mirrors.map(function(n){return [String(n),n?String(n):"none"]})},
 {k:"motion",label:"Motions",every:24,modes:["off","keep","random"],opts:MOTIONS.map(function(o){return [o.name,o.name]})},
 {k:"filter",label:"Filters",every:27,modes:["off","keep","random"],opts:LOOKS.map(function(o){return [o.name,o.name]})},
 {k:"overlay",label:"Overlays",every:22,modes:["off","keep","random"],opts:OVERLAYS.map(function(o){return [o.name,o.name]})},
 /* the land: "none", or a landscape's id followed by " alone" or " over" (over the world) */
 {k:"land",label:"Land",every:80,modes:["off","keep","random"],opts:[].concat.apply([["none","none"]],LK.map(function(K){var n=K.name.replace("Land is ","");return [[K.id+" alone",n+", alone"],[K.id+" over",n+", over the world"]]}))}
];
BUILTIN_T=[
 {name:"Classic",mirrors:{mode:"off"}},
 {name:"Everything",mirrors:{mode:"random",none:"50"},motion:{mode:"random"},filter:{mode:"random"},overlay:{mode:"random"}},
 {name:"Clean flight",mirrors:{mode:"off"},motion:{mode:"off"},filter:{mode:"off"},overlay:{mode:"off"}},
 {name:"MilkDrop",mirrors:{mode:"off"},motion:{mode:"random",set:["Melt","Vortex","Tunnel","Implode","Ripple","Drift"]},
  filter:{mode:"random",set:["none","Echo","Neon","Solar","Liquid","Prism","Thermal","Contour"]},overlay:{mode:"random"}},
 {name:"Kaleidoscope",mirrors:{mode:"random",set:["3","4","6","8","12"]},motion:{mode:"off"},filter:{mode:"random",set:["none","Quad","Tiles","Twirl","Prism"]},overlay:{mode:"off"}},
 {name:"Calm",world:{every:90,set:["coral","julia","aurora","nebula","gates","halls","temple"]},palette:{every:40},mirrors:{mode:"off"},
  motion:{mode:"random",every:50,set:["none","Melt","Drift"]},filter:{mode:"random",every:60,set:["none","Liquid"]},overlay:{mode:"off"}},
 {name:"Landscapes",world:{every:70},mirrors:{mode:"off"},land:{mode:"random",every:80}},
 {name:"Follow the music",world:{trigger:"sound",every:45},mirrors:{mode:"random",none:"75"},motion:{mode:"random"},overlay:{mode:"random",set:["Ring","Scope","Spectrum","Spokes"]}}
].map(function(t){return normT(t,true)});
BUILTIN_S=[normS({name:"Grand tour",order:"cycle",items:[{tpl:"Clean flight",min:2},{tpl:"MilkDrop",min:2},{tpl:"Kaleidoscope",min:2},{tpl:"Everything",min:3}]},true)];
try{
  var rawJ=JSON.parse(localStorage.getItem("mirrorfold-journeys")||"{}"),got=adopt(rawJ);
  store.tpls=got.tpls;store.sets=got.sets;if(typeof rawJ.sel==="string")store.sel=rawJ.sel;
}catch(_){}
jt=BUILTIN_T[0],jset=null;
fillJT();
selJT.addEventListener("change",function(){selectJourney(this.value);wakeHud()});
try{if(localStorage.getItem("mirrorfold-move")==="drift")jMove="drift"}catch(_){}
$("bJMove").textContent="Movement "+jMove;
$("bJMove").addEventListener("click",function(){
  setJMove(jMove==="travel"?"drift":"travel");
  toast(jMove==="travel"?"Journey flies for you":"Journey leaves the flying to you");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={jtReset, MODE_LABEL, catOf, normT, normS, store, adopt, saveStore, allT, allS,
  findT, findS, jCur, jNone, jIndex, jApply, jPool, jPick, applyTemplate, advanceSet,
  selectJourney, fillJT, setJMove, setJourney, autopilot, stepJourney, J, jReset, jResetAll, get jt(){return jt},set jt(v){jt=v},
  get journey(){return journey},set journey(v){journey=v}, get jMove(){return jMove},set jMove(v){jMove=v}, get CATS(){return CATS},set CATS(v){CATS=v}, get BUILTIN_T(){return BUILTIN_T},set BUILTIN_T(v){BUILTIN_T=v}, get BUILTIN_S(){return BUILTIN_S},set BUILTIN_S(v){BUILTIN_S=v}, get jset(){return jset},set jset(v){jset=v}};
