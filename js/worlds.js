/* The worlds: each one's shader distance function beside the same function in JavaScript. */
import { fr, md, tile } from "./dom.js";
import { fbH } from "./fabric.js";
import { packing, pkD, pkDeep, pkMix, pkP, pkPer } from "./packing.js";

/* ---------- the worlds ----------
   Each has a GLSL distance estimator (map), the same estimator in JS (de) for the
   distance-based flight speed, the repeat period used to wrap the camera, and a start point.
   m is the morph value, roughly -1..1. */
export const WORLDS=[
{id:"lattice",name:"Lattice",hue:0,fog:.18,maxd:16,speed:.55,start:[.8,.45,.1],
 period:function(){return [2,2,2]},
 glsl:[
 "float map(vec3 p){",
 "  float s=1.3+0.2*uM;float scale=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<7;i++){",
 "    p=-1.0+2.0*fract(0.5*p+0.5);",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p),r2));",
 "    float k=s/r2;p*=k;scale*=k;",
 "  }",
 "  return 0.25*abs(p.y)/scale;",
 "}"],
 de:function(x,y,z,m){
  var s=1.3+.2*m,scale=1;
  for(var i=0;i<7;i++){
    x=-1+2*fr(.5*x+.5);y=-1+2*fr(.5*y+.5);z=-1+2*fr(.5*z+.5);
    var r2=Math.max(x*x+y*y+z*z,1e-6),k=s/r2;x*=k;y*=k;z*=k;scale*=k;
  }
  return .25*Math.abs(y)/scale;
 }},
{id:"sponge",name:"Sponge",hue:.55,fog:.2,maxd:14,speed:.5,start:[.05,.03,0],
 period:function(){return [2,2,2]},
 glsl:[
 "float map(vec3 p){",
 "  float d=-1e5;float s=1.0;float w=1.0+0.22*uM;orb=vec4(1000.0);",
 "  for(int i=0;i<4;i++){",
 "    vec3 a=mod(p*s,2.0)-1.0;s*=3.0;",
 "    vec3 r=abs(1.0-3.0*abs(a));",
 "    orb=min(orb,vec4(abs(a),dot(a,a)*0.4));",
 "    float da=max(r.x,r.y);float db=max(r.y,r.z);float dc=max(r.z,r.x);",
 "    d=max(d,(min(da,min(db,dc))-w)/s);",
 "  }",
 "  return d;",
 "}"],
 de:function(x,y,z,m){
  var d=-1e5,s=1,w=1+.22*m;
  for(var i=0;i<4;i++){
    var ax=md(x*s,2)-1,ay=md(y*s,2)-1,az=md(z*s,2)-1;s*=3;
    var rx=Math.abs(1-3*Math.abs(ax)),ry=Math.abs(1-3*Math.abs(ay)),rz=Math.abs(1-3*Math.abs(az));
    d=Math.max(d,(Math.min(Math.max(rx,ry),Math.max(ry,rz),Math.max(rz,rx))-w)/s);
  }
  return d;
 }},
{id:"halls",name:"Halls",hue:.3,fog:.16,maxd:18,speed:.6,start:[.2,.1,.4],
 period:function(m){var c=4*(.92+.05*m);return [c,c,c]},
 glsl:[
 "float map(vec3 p){",
 "  float c=0.92+0.05*uM;float sc=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<7;i++){",
 "    p=abs(mod(p+c,4.0*c)-2.0*c)-c;",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p),r2));",
 "    float k=max(1.0/r2,1.0);p*=k;sc*=k;",
 "  }",
 "  float rxy=length(p.xy);",
 "  return 0.6*max(rxy-0.92784,abs(rxy*p.z)/max(length(p),1e-6))/sc;",
 "}"],
 de:function(x,y,z,m){
  var c=.92+.05*m,sc=1;
  for(var i=0;i<7;i++){
    x=Math.abs(md(x+c,4*c)-2*c)-c;y=Math.abs(md(y+c,4*c)-2*c)-c;z=Math.abs(md(z+c,4*c)-2*c)-c;
    var r2=Math.max(x*x+y*y+z*z,1e-6),k=Math.max(1/r2,1);x*=k;y*=k;z*=k;sc*=k;
  }
  var rxy=Math.hypot(x,y);
  return .6*Math.max(rxy-.92784,Math.abs(rxy*z)/Math.max(Math.hypot(x,y,z),1e-6))/sc;
 }},
{id:"box",name:"Box",hue:.75,fog:.14,maxd:20,speed:.9,start:null,
 period:function(){return [7.2,7.2,7.2]},
 glsl:[
 "#define P 3.6",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
 "  vec3 c0=p;float dr=1.0;float S=-1.55+0.12*uM;orb=vec4(1000.0);",
 "  for(int i=0;i<7;i++){",
 "    p=clamp(p,-1.0,1.0)*2.0-p;",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p),r2));",
 "    float k=clamp(1.0/r2,1.0,4.0);p*=k;dr*=k;",
 "    p=p*S+c0;dr=dr*abs(S)+1.0;",
 "  }",
 "  return 0.8*length(p)/abs(dr);",
 "}"],
 de:function(x,y,z,m){
  var P=3.6;x=tile(x,P);y=tile(y,P);z=tile(z,P);
  var cx=x,cy=y,cz=z,dr=1,S=-1.55+.12*m;
  function cl(v){return Math.max(-1,Math.min(1,v))*2-v}
  for(var i=0;i<7;i++){
    x=cl(x);y=cl(y);z=cl(z);
    var r2=Math.max(x*x+y*y+z*z,1e-6),k=Math.max(1,Math.min(4,1/r2));
    x=x*k*S+cx;y=y*k*S+cy;z=z*k*S+cz;dr=dr*k*Math.abs(S)+1;
  }
  return .8*Math.hypot(x,y,z)/Math.abs(dr);
 }},
{id:"citadel",name:"Citadel",hue:.12,fog:.16,maxd:18,speed:.8,start:[1.5,.2,1.5],
 packs:true,grid:3,rad:1.85,mix:["bulbs","crystal"],period:function(){return pkPer(3)},
 shape:[
 "float SHAPE(vec3 p){",
 "  float a1=0.12+0.1*uM;float a2=0.08-0.07*uM;",
 "  float c1=cos(a1),s1=sin(a1),c2=cos(a2),s2=sin(a2);",
 "  float s=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<6;i++){",
 "    p=abs(p);",
 "    if(p.x<p.y)p.xy=p.yx;",
 "    if(p.x<p.z)p.xz=p.zx;",
 "    if(p.y<p.z)p.yz=p.zy;",
 "    orb=min(orb,vec4(p,dot(p,p)*0.5));",
 "    p.xy=vec2(c1*p.x-s1*p.y,s1*p.x+c1*p.y);",
 "    p.yz=vec2(c2*p.y-s2*p.z,s2*p.y+c2*p.z);",
 "    p=p*3.0-2.0;",
 "    if(p.z<-1.0)p.z+=2.0;",
 "    s*=3.0;",
 "  }",
 "  return 0.9*length(max(abs(p)-1.0,0.0))/s;",
 "}"],
 de:function(x,y,z,m){return packDe("citadel",x,y,z,m)},
 sde:function(x,y,z,m){
  var a1=.12+.1*m,a2=.08-.07*m,c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),s=1,t;
  for(var i=0;i<6;i++){
    x=Math.abs(x);y=Math.abs(y);z=Math.abs(z);
    if(x<y){t=x;x=y;y=t}
    if(x<z){t=x;x=z;z=t}
    if(y<z){t=y;y=z;z=t}
    t=c1*x-s1*y;y=s1*x+c1*y;x=t;
    t=c2*y-s2*z;z=s2*y+c2*z;y=t;
    x=x*3-2;y=y*3-2;z=z*3-2;
    if(z<-1)z+=2;
    s*=3;
  }
  return .9*Math.hypot(Math.max(Math.abs(x)-1,0),Math.max(Math.abs(y)-1,0),Math.max(Math.abs(z)-1,0))/s;
 }},
{id:"coral",name:"Coral",hue:.9,fog:.11,maxd:26,speed:1.3,start:[0,0,0],
 period:function(){var t=2*Math.PI;return [t,t,t]},
 glsl:[
 "float gy(vec3 p){return dot(sin(p),cos(p.zxy));}",
 "float map(vec3 p){",
 "  float g1=gy(p);",
 "  float g2=gy(p*3.0+1.3);",
 "  float g3=gy(p*9.0+0.4);",
 "  float d=abs(g1)-(0.3+0.12*uM);",
 "  d+=0.16*g2+0.05*abs(g3);",
 "  d=max(d,0.035-abs(g2)*0.33);",
 "  orb=vec4(abs(sin(p*3.0)),0.5+0.35*g2+0.15*g3);",
 "  return 0.42*d;",
 "}"],
 de:function(x,y,z,m){
  function gy(a,b,c){return Math.sin(a)*Math.cos(c)+Math.sin(b)*Math.cos(a)+Math.sin(c)*Math.cos(b)}
  var g1=gy(x,y,z),g2=gy(x*3+1.3,y*3+1.3,z*3+1.3),g3=gy(x*9+.4,y*9+.4,z*9+.4);
  var d=Math.abs(g1)-(.3+.12*m);d+=.16*g2+.05*Math.abs(g3);
  d=Math.max(d,.035-Math.abs(g2)*.33);
  return .42*d;
 }},
{id:"bulbs",name:"Bulbs",hue:.42,fog:.12,maxd:22,speed:1.0,start:[1.7,.15,1.7],
 packs:true,grid:3.4,rad:1.28,mix:["shards","pyrite"],period:function(){return pkPer(3.4)},
 shape:[
 "float SHAPE(vec3 p){",
 "  vec3 z=p;float dr=1.0;float r=0.0;float pw=8.0+1.5*uM;orb=vec4(1000.0);",
 "  for(int i=0;i<6;i++){",
 "    r=max(length(z),1e-6);",
 "    if(r>2.0)break;",
 "    float th=acos(clamp(z.z/r,-1.0,1.0))*pw;",
 "    float ph=atan(z.y,z.x)*pw;",
 "    float zr=pow(r,pw-1.0);",
 "    dr=zr*pw*dr+1.0;zr*=r;",
 "    z=zr*vec3(sin(th)*cos(ph),sin(th)*sin(ph),cos(th))+p;",
 "    orb=min(orb,vec4(abs(z),dot(z,z)));",
 "  }",
 "  orb.w=min(orb.w,1.5);",
 "  return 0.5*log(r)*r/dr;",
 "}"],
 de:function(x,y,z,m){return packDe("bulbs",x,y,z,m)},
 sde:function(x,y,z,m){
  var zx=x,zy=y,zz=z,dr=1,r=0,pw=8+1.5*m;
  for(var i=0;i<6;i++){
    r=Math.max(Math.hypot(zx,zy,zz),1e-6);
    if(r>2)break;
    var th=Math.acos(Math.max(-1,Math.min(1,zz/r)))*pw,ph=Math.atan2(zy,zx)*pw,zr=Math.pow(r,pw-1);
    dr=zr*pw*dr+1;zr*=r;
    zx=zr*Math.sin(th)*Math.cos(ph)+x;zy=zr*Math.sin(th)*Math.sin(ph)+y;zz=zr*Math.cos(th)+z;
  }
  return .5*Math.log(r)*r/dr;
 }}
,{id:"shards",name:"Shards",hue:.6,fog:.13,maxd:22,speed:.9,start:[1.5,.2,1.5],
 packs:true,grid:3,rad:1.82,mix:["julia","hive"],period:function(){return pkPer(3)},
 shape:[
 "float SHAPE(vec3 p){",
 "  float a1=0.35*uM;float c1=cos(a1),s1=sin(a1);",
 "  float s=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<7;i++){",
 "    if(p.x+p.y<0.0)p.xy=-p.yx;",
 "    if(p.x+p.z<0.0)p.xz=-p.zx;",
 "    if(p.y+p.z<0.0)p.yz=-p.zy;",
 "    p.xy=vec2(c1*p.x-s1*p.y,s1*p.x+c1*p.y);",
 "    orb=min(orb,vec4(abs(p),dot(p,p)*0.5));",
 "    p=p*2.0-1.0;s*=2.0;",
 "  }",
 "  return 0.9*(length(p)-1.5)/s;",
 "}"],
 de:function(x,y,z,m){return packDe("shards",x,y,z,m)},
 sde:function(x,y,z,m){
  var a1=.35*m,c1=Math.cos(a1),s1=Math.sin(a1),s=1,t;
  for(var i=0;i<7;i++){
    if(x+y<0){t=-y;y=-x;x=t}
    if(x+z<0){t=-z;z=-x;x=t}
    if(y+z<0){t=-z;z=-y;y=t}
    t=c1*x-s1*y;y=s1*x+c1*y;x=t;
    x=2*x-1;y=2*y-1;z=2*z-1;s*=2;
  }
  return .9*(Math.hypot(x,y,z)-1.5)/s;
 }},
{id:"crystal",name:"Crystal",hue:.2,fog:.13,maxd:22,speed:.9,start:[1.5,.2,1.5],
 packs:true,grid:3,rad:1.1,mix:["mandel","shards"],period:function(){return pkPer(3)},
 shape:[
 "float SHAPE(vec3 p){",
 "  float a1=0.12*uM;float a2=0.1-0.08*uM;",
 "  float c1=cos(a1),s1=sin(a1),c2=cos(a2),s2=sin(a2);",
 "  float s=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<6;i++){",
 "    p=abs(p);",
 "    if(p.x<p.y)p.xy=p.yx;",
 "    if(p.x<p.z)p.xz=p.zx;",
 "    if(p.y<p.z)p.yz=p.zy;",
 "    orb=min(orb,vec4(p,dot(p,p)));",
 "    p.xz=vec2(c1*p.x-s1*p.z,s1*p.x+c1*p.z);",
 "    p.yz=vec2(c2*p.y-s2*p.z,s2*p.y+c2*p.z);",
 "    p=p*2.0;p.x-=1.0;s*=2.0;",
 "  }",
 "  return 0.85*(length(p)-0.9)/s;",
 "}"],
 de:function(x,y,z,m){return packDe("crystal",x,y,z,m)},
 sde:function(x,y,z,m){
  var a1=.12*m,a2=.1-.08*m,c1=Math.cos(a1),s1=Math.sin(a1),c2=Math.cos(a2),s2=Math.sin(a2),s=1,t;
  for(var i=0;i<6;i++){
    x=Math.abs(x);y=Math.abs(y);z=Math.abs(z);
    if(x<y){t=x;x=y;y=t}
    if(x<z){t=x;x=z;z=t}
    if(y<z){t=y;y=z;z=t}
    t=c1*x-s1*z;z=s1*x+c1*z;x=t;
    t=c2*y-s2*z;z=s2*y+c2*z;y=t;
    x=2*x-1;y=2*y;z=2*z;s*=2;
  }
  return .85*(Math.hypot(x,y,z)-.9)/s;
 }},
{id:"julia",name:"Julia",hue:.05,fog:.12,maxd:22,speed:1.0,start:[1.7,.15,1.7],
 packs:true,grid:3.4,rad:1.42,mix:["bulbs","shards"],period:function(){return pkPer(3.4)},
 shape:[
 "float SHAPE(vec3 p){",
 "  vec4 z=vec4(p,0.0);",
 "  vec4 c=0.45*cos(vec4(0.5,3.9,1.4,1.1)+1.2*uM*vec4(1.0,1.3,0.9,1.7))-vec4(0.3,0.0,0.0,0.0);",
 "  float md2=1.0;float mz2=dot(z,z);orb=vec4(1000.0);",
 "  for(int i=0;i<9;i++){",
 "    md2*=4.0*mz2;",
 "    z=vec4(z.x*z.x-dot(z.yzw,z.yzw),2.0*z.x*z.yzw)+c;",
 "    mz2=dot(z,z);",
 "    orb=min(orb,vec4(abs(z.xyz),mz2));",
 "    if(mz2>4.0)break;",
 "  }",
 "  orb.w=min(orb.w,1.5);",
 "  return 0.25*sqrt(mz2/max(md2,1e-9))*log(max(mz2,1e-9));",
 "}"],
 de:function(x,y,z,m){return packDe("julia",x,y,z,m)},
 sde:function(x,y,z,m){
  var ph=[.5,3.9,1.4,1.1],mu=[1,1.3,.9,1.7],c=[0,0,0,0];
  for(var j=0;j<4;j++)c[j]=.45*Math.cos(ph[j]+1.2*m*mu[j]);c[0]-=.3;
  var a=x,b=y,cc=z,d=0,md2=1,mz2=a*a+b*b+cc*cc;
  for(var i=0;i<9;i++){
    md2*=4*mz2;
    var na=a*a-(b*b+cc*cc+d*d)+c[0],nb=2*a*b+c[1],nc=2*a*cc+c[2],nd=2*a*d+c[3];
    a=na;b=nb;cc=nc;d=nd;mz2=a*a+b*b+cc*cc+d*d;
    if(mz2>4)break;
  }
  return .25*Math.sqrt(mz2/Math.max(md2,1e-9))*Math.log(Math.max(mz2,1e-9));
 }},
{id:"web",name:"Web",hue:.48,fog:.16,maxd:16,speed:.55,start:[.8,.45,.1],
 period:function(){return [2,2,2]},
 glsl:[
 "float map(vec3 p){",
 "  float s=1.22+0.14*uM;float scale=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<6;i++){",
 "    p=-1.0+2.0*fract(0.5*p+0.5);",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p),r2));",
 "    float k=s/r2;p*=k;scale*=k;",
 "  }",
 "  return (0.25*length(p.xz)-0.012)/scale;",
 "}"],
 de:function(x,y,z,m){
  var s=1.22+.14*m,scale=1;
  for(var i=0;i<6;i++){
    x=-1+2*fr(.5*x+.5);y=-1+2*fr(.5*y+.5);z=-1+2*fr(.5*z+.5);
    var r2=Math.max(x*x+y*y+z*z,1e-6),k=s/r2;x*=k;y*=k;z*=k;scale*=k;
  }
  return (.25*Math.hypot(x,z)-.012)/scale;
 }},
{id:"temple",name:"Temple",hue:.68,fog:.14,maxd:20,speed:.6,start:null,
 period:function(m){return [4*.808,4*.808,4*(1.167+.08*m)]},
 glsl:[
 "float map(vec3 p){",
 "  vec3 c=vec3(0.808,0.808,1.167+0.08*uM);float sc=1.0;orb=vec4(1000.0);",
 "  for(int i=0;i<7;i++){",
 "    p=abs(mod(p+c,4.0*c)-2.0*c)-c;",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p),r2));",
 "    float k=max(1.1/r2,1.0);p*=k;sc*=k;",
 "  }",
 "  return 0.5*abs(p.y)/sc;",
 "}"],
 de:function(x,y,z,m){
  var c=[.808,.808,1.167+.08*m],sc=1,v=[x,y,z];
  for(var i=0;i<7;i++){
    for(var j=0;j<3;j++)v[j]=Math.abs(md(v[j]+c[j],4*c[j])-2*c[j])-c[j];
    var r2=Math.max(v[0]*v[0]+v[1]*v[1]+v[2]*v[2],1e-6),k=Math.max(1.1/r2,1);v[0]*=k;v[1]*=k;v[2]*=k;sc*=k;
  }
  return .5*Math.abs(v[1])/sc;
 }},
{id:"nebula",name:"Nebula",hue:.8,fog:0,maxd:1,speed:.3,start:[.3,.2,.1],volume:true,
 period:function(){return [2,2,2]},
 glsl:[
 "#define VMAP(a) ((a)*(a)*(a)*0.000007)",
 "#define VSTEP 0.06",
 "float dens(vec3 p){",
 "  p=abs(1.0-mod(p,2.0));",
 "  float pa=0.0;float a=0.0;float f=0.55+0.03*uM;",
 "  for(int i=0;i<10;i++){",
 "    p=abs(p)/max(dot(p,p),1e-6)-f;",
 "    float l=length(p);a+=abs(l-pa);pa=l;",
 "  }",
 "  return a;",
 "}"],
 de:function(){return .15}},
{id:"fortress",name:"Fortress",hue:.33,fog:.1,maxd:26,speed:1.4,start:null,
 period:function(){return [18,18,18]},
 glsl:[
 "#define P 9.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
 "  vec3 c0=p;float dr=1.0;float S=2.6+0.2*uM;orb=vec4(1000.0);",
 "  for(int i=0;i<6;i++){",
 "    p=clamp(p,-1.0,1.0)*2.0-p;",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p)*0.5,r2*0.3));",
 "    float k=clamp(1.0/r2,1.0,4.0);p*=k;dr*=k;",
 "    p=p*S+c0;dr=dr*abs(S)+1.0;",
 "  }",
 "  return 0.8*length(p)/abs(dr);",
 "}"],
 de:function(x,y,z,m){
  var P=9;x=tile(x,P);y=tile(y,P);z=tile(z,P);
  var cx=x,cy=y,cz=z,dr=1,S=2.6+.2*m;
  function cl(v){return Math.max(-1,Math.min(1,v))*2-v}
  for(var i=0;i<6;i++){
    x=cl(x);y=cl(y);z=cl(z);
    var r2=Math.max(x*x+y*y+z*z,1e-6),k=Math.max(1,Math.min(4,1/r2));
    x=x*k*S+cx;y=y*k*S+cy;z=z*k*S+cz;dr=dr*k*Math.abs(S)+1;
  }
  return .8*Math.hypot(x,y,z)/Math.abs(dr);
 }},
{id:"hive",name:"Hive",hue:.08,fog:.15,maxd:18,speed:.8,start:[1.5,.2,1.5],
 packs:true,grid:3,rad:1.86,mix:["julia","crystal"],period:function(){return pkPer(3)},
 shape:[
 "float SHAPE(vec3 p){",
 "  float s=1.0;float f=1.1+0.25*uM;orb=vec4(1000.0);",
 "  for(int i=0;i<5;i++){",
 "    p=abs(p);",
 "    if(p.x<p.y)p.xy=p.yx;",
 "    if(p.x<p.z)p.xz=p.zx;",
 "    if(p.y<p.z)p.yz=p.zy;",
 "    p=p*3.0-2.0;",
 "    if(p.z<-1.0)p.z+=2.0;",
 "    float r2=max(dot(p,p),1e-6);",
 "    orb=min(orb,vec4(abs(p)*0.5,r2*0.3));",
 "    float k=clamp(f/r2,1.0,2.2);p*=k;s*=3.0*k;",
 "  }",
 "  return 0.6*length(max(abs(p)-1.0,0.0))/s;",
 "}"],
 de:function(x,y,z,m){return packDe("hive",x,y,z,m)},
 sde:function(x,y,z,m){
  var s=1,f=1.1+.25*m,t;
  for(var i=0;i<5;i++){
    x=Math.abs(x);y=Math.abs(y);z=Math.abs(z);
    if(x<y){t=x;x=y;y=t}
    if(x<z){t=x;x=z;z=t}
    if(y<z){t=y;y=z;z=t}
    x=x*3-2;y=y*3-2;z=z*3-2;
    if(z<-1)z+=2;
    var r2=Math.max(x*x+y*y+z*z,1e-6),k=Math.max(1,Math.min(2.2,f/r2));
    x*=k;y*=k;z*=k;s*=3*k;
  }
  return .6*Math.hypot(Math.max(Math.abs(x)-1,0),Math.max(Math.abs(y)-1,0),Math.max(Math.abs(z)-1,0))/s;
 }},
{id:"gates",name:"Gates",hue:.58,fog:.1,maxd:26,speed:1.2,start:[0,0,.5],
 period:function(){return [8,8,16]},
 glsl:[
 "float tor(vec3 q,float R,float r){return length(vec2(length(q.xy)-R,q.z))-r;}",
 "float map(vec3 p){",
 "  vec3 q=vec3(abs(mod(p.xy+2.0,8.0)-4.0)-2.0,mod(p.z,1.0)-0.5);",
 "  float a=p.z*0.3926991+0.5*uM;float ca=cos(a),sa=sin(a);",
 "  q.xy=vec2(ca*q.x-sa*q.y,sa*q.x+ca*q.y);",
 "  orb=vec4(abs(q),dot(q,q)*0.4);",
 "  float d=tor(q,1.1,0.07);float s=1.0;",
 "  for(int i=0;i<5;i++){",
 "    q=abs(q);",
 "    q.xy=vec2(0.8253*q.x-0.5646*q.y,0.5646*q.x+0.8253*q.y);",
 "    q=q*1.8-vec3(0.88,0.32,0.16);s*=1.8;",
 "    orb=min(orb,vec4(abs(q)*0.6,dot(q,q)*0.3));",
 "    d=min(d,tor(q,0.7,0.12)/s);",
 "  }",
 "  return 0.6*d;",
 "}"],
 de:function(x,y,z,m){
  function tor(a,b,c,R,r){return Math.hypot(Math.hypot(a,b)-R,c)-r}
  var qx=tile(x,4),qy=tile(y,4),qz=md(z,1)-.5,a=z*.3926991+.5*m,ca=Math.cos(a),sa=Math.sin(a),t;
  t=ca*qx-sa*qy;qy=sa*qx+ca*qy;qx=t;
  var d=tor(qx,qy,qz,1.1,.07),s=1;
  for(var i=0;i<5;i++){
    qx=Math.abs(qx);qy=Math.abs(qy);qz=Math.abs(qz);
    t=.8253*qx-.5646*qy;qy=.5646*qx+.8253*qy;qx=t;
    qx=qx*1.8-.88;qy=qy*1.8-.32;qz=qz*1.8-.16;s*=1.8;
    d=Math.min(d,tor(qx,qy,qz,.7,.12)/s);
  }
  return .6*d;
 }},
{id:"aurora",name:"Aurora",hue:.4,fog:0,maxd:1,speed:.5,start:[.3,.2,.1],volume:true,
 period:function(){var t=2*Math.PI;return [t,t,t]},
 glsl:[
 "#define VMAP(a) ((a)*(a)*0.42)",
 "#define VSTEP 0.11",
 "float dens(vec3 p){",
 "  float t=uTime*0.12;",
 "  p+=0.8*sin(p.yzx+t);",
 "  p+=0.4*sin(p.zxy*2.0-t*1.3);",
 "  p+=0.2*sin(p.yzx*4.0+t*0.7);",
 "  float g=dot(sin(p),cos(p.zxy));",
 "  float g2=dot(sin(p*2.0),cos(p.yzx*2.0));",
 "  return exp(-abs(g)*(4.0-1.2*uM))+0.4*exp(-abs(g2)*8.0);",
 "}"],
 de:function(){return .2}},
/* The Mandelbrot set, taken into quaternions: z starts at a small seed, the point itself is c, and z = z*z + c.
   With no seed this is the flat set turned about its long axis; the morph moves the seed, which pulls it out of round. */
{id:"mandel",name:"Mandelbrot",hue:.62,fog:.12,maxd:22,speed:1.0,start:[1.7,.15,1.7],
 packs:true,grid:3.4,rad:1.5,mix:["citadel","shards"],period:function(){return pkPer(3.4)},
 shape:[
 "float SHAPE(vec3 p){",
 "  vec4 c=vec4(p.x-0.75,p.y,p.z,0.0);",
 "  vec4 z=vec4(0.10*uM,0.14*sin(1.3*uM+0.5),0.0,0.10*cos(0.9*uM));",
 "  float md=0.0;float mz2=dot(z,z);orb=vec4(1000.0);",
 "  for(int i=0;i<12;i++){",
 "    md=2.0*sqrt(mz2)*md+1.0;",
 "    z=vec4(z.x*z.x-dot(z.yzw,z.yzw),2.0*z.x*z.yzw)+c;",
 "    mz2=dot(z,z);",
 "    orb=min(orb,vec4(abs(z.xyz),mz2));",
 "    if(mz2>64.0)break;",
 "  }",
 "  orb.w=min(orb.w,1.5);",
 "  return 0.25*sqrt(mz2)/md*log(max(mz2,1e-9));",
 "}"],
 de:function(x,y,z,m){return packDe("mandel",x,y,z,m)},
 sde:function(x,y,z,m){
  var c0=x-.75,a=.10*m,b=.14*Math.sin(1.3*m+.5),cc=0,d=.10*Math.cos(.9*m);
  var dm=0,mz2=a*a+b*b+cc*cc+d*d;
  for(var i=0;i<12;i++){
    dm=2*Math.sqrt(mz2)*dm+1;
    var na=a*a-(b*b+cc*cc+d*d)+c0,nb=2*a*b+y,nc=2*a*cc+z,nd=2*a*d;
    a=na;b=nb;cc=nc;d=nd;mz2=a*a+b*b+cc*cc+d*d;
    if(mz2>64)break;
  }
  return .25*Math.sqrt(mz2)/dm*Math.log(Math.max(mz2,1e-9));
 }},
/* Pipes that never end: every unit cell holds three quarter rings joining the middles of its six faces, turned one of
   eight ways by a number worked out from the cell's place. The number uses whole-number sums only, so the chip and
   JavaScript agree on it exactly, and it repeats every 8 cells. */
{id:"tangle",name:"Tangle",hue:.52,fog:.1,maxd:24,speed:1.0,start:[1,1,1],
 period:function(){return [8,8,8]},
 glsl:[
 "float mo(float x,float y){return floor(mod(x+0.5,y));}",
 "float map(vec3 p){",
 "  vec3 c=floor(p);vec3 q=p-c-0.5;",
 "  float n=mo(c.x,8.0)+8.0*mo(c.y,8.0)+64.0*mo(c.z,8.0);float a=mo(n*(n+3.0),61.0);",
 "  q*=1.0-2.0*vec3(mo(a,2.0),mo(floor((a+0.5)*0.5),2.0),mo(floor((a+0.5)*0.25),2.0));",
 "  vec2 e1=q.xy-0.5;vec2 e2=q.xz-vec2(-0.5,0.5);vec2 e3=q.yz+0.5;",
 "  float d1=length(vec2(length(e1)-0.5,q.z));float d2=length(vec2(length(e2)-0.5,q.y));float d3=length(vec2(length(e3)-0.5,q.x));",
 "  float d=d1;vec2 e=e1;",
 "  if(d2<d){d=d2;e=e2;}",
 "  if(d3<d){d=d3;e=e3;}",
 "  float g=cos(8.0*atan(e.y,e.x));",
 "  orb=vec4(abs(q),0.5+0.4*g);",
 "  return 0.7*(d-(0.14+0.04*uM)*(1.0+0.22*g));",
 "}"],
 de:function(x,y,z,m){
  function mo(v,k){return Math.floor(md(v+.5,k))}
  var cx=Math.floor(x),cy=Math.floor(y),cz=Math.floor(z),qx=x-cx-.5,qy=y-cy-.5,qz=z-cz-.5;
  var n=mo(cx,8)+8*mo(cy,8)+64*mo(cz,8),a=mo(n*(n+3),61);
  if(mo(a,2))qx=-qx;if(mo(Math.floor((a+.5)*.5),2))qy=-qy;if(mo(Math.floor((a+.5)*.25),2))qz=-qz;
  var e1x=qx-.5,e1y=qy-.5,e2x=qx+.5,e2y=qz-.5,e3x=qy+.5,e3y=qz+.5;
  var d1=Math.hypot(Math.hypot(e1x,e1y)-.5,qz),d2=Math.hypot(Math.hypot(e2x,e2y)-.5,qy),d3=Math.hypot(Math.hypot(e3x,e3y)-.5,qx);
  var d=d1,ex=e1x,ey=e1y;
  if(d2<d){d=d2;ex=e2x;ey=e2y}
  if(d3<d){d=d3;ex=e3x;ey=e3y}
  var g=Math.cos(8*Math.atan2(ey,ex));
  return .7*(d-(.14+.04*m)*(1+.22*g));
 }},
/* What is left of space after round holes are taken out of it at four sizes. The largest holes overlap their
   neighbours, which leaves a frame to fly through; the smaller ones pit the frame like pumice. */
{id:"foam",name:"Foam",hue:.15,fog:.16,maxd:16,speed:.6,start:[1,1,1],
 period:function(){return [2,2,2]},
 glsl:[
 "float map(vec3 p){",
 "  float s=1.0;float R=1.25;orb=vec4(1000.0);float d=-1e5;",
 "  for(int i=0;i<4;i++){",
 "    vec3 a=mod(p*s,2.0)-1.0;",
 "    orb=min(orb,vec4(abs(a),dot(a,a)*0.4));",
 "    d=max(d,(R-length(a))/s);",
 "    s*=3.0;R=0.92+0.07*uM;",
 "  }",
 "  return d;",
 "}"],
 de:function(x,y,z,m){
  var s=1,R=1.25,d=-1e5;
  for(var i=0;i<4;i++){
    d=Math.max(d,(R-Math.hypot(md(x*s,2)-1,md(y*s,2)-1,md(z*s,2)-1))/s);
    s*=3;R=.92+.07*m;
  }
  return d;
 }},
/* Trees: a stem, then at its tip the space is folded four ways, leant over, and shrunk, and the stem is drawn again. */
{id:"thicket",name:"Thicket",hue:.3,fog:.13,maxd:22,speed:.9,start:[1.2,.3,1.2],
 period:function(){return [6,6,6]},
 glsl:[
 "#define P 3.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
 "  float an=0.62+0.2*uM;float ca=cos(an),sa=sin(an),cb=cos(0.5*an),sb=sin(0.5*an);",
 "  float s=1.0;float d=1e5;orb=vec4(1000.0);p.y+=1.5;",
 "  for(int i=0;i<7;i++){",
 "    d=min(d,(length(p-vec3(0.0,clamp(p.y,0.0,1.0),0.0))-0.07)/s);",
 "    p.y-=1.0;p.xz=abs(p.xz);",
 "    p.xy=vec2(ca*p.x-sa*p.y,sa*p.x+ca*p.y);",
 "    p.zy=vec2(cb*p.z-sb*p.y,sb*p.z+cb*p.y);",
 "    orb=min(orb,vec4(abs(p),dot(p,p)*0.5));",
 "    p*=1.6;s*=1.6;",
 "  }",
 "  return 0.8*d;",
 "}"],
 de:function(x,y,z,m){
  var P=3;x=tile(x,P);y=tile(y,P);z=tile(z,P);
  var an=.62+.2*m,ca=Math.cos(an),sa=Math.sin(an),cb=Math.cos(.5*an),sb=Math.sin(.5*an),s=1,d=1e5,t;y+=1.5;
  for(var i=0;i<7;i++){
    d=Math.min(d,(Math.hypot(x,y-Math.max(0,Math.min(1,y)),z)-.07)/s);
    y-=1;x=Math.abs(x);z=Math.abs(z);
    t=ca*x-sa*y;y=sa*x+ca*y;x=t;
    t=cb*z-sb*y;y=sb*z+cb*y;z=t;
    x*=1.6;y*=1.6;z*=1.6;s*=1.6;
  }
  return .8*d;
 }},
/* The limit set of a Kleinian group (after Jos Leys and Knighty): a slab of space is wrapped sideways, its upper half
   is turned over onto its lower half, and it is turned inside out through a sphere, again and again. */
{id:"klein",name:"Kleinian",hue:.72,fog:.2,maxd:14,speed:.5,start:[1.55,.84,.84],
 period:function(m){var a=1.9+.04*m;return [2,2*a,2]},
 glsl:[
 "float map(vec3 p){",
 "  float a=1.9+0.04*uM;float df=1.0;orb=vec4(1000.0);",
 "  p.y=a-abs(mod(p.y,2.0*a)-a);",
 "  for(int i=0;i<12;i++){",
 "    p.xz=mod(p.xz+1.0,2.0)-1.0;",
 "    if(p.y>=0.5*a)p=vec3(-p.x,a-p.y,-p.z);",
 "    float ir=1.0/max(dot(p,p),1e-6);",
 "    p*=-ir;p.x=-p.x;p.y=a+p.y;df*=ir;",
 "    orb=min(orb,vec4(abs(p),dot(p,p)*0.3));",
 "  }",
 "  return 0.6*min(min(p.y,a-p.y),0.3)/max(df,2.0);",
 "}"],
 de:function(x,y,z,m){
  var a=1.9+.04*m,df=1;
  y=a-Math.abs(md(y,2*a)-a);
  for(var i=0;i<12;i++){
    x=md(x+1,2)-1;z=md(z+1,2)-1;
    if(y>=.5*a){x=-x;y=a-y;z=-z}
    var ir=1/Math.max(x*x+y*y+z*z,1e-6);
    x=x*ir;y=a-y*ir;z=-z*ir;df*=ir;
  }
  return .6*Math.min(Math.min(y,a-y),.3)/Math.max(df,2);
 }},
/* Cubes with smaller cubes on their eight corners, and smaller ones on theirs. */
{id:"pyrite",name:"Pyrite",hue:.11,fog:.13,maxd:22,speed:.9,start:[2,.3,2],
 packs:true,grid:4,rad:1.92,mix:["julia","bulbs"],period:function(){return pkPer(4)},
 shape:[
 "float SHAPE(vec3 p){",
 "  float a1=0.25+0.3*uM;float c1=cos(a1),s1=sin(a1);",
 "  float s=1.0;float d=1e5;orb=vec4(1000.0);",
 "  for(int i=0;i<4;i++){",
 "    vec3 b=abs(p)-0.5;",
 "    d=min(d,(length(max(b,0.0))+min(max(b.x,max(b.y,b.z)),0.0))/s);",
 "    p=abs(p)-0.66;",
 "    p.xy=vec2(c1*p.x-s1*p.y,s1*p.x+c1*p.y);",
 "    p.yz=vec2(c1*p.y-s1*p.z,s1*p.y+c1*p.z);",
 "    orb=min(orb,vec4(abs(p),dot(p,p)));",
 "    p*=2.6;s*=2.6;",
 "  }",
 "  return 0.9*d;",
 "}"],
 de:function(x,y,z,m){return packDe("pyrite",x,y,z,m)},
 sde:function(x,y,z,m){
  var a1=.25+.3*m,c1=Math.cos(a1),s1=Math.sin(a1),s=1,d=1e5,t;
  for(var i=0;i<4;i++){
    var bx=Math.abs(x)-.5,by=Math.abs(y)-.5,bz=Math.abs(z)-.5;
    d=Math.min(d,(Math.hypot(Math.max(bx,0),Math.max(by,0),Math.max(bz,0))+Math.min(Math.max(bx,by,bz),0))/s);
    x=Math.abs(x)-.66;y=Math.abs(y)-.66;z=Math.abs(z)-.66;
    t=c1*x-s1*y;y=s1*x+c1*y;x=t;
    t=c1*y-s1*z;z=s1*y+c1*z;y=t;
    x*=2.6;y*=2.6;z*=2.6;s*=2.6;
  }
  return .9*d;
 }},
/* Soft lights hanging in the dark at two sizes, one to a cell, each a little off its cell's middle and slowly swaying. */
{id:"lanterns",name:"Lanterns",hue:.6,fog:0,maxd:1,speed:.6,start:[.3,.2,.1],volume:true,
 period:function(){return [8,8,8]},
 glsl:[
 "#define VMAP(a) ((a)*(a)*1.5)",
 "#define VSTEP 0.1",
 "float lay(vec3 p,float k){",
 "  vec3 c=floor(p);vec3 f=p-c-0.5;c=floor(mod(c+0.5,8.0));",
 "  float h=fract(sin(dot(c,vec3(12.9898,78.233,37.719)))*43758.5453);",
 "  vec3 w3=smoothstep(0.5,0.3,abs(f));",
 "  f-=0.36*(vec3(h,fract(h*57.31),fract(h*913.7))-0.5)+0.04*sin(uTime*0.3+h*vec3(40.0,70.0,90.0));",
 "  float d2=dot(f,f);return (0.3+0.7*fract(h*311.1))*w3.x*w3.y*w3.z*(exp(-d2*k)+0.6*exp(-d2*k*7.0));",
 "}",
 "float dens(vec3 p){",
 "  return lay(p,40.0-9.0*uM)+0.7*lay(p*2.0+3.3,34.0)+0.06*exp(-3.0*abs(dot(sin(p*0.7854),cos(p.zxy*0.7854))));",
 "}"],
 de:function(){return .25}},
/* The inside of a living cell, one cell to every 8 units, each the mirror image of its neighbours so that the walls
   between them meet exactly. The wall is the cell's membrane, with a round opening in the middle of each side; in the
   middle is the nucleus, a hollow ball with 26 pores; thin straight tubes run from the nucleus out to the wall.
   For those the point is folded into one forty-eighth of the cell (its three distances from the middle, largest
   first), so each shape is written once. Between the nucleus and the wall lie mitochondria and vesicles, which are
   not folded: which block of the cell holds one, and how it lies, comes from a number worked out from the block's
   place with whole numbers only, as in Tangle, so the chip and JavaScript agree. The side blocks with no
   mitochondrion hold a Golgi stack. Round the nucleus are the sheets of the rough endoplasmic reticulum, in the
   cell's edges and corners the tubes of the smooth; by one corner pore stands the centrosome; and inside the
   nucleus are the nucleolus and a tangle of chromatin. */
{id:"cell",name:"Cell",hue:.86,fog:.1,maxd:24,speed:.9,start:[.2,.15,3.1],
 period:function(){return [16,16,16]},
 glsl:[
 "float smx(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return max(a,b)+h*h*k*0.25;}",
 "float mo(float x,float y){return floor(mod(x+0.5,y));}",
 /* one barrel of the centrosome: nine rods in a ring round the third axis */
 "float brl(vec3 v){",
 "  float an=mod(atan(v.y,v.x)+0.349066,0.698132)-0.349066;float l=length(v.xy);",
 "  return length(vec3(l*cos(an)-0.11,l*sin(an),v.z-clamp(v.z,-0.2,0.2)))-0.025;",
 "}",
 "float map(vec3 p){",
 "  vec3 q=abs(mod(p+4.0,16.0)-8.0)-4.0;",
 "  vec3 a=abs(q);",
 "  if(a.x<a.y)a.xy=a.yx;",
 "  if(a.x<a.z)a.xz=a.zx;",
 "  if(a.y<a.z)a.yz=a.zy;",
 "  float r=length(q);",
 /* the membrane: everything outside a box with round corners, less a round opening along each axis */
 "  float rip=0.04*sin(3.0*q.x)*sin(3.0*q.y)*sin(3.0*q.z);",
 "  vec3 b=a-2.35;",
 "  float box=length(max(b,0.0))+min(b.x,0.0)-1.5;",
 "  float d=smx(rip-box,1.1-length(a.yz),0.35);",
 "  orb=vec4(0.3*a.y,0.2*a.z,0.3+4.0*rip,0.06+0.02*a.x);",
 /* the nucleus: a thin shell, with a pore on each axis, each edge's diagonal and each corner's, and a ring round each pore */
 "  float pr=0.26+0.05*uM;",
 "  float e2=length(a-vec3(0.5,0.5,0.0)*(a.x+a.y));",
 "  float e3=length(a-vec3(a.x+a.y+a.z)/3.0);",
 "  float pd=min(length(a.yz),min(e2,e3));",
 "  float nu=min(smx(abs(r-1.5)-0.06,pr-pd,0.1),length(vec2(pd-pr,r-1.5))-0.07);",
 "  if(nu<d){d=nu;orb=vec4(0.4*pd,0.3*abs(r-1.5),clamp(1.0-2.0*pd,0.0,1.0),0.42+0.25*pd);}",
 /* the tubes: two straight rods from the nucleus to the wall, which the fold makes 96 */
 "  vec3 w=vec3(0.8313,0.5154,0.2078);",
 "  float mt=length(a-w*clamp(dot(a,w),1.5,4.8))-0.03;",
 "  w=vec3(0.6880,0.6192,0.3784);",
 "  mt=min(mt,length(a-w*clamp(dot(a,w),1.5,5.8))-0.03);",
 "  if(mt<d){d=mt;orb=vec4(0.1,0.0,0.6,0.7+0.12*r);}",
 /* the mitochondria: the cell is cut into 4 by 4 by 4 blocks, and three in four of the 24 blocks in the middle of a side
    hold one, a capsule lying one of six ways. Half of them are cut open along their length to show the plates inside.
    A block's shape stays 0.15 inside its block, so no point is nearer a neighbour's shape than its block's side plus 0.15. */
 "  vec3 c2=min(floor(q*0.5+2.0),3.0);vec3 f=q-(2.0*c2-3.0);vec3 e=abs(c2-1.5);",
 "  float n=c2.x+4.0*c2.y+16.0*c2.z;float h=mo(n*(n+3.0),61.0);",
 "  float mi=1.15-max(abs(f.x),max(abs(f.y),abs(f.z)));",
 "  bool face=abs(e.x+e.y+e.z-2.5)<0.25;bool has=face&&mo(h,4.0)>0.5;",
 "  if(has){",
 "    float k=mo(floor((h+0.5)*0.25),3.0);float s=h>30.5?0.7071:-0.7071;",
 "    vec3 u=vec3(0.7071,s,0.0);vec3 v=vec3(0.0,0.0,1.0);",
 "    if(k>0.5){u=u.zxy;v=v.zxy;}",
 "    if(k>1.5){u=u.zxy;v=v.zxy;}",
 "    float t=dot(f,u);float cp=length(f-u*clamp(t,-0.55,0.55))-0.28;",
 "    float pl=abs(mod(t+4.0,0.2)-0.1)-0.03;",
 "    if(mo(floor((h+0.5)*0.125),2.0)>0.5)cp=min(max(abs(cp)-0.025,dot(f,v)),max(cp+0.06,pl));",
 "    else cp+=0.012*cos(31.4159*t);",
 "    if(cp<mi){mi=cp;if(mi<d)orb=vec4(0.5*abs(t),0.2,0.5+2.0*pl,0.22+0.25*t);}",
 "  }",
 /* the Golgi, in the side blocks that have no mitochondrion: five thin dishes, each part of a ball round the cell's middle, cut to a round stack */
 "  if(face&&!has){",
 "    float go=smx(smx(abs(mod(r-2.8375,0.125)-0.0625)-0.022,abs(r-3.15)-0.29,0.03),length(f*(1.0-step(1.0,e)))-0.55,0.05);",
 "    if(go<mi){mi=go;if(mi<d)orb=vec4(0.3*length(f),0.2,0.4,0.62+0.5*(r-2.9));}",
 "  }",
 "  d=min(d,mi);",
 /* the vesicles: the cell is cut into 8 by 8 by 8 small blocks too, and about a third of those between the nucleus and
    the wall, outside the mitochondria's blocks, hold a ball of one of four sizes, a little off the block's middle */
 "  vec3 c1=min(floor(q+4.0),7.0);vec3 cc=c1-3.5;vec3 f1=q-cc;",
 "  float n1=c1.x+8.0*c1.y+64.0*c1.z;float h1=mo(n1*(n1+3.0),61.0);",
 "  float ve=0.7-max(abs(f1.x),max(abs(f1.y),abs(f1.z)));",
 "  if(!face&&h1<21.5&&max(abs(cc.x),max(abs(cc.y),abs(cc.z)))<3.0&&dot(cc,cc)>4.41){",
 "    vec3 o=0.07*(vec3(mo(h1,3.0),mo(floor((h1+0.5)/3.0),3.0),mo(floor((h1+0.5)/9.0),3.0))-1.0);",
 "    float vs=length(f1-o)-(0.09+0.025*mo(h1,4.0)+0.015*uM);",
 "    if(vs<ve){ve=vs;if(ve<d)orb=vec4(0.3,0.1,0.2,0.9+0.01*h1);}",
 "  }",
 "  d=min(d,ve);",
 /* the endoplasmic reticulum. One wavy measure of the place (a gyroid) shapes both kinds. Rough: three thin wavy
    sheets wrapped round the nucleus, with windows where the measure is high, a clear way in to every pore, and a
    fine grain of bumps for the ribosomes. Smooth: a net of tubes where the measure is highest, kept to the cell's
    edges and corners, where no mitochondrion lies. */
 "  vec3 gq=2.6*q;float gy=dot(sin(gq),cos(gq.zxy));",
 "  float rr=r+0.08*sin(2.0*q.x+1.0)*sin(2.0*q.y+2.0)*sin(2.0*q.z);",
 "  float sh=min(abs(rr-2.1),abs(abs(rr-2.1)-0.27))-0.025-0.008*sin(30.0*q.x)*sin(30.0*q.y)*sin(30.0*q.z);",
 "  float er=smx(smx(sh,(gy-0.45)*0.25,0.08),0.42-pd,0.08);",
 "  if(er<d){d=er;orb=vec4(0.3*abs(gy),0.1,0.3+0.3*gy,0.52+0.3*(rr-2.1));}",
 "  float se=smx((1.18-gy)*0.25,2.2-a.y,0.15);",
 "  if(se<d){d=se;orb=vec4(0.2*a.z,0.3,0.6,0.3+0.06*a.x);}",
 /* the centrosome: two barrels at right angles, just outside one corner pore; one to a cell, so it is not folded */
 "  vec3 cq=q-1.67;float ce=length(cq)-0.55;",
 "  if(ce<0.1){",
 "    vec3 v=vec3(dot(cq,vec3(0.4082,0.4082,-0.8165)),dot(cq,vec3(0.5774)),dot(cq,vec3(0.7071,-0.7071,0.0)));",
 "    ce=min(brl(v+vec3(0.2,0.0,0.0)),brl(vec3(v.y,v.z,v.x-0.22)));",
 "    if(ce<d)orb=vec4(0.2,0.4,0.8,0.8+0.3*v.z);",
 "  }",
 "  d=min(d,ce);",
 /* inside the nucleus: the nucleolus, a lumpy ball off the middle, and the chromatin, a fine tangle of two threads
    (where a finer gyroid is far from zero either way), with the straight ways between the pores left clear */
 "  if(r<1.5){",
 "    float nl=length(q-vec3(0.45,-0.4,0.45))-0.4-0.025*sin(11.0*q.x)*sin(11.0*q.y)*sin(11.0*q.z);",
 "    if(nl<d){d=nl;orb=vec4(0.3,0.5,0.7,0.66+0.2*nl);}",
 "    vec3 hq=7.0*q;float g2=dot(sin(hq),cos(hq.zxy));",
 "    float ch=smx(smx((1.05-abs(g2))*0.09,r-1.33,0.05),0.2-pd,0.05);",
 "    if(ch<d){d=ch;orb=vec4(0.3*r,0.2,0.5+0.3*g2,0.12+0.2*r);}",
 "  }",
 "  return 0.8*d;",
 "}"],
 de:function(x,y,z,m){
  function smx(a,b,k){var h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k*.25}
  function mo(v,k){return Math.floor(md(v+.5,k))}
  function brl(a,b,c){var an=md(Math.atan2(b,a)+.349066,.698132)-.349066,l=Math.hypot(a,b);return Math.hypot(l*Math.cos(an)-.11,l*Math.sin(an),c-Math.max(-.2,Math.min(.2,c)))-.025}
  function rod(wx,wy,wz,far){var t=Math.max(1.5,Math.min(far,ax*wx+ay*wy+az*wz));return Math.hypot(ax-wx*t,ay-wy*t,az-wz*t)-.03}
  var qx=tile(x,8),qy=tile(y,8),qz=tile(z,8),ax=Math.abs(qx),ay=Math.abs(qy),az=Math.abs(qz),t;
  if(ax<ay){t=ax;ax=ay;ay=t}
  if(ax<az){t=ax;ax=az;az=t}
  if(ay<az){t=ay;ay=az;az=t}
  var r=Math.hypot(qx,qy,qz);
  var rip=.04*Math.sin(3*qx)*Math.sin(3*qy)*Math.sin(3*qz);
  var bx=ax-2.35,by=ay-2.35,bz=az-2.35;
  var box=Math.hypot(Math.max(bx,0),Math.max(by,0),Math.max(bz,0))+Math.min(bx,0)-1.5;
  var d=smx(rip-box,1.1-Math.hypot(ay,az),.35);
  var pr=.26+.05*m,s=.5*(ax+ay),c=(ax+ay+az)/3;
  var pd=Math.min(Math.hypot(ay,az),Math.hypot(ax-s,ay-s,az),Math.hypot(ax-c,ay-c,az-c));
  d=Math.min(d,smx(Math.abs(r-1.5)-.06,pr-pd,.1),Math.hypot(pd-pr,r-1.5)-.07);
  d=Math.min(d,rod(.8313,.5154,.2078,4.8),rod(.6880,.6192,.3784,5.8));
  var c2x=Math.min(Math.floor(qx*.5+2),3),c2y=Math.min(Math.floor(qy*.5+2),3),c2z=Math.min(Math.floor(qz*.5+2),3);
  var fx=qx-(2*c2x-3),fy=qy-(2*c2y-3),fz=qz-(2*c2z-3);
  var n=c2x+4*c2y+16*c2z,h=mo(n*(n+3),61);
  var mi=1.15-Math.max(Math.abs(fx),Math.abs(fy),Math.abs(fz));
  var e1=Math.abs(c2x-1.5),e2=Math.abs(c2y-1.5),e3=Math.abs(c2z-1.5),face=Math.abs(e1+e2+e3-2.5)<.25,has=face&&mo(h,4)>.5;
  if(has){
    var k=mo(Math.floor((h+.5)*.25),3),sg=h>30.5?.7071:-.7071,ux=.7071,uy=sg,uz=0,vx=0,vy=0,vz=1;
    if(k>.5){t=uz;uz=uy;uy=ux;ux=t;t=vz;vz=vy;vy=vx;vx=t}
    if(k>1.5){t=uz;uz=uy;uy=ux;ux=t;t=vz;vz=vy;vy=vx;vx=t}
    var tt=fx*ux+fy*uy+fz*uz,tc=Math.max(-.55,Math.min(.55,tt)),cp=Math.hypot(fx-ux*tc,fy-uy*tc,fz-uz*tc)-.28;
    var pl=Math.abs(md(tt+4,.2)-.1)-.03;
    if(mo(Math.floor((h+.5)*.125),2)>.5)cp=Math.min(Math.max(Math.abs(cp)-.025,fx*vx+fy*vy+fz*vz),Math.max(cp+.06,pl));
    else cp+=.012*Math.cos(31.4159*tt);
    mi=Math.min(mi,cp);
  }
  if(face&&!has)mi=Math.min(mi,smx(smx(Math.abs(md(r-2.8375,.125)-.0625)-.022,Math.abs(r-3.15)-.29,.03),Math.hypot(e1<1?fx:0,e2<1?fy:0,e3<1?fz:0)-.55,.05));
  d=Math.min(d,mi);
  var c1x=Math.min(Math.floor(qx+4),7),c1y=Math.min(Math.floor(qy+4),7),c1z=Math.min(Math.floor(qz+4),7);
  var ccx=c1x-3.5,ccy=c1y-3.5,ccz=c1z-3.5,gx=qx-ccx,gy=qy-ccy,gz=qz-ccz;
  var n1=c1x+8*c1y+64*c1z,h1=mo(n1*(n1+3),61);
  var ve=.7-Math.max(Math.abs(gx),Math.abs(gy),Math.abs(gz));
  if(!face&&h1<21.5&&Math.max(Math.abs(ccx),Math.abs(ccy),Math.abs(ccz))<3&&ccx*ccx+ccy*ccy+ccz*ccz>4.41){
    gx-=.07*(mo(h1,3)-1);gy-=.07*(mo(Math.floor((h1+.5)/3),3)-1);gz-=.07*(mo(Math.floor((h1+.5)/9),3)-1);
    ve=Math.min(ve,Math.hypot(gx,gy,gz)-(.09+.025*mo(h1,4)+.015*m));
  }
  d=Math.min(d,ve);
  var ux2=2.6*qx,uy2=2.6*qy,uz2=2.6*qz,gyr=Math.sin(ux2)*Math.cos(uz2)+Math.sin(uy2)*Math.cos(ux2)+Math.sin(uz2)*Math.cos(uy2);
  var rr=r+.08*Math.sin(2*qx+1)*Math.sin(2*qy+2)*Math.sin(2*qz);
  var sh=Math.min(Math.abs(rr-2.1),Math.abs(Math.abs(rr-2.1)-.27))-.025-.008*Math.sin(30*qx)*Math.sin(30*qy)*Math.sin(30*qz);
  d=Math.min(d,smx(smx(sh,(gyr-.45)*.25,.08),.42-pd,.08),smx((1.18-gyr)*.25,2.2-ay,.15));
  var cx=qx-1.67,cy=qy-1.67,cz=qz-1.67,ce=Math.hypot(cx,cy,cz)-.55;
  if(ce<.1){
    var v1=.4082*cx+.4082*cy-.8165*cz,v2=.5774*(cx+cy+cz),v3=.7071*(cx-cy);
    ce=Math.min(brl(v1+.2,v2,v3),brl(v2,v3,v1-.22));
  }
  d=Math.min(d,ce);
  if(r<1.5){
    d=Math.min(d,Math.hypot(qx-.45,qy+.4,qz-.45)-.4-.025*Math.sin(11*qx)*Math.sin(11*qy)*Math.sin(11*qz));
    var hx=7*qx,hy=7*qy,hz=7*qz,g2=Math.sin(hx)*Math.cos(hz)+Math.sin(hy)*Math.cos(hx)+Math.sin(hz)*Math.cos(hy);
    d=Math.min(d,smx(smx((1.05-Math.abs(g2))*.09,r-1.33,.05),.2-pd,.05));
  }
  return .8*d;
 }},
/* The two zoom worlds are flat pictures, not spaces: js/zoom.js draws them and moves the view. They are marked as cloud
   worlds too, so that everything that needs a surface (the orb's check, the thrown light, the distance probe) leaves them alone. */
/* Biomech: an endless hall of ribbed tunnels, in homage to the biomechanical paintings of H. R. Giger. Nothing of his
   is copied; it is made of the kinds of thing he painted: rib cages, spines, hoses. Along z run tunnels, one to each
   3.2 by 3.2 of x and y. A tunnel's wall is a cage: two rings to each unit of z, their thickness cut into segments
   like a windpipe, joined by eight knuckled rods. Where four tunnels meet stands a spine of four vertebrae to the
   unit, joined to the larger rings by tendons, and between each two tunnels runs a pair of ribbed hoses. The morph
   swells one ring as it shrinks the other, as if the cage breathed. The joins are rounded (bmS), and the swellings
   make the distance a little too large in places, so three quarters of it is used; the spine's, whose discs are the
   steepest swellings, is cut again to 0.58 of that. */
{id:"biomech",name:"Biomech",hue:.47,fog:.19,maxd:16,speed:.6,start:[.25,.1,.2],
 period:function(){return [3.2,3.2,1]},
 glsl:[
 "float bmS(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}",
 "float map(vec3 p){",
 "  vec3 q=vec3(mod(p.x+1.6,3.2)-1.6,mod(p.y+1.6,3.2)-1.6,mod(p.z+0.5,1.0)-0.5);",
 "  float rho=length(q.xy);float a=atan(q.y,q.x);float w=0.10;",
 "  float seg=0.016*cos(12.0*a);",
 "  float d=length(vec2(rho-(1.12+0.06*uM),q.z))-(0.085+seg);", /* the larger ring, in the middle of each unit */
 "  float d1=length(vec2(rho-(1.02-0.05*uM),0.5-abs(q.z)))-(0.065-seg);", /* the smaller, at its ends */
 "  if(d1<d){d=d1;w=0.16;}",
 "  float af=mod(a+0.3926991,0.7853982)-0.3926991;", /* the eight rods: one is worked out, and the angle folded onto it */
 "  float ds=length(vec2(rho*cos(af)-1.09,rho*sin(af)))-(0.045+0.02*cos(12.5663706*q.z));",
 "  if(ds<d)w=0.24;",
 "  d=bmS(d,ds,0.07);",
 "  vec2 c=abs(q.xy)-1.6;float vb=0.5+0.5*cos(25.1327412*q.z);", /* the spine at the nearest corner */
 "  float dv=(length(c)-(0.2+0.13*vb*vb))*0.58;", /* a vertebra's side is steep: its radius changes about twice as fast as the place along the spine, so this alone is taken much shorter, or rays step through the discs and the far ones tear */
 "  float dt=max(length(vec2((abs(q.x)-abs(q.y))*0.7071068,q.z))-0.05,1.07+0.06*uM-rho);", /* a tendon from the larger ring out to the spine */
 "  if(dt<d)w=0.30;",
 "  d=bmS(d,dt,0.08);",
 "  if(dv<d)w=0.36+0.06*vb;",
 "  d=bmS(d,dv,0.08);",
 "  vec2 e=vec2(abs(q.x)-1.6,q.y);vec2 f=vec2(abs(q.y)-1.6,q.x);if(dot(f,f)<dot(e,e))e=f;", /* the pair of hoses between this tunnel and the nearest neighbour */
 "  float dh=length(vec2(e.x,abs(e.y)-0.13))-(0.085+0.012*cos(62.8318531*q.z));",
 "  if(dh<d){d=dh;w=0.52+0.04*cos(62.8318531*q.z);}",
 "  orb=vec4(0.5+0.5*cos(12.0*a),0.3*vb,0.25,w);",
 "  return 0.75*d;",
 "}"],
 de:function(x,y,z,m){
  var S=function(a,b,k){var h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return b+(a-b)*h-k*h*(1-h);};
  var qx=md(x+1.6,3.2)-1.6,qy=md(y+1.6,3.2)-1.6,qz=md(z+.5,1)-.5;
  var rho=Math.hypot(qx,qy),a=Math.atan2(qy,qx),seg=.016*Math.cos(12*a);
  var d=Math.hypot(rho-(1.12+.06*m),qz)-(.085+seg);
  var d1=Math.hypot(rho-(1.02-.05*m),.5-Math.abs(qz))-(.065-seg);
  if(d1<d)d=d1;
  var af=md(a+.3926991,.7853982)-.3926991;
  var ds=Math.hypot(rho*Math.cos(af)-1.09,rho*Math.sin(af))-(.045+.02*Math.cos(12.5663706*qz));
  d=S(d,ds,.07);
  var cx=Math.abs(qx)-1.6,cy=Math.abs(qy)-1.6,vb=.5+.5*Math.cos(25.1327412*qz);
  var dv=(Math.hypot(cx,cy)-(.2+.13*vb*vb))*.58;
  var dt=Math.max(Math.hypot((Math.abs(qx)-Math.abs(qy))*.7071068,qz)-.05,1.07+.06*m-rho);
  d=S(d,dt,.08);
  d=S(d,dv,.08);
  var ex=cx,ey=qy,fx=cy,fy=qx;if(fx*fx+fy*fy<ex*ex+ey*ey){ex=fx;ey=fy;}
  var dh=Math.hypot(ex,Math.abs(ey)-.13)-(.085+.012*Math.cos(62.8318531*qz));
  if(dh<d)d=dh;
  return .75*d;
 }},
/* Eyes, in homage to the visionary paintings on the band Tool's records and stage (Alex Grey's among them): a lattice
   of eyes that look both ways, each between two lids, in a sun of seven long flames and seven short ones with a
   beaded halo round their tips. The pupil is a hole right through, so a row of eyes is seen through the eye in
   front. Three eyes to a cell of 3.2, one facing along each axis, and the cell is mirror-tiled, so the sevenfold suns
   need not match the cube. An eye is worked out only within a quarter of a unit of the ball that holds it. The morph
   opens the pupil as it narrows the lids, and sways the flames. Three quarters of the distance is used, since the
   flames' sway and the beads make it a little too large in places. */
{id:"seer",name:"Seer",hue:.6,fog:.1,maxd:26,speed:1.0,start:[1.6,1.6,.5],
 period:function(){return [6.4,6.4,6.4]},
 glsl:[
 "vec4 srC;",
 "float srFl(vec3 f,float tip){", /* one flame: a flat tongue from the lids out to tip, bent to one side */
 "  float s=clamp((f.x-0.45)/(tip-0.45),0.0,1.0);",
 "  return (length(vec3(f.x-clamp(f.x,0.45,tip),f.y-0.13*(tip-0.45)*(0.7+0.5*uM)*s*sin(4.712389*s),1.8*f.z))-(0.008+0.075*(1.0-s)*(0.25+1.6*s)))*0.5555556;",
 "}",
 "float srEye(vec3 l){", /* one eye about the origin, looking along z both ways; srC is its colour measures */
 "  float r=length(l);float rho=length(l.xy);float a=atan(l.y,l.x);",
 "  float pu=0.1+0.04*uM;",
 "  float d=max(max(r-0.42,pu-rho),0.8883+0.012*rho*cos(24.0*a)-length(vec3(l.xy,abs(l.z)-1.2)));", /* the ball, less the pupil, less the iris's shallow dish */
 "  float k=clamp((rho-pu)/(0.24-pu),0.0,1.0);",
 "  srC=rho<0.245?vec4(0.5+0.5*cos(24.0*a),k,0.5*k,0.32+0.5*k):vec4(0.0,0.0,0.0,0.04);",
 "  float th=atan(rho,abs(l.z));", /* the lids: a shell with hoops round the way it looks, and an almond cut through it */
 "  float e=max(abs(r-0.46-0.008*cos(24.0*th))-0.012,0.5-length(vec2(l.x,abs(l.y)+0.3-0.04*uM)));",
 "  if(e<d){d=e;srC=vec4(0.5+0.5*cos(24.0*th),0.2,0.0,0.55+0.18*th);}",
 "  float af=mod(a+0.4487990,0.8975979)-0.4487990;float bf=af<0.0?af+0.4487990:af-0.4487990;", /* the angle folded onto one long flame, and onto the short one beside it */
 "  e=min(srFl(vec3(rho*cos(af),rho*sin(af),l.z),0.98),srFl(vec3(rho*cos(bf),rho*sin(bf),l.z),0.74));",
 "  if(e<d){d=e;srC=vec4(0.2,0.6,0.5,0.2+0.5*rho);}",
 "  e=min(length(vec2(rho-1.0,l.z))-(0.026+0.008*cos(28.0*a)),length(vec2(rho-0.74,l.z))-0.011);", /* the halo, and a thin one at the short flames' tips */
 "  if(e<d){d=e;srC=vec4(0.5+0.5*cos(28.0*a),0.1,0.0,0.8);}",
 "  return d;",
 "}",
 "float srSt(vec3 l){", /* a star of seven points in a ring: each of its seven lines joins a point to the third from it */
 "  vec2 v=l.xy;float d2=1e5;float rho=length(v);",
 "  for(int i=0;i<7;i++){",
 "    v=vec2(0.6234898*v.x-0.7818315*v.y,0.7818315*v.x+0.6234898*v.y);",
 "    vec2 g=vec2(v.x-0.2003,max(abs(v.y)-0.8774,0.0));d2=min(d2,dot(g,g));",
 "  }",
 "  float d=sqrt(d2+l.z*l.z)-0.016;srC=vec4(0.3,0.5,0.4,0.3+0.5*rho);",
 "  float e=length(vec2(rho-0.9,l.z))-0.022;",
 "  if(e<d){d=e;srC=vec4(0.0,0.1,0.0,0.8);}",
 "  return d;",
 "}",
 "float map(vec3 p){",
 "  vec3 q=abs(mod(p+1.6,6.4)-3.2)-1.6;",
 "  vec3 l2=vec3(q.y,q.z,abs(q.x)-1.6);vec3 l3=vec3(q.z,q.x,abs(q.y)-1.6);vec3 l4=vec3(q.xy,abs(q.z)-1.6);",
 "  float d=length(q)-1.06;float e;vec4 c=vec4(0.0);",
 "  if(d<0.25){d=srEye(q);c=srC;}",
 "  e=length(l2)-1.06;if(e<0.25)e=srEye(l2);if(e<d){d=e;c=srC;}",
 "  e=length(l3)-1.06;if(e<0.25)e=srEye(l3);if(e<d){d=e;c=srC;}",
 "  e=length(l4)-0.95;if(e<0.25)e=srSt(l4);if(e<d){d=e;c=srC;}",
 "  orb=c;return 0.75*d;",
 "}"],
 de:function(x,y,z,m){
  function fl(fx,fy,fz,tip){
    var s=Math.max(0,Math.min(1,(fx-.45)/(tip-.45)));
    return (Math.hypot(fx-Math.max(.45,Math.min(tip,fx)),fy-.13*(tip-.45)*(.7+.5*m)*s*Math.sin(4.712389*s),1.8*fz)-(.008+.075*(1-s)*(.25+1.6*s)))*.5555556;
  }
  function eye(lx,ly,lz){
    var r=Math.hypot(lx,ly,lz),rho=Math.hypot(lx,ly),a=Math.atan2(ly,lx),pu=.1+.04*m,th=Math.atan2(rho,Math.abs(lz));
    var d=Math.max(r-.42,pu-rho,.8883+.012*rho*Math.cos(24*a)-Math.hypot(lx,ly,Math.abs(lz)-1.2));
    d=Math.min(d,Math.max(Math.abs(r-.46-.008*Math.cos(24*th))-.012,.5-Math.hypot(lx,Math.abs(ly)+.3-.04*m)));
    var af=md(a+.4487990,.8975979)-.4487990,bf=af<0?af+.4487990:af-.4487990;
    d=Math.min(d,fl(rho*Math.cos(af),rho*Math.sin(af),lz,.98),fl(rho*Math.cos(bf),rho*Math.sin(bf),lz,.74));
    return Math.min(d,Math.hypot(rho-1,lz)-(.026+.008*Math.cos(28*a)),Math.hypot(rho-.74,lz)-.011);
  }
  function star(lx,ly,lz){
    var d2=1e5,rho=Math.hypot(lx,ly),i,t,gx,gy;
    for(i=0;i<7;i++){
      t=.6234898*lx-.7818315*ly;ly=.7818315*lx+.6234898*ly;lx=t;
      gx=lx-.2003;gy=Math.max(Math.abs(ly)-.8774,0);d2=Math.min(d2,gx*gx+gy*gy);
    }
    return Math.min(Math.sqrt(d2+lz*lz)-.016,Math.hypot(rho-.9,lz)-.022);
  }
  var qx=Math.abs(md(x+1.6,6.4)-3.2)-1.6,qy=Math.abs(md(y+1.6,6.4)-3.2)-1.6,qz=Math.abs(md(z+1.6,6.4)-3.2)-1.6;
  var ax=Math.abs(qx)-1.6,ay=Math.abs(qy)-1.6,az=Math.abs(qz)-1.6,d=Math.hypot(qx,qy,qz)-1.06,e;
  if(d<.25)d=eye(qx,qy,qz);
  e=Math.hypot(qy,qz,ax)-1.06;if(e<.25)e=eye(qy,qz,ax);if(e<d)d=e;
  e=Math.hypot(qz,qx,ay)-1.06;if(e<.25)e=eye(qz,qx,ay);if(e<d)d=e;
  e=Math.hypot(qx,qy,az)-.95;if(e<.25)e=star(qx,qy,az);if(e<d)d=e;
  return .75*d;
 }},
/* A net, in homage to the visionary paintings on the band Tool's records and stage (Alex Grey's among them): strands
   fringed with flames join into a net that fills space, each strand has an almond eye set into its middle, looking out
   both ways, and every large gap in the net holds a ball of cloud. The strands are the twelve ways from each place of
   a face-centred lattice to its neighbours, so in any flat cut along the axes the net is diamonds. Space is folded
   into one corner of a cube of 2.2, where there are six strands, two lying in each direction of flat; of each two only
   the nearer is worked out, and the distance is held to what the other could be. A strand is worked out as a flat
   shape (u along it, v across, w out of its flat). The morph lengthens the flames and opens the pupils. The flames'
   teeth are steep, so little more than a third of their distance is used. */
{id:"net",name:"Net",hue:0,fog:.11,maxd:22,speed:.9,start:[1.1,1.1,.7],
 period:function(){return [4.4,4.4,4.4]},
 glsl:[
 "vec4 ntC;",
 "float ntS(vec3 l){",
 "  float au=abs(l.x),aw=abs(l.z);float av=abs(l.y-0.08*sin(2.0190*l.x));", /* the strand sways once to each side between its ends */
 "  float tooth=1.0-abs(2.0*fract(6.5*au-4.0*av)-1.0);", /* the flames: teeth along both edges, leaning away from the eye */
 "  float en=smoothstep(0.26,0.42,au)*(1.0-0.6*smoothstep(0.9,1.55,au))*(1.0+0.25*uM)*(0.72+0.28*cos(9.4*au));",
 "  float g=0.37*(av-0.025-0.13*en*tooth);float h=aw-0.006-0.02*(1.0-clamp((av-0.03)*7.0,0.0,1.0));", /* thinner toward the tips */
 "  float d=length(max(vec2(g,h),0.0))+min(max(g,h),0.0)-0.008;",
 "  ntC=vec4(tooth,0.3,0.3*en*tooth,0.36+0.3*en*tooth);",
 "  float e=max(length(vec2(av,aw))-0.04,0.3-au)*0.95;", /* the rib down the middle */
 "  if(e<d){d=e;ntC=vec4(0.0,0.2,0.0,0.5);}",
 "  av=abs(l.y);float alm=length(vec2(au,av+0.225))-0.375;", /* the eye: lids round an almond, and a flattened ball inside it */
 "  e=length(max(vec2(abs(alm)-0.012,aw-0.05),0.0))-0.012;",
 "  if(e<d){d=e;ntC=vec4(0.2,0.2,0.0,0.45);}",
 "  float rho=length(l.xy);float pu=0.04+0.012*uM;",
 "  e=max((length(vec3(l.xy,1.7*l.z))-0.155)*0.5882353,alm);",
 "  if(e<d){d=e;ntC=rho<pu?vec4(0.0):(rho<0.1?vec4(0.0,rho*5.0,0.0,0.1+2.2*rho):vec4(0.0,0.0,0.0,0.62));}",
 "  return d;",
 "}",
 "float map(vec3 p){",
 "  vec3 q=abs(mod(p+2.2,4.4)-2.2);float e;",
 "  float a=(q.x+q.y-2.2)*0.7071068;float b=(q.x-q.y)*0.7071068;",
 "  float d=q.z<1.1?ntS(vec3(a,b,q.z)):ntS(vec3(b,a,q.z-2.2));vec4 c=ntC;",
 "  a=(q.z+q.x-2.2)*0.7071068;b=(q.z-q.x)*0.7071068;",
 "  e=q.y<1.1?ntS(vec3(a,b,q.y)):ntS(vec3(b,a,q.y-2.2));if(e<d){d=e;c=ntC;}",
 "  a=(q.y+q.z-2.2)*0.7071068;b=(q.y-q.z)*0.7071068;",
 "  e=q.x<1.1?ntS(vec3(a,b,q.x)):ntS(vec3(b,a,q.x-2.2));if(e<d){d=e;c=ntC;}",
 "  d=min(d,min(abs(q.x-1.1),min(abs(q.y-1.1),abs(q.z-1.1)))+1.0);", /* the strands not worked out are at least this far */
 "  e=min(min(length(q),length(q-vec3(2.2,2.2,0.0))),min(length(q-vec3(2.2,0.0,2.2)),length(q-vec3(0.0,2.2,2.2))))-0.09;", /* a knot where strands meet */
 "  if(e<d){d=e;c=vec4(0.0,0.3,0.0,0.55);}",
 "  vec3 k=q-vec3(2.2,0.0,0.0);vec3 k2=q-vec3(0.0,2.2,0.0);if(dot(k2,k2)<dot(k,k))k=k2;", /* the ball of cloud in the nearest large gap */
 "  k2=q-vec3(0.0,0.0,2.2);if(dot(k2,k2)<dot(k,k))k=k2;k2=q-vec3(2.2);if(dot(k2,k2)<dot(k,k))k=k2;",
 "  float bm=cos(8.0*k.x)*cos(8.0*k.y)*cos(8.0*k.z);float bn=cos(19.0*k.x)*cos(19.0*k.y)*cos(19.0*k.z);",
 "  e=(length(k)-0.62-0.035*bm-0.012*bn)*0.6;",
 "  if(e<d){d=e;c=vec4(0.15*bn,0.0,0.0,0.6+0.05*bm);}",
 "  orb=c;return 0.9*d;",
 "}"],
 de:function(x,y,z,m){
  function ss(a,b,v){v=Math.max(0,Math.min(1,(v-a)/(b-a)));return v*v*(3-2*v)}
  function st(u,v,w){
    var au=Math.abs(u),av=Math.abs(v-.08*Math.sin(2.0190*u)),aw=Math.abs(w),t=6.5*au-4*av;
    var tooth=1-Math.abs(2*(t-Math.floor(t))-1),en=ss(.26,.42,au)*(1-.6*ss(.9,1.55,au))*(1+.25*m)*(.72+.28*Math.cos(9.4*au));
    var g=.37*(av-.025-.13*en*tooth),h=aw-.006-.02*(1-Math.max(0,Math.min(1,(av-.03)*7)));
    var d=Math.hypot(Math.max(g,0),Math.max(h,0))+Math.min(Math.max(g,h),0)-.008;
    d=Math.min(d,Math.max(Math.hypot(av,aw)-.04,.3-au)*.95);
    av=Math.abs(v);var alm=Math.hypot(au,av+.225)-.375;
    d=Math.min(d,Math.hypot(Math.max(Math.abs(alm)-.012,0),Math.max(aw-.05,0))-.012);
    return Math.min(d,Math.max((Math.hypot(u,v,1.7*w)-.155)*.5882353,alm));
  }
  var qx=Math.abs(md(x+2.2,4.4)-2.2),qy=Math.abs(md(y+2.2,4.4)-2.2),qz=Math.abs(md(z+2.2,4.4)-2.2),r=.7071068,a,b,d,e,i,k2,kx,ky,kz;
  a=(qx+qy-2.2)*r;b=(qx-qy)*r;d=qz<1.1?st(a,b,qz):st(b,a,qz-2.2);
  a=(qz+qx-2.2)*r;b=(qz-qx)*r;e=qy<1.1?st(a,b,qy):st(b,a,qy-2.2);if(e<d)d=e;
  a=(qy+qz-2.2)*r;b=(qy-qz)*r;e=qx<1.1?st(a,b,qx):st(b,a,qx-2.2);if(e<d)d=e;
  d=Math.min(d,Math.min(Math.abs(qx-1.1),Math.abs(qy-1.1),Math.abs(qz-1.1))+1);
  d=Math.min(d,Math.min(Math.hypot(qx,qy,qz),Math.hypot(qx-2.2,qy-2.2,qz),Math.hypot(qx-2.2,qy,qz-2.2),Math.hypot(qx,qy-2.2,qz-2.2))-.09);
  var G=[[2.2,0,0],[0,2.2,0],[0,0,2.2],[2.2,2.2,2.2]],best=1e9;
  for(i=0;i<4;i++){a=qx-G[i][0];b=qy-G[i][1];e=qz-G[i][2];k2=a*a+b*b+e*e;if(k2<best){best=k2;kx=a;ky=b;kz=e;}}
  d=Math.min(d,(Math.sqrt(best)-.62-.035*Math.cos(8*kx)*Math.cos(8*ky)*Math.cos(8*kz)-.012*Math.cos(19*kx)*Math.cos(19*ky)*Math.cos(19*kz))*.6);
  return .9*d;
 }},
/* Cloth: a plain weave of square threads, each bored through like the Sponge, lying flat with open sky above it and
   the same cloth again every 3 units below. Threads are 0.25 thick and 1 apart, one set along x and one along z,
   each going over one and under the next. The whole cloth is lifted and dropped by waves (fbH: js/fabric.js works
   the same sum out from the same twelve numbers, which the frame sets from the clock and the sound), as cloth moves
   in a wind. Only the nearest thread of each set is worked out, and the distance is held to what the next thread and
   the next cloth could be. The world does not repeat upward: its period there is only a number the camera never
   reaches, because camera.js keeps it above the cloth and under a ceiling (sheet: true). The threads' rise and the
   waves' slopes make the distance too large by up to a half, so 0.65 of it is used. The morph is not used. */
{id:"fabric",name:"Fabric",hue:.08,fog:.07,maxd:30,speed:1.2,start:[0,1.5,0],sheet:true,band:[1.7,3],
 period:function(){return [12,16,12]},
 glsl:[
 "uniform float uFb[12];",
 "vec4 fbO;",
 "float fbH(vec2 p){", /* how high the cloth's middle is here */
 "  float k=0.5235988;",
 "  float h=uFb[0]*sin(k*p.x-uFb[5]+0.6*sin(k*p.y+uFb[6]));",
 "  h+=uFb[1]*sin(k*(2.0*p.x+3.0*p.y)-uFb[7]);",
 "  h+=uFb[2]*sin(7.0*k*p.x-uFb[8]+2.0*sin(2.0*k*p.y+uFb[9]));",
 "  h+=uFb[3]*sin(3.0*k*p.x)*sin(2.0*k*p.y)*cos(uFb[10]);",
 "  h+=uFb[4]*exp(6.0*(cos(k*p.x-uFb[11]+sin(k*p.y))-1.0));",
 "  return h;",
 "}",
 "float fbT(vec3 q){", /* one thread, in units of half its thickness: q is along it, up, and across. A square bar with the Sponge's holes, a little larger than the Sponge's own */
 "  float d=max(abs(q.y),abs(q.z))-1.0;float s=1.0;",
 "  for(int i=0;i<3;i++){",
 "    vec3 a=mod(q*s,2.0)-1.0;s*=3.0;vec3 r=abs(1.0-3.0*abs(a));",
 "    fbO=min(fbO,vec4(abs(a),dot(a,a)*0.4));",
 "    d=max(d,(min(max(r.x,r.y),min(max(r.y,r.z),max(r.z,r.x)))-0.82)/s);",
 "  }",
 "  return d;",
 "}",
 "float map(vec3 p){",
 "  float y=p.y-fbH(p.xz);float n=min(floor(y/3.0+0.5),0.0);y-=3.0*n;", /* the cloth this place is nearest: the top one, or one of those below */
 "  float ci=floor(p.x),cj=floor(p.z);",
 "  float si=1.0-2.0*mod(ci,2.0),sj=1.0-2.0*mod(cj,2.0);",
 "  float ax=p.x-ci-0.5,az=p.z-cj-0.5;",
 "  fbO=vec4(1000.0);float d=fbT(vec3(p.x,y-0.135*sj*sin(3.1415927*p.x),az)*8.0);vec4 c=fbO;", /* the thread along x */
 "  fbO=vec4(1000.0);float e=fbT(vec3(p.z,y+0.135*si*sin(3.1415927*p.z),ax)*8.0);", /* the thread along z, under where the other is over */
 "  if(e<d){d=e;c=fbO+vec4(0.0,0.0,0.0,0.35);}",
 "  d*=0.125;float up=max(abs(y)-0.26,0.0);",
 "  d=min(d,length(vec2(0.875-max(abs(ax),abs(az)),up)));", /* the next thread over is at least this far */
 "  d=min(d,y+2.74);if(n<-0.5)d=min(d,2.74-y);", /* and so are the cloth below, and the one above if there is one */
 "  orb=c;return 0.65*d;",
 "}"],
 de:function(x,y,z){
  function th(al,up,ac){
    var d=Math.max(Math.abs(up),Math.abs(ac))-1,s=1,i,rx,ry,rz;
    for(i=0;i<3;i++){
      rx=Math.abs(1-3*Math.abs(md(al*s,2)-1));ry=Math.abs(1-3*Math.abs(md(up*s,2)-1));rz=Math.abs(1-3*Math.abs(md(ac*s,2)-1));s*=3;
      d=Math.max(d,(Math.min(Math.max(rx,ry),Math.max(ry,rz),Math.max(rz,rx))-.82)/s);
    }
    return d;
  }
  var n,ci=Math.floor(x),cj=Math.floor(z),si=1-2*md(ci,2),sj=1-2*md(cj,2),ax=x-ci-.5,az=z-cj-.5,d;
  y-=fbH(x,z);n=Math.min(Math.floor(y/3+.5),0);y-=3*n;
  d=.125*Math.min(th(8*x,8*(y-.135*sj*Math.sin(3.1415927*x)),8*az),th(8*z,8*(y+.135*si*Math.sin(3.1415927*z)),8*ax));
  d=Math.min(d,Math.hypot(.875-Math.max(Math.abs(ax),Math.abs(az)),Math.max(Math.abs(y)-.26,0)),y+2.74);
  if(n<-.5)d=Math.min(d,2.74-y);
  return .65*d;
 }},
{id:"mzoom",name:"Mandelbrot zoom",hue:.55,fog:0,maxd:1,speed:.5,start:[.3,.2,.1],volume:true,flat:true,
 period:function(){return [4,4,4]},glsl:[],de:function(){return .2}},
{id:"jzoom",name:"Julia zoom",hue:.1,fog:0,maxd:1,speed:.5,start:[.3,.2,.1],volume:true,flat:true,julia:true,
 period:function(){return [4,4,4]},glsl:[],de:function(){return .2}}
];

/* The worlds made of one shape repeated (packs: true). Each gives its shape alone, about the origin and inside a ball
   of radius rad: shape in GLSL (a function named SHAPE) and sde in JavaScript. The packing (js/packing.js) says where
   the copies go; grid is the P it is given. mix names the two other kinds of shape that share the space when the
   shapes are mixed. */
let byId=null;
function packKinds(w){
  var i;
  if(!byId){byId={};for(i=0;i<WORLDS.length;i++)byId[WORLDS[i].id]=WORLDS[i];}
  return w.kinds||(w.kinds=[w,byId[w.mix[0]],byId[w.mix[1]]]);
}
/* such a world's distance: the place within a copy from the packing, then the shape of that copy's kind at its own point of the morph */
function packDe(id,x,y,z,m){
  var k=packKinds(byId&&byId[id]||WORLDS.filter(function(w){return w.id===id})[0]),q=pkP(x,y,z,k[0].grid,k[0].rad,k[1].rad,k[2].rad,m);
  if(q[3]>0)return q[3];
  return pkD(k[q[4]].sde(q[0],q[1],q[2],q[5]));
}
/* such a world's GLSL: its shape, the other two kinds too if the shapes are mixed, and a map that asks the packing
   where it is. Inside a shape uM is the copy's own morph, which the packing works out (pkU). */
export function packSrc(w){
  var k=packKinds(w),n=pkMix?3:1,f=function(v){return v.toFixed(3)},out=["#define uM pkU"],i;
  for(i=0;i<n;i++)out=out.concat(k[i].shape.map(function(l){return l.replace("SHAPE","sh"+i)}));
  return out.concat(["#undef uM",
 "float map(vec3 p){",
 "  p=pkP(p,"+f(w.grid)+",vec3("+f(k[0].rad)+","+f(k[n>1?1:0].rad)+","+f(k[n>1?2:0].rad)+"));if(pkO>0.0){orb=vec4(1.0);return pkO;}",
 n>1?"  float d=0.0;if(pkK<0.5)d=sh0(p);else if(pkK<1.5)d=sh1(p);else d=sh2(p);":"  float d=sh0(p);",
 "  return pkD(d);",
 "}"]);
}

/* Inside out: what was open space is solid and what was solid is open. A world's distance is only good outside its
   shapes, so the swap is made a shell's width out from them: the new walls stand where the old distance equals the
   shell, the new open space is everything nearer the old shapes than that, the old shapes themselves included, and
   the new distance is the shell less the old one (an old distance below nothing, which inside some shapes is a large
   number that means nothing, counts as nothing). It is taken a little short (IN_STEP), because far from the shapes
   an old distance may grow faster than the real one. The shell is three tenths of the most open space the world has,
   measured once for each world and packing on a fixed grid of places, so that every device gets the same number.
   Not in the descent, whose distances grow with the camera's, nor in a cloud, zoom or pack world, nor over the
   Fabric (sheet), which has no far side to be inside of. */
export const IN_STEP=0.8;
export const IN_PART=0.3;
export let inOut=false;
const inKept={};
export function setInOutNow(on){inOut=!!on;}
export function inShell(w){
  var k,per,i,j,l,best=0,d,n=7;
  if(!inOut||!w||!w.de0||w.flat||w.volume||w.pack||w.sheet||pkDeep(w))return 0;
  k=w.id+","+packing+(pkMix?"m":"");
  if(inKept[k]===undefined){
    per=w.period(0);
    for(i=0;i<n;i++)for(j=0;j<n;j++)for(l=0;l<n;l++){d=w.de0((i/n-0.5)*per[0],(j/n-0.5)*per[1],(l/n-0.5)*per[2],0);if(d>best)best=d;}
    inKept[k]=IN_PART*best;
  }
  return inKept[k];
}
/* A world's distance with the swap made, if it is on. Inside the new walls it answers nothing, not a number below
   nothing as the shader does: flight takes the size of a distance for open room, and must not find room in a wall. */
export function inDe(w,x,y,z,m){var d=w.de0(x,y,z,m),c=inShell(w);return c>0?Math.max(0,(c-Math.max(d,0))*IN_STEP):d;}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* every world with a distance of its own keeps it as de0, and answers through inDe from now on */
WORLDS.forEach(function(w){
  if(w.flat||w.volume||typeof w.de!=="function")return;
  w.de0=w.de;w.de=function(x,y,z,m){return inDe(w,x,y,z,m);};
});
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={WORLDS, packKinds, packDe, packSrc, IN_STEP, IN_PART, inKept, setInOutNow, inShell, inDe, get inOut(){return inOut},set inOut(v){inOut=v}};
