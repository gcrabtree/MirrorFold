/* Drawing one frame: the scene, the trails, the glow, and the finished picture. Each step reads what it needs from fr,
   the frame's notes (see loop.js), and leaves there what later steps need. */
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { clock } from "./clock.js";
import { calm, canvas, gl, toast } from "./dom.js";
import { landFx, landKind, landLayer, landMixed, landMode, landPass, pLand, pMix, tC, tL } from "./land.js";
import { LK } from "./landscapes.js";
import { updateWave, waveTex } from "./listen.js";
import { palCur, setPal } from "./palettes.js";
import { bindTex, filterProg, overlayProg, pBlur, pCopy, pDown, pFinal, pTrail, passTo } from "./programs.js";
import { FX, LOOKS, MOTIONS, OVERLAYS, OVS, mirrors, sel } from "./state.js";
import { tA, tB, tF, tT, target } from "./targets.js";
import { videoUniforms } from "./video.js";
import { stereo, vrEye, vrEyeStep } from "./vr.js";
import { tr } from "./warp.js";
export const camArr=new Float32Array(9); /* the camera's three directions, as the shaders take them */
export const flip={cur:0,fcur:0};         /* which of each pair of pictures is being drawn into this frame: the trails, and the smoothed final picture */


/* Step 1: the land if it is on, then the world. Leaves in fr.src the picture the effects are to work on. */
export function drawScene(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,dist=fr.dist,bt=fr.bt,mp=fr.mp,hp=fr.hp,spN=fr.spN,orbU=fr.orbU;
  var fx=FX[sel.fi],U=w.U,wHue=w.hue;
  var fovNow=calm?1.15:(1.15-0.13*spN-0.05*bt-0.25*cam.boost+0.025*Math.sin(clock.time*0.4));
  /* 0. the land, if it is on. Alone, it is the whole scene. Over a world, it is drawn first into its own picture with a
     clear sky, so the world need only be drawn where the land leaves it showing. Not in the VR viewer. */
  var landOn=landMode>0&&!stereo&&!!pLand,landOver=landOn&&landMode===2,src=tA;
  if(landOver){landPass(landLayer(),true,fovNow,clock.hueT+wHue);}
  else if(landOn)landPass(tA,false,fovNow,clock.hueT+wHue);
  if(!landOn||landOver){
  gl.bindFramebuffer(gl.FRAMEBUFFER,tA.f);gl.viewport(0,0,tA.w,tA.h);gl.useProgram(w.prog);
  gl.uniform4f(U.uOrb,orbU[0],orbU[1],orbU[2],orbU[3]);
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
  setPal(U);
  videoUniforms(U,tA.w,tA.h,!stereo,fr.per);
  gl.uniform3f(U.uPos,cam.pos[0],cam.pos[1],cam.pos[2]);
  camArr[0]=cam.R[0];camArr[1]=cam.R[1];camArr[2]=cam.R[2];camArr[3]=cam.Up[0];camArr[4]=cam.Up[1];camArr[5]=cam.Up[2];camArr[6]=cam.F[0];camArr[7]=cam.F[1];camArr[8]=cam.F[2];
  gl.uniformMatrix3fv(U.uCam,false,camArr);
  gl.drawArrays(gl.TRIANGLES,0,3);
  }
  /* which picture the effects work on: the land laid over the world, the world alone, or the land alone */
  if(landOver&&landFx===0){passTo(landMixed(),pMix);bindTex(0,tA.t);bindTex(1,tL.t);gl.uniform1i(pMix.U.uT,0);gl.uniform1i(pMix.U.uL,1);gl.drawArrays(gl.TRIANGLES,0,3);src=tC;}
  else if(landOver&&landFx===2)src=tL;
  fr.fx=fx;fr.wHue=wHue;fr.landOn=landOn;fr.landOver=landOver;fr.src=src;
}

/* Step 2, feedback: the last frame, warped by the chosen motion and fading, with this frame laid over it, and the overlay drawn in. */
export function drawTrails(fr){
  var dt=fr.dt,bt=fr.bt,mp=fr.mp,mv=fr.mv,hp=fr.hp,fx=fr.fx,wHue=fr.wHue,src=fr.src,j;
  var mo=MOTIONS[sel.moi],lk=LOOKS[sel.lki],k60=dt*60,TU=pTrail.U;
  /* VR viewer: filters that move parts of the picture would show each eye something different, so they are left out */
  if(stereo&&(lk.echo||lk.mos||lk.liq||lk.hue||lk.code||(lk.fx>0&&lk.fx<5)))lk=LOOKS[0];
  var tx=clock.hueT+wHue+0.2,tint=fr.tint;
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
  setPal(TU);
  videoUniforms(TU,tc.w,tc.h,!stereo,null);
  gl.drawArrays(gl.TRIANGLES,0,3);
  fr.lk=lk;fr.ov=ov;fr.op=op;fr.tc=tc;
}

/* Step 3, bloom: the bright parts, shrunk and blurred. */
export function drawBloom(fr){
  var bt=fr.bt,fx=fr.fx,tc=fr.tc,landOn=fr.landOn,landOver=fr.landOver;
  var landLit=landOn&&!(landOver&&landFx===1)?0.3:1; /* glow and colour fringing are made for dark worlds; on a daylit land they wash the sky out, so they are turned down */
  var bloom=fx.bloom*(1+0.7*bt)*landLit+0.5*tr.warp;
  if(bloom>0){
    passTo(tB[0],pDown);bindTex(0,tc.t);gl.uniform1i(pDown.U.uT,0);gl.uniform2f(pDown.U.uPx,1/tc.w,1/tc.h);gl.drawArrays(gl.TRIANGLES,0,3);
    passTo(tB[1],pBlur);bindTex(0,tB[0].t);gl.uniform1i(pBlur.U.uT,0);gl.uniform2f(pBlur.U.uDir,1/tB[0].w,0);gl.drawArrays(gl.TRIANGLES,0,3);
    passTo(tB[0],pBlur);bindTex(0,tB[1].t);gl.uniform2f(pBlur.U.uDir,0,1/tB[0].h);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  fr.landLit=landLit;fr.bloom=bloom;
}

/* Step 4, to the screen: the chosen filter, colour fringing at the edges, bloom, and the transition's twist. */
export function drawFinal(fr){
  var dt=fr.dt,mv=fr.mv,hp=fr.hp,fx=fr.fx,wHue=fr.wHue,spN=fr.spN,lk=fr.lk,ov=fr.ov,op=fr.op,tint=fr.tint,tc=fr.tc,landOn=fr.landOn,landOver=fr.landOver,landLit=fr.landLit,bloom=fr.bloom;
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
  setPal(FU);
  gl.uniform3f(FU.uTint,tint[0],tint[1],tint[2]);
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(slow){passTo(null,pCopy);bindTex(0,tF[flip.fcur].t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);flip.fcur=1-flip.fcur;}
  flip.cur=1-flip.cur;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={camArr, flip, drawScene, drawTrails, drawBloom, drawFinal};
