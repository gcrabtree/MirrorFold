/* Journey clocks, transitions, and small helpers for flying. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { packD, packFrame } from "./pack-worlds.js";
import { WORLDS } from "./worlds.js";

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
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get doBoost(){return doBoost}, get deAt(){return deAt}, get measure(){return measure}};
