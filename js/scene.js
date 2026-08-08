/* EV Battery Lab — Three.js scenes
   Scene 1: 360° car (GLTF, OrbitControls)
   Scene 2: live battery fill (predictor)
   Scene 3: 2000-sample point cloud (Cycle x Temperature x SoH)
   Falls back to static graphics when WebGL/THREE is unavailable. */

"use strict";

(function () {
  const CDN_VER = "0.128.0";

  function webglOk() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) {
      return false;
    }
  }

  if (!window.THREE || !webglOk()) {
    document.documentElement.classList.add("no-webgl");
    return;
  }

  const THREE = window.THREE;

  /* ---------------- helpers ---------------- */

  function makeScene(canvas, opts = {}) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      opts.fov || 40,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.1, 100
    );
    const api = {
      renderer, scene, camera,
      controls: null,
      paused: false,
      anims: [],
      setSize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      add(fn) { this.anims.push(fn); },
      loop() {
        if (!api.paused) {
          for (const fn of api.anims) fn();
          renderer.render(scene, camera);
        }
      },
      start() {
        renderer.setAnimationLoop(() => api.loop());
        api.setSize();
      },
      pause() { api.paused = true; },
      resume() { api.paused = false; },
    };
    return api;
  }

  function watchVisibility(canvas, api) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) api.resume();
          else api.pause();
        }
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);
  }

  function onResize(api) {
    window.addEventListener("resize", () => api.setSize());
  }

  function makeOrbit(canvas, api, opts = {}) {
    if (!THREE.OrbitControls) return null;
    const ctrl = new THREE.OrbitControls(api.camera, canvas);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    ctrl.enableZoom = !!opts.zoom;
    ctrl.autoRotate = opts.autoRotate !== false;
    ctrl.autoRotateSpeed = opts.autoRotateSpeed || 1.4;
    ctrl.minPolarAngle = Math.PI / 2.25;
    ctrl.maxPolarAngle = Math.PI / 1.55;
    ctrl.minDistance = 3.5;
    ctrl.maxDistance = 8;
    api.controls = ctrl;
    api.add(() => ctrl.update());
    return ctrl;
  }

  function addLights(scene) {
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x1c3a2e, 1.0));
    const key = new THREE.DirectionalLight(0xfff8e8, 1.15);
    key.position.set(4, 7, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9adfae, 0.5);
    fill.position.set(-5, 3, -4);
    scene.add(fill);
  }

  function radialTexture(inner, outer) {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.55, outer);
    g.addColorStop(1, "rgba(28,58,46,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  /* ---------------- Scene 1: the car ---------------- */

  function initCar(canvas, stage) {
    const api = makeScene(canvas, { fov: 36 });
    addLights(api.scene);
    makeOrbit(canvas, api, { autoRotate: true, autoRotateSpeed: 1.1 });

    api.camera.position.set(4.6, 2.2, 6.2);
    api.camera.lookAt(0, 0.6, 0);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({
        map: radialTexture("rgba(28,58,46,0.20)", "rgba(28,58,46,0.07)"),
        transparent: true,
        depthWrite: false,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    api.scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.62, 2.66, 64),
      new THREE.MeshBasicMaterial({ color: 0x1c3a2e, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.005;
    api.scene.add(ring);

    const loader = new THREE.GLTFLoader();
    loader.load(
      "assets/ferrari.glb",
      (gltf) => {
        const car = gltf.scene;
        const box = new THREE.Box3().setFromObject(car);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const s = 3.4 / maxDim;
        car.scale.setScalar(s);
        box.setFromObject(car);
        const center = box.getCenter(new THREE.Vector3());
        car.position.x -= center.x * s;
        car.position.z -= center.z * s;
        car.position.y -= box.min.y * s;
        car.position.y = 0;

        car.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = false;
            if (o.material) {
              o.material.metalness = Math.min(1, (o.material.metalness ?? 0) + 0.15);
              o.material.roughness = Math.max(0.15, (o.material.roughness ?? 0.5) - 0.1);
            }
          }
        });

        api.scene.add(car);
        const loaders = stage.querySelectorAll(".stage-loader");
        loaders.forEach((l) => l.classList.add("hidden"));
        setTimeout(() => loaders.forEach((l) => l.remove()), 700);

        api.add(() => {
          const t = Date.now() * 0.001;
          const dust = new THREE.Vector3(0, 0.35, 1.1);
          dust.x += Math.sin(t * 1.7) * 1.5;
          dust.y += Math.abs(Math.sin(t * 2.3)) * 0.15;
          // no-op kept for future particles
        });
      },
      undefined,
      (err) => {
        const fb = stage.querySelector(".glb-fallback");
        if (fb) fb.style.display = "flex";
        const loaders = stage.querySelectorAll(".stage-loader");
        loaders.forEach((l) => l.remove());
      }
    );

    api.start();
    watchVisibility(canvas, api);
    onResize(api);
  }

  /* ---------------- Scene 2: battery fill ---------------- */

  function initBattery(canvas, onReady) {
    const api = makeScene(canvas, { fov: 32 });
    addLights(api.scene);
    makeOrbit(canvas, api, { autoRotate: true, autoRotateSpeed: 0.8, zoom: true });

    api.camera.position.set(2.4, 1.8, 3.6);
    api.camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    api.scene.add(group);

    const SHELL_H = 2.3, SHELL_W = 1.6, SHELL_D = 1.0;

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(SHELL_W, SHELL_H, SHELL_D),
      new THREE.MeshStandardMaterial({
        color: 0x1c3a2e,
        transparent: true,
        opacity: 0.14,
        roughness: 0.35,
        metalness: 0.1,
      })
    );
    group.add(shell);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(SHELL_W, SHELL_H, SHELL_D)),
      new THREE.LineBasicMaterial({ color: 0x1c3a2e, transparent: true, opacity: 0.55 })
    );
    group.add(frame);

    const liquid = new THREE.Mesh(
      new THREE.BoxGeometry(SHELL_W - 0.12, 1, SHELL_D - 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x3fbf5f,
        emissive: 0x3fbf5f,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        transparent: true,
        opacity: 0.92,
      })
    );
    group.add(liquid);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(SHELL_W + 0.1, 0.08, SHELL_D + 0.1),
      new THREE.MeshStandardMaterial({ color: 0x1c3a2e, roughness: 0.5 })
    );
    cap.position.y = SHELL_H / 2 + 0.04;
    group.add(cap);

    const termGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.26, 20);
    const termMat = new THREE.MeshStandardMaterial({ color: 0x2e9b4a, metalness: 0.8, roughness: 0.25 });
    const t1 = new THREE.Mesh(termGeo, termMat);
    t1.position.set(-0.35, SHELL_H / 2 + 0.19, 0);
    const t2 = new THREE.Mesh(termGeo, termMat);
    t2.position.set(0.35, SHELL_H / 2 + 0.19, 0);
    group.add(t1, t2);

    const MAX_H = SHELL_H - 0.3;
    const BOTTOM = -SHELL_H / 2 + 0.15;

    function setLiquid(frac) {
      const h = Math.max(0.01, MAX_H * frac);
      liquid.scale.y = h;
      liquid.position.y = BOTTOM + h / 2;
    }

    function setColor(soh) {
      const stops = [
        { t: 100, c: new THREE.Color(0x3fbf5f) },
        { t: 75, c: new THREE.Color(0xe8a13c) },
        { t: 45, c: new THREE.Color(0xd95d3f) },
      ];
      const s = Math.max(stops[2].t, Math.min(stops[0].t, soh));
      let a = stops[0], b = stops[1];
      if (s < 75) { a = stops[1]; b = stops[2]; }
      const col = a.c.clone().lerp(b.c, (s - a.t) / (b.t - a.t));
      liquid.material.color.copy(col);
      liquid.material.emissive.copy(col);
    }

    let current = 1, target = 1, animating = false;

    function setSoH(soh, animate) {
      const frac = Math.max(0, Math.min(100, soh)) / 100;
      if (animate) {
        target = frac;
        if (!animating) {
          animating = true;
          const t0 = performance.now();
          const from = current, dur = 900;
          const tick = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - k, 3);
            const v = from + (target - from) * eased;
            current = v;
            setLiquid(v);
            setColor(v * 100);
            if (k < 1) requestAnimationFrame(tick);
            else animating = false;
          };
          requestAnimationFrame(tick);
        }
      } else {
        current = target = frac;
        setLiquid(frac);
        setColor(frac * 100);
      }
    }

    setLiquid(1);
    setColor(100);

    api.add(() => {
      group.rotation.y += 0.0035;
    });

    api.start();
    watchVisibility(canvas, api);
    onResize(api);
    onReady({ setSoH });
  }

  /* ---------------- Scene 3: point cloud ---------------- */

  function initCloud(canvas, pointsUrl) {
    const api = makeScene(canvas, { fov: 45 });
    addLights(api.scene);
    makeOrbit(canvas, api, { autoRotate: true, autoRotateSpeed: 0.7, zoom: true });

    api.camera.position.set(2.4, 1.6, 3.2);
    api.camera.lookAt(0, 0, 0);

    fetch(pointsUrl)
      .then((r) => r.json())
      .then((pts) => {
        const N = pts.length;
        const positions = new Float32Array(N * 3);
        const colors = new Float32Array(N * 3);

        const mins = [Infinity, Infinity, Infinity];
        const maxs = [-Infinity, -Infinity, -Infinity];
        for (const p of pts) for (let i = 0; i < 3; i++) {
          if (p[i] < mins[i]) mins[i] = p[i];
          if (p[i] > maxs[i]) maxs[i] = p[i];
        }
        const norm = (v, i) => (v - mins[i]) / (maxs[i] - mins[i]);

        const sohLo = new THREE.Color(0xd95d3f);
        const sohHi = new THREE.Color(0x3fbf5f);

        for (let i = 0; i < N; i++) {
          positions[i * 3] = norm(pts[i][0], 0);
          positions[i * 3 + 1] = norm(pts[i][1], 1);
          positions[i * 3 + 2] = norm(pts[i][2], 2);
          const c = sohLo.clone().lerp(sohHi, norm(pts[i][2], 2));
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const points = new THREE.Points(
          geo,
          new THREE.PointsMaterial({
            size: 0.014,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
          })
        );
        api.scene.add(points);

        const axes = [
          { a: [0, 0, 0], b: [1.08, 0, 0], c: 0x2e9b4a },
          { a: [0, 0, 0], b: [0, 1.08, 0], c: 0xe8a13c },
          { a: [0, 0, 0], b: [0, 0, 1.08], c: 0xd95d3f },
        ];
        for (const ax of axes) {
          const g = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...ax.a),
            new THREE.Vector3(...ax.b),
          ]);
          const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: ax.c, transparent: true, opacity: 0.8 }));
          api.scene.add(line);
        }

        const cloud = new THREE.Group();
        cloud.add(points, ...api.scene.children.filter((o) => o.isLine));
        api.scene.clear();
        api.scene.add(cloud);
        api.add(() => { cloud.rotation.y += 0.002; });
      });

    api.start();
    watchVisibility(canvas, api);
    onResize(api);
  }

  /* ---------------- boot ---------------- */

  window.SceneKit = {
    init(model, pointsUrl, hooks) {
      const carStage = document.getElementById("car-stage");
      const carCanvas = document.getElementById("car-canvas");
      if (carCanvas && carStage) initCar(carCanvas, carStage);

      const batteryCanvas = document.getElementById("battery-canvas");
      if (batteryCanvas) initBattery(batteryCanvas, (api) => hooks.onBattery && hooks.onBattery(api));

      const cloudCanvas = document.getElementById("cloud-canvas");
      if (cloudCanvas) initCloud(cloudCanvas, pointsUrl);
    },
  };
})();
