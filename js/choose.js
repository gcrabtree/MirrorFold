/* what is showing */
import { ac, pluck } from "./audio.js";
import { cam, cross, norm } from "./camera.js";
import { clock, morphValue } from "./clock.js";
import { orbsOn } from "./controls.js";
import { $, calm, errBox } from "./dom.js";
import { toast } from "./flight.js";
import { wakeHud } from "./input.js";
import { bands, musicMode } from "./listen.js";
import { started } from "./loop.js";
import { deMany } from "./probe.js";
import { build, hybProg } from "./programs.js";
import { saveProgress } from "./shaders.js";
import { LOOKS, MOTIONS, OVERLAYS, OVS, mirrors, sel } from "./state.js";
import { beginWarp, tr } from "./warp.js";
import { BASE_PALS, PALETTES, WORLDS, orbCounted, orbsFound, palOpen, unlocked } from "./worlds.js";
export const scene={
  world:null,   /* the current entry of WORLDS */
  hyb:null,     /* a second world being mixed in, or null */
  orb:null,orbT:0, /* the orb's place and size, and a timer for checking it is still in open space */
  lastHash:""   /* the address hash last written, so our own change is not read back as a request */
};
export let selMusic, selJT;
let selWorld, selPal, selOv, selMotion, selLook;

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
export function setOverlay(i){if(!OVERLAYS[i])i=0;sel.ovi=i;selOv.value=String(i);}
export function setMotion(i){if(!MOTIONS[i])i=0;sel.moi=i;selMotion.value=String(i);}
export function setLook(i){if(!LOOKS[i])i=0;sel.lki=i;selLook.value=String(i);}
export function fillWorlds(){selWorld.textContent="";WORLDS.forEach(function(w,i){var o=document.createElement("option");o.value=String(i);o.textContent=w.name;selWorld.appendChild(o);});if(scene.world)selWorld.value=String(WORLDS.indexOf(scene.world));}
export function fillPalettes(){
  selPal.textContent="";
  PALETTES.forEach(function(p,i){var o=document.createElement("option");o.value=String(i);selPal.appendChild(o);});
  labelPalettes();selPal.value=String(sel.pi);
}
function labelPalettes(){
  Array.prototype.forEach.call(selPal.options,function(o,i){
    var locked=!palOpen(i);o.disabled=locked;o.textContent=PALETTES[i].name+(locked?" (find an orb)":"");
  });
}
export function spawnOrb(){
  var w=scene.world,m=morphValue(),per=w.period(m),sc=Math.min(per[0],per[1],per[2])/2,best=-1,bp=null,bd=0;
  var nc=w.pack?96:260,cand=new Float32Array(3*nc),k;
  for(k=0;k<3*nc;k++)cand[k]=(Math.random()-.5)*per[k%3];
  var cd=deMany(w,cand,nc,m);
  for(k=0;k<nc;k++){
    var c=[cand[3*k],cand[3*k+1],cand[3*k+2]];
    var d=Math.abs(cd[k]),far=0;
    for(var i=0;i<3;i++){var q=c[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);far+=q*q;}
    var sc2=Math.min(d,0.25*sc)*(Math.sqrt(far)>0.45*sc?1:0.1)*(0.7+0.3*Math.random());
    if(sc2>best){best=sc2;bp=c;bd=d;}
  }
  scene.orb={p:bp,r:Math.max(0.012*sc,Math.min(0.05*sc,bd*0.35))};scene.orbT=0;
}
function chime(){
  if(ac&&ac.state==="running"&&(musicMode==="built"||musicMode==="file")){var t=ac.currentTime;pluck(t,880);pluck(t+0.09,1318.5);pluck(t+0.18,1760);}
}
export function collectOrb(){
  bands.b.p=1;cam.boost=Math.max(cam.boost,0.5);chime();
  if(orbCounted()){
    labelPalettes();setPalette(BASE_PALS+unlocked-1);
    toast("Orb found. Palette unlocked: "+PALETTES[sel.pi].name);
    spawnOrb();
  }else{
    toast("Orb found. "+orbsFound+" so far. Warping on.");
    var nw=(WORLDS.indexOf(scene.world)+1+Math.floor(Math.random()*(WORLDS.length-1)))%WORLDS.length;
    scene.orb=null;requestWorld(nw);
  }
  saveProgress();
}
function startHybrid(b,mode){
  var a=WORLDS.indexOf(scene.world);
  if(a===b||scene.world.volume||WORLDS[b].volume||scene.world.pack||WORLDS[b].pack){toast("That pair cannot blend.");return false;}
  var o;try{build(WORLDS[b]);o=hybProg(a,b)}catch(e){toast("That blend did not compile on this device.");return false;}
  scene.hyb={b:b,prog:o.prog,U:o.U,t:(scene.hyb&&scene.hyb.b===b)?scene.hyb.t:0,mode:mode,exit:false,off:(scene.hyb&&scene.hyb.b===b)?scene.hyb.off:[0,0,0]};
  return true;
}
export function finishHybrid(){
  var B=WORLDS[scene.hyb.b],per=B.period(morphValue());
  for(var i=0;i<3;i++){cam.pos[i]+=scene.hyb.off[i];cam.pos[i]-=per[i]*Math.floor(cam.pos[i]/per[i]+.5);}
  scene.world=B;scene.hyb=null;selWorld.value=String(WORLDS.indexOf(B));
  scene.lastHash=B.id;try{location.hash=B.id}catch(_){}
  spawnOrb();
}
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
  selWorld.value=String(i);scene.hyb=null;
  spawnOrb();
  if(!quiet){scene.lastHash=w.id;try{location.hash=w.id}catch(_){}}
  return true;
}
export function requestWorld(i,quiet,after){
  if(i<0||i>=WORLDS.length)return;
  if(WORLDS[i]===scene.world&&!scene.hyb&&!after)return;
  var fn=function(){if(setWorldNow(i,quiet)&&after)after();};
  if(!started||calm){fn();return;}
  tr.pendingWorld=i;tr.warpFn=fn;beginWarp(); /* transition out, swap at the peak, transition back in */
}
export function warpThen(fn){ /* the same twist, for changes that are not a new world */
  if(!started||calm){fn();return true;}
  if(tr.warpDir!==0)return false;
  tr.warpFn=fn;beginWarp();return true;
}
export function setPalette(i){ /* wraps round, and steps past palettes that are still locked */
  var n=PALETTES.length;i=((i%n)+n)%n;
  while(!palOpen(i))i=(i+1)%n;
  sel.pi=i;selPal.value=String(sel.pi);
}
function randomPalette(){
  var o=[],i;for(i=0;i<PALETTES.length;i++)if(i!==sel.pi&&palOpen(i))o.push(i);
  return o.length?o[Math.floor(Math.random()*o.length)]:sel.pi;
}
/* a spot is world, palette, mirrors, position, heading and morph time packed into letters and digits */
function b36(v,len){v=Math.max(0,Math.min(Math.pow(36,len)-1,Math.round(v)));var t=v.toString(36);while(t.length<len)t="0"+t;return t;}
export function encodeSpot(){
  var per=scene.world.period(morphValue()),t=b36(sel.pi,1)+b36(sel.mi,1),i;
  for(i=0;i<3;i++)t+=b36((cam.pos[i]/per[i]+0.5)*1295,2);
  t+=b36((Math.atan2(cam.F[0],cam.F[2])/(2*Math.PI)+0.5)*1295,2)+b36((Math.asin(Math.max(-1,Math.min(1,cam.F[1])))/Math.PI+0.5)*1295,2);
  t+=b36(Math.round(clock.morphT*4)%1679616,4);
  return scene.world.id+"-"+t;
}
function applySpot(t){
  var n=function(a,b){return parseInt(t.slice(a,b),36)};
  var p=n(0,1),k=n(1,2);
  if(p<PALETTES.length&&palOpen(p))setPalette(p);
  if(k<mirrors.length)setMirrors(k);
  clock.morphT=n(12,16)/4;
  var per=scene.world.period(morphValue()),i;
  for(i=0;i<3;i++)cam.pos[i]=(n(2+2*i,4+2*i)/1295-0.5)*per[i];
  var yaw=(n(8,10)/1295-0.5)*2*Math.PI,pit=(n(10,12)/1295-0.5)*Math.PI;
  cam.F=[Math.cos(pit)*Math.sin(yaw),Math.sin(pit),Math.cos(pit)*Math.cos(yaw)];
  cam.R=norm(cross([0,1,0],cam.F));cam.Up=cross(cam.F,cam.R);cam.vel=[0,0,0];
  spawnOrb();
}
function fromHash(){
  var h=(location.hash||"").replace("#",""),mm=/^([a-z]+)(?:-([0-9a-z]{16}))?$/.exec(h);
  if(!mm)return null;
  for(var i=0;i<WORLDS.length;i++)if(WORLDS[i].id===mm[1])return {i:i,spot:mm[2]||null,h:h};
  return null;
}
export function setMirrors(k){sel.mi=k;$("bMirror").textContent=mirrors[sel.mi]?("Mirrors "+mirrors[sel.mi]):"Mirrors off";}

/* A second world mixed into this one: carry a journey across to it, or hold the mix and let it breathe. */
export function stepHybrid(dt){
  if(scene.hyb){ /* a second world mixed into this one, either held and breathing or carrying a journey across */
    if(scene.hyb.mode==="trans"){scene.hyb.t+=dt/12;if(scene.hyb.t>=1)finishHybrid();}
    else{
      var ht=scene.hyb.exit?0:(0.5+0.38*Math.sin(clock.time*0.07));
      scene.hyb.t+=(ht-scene.hyb.t)*(1-Math.exp(-dt*0.8));
      if(scene.hyb.exit&&scene.hyb.t<0.02){scene.hyb=null;spawnOrb();}
    }
  }
}

/* The orb: drawn at its nearest copy, collected when you reach it, moved if the morph swallows it. Leaves where to draw it in fr.orbU. */
export function stepOrb(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,per=fr.per,i;
  var orbU=[0,0,0,0];
  if(scene.orb&&orbsOn&&!scene.hyb&&started){
    var oq=[0,0,0],od=0;
    for(i=0;i<3;i++){oq[i]=scene.orb.p[i]-cam.pos[i];oq[i]-=per[i]*Math.floor(oq[i]/per[i]+.5);od+=oq[i]*oq[i];}
    if(Math.sqrt(od)<scene.orb.r*2.5&&tr.warpDir===0)collectOrb();
    else{
      orbU=[cam.pos[0]+oq[0],cam.pos[1]+oq[1],cam.pos[2]+oq[2],scene.orb.r];
      scene.orbT+=dt;
      if(scene.orbT>1.5){scene.orbT=0;if(!w.volume&&Math.abs(w.de(scene.orb.p[0],scene.orb.p[1],scene.orb.p[2],m))<scene.orb.r*0.6)spawnOrb();}
    }
  }
  fr.orbU=orbU;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- choosing a world ---------- */
selWorld=$("selWorld"),selPal=$("selPal"),selMusic=$("selMusic"),selJT=$("selJT"),selOv=$("selOv"),selMotion=$("selMotion"),selLook=$("selLook");
fillMotions();
fillLooks();
fillOverlays();
selOv.addEventListener("change",function(){setOverlay(+this.value);wakeHud()});
$("bOvS").addEventListener("click",function(){sel.ovsi=(sel.ovsi+1)%OVS.length;this.textContent="Overlay "+Math.round(OVS[sel.ovsi]*100)+"%";wakeHud()});
selMotion.addEventListener("change",function(){setMotion(+this.value);wakeHud()});
selLook.addEventListener("change",function(){setLook(+this.value);wakeHud()});
fillWorlds();
fillPalettes();
selWorld.addEventListener("change",function(){requestWorld(+this.value);wakeHud()});
selPal.addEventListener("change",function(){setPalette(+this.value);wakeHud()});
(function(){
  var hh=fromHash(),i=hh?hh.i:0;
  if(!setWorldNow(i,true)){for(var j=0;j<WORLDS.length&&!scene.world;j++)setWorldNow(j,true);}
  else if(hh&&hh.spot){applySpot(hh.spot);scene.lastHash=hh.h;}
})();
if(!scene.world){errBox.textContent="None of the fractal shaders compiled on this device.";return;}
window.addEventListener("hashchange",function(){
  var hh=fromHash();if(!hh||hh.h===scene.lastHash)return;
  scene.lastHash=hh.h;
  requestWorld(hh.i,true,hh.spot?function(){applySpot(hh.spot)}:null);
});
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get scene(){return scene}, get selMusic(){return selMusic},set selMusic(v){selMusic=v}, get selJT(){return selJT},set selJT(v){selJT=v}, get selWorld(){return selWorld},set selWorld(v){selWorld=v}, get selPal(){return selPal},set selPal(v){selPal=v}, get selOv(){return selOv},set selOv(v){selOv=v},
  get selMotion(){return selMotion},set selMotion(v){selMotion=v}, get selLook(){return selLook},set selLook(v){selLook=v}, get fillMotions(){return fillMotions}, get fillLooks(){return fillLooks}, get fillOverlays(){return fillOverlays}, get setOverlay(){return setOverlay},
  get setMotion(){return setMotion}, get setLook(){return setLook}, get fillWorlds(){return fillWorlds}, get fillPalettes(){return fillPalettes}, get labelPalettes(){return labelPalettes}, get spawnOrb(){return spawnOrb},
  get chime(){return chime}, get collectOrb(){return collectOrb}, get startHybrid(){return startHybrid}, get finishHybrid(){return finishHybrid}, get setWorldNow(){return setWorldNow}, get requestWorld(){return requestWorld},
  get warpThen(){return warpThen}, get setPalette(){return setPalette}, get randomPalette(){return randomPalette}, get b36(){return b36}, get encodeSpot(){return encodeSpot}, get applySpot(){return applySpot},
  get fromHash(){return fromHash}, get setMirrors(){return setMirrors}, get stepHybrid(){return stepHybrid}, get stepOrb(){return stepOrb}};
