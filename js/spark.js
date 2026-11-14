/* Throw a light: a small glowing ball that flies ahead and bounces off the world's surfaces. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { $, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { landMode } from "./land.js";
import { started } from "./loop.js";
import { still } from "./still.js";
import { vidAlone } from "./video.js";
export const spark={p:[0,0,0],v:[0,0,0],r:0,life:0}; /* where it is, how fast it is going, its size, and the seconds it has left (0 for none) */
export const SPARK_LIFE=20,SPARK_KEEP=0.8; /* it lasts twenty seconds, and keeps four fifths of its speed at each bounce */

/* a velocity after hitting a surface that faces along n (a unit vector): turned back if it was heading in, and slowed */
export function bounce(v,n,keep){
  var d=v[0]*n[0]+v[1]*n[1]+v[2]*n[2];
  if(d>=0)return [v[0],v[1],v[2]];
  return [(v[0]-2*d*n[0])*keep,(v[1]-2*d*n[1])*keep,(v[2]-2*d*n[2])*keep];
}
/* which way a surface faces near a point, from the distance either side of it along each axis */
export function facing(de,x,y,z,m,e){
  var gx=de(x+e,y,z,m)-de(x-e,y,z,m),gy=de(x,y+e,z,m)-de(x,y-e,z,m),gz=de(x,y,z+e,m)-de(x,y,z-e,m),l=Math.hypot(gx,gy,gz);
  return l>1e-12?[gx/l,gy/l,gz/l]:[0,1,0];
}
/* Why a light cannot be thrown here, or "" if it can. A pack world has no distance to ask every frame, a cloud world has no surfaces, and the land alone or a video has no world. */
export function sparkBar(w){
  if(w.pack)return "A light cannot be thrown in a world from a pack.";
  if(w.volume)return "There is nothing in a cloud world for a light to bounce off.";
  if(landMode===1||vidAlone())return "A light needs a world to fly in.";
  return "";
}
export function throwSpark(dist,wSpeed){
  var why=sparkBar(scene.world),sp,i;
  if(why){toast(why);return false;}
  sp=1.6*Math.min(wSpeed,Math.max(0.03,dist*2.6))*cam.baseSpeed; /* a little faster than the camera can fly here */
  spark.r=Math.max(0.0015,Math.min(0.03,dist*0.05));
  for(i=0;i<3;i++){spark.p[i]=cam.pos[i]+cam.F[i]*spark.r*4;spark.v[i]=cam.vel[i]+cam.F[i]*sp;}
  spark.life=SPARK_LIFE;
  return true;
}
/* Move the light, bounce it, and leave in fr.sparkU where to draw it and how big (0 for none). It holds still with everything else. */
export function stepSpark(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,per=fr.per,U=fr.sparkU,i,d,n,q;
  U[0]=U[1]=U[2]=U[3]=0;
  if(spark.life<=0)return;
  if(sparkBar(w)){spark.life=0;return;}
  if(!still){
    spark.life-=dt;
    for(i=0;i<3;i++)spark.p[i]+=spark.v[i]*dt;
    d=w.de(spark.p[0],spark.p[1],spark.p[2],m);
    if(d<spark.r){
      n=facing(function(x,y,z,mm){return w.de(x,y,z,mm)},spark.p[0],spark.p[1],spark.p[2],m,Math.max(1e-4,spark.r*0.5));
      for(i=0;i<3;i++)spark.p[i]+=n[i]*(spark.r-d); /* back out of the surface, then away from it */
      spark.v=bounce(spark.v,n,SPARK_KEEP);
    }
    for(i=0;i<3;i++)spark.p[i]-=per[i]*Math.floor(spark.p[i]/per[i]+.5);
  }
  for(i=0;i<3;i++){q=spark.p[i]-cam.pos[i];q-=per[i]*Math.floor(q/per[i]+.5);U[i]=cam.pos[i]+q;} /* drawn at its nearest copy */
  U[3]=spark.r*Math.min(1,spark.life/3); /* it shrinks away over its last three seconds */
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("bSpark").addEventListener("click",function(){if(started)sparkAsk=true;wakeHud()});
}
export let sparkAsk=false; /* a throw has been asked for; the frame loop does it when it knows the distance to the nearest surface */
export function sparkFrame(fr){if(sparkAsk){sparkAsk=false;throwSpark(fr.dist,fr.wSpeed);}}
export function askSpark(){sparkAsk=true;}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={spark, SPARK_LIFE, SPARK_KEEP, bounce, facing, sparkBar, throwSpark, stepSpark, sparkFrame, askSpark, get sparkAsk(){return sparkAsk},set sparkAsk(v){sparkAsk=v}};
