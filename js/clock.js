/* The clocks everything animates from. */
import { calm } from "./dom.js";
export const clock={
  time:0,    /* seconds since the page opened, less any time it was hidden */
  morphT:0,  /* the morph's own clock: it runs only while Morph is on, and faster with the music's mids */
  hueT:0,    /* slow drift through the palette */
  spin:0     /* turn of the mirror fold */
};
export function morphValue(){return Math.sin(clock.morphT*0.09)+0.15*Math.sin(clock.morphT*0.31)}

/* Advance the clocks by one frame. The treble speeds the colour drift and the mids speed the morph. */
export function tickClock(fr,morphOn){
  var dt=fr.dt;
  clock.time+=dt;clock.hueT+=dt*0.017*(1+2.5*fr.hv);
  if(morphOn)clock.morphT+=dt*(calm?0.4:1)*(1+1.6*fr.mv);
  if(!calm)clock.spin+=dt*0.045;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={clock, morphValue, tickClock};
