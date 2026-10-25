# classify the new map at 2x (2048x1366) -> cls (0 none,1 grass,2 forest,3 river,4 road), field ids
import cv2, numpy as np
from scipy import ndimage as ndi
src=cv2.imread('newmap.png',0).astype(np.float32)
S=2
g=cv2.resize(src,None,fx=S,fy=S,interpolation=cv2.INTER_CUBIC)
H,W=g.shape
light=g>=222
lab,n=ndi.label(light); idx=np.arange(n+1)
areas=np.bincount(lab.ravel(),minlength=n+1)
dt=ndi.distance_transform_edt(light)
means=ndi.mean(g,lab,idx); mx=ndi.maximum(dt,lab,idx)
objs=ndi.find_objects(lab); diag=np.zeros(n+1)
for i,sl in enumerate(objs,1):
    if sl is not None: diag[i]=np.hypot(sl[0].stop-sl[0].start,sl[1].stop-sl[1].start)
river=(means<243.5)&(areas>2000)&(mx>=6); river[0]=False
road=(mx<=4.6)&(areas>=150)&(diag>70)&~river; road[0]=False
dark=(g<205).astype(np.float32)
den=cv2.GaussianBlur(dark,(0,0),9)
forest=(den>0.235)
forest=ndi.binary_opening(forest,iterations=2); forest=ndi.binary_closing(forest,iterations=3)
cls=np.ones((H,W),np.uint8)
cls[forest]=2
R=river[lab]; cls[R]=3
cls[road[lab]]=4
cls[~light & ~R]=0
fid=np.where(cls==1,lab,0).astype(np.int32)
ind=ndi.distance_transform_edt(cls==0,return_distances=False,return_indices=True)
clsf=cls[ind[0],ind[1]]; fidf=fid[ind[0],ind[1]]
# river: also absorb its own bank lines into water-ish edge later; bridges = gaps in river
rm=(clsf==3).astype(np.uint8)
closed=cv2.morphologyEx(rm,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(31,31)))
gap=(closed>0)&(rm==0)
# only gaps crossing the river (component touching river on two sides) & reasonably small
gl,gn=ndi.label(gap)
bridges=[]
for i,sl in enumerate(ndi.find_objects(gl),1):
    m=gl[sl]==i; a=m.sum()
    if a<20 or a>2500: continue
    ys,xs=np.nonzero(m); ys=ys+sl[0].start; xs=xs+sl[1].start
    # river direction locally via river pixels nearby
    y0,y1=max(0,ys.min()-40),min(H,ys.max()+40); x0,x1=max(0,xs.min()-40),min(W,xs.max()+40)
    ry,rx=np.nonzero(rm[y0:y1,x0:x1])
    if len(rx)<50: continue
    c=np.cov(np.stack([rx,ry]))
    ev,evec=np.linalg.eigh(c); d=evec[:,1]          # river axis
    bridges.append((xs.mean()/S,ys.mean()/S,float(d[0]),float(d[1])))
print('bridges',len(bridges))
np.savez_compressed('cls.npz',cls=clsf,fid=fidf,g=g.astype(np.uint8),den=den.astype(np.float16))
np.save('bridges.npy',np.array(bridges))
vis=np.full((H,W,3),255,np.uint8)
vis[clsf==1]=(140,200,140); vis[clsf==2]=(40,110,40); vis[clsf==3]=(200,140,60); vis[clsf==4]=(70,70,70)
for bx,by,dx,dy in bridges: cv2.circle(vis,(int(bx*S),int(by*S)),10,(0,0,255),3)
cv2.imwrite('cls_vis.png',cv2.resize(vis,(1024,683),interpolation=cv2.INTER_AREA))
