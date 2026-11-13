/* The values that more than one file changes: where the camera is, what is showing, what is switched on.
   A file that only reads a value owned by another file imports it by name; a value that several files set lives here,
   because a module may not assign to another module's variable. */
export const G={
  pi:undefined, unlocked:undefined, orbsFound:undefined, probeT:undefined, cur:undefined, fcur:undefined, di:undefined, q:undefined,
  tL:undefined, tC:undefined, tLP:undefined, landClear:undefined, pos:undefined, R:undefined, Up:undefined, F:undefined,
  vel:undefined, lookX:undefined, lookY:undefined, rollIn:undefined, keys:undefined, mi:undefined, fi:undefined, moi:undefined,
  lki:undefined, ovsi:undefined, ovi:undefined, trType:undefined, waveTex:undefined, tbins:undefined, orbsOn:undefined, morph:undefined,
  drift:undefined, started:undefined, journey:undefined, morphT:undefined, time:undefined, hueT:undefined, spin:undefined, baseSpeed:undefined,
  curSpeed:undefined, warp:undefined, warpDir:undefined, warpFn:undefined, pendingWorld:undefined, world:undefined, hyb:undefined, orb:undefined,
  orbT:undefined, boost:undefined, gRoll:undefined, lastHash:undefined, stereo:undefined, vrEye:undefined, gyroPrev:undefined, wakeLock:undefined,
  jMove:undefined, userTurn:undefined, lookAct:undefined, jt:undefined, advT:undefined, advS:undefined, ed:undefined, musicMode:undefined,
  beat:undefined, level:undefined, taps:undefined, tapInt:undefined, tapAt:undefined
};
