/* Journey clocks, transitions, and small helpers for flying. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { morph } from "./controls.js";
import { calm } from "./dom.js";
import { heard } from "./song.js";
import { still } from "./still.js";
import { packD, packFrame } from "./pack-worlds.js";
import { pkDeep, pkZoom } from "./packing.js";

export function doBoost(){cam.boost=1;}
export function deAt(x,y,z,m){
  var d=scene.world.de(x,y,z,m);
  return d;
}

/* How far the camera is from the nearest surface, and how fast this world lets it fly. A pack world asks the chip; the others work it out here. */
export function measure(fr){
  var m=fr.m,dt=fr.dt;
  var w=scene.world,wSpeed=w.speed;
  var pk=!!w.pack; /* a pack world: one question to the chip gives all five distances, using the reach worked out last frame */
  if(pk)packFrame(w,m,Math.min(1,Math.max(0.06,packD[0]*5)));
  var dist=pk?packD[0]:Math.abs(deAt(cam.pos[0],cam.pos[1],cam.pos[2],m));
  cam.boost*=Math.exp(-dt*1.2);if(cam.boost<0.01)cam.boost=0;
  if(heard.drop&&morph===2&&!calm&&!still)cam.boost=Math.max(cam.boost,0.6); /* a drop in the music: a surge forward, as an orb gives */
  if(pkDeep(w))wSpeed*=pkZoom(cam.pos,w.grid); /* the descent: the top speed grows with the surroundings, so that it is the same before and after the camera is moved out */
  fr.w=w;fr.wSpeed=wSpeed;fr.pk=pk;fr.dist=dist;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={doBoost, deAt, measure};
