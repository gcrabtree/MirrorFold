/* Drawing one frame: the scene, the trails, the glow, and the finished picture. Each step reads what it needs from fr,
   the frame's notes (see loop.js), and leaves there what later steps need. */
import { fb } from "./fabric.js";
import { cam } from "./camera.js";
import { scene } from "./choose.js";
import { clock } from "./clock.js";
import { calm, canvas, gl, toast } from "./dom.js";
import { landFx, landKind, landLayer, landMixed, landMode, landPass, pLand, pMix, tC, tL } from "./land.js";
import { LK } from "./landscapes.js";
import { updateWave, waveTex } from "./listen.js";
import { danceFill, dnU } from "./dance.js";
import { palCur, setPal } from "./palettes.js";
import { driven } from "./packs.js";
import { packing, pkDeep, pkMix, pkMw, pkWave, pkZoom } from "./packing.js";
import { bindTex, filterProg, overlayProg, pBlur, pCopy, pDown, pFinal, pTrail, passTo } from "./programs.js";
import { doorN, doorTurn, doorU, doorView } from "./doors.js";
import { drawEye, eyeShown, eyeTarget } from "./eye.js";
import { lapOn } from "./lap.js";
import { photoExp, photoFov } from "./photo.js";
import { lwA, lwR } from "./lightwave.js";
import { shaftU } from "./choose.js";
import { rbNone, rbU, rbW } from "./ribbons.js";
import { flitA, flitU } from "./flits.js";
import { peerU } from "./together.js";
import { FX, LOOKS, MOTIONS, OVERLAYS, OVS, mirrors, sel } from "./state.js";
import { inShell, wMc } from "./worlds.js";
import { doorTarget, landQ, tA, tB, tF, tT, target } from "./targets.js";
import { vidAlone, videoScene, videoUniforms } from "./video.js";
import { jit, lens, stillN } from "./still.js";
import { stereo, vrEye, vrEyeStep, vrLens } from "./vr.js";
import { tr } from "./warp.js";
import { zoomUniforms } from "./zoom.js";
export const camArr=new Float32Array(9); /* the camera's three directions, as the shaders take them */
const camWas=new Float32Array([1,0,0,0,1,0,0,0,1]),turnArr=new Float32Array(9); /* the camera's three directions last frame, and this frame's turn from them */
const none32=new Float32Array(32); /* nothing, for the sprites and friends of a world they are not in */
export const flip={cur:0,fcur:0};         /* which of each pair of pictures is being drawn into this frame: the trails, and the smoothed final picture */


/* Draw one world into a picture, as seen from pos. The world in use is drawn with everything that lives in it (the orb,
   the sprites, friends, and a doorway whose picture is door). The world beyond a doorway is drawn with none of those,
   and with nothing nearer than the ring, which stands at clip in it; a strange doorway's far side is also seen turned
   (turn) and from a lens sc times the size. While a loop is flown the things that live in the world are left out too,
   since they would not be where they were when the lap comes round. */
function worldPass(w,T,pos,per,fr,fovNow,L,bt,mp,hp,landOver,door,clip,turn,sc){
  var U=w.U,main=!clip,live=main&&!lapOn(),orbU=fr.orbU,sparkU=fr.sparkU,R,Up,F,mc;
  gl.bindFramebuffer(gl.FRAMEBUFFER,T.f);gl.viewport(0,0,T.w,T.h);gl.useProgram(w.prog);
  gl.uniform4f(U.uOrb,orbU[0],orbU[1],orbU[2],live?orbU[3]:0);gl.uniform4f(U.uSpark,sparkU[0],sparkU[1],sparkU[2],live?sparkU[3]:0);
  gl.uniform2f(U.uRes,T.w,T.h);
  gl.uniform1f(U.uTime,clock.time);
  gl.uniform1f(U.uSeg,mirrors[sel.mi]);
  gl.uniform1f(U.uM,fr.m);
  mc=wMc();gl.uniform4f(U.uMc,mc[0],mc[1],mc[2],mc[3]); /* what the worlds have of the clocks besides the morph (js/worlds.js) */
  gl.uniform1f(U.uHue,clock.hueT+w.hue);
  gl.uniform1f(U.uSpin,clock.spin);
  gl.uniform1f(U.uFade,1);gl.uniform2f(U.uJit,jit[0],jit[1]);
  gl.uniform4f(U.uVr,stereo?1:0,L.off,L.tan,vrEye);gl.uniform3f(U.uLn,L.k1,L.k2,L.cy);
  gl.uniform1f(U.uPix,stereo?L.tan:2/(Math.sqrt(T.w*T.h)*1.15));
  gl.uniform1f(U.uFov,fovNow);gl.uniform1f(U.uExp,photoExp()); /* photo mode's Brightness; 1 outside it */
  gl.uniform1f(U.uLandOn,landOver&&!LK[landKind].mirror?1:0);bindTex(6,landOver?tL.t:null);gl.uniform1i(U.uLandT,6); /* always a unit of its own: left at unit 0 it can name the very picture being drawn into, and the chip then refuses to draw */
  gl.uniform1f(U.uBeat,bt);gl.uniform1f(U.uMid,mp);gl.uniform1f(U.uHi,hp);
  setPal(U);
  videoUniforms(U,T.w,T.h,!stereo,per);
  gl.uniform4fv(U.uFl,live?flitU:none32);gl.uniform1fv(U.uFlA,flitA);gl.uniform4fv(U.uPe,live?peerU:none32.subarray(0,peerU.length));
  gl.uniform4fv(U.uRb,live?rbU:rbNone);gl.uniform1f(U.uRbW,live?rbW:0);
  gl.uniform3f(U.uLens,lens[0]*sc,lens[1]*sc,lens[2]*sc);
  gl.uniform1f(U.uPk,packing); /* the packing is the same both sides of a doorway */
  gl.uniform3f(U.uLwR,lwR[0]*sc,lwR[1]*sc,lwR[2]*sc);gl.uniform3f(U.uLwA,lwA[0],lwA[1],lwA[2]); /* the light wave, at the far side's scale beyond a doorway */
  var sh=shaftU(w,pos);gl.uniform3f(U.uSh,sh[0],sh[1],sh[2]);
  gl.uniform1f(U.uInv,inShell(w)); /* inside out is the same both sides too, each world with its own shell */
  if(w.packs){var mw=pkMw();gl.uniform2f(U.uPkO,pkWave?1:0,pkMix?1:0);gl.uniform4f(U.uMw,mw[0],mw[1],mw[2],mw[3]);gl.uniform1f(U.uPkZ,pkDeep(w)?pkZoom(pos,w.grid):1);}
  gl.uniform1f(U.uSurf,sel.si);if(per)gl.uniform3f(U.uPer,per[0],per[1],per[2]);
  /* the doorway: its ring and the picture inside it for the world in use; for the world beyond, where the ring stands in it. The picture has a unit of its own for the same reason the land's has. */
  bindTex(4,door?door.t:null);gl.uniform1i(U.uDoorT,4);
  gl.uniform4f(U.uDoor,doorU[0],doorU[1],doorU[2],main&&door?doorU[3]:0);gl.uniform3f(U.uDoorN,doorN[0],doorN[1],doorN[2]);
  gl.uniform4f(U.uDoorC,clip?clip[0]:0,clip?clip[1]:0,clip?clip[2]:0,clip?1:0);
  gl.uniform3f(U.uPos,pos[0],pos[1],pos[2]);
  R=doorTurn(turn,cam.R);Up=doorTurn(turn,cam.Up);F=doorTurn(turn,cam.F);
  camArr[0]=R[0];camArr[1]=R[1];camArr[2]=R[2];camArr[3]=Up[0];camArr[4]=Up[1];camArr[5]=Up[2];camArr[6]=F[0];camArr[7]=F[1];camArr[8]=F[2];
  gl.uniformMatrix3fv(U.uCam,false,camArr);
  if(w.flat)zoomUniforms(U,w);
  if(w.sheet)gl.uniform1fv(U.uFb,fb); /* the Fabric's waves (js/fabric.js) */
  gl.drawArrays(gl.TRIANGLES,0,3);
}

/* Step 1: the land if it is on, then the world. Leaves in fr.src the picture the effects are to work on. */
export function drawScene(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,dist=fr.dist,bt=fr.bt,mp=fr.mp,hp=fr.hp,spN=fr.spN,orbU=fr.orbU,sparkU=fr.sparkU;
  var fx=FX[sel.fi],wHue=w.hue;
  if(stillN){bt=0;mp=0;hp=0;} /* while the picture is being sharpened the scene takes nothing from the sound, or the frames would not match */
  var fovNow=(calm?1.15:(1.15-0.13*spN-0.05*bt-0.25*cam.boost+0.025*Math.sin(clock.time*0.4)))*photoFov(); /* photo mode's Zoom */
  /* VR viewer geometry, from the Cardboard viewer's published numbers: lenses 64 mm apart and 39 mm from the screen.
     The browser does not report the screen's physical size, so one CSS pixel is taken as 0.162 mm, which is close on current phones.
     Worked out before anything is drawn, since the effect passes need the numbers whatever the scene is. */
  var L=vrLens(tA.w,tA.h); /* for a headset, its own numbers in place of these (js/vr.js) */
  fr.vrOff=L.off;fr.vrTan=L.tan;fr.vrLn=[L.k1,L.k2,L.cy];
  /* 0. the land, if it is on. Alone, it is the whole scene. Over a world, it is drawn first into its own picture with a
     clear sky, so the world need only be drawn where the land leaves it showing. */
  var landOn=landMode>0&&!!pLand,landOver=landOn&&landMode===2,src=tA;
  if(landOver){landPass(landLayer(),true,fovNow,clock.hueT+wHue);}
  else if(landOn&&landQ<1){ /* the land alone, drawn small and then spread over the whole picture */
    landPass(landLayer(),false,fovNow,clock.hueT+wHue);
    passTo(tA,pCopy);bindTex(0,tL.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
  }
  else if(landOn)landPass(tA,false,fovNow,clock.hueT+wHue);
  /* the video filling the screen takes the world's place (not in the VR viewer, where a flat picture would not sit right for each eye) */
  if((!landOn||landOver)&&vidAlone()&&!stereo)videoScene(tA,mirrors[sel.mi],clock.spin,bt);
  else if(!landOn||landOver){
  /* a doorway in view: the world beyond it is drawn first, into its own picture, and only in the part of the picture the ring can show in */
  var dv=doorView(m,fovNow,tA.w,tA.h,mirrors[sel.mi]>0),dT=null;
  if(dv&&dv.w.prog){
    dT=doorTarget();
    if(dv.box!=="all"){gl.enable(gl.SCISSOR_TEST);gl.scissor(dv.box[0],dv.box[1],dv.box[2],dv.box[3]);}
    worldPass(dv.w,dT,dv.pos,dv.per,fr,fovNow,L,bt,mp,hp,false,null,dv.at,dv.T,dv.s);
    gl.disable(gl.SCISSOR_TEST);
  }
  vrEyeStep(dist,dt); /* VR viewer: eye spacing follows the distance to the nearest surface, so the world always feels a similar size */
  worldPass(w,tA,cam.pos,fr.per,fr,fovNow,L,bt,mp,hp,landOver,dT,null,null,1);
  }
  /* which picture the effects work on: the land laid over the world, the world alone, or the land alone */
  /* VR viewer: the effects are always on everything, since they need one picture that carries the depth of all that is seen */
  if(landOver&&(landFx===0||stereo)){passTo(landMixed(),pMix);bindTex(0,tA.t);bindTex(1,tL.t);gl.uniform1i(pMix.U.uT,0);gl.uniform1i(pMix.U.uL,1);gl.uniform1f(pMix.U.uVr,stereo?1:0);gl.drawArrays(gl.TRIANGLES,0,3);src=tC;}
  else if(landOver&&landFx===2)src=tL;
  fr.fx=fx;fr.wHue=wHue;fr.landOn=landOn;fr.landOver=landOver;fr.src=src;
}

/* Step 2, feedback: the last frame, warped by the chosen motion and fading, with this frame laid over it, and the overlay drawn in. */
export function drawTrails(fr){
  var dt=fr.dt,bt=fr.bt,mp=fr.mp,mv=fr.mv,hp=fr.hp,fx=fr.fx,wHue=fr.wHue,src=fr.src,j;
  var mo=MOTIONS[sel.moi],lk=LOOKS[sel.lki],k60=dt*60,TU=pTrail.U;
  /* VR viewer: a pack filter's code works on the screen, where each eye would be shown something different, so it is left out.
     The built-in filters, the motions and the overlays work on the middle view and carry depth (see VR_GLSL in shaders.js). */
  if(stereo&&lk.code)lk=LOOKS[0];
  var tx=clock.hueT+wHue+0.2,tint=fr.tint;
  for(j=0;j<3;j++)tint[j]=Math.min(1,Math.max(0,palCur.a[j]+palCur.b[j]*Math.cos(6.28318*(palCur.c[j]*tx+palCur.d[j]))));
  var tc=tT[flip.cur],tp=tT[1-flip.cur];
  /* a pack overlay has its own copy of this pass with its code in it */
  var ov=OVERLAYS[sel.ovi],op=ov.code?overlayProg(ov):null;
  if(ov.code&&!op&&!ov.told){ov.told=1;toast("Overlay "+ov.name+" does not work on this device.");}
  if(op)TU=op.U;
  if(sel.ovi>0)updateWave();
  passTo(tc,op||pTrail);bindTex(2,sel.ovi>0?waveTex:src.t);bindTex(1,tp.t);bindTex(0,src.t);
  gl.uniform1i(TU.uA,0);gl.uniform1i(TU.uB,1);gl.uniform1i(TU.uWv,2);
  gl.uniform1f(TU.uDecay,Math.pow(Math.max(fx.decay,mo.decay||0,tr.warp>0?0.9:0),k60));
  /* VR viewer: which way each of this frame's directions pointed last frame (the camera's axes then, dotted with its axes now),
     so the trails stay where they are in the world when the head turns; and the depth the overlay floats at, a little in
     front of the nearest surface (whose eta is the eye spacing over its distance), swelling toward the viewer on the beat. */
  var ax=[cam.R,cam.Up,cam.F],ii,jj;
  for(jj=0;jj<3;jj++)for(ii=0;ii<3;ii++)turnArr[3*jj+ii]=camWas[3*ii]*ax[jj][0]+camWas[3*ii+1]*ax[jj][1]+camWas[3*ii+2]*ax[jj][2];
  for(ii=0;ii<3;ii++){camWas[3*ii]=ax[ii][0];camWas[3*ii+1]=ax[ii][1];camWas[3*ii+2]=ax[ii][2];}
  gl.uniform1f(TU.uVr,stereo?1:0);gl.uniform4f(TU.uVrG,fr.vrOff,fr.vrTan,0,0);gl.uniform3fv(TU.uLn,fr.vrLn);gl.uniform2f(TU.uRes,tc.w,tc.h);
  gl.uniformMatrix3fv(TU.uTurn,false,turnArr);
  gl.uniform1f(TU.uOvEta,Math.min(0.05,1.25*vrEye/Math.max(fr.dist,1e-6)*(1+0.2*bt)));
  /* each of the motion's numbers as it is this frame: a driver may move it with a slow wave or with the sound */
  var dv=function(f,def){return driven(mo,f,def,clock.time,bt,mp,hp,calm?0.25:1)};
  gl.uniform1f(TU.uZoom,Math.pow(dv("zoom",0.994),k60)-0.02*tr.warp-0.012*bt*(mo.kick||0));
  gl.uniform1f(TU.uRot,dv("rot",0)*k60*(1+1.2*mp));
  gl.uniform1f(TU.uSwirl,dv("swirl",0)*k60);
  gl.uniform1f(TU.uWob,dv("wob",0)*k60*(1+1.5*mv));
  gl.uniform1f(TU.uRip,dv("rip",0)*k60*(1+1.5*bt));
  gl.uniform2f(TU.uDrift,dv("dx",0)*k60,dv("dy",0)*k60);
  gl.uniform1f(TU.uTime,clock.time);gl.uniform1f(TU.uAsp,stereo?1:tc.w/tc.h);
  gl.uniform1f(TU.uOv,ov.code?(op?99:0):sel.ovi);gl.uniform1f(TU.uOvBeat,bt);gl.uniform1f(TU.uOvMid,mp);gl.uniform1f(TU.uOvHi,hp);
  gl.uniform1f(TU.uShift,sel.moi>0?Math.min(0.3,(0.05+0.1*hp)*k60):0); /* trails drift through the colour channels so they read apart from the scene */
  gl.uniform1f(TU.uOvAmt,OVS[sel.ovsi]);gl.uniform1f(TU.uHue,clock.hueT+wHue);
  if(ov.dance){danceFill(ov.dance,stereo?1:tc.w/tc.h);for(j=0;j<10;j++)gl.uniform4fv(TU["uD"+j],dnU[j]);} /* the dancers' joints */
  setPal(TU);
  videoUniforms(TU,tc.w,tc.h,!stereo,null);
  gl.drawArrays(gl.TRIANGLES,0,3);
  fr.lk=lk;fr.ov=ov;fr.op=op;fr.tc=tc;
}

/* Step 3, bloom: the bright parts, shrunk and blurred. */
export function drawBloom(fr){
  var bt=fr.bt,fx=fr.fx,tc=fr.tc,landOn=fr.landOn,landOver=fr.landOver;
  var landLit=landOn&&!(landOver&&landFx===1&&!stereo)?0.3:1; /* glow and colour fringing are made for dark worlds; on a daylit land they wash the sky out, so they are turned down */
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
  /* the eye is drawn last, with the finished picture in its pupil, so the finished picture goes into a picture of its own first */
  var eye=eyeShown(),done=slow?tF[flip.fcur]:eye?eyeTarget(canvas.width,canvas.height):null;
  passTo(done,PF);bindTex(0,tc.t);bindTex(1,tB[0].t);
  bindTex(3,slow?tF[1-flip.fcur].t:tc.t);gl.uniform1i(FU.uPrev,3);gl.uniform1f(FU.uKeep,slow?Math.exp(-dt/0.25):0);
  gl.uniform1i(FU.uT,0);gl.uniform1i(FU.uB,1);
  gl.uniform1f(FU.uLandMix,landOver&&!stereo?landFx:0);if(landOver&&landFx>0&&!stereo){bindTex(6,tL.t);bindTex(7,tA.t);gl.uniform1i(FU.uLandT,6);gl.uniform1i(FU.uSkyT,7);}
  var ca=(fx.ca*(1+1.5*spN)+(sel.fi===2?0:0.006*hp))*landLit+0.012*cam.boost+(lk.ca||0);
  /* VR viewer: 1 when nothing bends the picture, and it is shown as it is; 2 when a filter, a transition or colour fringing
     does, and the pass works on the middle view and carries depth */
  var vr=!stereo?0:(tr.warp>0||ca>0||lk.echo||lk.mos||lk.liq||lk.hue||(lk.fx>0&&lk.fx<5)||lk.fx===15)?2:1;
  gl.uniform1f(FU.uWarp,tr.warp);gl.uniform1f(FU.uTr,tr.trType);gl.uniform1f(FU.uVr,vr);
  gl.uniform4f(FU.uVrG,fr.vrOff,fr.vrTan,0,0);gl.uniform3fv(FU.uLn,fr.vrLn);gl.uniform2f(FU.uRes,tc.w,tc.h);
  gl.uniform1f(FU.uCA,ca);
  gl.uniform1f(FU.uBloom,bloom);
  gl.uniform1f(FU.uTime,clock.time);gl.uniform1f(FU.uAsp,vr===2?1:tc.w/tc.h);gl.uniform2f(FU.uPx,1/tc.w,1/tc.h);
  gl.uniform1f(FU.uLiq,(lk.liq||0)*(1+2*mv));gl.uniform1f(FU.uMos,lk.mos||0);gl.uniform1f(FU.uEcho,lk.echo||0);
  gl.uniform1f(FU.uEdge,lk.edge||0);gl.uniform1f(FU.uPost,lk.post||0);gl.uniform1f(FU.uSolar,lk.solar||0);
  gl.uniform1f(FU.uInv,lk.inv||0);gl.uniform1f(FU.uHueRot,lk.hue||0);
  gl.uniform1f(FU.uFx,lk.fx||0);gl.uniform1f(FU.uHue,clock.hueT+wHue);
  setPal(FU);
  gl.uniform3f(FU.uTint,tint[0],tint[1],tint[2]);
  gl.drawArrays(gl.TRIANGLES,0,3);
  if(eye)drawEye(fr,done);
  else if(slow){passTo(null,pCopy);bindTex(0,done.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);}
  if(slow)flip.fcur=1-flip.fcur;
  flip.cur=1-flip.cur;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={worldPass, none32, camArr, camWas, turnArr, flip, drawScene, drawTrails, drawBloom, drawFinal};
