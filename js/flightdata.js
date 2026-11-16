/* A recorded flight as data: how a flight is packed into the letters of a link and read back, and where the camera is
   at any moment of it. Nothing here touches the page, so the test tools can run it.
   A flight is its song's number, the worlds it visits, what was showing at the start and each change after (a time, a
   kind such as "palette", and the name chosen), and the camera twice a second: its place as a part of the world's
   repeat, the way it faces, its roll, the morph's clock, and which world it is in. */
export const FL_DT=0.5;          /* seconds between two samples of the camera */
export const FL_MAX=240;         /* the longest flight, in seconds: about ten thousand letters of link */
export const FL_BYTES=15;        /* bytes in a sample: seven numbers of two bytes and the world's place in the list */
export const FL_TURN=200*Math.PI; /* the morph's clock comes round in this time (both of its waves do), so it is stored within it */
export const FL_KINDS=["world","palette","mirrors","motion","filter","overlay","surface","land","packing"];

function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function unit(v){var l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];}
/* For a facing direction, the two directions that roll is measured from: level to the right, and up. Looking straight up or down there is no level, so another axis is used. */
function refs(F){
  var R=cross([0,1,0],F);
  if(Math.hypot(R[0],R[1],R[2])<1e-3)R=cross([1,0,0],F);
  R=unit(R);return [R,cross(F,R)];
}
function u16(x){return Math.max(0,Math.min(65535,Math.round(x*65535)));}
/* One sample as eight whole numbers: the place as parts of the period, turn, tilt, roll, the morph's clock, the world's number. */
export function flSample(pos,per,F,Up,morphT,wi){
  var rf=refs(F),i,o=[],mt2,mt=morphT%FL_TURN;if(mt<0)mt+=FL_TURN;
  for(i=0;i<3;i++){mt2=pos[i]/per[i]+0.5;o.push(u16(mt2-Math.floor(mt2)));} /* a place outside the repeat is the same place inside it */
  o.push(u16(Math.atan2(F[0],F[2])/(2*Math.PI)+0.5),u16(Math.asin(Math.max(-1,Math.min(1,F[1])))/Math.PI+0.5));
  o.push(u16(Math.atan2(Up[0]*rf[0][0]+Up[1]*rf[0][1]+Up[2]*rf[0][2],Up[0]*rf[1][0]+Up[1]*rf[1][1]+Up[2]*rf[1][2])/(2*Math.PI)+0.5));
  o.push(u16(mt/FL_TURN),wi&255);
  return o;
}
/* A sample read back from the bytes: the place still as parts of the period (-0.5 to 0.5), the facing and up directions, the morph's clock and the world's number. */
export function flRead(bytes,i){
  var b=i*FL_BYTES,n=function(k){return (bytes[b+2*k]|(bytes[b+2*k+1]<<8))/65535;};
  var yaw=(n(3)-0.5)*2*Math.PI,pit=(n(4)-0.5)*Math.PI,roll=(n(5)-0.5)*2*Math.PI;
  var F=[Math.cos(pit)*Math.sin(yaw),Math.sin(pit),Math.cos(pit)*Math.cos(yaw)],rf=refs(F),c=Math.cos(roll),s=Math.sin(roll);
  return {q:[n(0)-0.5,n(1)-0.5,n(2)-0.5],F:F,Up:[rf[1][0]*c+rf[0][0]*s,rf[1][1]*c+rf[0][1]*s,rf[1][2]*c+rf[0][2]*s],mt:n(6)*FL_TURN,w:bytes[b+14]};
}
export function flWrite(bytes,i,smp){
  var b=i*FL_BYTES,k;
  for(k=0;k<7;k++){bytes[b+2*k]=smp[k]&255;bytes[b+2*k+1]=(smp[k]>>8)&255;}
  bytes[b+14]=smp[7];
}
/* Where the camera is at time t of a flight, if it is then in world number cur: {pos, F, Up, mt}, or null if the flight
   is in another world at that moment (around a change of world). per(w, mt) gives a world's period at a morph clock.
   Between samples the place follows a smooth curve through them, going the short way where the world wraps. */
export function flAt(fl,t,cur,per){
  var n=fl.n,x=Math.max(0,Math.min(n-1,t/FL_DT)),i=Math.min(n-1,Math.floor(x)),u=x-i,j=Math.min(n-1,i+1);
  var A=flRead(fl.bytes,i),B=flRead(fl.bytes,j),k,P,pa,pb,p0,p3,Z,T,g,ta,tb,h1,h2,h3,h4,pos=[0,0,0],F,Up,R,mt;
  if(A.w!==cur&&B.w!==cur)return null;
  if(A.w!==cur){A=B;u=0;}else if(B.w!==cur){B=A;u=0;}
  P=per(cur,A.mt);
  Z=i>0?flRead(fl.bytes,i-1):A;if(Z.w!==cur)Z=A;
  T=j<n-1?flRead(fl.bytes,j+1):B;if(T.w!==cur)T=B;
  h1=2*u*u*u-3*u*u+1;h2=u*u*u-2*u*u+u;h3=-2*u*u*u+3*u*u;h4=u*u*u-u*u;
  for(k=0;k<3;k++){
    g=function(a,b){var d=b-a;return (d-Math.round(d))*P[k];}; /* the short way from one part of the period to another, in the world's units */
    pa=A.q[k]*P[k];pb=pa+g(A.q[k],B.q[k]);p0=pa-g(Z.q[k],A.q[k]);p3=pb+g(B.q[k],T.q[k]);
    ta=(pb-p0)/2;tb=(p3-pa)/2;
    pos[k]=h1*pa+h2*ta+h3*pb+h4*tb;
    pos[k]-=P[k]*Math.floor(pos[k]/P[k]+0.5);
  }
  F=unit([A.F[0]+(B.F[0]-A.F[0])*u,A.F[1]+(B.F[1]-A.F[1])*u,A.F[2]+(B.F[2]-A.F[2])*u]);
  Up=[A.Up[0]+(B.Up[0]-A.Up[0])*u,A.Up[1]+(B.Up[1]-A.Up[1])*u,A.Up[2]+(B.Up[2]-A.Up[2])*u];
  R=unit(cross(Up,F));Up=cross(F,R);
  mt=B.mt-A.mt;mt-=FL_TURN*Math.round(mt/FL_TURN);mt=A.mt+mt*u;if(mt<0)mt+=FL_TURN;
  return {pos:pos,F:F,Up:Up,R:R,mt:mt};
}
function b64(bytes){
  var s="",i;for(i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unb64(t){
  var s=atob(t.replace(/-/g,"+").replace(/_/g,"/")),o=new Uint8Array(s.length),i;
  for(i=0;i<s.length;i++)o[i]=s.charCodeAt(i);
  return o;
}
/* A flight as the text that goes in a link: what was chosen, as letters, a full stop, and the camera's samples, as letters. */
export function flPack(fl){
  var head=JSON.stringify({v:1,seed:fl.seed>>>0,w:fl.worlds,e:fl.ev.map(function(e){return [Math.round(e[0]*10)/10,FL_KINDS.indexOf(e[1]),e[2]];})});
  return b64(new TextEncoder().encode(head))+"."+b64(fl.bytes.subarray(0,fl.n*FL_BYTES));
}
/* A flight read back from a link's text, or null if it is not one. Everything in it is checked: it is only ever numbers,
   and names that are looked up among the app's own lists. Nothing from it is run, shown as a page, or used as an address. */
export function flUnpack(text){
  var parts,h,bytes,n,ev=[],i,e,okName=function(s){return typeof s==="string"&&s.length>0&&s.length<=60;};
  try{
    if(typeof text!=="string"||text.length>40000||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text))return null;
    parts=text.split(".");
    h=JSON.parse(new TextDecoder().decode(unb64(parts[0])));bytes=unb64(parts[1]);
    if(!h||h.v!==1||!Array.isArray(h.w)||!Array.isArray(h.e)||h.w.length<1||h.w.length>64||h.e.length>600||!h.w.every(okName))return null;
    n=Math.floor(bytes.length/FL_BYTES);
    if(n<2||n>FL_MAX/FL_DT+2)return null;
    for(i=0;i<n;i++)if(bytes[i*FL_BYTES+14]>=h.w.length)return null;
    for(i=0;i<h.e.length;i++){
      e=h.e[i];
      if(!Array.isArray(e)||typeof e[0]!=="number"||!isFinite(e[0])||e[0]<0||e[0]>FL_MAX+5||!FL_KINDS[e[1]]||!okName(e[2]))return null;
      ev.push([e[0],FL_KINDS[e[1]],e[2]]);
    }
    ev.sort(function(a,b){return a[0]-b[0];});
    return {seed:(typeof h.seed==="number"&&isFinite(h.seed)?h.seed:0)>>>0,worlds:h.w.slice(),ev:ev,n:n,bytes:bytes};
  }catch(_){return null;}
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={FL_DT, FL_MAX, FL_BYTES, FL_TURN, FL_KINDS, flSample, flRead, flWrite, flAt, flPack, flUnpack};
