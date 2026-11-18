/* Fly together: up to four people in the same world, each seen by the others as a ring of light.
   The browsers talk straight to each other (WebRTC). To find each other they first swap, through a meeting point
   (server/rooms.js, a small script on Cloudflare), a description of how each can be reached. The one who invites
   opens a room there, named by a short code, and sends the link that carries the code. Whoever opens the link is
   joined: their page hands its description to the room, the host's page hands one back, and from then on the meeting
   point is not used. It never sees a place, a world or a note of the music.
   The one who invites is the host: the host's world and morph are everyone's, so that all fly through the same shapes,
   and the host passes each guest's place on to the others. The rest of what the host's Journey changes is everyone's
   too (palette, filter, mirrors, motion, overlay, surface, land, packing), each taken up when the host changes it, and the
   host's music is sent to the guests as sound (the same connection carries it), so all hear one song and each picture
   moves to it. Everyone keeps their own flight.
   Anyone can ask to be brought to a friend's spot, or call a friend to theirs. The one asked is shown the request and
   chooses; nobody is moved without having agreed, on their own page, to that move. */
import { ac, analyser, ensureAudio } from "./audio.js";
import { cam } from "./camera.js";
import { requestWorld, scene } from "./choose.js";
import { clock } from "./clock.js";
import { $, toast } from "./dom.js";
import { flightPlaying } from "./flightplay.js";
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
export const TG_WAIT=30;      /* seconds a joining may take before it is given up, once the two have each other's descriptions */
export const TG_WAIT_HOST=170; /* seconds a guest waits for the host's description: a phone stops the host's page while they are in another app sending the link, and it answers only when they come back */
export const TG_ASK=20;       /* seconds a request to come or to go stays open for its answer */
/* What the host's messages name besides the world, and the kind of Journey change each is: a guest takes each up when the host changes it. */
export const TG_KINDS=[["pa","palette"],["lk","filter"],["mi","mirrors"],["mo","motion"],["ov","overlay"],["sf","surface"],["ld","land"],["pk","packing"],["pu","pulse"],["sh","shapes"],["io","inside"]];
/* The words about going to someone's spot: "come" (come to me), "join" (may I come to you), "coming" (yes to come),
   "here" (this is my place: the answer to coming, and the yes to join), "no". */
export const TG_ASKS=["come","join","coming","here","no"];
/* The meeting point's address (server/README.md says how to make one). With none, nobody can be invited. */
export const TG_ROOMS="https://mirrorfold-rooms.mirrorfold.workers.dev";
/* The server asked, once, "what is my address as seen from outside?" when a description is made. Without it
   two people behind different home routers cannot find each other. It is told nothing else. */
export const TG_ICE=[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun.cloudflare.com:3478"}]; /* two, so that the connection report can tell a network that gives each of them a different outside port */
const TG_LETTERS="abcdefghjkmnpqrstuvwxyz23456789"; /* a room's code is made of these: none that is mistaken for another */
export let peerU;              /* for the shader: each other person's place and size (0 for none) */
export let tgRole="";          /* "" alone, "host" having invited, "guest" having joined */
const conns=[];                /* host: one for each guest (the connection, its channel, the guest's number). guest: the one to the host */
const others=[];               /* the people to draw, by number: the world they are in, their place as parts of its repeat, where they are drawn now, and when last heard */
let sendT=0,hostW="",hostT=-1,waitJoin="",lastJoin="";
const hostHas={};           /* guest: what the host last named of each kind in TG_KINDS, so that each is taken up once, when the host changes it */
let ask=null;               /* a friend's request waiting for this user's answer: the word, who asks (their number), and when it lapses */
let want=null;              /* this page has agreed to go to a friend's spot and waits to be told the place: who from (-1 for anyone), and when it lapses */
let called=0;               /* until when this page's own call to come here stands */
let perNow=null;            /* the world's period this frame, or null where there is no place to share (a zoom or pack world) */
let tap=null,tapGain=null;  /* host: the app's sound as a stream to send, and the gain that shuts it while the microphone is the source */
let roomsAt="";             /* the meeting point in use: TG_ROOMS, unless a test has put its own here */
let room="",roomKey="";     /* host: the code of the room that is open, and the secret that lets this page alone take it again after a break */
let sock=null,sockUp=false,sockTries=0,sockTimer=0; /* host: the connection to the room, whether it is open, and the tries to get it back */

/* The connection report: what happened while two browsers tried to reach each other, kept as lines of text for the
   Copy connection report button and written to the console. Addresses are shortened, so the report can be passed on. */
const tgLines=[];
let tgT0=0;
function tgLog(who,msg){
  var l;
  if(!tgT0)tgT0=Date.now();
  l=((Date.now()-tgT0)/1000).toFixed(1)+"s "+who+": "+msg;
  tgLines.push(l);if(tgLines.length>400)tgLines.shift();
  try{console.log("[fly together] "+l)}catch(_){}
  try{$("bTgLog").hidden=false}catch(_){}
}
/* an address with its last half left out, and what kind it is */
export function tgAddr(a){
  var m;
  if(typeof a!=="string"||!a)return "none";
  if(/\.local$/.test(a))return "hidden name";
  m=/^(\d+)\.(\d+)\.\d+\.\d+$/.exec(a);
  if(m)return m[1]+"."+m[2]+".x.x ("+(+m[1]===10||(+m[1]===192&&+m[2]===168)||(+m[1]===172&&+m[2]>=16&&+m[2]<32)?"private":+m[1]===100&&+m[2]>=64&&+m[2]<128?"carrier's shared range":+m[1]===169&&+m[2]===254?"link-local":"public")+")";
  if(a.indexOf(":")>=0)return a.split(":").slice(0,2).join(":")+":x (IPv6)";
  return "other";
}
/* One way of being reached, read from its line of text: {typ, proto, addr, port, from}, or null. typ is host (an
   address on the device), srflx (the address a server saw from outside), prflx or relay; from is the port on the
   device that an outside address belongs to, or 0 where the browser does not say. */
export function tgCand(text){
  var t=typeof text==="string"?text:"",m=/candidate:\S+ \d+ (\S+) \d+ (\S+) (\d+) typ (\w+)/i.exec(t),r=/ rport (\d+)/i.exec(t);
  return m?{typ:m[4].toLowerCase(),proto:m[1].toLowerCase(),addr:m[2],port:+m[3],from:r?+r[1]:0}:null;
}
/* every way in a description, as a list */
export function tgCands(sdp){
  var out=[],re=/a=(candidate:[^\r\n]*)/g,m,c;
  while((m=re.exec(typeof sdp==="string"?sdp:""))){c=tgCand(m[1]);if(c)out.push(c);}
  return out;
}
export function tgCount(list){
  var n={host:0,srflx:0,prflx:0,relay:0},k,t=[];
  list.forEach(function(c){if(n[c.typ]!==undefined)n[c.typ]++;});
  for(k in n)if(n[k])t.push(n[k]+" "+k);
  return t.length?t.join(", "):"none";
}
/* Does a side's list look like a network that gives each server asked a different outside port? Then the port the
   other side is told is not the one its packets must go to, and the two cannot meet without a relay. The sign is one
   port on the device seen from outside as two different ports. A device with several ports open has an outside
   address for each, which is not that sign; so where the browser does not say which port an outside address belongs
   to, it is taken as the sign only if there are more outside ports than ports on the device. */
export function tgSplit(list){
  var seen={},out={},hosts={},no=0,nh=0,i,c,k;
  for(i=0;i<list.length;i++){
    c=list[i];if(c.proto!=="udp"||c.addr.indexOf(":")>=0)continue;
    if(c.typ==="host"){if(!hosts[c.port]){hosts[c.port]=1;nh++;}continue;}
    if(c.typ!=="srflx")continue;
    if(c.from){k=c.addr+"/"+c.from;if(seen[k]!==undefined&&seen[k]!==c.port)return true;seen[k]=c.port;}
    if(!out[c.addr+"/"+c.port]){out[c.addr+"/"+c.port]=1;no++;}
  }
  return nh>0&&no>nh;
}
/* Does a side's list look like a privacy relay is carrying its traffic (on an iPhone, iCloud Private Relay or Limit IP
   Address Tracking; elsewhere a VPN)? The sign is one port on the device seen by the two servers at two different
   outside addresses, not only two ports: each server was reached through a different way out. Nothing sent to such an
   address comes back in, so two browsers cannot meet through it; but unlike a network that splits its ports, the user
   can turn it off. A device on two networks at once has a port on each, which is not that sign. */
export function tgMasked(list){
  var hosts={},nh=0,addrs={},na=0,from={},i,c;
  for(i=0;i<list.length;i++){
    c=list[i];if(c.proto!=="udp"||c.addr.indexOf(":")>=0)continue;
    if(c.typ==="host"){if(!hosts[c.port]){hosts[c.port]=1;nh++;}continue;}
    if(c.typ!=="srflx")continue;
    if(c.from){if(from[c.from]!==undefined&&from[c.from]!==c.addr)return true;from[c.from]=c.addr;}
    if(!addrs[c.addr]){addrs[c.addr]=1;na++;}
  }
  return nh===1&&na>1;
}
/* said as soon as this device's own ways show the sign, so that nobody waits for a joining that cannot work */
export const TG_MASKED="A privacy relay is carrying this device's traffic (iCloud Private Relay, Limit IP Address Tracking, or a VPN). Friends cannot reach it through that: turn it off for now, then invite again.";
/* What a failed joining most likely came to, from each side's ways of being reached. */
export function tgVerdict(mine,theirs){
  var a=tgCount(mine),b=tgCount(theirs);
  if(!mine.some(function(c){return c.typ==="srflx"}))return "This side never learned its outside address ("+a+"): the address servers did not answer, so UDP is probably blocked on this network.";
  if(!theirs.length)return "The other side's description never arrived.";
  if(!theirs.some(function(c){return c.typ==="srflx"}))return "The other side never learned its outside address ("+b+"): UDP is probably blocked on its network.";
  if(tgMasked(mine)||tgMasked(theirs))return (tgMasked(mine)?"This":"The other")+" side's two address servers each saw it at a different outside address, not only a different port. That is the mark of a privacy relay carrying its traffic: on an iPhone or a Mac, iCloud Private Relay (Settings, your name, iCloud, Private Relay) or Limit IP Address Tracking (in the Wi-Fi network's or the mobile data's settings); elsewhere a VPN. Two browsers cannot meet through one. Turn it off on "+(tgMasked(mine)?"this":"that")+" device for now and try again.";
  if(tgSplit(mine)||tgSplit(theirs))return "Both sides learned an outside address, but "+(tgSplit(mine)?"this":"the other")+" network gives a different outside port to each place it talks to (a symmetric NAT, usual on mobile data and some offices). Two browsers cannot meet through that without a relay.";
  return "Both sides learned an outside address and neither network showed the usual sign of trouble, yet no path worked. A firewall may be dropping the packets, or one network changes ports in a way the two address servers did not show.";
}
/* Watch a connection for the report: every way found, every change of state, and at the end what was used or why not. */
function tgDebug(c,who){
  var pc=c.pc;
  c.mine=[];c.theirs=[];
  tgLog(who,"connection made; address servers "+TG_ICE.map(function(s){return s.urls}).join(", ")+"; online "+navigator.onLine+(navigator.connection?"; network "+(navigator.connection.type||"?")+"/"+(navigator.connection.effectiveType||"?"):""));
  pc.addEventListener("icecandidate",function(e){
    var k=e.candidate&&tgCand(e.candidate.candidate);
    if(!e.candidate){if(tgMasked(c.mine))toast(TG_MASKED);tgLog(who,"finished looking for ways to be reached: "+tgCount(c.mine)+(tgMasked(c.mine)?"; the two servers saw DIFFERENT outside ADDRESSES (a privacy relay or VPN)":tgSplit(c.mine)?"; the two servers saw DIFFERENT outside ports":""));return;}
    if(!k)return;
    c.mine.push(k);
    tgLog(who,"way found: "+k.typ+" "+k.proto+" "+tgAddr(k.addr)+" port "+k.port+(k.from?" (the device's port "+k.from+")":"")+(e.candidate.url?" from "+e.candidate.url:""));
  });
  pc.addEventListener("icecandidateerror",function(e){tgLog(who,"address server trouble: "+(e.url||"?")+" code "+e.errorCode+" "+(e.errorText||""));});
  pc.addEventListener("icegatheringstatechange",function(){tgLog(who,"looking for ways: "+pc.iceGatheringState);});
  pc.addEventListener("iceconnectionstatechange",function(){tgLog(who,"trying paths: "+pc.iceConnectionState);if(pc.iceConnectionState==="connected"||pc.iceConnectionState==="failed")tgPaths(c,who);});
  pc.addEventListener("connectionstatechange",function(){tgLog(who,"connection: "+pc.connectionState);});
  pc.addEventListener("signalingstatechange",function(){tgLog(who,"descriptions: "+pc.signalingState);});
}
/* the other side's description has come: note what ways it offers */
function tgTheirs(c,who,sdp){c.theirs=tgCands(sdp);tgLog(who,"other side's description arrived, offering "+tgCount(c.theirs)+(tgMasked(c.theirs)?"; its two servers saw DIFFERENT outside ADDRESSES (a privacy relay or VPN)":tgSplit(c.theirs)?"; its two servers saw DIFFERENT outside ports":""));}
/* which pairs of ways were tried, and which one is in use */
function tgPaths(c,who){
  var pc=c.pc;
  if(!pc.getStats)return;
  pc.getStats().then(function(st){
    var by={},n={},used=null,line=[];
    st.forEach(function(r){by[r.id]=r;});
    st.forEach(function(r){
      if(r.type!=="candidate-pair")return;
      n[r.state]=(n[r.state]||0)+1;
      if(r.nominated&&r.state==="succeeded")used=r;
    });
    Object.keys(n).forEach(function(k){line.push(n[k]+" "+k);});
    tgLog(who,"pairs of ways tried: "+(line.join(", ")||"none"));
    if(used&&by[used.localCandidateId]&&by[used.remoteCandidateId])tgLog(who,"path in use: this side "+by[used.localCandidateId].candidateType+" "+by[used.localCandidateId].protocol+", other side "+by[used.remoteCandidateId].candidateType+(used.currentRoundTripTime!==undefined?", there and back in "+Math.round(used.currentRoundTripTime*1000)+" ms":""));
    else if(pc.iceConnectionState==="failed")tgLog(who,"RESULT: "+tgVerdict(c.mine,c.theirs));
  },function(){});
}
/* why a message from the meeting point was not usable, for the report */
function tgWhyNot(text){
  var m;
  if(typeof text!=="string")return " (not text)";
  if(text.length>12000)return " (longer than 12000 letters)";
  try{m=JSON.parse(text)}catch(_){return " (not readable)";}
  if(m&&typeof m.s==="string"&&m.s.length>10000)return " (its description is "+m.s.length+" letters, over the 10000 allowed)";
  return " (not of a kind this page expects: "+String(m&&m.t).slice(0,8)+")";
}
/* the report as one text */
export function tgReport(){
  return "Mirrorfold fly together, connection report\n"+(navigator.userAgent||"")+"\nrole now: "+(tgRole||"none")+"\n"+tgLines.join("\n");
}
function tgCopyReport(){
  var t=tgReport(),box=$("tgCode"),none=function(){box.hidden=false;box.value=t;toast("Could not copy. The report is in the box: select it and copy it by hand.");};
  try{navigator.clipboard.writeText(t).then(function(){toast("Connection report copied: "+tgLines.length+" lines. Addresses in it are shortened.");},none);}catch(_){none();}
}
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

/* A room's code from a link, or "" if the text is not one. */
export function tgRoom(text){return typeof text==="string"&&/^[a-z2-9]{6,12}$/.test(text)?text:"";}
function tgWord(n){var a=new Uint8Array(n),s="",i;crypto.getRandomValues(a);for(i=0;i<n;i++)s+=TG_LETTERS.charAt(a[i]%TG_LETTERS.length);return s;}
function tgRoomUrl(code,role){return roomsAt.replace(/^http/,"ws").replace(/\/+$/,"")+"/room/"+code+"?role="+role+(role==="host"?"&key="+roomKey:"");}
function tgSdp(s){return typeof s==="string"&&s.length<=10000&&s.indexOf("v=0")===0;}
/* What the meeting point passes on, checked. To the host (host true): {t:"o", g, s}, a guest's name in the room and
   its description. To a guest ({t:"h"}: the host's page has come back, send your description again): {t:"a", s}, the host's description, {t:"n"}, no room left, or {t:"e"}, the host has
   gone. Anything else is null.
   A description is only ever handed to the browser's own connection, which reads it as an address list and nothing
   else; a guest's name is only ever sent back to the meeting point. */
export function tgSignal(text,host){
  var m;
  try{
    if(typeof text!=="string"||text.length>12000)return null;
    m=JSON.parse(text);
    if(!m||typeof m!=="object")return null;
    if(host){
      if(m.t!=="o"||typeof m.g!=="string"||!/^[a-z0-9]{1,16}$/.test(m.g)||!tgSdp(m.s))return null;
      return {t:"o",g:m.g,s:m.s};
    }
    if(m.t==="n"||m.t==="e"||m.t==="h")return {t:m.t};
    if(m.t!=="a"||!tgSdp(m.s))return null;
    return {t:"a",s:m.s};
  }catch(_){return null;}
}
function tgPart(x){return typeof x==="number"&&isFinite(x)&&x>=-0.5&&x<=0.5;}
function tgUnitPart(x){return typeof x==="number"&&isFinite(x)&&x>=-1&&x<=1;}
function tgWho(x){return typeof x==="number"&&x===Math.floor(x)&&x>=0&&x<=TG_MAX;}
function tgName(x){return typeof x==="string"&&x.length>0&&x.length<=40;}
/* A message from the other side, checked: from a guest {w, q}, its world and its place as parts of the repeat; from the
   host {w, mt, o}, the host's world and morph clock and everyone else as [number, world, three parts]. Anything else
   is null. Only numbers in range and names that are then looked up among this page's own lists come through.
   A word about going to someone's spot is {c, f, to, w, p}: the word (one of TG_ASKS), who it is from (the host says;
   0 from a guest, whose number the host knows), who it is for (-1 for everyone), and with "here" the world and the
   place: three parts of the repeat, then the facing and up directions. */
export function tgClean(text,fromHost){
  var m,o=[],i,e,a;
  try{
    if(typeof text!=="string"||text.length>2000)return null;
    m=JSON.parse(text);
    if(!m||typeof m!=="object")return null;
    if(m.c!==undefined){
      if(typeof m.c!=="string"||TG_ASKS.indexOf(m.c)<0)return null;
      a={c:m.c,f:0,to:-1,w:"",p:null};
      if(fromHost){if(!tgWho(m.f))return null;a.f=m.f;}
      if(m.to!==undefined){if(!tgWho(m.to))return null;a.to=m.to;}
      if(m.c==="here"){
        if(!tgName(m.w)||!Array.isArray(m.p)||m.p.length!==9||!m.p.slice(0,3).every(tgPart)||!m.p.slice(3).every(tgUnitPart))return null;
        a.w=m.w;a.p=m.p.slice();
      }
      return a;
    }
    if(!tgName(m.w))return null;
    if(!fromHost){
      if(!Array.isArray(m.q)||m.q.length!==3||!m.q.every(tgPart))return null;
      return {w:m.w,q:m.q.slice()};
    }
    if(typeof m.mt!=="number"||!isFinite(m.mt)||m.mt<0||m.mt>TG_TURN+1||!Array.isArray(m.o)||m.o.length>TG_MAX)return null;
    for(i=0;i<TG_KINDS.length;i++)if(m[TG_KINDS[i][0]]!==undefined&&!tgName(m[TG_KINDS[i][0]]))return null;
    for(i=0;i<m.o.length;i++){
      e=m.o[i];
      if(!Array.isArray(e)||e.length!==5||e[0]!==Math.floor(e[0])||e[0]<0||e[0]>TG_MAX||!tgName(e[1])||!tgPart(e[2])||!tgPart(e[3])||!tgPart(e[4]))return null;
      o.push([e[0],e[1],e[2],e[3],e[4]]);
    }
    a={w:m.w,mt:m.mt,o:o};
    for(i=0;i<TG_KINDS.length;i++)a[TG_KINDS[i][0]]=m[TG_KINDS[i][0]]||"";
    return a;
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
/* A place as sent with "here", made into a camera: {pos, F, Up, R}, or null if the directions are not ones a camera can have. */
export function tgSpot(p,per){
  var F=[p[3],p[4],p[5]],U=[p[6],p[7],p[8]],R,l=Math.hypot(F[0],F[1],F[2]);
  if(l<0.5)return null;
  F=[F[0]/l,F[1]/l,F[2]/l];
  R=[U[1]*F[2]-U[2]*F[1],U[2]*F[0]-U[0]*F[2],U[0]*F[1]-U[1]*F[0]];l=Math.hypot(R[0],R[1],R[2]);
  if(l<0.1)return null;
  R=[R[0]/l,R[1]/l,R[2]/l];
  return {pos:[p[0]*per[0],p[1]*per[1],p[2]*per[2]],F:F,Up:[F[1]*R[2]-F[2]*R[1],F[2]*R[0]-F[0]*R[2],F[0]*R[1]-F[1]*R[0]],R:R};
}
function tgPut(c,m){if(c&&c.open&&c.dc&&c.dc.readyState==="open"){try{c.dc.send(JSON.stringify(m))}catch(_){}}}
/* Say a word about going to someone's spot, to one person (their number) or to everyone (-1). "here" carries this
   camera's place; where there is none to give (a zoom or pack world) "no" is said in its stead. */
function tgTell(word,to){
  var m={c:word},i,r=function(x){return Math.round(x*1000)/1000;};
  if(word==="here"){
    if(!perNow){m.c="no";}
    else{
      m.w=scene.world.id;m.p=[];
      for(i=0;i<3;i++){m.p[i]=cam.pos[i]/perNow[i];m.p[i]-=Math.round(m.p[i]);m.p[i]=Math.round(m.p[i]*1e5)/1e5;}
      m.p.push(r(cam.F[0]),r(cam.F[1]),r(cam.F[2]),r(cam.Up[0]),r(cam.Up[1]),r(cam.Up[2]));
    }
  }
  if(tgRole==="guest"){if(to>=0)m.to=to;tgPut(conns[0],m);return;}
  m.f=0;
  for(i=0;i<conns.length;i++)if(to<0||conns[i].id===to)tgPut(conns[i],m);
}
/* Go to the place a friend has sent, if this page is in the same world and the world has places. */
function tgGoTo(m){
  var w=scene.world,s;
  if(m.w!==w.id||!perNow||flightPlaying()){toast("You are not in the same world as your friend yet. Ask again in a moment.");return;}
  s=tgSpot(m.p,perNow);
  if(!s)return;
  cam.pos=s.pos;cam.F=s.F;cam.Up=s.Up;cam.R=s.R;cam.vel=[0,0,0];cam.hand=1;
  toast("You are at your friend's spot.");
}
/* A word about going to someone's spot has arrived, from the person with number m.f. A request is only shown, for this
   user to answer. A place is only gone to if this page is waiting for one from that person: after its own user asked
   to go, or agreed to come. */
function tgAsked(m){
  var now=Date.now();
  if(m.c==="come"||m.c==="join"){
    if(ask&&now<ask.until)return;
    ask={c:m.c,f:m.f,until:now+TG_ASK*1000};
    setTimeout(tgShow,TG_ASK*1000+200);
    toast(m.c==="come"?"Your friend asks you to come to their spot.":"Your friend asks to come to your spot.");
    tgShow();wakeHud();
  }else if(m.c==="coming"){
    if(now<called){toast("Your friend is coming.");tgTell("here",m.f);}
  }else if(m.c==="no"){
    if(now<called||(want&&now<want.until))toast("Your friend stayed where they are.");
  }else if(m.c==="here"){
    if(!want||now>want.until||(want.f>=0&&want.f!==m.f))return;
    want=null;tgGoTo(m);
  }
}
/* The buttons: call friends here, ask to go to a friend, and the answer to a friend's request. */
function tgCall(){called=Date.now()+(TG_ASK+10)*1000;tgTell("come",-1);toast("Asked your friend to come to you.");}
function tgAskGo(){want={f:-1,until:Date.now()+(TG_ASK+10)*1000};tgTell("join",-1);toast("Asked your friend if you can come to them.");}
function tgAnswer(yes){
  var a=ask;
  ask=null;tgShow();
  if(!a||Date.now()>a.until)return;
  if(!yes){tgTell("no",a.f);return;}
  if(a.c==="come"){want={f:a.f,until:Date.now()+10000};tgTell("coming",a.f);}
  else{tgTell("here",a.f);toast(perNow?"Your friend is coming to you.":"There is no spot to share in this world.");}
}
function tgForget(){var k;for(k in hostHas)delete hostHas[k];ask=null;want=null;called=0;}
function tgSay(t){$("tgSay").textContent=t;}
function tgLinkText(){return location.href.split("#")[0]+"#room="+room;}
function tgShow(){
  var n=conns.filter(function(c){return c.open}).length,host=tgRole==="host",inv=host&&!!room,asking=!!ask&&Date.now()<ask.until&&n>0;
  $("rowTg").hidden=false;press($("bTg"),true);
  $("bTgCome").hidden=!n;$("bTgJoin").hidden=!n;
  $("tgAsk").hidden=!asking;
  if(asking){
    $("tgAskSay").textContent=ask.c==="come"?"Your friend asks you to come to their spot.":"Your friend asks to come to your spot.";
    $("bTgYes").textContent=ask.c==="come"?"Go to them":"Let them come";
  }
  $("bTgLeave").hidden=!tgRole;
  $("bTgInvite").hidden=tgRole==="guest"||inv;
  $("tgCode").hidden=!inv;$("bTgGo").hidden=!inv;
  if(inv)$("tgCode").value=tgLinkText();
  if(!host)return;
  if(n)tgSay((n===1?"Flying with one friend.":"Flying with "+n+" friends.")+(inv&&n<TG_MAX?" The same link lets more in.":""));
  else if(inv)tgSay(sockUp?"Send your friend this link. Opening it joins them to you. It works while this page stays open.":"Reaching the meeting point...");
}
/* a new connection, and what to do when its channel opens, speaks and closes */
function tgLink(c,dc){
  c.dc=dc;
  dc.onopen=function(){tgLog(tgRole,"channel open");c.open=true;clearTimeout(c.timer);toast(tgRole==="host"?"Your friend has joined.":"Connected. You are flying together.");if(tgRole==="guest")tgSay("Flying together. The host's world, its Journey's changes and its music are yours too.");tgShow();};
  dc.onclose=function(){tgLog(tgRole||"alone","channel closed");tgDrop(c);};
  dc.onmessage=function(e){
    var m=tgClean(e.data,tgRole==="guest"),i,k,r;
    if(!m)return;
    if(m.c){
      if(tgRole==="guest"){tgAsked(m);return;}
      /* the host passes a guest's word on to whoever it is for, saying who it is from, and takes it itself if it is for the host or for everyone */
      m.f=c.id;r={c:m.c,f:c.id};if(m.p){r.w=m.w;r.p=m.p;}
      for(i=0;i<conns.length;i++)if(conns[i]!==c&&(m.to<0||conns[i].id===m.to))tgPut(conns[i],r);
      if(m.to<=0)tgAsked(m);
      return;
    }
    if(tgRole==="host"){tgHeard(c.id,m.w,m.q,clock.time);return;}
    hostW=m.w;hostT=m.mt;
    /* what the host's Journey has changed, each kind taken up when the host changes it (and tried again if a transition was in the way); a name this page does not have is passed over */
    for(i=0;i<TG_KINDS.length;i++){k=TG_KINDS[i];if(m[k[0]]&&m[k[0]]!==hostHas[k[0]]&&jApply(k[1],m[k[0]]))hostHas[k[0]]=m[k[0]];}
    for(i=0;i<m.o.length;i++)tgHeard(m.o[i][0],m.o[i][1],[m.o[i][2],m.o[i][3],m.o[i][4]],clock.time);
  };
}
function tgDrop(c){
  var i=conns.indexOf(c),k;
  if(i<0)return;
  conns.splice(i,1);
  clearTimeout(c.timer);
  try{c.sock&&c.sock.close()}catch(_){}
  try{c.pc.close()}catch(_){}
  for(k=others.length-1;k>=0;k--)if(tgRole==="guest"||others[k].id===c.id)others.splice(k,1);
  if(c.open)toast(tgRole==="guest"?"The host has left. You are flying alone.":"A friend has left.");
  if(tgRole==="guest")setFriendSound(null);
  if(!conns.length)tgForget();
  if(tgRole==="guest"||(!conns.length&&!room)){tgRole="";hostW="";hostT=-1;tgSay("Fly with a friend: invite them with a link.");}
  tgShow();
}
/* A joining that came to nothing: the connection is dropped, and whoever was waiting is told which half failed. */
function tgFail(c){
  var guest=tgRole==="guest",was=c.open,why="one of the two networks does not let browsers talk straight to each other.";
  if(conns.indexOf(c)<0)return;
  tgLog(tgRole,(was?"connection lost":"joining given up")+": paths "+c.pc.iceConnectionState+", connection "+c.pc.connectionState+(c.met?"":", no word from the other side"));
  if(!was&&c.mine)tgLog(tgRole,"RESULT: "+tgVerdict(c.mine,c.theirs||[]));
  tgDrop(c);
  if(was)return;
  if(guest)tgSay(c.met?"Could not connect: "+why:"Your friend's page did not answer. It has to be open and in front on their device. Try the link again.");
  else toast("A friend tried to join and could not connect: "+why);
}
/* give a joining TG_WAIT seconds, and end it at once if the browser says the two cannot reach each other */
function tgWatch(c,secs){
  c.pc.onconnectionstatechange=function(){if(c.pc.connectionState==="failed")tgFail(c);};
  clearTimeout(c.timer);
  c.timer=setTimeout(function(){if(!c.open)tgFail(c);},(secs||TG_WAIT)*1000);
}
/* everything the browser has found out about how to reach it, or what it has after four seconds */
function tgGathered(pc){
  return new Promise(function(done){
    var t=setTimeout(done,4000);
    if(pc.iceGatheringState==="complete"){clearTimeout(t);done();return;}
    pc.addEventListener("icegatheringstatechange",function(){if(pc.iceGatheringState==="complete"){clearTimeout(t);done();}});
  });
}
function tgCopyLink(){
  var none=function(){toast("Could not copy the link. Select it in the box and copy it by hand.");};
  try{navigator.clipboard.writeText(tgLinkText()).then(function(){toast("Invitation link copied. Send it to your friend.");},none);}catch(_){none();}
}
/* Host: keep a connection to the room, so that whoever opens the link can be let in. If it breaks it is made again,
   a few times, each after a longer wait. Friends already joined are not touched by any of this. */
function tgRoomOpen(){
  var s,over=function(msg){room="";sockUp=false;if(!conns.length)tgRole="";tgSay(msg);tgShow();};
  clearTimeout(sockTimer);
  try{s=new WebSocket(tgRoomUrl(room,"host"));}catch(_){over("The meeting point cannot be reached.");return;}
  sock=s;
  s.onopen=function(){if(sock!==s)return;tgLog("host","meeting point reached");sockUp=true;sockTries=0;tgShow();};
  s.onmessage=function(e){
    var m;
    if(sock!==s||e.data==="q")return;
    m=tgSignal(e.data,true);
    tgLog("host","the meeting point passed on a message of "+String(e.data).length+" letters: "+(m?"a friend's description":"NOT USABLE"+tgWhyNot(e.data)));
    if(m)tgAdmit(s,m.g,m.s);
  };
  s.onclose=function(e){
    if(sock!==s)return;
    tgLog("host","meeting point closed, code "+e.code);
    sock=null;sockUp=false;
    if(tgRole!=="host"||!room)return;
    if(e.code===4408||e.code===4409){over("The invitation has run out. Press Invite for a new link.");return;}
    if(sockTries>=5){over("The meeting point cannot be reached, so nobody new can join. Try Invite again later.");return;}
    sockTries++;sockTimer=setTimeout(tgRoomOpen,1000*Math.pow(2,sockTries));tgShow();
  };
}
/* now and then, a word to the room so that the connection to it is not taken for dead; the room says "q" back */
function tgPing(){if(sock&&sockUp){try{sock.send("p")}catch(_){}}}
/* Host: someone has opened the link. Take their description, make this side's, and send it back through the room.
   The host's music goes to them as sound, on the line their description asked for. */
function tgAdmit(s,g,sdp){
  var used={},id=0,i,c,pc;
  conns.filter(function(x){return x.g===g&&!x.open}).forEach(function(x){tgLog("host","the same friend's description again: starting afresh with them");tgDrop(x);}); /* a guest sends again when this page comes back from behind another app */
  conns.forEach(function(x){used[x.id]=1});
  for(i=1;i<=TG_MAX;i++)if(!used[i]&&!id)id=i;
  if(!id){try{s.send(JSON.stringify({t:"n",g:g}))}catch(_){}return;}
  pc=new RTCPeerConnection({iceServers:TG_ICE});c={pc:pc,dc:null,id:id,open:false,met:true,g:g};conns.push(c);
  pc.ondatachannel=function(e){tgLink(c,e.channel);};
  tgDebug(c,"host");tgTheirs(c,"host",sdp);
  tgWatch(c);
  pc.setRemoteDescription({type:"offer",sdp:sdp}).then(function(){
    if(tgTap())tap.stream.getAudioTracks().forEach(function(t){pc.addTrack(t,tap.stream);});
    return pc.createAnswer();
  }).then(function(a){return tgSetLocal(pc,a);}).then(function(){return tgGathered(pc);}).then(function(){
    s.send(JSON.stringify({t:"a",g:g,s:pc.localDescription.sdp}));
    tgLog("host","answer sent ("+pc.localDescription.sdp.length+" letters), offering "+tgCount(tgCands(pc.localDescription.sdp)));
  }).catch(function(e){tgLog("host","could not answer: "+(e&&e.message||e));tgDrop(c);});
}
/* Host: open a room if none is open, and copy its link. Gives the room's code, or "" if there is none. */
export function tgInvite(){
  if(tgRole==="guest")return "";
  $("rowTg").hidden=false;
  if(typeof RTCPeerConnection==="undefined"||typeof WebSocket==="undefined"){tgSay("This browser cannot connect two people directly.");return "";}
  if(!roomsAt){tgSay("Fly together has no meeting point on this site yet.");return "";}
  if(!room){room=tgWord(8);roomKey=tgWord(16);sockTries=0;tgRole="host";tgLines.length=0;tgT0=Date.now();tgLog("host","room opened");tgRoomOpen();}
  tgCopyLink();tgShow();
  return room;
}
/* Guest: join the room a link names. Gives a promise of whether the host's description came back and fitted; the
   two are flying together a moment after that, when the channel opens. */
export function tgJoin(text){
  var code=tgRoom(text),pc,c,end=function(msg){tgDrop(c);tgSay(msg);return false;};
  $("rowTg").hidden=false;
  if(typeof RTCPeerConnection==="undefined"||typeof WebSocket==="undefined"){tgSay("This browser cannot connect two people directly.");return Promise.resolve(false);}
  if(!code){toast("That link is not an invitation this page can read.");return Promise.resolve(false);}
  if(!roomsAt){tgSay("Fly together has no meeting point on this site yet.");return Promise.resolve(false);}
  if(tgRole==="host"&&code===room){tgSay("That is your own invitation. Send the link to a friend.");return Promise.resolve(false);}
  tgLeave();
  pc=new RTCPeerConnection({iceServers:TG_ICE});c={pc:pc,dc:null,id:0,open:false,met:false};conns.push(c);
  tgRole="guest";tgLink(c,pc.createDataChannel("mirrorfold"));
  tgLines.length=0;tgT0=Date.now();tgDebug(c,"guest");
  try{pc.addTransceiver("audio",{direction:"recvonly"});}catch(_){} /* a line for the host's music to come in on */
  pc.ontrack=function(e){if(e.track&&e.track.kind==="audio"){setFriendSound(e.streams&&e.streams[0]?e.streams[0]:new MediaStream([e.track]));toast("Playing the host's music. Choose another under Music to use your own.");}};
  tgWatch(c,TG_WAIT_HOST);
  tgSay("Joining your friend...");tgShow();
  setTimeout(function(){if(conns.indexOf(c)>=0&&!c.met)tgSay("Waiting for your friend's page to answer. If they left Mirrorfold to send you the link, you are joined when they go back to it.");},6000);
  return pc.createOffer().then(function(o){return tgSetLocal(pc,o);}).then(function(){return tgGathered(pc);}).then(function(){
    return new Promise(function(done){
      var s;
      if(conns.indexOf(c)<0){done(false);return;}
      s=c.sock=new WebSocket(tgRoomUrl(code,"guest"));
      s.onopen=function(){s.send(JSON.stringify({t:"o",s:pc.localDescription.sdp}));tgLog("guest","meeting point reached; offer sent ("+pc.localDescription.sdp.length+" letters), offering "+tgCount(tgCands(pc.localDescription.sdp)));};
      s.onmessage=function(e){
        var m=tgSignal(e.data,false);
        if(!m)tgLog("guest","the meeting point passed on a message of "+String(e.data).length+" letters: NOT USABLE"+tgWhyNot(e.data));
        if(!m||c.met)return;
        if(m.t==="h"){tgLog("guest","the host's page has come back: offer sent again");try{s.send(JSON.stringify({t:"o",s:pc.localDescription.sdp}))}catch(_){}return;}
        c.met=true;tgWatch(c);
        tgLog("guest","meeting point answered: "+(m.t==="a"?"the host's description":m.t==="n"?"the flight is full":"the invitation has ended"));
        if(m.t==="a")tgTheirs(c,"guest",m.s);
        if(m.t==="n"){done(end("Four people is the most, and your friend's flight is full."));return;}
        if(m.t==="e"){done(end("That invitation has ended. Ask your friend for a new link."));return;}
        pc.setRemoteDescription({type:"answer",sdp:m.s}).then(function(){done(true);},function(){done(end("That invitation could not be used. Ask your friend for a new link."));});
      };
      s.onclose=function(e){
        tgLog("guest","meeting point closed, code "+e.code);
        if(c.met)return; /* the room lets a guest go once it has passed the answer on */
        if(conns.indexOf(c)<0){done(false);return;}
        done(end(e.code===4404?"That invitation has ended. Ask your friend for a new link.":e.code===4429?"Too many people are joining at once. Try the link again in a minute.":"The meeting point could not be reached. Try the link again."));
      };
    });
  }).catch(function(e){tgLog("guest","could not make the offer: "+(e&&e.message||e));return end("That invitation could not be used. Ask your friend for a new link.");});
}
export function tgLeave(){
  var cs=conns.slice(),i,s=sock;
  conns.length=0;others.length=0;
  for(i=0;i<cs.length;i++){clearTimeout(cs[i].timer);try{cs[i].sock&&cs[i].sock.close()}catch(_){}try{cs[i].dc&&cs[i].dc.close()}catch(_){}try{cs[i].pc.close()}catch(_){}}
  if(tgRole==="guest")setFriendSound(null);
  clearTimeout(sockTimer);sock=null;sockUp=false;room="";roomKey="";
  if(s){try{s.close()}catch(_){}}
  tgRole="";hostW="";hostT=-1;tgForget();
  tgSay("Fly with a friend: invite them with a link.");
}
/* True while this page is a guest that has heard from its host: its own Journey then changes nothing, since the host's does. */
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
  perNow=ok?per:null;
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
        msg={w:w.id,mt:Math.round((((clock.morphT%TG_TURN)+TG_TURN)%TG_TURN)*100)/100,o:list};
        for(i=0;i<TG_KINDS.length;i++)msg[TG_KINDS[i][0]]=jCur(TG_KINDS[i][1]);
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
  if(h.indexOf("room=")!==0||h===lastJoin)return;
  lastJoin=h;
  if(started)tgJoin(h.slice(5));else waitJoin=h.slice(5);
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
peerU=new Float32Array(4*TG_MAX);
roomsAt=TG_ROOMS;
tgSay("Fly with a friend: invite them with a link.");
$("bTg").addEventListener("click",function(){var open=$("rowTg").hidden;$("rowTg").hidden=!open;press(this,open||!!tgRole);if(open)tgShow();wakeHud();});
$("bTgInvite").addEventListener("click",function(){tgInvite();wakeHud();});
$("bTgGo").addEventListener("click",function(){tgCopyLink();wakeHud();});
/* a phone stops a page that is not in front, and its connection to the room then only looks open: on coming back the host takes its room afresh at once, which also has the room ask anyone waiting to send again */
document.addEventListener("visibilitychange",function(){if(!document.hidden&&tgRole==="host"&&room){var old=sock;sockTries=0;tgRoomOpen();if(old){try{old.close()}catch(_){}}}});
document.addEventListener("visibilitychange",function(){if(tgRole)tgLog(tgRole,document.hidden?"THE PAGE WAS HIDDEN (another tab or app is in front; a phone may stop it now)":"the page is showing again"+(tgRole==="host"?"; meeting point "+(sockUp?"still connected":"not connected"):""));});
$("bTgLog").addEventListener("click",function(){tgCopyReport();wakeHud();});
$("bTgLeave").addEventListener("click",function(){tgLeave();tgShow();toast("You are flying alone.");wakeHud();});
$("bTgCome").addEventListener("click",function(){tgCall();wakeHud();});
$("bTgJoin").addEventListener("click",function(){tgAskGo();wakeHud();});
$("bTgYes").addEventListener("click",function(){tgAnswer(true);wakeHud();});
$("bTgNo").addEventListener("click",function(){tgAnswer(false);wakeHud();});
setInterval(tgPing,25000);
tgFromAddress();
window.addEventListener("hashchange",tgFromAddress);
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={TG_MASKED, tgMasked, TG_WAIT_HOST, tgWhyNot, tgLog, tgLines, tgAddr, tgCand, tgCands, tgCount, tgSplit, tgVerdict, tgDebug, tgTheirs, tgPaths, tgReport, tgCopyReport, tgTap, tgMusicSdp, tgSetLocal, get tgTapOut(){return tap}, hostHas, TG_ASK, TG_KINDS, TG_ASKS, tgUnitPart, tgWho, tgSpot, tgPut, tgTell, tgGoTo, tgAsked, tgCall, tgAskGo, tgAnswer, tgForget, get tgAskNow(){return ask}, get tgWant(){return want}, tgHeard, tgLink, tgDrop, tgFail, tgWatch, tgSay, tgShow, tgLinkText, tgCopyLink, tgPart, tgName, tgSdp, tgWord, tgRoomUrl, tgRoomOpen, tgPing, tgAdmit, tgGathered, tgFromAddress, TG_MAX, TG_EVERY, TG_GONE, TG_TURN, TG_WAIT, TG_ROOMS, TG_ICE, conns, others, tgRoom, tgSignal, tgClean, tgPlace, tgInvite, tgJoin, tgLeave, tgGuest, togetherClock, stepTogether,
  get peerU(){return peerU},set peerU(v){peerU=v}, get tgRole(){return tgRole},set tgRole(v){tgRole=v}, get hostW(){return hostW},set hostW(v){hostW=v}, get hostT(){return hostT},set hostT(v){hostT=v},
  get tgRoomsAt(){return roomsAt},set tgRoomsAt(v){roomsAt=v}, get tgRoomNow(){return room}, get tgSockUp(){return sockUp}};
