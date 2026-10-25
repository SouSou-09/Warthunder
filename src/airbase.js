/* ================================================================ AIR BASE */
function buildAirbase(env) {
  var SC = 0.8;                         // metres per map pixel
  var MW = 1536, MH = 1024;
  var ORIGIN_Z = -380;                  // local z that sits at world z = 0 (aircraft start on the runway)
  function wx(py) { return (480 - py) * SC; }   // north (map up) = +x
  function wz(px) { return (px - 770) * SC; }   // east  (map right) = +z
  var root = new THREE.Group();
  root.position.z = -ORIGIN_Z;
  var aniso = Math.min(8, env.renderer.capabilities.getMaxAnisotropy());
  function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function rnd(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* plane whose u runs east and v runs north; centre in local (x=north, z=east) */
  function flatPlane(east, north, cx, cz, y) {
    var g = new THREE.PlaneGeometry(east, north);
    g.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    g.translate(cx, y, cz);
    return g;
  }
  function canvasTex(c, repeatAniso) {
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  var UP = new THREE.Vector3(0, 1, 0);
  var decalOff = function (m, u) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = u || -4; return m; };

  /* ---------------------------------------------------------------- terrain */
  var outer = new THREE.Mesh(flatPlane(24000, 24000, 0, 0, -0.05),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(128 / 255, 152 / 255, 92 / 255).convertSRGBToLinear().multiplyScalar(0.72), roughness: 1, metalness: 0 }));
  outer.renderOrder = -5; outer.material.depthWrite = false; root.add(outer);
  var groundMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: new THREE.Color(0.72, 0.72, 0.72) });
  var ground = new THREE.Mesh(flatPlane(MW * SC, MH * SC, wx(MH / 2), wz(MW / 2), 0), groundMat);
  ground.renderOrder = -3; root.add(ground);
  var img = new Image();
  img.onload = function () {
    var t = new THREE.Texture(img); t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso; t.needsUpdate = true;
    groundMat.map = t; groundMat.needsUpdate = true;
  };
  img.src = env.groundSrc;

  /* ---------------------------------------------------------------- region (expanded map around the base) */
  var REG = env.region || null;
  if (REG && env.regionSrc) {
    var regMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: new THREE.Color(0.72, 0.72, 0.72) });
    regMat.depthWrite = false;
    var regMesh = new THREE.Mesh(flatPlane((REG.X1 - REG.X0) * SC, (REG.Y1 - REG.Y0) * SC, wx((REG.Y0 + REG.Y1) / 2), wz((REG.X0 + REG.X1) / 2), -0.02), regMat);
    regMesh.renderOrder = -4; root.add(regMesh);
    var rimg = new Image();
    rimg.onload = function () {
      var t = new THREE.Texture(rimg); t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso; t.needsUpdate = true;
      regMat.map = t; regMat.needsUpdate = true;
    };
    rimg.src = env.regionSrc;
  }

  /* ---------------------------------------------------------------- runway */
  var RZ0 = -512, RZ1 = 508, PADW = 580, HW = 23.2;     // paved runway z-range, pad end, half width
  var PPM = 7, SEG = 290, NSEG = 4;
  function drawRunway(ctx, z0) {
    ctx.setTransform(PPM, 0, 0, PPM, -z0 * PPM, HW * PPM);     // x = z (east), y = south
    var r = rnd(11 + Math.round(z0));
    ctx.fillStyle = '#8c8b85'; ctx.fillRect(-PADW - 1, -HW, 2 * PADW + 2, 2 * HW);
    ctx.fillStyle = '#4c4d50'; ctx.fillRect(RZ0, -HW, RZ1 - RZ0, 2 * HW);
    var i, n;
    // paving lanes, joints
    ctx.fillStyle = 'rgba(20,20,22,0.35)';
    for (i = -3; i <= 3; i++) ctx.fillRect(RZ0, i * 5.8 - 0.04, RZ1 - RZ0, 0.08);
    ctx.fillStyle = 'rgba(20,20,22,0.28)';
    for (var z = RZ0; z <= RZ1; z += 25) ctx.fillRect(z - 0.04, -HW, 0.08, 2 * HW);
    ctx.fillStyle = 'rgba(40,40,40,0.25)';
    for (var zp = -PADW; zp < RZ0; zp += 18) ctx.fillRect(zp, -HW, 0.07, 2 * HW);
    for (var zq = RZ1; zq < PADW; zq += 18) ctx.fillRect(zq, -HW, 0.07, 2 * HW);
    // speckle
    for (i = 0; i < 26000; i++) {
      var zz = z0 + r() * SEG, yy = (r() - 0.5) * 2 * HW, v = r();
      ctx.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(zz, yy, 0.12 + r() * 0.2, 0.12 + r() * 0.2);
    }
    // soft patches of different asphalt age
    for (i = 0; i < 90; i++) {
      var pz = RZ0 + r() * (RZ1 - RZ0), py = (r() - 0.5) * 2 * (HW - 3), pw = 6 + r() * 30, ph = 1.5 + r() * 5;
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(pz, py, pw, ph);
    }
    // rubber at touchdown zones
    for (var e = 0; e < 2; e++) {
      var dir = e === 0 ? 1 : -1, base = e === 0 ? RZ0 : RZ1;
      for (i = 0; i < 260; i++) {
        var d = 180 + r() * 260, lat = (r() < 0.5 ? -1 : 1) * (1.2 + r() * 3.2) + (r() - 0.5) * 2;
        ctx.fillStyle = 'rgba(8,8,10,' + (0.05 + r() * 0.09) + ')';
        ctx.fillRect(base + dir * d, lat, dir * (2 + r() * 8), 0.12 + r() * 0.15);
      }
    }
    // markings
    var W = '#ebeae4', Y = '#dcb21c';
    ctx.fillStyle = W;
    ctx.fillRect(RZ0, -HW + 0.7, RZ1 - RZ0, 0.9); ctx.fillRect(RZ0, HW - 1.6, RZ1 - RZ0, 0.9);
    function zAt(end, d) { return end === 0 ? RZ0 + d : RZ1 - d; }
    function bar(end, d, len, y, w) { var a = zAt(end, d), b = zAt(end, d + len); ctx.fillRect(Math.min(a, b), y - w / 2, len, w); }
    for (var en = 0; en < 2; en++) {
      for (i = 0; i < 12; i++) bar(en, 6, 30, (i - 5.5) * 3.6, 1.8);                          // threshold
      [-1, 1].forEach(function (sg) {
        bar(en, 300, 45, sg * 9, 3.6);                                                          // aiming point
        [[150, 3], [225, 2], [375, 2], [450, 1], [525, 1]].forEach(function (p) {              // touchdown zone
          for (var k = 0; k < p[1]; k++) bar(en, p[0], 22.5, sg * (4.5 + k * 3.3), 1.8);
        });
      });
      // numerals, readable from the approach
      ctx.save();
      ctx.translate(zAt(en, 56), 0);
      ctx.rotate(en === 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.font = 'bold 12.5px "DejaVu Sans", "Liberation Sans", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(en === 0 ? '09' : '27', 0, 0);
      ctx.restore();
    }
    for (var cz = RZ0 + 120; cz < RZ1 - 120; cz += 50) { if (Math.abs(cz + 15 - (RZ0 + RZ1) / 2) < 3) continue; ctx.fillRect(cz, -0.45, 30, 0.9); }
    // blast-pad chevrons
    ctx.strokeStyle = Y; ctx.lineWidth = 1.5; ctx.lineJoin = 'miter';
    for (var pd = 0; pd < 2; pd++) {
      var s0 = pd === 0 ? 1 : -1, edge = pd === 0 ? RZ0 : RZ1;
      for (i = 0; i < 4; i++) {
        var zc = edge - s0 * (9 + i * 13);
        ctx.beginPath(); ctx.moveTo(zc - s0 * 8, -17); ctx.lineTo(zc, 0); ctx.lineTo(zc - s0 * 8, 17); ctx.stroke();
      }
      ctx.fillStyle = Y;
      var pe = pd === 0 ? -PADW : RZ1;
      ctx.fillRect(pe + 0.8, -HW + 0.8, PADW - Math.abs(edge) - 0.8 + (pd === 0 ? 0 : 0), 0.7);
      ctx.fillRect(pe + 0.8, HW - 1.5, PADW - Math.abs(edge) - 0.8, 0.7);
    }
  }
  var rwMat = [];
  for (var si = 0; si < NSEG; si++) {
    var cv = document.createElement('canvas'); cv.width = SEG * PPM; cv.height = Math.round(2 * HW * PPM);
    var cx = cv.getContext('2d'); var z0 = -PADW + si * SEG;
    drawRunway(cx, z0);
    var m = decalOff(new THREE.MeshStandardMaterial({ map: canvasTex(cv), roughness: 0.95, metalness: 0 }), -4);
    var mesh = new THREE.Mesh(flatPlane(SEG, 2 * HW, 0, z0 + SEG / 2, 0.0), m);
    mesh.renderOrder = -2; root.add(mesh); rwMat.push(m);
  }

  /* helipad */
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 512; var g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    g.strokeStyle = '#e6e4dc'; g.lineWidth = 16; g.beginPath(); g.arc(256, 256, 190, 0, 7); g.stroke();
    g.fillStyle = '#e6e4dc'; g.fillRect(170, 150, 36, 212); g.fillRect(306, 150, 36, 212); g.fillRect(170, 238, 172, 36);
    var m = decalOff(new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false }), -6);
    var mm = new THREE.Mesh(flatPlane(34, 34, wx(377), wz(768), 0), m); mm.renderOrder = -1;
    mm.material.color = new THREE.Color(0.8, 0.8, 0.8); root.add(mm);
  })();

  /* ---------------------------------------------------------------- buildings */
  function Bld() { this.P = []; this.N = []; this.C = []; this.ref = [0, 0, 0]; this.at(0, 0, 0); }
  Bld.prototype.at = function (px, py, rot) {
    this.ox = wx(py); this.oz = wz(px); var r = (rot || 0) * Math.PI / 180; this.cs = Math.cos(r); this.sn = Math.sin(r); return this;
  };
  Bld.prototype.v = function (e, y, n) {
    var e2 = e * this.cs - n * this.sn, n2 = e * this.sn + n * this.cs;
    return [this.ox + n2, y, this.oz + e2];
  };
  Bld.prototype.center = function (y) { this.ref = this.v(0, y, 0); return this; };
  Bld.prototype.tri = function (a, b, c, col) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var l = Math.hypot(nx, ny, nz); if (l < 1e-9) return; nx /= l; ny /= l; nz /= l;
    var mx = (a[0] + b[0] + c[0]) / 3 - this.ref[0], my = (a[1] + b[1] + c[1]) / 3 - this.ref[1], mz = (a[2] + b[2] + c[2]) / 3 - this.ref[2];
    if (nx * mx + ny * my + nz * mz < 0) { var t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    var P = this.P, N = this.N, C = this.C;
    P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    C.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
  };
  Bld.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
  Bld.prototype.box = function (w, d, h, y0, col, top) {
    var x = w / 2, z = d / 2, y1 = y0 + h, v = this.v.bind(this);
    this.center(y0 + h / 2);
    var p = [v(-x, y0, -z), v(x, y0, -z), v(x, y0, z), v(-x, y0, z), v(-x, y1, -z), v(x, y1, -z), v(x, y1, z), v(-x, y1, z)];
    this.quad(p[0], p[1], p[5], p[4], col); this.quad(p[1], p[2], p[6], p[5], col);
    this.quad(p[2], p[3], p[7], p[6], col); this.quad(p[3], p[0], p[4], p[7], col);
    this.quad(p[4], p[5], p[6], p[7], top || col);
  };
  /* ridge along 'a'; alongE true → a = east. */
  Bld.prototype.prism = function (la, lb, hw, hr, wall, roof, alongE, win) {
    var self = this;
    function V(a, y, b) { return alongE ? self.v(a, y, b) : self.v(b, y, a); }
    var A = la / 2, B = lb / 2, H = hw + hr;
    this.center(H / 2);
    var c = [V(-A, 0, -B), V(A, 0, -B), V(A, 0, B), V(-A, 0, B)];
    var t = [V(-A, hw, -B), V(A, hw, -B), V(A, hw, B), V(-A, hw, B)];
    this.quad(c[0], c[1], t[1], t[0], wall); this.quad(c[1], c[2], t[2], t[1], wall);
    this.quad(c[2], c[3], t[3], t[2], wall); this.quad(c[3], c[0], t[0], t[3], wall);
    var r0 = V(-A, H, 0), r1 = V(A, H, 0);
    this.quad(t[0], t[1], r1, r0, roof); this.quad(t[3], t[2], r1, r0, roof);
    this.tri(t[0], t[3], r0, wall); this.tri(t[1], t[2], r1, wall);
    if (win) {
      var dk = lin(0x39434c), o = 0.05;
      [-1, 1].forEach(function (sg) {
        var a0 = -A * 0.9, a1 = A * 0.9, y0 = hw * 0.42, y1 = hw * 0.8, b = sg * (B + o);
        self.quad(V(a0, y0, b), V(a1, y0, b), V(a1, y1, b), V(a0, y1, b), dk);
      });
    }
  };
  Bld.prototype.hip = function (la, lb, hw, hr, wall, roof) {   // la = east, lb = north
    var self = this, A = la / 2, B = lb / 2, H = hw + hr;
    var rl = Math.max(0, (Math.max(A, B) - Math.min(A, B)) * 0.98);
    this.center(H / 2);
    var v = this.v.bind(this);
    var c = [v(-A, 0, -B), v(A, 0, -B), v(A, 0, B), v(-A, 0, B)];
    var t = [v(-A, hw, -B), v(A, hw, -B), v(A, hw, B), v(-A, hw, B)];
    this.quad(c[0], c[1], t[1], t[0], wall); this.quad(c[1], c[2], t[2], t[1], wall);
    this.quad(c[2], c[3], t[3], t[2], wall); this.quad(c[3], c[0], t[0], t[3], wall);
    var r0, r1;
    if (A >= B) { r0 = v(-rl, H, 0); r1 = v(rl, H, 0); } else { r0 = v(0, H, -rl); r1 = v(0, H, rl); }
    this.tri(t[0], t[1], r0, roof); this.tri(t[1], t[2], r1, roof); this.tri(t[2], t[3], r1, roof); this.tri(t[3], t[0], r0, roof);
    this.quad(t[0], t[1], r1, r0, roof); this.quad(t[1], t[2], r1, r0, roof); this.quad(t[2], t[3], r0, r1, roof); this.quad(t[3], t[0], r0, r1, roof);
  };
  /* barrel vault: span across, len along the axis (alongE → axis east) */
  Bld.prototype.barrel = function (span, len, h, wall, alongE, door, bays) {
    var self = this, S = 14, a = span / 2, L = len / 2;
    function V(u, y, s) { return alongE ? self.v(s, y, u) : self.v(u, y, s); }   // axis s; across u
    this.center(h / 2);
    var prof = [], i;
    for (i = 0; i <= S; i++) { var th = Math.PI * i / S; prof.push([Math.cos(th) * a, Math.sin(th) * h]); }
    var nb = bays || Math.max(1, Math.round(len / 5));
    var base = new THREE.Color(wall);
    for (var j = 0; j < nb; j++) {
      var s0 = -L + len * j / nb, s1 = -L + len * (j + 1) / nb;
      var col = base.clone().multiplyScalar(j % 2 ? 0.93 : 1.04);
      for (i = 0; i < S; i++) this.quad(V(prof[i][0], prof[i][1], s0), V(prof[i + 1][0], prof[i + 1][1], s0), V(prof[i + 1][0], prof[i + 1][1], s1), V(prof[i][0], prof[i][1], s1), col);
    }
    var capCol = base.clone().multiplyScalar(0.85);
    for (var e = -1; e <= 1; e += 2) {
      for (i = 0; i < S; i++) this.tri(V(0, 0, e * L), V(prof[i][0], prof[i][1], e * L), V(prof[i + 1][0], prof[i + 1][1], e * L), capCol);
    }
    if (door) {
      var dc = lin(0x2b2e32), dw = a * 0.8, dh = h * 0.5, o = 0.06, sg = door;   // door on end sg
      this.quad(V(-dw, 0, sg * (L + o)), V(dw, 0, sg * (L + o)), V(dw, dh, sg * (L + o)), V(-dw, dh, sg * (L + o)), dc);
    }
  };
  Bld.prototype.cyl = function (r, h, y0, col, top, segs) {
    var S = segs || 14, v = this.v.bind(this), i;
    this.center(y0 + h / 2);
    for (i = 0; i < S; i++) {
      var a0 = 2 * Math.PI * i / S, a1 = 2 * Math.PI * (i + 1) / S;
      var p0 = v(Math.cos(a0) * r, y0, Math.sin(a0) * r), p1 = v(Math.cos(a1) * r, y0, Math.sin(a1) * r);
      var q0 = v(Math.cos(a0) * r, y0 + h, Math.sin(a0) * r), q1 = v(Math.cos(a1) * r, y0 + h, Math.sin(a1) * r);
      this.quad(p0, p1, q1, q0, col);
      this.tri(v(0, y0 + h, 0), q0, q1, top || col);
    }
  };
  Bld.prototype.dome = function (r, col) {
    var S = 14, R = 5, v = this.v.bind(this), i, j;
    this.center(0);
    for (j = 0; j < R; j++) {
      var t0 = (Math.PI / 2) * j / R, t1 = (Math.PI / 2) * (j + 1) / R;
      for (i = 0; i < S; i++) {
        var a0 = 2 * Math.PI * i / S, a1 = 2 * Math.PI * (i + 1) / S;
        var p = function (t, a) { return v(Math.cos(t) * Math.cos(a) * r, Math.sin(t) * r, Math.cos(t) * Math.sin(a) * r); };
        this.quad(p(t0, a0), p(t0, a1), p(t1, a1), p(t1, a0), col);
      }
    }
  };
  Bld.prototype.ring = function (R, h, th, col, segs) {
    var S = segs || 40, v = this.v.bind(this), i, ro = R + th / 2, ri = R - th / 2;
    for (i = 0; i < S; i++) {
      var a0 = 2 * Math.PI * i / S, a1 = 2 * Math.PI * (i + 1) / S, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.ref = this.v(Math.cos((a0 + a1) / 2) * R, h / 2, Math.sin((a0 + a1) / 2) * R);
      var o = (Math.hypot(1, 0));
      this.quad(v(c0 * ro, 0, s0 * ro), v(c1 * ro, 0, s1 * ro), v(c1 * ro, h, s1 * ro), v(c0 * ro, h, s0 * ro), col);
      this.quad(v(c0 * ri, 0, s0 * ri), v(c1 * ri, 0, s1 * ri), v(c1 * ri, h, s1 * ri), v(c0 * ri, h, s0 * ri), col);
      this.quad(v(c0 * ri, h, s0 * ri), v(c1 * ri, h, s1 * ri), v(c1 * ro, h, s1 * ro), v(c0 * ro, h, s0 * ro), col);
    }
  };
  Bld.prototype.disc = function (r, y, tilt, col, segs) {     // dish, tilted about east axis
    var S = segs || 14, v = this.v.bind(this), ct = Math.cos(tilt), st = Math.sin(tilt), i;
    function P(e, n) { return [e, y + n * st, n * ct]; }
    this.ref = this.v(0, y - 5, 0);
    for (i = 0; i < S; i++) {
      var a0 = 2 * Math.PI * i / S, a1 = 2 * Math.PI * (i + 1) / S;
      var c = P(0, 0), p0 = P(Math.cos(a0) * r, Math.sin(a0) * r), p1 = P(Math.cos(a1) * r, Math.sin(a1) * r);
      this.tri(v(c[0], c[1], c[2]), v(p0[0], p0[1], p0[2]), v(p1[0], p1[1], p1[2]), col);
    }
  };
  /* oriented slab between two world (x,z) points */
  Bld.prototype.seg = function (x0, z0, x1, z1, th, h, y0, col) {
    var dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 1e-6) return;
    var nx = -dz / l * th / 2, nz = dx / l * th / 2;
    var P = [[x0 + nx, y0, z0 + nz], [x1 + nx, y0, z1 + nz], [x1 - nx, y0, z1 - nz], [x0 - nx, y0, z0 - nz]];
    var Q = P.map(function (p) { return [p[0], p[1] + h, p[2]]; });
    this.ref = [(x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2];
    this.quad(P[0], P[1], Q[1], Q[0], col); this.quad(P[1], P[2], Q[2], Q[1], col);
    this.quad(P[2], P[3], Q[3], Q[2], col); this.quad(P[3], P[0], Q[0], Q[3], col); this.quad(Q[0], Q[1], Q[2], Q[3], col);
  };
  Bld.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    return g;
  };

  var B = new Bld(), R = rnd(5);
  var WALLS = [0xb9b5a8, 0xc9c3b3, 0xa9a89f, 0xbdb39c], ROOFS = [0x6c7378, 0x7b4c3d, 0x56604b, 0x8b9094, 0x5c5f66];
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  function tint(hex, k) { return lin(hex).multiplyScalar(k); }
  function shed(px, py, w, d, rot, type) {
    var ww = w * SC, dd = d * SC, mn = Math.min(ww, dd);
    var hw = Math.min(8, 3.4 + mn * 0.12), hr = Math.min(5, mn * 0.2);
    var wall = tint(pick(WALLS), 0.93 + R() * 0.14), roof = tint(pick(ROOFS), 0.9 + R() * 0.2);
    B.at(px, py, rot || 0);
    if (type === 'h') B.hip(ww, dd, hw, hr, wall, roof);
    else B.prism(Math.max(ww, dd), Math.min(ww, dd), hw, hr, wall, roof, ww >= dd, mn > 14);
  }
  /* arch hangars */
  [[426, 298, 78, 90], [536, 298, 78, 90], [767, 167, 40, 45], [1158, 174, 36, 67], [1212, 174, 36, 67]].forEach(function (h) {
    B.at(h[0], h[1], 0); var span = h[2] * SC, len = h[3] * SC;
    B.barrel(span, len, Math.min(17, span * 0.27), lin(0x7d8470), false, -1);   // door faces south (–x)
  });
  B.at(1165, 647, 0); B.barrel(40 * SC, 65 * SC, 40 * SC * 0.27, lin(0x7d8470), true, 1);
  B.at(1370, 335, 0); B.barrel(35 * SC, 40 * SC, 7, lin(0x6f7466), true, 1, 4);
  /* sheds / warehouses */
  [[607, 152, 60, 25], [872, 115, 40, 20], [988, 113, 17, 22], [960, 156, 40, 22], [1008, 156, 43, 22], [1115, 102, 45, 30], [867, 157, 30, 40],
    [775, 313, 60, 25], [677, 258, 45, 33], [677, 298, 45, 25], [963, 316, 27, 28], [1001, 316, 27, 28], [1057, 316, 40, 22], [956, 268, 12, 33],
    [990, 268, 15, 32], [1015, 268, 15, 32], [1085, 182, 38, 26], [251, 650, 28, 40], [324, 664, 47, 28], [401, 651, 32, 22], [401, 678, 32, 20],
    [485, 666, 70, 43], [457, 734, 105, 12], [586, 763, 28, 17], [572, 692, 50, 35], [836, 702, 38, 15], [836, 727, 38, 15], [973, 706, 53, 28],
    [1025, 751, 50, 33], [1271, 711, 42, 22], [970, 655, 35, 60], [548, 780, 27, 40], [1070, 648, 25, 37], [1112, 648, 25, 37], [1416, 235, 28, 25],
    [760, 214, 17, 22], [782, 214, 17, 22], [803, 214, 17, 22], [848, 215, 14, 28], [866, 215, 14, 28], [884, 213, 16, 30], [457, 245, 28, 25],
    [500, 242, 28, 20], [528, 243, 22, 17], [561, 245, 28, 25], [600, 250, 15, 15], [621, 250, 12, 15], [262, 312, 12, 16], [278, 312, 12, 16],
    [262, 335, 12, 16], [278, 335, 12, 16], [280, 636, 14, 14], [280, 656, 14, 16], [168, 580, 14, 14], [586, 790, 28, 10], [1262, 735, 12, 10],
    [1282, 735, 12, 10], [880, 703, 14, 18], [880, 727, 14, 18], [912, 703, 14, 18], [912, 727, 14, 18], [590, 202, 18, 20]
  ].forEach(function (s) { shed(s[0], s[1], s[2], s[3], 0, 'g'); });
  [[851, 311, 30, 30, 0], [878, 314, 12, 30, 0], [898, 314, 14, 30, 0], [818, 158, 27, 27, 0], [170, 626, 22, 22, 15], [1436, 585, 28, 28, 30], [1397, 641, 28, 28, 30]]
    .forEach(function (s) { shed(s[0], s[1], s[2], s[3], s[4], 'h'); });
  /* tanks */
  [[830, 638], [858, 638], [830, 667], [858, 667]].forEach(function (t) { B.at(t[0], t[1], 0); B.box(20 * SC, 24 * SC, 6, 0, lin(0x9a9fa0), lin(0xb4b8b8)); });
  [[889, 638, 12], [915, 638, 12], [889, 667, 12], [915, 667, 12], [1105, 765, 8], [1105, 787, 8], [1130, 802, 11]].forEach(function (t) {
    B.at(t[0], t[1], 0); B.cyl(t[2] * SC, 7, 0, lin(0xa4a8a8), lin(0xc0c3c2), 18);
  });
  B.at(1017, 702, 0); B.dome(10 * SC, lin(0xb9bcbc));
  /* control tower */
  B.at(885, 262, 0); B.box(16, 16, 6, 0, lin(0xb9b5a8), lin(0x6c7378));
  B.at(885, 262, 0); B.cyl(2.6, 15, 6, lin(0xc9c5b8), lin(0xc9c5b8), 12);
  B.at(885, 262, 0); B.cyl(5.2, 3.2, 21, lin(0x25323b), lin(0x25323b), 14);
  B.at(885, 262, 0); B.cyl(5.7, 0.7, 24.2, lin(0xb9b5a8), lin(0x6c7378), 14);
  B.at(885, 262, 0); B.cyl(0.12, 5, 24.9, lin(0x888888), lin(0x888888), 5);
  /* radar sites */
  [[190, 300, 40], [213, 805, 22], [1308, 153, 23], [1392, 803, 22], [1023, 653, 17]].forEach(function (s) {
    var r = s[2] * SC;
    B.at(s[0], s[1], 0); B.ring(r, 1.4, 0.5, lin(0x7a7f7c), 36);
    B.at(s[0], s[1], 0); B.cyl(Math.min(4, r * 0.28), 0.6, 0, lin(0x8b8c88), lin(0x8b8c88), 12);
    B.at(s[0], s[1], 0); B.cyl(0.5, 9, 0.6, lin(0x9aa09f), lin(0x9aa09f), 8);
    B.at(s[0], s[1], 0); B.disc(Math.min(4.5, r * 0.3), 10.2, 0.6, lin(0xd1d4d3), 14);
  });
  B.at(190, 300, 0); B.box(6, 5, 3, 0, lin(0xb9b5a8), lin(0x6c7378));
  /* flagpole + windsock */
  B.at(1385, 525, 0); B.cyl(0.12, 8, 0, lin(0xd8d8d8), lin(0xd8d8d8), 5);
  (function () {
    var cn = [lin(0xe5601e), lin(0xf0f0ec)], i, S = 5;
    for (i = 0; i < 4; i++) {
      var r0 = 0.5 - i * 0.07, r1 = 0.5 - (i + 1) * 0.07;
      for (var k = 0; k < 8; k++) {
        var a0 = 2 * Math.PI * k / 8, a1 = 2 * Math.PI * (k + 1) / 8, vv = B.v.bind(B);
        B.ref = B.v(i * 0.9 + 0.5, 7.5, 0);
        B.quad(vv(i * 0.9, 7.5 + Math.cos(a0) * r0, Math.sin(a0) * r0), vv(i * 0.9, 7.5 + Math.cos(a1) * r0, Math.sin(a1) * r0),
          vv((i + 1) * 0.9, 7.5 + Math.cos(a1) * r1, Math.sin(a1) * r1), vv((i + 1) * 0.9, 7.5 + Math.cos(a0) * r1, Math.sin(a0) * r1), cn[i % 2]);
      }
    }
  })();
  /* runway edge lights */
  (function () {
    for (var z = RZ0 + 10; z < RZ1; z += 60) [-1, 1].forEach(function (sg) {
      B.at(0, 0, 0); var x = sg * (HW + 1.6);
      B.seg(x, z, x, z, 0.001, 0.001, 0, lin(0xffffff));
      B.ref = [x, 0.2, z]; var c = lin(0xf5f2d0);
      B.seg(x - 0.15, z, x + 0.15, z, 0.3, 0.35, 0, c);
    });
  })();
  /* perimeter fence (posts + rails), offset inside the ring road */
  (function () {
    var poly = [[28, 455], [28, 420], [65, 400], [75, 360], [95, 300], [130, 240], [160, 215], [190, 200], [265, 182], [470, 178], [500, 155], [530, 125], [790, 118], [820, 95], [870, 70], [1000, 56], [1080, 60], [1300, 78], [1350, 108], [1420, 185], [1462, 220], [1466, 320], [1500, 425], [1503, 505], [1470, 570], [1440, 640], [1390, 750], [1340, 795], [1290, 822], [1130, 830], [1075, 810], [1020, 805], [660, 815], [280, 832], [240, 790], [205, 725], [170, 650], [120, 590], [60, 540], [28, 515]];
    var n = poly.length, pts = poly.map(function (p) { return [wx(p[1]), wz(p[0])]; });
    var area = 0, i; for (i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; area += a[1] * b[0] - b[1] * a[0]; }
    var sgn = area > 0 ? 1 : -1, off = 7;
    var q = pts.map(function (p, k) {
      var pa = pts[(k + n - 1) % n], pb = pts[(k + 1) % n];
      function nrm(u, w) { var dx = w[0] - u[0], dz = w[1] - u[1], l = Math.hypot(dx, dz); return [sgn * dz / l, -sgn * dx / l]; }
      var n1 = nrm(pa, p), n2 = nrm(p, pb), nx = n1[0] + n2[0], nz = n1[1] + n2[1], l = Math.hypot(nx, nz) || 1;
      var k2 = 1 / Math.max(0.5, (nx * n1[0] + nz * n1[1]) / l);
      return [p[0] - nx / l * off * k2, p[1] - nz / l * off * k2];
    });
    var fc = lin(0x7c8480);
    for (i = 0; i < n; i++) {
      var p0 = q[i], p1 = q[(i + 1) % n], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), cnt = Math.max(1, Math.round(L / 14));
      B.seg(p0[0], p0[1], p1[0], p1[1], 0.06, 0.06, 2.0, fc);
      B.seg(p0[0], p0[1], p1[0], p1[1], 0.06, 0.06, 0.9, fc);
      for (var j = 0; j <= cnt; j++) {
        var t = j / cnt, x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
        B.seg(x, z - 0.07, x, z + 0.07, 0.14, 2.3, 0, fc);
      }
    }
  })();
  /* region: village houses + river bridges */
  if (REG) {
    (REG.houses || []).forEach(function (h) { shed(h[0], h[1], h[2] / SC, h[3] / SC, -h[4], R() < 0.35 ? 'h' : 'g'); });
    (REG.bridges || []).forEach(function (b) {
      var a = b[2] * Math.PI / 180, dz = Math.cos(a), dx = -Math.sin(a), L = 34, cx = wx(b[1]), cz = wz(b[0]);
      var x0 = cx - dx * L, z0 = cz - dz * L, x1 = cx + dx * L, z1 = cz + dz * L, nx = -dz, nz = dx;
      var deck = lin(0x8e8a80), rail = lin(0xb4b0a6), pier = lin(0x77746c);
      B.at(0, 0, 0);
      B.seg(x0, z0, x1, z1, 9, 0.6, 0.05, deck);
      [-1, 1].forEach(function (sg) { B.seg(x0 + nx * sg * 4.3, z0 + nz * sg * 4.3, x1 + nx * sg * 4.3, z1 + nz * sg * 4.3, 0.4, 1.0, 0.65, rail); });
      [-0.45, 0, 0.45].forEach(function (t) { var px = cx + dx * L * t, pz = cz + dz * L * t; B.seg(px - nx * 4, pz - nz * 4, px + nx * 4, pz + nz * 4, 1.2, 0.3, 0, pier); });
    });
  }
  var bGeo = B.geometry();
  var bMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  var bMesh = new THREE.Mesh(bGeo, bMat); bMesh.frustumCulled = false; root.add(bMesh);

  /* ---------------------------------------------------------------- region forests (instanced trees from the forest mask) */
  var treeGroup = new THREE.Group(); root.add(treeGroup);
  if (REG && env.forestSrc) {
    var fimg = new Image();
    fimg.onload = function () {
      var FW = fimg.width, FH = fimg.height, cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
      var cx2 = cv.getContext('2d'); cx2.drawImage(fimg, 0, 0);
      var px = cx2.getImageData(0, 0, FW, FH).data;
      var fsx = (REG.X1 - REG.X0) / FW, fsy = (REG.Y1 - REG.Y0) / FH, tr = rnd(77), pts = [];
      function blocked(mx, my) {           // keep the runway approach corridors clear
        return Math.abs(my - 480) < 90 && mx > -760 && mx < 2300;
      }
      for (var j = 0; j < FH; j++) for (var i = 0; i < FW; i++) {
        if (px[(j * FW + i) * 4] < 128) continue;
        for (var k = 0; k < 1; k++) {
          if (tr() > 0.2) continue;
          var mx = REG.X0 + (i + tr()) * fsx, my = REG.Y0 + (j + tr()) * fsy;
          if (blocked(mx, my)) continue;
          pts.push([mx, my, 0]);
        }
      }
      (REG.icons || []).forEach(function (p) {
        pts.push([p[0], p[1], 1]);
        for (var k = 0; k < 3; k++) if (tr() < 0.6) pts.push([p[0] + (tr() - 0.5) * 14, p[1] + (tr() - 0.5) * 14, 1]);
      });
      var nCon = 0, nDec = 0, kinds = pts.map(function () { var c = tr() < 0.4; if (c) nCon++; else nDec++; return c; });
      var conG = new THREE.ConeGeometry(1, 1, 6, 1); conG.translate(0, 0.5, 0);
      var decG = new THREE.IcosahedronGeometry(1, 0); decG.scale(1, 0.85, 1);
      var tMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, flatShading: true });
      var con = new THREE.InstancedMesh(conG, tMat, Math.max(1, nCon)), dec = new THREE.InstancedMesh(decG, tMat, Math.max(1, nDec));
      var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
      var ic = 0, id = 0;
      var CONC = [0x2f4a2a, 0x36522e, 0x2a4227, 0x3b5631], DECC = [0x4d6b34, 0x587a3a, 0x445f30, 0x62803f, 0x6b7e3a];
      pts.forEach(function (p, n) {
        var x = wx(p[1]), z = wz(p[0]), h = (p[2] ? 9 : 11) + tr() * 9, rad = h * (0.3 + tr() * 0.12);
        q.setFromAxisAngle(UP, tr() * 6.28);
        if (kinds[n]) {
          pv.set(x, 0, z); sv.set(rad * 0.9, h, rad * 0.9); m4.compose(pv, q, sv); con.setMatrixAt(ic, m4);
          col.set(CONC[Math.floor(tr() * CONC.length)]).convertSRGBToLinear().multiplyScalar(0.85 + tr() * 0.3); con.setColorAt(ic++, col);
        } else {
          rad *= 1.2; pv.set(x, Math.max(rad * 0.7, h - rad * 0.85), z); sv.set(rad, rad, rad); m4.compose(pv, q, sv); dec.setMatrixAt(id, m4);
          col.set(DECC[Math.floor(tr() * DECC.length)]).convertSRGBToLinear().multiplyScalar(0.85 + tr() * 0.3); dec.setColorAt(id++, col);
        }
      });
      con.count = ic; dec.count = id;
      [con, dec].forEach(function (m) { m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; treeGroup.add(m); });
    };
    fimg.src = env.forestSrc;
  }

  /* ---------------------------------------------------------------- parked aircraft (instanced proxies) */
  var parkGroup = new THREE.Group(); root.add(parkGroup);
  var ROWS = [
    ['me262', 372, [392, 428, 462, 497, 530, 563, 597, 630, 663, 697], 0],
    ['meteor', 236, [1145, 1187, 1228, 1265, 1300, 1341], 0],
    ['p51', 281, [1229, 1265, 1302, 1341], 0],
    ['p51', 585, [517, 550, 582, 614, 647], 0],
    ['me262', 712, [1115, 1152, 1190], 0],
    ['meteor', 361, [808], -0.6],
    ['me262', 616, [1236], 0.15]
  ];
  var blobTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  function underOverlay(m, A) { for (var o = m; o; o = o.parent) if (o === A.overlay || o === A.lineGroup) return true; return false; }
  function bake(items, shx, shz) {
    var names = Object.keys(items[0].geometry.attributes).filter(function (n) { return items.every(function (m) { return m.geometry.attributes[n]; }); });
    var nv = 0, ni = 0; items.forEach(function (m) { var g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    var out = {}, idx = new Uint32Array(ni), vo = 0, io = 0;
    names.forEach(function (n) { out[n] = new Float32Array(nv * items[0].geometry.attributes[n].itemSize); });
    items.forEach(function (m) {
      var g = m.geometry, mw = m.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(mw), pos = g.attributes.position, c = pos.count, k, v = new THREE.Vector3();
      names.forEach(function (n) {
        var at = g.attributes[n], sz = at.itemSize, dst = out[n];
        for (k = 0; k < c; k++) {
          if (n === 'position') { v.fromBufferAttribute(at, k).applyMatrix4(mw); dst[(vo + k) * 3] = v.x - shx; dst[(vo + k) * 3 + 1] = v.y; dst[(vo + k) * 3 + 2] = v.z - shz; }
          else if (n === 'normal') { v.fromBufferAttribute(at, k).applyMatrix3(nm).normalize(); dst[(vo + k) * 3] = v.x; dst[(vo + k) * 3 + 1] = v.y; dst[(vo + k) * 3 + 2] = v.z; }
          else for (var q = 0; q < sz; q++) dst[(vo + k) * sz + q] = at.array[k * sz + q];
        }
      });
      var flip = mw.determinant() < 0, cnt = g.index ? g.index.count : c;
      for (k = 0; k < cnt; k += 3) {
        var a = g.index ? g.index.array[k] : k, b = g.index ? g.index.array[k + 1] : k + 1, d = g.index ? g.index.array[k + 2] : k + 2;
        if (flip) { var t = b; b = d; d = t; }
        idx[io + k] = a + vo; idx[io + k + 1] = b + vo; idx[io + k + 2] = d + vo;
      }
      vo += c; io += cnt;
    });
    var geo = new THREE.BufferGeometry();
    names.forEach(function (n) { geo.setAttribute(n, new THREE.BufferAttribute(out[n], items[0].geometry.attributes[n].itemSize)); });
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    return geo;
  }
  var proxyInfo = {};
  function makeProxy(id) {
    var A = env.builders[id]();
    A.paint();
    A.pivot.rotation.x = -A.pitch; A.pivot.position.y = A.groundY;
    A.applyGear(0); A.applyControls({ ail: 0, ele: 0, rud: 0, flap: 0, slat: 0, can: 0 });
    A.center.updateMatrixWorld(true);
    var buckets = [], map = new Map();
    A.allMeshes.forEach(function (m) {
      if (underOverlay(m, A) || !m.isMesh) return;
      var b = map.get(m.material); if (!b) { b = { mat: m.material, items: [] }; map.set(m.material, b); buckets.push(b); }
      b.items.push(m);
    });
    var bb = new THREE.Box3(); A.skinMeshes.forEach(function (m) { bb.expandByObject(m); });
    var shx = (bb.min.x + bb.max.x) / 2, shz = (bb.min.z + bb.max.z) / 2;
    var parts = buckets.map(function (b) { return { mat: b.mat, geo: bake(b.items, shx, shz) }; });
    env.scene.remove(A.center);
    A.allMeshes.forEach(function (m) { if (m.geometry) m.geometry.dispose(); });
    proxyInfo[id] = { parts: parts, shadow: A.shadow, size: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z], y0: bb.min.y };
  }
  var tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), tmpP = new THREE.Vector3();
  var placed = {};
  ROWS.forEach(function (r) {
    r[2].forEach(function (px) { (placed[r[0]] = placed[r[0]] || []).push([wx(r[1]), wz(px), Math.PI / 2 + r[3]]); });
  });
  var LOWCOL = { p51: 0xb9bdc0, me262: 0x59644f, meteor: 0x4a5750 };
  function lowGeo(info) {
    var W = info.size[0], H = info.size[1], L = info.size[2], g = [];
    function add(geo, x, y, z) { geo.translate(x, y, z); g.push(geo.toNonIndexed()); }
    var fr = Math.min(H, W) * 0.13;
    var fus = new THREE.CylinderGeometry(fr, fr * 0.55, L * 0.96, 8, 1); fus.rotateX(Math.PI / 2); add(fus, 0, info.y0 > 0 ? 0 : 0, 0);
    add(new THREE.BoxGeometry(W, 0.12, L * 0.16), 0, 0, L * 0.05);
    add(new THREE.BoxGeometry(W * 0.36, 0.08, L * 0.09), 0, 0.15, -L * 0.42);
    add(new THREE.BoxGeometry(0.1, H * 0.26, L * 0.12), 0, H * 0.13, -L * 0.42);
    var n = 0; g.forEach(function (x) { n += x.attributes.position.count; });
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), o = 0;
    g.forEach(function (x) { pos.set(x.attributes.position.array, o * 3); nor.set(x.attributes.normal.array, o * 3); o += x.attributes.position.count; });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return geo;
  }
  var groups = [], LOD_R2 = 330 * 330;
  Object.keys(placed).forEach(function (id) {
    makeProxy(id);
    var list = placed[id], pi = proxyInfo[id], mats = [];
    list.forEach(function (pl) { tmpQ.setFromAxisAngle(UP, pl[2]); tmpP.set(pl[0], 0, pl[1]); mats.push(new THREE.Matrix4().compose(tmpP, tmpQ, new THREE.Vector3(1, 1, 1))); });
    var ims = pi.parts.map(function (p) {
      var im = new THREE.InstancedMesh(p.geo, p.mat, list.length); im.frustumCulled = false; im.count = 0; parkGroup.add(im); return im;
    });
    var low = new THREE.InstancedMesh(lowGeo(pi), new THREE.MeshStandardMaterial({ color: lin(LOWCOL[id]), roughness: 0.6, metalness: 0.2 }), list.length);
    low.frustumCulled = false; low.count = 0; parkGroup.add(low);
    groups.push({ list: list, mats: mats, ims: ims, low: low, sig: '', y: -pi.y0 * 0 });
    var sm = decalOff(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }), -6);
    var sim = new THREE.InstancedMesh(flatPlane(1, 1, 0, 0, 0), sm, list.length); sim.renderOrder = -1;
    var sw = pi.shadow[0] * 1.0, sl = pi.shadow[1] * 1.05;
    list.forEach(function (pl, i) {
      tmpQ.setFromAxisAngle(UP, pl[2]); tmpP.set(pl[0], 0, pl[1]); tmpS.set(sw, 1, sl);
      tmpM.compose(tmpP, tmpQ, tmpS); sim.setMatrixAt(i, tmpM);
    });
    tmpS.set(1, 1, 1);
    sim.instanceMatrix.needsUpdate = true; sim.frustumCulled = false; parkGroup.add(sim);
  });
  var lastCam = new THREE.Vector3(1e9, 0, 0), lastForce = true;
  function updateLOD(camPos) {
    var cx = camPos.x - root.position.x, cz = camPos.z - root.position.z, cy = camPos.y;
    if (!lastForce && Math.abs(cx - lastCam.x) + Math.abs(cz - lastCam.z) + Math.abs(cy - lastCam.y) < 4) return;
    lastForce = false; lastCam.set(cx, cy, cz);
    groups.forEach(function (gr) {
      var near = [], far = [];
      gr.list.forEach(function (pl, i) { var dx = pl[0] - cx, dz = pl[1] - cz; (dx * dx + dz * dz + cy * cy < LOD_R2 ? near : far).push(i); });
      gr.ims.forEach(function (im) { near.forEach(function (i, k) { im.setMatrixAt(k, gr.mats[i]); }); im.count = near.length; im.instanceMatrix.needsUpdate = true; });
      far.forEach(function (i, k) { gr.low.setMatrixAt(k, gr.mats[i]); }); gr.low.count = far.length; gr.low.instanceMatrix.needsUpdate = true;
    });
  }

  /* ---------------------------------------------------------------- sky + fog */
  var horizon = new THREE.Color(0xd4e0ea);
  var skyTex = (function () {
    var c = document.createElement('canvas'); c.width = 4; c.height = 256; var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#2f6bb8'); gr.addColorStop(0.3, '#5f94cf'); gr.addColorStop(0.42, '#9cbfe0'); gr.addColorStop(0.47, '#c7dbea'); gr.addColorStop(0.5, '#d4e0ea'); gr.addColorStop(1, '#d4e0ea');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  })();
  var sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.renderOrder = -10; sky.frustumCulled = false;
  sky.onBeforeRender = function (r, s, camera) { sky.position.copy(camera.position); };
  root.add(sky);
  var fog = new THREE.Fog(horizon.clone().convertSRGBToLinear(), 2800, 7600);

  root.visible = false;
  return {
    root: root, fog: fog, ORIGIN_Z: ORIGIN_Z, SC: SC,
    parked: function (v) { parkGroup.visible = v; },
    update: function (camPos) { if (root.visible && parkGroup.visible) updateLOD(camPos); },
    setVisible: function (v) { root.visible = v; },
    follow: function (x, z) { outer.position.x = x; outer.position.z = z; },
    toLocal: function (px, py) { return [wx(py), wz(px) - ORIGIN_Z]; }
  };
}
