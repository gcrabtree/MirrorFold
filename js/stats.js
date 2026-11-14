/* Stats: a readout of how fast the picture is drawn and what is drawing it, and a trial of the distance probe. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { morphValue } from "./clock.js";
import { $, gl } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { probe, probeOut, probePts } from "./probe.js";
import { q, tA } from "./targets.js";
export let statsOn=false;
let gpuName="",sT0=0,sPr=0;
export const ST={n:0,worst:0,js:0,pr:0,pn:0,gd:0,jd:0,t:0};
export function statsShow(){
  var fps=ST.n/ST.t,lines=[
    Math.round(fps)+" pictures a second, slowest "+Math.round(ST.worst*1000)+" ms",
    "script "+(ST.js/ST.n).toFixed(1)+" ms a picture",
    "sharpness "+Math.round(q*100)+"%, "+tA.w+" x "+tA.h+" points",
    "drawn by: "+gpuName.slice(0,70)];
  if(ST.pn)lines.push("distance probe, waiting for the chip "+(ST.pr/ST.pn).toFixed(2)+" ms: chip "+ST.gd.toFixed(4)+(ST.jd===ST.jd?", script "+ST.jd.toFixed(4):", no script for this world"));
  else lines.push("distance probe: not for this world");
  $("stats").textContent=lines.join("\n");
  ST.n=0;ST.t=0;ST.worst=0;ST.js=0;ST.pr=0;ST.pn=0;
}
/* Stats, start of a frame: try the probe at the camera, and time it, before anything else is drawn. */
export function statsBegin(){
  if(!statsOn)return;
  sT0=performance.now();sPr=0;
  probePts[0]=cam.pos[0];probePts[1]=cam.pos[1];probePts[2]=cam.pos[2];
  if(probe(scene.world,morphValue(),1)){sPr=performance.now()-sT0;ST.pr+=sPr;ST.pn++;ST.gd=probeOut[0];ST.jd=scene.world.pack?NaN:scene.world.de(cam.pos[0],cam.pos[1],cam.pos[2],morphValue());}
}
/* Stats, end of a frame: count it, and show the readout twice a second. */
export function statsEnd(rawDt){
  if(!statsOn)return;
  ST.n++;ST.t+=rawDt;ST.worst=Math.max(ST.worst,rawDt);ST.js+=performance.now()-sT0-sPr;if(ST.t>=0.5)statsShow();
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("bStats").addEventListener("click",function(){
  statsOn=!statsOn;press(this,statsOn);$("stats").hidden=!statsOn;ST.n=0;ST.t=0;
  if(statsOn&&!gpuName){var dx=gl.getExtension("WEBGL_debug_renderer_info");gpuName=String(dx?gl.getParameter(dx.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));}
  wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={ST, statsShow, statsBegin, statsEnd, get statsOn(){return statsOn},set statsOn(v){statsOn=v}, get gpuName(){return gpuName},set gpuName(v){gpuName=v}, get sT0(){return sT0},set sT0(v){sT0=v}, get sPr(){return sPr},set sPr(v){sPr=v}};
