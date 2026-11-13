import { musicFollowsSpeed, scrubFollow } from "./audio.js";
import { move, steering, turn } from "./camera.js";
import { scene, stepHybrid, stepOrb } from "./choose.js";
import { morphValue, tickClock } from "./clock.js";
import { morph, statsBegin, statsEnd, statsOn } from "./controls.js";
import { $, canvas, errBox } from "./dom.js";
import { measure } from "./flight.js";
import { wakeHud } from "./input.js";
import { autopilot, jMove, journey, stepJourney } from "./journey.js";
import { landMode, moveLand } from "./land.js";
import { setMusic, soundFrame } from "./listen.js";
import { chipWait } from "./probe.js";
import { drawBloom, drawFinal, drawScene, drawTrails, easePalette } from "./render.js";
import { autoDetail } from "./targets.js";
import { stepWarp } from "./warp.js";
export let started=false; /* the start card has been left */
let last;

/* ---------- start ---------- */
function begin(withMusic){
  started=true;$("start").classList.add("gone");
  if(withMusic)setMusic("built");
  wakeHud();
}
/* The frame's notes: what each step of a frame works out and the later steps need. One object, reused every frame,
   and called fr inside the steps.
   dt seconds since the last frame (at most 0.05); bt lv mp mv hp hv the sound; m the morph; w the world; dist the distance
   to the nearest surface; wSpeed the world's top speed; pk whether the world is from a pack; travel hands ease idle how
   much flying the autopilot does; mx my mz vf per spN the movement; orbU where the orb is drawn; then what the drawing
   steps hand on: fx wHue landOn landOver src lk ov op tint tc landLit bloom. */
const notes={};
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){last=now;return;}
  var rawDt=(now-last)/1000,dt=notes.dt=Math.min(0.05,rawDt);last=now;
  /* wait for the graphics chip (Stats' probe and a pack world's probe do the same job, so not twice) */
  if(!(statsOn&&!scene.hyb&&!scene.world.volume)&&!scene.world.pack)chipWait();
  statsBegin();
  autoDetail(now,dt);

  /* what time it is, what the music is doing */
  soundFrame(notes);
  tickClock(notes,morph);
  stepWarp(dt);
  notes.m=morphValue();
  if(scene.hyb)stepHybrid(dt);

  /* flying */
  measure(notes);
  scrubFollow();
  steering(notes,journey&&jMove==="travel");
  if(journey&&started){
    if(notes.travel)autopilot(notes);
    stepJourney(dt);
  }
  turn(notes);
  move(notes);
  if(landMode)moveLand(notes);
  stepOrb(notes);
  musicFollowsSpeed(notes.spN);

  /* drawing */
  easePalette(dt);
  drawScene(notes);
  drawTrails(notes);
  drawBloom(notes);
  drawFinal(notes);
  statsEnd(rawDt);
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
export const __dbg={get started(){return started},set started(v){started=v}, get last(){return last},set last(v){last=v}, get begin(){return begin}, get notes(){return notes}, get frame(){return frame}};
