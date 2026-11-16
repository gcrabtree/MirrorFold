/* The frame loop: the steps of one frame, in order. */
import { scrubFollow } from "./audio.js";
import { move, steering, turn } from "./camera.js";
import { scene } from "./choose.js";
import { clock, morphValue, tickClock } from "./clock.js";
import { morph } from "./controls.js";
import { $, canvas, errBox, toast } from "./dom.js";
import { measure } from "./flight.js";
import { flightClock, flightFrame } from "./flightplay.js";
import { stepFlits } from "./flits.js";
import { wakeHud } from "./input.js";
import { stepZoom } from "./zoom.js";
import { autopilot, jMove, journey, stepJourney } from "./journey.js";
import { landMode, moveLand } from "./land.js";
import { learnFrame, learnOpen, openLearn } from "./learn.js";
import { setMusic, soundFrame } from "./listen.js";
import { midiFrame } from "./midi.js";
import { musicFollowsSpeed } from "./music.js";
import { stepOrb } from "./orbs.js";
import { easePalette } from "./palettes.js";
import { pickFrame } from "./picker.js";
import { pictureFrame } from "./picture.js";
import { preloadFrame } from "./preload.js";
import { chipWait } from "./probe.js";
import { drawBloom, drawFinal, drawScene, drawTrails } from "./render.js";
import { songAim } from "./song.js";
import { sparkFrame, stepSpark } from "./spark.js";
import { still, stillAim, stillBlend } from "./still.js";
import { statsBegin, statsEnd, statsOn } from "./stats.js";
import { autoDetail, detailLower, fellBack } from "./targets.js";
import { stepTogether, togetherClock } from "./together.js";
import { doorSteer, stepDoor } from "./doors.js";
import { videoFrame } from "./video.js";
import { stepWarp } from "./warp.js";
export let started=false; /* the start card has been left */
let last;

function begin(withMusic){
  started=true;$("start").classList.add("gone");
  if(withMusic)setMusic("built");
  wakeHud();
}
/* The frame's notes: what each step of a frame works out and the later steps need. One object, reused every frame,
   and called fr inside the steps. Every field is listed here, so a step never adds one. */
const notes={
  dt:0,                        /* seconds since the last frame, at most 0.05 */
  bt:0,lv:0,                   /* the sound: the beat's pulse and the low end's level */
  mp:0,mv:0,hp:0,hv:0,         /* the mids' pulse and level, the treble's pulse and level */
  m:0,                         /* the morph, about -1.2 to 1.2 */
  w:null,wSpeed:0,pk:false,    /* the world, its top speed, and whether it came from a pack */
  dist:0,                      /* distance from the camera to the nearest surface */
  travel:false,hands:1,ease:1, /* Journey is flying; how much of the steering and of the forward motion the autopilot keeps while the user steers */
  idle:true,                   /* no movement keys or stick in use */
  mx:0,my:0,mz:0,vf:0,         /* this frame's movement input from the user (right, up, forward) and how quickly velocity follows it */
  uz:0,                        /* the forward part of it before any drift or autopilot is added */
  lx:0,ly:0,gr:0,              /* how far the view turned this frame, across and up and down, and how far two fingers twisted it */
  per:null,spN:0,              /* the world's period, and speed as a part of the most the world allows */
  orbU:[0,0,0,0],              /* where to draw the orb, and its size (0 for none) */
  sparkU:[0,0,0,0],            /* the same for the thrown light */
  fx:null,wHue:0,              /* the FX setting and the world's hue shift */
  landOn:false,landOver:false, /* the land is drawn; it is drawn over a world */
  src:null,                    /* the picture the effects work on */
  lk:null,ov:null,op:null,     /* the filter and overlay in use, and the overlay's own program if it has one */
  tint:[0,0,0],tc:null,        /* the palette's colour now, and the picture the trails were drawn into */
  landLit:1,bloom:0,           /* how much glow and fringing the land allows, and the glow's strength */
  vrOff:0,vrTan:0              /* VR viewer: each lens centre's distance from the middle of the picture in pixels, and the tangent of the angle one pixel covers */
};
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){last=now;return;}
  if(learnOpen){learnFrame(now);last=now;return;} /* the lessons cover the page: draw the lesson, and leave the world as it is */
  var rawDt=(now-last)/1000,dt=notes.dt=Math.min(0.05,rawDt);last=now;
  /* wait for the graphics chip (Stats' probe and a pack world's probe do the same job, so not twice) */
  if(!(statsOn&&!scene.world.volume)&&!scene.world.pack)chipWait();
  statsBegin();
  autoDetail(now,dt);
  preloadFrame(rawDt,started); /* make the next program ahead of need, a little each frame */

  /* what time it is, what the music is doing */
  soundFrame(notes);
  if(!still)tickClock(notes,morph,morph===2?songAim(scene.world,clock.time):null); /* Hold still stops the clocks, and with them the morph, the colour drift and the turning mirrors */
  flightClock(notes); /* a recorded flight being played makes its changes and sets the morph (js/flightplay.js) */
  togetherClock(notes); /* flying together: a guest takes the host's world and morph (js/together.js) */
  stepWarp(dt);
  notes.m=morphValue();

  /* flying */
  measure(notes);
  scrubFollow();
  midiFrame(notes);
  steering(notes,journey&&jMove==="travel"&&!still);
  if(journey&&started&&!still){
    if(notes.travel&&!doorSteer(notes))autopilot(notes); /* a doorway ahead with a clear way to it is steered into, and the autopilot left out (js/doors.js) */
    stepJourney(dt);
  }
  turn(notes);
  move(notes);
  stepZoom(notes);
  flightFrame(notes); /* a recorded flight being played puts the camera on its path; one being recorded notes it */
  stepDoor(notes); /* a doorway: opened, closed, and gone through (js/doors.js) */
  if(landMode)moveLand(notes);
  stepOrb(notes);
  sparkFrame(notes);stepSpark(notes);
  stepFlits(notes);
  stepTogether(notes); /* flying together: say where this camera is, and place the others */
  musicFollowsSpeed(notes.spN);

  /* drawing */
  easePalette(dt);
  videoFrame(notes);
  stillAim(notes);
  drawScene(notes);
  stillBlend();
  drawTrails(notes);
  drawBloom(notes);
  drawFinal(notes);
  pickFrame(); /* the list buttons say what is chosen */
  pictureFrame(); /* Save picture takes the frame now, while it is still on the canvas */
  statsEnd(rawDt);
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
$("enter").addEventListener("click",function(){begin(true)});
$("enterQuiet").addEventListener("click",function(){begin(false)});
$("enterLearn").addEventListener("click",function(){begin(false);openLearn();});

last=performance.now();
canvas.addEventListener("webglcontextlost",function(e){e.preventDefault();detailLower();errBox.textContent="The graphics context was lost. Reload the page to continue. It will start less sharp.";});
if(fellBack)toast("The last visit stopped while starting, so the picture starts less sharp.");
requestAnimationFrame(frame);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={begin, notes, frame, get started(){return started},set started(v){started=v}, get last(){return last},set last(v){last=v}};
