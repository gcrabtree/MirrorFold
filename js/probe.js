import { cam, norm } from "./camera.js";
import { scene } from "./choose.js";
import { clock, morphValue } from "./clock.js";
import { gl } from "./dom.js";
import { bindTex, link, passTo } from "./programs.js";
import { fragSource } from "./shaders.js";
import { pCopy, tA, target } from "./targets.js";
import { WORLDS } from "./worlds.js";
let probeT=null; /* the 16 by 1 picture the answers are read from */
export let NWORLD;
let packMs, packWait;

export const probePts=new Float32Array(48);
export const probePx=new Uint8Array(64);
export const probeOut=new Float32Array(16);
export function probeBuild(w){
  if(w.probe!==undefined)return w.probe;
  var src=fragSource(w);
  try{w.probe=link(src.slice(0,src.indexOf("void main(){"))+[
"uniform vec3 uPts[16];",
"void main(){",
"  vec3 p=vec3(0.0);int k=int(gl_FragCoord.x);",
"  for(int i=0;i<16;i++)if(i==k)p=uPts[i];",
"  float v=clamp((map(p)+8.0)/16.0,0.0,0.999999);",
"  vec3 e=fract(v*vec3(1.0,255.0,65025.0));e.xy-=e.yz/255.0;",
"  gl_FragColor=vec4(e,1.0);",
"}"].join("\n"),["uPts","uM","uTime"]);}catch(e){w.probe=null;}
  return w.probe;
}
export function probe(w,m,n){ /* the distances at the first n points in probePts go into probeOut; false if this world cannot be probed */
  if(w.volume)return false;
  var P=probeBuild(w),i;if(!P)return false;
  if(!probeT)probeT=target(16,1);
  passTo(probeT,P);gl.uniform3fv(P.U.uPts,probePts);gl.uniform1f(P.U.uM,m);gl.uniform1f(P.U.uTime,clock.time);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.readPixels(0,0,16,1,gl.RGBA,gl.UNSIGNED_BYTE,probePx);
  for(i=0;i<n;i++)probeOut[i]=(probePx[4*i]/255+probePx[4*i+1]/65025+probePx[4*i+2]/16581375)*16-8;
  return true;
}
function packId(name){return "pack"+name.toLowerCase().replace(/[^a-z]/g,"");}
export function packWorld(c){ /* c has been through cleanWorld */
  var per=c.period,f=function(v){return v.toFixed(4)};
  return {id:packId(c.name),name:c.name,hue:c.hue,fog:c.fog,maxd:c.maxd,speed:c.speed,pack:true,src:c,
    period:function(){return per},
    glsl:[
"float wmap(vec3 p,float m){",c.code,"}",
"float map(vec3 p){",
"  vec3 per=vec3("+f(per[0])+","+f(per[1])+","+f(per[2])+");p=mod(p+0.5*per,per)-0.5*per;", /* folded here, so the world repeats exactly whatever the code does */
"  orb=vec4(1000.0);float d=clamp(wmap(p,uM),-8.0,8.0);",
"  if(orb.w>999.0)orb=vec4(abs(sin(p*3.0)),0.5+0.5*sin(d*20.0));", /* code that sets no colour still gets some */
"  return d;",
"}"],
    de:function(x,y,z,m){probePts[0]=x;probePts[1]=y;probePts[2]=z;return probe(this,m,1)?probeOut[0]:0.1;}};
}
export function deMany(w,pts,n,m){ /* distances at n points (x,y,z in pts), by script for a built-in world, by the probe, 16 at a time, for a pack world */
  var out=new Float32Array(n),i,k,c;
  if(!w.pack){for(i=0;i<n;i++)out[i]=w.de(pts[3*i],pts[3*i+1],pts[3*i+2],m);return out;}
  for(i=0;i<n;i+=16){
    c=Math.min(16,n-i);for(k=0;k<3*c;k++)probePts[k]=pts[3*i+k];
    if(probe(w,m,c))for(k=0;k<c;k++)out[i+k]=probeOut[k];else for(k=0;k<c;k++)out[i+k]=0.1;
  }
  return out;
}
/* Once a frame for a pack world: the distance at the camera and at the four points the autopilot steers by, in one
   question. If the chip takes long to answer (over 4 ms on average), it is asked every third frame and the last answer reused. */
export const packD=[0.1,0.1,0.1,0.1,0.1];
export function packFrame(w,m,pr){
  if(packMs>4&&packWait>0){packWait--;return;}
  var t0=performance.now(),k,j,d,sx=[0,1,-1,0,0],sy=[0,0,0,1,-1];
  for(k=0;k<5;k++){
    d=k?norm([cam.F[0]+0.7*(cam.R[0]*sx[k]+cam.Up[0]*sy[k]),cam.F[1]+0.7*(cam.R[1]*sx[k]+cam.Up[1]*sy[k]),cam.F[2]+0.7*(cam.R[2]*sx[k]+cam.Up[2]*sy[k])]):[0,0,0];
    for(j=0;j<3;j++)probePts[3*k+j]=cam.pos[j]+d[j]*pr;
  }
  if(probe(w,m,5))for(k=0;k<5;k++)packD[k]=Math.abs(probeOut[k]);
  packMs+=(performance.now()-t0-packMs)*0.1;packWait=2;
}

/* Wait for the graphics chip before starting a new picture, by reading one point back from it. Without this the
   browser may queue several pictures ahead of the chip and then stall while it catches up, which shows as stutter
   even though the average rate is high. (Found by accident: with Stats on, whose probe does the same wait, a PC with a
   144 Hz screen ran smoothly, and with it off it stuttered.) A pack world's own probe, later in the frame, does the same job. */
export function chipWait(){
  if(scene.world.volume||scene.hyb||!probe(scene.world,morphValue(),1)){ /* done the way Stats does it: draw into the small picture, then read from it */
    if(!probeT)probeT=target(16,1);
    passTo(probeT,pCopy);bindTex(0,tA.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,probePx);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- the distance probe ----------
   Asks the graphics chip for a world's distance at up to 16 points, using the same GLSL "map" the picture is drawn with.
   Each point is one pixel of a 16 by 1 picture; the distance, kept between -8 and 8, is spread over three colour bytes
   and read back. This is how a world that has no JavaScript distance function (one from a pack) could still be flown
   through. Reading a picture back makes the page wait for the chip, so it is timed (see Stats). */

/* ---------- worlds from packs ----------
   A pack world has shader code for its distance but no JavaScript, so everything that needs a distance goes through the
   probe. deMany() is the one way to ask for many points; packFrame() asks once a frame for the five points flight uses. */
NWORLD=WORLDS.length;
packMs=0;
packWait=0;
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get probeT(){return probeT},set probeT(v){probeT=v}, get NWORLD(){return NWORLD},set NWORLD(v){NWORLD=v}, get packMs(){return packMs},set packMs(v){packMs=v}, get packWait(){return packWait},set packWait(v){packWait=v}, get probePts(){return probePts}, get probePx(){return probePx},
  get probeOut(){return probeOut}, get probeBuild(){return probeBuild}, get probe(){return probe}, get packId(){return packId}, get packWorld(){return packWorld}, get deMany(){return deMany},
  get packD(){return packD}, get packFrame(){return packFrame}, get chipWait(){return chipWait}};
