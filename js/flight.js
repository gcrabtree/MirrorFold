/* Journey clocks, transitions, and small helpers for flying. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { $ } from "./dom.js";
import { packD, packFrame } from "./probe.js";
import { WORLDS } from "./worlds.js";
let toastEl, toastTimer;

/* journey clocks: each change has a target interval and fires within a fifth either side of it */
export const J={world:{base:55},palette:{base:21},mirrors:{base:20},motion:{base:24},filter:{base:27},overlay:{base:22},land:{base:80}};
export function jReset(k){J[k].t=0;J[k].next=J[k].base*(0.8+0.4*Math.random());}
function jResetAll(){for(var k in J)jReset(k);}
export const waveBuf=new Uint8Array(128);
export const gest={id:null,x:0,y:0,d0:1,a:0,s0:1}, lastTap={t:0,x:0,y:0};
/* looking around by hand or by head: turn the view and note how much, so the autopilot can stand back */
/* how much the user is steering, 0 to 1, from how fast they are turning the view (radians a second).
   It rises at once and fades over about a second, so small tremors do not count and control comes back gently. */
export function toast(msg){toastEl.textContent=msg;toastEl.classList.add("on");clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove("on")},2600);}
export function doBoost(){cam.boost=1;}
export function deAt(x,y,z,m){
  var d=scene.world.de(x,y,z,m);
  if(scene.hyb){d+=(WORLDS[scene.hyb.b].de(x+scene.hyb.off[0],y+scene.hyb.off[1],z+scene.hyb.off[2],m)-d)*scene.hyb.t;}
  return d;
}

/* How far the camera is from the nearest surface, and how fast this world lets it fly. A pack world asks the chip; the others work it out here. */
export function measure(fr){
  var m=fr.m,dt=fr.dt;
  var w=scene.world,wB=scene.hyb?WORLDS[scene.hyb.b]:null;
  var wSpeed=scene.hyb?(w.speed+(wB.speed-w.speed)*scene.hyb.t):w.speed;
  var pk=w.pack&&!scene.hyb; /* a pack world: one question to the chip gives all five distances, using the reach worked out last frame */
  if(pk)packFrame(w,m,Math.min(1,Math.max(0.06,packD[0]*5)));
  var dist=pk?packD[0]:Math.abs(deAt(cam.pos[0],cam.pos[1],cam.pos[2],m));
  cam.boost*=Math.exp(-dt*1.2);if(cam.boost<0.01)cam.boost=0;
  fr.w=w;fr.wSpeed=wSpeed;fr.pk=pk;fr.dist=dist;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
jResetAll();
toastEl=$("toast"),toastTimer=0;
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get toastEl(){return toastEl},set toastEl(v){toastEl=v}, get toastTimer(){return toastTimer},set toastTimer(v){toastTimer=v}, get J(){return J}, get jReset(){return jReset}, get jResetAll(){return jResetAll}, get waveBuf(){return waveBuf},
  get gest(){return gest}, get lastTap(){return lastTap}, get toast(){return toast}, get doBoost(){return doBoost}, get deAt(){return deAt}, get measure(){return measure}};
