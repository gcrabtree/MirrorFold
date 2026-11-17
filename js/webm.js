/* Writing a WebM file: the container that holds a video's pictures and its sound, as the browser's encoders hand them
   over. Nothing here touches the page, so the test tools can run it.
   A WebM file is a tree of elements, each a number that says what it is, its length, and its contents. This writes:
   a heading; then one Segment holding a list of where things are (SeekHead), what the file is (Info, with how long it
   lasts), its tracks (one of pictures, and one of sound if there is any), the pictures and sound themselves in
   Clusters of about two seconds, each beginning at a whole picture, and last a list of where each Cluster is (Cues),
   so that a player can jump about. The pictures and the sound come from two encoders that are not in step, so they
   are held here until both have come as far, and written in order of time.
   The file is written through a sink: write(bytes) puts bytes at the end, and patch(place, bytes) writes over bytes
   already written (the length and the places are only known at the end). */
export const WEBM_CLUSTER_MS=2000; /* a Cluster is about this long */

function num(n,len){ /* a whole number as len bytes, biggest first */
  var o=new Uint8Array(len),i;
  for(i=len-1;i>=0;i--){o[i]=n%256;n=Math.floor(n/256);}
  return o;
}
function needs(n){var l=1;while(n>=Math.pow(256,l))l++;return l;}
function f64(x){var o=new Uint8Array(8);new DataView(o.buffer).setFloat64(0,x);return o;}
function txt(s){var o=new Uint8Array(s.length),i;for(i=0;i<s.length;i++)o[i]=s.charCodeAt(i)&127;return o;}
function cat(parts){
  var n=0,i,o,at=0;
  for(i=0;i<parts.length;i++)n+=parts[i].length;
  o=new Uint8Array(n);
  for(i=0;i<parts.length;i++){o.set(parts[i],at);at+=parts[i].length;}
  return o;
}
/* a length, as the eight bytes that can say any length */
function size8(n){var o=num(n,8);o[0]=1;return o;}
/* an element: its number (as bytes), its length and its contents (bytes, or a list of elements to join) */
export function ebml(id,body){
  var b=Array.isArray(body)?cat(body):body;
  return cat([new Uint8Array(id),b.length<127?new Uint8Array([0x80|b.length]):size8(b.length),b]);
}
function uint(id,n){return ebml(id,num(n,needs(n)));}

/* An OpusHead, for an Opus track whose encoder gave none: channels, and the samples to pass over at the start. */
export function opusHead(channels,preSkip){
  var o=new Uint8Array(19);
  o.set(txt("OpusHead"));o[8]=1;o[9]=channels;o[10]=preSkip&255;o[11]=preSkip>>8;
  o[12]=0x80;o[13]=0xBB;o[14]=0;o[15]=0; /* 48000, smallest byte first */
  return o;
}
/* Begin a file. o: {w, h, fps, codec ("V_VP9", "V_VP8" or "V_AV1"), audio: null or {channels, rate, head (OpusHead bytes)}}.
   Gives back {video(bytes, ms, key), audio(bytes, ms), end(ms)}: pictures and sound as they come from the encoders, with
   their times in milliseconds; end says how long the whole lasts and finishes the file. */
export function webmStart(o,sink){
  var pos=0,qv=[],qa=[],cues=[],cl=null,segAt,seekAt,durAt,infoAt,tracksAt,lastV=-1,lastA=-1,ended=false,preSkip,parts,head,seek,info,tracks,vt,at;
  function put(b){sink.write(b);pos+=b.length;}
  function seekEntry(id){return ebml([0x4D,0xBB],[ebml([0x53,0xAB],new Uint8Array(id)),ebml([0x53,0xAC],num(0,8))]);}
  put(ebml([0x1A,0x45,0xDF,0xA3],[uint([0x42,0x86],1),uint([0x42,0xF7],1),uint([0x42,0xF2],4),uint([0x42,0xF3],8),ebml([0x42,0x82],txt("webm")),uint([0x42,0x87],4),uint([0x42,0x85],2)]));
  put(new Uint8Array([0x18,0x53,0x80,0x67]));put(new Uint8Array([1,255,255,255,255,255,255,255])); /* the Segment, its length not yet known */
  segAt=pos;
  seek=ebml([0x11,0x4D,0x9B,0x74],[seekEntry([0x15,0x49,0xA9,0x66]),seekEntry([0x16,0x54,0xAE,0x6B]),seekEntry([0x1C,0x53,0xBB,0x6B])]);
  seekAt=pos;put(seek);
  infoAt=pos;
  info=ebml([0x15,0x49,0xA9,0x66],[uint([0x2A,0xD7,0xB1],1000000),ebml([0x4D,0x80],txt("Mirrorfold")),ebml([0x57,0x41],txt("Mirrorfold")),ebml([0x44,0x89],f64(0))]);
  durAt=pos+info.length-8;put(info);
  vt=ebml([0xAE],[uint([0xD7],1),uint([0x73,0xC5],1),uint([0x83],1),ebml([0x86],txt(o.codec)),uint([0x23,0xE3,0x83],Math.round(1e9/o.fps)),
    ebml([0xE0],[uint([0xB0],o.w),uint([0xBA],o.h)])]);
  parts=[vt];
  if(o.audio){
    head=o.audio.head||opusHead(o.audio.channels,312);preSkip=head[10]|(head[11]<<8);
    parts.push(ebml([0xAE],[uint([0xD7],2),uint([0x73,0xC5],2),uint([0x83],2),ebml([0x86],txt("A_OPUS")),uint([0x56,0xAA],Math.round(preSkip/48000*1e9)),uint([0x56,0xBB],80000000),
      ebml([0x63,0xA2],head),ebml([0xE1],[ebml([0xB5],f64(o.audio.rate)),uint([0x9F],o.audio.channels)])]));
  }
  tracksAt=pos;tracks=ebml([0x16,0x54,0xAE,0x6B],parts);put(tracks);
  function closeCluster(){
    if(!cl)return;
    put(ebml([0x1F,0x43,0xB6,0x75],[uint([0xE7],cl.t)].concat(cl.blocks)));
    cl=null;
  }
  function block(track,data,t,key){
    var rel,b;
    t=Math.max(0,Math.round(t));
    /* a new Cluster at a whole picture once this one is long enough; and in any case before a time no longer fits in a block's two bytes */
    if(!cl||(track===1&&key&&t-cl.t>=WEBM_CLUSTER_MS)||t-cl.t>30000){
      closeCluster();cl={t:t,blocks:[],at:pos};
      if(track===1)cues.push([t,pos-segAt]);
    }
    rel=t-cl.t;b=new Uint8Array(4+data.length);
    b[0]=0x80|track;b[1]=(rel>>8)&255;b[2]=rel&255;b[3]=key?0x80:0;b.set(data,4);
    cl.blocks.push(ebml([0xA3],b));
  }
  /* write what is held, in order of time, as far as both the pictures and the sound have come */
  function flush(){
    var upto=ended?Infinity:o.audio?Math.min(lastV,lastA):lastV,v,a;
    for(;;){
      v=qv.length?qv[0]:null;a=qa.length?qa[0]:null;
      if(v&&v.t<=upto&&(!a||v.t<=a.t)){qv.shift();block(1,v.d,v.t,v.key);}
      else if(a&&a.t<=upto){qa.shift();block(2,a.d,a.t,true);}
      else break;
    }
  }
  return {
    video:function(d,t,key){qv.push({d:d,t:t,key:!!key});lastV=t;flush();},
    audio:function(d,t){if(!o.audio)return;qa.push({d:d,t:t});lastA=t;flush();},
    end:function(ms){
      var cuesAt,body;
      ended=true;flush();closeCluster();
      cuesAt=pos;
      body=cues.map(function(c){return ebml([0xBB],[uint([0xB3],c[0]),ebml([0xB7],[uint([0xF7],1),ebml([0xF1],num(c[1],8))])]);});
      put(ebml([0x1C,0x53,0xBB,0x6B],body));
      /* now that they are known: the Segment's length, how long the file lasts, and where Info, Tracks and Cues are */
      sink.patch(segAt-8,size8(pos-segAt));
      sink.patch(durAt,f64(ms));
      at=seekAt+seek.length-63; /* past the SeekHead's own number and length, to its three entries of 21 bytes each */
      [infoAt,tracksAt,cuesAt].forEach(function(p,i){sink.patch(at+i*21+13,num(p-segAt,8));}); /* each entry is 21 bytes, and its place is its last eight */
      return pos;
    }
  };
}

/* What this file does when the app starts. main.js calls each file's init in turn. */
export function init(){
}

/* for the test tools and the browser console: every name in this file; the ones that can change have a getter and a setter */
export const __dbg={WEBM_CLUSTER_MS, ebml, opusHead, webmStart, webmNum:num, webmSize8:size8};
