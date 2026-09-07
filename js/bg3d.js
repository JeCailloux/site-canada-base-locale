/* ============================================================
   CARIBOU — Fond 3D "Nuit boréale"
   Three.js : aurores boréales (shader), montagnes low-poly,
   neige en particules, parallaxe souris.
   Se désactive proprement si Three.js ne charge pas ou si
   l'utilisateur préfère réduire les animations.
   ============================================================ */

(function () {
  "use strict";

  var canvas = document.getElementById("bg3d");
  if (!canvas) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof THREE === "undefined" || reduceMotion) {
    // Fallback : le dégradé CSS du body suffit.
    canvas.style.display = "none";
    document.body.classList.add("no-motion");
    return;
  }

  var renderer, scene, camera, auroraMat, lakeMat, snow, snowVel, mountains, mountainsFar, caribou;
  var mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  var clock = new THREE.Clock();
  var SNOW_COUNT = 1300;

  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1120, 28, 105);

    camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 4.2, 26);

    buildAurora();
    // crête lointaine : silhouette enneigée qui remplit l'horizon
    buildMountains({ amp: 8.5, z: -50, base: 0x24304e, snow: 1.0, depth: 26, width: 380, lake: false });
    // arrière-plan : sommets enneigés
    mountainsFar = buildMountains({ amp: 5.6, z: -26, base: 0x1d2b49, snow: 1.0, depth: 34, width: 300, lake: false });
    // premier plan : berges très enneigées, creusées autour du lac
    mountains = buildMountains({ amp: 3.4, z: -6, base: 0x1a2a47, snow: 1.0, depth: 44, width: 220, lake: true });
    buildLake();
    buildMeadow();
    buildForest({ amp: 5.6, zBase: -26, lake: false, count: 260, xSpread: 260, zMin: -14, zMax: 14, minH: 1.4, avoidLake: false, minS: 0.9, maxS: 2.4 });
    buildForest({ amp: 3.4, zBase: -6, lake: true, count: 340, xSpread: 150, zMin: -16, zMax: 18, minH: 0.75, avoidLake: true, minS: 0.8, maxS: 2.6 });
    buildMoon();
    caribou = buildCaribou();
    buildSnow();
    buildStars();

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    renderer.setAnimationLoop(tick);
  }

  /* ---------- Aurores boréales : grand plan shader ---------- */
  function buildAurora() {
    var geo = new THREE.PlaneGeometry(220, 90);
    auroraMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec2 vUv;",
        "uniform float uTime;",
        "",
        "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
        "float noise(vec2 p) {",
        "  vec2 i = floor(p); vec2 f = fract(p);",
        "  vec2 u = f * f * (3.0 - 2.0 * f);",
        "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
        "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
        "}",
        "float fbm(vec2 p) {",
        "  float v = 0.0; float a = 0.5;",
        "  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }",
        "  return v;",
        "}",
        "",
        "void main() {",
        "  vec2 uv = vUv;",
        "  float t = uTime * 0.05;",
        "",
        "  // rideaux verticaux ondulants",
        "  float curtain = fbm(vec2(uv.x * 3.5 + t, uv.y * 1.2 - t * 0.6));",
        "  float band = smoothstep(0.25, 0.75, uv.y) * smoothstep(1.05, 0.55, uv.y);",
        "  float rays = pow(fbm(vec2(uv.x * 9.0 + t * 2.0, uv.y * 0.5)), 2.0);",
        "  float glow = curtain * band * (0.55 + rays * 0.9);",
        "",
        "  vec3 green  = vec3(0.20, 0.83, 0.60);",
        "  vec3 violet = vec3(0.55, 0.42, 0.93);",
        "  vec3 ice    = vec3(0.22, 0.74, 0.97);",
        "  vec3 col = mix(green, violet, smoothstep(0.3, 0.95, uv.y + curtain * 0.25));",
        "  col = mix(col, ice, rays * 0.35);",
        "",
        "  float alpha = clamp(glow * 1.15, 0.0, 0.85);",
        "  gl_FragColor = vec4(col * glow * 1.6, alpha);",
        "}"
      ].join("\n")
    });
    var aurora = new THREE.Mesh(geo, auroraMat);
    aurora.position.set(0, 26, -60);
    scene.add(aurora);
  }

  /* ---------- Relief du terrain (partagé montagnes / prairie) ---------- */
  function groundHeight(x, zz, amp, lake) {
    var h =
      Math.sin(x * 0.16) * Math.cos(zz * 0.23) * 1.4 +
      Math.sin(x * 0.42 + 1.7) * 0.7 +
      Math.cos(x * 0.08 - zz * 0.12) * 1.9 +
      Math.sin(x * 1.1 + zz * 0.7) * 0.25;
    h = Math.max(0, h + 1.2) * amp * 0.45;
    // creuser une vallée au centre pour laisser voir l'aurore
    var valley = Math.exp(-(x * x) / 900);
    h *= (1.0 - valley * 0.55);
    if (lake) {
      // bassin du lac : on creuse sous le niveau de l'eau
      var bx = x / 12, bz = (zz - 10) / 8;
      var basin = Math.exp(-(bx * bx + bz * bz));
      h = h * (1 - basin * 0.9) - basin * 1.6;
      // aplatir l'avant-scène : pas de pics collés à la caméra
      var front = Math.max(0, (zz - 14) / 8);
      h *= Math.max(0, 1 - front * front);
    }
    return h;
  }

  /* ---------- Montagnes low-poly enneigées ---------- */
  function buildMountains(o) {
    var w = o.width || 160, d = o.depth, segW = Math.round(w / 1.8), segD = Math.round(d / 2);
    var geo = new THREE.PlaneGeometry(w, d, segW, segD);
    geo.rotateX(-Math.PI / 2);

    var pos = geo.attributes.position;
    var colors = [];
    var base = new THREE.Color(o.base);
    var snowCol = new THREE.Color(0xd7e3f4);   // neige claire
    var shoreCol = new THREE.Color(0x93add1);  // rive givrée
    var deepCol = new THREE.Color(0x0a1526);   // fond du lac
    var meadowCol = new THREE.Color(0x2f6b4d); // herbe des berges

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var zz = pos.getZ(i);
      var h = groundHeight(x, zz, o.amp, o.lake);
      pos.setY(i, h);

      var c;
      if (o.lake && h < 0.4) {
        c = deepCol.clone(); // sous l'eau
      } else {
        var t = Math.max(0, Math.min((h - 0.3) / (o.amp * 1.5), 1));
        var snowT = Math.min(0.3 + Math.pow(t, 0.65) * o.snow, 1);
        c = base.clone().lerp(snowCol, snowT);
        if (o.lake) {
          // distance elliptique au lac : les berges proches verdissent
          var ex = x / 12, ez = (zz - 10) / 8;
          var eDist = Math.sqrt(ex * ex + ez * ez);
          if (eDist < 1.9 && h < 1.4) {
            c.lerp(meadowCol, Math.max(0, (1.4 - h)) * 0.75); // prairie
          } else if (h < 1.0) {
            c.lerp(shoreCol, (1.0 - h) * 0.45); // givre près de l'eau
          }
        }
      }
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // DoubleSide : les pentes latérales vues de biais ne disparaissent plus
    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -2.5, o.z);
    scene.add(mesh);

    return mesh;
  }

  /* ---------- Lac : eau calme, reflets d'aurore, bord givré ---------- */
  function buildLake() {
    var geo = new THREE.CircleGeometry(1, 72);
    geo.rotateX(-Math.PI / 2);

    lakeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: [
        "varying vec2 vUv;",
        "void main() {",
        "  vUv = uv;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec2 vUv;",
        "uniform float uTime;",
        "",
        "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
        "float noise(vec2 p) {",
        "  vec2 i = floor(p); vec2 f = fract(p);",
        "  vec2 u = f * f * (3.0 - 2.0 * f);",
        "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
        "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
        "}",
        "float fbm(vec2 p) {",
        "  float v = 0.0; float a = 0.5;",
        "  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }",
        "  return v;",
        "}",
        "",
        "void main() {",
        "  vec2 p = (vUv - 0.5) * 2.0;",
        "  float r = length(p);",
        "  float t = uTime;",
        "",
        "  float ripple  = fbm(vec2(p.x * 6.0 + t * 0.15, p.y * 9.0 - t * 0.10));",
        "  float ripple2 = fbm(vec2(p.x * 14.0 - t * 0.22, p.y * 20.0 + t * 0.13));",
        "",
        "  vec3 deep   = vec3(0.05, 0.10, 0.20);",
        "  vec3 green  = vec3(0.20, 0.83, 0.60);",
        "  vec3 violet = vec3(0.55, 0.42, 0.93);",
        "",
        "  // reflets des aurores : longues bandes douces",
        "  float streak = fbm(vec2(p.x * 3.0 + t * 0.06, p.y * 0.8));",
        "  vec3 col = deep + green * streak * 0.30 + violet * ripple * 0.18;",
        "",
        "  // scintillements",
        "  float glint = smoothstep(0.72, 0.95, ripple2);",
        "  col += vec3(0.7, 0.85, 1.0) * glint * 0.35;",
        "",
        "  // traînée argentée de la lune (côté gauche)",
        "  float moonBand = exp(-pow((p.x + 0.5) * 2.4, 2.0));",
        "  col += vec3(0.80, 0.84, 0.90) * moonBand * (0.08 + glint * 0.30);",
        "",
        "  // bord du lac givré",
        "  float rim = smoothstep(0.70, 1.0, r);",
        "  col = mix(col, vec3(0.70, 0.80, 0.92), rim * 0.85);",
        "",
        "  float alpha = mix(0.88, 0.96, rim);",
        "  alpha *= 1.0 - smoothstep(0.97, 1.0, r);",
        "  gl_FragColor = vec4(col, alpha);",
        "}"
      ].join("\n")
    });

    var lake = new THREE.Mesh(geo, lakeMat);
    lake.scale.set(14, 1, 9.5);
    lake.position.set(0, -2.1, 4);
    scene.add(lake);
  }

  /* ---------- Prairie : herbe et fleurs autour du lac ---------- */
  function buildMeadow() {
    var AMP = 3.4, MESH_Z = -6; // mêmes paramètres que le terrain de premier plan
    var dummy = new THREE.Object3D();

    // cherche un point de berge valide (au-dessus de l'eau, pas trop haut)
    function shoreSpot(minD, maxD) {
      for (var k = 0; k < 40; k++) {
        var x = (Math.random() - 0.5) * 48;
        var z = -14 + Math.random() * 30;
        var zz = z - MESH_Z;
        var ex = x / 12, ez = (zz - 10) / 8;
        var d = Math.sqrt(ex * ex + ez * ez);
        if (d < minD || d > maxD) continue;
        var h = groundHeight(x, zz, AMP, true);
        if (h < 0.45 || h > 1.35) continue;
        return { x: x, y: -2.5 + h, z: z };
      }
      return null;
    }

    // --- herbe ---
    var bladeGeo = new THREE.PlaneGeometry(0.09, 0.6);
    bladeGeo.translate(0, 0.3, 0); // pied du brin à l'origine
    var grassMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true });
    var GRASS = 600;
    var grass = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS);
    var greens = [
      new THREE.Color(0x3f7d58), new THREE.Color(0x4f9a6b),
      new THREE.Color(0x2e5d43), new THREE.Color(0x63a877)
    ];
    var placed = 0, guard = 0;
    while (placed < GRASS && guard++ < GRASS * 4) {
      var s = shoreSpot(0.95, 1.95);
      if (!s) continue;
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
      var sc = 0.7 + Math.random() * 0.8;
      dummy.scale.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
      dummy.updateMatrix();
      grass.setMatrixAt(placed, dummy.matrix);
      grass.setColorAt(placed, greens[(Math.random() * greens.length) | 0]);
      placed++;
    }
    grass.count = placed;
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    scene.add(grass);

    // --- fleurs ---
    var petalGeo = new THREE.CircleGeometry(0.11, 6);
    var flowerMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true });
    var FLOWERS = 150;
    var flowers = new THREE.InstancedMesh(petalGeo, flowerMat, FLOWERS);
    var petals = [
      new THREE.Color(0xf472b6), new THREE.Color(0xa78bfa), new THREE.Color(0xfbbf24),
      new THREE.Color(0xf8fafc), new THREE.Color(0xfb7185)
    ];
    var fPlaced = 0, fGuard = 0;
    while (fPlaced < FLOWERS && fGuard++ < FLOWERS * 4) {
      var f = shoreSpot(1.0, 1.8);
      if (!f) continue;
      dummy.position.set(f.x, f.y + 0.14, f.z);
      dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.7, 0, Math.random() * Math.PI * 2);
      var fs = 0.7 + Math.random() * 0.9;
      dummy.scale.set(fs, fs, fs);
      dummy.updateMatrix();
      flowers.setMatrixAt(fPlaced, dummy.matrix);
      flowers.setColorAt(fPlaced, petals[(Math.random() * petals.length) | 0]);
      fPlaced++;
    }
    flowers.count = fPlaced;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    scene.add(flowers);
  }

  /* ---------- Lune : disque cratérisé + halo ---------- */
  function buildMoon() {
    var vert = [
      "varying vec2 vUv;",
      "void main() {",
      "  vUv = uv;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n");

    // halo (ajouté d'abord pour être derrière le disque)
    var halo = new THREE.Mesh(
      new THREE.CircleGeometry(13, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: vert,
        fragmentShader: [
          "varying vec2 vUv;",
          "void main() {",
          "  float r = length((vUv - 0.5) * 2.0);",
          "  float a = pow(max(0.0, 1.0 - r), 2.4) * 0.55;",
          "  gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, a);",
          "}"
        ].join("\n")
      })
    );
    halo.position.set(-32, 37, -74.6);
    halo.lookAt(camera.position);
    scene.add(halo);

    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: vert,
        fragmentShader: [
          "varying vec2 vUv;",
          "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
          "float noise(vec2 p) {",
          "  vec2 i = floor(p); vec2 f = fract(p);",
          "  vec2 u = f * f * (3.0 - 2.0 * f);",
          "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
          "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
          "}",
          "float fbm(vec2 p) {",
          "  float v = 0.0; float a = 0.5;",
          "  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }",
          "  return v;",
          "}",
          "void main() {",
          "  vec2 p = (vUv - 0.5) * 2.0;",
          "  float r = length(p);",
          "  float discA = 1.0 - smoothstep(0.93, 1.0, r);",
          "  float crater = fbm(p * 3.2 + vec2(7.3, 2.1));",
          "  float crater2 = fbm(p * 7.0 + vec2(1.7, 9.2));",
          "  float shade = 1.0 - crater * 0.20 - crater2 * 0.10;",
          "  shade *= 1.0 - smoothstep(0.55, 1.0, r) * 0.28;", // assombrir le limbe
          "  vec3 col = vec3(0.97, 0.95, 0.88) * shade;",
          "  gl_FragColor = vec4(col, discA * 0.98);",
          "}"
        ].join("\n")
      })
    );
    disc.position.set(-32, 37, -74);
    disc.lookAt(camera.position);
    scene.add(disc);
  }

  /* ---------- Forêt boréale : sapins enneigés (instances) ---------- */
  function buildForest(o) {
    var geo = new THREE.ConeGeometry(0.52, 1.5, 6);
    geo.translate(0, 0.75, 0); // base à l'origine

    // couleur par sommet : vert foncé en bas, neige au sommet
    var pos = geo.attributes.position;
    var colors = [];
    var green = new THREE.Color(0x1f4230);
    var snow = new THREE.Color(0xdce8f5);
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      var t = Math.max(0, Math.min((y - 0.55) / 0.9, 1));
      var c = green.clone().lerp(snow, Math.pow(t, 1.4) * 0.85);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    var trees = new THREE.InstancedMesh(geo, mat, o.count);
    var dummy = new THREE.Object3D();

    var placed = 0, guard = 0;
    while (placed < o.count && guard++ < o.count * 6) {
      var x = (Math.random() - 0.5) * o.xSpread;
      var zz = o.zMin + Math.random() * (o.zMax - o.zMin);
      var h = groundHeight(x, zz, o.amp, o.lake);
      if (h < o.minH) continue; // pas dans l'eau ni trop bas
      if (o.avoidLake) {
        var ex = x / 12, ez = (zz - 10) / 8;
        if (Math.sqrt(ex * ex + ez * ez) < 2.15) continue; // laisser la berge + le caribou
      }
      dummy.position.set(x, -2.5 + h, zz + o.zBase);
      dummy.rotation.y = Math.random() * Math.PI;
      var s = o.minS + Math.random() * (o.maxS - o.minS);
      dummy.scale.set(s * (0.7 + Math.random() * 0.3), s, s * (0.7 + Math.random() * 0.3));
      dummy.updateMatrix();
      trees.setMatrixAt(placed++, dummy.matrix);
    }
    trees.count = placed;
    trees.instanceMatrix.needsUpdate = true;
    scene.add(trees);
  }

  /* ---------- Caribou low-poly qui se promène et boit au lac ---------- */
  function terrainY(x, z) {
    return -2.5 + groundHeight(x, z + 6, 3.4, true);
  }

  function buildCaribou() {
    var g = new THREE.Group();
    function box(w, h, d, color) {
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: color, fog: true }));
    }

    var bodyY = 1.0;
    var body = box(0.55, 0.62, 1.5, 0x5a4632);
    body.position.set(0, bodyY, 0);
    g.add(body);

    var rump = box(0.58, 0.42, 0.42, 0xcabfa6); // tache claire arrière
    rump.position.set(0, bodyY + 0.06, -0.62);
    g.add(rump);

    // cou + tête (pivot pour boire)
    var neckPivot = new THREE.Group();
    neckPivot.position.set(0, bodyY + 0.14, 0.72);
    g.add(neckPivot);
    var neck = box(0.34, 0.72, 0.34, 0x63503a);
    neck.position.set(0, 0.3, 0.12);
    neck.rotation.x = -0.5;
    neckPivot.add(neck);
    var head = box(0.3, 0.34, 0.62, 0x63503a);
    head.position.set(0, 0.64, 0.42);
    neckPivot.add(head);
    var muzzle = box(0.22, 0.2, 0.24, 0x3a2c20);
    muzzle.position.set(0, 0.6, 0.74);
    neckPivot.add(muzzle);
    var earL = box(0.06, 0.18, 0.12, 0x4a3a2a); earL.position.set(0.16, 0.78, 0.28); neckPivot.add(earL);
    var earR = box(0.06, 0.18, 0.12, 0x4a3a2a); earR.position.set(-0.16, 0.78, 0.28); neckPivot.add(earR);

    // bois
    function antler(side) {
      var a = new THREE.Group();
      a.position.set(0.11 * side, 0.82, 0.34);
      neckPivot.add(a);
      var beam = box(0.05, 0.66, 0.05, 0xb8a98f); beam.position.set(0.09 * side, 0.28, 0); beam.rotation.z = -0.45 * side; a.add(beam);
      var t1 = box(0.04, 0.32, 0.04, 0xb8a98f); t1.position.set(0.2 * side, 0.5, 0.06); t1.rotation.z = -0.95 * side; a.add(t1);
      var t2 = box(0.04, 0.26, 0.04, 0xb8a98f); t2.position.set(0.26 * side, 0.34, -0.06); t2.rotation.z = -1.2 * side; a.add(t2);
    }
    antler(1); antler(-1);

    // pattes
    var legs = [];
    function leg(x, z) {
      var p = new THREE.Group();
      p.position.set(x, bodyY - 0.12, z);
      g.add(p);
      var l = box(0.13, 0.86, 0.13, 0x3f3024); l.position.set(0, -0.43, 0); p.add(l);
      var hoof = box(0.15, 0.12, 0.17, 0x241a12); hoof.position.set(0, -0.84, 0); p.add(hoof);
      legs.push(p);
      return p;
    }
    var fl = leg(0.22, 0.55), fr = leg(-0.22, 0.55), bl = leg(0.22, -0.55), br = leg(-0.22, -0.55);

    // ombre au sol
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0x0a1526, transparent: true, opacity: 0.32, fog: true })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    g.add(shadow);

    scene.add(g);

    // itinéraire le long de la berge, avec 2 arrêts pour boire
    var wps = [
      { x: -8, z: 12 }, { x: -5, z: 11, drink: true }, { x: -1, z: 12.5 },
      { x: 3, z: 12.5 }, { x: 6, z: 11.5, drink: true }, { x: 7.5, z: 13.5 },
      { x: 2, z: 14.5 }, { x: -4, z: 14 }
    ];
    var wi = 0;
    var pos = { x: wps[0].x, z: wps[0].z };
    var heading = 0, mode = "walk", drinkT = 0, drinkPitch = 0, walkPhase = 0;

    function update(dt) {
      var tgt = wps[wi];
      if (mode === "walk") {
        var dx = tgt.x - pos.x, dz = tgt.z - pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.25) {
          if (tgt.drink) { mode = "drink"; drinkT = 0; }
          wi = (wi + 1) % wps.length;
        } else {
          var sp = 1.15;
          pos.x += dx / dist * sp * dt;
          pos.z += dz / dist * sp * dt;
          var want = Math.atan2(dx, dz);
          var d = want - heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          heading += d * Math.min(1, dt * 4);
          walkPhase += dt * 7;
        }
      } else {
        drinkT += dt;
        var target = (drinkT > 0.8 && drinkT < 4.5) ? 1 : 0; // baisse puis relève
        drinkPitch += (target - drinkPitch) * Math.min(1, dt * 2.5);
        if (drinkT > 5.5 && drinkPitch < 0.05) mode = "walk";
      }

      g.position.set(pos.x, terrainY(pos.x, pos.z), pos.z);
      g.rotation.y = heading;
      neckPivot.rotation.x = drinkPitch * 1.3;

      var swing = (mode === "walk") ? Math.sin(walkPhase) * 0.5 : 0;
      fl.rotation.x = swing; br.rotation.x = swing;
      fr.rotation.x = -swing; bl.rotation.x = -swing;
      body.position.y = bodyY + (mode === "walk" ? Math.abs(Math.sin(walkPhase)) * 0.03 : 0);
    }

    return { update: update };
  }

  /* ---------- Neige ---------- */
  function buildSnow() {
    var geo = new THREE.BufferGeometry();
    var positions = new Float32Array(SNOW_COUNT * 3);
    snowVel = new Float32Array(SNOW_COUNT * 2); // vitesse y + dérive x

    for (var i = 0; i < SNOW_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60 + 5;
      snowVel[i * 2] = 0.9 + Math.random() * 1.6;      // chute
      snowVel[i * 2 + 1] = (Math.random() - 0.5) * 0.5; // dérive
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    var mat = new THREE.PointsMaterial({
      color: 0xe8f1fb,
      size: 0.18,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    snow = new THREE.Points(geo, mat);
    scene.add(snow);
  }

  /* ---------- Étoiles fixes ---------- */
  function buildStars() {
    var geo = new THREE.BufferGeometry();
    var n = 420;
    var positions = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 220;
      positions[i * 3 + 1] = 8 + Math.random() * 70;
      positions[i * 3 + 2] = -55 - Math.random() * 40;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    scene.add(new THREE.Points(geo, mat));
  }

  /* ---------- Boucle ---------- */
  function tick() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    // canvas masqué (page de connexion) : on ne rend rien
    if (!canvas.offsetWidth) return;

    if (auroraMat) auroraMat.uniforms.uTime.value = t;
    if (lakeMat) lakeMat.uniforms.uTime.value = t;
    if (caribou) caribou.update(dt);

    // neige
    if (snow) {
      var p = snow.geometry.attributes.position;
      for (var i = 0; i < SNOW_COUNT; i++) {
        var y = p.getY(i) - snowVel[i * 2] * dt;
        var x = p.getX(i) + snowVel[i * 2 + 1] * dt + Math.sin(t * 0.8 + i) * 0.004;
        if (y < -3) { y = 38; x = (Math.random() - 0.5) * 90; }
        p.setY(i, y);
        p.setX(i, x);
      }
      p.needsUpdate = true;
    }

    // parallaxe douce (discrète pour éviter les angles rasants sur les bords)
    targetX += (mouseX - targetX) * 0.03;
    targetY += (mouseY - targetY) * 0.03;
    camera.position.x = targetX * 1.1;
    camera.position.y = 4.2 + targetY * 0.6 + Math.sin(t * 0.4) * 0.12;
    camera.lookAt(0, 6, -40);

    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onPointerMove(e) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
  }

  function onVisibility() {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
    } else {
      clock.getDelta(); // purge le delta accumulé
      renderer.setAnimationLoop(tick);
    }
  }

  try {
    init();
  } catch (err) {
    canvas.style.display = "none";
    document.body.classList.add("no-motion");
  }
})();
