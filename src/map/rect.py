import cv2, numpy as np
S=4
g=cv2.resize(cv2.imread('newmap.png',0),None,fx=S,fy=S,interpolation=cv2.INTER_CUBIC)
allr=[]
for T in (200,215,230):
  bw=(g<T).astype(np.uint8)*255
  cnts,hier=cv2.findContours(bw,cv2.RETR_TREE,cv2.CHAIN_APPROX_NONE)
  for i,c in enumerate(cnts):
    if hier[0][i][3]<0: continue
    a=cv2.contourArea(c)
    if a<70 or a>9000: continue
    (cx,cy),(w,h),ang=cv2.minAreaRect(c)
    if min(w,h)<8: continue
    hull=cv2.convexHull(c); sol=a/max(1,cv2.contourArea(hull)); fill=a/(w*h)
    if fill<0.8 or sol<0.94 or max(w,h)/min(w,h)>4: continue
    allr.append((cx/S,cy/S,(w+6)/S,(h+6)/S,ang,a))
# NMS: keep largest per location
allr.sort(key=lambda r:-r[5]); keep=[]
for r in allr:
    if all(np.hypot(r[0]-k[0],r[1]-k[1])>max(2.5,min(k[2],k[3])*0.5) for k in keep): keep.append(r)
rects=np.array(keep); print(len(rects)); np.save('rects.npy',rects)
vis=cv2.cvtColor(cv2.imread('newmap.png',0),cv2.COLOR_GRAY2BGR); vis=cv2.resize(vis,None,fx=2,fy=2)
for cx,cy,w,h,ang,a in rects:
    box=cv2.boxPoints(((cx*2,cy*2),(w*2,h*2),ang)).astype(int)
    cv2.drawContours(vis,[box],0,(0,0,255),2)
cv2.imwrite('rect_full.png',vis)
cv2.imwrite('rect_c.png',vis[700:1366,0:1000])
