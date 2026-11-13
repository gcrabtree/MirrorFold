/* Compiling and linking shader programs. */
import { TRAIL_U, VS, finalSource, fragSource, trailSource } from "./shaders.js";
import { gl } from "./dom.js";
import { WORLDS } from "./worlds.js";
let vsObj;

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
  var o=link(fragSource(w),["uRes","uTime","uSeg","uM","uHue","uSpin","uFade","uPix","uPos","uCam","uPa","uPb","uPc","uPd","uFov","uBeat","uMid","uHi","uMix","uOff","uOrb","uVr","uLandT","uLandOn"]);
  w.prog=o.prog;w.U=o.U;
}
/* a hybrid is two worlds' distance fields mixed; the second is sampled at an offset so both can keep wrapping */
const hybCache={};
export function hybProg(a,b){
  var k=a+"_"+b;if(hybCache[k])return hybCache[k];
  var A=WORLDS[a],B=WORLDS[b];
  var g=A.glsl.map(function(l){return l.replace("float map(vec3 p)","float mapA(vec3 p)")}).concat(["#undef P"],
        B.glsl.map(function(l){return l.replace("float map(vec3 p)","float mapB(vec3 p)")}),["#undef P",
    "float map(vec3 p){float a=mapA(p);vec4 oa=orb;float b=mapB(p+uOff);orb=mix(oa,orb,uMix);return mix(a,b,uMix);}"]);
  var o=link(fragSource({glsl:g,fog:(A.fog+B.fog)/2,maxd:Math.max(A.maxd,B.maxd)}),["uRes","uTime","uSeg","uM","uHue","uSpin","uFade","uPix","uPos","uCam","uPa","uPb","uPc","uPd","uFov","uBeat","uMid","uHi","uMix","uOff","uOrb","uVr","uLandT","uLandOn"]);
  hybCache[k]=o;return o;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
vsObj=null;
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get overlayProg(){return overlayProg}, get FS_COPY(){return FS_COPY}, get FINAL_U(){return FINAL_U}, get filterProg(){return filterProg}, get sh(){return sh}, get vsObj(){return vsObj},set vsObj(v){vsObj=v},
  get link(){return link}, get build(){return build}, get hybCache(){return hybCache}, get hybProg(){return hybProg}};
