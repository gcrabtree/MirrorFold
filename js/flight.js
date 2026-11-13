/* Journey clocks, transitions, and small helpers for flying. */
import { TRANSITIONS } from "./state.js";
import { $ } from "./dom.js";
import { WORLDS } from "./worlds.js";
import { G } from "./shared.js";
let toastEl, toastTimer;

/* journey clocks: each change has a target interval and fires within a fifth either side of it */
export const J={world:{base:55},palette:{base:21},mirrors:{base:20},motion:{base:24},filter:{base:27},overlay:{base:22},land:{base:80}};
export function jReset(k){J[k].t=0;J[k].next=J[k].base*(0.8+0.4*Math.random());}
function jResetAll(){for(var k in J)jReset(k);}
export function beginWarp(){ /* a different transition each time */
  if(G.warpDir===0&&G.warp<0.05)G.trType=(G.trType+1+Math.floor(Math.random()*(TRANSITIONS-1)))%TRANSITIONS;
  G.warpDir=1;
}
export const waveBuf=new Uint8Array(128);
export const gest={id:null,x:0,y:0,d0:1,a:0,s0:1}, lastTap={t:0,x:0,y:0};
/* looking around by hand or by head: turn the view and note how much, so the autopilot can stand back */
export function userLook(dx,dy){G.lookX+=dx;G.lookY+=dy;G.userTurn+=Math.hypot(dx,dy);}
/* how much the user is steering, 0 to 1, from how fast they are turning the view (radians a second).
   It rises at once and fades over about a second, so small tremors do not count and control comes back gently. */
export function userActive(act,rate,dt){
  var want=Math.min(1,Math.max(0,(rate-0.08)/0.42));
  return act+(want-act)*(1-Math.exp(-dt*(want>act?12:1.4)));
}
export function toast(msg){toastEl.textContent=msg;toastEl.classList.add("on");clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove("on")},2600);}
export function doBoost(){G.boost=1;}
export function deAt(x,y,z,m){
  var d=G.world.de(x,y,z,m);
  if(G.hyb){d+=(WORLDS[G.hyb.b].de(x+G.hyb.off[0],y+G.hyb.off[1],z+G.hyb.off[2],m)-d)*G.hyb.t;}
  return d;
}

export function morphValue(){return Math.sin(G.morphT*0.09)+0.15*Math.sin(G.morphT*0.31)}
export function rot(v,a,ang){
  var c=Math.cos(ang),s=Math.sin(ang),d=(a[0]*v[0]+a[1]*v[1]+a[2]*v[2])*(1-c);
  return [v[0]*c+(a[1]*v[2]-a[2]*v[1])*s+a[0]*d,
          v[1]*c+(a[2]*v[0]-a[0]*v[2])*s+a[1]*d,
          v[2]*c+(a[0]*v[1]-a[1]*v[0])*s+a[2]*d];
}
export function norm(v){var l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]}
export function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
jResetAll();
G.waveTex=null;
G.tbins=null;
G.orbsOn=true;
try{G.orbsOn=localStorage.getItem("mirrorfold-orbs")!=="off"}catch(_){}
G.morph=true, G.drift=true, G.started=false, G.journey=false;
G.morphT=0, G.time=0, G.hueT=0, G.spin=0, G.baseSpeed=1, G.curSpeed=0;
G.warp=0, G.warpDir=0, G.warpFn=null, G.pendingWorld=-1;
G.world=null, G.hyb=null, G.orb=null, G.orbT=0, G.boost=0, G.gRoll=0, G.lastHash="";
G.stereo=false, G.vrEye=0.004, G.gyroPrev=null, G.wakeLock=null;
/* journey movement: "travel" flies and steers for you, "drift" leaves the flying to you and only changes the scenery */
G.jMove="travel", G.userTurn=0, G.lookAct=0;
try{if(localStorage.getItem("mirrorfold-move")==="drift")G.jMove="drift"}catch(_){}
toastEl=$("toast"),toastTimer=0;
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get J(){return J}, get jReset(){return jReset}, get jResetAll(){return jResetAll}, get beginWarp(){return beginWarp}, get waveBuf(){return waveBuf}, get gest(){return gest},
  get lastTap(){return lastTap}, get userLook(){return userLook}, get userActive(){return userActive}, get toastEl(){return toastEl},set toastEl(v){toastEl=v}, get toastTimer(){return toastTimer},set toastTimer(v){toastTimer=v}, get toast(){return toast},
  get doBoost(){return doBoost}, get deAt(){return deAt}, get morphValue(){return morphValue}, get rot(){return rot}, get norm(){return norm}, get cross(){return cross}};
