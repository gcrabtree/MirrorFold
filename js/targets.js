/* The effect programs, the pictures they draw into, and the picture size. */
import { canvas, gl } from "./dom.js";
import { landFreeTargets, landMode } from "./land.js";
import { stillFree } from "./still.js";
export let di=0,q=0.85; /* the detail setting (a position in DETAIL) and the sharpness it currently gives, 0.35 to 1 */
export let landQ=1;      /* how large the land's own picture is beside the whole picture: 1, 0.7 or 0.5 */
let acc=0,frames=0,loading=0;
const ds={slowN:0,hold:0,wait:20000,up:false}; /* what Detail auto remembers between readings */
const DKEY="mirrorfold-detail"; /* what Detail auto settled on */
const LKEY="mirrorfold-load";   /* kept from start-up until the pictures are running; found still there at the next visit, the last one ended before that */
export let fellBack=false;      /* this visit started less sharp because the last one ended while starting */
export function setDetail(i){
  di=i;q=DETAIL[di]==="fast"?0.5:(DETAIL[di]==="sharp"?1:0.85);landQ=DETAIL[di]==="fast"?0.7:1;
  if(DETAIL[di]==="auto")keepDetail(); /* choosing auto again starts it afresh */
  resize();
}
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
/* Detail auto, deciding. avg is the mean time of the last 30 pictures and now the clock in ms; s holds what has gone
   before: {slowN, hold, wait, up}. Returns "down", "up", "roomy" (up, with a great deal of time to spare) or null.
   One slow reading is not enough: it takes two in a row, since a single one is often the page doing something else.
   After a step down nothing goes up until hold; and if that step down undid a step up, the wait before the next try
   is doubled, up to DWAIT_MAX, so a chip that sits near the edge is not shaken back and forth. */
export const DWAIT=20000,DWAIT_MAX=160000;
export function detailNext(avg,now,s){
  if(avg>0.036){
    if(++s.slowN<2)return null;
    s.slowN=0;
    if(s.up)s.wait=Math.min(DWAIT_MAX,s.wait*2);
    s.up=false;s.hold=now+s.wait;
    return "down";
  }
  s.slowN=0;
  if(avg<0.022&&now>s.hold){s.up=true;return avg<0.012?"roomy":"up";}
  return null;
}
/* What Detail auto found is kept for the next visit, so a slow device does not have to find it again each time.
   This reads what was kept: null unless it is a sharpness in range and one of the land's three sizes. */
export function detailSaved(text){
  var o;try{o=JSON.parse(text)}catch(_){return null;}
  if(!o||typeof o.q!=="number"||!(o.q>=0.35&&o.q<=1)||[1,0.7,0.5].indexOf(o.landQ)<0)return null;
  return {q:o.q,landQ:o.landQ};
}
function keepDetail(){try{localStorage.setItem(DKEY,JSON.stringify({q:Math.round(q*1000)/1000,landQ:landQ}))}catch(_){}}
/* The graphics chip gave up, or the last visit ended before it got going: keep a lower setting for the next visit. */
export function detailLower(){q=Math.max(0.35,Math.min(q,0.85)*0.7);landQ=0.5;keepDetail();}
/* Detail auto: every 30 frames, hold sharpness and give up frame rate first, stepping down only below about 28 fps */
export function autoDetail(now,dt){
  acc+=dt;frames++;
  if(frames<30)return;
  var avg=acc/frames,st=null,d;acc=0;frames=0;
  if(loading&&++loading>20){loading=0;try{localStorage.removeItem(LKEY)}catch(_){}} /* 600 pictures drawn: this visit got going */
  if(DETAIL[di]!=="auto")return;
  d=detailNext(avg,now,ds);
  if(!d)return;
  st=detailStep(d==="down",d==="roomy",q,landQ,landMode>0);
  if(!st)return;
  q=st.q;landQ=st.landQ;keepDetail();resize(); /* each change rebuilds every picture, which shows as a hitch */
}
export let tA=null, tF=[null,null];
export let tD=null; /* the picture of the world seen through a doorway, made when the first doorway is drawn */
export function doorTarget(){if(!tD)tD=target(tA.w,tA.h);return tD;}

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
    freeT(tA);freeT(tT[0]);freeT(tT[1]);freeT(tB[0]);freeT(tB[1]);freeT(tF[0]);freeT(tF[1]);tF=[null,null];freeT(tD);tD=null;landFreeTargets();stillFree();
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
var got=null,died=false;
try{got=detailSaved(localStorage.getItem(DKEY));died=localStorage.getItem(LKEY)==="1";localStorage.setItem(LKEY,"1");}catch(_){}
if(got){q=got.q;landQ=got.landQ;}
if(died){fellBack=true;detailLower();}
loading=1;
window.addEventListener("pagehide",function(){try{localStorage.removeItem(LKEY)}catch(_){}}); /* leaving the page is not a crash */
window.addEventListener("resize",resize);resize();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={doorTarget, get tD(){return tD}, setDetail, autoDetail, detailStep, get landQ(){return landQ},set landQ(v){landQ=v}, target, freeT, tT, tB, DETAIL, resize, get di(){return di},set di(v){di=v}, get q(){return q},set q(v){q=v},
  get acc(){return acc},set acc(v){acc=v}, get frames(){return frames},set frames(v){frames=v}, ds, DKEY, LKEY, DWAIT, DWAIT_MAX, detailNext, detailSaved, detailLower, keepDetail, get fellBack(){return fellBack},set fellBack(v){fellBack=v}, get loading(){return loading},set loading(v){loading=v}, get tA(){return tA},set tA(v){tA=v}, get tF(){return tF},set tF(v){tF=v}};
