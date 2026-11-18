// Writes a page that draws every one of the dancers' heads at eight turns round, large, with the shader's own code:
// the lines that draw a head are cut out of FS_TRAIL (js/shaders.js) and run for a grid of heads.
//   node tools/heads.mjs out.html [tilt]      then open it, or use tools/heads.py to make pictures of it
// Rows are the heads (DN_LOOKS of them), columns the turns 0, 45, ... 315 degrees (0 faces the viewer; at 90 the
// face is to the picture's right). tilt leans every head on its neck by that many radians (an argument after the page);
// a nod forward, in radians, is the fifth argument (below nothing looks up).
import fs from "node:fs";
const { FS_TRAIL } = await import("../js/shaders.js"), { DN_LOOKS } = await import("../js/dance.js");
const a = FS_TRAIL.indexOf("vec2 hu=hd.xy-b0.xy"), b = FS_TRAIL.indexOf("if(uVr>0.5)ln*=1.0-smoothstep(1.7,1.8,length(ev));");
if (a < 0 || b < 0) throw new Error("the head's lines were not found in FS_TRAIL");
let head = FS_TRAIL.slice(a, b).trimEnd();
for (let k = 0; k < 3; k++) head = head.slice(0, head.lastIndexOf("}")).trimEnd(); // the figure's own braces
head = head.replace(/uD9\[i\]/g, "FC");
const limb = FS_TRAIL.match(/float limb\(vec2 p,vec2 a,vec2 b\)\{[^\n]*\}/)[0];
const pitch = Number(process.argv[6] || 0), tilt = Number(process.argv[3] || 0), from = Number(process.argv[4] || 0), rows = Number(process.argv[5] || DN_LOOKS), C = 150;
const fs0 = `precision highp float;
uniform vec2 uRes;
${limb}
void main(){
  vec2 g=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/${C}.0;vec2 ci=floor(g);
  float mn=min(uRes.x,uRes.y);vec2 q=gl_FragCoord.xy/mn;
  vec2 mid=vec2((ci.x+0.5)*${C}.0,uRes.y-(ci.y+0.58)*${C}.0)/mn;
  float R=30.0/mn;vec4 hd=vec4(mid,R,ci.y+${from}.0+0.5);float id=floor(hd.w);float wd=1.0;
  vec2 up=vec2(sin(${tilt.toFixed(3)}),cos(${tilt.toFixed(3)}));
  vec4 b0=vec4(mid-up*R*1.4,mid-up*R*4.0);
  vec4 FC=vec4(ci.x*0.7853982,0.0,173.5,floor(255.0*(${pitch.toFixed(3)}/1.8+0.5)));
  float ln=0.0,dk=0.0,rr=0.0;float wl=R*0.34;
  float ds=min(length(q-hd.xy)-hd.z,min(limb(q,b0.xy,b0.zw),limb(q,b0.xy+vec2(-1.33*R,0.0),b0.xy+vec2(1.33*R,0.0))));
  float e=1.0-smoothstep(wl,1.6*wl,ds);
  ln=(1.0-smoothstep(0.35*wl,wl,ds));dk=e;
  ${head}
  vec3 bg=vec3(0.16,0.17,0.2)*(1.0-0.75*dk);
  vec3 col=rr>0.0?vec3(1.0,0.35,0.75):vec3(0.35,0.9,1.0);
  gl_FragColor=vec4(mix(bg,col,min(ln,1.0)),1.0);
}`;
fs.writeFileSync(process.argv[2], `<!doctype html><body style="margin:0;background:#000"><canvas id="c" width="${8 * C}" height="${rows * C}"></canvas><pre id="e" style="color:#f88"></pre><script>
var c=document.getElementById("c"),gl=c.getContext("webgl",{preserveDrawingBuffer:true}),p=gl.createProgram();
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))document.getElementById("e").textContent+=gl.getShaderInfoLog(o);gl.attachShader(p,o);}
sh(gl.VERTEX_SHADER,"attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}");sh(gl.FRAGMENT_SHADER,${JSON.stringify(fs0)});
gl.linkProgram(p);gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.uniform2f(gl.getUniformLocation(p,"uRes"),c.width,c.height);gl.drawArrays(gl.TRIANGLES,0,3);
</script></body>`);
