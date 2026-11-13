/* The effect programs, the pictures they draw into, and the picture size. */
import { FINAL_U, FS_COPY, link } from "./programs.js";
import { FS_BLUR, FS_DOWN, FS_FINAL, FS_TRAIL, TRAIL_U } from "./shaders.js";
import { canvas, errBox, gl } from "./dom.js";
import { G } from "./shared.js";
export let pTrail, pDown, pBlur, pFinal, pCopy, tA, tF;

/* ---------- render targets ---------- */
export function target(w,h){
  var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  return {t:t,f:f,w:w,h:h};
}
export function freeT(o){if(o){gl.deleteTexture(o.t);gl.deleteFramebuffer(o.f);}}
export const tT=[null,null];
export const tB=[null,null]; /* the last two finished pictures, kept only while an unreviewed pack filter is being smoothed */

/* ---------- resolution, adapts to frame time ---------- */
export const DETAIL=["auto","sharp","fast"];
export function resize(){
  var dpr=Math.min(window.devicePixelRatio||1,DETAIL[G.di]==="sharp"?3:2)*G.q;
  var w=Math.max(2,Math.floor(canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h||!tA){
    canvas.width=w;canvas.height=h;
    freeT(tA);freeT(tT[0]);freeT(tT[1]);freeT(tB[0]);freeT(tB[1]);freeT(tF[0]);freeT(tF[1]);tF=[null,null];freeT(G.tL);freeT(G.tC);freeT(G.tLP);G.tL=G.tC=G.tLP=null;
    tA=target(w,h);tT[0]=target(w,h);tT[1]=target(w,h);
    var bw=Math.max(2,w>>2),bh=Math.max(2,h>>2);
    tB[0]=target(bw,bh);tB[1]=target(bw,bh);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
pTrail,pDown,pBlur,pFinal,pCopy;
try{
  pTrail=link(FS_TRAIL,TRAIL_U);
  pDown=link(FS_DOWN,["uT","uPx"]);
  pBlur=link(FS_BLUR,["uT","uDir"]);
  pFinal=link(FS_FINAL,FINAL_U);pCopy=link(FS_COPY,["uT"]);
}catch(e){errBox.textContent="The effects shaders did not compile on this device.\n"+e.message;return;}

var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
tA=null;
G.cur=0;
tF=[null,null],G.fcur=0;
G.di=0;
G.q=0.85;
window.addEventListener("resize",resize);resize();
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get pTrail(){return pTrail},set pTrail(v){pTrail=v}, get pDown(){return pDown},set pDown(v){pDown=v}, get pBlur(){return pBlur},set pBlur(v){pBlur=v}, get pFinal(){return pFinal},set pFinal(v){pFinal=v}, get pCopy(){return pCopy},set pCopy(v){pCopy=v}, get target(){return target},
  get freeT(){return freeT}, get tA(){return tA},set tA(v){tA=v}, get tT(){return tT}, get tB(){return tB}, get tF(){return tF},set tF(v){tF=v}, get DETAIL(){return DETAIL},
  get resize(){return resize}};
