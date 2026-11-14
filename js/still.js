/* Hold still: a pause, and the sharpening of the picture while nothing in it moves. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { $, gl, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { bindTex, link, pCopy, passTo } from "./programs.js";
import { sel } from "./state.js";
import { freeT, tA, target } from "./targets.js";
import { vidOn } from "./video.js";
import { stereo } from "./vr.js";
export let still=false;  /* the Hold still switch: the clocks, the morph, the drift and Journey are stopped */
export let stillN=0;     /* how many frames are in the kept picture, up to STILL_MAX; 0 while the scene is moving */
export const jit=[0,0];  /* how far this frame's rays are shifted, in pixels: a different part of each pixel every frame */
export const STILL_MAX=32;
let pAcc=null,rcur=0,shots=0,key="";
const tR=[null,null];    /* the kept picture and the one before it */
const was=[0,0,0,0,0,0,0,0,0,0]; /* where the camera was and which way it faced last frame, and the morph */

/* The kept picture moves a share k of the way to the new frame. Pictures hold 256 levels a colour, too few for a small
   share to register, so a different speck of noise is added each frame: on average the rounding then comes out right. */
export const FS_ACC=[
"precision highp float;varying vec2 v;uniform sampler2D uT,uP;uniform float uK,uSeed;",
"void main(){",
"  vec3 a=texture2D(uT,v).rgb,p=texture2D(uP,v).rgb;",
"  float n=fract(sin(dot(gl_FragCoord.xy+uSeed,vec2(12.9898,78.233)))*43758.5453)-0.5;",
"  gl_FragColor=vec4(mix(p,a,uK)+n/255.0,1.0);",
"}"].join("\n");

/* a number between 0 and 1 that fills the range evenly as i counts up (the Halton sequence in base b) */
export function halton(i,b){var f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;}

export function setStill(on){
  still=!!on;press($("bStill"),still);
  if(!still){stillN=0;jit[0]=jit[1]=0;}
}
export function stillFree(){freeT(tR[0]);freeT(tR[1]);tR[0]=tR[1]=null;stillN=0;}

/* Before the scene is drawn: is everything where it was last frame? If so, one more frame goes into the kept picture,
   with its rays shifted to a new part of each pixel. The land alone and a video are left as they are. */
export function stillAim(fr){
  if(!still||landMode===1||vidOn){stillN=0;jit[0]=jit[1]=0;return;}
  var now=[cam.pos[0],cam.pos[1],cam.pos[2],cam.F[0],cam.F[1],cam.F[2],cam.Up[0],cam.Up[1],cam.Up[2],fr.m],i,same=true;
  var k=scene.world.id+","+tA.w+","+tA.h+","+sel.mi+","+sel.pi+","+(stereo?1:0);
  for(i=0;i<10;i++){if(Math.abs(now[i]-was[i])>1e-9)same=false;was[i]=now[i];}
  if(k!==key){key=k;same=false;}
  stillN=same?Math.min(STILL_MAX,stillN+1):1;
  shots=same?shots+1:0;
  jit[0]=halton(shots%64+1,2)-0.5;jit[1]=halton(shots%64+1,3)-0.5;
}
/* After the scene is drawn: fold it into the kept picture, and put the kept picture where the scene was, for the effects to work on. */
export function stillBlend(){
  if(!stillN)return;
  if(!tR[0]){tR[0]=target(tA.w,tA.h);tR[1]=target(tA.w,tA.h);}
  var dst=tR[rcur],U=pAcc.U;
  passTo(dst,pAcc);bindTex(0,tA.t);bindTex(1,tR[1-rcur].t);
  gl.uniform1i(U.uT,0);gl.uniform1i(U.uP,1);gl.uniform1f(U.uK,1/stillN);gl.uniform1f(U.uSeed,shots*17.0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  passTo(tA,pCopy);bindTex(0,dst.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
  rcur=1-rcur;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
pAcc=link(FS_ACC,["uT","uP","uK","uSeed"]);
$("bStill").addEventListener("click",function(){
  setStill(!still);
  toast(still?"Holding still. The picture sharpens while you are not moving.":"Moving again");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={jit, STILL_MAX, FS_ACC, halton, setStill, stillFree, stillAim, stillBlend, tR, was,
  get still(){return still},set still(v){still=v}, get stillN(){return stillN},set stillN(v){stillN=v}, get pAcc(){return pAcc},set pAcc(v){pAcc=v},
  get rcur(){return rcur},set rcur(v){rcur=v}, get shots(){return shots},set shots(v){shots=v}, get key(){return key},set key(v){key=v}};
