function buildMeteor() {
var SE = 1366 / 12.6;                       // drawing scale (px per metre), length 12.60 m
var GROUND_Y = 1.47;                         // nose-tip height above the ground on the wheels (m)
var NOSE = 6.3;                              // world z of the nose tip
var NAC_LAT = 2.278, NAC_Z = -0.22;          // engine axis (lateral, height)
var GEAR_LAT = 1.55;

var center = new THREE.Group(); center.position.z = NOSE; scene.add(center);
var pivot = new THREE.Group(); center.add(pivot);
var air = new THREE.Group(); pivot.add(air);
var skinMeshes = [], allMeshes = [];
var matSkin = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.03, roughness: 0.62, side: THREE.DoubleSide });
var KIND = { fuse: 0, wing: 1, stab: 2, fin: 3, nacelle: 4, fuseR: 5 };
var camoU = {
  cMSG: { value: new THREE.Vector3().fromArray(linRGB(0x6e7a81)) },   // Medium Sea Grey (undersides)
  cOG: { value: new THREE.Vector3().fromArray(linRGB(0x3d4846)) },    // Ocean Grey
  cDG: { value: new THREE.Vector3().fromArray(linRGB(0x25341f)) },    // Dark Green
  cSKY: { value: new THREE.Vector3().fromArray(linRGB(0x9fb3a2)) }    // Sky band
};
matSkin.onBeforeCompile = function (sh) {
  Object.keys(camoU).forEach(function (k) { sh.uniforms[k] = camoU[k]; });
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aAP;\nattribute float aKind;\nvarying vec3 vAP;\nvarying vec3 vAN;\nvarying float vKind;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAP = aAP; vAN = -normal; vKind = aKind;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vAP;\nvarying vec3 vAN;\nvarying float vKind;\nuniform vec3 cMSG;\nuniform vec3 cOG;\nuniform vec3 cDG;\nuniform vec3 cSKY;\n' + [
      'float h31(vec3 p){ p = fract(p * 0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
      'float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),',
      '             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }',
      'float fbm(vec3 p){ return 0.55 * vn(p) + 0.3 * vn(p * 2.07 + 3.1) + 0.15 * vn(p * 4.3 + 7.7); }',
      'vec3 camo(){',
      '  vec3 p = vAP; vec3 n = normalize(vAN); float up = n.y;',
      '  float kind = vKind; if (kind > 4.5) { kind -= 5.0; up = -up; }',
      '  vec3 q = vec3(abs(p.x), p.y, p.z);',
      '  float w = fbm(q * vec3(1.2, 2.2, 1.2) + 1.7) - 0.5;',
      '  float cover;',
      '  if (kind < 0.5) cover = smoothstep(0.0, 0.05, up + w * 0.5 + 0.16);',
      '  else if (kind < 2.5) cover = smoothstep(0.0, 0.05, up + w * 0.2);',
      '  else if (kind < 3.5) cover = smoothstep(0.0, 0.06, p.y + 0.02 + w * 0.3);',
      '  else cover = smoothstep(0.0, 0.05, up + w * 0.45 + 0.1);',
      // two-tone disruptive pattern: Dark Green blotches over Ocean Grey (mirrored left/right)
      '  float blot = smoothstep(0.50, 0.535, fbm(q * vec3(0.62, 1.3, 0.50) + vec3(3.0, 1.0, 5.0)));',
      '  float blot2 = smoothstep(0.64, 0.67, vn(q * vec3(2.2, 3.0, 1.6) + 8.0));',
      '  vec3 top = mix(cOG, cDG, max(blot, blot2 * 0.9));',
      '  top *= 0.82 + 0.1 * vn(p * 12.0);',
      '  vec3 under = cMSG * (0.95 + 0.1 * fbm(p * 3.0 + 11.0));',
      '  vec3 col = mix(under, top, cover);',
      '  float aft = -p.z;',
      '  if (kind < 0.5 && aft > 9.95 && aft < 10.38) col = mix(col, cSKY, 1.0 - smoothstep(0.0, 0.01, abs(aft - 10.165) - 0.215));',
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
var ctl = { fl: [], ail: [], ele: [], rud: null };
function hingeAlong(sign, fn, f, ya, yb) {
  var pa = fn(ya, f, 0), pb = fn(yb, f, 0);
  return sign > 0 ? mkHinge(air, pa, pb) : mkHinge(air, pb, pa);
}
function addMesh(geo, mat, parent) { var m = new THREE.Mesh(geo, mat); (parent || air).add(m); allMeshes.push(m); return m; }
var matDark = new THREE.MeshStandardMaterial({ color: lin(0x1e2226), metalness: 0.5, roughness: 0.6, side: THREE.DoubleSide });
var matSteel = new THREE.MeshStandardMaterial({ color: lin(0x6b7078), metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide });
var matBurn = new THREE.MeshStandardMaterial({ color: lin(0x4a4640), metalness: 0.8, roughness: 0.45, side: THREE.DoubleSide });
var matRubber = new THREE.MeshStandardMaterial({ color: lin(0x15171a), metalness: 0, roughness: 0.9 });
var matAlu = new THREE.MeshStandardMaterial({ color: lin(0xb8bdc2), metalness: 0.85, roughness: 0.35 });
var matFrame = new THREE.MeshStandardMaterial({ color: lin(0x3c4a36), metalness: 0.2, roughness: 0.6 });
var matGlass = new THREE.MeshStandardMaterial({ color: lin(0xaed4e6), metalness: 0, roughness: 0.04, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
matGlass.userData.baseOpacity = 0.36;
var matHub = new THREE.MeshStandardMaterial({ color: lin(0x9aa0a4), metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });
var matDoor = new THREE.MeshStandardMaterial({ color: lin(0x8d989b), metalness: 0.04, roughness: 0.66, side: THREE.DoubleSide });
var matInt = new THREE.MeshStandardMaterial({ color: lin(0x33393c), metalness: 0.15, roughness: 0.7, side: THREE.DoubleSide });
var matBlack = new THREE.MeshStandardMaterial({ color: lin(0x0d0e10), metalness: 0.1, roughness: 0.6, side: THREE.DoubleSide });

/* ---- fuselage: rounded section, widest low on the sides, narrower deck */
var FA = [0, 0.01, 0.03, 0.06, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.6, 4.0, 4.5, 5.2, 5.8, 6.4, 7.0, 7.44, 7.81, 8.18, 8.55, 8.92, 9.29, 9.66, 10.03, 10.35, 10.55, 10.62];
var FHW = [0.004, 0.092, 0.12, 0.166, 0.203, 0.231, 0.258, 0.304, 0.332, 0.369, 0.397, 0.443, 0.48, 0.526, 0.553, 0.581, 0.609, 0.627, 0.636, 0.646, 0.655, 0.66, 0.664, 0.669, 0.672, 0.672, 0.672, 0.668, 0.65, 0.61, 0.55, 0.505, 0.489, 0.47, 0.443, 0.424, 0.397, 0.36, 0.332, 0.30, 0.2, 0.05];
var FZT = [0, 0.078, 0.115, 0.171, 0.208, 0.254, 0.291, 0.355, 0.392, 0.438, 0.475, 0.549, 0.595, 0.641, 0.69, 0.735, 0.76, 0.775, 0.79, 0.805, 0.82, 0.83, 0.835, 0.85, 0.865, 0.872, 0.862, 0.844, 0.8255, 0.815, 0.807, 0.789, 0.78, 0.77, 0.756, 0.7425, 0.73, 0.72, 0.715, 0.70, 0.62, 0.45];
var FZB = [0, -0.078, -0.115, -0.161, -0.198, -0.226, -0.254, -0.3, -0.327, -0.355, -0.383, -0.429, -0.466, -0.484, -0.512, -0.521, -0.54, -0.549, -0.558, -0.567, -0.575, -0.585, -0.59, -0.597, -0.6, -0.6, -0.6, -0.57, -0.52, -0.43, -0.34, -0.28, -0.244, -0.2, -0.16, -0.125, -0.088, -0.06, -0.032, 0.0, 0.2, 0.4];
function eHW(a) { return interp(FA, FHW, a); }
function eZT(a) { return interp(FA, FZT, a); }
function eZB(a) { return interp(FA, FZB, a); }
var WU = [0, 0.03, 0.06, 0.15, 0.3, 0.55, 0.7, 0.8, 0.9, 1.0], WV = [0.45, 0.7, 0.8, 0.92, 1.0, 1.0, 0.95, 0.88, 0.78, 0.6];
var NU = 16;
function secBlend(a) {
  var s = Math.max(0, Math.min(1, (a - 0.1) / 1.6));
  var t = Math.max(0, Math.min(1, (a - 7.0) / 3.5));
  return s * (1 - 0.55 * t * t * (3 - 2 * t));
}
function secHalf(a, u) {
  var we = Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))), wt = interp(WU, WV, u);
  return eHW(a) * (we + (wt - we) * secBlend(a));
}
function fusRing(a, hw, zt, zb) {
  var right = [], u, i, k = hw / Math.max(eHW(a), 1e-6);
  for (i = 0; i <= NU; i++) { u = i / NU; right.push([secHalf(a, u) * k, zb + (zt - zb) * u]); }
  var ring = [];
  for (i = 0; i <= NU; i++) ring.push(P(right[i][0], right[i][1], a));
  for (i = NU; i >= 0; i--) ring.push(P(-right[i][0], right[i][1], a));
  return ring;
}
var rings = [];
FA.forEach(function (a, i) { rings.push(fusRing(a, Math.max(FHW[i], 0.004), FZT[i], FZB[i])); });
addSkin(loft(rings, { capStart: true, capEnd: true }), 'fuse');

/* ---- airfoil helpers */
function afY(x, t) { return t * 5 * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x); }
var AFX = [], k;
(function () { var M = 22; for (k = 0; k <= M; k++) AFX.push((1 - Math.cos(Math.PI * k / M)) / 2); })();

/* ---- wing: planform rows read off the top view */
var WROW = [[0.3, 3.26, 7.2], [0.64, 3.28, 7.05], [0.86, 3.30, 6.83], [1.01, 3.32, 6.75], [1.23, 3.339, 6.706], [1.6, 3.376, 6.65], [2.3, 3.455, 6.54], [3.08, 3.533, 6.429], [3.26, 3.588, 6.374], [3.45, 3.634, 6.328], [3.63, 3.68, 6.28], [3.81, 3.736, 6.226], [4.0, 3.78, 6.18], [4.18, 3.83, 6.125], [4.37, 3.883, 6.079], [4.55, 3.93, 6.023], [4.74, 3.975, 5.977], [4.92, 4.02, 5.92], [5.1, 4.077, 5.876], [5.29, 4.13, 5.793], [5.382, 4.215, 5.627], [5.419, 4.271, 5.516], [5.456, 4.345, 5.378], [5.493, 4.474, 5.212], [5.511, 4.612, 5.092], [5.53, 4.85, 4.85]];
var WY = WROW.map(function (r) { return r[0]; }), WLE = WROW.map(function (r) { return r[1]; }), WTE = WROW.map(function (r) { return r[2]; });
function wLE(y) { return interp(WY, WLE, y); }
function wTE(y) { return interp(WY, WTE, y); }
function wTC(y) { return interp([0.3, 2.3, 3.1, 5.1, 5.53], [0.15, 0.145, 0.14, 0.138, 0.10], y); }
function wZ(y) { return NAC_Z + Math.max(0, y - 2.3) * 0.073; }
function wingPoint(y, f, surf, sign, off) {
  var le = wLE(y), te = wTE(y), c = te - le;
  return P(sign * y, wZ(y) + surf * (afY(f, wTC(y)) * c + (off || 0)), le + f * c);
}
var WYS = [0.3, 0.62, 0.9, 1.2, 1.62, 2.1, 2.5, 2.92, 3.5, 4.0, 4.5, 5.0, 5.25, 5.3, 5.382, 5.419, 5.456, 5.493, 5.511, 5.53];
function wFn(sign) { return function (y, f, sd) { var le = wLE(y), te = wTE(y), c = te - le; return P(sign * y, wZ(y) + sd * afY(f, wTC(y)) * c, le + f * c); }; }
var FLAP_F = 0.72, AIL_F = 0.76;
[1, -1].forEach(function (sign) {
  var fn = wFn(sign), flip = sign > 0;
  [[0.3, 0.62, 0, 1], [0.62, 1.62, 0, FLAP_F], [1.62, 2.92, 0, 1], [2.92, 3.5, 0, FLAP_F], [3.5, 5.25, 0, AIL_F], [5.25, 5.53, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(WYS, s[0], s[1]), s[2], s[3], fn, flip), 'wing');
  });
  [[0.62, 1.62], [2.92, 3.5]].forEach(function (r) {
    var h = hingeAlong(sign, fn, FLAP_F, r[0], r[1]);
    addSkinH(surfLoft(stationsIn(WYS, r[0], r[1]), FLAP_F, 1, fn, flip), 'wing', h); ctl.fl.push(h);
  });
  var ha = hingeAlong(sign, fn, AIL_F, 3.5, 5.25);
  addSkinH(surfLoft(stationsIn(WYS, 3.5, 5.25), AIL_F, 1, fn, flip), 'wing', ha); ctl.ail.push({ h: ha, sg: sign });
});

/* ---- tailplane (set high on the fin) */
var TROW = [[0.1, 10.62, 12.45], [0.5, 10.663, 12.323], [0.6, 10.69, 12.314], [0.79, 10.737, 12.286], [1.07, 10.81, 12.24], [1.25, 10.857, 12.26], [1.53, 10.921, 12.148], [1.8, 10.995, 12.074], [2.08, 11.069, 11.964], [2.17, 11.124, 11.908], [2.265, 11.226, 11.825], [2.357, 11.438, 11.632], [2.385, 11.55, 11.58]];
var TY = TROW.map(function (r) { return r[0]; }), TLE = TROW.map(function (r) { return r[1]; }), TTE = TROW.map(function (r) { return r[2]; });
var STZ = 1.41;
function sLE(y) { return interp(TY, TLE, y); }
function sTE(y) { return interp(TY, TTE, y); }
var TYS = [0.1, 0.2, 0.5, 0.8, 1.1, 1.4, 1.7, 2.0, 2.22, 2.265, 2.31, 2.357, 2.385];
var ELE_F = 0.5;
function sFn(sign) { return function (y, f, sd) { var le = sLE(y), te = sTE(y), c = te - le; return P(sign * y, STZ + sd * afY(f, 0.085) * c, le + f * c); }; }
[1, -1].forEach(function (sign) {
  var fn = sFn(sign), flip = sign > 0;
  [[0.1, 0.2, 0, 1], [0.2, 2.22, 0, ELE_F], [2.22, 2.385, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(TYS, s[0], s[1]), s[2], s[3], fn, flip), 'stab');
  });
  var h = hingeAlong(sign, fn, ELE_F, 0.2, 2.22);
  addSkinH(surfLoft(stationsIn(TYS, 0.2, 2.22), ELE_F, 1, fn, flip), 'stab', h); ctl.ele.push(h);
});

/* ---- fin and rudder (hinge line is a vertical line at a = 11.46) */
var FZ = [-0.22, -0.15, 0.02, 0.19, 0.355, 0.52, 0.7, 0.85, 1.0, 1.19, 1.35, 1.52, 1.68, 1.85, 2.02, 2.18, 2.3, 2.36];
var FLE = [10.75, 10.55, 10.42, 10.38, 10.33, 10.29, 10.28, 10.32, 10.4, 10.45, 10.42, 10.52, 10.84, 10.97, 11.1, 11.26, 11.45, 11.62];
var FTE = [11.0, 11.29, 11.68, 12.02, 12.24, 12.34, 12.40, 12.43, 12.44, 12.44, 12.46, 12.41, 12.36, 12.30, 12.19, 12.06, 11.9, 11.65];
var HINGE_A = 11.46;
function fLE(z) { return interp(FZ, FLE, z); }
function fTE(z) { return interp(FZ, FTE, z); }
function fTC(z) { return interp([-0.22, 0.3, 1.0, 2.3], [0.12, 0.10, 0.09, 0.07], z); }
function fFn(z, f, sd) {
  var le = fLE(z), te = fTE(z), c = te - le, ah = Math.max(le + 0.05, Math.min(te - 0.05, HINGE_A)), a;
  a = f <= 0.5 ? le + (f / 0.5) * (ah - le) : ah + ((f - 0.5) / 0.5) * (te - ah);
  return P(sd * afY((a - le) / c, fTC(z)) * c, z, a);
}
var FZS = [-0.22, -0.15, 0.02, 0.05, 0.19, 0.355, 0.52, 0.7, 0.85, 1.0, 1.19, 1.35, 1.52, 1.68, 1.85, 2.02, 2.18, 2.25, 2.3, 2.34, 2.36];
(function () {
  [[-0.22, 0.05, 0, 1], [0.05, 2.25, 0, 0.5], [2.25, 2.36, 0, 1]].forEach(function (s) {
    addSkin(surfLoft(stationsIn(FZS, s[0], s[1]), s[2], s[3], fFn, false), 'fin');
  });
  var rud = mkHinge(air, fFn(0.05, 0.5, 0), fFn(2.25, 0.5, 0));
  addSkinH(surfLoft(stationsIn(FZS, 0.05, 2.25), 0.5, 1, fFn, false), 'fin', rud); ctl.rud = rud;
})();

/* ---- engine nacelles (Derwent) */
var nacProf = [[2.28, 0.335], [2.30, 0.34], [2.37, 0.346], [2.444, 0.387], [2.518, 0.42], [2.59, 0.443], [2.666, 0.466], [2.74, 0.484], [2.81, 0.503], [2.887, 0.5165], [2.96, 0.535], [3.035, 0.553], [3.11, 0.567], [3.18, 0.581], [3.256, 0.59], [3.33, 0.6], [3.7, 0.618], [4.2, 0.628], [4.8, 0.628], [5.29, 0.62], [5.62, 0.598], [5.95, 0.568], [6.28, 0.53], [6.61, 0.48], [6.72, 0.424], [6.87, 0.397], [7.02, 0.369], [7.17, 0.341], [7.31, 0.314], [7.39, 0.30], [7.46, 0.286], [7.50, 0.282], [7.56, 0.24]];
function lathe(points, segs) {
  var g = new THREE.LatheGeometry(points.map(function (p) { return new THREE.Vector2(p[1], -p[0]); }), segs || 48);
  g.rotateX(Math.PI / 2); g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}
[-1, 1].forEach(function (sd) {
  var holder = new THREE.Group(); holder.position.set(sd * NAC_LAT, NAC_Z, 0); air.add(holder);
  var og = lathe(nacProf.concat([[7.56, 0.24], [7.57, 0.2]]), 56); og.userData.kind = 'nacelle'; tag(og, 'nacelle', [sd * NAC_LAT, NAC_Z, 0]);
  var om = new THREE.Mesh(og, matSkin); holder.add(om); skinMeshes.push(om); allMeshes.push(om);
  addMesh(lathe([[2.28, 0.335], [2.45, 0.30], [3.1, 0.28], [3.2, 0.0]], 40), matDark, holder);
  addMesh(lathe([[2.62, 0.0], [2.68, 0.06], [2.9, 0.14], [3.2, 0.2], [3.28, 0.0]], 32), matAlu, holder);
  addMesh(lathe([[7.57, 0.2], [7.7, 0.08], [7.74, 0.0]], 24), matBurn, holder);
  var lip = addMesh(new THREE.TorusGeometry(0.338, 0.014, 8, 48), matAlu, holder); lip.position.z = -2.285;
  var nz = addMesh(new THREE.TorusGeometry(0.255, 0.014, 8, 48), matBurn, holder); nz.position.z = -7.56;
});

/* ---- canopy: fixed windscreen + sliding bubble */
var CA = [1.31, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.52];
var CZ = [0.70, 0.724, 0.78, 0.853, 0.92, 0.992, 1.05, 1.102, 1.148, 1.148, 1.093, 1.075, 1.038, 0.992, 0.927, 0.89];
var CK0 = CA[0], CK1 = CA[CA.length - 1], CSPLIT = 2.0;
var canopyGroup = new THREE.Group(); air.add(canopyGroup);
function canHW(a) { return Math.min(interp([1.31, 1.7, 2.0, 2.3, 2.6, 3.0, 3.3, 3.52], [0.2, 0.3, 0.36, 0.39, 0.4, 0.4, 0.35, 0.26], a), eHW(a) * 0.6); }
function canRing(a, M) {
  var hw = canHW(a), base = eZT(a) - 0.015, top = Math.max(base + 0.02, interp(CA, CZ, a)), pts = [];
  for (var i = 0; i <= M; i++) { var ph = Math.PI * i / M; pts.push(P(hw * Math.cos(ph), base + (top - base) * Math.pow(Math.sin(ph), 0.8), a)); }
  return pts;
}
function glassBetween(a0, a1, parent) {
  var rr = [], a;
  for (a = a0; a < a1 - 0.001; a += 0.06) rr.push(canRing(a, 24));
  rr.push(canRing(a1, 24));
  addMesh(loft(rr, {}), matGlass, parent).renderOrder = 3;
}
var winGroup = new THREE.Group(); air.add(winGroup);
(function () {
  glassBetween(CK0, CSPLIT, winGroup); glassBetween(CSPLIT, CK1, canopyGroup);
  [[1.31, winGroup, 0.016], [1.66, winGroup, 0.011], [2.0, winGroup, 0.016], [2.6, canopyGroup, 0.011], [3.5, canopyGroup, 0.014]].forEach(function (q) {
    var pts = canRing(q[0], 24).map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, q[2], 6, false), matFrame, q[1]);
  });
  [-1, 1].forEach(function (sd) {
    var pts = [];
    for (var a = CK0; a <= CK1 - 0.02; a += 0.1) pts.push(new THREE.Vector3(sd * canHW(a), eZT(a) - 0.01, -a));
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.014, 6, false), matFrame, air);
  });
  // cockpit interior
  var gs = addMesh(new THREE.BoxGeometry(0.1, 0.07, 0.12), matDark, air); gs.position.set(0, eZT(1.9) + 0.12, -1.95);
  var fl = addMesh(new THREE.BoxGeometry(0.5, 0.04, 1.4), matInt, air); fl.position.set(0, eZT(2.8) - 0.38, -2.7);
  var ip = addMesh(new THREE.BoxGeometry(0.6, 0.26, 0.03), matBlack, air); ip.position.set(0, eZT(1.8) - 0.02, -1.8); ip.rotation.x = -0.55;
  var st = addMesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), matInt, air); st.position.set(0, eZT(2.8) - 0.34, -2.85);
  var sb = addMesh(new THREE.BoxGeometry(0.42, 0.55, 0.05), matInt, air); sb.position.set(0, eZT(3.1) - 0.1, -3.1); sb.rotation.x = 0.2;
  var hp = addMesh(new THREE.BoxGeometry(0.4, 0.34, 0.02), matInt, air); hp.position.set(0, interp(CA, CZ, 3.3) - 0.3, -3.35);
  var sk = addMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), matBlack, air); sk.position.set(0, eZT(2.5) - 0.2, -2.45); sk.rotation.x = -0.2;
})();

/* ---- four 20 mm cannon: slots on the sides of the nose, positions from the front and side views */
(function () {
  [[0.14, 1.17], [-0.17, 1.17]].forEach(function (q) {
    [-1, 1].forEach(function (sd) {
      var a0 = q[1], slope = (eHW(a0 + 0.05) - eHW(a0 - 0.05)) / 0.1, z = q[0];
      var zu = (z - eZB(a0)) / (eZT(a0) - eZB(a0)), lat = secHalf(a0, zu);
      var g = new THREE.Group(); g.position.set(sd * lat, z, -a0); g.rotation.y = -sd * Math.atan(slope); air.add(g);
      var sg = new THREE.SphereGeometry(1, 20, 12); sg.scale(0.022, 0.034, 0.30);
      var sl = addMesh(sg, matBlack, g); sl.position.x = sd * 0.004;
      var tube = addMesh(new THREE.CylinderGeometry(0.022, 0.025, 0.34, 14, 1, true), matSteel, g); tube.rotation.x = Math.PI / 2; tube.position.set(sd * 0.012, 0, 0.24);
      var bore = addMesh(new THREE.CircleGeometry(0.019, 14), matBlack, g); bore.position.set(sd * 0.012, 0, 0.412);
    });
  });
})();

/* ---- antennas and pitot */
(function () {
  var bl = new THREE.Shape(); bl.moveTo(0, 0); bl.lineTo(0.16, 0); bl.lineTo(0.0, 0.62); bl.lineTo(0, 0);
  var bg = new THREE.ExtrudeGeometry(bl, { depth: 0.02, bevelEnabled: false });
  var bm = addMesh(bg, matSkin, air); bm.rotation.y = Math.PI / 2; bm.position.set(-0.01, eZT(5.65) - 0.02, -5.65);
  tag(bg, 'fuse'); skinMeshes.push(bm);
  var pl = addMesh(new THREE.CylinderGeometry(0.014, 0.018, 0.4, 8), matDark, air); pl.position.set(0, eZT(7.44) + 0.18, -7.44);
  var pt = addMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 10), matSteel, air);
  pt.rotation.x = Math.PI / 2; pt.position.set(5.14, wZ(5.14) - 0.01, -(3.23 + 0.45));
  var pc = addMesh(new THREE.ConeGeometry(0.018, 0.08, 10), matSteel, air); pc.rotation.x = Math.PI / 2; pc.position.set(5.14, wZ(5.14) - 0.01, -(3.23 - 0.04));
  var pm = addMesh(new THREE.BoxGeometry(0.03, 0.06, 0.3), matSteel, air); pm.position.set(5.14, wZ(5.14) - 0.01, -3.95);
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
  var NG_A = 1.0, NG_Z = -0.47, WH_A = 0.64, WH_Z = -1.17;
  noseG.position.set(0, NG_Z, -NG_A); air.add(noseG);
  var dx = 0, dy = WH_Z - NG_Z, dz = -(WH_A - NG_A);
  var len = Math.sqrt(dy * dy + dz * dz);
  var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, len, 12), matSteel);
  leg.position.set(0, dy / 2, dz / 2); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, dy, dz).normalize());
  noseG.add(leg); allMeshes.push(leg);
  var oleo = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, len * 0.4, 12), matAlu);
  oleo.position.set(0, dy * 0.3, dz * 0.3); oleo.quaternion.copy(leg.quaternion); noseG.add(oleo); allMeshes.push(oleo);
  var wh = new THREE.Group(); wh.position.set(0, dy, dz); noseG.add(wh);
  var tire = new THREE.Mesh(tyre(0.30, 0.21, 0.16), matRubber); wh.add(tire); allMeshes.push(tire);
  var hub = new THREE.Mesh(hubGeo(0.165, 0.21), matHub); wh.add(hub); allMeshes.push(hub);
  [-1, 1].forEach(function (s) {
    var f = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8), matSteel); f.position.set(s * 0.115, 0.12, 0); wh.add(f); allMeshes.push(f);
  });
  var nd = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.36, 0.22), matDoor); nd.position.set(0.17, dy * 0.38, dz * 0.4 - 0.03); noseG.add(nd); allMeshes.push(nd);
  noseG.userData.wheel = wh; noseG.userData.axis = new THREE.Vector3(0, dy, dz).normalize();
  [-1, 1].forEach(function (sd) {
    var HZ = -0.30, WZ = -1.10;
    var g = new THREE.Group(); g.position.set(sd * GEAR_LAT, HZ, -4.58); air.add(g);
    var ty = WZ - HZ, l = Math.abs(ty);
    var lg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, l, 12), matSteel); lg.position.set(0, ty / 2, 0); g.add(lg); allMeshes.push(lg);
    var ol = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, l * 0.4, 12), matAlu); ol.position.set(0, ty * 0.3, 0); g.add(ol); allMeshes.push(ol);
    var ax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10), matSteel); ax.rotation.z = Math.PI / 2; ax.position.set(0, ty, 0); g.add(ax); allMeshes.push(ax);
    var tr = new THREE.Mesh(tyre(0.38, 0.26, 0.2), matRubber); tr.position.set(0, ty, 0); g.add(tr); allMeshes.push(tr);
    var hb = new THREE.Mesh(hubGeo(0.22, 0.26), matHub); hb.position.set(0, ty, 0); g.add(hb); allMeshes.push(hb);
    var dr = new THREE.Mesh(new THREE.BoxGeometry(0.03, l * 0.8, 0.55), matDoor); dr.position.set(-sd * 0.2, ty * 0.5, 0); g.add(dr); allMeshes.push(dr);
    var sc = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 8), matSteel); sc.position.set(0, ty * 0.4, 0.07); sc.rotation.z = 0.0; g.add(sc); allMeshes.push(sc);
    gearGroups.push({ g: g, sd: sd });
  });
})();
function applyGear(v) {
  // main legs swing inward until the wheels lie flat in the wing roots
  gearGroups.forEach(function (s) {
    s.g.rotation.z = -s.sd * v * Math.PI / 2;
    s.g.position.set(s.sd * (GEAR_LAT + 0.4 * v), -0.30, -4.58);
  });
  // nose leg turns its wheel 90 degrees about the strut and folds aft into the nose bay
  noseG.rotation.x = v * 2.03;
  noseG.position.y = -0.47 + v * 0.25;
  noseG.userData.wheel.quaternion.setFromAxisAngle(noseG.userData.axis, v * Math.PI / 2);
}

/* ---- panel lines */
var lineGroup = new THREE.Group(); air.add(lineGroup);
var lineMat = new THREE.LineBasicMaterial({ color: 0x1d2328, transparent: true, opacity: 0.5 });
(function () {
  var seg = [];
  function poly(pts) { for (var i = 0; i < pts.length - 1; i++) seg.push(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]); }
  [0.9, 1.31, 3.52, 4.3, 5.6, 6.7, 7.8, 8.8, 9.7].forEach(function (a) {
    var r = fusRing(a, eHW(a) + 0.003, eZT(a) + 0.003, eZB(a) - 0.003); r.push(r[0]); poly(r);
  });
  [0.45].forEach(function (u) {
    [-1, 1].forEach(function (sd) {
      var pts = [];
      for (var a = 0.6; a <= 10.2; a += 0.2) pts.push(P(sd * (secHalf(a, u) + 0.003), eZB(a) + (eZT(a) - eZB(a)) * u, a));
      poly(pts);
    });
  });
  [-1, 1].forEach(function (sg) {
    [1, -1].forEach(function (sf) {
      var pts = [], y;
      for (y = 0.65; y <= 5.25; y += 0.15) pts.push(wingPoint(y, y < 2.0 || y > 2.9 && y < 3.5 ? FLAP_F : AIL_F, sf, sg, 0.003)); poly(pts);
      pts = []; for (y = 0.65; y <= 5.4; y += 0.15) pts.push(wingPoint(y, 0.3, sf, sg, 0.003)); poly(pts);
      [3.5, 5.25, 1.62, 2.92].forEach(function (yy) { var q = [], i; for (i = 0; i <= 8; i++) q.push(wingPoint(yy, 0.1 + 0.88 * i / 8, sf, sg, 0.003)); poly(q); });
    });
    var q2 = [], y2;
    for (y2 = 0.2; y2 <= 2.2; y2 += 0.15) q2.push(P(sg * y2, STZ + afY(ELE_F, 0.085) * (sTE(y2) - sLE(y2)) + 0.003, sLE(y2) + ELE_F * (sTE(y2) - sLE(y2)))); poly(q2);
  });
  [-1, 1].forEach(function (sd) {
    var q = [];
    for (var z = 0.05; z <= 2.25; z += 0.1) { var p = fFn(z, 0.5, 1); q.push(P(sd * (p[0] + 0.003), z, -p[2])); }
    poly(q);
    [-1, 1].forEach(function (_) { });
  });
  [-1, 1].forEach(function (sd) {
    var ring = [], i, M = 28;
    for (i = 0; i <= M; i++) { var a = -Math.PI + 2 * Math.PI * i / M; ring.push(P(sd * (secHalf(3.4, 0.5) * 0.0 + NAC_LAT) + Math.cos(a) * 0.62, NAC_Z + Math.sin(a) * 0.62, 3.9)); }
    poly(ring);
  });
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  lineGroup.add(new THREE.LineSegments(g, lineMat));
})();

/* ---- livery: No. 616 Sqn (YQ-Y), Dark Green / Ocean Grey over Medium Sea Grey */
function paint() { lineMat.color.set(0x1d2328); lineMat.opacity = 0.4; }
var decals = new THREE.Group(); air.add(decals);
function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t; }
function decalMat(tex) { return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false, side: THREE.DoubleSide }); }
function patch(nu, nv, pos, mat, flipU, parent) {
  var p = [], uv = [], ix = [], i, j;
  for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) { var u = i / nu, v = j / nv, q = pos(u, v); p.push(q[0], q[1], q[2]); uv.push(flipU ? 1 - u : u, 1 - v); }
  for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) { var a0 = j * (nu + 1) + i, a1 = a0 + 1, a2 = a0 + nu + 1, a3 = a2 + 1; ix.push(a0, a1, a3, a0, a3, a2); }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(ix); g.computeVertexNormals();
  var m = new THREE.Mesh(g, mat); m.renderOrder = 2; (parent || decals).add(m); allMeshes.push(m); return m;
}
function drawRoundel(g, w, h, kind) {
  g.clearRect(0, 0, w, h);
  var c = w / 2, R = w / 2 - 2;
  function disc(r, col) { g.fillStyle = col; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill(); }
  if (kind === 'C') { disc(R, '#e0b81c'); disc(R * 0.8, '#15306a'); disc(R * 0.6, '#f1f1ec'); disc(R * 0.2, '#a8171e'); }
  else { disc(R, '#15306a'); disc(R * 0.62, '#f1f1ec'); disc(R * 0.3, '#a8171e'); }
}
function fusSideX(a, z) {
  var zt = eZT(a), zb = eZB(a);
  z = Math.max(zb + 0.01, Math.min(zt - 0.01, z));
  return secHalf(a, (z - zb) / (zt - zb));
}
(function () {
  var rC = decalMat(canvasTex(256, 256, function (g, w, h) { drawRoundel(g, w, h, 'C'); }));
  var rB = decalMat(canvasTex(256, 256, function (g, w, h) { drawRoundel(g, w, h, 'B'); }));
  [1, -1].forEach(function (sd) {
    patch(10, 10, function (u, v) { var a = 8.18 + u * 0.82, z = 0.66 - v * 0.82; return [sd * (fusSideX(a, z) + 0.006), z, -a]; }, rC, sd < 0);
  });
  function codeTex(txt) {
    return decalMat(canvasTex(512, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h); g.font = 'bold 230px "Arial Black", Arial, Helvetica, sans-serif'; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
      g.fillStyle = '#b4c2b4'; g.fillText(txt, w / 2, h * 0.88);
    }));
  }
  var tYQ = codeTex('YQ'), tY = codeTex('Y');
  function codePatch(sd, a0, a1, mat) {
    patch(10, 4, function (u, v) { var a = a0 + u * (a1 - a0), z = 0.55 - v * 0.5; return [sd * (fusSideX(a, z) + 0.006), z, -a]; }, mat, sd < 0);
  }
  [1, -1].forEach(function (sd) { codePatch(sd, 6.75, 7.95, tYQ); codePatch(sd, 9.1, 9.9, tY); });
  function wingRoundel(y0, y1, a0, a1, surf, sign, mat) {
    patch(10, 10, function (u, v) {
      var y = y0 + u * (y1 - y0), a = a0 + v * (a1 - a0), f = Math.max(0.02, Math.min(0.98, (a - wLE(y)) / (wTE(y) - wLE(y))));
      return wingPoint(y, f, surf, sign, 0.006);
    }, mat, false);
  }
  [1, -1].forEach(function (sg) { wingRoundel(3.35, 4.45, 4.5, 5.55, 1, sg, rB); wingRoundel(3.35, 4.45, 4.5, 5.55, -1, sg, rB); });
  // fin flash: blue / white / red bands on the fixed fin
  var flash = decalMat(canvasTex(192, 256, function (g, w, h) {
    g.clearRect(0, 0, w, h);
    var cols = ['#15306a', '#f1f1ec', '#a8171e'], i;
    for (i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.fillRect(i * w / 3, 0, w / 3 + 1, h); }
  }));
  [1, -1].forEach(function (sd) {
    patch(8, 8, function (u, v) {
      var z = 1.75 - v * 0.8, a = 11.02 + u * 0.38, le = fLE(z), te = fTE(z), c = te - le, fc = (a - le) / c;
      return [sd * (afY(Math.max(fc, 0.001), fTC(z)) * c + 0.006), z, -a];
    }, flash, sd < 0);
  });
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
var X0 = 43, YC = 1103.5, NY = 295.5;
bpImg.onload = function () {
  plane(strip(30, 495, 1420, 1715), function (px, py) { return [(py - YC) / SE, 0, -(px - X0) / SE]; }, 30, 495, 1420, 1715);
  plane(strip(1420, 495, 1900, 1715), function (px, py) { return [(py - YC) / SE, NAC_Z + (px - 1571) / SE, 1.2]; }, 1420, 495, 1900, 1715);
  plane(strip(30, 25, 1420, 470), function (px, py) { return [0, (NY - py) / SE, -(px - X0) / SE]; }, 30, 25, 1420, 470);
};
bpImg.src = window.MET_BP;

/* ---- dimensions */
function dims() {
  var b = new THREE.Box3(); center.updateMatrixWorld(true);
  var rot = pivot.rotation.x; pivot.rotation.x = 0; pivot.updateMatrixWorld(true);
  skinMeshes.forEach(function (m) { b.expandByObject(m); });
  pivot.rotation.x = rot;
  var len = b.max.z - b.min.z, span = b.max.x - b.min.x;
  return { len: len, span: span, rows: [['全長', len.toFixed(2)], ['全幅', span.toFixed(2)], ['全高(垂直尾翼上端)', (GROUND_Y + b.max.y).toFixed(2)], ['エンジン中心の間隔', (2 * NAC_LAT).toFixed(2)], ['主脚の間隔', (2 * GEAR_LAT).toFixed(2)]] };
}
function applyControls(c) {
  var d = Math.PI / 180;
  ctl.fl.forEach(function (h) { hingeRot(h, -c.flap * 45 * d); });
  ctl.ail.forEach(function (o) { hingeRot(o.h, (o.sg > 0 ? -1 : 1) * c.ail * 20 * d); });
  ctl.ele.forEach(function (h) { hingeRot(h, c.ele * 25 * d); });
  hingeRot(ctl.rud, c.rud * 25 * d);
  canopyGroup.position.z = -c.can * 0.85; canopyGroup.position.y = 0.04 * c.can;
}
return {
  id: 'meteor', applyControls: applyControls, has: { slat: false }, center: center, pivot: pivot, air: air, allMeshes: allMeshes, skinMeshes: skinMeshes, decals: decals, lineGroup: lineGroup,
  overlay: overlay, matGlass: matGlass, canopyGroup: canopyGroup, gearAnim: gearAnim, applyGear: applyGear, paint: paint, dims: dims,
  pitch: 0, groundY: GROUND_Y, flightY: 4.2, shadow: [13.5, 12], viewY: [1.6, 4.3],
  fit: { side: [14.0, 5.8], top: [14.0, 12.4], front: [12.4, 5.8] },
  cam: { pos: [-12.5, 3.6, 14.5], tgt: [0, 1.4, 0] },
  title: 'グロスター<br>ミーティア', sub: '三面図から起こした 3D モデル。塗装は第 616 飛行中隊(YQ-Y)の Dark Green / Ocean Grey、下面 Medium Sea Grey', hasProp: false,
  note: '全長 12.60 m を基準に三面図の縮尺を決め、胴体断面・主翼平面形・エンジンナセル・尾翼・風防の座標を画像から計測しています。「三面図を重ねる」で元の線画と見比べられます。',
  update: function (dt, st) {}
};
}
