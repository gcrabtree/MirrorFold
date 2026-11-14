/* The camera: where it is, which way it faces, how fast it is going, and how much the user is steering. */
import { drift } from "./controls.js";
import { calm } from "./dom.js";
import { keys, stick } from "./input.js";
import { landMode } from "./land.js";
import { started } from "./loop.js";
import { still } from "./still.js";
import { stereo } from "./vr.js";
export const cam={
  pos:[0,0,0],            /* place in the world, wrapped by the world's period every frame */
  R:[1,0,0],Up:[0,1,0],F:[0,0,1], /* right, up and forward: three unit vectors at right angles */
  vel:[0,0,0],
  lookX:0,lookY:0,        /* turning still to be applied, eased in over a few frames */
  rollIn:0,gRoll:0,       /* roll rate from the keys, and a roll from a two-finger twist waiting to be applied */
  userTurn:0,lookAct:0,   /* how much the user turned the view this frame, and how actively they are steering (0 to 1) */
  baseSpeed:1,curSpeed:0,boost:0
};
export function userLook(dx,dy){cam.lookX+=dx;cam.lookY+=dy;cam.userTurn+=Math.hypot(dx,dy);}
export function userActive(act,rate,dt){
  var want=Math.min(1,Math.max(0,(rate-0.08)/0.42));
  return act+(want-act)*(1-Math.exp(-dt*(want>act?12:1.4)));
}
export function rot(v,a,ang){
  var c=Math.cos(ang),s=Math.sin(ang),d=(a[0]*v[0]+a[1]*v[1]+a[2]*v[2])*(1-c);
  return [v[0]*c+(a[1]*v[2]-a[2]*v[1])*s+a[0]*d,
          v[1]*c+(a[2]*v[0]-a[0]*v[2])*s+a[1]*d,
          v[2]*c+(a[0]*v[1]-a[1]*v[0])*s+a[2]*d];
}
export function norm(v){var l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]}
export function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}

/* Work out how much the user is steering. While they turn the view themselves, by hand or by head, the autopilot's steering pauses (hands) and automatic forward motion nearly stops (ease). */
export function steering(fr,travel){
  var dt=fr.dt;
  cam.lookAct=userActive(cam.lookAct,cam.userTurn/Math.max(dt,0.004),dt);cam.userTurn=0;
  fr.travel=travel;fr.hands=1-cam.lookAct;fr.ease=1-0.85*cam.lookAct;
}

/* Turn the camera: apply the look that is waiting, roll, and keep the three directions at right angles. Over land the horizon is eased level. */
export function turn(fr){
  var dt=fr.dt,travel=fr.travel,hands=fr.hands;
  var kx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),ky=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0);
  userLook(kx*dt*1.2,ky*dt*1.2);
  var f=1-Math.exp(-dt*14),ax=cam.lookX*f,ay=cam.lookY*f;cam.lookX-=ax;cam.lookY-=ay;
  if(still&&Math.abs(cam.lookX)+Math.abs(cam.lookY)<2e-4){ax+=cam.lookX;ay+=cam.lookY;cam.lookX=cam.lookY=0;} /* holding still: finish the turn, so the view comes to a full stop */
  fr.lx=ax;fr.ly=ay;
  cam.F=rot(cam.F,cam.Up,ax);cam.F=rot(cam.F,cam.R,ay);cam.Up=rot(cam.Up,cam.R,ay);
  var rollT=((keys.KeyE?1:0)-(keys.KeyQ?1:0))*1.2;
  var idle=stick.id===null&&!keys.KeyW&&!keys.KeyS&&!keys.KeyA&&!keys.KeyD;
  if((drift||travel)&&idle&&!calm&&!stereo&&!landMode&&!still)rollT+=0.035*hands; /* no automatic roll in the VR viewer */
  cam.rollIn+=(rollT-cam.rollIn)*(1-Math.exp(-dt*4));
  if(still&&rollT===0&&Math.abs(cam.rollIn)<2e-3)cam.rollIn=0;
  cam.Up=rot(cam.Up,cam.F,-cam.rollIn*dt);
  fr.gr=cam.gRoll;
  if(cam.gRoll!==0){cam.Up=rot(cam.Up,cam.F,cam.gRoll);cam.gRoll=0;}
  cam.F=norm(cam.F);cam.R=norm(cross(cam.Up,cam.F));cam.Up=cross(cam.F,cam.R);
  if(landMode&&!stereo&&Math.abs(cam.F[1])<0.97){ /* over land the horizon is eased level */
    var lt=norm([-cam.F[0]*cam.F[1],1-cam.F[1]*cam.F[1],-cam.F[2]*cam.F[1]]),le=1-Math.exp(-dt*3);
    cam.Up=norm([cam.Up[0]+(lt[0]-cam.Up[0])*le,cam.Up[1]+(lt[1]-cam.Up[1])*le,cam.Up[2]+(lt[2]-cam.Up[2])*le]);cam.R=norm(cross(cam.Up,cam.F));cam.Up=cross(cam.F,cam.R);
  }
  fr.idle=idle;
}

/* Move the camera. Speed scales with the distance to the nearest surface; the position is wrapped by the world's period, which is invisible because every world repeats. */
export function move(fr){
  var dt=fr.dt,m=fr.m,w=fr.w,wSpeed=fr.wSpeed,dist=fr.dist,lv=fr.lv,idle=fr.idle,travel=fr.travel,ease=fr.ease;
  var mx=(keys.KeyD?1:0)-(keys.KeyA?1:0)+stick.x;
  var mz=(keys.KeyW?1:0)-(keys.KeyS?1:0)-stick.y;
  var my=(keys.Space?1:0)-((keys.ShiftLeft||keys.ShiftRight)?1:0);
  fr.uz=mz;
  if(started&&idle&&my===0){if(travel)mz+=0.5*ease;else if(drift&&!still)mz+=0.3*ease;}
  if(!started){mz=0.18;mx=0;my=0;}
  var sp=Math.min(wSpeed,Math.max(0.012,dist*2.6))*cam.baseSpeed*(1+0.25*lv)*(1+3*cam.boost);
  var tv=[(cam.R[0]*mx+cam.Up[0]*my+cam.F[0]*mz)*sp,(cam.R[1]*mx+cam.Up[1]*my+cam.F[1]*mz)*sp,(cam.R[2]*mx+cam.Up[2]*my+cam.F[2]*mz)*sp];
  var rest=still&&mx===0&&my===0&&mz===0; /* holding still with no movement asked for: stop quickly, then fully */
  var vf=1-Math.exp(-dt*(rest?10:3.5)),per=w.period(m);
  if(rest&&Math.hypot(cam.vel[0],cam.vel[1],cam.vel[2])<0.002*sp)cam.vel=[0,0,0];
  for(var i=0;i<3;i++){
    cam.vel[i]+=(tv[i]-cam.vel[i])*vf;
    cam.pos[i]+=cam.vel[i]*dt;
    var dl=per[i]*Math.floor(cam.pos[i]/per[i]+.5); /* every world repeats, so wrapping by one period is invisible */
    cam.pos[i]-=dl;
  }
  cam.curSpeed=Math.hypot(cam.vel[0],cam.vel[1],cam.vel[2]);
  fr.mx=mx;fr.my=my;fr.mz=mz;fr.vf=vf;fr.per=per;
  fr.spN=Math.min(1,cam.curSpeed/(wSpeed*cam.baseSpeed+1e-6)); /* speed as a part of the most this world allows */
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={cam, userLook, userActive, rot, norm, cross, steering, turn, move};
