/* Sprites: a few small dots of light that wander through the world on paths of their own. Each one drifts along slowly,
   turning a little all the time, now and then zigs off a new way with a short burst of speed, steers away from the
   surfaces so that it never runs into one, fades in when it arrives and out when it leaves, and swells on the beat.
   They are drawn by the scene shader at their true places, so a wall in front of one hides it and the VR viewer gives
   each eye its own view of them. */
import { cam } from "./camera.js";
import { $, calm, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { started } from "./loop.js";
import { facing } from "./spark.js";
import { still } from "./still.js";
import { vidAlone } from "./video.js";
export const NFLIT=6;          /* how many there are; the scene shader has a line for each (js/shaders.js) */
export const FLIT_IN=0.6,FLIT_OUT=0.8; /* seconds a sprite takes to fade in and to fade out */
export const flits=[];         /* each: where it is (p), the way it is heading (h, a unit vector), the slow push that keeps turning it (wob), its size (r), its age and the age it leaves at, seconds to its next zig, how much of a zig's burst of speed is left (1 to 0), and seconds until it comes back (0 while it is out) */
export let flitsOn=true;       /* the Sprites switch */
export let flitU, flitA;       /* for the shader: each sprite's place and size (0 for none), and how strongly it shows */

/* how strongly a sprite shows, 0 to 1: it fades in over its first FLIT_IN seconds and out over its last FLIT_OUT */
export function flitFade(age,life){return Math.max(0,Math.min(1,age/FLIT_IN,(life-age)/FLIT_OUT));}
/* where a sprite arrives, in the camera's own frame: 3 to 9 times the open space ahead, and off to the side and up or down by less than half of that */
export function flitAim(r1,r2,r3){var d=3+6*r1;return [d,d*0.9*(r2-0.5),d*0.6*(r3-0.5)];}
/* a heading turned by a push and made one unit long again; if the two cancel, the heading is kept */
export function flitTurn(h,px,py,pz){
  var x=h[0]+px,y=h[1]+py,z=h[2]+pz,l=Math.hypot(x,y,z);
  if(l<1e-9)return [h[0],h[1],h[2]];
  return [x/l,y/l,z/l];
}
/* a heading that no longer goes into a surface facing along n: the part of it that points in is taken away */
export function flitSlide(h,n){
  var d=h[0]*n[0]+h[1]*n[1]+h[2]*n[2];
  if(d>=0)return [h[0],h[1],h[2]];
  return flitTurn([h[0]-d*n[0],h[1]-d*n[1],h[2]-d*n[2]],0,0,0);
}
/* a direction by chance, any way equally likely */
function anyWay(){
  var z=2*Math.random()-1,a=6.28318*Math.random(),r=Math.sqrt(1-z*z);
  return [r*Math.cos(a),r*Math.sin(a),z];
}
/* Why there are no sprites here, or "" if there can be. A pack world has no distance to ask every frame, a zoom world is a flat picture, and the land alone or a video has no world. */
export function flitBar(w){return w.pack||w.flat||landMode===1||vidAlone()?"none":"";}
/* Bring a sprite in, somewhere ahead of the camera, if that place is in the open. If not, it tries again shortly. */
function arrive(f,w,m,s){
  var i,a=flitAim(Math.random(),Math.random(),Math.random());
  for(i=0;i<3;i++)f.p[i]=cam.pos[i]+s*(cam.F[i]*a[0]+cam.R[i]*a[1]+cam.Up[i]*a[2]);
  if(w.de(f.p[0],f.p[1],f.p[2],m)<0.3*s){f.wait=0.3;return;}
  f.h=anyWay();f.wob=[0,0,0];f.r=0.07*s;
  f.age=0;f.life=10+15*Math.random();f.zig=2+5*Math.random();f.burst=0;f.wait=0;
}
/* One step of a sprite's flight, by itself so that it can be tested without a page: de is the world's distance, s the
   open space round the camera, wSpeed the world's top speed, per its period. */
export function flitMove(f,de,m,s,wSpeed,per,dt){
  var near=0.35*s,i,d,da,n,t,z,sp;
  f.r+=(0.07*s-f.r)*Math.min(1,2*dt); /* its size follows the open space round the camera */
  /* it wanders: a push that itself drifts by chance keeps turning its heading a little */
  for(i=0;i<3;i++)f.wob[i]+=((Math.random()-0.5)*5-f.wob[i]*0.8)*dt;
  f.h=flitTurn(f.h,f.wob[0]*dt,f.wob[1]*dt,f.wob[2]*dt);
  /* now and then it zigs: a new heading, mostly sideways to the old one, and a burst of speed that dies away in about a second */
  f.zig-=dt;
  if(f.zig<=0){z=anyWay();f.h=flitTurn(f.h,z[0]*1.6-f.h[0]*0.7,z[1]*1.6-f.h[1]*0.7,z[2]*1.6-f.h[2]*0.7);f.zig=3+6*Math.random();f.burst=1;}
  f.burst*=Math.exp(-3*dt);
  /* it keeps clear of the surfaces: where it is, and a little way ahead, a surface nearer than "near" turns it away, harder the nearer it is */
  d=de(f.p[0],f.p[1],f.p[2],m);
  if(d<near){
    n=facing(de,f.p[0],f.p[1],f.p[2],m,Math.max(1e-4,f.r*0.5));
    t=(1-d/near)*8*dt;f.h=flitTurn(f.h,n[0]*t,n[1]*t,n[2]*t);
    if(d<2*f.r){for(i=0;i<3;i++)f.p[i]+=n[i]*(2*f.r-d);f.h=flitSlide(f.h,n);} /* touching: put back out, and no longer heading in */
  }
  da=de(f.p[0]+f.h[0]*near,f.p[1]+f.h[1]*near,f.p[2]+f.h[2]*near,m);
  if(da<near&&da<d){
    n=facing(de,f.p[0]+f.h[0]*near,f.p[1]+f.h[1]*near,f.p[2]+f.h[2]*near,m,Math.max(1e-4,f.r*0.5));
    t=(1-da/near)*8*dt;f.h=flitTurn(f.h,n[0]*t,n[1]*t,n[2]*t);
  }
  /* slow: six tenths of what the camera could fly at where the sprite is, and up to two and a half times that in a zig; never further in a frame than the open space it has */
  sp=0.6*Math.min(wSpeed,Math.max(0.03,Math.abs(d)*2.6))*(1+1.5*f.burst);
  sp=Math.min(sp*dt,Math.max(0,0.5*d));
  for(i=0;i<3;i++){f.p[i]+=f.h[i]*sp;f.p[i]-=per[i]*Math.floor(f.p[i]/per[i]+.5);}
}
/* Move the sprites and fill flitU and flitA. They hold still with everything else.
   s is the open space round the camera, which sets their size and how near a surface they may come, so they look and
   behave alike in a tight world and an open one. */
export function stepFlits(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,per=fr.per,s=Math.max(0.01,Math.min(0.6,fr.dist)),k,i,f,q,a,t;
  var de=function(x,y,z2,mm){return w.de(x,y,z2,mm)};
  for(k=0;k<NFLIT;k++){flitU[4*k]=flitU[4*k+1]=flitU[4*k+2]=flitU[4*k+3]=0;flitA[k]=0;}
  if(!flitsOn||!started||flitBar(w)){for(k=0;k<NFLIT;k++)flits[k].wait=0.5+2*Math.random();return;}
  for(k=0;k<NFLIT;k++){
    f=flits[k];
    if(!still){
      if(f.wait>0){f.wait-=dt;if(f.wait<=0)arrive(f,w,m,s);if(f.wait>0)continue;}
      f.age+=dt;
      flitMove(f,de,m,s,w.speed,per,dt);
      /* left well behind, or far off: it starts to leave now */
      a=0;t=0;for(i=0;i<3;i++){q=f.p[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);a+=q*cam.F[i];t+=q*q;}
      if((a<-2*s||t>400*s*s)&&f.life-f.age>FLIT_OUT)f.life=f.age+FLIT_OUT;
      if(f.age>=f.life){f.wait=0.3+2.2*Math.random();continue;}
    }
    if(f.wait>0)continue;
    for(i=0;i<3;i++){q=f.p[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);flitU[4*k+i]=cam.pos[i]+q;} /* drawn at its nearest copy */
    flitU[4*k+3]=f.r*(1+0.7*(still?0:fr.bt)); /* it swells on the beat, but not while the picture is held */
    flitA[k]=flitFade(f.age,f.life);
  }
}
export function setFlits(on){flitsOn=!!on;press($("bFlits"),flitsOn);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var k,sv=null;
flitU=new Float32Array(4*NFLIT);flitA=new Float32Array(NFLIT);
for(k=0;k<NFLIT;k++)flits.push({p:[0,0,0],h:[0,0,1],wob:[0,0,0],r:0,age:0,life:0,zig:0,burst:0,wait:0.5+0.5*k});
try{sv=localStorage.getItem("mirrorfold-sprites")}catch(_){}
setFlits(sv?sv==="on":!calm); /* with reduced motion asked for they start off, unless they were turned on before */
$("bFlits").addEventListener("click",function(){
  setFlits(!flitsOn);try{localStorage.setItem("mirrorfold-sprites",flitsOn?"on":"off")}catch(_){}
  toast(flitsOn?"Sprites on":"Sprites off");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={NFLIT, FLIT_IN, FLIT_OUT, flits, flitFade, flitAim, flitTurn, flitSlide, anyWay, flitBar, arrive, flitMove, stepFlits, setFlits,
  get flitsOn(){return flitsOn},set flitsOn(v){flitsOn=v}, get flitU(){return flitU},set flitU(v){flitU=v}, get flitA(){return flitA},set flitA(v){flitA=v}};
