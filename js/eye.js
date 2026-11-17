/* The eye: a human eye drawn last of all, over the finished picture. The pupil is a window: the world, with its
   motion, overlay and filter, shows only there. The iris is a network of fibres that changes shape and takes its colours
   from the palette, or keeps a colour of its own. The white has a few blood vessels that move with the music. The view
   stays close in on the eye, and what shows beyond the lids is a bumpy surface of pores that open and shut with the
   beat. The lids blink now and then; a blink can change the world while the lids are shut.
   It is flat on the screen, so it is left out in the VR viewer. Everything in it that changes with time comes from
   the clocks and the frame's sound, so that Hold still stops it and a loop comes round; the blink, the gaze and the
   pupil's easing are the exceptions, and stepEye stops them while still and leaves them out while a loop is flown. */
import { scene, setWorldNow } from "./choose.js";
import { clock } from "./clock.js";
import { $, calm, gl, toast } from "./dom.js";
import { doorOwed } from "./doors.js";
import { flightPlaying } from "./flightplay.js";
import { press, wakeHud } from "./input.js";
import { jPick, jPool, journey, jt } from "./journey.js";
import { scoreNow } from "./scoreplay.js";
import { lapOn } from "./lap.js";
import { palCur } from "./palettes.js";
import { bindTex, link, passTo } from "./programs.js";
import { still } from "./still.js";
import { freeT, target } from "./targets.js";
import { tgGuest } from "./together.js";
import { stereo } from "./vr.js";
import { tr } from "./warp.js";
import { WORLDS } from "./worlds.js";
import { zoomOk } from "./zoom.js";

export const EYES=[{name:"off"},{name:"on"}];
/* How near the eye is seen from: a step from 0, the whole eye, to EYE_STEPS, where the iris fills the picture.
   eyeRadius gives the iris's radius for a step, where the shorter side of the picture is 1 and asp is the picture's
   width over its height: each step multiplies it by the same amount, from EYE_FAR up to a little more than the way
   from the middle of the picture to its corner. */
export const EYE_STEPS=6,EYE_FAR=0.2;
export function eyeFill(asp){var l=0.5*Math.max(asp,1/asp);return 1.04*Math.sqrt(0.25+l*l);}
/* The pupil's radius as a part of the iris's, as drawn: pu is what the sound asks for, r the iris's radius. Seen from
   very near, a pupil of its full size would take the whole of a tall picture and leave the iris to the corners, so
   it is held to about a third of the picture's shorter side (EYE_PUPIL at rest), and still opens with the sound. */
export const EYE_PUPIL=0.34;
export function eyePupil(pu,r){return Math.min(pu,EYE_PUPIL*pu/0.55/r);}
export function eyeRadius(step,asp){return EYE_FAR*Math.pow(eyeFill(asp)/EYE_FAR,Math.max(0,Math.min(EYE_STEPS,step))/EYE_STEPS);}
/* The iris's colour: the palette's, or one of its own. c is three colours: round the pupil, the body of the iris, and its rim. */
export const IRIS=[
 {name:"follows the palette"},
 {name:"blue",c:[[.80,.72,.50],[.30,.52,.78],[.10,.20,.38]]},
 {name:"green",c:[[.82,.66,.30],[.36,.58,.34],[.12,.26,.18]]},
 {name:"hazel",c:[[.86,.62,.26],[.52,.44,.22],[.22,.20,.10]]},
 {name:"brown",c:[[.74,.46,.20],[.42,.24,.11],[.14,.08,.04]]},
 {name:"grey",c:[[.78,.76,.66],[.50,.56,.62],[.16,.20,.25]]}
];
export const BLINKS=["off","now and then","changes the world"];
export const BLINK_SHUT=0.18,BLINK_HELD=0.07,BLINK_OPEN=0.3; /* seconds to shut, to stay shut and to open; with reduced motion asked for they are doubled */
export const BLINK_GAP=[5,11]; /* seconds between blinks: at least, and at most */
export let eyeMode=0;   /* which of EYES */
export let irisI=0;     /* which of IRIS */
export let blinkMode=1; /* which of BLINKS */
export let eyeZoom=3;   /* how near the eye is seen from, 0 to EYE_STEPS */
let pEye=null,eyeBad=false,tE=null;
const ey={
  ph:0,t:0,next:6,b:0, /* the blink: 0 open, 1 shutting, 2 shut, 3 opening; seconds into that; seconds until the next; how out2 shut, 0 to 1 */
  wt:0,wnext:30,       /* seconds since a blink last changed the world, and how long until one does */
  gx:0,gy:0,           /* where the eye looks, as a part of the iris's radius: it follows the turning of the view */
  pu:0.55,mv:0,        /* the pupil's radius as a part of the iris's, and the eased level of the mids, which moves the vessels */
  z:3,                 /* how near the eye is seen from now, as a step that need not be whole: it eases toward eyeZoom */
  por:0                /* how far the pores' cycles have run: it moves on with time, and faster on the beat */
};
const col=[[0,0,0],[0,0,0],[0,0,0]];

export const FS_EYE=[
"precision highp float;varying vec2 v;uniform sampler2D uT;uniform vec2 uRes,uGaze;uniform float uTime,uR,uPu,uBlink,uVes,uBeat,uMo,uPor;uniform vec3 uI0,uI1,uI2,uTint;",
"float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
/* smooth noise whose second number comes round every per, so that it can be wrapped round a circle with no seam */
"float vn(vec2 p,float per){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float y0=mod(i.y,per),y1=mod(i.y+1.0,per);",
"  return mix(mix(h2(vec2(i.x,y0)),h2(vec2(i.x+1.0,y0)),f.x),mix(h2(vec2(i.x,y1)),h2(vec2(i.x+1.0,y1)),f.x),f.y);}",
"float fbm(vec2 p,float per){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*vn(p,per);p*=2.0;per*=2.0;a*=0.5;}return s/0.9375;}",
"float fb2(vec2 p,float per){return 0.667*vn(p,per)+0.333*vn(p*2.0,per*2.0);}",
"vec3 world(vec2 uv){return texture2D(uT,clamp(uv,0.0,1.0)).rgb;}",
/* The surround: what little shows beyond the lids is not skin but a bumpy surface full of pores. This is its height at
   a place: low swells, and a pit with a raised rim to most squares of a grid, set off-centre by chance, large or small. Each pore opens
   and shuts on a cycle of its own, at its own speed, as uPor moves on; uPor runs faster on the beat (stepEye). */
"float surf(vec2 p,float c){",
"  vec2 g=p/c,i0=floor(g);float ht=1.1*fb2(g*0.4,256.0)+0.18*fb2(g*2.3,256.0);",
/* a pore and its rim reach at most 0.62 of a square from its middle, which is at most a quarter off-centre: so the
   nine squares round a place hold every pore that can reach it. A larger pore would show the squares' edges. */
"  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){",
"    vec2 id=i0+vec2(float(i),float(j));float a=h2(id),b=h2(id+37.0),s=0.5+0.5*sin(6.2831853*(a+uPor*(0.5+b)));",
"    float d=length(g-id-0.5-0.5*(vec2(b,h2(id+71.0))-0.5)),rr=(0.07+0.23*s)*(0.3+0.7*b);",
"    ht+=step(0.2,h2(id+11.0))*(0.22*(0.4+0.6*s)*exp(-pow((d-rr*1.2)/(rr*0.35),2.0))-(0.5+0.6*s)*smoothstep(rr,rr*0.2,d));}",
"  return ht;}",
"void main(){",
"  float asp=uRes.x/uRes.y,mn=min(asp,1.0),px=1.0/min(uRes.x,uRes.y);",
"  vec2 p=(v-0.5)*vec2(asp,1.0)/mn;", /* the shorter side of the picture is 1 */
/* the lids: two curves that meet at the corners. A blink brings the upper one down to the lower, which rises a little. */
"  float W=uR*2.65,x=p.x/W,xx=clamp(1.0-x*x,0.0,1.0);",
"  float up=uR*1.02*pow(xx,0.62)*(1.0-0.16*x)-uR*0.05*x,lo=-uR*0.96*pow(xx,0.8)*(1.0+0.12*x)-uR*0.05*x;",
"  float shut=lo*0.72-uR*0.014*x,yU=mix(up,shut,uBlink),yL=mix(lo,shut,uBlink*0.999);",
"  float dU=yU-p.y,dL=p.y-yL,open=min(min(dU,dL),(1.0-abs(x))*W);",
"  vec3 col=vec3(0.0);",
"  if(open>-2.0*px){",
"    vec2 q=p-uGaze*uR;float r=length(q),an=atan(q.y,q.x)/6.2831853+0.5,rp=uR*uPu;",
/* the white: a ball, darker toward the corners and pinker; a little of the palette's colour in it */
"    vec3 wh=vec3(0.95,0.93,0.91)*mix(vec3(1.0),0.72+0.5*uTint,0.16);",
"    float ax=abs(x),vr=r/uR;",
"    wh*=1.0-0.42*smoothstep(0.25,1.0,ax);wh=mix(wh,vec3(0.80,0.50,0.46),0.4*smoothstep(0.5,1.0,ax));",
/* blood vessels: the lines where a noise crosses its middle value. The noise changes quickly round the eye and slowly
   outward, so the lines run outward and wander. They are thicker and more of them toward the corners. */
"    float wv=fbm(vec2(vr*1.6+uVes,an*6.0),6.0);",
"    float n1=fbm(vec2(vr*0.8+3.0,an*12.0+wv*2.6),12.0),n2=fb2(vec2(vr*1.3+7.0-uVes*0.7,an*28.0+wv*4.0),28.0);",
"    float out2=smoothstep(1.05,2.2,vr),some=smoothstep(0.36,0.56,fb2(vec2(vr*1.1+11.0,an*5.0),5.0));",
"    float l1=1.0-smoothstep(0.0,0.017*(0.5+wv)*(1.0+0.5*uBeat)*(0.5+out2),abs(n1-0.5));",
"    float l2=1.0-smoothstep(0.0,0.016*(0.4+out2),abs(n2-0.5));",
"    wh=mix(wh,vec3(0.72,0.12,0.10),min(1.0,(0.8*l1*(0.3+0.7*some)+0.4*l2*some)*smoothstep(1.02,1.4,vr)*(0.4+0.6*out2)*(1.0+0.3*uBeat)));",
/* the pink corner by the nose */
"    wh=mix(wh,vec3(0.78,0.47,0.44)*(0.85+0.25*fb2(p*90.0,64.0)),0.9*smoothstep(1.0,0.35,length((p-vec2(-0.9*W,-0.12*uR))/vec2(0.1*W,0.24*uR))));",
"    col=wh;",
/* the iris: its fibres are a noise stretched outward and bent by a slower noise, which moves with uMo so the network
   changes shape. t runs from 0 at the pupil to 1 at the rim, so the fibres stretch as the pupil opens. */
"    if(r<uR*1.03){",
"      float t=clamp((r-rp)/(uR-rp),0.0,1.0);",
"      float w=fbm(vec2(t*2.2+uMo,an*8.0)+vec2(0.0,0.6*sin(uMo*1.7)),8.0);",
"      float f1=fbm(vec2(t*1.7+w*1.6-uMo*0.6,an*56.0+w*2.2),56.0),f2=fbm(vec2(t*4.5-w*1.5+uMo*0.4+4.0,an*24.0-w*3.0),24.0),f3=fb2(vec2(t*1.2+w+2.0,an*128.0+w*3.0),128.0);",
"      float net=pow(1.0-abs(2.0*f1-1.0),3.0)*0.8+pow(1.0-abs(2.0*f2-1.0),4.0)*0.6+0.35*f3;",
"      vec3 ic=mix(uI0,uI1,smoothstep(0.08,0.5,t+0.35*(w-0.5)));ic=mix(ic,uI2,0.75*smoothstep(0.55,1.0,t+0.2*(w-0.5)));",
"      ic*=0.22+1.15*net;",
"      ic+=uI0*0.4*exp(-pow((t-0.26-0.12*(w-0.5))/0.07,2.0))*(0.5+net);", /* the wavy ring round the pupil */
"      float cr=fbm(vec2(t*4.0+9.0+uMo*0.5,an*14.0+w*2.0),14.0);ic*=1.0-0.6*smoothstep(0.58,0.72,cr)*smoothstep(0.1,0.35,t)*(1.0-smoothstep(0.55,0.9,t));", /* dark hollows */
"      ic*=1.0+0.3*uBeat*net;",
"      ic*=(0.35+0.65*smoothstep(0.0,0.1,t))*(1.0-0.8*smoothstep(0.78,1.0,t));", /* dark at the pupil's edge and at the rim */
"      col=mix(ic,col,smoothstep(0.96,1.03,vr));",
/* the pupil: the world. The middle of the finished picture is seen through it, somewhat smaller, four readings to a pixel */
"      if(r<rp+2.0*px){",
"        vec2 d=q/rp;float dd=dot(d,d),hf=0.5*sqrt(min(1.0,2.0*rp));",
"        vec2 sc=hf*(0.8+0.2*dd)*vec2(mn/asp,mn),e=0.35*px/rp*sc;",
"        vec2 uv=0.5+d*sc;",
"        vec3 wc=0.25*(world(uv+e)+world(uv-e)+world(uv+vec2(e.x,-e.y))+world(uv+vec2(-e.x,e.y)));",
"        wc*=1.0-0.75*smoothstep(0.86,1.0,sqrt(dd));",
"        col=mix(wc,col,smoothstep(rp-1.5*px,rp+1.5*px,r));",
"      }",
"    }",
/* light on the wet surface: a window's reflection, and a fainter one opposite */
"    vec2 hq=(q-vec2(-0.36,0.40)*uR)/uR;float hl=smoothstep(0.2,0.13,length(hq*vec2(1.0,1.3)+vec2(0.0,0.7*hq.x*hq.x)))*(0.75+0.25*smoothstep(-0.2,0.2,hq.y));",
"    hl+=0.3*smoothstep(0.09,0.02,length((q-vec2(0.30,-0.38)*uR)/uR));",
"    col=mix(col,vec3(1.0),0.85*hl);",
/* the lids' shadow on the ball, and the wet line along the lower lid */
"    col*=1.0-0.62*exp(-max(dU,0.0)/(uR*0.26))-0.28*exp(-max(dL,0.0)/(uR*0.1));",
"    col+=vec3(0.5)*smoothstep(0.03*uR,0.012*uR,dL)*smoothstep(0.0,0.01*uR,dL)*xx;",
"  }",
"  if(open<2.0*px){",
/* the surround, lit from the upper left, in the palette's colour, brightest near the eye. Each lid's part of it moves
   with that lid, so a blink carries the pores down with it. */
"    float above=p.y-yU,cx=smoothstep(0.0,0.3,xx),c=uR*0.16,e=c*0.05;",
"    vec2 sp=p-vec2(0.0,p.y>0.5*(yU+yL)?yU-up:yL-lo);",
"    float h0=surf(sp,c);vec3 nn=normalize(vec3((h0-surf(sp+vec2(e,0.0),c))/e,(h0-surf(sp+vec2(0.0,e),c))/e,1.6/c));",
"    float lit=max(dot(nn,normalize(vec3(-0.45,0.55,0.7))),0.0),sp2=pow(max(dot(nn,normalize(vec3(-0.3,0.37,1.2))),0.0),24.0);",
"    vec3 sk=mix(vec3(0.22,0.19,0.21),uTint,0.5)*(0.12+0.95*lit)*(0.75+0.35*smoothstep(-1.2,0.4,h0))+vec3(0.35)*sp2*(0.3+0.7*uTint);",
"    sk*=0.35+0.75*exp(-max(-open,0.0)/(uR*0.9));",
"    sk*=1.0-0.7*smoothstep(0.05*uR,0.0,max(above,-dL))*cx;", /* the lids' dark rims */
"    col=mix(sk,col,smoothstep(-px,px,open));",
"  }",
"  gl_FragColor=vec4(col,1.0);",
"}"].join("\n");

/* One step of the blink. s is {ph,t,next,b} as in ey above; slow doubles its times (reduced motion); rnd is a chance
   number from 0 to 1, used to choose the wait before the next. Returns true on the step the lids come shut. The lid
   moves along a curve that starts and ends gently, so the picture is never cut off in one frame. */
export function blinkStep(s,dt,slow,rnd){
  var k=slow?2:1,e,hit=false;
  s.t+=dt;
  if(s.ph===0){s.b=0;if(s.t>=s.next){s.ph=1;s.t=0;}}
  else if(s.ph===1){e=Math.min(1,s.t/(BLINK_SHUT*k));s.b=e*e*(3-2*e);if(e>=1){s.ph=2;s.t=0;hit=true;}}
  else if(s.ph===2){s.b=1;if(s.t>=BLINK_HELD*k){s.ph=3;s.t=0;}}
  else{e=Math.min(1,s.t/(BLINK_OPEN*k));s.b=1-e*e*(3-2*e);if(e>=1){s.ph=0;s.t=0;s.b=0;s.next=(BLINK_GAP[0]+(BLINK_GAP[1]-BLINK_GAP[0])*rnd)*k;}}
  return hit;
}
/* The world a blink changes to: Journey's choice where Journey is choosing worlds, otherwise any other world this
   device can draw. -1 for none. */
function blinkPick(){
  var cur=WORLDS.indexOf(scene.world),c,key,i,pool=[];
  if(journey&&jt.world.mode==="random"){
    c=jt.world;key=jPick("world",c,scene.world.id,jPool("world",c),"");
    for(i=0;i<WORLDS.length;i++)if(WORLDS[i].id===key&&i!==cur)return i;
    return -1;
  }
  for(i=0;i<WORLDS.length;i++)if(i!==cur&&!(WORLDS[i].flat&&!zoomOk()))pool.push(i);
  return pool.length?pool[Math.floor(Math.random()*pool.length)]:-1;
}
/* The lids have just come shut: change the world behind them, if this blink is one that does. Not while something
   else has the world in hand: a transition, a doorway, a flight being played, or a host being followed. */
function blinkShut(){
  var i;
  if(blinkMode!==2||ey.wt<ey.wnext)return;
  if(tr.warpDir!==0||doorOwed()||flightPlaying()||tgGuest()||scoreNow())return; /* nor while a score is playing: the world is the score's */
  i=blinkPick();
  if(i>=0&&setWorldNow(i)){ey.wt=0;ey.wnext=24+20*Math.random();}
}
/* A step of the frame: the blink, where the eye looks, and the pupil. Hold still stops all three. While a loop is
   flown the lids stay open, the eye looks ahead and the pupil takes the loop's own beat, so the lap comes round. */
export function stepEye(fr){
  var dt=fr.dt,k;
  if(!eyeMode||still)return;
  if(lapOn()){ey.ph=0;ey.t=0;ey.b=0;ey.gx=ey.gy=0;ey.mv=0;ey.pu=0.55+0.06*fr.bt;ey.por=clock.time*0.5;return;} /* the pores take the loop's clock, which comes round */
  ey.wt+=dt;
  if(blinkMode===0){if(ey.ph===0){ey.t=0;ey.b=0;}else blinkStep(ey,dt,calm,Math.random());} /* a blink under way is finished */
  else if(blinkStep(ey,dt,calm,Math.random()))blinkShut();
  /* the eye looks the way the view is being turned */
  k=1-Math.exp(-dt*5);
  ey.gx+=(Math.max(-1,Math.min(1,fr.lx/Math.max(dt,1e-3)*0.6))*0.3-ey.gx)*k;
  ey.gy+=(Math.max(-1,Math.min(1,-fr.ly/Math.max(dt,1e-3)*0.6))*0.2-ey.gy)*k;
  /* the pupil opens with the low end, and a little more on the beat */
  ey.pu+=(0.53+(calm?0.04:0.13)*Math.min(1,fr.lv)+(calm?0:0.04)*fr.bt-ey.pu)*(1-Math.exp(-dt*4));
  ey.mv+=(fr.mv-ey.mv)*(1-Math.exp(-dt*2));
  ey.por+=dt*(calm?0.2:0.3+1.6*fr.bt); /* the pores' cycles run on in surges, one to a beat */
}
/* whether the eye is drawn this frame; makes its program the first time, and turns the eye off if that fails */
export function eyeShown(){
  if(!eyeMode||stereo||eyeBad)return false;
  if(!pEye){
    try{pEye=link(FS_EYE,["uT","uRes","uGaze","uTime","uR","uPu","uBlink","uVes","uBeat","uMo","uPor","uI0","uI1","uI2","uTint"]);}
    catch(e){eyeBad=true;setEye(0);toast("The eye does not work on this device.");return false;}
  }
  return true;
}
/* the picture the finished frame is drawn into while the eye is on, for the eye to show in its pupil */
export function eyeTarget(w,h){
  if(tE&&(tE.w!==w||tE.h!==h)){freeT(tE);tE=null;}
  if(!tE)tE=target(w,h);
  return tE;
}
export function eyeFree(){freeT(tE);tE=null;}
/* The last pass while the eye is on: the eye, to the screen, with the finished picture src in its pupil. */
export function drawEye(fr,src){
  var U=pEye.U,ir=IRIS[irisI],tint=fr.tint,j,k,x,tx=clock.hueT+fr.wHue;
  for(k=0;k<3;k++)for(j=0;j<3;j++){
    /* following the palette: three places along it, the one round the pupil lightened and the rim darkened */
    if(ir.c)col[k][j]=ir.c[k][j];
    else{x=tx+[0.42,0.08,0.7][k];col[k][j]=Math.min(1,Math.max(0,palCur.a[j]+palCur.b[j]*Math.cos(6.28318*(palCur.c[j]*x+palCur.d[j]))))*[0.8,0.85,0.4][k]+[0.2,0.08,0.02][k];}
  }
  passTo(null,pEye);bindTex(0,src.t);gl.uniform1i(U.uT,0);
  gl.uniform2f(U.uRes,src.w,src.h);gl.uniform1f(U.uTime,clock.time);
  ey.z+=(eyeZoom-ey.z)*(1-Math.exp(-fr.dt*(calm?2:4))); /* eased here, not in stepEye, so that the buttons work under Hold still too */
  if(Math.abs(eyeZoom-ey.z)<1e-3)ey.z=eyeZoom;
  var R=eyeRadius(ey.z,src.w/src.h);gl.uniform1f(U.uR,R);gl.uniform1f(U.uPor,ey.por);gl.uniform1f(U.uPu,eyePupil(ey.pu,R));gl.uniform2f(U.uGaze,ey.gx+0.02*Math.sin(clock.time*0.31),ey.gy+0.015*Math.sin(clock.time*0.23+1));
  gl.uniform1f(U.uBlink,ey.b);gl.uniform1f(U.uBeat,calm?0:fr.bt);
  gl.uniform1f(U.uVes,clock.time*0.02+0.35*ey.mv);       /* the vessels wander slowly, and move with the mids */
  gl.uniform1f(U.uMo,clock.time*0.035+0.6*fr.m);        /* the iris changes shape with the clock and with the world's morph */
  gl.uniform3fv(U.uI0,col[0]);gl.uniform3fv(U.uI1,col[1]);gl.uniform3fv(U.uI2,col[2]);
  gl.uniform3f(U.uTint,tint[0],tint[1],tint[2]);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
function keep(k,v){try{localStorage.setItem("mirrorfold-"+k,v)}catch(_){}}
function kept(k,list){var s="",i;try{s=localStorage.getItem("mirrorfold-"+k)||""}catch(_){}for(i=0;i<list.length;i++)if((list[i].name||list[i])===s)return i;return -1;}
/* The eye: off or on. Its other two buttons show only while it is on. */
export function setEye(i){
  eyeMode=EYES[i]?i:0;
  $("bEye").textContent="Eye "+EYES[eyeMode].name;press($("bEye"),eyeMode>0);
  $("bIris").hidden=$("bBlink").hidden=$("bEyeIn").hidden=$("bEyeOut").hidden=!eyeMode;
  if(eyeMode){ey.ph=0;ey.t=0;ey.b=0;ey.next=BLINK_GAP[0];}else eyeFree();
  keep("eye",EYES[eyeMode].name);
}
/* How near the eye is seen from. The two buttons go one step each way, and say so when there is no further to go. */
export function setEyeZoom(k){
  eyeZoom=Math.max(0,Math.min(EYE_STEPS,Math.round(+k)||0));
  $("bEyeIn").disabled=eyeZoom>=EYE_STEPS;$("bEyeOut").disabled=eyeZoom<=0;
  keep("eyezoom",String(eyeZoom));
}
export function setIris(i){irisI=IRIS[i]?i:0;$("bIris").textContent="Iris "+IRIS[irisI].name;keep("iris",IRIS[irisI].name);}
export function setBlink(i){blinkMode=BLINKS[i]?i:0;$("bBlink").textContent="Blink "+BLINKS[blinkMode];press($("bBlink"),blinkMode>0);ey.wt=0;keep("blink",BLINKS[blinkMode]);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
var a=kept("iris",IRIS),b=kept("blink",BLINKS),c=kept("eye",EYES),z="";
try{z=localStorage.getItem("mirrorfold-eyezoom")||""}catch(_){}
setEyeZoom(/^[0-6]$/.test(z)?+z:3);ey.z=eyeZoom;
$("bEyeIn").addEventListener("click",function(){setEyeZoom(eyeZoom+1);toast(eyeZoom>=EYE_STEPS?"The iris fills the picture":"Nearer the eye");wakeHud()});
$("bEyeOut").addEventListener("click",function(){setEyeZoom(eyeZoom-1);toast(eyeZoom<=0?"The whole eye":"Further from the eye");wakeHud()});
setIris(a<0?0:a);setBlink(b<0?1:b);setEye(c<0?0:c);
$("bEye").addEventListener("click",function(){
  setEye((eyeMode+1)%EYES.length);
  toast(!eyeMode?"Eye off":stereo?"The eye is on. It does not show in the VR viewer.":"The world shows in the pupil of an eye");wakeHud();
});
$("bIris").addEventListener("click",function(){setIris((irisI+1)%IRIS.length);wakeHud()});
$("bBlink").addEventListener("click",function(){
  setBlink((blinkMode+1)%BLINKS.length);
  toast(blinkMode===2?"Now and then a blink changes the world while the eye is shut":blinkMode?"The eye blinks now and then":"The eye does not blink");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={EYES, IRIS, BLINKS, BLINK_SHUT, BLINK_HELD, BLINK_OPEN, BLINK_GAP, FS_EYE, ey, blinkStep, blinkPick, blinkShut, stepEye, eyeShown, eyeTarget, eyeFree, drawEye, setEye, setIris, setBlink, setEyeZoom, eyeFill, eyeRadius, eyePupil, EYE_PUPIL, EYE_STEPS, EYE_FAR, get eyeZoom(){return eyeZoom},set eyeZoom(v){eyeZoom=v},
  get eyeMode(){return eyeMode},set eyeMode(v){eyeMode=v}, get irisI(){return irisI},set irisI(v){irisI=v}, get blinkMode(){return blinkMode},set blinkMode(v){blinkMode=v},
  get pEye(){return pEye},set pEye(v){pEye=v}, get eyeBad(){return eyeBad},set eyeBad(v){eyeBad=v}, get tE(){return tE},set tE(v){tE=v}};
