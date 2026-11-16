/* Packing: how the worlds made of one shape repeated set their copies out in space.
   "grid" is the old way: a copy every P units along each axis, each the mirror of the one beside it, with flat empty
   lanes between the rows. The others cut space into boxes and put one copy in each box, moved off the middle of its
   box, turned its own way and sized to its box, and leave about one box in eight empty:
   "scattered" has boxes all of one size; "nested" has boxes of three sizes, a large box being left whole or cut
   into eight, and each of those eight left whole or cut into eight again, by chance.
   The largest boxes do not line up either: each layer of them is slid sideways, and each row in a layer along its
   length, by its own amount, so that no flat lane runs between the rows.
   What a box gets is chosen from whole numbers counted round the period (as Tangle's cells are), so that the shader
   (PACK_GLSL) and JavaScript (pkP, pkD) choose alike, and the world repeats exactly every PK_N large boxes.

   The distance is worked out from the copy in the box a point is in. Nothing in a box comes nearer its walls than a
   set gap, so the distance to anything in another box is at least "to the wall, and the gap", and the answer is held
   to that. Where that would hold it back in open space, the one box across the nearest wall is looked in as well,
   which lets a ray that runs along a wall take long steps. JavaScript, which flies by the distance, looks in all the
   boxes round about instead (pkWide) and so gets the open space as it is. Set pkPlain to have JavaScript answer
   exactly as the shader does: the distance probe (tools/probe.py) compares the two that way. */
import { md } from "./dom.js";

export const PACKINGS=[{name:"grid"},{name:"scattered"},{name:"nested"}];
export const PK_N=4;        /* large boxes to the period along each axis; a large box is 2P wide, so the period is 8P */
export const PK_FILL=0.62;  /* a copy's size: the ball that holds it is this part of half its box */
export const PK_GAP=0.03;   /* what is always left clear at a box's walls, as a part of P; the rest of the box is room to move the copy about */
export const PK_SPLIT0=150; /* of 251: below this a large box is cut into eight */
export const PK_SPLIT1=75;  /* of 251: below this one of those eight is cut again */
export const PK_EMPTY=32;   /* of 251: below this a box is left empty */
export const PK_FAR=1.5;    /* beyond this many times its radius from a copy's middle, the distance is taken to the ball that holds it */

export let packing=0;       /* which of PACKINGS is in use */
export let pkPlain=false;   /* JavaScript answers as the shader does, without looking in the boxes round about */
export function setPackingNow(i){packing=PACKINGS[i]?i:0;}
export function setPkPlain(on){pkPlain=!!on;}
/* whether the packing in use changes this world, and the period of a world whose grid is P */
export function pkOn(w){return !!(w&&w.packs&&packing>0);}
export function pkPer(P){var c=packing>0?2*PK_N*P:2*P;return [c,c,c];}
/* how many times longer this world's period is than its own size, for what is sized by the period (the orb) */
export function pkMul(w){return pkOn(w)?PK_N:1;}

/* The shader's half. uPk is the packing. pkB finds the box a place is in: half its width (pkH), its middle (pkM), the
   middle of its copy (pkC), the copy's two turns (pkT) and whether it is empty (pkE). pkP gives the place within a
   copy for a place in the world, and sets pkS, the copy's size, pkW, the most the distance may be, and pkO, the
   distance itself where there is no need to work out the shape (an empty box, or far from the copy), else 0. A
   world's map ends with pkD, which puts its distance back in the world's size and holds it to pkW. */
export const PACK_GLSL=[
"uniform float uPk;",
"float pkS,pkW,pkO,pkH,pkE;vec3 pkM,pkC;vec2 pkT;",
"float pkm(float x,float y){return floor(mod(x+0.5,y));}",
"float pkh(vec3 i,float s){", /* a chance number, 0 to 250, for the box numbered i, which is already counted round the period */
"  float h=pkm((i.x+3.0)*(i.x+11.0)+s,251.0);",
"  h=pkm((h+i.y+5.0)*(h+i.y+17.0)+s,251.0);",
"  return pkm((h+i.z+7.0)*(h+i.z+13.0)+s,251.0);",
"}",
"void pkB(vec3 p,float P){",
"  float c=uPk>1.5?2.0*P:P;float n=uPk>1.5?"+PK_N.toFixed(1)+":"+(2*PK_N).toFixed(1)+";float h=0.0;vec3 i=vec3(0.0);vec3 j=vec3(0.0);",
/* the largest boxes do not line up: each layer of them is slid along y, and each row in a layer along x, by its own chance amount */
"  float lz=pkm(floor(p.z/c),n);float hz=pkm((lz+3.0)*(lz+11.0)+5.0,251.0);",
"  float ly=pkm(floor((p.y+c*hz/251.0)/c),n);float hy=pkm((hz+ly+5.0)*(hz+ly+17.0)+5.0,251.0);",
"  vec3 sl=vec3(c*hy/251.0,c*hz/251.0,0.0);p+=sl;",
"  if(uPk>1.5){i=floor(p/c);j=floor(mod(i+0.5,n));h=pkh(j,1.0);}",
"  if(uPk<1.5||h<"+PK_SPLIT0.toFixed(1)+"){",
"    c=P;n="+(2*PK_N).toFixed(1)+";i=floor(p/c);j=floor(mod(i+0.5,n));h=pkh(j,2.0);",
"    if(uPk>1.5&&h<"+PK_SPLIT1.toFixed(1)+"){c=0.5*P;n="+(4*PK_N).toFixed(1)+";i=floor(p/c);j=floor(mod(i+0.5,n));h=pkh(j,3.0);}",
"  }",
"  float w1=pkm((h+19.0)*(h+31.0)+j.x,251.0);float w2=pkm((w1+23.0)*(w1+41.0)+j.y,251.0);float w3=pkm((w2+29.0)*(w2+43.0)+j.z,251.0);",
"  float w4=pkm((w3+37.0)*(w3+47.0)+j.x,251.0);float w5=pkm((w4+53.0)*(w4+59.0)+j.y,251.0);float w6=pkm((w5+61.0)*(w5+67.0)+j.z,251.0);",
"  pkH=0.5*c;pkM=(i+0.5)*c-sl;pkE=w6<"+PK_EMPTY.toFixed(1)+"?1.0:0.0;",
"  pkC=pkM+(pkH*"+(1-PK_FILL).toFixed(3)+"-"+PK_GAP.toFixed(4)+"*P)*(vec3(w1,w2,w3)/125.0-1.0);",
"  pkT=vec2(w4,w5)*0.02503261;",
"}",
"vec3 pkP(vec3 p,float P,float R){",
"  pkO=0.0;",
"  if(uPk<0.5){pkS=1.0;pkW=1e5;return abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;}",
"  pkB(p,P);",
"  vec3 a=pkH-abs(p-pkM);float wd=min(a.x,min(a.y,a.z));", /* how far to each pair of the box's walls, and to the nearest */
"  pkS=pkH*"+PK_FILL.toFixed(3)+"/R;pkW=wd+"+PK_GAP.toFixed(4)+"*P;",
"  vec3 q=p-pkC;float c1=cos(pkT.x),s1=sin(pkT.x),c2=cos(pkT.y),s2=sin(pkT.y);",
"  q.xz=vec2(c1*q.x-s1*q.z,s1*q.x+c1*q.z);",
"  q.yz=vec2(c2*q.y-s2*q.z,s2*q.y+c2*q.z);",
"  q/=pkS;float r=length(q);float d=1e5;",
"  if(pkE<0.5){if(r<="+PK_FAR.toFixed(1)+"*R)return q;d=pkS*(r-R);}", /* near the copy: the world works out its shape */
"  if(d>pkW){", /* open space, held back by the wall: look in the box across it */
"    vec3 n=(a.x<=a.y&&a.x<=a.z)?vec3(1.0,0.0,0.0):(a.y<=a.z?vec3(0.0,1.0,0.0):vec3(0.0,0.0,1.0));",
"    float w2=max(min(a.x,a.y),min(max(a.x,a.y),a.z));", /* the next nearest wall of this box */
"    pkB(p+n*(dot(n,p-pkM)<0.0?-1.0:1.0)*(wd+0.01*P),P);",
"    vec3 b=mix(pkH-abs(p-pkM),vec3(wd+2.0*pkH),n);", /* that box's walls: its sides, and its far end */
"    pkW="+PK_GAP.toFixed(4)+"*P+min(w2,min(b.x,min(b.y,b.z)));",
"    if(pkE<0.5)pkW=min(pkW,length(p-pkC)-pkH*"+PK_FILL.toFixed(3)+");", /* the ball that holds its copy */
"  }",
"  pkO=min(d,pkW);",
"  return q;",
"}",
"float pkD(float d){return min(d*pkS,pkW);}"
];

/* JavaScript's half. The box a place is in goes into a list: the middle of its copy (0 to 2), the copy's size (3),
   the distance to the box's nearest wall and the gap (4), whether it is empty (5), its two turns (6, 7), and its own
   middle and width (8 to 11), which also tell one box from another. */
const bx=[0,0,0,0,0,0,0,0,0,0,0,0];
const own=[0,0,0,0,0,0,0,0,0,0,0,0];
const out=[0,0,0,0];
const at=[0,0,0];
let atP=1, atR=1; /* with at, the place, grid and radius of the last pkP, for pkD */
function pkm(x,y){return Math.floor(md(x+.5,y));}
function pkh(a,b,c,s){
  var h=pkm((a+3)*(a+11)+s,251);
  h=pkm((h+b+5)*(h+b+17)+s,251);
  return pkm((h+c+7)*(h+c+13)+s,251);
}
function box(x,y,z,P,R,o){
  var c=packing>1?2*P:P,n=packing>1?PK_N:2*PK_N,h=0,ix=0,iy=0,iz=0,jx=0,jy=0,jz=0,H,w1,w2,w3,w4,w5,w6,mv,x0=x,y0=y;
  /* the largest boxes do not line up: each layer of them is slid along y, and each row in a layer along x, by its own chance amount */
  var lz=pkm(Math.floor(z/c),n),hz=pkm((lz+3)*(lz+11)+5,251),sy=c*hz/251,ly=pkm(Math.floor((y+sy)/c),n),hy=pkm((hz+ly+5)*(hz+ly+17)+5,251),sx=c*hy/251;
  x+=sx;y+=sy;
  if(packing>1){ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,1);}
  if(packing<2||h<PK_SPLIT0){
    c=P;n=2*PK_N;ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,2);
    if(packing>1&&h<PK_SPLIT1){c=.5*P;n=4*PK_N;ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,3);}
  }
  H=.5*c;o[8]=(ix+.5)*c-sx;o[9]=(iy+.5)*c-sy;o[10]=(iz+.5)*c;o[11]=c;
  o[4]=H-Math.max(Math.abs(x0-o[8]),Math.abs(y0-o[9]),Math.abs(z-o[10]))+PK_GAP*P;
  w1=pkm((h+19)*(h+31)+jx,251);w2=pkm((w1+23)*(w1+41)+jy,251);w3=pkm((w2+29)*(w2+43)+jz,251);
  w4=pkm((w3+37)*(w3+47)+jx,251);w5=pkm((w4+53)*(w4+59)+jy,251);w6=pkm((w5+61)*(w5+67)+jz,251);
  mv=H*(1-PK_FILL)-PK_GAP*P;
  o[0]=o[8]+mv*(w1/125-1);o[1]=o[9]+mv*(w2/125-1);o[2]=o[10]+mv*(w3/125-1);
  o[3]=H*PK_FILL/R;o[5]=w6<PK_EMPTY?1:0;o[6]=w4*.02503261;o[7]=w5*.02503261;
}
/* The shader's way with open space that the wall holds back: the most the distance may be at the last pkP's place,
   after a look in the one box across the nearest wall. */
function pkAcross(){
  var P=atP,H=.5*own[11],a=[H-Math.abs(at[0]-own[8]),H-Math.abs(at[1]-own[9]),H-Math.abs(at[2]-own[10])];
  var k=(a[0]<=a[1]&&a[0]<=a[2])?0:(a[1]<=a[2]?1:2),wd=a[k],w2=Math.max(Math.min(a[0],a[1]),Math.min(Math.max(a[0],a[1]),a[2]));
  var p=[at[0],at[1],at[2]],i,b,lim=w2;
  p[k]+=(at[k]-own[8+k]<0?-1:1)*(wd+.01*P);
  box(p[0],p[1],p[2],P,atR,bx);
  for(i=0;i<3;i++){b=i===k?wd+bx[11]:.5*bx[11]-Math.abs(at[i]-bx[8+i]);if(b<lim)lim=b;}
  lim+=PK_GAP*P;
  if(!bx[5])lim=Math.min(lim,Math.hypot(at[0]-bx[0],at[1]-bx[1],at[2]-bx[2])-.5*bx[11]*PK_FILL);
  return lim;
}
/* The open space at the last pkP's place, given the distance d to its own box's copy: no further than the nearest
   ball that holds a copy in any box within half a grid step, and no further than that half step. Every box is at
   least half a grid step wide, so the 27 places looked at find every box that near. */
function pkWide(d){
  var P=atP,e=.5*P,i,j,k,r;
  d=Math.min(d,e);
  for(i=-1;i<2;i++)for(j=-1;j<2;j++)for(k=-1;k<2;k++){
    if(!i&&!j&&!k)continue;
    box(at[0]+i*e,at[1]+j*e,at[2]+k*e,P,atR,bx);
    if(bx[5]||(bx[8]===own[8]&&bx[9]===own[9]&&bx[10]===own[10]&&bx[11]===own[11]))continue;
    r=Math.hypot(at[0]-bx[0],at[1]-bx[1],at[2]-bx[2])-bx[3]*atR;
    if(r<d)d=r;
  }
  return d;
}
/* The place within a copy for a place in the world: x, y, z in the first three numbers of what is returned (the same
   list every time, to be read at once). The fourth is the distance itself where the shape need not be worked out, else 0. */
export function pkP(x,y,z,P,R){
  var qx,qy,qz,t,c1,s1,c2,s2,r,s,d=1e5;
  out[3]=0;
  if(packing<1){
    own[3]=1;own[4]=1e5;
    out[0]=Math.abs(md(x+.5*P,2*P)-P)-.5*P;out[1]=Math.abs(md(y+.5*P,2*P)-P)-.5*P;out[2]=Math.abs(md(z+.5*P,2*P)-P)-.5*P;
    return out;
  }
  at[0]=x;at[1]=y;at[2]=z;atP=P;atR=R;
  box(x,y,z,P,R,own);
  s=own[3];
  if(!own[5]){
    qx=x-own[0];qy=y-own[1];qz=z-own[2];
    c1=Math.cos(own[6]);s1=Math.sin(own[6]);c2=Math.cos(own[7]);s2=Math.sin(own[7]);
    t=c1*qx-s1*qz;qz=s1*qx+c1*qz;qx=t;
    t=c2*qy-s2*qz;qz=s2*qy+c2*qz;qy=t;
    qx/=s;qy/=s;qz/=s;r=Math.hypot(qx,qy,qz);
    out[0]=qx;out[1]=qy;out[2]=qz;
    if(r<=PK_FAR*R)return out;
    d=s*(r-R);
  }
  out[3]=d<=own[4]?d:pkPlain?Math.min(d,pkAcross()):pkWide(d);
  return out;
}
/* A world's distance within a copy, put back in the world's size. */
export function pkD(d){
  d*=own[3];
  if(packing<1||d<=own[4])return d;
  return pkPlain?own[4]:pkWide(d);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={PACKINGS, PK_N, PK_FILL, PK_GAP, PK_SPLIT0, PK_SPLIT1, PK_EMPTY, PK_FAR, PACK_GLSL, setPackingNow, setPkPlain, pkOn, pkPer, pkMul, pkm, pkh, pkBox:box, pkAcross, pkWide, pkP, pkD,
  get packing(){return packing}, get pkPlain(){return pkPlain}};
