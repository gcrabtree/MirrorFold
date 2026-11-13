import { ac, filt, pDur, pPos, player, scrubbing, showScrub } from "./audio.js";
import { cam, cross, norm, rot, userActive, userLook } from "./camera.js";
import { collectOrb, finishHybrid, scene, spawnOrb } from "./choose.js";
import { clock, morphValue } from "./clock.js";
import { ST, drift, morph, orbsOn, statsOn, statsShow, updateWave, waveTex } from "./controls.js";
import { $, calm, canvas, errBox, gl } from "./dom.js";
import { J, deAt, jReset, toast } from "./flight.js";
import { keys, wakeHud } from "./input.js";
import { CATS, advanceSet, jApply, jCur, jMove, jNone, jPick, jPool, journey, jset, jt } from "./journey.js";
import { LPERIOD } from "./land-shader.js";
import { landClear, landClimb, landFloor, landFx, landH, landKind, landLayer, landMixed, landMode, landPass, lhead, lpos,
  lvel, pLand, pMix, tC, tL } from "./land.js";
import { LK } from "./landscapes.js";
import { bands, beat, level, liveAudio, musicMode, readMusic, setMusic, soundChanged } from "./listen.js";
import { chipWait, packD, packFrame, probe, probeOut, probePts } from "./probe.js";
import { bindTex, filterProg, overlayProg, passTo } from "./programs.js";
import { palCur } from "./shaders.js";
import { FX, LOOKS, MOTIONS, OVERLAYS, OVS, mirrors, sel, stick } from "./state.js";
import { autoDetail, flip, pBlur, pCopy, pDown, pFinal, pTrail, tA, tB, tF, tT, target } from "./targets.js";
import { stereo, vrEye, vrEyeStep } from "./vr.js";
import { tr } from "./warp.js";
import { PALETTES, WORLDS } from "./worlds.js";
export let started=false; /* the start card has been left */
let last;

/* ---------- start ---------- */
function begin(withMusic){
  started=true;$("start").classList.add("gone");
  if(withMusic)setMusic("built");
  wakeHud();
}
export const camArr=new Float32Array(9);
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){last=now;return;}
  var rawDt=(now-last)/1000,dt=Math.min(0.05,rawDt),sT0=statsOn?performance.now():0,sPr=0;last=now;
  if(!(statsOn&&!scene.hyb&&!scene.world.volume)&&!scene.world.pack)chipWait();
  if(statsOn&&!scene.hyb){ /* try the probe at the camera, and time it, before anything else is drawn */
    probePts[0]=cam.pos[0];probePts[1]=cam.pos[1];probePts[2]=cam.pos[2];
    if(probe(scene.world,morphValue(),1)){sPr=performance.now()-sT0;ST.pr+=sPr;ST.pn++;ST.gd=probeOut[0];ST.jd=scene.world.pack?NaN:scene.world.de(cam.pos[0],cam.pos[1],cam.pos[2],morphValue());}
  }

  autoDetail(now,dt);

  readMusic(dt);
  var react=calm?0.25:1,bt=beat*react,lv=level*react;
  var mp=bands.m.p*react,mv=bands.m.lv*react,hp=bands.t.p*react,hv=bands.t.lv*react;
  clock.time+=dt;clock.hueT+=dt*0.017*(1+2.5*hv);
  if(morph)clock.morphT+=dt*(calm?0.4:1)*(1+1.6*mv);
  if(!calm)clock.spin+=dt*0.045;

  /* warp transition between worlds */
  if(tr.warpDir>0){
    tr.warp+=dt/0.5;
    if(tr.warp>=1){tr.warp=1;var wf=tr.warpFn;tr.warpFn=null;tr.pendingWorld=-1;if(wf)wf();tr.warpDir=-1;}
  }else if(tr.warpDir<0){
    tr.warp-=dt/0.8;if(tr.warp<=0){tr.warp=0;tr.warpDir=0;}
  }

  var m=morphValue();
  if(scene.hyb){ /* a second world mixed into this one, either held and breathing or carrying a journey across */
    if(scene.hyb.mode==="trans"){scene.hyb.t+=dt/12;if(scene.hyb.t>=1)finishHybrid();}
    else{
      var ht=scene.hyb.exit?0:(0.5+0.38*Math.sin(clock.time*0.07));
      scene.hyb.t+=(ht-scene.hyb.t)*(1-Math.exp(-dt*0.8));
      if(scene.hyb.exit&&scene.hyb.t<0.02){scene.hyb=null;spawnOrb();}
    }
  }
  var w=scene.world,wB=scene.hyb?WORLDS[scene.hyb.b]:null;
  var wSpeed=scene.hyb?(w.speed+(wB.speed-w.speed)*scene.hyb.t):w.speed;
  var pk=w.pack&&!scene.hyb; /* a pack world: one question to the chip gives all five distances, using the reach worked out last frame */
  if(pk)packFrame(w,m,Math.min(1,Math.max(0.06,packD[0]*5)));
  var dist=pk?packD[0]:Math.abs(deAt(cam.pos[0],cam.pos[1],cam.pos[2],m));
  cam.boost*=Math.exp(-dt*1.2);if(cam.boost<0.01)cam.boost=0;
  if(musicMode==="file"&&player.mode&&!scrubbing&&pDur()>0)showScrub(pPos()/pDur());

  /* journey: autopilot that wanders, steers toward open space, and changes world and palette on its own */
  /* while the user turns the view themselves, by hand or by head, the autopilot's steering pauses and automatic forward motion nearly stops */
  cam.lookAct=userActive(cam.lookAct,cam.userTurn/Math.max(dt,0.004),dt);cam.userTurn=0;
  var travel=journey&&jMove==="travel",hands=1-cam.lookAct,ease=1-0.85*cam.lookAct;
  if(journey&&started){
    if(travel&&landMode){ /* over land the autopilot turns toward whichever side is lower, so it keeps to the valleys, and holds the view a little below level */
      var lrx=lhead[1],lrz=-lhead[0],lc=Math.cos(0.55)*1.3,ls=Math.sin(0.55)*1.3;
      var hL=landH(lpos[0]+lhead[0]*lc-lrx*ls,lpos[2]+lhead[1]*lc-lrz*ls,4),hR=landH(lpos[0]+lhead[0]*lc+lrx*ls,lpos[2]+lhead[1]*lc+lrz*ls,4);
      cam.lookX+=(Math.max(-0.5,Math.min(0.5,(hL-hR)*1.6))+0.08*Math.sin(clock.time*0.13))*dt*hands;
      cam.lookY+=(cam.F[1]+0.10)*0.6*dt*hands;
    }else if(travel){
      var pr=Math.min(1,Math.max(0.06,dist*5));
      var pd=function(sx,sy){
        var d=norm([cam.F[0]+0.7*(cam.R[0]*sx+cam.Up[0]*sy),cam.F[1]+0.7*(cam.R[1]*sx+cam.Up[1]*sy),cam.F[2]+0.7*(cam.R[2]*sx+cam.Up[2]*sy)]);
        return Math.abs(deAt(cam.pos[0]+d[0]*pr,cam.pos[1]+d[1]*pr,cam.pos[2]+d[2]*pr,m));
      };
      var dR=pk?packD[1]:pd(1,0),dL=pk?packD[2]:pd(-1,0),dU=pk?packD[3]:pd(0,1),dD=pk?packD[4]:pd(0,-1);
      cam.lookX+=((dR-dL)/(dR+dL+1e-6)*1.1+0.22*Math.sin(clock.time*0.13)+0.12*Math.sin(clock.time*0.37+1.3))*dt*hands;
      cam.lookY+=((dD-dU)/(dD+dU+1e-6)*1.1+0.16*Math.sin(clock.time*0.11+2.0)+0.10*Math.sin(clock.time*0.29))*dt*hands;
    }
    for(var jk in J)J[jk].t+=dt;
    if(jset){jset.t+=dt;if(jset.t>jset.len)advanceSet();}
    for(var ci=0;ci<CATS.length;ci++){
      var ck=CATS[ci].k,cf=jt[ck];
      if(cf.mode==="off"){if(jCur(ck)!==jNone(ck))jApply(ck,jNone(ck));continue;}
      if(cf.mode!=="random")continue;
      var due=J[ck].t>J[ck].next;
      if(ck==="world"&&cf.trigger==="sound"&&liveAudio()){ /* wait for the music to shift, but never forever */
        due=(soundChanged&&J.world.t>Math.max(10,cf.every*0.25))||J.world.t>cf.every*2.5;
      }
      if(due&&jApply(ck,jPick(ck,cf,jCur(ck),jPool(ck,cf))))jReset(ck);
    }
  }

  wB=scene.hyb?WORLDS[scene.hyb.b]:null; /* journey may have just started a morph */

  /* look */
  var kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),ky=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0);
  userLook(kx*dt*1.2,ky*dt*1.2);
  var f=1-Math.exp(-dt*14),ax=cam.lookX*f,ay=cam.lookY*f;cam.lookX-=ax;cam.lookY-=ay;
  cam.F=rot(cam.F,cam.Up,ax);cam.F=rot(cam.F,cam.R,ay);cam.Up=rot(cam.Up,cam.R,ay);
  var rollT=((keys.KeyE?1:0)-(keys.KeyQ?1:0))*1.2;
  var idle=stick.id===null&&!keys.KeyW&&!keys.KeyS&&!keys.KeyA&&!keys.KeyD;
  if((drift||travel)&&idle&&!calm&&!stereo&&!landMode)rollT+=0.035*hands; /* no automatic roll in the VR viewer */
  cam.rollIn+=(rollT-cam.rollIn)*(1-Math.exp(-dt*4));
  cam.Up=rot(cam.Up,cam.F,-cam.rollIn*dt);
  if(cam.gRoll!==0){cam.Up=rot(cam.Up,cam.F,cam.gRoll);cam.gRoll=0;}
  cam.F=norm(cam.F);cam.R=norm(cross(cam.Up,cam.F));cam.Up=cross(cam.F,cam.R);
  if(landMode&&!stereo&&Math.abs(cam.F[1])<0.97){ /* over land the horizon is eased level */
    var lt=norm([-cam.F[0]*cam.F[1],1-cam.F[1]*cam.F[1],-cam.F[2]*cam.F[1]]),le=1-Math.exp(-dt*3);
    cam.Up=norm([cam.Up[0]+(lt[0]-cam.Up[0])*le,cam.Up[1]+(lt[1]-cam.Up[1])*le,cam.Up[2]+(lt[2]-cam.Up[2])*le]);cam.R=norm(cross(cam.Up,cam.F));cam.Up=cross(cam.F,cam.R);
  }

  /* move: speed scales with distance to the nearest surface */
  var mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+stick.x;
  var mz=(keys.KeyW?1:0)-(keys.KeyS?1:0)-stick.y;
  var my=(keys.Space?1:0)-((keys.ShiftLeft||keys.ShiftRight)?1:0);
  if(started&&idle&&my===0){if(travel)mz+=0.5*ease;else if(drift)mz+=0.3*ease;}
  if(!started){mz=0.18;mx=0;my=0;}
  var sp=Math.min(wSpeed,Math.max(0.012,dist*2.6))*cam.baseSpeed*(1+0.25*lv)*(1+3*cam.boost);
  var tv=[(cam.R[0]*mx+cam.Up[0]*my+cam.F[0]*mz)*sp,(cam.R[1]*mx+cam.Up[1]*my+cam.F[1]*mz)*sp,(cam.R[2]*mx+cam.Up[2]*my+cam.F[2]*mz)*sp];
  var vf=1-Math.exp(-dt*3.5),per=w.period(m),perB=scene.hyb?wB.period(m):null;
  for(var i=0;i<3;i++){
    cam.vel[i]+=(tv[i]-cam.vel[i])*vf;
    cam.pos[i]+=cam.vel[i]*dt;
    var dl=per[i]*Math.floor(cam.pos[i]/per[i]+.5); /* every world repeats, so wrapping by one period is invisible */
    cam.pos[i]-=dl;
    if(scene.hyb&&dl!==0){scene.hyb.off[i]+=dl;scene.hyb.off[i]-=perB[i]*Math.floor(scene.hyb.off[i]/perB[i]+.5);}
  }
  cam.curSpeed=Math.hypot(cam.vel[0],cam.vel[1],cam.vel[2]);
  /* the land has its own position: it goes the way the camera faces, level, and keeps clear of the ground here and ahead */
  if(landMode){
    var fh=Math.hypot(cam.F[0],cam.F[2]);if(fh>0.05){lhead[0]=cam.F[0]/fh;lhead[1]=cam.F[2]/fh;}
    var lsp=0.4*cam.baseSpeed*(1+3*cam.boost),lwant,lk,ld;
    lvel[0]+=((lhead[1]*mx+lhead[0]*mz)*lsp-lvel[0])*vf;lvel[1]+=((-lhead[0]*mx+lhead[1]*mz)*lsp-lvel[1])*vf;
    lpos[0]+=lvel[0]*dt;lpos[2]+=lvel[1]*dt;
    lpos[0]-=LPERIOD*Math.floor(lpos[0]/LPERIOD);lpos[2]-=LPERIOD*Math.floor(lpos[2]/LPERIOD);
    landClimb(my*dt*0.25);
    lwant=landFloor(lpos[0],lpos[2]);
    for(lk=1;lk<=4;lk++){ld=0.22*lk;lwant=Math.max(lwant,landFloor(lpos[0]+lhead[0]*ld,lpos[2]+lhead[1]*ld)-0.10*lk);}
    lwant+=landClear;
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
  var spN=Math.min(1,cam.curSpeed/(wSpeed*cam.baseSpeed+1e-6));

  /* the orb: drawn at its nearest copy, collected when you reach it, moved if the morph swallows it */
  var orbU=[0,0,0,0];
  if(scene.orb&&orbsOn&&!scene.hyb&&started){
    var oq=[0,0,0],od=0;
    for(i=0;i<3;i++){oq[i]=scene.orb.p[i]-cam.pos[i];oq[i]-=per[i]*Math.floor(oq[i]/per[i]+.5);od+=oq[i]*oq[i];}
    if(Math.sqrt(od)<scene.orb.r*2.5&&tr.warpDir===0)collectOrb();
    else{
      orbU=[cam.pos[0]+oq[0],cam.pos[1]+oq[1],cam.pos[2]+oq[2],scene.orb.r];
      scene.orbT+=dt;
      if(scene.orbT>1.5){scene.orbT=0;if(!w.volume&&Math.abs(w.de(scene.orb.p[0],scene.orb.p[1],scene.orb.p[2],m))<scene.orb.r*0.6)spawnOrb();}
    }
  }

  if(ac&&musicMode==="built"&&ac.state==="running"){
    try{filt.frequency.setTargetAtTime(380+spN*1300+180*Math.sin(clock.time*0.13),ac.currentTime,0.6);}catch(_){}
  }

  /* palette eases toward the chosen one */
  var pl=PALETTES[sel.pi],pe=1-Math.exp(-dt*1.6),key,j;
  for(key in palCur){for(j=0;j<3;j++)palCur[key][j]+=(pl[key][j]-palCur[key][j])*pe;}

  /* 1. the fractal */
  var fx=FX[sel.fi],sc=scene.hyb?scene.hyb:w,U=sc.U,wHue=scene.hyb?(w.hue+(wB.hue-w.hue)*scene.hyb.t):w.hue;
  var fovNow=calm?1.15:(1.15-0.13*spN-0.05*bt-0.25*cam.boost+0.025*Math.sin(clock.time*0.4));
  /* 0. the land, if it is on. Alone, it is the whole scene. Over a world, it is drawn first into its own picture with a
     clear sky, so the world need only be drawn where the land leaves it showing. Not in the VR viewer. */
  var landOn=landMode>0&&!stereo&&!!pLand,landOver=landOn&&landMode===2,src=tA;
  if(landOver){landPass(landLayer(),true,fovNow,clock.hueT+wHue);}
  else if(landOn)landPass(tA,false,fovNow,clock.hueT+wHue);
  if(!landOn||landOver){
  gl.bindFramebuffer(gl.FRAMEBUFFER,tA.f);gl.viewport(0,0,tA.w,tA.h);gl.useProgram(sc.prog);
  gl.uniform4f(U.uOrb,orbU[0],orbU[1],orbU[2],orbU[3]);
  if(scene.hyb){gl.uniform1f(U.uMix,scene.hyb.t);gl.uniform3f(U.uOff,scene.hyb.off[0],scene.hyb.off[1],scene.hyb.off[2]);}
  gl.uniform2f(U.uRes,tA.w,tA.h);
  gl.uniform1f(U.uTime,clock.time);
  gl.uniform1f(U.uSeg,mirrors[sel.mi]);
  gl.uniform1f(U.uM,m);
  gl.uniform1f(U.uHue,clock.hueT+wHue);
  gl.uniform1f(U.uSpin,clock.spin);
  gl.uniform1f(U.uFade,1);
  /* VR viewer geometry, from the Cardboard viewer's published numbers: lenses 64 mm apart and 39 mm from the screen.
     The browser does not report the screen's physical size, so one CSS pixel is taken as 0.162 mm, which is close on current phones.
     Eye spacing follows the distance to the nearest surface, so the world always feels a similar size. */
  var vrPx=0.000162*canvas.clientWidth/tA.w,vrTan=vrPx/0.039;
  vrEyeStep(dist,dt);
  gl.uniform4f(U.uVr,stereo?1:0,0.032/vrPx,vrTan,vrEye);
  gl.uniform1f(U.uPix,stereo?vrTan:2/(Math.sqrt(tA.w*tA.h)*1.15));
  gl.uniform1f(U.uFov,fovNow);
  gl.uniform1f(U.uLandOn,landOver&&!LK[landKind].mirror?1:0);if(landOver){bindTex(6,tL.t);gl.uniform1i(U.uLandT,6);}
  gl.uniform1f(U.uBeat,bt);gl.uniform1f(U.uMid,mp);gl.uniform1f(U.uHi,hp);
  gl.uniform3fv(U.uPa,palCur.a);gl.uniform3fv(U.uPb,palCur.b);gl.uniform3fv(U.uPc,palCur.c);gl.uniform3fv(U.uPd,palCur.d);
  gl.uniform3f(U.uPos,cam.pos[0],cam.pos[1],cam.pos[2]);
  camArr[0]=cam.R[0];camArr[1]=cam.R[1];camArr[2]=cam.R[2];camArr[3]=cam.Up[0];camArr[4]=cam.Up[1];camArr[5]=cam.Up[2];camArr[6]=cam.F[0];camArr[7]=cam.F[1];camArr[8]=cam.F[2];
  gl.uniformMatrix3fv(U.uCam,false,camArr);
  gl.drawArrays(gl.TRIANGLES,0,3);
  }
  /* which picture the effects work on: the land laid over the world, the world alone, or the land alone */
  if(landOver&&landFx===0){passTo(landMixed(),pMix);bindTex(0,tA.t);bindTex(1,tL.t);gl.uniform1i(pMix.U.uT,0);gl.uniform1i(pMix.U.uL,1);gl.drawArrays(gl.TRIANGLES,0,3);src=tC;}
  else if(landOver&&landFx===2)src=tL;

  /* 2. feedback: the last frame, warped by the chosen motion and fading, with this frame laid over it */
  var mo=MOTIONS[sel.moi],lk=LOOKS[sel.lki],k60=dt*60,TU=pTrail.U;
  /* VR viewer: filters that move parts of the picture would show each eye something different, so they are left out */
  if(stereo&&(lk.echo||lk.mos||lk.liq||lk.hue||lk.code||(lk.fx>0&&lk.fx<5)))lk=LOOKS[0];
  var tx=clock.hueT+wHue+0.2,tint=[0,0,0];
  for(j=0;j<3;j++)tint[j]=Math.min(1,Math.max(0,palCur.a[j]+palCur.b[j]*Math.cos(6.28318*(palCur.c[j]*tx+palCur.d[j]))));
  var tc=tT[flip.cur],tp=tT[1-flip.cur];
  /* a pack overlay has its own copy of this pass with its code in it */
  var ov=OVERLAYS[sel.ovi],op=ov.code&&!stereo?overlayProg(ov):null;
  if(ov.code&&!op&&!stereo&&!ov.told){ov.told=1;toast("Overlay "+ov.name+" does not work on this device.");}
  if(op)TU=op.U;
  if(sel.ovi>0)updateWave();
  passTo(tc,op||pTrail);bindTex(2,sel.ovi>0?waveTex:src.t);bindTex(1,tp.t);bindTex(0,src.t);
  gl.uniform1i(TU.uA,0);gl.uniform1i(TU.uB,1);gl.uniform1i(TU.uWv,2);
  gl.uniform1f(TU.uDecay,stereo?0:Math.pow(Math.max(fx.decay,mo.decay||0,tr.warp>0?0.9:0),k60)); /* no trails in the VR viewer: they are warped about the middle of the screen */
  gl.uniform1f(TU.uZoom,Math.pow(mo.zoom||0.994,k60)-0.02*tr.warp-0.012*bt*(mo.kick||0));
  gl.uniform1f(TU.uRot,(mo.rot||0)*k60*(1+1.2*mp));
  gl.uniform1f(TU.uSwirl,(mo.swirl||0)*k60);
  gl.uniform1f(TU.uWob,(mo.wob||0)*k60*(1+1.5*mv));
  gl.uniform1f(TU.uRip,(mo.rip||0)*k60*(1+1.5*bt));
  gl.uniform2f(TU.uDrift,(mo.dx||0)*k60,(mo.dy||0)*k60);
  gl.uniform1f(TU.uTime,clock.time);gl.uniform1f(TU.uAsp,tc.w/tc.h);
  gl.uniform1f(TU.uOv,stereo?0:ov.code?(op?99:0):sel.ovi);gl.uniform1f(TU.uOvBeat,bt);gl.uniform1f(TU.uOvMid,mp);gl.uniform1f(TU.uOvHi,hp);
  gl.uniform1f(TU.uShift,sel.moi>0?Math.min(0.3,(0.05+0.1*hp)*k60):0); /* trails drift through the colour channels so they read apart from the scene */
  gl.uniform1f(TU.uOvAmt,OVS[sel.ovsi]);gl.uniform1f(TU.uHue,clock.hueT+wHue);
  gl.uniform3fv(TU.uPa,palCur.a);gl.uniform3fv(TU.uPb,palCur.b);gl.uniform3fv(TU.uPc,palCur.c);gl.uniform3fv(TU.uPd,palCur.d);
  gl.drawArrays(gl.TRIANGLES,0,3);

  /* 3. bloom: bright parts, shrunk and blurred */
  var landLit=landOn&&!(landOver&&landFx===1)?0.3:1; /* glow and colour fringing are made for dark worlds; on a daylit land they wash the sky out, so they are turned down */
  var bloom=fx.bloom*(1+0.7*bt)*landLit+0.5*tr.warp;
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
  var slow=(!!lp&&!lk.reviewed)||(!!op&&!ov.reviewed)||(scene.world.pack&&!scene.world.reviewed&&(!landOn||landOver)),PF=lp||pFinal,FU=PF.U;
  if(slow&&!tF[0]){tF[0]=target(canvas.width,canvas.height);tF[1]=target(canvas.width,canvas.height);}
  passTo(slow?tF[flip.fcur]:null,PF);bindTex(0,tc.t);bindTex(1,tB[0].t);
  bindTex(3,slow?tF[1-flip.fcur].t:tc.t);gl.uniform1i(FU.uPrev,3);gl.uniform1f(FU.uKeep,slow?Math.exp(-dt/0.25):0);
  gl.uniform1i(FU.uT,0);gl.uniform1i(FU.uB,1);
  gl.uniform1f(FU.uLandMix,landOver?landFx:0);if(landOver&&landFx>0){bindTex(6,tL.t);bindTex(7,tA.t);gl.uniform1i(FU.uLandT,6);gl.uniform1i(FU.uSkyT,7);}
  gl.uniform1f(FU.uWarp,tr.warp);gl.uniform1f(FU.uTr,stereo?5:tr.trType);gl.uniform1f(FU.uVr,stereo?1:0); /* VR viewer always uses the blink transition */
  gl.uniform1f(FU.uCA,stereo?0:(fx.ca*(1+1.5*spN)+(sel.fi===2?0:0.006*hp))*landLit+0.012*cam.boost+(lk.ca||0));
  gl.uniform1f(FU.uBloom,bloom);
  gl.uniform1f(FU.uTime,clock.time);gl.uniform1f(FU.uAsp,tc.w/tc.h);gl.uniform2f(FU.uPx,1/tc.w,1/tc.h);
  gl.uniform1f(FU.uLiq,(lk.liq||0)*(1+2*mv));gl.uniform1f(FU.uMos,lk.mos||0);gl.uniform1f(FU.uEcho,lk.echo||0);
  gl.uniform1f(FU.uEdge,lk.edge||0);gl.uniform1f(FU.uPost,lk.post||0);gl.uniform1f(FU.uSolar,lk.solar||0);
  gl.uniform1f(FU.uInv,lk.inv||0);gl.uniform1f(FU.uHueRot,lk.hue||0);
  gl.uniform1f(FU.uFx,lk.fx||0);gl.uniform1f(FU.uHue,clock.hueT+wHue);
  gl.uniform3fv(FU.uPa,palCur.a);gl.uniform3fv(FU.uPb,palCur.b);gl.uniform3fv(FU.uPc,palCur.c);gl.uniform3fv(FU.uPd,palCur.d);
  gl.uniform3f(FU.uTint,tint[0],tint[1],tint[2]);
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(slow){passTo(null,pCopy);bindTex(0,tF[flip.fcur].t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);flip.fcur=1-flip.fcur;}
  flip.cur=1-flip.cur;
  if(statsOn){ST.n++;ST.t+=rawDt;ST.worst=Math.max(ST.worst,rawDt);ST.js+=performance.now()-sT0-sPr;if(ST.t>=0.5)statsShow();}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("enter").addEventListener("click",function(){begin(true)});
$("enterQuiet").addEventListener("click",function(){begin(false)});

/* ---------- loop ---------- */
last=performance.now();
canvas.addEventListener("webglcontextlost",function(e){e.preventDefault();errBox.textContent="The graphics context was lost. Reload the page to continue.";});
requestAnimationFrame(frame);
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get started(){return started},set started(v){started=v}, get last(){return last},set last(v){last=v}, get begin(){return begin}, get camArr(){return camArr}, get frame(){return frame}};
