import { clock } from "./clock.js";
import { ALPS_COLS, ALPS_GROUND, ALPS_SHAPE, ALPS_SHAPES, ALPS_SKY, ALPS_ZONE, LAND_T, LFREQ } from "./land-shader.js";
import { landH, landHash } from "./land.js";
export let LK;
let CITY_S;

function stepShape(S,rise,from){ /* JavaScript and GLSL for a stepped shape */
  var f=function(v){return v.toFixed(4)};
  return {js:function(a){var h=rise*(a-from),i,t;for(i=0;i<S.length;i++){t=Math.max(0,Math.min(1,(a-S[i][0])/(S[i][1]-S[i][0])));h+=S[i][2]*t*t*(3-2*t);}return h;},
    gl:"float dss(float e0,float e1,float a){float t=clamp((a-e0)/(e1-e0),0.0,1.0);return 6.0*t*(1.0-t)/(e1-e0);}\n"+
      "float shape(float a){return "+f(rise)+"*(a-"+f(from)+")"+S.map(function(s){return "+"+f(s[2])+"*smoothstep("+f(s[0])+","+f(s[1])+",a)"}).join("")+";}\n"+
      "float dshape(float a){return "+f(rise)+S.map(function(s){return "+"+f(s[2])+"*dss("+f(s[0])+","+f(s[1])+",a)"}).join("")+";}\n"+
      "float shapeU(float a){return shape(a+0.047);}"};
}
/* Whether square (ix,iz) of the coarsest grid has an arch or a balanced rock, and the height it stands at: only where the
   ground under its two feet and its middle is level and dry. Returns null for none. landXTab() keeps the answers. */
function canyonCell(ix,iz){
  var Ar=landHash(ix+91,iz+37),Ag=landHash(ix+92,iz+37),Ab=landHash(ix+91,iz+38),Aa=landHash(ix+92,iz+38),fr=function(v){return v-Math.floor(v)};
  if(Ar<0.5)return null;
  var cx=(ix+0.35+0.3*Ag)/LFREQ,cz=(iz+0.35+0.3*Ab)/LFREQ,R=0.14+0.20*fr(Ar*7),an=6.2832*Aa,dx=Math.cos(an)*R,dz=Math.sin(an)*R;
  var ya=landH(cx+dx,cz+dz,6),yb=landH(cx-dx,cz-dz,6),yc=landH(cx,cz,6);
  return (Math.min(ya,yb)<LK[1].water+0.02||Math.max(ya,yb,yc)-Math.min(ya,yb,yc)>0.04)?null:Math.min(ya,yb);
}
function canyonExtra(x,y,z){ /* the same distance in JavaScript, so the camera can be kept out of the rock */
  var X=x*LFREQ,Z=z*LFREQ,ix=Math.floor(X),iz=Math.floor(Z),fx=X-ix,fz=Z-iz,fr=function(v){return v-Math.floor(v)};
  var far=Math.min(fx,1-fx,fz,1-fz)/LFREQ+0.5,base=LK[1].xh[(ix&255)+256*(iz&255)];
  if(base!==base)return far;
  var Ar=landHash(ix+91,iz+37),Ag=landHash(ix+92,iz+37),Ab=landHash(ix+91,iz+38),Aa=landHash(ix+92,iz+38);
  var qx=(fx-(0.35+0.3*Ag))/LFREQ,qz=(fz-(0.35+0.3*Ab))/LFREQ,yy=y-base,dl=Math.max(Math.hypot(qx,qz)-0.5,yy-0.75);
  if(dl>0.04)return Math.min(dl,far);
  var R=0.14+0.20*fr(Ar*7),r=R*(0.12+0.10*fr(Ar*13)),an=6.2832*Aa,dx=Math.cos(an),dz=Math.sin(an);
  var u=qx*dx+qz*dz,w=-qx*dz+qz*dx,bx,by,bz,m=function(v){return Math.max(v,0)}; /* the lumpiness is left out: its middle value is used */
  if(fr(Ar*29)>0.68){
    var H=0.07+0.12*Aa,stem=Math.max(Math.hypot(qx,qz)-0.018-0.010*Ag,yy-H);
    bx=Math.abs(u)-(0.022+0.03*Ab);by=Math.abs((yy-H-0.02)*1.3)-0.02;bz=Math.abs(w)-(0.02+0.02*Ag);
    return Math.min(stem,Math.min(Math.max(bx,by,bz),0)+Math.hypot(m(bx),m(by),m(bz))-0.012)*0.7;
  }
  yy-=0.35*R;
  var sy=0.75+0.6*Ag,ring=yy>0?Math.abs(Math.hypot(u,yy/sy)-R):Math.abs(Math.abs(u)-R),sm=Math.max(0,Math.min(1,(yy+R)/(2*R)));
  bx=ring-r*1.05*(1+0.4*sm*sm*(3-2*sm));by=Math.abs(w)-r*0.8;
  return (Math.min(Math.max(bx,by),0)+Math.hypot(m(bx),m(by))-0.2*r)*0.65;
}
function planetShape(a){var b=Math.max(a-0.75,0);return 0.25*(a-0.30)+3*b*b+0.018*Math.sin(70*a);}
function planetCell(ix,iz){ /* the ground under the middle of the shape floating over square (ix,iz), or null for none */
  if(landHash(ix+91,iz+37)<0.5)return null;
  return Math.max(landH((ix+0.35+0.3*landHash(ix+92,iz+37))/LFREQ,(iz+0.35+0.3*landHash(ix+91,iz+38))/LFREQ,6),LK[2].water);
}
function planetExtra(x,y,z){ /* the same in JavaScript, so the camera can be kept out of the shapes */
  var X=x*LFREQ,Z=z*LFREQ,ix=Math.floor(X),iz=Math.floor(Z),fx=X-ix,fz=Z-iz,fr=function(v){return v-Math.floor(v)},m=function(v){return Math.max(v,0)};
  var Ar=landHash(ix+91,iz+37),Ag=landHash(ix+92,iz+37),Ab=landHash(ix+91,iz+38),Aa=landHash(ix+92,iz+38);
  var far=Math.min(fx,1-fx,fz,1-fz)/LFREQ+0.5,base=LK[2].xh[(ix&255)+256*(iz&255)];
  if(base!==base)return far;
  var qx=(fx-(0.35+0.3*Ag))/LFREQ,qz=(fz-(0.35+0.3*Ab))/LFREQ,yy=y-base-0.30-0.5*Aa-0.03*Math.sin(clock.time*0.5+Aa*40),dl=Math.max(Math.hypot(qx,qz)-0.5,Math.abs(yy)-0.36);
  if(dl>0.04)return Math.min(dl,far);
  var an=6.2832*Aa+clock.time*0.2*(Ag-0.5),k=fr(Ar*29),s=0.07+0.10*fr(Ar*7),u=qx*Math.cos(an)+qz*Math.sin(an),w=-qx*Math.sin(an)+qz*Math.cos(an);
  if(k<0.4)return (Math.abs(u)+Math.abs(w)+0.5*Math.abs(yy)-s)*0.6;
  if(k<0.7){var R=0.16+0.16*fr(Ar*13);return Math.hypot(Math.hypot(u,yy)-R,w)-0.012-0.05*R;}
  var bx=Math.abs(u)-0.045*(0.6+4*s),by=Math.abs(yy)-0.20*(0.6+4*s),bz=Math.abs(w)-0.012*(0.6+4*s);
  return Math.min(Math.max(bx,by,bz),0)+Math.hypot(m(bx),m(by),m(bz));
}
/* ---------- landscapes that are not height fields: the steel ball and the city ----------
   These have their own short shaders, which find what a ray meets exactly, so they need no coarse first pass. They share
   the head of the land shader (the lens, the mirrors, the noise), the sky, and the tail of main. Both are mirrors: over a
   world they show the last frame of it, so for them the world is drawn whole, not only where the land leaves it showing. */
function landOwn(body,cols,hit){
  return LAND_T.slice(0,LAND_T.indexOf("@SHAPE")).join("\n").replace("@CONST","const float FREQ="+LFREQ.toFixed(4)+";")+"\n"+[
"float fbm(vec2 p){float a=0.0,b=0.5;for(int i=0;i<4;i++){a+=b*noise(p);b*=0.5;p=mat2(2.0,1.0,-1.0,2.0)*p;}return a;}",
ALPS_SKY,
"vec3 haze(vec3 col,float t,vec3 rd){",
"  vec3 fc=mix(gHaze,gSun,0.45*pow(max(dot(rd,uSun),0.0),5.0));",
"  return mix(col,fc,1.0-exp(-0.022*t));",
"}",
/* what a mirror shows along r: the sky, or, over a world, the last frame of it, folded back on itself where r leaves the screen */
"vec3 mirrorOf(vec3 r){",
"  if(uSky<0.5)return sky(r);",
"  vec3 cs=r*uCam;vec2 st=(cs.xy/max(abs(cs.z),0.2)*uFov*sqrt(uRes.x*uRes.y)+uRes)/(2.0*uRes);",
"  return pow(texture2D(uSkyT,abs(fract(st*0.5)*2.0-1.0)).rgb,vec3(2.2));",
"}",
body,
"void main(){",
"  vec3 ro=vec3(0.0,uPos.y,0.0),rd=ray(gl_FragCoord.xy);float alpha=1.0;",
cols,
"  if(uTint>0.5){",
"    vec3 pa=pal(uHue+0.55),pb=pal(uHue+0.2),pc=pal(uHue);",
"    gTop=mix(gTop,pa*0.75,0.85);gLow=mix(gLow,0.45+0.55*pb,0.85);gSun=mix(uSunCol,0.45+0.55*pc,0.5);gHaze=mix(gHaze,0.35+0.6*pb,0.85);gAmb=mix(gAmb,0.12+0.35*pa,0.55);",
"  }",
"  vec3 col=vec3(0.0);float t=-1.0;",
hit, /* sets col and t (the distance, or -1 for the sky) */
"  if(t>0.0)alpha=mix(1.0,exp(-0.03*t),0.8*uSky);",
"  else if(uSky<0.5)col=haze(sky(rd),90.0*(1.0-smoothstep(0.0,0.12,rd.y)),rd);",
"  else alpha=0.0;",
"  col=col*(2.51*col+0.03)/(col*(2.43*col+0.59)+0.14);",
"  col=pow(clamp(col,0.0,1.0),vec3(0.4545));",
"  col=mix(vec3(dot(col,vec3(0.3,0.59,0.11))),col,1.12);",
"  gl_FragColor=vec4(col*step(0.001,alpha),alpha);",
"}"].join("\n");
}
const EARTH_COLS="  gTop=vec3(0.14,0.36,0.80);gLow=vec3(0.66,0.79,0.94);gSun=uSunCol;gHaze=vec3(0.60,0.73,0.92);gAmb=vec3(0.19,0.27,0.42);";
/* The steel ball: one huge polished ball. The camera is always over its top, so its height above the ball is uPos.y and
   the horizon curves away on every side. Faint smudges and fine scratches slide past, which is what shows you are moving. */
const BALL_R=8;
function ballSrc(){return landOwn("","  gTop=vec3(0.14,0.36,0.80);gLow=vec3(0.66,0.79,0.94);gSun=uSunCol;gHaze=vec3(0.60,0.73,0.92);gAmb=vec3(0.19,0.27,0.42);",[
"  vec3 oc=ro+vec3(0.0,"+BALL_R.toFixed(1)+",0.0);float bb=dot(oc,rd),disc=bb*bb-dot(oc,oc)+"+(BALL_R*BALL_R).toFixed(1)+";",
"  if(disc>0.0&&bb<0.0){",
"    t=-bb-sqrt(disc);vec3 p=ro+rd*t,n=normalize(p+vec3(0.0,"+BALL_R.toFixed(1)+",0.0));",
"    vec2 W=p.xz+uPos.xz;float near=exp(-0.5*t);",
"    float smudge=fbm(W*FREQ*8.0),scr=noise(vec2(dot(W,vec2(310.0,95.0)),dot(W,vec2(-9.0,29.0))));", /* long thin scratches */
"    n=normalize(n+vec3(0.006*(scr-0.5)*near,0.0,0.004*(smudge-0.5)));",
"    float fr=0.52+0.48*pow(1.0-max(dot(-rd,n),0.0),5.0);", /* steel mirrors more at a glancing angle */
"    col=mirrorOf(reflect(rd,n))*fr*vec3(0.92,0.94,0.97)*(0.90+0.10*smudge)*(1.0-0.10*near*smoothstep(0.80,0.95,scr));",
"    if(uTint>1.5)col=mix(col,col*2.2*pal(uHue+0.3+0.4*smudge),0.75);",
"    col=haze(col,0.15*t,rd);",
"  }"].join("\n"));}
const CITY_RW=0.085;
function citySrc(){return landOwn([
"const float S="+CITY_S.toFixed(4)+",RW="+CITY_RW.toFixed(4)+",HTOP=1.80;",
"vec4 cA,cB,cC;vec3 bLo,bHi,uLo,uHi;float cPark;",
"void block(vec2 c){", /* the numbers for block c: its building's footprint and height, and whether it is a park */
"  vec2 b=uCi[0]*4.0+c;cA=texture2D(uN,(b+0.5)/256.0);cB=texture2D(uN,(b+vec2(57.5,113.5))/256.0);cC=texture2D(uN,(b+vec2(23.5,71.5))/256.0);",
"  float H=0.18+1.6*cA.r*cA.r,mx=RW+0.03+0.10*cB.r,mz=RW+0.03+0.10*cB.g;",
"  cPark=step(cB.a,0.10);",
"  bLo=vec3(c.x+mx,0.0,c.y+mz);bHi=vec3(c.x+1.0-mx,cA.r>0.55?H*(0.45+0.3*cB.b):H,c.y+1.0-mz);",
"  uLo=vec3(bLo.x+0.06,bHi.y,bLo.z+0.06);uHi=vec3(bHi.x-0.06,H,bHi.z-0.06);",
"}",
"vec3 gN;",
"float box(vec3 ro,vec3 rd,vec3 ird,vec3 lo,vec3 hi){", /* where the ray enters the box, or a huge number; gN is the face it enters by */
"  vec3 t0=(lo-ro)*ird,t1=(hi-ro)*ird,tn=min(t0,t1),tf=max(t0,t1);",
"  float a=max(max(tn.x,tn.y),tn.z),b=min(min(tf.x,tf.y),tf.z);",
"  if(a>b||a<0.0)return 1e9;",
"  gN=-sign(rd)*step(tn.yzx,tn.xyz)*step(tn.zxy,tn.xyz);return a;",
"}",
"vec3 hN;float hMat;vec2 hC;", /* what trace met: its face, what it is (0 ground, 1 building, 2 upper part, 3 to 6 a car), and its block */
"float trace(vec3 ro,vec3 rd,float cells){",
"  rd+=vec3(step(abs(rd),vec3(1e-5)))*2e-5;vec3 ird=1.0/rd;",
"  vec2 c=floor(ro.xz),sg=sign(rd.xz),tM=((c+max(sg,0.0))-ro.xz)*ird.xz,tD=abs(ird.xz);float tIn=0.0;",
"  for(int k=0;k<72;k++){",
"    if(float(k)>=cells)break;",
"    float tOut=min(tM.x,tM.y);",
"    if(min(ro.y+rd.y*tIn,ro.y+rd.y*tOut)<HTOP){",
"      block(c);float best=1e9,q;",
"      if(cPark<0.5){",
"        q=box(ro,rd,ird,bLo,bHi);if(q<best){best=q;hN=gN;hMat=1.0;}",
"        if(cA.r>0.55){q=box(ro,rd,ird,uLo,uHi);if(q<best){best=q;hN=gN;hMat=2.0;}}",
"      }",
"      if(min(ro.y+rd.y*tIn,ro.y+rd.y*tOut)<0.02){", /* low enough to meet a car */
"        vec3 e=vec3(0.030,0.008,0.013),m;",
"        if(fract(cC.r*7.0)>0.5){m=vec3(c.x+0.2+0.6*cC.r,0.008,c.y+0.045);q=box(ro,rd,ird,m-e,m+e);if(q<best){best=q;hN=gN;hMat=3.0;}}",
"        if(fract(cC.g*7.0)>0.5){m=vec3(c.x+0.045,0.008,c.y+0.2+0.6*cC.g);q=box(ro,rd,ird,m-e.zyx,m+e.zyx);if(q<best){best=q;hN=gN;hMat=4.0;}}",
"        if(fract(cC.b*7.0)>0.5){m=vec3(c.x+0.2+0.6*cC.b,0.008,c.y+0.955);q=box(ro,rd,ird,m-e,m+e);if(q<best){best=q;hN=gN;hMat=5.0;}}",
"        if(fract(cC.a*7.0)>0.5){m=vec3(c.x+0.955,0.008,c.y+0.2+0.6*cC.a);q=box(ro,rd,ird,m-e.zyx,m+e.zyx);if(q<best){best=q;hN=gN;hMat=6.0;}}",
"      }",
"      if(rd.y<0.0){q=-ro.y/rd.y;if(q<=tOut&&q<best){best=q;hN=vec3(0.0,1.0,0.0);hMat=0.0;}}",
"      if(best<1e8){hC=c;return best;}",
"    }else if(rd.y>0.0)return -1.0;",
"    if(tM.x<tM.y){c.x+=sg.x;tIn=tM.x;tM.x+=tD.x;}else{c.y+=sg.y;tIn=tM.y;tM.y+=tD.y;}",
"  }",
"  return -2.0;", /* still going after the last block: lost in the haze */
"}",
"vec3 shade(vec3 p,vec3 rd,float t){", /* p in block units; t the distance in ordinary units */
"  vec3 n=hN;float mat=hMat;vec2 c=hC,f=p.xz-c;block(c);",
"  float px=t*S*2.0/(uFov*sqrt(uRes.x*uRes.y));", /* how wide a pixel is here, to fade out patterns finer than that */
"  vec3 col;float gloss=0.0;",
"  if(mat<0.5){", /* the ground: road, pavement or park */
"    vec2 e=min(f,1.0-f);float d=min(e.x,e.y),crs=max(e.x,e.y);",
"    if(d<RW){",
"      col=vec3(0.085,0.088,0.095)*(0.85+0.3*noise(p.xz*60.0));",
"      float al=e.x<e.y?f.y:f.x,road=step(RW+0.02,crs),fade=1.0-smoothstep(0.5,2.0,px/0.004);",
"      col=mix(col,vec3(0.80,0.66,0.20),road*fade*smoothstep(0.004,0.002,d)*step(0.5,fract(al*14.0)));", /* dashes down the middle */
"      col=mix(col,vec3(0.75),road*fade*smoothstep(0.003,0.0015,abs(d-RW+0.008)));", /* a line at each kerb */
"      col=mix(col,vec3(0.75),fade*step(crs,RW+0.02)*step(RW-0.03,crs)*step(0.5,fract(d*70.0))*step(0.012,d));", /* crossings at the corners */
"    }else if(cPark>0.5){",
"      float tr=smoothstep(0.55,0.62,noise(p.xz*46.0)+0.25*noise(p.xz*17.0+3.0));", /* trees seen from above */
"      col=mix(mix(vec3(0.16,0.30,0.08),vec3(0.27,0.40,0.11),noise(p.xz*9.0)),vec3(0.05,0.15,0.05),tr);",
"      col=mix(col,vec3(0.55,0.52,0.45),smoothstep(0.012,0.006,abs(abs(f.x-0.5)-abs(f.y-0.5))));", /* paths corner to corner */
"    }else{",
"      vec2 g=abs(fract(p.xz*55.0)-0.5);",
"      col=vec3(0.44,0.43,0.41)*(0.92+0.16*noise(p.xz*30.0))*(1.0-0.25*smoothstep(0.44,0.5,max(g.x,g.y))*(1.0-smoothstep(0.5,2.0,px/0.018)));", /* paving slabs */
"      vec2 w=max(bLo.xz-p.xz,p.xz-bHi.xz);col*=0.65+0.35*smoothstep(0.0,0.03,max(w.x,w.y));", /* darker against the wall */
"    }",
"  }else if(mat<2.5){", /* a building */
"    float sty=fract(cA.r*17.0+cB.b*5.0),hue=fract(cB.r*9.0+cA.g*3.0);",
"    vec3 tint=sty<0.5?mix(mix(vec3(0.55,0.75,0.95),vec3(0.55,0.90,0.80),step(0.4,hue)),vec3(0.95,0.78,0.55),step(0.8,hue)):vec3(1.0);", /* glass: blue, green or bronze */
"    vec3 wall=sty<0.5?vec3(0.10,0.11,0.12):mix(mix(vec3(0.62,0.58,0.50),vec3(0.42,0.43,0.45),step(0.35,hue)),vec3(0.48,0.24,0.17),step(0.75,hue));", /* stone, concrete or brick */
"    if(n.y>0.5){", /* the roof: gravel, a raised edge, and a few machines */
"      vec2 lo=mat<1.5?bLo.xz:uLo.xz,hi=mat<1.5?bHi.xz:uHi.xz,w=min(p.xz-lo,hi-p.xz);",
"      col=vec3(0.30,0.30,0.31)*(0.85+0.3*noise(p.xz*80.0));",
"      col=mix(col,vec3(0.50),smoothstep(0.012,0.008,min(w.x,w.y)));",
"      col=mix(col,vec3(0.16,0.17,0.18),step(0.72,noise(floor(p.xz*22.0)*1.37+cA.r*40.0))*step(0.03,min(w.x,w.y)));",
"    }else{",
"      float u=abs(n.x)>0.5?p.z:p.x;vec2 wq=vec2(u*46.0,p.y*34.0),wf=fract(wq);",
"      float pane=sty<0.5?step(0.07,wf.x)*step(0.12,wf.y):step(0.22,wf.x)*step(wf.x,0.78)*step(0.25,wf.y)*step(wf.y,0.80);",
"      float far=smoothstep(0.12,0.5,px/0.022),rnd=mix(hash(floor(wq)+c*7.0),0.5,far);",
"      pane=mix(pane,sty<0.5?0.82:0.31,far);",
"      vec3 rr=reflect(rd,normalize(n+0.04*(1.0-far)*vec3(rnd-0.5,fract(rnd*7.0)-0.5,fract(rnd*13.0)-0.5)));", /* each pane leans a little, which breaks the mirrored picture up */
"      rr.y=abs(rr.y);",
"      float fr=0.35+0.65*pow(1.0-max(dot(-rd,n),0.0),3.0);",
"      vec3 glass=mirrorOf(rr)*tint*fr+vec3(0.02,0.03,0.04)*(0.5+rnd);",
"      col=mix(wall*(0.9+0.2*noise(vec2(u*9.0,p.y*9.0))),glass,pane);gloss=pane;",
"      if(p.y<0.035)col=mix(wall*0.5,glass,step(0.12,fract(u*9.0))*step(0.005,p.y)*step(p.y,0.030));", /* shop fronts at street level */
"      col*=0.6+0.4*smoothstep(0.0,0.12,p.y);",
"    }",
"  }else{", /* a car: paintwork, with dark glass round the top half */
"    float k=mat<3.5?cC.r:mat<4.5?cC.g:mat<5.5?cC.b:cC.a,v=fract(k*23.0);",
"    col=v<0.25?vec3(0.80,0.82,0.84):v<0.45?vec3(0.05,0.05,0.06):v<0.6?vec3(0.55,0.06,0.05):v<0.75?vec3(0.08,0.18,0.45):v<0.9?vec3(0.45,0.47,0.50):vec3(0.85,0.65,0.08);",
"    float al=(mat<3.5||(mat>4.5&&mat<5.5))?f.x-0.2-0.6*k:f.y-0.2-0.6*k;",
"    if(p.y>0.009&&abs(al)<0.017)col=mix(col,vec3(0.03,0.04,0.05),n.y>0.5?step(0.011,abs(al)):1.0);",
"    gloss=0.5;",
"  }",
"  if(uTint>1.5){float lu=dot(col,vec3(0.3,0.59,0.11));col=mix(col,pal(uHue+0.25+1.1*lu+0.2*p.y)*(0.22+1.4*lu),0.85);}",
"  float dif=clamp(dot(n,uSun),0.0,1.0),sh=dif<=0.001?0.0:(trace(p+n*0.002,uSun,16.0)>-0.5?0.0:1.0);",
"  vec3 lin=dif*sh*gSun*1.4+(0.5+0.5*n.y)*gAmb*0.9+(0.5-0.5*n.y)*vec3(0.10,0.09,0.08);",
"  col=col*mix(lin,vec3(1.0),0.7*gloss)+gSun*sh*gloss*pow(max(dot(reflect(rd,n),uSun),0.0),60.0);", /* glass shows what it mirrors, lit or not */
"  return haze(col,t,rd);",
"}"].join("\n"),EARTH_COLS.replace("gHaze=vec3(0.60,0.73,0.92)","gHaze=vec3(0.66,0.72,0.82)"),[
"  vec3 cro=vec3(uCf[0].x*4.0,ro.y*S,uCf[0].y*4.0);",
"  float tc=trace(cro,rd,72.0);",
"  if(tc>-0.5){t=tc/S;col=shade(cro+rd*tc,rd,t);}",
"  else if(tc<-1.5){t=72.0/S;col=haze(vec3(0.2),t,rd);}"].join("\n"));}
/* the same blocks in JavaScript: the height of the building at a place (for steering round the tall ones) and the
   distance to it (for keeping the camera out). Both in ordinary units. */
function cityBlock(ci,cj){
  var a=landHash(ci,cj),br=landHash(ci+57,cj+113),bg=landHash(ci+58,cj+113),bb=landHash(ci+57,cj+114),ba=landHash(ci+58,cj+114);
  var H=0.18+1.6*a*a;
  return {park:ba<=0.10,H:H,Hl:a>0.55?H*(0.45+0.3*bb):H,mx:CITY_RW+0.03+0.10*br,mz:CITY_RW+0.03+0.10*bg};
}
function cityH(x,z){
  var X=x*CITY_S,Z=z*CITY_S,ci=Math.floor(X),cj=Math.floor(Z),B=cityBlock(ci,cj),fx=X-ci,fz=Z-cj;
  return (B.park||fx<B.mx||fx>1-B.mx||fz<B.mz||fz>1-B.mz)?0:B.H/CITY_S;
}
function cityExtra(x,y,z){
  var X=x*CITY_S,Y=y*CITY_S,Z=z*CITY_S,ci=Math.floor(X),cj=Math.floor(Z),B=cityBlock(ci,cj),fx=X-ci,fz=Z-cj,m=function(v){return Math.max(v,0)};
  var far=(Math.min(fx,1-fx,fz,1-fz)+CITY_RW+0.03)/CITY_S;
  if(B.park)return far;
  var bx=Math.abs(fx-0.5)-(0.5-B.mx),bz=Math.abs(fz-0.5)-(0.5-B.mz),by=Y-B.Hl;
  var d=Math.min(Math.max(bx,by,bz),0)+Math.hypot(m(bx),m(by),m(bz));
  if(B.Hl<B.H){bx+=0.06;bz+=0.06;by=Y-B.H;d=Math.min(d,Math.min(Math.max(bx,by,bz),0)+Math.hypot(m(bx),m(by),m(bz)));}
  return Math.min(d/CITY_S,far);
}
export function landSrc(k){
  var K=LK[k],g=K.gl,f=function(v){return v.toFixed(4)};
  g.CONST="const float FREQ="+f(LFREQ)+",WATER="+f(K.water)+",HMAX="+f(K.hmax)+",FLUTE="+f(K.flute)+","+K.defs+";\nconst int SHN="+(K.shn||36)+";\n"+K.wat+(K.extra?"\n#define EXTRAS":"");
  return LAND_T.map(function(l){return l.charAt(0)==="@"?g[l.slice(1)]:l}).join("\n");
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- canyon country: a plateau cut by gorges, with mesas, buttes, arches and balanced rocks ----------
   The same noise as the Alps, but its height is turned into steps: each step is a cliff, and the gentle rise between
   steps is a bench. CANYON_STEPS lists them as [where the cliff begins, where it ends, how high it is], in the noise's own
   units. The shader text and the JavaScript are both made from this one list. */
var CANYON_STEPS=[[0.30,0.36,0.08],[0.375,0.425,0.14],[0.46,0.50,0.10],[0.515,0.545,0.08],[0.74,0.82,0.06],[0.80,0.84,0.16],[0.855,0.885,0.22],[0.93,0.97,0.14],[1.03,1.07,0.12]];
var CANYON_SHAPE=stepShape(CANYON_STEPS,0.4,0.30);
/* Free-standing rock, which a height cannot describe because it has air underneath: an arch or a balanced rock, at most
   one to each square of the coarsest noise grid. extra() is the distance to it; far from one, it is a safe smaller distance. */
var CANYON_EXTRA=[
"float extra(vec3 p){",
"  vec2 x=uCf[0]+p.xz*FREQ,i=floor(x),f=x-i;",
"  vec4 B=texture2D(uX,(uCi[0]+i+0.5)/256.0);", /* worked out once in JavaScript: whether this square has a shape, and the height of the ground it stands on */
"  float far=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y))/FREQ+0.5;", /* shapes keep this far inside their own square, so a ray is not slowed where it crosses from square to square */
"  if(B.b<0.5)return far;",
"  vec4 A=texture2D(uN,(uCi[0]+i+vec2(91.5,37.5))/256.0);",
"  vec2 q=(f-(0.35+0.3*A.gb))/FREQ;", /* offset from the middle of the shape */
"  float y=p.y-((B.r*65280.0+B.g*255.0)/13107.0-0.5),dl=max(length(q)-0.5,y-0.75);", /* nothing reaches further out than this, or higher */
"  if(dl>0.04)return min(dl,far);",
"  float R=0.14+0.20*fract(A.r*7.0),r=R*(0.12+0.10*fract(A.r*13.0)),an=6.2832*A.a;",
"  vec2 d=vec2(cos(an),sin(an));",
"  float u=dot(q,d),w=dot(q,vec2(-d.y,d.x));",
"  float lump=noise(vec2(u*14.0+A.a*40.0,y*14.0+w*9.0));", /* uneven, so it reads as weathered rock */
"  if(fract(A.r*29.0)>0.68){", /* a balanced rock: a thin stem with a wider block on top */
"    float H=0.07+0.12*A.a;",
"    float stem=max(length(q)-0.012-0.010*A.g-0.012*lump,y-H);",
"    vec3 c=abs(vec3(u,(y-H-0.02)*1.3,w))-vec3(0.022+0.03*A.b,0.02,0.02+0.02*A.g)*(0.7+0.6*lump);",
"    return min(stem,min(max(c.x,max(c.y,c.z)),0.0)+length(max(c,0.0))-0.012)*0.7;",
"  }",
"  y-=0.35*R;", /* an arch: half a ring on two legs, tall or flat, with a squared-off section */
"  float sy=0.75+0.6*A.g,ring=y>0.0?abs(length(vec2(u,y/sy))-R):abs(abs(u)-R);",
"  vec2 b=vec2(ring-r*(0.8+0.5*lump)*(1.0+0.4*smoothstep(-R,R,y)),abs(w)-r*(0.55+0.5*lump));",
"  return (min(max(b.x,b.y),0.0)+length(max(b,0.0))-0.2*r)*0.65;",
"}"].join("\n");
var CANYON_ZONE=[
"vec3 zone(vec2 q,vec3 G,out float yv){", /* x trees, y brush, z stony; G must be terrG(q) */
"  vec2 W=q+uPos.xz,g=G.xy;float hgt=G.z;",
"  float ny=inversesqrt(1.0+dot(g,g)),n1=noise(W*FREQ*5.0+3.0),n2=noise(W*FREQ*17.0);",
"  yv=hgt;",
"  float dry=smoothstep(WATER+0.003,WATER+0.012,hgt),lvl=smoothstep(0.70,0.88,ny);",
"  float rip=smoothstep(WATER+0.07,WATER+0.02,hgt);", /* green only near the river */
"  float trees=dry*lvl*(0.75*rip+0.10*smoothstep(0.45,0.7,n1));",
"  float brush=dry*lvl*min(0.3+0.7*rip+0.5*n2,1.0);",
"  float stony=dry*(0.9*smoothstep(0.40,0.60,ny)*(1.0-smoothstep(0.62,0.85,ny))+0.12*lvl);", /* fallen rock lies on the slopes under the cliffs, not on the cliffs */
"  return vec3(trees,brush,clamp(stony,0.0,1.0));",
"}"].join("\n");
var CANYON_GROUND=[
/* the colour of the rock at height y: level bands of red, orange, cream and dark red, a little wavy */
"vec3 strata(float y,vec2 W){",
"  float yy=y+0.035*(noise(W*FREQ*4.0)-0.5);",
"  vec3 col=mix(vec3(0.50,0.19,0.09),vec3(0.80,0.42,0.19),noise(vec2(yy*21.0,3.5)));",
"  col=mix(col,vec3(0.87,0.70,0.50),0.8*smoothstep(0.55,0.75,noise(vec2(yy*67.0,11.5))));",
"  col=mix(col,vec3(0.30,0.12,0.09),0.7*smoothstep(0.62,0.80,noise(vec2(yy*38.0,41.5))));",
"  return col*(0.86+0.28*noise(vec2(yy*190.0,27.5)));",
"}",
"vec3 ground(vec3 p,float tr,vec3 rd,float mir){",
"  float t=tr+100.0*mir;",
"  float det=smoothstep(1.6,0.25,t),det2=smoothstep(0.22,0.05,t);",
"  float e=max(0.00025,0.0011*tr),yv;vec3 G=terrG(p.xz);float gM=G.z;",
"  vec3 Z=zone(p.xz,G,yv);",
"  float h0=terrD(p.xz,det),hx=terrD(p.xz+vec2(e,0.0),det),hz=terrD(p.xz+vec2(0.0,e),det);",
"  vec3 nT=normalize(vec3(h0-hx,e,h0-hz));",
"  vec4 th=things(p.xz,Z,t);",
"  vec3 n=nT;",
"  if(t<2.2)n=normalize(vec3(h0+th.x-hx-things(p.xz+vec2(e,0.0),Z,t).x,e,h0+th.x-hz-things(p.xz+vec2(0.0,e),Z,t).x));",
"  vec2 W=p.xz+uPos.xz;",
"  vec3 dA=det>0.0?noised(uDa.xy,uDa.zw+p.xz*FREQ*429.0):vec3(0.5,0.0,0.0),dB=det2>0.0?noised(uDb.xy,uDb.zw+p.xz*FREQ*2571.0):vec3(0.5,0.0,0.0);",
"  float n1=noise(W*FREQ*5.0+3.0),n2=noise(W*FREQ*17.0),fine=fbm(W*FREQ*66.0),cav=clamp(0.55+30.0*(h0-gM),0.0,1.0);",
"  float grain=1.0+det*0.45*(dA.x-0.5)+det2*0.4*(dB.x-0.5);",
"  float lvl=smoothstep(0.60,0.86,nT.y+0.08*(fine-0.5));", /* 1 on level ground, 0 on a cliff */
"  vec3 rock=strata(p.y,W);",
"  vec2 fw=normalize(nT.xz+vec2(0.0001));float along=dot(W,vec2(-fw.y,fw.x));",
"  rock*=1.0-0.30*(1.0-lvl)*smoothstep(0.50,0.80,noise(vec2(along*30.0,p.y*9.0+3.0)));", /* dark streaks run down the cliffs */
"  grain=mix(1.0+det*0.5*(noise(vec2(along*150.0,p.y*150.0))-0.5)+det2*0.4*(noise(vec2(along*900.0,p.y*900.0))-0.5),grain,smoothstep(0.35,0.6,nT.y));", /* on a cliff the grain is laid out across and up the face; laid out over the ground it would smear down it */
"  if(det>0.0){", /* close up the rock is jointed: upright cracks on the cliffs, a crazed pattern on the flat */
"    vec2 u=mix(W*38.0,vec2(along*26.0,p.y*55.0+dot(W,fw)*9.0),smoothstep(0.75,0.5,nT.y));",
"    float crack=smoothstep(0.030,0.0,abs(noise(u)-0.5))+0.6*smoothstep(0.035,0.0,abs(noise(u*2.7+7.0)-0.5));",
"    rock*=mix(1.0,(0.80+0.40*noise(u*0.6+3.0))*(1.0-0.5*min(crack,1.0)),det);",
"  }",
"  vec3 sand=mix(vec3(0.70,0.40,0.22),vec3(0.86,0.60,0.38),0.6*n1+0.5*fine);",
"  sand*=1.0+det2*0.25*sin(dot(W,vec2(700.0,260.0))+6.0*dB.x);", /* wind ripples, close up */
"  vec3 col=mix(rock,sand,lvl*(0.55+0.45*n2))*grain;",
"  float rip=smoothstep(WATER+0.06,WATER+0.012,p.y)*lvl;",
"  col=mix(col,mix(vec3(0.14,0.28,0.06),vec3(0.36,0.42,0.12),n2)*grain*(1.0+det2*0.5*(noise(vec2(dot(W,vec2(900.0,300.0)),dot(W,vec2(-90.0,270.0))))-0.5)),0.85*rip);", /* grass by the river */
"  col=mix(col,vec3(0.55,0.50,0.26)*grain,0.35*lvl*(1.0-rip)*smoothstep(0.55,0.75,n2+0.3*(dA.x-0.5)*det));", /* dry grass in patches */
"  col=mix(col,vec3(0.42,0.28,0.18),smoothstep(WATER+0.006,WATER,p.y-th.x)*0.8);", /* wet mud at the bank */
"  float thing=smoothstep(0.0,0.0004,th.x);",
"  if(thing>0.0){",
"    vec3 oc;",
"    float v1=fract(th.w*7.3),v2=fract(th.w*13.7),mot=0.75+0.5*mix(0.5,dA.x,det),wet=smoothstep(WATER+0.09,WATER+0.03,p.y);",
"    if(th.y<1.7)oc=mix(mix(vec3(0.07,0.11,0.045),vec3(0.13,0.17,0.06),v2),mix(vec3(0.10,0.26,0.05),vec3(0.26,0.38,0.08),v2),wet)*(0.55+0.7*th.z)*mot;", /* juniper on the dry ground, greener trees by the river */
"    else if(th.y<2.5){oc=mix(mix(vec3(0.23,0.27,0.19),vec3(0.36,0.38,0.24),v2),vec3(0.14,0.30,0.07),wet)*(0.6+0.6*th.z)*mot;",
"      oc=mix(oc,vec3(0.78,0.62,0.12),step(0.8,v1)*smoothstep(0.55,0.8,dA.x)*det);}", /* sagebrush, some in yellow flower */
"    else oc=rock*(0.75+0.5*v2)*grain;", /* fallen rock, the colour of the cliff it came from */
"    col=mix(col,oc,thing);",
"  }",
"  n=normalize(n+(vec3(dA.y,0.0,dA.z)*0.08*det+vec3(dB.y,0.0,dB.z)*0.03*det2)*(th.y>0.5&&th.y<2.5?0.0:1.0)*smoothstep(0.35,0.6,nT.y));",
"  if(uTint>1.5){float lu=dot(col,vec3(0.3,0.59,0.11));col=mix(col,pal(uHue+0.25+1.1*lu+0.25*p.y)*(0.22+1.4*lu),0.9);}",
"  float dif=clamp(dot(n,uSun),0.0,1.0),sh=dif<=0.001?0.0:mir>0.5?1.0:shadow(p+nT*0.004+vec3(0.0,0.002,0.0));",
"  vec3 lin=dif*sh*gSun*1.4+(0.45+0.55*n.y)*gAmb*0.75+(clamp(dot(n,normalize(vec3(-uSun.x,0.0,-uSun.z))),0.0,1.0)+0.5*(1.0-n.y))*vec3(0.34,0.17,0.08)*0.45;", /* red light thrown back by the sunlit ground */
"  col*=lin*(0.45+0.55*cav);",
"  return haze(col,tr,rd);",
"}"].join("\n");
var CANYON_XCOL=[
"vec3 xcol(vec3 p,float t,vec3 rd){", /* the colour of an arch or a balanced rock */
"  vec2 e=vec2(0.0015+0.0008*t,0.0),W=p.xz+uPos.xz;",
"  vec3 n=normalize(vec3(extra(p+e.xyy)-extra(p-e.xyy),extra(p+e.yxy)-extra(p-e.yxy),extra(p+e.yyx)-extra(p-e.yyx)));",
"  float gr=fbm(vec2(W.x*40.0+p.y*31.0,W.y*40.0-p.y*17.0));",
"  n=normalize(n+0.35*(vec3(noise(W.xy*90.0+p.y*70.0),noise(W.yx*80.0-p.y*60.0),noise(W*70.0+p.y*90.0))-0.5)*smoothstep(1.5,0.2,t));",
"  vec3 col=strata(p.y+0.02*(gr-0.5),W)*(0.75+0.5*gr)*(0.72+0.56*noise(vec2(W.x*300.0+p.y*170.0,W.y*300.0-p.y*210.0)));",
"  col*=1.0-0.4*(1.0-abs(n.y))*smoothstep(0.5,0.8,noise(vec2((W.x+W.y)*30.0,p.y*5.0+3.0)));",
"  if(uTint>1.5){float lu=dot(col,vec3(0.3,0.59,0.11));col=mix(col,pal(uHue+0.25+1.1*lu+0.25*p.y)*(0.22+1.4*lu),0.9);}",
"  float dif=clamp(dot(n,uSun),0.0,1.0),sh=dif<=0.001?0.0:shadow(p+n*0.01);",
"  vec3 lin=dif*sh*gSun*1.4+(0.45+0.55*n.y)*gAmb*0.75+(clamp(dot(n,normalize(vec3(-uSun.x,0.0,-uSun.z))),0.0,1.0)+0.7*(1.0-n.y))*vec3(0.34,0.17,0.08)*0.45;",
"  return haze(col*lin,t,rd);",
"}"].join("\n");
/* ---------- a strange planet: needle spires over rippled plains, glowing pools, and shapes that hang in the air ----------
   The same noise again. The plains carry ripples that follow the contours, the high ground rises into needles, veins of
   light run through the soil, and what grows there glows. A crystal, a ring or a slab floats over many of the squares. */
var PLANET_SHAPE=[
"float shape(float a){float b=max(a-0.75,0.0);return 0.25*(a-0.30)+3.0*b*b+0.018*sin(70.0*a);}",
"float dshape(float a){return 0.25+6.0*max(a-0.75,0.0)+1.26*cos(70.0*a);}",
"float shapeU(float a){float b=max(a-0.703,0.0);return 0.25*(a-0.253)+3.0*b*b+0.018;}"
].join("\n");
var PLANET_EXTRA=[
"float extra(vec3 p){",
"  vec2 x=uCf[0]+p.xz*FREQ,i=floor(x),f=x-i;",
"  vec4 B=texture2D(uX,(uCi[0]+i+0.5)/256.0);",
"  float far=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y))/FREQ+0.5;",
"  if(B.b<0.5)return far;",
"  vec4 A=texture2D(uN,(uCi[0]+i+vec2(91.5,37.5))/256.0);",
"  vec2 q=(f-(0.35+0.3*A.gb))/FREQ;",
"  float y=p.y-((B.r*65280.0+B.g*255.0)/13107.0-0.5)-0.30-0.5*A.a-0.03*sin(uTime*0.5+A.a*40.0);", /* it hangs above the ground and rises and falls slowly */
"  float dl=max(length(q)-0.5,abs(y)-0.36);", /* nothing reaches further out than this, or further up or down */
"  if(dl>0.04)return min(dl,far);",
"  float an=6.2832*A.a+uTime*0.2*(A.g-0.5),k=fract(A.r*29.0),s=0.07+0.10*fract(A.r*7.0);", /* and turns slowly */
"  vec2 d=vec2(cos(an),sin(an));",
"  float u=dot(q,d),w=dot(q,vec2(-d.y,d.x));",
"  if(k<0.4)return (abs(u)+abs(w)+0.5*abs(y)-s)*0.6;", /* a crystal: two pyramids base to base */
"  if(k<0.7){float R=0.16+0.16*fract(A.r*13.0);return length(vec2(length(vec2(u,y))-R,w))-0.012-0.05*R;}", /* a ring standing on edge */
"  vec3 b=abs(vec3(u,y,w))-vec3(0.045,0.20,0.012)*(0.6+4.0*s);", /* a thin upright slab */
"  return min(max(b.x,max(b.y,b.z)),0.0)+length(max(b,0.0));",
"}"].join("\n");
var PLANET_SKY=[
"vec3 sky(vec3 rd){", /* a dark sky with stars, and a ringed planet hanging in it */
"  float y=max(rd.y,0.0),s=max(dot(rd,uSun),0.0);",
"  vec3 c=mix(gLow,gTop,pow(y,0.45));",
"  c=mix(c,gSun,0.3*pow(s,8.0)*(1.0-y));",
"  vec2 sp=rd.xz/(1.0+y)*48.0,sf=fract(sp)-0.5;float st=hash(floor(sp));",
"  c+=vec3(0.85,0.92,1.0)*step(0.93,st)*smoothstep(0.22,0.0,length(sf))*smoothstep(0.08,0.5,rd.y)*fract(st*37.0);",
"  vec3 pd=vec3(-0.196,0.343,0.919),px=normalize(cross(pd,vec3(0.0,1.0,0.0))),py=cross(px,pd);float pz=dot(rd,pd);",
"  if(pz>0.2){",
"    vec2 q=vec2(dot(rd,px),dot(rd,py))/pz,qr=mat2(0.94,0.34,-0.34,0.94)*q;",
"    float dq=length(q),rr=length(vec2(qr.x,qr.y*3.6)),disc=smoothstep(0.30,0.29,dq);",
"    float ring=smoothstep(0.40,0.43,rr)*smoothstep(0.74,0.70,rr)*(0.55+0.45*sin(rr*110.0));",
"    vec3 pc=mix(vec3(0.90,0.55,0.32),vec3(0.50,0.26,0.46),0.5+0.5*sin(qr.y*46.0+2.5*sin(qr.x*7.0)));",
"    float lit=clamp(0.55+1.5*(0.8*q.x+0.45*q.y)/0.30,0.04,1.0);",
"    c=mix(c,pc*lit+0.3*c,disc);",
"    c=mix(c,vec3(0.95,0.82,0.70),0.65*ring*(1.0-disc*step(0.0,qr.y)));",
"  }",
"  vec3 md=vec3(0.78,0.52,-0.35);float mm=dot(rd,md);", /* a small moon */
"  c=mix(c,vec3(0.75,0.80,0.90)*clamp(0.3+60.0*dot(rd-md,uSun),0.08,1.0),smoothstep(0.9990,0.9992,mm));",
"  return c+gSun*(0.9*pow(s,900.0)+0.25*pow(s,40.0));",
"}"].join("\n");
/* what grows there: thin horns that flare at the foot, and smooth round bulbs. The small growths and crystals reuse the bush and the boulder. */
var PLANET_SHAPES=ALPS_SHAPES.replace('  return broad>0.5?0.5*sqrt(max(1.0-d*d,0.0))*(1.0+0.25*sin(v.x*9.0+R.g*20.0)*sin(v.y*8.0+R.b*20.0)):max(1.0-d,0.0)*(0.8+0.2*smoothstep(0.0,0.6,1.0-d));',
  "  return broad>0.5?0.42*sqrt(max(1.0-1.6*dot(v,v),0.0)):pow(max(1.0-d,0.0),1.7);");
var PLANET_ZONE=[
"vec3 zone(vec2 q,vec3 G,out float yv){", /* x horns and bulbs, y small growths, z crystals; G must be terrG(q) */
"  vec2 W=q+uPos.xz,g=G.xy;float hgt=G.z;",
"  float ny=inversesqrt(1.0+dot(g,g)),n1=noise(W*FREQ*5.0+3.0),n2=noise(W*FREQ*17.0);",
"  yv=hgt;",
"  float dry=smoothstep(WATER+0.003,WATER+0.012,hgt),lvl=smoothstep(0.62,0.85,ny);",
"  float grove=dry*lvl*smoothstep(0.52,0.70,0.7*noise(W*FREQ*7.0+11.0)+0.3*n2);",
"  return vec3(0.7*grove,dry*lvl*(1.0-0.6*grove),clamp(dry*(0.25+0.6*(1.0-lvl)),0.0,1.0));",
"}"].join("\n");
var PLANET_GROUND=[
"vec3 ground(vec3 p,float tr,vec3 rd,float mir){",
"  float t=tr+100.0*mir;",
"  float det=smoothstep(1.6,0.25,t),det2=smoothstep(0.22,0.05,t);",
"  float e=max(0.00025,0.0011*tr),yv;vec3 G=terrG(p.xz);float gM=G.z;",
"  vec3 Z=zone(p.xz,G,yv);",
"  float h0=terrD(p.xz,det),hx=terrD(p.xz+vec2(e,0.0),det),hz=terrD(p.xz+vec2(0.0,e),det);",
"  vec3 nT=normalize(vec3(h0-hx,e,h0-hz));",
"  vec4 th=things(p.xz,Z,t);",
"  vec3 n=nT;",
"  if(t<2.2)n=normalize(vec3(h0+th.x-hx-things(p.xz+vec2(e,0.0),Z,t).x,e,h0+th.x-hz-things(p.xz+vec2(0.0,e),Z,t).x));",
"  vec2 W=p.xz+uPos.xz;",
"  vec3 dA=det>0.0?noised(uDa.xy,uDa.zw+p.xz*FREQ*429.0):vec3(0.5,0.0,0.0),dB=det2>0.0?noised(uDb.xy,uDb.zw+p.xz*FREQ*2571.0):vec3(0.5,0.0,0.0);",
"  float n1=noise(W*FREQ*5.0+3.0),n2=noise(W*FREQ*17.0),fine=fbm(W*FREQ*66.0),cav=clamp(0.55+30.0*(h0-gM),0.0,1.0);",
"  float grain=1.0+det*0.45*(dA.x-0.5)+det2*0.4*(dB.x-0.5);",
"  float lvl=smoothstep(0.55,0.85,nT.y);",
"  vec3 soil=mix(vec3(0.13,0.06,0.22),vec3(0.03,0.22,0.24),smoothstep(0.3,0.7,0.6*n1+0.4*fine));",
"  vec3 stone=(0.5+0.5*cos(6.2832*(p.y*1.3+0.35*n1+vec3(0.0,0.33,0.67))))*0.38+vec3(0.10,0.08,0.15);", /* the needles are banded in shifting colours */
"  stone*=0.75+0.5*noise(vec2(p.y*160.0,7.5));",
"  vec3 col=mix(stone,soil,lvl)*grain;",
"  col=mix(col,vec3(0.50,0.08,0.32)*grain,0.6*lvl*smoothstep(0.55,0.75,n2));", /* patches of crimson moss */
"  col=mix(col,vec3(0.05,0.30,0.30),smoothstep(WATER+0.008,WATER,p.y-th.x)*0.8);",
"  float pulse=0.6+0.4*sin(uTime*0.6+6.0*n1+p.y*8.0);", /* slow, so nothing flashes */
"  float vein=smoothstep(0.030,0.0,abs(noise(W*FREQ*40.0)-0.5))*smoothstep(0.35,0.6,noise(W*FREQ*9.0+5.0));",
"  vec3 emi=vec3(0.10,0.95,0.75)*vein*pulse*0.7;", /* veins of light in the ground */
"  emi+=vec3(0.75,0.20,0.95)*smoothstep(0.92,1.0,sin(p.y*150.0+4.0*n1))*(1.0-lvl)*0.22*pulse;", /* and faint lines round the needles */
"  float thing=smoothstep(0.0,0.0004,th.x),gloss=0.0;",
"  if(thing>0.0){",
"    vec3 oc;",
"    float v1=fract(th.w*7.3),v2=fract(th.w*13.7),mot=0.75+0.5*mix(0.5,dA.x,det),slow=0.6+0.4*sin(uTime*0.5+th.w*40.0);",
"    emi*=1.0-thing;",
"    if(th.y<1.2){oc=mix(vec3(0.16,0.05,0.24),vec3(0.55,0.14,0.55),th.z)*mot;emi+=thing*mix(vec3(1.0,0.45,0.15),vec3(1.0,0.2,0.6),v2)*smoothstep(0.35,0.9,th.z)*0.9*slow;}", /* a horn with a glowing tip */
"    else if(th.y<1.7){oc=mix(vec3(0.05,0.32,0.34),vec3(0.25,0.70,0.50),v2)*(0.5+0.6*th.z)*mot;emi+=thing*oc*0.9*slow;}", /* a glowing bulb */
"    else if(th.y<2.5){oc=mix(vec3(0.80,0.42,0.08),vec3(0.85,0.75,0.15),v2)*(0.6+0.6*th.z)*mot;emi+=thing*oc*0.35;}", /* small bright growths */
"    else{oc=mix(vec3(0.55,0.15,0.65),vec3(0.15,0.55,0.75),v2)*(0.7+0.6*v1);gloss=thing;emi+=thing*oc*0.25;}", /* crystals */
"    col=mix(col,oc,thing);",
"  }",
"  n=normalize(n+(vec3(dA.y,0.0,dA.z)*0.08*det+vec3(dB.y,0.0,dB.z)*0.03*det2)*(th.y>0.5?0.0:1.0));",
"  if(uTint>1.5){float lu=dot(col,vec3(0.3,0.59,0.11));col=mix(col,pal(uHue+0.25+1.1*lu+0.25*p.y)*(0.22+1.4*lu),0.9);emi=pal(uHue+0.6+0.3*n1)*dot(emi,vec3(0.4));}",
"  float dif=clamp(dot(n,uSun),0.0,1.0),sh=dif<=0.001?0.0:mir>0.5?1.0:shadow(p+nT*0.004+vec3(0.0,0.002,0.0));",
"  vec3 lin=dif*sh*gSun*1.4+(0.45+0.55*n.y)*gAmb*0.9+clamp(dot(n,normalize(vec3(-uSun.x,0.0,-uSun.z))),0.0,1.0)*vec3(0.10,0.16,0.20)*0.4;",
"  col=col*lin*(0.45+0.55*cav)+emi;",
"  col+=gSun*sh*pow(max(dot(reflect(rd,n),uSun),0.0),40.0)*gloss;",
"  return haze(col,tr,rd);",
"}"].join("\n");
var PLANET_XCOL=[
"vec3 xcol(vec3 p,float t,vec3 rd){", /* the floating shapes: dark glass that shows shifting colours at its edges, and glows a little */
"  vec2 e=vec2(0.001+0.0006*t,0.0);",
"  vec3 n=normalize(vec3(extra(p+e.xyy)-extra(p-e.xyy),extra(p+e.yxy)-extra(p-e.yxy),extra(p+e.yyx)-extra(p-e.yyx)));",
"  float fr=pow(1.0-max(dot(-rd,n),0.0),3.0);",
"  vec3 iri=0.5+0.5*cos(6.2832*(1.2*dot(n,rd)+0.6*n.y+0.8*p.y+vec3(0.0,0.33,0.67)));",
"  if(uTint>1.5)iri=pal(uHue+0.3+dot(n,rd)+0.5*p.y);",
"  vec3 col=mix(vec3(0.03,0.02,0.06),iri,0.25+0.75*fr);",
"  col=col*(clamp(dot(n,uSun),0.0,1.0)*gSun*1.2+(0.45+0.55*n.y)*gAmb)+iri*(0.20+0.10*sin(uTime*0.5+p.y*9.0))+gSun*pow(max(dot(reflect(rd,n),uSun),0.0),60.0);",
"  return haze(col,t,rd);",
"}"].join("\n");
/* The city: square blocks, one building to a block, with roads between. A ray walks from block to block and is tested
   against the few boxes in each: the building (tall ones have a narrower upper part) and up to four parked cars.
   Everything is in block units from here on: one block is 1/(4*FREQ) across, and uCi[0]*4 is the camera's block. */
CITY_S=4*LFREQ;
/* The landscapes. Each has the level of its water, the greatest height a ray need climb to, how much the fine layers are turned down on cliffs, its shape in JavaScript (which must match "shape" in its shader text), and the pieces of shader. */
LK=[
  {id:"alps",name:"Land is the Alps",water:0.085,hmax:2.6,flute:0.25,defs:"TREE=0.7200,SNOW=1.0500,BROAD=0.82,TSC=1.0",
   wat:"const vec3 WSHAL=vec3(0.10,0.42,0.40),WDEEP=vec3(0.015,0.11,0.18),WGLOW=vec3(0.0),WFOAM=vec3(0.85,0.90,0.92);",
   sun:[0.654,0.485,0.580],sunCol:[1.0,0.93,0.80],extra:null,
   shape:function(a){return 1.5*Math.pow(Math.max(a-0.22,0),1.35)},
   gl:{SHAPE:ALPS_SHAPE,EXTRA:"",SKY:ALPS_SKY,ZONE:ALPS_ZONE,SHAPES:ALPS_SHAPES,GROUND:ALPS_GROUND,XCOL:"",COLS:ALPS_COLS}},
  {id:"canyon",name:"Land is canyon country",water:0.0,hmax:2.1,flute:0.6,defs:"BROAD=0.25,TSC=0.6",
   wat:"const vec3 WSHAL=vec3(0.16,0.30,0.20),WDEEP=vec3(0.04,0.15,0.13),WGLOW=vec3(0.0),WFOAM=vec3(0.80,0.74,0.62);",
   sun:[0.654,0.485,0.580],sunCol:[1.0,0.90,0.74],extra:canyonExtra,xcell:canyonCell,
   shape:CANYON_SHAPE.js,
   gl:{SHAPE:CANYON_SHAPE.gl,EXTRA:CANYON_EXTRA,SKY:ALPS_SKY,ZONE:CANYON_ZONE,SHAPES:ALPS_SHAPES,GROUND:CANYON_GROUND,XCOL:CANYON_XCOL,
       COLS:"  gTop=vec3(0.10,0.30,0.74);gLow=vec3(0.80,0.80,0.84);gSun=uSunCol;gHaze=vec3(0.80,0.72,0.66);gAmb=vec3(0.24,0.27,0.38);"}},
  {id:"planet",name:"Land is a strange planet",water:0.02,hmax:3.9,flute:0.25,shn:22,defs:"BROAD=0.55,TSC=1.3",
   wat:"const vec3 WSHAL=vec3(0.05,0.50,0.55),WDEEP=vec3(0.25,0.03,0.38),WGLOW=vec3(0.02,0.20,0.18),WFOAM=vec3(0.60,1.00,0.92);",
   sun:[0.80,0.30,0.52],sunCol:[0.86,0.90,1.0],extra:planetExtra,xcell:planetCell,
   shape:planetShape,
   gl:{SHAPE:PLANET_SHAPE,EXTRA:PLANET_EXTRA,SKY:PLANET_SKY,ZONE:PLANET_ZONE,SHAPES:PLANET_SHAPES,GROUND:PLANET_GROUND,XCOL:PLANET_XCOL,
       COLS:"  gTop=vec3(0.012,0.008,0.06);gLow=vec3(0.07,0.20,0.27);gSun=uSunCol;gHaze=vec3(0.17,0.15,0.34);gAmb=vec3(0.20,0.15,0.34);"}},
  /* the two below have their own shaders (src), are level underfoot (h gives the height used for steering), and are mirrors */
  {id:"ball",name:"Land is a steel ball",water:0,sun:[0.654,0.485,0.580],sunCol:[1.0,0.95,0.86],extra:null,src:ballSrc,mirror:true,h:function(){return 0}},
  {id:"city",name:"Land is a city",water:0,sun:[0.654,0.485,0.580],sunCol:[1.0,0.93,0.80],extra:cityExtra,src:citySrc,mirror:true,h:cityH}
];
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get LK(){return LK},set LK(v){LK=v}, get CITY_S(){return CITY_S},set CITY_S(v){CITY_S=v}, get stepShape(){return stepShape}, get canyonCell(){return canyonCell}, get canyonExtra(){return canyonExtra}, get planetShape(){return planetShape},
  get planetCell(){return planetCell}, get planetExtra(){return planetExtra}, get landOwn(){return landOwn}, get EARTH_COLS(){return EARTH_COLS}, get BALL_R(){return BALL_R}, get ballSrc(){return ballSrc},
  get CITY_RW(){return CITY_RW}, get citySrc(){return citySrc}, get cityBlock(){return cityBlock}, get cityH(){return cityH}, get cityExtra(){return cityExtra}, get landSrc(){return landSrc}};
