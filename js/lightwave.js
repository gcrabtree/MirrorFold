/* The light wave: on a beat, a band of light sets out from the camera and runs outward over the world's surfaces, so the
   music is seen to arrive at the far shapes a moment after it is heard. Up to three are on their way at once. The
   scene shader brightens whatever lies at a wave's distance (js/shaders.js). A wave starts faint and wide enough to be
   soft, is at its brightest part of the way out, and has faded by the time it reaches the limit of sight; near the
   camera, where a band would pass in an instant, it adds almost nothing. Nothing here flashes: two waves start at
   least LW_GAP seconds apart, and with less motion asked for they are fainter. Hold still stops them where they are. */
import { $, calm, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { started } from "./loop.js";
import { pkDeep, pkZoom } from "./packing.js";
import { cam } from "./camera.js";
import { still } from "./still.js";
export const LW_N=3;       /* how many waves can be out at once; the shader takes their distances as three numbers */
export const LW_GAP=0.8;   /* the least time between two waves starting, in seconds */
export const LW_TIME=3.2;  /* seconds a wave takes to reach the limit of sight */
export const LW_BEAT=0.4;  /* how strong the beat's pulse must be to start one */
export let lightWave=true; /* the Light wave switch */
export const lwR=[0,0,0];  /* for the shader: how far out each wave is; 0 for none */
export const lwA=[0,0,0];  /* and how brightly each shows */
let since=9,was=0;

/* how brightly a wave shows when it is a part u (0 to 1) of the way out: nothing at the camera, most at about a third, nothing at the end */
export function lwBright(u){
  var a=Math.max(0,Math.min(1,(u-0.03)/0.2));
  return u>=1?0:a*a*(3-2*a)*(1-u);
}
/* One step for the waves: move those that are out by dt seconds' worth (reach is the limit of sight), and start one if
   the beat has just risen past LW_BEAT and the last start was long enough ago. r holds their distances and st the
   state between calls: {since, was}. Returns true if one started. */
export function lwStep(r,st,bt,dt,reach){
  var i,go=false;
  for(i=0;i<r.length;i++)if(r[i]>0){r[i]+=reach*dt/LW_TIME;if(r[i]>=reach)r[i]=0;}
  st.since+=dt;
  if(bt>=LW_BEAT&&st.was<LW_BEAT&&st.since>=LW_GAP){
    for(i=0;i<r.length&&!go;i++)if(r[i]<=0){r[i]=1e-4*reach;go=true;st.since=0;}
  }
  st.was=bt;
  return go;
}
/* A step of the frame: move the waves and fill lwR and lwA for the shader. */
export function stepLightWave(fr){
  var w=fr.w,i,reach,st;
  if(!lightWave||!started||!w||w.flat||w.volume||landMode===1){lwR[0]=lwR[1]=lwR[2]=0;lwA[0]=lwA[1]=lwA[2]=0;return;}
  reach=w.maxd*(pkDeep(w)?pkZoom(cam.pos,w.grid):1);
  if(fr.jump!==1)for(i=0;i<LW_N;i++)lwR[i]*=fr.jump; /* the descent: they are moved out with the camera */
  if(!still){st={since:since,was:was};lwStep(lwR,st,fr.bt,fr.dt,reach);since=st.since;was=st.was;}
  for(i=0;i<LW_N;i++)lwA[i]=lwR[i]>0?lwBright(lwR[i]/reach)*(calm?0.4:1):0;
}
export function setLightWave(on){lightWave=!!on;press($("bLw"),lightWave);$("bLw").textContent="Light wave "+(lightWave?"on":"off");}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var sv=null;
try{sv=localStorage.getItem("mirrorfold-lightwave")}catch(_){}
setLightWave(sv?sv==="on":true);
$("bLw").addEventListener("click",function(){
  setLightWave(!lightWave);try{localStorage.setItem("mirrorfold-lightwave",lightWave?"on":"off")}catch(_){}
  toast(lightWave?"Light wave on. On a beat, a band of light runs outward from you over the shapes.":"Light wave off");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={LW_N, LW_GAP, LW_TIME, LW_BEAT, lwR, lwA, lwBright, lwStep, stepLightWave, setLightWave,
  get lightWave(){return lightWave},set lightWave(v){lightWave=v}, get lwSince(){return since},set lwSince(v){since=v}, get lwWas(){return was},set lwWas(v){was=v}};
