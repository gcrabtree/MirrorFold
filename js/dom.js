/* The page's fixed parts: the canvas, the WebGL context, and small helpers. */
export let canvas, errBox, isTouch, calm, gl, STEPS;

export const $=function(id){return document.getElementById(id)};
export function fr(x){return x-Math.floor(x)}
export function md(x,m){return x-m*Math.floor(x/m)}
export function tile(x,P){return Math.abs(md(x+.5*P,2*P)-P)-.5*P}

let toastTimer=0;
/* looking around by hand or by head: turn the view and note how much, so the autopilot can stand back */
/* how much the user is steering, 0 to 1, from how fast they are turning the view (radians a second).
   It rises at once and fades over about a second, so small tremors do not count and control comes back gently. */
export function toast(msg){var el=$("toast");el.textContent=msg;el.classList.add("on");clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove("on")},2600);}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
"use strict";
canvas=$("c"), errBox=$("err");
isTouch=("ontouchstart" in window)||navigator.maxTouchPoints>0;
calm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
$("how").textContent=isTouch
  ? "Left thumb moves. Right thumb looks. Two fingers on the right: pinch for speed, twist to roll. Double-tap for a burst."
  : "Click to capture the mouse. WASD to fly, Space and Shift for up and down, Q and E to roll, wheel for speed. [ and ] change world, P palette, M mirrors, J journey, H hold still, G throw a light, T tap tempo, B or double-click for a burst.";

gl=canvas.getContext("webgl",{antialias:false,alpha:false,powerPreference:"high-performance"})
     ||canvas.getContext("experimental-webgl");
if(!gl){errBox.textContent="This browser has WebGL turned off, so the fractals cannot draw. Try another browser.";throw new Error("stop");}

STEPS=isTouch?96:120;
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={$, fr, md, tile, toast, get canvas(){return canvas},set canvas(v){canvas=v}, get errBox(){return errBox},set errBox(v){errBox=v}, get isTouch(){return isTouch},set isTouch(v){isTouch=v}, get calm(){return calm},set calm(v){calm=v}, get gl(){return gl},set gl(v){gl=v},
  get STEPS(){return STEPS},set STEPS(v){STEPS=v}, get toastTimer(){return toastTimer},set toastTimer(v){toastTimer=v}};
