

/* ---------- the land: an endless mountain range, drawn alone or laid over a world ----------
   A height field, not a distance field, so it has its own shaders and its own camera position (lpos); it shares the
   camera's direction with the worlds. Height is a sum of noise layers. Each layer is the last one turned and shrunk by the
   whole-number matrix [2 -1; 1 2], and the noise repeats every 256 squares, so the land repeats exactly every 256/LFREQ
   units and lpos can be wrapped. The noise is a table of whole numbers, so the GLSL here and landH() in JavaScript agree.
   Far off, forest is a dark patch and stony ground is grey; within about two units of the camera they become things:
   trees, bushes, boulders, rocks and scree, each a small bump added to the height. */
export const LFREQ=0.35,LPERIOD=256/LFREQ;
/* The land shader with gaps, marked @, that each landscape fills in: its shape, what grows on it, its colours, its sky
   and any free-standing shapes. landSrc() puts one together. */
export const LAND_T=[
"precision highp float;",
"uniform vec2 uRes;uniform float uTime,uHue,uTint,uFov,uSeg,uSpin,uSky;uniform vec3 uPos,uSun,uSunCol,uPa,uPb,uPc,uPd;uniform mat3 uCam;uniform sampler2D uSkyT;",
"uniform vec2 uCi[13],uCf[13],uLi[6],uLf[6],uPreRes;uniform vec4 uDa,uDb;uniform sampler2D uN,uPre,uX;uniform float uK;", /* where the camera sits in each noise layer, worked out exactly in JavaScript */
"@CONST",
"vec3 gTop,gLow,gSun,gHaze,gAmb;", /* sky, sun and haze colours, set once in main: natural, or taken from the palette */
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
/* the direction a pixel looks in: the same lens and the same mirrors as the worlds use, so the two line up */
"vec3 ray(vec2 fc){",
"  vec2 uv=(2.0*fc-uRes)/sqrt(uRes.x*uRes.y);",
"  if(uSeg>0.5){float r=length(uv),seg=6.2831853/uSeg,a0=atan(uv.y,uv.x)+uSpin,a=abs(a0-floor(a0/seg)*seg-0.5*seg);uv=r*vec2(cos(a),sin(a));}",
"  return normalize(uCam*vec3(uv,uFov));",
"}",
/* Random numbers come from a 256 by 256 table held in a texture. Each texel also carries its three neighbours,
   so one read gives all four corners that a noise value is blended from. JavaScript reads the same table. */
"float hash(vec2 i){return texture2D(uN,(i+0.5)/256.0).r;}",
/* value noise and its slope. "base" is a whole-number corner and x a small offset from it, which keeps the fine layers exact */
"vec3 noised(vec2 base,vec2 x){vec2 i=floor(x),f=x-i,u=f*f*f*(f*(f*6.0-15.0)+10.0),du=30.0*f*f*(f*(f-2.0)+1.0);",
"  vec4 q=texture2D(uN,(base+i+0.5)/256.0);float a=q.r,b=q.g,c=q.b,d=q.a,k=a-b-c+d;",
"  return vec3(a+(b-a)*u.x+(c-a)*u.y+k*u.x*u.y,du*(vec2(b-a,c-a)+k*u.yx));}",
"float noise(vec2 x){return noised(vec2(0.0),x).x;}",
"@SHAPE",
/* The land's height at q, measured from the camera. Each layer is weakened where the layers before it are steep,
   which carves ridges and gullies. */
"#define TERR(name,N) float name(vec2 q){vec2 p=q*FREQ,d=vec2(0.0);float a=0.0,b=1.0;for(int i=0;i<N;i++){vec3 n=noised(uCi[i],uCf[i]+p);d+=n.yz;a+=b*(i<3?n.x:n.x-0.5)/(1.0+dot(d,d));b*=0.5;p=mat2(2.0,1.0,-1.0,2.0)*p;}return shape(a);}",
"TERR(terrL,4)",
/* four layers again, but never below the true height: the two layers left out can add at most 0.047, which shapeU allows for */
"float terrU(vec2 q){vec2 p=q*FREQ,d=vec2(0.0);float a=0.0,b=1.0;for(int i=0;i<4;i++){vec3 n=noised(uCi[i],uCf[i]+p);d+=n.yz;a+=b*(i<3?n.x:n.x-0.5)/(1.0+dot(d,d));b*=0.5;p=mat2(2.0,1.0,-1.0,2.0)*p;}return shapeU(a);}",
"TERR(terrM,6)",
/* the same six layers, also giving a close guess at the slope (xy of the result) for the cost of the height alone */
"vec3 terrG(vec2 q){vec2 p=q*FREQ,d=vec2(0.0),g=vec2(0.0);float a=0.0,b=1.0;mat2 T=mat2(1.0,0.0,0.0,1.0);",
"  for(int i=0;i<6;i++){vec3 n=noised(uCi[i],uCf[i]+p);d+=n.yz;float w=b/(1.0+dot(d,d));a+=w*(i<3?n.x:n.x-0.5);g+=w*(T*n.yz);b*=0.5;p=mat2(2.0,1.0,-1.0,2.0)*p;T=T*mat2(2.0,-1.0,1.0,2.0);}",
"  return vec3(g*FREQ*dshape(a),shape(a));}",
/* the full detail: nine layers everywhere, and four finer ones that fade in as "det" rises close to the camera */
"float terrD(vec2 q,float det){vec2 p=q*FREQ,d=vec2(0.0);float a=0.0,b=1.0,af=0.0;",
"  for(int i=0;i<13;i++){",
"    if(i>8&&det<=0.0)break;",
"    vec3 n=noised(uCi[i],uCf[i]+p);d+=n.yz;float c=b*(i>8?det*0.8:1.0)*(i<3?n.x:n.x-0.5)/(1.0+dot(d,d));if(i<6)a+=c;else af+=c;b*=0.5;p=mat2(2.0,1.0,-1.0,2.0)*p;",
"  }",
"  return shape(a+af/(1.0+FLUTE*dshape(a)));}", /* where the shape is a cliff the fine layers are turned down, or they would score it with upright grooves */
"float fbm(vec2 p){float a=0.0,b=0.5;for(int i=0;i<4;i++){a+=b*noise(p);b*=0.5;p=mat2(2.0,1.0,-1.0,2.0)*p;}return a;}",

"@EXTRA",
"/*sky*/",
"@SKY",
"vec3 haze(vec3 col,float t,vec3 rd){",
"  vec3 fc=mix(gHaze,gSun,0.45*pow(max(dot(rd,uSun),0.0),5.0));",
"  return mix(col,fc,1.0-exp(-0.022*t));",
"}",
/* ---------- what stands on the ground, close up ----------
   From far off a forest is a dark patch and a stony slope is grey. Within a couple of units of the camera they become
   things: conifers, bushes, boulders, rocks and scree, each a small bump added to the height of the land.
   zone() says what kind of ground a place is; things() scatters one thing to each square of several grids. */
"@ZONE",
/* one grid square: xy is the offset from the middle of the thing in it, z and w are two random numbers for it,
   and gR holds four more. r is the thing's reach as a part of the square; its middle is kept far enough in that it never crosses the edge. */
"vec4 gR;",
"vec4 cell(vec2 base,vec2 x,float r){",
"  vec2 i=floor(x),b=base+i;vec4 A=texture2D(uN,(b+0.5)/256.0);gR=texture2D(uN,(b+vec2(57.5,113.5))/256.0);",
"  return vec4(x-i-(vec2(r)+(1.0-2.0*r)*A.rb),gR.r,A.g);",
"}",
"@SHAPES",
/* x height above the land, y kind (1 conifer, 1.4 broadleaf tree, 2 bush, 3 stone), z how far up or in (0 at the edge, 1 at the middle), w a random number */
"vec4 things(vec2 q,vec3 Z,float t){",
"  vec4 best=vec4(0.0),c;float h,k,rr,br;",
"  float fT=smoothstep(2.2,1.3,t),fM=smoothstep(0.9,0.45,t),fS=smoothstep(0.30,0.12,t);",
"  if(fT<=0.0)return best;",
"  vec2 x=q*FREQ,xm=mat2(2.0,1.0,-1.0,2.0)*x;",
"  if(Z.x+Z.y>0.001){", /* trees: two scatterings, so the forest is dense and uneven. A few stand alone in the meadows. */
"    c=cell(uLi[0],uLf[0]+x*240.0,0.36);k=smoothstep(0.0,0.2,Z.x+0.04*Z.y-c.z);",
"    if(k>0.0){br=step(BROAD,gR.a);rr=0.36*(0.55+0.45*gR.g);h=fT*k*TSC*(0.010+0.024*c.w*c.w)*treeh(c.xy/rr,gR,br);if(h>best.x)best=vec4(h,1.0+0.4*br,h/(fT*k*TSC*0.034),c.w);}",
"    c=cell(uLi[1],uLf[1]+xm*100.0,0.34);k=smoothstep(0.0,0.2,0.9*Z.x+0.03*Z.y-c.z);",
"    if(k>0.0){br=step(BROAD-0.07,gR.a);rr=0.34*(0.5+0.5*gR.g);h=fT*k*TSC*(0.009+0.020*c.w)*treeh(c.xy/rr,gR,br);if(h>best.x)best=vec4(h,1.0+0.4*br,h/(fT*k*TSC*0.029),gR.b);}",
"  }",
"  if(Z.y>0.001&&fM>0.0){", /* bushes in the meadows */
"    c=cell(uLi[2],uLf[2]+xm*160.0,0.33);k=smoothstep(0.0,0.1,0.26*Z.y-c.z);",
"    if(k>0.0){rr=0.33*(0.45+0.55*gR.b);h=fM*k*(0.0012+0.0024*c.w)*bushh(c.xy/rr,gR);if(h>best.x)best=vec4(h,2.0,h/(fM*k*0.0036),c.w);}",
"  }",
"  if(Z.z+Z.y>0.001){", /* boulders, then rocks, then scree: each smaller and nearer */
"    c=cell(uLi[3],uLf[3]+xm*30.0,0.34);k=smoothstep(0.0,0.1,0.30*Z.z+0.03*Z.y-c.z);",
"    if(k>0.0){h=fT*k*(0.004+0.008*c.w)*rockh(c.xy/0.27,gR);if(h>best.x)best=vec4(h,3.0,0.5,c.w);}",
"    if(fM>0.0){",
"      c=cell(uLi[4],uLf[4]+x*230.0,0.34);k=smoothstep(0.0,0.1,0.65*Z.z+0.05*Z.y-c.z);",
"      if(k>0.0){h=fM*k*(0.0010+0.0020*c.w)*rockh(c.xy/0.27,gR);if(h>best.x)best=vec4(h,3.0,0.5,c.w);}",
"    }",
"    if(fS>0.0){",
"      c=cell(uLi[5],uLf[5]+xm*320.0,0.34);k=smoothstep(0.0,0.1,0.9*Z.z-c.z);",
"      if(k>0.0){h=fS*k*(0.0004+0.0006*c.w)*rockh(c.xy/0.27,gR);if(h>best.x)best=vec4(h,3.0,0.5,c.w);}",
"    }",
"  }",
"  return best;",
"}",
/* where the coarse first pass says this pixel's ray can safely begin: the nearest of the four coarse rays around it */
"float pre(){",
"  vec2 g=floor(gl_FragCoord.xy/uK-0.5);float m=1e3;",
"  for(int j=0;j<4;j++){vec2 o=vec2(mod(float(j),2.0),floor(float(j)/2.0));m=min(m,dot(texture2D(uPre,(g+o+0.5)/uPreRes).rgb,vec3(1.0,1.0/255.0,1.0/65025.0))*80.0);}",
"  return max(0.02,m*0.97-0.006);",
"}",
/* walk the ray until it meets the ground or something standing on it; -1 means it reached the sky.
   Things are added only within "reach" of the start, so a mirrored ray can leave them out. */
"float gX;", /* set by march: 1 if the ray met a free-standing shape, not the ground */
"float march(vec3 ro,vec3 rd,float far,float reach,float t,float rough){",
"  float h=1.0,tp=t,dx=1e3;bool hi=true;gX=0.0;",
"  for(int i=0;i<200;i++){",
"    vec3 p=ro+rd*t;float lim=1e3;",
"    if(i<5&&t>0.03&&p.y<terrM(p.xz)){t*=0.6;h=1.0;hi=true;continue;}",
"#ifdef EXTRAS",
"    dx=extra(p);if(dx<0.0005*t*rough+0.00005){gX=1.0;return t;}",
"#endif", /* began inside the land: back toward the camera and try again */
"    if(hi){h=p.y-terrU(p.xz);if(h<0.12){hi=false;h=p.y-terrM(p.xz);}}", /* well clear of the ground, the four-layer height that is never too low costs less */
"    else if(t<reach&&h<0.08){", /* low enough to meet a tree or a rock: add them, and take short steps so none is stepped over */
"      vec3 G=terrG(p.xz);float yv;h=p.y-G.z;",
"      if(h<0.036){",
"        vec3 Z=zone(p.xz,G,yv);bool tall=Z.x+0.04*Z.y>0.02;",
"        if(tall||h<0.016){h-=things(p.xz,Z,t).x;lim=tall?0.0025+0.006*t:0.006+0.012*t;}",
"        if(h<0.0006*t+0.00005)return t;",
"      }",
"    }else{h=p.y-terrM(p.xz);hi=h>0.3;}",
"    if(h<0.0012*t*rough){", /* met the land. If the step went in deep, as it can through a cliff, search back for where it went in. */
"      if(h<-0.002*t)for(int j=0;j<7;j++){float tm=0.5*(tp+t);p=ro+rd*tm;if(p.y>terrM(p.xz))tp=tm;else t=tm;}",
"      else for(int j=0;j<3;j++){p=ro+rd*t;t+=0.6*(p.y-terrM(p.xz));}",
"      return t;",
"    }",
"    if(t>far||(p.y>HMAX&&rd.y>0.0))return -1.0;",
"    tp=t;t+=min(min(0.42*h+0.0006*t*rough,lim),dx);",
"  }",
"  return h<0.03?t:-1.0;", /* out of steps while skimming the ground: call it a hit, so no holes open in the land */
"}",
"float shadow(vec3 ro){",
"  float res=1.0,t=0.05;ro.y=max(ro.y,terrM(ro.xz)+0.006);",
"  for(int i=0;i<SHN;i++){",
"    vec3 p=ro+uSun*t;float h=p.y-terrU(p.xz);if(h<0.25)h=p.y-terrM(p.xz);",
"#ifdef EXTRAS",
"    h=min(h,extra(p));",
"#endif",
"    res=min(res,10.0*h/t+0.05);",
"    if(res<0.01||p.y>HMAX)break;",
"    t+=clamp(h,0.02,0.6);",
"  }",
"  return clamp(res,0.0,1.0);",
"}",
"@GROUND",
"@XCOL",
"void main(){",
"  vec3 ro=vec3(0.0,uPos.y,0.0),rd=ray(gl_FragCoord.xy);float alpha=1.0;", /* everything is measured from the camera */
"@COLS",
"  if(uTint>0.5){", /* a palette colours the sky, the sun and the haze */
"    vec3 pa=pal(uHue+0.55),pb=pal(uHue+0.2),pc=pal(uHue);",
"    gTop=mix(gTop,pa*0.75,0.85);gLow=mix(gLow,0.45+0.55*pb,0.85);gSun=mix(uSunCol,0.45+0.55*pc,0.5);gHaze=mix(gHaze,0.35+0.6*pb,0.85);gAmb=mix(gAmb,0.12+0.35*pa,0.55);",
"  }",
/* Two passes through one loop: the view itself, and, if it lands on a lake, the mirrored view from the water.
   One loop means the marching and the land colouring are each built into the program once. */
"  vec3 col=vec3(0.0),wgt=vec3(1.0);",
"  for(int b=0;b<2;b++){",
"    float t=march(ro,rd,b==0?70.0:35.0,b==0?2.2:0.0,b==0?pre():0.02,b==0?1.0:4.0),tw=(b==0&&rd.y<0.0)?(WATER-ro.y)/rd.y:-1.0;",
"    if(tw>0.0&&(t<0.0||tw<t)){", /* a lake: its bed seen through the water, and the mountains mirrored on it */
"      vec3 p=ro+rd*tw;",
"      vec2 W=p.xz+uPos.xz,g=noised(vec2(0.0),W*42.0+uTime*vec2(0.5,0.3)).yz+0.6*noised(vec2(0.0),W*97.0-uTime*vec2(0.4,0.7)).yz;",
"      vec3 n=normalize(vec3(g.x*0.035,1.0,g.y*0.035));",
"      float depth=WATER-terrM(p.xz),fr=0.06+0.94*pow(1.0-max(dot(-rd,n),0.0),5.0);",
"      float sh=shadow(p+vec3(0.0,0.003,0.0));",
"      vec3 body=mix(WSHAL,WDEEP,smoothstep(0.0,0.06,depth))*(0.25+0.75*sh*clamp(uSun.y*1.6,0.0,1.0))*(0.6+0.4*gSun);",
"      if(uTint>1.5)body=mix(body,pal(uHue+0.8)*dot(body,vec3(1.0)),0.8);",
"      vec3 rr=reflect(rd,n);rr.y=abs(rr.y)+0.001;",
"      float fo=0.6*smoothstep(0.004,0.0,depth),k=exp(-0.022*tw);", /* foam at the shore, and how much haze lies in front */
"      vec3 fc=mix(gHaze,gSun,0.45*pow(max(dot(rd,uSun),0.0),5.0));",
"      col=k*((body*(1.0-fr)+WGLOW+gSun*sh*pow(max(dot(rr,uSun),0.0),300.0)*1.5)*(1.0-fo)+WFOAM*fo)+(1.0-k)*fc;",
"      wgt=vec3(k*fr*(1.0-fo));",
"      ro=p+vec3(0.0,0.002,0.0);rd=rr;alpha=mix(1.0,exp(-0.03*tw),0.8*uSky);",
"    }else{",
"      if(t>0.0){",
"#ifdef EXTRAS",
"        if(gX>0.5)col+=wgt*xcol(ro+rd*t,t,rd);else",
"#endif",
"        col+=wgt*ground(ro+rd*t,t,rd,float(b));if(b==0)alpha=mix(1.0,exp(-0.03*t),0.8*uSky);}", /* over a world, far land thins into it */
"      else if(uSky<0.5)col+=wgt*haze(sky(rd),90.0*(1.0-smoothstep(0.0,0.12,rd.y)),rd);",
"      else if(b==0)alpha=0.0;", /* over a world, the sky is left clear for the world to show through */
"      else{vec3 cs=rd*uCam;vec2 st=(cs.xy/max(cs.z,0.05)*uFov*sqrt(uRes.x*uRes.y)+uRes)/(2.0*uRes);col+=wgt*pow(texture2D(uSkyT,clamp(st,0.0,1.0)).rgb,vec3(2.2));}", /* a lake mirrors the world: the last frame of it, looked up where the mirrored ray would land on screen */
"      break;",
"    }",
"  }",
"  col=col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);", /* film-like roll-off of the bright end */
"  col=pow(clamp(col,0.0,1.0),vec3(0.4545));",
"  col=mix(vec3(dot(col,vec3(0.3,0.59,0.11))),col,1.12);",
"  gl_FragColor=vec4(col*step(0.001,alpha),alpha);",
"}"];
export const ALPS_SHAPE=[
/* broad flat valley floors, steep high peaks */
"float shape(float a){return 1.5*pow(max(a-0.22,0.0),1.35);}",
"float dshape(float a){return 2.025*pow(max(a-0.22,0.0001),0.35);}",
"float shapeU(float a){return shape(a+0.047);}"
].join("\n");
export const ALPS_SKY=[
"vec3 sky(vec3 rd){",
"  float y=max(rd.y,0.0),s=max(dot(rd,uSun),0.0);",
"  vec3 c=mix(gLow,gTop,pow(y,0.5));",
"  c=mix(c,gSun,0.35*pow(s,6.0)*(1.0-y));",
"  if(rd.y>0.015){",
"    vec2 q=rd.xz/(rd.y+0.08)*0.9+uTime*vec2(0.006,0.002);",
"    float cl=smoothstep(0.50,0.78,fbm(q))*smoothstep(0.015,0.2,rd.y);",
"    c=mix(c,mix(0.55*gLow+0.4,0.4*gSun+0.6,0.5+0.5*s),cl*0.9);",
"  }",
"  return c+gSun*(0.9*pow(s,900.0)+0.25*pow(s,40.0));",
"}"
].join("\n");
export const ALPS_ZONE=[
"vec3 zone(vec2 q,vec3 G,out float yv){", /* x forest, y meadow, z stony; G must be terrG(q) */
"  vec2 W=q+uPos.xz,g=G.xy;float hgt=G.z;",
"  float ny=inversesqrt(1.0+dot(g,g)),n1=noise(W*1.7+3.0),n2=noise(W*6.0);",
"  yv=hgt+0.22*(n1-0.5)+0.16*(n2-0.5);",
"  float dry=smoothstep(WATER+0.003,WATER+0.02,hgt);",
"  float forest=smoothstep(0.44,0.60,0.7*noise(W*2.6+11.0)+0.3*n2+0.25*(ny-0.8))*smoothstep(TREE,TREE-0.15,yv)*smoothstep(0.55,0.72,ny)*dry;",
"  float meadow=smoothstep(0.62,0.82,ny)*smoothstep(SNOW,TREE,yv)*(1.0-forest)*dry;",
"  float stony=(1.0-smoothstep(0.50,0.78,ny)+0.5*smoothstep(TREE,SNOW,yv))*(1.0-0.8*smoothstep(SNOW-0.25,SNOW,yv))*dry;",
"  return vec3(forest,meadow,clamp(stony,0.0,1.0));",
"}"
].join("\n");
export const ALPS_SHAPES=[
/* a tree seen as a height: v is the offset in units of its reach. Conifers are spires with boughs sticking out;
   broadleaf trees are lumpy domes. */
"float treeh(vec2 v,vec4 R,float broad){",
"  float d=length(v),a=atan(v.y,v.x);",
"  d*=1.0+0.17*sin(a*7.0+R.g*31.0)+0.09*sin(a*12.0+R.b*77.0);",
"  return broad>0.5?0.5*sqrt(max(1.0-d*d,0.0))*(1.0+0.25*sin(v.x*9.0+R.g*20.0)*sin(v.y*8.0+R.b*20.0)):max(1.0-d,0.0)*(0.8+0.2*smoothstep(0.0,0.6,1.0-d));",
"}",
"float bushh(vec2 v,vec4 R){",
"  float a=atan(v.y,v.x),d=length(v)/(0.62+0.25*sin(a*3.0+R.g*20.0)+0.13*sin(a*5.0+R.b*50.0));",
"  return sqrt(max(1.0-d*d,0.0))*(0.75+0.3*sin(v.x*11.0+R.a*9.0)*sin(v.y*13.0+R.g*9.0));",
"}",
/* a boulder: a tilted top cut by five flat sides of uneven steepness, so it has edges and faces */
"float rockh(vec2 v,vec4 R){",
"  float a=R.g*6.2832,h=0.55+0.35*R.b+0.4*dot(v,vec2(cos(a*2.0),sin(a*2.0)));",
"  for(int k=0;k<5;k++){",
"    float b=a+1.2566*float(k)+0.2*sin(R.a*40.0+float(k)*2.3);",
"    h=min(h,(1.0-dot(v,vec2(cos(b),sin(b)))*(0.95+0.4*fract(R.b*(3.0+float(k)))))*(1.5+2.5*fract(R.a*(5.0+float(k)))));",
"  }",
"  return max(min(h,3.0*(1.0-0.8*length(v))),0.0);",
"}"
].join("\n");
export const ALPS_GROUND=[
/* the colour of the ground at p: rock, meadow, forest, glacier, snow, streams and waterfalls, the things standing on it, then sunlight */
"vec3 ground(vec3 p,float tr,vec3 rd,float mir){",
"  float t=tr+100.0*mir;", /* a mirrored view (mir 1) is drawn as if far away: no close-up detail, no stream, no cast shadow */
"  float det=smoothstep(1.6,0.25,t),det2=smoothstep(0.22,0.05,t);", /* how much close-up detail to draw: none far off, all of it near */
"  float e=max(0.00025,0.0011*tr),yv;vec3 G=terrG(p.xz);float gM=G.z;",
"  vec3 Z=zone(p.xz,G,yv);",
"  float h0=terrD(p.xz,det),hx=terrD(p.xz+vec2(e,0.0),det),hz=terrD(p.xz+vec2(0.0,e),det);",
"  vec3 nT=normalize(vec3(h0-hx,e,h0-hz));", /* the slope of the bare land, which decides what grows or lies there */
"  vec4 th=things(p.xz,Z,t);",
"  vec3 n=nT;",
"  if(t<2.2)n=normalize(vec3(h0+th.x-hx-things(p.xz+vec2(e,0.0),Z,t).x,e,h0+th.x-hz-things(p.xz+vec2(0.0,e),Z,t).x));", /* the slope with the things on it, for the light */
"  float l0=terrL(p.xz);",
"  vec3 nL=normalize(vec3(l0-terrL(p.xz+vec2(0.08,0.0)),0.08,l0-terrL(p.xz+vec2(0.0,0.08))));", /* the broad lie of the land */
"  vec2 W=p.xz+uPos.xz;", /* the place in the world, for patterns that must stay put as the camera moves */
"  vec3 dA=det>0.0?noised(uDa.xy,uDa.zw+p.xz*FREQ*429.0):vec3(0.5,0.0,0.0),dB=det2>0.0?noised(uDb.xy,uDb.zw+p.xz*FREQ*2571.0):vec3(0.5,0.0,0.0);", /* grain a hand wide and a finger wide */
"  float n1=noise(W*1.7+3.0),n2=noise(W*6.0),n3=noise(W*37.0),near=exp(-0.25*t);",
"  float fine=fbm(W*23.0),cav=clamp(0.55+30.0*(h0-gM),0.0,1.0);", /* hollows are darker than bumps */
"  float y=yv+0.10*(fine-0.5)-0.12*(nT.x*uSun.x+nT.z*uSun.z);", /* snow and trees reach lower on the side away from the sun */
"  float grain=1.0+det*0.45*(dA.x-0.5)+det2*0.4*(dB.x-0.5);",
"  vec3 rock=mix(vec3(0.27,0.25,0.24),vec3(0.52,0.49,0.45),fine)*(0.96+0.04*near*sin(dot(vec3(W.x,p.y,W.y),vec3(31.0,90.0,17.0))+14.0*n2+9.0*fine));",
"  rock=mix(rock,vec3(0.42,0.36,0.28),0.35*n1);",
"  if(det>0.0){", /* close up, bare rock is cracked: wandering lines at two sizes, and slabs of slightly different shade */
"    vec2 fw=normalize(nT.xz+vec2(0.0001)),u=mix(W*38.0,vec2(dot(W,vec2(-fw.y,fw.x))*26.0,p.y*55.0+dot(W,fw)*9.0),smoothstep(0.75,0.5,nT.y));",
"    float crack=smoothstep(0.030,0.0,abs(noise(u)-0.5))+0.6*smoothstep(0.035,0.0,abs(noise(u*2.7+7.0)-0.5));",
"    rock*=mix(1.0,(0.80+0.40*noise(u*0.6+3.0))*(1.0-0.5*min(crack,1.0)),det);",
"  }",
"  vec3 grass=mix(vec3(0.09,0.27,0.05),vec3(0.26,0.42,0.09),0.5*n1+fine*0.7);",
"  grass=mix(grass,vec3(0.50,0.47,0.20),smoothstep(TREE-0.1,SNOW,y));", /* thinner and yellower with height */
"  grass*=1.0+det2*0.5*(noise(vec2(dot(W,vec2(900.0,300.0)),dot(W,vec2(-90.0,270.0))))-0.5);", /* blades, close up */
"  grass+=det2*smoothstep(0.86,0.97,dB.x)*vec3(0.55,0.50,0.30);", /* flowers, only close up */
"  float veg=smoothstep(0.50,0.70,nT.y+det*0.16*(dA.x-0.5)+0.10*(fine-0.5))*smoothstep(SNOW+0.05,TREE,y);",
"  vec3 col=mix(rock,grass,veg)*grain;",
"  col=mix(col,vec3(0.035,0.11,0.045)*(0.55+0.9*mix(0.5,n3,near)+0.5*n2)*grain,Z.x*smoothstep(0.45,0.62,nT.y)*(1.0-0.5*smoothstep(2.2,1.3,t)));", /* forest: dark from afar, forest floor between the trees up close */
"  col=mix(col,vec3(0.55,0.52,0.42),smoothstep(WATER+0.006,WATER,p.y-th.x)*0.8);", /* gravel at the shore */
/* glaciers lie where the high ground is broad and gentle; they crack across the way they flow */
"  vec2 fl=normalize(nL.xz+vec2(0.0001));",
"  float gl=smoothstep(0.78,0.90,nL.y)*smoothstep(SNOW-0.42,SNOW-0.22,y)*smoothstep(0.45,0.7,nT.y);",
"  float cr=smoothstep(0.55,0.95,sin(dot(W,fl)*46.0+7.0*n2)*0.5+0.5)*(0.4+0.6*n1);",
"  col=mix(col,mix(vec3(0.72,0.86,0.95),vec3(0.20,0.50,0.72),cr),gl);",
"  float sn=smoothstep(-0.04,0.2,y-SNOW)*smoothstep(0.30,0.55,nT.y+0.25*smoothstep(0.0,0.5,y-SNOW));",
"  sn=max(sn*(1.0-0.55*gl),0.35*gl*(1.0-cr));",
"  vec3 snowc=vec3(0.93,0.95,1.0)*(1.0+0.12*det*(dA.x-0.5));",
"  col=mix(col,snowc,sn*(1.0-0.7*cr*gl));",
"  float thing=smoothstep(0.0,0.0004,th.x);",
"  if(thing>0.0){",
"    vec3 oc;",
"    float v1=fract(th.w*7.3),v2=fract(th.w*13.7),mot=0.75+0.5*mix(0.5,dA.x,det);",
"    if(th.y<1.2)oc=mix(mix(vec3(0.022,0.075,0.040),vec3(0.075,0.17,0.055),v2),vec3(0.17,0.21,0.06),step(0.88,v1))*(0.5+0.8*th.z)*mot;", /* conifer: darker low down, a few yellow-green ones */
"    else if(th.y<1.7)oc=mix(vec3(0.07,0.20,0.04),vec3(0.20,0.32,0.07),v2)*(0.6+0.6*th.z)*mot;", /* broadleaf tree */
"    else if(th.y<2.5){oc=mix(vec3(0.07,0.17,0.05),vec3(0.22,0.27,0.08),v2)*(0.6+0.6*th.z)*mot;",
"      oc=mix(oc,vec3(0.70,0.22,0.36),step(0.8,v1)*smoothstep(0.55,0.8,dA.x)*det);", /* some bushes are in flower */
"      oc=mix(vec3(0.45,0.43,0.40)*grain,oc,smoothstep(0.3,0.6,veg));}",
"    else oc=mix(mix(vec3(0.33,0.31,0.30),vec3(0.60,0.57,0.52),v2),vec3(0.36,0.40,0.22),0.35*smoothstep(0.5,0.8,n1))*grain;", /* stone, some with lichen */
"    oc=mix(oc,snowc,sn*smoothstep(0.35,0.8,n.y));",
"    col=mix(col,oc,thing);",
"  }else col*=1.0-0.35*Z.x*smoothstep(2.2,1.3,t);", /* the forest floor is in the trees' shade */
"  n=normalize(n+(vec3(dA.y,0.0,dA.z)*0.08*det*(1.0-0.6*sn)+vec3(dB.y,0.0,dB.z)*0.03*det2*(1.0-sn))*(th.y>0.5&&th.y<2.5?0.0:1.0));", /* small bumps catch the light */
/* one stream to each square of a coarse grid. It runs straight downhill from a point in the square:
   white and falling where the ground is steep, a blue thread where it is gentle. */
"  float wet=0.0,foam=0.0;",
"  if(mir<0.5){",
"    const float G=1.3;vec2 ci=floor(W/G);",
"    float hs=hash(ci+vec2(17.0,5.0));",
"    vec2 c=(ci+0.5+0.24*(vec2(hash(ci),hash(ci+vec2(41.0,3.0)))-0.5))*G-uPos.xz;",
"    float c0=terrL(c);vec2 gd=vec2(c0-terrL(c+vec2(0.06,0.0)),c0-terrL(c+vec2(0.0,0.06)));",
"    float gm=length(gd);",
"    if(hs>0.3&&gm>0.004){",
"      vec2 d=gd/gm,q=p.xz-c;",
"      float s=dot(q,vec2(-d.y,d.x))+(0.012+0.03*smoothstep(0.93,0.99,nL.y))*(sin(dot(q,d)*23.0+hs*40.0)+0.6*sin(dot(q,d)*9.0+hs*17.0)),al=dot(q,d);",
"      float w=0.006+0.0016*t+0.004*smoothstep(-0.3,0.4,al);",
"      float m=smoothstep(w,0.35*w,abs(s))*smoothstep(0.46*G,0.36*G,length(q))*smoothstep(0.0,0.5,dot(fl,d))*(1.0-smoothstep(0.0,0.1,y-SNOW))*(1.0-gl)*(1.0-thing);",
"      float steep=smoothstep(0.72,0.5,nT.y);",
"      float run=noise(vec2(s*420.0,al*22.0-uTime*(1.2+2.2*steep)));",
"      run=mix(run,0.5*run+0.5*noise(vec2(s*2600.0,al*140.0-uTime*(6.0+10.0*steep))),det);", /* finer froth, close up */
"      wet=m;foam=m*mix(0.25+0.35*run,0.75+0.25*run,steep);",
"      if(m>0.0)n=normalize(mix(n,nT,m));",
"    }",
"  }",
"  col=mix(col,vec3(0.10,0.30,0.42),wet);col=mix(col,vec3(0.95,0.97,1.0),foam);",
"  if(uTint>1.5){float lu=dot(col,vec3(0.3,0.59,0.11));col=mix(col,pal(uHue+0.25+1.1*lu+0.25*p.y)*(0.22+1.4*lu),0.9);}", /* tint everything: the land takes its colours from the palette too */
"  float dif=clamp(dot(n,uSun),0.0,1.0),sh=dif<=0.001?0.0:mir>0.5?1.0:shadow(p+nT*0.004+vec3(0.0,0.002,0.0));",
"  vec3 lin=dif*sh*gSun*1.4+(0.45+0.55*n.y)*gAmb*0.75+clamp(dot(n,normalize(vec3(-uSun.x,0.0,-uSun.z))),0.0,1.0)*vec3(0.20,0.17,0.12)*0.35;",
"  col*=lin*(0.45+0.55*cav);",
"  col+=gSun*sh*pow(max(dot(reflect(rd,n),uSun),0.0),24.0)*(0.25*sn+0.5*gl*cr+0.5*wet);",
"  return haze(col,tr,rd);",
"}"
].join("\n");
export const ALPS_COLS=[
"  gTop=vec3(0.14,0.36,0.80);gLow=vec3(0.66,0.79,0.94);gSun=uSunCol;gHaze=vec3(0.60,0.73,0.92);gAmb=vec3(0.19,0.27,0.42);"
].join("\n");
export const LAND_PRE_MAIN=[
"void main(){",
"  vec3 ro=vec3(0.0,uPos.y,0.0),rd=ray(gl_FragCoord.xy*uK);",
"  float r=uK*1.9/(sqrt(uRes.x*uRes.y)*uFov),t=0.02,tp=0.02,h=1.0;", /* the cone's half-width for each unit of distance */
"  for(int i=0;i<90;i++){",
"    vec3 p=ro+rd*t;",
"    float ny=0.45;", /* how much of the height above the land counts as clear distance: less where the land is steep */
"    if(h>0.5){h=p.y-terrU(p.xz);if(h<0.3)h=p.y-terrM(p.xz);}",
"    else{vec3 G=terrG(p.xz);h=p.y-G.z;ny=0.6*inversesqrt(1.0+dot(G.xy,G.xy));}",
"    float s=min(ny,0.42)*(h-(t<2.4?0.036:0.0))-r*t;", /* near the camera the land is treated as higher, to clear the trees */
"#ifdef EXTRAS",
"    s=min(s,extra(p)-r*t);",
"#endif",
"    if(s<=0.0){if(h<0.0)t=tp;break;}", /* a step that landed inside a cliff does not count */
"    if(t>70.0||(p.y>HMAX&&rd.y>0.0)){t=79.0;break;}",
"    tp=t;t+=s;",
"  }",
"  vec3 e=fract(clamp(t/80.0,0.0,0.99999)*vec3(1.0,255.0,65025.0));e.xy-=e.yz/255.0;", /* the distance, spread over three colour channels */
"  gl_FragColor=vec4(e,1.0);",
"}"].join("\n");

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get LFREQ(){return LFREQ}, get LPERIOD(){return LPERIOD}, get LAND_T(){return LAND_T}, get ALPS_SHAPE(){return ALPS_SHAPE}, get ALPS_SKY(){return ALPS_SKY}, get ALPS_ZONE(){return ALPS_ZONE},
  get ALPS_SHAPES(){return ALPS_SHAPES}, get ALPS_GROUND(){return ALPS_GROUND}, get ALPS_COLS(){return ALPS_COLS}, get LAND_PRE_MAIN(){return LAND_PRE_MAIN}};
