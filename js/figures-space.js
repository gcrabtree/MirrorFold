/* The drawings of the second track of lessons, from a flat picture to a world you can fly through. They have the same form
   as the ones in figures.js (see the comment at the top of that file), with two more fields:
     moves   true where the things walked through are the safe moves along a line of sight, so the buttons say "move"
     world   the id of a world; the step then has a button that shuts the lessons and flies through it
   The arithmetic needs no page. The shape built here is the app's own Foam world: foam2 is its sum on a flat sheet, and the
   pictures with depth use that world's own distance function from worlds.js. */
import { calm, md } from "./dom.js";
import { INK, DIM, FAINT, HOT, COOL, FONT, clear, words, dot, handle, arrow, sheet, axes, num, clamp, round, snapTo2, pt, keyOf } from "./figures.js";
import { WORLDS } from "./worlds.js";
const ROCK=[70,42,128],ROCKS="rgb(70,42,128)";
/* the flat world of the first four steps, seen from above: round pillars as [across, up, radius], an eye, and in front of
   the eye a row of squares, which is its picture */
const PIL=[[-1.3,1.1,.6],[0.9,0.5,.5],[0.2,2.0,.6],[-0.35,-0.1,.22]];
const EYE=[0,-2.1],SCR_Y=-1.3,SCR_W=1.5;
const FLAT_FAR=8,FLAT_NEAR=0.01;
const ROWS=[9,17,33,65,129];           /* how many squares the row can have */
const SHOTS=[16,32,64,128,256];        /* how many squares across the picture with depth can have */
const TANX=0.9;                        /* half the picture's width, one unit in front of the eye */
const LOOK=[0.3,0.12,0.95];            /* the way the eye looks in the pictures with depth (made one unit long in view()) */
const SHOT_FAR=16;

/* ---- the arithmetic ---- */
/* the room at a place in the flat world: the distance to the nearest pillar */
export function flatD(x,y){var d=1e9,i;for(i=0;i<PIL.length;i++)d=Math.min(d,Math.hypot(x-PIL[i][0],y-PIL[i][1])-PIL[i][2]);return d;}
/* the direction of the line of sight through square i of a row of N, one unit long */
export function flatRay(i,N){var dx=-SCR_W/2+(i+.5)*SCR_W/N-EYE[0],dy=SCR_Y-EYE[1],l=Math.hypot(dx,dy);return [dx/l,dy/l];}
/* Walk a line in safe moves. D gives the room at a place; the line starts at o and goes along d (one unit long). Each entry
   of the answer is [how far along the line, the room there]. The walk ends when the room is less than near(how far), which
   is arriving at a surface, or when it has gone further than far. */
export function walkLine(D,ox,oy,oz,dx,dy,dz,near,far,max){
  var t=0,out=[],r,i;
  for(i=0;i<max;i++){r=D(ox+dx*t,oy+dy*t,oz+dz*t);out.push([t,r]);if(r<near(t)||t>far)break;t+=r;}
  return out;
}
/* whether a walk ended at a surface */
export function arrived(list,near){var e=list[list.length-1];return e[1]<near(e[0]);}
/* Bubbles in solid rock on a flat sheet: the room at a place. Level 0 has a bubble of radius R1 in every cell 2 units wide;
   each level after it is 3 times smaller, with bubbles of radius 0.92 (before shrinking). Levels lo to hi are used, and the
   largest room wins. Below zero is rock. With R1 = 1.25 and levels 0 to 3 this is the Foam world's sum, without its depth. */
export function foamLevel(x,y,i,R1){var s=Math.pow(3,i);return ((i?0.92:R1)-Math.hypot(md(x*s,2)-1,md(y*s,2)-1))/s;}
export function foam2(x,y,lo,hi,R1){var d=-1e5,i;for(i=lo;i<=hi;i++)d=Math.max(d,foamLevel(x,y,i,R1));return d;}
/* the room at a place in one of the app's worlds, by the world's own distance function: worldD("foam") gives the function */
export function worldD(id){
  var i,w=null;
  for(i=0;i<WORLDS.length;i++)if(WORLDS[i].id===id)w=WORLDS[i];
  return function(x,y,z){return w.de(x,y,z,0);};
}
/* the room at a place in the Foam world itself */
export function foamD(x,y,z){
  if(!foamD.f)foamD.f=worldD("foam");
  return foamD.f(x,y,z);
}
function unit(v){var l=Math.hypot(v[0],v[1],v[2]);return [v[0]/l,v[1]/l,v[2]/l];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
/* the eye's three directions: forward, right and up */
export function view(look){var f=unit(look||LOOK),r=unit(cross([0,1,0],f));return {f:f,r:r,u:cross(f,r)};}
/* the direction of the lamp: it goes round the line of sight, a little behind the eye; a is in degrees */
export function lampDir(a,look){var V=view(look),c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);return unit([V.r[0]*c+V.u[0]*s-V.f[0]*.6,V.r[1]*c+V.u[1]*s-V.f[1]*.6,V.r[2]*c+V.u[2]*s-V.f[2]*.6]);}
/* the rows of sums for a walk: four moves around move k, the one being looked at marked */
function moveRows(list,k,t){
  var out=[],i,n=list.length-1,from=Math.max(1,Math.min(k-2,n-3));
  for(i=from;i<from+4&&i<=n;i++)out.push((i===k?"▸ ":"  ")+t("learn.s.move",i,num(list[i-1][1]),num(list[i][0])));
  return out;
}
function walkVerdict(list,hit,t){var n=list.length-1;return hit?t("learn.s.arrive",n,num(list[n][0])):t("learn.s.gaveup",n);}
/* the colour for a line of sight that went this far: bright for near, dim for far */
function depthColour(far,scale){var v=Math.exp(-scale*far);return [38+v*217,22+v*128,96+v*129];}

/* ---- the flat world: lines of sight, the nearest thing, the walk, the painted row ---- */
function flatFig(o){
  function near(){return FLAT_NEAR;}
  function N(s){return o.mode==="row"?ROWS[s.ni]:9;}
  function walkOf(s,i){var r=flatRay(i,N(s));return walkLine(flatD,EYE[0],EYE[1],0,r[0],r[1],0,near,FLAT_FAR,80);}
  /* what every square of the row sees: how far its line went, or -1 for nothing */
  function seen(s){
    var n=N(s),i,L;
    if(!s.res||s.res.length!==n){s.res=[];for(i=0;i<n;i++){L=walkOf(s,i);s.res.push(arrived(L,near)?L[L.length-1][0]:-1);}}
    return s.res;
  }
  function shade(far){var c;if(far<0)return "#000";c=depthColour(far,o.mode==="ray"?0:.45);return "rgb("+Math.round(c[0])+","+Math.round(c[1])+","+Math.round(c[2])+")";}
  return {
    moves:true,
    ctl:o.mode==="row"?[{k:"ni",min:0,max:ROWS.length-1,step:1,label:function(s,t){return t("learn.c.row",ROWS[s.ni])}}]:null,
    init:function(){return {i:6,ni:0,k:0,a:0.4,b:-0.9,res:null,was:9}},
    walk:o.mode==="march"||o.mode==="row"?function(s){return walkOf(s,s.i).length-1}:null,
    changed:function(s){var n=N(s);if(n!==s.was){s.i=Math.floor((s.i+.5)/s.was*n);s.was=n;s.k=0;}},
    S:function(w,h){return sheet(w,h,0,0.45,2.85)},
    draw:function(g,w,h,s,now,t,d){
      var S=this.S(w,h),i,n=N(s),r,L,e,R,x0,cw,top=24*d,room;
      clear(g,w,h);
      for(i=0;i<PIL.length;i++){g.fillStyle=ROCKS;g.beginPath();g.arc(S.X(PIL[i][0]),S.Y(PIL[i][1]),PIL[i][2]*S.k,0,6.2832);g.fill();}
      if(o.mode==="safe"){
        room=flatD(s.a,s.b);
        if(room>0){g.strokeStyle=COOL;g.lineWidth=1.5*d;g.beginPath();g.arc(S.X(s.a),S.Y(s.b),room*S.k,0,6.2832);g.stroke();}
        handle(g,S.X(s.a),S.Y(s.b),d,room>0?COOL:HOT);return;
      }
      R=o.mode==="march"?null:seen(s);
      /* every line of sight faintly, in the painted row */
      if(o.mode==="row"&&n<=33){
        g.strokeStyle="rgba(243,236,255,.1)";g.lineWidth=d;g.beginPath();
        for(i=0;i<n;i++){r=flatRay(i,n);e=R[i]<0?FLAT_FAR:R[i];g.moveTo(S.X(EYE[0]),S.Y(EYE[1]));g.lineTo(S.X(EYE[0]+r[0]*e),S.Y(EYE[1]+r[1]*e));}
        g.stroke();
      }
      /* the chosen square's line */
      r=flatRay(s.i,n);L=walkOf(s,s.i);e=arrived(L,near)?L[L.length-1][0]:FLAT_FAR;
      g.strokeStyle=COOL;g.lineWidth=1.5*d;g.beginPath();g.moveTo(S.X(EYE[0]),S.Y(EYE[1]));g.lineTo(S.X(EYE[0]+r[0]*e),S.Y(EYE[1]+r[1]*e));g.stroke();
      if(arrived(L,near))dot(g,S.X(EYE[0]+r[0]*e),S.Y(EYE[1]+r[1]*e),5*d,HOT);
      /* the walk: the room at each place it stopped, as a circle; all of them, or those up to the move being looked at */
      if(this.walk&&(o.mode==="march"||s.k>0)){
        for(i=0;i<L.length-1&&(s.k===0||i<s.k);i++){
          g.strokeStyle=i===s.k-1?INK:"rgba(95,240,255,.35)";g.lineWidth=(i===s.k-1?2:1)*d;
          g.beginPath();g.arc(S.X(EYE[0]+r[0]*L[i][0]),S.Y(EYE[1]+r[1]*L[i][0]),Math.max(0,L[i][1])*S.k,0,6.2832);g.stroke();
          dot(g,S.X(EYE[0]+r[0]*L[i][0]),S.Y(EYE[1]+r[1]*L[i][0]),2.5*d,INK);
        }
        if(s.k>0)dot(g,S.X(EYE[0]+r[0]*L[s.k][0]),S.Y(EYE[1]+r[1]*L[s.k][0]),5*d,HOT);
      }
      /* the row of squares in front of the eye, and the eye */
      x0=S.X(-SCR_W/2);cw=SCR_W*S.k/n;
      for(i=0;i<n;i++){if(R){g.fillStyle=shade(R[i]);g.fillRect(x0+i*cw,S.Y(SCR_Y)-5*d,cw+.5,10*d);}}
      g.strokeStyle=DIM;g.lineWidth=d;g.strokeRect(x0,S.Y(SCR_Y)-5*d,SCR_W*S.k,10*d);
      if(n<=17){g.beginPath();for(i=1;i<n;i++){g.moveTo(x0+i*cw,S.Y(SCR_Y)-5*d);g.lineTo(x0+i*cw,S.Y(SCR_Y)+5*d);}g.stroke();}
      g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect(x0+s.i*cw,S.Y(SCR_Y)-5*d,cw,10*d);
      dot(g,S.X(EYE[0]),S.Y(EYE[1]),6*d,INK);
      g.fillStyle=DIM;words(g,d,11);g.textAlign="left";g.textBaseline="middle";g.fillText(t("learn.f.eye"),S.X(EYE[0])+12*d,S.Y(EYE[1]));
      /* the picture: the same row, large, along the top */
      if(R){
        cw=w/n;
        for(i=0;i<n;i++){g.fillStyle=shade(R[i]);g.fillRect(i*cw,0,cw+.5,top);}
        g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect(s.i*cw+d,d,cw-2*d,top-2*d);
        g.fillStyle=DIM;words(g,d,10);g.textAlign="left";g.textBaseline="top";g.fillText(t("learn.f.picture"),6*d,top+4*d);
      }
    },
    drag:function(u,v,s,w,h){
      var S=this.S(w,h),x=S.x(u),y=S.y(v),n=N(s),i;
      if(o.mode==="safe"){s.a=clamp(round(x,.02),-4.2,4.2);s.b=clamp(round(y,.02),-2.3,3.2);return;}
      if(y<EYE[1]+.1)return;
      i=clamp(Math.floor((EYE[0]+(x-EYE[0])*(SCR_Y-EYE[1])/(y-EYE[1])+SCR_W/2)/SCR_W*n),0,n-1);
      if(i!==s.i){s.i=i;s.k=0;}
    },
    key:function(dx,dy,s){
      if(o.mode==="safe"){s.a=clamp(round(s.a+dx*.06,.02),-4.2,4.2);s.b=clamp(round(s.b+dy*.06,.02),-2.3,3.2);return;}
      s.i=clamp(s.i+dx,0,N(s)-1);s.k=0;
    },
    read:function(s,t){
      var out=[],i,m=1e9,r,L,hit;
      if(o.mode==="safe"){
        for(i=0;i<PIL.length;i++){r=Math.hypot(s.a-PIL[i][0],s.b-PIL[i][1])-PIL[i][2];m=Math.min(m,r);out.push(t("learn.s.pillar",i+1,num(r)));}
        out.push(m<0?t("learn.s.inPillar"):t("learn.s.nearest",num(m)));return out;
      }
      L=walkOf(s,s.i);hit=arrived(L,near);out.push(t("learn.s.sq",s.i+1,N(s)));
      if(o.mode==="ray"){out.push(hit?t("learn.s.hits",num(L[L.length-1][0])):t("learn.s.misses"));return out;}
      return out.concat(moveRows(L,s.k,t),[walkVerdict(L,hit,t)]);
    }
  };
}

/* ---- shapes from sums, on a flat sheet: rock and empty space, and a dot that shows the room it has ---- */
function fieldFig(o){
  /* the room at a place, for this step's shape */
  function D(s,x,y){
    switch(o.mode){
      case "ball":return Math.hypot(x,y)-1;
      case "hollow":return 1-Math.hypot(x,y);
      case "repeat":return foam2(x,y,0,0,.8);
      case "join":return foam2(x,y,0,0,s.R);
      case "small":return foam2(x,y,1,1,0);
      case "levels":return foam2(x,y,0,s.n-1,R2);
      default:return foam2(x,y,0,1,R2);
    }
  }
  /* On a flat sheet, bubbles of the Foam world's own radius, 1.25, leave so little rock that the smaller bubbles have
     nothing to eat, so the steps with several sizes use 1.1. (With depth, 1.25 leaves plenty.) */
  var R2=1.1,HH=o.hh||2.3;
  var E=0.15*HH/2.3; /* how far the tiny steps go in the step about which way a wall faces */
  return {
    ctl:o.mode==="join"?[{k:"R",min:.5,max:1.4,step:.01,keys:[.8,1,1.1,1.25],label:function(s,t){return t("learn.c.radius",num(s.R))}}]:
        o.mode==="levels"?[{k:"n",min:1,max:4,step:1,label:function(s,t){return t("learn.c.levels",s.n)}}]:null,
    keys:(o.mode==="join"?[.8,1,1.1,1.25].map(function(v){return keyOf("R",v,"learn.c.radius")}):[]).concat(
         o.keys.map(function(p){return {label:function(){return pt(p[0],p[1])},set:function(s){s.a=p[0];s.b=p[1]}};})),
    init:function(){return {a:o.a,b:o.b,R:.8,n:1,sig:"",off:null,img:null}},
    S:function(w,h){return sheet(w,h,0,0,HH)},
    draw:function(g,w,h,s,now,t,d){
      var S=this.S(w,h),W=400,H=250,x,y,i,r,px=2*HH/H,P,room,gx,gy,l;
      /* the picture of the shape: made again only when a slider has changed it */
      if(!s.off){s.off=document.createElement("canvas");s.off.width=W;s.off.height=H;s.img=s.off.getContext("2d").createImageData(W,H);}
      if(s.sig!==o.mode+s.R+"/"+s.n){
        s.sig=o.mode+s.R+"/"+s.n;P=s.img.data;
        for(y=0;y<H;y++)for(x=0;x<W;x++){
          r=D(s,(x+.5-W/2)*px,(H/2-y-.5)*px);i=(y*W+x)*4;
          if(Math.abs(r)<px*.9){P[i]=255;P[i+1]=95;P[i+2]=210;}
          else if(r<0){P[i]=ROCK[0];P[i+1]=ROCK[1];P[i+2]=ROCK[2];}
          else{P[i]=11;P[i+1]=6;P[i+2]=24;}
          P[i+3]=255;
        }
        s.off.getContext("2d").putImageData(s.img,0,0);
      }
      g.imageSmoothingEnabled=true;g.drawImage(s.off,0,0,w,h);
      axes(g,w,h,d,S);
      room=D(s,s.a,s.b);
      if(o.mode==="ball"||o.mode==="hollow"){g.strokeStyle=DIM;g.lineWidth=d;g.beginPath();g.moveTo(S.X(0),S.Y(0));g.lineTo(S.X(s.a),S.Y(s.b));g.stroke();dot(g,S.X(0),S.Y(0),3*d,INK);}
      if(room>0){g.strokeStyle=COOL;g.lineWidth=1.5*d;g.beginPath();g.arc(S.X(s.a),S.Y(s.b),room*S.k,0,6.2832);g.stroke();}
      if(o.mode==="facing"){
        /* the four places a tiny step away, and the way the room grows fastest */
        dot(g,S.X(s.a+E),S.Y(s.b),3*d,INK);dot(g,S.X(s.a-E),S.Y(s.b),3*d,INK);dot(g,S.X(s.a),S.Y(s.b+E),3*d,INK);dot(g,S.X(s.a),S.Y(s.b-E),3*d,INK);
        gx=D(s,s.a+E,s.b)-D(s,s.a-E,s.b);gy=D(s,s.a,s.b+E)-D(s,s.a,s.b-E);l=Math.hypot(gx,gy);
        if(l>1e-6)arrow(g,S.X(s.a),S.Y(s.b),S.X(s.a+gx/l*.3*HH),S.Y(s.b+gy/l*.3*HH),d,HOT,false);
      }
      handle(g,S.X(s.a),S.Y(s.b),d,room>0?COOL:HOT);
    },
    set:function(s,a,b,tol){var q=HH<1?.01:.02,p=snapTo2(clamp(round(a,q),-1.56*HH,1.56*HH),clamp(round(b,q),-.96*HH,.96*HH),o.keys,tol);s.a=p[0];s.b=p[1];},
    drag:function(u,v,s,w,h,tol){var S=this.S(w,h);this.set(s,S.x(u),S.y(v),tol/S.k);},
    key:function(dx,dy,s){var q=HH<1?.01:.02;this.set(s,s.a+dx*q,s.b+dy*q,0);},
    read:function(s,t){
      var x=s.a,y=s.b,out=[t("learn.s.pos",num(x),num(y))],r=D(s,x,y),ax,ay,l,i,R,gx,gy,q;
      function end(){out.push(r<0?t(o.mode==="ball"?"learn.s.inPillar":"learn.s.rock"):t("learn.s.room"));return out;}
      /* a position inside its own cell, then the bubble sum there; R is the bubble's radius */
      function cell(px,py,R){
        ax=md(px,2)-1;ay=md(py,2)-1;l=Math.hypot(ax,ay);
        out.push(t("learn.s.remA",num(px),num(md(px,2)),num(ax)),t("learn.s.remU",num(py),num(md(py,2)),num(ay)),
                 t("learn.r.pyth",num(ax),num(ay),num(l)),t("learn.s.rMinus",num(R),num(l),num(R-l)));
        return R-l;
      }
      if(o.mode==="ball"){l=Math.hypot(x,y);out.push(t("learn.r.pyth",num(x),num(y),num(l)),t("learn.s.minusR",num(l),num(1),num(r)));return end();}
      if(o.mode==="hollow"){l=Math.hypot(x,y);out.push(t("learn.r.pyth",num(x),num(y),num(l)),t("learn.s.rMinus",num(1),num(l),num(r)));return end();}
      if(o.mode==="repeat"||o.mode==="join"){cell(x,y,o.mode==="join"?s.R:.8);return end();}
      if(o.mode==="small"){out.push(t("learn.s.times3",num(3*x),num(3*y)));q=cell(3*x,3*y,.92);out.push(t("learn.s.div3",num(q),num(q/3)));return end();}
      if(o.mode==="facing"){
        gx=D(s,x+E,y)-D(s,x-E,y);gy=D(s,x,y+E)-D(s,x,y-E);l=Math.hypot(gx,gy);
        out.push(t("learn.s.side",t("learn.s.aRight"),num(D(s,x+E,y),3),t("learn.s.aLeft"),num(D(s,x-E,y),3)),"  "+t("learn.s.diff",num(D(s,x+E,y),3),num(D(s,x-E,y),3),num(gx,3)),
                 t("learn.s.side",t("learn.s.aUp"),num(D(s,x,y+E),3),t("learn.s.aDown"),num(D(s,x,y-E),3)),"  "+t("learn.s.diff",num(D(s,x,y+E),3),num(D(s,x,y-E),3),num(gy,3)));
        if(l>1e-6)out.push(t("learn.s.arrow",num(gx,3),num(gy,3),num(gx/l),num(gy/l)));
        return out;
      }
      /* several sizes of bubble: the room each gives, and the largest */
      for(i=0;i<(o.mode==="levels"?s.n:2);i++)out.push(t("learn.s.level",i+1,Math.pow(3,i),num(foamLevel(x,y,i,R2),3)));
      out.push(t("learn.s.larger",num(r,3)));return end();
    }
  };
}

/* ---- a picture of the Foam world, with depth: every square's line of sight walked in safe moves ---- */
/* cfg says which world: D its distance function, eye where the eye starts, look the way it looks, far how far a line is followed */
function newShot(N,e,cfg){
  var M=Math.round(N*5/8),G={N:N,M:M,e:e,cfg:cfg,far:new Float32Array(N*M),nx:new Float32Array(N*M),ny:new Float32Array(N*M),nz:new Float32Array(N*M),next:0,dirty:true,was:"",off:null,img:null};
  G.far.fill(-2); /* -2: not asked yet; -1: its line hit nothing; otherwise how far its line went */
  G.off=document.createElement("canvas");G.off.width=N;G.off.height=M;G.img=G.off.getContext("2d").createImageData(N,M);
  return G;
}
function shotNear(G){var pix=2*TANX/G.N;return function(far){return .6*pix*far+1e-4;};}
/* the line of sight of square i: where it starts, and its direction */
function shotRay(G,i){
  var V=view(G.cfg.look),u=((i%G.N+.5)/G.N*2-1)*TANX,v=(1-(Math.floor(i/G.N)+.5)/G.M*2)*TANX*G.M/G.N,E=G.cfg.eye;
  return {o:[E[0],E[1],E[2]+G.e],d:unit([V.f[0]+u*V.r[0]+v*V.u[0],V.f[1]+u*V.r[1]+v*V.u[1],V.f[2]+u*V.r[2]+v*V.u[2]])};
}
function shotWalk(G,i){var R=shotRay(G,i);return walkLine(G.cfg.D,R.o[0],R.o[1],R.o[2],R.d[0],R.d[1],R.d[2],shotNear(G),G.cfg.far,110);}
/* ask one square: how far its line goes, and which way the wall faces where it arrives (from four tiny steps) */
function shotAsk(G,i){
  var R=shotRay(G,i),L=shotWalk(G,i),far=L[L.length-1][0],e,x,y,z,a,b,c,q,n,foamD=G.cfg.D;
  G.dirty=true;
  if(!arrived(L,shotNear(G))){G.far[i]=-1;return;}
  G.far[i]=far;e=.5*2*TANX/G.N*far+2e-4;x=R.o[0]+R.d[0]*far;y=R.o[1]+R.d[1]*far;z=R.o[2]+R.d[2]*far;
  a=foamD(x+e,y-e,z-e);b=foamD(x-e,y-e,z+e);c=foamD(x-e,y+e,z-e);q=foamD(x+e,y+e,z+e);
  n=unit([a-b-c+q+1e-12,-a-b+c+q,-a+b-c+q]);G.nx[i]=n[0];G.ny[i]=n[1];G.nz[i]=n[2];
}
function shotStep(G,least,ms){
  var t0=performance.now(),tot=G.N*G.M,k=0;
  while(G.next<tot){shotAsk(G,G.next);G.next++;k++;if(k>=least&&(ms<=0||((k&31)===0&&performance.now()-t0>ms)))break;}
}
/* how bright a square is under a lamp: how well the wall's direction lines up with the lamp's, dimmed by distance */
function shotLight(G,i,L){return (.12+.88*Math.max(0,G.nx[i]*L[0]+G.ny[i]*L[1]+G.nz[i]*L[2]))*Math.exp(-G.cfg.fog*G.far[i]);}
function shotPaint(g,w,h,G,lamp){
  var i,c,b,P=G.img.data,tot=G.N*G.M,L=lamp<0?null:lampDir(lamp,G.cfg.look);
  if(G.dirty||G.was!==String(lamp)){
    for(i=0;i<tot;i++){
      if(G.far[i]<-1.5){P[i*4]=11;P[i*4+1]=6;P[i*4+2]=24;}
      else if(G.far[i]<0){P[i*4]=P[i*4+1]=P[i*4+2]=0;}
      else if(L){b=shotLight(G,i,L);P[i*4]=235*b;P[i*4+1]=212*b;P[i*4+2]=255*b;}
      else{c=depthColour(G.far[i],.3);P[i*4]=c[0];P[i*4+1]=c[1];P[i*4+2]=c[2];}
      P[i*4+3]=255;
    }
    G.off.getContext("2d").putImageData(G.img,0,0);G.dirty=false;G.was=String(lamp);
  }
  g.imageSmoothingEnabled=G.N>=128;g.drawImage(G.off,0,0,w,h);
}
/* A small window with one square's walk in it: its line of sight laid flat from left to right, and at each place the walk
   stopped, the room there as a circle. */
function walkWindow(g,w,h,d,L,k,left,t){
  var bw=Math.round(w*.62),bh=Math.round(h*.34),x=left?8*d:w-bw-8*d,y=8*d,far=Math.max(1,L[L.length-1][0]+L[0][1]*.2),sc=(bw-24*d)/far,i,cy=bh*.56;
  g.save();
  g.fillStyle="rgba(11,6,24,.95)";g.fillRect(x,y,bw,bh);g.strokeStyle=INK;g.lineWidth=d;g.strokeRect(x,y,bw,bh);
  g.beginPath();g.rect(x,y,bw,bh);g.clip();g.translate(x+12*d,y);
  g.strokeStyle=DIM;g.beginPath();g.moveTo(0,cy);g.lineTo(far*sc,cy);g.stroke();
  for(i=0;i<L.length-1&&(k===0||i<k);i++){
    g.strokeStyle=i===k-1?INK:"rgba(95,240,255,.4)";g.lineWidth=(i===k-1?2:1)*d;
    g.beginPath();g.arc(L[i][0]*sc,cy,Math.max(0,L[i][1])*sc,0,6.2832);g.stroke();dot(g,L[i][0]*sc,cy,2.5*d,INK);
  }
  dot(g,L[k>0?k:L.length-1][0]*sc,cy,4.5*d,HOT);
  g.fillStyle=DIM;words(g,d,10);g.textAlign="left";g.textBaseline="top";g.fillText(t("learn.f.walk"),-6*d,5*d);
  g.restore();
}
/* o.mode: "depth" paints by how far each line went, with a slider for the grid and a walk for the tapped square;
   "lit" paints by the lamp, with a slider for where the lamp is; "fly" has a slider that moves the eye forward */
/* o.world, o.eye, o.look, o.far, o.fog: another world than Foam, and where the eye is in it; o.go: the step has the button that flies there */
function shotFig(o){
  var cfg=null;
  function size(s){return o.mode==="depth"?SHOTS[s.gi]:o.mode==="lit"?224:128;}
  function CFG(){if(!cfg)cfg={D:worldD(o.world||"foam"),eye:o.eye||[1,1,1],look:o.look||LOOK,far:o.far||SHOT_FAR,fog:o.fog===undefined?.16:o.fog};return cfg;}
  return {
    moves:true,world:o.mode==="fly"||o.go?(o.world||"foam"):"",
    ctl:o.mode==="depth"?[{k:"gi",min:0,max:SHOTS.length-1,step:1,label:function(s,t){return t("learn.c.grid",SHOTS[s.gi])}}]:
        o.mode==="lit"?[{k:"lamp",min:0,max:360,step:5,keys:[0,90,180,270,360],label:function(s,t){return t("learn.c.lamp",s.lamp)}}]:
        [{k:"e",min:0,max:2,step:.05,keys:[0,1,2],label:function(s,t){return t("learn.c.eye",num(s.e))}}],
    keys:o.mode==="fly"?[0,1,2].map(function(v){return keyOf("e",v,"learn.c.eye")}):[],
    init:function(){return {gi:1,lamp:60,e:0,G:null,sel:-1,k:0}},
    walk:o.mode==="depth"?function(s){return s.sel<0||!s.G?0:shotWalk(s.G,s.sel).length-1}:null,
    changed:function(s){if(s.G&&(s.G.N!==size(s)||s.G.e!==s.e)){s.G=null;if(o.mode==="depth"){s.sel=-1;s.k=0;}}},
    draw:function(g,w,h,s,now,t,d){
      var G,cw,ch,i;
      if(!s.G)s.G=newShot(size(s),s.e,CFG());
      G=s.G;
      shotStep(G,calm||o.mode==="fly"?G.N*G.M:Math.ceil(G.N*G.M/150),G.N<=32?0:8);
      shotPaint(g,w,h,G,o.mode==="depth"?-1:s.lamp);
      cw=w/G.N;ch=h/G.M;
      if(G.N<=32){
        g.strokeStyle="rgba(243,236,255,.12)";g.lineWidth=d;g.beginPath();
        for(i=1;i<G.N;i++){g.moveTo(i*cw,0);g.lineTo(i*cw,h);}
        for(i=1;i<G.M;i++){g.moveTo(0,i*ch);g.lineTo(w,i*ch);}
        g.stroke();
      }
      if(s.sel>=0&&o.mode!=="fly"){
        g.strokeStyle=INK;g.lineWidth=2*d;g.strokeRect((s.sel%G.N)*cw-(cw<6*d?3*d:0),Math.floor(s.sel/G.N)*ch-(cw<6*d?3*d:0),Math.max(cw,6*d),Math.max(ch,6*d));
        if(o.mode==="depth")walkWindow(g,w,h,d,shotWalk(G,s.sel),s.k,s.sel%G.N>=G.N/2,t);
      }
    },
    pick:function(s,i){if(o.mode==="fly")return;if(i!==s.sel)s.k=0;s.sel=i;},
    drag:function(u,v,s,w,h){var G=s.G;if(G)this.pick(s,clamp(Math.floor(u/w*G.N),0,G.N-1)+G.N*clamp(Math.floor(v/h*G.M),0,G.M-1));},
    key:function(dx,dy,s){
      var G=s.G,i;if(!G)return;
      i=s.sel<0?Math.floor(G.M/2)*G.N+Math.floor(G.N/2):s.sel;
      this.pick(s,clamp(Math.floor(i/G.N)-dy,0,G.M-1)*G.N+clamp(i%G.N+dx,0,G.N-1));
    },
    read:function(s,t){
      var N=size(s),M=Math.round(N*5/8),G=s.G,out=[],L,Lm,b;
      if(o.mode==="fly")return [t("learn.s.eyeAt",num(s.e)),Math.abs(s.e-2)<1e-9?t("learn.s.same"):t("learn.s.period")];
      if(o.mode==="depth")out.push(t("learn.r.grid",N,M,N*M));
      if(s.sel<0||!G){out.push(t(o.mode==="depth"?"learn.s.tapLine":"learn.s.tapWall"));return out;}
      if(o.mode==="depth"){L=shotWalk(G,s.sel);return out.concat(moveRows(L,s.k,t),[walkVerdict(L,arrived(L,shotNear(G)),t)]);}
      /* the lit picture: the sum that gives the tapped square its brightness */
      if(G.far[s.sel]<0)return [t(G.far[s.sel]<-1.5?"learn.s.tapWall":"learn.s.misses")];
      Lm=lampDir(s.lamp,CFG().look);b=G.nx[s.sel]*Lm[0]+G.ny[s.sel]*Lm[1]+G.nz[s.sel]*Lm[2];
      return [t("learn.s.nrm3",num(G.nx[s.sel]),num(G.ny[s.sel]),num(G.nz[s.sel])),t("learn.s.tol3",num(Lm[0]),num(Lm[1]),num(Lm[2])),
              t("learn.s.dot3",num(G.nx[s.sel]),num(Lm[0]),num(G.ny[s.sel]),num(Lm[1]),num(G.nz[s.sel]),num(Lm[2]),num(b)),
              b>0?t("learn.s.bright",num(b)):t("learn.s.dark")];
    }
  };
}

/* ---- the drawings, by the step's name ---- */
export const SPACE_FIGS={
ray:flatFig({mode:"ray"}),
safe:flatFig({mode:"safe"}),
march:flatFig({mode:"march"}),
row:flatFig({mode:"row"}),
ball:fieldFig({mode:"ball",a:1.6,b:1.2,keys:[[2,0],[1,0],[0,0],[1.6,1.2]]}),
hollow:fieldFig({mode:"hollow",a:0.3,b:0.4,keys:[[0,0],[0.5,0],[1,0],[0.6,0.8]]}),
repeat:fieldFig({mode:"repeat",a:1.3,b:1.4,keys:[[1,1],[3,1],[-1,1],[1.5,1],[0,0]]}),
join:fieldFig({mode:"join",a:1,b:1,keys:[[1,1],[2,1],[2,2]]}),
small:fieldFig({mode:"small",a:0.4,b:0.4,keys:[[0.34,0.34],[1,1],[0,0]]}),
both:fieldFig({mode:"both",hh:1.2,a:0.3,b:0.1,keys:[[1,1],[0,0],[0.3,0.1]]}),
levels:fieldFig({mode:"levels",hh:0.8,a:0.3,b:0.1,keys:[[0,0],[0.3,0.1],[0.1,0.1]]}),
/* a point with three parts, drawn as three legs: across, then forward, then up */
third:{
  ctl:["x","y","z"].map(function(k,i){return {k:k,min:0,max:3,step:.1,keys:[0,1,2,3],label:function(s,t){return t(["learn.f.across","learn.f.up","learn.f.forward"][i])+" "+num(s[k],1)}};}),
  keys:[[1,2,2],[2,1,2],[2,2,1],[3,0,0]].map(function(p){return {label:function(){return "("+p.join(", ")+")"},set:function(s){s.x=p[0];s.y=p[1];s.z=p[2]}};}),
  init:function(){return {x:2,y:1,z:1}},
  draw:function(g,w,h,s,now,t,d){
    var k=h/5.1,ox=w*.24,oy=h*.86,P=function(x,y,z){return [ox+(x+z*.5)*k,oy-(y+z*.35)*k]},O=P(0,0,0),a=P(s.x,0,0),b=P(s.x,0,s.z),c=P(s.x,s.y,s.z),e;
    function seg(p,q,col,wd,dash){g.strokeStyle=col;g.lineWidth=wd*d;g.setLineDash(dash?[4*d,4*d]:[]);g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1]);g.stroke();g.setLineDash([]);}
    clear(g,w,h);
    /* the three directions */
    e=P(3.4,0,0);arrow(g,O[0],O[1],e[0],e[1],d,DIM,false);g.fillStyle=DIM;words(g,d,11);g.textAlign="left";g.textBaseline="middle";g.fillText(t("learn.f.across"),e[0]+6*d,e[1]);
    e=P(0,3.4,0);arrow(g,O[0],O[1],e[0],e[1],d,DIM,false);g.textAlign="center";g.textBaseline="bottom";g.fillText(t("learn.f.up"),e[0],e[1]-5*d);
    e=P(0,0,3.4);arrow(g,O[0],O[1],e[0],e[1],d,DIM,false);g.textAlign="right";g.fillText(t("learn.f.forward"),e[0]-10*d,e[1]-2*d);
    /* the three legs, and the straight line from the middle */
    seg(P(0,0,s.z),b,FAINT,1,true);seg(O,P(0,0,s.z),FAINT,1,true);
    seg(O,a,COOL,3);seg(a,b,INK,3);seg(b,c,HOT,3);seg(O,c,DIM,1.5,true);
    dot(g,O[0],O[1],3*d,INK);dot(g,c[0],c[1],6*d,INK);
  },
  read:function(s,t){var l=Math.hypot(s.x,s.y,s.z);return [t("learn.s.pos3",num(s.x,1),num(s.y,1),num(s.z,1)),t("learn.s.pyth3",num(s.x,1),num(s.y,1),num(s.z,1),num(l))];}
},
picture:shotFig({mode:"depth"}),
facing:fieldFig({mode:"facing",hh:1.2,a:0.7,b:0.2,keys:[[1,1],[0.7,0.2],[0.2,0.7]]}),
/* a round pillar, a lamp far away, and a place on the pillar's surface: how well the two arrows there line up */
lamp:{
  keys:[["learn.k.face",0],["learn.k.side",90],["learn.k.away",180]].map(function(k){return {label:function(s,t){return t(k[0])},set:function(s){s.p=s.l+k[1]}};}),
  init:function(){return {l:60,p:20,grab:"p"}},
  S:function(w,h){return sheet(w,h,0,0,2.4)},
  draw:function(g,w,h,s,now,t,d){
    var S=this.S(w,h),i,a,b,la=s.l*Math.PI/180,pa=s.p*Math.PI/180,px=Math.cos(pa),py=Math.sin(pa),lx=Math.cos(la),ly=Math.sin(la);
    clear(g,w,h);
    g.fillStyle="#1a1030";g.beginPath();g.arc(S.X(0),S.Y(0),S.k,0,6.2832);g.fill();
    /* the surface, a short piece at a time, each as bright as it is turned toward the lamp */
    g.lineWidth=7*d;
    for(i=0;i<90;i++){
      a=i*4*Math.PI/180;b=Math.max(0,Math.cos(a-la));
      g.strokeStyle="rgb("+Math.round(20+235*b)+","+Math.round(14+218*b)+","+Math.round(40+190*b)+")";
      g.beginPath();g.arc(S.X(0),S.Y(0),S.k,-a-.037,-a+.037);g.stroke();
    }
    /* the lamp, and its light arriving from that direction */
    for(i=-2;i<=2;i++)arrow(g,S.X(lx*2.25-ly*i*.5),S.Y(ly*2.25+lx*i*.5),S.X(lx*1.75-ly*i*.5),S.Y(ly*1.75+lx*i*.5),d,"rgba(255,95,210,.45)",false);
    handle(g,S.X(lx*2.05),S.Y(ly*2.05),d,HOT);
    /* at the chosen place: the way the surface faces, and the way to the lamp */
    arrow(g,S.X(px),S.Y(py),S.X(px*1.7),S.Y(py*1.7),d,COOL,false);
    arrow(g,S.X(px),S.Y(py),S.X(px+lx*.7),S.Y(py+ly*.7),d,HOT,false);
    handle(g,S.X(px),S.Y(py),d,COOL);
  },
  drag:function(u,v,s,w,h,tol,first){
    var S=this.S(w,h),x=S.x(u),y=S.y(v),la=s.l*Math.PI/180,pa=s.p*Math.PI/180,a;
    if(first)s.grab=Math.hypot(x-2.05*Math.cos(la),y-2.05*Math.sin(la))<Math.hypot(x-Math.cos(pa),y-Math.sin(pa))?"l":"p";
    a=Math.round(Math.atan2(y,x)*180/Math.PI);if(Math.abs(a-Math.round(a/45)*45)<=4)a=Math.round(a/45)*45;
    s[s.grab]=a;
  },
  key:function(dx,dy,s){s[s.grab]+=(dx-dy)*-5;},
  read:function(s,t){
    var la=s.l*Math.PI/180,pa=s.p*Math.PI/180,nx=Math.cos(pa),ny=Math.sin(pa),lx=Math.cos(la),ly=Math.sin(la),b=nx*lx+ny*ly;
    return [t("learn.s.nrm",num(nx),num(ny)),t("learn.s.tol",num(lx),num(ly)),t("learn.s.dot",num(nx),num(lx),num(ny),num(ly),num(b)),b>0.005?t("learn.s.bright",num(b)):t("learn.s.dark")];
  }
},
lit:shotFig({mode:"lit"}),
fly:shotFig({mode:"fly"}),
/* two more of the app's worlds, for the fourth track: the same kind of picture, from inside them */
sponge:shotFig({mode:"lit",world:"sponge",eye:[.05,.03,0],look:[.3,.12,.95],far:14,fog:.2,go:true}),
bulb:shotFig({mode:"lit",world:"bulbs",eye:[1.7,.15,1.7],look:[-.7,-.05,-.7],far:22,fog:.12,go:true})
};

/* for the test tools and the browser console: every name in this file */
export const __dbg={SPACE_FIGS, PIL, EYE, ROWS, SHOTS, flatD, flatRay, walkLine, arrived, foamLevel, foam2, foamD, view, lampDir, newShot, shotAsk, shotStep, shotWalk, shotPaint};
