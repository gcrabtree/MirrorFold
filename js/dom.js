/* The page's fixed parts: the canvas, the WebGL context, and small helpers. */
export let canvas, errBox, isTouch, calm, gl, STEPS;

export const $=function(id){return document.getElementById(id)};
export function fr(x){return x-Math.floor(x)}
export function md(x,m){return x-m*Math.floor(x/m)}
export function tile(x,P){return Math.abs(md(x+.5*P,2*P)-P)-.5*P}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
"use strict";
canvas=$("c"), errBox=$("err");
isTouch=("ontouchstart" in window)||navigator.maxTouchPoints>0;
calm=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
$("how").textContent=isTouch
  ? "Left thumb moves. Right thumb looks. Two fingers on the right: pinch for speed, twist to roll. Double-tap for a burst."
  : "Click to capture the mouse. WASD to fly, Space and Shift for up and down, Q and E to roll, wheel for speed. [ and ] change world, P palette, M mirrors, J journey, T tap tempo, B or double-click for a burst.";

gl=canvas.getContext("webgl",{antialias:false,alpha:false,powerPreference:"high-performance"})
     ||canvas.getContext("experimental-webgl");
if(!gl){errBox.textContent="This browser has WebGL turned off, so the fractals cannot draw. Try another browser.";throw new Error("no WebGL");}

STEPS=isTouch?96:120;
}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get $(){return $}, get canvas(){return canvas},set canvas(v){canvas=v}, get errBox(){return errBox},set errBox(v){errBox=v}, get isTouch(){return isTouch},set isTouch(v){isTouch=v}, get calm(){return calm},set calm(v){calm=v}, get gl(){return gl},set gl(v){gl=v},
  get STEPS(){return STEPS},set STEPS(v){STEPS=v}, get fr(){return fr}, get md(){return md}, get tile(){return tile}};
