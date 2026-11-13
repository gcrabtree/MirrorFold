/* The clocks everything animates from. */
export const clock={
  time:0,    /* seconds since the page opened, less any time it was hidden */
  morphT:0,  /* the morph's own clock: it runs only while Morph is on, and faster with the music's mids */
  hueT:0,    /* slow drift through the palette */
  spin:0     /* turn of the mirror fold */
};
export function morphValue(){return Math.sin(clock.morphT*0.09)+0.15*Math.sin(clock.morphT*0.31)}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get clock(){return clock}, get morphValue(){return morphValue}};
