/* what is showing */
import { cam } from "./camera.js";
import { morphValue } from "./clock.js";
import { $, calm, errBox, toast } from "./dom.js";
import { press } from "./input.js";
import { wakeHud } from "./input.js";
import { started } from "./loop.js";
import { spawnOrb } from "./orbs.js";
import { deMany } from "./pack-worlds.js";
import { PACKINGS, packing, pkDeep, pkMix, pkOn, pkWave, setPackingNow, setPkMix, setPkWave } from "./packing.js";
import { fillPalettes, setPalette } from "./palettes.js";
import { build, setProgSet } from "./programs.js";
import { setChrome } from "./shaders.js";
import { applySpot, fromHash } from "./spots.js";
import { LOOKS, MOTIONS, OVERLAYS, OVS, SURFACES, mirrors, sel } from "./state.js";
import { beginWarp, tr, warpThen } from "./warp.js";
import { WORLDS } from "./worlds.js";
import { zoomEnter } from "./zoom.js";
export const scene={
  world:null,   /* the current entry of WORLDS */
  orb:null,orbT:0, /* the orb's place and size, and a timer for checking it is still in open space */
  lastHash:""   /* the address hash last written, so our own change is not read back as a request */
};
export let selMusic, selJT;
let selWorld, selOv, selMotion, selLook;

export function fillMotions(){
  selMotion.textContent="";
  MOTIONS.forEach(function(o2,i){var o=document.createElement("option");o.value=String(i);o.textContent="Motion: "+o2.name;selMotion.appendChild(o);});
  selMotion.value=String(sel.moi);
}
export function fillLooks(){
  selLook.textContent="";
  LOOKS.forEach(function(o2,i){var o=document.createElement("option");o.value=String(i);o.textContent="Filter: "+o2.name;selLook.appendChild(o);});
  selLook.value=String(sel.lki);
}
export function fillOverlays(){
  selOv.textContent="";
  OVERLAYS.forEach(function(o2,i){var o=document.createElement("option");o.value=String(i);o.textContent="Overlay: "+o2.name;selOv.appendChild(o);});
  selOv.value=String(sel.ovi);
}
export function setOvS(i){sel.ovsi=OVS[i]===undefined?2:i;$("bOvS").textContent="Overlay "+Math.round(OVS[sel.ovsi]*100)+"%";}
export function setOverlay(i){if(!OVERLAYS[i])i=0;sel.ovi=i;selOv.value=String(i);}
export function setMotion(i){if(!MOTIONS[i])i=0;sel.moi=i;selMotion.value=String(i);}
export function setLook(i){if(!LOOKS[i])i=0;sel.lki=i;selLook.value=String(i);}
export function fillWorlds(){selWorld.textContent="";WORLDS.forEach(function(w,i){var o=document.createElement("option");o.value=String(i);o.textContent=w.name;selWorld.appendChild(o);});if(scene.world)selWorld.value=String(WORLDS.indexOf(scene.world));}
/* Put the camera at a world's start, or in open space where it has no fixed start, the start is inside something at
   this morph, or the packing in use has moved the shapes. */
function placeCam(w){
  var fixed=w.start&&!pkOn(w),m=morphValue();
  cam.pos=fixed?w.start.slice():[0,0,0];cam.vel=[0,0,0];
  if(pkDeep(w)){cam.pos=[.12*w.grid,.08*w.grid,2.5*w.grid];cam.F=[0,0,-1];cam.R=[-1,0,0];cam.Up=[0,1,0];return;} /* the descent: between two cages, looking in along one of the six ways through */
  if(!fixed||w.de(cam.pos[0],cam.pos[1],cam.pos[2],m)<0.02){
    var per=w.period(m),best=-1,ns=w.pack?96:300,sc=new Float32Array(3*ns),k;
    for(k=0;k<3*ns;k++)sc[k]=(Math.random()-.5)*per[k%3];
    var sd=deMany(w,sc,ns,m);
    for(k=0;k<ns;k++)if(sd[k]>best){best=sd[k];cam.pos=[sc[3*k],sc[3*k+1],sc[3*k+2]];}
  }
}
/* Packing: how the worlds made of one shape repeated set their copies out (js/packing.js). The choice is kept in this
   browser. Changing it moves every shape in such a world, so the camera is put in open space again. */
export function setPacking(i){
  var w=scene.world,was=packing;
  setPackingNow(i);
  $("bPack").textContent="Packing "+PACKINGS[packing].name;
  try{localStorage.setItem("mirrorfold-packing",PACKINGS[packing].name)}catch(_){}
  if(w&&w.packs&&was!==packing){placeCam(w);spawnOrb();}
}
/* The programs in use are the set for what is chosen now: the chrome surface, and mixed shapes (js/programs.js). The
   world in use is made at once if it has not been made that way yet. False if it cannot be made. */
export function progSync(){
  var c=SURFACES[sel.si].name==="chrome";
  setChrome(c);setProgSet((pkMix?"m":"")+(c?"c":""),WORLDS);
  if(scene.world&&!scene.world.pack){try{build(scene.world)}catch(_){return false;}}
  return true;
}
/* The pulse: the copies in a packing change shape together, or in a wave (js/packing.js). Kept in this browser. Each
   copy's shape changes at once, so the camera is put in open space again. */
export function setPulse(on){
  var w=scene.world,was=pkWave;
  setPkWave(on);
  $("bPulse").textContent="Pulse "+(pkWave?"wave":"together");press($("bPulse"),pkWave);
  try{localStorage.setItem("mirrorfold-pulse",pkWave?"wave":"together")}catch(_){}
  if(w&&pkOn(w)&&was!==pkWave){placeCam(w);spawnOrb();}
}
/* The shapes: all one kind, or mixed, where the world's own shape shares the space with two others. Kept in this
   browser. Mixed needs a larger program for each world, made when it is first wanted. */
export function setMix(on){
  var w=scene.world,was=pkMix;
  setPkMix(on);
  if(!progSync()){setPkMix(false);progSync();toast("Mixed shapes do not work on this device.");}
  $("bMix").textContent="Shapes "+(pkMix?"mixed":"one kind");press($("bMix"),pkMix);
  try{localStorage.setItem("mirrorfold-shapes",pkMix?"mixed":"one kind")}catch(_){}
  if(w&&pkOn(w)&&was!==pkMix){placeCam(w);spawnOrb();}
}
/* The user's choice of either: behind a transition where it shows, and with a word of why nothing is seen where it does not. */
function requestOpt(set,on,name){
  var fn=function(){set(on)};
  if(!pkOn(scene.world)){fn();toast(name+" is set. It shows in every packing but the grid, in "+WORLDS.filter(function(w){return w.packs}).map(function(w){return w.name}).join(", ")+".");return;}
  if(!started||calm||!warpThen(fn))fn();
}
/* The user's choice of packing: behind a transition in a world it changes, and with a word of why nothing is seen in one it does not. */
export function requestPacking(i){
  var fn=function(){setPacking(i)};
  if(!PACKINGS[i]||i===packing)return;
  if(!scene.world.packs){fn();toast("Packing "+PACKINGS[i].name+" is set. It shows in "+WORLDS.filter(function(w){return w.packs}).map(function(w){return w.name}).join(", ")+".");return;}
  if(!started||calm||!warpThen(fn))fn();
}
export function setWorldNow(i,quiet){
  var w=WORLDS[i];
  try{build(w)}catch(e){errBox.textContent=w.name+" did not compile on this device, so it is skipped.\n"+e.message;selWorld.value=String(WORLDS.indexOf(scene.world));return false;}
  errBox.textContent="";
  scene.world=w;
  placeCam(w);
  if(w.flat)zoomEnter(w);
  selWorld.value=String(i);
  spawnOrb();
  if(!quiet){scene.lastHash=w.id;try{location.hash=w.id}catch(_){}}
  return true;
}
export function requestWorld(i,quiet,after){
  if(i<0||i>=WORLDS.length)return;
  if(WORLDS[i]===scene.world&&!after)return;
  var fn=function(){if(setWorldNow(i,quiet)&&after)after();};
  if(!started||calm){fn();return;}
  tr.pendingWorld=i;tr.warpFn=fn;beginWarp(); /* transition out, swap at the peak, transition back in */
}
export function setMirrors(k){sel.mi=k;$("bMirror").textContent=mirrors[sel.mi]?("Mirrors "+mirrors[sel.mi]):"Mirrors off";}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
selWorld=$("selWorld"),selMusic=$("selMusic"),selJT=$("selJT"),selOv=$("selOv"),selMotion=$("selMotion"),selLook=$("selLook");
fillMotions();
fillLooks();
fillOverlays();
selOv.addEventListener("change",function(){setOverlay(+this.value);wakeHud()});
$("bOvS").addEventListener("click",function(){setOvS((sel.ovsi+1)%OVS.length);wakeHud()});
selMotion.addEventListener("change",function(){setMotion(+this.value);wakeHud()});
selLook.addEventListener("change",function(){setLook(+this.value);wakeHud()});
fillWorlds();
fillPalettes();
(function(){var s="",i;try{s=localStorage.getItem("mirrorfold-packing")||""}catch(_){}for(i=0;i<PACKINGS.length;i++)if(PACKINGS[i].name===s)setPackingNow(i);setPacking(packing);})();
(function(){var a="",b="";try{a=localStorage.getItem("mirrorfold-pulse")||"";b=localStorage.getItem("mirrorfold-shapes")||""}catch(_){}setPulse(a==="wave");setMix(b==="mixed");})();
$("bPulse").addEventListener("click",function(){requestOpt(setPulse,!pkWave,"Pulse "+(pkWave?"together":"wave"));wakeHud()});
$("bMix").addEventListener("click",function(){requestOpt(setMix,!pkMix,"Shapes "+(pkMix?"one kind":"mixed"));wakeHud()});
selWorld.addEventListener("change",function(){requestWorld(+this.value);wakeHud()});
$("selPal").addEventListener("change",function(){setPalette(+this.value);wakeHud()});
(function(){
  var hh=fromHash(),i=hh?hh.i:0;
  if(!setWorldNow(i,true)){for(var j=0;j<WORLDS.length&&!scene.world;j++)setWorldNow(j,true);}
  else if(hh&&hh.spot){applySpot(hh.spot);scene.lastHash=hh.h;}
})();
if(!scene.world){errBox.textContent="None of the fractal shaders compiled on this device.";throw new Error("stop");}
window.addEventListener("hashchange",function(){
  var hh=fromHash();if(!hh||hh.h===scene.lastHash)return;
  scene.lastHash=hh.h;
  requestWorld(hh.i,true,hh.spot?function(){applySpot(hh.spot)}:null);
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={setOvS, scene, fillMotions, fillLooks, fillOverlays, setOverlay, setMotion, setLook, fillWorlds, setWorldNow, requestWorld,
  setMirrors, placeCam, setPacking, requestPacking, progSync, setPulse, setMix, requestOpt, get selMusic(){return selMusic},set selMusic(v){selMusic=v}, get selJT(){return selJT},set selJT(v){selJT=v}, get selWorld(){return selWorld},set selWorld(v){selWorld=v}, get selOv(){return selOv},set selOv(v){selOv=v}, get selMotion(){return selMotion},set selMotion(v){selMotion=v}, get selLook(){return selLook},set selLook(v){selLook=v}};
