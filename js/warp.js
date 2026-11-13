/* The transition that covers a change of world, mirrors or land: it winds up, the change happens at its peak, it unwinds. */
import { TRANSITIONS } from "./state.js";
export const tr={
  warp:0,          /* how far through, 0 to 1 */
  warpDir:0,       /* 1 winding up, -1 unwinding, 0 not running */
  warpFn:null,     /* what to do at the peak */
  pendingWorld:-1, /* the world being changed to, or -1 */
  trType:0         /* which of the transition looks is in use */
};
export function beginWarp(){ /* a different transition each time */
  if(tr.warpDir===0&&tr.warp<0.05)tr.trType=(tr.trType+1+Math.floor(Math.random()*(TRANSITIONS-1)))%TRANSITIONS;
  tr.warpDir=1;
}

/* Advance the transition: wind up, do the change at the peak, unwind. */
export function stepWarp(dt){
  if(tr.warpDir>0){
    tr.warp+=dt/0.5;
    if(tr.warp>=1){tr.warp=1;var wf=tr.warpFn;tr.warpFn=null;tr.pendingWorld=-1;if(wf)wf();tr.warpDir=-1;}
  }else if(tr.warpDir<0){
    tr.warp-=dt/0.8;if(tr.warp<=0){tr.warp=0;tr.warpDir=0;}
  }
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get tr(){return tr}, get beginWarp(){return beginWarp}, get stepWarp(){return stepWarp}};
