import cv2, numpy as np, json
from scipy import ndimage as ndi
from common import *
d=np.load('cls.npz'); g=d['g'].astype(np.float32); cls=d['cls']
f=np.load('forest.npy')
S=2; H,W=g.shape
# new(2x) px -> map px
def n2m(p): return aff(Mnm,np.asarray(p,np.float64)/S)
# base exclusion mask in new-2x pixels
def m2n2(p): return aff(Mmn,p)*S
excl=mapmask(W,H,m2n2,0.234*S,dil=25,feather=0.1)>0.5
# --- houses
R=np.load('rects.npy')  # (cx,cy,w,h,ang,a) in new 1x px
houses=[]
for cx,cy,w,h,ang,a in R:
    ex=excl[int(cy*S),int(cx*S)] if 0<=int(cy*S)<H and 0<=int(cx*S)<W else True
    if ex: continue
    lo,hi=min(w,h),max(w,h)
    am=abs(((ang%90)+90)%90-45)
    if am<15 and hi/lo<1.35 and hi<6.5: continue      # diamond tree symbols
    if hi>16: continue
    p=n2m([[cx,cy]])[0]
    # size in metres: new px -> map px (x4.27) -> m (x0.8)
    k=0.8/0.2345
    houses.append([round(float(p[0]),1),round(float(p[1]),1),round(float(w*k*0.82),1),round(float(h*k*0.82),1),round(float(ang),1)])
print('houses',len(houses))
# --- tree icons outside forest (small dark components)
dark=g<205
lab,n=ndi.label(dark,structure=np.ones((3,3)))
objs=ndi.find_objects(lab); areas=np.bincount(lab.ravel(),minlength=n+1)
com=ndi.center_of_mass(dark,lab,np.arange(1,n+1))
hmask=np.zeros((H,W),bool)
for hx,hy,*_ in R: cv2.circle(hmask.view(np.uint8),(int(hx*S),int(hy*S)),int(6*S),1,-1)
icons=[]
for i,sl in enumerate(objs,1):
    hh=sl[0].stop-sl[0].start; ww=sl[1].stop-sl[1].start
    if not(8<=max(hh,ww)<=26 and 25<=areas[i]<=260): continue
    cy,cx=com[i-1]; iy,ix=int(cy),int(cx)
    if f[iy,ix] or excl[iy,ix] or hmask[iy,ix] or cls[iy,ix] in (3,4): continue
    p=n2m([[cx,cy]])[0]; icons.append([round(float(p[0]),1),round(float(p[1]),1)])
print('icons',len(icons))
# --- bridges
B=np.load('bridges.npy'); bridges=[]
for bx,by,dx,dy in B:
    p=n2m([[bx*S,by*S]])[0]; q=n2m([[(bx+dx)*S,(by+dy)*S]])[0]-p
    bridges.append([round(float(p[0]),1),round(float(p[1]),1),round(float(np.degrees(np.arctan2(q[1],q[0]))),1)])
print(bridges)
json.dump({'houses':houses,'icons':icons,'bridges':bridges},open('objs.json','w'),separators=(',',':'))
