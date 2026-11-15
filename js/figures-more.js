/* The drawings of the third and fourth tracks of lessons: deeper into the Mandelbrot set (zooming, Julia sets, other rules),
   and how the other worlds are made (mirrors, turning, the kaleidoscope, a block, the carpet, then Sponge and Bulbs with
   depth). They have the same form as the ones in figures.js; see the comment at the top of that file. The arithmetic needs
   no page. */
import { md } from "./dom.js";
import { INK, HOT, COOL, dot, handle, sheet, axes, num, clamp, round, snapTo2, pt, keyOf, hopsOut } from "./figures.js";
export const KALE=[3,4,6,8,12];       /* the numbers of mirrors the app's Mirrors button offers (state.js; a test holds the two equal) */
const HOME=[-0.76,0];                 /* the middle of the picture that shows the whole Mandelbrot set */
const JHH=1.25;                       /* the Julia pictures show this far up and down from the middle */
const MAPR={x0:-2.2,x1:0.8,y0:-0.94,y1:0.94}; /* the small Mandelbrot set that c is chosen on */

/* ---- a picture made a square at a time ---- */
/* v holds one number for each square: -2 until it has been asked */
export function newRaster(N,M){
  var G={N:N,M:M,v:new Float32Array(N*M),next:0,dirty:true,was:"",off:null,img:null};
  G.v.fill(-2);G.off=document.createElement("canvas");G.off.width=N;G.off.height=M;G.img=G.off.getContext("2d").createImageData(N,M);
  return G;
}
/* ask a few more squares: at least `least`, then as many as fit in ms milliseconds */
export function rasterStep(G,ask,least,ms){
  var t0=performance.now(),tot=G.N*G.M,k=0;
  while(G.next<tot){G.v[G.next]=ask(G.next);G.next++;k++;G.dirty=true;if(k>=least&&(ms<=0||((k&63)===0&&performance.now()-t0>ms)))break;}
}
/* paint what has been asked; colour(v,i) gives [red,green,blue] out of 255; sig is whatever else the colours depend on */
export function rasterPaint(g,w,h,G,colour,sig,smooth){
  var i,c,P=G.img.data,tot=G.N*G.M;
  if(G.dirty||G.was!==sig){
    for(i=0;i<tot;i++){c=G.v[i]<-1.5?[11,6,24]:colour(G.v[i],i);P[i*4]=c[0];P[i*4+1]=c[1];P[i*4+2]=c[2];P[i*4+3]=255;}
    G.off.getContext("2d").putImageData(G.img,0,0);G.dirty=false;G.was=sig;
  }
  g.imageSmoothingEnabled=!!smooth;g.drawImage(G.off,0,0,w,h);
}
/* the colour for a count of hops out of a limit: black for never, dark for soon, bright for late */
export function countColour(n,max){
  var f,u,A=[38,22,96],B=[255,95,210],C=[200,250,255],P,Q;
  if(n<=0)return [0,0,0];
  f=Math.min(1,Math.log(n)/Math.log(max));if(f<.5){u=f*2;P=A;Q=B;}else{u=f*2-1;P=B;Q=C;}
  return [P[0]+(Q[0]-P[0])*u,P[1]+(Q[1]-P[1])*u,P[2]+(Q[2]-P[2])*u];
}

/* ---- the arithmetic ---- */
/* Start at (x,y), not at the middle; square and add c, over and over. The number of the first hop that lands outside the
   ring of radius 2 (1 if it starts outside), or 0 if none of the first max does. */
export function hopsFrom(x,y,cx,cy,max){
  var n,q;
  for(n=1;n<=max;n++){if(x*x+y*y>4)return n;q=x*x-y*y+cx;y=2*x*y+cy;x=q;}
  return 0;
}
/* the places such a path visits, as [x,y] pairs */
export function pathFrom(x,y,cx,cy,n){
  var i,q,out=[[x,y]];
  for(i=0;i<n;i++){q=x*x-y*y+cx;y=2*x*y+cy;x=q;out.push([x,y]);if(x*x+y*y>1e4)break;}
  return out;
}
/* The rule with another power: the distance to the power p and the angle times p, then add c, from the middle. With ship
   true, both parts are made positive before each squaring. The hop that leaves the ring, or 0. */
export function hopsPow(cx,cy,p,max,ship){
  var x=0,y=0,n,q,r,a;
  for(n=1;n<=max;n++){
    if(ship){x=Math.abs(x);y=Math.abs(y);}
    if(p===2){q=x*x-y*y+cx;y=2*x*y+cy;x=q;}
    else{r=Math.pow(x*x+y*y,p/2);a=Math.atan2(y,x)*p;x=r*Math.cos(a)+cx;y=r*Math.sin(a)+cy;}
    if(x*x+y*y>4)return n;
  }
  return 0;
}
/* a round pillar at (1.2, 0.7) with radius 0.5: the room at a place */
export function pillarD(x,y){return Math.hypot(x-1.2,y-.7)-.5;}
/* fold an angle (degrees) into the first wedge of a kaleidoscope with n mirrors: the wedge is 180/n wide */
export function wedgeFold(ang,n){var W=180/n,f=md(ang,2*W);return f>W?2*W-f:f;}
/* the room at a place in the carpet: a square block with a square hole in its middle, a smaller hole in the middle of each
   third of it, and so on for n sizes of hole. Below zero is solid. */
export function carpetLevel(x,y,i){var s=Math.pow(3,i);return (1/3-Math.max(Math.abs(md(x*s+1,2)-1),Math.abs(md(y*s+1,2)-1)))/s;}
export function carpetD(x,y,n){var d=Math.max(Math.abs(x),Math.abs(y))-1,i;for(i=0;i<n;i++)d=Math.max(d,carpetLevel(x,y,i));return d;}

/* ---- looking closer at the Mandelbrot set ---- */
/* o.at: the place the picture closes in on; o.max: how many doublings; o.world: a world to fly through from this step */
function zoomFig(o){
  function hh(s){return 1.1/Math.pow(2,s.zi);}
  function mid(s){var f=1/Math.pow(2,s.zi);return [o.at[0]+(HOME[0]-o.at[0])*f,o.at[1]+(HOME[1]-o.at[1])*f];}
  function lim(s){return 150+50*s.zi;}
  return {
    world:o.world||"",
    ctl:[{k:"zi",min:0,max:o.max,step:1,label:function(s,t){return t("learn.m.mag",Math.pow(2,s.zi))}}],
    keys:o.keys.map(function(v){return {label:function(s,t){return t("learn.m.mag",Math.pow(2,v))},set:function(s){s.zi=v}};}),
    init:function(){return {zi:0,G:null}},
    changed:function(s){s.G=null;},
    draw:function(g,w,h,s,now,t,d){
      var G,H=hh(s),c=mid(s),L=lim(s);
      if(!s.G)s.G=newRaster(192,120);
      G=s.G;
      rasterStep(G,function(i){return hopsOut(c[0]+((i%G.N+.5)/G.N-.5)*3.2*H,c[1]-((Math.floor(i/G.N)+.5)/G.M-.5)*2*H,L);},1,9);
      rasterPaint(g,w,h,G,function(v){return countColour(v,L)},"",true);
      /* a small cross where the picture is closing in */
      g.strokeStyle=INK;g.lineWidth=d;g.beginPath();
      var X=w/2+(o.at[0]-c[0])/(3.2*H)*w,Y=h/2-(o.at[1]-c[1])/(2*H)*h;
      g.moveTo(X-7*d,Y);g.lineTo(X-2*d,Y);g.moveTo(X+2*d,Y);g.lineTo(X+7*d,Y);g.moveTo(X,Y-7*d);g.lineTo(X,Y-2*d);g.moveTo(X,Y+2*d);g.lineTo(X,Y+7*d);g.stroke();
    },
    read:function(s,t){return [t("learn.m.mag",Math.pow(2,s.zi)),t("learn.m.wide",num(3.2*hh(s),s.zi>6?5:2)),t("learn.c.limit",lim(s))];}
  };
}

/* ---- Julia sets: c stays the same and each square is a place to start from ---- */
/* o.map: a small Mandelbrot set in the corner, on which c is dragged */
function juliaFig(o){
  var N=o.map?160:192,M=o.map?100:120,LIM=o.map?80:120,P=o.keys.map(function(k){return [k[0],k[1]]});
  function box(w,h,d){var bw=Math.round(w*.42);return {x:w-bw-6*d,y:6*d,w:bw,h:Math.round(bw*5/8)};}
  return {
    keys:o.keys.map(function(k){return {label:function(s,t){return t("learn.r.cpt",String(k[0]),String(k[1]))},set:function(s){s.a=k[0];s.b=k[1];s.G=null;}};}),
    init:function(){return {a:o.a,b:o.b,G:null,sx:null,sy:0,MG:null,grab:""}},
    S:function(w,h){return sheet(w,h,0,0,JHH)},
    draw:function(g,w,h,s,now,t,d){
      var G,S=this.S(w,h),pts,i,n,B,MG;
      if(!s.G)s.G=newRaster(N,M);
      G=s.G;
      rasterStep(G,function(i){return hopsFrom(((i%N+.5)/N-.5)*3.2*JHH,-((Math.floor(i/N)+.5)/M-.5)*2*JHH,s.a,s.b,LIM);},1,9);
      rasterPaint(g,w,h,G,function(v){return countColour(v,LIM)},"",true);
      /* the hops from the chosen start. Here they belong on the picture: its squares are places, and the hops move among them. */
      if(s.sx!==null){
        n=hopsFrom(s.sx,s.sy,s.a,s.b,LIM);pts=pathFrom(s.sx,s.sy,s.a,s.b,n?n:60);
        g.strokeStyle="rgba(243,236,255,.8)";g.lineWidth=1.2*d;g.beginPath();
        for(i=0;i<pts.length;i++){if(i)g.lineTo(S.X(pts[i][0]),S.Y(pts[i][1]));else g.moveTo(S.X(pts[i][0]),S.Y(pts[i][1]));}
        g.stroke();
        for(i=1;i<pts.length;i++)dot(g,S.X(pts[i][0]),S.Y(pts[i][1]),2*d,INK);
        handle(g,S.X(s.sx),S.Y(s.sy),d,COOL);
      }
      if(!o.map)return;
      /* the small Mandelbrot set, and c on it */
      B=box(w,h,d);
      if(!s.MG){s.MG=newRaster(120,75);MG=s.MG;rasterStep(MG,function(i){return hopsOut(MAPR.x0+(i%120+.5)/120*(MAPR.x1-MAPR.x0),MAPR.y1-(Math.floor(i/120)+.5)/75*(MAPR.y1-MAPR.y0),100);},120*75,0);}
      g.save();g.beginPath();g.rect(B.x,B.y,B.w,B.h);g.clip();g.translate(B.x,B.y);
      rasterPaint(g,B.w,B.h,s.MG,function(v){return countColour(v,100)},"",true);
      handle(g,(s.a-MAPR.x0)/(MAPR.x1-MAPR.x0)*B.w,(MAPR.y1-s.b)/(MAPR.y1-MAPR.y0)*B.h,d,HOT);
      g.restore();
      g.strokeStyle=INK;g.lineWidth=d;g.strokeRect(B.x,B.y,B.w,B.h);
    },
    drag:function(u,v,s,w,h,tol,first){
      var S=this.S(w,h),B=box(w,h,tol/11),p,a,b; /* tol is 11 screen pixels, so tol/11 is one */
      if(first)s.grab=o.map&&u>=B.x&&u<=B.x+B.w&&v>=B.y&&v<=B.y+B.h?"c":"z";
      if(s.grab==="c"){
        a=MAPR.x0+clamp((u-B.x)/B.w,0,1)*(MAPR.x1-MAPR.x0);b=MAPR.y1-clamp((v-B.y)/B.h,0,1)*(MAPR.y1-MAPR.y0);
        p=snapTo2(round(a,.005),round(b,.005),P,tol/B.w*(MAPR.x1-MAPR.x0));
        if(p[0]!==s.a||p[1]!==s.b){s.a=p[0];s.b=p[1];s.G=null;}
        return;
      }
      s.sx=round(S.x(u),.01);s.sy=round(S.y(v),.01);
    },
    key:function(dx,dy,s){if(s.sx===null){s.sx=0;s.sy=0;}s.sx=round(s.sx+dx*.02,.01);s.sy=round(s.sy+dy*.02,.01);},
    read:function(s,t){
      var out=[t("learn.r.cpt",num(s.a,3),num(s.b,3))],n;
      if(o.map)out.push(hopsOut(s.a,s.b,400)?t("learn.m.dust"):t("learn.m.whole"));
      if(s.sx===null){out.push(t("learn.m.tapStart"));return out;}
      n=hopsFrom(s.sx,s.sy,s.a,s.b,LIM);
      out.push(t("learn.m.start",num(s.sx),num(s.sy)),n?t("learn.r.leaves",n-1):t("learn.m.stays",LIM));
      return out;
    }
  };
}

/* ---- other rules: another power, or both parts made positive before squaring ---- */
function ruleFig(o){
  var N=192,M=120,LIM=80,HH=1.5,CX=o.ship?-0.45:-0.3,CY=o.ship?-0.55:0;
  return {
    ctl:o.ship?null:[{k:"p",min:2,max:6,step:1,label:function(s,t){return t("learn.m.pow",s.p)}}],
    init:function(){return {p:2,G:null}},
    changed:function(s){s.G=null;},
    draw:function(g,w,h,s,now,t,d){
      var G;
      if(!s.G)s.G=newRaster(N,M);
      G=s.G;
      /* the ship is drawn the usual way up, which is with "up" pointing down */
      rasterStep(G,function(i){var y=CY-((Math.floor(i/N)+.5)/M-.5)*2*HH;return hopsPow(CX+((i%N+.5)/N-.5)*3.2*HH,o.ship?-y:y,s.p,LIM,!!o.ship);},1,9);
      rasterPaint(g,w,h,G,function(v){return countColour(v,LIM)},"",true);
    },
    read:function(s,t){return o.ship?[t("learn.m.shipRule")]:[t("learn.m.rule",s.p),t("learn.m.sym",s.p-1)];}
  };
}

/* ---- shapes from sums on a flat sheet: solid and empty space, and a dot that shows the room it has ---- */
/* o.D(s,x,y) the room at a place; o.lines(s,t,x,y,out) adds this step's sums; o.sig(s) whatever the shape depends on;
   o.init extra fields of the state; o.hh how far up the sheet is shown; o.ctl sliders; o.keys sticky points; o.end the
   words for being inside the solid */
function sheetFig(o){
  var HH=o.hh||2.3;
  return {
    ctl:o.ctl||null,
    keys:(o.ckeys||[]).concat((o.keys||[]).map(function(p){return {label:function(){return pt(p[0],p[1])},set:function(s){s.a=p[0];s.b=p[1]}};})),
    init:function(){var s={a:o.a,b:o.b,sig:null,off:null,img:null},k;for(k in (o.init||{}))s[k]=o.init[k];return s;},
    S:function(w,h){return sheet(w,h,0,0,HH)},
    draw:function(g,w,h,s,now,t,d){
      var S=this.S(w,h),W=400,H=250,x,y,i,r,px=2*HH/H,P,room,sg=o.sig?o.sig(s):"";
      if(!s.off){s.off=document.createElement("canvas");s.off.width=W;s.off.height=H;s.img=s.off.getContext("2d").createImageData(W,H);}
      if(s.sig!==sg){
        s.sig=sg;P=s.img.data;
        for(y=0;y<H;y++)for(x=0;x<W;x++){
          r=o.D(s,(x+.5-W/2)*px,(H/2-y-.5)*px);i=(y*W+x)*4;
          if(Math.abs(r)<px*.9){P[i]=255;P[i+1]=95;P[i+2]=210;}else if(r<0){P[i]=70;P[i+1]=42;P[i+2]=128;}else{P[i]=11;P[i+1]=6;P[i+2]=24;}
          P[i+3]=255;
        }
        s.off.getContext("2d").putImageData(s.img,0,0);
      }
      g.imageSmoothingEnabled=true;g.drawImage(s.off,0,0,w,h);
      axes(g,w,h,d,S);
      if(o.over)o.over(g,d,S,s);
      room=o.D(s,s.a,s.b);
      if(room>0){g.strokeStyle=COOL;g.lineWidth=1.5*d;g.beginPath();g.arc(S.X(s.a),S.Y(s.b),room*S.k,0,6.2832);g.stroke();}
      handle(g,S.X(s.a),S.Y(s.b),d,room>0?COOL:HOT);
    },
    set:function(s,a,b,tol){var p=snapTo2(clamp(round(a,.02),-1.56*HH,1.56*HH),clamp(round(b,.02),-.96*HH,.96*HH),o.keys||[],tol);s.a=p[0];s.b=p[1];},
    drag:function(u,v,s,w,h,tol){var S=this.S(w,h);this.set(s,S.x(u),S.y(v),tol/S.k);},
    key:function(dx,dy,s){this.set(s,s.a+dx*.02,s.b+dy*.02,0);},
    read:function(s,t){
      var out=[t("learn.s.pos",num(s.a),num(s.b))],r=o.D(s,s.a,s.b);
      o.lines(s,t,s.a,s.b,out);
      out.push(r<0?t(o.end||"learn.s.inPillar"):t("learn.s.room"));
      return out;
    }
  };
}
/* the sums for the pillar at (1.2, 0.7), from a place (x,y) that has already been folded or turned */
function pillarLines(t,x,y,out){
  var l=Math.hypot(x-1.2,y-.7);
  out.push(t("learn.w.from",num(x-1.2),num(y-.7)),t("learn.r.pyth",num(x-1.2),num(y-.7),num(l)),t("learn.s.minusR",num(l),num(.5),num(l-.5)));
}
/* a place turned by A degrees */
function turned(x,y,A){var c=Math.cos(A*Math.PI/180),s=Math.sin(A*Math.PI/180);return [x*c+y*s,y*c-x*s,c,s];}
/* the kaleidoscope's shape: a place folded into the first wedge, where two small pillars stand */
function kaleD(x,y,n){
  var r=Math.hypot(x,y),f=wedgeFold(md(Math.atan2(y,x)*180/Math.PI,360),n)*Math.PI/180,X=r*Math.cos(f),Y=r*Math.sin(f);
  return Math.min(Math.hypot(X-1.4,Y-.2)-.14,Math.hypot(X-.75,Y-.05)-.045);
}

/* ---- the drawings, by the step's name ---- */
export const MORE_FIGS={
zoom:zoomFig({at:[-0.7453,0.1127],max:14,keys:[0,4,8,12]}),
baby:zoomFig({at:[-1.7549,0],max:10,keys:[0,3,6,9],world:"mzoom"}),
start:juliaFig({a:0,b:0,keys:[[0,0],[-1,0],[-0.12,0.75],[-0.4,0.6],[0.3,0.5]]}),
map:juliaFig({map:true,a:-0.4,b:0.6,keys:[[0,0],[-1,0],[-0.12,0.75],[0.3,0.5],[-0.75,0.1]]}),
power:ruleFig({}),
ship:ruleFig({ship:true}),
mirror:sheetFig({a:-1.6,b:1.1,keys:[[1.2,0.7],[-1.2,0.7],[0,0.7]],D:function(s,x,y){return pillarD(Math.abs(x),y)},
  lines:function(s,t,x,y,out){out.push(t("learn.w.absA",num(x),num(Math.abs(x))));pillarLines(t,Math.abs(x),y,out);}}),
mirror2:sheetFig({a:-1.6,b:-1.1,keys:[[1.2,0.7],[-1.2,0.7],[-1.2,-0.7],[1.2,-0.7],[0,0]],D:function(s,x,y){return pillarD(Math.abs(x),Math.abs(y))},
  lines:function(s,t,x,y,out){out.push(t("learn.w.absA",num(x),num(Math.abs(x))),t("learn.w.absU",num(y),num(Math.abs(y))));pillarLines(t,Math.abs(x),Math.abs(y),out);}}),
turn:sheetFig({a:1.6,b:0.4,init:{A:30},sig:function(s){return String(s.A)},
  ctl:[{k:"A",min:0,max:90,step:5,keys:[0,30,45,60,90],label:function(s,t){return t("learn.w.turnBy",s.A)}}],
  ckeys:[0,30,45,90].map(function(v){return keyOf("A",v,"learn.w.turnBy")}),
  D:function(s,x,y){var q=turned(x,y,s.A);return pillarD(Math.abs(q[0]),Math.abs(q[1]));},
  lines:function(s,t,x,y,out){
    var q=turned(x,y,s.A);
    out.push(t("learn.w.cs",s.A,num(q[2]),num(q[3])),t("learn.w.rotA",num(x),num(q[2]),num(y),num(q[3]),num(q[0])),t("learn.w.rotU",num(y),num(q[2]),num(x),num(q[3]),num(q[1])));
  }}),
kale:sheetFig({a:1.2,b:0.6,init:{n:3},sig:function(s){return String(s.n)},
  ctl:[{k:"n",min:2,max:12,step:1,label:function(s,t){return t("learn.w.mirrors",s.n)}}],
  ckeys:KALE.map(function(v){return keyOf("n",v,"learn.w.mirrors")}), /* the app's own mirror settings */
  D:function(s,x,y){return kaleD(x,y,s.n)},
  over:function(g,d,S,s){ /* the mirrors, as faint lines from the middle */
    var i,a;g.strokeStyle="rgba(95,240,255,.25)";g.lineWidth=d;g.beginPath();
    for(i=0;i<2*s.n;i++){a=i*Math.PI/s.n;g.moveTo(S.X(0),S.Y(0));g.lineTo(S.X(5*Math.cos(a)),S.Y(5*Math.sin(a)));}
    g.stroke();
  },
  lines:function(s,t,x,y,out){
    var ang=md(Math.atan2(y,x)*180/Math.PI,360);
    out.push(t("learn.r.polar",num(Math.hypot(x,y)),Math.round(ang)),t("learn.w.wedge",s.n,num(180/s.n,1)),t("learn.w.fold",Math.round(ang),num(wedgeFold(ang,s.n),1)));
  }}),
box:sheetFig({a:1.8,b:0.3,keys:[[1.2,0],[0,0.7],[1.2,0.7],[0,0],[2,1.5]],end:"learn.w.inBlock",D:function(s,x,y){return Math.max(Math.abs(x)-1.2,Math.abs(y)-.7)},
  lines:function(s,t,x,y,out){
    out.push(t("learn.w.gapA",num(Math.abs(x)),num(1.2),num(Math.abs(x)-1.2)),t("learn.w.gapU",num(Math.abs(y)),num(.7),num(Math.abs(y)-.7)),
             t("learn.s.larger",num(Math.max(Math.abs(x)-1.2,Math.abs(y)-.7))));
  }}),
carpet:sheetFig({a:0.5,b:0.2,hh:1.25,init:{n:1},sig:function(s){return String(s.n)},end:"learn.w.inBlock",keys:[[0,0],[0.5,0.2],[0.67,0.67]],
  ctl:[{k:"n",min:0,max:4,step:1,label:function(s,t){return t("learn.w.holes",s.n)}}],
  D:function(s,x,y){return carpetD(x,y,s.n)},
  lines:function(s,t,x,y,out){
    var i;
    out.push(t("learn.w.block",num(Math.max(Math.abs(x),Math.abs(y))-1,3)));
    for(i=0;i<s.n;i++)out.push(t("learn.w.hole",i+1,Math.pow(3,i),num(carpetLevel(x,y,i),3)));
    out.push(t("learn.s.larger",num(carpetD(x,y,s.n),3)));
  }})
};

/* for the test tools and the browser console: every name in this file */
export const __dbg={MORE_FIGS, KALE, newRaster, rasterStep, rasterPaint, countColour, hopsFrom, pathFrom, hopsPow, pillarD, wedgeFold, carpetLevel, carpetD, kaleD, turned};
