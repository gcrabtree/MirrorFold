"""How well the two halves of a VR viewer picture agree.

For blocks of the left eye's half, find the shift that best matches the right eye's half. In a pair that shows one
scene, the shifts are sideways only (that is depth); a shift up or down is something the eyes cannot bring together.
Compare the numbers for an effect with the numbers for the plain picture: |dy| should be no worse.

  python3 tools/render.py --world sponge --size 1000x500 --js "setStereo(true);fi=2" -o clean.png
  python3 tools/render.py --world sponge --size 1000x500 --js "setStereo(true);setLook(12);setMotion(2)" -o twirl.png
  python3 tools/stereo.py clean.png twirl.png

Needs numpy and Pillow.
"""
import sys,numpy as np
from PIL import Image
for f in sys.argv[1:]:
    im=np.asarray(Image.open(f).convert("L"),dtype=np.float32);h,w=im.shape;L=im[:,:w//2];R=im[:,w//2:w//2*2];W=w//2
    # the shift between the two lens centres: the best whole-picture match
    g=min(range(-W//2,W//2),key=lambda d:float(((L[100:h-100,max(0,-d)+20:W-max(0,d)-20]-R[100:h-100,max(0,-d)+20+d:W-max(0,d)-20+d])**2).mean()))
    B=24;res=[]
    for y in range(80,h-80-B,B):
        for x in range(40,W-40-B,B):
            a=L[y:y+B,x:x+B]
            if a.std()<12:continue
            best=None
            for dy in range(-6,7):
                for dx in range(-24,25):
                    x2=x+g+dx
                    if x2<0 or x2+B>W:continue
                    b=R[y+dy:y+dy+B,x2:x2+B]
                    e=float(((a-b)**2).mean())
                    if best is None or e<best[0]:best=(e,dx,dy)
            if best:res.append((best[1],best[2],best[0]/a.var()))
    r=np.array(res).reshape(-1,3);good=r[r[:,2]<0.25]
    if not len(good):print(f.split("/")[-1],"blocks",len(r),"none matched");continue
    print("%-16s centre shift %4d  blocks %3d matched %3d  dx %3d..%3d  |dy| mean %.2f  |dy|>1: %2.0f%%"%(f.split("/")[-1],g,len(r),len(good),good[:,0].min(),good[:,0].max(),np.abs(good[:,1]).mean(),100*(np.abs(good[:,1])>1).mean()))
