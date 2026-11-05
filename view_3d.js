// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-491, БелАЭС)
// view_3d.js — Модуль 3D WebGL / Three.js PBR визуализации (threeCtrl)
// Модель реактора: GLB-ассет vver1200_rpv.glb (высота 16.72 м, диаметр фланца ~2.75 м)
// Масштаб сцены: 1.0 единица Three.js = 1.0 метр
// ============================================================================

// ============================================================================
// БИБЛИОТЕЧНЫЙ FALLBACK: ВСТРОЕННЫЙ КОНТРОЛЛЕР ORBIT ДЛЯ ТРЕХМЕРНОЙ КАМЕРЫ
// ============================================================================
class VVEROrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 8.36, 0);
    this.enableDamping = true;
    this.dampingFactor = 0.06;
    this.maxDistance = 85.0;
    this.minDistance = 3.5;
    this.maxPolarAngle = Math.PI * 0.72;
    this.minPolarAngle = 0.04;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.42;

    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = offset.length() || 28.0;
    this.theta = Math.atan2(offset.x, offset.z);
    this.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / (this.radius || 1))));

    this.targetRadius = this.radius;
    this.targetTheta = this.theta;
    this.targetPhi = this.phi;

    this.isDragging = false;
    this.isPanning = false;
    this.prevMouse = { x: 0, y: 0 };

    this._onMouseDown = (e) => {
      if (e.button === 0 && !e.shiftKey) {
        this.isDragging = true;
        this.autoRotate = false;
        const arBtn = document.getElementById('btnThreeAutoRotate');
        if (arBtn) arBtn.classList.remove('active');
      } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
        this.isPanning = true;
      }
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;
    };

    this._onMouseMove = (e) => {
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse.x = e.clientX;
      this.prevMouse.y = e.clientY;

      if (this.isDragging) {
        this.targetTheta -= dx * 0.0072;
        this.targetPhi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.targetPhi - dy * 0.0072));
      } else if (this.isPanning) {
        const factor = this.radius * 0.0015;
        const forward = new THREE.Vector3().subVectors(this.target, this.camera.position).normalize();
        const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        this.target.addScaledVector(right, -dx * factor);
        this.target.addScaledVector(up, dy * factor);
      }
    };

    this._onMouseUp = () => {
      this.isDragging = false;
      this.isPanning = false;
    };

    this._onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.09 : 0.91;
      this.targetRadius = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetRadius * factor));
      if (window.threeCtrl) window.threeCtrl.updateHudZoom();
    };

    this._onContextMenu = (e) => e.preventDefault();

    domElement.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('contextmenu', this._onContextMenu);
  }

  update(dt = 0.016) {
    if (this.autoRotate && !this.isDragging && !this.isPanning) {
      this.targetTheta += this.autoRotateSpeed * dt * 0.5;
    }
    const damp = this.enableDamping ? Math.min(1, dt * 14) : 1;
    this.theta += (this.targetTheta - this.theta) * damp;
    this.phi += (this.targetPhi - this.phi) * damp;
    this.radius += (this.targetRadius - this.radius) * damp;

    const sinPhiRadius = Math.sin(this.phi) * this.radius;
    this.camera.position.x = this.target.x + sinPhiRadius * Math.sin(this.theta);
    this.camera.position.y = this.target.y + Math.cos(this.phi) * this.radius;
    this.camera.position.z = this.target.z + sinPhiRadius * Math.cos(this.theta);
    this.camera.lookAt(this.target);
  }

  syncFromCamera() {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = offset.length() || 28.0;
    this.targetRadius = this.radius;
    this.theta = Math.atan2(offset.x, offset.z);
    this.targetTheta = this.theta;
    this.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / (this.radius || 1))));
    this.targetPhi = this.phi;
  }

  dispose() {
    if (!this.domElement) return;
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
  }
}

// ============================================================================
// БАЗА ДАННЫХ ИНЖЕНЕРНЫХ УЗЛОВ ВВЭР-1200 (ПРОЕКТ В-491, МАСШТАБ 1 ЕД = 1 М)
// Геометрия модели: высота 16.72 м, центр Y = 8.36 м, радиус фланца ~2.75 м
// ============================================================================
const VVER_SPECS = {
  rpv: {
    tag: 'РЕАКТОРНАЯ УСТАНОВКА В-491',
    title: 'Корпус реактора ВВЭР-1200',
    desc: 'Вертикальный цилиндрический сосуд высокого давления из низколегированной хромомолибденованадиевой стали 15Х2НМФА-А с внутренней антикоррозионной аустенитной наплавкой. Рассчитан на эксплуатационное давление 16,2 МПа при температуре 350 °C.',
    specs: [
      ['Высота с верхним блоком', '16,72 м'],
      ['Внутр. / Наруж. Ø', '4,232 / 4,626 м'],
      ['Макс. Ø фланца', '5,405 м (st. М170×54)'],
      ['Толщина стенки АЗ', '197 мм (16,2 МПа)']
    ],
    camOffset: [14.0, 16.0, 20.0],
    labelPos: [0, 8.36, 2.85],
    hot: false
  },
  upper_block: {
    tag: 'СИСТЕМА УПРАВЛЕНИЯ И ЗАЩИТЫ',
    title: 'Верхний блок и 121 привод ШЭМ-3',
    desc: 'Сферическая штампованная крышка корпуса и металлоконструкция верхнего блока с 121 шаговым электромагнитным приводом СУЗ ШЭМ-3 для аварийного останова и регулирования реактивности.',
    specs: [
      ['Количество приводов', '121 ШЭМ-3'],
      ['Время сброса АЗ', '< 2,5 сек'],
      ['Ход поглотителя', '3,53 м'],
      ['Отметка оголовка', '+16,72 м']
    ],
    camOffset: [10.0, 18.0, 12.0],
    labelPos: [0, 15.2, 1.8],
    hot: true
  },
  flange: {
    tag: 'ГЕРМЕТИЧНЫЙ ФЛАНЕЦ КОРПУСА',
    title: 'Главный разъем и 54 шпильки М170',
    desc: 'Фланцевый разъем главного уплотнения корпуса и крышки реактора, затягиваемый гидравлическим гайковертом с усилием предварительного натяжения.',
    specs: [
      ['Шпильки разъема', '54 шт. М170×6'],
      ['Окружность центров', '4,960 м'],
      ['Материал шпилек', 'Сталь 38ХН3МФА'],
      ['Уплотнение', 'Никелевые прокладки']
    ],
    camOffset: [8.5, 12.5, 9.5],
    labelPos: [0, 11.2, 2.95],
    hot: false
  },
  nozzles: {
    tag: 'ПЕРВЫЙ КОНТУР ТЕПЛОНОСИТЕЛЯ',
    title: 'Патрубки Ду-850 ГЦТ (4 горячих / 4 холодных)',
    desc: 'Двухъярусная зона врезки 8 патрубков главного циркуляционного трубопровода (4 горячие нитки DN850 верхнего яруса и 4 холодные нитки DN850 нижнего яруса).',
    specs: [
      ['Количество патрубков', '8 шт. (4 гор. + 4 хол.)'],
      ['Внутренний диаметр', 'Ду-850 (850 мм)'],
      ['Расход теплоносителя', '86 000 м³/ч (общий)'],
      ['Рабочее давление', '16,2 МПа']
    ],
    camOffset: [9.0, 11.0, 9.0],
    labelPos: [2.85, 9.8, 1.6],
    hot: true
  },
  bottom: {
    tag: 'НИЖНЯЯ ЧАСТЬ РЕАКТОРА',
    title: 'Глухое эллиптическое днище',
    desc: 'Цельноштампованное эллиптическое днище корпуса без врезок и отверстий, обеспечивающее высокую прочность и надежность удержания активной зоны при экстремальных нагрузках.',
    specs: [
      ['Толщина стенки днища', '197 мм'],
      ['Конструкция', 'Глухое цельнокованое'],
      ['Опорный бурт', 'Отметка +0,0 м'],
      ['Материал', 'Сталь 15Х2НМФА-А']
    ],
    camOffset: [9.0, 3.5, 9.0],
    labelPos: [0, 1.2, 2.6],
    hot: false
  },
  shaft: {
    tag: 'БИОЛОГИЧЕСКАЯ ЗАЩИТА',
    title: 'Бетонная шахта реактора',
    desc: 'Монолитная шахта биологической защиты из тяжелого серпентинитового бетона, окружающая корпус реактора и снижающая флюенс быстрых нейтронов.',
    specs: [
      ['Внутренний радиус', 'R ≈ 3,4 м'],
      ['Плотность бетона', '3,6 т/м³'],
      ['Опорное кольцо', 'Кованая легированная сталь'],
      ['Вентиляция', 'Кольцевой зазор']
    ],
    camOffset: [12.0, 5.0, 12.0],
    labelPos: [3.4, 2.4, 0.0],
    hot: false
  },
  barrel: {
    tag: 'ВНУТРИКОРПУСНЫЕ УСТРОЙСТВА',
    title: 'Внутрикорпусная шахта (Core Barrel)',
    desc: 'Внутрикорпусная шахта с перфорированным эллиптическим днищем. Разделяет нисходящий и восходящий потоки теплоносителя 1-го контура и воспринимает вес активной зоны.',
    specs: [
      ['Материал', 'Сталь 08Х18Н10Т'],
      ['Перфорация днища', 'Отверстия под ТВС'],
      ['Высота шахты', '11,2 м'],
      ['Опирание', 'Бурт фланца корпуса']
    ],
    camOffset: [10.0, 9.0, 12.0],
    labelPos: [0, 7.5, 2.2],
    hot: false,
    showPin: false
  },
  shroud: {
    tag: 'ВЫГОРОДКА АКТИВНОЙ ЗОНЫ',
    title: 'Выгородка активной зоны (Core Shroud)',
    desc: 'Массивная гранёная аустенитная обечайка, повторяющая наружный контур 163 ТВС. Служит боковым отражателем нейтронов и профилирует охлаждение периферии.',
    specs: [
      ['Материал', 'Сталь 08Х18Н10Т'],
      ['Конфигурация', 'Гранёная под 163 ТВС'],
      ['Назначение', 'Отражатель нейтронов'],
      ['Охлаждение', 'Отверстия теплоотвода']
    ],
    camOffset: [8.5, 7.5, 9.5],
    labelPos: [0, 6.0, 1.9],
    hot: false,
    showPin: false
  },
  core: {
    tag: 'АКТИВНАЯ ЗОНА ВВЭР-1200',
    title: '163 кассеты ТВС-2М (Core Assemblies)',
    desc: 'Монолитный массив 163 бесчехловых ТВС-2М. Циркониевые твэлы сплава Э110, топливо — таблетки UO2 с профилированным обогащением до 4,95% по U-235.',
    specs: [
      ['Количество ТВС', '163 шт. ТВС-2М'],
      ['Количество твэлов', '312 шт. в каждой ТВС'],
      ['Материал оболочек', 'Сплав циркония Э110'],
      ['Тепловая мощность', '3200 МВт']
    ],
    camOffset: [8.0, 6.5, 9.0],
    labelPos: [0, 5.5, 1.6],
    hot: true,
    showPin: false
  },
  bzt: {
    tag: 'ВЕРХНИЕ ВКУ И СУЗ',
    title: 'Блок защитных труб (RPV BZT)',
    desc: 'Блок защитных труб с чехлами приводов СУЗ, прижимающий головки 163 ТВС от всплытия и обеспечивающий наведение 121 регулирующей группы поглотителей.',
    specs: [
      ['Чехлы СУЗ', '121 направляющая труба'],
      ['Функция', 'Прижатие ТВС + СУЗ'],
      ['Материал', 'Сталь 08Х18Н10Т'],
      ['Положение', 'Над активной зоной']
    ],
    camOffset: [9.0, 13.0, 10.5],
    labelPos: [0, 11.5, 1.8],
    hot: true,
    showPin: false
  }
};

// ============================================================================
// ОБЪЕКТ УПРАВЛЕНИЯ 3D-СЦЕНОЙ (THREE.JS / PBR DIGITAL TWIN ВВЭР-1200)
// ============================================================================
const threeCtrl = {
  initialized: false,
  contextLost: false,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouseNDC: null,
  canvas: null,

  // Модель и интерактивные коллекции
  rpvModel: null,
  vverModel: null,
  interactableMeshes: [],
  interactiveMeshes: [],
  componentGroups: {},
  pinElements: [],
  projectedVec: null,
  elapsed: 0,
  hoveredMesh: null,

  // Взрыв-схема и X-Ray
  explodedProgress: 0.0,
  explodedTarget: 0.0,
  origPositions: {
    vessel: 0,
    barrel: 0,
    shroud: 0,
    core: 0,
    bzt: 0
  },

  // Материалы окружения
  MATS: {},

  // Обработчики событий для destroy()
  _boundPointerDown: null,
  _boundPointerMove: null,
  _boundPointerUp: null,

  // Состояние 3D-сцены
  state: {
    labelsVisible: true,
    uiVisible: true,
    selectedId: 'rpv',
    hoveredId: null,
    camAnimating: false,
    camTargetPos: null,
    camTargetLook: null,
    xray: false,
    exploded: false
  },

  // DOM оверлей
  labelsLayer: null,
  hoverTooltip: null,
  cardEl: null,
  cardTagEl: null,
  cardTitleEl: null,
  cardDescEl: null,
  cardSpecsEl: null,

  ensureInitialized() {
    if (this.initialized) return;
    this.init();
  },

  init() {
    const container = document.getElementById('threeContainer');
    const errBanner = document.getElementById('webglErrorBanner');
    const errText = document.getElementById('webglErrorText');

    if (!container) return;

    if (window.__threeLoadError || typeof THREE === 'undefined') {
      if (errBanner) errBanner.style.display = 'flex';
      if (errText) errText.textContent = 'Библиотека Three.js загружается или недоступна. Проверьте подключение.';
      return;
    }

    try {
      Object.values(VVER_SPECS).forEach((spec) => {
        if (Array.isArray(spec.camOffset)) spec.camOffset = new THREE.Vector3(...spec.camOffset);
        if (Array.isArray(spec.labelPos)) spec.labelPos = new THREE.Vector3(...spec.labelPos);
      });

      // Фокус ровно на геометрический центр корпуса: (0, 8.36, 0), камера: (14, 16, 20)
      this.state.camTargetPos = new THREE.Vector3(14.0, 16.0, 20.0);
      this.state.camTargetLook = new THREE.Vector3(0, 8.36, 0);

      this.projectedVec = new THREE.Vector3();
      this.raycaster = new THREE.Raycaster();
      this.mouseNDC = new THREE.Vector2();

      container.innerHTML = '';
      this.injectOverlayStyles();

      this.canvas = document.createElement('canvas');
      this.canvas.id = 'vver-3d-canvas';
      this.canvas.style.display = 'block';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.outline = 'none';
      this.canvas.style.cursor = 'grab';
      container.appendChild(this.canvas);

      this.setupDOMOverlay(container);

      // 1. Инициализация WebGLRenderer с PBR и ACES Filmic Tone Mapping
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(container.clientWidth || 1000, container.clientHeight || 650);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Корректная цветопередача PBR стали (#3b4252)
      if (typeof THREE.sRGBEncoding !== 'undefined') {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
      if (typeof this.renderer.outputColorSpace !== 'undefined') {
        this.renderer.outputColorSpace = 'srgb';
      }
      if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
      }

      // 2. Сцена и атмосферная глубина
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x070c14);
      this.scene.fog = new THREE.FogExp2(0x070c14, 0.0085);

      // 3. Камера и контроллер орбиты
      const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
      this.camera = new THREE.PerspectiveCamera(42, aspect, 0.2, 350);
      this.camera.position.set(14.0, 16.0, 20.0);

      if (typeof THREE.OrbitControls === 'function') {
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
      } else {
        this.controls = new VVEROrbitControls(this.camera, this.canvas);
      }
      this.controls.target.set(0, 8.36, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxDistance = 85.0;
      this.controls.minDistance = 3.5;
      this.controls.maxPolarAngle = Math.PI * 0.72;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.42;

      // Обработка потери/восстановления контекста WebGL
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.contextLost = true;
        if (errBanner) errBanner.style.display = 'flex';
        if (errText) errText.textContent = 'Контекст WebGL временно потерян. Ожидание восстановления...';
      }, false);

      this.canvas.addEventListener('webglcontextrestored', () => {
        this.contextLost = false;
        if (errBanner) errBanner.style.display = 'none';
      }, false);

      // 4. Освещение и окружение сцены
      this.buildMaterials();
      this.buildLighting();
      this.buildEnvironment();

      // 5. Загрузка высокоточной PBR-модели vver1200_rpv.glb через THREE.GLTFLoader
      this.loadReactorAsset();

      // 6. Интерактивные выносные 3D-пины
      this.buildCalloutPins();

      // 7. Привязка интерактивных событий мыши/касания
      this.bindEvents();

      this.selectComponent('rpv', false);
      this.initialized = true;

      if (typeof addLog === 'function') {
        addLog('3D Digital Twin ВВЭР-1200: PBR-сцена и GLB-модель реактора успешно инициализированы.', 'ok');
      }
    } catch (err) {
      if (errBanner) errBanner.style.display = 'flex';
      if (errText) errText.textContent = 'Ошибка инициализации 3D PBR: ' + (err && err.message ? err.message : String(err));
      console.error(err);
    }
  },

  injectOverlayStyles() {
    if (document.getElementById('vver3dStyles')) return;
    const style = document.createElement('style');
    style.id = 'vver3dStyles';
    style.textContent = `
      #vver-labels-layer.hidden { opacity: 0; visibility: hidden; }
      .vver-pin {
        position: absolute; transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        transition: opacity 0.2s ease, transform 0.2s ease; will-change: left, top, opacity;
      }
      .vver-pin:hover { z-index: 30; transform: translate(-50%, -100%) scale(1.06); }
      .vver-pin-badge {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
        background: rgba(10, 17, 28, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 240, 255, 0.42); color: #eef4ff; font-size: 11px; font-weight: 600;
        letter-spacing: 0.02em; white-space: nowrap; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55), 0 0 12px rgba(0, 240, 255, 0.14);
        transition: all 0.2s ease;
      }
      .vver-pin:hover .vver-pin-badge, .vver-pin.active .vver-pin-badge {
        background: rgba(0, 42, 66, 0.94); border-color: #00f0ff;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.45); color: #ffffff;
      }
      .vver-pin-dot {
        width: 7px; height: 7px; border-radius: 50%; background: #00f0ff; box-shadow: 0 0 8px #00f0ff; flex-shrink: 0;
      }
      .vver-pin-dot.hot { background: #ff5500; box-shadow: 0 0 8px #ff5500; }
      .vver-pin-stem { width: 1.5px; height: 16px; background: linear-gradient(to bottom, rgba(0, 240, 255, 0.85), rgba(0, 240, 255, 0.1)); }
      .vver-pin-anchor { width: 5px; height: 5px; border-radius: 50%; background: #ffffff; border: 1px solid #00f0ff; box-shadow: 0 0 6px #00f0ff; }
      #vver-info-card {
        width: 325px; padding: 14px 16px; border-radius: 14px; background: rgba(10, 17, 28, 0.88);
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(0, 240, 255, 0.38);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 24px rgba(0, 240, 255, 0.12);
        pointer-events: auto; transition: opacity 0.25s ease, transform 0.25s ease;
      }
      #vver-info-card.hidden { opacity: 0; pointer-events: none; transform: translateY(-8px) scale(0.98); display: none; }
      .vver-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
      .vver-card-tag {
        display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 5px;
        background: rgba(0, 240, 255, 0.14); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); margin-bottom: 4px;
      }
      .vver-card-title { font-size: 14px; font-weight: 700; color: #ffffff; line-height: 1.3; }
      .vver-card-close {
        background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #94a9c9;
        width: 24px; height: 24px; border-radius: 6px; cursor: pointer; font-size: 13px;
        display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease;
      }
      .vver-card-close:hover { background: rgba(255, 85, 0, 0.25); border-color: #ff5500; color: #fff; }
      .vver-card-desc { font-size: 11.5px; line-height: 1.45; color: #cad8ef; margin-bottom: 10px; }
      .vver-specs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; border-top: 1px solid rgba(148, 169, 201, 0.16); padding-top: 8px; }
      .vver-spec-item { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 5px 8px; }
      .vver-spec-label { font-size: 9.5px; color: #94a9c9; text-transform: uppercase; letter-spacing: 0.03em; }
      .vver-spec-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: #ffffff; margin-top: 2px; }
      #vver-hover-tooltip {
        position: absolute; pointer-events: none; z-index: 35; transform: translate(-50%, -140%);
        padding: 4px 10px; border-radius: 6px; background: rgba(8, 14, 24, 0.92);
        border: 1px solid rgba(0, 240, 255, 0.45); color: #fff; font-size: 11px; font-weight: 600;
        white-space: nowrap; opacity: 0; transition: opacity 0.15s ease;
      }
      #vver-hover-tooltip.visible { opacity: 1; }
    `;
    document.head.appendChild(style);
  },

  setupDOMOverlay(container) {
    const overlay = document.createElement('div');
    overlay.id = 'threeOverlay';
    overlay.className = 'three-overlay vver-3d-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.overflow = 'hidden';
    overlay.style.zIndex = '10';

    this.labelsLayer = document.createElement('div');
    this.labelsLayer.id = 'vver-labels-layer';
    this.labelsLayer.style.position = 'absolute';
    this.labelsLayer.style.inset = '0';
    this.labelsLayer.style.pointerEvents = 'none';
    overlay.appendChild(this.labelsLayer);

    const card = document.createElement('div');
    card.id = 'vver-info-card';
    card.className = 'hidden';
    card.style.position = 'absolute';
    card.style.top = '16px';
    card.style.right = '16px';
    card.innerHTML = `
      <div class="vver-card-header">
        <div>
          <span class="vver-card-tag" id="vverCardTag">ТЕХНИЧЕСКИЙ УЗЕЛ</span>
          <div class="vver-card-title" id="vverCardTitle">Название узла</div>
        </div>
        <button class="vver-card-close" id="vverCardClose" title="Закрыть карточку">✕</button>
      </div>
      <div class="vver-card-desc" id="vverCardDesc">Подробное описание узла</div>
      <div class="vver-specs-grid" id="vverCardSpecs"></div>
    `;
    overlay.appendChild(card);

    this.cardEl = card;
    this.cardTagEl = card.querySelector('#vverCardTag');
    this.cardTitleEl = card.querySelector('#vverCardTitle');
    this.cardDescEl = card.querySelector('#vverCardDesc');
    this.cardSpecsEl = card.querySelector('#vverCardSpecs');

    const closeBtn = card.querySelector('#vverCardClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cardEl.classList.add('hidden');
      });
    }

    const hoverTt = document.createElement('div');
    hoverTt.id = 'vver-hover-tooltip';
    overlay.appendChild(hoverTt);
    this.hoverTooltip = hoverTt;

    container.appendChild(overlay);
  },

  buildMaterials() {
    this.MATS = {
      concreteSolid: new THREE.MeshStandardMaterial({
        color: 0x1e2530,
        roughness: 0.95,
        metalness: 0.05
      }),
      bioShieldMat: new THREE.MeshStandardMaterial({
        color: 0x222a36,
        roughness: 0.92,
        metalness: 0.08,
        side: THREE.DoubleSide
      }),
      supportSteelMat: new THREE.MeshStandardMaterial({
        color: 0x4a5568,
        roughness: 0.35,
        metalness: 0.90
      })
    };
  },

  buildLighting() {
    // 1. AmbientLight / HemisphereLight (мягкий холодный свет 0.6 для подсвечивания теней)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.6);
    this.scene.add(hemiLight);

    // 2. DirectionalLight ключевой (белый свет, интенсивность 1.2, направлен под 45° сверху)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(16, 24, 16);
    keyLight.target.position.set(0, 8.36, 0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 80;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 26;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);

    // 3. DirectionalLight контровой (для создания четких металлических бликов на гранях и шпильках фланца)
    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.95);
    rimLight.position.set(-16, 18, -16);
    rimLight.target.position.set(0, 8.36, 0);
    this.scene.add(rimLight);
    this.scene.add(rimLight.target);

    // Дополнительный мягкий заполняющий свет
    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.35);
    fillLight.position.set(-14, 8, 14);
    fillLight.target.position.set(0, 8.36, 0);
    this.scene.add(fillLight);
    this.scene.add(fillLight.target);
  },

  buildEnvironment() {
    const envGroup = new THREE.Group();
    envGroup.name = 'Containment_Environment';

    // 1. Фундаментная плита контейнмента (радиус 18 м, отметка Y = -0.5, верхняя плоскость на Y = 0)
    const floorGeo = new THREE.CylinderGeometry(18.0, 18.5, 1.0, 72);
    const floorMesh = new THREE.Mesh(floorGeo, this.MATS.concreteSolid);
    floorMesh.position.y = -0.5;
    floorMesh.receiveShadow = true;
    floorMesh.castShadow = true;
    envGroup.add(floorMesh);

    // Сетка технологической разметки на плите
    const gridHelper = new THREE.GridHelper(48, 48, 0x1e3a5f, 0x102136);
    gridHelper.position.y = 0.01;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.4;
    envGroup.add(gridHelper);

    // Концентрические окружности гермооболочки
    const ringRadii = [3.4, 7.5, 12.0, 16.5];
    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.04, r + 0.04, 72);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0x00e5ff : 0x38bdf8,
        transparent: true,
        opacity: idx === 0 ? 0.35 : 0.18,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.02;
      envGroup.add(ring);
    });

    // 2. Монолитная бетонная шахта вокруг реактора под реальный радиус (R ≈ 3.4 м, высота 2.4 м)
    // Шахта окружает основание реактора, обеспечивая биологическую защиту и опору
    const shaftInnerR = 3.4;
    const shaftOuterR = 4.8;
    const shaftProfile = [
      new THREE.Vector2(shaftInnerR, 0.0),
      new THREE.Vector2(shaftOuterR, 0.0),
      new THREE.Vector2(shaftOuterR, 2.4),
      new THREE.Vector2(3.15, 2.4),
      new THREE.Vector2(3.15, 2.15),
      new THREE.Vector2(shaftInnerR, 2.15),
      new THREE.Vector2(shaftInnerR, 0.0)
    ];
    const bioShieldShaftGeo = new THREE.LatheGeometry(shaftProfile, 64);
    bioShieldShaftGeo.computeVertexNormals();
    const bioShieldShaft = new THREE.Mesh(bioShieldShaftGeo, this.MATS.bioShieldMat);
    bioShieldShaft.receiveShadow = true;
    bioShieldShaft.castShadow = true;
    bioShieldShaft.userData.componentId = 'shaft';
    bioShieldShaft.userData.tooltipInfo = {
      title: VVER_SPECS.shaft.title,
      sub: VVER_SPECS.shaft.tag,
      desc: VVER_SPECS.shaft.desc,
      simple: VVER_SPECS.shaft.desc,
      telemetry: () => `${VVER_SPECS.shaft.specs[0][0]}: ${VVER_SPECS.shaft.specs[0][1]} | ${VVER_SPECS.shaft.specs[1][0]}: ${VVER_SPECS.shaft.specs[1][1]}`
    };
    this.interactableMeshes.push(bioShieldShaft);
    this.interactiveMeshes.push(bioShieldShaft);
    this.componentGroups['shaft'] = [bioShieldShaft];
    envGroup.add(bioShieldShaft);

    // Стальное опорное кольцо шахты под опорный бурт корпуса реактора
    const bearingRingGeo = new THREE.CylinderGeometry(3.42, 3.42, 0.25, 64, 1, true);
    const bearingRing = new THREE.Mesh(bearingRingGeo, this.MATS.supportSteelMat);
    bearingRing.position.y = 2.25;
    bearingRing.receiveShadow = true;
    envGroup.add(bearingRing);

    // Теневая плоскость
    const shadowGeo = new THREE.CircleGeometry(32, 64);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshStandardMaterial({
      color: 0x070c14,
      roughness: 0.94,
      metalness: 0.06
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = -0.01;
    shadowMesh.receiveShadow = true;
    envGroup.add(shadowMesh);

    this.scene.add(envGroup);
  },

  loadReactorAsset() {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('THREE.GLTFLoader не найден! Ожидание загрузки скрипта...');
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      './vver1200_rpv.glb',
      (gltf) => {
        const model = gltf.scene;
        model.name = 'VVER1200_RPV_GLB';
        // Основание днища модели расположено в Z=0 (в Three.js это Y=0)
        model.position.set(0, 0, 0);

        // 1. Идентификация 5 узлов модели в window.vverModel
        window.vverModel = {
          root: gltf.scene,
          vessel: gltf.scene.getObjectByName('RPV_Vessel'),
          barrel: gltf.scene.getObjectByName('RPV_Core_Barrel'),
          shroud: gltf.scene.getObjectByName('RPV_Core_Shroud'),
          core: gltf.scene.getObjectByName('RPV_Core_Assemblies'),
          bzt: gltf.scene.getObjectByName('RPV_BZT')
        };
        this.vverModel = window.vverModel;

        // Сохранение исходных отметок по высоте
        this.origPositions = {
          vessel: window.vverModel.vessel ? window.vverModel.vessel.position.y : 0,
          barrel: window.vverModel.barrel ? window.vverModel.barrel.position.y : 0,
          shroud: window.vverModel.shroud ? window.vverModel.shroud.position.y : 0,
          core: window.vverModel.core ? window.vverModel.core.position.y : 0,
          bzt: window.vverModel.bzt ? window.vverModel.bzt.position.y : 0
        };

        const specMap = {
          'RPV_Vessel': { id: 'rpv', spec: VVER_SPECS.rpv },
          'RPV_Core_Barrel': { id: 'barrel', spec: VVER_SPECS.barrel },
          'RPV_Core_Shroud': { id: 'shroud', spec: VVER_SPECS.shroud },
          'RPV_Core_Assemblies': { id: 'core', spec: VVER_SPECS.core },
          'RPV_BZT': { id: 'bzt', spec: VVER_SPECS.bzt }
        };

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const mapping = specMap[child.name] || { id: 'rpv', spec: VVER_SPECS.rpv };
            const compSpec = mapping.spec || VVER_SPECS.rpv;

            child.userData.componentId = mapping.id;
            child.userData.tooltipInfo = {
              title: compSpec.title,
              sub: compSpec.tag,
              desc: compSpec.desc,
              simple: compSpec.desc,
              telemetry: () => (compSpec.specs && compSpec.specs.length >= 2)
                ? `${compSpec.specs[0][0]}: ${compSpec.specs[0][1]} | ${compSpec.specs[1][0]}: ${compSpec.specs[1][1]}`
                : compSpec.title
            };

            // Сохранение исходных свойств материала для X-Ray
            if (child.material && !child.userData.origProps) {
              const mat = child.material;
              child.userData.origProps = {
                transparent: Boolean(mat.transparent),
                opacity: typeof mat.opacity === 'number' ? mat.opacity : 1.0,
                depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
                colorHex: mat.color ? mat.color.getHex() : 0x556070,
                roughness: mat.roughness !== undefined ? mat.roughness : 0.35,
                metalness: mat.metalness !== undefined ? mat.metalness : 0.85,
                renderOrder: child.renderOrder || 0
              };
            }

            this.interactableMeshes.push(child);
            this.interactiveMeshes.push(child);
          }
        });

        this.componentGroups['rpv'] = window.vverModel.vessel ? [window.vverModel.vessel] : [model];
        if (window.vverModel.barrel) this.componentGroups['barrel'] = [window.vverModel.barrel];
        if (window.vverModel.shroud) this.componentGroups['shroud'] = [window.vverModel.shroud];
        if (window.vverModel.core) this.componentGroups['core'] = [window.vverModel.core];
        if (window.vverModel.bzt) this.componentGroups['bzt'] = [window.vverModel.bzt];

        this.rpvModel = model;
        this.scene.add(model);

        // Применение режимов X-Ray или взрыв-схемы, если запрошены до загрузки
        if (this.state.xray) {
          this.setXRay(true);
        }
        if (this.explodedProgress > 0 || this.explodedTarget > 0) {
          this.applyExploded(this.explodedProgress);
        }

        if (typeof addLog === 'function') {
          addLog('3D Digital Twin: Модель реактора vver1200_rpv.glb успешно добавлена в сцену (5 узлов ВКУ).', 'ok');
        }
      },
      undefined,
      (err) => {
        console.warn('Локальная загрузка GLB ограничена песочницей браузера (file:///), активирован автономный PBR-реактор В-491:', err);
        this.buildProceduralReactor();
      }
    );
  },

  buildProceduralReactor() {
    const model = new THREE.Group();
    model.name = 'VVER1200_RPV_PROCEDURAL';
    model.position.set(0, 0, 0);

    // 1. Корпус реактора (RPV_Vessel)
    const vesselGroup = new THREE.Group();
    vesselGroup.name = 'RPV_Vessel';

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x3b4252,
      roughness: 0.35,
      metalness: 0.85
    });

    // Цилиндрическая обечайка корпуса (диаметр 4.626 м, радиус 2.313 м, высота 11.2 м)
    const bodyGeo = new THREE.CylinderGeometry(2.313, 2.313, 10.5, 64, 1, false);
    const bodyMesh = new THREE.Mesh(bodyGeo, steelMat);
    bodyMesh.position.y = 6.2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    vesselGroup.add(bodyMesh);

    // Нижнее эллиптическое днище корпуса
    const bottomGeo = new THREE.SphereGeometry(2.313, 64, 32, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
    const bottomMesh = new THREE.Mesh(bottomGeo, steelMat);
    bottomMesh.position.y = 0.95;
    bottomMesh.scale.set(1, 0.42, 1);
    bottomMesh.castShadow = true;
    bottomMesh.receiveShadow = true;
    vesselGroup.add(bottomMesh);

    // Главный упорный фланец корпуса (радиус 2.70 м, отметка Y=11.45 м)
    const flangeGeo = new THREE.CylinderGeometry(2.70, 2.70, 0.95, 64);
    const flangeMesh = new THREE.Mesh(flangeGeo, steelMat);
    flangeMesh.position.y = 11.45;
    flangeMesh.castShadow = true;
    flangeMesh.receiveShadow = true;
    vesselGroup.add(flangeMesh);

    // 54 шпильки главного разъема М170×54
    const studMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.9 });
    for (let s = 0; s < 28; s++) {
      const sa = (s / 28) * Math.PI * 2;
      const studGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 16);
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(Math.cos(sa) * 2.52, 11.95, Math.sin(sa) * 2.52);
      vesselGroup.add(stud);
    }

    // Верхняя сферическая крышка реактора (отметка Y=12.2 м до 15.0 м)
    const headGeo = new THREE.SphereGeometry(2.40, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const headMesh = new THREE.Mesh(headGeo, steelMat);
    headMesh.position.y = 11.8;
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    vesselGroup.add(headMesh);

    // 8 патрубков Ду-850 (4 горячих на отметке Y=8.0 м, 4 холодных на отметке Y=8.8 м)
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.35, metalness: 0.85 });
    for (let i = 0; i < 4; i++) {
      const na = (i / 4) * Math.PI * 2 + Math.PI / 8;
      // Горячий патрубок
      const hotGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.4, 24);
      hotGeo.rotateZ(Math.PI / 2);
      hotGeo.rotateY(-na);
      const hotNozzle = new THREE.Mesh(hotGeo, nozzleMat);
      hotNozzle.position.set(Math.cos(na) * 2.8, 8.0, Math.sin(na) * 2.8);
      vesselGroup.add(hotNozzle);

      // Холодный патрубок
      const coldGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.4, 24);
      coldGeo.rotateZ(Math.PI / 2);
      coldGeo.rotateY(-(na + Math.PI / 4));
      const coldNozzle = new THREE.Mesh(coldGeo, nozzleMat);
      coldNozzle.position.set(Math.cos(na + Math.PI / 4) * 2.8, 8.8, Math.sin(na + Math.PI / 4) * 2.8);
      vesselGroup.add(coldNozzle);
    }

    model.add(vesselGroup);

    // 2. Внутрикорпусная шахта (RPV_Core_Barrel)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.75 });
    const barrelGeo = new THREE.CylinderGeometry(1.85, 1.85, 9.8, 48, 1, true);
    const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
    barrelMesh.name = 'RPV_Core_Barrel';
    barrelMesh.position.y = 6.2;
    barrelMesh.castShadow = true;
    model.add(barrelMesh);

    // 3. Выгородка активной зоны (RPV_Core_Shroud)
    const shroudMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.7 });
    const shroudGeo = new THREE.CylinderGeometry(1.65, 1.65, 4.2, 12, 1, true);
    const shroudMesh = new THREE.Mesh(shroudGeo, shroudMat);
    shroudMesh.name = 'RPV_Core_Shroud';
    shroudMesh.position.y = 5.2;
    shroudMesh.castShadow = true;
    model.add(shroudMesh);

    // 4. Активная зона 163 ТВС-2М (RPV_Core_Assemblies)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.28,
      metalness: 0.65,
      emissive: 0x78350f,
      emissiveIntensity: 0.35
    });
    const coreGeo = new THREE.CylinderGeometry(1.58, 1.58, 3.73, 18);
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.name = 'RPV_Core_Assemblies';
    coreMesh.position.y = 5.2;
    coreMesh.castShadow = true;
    model.add(coreMesh);

    // 5. Блок защитных труб (RPV_BZT)
    const bztGroup = new THREE.Group();
    bztGroup.name = 'RPV_BZT';
    const bztMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.8 });
    const bztPlateGeo = new THREE.CylinderGeometry(1.78, 1.78, 0.4, 32);
    const bztPlate = new THREE.Mesh(bztPlateGeo, bztMat);
    bztPlate.position.y = 7.4;
    bztGroup.add(bztPlate);

    // Направляющие трубы СУЗ
    for (let r = 0; r < 24; r++) {
      const ra = (r / 24) * Math.PI * 2;
      const rad = 0.5 + (r % 3) * 0.45;
      const tubeGeo = new THREE.CylinderGeometry(0.045, 0.045, 4.2, 12);
      const tube = new THREE.Mesh(tubeGeo, bztMat);
      tube.position.set(Math.cos(ra) * rad, 9.6, Math.sin(ra) * rad);
      bztGroup.add(tube);
    }
    model.add(bztGroup);

    // Регистрация в реестре 5 узлов
    window.vverModel = {
      root: model,
      vessel: vesselGroup,
      barrel: barrelMesh,
      shroud: shroudMesh,
      core: coreMesh,
      bzt: bztGroup
    };
    this.vverModel = window.vverModel;

    this.origPositions = {
      vessel: 0,
      barrel: 6.2,
      shroud: 5.2,
      core: 5.2,
      bzt: 0
    };

    const specMap = {
      'RPV_Vessel': { id: 'rpv', spec: VVER_SPECS.rpv },
      'RPV_Core_Barrel': { id: 'barrel', spec: VVER_SPECS.barrel },
      'RPV_Core_Shroud': { id: 'shroud', spec: VVER_SPECS.shroud },
      'RPV_Core_Assemblies': { id: 'core', spec: VVER_SPECS.core },
      'RPV_BZT': { id: 'bzt', spec: VVER_SPECS.bzt }
    };

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        let compId = 'rpv';
        let compSpec = VVER_SPECS.rpv;
        if (child.name in specMap) {
          compId = specMap[child.name].id;
          compSpec = specMap[child.name].spec;
        } else if (child.parent && child.parent.name in specMap) {
          compId = specMap[child.parent.name].id;
          compSpec = specMap[child.parent.name].spec;
        }

        child.userData.componentId = compId;
        child.userData.tooltipInfo = {
          title: compSpec.title,
          sub: compSpec.tag,
          desc: compSpec.desc,
          simple: compSpec.desc,
          telemetry: () => (compSpec.specs && compSpec.specs.length >= 2)
            ? `${compSpec.specs[0][0]}: ${compSpec.specs[0][1]} | ${compSpec.specs[1][0]}: ${compSpec.specs[1][1]}`
            : compSpec.title
        };

        if (child.material && !child.userData.origProps) {
          const mat = child.material;
          child.userData.origProps = {
            transparent: Boolean(mat.transparent),
            opacity: typeof mat.opacity === 'number' ? mat.opacity : 1.0,
            depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
            colorHex: mat.color ? mat.color.getHex() : 0x3b4252,
            roughness: mat.roughness !== undefined ? mat.roughness : 0.35,
            metalness: mat.metalness !== undefined ? mat.metalness : 0.85,
            renderOrder: child.renderOrder || 0
          };
        }

        this.interactableMeshes.push(child);
        this.interactiveMeshes.push(child);
      }
    });

    this.componentGroups['rpv'] = [vesselGroup];
    this.componentGroups['barrel'] = [barrelMesh];
    this.componentGroups['shroud'] = [shroudMesh];
    this.componentGroups['core'] = [coreMesh];
    this.componentGroups['bzt'] = [bztGroup];

    this.rpvModel = model;
    this.scene.add(model);

    if (this.state.xray) {
      this.setXRay(true);
    }
    if (this.explodedProgress > 0 || this.explodedTarget > 0) {
      this.applyExploded(this.explodedProgress);
    }

    const errBanner = document.getElementById('webglErrorBanner');
    if (errBanner) errBanner.style.display = 'none';

    if (typeof addLog === 'function') {
      addLog('3D Digital Twin: Модель реактора ВВЭР-1200 активирована (автономный процедурный PBR-режим 5 узлов ВКУ).', 'ok');
    }
  },

  buildCalloutPins() {
    if (!this.labelsLayer) return;
    this.labelsLayer.innerHTML = '';
    this.pinElements = [];

    Object.entries(VVER_SPECS).forEach(([id, data]) => {
      if (data.showPin === false) return;
      const pinEl = document.createElement('div');
      pinEl.className = 'vver-pin';
      pinEl.dataset.componentId = id;

      const badge = document.createElement('div');
      badge.className = 'vver-pin-badge';

      const dot = document.createElement('span');
      dot.className = 'vver-pin-dot' + (data.hot ? ' hot' : '');

      const text = document.createElement('span');
      text.textContent = data.title;

      badge.appendChild(dot);
      badge.appendChild(text);

      const stem = document.createElement('div');
      stem.className = 'vver-pin-stem';

      const anchor = document.createElement('div');
      anchor.className = 'vver-pin-anchor';

      pinEl.appendChild(badge);
      pinEl.appendChild(stem);
      pinEl.appendChild(anchor);

      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focusOnNode(id);
      });

      this.labelsLayer.appendChild(pinEl);
      this.pinElements.push({ id, el: pinEl, baseWorldPos: data.labelPos.clone() });
    });
  },

  bindEvents() {
    if (!this.canvas) return;

    let pointerDownPos = { x: 0, y: 0 };

    this._boundPointerDown = (e) => {
      pointerDownPos.x = e.clientX;
      pointerDownPos.y = e.clientY;
      this.state.camAnimating = false;
    };

    this._boundPointerMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactableMeshes, true);

      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId;
        if (compId && VVER_SPECS[compId]) {
          this.state.hoveredId = compId;
          this.canvas.style.cursor = 'pointer';
          if (this.hoverTooltip) {
            this.hoverTooltip.textContent = VVER_SPECS[compId].title;
            this.hoverTooltip.style.left = `${e.clientX - rect.left}px`;
            this.hoverTooltip.style.top = `${e.clientY - rect.top}px`;
            this.hoverTooltip.classList.add('visible');
          }
          return;
        }
      }

      if (this.state.hoveredId !== null) {
        this.state.hoveredId = null;
        this.canvas.style.cursor = 'grab';
        if (this.hoverTooltip) this.hoverTooltip.classList.remove('visible');
      }
    };

    this._boundPointerUp = (e) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      const rect = this.canvas.getBoundingClientRect();
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactableMeshes, true);
      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId;
        if (compId) {
          this.selectComponent(compId, true);
        }
      }
    };

    this.canvas.addEventListener('pointerdown', this._boundPointerDown);
    this.canvas.addEventListener('pointermove', this._boundPointerMove);
    this.canvas.addEventListener('pointerup', this._boundPointerUp);

    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.setViewPreset(btn.dataset.cam);
        if (typeof sound !== 'undefined' && sound.click) sound.click(620);
      });
    });

    const autoRotBtn = document.getElementById('btnThreeAutoRotate');
    if (autoRotBtn) {
      autoRotBtn.addEventListener('click', () => this.toggleAutoRotate());
    }

    const xrayBtn = document.getElementById('btnThreeXRay');
    if (xrayBtn) {
      xrayBtn.addEventListener('click', () => this.toggleXRay());
    }

    const explBtn = document.getElementById('btnThreeExploded');
    if (explBtn) {
      explBtn.addEventListener('click', () => this.toggleExploded());
    }
  },

  updateInfoCard(componentId) {
    const info = VVER_SPECS[componentId];
    if (!info || !this.cardEl) return;

    this.cardEl.classList.remove('hidden');
    if (this.cardTagEl) this.cardTagEl.textContent = info.tag;
    if (this.cardTitleEl) this.cardTitleEl.textContent = info.title;
    if (this.cardDescEl) this.cardDescEl.textContent = info.desc;

    if (this.cardSpecsEl) {
      this.cardSpecsEl.innerHTML = '';
      info.specs.forEach(([label, val]) => {
        const item = document.createElement('div');
        item.className = 'vver-spec-item';
        item.innerHTML = `
          <div class="vver-spec-label">${label}</div>
          <div class="vver-spec-val">${val}</div>
        `;
        this.cardSpecsEl.appendChild(item);
      });
    }

    this.pinElements.forEach((p) => {
      p.el.classList.toggle('active', p.id === componentId);
    });
  },

  selectComponent(componentId, focusCamera = true) {
    if (!VVER_SPECS[componentId]) return;
    this.state.selectedId = componentId;
    this.updateInfoCard(componentId);

    const info = VVER_SPECS[componentId];
    if (info && focusCamera) {
      this.state.camTargetLook.copy(info.labelPos);
      this.state.camTargetPos.copy(info.camOffset);
      this.state.camAnimating = true;
    }
  },

  focusOnNode(nodeId) {
    this.selectComponent(nodeId, true);
  },

  setOverviewMode() {
    this.state.camTargetPos.set(14.0, 16.0, 20.0);
    this.state.camTargetLook.set(0, 8.36, 0);
    this.state.camAnimating = true;
    this.selectComponent('rpv', false);
    if (typeof sound !== 'undefined' && sound.click) sound.click(580);
  },

  toggleLabels(btn) {
    this.state.labelsVisible = !this.state.labelsVisible;
    if (btn) btn.classList.toggle('active', this.state.labelsVisible);
    if (this.labelsLayer) this.labelsLayer.classList.toggle('hidden', !this.state.labelsVisible);
    if (typeof sound !== 'undefined' && sound.click) sound.click(520);
  },

  toggleAutoRotate() {
    if (!this.controls) return;
    this.controls.autoRotate = !this.controls.autoRotate;
    const btnThree = document.getElementById('btnThreeAutoRotate');
    if (btnThree) btnThree.classList.toggle('active', this.controls.autoRotate);
    if (typeof sound !== 'undefined' && sound.click) sound.click(580);
  },

  setPreset(preset) {
    if (!this.controls || !this.camera) return;
    if (preset === 'iso' || preset === 'overview') {
      this.state.camTargetPos.set(14.0, 16.0, 20.0);
      this.state.camTargetLook.set(0, 8.36, 0);
    } else if (preset === 'vessel' || preset === 'core') {
      this.state.camTargetPos.set(8.5, 10.5, 9.5);
      this.state.camTargetLook.set(0, 8.36, 0);
    } else if (preset === 'top') {
      this.state.camTargetPos.set(0.01, 26.0, 0.01);
      this.state.camTargetLook.set(0, 8.36, 0);
    } else if (preset === 'ulr' || preset === 'bottom') {
      this.state.camTargetPos.set(8.5, 3.2, 8.5);
      this.state.camTargetLook.set(0, 1.5, 0);
    } else if (VVER_SPECS[preset]) {
      this.focusOnNode(preset);
      return;
    }
    this.state.camAnimating = true;
    this.updateHudZoom();
  },

  setViewPreset(preset) {
    this.setPreset(preset);
  },

  zoomWheel(deltaY) {
    if (!this.controls) return;
    const factor = deltaY > 0 ? 1.09 : 0.91;
    this.controls.targetRadius = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, this.controls.targetRadius * factor));
    this.updateHudZoom();
  },

  zoomStep(dir) {
    if (!this.controls) return;
    const factor = dir > 0 ? 1.15 : 0.86;
    this.controls.targetRadius = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, this.controls.targetRadius * factor));
    this.updateHudZoom();
  },

  updateHudZoom() {
    const hud = document.getElementById('hudZoom');
    if (!hud || !this.camera || !this.controls) return;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const pct = Math.round((28.0 / Math.max(1, dist)) * 100);
    hud.textContent = pct + '%';
  },

  resize() {
    if (!this.initialized || !this.renderer || !this.camera) return;
    const container = document.getElementById('threeContainer');
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.updateHudZoom();
  },

  // ==========================================================================
  // РЕЖИМ X-RAY (РЕНТГЕН КОРПУСА) И ВЗРЫВ-СХЕМА (ПОСЛОЙНЫЙ ПОДЪЕМ ПО ОСИ Y)
  // ==========================================================================
  setXRay(enabled) {
    this.state.xray = Boolean(enabled);
    const vessel = (window.vverModel && window.vverModel.vessel) || (this.scene && this.scene.getObjectByName('RPV_Vessel'));

    if (vessel) {
      vessel.traverse((child) => {
        if (child.isMesh && child.material) {
          if (!child.userData.origProps) {
            const mat = child.material;
            child.userData.origProps = {
              transparent: Boolean(mat.transparent),
              opacity: typeof mat.opacity === 'number' ? mat.opacity : 1.0,
              depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
              colorHex: mat.color ? mat.color.getHex() : 0x556070,
              roughness: mat.roughness !== undefined ? mat.roughness : 0.35,
              metalness: mat.metalness !== undefined ? mat.metalness : 0.85,
              renderOrder: child.renderOrder || 0
            };
          }

          if (this.state.xray) {
            // Режим X-Ray: корпус полупрозрачный (opacity = 0.25, depthWrite = false, синевато-стальной)
            child.material.transparent = true;
            child.material.opacity = 0.25;
            child.material.depthWrite = false;
            child.material.depthTest = true;
            if (child.material.color) {
              child.material.color.setHex(0x5a82a6);
            }
            child.renderOrder = 2; // Отрисовывать поверх непрозрачных внутренних мешей
          } else {
            // Восстановление исходного непрозрачного PBR-материала
            const orig = child.userData.origProps;
            child.material.transparent = orig ? orig.transparent : false;
            child.material.opacity = orig ? orig.opacity : 1.0;
            child.material.depthWrite = orig ? orig.depthWrite : true;
            if (child.material.color && orig && orig.colorHex !== undefined) {
              child.material.color.setHex(orig.colorHex);
            }
            child.renderOrder = orig ? orig.renderOrder : 0;
          }
          child.material.needsUpdate = true;
        }
      });
    }

    const btn = document.getElementById('btnThreeXRay');
    if (btn) {
      btn.classList.toggle('active', this.state.xray);
      btn.textContent = this.state.xray ? 'РЕНТГЕН: ВКЛ' : 'РЕНТГЕН / X-RAY';
    }
    return this.state.xray;
  },

  toggleXRay() {
    const res = this.setXRay(!this.state.xray);
    if (typeof sound !== 'undefined' && sound.click) sound.click(580);
    return res;
  },

  setExploded(progress, immediate = false) {
    const val = Math.max(0.0, Math.min(1.0, typeof progress === 'number' ? progress : (progress ? 1.0 : 0.0)));
    this.explodedTarget = val;
    this.state.exploded = val > 0.05;

    if (immediate) {
      this.explodedProgress = val;
      this.applyExploded(val);
    }

    const btn = document.getElementById('btnThreeExploded');
    if (btn) {
      btn.classList.toggle('active', val > 0.5);
      btn.textContent = val > 0.5 ? 'СОБРАТЬ МОДЕЛЬ' : 'ВЗРЫВ-СХЕМА';
    }
    return this.explodedTarget;
  },

  toggleExploded() {
    const next = this.explodedTarget > 0.5 ? 0.0 : 1.0;
    this.setExploded(next);
    if (typeof sound !== 'undefined' && sound.click) sound.click(540);
    return next;
  },

  applyExploded(progress) {
    if (!window.vverModel) return;
    const { vessel, barrel, shroud, core, bzt } = window.vverModel;
    const orig = this.origPositions || { vessel: 0, barrel: 0, shroud: 0, core: 0, bzt: 0 };

    if (vessel) vessel.position.y = orig.vessel + 0.0;
    if (barrel) barrel.position.y = orig.barrel + progress * 4.0;
    if (shroud) shroud.position.y = orig.shroud + progress * 6.0;
    if (core) core.position.y = orig.core + progress * 8.0;
    if (bzt) bzt.position.y = orig.bzt + progress * 12.0;
  },

  // ==========================================================================
  // СИНХРОНИЗАЦИЯ С ФИЗИЧЕСКИМ ДВИЖКОМ И АНИМАЦИОННЫЙ ЦИКЛ (60 FPS)
  // ==========================================================================
  render(dtReal = 0.016) {
    if (!this.initialized || this.contextLost) return;
    const dt = Math.min(dtReal, 0.05);

    // Строгая проверка паузы симуляции (учет паузы window.sim.isPaused)
    const isPaused = Boolean(window.sim && window.sim.isPaused) === true;
    const timeSpeed = (window.sim && typeof window.sim.timeSpeed === 'number')
      ? Math.max(0, window.sim.timeSpeed)
      : 1.0;
    const simDt = isPaused ? 0.0 : dt * timeSpeed;

    this.elapsed += simDt;

    // Плавная интерполяция взрыв-схемы через lerp
    if (Math.abs(this.explodedProgress - this.explodedTarget) > 0.0005) {
      const step = Math.min(1.0, dt * 5.5);
      this.explodedProgress += (this.explodedTarget - this.explodedProgress) * step;
      this.applyExploded(this.explodedProgress);
    } else if (this.explodedProgress !== this.explodedTarget) {
      this.explodedProgress = this.explodedTarget;
      this.applyExploded(this.explodedProgress);
    }

    // Плавная интерполяция перемещения камеры
    if (this.state.camAnimating) {
      this.camera.position.lerp(this.state.camTargetPos, Math.min(1, dt * 5.2));
      this.controls.target.lerp(this.state.camTargetLook, Math.min(1, dt * 5.8));
      if (
        this.camera.position.distanceTo(this.state.camTargetPos) < 0.08 &&
        this.controls.target.distanceTo(this.state.camTargetLook) < 0.05
      ) {
        this.state.camAnimating = false;
        if (this.controls.syncFromCamera) this.controls.syncFromCamera();
      }
    }

    if (this.controls && this.controls.update) {
      this.controls.update(isPaused ? 0.0 : dt);
    }

    this.renderer.render(this.scene, this.camera);

    // Проекция 3D-выносок в экранные координаты DOM
    if (this.state.labelsVisible && this.labelsLayer) {
      const container = document.getElementById('threeContainer');
      const w = container ? container.clientWidth : 1000;
      const h = container ? container.clientHeight : 650;

      this.pinElements.forEach((pin) => {
        this.projectedVec.copy(pin.baseWorldPos);
        this.projectedVec.project(this.camera);

        if (this.projectedVec.z > 1.0 || this.projectedVec.z < -1.0) {
          pin.el.style.opacity = '0';
          pin.el.style.pointerEvents = 'none';
        } else {
          const x = (this.projectedVec.x * 0.5 + 0.5) * w;
          const y = (-this.projectedVec.y * 0.5 + 0.5) * h;
          pin.el.style.left = `${x}px`;
          pin.el.style.top = `${y}px`;
          pin.el.style.opacity = '1';
          pin.el.style.pointerEvents = 'auto';
        }
      });
    }
  },

  update(dtReal = 0.016) {
    this.render(dtReal);
  },

  updateAndRender(dtReal = 0.016) {
    this.render(dtReal);
  },

  destroy() {
    if (!this.initialized) return;
    if (this.canvas) {
      if (this._boundPointerDown) this.canvas.removeEventListener('pointerdown', this._boundPointerDown);
      if (this._boundPointerMove) this.canvas.removeEventListener('pointermove', this._boundPointerMove);
      if (this._boundPointerUp) this.canvas.removeEventListener('pointerup', this._boundPointerUp);
    }
    if (this.controls && typeof this.controls.dispose === 'function') {
      this.controls.dispose();
    }
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose && m.dispose());
          else if (obj.material.dispose) obj.material.dispose();
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    const container = document.getElementById('threeContainer');
    if (container) container.innerHTML = '';

    this.interactableMeshes = [];
    this.interactiveMeshes = [];
    this.pinElements = [];
    window.vverModel = null;
    this.vverModel = null;
    this.explodedProgress = 0.0;
    this.explodedTarget = 0.0;
    this.initialized = false;
  },

  // Поддержка лучевого хит-тестинга («Простыми словами» / checkRaycaster)
  checkRaycaster(mx, my, rect) {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactiveMeshes, true);
    if (hits.length > 0 && hits[0].object.userData.tooltipInfo) {
      const info = hits[0].object.userData.tooltipInfo;
      this.hoveredMesh = hits[0].object;
      if (typeof populateTooltipDOM === 'function') {
        populateTooltipDOM(info, mx, my, rect);
      }
    } else {
      this.hoveredMesh = null;
      const tooltipEl = document.getElementById('canvasTooltip');
      if (tooltipEl) {
        tooltipEl.style.display = 'none';
      }
    }
  }
};

window.addEventListener('resize', () => {
  if (typeof sim !== 'undefined' && sim.viewMode === '3d') {
    threeCtrl.resize();
  } else if (threeCtrl.initialized) {
    threeCtrl.resize();
  }
});

// Глобальные привязки в window
window.VVEROrbitControls = VVEROrbitControls;
window.VVER_SPECS = VVER_SPECS;
window.threeCtrl = threeCtrl;
window.checkRaycaster = (mx, my, rect) => threeCtrl.checkRaycaster(mx, my, rect);