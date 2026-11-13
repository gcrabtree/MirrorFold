import { $, calm, canvas, errBox, gl } from "./dom.js";
import { bands, liveAudio, readMusic, setMusic, soundChanged } from "./listen.js";
import { wakeHud } from "./input.js";
import { ST, statsOn, statsShow, updateWave } from "./controls.js";
import { packD, packFrame, probe, probeOut, probePts, probePx } from "./probe.js";
import { J, cross, deAt, jReset, morphValue, norm, rot, toast, userActive, userLook } from "./flight.js";
import { DETAIL, pBlur, pCopy, pDown, pFinal, pTrail, resize, tA, tB, tF, tT, target } from "./targets.js";
import { landFloor, landFx, landH, landKind, landMode, landPass, lhead, lpos, lvel, pLand, pMix } from "./land.js";
import { collectOrb, finishHybrid, spawnOrb } from "./choose.js";
import { PALETTES, WORLDS } from "./worlds.js";
import { ac, filt, pDur, pPos, player, scrubbing, showScrub } from "./audio.js";
import { CATS, advanceSet, jApply, jCur, jNone, jPick, jPool, jset } from "./journey.js";
import { FX, LOOKS, MOTIONS, OVERLAYS, OVS, mirrors, stick } from "./state.js";
import { LPERIOD } from "./land-shader.js";
import { LK } from "./landscapes.js";
import { palCur } from "./shaders.js";
import { filterProg, overlayProg } from "./programs.js";
import { G } from "./shared.js";
let last, acc, frames, qHold;

/* ---------- start ---------- */
function begin(withMusic){
  G.started=true;$("start").classList.add("gone");
  if(withMusic)setMusic("built");
  wakeHud();
}
export const camArr=new Float32Array(9);
export function bindTex(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
export function passTo(o,p){gl.bindFramebuffer(gl.FRAMEBUFFER,o?o.f:null);gl.viewport(0,0,o?o.w:canvas.width,o?o.h:canvas.height);gl.useProgram(p.prog);}
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){last=now;return;}
  var rawDt=(now-last)/1000,dt=Math.min(0.05,rawDt),sT0=statsOn?performance.now():0,sPr=0;last=now;
  /* Wait for the graphics chip before starting a new picture, by reading one point back from it. Without this the
     browser may queue several pictures ahead of the chip and then stall while it catches up, which shows as stutter
     even though the average rate is high. (Found by accident: with Stats on, whose probe does the same wait, a PC with a
     144 Hz screen ran smoothly, and with it off it stuttered.) A pack world's own probe, later in the frame, does the same job. */
  if(!(statsOn&&!G.hyb&&!G.world.volume)&&!G.world.pack){ /* done the way Stats does it: draw into the small picture, then read from it */
    if(G.world.volume||G.hyb||!probe(G.world,morphValue(),1)){
      if(!G.probeT)G.probeT=target(16,1);
      passTo(G.probeT,pCopy);bindTex(0,tA.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,probePx);
    }
  }
  if(statsOn&&!G.hyb){ /* try the probe at the camera, and time it, before anything else is drawn */
    probePts[0]=G.pos[0];probePts[1]=G.pos[1];probePts[2]=G.pos[2];
    if(probe(G.world,morphValue(),1)){sPr=performance.now()-sT0;ST.pr+=sPr;ST.pn++;ST.gd=probeOut[0];ST.jd=G.world.pack?NaN:G.world.de(G.pos[0],G.pos[1],G.pos[2],morphValue());}
  }

  acc+=dt;frames++;
  if(frames>=30){
    var avg=acc/frames;acc=0;frames=0;
    if(DETAIL[G.di]==="auto"){ /* hold sharpness, give up frame rate first: only step down below about 28 fps */
      if(avg>0.036&&G.q>(landMode?0.35:0.6)){G.q=Math.max(landMode?0.35:0.6,G.q*0.9);qHold=now+20000;resize();} /* the land costs more, so it may give up more sharpness */
      else if(avg<0.022&&G.q<1&&now>qHold){G.q=Math.min(1,G.q*1.06);resize();} /* after stepping down, wait before trying to step up again: each change rebuilds every picture, which shows as a hitch */
    }
  }

  readMusic(dt);
  var react=calm?0.25:1,bt=G.beat*react,lv=G.level*react;
  var mp=bands.m.p*react,mv=bands.m.lv*react,hp=bands.t.p*react,hv=bands.t.lv*react;
  G.time+=dt;G.hueT+=dt*0.017*(1+2.5*hv);
  if(G.morph)G.morphT+=dt*(calm?0.4:1)*(1+1.6*mv);
  if(!calm)G.spin+=dt*0.045;

  /* warp transition between worlds */
  if(G.warpDir>0){
    G.warp+=dt/0.5;
    if(G.warp>=1){G.warp=1;var wf=G.warpFn;G.warpFn=null;G.pendingWorld=-1;if(wf)wf();G.warpDir=-1;}
  }else if(G.warpDir<0){
    G.warp-=dt/0.8;if(G.warp<=0){G.warp=0;G.warpDir=0;}
  }

  var m=morphValue();
  if(G.hyb){ /* a second world mixed into this one, either held and breathing or carrying a journey across */
    if(G.hyb.mode==="trans"){G.hyb.t+=dt/12;if(G.hyb.t>=1)finishHybrid();}
    else{
      var ht=G.hyb.exit?0:(0.5+0.38*Math.sin(G.time*0.07));
      G.hyb.t+=(ht-G.hyb.t)*(1-Math.exp(-dt*0.8));
      if(G.hyb.exit&&G.hyb.t<0.02){G.hyb=null;spawnOrb();}
    }
  }
  var w=G.world,wB=G.hyb?WORLDS[G.hyb.b]:null;
  var wSpeed=G.hyb?(w.speed+(wB.speed-w.speed)*G.hyb.t):w.speed;
  var pk=w.pack&&!G.hyb; /* a pack world: one question to the chip gives all five distances, using the reach worked out last frame */
  if(pk)packFrame(w,m,Math.min(1,Math.max(0.06,packD[0]*5)));
  var dist=pk?packD[0]:Math.abs(deAt(G.pos[0],G.pos[1],G.pos[2],m));
  G.boost*=Math.exp(-dt*1.2);if(G.boost<0.01)G.boost=0;
  if(G.musicMode==="file"&&player.mode&&!scrubbing&&pDur()>0)showScrub(pPos()/pDur());

  /* journey: autopilot that wanders, steers toward open space, and changes world and palette on its own */
  /* while the user turns the view themselves, by hand or by head, the autopilot's steering pauses and automatic forward motion nearly stops */
  G.lookAct=userActive(G.lookAct,G.userTurn/Math.max(dt,0.004),dt);G.userTurn=0;
  var travel=G.journey&&G.jMove==="travel",hands=1-G.lookAct,ease=1-0.85*G.lookAct;
  if(G.journey&&G.started){
    if(travel&&landMode){ /* over land the autopilot turns toward whichever side is lower, so it keeps to the valleys, and holds the view a little below level */
      var lrx=lhead[1],lrz=-lhead[0],lc=Math.cos(0.55)*1.3,ls=Math.sin(0.55)*1.3;
      var hL=landH(lpos[0]+lhead[0]*lc-lrx*ls,lpos[2]+lhead[1]*lc-lrz*ls,4),hR=landH(lpos[0]+lhead[0]*lc+lrx*ls,lpos[2]+lhead[1]*lc+lrz*ls,4);
      G.lookX+=(Math.max(-0.5,Math.min(0.5,(hL-hR)*1.6))+0.08*Math.sin(G.time*0.13))*dt*hands;
      G.lookY+=(G.F[1]+0.10)*0.6*dt*hands;
    }else if(travel){
      var pr=Math.min(1,Math.max(0.06,dist*5));
      var pd=function(sx,sy){
        var d=norm([G.F[0]+0.7*(G.R[0]*sx+G.Up[0]*sy),G.F[1]+0.7*(G.R[1]*sx+G.Up[1]*sy),G.F[2]+0.7*(G.R[2]*sx+G.Up[2]*sy)]);
        return Math.abs(deAt(G.pos[0]+d[0]*pr,G.pos[1]+d[1]*pr,G.pos[2]+d[2]*pr,m));
      };
      var dR=pk?packD[1]:pd(1,0),dL=pk?packD[2]:pd(-1,0),dU=pk?packD[3]:pd(0,1),dD=pk?packD[4]:pd(0,-1);
      G.lookX+=((dR-dL)/(dR+dL+1e-6)*1.1+0.22*Math.sin(G.time*0.13)+0.12*Math.sin(G.time*0.37+1.3))*dt*hands;
      G.lookY+=((dD-dU)/(dD+dU+1e-6)*1.1+0.16*Math.sin(G.time*0.11+2.0)+0.10*Math.sin(G.time*0.29))*dt*hands;
    }
    for(var jk in J)J[jk].t+=dt;
    if(jset){jset.t+=dt;if(jset.t>jset.len)advanceSet();}
    for(var ci=0;ci<CATS.length;ci++){
      var ck=CATS[ci].k,cf=G.jt[ck];
      if(cf.mode==="off"){if(jCur(ck)!==jNone(ck))jApply(ck,jNone(ck));continue;}
      if(cf.mode!=="random")continue;
      var due=J[ck].t>J[ck].next;
      if(ck==="world"&&cf.trigger==="sound"&&liveAudio()){ /* wait for the music to shift, but never forever */
        due=(soundChanged&&J.world.t>Math.max(10,cf.every*0.25))||J.world.t>cf.every*2.5;
      }
      if(due&&jApply(ck,jPick(ck,cf,jCur(ck),jPool(ck,cf))))jReset(ck);
    }
  }

  wB=G.hyb?WORLDS[G.hyb.b]:null; /* journey may have just started a morph */

  /* look */
  var kx=(G.keys.ArrowRight?1:0)-(G.keys.ArrowLeft?1:0),ky=(G.keys.ArrowDown?1:0)-(G.keys.ArrowUp?1:0);
  userLook(kx*dt*1.2,ky*dt*1.2);
  var f=1-Math.exp(-dt*14),ax=G.lookX*f,ay=G.lookY*f;G.lookX-=ax;G.lookY-=ay;
  G.F=rot(G.F,G.Up,ax);G.F=rot(G.F,G.R,ay);G.Up=rot(G.Up,G.R,ay);
  var rollT=((G.keys.KeyE?1:0)-(G.keys.KeyQ?1:0))*1.2;
  var idle=stick.id===null&&!G.keys.KeyW&&!G.keys.KeyS&&!G.keys.KeyA&&!G.keys.KeyD;
  if((G.drift||travel)&&idle&&!calm&&!G.stereo&&!landMode)rollT+=0.035*hands; /* no automatic roll in the VR viewer */
  G.rollIn+=(rollT-G.rollIn)*(1-Math.exp(-dt*4));
  G.Up=rot(G.Up,G.F,-G.rollIn*dt);
  if(G.gRoll!==0){G.Up=rot(G.Up,G.F,G.gRoll);G.gRoll=0;}
  G.F=norm(G.F);G.R=norm(cross(G.Up,G.F));G.Up=cross(G.F,G.R);
  if(landMode&&!G.stereo&&Math.abs(G.F[1])<0.97){ /* over land the horizon is eased level */
    var lt=norm([-G.F[0]*G.F[1],1-G.F[1]*G.F[1],-G.F[2]*G.F[1]]),le=1-Math.exp(-dt*3);
    G.Up=norm([G.Up[0]+(lt[0]-G.Up[0])*le,G.Up[1]+(lt[1]-G.Up[1])*le,G.Up[2]+(lt[2]-G.Up[2])*le]);G.R=norm(cross(G.Up,G.F));G.Up=cross(G.F,G.R);
  }

  /* move: speed scales with distance to the nearest surface */
  var mx=(G.keys.KeyD?1:0)-(G.keys.KeyA?1:0)+stick.x;
  var mz=(G.keys.KeyW?1:0)-(G.keys.KeyS?1:0)-stick.y;
  var my=(G.keys.Space?1:0)-((G.keys.ShiftLeft||G.keys.ShiftRight)?1:0);
  if(G.started&&idle&&my===0){if(travel)mz+=0.5*ease;else if(G.drift)mz+=0.3*ease;}
  if(!G.started){mz=0.18;mx=0;my=0;}
  var sp=Math.min(wSpeed,Math.max(0.012,dist*2.6))*G.baseSpeed*(1+0.25*lv)*(1+3*G.boost);
  var tv=[(G.R[0]*mx+G.Up[0]*my+G.F[0]*mz)*sp,(G.R[1]*mx+G.Up[1]*my+G.F[1]*mz)*sp,(G.R[2]*mx+G.Up[2]*my+G.F[2]*mz)*sp];
  var vf=1-Math.exp(-dt*3.5),per=w.period(m),perB=G.hyb?wB.period(m):null;
  for(var i=0;i<3;i++){
    G.vel[i]+=(tv[i]-G.vel[i])*vf;
    G.pos[i]+=G.vel[i]*dt;
    var dl=per[i]*Math.floor(G.pos[i]/per[i]+.5); /* every world repeats, so wrapping by one period is invisible */
    G.pos[i]-=dl;
    if(G.hyb&&dl!==0){G.hyb.off[i]+=dl;G.hyb.off[i]-=perB[i]*Math.floor(G.hyb.off[i]/perB[i]+.5);}
  }
  G.curSpeed=Math.hypot(G.vel[0],G.vel[1],G.vel[2]);
  /* the land has its own position: it goes the way the camera faces, level, and keeps clear of the ground here and ahead */
  if(landMode){
    var fh=Math.hypot(G.F[0],G.F[2]);if(fh>0.05){lhead[0]=G.F[0]/fh;lhead[1]=G.F[2]/fh;}
    var lsp=0.4*G.baseSpeed*(1+3*G.boost),lwant,lk,ld;
    lvel[0]+=((lhead[1]*mx+lhead[0]*mz)*lsp-lvel[0])*vf;lvel[1]+=((-lhead[0]*mx+lhead[1]*mz)*lsp-lvel[1])*vf;
    lpos[0]+=lvel[0]*dt;lpos[2]+=lvel[1]*dt;
    lpos[0]-=LPERIOD*Math.floor(lpos[0]/LPERIOD);lpos[2]-=LPERIOD*Math.floor(lpos[2]/LPERIOD);
    G.landClear=Math.max(0.035,Math.min(1.5,G.landClear+my*dt*0.25));
    lwant=landFloor(lpos[0],lpos[2]);
    for(lk=1;lk<=4;lk++){ld=0.22*lk;lwant=Math.max(lwant,landFloor(lpos[0]+lhead[0]*ld,lpos[2]+lhead[1]*ld)-0.10*lk);}
    lwant+=G.landClear;
    lpos[1]+=(lwant-lpos[1])*Math.min(1,dt*(lwant>lpos[1]?3:0.5));
    lpos[1]=Math.max(lpos[1],landFloor(lpos[0],lpos[2])+0.035);
    var xf=LK[landKind].extra; /* keep out of arches and other free-standing shapes: step back along the way out */
    if(xf){
      var xd=xf(lpos[0],lpos[1],lpos[2]);
      if(xd<0.035){
        var xgx=xf(lpos[0]+0.01,lpos[1],lpos[2])-xd,xgy=xf(lpos[0],lpos[1]+0.01,lpos[2])-xd,xgz=xf(lpos[0],lpos[1],lpos[2]+0.01)-xd,xgl=Math.hypot(xgx,xgy,xgz)||1;
        lpos[0]+=xgx/xgl*(0.035-xd);lpos[1]+=xgy/xgl*(0.035-xd);lpos[2]+=xgz/xgl*(0.035-xd);
      }
    }
  }
  var spN=Math.min(1,G.curSpeed/(wSpeed*G.baseSpeed+1e-6));

  /* the orb: drawn at its nearest copy, collected when you reach it, moved if the morph swallows it */
  var orbU=[0,0,0,0];
  if(G.orb&&G.orbsOn&&!G.hyb&&G.started){
    var oq=[0,0,0],od=0;
    for(i=0;i<3;i++){oq[i]=G.orb.p[i]-G.pos[i];oq[i]-=per[i]*Math.floor(oq[i]/per[i]+.5);od+=oq[i]*oq[i];}
    if(Math.sqrt(od)<G.orb.r*2.5&&G.warpDir===0)collectOrb();
    else{
      orbU=[G.pos[0]+oq[0],G.pos[1]+oq[1],G.pos[2]+oq[2],G.orb.r];
      G.orbT+=dt;
      if(G.orbT>1.5){G.orbT=0;if(!w.volume&&Math.abs(w.de(G.orb.p[0],G.orb.p[1],G.orb.p[2],m))<G.orb.r*0.6)spawnOrb();}
    }
  }

  if(ac&&G.musicMode==="built"&&ac.state==="running"){
    try{filt.frequency.setTargetAtTime(380+spN*1300+180*Math.sin(G.time*0.13),ac.currentTime,0.6);}catch(_){}
  }

  /* palette eases toward the chosen one */
  var pl=PALETTES[G.pi],pe=1-Math.exp(-dt*1.6),key,j;
  for(key in palCur){for(j=0;j<3;j++)palCur[key][j]+=(pl[key][j]-palCur[key][j])*pe;}

  /* 1. the fractal */
  var fx=FX[G.fi],sc=G.hyb?G.hyb:w,U=sc.U,wHue=G.hyb?(w.hue+(wB.hue-w.hue)*G.hyb.t):w.hue;
  var fovNow=calm?1.15:(1.15-0.13*spN-0.05*bt-0.25*G.boost+0.025*Math.sin(G.time*0.4));
  /* 0. the land, if it is on. Alone, it is the whole scene. Over a world, it is drawn first into its own picture with a
     clear sky, so the world need only be drawn where the land leaves it showing. Not in the VR viewer. */
  var landOn=landMode>0&&!G.stereo&&!!pLand,landOver=landOn&&landMode===2,src=tA;
  if(landOver){if(!G.tL)G.tL=target(tA.w,tA.h);landPass(G.tL,true,fovNow,G.hueT+wHue);}
  else if(landOn)landPass(tA,false,fovNow,G.hueT+wHue);
  if(!landOn||landOver){
  gl.bindFramebuffer(gl.FRAMEBUFFER,tA.f);gl.viewport(0,0,tA.w,tA.h);gl.useProgram(sc.prog);
  gl.uniform4f(U.uOrb,orbU[0],orbU[1],orbU[2],orbU[3]);
  if(G.hyb){gl.uniform1f(U.uMix,G.hyb.t);gl.uniform3f(U.uOff,G.hyb.off[0],G.hyb.off[1],G.hyb.off[2]);}
  gl.uniform2f(U.uRes,tA.w,tA.h);
  gl.uniform1f(U.uTime,G.time);
  gl.uniform1f(U.uSeg,mirrors[G.mi]);
  gl.uniform1f(U.uM,m);
  gl.uniform1f(U.uHue,G.hueT+wHue);
  gl.uniform1f(U.uSpin,G.spin);
  gl.uniform1f(U.uFade,1);
  /* VR viewer geometry, from the Cardboard viewer's published numbers: lenses 64 mm apart and 39 mm from the screen.
     The browser does not report the screen's physical size, so one CSS pixel is taken as 0.162 mm, which is close on current phones.
     Eye spacing follows the distance to the nearest surface, so the world always feels a similar size. */
  var vrPx=0.000162*canvas.clientWidth/tA.w,vrTan=vrPx/0.039;
  G.vrEye+=(Math.max(0.00002,dist*0.021)-G.vrEye)*(1-Math.exp(-dt*1.5));
  gl.uniform4f(U.uVr,G.stereo?1:0,0.032/vrPx,vrTan,G.vrEye);
  gl.uniform1f(U.uPix,G.stereo?vrTan:2/(Math.sqrt(tA.w*tA.h)*1.15));
  gl.uniform1f(U.uFov,fovNow);
  gl.uniform1f(U.uLandOn,landOver&&!LK[landKind].mirror?1:0);if(landOver){bindTex(6,G.tL.t);gl.uniform1i(U.uLandT,6);}
  gl.uniform1f(U.uBeat,bt);gl.uniform1f(U.uMid,mp);gl.uniform1f(U.uHi,hp);
  gl.uniform3fv(U.uPa,palCur.a);gl.uniform3fv(U.uPb,palCur.b);gl.uniform3fv(U.uPc,palCur.c);gl.uniform3fv(U.uPd,palCur.d);
  gl.uniform3f(U.uPos,G.pos[0],G.pos[1],G.pos[2]);
  camArr[0]=G.R[0];camArr[1]=G.R[1];camArr[2]=G.R[2];camArr[3]=G.Up[0];camArr[4]=G.Up[1];camArr[5]=G.Up[2];camArr[6]=G.F[0];camArr[7]=G.F[1];camArr[8]=G.F[2];
  gl.uniformMatrix3fv(U.uCam,false,camArr);
  gl.drawArrays(gl.TRIANGLES,0,3);
  }
  /* which picture the effects work on: the land laid over the world, the world alone, or the land alone */
  if(landOver&&landFx===0){if(!G.tC)G.tC=target(tA.w,tA.h);passTo(G.tC,pMix);bindTex(0,tA.t);bindTex(1,G.tL.t);gl.uniform1i(pMix.U.uT,0);gl.uniform1i(pMix.U.uL,1);gl.drawArrays(gl.TRIANGLES,0,3);src=G.tC;}
  else if(landOver&&landFx===2)src=G.tL;

  /* 2. feedback: the last frame, warped by the chosen motion and fading, with this frame laid over it */
  var mo=MOTIONS[G.moi],lk=LOOKS[G.lki],k60=dt*60,TU=pTrail.U;
  /* VR viewer: filters that move parts of the picture would show each eye something different, so they are left out */
  if(G.stereo&&(lk.echo||lk.mos||lk.liq||lk.hue||lk.code||(lk.fx>0&&lk.fx<5)))lk=LOOKS[0];
  var tx=G.hueT+wHue+0.2,tint=[0,0,0];
  for(j=0;j<3;j++)tint[j]=Math.min(1,Math.max(0,palCur.a[j]+palCur.b[j]*Math.cos(6.28318*(palCur.c[j]*tx+palCur.d[j]))));
  var tc=tT[G.cur],tp=tT[1-G.cur];
  /* a pack overlay has its own copy of this pass with its code in it */
  var ov=OVERLAYS[G.ovi],op=ov.code&&!G.stereo?overlayProg(ov):null;
  if(ov.code&&!op&&!G.stereo&&!ov.told){ov.told=1;toast("Overlay "+ov.name+" does not work on this device.");}
  if(op)TU=op.U;
  if(G.ovi>0)updateWave();
  passTo(tc,op||pTrail);bindTex(2,G.ovi>0?G.waveTex:src.t);bindTex(1,tp.t);bindTex(0,src.t);
  gl.uniform1i(TU.uA,0);gl.uniform1i(TU.uB,1);gl.uniform1i(TU.uWv,2);
  gl.uniform1f(TU.uDecay,G.stereo?0:Math.pow(Math.max(fx.decay,mo.decay||0,G.warp>0?0.9:0),k60)); /* no trails in the VR viewer: they are warped about the middle of the screen */
  gl.uniform1f(TU.uZoom,Math.pow(mo.zoom||0.994,k60)-0.02*G.warp-0.012*bt*(mo.kick||0));
  gl.uniform1f(TU.uRot,(mo.rot||0)*k60*(1+1.2*mp));
  gl.uniform1f(TU.uSwirl,(mo.swirl||0)*k60);
  gl.uniform1f(TU.uWob,(mo.wob||0)*k60*(1+1.5*mv));
  gl.uniform1f(TU.uRip,(mo.rip||0)*k60*(1+1.5*bt));
  gl.uniform2f(TU.uDrift,(mo.dx||0)*k60,(mo.dy||0)*k60);
  gl.uniform1f(TU.uTime,G.time);gl.uniform1f(TU.uAsp,tc.w/tc.h);
  gl.uniform1f(TU.uOv,G.stereo?0:ov.code?(op?99:0):G.ovi);gl.uniform1f(TU.uOvBeat,bt);gl.uniform1f(TU.uOvMid,mp);gl.uniform1f(TU.uOvHi,hp);
  gl.uniform1f(TU.uShift,G.moi>0?Math.min(0.3,(0.05+0.1*hp)*k60):0); /* trails drift through the colour channels so they read apart from the scene */
  gl.uniform1f(TU.uOvAmt,OVS[G.ovsi]);gl.uniform1f(TU.uHue,G.hueT+wHue);
  gl.uniform3fv(TU.uPa,palCur.a);gl.uniform3fv(TU.uPb,palCur.b);gl.uniform3fv(TU.uPc,palCur.c);gl.uniform3fv(TU.uPd,palCur.d);
  gl.drawArrays(gl.TRIANGLES,0,3);

  /* 3. bloom: bright parts, shrunk and blurred */
  var landLit=landOn&&!(landOver&&landFx===1)?0.3:1; /* glow and colour fringing are made for dark worlds; on a daylit land they wash the sky out, so they are turned down */
  var bloom=fx.bloom*(1+0.7*bt)*landLit+0.5*G.warp;
  if(bloom>0){
    passTo(tB[0],pDown);bindTex(0,tc.t);gl.uniform1i(pDown.U.uT,0);gl.uniform2f(pDown.U.uPx,1/tc.w,1/tc.h);gl.drawArrays(gl.TRIANGLES,0,3);
    passTo(tB[1],pBlur);bindTex(0,tB[0].t);gl.uniform1i(pBlur.U.uT,0);gl.uniform2f(pBlur.U.uDir,1/tB[0].w,0);gl.drawArrays(gl.TRIANGLES,0,3);
    passTo(tB[0],pBlur);bindTex(0,tB[1].t);gl.uniform2f(pBlur.U.uDir,0,1/tB[0].h);gl.drawArrays(gl.TRIANGLES,0,3);
  }

  /* 4. to the screen: the chosen filter, colour fringing at the edges, bloom, and the warp twist */
  /* a pack filter with code has its own copy of this pass. While unreviewed code is in use, in a filter or an overlay,
     the picture is blended with the last finished one, so whatever the code does, it cannot flash:
     a change takes about a quarter of a second to come through. */
  var lp=lk.code?filterProg(lk):null;
  if(lk.code&&!lp&&!lk.told){lk.told=1;toast("Filter "+lk.name+" does not work on this device.");}
  var slow=(!!lp&&!lk.reviewed)||(!!op&&!ov.reviewed)||(G.world.pack&&!G.world.reviewed&&(!landOn||landOver)),PF=lp||pFinal,FU=PF.U;
  if(slow&&!tF[0]){tF[0]=target(canvas.width,canvas.height);tF[1]=target(canvas.width,canvas.height);}
  passTo(slow?tF[G.fcur]:null,PF);bindTex(0,tc.t);bindTex(1,tB[0].t);
  bindTex(3,slow?tF[1-G.fcur].t:tc.t);gl.uniform1i(FU.uPrev,3);gl.uniform1f(FU.uKeep,slow?Math.exp(-dt/0.25):0);
  gl.uniform1i(FU.uT,0);gl.uniform1i(FU.uB,1);
  gl.uniform1f(FU.uLandMix,landOver?landFx:0);if(landOver&&landFx>0){bindTex(6,G.tL.t);bindTex(7,tA.t);gl.uniform1i(FU.uLandT,6);gl.uniform1i(FU.uSkyT,7);}
  gl.uniform1f(FU.uWarp,G.warp);gl.uniform1f(FU.uTr,G.stereo?5:G.trType);gl.uniform1f(FU.uVr,G.stereo?1:0); /* VR viewer always uses the blink transition */
  gl.uniform1f(FU.uCA,G.stereo?0:(fx.ca*(1+1.5*spN)+(G.fi===2?0:0.006*hp))*landLit+0.012*G.boost+(lk.ca||0));
  gl.uniform1f(FU.uBloom,bloom);
  gl.uniform1f(FU.uTime,G.time);gl.uniform1f(FU.uAsp,tc.w/tc.h);gl.uniform2f(FU.uPx,1/tc.w,1/tc.h);
  gl.uniform1f(FU.uLiq,(lk.liq||0)*(1+2*mv));gl.uniform1f(FU.uMos,lk.mos||0);gl.uniform1f(FU.uEcho,lk.echo||0);
  gl.uniform1f(FU.uEdge,lk.edge||0);gl.uniform1f(FU.uPost,lk.post||0);gl.uniform1f(FU.uSolar,lk.solar||0);
  gl.uniform1f(FU.uInv,lk.inv||0);gl.uniform1f(FU.uHueRot,lk.hue||0);
  gl.uniform1f(FU.uFx,lk.fx||0);gl.uniform1f(FU.uHue,G.hueT+wHue);
  gl.uniform3fv(FU.uPa,palCur.a);gl.uniform3fv(FU.uPb,palCur.b);gl.uniform3fv(FU.uPc,palCur.c);gl.uniform3fv(FU.uPd,palCur.d);
  gl.uniform3f(FU.uTint,tint[0],tint[1],tint[2]);
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(slow){passTo(null,pCopy);bindTex(0,tF[G.fcur].t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);G.fcur=1-G.fcur;}
  G.cur=1-G.cur;
  if(statsOn){ST.n++;ST.t+=rawDt;ST.worst=Math.max(ST.worst,rawDt);ST.js+=performance.now()-sT0-sPr;if(ST.t>=0.5)statsShow();}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("enter").addEventListener("click",function(){begin(true)});
$("enterQuiet").addEventListener("click",function(){begin(false)});

/* ---------- loop ---------- */
last=performance.now();
acc=0;
frames=0;
qHold=0;
canvas.addEventListener("webglcontextlost",function(e){e.preventDefault();errBox.textContent="The graphics context was lost. Reload the page to continue.";});
requestAnimationFrame(frame);
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get begin(){return begin}, get last(){return last},set last(v){last=v}, get acc(){return acc},set acc(v){acc=v}, get frames(){return frames},set frames(v){frames=v}, get qHold(){return qHold},set qHold(v){qHold=v}, get camArr(){return camArr},
  get bindTex(){return bindTex}, get passTo(){return passTo}, get frame(){return frame}};
