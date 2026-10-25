import numpy as np, cv2
Mmn=np.load('Mmn.npy'); Mnm=np.linalg.inv(Mmn)
POLY=np.array([(28,455),(28,420),(65,400),(75,360),(95,300),(130,240),(160,215),(190,200),(265,182),(470,178),(500,155),(530,125),(790,118),(820,95),(870,70),(1000,56),(1080,60),(1300,78),(1350,108),(1420,185),(1462,220),(1466,320),(1500,425),(1503,505),(1470,570),(1440,640),(1390,750),(1340,795),(1290,822),(1130,830),(1075,810),(1020,805),(660,815),(280,832),(240,790),(205,725),(170,650),(120,590),(60,540),(28,515)],np.float32)
def mapmask(w,h,to_px,px_per_map,dil=30,feather=12):
    """fence polygon mask; to_px maps map-pixel Nx2 -> target px Nx2"""
    m=np.zeros((h,w),np.uint8)
    pts=to_px(POLY)
    cv2.fillPoly(m,[np.round(pts*4).astype(np.int32)],255,shift=2)
    k=int(round(dil*px_per_map))
    if k>0: m=cv2.dilate(m,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*k+1,2*k+1)))
    m=cv2.GaussianBlur(m.astype(np.float32)/255,(0,0),max(0.5,feather*px_per_map))
    return np.clip(m,0,1)
def aff(M,p): return p@M[:2,:2].T+M[:2,2]
def vnoise(h,w,cell,seed):
    r=np.random.RandomState(seed); gh,gw=h//cell+2,w//cell+2
    a=r.rand(gh,gw).astype(np.float32)
    return cv2.resize(a,(gw*cell,gh*cell),interpolation=cv2.INTER_CUBIC)[:h,:w]
