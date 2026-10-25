src = open('/home/claude/p51/app_mustang_only.js').read()
i0 = src.index('/* ------------------------------------------------------------- hierarchy */')
k = src.index('bpImg.src = window.P51_BP;'); i1 = src.index('\n', k)
head = src[:i0].rstrip('\n').split('\n')
must = src[i0:i1].split('\n')
me = open('/home/claude/me262/me262.js').read()
met = open('/home/claude/meteor/meteor.js').read()
ab = open('/home/claude/airbase/airbase.js').read()
fl = open('/home/claude/p51/fly.js').read()

must_open = ['/* ================================================================ P-51D */', 'function buildMustang() {']
must_close = '''
function dims() {
  center.updateMatrixWorld(true);
  var rot = pivot.rotation.x; pivot.rotation.x = 0; pivot.updateMatrixWorld(true);
  var b = new THREE.Box3();
  skinMeshes.forEach(function (m) { b.expandByObject(m); });
  var len = b.max.z - b.min.z, span = b.max.x - b.min.x;
  var pb = new THREE.Box3().setFromObject(propGroup), dia = pb.max.y - pb.min.y;
  pivot.rotation.x = rot;
  return { len: len, span: span, rows: [['全長', len.toFixed(2)], ['全幅', span.toFixed(2)], ['全高(プロペラ上端)', (HUB_H + dia / 2).toFixed(2)], ['プロペラ直径', dia.toFixed(2)], ['主脚の間隔', (2 * 1.79).toFixed(2)]] };
}
function applyControls(c) {
  var d = Math.PI / 180;
  [1, -1].forEach(function (sg) {
    hingeRot(ctl['flap' + sg], -c.flap * 50 * d);
    hingeRot(ctl['ail' + sg], (sg > 0 ? -1 : 1) * c.ail * 20 * d);
    hingeRot(ctl['ele' + sg], c.ele * 25 * d);
  });
  hingeRot(ctl.rud, c.rud * 25 * d);
  canopyGroup.position.z = -c.can * 0.95;
}
var decalProxy = { get visible() { return decals.visible; }, set visible(v) { decals.visible = v; rudderDecals.visible = v; } };
return {
  id: 'p51', applyControls: applyControls, has: { slat: false }, center: center, pivot: pivot, air: air, allMeshes: allMeshes, skinMeshes: skinMeshes, decals: decalProxy, lineGroup: lineGroup,
  overlay: overlay, matGlass: matGlass, canopyGroup: canopyGroup, gearAnim: gearAnim, applyGear: applyGear, paint: paint, dims: dims,
  pitch: PHI, groundY: HUB_H, flightY: 4.4, shadow: [11, 12], viewY: [2.0, 4.0],
  fit: { side: [12.2, 6.5], top: [12.2, 11], front: [13, 6.5] },
  cam: { pos: [-9.5, 4.6, 12.5], tgt: [0, 2, 0] },
  title: 'P-51D<br>マスタング', sub: '三面図から起こした 3D モデル。塗装は写真の B7-R「TIKA IV」仕様', hasProp: true,
  note: '全長 9.83 m を基準に三面図の縮尺を決め、胴体断面・主翼平面形・尾翼・風防・プロペラの座標を画像から計測しています。「三面図を重ねる」で元の線画と見比べられます。',
  update: function (dt, spd) { propGroup.rotation.z += spd * dt; }
};
}
'''.split('\n')

tail = r'''
/* ------------------------------------------------------------------- state + UI */
var builders = { p51: buildMustang, me262: buildMe262, meteor: buildMeteor };
var AC_NAME = { p51: 'P-51D マスタング', me262: 'Me 262 シュヴァルベ', meteor: 'グロスター ミーティア' };
var fleet = {}, A = null;
var state = { ac: 'p51', bg: 'grid', view: 'free', pose: 'ground', poseT: 0, op: 1, spin: false, wire: false, lines: true, marks: true, bp: false, auto: false, gearUp: false, demo: false, ctl: { ail: 0, ele: 0, rud: 0, flap: 0, slat: 0, can: 0 } };
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var spinSpeed = 0;
var VIEWS = {
  free: null,
  top: { dir: [0, 1, 0], up: [1, 0, 0] },
  side: { dir: [1, 0, 0], up: [0, 1, 0] },
  front: { dir: [0, 0, 1], up: [0, 1, 0] }
};
var ppm = 36, fixedPpm = false;
function $(id) { return document.getElementById(id); }
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
    if (!fixedPpm) { var f = A.fit[v]; ppm = Math.max(12, Math.min(stage.clientWidth / f[0], stage.clientHeight / f[1])); }
    var tgt = new THREE.Vector3(0, A.viewY[state.poseT > 0.5 ? 1 : 0], 0);
    controls.target.copy(tgt);
    ortho.up.set(spec.up[0], spec.up[1], spec.up[2]);
    ortho.position.set(tgt.x + spec.dir[0] * 40, tgt.y + spec.dir[1] * 40, tgt.z + spec.dir[2] * 40);
    ortho.zoom = 1;
    fitOrtho();
    ortho.lookAt(tgt);
  }
  applyBg();
  controls.update();
  syncUI();
}
var base = null;
function ensureBase() {
  if (!base) { base = buildAirbase({ builders: builders, scene: scene, renderer: renderer, groundSrc: window.P51_GROUND, region: window.WB_REGION, regionSrc: window.WB_REGION_TEX, forestSrc: window.WB_FOREST }); scene.add(base.root); }
  return base;
}
function applyBg() {
  var on = state.bg === 'base' && state.view === 'free';
  if (on) ensureBase();
  if (base) base.setVisible(on);
  scene.fog = on ? base.fog : null;
  grid.visible = !on;
  renderer.toneMappingExposure = on ? 0.8 : 1.0;
  persp.near = on ? 0.3 : 0.1; persp.far = on ? 12000 : 300; persp.updateProjectionMatrix();
  controls.maxDistance = on ? 5200 : 60;
  $('sec-cam').hidden = !on;
  $('row-park').hidden = !on;
  $('sec-fly').hidden = !on;
  if (!on && fly.on) flyExit(true);
  document.querySelectorAll('[data-bg]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-bg') === state.bg)); });
}
var CAMS = {
  model: function () { return { p: A.cam.pos, t: A.cam.tgt }; },
  runway: function () { return { p: [-9, 3.4, -26], t: [0, 2.2, 70] }; },
  front: function () { return { p: [-11, 2.6, 48], t: [0, 2.0, 0] }; },
  aerial: function () { return { p: [-1250, 820, 120], t: [0, 0, 420] }; },
  region: function () { return { p: [-3300, 2300, 600], t: [-200, 0, 700] }; }
};
function setCam(k) {
  var c = CAMS[k](); persp.position.set(c.p[0], c.p[1], c.p[2]); controls.target.set(c.t[0], c.t[1], c.t[2]);
  state.cam = k; controls.update();
  document.querySelectorAll('[data-cam]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cam') === k)); });
}
function setBg(v) {
  var was = state.bg; state.bg = v;
  if (v === 'base' && state.view !== 'free') { setView('free'); }
  applyBg();
  if (v === 'base' && was !== 'base') setCam('runway');
  if (v === 'grid' && was === 'base') setCam('model');
  syncUI();
}
function applyPose(t) {
  A.pivot.rotation.x = -A.pitch * (1 - t);
  A.pivot.position.y = A.groundY + (A.flightY - A.groundY) * t;
  var sc = 1 - 0.55 * t;
  shadow.scale.set(A.shadow[0] * sc, A.shadow[1] * sc, 1);
  shadow.material.opacity = 0.7 * (1 - 0.5 * t);
  shadow.position.set(0, 0.01, 0);
}
function setGearTarget(up) { state.gearUp = up; A.gearAnim.target = up ? 1 : 0; }
function setPose(p, withGear) {
  state.pose = p;
  if (withGear) setGearTarget(p === 'flight');
  syncUI();
}
function setOpacity(v) {
  state.op = v;
  A.allMeshes.forEach(function (m) {
    var mat = m.material;
    var base = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity : 1;
    if (mat.userData.t0 === undefined) { mat.userData.t0 = mat.transparent; mat.userData.dw0 = mat.depthWrite; }
    mat.transparent = mat.userData.t0 || base < 1 || v < 1;
    mat.opacity = base * v;
    mat.depthWrite = mat.userData.dw0 && v >= 1 && base >= 1;
  });
}
function setWire(f) {
  state.wire = f;
  var seen = [];
  A.allMeshes.forEach(function (m) { var mat = m.material; if (seen.indexOf(mat) < 0) { seen.push(mat); mat.wireframe = f && mat !== A.matGlass; } });
}
function syncUI() {
  document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view)); });
  document.querySelectorAll('[data-pose]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-pose') === state.pose)); });
  document.querySelectorAll('[data-ac]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ac') === state.ac)); });
  [['t-bp', state.bp], ['t-wire', state.wire], ['t-lines', state.lines], ['t-marks', state.marks], ['t-gear', !state.gearUp], ['t-spin', state.spin], ['t-auto', state.auto], ['t-park', state.park !== false], ['t-invert', fly.invert]].forEach(function (p) {
    var el = $(p[0]); if (el) el.setAttribute('aria-checked', String(!!p[1]));
  });
  var names = { free: '自由視点', top: '上面', side: '側面', front: '正面' };
  $('hud-view').textContent = names[state.view];
  $('op-val').textContent = Math.round(state.op * 100) + '%';
}
var CTL_UI = [
  ['ail', 'c-ail', 'v-ail', function (v) { return (v >= 0 ? '右 ' : '左 ') + Math.abs(Math.round(v * 20)) + '°'; }, true],
  ['ele', 'c-ele', 'v-ele', function (v) { return (v >= 0 ? '上げ ' : '下げ ') + Math.abs(Math.round(v * 25)) + '°'; }, true],
  ['rud', 'c-rud', 'v-rud', function (v) { return (v >= 0 ? '右 ' : '左 ') + Math.abs(Math.round(v * 25)) + '°'; }, true],
  ['flap', 'c-flap', 'v-flap', function (v) { return Math.round(v * (state.ac === 'p51' ? 50 : 45)) + '°'; }, false],
  ['slat', 'c-slat', 'v-slat', function (v) { return Math.round(v * 100) + '%'; }, false],
  ['can', 'c-can', 'v-can', function (v) { return Math.round(v * 100) + '%'; }, false]
];
function syncCtlUI() {
  CTL_UI.forEach(function (c) {
    var v = state.ctl[c[0]];
    $(c[1]).value = Math.round(v * 100);
    $(c[2]).textContent = c[3](v);
  });
  $('t-demo').setAttribute('aria-checked', String(state.demo));
}
CTL_UI.forEach(function (c) {
  $(c[1]).addEventListener('input', function () {
    state.ctl[c[0]] = parseInt($(c[1]).value, 10) / 100;
    if (state.demo) state.demo = false;
    syncCtlUI();
  });
});
$('t-demo').addEventListener('click', function () { state.demo = !state.demo; syncCtlUI(); });
$('ctl-reset').addEventListener('click', function () { state.demo = false; Object.keys(state.ctl).forEach(function (k) { state.ctl[k] = 0; }); syncCtlUI(); });
function useAircraft(id) {
  if (fly.on) flyExit(true);
  if (!fleet[id]) { var a = builders[id](); fleet[id] = a; a.paint(); a.dimsInfo = a.dims(); }
  Object.keys(fleet).forEach(function (k) { fleet[k].center.visible = (k === id); });
  A = fleet[id]; state.ac = id;
  A.decals.visible = state.marks; A.lineGroup.visible = state.lines; A.overlay.visible = state.bp;
  if (!A.hasProp) { state.spin = false; spinSpeed = 0; }
  $('row-spin').hidden = !A.hasProp;
  setOpacity(state.op); setWire(state.wire);
  $('row-slat').hidden = !A.has.slat; if (!A.has.slat) state.ctl.slat = 0;
  $('l-can').textContent = id === 'me262' ? 'キャノピー(右へ開く)' : 'キャノピー(後方へスライド)';
  A.applyControls(state.ctl); syncCtlUI();
  A.gearAnim.v = A.gearAnim.target = state.gearUp ? 1 : 0; A.applyGear(A.gearAnim.v);
  applyPose(state.poseT);
  $('title').innerHTML = A.title + '<small>' + A.sub + '</small>';
  $('note').textContent = A.note;
  $('dims').innerHTML = A.dimsInfo.rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd><b>' + r[1] + '</b> m</dd>'; }).join('');
  $('hud-len').textContent = 'L ' + A.dimsInfo.len.toFixed(2) + ' m';
  canvas.setAttribute('aria-label', AC_NAME[id] + 'の3Dモデル');
  if (state.view === 'free') {
    if (state.bg === 'base' && state.cam && state.cam !== 'model') setCam(state.cam);
    else {
      persp.position.set(A.cam.pos[0], A.cam.pos[1], A.cam.pos[2]);
      controls.target.set(A.cam.tgt[0], A.cam.tgt[1], A.cam.tgt[2]);
      controls.update();
    }
    syncUI();
  } else setView(state.view);
}
document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
document.querySelectorAll('[data-bg]').forEach(function (b) { b.addEventListener('click', function () { setBg(b.getAttribute('data-bg')); }); });
document.querySelectorAll('[data-cam]').forEach(function (b) { b.addEventListener('click', function () { setCam(b.getAttribute('data-cam')); }); });
document.querySelectorAll('[data-pose]').forEach(function (b) { b.addEventListener('click', function () { setPose(b.getAttribute('data-pose'), true); if (state.view !== 'free') setView(state.view); }); });
document.querySelectorAll('[data-ac]').forEach(function (b) { b.addEventListener('click', function () { useAircraft(b.getAttribute('data-ac')); }); });
function bindSwitch(id, fn) { $(id).addEventListener('click', function () { fn($(id).getAttribute('aria-checked') !== 'true'); syncUI(); }); }
bindSwitch('t-bp', function (v) { state.bp = v; A.overlay.visible = v; if (v && state.op > 0.6) { $('op').value = 45; setOpacity(0.45); } if (!v) { $('op').value = 100; setOpacity(1); } });
bindSwitch('t-wire', setWire);
bindSwitch('t-marks', function (v) { state.marks = v; A.decals.visible = v; });
bindSwitch('t-lines', function (v) { state.lines = v; A.lineGroup.visible = v; });
bindSwitch('t-gear', function (v) { setGearTarget(!v); });
bindSwitch('t-spin', function (v) { state.spin = v; });
bindSwitch('t-park', function (v) { state.park = v; if (base) base.parked(v); });
bindSwitch('t-auto', function (v) { state.auto = v; controls.autoRotate = v && state.view === 'free'; controls.autoRotateSpeed = 1.2; });
$('op').addEventListener('input', function () { setOpacity(parseInt($('op').value, 10) / 100); syncUI(); });

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
  persp.fov = Math.min(80, 2 * Math.atan(Math.tan(hf / 2) / Math.max(asp, 0.2)) * 180 / Math.PI);
  if (asp >= 1.45) persp.fov = 32;
  persp.updateProjectionMatrix();
  fitOrtho();
}
new ResizeObserver(resize).observe(stage);
useAircraft('p51');
resize(); readTheme(); syncUI();
if (reduce) { state.auto = false; }

var last = performance.now();
function frame(now) {
  var dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (fly.on) flyUpdate(dt, now);
  var tgt = state.pose === 'flight' ? 1 : 0;
  state.poseT += (tgt - state.poseT) * Math.min(1, dt * 4);
  if (Math.abs(tgt - state.poseT) < 0.002) state.poseT = tgt;
  if (!fly.on) applyPose(state.poseT);
  var g = A.gearAnim;
  g.v += (g.target - g.v) * Math.min(1, dt * 5);
  if (Math.abs(g.target - g.v) < 0.003) g.v = g.target;
  A.applyGear(g.v);
  if (state.demo) {
    var tt = now / 1000, c = state.ctl;
    c.ail = Math.sin(tt * 1.3); c.ele = Math.sin(tt * 0.9 + 1); c.rud = Math.sin(tt * 0.7 + 2);
    c.flap = 0.5 + 0.5 * Math.sin(tt * 0.6); c.slat = c.flap; c.can = 0.5 - 0.5 * Math.cos(tt * 0.4);
    if (!A.has.slat) c.slat = 0;
    syncCtlUI();
  }
  A.applyControls(state.ctl);
  var ts = state.spin ? 22 : 0;
  spinSpeed += (ts - spinSpeed) * Math.min(1, dt * 3);
  A.update(dt, spinSpeed);
  controls.autoRotate = state.auto && state.view === 'free' && !reduce;
  if (!fly.on) controls.update();
  if (base) base.update(persp.position);
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* test hook */
window.__p51 = {
  setView: setView, setAircraft: useAircraft, setCtl: function (o) { Object.keys(o).forEach(function (k) { state.ctl[k] = o[k]; }); state.demo = false; syncCtlUI(); A.applyControls(state.ctl); },
  setPose: function (p) { state.pose = p; state.poseT = p === 'flight' ? 1 : 0; applyPose(state.poseT); setGearTarget(p === 'flight'); A.gearAnim.v = A.gearAnim.target; A.applyGear(A.gearAnim.v); },
  setPpm: function (v) { ppm = v; fixedPpm = true; fitOrtho(); }, state: state, scene: scene, renderer: renderer, ortho: ortho, controls: controls, persp: persp,
  flat: function (on) {
    A.allMeshes.forEach(function (m) { if (on) { m.userData.mat0 = m.material; m.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }); } else if (m.userData.mat0) m.material = m.userData.mat0; });
    scene.background = on ? new THREE.Color(0xffffff) : null; grid.visible = !on; shadow.visible = !on; A.lineGroup.visible = !on && state.lines; A.canopyGroup.visible = true;
  },
  fly: fly, board: flyBoard, exit: flyExit,
  setBg: setBg, setCam: setCam, get base() { return base; },
  setGear: function (v) { setGearTarget(v > 0.5); A.gearAnim.v = A.gearAnim.target = v; A.applyGear(v); },
  get A() { return A; }
};
})();
'''.split('\n')
tail_txt = '\n'.join(tail); k = tail_txt.index("useAircraft('p51');\nresize();"); tail_txt = tail_txt[:k] + fl + '\n' + tail_txt[k:]
open('/home/claude/p51/app.js','w').write('\n'.join(head + must_open + must + must_close + me.split('\n') + met.split('\n') + ab.split('\n') + tail_txt.split('\n')))
