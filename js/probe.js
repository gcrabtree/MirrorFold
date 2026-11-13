import { scene } from "./choose.js";
import { clock, morphValue } from "./clock.js";
import { gl } from "./dom.js";
import { bindTex, link, pCopy, passTo } from "./programs.js";
import { fragSource } from "./shaders.js";
import { tA, target } from "./targets.js";
let probeT=null; /* the 16 by 1 picture the answers are read from */

export const probePts=new Float32Array(48);
export const probePx=new Uint8Array(64);
export const probeOut=new Float32Array(16);
export function probeBuild(w){
  if(w.probe!==undefined)return w.probe;
  var src=fragSource(w);
  try{w.probe=link(src.slice(0,src.indexOf("void main(){"))+[
"uniform vec3 uPts[16];",
"void main(){",
"  vec3 p=vec3(0.0);int k=int(gl_FragCoord.x);",
"  for(int i=0;i<16;i++)if(i==k)p=uPts[i];",
"  float v=clamp((map(p)+8.0)/16.0,0.0,0.999999);",
"  vec3 e=fract(v*vec3(1.0,255.0,65025.0));e.xy-=e.yz/255.0;",
"  gl_FragColor=vec4(e,1.0);",
"}"].join("\n"),["uPts","uM","uTime"]);}catch(e){w.probe=null;}
  return w.probe;
}
export function probe(w,m,n){ /* the distances at the first n points in probePts go into probeOut; false if this world cannot be probed */
  if(w.volume)return false;
  var P=probeBuild(w),i;if(!P)return false;
  if(!probeT)probeT=target(16,1);
  passTo(probeT,P);gl.uniform3fv(P.U.uPts,probePts);gl.uniform1f(P.U.uM,m);gl.uniform1f(P.U.uTime,clock.time);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.readPixels(0,0,16,1,gl.RGBA,gl.UNSIGNED_BYTE,probePx);
  for(i=0;i<n;i++)probeOut[i]=(probePx[4*i]/255+probePx[4*i+1]/65025+probePx[4*i+2]/16581375)*16-8;
  return true;
}

/* Wait for the graphics chip before starting a new picture, by reading one point back from it. Without this the
   browser may queue several pictures ahead of the chip and then stall while it catches up, which shows as stutter
   even though the average rate is high. (Found by accident: with Stats on, whose probe does the same wait, a PC with a
   144 Hz screen ran smoothly, and with it off it stuttered.) A pack world's own probe, later in the frame, does the same job. */
export function chipWait(){
  if(scene.world.volume||scene.hyb||!probe(scene.world,morphValue(),1)){ /* done the way Stats does it: draw into the small picture, then read from it */
    if(!probeT)probeT=target(16,1);
    passTo(probeT,pCopy);bindTex(0,tA.t);gl.uniform1i(pCopy.U.uT,0);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,probePx);
  }
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
/* ---------- the distance probe ----------
   Asks the graphics chip for a world's distance at up to 16 points, using the same GLSL "map" the picture is drawn with.
   Each point is one pixel of a 16 by 1 picture; the distance, kept between -8 and 8, is spread over three colour bytes
   and read back. This is how a world that has no JavaScript distance function (one from a pack) could still be flown
   through. Reading a picture back makes the page wait for the chip, so it is timed (see Stats). */

}

/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get probeT(){return probeT},set probeT(v){probeT=v}, get probePts(){return probePts}, get probePx(){return probePx}, get probeOut(){return probeOut}, get probeBuild(){return probeBuild}, get probe(){return probe},
  get chipWait(){return chipWait}};
