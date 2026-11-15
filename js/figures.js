/* The lessons' drawings: one for each step, drawn on a plain 2D canvas (not the shader canvas), and the arithmetic they show.
   A drawing is an entry of FIGS with the step's name:
     init()                    its starting state
     draw(g,w,h,s,now,t,d)     draw state s on a canvas w by h pixels; now is the time in milliseconds, t gives text by name,
                               d is how many canvas pixels make one screen pixel
     drag(u,v,s,w,h,tol,first) the finger or mouse is at canvas pixel (u,v); tol is how near, in canvas pixels, a key
                               point pulls it in; first is true when the finger has just come down
     key(dx,dy,s)              an arrow key: one small move
     ctl                       its sliders: k (the field of s), min, max, step, label(s,t) for the words beside it, and
                               keys, the values the slider is pulled to when it comes near them
     keys                      a button for each key point: label(s,t) and set(s)
     changed(s)                called after a slider moves or a button is pressed
     walk(s)                   for a drawing whose hops can be walked through one at a time: how many hops there are.
                               s.k is the hop being looked at (0 for none); the drawing marks it, and read gives its arithmetic
     read(s,t)                 the lines of numbers shown under the drawing
   The arithmetic at the top needs no page, so the tests can use it. */
import { calm } from "./dom.js";
export const HOPMAX=200;   /* how many hops are tried before a point counts as never leaving */
export const INK="#f3ecff",DIM="rgba(243,236,255,.5)",FAINT="rgba(243,236,255,.14)",HOT="#ff5fd2",COOL="#5ff0ff",BACK="#0b0618";
export const FONT="'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace";
const GRIDS=[16,32,64,128,256,512];                              /* step 5: how many squares across */
const LIMS=[1,2,3,4,5,6,7,8,10,12,15,20,30,50,100,200];          /* step 6: the limits its slider steps through */
export const REG={x0:-2.52,x1:1.0,y0:-1.1,y1:1.1};                      /* the part of the sheet that steps 5 and 6 show: 8 wide for every 5 high */

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
export function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
export function round(x,to){return Math.round(x/to)*to;}
/* Key points are sticky: a value within tol of one of them becomes it. The same for a point on the sheet. */
export function snapTo(v,keys,tol){var i;for(i=0;i<keys.length;i++)if(Math.abs(v-keys[i])<=tol)return keys[i];return v;}
export function snapTo2(a,b,pts,tol){var i;for(i=0;i<pts.length;i++)if(Math.abs(a-pts[i][0])<=tol&&Math.abs(b-pts[i][1])<=tol)return pts[i];return [a,b];}
export function pt(a,b){return "("+String(a)+", "+String(b)+")";}
/* a number to be added, written with its sign apart: "+ 0.300" or "- 0.500" */
export function signed(c){return (c<0?"- ":"+ ")+num(Math.abs(c),3);}
/* The arithmetic of hop k of a path on the sheet, a line for each small sum: squaring the point, then adding c.
   ring says whether to add how far from the middle it lands and which side of the ring that is. */
export function hopMath(pts,k,ca,cb,t,ring){
  var z=pts[k-1],q=sqr2(z[0],z[1]),w=pts[k],r=Math.sqrt(w[0]*w[0]+w[1]*w[1]),N=function(x){return num(x,3)};
  return [t("learn.r.hopFrom",k,N(z[0]),N(z[1])),
          t("learn.r.sqHead"),"  "+t("learn.r.across",N(z[0]),N(z[1]),N(q[0])),"  "+t("learn.r.up",N(z[0]),N(z[1]),N(q[1])),
          t("learn.r.addHead"),"  "+t("learn.r.addA",N(q[0]),signed(ca),N(w[0])),"  "+t("learn.r.addU",N(q[1]),signed(cb),N(w[1])),
          ring?t(r>2?"learn.r.landOut":"learn.r.landIn",N(w[0]),N(w[1]),num(r)):t("learn.r.land",N(w[0]),N(w[1]))];
}
/* The arithmetic of the hops of a path on the number line: four rows around hop k, the one being looked at marked.
   c is the number added after each squaring, or null where nothing is added. */
export function rowMath(xs,k,c,t){
  var out=[],i,from=Math.max(1,Math.min(k-2,xs.length-4)),q,N=function(x){return num(x,c===null?2:3)};
  for(i=from;i<from+4&&i<xs.length;i++){
    q=xs[i-1]*xs[i-1];
    out.push((i===k?"▸ ":"  ")+(c===null?t("learn.r.row1",i,N(xs[i-1]),N(q)):t("learn.r.row2",i,N(xs[i-1]),N(q),signed(c),N(xs[i]))));
  }
  return out;
}
/* the places a path that stays keeps returning to: sixteen of them, taken after it has had time to settle */
export function settled(cx,cy){
  var x=0,y=0,n,q,out=[];
  for(n=0;n<600;n++){q=x*x-y*y+cx;y=2*x*y+cy;x=q;if(x*x+y*y>4)return out;if(n>=584)out.push([x,y]);}
  return out;
}

/* ---- drawing helpers ---- */
export function clear(g,w,h){g.fillStyle=BACK;g.fillRect(0,0,w,h);}
export function words(g,d,size){g.font=(size*d)+"px "+FONT;}
export function dot(g,x,y,r,col){g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,6.2832);g.fill();}
/* a dot that can be dragged: filled, with a ring round it */
export function handle(g,x,y,d,col){dot(g,x,y,6*d,col);g.strokeStyle=col;g.lineWidth=1.5*d;g.beginPath();g.arc(x,y,11*d,0,6.2832);g.stroke();}
/* a line with an arrow head, from one pixel to another */
export function arrow(g,x1,y1,x2,y2,d,col,dash){
  var a=Math.atan2(y2-y1,x2-x1),L=Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1)),r=Math.min(9*d,L*.5);
  g.strokeStyle=col;g.fillStyle=col;g.lineWidth=1.8*d;if(dash)g.setLineDash([5*d,4*d]);
  g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.setLineDash([]);
  if(L<2*d)return;
  g.beginPath();g.moveTo(x2,y2);g.lineTo(x2-r*Math.cos(a-.42),y2-r*Math.sin(a-.42));g.lineTo(x2-r*Math.cos(a+.42),y2-r*Math.sin(a+.42));g.fill();
}
/* a number line from a to b at height y, with a mark at each whole number */
function numberLine(g,w,d,a,b,y){
  var i,x;
  g.strokeStyle=DIM;g.lineWidth=d;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();
  g.fillStyle=DIM;words(g,d,11);g.textAlign="center";g.textBaseline="top";
  for(i=Math.ceil(a);i<=b;i++){x=w*(i-a)/(b-a);g.beginPath();g.moveTo(x,y-4*d);g.lineTo(x,y+4*d);g.stroke();g.fillText(String(i),x,y+8*d);}
}
/* the hops along a number line as arches from each answer to the next, and a small light that travels along the first few */
function arches(g,w,d,a,b,y,xs,now,alpha,lit,pace,hi){
  var i,x1,x2,cy,n=xs.length-1,ph,k,f,px,py;
  function X(v){return w*(clamp(v,-60,60)-a)/(b-a);}
  g.lineWidth=1.5*d;g.strokeStyle="rgba(95,240,255,"+alpha+")";
  for(i=0;i<n;i++){
    x1=X(xs[i]);x2=X(xs[i+1]);cy=y-2*Math.min(y*.42,Math.abs(x2-x1)*.5+8*d);
    g.beginPath();g.moveTo(x1,y);g.quadraticCurveTo((x1+x2)/2,cy,x2,y);g.stroke();
  }
  for(i=1;i<=n;i++)dot(g,X(xs[i]),y,2.5*d,INK);
  if(hi>0&&hi<=n){ /* the hop being looked at: its arch drawn boldly, and no travelling light */
    x1=X(xs[hi-1]);x2=X(xs[hi]);cy=y-2*Math.min(y*.42,Math.abs(x2-x1)*.5+8*d);
    g.lineWidth=3*d;g.strokeStyle=INK;g.beginPath();g.moveTo(x1,y);g.quadraticCurveTo((x1+x2)/2,cy,x2,y);g.stroke();
    dot(g,x1,y,4*d,INK);dot(g,x2,y,5.5*d,HOT);return;
  }
  if(calm||n<1)return;
  lit=Math.min(lit,n);ph=(now/pace)%(lit+1.5);k=Math.floor(ph);if(k>=lit)return;
  f=ph-k;f=f*f*(3-2*f);
  x1=X(xs[k]);x2=X(xs[k+1]);cy=y-2*Math.min(y*.42,Math.abs(x2-x1)*.5+8*d);
  px=(1-f)*(1-f)*x1+2*(1-f)*f*(x1+x2)/2+f*f*x2;py=(1-f)*(1-f)*y+2*(1-f)*f*cy+f*f*y;
  dot(g,px,py,4*d,HOT);
}
/* a view of the flat sheet: its middle and half its height; gives pixel positions and back again */
export function sheet(w,h,cx,cy,hh){
  var k=h/(2*hh);
  return {k:k,X:function(x){return w/2+(x-cx)*k},Y:function(y){return h/2-(y-cy)*k},
          x:function(u){return cx+(u-w/2)/k},y:function(v){return cy-(v-h/2)/k}};
}
/* the two lines through the middle, a faint line at each whole number, and the whole numbers along the line across */
export function axes(g,w,h,d,S){
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
/* hop k of a path in its two moves: a dashed line from where it was to that point's square, then the slide by c as an arrow */
function hopMark(g,d,S,pts,k){
  var z=pts[k-1],q=sqr2(z[0],z[1]),w=pts[k];
  g.strokeStyle=INK;g.lineWidth=1.5*d;g.setLineDash([4*d,4*d]);g.beginPath();g.moveTo(S.X(z[0]),S.Y(z[1]));g.lineTo(S.X(q[0]),S.Y(q[1]));g.stroke();g.setLineDash([]);
  dot(g,S.X(z[0]),S.Y(z[1]),4*d,INK);dot(g,S.X(q[0]),S.Y(q[1]),3*d,INK);
  arrow(g,S.X(q[0]),S.Y(q[1]),S.X(w[0]),S.Y(w[1]),d,HOT,false);
  dot(g,S.X(w[0]),S.Y(w[1]),5*d,HOT);
}

/* ---- a grid of squares, each asked the question (the last four steps) ---- */
function newGrid(N){
  var M=Math.round(N*5/8),G={N:N,M:M,cnt:new Int16Array(N*M),asked:0,next:0,dirty:true,lim:-1,off:null,img:null};
  G.cnt.fill(-1); /* -1: not asked yet; 0: never left; otherwise the hop it left on */
  G.off=document.createElement("canvas");G.off.width=N;G.off.height=M;
  G.img=G.off.getContext("2d").createImageData(N,M);
  return G;
}
function cellC(G,i){return [REG.x0+(i%G.N+.5)*(REG.x1-REG.x0)/G.N,REG.y1-(Math.floor(i/G.N)+.5)*(REG.y1-REG.y0)/G.M];}
function gridAsk(G,i){var c;if(G.cnt[i]>=0)return;c=cellC(G,i);G.cnt[i]=hopsOut(c[0],c[1],HOPMAX);G.asked++;G.dirty=true;}
/* ask a few more squares, in order: at least `least` of them, then as many as fit in ms milliseconds */
function gridStep(G,least,ms){
  var t0=performance.now(),tot=G.N*G.M,k=0;
  while(G.next<tot){
    gridAsk(G,G.next);G.next++;k++;
    if(k>=least&&(ms<=0||((k&63)===0&&performance.now()-t0>ms)))break;
  }
}
/* Paint the squares asked so far: black for those that had not left by hop `lim`; the others one plain colour if two is
   true, and otherwise a colour for the hop they left on. */
function gridPaint(g,w,h,G,lim,two){
  var i,n,c,D=G.img.data,tot=G.N*G.M;
  if(G.dirty||G.lim!==lim){
    for(i=0;i<tot;i++){
      n=G.cnt[i];
      if(n<0){D[i*4]=11;D[i*4+1]=6;D[i*4+2]=24;}
      else if(!n||n>lim){D[i*4]=D[i*4+1]=D[i*4+2]=0;}
      else{c=two?[124,84,214]:hopColour(n);D[i*4]=c[0];D[i*4+1]=c[1];D[i*4+2]=c[2];}
      D[i*4+3]=255;
    }
    G.off.getContext("2d").putImageData(G.img,0,0);G.dirty=false;G.lim=lim;
  }
  g.imageSmoothingEnabled=false;g.drawImage(G.off,0,0,w,h);
}
function regSheet(w,h){return sheet(w,h,(REG.x0+REG.x1)/2,0,(REG.y1-REG.y0)/2);}
/* A small window with one square's hops in it. The picture is a map of c, and the hops are not places on that map, so
   they are never drawn on it. The window sits on the side away from the square. */
function inset(g,w,h,d,G,sel,t,k){
  var c=cellC(G,sel),n=hopsOut(c[0],c[1],HOPMAX),sz=Math.round(h*.52),x=(sel%G.N<G.N/2)?w-sz-8*d:8*d,y=8*d,S=sheet(sz,sz,0,0,2.5);
  g.save();
  g.fillStyle="rgba(11,6,24,.95)";g.fillRect(x,y,sz,sz);g.strokeStyle=INK;g.lineWidth=d;g.strokeRect(x,y,sz,sz);
  g.beginPath();g.rect(x,y,sz,sz);g.clip();g.translate(x,y);
  var pts=path(c[0],c[1],n?n:HOPMAX);
  ringOf(g,d,S,2);hopLines(g,d,S,pts,!n&&!k);
  if(k>0&&k<pts.length)hopMark(g,d,S,pts,k);else dot(g,S.X(c[0]),S.Y(c[1]),4*d,HOT);
  g.fillStyle=DIM;words(g,d,10);g.textAlign="left";g.textBaseline="top";g.fillText(t("learn.f.inset"),6*d,5*d);
  g.restore();
}

/* ---- the kinds of drawing; each step below is one of them with its own settings ---- */
/* a button that sets one field of the state to a key value */
export function keyOf(k,v,lab){return {label:function(s,t){return lab?t(lab,String(v)):String(v)},set:function(s){s[k]=v}};}
/* a button that puts the point (or c) of a drawing on the sheet at a key point; lab is a name for the words, or none for the numbers */
export function keyAt(p,lab){return {label:function(s,t){return lab?t(lab):pt(p[0],p[1])},set:function(s){s.a=p[0];s.b=p[1]}};}

/* Squaring on a number line. o: x the start, lo the lowest start allowed, many for squaring over and over, keys */
function squareFig(o){
  var A=o.lo<0?-2.2:-0.4,B=4.4;
  return {
    keys:o.keys.map(function(v){return keyOf("x",v)}),
    init:function(){return {x:o.x,k:0}},
    walk:o.many?function(s){return this.list(s).length-1}:null,
    list:function(s){var xs=[s.x],x=s.x,n=o.many?13:2;while(xs.length<n&&Math.abs(x)<1e6){x=x*x;xs.push(x);}return xs;},
    draw:function(g,w,h,s,now,t,d){
      var y=h*.66,xs=this.list(s),X=function(v){return w*(v-A)/(B-A)};
      clear(g,w,h);numberLine(g,w,d,A,B,y);
      arches(g,w,d,A,B,y,xs,now,.7,o.many?6:1,o.many?900:1400,o.many?s.k:0);
      if(!o.many){dot(g,X(xs[1]),y,5*d,HOT);g.fillStyle=HOT;words(g,d,12);g.textAlign="center";g.textBaseline="top";g.fillText(num(xs[1]),X(xs[1]),y+24*d);}
      handle(g,X(s.x),y,d,COOL);
      g.fillStyle=COOL;words(g,d,12);g.textAlign="center";g.textBaseline="bottom";g.fillText(num(s.x),X(s.x),y-16*d);
    },
    drag:function(u,v,s,w,h,tol){s.x=clamp(snapTo(round(A+u/w*(B-A),.01),o.keys,tol/w*(B-A)),o.lo,2);},
    key:function(dx,dy,s){s.x=clamp(round(s.x+dx*.01,.01),o.lo,2);},
    read:function(s,t){
      var x=s.x,a=Math.abs(x),q=x*x,one=Math.abs(a-1)<1e-9;
      if(!o.many)return [t("learn.r.times",num(x),num(q)),x<0?t("learn.r.plus"):Math.abs(q-x)<1e-9?t("learn.r.same"):q<x?t("learn.r.smaller"):t("learn.r.bigger")];
      return rowMath(this.list(s),s.k,null,t).concat([a===0||(one&&x>0)?t("learn.r.stays"):one?t("learn.r.lands"):a<1?t("learn.r.shrinks"):t("learn.r.runs")]);
    }
  };
}
/* Square and add c on a number line, from zero. o: c the start, keys, tail to mark the places a path keeps returning to,
   bar for the bar of every c that stays close */
function addcFig(o){
  var A=-2.3,B=2.3,LO=-2.2,HI=.6;
  return {
    ctl:[{k:"c",min:LO,max:HI,step:0.005,keys:o.keys,label:function(s,t){return t("learn.c.c",num(s.c,3))}}],
    keys:o.keys.map(function(v){return keyOf("c",v,"learn.c.c")}),
    init:function(){return {c:o.c,bar:null,barW:0,k:0}},
    walk:function(s){return this.list(s,o.tail?24:60).length-1},
    list:function(s,n){var xs=[0],x=0;while(xs.length<=n&&Math.abs(x)<1e6){x=x*x+s.c;xs.push(x);}return xs;},
    draw:function(g,w,h,s,now,t,d){
      var y=h*.56,xs=this.list(s,o.tail?24:60),i,c,by=h*.84,bh=10*d,x,T,X=function(v){return w*(v-A)/(B-A)};
      clear(g,w,h);numberLine(g,w,d,A,B,y);
      arches(g,w,d,A,B,y,xs,now,o.tail?.22:.32,24,500,s.k);
      dot(g,X(0),y,4*d,COOL);
      if(o.tail){T=settled(s.c,0);for(i=0;i<T.length;i++){dot(g,X(T[i][0]),y,6*d,INK);}}
      /* c: a marker under the line, where the first hop lands */
      x=X(s.c);
      g.fillStyle=HOT;g.beginPath();g.moveTo(x,y+24*d);g.lineTo(x-7*d,y+36*d);g.lineTo(x+7*d,y+36*d);g.fill();
      words(g,d,12);g.textAlign="center";g.textBaseline="top";g.fillText("c",x,y+38*d);
      if(!o.bar)return;
      /* the bar: one column for each pixel across, bright where that c stays close */
      if(s.barW!==w){s.barW=w;s.bar=[];for(i=0;i<w;i++){c=A+(i+.5)/w*(B-A);s.bar.push(!hopsOut(c,0,HOPMAX));}}
      g.fillStyle=FAINT;g.fillRect(0,by,w,bh);
      g.fillStyle=COOL;for(i=0;i<w;i++)if(s.bar[i])g.fillRect(i,by,1,bh);
      g.fillStyle=HOT;g.fillRect(x-d,by-3*d,2*d,bh+6*d);
      g.fillStyle=DIM;words(g,d,10);g.textAlign="left";g.textBaseline="top";g.fillText(t("learn.f.bar"),8*d,by+bh+5*d);
    },
    drag:function(u,v,s,w,h,tol){s.c=clamp(snapTo(round(A+u/w*(B-A),.005),o.keys,tol/w*(B-A)),LO,HI);},
    key:function(dx,dy,s){s.c=clamp(round(s.c+dx*.005,.005),LO,HI);},
    read:function(s,t){return rowMath(this.list(s,o.tail?24:60),s.k,s.c,t).concat([verdict(s.c,0,t,false)]);}
  };
}
/* One point on the sheet. o.mode: "parts" shows across and up, "polar" its distance and angle, "sq" its square as well.
   o: a, b the start, lim how far out it may go, keys the sticky points */
function pointFig(o){
  return {
    keys:o.keys.map(function(p){return keyAt(p)}),
    init:function(){return {a:o.a,b:o.b}},
    S:function(w,h){return sheet(w,h,0,0,2.3)},
    draw:function(g,w,h,s,now,t,d){
      var S=this.S(w,h),q=sqr2(s.a,s.b),th=Math.atan2(s.b,s.a),ox=S.X(0),oy=S.Y(0),px=S.X(s.a),py=S.Y(s.b);
      clear(g,w,h);axes(g,w,h,d,S);
      if(o.mode==="parts"){
        /* across first, then up */
        g.lineWidth=3*d;g.strokeStyle=COOL;g.beginPath();g.moveTo(ox,oy);g.lineTo(px,oy);g.stroke();
        g.strokeStyle=HOT;g.beginPath();g.moveTo(px,oy);g.lineTo(px,py);g.stroke();
        words(g,d,11);g.textAlign="center";g.textBaseline=s.b>=0?"top":"bottom";
        g.fillStyle=COOL;g.fillText(t("learn.f.across")+" "+num(s.a),(ox+px)/2,oy+(s.b>=0?16:-16)*d);
        g.textAlign=s.a>=0?"left":"right";g.textBaseline="middle";
        g.fillStyle=HOT;g.fillText(t("learn.f.up")+" "+num(s.b),px+(s.a>=0?10:-10)*d,(oy+py)/2);
        handle(g,px,py,d,INK);return;
      }
      ringOf(g,d,S,1);
      /* the angles, measured from the line that points right */
      g.lineWidth=2*d;
      g.strokeStyle=COOL;g.beginPath();g.arc(ox,oy,26*d,0,-th,th>0);g.stroke();
      if(o.mode==="sq"){g.strokeStyle=HOT;g.beginPath();g.arc(ox,oy,40*d,0,-2*th,th>0);g.stroke();}
      g.lineWidth=1.5*d;
      g.strokeStyle=COOL;g.beginPath();g.moveTo(ox,oy);g.lineTo(px,py);g.stroke();
      if(o.mode==="sq"){
        g.strokeStyle=HOT;g.beginPath();g.moveTo(ox,oy);g.lineTo(S.X(q[0]),S.Y(q[1]));g.stroke();
        dot(g,S.X(q[0]),S.Y(q[1]),6*d,HOT);
        words(g,d,11);g.textAlign="left";g.textBaseline="bottom";g.fillStyle=HOT;g.fillText(t("learn.f.square"),S.X(q[0])+10*d,S.Y(q[1])-8*d);
      }
      handle(g,px,py,d,COOL);
      words(g,d,11);g.textAlign="left";g.textBaseline="bottom";g.fillStyle=COOL;g.fillText(t("learn.f.point"),px+14*d,py-8*d);
    },
    set:function(s,a,b,tol){
      var l=Math.sqrt(a*a+b*b),p;
      if(l>o.lim){a*=o.lim/l;b*=o.lim/l;}
      a=round(a,.02);b=round(b,.02);if(Math.abs(a)<.05)a=0;if(Math.abs(b)<.05)b=0;
      p=snapTo2(a,b,o.keys,tol);s.a=p[0];s.b=p[1];
    },
    drag:function(u,v,s,w,h,tol){var S=this.S(w,h);this.set(s,S.x(u),S.y(v),tol/S.k);},
    key:function(dx,dy,s){this.set(s,s.a+dx*.06,s.b+dy*.06,0);},
    read:function(s,t){
      var q=sqr2(s.a,s.b),D=function(x,y){return num(Math.sqrt(x*x+y*y))},th=Math.atan2(s.b,s.a)*180/Math.PI;
      if(o.mode==="parts")return [t("learn.r.parts",num(s.a),num(s.b)),t("learn.r.point",num(s.a),num(s.b))];
      if(o.mode==="polar")return [t("learn.r.point",num(s.a),num(s.b)),t("learn.r.polar",D(s.a,s.b),Math.round(th)),t("learn.r.pyth",num(s.a),num(s.b),D(s.a,s.b))];
      return [t("learn.r.point",num(s.a),num(s.b))+": "+t("learn.r.polar",D(s.a,s.b),Math.round(th)),
              "  "+t("learn.r.dist2",D(s.a,s.b),D(q[0],q[1])),"  "+t("learn.r.ang2",Math.round(th),Math.round(2*th)),
              t("learn.r.sq",num(q[0]),num(q[1]))+": "+t("learn.r.byParts"),
              "  "+t("learn.r.across",num(s.a),num(s.b),num(q[0])),"  "+t("learn.r.up",num(s.a),num(s.b),num(q[1]))];
    }
  };
}
/* The hops of square-and-add-c on the sheet, with c to drag. o: a, b the start, keys as [a,b,name for the words or none],
   ring to draw the ring of radius 2 and mark the first hop outside it, step to show the hops one at a time */
function hopFig(o){
  var P=o.keys.map(function(k){return [k[0],k[1]]}),LIM=o.step?1.1:2.2;
  return {
    keys:o.keys.map(function(k){return keyAt(k,k[2])}),
    init:function(){return {a:o.a,b:o.b,k:o.step?1:0}},
    /* how many hops there are to walk through: up to the one that leaves the ring, or all that are followed */
    walk:function(s){return o.step?8:(hopsOut(s.a,s.b,HOPMAX)||HOPMAX)},
    S:function(w,h){return o.step?sheet(w,h,0,0,1.5):sheet(w,h,-0.5,0,2.3)},
    draw:function(g,w,h,s,now,t,d){
      var S=this.S(w,h),n=hopsOut(s.a,s.b,HOPMAX),pts,z,q,k;
      clear(g,w,h);axes(g,w,h,d,S);
      if(o.step){
        /* only the hops so far, the last of them in its two moves */
        pts=path(s.a,s.b,Math.max(1,s.k));k=pts.length-1;hopLines(g,d,S,pts.slice(0,k),false);hopMark(g,d,S,pts,k);
      }else{
        ringOf(g,d,S,2);
        g.fillStyle=DIM;words(g,d,10);g.textAlign="center";g.textBaseline="bottom";g.fillText(t("learn.f.ring"),S.X(0),S.Y(2)-3*d);
        pts=path(s.a,s.b,n?n:HOPMAX);hopLines(g,d,S,pts,!n&&!s.k);
        if(s.k>0&&s.k<pts.length)hopMark(g,d,S,pts,s.k);
        else if(n&&o.ring){z=pts[pts.length-1];dot(g,S.X(z[0]),S.Y(z[1]),6*d,HOT);g.fillStyle=HOT;words(g,d,11);g.textAlign="left";g.textBaseline="top";g.fillText(t("learn.f.out"),S.X(z[0])+9*d,S.Y(z[1])+6*d);}
      }
      handle(g,S.X(s.a),S.Y(s.b),d,HOT);
      g.fillStyle=HOT;words(g,d,12);g.textAlign="left";g.textBaseline="bottom";g.fillText("c",S.X(s.a)+14*d,S.Y(s.b)-8*d);
    },
    set:function(s,a,b,tol){
      var l=Math.sqrt(a*a+b*b),p;
      if(l>LIM){a*=LIM/l;b*=LIM/l;}
      p=snapTo2(round(a,.005),round(b,.005),P,tol);s.a=p[0];s.b=p[1];
    },
    drag:function(u,v,s,w,h,tol){var S=this.S(w,h);this.set(s,S.x(u),S.y(v),tol/S.k);},
    key:function(dx,dy,s){this.set(s,s.a+dx*.005,s.b+dy*.005,0);},
    read:function(s,t){
      var pts,out=[t("learn.r.cpt",num(s.a,3),num(s.b,3))];
      if(!o.step)out.push(verdict(s.a,s.b,t,true));
      if(s.k>0){pts=path(s.a,s.b,s.k);if(s.k<pts.length)out=out.concat(hopMath(pts,s.k,s.a,s.b,t,!o.step));}
      return out;
    }
  };
}
/* A grid over the sheet. o.mode: "ask" asks a square when it is tapped and paints it black or purple; "count" asks them
   all and paints by the count; "finer" has a slider for how many squares across. o.N: squares across. */
function gridFig(o){
  return {
    ctl:o.mode==="finer"?[{k:"gi",min:0,max:GRIDS.length-1,step:1,label:function(s,t){return t("learn.c.grid",GRIDS[s.gi])}}]:null,
    keys:o.mode==="ask"?[{label:function(s,t){return t("learn.k.askAll")},set:function(s){s.all=true}}]:[],
    init:function(){return {gi:0,G:null,sel:-1,all:false,k:0}},
    /* the hops of the chosen square can be walked through */
    walk:function(s){var c;if(s.sel<0||!s.G)return 0;c=cellC(s.G,s.sel);return hopsOut(c[0],c[1],HOPMAX)||HOPMAX;},
    size:function(s){return o.mode==="finer"?GRIDS[s.gi]:o.N},
    changed:function(s){if(s.G&&s.G.N!==this.size(s)){s.G=null;s.sel=-1;s.k=0;}},
    draw:function(g,w,h,s,now,t,d){
      var G,i,cw,ch;
      if(!s.G)s.G=newGrid(this.size(s));
      G=s.G;
      /* slowly while the squares are big enough to watch, then as fast as the time allows */
      if(o.mode!=="ask"||s.all)gridStep(G,calm?G.N*G.M:Math.ceil(G.N*G.M/150),G.N<=32?0:7);
      gridPaint(g,w,h,G,HOPMAX,o.mode==="ask");
      cw=w/G.N;ch=h/G.M;
      if(G.N<=32){
        g.strokeStyle="rgba(243,236,255,.14)";g.lineWidth=d;g.beginPath();
        for(i=1;i<G.N;i++){g.moveTo(i*cw,0);g.lineTo(i*cw,h);}
        for(i=1;i<G.M;i++){g.moveTo(0,i*ch);g.lineTo(w,i*ch);}
        g.stroke();
      }
      if(s.sel>=0){
        g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect((s.sel%G.N)*cw,Math.floor(s.sel/G.N)*ch,cw,ch);
        inset(g,w,h,d,G,s.sel,t,s.k);
      }
    },
    pick:function(s,i){if(i!==s.sel)s.k=0;s.sel=i;if(o.mode==="ask")gridAsk(s.G,i);},
    drag:function(u,v,s,w,h){var G=s.G;if(G)this.pick(s,clamp(Math.floor(u/w*G.N),0,G.N-1)+G.N*clamp(Math.floor(v/h*G.M),0,G.M-1));},
    key:function(dx,dy,s){
      var G=s.G,x,y,i;if(!G)return;
      i=s.sel<0?Math.floor(G.M/2)*G.N+Math.floor(G.N/2):s.sel;
      x=clamp(i%G.N+dx,0,G.N-1);y=clamp(Math.floor(i/G.N)-dy,0,G.M-1);this.pick(s,y*G.N+x);
    },
    read:function(s,t){
      var N=this.size(s),M=Math.round(N*5/8),c,out=[];
      if(o.mode==="finer")out.push(t("learn.r.grid",N,M,N*M));
      if(o.mode==="ask")out.push(t("learn.r.asked",s.G?s.G.asked:0,N*M));
      if(s.sel>=0&&s.G){
        c=cellC(s.G,s.sel);out.push(t("learn.r.cpt",num(c[0],3),num(c[1],3)),verdict(c[0],c[1],t,true));
        if(s.k>0)out=out.concat(hopMath(path(c[0],c[1],s.k),s.k,c[0],c[1],t,true));
      }
      else out.push(t("learn.r.tap"));
      return out;
    }
  };
}

/* ---- the drawings, by the step's name ---- */
export const FIGS={
once:squareFig({x:1.5,lo:0,many:false,keys:[0,0.5,1,1.5,2]}),
minus:squareFig({x:-1.5,lo:-2,many:false,keys:[-2,-1,-0.5,0,0.5,1,2]}),
again:squareFig({x:0.9,lo:-2,many:true,keys:[-1,0,0.5,0.9,1,1.1]}),
addc:addcFig({c:-0.5,keys:[-0.5,0,0.25,0.5]}),
cycles:addcFig({c:-1,tail:true,keys:[-1.9,-1.755,-1.31,-1,-0.5]}),
bar:addcFig({c:-0.5,tail:true,bar:true,keys:[-2,-1,0,0.25]}),
point:pointFig({mode:"parts",a:1.5,b:0.8,lim:2.2,keys:[[1,1],[-1,1],[-1,-1],[1,-1],[2,1],[1,0],[0,1],[0,0]]}),
polar:pointFig({mode:"polar",a:0.8,b:0.6,lim:2.2,keys:[[1,0],[0,1],[-1,0],[0,-1],[0.8,0.6],[2,0],[1,1]]}),
sqpt:pointFig({mode:"sq",a:0.9,b:0.5,lim:1.5,keys:[[0,1],[1,0],[-1,0],[0,-1],[0.8,0.6],[0.5,0.5],[1,1]]}),
/* two points and their sum */
add:{
  keys:[{label:function(){return pt(0,0)},set:function(s){s.q=[0,0]}},{label:function(){return pt(1,0)},set:function(s){s.q=[1,0]}},{label:function(){return pt(0,1)},set:function(s){s.q=[0,1]}}],
  init:function(){return {p:[1,0.5],q:[0.5,0.75],grab:"p"}},
  S:function(w,h){return sheet(w,h,0,0,2.3)},
  draw:function(g,w,h,s,now,t,d){
    var S=this.S(w,h),p=s.p,q=s.q,ox=S.X(0),oy=S.Y(0),sx=S.X(p[0]+q[0]),sy=S.Y(p[1]+q[1]);
    clear(g,w,h);axes(g,w,h,d,S);
    arrow(g,ox,oy,S.X(p[0]),S.Y(p[1]),d,COOL,false);
    arrow(g,ox,oy,S.X(q[0]),S.Y(q[1]),d,HOT,false);
    arrow(g,S.X(p[0]),S.Y(p[1]),sx,sy,d,HOT,true); /* the slide: the pink arrow again, starting from the blue point */
    dot(g,sx,sy,6*d,INK);
    handle(g,S.X(p[0]),S.Y(p[1]),d,COOL);handle(g,S.X(q[0]),S.Y(q[1]),d,HOT);
    g.fillStyle=INK;words(g,d,11);g.textAlign="left";g.textBaseline="bottom";g.fillText(t("learn.f.sum"),sx+10*d,sy-8*d);
  },
  put:function(s,a,b,tol){
    var p=snapTo2(clamp(round(a,.05),-1.6,1.6),clamp(round(b,.05),-1.1,1.1),[[0,0],[1,0],[0,1],[1,1]],tol);
    s[s.grab]=[p[0],p[1]];
  },
  drag:function(u,v,s,w,h,tol,first){
    var S=this.S(w,h),a=S.x(u),b=S.y(v),D=function(p){return (p[0]-a)*(p[0]-a)+(p[1]-b)*(p[1]-b)};
    if(first)s.grab=D(s.q)<D(s.p)?"q":"p";
    this.put(s,a,b,tol/S.k);
  },
  key:function(dx,dy,s){this.put(s,s[s.grab][0]+dx*.05,s[s.grab][1]+dy*.05,0);},
  read:function(s,t){
    var p=s.p,q=s.q;
    return [t("learn.r.sum",num(p[0]),num(p[1]),num(q[0]),num(q[1]),num(p[0]+q[0]),num(p[1]+q[1])),
            t("learn.r.sumA",num(p[0]),num(q[0]),num(p[0]+q[0])),t("learn.r.sumU",num(p[1]),num(q[1]),num(p[1]+q[1]))];
  }
},
onehop:hopFig({a:0.2,b:0.5,step:true,keys:[[0.2,0.5],[-0.5,0.5],[0.5,0],[0,0]]}),
ring:hopFig({a:0.4,b:0.5,ring:true,keys:[[1,0],[0.4,0.5],[0.3,0.6],[-0.4,0.5]]}),
shapes:hopFig({a:0.25,b:0.4,ring:true,keys:[[0.25,0.4,"learn.k.one"],[-1,0.1,"learn.k.two"],[-0.12,0.75,"learn.k.three"],[-0.75,0.02,"learn.k.edge"]]}),
ask:gridFig({mode:"ask",N:16}),
count:gridFig({mode:"count",N:32}),
finer:gridFig({mode:"finer"}),
/* the last picture again, with the limit on the count as a slider */
patience:{
  ctl:[{k:"li",min:0,max:LIMS.length-1,step:1,label:function(s,t){return t("learn.c.limit",LIMS[s.li])}}],
  init:function(){return {li:0,G:null}},
  draw:function(g,w,h,s,now,t,d){
    if(!s.G)s.G=newGrid(320);
    gridStep(s.G,1,7);
    gridPaint(g,w,h,s.G,LIMS[s.li],false);
    ringOf(g,d,regSheet(w,h),2);
  },
  read:function(s,t){return [t("learn.r.limit",LIMS[s.li])];}
}
};

/* for the test tools and the browser console: every name in this file */
export const __dbg={HOPMAX, GRIDS, LIMS, REG, sqr2, hopsOut, visits, path, settled, hopMath, rowMath, snapTo, snapTo2, hopColour, num, verdict, FIGS, newGrid, gridStep, gridAsk, gridPaint, cellC};
