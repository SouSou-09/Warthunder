/* ================================================================ FLIGHT (搭乗) */
/* 較正値: War Thunder (Realistic Battles・改造済み) の公表値に合わせた推力/抗力モデル
   p51 = P-51D-30(旋回 20.0 s・上昇 22.7 m/s・離陸滑走 396 m)
   me262 = Me 262 A-1a(旋回 28.0 s・上昇 20.0 m/s・離陸滑走 750 m)
   meteor = Meteor F Mk 3(旋回 20.0 s・上昇 22.5 m/s・離陸滑走 550 m)
   旋回時間は「フラップ(F)を出した最短の持続旋回」が公表値と一致するよう較正。
   A, B: 抗力 = A v^2 + B n^2 / v^2 (n=荷重倍数)。a0/Pm: レシプロ推力 = min(a0, Pm/v)、T0/T1: ジェット推力 = T0 + T1 v。
   vmax は海面最高速(推定)、vr は離陸速度、vs は 1G 失速速度、nlim は構造限界、roll は最大ロール率[deg/s]。 */
var FLYP = {
  p51:    { jet: false, a0: 4.180, Pm: 283.5, A: 5.716e-5, B: 3151, vmax: 166.7, vr: 55, vs: 44, nlim: 9, roll: 95 },
  me262:  { jet: true, T0: 2.582, T1: 0.000663, A: 5.517e-5, B: 3393, vmax: 219.4, vr: 58, vs: 50, nlim: 7, roll: 75 },
  meteor: { jet: true, T0: 2.702, T1: 0.007966, A: 1.0367e-4, B: 2264.5, vmax: 202.8, vr: 53, vs: 48, nlim: 8, roll: 60 }
};
var fly = {
  on: false, P: new THREE.Vector3(), psi: 0, th: 0, ph: 0, v: 0, thr: 0, thrE: 0, ground: true, gearAuto: true, flap: 0, flapT: 0, crashT: 0,
  keys: {}, stick: { x: 0, y: 0 }, inp: { p: 0, r: 0, y: 0 }, invert: false, camYaw: 0, camEl: 0, azOff: 0, elOff: 0, zoom: 1, drag: null,
  hudT: 0, msg: '', msgT: 0, saved: null, K: null, con: null
};
var FD = Math.PI / 180;
var fEul = new THREE.Euler(0, 0, 0, 'YXZ'), fR = new THREE.Matrix4(), fv = new THREE.Vector3(), fv2 = new THREE.Vector3();
function fAtt(psi, th, ph) { fEul.set(-th, psi, ph, 'YXZ'); return fR.makeRotationFromEuler(fEul); }
function fRot(c, out) { return out.copy(c).applyMatrix4(fR); }
function fClamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function fAngDiff(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function flyMsg(t, sec) { fly.msg = t; fly.msgT = sec || 3; var e = $('fly-msg'); e.textContent = t; e.hidden = !t; }

/* contact points / centre of gravity in the nose-tip body frame, measured from the neutral gear-down pose */
function flyMeasure() {
  var a = A, K = { pts: [], cg: new THREE.Vector3(), gr: new THREE.Vector3() };
  var sv = { cp: a.center.position.clone(), cr: a.center.rotation.clone(), pp: a.pivot.position.clone(), pr: a.pivot.rotation.clone() };
  a.center.rotation.set(0, 0, 0); a.pivot.rotation.set(-a.pitch, 0, 0); a.pivot.position.set(0, a.groundY, 0);
  a.applyGear(0); a.applyControls({ ail: 0, ele: 0, rud: 0, flap: 0, slat: 0, can: 0 });
  a.center.updateMatrixWorld(true);
  var inv = new THREE.Matrix4().copy(a.pivot.matrixWorld).invert();
  var bins = {}, v = new THREE.Vector3(), bb = new THREE.Box3(), mb = new THREE.Box3();
  a.allMeshes.forEach(function (m) {
    if (!m.isMesh) return;
    mb.setFromObject(m); if (mb.min.y > 0.3) return;
    var pos = m.geometry.attributes.position, i;
    for (i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y < 0.12) {
        v.applyMatrix4(inv);
        var key = Math.round(v.z / 0.9) + '_' + (v.x > 0.3 ? 1 : v.x < -0.3 ? -1 : 0);
        var b = bins[key] || (bins[key] = { s: new THREE.Vector3(), n: 0 }); b.s.add(v); b.n++;
      }
    }
  });
  Object.keys(bins).forEach(function (k) { var b = bins[k]; if (b.n >= 3) K.pts.push(b.s.clone().multiplyScalar(1 / b.n)); });
  if (!K.pts.length) K.pts.push(new THREE.Vector3(0, -a.groundY, -3));
  K.pts.forEach(function (p) { K.gr.add(p); }); K.gr.multiplyScalar(1 / K.pts.length); K.gr.x = 0;
  a.skinMeshes.forEach(function (m) { bb.expandByObject(m); });
  bb.getCenter(v); v.applyMatrix4(inv); K.cg.set(0, v.y, v.z);
  K.len = a.dimsInfo.len;
  a.center.position.copy(sv.cp); a.center.rotation.copy(sv.cr); a.pivot.position.copy(sv.pp); a.pivot.rotation.copy(sv.pr);
  a.center.updateMatrixWorld(true);
  return K;
}
function flyLow() {      // lowest contact height relative to the nose-tip origin (rotation already in fR)
  var low = 1e9, i, gu = state.gearUp || (A.gearAnim && A.gearAnim.v > 0.5);
  for (i = 0; i < fly.K.pts.length; i++) { fRot(fly.K.pts[i], fv); low = Math.min(low, fv.y + (gu ? 0.6 : 0)); }
  return low;
}
function flyReset() {
  var F = fly, p = FLYP[state.ac];
  F.psi = 0; F.ph = 0; F.v = 0; F.thr = 0; F.thrE = 0; F.stallMsg = false; F.ground = true; F.gearAuto = true; F.flap = 0; F.flapT = 0; F.crashT = 0;
  F.inp.p = F.inp.r = F.inp.y = 0; F.camYaw = 0; F.camEl = 0;
  F.th = A.pitch; fAtt(0, F.th, 0);
  F.P.set(0, 0, F.saved.cpos.z); F.P.y = -flyLow();
  if (state.gearUp) setGearTarget(false);
  A.gearAnim.v = A.gearAnim.target = 0; A.applyGear(0);
  Object.keys(state.ctl).forEach(function (k) { state.ctl[k] = 0; });
  flyMsg('W キーでスロットルを上げて滑走、速度が付いたら ↓ キーで離陸', 6);
}
function flyBoard() {
  if (fly.on || !base) return;
  if (state.view !== 'free') setView('free');
  state.demo = false; $('t-demo').setAttribute('aria-checked', 'false');
  fly.saved = { cpos: A.center.position.clone(), crot: A.center.rotation.clone(), ppos: A.pivot.position.clone(), prot: A.pivot.rotation.clone(), spin: state.spin, fov: persp.fov };
  fly.K = flyMeasure();
  fly.on = true; controls.enabled = false; controls.autoRotate = false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  A.overlay.visible = false;
  A.center.rotation.order = 'YXZ';
  A.pivot.position.set(0, 0, 0); A.pivot.rotation.set(0, 0, 0);
  state.poseT = 0; state.pose = 'ground';
  flyReset();
  $('b-board').textContent = '降りる'; $('b-board').setAttribute('aria-pressed', 'true');
  $('fly-hud').hidden = false; $('fly-home').hidden = false;
  $('touch').hidden = !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  document.body.classList.add('flying');
  syncUI();
}
function flyExit(silent) {
  if (!fly.on) return;
  fly.on = false; controls.enabled = true;
  var s = fly.saved;
  A.center.rotation.set(0, 0, 0); A.center.position.copy(s.cpos); A.pivot.position.copy(s.ppos); A.pivot.rotation.copy(s.prot);
  state.spin = s.spin; shadow.rotation.set(-Math.PI / 2, 0, 0);
  A.overlay.visible = state.bp;
  Object.keys(state.ctl).forEach(function (k) { state.ctl[k] = 0; });
  setGearTarget(false); A.gearAnim.v = A.gearAnim.target = 0; A.applyGear(0);
  applyPose(state.poseT);
  persp.fov = s.fov; persp.updateProjectionMatrix();
  $('b-board').textContent = '搭乗'; $('b-board').setAttribute('aria-pressed', 'false');
  $('fly-hud').hidden = true; $('fly-home').hidden = true; $('fly-msg').hidden = true; $('touch').hidden = true;
  document.body.classList.remove('flying');
  fly.keys = {}; fly.stick.x = fly.stick.y = 0;
  if (base) base.follow(0, 0);
  if (!silent) { setCam('runway'); resize(); syncUI(); }
  syncCtlUI();
}
function flyCrash(why) {
  fly.crashT = 2.4; fly.v = 0; fly.thr = 0; flyMsg(why + ' — 自動でやり直します (R)', 2.4);
}
function flyUpdate(dt, now) {
  var F = fly, p = FLYP[state.ac], P = F.P, K = F.K, i;
  dt = Math.min(dt, 0.05);
  if (F.msgT > 0) { F.msgT -= dt; if (F.msgT <= 0) { $('fly-msg').hidden = true; } }
  if (F.crashT > 0) { F.crashT -= dt; if (F.crashT <= 0) flyReset(); }
  var k = F.keys;
  var pt = ((k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0)) + F.stick.y;
  var rt = ((k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0)) + F.stick.x;
  var yt = (k.KeyD || k.KeyE ? 1 : 0) - (k.KeyA || k.KeyQ ? 1 : 0);
  if (F.invert) pt = -pt;
  pt = fClamp(pt, -1, 1); rt = fClamp(rt, -1, 1);
  var sm = Math.min(1, dt * 7);
  F.inp.p += (pt - F.inp.p) * sm; F.inp.r += (rt - F.inp.r) * sm; F.inp.y += (yt - F.inp.y) * sm;
  if (k.KeyW || k.ShiftLeft || k.ShiftRight) F.thr = Math.min(1, F.thr + dt * 0.45);
  if (k.KeyS || k.ControlLeft || k.ControlRight) F.thr = Math.max(0, F.thr - dt * 0.55);
  if (F.crashT > 0) { F.inp.p = F.inp.r = F.inp.y = 0; }
  var stall = p.vs * (1 - 0.18 * F.flap);
  var vlo = p.vr * (1 - 0.1 * F.flap);
  // reference point: contact centroid on the ground, CG in the air
  var cref = F.ground ? K.gr : K.cg;
  fAtt(F.psi, F.th, F.ph); fRot(cref, fv); var pref = new THREE.Vector3().copy(P).add(fv);
  if (F.crashT <= 0) {
    // --- 推力・抗力・荷重倍数モデル(FLYP の較正値を使用) ---
    F.thrE += (F.thr - F.thrE) * Math.min(1, dt / (p.jet ? 1.8 : 0.6));
    var hAlt = Math.max(0, P.y);
    var altF = hAlt < 6000 ? 1 : Math.max(0, 1 - (hAlt - 6000) / 6500);
    var aT = (p.jet ? p.T0 + p.T1 * F.v : Math.min(p.a0, p.Pm / Math.max(F.v, 1))) * F.thrE * altF;
    var gdn = (state.gearUp || A.gearAnim.v > 0.5) ? 1 : 1.25;
    var dragK = p.A * gdn * (1 + 0.8 * F.flap);
    var brk = (k.KeyB || k.Space) ? 1 : 0;
    var auth = F.ground ? fClamp((F.v - 25) / (vlo * 0.7), 0, 1) : fClamp((F.v - stall * 0.55) / (stall * 0.75), 0, 1);
    var restTh = A.pitch * (1 - fClamp((F.v - 8) / (0.55 * p.vr), 0, 1));
    if (F.ground) {
      F.v = Math.max(0, F.v + (aT - dragK * F.v * F.v - (F.v > 0.3 ? 0.025 * 9.81 : 0) - brk * 7.5) * dt);
      var thT = restTh;
      if (F.inp.p > 0.05 && F.v > vlo * 0.85) thT = Math.max(restTh, F.inp.p * 15 * FD);
      else if (F.inp.p < -0.05) thT = Math.min(restTh, 0);
      F.th += (thT - F.th) * Math.min(1, dt * (thT > F.th ? 2.2 : 3));
      F.ph *= 1 - Math.min(1, dt * 6);
      var steer = (F.inp.y + 0.7 * F.inp.r) * 28 * FD * fClamp(F.v / 6, 0, 1) * (1 - 0.6 * fClamp(F.v / 60, 0, 1));
      F.psi -= steer * dt;
      if (F.v > vlo && F.th > 4.5 * FD) { F.ground = false; flyMsg('', 0); }
    } else {
      var vq = Math.max(F.v, 30), cgm = Math.cos(F.th), cph = Math.cos(F.ph), sph = Math.sin(F.ph);
      var nMax = Math.min(p.nlim, (F.v / stall) * (F.v / stall));          // 失速と構造で決まる荷重倍数の上限
      var nT = cgm / Math.max(cph, 0.17), pp = F.inp.p;                    // nT: 今の経路角を保つのに要る荷重倍数
      var nn = pp >= 0 ? nT + pp * Math.max(nMax - nT, 0) : nT + pp * (nT + 0.5);
      nn = fClamp(nn, -1, nMax);
      F.v = Math.max(0, F.v + (aT - dragK * F.v * F.v - p.B * nn * nn / (vq * vq) - 9.81 * Math.sin(F.th) - brk * 4) * dt);
      F.th += (9.81 / vq) * (nn * cph - cgm) * dt;
      if (F.v < stall) { F.th -= 20 * FD * (1 - F.v / stall) * dt; if (!F.stallMsg) { F.stallMsg = true; flyMsg('失速！ 機首を下げて加速', 2); } }
      else F.stallMsg = false;
      F.th = fClamp(F.th, -80 * FD, 80 * FD);
      var stiff = 1 - 0.45 * fClamp((F.v - 120) / Math.max(p.vmax - 120, 1), 0, 1);
      F.ph += F.inp.r * p.roll * FD * auth * stiff * dt;
      if (Math.abs(F.inp.r) < 0.05) F.ph -= F.ph * Math.min(1, dt * 0.9);
      F.ph = fClamp(F.ph, -82 * FD, 82 * FD);
      F.psi -= (9.81 / vq) * nn * sph / Math.max(Math.cos(F.th), 0.25) * dt + F.inp.y * 8 * FD * auth * dt;
    }
    // gear automation
    var altNow = P.y + (function () { fAtt(F.psi, F.th, F.ph); fRot(K.cg, fv2); return fv2.y; })();
    var climbing = F.v * Math.sin(F.th) > 0.5;
    if (F.gearAuto && !F.ground) {
      if (!state.gearUp && altNow > 28 && climbing) { setGearTarget(true); }
      else if (state.gearUp && altNow < 18 && !climbing) { setGearTarget(false); }
    }
    // flaps
    F.flap += (F.flapT - F.flap) * Math.min(1, dt * 2.5);
    state.ctl.flap = F.flap;
  }
  state.ctl.ail = F.inp.r; state.ctl.ele = F.inp.p * (F.invert ? -1 : 1) * (F.invert ? 1 : 1); state.ctl.rud = F.inp.y;
  state.ctl.ele = F.invert ? -F.inp.p : F.inp.p;
  state.spin = A.hasProp && F.thr > 0.03;
  // integrate position about the reference point
  fAtt(F.psi, F.th, F.ph);
  var fwd = fv2.set(Math.sin(F.psi) * Math.cos(F.th), Math.sin(F.th), Math.cos(F.psi) * Math.cos(F.th));
  if (F.ground) pref.x += Math.sin(F.psi) * F.v * dt, pref.z += Math.cos(F.psi) * F.v * dt;
  else pref.addScaledVector(fwd, F.v * dt);
  fRot(cref, fv); P.copy(pref).sub(fv);
  fAtt(F.psi, F.th, F.ph);
  var low = flyLow();
  if (F.ground) { P.y = -low; }
  else if (F.crashT <= 0 && P.y + low < 0) {
    var sink = -F.v * Math.sin(F.th), gu = state.gearUp || A.gearAnim.v > 0.5;
    if (gu) flyCrash('胴体着陸');
    else if (sink > 7.5) flyCrash('強く接地しすぎ');
    else if (Math.abs(F.ph) > 18 * FD) flyCrash('翼端が接地');
    else if (F.th < -9 * FD) flyCrash('機首から接地');
    else { F.ground = true; F.gearAuto = true; P.y = -low; flyMsg('接地', 1.2); }
  }
  // lights, shadow, ground follow
  A.center.position.copy(P); A.center.rotation.set(-F.th, F.psi, F.ph, 'YXZ');
  fRot(K.cg, fv); var cgy = P.y + fv.y, cgx = P.x + fv.x, cgz = P.z + fv.z;
  shadow.position.set(cgx, 0.02, cgz); shadow.rotation.z = F.psi;
  var sc = 1 - fClamp(cgy / 160, 0, 0.5);
  shadow.scale.set(A.shadow[0] * sc, A.shadow[1] * sc, 1);
  shadow.material.opacity = 0.7 * (1 - fClamp(cgy / 120, 0, 0.85));
  base.follow(cgx, cgz - base.ORIGIN_Z * -1 * 0 - 380);
  // chase camera
  var L = K.len;
  F.camYaw += fAngDiff(F.psi - F.camYaw) * Math.min(1, dt * 3);
  F.camEl += (F.th * 0.4 - F.camEl) * Math.min(1, dt * 2.2);
  if (!F.drag) { F.azOff *= 1 - Math.min(1, dt * 1.6); F.elOff *= 1 - Math.min(1, dt * 1.6); }
  var d = L * 1.7 * F.zoom, az = F.camYaw + F.azOff, el = 0.2 + F.camEl + F.elOff;
  var cp = fv.set(cgx - Math.sin(az) * Math.cos(el) * d, cgy + Math.sin(el) * d + 0.8, cgz - Math.cos(az) * Math.cos(el) * d);
  cp.y = Math.max(cp.y, 1.2);
  persp.position.copy(cp);
  fAtt(F.psi, F.th, F.ph);
  persp.lookAt(cgx + Math.sin(F.psi) * L * 0.5, cgy + 0.7 + Math.sin(F.th) * L * 0.5, cgz + Math.cos(F.psi) * L * 0.5);
  var fovT = 32 + 9 * fClamp(F.v / p.vmax, 0, 1);
  if (Math.abs(persp.fov - fovT) > 0.05 && stage.clientWidth / stage.clientHeight >= 1.45) { persp.fov += (fovT - persp.fov) * Math.min(1, dt * 3); persp.updateProjectionMatrix(); }
  // HUD
  F.hudT -= dt;
  if (F.hudT <= 0) {
    F.hudT = 0.08;
    $('fh-spd').textContent = Math.round(F.v * 3.6);
    $('fh-alt').textContent = Math.max(0, Math.round(cgy - (F.ground ? cgy : 0) + (F.ground ? 0 : 0)));
    var hdg = ((90 - F.psi / FD) % 360 + 360) % 360;   // east = 090
    hdg = ((90 - (F.psi / FD)) % 360 + 360) % 360;
    $('fh-hdg').textContent = String(Math.round(hdg)).padStart(3, '0');
    $('fh-thr').textContent = Math.round(F.thr * 100);
    $('fh-gear').textContent = '脚 ' + ((state.gearUp || A.gearAnim.v > 0.5) ? '上げ' : '下げ');
    $('fh-flap').textContent = 'フラップ ' + Math.round(F.flapT * 100) + '%';
    $('t-thr-fill').style.height = Math.round(F.thr * 100) + '%';
    var bx = -(cgz - 380 * 0), bz = 0;
    var tx = 0 - cgx, tz = (-380 + 0 + 380 * 0) - cgz + 380 * 0;
    var dx = 0 - cgx, dz = 380 + 0 - cgz;     // base centre (local 0,0) is at world z = 380
    dz = 380 - cgz;
    var dist = Math.hypot(dx, dz), brg = Math.atan2(dx, dz);                 // direction as heading-angle (0 = +z)
    var rel = fAngDiff(brg - F.psi);                                         // + = left
    $('fh-arrow').style.transform = 'rotate(' + (-rel / FD) + 'deg)';
    $('fh-dist').textContent = dist > 1000 ? '基地 ' + (dist / 1000).toFixed(1) + ' km' : '基地 ' + Math.round(dist) + ' m';
    $('fh-alt').textContent = Math.max(0, Math.round(cgy));
  }
}
function flyKey(e, down) {
  if (!fly.on) return;
  var c = e.code;
  var handled = true;
  if (down) {
    if (c === 'Escape' || c === 'KeyX') { flyExit(); }
    else if (c === 'KeyR') { flyReset(); }
    else if (c === 'KeyG' && !e.repeat) { fly.gearAuto = false; setGearTarget(!state.gearUp); }
    else if (c === 'KeyF' && !e.repeat) { fly.flapT = fly.flapT > 0.7 ? 0 : fly.flapT + 0.5; }
    else if (c === 'KeyC' && !e.repeat) { fly.zoom = fly.zoom > 1.9 ? 0.6 : fly.zoom + 0.6; }
    else handled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyB', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'].indexOf(c) >= 0;
    fly.keys[c] = true;
  } else { fly.keys[c] = false; handled = (c === 'Space'); }
  if (handled) e.preventDefault();
}
window.addEventListener('keydown', function (e) { flyKey(e, true); });
window.addEventListener('keyup', function (e) { flyKey(e, false); });
window.addEventListener('blur', function () { fly.keys = {}; });
$('b-board').addEventListener('click', function () { if (fly.on) flyExit(); else flyBoard(); });
bindSwitch('t-invert', function (v) { fly.invert = v; });
/* camera drag / zoom while flying */
canvas.addEventListener('pointerdown', function (e) { if (!fly.on) return; fly.drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', function (e) {
  if (!fly.on || !fly.drag) return;
  fly.azOff -= (e.clientX - fly.drag.x) * 0.006; fly.elOff = fClamp(fly.elOff + (e.clientY - fly.drag.y) * 0.006, -0.5, 1.1);
  fly.drag.x = e.clientX; fly.drag.y = e.clientY;
});
canvas.addEventListener('pointerup', function () { fly.drag = null; });
canvas.addEventListener('pointercancel', function () { fly.drag = null; });
canvas.addEventListener('wheel', function (e) { if (!fly.on) return; fly.zoom = fClamp(fly.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.4, 4); e.preventDefault(); }, { passive: false });
/* touch controls */
(function () {
  var st = $('t-stick'), kn = $('t-knob'), th = $('t-thr');
  function stickMove(e) {
    var r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    var dx = fClamp((e.clientX - cx) / R, -1, 1), dy = fClamp((e.clientY - cy) / R, -1, 1);
    fly.stick.x = dx; fly.stick.y = dy; kn.style.transform = 'translate(' + dx * R * 0.55 + 'px,' + dy * R * 0.55 + 'px)';
  }
  st.addEventListener('pointerdown', function (e) { st.setPointerCapture(e.pointerId); stickMove(e); });
  st.addEventListener('pointermove', function (e) { if (st.hasPointerCapture(e.pointerId)) stickMove(e); });
  function stickEnd() { fly.stick.x = fly.stick.y = 0; kn.style.transform = ''; }
  st.addEventListener('pointerup', stickEnd); st.addEventListener('pointercancel', stickEnd);
  function thrMove(e) { var r = th.getBoundingClientRect(); fly.thr = fClamp(1 - (e.clientY - r.top) / r.height, 0, 1); }
  th.addEventListener('pointerdown', function (e) { th.setPointerCapture(e.pointerId); thrMove(e); });
  th.addEventListener('pointermove', function (e) { if (th.hasPointerCapture(e.pointerId)) thrMove(e); });
  document.querySelectorAll('[data-fk]').forEach(function (b) {
    function on(e) { var m = { g: 'KeyG', f: 'KeyF', b: 'KeyB', x: 'KeyX', r: 'KeyR' }[b.getAttribute('data-fk')]; flyKey({ code: m, repeat: false, preventDefault: function () {} }, true); e.preventDefault(); }
    function off() { var m = { b: 'KeyB' }[b.getAttribute('data-fk')]; if (m) fly.keys[m] = false; }
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off);
  });
})();
