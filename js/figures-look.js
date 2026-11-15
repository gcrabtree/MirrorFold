/* The drawings of the fifth track of lessons: colour (three numbers, a wave, a palette of three waves), trails (a picture
   that remembers the one before), filters (a rule for every square) and sound (waves added together and taken apart).
   They have the same form as the ones in figures.js; see the comment at the top of that file. The arithmetic needs no page.
   The palettes and motions are the app's own, read from palettes.js and state.js when a step is shown. */
import { calm } from "./dom.js";
import { INK, DIM, FAINT, HOT, COOL, clear, words, dot, handle, num, clamp, round, keyOf, hopsOut, HOPMAX, REG } from "./figures.js";
import { newRaster, rasterStep, rasterPaint } from "./figures-more.js";
import { PALETTES } from "./palettes.js";
import { MOTIONS } from "./state.js";
const TURN=6.2831853;
const TONES=[1,4,12];                 /* how many times the low, middle and high waves repeat across the drawing */
const BLOCKS=[1,2,4,8,16,30];         /* the mosaic's block sizes */
const SW=240,SH=150;                  /* the size of the picture the filters work on */
const NPALS=5,NMOTS=5;                /* how many of the app's palettes and motions get a button */

/* ---- the arithmetic ---- */
/* one wave: middle a, size b, repeated c times, slid by d; x goes from 0 to 1 */
export function waveAt(a,b,c,d,x){return a+b*Math.cos(TURN*(c*x+d));}
/* a palette's colour at x: three such waves, each held between 0 and 1 */
export function palAt(P,x){var j,o=[];for(j=0;j<3;j++)o.push(clamp(waveAt(P.a[j],P.b[j],P.c[j],P.d[j],x),0,1));return o;}
/* three waves added: the amounts of the low, middle and high one */
export function mixAt(A,x){return A[0]*Math.cos(TURN*TONES[0]*x)+A[1]*Math.cos(TURN*TONES[1]*x)+A[2]*Math.cos(TURN*TONES[2]*x);}
/* How much of pure wave k is in the mixture: multiply the two point by point, average, and double. It gives back the amount
   that went in. */
export function bandOf(A,k){var i,n=240,s=0;for(i=0;i<n;i++)s+=mixAt(A,(i+.5)/n)*Math.cos(TURN*TONES[k]*(i+.5)/n);return 2*s/n;}
/* a number from 0 to 1 cut down to n levels */
export function cutTo(x,n){return Math.min(n-1,Math.floor(x*n))/(n-1);}
/* The picture the filters work on: the Mandelbrot set in the first palette's colours, as red, green, blue from 0 to 1 for
   each of SW by SH squares. Made once. */
let source=null;
export function sourcePic(){
  var i,n,c,x,y;
  if(source)return source;
  source=new Float32Array(SW*SH*3);
  for(i=0;i<SW*SH;i++){
    x=REG.x0+(i%SW+.5)/SW*(REG.x1-REG.x0);y=REG.y1-(Math.floor(i/SW)+.5)/SH*(REG.y1-REG.y0);
    n=hopsOut(x,y,120);c=n?palAt(PALETTES[0],n/24+.55):[.03,.02,.08];
    source[i*3]=c[0];source[i*3+1]=c[1];source[i*3+2]=c[2];
  }
  return source;
}
function srcAt(x,y,j){return sourcePic()[(clamp(Math.round(y),0,SH-1)*SW+clamp(Math.round(x),0,SW-1))*3+j];}
/* The picture with every square made the average of the squares up to r away from it, across and up. Done as two passes,
   across and then up, which gives the same answer as averaging the whole block and is far quicker. Kept for the last r. */
let blurred=null,blurredR=-1;
export function blurPic(r){
  var S=sourcePic(),T,x,y,j,i,s,n=2*r+1;
  if(blurredR===r)return blurred;
  T=new Float32Array(SW*SH*3);blurred=new Float32Array(SW*SH*3);blurredR=r;
  for(y=0;y<SH;y++)for(x=0;x<SW;x++)for(j=0;j<3;j++){s=0;for(i=-r;i<=r;i++)s+=S[(y*SW+clamp(x+i,0,SW-1))*3+j];T[(y*SW+x)*3+j]=s/n;}
  for(y=0;y<SH;y++)for(x=0;x<SW;x++)for(j=0;j<3;j++){s=0;for(i=-r;i<=r;i++)s+=T[(clamp(y+i,0,SH-1)*SW+x)*3+j];blurred[(y*SW+x)*3+j]=s/n;}
  return blurred;
}
/* where a square looks for its colour under the bulge: the same direction from the middle, nearer or further */
export function bulgeFrom(x,y,k){
  var dx=(x-SW/2)/(SH/2),dy=(y-SH/2)/(SH/2),r2=dx*dx+dy*dy,f=r2<1?1-k*(1-r2):1;
  return [SW/2+dx*f*SH/2,SH/2+dy*f*SH/2,f];
}
/* one square's colour (channel j) after a filter; mode names the filter and v is its slider */
export function filtered(mode,v,x,y,j){
  var a,p;
  switch(mode){
    case "neg":a=srcAt(x,y,j);return a+(1-2*a)*v;
    case "fewer":return cutTo(srcAt(x,y,j),v);
    case "mosaic":return srcAt(Math.floor(x/v)*v+Math.floor(v/2),Math.floor(y/v)*v+Math.floor(v/2),j);
    case "bulge":p=bulgeFrom(x,y,v);return srcAt(p[0],p[1],j);
    case "blur":return blurPic(v)[(y*SW+x)*3+j];
    default:a=Math.abs(srcAt(x+1,y,j)-srcAt(x-1,y,j))+Math.abs(srcAt(x,y+1,j)-srcAt(x,y-1,j));return srcAt(x,y,j)*(1-v)+clamp(a*2.5,0,1)*v;
  }
}

/* ---- drawing helpers ---- */
/* a box to plot in: left, top, width, height; y runs from lo at the bottom to hi at the top */
function plotBox(g,d,x,y,w,h,lo,hi){
  g.strokeStyle=FAINT;g.lineWidth=d;g.strokeRect(x,y,w,h);
  if(lo<0&&hi>0){g.beginPath();g.moveTo(x,y+h*hi/(hi-lo));g.lineTo(x+w,y+h*hi/(hi-lo));g.stroke();}
}
function plot(g,d,x,y,w,h,lo,hi,fn,col,wd){
  var i,n=Math.max(60,Math.round(w/(2*d))),v;
  g.strokeStyle=col;g.lineWidth=(wd||1.8)*d;g.beginPath();
  for(i=0;i<=n;i++){v=y+h*(hi-fn(i/n))/(hi-lo);if(i)g.lineTo(x+w*i/n,v);else g.moveTo(x+w*i/n,v);}
  g.stroke();
}
/* a strip of colour: fn(x) gives red, green, blue from 0 to 1 */
function strip(g,x,y,w,h,fn){
  var i,c;
  for(i=0;i<w;i++){c=fn((i+.5)/w);g.fillStyle="rgb("+Math.round(c[0]*255)+","+Math.round(c[1]*255)+","+Math.round(c[2]*255)+")";g.fillRect(x+i,y,1.5,h);}
}
function sliders(list){return list.map(function(c){return {k:c[0],min:c[1],max:c[2],step:c[3],keys:c[5]||null,label:function(s,t){return t(c[4],num(s[c[0]],c[6]===undefined?2:c[6]))}};});}
function copyPal(P){return {a:P.a.slice(),b:P.b.slice(),c:P.c.slice(),d:P.d.slice()};}
/* the equation of one colour's wave at x, with its numbers filled in */
function waveLine(t,name,P,j,x){return t("learn.l.waveEq",t(name),num(P.a[j]),num(P.b[j]),num(P.c[j]),num(x),num(P.d[j]),num(clamp(waveAt(P.a[j],P.b[j],P.c[j],P.d[j],x),0,1)));}
/* a button for each of the app's first few palettes */
function palKeys(){
  var out=[],i;
  for(i=0;i<NPALS;i++)(function(i){out.push({label:function(){return PALETTES[i]?PALETTES[i].name:""},set:function(s){s.P=copyPal(PALETTES[i]);s.d0=s.P.d[0];s.d1=s.P.d[1];s.d2=s.P.d[2];}});})(i);
  return out;
}

/* A button for each of the app's first few motions (the first in its list is "none"). The app says how much smaller the old
   picture is looked up, so growing is one divided by its zoom; its turn is in radians. */
function motionKeys(){
  var out=[],i;
  for(i=1;i<=NMOTS;i++)(function(i){out.push({label:function(){return MOTIONS[i]?MOTIONS[i].name:""},set:function(s){
    var m=MOTIONS[i];if(!m)return;
    s.decay=Math.min(.97,m.decay||.95);s.grow=1/(m.zoom||1);s.rot=(m.rot||0)*180/Math.PI;s.name=m.name;
  }});})(i);
  return out;
}

/* ---- one wave, shaped by sliders: which says which sliders it has ---- */
function waveFig(o){
  return {
    ctl:sliders(o.mode==="amp"?[["a",0,1,.05,"learn.l.mid",[.5]],["b",0,.5,.05,"learn.l.size",[.5]]]:[["c",.5,4,.5,"learn.l.reps",[1,2,3],1],["d",0,1,.05,"learn.l.slide",[0,.25,.5,.75]]]),
    init:function(){return {a:.5,b:o.mode==="amp"?.3:.5,c:1,d:0}},
    draw:function(g,w,h,s,now,t,d){
      var m=14*d,top=m,ph=h*.62,sy=top+ph+16*d;
      clear(g,w,h);plotBox(g,d,m,top,w-2*m,ph,0,1);
      plot(g,d,m,top,w-2*m,ph,0,1,function(x){return clamp(waveAt(s.a,s.b,s.c,s.d,x),0,1)},COOL);
      g.fillStyle=DIM;words(g,d,10);g.textAlign="left";g.textBaseline="top";g.fillText("1",m+4*d,top+3*d);g.textBaseline="bottom";g.fillText("0",m+4*d,top+ph-3*d);
      /* the same wave as brightness */
      strip(g,m,sy,w-2*m,h-sy-m,function(x){var v=clamp(waveAt(s.a,s.b,s.c,s.d,x),0,1);return [v,v,v];});
    },
    read:function(s,t){
      if(o.mode==="amp")return [t("learn.l.top",num(s.a),num(s.b),num(s.a+s.b)),t("learn.l.bottom",num(s.a),num(s.b),num(s.a-s.b)),s.a+s.b>1.001||s.a-s.b<-.001?t("learn.l.clipped"):t("learn.l.fits")];
      return [t("learn.l.repeats",num(s.c,1)),t("learn.l.slid",num(s.d))];
    }
  };
}

/* ---- trails: each picture is the one before, faded, grown and turned, with something new drawn on it ---- */
/* o.mode: "fade" has a slider for the fade; "grow" one for growing; "spin" one for turning; "motions" a button for each of
   the app's motions; "drive" lets a slow pulse push the growing */
function trailFig(o){
  var W=320,H=200;
  function pulse(now){return .5+.5*Math.sin(now/1000*TURN*(calm?.2:.7));}
  function grow(s,now){return o.mode==="drive"?1+s.amt*pulse(now):s.grow;}
  return {
    ctl:sliders(o.mode==="fade"?[["decay",.8,.97,.01,"learn.l.keep",[.9,.95]]]:o.mode==="grow"?[["grow",.97,1.03,.002,"learn.l.grow",[1],3]]:
                o.mode==="spin"?[["rot",-3,3,.1,"learn.l.rot",[0],1]]:o.mode==="drive"?[["amt",0,.04,.002,"learn.l.amt",[0,.02],3]]:[]),
    keys:o.mode==="motions"?motionKeys():[],
    init:function(){return {decay:o.mode==="fade"?.9:.95,grow:o.mode==="fade"?1:o.mode==="spin"?1.008:1.012,rot:o.mode==="spin"?1:0,amt:.02,name:"",A:null,B:null,ph:0,was:0}},
    draw:function(g,w,h,s,now,t,d){
      var c,q,i,a;
      if(!s.A){s.A=document.createElement("canvas");s.B=document.createElement("canvas");s.A.width=s.B.width=W;s.A.height=s.B.height=H;}
      if(now-s.was>12){ /* one new picture for each frame of the screen, however often draw is called */
        s.was=now;c=s.B.getContext("2d");
        c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation="source-over";c.globalAlpha=1;c.fillStyle="#000";c.fillRect(0,0,W,H);
        /* the picture before: faded, grown and turned about the middle */
        c.globalAlpha=s.decay;c.translate(W/2,H/2);c.rotate(-s.rot*Math.PI/180);c.scale(grow(s,now),grow(s,now));c.drawImage(s.A,-W/2,-H/2);
        c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;
        /* take a little more off, so that a faint trail fades right out and does not stay as a grey smear */
        c.globalCompositeOperation="difference";c.fillStyle="rgb(2,2,2)";c.fillRect(0,0,W,H);c.globalCompositeOperation="source-over";
        /* something new: two dots going slowly round, and for the pulse a ring of still ones */
        s.ph+=calm?.008:.03;
        for(i=0;i<2;i++){a=s.ph+i*Math.PI;c.fillStyle=i?HOT:COOL;c.beginPath();c.arc(W/2+62*Math.cos(a),H/2+62*Math.sin(a),4,0,TURN);c.fill();}
        if(o.mode==="drive")for(i=0;i<6;i++){c.fillStyle=INK;c.beginPath();c.arc(W/2+24*Math.cos(i*TURN/6),H/2+24*Math.sin(i*TURN/6),2.5,0,TURN);c.fill();}
        q=s.A;s.A=s.B;s.B=q;
      }
      g.imageSmoothingEnabled=true;g.drawImage(s.A,0,0,w,h);
      if(o.mode==="drive"){ /* the pulse, as a bar */
        g.fillStyle=FAINT;g.fillRect(10*d,h-18*d,w*.3,8*d);g.fillStyle=HOT;g.fillRect(10*d,h-18*d,w*.3*pulse(now),8*d);
      }
    },
    live:o.mode==="drive", /* its numbers change by themselves, so they are written again every frame */
    read:function(s,t){
      var k=s.decay,p;
      if(o.mode==="fade")return [t("learn.l.afterOne",num(k)),t("learn.l.afterTen",num(k),num(Math.pow(k,10))),t("learn.l.afterSec",num(k),num(Math.pow(k,60),3))];
      if(o.mode==="grow")return [t("learn.l.growOne",num(s.grow,3)),t("learn.l.growSec",num(s.grow,3),num(Math.pow(s.grow,60)))];
      if(o.mode==="spin")return [t("learn.l.rotOne",num(s.rot,1)),t("learn.l.rotSec",num(s.rot,1),num(s.rot*60,0))];
      if(o.mode==="drive"){p=pulse(performance.now());return [t("learn.l.pulse",num(p)),t("learn.l.driven",num(s.amt,3),num(p),num(1+s.amt*p,3))];}
      return [s.name?t("learn.l.motion",s.name):t("learn.l.pick"),t("learn.l.three",num(s.decay),num(s.grow,3),num(s.rot,2))];
    }
  };
}

/* ---- filters: a rule for every square of a picture ---- */
function filterFig(o){
  var C={neg:["amt",0,1,.05,"learn.l.amount",[0,1]],fewer:["n",2,16,1,"learn.l.levels",[2,4,8],0],mosaic:["bi",0,BLOCKS.length-1,1,"learn.l.block",null,0],
         bulge:["k",-.8,.8,.05,"learn.l.bulge",[0]],blur:["r",0,8,1,"learn.l.reach",[0],0],edge:["amt",0,1,.05,"learn.l.amount",[0,1]]}[o.mode];
  function val(s){return o.mode==="mosaic"?BLOCKS[s.bi]:s[C[0]];}
  return {
    ctl:o.mode==="mosaic"?[{k:"bi",min:0,max:BLOCKS.length-1,step:1,label:function(s,t){return t("learn.l.block",BLOCKS[s.bi])}}]:sliders([C]),
    init:function(){return {amt:1,n:4,bi:3,k:.5,r:3,x:150,y:52,sig:null,off:null,img:null}},
    draw:function(g,w,h,s,now,t,d){
      var v=val(s),i,P,x,y;
      if(!s.off){s.off=document.createElement("canvas");s.off.width=SW;s.off.height=SH;s.img=s.off.getContext("2d").createImageData(SW,SH);}
      if(s.sig!==v){
        s.sig=v;P=s.img.data;
        for(y=0;y<SH;y++)for(x=0;x<SW;x++){i=(y*SW+x)*4;P[i]=255*filtered(o.mode,v,x,y,0);P[i+1]=255*filtered(o.mode,v,x,y,1);P[i+2]=255*filtered(o.mode,v,x,y,2);P[i+3]=255;}
        s.off.getContext("2d").putImageData(s.img,0,0);
      }
      g.imageSmoothingEnabled=false;g.drawImage(s.off,0,0,w,h);
      /* the chosen square, and for the bulge the square it takes its colour from */
      g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect(s.x*w/SW-4*d,s.y*h/SH-4*d,8*d+w/SW,8*d+h/SH);
      if(o.mode==="bulge"){i=bulgeFrom(s.x,s.y,v);dot(g,(i[0]+.5)*w/SW,(i[1]+.5)*h/SH,4*d,HOT);}
    },
    drag:function(u,v,s,w,h){s.x=clamp(Math.floor(u/w*SW),0,SW-1);s.y=clamp(Math.floor(v/h*SH),0,SH-1);},
    key:function(dx,dy,s){s.x=clamp(s.x+dx,0,SW-1);s.y=clamp(s.y-dy,0,SH-1);},
    read:function(s,t){
      var v=val(s),a=srcAt(s.x,s.y,0),out=[t("learn.l.sq",s.x,s.y),t("learn.l.red",num(a))],p,q;
      if(o.mode==="neg")out.push(t("learn.l.negSum",num(a),num(1-a)),t("learn.l.mixSum",num(a),num(1-a),num(v),num(filtered("neg",v,s.x,s.y,0))));
      if(o.mode==="fewer")out.push(t("learn.l.cutSum",num(a),v,num(a*v),Math.min(v-1,Math.floor(a*v)),v-1,num(cutTo(a,v))));
      if(o.mode==="mosaic")out.push(t("learn.l.mosSum",v,Math.floor(s.x/v)*v+Math.floor(v/2),Math.floor(s.y/v)*v+Math.floor(v/2)),t("learn.l.now",num(filtered("mosaic",v,s.x,s.y,0))));
      if(o.mode==="bulge"){p=bulgeFrom(s.x,s.y,v);out.push(t("learn.l.bulSum",num(p[2])),t("learn.l.from",Math.round(p[0]),Math.round(p[1])),t("learn.l.now",num(filtered("bulge",v,s.x,s.y,0))));}
      if(o.mode==="blur")out.push(t("learn.l.blurSum",(2*v+1)*(2*v+1)),t("learn.l.now",num(filtered("blur",v,s.x,s.y,0))));
      if(o.mode==="edge"){p=srcAt(s.x+1,s.y,0);q=srcAt(s.x-1,s.y,0);out.push(t("learn.l.edgeA",num(p),num(q),num(Math.abs(p-q))));p=srcAt(s.x,s.y+1,0);q=srcAt(s.x,s.y-1,0);out.push(t("learn.l.edgeU",num(p),num(q),num(Math.abs(p-q))));}
      out.push(t("learn.l.others"));
      return out;
    }
  };
}

/* ---- sound: one wave, three added together, and the mixture taken apart again ---- */
function soundFig(o){
  var NAMES=["learn.l.low","learn.l.midw","learn.l.high"],COLS=[COOL,INK,HOT];
  return {
    ctl:o.mode==="one"?sliders([["f",1,12,1,"learn.l.pitch",null,0],["v",0,1,.05,"learn.l.loud",[.5,1]]]):
        sliders([["lo",0,1,.05,"learn.l.loAmt",[0,.5,1]],["mi",0,1,.05,"learn.l.miAmt",[0,.5,1]],["hi",0,1,.05,"learn.l.hiAmt",[0,.5,1]]]),
    init:function(){return {f:3,v:.7,lo:.8,mi:.4,hi:.2,x:.3}},
    draw:function(g,w,h,s,now,t,d){
      var m=14*d,pw=o.mode==="bands"?(w-2*m)*.66:w-2*m,ph=h-2*m,A=[s.lo,s.mi,s.hi],hi=o.mode==="one"?1.05:2.1,i,bx,bw,v;
      clear(g,w,h);plotBox(g,d,m,m,pw,ph,-hi,hi);
      if(o.mode==="one"){plot(g,d,m,m,pw,ph,-hi,hi,function(x){return s.v*Math.cos(TURN*s.f*x)},COOL);return;}
      for(i=0;i<3;i++)(function(i){plot(g,d,m,m,pw,ph,-hi,hi,function(x){return A[i]*Math.cos(TURN*TONES[i]*x)},i===0?"rgba(95,240,255,.35)":i===1?"rgba(243,236,255,.3)":"rgba(255,95,210,.35)",1);})(i);
      plot(g,d,m,m,pw,ph,-hi,hi,function(x){return mixAt(A,x)},INK,2.2);
      if(o.mode==="mix"){ /* the moment whose sum is written underneath */
        g.strokeStyle=DIM;g.lineWidth=d;g.beginPath();g.moveTo(m+pw*s.x,m);g.lineTo(m+pw*s.x,m+ph);g.stroke();
        handle(g,m+pw*s.x,m+ph*(hi-mixAt(A,s.x))/(2*hi),d,INK);return;
      }
      /* the three amounts, measured back out of the mixture, as bars */
      bx=m+pw+14*d;bw=(w-m-bx)/3;
      for(i=0;i<3;i++){
        v=clamp(bandOf(A,i),0,1);g.fillStyle=FAINT;g.fillRect(bx+i*bw+3*d,m,bw-6*d,ph);
        g.fillStyle=COLS[i];g.fillRect(bx+i*bw+3*d,m+ph*(1-v),bw-6*d,ph*v);
      }
    },
    drag:o.mode==="mix"?function(u,v,s,w){s.x=clamp(round((u-14*(w/640))/(w-28*(w/640)),.01),0,1);}:null,
    key:o.mode==="mix"?function(dx,dy,s){s.x=clamp(round(s.x+dx*.01,.01),0,1);}:null,
    read:function(s,t){
      var A=[s.lo,s.mi,s.hi],i,out=[];
      if(o.mode==="one")return [t("learn.l.pitchIs",s.f),t("learn.l.loudIs",num(s.v))];
      if(o.mode==="mix"){for(i=0;i<3;i++)out.push(t("learn.l.part",t(NAMES[i]),num(A[i]*Math.cos(TURN*TONES[i]*s.x))));out.push(t("learn.l.sum",num(mixAt(A,s.x))));return out;}
      for(i=0;i<3;i++)out.push(t("learn.l.band",t(NAMES[i]),num(bandOf(A,i))));
      out.push(t("learn.l.back"));return out;
    }
  };
}

/* ---- the drawings, by the step's name ---- */
export const LOOK_FIGS={
/* a colour is three numbers */
rgb:{
  ctl:sliders([["r",0,1,.05,"learn.l.rAmt",[0,.5,1]],["g",0,1,.05,"learn.l.gAmt",[0,.5,1]],["b",0,1,.05,"learn.l.bAmt",[0,.5,1]]]),
  keys:[["learn.k.red",1,0,0],["learn.k.yellow",1,1,0],["learn.k.white",1,1,1],["learn.k.grey",.5,.5,.5],["learn.k.cyan",0,1,1]].map(function(k){return {label:function(s,t){return t(k[0])},set:function(s){s.r=k[1];s.g=k[2];s.b=k[3];}};}),
  init:function(){return {r:1,g:.4,b:.8}},
  draw:function(g,w,h,s,now,t,d){
    var m=14*d,bw=(w*.34-m)/3,V=[s.r,s.g,s.b],C=["#ff3030","#30e060","#4070ff"],i;
    clear(g,w,h);
    for(i=0;i<3;i++){g.fillStyle=FAINT;g.fillRect(m+i*bw+3*d,m,bw-6*d,h-2*m);g.fillStyle=C[i];g.fillRect(m+i*bw+3*d,m+(h-2*m)*(1-V[i]),bw-6*d,(h-2*m)*V[i]);}
    g.fillStyle="rgb("+Math.round(s.r*255)+","+Math.round(s.g*255)+","+Math.round(s.b*255)+")";g.fillRect(w*.38,m,w*.62-m,h-2*m);
    g.strokeStyle=FAINT;g.lineWidth=d;g.strokeRect(w*.38,m,w*.62-m,h-2*m);
  },
  read:function(s,t){return [t("learn.l.rgb",num(s.r),num(s.g),num(s.b)),t("learn.l.rgbByte",Math.round(s.r*255),Math.round(s.g*255),Math.round(s.b*255))];}
},
/* a wave: the across part of a point going round a circle */
wave:{
  ctl:[{k:"ang",min:0,max:720,step:5,keys:[0,90,180,270,360,450,540,630,720],label:function(s,t){return t("learn.l.angle",s.ang)}}],
  keys:[0,60,90,180,270,360].map(function(v){return keyOf("ang",v,"learn.l.angle")}),
  init:function(){return {ang:60}},
  draw:function(g,w,h,s,now,t,d){
    var R=h*.3,cx=h*.42,cy=h*.5,a=s.ang*Math.PI/180,x0=h*.9,pw=w-x0-14*d,ph=2*R,px=cx+R*Math.cos(a),py=cy-R*Math.sin(a),gx=x0+pw*s.ang/720,gy=cy-R*Math.cos(a);
    clear(g,w,h);
    g.strokeStyle=DIM;g.lineWidth=d;g.beginPath();g.arc(cx,cy,R,0,TURN);g.stroke();
    g.beginPath();g.moveTo(cx-R-8*d,cy);g.lineTo(cx+R+8*d,cy);g.moveTo(cx,cy-R-8*d);g.lineTo(cx,cy+R+8*d);g.stroke();
    g.strokeStyle=FAINT;g.beginPath();g.moveTo(cx,cy);g.lineTo(px,py);g.stroke();
    /* the across part of the point */
    g.strokeStyle=HOT;g.lineWidth=3*d;g.beginPath();g.moveTo(cx,cy);g.lineTo(px,cy);g.stroke();
    g.strokeStyle=FAINT;g.lineWidth=d;g.setLineDash([3*d,3*d]);g.beginPath();g.moveTo(px,py);g.lineTo(px,cy);g.stroke();g.setLineDash([]);
    dot(g,px,py,5*d,COOL);
    /* the same number for every angle, drawn out as a graph */
    plotBox(g,d,x0,cy-R,pw,ph,-1,1);
    plot(g,d,x0,cy-R,pw,ph,-1,1,function(x){return Math.cos(x*720*Math.PI/180)},"rgba(255,95,210,.45)",1.5);
    g.strokeStyle=HOT;g.lineWidth=3*d;g.beginPath();g.moveTo(gx,cy);g.lineTo(gx,gy);g.stroke();dot(g,gx,gy,5*d,HOT);
    g.fillStyle=DIM;words(g,d,10);g.textAlign="center";g.textBaseline="top";
    [0,360,720].forEach(function(v){g.fillText(v+"°",x0+pw*v/720,cy+R+5*d);});
  },
  read:function(s,t){return [t("learn.l.cosIs",s.ang,num(Math.cos(s.ang*Math.PI/180)))];}
},
amp:waveFig({mode:"amp"}),
freq:waveFig({mode:"freq"}),
/* three waves, one for each of red, green and blue: a palette */
palette:{
  ctl:sliders([["d0",0,1,.01,"learn.l.rSlide"],["d1",0,1,.01,"learn.l.gSlide"],["d2",0,1,.01,"learn.l.bSlide"]]),
  keys:palKeys(),
  init:function(){var P=copyPal(PALETTES[0]);return {P:P,d0:P.d[0],d1:P.d[1],d2:P.d[2],x:.25}},
  changed:function(s){s.P.d=[s.d0,s.d1,s.d2];},
  draw:function(g,w,h,s,now,t,d){
    var m=14*d,ph=h*.56,sy=m+ph+16*d,C=["#ff4040","#40e070","#5080ff"],j,X=m+(w-2*m)*s.x;
    clear(g,w,h);plotBox(g,d,m,m,w-2*m,ph,0,1);
    for(j=0;j<3;j++)(function(j){plot(g,d,m,m,w-2*m,ph,0,1,function(x){return palAt(s.P,x)[j]},C[j]);})(j);
    strip(g,m,sy,w-2*m,h-sy-m,function(x){return palAt(s.P,x)});
    g.strokeStyle=INK;g.lineWidth=d;g.beginPath();g.moveTo(X,m);g.lineTo(X,h-m);g.stroke();
  },
  drag:function(u,v,s,w){s.x=clamp(round((u-14*(w/640))/(w-28*(w/640)),.01),0,1);},
  key:function(dx,dy,s){s.x=clamp(round(s.x+dx*.01,.01),0,1);},
  read:function(s,t){return [t("learn.l.atX",num(s.x)),waveLine(t,"learn.l.rName",s.P,0,s.x),waveLine(t,"learn.l.gName",s.P,1,s.x),waveLine(t,"learn.l.bName",s.P,2,s.x)];}
},
/* the Mandelbrot picture coloured by a palette: the count of hops chooses the place along it */
paint:{
  ctl:sliders([["slide",0,1,.01,"learn.l.pSlide",[0,.5]]]),
  keys:palKeys(),
  init:function(){return {P:copyPal(PALETTES[0]),d0:0,d1:0,d2:0,slide:.55,G:null,sel:-1}},
  draw:function(g,w,h,s,now,t,d){
    var G;
    if(!s.G)s.G=newRaster(256,160);
    G=s.G;
    rasterStep(G,function(i){return hopsOut(REG.x0+(i%256+.5)/256*(REG.x1-REG.x0),REG.y1-(Math.floor(i/256)+.5)/160*(REG.y1-REG.y0),HOPMAX);},1,9);
    rasterPaint(g,w,h,G,function(v){var c;if(v<=0)return [0,0,0];c=palAt(s.P,v/24+s.slide);return [c[0]*255,c[1]*255,c[2]*255];},s.slide+"/"+s.P.a+s.P.b+s.P.c+s.P.d,true);
    if(s.sel>=0){g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect((s.sel%256)*w/256-4*d,Math.floor(s.sel/256)*h/160-4*d,8*d,8*d);}
  },
  drag:function(u,v,s,w,h){s.sel=clamp(Math.floor(u/w*256),0,255)+256*clamp(Math.floor(v/h*160),0,159);},
  key:function(dx,dy,s){var i=s.sel<0?80*256+128:s.sel;s.sel=clamp(Math.floor(i/256)-dy,0,159)*256+clamp(i%256+dx,0,255);},
  read:function(s,t){
    var n,x;
    if(s.sel<0||!s.G||s.G.v[s.sel]<-1.5)return [t("learn.l.tapSq")];
    n=s.G.v[s.sel];if(n<=0)return [t("learn.l.never")];
    x=n/24+s.slide;
    return [t("learn.l.countX",n,num(s.slide),num(x)),waveLine(t,"learn.l.rName",s.P,0,x),waveLine(t,"learn.l.gName",s.P,1,x),waveLine(t,"learn.l.bName",s.P,2,x)];
  }
},
fade:trailFig({mode:"fade"}),
grow:trailFig({mode:"grow"}),
spin:trailFig({mode:"spin"}),
motions:trailFig({mode:"motions"}),
neg:filterFig({mode:"neg"}),
fewer:filterFig({mode:"fewer"}),
mosaic:filterFig({mode:"mosaic"}),
bulge:filterFig({mode:"bulge"}),
blur:filterFig({mode:"blur"}),
edge:filterFig({mode:"edge"}),
sound:soundFig({mode:"one"}),
mix:soundFig({mode:"mix"}),
bands:soundFig({mode:"bands"}),
drive:trailFig({mode:"drive"})
};

/* for the test tools and the browser console: every name in this file */
export const __dbg={LOOK_FIGS, blurPic, TONES, BLOCKS, waveAt, palAt, mixAt, bandOf, cutTo, sourcePic, bulgeFrom, filtered};
