/* The effect programs, the pictures they draw into, and the picture size. */
import { canvas, gl } from "./dom.js";
import { landFreeTargets, landMode } from "./land.js";
import { stillFree } from "./still.js";
export let di=0,q=0.85; /* the detail setting (a position in DETAIL) and the sharpness it currently gives, 0.35 to 1 */
export let landQ=1;      /* how large the land's own picture is beside the whole picture: 1, 0.7 or 0.5 */
let acc=0,frames=0,qHold=0;
export function setDetail(i){di=i;q=DETAIL[di]==="fast"?0.5:(DETAIL[di]==="sharp"?1:0.85);landQ=DETAIL[di]==="fast"?0.7:1;resize();}
/* What Detail auto does next when the pictures come too slowly (slow true) or with time to spare, given the sharpness,
   the land's share and whether the land is on. Sharpness is given up first, down to 60%. With the land on, the land's own
   picture is then made smaller, because it costs about three times what a world does, and only after that does the whole
   picture go on down to 35%. Going back up, the whole picture comes first; the land's picture grows again only when
   there is a great deal of time to spare (roomy), since that step costs the most. */
export function detailStep(slow,roomy,q,landQ,land){
  if(slow){
    if(q>0.6)return {q:Math.max(0.6,q*0.9),landQ:landQ};
    if(land&&landQ>0.5)return {q:q,landQ:landQ>0.7?0.7:0.5};
    if(land&&q>0.35)return {q:Math.max(0.35,q*0.9),landQ:landQ};
    return null;
  }
  if(q<1)return {q:Math.min(1,q*1.06),landQ:landQ};
  if(land&&roomy&&landQ<1)return {q:q,landQ:landQ<0.7?0.7:1};
  return null;
}
/* Detail auto: every 30 frames, hold sharpness and give up frame rate first, stepping down only below about 28 fps */
export function autoDetail(now,dt){
  acc+=dt;frames++;
  if(frames<30)return;
  var avg=acc/frames,st=null;acc=0;frames=0;
  if(DETAIL[di]!=="auto")return;
  if(avg>0.036)st=detailStep(true,false,q,landQ,landMode>0);
  else if(avg<0.022&&now>qHold)st=detailStep(false,avg<0.012,q,landQ,landMode>0); /* after stepping down, wait before trying to step up again: each change rebuilds every picture, which shows as a hitch */
  if(!st)return;
  if(avg>0.036)qHold=now+20000;
  q=st.q;landQ=st.landQ;resize();
}
export let tA=null, tF=[null,null];

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

export const DETAIL=["auto","sharp","fast"];
export function resize(){
  var dpr=Math.min(window.devicePixelRatio||1,DETAIL[di]==="sharp"?3:2)*q;
  var w=Math.max(2,Math.floor(canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h||!tA){
    canvas.width=w;canvas.height=h;
    freeT(tA);freeT(tT[0]);freeT(tT[1]);freeT(tB[0]);freeT(tB[1]);freeT(tF[0]);freeT(tF[1]);tF=[null,null];landFreeTargets();stillFree();
    tA=target(w,h);tT[0]=target(w,h);tT[1]=target(w,h);
    var bw=Math.max(2,w>>2),bh=Math.max(2,h>>2);
    tB[0]=target(bw,bh);tB[1]=target(bw,bh);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
window.addEventListener("resize",resize);resize();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={setDetail, autoDetail, detailStep, get landQ(){return landQ},set landQ(v){landQ=v}, target, freeT, tT, tB, DETAIL, resize, get di(){return di},set di(v){di=v}, get q(){return q},set q(v){q=v},
  get acc(){return acc},set acc(v){acc=v}, get frames(){return frames},set frames(v){frames=v}, get qHold(){return qHold},set qHold(v){qHold=v}, get tA(){return tA},set tA(v){tA=v}, get tF(){return tF},set tF(v){tF=v}};
