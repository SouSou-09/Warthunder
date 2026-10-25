import cv2, numpy as np, json, os
from scipy import ndimage as ndi
from common import *
d=np.load('cls.npz'); g=d['g']; cls=d['cls'].copy(); fid=d['fid']
forest=np.load('forest.npy')
cls[cls==2]=1
cls[forest & (cls==1)]=2
S=2
H2,W2=g.shape
X0,Y0,X1,Y1=-1350.0,-960.0,2900.0,1990.0
TW=4096; TH=int(round(TW*(Y1-Y0)/(X1-X0)))
sx=(X1-X0)/TW; sy=(Y1-Y0)/TH
rng=np.random.RandomState(3)
nf=fid.max()+1
sz=np.bincount(fid.ravel(),minlength=nf)
fieldcols=np.array([(124,150,90),(141,160,96),(160,166,102),(174,166,106),(112,140,84),(152,148,98),(166,150,100),(130,152,98),(185,170,110),(104,134,80),(150,132,92),(120,128,76)],np.float32)
fcol=fieldcols[(np.arange(nf)*7)%len(fieldcols)]
fang=rng.uniform(0,np.pi,nf).astype(np.float32); fper=rng.uniform(4,8,nf).astype(np.float32)
bigf=sz>3000
fac=np.cos(fang); fas=np.sin(fang)
# noise fields at texture res (float16 to save memory)
nz=(0.5*vnoise(TH,TW,96,1)+0.3*vnoise(TH,TW,24,2)+0.2*vnoise(TH,TW,6,3)).astype(np.float16)
can=(0.6*vnoise(TH,TW,5,9)+0.4*vnoise(TH,TW,2,10)).astype(np.float16)
rip=vnoise(TH,TW,40,4).astype(np.float16)
out=np.zeros((TH,TW,3),np.uint8)
EDGE=np.array([128,152,92],np.float32)
CH=256
for y0 in range(0,TH,CH):
    y1=min(TH,y0+CH); h=y1-y0
    uu,vv=np.meshgrid(np.arange(TW,dtype=np.float32)+0.5,np.arange(y0,y1,dtype=np.float32)+0.5)
    MX=X0+uu*sx; MY=Y0+vv*sy
    NX=((Mmn[0,0]*MX+Mmn[0,1]*MY+Mmn[0,2])*S-0.5).astype(np.float32)
    NY=((Mmn[1,0]*MX+Mmn[1,1]*MY+Mmn[1,2])*S-0.5).astype(np.float32)
    C=cv2.remap(cls,NX,NY,cv2.INTER_NEAREST,borderMode=cv2.BORDER_REPLICATE)
    F=cv2.remap(fid.astype(np.float32),NX,NY,cv2.INTER_NEAREST,borderMode=cv2.BORDER_REPLICATE).astype(np.int32)
    G=cv2.remap(g,NX,NY,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    img=np.zeros((h,TW,3),np.float32)
    img[:]=(118,146,86)
    bf=(C==1)&bigf[F]&(F>0)
    img[bf]=fcol[F[bf]]
    # furrows
    t=(uu[bf]*fac[F[bf]]+vv[bf]*fas[F[bf]])/fper[F[bf]]
    img[bf]*=(1+0.06*np.sign(np.sin(2*np.pi*t)))[:,None]
    fo=C==2; img[fo]=(64,90,52)
    wa=C==3; img[wa]=(84,116,140)
    rd=C==4; img[rd]=(126,122,110)
    img*=(0.9+0.2*nz[y0:y1].astype(np.float32))[...,None]
    img[fo]*=(0.72+0.56*can[y0:y1][fo].astype(np.float32))[:,None]
    img[wa]*=(0.93+0.14*rip[y0:y1][wa].astype(np.float32))[:,None]
    lm=np.clip(((255-G)/255-0.22)*1.5,0,1)
    lm[fo]*=0.3
    img=img*(1-0.5*lm[...,None])+np.array([40,42,44],np.float32)*0.5*lm[...,None]
    dd=np.minimum(np.minimum(uu,TW-uu),np.minimum(vv,TH-vv))
    tt=np.clip(1-dd/200.0,0,1); tt=tt*tt*(3-2*tt)
    img=img*(1-tt[...,None])+EDGE*tt[...,None]
    out[y0:y1]=img.clip(0,255).astype(np.uint8)
cv2.imwrite('region.jpg',out[:,:,::-1],[cv2.IMWRITE_JPEG_QUALITY,72,cv2.IMWRITE_JPEG_OPTIMIZE,1])
print('region',TW,TH,os.path.getsize('region.jpg'))
cv2.imwrite('region_prev.png',cv2.resize(out[:,:,::-1],(1024,int(1024*TH/TW)),interpolation=cv2.INTER_AREA))
del out,nz,can,rip
# forest mask at quarter-ish res for tree placement (texture frame, 1024 wide)
FW=1024; FH=int(round(FW*TH/TW)); fsx=(X1-X0)/FW; fsy=(Y1-Y0)/FH
uu,vv=np.meshgrid(np.arange(FW,dtype=np.float32)+0.5,np.arange(FH,dtype=np.float32)+0.5)
MX=X0+uu*fsx; MY=Y0+vv*fsy
NX=((Mmn[0,0]*MX+Mmn[0,1]*MY+Mmn[0,2])*S-0.5).astype(np.float32)
NY=((Mmn[1,0]*MX+Mmn[1,1]*MY+Mmn[1,2])*S-0.5).astype(np.float32)
C=cv2.remap(cls,NX,NY,cv2.INTER_NEAREST,borderMode=cv2.BORDER_REPLICATE)
np.savez_compressed('fmask.npz',C=C,X0=X0,Y0=Y0,fsx=fsx,fsy=fsy)
json.dump({'X0':X0,'Y0':Y0,'X1':X1,'Y1':Y1,'TW':TW,'TH':TH},open('frame.json','w'))
# alpha mask for the base ground image (map px 0..1536 x 0..1024) at 768x512
am=mapmask(768,512,lambda p:p/2,0.5,dil=28,feather=10)
cv2.imwrite('basemask.png',(am*255).astype(np.uint8))
print('ok')
