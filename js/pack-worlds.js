/* Worlds from packs.
   A pack world has shader code for its distance but no JavaScript, so everything that needs a distance goes through the
   probe. deMany() is the one way to ask for many points; packFrame() asks once a frame for the five points flight uses. */
import { cam, norm } from "./camera.js";
import { probe, probeOut, probePts } from "./probe.js";
import { WORLDS } from "./worlds.js";
export let NWORLD; /* how many worlds are built in; any after these came from a pack */
let packMs=0,packWait=0;
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

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
NWORLD=WORLDS.length;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={packId, packWorld, deMany, packD, packFrame, get NWORLD(){return NWORLD},set NWORLD(v){NWORLD=v}, get packMs(){return packMs},set packMs(v){packMs=v}, get packWait(){return packWait},set packWait(v){packWait=v}};
