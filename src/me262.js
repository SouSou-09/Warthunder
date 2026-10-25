function buildMe262() {
var E = window.ME_DATA, SE = E.S;
E.zb = E.zb.map(function (v, i) { var a = E.a[i]; return (a > 0.55 && a < 0.95) ? interp([0.5, 1.0], [-0.3421, -0.5028], a) : v; });
var GROUND_Y = 1.82;                     // nose-tip height above the ground on the wheels (m)
var NOSE = 5.3;                          // world z of the nose tip

var center = new THREE.Group(); center.position.z = NOSE; scene.add(center);
var pivot = new THREE.Group(); center.add(pivot);
var air = new THREE.Group(); pivot.add(air);
var skinMeshes = [], allMeshes = [];
var matSkin = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.04, roughness: 0.66, side: THREE.DoubleSide });
var KIND = { fuse: 0, wing: 1, stab: 2, fin: 3, nacelle: 4, fuseR: 5 };
var camoU = {
  cL76: { value: new THREE.Vector3().fromArray(linRGB(0x9eadb5)) },
  cG82: { value: new THREE.Vector3().fromArray(linRGB(0x56693a)) },
  cG83: { value: new THREE.Vector3().fromArray(linRGB(0x27301e)) },
  cRed: { value: new THREE.Vector3().fromArray(linRGB(0x851510)) }
};
matSkin.onBeforeCompile = function (sh) {
  Object.keys(camoU).forEach(function (k) { sh.uniforms[k] = camoU[k]; });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aAP;\nattribute float aKind;\nvarying vec3 vAP;\nvarying vec3 vAN;\nvarying float vKind;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAP = aAP; vAN = -normal; vKind = aKind;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAP;\nvarying vec3 vAN;\nvarying float vKind;\nuniform vec3 cL76;\nuniform vec3 cG82;\nuniform vec3 cG83;\nuniform vec3 cRed;\n' + [
      'float h31(vec3 p){ p = fract(p * 0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
      'float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),',
      '             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }',
      'float fbm(vec3 p){ return 0.55 * vn(p) + 0.3 * vn(p * 2.07 + 3.1) + 0.15 * vn(p * 4.3 + 7.7); }',
      'vec3 camo(){',
      '  vec3 p = vAP; vec3 n = normalize(vAN); float up = n.y;',
      '  vec3 base = cL76 * (0.93 + 0.12 * fbm(p * 2.5 + 11.0));',
      '  float kind = vKind; if (kind > 4.5) { kind -= 5.0; up = -up; }',
      '  float w = fbm(p * vec3(1.3, 2.4, 1.3) + 1.7) - 0.5;',
      '  float cover;',
      '  if (kind < 0.5) cover = smoothstep(0.36, 0.42, up + w * 0.75);',
      '  else if (kind < 1.5 || kind < 2.5) cover = smoothstep(0.02, 0.10, up + w * 0.25);',
      '  else if (kind < 3.5) cover = smoothstep(0.0, 0.05, up + w * 0.5 + (p.y - 1.0) * 0.55 - 0.45);',
      '  else cover = smoothstep(0.34, 0.40, up + w * 0.7);',
      '  float shade = smoothstep(0.47, 0.53, fbm(p * vec3(0.9, 1.1, 0.9) + 9.0));',
      '  vec3 dark = mix(cG82, cG83, shade);',
      '  dark *= 0.92 + 0.16 * vn(p * 14.0);',
      '  float spots = smoothstep(0.66, 0.70, vn(p * vec3(7.0, 8.5, 7.0) + 2.0)) * smoothstep(-0.05, 0.35, up);',
      '  float spots2 = smoothstep(0.70, 0.74, vn(p * vec3(11.0, 13.0, 11.0) + 5.0)) * smoothstep(-0.2, 0.2, up);',
      '  vec3 sp = mix(cG82, cG83, step(0.5, vn(p * 5.0 + 4.0)));',
      '  vec3 col = mix(base, sp, max(spots, spots2 * 0.8));',
      '  col = mix(col, dark, cover);',
      '  // red nose cap and fin tip (Reichsverteidigung bands)',
      '  float aft = -p.z;',
      '  if (kind < 0.5) col = mix(col, cRed, 1.0 - smoothstep(0.0, 0.015, aft - (0.50 + 0.10 * up)));',
      '  if (kind > 2.5 && kind < 3.5) col = mix(col, cRed, smoothstep(0.0, 0.012, p.y - 1.72));',
      '  return col;',
      '}'
    ].join('\n'))
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = camo();');
};
function tag(geo, kind, off) {
  var p = geo.attributes.position, n = p.count, a = new Float32Array(n * 3), i;
  off = off || [0, 0, 0];
  for (i = 0; i < n; i++) { a[i * 3] = p.getX(i) + off[0]; a[i * 3 + 1] = p.getY(i) + off[1]; a[i * 3 + 2] = p.getZ(i) + off[2]; }
  geo.setAttribute('aAP', new THREE.BufferAttribute(a, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).fill(KIND[kind]), 1));
}
function addSkin(geo, kind) { geo.userData.kind = kind; tag(geo, kind); var m = new THREE.Mesh(geo, matSkin); air.add(m); skinMeshes.push(m); allMeshes.push(m); return m; }
function addSkinH(geo, kind, h) {
  geo.userData.kind = kind; tag(geo, kind);
  geo.translate(-h.userData.p0[0], -h.userData.p0[1], -h.userData.p0[2]);
  var m = new THREE.Mesh(geo, matSkin); h.add(m); skinMeshes.push(m); allMeshes.push(m); return m;
}
var ctl = { fl: [], ail: [], ele: [], slat: [], rud: null };
function hingeAlong(sign, fn, f, ya, yb) {   // axis always runs toward +x so that a positive angle lifts the trailing edge
  var pa = fn(ya, f, 0), pb = fn(yb, f, 0);
  return sign > 0 ? mkHinge(air, pa, pb) : mkHinge(air, pb, pa);
}
function addMesh(geo, mat, parent) { var m = new THREE.Mesh(geo, mat); (parent || air).add(m); allMeshes.push(m); return m; }
var matDark = new THREE.MeshStandardMaterial({ color: lin(0x23272c), metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide });
var matSteel = new THREE.MeshStandardMaterial({ color: lin(0x6b7078), metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide });
var matBurn = new THREE.MeshStandardMaterial({ color: lin(0x4a4640), metalness: 0.8, roughness: 0.45, side: THREE.DoubleSide });
var matRubber = new THREE.MeshStandardMaterial({ color: lin(0x15171a), metalness: 0, roughness: 0.9 });
var matAlu = new THREE.MeshStandardMaterial({ color: lin(0xb8bdc2), metalness: 0.85, roughness: 0.35 });
var matFrame = new THREE.MeshStandardMaterial({ color: lin(0x4b5a3f), metalness: 0.2, roughness: 0.6 });
var matGlass = new THREE.MeshStandardMaterial({ color: lin(0xaed4e6), metalness: 0, roughness: 0.04, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
matGlass.userData.baseOpacity = 0.38;
var matHub = new THREE.MeshStandardMaterial({ color: lin(0xb0a578), metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
var matDoor = new THREE.MeshStandardMaterial({ color: lin(0xa9b6bc), metalness: 0.04, roughness: 0.66, side: THREE.DoubleSide });
var matInt = new THREE.MeshStandardMaterial({ color: lin(0x3b4046), metalness: 0.15, roughness: 0.7, side: THREE.DoubleSide });
var matBlack = new THREE.MeshStandardMaterial({ color: lin(0x0d0e10), metalness: 0.1, roughness: 0.6, side: THREE.DoubleSide });

/* ---- fuselage: rounded triangle, flat base, apex up */
var WT = [[0, 0.52], [0.04, 0.74], [0.12, 0.92], [0.26, 1.0], [0.34, 0.97], [0.46, 0.91], [0.61, 0.765], [0.76, 0.59], [0.915, 0.40], [0.97, 0.35], [1.0, 0.30]];
var WU = WT.map(function (p) { return p[0]; }), WV = WT.map(function (p) { return p[1]; });
var NU = 15;
function fusRing(a, hw, zt, zb) {
  var s = Math.max(0, Math.min(1, (a - 0.1) / 1.4));
  var right = [], u, i;
  for (i = 0; i <= NU; i++) {
    u = i / NU;
    var wt = interp(WU, WV, u);
    var we = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2)));
    right.push([hw * (we + (wt - we) * s), zb + (zt - zb) * u]);
  }
  var ring = [];
  for (i = 0; i <= NU; i++) ring.push(P(right[i][0], right[i][1], a));
  for (i = NU; i >= 0; i--) ring.push(P(-right[i][0], right[i][1], a));
  return ring;
}
function eHW(a) { return interp(E.a, E.hw, a); }
function eZT(a) { return interp(E.a, E.zt, a); }
function eZB(a) { return interp(E.a, E.zb, a); }
var rings = [];
E.a.forEach(function (a, i) { rings.push(fusRing(a, Math.max(E.hw[i], 0.004), E.zt[i], E.zb[i])); });
addSkin(loft(rings, { capStart: true, capEnd: true }), 'fuse');

/* ---- airfoil helpers */
function afY(x, t) { return t * 5 * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x); }
var AFX = [], k;
(function () { var M = 22; for (k = 0; k <= M; k++) AFX.push((1 - Math.cos(Math.PI * k / M)) / 2); })();
function airfoilRing() {
  var o = [], i, M = AFX.length - 1;
  for (i = M; i >= 0; i--) o.push([AFX[i], 1]);
  for (i = 1; i <= M; i++) o.push([AFX[i], -1]);
  return o;
}
var AF = airfoilRing();

/* ---- wing */
var wrows = E.wing.filter(function (r) { return Math.abs(r[0] - 2.7084) > 0.01; });
var WY = wrows.map(function (r) { return r[0]; }), WLE = wrows.map(function (r) { return r[1]; }), WTE = wrows.map(function (r) { return r[2]; });
WY.push(6.19); WLE.push(5.08); WTE.push(5.08);
function wLE(y) { return y < 0.85 ? 2.92 - (0.85 - y) * 0.34 : interp(WY, WLE, y); }
function wTE(y) { return y < 0.85 ? 5.60 + (0.85 - y) * 0.02 : interp(WY, WTE, y); }
function wTC(y) { return interp([0.3, 2.7, 6.0], [0.13, 0.126, 0.108], y); }
function wZ(y) {
  var c = wTE(y) - wLE(y);
  return (-0.22 + (y - 1.0) * 0.0667) - 0.5 * wTC(y) * c;
}
function wingPoint(y, f, surf, sign, off) {
  var le = wLE(y), te = wTE(y), c = te - le;
  return P(sign * y, wZ(y) + surf * (afY(f, wTC(y)) * c + (off || 0)), le + f * c);
}
var WYS = [0.3, 0.6, 0.85];
(function () { for (var y = 1.1; y < 5.9; y += 0.25) WYS.push(y); WYS.push(5.95, 6.05, 6.12, 6.15, 6.175, 6.19); })();
function wFn(sign) { return function (y, f, sd) { var le = wLE(y), te = wTE(y), c = te - le; return P(sign * y, wZ(y) + sd * afY(f, wTC(y)) * c, le + f * c); }; }
[1, -1].forEach(function (sign) {
  var fn = wFn(sign), flip = sign > 0;
  // fixed wing: flap / aileron / slat areas are cut out of the full-chord skin
  [[0.3, 0.95, 0, 1], [0.95, 1.74, 0, 0.74], [1.74, 2.78, 0, 1], [2.78, 5.95, 0.085, 0.74], [5.95, 6.19, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(WYS, s[0], s[1]), s[2], s[3], fn, flip), 'wing');
  });
  [[0.95, 1.74], [2.78, 3.65]].forEach(function (r) {
    var h = hingeAlong(sign, fn, 0.74, r[0], r[1]);
    addSkinH(surfLoft(stationsIn(WYS, r[0], r[1]), 0.74, 1, fn, flip), 'wing', h); ctl.fl.push(h);
  });
  var ha = hingeAlong(sign, fn, 0.74, 3.7, 5.95);
  addSkinH(surfLoft(stationsIn(WYS, 3.7, 5.95), 0.74, 1, fn, flip), 'wing', ha); ctl.ail.push({ h: ha, sg: sign });
  var ps = fn(2.78, 0.04, 0), hs = mkHinge(air, ps, [ps[0] + 1, ps[1], ps[2]]);
  addSkinH(surfLoft(stationsIn(WYS, 2.78, 5.95), 0, 0.085, fn, flip), 'wing', hs); ctl.slat.push(hs);
});

/* ---- tailplane (mounted on the fin) */
var srows = E.stab.slice();
var TY = srows.map(function (r) { return r[0]; }), TLE = srows.map(function (r) { return r[1]; }), TTE = srows.map(function (r) { return r[2]; });
TY.unshift(0.1); TLE.unshift(8.82); TTE.unshift(10.23);
TY.push(1.87); TLE.push(9.66); TTE.push(9.66);
var STZ = 0.78;
function sLE(y) { return interp(TY, TLE, y); }
function sTE(y) { return interp(TY, TTE, y); }
var TYS = [0.1, 0.3];
(function () { for (var y = 0.5; y < 1.75; y += 0.12) TYS.push(y); TYS.push(1.78, 1.82, 1.85, 1.87); })();
function sFn(sign) { return function (y, f, sd) { var le = sLE(y), te = sTE(y), c = te - le; return P(sign * y, STZ + sd * afY(f, 0.09) * c, le + f * c); }; }
[1, -1].forEach(function (sign) {
  var fn = sFn(sign), flip = sign > 0;
  [[0.1, 0.3, 0, 1], [0.3, 1.8, 0, 0.62], [1.8, 1.87, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(TYS, s[0], s[1]), s[2], s[3], fn, flip), 'stab');
  });
  var h = hingeAlong(sign, fn, 0.62, 0.3, 1.8);
  addSkinH(surfLoft(stationsIn(TYS, 0.3, 1.8), 0.62, 1, fn, flip), 'stab', h); ctl.ele.push(h);
});

/* ---- fin */
var frows = E.fin.filter(function (r) { return r[0] >= 0.47; });
var FZ = frows.map(function (r) { return r[0]; }), FLE = frows.map(function (r) { return r[1]; }), FTE = frows.map(function (r) { return r[2]; });
FZ.unshift(0.2); FLE.unshift(8.01); FTE.unshift(10.55);
FZ.push(1.95, 1.98); FLE.push(9.86, 10.0); FTE.push(10.13, 10.0);
function fLE(z) { return interp(FZ, FLE, z); }
function fTE(z) { return interp(FZ, FTE, z); }
function fTC(z) { return interp([0.2, 1.9], [0.105, 0.08], z); }
var FZS = [0.2, 0.32];
(function () { for (var z = 0.48; z < 1.9; z += 0.1) FZS.push(z); FZS.push(1.93, 1.95, 1.97, 1.98); })();
function fFn(z, f, sd) { var le = fLE(z), te = fTE(z), c = te - le; return P(sd * afY(f, fTC(z)) * c, z, le + f * c); }
(function () {
  [[0.2, 0.4, 0, 1], [0.4, 1.9, 0, 0.74], [1.9, 1.98, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(FZS, s[0], s[1]), s[2], s[3], fFn, false), 'fin');
  });
  var rud = mkHinge(air, fFn(0.4, 0.74, 0), fFn(1.9, 0.74, 0));
  addSkinH(surfLoft(stationsIn(FZS, 0.4, 1.9), 0.74, 1, fFn, false), 'fin', rud); ctl.rud = rud;
})();

/* ---- engine nacelles (Jumo 004) */
var NAC_LAT = 2.245, NAC_Z = -0.76;
var nacProf = [[2.155, 0.27], [2.2, 0.295], [2.34, 0.33], [2.43, 0.36], [2.52, 0.39], [2.61, 0.41], [2.70, 0.43], [2.79, 0.44], [2.89, 0.456], [2.98, 0.462], [3.07, 0.468], [3.16, 0.473], [3.25, 0.473], [3.34, 0.49], [3.45, 0.49], [4.4, 0.49], [5.37, 0.433], [5.44, 0.428], [5.51, 0.422], [5.58, 0.41], [5.65, 0.40], [5.71, 0.376], [5.78, 0.36], [5.85, 0.336], [5.92, 0.302], [5.99, 0.279]];
function lathe(points, segs) {
  var g = new THREE.LatheGeometry(points.map(function (p) { return new THREE.Vector2(p[1], -p[0]); }), segs || 48);
  g.rotateX(Math.PI / 2); g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}
[-1, 1].forEach(function (sd) {
  var holder = new THREE.Group(); holder.position.set(sd * NAC_LAT, NAC_Z, 0); air.add(holder);
  var og = lathe(nacProf.concat([[5.99, 0.279], [6.0, 0.19]]), 56); og.userData.kind = 'nacelle'; tag(og, 'nacelle', [sd * NAC_LAT, NAC_Z, 0]);
  var om = new THREE.Mesh(og, matSkin); holder.add(om); skinMeshes.push(om); allMeshes.push(om);
  // inlet duct + centre body + exhaust cone
  addMesh(lathe([[2.155, 0.27], [2.28, 0.235], [2.9, 0.215], [3.0, 0.0]], 40), matDark, holder);
  addMesh(lathe([[2.42, 0.0], [2.47, 0.05], [2.7, 0.12], [3.05, 0.16], [3.1, 0.0]], 32), matAlu, holder);
  addMesh(lathe([[6.0, 0.19], [6.1, 0.07], [6.15, 0.0]], 24), matBurn, holder);
  var lip = addMesh(new THREE.TorusGeometry(0.272, 0.013, 8, 48), matAlu, holder); lip.position.z = -2.16;
  var nz = addMesh(new THREE.TorusGeometry(0.283, 0.012, 8, 48), matBurn, holder); nz.position.z = -5.99;
});

/* ---- canopy */
var CAN_HY = eZT(4.7);
var canopyHinge = new THREE.Group(); canopyHinge.position.set(-0.28, CAN_HY, 0); air.add(canopyHinge);   // hinged along the starboard sill
var canopyGroup = new THREE.Group(); canopyGroup.position.set(0.28, -CAN_HY, 0); canopyHinge.add(canopyGroup);
var CA = E.can.map(function (p) { return p[0]; }), CZ = E.can.map(function (p) { return p[1]; });
var CK0 = CA[0], CK1 = CA[CA.length - 1];
function deckHW(a) { return eHW(a) * 0.30; }
function canHW(a) { return Math.min(interp([3.45, 3.7, 4.0, 4.5, 5.2, 5.7, 6.0], [0.2, 0.26, 0.29, 0.29, 0.28, 0.22, 0.12], a), deckHW(a) + 0.03); }
function canRing(a, M) {
  var hw = canHW(a), base = eZT(a) - 0.01, top = Math.max(base, interp(CA, CZ, a)), pts = [];
  for (var i = 0; i <= M; i++) {
    var ph = Math.PI * i / M; pts.push(P(hw * Math.cos(ph), base + (top - base) * Math.pow(Math.sin(ph), 0.85), a));
  }
  return pts;
}
(function () {
  var rr = [], a;
  for (a = CK0; a <= CK1 - 0.01; a += 0.06) rr.push(canRing(a, 24));
  addMesh(loft(rr, {}), matGlass, canopyGroup).renderOrder = 3;
  [3.5, 3.95, 4.75, 5.4, 5.95].forEach(function (a) {
    var pts = canRing(a, 24).map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, a === 3.95 ? 0.016 : 0.011, 6, false), matFrame, canopyGroup);
  });
  [-1, 1].forEach(function (sd) {
    var pts = [];
    for (var a = CK0; a <= CK1 - 0.02; a += 0.1) pts.push(new THREE.Vector3(sd * canHW(a), eZT(a) - 0.005, -a));
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.012, 6, false), matFrame, air);
  });
  var gs = addMesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), matDark, air); gs.position.set(0, eZT(3.65) + 0.08, -3.75);
  // cockpit interior: panel, coaming, seat, armour plate, stick
  var fl = addMesh(new THREE.BoxGeometry(0.46, 0.04, 1.6), matInt, air); fl.position.set(0, eZT(4.4) - 0.2, -4.35);
  var ip = addMesh(new THREE.BoxGeometry(0.5, 0.24, 0.03), matBlack, air); ip.position.set(0, eZT(3.72) + 0.08, -3.72); ip.rotation.x = -0.5;
  var co = addMesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), matBlack, air); co.position.set(0, eZT(3.62) + 0.1, -3.64);
  var st = addMesh(new THREE.BoxGeometry(0.38, 0.05, 0.38), matInt, air); st.position.set(0, eZT(4.4) - 0.14, -4.45);
  var sb = addMesh(new THREE.BoxGeometry(0.38, 0.5, 0.05), matInt, air); sb.position.set(0, eZT(4.6) + 0.06, -4.68); sb.rotation.x = 0.22;
  var hp = addMesh(new THREE.BoxGeometry(0.34, 0.3, 0.02), matInt, air); hp.position.set(0, interp(CA, CZ, 4.9) - 0.22, -4.92); hp.rotation.x = 0.1;
  var sk = addMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), matBlack, air); sk.position.set(0, eZT(4.1) - 0.04, -4.1); sk.rotation.x = -0.2;
  var bk = addMesh(new THREE.BoxGeometry(0.5, 0.42, 0.04), matInt, air); bk.position.set(0, interp(CA, CZ, 5.5) - 0.38, -5.5);
})();

/* ---- four MK 108 muzzles: all in the upper nose, positions read off the front view of the drawing */
(function () {
  function secW(a, y) {
    var hw = eHW(a), zt = eZT(a), zb = eZB(a);
    if (y >= zt || y <= zb) return 0;
    var u = (y - zb) / (zt - zb), s = Math.max(0, Math.min(1, (a - 0.1) / 1.4));
    var we = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))), wt = interp(WU, WV, u);
    return hw * (we + (wt - we) * s);
  }
  [[0.18, 0.39], [0.375, 0.22]].forEach(function (q) {
    var a0 = 0.3;
    while (a0 < 3 && secW(a0, q[1]) < q[0]) a0 += 0.005;
    [-1, 1].forEach(function (sd) {
      var g = new THREE.Group(); g.position.set(sd * q[0], q[1], 0); air.add(g);
      var front = -(a0 - 0.035), back = -(a0 + 0.25), len = front - back;
      var tube = addMesh(new THREE.CylinderGeometry(0.027, 0.03, len, 16, 1, true), matSteel, g); tube.rotation.x = Math.PI / 2; tube.position.z = (front + back) / 2;
      var bore = addMesh(new THREE.CircleGeometry(0.0245, 16), matBlack, g); bore.position.z = front - 0.05;
      var lipm = addMesh(new THREE.TorusGeometry(0.0285, 0.005, 6, 20), matSteel, g); lipm.position.z = front;
      // low oval fairing where the barrel breaks through the nose contour
      var fg = new THREE.SphereGeometry(1, 24, 14); fg.scale(0.052, 0.04, 0.17); fg.translate(0, -0.012, -(a0 + 0.07));
      tag(fg, 'fuseR', [sd * q[0], q[1], 0]);
      var fm = new THREE.Mesh(fg, matSkin); fm.position.set(sd * q[0], q[1], 0); air.add(fm); skinMeshes.push(fm); allMeshes.push(fm);
    });
  });
})();

/* ---- landing gear (tricycle) */
function tyre(R, w, rim) {
  var h = w / 2, pts = [[rim, -h * 0.92], [R * 0.9, -h], [R * 0.975, -h * 0.82], [R, -h * 0.45], [R, h * 0.45], [R * 0.975, h * 0.82], [R * 0.9, h], [rim, h * 0.92]];
  var g = new THREE.LatheGeometry(pts.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 40);
  g.rotateZ(Math.PI / 2); g.computeVertexNormals(); return g;
}
function hubGeo(r, w) {
  var h = w / 2, pts = [[0.02, -h * 0.98], [r * 0.4, -h * 0.9], [r * 0.9, -h * 0.97], [r, -h * 0.9], [r, h * 0.9], [r * 0.9, h * 0.97], [r * 0.4, h * 0.9], [0.02, h * 0.98]];
  var g = new THREE.LatheGeometry(pts.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 24);
  g.rotateZ(Math.PI / 2); g.computeVertexNormals(); return g;
}
var gearAnim = { v: 0, target: 0 };
var gearGroups = [];
var noseG = new THREE.Group();
(function () {
  noseG.position.set(0, -0.45, -1.12); air.add(noseG);
  var dx = 0, dy = -1.505 + 0.45, dz = -(0.55 - 1.12);
  var len = Math.sqrt(dy * dy + dz * dz);
  var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, len, 12), matSteel);
  leg.position.set(0, dy / 2, dz / 2); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, dy, dz).normalize());
  noseG.add(leg); allMeshes.push(leg);
  var oleo = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, len * 0.4, 12), matAlu);
  oleo.position.set(0, dy * 0.3, dz * 0.3); oleo.quaternion.copy(leg.quaternion); noseG.add(oleo); allMeshes.push(oleo);
  var wh = new THREE.Group(); wh.position.set(0, dy, dz); noseG.add(wh);
  var tire = new THREE.Mesh(tyre(0.32, 0.17, 0.17), matRubber); wh.add(tire); allMeshes.push(tire);
  var hub = new THREE.Mesh(hubGeo(0.175, 0.17), matHub); wh.add(hub); allMeshes.push(hub);
  var nd = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.3, 0.17), matDoor); nd.position.set(0.0, dy * 0.4, dz * 0.4 + 0.06); noseG.add(nd); allMeshes.push(nd); nd.position.x = 0.1; nd.userData.door = 1;
  [-1, 1].forEach(function (s) {
    var f = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), matSteel); f.position.set(s * 0.1, 0.16, 0); wh.add(f); allMeshes.push(f);
  });
  noseG.userData.wheel = wh; noseG.userData.axis = new THREE.Vector3(0, dy, dz).normalize();
  [-1, 1].forEach(function (sd) {
    var g = new THREE.Group(); g.position.set(sd * 1.5, -0.5, -4.35); air.add(g);
    var tx = sd * (1.40 - 1.5), ty = -1.36 + 0.5, tz = -(4.42 - 4.35);
    var l = Math.sqrt(tx * tx + ty * ty + tz * tz);
    var lg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, l, 12), matSteel);
    lg.position.set(tx / 2, ty / 2, tz / 2); lg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tx, ty, tz).normalize());
    g.add(lg); allMeshes.push(lg);
    var ol = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, l * 0.4, 12), matAlu);
    ol.position.set(tx * 0.3, ty * 0.3, tz * 0.3); ol.quaternion.copy(lg.quaternion); g.add(ol); allMeshes.push(ol);
    var wx = sd * (1.245 - 1.5);
    var ax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), matSteel); ax.rotation.z = Math.PI / 2; ax.position.set((tx + wx) / 2, ty, tz); g.add(ax); allMeshes.push(ax);
    var tr = new THREE.Mesh(tyre(0.46, 0.30, 0.255), matRubber); tr.position.set(wx, ty, tz); g.add(tr); allMeshes.push(tr);
    var hb = new THREE.Mesh(hubGeo(0.27, 0.3), matHub); hb.position.set(wx, ty, tz); g.add(hb); allMeshes.push(hb);
    var dr = new THREE.Mesh(new THREE.BoxGeometry(0.03, Math.abs(ty) * 0.82, 0.5), matDoor); dr.position.set(tx / 2 + sd * 0.12, ty * 0.5, tz * 0.5); g.add(dr); allMeshes.push(dr);
    var sc = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), matSteel); sc.position.set(tx / 2 - sd * 0.0, ty * 0.35, tz * 0.5 + 0.06); sc.rotation.z = 0.05 * sd; g.add(sc); allMeshes.push(sc);
    gearGroups.push({ g: g, sd: sd });
  });
})();
function applyGear(v) {
  // main legs swing inward and the wheels lie flat inside the fuselage belly
  gearGroups.forEach(function (s) {
    s.g.rotation.z = -s.sd * v * Math.PI / 2;
    s.g.position.set(s.sd * (1.5 - 0.34 * v), -0.5 + v * 0.2, -4.35 + s.sd * 0.45 * v);   // wheels staggered fore/aft so the two discs fit side by side
  });
  // nose leg turns its wheel 90 degrees about the strut and folds aft; the wheel ends up flat in the nose bay
  noseG.rotation.x = v * 2.07;
  noseG.position.y = -0.45 + v * 0.25;
  noseG.userData.wheel.quaternion.setFromAxisAngle(noseG.userData.axis, v * Math.PI / 2);
}

/* ---- panel lines */
var lineGroup = new THREE.Group(); air.add(lineGroup);
var lineMat = new THREE.LineBasicMaterial({ color: 0x1d2328, transparent: true, opacity: 0.5 });
(function () {
  var seg = [];
  function poly(pts) { for (var i = 0; i < pts.length - 1; i++) seg.push(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]); }
  [0.62, 1.55, 2.35, 3.2, 4.15, 5.1, 6.05, 6.9, 7.8, 8.6].forEach(function (a) {
    var r = fusRing(a, eHW(a) + 0.003, eZT(a) + 0.003, eZB(a) - 0.003); r.push(r[0]); poly(r);
  });
  [0.3, 0.62].forEach(function (u) {
    [-1, 1].forEach(function (sd) {
      var pts = [];
      for (var a = 0.8; a <= 9.2; a += 0.2) {
        var hw = eHW(a), zb = eZB(a), zt = eZT(a), s = Math.max(0, Math.min(1, (a - 0.1) / 1.4));
        var we = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))), wt = interp(WU, WV, u);
        pts.push(P(sd * (hw * (we + (wt - we) * s) + 0.003), zb + (zt - zb) * u, a));
      }
      poly(pts);
    });
  });
  [-1, 1].forEach(function (sg) {
    [1, -1].forEach(function (sf) {
      var pts = [], y;
      for (y = 0.9; y <= 5.95; y += 0.15) pts.push(wingPoint(y, 0.74, sf, sg, 0.003)); poly(pts);
      pts = []; for (y = 0.9; y <= 5.9; y += 0.15) pts.push(wingPoint(y, 0.25, sf, sg, 0.003)); poly(pts);
      [2.9, 4.6].forEach(function (yy) { var q = [], i; for (i = 0; i <= 8; i++) q.push(wingPoint(yy, 0.04 + 0.68 * i / 8, sf, sg, 0.003)); poly(q); });
    });
    var q2 = [], y2;
    for (y2 = 0.15; y2 <= 1.8; y2 += 0.15) q2.push(P(sg * y2, STZ + afY(0.62, 0.09) * (sTE(y2) - sLE(y2)) + 0.003, sLE(y2) + 0.62 * (sTE(y2) - sLE(y2)))); poly(q2);
  });
  [-1, 1].forEach(function (sd) {
    var q = [];
    for (var z = 0.4; z <= 1.9; z += 0.1) { var c = fTE(z) - fLE(z); q.push(P(sd * (afY(0.74, fTC(z)) * c + 0.003), z, fLE(z) + 0.74 * c)); }
    poly(q);
  });
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  lineGroup.add(new THREE.LineSegments(g, lineMat));
})();

/* ---- livery: RLM 76 / 82 / 83 splinter-mottle (shader), red nose cap and fin tip, 9K+LK of I./KG 51 */
function paint() { lineMat.color.set(0x1d2328); lineMat.opacity = 0.42; }
var decals = new THREE.Group(); air.add(decals);
function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
function decalMat(tex) { return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false, side: THREE.DoubleSide }); }
function patch(nu, nv, pos, mat, flipU) {
  var p = [], uv = [], ix = [], i, j;
  for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) { var u = i / nu, v = j / nv, q = pos(u, v); p.push(q[0], q[1], q[2]); uv.push(flipU ? 1 - u : u, 1 - v); }
  for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) { var a0 = j * (nu + 1) + i, a1 = a0 + 1, a2 = a0 + nu + 1, a3 = a2 + 1; ix.push(a0, a1, a3, a0, a3, a2); }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals();
  var m = new THREE.Mesh(g, mat); m.renderOrder = 2; decals.add(m); allMeshes.push(m); return m;
}
function drawCross(g, w, h) {
  g.clearRect(0, 0, w, h);
  function cross(inset, col) {
    var t = (w - 2 * inset) * 0.26, x0 = inset, x1 = w - inset, c = w / 2;
    g.fillStyle = col; g.beginPath();
    g.moveTo(c - t / 2, x0); g.lineTo(c + t / 2, x0); g.lineTo(c + t / 2, c - t / 2); g.lineTo(x1, c - t / 2); g.lineTo(x1, c + t / 2);
    g.lineTo(c + t / 2, c + t / 2); g.lineTo(c + t / 2, x1); g.lineTo(c - t / 2, x1); g.lineTo(c - t / 2, c + t / 2);
    g.lineTo(x0, c + t / 2); g.lineTo(x0, c - t / 2); g.lineTo(c - t / 2, c - t / 2); g.closePath(); g.fill();
  }
  cross(0, '#e8e8e2'); cross(w * 0.045, '#101113');
}
function fusSideX(a, z) {
  var hw = eHW(a), zt = eZT(a), zb = eZB(a);
  z = Math.max(zb + 0.01, Math.min(zt - 0.01, z));
  var u = (z - zb) / (zt - zb), s = Math.max(0, Math.min(1, (a - 0.1) / 1.4));
  var we = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))), wt = interp(WU, WV, u);
  return hw * (we + (wt - we) * s);
}
(function () {
  var cm = decalMat(canvasTex(256, 256, drawCross));
  [1, -1].forEach(function (sd) {
    patch(10, 6, function (u, v) { var a = 7.2 + u * 0.66, z = 0.26 - v * 0.58; return [sd * (fusSideX(a, z) + 0.006), z, -a]; }, cm, sd < 0);
  });
  function codeTex(txt) {
    return decalMat(canvasTex(384, 200, function (g, w, h) {
      g.clearRect(0, 0, w, h); g.font = 'bold 190px "Arial Black", Arial, Helvetica, sans-serif'; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
      var cs = txt.map(function (q) { return q; }), x = w / 2, tw = 0, i, m;
      cs.forEach(function (q) { tw += g.measureText(q[0]).width; });
      x = (w - tw) / 2; g.textAlign = 'left';
      cs.forEach(function (q) { g.fillStyle = q[1]; g.fillText(q[0], x, h * 0.88); x += g.measureText(q[0]).width; });
    }));
  }
  var tPort = codeTex([['9', '#14151a'], ['K', '#14151a']]), tLK = codeTex([['L', '#b3201c'], ['K', '#14151a']]);
  function codePatch(sd, a0, a1, mat) {
    patch(10, 4, function (u, v) { var a = a0 + u * (a1 - a0), z = 0.17 - v * 0.38; return [sd * (fusSideX(a, z) + 0.006), z, -a]; }, mat, sd < 0);
  }
  codePatch(1, 6.2, 7.05, tPort); codePatch(1, 8.03, 8.95, tLK);
  codePatch(-1, 8.03, 8.95, tPort); codePatch(-1, 6.2, 7.05, tLK);
  function wingCross(y0, y1, a0, a1, surf, sign) {
    patch(10, 10, function (u, v) {
      var y = y0 + u * (y1 - y0), a = a0 + v * (a1 - a0), f = Math.max(0.02, Math.min(0.98, (a - wLE(y)) / (wTE(y) - wLE(y))));
      return wingPoint(y, f, surf, sign, 0.006);
    }, cm, false);
  }
  [1, -1].forEach(function (sg) { wingCross(3.5, 4.2, 4.3, 5.0, 1, sg); wingCross(3.5, 4.2, 4.3, 5.0, -1, sg); });
})();

/* ---- blueprint overlay */
var overlay = new THREE.Group(); overlay.visible = false; air.add(overlay);
var bpImg = new Image();
function strip(x0, y0, x1, y1) {
  var c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
  var g = c.getContext('2d'); g.drawImage(bpImg, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  var d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  for (var i = 0; i < px.length; i += 4) { var al = 255 - px[i]; px[i] = 0xff; px[i + 1] = 0x7a; px[i + 2] = 0x1a; px[i + 3] = Math.min(255, al * 1.4); }
  g.putImageData(d, 0, 0);
  var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function plane(tex, fn, x0, y0, x1, y1) {
  var cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(function (p) { return fn(p[0], p[1]); });
  var g = new THREE.BufferGeometry(), pos = []; cs.forEach(function (c) { pos.push(c[0], c[1], c[2]); });
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
  var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 20; overlay.add(m);
}
bpImg.onload = function () {
  plane(strip(0, 40, 985, 1150), function (px, py) { return [(597.5 - py) / SE, 0, -(px - 37) / SE]; }, 0, 40, 985, 1150);
  plane(strip(760, 15, 1856, 375), function (px, py) { return [(px - 1306.5) / SE, (201.7 - py) / SE, 1.2]; }, 760, 15, 1856, 375);
  plane(strip(895, 725, 1840, 1080), function (px, py) { return [0, (906 - py) / SE, -(px - 902) / SE]; }, 895, 725, 1840, 1080);
};
bpImg.src = window.ME_BP;

/* ---- dimensions */
function dims() {
  var b = new THREE.Box3(); center.updateMatrixWorld(true);
  var rot = pivot.rotation.x; pivot.rotation.x = 0; pivot.updateMatrixWorld(true);
  skinMeshes.forEach(function (m) { b.expandByObject(m); });
  pivot.rotation.x = rot;
  var len = b.max.z - b.min.z, span = b.max.x - b.min.x;
  return { len: len, span: span, rows: [['全長', len.toFixed(2)], ['全幅', span.toFixed(2)], ['全高(垂直尾翼上端)', (GROUND_Y + b.max.y).toFixed(2)], ['エンジン中心の間隔', (2 * NAC_LAT).toFixed(2)], ['主脚の間隔', (2 * 1.245).toFixed(2)]] };
}
function applyControls(c) {
  var d = Math.PI / 180;
  ctl.fl.forEach(function (h) { hingeRot(h, -c.flap * 45 * d); });
  ctl.ail.forEach(function (o) { hingeRot(o.h, (o.sg > 0 ? -1 : 1) * c.ail * 20 * d); });
  ctl.ele.forEach(function (h) { hingeRot(h, c.ele * 25 * d); });
  hingeRot(ctl.rud, c.rud * 25 * d);
  ctl.slat.forEach(function (h) { h.position.set(h.userData.p0[0], h.userData.p0[1] - 0.04 * c.slat, h.userData.p0[2] + 0.075 * c.slat); });
  canopyHinge.rotation.z = c.can * 1.25;
}
return {
  id: 'me262', applyControls: applyControls, has: { slat: true }, center: center, pivot: pivot, air: air, allMeshes: allMeshes, skinMeshes: skinMeshes, decals: decals, lineGroup: lineGroup,
  overlay: overlay, matGlass: matGlass, canopyGroup: canopyGroup, gearAnim: gearAnim, applyGear: applyGear, paint: paint, dims: dims,
  pitch: 0, groundY: GROUND_Y, flightY: 4.3, shadow: [12.5, 11], viewY: [1.9, 4.6],
  fit: { side: [11.8, 5.4], top: [11.8, 13.4], front: [13.6, 5.4] },
  cam: { pos: [-11, 3.8, 12.5], tgt: [0, 1.8, 0] },
  title: 'Me 262<br>シュヴァルベ', sub: '三面図から起こした 3D モデル。塗装は I./KG 51 所属 9K+LK(1945 年)の RLM 76 / 82 / 83 迷彩', hasProp: false,
  note: '全長 10.60 m を基準に三面図の縮尺を決め、三角断面の胴体・主翼平面形・エンジンナセル・尾翼・風防の座標を画像から計測しています。「三面図を重ねる」で元の線画と見比べられます。',
  update: function (dt, st) {}
};
}
