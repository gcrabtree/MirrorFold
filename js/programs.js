/* Compiling and linking shader programs. */
import { canvas, errBox, gl } from "./dom.js";
import { FS_BLUR, FS_DOWN, FS_FINAL, FS_TRAIL, TRAIL_U, VS, finalSource, fragSource, trailSource } from "./shaders.js";
let vsObj=null;

import { zoomOk } from "./zoom.js";
export function overlayProg(ov){ /* null if this overlay's code does not compile on this device */
  if(ov.prog===undefined){try{ov.prog=link(trailSource(ov.code),TRAIL_U)}catch(e){ov.prog=null;}}
  return ov.prog;
}
export const FS_COPY="precision mediump float;varying vec2 v;uniform sampler2D uT;void main(){gl_FragColor=texture2D(uT,v);}";
export const FINAL_U=["uLandT","uSkyT","uLandMix","uPrev","uKeep","uT","uB","uWarp","uCA","uBloom","uTint","uTime","uAsp","uPx","uLiq","uMos","uEcho","uEdge","uPost","uSolar","uInv","uHueRot","uTr","uFx","uHue","uVr","uPa","uPb","uPc","uPd"];
export function filterProg(lk){ /* null if this filter's code does not compile on this device */
  if(lk.prog===undefined){try{lk.prog=link(finalSource(lk.code),FINAL_U)}catch(e){lk.prog=null;}}
  return lk.prog;
}
function sh(type,src){
  var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){throw new Error(gl.getShaderInfoLog(s)||"shader failed");}
  return s;
}
export function link(fs,names){
  if(!vsObj)vsObj=sh(gl.VERTEX_SHADER,VS);
  var p=gl.createProgram();
  gl.attachShader(p,vsObj);gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
  gl.bindAttribLocation(p,0,"a");
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||"link failed");
  var U={};names.forEach(function(n){U[n]=gl.getUniformLocation(p,n)});
  return {prog:p,U:U};
}
export function build(w){
  if(w.prog)return;
  if(w.flat&&!zoomOk())throw new Error("This device cannot hold the numbers a zoom world needs.");
  var o=link(fragSource(w),["uRes","uTime","uSeg","uM","uHue","uSpin","uFade","uPix","uPos","uCam","uPa","uPb","uPc","uPd","uFov","uBeat","uMid","uHi","uOrb","uVr","uLandT","uLandOn","uVid","uVidK","uVidS","uJit","uSpark","uRef","uZ","uZn"]);
  w.prog=o.prog;w.U=o.U;
}

export function bindTex(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
export function passTo(o,p){gl.bindFramebuffer(gl.FRAMEBUFFER,o?o.f:null);gl.viewport(0,0,o?o.w:canvas.width,o?o.h:canvas.height);gl.useProgram(p.prog);}

export let pTrail, pDown, pBlur, pFinal, pCopy; /* the programs for the trails, the two halves of the glow, the finished picture, and a plain copy */

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
try{
  pTrail=link(FS_TRAIL,TRAIL_U);
  pDown=link(FS_DOWN,["uT","uPx"]);
  pBlur=link(FS_BLUR,["uT","uDir"]);
  pFinal=link(FS_FINAL,FINAL_U);pCopy=link(FS_COPY,["uT"]);
}catch(e){errBox.textContent="The effects shaders did not compile on this device.\n"+e.message;throw new Error("stop");}
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={overlayProg, FS_COPY, FINAL_U, filterProg, sh, link, build, bindTex, passTo, get vsObj(){return vsObj},set vsObj(v){vsObj=v},
  get pTrail(){return pTrail},set pTrail(v){pTrail=v}, get pDown(){return pDown},set pDown(v){pDown=v}, get pBlur(){return pBlur},set pBlur(v){pBlur=v}, get pFinal(){return pFinal},set pFinal(v){pFinal=v}, get pCopy(){return pCopy},set pCopy(v){pCopy=v}};
