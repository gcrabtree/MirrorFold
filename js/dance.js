/* The dancers: stick figures that dance to the music, drawn by the overlays Dancer (one), Chorus line (four doing the
   same dance together) and Dance floor (five, each with a dance of its own). This file listens for the beat and keeps
   a count of beats that runs on between them, so a move can be a plain rule from the count to a pose. A pose is
   thirteen numbers (where the hips are, how the arms are bent, where the feet are), and a figure's joints are
   worked out from them, with every limb keeping its length. While the music is quiet the figures stand and wait; as
   it fills they dance more widely, and choose livelier moves; when a drop lands they all jump. The trails pass draws
   the joints as lines (js/shaders.js). Nothing here flashes: a figure only moves, and a pose is eased to, never
   jumped to. Hold still stops them where they are, and they are left out while a loop is flown, since what they do
   next is chosen by chance and would not come round. */
import { clock } from "./clock.js";
import { calm } from "./dom.js";
import { lapOn } from "./lap.js";
import { soundChanged } from "./listen.js";
import { heard } from "./song.js";
import { OVERLAYS, sel } from "./state.js";
import { still } from "./still.js";

export const DN_MAX=5;       /* the most figures; the shader takes this many */
export const DN_HIP=0.5;     /* a figure is about 1 tall: how high the hips are when it stands, */
export const DN_SPINE=0.3;   /* the length of the back, */
export const DN_HEAD=0.09;   /* the head's radius, */
export const DN_NECK=0.025;  /* the neck between the shoulders and the head, */
export const DN_SHO=0.075;   /* how far each shoulder is from the neck: the shader works the shoulders out from this too, as a part of the head's radius, so the two numbers must keep their ratio there (js/shaders.js) */
export const DN_ARM=0.17;    /* each half of an arm, */
export const DN_LEG=0.25;    /* each half of a leg, */
export const DN_STANCE=0.085;/* and how far each foot stands from the middle */
export const DN_FAST=0.36;   /* a beat is taken to last between this many seconds (166 a minute) */
export const DN_SLOW=0.72;   /* and this (83 a minute): a quicker or slower pulse is counted as half or double */
/* a pose: 0 hips across, 1 hips lowered, 2 the whole figure off the floor, 3 the back's lean, 4 the head's tilt,
   5 and 6 the left arm (the upper arm's angle out from hanging straight down, then the bend at the elbow),
   7 and 8 the right arm, 9 and 10 the left foot (out from where it stands, and up), 11 and 12 the right foot */
export const DN_REST=[0,0.012,0,0,0,0.22,0.2,0.22,0.2,0,0,0,0];
export const dnU=[new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20)]; /* for the shader, four numbers a figure in each: neck and hips; left elbow and hand; right elbow and hand; left knee and foot; right knee and foot; the head's middle, its radius and how brightly the figure shows (0 for none) */
const A=[0,0,0,0,0,0,0,0,0,0,0,0,0],B=[0,0,0,0,0,0,0,0,0,0,0,0,0],J=[0,0,0,0,0,0,0,0,0,0,0,0,0],jt=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const crowd=[];              /* the figures: {mv, mir, pmv, pmir, bl, next, p} */
const st={u:0,du:0,pa:0,en:0,hype:0,jump:-1,kind:0,phrase:0}; /* the count of beats and this frame's step of it; how much pulse there has been lately; how widely they dance; how long since a drop; how far through a jump (in beats, -1 for none); which overlay they were set up for; how many times the chorus line has changed its dance */
let tick=null;

function S(x){return Math.sin(6.2831853*x);}
function C(x){return Math.cos(6.2831853*x);}
function ease(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function dip(u){return 0.5+0.5*C(u);}                 /* 1 on the beat, 0 half way to the next */
function sq(x){var s=S(x);return s/Math.sqrt(s*s+0.12);} /* a wave that stays at each end and crosses quickly but smoothly: the robot's way of moving */
function rest(o){for(var i=0;i<13;i++)o[i]=DN_REST[i];}
function hipsHands(o){o[5]=o[7]=0.75;o[6]=o[8]=-1.35;} /* both hands on the hips */

/* The moves. Each fills o with the pose at beat count u. lo, mid, hi: how full the music is when it may be chosen. */
export const MOVES=[
 {name:"sway",lo:1,f:function(u,o){var s=S(u/4);rest(o);o[0]=0.05*s;o[3]=0.06*s;o[4]=0.08*s;o[1]=0.012+0.016*dip(u);o[5]=0.3+0.2*s;o[7]=0.3-0.2*s;o[6]=o[8]=0.3;}},
 {name:"step",lo:1,mid:1,f:function(u,o){var s=S(u/2);rest(o);o[0]=0.07*s;o[1]=0.02+0.035*dip(u);o[3]=0.08*s;o[4]=-0.1*s;
   o[5]=0.5+0.25*s;o[7]=0.5-0.25*s;o[6]=o[8]=0.9+0.3*C(u);
   o[10]=0.05*Math.max(0,s);o[9]=-0.03*Math.max(0,s);o[12]=0.05*Math.max(0,-s);o[11]=-0.03*Math.max(0,-s);}},
 {name:"arm wave",lo:1,mid:1,f:function(u,o){rest(o);o[0]=0.04*S(u/2-0.2);o[3]=0.05*S(u/2-0.2);o[1]=0.02+0.025*dip(u);
   o[6]=0.8*S(u/2);o[5]=1.5+0.4*S(u/2-0.15);o[7]=1.5+0.4*S(u/2-0.3);o[8]=0.8*S(u/2-0.45);o[4]=0.12*S(u/2-0.22);}},
 {name:"twist",mid:1,hi:1,f:function(u,o){var s=S(u);rest(o);o[0]=0.045*s;o[1]=0.075+0.015*C(2*u);o[3]=-0.06*s;
   o[5]=0.6+0.35*s;o[7]=0.6-0.35*s;o[6]=o[8]=1.4;o[9]=0.02+0.02*s;o[11]=0.02-0.02*s;}},
 {name:"point",mid:1,f:function(u,o){var p=sq(u/4);rest(o);o[0]=-0.06*p;o[1]=0.02+0.03*dip(u);o[3]=0.07*p;o[4]=0.15*p;
   o[7]=1.2+1.4*p;o[8]=0.12;o[5]=0.75;o[6]=-1.35;}},
 {name:"robot",mid:1,f:function(u,o){rest(o);o[0]=0.03*sq(u/4);o[3]=0.06*sq(u/4);o[4]=0.2*sq(u/2+0.125);o[1]=0.02+0.02*dip(u);
   o[5]=o[7]=1.57;o[6]=1.5*sq(u/2);o[8]=-1.5*sq(u/2+0.25);}},
 {name:"kick",mid:1,hi:1,f:function(u,o){var s=S(u/2),l=Math.pow(Math.max(0,s),1.5),r=Math.pow(Math.max(0,-s),1.5);rest(o);hipsHands(o);
   o[0]=0.05*(l-r);o[3]=0.1*(l-r);o[1]=0.015+0.02*dip(u);o[9]=0.22*l;o[10]=0.28*l;o[11]=0.22*r;o[12]=0.28*r;}},
 {name:"hands up",mid:1,hi:1,f:function(u,o){var s=S(u/2);rest(o);o[0]=0.05*s;o[1]=0.015+0.03*dip(u);o[3]=0.1*s;o[4]=0.12*s;
   o[5]=2.6+0.35*s;o[7]=2.6-0.35*s;o[6]=0.3*S(u/2+0.15);o[8]=-0.3*S(u/2+0.15);}},
 {name:"star",hi:1,f:function(u,o){var k=0.5-0.5*C(u/2),a=S(u/2);rest(o);o[5]=o[7]=0.3+2.4*k;o[6]=o[8]=0.1;o[9]=o[11]=0.13*k;o[2]=0.045*a*a;o[1]=0.015;}},
 {name:"pump",hi:1,f:function(u,o){var e=dip(u);rest(o);o[2]=0.03*e;o[1]=0.01+0.03*(1-e);o[7]=2.2+0.6*e;o[8]=1.5*(1-e);o[5]=0.4;o[6]=1.2+0.2*e;o[3]=-0.04;}}
];
/* the jump at a drop, t beats after it starts (it takes DN_JUMP): down, up with the arms thrown high, and down again */
export const DN_JUMP=2.2;
function jumpPose(t,o){
  var fly=Math.sin(Math.PI*Math.max(0,Math.min(1,(t-0.5)/1.1))),up=ease((t-0.2)/0.8);
  rest(o);o[1]=0.11*Math.sin(Math.PI*Math.min(1,t/0.55))+0.07*Math.sin(Math.PI*Math.max(0,Math.min(1,(t-1.6)/0.6)));
  o[2]=0.2*fly;o[5]=o[7]=0.4+2.4*up;o[6]=o[8]=0.25;o[9]=o[11]=0.05*fly;
}
/* the same pose facing the other way: left and right change places */
function flipPose(o){
  var t;o[0]=-o[0];o[3]=-o[3];o[4]=-o[4];
  t=o[5];o[5]=o[7];o[7]=t;t=o[6];o[6]=o[8];o[8]=t;t=o[9];o[9]=o[11];o[11]=t;t=o[10];o[10]=o[12];o[12]=t;
}

/* A figure's joints from a pose p, into o as eleven places (across, up; the floor is 0 and the figure stands at 0
   across): neck, hips, left elbow, left hand, right elbow, right hand, left knee, left foot, right knee, right foot,
   the head's middle, and then the two shoulders, which stand out from the neck square to the back and are where the
   arms start. Every limb keeps its length: where a foot is too far for the leg, the hips come down to it. */
export function dancePose(p,o){
  var hop=Math.max(0,p[2]),R=2*DN_LEG-0.002,hx=p[0],hy=DN_HIP-Math.max(0,p[1])+hop,s,a,x,y,dx,dy,d,h,ex,ey;
  var fx=[Math.max(-0.42,Math.min(0.42,-(DN_STANCE+p[9])-hx))+hx,Math.max(-0.42,Math.min(0.42,DN_STANCE+p[11]-hx))+hx],fy=[Math.max(0,p[10])+hop,Math.max(0,p[12])+hop];
  for(s=0;s<2;s++)hy=Math.min(hy,fy[s]+Math.sqrt(R*R-(fx[s]-hx)*(fx[s]-hx)));
  for(s=0;s<2;s++)fy[s]=Math.min(fy[s],hy+Math.sqrt(R*R-(fx[s]-hx)*(fx[s]-hx))); /* and a foot held higher than the leg reaches comes down */
  x=hx+DN_SPINE*Math.sin(p[3]);y=hy+DN_SPINE*Math.cos(p[3]);
  o[0]=x;o[1]=y;o[2]=hx;o[3]=hy;
  o[20]=x+(DN_HEAD+DN_NECK)*Math.sin(p[3]+p[4]);o[21]=y+(DN_HEAD+DN_NECK)*Math.cos(p[3]+p[4]);
  for(s=0;s<2;s++){ /* s 0 is the left side, which is toward less across */
    h=s?1:-1;
    o[22+2*s]=x+h*DN_SHO*Math.cos(p[3]);o[23+2*s]=y-h*DN_SHO*Math.sin(p[3]);
    a=p[5+2*s];ex=o[22+2*s]+h*DN_ARM*Math.sin(a);ey=o[23+2*s]-DN_ARM*Math.cos(a);
    o[4+4*s]=ex;o[5+4*s]=ey;a+=p[6+2*s];
    o[6+4*s]=ex+h*DN_ARM*Math.sin(a);o[7+4*s]=ey-DN_ARM*Math.cos(a);
    /* the knee: off the line from hip to foot, always to the figure's own side, by what the two halves' length leaves */
    dx=fx[s]-hx;dy=fy[s]-hy;d=Math.max(1e-4,Math.sqrt(dx*dx+dy*dy));
    a=Math.sqrt(Math.max(0,DN_LEG*DN_LEG-d*d/4))/d;
    o[12+4*s]=hx+dx/2-h*dy*a;o[13+4*s]=hy+dy/2+h*dx*a;
    o[14+4*s]=fx[s];o[15+4*s]=fy[s];
  }
  return o;
}

/* Keeps the count of beats. Each frame it is given the seconds passed and the bass's pulse, and gives back {u, per}:
   u is the count, a whole number at each beat and running on evenly between, and per the seconds a beat lasts. A hit is
   the pulse rising well above where it had sunk to. The time between two hits, doubled or halved into DN_FAST to
   DN_SLOW, is taken as the beat's length when it agrees with what is held, or after three that do not. A hit that
   falls near a whole count pulls the count toward it; the pull is spread over the next frames, and the count never
   goes backward, so a figure following it never jerks. With no hits the count runs on as it was. */
export function makeBeatClock(){
  var u=0,per=0.5,low=0,since=9,pend=0,odd=0,off=0,got=false,out={u:0,per:0.5,du:0};
  return function(dt,p){
    var iv,e,c,du;
    since+=dt;low=Math.min(low,p);
    if(p>low+0.15&&p>0.2&&since>=0.24){
      iv=since;since=0;low=p;
      if(iv<2.2){
        while(iv>=DN_SLOW)iv/=2;while(iv<DN_FAST)iv*=2;
        if(!got){per=iv;got=true;odd=0;}
        else if(Math.abs(iv-per)<0.18*per){per+=(iv-per)*0.3;odd=0;}
        else if(++odd>=3){per=iv;odd=0;}
      }
      e=u-Math.round(u);
      if(Math.abs(e)<0.3){pend=-0.5*e;off=0;}
      else if(++off>=3){pend=-e;off=0;} /* three hits in a row between the counts: the count is what is out */
    }
    c=pend*Math.min(1,dt*8);pend-=c;
    du=Math.max(0.2*dt/per,dt/per+c);u+=du;
    out.u=u;out.per=per;out.du=du;
    return out;
  };
}

/* which move a figure takes up next: one fit for how full the music is (e, 0 to 1 and over), and not the one it has */
export function pickMove(e,not,rnd){
  var k=e<0.55?"lo":e<0.85?"mid":"hi",ok=[],i;
  for(i=0;i<MOVES.length;i++)if(MOVES[i][k]&&i!==not)ok.push(i);
  return ok[Math.min(ok.length-1,Math.floor(rnd*ok.length))];
}
/* how many figures an overlay has, and which of the three it is (0 for an overlay without figures) */
export function danceKind(){var o=OVERLAYS[sel.ovi];return o&&o.dance||0;}
function count(kind){return kind===1?1:kind===2?4:kind===3?5:0;}
function setUp(kind){
  var i,n=count(kind),m0=pickMove(st.en,-1,Math.random());
  crowd.length=0;st.kind=kind;st.phrase=0;
  for(i=0;i<n;i++)crowd.push({mv:kind===2?m0:pickMove(st.en,-1,Math.random()),mir:kind===3&&Math.random()<0.5,pmv:0,pmir:false,bl:1,
    next:Math.floor(st.u)+8+(kind===3?2*i:0),p:DN_REST.slice()});
}
/* One step for the figures: dt seconds, with bt the bass's pulse and mp the mids', level how full the music is (0 to 1),
   drop true in the frame a drop lands, changed true when the sound has just changed greatly, slow for less motion, and
   time the app's clock, which the standing figures breathe by. */
export function danceStep(dt,bt,mp,level,drop,changed,slow,time){
  var b=tick(dt,bt),du=b.du*(slow?0.5:1),go,amp,e,i,j,d,k,w,now;
  st.u+=du;st.du=du;now=Math.floor(st.u);
  st.pa+=(Math.max(bt,0.6*mp)-st.pa)*Math.min(1,dt);
  go=ease((st.pa-0.03)/0.09);
  st.en+=(go*(0.45+0.55*level)-st.en)*Math.min(1,dt/0.8);
  st.hype*=Math.exp(-dt/10);
  if(drop){st.hype=1;if(st.jump<0)st.jump=0;}
  e=st.en*(1+0.4*st.hype);amp=Math.min(1,e*1.15)*(slow?0.5:1);
  if(st.jump>=0){st.jump+=du;if(st.jump>DN_JUMP)st.jump=-1;}
  for(i=0;i<crowd.length;i++){
    d=crowd[i];
    /* a new move every eight beats or so, at once after a great change in the sound, and after a drop's jump; never
       while it is still going from the last move to this one, or the pose would jump */
    if(d.bl>=1&&(now>=d.next||changed||(st.jump<0&&d.late))){
      d.late=false;
      if(st.kind===2&&i>0){d.pmv=d.mv;d.pmir=d.mir;d.mv=crowd[0].mv;d.mir=!!(st.phrase%2)&&!!(i%2);} /* the chorus line follows its first figure; every other time, every other one faces the other way */
      else{d.pmv=d.mv;d.pmir=d.mir;d.mv=pickMove(e,d.mv,Math.random());d.mir=st.kind===3&&Math.random()<0.5;if(st.kind===2)st.phrase++;}
      d.bl=0;d.next=(st.kind===2?now:Math.max(now,d.next))+(st.kind===3&&Math.random()<0.4?16:8);
    }
    if(st.jump>=0)d.late=true;
    MOVES[d.mv].f(st.u,A);if(d.mir)flipPose(A);
    if(d.bl<1){
      MOVES[d.pmv].f(st.u,B);if(d.pmir)flipPose(B);
      k=ease(d.bl);for(j=0;j<13;j++)A[j]=B[j]+(A[j]-B[j])*k;
      d.bl=Math.min(1,d.bl+du/1.5); /* a beat and a half to go from one move to the next */
    }
    rest(B);B[1]+=0.006*Math.sin(time*1.4+i);B[0]=0.012*Math.sin(time*0.45+2*i);B[3]=0.02*Math.sin(time*0.45+2*i);
    for(j=0;j<13;j++)A[j]=B[j]+(A[j]-B[j])*amp;
    if(st.jump>=0){
      jumpPose(st.jump,J);w=ease(st.jump/0.3)*(1-ease((st.jump-DN_JUMP+0.5)/0.5))*(slow?0.5:1);
      for(j=0;j<13;j++)A[j]+=(J[j]-A[j])*w;
    }
    k=Math.min(1,dt*16);for(j=0;j<13;j++)d.p[j]+=(A[j]-d.p[j])*k; /* the pose is gone toward, never jumped to */
  }
}
/* A step of the frame: the count of beats is kept whatever is chosen, so that figures chosen later are in time at once. */
export function stepDance(fr){
  var kind=danceKind(),react=calm?0.25:1;
  if(still||lapOn())return;
  if(kind!==st.kind)setUp(kind);
  danceStep(fr.dt,fr.bt/react,fr.mp/react,heard.live?heard.level:0.6,heard.drop,soundChanged,calm,clock.time);
}
/* Where each figure stands: n figures of an overlay kind on a picture asp wide for 1 tall, as [across, floor, size,
   brightness] each. Across and up are measured from the middle in units of the picture's shorter side. The chorus line
   is one row; the dance floor is three in front and two smaller ones behind, between them. */
export function danceSpots(kind,asp){
  var hw=0.5*Math.max(1,asp),o=[],i,sp,s;
  if(kind===1)o.push([0,-0.36,0.64,1]);
  else if(kind===2){sp=Math.min(0.38,2*hw*0.9/4);s=Math.min(0.56,sp*1.5);for(i=0;i<4;i++)o.push([(i-1.5)*sp,-0.34,s,1]);}
  else if(kind===3){
    sp=Math.min(0.44,2*hw*0.9/3);s=Math.min(0.54,sp*1.6);
    for(i=0;i<3;i++)o.push([(i-1)*sp,-0.38,s,1]);
    for(i=0;i<2;i++)o.push([(i-0.5)*sp,-0.38+0.42*s,0.72*s,0.7]);
  }
  return o;
}
/* Fill dnU for the shader. Returns how many figures there are; none while a loop is flown. */
export function danceFill(kind,asp){
  var sp=lapOn()||kind!==st.kind?[]:danceSpots(kind,asp),i,j,q;
  for(i=0;i<DN_MAX;i++){
    if(i>=sp.length||!crowd[i]){dnU[5][4*i+3]=0;continue;}
    q=sp[i];dancePose(crowd[i].p,jt);
    for(j=0;j<10;j++){dnU[j>>1][4*i+2*(j&1)]=q[0]+q[2]*jt[2*j];dnU[j>>1][4*i+2*(j&1)+1]=q[1]+q[2]*jt[2*j+1];}
    dnU[5][4*i]=q[0]+q[2]*jt[20];dnU[5][4*i+1]=q[1]+q[2]*jt[21];dnU[5][4*i+2]=q[2]*DN_HEAD;dnU[5][4*i+3]=q[3];
  }
  return sp.length;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
tick=makeBeatClock();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={DN_MAX, DN_HIP, DN_SPINE, DN_HEAD, DN_NECK, DN_SHO, DN_ARM, DN_LEG, DN_STANCE, DN_FAST, DN_SLOW, DN_REST, DN_JUMP, dnU, MOVES, dancePose, makeBeatClock, pickMove,
  danceKind, danceStep, stepDance, danceSpots, danceFill, crowd, danceSt:st, get danceTick(){return tick},set danceTick(v){tick=v}};
