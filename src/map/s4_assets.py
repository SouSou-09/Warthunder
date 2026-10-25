import cv2, numpy as np, json, os
from common import *
fr=json.load(open('frame.json')); X0,Y0,X1,Y1,TW,TH=[fr[k] for k in ('X0','Y0','X1','Y1','TW','TH')]
sx=(X1-X0)/TW; sy=(Y1-Y0)/TH
reg=cv2.imread('region.jpg')
gr=cv2.imread('ground.jpg')            # 3072x2048 -> map 0..1536
GH,GW=gr.shape[:2]
uu,vv=np.meshgrid(np.arange(GW,dtype=np.float32)+0.5,np.arange(GH,dtype=np.float32)+0.5)
mx=uu/2; my=vv/2
R=cv2.remap(reg,((mx-X0)/sx-0.5).astype(np.float32),((my-Y0)/sy-0.5).astype(np.float32),cv2.INTER_LINEAR)
del uu,vv,mx,my
m=mapmask(GW,GH,lambda p:p*2,2,dil=34,feather=9)[...,None]
out=(gr*m+R*(1-m)).astype(np.uint8)
cv2.imwrite('ground_new.jpg',out,[cv2.IMWRITE_JPEG_QUALITY,80,cv2.IMWRITE_JPEG_OPTIMIZE,1])
cv2.imwrite('ground_new_prev.png',cv2.resize(out,(1536,1024),interpolation=cv2.INTER_AREA))
print('ground_new',os.path.getsize('ground_new.jpg'))
del R,gr,out
# forest mask
f=np.load('fmask.npz'); C=f['C']; fsx=float(f['fsx']); fsy=float(f['fsy'])
FH,FW=C.shape
fo=(C==2).astype(np.uint8)
fo=cv2.erode(fo,np.ones((3,3),np.uint8))
bm=mapmask(FW,FH,lambda p:np.stack([(p[:,0]-X0)/fsx,(p[:,1]-Y0)/fsy],1),1/fsx,dil=45,feather=0.1)>0.3
fo[bm]=0
cv2.imwrite('forest.png',fo*255,[cv2.IMWRITE_PNG_COMPRESSION,9])
print('forest px',fo.sum(),'area km2',fo.sum()*fsx*fsy*0.64/1e6, os.path.getsize('forest.png'))
