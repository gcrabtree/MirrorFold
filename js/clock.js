/* The clocks everything animates from. */
import { calm } from "./dom.js";
import { morphSteer } from "./song.js";
export const clock={
  time:0,    /* seconds since the page opened, less any time it was hidden */
  morphT:0,  /* the morph's own clock: it runs only while Morph is on, faster with the music's mids, or is moved to where the song asks */
  hueT:0,    /* slow drift through the palette */
  spin:0     /* turn of the mirror fold */
};
export function morphValue(){return Math.sin(clock.morphT*0.09)+0.15*Math.sin(clock.morphT*0.31)}

/* Advance the clocks by one frame. The treble speeds the colour drift. The morph (morphOn: 0 off, 1 drifting by itself,
   2 following the song) drifts faster with the mids, or, given the morph the song asks for (aim, null for none), has
   its clock moved toward a time that gives it. */
export function tickClock(fr,morphOn,aim){
  var dt=fr.dt;
  clock.time+=dt;clock.hueT+=dt*0.017*(1+2.5*fr.hv);
  if(morphOn===2&&aim!==null&&aim!==undefined){
    clock.morphT=morphSteer(clock.morphT,aim,dt,calm?1.2:3);
    if(clock.morphT<0)clock.morphT+=200*Math.PI; /* both of the morph's waves come round in this time, so the morph is the same and the clock stays above nothing, as share spots need */
  }
  else if(morphOn)clock.morphT+=dt*(calm?0.4:1)*(1+1.6*fr.mv);
  if(!calm)clock.spin+=dt*0.045;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={clock, morphValue, tickClock};
