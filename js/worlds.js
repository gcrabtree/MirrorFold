/* The worlds: each one's shader distance function beside the same function in JavaScript. */
import { fr, md, tile } from "./dom.js";

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
 period:function(){return [6,6,6]},
 glsl:[
 "#define P 3.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [6.8,6.8,6.8]},
 glsl:[
 "#define P 3.4",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3.4;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [6,6,6]},
 glsl:[
 "#define P 3.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [6,6,6]},
 glsl:[
 "#define P 3.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [6.8,6.8,6.8]},
 glsl:[
 "#define P 3.4",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3.4;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [6,6,6]},
 glsl:[
 "#define P 3.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [6.8,6.8,6.8]},
 glsl:[
 "#define P 3.4",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=3.4;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
 period:function(){return [8,8,8]},
 glsl:[
 "#define P 4.0",
 "float map(vec3 p){",
 "  p=abs(mod(p+0.5*P,2.0*P)-P)-0.5*P;",
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
 de:function(x,y,z,m){
  var P=4;x=tile(x,P);y=tile(y,P);z=tile(z,P);
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
{id:"mzoom",name:"Mandelbrot zoom",hue:.55,fog:0,maxd:1,speed:.5,start:[.3,.2,.1],volume:true,flat:true,
 period:function(){return [4,4,4]},glsl:[],de:function(){return .2}},
{id:"jzoom",name:"Julia zoom",hue:.1,fog:0,maxd:1,speed:.5,start:[.3,.2,.1],volume:true,flat:true,julia:true,
 period:function(){return [4,4,4]},glsl:[],de:function(){return .2}}
];



export function init(){

}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={WORLDS};
