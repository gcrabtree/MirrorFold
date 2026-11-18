/* The dancers: stick figures that dance to the music, drawn by the overlays Dancer (one), Chorus line (four doing the
   same dance together) and Dance floor (a crowd, each with a dance of its own). Each figure has a manner of its own
   (DN_MANNERS: steady, lively, or smooth, which glides about the floor and spins) and a head of its own (hair or a
   hat, eyes and a mouth, which the shader draws in thin lines). They are meant to move as a person in a
   suit with lines down the limbs would: the figure is a body in space, with shoulders, hips, knees that bend forward
   and feet that point where it faces, and what is drawn is that body seen from in front, a little nearer things
   larger. This file listens for the beat and keeps a count of beats that runs on between them; a move (js/moves.js)
   is a rule from the count to a pose, and the body's joints are worked out from the pose with every limb keeping its
   length. The figures dance only to a steady beat: while the music is quiet, or there is sound without a beat (a voice
   talking, say), they stand about shifting their feet, or walk to and fro; as the music fills they choose livelier moves; when a drop
   lands they all jump. The trails pass draws the joints as lines (js/shaders.js). Nothing here flashes: a figure
   only moves, and a pose is eased to, never jumped to. Hold still stops them where they are, and they are left out
   while a loop is flown, since what they do next is chosen by chance and would not come round. */
import { clock } from "./clock.js";
import { calm } from "./dom.js";
import { lapOn } from "./lap.js";
import { soundChanged } from "./listen.js";
import { MOVES, MV_N, MV_REST, MV_STYLES, flipPose, moveBob, moveGo, movePose, moveStyle } from "./moves.js";
import { heard } from "./song.js";
import { OVERLAYS, sel } from "./state.js";
import { still } from "./still.js";

export const DN_MAX=12;      /* the most figures; the shader takes this many */
export const DN_HIP=0.52;    /* a figure is 1 tall: how high the hips are when it stands, */
export const DN_SPINE=0.3;   /* the length of the back, */
export const DN_HEAD=0.075;  /* the head's radius, */
export const DN_NECK=0.03;   /* the neck between the shoulders and the head, */
export const DN_SHO=0.1;     /* how far each shoulder is from the neck, */
export const DN_HIPW=0.05;   /* and each hip joint from the middle of the hips, */
export const DN_ARM=0.16;    /* the upper arm, */
export const DN_FORE=0.17;   /* the forearm, to the middle of the hand, */
export const DN_CLEAR=0.17;  /* a hand is kept this far from a point DN_BACK behind and inside its shoulder (see danceBody), */
export const DN_BACK=0.07;   /* so that it is never nearer the shoulder itself than the difference, */
export const DN_LEG=0.26;    /* each half of a leg, */
export const DN_FOOT=0.07;   /* the foot, from ankle to toe, */
export const DN_STANCE=0.08; /* how far each foot stands from the middle, */
export const DN_NEAR=0.45;   /* how much larger a thing looks for each figure height it is nearer the viewer, */
export const DN_EYE=0.55;    /* and the height the viewer looks from */
export const DN_FAST=0.36;   /* a beat is taken to last between this many seconds (166 a minute) */
export const DN_SLOW=0.72;   /* and this (83 a minute): a quicker or slower pulse is counted as half or double */
export const DN_SIZE=0.65;   /* how large the figures are drawn, as a part of the room danceSpots gives each */
export const DN_DEEP=0.3;    /* the floor goes away from the viewer: a figure is drawn 1/(1 + this much for each figure height it is from the front edge) as large, */
export const DN_UP=1.5;      /* and the floor is looked down on from this many figure heights, so a figure further off stands higher in the picture */
export const DN_FLOOR=4;     /* how deep the floor is that the dancer alone has, in figure heights */
export const DN_QUICK=4;     /* the fastest a hand or a foot is moved within the body, in figure heights a second */
export const DN_TOP=5;       /* the fastest an elbow or a hand is shown going from its shoulder, in figure heights a second */
export const DN_FAINT=0.06;  /* a pulse under this is taken as that much weaker than one that counts: there is nearly no sound */
export const DN_DRIFT=0.3;   /* how fast a dancing figure moves over the floor toward the place it has chosen, in figure heights a second */
export const dnU=[new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48),new Float32Array(48)]; /* for the shader, four numbers a figure in each (the tenth is its face: which way the head is turned, across and toward the viewer, how far the mouth is open and how far the eyes are shut): neck and hips; the shoulders; left elbow and hand; right elbow and hand; the hip joints; left knee and ankle; right knee and ankle; the toes; the head's middle, its radius and how brightly the figure shows (0 for none) */
const A=new Array(MV_N),B=new Array(MV_N),J=new Array(MV_N),flat=new Array(35),SP=[0,0],RM=[0,0,0,0],order=[];
const crowd=[];              /* the figures: {rt, ri, mv, mir, u0, pmv, pmir, pu0, bl, next, tx, tz, p, b, mem, fa, sp, pfa, a, im, ic, idir, iface, itf, iph, iw}: the routine and how far through it; the move, whether it is faced the other way and the beat it began on; the same for the move before, and how far the figure has gone over from it; the beat to change on; how far the figure has travelled from its place; the pose; the body; where the elbows were; which way it is turned for this move and was for the last; how much it is dancing; and for when it is not, whether it walks, the seconds until it chooses again, which way it walks, the way it faces now and wants to, how far through its steps it is and how much it is walking */
const st={lead:-1,per:0.5,pk:0.06,pm:0.06,amp:0,asp:1.78,u:0,du:0,pa:0,sure:0,kick:0,snap:0,en:0,hype:0,jump:-1,kind:0,phrase:0}; /* the strongest pulse of the bass and of the mids in the last few seconds; how much the figures are dancing, 0 to 1 (figures newly set up begin with it, so that changing from one overlay of figures to another does not stop the dance); how wide the picture is for 1 tall (danceFill says); the count of beats and this frame's step of it; how much pulse there has been lately; how sure the beat is; the kick as the figures feel it; how much they dance; how long since a drop; how far through a jump (in beats, -1 for none); which overlay they were set up for; how many times the chorus line has changed its dance */
let tick=null,bank=null;

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
    cs=Math.cos(p[8]),ss=Math.sin(p[8]),cf=Math.cos(p[9]),sf=Math.sin(p[9]),ux,uy,uz,sx,sy,sz,tx,ty,tz,gx,gy,gz,hx,hy,hz,n,e,c,sn,x,z,low=0;
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
    /* A hand asked for at the shoulder, or near it, is put forward and out of it: an arm raised from hanging to
       overhead is asked to pass through there, and so goes up round the front as an arm does. With the hand very near
       the shoulder the elbow could be almost anywhere, and would whip round as the hand went by. So the hand is
       moved straight away from a point a little behind and inside the shoulder until it is DN_CLEAR from that point:
       the one place where that has no answer is behind the shoulder blade, where no move puts a hand. */
    ux=h*0.5*tx+0.87*gx;uy=h*0.5*ty+0.87*gy;uz=h*0.5*tz+0.87*gz;
    hx+=DN_BACK*ux;hy+=DN_BACK*uy;hz+=DN_BACK*uz;n=Math.sqrt(hx*hx+hy*hy+hz*hz);
    if(n<1e-4){hx=ux;hy=uy;hz=uz;n=1;}
    t=DN_CLEAR*Math.pow(1+Math.pow(n/DN_CLEAR,6),1/6)/n;
    hx=hx*t-DN_BACK*ux;hy=hy*t-DN_BACK*uy;hz=hz*t-DN_BACK*uz;
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

/* Keeps the count of beats. Each frame it is given the seconds passed and a pulse (0 to 1) that jumps up when a sound
   begins, and gives back {u, per, du, sure}: u is the count, a whole number at each beat and running on evenly between,
   per the seconds a beat lasts, du this frame's step of the count, and sure (0 to 1) how far there is a steady beat
   at all. It does not judge hits one at a time: music has hits off the beat, hi-hats between the beats and bass
   lines that leave it, and a beat is what they all come back to. It keeps the last eight seconds of how much the pulse
   rose (DN_RATE slots a second), and five times a second looks for the beat's length, between DN_FAST and DN_SLOW,
   at which that record best lies over itself moved on by one, two, three and four beats (a quicker or slower pulse
   is so counted as half or double). How well it lies (conf, 1 for a perfect copy) is how sure the beat is: a voice
   talking has rises too, but they do not come round. Where in the beat the rises pile up says where the count
   should be whole, and the count is pulled there a part of the way each time, never backward, so a figure
   following it never jerks. After a second and a half with no rise the record is begun again, so that what is
   played next is not mixed with what was played before. With nothing to hear the count runs on as it was. */
export const DN_RATE=100;
export function makeBeatClock(){
  var L=8*DN_RATE,ring=new Float32Array(L),a=new Float32Array(L),b=new Float32Array(L),bins=new Float32Array(32),cr=new Float32Array(9),head=0,valid=0,acc=0,tacc=0,prev=0,quiet=0,due=0,
    u=0,per=0.5,pend=0,sure=0,conf=0,odd=0,got=false,out={u:0,per:0.5,du:0,sure:0,conf:0};
  function mean(q,i,j,k,l){var s=0,n=0;if(q[i]>-9){s+=q[i];n++;}if(q[j]>-9){s+=q[j];n++;}if(k&&q[k]>-9){s+=q[k];n++;}if(l&&q[l]>-9){s+=q[l];n++;}return n>=2||(n===1&&i===1)?s/n:0;}
  function look(){
    var n=valid,i,k,t,lag,m=0,e0=0,best=-1,bt2=0,s,w,c,lo=Math.round(DN_FAST*DN_RATE),hi=Math.round(DN_SLOW*DN_RATE),sc=look.sc||(look.sc=new Float32Array(hi+2)),pn,P,ph,e,tot;
    for(i=0;i<n;i++)a[i]=ring[(head-n+i+2*L)%L];
    for(i=0;i<n;i++){c=4*a[i];for(k=1;k<4;k++)c+=(4-k)*((i>=k?a[i-k]:0)+(i<n-k?a[i+k]:0));b[i]=c/16;m+=b[i];} /* a rise a few slots early or late still lies over its fellows */
    m/=n;for(i=0;i<n;i++){b[i]-=m;e0+=b[i]*b[i];}
    if(e0<1e-7){conf=0;return;}
    for(t=lo;t<=hi;t++){
      /* how well the record lies over itself moved on by 1, 2, 3, 4, 6 and 8 beats (where there is record enough) */
      for(k=1;k<=8;k++){
        lag=k*t;cr[k]=-9;if(k===5||k===7||lag>n-1.2*DN_RATE)continue;
        c=0;for(i=lag;i<n;i++)c+=b[i]*b[i-lag];
        cr[k]=c*n/((n-lag)*e0);
      }
      /* a beat hit every time lies over itself at every beat; one hit every other beat only at every second; and a
         line that only comes round with the bar at every fourth. The best of the three is the score. */
      s=mean(cr,1,2,3,4);
      s=Math.max(s,0.9*mean(cr,2,4,6,8),0.85*mean(cr,4,8,0,0));
      sc[t]=s;if(s>best){best=s;bt2=t;}
    }
    conf=Math.max(0,best)*Math.sqrt(Math.min(1,n/(4*DN_RATE))); /* a short record lies over itself by chance more easily, and is believed less */
    pn=bt2;if(bt2>lo&&bt2<hi){c=sc[bt2-1]-2*sc[bt2]+sc[bt2+1];if(c<0)pn=bt2+0.5*(sc[bt2-1]-sc[bt2+1])/c;}
    pn/=DN_RATE;
    if(conf>0.2){
      if(!got||Math.abs(pn-per)<0.06*per){per+=(pn-per)*(got?0.3:1);got=true;odd=0;}
      else if(++odd>=4){per=pn;odd=0;} /* four looks running that say another length: the music has changed speed */
    }
    /* where in the beat the rises are: the last four seconds, the latest counting most */
    P=per*DN_RATE;for(k=0;k<32;k++)bins[k]=0;tot=0;
    for(i=Math.max(0,n-4*DN_RATE);i<n;i++)if(a[i]>0){ph=((n-1-i)/P)%1;k=Math.floor(ph*32);w=a[i]*(0.4+0.6*(i-(n-4*DN_RATE))/(4*DN_RATE));bins[k]+=w;bins[(k+1)%32]+=0.5*w;bins[(k+31)%32]+=0.5*w;tot+=w;}
    if(tot>0&&conf>0.2){
      k=0;for(i=1;i<32;i++)if(bins[i]>bins[k])k=i;
      ph=(k+0.5)/32; /* this much of a beat ago, a beat began */
      e=u+pend-ph;e-=Math.round(e); /* how far the count is from being whole when a beat begins */
      pend-=(sure<0.3?1:0.35)*e;
    }
  }
  return function(dt,p){
    var rise=Math.max(0,p-prev),c,du,tg;prev=p;
    if(rise>0.08)quiet=0;else quiet+=dt;
    acc=Math.max(acc,rise);tacc+=dt;
    while(tacc>=1/DN_RATE){tacc-=1/DN_RATE;ring[head]=acc;acc=0;head=(head+1)%L;if(valid<L)valid++;}
    if(quiet>=1.5){valid=0;conf=0;got=got&&sure>0.5;} /* nothing to hear: what comes next is looked at by itself */
    due-=dt;
    if(due<=0){
      due=0.2;
      if(valid>=1.6*DN_RATE)look();
      tg=Math.max(0,Math.min(1,(conf-DN_SURE0)/(DN_SURE1-DN_SURE0)));
      sure+=(tg-sure)*(tg>sure?0.45:quiet>=1.5?0.5:0.15); /* quick to be sure, slow to doubt, quick again when the sound has gone */
    }
    c=pend*Math.min(1,dt*8);pend-=c;
    du=Math.max(0.2*dt/per,dt/per+c);u+=du;
    out.u=u;out.per=per;out.du=du;out.sure=sure;out.conf=conf;
    return out;
  };
}
/* Four of those clocks, one for each part of the spectrum that listen.js's onsets gives, and one count of beats kept
   by whichever is surest. In much dance music the bass rolls on and the beat is in the hi-hats; in other music it is
   the other way about; so no one part can be relied on. Each frame it is given the seconds passed and the four
   onsets, and gives back {u, per, du, sure, lead, hit}: as a clock does, with which part leads (0 low to 3 high) and
   hit, that part's onset measured against its strongest of the last few seconds (0 to 1). Each part is measured so
   against itself, so it does not matter how loud it is. The lead changes when another part has lain better over
   itself for most of a second, or at once if the lead has lost the beat and another has it; the count then goes
   over to the new lead's a little each frame, never backward. */
export function makeBeatBank(){
  var ck=[makeBeatClock(),makeBeatClock(),makeBeatClock(),makeBeatClock()],pk=[DN_FAINT2,DN_FAINT2,DN_FAINT2,DN_FAINT2],r=[null,null,null,null],lead=0,hold=0,u=0,
    out={u:0,per:0.5,du:0,sure:0,conf:0,lead:0,hit:0};
  return function(dt,on){
    var k,best=0,e,du,L;
    for(k=0;k<4;k++){pk[k]=Math.max(DN_FAINT2,pk[k]*Math.exp(-dt/2.5),on[k]||0);r[k]=ck[k](dt,(on[k]||0)/pk[k]);if(r[k].conf>r[best].conf)best=k;}
    if(best!==lead&&(r[best].conf>r[lead].conf+0.08||(r[lead].sure<0.4&&r[best].sure>0.7))){hold+=dt;if(hold>0.8||(r[lead].sure<0.4&&r[best].sure>0.7)){lead=best;hold=0;}}else hold=0;
    L=r[lead];e=u-L.u;e-=Math.round(e);
    du=Math.max(0.2*dt/L.per,L.du-e*Math.min(1,dt*2.5));u+=du;
    out.u=u;out.per=L.per;out.du=du;out.sure=L.sure;out.conf=L.conf;out.lead=lead;out.hit=(on[lead]||0)/pk[lead];
    return out;
  };
}
export const DN_FAINT2=0.004; /* an onset under this is taken as that much weaker than one that counts: there is nearly no sound */
export const DN_SURE0=0.22;  /* how well the record of rises must lie over itself, a beat on, before there is any beat to speak of, */
export const DN_SURE1=0.4;   /* and for the beat to be wholly sure */

/* A figure's own manner, which it keeps for as long as it is on the floor. en: how full it takes the music to be (a
   lively one chooses livelier moves for the same music, a smooth one calmer); g how widely it sways; as how hard its
   arms hit; bob how much its knees and head give to the beat; drift how fast it moves over the floor; glide whether
   it keeps moving on, to a new place as soon as it reaches one, and turns all the while; flow how far its hands
   wander in slow sweeps; ease how quickly its pose follows the move (a smooth figure rounds every corner). The
   chorus line all have the steady manner, since they dance as one. */
export const DN_MANNERS=[
 {name:"steady",en:1,g:1,as:1,bob:1,drift:1,glide:0,flow:1,ease:13},
 {name:"lively",en:1.4,g:1.25,as:1.3,bob:1.45,drift:1.2,glide:0,flow:1,ease:16},
 {name:"smooth",en:0.72,g:0.85,as:0.55,bob:0.4,drift:2.2,glide:1,flow:4,ease:8}];
export const DN_LOOKS=8;     /* how many kinds of head there are (the shader draws them: headphones, spikes, long hair, a top hat, a cap, a bun, a round mass of curls, a crest) */

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
   numbers. mir says, move by move, whether it is danced facing the other way. style keeps it to one kind of dancing
   (a name in MV_STYLES; anything else is every kind); a kind with fewer than three moves fit for the music gives all
   of its moves. */
export function makeRoutine(e,rnd,style){
  var k=moveTier(e),ok=[],mv=[],mir=[],n=3+Math.floor(rnd()*8),i,st2=MV_STYLES[style]?style:"";
  for(i=0;i<MOVES.length;i++)if(MOVES[i][k]&&(!st2||moveStyle(MOVES[i])===st2))ok.push(i);
  if(ok.length<3){ok=[];for(i=0;i<MOVES.length;i++)if(moveStyle(MOVES[i])===st2)ok.push(i);}
  while(mv.length<n&&ok.length){mv.push(ok.splice(Math.min(ok.length-1,Math.floor(rnd()*ok.length)),1)[0]);mir.push(rnd()<0.5);}
  return {mv:mv,mir:mir,tier:k,style:st2};
}
/* The kind of dancing the figures keep to: a name in MV_STYLES, or "any". Changing it gives every figure a new routine
   at its next move. */
export let danceStyle="any";
export function setDanceStyle(s){
  s=MV_STYLES[s]?s:"any";if(s===danceStyle)return;
  danceStyle=s;for(var i=0;i<crowd.length;i++)crowd[i].fresh=true;
}
/* How a figure carries a move, chosen anew for each move so that no two times through are alike: how widely it sways,
   where in the beat its sway is, which of three ways its feet keep moving, how hard its arms hit, and where on the
   floor it moves to (spot), and how it faces: a dancer is not on a stage, so it starts each move turned a little
   from where the last left it, and through two moves in three it turns slowly on the spot as its feet move, one way
   or the other (d.sp, radians a beat), so that over a minute it is seen from every side. A move that travels (m.go)
   comes round, at 1.2 radians a beat, to face as the move itself says, since the way it goes depends on that. */
function carry(d,m){
  var w=turnTo(0,d.fa),r=Math.random();
  d.g=(0.75+0.5*Math.random())*d.ch.g;d.ph=Math.random();d.gp=Math.floor(3*Math.random());d.as=(0.7+0.6*Math.random())*d.ch.as;
  spot(d,front(st.kind,st.asp),false,SP);d.wx=SP[0];d.wz=SP[1];
  d.go=!!(m&&m.go);
  if(d.go){d.fa=w;d.sp=0;} /* it comes round to face as the move says, in danceStep */
  else{
    d.fa=w+(Math.random()-0.5)*0.8;
    d.sp=(Math.abs(w)>1.9?(w>0?1:-1):Math.random()<0.5?-1:1)*(Math.abs(w)>1.9?0.2+0.15*Math.random():r<0.35?0:0.08+0.22*Math.random()); /* with its back to the viewer it keeps turning, so as not to stay so */
    if(d.ch.glide){if(Math.random()<0.15)d.sd=-d.sd;d.sp=d.sd*(0.3+0.3*Math.random());} /* a smooth figure spins on through every move, the same way for most of them */
  }
}
/* What a dancer's body does whatever the move: laid over the move's pose o at beat u for figure d. The hips sway from
   side to side over two beats and turn a little with it, the shoulders against them; the weight goes from foot to
   foot, and the foot it has left lifts at the heel, steps or shuffles (the more, the less the move itself does with
   the feet); the head tips with the sway; the arms push out along their own line on the kick and flick on the mids
   (snap); and small slow wanderings in the hands and the back keep one time through a move from being the same as
   the last. */
function groove(o,u,d,kick,snap){
  var g=d.g,s1=Math.sin(6.2831853*(u/2+d.ph)),c1=Math.cos(6.2831853*(u/2+d.ph)),s2=Math.sin(6.2831853*(u/2+d.ph+0.25)),q=Math.sin(6.2831853*(u+d.ph)),
    ws=Math.max(0.35,1-Math.abs(o[0])/0.08),wf=Math.max(0,1-(Math.abs(o[20])+Math.abs(o[21])+Math.abs(o[22])+Math.abs(o[24])+Math.abs(o[25])+Math.abs(o[26]))/0.12),
    up=Math.max(0,s1),dn=Math.max(0,-s1),bump=Math.pow(1-Math.abs(s1),3),s,c,vx,vy,vz,n,a;
  o[0]+=0.04*g*ws*s1;o[6]+=0.11*g*ws*s1;o[8]-=0.05*g*ws*s1;o[10]+=0.09*g*Math.sin(6.2831853*(u/2+d.ph+0.08));
  o[5]+=0.13*g*s2;o[7]+=-0.16*g*s2+0.07*g*q;
  /* the feet */
  if(d.gp===0){o[25]+=0.03*wf*up;o[27]-=0.3*wf*up;o[21]+=0.03*wf*dn;o[23]-=0.3*wf*dn;} /* weight to the left: the right heel lifts and its knee comes in; and the other way */
  else if(d.gp===1){o[20]+=0.05*wf*up;o[24]-=0.04*wf*up;o[24]+=0.05*wf*dn;o[20]-=0.04*wf*dn;if(c1>0)o[25]+=0.035*wf*bump;else o[21]+=0.035*wf*bump;} /* a small step to the side and the other foot brought to it */
  else{o[22]+=0.05*wf*s2;o[26]-=0.05*wf*s2;a=Math.pow(1-Math.abs(s2),3);if(c1>0)o[21]+=0.03*wf*a;else o[25]+=0.03*wf*a;} /* a shuffle: one foot forward as the other goes back */
  /* the arms */
  for(s=0;s<2;s++){
    c=12+4*s;vx=o[c]-DN_SHO;vy=o[c+1];vz=o[c+2];n=Math.max(0.05,Math.sqrt(vx*vx+vy*vy+vz*vz));
    a=d.as*(0.06*kick+0.035*snap*((s?-q:q)>0?1:0.3));
    o[c]+=a*vx/n;o[c+1]+=a*vy/n+0.02*d.as*kick;o[c+2]+=a*vz/n+0.02*d.as*kick;o[c+3]+=0.35*d.as*kick;
    o[c]+=0.012*d.ch.flow*Math.sin(6.2831853*(u/(d.ch.glide?4:3)+d.ph+0.37*s));o[c+1]+=0.014*d.ch.flow*Math.sin(6.2831853*(u/(d.ch.glide?8:5)+2*d.ph+0.21*s));
  }
  o[9]+=0.025*Math.sin(6.2831853*(u/6+d.ph));
}
/* which of the three overlays of figures is chosen (0 for an overlay without figures) */
export function danceKind(){var o=OVERLAYS[sel.ovi];return o&&o.dance||0;}
/* The floor. Places on it are in figure heights: across from the middle, and away from the viewer from the front
   edge, where a figure is drawn its full size. front gives, for an overlay kind on a picture asp wide for 1 tall:
   [the size of a figure at the front edge, where the front edge is up the picture, half the picture's width, and for
   the chorus line how far apart they stand], in units of the picture's shorter side. */
function front(kind,asp){
  var hw=0.5*Math.max(1,asp),sp;
  if(kind===2){sp=Math.min(0.26,2*hw*0.9/4);return [Math.min(0.56*DN_SIZE,sp*1.45),-0.28,hw,sp];}
  return kind===3?[0.54*DN_SIZE,-0.31,hw,0]:[0.64*DN_SIZE,-0.3,hw,0];
}
/* how far to either side of the middle a figure z from the front edge can be and still be in the picture */
function span(F,z){return Math.max(0.2,F[2]*(1+DN_DEEP*z)/F[0]-0.4);}
/* where a figure's own place is, across (its depth is d.hz): the chorus line's are evenly along the front; the
   others' are a share d.hf of the way to the picture's side, or to d.hc if that is less */
function homeX(d,F){return st.kind===2?d.hf*1.5*F[3]/F[0]:d.hf*Math.min(d.hc,span(F,d.hz));}
/* How far a figure may be from its own place, into o as [least across, most across, least deep, most deep]. The dancer
   alone has the whole floor; the chorus line keeps its row; one of the crowd keeps near its place while it dances
   and may go further (wide) while there is no beat. */
function bounds(d,F,wide,o){
  var s;
  if(st.kind===1){s=span(F,d.tz);o[0]=-s;o[1]=s;o[2]=0;o[3]=DN_FLOOR;}
  else if(st.kind===2){o[0]=-0.5;o[1]=0.5;o[2]=o[3]=0;}
  else{s=wide?0.7:0.4;o[0]=-s;o[1]=s;s=wide?0.5:0.3;o[2]=Math.max(-s,-d.hz);o[3]=s;}
  return o;
}
/* a place for a figure to go to, chosen by chance from where it may be: into o as [across, deep] */
function spot(d,F,wide,o){
  var s;
  if(st.kind===1){o[1]=DN_FLOOR*Math.pow(Math.random(),1.6);o[0]=(2*Math.random()-1)*0.9*span(F,o[1]);}
  else if(st.kind===2){o[0]=(Math.random()-0.5)*0.3;o[1]=0;}
  else{s=wide?0.7:0.4;o[0]=(2*Math.random()-1)*s;s=wide?0.5:0.3;o[1]=Math.max(-d.hz,(2*Math.random()-1)*s);}
  return o;
}
export const DN_STEP=0.2;    /* how long a walking step is, in figure heights, */
export const DN_WALK=0.3;    /* how fast a figure walks, in figure heights a second, */
export const DN_TURN=3;      /* and how fast one that is not dancing turns round, in radians a second */
/* Standing and waiting, laid over the pose o by the share w: the weight goes slowly from one foot to the other, the
   head looks about, and every few seconds a foot is lifted and put down again. t is the app's clock, i which figure. */
function waitPose(t,i,w,o){
  var s=Math.sin(t*0.8+2*i),c=t*0.4+0.37*i,f=c-Math.floor(c),k=20+4*(Math.floor(c)&1),a=f<0.3?Math.sin(Math.PI*f/0.3):0;
  o[0]+=w*0.022*s;o[6]+=w*0.05*s;o[8]-=w*0.02*s;o[2]+=w*0.005*Math.sin(t*1.4+i);
  o[10]+=w*0.06*Math.sin(t*0.31+1.7*i);o[11]+=w*0.05*Math.sin(t*0.23+i);
  o[k]+=w*0.02*a;o[k+1]+=w*0.03*a;o[k+2]+=w*0.03*a*Math.sin(t*0.4+i);
  o[14]+=w*0.02*s;o[18]-=w*0.02*s;
}
/* Walking, laid over the pose o by the share w, ph of the way through two steps: a foot on the floor goes back under
   the body exactly as fast as the body goes forward (a step of DN_STEP), so it does not slide, then is lifted and
   swung to the front; the arms swing against the legs. */
function walkPose(ph,w,o){
  var s,f,k,q,c=Math.cos(6.2831853*ph);
  for(s=0;s<2;s++){
    f=ph+0.5*s;f-=Math.floor(f);k=20+4*s;
    if(f<0.5)o[k+2]+=w*DN_STEP*(0.5-2*f);
    else{q=2*f-1;o[k+2]-=w*DN_STEP*0.5*Math.cos(Math.PI*q);o[k+1]+=w*0.05*Math.sin(Math.PI*q);}
  }
  o[14]-=w*0.09*c;o[18]+=w*0.09*c;o[13]+=w*0.02*Math.abs(c);o[17]+=w*0.02*Math.abs(c);
  o[2]+=w*0.006*(1-Math.cos(12.5663706*ph));o[9]+=w*0.04;o[7]+=w*0.12*c;
}
/* What a figure does while there is no beat: it stands and waits, facing whichever way it likes, or walks to another
   place on the floor facing the way it goes, and waits there. A figure that the beat finds outside the room it
   dances in (far) walks back first, quickly. It turns at DN_TURN at most, and walks only as far as it faces the way
   it is going. The pose goes into o; d.tx and d.tz are moved on. F is the floor's front. */
function idle(d,i,dt,time,far,o,F){
  var want,e,v,dx,dz,n;
  d.ic-=dt;
  if(far){d.im=1;d.ix=d.wx;d.iz=d.wz;d.ic=1;}
  else if(d.ic<=0){
    d.im=st.kind!==2&&Math.random()<0.45?1:0;d.ic=d.im?9:3+6*Math.random();
    if(d.im){spot(d,F,true,SP);d.ix=SP[0];d.iz=SP[1];}else d.itf=(Math.random()-0.5)*4.4;
  }
  dx=d.ix-d.tx;dz=d.iz-d.tz;n=Math.sqrt(dx*dx+dz*dz);
  if(d.im&&n<0.06){d.im=0;d.ic=3+6*Math.random();d.itf=d.iface+(Math.random()-0.5)*2;}
  want=d.im?Math.atan2(dx,-dz):d.itf;e=turnTo(d.iface,want);
  d.iface+=Math.max(-DN_TURN*dt,Math.min(DN_TURN*dt,e));
  d.iw+=((d.im?1:0)-d.iw)*Math.min(1,dt*3);
  v=DN_WALK*(far?1.8:1)*d.iw*Math.max(0,Math.cos(e))*Math.min(1,n/0.15)*(1-d.a);
  d.iph+=v*dt/(2*DN_STEP);d.tx+=v*dt*Math.sin(d.iface);d.tz-=v*dt*Math.cos(d.iface);
  rest(o);waitPose(time,i,1-d.iw,o);walkPose(d.iph,d.iw,o);o[4]=d.iface;
}
/* How many figures an overlay has: one, four, or a crowd of eight to twelve, chosen each time it is set up. */
function count(kind){return kind===1?1:kind===2?4:kind===3?8+Math.floor(5*Math.random()):0;}
/* The figures' own places for n of an overlay kind, as [d.hf, d.hz, d.hc] each (see homeX). The crowd stands in three
   rows going away from the viewer, more to a row the further off, a quarter of them in front and a third in the middle. */
function homes(kind,n){
  var o=[],i,r,c,j,rows;
  if(kind===1)o.push([0,0,0]);
  else if(kind===2)for(i=0;i<n;i++)o.push([(i-1.5)/1.5,0,0]);
  else if(kind===3){
    rows=[Math.floor(n/4),Math.floor(n/3)];rows.push(n-rows[0]-rows[1]);
    for(r=0;r<3;r++){c=rows[r];for(j=0;j<c;j++)o.push([c>1?2*j/(c-1)-1:0,0.3+1.2*r,0.65*Math.max(1,c-1)]);}
  }
  return o;
}
function setUp(kind){
  var i,n=count(kind),now=Math.floor(st.u),r,h=homes(kind,n),d,c0=Math.floor(3*Math.random()),l0=Math.floor(DN_LOOKS*Math.random()),ch;
  crowd.length=0;st.kind=kind;st.phrase=0;
  for(i=0;i<n;i++){
    ch=DN_MANNERS[kind===2?0:(i+c0)%3]; /* a third of a crowd each way, and the dancer alone any of the three */
    r=kind===2&&i?crowd[0].rt:makeRoutine(st.en*ch.en,Math.random,danceStyle);
    d={ch:ch,sd:Math.random()<0.5?-1:1,mo:0,bk:0,rel:[0,0,0,0,0,0,0,0,0,0,0,0],dw:0,go:false,a:st.amp,g:1,ph:0,gp:0,as:1,wx:0,wz:0,vx:0,vz:0,fa:kind===2?0:(Math.random()-0.5)*1.6,sp:0,pfa:0,im:0,ic:3*Math.random(),ix:0,iz:0,iface:0,itf:(Math.random()-0.5)*3,iph:0,iw:0,
      hf:h[i][0],hz:h[i][1],hc:h[i][2],id:(3*i+l0)%DN_LOOKS+DN_LOOKS*i, /* its number says which head it has (what is left over on dividing by DN_LOOKS: neighbours differ) and gives it a colour of its own */
      rt:r,ri:0,mv:r.mv[0],mir:kind!==2&&r.mir[0],u0:now,pmv:0,pmir:false,pu0:now,bl:1,next:now+4+(kind===3?i%5:0),tx:0,tz:0,p:MV_REST.slice(),b:danceBody(MV_REST,[]),mem:[0,0,0,0,0,0]};
    if(kind===3){d.hf+=(Math.random()-0.5)*0.25;d.hz+=(Math.random()-0.5)*0.5;} /* a crowd does not stand in ranks */
    crowd.push(d);
  }
}
/* A figure goes on to its next move. Its routine is gone through twice and then a new one made; a new one is made at
   once (fresh) after a great change in the sound or a drop, and at the end of a time through if the music has become
   fuller or quieter than the routine was made for. The chorus line dances its first figure's routine, and every
   other time through, every other one faces the other way. A move that travels is faced so as to bring the figure
   back toward where it stands, and the chorus line all go the same way. */
function nextMove(d,i,now,e,fresh){
  var n,k,m;
  d.pmv=d.mv;d.pmir=d.mir;d.pu0=d.u0;d.u0=now;d.bl=0;d.pfa=d.fa;
  if(st.kind===2&&i>0){d.rt=crowd[0].rt;d.ri=crowd[0].ri;}
  else{
    d.ri++;n=d.rt.mv.length;
    if(fresh||d.ri>=2*n||(d.ri%n===0&&moveTier(e*d.ch.en)!==d.rt.tier)){d.rt=makeRoutine(e*d.ch.en,Math.random,danceStyle);d.ri=0;}
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
  if(st.kind===2&&i>0){k=crowd[0];d.g=k.g;d.ph=k.ph;d.gp=k.gp;d.as=k.as;d.wx=k.wx;d.wz=k.wz;d.fa=k.fa;d.sp=k.sp;d.go=k.go;}else carry(d,m); /* the chorus line carries a move as its first figure does */
}
/* One step for the figures: dt seconds, with bt the bass's pulse and mp the mids', level how full the music is (0 to 1),
   drop true in the frame a drop lands, changed true when the sound has just changed greatly, slow for less motion, and
   time the app's clock, which the standing figures breathe by. real is the seconds that really passed, where dt has
   been cut short (a frame's time is held to a twentieth of a second for everything that eases): the count of beats
   is kept by real, or with slow frames it would fall behind the music and every hit would seem off the beat. on is
   listen.js's four onsets; given them, the count is kept by the four clocks of makeBeatBank, and without them (the
   tests, mostly) by one clock that hears bt. */
export function danceStep(dt,bt,mp,level,drop,changed,slow,time,real,on){
  dt=Math.max(0,Math.min(0.1,dt||0));bt=Math.max(0,Math.min(1.5,bt||0));mp=Math.max(0,Math.min(1.5,mp||0)); /* a pulse is 0 to 1 and time goes forward; whatever is handed in, the figures are not thrown about by it (a frame's time has been seen below zero in the test harness, and every easing here would then run away) */
  real=Math.max(dt,Math.min(1.5,real||0));
  /* How strong a pulse is depends on how loud the loudest thing lately was: the app measures each band against its
     own greatest level, which sinks only over tens of seconds, so after one loud moment, or with a quieter track put
     on in place of a louder, the same kick drum is a pulse several times smaller. The figures must not stop for
     that. Each pulse is measured here against the strongest of the last few seconds (st.pk, st.pm, never less than
     DN_FAINT), and that is what the count of beats hears and what says there is sound at all. */
  st.pk=Math.max(DN_FAINT,st.pk*Math.exp(-real/2.5),bt);st.pm=Math.max(DN_FAINT,st.pm*Math.exp(-real/2.5),mp);
  var bn=bt/st.pk,mn=mp/st.pm,b=on?bank(real,on):tick(real,bn),hit=on?b.hit:0,du=b.du*(slow?0.5:1),go,amp,e,i,j,d,k,w,now,m,v,beat,far,F=front(st.kind,st.asp),dx,dz,n;
  st.u+=du;st.du=du;now=Math.floor(st.u);
  st.lead=on?b.lead:-1;
  st.pa+=(Math.max(bn,0.6*mn,hit)-st.pa)*Math.min(1,dt);
  bt=Math.max(bt,0.5*bn,0.7*hit);mp=Math.max(mp,0.5*mn); /* with no kick drum to speak of, the body gives to whatever is keeping the beat */
  /* the body gives to a kick by how hard it is, but to a faint one at least half as much as to the hardest */
  st.kick+=(bt-st.kick)*Math.min(1,dt*(bt>st.kick?30:7)); /* the kick drum as the body feels it: up at once, down in a seventh of a second */
  st.sure=b.sure;st.per=b.per;
  go=ease((st.pa-0.03)/0.09)*ease((b.sure-0.7)/0.25); /* there must be sound, and a steady beat in it */
  st.en+=(go*(0.45+0.55*level)-st.en)*Math.min(1,dt/0.8);
  st.hype*=Math.exp(-dt/10);
  if(drop){st.hype=1;if(st.jump<0)st.jump=0;}
  e=st.en*(1+0.4*st.hype);amp=st.amp=ease(e/0.4)*(slow?0.6:1); /* standing or dancing, with a short way between: half a move is not a move */
  if(st.jump>=0){st.jump+=du;if(st.jump>DN_JUMP)st.jump=-1;}
  st.snap+=(mp-st.snap)*Math.min(1,dt*(mp>st.snap?30:9)); /* and the mids, which the arms flick to */
  beat=0.3*(0.5+0.5*Math.cos(6.2831853*st.u))+2.4*st.kick; /* how far into the beat's give the figures are: a little by the count, mostly by the kick itself */
  for(i=0;i<crowd.length;i++){
    d=crowd[i];
    /* the next move of the routine when the one in hand has had its beats (four at least), a new routine at once after
       a great change in the sound and after a drop's jump; never while the figure is still going from the last move
       to this one, or the pose would jump. A move is begun from its own first beat. */
    if(d.bl>=1&&(now>=d.next||changed||(st.jump<0&&d.late))){nextMove(d,i,now,e,changed||d.late||d.fresh||(st.kind===2&&crowd[0].rt!==d.rt&&i>0));d.late=false;d.fresh=false;}
    if(st.jump>=0)d.late=true;
    m=MOVES[d.mv];
    movePose(m,st.u-d.u0,A);A[2]+=moveBob(m)*beat*d.ch.bob;A[9]+=1.5*moveBob(m)*st.kick*d.ch.bob;A[11]+=6*moveBob(m)*st.kick*d.ch.bob;
    if(d.mir)flipPose(A);
    if(st.kind===2&&i>0)d.fa=crowd[0].fa;else if(d.go)d.fa-=Math.max(-1.2*du,Math.min(1.2*du,d.fa));else d.fa+=d.sp*du*d.a;
    A[4]+=d.fa;
    groove(A,st.u,d,st.kick,st.snap);
    if(d.bl<1){
      movePose(MOVES[d.pmv],st.u-d.pu0,B);B[2]+=moveBob(MOVES[d.pmv])*beat*d.ch.bob;if(d.pmir)flipPose(B);B[4]+=d.pfa;
      k=ease(d.bl);w=turnTo(B[4],A[4]);for(j=0;j<MV_N;j++)A[j]=B[j]+(A[j]-B[j])*k;A[4]=B[4]+w*k;
      d.bl=Math.min(1,d.bl+du); /* a beat to go from one move to the next */
    }
    /* how much this figure dances (d.a) follows how much they all do, but one that has walked out of the room it
       dances in comes back first. A move that travels carries the figure along, more slowly the nearer it is to the
       end of its room; otherwise it moves over the floor at DN_DRIFT at most toward the place it chose for this
       move, and turns slowly as it chose. With no beat it waits or walks about (idle), and the pose is between the
       two by d.a. */
    bounds(d,F,false,RM);
    far=amp>0.5&&(d.tx<RM[0]-0.05||d.tx>RM[1]+0.05||d.tz<RM[2]-0.05||d.tz>RM[3]+0.05);
    d.a+=((far?0:amp)-d.a)*Math.min(1,dt*2.5);
    v=moveGo(m,st.u-d.u0)*(d.mir?-1:1)*d.a;k=Math.min(1,dt*2);
    if(v){w=v>0?RM[1]-d.tx:d.tx-RM[0];v*=Math.max(0,Math.min(1,w/Math.max(0.3,0.5*(RM[1]-RM[0]))));d.tx+=v*du;d.vx-=d.vx*k;d.vz-=d.vz*k;}
    else{
      dx=d.wx-d.tx;dz=d.wz-d.tz;n=Math.sqrt(dx*dx+dz*dz);
      if(d.ch.glide&&n<0.08&&st.kind!==2){spot(d,F,false,SP);d.wx=SP[0];d.wz=SP[1];dx=d.wx-d.tx;dz=d.wz-d.tz;n=Math.sqrt(dx*dx+dz*dz);} /* a smooth figure does not stop where it was going: it glides on to another place */
      w=n>1e-4?Math.min(DN_DRIFT*d.ch.drift,1.2*n)/n:0;d.vx+=(dx*w-d.vx)*k;d.vz+=(dz*w-d.vz)*k;
    }
    d.tx+=d.vx*dt*d.a;d.tz+=d.vz*dt*d.a;
    idle(d,i,dt,time,far,B,F);
    /* the way it faces goes over with the rest. A figure about to dance begins facing as it stood, and one that has
       been dancing stands facing as it danced; between, the turn from one to the other is kept going the way it
       was going (d.dw), since the short way round can change sides from one frame to the next */
    if(d.a<0.02){w=d.go||st.kind===2?0:turnTo(A[4],B[4]);d.fa+=w;d.pfa+=w;d.dw=turnTo(B[4],A[4]+w);}
    else if(d.a>0.98){d.iface=d.itf=B[4]=A[4];d.dw=0;}
    else d.dw+=turnTo(d.dw,A[4]-B[4]);
    w=d.dw;for(j=0;j<MV_N;j++)A[j]=B[j]+(A[j]-B[j])*d.a;A[4]=B[4]+w*d.a;
    if(st.jump>=0){
      jumpPose(st.jump,J);w=ease(st.jump/0.3)*(1-ease((st.jump-DN_JUMP+0.5)/0.5))*(slow?0.5:1);
      k=A[4];for(j=0;j<MV_N;j++)A[j]+=(J[j]-A[j])*w;A[4]=k; /* the jump is made facing whichever way the figure was */
    }
    k=Math.min(1,dt*(d.ch.ease+(13-d.ch.ease)*(1-d.a)));w=d.p[4]+turnTo(d.p[4],A[4])*k; /* each follows the move at its own manner's pace while it dances */
    for(j=12;j<28;j+=4){ /* a hand or a foot goes no faster than DN_QUICK, however far off it is asked for */
      dx=A[j]-d.p[j];dz=A[j+1]-d.p[j+1];v=A[j+2]-d.p[j+2];n=Math.sqrt(dx*dx+dz*dz+v*v)*k;
      if(n>DN_QUICK*dt){n=DN_QUICK*dt/n;A[j]=d.p[j]+dx*n;A[j+1]=d.p[j+1]+dz*n;A[j+2]=d.p[j+2]+v*n;}
    }
    for(j=0;j<MV_N;j++)d.p[j]+=(A[j]-d.p[j])*k;d.p[4]=w; /* the pose is gone toward, never jumped to; the turn goes the short way round */
    danceBody(d.p,d.b,d.mem,Math.min(1,dt*10));
    /* Last, an elbow or a hand is shown going no faster from its shoulder than DN_TOP. Where a hand passes close by
       its shoulder the elbow has to swing a long way round in a frame or two to keep both bones their length; shown
       so it is a flick. For those few frames the arm is drawn a little short or long instead, which is not seen. */
    for(j=0;j<4;j++){
      k=12+3*j;w=6+3*(j>>1);dx=d.b[k]-d.b[w]-d.rel[3*j];dz=d.b[k+1]-d.b[w+1]-d.rel[3*j+1];v=d.b[k+2]-d.b[w+2]-d.rel[3*j+2];n=Math.sqrt(dx*dx+dz*dz+v*v);
      if(d.rel.on&&n>DN_TOP*dt){n=DN_TOP*dt/n;d.b[k]=d.b[w]+d.rel[3*j]+dx*n;d.b[k+1]=d.b[w+1]+d.rel[3*j+1]+dz*n;d.b[k+2]=d.b[w+2]+d.rel[3*j+2]+v*n;}
      d.rel[3*j]=d.b[k]-d.b[w];d.rel[3*j+1]=d.b[k+1]-d.b[w+1];d.rel[3*j+2]=d.b[k+2]-d.b[w+2];
    }
    d.rel.on=true;
    /* the face: the mouth opens with the kick, the more the livelier the figure, and the eyes shut for a moment every few seconds */
    w=Math.min(1,st.kick*1.6)*d.a*Math.min(1,0.25+0.6*d.ch.bob);d.mo+=(w-d.mo)*Math.min(1,dt*(w>d.mo?20:6));
    w=time*0.21+0.37*d.id;w=w-Math.floor(w)<0.035?1:0;d.bk+=(w-d.bk)*Math.min(1,dt*25);
  }
}
/* For Stats: what the figures hear and what they are doing about it, in a line, or "" with no figures chosen. */
export function danceSays(){
  if(!st.kind)return "";
  return "dancers: "+Math.round(100*st.amp)+"% dancing, beat "+Math.round(100*st.sure)+"% sure at "+Math.round(60/Math.max(0.1,st.per))+" a minute"+(st.lead<0?"":" by the "+["low","middle","high","top"][st.lead]+" of the sound")+", sound "+Math.round(100*Math.min(1,st.pa/0.12))+"%, bass pulse "+st.pk.toFixed(2);
}
/* A step of the frame: the count of beats is kept whatever is chosen, so that figures chosen later are in time at once. */
export function stepDance(fr){
  var kind=danceKind(),react=calm?0.25:1;
  if(still||lapOn())return;
  if(kind!==st.kind)setUp(kind);
  danceStep(fr.dt,fr.bt/react,fr.mp/react,heard.live?heard.level:0.6,heard.drop,soundChanged,calm,clock.time,fr.raw,fr.on);
}
/* Where a place on the floor is in the picture: x across and z deep, in figure heights, on the floor whose front is
   F, into o as [across, up, size, brightness]. Across and up are measured from the picture's middle in units of its
   shorter side. A figure further off is smaller, higher and a little dimmer. */
function place(F,x,z,o){
  var k=1/(1+DN_DEEP*Math.max(0,z));
  o[0]=F[0]*k*x;o[1]=F[1]+DN_UP*F[0]*(1-k);o[2]=F[0]*k;o[3]=0.45+0.55*k;
  return o;
}
/* Where each figure's own place is in the picture: n figures of an overlay kind (the usual number if n is not given;
   twelve for the crowd) on a picture asp wide for 1 tall, as [across, floor, size, brightness] each. */
export function danceSpots(kind,asp,n){
  var F=front(kind,asp),h=homes(kind,n||(kind===1?1:kind===2?4:kind===3?DN_MAX:0)),o=[],i,was=st.kind;
  st.kind=kind;for(i=0;i<h.length;i++)o.push(place(F,homeX({hf:h[i][0],hz:h[i][1],hc:h[i][2]},F),h[i][1],[]));st.kind=was;
  return o;
}
/* Fill dnU for the shader. Returns how many figures there are; none while a loop is flown. The figures are handed
   over furthest first, since the shader draws each over the ones before it; the last number of a figure's last four
   is which figure it is (a whole number, for its colour) and half its brightness, or 0 for no figure. */
export function danceFill(kind,asp){
  var n=lapOn()||kind!==st.kind?0:Math.min(DN_MAX,crowd.length),F=front(kind,asp),i,j,q=flat.q||(flat.q=[0,0,0,0]),k,d;
  st.asp=asp;order.length=0;
  for(i=0;i<n;i++)order.push(crowd[i]);
  order.sort(function(a,b){return b.hz+b.tz-a.hz-a.tz;});
  for(i=0;i<DN_MAX;i++){
    if(i>=n){dnU[8][4*i+3]=0;continue;}
    d=order[i];place(F,homeX(d,F)+d.tx,d.hz+d.tz,q);danceFlat(d.b,flat);
    k=q[0];
    for(j=0;j<16;j++){dnU[j>>1][4*i+2*(j&1)]=k+q[2]*flat[2*j];dnU[j>>1][4*i+2*(j&1)+1]=q[1]+q[2]*flat[2*j+1];}
    j=d.p[4]+d.p[5]+d.p[7];dnU[9][4*i]=Math.sin(j);dnU[9][4*i+1]=Math.cos(j);dnU[9][4*i+2]=d.mo;dnU[9][4*i+3]=d.bk; /* the way the chest faces, which the head is drawn facing */
    dnU[8][4*i]=k+q[2]*flat[32];dnU[8][4*i+1]=q[1]+q[2]*flat[33];dnU[8][4*i+2]=q[2]*DN_HEAD*flat[34];dnU[8][4*i+3]=d.id+0.5*q[3];
  }
  return n;
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
tick=makeBeatClock();bank=makeBeatBank();
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={DN_MAX, DN_MANNERS, DN_LOOKS, DN_HIP, DN_SPINE, DN_HEAD, DN_NECK, DN_SHO, DN_HIPW, DN_ARM, DN_FORE, DN_CLEAR, DN_BACK, DN_LEG, DN_FOOT, DN_STANCE, DN_NEAR, DN_EYE, DN_FAST, DN_SLOW, DN_SIZE, DN_DEEP, DN_UP, DN_FLOOR, DN_DRIFT, DN_FAINT, DN_RATE, DN_SURE0, DN_SURE1, DN_FAINT2, makeBeatBank, get danceBank(){return bank},set danceBank(v){bank=v}, danceSays, DN_QUICK, DN_TOP, DN_JUMP, DN_STEP, DN_WALK, DN_TURN, dnU, danceBody, danceFlat, makeBeatClock, pickMove, moveTier, makeRoutine, setDanceStyle, get danceStyle(){return danceStyle},
  danceKind, danceStep, stepDance, danceSpots, danceFill, crowd, danceSt:st, get danceTick(){return tick},set danceTick(v){tick=v}};
