/* The zoom worlds: the Mandelbrot set and Julia sets seen flat, from above, zooming in on a point and out again. */
import { cam } from "./camera.js";
import { drift } from "./controls.js";
import { gl, isTouch } from "./dom.js";
import { started } from "./loop.js";
import { bindTex } from "./programs.js";
import { b36 } from "./spots.js";
import { still } from "./still.js";

/* Where the view is: its middle (x, y), the distance s from the middle to the top of a square picture, how far it is
   turned, and the Julia set's constant (jx, jy). The middle is held as exactly as JavaScript can, about 16 digits, which
   is what lets the picture be magnified a trillion times. */
export const zm={x:-0.6,y:0,s:1.5,rot:0,jx:-0.8,jy:0.156};
/* the tour: which target, mirrored top to bottom or not, what it is doing, and its clocks */
export const zp={ti:-1,flip:1,phase:0,hold:0,ji:0,turn:0,fx:0,fy:0};
export const ZTOP=1.5;    /* the whole set in view */
export const ZMIN=1e-12;  /* past this the middle cannot be told from its neighbours */
export const ZBAIL=256;   /* a point has left for good once its distance, squared, passes this */
export const REF_W=1024;  /* the most steps a reference path can hold, and so the most the shader takes on any device */
export const ZHOLD=2.5;   /* seconds the tour rests at the bottom of a zoom */
/* Places on the edge of the Mandelbrot set whose path lands on a cycle after a few steps (Misiurewicz points), found by
   Newton's method to the last digit. The picture round such a point repeats itself all the way down, so there is always
   something there. d is the smallest s the tour goes to; per is about how many more steps each tenfold zoom needs. */
export const ZTARGETS=[
  {name:"the three-way branch",x:-0.10109636384562219,y:0.9562865108091415,d:3e-12,per:9},
  {name:"a seahorse's spiral",x:-0.7766105925997019,y:0.13460896167502817,d:1e-9,per:110},
  {name:"the long needle",x:-1.5436890126920764,y:0,d:1e-11,per:5},
  {name:"an elephant's trunk",x:0.27593536244168243,y:0.0069166138017371795,d:3e-5,per:200},
  {name:"the sceptre",x:-1.2228637871299002,y:0.31688226388713636,d:3e-12,per:7},
  {name:"the top branch",x:-0.22815549365396182,y:1.1151425080399373,d:3e-12,per:3},
  {name:"the four-way spiral",x:0.36636298342276435,y:0.5915337732614453,d:3e-12,per:13},
  {name:"the small copy on the needle",x:-1.754877666246693,y:0,d:0.03,per:60}
];
/* Julia sets worth seeing: the constant for each. The tour zooms in on the point of each that stays put (see fixedPoint). */
export const JULIAS=[[-0.8,0.156],[-0.4,0.6],[0.285,0.01],[-0.7269,0.1889],[-0.835,-0.2321],[-0.123,0.745],[0.355,0.355],[-0.70176,-0.3842],[-0.75,0.11],[0.0,0.8]];
export const JDEPTH=1e-7;
let refTex=null,refBuf=null,refKey="",refLen=[2,2],floatOk=false;

/* The path of one point: z, then z*z + c, and so on, written into out as (x, y, 0, 0) for each step of one row of the
   reference picture. It stops after the first step that has left for good, or at REF_W steps. Returns how many it wrote. */
export function refOrbit(out,row,zx,zy,cx,cy){
  var o=row*REF_W*4,n=0,t;
  for(;n<REF_W;n++){
    out[o+4*n]=zx;out[o+4*n+1]=zy;
    if(zx*zx+zy*zy>ZBAIL){n++;break;}
    t=zx*zx-zy*zy+cx;zy=2*zx*zy+cy;zx=t;
  }
  return n;
}
/* A point of a Julia set that maps to itself and pushes its neighbours away, so it is on the set and the set looks the
   same at every size around it. There are two such candidates, (1 - sqrt(1 - 4c)) / 2 and (1 + sqrt(1 - 4c)) / 2. The
   first is where the set's arms meet, the better thing to look at, but it only pushes away for some constants; it is
   used when it pushes hard enough (by more than 1.045 a step) that the zoom does not need too many steps. The second always does. */
export function fixedPoint(cx,cy){
  var ax=1-4*cx,ay=-4*cy,r=Math.hypot(ax,ay),sx=Math.sqrt((r+ax)/2),sy=Math.sqrt(Math.max(0,(r-ax)/2))*(ay<0?-1:1);
  if(Math.hypot(1-sx,sy)>1.045)return [(1-sx)/2,-sy/2];
  return [(1+sx)/2,sy/2];
}
/* How many steps the shader takes at this size of view: more as the view shrinks, up to what the device is given. */
export function zoomIter(s,cap,julia){
  var dec=Math.max(0,Math.log(ZTOP/s)/Math.LN10);
  return Math.min(cap,Math.round(150+110*dec));
}
/* The smallest s the tour takes a target to on a device given cap steps. */
export function targetDepth(t,cap){return Math.max(t.d,ZTOP*Math.pow(10,-(cap-150)/Math.max(t.per,110)));}
export function zoomCap(){return isTouch?384:REF_W;}
/* One step of the tour toward the point (tx, ty) and the size d. While the point is off the picture, or near its edge,
   the view backs out. Once it is well inside, the middle closes on it faster than the view shrinks, so the point is
   dead centre long before the bottom. True once it is there. */
export function pilotTo(z,tx,ty,d,dt,rate){
  var dx=tx-z.x,dy=ty-z.y,dist=Math.hypot(dx,dy),f=1-Math.exp(-3*rate*dt);
  if(dist>0.6*z.s&&z.s<ZTOP){z.s=Math.min(ZTOP,z.s*Math.exp(1.6*rate*dt));return false;}
  if(dist<1e-3*z.s){z.x=tx;z.y=ty;}else{z.x+=dx*f;z.y+=dy*f;}
  if(dist<=0.6*z.s&&z.s>d)z.s=Math.max(d,z.s*Math.exp(-rate*dt));
  return z.s<=d&&z.x===tx&&z.y===ty;
}
function nextTarget(){
  var i=Math.floor(Math.random()*(ZTARGETS.length-1));
  zp.ti=i>=zp.ti?i+1:i;if(zp.ti>=ZTARGETS.length)zp.ti=0;
  zp.flip=Math.random()<0.5?1:-1;zp.hold=0;
}
/* The tour, for one frame. Mandelbrot: to a target, rest, on to another. Julia: to the fixed point, rest, back out,
   then the constant slides to the next set's while the whole set is in view. */
function tour(julia,dt,rate){
  var t,fp,k;
  if(!julia){
    if(zp.ti<0)nextTarget();
    t=ZTARGETS[zp.ti];
    if(pilotTo(zm,t.x,t.y*zp.flip,targetDepth(t,zoomCap()),dt,rate)){zp.hold+=dt;if(zp.hold>ZHOLD)nextTarget();}
    return;
  }
  if(zp.phase===0){
    fp=fixedPoint(zm.jx,zm.jy);
    if(pilotTo(zm,fp[0],fp[1],JDEPTH,dt,rate)){zp.hold+=dt;if(zp.hold>ZHOLD){zp.phase=1;zp.hold=0;}}
  }else if(zp.phase===1){
    zm.s=Math.min(ZTOP,zm.s*Math.exp(1.6*rate*dt));
    if(zm.s>0.4){k=1-Math.exp(-2*dt);zm.x-=zm.x*k;zm.y-=zm.y*k;}
    if(zm.s>=ZTOP){zp.phase=2;zp.turn=0;zp.fx=zm.jx;zp.fy=zm.jy;zp.ji=(zp.ji+1)%JULIAS.length;}
  }else{
    zp.turn=Math.min(1,zp.turn+dt/6);k=zp.turn*zp.turn*(3-2*zp.turn);
    zm.jx=zp.fx+(JULIAS[zp.ji][0]-zp.fx)*k;zm.jy=zp.fy+(JULIAS[zp.ji][1]-zp.fy)*k;
    if(zp.turn>=1)zp.phase=0;
  }
}
/* Coming into a zoom world: the whole set in view. Each visit to the Julia world shows the next set. */
export function zoomEnter(w){
  zm.s=ZTOP;zm.rot=0;zm.y=0;zm.x=w.julia?0:-0.6;zp.ti=-1;zp.phase=0;zp.hold=0;
  if(w.julia){zp.ji=(zp.ji+1)%JULIAS.length;zm.jx=JULIAS[zp.ji][0];zm.jy=JULIAS[zp.ji][1];}
}
/* A frame's step for a zoom world, after the camera's own. Looking and the sideways keys slide the picture, forward and
   back zoom, roll turns it. Left alone it zooms slowly in (Drift), or takes the tour (Journey). */
export function stepZoom(fr){
  var w=fr.w;
  if(!w.flat)return;
  var dt=fr.dt,cr=Math.cos(zm.rot),sr=Math.sin(zm.rot);
  var px=fr.lx*1.15+fr.mx*0.9*dt,py=-fr.ly*1.15+fr.my*0.9*dt;
  var rate=0.45*cam.baseSpeed*(1+3*cam.boost),own=fr.idle&&fr.mx===0&&fr.my===0&&fr.uz===0;
  zm.x+=(cr*px-sr*py)*zm.s;zm.y+=(sr*px+cr*py)*zm.s;
  zm.rot+=cam.rollIn*dt-fr.gr;
  if(!started)zm.s*=Math.exp(-0.18*rate*dt);
  else if(fr.uz!==0)zm.s*=Math.exp(-1.6*fr.uz*rate*dt);
  else if(own&&fr.travel)tour(!!w.julia,dt*fr.ease,rate);
  else if(own&&drift&&!still)zm.s*=Math.exp(-0.3*rate*dt*fr.ease);
  zm.s=Math.max(ZMIN,Math.min(2*ZTOP,zm.s));
  zm.x=Math.max(-3,Math.min(3,zm.x));zm.y=Math.max(-3,Math.min(3,zm.y));
}
/* everything that decides the picture, as one string: Hold still compares it from frame to frame */
export function zoomKey(){return zm.x+","+zm.y+","+zm.s+","+zm.rot+","+zm.jx+","+zm.jy;}

/* Before a zoom world is drawn: work out the reference paths for the middle of the view and hand them to the shader.
   The shader follows each pixel only as its difference from a reference path, which stays small enough for its numbers.
   Row 0 is the path of the view's middle; row 1 is the path from zero, which a pixel moves to if it comes nearer zero
   than its own difference. For the Mandelbrot set the two are the same path. */
export function zoomUniforms(U,w){
  var jul=!!w.julia,key=(jul?"j":"m")+zm.x+","+zm.y+(jul?","+zm.jx+","+zm.jy:"");
  if(!refTex){
    refBuf=new Float32Array(REF_W*2*4);refTex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,refTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,REF_W,2,0,gl.RGBA,gl.FLOAT,refBuf);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    refKey="";
  }
  bindTex(2,refTex);
  if(key!==refKey){
    refKey=key;
    if(jul){refLen[0]=refOrbit(refBuf,0,zm.x,zm.y,zm.jx,zm.jy);refLen[1]=refOrbit(refBuf,1,0,0,zm.jx,zm.jy);}
    else{refLen[0]=refOrbit(refBuf,0,0,0,zm.x,zm.y);refLen[1]=refOrbit(refBuf,1,0,0,zm.x,zm.y);}
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,REF_W,2,gl.RGBA,gl.FLOAT,refBuf);
  }
  gl.uniform1i(U.uRef,2);
  gl.uniform4f(U.uZ,zm.s,Math.cos(zm.rot),Math.sin(zm.rot),jul?1:0);
  gl.uniform3f(U.uZn,refLen[0],refLen[1],zoomIter(zm.s,zoomCap(),jul));
}
/* Whether this device can hold the reference paths (a picture of real numbers). Without it the zoom worlds are skipped. */
export function zoomOk(){return floatOk;}

/* A zoom world's part of a share link: 14 letters and digits. A view that the tour has centred on a target is kept
   exactly, by the target's number. Any other view keeps its middle to about three millionths, so it comes back right
   only down to an s of about a thousandth. */
export function zoomSpot(w){
  var ti=0,i,fp,top=Math.pow(36,4)-1,ji=0,best=1e9,d;
  if(w.julia){
    fp=fixedPoint(zm.jx,zm.jy);if(zm.x===fp[0]&&zm.y===fp[1])ti=1;
    for(i=0;i<JULIAS.length;i++){d=Math.hypot(JULIAS[i][0]-zm.jx,JULIAS[i][1]-zm.jy);if(d<best){best=d;ji=i;}}
  }else for(i=0;i<ZTARGETS.length;i++)if(zm.x===ZTARGETS[i].x&&Math.abs(zm.y)===Math.abs(ZTARGETS[i].y))ti=i+1+(zm.y<0?18:0);
  var turn=zm.rot/(2*Math.PI);turn-=Math.floor(turn);
  return b36(ti,1)+b36((zm.x+3)/6*top,4)+b36((zm.y+3)/6*top,4)+b36((Math.log(zm.s)/Math.LN10+12.5)/13*1295,2)+b36(turn*35,1)+b36(ji,1)+"0";
}
export function zoomFromSpot(w,t){
  var n=function(a,b){return parseInt(t.slice(a,b),36)},top=Math.pow(36,4)-1,ti=n(0,1),ji=n(12,13),fp,tg;
  zoomEnter(w);
  zm.x=n(1,5)/top*6-3;zm.y=n(5,9)/top*6-3;
  zm.s=Math.max(ZMIN,Math.min(2*ZTOP,Math.pow(10,n(9,11)/1295*13-12.5)));
  zm.rot=n(11,12)/35*2*Math.PI;
  if(w.julia){
    if(ji<JULIAS.length){zp.ji=ji;zm.jx=JULIAS[ji][0];zm.jy=JULIAS[ji][1];}
    if(ti===1){fp=fixedPoint(zm.jx,zm.jy);zm.x=fp[0];zm.y=fp[1];}else zm.s=Math.max(zm.s,1e-3);
  }else{
    tg=ZTARGETS[(ti>18?ti-18:ti)-1];
    if(tg){zm.x=tg.x;zm.y=ti>18?-tg.y:tg.y;zp.ti=ZTARGETS.indexOf(tg);zp.flip=ti>18?-1:1;}else zm.s=Math.max(zm.s,1e-3);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
floatOk=!!gl.getExtension("OES_texture_float");
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={zm, zp, ZTOP, ZMIN, ZBAIL, REF_W, ZHOLD, ZTARGETS, JULIAS, JDEPTH, refOrbit, fixedPoint, zoomIter, targetDepth, zoomCap, pilotTo, nextTarget, tour,
  zoomEnter, stepZoom, zoomKey, zoomUniforms, zoomOk, zoomSpot, zoomFromSpot, refLen,
  get refTex(){return refTex},set refTex(v){refTex=v}, get refBuf(){return refBuf},set refBuf(v){refBuf=v}, get refKey(){return refKey},set refKey(v){refKey=v},
  get floatOk(){return floatOk},set floatOk(v){floatOk=v}};
