import { $, calm, errBox } from "./dom.js";
import { LOOKS, MOTIONS, OVERLAYS, OVS, mirrors } from "./state.js";
import { wakeHud } from "./input.js";
import { BASE_PALS, NPAL, PALETTES, WORLDS, palOpen } from "./worlds.js";
import { beginWarp, cross, morphValue, norm, toast } from "./flight.js";
import { deMany } from "./probe.js";
import { ac, pluck } from "./audio.js";
import { bands } from "./listen.js";
import { saveProgress } from "./shaders.js";
import { build, hybProg } from "./programs.js";
import { G } from "./shared.js";
export let selMusic, selJT;
let selWorld, selPal, selOv, selMotion, selLook;

export function fillMotions(){
  selMotion.textContent="";
  MOTIONS.forEach(function(o2,i){var o=document.createElement("option");o.value=String(i);o.textContent="Motion: "+o2.name;selMotion.appendChild(o);});
  selMotion.value=String(G.moi);
}
export function fillLooks(){
  selLook.textContent="";
  LOOKS.forEach(function(o2,i){var o=document.createElement("option");o.value=String(i);o.textContent="Filter: "+o2.name;selLook.appendChild(o);});
  selLook.value=String(G.lki);
}
export function fillOverlays(){
  selOv.textContent="";
  OVERLAYS.forEach(function(o2,i){var o=document.createElement("option");o.value=String(i);o.textContent="Overlay: "+o2.name;selOv.appendChild(o);});
  selOv.value=String(G.ovi);
}
export function setOverlay(i){if(!OVERLAYS[i])i=0;G.ovi=i;selOv.value=String(i);}
export function setMotion(i){if(!MOTIONS[i])i=0;G.moi=i;selMotion.value=String(i);}
export function setLook(i){if(!LOOKS[i])i=0;G.lki=i;selLook.value=String(i);}
export function fillWorlds(){selWorld.textContent="";WORLDS.forEach(function(w,i){var o=document.createElement("option");o.value=String(i);o.textContent=w.name;selWorld.appendChild(o);});if(G.world)selWorld.value=String(WORLDS.indexOf(G.world));}
export function fillPalettes(){
  selPal.textContent="";
  PALETTES.forEach(function(p,i){var o=document.createElement("option");o.value=String(i);selPal.appendChild(o);});
  labelPalettes();selPal.value=String(G.pi);
}
function labelPalettes(){
  Array.prototype.forEach.call(selPal.options,function(o,i){
    var locked=!palOpen(i);o.disabled=locked;o.textContent=PALETTES[i].name+(locked?" (find an orb)":"");
  });
}
export function spawnOrb(){
  var w=G.world,m=morphValue(),per=w.period(m),sc=Math.min(per[0],per[1],per[2])/2,best=-1,bp=null,bd=0;
  var nc=w.pack?96:260,cand=new Float32Array(3*nc),k;
  for(k=0;k<3*nc;k++)cand[k]=(Math.random()-.5)*per[k%3];
  var cd=deMany(w,cand,nc,m);
  for(k=0;k<nc;k++){
    var c=[cand[3*k],cand[3*k+1],cand[3*k+2]];
    var d=Math.abs(cd[k]),far=0;
    for(var i=0;i<3;i++){var q=c[i]-G.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);far+=q*q;}
    var sc2=Math.min(d,0.25*sc)*(Math.sqrt(far)>0.45*sc?1:0.1)*(0.7+0.3*Math.random());
    if(sc2>best){best=sc2;bp=c;bd=d;}
  }
  G.orb={p:bp,r:Math.max(0.012*sc,Math.min(0.05*sc,bd*0.35))};G.orbT=0;
}
function chime(){
  if(ac&&ac.state==="running"&&(G.musicMode==="built"||G.musicMode==="file")){var t=ac.currentTime;pluck(t,880);pluck(t+0.09,1318.5);pluck(t+0.18,1760);}
}
export function collectOrb(){
  G.orbsFound++;bands.b.p=1;G.boost=Math.max(G.boost,0.5);chime();
  if(G.unlocked<NPAL-BASE_PALS){
    G.unlocked++;labelPalettes();setPalette(BASE_PALS+G.unlocked-1);
    toast("Orb found. Palette unlocked: "+PALETTES[G.pi].name);
    spawnOrb();
  }else{
    toast("Orb found. "+G.orbsFound+" so far. Warping on.");
    var nw=(WORLDS.indexOf(G.world)+1+Math.floor(Math.random()*(WORLDS.length-1)))%WORLDS.length;
    G.orb=null;requestWorld(nw);
  }
  saveProgress();
}
function startHybrid(b,mode){
  var a=WORLDS.indexOf(G.world);
  if(a===b||G.world.volume||WORLDS[b].volume||G.world.pack||WORLDS[b].pack){toast("That pair cannot blend.");return false;}
  var o;try{build(WORLDS[b]);o=hybProg(a,b)}catch(e){toast("That blend did not compile on this device.");return false;}
  G.hyb={b:b,prog:o.prog,U:o.U,t:(G.hyb&&G.hyb.b===b)?G.hyb.t:0,mode:mode,exit:false,off:(G.hyb&&G.hyb.b===b)?G.hyb.off:[0,0,0]};
  return true;
}
export function finishHybrid(){
  var B=WORLDS[G.hyb.b],per=B.period(morphValue());
  for(var i=0;i<3;i++){G.pos[i]+=G.hyb.off[i];G.pos[i]-=per[i]*Math.floor(G.pos[i]/per[i]+.5);}
  G.world=B;G.hyb=null;selWorld.value=String(WORLDS.indexOf(B));
  G.lastHash=B.id;try{location.hash=B.id}catch(_){}
  spawnOrb();
}
export function setWorldNow(i,quiet){
  var w=WORLDS[i];
  try{build(w)}catch(e){errBox.textContent=w.name+" did not compile on this device, so it is skipped.\n"+e.message;selWorld.value=String(WORLDS.indexOf(G.world));return false;}
  errBox.textContent="";
  G.world=w;
  G.pos=w.start?w.start.slice():[0,0,0];G.vel=[0,0,0];
  var m=morphValue();
  if(!w.start||w.de(G.pos[0],G.pos[1],G.pos[2],m)<0.02){ /* no fixed start, or it is inside something at this morph: find open space */
    var per=w.period(m),best=-1,ns=w.pack?96:300,sc=new Float32Array(3*ns),k;
    for(k=0;k<3*ns;k++)sc[k]=(Math.random()-.5)*per[k%3];
    var sd=deMany(w,sc,ns,m);
    for(k=0;k<ns;k++)if(sd[k]>best){best=sd[k];G.pos=[sc[3*k],sc[3*k+1],sc[3*k+2]];}
  }
  selWorld.value=String(i);G.hyb=null;
  spawnOrb();
  if(!quiet){G.lastHash=w.id;try{location.hash=w.id}catch(_){}}
  return true;
}
export function requestWorld(i,quiet,after){
  if(i<0||i>=WORLDS.length)return;
  if(WORLDS[i]===G.world&&!G.hyb&&!after)return;
  var fn=function(){if(setWorldNow(i,quiet)&&after)after();};
  if(!G.started||calm){fn();return;}
  G.pendingWorld=i;G.warpFn=fn;beginWarp(); /* transition out, swap at the peak, transition back in */
}
export function warpThen(fn){ /* the same twist, for changes that are not a new world */
  if(!G.started||calm){fn();return true;}
  if(G.warpDir!==0)return false;
  G.warpFn=fn;beginWarp();return true;
}
export function setPalette(i){ /* wraps round, and steps past palettes that are still locked */
  var n=PALETTES.length;i=((i%n)+n)%n;
  while(!palOpen(i))i=(i+1)%n;
  G.pi=i;selPal.value=String(G.pi);
}
function randomPalette(){
  var o=[],i;for(i=0;i<PALETTES.length;i++)if(i!==G.pi&&palOpen(i))o.push(i);
  return o.length?o[Math.floor(Math.random()*o.length)]:G.pi;
}
/* a spot is world, palette, mirrors, position, heading and morph time packed into letters and digits */
function b36(v,len){v=Math.max(0,Math.min(Math.pow(36,len)-1,Math.round(v)));var t=v.toString(36);while(t.length<len)t="0"+t;return t;}
export function encodeSpot(){
  var per=G.world.period(morphValue()),t=b36(G.pi,1)+b36(G.mi,1),i;
  for(i=0;i<3;i++)t+=b36((G.pos[i]/per[i]+0.5)*1295,2);
  t+=b36((Math.atan2(G.F[0],G.F[2])/(2*Math.PI)+0.5)*1295,2)+b36((Math.asin(Math.max(-1,Math.min(1,G.F[1])))/Math.PI+0.5)*1295,2);
  t+=b36(Math.round(G.morphT*4)%1679616,4);
  return G.world.id+"-"+t;
}
function applySpot(t){
  var n=function(a,b){return parseInt(t.slice(a,b),36)};
  var p=n(0,1),k=n(1,2);
  if(p<PALETTES.length&&palOpen(p))setPalette(p);
  if(k<mirrors.length)setMirrors(k);
  G.morphT=n(12,16)/4;
  var per=G.world.period(morphValue()),i;
  for(i=0;i<3;i++)G.pos[i]=(n(2+2*i,4+2*i)/1295-0.5)*per[i];
  var yaw=(n(8,10)/1295-0.5)*2*Math.PI,pit=(n(10,12)/1295-0.5)*Math.PI;
  G.F=[Math.cos(pit)*Math.sin(yaw),Math.sin(pit),Math.cos(pit)*Math.cos(yaw)];
  G.R=norm(cross([0,1,0],G.F));G.Up=cross(G.F,G.R);G.vel=[0,0,0];
  spawnOrb();
}
function fromHash(){
  var h=(location.hash||"").replace("#",""),mm=/^([a-z]+)(?:-([0-9a-z]{16}))?$/.exec(h);
  if(!mm)return null;
  for(var i=0;i<WORLDS.length;i++)if(WORLDS[i].id===mm[1])return {i:i,spot:mm[2]||null,h:h};
  return null;
}
export function setMirrors(k){G.mi=k;$("bMirror").textContent=mirrors[G.mi]?("Mirrors "+mirrors[G.mi]):"Mirrors off";}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- choosing a world ---------- */
selWorld=$("selWorld"),selPal=$("selPal"),selMusic=$("selMusic"),selJT=$("selJT"),selOv=$("selOv"),selMotion=$("selMotion"),selLook=$("selLook");
fillMotions();
fillLooks();
fillOverlays();
selOv.addEventListener("change",function(){setOverlay(+this.value);wakeHud()});
$("bOvS").addEventListener("click",function(){G.ovsi=(G.ovsi+1)%OVS.length;this.textContent="Overlay "+Math.round(OVS[G.ovsi]*100)+"%";wakeHud()});
selMotion.addEventListener("change",function(){setMotion(+this.value);wakeHud()});
selLook.addEventListener("change",function(){setLook(+this.value);wakeHud()});
fillWorlds();
fillPalettes();
selWorld.addEventListener("change",function(){requestWorld(+this.value);wakeHud()});
selPal.addEventListener("change",function(){setPalette(+this.value);wakeHud()});
(function(){
  var hh=fromHash(),i=hh?hh.i:0;
  if(!setWorldNow(i,true)){for(var j=0;j<WORLDS.length&&!G.world;j++)setWorldNow(j,true);}
  else if(hh&&hh.spot){applySpot(hh.spot);G.lastHash=hh.h;}
})();
if(!G.world){errBox.textContent="None of the fractal shaders compiled on this device.";return;}
window.addEventListener("hashchange",function(){
  var hh=fromHash();if(!hh||hh.h===G.lastHash)return;
  G.lastHash=hh.h;
  requestWorld(hh.i,true,hh.spot?function(){applySpot(hh.spot)}:null);
});
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get selWorld(){return selWorld},set selWorld(v){selWorld=v}, get selPal(){return selPal},set selPal(v){selPal=v}, get selMusic(){return selMusic},set selMusic(v){selMusic=v}, get selJT(){return selJT},set selJT(v){selJT=v}, get selOv(){return selOv},set selOv(v){selOv=v}, get selMotion(){return selMotion},set selMotion(v){selMotion=v},
  get selLook(){return selLook},set selLook(v){selLook=v}, get fillMotions(){return fillMotions}, get fillLooks(){return fillLooks}, get fillOverlays(){return fillOverlays}, get setOverlay(){return setOverlay}, get setMotion(){return setMotion},
  get setLook(){return setLook}, get fillWorlds(){return fillWorlds}, get fillPalettes(){return fillPalettes}, get labelPalettes(){return labelPalettes}, get spawnOrb(){return spawnOrb}, get chime(){return chime},
  get collectOrb(){return collectOrb}, get startHybrid(){return startHybrid}, get finishHybrid(){return finishHybrid}, get setWorldNow(){return setWorldNow}, get requestWorld(){return requestWorld}, get warpThen(){return warpThen},
  get setPalette(){return setPalette}, get randomPalette(){return randomPalette}, get b36(){return b36}, get encodeSpot(){return encodeSpot}, get applySpot(){return applySpot}, get fromHash(){return fromHash},
  get setMirrors(){return setMirrors}};
