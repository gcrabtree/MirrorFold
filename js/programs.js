/* Compiling and linking shader programs. */
import { canvas, errBox, gl } from "./dom.js";
import { FS_BLUR, FS_DOWN, FS_FINAL, FS_TRAIL, TRAIL_U, VS, finalSource, fragSource, trailSource } from "./shaders.js";
let vsObj=null;
export let par=null; /* the browser's way of saying a program is ready without making the page wait for it; null if it has none */

import { zoomOk } from "./zoom.js";
export function overlayProg(ov){ /* null if this overlay's code does not compile on this device */
  if(ov.prog===undefined){try{ov.prog=link(trailSource(ov.code),TRAIL_U)}catch(e){ov.prog=null;}}
  return ov.prog;
}
export const FS_COPY="precision mediump float;varying vec2 v;uniform sampler2D uT;void main(){gl_FragColor=texture2D(uT,v);}";
export const FINAL_U=["uLandT","uSkyT","uLandMix","uPrev","uKeep","uT","uB","uWarp","uCA","uBloom","uTint","uTime","uAsp","uPx","uLiq","uMos","uEcho","uEdge","uPost","uSolar","uInv","uHueRot","uTr","uFx","uHue","uVr","uVrG","uRes","uPa","uPb","uPc","uPd"];
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
export function linkEnd(j,names){
  var p=j.p,msg;
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
    msg=(gl.getShaderParameter(j.f,gl.COMPILE_STATUS)?"":gl.getShaderInfoLog(j.f))||gl.getProgramInfoLog(p)||"shader failed";
    gl.deleteShader(j.f);gl.deleteProgram(p);throw new Error(msg);
  }
  gl.deleteShader(j.f); /* the program keeps what it needs */
  var U={};names.forEach(function(n){U[n]=gl.getUniformLocation(p,n)});
  return {prog:p,U:U};
}
export function link(fs,names){return linkEnd(linkStart(fs),names);}
const WORLD_U=["uRes","uTime","uSeg","uM","uHue","uSpin","uFade","uPix","uPos","uCam","uPa","uPb","uPc","uPd","uFov","uBeat","uMid","uHi","uOrb","uVr","uLandT","uLandOn","uVid","uVidK","uVidS","uSurf","uPer","uFl","uFlT","uJit","uSpark","uRef","uZ","uZn","uZo","uZs"];
/* start on a world's program ahead of need; false if there is nothing to start */
export function buildStart(w){
  if(w.prog||w.job||w.pack||(w.flat&&!zoomOk()))return false;
  w.job=linkStart(fragSource(w));return true;
}
export function buildReady(w){return !w.job||linkReady(w.job);}
export function build(w){
  if(w.prog)return;
  if(w.flat&&!zoomOk())throw new Error("This device cannot hold the numbers a zoom world needs.");
  var j=w.job||linkStart(fragSource(w));w.job=null; /* one started ahead of need is finished here, waiting only for what is left of it */
  var o=linkEnd(j,WORLD_U);
  w.prog=o.prog;w.U=o.U;
}

export function bindTex(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
export function passTo(o,p){gl.bindFramebuffer(gl.FRAMEBUFFER,o?o.f:null);gl.viewport(0,0,o?o.w:canvas.width,o?o.h:canvas.height);gl.useProgram(p.prog);}

export let pTrail, pDown, pBlur, pFinal, pCopy; /* the programs for the trails, the two halves of the glow, the finished picture, and a plain copy */

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
par=gl.getExtension("KHR_parallel_shader_compile");
try{
  pTrail=link(FS_TRAIL,TRAIL_U);
  pDown=link(FS_DOWN,["uT","uPx"]);
  pBlur=link(FS_BLUR,["uT","uDir"]);
  pFinal=link(FS_FINAL,FINAL_U);pCopy=link(FS_COPY,["uT"]);
}catch(e){errBox.textContent="The effects shaders did not compile on this device.\n"+e.message;throw new Error("stop");}
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={overlayProg, FS_COPY, FINAL_U, filterProg, sh, link, linkStart, linkReady, linkEnd, WORLD_U, buildStart, buildReady, build, get par(){return par},set par(v){par=v}, bindTex, passTo, get vsObj(){return vsObj},set vsObj(v){vsObj=v},
  get pTrail(){return pTrail},set pTrail(v){pTrail=v}, get pDown(){return pDown},set pDown(v){pDown=v}, get pBlur(){return pBlur},set pBlur(v){pBlur=v}, get pFinal(){return pFinal},set pFinal(v){pFinal=v}, get pCopy(){return pCopy},set pCopy(v){pCopy=v}};
