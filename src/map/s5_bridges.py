import cv2, numpy as np, json
from common import *
d=np.load('cls.npz'); cls=d['cls']; g=d['g']; S=2
PTS=[(141,422),(239,437),(398,483),(520,512),(668,430),(768,199),(900,76),(642,238)]
rv=(cls==3)
res=[]
im=cv2.imread('newmap.png'); im=cv2.resize(im,None,fx=2,fy=2)
for x,y in PTS:
    X,Y=x*S,y*S
    # river axis locally
    ry,rx=np.nonzero(rv[Y-40:Y+40,X-40:X+40])
    if len(rx)<30: print('no river',x,y); continue
    ev,evec=np.linalg.eigh(np.cov(np.stack([rx,ry]))); ra=evec[:,1]
    # find best crossing angle: dark-line pixels density along candidate directions
    dark=(g[Y-50:Y+50,X-50:X+50]<200).astype(np.float32)
    best=None
    for a in np.radians(np.arange(0,180,3)):
        dx,dy=np.cos(a),np.sin(a)
        if abs(dx*ra[0]+dy*ra[1])>0.8: continue
        s=0
        for off in (-5,5):     # two parallel edge lines of a road
            for t in np.linspace(-40,40,81):
                px=int(50+t*dx-off*dy); py=int(50+t*dy+off*dx)
                if 0<=px<100 and 0<=py<100: s+=dark[py,px]
        if best is None or s>best[0]: best=(s,dx,dy)
    _,dx,dy=best
    # centre on river centreline
    p=aff(Mnm,np.array([[x,y]],float))[0]; q=aff(Mnm,np.array([[x+dx,y+dy]],float))[0]-p
    rw=aff(Mnm,np.array([[x+ra[0],y+ra[1]]],float))[0]-p
    res.append([round(float(p[0]),1),round(float(p[1]),1),round(float(np.degrees(np.arctan2(q[1],q[0]))),1)])
    cv2.line(im,(int(X-30*dx),int(Y-30*dy)),(int(X+30*dx),int(Y+30*dy)),(0,0,255),3)
print(res)
o=json.load(open('objs.json')); o['bridges']=res; json.dump(o,open('objs.json','w'),separators=(',',':'))
tiles=[im[y*2-60:y*2+60,x*2-60:x*2+60] for x,y in PTS]
cv2.imwrite('br_vis.png',cv2.hconcat(tiles))
