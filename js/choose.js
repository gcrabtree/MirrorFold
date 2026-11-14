/* what is showing */
import { cam } from "./camera.js";
import { morphValue } from "./clock.js";
import { $, calm, errBox } from "./dom.js";
import { wakeHud } from "./input.js";
import { started } from "./loop.js";
import { spawnOrb } from "./orbs.js";
import { deMany } from "./pack-worlds.js";
import { fillPalettes, setPalette } from "./palettes.js";
import { build } from "./programs.js";
import { applySpot, fromHash } from "./spots.js";
import { LOOKS, MOTIONS, OVERLAYS, OVS, mirrors, sel } from "./state.js";
import { beginWarp, tr } from "./warp.js";
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
export function setWorldNow(i,quiet){
  var w=WORLDS[i];
  try{build(w)}catch(e){errBox.textContent=w.name+" did not compile on this device, so it is skipped.\n"+e.message;selWorld.value=String(WORLDS.indexOf(scene.world));return false;}
  errBox.textContent="";
  scene.world=w;
  cam.pos=w.start?w.start.slice():[0,0,0];cam.vel=[0,0,0];
  var m=morphValue();
  if(!w.start||w.de(cam.pos[0],cam.pos[1],cam.pos[2],m)<0.02){ /* no fixed start, or it is inside something at this morph: find open space */
    var per=w.period(m),best=-1,ns=w.pack?96:300,sc=new Float32Array(3*ns),k;
    for(k=0;k<3*ns;k++)sc[k]=(Math.random()-.5)*per[k%3];
    var sd=deMany(w,sc,ns,m);
    for(k=0;k<ns;k++)if(sd[k]>best){best=sd[k];cam.pos=[sc[3*k],sc[3*k+1],sc[3*k+2]];}
  }
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
  setMirrors, get selMusic(){return selMusic},set selMusic(v){selMusic=v}, get selJT(){return selJT},set selJT(v){selJT=v}, get selWorld(){return selWorld},set selWorld(v){selWorld=v}, get selOv(){return selOv},set selOv(v){selOv=v}, get selMotion(){return selMotion},set selMotion(v){selMotion=v}, get selLook(){return selLook},set selLook(v){selLook=v}};
