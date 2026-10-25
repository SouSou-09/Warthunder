import numpy as np, json
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
g=np.array(Image.open('map.png').convert('L')).astype(float)
H,W=g.shape
lab=np.load('lab.npy'); n=lab.max()
light=g>=225
from PIL import ImageDraw
poly=[(28,455),(28,420),(65,400),(75,360),(95,300),(130,240),(160,215),(190,200),(265,182),(470,178),(500,155),(530,125),(790,118),(820,95),(870,70),(1000,56),(1080,60),(1300,78),(1350,108),(1420,185),(1462,220),(1466,320),(1500,425),(1503,505),(1470,570),(1440,640),(1390,750),(1340,795),(1290,822),(1130,830),(1075,810),(1020,805),(660,815),(280,832),(240,790),(205,725),(170,650),(120,590),(60,540),(28,515)]
pm=Image.new('L',(W,H),0); ImageDraw.Draw(pm).polygon(poly,fill=255); inside=np.array(pm)>0
np.save('inside.npy',inside)
dt=ndi.distance_transform_edt(light)
objs=ndi.find_objects(lab); areas=np.bincount(lab.ravel(),minlength=n+1)
CLS={}  # region id -> class
cls=np.zeros((H,W),np.uint8)   # 0 line, 1 grass, 2 field(id in fid), 3 river, 4 asphalt, 5 concrete
fid=np.zeros((H,W),np.int32)
for i in range(1,n+1):
    sl=objs[i-1]
    if sl is None: continue
    m=lab[sl]==i; a=areas[i]; ys,xs=sl
    mx=dt[sl][m].max(); mean=g[sl][m].mean()
    insfrac=inside[sl][m].mean()
    diag=np.hypot(xs.stop-xs.start,ys.stop-ys.start)
    if i==37: c=4
    elif mean<240.5 and a>1500: c=3
    elif insfrac>0.5: c=4 if (mx<=8 and a>60) else 1
    else: c=4 if (mx<=7 and diag>120 and a>200) else 2
    cls[sl][m]=c
    if c==2: fid[sl][m]=i
# lines inherit nearest region class later (via nearest-neighbour fill) but keep a line mask
linem=g<225
# seeds -> concrete
seeds=[(280,430),(560,430),(921,413),(1181,416),(280,530),(559,531),(913,538),(1203,535),(342,593),(732,627),(1247,343),(1120,722),(880,597),(772,375),(1100,596)]
for (x,y) in seeds:
    r=lab[y,x]
    if r>0:
        cls[lab==r]=5
    else: print('seed on line',x,y)
# rect aprons
def rect(x0,y0,x1,y1,c=5):
    sub=(cls[y0:y1,x0:x1]!=4)&(cls[y0:y1,x0:x1]!=3)
    cls[y0:y1,x0:x1][sub]=c
for r in [(380,348,722,408),(1090,218,1395,262),(495,570,665,606),(130,451,1405,509),(1210,268,1360,296)]:
    rect(*r)
# runway pads handled in 3D; mark runway + pads as asphalt
cls[451:509,45:1495]=4
np.save('cls2.npy',cls); np.save('fid.npy',fid)
# nearest-class fill for line pixels
idx=ndi.distance_transform_edt(linem,return_distances=False,return_indices=True)
cls_f=cls[idx[0],idx[1]]; fid_f=fid[idx[0],idx[1]]
# upscale to 2x
S2=2
Hh,Ww=H*S2,W*S2
palette={1:(118,146,86),3:(88,122,150),4:(92,92,95),5:(150,148,142)}
fieldcols=[(124,150,90),(141,160,96),(160,166,102),(174,166,106),(112,140,84),(152,148,98),(166,150,100),(130,152,98),(185,170,110),(104,134,80)]
img=np.zeros((H,W,3),np.float32)
for k,c in palette.items(): img[cls_f==k]=c
fm=cls_f==2
fids=np.unique(fid_f[fm])
for f in fids:
    img[(fid_f==f)]=fieldcols[(int(f)*7)%len(fieldcols)]
big=np.array(Image.fromarray(img.astype(np.uint8)).resize((Ww,Hh),Image.BICUBIC)).astype(np.float32)
# crop furrows in fields
rng=np.random.RandomState(7)
fidb=np.array(Image.fromarray(fid_f.astype(np.int32)).resize((Ww,Hh),Image.NEAREST))
yy,xx=np.mgrid[0:Hh,0:Ww]
furr=np.zeros((Hh,Ww),np.float32)
for f in fids:
    m=fidb==f
    if m.sum()<2000: continue
    ang=rng.uniform(0,np.pi); per=rng.uniform(6,11)
    t=(xx*np.cos(ang)+yy*np.sin(ang))/per
    furr[m]=0.07*np.sign(np.sin(2*np.pi*t[m]))
big*= (1+furr)[...,None]
# value noise
def vnoise(h,w,cell,seed):
    r=np.random.RandomState(seed); gh,gw=h//cell+2,w//cell+2
    a=r.rand(gh,gw).astype(np.float32)
    im=Image.fromarray((a*255).astype(np.uint8)).resize((gw*cell,gh*cell),Image.BICUBIC)
    return np.array(im)[:h,:w].astype(np.float32)/255
nz=0.5*vnoise(Hh,Ww,64,1)+0.3*vnoise(Hh,Ww,16,2)+0.2*vnoise(Hh,Ww,4,3)
big*=(0.9+0.2*nz)[...,None]
# lines: upscale darkness mask and blend
lm=np.array(Image.fromarray(((255-g).clip(0,255)).astype(np.uint8)).resize((Ww,Hh),Image.BICUBIC)).astype(np.float32)/255
lm=np.clip((lm-0.25)*1.6,0,1)
ICONS=[(x,372) for x in (392,428,462,497,530,563,597,630,663,697)]+[(x,236) for x in (1141,1187,1226,1264,1302,1340)]+[(x,281) for x in (1229,1266,1304,1340)]+[(x,585) for x in (517,550,582,614,647)]+[(x,712) for x in (1117,1154,1190)]+[(808,361),(1236,616)]
for (cx,cy) in ICONS:
    lm[(cy-16)*S2:(cy+16)*S2,(cx-16)*S2:(cx+16)*S2]=0
big=big*(1-0.55*lm[...,None])+np.array([40,42,44],np.float32)*0.55*lm[...,None]
# edge fade to uniform field colour
EDGE=np.array([128,152,92],np.float32)
yy2,xx2=np.mgrid[0:Hh,0:Ww]
d=np.minimum(np.minimum(xx2,Ww-1-xx2),np.minimum(yy2,Hh-1-yy2)).astype(np.float32)
t=np.clip(1-d/160.0,0,1); t=t*t*(3-2*t)
big=big*(1-t[...,None])+EDGE*t[...,None]
out=Image.fromarray(big.clip(0,255).astype(np.uint8))
out.save('ground.png'); out.save('ground.jpg',quality=80,optimize=True)
import os; print('jpg bytes',os.path.getsize('ground.jpg'))
out.resize((1536,1024),Image.LANCZOS).save('ground_prev.png')
