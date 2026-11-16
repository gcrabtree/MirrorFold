/* A QR code for a short piece of text, worked out here so that no outside service is asked. Nothing in this file
   touches the page. It makes the ordinary kind of code (model 2) in byte mode at error correction level M, in sizes
   1 to 9, which hold up to 180 letters: more than a link to a spot needs. The squares are given one fixed mask (the
   chequerboard); a reader does not mind which mask is used, as long as the code says which. */
/* for each size: how many check bytes each block has, and how many blocks of how many data bytes ([blocks, bytes] pairs) */
export const QR_SIZES=[null,
  [10,[[1,16]]],[16,[[1,28]]],[26,[[1,44]]],[18,[[2,32]]],[24,[[2,43]]],[16,[[4,27]]],[18,[[4,31]]],[22,[[2,38],[2,39]]],[22,[[3,36],[2,37]]]];
/* for each size: where the middles of the small alignment squares lie, along each axis */
export const QR_ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46]];

/* multiplying two bytes as the code's arithmetic has it (the field of 256 with the polynomial 0x11D) */
function mul(x,y){
  var z=0,i;
  for(i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}
  return z&255;
}
/* the check bytes for a block of data: the remainder of the data over the polynomial with n roots */
export function qrCheck(data,n){
  var div=[],res=[],root=1,i,j,f;
  for(i=0;i<n;i++)div.push(0);
  div[n-1]=1;
  for(i=0;i<n;i++){
    for(j=0;j<n;j++){div[j]=mul(div[j],root);if(j+1<n)div[j]^=div[j+1];}
    root=mul(root,2);
  }
  for(i=0;i<n;i++)res.push(0);
  for(i=0;i<data.length;i++){
    f=data[i]^res.shift();res.push(0);
    for(j=0;j<n;j++)res[j]^=mul(div[j],f);
  }
  return res;
}
/* how many letters a size holds */
export function qrRoom(v){
  var s=QR_SIZES[v],n=0,i;
  for(i=0;i<s[1].length;i++)n+=s[1][i][0]*s[1][i][1];
  return n-2;
}
/* The code for a text of plain letters (each below 256): {n, m}, n squares a side and m the squares row by row, 1 for
   dark. Null if the text is too long for size 9 or has a letter that does not fit a byte. */
export function qrMake(text){
  var v,i,j,k,n,bits=[],bytes=[],blocks=[],out=[],spec,total=0,at,m,fn,x,y,b,most=0,ecn,put,al,rem,up,right,vert,xx,yy;
  if(typeof text!=="string")return null;
  for(i=0;i<text.length;i++)if(text.charCodeAt(i)>255)return null;
  for(v=1;v<=9&&qrRoom(v)<text.length;v++){}
  if(v>9)return null;
  spec=QR_SIZES[v];ecn=spec[0];
  for(i=0;i<spec[1].length;i++)total+=spec[1][i][0]*spec[1][i][1];
  /* the data: "bytes follow", how many, the bytes, an end mark, then padding to fill the room */
  put=function(val,len){for(var q=len-1;q>=0;q--)bits.push((val>>>q)&1);};
  put(4,4);put(text.length,8);
  for(i=0;i<text.length;i++)put(text.charCodeAt(i),8);
  put(0,Math.min(4,total*8-bits.length));
  while(bits.length%8)bits.push(0);
  for(i=0;i<bits.length;i+=8){b=0;for(j=0;j<8;j++)b=(b<<1)|bits[i+j];bytes.push(b);}
  for(i=0;bytes.length<total;i++)bytes.push(i%2?0x11:0xec);
  /* cut into blocks, each with its check bytes; then dealt out a byte from each block in turn, data first, then checks */
  at=0;
  for(i=0;i<spec[1].length;i++)for(j=0;j<spec[1][i][0];j++){
    b=bytes.slice(at,at+spec[1][i][1]);at+=spec[1][i][1];
    blocks.push({d:b,e:qrCheck(b,ecn)});most=Math.max(most,b.length);
  }
  for(i=0;i<most;i++)for(j=0;j<blocks.length;j++)if(i<blocks[j].d.length)out.push(blocks[j].d[i]);
  for(i=0;i<ecn;i++)for(j=0;j<blocks.length;j++)out.push(blocks[j].e[i]);
  /* the square: m its squares, fn which of them are fixed and not for data */
  n=17+4*v;m=new Uint8Array(n*n);fn=new Uint8Array(n*n);
  put=function(px,py,dark){if(px>=0&&px<n&&py>=0&&py<n){m[py*n+px]=dark?1:0;fn[py*n+px]=1;}};
  for(i=0;i<n;i++){put(6,i,i%2===0);put(i,6,i%2===0);} /* the two dotted lines */
  [[3,3],[n-4,3],[3,n-4]].forEach(function(c){ /* the three large corner squares, each with a clear border */
    for(y=-4;y<=4;y++)for(x=-4;x<=4;x++){k=Math.max(Math.abs(x),Math.abs(y));put(c[0]+x,c[1]+y,k!==2&&k!==4);}
  });
  al=QR_ALIGN[v];
  for(i=0;i<al.length;i++)for(j=0;j<al.length;j++){ /* the small squares, except where a corner square is */
    if((i===0&&j===0)||(i===0&&j===al.length-1)||(i===al.length-1&&j===0))continue;
    for(y=-2;y<=2;y++)for(x=-2;x<=2;x++)put(al[i]+x,al[j]+y,Math.max(Math.abs(x),Math.abs(y))!==1);
  }
  /* the fifteen bits that say which error correction and which mask: level M is 0 and the mask is 0, so the data part is 0 */
  rem=0;for(i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537);
  b=(rem&0x3ff)^0x5412;
  for(i=0;i<=5;i++)put(8,i,(b>>>i)&1);
  put(8,7,(b>>>6)&1);put(8,8,(b>>>7)&1);put(7,8,(b>>>8)&1);
  for(i=9;i<15;i++)put(14-i,8,(b>>>i)&1);
  for(i=0;i<8;i++)put(n-1-i,8,(b>>>i)&1);
  for(i=8;i<15;i++)put(8,n-15+i,(b>>>i)&1);
  put(8,n-8,1);
  if(v>=7){ /* from size 7 the code also says its size, twice */
    rem=v;for(i=0;i<12;i++)rem=(rem<<1)^((rem>>>11)*0x1f25);
    b=(v<<12)|(rem&0xfff);
    for(i=0;i<18;i++){x=n-11+i%3;y=Math.floor(i/3);put(x,y,(b>>>i)&1);put(y,x,(b>>>i)&1);}
  }
  /* the data, in a zigzag of two-square columns from the bottom right, with the chequerboard mask laid over it */
  k=0;
  for(right=n-1;right>=1;right-=2){
    if(right===6)right=5;
    for(vert=0;vert<n;vert++)for(j=0;j<2;j++){
      xx=right-j;up=((right+1)&2)===0;yy=up?n-1-vert:vert;
      if(fn[yy*n+xx])continue;
      b=k<out.length*8?(out[k>>>3]>>>(7-(k&7)))&1:0;k++;
      m[yy*n+xx]=b^((xx+yy)%2===0?1:0);
    }
  }
  return {n:n,m:m};
}

/* for the test tools and the browser console: every name in this file */
export const __dbg={QR_SIZES, QR_ALIGN, qrMul:mul, qrCheck, qrRoom, qrMake};
