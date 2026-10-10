/**
 * ATOMIC CORE — Interactive Anatomy Screen & Procedural Three.js 3D Engine
 *
 * Fully procedural VVER-1200 power unit (no external model files):
 *  - 6 interactive cutaway nodes, each a THREE.Group with userData.nodeId:
 *      core, control-rods, pressurizer, rcp, steam-generator, turbogenerator
 *  - Primary loop (red hot leg / blue cold leg) and secondary loop (teal) as rounded
 *    TubeGeometry pipes with pulsing emissive flow sleeves
 *  - PBR palette: graphite / titanium / dark indigo, procedural PMREM environment
 *  - Vavilov–Cherenkov glow (additive volumes, sparkles, PointLight) inside the reactor
 *  - Raycaster: hover (pointer cursor + emissive pulse + tooltip), click (camera fly-to,
 *    accent bracket outline, inspector update from js/data.js)
 *  - AZ-1 scram: control rods drop 4 s in 3D, Cherenkov glow fades to a dim smolder
 *  - OrbitControls kept: orbit, wheel zoom, pan
 */

window.AnatomyView = (function () {
  // ==========================================================================
  // Constants
  // ==========================================================================
  const NODE_IDS = ["core", "control-rods", "pressurizer", "rcp", "steam-generator", "turbogenerator"];

  const CIRCUIT_MEMBERS = {
    "circuit-1": ["core", "control-rods", "pressurizer", "rcp", "steam-generator"],
    "circuit-2": ["steam-generator", "turbogenerator"]
  };

  const ACCENT_HEX = 0x38bdf8;
  const OUTLINE_HEX = 0x7dd3fc;

  const SCRAM_DROP_SECONDS = 4.0;   // rods fall in 4 s
  const ROD_RESET_SECONDS = 8.0;    // rods are lifted back slowly
  const ROD_STROKE = 4.0;           // meters of rod travel
  const GLOW_DIM = 0.06;            // smoldering level after scram

  const HOME_TARGET = [12, 4.8, 0];
  const HOME_POSITION = [36, 21, 38];
  const FOCUS_DIR = [0.72, 0.5, 0.95];

  // World-space bounds for each node (used for outline brackets and camera fly-to)
  const NODE_BOUNDS = {
    "core": { min: [-2.5, 0.2, -2.5], max: [2.9, 9.9, 2.5] },
    "control-rods": { min: [-1.7, 6.1, -1.7], max: [1.7, 12.1, 1.7] },
    "pressurizer": { min: [6.7, 0.4, -8.8], max: [9.3, 11.0, -6.2] },
    "rcp": { min: [6.3, 0.0, 2.0], max: [9.8, 9.1, 4.4] },
    "steam-generator": { min: [12.6, 2.2, -5.9], max: [17.8, 7.1, 5.9] },
    "turbogenerator": { min: [22.7, 0.0, -8.2], max: [27.4, 5.6, 9.9] }
  };

  const LABEL_POS = {
    "core": [-3.6, 6.0, 0],
    "control-rods": [0, 13.2, 0],
    "pressurizer": [8, 12.2, -7.5],
    "rcp": [8, 10.5, 3.2],
    "steam-generator": [15, 8.2, 3.8],
    "turbogenerator": [25, 7.0, 0]
  };

  // ==========================================================================
  // UI / data state
  // ==========================================================================
  let activeNodeId = "core";
  let activeCircuitFilter = "all";
  let isAz1Tripped = false;

  let globalMode = "scada";
  let nodeModeOverrides = {};

  // ==========================================================================
  // Three.js runtime state
  // ==========================================================================
  let scene = null;
  let camera = null;
  let renderer = null;
  let controls = null;
  let clock = null;
  let raycaster = null;
  let animationFrameId = null;
  let resizeObserver = null;
  let viewportEl = null;
  let tooltipEl = null;

  let nodeGroups = {};
  let nodeMeshes = {};
  let nodeHoverMats = {};
  let nodeAllMats = {};
  let pickables = [];
  let pipes = [];
  let pipeGroups = { 1: null, 2: null };
  let spinners = [];
  let labelSprites = [];

  let rodsGroup = null;
  let coreLight = null;
  let glowMats = [];
  let assemblyMat = null;
  let collectorMats = [];
  let sparkles = null;
  let sparkleData = null;
  let outlineBrackets = null;
  let outlineBox = null;

  let hoveredNodeId = null;
  let hoverAmt = {};
  let nodeFlash = {};
  let pointer = { x: 0, y: 0, cx: 0, cy: 0, inside: false };
  let hoverDirty = false;
  let downPos = null;
  let flight = null;
  let lastZoomBadge = "";
  let frameCounter = 0;

  let rodProgress = 0;
  let rodDirection = 0;
  let glowLevel = 1;
  let thermalLevel = 1;
  let steamLevel = 1;
  let spinSpeed = 1;

  // ==========================================================================
  // Main render (called by Router)
  // ==========================================================================
  function render(container) {
    cleanupThreeScene();

    const filterClass = (f) => (activeCircuitFilter === f ? "filter-btn active" : "filter-btn");

    container.innerHTML = `
      <div class="anatomy-viewport view-enter">
        <div class="anatomy-workspace">
          <!-- Left Column: 3D WebGL Viewport & HUD -->
          <div class="schematic-column">
            <header class="anatomy-toolbar">
              <div class="anatomy-title-group">
                <span class="anatomy-screen-tag">GEN III+ / 1200 МВт</span>
                <h1 class="anatomy-screen-title">
                  Анатомия энергоблока ВВЭР-1200
                  <span>| Интерактивная 3D-модель в разрезе</span>
                </h1>
              </div>

              <div class="toolbar-controls">
                <div class="circuit-filters" role="group" aria-label="Фильтры контуров">
                  <button class="${filterClass("all")}" data-filter="all" id="filter-all">Все контуры</button>
                  <button class="${filterClass("circuit-1")}" data-filter="circuit-1" id="filter-c1">1-й контур (16.2 МПа)</button>
                  <button class="${filterClass("circuit-2")}" data-filter="circuit-2" id="filter-c2">2-й контур (7.0 МПа)</button>
                </div>

                <button class="az1-scram-btn ${isAz1Tripped ? "tripped" : ""}" id="az1-trigger-btn" title="Аварийная защита реактора">
                  <span class="az1-icon">⚡</span>
                  <span id="az1-btn-text">${isAz1Tripped ? "АЗ-1 СРАБОТАЛА (СБРОСИТЬ)" : "АЗ-1 (СБРОС СУЗ)"}</span>
                </button>
              </div>
            </header>

            <section class="schematic-card" aria-label="3D-модель реакторного отделения">
              <div class="canvas-header-bar">
                <div class="canvas-legend">
                  <div class="legend-item">
                    <span class="legend-swatch swatch-c1-hot"></span>
                    <span>Горячая нитка 1К (328°C)</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-swatch swatch-c1-cold"></span>
                    <span>Холодная нитка 1К (298°C)</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-swatch swatch-c2-steam"></span>
                    <span>Паропровод 2К (7.0 МПа)</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-swatch swatch-c2-water"></span>
                    <span>Питательная вода 2К</span>
                  </div>
                </div>

                <div class="canvas-meta-status">
                  <span class="status-beacon"></span>
                  <span id="canvas-status-text">${isAz1Tripped ? "ВНИМАНИЕ: СРАБАТЫВАНИЕ АЗ-1 (РЕАКТОР ЗАГЛУШЕН)" : "3D WEBGL: ОНЛАЙН · КЛИК ПО УЗЛУ"}</span>
                </div>
              </div>

              <div id="reactor-3d-viewport" class="reactor-3d-viewport"></div>

              <div class="canvas-hud-controls" aria-label="Управление 3D-камерой">
                <button class="hud-btn" id="hud-zoom-in" title="Приблизить ([+])" aria-label="Zoom In">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="hud-btn" id="hud-zoom-out" title="Отдалить ([-])" aria-label="Zoom Out">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="hud-btn" id="hud-zoom-reset" title="Общий вид энергоблока ([⟲])" aria-label="Reset Camera">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <span class="hud-zoom-badge" id="hud-zoom-val">100%</span>
              </div>

              <nav class="nodes-switcher-strip" aria-label="Быстрый выбор узлов станции">
                ${generateNodeChips()}
              </nav>
            </section>
          </div>

          <aside class="inspector-card" id="inspector-card-host" aria-label="Телеметрия выбранного узла">
          </aside>
        </div>
      </div>
    `;

    initThreeScene();
    setupEventListeners(container);

    renderInspectorCard(activeNodeId);
    highlightActiveNode(activeNodeId);
  }

  // ==========================================================================
  // Three.js scene bootstrap
  // ==========================================================================
  function initThreeScene() {
    viewportEl = document.getElementById("reactor-3d-viewport");
    if (!viewportEl) return;

    if (typeof THREE === "undefined") {
      viewportEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f43f5e;font-family:var(--font-mono);font-size:0.9rem;text-align:center;padding:1rem;">
          Ошибка: библиотека Three.js не загружена. Проверьте подключение к CDN.
        </div>`;
      return;
    }

    const width = viewportEl.clientWidth || 800;
    const height = viewportEl.clientHeight || 600;

    // --- Scene, fog ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060b);
    scene.fog = new THREE.FogExp2(0x04060b, 0.0075);

    // --- Camera ---
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
    camera.position.set(HOME_POSITION[0], HOME_POSITION[1], HOME_POSITION[2]);

    // --- Renderer ---
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (err) {
      viewportEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f43f5e;font-family:var(--font-mono);font-size:0.9rem;text-align:center;padding:1rem;">
          Ошибка: WebGL недоступен в этом браузере.
        </div>`;
      scene = null;
      camera = null;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewportEl.appendChild(renderer.domElement);

    // --- OrbitControls (orbit / zoom / pan) ---
    if (typeof THREE.OrbitControls === "function") {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.target.set(HOME_TARGET[0], HOME_TARGET[1], HOME_TARGET[2]);
      controls.minDistance = 3;
      controls.maxDistance = 110;
      controls.maxPolarAngle = Math.PI / 2 - 0.02;
      controls.screenSpacePanning = true;
      controls.addEventListener("start", () => { flight = null; });
      controls.update();
    }

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();

    buildEnvironment();
    buildLights();
    buildFloorAndContainment();

    // --- Nodes ---
    nodeGroups = {};
    nodeGroups["core"] = buildReactor();
    nodeGroups["control-rods"] = buildControlRods();
    nodeGroups["pressurizer"] = buildPressurizer();
    nodeGroups["rcp"] = buildRCP();
    nodeGroups["steam-generator"] = buildSteamGenerator();
    nodeGroups["turbogenerator"] = buildTurbogenerator();
    NODE_IDS.forEach((id) => scene.add(nodeGroups[id]));

    buildPipes();
    registerNodes();
    buildLabels();
    buildOutline();

    // --- Initial dynamic state (survives route re-entry) ---
    rodProgress = isAz1Tripped ? 1 : 0;
    rodDirection = 0;
    glowLevel = isAz1Tripped ? GLOW_DIM : 1;
    thermalLevel = isAz1Tripped ? 0.3 : 1;
    steamLevel = isAz1Tripped ? 0.4 : 1;
    spinSpeed = isAz1Tripped ? 0.25 : 1;
    NODE_IDS.forEach((id) => { hoverAmt[id] = 0; nodeFlash[id] = 0; });
    hoveredNodeId = null;
    flight = null;
    lastZoomBadge = "";

    applyCircuitFilter(activeCircuitFilter);
    setOutlineTarget(activeNodeId);

    // --- Tooltip ---
    tooltipEl = document.createElement("div");
    tooltipEl.style.cssText =
      "position:absolute;z-index:6;display:none;pointer-events:none;padding:0.35rem 0.6rem;" +
      "background:rgba(6,10,18,0.92);border:1px solid rgba(56,189,248,0.55);border-radius:6px;" +
      "font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:#e2f3ff;" +
      "box-shadow:0 0 14px rgba(56,189,248,0.3);white-space:nowrap;letter-spacing:0.03em;";
    viewportEl.appendChild(tooltipEl);

    // --- Pointer interaction ---
    const dom = renderer.domElement;
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointerleave", onPointerLeave);

    // --- Resize ---
    window.addEventListener("resize", handleResize);
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(viewportEl);
    }

    animate();
  }

  // ==========================================================================
  // Environment (procedural PMREM "dark lab") & lights
  // ==========================================================================
  function buildEnvironment() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(60, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader:
          "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "varying vec3 vP; void main(){ float h = vP.y * 0.5 + 0.5;" +
          " vec3 c = mix(vec3(0.004,0.006,0.012), vec3(0.03,0.045,0.11), pow(h, 1.6));" +
          " c += vec3(0.0,0.02,0.045) * pow(1.0 - abs(vP.y), 6.0);" +
          " gl_FragColor = vec4(c, 1.0); }"
      })
    );
    envScene.add(sky);

    const panels = [
      { pos: [0, 42, 0], rot: [Math.PI / 2, 0, 0], size: [46, 22], rgb: [3.2, 3.8, 5.2] },
      { pos: [-46, 12, 0], rot: [0, Math.PI / 2, 0], size: [34, 22], rgb: [0.25, 1.7, 2.6] },
      { pos: [32, 16, -42], rot: [0, 0, 0], size: [30, 16], rgb: [1.5, 0.9, 3.4] },
      { pos: [42, 6, 32], rot: [0, -Math.PI / 2, 0], size: [20, 8], rgb: [2.2, 0.35, 0.9] },
      { pos: [0, 18, 46], rot: [0, Math.PI, 0], size: [40, 6], rgb: [1.2, 1.6, 2.4] }
    ];
    panels.forEach((p) => {
      const color = new THREE.Color();
      color.setRGB(p.rgb[0], p.rgb[1], p.rgb[2]);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(p.size[0], p.size[1]),
        new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide })
      );
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      m.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      envScene.add(m);
    });

    const target = pmrem.fromScene(envScene, 0.02);
    scene.environment = target.texture;

    envScene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    pmrem.dispose();
  }

  function buildLights() {
    // Deep dark ambient + cold hemisphere fill
    scene.add(new THREE.AmbientLight(0x0b1020, 0.7));
    scene.add(new THREE.HemisphereLight(0x1e2a52, 0x05070d, 0.55));

    // Key directional (cold white-blue), casts soft shadows
    const key = new THREE.DirectionalLight(0xbcd2ff, 1.25);
    key.position.set(34, 46, 28);
    key.target.position.set(12, 3, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -45;
    key.shadow.camera.right = 45;
    key.shadow.camera.top = 38;
    key.shadow.camera.bottom = -28;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 140;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.05;
    scene.add(key);
    scene.add(key.target);

    // Indigo rim light from behind
    const rim = new THREE.DirectionalLight(0x4f46e5, 0.95);
    rim.position.set(-26, 16, -24);
    scene.add(rim);

    // Point accents
    const turbineAccent = new THREE.PointLight(0x14b8a6, 2.4, 24, 1.6);
    turbineAccent.position.set(25, 7.5, 0);
    scene.add(turbineAccent);

    const sgAccent = new THREE.PointLight(0x6366f1, 2.2, 22, 1.6);
    sgAccent.position.set(15, 9, 6);
    scene.add(sgAccent);

    const prAccent = new THREE.PointLight(0xfb7185, 1.1, 16, 1.6);
    prAccent.position.set(8, 6, -4);
    scene.add(prAccent);

    // Cherenkov core light (cyan #38bdf8) — driven by glowLevel
    coreLight = new THREE.PointLight(0x38bdf8, 6, 20, 1.5);
    coreLight.position.set(0, 4.0, 0);
    scene.add(coreLight);
  }

  function buildFloorAndContainment() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(90, 64),
      new THREE.MeshStandardMaterial({ color: 0x080b14, metalness: 0.7, roughness: 0.55 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.42;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(120, 60, 0x155e75, 0x111827);
    grid.position.y = -0.4;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    // Plant slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(50, 0.4, 25),
      new THREE.MeshStandardMaterial({ color: 0x0e1322, metalness: 0.75, roughness: 0.5, envMapIntensity: 0.9 })
    );
    slab.position.set(11, -0.2, 0);
    slab.receiveShadow = true;
    scene.add(slab);

    const slabEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(50, 0.4, 25)),
      new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.35 })
    );
    slabEdges.position.set(11, -0.2, 0);
    scene.add(slabEdges);

    // Containment footprint ring + faint wireframe shell
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(14.5, 0.07, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(7.5, 0.03, -0.5);
    scene.add(ring);

    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(14.5, 14.5, 15, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x1e3a5f, wireframe: true, transparent: true, opacity: 0.2 })
    );
    shell.position.set(7.5, 7.5, -0.5);
    scene.add(shell);
  }

  // ==========================================================================
  // Material / geometry helpers
  // ==========================================================================
  function std(color, metalness, roughness, extra) {
    const params = Object.assign({ color: color, metalness: metalness, roughness: roughness }, extra || {});
    const m = new THREE.MeshStandardMaterial(params);
    m.userData.hoverable = !(extra && extra.emissive !== undefined);
    if (m.envMapIntensity === undefined || m.envMapIntensity === 1) m.envMapIntensity = 1.1;
    return m;
  }

  function phys(color, metalness, roughness, extra) {
    const params = Object.assign({
      color: color,
      metalness: metalness,
      roughness: roughness,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5
    }, extra || {});
    const m = new THREE.MeshPhysicalMaterial(params);
    m.userData.hoverable = true;
    m.envMapIntensity = 1.15;
    return m;
  }

  function addMesh(group, geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x || 0, y || 0, z || 0);
    group.add(mesh);
    return mesh;
  }

  function instanced(group, geometry, material, items) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const dummy = new THREE.Object3D();
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
    return mesh;
  }

  function domeProfile(radius, depth, dir, yOffset, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector2(radius * Math.cos(t), yOffset + dir * depth * Math.sin(t)));
    }
    return pts;
  }

  // Hexagonal lattice of 163 fuel assemblies (7 rings minus the 6 corners)
  function buildHexCells() {
    const cells = [];
    const R = 0.12;
    for (let q = -7; q <= 7; q++) {
      for (let r = -7; r <= 7; r++) {
        const s = -q - r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        if (ring > 7) continue;
        if (ring === 7 && (q === 0 || r === 0 || s === 0)) continue;
        cells.push({ q: q, r: r, x: Math.sqrt(3) * R * (q + r / 2), z: 1.5 * R * r });
      }
    }
    return cells;
  }

  function makeDotTexture() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(125,211,252,0.7)");
    g.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // Cutaway sector for vertical-axis cylinders/lathes: removes the quadrant x>0, z>0
  const CUT_START = Math.PI / 2;
  const CUT_LENGTH = Math.PI * 1.5;

  // ==========================================================================
  // NODE 1 — Reactor VVER-1200 (cutaway, fuel assemblies, Cherenkov volume)
  // ==========================================================================
  function buildReactor() {
    const g = new THREE.Group();
    g.userData.nodeId = "core";

    const vesselOuter = phys(0x2b3142, 0.9, 0.38, { side: THREE.DoubleSide });
    const vesselInner = std(0x7e889c, 0.9, 0.3, { side: THREE.DoubleSide });
    const dark = std(0x1a1d29, 0.85, 0.42);
    const titanium = std(0x9aa4b8, 0.95, 0.28);
    const barrelMat = std(0x667086, 0.9, 0.34, { side: THREE.DoubleSide });

    // Shell with thickness (outer + inner skins) and cut faces
    addMesh(g, new THREE.CylinderGeometry(2.2, 2.2, 7, 72, 1, true, CUT_START, CUT_LENGTH), vesselOuter, 0, 5.5, 0);
    addMesh(g, new THREE.CylinderGeometry(2.0, 2.0, 7, 72, 1, true, CUT_START, CUT_LENGTH), vesselInner, 0, 5.5, 0);
    addMesh(g, new THREE.BoxGeometry(0.2, 7, 0.04), titanium, 2.1, 5.5, 0);
    addMesh(g, new THREE.BoxGeometry(0.04, 7, 0.2), titanium, 0, 5.5, 2.1);

    // Lower elliptical head (outer + inner)
    addMesh(g, new THREE.LatheGeometry(domeProfile(2.2, 1.3, -1, 0, 18), 72, CUT_START, CUT_LENGTH), vesselOuter, 0, 2.0, 0);
    addMesh(g, new THREE.LatheGeometry(domeProfile(2.0, 1.15, -1, 0, 18), 72, CUT_START, CUT_LENGTH), vesselInner, 0, 2.0, 0);

    // Core barrel + lower grid plate (both cut)
    addMesh(g, new THREE.CylinderGeometry(1.65, 1.65, 4.8, 64, 1, true, CUT_START, CUT_LENGTH), barrelMat, 0, 4.7, 0);
    addMesh(g, new THREE.CylinderGeometry(1.7, 1.7, 0.18, 64, 1, false, CUT_START, CUT_LENGTH), std(0x4a5368, 0.9, 0.35, { side: THREE.DoubleSide }), 0, 2.2, 0);

    // 163 fuel assemblies (hex prisms) — instanced
    const cells = buildHexCells();
    assemblyMat = new THREE.MeshStandardMaterial({
      color: 0x0b1b2e,
      metalness: 0.5,
      roughness: 0.4,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.1
    });
    assemblyMat.userData.hoverable = false;
    instanced(g, new THREE.CylinderGeometry(0.108, 0.108, 3.5, 6), assemblyMat,
      cells.map((c) => ({ x: c.x, y: 4.05, z: c.z })));

    // Bright assembly head tips
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.9 });
    tipMat.userData.hoverable = false;
    instanced(g, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6), tipMat,
      cells.map((c) => ({ x: c.x, y: 5.83, z: c.z })));
    glowMats.push({ mat: tipMat, base: 0.9 });

    // Cherenkov volumes (additive)
    function glowVolume(geo, y, opacity) {
      const m = new THREE.MeshBasicMaterial({
        color: ACCENT_HEX,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      m.userData.hoverable = false;
      const mesh = addMesh(g, geo, m, 0, y, 0);
      mesh.userData.noPick = true;
      mesh.userData.noShadow = true;
      glowMats.push({ mat: m, base: opacity });
      return mesh;
    }
    glowVolume(new THREE.CylinderGeometry(1.55, 1.55, 3.6, 48, 1, true), 4.05, 0.2);
    glowVolume(new THREE.CylinderGeometry(0.7, 0.7, 3.6, 32, 1, true), 4.05, 0.22);
    glowVolume(new THREE.CylinderGeometry(1.4, 0.8, 3.2, 40, 1, true), 7.4, 0.08);
    glowVolume(new THREE.CylinderGeometry(1.95, 1.95, 6.6, 64, 1, true, CUT_START, CUT_LENGTH), 5.6, 0.05);

    // Cherenkov sparkles (rising particles)
    const count = 180;
    const positions = new Float32Array(count * 3);
    sparkleData = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.45;
      const y = 2.4 + Math.random() * 6.0;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      sparkleData.push({ speed: 0.15 + Math.random() * 0.35, ox: Math.cos(a) * r, oz: Math.sin(a) * r, ph: Math.random() * 6.28 });
    }
    const sparkleGeo = new THREE.BufferGeometry();
    sparkleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const sparkleMat = new THREE.PointsMaterial({
      color: 0x7dd3fc,
      size: 0.14,
      map: makeDotTexture(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    sparkleMat.userData.hoverable = false;
    sparkles = new THREE.Points(sparkleGeo, sparkleMat);
    sparkles.userData.noPick = true;
    g.add(sparkles);

    // Upper head (flat thick cover), flange and bolts
    addMesh(g, new THREE.CylinderGeometry(2.35, 2.35, 0.55, 72), vesselOuter, 0, 9.275, 0);
    const flange = addMesh(g, new THREE.TorusGeometry(2.3, 0.14, 12, 72), titanium, 0, 9.0, 0);
    flange.rotation.x = Math.PI / 2;
    const bolts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      bolts.push({ x: Math.cos(a) * 2.2, y: 9.62, z: Math.sin(a) * 2.2 });
    }
    instanced(g, new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), dark, bolts);

    // Nozzles: loop 1 pair (connected to pipes) + two blind pairs
    function nozzlePair(rotY) {
      const pair = new THREE.Group();
      const hot = addMesh(pair, new THREE.CylinderGeometry(0.55, 0.55, 0.9, 28), vesselOuter, 2.3, 7.2, -1.0);
      hot.rotation.z = Math.PI / 2;
      const hotFlange = addMesh(pair, new THREE.TorusGeometry(0.6, 0.08, 10, 32), titanium, 2.72, 7.2, -1.0);
      hotFlange.rotation.y = Math.PI / 2;
      const cold = addMesh(pair, new THREE.CylinderGeometry(0.5, 0.5, 0.9, 28), vesselOuter, 1.75, 3.4, -1.76);
      cold.rotation.z = Math.PI / 2;
      const coldFlange = addMesh(pair, new THREE.TorusGeometry(0.55, 0.08, 10, 32), titanium, 2.2, 3.4, -1.76);
      coldFlange.rotation.y = Math.PI / 2;
      pair.rotation.y = rotY;
      g.add(pair);
    }
    nozzlePair(0);
    nozzlePair(Math.PI / 2);
    nozzlePair(Math.PI);

    // Support skirt and concrete pad
    addMesh(g, new THREE.CylinderGeometry(1.0, 1.15, 0.7, 40), dark, 0, 0.35, 0);
    addMesh(g, new THREE.CylinderGeometry(3.5, 3.6, 0.22, 64), std(0x12172a, 0.6, 0.55), 0, 0.11, 0);

    return g;
  }

  // ==========================================================================
  // NODE 2 — Control rod drive block (servo drives + rods into the core)
  // ==========================================================================
  function buildControlRods() {
    const g = new THREE.Group();
    g.userData.nodeId = "control-rods";

    const titanium = std(0x9aa4b8, 0.95, 0.28);
    const indigo = std(0x1e1b4b, 0.7, 0.45);
    const capMat = std(0x2a2760, 0.6, 0.4, { emissive: 0x4338ca, emissiveIntensity: 0.7 });
    const rodMat = std(0xc2cadb, 0.95, 0.22);
    const tipMat = std(0x0b0f19, 0.8, 0.35);

    const rodCells = buildHexCells().filter((c) => (((c.q - c.r) % 3) + 3) % 3 === 0);

    // Servo drive housings (above the head), cap, three coil rings per drive
    instanced(g, new THREE.CylinderGeometry(0.075, 0.075, 2.4, 14), titanium,
      rodCells.map((c) => ({ x: c.x, y: 10.7, z: c.z })));
    instanced(g, new THREE.CylinderGeometry(0.095, 0.095, 0.14, 14), capMat,
      rodCells.map((c) => ({ x: c.x, y: 11.97, z: c.z })));
    const coilItems = [];
    rodCells.forEach((c) => {
      [9.95, 10.5, 11.05].forEach((y) => coilItems.push({ x: c.x, y: y, z: c.z, rx: Math.PI / 2 }));
    });
    instanced(g, new THREE.TorusGeometry(0.095, 0.022, 8, 18), indigo, coilItems);

    // Seismic support cage
    [10.0, 11.4].forEach((y) => {
      const t = addMesh(g, new THREE.TorusGeometry(1.6, 0.05, 8, 64), titanium, 0, y, 0);
      t.rotation.x = Math.PI / 2;
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      addMesh(g, new THREE.BoxGeometry(0.08, 2.0, 0.08), indigo, Math.cos(a) * 1.6, 10.5, Math.sin(a) * 1.6);
    }

    // Moving rod cluster: tip at y=6.3 (withdrawn), travels down by ROD_STROKE
    rodsGroup = new THREE.Group();
    instanced(rodsGroup, new THREE.CylinderGeometry(0.026, 0.026, 5.4, 8), rodMat,
      rodCells.map((c) => ({ x: c.x, y: 9.0, z: c.z })));
    instanced(rodsGroup, new THREE.CylinderGeometry(0.032, 0.032, 0.7, 8), tipMat,
      rodCells.map((c) => ({ x: c.x, y: 6.65, z: c.z })));
    g.add(rodsGroup);

    return g;
  }

  // ==========================================================================
  // NODE 3 — Pressurizer (tall vertical vessel, cutaway, heaters, steam cushion)
  // ==========================================================================
  function buildPressurizer() {
    const g = new THREE.Group();
    g.userData.nodeId = "pressurizer";
    g.position.set(8, 0, -7.5);

    const outer = phys(0x2b3142, 0.9, 0.38, { side: THREE.DoubleSide });
    const inner = std(0x7e889c, 0.9, 0.3, { side: THREE.DoubleSide });
    const titanium = std(0x9aa4b8, 0.95, 0.28);
    const dark = std(0x1a1d29, 0.85, 0.42);
    const indigo = std(0x1e1b4b, 0.7, 0.45);

    addMesh(g, new THREE.CylinderGeometry(1.2, 1.2, 8.8, 56, 1, true, CUT_START, CUT_LENGTH), outer, 0, 5.6, 0);
    addMesh(g, new THREE.CylinderGeometry(1.08, 1.08, 8.8, 56, 1, true, CUT_START, CUT_LENGTH), inner, 0, 5.6, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 8.8, 0.03), titanium, 1.14, 5.6, 0);
    addMesh(g, new THREE.BoxGeometry(0.03, 8.8, 0.12), titanium, 0, 5.6, 1.14);

    addMesh(g, new THREE.LatheGeometry(domeProfile(1.2, 0.72, -1, 0, 14), 56, CUT_START, CUT_LENGTH), outer, 0, 1.2, 0);
    addMesh(g, new THREE.LatheGeometry(domeProfile(1.2, 0.72, 1, 0, 14), 56, CUT_START, CUT_LENGTH), outer, 0, 10.0, 0);

    // Water volume (lower) and steam cushion (upper)
    const water = new THREE.MeshStandardMaterial({
      color: 0x0369a1, emissive: 0x0ea5e9, emissiveIntensity: 0.35,
      transparent: true, opacity: 0.5, metalness: 0.1, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false
    });
    water.userData.hoverable = false;
    const waterMesh = addMesh(g, new THREE.CylinderGeometry(1.04, 1.04, 4.2, 48, 1, false, CUT_START, CUT_LENGTH), water, 0, 3.4, 0);
    waterMesh.userData.noShadow = true;
    const steam = new THREE.MeshBasicMaterial({
      color: 0xbfdbfe, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false
    });
    steam.userData.hoverable = false;
    const steamMesh = addMesh(g, new THREE.CylinderGeometry(1.04, 1.04, 4.4, 48, 1, true, CUT_START, CUT_LENGTH), steam, 0, 7.8, 0);
    steamMesh.userData.noShadow = true;

    // Electric heater bundle (glowing orange rods inside water)
    const heaterMat = new THREE.MeshStandardMaterial({
      color: 0x331a0a, emissive: 0xf97316, emissiveIntensity: 1.0, metalness: 0.4, roughness: 0.4
    });
    heaterMat.userData.hoverable = false;
    const heaters = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      heaters.push({ x: Math.cos(a) * 0.68, y: 2.9, z: Math.sin(a) * 0.68 });
    }
    heaters.push({ x: 0.3, y: 2.9, z: 0.1 }, { x: -0.25, y: 2.9, z: -0.2 }, { x: 0.05, y: 2.9, z: 0.35 });
    instanced(g, new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), heaterMat, heaters);

    // Level gauge strip (water = cyan, steam = dim amber)
    const gaugeW = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    gaugeW.userData.hoverable = false;
    addMesh(g, new THREE.BoxGeometry(0.07, 3.2, 0.05), gaugeW, 1.3, 3.4, 1.0);
    const gaugeS = new THREE.MeshBasicMaterial({ color: 0x92400e });
    gaugeS.userData.hoverable = false;
    addMesh(g, new THREE.BoxGeometry(0.07, 3.6, 0.05), gaugeS, 1.3, 6.8, 1.0);

    // Top fittings: manway flange, safety valves, spray nozzle
    addMesh(g, new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24), titanium, 0, 10.78, 0);
    [[-0.5, -0.4], [-0.1, -0.55], [-0.55, 0.05]].forEach((p) => {
      addMesh(g, new THREE.CylinderGeometry(0.14, 0.17, 0.9, 14), indigo, p[0], 10.55, p[1]);
    });
    addMesh(g, new THREE.CylinderGeometry(0.22, 0.22, 0.5, 18), titanium, 0.45, 10.55, -0.6);

    // Support skirt and bands
    addMesh(g, new THREE.CylinderGeometry(1.0, 1.15, 0.7, 36), dark, 0, 0.35, 0);
    [1.7, 8.9].forEach((y) => {
      addMesh(g, new THREE.CylinderGeometry(1.27, 1.27, 0.14, 48, 1, false, CUT_START, CUT_LENGTH), titanium, 0, y, 0);
    });

    // Surge nozzle stub (side)
    const stub = addMesh(g, new THREE.CylinderGeometry(0.38, 0.38, 0.7, 20), outer, -0.95, 2.0, 0);
    stub.rotation.z = Math.PI / 2;

    return g;
  }

  // ==========================================================================
  // NODE 4 — RCP (spherical casing, huge electric motor, flywheel)
  // ==========================================================================
  function buildRCP() {
    const g = new THREE.Group();
    g.userData.nodeId = "rcp";
    g.position.set(8, 0, 3.2);

    const casing = phys(0x2b3142, 0.9, 0.34);
    const titanium = std(0x9aa4b8, 0.95, 0.28);
    const dark = std(0x1a1d29, 0.85, 0.42);
    const indigo = std(0x232052, 0.7, 0.4);

    // Spherical casing with equator flange
    addMesh(g, new THREE.SphereGeometry(1.1, 48, 32), casing, 0, 3.4, 0);
    const eq = addMesh(g, new THREE.TorusGeometry(1.1, 0.07, 10, 56), titanium, 0, 3.4, 0);
    eq.rotation.x = Math.PI / 2;

    // Inlet (+x) and outlet (-x) nozzle stubs with flanges
    const inlet = addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.8, 24), casing, 1.35, 3.4, 0);
    inlet.rotation.z = Math.PI / 2;
    const inletF = addMesh(g, new THREE.TorusGeometry(0.55, 0.08, 10, 32), titanium, 1.75, 3.4, 0);
    inletF.rotation.y = Math.PI / 2;
    const outlet = addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.8, 24), casing, -1.25, 3.4, 0);
    outlet.rotation.z = Math.PI / 2;
    const outletF = addMesh(g, new THREE.TorusGeometry(0.55, 0.08, 10, 32), titanium, -1.65, 3.4, 0);
    outletF.rotation.y = Math.PI / 2;

    // Pedestal
    addMesh(g, new THREE.CylinderGeometry(0.55, 0.75, 2.3, 28), dark, 0, 1.15, 0);
    addMesh(g, new THREE.CylinderGeometry(1.05, 1.05, 0.2, 36), dark, 0, 0.1, 0);

    // Motor stand, motor body, cooling fins
    addMesh(g, new THREE.CylinderGeometry(0.55, 0.72, 0.9, 28), titanium, 0, 4.95, 0);
    addMesh(g, new THREE.CylinderGeometry(0.95, 0.95, 2.8, 48), indigo, 0, 6.8, 0);
    [5.75, 6.3, 6.85, 7.4, 7.95].forEach((y) => {
      const fin = addMesh(g, new THREE.TorusGeometry(0.97, 0.05, 8, 48), titanium, 0, y, 0);
      fin.rotation.x = Math.PI / 2;
    });

    // Flywheel (spinning) with notch marks
    const flywheel = new THREE.Group();
    flywheel.position.set(0, 8.42, 0);
    addMesh(flywheel, new THREE.CylinderGeometry(1.18, 1.18, 0.3, 56), std(0x3a4358, 0.95, 0.3), 0, 0, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const notch = addMesh(flywheel, new THREE.BoxGeometry(0.22, 0.34, 0.12), dark, Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
      notch.rotation.y = -a;
    }
    const hub = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b, emissive: 0x38bdf8, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.3
    });
    hub.userData.hoverable = false;
    addMesh(flywheel, new THREE.CylinderGeometry(0.42, 0.42, 0.34, 28), hub, 0, 0, 0);
    g.add(flywheel);
    spinners.push({ obj: flywheel, speed: 3.2, axis: "y" });

    // Top cap
    addMesh(g, new THREE.CylinderGeometry(0.6, 0.8, 0.5, 32), titanium, 0, 8.82, 0);

    return g;
  }

  // ==========================================================================
  // NODE 5 — Horizontal steam generator PGV-1200 (cutaway with tube bundle)
  // ==========================================================================
  function buildSteamGenerator() {
    const g = new THREE.Group();
    g.userData.nodeId = "steam-generator";
    g.position.set(15, 4.5, 0);

    const outer = phys(0x2b3142, 0.9, 0.38, { side: THREE.DoubleSide });
    const inner = std(0x7e889c, 0.9, 0.3, { side: THREE.DoubleSide });
    const titanium = std(0x9aa4b8, 0.95, 0.28);
    const dark = std(0x1a1d29, 0.85, 0.42);

    // Body: cylinder + two dome caps, rotated so local Y axis becomes world Z
    const body = new THREE.Group();
    body.rotation.x = Math.PI / 2;
    addMesh(body, new THREE.CylinderGeometry(2.2, 2.2, 10, 64, 1, true, CUT_START * 2, CUT_LENGTH), outer, 0, 0, 0);
    addMesh(body, new THREE.CylinderGeometry(2.08, 2.08, 10, 64, 1, true, CUT_START * 2, CUT_LENGTH), inner, 0, 0, 0);
    addMesh(body, new THREE.LatheGeometry(domeProfile(2.2, 0.9, 1, 5, 14), 64, CUT_START * 2, CUT_LENGTH), outer, 0, 0, 0);
    addMesh(body, new THREE.LatheGeometry(domeProfile(2.2, 0.9, -1, -5, 14), 64, CUT_START * 2, CUT_LENGTH), outer, 0, 0, 0);
    // Cut-face strips (thickness)
    addMesh(body, new THREE.BoxGeometry(0.14, 10, 0.03), titanium, -2.14, 0, 0);
    addMesh(body, new THREE.BoxGeometry(0.03, 10, 0.14), titanium, 0, 0, 2.14);
    g.add(body);

    // Tube bundle (horizontal tubes along Z between hot and cold collectors)
    const tubes = [];
    for (let row = 0, y = -1.75; y <= 0.25; row++, y += 0.22) {
      const offset = row % 2 === 0 ? 0 : 0.11;
      for (let x = -1.76 + offset; x <= 1.76; x += 0.22) {
        if (Math.sqrt(x * x + y * y) < 1.88) tubes.push({ x: x, y: y, z: 0 });
      }
    }
    const tubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 6.4, 6);
    tubeGeo.rotateX(Math.PI / 2);
    instanced(g, tubeGeo, std(0xaab4c8, 0.9, 0.3), tubes);

    // Vertical primary collectors (hot at -Z, cold at +Z)
    const hotCol = new THREE.MeshStandardMaterial({
      color: 0x2a1018, emissive: 0xf43f5e, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.35
    });
    hotCol.userData.hoverable = false;
    const coldCol = new THREE.MeshStandardMaterial({
      color: 0x0e1a2a, emissive: 0x0ea5e9, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.35
    });
    coldCol.userData.hoverable = false;
    collectorMats.push({ mat: hotCol, base: 0.45 }, { mat: coldCol, base: 0.45 });
    addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 3.6, 28), hotCol, 0, 0, -3.2);
    addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 3.6, 28), coldCol, 0, 0, 3.2);

    // Water level plane and steam separators
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1, emissive: 0x0ea5e9, emissiveIntensity: 0.25,
      transparent: true, opacity: 0.28, metalness: 0.1, roughness: 0.2, depthWrite: false
    });
    waterMat.userData.hoverable = false;
    const water = addMesh(g, new THREE.BoxGeometry(4.0, 0.04, 9.4), waterMat, 0, 0.35, 0);
    water.userData.noShadow = true;
    [-3.0, -1.0, 1.0, 3.0].forEach((z) => {
      addMesh(g, new THREE.CylinderGeometry(0.2, 0.2, 1.1, 18), titanium, 0.45, 0.95, z);
      addMesh(g, new THREE.ConeGeometry(0.28, 0.25, 18), dark, 0.45, 1.6, z);
    });

    // Steam outlet stub (top) and feedwater stub (side)
    addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.5, 24), outer, -0.7, 2.3, -2.0);
    const feed = addMesh(g, new THREE.CylinderGeometry(0.4, 0.4, 0.6, 22), outer, 2.45, -0.2, 1.5);
    feed.rotation.z = Math.PI / 2;

    // Primary nozzle flanges (hot/cold legs entering from -X)
    const hotF = addMesh(g, new THREE.CylinderGeometry(0.62, 0.62, 0.5, 26), outer, -2.3, 0.5, -3.2);
    hotF.rotation.z = Math.PI / 2;
    const coldF = addMesh(g, new THREE.CylinderGeometry(0.62, 0.62, 0.5, 26), outer, -2.3, -1.1, 3.2);
    coldF.rotation.z = Math.PI / 2;

    // Support saddles
    addMesh(g, new THREE.BoxGeometry(3.6, 2.3, 0.6), dark, 0, -3.35, -3.8);
    addMesh(g, new THREE.BoxGeometry(3.6, 2.3, 0.6), dark, 0, -3.35, 3.8);

    return g;
  }

  // ==========================================================================
  // NODE 6 — Turbogenerator (HP + 2×LP cylinders + generator + condenser)
  // ==========================================================================
  function buildTurbogenerator() {
    const g = new THREE.Group();
    g.userData.nodeId = "turbogenerator";
    g.position.set(25, 0, 0);

    const outer = phys(0x232838, 0.88, 0.4, { side: THREE.DoubleSide });
    const inner = std(0x8d97ab, 0.9, 0.3, { side: THREE.DoubleSide });
    const titanium = std(0x9aa4b8, 0.95, 0.28);
    const dark = std(0x1a1d29, 0.85, 0.42);
    const indigo = std(0x232052, 0.7, 0.4);
    const rotorMat = std(0x8fa3b8, 0.95, 0.3);
    const copper = std(0xa4682a, 0.9, 0.35);

    // Turbine axis group: local Y → world Z, lifted to y = 3.4
    const body = new THREE.Group();
    body.position.set(0, 3.4, 0);
    body.rotation.x = Math.PI / 2;
    g.add(body);

    // Cut axis sectors in this frame: remove x>0 & world-up quadrant (θ in (π/2, π))
    const AX_START = Math.PI;
    const AX_LEN = Math.PI * 1.5;

    function casing(zc, len, r, discs, rMin, rMax) {
      addMesh(body, new THREE.CylinderGeometry(r, r, len, 56, 1, false, AX_START, AX_LEN), outer, 0, zc, 0);
      addMesh(body, new THREE.CylinderGeometry(r - 0.1, r - 0.1, len - 0.04, 56, 1, true, AX_START, AX_LEN), inner, 0, zc, 0);
      [-1, 1].forEach((s) => {
        addMesh(body, new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.14, 56, 1, false, AX_START, AX_LEN), titanium, 0, zc + s * (len / 2 - 0.07), 0);
      });
      // Rotor discs with growing radius (steam expansion)
      for (let i = 0; i < discs; i++) {
        const t = discs === 1 ? 0 : i / (discs - 1);
        const rr = rMin + (rMax - rMin) * t;
        const z = zc - len / 2 + 0.3 + (len - 0.6) * t;
        addMesh(body, new THREE.CylinderGeometry(rr, rr, 0.12, 40), rotorMat, 0, z, 0);
      }
    }

    // HP (z -8 .. -5), LP1 (z -4.7 .. -1.3), LP2 (z -1.0 .. 2.4)
    casing(-6.5, 3.0, 1.2, 6, 0.5, 0.95);
    casing(-3.0, 3.4, 1.9, 7, 0.8, 1.6);
    casing(0.7, 3.4, 1.9, 7, 1.6, 0.8);

    // Shaft along the whole line
    addMesh(body, new THREE.CylinderGeometry(0.3, 0.3, 17.2, 28), rotorMat, 0, 0.4, 0);

    // Generator (solid indigo stator, cooling rings, copper end-windings)
    addMesh(body, new THREE.CylinderGeometry(1.6, 1.6, 6.0, 56), indigo, 0, 5.7, 0);
    [3.4, 4.4, 5.4, 6.4, 7.4, 8.1].forEach((z) => {
      const ringMesh = addMesh(body, new THREE.TorusGeometry(1.62, 0.06, 8, 56), titanium, 0, z, 0);
      ringMesh.rotation.x = Math.PI / 2;
    });
    addMesh(body, new THREE.CylinderGeometry(1.0, 1.0, 0.4, 32), copper, 0, 2.58, 0);
    addMesh(body, new THREE.CylinderGeometry(0.7, 0.7, 0.9, 32), titanium, 0, 9.4, 0);

    // Spinning couplings (visible motion on the turbine line)
    [-4.85, -1.15, 2.55].forEach((z) => {
      const coupling = new THREE.Group();
      coupling.position.set(0, z, 0);
      addMesh(coupling, new THREE.CylinderGeometry(0.6, 0.6, 0.24, 30), std(0x3a4358, 0.95, 0.3), 0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const notch = addMesh(coupling, new THREE.BoxGeometry(0.16, 0.26, 0.16), dark, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        notch.rotation.y = -a;
      }
      body.add(coupling);
      spinners.push({ obj: coupling, speed: 6.0, axis: "y" });
    });

    // Pedestals under HP and generator
    addMesh(g, new THREE.BoxGeometry(2.4, 2.2, 0.7), dark, 0, 1.1, -7.6);
    addMesh(g, new THREE.BoxGeometry(2.4, 2.2, 0.7), dark, 0, 1.1, -5.4);
    addMesh(g, new THREE.BoxGeometry(2.8, 1.8, 0.8), dark, 0, 0.9, 3.2);
    addMesh(g, new THREE.BoxGeometry(2.8, 1.8, 0.8), dark, 0, 0.9, 8.2);

    // Generator terminal box
    addMesh(g, new THREE.BoxGeometry(1.3, 0.5, 1.3), titanium, 0, 5.25, 5.7);

    // Condenser and exhaust ducts under the LP cylinders
    addMesh(g, new THREE.BoxGeometry(4.6, 1.2, 7.4), std(0x14182a, 0.85, 0.42), 0, 0.6, -1.15);
    addMesh(g, new THREE.BoxGeometry(2.6, 0.4, 3.0), titanium, 0, 1.35, -3.0);
    addMesh(g, new THREE.BoxGeometry(2.6, 0.4, 3.0), titanium, 0, 1.35, 0.7);

    // Steam inlet chest on the HP cylinder (top, left of the cut)
    addMesh(g, new THREE.CylinderGeometry(0.5, 0.5, 0.6, 24), outer, -0.6, 4.55, -6.5);

    return g;
  }

  // ==========================================================================
  // Pipes (rounded TubeGeometry + pulsing emissive flow sleeves)
  // ==========================================================================
  function roundedPath(points, cornerRadius) {
    const path = new THREE.CurvePath();
    const v = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    let cur = v[0].clone();
    for (let i = 1; i < v.length - 1; i++) {
      const p = v[i];
      const toPrev = v[i - 1].clone().sub(p);
      const toNext = v[i + 1].clone().sub(p);
      const r = Math.min(cornerRadius, toPrev.length() / 2, toNext.length() / 2);
      const a = p.clone().add(toPrev.normalize().multiplyScalar(r));
      const b = p.clone().add(toNext.normalize().multiplyScalar(r));
      if (cur.distanceTo(a) > 1e-4) path.add(new THREE.LineCurve3(cur.clone(), a.clone()));
      path.add(new THREE.QuadraticBezierCurve3(a.clone(), p.clone(), b.clone()));
      cur = b;
    }
    path.add(new THREE.LineCurve3(cur.clone(), v[v.length - 1].clone()));
    return path;
  }

  function buildPipe(def) {
    const group = new THREE.Group();
    const path = roundedPath(def.points, def.corner || 0.9);
    const length = path.getLength();

    const shellMat = std(0x1a2233, 0.85, 0.35);
    shellMat.userData.hoverable = false;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.ceil(length * 6), def.radius, 14, false), shellMat);
    tube.castShadow = true;
    group.add(tube);

    const sleeves = [];
    const count = Math.max(3, Math.floor(length / 0.7));
    const up = new THREE.Vector3(0, 1, 0);
    const sleeveGeo = new THREE.CylinderGeometry(def.radius * 1.14, def.radius * 1.14, 0.42, 18);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const p = path.getPointAt(u);
      const tangent = path.getTangentAt(u).normalize();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x151b2a,
        emissive: def.color,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.4
      });
      mat.userData.hoverable = false;
      const sleeve = new THREE.Mesh(sleeveGeo, mat);
      sleeve.position.copy(p);
      sleeve.quaternion.setFromUnitVectors(up, tangent);
      group.add(sleeve);
      sleeves.push(mat);
    }

    pipes.push({ sleeves: sleeves, circuit: def.circuit, speed: def.speed, baseline: def.baseline });
    return group;
  }

  function buildPipes() {
    pipes = [];
    pipeGroups[1] = new THREE.Group();
    pipeGroups[2] = new THREE.Group();
    scene.add(pipeGroups[1]);
    scene.add(pipeGroups[2]);

    const HOT = 0xf43f5e;
    const COLD = 0x0ea5e9;
    const STEAM = 0x2dd4bf;
    const FEED = 0x14b8a6;

    const defs = [
      // Circuit 1 — hot leg: reactor outlet → steam generator hot collector
      { circuit: 1, color: HOT, radius: 0.42, speed: 3.2, baseline: 0.4, corner: 0.9,
        points: [[2.7, 7.2, -1.0], [8, 7.2, -1.0], [8, 7.2, -3.2], [8, 5.0, -3.2], [14.8, 5.0, -3.2]] },
      // Circuit 1 — surge line to the pressurizer
      { circuit: 1, color: HOT, radius: 0.3, speed: 2.4, baseline: 0.35, corner: 0.5,
        points: [[8, 7.2, -2.1], [6.2, 7.2, -2.1], [6.2, 2.0, -2.1], [6.2, 2.0, -7.5], [7.4, 2.0, -7.5]] },
      // Circuit 1 — cold leg: SG cold collector → RCP suction
      { circuit: 1, color: COLD, radius: 0.42, speed: 3.0, baseline: 0.4, corner: 0.9,
        points: [[14.8, 3.4, 3.2], [9.75, 3.4, 3.2]] },
      // Circuit 1 — RCP discharge → reactor inlet
      { circuit: 1, color: COLD, radius: 0.42, speed: 3.0, baseline: 0.4, corner: 0.9,
        points: [[6.35, 3.4, 3.2], [5.0, 3.4, 3.2], [5.0, 3.4, -1.76], [2.2, 3.4, -1.76]] },
      // Circuit 2 — main steam line: SG top → HP cylinder
      { circuit: 2, color: STEAM, radius: 0.36, speed: 4.0, baseline: 0.4, corner: 0.9,
        points: [[14.3, 6.5, -2.0], [14.3, 10.0, -2.0], [24.4, 10.0, -2.0], [24.4, 10.0, -6.5], [24.4, 3.9, -6.5]] },
      // Circuit 2 — feedwater: condenser → SG
      { circuit: 2, color: FEED, radius: 0.3, speed: 3.4, baseline: 0.4, corner: 0.9,
        points: [[22.8, 0.6, 1.5], [19.5, 0.6, 1.5], [19.5, 4.3, 1.5], [16.3, 4.3, 1.5]] }
    ];

    defs.forEach((def) => {
      const group = buildPipe(def);
      pipeGroups[def.circuit].add(group);
    });
  }

  // ==========================================================================
  // Node registration, labels, outline
  // ==========================================================================
  function registerNodes() {
    pickables = [];
    nodeMeshes = {};
    nodeHoverMats = {};
    nodeAllMats = {};

    NODE_IDS.forEach((id) => {
      const mats = new Set();
      const hoverMats = new Set();
      nodeMeshes[id] = [];

      nodeGroups[id].traverse((o) => {
        if (!o.isMesh) return;
        o.userData.nodeId = id;
        const m = o.material;
        if (!m.userData.registered) {
          m.userData.registered = true;
          m.userData.baseOpacity = m.opacity;
          m.userData.baseTransparent = m.transparent;
          m.userData.baseDepthWrite = m.depthWrite;
          m.userData.dimMul = 1;
        }
        mats.add(m);
        if (m.userData.hoverable) hoverMats.add(m);

        const transparent = m.transparent;
        o.castShadow = !transparent && !o.userData.noShadow;
        o.receiveShadow = !transparent && !o.userData.noShadow;

        if (!o.userData.noPick) {
          nodeMeshes[id].push(o);
          pickables.push(o);
        }
      });

      nodeAllMats[id] = Array.from(mats);
      nodeHoverMats[id] = Array.from(hoverMats);
    });

    // Register material metadata for sparkles / glow tips (opacity animation)
    glowMats.forEach((e) => {
      if (!e.mat.userData.registered) {
        e.mat.userData.registered = true;
        e.mat.userData.baseOpacity = e.mat.opacity;
        e.mat.userData.baseTransparent = e.mat.transparent;
        e.mat.userData.baseDepthWrite = e.mat.depthWrite;
        e.mat.userData.dimMul = 1;
      }
    });
  }

  function buildLabels() {
    labelSprites = [];
    if (!window.REACTOR_NODES_DATA) return;

    NODE_IDS.forEach((id, index) => {
      const node = window.REACTOR_NODES_DATA.find((n) => n.id === id);
      if (!node) return;

      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(6,10,18,0.82)";
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = "rgba(56,189,248,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, 508, 124);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(0, 0, 10, 128);
      ctx.font = '700 38px "JetBrains Mono", monospace';
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("0" + (index + 1), 28, 64);
      ctx.fillStyle = "#e2f3ff";
      ctx.fillText(String(node.shortName || node.name).toUpperCase().slice(0, 20), 100, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false
      }));
      sprite.scale.set(4.4, 1.1, 1);
      sprite.position.set(LABEL_POS[id][0], LABEL_POS[id][1], LABEL_POS[id][2]);
      sprite.renderOrder = 20;
      scene.add(sprite);
      labelSprites.push(sprite);
    });
  }

  function buildOutline() {
    // Faint full bounding box + bright corner brackets (accent contour)
    outlineBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: OUTLINE_HEX, transparent: true, opacity: 0.25, depthTest: false, fog: false })
    );
    outlineBox.renderOrder = 998;
    outlineBox.visible = false;
    scene.add(outlineBox);

    const bracketGeo = new THREE.BufferGeometry();
    bracketGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48 * 3), 3));
    outlineBrackets = new THREE.LineSegments(
      bracketGeo,
      new THREE.LineBasicMaterial({ color: OUTLINE_HEX, transparent: true, opacity: 1, depthTest: false, fog: false })
    );
    outlineBrackets.renderOrder = 999;
    outlineBrackets.frustumCulled = false;
    outlineBrackets.visible = false;
    scene.add(outlineBrackets);
  }

  function setOutlineTarget(id) {
    if (!outlineBrackets || !NODE_BOUNDS[id]) return;
    const b = NODE_BOUNDS[id];
    const min = b.min;
    const max = b.max;
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const len = Math.max(0.4, Math.min(1.6, Math.min(size[0], size[1], size[2]) * 0.28));

    const pos = outlineBrackets.geometry.attributes.position;
    let k = 0;
    function put(x, y, z) {
      pos.setXYZ(k++, x, y, z);
    }
    [min[0], max[0]].forEach((x, ix) => {
      [min[1], max[1]].forEach((y, iy) => {
        [min[2], max[2]].forEach((z, iz) => {
          const sx = ix === 0 ? 1 : -1;
          const sy = iy === 0 ? 1 : -1;
          const sz = iz === 0 ? 1 : -1;
          put(x, y, z); put(x + sx * len, y, z);
          put(x, y, z); put(x, y + sy * len, z);
          put(x, y, z); put(x, y, z + sz * len);
        });
      });
    });
    pos.needsUpdate = true;
    outlineBrackets.visible = true;

    outlineBox.scale.set(size[0], size[1], size[2]);
    outlineBox.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    outlineBox.visible = true;
  }

  // ==========================================================================
  // Animation loop
  // ==========================================================================
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // Stop automatically when the viewport was removed by the router
    if (!renderer || !renderer.domElement.isConnected) {
      cleanupThreeScene();
      return;
    }

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    frameCounter++;

    updateFlight(dt);
    if (controls) controls.update();

    updateHover();
    updateRods(dt);
    updateGlow(dt, t);
    updatePipes(t);
    updateHighlights(dt, t);
    updateSpinners(dt);
    updateOutline(t);
    updateZoomBadge();

    renderer.render(scene, camera);
  }

  function updateRods(dt) {
    if (rodDirection > 0) {
      rodProgress = Math.min(1, rodProgress + dt / SCRAM_DROP_SECONDS);
      if (rodProgress >= 1) rodDirection = 0;
    } else if (rodDirection < 0) {
      rodProgress = Math.max(0, rodProgress - dt / ROD_RESET_SECONDS);
      if (rodProgress <= 0) rodDirection = 0;
    }
    if (rodsGroup) {
      // Free-fall like drop (quadratic ease-in)
      rodsGroup.position.y = -ROD_STROKE * rodProgress * rodProgress;
    }
  }

  function updateGlow(dt, t) {
    const tripped = isAz1Tripped;
    glowLevel += ((tripped ? GLOW_DIM : 1) - glowLevel) * (1 - Math.exp(-dt / (tripped ? 1.4 : 0.8)));
    thermalLevel += ((tripped ? 0.3 : 1) - thermalLevel) * (1 - Math.exp(-dt / (tripped ? 5.0 : 1.5)));
    steamLevel += ((tripped ? 0.4 : 1) - steamLevel) * (1 - Math.exp(-dt / (tripped ? 4.0 : 1.5)));
    spinSpeed += ((tripped ? 0.25 : 1) - spinSpeed) * (1 - Math.exp(-dt / (tripped ? 6.0 : 2.0)));

    const flicker = 0.93 + 0.07 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 7.1);

    if (coreLight) {
      coreLight.intensity = 6 * glowLevel * flicker + nodeFlash["core"] * 6;
    }
    if (assemblyMat) {
      assemblyMat.emissiveIntensity = 0.12 + 1.0 * glowLevel * flicker;
    }
    glowMats.forEach((e) => {
      const v = e.base * glowLevel * flicker;
      e.mat.userData.baseOpacity = v;
      e.mat.opacity = v * (e.mat.userData.dimMul || 1);
    });
    collectorMats.forEach((e) => {
      e.mat.emissiveIntensity = e.base * (0.5 + 0.5 * thermalLevel);
    });

    // Sparkles
    if (sparkles && sparkleData) {
      const arr = sparkles.geometry.attributes.position.array;
      for (let i = 0; i < sparkleData.length; i++) {
        const d = sparkleData[i];
        let y = arr[i * 3 + 1] + d.speed * dt * (0.15 + glowLevel);
        if (y > 8.8) y = 2.4;
        arr[i * 3 + 1] = y;
        arr[i * 3] = d.ox + Math.sin(t * 0.9 + d.ph) * 0.05;
        arr[i * 3 + 2] = d.oz + Math.cos(t * 0.8 + d.ph) * 0.05;
      }
      sparkles.geometry.attributes.position.needsUpdate = true;
      sparkles.material.opacity = Math.min(1, 0.15 + 0.85 * glowLevel);
    }
  }

  function updatePipes(t) {
    pipes.forEach((p) => {
      const level = p.circuit === 1 ? thermalLevel : steamLevel;
      for (let i = 0; i < p.sleeves.length; i++) {
        const v = 0.5 + 0.5 * Math.sin(t * p.speed - i * 0.55);
        p.sleeves[i].emissiveIntensity = (p.baseline * 0.5 + 1.15 * v) * (0.25 + 0.75 * level);
      }
    });
  }

  function updateHighlights(dt, t) {
    NODE_IDS.forEach((id) => {
      const target = hoveredNodeId === id ? 1 : (activeNodeId === id ? 0.4 : 0);
      hoverAmt[id] += (target - hoverAmt[id]) * Math.min(1, dt * 8);
      nodeFlash[id] *= Math.exp(-dt * 3);
      const pulse = hoveredNodeId === id ? 0.75 + 0.25 * Math.sin(t * 6) : 1;
      const intensity = hoverAmt[id] * 0.55 * pulse + nodeFlash[id] * 0.9;
      const mats = nodeHoverMats[id];
      for (let i = 0; i < mats.length; i++) {
        mats[i].emissive.setHex(ACCENT_HEX);
        mats[i].emissiveIntensity = intensity;
      }
    });
  }

  function updateSpinners(dt) {
    spinners.forEach((s) => {
      s.obj.rotation[s.axis] += s.speed * spinSpeed * dt;
    });
  }

  function updateOutline(t) {
    if (!outlineBrackets) return;
    outlineBrackets.material.opacity = 0.7 + 0.3 * Math.sin(t * 4);
    outlineBox.material.opacity = 0.18 + 0.1 * Math.sin(t * 4);
  }

  function updateZoomBadge() {
    if (frameCounter % 6 !== 0 || !camera || !controls) return;
    const home = Math.sqrt(
      Math.pow(HOME_POSITION[0] - HOME_TARGET[0], 2) +
      Math.pow(HOME_POSITION[1] - HOME_TARGET[1], 2) +
      Math.pow(HOME_POSITION[2] - HOME_TARGET[2], 2)
    );
    const dist = camera.position.distanceTo(controls.target);
    const text = Math.round((home / Math.max(dist, 0.01)) * 100) + "%";
    if (text !== lastZoomBadge) {
      const badge = document.getElementById("hud-zoom-val");
      if (badge) badge.textContent = text;
      lastZoomBadge = text;
    }
  }

  // ==========================================================================
  // Camera fly-to
  // ==========================================================================
  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function startFlight(toPos, toTarget, duration) {
    if (!camera) return;
    const fromTarget = controls ? controls.target.clone() : new THREE.Vector3(HOME_TARGET[0], HOME_TARGET[1], HOME_TARGET[2]);
    flight = {
      t: 0,
      dur: duration || 1.3,
      fromPos: camera.position.clone(),
      toPos: toPos,
      fromTarget: fromTarget,
      toTarget: toTarget
    };
  }

  function flyToNode(id) {
    const b = NODE_BOUNDS[id];
    if (!b || !camera) return;
    const center = new THREE.Vector3(
      (b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2
    );
    const maxDim = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    const dist = Math.max(9, maxDim * 1.5);
    const dir = new THREE.Vector3(FOCUS_DIR[0], FOCUS_DIR[1], FOCUS_DIR[2]).normalize();
    startFlight(center.clone().add(dir.multiplyScalar(dist)), center, 1.3);
  }

  function flyHome() {
    startFlight(
      new THREE.Vector3(HOME_POSITION[0], HOME_POSITION[1], HOME_POSITION[2]),
      new THREE.Vector3(HOME_TARGET[0], HOME_TARGET[1], HOME_TARGET[2]),
      1.4
    );
  }

  function updateFlight(dt) {
    if (!flight || !camera) return;
    flight.t += dt / flight.dur;
    const e = easeInOutCubic(Math.min(flight.t, 1));
    camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
    if (controls) {
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
    } else {
      camera.lookAt(flight.toTarget);
    }
    if (flight.t >= 1) flight = null;
  }

  function zoomCamera(factor) {
    if (!camera || !controls) return;
    flight = null;
    const offset = camera.position.clone().sub(controls.target);
    const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * factor));
    offset.setLength(len);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  // ==========================================================================
  // Raycaster interaction
  // ==========================================================================
  function pickNodeAt() {
    if (!raycaster || !camera || !pickables.length) return null;
    raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (let i = 0; i < hits.length; i++) {
      const id = hits[i].object.userData.nodeId;
      if (id) return id;
    }
    return null;
  }

  function updatePointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.cx = e.clientX - rect.left;
    pointer.cy = e.clientY - rect.top;
    pointer.inside = true;
  }

  function onPointerMove(e) {
    updatePointerFromEvent(e);
    hoverDirty = true;
  }

  function onPointerLeave() {
    pointer.inside = false;
    hoverDirty = true;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    downPos = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 5) return;
    updatePointerFromEvent(e);
    const id = pickNodeAt();
    if (id) selectNode(id, true);
  }

  function updateHover() {
    if (!hoverDirty) return;
    hoverDirty = false;

    const dragging = downPos !== null;
    hoveredNodeId = pointer.inside && !dragging ? pickNodeAt() : null;

    if (renderer) renderer.domElement.style.cursor = hoveredNodeId ? "pointer" : "";

    if (tooltipEl) {
      if (hoveredNodeId && window.REACTOR_NODES_DATA) {
        const node = window.REACTOR_NODES_DATA.find((n) => n.id === hoveredNodeId);
        tooltipEl.textContent = node ? (node.code ? node.code + " · " : "") + node.name : hoveredNodeId;
        tooltipEl.style.display = "block";
        tooltipEl.style.left = pointer.cx + 16 + "px";
        tooltipEl.style.top = pointer.cy + 14 + "px";
      } else {
        tooltipEl.style.display = "none";
      }
    }
  }

  /**
   * Selects a node: highlights chip, renders inspector from data.js, outlines it in 3D, flies camera to it
   */
  function selectNode(id, fly) {
    highlightActiveNode(id);
    renderInspectorCard(id);
    setOutlineTarget(id);
    if (fly !== false) flyToNode(id);
  }

  // ==========================================================================
  // Resize & cleanup
  // ==========================================================================
  function handleResize() {
    const container = document.getElementById("reactor-3d-viewport");
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function cleanupThreeScene() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener("resize", handleResize);

    if (renderer) {
      const dom = renderer.domElement;
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointerleave", onPointerLeave);
    }

    if (controls && typeof controls.dispose === "function") {
      controls.dispose();
    }
    controls = null;

    if (scene) {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      });
      if (scene.environment) scene.environment.dispose();
    }

    if (renderer) {
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    }
    if (tooltipEl && tooltipEl.parentNode) tooltipEl.parentNode.removeChild(tooltipEl);

    renderer = null;
    scene = null;
    camera = null;
    clock = null;
    raycaster = null;
    viewportEl = null;
    tooltipEl = null;
    nodeGroups = {};
    nodeMeshes = {};
    nodeHoverMats = {};
    nodeAllMats = {};
    pickables = [];
    pipes = [];
    pipeGroups = { 1: null, 2: null };
    spinners = [];
    labelSprites = [];
    rodsGroup = null;
    coreLight = null;
    glowMats = [];
    assemblyMat = null;
    collectorMats = [];
    sparkles = null;
    sparkleData = null;
    outlineBrackets = null;
    outlineBox = null;
    hoveredNodeId = null;
    downPos = null;
    flight = null;
  }

  // ==========================================================================
  // Mode management (global / per-node)
  // ==========================================================================
  function getNodeMode(nodeId) {
    return nodeModeOverrides[nodeId] || globalMode;
  }

  function toggleNodeMode(nodeId) {
    const currentMode = getNodeMode(nodeId);
    nodeModeOverrides[nodeId] = currentMode === "scada" ? "simple" : "scada";
    renderInspectorCard(nodeId);
  }

  function setGlobalMode(mode) {
    globalMode = mode;
    nodeModeOverrides = {};

    const modeButtons = document.querySelectorAll(".mode-btn");
    modeButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });

    renderInspectorCard(activeNodeId);
  }

  function getGlobalMode() {
    return globalMode;
  }

  // ==========================================================================
  // Inspector, chips
  // ==========================================================================
  function generateNodeChips() {
    if (!window.REACTOR_NODES_DATA) return "";
    return window.REACTOR_NODES_DATA.map((node, index) => `
      <button class="node-chip-btn ${node.id === activeNodeId ? "active" : ""}" data-node-id="${node.id}" title="${node.name}">
        <span class="node-chip-num">0${index + 1}</span>
        <span>${node.shortName}</span>
      </button>
    `).join("");
  }

  function renderInspectorCard(nodeId) {
    const host = document.getElementById("inspector-card-host");
    if (!host || !window.REACTOR_NODES_DATA) return;

    const node = window.REACTOR_NODES_DATA.find((n) => n.id === nodeId) || window.REACTOR_NODES_DATA[0];
    const mode = getNodeMode(node.id);
    const isSimple = mode === "simple";

    let metricsHtml = "";
    if (isSimple && node.simpleExplainer && node.simpleExplainer.simpleMetrics) {
      metricsHtml = node.simpleExplainer.simpleMetrics.map((m) => `
        <div class="metric-hud-cell">
          <span class="metric-cell-label">${m.label}</span>
          <div class="metric-cell-value-group">
            <span class="metric-cell-val">${isAz1Tripped && m.label.includes("Мощность") ? "0" : m.value}</span>
          </div>
          <span class="simple-metric-hint">${m.hint}</span>
        </div>
      `).join("");
    } else {
      metricsHtml = node.metrics.map((m) => `
        <div class="metric-hud-cell">
          <span class="metric-cell-label">${m.label}</span>
          <div class="metric-cell-value-group">
            <span class="metric-cell-val">${isAz1Tripped && m.label.includes("Мощность") ? "0" : m.value}</span>
            <span class="metric-cell-unit">${m.unit}</span>
          </div>
          <span class="metric-cell-trend">${isAz1Tripped ? "АВАРИЙНЫЙ СПАД" : m.trend}</span>
        </div>
      `).join("");
    }

    let bodyContentHtml = "";
    if (isSimple && node.simpleExplainer) {
      bodyContentHtml = `
        <div class="simple-explainer-card">
          <div class="simple-box simple-box-analogy">
            <div class="simple-box-header">
              <span>💡</span>
              <span>Аналогия из жизни</span>
            </div>
            <p class="section-body-text">${node.simpleExplainer.analogy}</p>
          </div>

          <div class="simple-box simple-box-physics">
            <div class="simple-box-header">
              <span>⚙️</span>
              <span>Как это работает на пальцах</span>
            </div>
            <p class="section-body-text">${node.simpleExplainer.simplePhysics}</p>
          </div>

          <div class="simple-box simple-box-failure">
            <div class="simple-box-header">
              <span>🛡️</span>
              <span>Что будет при отказе и защита</span>
            </div>
            <p class="section-body-text">${node.simpleExplainer.simpleFailure}</p>
          </div>
        </div>

        <button class="btn-toggle-explain-mode in-simple-mode" id="btn-toggle-explain-mode" type="button">
          <span>⚙️</span>
          <span>Вернуть инженерный вид</span>
        </button>
      `;
    } else {
      const paramsRows = node.criticalParams.map((cp) => `
        <tr>
          <td class="param-name">${cp.name}</td>
          <td class="param-limit">${cp.limit}</td>
        </tr>
      `).join("");

      bodyContentHtml = `
        <section class="inspector-section">
          <h3 class="section-label">Физический принцип работы</h3>
          <p class="section-body-text">${node.principle}</p>
        </section>

        <section class="inspector-section">
          <h3 class="section-label">Инженерная конструкция ВВЭР-1200</h3>
          <p class="section-body-text">${node.engineering}</p>
        </section>

        <section class="inspector-section">
          <h3 class="section-label">Критические параметры и уставки</h3>
          <table class="params-table">
            <tbody>
              ${paramsRows}
            </tbody>
          </table>
        </section>

        <section class="inspector-section">
          <div class="failure-alert-box">
            <div class="failure-alert-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Сценарий отказа и действие автоматики безопасности
            </div>
            <p class="failure-alert-body">${node.failureScenario}</p>
          </div>
        </section>

        <button class="btn-toggle-explain-mode" id="btn-toggle-explain-mode" type="button">
          <span>💡</span>
          <span>Объяснить этот узел на пальцах</span>
        </button>
      `;
    }

    host.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-meta-row">
          <span class="inspector-node-code">${isSimple ? node.shortName.toUpperCase() : node.code}</span>
          <div class="node-status-indicator">
            <span class="node-status-dot"></span>
            <span>${isAz1Tripped ? "ЗАЩИТА СРАБОТАЛА" : (isSimple ? "РАБОТАЕТ ШТАТНО" : node.status)}</span>
          </div>
        </div>
        <h2 class="inspector-title">${node.name}</h2>
        <span class="inspector-circuit-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
          ${node.circuitName}
        </span>
      </div>

      <div class="inspector-metrics-grid">
        ${metricsHtml}
      </div>

      <div class="inspector-scroll-area">
        ${bodyContentHtml}
      </div>

      <div class="inspector-footer">
        <button class="btn-inspect-action" id="btn-node-test-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          ${node.actionPrompt}
        </button>
      </div>
    `;

    const toggleBtn = host.querySelector("#btn-toggle-explain-mode");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        toggleNodeMode(node.id);
      });
    }

    const actionBtn = host.querySelector("#btn-node-test-action");
    if (actionBtn) {
      actionBtn.addEventListener("click", () => {
        triggerNodeDiagnostic(node);
      });
    }
  }

  function highlightActiveNode(nodeId) {
    activeNodeId = nodeId;

    const allChips = document.querySelectorAll(".node-chip-btn");
    allChips.forEach((chip) => {
      chip.classList.toggle("active", chip.getAttribute("data-node-id") === nodeId);
    });
  }

  /**
   * Diagnostic action feedback: flashes the selected node in 3D
   */
  function triggerNodeDiagnostic(node) {
    const btn = document.getElementById("btn-node-test-action");
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = `<span style="color: var(--status-emerald)">✓ ТЕЛЕМЕТРИЯ ПОДТВЕРЖДЕНА: 100% НОРМА</span>`;
    btn.style.borderColor = "var(--status-emerald)";

    if (nodeFlash[node.id] !== undefined) nodeFlash[node.id] = 1;

    setTimeout(() => {
      if (btn) {
        btn.innerHTML = originalText;
        btn.style.borderColor = "";
      }
    }, 2400);
  }

  // ==========================================================================
  // AZ-1 scram & circuit filter
  // ==========================================================================
  function toggleAz1Scram() {
    isAz1Tripped = !isAz1Tripped;
    const scramBtn = document.getElementById("az1-trigger-btn");
    const statusText = document.getElementById("canvas-status-text");
    const btnText = document.getElementById("az1-btn-text");

    if (isAz1Tripped) {
      if (scramBtn) scramBtn.classList.add("tripped");
      if (btnText) btnText.textContent = "АЗ-1 СРАБОТАЛА (СБРОСИТЬ)";
      if (statusText) statusText.textContent = "ВНИМАНИЕ: СРАБАТЫВАНИЕ АЗ-1 (РЕАКТОР ЗАГЛУШЕН)";
      rodDirection = 1;   // rods drop in 4 s (see updateRods)
    } else {
      if (scramBtn) scramBtn.classList.remove("tripped");
      if (btnText) btnText.textContent = "АЗ-1 (СБРОС СУЗ)";
      if (statusText) statusText.textContent = "3D WEBGL: ОНЛАЙН · КЛИК ПО УЗЛУ";
      rodDirection = -1;  // rods are lifted back
    }

    renderInspectorCard(activeNodeId);
  }

  function setNodeDim(id, dimmed) {
    const mats = nodeAllMats[id];
    if (!mats) return;
    mats.forEach((m) => {
      m.userData.dimMul = dimmed ? 0.14 : 1;
      m.transparent = dimmed || m.userData.baseTransparent;
      m.depthWrite = dimmed ? false : m.userData.baseDepthWrite;
      m.opacity = m.userData.baseOpacity * m.userData.dimMul;
      m.needsUpdate = true;
    });
  }

  function applyCircuitFilter(filterType) {
    activeCircuitFilter = filterType;

    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-filter") === filterType);
    });

    if (!scene) return;

    const members = CIRCUIT_MEMBERS[filterType];
    NODE_IDS.forEach((id) => {
      setNodeDim(id, !!members && members.indexOf(id) === -1);
    });

    if (pipeGroups[1]) pipeGroups[1].visible = filterType !== "circuit-2";
    if (pipeGroups[2]) pipeGroups[2].visible = filterType !== "circuit-1";
  }

  // ==========================================================================
  // Event listeners
  // ==========================================================================
  function setupEventListeners(container) {
    container.querySelectorAll(".node-chip-btn").forEach((chip) => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = chip.getAttribute("data-node-id");
        if (id) selectNode(id, true);
      });
    });

    container.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyCircuitFilter(btn.getAttribute("data-filter"));
      });
    });

    const az1Btn = container.querySelector("#az1-trigger-btn");
    if (az1Btn) az1Btn.addEventListener("click", toggleAz1Scram);

    const btnIn = container.querySelector("#hud-zoom-in");
    const btnOut = container.querySelector("#hud-zoom-out");
    const btnReset = container.querySelector("#hud-zoom-reset");

    if (btnIn) btnIn.addEventListener("click", (e) => { e.stopPropagation(); zoomCamera(1 / 1.25); });
    if (btnOut) btnOut.addEventListener("click", (e) => { e.stopPropagation(); zoomCamera(1.25); });
    if (btnReset) btnReset.addEventListener("click", (e) => { e.stopPropagation(); flyHome(); });
  }

  return {
    render,
    setGlobalMode,
    getGlobalMode,
    toggleNodeMode
  };
})();
