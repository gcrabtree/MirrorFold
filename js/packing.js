/* Packing: how the worlds made of one shape repeated set their copies out in space.
   "grid" is the old way: a copy every P units along each axis, each the mirror of the one beside it, with flat empty
   lanes between the rows. The others put each copy in a place of its own, turned its own way and sized to fit:
   "scattered" cuts space into boxes all of one size, a copy in each, moved off the middle, about one box in eight empty;
   "nested"    has boxes of three sizes, a large box being left whole or cut into eight, and each of those again;
   "sponge"    sets small copies out as a sponge with square holes through it, and a large copy at the heart of each block;
   "helix"     winds two strands of copies up round an open middle that can be flown along;
   "shells"    has cages of twenty copies one inside another round a centre, each a third the size of the one outside it
               and turned a little, without end;
   "descent"   is one such nest that goes on without end outward as well: the world is the same three times larger or
               smaller, so a camera flying in toward the middle can be moved out three times as far, unseen, for ever.
   The first three after the grid are worked out from boxes: the box a place is in, and what it holds. Nothing in a box
   comes nearer its walls than a set gap, so the distance to anything in another box is at least "to the wall, and the
   gap", and the answer is held to that; where that would hold it back in open space the one box across the nearest wall
   is looked in as well. JavaScript, which flies by the distance, looks in all the boxes round about instead (pkWide).
   Set pkPlain to have JavaScript answer exactly as the shader does: tools/probe.py compares the two that way.
   The last three are worked out from balls: the copy whose middle is nearest, and no further than the nearest of the
   balls that hold the others. There JavaScript and the shader answer alike.
   What a box holds is chosen from whole numbers counted round the period (as Tangle's cells are), so that the shader
   (PACK_GLSL) and JavaScript choose alike.

   Two more choices ride on a packing, and show in every packing but the grid:
   the pulse: "together", every copy at the same point of the morph, or "wave", each copy behind the morph's clock by
   its own number of seconds, set by where it is, so that a change of shape passes through the field;
   the shapes: "one kind", or "mixed", where each copy is one of three kinds: the world's own and two others. */
import { md } from "./dom.js";

export const PACKINGS=[{name:"grid"},{name:"scattered"},{name:"nested"},{name:"sponge"},{name:"helix"},{name:"shells"},{name:"descent"}];
export const PK_DEEP=6;     /* which of them is the descent */
export const PK_N=4;        /* scattered and nested: large boxes to the period along each axis; a large box is 2P wide, so the period is 8P */
export const PK_FILL=0.62;  /* a copy's size in a box: the ball that holds it is this part of half its box */
export const PK_GAP=0.03;   /* what is always left clear at a box's walls, as a part of P; the rest of the box is room to move the copy about */
export const PK_SPLIT0=150; /* of 251: below this a large box is cut into eight */
export const PK_SPLIT1=75;  /* of 251: below this one of those eight is cut again */
export const PK_EMPTY=32;   /* of 251: below this a box is left empty */
export const PK_FAR=1.5;    /* beyond this many times its radius from a copy's middle, the distance is taken to the ball that holds it */
export const PK_LAG=17.5;   /* the wave: a copy is from nothing to twice this many seconds behind the morph's clock */
/* The helix, in parts of P: its blocks are HX_W wide, a turn is HX_N copies and HX_N*HX_H high, the copies' middles
   are HX_R from the axis and each is held in a ball of HX_B. */
export const HX_W=4, HX_N=6, HX_H=0.5, HX_R=1.25, HX_B=0.5;
/* A cage, in parts of its own size: twenty balls of CG_B with their middles on the corners and the middles of the
   edges of a cube two across. All of it lies between CG_IN*3 and CG_OUT/3 from the centre, the next cage inward within
   CG_IN and the next outward beyond CG_OUT; a cage's own ground is from CG_CUT to three times that. SH_W is how far
   apart the shells' nests are, in parts of P. */
export const CG_B=0.4, CG_IN=0.711, CG_OUT=3.042, CG_CUT=0.849, SH_W=3.2, SH_TW=0.7, SH_LAG=9;
/* the descent keeps the camera between DP_IN and three times that from the centre, in parts of P */
export const DP_IN=1.5;

export let packing=0;       /* which of PACKINGS is in use */
export let pkPlain=false;   /* JavaScript answers as the shader does, without looking in the boxes round about */
export let pkWave=false;    /* the pulse is a wave */
export let pkMix=false;     /* the shapes are mixed */
const mw=[0,1,0,1];         /* the sine and cosine of each of the morph's two waves now, for working out the morph some seconds ago */
export function setPackingNow(i){packing=PACKINGS[i]?i:0;}
export function setPkPlain(on){pkPlain=!!on;}
export function setPkWave(on){pkWave=!!on;}
export function setPkMix(on){pkMix=!!on;}
/* told the morph's clock every frame (js/loop.js); the numbers go to the shader as they are */
export function pkTick(T){mw[0]=Math.sin(.09*T);mw[1]=Math.cos(.09*T);mw[2]=Math.sin(.31*T);mw[3]=Math.cos(.31*T);}
export function pkMw(){return mw;}
/* the morph for a copy f seconds behind, given the morph now */
export function pkMo(m,f){return pkWave?mw[0]*Math.cos(.09*f)-mw[1]*Math.sin(.09*f)+.15*(mw[2]*Math.cos(.31*f)-mw[3]*Math.sin(.31*f)):m;}
/* whether the packing in use changes this world, whether it is the descent there, and the period of a world whose grid is P */
export function pkOn(w){return !!(w&&w.packs&&packing>0);}
export function pkDeep(w){return !!(w&&w.packs&&packing===PK_DEEP);}
export function pkPer(P){
  var c=packing===0?2*P:packing<3?2*PK_N*P:packing===3?9*P:packing===4?HX_W*P:packing===5?SH_W*P:12*P;
  return [c,c,packing===4?HX_N*HX_H*P:c];
}
/* how many times longer this world's period is than its own size, for what is sized by the period (the orb) */
export function pkMul(w){var p;if(!w||!w.packs)return 1;p=pkPer(w.grid);return Math.min(p[0],p[1],p[2])/(2*w.grid);}
/* The descent: how many times larger than at its nearest the camera's surroundings are, 1 to 3. The scene shader's
   fog and reach, and the top speed, are stretched by this, so that the picture is the same just before and just after
   the camera is moved out. */
export function pkZoom(pos,P){return Math.max(1e-6,Math.hypot(pos[0],pos[1],pos[2])/(DP_IN*P));}
/* The descent: a place too near the centre is moved three times as far out, and one too far out a third as far, where
   the world is the same. Changes pos, and gives the number it was multiplied by (1 for no move). */
export function pkJump(pos,P){
  var r=Math.hypot(pos[0],pos[1],pos[2]),k=1;
  if(r>1e-9*P){if(r<DP_IN*P)k=3;else if(r>=3*DP_IN*P)k=1/3;}
  if(k!==1){pos[0]*=k;pos[1]*=k;pos[2]*=k;}
  return k;
}

/* The shader's half. uPk is the packing, uPkO the pulse and the shapes (1 for wave, 1 for mixed), uMw the morph's two
   waves, uPkZ the descent's stretch. pkP gives the place within a copy for a place in the world, and sets pkS, the
   copy's size, pkW, the most the distance may be, pkK, which kind of shape it is, pkU, the morph for it, and pkO, the
   distance itself where there is no need to work out the shape (an empty box, or far from the copy), else 0. A world's
   map ends with pkD, which puts its distance back in the world's size and holds it to pkW. pkQ is left as the place
   within the copy, for the surfaces' patterns in the descent. */
export const PACK_GLSL=[
"uniform float uPk,uPkZ;uniform vec2 uPkO;uniform vec4 uMw;",
"float pkS,pkW,pkO,pkH,pkE,pkK,pkF,pkU,pkR,pkA;vec3 pkM,pkC,pkV,pkQ;vec2 pkT;",
"float pkm(float x,float y){return floor(mod(x+0.5,y));}",
"float pkh(vec3 i,float s){", /* a chance number, 0 to 250, for the box numbered i, which is already counted round the period */
"  float h=pkm((i.x+3.0)*(i.x+11.0)+s,251.0);",
"  h=pkm((h+i.y+5.0)*(h+i.y+17.0)+s,251.0);",
"  return pkm((h+i.z+7.0)*(h+i.z+13.0)+s,251.0);",
"}",
"float pkMo(float f){return uPkO.x<0.5?uM:uMw.x*cos(0.09*f)-uMw.y*sin(0.09*f)+0.15*(uMw.z*cos(0.31*f)-uMw.w*sin(0.31*f));}",
"float pkLag(vec3 u){return "+PK_LAG.toFixed(1)+"*(1.0+(sin(6.2831853*u.x)+sin(6.2831853*u.y)+sin(6.2831853*u.z))/3.0);}", /* u: where the copy is, as parts of the period */
/* the box a place is in: half its width (pkH), its middle (pkM), the middle of its copy (pkC), the copy's turns, kind and lag, and whether it is empty (pkE) */
"void pkB(vec3 p,float P){",
"  float c=uPk>1.5?2.0*P:P;float n=uPk>1.5?"+PK_N.toFixed(1)+":"+(2*PK_N).toFixed(1)+";float h=0.0;float big=0.0;float mv=1.0;vec3 i=vec3(0.0);vec3 j=vec3(0.0);vec3 sl=vec3(0.0);pkE=0.0;",
"  if(uPk>2.5){", /* the sponge: blocks of three large boxes each way; the middle one holds a large copy, the six at the middles of the faces are empty, and the other twenty are cut into 27, of which the same seven are empty */
"    mv=0.0;c=3.0*P;n=3.0;i=floor(p/c);j=floor(mod(i+0.5,n));vec3 e=1.0-abs(j-1.0);h=pkh(j,6.0);",
"    if(e.x+e.y+e.z>2.5)big=1.0;else if(e.x+e.y+e.z>1.5)pkE=1.0;",
"    else{c=P;n=9.0;i=floor(p/c);j=floor(mod(i+0.5,n));e=1.0-abs(floor(mod(j+0.5,3.0))-1.0);h=pkh(j,8.0);if(e.x+e.y+e.z>1.5)pkE=1.0;}",
"  }else{",
/* the largest boxes do not line up: each layer of them is slid along y, and each row in a layer along x, by its own chance amount */
"    float lz=pkm(floor(p.z/c),n);float hz=pkm((lz+3.0)*(lz+11.0)+5.0,251.0);",
"    float ly=pkm(floor((p.y+c*hz/251.0)/c),n);float hy=pkm((hz+ly+5.0)*(hz+ly+17.0)+5.0,251.0);",
"    sl=vec3(c*hy/251.0,c*hz/251.0,0.0);p+=sl;",
"    if(uPk>1.5){i=floor(p/c);j=floor(mod(i+0.5,n));h=pkh(j,1.0);big=1.0;}",
"    if(uPk<1.5||h<"+PK_SPLIT0.toFixed(1)+"){",
"      big=0.0;c=P;n="+(2*PK_N).toFixed(1)+";i=floor(p/c);j=floor(mod(i+0.5,n));h=pkh(j,2.0);",
"      if(uPk>1.5&&h<"+PK_SPLIT1.toFixed(1)+"){c=0.5*P;n="+(4*PK_N).toFixed(1)+";i=floor(p/c);j=floor(mod(i+0.5,n));h=pkh(j,3.0);}",
"    }",
"  }",
"  float w1=pkm((h+19.0)*(h+31.0)+j.x,251.0);float w2=pkm((w1+23.0)*(w1+41.0)+j.y,251.0);float w3=pkm((w2+29.0)*(w2+43.0)+j.z,251.0);",
"  float w4=pkm((w3+37.0)*(w3+47.0)+j.x,251.0);float w5=pkm((w4+53.0)*(w4+59.0)+j.y,251.0);float w6=pkm((w5+61.0)*(w5+67.0)+j.z,251.0);",
"  float w7=pkm((w6+71.0)*(w6+73.0)+j.x+j.y,251.0);",
"  pkH=0.5*c;pkM=(i+0.5)*c-sl;if(uPk<2.5&&w6<"+PK_EMPTY.toFixed(1)+")pkE=1.0;",
"  pkC=pkM+mv*(pkH*"+(1-PK_FILL).toFixed(3)+"-"+PK_GAP.toFixed(4)+"*P)*(vec3(w1,w2,w3)/125.0-1.0);",
"  pkT=vec2(w4,w5)*0.02503261;pkA=0.0;",
"  pkK=(uPkO.y<0.5||big>0.5)?0.0:(w7<84.0?0.0:(w7<168.0?1.0:2.0));", /* mixed: a large copy is the world's own kind, the others one of three by chance */
"  pkF=pkLag((j+0.5)/n);",
"}",
/* the helix: the copy whose middle is nearest of the five about this height. Gives the most the distance may be. */
"float pkHx(vec3 p,float P){",
"  vec3 f=vec3(mod(p.xy+"+(HX_W/2).toFixed(2)+"*P,"+HX_W.toFixed(2)+"*P)-"+(HX_W/2).toFixed(2)+"*P,p.z);float h="+HX_H.toFixed(3)+"*P;float j0=floor(p.z/h+0.5);",
"  float d1=1e9,d2=1e9,jb=0.0;",
"  for(int t=0;t<10;t++){", /* two strands, opposite each other: five copies of each */
"    float sd=t<5?0.0:1.0;float j=j0+float(t)-2.0-5.0*sd;float jm=pkm(j,"+HX_N.toFixed(1)+")+"+(HX_N/2).toFixed(1)+"*sd;float a="+(2*Math.PI/HX_N).toFixed(7)+"*jm;",
"    vec3 v=f-vec3("+HX_R.toFixed(3)+"*P*cos(a),"+HX_R.toFixed(3)+"*P*sin(a),j*h);float d=length(v);",
"    if(d<d1){d2=d1;d1=d;jb=jm;pkV=v;}else if(d<d2)d2=d;",
"  }",
"  pkR="+HX_B.toFixed(3)+"*P;pkE=0.0;pkA=-"+(2*Math.PI/HX_N).toFixed(7)+"*jb;pkT=vec2(0.5,0.3);",
"  pkK=uPkO.y<0.5?0.0:pkm(jb,3.0);pkF="+PK_LAG.toFixed(1)+"*(1.0+sin("+(2*Math.PI/HX_N).toFixed(7)+"*jb));",
"  return min(d2-pkR,min("+(2.5*HX_H-HX_B).toFixed(3)+"*P,"+(HX_W/2).toFixed(2)+"*P-max(abs(f.x),abs(f.y))+"+(HX_W/2-HX_R-HX_B).toFixed(3)+"*P));", /* the next nearest ball; the copies not looked at; the helices in the blocks round about */
"}",
/* a cage: p is the place from the centre. The cage whose ground p is on, and the nearest of its twenty balls. Gives the most the distance may be. */
"float pkCg(vec3 p,float P){",
"  float r=max(length(p),1e-9*P);float k=floor(log(r/("+CG_CUT.toFixed(3)+"*P))/1.0986123);",
"  if(uPk<5.5)k=min(k,0.0);", /* the shells have a largest cage */
"  float s=P*exp(1.0986123*k);float tw=uPk<5.5?"+SH_TW.toFixed(2)+"*k:0.0;float ct=cos(tw),st=sin(tw);", /* each of the shells' cages is turned a little from the one outside it */
"  vec3 q=p/s;q.xy=vec2(ct*q.x-st*q.y,st*q.x+ct*q.y);",
"  vec3 a=abs(q);vec3 c=vec3(q.x<0.0?-1.0:1.0,q.y<0.0?-1.0:1.0,q.z<0.0?-1.0:1.0);float z=0.0;",
"  if(min(a.x,min(a.y,a.z))<0.5){if(a.x<=a.y&&a.x<=a.z){c.x=0.0;z=1.0;}else if(a.y<=a.z){c.y=0.0;z=2.0;}else{c.z=0.0;z=3.0;}}", /* nearer the middle of an edge than a corner */
"  float dc=length(q-c);float rq=length(q);",
"  pkV=(q-c)*s;pkR="+CG_B.toFixed(3)+"*s;pkE=0.0;pkA=0.0;pkT=vec2(0.9*c.x+0.5*c.z,0.7*c.y);",
"  pkK=uPkO.y<0.5?0.0:(z<0.5?1.0:(z>2.5?2.0:0.0));", /* mixed: the corners are one kind, the edges that run one way another */
"  pkF="+PK_LAG.toFixed(1)+"*(1.0+(c.x+c.y+c.z)/3.0)-(uPk<5.5?"+SH_LAG.toFixed(1)+"*k:0.0);", /* the shells' inner cages are further behind, so the wave runs inward */
"  return s*min(max(dc,1.0-dc)-"+CG_B.toFixed(3)+",min(rq-"+CG_IN.toFixed(3)+",(uPk<5.5&&k>-0.5)?1e5:"+CG_OUT.toFixed(3)+"-rq));", /* the cage's other balls; the cage inside; the cage outside */
"}",
"vec3 pkP(vec3 p,float P,vec3 R3){",
"  pkO=0.0;pkK=0.0;pkU=uM;",
"  if(uPk<0.5){pkS=1.0;pkW=1e5;pkQ=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;return pkQ;}",
"  vec3 a=vec3(0.0);float wd=0.0;float cap=0.0;",
"  if(uPk<3.5){",
"    pkB(p,P);a=pkH-abs(p-pkM);wd=min(a.x,min(a.y,a.z));", /* how far to each pair of the box's walls, and to the nearest */
"    cap=wd+"+PK_GAP.toFixed(4)+"*P;pkV=p-pkC;pkR=pkH*"+PK_FILL.toFixed(3)+";",
"  }else if(uPk<4.5)cap=pkHx(p,P);",
"  else if(uPk<5.5){vec3 f=mod(p+"+(SH_W/2).toFixed(3)+"*P,"+SH_W.toFixed(3)+"*P)-"+(SH_W/2).toFixed(3)+"*P;cap=min(pkCg(f,P),"+(SH_W/2).toFixed(3)+"*P-max(abs(f.x),max(abs(f.y),abs(f.z)))+"+(SH_W/2-1-CG_B-0.02).toFixed(3)+"*P);}",
"  else cap=pkCg(p,P);",
"  float R=pkK<0.5?R3.x:(pkK<1.5?R3.y:R3.z);",
"  pkS=pkR/R;pkW=cap;pkU=pkMo(pkF);",
"  vec3 q=pkV;float c0=cos(pkA),s0=sin(pkA),c1=cos(pkT.x),s1=sin(pkT.x),c2=cos(pkT.y),s2=sin(pkT.y);",
"  q.xy=vec2(c0*q.x-s0*q.y,s0*q.x+c0*q.y);",
"  q.xz=vec2(c1*q.x-s1*q.z,s1*q.x+c1*q.z);",
"  q.yz=vec2(c2*q.y-s2*q.z,s2*q.y+c2*q.z);",
"  q/=pkS;pkQ=q;float r=length(q);float d=1e5;",
"  if(pkE<0.5){if(r<="+PK_FAR.toFixed(1)+"*R)return q;d=pkS*(r-R);}", /* near the copy: the world works out its shape */
"  if(uPk<3.5&&d>pkW){", /* open space, held back by the wall: look in the box across it */
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

/* JavaScript's half. A box goes into a list: the middle of its copy (0 to 2), the radius of the ball that holds the
   copy (3), the distance to the box's nearest wall and the gap (4), whether it is empty (5), its two turns (6, 7), its
   own middle and width (8 to 11), which also tell one box from another, the copy's kind (12) and its lag (13). */
const bx=[0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const own=[0,0,0,0,0,0,0,0,0,0,0,0,0,0];
const out=[0,0,0,0,0,0];
const at=[0,0,0];
const V=[0,0,0];
let atP=1;                 /* with at, the place and grid of the last pkP, for pkD */
let cS=1, cW=1e5, cR=1, cA=0, cT1=0, cT2=0, cE=0, cK=0, cF=0; /* the last pkP's copy: its size, the most the distance may be, its ball, turns, whether it is empty, its kind and lag */
function pkm(x,y){return Math.floor(md(x+.5,y));}
function pkh(a,b,c,s){
  var h=pkm((a+3)*(a+11)+s,251);
  h=pkm((h+b+5)*(h+b+17)+s,251);
  return pkm((h+c+7)*(h+c+13)+s,251);
}
function one(j){return 1-Math.abs(j-1);}
function box(x,y,z,P,o){
  var c=packing>1?2*P:P,n=packing>1?PK_N:2*PK_N,h=0,big=0,mv=1,ix=0,iy=0,iz=0,jx=0,jy=0,jz=0,H,w1,w2,w3,w4,w5,w6,w7,e,x0=x,y0=y,sx=0,sy=0,lz,hz,ly,hy;
  o[5]=0;
  if(packing>2){
    mv=0;c=3*P;n=3;ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,6);
    e=one(jx)+one(jy)+one(jz);
    if(e>2.5)big=1;else if(e>1.5)o[5]=1;
    else{c=P;n=9;ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,8);if(one(pkm(jx,3))+one(pkm(jy,3))+one(pkm(jz,3))>1.5)o[5]=1;}
  }else{
    /* the largest boxes do not line up: each layer of them is slid along y, and each row in a layer along x, by its own chance amount */
    lz=pkm(Math.floor(z/c),n);hz=pkm((lz+3)*(lz+11)+5,251);sy=c*hz/251;ly=pkm(Math.floor((y+sy)/c),n);hy=pkm((hz+ly+5)*(hz+ly+17)+5,251);sx=c*hy/251;
    x+=sx;y+=sy;
    if(packing>1){ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,1);big=1;}
    if(packing<2||h<PK_SPLIT0){
      big=0;c=P;n=2*PK_N;ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,2);
      if(packing>1&&h<PK_SPLIT1){c=.5*P;n=4*PK_N;ix=Math.floor(x/c);iy=Math.floor(y/c);iz=Math.floor(z/c);jx=pkm(ix,n);jy=pkm(iy,n);jz=pkm(iz,n);h=pkh(jx,jy,jz,3);}
    }
  }
  H=.5*c;o[8]=(ix+.5)*c-sx;o[9]=(iy+.5)*c-sy;o[10]=(iz+.5)*c;o[11]=c;
  o[4]=H-Math.max(Math.abs(x0-o[8]),Math.abs(y0-o[9]),Math.abs(z-o[10]))+PK_GAP*P;
  w1=pkm((h+19)*(h+31)+jx,251);w2=pkm((w1+23)*(w1+41)+jy,251);w3=pkm((w2+29)*(w2+43)+jz,251);
  w4=pkm((w3+37)*(w3+47)+jx,251);w5=pkm((w4+53)*(w4+59)+jy,251);w6=pkm((w5+61)*(w5+67)+jz,251);
  w7=pkm((w6+71)*(w6+73)+jx+jy,251);
  if(packing<3&&w6<PK_EMPTY)o[5]=1;
  mv*=H*(1-PK_FILL)-PK_GAP*P;
  o[0]=o[8]+mv*(w1/125-1);o[1]=o[9]+mv*(w2/125-1);o[2]=o[10]+mv*(w3/125-1);
  o[3]=H*PK_FILL;o[6]=w4*.02503261;o[7]=w5*.02503261;
  o[12]=(!pkMix||big)?0:w7<84?0:w7<168?1:2;
  o[13]=PK_LAG*(1+(Math.sin(2*Math.PI*(jx+.5)/n)+Math.sin(2*Math.PI*(jy+.5)/n)+Math.sin(2*Math.PI*(jz+.5)/n))/3);
}
/* The shader's way with open space that the wall holds back: the most the distance may be at the last pkP's place,
   after a look in the one box across the nearest wall. */
function pkAcross(){
  var P=atP,H=.5*own[11],a=[H-Math.abs(at[0]-own[8]),H-Math.abs(at[1]-own[9]),H-Math.abs(at[2]-own[10])];
  var k=(a[0]<=a[1]&&a[0]<=a[2])?0:(a[1]<=a[2]?1:2),wd=a[k],w2=Math.max(Math.min(a[0],a[1]),Math.min(Math.max(a[0],a[1]),a[2]));
  var p=[at[0],at[1],at[2]],i,b,lim=w2;
  p[k]+=(at[k]-own[8+k]<0?-1:1)*(wd+.01*P);
  box(p[0],p[1],p[2],P,bx);
  for(i=0;i<3;i++){b=i===k?wd+bx[11]:.5*bx[11]-Math.abs(at[i]-bx[8+i]);if(b<lim)lim=b;}
  lim+=PK_GAP*P;
  if(!bx[5])lim=Math.min(lim,Math.hypot(at[0]-bx[0],at[1]-bx[1],at[2]-bx[2])-bx[3]);
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
    box(at[0]+i*e,at[1]+j*e,at[2]+k*e,P,bx);
    if(bx[5]||(bx[8]===own[8]&&bx[9]===own[9]&&bx[10]===own[10]&&bx[11]===own[11]))continue;
    r=Math.hypot(at[0]-bx[0],at[1]-bx[1],at[2]-bx[2])-bx[3];
    if(r<d)d=r;
  }
  return d;
}
/* the helix: as pkHx in the shader. Fills V and the copy's numbers, and gives the most the distance may be. */
function helix(x,y,z,P){
  var W=HX_W*P,fx=md(x+W/2,W)-W/2,fy=md(y+W/2,W)-W/2,h=HX_H*P,j0=Math.floor(z/h+.5),d1=1e9,d2=1e9,jb=0,t,j,jm,a,vx,vy,vz,d,sd,st=2*Math.PI/HX_N;
  for(t=0;t<10;t++){
    sd=t<5?0:1;j=j0+t-2-5*sd;jm=pkm(j,HX_N)+HX_N/2*sd;a=st*jm;
    vx=fx-HX_R*P*Math.cos(a);vy=fy-HX_R*P*Math.sin(a);vz=z-j*h;d=Math.hypot(vx,vy,vz);
    if(d<d1){d2=d1;d1=d;jb=jm;V[0]=vx;V[1]=vy;V[2]=vz;}else if(d<d2)d2=d;
  }
  cR=HX_B*P;cE=0;cA=-st*jb;cT1=.5;cT2=.3;
  cK=pkMix?pkm(jb,3):0;cF=PK_LAG*(1+Math.sin(st*jb));
  return Math.min(d2-cR,(2.5*HX_H-HX_B)*P,W/2-Math.max(Math.abs(fx),Math.abs(fy))+(HX_W/2-HX_R-HX_B)*P);
}
/* a cage: as pkCg in the shader, for a place from the centre. shells: there is a largest cage. */
function cage(x,y,z,P,shells){
  var r=Math.max(Math.hypot(x,y,z),1e-9*P),k=Math.floor(Math.log(r/(CG_CUT*P))/1.0986123),s,tw,ct,st,qx,qy,qz,ax,ay,az,cx,cy,cz,zz=0,dc,rq,t;
  if(shells)k=Math.min(k,0);
  s=P*Math.pow(3,k);tw=shells?SH_TW*k:0;ct=Math.cos(tw);st=Math.sin(tw);
  qx=x/s;qy=y/s;qz=z/s;t=ct*qx-st*qy;qy=st*qx+ct*qy;qx=t;
  ax=Math.abs(qx);ay=Math.abs(qy);az=Math.abs(qz);cx=qx<0?-1:1;cy=qy<0?-1:1;cz=qz<0?-1:1;
  if(Math.min(ax,ay,az)<.5){if(ax<=ay&&ax<=az){cx=0;zz=1;}else if(ay<=az){cy=0;zz=2;}else{cz=0;zz=3;}}
  dc=Math.hypot(qx-cx,qy-cy,qz-cz);rq=Math.hypot(qx,qy,qz);
  V[0]=(qx-cx)*s;V[1]=(qy-cy)*s;V[2]=(qz-cz)*s;cR=CG_B*s;cE=0;cA=0;cT1=.9*cx+.5*cz;cT2=.7*cy;
  cK=!pkMix?0:zz<.5?1:zz>2.5?2:0;
  cF=PK_LAG*(1+(cx+cy+cz)/3)-(shells?SH_LAG*k:0);
  return s*Math.min(Math.max(dc,1-dc)-CG_B,rq-CG_IN,(shells&&k>-.5)?1e5:CG_OUT-rq);
}
/* The place within a copy for a place in the world: x, y, z in the first three numbers of what is returned (the same
   list every time, to be read at once). The fourth is the distance itself where the shape need not be worked out, else
   0; the fifth is which kind of shape the copy is (0 the world's own, 1 and 2 its two others, whose radii are R1 and
   R2), and the sixth the morph for it, given the morph now. */
export function pkP(x,y,z,P,R,R1,R2,m){
  var qx,qy,qz,t,c,s,r,d=1e5,W,f;
  out[3]=0;out[4]=0;out[5]=m;
  if(packing<1){
    cS=1;cW=1e5;
    out[0]=Math.abs(md(x+.5*P,2*P)-P)-.5*P;out[1]=Math.abs(md(y+.5*P,2*P)-P)-.5*P;out[2]=Math.abs(md(z+.5*P,2*P)-P)-.5*P;
    return out;
  }
  at[0]=x;at[1]=y;at[2]=z;atP=P;
  if(packing<4){
    box(x,y,z,P,own);
    V[0]=x-own[0];V[1]=y-own[1];V[2]=z-own[2];cR=own[3];cW=own[4];cE=own[5];cA=0;cT1=own[6];cT2=own[7];cK=own[12];cF=own[13];
  }else if(packing===4)cW=helix(x,y,z,P);
  else if(packing===5){
    W=SH_W*P;qx=md(x+W/2,W)-W/2;qy=md(y+W/2,W)-W/2;qz=md(z+W/2,W)-W/2;
    cW=Math.min(cage(qx,qy,qz,P,true),W/2-Math.max(Math.abs(qx),Math.abs(qy),Math.abs(qz))+(SH_W/2-1-CG_B-.02)*P);
  }else cW=cage(x,y,z,P,false);
  if(cK===1&&R1)R=R1;else if(cK===2&&R2)R=R2;
  s=cS=cR/R;out[4]=cK;out[5]=pkMo(m,cF);
  if(!cE){
    qx=V[0];qy=V[1];qz=V[2];
    c=Math.cos(cA);f=Math.sin(cA);t=c*qx-f*qy;qy=f*qx+c*qy;qx=t;
    c=Math.cos(cT1);f=Math.sin(cT1);t=c*qx-f*qz;qz=f*qx+c*qz;qx=t;
    c=Math.cos(cT2);f=Math.sin(cT2);t=c*qy-f*qz;qz=f*qy+c*qz;qy=t;
    qx/=s;qy/=s;qz/=s;r=Math.hypot(qx,qy,qz);
    out[0]=qx;out[1]=qy;out[2]=qz;
    if(r<=PK_FAR*R)return out;
    d=s*(r-R);
  }
  out[3]=d<=cW?d:packing>3?cW:pkPlain?Math.min(d,pkAcross()):pkWide(d);
  return out;
}
/* A world's distance within a copy, put back in the world's size. */
export function pkD(d){
  d*=cS;
  if(packing<1||d<=cW)return d;
  return (pkPlain||packing>3)?cW:pkWide(d);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={PACKINGS, PK_DEEP, PK_N, PK_FILL, PK_GAP, PK_SPLIT0, PK_SPLIT1, PK_EMPTY, PK_FAR, PK_LAG, HX_W, HX_N, HX_H, HX_R, HX_B, CG_B, CG_IN, CG_OUT, CG_CUT, SH_W, SH_TW, SH_LAG, DP_IN, PACK_GLSL,
  setPackingNow, setPkPlain, setPkWave, setPkMix, pkTick, pkMw, pkMo, pkOn, pkDeep, pkPer, pkMul, pkZoom, pkJump, pkm, pkh, pkBox:box, pkAcross, pkWide, pkHelix:helix, pkCage:cage, pkP, pkD,
  get packing(){return packing}, get pkPlain(){return pkPlain}, get pkWave(){return pkWave}, get pkMix(){return pkMix}};
