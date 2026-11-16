/* Fly together: up to four people in the same world, each seen by the others as a ring of light.
   There is no server. The two browsers talk straight to each other (WebRTC), and they are introduced by hand: the one
   who invites sends a tgLink, the one who joins sends a reply back, and pasting the reply in connects them. The link and
   the reply hold each side's network addresses, which is what lets the browsers find each other.
   The one who invites is the host: the host's world and morph are everyone's, so that all fly through the same shapes,
   and the host passes each guest's place on to the others. The host's palette and filter are everyone's too, each
   time the host changes them, and the host's music is sent to the guests as sound (the same connection carries it),
   so all hear one song and each picture moves to it. Everyone keeps their own flight and the rest of their look. */
import { ac, analyser, ensureAudio } from "./audio.js";
import { cam } from "./camera.js";
import { requestWorld, scene } from "./choose.js";
import { clock } from "./clock.js";
import { $, toast } from "./dom.js";
import { press, wakeHud } from "./input.js";
import { jApply, jCur } from "./journey.js";
import { musicMode, setFriendSound } from "./listen.js";
import { started } from "./loop.js";
import { still } from "./still.js";
import { tr } from "./warp.js";
import { WORLDS } from "./worlds.js";
export const TG_MAX=3;        /* how many others can be seen; the scene shader has a line for each (js/shaders.js) */
export const TG_EVERY=0.1;    /* seconds between the messages each side sends */
export const TG_GONE=5;       /* seconds without a message after which someone is no longer shown */
export const TG_TURN=200*Math.PI; /* the morph's clock comes round in this time */
/* The server asked, once, "what is my address as seen from outside?" when an invitation or a reply is made. Without it
   two people behind different home routers cannot find each other. It is told nothing else. */
export const TG_ICE=[{urls:"stun:stun.l.google.com:19302"}];
export let peerU;              /* for the shader: each other person's place and size (0 for none) */
export let tgRole="";          /* "" alone, "host" having invited, "guest" having joined */
const conns=[];                /* host: one for each guest (the connection, its channel, the guest's number). guest: the one to the host */
const others=[];               /* the people to draw, by number: the world they are in, their place as parts of its repeat, where they are drawn now, and when last heard */
let sendT=0,hostW="",hostT=-1,waitJoin="",lastJoin="";
let hostPal="",hostLook=""; /* guest: the palette and filter the host last named, so that each is taken up once, when the host changes it */
let tap=null,tapGain=null;  /* host: the app's sound as a stream to send, and the gain that shuts it while the microphone is the source */

/* The host's sound as a stream for the guests: whatever the picture is listening to (the built-in music, a file, a
   shared tab), taken where the analyser hears it. Null if this browser has no sound. */
function tgTap(){
  if(tap)return tap;
  if(!ensureAudio())return null;
  try{tapGain=ac.createGain();analyser.connect(tapGain);tap=ac.createMediaStreamDestination();tapGain.connect(tap);}catch(_){tap=null;}
  return tap;
}
/* A session description with its music line set for music: two channels and a fuller sound than the speech it is
   made for by default. Only the line for the Opus sound format is touched, and only by adding to it. */
export function tgMusicSdp(sdp){
  var m=/a=rtpmap:(\d+) opus\/48000\/2/.exec(sdp);
  if(!m)return sdp;
  return sdp.replace(new RegExp("(a=fmtp:"+m[1]+" [^\\r\\n]*)"),function(all,line){
    return line.indexOf("stereo=")>=0?line:line+";stereo=1;sprop-stereo=1;maxaveragebitrate=128000";
  });
}
/* set this side's description, with the music line set for music if the browser takes it that way, and as it was if not */
function tgSetLocal(pc,d){
  var better={type:d.type,sdp:tgMusicSdp(d.sdp)};
  if(better.sdp===d.sdp)return pc.setLocalDescription(d);
  return pc.setLocalDescription(better).catch(function(){return pc.setLocalDescription(d);});
}

function tgB64(bytes){var s="",i;for(i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function tgUnb64(t){var s=atob(t.replace(/-/g,"+").replace(/_/g,"/")),o=new Uint8Array(s.length),i;for(i=0;i<s.length;i++)o[i]=s.charCodeAt(i);return o;}
/* through one of the browser's own packers or unpackers; at most cap bytes are taken out */
function tgPipe(bytes,stream,cap){
  var w=stream.writable.getWriter(),r=stream.readable.getReader(),parts=[],n=0;
  w.write(bytes).catch(function(){});w.close().catch(function(){});
  function more(){return r.read().then(function(x){
    if(x.done){var o=new Uint8Array(n),k=0;parts.forEach(function(p){o.set(p,k);k+=p.length});return o;}
    n+=x.value.length;if(n>cap)throw new Error("too long");
    parts.push(x.value);return more();
  });}
  return more();
}
/* An invitation or a reply as letters for a link: "o" (an offer) or "a" (an answer), and the browser's own description of how to reach it, packed small where the browser can. */
export function tgPack(kind,sdp){
  var raw=new TextEncoder().encode(JSON.stringify({t:kind,s:sdp}));
  if(typeof CompressionStream==="undefined")return Promise.resolve("r"+tgB64(raw));
  return tgPipe(raw,new CompressionStream("deflate-raw"),40000).then(function(z){return "z"+tgB64(z);},function(){return "r"+tgB64(raw);});
}
/* Read one back: {t, s}, or null. The description is only ever handed to the browser's own connection, which reads it as an address list and nothing else. */
export function tgUnpack(text){
  var body,done=function(bytes){
    var o=JSON.parse(new TextDecoder().decode(bytes));
    if(!o||(o.t!=="o"&&o.t!=="a")||typeof o.s!=="string"||o.s.length>20000||o.s.indexOf("v=0")!==0)return null;
    return {t:o.t,s:o.s};
  },none=function(){return null;};
  try{
    if(typeof text!=="string"||text.length<8||text.length>16000||!/^[zr][A-Za-z0-9_-]+$/.test(text))return Promise.resolve(null);
    body=tgUnb64(text.slice(1));
    if(text.charAt(0)==="r")return Promise.resolve(done(body)).catch(none);
    if(typeof DecompressionStream==="undefined")return Promise.resolve(null);
    return tgPipe(body,new DecompressionStream("deflate-raw"),40000).then(done).catch(none);
  }catch(_){return Promise.resolve(null);}
}
function tgPart(x){return typeof x==="number"&&isFinite(x)&&x>=-0.5&&x<=0.5;}
function tgName(x){return typeof x==="string"&&x.length>0&&x.length<=40;}
/* A message from the other side, checked: from a guest {w, q}, its world and its place as parts of the repeat; from the
   host {w, mt, o}, the host's world and morph clock and everyone else as [number, world, three parts]. Anything else
   is null. Only numbers in range and names that are then looked up among this page's own worlds come through. */
export function tgClean(text,fromHost){
  var m,o=[],i,e;
  try{
    if(typeof text!=="string"||text.length>2000)return null;
    m=JSON.parse(text);
    if(!m||typeof m!=="object"||!tgName(m.w))return null;
    if(!fromHost){
      if(!Array.isArray(m.q)||m.q.length!==3||!m.q.every(tgPart))return null;
      return {w:m.w,q:m.q.slice()};
    }
    if(typeof m.mt!=="number"||!isFinite(m.mt)||m.mt<0||m.mt>TG_TURN+1||!Array.isArray(m.o)||m.o.length>TG_MAX)return null;
    if((m.pa!==undefined&&!tgName(m.pa))||(m.lk!==undefined&&!tgName(m.lk)))return null;
    for(i=0;i<m.o.length;i++){
      e=m.o[i];
      if(!Array.isArray(e)||e.length!==5||e[0]!==Math.floor(e[0])||e[0]<0||e[0]>TG_MAX||!tgName(e[1])||!tgPart(e[2])||!tgPart(e[3])||!tgPart(e[4]))return null;
      o.push([e[0],e[1],e[2],e[3],e[4]]);
    }
    return {w:m.w,mt:m.mt,o:o,pa:m.pa||"",lk:m.lk||""};
  }catch(_){return null;}
}
/* note where someone is: their number, the world they are in, their place as parts of its repeat, and the time */
function tgHeard(id,w,q,now){
  var o=null,i;
  for(i=0;i<others.length;i++)if(others[i].id===id)o=others[i];
  if(!o){if(others.length>=TG_MAX)return;o={id:id,w:"",q:[0,0,0],at:null,seen:0};others.push(o);}
  if(o.w!==w)o.at=null; /* a new world: drawn at the new place at once, not slid there */
  o.w=w;o.q=q;o.seen=now;
}
/* Where to draw someone this frame: toward where they last said they were, the short way round the world's repeat, a
   tenth of a second behind, so ten messages a second look like smooth flight. at is where they were drawn last (null
   for nowhere yet). The answer is the copy of them nearest the camera. */
export function tgPlace(at,q,per,camPos,dt){
  var i,t,g,k=1-Math.exp(-dt*10),o=[0,0,0];
  for(i=0;i<3;i++){
    t=q[i]*per[i];
    if(!at)o[i]=t;else{g=t-at[i];g-=per[i]*Math.round(g/per[i]);o[i]=at[i]+g*k;}
    g=o[i]-camPos[i];o[i]=camPos[i]+g-per[i]*Math.round(g/per[i]);
  }
  return o;
}
function tgSay(t){$("tgSay").textContent=t;}
function tgShow(){
  var n=conns.filter(function(c){return c.open}).length;
  $("rowTg").hidden=false;press($("bTg"),true);
  $("bTgLeave").hidden=!tgRole;
  $("bTgInvite").hidden=tgRole==="guest";
  $("tgCode").hidden=!tgRole;$("bTgGo").hidden=!tgRole;
  $("bTgGo").textContent=tgRole==="guest"?"Copy the reply":"Connect";
  $("tgCode").readOnly=tgRole==="guest";
  $("tgCode").placeholder=tgRole==="guest"?"":"Paste your friend's reply here";
  if(tgRole==="host"&&n)tgSay(n===1?"Flying with one friend.":"Flying with "+n+" friends.");
}
/* a new connection, and what to do when its channel opens, speaks and closes */
function tgLink(c,dc){
  c.dc=dc;
  dc.onopen=function(){c.open=true;toast(tgRole==="host"?"Your friend has joined.":"Connected. You are flying together.");if(tgRole==="guest"){tgSay("Flying together. The host's world, palette, filter and music are yours too.");$("tgCode").value="";}tgShow();};
  dc.onclose=function(){tgDrop(c);};
  dc.onmessage=function(e){
    var m=tgClean(e.data,tgRole==="guest"),i;
    if(!m)return;
    if(tgRole==="host"){tgHeard(c.id,m.w,m.q,clock.time);return;}
    hostW=m.w;hostT=m.mt;
    /* the host's palette and filter, each taken up when the host changes it; a name this page does not have is passed over */
    if(m.pa&&m.pa!==hostPal){hostPal=m.pa;jApply("palette",m.pa);}
    if(m.lk&&m.lk!==hostLook){hostLook=m.lk;jApply("filter",m.lk);}
    for(i=0;i<m.o.length;i++)tgHeard(m.o[i][0],m.o[i][1],[m.o[i][2],m.o[i][3],m.o[i][4]],clock.time);
  };
}
function tgDrop(c){
  var i=conns.indexOf(c),k;
  if(i<0)return;
  conns.splice(i,1);
  try{c.pc.close()}catch(_){}
  for(k=others.length-1;k>=0;k--)if(tgRole==="guest"||others[k].id===c.id)others.splice(k,1);
  if(c.open)toast(tgRole==="guest"?"The host has left. You are flying alone.":"A friend has left.");
  if(tgRole==="guest")setFriendSound(null);
  if(tgRole==="guest"||!conns.length){tgRole="";hostW="";hostT=-1;hostPal=hostLook="";tgSay("Fly with a friend: invite them with a link.");}
  tgShow();
}
/* everything the browser has found out about how to reach it, or what it has after four seconds */
function tgGathered(pc){
  return new Promise(function(done){
    var t=setTimeout(done,4000);
    if(pc.iceGatheringState==="complete"){clearTimeout(t);done();return;}
    pc.addEventListener("icegatheringstatechange",function(){if(pc.iceGatheringState==="complete"){clearTimeout(t);done();}});
  });
}
function tgCopy(text,ok,fail){try{navigator.clipboard.writeText(text).then(function(){tgSay(ok)},function(){tgSay(fail)});}catch(_){tgSay(fail);}}
/* Host: make an invitation for one more friend. Gives the link's text (also copied, and shown in the box). */
export function tgInvite(){
  var used={},id=0,i,c,pc;
  if(tgRole==="guest")return Promise.resolve("");
  if(typeof RTCPeerConnection==="undefined"){tgSay("This browser cannot connect two people directly.");return Promise.resolve("");}
  conns.forEach(function(x){used[x.id]=1});
  for(i=1;i<=TG_MAX;i++)if(!used[i]&&!id)id=i;
  if(!id){tgSay("Four people is the most. Someone has to leave first.");return Promise.resolve("");}
  for(i=conns.length-1;i>=0;i--)if(!conns[i].open&&!conns[i].answered){try{conns[i].pc.close()}catch(_){}conns.splice(i,1);} /* an invitation nobody answered is replaced */
  pc=new RTCPeerConnection({iceServers:TG_ICE});c={pc:pc,dc:null,id:id,open:false,answered:false};conns.push(c);
  tgRole="host";tgLink(c,pc.createDataChannel("mirrorfold"));
  if(tgTap())tap.stream.getAudioTracks().forEach(function(t){pc.addTrack(t,tap.stream);}); /* the host's music goes to this guest as sound */
  tgSay("Making the invitation...");tgShow();
  return pc.createOffer().then(function(o){return tgSetLocal(pc,o);}).then(function(){return tgGathered(pc);}).then(function(){
    return tgPack("o",pc.localDescription.sdp);
  }).then(function(text){
    var url=location.href.split("#")[0]+"#join="+text;
    $("tgCode").value="";
    tgCopy(url,"Invitation link copied. Send it to your friend, then paste the reply they send back and press Connect. The link holds your network address, so send it only to them.","Could not copy the link. Allow the clipboard for this page and press Invite again.");
    return text;
  }).catch(function(){tgDrop(c);tgSay("The invitation could not be made.");return "";});
}
/* Host: take a friend's reply and connect. */
export function tgAnswer(text){
  var c=null,i;
  for(i=0;i<conns.length;i++)if(!conns[i].open&&!conns[i].answered)c=conns[i];
  if(!c){tgSay("Press Invite first, and send your friend the link.");return Promise.resolve(false);}
  return tgUnpack(String(text||"").trim()).then(function(m){
    if(!m||m.t!=="a"){tgSay("That is not a reply. Ask your friend for the text their page gave them.");return false;}
    c.answered=true;$("tgCode").value="";tgSay("Connecting...");
    return c.pc.setRemoteDescription({type:"answer",sdp:m.s}).then(function(){return true;},function(){c.answered=false;tgSay("That reply does not fit this invitation. Make a new one.");return false;});
  });
}
/* Guest: take an invitation and make the reply. Gives the reply's text (also copied, and shown in the box). */
export function tgJoin(text){
  if(typeof RTCPeerConnection==="undefined"){tgSay("This browser cannot connect two people directly.");$("rowTg").hidden=false;return Promise.resolve("");}
  return tgUnpack(text).then(function(m){
    var pc,c;
    if(!m||m.t!=="o"){toast("That link is not an invitation this page can read.");return "";}
    tgLeave();
    pc=new RTCPeerConnection({iceServers:TG_ICE});c={pc:pc,dc:null,id:0,open:false,answered:true};conns.push(c);
    tgRole="guest";pc.ondatachannel=function(e){tgLink(c,e.channel);};
    pc.ontrack=function(e){if(e.track&&e.track.kind==="audio"){setFriendSound(e.streams&&e.streams[0]?e.streams[0]:new MediaStream([e.track]));toast("Playing the host's music. Choose another under Music to use your own.");}};
    tgSay("Making your reply...");tgShow();
    return pc.setRemoteDescription({type:"offer",sdp:m.s}).then(function(){return pc.createAnswer();}).then(function(a){return tgSetLocal(pc,a);}).then(function(){return tgGathered(pc);}).then(function(){
      return tgPack("a",pc.localDescription.sdp);
    }).then(function(reply){
      $("tgCode").value=reply;
      tgCopy(reply,"Your reply is copied. Send it back to the friend who invited you. It holds your network address, so send it only to them.","Send the text in the box back to the friend who invited you. It holds your network address, so send it only to them.");
      return reply;
    }).catch(function(){tgDrop(c);tgSay("That invitation could not be used. Ask for a new one.");return "";});
  });
}
export function tgLeave(){
  var cs=conns.slice(),i;
  conns.length=0;others.length=0;
  for(i=0;i<cs.length;i++){try{cs[i].dc&&cs[i].dc.close()}catch(_){}try{cs[i].pc.close()}catch(_){}}
  if(tgRole==="guest")setFriendSound(null);
  tgRole="";hostW="";hostT=-1;hostPal=hostLook="";
  tgSay("Fly with a friend: invite them with a link.");
}
/* True while this page is a guest that has heard from its host: Journey then leaves the choice of world, palette and filter to the host. */
export function tgGuest(){return tgRole==="guest"&&hostT>=0;}
/* A step of the frame, after the clocks. A guest takes the host's world, and eases its morph's clock to the host's, so
   that both fly through the same shapes. An invitation in the page's address is taken up once the start card is left. */
export function togetherClock(fr){
  var i,g;
  if(waitJoin&&started){g=waitJoin;waitJoin="";tgJoin(g);}
  if(!tgGuest()||still)return;
  if(hostW!==scene.world.id&&tr.warpDir===0)for(i=0;i<WORLDS.length;i++)if(WORLDS[i].id===hostW&&!WORLDS[i].pack){requestWorld(i,true);break;}
  if(hostW===scene.world.id){g=hostT-clock.morphT;g-=TG_TURN*Math.round(g/TG_TURN);clock.morphT+=g*(1-Math.exp(-fr.dt*8));if(clock.morphT<0)clock.morphT+=TG_TURN;}
}
/* A step of the frame, after the camera has moved: tell the others where this camera is, ten times a second, and work
   out where to draw each of them. Nobody is drawn in a zoom world or a pack world, or from another world. */
export function stepTogether(fr){
  var w=fr.w,per=fr.per,k,i,o,c,q,msg,list,s=Math.max(0.01,Math.min(0.6,fr.dist)),ok=!!per&&!w.flat&&!w.pack;
  if(!tgRole){for(k=0;k<4*TG_MAX;k++)peerU[k]=0;return;}
  if(tapGain)tapGain.gain.value=musicMode==="mic"?0:1; /* the microphone hears the host's room, which is not music to send on */
  sendT+=fr.dt;
  if(sendT>=TG_EVERY&&per){
    sendT=0;q=[0,0,0];
    for(i=0;i<3;i++){q[i]=cam.pos[i]/per[i];q[i]-=Math.round(q[i]);q[i]=Math.round(q[i]*1e5)/1e5;}
    for(k=0;k<conns.length;k++){
      c=conns[k];if(!c.open||!c.dc||c.dc.readyState!=="open")continue;
      if(tgRole==="guest")msg={w:w.id,q:q};
      else{
        list=[[0,w.id,q[0],q[1],q[2]]];
        others.forEach(function(x){if(x.id!==c.id&&clock.time-x.seen<TG_GONE&&list.length<TG_MAX)list.push([x.id,x.w,x.q[0],x.q[1],x.q[2]]);});
        msg={w:w.id,mt:Math.round((((clock.morphT%TG_TURN)+TG_TURN)%TG_TURN)*100)/100,o:list,pa:jCur("palette"),lk:jCur("filter")};
      }
      try{c.dc.send(JSON.stringify(msg))}catch(_){}
    }
  }
  if(still)return; /* Hold still: the others stay drawn where they were, since the picture being averaged must not change */
  for(k=0;k<4*TG_MAX;k++)peerU[k]=0;
  for(k=0,i=0;k<others.length&&i<TG_MAX;k++){
    o=others[k];
    if(!ok||o.w!==w.id||clock.time-o.seen>TG_GONE){o.at=null;continue;}
    o.at=tgPlace(o.at,o.q,per,cam.pos,fr.dt);
    peerU[4*i]=o.at[0];peerU[4*i+1]=o.at[1];peerU[4*i+2]=o.at[2];peerU[4*i+3]=0.16*s;i++;
  }
}
function tgFromAddress(){
  var h=(location.hash||"").replace("#","");
  if(h.indexOf("join=")!==0||h===lastJoin)return;
  lastJoin=h;
  if(started)tgJoin(h.slice(5));else waitJoin=h.slice(5);
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
peerU=new Float32Array(4*TG_MAX);
tgSay("Fly with a friend: invite them with a link.");
$("bTg").addEventListener("click",function(){var open=$("rowTg").hidden;$("rowTg").hidden=!open;press(this,open||!!tgRole);if(open)tgShow();wakeHud();});
$("bTgInvite").addEventListener("click",function(){tgInvite();wakeHud();});
$("bTgGo").addEventListener("click",function(){
  if(tgRole==="guest")tgCopy($("tgCode").value,"Your reply is copied. Send it back to the friend who invited you.","Select the text in the box and copy it by hand.");
  else tgAnswer($("tgCode").value);
  wakeHud();
});
$("bTgLeave").addEventListener("click",function(){tgLeave();tgShow();toast("You are flying alone.");wakeHud();});
tgFromAddress();
window.addEventListener("hashchange",tgFromAddress);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={tgTap, tgMusicSdp, tgSetLocal, get tgTapOut(){return tap}, get hostPal(){return hostPal}, get hostLook(){return hostLook}, tgHeard, tgLink, tgDrop, tgSay, tgShow, tgCopy, tgPart, tgName, tgPipe, tgGathered, tgB64, tgUnb64, tgFromAddress, TG_MAX, TG_EVERY, TG_GONE, TG_TURN, TG_ICE, conns, others, tgPack, tgUnpack, tgClean, tgPlace, tgInvite, tgAnswer, tgJoin, tgLeave, tgGuest, togetherClock, stepTogether,
  get peerU(){return peerU},set peerU(v){peerU=v}, get tgRole(){return tgRole},set tgRole(v){tgRole=v}, get hostW(){return hostW},set hostW(v){hostW=v}, get hostT(){return hostT},set hostT(v){hostT=v}};
