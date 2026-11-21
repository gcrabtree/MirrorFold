/* Compiling and linking shader programs. */
import { canvas, errBox, gl } from "./dom.js";
import { FS_BLUR, FS_DOWN, FS_FINAL, TRAIL_U, VS, finalSource, fragSource, trailFor, trailSource } from "./shaders.js";
import { dnRoom, setDanceRoom } from "./dance.js";
let vsObj=null;
export let par=null; /* the browser's way of saying a program is ready without making the page wait for it; null if it has none */

import { zoomOk } from "./zoom.js";
export function overlayProg(ov){ /* null if this overlay's code does not compile on this device */
  if(ov.prog===undefined){try{ov.prog=link(trailSource(ov.code,dnRoom),TRAIL_U)}catch(e){ov.prog=null;}}
  return ov.prog;
}
export const FS_COPY="precision mediump float;varying vec2 v;uniform sampler2D uT;void main(){gl_FragColor=texture2D(uT,v);}";
export const FINAL_U=["uLandT","uSkyT","uLandMix","uPrev","uKeep","uT","uB","uWarp","uCA","uBloom","uTint","uTime","uAsp","uPx","uLiq","uMos","uEcho","uEdge","uPost","uSolar","uInv","uHueRot","uTr","uFx","uHue","uVr","uVrG","uLn","uRes","uPa","uPb","uPc","uPd"];
export function filterProg(lk){ /* null if this filter's code does not compile on this device */
  if(lk.prog===undefined){try{lk.prog=link(finalSource(lk.code),FINAL_U)}catch(e){lk.prog=null;}}
  return lk.prog;
}
function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
/* A program is made in two halves, so that the slow half can run while the pictures go on. linkStart hands the source to
   the chip and asks nothing back; asking is what makes the page wait. linkReady says whether the chip has finished, where
   the browser can tell us (par); linkEnd asks, waiting if it must, and throws what the chip said if it failed. */
export function linkStart(fs){
  if(!vsObj)vsObj=sh(gl.VERTEX_SHADER,VS);
  var p=gl.createProgram(),f=sh(gl.FRAGMENT_SHADER,fs);
  gl.attachShader(p,vsObj);gl.attachShader(p,f);
  gl.bindAttribLocation(p,0,"a");
  gl.linkProgram(p);
  return {p:p,f:f};
}
export function linkReady(j){return !par||!!gl.getProgramParameter(j.p,par.COMPLETION_STATUS_KHR);}
/* The second half a little at a time, for a program made ahead of need. Every question put to the chip is a wait of
   its own (half a millisecond or so), and a world's program has more than fifty names to ask after, so asking them
   all in one frame shows as a stutter. The first call asks whether the program was made (and throws if not); each
   call after asks after up to n names. It gives back the finished program once every name has been asked, and null
   until then. */
export function linkEndStep(j,names,n){
  var p=j.p,msg,k;
  if(!j.U){
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
      msg=(gl.getShaderParameter(j.f,gl.COMPILE_STATUS)?"":gl.getShaderInfoLog(j.f))||gl.getProgramInfoLog(p)||"shader failed";
      gl.deleteShader(j.f);gl.deleteProgram(p);throw new Error(msg);
    }
    gl.deleteShader(j.f); /* the program keeps what it needs */
    j.U={};j.i=0;
    return null;
  }
  for(k=0;k<n&&j.i<names.length;k++,j.i++)j.U[names[j.i]]=gl.getUniformLocation(p,names[j.i]);
  return j.i>=names.length?{prog:p,U:j.U}:null;
}
export function linkEnd(j,names){
  var o=null;
  while(!o)o=linkEndStep(j,names,1e9); /* all that is left of it, at once */
  return o;
}
export function link(fs,names){return linkEnd(linkStart(fs),names);}
const WORLD_U=["uRes","uTime","uSeg","uM","uMc","uHue","uSpin","uFade","uPix","uPos","uCam","uPa","uPb","uPc","uPd","uFov","uBeat","uMid","uHi","uOrb","uVr","uLn","uLandT","uLandOn","uVid","uVidK","uVidS","uSurf","uPer","uFl","uFlA","uPe","uJit","uSpark","uRef","uZ","uZn","uZo","uZs","uDoor","uDoorN","uDoorT","uDoorC","uPk","uPkZ","uPkO","uMw","uLens","uRb","uRbW","uInv","uLwR","uLwA","uSh","uExp","uFb"];
/* The built-in worlds' programs come in sets: one for each way of making them (with the chrome surface in them, with
   the shapes mixed; see fragSource). Only one set is in use. Changing the set puts away each world's program, the half
   made one and its distance probe under the old set's name and brings out what was made under the new one, if
   anything; the rest are then made when they are needed, as at the start. */
let progSet="";
export function setProgSet(key,worlds){
  var i,w,v;
  if(key===progSet)return;
  for(i=0;i<worlds.length;i++){
    w=worlds[i];if(w.pack)continue;
    w.sets=w.sets||{};w.sets[progSet]={prog:w.prog,U:w.U,job:w.job,probe:w.probe};
    v=w.sets[key]||{};w.prog=v.prog;w.U=v.U;w.job=v.job||null;w.probe=v.probe;
  }
  progSet=key;
}
/* start on a world's program ahead of need; false if there is nothing to start */
export function buildStart(w){
  if(w.prog||w.job||w.pack||(w.flat&&!zoomOk()))return false;
  w.job=linkStart(fragSource(w));return true;
}
export function buildReady(w){return !w.job||linkReady(w.job);}
/* finish a world's program that was started ahead of need, asking after up to n names; true once it is there (or there was nothing to finish) */
export function buildStep(w,n){
  var o;
  if(w.prog||!w.job)return true;
  o=linkEndStep(w.job,WORLD_U,n);
  if(!o)return false;
  w.job=null;w.prog=o.prog;w.U=o.U;
  return true;
}
export function build(w){
  if(w.prog)return;
  if(w.flat&&!zoomOk())throw new Error("This device cannot hold the numbers a zoom world needs.");
  var j=w.job||linkStart(fragSource(w));w.job=null; /* one started ahead of need is finished here, waiting only for what is left of it */
  var o=linkEnd(j,WORLD_U);
  w.prog=o.prog;w.U=o.U;
}

export function bindTex(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
let outT=null; /* where the finished picture goes in place of the screen: a headset's own picture (js/xr.js); null for the screen */
export function setOut(t){outT=t||null;}
export function passTo(o,p){if(!o&&outT)o=outT;gl.bindFramebuffer(gl.FRAMEBUFFER,o?o.f:null);gl.viewport(0,0,o?o.w:canvas.width,o?o.h:canvas.height);gl.useProgram(p.prog);}

export let pTrail, pDown, pBlur, pFinal, pCopy; /* the programs for the trails, the two halves of the glow, the finished picture, and a plain copy */

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
par=gl.getExtension("KHR_parallel_shader_compile");
/* the five programs every picture needs are handed to the chip together and not waited for here: the chip makes them
   side by side, and the first world's with them, where one after another each would have had the page wait in turn */
/* each dancer takes ten of the chip's uniform vectors and the rest of the trails shader under fifty: the shader is written for as many dancers as there is room for, twenty at most */
setDanceRoom(Math.floor(((gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)||0)-48)/10));
try{postJobs=[linkStart(trailFor(dnRoom)),linkStart(FS_DOWN),linkStart(FS_BLUR),linkStart(FS_FINAL),linkStart(FS_COPY)];}
catch(e){errBox.textContent="The effects shaders did not compile on this device.\n"+e.message;throw new Error("stop");}
}
let postJobs=null;
/* Wait for those five and take them up. Called once the first world's program has been started too (js/choose.js). */
export function progFinish(){
  var j=postJobs;
  if(!j)return;
  postJobs=null;
  try{
    pTrail=linkEnd(j[0],TRAIL_U);pDown=linkEnd(j[1],["uT","uPx"]);pBlur=linkEnd(j[2],["uT","uDir"]);
    pFinal=linkEnd(j[3],FINAL_U);pCopy=linkEnd(j[4],["uT"]);
  }catch(e){errBox.textContent="The effects shaders did not compile on this device.\n"+e.message;throw new Error("stop");}
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={setOut, linkEndStep, buildStep, progFinish, overlayProg, FS_COPY, FINAL_U, filterProg, sh, link, linkStart, linkReady, linkEnd, WORLD_U, setProgSet, get progSet(){return progSet}, buildStart, buildReady, build, get par(){return par},set par(v){par=v}, bindTex, passTo, get vsObj(){return vsObj},set vsObj(v){vsObj=v},
  get pTrail(){return pTrail},set pTrail(v){pTrail=v}, get pDown(){return pDown},set pDown(v){pDown=v}, get pBlur(){return pBlur},set pBlur(v){pBlur=v}, get pFinal(){return pFinal},set pFinal(v){pFinal=v}, get pCopy(){return pCopy},set pCopy(v){pCopy=v}};
