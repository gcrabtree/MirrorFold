/* The dancers: stick figures that dance to the music, drawn by the overlays Dancer (one), Chorus line (four doing the
   same dance together) and Dance floor (five, each with a dance of its own). They are meant to move as a person in a
   suit with lines down the limbs would: the figure is a body in space, with shoulders, hips, knees that bend forward
   and feet that point where it faces, and what is drawn is that body seen from in front, a little nearer things
   larger. This file listens for the beat and keeps a count of beats that runs on between them; a move (js/moves.js)
   is a rule from the count to a pose, and the body's joints are worked out from the pose with every limb keeping its
   length. While the music is quiet the figures stand and wait; as it fills they choose livelier moves; when a drop
   lands they all jump. The trails pass draws the joints as lines (js/shaders.js). Nothing here flashes: a figure
   only moves, and a pose is eased to, never jumped to. Hold still stops them where they are, and they are left out
   while a loop is flown, since what they do next is chosen by chance and would not come round. */
import { clock } from "./clock.js";
import { calm } from "./dom.js";
import { lapOn } from "./lap.js";
import { soundChanged } from "./listen.js";
import { MOVES, MV_N, MV_REST, flipPose, moveBob, moveGo, movePose } from "./moves.js";
import { heard } from "./song.js";
import { OVERLAYS, sel } from "./state.js";
import { still } from "./still.js";

export const DN_MAX=5;       /* the most figures; the shader takes this many */
export const DN_HIP=0.52;    /* a figure is 1 tall: how high the hips are when it stands, */
export const DN_SPINE=0.3;   /* the length of the back, */
export const DN_HEAD=0.075;  /* the head's radius, */
export const DN_NECK=0.03;   /* the neck between the shoulders and the head, */
export const DN_SHO=0.1;     /* how far each shoulder is from the neck, */
export const DN_HIPW=0.05;   /* and each hip joint from the middle of the hips, */
export const DN_ARM=0.16;    /* the upper arm, */
export const DN_FORE=0.17;   /* the forearm, to the middle of the hand, */
export const DN_CLEAR=0.15;  /* how near its shoulder a hand may be asked for before it is moved off (see danceBody), */
export const DN_LEG=0.26;    /* each half of a leg, */
export const DN_FOOT=0.07;   /* the foot, from ankle to toe, */
export const DN_STANCE=0.08; /* how far each foot stands from the middle, */
export const DN_NEAR=0.45;   /* how much larger a thing looks for each figure height it is nearer the viewer, */
export const DN_EYE=0.55;    /* and the height the viewer looks from */
export const DN_FAST=0.36;   /* a beat is taken to last between this many seconds (166 a minute) */
export const DN_SLOW=0.72;   /* and this (83 a minute): a quicker or slower pulse is counted as half or double */
export const DN_SIZE=0.65;   /* how large the figures are drawn, as a part of the room danceSpots gives each */
export const dnU=[new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20),new Float32Array(20)]; /* for the shader, four numbers a figure in each: neck and hips; the shoulders; left elbow and hand; right elbow and hand; the hip joints; left knee and ankle; right knee and ankle; the toes; the head's middle, its radius and how brightly the figure shows (0 for none) */
const A=new Array(MV_N),B=new Array(MV_N),J=new Array(MV_N),flat=new Array(35);
const crowd=[];              /* the figures: {rt, ri, mv, mir, u0, pmv, pmir, pu0, bl, next, tx, p, b, mem}: the routine and how far through it; the move, whether it is faced the other way and the beat it began on; the same for the move before, and how far the figure has gone over from it; the beat to change on; how far the figure has travelled from its place; the pose; the body; where the elbows were */
const st={u:0,du:0,pa:0,kick:0,en:0,hype:0,jump:-1,kind:0,phrase:0}; /* the count of beats and this frame's step of it; how much pulse there has been lately; the kick as the figures feel it; how much they dance; how long since a drop; how far through a jump (in beats, -1 for none); which overlay they were set up for; how many times the chorus line has changed its dance */
let tick=null;

function ease(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
function rest(o){for(var i=0;i<MV_N;i++)o[i]=MV_REST[i];}
function turnTo(a,b){var d=b-a;return d-6.2831853*Math.round(d/6.2831853);} /* the short way round from one turn to another */

/* the jump at a drop, t beats after it starts (it takes DN_JUMP): down, up with the arms thrown high, and down again */
export const DN_JUMP=2.2;
function jumpPose(t,o){
  var fly=Math.sin(Math.PI*Math.max(0,Math.min(1,(t-0.5)/1.1))),up=ease((t-0.2)/0.8);
  rest(o);o[2]=0.12*Math.sin(Math.PI*Math.min(1,t/0.55))+0.08*Math.sin(Math.PI*Math.max(0,Math.min(1,(t-1.6)/0.6)));
  o[3]=0.2*fly;o[20]=o[24]=0.04*fly;
  o[12]=o[16]=0.13+0.02*up;o[13]=o[17]=-0.31+0.63*up;o[14]=o[18]=0.03+0.1*Math.sin(Math.PI*up);
}

/* One joint held by two bones: from a (index ia in o) to the end e (index ie), with bone lengths l1 and l2, the joint
   between them put at index ij, off the line toward (px,py,pz). The end is expected within reach. */
function bend(o,ia,ie,ij,l1,l2,px,py,pz){
  var vx=o[ie]-o[ia],vy=o[ie+1]-o[ia+1],vz=o[ie+2]-o[ia+2],d=Math.max(1e-5,Math.sqrt(vx*vx+vy*vy+vz*vz)),k,a,h,n;
  vx/=d;vy/=d;vz/=d;
  k=px*vx+py*vy+pz*vz;px-=k*vx;py-=k*vy;pz-=k*vz;n=Math.sqrt(px*px+py*py+pz*pz);
  if(n<1e-4){px=vy;py=-vx;pz=0;n=Math.sqrt(px*px+py*py);if(n<1e-4){px=1;py=0;n=1;}}
  a=(d*d+l1*l1-l2*l2)/(2*d);h=Math.sqrt(Math.max(0,l1*l1-a*a))/n;
  o[ij]=o[ia]+vx*a+px*h;o[ij+1]=o[ia+1]+vy*a+py*h;o[ij+2]=o[ia+2]+vz*a+pz*h;
}
/* A figure's body from a pose p (js/moves.js says what its numbers are), into o as seventeen places in space, three
   numbers each (to the figure's left as it faces the viewer, up from the floor, toward the viewer): 0 neck, 1 the
   middle of the hips, 2 3 the left and right shoulder, 4 5 left elbow and hand, 6 7 right elbow and hand, 8 9 the hip
   joints, 10 11 left knee and ankle, 12 13 right knee and ankle, 14 15 the toes, 16 the head's middle. Every bone
   keeps its length: a hand asked for beyond the arm's reach is brought in along the same line; where a foot is too far
   for the leg, the hips come down to it, and a foot held higher than the leg reaches comes down. Elbows bend back,
   out and down unless the pose carries them higher; knees bend the way the hips face. Which way an elbow points can
   change very quickly for a small move of the hand (an arm folded close has its elbow almost anywhere), so a figure
   that is being followed from frame to frame hands in mem, six numbers of its own that this keeps (where each elbow
   was from its shoulder), and mk, the share of the way an elbow may swing this frame. */
export function danceBody(p,o,mem,mk){
  var hop=Math.max(0,p[3]),R=2*DN_LEG-0.002,ca=Math.cos(p[5]),sa=Math.sin(p[5]),cr=Math.cos(p[6]),sr=Math.sin(p[6]),s,h,i,dx,dz,dh,k,t,lift,
    px=p[0],py=DN_HIP-Math.max(0,Math.min(0.3,p[2]))+hop,pz=p[1],lx=ca,lz=-sa,fx=sa,fz=ca,at=p[5]+p[7],ct=Math.cos(at),stn=Math.sin(at),
    cs=Math.cos(p[8]),ss=Math.sin(p[8]),cf=Math.cos(p[9]),sf=Math.sin(p[9]),sx,sy,sz,tx,ty,tz,gx,gy,gz,hx,hy,hz,n,e,c,sn,x,z,low=0;
  /* the hips and the feet */
  for(s=0;s<2;s++){
    h=s?-1:1;i=24+3*s;
    o[i]=px+h*DN_HIPW*lx*cr;o[i+1]=py+h*DN_HIPW*sr;o[i+2]=pz+h*DN_HIPW*lz*cr;
    k=33+6*s;
    o[k]=h*(DN_STANCE+p[20+4*s]);o[k+1]=Math.max(0,p[21+4*s])+hop;o[k+2]=p[22+4*s];
    dx=o[k]-o[i];dz=o[k+2]-o[i+2];dh=Math.sqrt(dx*dx+dz*dz);
    if(dh>0.85*R){o[k]=o[i]+dx*0.85*R/dh;o[k+2]=o[i+2]+dz*0.85*R/dh;dh=0.85*R;}
    low=Math.max(low,o[i+1]-(o[k+1]+Math.sqrt(R*R-dh*dh)));
  }
  py-=low;
  for(s=0;s<2;s++){
    h=s?-1:1;i=24+3*s;k=33+6*s;o[i+1]-=low;
    dx=o[k]-o[i];dz=o[k+2]-o[i+2];
    o[k+1]=Math.min(o[k+1],o[i+1]+Math.sqrt(Math.max(0,R*R-dx*dx-dz*dz)));
    bend(o,i,k,k-3,DN_LEG,DN_LEG,fx+h*p[23+4*s]*lx,0.25,fz+h*p[23+4*s]*lz);
    if(o[k-2]<hop)bend(o,i,k,k-3,DN_LEG,DN_LEG,0.2*fx,1,0.2*fz); /* a knee that would go through the floor is bent upward instead */
    /* the foot points the way the hips face, turned outward, and its toes point down when it is off the floor */
    lift=Math.min(0.045,o[k+1]-hop);t=Math.sqrt(DN_FOOT*DN_FOOT-lift*lift);
    gx=fx+0.8*h*lx;gz=fz+0.8*h*lz;n=Math.sqrt(gx*gx+gz*gz);
    o[42+3*s]=o[k]+t*gx/n;o[43+3*s]=o[k+1]-lift;o[44+3*s]=o[k+2]+t*gz/n;
  }
  o[3]=px;o[4]=py;o[5]=pz;
  /* the back: s is the way it runs, t the chest's own left, g the way the chest faces */
  lx=ct;lz=-stn;fx=stn;fz=ct;
  sx=lx*ss*cf+fx*sf;sy=cs*cf;sz=lz*ss*cf+fz*sf;
  tx=lx*cs;ty=-ss;tz=lz*cs;
  gx=ty*sz-tz*sy;gy=tz*sx-tx*sz;gz=tx*sy-ty*sx;
  o[0]=px+DN_SPINE*sx;o[1]=py+DN_SPINE*sy;o[2]=pz+DN_SPINE*sz;
  hx=sx+tx*p[10]+gx*p[11];hy=sy+ty*p[10]+gy*p[11];hz=sz+tz*p[10]+gz*p[11];n=(DN_NECK+DN_HEAD)/Math.sqrt(hx*hx+hy*hy+hz*hz);
  o[48]=o[0]+hx*n;o[49]=o[1]+hy*n;o[50]=o[2]+hz*n;
  for(s=0;s<2;s++){
    h=s?-1:1;i=6+3*s;k=15+6*s;e=p[15+4*s];c=12+4*s;
    o[i]=o[0]+h*DN_SHO*tx;o[i+1]=o[1]+h*DN_SHO*ty;o[i+2]=o[2]+h*DN_SHO*tz;
    hx=o[0]+h*p[c]*tx+p[c+1]*sx+p[c+2]*gx-o[i];hy=o[1]+h*p[c]*ty+p[c+1]*sy+p[c+2]*gy-o[i+1];hz=o[2]+h*p[c]*tz+p[c+1]*sz+p[c+2]*gz-o[i+2];
    /* a hand asked for at the shoulder itself is put forward and out of it: an arm raised from hanging to overhead
       is asked to pass through there, and so goes up round the front as an arm does, where its elbow would
       otherwise whip round */
    n=Math.sqrt(hx*hx+hy*hy+hz*hz);if(n<DN_CLEAR){t=(1-n/DN_CLEAR)*(1-n/DN_CLEAR)*DN_CLEAR;hx+=t*(h*0.5*tx+0.87*gx);hy+=t*(h*0.5*ty+0.87*gy);hz+=t*(h*0.5*tz+0.87*gz);}
    n=Math.sqrt(hx*hx+hy*hy+hz*hz);if(n<1e-4){hx=-sx;hy=-sy;hz=-sz;n=1;}
    t=Math.max(0.03,Math.min(DN_ARM+DN_FORE-0.002,n))/n;
    o[k]=o[i]+hx*t;o[k+1]=o[i+1]+hy*t;o[k+2]=o[i+2]+hz*t;
    bend(o,i,k,k-3,DN_ARM,DN_FORE,h*0.45*tx-0.3*sx-0.75*gx+e*(1.5*sx+h*0.8*tx),h*0.45*ty-0.3*sy-0.75*gy+e*(1.5*sy+h*0.8*ty),h*0.45*tz-0.3*sz-0.75*gz+e*(1.5*sz+h*0.8*tz));
    if(mem){ /* the elbow goes only a share of the way from where it was to where the rule puts it, and the arm is bent again toward that */
      c=3*s;
      if(mem[c]===0&&mem[c+1]===0&&mem[c+2]===0){mem[c]=o[k-3]-o[i];mem[c+1]=o[k-2]-o[i+1];mem[c+2]=o[k-1]-o[i+2];}
      mem[c]+=(o[k-3]-o[i]-mem[c])*mk;mem[c+1]+=(o[k-2]-o[i+1]-mem[c+1])*mk;mem[c+2]+=(o[k-1]-o[i+2]-mem[c+2])*mk;
      bend(o,i,k,k-3,DN_ARM,DN_FORE,mem[c],mem[c+1],mem[c+2]);
      mem[c]=o[k-3]-o[i];mem[c+1]=o[k-2]-o[i+1];mem[c+2]=o[k-1]-o[i+2];
    }
  }
  /* the whole figure turned on the spot */
  c=Math.cos(p[4]);sn=Math.sin(p[4]);
  for(i=0;i<51;i+=3){x=o[i];z=o[i+2];o[i]=x*c+z*sn;o[i+2]=z*c-x*sn;}
  return o;
}
/* The body as the viewer sees it: each place across and up, a thing nearer the viewer a little larger, as seen from
   DN_EYE up. o[34] is how much larger the head is than it would be at the middle. */
export function danceFlat(b,o){
  var i,k;
  for(i=0;i<17;i++){k=1+DN_NEAR*b[3*i+2];o[2*i]=b[3*i]*k;o[2*i+1]=DN_EYE+(b[3*i+1]-DN_EYE)*k;}
  o[34]=1+DN_NEAR*b[50];
  return o;
}

/* Keeps the count of beats. Each frame it is given the seconds passed and the bass's pulse, and gives back {u, per}:
   u is the count, a whole number at each beat and running on evenly between, and per the seconds a beat lasts. A hit is
   the pulse rising well above where it had sunk to. The time between two hits, doubled or halved into DN_FAST to
   DN_SLOW, is taken as the beat's length when it agrees with what is held, or after three that do not. A hit that
   falls near a whole count pulls the count three quarters of the way to it; the pull is spread over the next frames, and the count never
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
      if(Math.abs(e)<0.3){pend=-0.75*e;off=0;}
      else if(++off>=3){pend=-e;off=0;} /* three hits in a row between the counts: the count is what is out */
    }
    c=pend*Math.min(1,dt*12);pend-=c;
    du=Math.max(0.2*dt/per,dt/per+c);u+=du;
    out.u=u;out.per=per;out.du=du;
    return out;
  };
}

/* which of the three kinds of move fits how full the music is (e, 0 to 1 and over) */
export function moveTier(e){return e<0.55?"lo":e<0.85?"mid":"hi";}
/* which move a figure takes up next: one fit for how full the music is, and not the one it has */
export function pickMove(e,not,rnd){
  var k=moveTier(e),ok=[],i;
  for(i=0;i<MOVES.length;i++)if(MOVES[i][k]&&i!==not)ok.push(i);
  return ok[Math.min(ok.length-1,Math.floor(rnd*ok.length))];
}
/* A routine: three to ten different moves fit for how full the music is, to be danced one after another and then
   again from the first, as a dancer has a few moves that go together and comes back to them. rnd gives the chance
   numbers. mir says, move by move, whether it is danced facing the other way. */
export function makeRoutine(e,rnd){
  var k=moveTier(e),ok=[],mv=[],mir=[],n=3+Math.floor(rnd()*8),i;
  for(i=0;i<MOVES.length;i++)if(MOVES[i][k])ok.push(i);
  while(mv.length<n&&ok.length){mv.push(ok.splice(Math.min(ok.length-1,Math.floor(rnd()*ok.length)),1)[0]);mir.push(rnd()<0.5);}
  return {mv:mv,mir:mir,tier:k};
}
/* how many figures an overlay has, and which of the three it is (0 for an overlay without figures) */
export function danceKind(){var o=OVERLAYS[sel.ovi];return o&&o.dance||0;}
function count(kind){return kind===1?1:kind===2?4:kind===3?5:0;}
/* how far a figure may go from where it stands, in figure heights: the dancer alone has the most room */
function room(kind){return kind===1?0.9:kind===2?0.5:0.3;}
function setUp(kind){
  var i,n=count(kind),now=Math.floor(st.u),r;
  crowd.length=0;st.kind=kind;st.phrase=0;
  for(i=0;i<n;i++){
    r=kind===2&&i?crowd[0].rt:makeRoutine(st.en,Math.random);
    crowd.push({rt:r,ri:0,mv:r.mv[0],mir:kind!==2&&r.mir[0],u0:now,pmv:0,pmir:false,pu0:now,bl:1,next:now+4+(kind===3?i:0),tx:0,p:MV_REST.slice(),b:danceBody(MV_REST,[]),mem:[0,0,0,0,0,0]});
  }
}
/* A figure goes on to its next move. Its routine is gone through twice and then a new one made; a new one is made at
   once (fresh) after a great change in the sound or a drop, and at the end of a time through if the music has become
   fuller or quieter than the routine was made for. The chorus line dances its first figure's routine, and every
   other time through, every other one faces the other way. A move that travels is faced so as to bring the figure
   back toward where it stands, and the chorus line all go the same way. */
function nextMove(d,i,now,e,fresh){
  var n,k,m;
  d.pmv=d.mv;d.pmir=d.mir;d.pu0=d.u0;d.u0=now;d.bl=0;
  if(st.kind===2&&i>0){d.rt=crowd[0].rt;d.ri=crowd[0].ri;}
  else{
    d.ri++;n=d.rt.mv.length;
    if(fresh||d.ri>=2*n||(d.ri%n===0&&moveTier(e)!==d.rt.tier)){d.rt=makeRoutine(e,Math.random);d.ri=0;}
    if(st.kind===2&&d.ri%d.rt.mv.length===0)st.phrase++;
  }
  k=d.ri%d.rt.mv.length;d.mv=d.rt.mv[k];m=MOVES[d.mv];
  d.mir=st.kind===2?!!(st.phrase%2)&&!!(i%2):d.rt.mir[k];
  if(m.go){
    if(st.kind===2&&i>0)d.mir=crowd[0].mir;
    else if(Math.abs(d.tx)>0.05)d.mir=(m.go>0)===(d.tx>0);
    else if(st.kind===2)d.mir=false;
  }
  d.next=now+Math.max(4,m.len);
}
/* One step for the figures: dt seconds, with bt the bass's pulse and mp the mids', level how full the music is (0 to 1),
   drop true in the frame a drop lands, changed true when the sound has just changed greatly, slow for less motion, and
   time the app's clock, which the standing figures breathe by. */
export function danceStep(dt,bt,mp,level,drop,changed,slow,time){
  var b=tick(dt,bt),du=b.du*(slow?0.5:1),go,amp,e,i,j,d,k,w,now,m,v,lim=room(st.kind),beat;
  st.u+=du;st.du=du;now=Math.floor(st.u);
  st.pa+=(Math.max(bt,0.6*mp)-st.pa)*Math.min(1,dt);
  st.kick+=(bt-st.kick)*Math.min(1,dt*(bt>st.kick?30:7)); /* the kick drum as the body feels it: up at once, down in a seventh of a second */
  go=ease((st.pa-0.03)/0.09);
  st.en+=(go*(0.45+0.55*level)-st.en)*Math.min(1,dt/0.8);
  st.hype*=Math.exp(-dt/10);
  if(drop){st.hype=1;if(st.jump<0)st.jump=0;}
  e=st.en*(1+0.4*st.hype);amp=ease(e/0.4)*(slow?0.6:1); /* standing or dancing, with a short way between: half a move is not a move */
  if(st.jump>=0){st.jump+=du;if(st.jump>DN_JUMP)st.jump=-1;}
  beat=0.3*(0.5+0.5*Math.cos(6.2831853*st.u))+1.7*st.kick; /* how far into the beat's give the figures are: a little by the count, mostly by the kick itself */
  for(i=0;i<crowd.length;i++){
    d=crowd[i];
    /* the next move of the routine when the one in hand has had its beats (four at least), a new routine at once after
       a great change in the sound and after a drop's jump; never while the figure is still going from the last move
       to this one, or the pose would jump. A move is begun from its own first beat. */
    if(d.bl>=1&&(now>=d.next||changed||(st.jump<0&&d.late))){nextMove(d,i,now,e,changed||d.late);d.late=false;}
    if(st.jump>=0)d.late=true;
    m=MOVES[d.mv];
    movePose(m,st.u-d.u0,A);A[2]+=moveBob(m)*beat;A[9]+=1.5*moveBob(m)*st.kick;A[11]+=4*moveBob(m)*st.kick;
    if(d.mir)flipPose(A);
    if(d.bl<1){
      movePose(MOVES[d.pmv],st.u-d.pu0,B);B[2]+=moveBob(MOVES[d.pmv])*beat;if(d.pmir)flipPose(B);
      k=ease(d.bl);w=turnTo(B[4],A[4]);for(j=0;j<MV_N;j++)A[j]=B[j]+(A[j]-B[j])*k;A[4]=B[4]+w*k;
      d.bl=Math.min(1,d.bl+du); /* a beat to go from one move to the next */
    }
    /* a move that travels carries the figure along, more slowly the nearer it is to the end of its room; standing
       still or dancing on the spot, the figure drifts back to its place too slowly to be seen sliding */
    v=moveGo(m,st.u-d.u0)*(d.mir?-1:1)*amp;
    if(v){if(v*d.tx>0)v*=Math.max(0,1-Math.abs(d.tx)/lim);d.tx+=v*du;}
    else d.tx-=d.tx*Math.min(1,dt*0.12);
    rest(B);B[2]+=0.005*Math.sin(time*1.4+i);B[0]=0.01*Math.sin(time*0.45+2*i);B[8]=0.015*Math.sin(time*0.45+2*i);
    w=turnTo(0,A[4]);for(j=0;j<MV_N;j++)A[j]=B[j]+(A[j]-B[j])*amp;A[4]=w*amp;
    if(st.jump>=0){
      jumpPose(st.jump,J);w=ease(st.jump/0.3)*(1-ease((st.jump-DN_JUMP+0.5)/0.5))*(slow?0.5:1);
      k=A[4];for(j=0;j<MV_N;j++)A[j]+=(J[j]-A[j])*w;A[4]=k*(1-w); /* the turn has been brought within half a turn of facing front, so this is the short way */
    }
    k=Math.min(1,dt*13);w=d.p[4]+turnTo(d.p[4],A[4])*k;for(j=0;j<MV_N;j++)d.p[j]+=(A[j]-d.p[j])*k;d.p[4]=w; /* the pose is gone toward, never jumped to; the turn goes the short way round */
    danceBody(d.p,d.b,d.mem,Math.min(1,dt*10));
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
  if(kind===1)o.push([0,-0.3,0.64*DN_SIZE,1]);
  else if(kind===2){sp=Math.min(0.26,2*hw*0.9/4);s=Math.min(0.56*DN_SIZE,sp*1.45);for(i=0;i<4;i++)o.push([(i-1.5)*sp,-0.28,s,1]);}
  else if(kind===3){
    sp=Math.min(0.3,2*hw*0.9/3);s=Math.min(0.54*DN_SIZE,sp*1.25);
    for(i=0;i<3;i++)o.push([(i-1)*sp,-0.31,s,1]);
    for(i=0;i<2;i++)o.push([(i-0.5)*sp,-0.31+0.42*s,0.72*s,0.7]);
  }
  return o;
}
/* Fill dnU for the shader. Returns how many figures there are; none while a loop is flown. */
export function danceFill(kind,asp){
  var sp=lapOn()||kind!==st.kind?[]:danceSpots(kind,asp),i,j,q,k;
  for(i=0;i<DN_MAX;i++){
    if(i>=sp.length||!crowd[i]){dnU[8][4*i+3]=0;continue;}
    q=sp[i];danceFlat(crowd[i].b,flat);
    k=q[0]+q[2]*crowd[i].tx;
    for(j=0;j<16;j++){dnU[j>>1][4*i+2*(j&1)]=k+q[2]*flat[2*j];dnU[j>>1][4*i+2*(j&1)+1]=q[1]+q[2]*flat[2*j+1];}
    dnU[8][4*i]=k+q[2]*flat[32];dnU[8][4*i+1]=q[1]+q[2]*flat[33];dnU[8][4*i+2]=q[2]*DN_HEAD*flat[34];dnU[8][4*i+3]=q[3];
  }
  return sp.length;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
tick=makeBeatClock();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={DN_MAX, DN_HIP, DN_SPINE, DN_HEAD, DN_NECK, DN_SHO, DN_HIPW, DN_ARM, DN_FORE, DN_CLEAR, DN_LEG, DN_FOOT, DN_STANCE, DN_NEAR, DN_EYE, DN_FAST, DN_SLOW, DN_SIZE, DN_JUMP, dnU, danceBody, danceFlat, makeBeatClock, pickMove, moveTier, makeRoutine,
  danceKind, danceStep, stepDance, danceSpots, danceFill, crowd, danceSt:st, get danceTick(){return tick},set danceTick(v){tick=v}};
