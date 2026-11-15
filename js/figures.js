/* The lessons' drawings: one for each step, drawn on a plain 2D canvas (not the shader canvas), and the arithmetic they show.
   A drawing is an entry of FIGS with the step's name:
     init()                    its starting state
     draw(g,w,h,s,now,t,d)     draw state s on a canvas w by h pixels; now is the time in milliseconds, t gives text by name,
                               d is how many canvas pixels make one screen pixel
     drag(u,v,s,w,h)           the finger or mouse is at canvas pixel (u,v)
     key(dx,dy,s)              an arrow key: one small move
     ctl                       its sliders: k (the field of s), min, max, step, and label(s,t) for the words beside it
     changed(s)                called after a slider moves
     read(s,t)                 the lines of numbers shown under the drawing
   The arithmetic at the top needs no page, so the tests can use it. */
import { calm } from "./dom.js";
export const HOPMAX=200;   /* how many hops are tried before a point counts as never leaving */
const INK="#f3ecff",DIM="rgba(243,236,255,.5)",FAINT="rgba(243,236,255,.14)",HOT="#ff5fd2",COOL="#5ff0ff",BACK="#0b0618";
const FONT="'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace";
const GRIDS=[16,32,64,128,256,512];                              /* step 5: how many squares across */
const LIMS=[1,2,3,4,5,6,7,8,10,12,15,20,30,50,100,200];          /* step 6: the limits its slider steps through */
const REG={x0:-2.52,x1:1.0,y0:-1.1,y1:1.1};                      /* the part of the sheet that steps 5 and 6 show: 8 wide for every 5 high */

/* ---- the arithmetic ---- */
/* the square of the point (a,b): distance squared, angle doubled */
export function sqr2(a,b){return [a*a-b*b,2*a*b];}
/* Start at the middle; square and add c=(cx,cy), over and over. The number of the first hop that lands outside the ring of
   radius 2, or 0 if none of the first max hops does. */
export function hopsOut(cx,cy,max){
  var x=0,y=0,n,q;
  for(n=1;n<=max;n++){q=x*x-y*y+cx;y=2*x*y+cy;x=q;if(x*x+y*y>4)return n;}
  return 0;
}
/* For a c that stays: how many places its path settles on, 1 to 16; 0 if no such pattern shows; -1 if it leaves the ring. */
export function visits(cx,cy){
  var x=0,y=0,n,q,p,ax,ay;
  for(n=0;n<3000;n++){q=x*x-y*y+cx;y=2*x*y+cy;x=q;if(x*x+y*y>4)return -1;}
  ax=x;ay=y;
  for(p=1;p<=16;p++){q=x*x-y*y+cx;y=2*x*y+cy;x=q;if(Math.abs(x-ax)+Math.abs(y-ay)<1e-5)return p;}
  return 0;
}
/* the first n places of a path, as [x,y] pairs, stopping once it is far outside the ring */
export function path(cx,cy,n){
  var x=0,y=0,i,q,out=[[0,0]];
  for(i=0;i<n;i++){q=x*x-y*y+cx;y=2*x*y+cy;x=q;out.push([x,y]);if(x*x+y*y>1e4)break;}
  return out;
}
/* the colour for a square that left the ring on hop n: dark for soon, bright for late */
export function hopColour(n){
  var f=Math.min(1,Math.log(n)/Math.log(HOPMAX)),A=[38,22,96],B=[255,95,210],C=[200,250,255],u,P,Q;
  if(f<.5){u=f*2;P=A;Q=B;}else{u=f*2-1;P=B;Q=C;}
  return [P[0]+(Q[0]-P[0])*u,P[1]+(Q[1]-P[1])*u,P[2]+(Q[2]-P[2])*u];
}
/* a number as text: two decimals by default, more digits for the very small, none for the very big */
export function num(x,dec){
  var a=Math.abs(x),s;
  if(dec===undefined)dec=2;
  if(a>=1e6)return x.toExponential(1).replace("e+"," × 10^");
  if(a>=1000)return String(Math.round(x));
  if(a>0&&a<Math.pow(10,-dec))return x.toPrecision(2).replace(/e-(\d+)/," × 10^-$1");
  s=x.toFixed(dec);
  return s==="-"+(0).toFixed(dec)?(0).toFixed(dec):s;
}
/* what a path does, in words */
function verdict(cx,cy,t,ring){
  var n=hopsOut(cx,cy,HOPMAX),p;
  if(n)return t(ring?"learn.r.leaves":"learn.r.away",n);
  p=visits(cx,cy);
  return p===1?t("learn.r.one"):p>1?t("learn.r.many",p):t("learn.r.none");
}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function round(x,to){return Math.round(x/to)*to;}

/* ---- drawing helpers ---- */
function clear(g,w,h){g.fillStyle=BACK;g.fillRect(0,0,w,h);}
function words(g,d,size){g.font=(size*d)+"px "+FONT;}
function dot(g,x,y,r,col){g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,6.2832);g.fill();}
/* a dot that can be dragged: filled, with a ring round it */
function handle(g,x,y,d,col){dot(g,x,y,6*d,col);g.strokeStyle=col;g.lineWidth=1.5*d;g.beginPath();g.arc(x,y,11*d,0,6.2832);g.stroke();}
/* a number line from a to b at height y, with a mark at each whole number */
function numberLine(g,w,d,a,b,y){
  var i,x;
  g.strokeStyle=DIM;g.lineWidth=d;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();
  g.fillStyle=DIM;words(g,d,11);g.textAlign="center";g.textBaseline="top";
  for(i=Math.ceil(a);i<=b;i++){x=w*(i-a)/(b-a);g.beginPath();g.moveTo(x,y-4*d);g.lineTo(x,y+4*d);g.stroke();g.fillText(String(i),x,y+8*d);}
}
/* the hops along a number line as arches from each answer to the next, and a small light that travels along the first few */
function arches(g,w,d,a,b,y,xs,now,alpha,lit,pace){
  var i,x1,x2,cy,n=xs.length-1,ph,k,f,px,py;
  function X(v){return w*(clamp(v,-60,60)-a)/(b-a);}
  g.lineWidth=1.5*d;g.strokeStyle="rgba(95,240,255,"+alpha+")";
  for(i=0;i<n;i++){
    x1=X(xs[i]);x2=X(xs[i+1]);cy=y-2*Math.min(y*.42,Math.abs(x2-x1)*.5+8*d);
    g.beginPath();g.moveTo(x1,y);g.quadraticCurveTo((x1+x2)/2,cy,x2,y);g.stroke();
  }
  for(i=1;i<=n;i++)dot(g,X(xs[i]),y,2.5*d,INK);
  if(calm||n<1)return;
  lit=Math.min(lit,n);ph=(now/pace)%(lit+1.5);k=Math.floor(ph);if(k>=lit)return;
  f=ph-k;f=f*f*(3-2*f);
  x1=X(xs[k]);x2=X(xs[k+1]);cy=y-2*Math.min(y*.42,Math.abs(x2-x1)*.5+8*d);
  px=(1-f)*(1-f)*x1+2*(1-f)*f*(x1+x2)/2+f*f*x2;py=(1-f)*(1-f)*y+2*(1-f)*f*cy+f*f*y;
  dot(g,px,py,4*d,HOT);
}
/* a view of the flat sheet: its middle and half its height; gives pixel positions and back again */
function sheet(w,h,cx,cy,hh){
  var k=h/(2*hh);
  return {k:k,X:function(x){return w/2+(x-cx)*k},Y:function(y){return h/2-(y-cy)*k},
          x:function(u){return cx+(u-w/2)/k},y:function(v){return cy-(v-h/2)/k}};
}
/* the two lines through the middle, a faint line at each whole number, and the whole numbers along the line across */
function axes(g,w,h,d,S){
  var i,p;
  g.lineWidth=d;words(g,d,10);g.textAlign="center";g.textBaseline="top";
  for(i=-4;i<=4;i++){
    g.strokeStyle=i?FAINT:DIM;
    p=S.X(i);g.beginPath();g.moveTo(p,0);g.lineTo(p,h);g.stroke();
    p=S.Y(i);g.beginPath();g.moveTo(0,p);g.lineTo(w,p);g.stroke();
    if(i){g.fillStyle=DIM;g.fillText(String(i),S.X(i),S.Y(0)+4*d);}
  }
}
function ringOf(g,d,S,r){g.strokeStyle=DIM;g.lineWidth=d;g.setLineDash([5*d,5*d]);g.beginPath();g.arc(S.X(0),S.Y(0),r*S.k,0,6.2832);g.stroke();g.setLineDash([]);}
/* the hops of a path on the sheet: a line for each, a dot at each place, and the places it ends among drawn larger */
function hopLines(g,d,S,pts,stays){
  var i,n=pts.length;
  g.lineWidth=1.2*d;g.strokeStyle="rgba(95,240,255,.55)";g.beginPath();
  for(i=0;i<n;i++){if(i)g.lineTo(S.X(pts[i][0]),S.Y(pts[i][1]));else g.moveTo(S.X(pts[i][0]),S.Y(pts[i][1]));}
  g.stroke();
  for(i=0;i<n;i++)dot(g,S.X(pts[i][0]),S.Y(pts[i][1]),(stays&&i>=n-16?3.5:2)*d,stays&&i>=n-16?INK:"rgba(243,236,255,.6)");
}

/* ---- a grid of squares, each asked the question (steps 5 and 6) ---- */
function newGrid(N){
  var M=Math.round(N*5/8),G={N:N,M:M,cnt:new Int16Array(N*M),done:0,shown:-1,lim:-1,off:null,img:null};
  G.off=document.createElement("canvas");G.off.width=N;G.off.height=M;
  G.img=G.off.getContext("2d").createImageData(N,M);
  return G;
}
function cellC(G,i){return [REG.x0+(i%G.N+.5)*(REG.x1-REG.x0)/G.N,REG.y1-(Math.floor(i/G.N)+.5)*(REG.y1-REG.y0)/G.M];}
/* ask a few more squares: at least `least` of them, then as many as fit in ms milliseconds */
function gridStep(G,least,ms){
  var t0=performance.now(),tot=G.N*G.M,c,k=0;
  while(G.done<tot){
    c=cellC(G,G.done);G.cnt[G.done]=hopsOut(c[0],c[1],HOPMAX);G.done++;k++;
    if(k>=least&&(k&63)===0&&performance.now()-t0>ms)break;
    if(k>=least&&ms<=0)break;
  }
}
/* paint the squares asked so far: black for those that had not left by hop `lim`, a colour for the others */
function gridPaint(g,w,h,G,lim){
  var i,n,c,D=G.img.data,tot=G.N*G.M;
  if(G.shown!==G.done||G.lim!==lim){
    for(i=0;i<tot;i++){
      if(i>=G.done){D[i*4]=11;D[i*4+1]=6;D[i*4+2]=24;}
      else{n=G.cnt[i];if(!n||n>lim){D[i*4]=D[i*4+1]=D[i*4+2]=0;}else{c=hopColour(n);D[i*4]=c[0];D[i*4+1]=c[1];D[i*4+2]=c[2];}}
      D[i*4+3]=255;
    }
    G.off.getContext("2d").putImageData(G.img,0,0);G.shown=G.done;G.lim=lim;
  }
  g.imageSmoothingEnabled=false;g.drawImage(G.off,0,0,w,h);
}
function regSheet(w,h){return sheet(w,h,(REG.x0+REG.x1)/2,0,(REG.y1-REG.y0)/2);}

/* ---- the drawings ---- */
export const FIGS={
/* step 1: square a number again and again, on a number line */
square:{
  A:-2.2,B:4.6,
  init:function(){return {x:0.9}},
  list:function(s){var xs=[s.x],x=s.x;while(xs.length<13&&Math.abs(x)<1e6){x=x*x;xs.push(x);}return xs;},
  draw:function(g,w,h,s,now,t,d){
    var y=h*.7,xs=this.list(s);
    clear(g,w,h);numberLine(g,w,d,this.A,this.B,y);
    arches(g,w,d,this.A,this.B,y,xs,now,.6,6,900);
    handle(g,w*(s.x-this.A)/(this.B-this.A),y,d,COOL);
  },
  drag:function(u,v,s,w){s.x=clamp(round(this.A+u/w*(this.B-this.A),.01),-2,2);},
  key:function(dx,dy,s){s.x=clamp(round(s.x+dx*.01,.01),-2,2);},
  read:function(s,t){
    var xs=this.list(s).slice(0,7),a=Math.abs(s.x);
    return [xs.map(function(x){return num(x)}).join(" → ")+" → …",a===1||a===0?t("learn.r.stays"):a<1?t("learn.r.shrinks"):t("learn.r.runs")];
  }
},
/* step 2: square and add c, from zero; under the line, a bar of every c that stays close */
addc:{
  A:-2.3,B:2.3,
  ctl:[{k:"c",min:-2.2,max:0.6,step:0.005,label:function(s,t){return t("learn.c.c",num(s.c,3))}}],
  init:function(){return {c:-0.5,bar:null,barW:0}},
  list:function(s,n){var xs=[0],x=0;while(xs.length<=n&&Math.abs(x)<1e6){x=x*x+s.c;xs.push(x);}return xs;},
  draw:function(g,w,h,s,now,t,d){
    var y=h*.6,xs=this.list(s,60),i,c,by=h*.8,bh=10*d,x;
    clear(g,w,h);numberLine(g,w,d,this.A,this.B,y);
    arches(g,w,d,this.A,this.B,y,xs,now,.3,24,500);
    dot(g,w*(0-this.A)/(this.B-this.A),y,4*d,COOL);
    /* the bar: one column for each pixel across, bright where that c stays close */
    if(s.barW!==w){s.barW=w;s.bar=[];for(i=0;i<w;i++){c=this.A+(i+.5)/w*(this.B-this.A);s.bar.push(!hopsOut(c,0,HOPMAX));}}
    g.fillStyle=FAINT;g.fillRect(0,by,w,bh);
    g.fillStyle=COOL;for(i=0;i<w;i++)if(s.bar[i])g.fillRect(i,by,1,bh);
    g.fillStyle=DIM;words(g,d,10);g.textAlign="left";g.textBaseline="top";g.fillText(t("learn.f.bar"),8*d,by+bh+5*d);
    /* where c is on it */
    x=w*(s.c-this.A)/(this.B-this.A);
    g.fillStyle=HOT;g.beginPath();g.moveTo(x,by-2*d);g.lineTo(x-6*d,by-12*d);g.lineTo(x+6*d,by-12*d);g.fill();
    g.fillRect(x-d,by,2*d,bh);
    words(g,d,11);g.textAlign="center";g.textBaseline="bottom";g.fillText("c",x,by-14*d);
  },
  drag:function(u,v,s,w){s.c=clamp(round(this.A+u/w*(this.B-this.A),.005),-2.2,.6);},
  key:function(dx,dy,s){s.c=clamp(round(s.c+dx*.005,.005),-2.2,.6);},
  read:function(s,t){
    return [this.list(s,6).map(function(x){return num(x)}).join(" → ")+" → …",verdict(s.c,0,t,false)];
  }
},
/* step 3: a point on the sheet and its square */
plane:{
  init:function(){return {a:0.9,b:0.5}},
  S:function(w,h){return sheet(w,h,0,0,2.3)},
  draw:function(g,w,h,s,now,t,d){
    var S=this.S(w,h),q=sqr2(s.a,s.b),th=Math.atan2(s.b,s.a),ox=S.X(0),oy=S.Y(0);
    clear(g,w,h);axes(g,w,h,d,S);ringOf(g,d,S,1);
    /* the two angles, measured from the line that points right */
    g.lineWidth=2*d;
    g.strokeStyle=COOL;g.beginPath();g.arc(ox,oy,26*d,0,-th,th>0);g.stroke();
    g.strokeStyle=HOT;g.beginPath();g.arc(ox,oy,40*d,0,-2*th,th>0);g.stroke();
    g.lineWidth=1.5*d;
    g.strokeStyle=COOL;g.beginPath();g.moveTo(ox,oy);g.lineTo(S.X(s.a),S.Y(s.b));g.stroke();
    g.strokeStyle=HOT;g.beginPath();g.moveTo(ox,oy);g.lineTo(S.X(q[0]),S.Y(q[1]));g.stroke();
    dot(g,S.X(q[0]),S.Y(q[1]),6*d,HOT);handle(g,S.X(s.a),S.Y(s.b),d,COOL);
    words(g,d,11);g.textAlign="left";g.textBaseline="bottom";
    g.fillStyle=COOL;g.fillText(t("learn.f.point"),S.X(s.a)+14*d,S.Y(s.b)-8*d);
    g.fillStyle=HOT;g.fillText(t("learn.f.square"),S.X(q[0])+10*d,S.Y(q[1])-8*d);
  },
  set:function(s,a,b){
    var l;
    a=round(a,.02);b=round(b,.02);if(Math.abs(a)<.05)a=0;if(Math.abs(b)<.05)b=0;
    l=Math.sqrt(a*a+b*b);if(l>1.5){a=round(a*1.5/l,.02);b=round(b*1.5/l,.02);}
    s.a=a;s.b=b;
  },
  drag:function(u,v,s,w,h){var S=this.S(w,h);this.set(s,S.x(u),S.y(v));},
  key:function(dx,dy,s){this.set(s,s.a+dx*.06,s.b+dy*.06);},
  read:function(s,t){
    var q=sqr2(s.a,s.b),D=function(x,y){return num(Math.sqrt(x*x+y*y))},th=Math.atan2(s.b,s.a)*180/Math.PI;
    return [t("learn.r.point",num(s.a),num(s.b))+"   "+t("learn.r.polar",D(s.a,s.b),Math.round(th)),
            t("learn.r.sq",num(q[0]),num(q[1]))+"   "+t("learn.r.polar",D(q[0],q[1]),Math.round(2*th)),
            t("learn.r.across",num(s.a),num(s.b),num(q[0])),t("learn.r.up",num(s.a),num(s.b),num(q[1]))];
  }
},
/* step 4: square and add c on the sheet; the ring of radius 2 */
hops:{
  init:function(){return {a:-0.4,b:0.5}},
  S:function(w,h){return sheet(w,h,-0.5,0,2.3)},
  draw:function(g,w,h,s,now,t,d){
    var S=this.S(w,h),n=hopsOut(s.a,s.b,HOPMAX),pts=path(s.a,s.b,n?n+2:HOPMAX);
    clear(g,w,h);axes(g,w,h,d,S);ringOf(g,d,S,2);
    g.fillStyle=DIM;words(g,d,10);g.textAlign="center";g.textBaseline="bottom";g.fillText(t("learn.f.ring"),S.X(0),S.Y(2)-3*d);
    hopLines(g,d,S,pts,!n);
    handle(g,S.X(s.a),S.Y(s.b),d,HOT);
    g.fillStyle=HOT;words(g,d,11);g.textAlign="left";g.textBaseline="bottom";g.fillText("c",S.X(s.a)+14*d,S.Y(s.b)-8*d);
  },
  set:function(s,a,b){var l=Math.sqrt(a*a+b*b);if(l>2.2){a*=2.2/l;b*=2.2/l;}s.a=round(a,.005);s.b=round(b,.005);},
  drag:function(u,v,s,w,h){var S=this.S(w,h);this.set(s,S.x(u),S.y(v));},
  key:function(dx,dy,s){this.set(s,s.a+dx*.005,s.b+dy*.005);},
  read:function(s,t){return [t("learn.r.cpt",num(s.a,3),num(s.b,3)),verdict(s.a,s.b,t,true)];}
},
/* step 5: a grid over the sheet, each square asked the question, painted a few at a time */
pixels:{
  ctl:[{k:"gi",min:0,max:GRIDS.length-1,step:1,label:function(s,t){return t("learn.c.grid",GRIDS[s.gi])}}],
  init:function(){return {gi:0,G:null,sel:-1}},
  changed:function(s){s.G=null;s.sel=-1;},
  draw:function(g,w,h,s,now,t,d){
    var G,i,S=regSheet(w,h),c,n,cw,ch;
    if(!s.G)s.G=newGrid(GRIDS[s.gi]);
    G=s.G;
    /* slowly while the squares are big enough to watch, then as fast as the time allows */
    gridStep(G,calm?G.N*G.M:Math.ceil(G.N*G.M/150),G.N<=32?0:7);
    gridPaint(g,w,h,G,HOPMAX);
    cw=w/G.N;ch=h/G.M;
    if(G.N<=32){
      g.strokeStyle="rgba(243,236,255,.12)";g.lineWidth=d;g.beginPath();
      for(i=1;i<G.N;i++){g.moveTo(i*cw,0);g.lineTo(i*cw,h);}
      for(i=1;i<G.M;i++){g.moveTo(0,i*ch);g.lineTo(w,i*ch);}
      g.stroke();
    }
    if(s.sel>=0){
      c=cellC(G,s.sel);n=hopsOut(c[0],c[1],HOPMAX);
      ringOf(g,d,S,2);hopLines(g,d,S,path(c[0],c[1],n?n+2:HOPMAX),!n);
      g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect((s.sel%G.N)*cw,Math.floor(s.sel/G.N)*ch,cw,ch);
    }
  },
  drag:function(u,v,s,w,h){var G=s.G;if(G)s.sel=clamp(Math.floor(u/w*G.N),0,G.N-1)+G.N*clamp(Math.floor(v/h*G.M),0,G.M-1);},
  key:function(dx,dy,s){
    var G=s.G,x,y;if(!G)return;
    if(s.sel<0)s.sel=Math.floor(G.M/2)*G.N+Math.floor(G.N/2);
    x=clamp(s.sel%G.N+dx,0,G.N-1);y=clamp(Math.floor(s.sel/G.N)-dy,0,G.M-1);s.sel=y*G.N+x;
  },
  read:function(s,t){
    var N=GRIDS[s.gi],M=Math.round(N*5/8),c,out=[t("learn.r.grid",N,M,N*M)];
    if(s.sel>=0&&s.G){c=cellC(s.G,s.sel);out.push(t("learn.r.cpt",num(c[0],3),num(c[1],3)),verdict(c[0],c[1],t,true));}
    else out.push(t("learn.r.tap"));
    return out;
  }
},
/* step 6: the same picture with the limit on the count as a slider */
patience:{
  ctl:[{k:"li",min:0,max:LIMS.length-1,step:1,label:function(s,t){return t("learn.c.limit",LIMS[s.li])}}],
  init:function(){return {li:0,G:null}},
  draw:function(g,w,h,s,now,t,d){
    if(!s.G)s.G=newGrid(320);
    gridStep(s.G,1,7);
    gridPaint(g,w,h,s.G,LIMS[s.li]);
    ringOf(g,d,regSheet(w,h),2);
  },
  read:function(s,t){return [t("learn.r.limit",LIMS[s.li])];}
}
};

/* for the test tools and the browser console: every name in this file */
export const __dbg={HOPMAX, GRIDS, LIMS, REG, sqr2, hopsOut, visits, path, hopColour, num, verdict, FIGS, newGrid, gridStep, gridPaint, cellC};
