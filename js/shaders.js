/* The scene shader and the post-processing shaders. */
import { STEPS, isTouch } from "./dom.js";

export const VS="attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}";
export function fragSource(w){
  return [
"precision highp float;",
"#define STEPS "+STEPS,
"#define MAXD "+w.maxd.toFixed(1),
"#define FOG "+w.fog.toFixed(3),
(w.volume?"#define VOLUME":"#define SURFACE"),
"#define VSTEPS "+(isTouch?44:56),
"uniform vec2 uRes;uniform float uTime,uSeg,uM,uHue,uSpin,uFade,uPix,uFov,uBeat,uMid,uHi;uniform vec4 uOrb,uVr;uniform vec3 uPa,uPb,uPc,uPd;uniform vec3 uPos;uniform mat3 uCam;uniform sampler2D uLandT;uniform float uLandOn;",
"uniform sampler2D uVid;uniform vec4 uVidK;uniform vec3 uVidS;", /* the video: uVidK = which way it is shown (0 for none), its strength, and the scale that fits it to the screen */
"vec3 vidLin(vec2 q){vec3 c=texture2D(uVid,q).rgb;return c*c;}", /* the video is stored ready for a screen; the scene works in light, and is made ready for the screen at the end */
"vec3 vidAt(vec2 q){return vidLin(abs(fract(q*0.5)*2.0-1.0));}", /* repeating, each copy the mirror of its neighbour */
"vec3 vidScr(){return vidLin((gl_FragCoord.xy/uRes-0.5)*uVidK.zw+0.5);}", /* flat on the screen */
"vec4 orb;"
  ].concat(w.glsl,[
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
"void main(){",
"  if(uLandOn>0.5&&texture2D(uLandT,gl_FragCoord.xy/uRes).a>0.995){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}", /* the land covers this pixel: nothing to draw */
"  vec2 uv=(2.0*gl_FragCoord.xy-uRes)/sqrt(uRes.x*uRes.y);",
"  vec2 eo=vec2(0.0);float fov=uFov;",
"  if(uVr.x>0.5){", /* VR viewer: one picture per eye, side by side. uVr = on, lens centre offset in pixels, tangent per pixel, half the eye spacing */
"    float sd=gl_FragCoord.x<0.5*uRes.x?-1.0:1.0;",
"    vec2 q=(gl_FragCoord.xy-vec2(0.5*uRes.x+sd*uVr.y,0.5*uRes.y))*uVr.z;",
"    float q2=dot(q,q);",
"    uv=q*(1.0+0.34*q2+0.55*q2*q2);", /* bend each ray the way the viewer's lens will, so straight lines look straight through it */
"    if(dot(uv,uv)>3.24){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}", /* outside what the lens shows */
"    eo=vec2(sd*uVr.w,0.0);fov=1.0;",
"  }",
"  float r=length(uv);",
"  if(uSeg>0.5){",
"    float seg=6.2831853/uSeg;",
"    float a0=atan(uv.y,uv.x)+uSpin;float kq=floor(a0/seg);",
"    float a=a0-kq*seg-0.5*seg;float ta=uSpin-kq*seg-0.5*seg;",
"    if(a<0.0){ta=-ta;eo.y=-eo.y;}", /* the eye position gets the same turn or flip as the ray, so both eyes see one mirrored scene */
"    eo=vec2(cos(ta)*eo.x-sin(ta)*eo.y,sin(ta)*eo.x+cos(ta)*eo.y);",
"    a=abs(a);",
"    uv=r*vec2(cos(a),sin(a));",
"  }",
"  vec3 ro=uPos+uCam*vec3(eo,0.0);",
"  float tmax=1e9;",
"#ifdef VOLUME",
"  vec3 rd=normalize(uCam*vec3(uv,fov));",
"  vec3 col=vec3(0.0);",
"  float t=0.04+0.05*fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);",
"  float fall=1.0;",
"  for(int i=0;i<VSTEPS;i++){",
"    float a=dens(ro+rd*t);",
"    a=VMAP(a);",
"    col+=(pal(uHue+t*0.22+a*0.3)*a+vec3(0.0009)*fall)*fall;",
"    fall*=0.93;t+=VSTEP;",
"  }",
"  col*=0.9+0.5*uBeat;",
"#else",
"  vec3 rd=normalize(uCam*vec3(uv,fov));",
"  float t=0.002;float d=0.0;float steps=0.0;float hit=0.0;",
"  for(int i=0;i<STEPS;i++){",
"    d=map(ro+rd*t);",
"    if(d<0.45*uPix*t){hit=1.0;break;}",
"    if(t>MAXD)break;",
"    t+=d;steps+=1.0;",
"  }",
"  float gw=steps/float(STEPS);",
"  if(hit>0.5)tmax=t;",
"  vec3 fogc=pal(uHue+0.5)*0.015;",
"  if(uVidK.x>2.5&&uVidK.x<3.5)fogc=mix(fogc,vidScr()*0.7,uVidK.y);", /* video in the distance: it takes the place of the dark that far things fade into */
"  vec3 col=fogc;",
"  if(hit>0.5){",
"    vec3 p=ro+rd*t;",
"    map(p);vec4 tr=orb;",
"    float e=0.8*uPix*t+0.00005;vec2 k=vec2(1.0,-1.0);",
"    vec3 n=normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));",
"    float nd=abs(dot(n,rd));",
"    if(dot(n,rd)>0.0)n=-n;",
"    vec3 l=normalize(uCam*vec3(-0.5,0.7,-0.5));",
"    float dif=max(dot(n,l),0.0);",
"    float spec=pow(max(dot(reflect(rd,n),l),0.0),28.0);",
"    float fres=pow(1.0-nd,3.0);",
"    vec3 base=pal(uHue+tr.w*0.8+0.25*tr.x);",
"    base=mix(base,pal(uHue+0.35+tr.y*1.5),0.5*clamp(tr.z*2.0,0.0,1.0));",
"    float vk=0.0,lit=0.05+0.7*dif+0.4*nd*nd;", /* how much of the surface's colour is the video, and how brightly the surface is lit */
"    if(uVidK.x>0.5){",
"      if(uVidK.x<1.5){vk=uVidK.y;lit=mix(lit,0.3+0.8*lit,vk);", /* video on the surfaces: laid on from the three axes, each weighted by how squarely the surface faces it */
"        vec3 q=p*uVidS;vec3 wt=pow(abs(n),vec3(6.0));wt/=wt.x+wt.y+wt.z;",
"        base=mix(base,vidAt(q.zy)*wt.x+vidAt(q.xz)*wt.y+vidAt(q.xy)*wt.z,uVidK.y);",
"      }else if(uVidK.x<2.5){vk=uVidK.y;lit=mix(lit,0.55+0.5*lit,vk);base=mix(base,vidScr(),vk);}", /* through the shapes: lit more evenly, so the video reads as one picture */
"      else if(uVidK.x>5.5)base=mix(base,vidAt(vec2(tr.w*1.6+0.3*tr.x,tr.y*2.0+tr.z)),uVidK.y);", /* as the colours: where the fractal's own measures say */
"    }",
"    float bands=smoothstep(0.75,1.0,0.5+0.5*sin(tr.w*24.0-uTime*1.2));",
"    float ao=max(1.0-gw,0.0);ao*=sqrt(ao);",
"    col=base*lit*ao;",
"    col+=pal(uHue+0.5+tr.w)*bands*(0.5+0.9*uMid)*ao*(1.0-vk);", /* the glowing bands give way to the video */
"    col+=fres*pal(uHue+0.2+t*0.08)*0.4*ao+spec*(0.5+1.4*uHi)*ao;",
"    col=mix(fogc,col,exp(-FOG*t));",
"  }",
"  col+=pal(uHue+0.7+r*0.1)*gw*gw*gw*0.22;",
"#endif",
"  if(uOrb.w>0.0){",
"    vec3 oc=uOrb.xyz-ro;float tc=dot(oc,rd);",
"    if(tc>0.0&&tc<tmax){",
"      float R2=uOrb.w*uOrb.w;float d2=max(dot(oc,oc)-tc*tc,0.0);",
"      float core=1.0-smoothstep(R2*0.3,R2,d2);",
"      float halo=exp(-d2/(R2*14.0))*0.55+exp(-d2/(R2*120.0))*0.18;",
"      col+=(vec3(core)+mix(vec3(1.0),pal(uHue+0.15),0.6)*halo)*(0.85+0.15*sin(uTime*2.5));",
"    }",
"  }",
"  col*=clamp(1.0-0.16*r*r,0.35,1.0)*(1.0-uVr.x*smoothstep(1.5,1.8,r));",
"  col*=1.35;col=col/(1.0+0.2*col);",
"  float lum=dot(col,vec3(0.299,0.587,0.114));",
"  col=clamp(mix(vec3(lum),col,1.4),0.0,1.0);",
"  col=col*col*(3.0-2.0*col);",
"  col=pow(col,vec3(1.15));",
"  col=pow(col,vec3(0.4545))*uFade;",
"  gl_FragColor=vec4(col,1.0);",
"}"]).join("\n");
}

export const FS_TRAIL=[
"precision highp float;varying vec2 v;uniform sampler2D uA,uB,uWv;",
"uniform float uDecay,uZoom,uRot,uSwirl,uWob,uRip,uTime,uAsp,uOv,uOvBeat,uOvMid,uOvHi,uShift,uOvAmt,uHue;uniform vec2 uDrift;uniform vec3 uPa,uPb,uPc,uPd;uniform sampler2D uVid;uniform vec4 uVidK;",
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
"void main(){",
"  vec3 s=texture2D(uA,v).rgb;",
"  vec3 vs=uVidK.x>3.5?texture2D(uVid,(v-0.5)*uVidK.zw+0.5).rgb:vec3(0.0);",
"  if(uVidK.x>4.5&&uVidK.x<5.5)s+=vs*uVidK.y*(1.0-smoothstep(0.0,0.45,dot(s,vec3(0.299,0.587,0.114))));", /* video as trails: laid into the dark parts of the scene, so the world stays in front and the motion carries the video */
"  vec2 c=v-0.5;c.x*=uAsp;float r=length(c);",
"  float ang=uRot+uSwirl*(0.5-r);float cs=cos(ang),sn=sin(ang);",
"  c=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y)*uZoom;",
"  c+=uWob*vec2(sin(c.y*9.0+uTime*0.7),cos(c.x*8.0-uTime*0.6));",
"  c*=1.0+uRip*sin(r*18.0-uTime*2.0);",
"  c.x/=uAsp;",
"  vec3 p=texture2D(uB,c+0.5+uDrift).rgb;",
"  p=mix(p,p.brg,uShift);",
"  p=max(p*uDecay-0.004,0.0);",
"  vec3 o=max(s,p);",
"  if(uOv>0.5){",
"    vec2 d=v-0.5;d.x*=uAsp;float m=min(1.0,uAsp);float rr=length(d)/m;float an=atan(d.y,d.x);float am=abs(an/3.14159265);float ln=0.0;",
"    float wd=uVidK.x>3.5&&uVidK.x<4.5?7.0:1.0;", /* with a video in the overlay its lines are drawn much wider, so there is room for the video to show */
"    if(uOv<1.5){", /* ring: the waveform bent into a circle */
"      float wv=texture2D(uWv,vec2(am*0.98+0.01,0.5)).r*2.0-1.0;",
"      ln=1.0-smoothstep(0.0,0.016*wd,abs(rr-(0.26+0.2*wv)));",
"    }else if(uOv<2.5){", /* scope: the waveform as a line across the middle */
"      float wv=texture2D(uWv,vec2(abs(v.x*2.0-1.0)*0.98+0.01,0.5)).r*2.0-1.0;",
"      ln=1.0-smoothstep(0.0,0.018*wd,abs(d.y/m-0.22*wv));",
"    }else if(uOv<3.5){", /* spectrum: bars around a circle, one per frequency band */
"      float q=am*40.0;float sp=texture2D(uWv,vec2((floor(q)+0.5)/40.0*0.7,0.5)).r;",
"      ln=step(0.18,fract(q))*step(fract(q),0.82)*step(0.16,rr)*step(rr,0.17+0.34*sp);",
"    }else if(uOv<4.5){", /* spokes: turning rays whose length follows the sound */
"      float q=fract((an/6.2831853+uTime*0.015)*14.0);float sp=texture2D(uWv,vec2(0.05+0.3*am,0.5)).r;",
"      ln=(1.0-smoothstep(0.0,0.008*wd,abs(q-0.5)*0.4488*rr))*step(0.05,rr)*step(rr,0.12+0.4*sp+0.15*uOvMid);",
"    }else if(uOv<5.5){", /* rings: circles spreading outward, brighter on the beat */
"      float f=abs(fract(rr*2.6-uTime*0.3)-0.5)/2.6;",
"      ln=(1.0-smoothstep(0.0,0.008*wd,f))*(0.35+0.65*uOvBeat)*step(rr,0.6);",
"    }else if(uOv<6.5){", /* spiral: a turning arm, rippled by the waveform */
"      float wv=texture2D(uWv,vec2(fract(rr*1.5)*0.98+0.01,0.5)).r*2.0-1.0;",
"      float f=abs(fract(rr*2.2-an/6.2831853-uTime*0.12+0.04*wv)-0.5)/2.2;",
"      ln=(1.0-smoothstep(0.0,0.009*wd,f))*step(rr,0.55);",
"    }else{", /* orbit: four lights on looping paths that swell on the beat */
"      for(int i=0;i<4;i++){",
"        float fi=float(i);vec2 pp=0.34*vec2(cos(uTime*(0.5+0.17*fi)+fi*1.7),sin(uTime*(0.63+0.11*fi)+fi*2.3));",
"        float q2=length(d/m-pp);ln+=exp(-q2*q2/((0.0006+0.0025*uOvHi)*wd*wd*0.5));",
"      }",
"    }",
"    vec3 oc=pal(uHue+0.3+rr*0.45);", /* coloured from the current palette */
"    if(uVidK.x>3.5&&uVidK.x<4.5)o=mix(o,mix(oc,vs,uVidK.y),min(ln,1.0)*uOvAmt);", /* video in the overlay: its shapes are windows onto the video, dark parts and all */
"    else o+=(max(o,oc)-o)*min(ln,1.0)*uOvAmt;",
"  }",
"  gl_FragColor=vec4(o,1.0);",
"}"].join("\n");
export const FS_DOWN=[
"precision highp float;varying vec2 v;uniform sampler2D uT;uniform vec2 uPx;",
"void main(){",
"  vec3 c=texture2D(uT,v+uPx).rgb+texture2D(uT,v-uPx).rgb+texture2D(uT,v+vec2(uPx.x,-uPx.y)).rgb+texture2D(uT,v+vec2(-uPx.x,uPx.y)).rgb;",
"  c=max(c*0.25-0.5,0.0)*2.0;",
"  gl_FragColor=vec4(c,1.0);",
"}"].join("\n");
export const FS_BLUR=[
"precision highp float;varying vec2 v;uniform sampler2D uT;uniform vec2 uDir;",
"void main(){",
"  vec3 c=texture2D(uT,v).rgb*0.227;",
"  c+=(texture2D(uT,v+uDir*1.5).rgb+texture2D(uT,v-uDir*1.5).rgb)*0.194;",
"  c+=(texture2D(uT,v+uDir*3.0).rgb+texture2D(uT,v-uDir*3.0).rgb)*0.122;",
"  c+=(texture2D(uT,v+uDir*4.5).rgb+texture2D(uT,v-uDir*4.5).rgb)*0.054;",
"  c+=(texture2D(uT,v+uDir*6.0).rgb+texture2D(uT,v-uDir*6.0).rgb)*0.016;",
"  gl_FragColor=vec4(c,1.0);",
"}"].join("\n");
export const FS_FINAL=[
"precision highp float;varying vec2 v;uniform sampler2D uT,uB;uniform float uWarp,uCA,uBloom,uTime,uAsp;uniform vec3 uTint;uniform vec2 uPx;",
"uniform float uLiq,uMos,uEcho,uEdge,uPost,uSolar,uInv,uHueRot,uTr,uFx,uHue,uVr;uniform vec3 uPa,uPb,uPc,uPd;",
"uniform sampler2D uPrev,uLandT,uSkyT;uniform float uKeep,uLandMix;", /* the last finished picture and how much of it to keep: the flash limiter for unreviewed pack code */
"vec3 pal(float x){return clamp(uPa+uPb*cos(6.28318*(uPc*x+uPd)),0.0,1.0);}",
"const vec3 LW=vec3(0.299,0.587,0.114);",
"void main(){",
"  vec2 c=v-0.5;float r=length(c);float w2=uWarp*uWarp;",
"  vec2 cw=c;float zb=0.07;float tintAmt=w2*0.9;float mask=1.0;float diss=0.0;",
"  if(uWarp>0.001){",
"    if(uTr<0.5){", /* swirl */
"      float ang=w2*2.2*(0.7-r);float cs=cos(ang),sn=sin(ang);",
"      cw=vec2(cs*c.x-sn*c.y,sn*c.x+cs*c.y)*(1.0-0.4*w2);",
"    }else if(uTr<1.5){cw=c*(1.0-0.8*w2);zb=0.22;", /* dive: straight zoom with streaks */
"    }else if(uTr<2.5){float n=6.0+300.0*pow(1.0-uWarp,3.0);vec2 nv=vec2(n*uAsp,n);cw=(floor(c*nv)+0.5)/nv;", /* blocks: pixels grow huge */
"    }else if(uTr<3.5){", /* fold: collapses into an eight-way kaleidoscope */
"      float a=atan(c.y,c.x);float seg=0.7853982;float a2=abs(mod(a+uWarp*2.5,seg)-0.5*seg);",
"      cw=mix(c,r*vec2(cos(a2),sin(a2)),smoothstep(0.0,0.5,uWarp))*(1.0-0.3*w2);",
"    }else if(uTr<4.5){cw=c+vec2(0.0,w2*(0.3+0.22*sin(c.x*37.0)+0.14*sin(c.x*91.0+1.7)));tintAmt=w2*w2*0.95;", /* melt: the picture drips down */
"    }else if(uTr<5.5){mask=smoothstep(0.0,0.04,(1.0-uWarp)*0.54-abs(c.y));tintAmt=0.0;", /* blink: closes like an eye */
"    }else if(uTr<6.5){float band=floor(v.y*26.0);float h=fract(sin(band*91.7+floor(uTime*8.0)*13.1)*43758.5453);cw=c+vec2((h-0.5)*0.9*w2,0.0);", /* tear: bands slide apart */
"    }else{vec2 cell=floor(v*vec2(uAsp,1.0)*56.0);diss=step(fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453),uWarp*1.05);tintAmt=0.0;}", /* dissolve: tiles flip to colour */
"  }",
"  if(uFx>0.5&&uFx<4.5){",
"    if(uFx<1.5)cw=abs(cw);", /* quad: four-way mirror */
"    else if(uFx<2.5)cw=abs(fract(cw*1.5+0.25)*2.0-1.0)-0.5;", /* tiles: three by three, mirrored so seams meet */
"    else if(uFx<3.5)cw*=mix(0.5,1.0,smoothstep(0.0,0.5,length(cw)));", /* bulge: the middle swells */
"    else{float ta=2.0*sin(uTime*0.25)*max(0.6-length(cw),0.0);float tcs=cos(ta),tsn=sin(ta);cw=vec2(tcs*cw.x-tsn*cw.y,tsn*cw.x+tcs*cw.y);}", /* twirl: winds and unwinds */
"  }",
"  if(uLiq>0.0)cw+=uLiq*vec2(sin(cw.y*14.0+uTime*1.3),cos(cw.x*12.0-uTime*1.1));",
"  if(uMos>0.0){vec2 n=vec2(uMos*uAsp,uMos);cw=(floor(cw*n)+0.5)/n;}",
"  if(uVr>0.5)zb=0.0;", /* VR viewer: no zoom streaks or fringing, they are centred on the screen and not on each eye */
"  float ca=(uCA+0.05*w2)*r*2.0*(1.0-uVr);",
"  vec3 col=vec3(0.0);",
"  for(int i=0;i<4;i++){",
"    float k=1.0-zb*uWarp*float(i);",
"    col.r+=texture2D(uT,0.5+cw*k*(1.0+ca)).r;",
"    col.g+=texture2D(uT,0.5+cw*k).g;",
"    col.b+=texture2D(uT,0.5+cw*k*(1.0-ca)).b;",
"  }",
"  col*=0.25;",
"  if(uEcho>0.0){vec3 e=texture2D(uT,0.5-cw*0.5).rgb;col=max(col*(1.0-0.35*uEcho),e*0.85*uEcho);}",
"  if(uEdge>0.0){",
"    vec2 px=uPx*1.5;",
"    float l0=dot(texture2D(uT,0.5+cw-vec2(px.x,0.0)).rgb,LW);",
"    float l1=dot(texture2D(uT,0.5+cw+vec2(px.x,0.0)).rgb,LW);",
"    float l2=dot(texture2D(uT,0.5+cw-vec2(0.0,px.y)).rgb,LW);",
"    float l3=dot(texture2D(uT,0.5+cw+vec2(0.0,px.y)).rgb,LW);",
"    float g=length(vec2(l1-l0,l3-l2));",
"    vec3 neon=normalize(col+0.02)*1.6*smoothstep(0.03,0.22,g);",
"    col=mix(col,neon+col*0.1,uEdge);",
"  }",
"  if(uSolar>0.0)col=mix(col,1.0-abs(2.0*col-1.0),uSolar);",
"  if(uInv>0.0)col=mix(col,0.92*(1.0-col),uInv);",
"  if(uHueRot>0.0){",
"    float ha=uHueRot*(uTime*0.6+r*5.0);vec3 kk=vec3(0.57735);",
"    col=clamp(col*cos(ha)+cross(kk,col)*sin(ha)+kk*dot(kk,col)*(1.0-cos(ha)),0.0,1.0);",
"  }",
"  if(uPost>0.0)col=floor(col*uPost+0.5)/uPost;",
"  if(uFx>4.5){",
"    float lum=dot(col,LW);",
"    if(uFx<5.5)col=pal(uHue+lum*0.9)*smoothstep(0.02,0.14,lum);", /* thermal: brightness mapped through the palette */
"    else if(uFx<6.5){col*=0.76+0.24*cos(gl_FragCoord.y*2.0944);col*=1.0+0.07*cos(gl_FragCoord.x*2.0944+vec3(0.0,2.0944,4.1888));}", /* crt: scanlines and a colour mask */
"    else if(uFx<7.5){", /* halftone: dots sized by brightness */
"      vec2 g=(gl_FragCoord.xy*mat2(0.7071,-0.7071,0.7071,0.7071))/7.0;float rad=sqrt(clamp(lum,0.0,1.0))*0.72;",
"      col=clamp(col/max(lum,0.08)*0.75,0.0,1.0)*(1.0-smoothstep(rad-0.1,rad+0.1,length(fract(g)-0.5)));",
"    }else if(uFx<8.5){float bd=abs(fract(lum*9.0-uTime*0.15)-0.5);col=mix(col*0.22,clamp(col*1.9+0.08,0.0,1.0),1.0-smoothstep(0.03,0.1,bd));}", /* contour: drifting bands of equal brightness */
"    else{float l2=smoothstep(0.06,0.7,lum);col=mix(vec3(l2),uTint*l2*1.5,smoothstep(0.5,0.95,l2)*0.65);}", /* noir: black and white, highlights in the palette colour */
"  }",
"  col+=texture2D(uB,0.5+cw).rgb*uBloom;",
"  col=mix(col,uTint,max(tintAmt,diss))*mask;",
"  if(uLandMix>0.5){vec4 L=texture2D(uLandT,v);col=uLandMix<1.5?mix(col,L.rgb,L.a):mix(texture2D(uSkyT,v).rgb,col,L.a);}", /* effects on the sky only: the land goes on top untouched. On the land only: the world shows untouched behind it. */
"  if(uKeep>0.0)col=mix(col,texture2D(uPrev,v).rgb,uKeep);",
"  gl_FragColor=vec4(col,1.0);",
"}"].join("\n");

/* the final pass with a pack filter's code in it. The code sees the picture and the palette, and nothing that changes with time. */
export function finalSource(code){
  return FS_FINAL
   .replace("void main(){","float aspect;vec2 pixel;\nvec3 scene(vec2 uv){return texture2D(uT,uv).rgb;}\nfloat luma(vec3 c){return dot(c,LW);}\nvoid look(vec2 uv,inout vec3 col){\n"+code+"\n}\nvoid main(){")
   .replace("  col+=texture2D(uB,0.5+cw).rgb*uBloom;","  aspect=uAsp;pixel=uPx;look(0.5+cw,col);col=clamp(col,0.0,1.0);\n  col+=texture2D(uB,0.5+cw).rgb*uBloom;");
}
/* the feedback pass with a pack overlay's code in it. The code sets how bright the overlay is at a point, and where in the palette its colour comes from. */
export function trailSource(code){
  return FS_TRAIL
   .replace("void main(){","float time,beat,mid,hi,aspect;\nfloat sound(float x){return texture2D(uWv,vec2(clamp(x,0.0,1.0)*0.98+0.01,0.5)).r;}\nvoid mark(vec2 p,inout float ln,inout float hue){\n"+code+"\n}\nvoid main(){")
   .replace("    vec3 oc=pal(uHue+0.3+rr*0.45);","    float hq=0.3+rr*0.45;\n    if(uOv>98.5){ln=0.0;time=uTime;beat=uOvBeat;mid=uOvMid;hi=uOvHi;aspect=uAsp;mark(d/m,ln,hq);ln=clamp(ln,0.0,1.0);}\n    vec3 oc=pal(uHue+hq);");
}
export const TRAIL_U=["uA","uB","uWv","uDecay","uZoom","uRot","uSwirl","uWob","uRip","uTime","uAsp","uOv","uOvBeat","uOvMid","uOvHi","uDrift","uShift","uOvAmt","uHue","uPa","uPb","uPc","uPd","uVid","uVidK"];

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={VS, fragSource, FS_TRAIL, FS_DOWN, FS_BLUR, FS_FINAL, finalSource, trailSource, TRAIL_U};
