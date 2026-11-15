/* Sprites: a few small lights with tails that fly through the world near you. Each one darts from place to place ahead
   of the camera, steers away from the surfaces, fades in when it arrives and out when it leaves, and swells on the beat.
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
export const flits=[];         /* each: where it is, how fast it is going, the place it is making for (ahead, right and up of the camera, in units of the open space here), its size, its age and the age it leaves at, seconds to its next change of mind, and seconds until it comes back (0 while it is out) */
export let flitsOn=true;       /* the Sprites switch */
export let flitU, flitT;       /* for the shader: each sprite's place and size (0 for none), and its tail's direction and length with how strongly it shows */

/* how strongly a sprite shows, 0 to 1: it fades in over its first FLIT_IN seconds and out over its last FLIT_OUT */
export function flitFade(age,life){return Math.max(0,Math.min(1,age/FLIT_IN,(life-age)/FLIT_OUT));}
/* a new place to make for: 2.5 to 7 times the open space ahead, and off to the side and up or down by less than half of that */
export function flitAim(r1,r2,r3){var d=2.5+4.5*r1;return [d,d*0.9*(r2-0.5),d*0.6*(r3-0.5)];}
/* the place a sprite is making for, in the world: the camera's place plus its aim along the camera's forward, right and up */
function aimAt(f,s,i){return cam.pos[i]+s*(cam.F[i]*f.aim[0]+cam.R[i]*f.aim[1]+cam.Up[i]*f.aim[2]);}
/* Why there are no sprites here, or "" if there can be. A pack world has no distance to ask every frame, a zoom world is a flat picture, and the land alone or a video has no world. */
export function flitBar(w){return w.pack||w.flat||landMode===1||vidAlone()?"none":"";}
/* Bring a sprite in: at the place it is making for, if that is in the open. If not, it tries again shortly. */
function arrive(f,w,m,s){
  var i;
  f.aim=flitAim(Math.random(),Math.random(),Math.random());
  for(i=0;i<3;i++){f.p[i]=aimAt(f,s,i);f.v[i]=cam.vel[i];}
  f.r=0.2*s;
  if(w.de(f.p[0],f.p[1],f.p[2],m)<0.3*s){f.wait=0.3;return;}
  f.aim=flitAim(Math.random(),Math.random(),Math.random()); /* and at once it sets off for somewhere else */
  f.age=0;f.life=4+7*Math.random();f.turn=0.4+1.2*Math.random();f.wait=0;
}
/* Move the sprites and fill flitU and flitT. They hold still with everything else. */
export function stepFlits(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,per=fr.per,s=Math.max(0.01,Math.min(0.6,fr.dist)),k,i,f,d,n,q,sp,lim,a,t,tl,near;
  for(k=0;k<4*NFLIT;k++)flitU[k]=flitT[k]=0;
  if(!flitsOn||!started||flitBar(w)){for(k=0;k<NFLIT;k++)flits[k].wait=0.5+2*Math.random();return;}
  for(k=0;k<NFLIT;k++){
    f=flits[k];
    if(!still){
      if(f.wait>0){f.wait-=dt;if(f.wait<=0)arrive(f,w,m,s);if(f.wait>0)continue;}
      f.age+=dt;f.turn-=dt;
      if(f.turn<=0){f.turn=0.4+1.4*Math.random();f.aim=flitAim(Math.random(),Math.random(),Math.random());}
      f.r+=(0.2*s-f.r)*Math.min(1,2*dt); /* its size follows the open space, so it looks much the same size wherever you are */
      /* a spring pulls it toward the place it is making for, and it is slowed against the camera's own motion, so it travels with you and swoops as it goes */
      for(i=0;i<3;i++)f.v[i]+=((aimAt(f,s,i)-f.p[i])*7-(f.v[i]-cam.vel[i])*3.2)*dt;
      /* within half the open space of a surface it is pushed away from it, harder the nearer it is; touching one it is put back out */
      d=w.de(f.p[0],f.p[1],f.p[2],m);near=0.5*s;
      if(d<near){
        n=facing(function(x,y,z,mm){return w.de(x,y,z,mm)},f.p[0],f.p[1],f.p[2],m,Math.max(1e-4,f.r*0.5));
        for(i=0;i<3;i++){f.v[i]+=n[i]*(near-d)/near*60*s*dt;if(d<0.1*s)f.p[i]+=n[i]*(0.1*s-d);}
      }
      /* no faster against the camera than 9 times the open space a second */
      sp=Math.hypot(f.v[0]-cam.vel[0],f.v[1]-cam.vel[1],f.v[2]-cam.vel[2]);lim=9*s;
      if(sp>lim)for(i=0;i<3;i++)f.v[i]=cam.vel[i]+(f.v[i]-cam.vel[i])*lim/sp;
      for(i=0;i<3;i++){f.p[i]+=f.v[i]*dt;f.p[i]-=per[i]*Math.floor(f.p[i]/per[i]+.5);}
      /* left behind, or far off, or stuck in a wall: it starts to leave now */
      a=0;t=0;for(i=0;i<3;i++){q=f.p[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);a+=q*cam.F[i];t+=q*q;}
      if((a<-s||t>400*s*s||d<-0.1*s)&&f.life-f.age>FLIT_OUT)f.life=f.age+FLIT_OUT;
      if(f.age>=f.life){f.wait=0.3+2.2*Math.random();continue;}
    }
    if(f.wait>0)continue;
    for(i=0;i<3;i++){q=f.p[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);flitU[4*k+i]=cam.pos[i]+q;} /* drawn at its nearest copy */
    flitU[4*k+3]=f.r*(1+0.5*(still?0:fr.bt)); /* it swells on the beat, but not while the picture is held */
    /* the tail trails behind its motion against the camera, at most six times its size long */
    tl=Math.hypot(f.v[0]-cam.vel[0],f.v[1]-cam.vel[1],f.v[2]-cam.vel[2])*0.3;lim=tl>6*f.r?6*f.r/tl:1;
    for(i=0;i<3;i++)flitT[4*k+i]=-(f.v[i]-cam.vel[i])*0.3*lim;
    flitT[4*k+3]=flitFade(f.age,f.life);
  }
}
export function setFlits(on){flitsOn=!!on;press($("bFlits"),flitsOn);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var k,sv=null;
flitU=new Float32Array(4*NFLIT);flitT=new Float32Array(4*NFLIT);
for(k=0;k<NFLIT;k++)flits.push({p:[0,0,0],v:[0,0,0],aim:[0,0,0],r:0,age:0,life:0,turn:0,wait:0.5+0.5*k});
try{sv=localStorage.getItem("mirrorfold-sprites")}catch(_){}
setFlits(sv?sv==="on":!calm); /* with reduced motion asked for they start off, unless they were turned on before */
$("bFlits").addEventListener("click",function(){
  setFlits(!flitsOn);try{localStorage.setItem("mirrorfold-sprites",flitsOn?"on":"off")}catch(_){}
  toast(flitsOn?"Sprites on":"Sprites off");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={NFLIT, FLIT_IN, FLIT_OUT, flits, flitFade, flitAim, aimAt, flitBar, arrive, stepFlits, setFlits,
  get flitsOn(){return flitsOn},set flitsOn(v){flitsOn=v}, get flitU(){return flitU},set flitU(v){flitU=v}, get flitT(){return flitT},set flitT(v){flitT=v}};
