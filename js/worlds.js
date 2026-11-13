import { fr, md, tile } from "./dom.js";
import { G } from "./shared.js";

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
 de:function(){return .2}}
];

/* cosine palettes: colour = a + b*cos(2pi*(c*x+d)) */
export const PALETTES=[
 {name:"Spectrum",a:[.5,.5,.5],b:[.5,.5,.5],c:[1,1,1],d:[0,.33,.67]},
 {name:"Ember",a:[.5,.22,.08],b:[.5,.25,.1],c:[1,1,1],d:[0,.07,.15]},
 {name:"Abyss",a:[.1,.4,.5],b:[.12,.4,.5],c:[1,1,1],d:[.55,.15,0]},
 {name:"Sunset",a:[.5,.5,.5],b:[.5,.5,.5],c:[1,.7,.4],d:[0,.15,.2]},
 {name:"Acid",a:[.5,.5,.5],b:[.5,.5,.5],c:[2,1,0],d:[.5,.2,.25]},
 {name:"Orchid",a:[.55,.3,.6],b:[.45,.3,.4],c:[1,1,1],d:[0,.45,.15]},
 {name:"Bone",a:[.5,.48,.44],b:[.5,.48,.44],c:[1,1,1],d:[0,.02,.05]}
,
 {name:"Aurora",a:[.2,.5,.4],b:[.2,.5,.4],c:[1,1,1],d:[.6,0,.3]},
 {name:"Infra",a:[.5,.1,.3],b:[.5,.1,.3],c:[1,1,1],d:[0,.5,.6]},
 {name:"Candy",a:[.7,.5,.6],b:[.3,.4,.4],c:[1,1,1],d:[0,.3,.6]},
 {name:"Toxic",a:[.3,.5,.05],b:[.3,.5,.05],c:[1,1,1],d:[.15,0,.5]},
 {name:"Gold",a:[.5,.4,.15],b:[.5,.4,.2],c:[1,1,1],d:[0,.05,.3]},
 {name:"Ultraviolet",a:[.35,.1,.55],b:[.35,.1,.45],c:[1,1,1],d:[.1,.5,0]}
];
export const BASE_PALS=7;
export const NPAL=PALETTES.length;
/* a built-in palette is open once its orb is found; palettes from a pack are always open */
export function palOpen(i){return i<BASE_PALS+G.unlocked||i>=NPAL;}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
G.pi=0;
G.unlocked=0;
G.orbsFound=0; /* built-in palettes; any after these came from a pack */
try{var sv=JSON.parse(localStorage.getItem("mirrorfold")||"{}");G.unlocked=Math.max(0,Math.min(NPAL-BASE_PALS,sv.u|0));G.orbsFound=sv.n|0;}catch(_){}
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get WORLDS(){return WORLDS}, get PALETTES(){return PALETTES}, get BASE_PALS(){return BASE_PALS}, get NPAL(){return NPAL}, get palOpen(){return palOpen}};
