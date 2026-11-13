/* The camera: where it is, which way it faces, how fast it is going, and how much the user is steering. */
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

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get cam(){return cam}, get userLook(){return userLook}, get userActive(){return userActive}, get rot(){return rot}, get norm(){return norm}, get cross(){return cross}};
