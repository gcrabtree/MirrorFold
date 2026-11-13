

/* ---------- packs ----------
   A pack is a text file of palettes, motions, journey templates and sets: names and numbers only, never program code.
   Everything read from a pack goes through these cleaners. A wrong shape is refused; a number out of range is pulled
   back into a range that is known to look acceptable and cannot flash. */
export function cleanName(s){
  if(typeof s!=="string")return "";
  return s.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,28);
}
export function cleanPalette(src){
  if(!src||typeof src!=="object")return null;
  var name=cleanName(src.name),lim={a:[0,1],b:[0,1],c:[0,3],d:[-2,2]},out={name:name},k,j,v;
  if(!name)return null;
  for(k in lim){
    if(!Array.isArray(src[k])||src[k].length!==3)return null;
    out[k]=[];
    for(j=0;j<3;j++){
      v=src[k][j];if(typeof v!=="number"||!isFinite(v))return null;
      out[k].push(Math.max(lim[k][0],Math.min(lim[k][1],v)));
    }
  }
  return out;
}
/* A filter from a pack is a mix of the built-in filter controls and, optionally, a short piece of shader code.
   The code is the inside of one function. It is refused unless it is short, has no comments, no preprocessor lines,
   no functions of its own, no names that reach the app's own inputs (so it has no clock), and only small counted loops. */
function cleanCode(src){
  if(typeof src!=="string"||!src.length||src.length>2000)return null;
  if(/[^\x20-\x7e\n\t]/.test(src)||/[#\\"'`$@]|\/\/|\/\*/.test(src))return null;
  var depth=0,i,ch,ids=src.match(/[A-Za-z_][A-Za-z0-9_]*/g)||[],loops=0,scenes=0,cost=1,m;
  for(i=0;i<src.length;i++){
    ch=src.charAt(i);
    if(ch==="{")depth++;else if(ch==="}"){depth--;if(depth<0)return null;}
  }
  if(depth!==0)return null;
  for(i=0;i<ids.length;i++){
    if(ids[i]==="gl_FragCoord")continue;
    if(/^(u[A-Z0-9_].*|gl_.*|.*__.*|v|while|do|discard|main|look|mark|texture2D.*|textureCube.*)$/.test(ids[i]))return null;
    if(ids[i]==="for")loops++;
    if(ids[i]==="scene"||ids[i]==="sound")scenes++;
  }
  var re=/\bfor\s*\(\s*int\s+[A-Za-z_]\w*\s*=\s*0\s*;\s*[A-Za-z_]\w*\s*<\s*(\d{1,3})\s*;\s*[A-Za-z_]\w*\s*\+\+\s*\)/g;
  while((m=re.exec(src))){loops--;cost*=Math.max(1,+m[1]);}
  if(loops!==0||cost*Math.max(1,scenes)>64)return null;
  return src;
}
export function cleanFilter(src){
  if(!src||typeof src!=="object")return null;
  var lim={echo:[0,1],edge:[0,1],solar:[0,1],inv:[0,1],post:[3,16],mos:[8,400],liq:[0,0.03],hue:[0,1],ca:[0,0.04],fx:[0,9]};
  var name=cleanName(src.name),out={name:name},k,v;
  if(!name)return null;
  for(k in lim){
    v=src[k];if(v===undefined||v===null||v===0)continue;
    if(typeof v!=="number"||!isFinite(v))return null;
    out[k]=Math.max(lim[k][0],Math.min(lim[k][1],k==="fx"?Math.round(v):v));
  }
  if(src.code!==undefined&&src.code!==null){
    out.code=cleanCode(src.code);if(!out.code)return null;
  }
  return out;
}
/* An overlay from a pack is shader code that says how bright the overlay is at each point. It may use the clock and the sound. */
export function cleanOverlay(src){
  if(!src||typeof src!=="object")return null;
  var name=cleanName(src.name),out={name:name};
  if(!name)return null;
  if(src.sound!==undefined&&src.sound!==null){
    if(src.sound!=="wave"&&src.sound!=="bands")return null;
    out.sound=src.sound;
  }
  out.code=cleanCode(src.code);
  return out.code?out:null;
}
/* A world from a pack is the body of a distance function: shader code that returns how far point p is from the nearest
   surface. It gets p, already folded into one repeat of the world, and m, the morph (about -1.2 to 1.2). It has no clock
   and no sound, so the shape holds still, and it may set "orb" to colour the surface. Its loops may run 16 times in all,
   because the code runs at every step of every ray. JavaScript never sees the shape: flight asks the chip (the probe). */
export function cleanWorld(src){
  if(!src||typeof src!=="object")return null;
  var lim={hue:[0,1],fog:[0.02,0.5],maxd:[4,30],speed:[0.2,1.5]},def={hue:0,fog:0.15,maxd:18,speed:0.7};
  var name=cleanName(src.name),out={name:name},k,v,m,cost=1,re=/<\s*(\d{1,3})\s*;/g;
  if(!name||!/[A-Za-z]/.test(name))return null;
  for(k in lim){
    v=src[k];if(v===undefined||v===null)v=def[k];
    if(typeof v!=="number"||!isFinite(v))return null;
    out[k]=Math.max(lim[k][0],Math.min(lim[k][1],v));
  }
  if(!Array.isArray(src.period)||src.period.length!==3)return null;
  out.period=[];
  for(k=0;k<3;k++){v=src.period[k];if(typeof v!=="number"||!isFinite(v))return null;out.period.push(Math.max(0.5,Math.min(16,v)));}
  out.code=cleanCode(src.code);
  if(!out.code||!/\breturn\b/.test(out.code)||/\b(scene|sound|time|beat|col)\b/.test(out.code))return null;
  while((m=re.exec(out.code)))cost*=Math.max(1,+m[1]);
  return cost>16?null:out;
}
export function cleanMotion(src){
  if(!src||typeof src!=="object")return null;
  var lim={decay:[0,0.98],zoom:[0.95,1.05],rot:[-0.025,0.025],swirl:[-0.08,0.08],wob:[0,0.006],rip:[0,0.03],dx:[-0.012,0.012],dy:[-0.012,0.012],kick:[-1,1]};
  var name=cleanName(src.name),out={name:name},k,v;
  if(!name)return null;
  for(k in lim){
    v=src[k];if(v===undefined||v===null)continue;
    if(typeof v!=="number"||!isFinite(v))return null;
    out[k]=Math.max(lim[k][0],Math.min(lim[k][1],v));
  }
  return out;
}
/* for the test tools and the browser console: every name in this file, readable and (where it can change) settable */
export const __dbg={get cleanName(){return cleanName}, get cleanPalette(){return cleanPalette}, get cleanCode(){return cleanCode}, get cleanFilter(){return cleanFilter}, get cleanOverlay(){return cleanOverlay}, get cleanWorld(){return cleanWorld},
  get cleanMotion(){return cleanMotion}};
