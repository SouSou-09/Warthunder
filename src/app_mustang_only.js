(function () {
'use strict';
var D = window.P51_DATA;
var S = D.S;                       // px per metre in the source drawing
var PHI = 12.2 * Math.PI / 180;    // ground (three-point) attitude of the side view
var HUB_H = 2.61;                  // hub height above ground in three-point attitude (m)
var NOSE_Z = 4.9;                  // world z of the spinner tip (centres the aircraft)

/* ---------------------------------------------------------------- helpers */
function interp(xs, ys, x) {
  var n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  var i = 1;
  while (xs[i] < x) i++;
  var t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
}
function tab(rows, col) { return rows.map(function (r) { return r[col]; }); }
function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
function linRGB(hex) { var c = lin(hex); return [c.r, c.g, c.b]; }
function sgn(v) { return v < 0 ? -1 : 1; }
// airframe coords: (lat, up, aft) -> three.js (x, y, z) with the nose toward +z
function P(lat, up, aft) { return [lat, up, -aft]; }

/* ------------------------------------------------------------ loft builder */
function loft(rings, opt) {
  opt = opt || {};
  var R = rings.length, N = rings[0].length, pos = [], idx = [], i, j;
  for (i = 0; i < R; i++) for (j = 0; j < N; j++) pos.push(rings[i][j][0], rings[i][j][1], rings[i][j][2]);
  for (i = 0; i < R - 1; i++) {
    for (j = 0; j < N; j++) {
      if (opt.skip && opt.skip(i, j, N)) continue;
      var j2 = (j + 1) % N;
      var a = i * N + j, b = i * N + j2, c = (i + 1) * N + j2, d = (i + 1) * N + j;
      idx.push(a, b, c, a, c, d);
    }
  }
  function cap(ring, flip) {
    var base = pos.length / 3, cx = 0, cy = 0, cz = 0;
    for (var k = 0; k < N; k++) { pos.push(ring[k][0], ring[k][1], ring[k][2]); cx += ring[k][0]; cy += ring[k][1]; cz += ring[k][2]; }
    pos.push(cx / N, cy / N, cz / N);
    for (var m = 0; m < N; m++) {
      var m2 = (m + 1) % N;
      if (flip) idx.push(base + N, base + m2, base + m); else idx.push(base + N, base + m, base + m2);
    }
  }
  if (opt.capStart) cap(rings[0], false);
  if (opt.capEnd) cap(rings[R - 1], true);
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  var cols = new Float32Array(pos.length).fill(1);
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

/* ------------------------------------------------- hinged control surfaces (shared) */
function uniqSorted(a) { a.sort(function (x, y) { return x - y; }); return a.filter(function (v, i) { return i === 0 || Math.abs(v - a[i - 1]) > 1e-6; }); }
function stationsIn(base, y0, y1) {
  var r = [y0, y1];
  base.forEach(function (v) { if (v > y0 + 1e-6 && v < y1 - 1e-6) r.push(v); });
  return uniqSorted(r);
}
// airfoil section ring from chord f0 to f1 (upper TE->LE, lower LE->TE); fn(f, side) -> point
function chordRing(f0, f1, M, fn) {
  var xs = [], i, ring = [];
  for (i = 0; i <= M; i++) xs.push(f0 + (f1 - f0) * (1 - Math.cos(Math.PI * i / M)) / 2);
  for (i = M; i >= 0; i--) ring.push(fn(xs[i], 1));
  for (i = (f0 < 1e-9 ? 1 : 0); i <= M; i++) ring.push(fn(xs[i], -1));
  return ring;
}
function surfLoft(stations, f0, f1, fn, flip) {
  var M = (f1 - f0) > 0.5 ? 22 : 12;
  var rings = stations.map(function (s) {
    var r = chordRing(f0, f1, M, function (f, sd) { return fn(s, f, sd); });
    return flip ? r.reverse() : r;
  });
  var g = loft(rings, { capStart: true, capEnd: true });
  // analytic normals from neighbouring stations so the shading stays continuous across the cuts between parts
  var R = rings.length, N = rings[0].length, pos = g.attributes.position, nor = g.attributes.normal, i, j;
  function P3(ii, jj) { var k = ii * N + ((jj % N) + N) % N; return [pos.getX(k), pos.getY(k), pos.getZ(k)]; }
  for (i = 0; i < R; i++) for (j = 0; j < N; j++) {
    var a1 = P3(i, j + 1), a0 = P3(i, j - 1), b1 = P3(Math.min(R - 1, i + 1), j), b0 = P3(Math.max(0, i - 1), j);
    var t1 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], t2 = [b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]];
    var nx = t1[1] * t2[2] - t1[2] * t2[1], ny = t1[2] * t2[0] - t1[0] * t2[2], nz = t1[0] * t2[1] - t1[1] * t2[0];
    var L = Math.sqrt(nx * nx + ny * ny + nz * nz), k = i * N + j;
    if (L < 1e-9) continue;
    nx /= L; ny /= L; nz /= L;
    if (nx * nor.getX(k) + ny * nor.getY(k) + nz * nor.getZ(k) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    nor.setXYZ(k, nx, ny, nz);
  }
  return g;
}
function mkHinge(parent, p0, p1) {
  var g = new THREE.Group();
  g.position.set(p0[0], p0[1], p0[2]); parent.add(g);
  g.userData.p0 = p0;
  g.userData.axis = new THREE.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize();
  return g;
}
function hingeRot(g, ang) { g.quaternion.setFromAxisAngle(g.userData.axis, ang); }

/* ----------------------------------------------------------- scene basics */
var stage = document.getElementById('stage');
var canvas = document.getElementById('gl');
var renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
} catch (e) {
  document.getElementById('nogl').hidden = false;
  return;
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

var scene = new THREE.Scene();
var pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

var key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-8, 14, 10);
scene.add(key);
var fill = new THREE.DirectionalLight(0xbfd0ff, 0.5);
fill.position.set(10, 4, -8);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.35));

var persp = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
var ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
var cam = persp;
var controls = new THREE.OrbitControls(persp, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 2.0, 0);
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 3;
controls.maxDistance = 60;
persp.position.set(-9.5, 4.6, 12.5);
controls.update();

/* --------------------------------------------------------------- ground */
var gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
var grid = new THREE.GridHelper(60, 60, 0x888888, 0x888888);
grid.material = gridMat;
scene.add(grid);

function blobTexture() {
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var g = c.getContext('2d');
  var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.01;
scene.add(shadow);

/* ------------------------------------------------------------- hierarchy */
var center = new THREE.Group();    // puts the aircraft at the origin
center.position.z = NOSE_Z;
scene.add(center);
var pivot = new THREE.Group();     // nose-tip pivot: pitch attitude + height
center.add(pivot);
var air = new THREE.Group();       // airframe (levelled frame, metres)
pivot.add(air);

var skinMeshes = [];
var allMeshes = [];
var matSkin = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.88, roughness: 0.28, side: THREE.DoubleSide });
function addSkin(geo, kind, parent) {
  geo.userData.kind = kind;
  var m = new THREE.Mesh(geo, matSkin);
  m.userData.skin = true;
  (parent || air).add(m); skinMeshes.push(m); allMeshes.push(m);
  return m;
}
function addSkinH(geo, kind, h) {
  geo.translate(-h.userData.p0[0], -h.userData.p0[1], -h.userData.p0[2]);
  return addSkin(geo, kind, h);
}
var ctl = {};
function addMesh(geo, mat, parent) {
  var m = new THREE.Mesh(geo, mat);
  (parent || air).add(m); allMeshes.push(m);
  return m;
}
var matDark = new THREE.MeshStandardMaterial({ color: lin(0x2b3036), metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide });
var matSteel = new THREE.MeshStandardMaterial({ color: lin(0x5a5f66), metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide });
var matRubber = new THREE.MeshStandardMaterial({ color: lin(0x15171a), metalness: 0.0, roughness: 0.9 });
var matAlu = new THREE.MeshStandardMaterial({ color: lin(0xc8ccd0), metalness: 0.9, roughness: 0.3 });
var matZinc = new THREE.MeshStandardMaterial({ color: lin(0x6c7740), metalness: 0.0, roughness: 0.9, side: THREE.DoubleSide });
var matBlack = new THREE.MeshStandardMaterial({ color: lin(0x101214), metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
var matGlass = new THREE.MeshStandardMaterial({ color: lin(0xaed4e6), metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
matGlass.userData.baseOpacity = 0.38;
var matProp = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });

/* ----------------------------------------------------------------- fuselage */
var FN = 56;
var FK = 0.17;                      // narrowing toward the top deck
function fusXY(hw, zt, zb, th, n, k) {
  var c = Math.cos(th), s = Math.sin(th), e = 2 / n;
  var x = hw * sgn(c) * Math.pow(Math.abs(c), e);
  var yc = (zt + zb) / 2, hh = (zt - zb) / 2;
  var y = yc + hh * sgn(s) * Math.pow(Math.abs(s), e);
  if (s > 0) x *= (1 - k * Math.pow(s, 1.5));
  return [x, y];
}
function fusN(a) { return a < 1 ? 2.2 : (a > 7 ? 2.1 : 2.55); }

// belly line: the radiator scoop is modelled separately
var zbF = D.zb.map(function (z, i) {
  var a = D.a[i];
  if (a >= 3.65 && a <= 6.95) return -0.83 + (a - 3.65) / (6.95 - 3.65) * (-0.72 + 0.83);
  return z;
});
function stHW(a) { return interp(D.a, D.hw, a); }
function stZT(a) { return interp(D.a, D.ztb, a); }
function stZB(a) { return interp(D.a, zbF, a); }

// canopy outline
function canopyHW(a) {
  if (a < 3.3) return 0;
  if (a < 3.8) return 0.335 + (a - 3.3) * 0.04;
  var t = (a - 4.3) / 1.5;
  return t < 0 ? 0.355 : 0.355 * Math.pow(Math.max(0, 1 - Math.pow(t, 4)), 0.5);
}
var CK0 = 3.4, CK1 = 5.78;

var fuseStart = 0;
while (D.a[fuseStart] < 0.6) fuseStart++;
var fuseRings = [], fuseIdx = [];
for (var si = fuseStart; si < D.a.length; si++) {
  var a = D.a[si], ring = [];
  for (var j = 0; j < FN; j++) {
    var th = 2 * Math.PI * j / FN;
    var xy = fusXY(D.hw[si], D.ztb[si], zbF[si], th, fusN(a), FK);
    ring.push(P(xy[0], xy[1], a));
  }
  fuseRings.push(ring); fuseIdx.push(si);
}
// cockpit opening
function inOpening(i, j) {
  var a = D.a[fuseIdx[i]];
  if (a < CK0 || a > CK1) return false;
  var th = 2 * Math.PI * j / FN;
  var xy = fusXY(D.hw[fuseIdx[i]], D.ztb[fuseIdx[i]], zbF[fuseIdx[i]], th, fusN(a), FK);
  return xy[1] > 0.2 && Math.abs(xy[0]) < canopyHW(a) * 0.97;
}
var fuseGeo = loft(fuseRings, {
  capStart: true, capEnd: true,
  skip: function (i, j, N) { return inOpening(i, j) && inOpening(i + 1, j) && inOpening(i, (j + 1) % N) && inOpening(i + 1, (j + 1) % N); }
});
addSkin(fuseGeo, 'fuse');

// cockpit liner (zinc chromate)
(function () {
  var rings = [];
  for (var i = 0; i < fuseRings.length; i++) {
    var a = D.a[fuseIdx[i]];
    if (a < CK0 - 0.02 || a > CK1 + 0.02) continue;
    var ring = [], k = fuseIdx[i];
    for (var j = 0; j < FN; j++) {
      var xy = fusXY(D.hw[k] * 0.93, D.ztb[k] - 0.02, zbF[k] + 0.05, 2 * Math.PI * j / FN, fusN(a), FK);
      ring.push(P(xy[0], xy[1], a));
    }
    rings.push(ring);
  }
  var g = loft(rings, { capStart: true, capEnd: true });
  addMesh(g, matZinc);
})();

/* radiator scoop */
(function () {
  var as = [3.92, 3.96, 4.1, 4.3, 4.6, 5.0, 5.4, 5.8, 6.2, 6.6, 6.95];
  var rings = [];
  as.forEach(function (a) {
    var hw = interp([3.92, 5.0, 5.8, 6.4, 6.95], [0.335, 0.335, 0.30, 0.22, 0.06], a);
    var zb = interp(D.a, D.zb, a);
    if (a <= 3.96) zb = -0.94;
    var ring = [];
    for (var j = 0; j < FN; j++) {
      var xy = fusXY(hw, -0.55, zb, 2 * Math.PI * j / FN, 3.2, 0);
      ring.push(P(xy[0], xy[1], a));
    }
    rings.push(ring);
  });
  addSkin(loft(rings, { capStart: true, capEnd: true }), 'scoop');
})();

/* ------------------------------------------------------------- spinner / nose */
var spinnerGeo;
(function () {
  var prof = [[0, 0], [0.015, 0.038], [0.045, 0.113], [0.075, 0.158], [0.105, 0.18], [0.165, 0.225], [0.225, 0.255],
    [0.285, 0.278], [0.33, 0.285], [0.5, 0.30], [0.62, 0.335], [0.645, 0.34], [0.652, 0.12], [0.652, 0]];
  var pts = prof.map(function (p) { return new THREE.Vector2(p[1], -p[0]); });
  spinnerGeo = new THREE.LatheGeometry(pts, 64);
  spinnerGeo.rotateX(Math.PI / 2);
  spinnerGeo.computeVertexNormals();
  spinnerGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(spinnerGeo.attributes.position.count * 3).fill(1), 3));
  addSkin(spinnerGeo, 'spinner');
})();

/* ---------------------------------------------------------------- lifting surfaces */
function airfoilRing(M) {
  var out = [], i, x;
  function yt(x) { return 5 * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x); }
  var xs = [];
  for (i = 0; i <= M; i++) xs.push((1 - Math.cos(Math.PI * i / M)) / 2);
  for (i = M; i >= 0; i--) out.push([xs[i], yt(xs[i])]);
  for (i = 1; i <= M; i++) out.push([xs[i], -yt(xs[i])]);
  return out;
}
var AF = airfoilRing(22);
function afY(x, t) {   // half-thickness in chord units at chord position x
  return t * 5 * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
}

/* wing */
var wrows = D.wing.slice();
var WY = tab(wrows, 0), WLE = tab(wrows, 1), WTE = tab(wrows, 2);
WY.push(5.69); WLE.push(3.54); WTE.push(3.54);
function wLE(y) { return y < 0.4727 ? WLE[0] : interp(WY, WLE, y); }
function wTE(y) { return y < 0.4727 ? WTE[0] : interp(WY, WTE, y); }
function wZ(y) { return -0.368 + 0.083 * (y - 2.14); }
function wTC(y) { return interp([0.25, 2.14, 5.1, 5.7], [0.15, 0.125, 0.11, 0.09], y); }
function wingPoint(y, f, surf, sign, off) {
  var le = wLE(y), te = wTE(y), c = te - le;
  var yv = surf * afY(f, wTC(y)) * c;
  return P(sign * y, wZ(y) + yv + surf * (off || 0), le + f * c);
}
var WYS = [0.25, 0.4];
(function () { var y; for (y = 0.55; y < 5.2; y += 0.15) WYS.push(y); for (y = 5.2; y < 5.66; y += 0.05) WYS.push(y); WYS.push(5.665, 5.68, 5.69); })();
function wFn(sign) { return function (y, f, sd) { var le = wLE(y), te = wTE(y), c = te - le; return P(sign * y, wZ(y) + sd * afY(f, wTC(y)) * c, le + f * c); }; }
function hingeAlong(sign, fn, f, ya, yb) {   // axis always runs toward +x so that a positive angle lifts the trailing edge
  var pa = fn(ya, f, 0), pb = fn(yb, f, 0);
  return sign > 0 ? mkHinge(air, pa, pb) : mkHinge(air, pb, pa);
}
[1, -1].forEach(function (sign) {
  var fn = wFn(sign);
  [[0.25, 0.9, 0, 1], [0.9, 5.35, 0, 0.75], [5.35, 5.69, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(WYS, s[0], s[1]), s[2], s[3], fn, false), 'wing');
  });
  var hf = hingeAlong(sign, fn, 0.75, 0.9, 3.6), ha = hingeAlong(sign, fn, 0.75, 3.6, 5.35);
  addSkinH(surfLoft(stationsIn(WYS, 0.9, 3.6), 0.75, 1, fn, false), 'wing', hf);
  addSkinH(surfLoft(stationsIn(WYS, 3.6, 5.35), 0.75, 1, fn, false), 'wing', ha);
  ctl['flap' + sign] = hf; ctl['ail' + sign] = ha;
});

/* tailplane */
var trows = D.stab.slice();
var TY = tab(trows, 0), TLE = tab(trows, 1), TTE = tab(trows, 2);
TY.unshift(0.1); TLE.unshift(7.82); TTE.unshift(9.13);
TY.push(2.0); TLE.push(8.40); TTE.push(8.40);
function sLE(y) { return interp(TY, TLE, y); }
function sTE(y) { return interp(TY, TTE, y); }
var STZ = 0.06;
function sTC(y) { return interp([0.1, 2.0], [0.10, 0.08], y); }
var TYS = [0.1, 0.25];
(function () { var y; for (y = 0.4; y < 1.9; y += 0.1) TYS.push(y); TYS.push(1.93, 1.96, 1.99, 2.0); })();
function sFn(sign) { return function (y, f, sd) { var le = sLE(y), te = sTE(y), c = te - le; return P(sign * y, STZ + sd * afY(f, sTC(y)) * c, le + f * c); }; }
[1, -1].forEach(function (sign) {
  var fn = sFn(sign);
  [[0.1, 0.3, 0, 1], [0.3, 1.93, 0, 0.6], [1.93, 2.0, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(TYS, s[0], s[1]), s[2], s[3], fn, false), 'stab');
  });
  var h = hingeAlong(sign, fn, 0.6, 0.3, 1.93);
  addSkinH(surfLoft(stationsIn(TYS, 0.3, 1.93), 0.6, 1, fn, false), 'stab', h);
  ctl['ele' + sign] = h;
});

/* fin + rudder */
var frows = D.fin.slice();
var FZ = tab(frows, 0), FLE = tab(frows, 1), FTE = tab(frows, 2);
FZ.unshift(0.12); FLE.unshift(6.9); FTE.unshift(9.80);
FZ.push(1.467, 1.48); FLE.push(9.40, 9.46); FTE.push(9.52, 9.46);
function fLE(z) { return interp(FZ, FLE, z); }
function fTE(z) { return interp(FZ, FTE, z); }
function fTC(z) { return interp([0.12, 1.4], [0.09, 0.07], z); }
var FZS = [0.12, 0.2];
(function () { var z; for (z = 0.3; z < 1.4; z += 0.07) FZS.push(z); FZS.push(1.42, 1.45, 1.467, 1.48); })();
function fFn(z, f, sd) { var le = fLE(z), te = fTE(z), c = te - le; return P(sd * afY(f, fTC(z)) * c, z, le + f * c); }
(function () {
  [[0.12, 0.3, 0, 1], [0.3, 1.42, 0, 0.7], [1.42, 1.48, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(FZS, s[0], s[1]), s[2], s[3], fFn, false), 'fin');
  });
  var rud = mkHinge(air, fFn(0.3, 0.7, 0), fFn(1.42, 0.7, 0));
  addSkinH(surfLoft(stationsIn(FZS, 0.3, 1.42), 0.7, 1, fFn, false), 'fin', rud);
  ctl.rud = rud;
})();

/* ---------------------------------------------------------------- canopy */
var canopyGroup = new THREE.Group();
air.add(canopyGroup);
function deckY(a, x) {   // height of the fuselage skin at lateral offset x
  var k = fuseIdx.length ? 0 : 0;
  var hw = stHW(a), zt = stZT(a), zb = stZB(a), n = fusN(a);
  var lo = 0, hi = Math.PI / 2;
  for (var it = 0; it < 30; it++) {
    var mid = (lo + hi) / 2;
    var xy = fusXY(hw, zt, zb, mid, n, FK);
    if (xy[0] > x) lo = mid; else hi = mid;   // x decreases as theta rises toward the top
  }
  return fusXY(hw, zt, zb, (lo + hi) / 2, n, FK)[1];
}
function canopyZ(a) { return interp(D.can_a, D.can_z, a); }
function canopyRingPts(a, M, grow) {
  var hw = canopyHW(a) * (grow || 1), pts = [];
  var base = deckY(a, hw);
  var top = canopyZ(a);
  if (top < base) top = base;
  for (var i = 0; i <= M; i++) {
    var ph = Math.PI * i / M;           // 0 = +x side, PI = -x side
    var c = Math.cos(ph), s = Math.sin(ph);
    var x = hw * c;
    var y = base + (top - base) * Math.pow(s, 0.9);
    pts.push(P(x, y, a));
  }
  return pts;
}
(function () {
  var rings = [], a;
  for (a = CK0; a <= CK1 + 0.001; a += 0.05) {
    var aa = Math.min(a, CK1 - 0.02);
    var r = canopyRingPts(aa, 28, 1.0);
    rings.push(r);
  }
  var g = new THREE.BufferGeometry();
  var L = loft(rings, {});
  addMesh(L, matGlass, canopyGroup).renderOrder = 3;
  // frames
  [3.42, 3.95, 4.55, 5.2, 5.74].forEach(function (a) {
    var pts = canopyRingPts(a, 28, 1.0).map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    var curve = new THREE.CatmullRomCurve3(pts);
    var tube = new THREE.TubeGeometry(curve, 40, a === 3.95 ? 0.018 : 0.012, 6, false);
    addMesh(tube, matAlu, canopyGroup);
  });
  // sill rails
  [-1, 1].forEach(function (sd) {
    var pts = [];
    for (var a = CK0; a <= CK1 - 0.02; a += 0.1) { var hw = canopyHW(a); pts.push(new THREE.Vector3(sd * hw, deckY(a, hw) + 0.004, -a)); }
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 6, false), matAlu, air);
  });
  // windscreen centre post and top rail
  var rail = [];
  for (var a2 = 3.42; a2 <= 3.96; a2 += 0.06) rail.push(new THREE.Vector3(0, canopyZ(a2) + 0.002, -a2));
  addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 12, 0.014, 6, false), matAlu, canopyGroup);
})();

/* cockpit furniture */
(function () {
  function box(w, h, d, lat, up, aft, rx, mat) {
    var m = addMesh(new THREE.BoxGeometry(w, h, d), mat || matZinc);
    m.position.set(lat, up, -aft); m.rotation.x = rx || 0; return m;
  }
  box(0.46, 0.05, 0.44, 0, -0.22, 4.95, 0, matBlack);                   // seat pan
  box(0.46, 0.62, 0.05, 0, 0.12, 5.2, -0.18, matBlack);                  // seat back
  box(0.52, 0.72, 0.02, 0, 0.12, 5.5, 0, matSteel);                      // armour plate
  box(0.62, 0.26, 0.03, 0, 0.36, 3.52, 0.35, matBlack);                  // instrument panel
  box(0.1, 0.07, 0.14, 0, 0.5, 3.6, 0, matBlack);                        // gun sight body
  var gl = addMesh(new THREE.PlaneGeometry(0.1, 0.1), matGlass); gl.position.set(0, 0.57, -3.68); gl.rotation.x = -0.9;
  box(0.012, 0.4, 0.012, 0, -0.1, 4.45, 0.15, matBlack);                 // stick
  box(0.07, 0.07, 0.5, 0.3, -0.12, 4.7, 0, matZinc);                     // side consoles
  box(0.07, 0.07, 0.5, -0.3, -0.12, 4.7, 0, matZinc);
})();

/* ------------------------------------------------------------- exhaust stacks + mast */
(function () {
  var sph = new THREE.SphereGeometry(1, 14, 10);
  [0.98, 1.30, 1.60, 1.92].forEach(function (a) {
    var up = 0.075 + (a - 1.0) / (1.98 - 1.0) * (-0.155);
    [-1, 1].forEach(function (sd) {
      var hw = stHW(a);
      var m = addMesh(sph, matDark);
      m.scale.set(0.04, 0.04, 0.13);
      m.position.set(sd * (hw + 0.012), up, -a);
      m.rotation.x = 0.0;
    });
  });
  var mast = new THREE.ConeGeometry(0.02, 0.52, 8, 1, true);
  var mm = addMesh(mast, matSteel);
  mm.position.set(0, 0.56, -6.89);
  mm.rotation.x = -0.12;
})();

/* ------------------------------------------------------------------ propeller */
var propGroup = new THREE.Group();
propGroup.position.z = -0.447;
air.add(propGroup);
var bladeGeo;
(function () {
  var RS = [0.25, 0.3, 0.38, 0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.5, 1.56, 1.59, 1.6];
  function chord(r) { return interp([0.25, 0.4, 0.7, 1.0, 1.3, 1.5, 1.57, 1.6], [0.13, 0.17, 0.24, 0.285, 0.26, 0.2, 0.12, 0.03], r); }
  function beta(r) { return (interp([0.25, 0.5, 1.0, 1.6], [62, 48, 32, 22], r)) * Math.PI / 180; }
  function tc(r) { return interp([0.25, 0.5, 1.0, 1.6], [0.2, 0.14, 0.09, 0.06], r); }
  var Y = [0, 1, 0];
  var rings = [], cols = [];
  var yel = linRGB(0xe7b422), blk = linRGB(0x16181b);
  RS.forEach(function (r) {
    var c = chord(r), b = beta(r), t = tc(r);
    var cx = Math.cos(b), cz = -Math.sin(b), nx = Math.sin(b), nz = Math.cos(b);
    var ring = [];
    AF.forEach(function (p) {
      var s = (p[0] - 0.5) * c * 1.0;    // along chord from pitch axis (LE negative)
      var v = (p[1] >= 0 ? 1 : -1) * afY(p[0], t * 1.0) * c;
      // chord vector runs LE -> TE; p[0] is 0 at LE
      ring.push([s * cx + v * nx, r, s * cz + v * nz]);
    });
    rings.push(ring);
  });
  bladeGeo = loft(rings, {});
  var cn = bladeGeo.attributes.position.count, N = AF.length;
  var carr = bladeGeo.attributes.color.array;
  for (var i = 0; i < cn; i++) {
    var ri = Math.floor(i / N);
    var col = RS[Math.min(ri, RS.length - 1)] > 1.42 ? yel : blk;
    carr[i * 3] = col[0]; carr[i * 3 + 1] = col[1]; carr[i * 3 + 2] = col[2];
  }
  for (var k = 0; k < 4; k++) {
    var holder = new THREE.Group();
    holder.rotation.z = k * Math.PI / 2;
    var bm = new THREE.Mesh(bladeGeo, matProp); holder.add(bm); allMeshes.push(bm);
    var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.3, 14), matSteel);
    cuff.position.y = 0.38; holder.add(cuff); allMeshes.push(cuff);
    propGroup.add(holder);
  }
  propGroup.rotation.z = 15.4 * Math.PI / 180;
})();

/* --------------------------------------------------------------------- landing gear */
var gearSides = [];
var gearAnim = { v: 0, target: 0 };      // 0 = down, 1 = up
var tailWheel = new THREE.Group();
(function () {
  var AX = { a: 2.82, z: -1.71, lat: 1.79 };
  var top = { lat: 1.84, z: -0.45, a: 3.70 };
  [-1, 1].forEach(function (sd) {
    var g = new THREE.Group();
    g.position.set(sd * top.lat, top.z, -top.a);
    air.add(g);
    // local coordinates relative to pivot
    var bx = sd * (AX.lat + 0.14) - sd * top.lat, by = AX.z - top.z, bz = -(AX.a) + top.a;
    var len = Math.sqrt(bx * bx + by * by + bz * bz);
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, len, 14), matSteel);
    leg.position.set(bx / 2, by / 2, bz / 2);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bx, by, bz).normalize());
    g.add(leg); allMeshes.push(leg);
    var oleo = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, len * 0.42, 12), matAlu);
    oleo.position.set(bx * 0.79, by * 0.79, bz * 0.79);
    oleo.quaternion.copy(leg.quaternion); g.add(oleo); allMeshes.push(oleo);
    // axle + wheel
    var wx = sd * AX.lat - sd * top.lat;
    var axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), matSteel);
    axle.rotation.z = Math.PI / 2;
    axle.position.set((bx + wx) / 2, by, bz); g.add(axle); allMeshes.push(axle);
    var tire = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.09, 16, 40), matRubber);
    tire.rotation.y = Math.PI / 2; tire.scale.z = 1.0; tire.position.set(wx, by, bz);
    g.add(tire); allMeshes.push(tire);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 24), matAlu);
    hub.rotation.z = Math.PI / 2; hub.position.set(wx, by, bz);
    g.add(hub); allMeshes.push(hub);
    gearSides.push({ g: g, sd: sd });
  });
  // tail wheel
  tailWheel.position.set(0, -0.62, -7.74);
  air.add(tailWheel);
  var strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10), matSteel);
  strut.position.y = -0.1; tailWheel.add(strut); allMeshes.push(strut);
  var tw = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.045, 12, 24), matRubber);
  tw.rotation.y = Math.PI / 2; tw.position.y = -0.255; tailWheel.add(tw); allMeshes.push(tw);
})();
function applyGear(v) {
  gearSides.forEach(function (s) { s.g.rotation.z = -s.sd * v * Math.PI / 2; s.g.position.z = -(3.70 + v * 0.6); });
  tailWheel.position.y = -0.62 + v * 0.34;
}

/* ------------------------------------------------------------------- panel lines */
var lineGroup = new THREE.Group();
air.add(lineGroup);
var lineMat = new THREE.LineBasicMaterial({ color: 0x20252b, transparent: true, opacity: 0.55 });
(function () {
  var seg = [];
  function add(a, b) { seg.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
  function poly(pts) { for (var i = 0; i < pts.length - 1; i++) add(pts[i], pts[i + 1]); }
  function wLine(fn, y0, y1, n, sign, surf) {
    var pts = [];
    for (var i = 0; i <= n; i++) { var y = y0 + (y1 - y0) * i / n; var f = fn(y); if (f === null) continue; pts.push(wingPoint(y, f, surf, sign, 0.003)); }
    poly(pts);
  }
  [-1, 1].forEach(function (sg) {
    [1, -1].forEach(function (sf) {
      wLine(function () { return 0.75; }, 0.9, 5.35, 40, sg, sf);                         // flap / aileron hinge line
      wLine(function (y) { var f = (3.65 - wLE(y)) / (wTE(y) - wLE(y)); return f > 0.02 && f < 0.75 ? f : null; }, 0.6, 4.81, 40, sg, sf);  // spar line
      [4.81, 1.88].forEach(function (yy) {
        var pts = []; for (var i = 0; i <= 10; i++) pts.push(wingPoint(yy, 0.02 + 0.73 * i / 10, sf, sg, 0.003)); poly(pts);
      });
    });
    // gun bay panel (upper surface)
    function ptAt(y, a) { var f = (a - wLE(y)) / (wTE(y) - wLE(y)); return wingPoint(y, f, 1, sg, 0.003); }
    poly([ptAt(1.88, 3.65), ptAt(3.57, 3.65), ptAt(3.57, 4.10), ptAt(1.88, 4.10), ptAt(1.88, 3.65)]);
    // elevator hinge
    [1, -1].forEach(function (sf) {
      var pts = [];
      for (var i = 0; i <= 14; i++) {
        var y = 0.2 + (1.9 - 0.2) * i / 14, le = sLE(y), te = sTE(y), f = 0.60;
        pts.push(P(sg * y, STZ + sf * (afY(f, sTC(y)) * (te - le) + 0.003), le + f * (te - le)));
      }
      poly(pts);
    });
  });
  // rudder hinge
  [-1, 1].forEach(function (sd) {
    var pts = [];
    for (var z = 0.3; z <= 1.42; z += 0.06) {
      var le = fLE(z), te = fTE(z), f = 0.70, c = te - le;
      pts.push(P(sd * (afY(f, fTC(z)) * c + 0.003), z, le + f * c));
    }
    poly(pts);
  });
  // fuselage rings and seams
  function ringAt(a, th0, th1, off) {
    var pts = [], hw = stHW(a), zt = stZT(a), zb = stZB(a);
    for (var i = 0; i <= 40; i++) {
      var th = th0 + (th1 - th0) * i / 40;
      var xy = fusXY(hw + off, zt + off, zb - off, th, fusN(a), FK);
      pts.push(P(xy[0], xy[1], a));
    }
    poly(pts);
  }
  [0.66, 2.05, 3.3, 5.8, 6.95, 7.05].forEach(function (a) {
    if (a === 3.3 || a === 5.8) { ringAt(a, Math.PI * 0.6, Math.PI * 1.4, 0.003); ringAt(a, -Math.PI * 0.4, Math.PI * 0.4, 0.003); ringAt(a, Math.PI * 1.4, Math.PI * 1.6, 0.003); }
    else ringAt(a, 0, 2 * Math.PI, 0.003);
  });
  [0.35, 0.0, -0.3, 2.7, 3.4].forEach(function (th) {
    [-1, 1].forEach(function (sd) {
      var pts = [];
      for (var a = 0.7; a <= 3.3; a += 0.1) {
        var xy = fusXY(stHW(a), stZT(a), stZB(a), sd > 0 ? th : Math.PI - th, fusN(a), FK);
        var o = 0.003; pts.push(P(xy[0] + sd * o, xy[1], a));
      }
      poly(pts);
    });
  });
  [0.1, -0.2].forEach(function (th) {
    [-1, 1].forEach(function (sd) {
      var pts = [];
      for (var a = 5.85; a <= 6.9; a += 0.1) {
        var xy = fusXY(stHW(a), stZT(a), stZB(a), sd > 0 ? th : Math.PI - th, fusN(a), FK);
        pts.push(P(xy[0] + sd * 0.003, xy[1], a));
      }
      poly(pts);
    });
  });
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  lineGroup.add(new THREE.LineSegments(g, lineMat));
})();

/* ------------------------------------------------- livery: natural metal + markings (reference photo) */
var C = { AL: linRGB(0xb3b9bf) };
function paint() {
  skinMeshes.forEach(function (m) {
    var col = m.geometry.attributes.color;
    var c = m.geometry.userData.kind === 'spinner' ? linRGB(0xdfa22e) : C.AL;
    for (var i = 0; i < col.count; i++) col.setXYZ(i, c[0], c[1], c[2]);
    col.needsUpdate = true;
  });
  lineMat.color.set(0x20252b); lineMat.opacity = 0.5;
}
var decals = new THREE.Group();
air.add(decals);
function canvasTex(w, h, draw) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d'); draw(g, w, h);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  return t;
}
function decalMat(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false, side: THREE.DoubleSide });
}
function solidMat(hex, rough, metal) {
  return new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: metal, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
}
function patch(nu, nv, pos, mat, flipU, parent, origin) {
  var p = [], uv = [], ix = [], i, j;
  for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
    var u = i / nu, v = j / nv, q = pos(u, v);
    if (origin) q = [q[0] - origin[0], q[1] - origin[1], q[2] - origin[2]];
    p.push(q[0], q[1], q[2]); uv.push(flipU ? 1 - u : u, 1 - v);
  }
  for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
    var a0 = j * (nu + 1) + i, a1 = a0 + 1, a2 = a0 + nu + 1, a3 = a2 + 1;
    ix.push(a0, a1, a3, a0, a3, a2);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix); g.computeVertexNormals();
  var m = new THREE.Mesh(g, mat); m.renderOrder = 2;
  (parent || decals).add(m); allMeshes.push(m);
  return m;
}
// x (>=0) of the fuselage skin at height z, for the +x side
function fusSideX(a, z) {
  var hw = stHW(a), zt = stZT(a), zb = stZB(a), n = fusN(a);
  z = Math.max(zb + 0.005, Math.min(zt - 0.005, z));
  var lo = -Math.PI / 2, hi = Math.PI / 2;
  for (var it = 0; it < 26; it++) {
    var mid = (lo + hi) / 2;
    if (fusXY(hw, zt, zb, mid, n, FK)[1] < z) lo = mid; else hi = mid;
  }
  return fusXY(hw, zt, zb, (lo + hi) / 2, n, FK)[0];
}
function sidePatch(a0, a1, zTop, zBot, side, mat) {
  return patch(Math.max(8, Math.round((a1 - a0) / 0.03)), 8, function (u, v) {
    var a = a0 + u * (a1 - a0), z = zTop - v * (zTop - zBot);
    return [side * (fusSideX(a, z) + 0.005), z, -a];
  }, mat, side < 0);
}
function ringPatch(a0, a1, th0, th1, off, mat) {
  return patch(Math.max(6, Math.round((a1 - a0) / 0.04)), Math.max(12, Math.round(Math.abs(th1 - th0) / (Math.PI / 40))), function (u, v) {
    var a = a0 + u * (a1 - a0), th = th0 + v * (th1 - th0);
    var xy = fusXY(stHW(a) + off, stZT(a) + off, stZB(a) - off, th, fusN(a), FK);
    return P(xy[0], xy[1], a);
  }, mat, false);
}
function finPatch(f0, f1, z0, z1, side, mat, parent, origin) {
  return patch(12, 10, function (u, v) {
    var f = f0 + u * (f1 - f0), z = z1 - v * (z1 - z0), c = fTE(z) - fLE(z);
    return P(side * (afY(f, fTC(z)) * c + 0.005), z, fLE(z) + f * c);
  }, mat, side < 0, parent, origin);
}
function wingPatchA(y0, y1, a0, a1, surf, sign, mat) {
  return patch(12, 12, function (u, v) {
    var y = y0 + u * (y1 - y0), a = a0 + v * (a1 - a0);
    var f = (a - wLE(y)) / (wTE(y) - wLE(y));
    return wingPoint(y, f, surf, sign, 0.005);
  }, mat, false);
}
var FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
function drawText(g, w, h, text, fill) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = fill; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold ' + Math.round(h * 0.92) + 'px ' + FONT;
  var mw = g.measureText(text).width;
  g.save(); g.translate(w / 2, h * 0.54); g.scale(Math.min(1.25, (w * 0.98) / mw), 1); g.fillText(text, 0, 0); g.restore();
}
function drawInsignia(g, w, h) {
  var D = h, cx = w / 2, cy = h / 2, blue = '#14224f', white = '#f1f1ec';
  var bh = D / 4, bd = D / 14;
  g.clearRect(0, 0, w, h);
  g.fillStyle = blue; g.fillRect(0, cy - bh / 2 - bd, w, bh + 2 * bd);
  g.fillStyle = white; g.fillRect(bd, cy - bh / 2, w - 2 * bd, bh);
  g.fillStyle = blue; g.beginPath(); g.arc(cx, cy, D / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = white; g.beginPath();
  var R = D * 0.40, r = R * 0.382;
  for (var i = 0; i < 10; i++) {
    var ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
function drawName(g, w, h, tipAtLeft) {
  g.clearRect(0, 0, w, h);
  var tip = h * 0.9, x0 = tipAtLeft ? 0 : w, x1 = tipAtLeft ? w : 0, sg = tipAtLeft ? 1 : -1;
  g.fillStyle = '#0c0d0f'; g.beginPath();
  g.moveTo(x0, h / 2); g.lineTo(x0 + sg * tip, 0); g.lineTo(x1 - sg * tip * 0.35, 0);
  g.lineTo(x1, h / 2); g.lineTo(x1 - sg * tip * 0.35, h); g.lineTo(x0 + sg * tip, h); g.closePath(); g.fill();
  g.strokeStyle = '#e9e9e4'; g.lineWidth = h * 0.05; g.stroke();
  g.fillStyle = '#f4f4ef'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold ' + Math.round(h * 0.52) + 'px ' + FONT;
  var txt = 'TIKA·IV', mw = g.measureText(txt).width, avail = w - tip * 1.4;
  g.save(); g.translate(w / 2 + sg * tip * 0.15, h * 0.54); g.scale(Math.min(1.2, avail / mw), 1); g.fillText(txt, 0, 0); g.restore();
}
var rudderDecals = new THREE.Group(); ctl.rud.add(rudderDecals);
(function () {
  var black = solidMat(0x0f1114, 0.8, 0.05);
  var yellow = solidMat(0xdfa22e, 0.4, 0.12);
  var insMat = decalMat(canvasTex(512, 256, drawInsignia));
  // yellow nose ring and the black anti-glare panel
  ringPatch(0.64, 0.98, 0, Math.PI * 2, 0.004, yellow);
  ringPatch(0.98, 3.3, Math.PI * 0.13, Math.PI * 0.87, 0.004, black);
  // fuselage side markings
  [1, -1].forEach(function (sd) {
    sidePatch(5.98, 7.06, 0.04, -0.50, sd, insMat);
    sidePatch(5.12, 5.90, 0.12, -0.32, sd, decalMat(canvasTex(512, 290, function (g, w, h) { drawText(g, w, h, 'B7', '#0d0e10'); })));
    sidePatch(7.16, 7.52, 0.18, -0.20, sd, decalMat(canvasTex(256, 256, function (g, w, h) { drawText(g, w, h, 'R', '#0d0e10'); })));
    sidePatch(1.05, 2.15, -0.16, -0.42, sd, decalMat(canvasTex(1024, 240, function (g, w, h) { drawName(g, w, h, sd > 0); })));
    // tail serial and rudder band
    finPatch(0.10, 0.68, 0.72, 0.92, sd, decalMat(canvasTex(1024, 280, function (g, w, h) { drawText(g, w, h, '413357', '#0d0e10'); })));
    finPatch(0.86, 0.97, 0.40, 1.40, sd, black, rudderDecals, ctl.rud.userData.p0);
  });
  // wing insignia: upper left (+x), lower right (-x)
  wingPatchA(2.55, 4.35, 3.25, 4.15, 1, 1, insMat);
  wingPatchA(2.55, 4.35, 3.25, 4.15, -1, -1, insMat);
  // black band wrapped under the rear fuselage, below the insignia
  ringPatch(6.30, 6.62, Math.PI * 1.18, Math.PI * 1.82, 0.004, black);
})();

/* ------------------------------------------------------------------ blueprint overlay */
var overlay = new THREE.Group();
overlay.visible = false;
air.add(overlay);
var bpImg = new Image();
var bpReady = false;
function strip(x0, y0, x1, y1, w2) {
  var c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
  var g = c.getContext('2d'); g.drawImage(bpImg, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  var d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  for (var i = 0; i < px.length; i += 4) {
    var a = 255 - px[i];
    px[i] = 0xff; px[i + 1] = 0x7a; px[i + 2] = 0x1a; px[i + 3] = Math.min(255, a * 1.4);
  }
  g.putImageData(d, 0, 0);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
function plane(tex, cornerFn, x0, y0, x1, y1) {
  var cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(function (p) { return cornerFn(p[0], p[1]); });
  var g = new THREE.BufferGeometry();
  var pos = []; cs.forEach(function (c) { pos.push(c[0], c[1], c[2]); });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.renderOrder = 20;
  overlay.add(m);
}
function buildOverlay() {
  var cy = 445.5, hx = 902.5, hy = 112.5, px0 = 554.5, py0 = 771;
  var cp = Math.cos(PHI), sp = Math.sin(PHI);
  // top view: pixel -> (lat, 0, -aft)
  plane(strip(0, 60, 660, 832), function (px, py) { return [(cy - py) / S, 0, -(655 - px) / S]; }, 0, 60, 660, 832);
  // front view: pixel -> (lat, up, +1 m in front of the nose)
  plane(strip(520, 0, 1284, 256), function (px, py) { return [(hx - px) / S, (hy - py) / S, 1.2]; }, 520, 0, 1284, 256);
  // side view (ground attitude): pixel -> (0, up, -aft) in the levelled frame
  plane(strip(548, 664, 1210, 948), function (px, py) {
    var du = px - px0, dv = py - py0;
    var A = (du * cp + dv * sp) / S, Z = (du * sp - dv * cp) / S;
    return [0, Z, -A];
  }, 548, 664, 1210, 948);
}
bpImg.onload = function () { bpReady = true; buildOverlay(); };
bpImg.src = window.P51_BP;

/* ------------------------------------------------------------------- state + UI */
var state = { view: 'free', pose: 'ground', poseT: 0, op: 1, spin: false, wire: false, lines: true, bp: false, auto: false };
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var spinSpeed = 0;
var VIEWS = {
  free: null,
  top: { dir: [0, 1, 0], up: [1, 0, 0] },
  side: { dir: [1, 0, 0], up: [0, 1, 0] },
  front: { dir: [0, 0, 1], up: [0, 1, 0] }
};
var ppm = 36, fixedPpm = false;
function fitOrtho() {
  var w = stage.clientWidth, h = stage.clientHeight;
  ortho.left = -w / 2 / ppm; ortho.right = w / 2 / ppm; ortho.top = h / 2 / ppm; ortho.bottom = -h / 2 / ppm;
  ortho.updateProjectionMatrix();
}
function setView(v) {
  state.view = v;
  var spec = VIEWS[v];
  if (!spec) {
    cam = persp; controls.object = persp; controls.enableRotate = true; controls.maxPolarAngle = Math.PI * 0.495;
  } else {
    cam = ortho; controls.object = ortho; controls.enableRotate = false; controls.maxPolarAngle = Math.PI;
    if (!fixedPpm) ppm = Math.max(12, Math.min(stage.clientWidth / (v === 'front' ? 13 : 12.2), stage.clientHeight / (v === 'top' ? 11 : 6.5)));
    var tgt = new THREE.Vector3(0, state.poseT > 0.5 ? 4.0 : 2.0, 0);
    controls.target.copy(tgt);
    ortho.up.set(spec.up[0], spec.up[1], spec.up[2]);
    ortho.position.set(tgt.x + spec.dir[0] * 40, tgt.y + spec.dir[1] * 40, tgt.z + spec.dir[2] * 40);
    ortho.zoom = 1;
    fitOrtho();
    ortho.lookAt(tgt);
  }
  controls.update();
  syncUI();
}
function applyPose(t) {
  pivot.rotation.x = -PHI * (1 - t);
  pivot.position.y = HUB_H + (4.4 - HUB_H) * t;
  var sc = 1 - 0.55 * t;
  shadow.scale.set(11 * sc, 12 * sc, 1);
  shadow.material.opacity = 0.7 * (1 - 0.5 * t);
  shadow.position.z = 0;
}
function setPose(p, withGear) {
  state.pose = p;
  if (withGear) { gearAnim.target = p === 'flight' ? 1 : 0; }
  syncUI();
}
function setOpacity(v) {
  state.op = v;
  allMeshes.forEach(function (m) {
    var mat = m.material;
    var base = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity : 1;
    mat.transparent = base < 1 || v < 1;
    mat.opacity = base * v;
    mat.depthWrite = v >= 1 && base >= 1;
  });
}
function setWire(f) {
  state.wire = f;
  var seen = [];
  allMeshes.forEach(function (m) { var mat = m.material; if (seen.indexOf(mat) < 0) { seen.push(mat); mat.wireframe = f && mat !== matGlass; } });
}

function $(id) { return document.getElementById(id); }
function syncUI() {
  document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
  document.querySelectorAll('[data-pose]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pose') === state.pose)); });
  [['t-bp', state.bp], ['t-wire', state.wire], ['t-lines', state.lines], ['t-marks', decals.visible], ['t-gear', gearAnim.target === 0], ['t-spin', state.spin], ['t-auto', state.auto]].forEach(function (p) {
    var el = $(p[0]); if (el) el.setAttribute('aria-checked', String(!!p[1]));
  });
  var names = { free: '自由視点', top: '上面', side: '側面', front: '正面' };
  $('hud-view').textContent = names[state.view];
  $('op-val').textContent = Math.round(state.op * 100) + '%';
}
document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
document.querySelectorAll('[data-pose]').forEach(function (b) { b.addEventListener('click', function () { setPose(b.getAttribute('data-pose'), true); if (state.view !== 'free') setView(state.view); }); });
function bindSwitch(id, fn) { $(id).addEventListener('click', function () { fn($(id).getAttribute('aria-checked') !== 'true'); syncUI(); }); }
bindSwitch('t-bp', function (v) { state.bp = v; overlay.visible = v; if (v && state.op > 0.6) { $('op').value = 45; setOpacity(0.45); } if (!v) { $('op').value = 100; setOpacity(1); } });
bindSwitch('t-wire', setWire);
bindSwitch('t-marks', function (v) { decals.visible = v; });
bindSwitch('t-lines', function (v) { state.lines = v; lineGroup.visible = v; });
bindSwitch('t-gear', function (v) { gearAnim.target = v ? 0 : 1; });
bindSwitch('t-spin', function (v) { state.spin = v; });
bindSwitch('t-auto', function (v) { state.auto = v; controls.autoRotate = v && state.view === 'free'; controls.autoRotateSpeed = 1.2; });
$('op').addEventListener('input', function () { setOpacity(parseInt($('op').value, 10) / 100); syncUI(); });

/* measured dimensions */
(function () {
  air.updateMatrixWorld(true);
  var savedRot = pivot.rotation.x; pivot.rotation.x = 0; pivot.updateMatrixWorld(true);
  var b = new THREE.Box3();
  skinMeshes.forEach(function (m) { b.expandByObject(m); });
  var len = b.max.z - b.min.z, span = b.max.x - b.min.x;
  var pb = new THREE.Box3().setFromObject(propGroup), dia = pb.max.y - pb.min.y;
  pivot.rotation.x = savedRot;
  $('d-len').textContent = len.toFixed(2);
  $('hud-len').textContent = 'L ' + len.toFixed(2) + ' m';
  $('d-span').textContent = span.toFixed(2);
  $('d-prop').textContent = dia.toFixed(2);
  $('d-track').textContent = (2 * 1.79).toFixed(2);
  $('d-height').textContent = (HUB_H + dia / 2).toFixed(2);
})();

/* theme-driven ground colours */
function readTheme() {
  var cs = getComputedStyle(document.documentElement);
  var gc = (cs.getPropertyValue('--grid') || '#9aa4ad').trim();
  gridMat.color.set(gc).convertSRGBToLinear();
}
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (window.matchMedia) { var mq = window.matchMedia('(prefers-color-scheme: dark)'); (mq.addEventListener ? mq.addEventListener('change', readTheme) : mq.addListener(readTheme)); }

/* resize + loop */
function resize() {
  var w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  persp.aspect = w / h;
  var hf = 2 * Math.atan(Math.tan(16 * Math.PI / 180) * 1.45), asp = w / h;
  persp.fov = Math.min(80, 2 * Math.atan(Math.tan(hf / 2) / Math.max(asp, 0.2)) * 180 / Math.PI * (asp < 1.45 ? 1 : 1));
  if (asp >= 1.45) persp.fov = 32;
  persp.updateProjectionMatrix();
  fitOrtho();
}
new ResizeObserver(resize).observe(stage);
resize(); readTheme();
paint(); applyPose(0); applyGear(0); syncUI();
if (reduce) { state.auto = false; }

var last = performance.now();
function frame(now) {
  var dt = Math.min(0.05, (now - last) / 1000); last = now;
  var tgt = state.pose === 'flight' ? 1 : 0;
  state.poseT += (tgt - state.poseT) * Math.min(1, dt * 4);
  if (Math.abs(tgt - state.poseT) < 0.002) state.poseT = tgt;
  applyPose(state.poseT);
  gearAnim.v += (gearAnim.target - gearAnim.v) * Math.min(1, dt * 5);
  if (Math.abs(gearAnim.target - gearAnim.v) < 0.003) gearAnim.v = gearAnim.target;
  applyGear(gearAnim.v);
  var ts = state.spin ? 22 : 0;
  spinSpeed += (ts - spinSpeed) * Math.min(1, dt * 3);
  propGroup.rotation.z += spinSpeed * dt;
  shadow.position.x = 0;
  controls.autoRotate = state.auto && state.view === 'free' && !reduce;
  controls.update();
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* test hook */
window.__p51 = {
  setView: setView, setPose: function (p) { state.pose = p; state.poseT = p === 'flight' ? 1 : 0; applyPose(state.poseT); gearAnim.target = gearAnim.v = (p === 'flight' ? 1 : 0); applyGear(gearAnim.v); },
  setPpm: function (v) { ppm = v; fixedPpm = true; fitOrtho(); }, state: state, scene: scene, renderer: renderer, ortho: ortho, controls: controls,
  flat: function (on) {
    allMeshes.forEach(function (m) { if (on) { m.userData.mat0 = m.material; m.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }); } else if (m.userData.mat0) m.material = m.userData.mat0; });
    scene.background = on ? new THREE.Color(0xffffff) : null; grid.visible = !on; shadow.visible = !on; lineGroup.visible = !on && state.lines; canopyGroup.visible = true;
  },
  overlay: overlay, paint: paint, pivot: pivot, air: air, setGear: function (v) { gearAnim.target = gearAnim.v = v; applyGear(v); }
};
})();
