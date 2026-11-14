/* The zoom worlds: the Mandelbrot set and Julia sets seen flat, from above, zooming in on a point and out again. */
import { cam } from "./camera.js";
import { drift } from "./controls.js";
import { $, calm, canvas, gl, isTouch, toast } from "./dom.js";
import { wakeHud } from "./input.js";
import { started } from "./loop.js";
import { bindTex } from "./programs.js";
import { b36 } from "./spots.js";
import { still } from "./still.js";

/* Where the view is: its middle (x, y), the distance s from the middle to the top of a square picture, how far it is
   turned, and the Julia set's constant (jx, jy). The middle is held as exactly as JavaScript can, about 16 digits, which
   is what lets the picture be magnified a trillion times. The picture's own middle need not be that point: it is
   (ox, oy) away from it, measured in units of s, so that a view can zoom in on one exact point while showing what is
   beside it. (wx, wy) is how far the sound and the morph have pushed the Julia constant this frame. */
export const zm={x:-0.6,y:0,s:1.5,rot:0,jx:-0.8,jy:0.156,ox:0,oy:0,wx:0,wy:0};
/* where the busy part of the picture was when last measured (in the shader's units from the middle of the picture, and
   how busy), a count of frames between measurements, and the low end of the sound, smoothed */
export const zi={u:0,v:0,k:0,n:0,low:0};
/* The patterns in the open parts of the picture. The Pattern button: "changes" lets the tour pick a new one at each
   place it goes to; the others hold one. zw is how much of cells and of stripes is showing now (c, s) and what that is
   easing toward (tc, ts), so that a change fades over a few seconds. */
export const PATTERNS=["changes","cells","stripes","none"];
export let zpat=0;
export const zw={c:1,s:0,tc:1,ts:0};
export const IGRID=12;    /* the picture is measured at this many points across and down */
export const ISTEP=12;    /* a jump in step count between neighbours counts no more than this */
export const JPUSH=0.02;  /* the most the sound pushes the Julia constant, with the whole set in view */
/* the tour: which target, mirrored top to bottom or not, what it is doing, and its clocks */
export const zp={ti:-1,flip:1,phase:0,hold:0,ji:0,turn:0,fx:0,fy:0};
export const ZTOP=1.5;    /* the whole set in view */
export const ZMIN=1e-12;  /* past this the middle cannot be told from its neighbours */
export const ZBAIL=256;   /* a point has left for good once its distance, squared, passes this */
export const REF_W=1024;  /* the most steps a reference path can hold, and so the most the shader takes on any device */
export const ZHOLD=2.5;   /* seconds the tour rests at the bottom of a zoom */
export const ZTURN=0.05;  /* how fast the tour turns the picture while it zooms, in radians a second at normal speed */
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
  {name:"the small copy on the needle",x:-1.754877666246693,y:0,d:0.03,per:60},
  /* thirteen more, picked from a search of every such point with a short path for the ones that spiral most.
     New ones go at the end: a share link holds a target by its number in this list. */
  {name:"a wheel in the seahorse valley",x:-0.7241126829735736,y:0.2864565676767114,d:3e-12,per:66},
  {name:"a wheel under the top bulb",x:0.0578097266004744,y:0.6565465275602506,d:3e-12,per:54},
  {name:"a star on the left shoulder",x:-0.6702091879032538,y:0.4580609752969459,d:3e-12,per:30},
  {name:"a turning star",x:-0.48316056822541426,y:0.6255368160611827,d:3e-12,per:29},
  {name:"a tight whirlpool",x:0.35498972023509345,y:0.40741891112344364,d:3e-12,per:51},
  {name:"a whirlpool of three arms",x:0.23494522217044456,y:0.5832912515911978,d:3e-12,per:34},
  {name:"a whirlpool of two arms",x:-0.013895587301467427,y:0.7151808370525766,d:3e-12,per:27},
  {name:"a hooked spiral",x:-0.8739318846956909,y:0.2553828556640232,d:3e-12,per:16},
  {name:"a five-way star",x:-0.5622026215230372,y:0.6428171490727753,d:3e-12,per:18},
  {name:"a bent branch",x:-0.2516784749251739,y:0.7667854776633735,d:3e-12,per:18},
  {name:"a wheel beside the elephants",x:0.3973918222965412,y:0.13351120487187762,d:3e-12,per:32},
  {name:"a wheel of two kinds of spoke",x:-0.859763606885534,y:0.23487896427687147,d:3e-12,per:51},
  {name:"a wheel on the right edge",x:0.4245127190500396,y:0.20753022816674532,d:3e-12,per:25}
];
/* Julia sets worth seeing: the constant for each. The tour zooms in on the point of each that stays put (see fixedPoint). */
export const JULIAS=[[-0.8,0.156],[-0.4,0.6],[0.285,0.01],[-0.7269,0.1889],[-0.835,-0.2321],[-0.123,0.745],[0.355,0.355],[-0.70176,-0.3842],[-0.75,0.11],[0.0,0.8],
  [0.3,0.5],[-0.12,-0.77],[-0.79,0.15],[0.37,0.1],[-1.25,0.02]];
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
export function fixedPoint(cx,cy,bx,by){
  var ax=1-4*cx,ay=-4*cy,r=Math.hypot(ax,ay),sx=Math.sqrt((r+ax)/2),sy=Math.sqrt(Math.max(0,(r-ax)/2))*(ay<0?-1:1),first;
  /* which of the two is decided by (bx, by) when given: the constant before the sound pushed it, so that the choice does not flip with the music */
  if(bx===undefined)first=Math.hypot(1-sx,sy)>1.045;
  else{
    /* the square root has two signs; take the one on the same side as the unpushed constant's, or the point would jump */
    var qx=1-4*bx,qy=-4*by,qr=Math.hypot(qx,qy),tx=Math.sqrt((qr+qx)/2),ty=Math.sqrt(Math.max(0,(qr-qx)/2))*(qy<0?-1:1);
    if(sx*tx+sy*ty<0){sx=-sx;sy=-sy;}
    first=Math.hypot(1-tx,ty)>1.045;
  }
  if(first)return [(1-sx)/2,-sy/2];
  return [(1+sx)/2,sy/2];
}
/* whether fixedPoint uses the first candidate for this constant */
export function fixedFirst(cx,cy){
  var ax=1-4*cx,ay=-4*cy,r=Math.hypot(ax,ay),sx=Math.sqrt((r+ax)/2),sy=Math.sqrt(Math.max(0,(r-ax)/2))*(ay<0?-1:1);
  return Math.hypot(1-sx,sy)>1.045;
}
/* Where the busy part of a view is. The view (its middle, size and turn; half its width ax and half its height ay in
   the shader's units) is sampled on a grid, each point followed to its step count. A point counts by how much its
   count differs from its neighbours', squared: flat colour counts for almost nothing, fine detail for a lot. Returns
   the middle of all that, measured from the middle of the picture, and how busy the view is on average (0 to 1). */
export function interest(mx,my,s,rot,ax,ay,jul,jx,jy,iters){
  var N=IGRID,v=[],cr=Math.cos(rot),sr=Math.sin(rot),i,j,u,q,px,py,zx,zy,cx,cy,n,t,m2,d,k,su=0,sv=0,sw=0;
  for(j=0;j<N;j++)for(i=0;i<N;i++){
    u=((i+0.5)/N*2-1)*ax;q=((j+0.5)/N*2-1)*ay;
    px=mx+(cr*u-sr*q)*s;py=my+(sr*u+cr*q)*s;
    if(jul){zx=px;zy=py;cx=jx;cy=jy;}else{zx=0;zy=0;cx=px;cy=py;}
    for(n=0;n<iters;n++){m2=zx*zx+zy*zy;if(m2>ZBAIL)break;t=zx*zx-zy*zy+cx;zy=2*zx*zy+cy;zx=t;}
    v.push(n<iters?n+1-Math.log(0.5*Math.log(m2)/Math.LN2)/Math.LN2:iters);
  }
  for(j=0;j<N;j++)for(i=0;i<N;i++){
    k=j*N+i;d=0;
    if(i>0)d=Math.max(d,Math.abs(v[k]-v[k-1]));if(i<N-1)d=Math.max(d,Math.abs(v[k]-v[k+1]));
    if(j>0)d=Math.max(d,Math.abs(v[k]-v[k-N]));if(j<N-1)d=Math.max(d,Math.abs(v[k]-v[k+N]));
    d=Math.min(d,ISTEP);d*=d;
    su+=d*((i+0.5)/N*2-1)*ax;sv+=d*((j+0.5)/N*2-1)*ay;sw+=d;
  }
  return sw>0?[su/sw,sv/sw,sw/(N*N*ISTEP*ISTEP)]:[0,0,0];
}
/* The picture's middle moves toward the busy part (u, v), by the share f of the way. The exact point the view is
   zooming on is not moved, and is kept on the picture: no nearer an edge than a quarter of the way in from it. */
export function centreOn(z,u,v,f,ax,ay){
  var cr=Math.cos(z.rot),sr=Math.sin(z.rot),tu,tv;
  z.ox+=(cr*u-sr*v)*f;z.oy+=(sr*u+cr*v)*f;
  tu=-(cr*z.ox+sr*z.oy);tv=-(-sr*z.ox+cr*z.oy); /* where the exact point is on the picture */
  tu=Math.max(-0.75*ax,Math.min(0.75*ax,tu));tv=Math.max(-0.75*ay,Math.min(0.75*ay,tv));
  z.ox=-(cr*tu-sr*tv);z.oy=-(sr*tu+cr*tv);
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
/* which pattern a number from 0 to 1 picks: cells a little under half the time, stripes a third, none a fifth */
export function patternPick(r){return r<0.45?1:(r<0.8?2:3);}
function patternAim(k){zw.tc=k===1?1:0;zw.ts=k===2?1:0;}
export function setPattern(i){
  zpat=((i%PATTERNS.length)+PATTERNS.length)%PATTERNS.length;
  if(zpat)patternAim(zpat);
  $("bPattern").textContent="Pattern "+PATTERNS[zpat];
}
function nextTarget(){
  if(zpat===0)patternAim(patternPick(Math.random()));
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
    else zm.rot+=ZTURN*zp.flip*rate/0.45*dt; /* a slow turn on the way, one way or the other; it rests with the zoom */
    return;
  }
  if(zp.phase===0){
    fp=fixedPoint(zm.jx+zm.wx,zm.jy+zm.wy,zm.jx,zm.jy);
    if(pilotTo(zm,fp[0],fp[1],JDEPTH,dt,rate)){zp.hold+=dt;if(zp.hold>ZHOLD){zp.phase=1;zp.hold=0;}}
    else zm.rot+=ZTURN*rate/0.45*dt;
  }else if(zp.phase===1){
    zm.s=Math.min(ZTOP,zm.s*Math.exp(1.6*rate*dt));
    if(zm.s>0.4){k=1-Math.exp(-2*dt);zm.x-=zm.x*k;zm.y-=zm.y*k;}
    if(zm.s>=ZTOP){zp.phase=2;zp.turn=0;if(zpat===0)patternAim(patternPick(Math.random()));zp.fx=zm.jx;zp.fy=zm.jy;zp.ji=(zp.ji+1)%JULIAS.length;}
  }else{
    zp.turn=Math.min(1,zp.turn+dt/6);k=zp.turn*zp.turn*(3-2*zp.turn);
    zm.jx=zp.fx+(JULIAS[zp.ji][0]-zp.fx)*k;zm.jy=zp.fy+(JULIAS[zp.ji][1]-zp.fy)*k;
    if(zp.turn>=1)zp.phase=0;
  }
}
/* Coming into a zoom world: the whole set in view. Each visit to the Julia world shows the next set. */
export function zoomEnter(w){
  zm.s=ZTOP;zm.rot=0;zm.y=0;zm.x=w.julia?0:-0.6;zm.ox=zm.oy=zm.wx=zm.wy=0;zi.u=zi.v=zi.k=zi.n=0;zp.ti=-1;zp.phase=0;zp.hold=0;
  if(w.julia){zp.ji=(zp.ji+1)%JULIAS.length;zm.jx=JULIAS[zp.ji][0];zm.jy=JULIAS[zp.ji][1];}
}
/* The Julia constant follows the music: the low end of the sound, smoothed over about a third of a second, and the
   morph push it a little way, less the deeper the view is (deep in, a small push already turns the whole picture). The
   view rides along with the point it is zooming on, which moves when the constant does. */
function juliaPush(fr){
  var dec=Math.max(0,Math.log(ZTOP/zm.s)/Math.LN10),a=JPUSH*(calm?0.3:1)/(1+2.5*dec),was,now;
  zi.low+=(fr.lv-zi.low)*(1-Math.exp(-fr.dt/0.35));
  was=fixedPoint(zm.jx+zm.wx,zm.jy+zm.wy,zm.jx,zm.jy);
  zm.wx=a*(1.5*zi.low*0.54-0.5*fr.m*0.84);zm.wy=a*(1.5*zi.low*0.84+0.5*fr.m*0.54);
  now=fixedPoint(zm.jx+zm.wx,zm.jy+zm.wy,zm.jx,zm.jy);
  if(zm.x===was[0]&&zm.y===was[1]){zm.x=now[0];zm.y=now[1];}else{zm.x+=now[0]-was[0];zm.y+=now[1]-was[1];}
}
/* A frame's step for a zoom world, after the camera's own. Looking and the sideways keys slide the picture, forward and
   back zoom, roll turns it. Left alone it zooms slowly in (Drift), or takes the tour (Journey); either way the picture
   is kept on its busy part. */
export function stepZoom(fr){
  var w=fr.w;
  if(!w.flat)return;
  var dt=fr.dt,cr=Math.cos(zm.rot),sr=Math.sin(zm.rot);
  var px=fr.lx*1.15+fr.mx*0.9*dt,py=-fr.ly*1.15+fr.my*0.9*dt;
  var rate=0.45*cam.baseSpeed*(1+3*cam.boost),own=fr.idle&&fr.mx===0&&fr.my===0&&fr.uz===0&&fr.lx===0&&fr.ly===0;
  var ax=Math.sqrt((canvas.width||1)/(canvas.height||1)),ay=1/ax,auto=own&&started&&!still&&(fr.travel||drift),c;
  if(w.julia&&!still)juliaPush(fr);
  if(!still){ /* a change of pattern fades in over a few seconds, and then sits exactly on its value */
    c=1-Math.exp(-dt/1.2);zw.c+=(zw.tc-zw.c)*c;zw.s+=(zw.ts-zw.s)*c;
    if(Math.abs(zw.tc-zw.c)<0.004)zw.c=zw.tc;if(Math.abs(zw.ts-zw.s)<0.004)zw.s=zw.ts;
  }
  if(!own&&(zm.ox!==0||zm.oy!==0)){zm.x+=zm.ox*zm.s;zm.y+=zm.oy*zm.s;zm.ox=zm.oy=0;} /* the user has the picture: its middle is the point again */
  if(auto){
    if(zi.n--<=0){ /* measured every fourth frame; the view moves toward it every frame */
      c=interest(zm.x+zm.ox*zm.s,zm.y+zm.oy*zm.s,zm.s,zm.rot,ax,ay,!!w.julia,zm.jx+zm.wx,zm.jy+zm.wy,zoomIter(zm.s,zoomCap(),!!w.julia));
      zi.u=c[0];zi.v=c[1];zi.k=c[2];zi.n=3;
    }
    if(fr.travel)centreOn(zm,zi.u,zi.v,1-Math.exp(-1.2*dt*fr.ease),ax,ay);
    else{c=0.6*dt*fr.ease*zm.s;zm.x+=(cr*zi.u-sr*zi.v)*c;zm.y+=(sr*zi.u+cr*zi.v)*c;} /* Drift has no exact point to keep: the middle itself moves */
  }
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
export function zoomKey(){return zm.x+","+zm.y+","+zm.s+","+zm.rot+","+zm.jx+","+zm.jy+","+zm.ox+","+zm.oy+","+zm.wx+","+zm.wy+","+zw.c+","+zw.s;}

/* Before a zoom world is drawn: work out the reference paths for the middle of the view and hand them to the shader.
   The shader follows each pixel only as its difference from a reference path, which stays small enough for its numbers.
   Row 0 is the path of the view's middle; row 1 is the path from zero, which a pixel moves to if it comes nearer zero
   than its own difference. For the Mandelbrot set the two are the same path. */
export function zoomUniforms(U,w){
  var jul=!!w.julia,jx=zm.jx+zm.wx,jy=zm.jy+zm.wy,key=(jul?"j":"m")+zm.x+","+zm.y+(jul?","+jx+","+jy:"");
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
    if(jul){refLen[0]=refOrbit(refBuf,0,zm.x,zm.y,jx,jy);refLen[1]=refOrbit(refBuf,1,0,0,jx,jy);}
    else{refLen[0]=refOrbit(refBuf,0,0,0,zm.x,zm.y);refLen[1]=refOrbit(refBuf,1,0,0,zm.x,zm.y);}
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,REF_W,2,gl.RGBA,gl.FLOAT,refBuf);
  }
  gl.uniform1i(U.uRef,2);
  gl.uniform4f(U.uZ,zm.s,Math.cos(zm.rot),Math.sin(zm.rot),jul?1:0);
  gl.uniform2f(U.uZo,zm.ox,zm.oy);gl.uniform2f(U.uZs,zw.c,zw.s);
  gl.uniform3f(U.uZn,refLen[0],refLen[1],zoomIter(zm.s,zoomCap(),jul));
}
/* Whether this device can hold the reference paths (a picture of real numbers). Without it the zoom worlds are skipped. */
export function zoomOk(){return floatOk;}

/* A zoom world's part of a share link: 14 letters and digits. A view that the tour has centred on a target is kept
   exactly, by the target's number. Any other view keeps its middle to about three millionths, so it comes back right
   only down to an s of about a thousandth. On a target, the two numbers for the middle hold instead how far the
   picture's middle is from the target. The last character says how to read the first: 1, a target's number plus
   one; 2, the same with the picture mirrored top to bottom; 0, the first form of link, which had room for 17 targets,
   added 18 for a mirrored one and always had the target in the middle. One character holds 35 targets at most. */
export function zoomSpot(w){
  var ti=0,fl=1,i,fp,top=Math.pow(36,4)-1,ji=0,best=1e9,d;
  if(w.julia){
    fp=fixedPoint(zm.jx+zm.wx,zm.jy+zm.wy,zm.jx,zm.jy);if(zm.x===fp[0]&&zm.y===fp[1])ti=1;
    for(i=0;i<JULIAS.length;i++){d=Math.hypot(JULIAS[i][0]-zm.jx,JULIAS[i][1]-zm.jy);if(d<best){best=d;ji=i;}}
  }else for(i=0;i<ZTARGETS.length;i++)if(i<35&&zm.x===ZTARGETS[i].x&&Math.abs(zm.y)===Math.abs(ZTARGETS[i].y)){ti=i+1;fl=zm.y<0?2:1;}
  var turn=zm.rot/(2*Math.PI);turn-=Math.floor(turn);
  /* on a target the two middle numbers are not needed for the place, so they hold how far the picture's middle is from it */
  var kx=ti?zm.ox:zm.x+zm.ox*zm.s,ky=ti?zm.oy:zm.y+zm.oy*zm.s;
  return b36(ti,1)+b36((Math.max(-3,Math.min(3,kx))+3)/6*top,4)+b36((Math.max(-3,Math.min(3,ky))+3)/6*top,4)+b36((Math.log(zm.s)/Math.LN10+12.5)/13*1295,2)+b36(turn*35,1)+b36(ji,1)+b36(fl,1);
}
export function zoomFromSpot(w,t){
  var n=function(a,b){return parseInt(t.slice(a,b),36)},top=Math.pow(36,4)-1,ti=n(0,1),ji=n(12,13),fl=n(13,14),fp,tg,down;
  zoomEnter(w);
  var kx=n(1,5)/top*6-3,ky=n(5,9)/top*6-3,off=fl!==0&&ti>0;
  zm.x=kx;zm.y=ky;
  zm.s=Math.max(ZMIN,Math.min(2*ZTOP,Math.pow(10,n(9,11)/1295*13-12.5)));
  zm.rot=n(11,12)/35*2*Math.PI;
  if(w.julia){
    if(ji<JULIAS.length){zp.ji=ji;zm.jx=JULIAS[ji][0];zm.jy=JULIAS[ji][1];}
    if(ti===1){fp=fixedPoint(zm.jx,zm.jy);zm.x=fp[0];zm.y=fp[1];if(off){zm.ox=kx;zm.oy=ky;}}else zm.s=Math.max(zm.s,1e-3);
  }else{
    down=fl===0?ti>18:fl===2;
    tg=ZTARGETS[(fl===0&&ti>18?ti-18:ti)-1];
    if(tg){zm.x=tg.x;zm.y=down?-tg.y:tg.y;zp.ti=ZTARGETS.indexOf(tg);zp.flip=down?-1:1;if(off){zm.ox=kx;zm.oy=ky;}}else zm.s=Math.max(zm.s,1e-3);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
floatOk=!!gl.getExtension("OES_texture_float");
$("bPattern").addEventListener("click",function(){
  setPattern(zpat+1);
  toast(zpat?"Zoom worlds: the pattern is "+PATTERNS[zpat]:"Zoom worlds: Journey changes the pattern at each new place");wakeHud();
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={zm, zp, zi, zw, PATTERNS, patternPick, patternAim, setPattern, get zpat(){return zpat},set zpat(v){zpat=v}, IGRID, ISTEP, JPUSH, fixedFirst, interest, centreOn, juliaPush, ZTOP, ZMIN, ZBAIL, REF_W, ZHOLD, ZTURN, ZTARGETS, JULIAS, JDEPTH, refOrbit, fixedPoint, zoomIter, targetDepth, zoomCap, pilotTo, nextTarget, tour,
  zoomEnter, stepZoom, zoomKey, zoomUniforms, zoomOk, zoomSpot, zoomFromSpot, refLen,
  get refTex(){return refTex},set refTex(v){refTex=v}, get refBuf(){return refBuf},set refBuf(v){refBuf=v}, get refKey(){return refKey},set refKey(v){refKey=v},
  get floatOk(){return floatOk},set floatOk(v){floatOk=v}};
