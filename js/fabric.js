/* The Fabric world's waves: how high the cloth is lifted at a place, now. The shader works the same sum out from the
   same twelve numbers (uFb), so the two agree; js/worlds.js has the weave itself. Nothing here touches the page. */

/* The twelve numbers: five heights, then seven angles (each kept between nothing and a whole turn, so that the
   chip's short numbers lose nothing however long the page has been open).
   0 billow: one long wave to the cloth's period, travelling along x, its front bent
   1 cross wave: a shorter one running aslant
   2 flutter: fine quick waves, as at a flag's edge
   3 swell: humps that rise and fall where they stand
   4 gust: one steep front that runs down the cloth
   5,6 the billow's place and its front's bend; 7 the cross wave's place; 8,9 the flutter's place and bend;
   10 the swell's rise and fall; 11 the gust's place */
export const fb=new Float32Array(12);
export const FB_K=0.5235988;                    /* one wave to the cloth's period of 12 */
export const FB_BASE=[0.28,0.09,0.012,0.05,0.1]; /* the heights with no sound */
export const FB_SND=[0.16,0.06,0.03,0.10,0.14];  /* what the sound adds at its fullest: the low end to the billow, the mids to the cross wave and the swell, the treble to the flutter, the beat to the gust */
export const FB_RATE=[0.8,0.3,1.7,6,1,2.1,1.5]; /* how fast each angle turns, a second */
export const FB_TOP=0.26;    /* the highest a thread stands above the cloth's middle */
export const FB_CLEAR=0.12;  /* the nearest the camera comes to the threads */
export const FB_CEIL=5;      /* the highest it flies above the cloth's middle */
export const FB_ALT=0.9;     /* the height the autopilot keeps */

/* Set the twelve numbers from the time and the sound: the low end's level, the mids', the treble's and the beat's
   pulse, each 0 to 1. The same time and sound always give the same cloth, so a loop comes round. With reduced motion
   asked for (calm) the waves are half as high and half as fast. */
export function fbSet(t,lv,mv,hv,bt,calm){
  var c=function(v){return Math.max(0,Math.min(1,v||0))},s=[c(lv),c(mv),c(hv),c(mv),c(bt)],k=calm?0.5:1,i,a;
  for(i=0;i<5;i++)fb[i]=k*(FB_BASE[i]+FB_SND[i]*s[i]);
  for(i=0;i<7;i++){a=FB_RATE[i]*k*t;fb[5+i]=a-6.283185307179586*Math.floor(a/6.283185307179586);}
}
/* how high the cloth's middle is at a place: fbH in the shader */
export function fbH(x,z){
  var k=FB_K,h=fb[0]*Math.sin(k*x-fb[5]+0.6*Math.sin(k*z+fb[6]));
  h+=fb[1]*Math.sin(k*(2*x+3*z)-fb[7]);
  h+=fb[2]*Math.sin(7*k*x-fb[8]+2*Math.sin(2*k*z+fb[9]));
  h+=fb[3]*Math.sin(3*k*x)*Math.sin(2*k*z)*Math.cos(fb[10]);
  h+=fb[4]*Math.exp(6*(Math.cos(k*x-fb[11]+Math.sin(k*z))-1));
  return h;
}
/* Keep a place above the cloth and under the ceiling: pos and vel are changed in place. The cloth rises under the
   camera as a wave passes, so this is done every frame, whoever moved the camera. True if it was moved. */
export function fbHold(pos,vel){
  var h=fbH(pos[0],pos[2]),lo=h+FB_TOP+FB_CLEAR,hi=h+FB_CEIL;
  if(pos[1]<lo){pos[1]=lo;if(vel[1]<0)vel[1]=0;return true;}
  if(pos[1]>hi){pos[1]=hi;if(vel[1]>0)vel[1]=0;return true;}
  return false;
}

/* for the test tools and the browser console: every name in this file */
export const __dbg={fb, FB_K, FB_BASE, FB_SND, FB_RATE, FB_TOP, FB_CLEAR, FB_CEIL, FB_ALT, fbSet, fbH, fbHold};
