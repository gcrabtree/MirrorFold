/* The scene shader and the post-processing shaders. */
import { STEPS, isTouch } from "./dom.js";
import { PACK_GLSL } from "./packing.js";
import { RB_N, RB_OWN, RB_PEER } from "./ribbons.js";
import { IN_STEP, packSrc } from "./worlds.js";
import { REF_W, ZBAIL } from "./zoom.js";

export const VS="attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}";
export let chrome=false; /* the programs are being made with the chrome surface in them (see setChrome) */
/* The chrome surface follows a second ray from every surface, which makes a world's program larger and slower to make.
   So it is left out of the programs unless it is in use: js/choose.js keeps a set of programs for each way. */
export function setChrome(on){chrome=!!on;}
export let shafts=false; /* the programs are being made with the light shafts in them (see setShafts) */
/* The light shafts ask the world's distance up to thirty more times for every pixel, so they too are in the programs only while in use. */
export function setShafts(on){shafts=!!on;}
export function fragSource(w){
  return [
"precision highp float;",
"#define STEPS "+STEPS,
"#define MAXD "+w.maxd.toFixed(1),
"#define FOG "+w.fog.toFixed(3),
(w.flat?"#define FLAT":w.volume?"#define VOLUME":"#define SURFACE"),
"#define VSTEPS "+(isTouch?44:56),
"#define RSTEPS "+(isTouch?28:40),
(chrome&&!w.flat&&!w.volume?"#define CHROME":""),
(shafts&&!w.flat&&!w.volume?"#define SHAFTS":""),
"#define SC "+(w.packs?"uPkZ":"1.0"), /* the descent stretches the reach and the fog as the camera goes in (js/packing.js) */
"#define SP "+(w.packs?"(uPk>5.5?pkQ:p)":"p"), /* the place a surface's pattern is worked out from: in the descent, the place within the copy, so that the pattern is the same when the camera is moved out */
"uniform vec2 uRes;uniform float uTime,uSeg,uM,uHue,uSpin,uFade,uPix,uFov,uBeat,uMid,uHi;uniform vec4 uOrb,uVr,uSpark,uMc;uniform vec3 uLn;uniform vec3 uPa,uPb,uPc,uPd;uniform vec3 uPos;uniform mat3 uCam;uniform sampler2D uLandT;uniform float uLandOn;uniform vec2 uJit;",
"uniform sampler2D uVid;uniform vec4 uVidK;uniform vec3 uVidS;", /* the video: uVidK = which way it is shown (0 for none), its strength, and the scale that fits it to the screen */
"vec3 vidLin(vec2 q){vec3 c=texture2D(uVid,q).rgb;return c*c;}", /* the video is stored ready for a screen; the scene works in light, and is made ready for the screen at the end */
"vec3 vidAt(vec2 q){return vidLin(abs(fract(q*0.5)*2.0-1.0));}", /* repeating, each copy the mirror of its neighbour */
"vec3 vidScr(){return vidLin((gl_FragCoord.xy/uRes-0.5)*uVidK.zw+0.5);}", /* flat on the screen */
"vec4 orb;",
/* Surface grain: the rings of a tree. The grain is worked out from a place in space, not laid on a surface, so a shape shows rings where it is cut
   across and long stripes where it is cut along, as if carved from a block. q is the place turned into angles that go
   round a whole number of times in the world's period, and everything below is made of sines and cosines of whole
   multiples of them, so the grain repeats exactly where the world does. One trunk runs along z through each two units
   or so; woodAt gives how dark the wood is at q, from 0 (the pale wood of spring) to 1 (the dark line that ends a year).
   The rings' waves move: they drift slowly with the clock, grow with the middle of the sound, and the rings step
   outward a third of a ring on the beat. Hold still gives the scene no clock and no sound, so they stand still for it. */
"uniform float uSurf;uniform vec3 uPer;",
/* For the surfaces made of blocks (dots, tiles, wire, cells): how many blocks fit the world's period along each axis,
   a whole number, at about k blocks to a unit, so that the pattern repeats where the world does; and a chance number,
   or three, for a block. Blocks are counted round the period (mod) before the chance is taken, so the block one period
   on gets the same. JavaScript has no copy of these, so a sine hash will do. */
"vec3 sfN(float k){return max(floor(uPer*k+0.5),1.0);}",
"float sfH(vec3 c){return fract(sin(dot(c,vec3(127.1,311.7,74.7)))*43758.5453);}",
"vec3 sfH3(vec3 c){return fract(sin(vec3(dot(c,vec3(127.1,311.7,74.7)),dot(c,vec3(269.5,183.3,246.1)),dot(c,vec3(113.5,271.9,124.6))))*43758.5453);}",
"float woodAt(vec3 q){",
"  float w=0.5*sin(q.z+1.3*sin(2.0*q.x+q.y+0.21*uTime)+0.13*uTime)+0.3*sin(2.0*q.z+3.0*q.y+1.0-0.17*uTime)+0.15*sin(5.0*q.x-3.0*q.z+0.11*uTime);",
"  float g=fract(10.0*sqrt(2.02-cos(q.x+0.15*sin(q.z))-cos(q.y+0.15*cos(q.z)))+(0.9+1.6*uMid)*w-0.35*uBeat);",
"  return g*g*g*(1.0-smoothstep(0.9,1.0,g));",
"}"
  ].concat(w.flat||w.volume?[]:["#define map map0"],w.packs?PACK_GLSL.concat(packSrc(w)):w.glsl,w.flat||w.volume?[]:[
/* Inside out (js/worlds.js): the world's own distance is map0, and with uInv above nothing the picture is drawn from
   the shell less that distance, taken a little short: open space where the shapes were, walls where the open space was. */
"#undef map",
"uniform float uInv;",
"float map(vec3 p){float d=map0(p);return uInv>0.0?(uInv-max(d,0.0))*"+IN_STEP.toFixed(2)+":d;}"],[
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
/* A sprite: a small dot of light at o.xyz of size o.w, seen along the ray if nothing is in front of it: a disc with a
   faint halo, a times as strong, in the palette's own colour at hue, so it changes with the palette and drifts with it. There are eight (NFLIT in js/flits.js; a test holds the two
   equal), each named by a fixed number below, since a shader here may not pick from a list by a number worked out as
   it runs. */
"uniform vec4 uFl[8];uniform float uFlA[8];",
"vec3 flit(vec4 o,float a,vec3 ro,vec3 rd,float tmax,float hue){",
"  vec3 oc=o.xyz-ro;float tc=dot(oc,rd);",
"  if(tc<=0.0||tc>=tmax)return vec3(0.0);",
"  float R2=o.w*o.w;float d2=max(dot(oc,oc)-tc*tc,0.0);",
"  return pal(uHue+hue)*((1.0-smoothstep(R2*0.5,R2,d2))*0.95+exp(-d2/(R2*6.0))*0.25)*a;",
"}",
/* Someone flying with you (js/together.js): a ring of light with a dot at its middle and a faint halo, at o.xyz and of
   size o.w, in the palette's colour at hue, seen along the ray if nothing is in front of it. There are three (TG_MAX;
   a test holds the two equal). */
"uniform vec4 uPe[3];",
/* A doorway (js/doors.js): a ring at uDoor.xyz of size uDoor.w (0 for none) facing uDoorN, with the picture of another
   world, uDoorT, showing inside it. That picture is this same shader run for the other world, which is told where the
   ring stands in it (uDoorC.xyz, with uDoorC.w 1) and draws nothing nearer than the ring. */
"uniform vec4 uDoor,uDoorC;uniform vec3 uDoorN;uniform sampler2D uDoorT;",
/* Lens blur (js/still.js): uLens.xy is where on the lens this frame's rays start, across and up from its middle, and
   uLens.z how far ahead the picture is sharp (0 for no lens). Every ray still passes through the same point at that
   depth, so what is there stays sharp, and what is nearer or further lands in a different place each frame. */
"uniform vec3 uLens;",
"uniform float uExp;", /* photo mode's Brightness: what the light is multiplied by before it is made ready for the screen */
/* The light wave (js/lightwave.js): uLwR is how far out each of three bands of light is (0 for none), and uLwA how brightly each shows. */
"uniform vec3 uLwR,uLwA;",
/* Light shafts (js/choose.js): the open space is given a faint haze that is lit only where the way toward the light is
   clear, so the gaps between shapes show as beams. uSh = how strong, how far toward the light to look, and how far
   along the ray the haze reaches. The light comes from one fixed direction in the world, so the beams stay put as the
   view turns. */
"uniform vec3 uSh;",
/* Ribbons (js/ribbons.js): lines of light through the points uRb, as wide as uRbW (0 for none), seen along the ray if
   nothing is in front. A point's fourth number is how brightly the line shows from it to the next; below nothing, the
   line stops there. The first RB_OWN points are the camera's ribbon, then RB_PEER for each friend, in the friend's own
   colour. A line is never thinner than a pixel, and fades out close to the eye. */
"uniform vec4 uRb["+RB_N+"];uniform float uRbW;",
"vec3 ribbons(vec3 ro,vec3 rd,float tmax){",
"  vec3 c=vec3(0.0);",
"  for(int i=0;i<"+(RB_N-1)+";i++){",
"    vec4 A=uRb[i];vec4 B=uRb[i+1];",
"    if(A.w<=0.0||B.w==0.0)continue;",
"    vec3 ba=B.xyz-A.xyz;vec3 oa=ro-A.xyz;",
"    float baba=dot(ba,ba),bard=dot(ba,rd),baoa=dot(ba,oa),rdoa=dot(rd,oa);",
"    float s=clamp((baoa-rdoa*bard)/max(baba-bard*bard,1e-9),0.0,1.0);", /* the place along the line that the ray passes nearest */
"    float t=s*bard-rdoa;",
"    if(t<=0.0||t>=tmax)continue;",
"    vec3 q=oa+rd*t-ba*s;float R=max(uRbW,1.2*uPix*t);float R2=R*R;float d2=dot(q,q);",
"    float fi=float(i);float hue=fi<"+RB_OWN.toFixed(1)+"?0.55:0.10+0.33*floor((fi-"+RB_OWN.toFixed(1)+")/"+RB_PEER.toFixed(1)+");",
"    float b=mix(A.w,abs(B.w),s)*smoothstep(6.0*uRbW,30.0*uRbW,t)*min(1.0,uRbW/R);", /* thinner than a pixel, it is drawn a pixel wide and fainter */
"    c+=mix(vec3(1.0),pal(uHue+hue+0.2*b),0.6)*((1.0-smoothstep(0.3*R2,R2,d2))*0.8+exp(-d2/(R2*10.0))*0.3)*b;",
"  }",
"  return c*(1.0+0.3*uBeat);",
"}",
"vec3 friend(vec4 o,vec3 ro,vec3 rd,float tmax,float hue){",
"  vec3 oc=o.xyz-ro;float tc=dot(oc,rd);",
"  if(tc<=0.0||tc>=tmax)return vec3(0.0);",
"  float x=max(dot(oc,oc)-tc*tc,0.0)/(o.w*o.w);",
"  return pal(uHue+hue)*(smoothstep(0.35,0.55,x)*(1.0-smoothstep(0.8,1.0,x))*0.95+(1.0-smoothstep(0.02,0.07,x))*0.9+exp(-x/5.0)*0.2);",
"}",
/* a glowing ball at o.xyz of size o.w, seen along the ray, if nothing is in front of it: a bright core and a soft halo in a palette colour */
"vec3 ball(vec4 o,vec3 ro,vec3 rd,float tmax,float hue){",
"  vec3 oc=o.xyz-ro;float tc=dot(oc,rd);",
"  if(tc<=0.0||tc>=tmax)return vec3(0.0);",
"  float R2=o.w*o.w;float d2=max(dot(oc,oc)-tc*tc,0.0);",
"  float core=1.0-smoothstep(R2*0.3,R2,d2);",
"  float halo=exp(-d2/(R2*14.0))*0.55+exp(-d2/(R2*120.0))*0.18;",
"  return vec3(core)+mix(vec3(1.0),pal(uHue+hue),0.6)*halo;",
"}",
].concat(w.flat?[
/* A zoom world: the Mandelbrot set or a Julia set, flat. Each pixel is followed only as its difference dz from a
   reference path worked out in JavaScript (js/zoom.js), because the shader's own numbers run out of digits a few
   thousand times in. uZ = the view's size, the cosine and sine of its turn, and 1 for a Julia set. uZn = how long the
   two reference paths are, and how many steps to take. When a pixel comes nearer to zero than its own difference, or
   its path runs out, it carries on against the path that starts from zero (row 1), where the difference is the point itself. */
"uniform sampler2D uRef;uniform vec4 uZ;uniform vec3 uZn;uniform vec2 uZo,uZs;",
"vec2 refAt(float i,float row){return texture2D(uRef,vec2((i+0.5)/"+REF_W.toFixed(1)+",0.25+0.5*row)).xy;}",
"vec3 zoomCol(vec2 uv){",
"  vec2 d0=(vec2(uZ.y*uv.x-uZ.z*uv.y,uZ.z*uv.x+uZ.y*uv.y)+uZo)*uZ.x;", /* uZo: how far the picture's middle is from the reference point, in units of the view's size */
"  vec2 dz=uZ.w>0.5?d0:vec2(0.0),dc=uZ.w>0.5?vec2(0.0):d0;",
"  float ri=0.0,row=0.0,len=uZn.x,n=0.0,m=0.0,esc=0.0,near=1e9,nearI=0.0,sa=0.0,sl=0.0;",
"  vec2 Z=refAt(0.0,0.0),w=Z+dz;",
/* dr is how fast the point's value changes as the pixel moves, in units of the view's size. It gives the distance to
   the set, which is used to fade the patterns out where they would be finer than a pixel. */
"  vec2 dr=uZ.w>0.5?vec2(uZ.x,0.0):vec2(0.0),ds=uZ.w>0.5?vec2(0.0):vec2(uZ.x,0.0);",
"  for(int i=0;i<"+(isTouch?384:REF_W)+";i++){",
"    if(float(i)>=uZn.z)break;",
"    if(dot(w,w)<dot(dz,dz)||ri>=len-1.0){dz=w;ri=0.0;row=1.0;len=uZn.y;Z=vec2(0.0);}",
"    if(dot(dr,dr)<1e30)dr=2.0*vec2(w.x*dr.x-w.y*dr.y,w.x*dr.y+w.y*dr.x)+ds;",
"    dz=2.0*vec2(Z.x*dz.x-Z.y*dz.y,Z.x*dz.y+Z.y*dz.x)+vec2(dz.x*dz.x-dz.y*dz.y,2.0*dz.x*dz.y)+dc;",
"    ri+=1.0;Z=refAt(ri,row);w=Z+dz;m=dot(w,w);n+=1.0;",
"    if(m<near){near=m;nearI=n;}", /* the nearest the path comes to zero, and at which step */
"    sl=0.5+2.0*w.x*w.y*(w.x*w.x-w.y*w.y)/max(m*m,1e-30);sa+=sl;", /* sin of four times the path's angle, without working out the angle */
"    if(m>"+ZBAIL.toFixed(1)+"){esc=1.0;break;}",
"  }",
/* uZs is how much of each pattern to show: cells, stripes. Both are read off the path the point took. */
"  float wc=uZs.x,ws=uZs.y;",
"  if(esc<0.5){", /* never left: inside the set. Coloured by which step came nearest zero (it follows the period of each bulb) and ringed by how near it came. */
"    float q=sqrt(min(near,1.0));",
"    return pal(uHue+0.6+0.13*nearI)*(0.10+0.30*(0.5+0.5*cos(18.0*q))*q);",
"  }",
"  float f=1.0-log2(log2(m)/"+Math.log2(ZBAIL).toFixed(1)+");", /* how far between one step count and the next, 0 to 1 */
"  float sn=n+f-1.0;", /* the step count, made smooth between one step and the next */
"  float x=0.30*sqrt(max(sn,0.0))+0.06*uM;",
"  vec3 c=pal(uHue+x)*(0.62+0.38*cos(6.2831853*(x*3.0+0.25)));", /* the palette, with a finer band of light and dark across it */
"  c=c*(0.20+0.55*c);",
"  float de=0.5*sqrt(m/max(dot(dr,dr),1e-30))*log(m);", /* distance to the set, in units of the view's size */
"  float k=smoothstep(0.004,0.045,de);", /* the patterns fade out near the set, where they would be finer than a pixel */
/* cells: each step count is a ring, and each ring is cut where the path ended above or below the axis. The cells halve in width with every ring. */
"  float th=atan(w.y,w.x);",
"  float edge=min(abs(sin(th))*1.6,min(f,1.0-f)*2.0);",
"  float cell=(w.y>0.0?1.0:0.72)*(0.55+0.45*smoothstep(0.0,0.14,edge));",
"  c*=mix(1.0,cell*1.15,k*wc);",
/* stripes: the average over the whole path of a wave of its angle, smoothed between step counts. It runs along the lines a point would follow out from the set. */
"  float av=mix((sa-sl)/max(n-1.0,1.0),sa/n,f);",
"  c*=mix(1.0,0.35+1.5*smoothstep(0.25,0.75,av),k*ws);",
"  return c*(1.0+0.5*uBeat)+pal(uHue+0.3)*0.2*uMid*exp(-0.02*sn);",
"}"]:[],[
"void main(){",
"  if(uLandOn>0.5&&texture2D(uLandT,gl_FragCoord.xy/uRes).a>(uVr.x>0.5?0.3:0.995)){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}", /* the land covers this pixel: nothing to draw */
"  vec2 fc=gl_FragCoord.xy+uJit;", /* Hold still shifts the rays by part of a pixel, a different part each frame, and the frames are averaged */
"  vec2 uv=(2.0*fc-uRes)/sqrt(uRes.x*uRes.y);",
"  vec2 eo=vec2(0.0);float fov=uFov;",
"  if(uVr.x>0.5){", /* VR viewer: one picture per eye, side by side. uVr = on, lens centre offset in pixels, tangent per pixel, half the eye spacing */
"    float sd=gl_FragCoord.x<0.5*uRes.x?-1.0:1.0;",
"    vec2 q=(fc-vec2(0.5*uRes.x+sd*uVr.y,0.5*uRes.y+uLn.z))*uVr.z;", /* uLn: the lens's two numbers (0.34 and 0.55 for the viewer's lens; nothing for a headset, which bends the picture itself) and how far above the middle the eye looks straight ahead, in pixels */
"    float q2=dot(q,q);",
"    uv=q*(1.0+uLn.x*q2+uLn.y*q2*q2);", /* bend each ray the way the viewer's lens will, so straight lines look straight through it */
"    if(dot(uv,uv)>3.24){gl_FragColor=vec4(0.0);return;}", /* outside what the lens shows */
"    eo=vec2(sd*uVr.w,0.0);fov=1.0;",
"  }",
"  float r=length(uv);",
"  if(uSeg>0.5){",
"    float seg=6.2831853/uSeg;",
"    float a0=atan(uv.y,uv.x)+uSpin;float kq=floor(a0/seg);",
"    float a=a0-kq*seg-0.5*seg;float ta=uSpin-kq*seg-0.5*seg;",
"    if(a<0.0){ta=-ta;eo.y=-eo.y;}", /* the eye position gets the same turn or flip as the ray, so both eyes see one mirrored scene */
"    eo=vec2(cos(ta)*eo.x-sin(ta)*eo.y,sin(ta)*eo.x+cos(ta)*eo.y);",
"    a=abs(a);",
"    uv=r*vec2(cos(a),sin(a));",
"  }",
"  vec3 ro=uPos+uCam*vec3(eo,0.0);",
"  float tmax=1e9;",
"  float thru=0.0;", /* how much of this pixel is the world seen through a doorway */
"  float eta=0.0;", /* VR viewer: how far apart the two eyes see this point, as half the difference of their angles' tangents; 0 for the far distance */
"#ifdef FLAT",
"  vec3 col=zoomCol(uv);",
"#else",
"#ifdef VOLUME",
"  vec3 rd=normalize(uCam*vec3(uv,fov));",
"  if(uLens.z>0.0){ro+=uCam*vec3(uLens.xy,0.0);rd=normalize(uCam*(vec3(uv,fov)*(uLens.z/fov)-vec3(uLens.xy,0.0)));}", /* lens blur: the ray starts off the lens's middle and is aimed through the same point at the sharp depth */
"  vec3 col=vec3(0.0);",
"  float t=0.04+VSTEP*fract(52.9829189*fract(dot(fc,vec2(0.06711056,0.00583715)))+0.4*fract(sin(dot(fc,vec2(12.9898,78.233)))*43758.5453));", /* each ray starts a different part of one step in, so the steps show as fine grain and not as layers (an even pattern, roughened a little so that it does not show as hatching); Hold still moves fc, and the grain averages away */
"  float fall=1.0;",
"  for(int i=0;i<VSTEPS;i++){",
"    float a=dens(ro+rd*t);",
"    a=VMAP(a);",
"    col+=(pal(uHue+t*0.22+a*0.3)*a+vec3(0.0009)*fall)*fall;",
"    fall*=0.93;t+=VSTEP;",
"  }",
"  col*=0.9+0.5*uBeat;",
"#else",
"  vec3 rd=normalize(uCam*vec3(uv,fov));",
"  if(uLens.z>0.0){ro+=uCam*vec3(uLens.xy,0.0);rd=normalize(uCam*(vec3(uv,fov)*(uLens.z/fov)-vec3(uLens.xy,0.0)));}", /* lens blur: the ray starts off the lens's middle and is aimed through the same point at the sharp depth */
"  float t=0.002*SC;float d=0.0;float steps=0.0;float hit=0.0;",
"  if(uDoorC.w>0.5){float cn=dot(rd,uDoorN);float ct=dot(uDoorC.xyz-ro,uDoorN)/(abs(cn)<1e-5?1e-5:cn);if(ct>0.0)t=max(t,ct);}", /* seen through a doorway: the ray starts at the ring */
"  for(int i=0;i<STEPS;i++){",
"    d=map(ro+rd*t);",
"    if(d<0.45*uPix*t){hit=1.0;break;}",
"    if(t>MAXD*SC)break;",
"    t+=d;steps+=1.0;",
"  }",
"  float gw=steps/float(STEPS);",
"  if(hit>0.5){tmax=t;eta=uVr.w*sqrt(1.0+dot(uv,uv))/t;}", /* half the eye spacing over the depth along the way the head faces */
"  vec3 fogc=pal(uHue+0.5)*0.015;",
"  if(uVidK.x>2.5&&uVidK.x<3.5)fogc=mix(fogc,vidScr()*0.7,uVidK.y);", /* video in the distance: it takes the place of the dark that far things fade into */
"  vec3 col=fogc;",
"  if(hit>0.5){",
"    vec3 p=ro+rd*t;",
"    map(p);vec4 tr=orb;vec3 sp=SP;",
"    if(uInv>0.0)tr=tr/(1.0+abs(tr));", /* inside out, the walls stand away from the shapes, where a world's colour measures can run to large numbers: they are held between -1 and 1, or the colours come as rings too fine to see */
"    float e=0.8*uPix*t+0.00005*SC;vec2 k=vec2(1.0,-1.0);",
"    vec3 n=normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));",
"    float nd=abs(dot(n,rd));",
"    if(dot(n,rd)>0.0)n=-n;",
"    vec3 l=normalize(uCam*vec3(-0.5,0.7,-0.5));",
"    float dif=max(dot(n,l),0.0);",
"    float spec=pow(max(dot(reflect(rd,n),l),0.0),28.0);",
"    float fres=pow(1.0-nd,3.0);",
"    vec3 base=pal(uHue+tr.w*0.8+0.25*tr.x);",
"    base=mix(base,pal(uHue+0.35+tr.y*1.5),0.5*clamp(tr.z*2.0,0.0,1.0));",
"    float wood=0.0,quiet=0.0,shine=1.0;vec3 glow=vec3(0.0);", /* for the surfaces: grain's dulling, how far the glowing bands are turned down, how much the highlight is turned up, and light the surface gives off */
"    if(uSurf>0.5&&uSurf<1.5){", /* the grain: each ring runs through half the palette from pale wood to dark line, and the line is darkened too; rings too fine for a pixel fade to their average, so far wood does not sparkle */
"      wood=1.0;vec3 wm=max(floor(uPer*0.5+0.5),1.0)*6.28318/uPer;vec3 wq=sp*wm;",
"      float sharp=clamp(0.016/(uPix*t),0.0,1.0);",
"      float wd=woodAt(wq);vec3 we=wm*0.004;",
"      vec3 wg=vec3(woodAt(wq+vec3(we.x,0.0,0.0)),woodAt(wq+vec3(0.0,we.y,0.0)),woodAt(wq+vec3(0.0,0.0,we.z)))-wd;",
"      n=normalize(n-0.35*sharp*(wg-n*dot(wg,n)));", /* the dark lines stand a little proud, as on sanded wood */
"      float fib=(sin(97.0*wq.x+31.0*wq.y+sin(wq.z))+sin(89.0*wq.y-41.0*wq.x-sin(2.0*wq.z))+sin(67.0*wq.x-71.0*wq.y))*0.4*clamp(0.003/(uPix*t)-0.3,0.0,1.0);", /* fine fibres along the trunk: three sets of waves across it that do not line up, so they show as specks on a cut end and streaks along a side, and only close to */
"      wd=mix(0.22,wd,sharp);",
"      base=pal(uHue+0.12*tr.w+0.5*wd)*(1.0-0.5*wd)*(1.0+0.14*fib)*(0.8+0.3*clamp(tr.x,0.0,1.0));",
"    }else if(uSurf>1.5&&uSurf<2.5){", /* dots: balls set through space in two grids, one in the gaps of the other; where a surface cuts one there is a round dot in the palette's opposite colour with a dark border. The balls grow on the beat. */
"      vec3 sn=sfN(6.0);vec3 su=sp*sn/uPer+0.37;float sa=1.5*uPix*t*sn.x/uPer.x+0.01;",
"      float sd=min(length(fract(su)-0.5),length(fract(su+0.5)-0.5));float sr=0.25+0.12*uBeat;",
"      vec3 dc=pal(uHue+0.5+0.12*tr.w);", /* a dark border first, out to the ball's edge, then the dot's own colour inside it */
"      base=mix(base,dc*0.1,1.0-smoothstep(sr-sa,sr+sa,sd));base=mix(base,dc,1.0-smoothstep(sr-0.07-sa,sr-0.07+sa,sd));quiet=0.7;",
"    }else if(uSurf>2.5&&uSurf<3.5){", /* tiles: space cut into blocks, each its own shade of the palette, with dark joints where a surface crosses from one block to the next (not counting the axis the surface faces, or a whole face would be joint). Some tiles light up, more with the high notes. */
"      vec3 sn=sfN(3.0);vec3 su=sp*sn/uPer+0.37;vec3 sc=floor(su);vec3 sf=su-sc;float sa=uPix*t*sn.x/uPer.x;",
"      vec3 se=min(sf,1.0-sf)+step(0.7,abs(n));float sg=smoothstep(0.03,0.05+2.0*sa,min(se.x,min(se.y,se.z)));",
"      float sh=sfH(mod(sc+0.5,sn));",
"      base=pal(uHue+0.1*tr.w+0.45*sh)*(0.75+0.25*fract(sh*7.3))*(0.25+0.75*sg);",
"      glow=pal(uHue+0.5+sh)*smoothstep(0.6,1.0,0.5+0.5*sin(6.28318*sh*17.0+0.7*uTime))*sg*(0.12+1.2*uHi);quiet=1.0;",
"    }else if(uSurf>3.5&&uSurf<4.5){", /* marble: pale stone tinted by the palette, with dark veins where a wave, pushed about by slower waves, crosses zero. The veins drift, wander further with the middle of the sound and thicken on the beat. */
"      vec3 sq=sp*max(floor(uPer*0.5+0.5),1.0)*6.28318/uPer;",
"      float tb=sin(2.0*sq.y+1.7*sin(sq.z+2.0*sq.x)+0.1*uTime)+0.5*sin(4.0*sq.z+3.0*sq.x+2.0*sin(3.0*sq.y)-0.13*uTime)+0.25*sin(8.0*sq.x-5.0*sq.y+3.0*sin(2.0*sq.z));",
"      float vein=pow(1.0-abs(sin(3.0*sq.x+sq.z+(2.2+1.5*uMid)*tb)),6.0-3.5*uBeat);",
"      vein=mix(0.18,vein,clamp(0.016/(uPix*t),0.0,1.0));",
"      base=mix(mix(vec3(0.8),base,0.3),pal(uHue+0.5+0.12*tr.w)*0.3,vein);quiet=1.0;",
"    }else if(uSurf>4.5&&uSurf<5.5){", /* wire: the surface goes dark and the joints of a finer set of blocks glow in the palette's colour, with a slow wave of light running along them. The lines thicken with the middle of the sound and brighten on the beat. */
"      vec3 sn=sfN(5.0);vec3 sf=fract(sp*sn/uPer+0.37);float sa=uPix*t*sn.x/uPer.x;",
"      vec3 se=min(sf,1.0-sf)+step(0.7,abs(n));float sw=0.03+0.03*uMid;",
"      float ln=(1.0-smoothstep(sw,sw+0.02+2.0*sa,min(se.x,min(se.y,se.z))))*0.05/(0.05+3.0*sa);",
"      vec3 sq=sp*max(floor(uPer*0.5+0.5),1.0)*6.28318/uPer;",
"      base*=0.1;glow=pal(uHue+0.5+0.15*tr.w)*ln*(0.55+0.45*sin(sq.x+sq.y+sq.z-1.5*uTime))*(0.7+uBeat);quiet=1.0;",
"    }else if(uSurf>5.5&&uSurf<6.5){", /* cells: a point is put by chance in every block, and each place belongs to the nearest point; each cell has its own colour of the palette and a dark edge. The edges widen on the beat and the cells brighten in turn with the middle of the sound. */
"      vec3 sn=sfN(3.0);vec3 su=sp*sn/uPer+0.37;vec3 sc=floor(su);vec3 sf=su-sc;float sa=uPix*t*sn.x/uPer.x;",
"      float f1=9.0,f2=9.0,id=0.0;",
"      for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)for(int m=-1;m<=1;m++){",
"        vec3 so=vec3(float(i),float(j),float(m));vec3 hh=sfH3(mod(sc+so+0.5,sn));float sd=length(so+hh-sf);",
"        if(sd<f1){f2=f1;f1=sd;id=hh.x;}else if(sd<f2)f2=sd;",
"      }",
"      float edge=smoothstep(0.03+0.06*uBeat,0.06+0.06*uBeat+2.0*sa,f2-f1);",
"      base=pal(uHue+0.1*tr.w+0.5*id)*(0.3+0.7*edge)*(0.8+0.5*uMid*(0.5+0.5*sin(6.28318*id*9.0+uTime)));quiet=1.0;",
"    }else if(uSurf>8.5){", /* ribbed: fine ridges run across the surface like the rings of a hose, wavering a little, with a wider swell under them; the colour is mostly taken out, so the surface reads as dull metal or bone, and it shines */
"      vec3 rm=max(floor(uPer*0.5+0.5),1.0)*6.28318/uPer;vec3 rq=sp*rm;",
"      float sharp=clamp(0.02/(uPix*t),0.0,1.0);",
"      float ra=24.0*rq.z+8.0*rq.x+8.0*rq.y+1.5*sin(2.0*rq.x-rq.y)+1.5*sin(2.0*rq.y+rq.z);",
"      float rv=0.5+0.5*sin(ra);float rc=cos(ra);",
"      vec3 rg=rc*(vec3(8.0,8.0,24.0)+1.5*cos(2.0*rq.x-rq.y)*vec3(2.0,-1.0,0.0)+1.5*cos(2.0*rq.y+rq.z)*vec3(0.0,2.0,1.0))*rm;", /* which way the ridges rise, for tilting the surface */
"      n=normalize(n-0.012*sharp*(rg-n*dot(rg,n)));",
"      rv=mix(0.5,rv,sharp);float sw=0.5+0.5*sin(3.0*rq.x+2.0*rq.y+rq.z+0.6*uMid);",
"      vec3 rb=base*(0.5+0.6*rv)*(0.75+0.25*sw);",
"      base=mix(vec3(dot(rb,vec3(0.299,0.587,0.114))),rb,0.4);shine=2.4;quiet=0.9;",
"    }else if(uSurf>6.5&&uSurf<7.5){", /* pearl: the colour comes from the way the surface faces and how squarely it is seen, not from where it is, so it slides over a shape as you pass, like oil on water. It shifts with the middle of the sound. */
"      base=mix(vec3(0.7),pal(uHue+1.3*(1.0-nd)+0.5*dot(n,vec3(0.36,0.80,0.48))+0.2*tr.w+0.3*uMid+0.03*uTime),0.7);shine=2.2;quiet=0.6;",
"    }",
"#ifdef CHROME",
/* chrome: a second ray is followed from the surface the way a mirror would send it, and what it meets is shown in the
   surface: the shape it hits in its own colours, darker in the folds and faded by the distance, or the dark of the
   distance. The metal itself is dark and tinted by the palette, and shines more at a glancing angle. */
"    if(uSurf>7.5&&uSurf<8.5){",
"      vec3 rr=reflect(rd,n);vec3 rp=p+n*(3.0*e);float rt=4.0*e;float rs=0.0;float rh=0.0;float rd2=0.0;",
"      for(int i=0;i<RSTEPS;i++){",
"        rd2=map(rp+rr*rt);",
"        if(rd2<0.9*uPix*(t+rt)){rh=1.0;break;}",
"        if(rt>0.6*MAXD*SC)break;",
"        rt+=rd2;rs+=1.0;",
"      }",
"      float rg=rs/float(RSTEPS);vec3 rc=fogc+pal(uHue+0.5+0.3*rr.y)*0.07;", /* a ray that meets nothing shows a little of the palette, so chrome is not black in open space */
"      if(rh>0.5){",
"        vec3 rb=pal(uHue+orb.w*0.8+0.25*orb.x);rb=mix(rb,pal(uHue+0.35+orb.y*1.5),0.5*clamp(orb.z*2.0,0.0,1.0));",
"        float ra=max(1.0-rg,0.0);rc=mix(fogc,rb*(0.12+0.88*ra*ra)+pal(uHue+0.5+orb.w)*0.25*uMid*ra,exp(-FOG*rt/SC));",
"      }",
"      rc+=pal(uHue+0.7)*rg*rg*rg*0.2;",
"      base=mix(base,vec3(0.5),0.5)*0.3;glow=rc*mix(vec3(1.0),pal(uHue+0.1*tr.w),0.25)*(0.75+0.6*fres);shine=2.0;quiet=1.0;",
"    }",
"#endif",
"    vec3 lx=(vec3(t)-uLwR)/max(0.18*uLwR,vec3(1e-5));", /* the light wave: a soft band about a sixth as wide as it is far out */
"    glow+=mix(vec3(1.0),pal(uHue+0.5+tr.w),0.6)*dot(uLwA,exp(-lx*lx))*0.9;",
"    float vk=0.0,lit=0.05+0.7*dif+0.4*nd*nd;", /* how much of the surface's colour is the video, and how brightly the surface is lit */
"    if(uVidK.x>0.5){",
"      if(uVidK.x<1.5){vk=uVidK.y;lit=mix(lit,0.3+0.8*lit,vk);", /* video on the surfaces: laid on from the three axes, each weighted by how squarely the surface faces it */
"        vec3 q=sp*uVidS;vec3 wt=pow(abs(n),vec3(6.0));wt/=wt.x+wt.y+wt.z;",
"        base=mix(base,vidAt(q.zy)*wt.x+vidAt(q.xz)*wt.y+vidAt(q.xy)*wt.z,uVidK.y);",
"      }else if(uVidK.x<2.5){vk=uVidK.y;lit=mix(lit,0.55+0.5*lit,vk);base=mix(base,vidScr(),vk);}", /* through the shapes: lit more evenly, so the video reads as one picture */
"      else if(uVidK.x>4.5)base=mix(base,vidAt(vec2(tr.w*1.6+0.3*tr.x,tr.y*2.0+tr.z)),uVidK.y);", /* as the colours: where the fractal's own measures say */
"    }",
"    float bands=smoothstep(0.75,1.0,0.5+0.5*sin(tr.w*24.0-uTime*1.2));",
"    float ao=max(1.0-gw,0.0);ao*=sqrt(ao);",
"    col=base*lit*ao;",
"    col+=pal(uHue+0.5+tr.w)*bands*(0.5+0.9*uMid)*ao*(1.0-vk)*(1.0-0.85*wood)*(1.0-quiet);", /* the glowing bands give way to the video, and are faint on wood */
"    col+=fres*pal(uHue+0.2+t*0.08/SC)*0.4*ao*(1.0-0.8*wood)+spec*(0.5+1.4*uHi)*ao*(1.0-0.65*wood)*shine+glow*ao*(1.0-vk);", /* wood shines less, pearl more; tiles and wire give off light */
"    col=mix(fogc,col,exp(-FOG*t/SC));",
"  }",
"  col+=pal(uHue+0.7+r*0.1)*gw*gw*gw*0.22;",
"#ifdef SHAFTS",
"  if(uSh.x>0.0){",
"    vec3 sl=normalize(vec3(0.42,0.80,0.43));float se=min(t,uSh.z);float sa=0.0;",
"    float sj=fract(52.9829189*fract(dot(fc,vec2(0.06711056,0.00583715))));", /* each ray's eight places along it start a different part of a step in, so the steps show as fine grain and not as bands; Hold still moves fc, and the grain averages away */
"    for(int i=0;i<6;i++){",
"      float st=se*(float(i)+sj)/6.0;vec3 sq=ro+rd*st;float sv=1.0;float su=0.3*uSh.y;",
"      for(int j=0;j<5;j++){", /* a short walk toward the light: the nearer anything comes to the way, the less light gets here */
"        float sd=map(sq+sl*su);sv=min(sv,5.0*sd/su);",
"        if(sv<0.01)break;",
"        su+=max(sd,0.2*uSh.y);",
"      }",
"      sa+=clamp(sv,0.0,1.0)*exp(-FOG*st/SC);",
"    }",
"    col+=mix(vec3(1.0,0.95,0.85),pal(uHue+0.12),0.5)*sa/6.0*uSh.x*(se/uSh.z)*(0.35+0.65*pow(max(dot(rd,sl),0.0),3.0));", /* brightest looking toward the light */
"  }",
"#endif",
"#endif",
"#endif",
"#ifndef FLAT",
"  if(uOrb.w>0.0)col+=ball(uOrb,ro,rd,tmax,0.15)*(0.85+0.15*sin(uTime*2.5));",
"  if(uSpark.w>0.0)col+=ball(uSpark,ro,rd,tmax,0.6);", /* the thrown light, in another of the palette's colours */
"  if(uFl[0].w>0.0)col+=flit(uFl[0],uFlA[0],ro,rd,tmax,0.30);",
"  if(uFl[1].w>0.0)col+=flit(uFl[1],uFlA[1],ro,rd,tmax,0.47);",
"  if(uFl[2].w>0.0)col+=flit(uFl[2],uFlA[2],ro,rd,tmax,0.64);",
"  if(uFl[3].w>0.0)col+=flit(uFl[3],uFlA[3],ro,rd,tmax,0.81);",
"  if(uFl[4].w>0.0)col+=flit(uFl[4],uFlA[4],ro,rd,tmax,0.98);",
"  if(uFl[5].w>0.0)col+=flit(uFl[5],uFlA[5],ro,rd,tmax,1.15);",
"  if(uFl[6].w>0.0)col+=flit(uFl[6],uFlA[6],ro,rd,tmax,1.32);",
"  if(uFl[7].w>0.0)col+=flit(uFl[7],uFlA[7],ro,rd,tmax,1.49);",
"  if(uPe[0].w>0.0)col+=friend(uPe[0],ro,rd,tmax,0.10);",
"  if(uPe[1].w>0.0)col+=friend(uPe[1],ro,rd,tmax,0.43);",
"  if(uPe[2].w>0.0)col+=friend(uPe[2],ro,rd,tmax,0.76);",
"  if(uRbW>0.0)col+=ribbons(ro,rd,tmax);",
"  if(uDoor.w>0.0){", /* the doorway, if nothing is in front of it: the other world inside, and a rim of light in the palette's colour that swells a little on the beat */
"    float dn=dot(rd,uDoorN);float td=dot(uDoor.xyz-ro,uDoorN)/(abs(dn)<1e-5?1e-5:dn);",
"    if(td>0.0&&td<tmax){",
"      vec3 dh=ro+rd*td-uDoor.xyz;float dx=dot(dh,dh)/(uDoor.w*uDoor.w);",
"      thru=1.0-smoothstep(0.84,0.9,dx);",
"      float rim=smoothstep(0.8,0.9,dx)*(1.0-smoothstep(0.95,1.0,dx));",
"      col=col*(1.0-thru)*(1.0-rim)+pal(uHue+0.3+0.4*dx)*rim*(1.1+0.5*uBeat);",
"    }",
"  }",
"#endif",
"  col*=clamp(1.0-0.16*r*r,0.35,1.0)*(1.0-uVr.x*smoothstep(1.5,1.8,r));",
"  col*=1.35*uExp;col=col/(1.0+0.2*col);",
"  float lum=dot(col,vec3(0.299,0.587,0.114));",
"  col=clamp(mix(vec3(lum),col,1.4),0.0,1.0);",
"  col=col*col*(3.0-2.0*col);",
"  col=pow(col,vec3(1.15));",
"  col=pow(col,vec3(0.4545))*uFade;",
"  if(thru>0.0)col=mix(col,texture2D(uDoorT,gl_FragCoord.xy/uRes).rgb,thru);", /* that picture is already finished, so it goes in after this one's own finishing */
"  col+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))-0.5)/255.0;", /* a fixed fine grain of half a step of brightness, so smooth dark gradients do not show as bands */
"  gl_FragColor=vec4(col,uVr.x>0.5?clamp(eta/"+VR_EMAX+",0.0,1.0):1.0);", /* VR viewer: the fourth number carries the depth, for the effects to use */
"}"])).join("\n");
}

/* The VR viewer in the effect passes. Each half of the picture is one eye's view, already bent for the lens.
   An effect must show both eyes the same thing in space, so it does not work on the screen: it works on the middle
   view, the one an eye between the two would see, and every piece of picture carries its own depth with it.
   For an eye at -1 (left) or +1 (right), a point at depth z is seen at  e = c - side*eta,  where c is where the middle
   view sees it and eta = (half the eye spacing)/z. Both are tangents of angles. The scene writes eta into the fourth
   number of each pixel (as eta/VR_EMAX). eyeOf turns a place in the picture into e for that eye's lens; texOf goes back
   (the lens is a fifth-degree curve, undone by Newton's method), kept inside that eye's half.
   VR_KAP scales tangents so that the edge of what the lens shows is about 0.5, the range the effects' numbers were made for. */
export const VR_EMAX="0.064",VR_KAP="0.55";
const VR_GLSL=[
"uniform vec4 uVrG;uniform vec2 uRes;uniform vec3 uLn;", /* uVrG: lens centre's distance from the middle in pixels, tangent per pixel */
"float sdE=-1.0;",
"vec2 eyeOf(vec2 tc){vec2 q=(tc*uRes-vec2(0.5*uRes.x+sdE*uVrG.x,0.5*uRes.y+uLn.z))*uVrG.y;float q2=dot(q,q);return q*(1.0+uLn.x*q2+uLn.y*q2*q2);}",
"vec2 texOf(vec2 e){",
"  float ru=length(e),rq=uLn.x>0.0?min(ru,1.0):ru;",
"  for(int i=0;i<4;i++){float r2=rq*rq;rq-=(rq*(1.0+uLn.x*r2+uLn.y*r2*r2)-ru)/(1.0+3.0*uLn.x*r2+5.0*uLn.y*r2*r2);}",
"  vec2 px=e*(ru>1e-6?rq/ru:1.0)/uVrG.y+vec2(0.5*uRes.x+sdE*uVrG.x,0.5*uRes.y+uLn.z);",
"  px.x=sdE<0.0?clamp(px.x,0.5,0.5*uRes.x-0.5):clamp(px.x,0.5*uRes.x+0.5,uRes.x-0.5);",
"  return px/uRes;",
"}"].join("\n");

export const FS_TRAIL=[
"precision highp float;varying vec2 v;uniform sampler2D uA,uB,uWv;",
"uniform float uDecay,uZoom,uRot,uSwirl,uWob,uRip,uTime,uAsp,uOv,uOvBeat,uOvMid,uOvHi,uShift,uOvAmt,uHue,uVr,uOvEta;const int DN=20;uniform vec4 uD0[DN],uD1[DN],uD2[DN],uD3[DN],uD4[DN],uD5[DN],uD6[DN],uD7[DN],uD8[DN],uD9[DN],uDb;uniform float uDl;uniform vec3 uDz;uniform vec2 uDrift;uniform vec3 uPa,uPb,uPc,uPd;uniform sampler2D uVid;uniform vec4 uVidK;uniform mat3 uTurn;",
VR_GLSL,
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
/* the motion: where in the last picture this place takes its trail from. c is measured from the middle, -0.5 to 0.5 */
"vec2 bend(vec2 c){",
"  c.x*=uAsp;float r=length(c);",
"  float ang=uRot+uSwirl*(0.5-r);float cs=cos(ang),sn=sin(ang);",
"  c=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y)*uZoom;",
"  c+=uWob*vec2(sin(c.y*9.0+uTime*0.7),cos(c.x*8.0-uTime*0.6));",
"  c*=1.0+uRip*sin(r*18.0-uTime*2.0);",
"  c.x/=uAsp;",
"  return c+uDrift;",
"}",
/* VR viewer: how near each part of an overlay is, as a multiple of the overlay's own depth. The ring and the scope are
   pushed nearer and farther by the sound's wave; the spectrum, spokes, rings and spiral are a cone, far at the middle
   and near at the rim, so rings that spread come toward the viewer. */
/* how far a place is from the line between two others: the dancers are drawn with it */
"float limb(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0));}",
"float ovDepth(vec2 d){",
"  float am=abs(atan(d.y,d.x)/3.14159265);",
"  if(uOv<1.5)return 1.0+0.5*(texture2D(uWv,vec2(am*0.98+0.01,0.5)).r*2.0-1.0);",
"  if(uOv<2.5)return 1.0+0.5*(texture2D(uWv,vec2(abs(2.0*d.x)*0.98+0.01,0.5)).r*2.0-1.0);",
"  if(uOv<6.5)return 0.3+2.0*min(length(d),0.7);",
"  return 1.0;",
"}",
"void main(){",
"  vec4 sa=texture2D(uA,v);vec3 s=sa.rgb;float oa=1.0;",
"  vec3 vs=uVidK.x>3.5&&uVidK.x<4.5?texture2D(uVid,(v-0.5)*uVidK.zw+0.5).rgb:vec3(0.0);",
"  vec3 p;vec2 ev=vec2(0.0);float sg=0.0;",
"  if(uVr>0.5){",
     /* VR viewer. A trail is painted on the world: it lies on whatever surface is seen at this pixel, at that surface's
        depth, so it reads as the world itself changing and not as a sheet in front of it. The middle view of this surface
        point says where the motion takes the trail from; that place is read in this eye's half, shifted by the depth of
        what lies there, which is only known once it is read: so guess, read it, and read again. */
"    sdE=v.x<0.5?-1.0:1.0;sg=-sdE;ev=eyeOf(v);",
"    float es=sa.a*"+VR_EMAX+",eg=es;",
"    vec3 dd=uTurn*vec3(ev-vec2(sg*es,0.0),1.0);", /* where that direction was before the head turned: trails stay where they are in the world */
"    vec2 cs=bend(dd.xy/max(dd.z,0.2)*"+VR_KAP+")/"+VR_KAP+",src=v;",
"    for(int i=0;i<2;i++){src=texOf(cs+vec2(sg*eg,0.0));if(i==0)eg=texture2D(uB,src).a*"+VR_EMAX+";}",
"    p=texture2D(uB,src).rgb;",
"    p=mix(p,p.brg,uShift);p=max(p*uDecay-0.004,0.0)*(1.0-smoothstep(1.7,1.8,length(ev)));", /* nothing outside what the lens shows */
"    oa=sa.a;",
"  }else{",
"  p=texture2D(uB,bend(v-0.5)+0.5).rgb;",
"  p=mix(p,p.brg,uShift);",
"  p=max(p*uDecay-0.004,0.0);",
"  }",
"  vec3 o=max(s,p);",
"  if(uOv>0.5){",
"    vec2 d=v-0.5;d.x*=uAsp;float oe=uOvEta;",
"    if(uVr>0.5)for(int i=0;i<3;i++){d=(ev-vec2(sg*oe,0.0))*"+VR_KAP+";if(i<2)oe=min(uOvEta*ovDepth(d),"+VR_EMAX+");}", /* VR viewer: the shape is drawn in the middle view, each part at its own depth. Where a part is seen depends on its depth and its depth on where it is, so go round twice */
"    float m=min(1.0,uAsp);float rr=length(d)/m;float an=atan(d.y,d.x);float am=abs(an/3.14159265);float ln=0.0,dk=0.0;",
"    float wd=uVidK.x>3.5&&uVidK.x<4.5?7.0:1.0;", /* with a video in the overlay its lines are drawn much wider, so there is room for the video to show */
"    if(uOv<1.5){", /* ring: the waveform bent into a circle */
"      float wv=texture2D(uWv,vec2(am*0.98+0.01,0.5)).r*2.0-1.0;",
"      ln=1.0-smoothstep(0.0,0.016*wd,abs(rr-(0.26+0.2*wv)));",
"    }else if(uOv<2.5){", /* scope: the waveform as a line across the middle */
"      float wv=texture2D(uWv,vec2(abs(2.0*d.x/uAsp)*0.98+0.01,0.5)).r*2.0-1.0;",
"      ln=1.0-smoothstep(0.0,0.018*wd,abs(d.y/m-0.22*wv));",
"    }else if(uOv<3.5){", /* spectrum: bars around a circle, one per frequency band */
"      float q=am*40.0;float sp=texture2D(uWv,vec2((floor(q)+0.5)/40.0*0.7,0.5)).r;",
"      ln=step(0.18,fract(q))*step(fract(q),0.82)*step(0.16,rr)*step(rr,0.17+0.34*sp);",
"    }else if(uOv<4.5){", /* spokes: turning rays whose length follows the sound */
"      float q=fract((an/6.2831853+uTime*0.015)*14.0);float sp=texture2D(uWv,vec2(0.05+0.3*am,0.5)).r;",
"      ln=(1.0-smoothstep(0.0,0.008*wd,abs(q-0.5)*0.4488*rr))*step(0.05,rr)*step(rr,0.12+0.4*sp+0.15*uOvMid);",
"    }else if(uOv<5.5){", /* rings: circles spreading outward, brighter on the beat */
"      float f=abs(fract(rr*2.6-uTime*0.3)-0.5)/2.6;",
"      ln=(1.0-smoothstep(0.0,0.008*wd,f))*(0.35+0.65*uOvBeat)*step(rr,0.6);",
"    }else if(uOv<6.5){", /* spiral: a turning arm, rippled by the waveform */
"      float wv=texture2D(uWv,vec2(fract(rr*1.5)*0.98+0.01,0.5)).r*2.0-1.0;",
"      float f=abs(fract(rr*2.2-an/6.2831853-uTime*0.12+0.04*wv)-0.5)/2.2;",
"      ln=(1.0-smoothstep(0.0,0.009*wd,f))*step(rr,0.55);",
"    }else if(uOv<7.5){", /* orbit: four lights on looping paths that swell on the beat */
"      for(int i=0;i<4;i++){",
"        float fi=float(i);vec2 pp=0.34*vec2(cos(uTime*(0.5+0.17*fi)+fi*1.7),sin(uTime*(0.63+0.11*fi)+fi*2.3));",
"        vec2 dl=d;float el=uOvEta;",
"        if(uVr>0.5){el=min(uOvEta*(1.0+0.6*sin(uTime*(0.4+0.13*fi)+fi*2.1)),"+VR_EMAX+");dl=(ev-vec2(sg*el,0.0))*"+VR_KAP+";}", /* VR viewer: each light also swings nearer and farther */
"        float q2=length(dl/m-pp),gl2=exp(-q2*q2/((0.0006+0.0025*uOvHi)*wd*wd*0.5));if(gl2>ln)oe=el;ln+=gl2;",
"      }",
"    }else{", /* the dancers: up to twenty stick figures (DN in this shader, which trailFor sets to what the chip has room for; DN_MAX in js/dance.js is the most), whose joints JavaScript works out (js/dance.js), as a body in space seen from in front. Each is a filled head with a face and hair or a hat of its own, fourteen lines (back, neck, shoulders, hips, two to an arm, two to a leg, the feet) and a small filled hand at the end of each arm, with a dark edge (dk). A figure is looked at only near where it stands. They come furthest first, and each is drawn over the ones before it: its line and its dark edge hide theirs. The last number of hd is the figure's own number and half its brightness. rr, which the colour is taken from below, is set to a number of the figure's own, so each has its own colour of the palette */
"      vec2 q=d/m;",
/* The disco ball and its lights, for the overlay Disco only (uDb.z is the ball's height in the picture, 99 for none).
   uDb.xy are the floor's front as js/dance.js has it (the size of a figure there and how far up the picture it is), so
   that a place in the picture can be turned back into a place on the floor: fp is across and away in figure heights.
   The ball hangs 2 above the floor, 2 from its front edge. Each mirror on it throws one spot: a spot's place on the
   floor is the way its mirror faces, round the ball (fa, which goes round with the ball, uDb.w) and down from level
   (fe), so the spots go round the ball's foot together and are long where they land far off, as real ones are. The
   mirrors are in rows, fewer to a row the nearer it is to straight down. A mirror is lit or not, and has its own
   colour of the palette, by a chance number of its own. They move slowly and have soft edges: nothing flashes. They
   are drawn before the figures, which hide them. */
"      if(uDb.z<9.0){",
"        vec2 qz=(q-uDz.yz)/uDz.x;", /* the nearer view (uDz: how many times larger the floor is drawn, and how far it is moved): the place this would be in the plain view */
"        float fk=1.0-(qz.y-uDb.y)/(1.5*uDb.x);",
"        if(uDl>0.0&&fk>0.15){",
"          vec2 fp=vec2(qz.x/(uDb.x*fk),(1.0/fk-1.0)/0.3-2.0);",
"          float fr=length(fp),fe=atan(2.0,fr),fa=atan(fp.x,fp.y)+uDb.w;",
"          float row=floor(fe/0.2244),ec=(row+0.5)*0.2244,nc=max(1.0,floor(16.0*cos(ec)+0.5));",
"          float fu=fa/6.2831853*nc+0.37*row,cell=mod(floor(fu),nc);",
"          float h1=fract(sin(cell*12.9898+row*78.233)*43758.5453),h2=fract(sin(cell*39.346+row*11.135)*24634.6345);",
"          vec2 lc=vec2((fract(fu)-0.5)*6.2831853/nc*cos(ec),fe-ec);",
"          float spt=(1.0-smoothstep(0.045,0.085,length(lc)))*step(0.42,h1)*smoothstep(0.15,0.3,fk)*smoothstep(0.12,0.3,fe);",
"          ln=spt*uDl*(0.3+0.3*h2);if(spt>0.0)rr=0.15+h2*1.08;",
"        }",
/* the ball itself, on a cord from the top of the picture: rows of small mirrors that go round with it, each brightening
   for a part of each turn (when it faces a light of its own), with a dark edge like the figures */
"        vec2 bc=qz-vec2(0.0,uDb.z);float bR=0.055,rb=length(bc);",
"        float cord=(1.0-smoothstep(0.0015,0.004,abs(qz.x)))*step(uDb.z,qz.y);",
"        ln=max(ln,0.35*cord);",
"        if(rb<1.6*bR){",
"          float be=1.0-smoothstep(bR,1.25*bR,rb);dk=max(dk,be);",
"          if(rb<bR){",
"            vec2 bn=bc/bR;float bz=sqrt(max(0.0,1.0-dot(bn,bn)));",
"            float lat=asin(clamp(bn.y,-1.0,1.0)),lv=atan(bn.x,bz);",
"            float br=floor((lat/3.14159265+0.5)*9.0),lc2=((br+0.5)/9.0-0.5)*3.14159265,bnc=max(1.0,floor(18.0*cos(lc2)+0.5));",
"            float bu=(lv+uDb.w)/6.2831853*bnc,bcl=mod(floor(bu),bnc);",
"            float bh=fract(sin(bcl*12.9898+br*78.233)*43758.5453);",
"            float til=1.0-smoothstep(0.34,0.47,max(abs(fract(bu)-0.5),abs(fract((lat/3.14159265+0.5)*9.0)-0.5)));",
"            float lon=(floor(bu)+0.5)/bnc*6.2831853-uDb.w;", /* which way that mirror faces now, from the viewer's side */
"            float gli=pow(0.5+0.5*cos(lon-6.2831853*bh),10.0);",
"            ln=til*(0.22+0.78*gli)*(0.45+0.55*bz)*(0.5+0.5*min(1.0,uDl+0.4));rr=0.15+bh*1.08;",
"          }",
"        }",
"      }",
"      for(int i=0;i<DN;i++){",
"        vec4 hd=uD8[i],b0=uD0[i];",
"        if(hd.w>0.0&&abs(q.x-b0.z)<hd.z*11.0&&abs(q.y-b0.w)<hd.z*13.0){",
"          vec4 b1=uD1[i],b2=uD2[i],b3=uD3[i],b4=uD4[i],b5=uD5[i],b6=uD6[i],b7=uD7[i];",
"          float wl=hd.z*0.34*min(wd,3.0);",
"          float ds=min(min(limb(q,b0.xy,b0.zw),limb(q,b1.xy,b1.zw)),min(limb(q,b0.xy,hd.xy),length(q-hd.xy)-hd.z));",
"          ds=min(ds,min(min(limb(q,b1.xy,b2.xy),limb(q,b2.xy,b2.zw)),min(limb(q,b1.zw,b3.xy),limb(q,b3.xy,b3.zw))));",
"          ds=min(ds,min(length(q-b2.zw),length(q-b3.zw))-0.7*wl);", /* the hands */
"          ds=min(ds,min(limb(q,b4.xy,b4.zw),min(min(limb(q,b4.xy,b5.xy),limb(q,b5.xy,b5.zw)),min(limb(q,b4.zw,b6.xy),limb(q,b6.xy,b6.zw)))));",
"          ds=min(ds,min(limb(q,b5.zw,b7.xy),limb(q,b6.zw,b7.zw)));", /* the feet */
"          float id=floor(hd.w),e=1.0-smoothstep(wl,1.6*wl,ds);",
"          ln=ln*(1.0-e)+(1.0-smoothstep(0.35*wl,wl,ds))*fract(hd.w)*2.0;",
"          if(e>0.5)rr=0.15+fract(id*0.382)*1.08;",
"          dk=max(dk,e);",
"          vec2 hu=hd.xy-b0.xy;hu/=max(length(hu),1e-5);vec2 hl=vec2(dot(q-hd.xy,vec2(hu.y,-hu.x)),dot(q-hd.xy,hu))/hd.z;", /* the head's own details, in lines a quarter as wide as the body's. hl is the place in the head's frame, in head radii: across, and up along the line from the neck */
"          float hpx=hd.z*min(uRes.x,uRes.y);float df=smoothstep(2.5,6.0,hpx);", /* a head only a few dots across has none: they would only flicker */
"          if(df>0.0&&dot(hl,hl)<11.0){",
/* fc: the angle the head is turned by (0 facing the viewer), and its face as five numbers in three (see danceFill).
   Which head a figure has is its number's remainder on dividing by 16 (DN_LOOKS). Everything on a head is placed on
   the head, not on the picture, so that it turns with it. The head is a ball. For whatever lies on the ball (the
   face, and hair that covers the scalp) the place in the picture is taken back to the place on the ball it shows,
   and that is turned back by the head's angle: F is the place on the head itself (across, up, and toward the way
   the face looks), and H the same for a shell of hair a little larger than the head. A style then says which
   part of the shell it covers, in the head's own terms (behind the ears, above the brow), and the face's eyes and
   mouth sit at their own places on F. Parts that stand off the head (a peak, a tail, cups, bobbles) are put where
   their angle round the head brings them, sn of the way across for one at the front and cn for one at the side.
   dh is the distance to what is seen whole; dq to what is behind the head, and so seen only outside its disc. */
"            vec4 fc=uD9[i];float sty=mod(id,16.0);float aw=1.2/hpx;float tl=0.085*min(wd,3.0);float rh=length(hl);float ah=atan(hl.x,hl.y);float dh=1e5,dq=1e5;",
"            float sn=sin(fc.x),cn=cos(fc.x);float pit=(floor(fc.w)/255.0-0.5)*1.8;float sp=sin(pit),cp=cos(pit);", /* pit: how far the head is nodded forward (below nothing, looking up) */
"            vec2 hp=hl/max(rh,1.0);float hz=sqrt(max(0.0,1.0-dot(hp,hp)));vec3 H=vec3(hp.x*cn-hz*sn,hp.y,hp.x*sn+hz*cn);H=vec3(H.x,H.y*cp+H.z*sp,H.z*cp-H.y*sp);", /* the place on the head that this place in the picture shows, the head's turn and then its nod taken back out; beyond the head's edge, the place on its edge nearest */
"            float off=rh<1.1?tl:1e5;", /* what is added to a part of the head that hair covers, so that it is lit just where it is covered: hair lies a tenth of the head thick, so it shows that far past the head's edge and no further */
"            float scalp=0.15+0.5*H.z-H.y+off;", /* hair over the scalp: above a flat cut through the head that slopes from the brow, clear of the eyes, down behind the ears to the nape */
"            float win=max(abs(H.x)-0.72,-H.z);", /* the opening that hair leaves for the face: below nothing within it, however the head is turned */
"            float band=max(abs(H.z)-0.09,0.05-H.y)+off;", /* a band over the top from ear to ear */
"            if(sty<0.5){", /* headphones: the band, and a cup over each ear, round from the side and narrow from in front */
"              dh=band;",
"              for(int k=0;k<2;k++){",
"                float sd=k==0?1.0:-1.0;vec2 pv=hl-vec2(sd*1.13*cn,-0.1);float pe=length(pv/vec2(0.11+0.2*abs(sn),0.3));float e=(1.0-1.0/max(pe,0.05))*length(pv);",
"                if(sd*sn<0.2)dh=min(dh,e);", /* the cup on the far side of the head is behind it, and is left out */
"              }",
"            }else if(sty<1.5){float af=mod(ah+0.2+0.2546479*fc.x,0.4)-0.2;dh=scalp;if(abs(ah)<1.4)dh=min(dh,max(abs(af)*rh-0.15*(1.65-rh),max(1.0-rh,rh-1.65)));}", /* spikes all over: they go round with the head, four places to a whole turn */
"            else if(sty<2.5){", /* long hair: over all the head but the face, and a curtain of it hanging from the back half of the head to the shoulders. The curtain is as wide as the back of the head is seen to be, so it is behind the face, to one side from the side, and right across from behind; from in front it is behind the body, and from behind it covers it */
"              dh=-max(win,H.y-0.45)+off;",
"              float x0=(sn>=0.0?-1.0:-abs(cn))*1.3,x1=(sn<=0.0?1.0:abs(cn))*1.3;",
"              float cu=max(max(x0-hl.x,hl.x-x1),max(hl.y-0.15,-1.55-0.07*sin(9.0*hl.x)-hl.y));",
"              if(cn>=0.0&&!(sn>-0.1&&hl.x<x0+0.32)&&!(sn<0.1&&hl.x>x1-0.32))cu=max(cu,(1.1*wl-ds)/hd.z*8.0);", /* from in front it is behind the body, and cut off sharply there, so that no dark border is left round the body; but the lock at each end that is on the near side of the head falls in front of the shoulder */
"              if(rh>=1.0)dh=min(dh,cu+tl);",
"            }else if(sty<3.5){", /* a top hat: its outline, its brim and its band, and a buckle on the band at the front */
"              vec2 bx=abs(hl-vec2(0.0,1.42))-vec2(0.78,0.62);dh=min(abs(length(max(bx,0.0))+min(max(bx.x,bx.y),0.0)),min(max(abs(hl.y-0.8),abs(hl.x)-1.4),max(abs(hl.y-1.08),abs(hl.x)-0.78)));",
"              if(cn>0.05)dh=min(dh,abs(max(abs(hl.x-0.66*sn)-0.02-0.1*cn,abs(hl.y-1.08)-0.11)));",
"            }else if(sty<4.5){", /* a cap: a filled crown over the top of the head with a button on it, and a peak joined to its lower edge that sticks out the way the head faces, so it is a band across the brow from in front, long from the side and hidden from behind */
"              dh=min(max(rh-1.12,0.5-hl.y),length(hl-vec2(0.0,1.2))-0.06);",
"              vec2 pv=vec2(hl.x-1.3*sn,hl.y-0.5);float pe=length(pv/vec2(0.5+0.22*abs(cn),0.1));float pk=(1.0-1.0/max(pe,0.05))*length(pv);", /* how far outside the peak's flat oval this is, measured along the line from its middle */
"              if(cn>-0.15)dh=min(dh,pk);else dq=pk;",
"            }else if(sty<5.5){float bn=abs(length(hl-vec2(-0.55*sn,1.3))-0.33);dh=scalp;if(cn<0.2)dh=min(dh,bn);else dq=bn;}", /* hair in a bun at the back of the top */
"            else if(sty<6.5){dh=max(length(hl-vec2(-0.2*sn,0.3))-1.42-0.06*cos(11.0*ah+2.0*fc.x),-max(win,H.y-0.5))+tl;}", /* a round mass of curls about the head, further out at the back, open only at the face */
"            else if(sty<7.5){", /* a crest from the brow to the nape: a strip of hair down the middle of the head, and spikes standing from it, a few close together from in front and a fan from the side */
"              float af=mod(ah+0.14,0.28)-0.14;dh=max(abs(H.x)-0.13,max(min(0.3-H.y,H.z),-0.5-H.y))+off;",
"              if(abs(ah)<0.16+1.0*abs(sn))dh=min(dh,max(abs(af)*rh-0.12*(2.05-rh),max(1.0-rh,rh-2.05-0.25*cos(ah)+0.25)));",
"            }else if(sty<8.5){", /* a ponytail: tied at the back of the top, it hangs down behind */
"              float tq=min(limb(hl,vec2(-0.85*sn,0.55),vec2(-1.35*sn,0.2)),limb(hl,vec2(-1.35*sn,0.2),vec2(-1.25*sn,-0.85)))-0.05;",
"              dh=scalp;if(cn<0.2)dh=min(dh,tq);else dq=tq;",
"            }else if(sty<9.5){", /* two bunches, one behind each ear, each a ball of hair and a tail */
"              dh=scalp;",
"              for(int k=0;k<2;k++){",
"                float a=(k==0?1.75:-1.75)+fc.x;float bx=1.18*sin(a);",
"                float e=min(length(hl-vec2(bx,-0.05))-0.24,limb(hl,vec2(bx,-0.05),vec2(1.15*bx,-0.95))-0.04);",
"                if(cos(a)>-0.3)dh=min(dh,e);else dq=min(dq,e);",
"              }",
"            }else if(sty<10.5){dh=max(-max(win,H.y-0.32),-0.6-H.y)+off;}", /* a bob: over all the head but the face, down to the jaw, with a fringe */
"            else if(sty<11.5){", /* a woolly hat: a filled crown, a turned-up band and a bobble on top */
"              dh=min(max(rh-1.15,0.5-hl.y),min(abs(max(abs(hl.y-0.4)-0.11,abs(hl.x)-1.1)),length(hl-vec2(0.0,1.36))-0.2));",
"            }else if(sty<12.5){", /* a wide hat: a brim turned up at the sides and a crown with a dent in it */
"              vec2 bx=abs(hl-vec2(0.0,1.08))-vec2(0.72,0.42);float cr=max(length(max(bx,0.0))+min(max(bx.x,bx.y),0.0),0.16-length(hl-vec2(0.0,1.6)));",
"              dh=min(abs(cr),max(abs(hl.y-0.56-0.13*hl.x*hl.x),abs(hl.x)-1.95));",
"            }else if(sty<13.5){", /* a party hat: a cone worn to one side of the top, which goes round with the head, with a stripe and a bobble */
"              float cx=0.38*sin(fc.x+0.6);vec2 tp=vec2(1.6*cx,2.05);",
"              dh=min(min(limb(hl,vec2(cx-0.55,0.84),tp),limb(hl,vec2(cx+0.55,0.84),tp)),min(limb(hl,vec2(cx-0.55,0.84),vec2(cx+0.55,0.84)),limb(hl,vec2(1.3*cx-0.27,1.45),vec2(1.3*cx+0.27,1.45))));",
"              dh=min(dh,length(hl-tp)-0.1);",
"            }else if(sty<14.5){", /* a crown: a band with points, which go round as the head turns */
"              float zz=1.02+0.42*abs(fract(hl.x*1.25+0.4774648*fc.x)*2.0-1.0);",
"              dh=min(min(max(abs(hl.y-zz)*0.6,abs(hl.x)-0.86),max(abs(hl.y-0.74),abs(hl.x)-0.86)),max(abs(abs(hl.x)-0.86),max(0.74-hl.y,hl.y-1.3)));",
"            }else{", /* two bobbles on springs, one from each end of a band over the top: they cross as the head turns */
"              dh=band;",
"              for(int k=0;k<2;k++){",
"                float a=(k==0?1.5707963:-1.5707963)+fc.x;vec2 ft=vec2(0.42*sin(a),0.98);vec2 tp=vec2(0.8*sin(a),1.95);",
"                dh=min(dh,min(limb(hl,ft,tp)+0.02,length(hl-tp)-0.13));",
"              }",
"            }",
"            if(rh>1.0)dh=min(dh,dq);", /* what is behind the head is seen only past its edge: not near the edge inside it, where its dark border would show through the head */
"            float he=(1.0-smoothstep(tl,2.2*tl+aw,dh))*df,hb=(1.0-smoothstep(tl-aw,tl+aw,dh))*df;",
"            ln=ln*(1.0-he)+hb*fract(hd.w)*2.0;dk=max(dk,he);",
"            if(hb>0.5)rr=0.15+fract(id*0.382+0.31)*1.08;", /* in another of the palette's colours than the body */
"            if(rh<0.97&&hb<0.5){", /* the face: two eyes and a mouth, dark in the lit head, at their own places on the ball, so they go across and narrow as the head turns, and are gone when it is turned away */
"              float fz=sqrt(1.0-rh*rh);vec3 F=vec3(hl.x*cn-fz*sn,hl.y,hl.x*sn+fz*cn);F=vec3(F.x,F.y*cp+F.z*sp,F.z*cp-F.y*sp);",
"              if(F.z>0.1){",
"                vec2 fl=F.xy;float mo=floor(fc.y)/255.0,lid=fract(fc.y),mw=max(0.05,floor(fc.z)/510.0),cv=fract(fc.z);",
"                vec2 ey=vec2(abs(fl.x)-0.36,fl.y-0.18);",
"                float de=mix(length(vec2(ey.x,ey.y/(1.0-0.8*lid)))-0.1,max(abs(length(ey+vec2(0.0,0.05))-0.14)-0.035,-0.03-ey.y),fract(fc.w));", /* an eye is a dot, which its lid flattens; or, shut and smiling, an arch */
"                float mh=0.045+0.17*mo;float dm=length(vec2(fl.x*mh/mw,fl.y+0.36-cv*fl.x*fl.x))-mh;", /* the mouth: so wide, so far open, its corners so far turned up */
"                ln*=1.0-0.9*max(1.0-smoothstep(-aw,aw,de),1.0-smoothstep(-aw,aw,dm))*smoothstep(0.1,0.35,F.z)*df;",
"              }",
"            }",
"          }",
"        }",
"      }",
"    }",
"    if(uVr>0.5)ln*=1.0-smoothstep(1.7,1.8,length(ev));",
"    o*=1.0-0.75*dk*uOvAmt;", /* the dancers have a dark edge round them, so that they can be seen against a bright world */
"    vec3 oc=pal(uHue+0.3+rr*0.45);", /* coloured from the current palette */
"    if(uVidK.x>3.5&&uVidK.x<4.5)o=mix(o,mix(oc,vs,uVidK.y),min(ln,1.0)*uOvAmt);", /* video in the overlay: its shapes are windows onto the video, dark parts and all */
"    else o+=(max(o,oc)-o)*min(ln,1.0)*uOvAmt;",
"    if(uVr>0.5)oa=mix(oa,oe/"+VR_EMAX+",min(ln,1.0)*uOvAmt);", /* where the overlay is drawn, its depth is what the trails carry on */
"  }",
"  gl_FragColor=vec4(o,oa);",
"}"].join("\n");
export const FS_DOWN=[
"precision highp float;varying vec2 v;uniform sampler2D uT;uniform vec2 uPx;",
"void main(){",
"  vec3 c=texture2D(uT,v+uPx).rgb+texture2D(uT,v-uPx).rgb+texture2D(uT,v+vec2(uPx.x,-uPx.y)).rgb+texture2D(uT,v+vec2(-uPx.x,uPx.y)).rgb;",
"  c=max(c*0.25-0.5,0.0)*2.0;",
"  gl_FragColor=vec4(c,1.0);",
"}"].join("\n");
export const FS_BLUR=[
"precision highp float;varying vec2 v;uniform sampler2D uT;uniform vec2 uDir;",
"void main(){",
"  vec3 c=texture2D(uT,v).rgb*0.227;",
"  c+=(texture2D(uT,v+uDir*1.5).rgb+texture2D(uT,v-uDir*1.5).rgb)*0.194;",
"  c+=(texture2D(uT,v+uDir*3.0).rgb+texture2D(uT,v-uDir*3.0).rgb)*0.122;",
"  c+=(texture2D(uT,v+uDir*4.5).rgb+texture2D(uT,v-uDir*4.5).rgb)*0.054;",
"  c+=(texture2D(uT,v+uDir*6.0).rgb+texture2D(uT,v-uDir*6.0).rgb)*0.016;",
"  gl_FragColor=vec4(c,1.0);",
"}"].join("\n");
export const FS_FINAL=[
"precision highp float;varying vec2 v;uniform sampler2D uT,uB;uniform float uWarp,uCA,uBloom,uTime,uAsp;uniform vec3 uTint;uniform vec2 uPx;",
"uniform float uLiq,uMos,uEcho,uEdge,uPost,uSolar,uInv,uHueRot,uTr,uFx,uHue,uVr;uniform vec3 uPa,uPb,uPc,uPd;",
"uniform sampler2D uPrev,uLandT,uSkyT;uniform float uKeep,uLandMix;",
VR_GLSL,
"float etaS=0.0,sgE=0.0;",
"vec2 at(vec2 cw){return uVr<1.5?0.5+cw:texOf(cw/"+VR_KAP+"+vec2(sgE*etaS,0.0));}", /* where in the picture to read, for a place in the bent middle view: in the VR viewer, in this eye's half and shifted by the depth of what is read */ /* the last finished picture and how much of it to keep: the flash limiter for unreviewed pack code */
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
"const vec3 LW=vec3(0.299,0.587,0.114);",
/* for the two painters' filters: a chance number for a square, and smooth noise made from it */
"float pH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
"float pN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(pH(i),pH(i+vec2(1.0,0.0)),f.x),mix(pH(i+vec2(0.0,1.0)),pH(i+vec2(1.0,1.0)),f.x),f.y);}",
"void main(){",
"  vec2 c=v-0.5;float r,w2=uWarp*uWarp;vec2 ev=vec2(0.0);",
"  if(uVr>1.5){sdE=v.x<0.5?-1.0:1.0;sgE=-sdE;ev=eyeOf(v);etaS=texture2D(uT,v).a*"+VR_EMAX+";c=(ev+vec2(sdE*etaS,0.0))*"+VR_KAP+";}", /* VR viewer: work on the middle view, starting from the depth of what is here now */
"  vec2 cw;float zb,tintAmt,mask,diss,fe=1.0;",
"  for(int it=0;it<2;it++){", /* once everywhere else. In the VR viewer twice: bend, read the depth of what the bend brings here, and bend again from where the middle view sees that */
"  r=length(c);cw=c;zb=0.07;tintAmt=w2*0.9;mask=1.0;diss=0.0;",
"  if(uWarp>0.001){",
"    if(uTr<0.5){", /* swirl */
"      float ang=w2*2.2*(0.7-r);float cs=cos(ang),sn=sin(ang);",
"      cw=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y)*(1.0-0.4*w2);",
"    }else if(uTr<1.5){cw=c*(1.0-0.8*w2);zb=0.22;", /* dive: straight zoom with streaks */
"    }else if(uTr<2.5){float n=6.0+300.0*pow(1.0-uWarp,3.0);vec2 nv=vec2(n*uAsp,n);cw=(floor(c*nv)+0.5)/nv;", /* blocks: pixels grow huge */
"    }else if(uTr<3.5){", /* fold: collapses into an eight-way kaleidoscope */
"      float a=atan(c.y,c.x);float seg=0.7853982;float a2=abs(mod(a+uWarp*2.5,seg)-0.5*seg);",
"      cw=mix(c,r*vec2(cos(a2),sin(a2)),smoothstep(0.0,0.5,uWarp))*(1.0-0.3*w2);",
"    }else if(uTr<4.5){cw=c+vec2(0.0,w2*(0.3+0.22*sin(c.x*37.0)+0.14*sin(c.x*91.0+1.7)));tintAmt=w2*w2*0.95;", /* melt: the picture drips down */
"    }else if(uTr<5.5){mask=smoothstep(0.0,0.04,(1.0-uWarp)*0.54-abs(c.y));tintAmt=0.0;", /* blink: closes like an eye */
"    }else if(uTr<6.5){float band=floor(v.y*26.0);float h=fract(sin(band*91.7+floor(uTime*8.0)*13.1)*43758.5453);cw=c+vec2((h-0.5)*0.9*w2,0.0);", /* tear: bands slide apart */
"    }else{vec2 cell=floor((c+0.5)*vec2(uAsp,1.0)*56.0);diss=step(fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453),uWarp*1.05);tintAmt=0.0;}", /* dissolve: tiles flip to colour */
"  }",
"  if(uFx>0.5&&uFx<4.5){",
"    if(uFx<1.5)cw=abs(cw);", /* quad: four-way mirror */
"    else if(uFx<2.5)cw=abs(fract(cw*1.5+0.25)*2.0-1.0)-0.5;", /* tiles: three by three, mirrored so seams meet */
"    else if(uFx<3.5)cw*=mix(0.5,1.0,smoothstep(0.0,0.5,length(cw)));", /* bulge: the middle swells */
"    else{float ta=2.0*sin(uTime*0.25)*max(0.6-length(cw),0.0);float tcs=cos(ta),tsn=sin(ta);cw=vec2(tcs*cw.x-tsn*cw.y,tsn*cw.x+tcs*cw.y);}", /* twirl: winds and unwinds */
"  }",
"  if(uFx>14.5&&uFx<15.5){vec2 gt=fract(cw*vec2(uAsp,1.0)*9.0)-0.5;cw+=gt*0.035;}", /* glass: a grid of small lenses */
/* Fly eye: the picture as an insect's eye of six-sided lenses might give it. The picture is cut into six-sided cells
   (two square grids of middles, one set half a step off the other: a place belongs to the nearer middle), and every
   cell shows the whole picture small. Each shows it moved a little by where the cell is, as each lens of such an eye
   looks a slightly different way, so no two cells are quite alike. fe is how far a place is from its cell's edge,
   which the colour below darkens into a rim. The cells are sized by the picture's height. */
"  if(uFx>18.5&&uFx<19.5){",
"    vec2 hp=cw*vec2(uAsp,1.0)/0.125,hs=vec2(1.0,1.7320508);",
"    vec2 ha=mod(hp,hs)-0.5*hs,hb=mod(hp-0.5*hs,hs)-0.5*hs;vec2 hg=dot(ha,ha)<dot(hb,hb)?ha:hb;",
"    vec2 hh=abs(hg);fe=0.5-max(hh.x,dot(hh,vec2(0.5,0.8660254)));",
"    cw=(hg*(1.0+0.5*dot(hg,hg))*0.56*min(uAsp,1.0)+(hp-hg)*0.125*0.3)/vec2(uAsp,1.0);",
"  }",
"  if(uLiq>0.0)cw+=uLiq*vec2(sin(cw.y*14.0+uTime*1.3),cos(cw.x*12.0-uTime*1.1));",
"  if(uMos>0.0){vec2 n=vec2(uMos*uAsp,uMos);cw=(floor(cw*n)+0.5)/n;}",
"  if(uVr<1.5)break;",
"  etaS=texture2D(uT,at(cw)).a*"+VR_EMAX+";if(it==0)c=(ev+vec2(sdE*etaS,0.0))*"+VR_KAP+";",
"  }",
"  vec2 tw=at(cw);",
"  if(uVr>0.5&&uVr<1.5)zb=0.0;", /* VR viewer with nothing bent: the picture is read as it is */
"  float ca=(uCA+0.05*w2)*r*2.0*(uVr>0.5&&uVr<1.5?0.0:1.0);",
"  vec3 col=vec3(0.0);",
"  for(int i=0;i<4;i++){",
"    float k=1.0-zb*uWarp*float(i);",
"    col.r+=texture2D(uT,at(cw*k*(1.0+ca))).r;",
"    col.g+=texture2D(uT,at(cw*k)).g;",
"    col.b+=texture2D(uT,at(cw*k*(1.0-ca))).b;",
"  }",
"  col*=0.25;",
"  if(uEcho>0.0){vec2 te=at(-cw*0.5);if(uVr>1.5){float ek=etaS;etaS=texture2D(uT,te).a*"+VR_EMAX+";te=at(-cw*0.5);etaS=ek;}vec3 e=texture2D(uT,te).rgb;col=max(col*(1.0-0.35*uEcho),e*0.85*uEcho);}",
"  if(uEdge>0.0){",
"    vec2 px=uPx*1.5;",
"    float l0=dot(texture2D(uT,tw-vec2(px.x,0.0)).rgb,LW);",
"    float l1=dot(texture2D(uT,tw+vec2(px.x,0.0)).rgb,LW);",
"    float l2=dot(texture2D(uT,tw-vec2(0.0,px.y)).rgb,LW);",
"    float l3=dot(texture2D(uT,tw+vec2(0.0,px.y)).rgb,LW);",
"    float g=length(vec2(l1-l0,l3-l2));",
"    vec3 neon=normalize(col+0.02)*1.6*smoothstep(0.03,0.22,g);",
"    col=mix(col,neon+col*0.1,uEdge);",
"  }",
"  if(uSolar>0.0)col=mix(col,1.0-abs(2.0*col-1.0),uSolar);",
"  if(uInv>0.0)col=mix(col,0.92*(1.0-col),uInv);",
"  if(uHueRot>0.0){",
"    float ha=uHueRot*(uTime*0.6+r*5.0);vec3 kk=vec3(0.57735);",
"    col=clamp(col*cos(ha)+cross(kk,col)*sin(ha)+kk*dot(kk,col)*(1.0-cos(ha)),0.0,1.0);",
"  }",
"  if(uPost>0.0)col=floor(col*uPost+0.5)/uPost;",
"  if(uFx>4.5){",
"    float lum=dot(col,LW);",
"    if(uFx<5.5)col=pal(uHue+lum*0.9)*smoothstep(0.02,0.14,lum);", /* thermal: brightness mapped through the palette */
"    else if(uFx<6.5){col*=0.76+0.24*cos(gl_FragCoord.y*2.0944);col*=1.0+0.07*cos(gl_FragCoord.x*2.0944+vec3(0.0,2.0944,4.1888));}", /* crt: scanlines and a colour mask */
"    else if(uFx<7.5){", /* halftone: dots sized by brightness */
"      vec2 g=(gl_FragCoord.xy*mat2(0.7071,-0.7071,0.7071,0.7071))/7.0;float rad=sqrt(clamp(lum,0.0,1.0))*0.72;",
"      col=clamp(col/max(lum,0.08)*0.75,0.0,1.0)*(1.0-smoothstep(rad-0.1,rad+0.1,length(fract(g)-0.5)));",
"    }else if(uFx<8.5){float bd=abs(fract(lum*9.0-uTime*0.15)-0.5);col=mix(col*0.22,clamp(col*1.9+0.08,0.0,1.0),1.0-smoothstep(0.03,0.1,bd));}", /* contour: drifting bands of equal brightness */
"    else if(uFx<9.5){float l2=smoothstep(0.06,0.7,lum);col=mix(vec3(l2),uTint*l2*1.5,smoothstep(0.5,0.95,l2)*0.65);}", /* noir: black and white, highlights in the palette colour */
"    else if(uFx<10.5||(uFx>13.5&&uFx<14.5)){", /* comic and emboss both read the brightness either side */
"      vec2 px=uPx*1.5;",
"      float l0=dot(texture2D(uT,tw-px).rgb,LW),l1=dot(texture2D(uT,tw+px).rgb,LW);",
"      float l2=dot(texture2D(uT,tw+vec2(px.x,-px.y)).rgb,LW),l3=dot(texture2D(uT,tw+vec2(-px.x,px.y)).rgb,LW);",
"      if(uFx<10.5){", /* comic: a few flat colours, made stronger, with dark outlines */
"        vec3 q=floor(col*4.0+0.5)/4.0;q=clamp(mix(vec3(dot(q,LW)),q,1.5),0.0,1.0);",
"        col=q*(1.0-0.9*smoothstep(0.06,0.2,length(vec2(l1-l0,l3-l2))));",
"      }else{float g=clamp(0.5+(l1-l0)*3.5,0.0,1.0);col=mix(vec3(g),col*g*2.0,0.3);}", /* emboss: grey relief, lit from one corner, with a little of the colour left */
"    }else if(uFx<11.5)col=mix(pal(uHue+0.5)*0.1,mix(pal(uHue),vec3(1.0),0.35),smoothstep(0.04,0.8,lum));", /* duotone: dark parts one palette colour, bright parts another */
"    else if(uFx<12.5){", /* tape: lines shifted sideways a little, colours out of register, a soft band rolling up, faint lines and grain */
"      float row=floor(v.y*200.0);",
"      float sh=(fract(sin(row*91.7+floor(uTime*10.0)*7.3)*43758.5453)-0.5)*0.003+0.012*exp(-pow((fract(v.y-uTime*0.06)-0.5)*16.0,2.0));",
"      vec3 t=vec3(texture2D(uT,tw+vec2(sh+0.004,0.0)).r,texture2D(uT,tw+vec2(sh,0.0)).g,texture2D(uT,tw+vec2(sh-0.004,0.0)).b);",
"      t=mix(vec3(dot(t,LW)),t,0.8)*(0.93+0.07*cos(gl_FragCoord.y*3.14159));",
"      col=clamp(t*0.94+0.03+0.03*(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+floor(uTime*10.0))*43758.5453)-0.5),0.0,1.0);",
"    }else if(uFx<13.5){", /* streaks: the bright parts run down the picture */
"      for(int i=1;i<9;i++){vec3 s=texture2D(uT,tw+vec2(0.0,float(i)*uPx.y*7.0)).rgb;col=max(col,s*smoothstep(0.45,0.8,dot(s,LW))*(1.0-float(i)/9.0));}",
"    }else if(uFx>16.5&&uFx<17.5){",
/* Van Gogh: short thick strokes of paint that follow the edges of things, and where there are no edges go round in
   slow whorls, as his skies do. Each place takes the way its stroke runs (along the edge if the brightness changes
   here, else along the whorls, which drift very slowly), and the colour is the picture's taken along that line, so it
   is drawn out into a stroke. Fine noise taken along the same line gives the stroke its ridges of thick paint. The
   colours are made stronger, the darks pushed toward blue and the lights toward yellow, and edges get a dark line. */
"      vec2 pp=cw*vec2(uAsp,1.0);vec2 px=uPx*2.0;",
"      float l0=dot(texture2D(uT,tw-vec2(px.x,0.0)).rgb,LW),l1=dot(texture2D(uT,tw+vec2(px.x,0.0)).rgb,LW);",
"      float l2=dot(texture2D(uT,tw-vec2(0.0,px.y)).rgb,LW),l3=dot(texture2D(uT,tw+vec2(0.0,px.y)).rgb,LW);",
"      vec2 g=vec2(l1-l0,l3-l2);float gm=length(g);",
"      float th=2.2*sin(pp.x*5.0+0.7*sin(pp.y*3.0+uTime*0.07))+2.0*cos(pp.y*4.3-1.3*sin(pp.x*2.6-uTime*0.05));",
"      vec2 dr=vec2(cos(th),sin(th));",
"      if(gm>0.02){vec2 tg=vec2(-g.y,g.x)/gm;if(dot(tg,dr)<0.0)tg=-tg;dr=normalize(mix(dr,tg,smoothstep(0.02,0.15,gm)));}",
"      vec3 acc=vec3(0.0);float nz=0.0;vec2 nr=vec2(-dr.y,dr.x);",
"      for(int i=0;i<9;i++){",
"        float fi=float(i)-4.0;vec2 q=pp+dr*fi*0.0046;",
"        acc+=texture2D(uT,tw+dr*fi*0.0046*vec2(1.0/uAsp,1.0)).rgb;",
"        nz+=pN(vec2(dot(q,dr)*18.0,dot(q,nr)*120.0)+floor(th*1.2));", /* long along the stroke and fine across it */
"      }",
"      col=acc/9.0;lum=dot(col,LW);",
"      col=clamp(mix(vec3(lum),col,1.55),0.0,1.0);",
"      col=mix(col,col*vec3(0.72,0.86,1.4),(1.0-smoothstep(0.0,0.5,lum))*0.55);col=mix(col,col*vec3(1.22,1.1,0.62),smoothstep(0.45,0.9,lum)*0.5);",
"      col*=0.55+0.9*nz/9.0;col*=1.0-0.5*smoothstep(0.1,0.32,gm);",
"      col=clamp(col,0.0,1.0);",
"    }else if(uFx>17.5&&uFx<18.5){",
/* Monet: the picture in soft dabs of paint. The picture is laid out in squares, each with a dab somewhere in it, wider
   than it is tall as his strokes on water are; a dab is one colour, the picture's at its middle, a little warmer or
   cooler than it should be by chance, so that neighbours differ as broken colour does. A place takes the dabs round
   it by how near they are. Then the darks are lifted and tinted lilac and the whole is made paler, as in haze. */
"      vec2 pp=cw*vec2(uAsp,1.0)*88.0;vec2 ci=floor(pp);vec3 acc=vec3(0.0);float wt=0.0;",
"      for(int j=0;j<3;j++)for(int i=0;i<3;i++){",
"        vec2 cc=ci+vec2(float(i)-1.0,float(j)-1.0);float h=pH(cc);",
"        vec2 ct=cc+vec2(0.2+0.6*h,0.2+0.6*fract(h*57.31));vec2 dv=(pp-ct)*vec2(0.7,1.2);",
"        float w=exp(-dot(dv,dv)*3.4);w=w*w*w*w*(0.5+1.0*fract(h*913.7));",
"        vec3 s=texture2D(uT,tw+(ct-pp)/88.0*vec2(1.0/uAsp,1.0)).rgb;",
"        s*=mix(vec3(1.16,1.0,0.8),vec3(0.8,0.98,1.2),fract(h*311.1))*(0.86+0.28*fract(h*71.3));",
"        acc+=s*w;wt+=w;",
"      }",
"      col=acc/max(wt,1e-4);lum=dot(col,LW);",
"      col=mix(col,vec3(0.56,0.5,0.78)*(0.35+lum),(1.0-smoothstep(0.0,0.45,lum))*0.45);",
"      col=clamp(pow(clamp(col,0.0,1.0),vec3(0.85))*0.9+0.07,0.0,1.0);col=mix(vec3(dot(col,LW)),col,0.92);",
"    }else if(uFx>15.5&&uFx<16.5){", /* airbrush: the brightness with more contrast, tinted cool where dark and warm where light, and only a little of the colour kept */
"      float ab=smoothstep(0.0,0.62,lum);ab=mix(ab,ab*ab*(3.0-2.0*ab),0.5);",
"      col=mix(mix(vec3(0.50,0.60,0.58),vec3(1.0,0.96,0.88),ab)*ab,col,0.10);",
"    }",
"  }",
"  col+=texture2D(uB,tw).rgb*uBloom;",
"  if(uFx>18.5&&uFx<19.5)col*=mix(0.08,1.0,smoothstep(0.0,0.035,fe))*(0.72+0.28*smoothstep(0.0,0.3,fe));", /* fly eye: a dark rim to each lens, and a lens a little brighter in its middle */
"  col=mix(col,uTint,max(tintAmt,diss))*mask;",
"  if(uLandMix>0.5){vec4 L=texture2D(uLandT,v);col=uLandMix<1.5?mix(col,L.rgb,L.a):mix(texture2D(uSkyT,v).rgb,col,L.a);}", /* effects on the sky only: the land goes on top untouched. On the land only: the world shows untouched behind it. */
"  if(uVr>1.5)col*=1.0-smoothstep(1.7,1.8,length(ev));", /* VR viewer: nothing outside what the lens shows */
"  if(uKeep>0.0)col=mix(col,texture2D(uPrev,v).rgb,uKeep);",
"  col+=(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))-0.5)/255.0;", /* a fixed fine grain of half a step of brightness, so smooth dark gradients do not show as bands */
"  gl_FragColor=vec4(col,1.0);",
"}"].join("\n");

/* the final pass with a pack filter's code in it. The code sees the picture and the palette, and nothing that changes with time. */
export function finalSource(code){
  return FS_FINAL
   .replace("void main(){","float aspect;vec2 pixel;\nvec3 scene(vec2 uv){return texture2D(uT,uv).rgb;}\nfloat luma(vec3 c){return dot(c,LW);}\nvoid look(vec2 uv,inout vec3 col){\n"+code+"\n}\nvoid main(){")
   .replace("  col+=texture2D(uB,tw).rgb*uBloom;","  aspect=uAsp;pixel=uPx;look(tw,col);col=clamp(col,0.0,1.0);\n  col+=texture2D(uB,tw).rgb*uBloom;");
}
/* the feedback pass written for n dancers and not twenty: each takes ten of the chip's uniform vectors, and some chips have room for fewer (js/programs.js asks) */
export function trailFor(n){return FS_TRAIL.replace("const int DN=20;","const int DN="+Math.max(1,Math.min(20,Math.floor(n)||20))+";");}
/* the feedback pass with a pack overlay's code in it. The code sets how bright the overlay is at a point, and where in the palette its colour comes from. */
export function trailSource(code,n){
  return trailFor(n||20)
   .replace("void main(){","float time,beat,mid,hi,aspect;\nfloat sound(float x){return texture2D(uWv,vec2(clamp(x,0.0,1.0)*0.98+0.01,0.5)).r;}\nvoid mark(vec2 p,inout float ln,inout float hue){\n"+code+"\n}\nvoid main(){")
   .replace("    vec3 oc=pal(uHue+0.3+rr*0.45);","    float hq=0.3+rr*0.45;\n    if(uOv>98.5){ln=0.0;time=uTime;beat=uOvBeat;mid=uOvMid;hi=uOvHi;aspect=uAsp;mark(d/m,ln,hq);ln=clamp(ln,0.0,1.0);}\n    vec3 oc=pal(uHue+hq);");
}
export const TRAIL_U=["uA","uB","uWv","uDecay","uZoom","uRot","uSwirl","uWob","uRip","uTime","uAsp","uOv","uOvBeat","uOvMid","uOvHi","uDrift","uShift","uOvAmt","uHue","uVr","uVrG","uLn","uRes","uTurn","uOvEta","uPa","uPb","uPc","uPd","uVid","uVidK","uD0","uD1","uD2","uD3","uD4","uD5","uD6","uD7","uD8","uD9","uDb","uDl","uDz"];

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={VS, fragSource, FS_TRAIL, FS_DOWN, FS_BLUR, FS_FINAL, finalSource, trailSource, trailFor, TRAIL_U};
