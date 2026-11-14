/* Share spots: a world, palette, mirrors, position, heading and morph time packed into letters and digits in the page's address. */
import { cam, cross, norm } from "./camera.js";
import { scene, setMirrors } from "./choose.js";
import { clock, morphValue } from "./clock.js";
import { spawnOrb } from "./orbs.js";
import { PALETTES, palOpen, setPalette } from "./palettes.js";
import { mirrors, sel } from "./state.js";
import { WORLDS } from "./worlds.js";
import { zoomFromSpot, zoomSpot } from "./zoom.js";
/* a spot is world, palette, mirrors, position, heading and morph time packed into letters and digits */
export function b36(v,len){v=Math.max(0,Math.min(Math.pow(36,len)-1,Math.round(v)));var t=v.toString(36);while(t.length<len)t="0"+t;return t;}
export function encodeSpot(){
  if(scene.world.flat)return scene.world.id+"-"+b36(sel.pi,1)+b36(sel.mi,1)+zoomSpot(scene.world); /* a zoom world keeps its own kind of place */
  var per=scene.world.period(morphValue()),t=b36(sel.pi,1)+b36(sel.mi,1),i;
  for(i=0;i<3;i++)t+=b36((cam.pos[i]/per[i]+0.5)*1295,2);
  t+=b36((Math.atan2(cam.F[0],cam.F[2])/(2*Math.PI)+0.5)*1295,2)+b36((Math.asin(Math.max(-1,Math.min(1,cam.F[1])))/Math.PI+0.5)*1295,2);
  t+=b36(Math.round(clock.morphT*4)%1679616,4);
  return scene.world.id+"-"+t;
}
export function applySpot(t){
  var n=function(a,b){return parseInt(t.slice(a,b),36)};
  var p=n(0,1),k=n(1,2);
  if(p<PALETTES.length&&palOpen(p))setPalette(p);
  if(k<mirrors.length)setMirrors(k);
  if(scene.world.flat){zoomFromSpot(scene.world,t.slice(2));return;}
  clock.morphT=n(12,16)/4;
  var per=scene.world.period(morphValue()),i;
  for(i=0;i<3;i++)cam.pos[i]=(n(2+2*i,4+2*i)/1295-0.5)*per[i];
  var yaw=(n(8,10)/1295-0.5)*2*Math.PI,pit=(n(10,12)/1295-0.5)*Math.PI;
  cam.F=[Math.cos(pit)*Math.sin(yaw),Math.sin(pit),Math.cos(pit)*Math.cos(yaw)];
  cam.R=norm(cross([0,1,0],cam.F));cam.Up=cross(cam.F,cam.R);cam.vel=[0,0,0];
  spawnOrb();
}
export function fromHash(){
  var h=(location.hash||"").replace("#",""),mm=/^([a-z]+)(?:-([0-9a-z]{16}))?$/.exec(h);
  if(!mm)return null;
  for(var i=0;i<WORLDS.length;i++)if(WORLDS[i].id===mm[1])return {i:i,spot:mm[2]||null,h:h};
  return null;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={b36, encodeSpot, applySpot, fromHash};
