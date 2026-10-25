// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-392М, Поколение 3+)
// view_3d.js — Модуль 3D WebGL / Three.js PBR визуализации (threeCtrl)
// Масштаб сцены: 1.0 единица Three.js = 1.0 метр
// ============================================================================

// ============================================================================
// БИБЛИОТЕЧНЫЙ FALLBACK: ВСТРОЕННЫЙ КОНТРОЛЛЕР ORBIT ДЛЯ ТРЕХМЕРНОЙ КАМЕРЫ
// ============================================================================
class VVEROrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 2.0, 0);
    this.enableDamping = true;
    this.dampingFactor = 0.06;
    this.maxDistance = 75.0;
    this.minDistance = 4.5;
    this.maxPolarAngle = Math.PI * 0.72;
    this.minPolarAngle = 0.04;
    this.autoRotate = true;
    this.autoRotateSpeed = 0.42;

    const offset = new THREE.Vector3().subVectors(this.camera.position, this.target);
    this.radius = offset.length() || 34.0;
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
    this.radius = offset.length() || 34.0;
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
// БАЗА ДАННЫХ ИНЖЕНЕРНЫХ УЗЛОВ ВВЭР-1200 (ПРОЕКТ В-392М, МАСШТАБ 1 ЕД = 1 М)
// Опорная плоскость главного разъема корпуса: Y = +5.000 м
// Днище корпуса (глухое эллиптическое): Y = -6.185 м (высота корпуса 11.185 м)
// Полная высота реактора с верхним блоком: 19.300 м (до Y = +13.115 м)
// ============================================================================
const VVER_SPECS = {
  rpv: {
    tag: 'РЕАКТОРНАЯ УСТАНОВКА В-392М',
    title: 'Корпус реактора ВВЭР-1200',
    desc: 'Вертикальный сосуд высокого давления из легированной стали 15Х2НМФА-А с внутренней аустенитной наплавкой, глухим эллиптическим днищем, двухъярусной зоной из 8 патрубков Ду-850 и фланцем на 54 шпильки М170.',
    specs: [
      ['Высота без крышки', '11,185 м'],
      ['Внутр. / Наруж. Ø', '4,232 / 4,626 м'],
      ['Макс. Ø фланца', '5,405 м (st. М170×54)'],
      ['Толщина стенки АЗ', '197 мм (16,2 МПа)']
    ],
    camOffset: [12.5, 4.5, 12.5],
    labelPos: [0, 2.35, 2.75],
    hot: false
  },
  upper_block: {
    tag: 'СИСТЕМА УПРАВЛЕНИЯ И ЗАЩИТЫ',
    title: 'Верхний блок и 121 привод ШЭМ-3',
    desc: 'Сферическая штампованная крышка толщиной 210 мм, металлоконструкции шахты верхнего блока с защитным куполом и 121 шаговый электромагнитный привод СУЗ ШЭМ-3 (общая высота сборки реактора 19,3 м).',
    specs: [
      ['Высота сборки РУ', '19,300 м'],
      ['Толщина крышки', '210 мм (штампованная)'],
      ['Приводы ОР СУЗ', '121 шт. (ШЭМ-3)'],
      ['Время сброса АЗ', '< 4,0 с']
    ],
    camOffset: [11.5, 11.8, 11.5],
    labelPos: [0, 10.2, 0],
    hot: false
  },
  core: {
    tag: 'ВНУТРИКОРПУСНЫЕ УСТРОЙСТВА (ВКУ)',
    title: 'Активная зона (163 ТВС-2М), шахта и БЗТ',
    desc: 'Внутрикорпусная шахта (Ø 4,112 м, стенка 60 мм), блок защитных труб (БЗТ), гранная выгородка и 163 шестигранные ТВС-2М (высота 3,73 м, размер под ключ 234 мм) с оптическим Черенковским свечением.',
    specs: [
      ['ТВС-2М в зоне', '163 шт. (ключ 234 мм)'],
      ['Высота активной зоны', '3,730 м'],
      ['Диаметр шахты ВКУ', '4,112 м (ст. 60 мм)'],
      ['Тепловая мощность', '3200 МВт']
    ],
    camOffset: [8.0, 1.2, 8.0],
    labelPos: [0, -1.5, 0],
    hot: true
  },
  pgv: {
    tag: 'ПАРОГЕНЕРИРУЮЩЕЕ ОБОРУДОВАНИЕ',
    title: 'Парогенератор ПГВ-1000МКП (4 шт.)',
    desc: 'Горизонтальный однокорпусной парогенератор (длина ~14 м, диаметр ~4,0 м) с эллиптическими днищами, двумя вертикальными коллекторами первого контура, пучком из 10 978 U-образных труб и паровым коллектором.',
    specs: [
      ['Габариты корпуса', 'L = 14,0 м / Ø 4,0 м'],
      ['Паропроизводит.', '1600 т/ч (каждый)'],
      ['Давление пара II к.', '7,0 МПа (285,8 °C)'],
      ['Теплообм. трубы', '10 978 шт. (08Х18Н10Т)']
    ],
    camOffset: [18.5, 7.5, 18.5],
    labelPos: [9.2, 5.6, 8.2],
    hot: true
  },
  gcna: {
    tag: 'ГЛАВНЫЙ ЦИКЛ ТЕПЛОНОСИТЕЛЯ',
    title: 'Насосный агрегат ГЦНА-1391 (4 шт.)',
    desc: 'Вертикальный одноступенчатый насосный агрегат со сферическим гидрокорпусом внизу, промежуточным фонарем и массивным вертикальным цилиндрическим электродвигателем мощностью 8,0 МВт сверху.',
    specs: [
      ['Подача агрегата', '22 000 м³/ч'],
      ['Мощность привода', '8,0 МВт (1000 об/мин)'],
      ['Создаваемый напор', '0,62 МПа'],
      ['Гидрокорпус', 'Сферический кованый']
    ],
    camOffset: [17.5, 6.2, -15.5],
    labelPos: [10.8, 6.8, -5.2],
    hot: false
  },
  loops: {
    tag: 'ГЛАВНЫЙ ЦИРКУЛЯЦИОННЫЙ КОНТУР',
    title: 'Трубопроводы ГЦК Ду-850 (4 петли)',
    desc: 'Четыре симметричные циркуляционные петли главного контура (внутренний диаметр 850 мм, наружный диаметр 1090 мм в теплоизоляции) с горячими, перепускными и холодными нитками.',
    specs: [
      ['Диаметр прохода', 'Ду-850 (нар. 1,090 м)'],
      ['Расход через реактор', '88 000 м³/ч'],
      ['Темп. гор. / хол.', '328,9 / 298,2 °C'],
      ['Конфигурация', '4 симметричные петли']
    ],
    camOffset: [14.0, 5.5, 14.0],
    labelPos: [5.2, 3.2, 4.8],
    hot: true
  },
  pressurizer: {
    tag: 'СИСТЕМА КОМПЕНСАЦИИ ДАВЛЕНИЯ',
    title: 'Компенсатор давления КД (79 м³) и ИПУ',
    desc: 'Вертикальный цилиндрический сосуд объемом 79 м³ на петле №4 с эллиптическими днищами, блоком электронагревателей, дыхательным трубопроводом Ду-350 к горячей нитке, линиями впрыска, группой ИПУ КД и барботером.',
    specs: [
      ['Полный объем КД', '79,0 м³ (вода 55 м³)'],
      ['Рабочее давление', '16,2 МПа'],
      ['Мощность ТЭНов', '2520 кВт'],
      ['Присоединение', 'Петля №4 (Ду-350)']
    ],
    camOffset: [-17.5, 11.5, 16.5],
    labelPos: [-8.2, 13.5, 6.4],
    hot: true
  },
  saoz: {
    tag: 'ПАССИВНЫЕ СИСТЕМЫ БЕЗОПАСНОСТИ',
    title: 'Гидроемкости САОЗ (4 бака ГЕ-1)',
    desc: 'Четыре вертикальных толстостенных бака пассивной системы аварийного охлаждения зоны под давлением азота 5,9 МПа с запасом раствора борной кислоты (16 г/кг H₃BO₃), подключенных к корпусу реактора.',
    specs: [
      ['Гидроемкости ГЕ-1', '4 × 60 м³ (5,9 МПа)'],
      ['Раствор H₃BO₃', '16 г/кг (борная к-та)'],
      ['Принцип действия', 'Пассивный залив АЗ'],
      ['Трубопроводы САОЗ', '4 линии к напорной камере']
    ],
    camOffset: [-18.0, 8.5, -18.0],
    labelPos: [-11.2, 8.8, -8.8],
    hot: false
  },
  corium_catcher: {
    tag: 'УПРАВЛЕНИЕ ТЯЖЕЛЫМИ АВАРИЯМИ',
    title: 'Устройство локализации расплава (УЛР)',
    desc: 'Коническая ферма-ловушка расплава (Core Catcher) под днищем шахты реактора с водоохлаждаемым корпусом, направляющей воронкой и кассетами жертвенного оксидного материала (Fe₂O₃, Al₂O₃, Gd₂O₃).',
    specs: [
      ['Общая масса УЛР', '730 тонн'],
      ['Жертвенный материал', '169 тонн (оксиды)'],
      ['Охлаждение корпуса', 'Пассивное водяное'],
      ['Отметка размещения', 'Шахта под днищем РУ']
    ],
    camOffset: [11.5, -6.5, 11.5],
    labelPos: [0, -8.8, 3.2],
    hot: true
  },
  containment: {
    tag: 'ЛОКАЛИЗУЮЩИЕ СИСТЕМЫ БЕЗОПАСНОСТИ',
    title: 'Гермооболочка, полярный кран и СПОТ',
    desc: 'Двойная защитная герметичная оболочка (внутренний диаметр 44 м) с круговым рельсом полярного крана и 4 теплообменниками системы пассивного отвода тепла (СПОТ) в купольной части.',
    specs: [
      ['Внутр. диаметр ЗО', '44,0 м'],
      ['Каналы СПОТ', '4 × 100% резерв'],
      ['Полярный кран', 'Грузоподъемность 360 т'],
      ['Конструкция ЗО', 'Двойная преднапряж. ЖБ']
    ],
    camOffset: [28.0, 15.5, 28.0],
    labelPos: [0, 14.8, -16.5],
    hot: false
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

  // Коллекции интерактивных узлов и динамических систем
  interactableMeshes: [],
  interactiveMeshes: [],
  componentGroups: {},
  explodedParts: [],
  xrayMaterials: [],
  flowSystems: [],
  flowTextures: [],
  pumpImpellers: [],
  pinElements: [],
  projectedVec: null,
  elapsed: 0,
  hoveredMesh: null,

  // Материалы и источники света
  MATS: {},
  cherenkovPointLight: null,
  coreWarmLight: null,
  controlRodsGroup: null,
  cherenkovVolumeMesh: null,
  tvsCoords: [],

  // Обработчики событий для корректного destroy()
  _boundPointerDown: null,
  _boundPointerMove: null,
  _boundPointerUp: null,
  _boundResize: null,

  // Состояние режимов 3D-сцены
  state: {
    xray: false,
    exploded: false,
    flowActive: true,
    labelsVisible: true,
    uiVisible: true,
    selectedId: 'rpv',
    hoveredId: null,
    xrayFactor: 0,
    explodeFactor: 0,
    camAnimating: false,
    camTargetPos: null,
    camTargetLook: null
  },

  // Ссылки на DOM-элементы оверлея
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
      if (errText) errText.textContent = 'Библиотека Three.js загружается или недоступна. Проверьте сетевое подключение.';
      return;
    }

    try {
      Object.values(VVER_SPECS).forEach((spec) => {
        if (Array.isArray(spec.camOffset)) spec.camOffset = new THREE.Vector3(...spec.camOffset);
        if (Array.isArray(spec.labelPos)) spec.labelPos = new THREE.Vector3(...spec.labelPos);
      });

      this.state.camTargetPos = new THREE.Vector3(24.0, 14.5, 25.0);
      this.state.camTargetLook = new THREE.Vector3(0, 2.0, 0);

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

      // 1. Инициализация WebGLRenderer с настройками PBR и ACES Filmic Tone Mapping
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
      if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.18;
      }

      // 2. Сцена и атмосферная глубина
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x070c14);
      this.scene.fog = new THREE.FogExp2(0x070c14, 0.0095);

      // 3. Камера и контроллер орбиты
      const aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
      this.camera = new THREE.PerspectiveCamera(42, aspect, 0.2, 320);
      this.camera.position.set(24.0, 14.5, 25.0);

      if (typeof THREE.OrbitControls === 'function') {
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
      } else {
        this.controls = new VVEROrbitControls(this.camera, this.canvas);
      }
      this.controls.target.set(0, 2.0, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxDistance = 75.0;
      this.controls.minDistance = 4.5;
      this.controls.maxPolarAngle = Math.PI * 0.72;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.42;

      // Обработка потери/восстановления контекста WebGL
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.contextLost = true;
        if (errBanner) errBanner.style.display = 'flex';
        if (errText) errText.textContent = 'Контекст WebGL временно потерян. Ожидание восстановления...';
        if (typeof addLog === 'function') addLog('3D Визуализация: Потеря контекста WebGL.', 'warn');
      }, false);

      this.canvas.addEventListener('webglcontextrestored', () => {
        this.contextLost = false;
        if (errBanner) errBanner.style.display = 'none';
        if (typeof addLog === 'function') addLog('3D Визуализация: Контекст WebGL успешно восстановлен.', 'ok');
      }, false);

      // 4. Окружение PBR и процедурные текстуры микрорельефа металла и потока
      const brushedMap = this.createBrushedMetalTexture();
      this.setupStudioEnvironment();

      // 5. Инициализация инженерных PBR-материалов и освещения
      this.buildPBRMaterials(brushedMap);
      this.buildLighting();
      this.buildIndustrialFloor();

      // 6. Построение точной 3D-геометрии ВВЭР-1200 (проект В-392М)
      this.buildCompleteGeometry();

      // 7. Построение выносных интерактивных 3D-пинов
      this.buildCalloutPins();

      // 8. Привязка интерактивных событий и лучевого хит-тестинга
      this.bindEvents();

      this.selectComponent('rpv', false);
      this.initialized = true;
      if (typeof addLog === 'function') {
        addLog('3D Digital Twin ВВЭР-1200 (Проект В-392М): Инженерная PBR-модель успешно загружена.', 'ok');
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
      .vver-btn {
        display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px;
        background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); color: #eef4ff;
        font-size: 11.5px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;
      }
      .vver-btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(0, 240, 255, 0.5); transform: translateY(-1px); }
      .vver-btn.active {
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.22), rgba(0, 110, 255, 0.26));
        border-color: #00f0ff; color: #ffffff; box-shadow: 0 0 14px rgba(0, 240, 255, 0.28);
      }
      .vver-btn-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a9c9; transition: all 0.2s ease; }
      .vver-btn.active .vver-btn-dot { background: #00f0ff; box-shadow: 0 0 6px #00f0ff; }
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
    this.labelsLayer = document.createElement('div');
    this.labelsLayer.id = 'vver-labels-layer';
    this.labelsLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:15;';
    container.appendChild(this.labelsLayer);

    this.hoverTooltip = document.createElement('div');
    this.hoverTooltip.id = 'vver-hover-tooltip';
    container.appendChild(this.hoverTooltip);

    const topRight = document.createElement('div');
    topRight.className = 'vver-top-right';
    topRight.style.cssText = 'position:absolute;top:14px;right:16px;z-index:25;display:flex;flex-direction:column;align-items:flex-end;gap:10px;max-width:350px;pointer-events:none;';

    this.cardEl = document.createElement('div');
    this.cardEl.id = 'vver-info-card';
    this.cardEl.innerHTML = `
      <div class="vver-card-header">
        <div>
          <div class="vver-card-tag" id="card-tag">РЕАКТОРНАЯ УСТАНОВКА В-392М</div>
          <div class="vver-card-title" id="card-title">Корпус реактора ВВЭР-1200</div>
        </div>
        <button type="button" class="vver-card-close" id="btn-close-card" title="Закрыть карточку">✕</button>
      </div>
      <div class="vver-card-desc" id="card-desc"></div>
      <div class="vver-specs-grid" id="card-specs"></div>
    `;
    topRight.appendChild(this.cardEl);
    container.appendChild(topRight);

    this.cardTagEl = this.cardEl.querySelector('#card-tag');
    this.cardTitleEl = this.cardEl.querySelector('#card-title');
    this.cardDescEl = this.cardEl.querySelector('#card-desc');
    this.cardSpecsEl = this.cardEl.querySelector('#card-specs');

    this.cardEl.querySelector('#btn-close-card').addEventListener('click', () => {
      this.cardEl.classList.add('hidden');
    });

    const bottomToolbar = document.createElement('div');
    bottomToolbar.id = 'vver-bottom-toolbar';
    bottomToolbar.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:25;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;padding:8px 12px;border-radius:14px;background:rgba(12,19,31,0.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(120,175,255,0.22);box-shadow:0 14px 36px rgba(0,0,0,0.6);';

    bottomToolbar.innerHTML = `
      <button type="button" class="vver-btn active" id="btn-view-overview">
        <span class="vver-btn-dot"></span><span>Общий вид 3D</span>
      </button>
      <button type="button" class="vver-btn" id="btn-view-xray">
        <span class="vver-btn-dot"></span><span>Разрез корпуса (X-Ray)</span>
      </button>
      <button type="button" class="vver-btn" id="btn-view-exploded">
        <span class="vver-btn-dot"></span><span>Взрыв-схема (Exploded)</span>
      </button>
      <button type="button" class="vver-btn active" id="btn-toggle-flow">
        <span class="vver-btn-dot"></span><span>Поток теплоносителя</span>
      </button>
      <button type="button" class="vver-btn active" id="btn-toggle-labels">
        <span class="vver-btn-dot"></span><span>Подписи узлов</span>
      </button>
    `;
    container.appendChild(bottomToolbar);

    bottomToolbar.querySelector('#btn-view-overview').addEventListener('click', () => this.setOverviewMode());
    bottomToolbar.querySelector('#btn-view-xray').addEventListener('click', () => this.toggleXray());
    bottomToolbar.querySelector('#btn-view-exploded').addEventListener('click', () => this.toggleExploded());
    bottomToolbar.querySelector('#btn-toggle-flow').addEventListener('click', (e) => this.toggleFlow(e.currentTarget));
    bottomToolbar.querySelector('#btn-toggle-labels').addEventListener('click', (e) => this.toggleLabels(e.currentTarget));
  },

  createBrushedMetalTexture() {
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 256;
    texCanvas.height = 256;
    const ctx = texCanvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2200; i++) {
      const y = Math.random() * 256;
      const x = Math.random() * 256;
      const w = 16 + Math.random() * 72;
      const shade = 105 + Math.floor(Math.random() * 50);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, w, 1);
    }

    const texture = new THREE.CanvasTexture(texCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    return texture;
  },

  createSoftGlowSpriteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.18)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  },

  createFlowPulseTexture(isHot) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);

    for (let i = 0; i < 4; i++) {
      const cx = (i + 0.5) * 64;
      const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0);
      if (isHot) {
        grad.addColorStop(0.0, 'rgba(255, 70, 0, 0.02)');
        grad.addColorStop(0.5, 'rgba(255, 165, 40, 0.85)');
        grad.addColorStop(1.0, 'rgba(255, 70, 0, 0.02)');
      } else {
        grad.addColorStop(0.0, 'rgba(0, 140, 255, 0.02)');
        grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.85)');
        grad.addColorStop(1.0, 'rgba(0, 140, 255, 0.02)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 28, 0, 56, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 1);
    return texture;
  },

  setupStudioEnvironment() {
    if (typeof THREE.PMREMGenerator === 'function') {
      try {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();

        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0x0d1624);

        const stripGeo = new THREE.PlaneGeometry(26, 8);
        const warmLightMat = new THREE.MeshBasicMaterial({ color: 0xfff2dd, side: THREE.DoubleSide });
        const coolLightMat = new THREE.MeshBasicMaterial({ color: 0x6ecbff, side: THREE.DoubleSide });
        const rimLightMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide });

        const topStrip = new THREE.Mesh(stripGeo, warmLightMat);
        topStrip.position.set(12, 22, 12);
        topStrip.lookAt(0, 0, 0);
        envScene.add(topStrip);

        const sideStrip = new THREE.Mesh(stripGeo, coolLightMat);
        sideStrip.position.set(-20, 8, -14);
        sideStrip.lookAt(0, 0, 0);
        envScene.add(sideStrip);

        const rimStrip = new THREE.Mesh(stripGeo, rimLightMat);
        rimStrip.position.set(0, -18, 16);
        rimStrip.lookAt(0, 0, 0);
        envScene.add(rimStrip);

        const envMap = pmrem.fromScene(envScene, 0.04).texture;
        this.scene.environment = envMap;
        pmrem.dispose();
      } catch (e) {
        console.warn('PMREM environment generation skipped:', e);
      }
    }
  },

  registerXrayMat(mat, solidOpacity = 1.0, xrayOpacity = 0.15) {
    mat.userData.solidOpacity = solidOpacity;
    mat.userData.xrayOpacity = xrayOpacity;
    this.xrayMaterials.push(mat);
    return mat;
  },

  // ==========================================================================
  // 5. PBR-МАТЕРИАЛЫ И ШЕЙДЕРЫ ПО ИНЖЕНЕРНОЙ СПЕЦИФИКАЦИИ В-392М
  // ==========================================================================
  buildPBRMaterials(brushedMap) {
    this.xrayMaterials = [];
    this.flowTextures = [];

    const CherenkovMatClass = typeof THREE.MeshPhysicalMaterial === 'function'
      ? THREE.MeshPhysicalMaterial
      : THREE.MeshStandardMaterial;

    this.MATS = {
      // Корпус реактора: конструкционная легированная сталь (#2b3038, roughness 0.42, metalness 0.88)
      rpvCarbonSteel: this.registerXrayMat(new THREE.MeshStandardMaterial({
        color: 0x2b3038,
        roughness: 0.42,
        metalness: 0.88,
        roughnessMap: brushedMap,
        side: THREE.DoubleSide
      }), 1.0, 0.14),

      rpvCarbonSteelSolid: new THREE.MeshStandardMaterial({
        color: 0x2b3038,
        roughness: 0.42,
        metalness: 0.88,
        roughnessMap: brushedMap
      }),

      // Патрубки и фланцы: обработанная матовая кованая сталь (#4a5568, roughness 0.35, metalness 0.92)
      forgedNozzleSteel: this.registerXrayMat(new THREE.MeshStandardMaterial({
        color: 0x4a5568,
        roughness: 0.35,
        metalness: 0.92,
        roughnessMap: brushedMap,
        side: THREE.DoubleSide
      }), 1.0, 0.22),

      forgedSteelSolid: new THREE.MeshStandardMaterial({
        color: 0x4a5568,
        roughness: 0.35,
        metalness: 0.92,
        roughnessMap: brushedMap
      }),

      // Трубопроводы и парогенераторы в теплоизоляции: матовые алюминиевые кожухи (#94a3b8, roughness 0.55, metalness 0.35)
      thermalInsulation: this.registerXrayMat(new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.55,
        metalness: 0.35,
        roughnessMap: brushedMap,
        side: THREE.DoubleSide
      }), 1.0, 0.16),

      hotPipeInsulation: this.registerXrayMat(new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.55,
        metalness: 0.35,
        roughnessMap: brushedMap,
        emissive: new THREE.Color(0xff4500),
        emissiveIntensity: 0.05,
        side: THREE.DoubleSide
      }), 1.0, 0.18),

      coldPipeInsulation: this.registerXrayMat(new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.55,
        metalness: 0.35,
        roughnessMap: brushedMap,
        emissive: new THREE.Color(0x00a8ff),
        emissiveIntensity: 0.04,
        side: THREE.DoubleSide
      }), 1.0, 0.18),

      // Внутренняя антикоррозионная наплавка и ВКУ: аустенитная нержавеющая сталь (#cbd5e1, roughness 0.25, metalness 0.95)
      austeniticStainless: this.registerXrayMat(new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.25,
        metalness: 0.95,
        roughnessMap: brushedMap,
        side: THREE.DoubleSide
      }), 1.0, 0.22),

      austeniticSolid: new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.25,
        metalness: 0.95,
        roughnessMap: brushedMap
      }),

      // Дополнительные технологические материалы узлов
      motorBlue: new THREE.MeshStandardMaterial({
        color: 0x1e4e79,
        roughness: 0.38,
        metalness: 0.62
      }),

      saozTankSteel: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.42,
        metalness: 0.72,
        roughnessMap: brushedMap
      }),

      saozBandBlue: new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.40,
        metalness: 0.45
      }),

      fuelAssemblyZircaloy: new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.28,
        metalness: 0.82,
        emissive: new THREE.Color(0xff5500),
        emissiveIntensity: 0.36
      }),

      // Мягкое оптическое Черенковское свечение (#00f0ff, MeshPhysicalMaterial с прозрачностью и динамической эмиссией)
      cherenkovPhysical: new CherenkovMatClass({
        color: 0x00f0ff,
        emissive: new THREE.Color(0x00f0ff),
        emissiveIntensity: 1.25,
        roughness: 0.12,
        metalness: 0.05,
        transparent: true,
        opacity: 0.34,
        transmission: 0.65,
        ior: 1.333,
        depthWrite: false,
        side: THREE.DoubleSide
      }),

      uTubeBundle: new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.25,
        metalness: 0.95,
        emissive: new THREE.Color(0xff5500),
        emissiveIntensity: 0.28
      }),

      coriumSteel: new THREE.MeshStandardMaterial({
        color: 0x3b4252,
        roughness: 0.44,
        metalness: 0.84
      }),

      coriumSacrificial: new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.38,
        metalness: 0.55,
        emissive: new THREE.Color(0xff5500),
        emissiveIntensity: 0.32
      }),

      containmentGlass: new CherenkovMatClass({
        color: 0x38bdf8,
        metalness: 0.08,
        roughness: 0.22,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false
      }),

      containmentWire: new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.09,
        wireframe: true
      }),

      spriteTexture: this.createSoftGlowSpriteTexture()
    };
  },

  buildLighting() {
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.9);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.3);
    keyLight.position.set(24, 36, 26);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 1.2);
    fillLight.position.set(-26, 16, -20);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.95);
    rimLight.position.set(0, -20, -24);
    this.scene.add(rimLight);

    this.cherenkovPointLight = new THREE.PointLight(0x00f0ff, 3.6, 14, 1.5);
    this.cherenkovPointLight.position.set(0, -1.6, 0);
    this.scene.add(this.cherenkovPointLight);

    this.coreWarmLight = new THREE.PointLight(0xff5500, 1.8, 11, 1.5);
    this.coreWarmLight.position.set(0, -2.5, 0);
    this.scene.add(this.coreWarmLight);
  },

  buildIndustrialFloor() {
    const floorGroup = new THREE.Group();
    floorGroup.name = 'IndustrialFloor';

    const gridHelper = new THREE.GridHelper(64, 64, 0x1e3a5f, 0x112238);
    gridHelper.position.y = -11.4;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.45;
    floorGroup.add(gridHelper);

    const ringRadii = [3.6, 9.5, 16.0, 22.0];
    ringRadii.forEach((r, idx) => {
      const ringGeo = new THREE.RingGeometry(r - 0.05, r + 0.05, 96);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0xff5500 : 0x00f0ff,
        transparent: true,
        opacity: idx === 0 ? 0.35 : 0.18,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = -11.38;
      floorGroup.add(ring);
    });

    const shadowPlaneGeo = new THREE.CircleGeometry(34, 64);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshStandardMaterial({
      color: 0x070c14,
      roughness: 0.92,
      metalness: 0.08
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.position.y = -11.42;
    shadowPlane.receiveShadow = true;
    floorGroup.add(shadowPlane);

    this.scene.add(floorGroup);
  },

  registerComponent(group, componentId, explodeOffset) {
    group.userData.componentId = componentId;
    group.userData.basePos = group.position.clone();
    group.userData.explodeOffset = explodeOffset.clone();
    this.componentGroups[componentId] = this.componentGroups[componentId] || [];
    this.componentGroups[componentId].push(group);
    this.explodedParts.push(group);
  },

  tagInteractableHierarchy(root, componentId) {
    root.traverse((child) => {
      if (child.isMesh && !child.userData.ignoreRaycast) {
        child.userData.componentId = componentId;
        const spec = VVER_SPECS[componentId];
        if (spec) {
          child.userData.tooltipInfo = {
            title: spec.title,
            sub: spec.tag,
            desc: spec.desc,
            simple: spec.desc,
            telemetry: () => `${spec.specs[0][0]}: ${spec.specs[0][1]} | ${spec.specs[1][0]}: ${spec.specs[1][1]}`
          };
        }
        this.interactableMeshes.push(child);
        this.interactiveMeshes.push(child);
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  },

  // Генерация 163 координат гексагональной сетки ТВС-2М (размер под ключ 0.234 м, шаг 0.236 м)
  generate163HexCoords(pitch = 0.236) {
    const coords = [];
    for (let q = -7; q <= 7; q++) {
      for (let r = -7; r <= 7; r++) {
        const s = -q - r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        if (ring <= 7) {
          const x = pitch * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
          const z = pitch * (1.5 * r);
          const distSq = x * x + z * z;
          coords.push({ x, z, distSq, ring });
        }
      }
    }
    coords.sort((a, b) => a.distSq - b.distSq);
    return coords.slice(0, 163);
  },

  // Создание мягких световых импульсов полупрозрачных частиц и UV-потока внутри труб
  createCoolantFlowStream(curve, parentGroup, isHot, loopIndex, tubeRadius = 0.34, pulseCount = 28) {
    // 1. Внутренний полупрозрачный световой поток со смещением UV-координат текстуры
    const flowTex = this.createFlowPulseTexture(isHot);
    this.flowTextures.push({ texture: flowTex, loopIndex, speed: isHot ? 0.85 : 0.78 });

    const streamMat = new THREE.MeshBasicMaterial({
      map: flowTex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const streamGeo = new THREE.TubeGeometry(curve, 44, tubeRadius * 0.62, 12, false);
    const streamMesh = new THREE.Mesh(streamGeo, streamMat);
    streamMesh.userData.ignoreRaycast = true;
    parentGroup.add(streamMesh);

    // 2. Мягкие световые импульсы полупрозрачных частиц вдоль оси трубопровода
    const positions = new Float32Array(pulseCount * 3);
    const phases = new Float32Array(pulseCount);
    const radialOffsets = [];

    for (let i = 0; i < pulseCount; i++) {
      phases[i] = i / pulseCount + (Math.random() * 0.02);
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.random() * (tubeRadius * 0.35);
      radialOffsets.push(new THREE.Vector3(Math.cos(angle) * rad, Math.sin(angle) * rad, 0));
      const pt = curve.getPointAt(phases[i] % 1.0);
      positions[i * 3] = pt.x;
      positions[i * 3 + 1] = pt.y;
      positions[i * 3 + 2] = pt.z;
    }

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const ptMat = new THREE.PointsMaterial({
      color: isHot ? 0xff7b1a : 0x00f0ff,
      map: this.MATS.spriteTexture,
      size: tubeRadius * 1.65,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pointsObj = new THREE.Points(ptGeo, ptMat);
    pointsObj.userData.ignoreRaycast = true;
    parentGroup.add(pointsObj);

    this.flowSystems.push({
      pointsObj,
      streamMesh,
      curve,
      phases,
      radialOffsets,
      loopIndex,
      speed: isHot ? 0.26 : 0.24
    });
  },

  // ==========================================================================
  // ПОСТРОЕНИЕ ПОЛНОЙ ИНЖЕНЕРНОЙ ГЕОМЕТРИИ ВВЭР-1200 (ПРОЕКТ В-392М)
  // ==========================================================================
  buildCompleteGeometry() {
    this.interactableMeshes = [];
    this.interactiveMeshes = [];
    this.componentGroups = {};
    this.explodedParts = [];
    this.flowSystems = [];
    this.flowTextures = [];
    this.pumpImpellers = [];

    const rootAssembly = new THREE.Group();
    rootAssembly.name = 'VVER1200_V392M_Root';
    this.scene.add(rootAssembly);

    const dummy = new THREE.Object3D();
    const loopAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

    // ========================================================================
    // 1. КОРПУС РЕАКТОРА (RPV) ЧЕРЕЗ THREE.LatheGeometry ПО ПРОФИЛЮ В-392М
    // - Полная высота без крышки: 11.185 м (от Y = -6.185 м до Y = +5.000 м)
    // - Внутренний диаметр: 4.232 м (радиус 2.116 м)
    // - Наружный диаметр обечайки АЗ: 4.626 м (радиус 2.313 м, стенка 0.197 м)
    // - Максимальный диаметр в зоне патрубков и фланца: 5.405 м (радиус 2.7025 м)
    // - Днище: эллиптическое, глухое (без проходок и отверстий)
    // - Главный разъем: 54 шпильки М170 (диаметр 0.17 м) через THREE.InstancedMesh
    // ========================================================================
    const rpvGroup = new THREE.Group();
    rpvGroup.name = 'RPV_Assembly';
    rootAssembly.add(rpvGroup);

    const vesselBodyGroup = new THREE.Group();
    vesselBodyGroup.name = 'Корпус_реактора_В392М';
    rpvGroup.add(vesselBodyGroup);

    const rpvBottomY = -6.185;
    const rpvFlangeTopY = 5.000; // 5.000 - (-6.185) = 11.185 м ровно
    const innerRadiusCore = 2.116; // Ø 4.232 м
    const outerRadiusCore = 2.313; // Ø 4.626 м (стенка 0.197 м)
    const maxFlangeRadius = 2.7025; // Ø 5.405 м

    // Профиль замкнутой стенки корпуса для THREE.LatheGeometry
    const lathePoints = [];
    const ellipSteps = 20;
    const outerEllipCenterY = -4.850;
    const outerEllipB = outerEllipCenterY - rpvBottomY; // 1.335 м полуось эллиптического днища

    // Наружный контур эллиптического глухого днища (от оси r = 0 до r = 2.313 м)
    for (let i = 0; i <= ellipSteps; i++) {
      const t = (i / ellipSteps) * (Math.PI / 2);
      const r = Math.sin(t) * outerRadiusCore;
      const y = outerEllipCenterY - Math.cos(t) * outerEllipB;
      lathePoints.push(new THREE.Vector2(r, y));
    }

    // Цилиндрическая обечайка активной зоны (r = 2.313 м) и переход к опорному бурту и зоне патрубков
    lathePoints.push(new THREE.Vector2(outerRadiusCore, 0.35));
    lathePoints.push(new THREE.Vector2(2.580, 0.65)); // Нижний опорный фланец/бурт корпуса
    lathePoints.push(new THREE.Vector2(2.580, 0.98));
    lathePoints.push(new THREE.Vector2(2.495, 1.15)); // Утолщенная кованая обечайка зоны патрубков
    lathePoints.push(new THREE.Vector2(2.495, 3.85));
    lathePoints.push(new THREE.Vector2(maxFlangeRadius, 4.15)); // Главный опорный фланец Ø 5.405 м (r = 2.7025 м)
    lathePoints.push(new THREE.Vector2(maxFlangeRadius, rpvFlangeTopY));

    // Верхняя плоскость главного разъема и внутренний контур корпуса (толщина стенки 0.197 м)
    lathePoints.push(new THREE.Vector2(innerRadiusCore, rpvFlangeTopY));
    lathePoints.push(new THREE.Vector2(innerRadiusCore, outerEllipCenterY));

    // Внутренний контур глухого эллиптического днища (толщина 0.197 м)
    const innerEllipB = outerEllipB - 0.197;
    for (let i = ellipSteps; i >= 0; i--) {
      const t = (i / ellipSteps) * (Math.PI / 2);
      const r = Math.sin(t) * innerRadiusCore;
      const y = outerEllipCenterY - Math.cos(t) * innerEllipB;
      lathePoints.push(new THREE.Vector2(r, y));
    }

    const rpvLatheGeo = new THREE.LatheGeometry(lathePoints, 72);
    rpvLatheGeo.computeVertexNormals();
    const rpvLatheMesh = new THREE.Mesh(rpvLatheGeo, this.MATS.rpvCarbonSteel);
    vesselBodyGroup.add(rpvLatheMesh);

    // Внутренняя аустенитная антикоррозионная наплавка (#cbd5e1)
    const cladPoints = [];
    for (let i = 0; i <= ellipSteps; i++) {
      const t = (i / ellipSteps) * (Math.PI / 2);
      const r = Math.sin(t) * (innerRadiusCore - 0.008);
      const y = outerEllipCenterY - Math.cos(t) * (innerEllipB - 0.008);
      cladPoints.push(new THREE.Vector2(r, y));
    }
    cladPoints.push(new THREE.Vector2(innerRadiusCore - 0.008, rpvFlangeTopY - 0.02));
    const cladGeo = new THREE.LatheGeometry(cladPoints, 64);
    const cladMesh = new THREE.Mesh(cladGeo, this.MATS.austeniticStainless);
    vesselBodyGroup.add(cladMesh);

    // Кованый поясок верхнего фланца (#4a5568)
    const flangeCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(maxFlangeRadius + 0.01, maxFlangeRadius + 0.01, 0.78, 72, 1, true),
      this.MATS.forgedNozzleSteel
    );
    flangeCollar.position.y = 4.58;
    vesselBodyGroup.add(flangeCollar);

    // Двухъярусная патрубковая зона (2 высотных уровня по 4 патрубка Ду-850 на каждом:
    // Внутренний диаметр 0.850 м -> r = 0.425 м; Наружный диаметр 1.090 м -> r = 0.545 м)
    const lowerNozzleY = 1.65; // Нижний ярус (4 входных холодных патрубка Ду-850)
    const upperNozzleY = 3.15; // Верхний ярус (4 выходных горячих патрубка Ду-850)

    const buildNozzleProfile = () => {
      const pts = [
        new THREE.Vector2(0.425, 0.0),
        new THREE.Vector2(0.680, 0.0),
        new THREE.Vector2(0.585, 0.42),
        new THREE.Vector2(0.545, 0.65),
        new THREE.Vector2(0.545, 1.38),
        new THREE.Vector2(0.425, 1.38),
        new THREE.Vector2(0.425, 0.0)
      ];
      const geo = new THREE.LatheGeometry(pts, 36);
      geo.rotateZ(-Math.PI / 2);
      return geo;
    };
    const nozzleLatheGeo = buildNozzleProfile();

    loopAngles.forEach((angle) => {
      // Верхний ярус (горячая нитка) и нижний ярус (холодная нитка)
      [
        { y: upperNozzleY, angleOffset: -0.11 },
        { y: lowerNozzleY, angleOffset: 0.11 }
      ].forEach((tier) => {
        const na = angle + tier.angleOffset;
        const nozGroup = new THREE.Group();
        nozGroup.position.set(0, tier.y, 0);
        nozGroup.rotation.y = -na;

        const nozForging = new THREE.Mesh(nozzleLatheGeo, this.MATS.forgedNozzleSteel);
        nozForging.position.x = 2.28;
        nozGroup.add(nozForging);

        // Внутренняя нержавеющая гильза патрубка Ду-850
        const innerBore = new THREE.Mesh(
          new THREE.CylinderGeometry(0.422, 0.422, 1.36, 32, 1, true),
          this.MATS.austeniticSolid
        );
        innerBore.rotation.z = -Math.PI / 2;
        innerBore.position.x = 2.96;
        nozGroup.add(innerBore);

        vesselBodyGroup.add(nozGroup);
      });

      // Патрубки аварийного залива САОЗ между основными патрубками (см. чертеж В-392М)
      const saozNozGroup = new THREE.Group();
      saozNozGroup.position.set(0, 2.40, 0);
      saozNozGroup.rotation.y = -(angle + Math.PI * 0.25);
      const saozNozMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.31, 0.78, 24),
        this.MATS.forgedSteelSolid
      );
      saozNozMesh.rotation.z = -Math.PI / 2;
      saozNozMesh.position.x = 2.58;
      saozNozGroup.add(saozNozMesh);
      vesselBodyGroup.add(saozNozGroup);
    });

    // Главный разъем: 54 массивные шпильки М170 (диаметр 0.17 м -> радиус 0.085 м)
    // РЕАЛИЗОВАНО СТРОГО ЧЕРЕЗ THREE.InstancedMesh
    const studCount = 54;
    const studRadius = 0.085; // М170 = 0.17 м диаметр
    const studPitchCircleR = 2.465;
    const studGeo = new THREE.CylinderGeometry(studRadius, studRadius, 1.65, 16);
    const nutGeo = new THREE.CylinderGeometry(0.135, 0.135, 0.26, 6);

    const studsInstanced = new THREE.InstancedMesh(studGeo, this.MATS.forgedSteelSolid, studCount);
    const nutsInstanced = new THREE.InstancedMesh(nutGeo, this.MATS.austeniticSolid, studCount);

    for (let i = 0; i < studCount; i++) {
      const a = (i / studCount) * Math.PI * 2;
      const sx = Math.cos(a) * studPitchCircleR;
      const sz = Math.sin(a) * studPitchCircleR;

      dummy.position.set(sx, rpvFlangeTopY + 0.55, sz);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      studsInstanced.setMatrixAt(i, dummy.matrix);

      dummy.position.set(sx, rpvFlangeTopY + 1.05, sz);
      dummy.updateMatrix();
      nutsInstanced.setMatrixAt(i, dummy.matrix);
    }
    vesselBodyGroup.add(studsInstanced);
    vesselBodyGroup.add(nutsInstanced);

    this.registerComponent(vesselBodyGroup, 'rpv', new THREE.Vector3(0, 0, 0));
    this.tagInteractableHierarchy(vesselBodyGroup, 'rpv');

    // ========================================================================
    // 2. ВНУТРИКОРПУСНЫЕ УСТРОЙСТВА (ВКУ) И АКТИВНАЯ ЗОНА (163 ТВС-2М)
    // - Внутрикорпусная шахта: диаметр 4.112 м (r = 2.056 м), стенка 0.06 м (r_in = 1.996 м)
    // - Выгородка активной зоны: массивная гранная обечайка
    // - 163 шестигранные ТВС (высота 3.73 м, размер под ключ 0.234 м)
    // - Блок защитных труб (БЗТ) над зоной с направляющими каналами
    // - Мягкое Черенковское свечение (#00f0ff, MeshPhysicalMaterial с прозрачностью)
    // ========================================================================
    const coreGroup = new THREE.Group();
    coreGroup.name = 'ВКУ_и_Активная_зона_163_ТВС';
    rpvGroup.add(coreGroup);

    const barrelOuterR = 2.056; // Ø 4.112 м (кольцевой опускной зазор 60 мм внутри RPV r = 2.116 м)
    const barrelInnerR = 1.996; // толщина стенки шахты 0.060 м
    const barrelPoints = [
      new THREE.Vector2(0.65, -5.25),
      new THREE.Vector2(barrelOuterR, -4.45),
      new THREE.Vector2(barrelOuterR, 4.88),
      new THREE.Vector2(2.22, 4.88),
      new THREE.Vector2(2.22, 4.98),
      new THREE.Vector2(barrelInnerR, 4.98),
      new THREE.Vector2(barrelInnerR, -4.40),
      new THREE.Vector2(0.65, -5.19),
      new THREE.Vector2(0.65, -5.25)
    ];
    const coreBarrelGeo = new THREE.LatheGeometry(barrelPoints, 64);
    const coreBarrelMesh = new THREE.Mesh(coreBarrelGeo, this.MATS.austeniticStainless);
    coreGroup.add(coreBarrelMesh);

    // Массивная гранная обечайка выгородки активной зоны (высота 3.75 м)
    const coreCenterY = -2.10;
    const activeFuelHeight = 3.73; // Спецификация: 3.73 м
    const baffleShape = new THREE.Shape();
    const baffleOuterR = 1.975;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * baffleOuterR;
      const y = Math.sin(a) * baffleOuterR;
      if (i === 0) baffleShape.moveTo(x, y);
      else baffleShape.lineTo(x, y);
    }
    baffleShape.closePath();

    const baffleHole = new THREE.Path();
    const baffleInnerR = 1.74;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rMod = i % 2 === 0 ? baffleInnerR : baffleInnerR * 0.96;
      const x = Math.cos(a) * rMod;
      const y = Math.sin(a) * rMod;
      if (i === 0) baffleHole.moveTo(x, y);
      else baffleHole.lineTo(x, y);
    }
    baffleHole.closePath();
    baffleShape.holes.push(baffleHole);

    const baffleExtrudeGeo = new THREE.ExtrudeGeometry(baffleShape, {
      depth: activeFuelHeight,
      bevelEnabled: false
    });
    baffleExtrudeGeo.rotateX(Math.PI / 2);
    const baffleMesh = new THREE.Mesh(baffleExtrudeGeo, this.MATS.austeniticStainless);
    baffleMesh.position.y = coreCenterY + activeFuelHeight / 2;
    coreGroup.add(baffleMesh);

    // 163 шестигранные ТВС-2М (высота 3.73 м, размер под ключ 0.234 м -> радиус описанной окружности 0.1351 м)
    const tvsFlatToFlat = 0.234;
    const tvsCornerRadius = tvsFlatToFlat / Math.sqrt(3); // 0.1351 м
    const tvsCoords = this.generate163HexCoords(0.236);
    this.tvsCoords = tvsCoords;

    const tvsHexGeo = new THREE.CylinderGeometry(tvsCornerRadius * 0.97, tvsCornerRadius * 0.97, activeFuelHeight, 6);
    const tvsInstanced = new THREE.InstancedMesh(tvsHexGeo, this.MATS.fuelAssemblyZircaloy, 163);

    const tvsHeadGeo = new THREE.CylinderGeometry(0.095, 0.125, 0.34, 6);
    const tvsHeadsInstanced = new THREE.InstancedMesh(tvsHeadGeo, this.MATS.austeniticSolid, 163);

    const tempColor = new THREE.Color();
    tvsCoords.forEach((pt, idx) => {
      dummy.position.set(pt.x, coreCenterY, pt.z);
      dummy.rotation.set(0, Math.PI / 6, 0);
      dummy.updateMatrix();
      tvsInstanced.setMatrixAt(idx, dummy.matrix);

      const normR = Math.min(1, Math.sqrt(pt.distSq) / 1.65);
      tempColor.setHSL(0.055 + normR * 0.035, 0.92, 0.52 - normR * 0.14);
      tvsInstanced.setColorAt(idx, tempColor);

      dummy.position.set(pt.x, coreCenterY + activeFuelHeight / 2 + 0.18, pt.z);
      dummy.updateMatrix();
      tvsHeadsInstanced.setMatrixAt(idx, dummy.matrix);
    });
    if (tvsInstanced.instanceColor) tvsInstanced.instanceColor.needsUpdate = true;
    coreGroup.add(tvsInstanced);
    coreGroup.add(tvsHeadsInstanced);

    // Блок защитных труб (БЗТ) над активной зоной с направляющими каналами
    const bztGroup = new THREE.Group();
    bztGroup.name = 'Блок_защитных_труб_БЗТ';
    const bztBottomY = coreCenterY + activeFuelHeight / 2 + 0.36; // -0.055 м
    const bztTopY = 4.82;
    const bztHeight = bztTopY - bztBottomY;

    const bztOuterShell = new THREE.Mesh(
      new THREE.CylinderGeometry(1.88, 1.88, bztHeight, 48, 1, true),
      this.MATS.austeniticStainless
    );
    bztOuterShell.position.y = (bztBottomY + bztTopY) * 0.5;
    bztGroup.add(bztOuterShell);

    // Опорные перфорированные плиты БЗТ
    [bztBottomY + 0.12, (bztBottomY + bztTopY) * 0.5, bztTopY - 0.15].forEach((plateY) => {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(1.92, 1.92, 0.16, 48),
        this.MATS.austeniticSolid
      );
      plate.position.y = plateY;
      bztGroup.add(plate);
    });

    // Направляющие трубы БЗТ через THREE.InstancedMesh (121 канал)
    const guideTubeGeo = new THREE.CylinderGeometry(0.068, 0.068, bztHeight - 0.2, 10);
    const guideTubesInstanced = new THREE.InstancedMesh(guideTubeGeo, this.MATS.austeniticSolid, 121);
    for (let i = 0; i < 121; i++) {
      const pt = tvsCoords[i];
      dummy.position.set(pt.x, (bztBottomY + bztTopY) * 0.5, pt.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      guideTubesInstanced.setMatrixAt(i, dummy.matrix);
    }
    bztGroup.add(guideTubesInstanced);
    coreGroup.add(bztGroup);

    // Подвижные поглощающие штанги и кластеры ОР СУЗ
    this.controlRodsGroup = new THREE.Group();
    this.controlRodsGroup.name = 'Кластеры_ОР_СУЗ';
    const rodGeo = new THREE.CylinderGeometry(0.044, 0.044, 3.65, 8);
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.92,
      roughness: 0.18,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.42
    });
    const rodInstanced = new THREE.InstancedMesh(rodGeo, rodMat, 121);
    for (let i = 0; i < 121; i++) {
      const pt = tvsCoords[i];
      dummy.position.set(pt.x, 1.65, pt.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      rodInstanced.setMatrixAt(i, dummy.matrix);
    }
    this.controlRodsGroup.add(rodInstanced);
    coreGroup.add(this.controlRodsGroup);

    // Внутренний объем активной зоны: мягкое оптическое Черенковское свечение (#00f0ff, MeshPhysicalMaterial)
    const cherenkovVolumeGeo = new THREE.CylinderGeometry(1.72, 1.72, activeFuelHeight + 0.12, 48);
    this.cherenkovVolumeMesh = new THREE.Mesh(cherenkovVolumeGeo, this.MATS.cherenkovPhysical);
    this.cherenkovVolumeMesh.position.y = coreCenterY;
    this.cherenkovVolumeMesh.userData.ignoreRaycast = true;
    coreGroup.add(this.cherenkovVolumeMesh);

    this.registerComponent(coreGroup, 'core', new THREE.Vector3(0, 4.8, 0));
    this.tagInteractableHierarchy(coreGroup, 'core');

    // ========================================================================
    // 3. ВЕРХНИЙ БЛОК И 121 ПРИВОД СУЗ (ШЭМ-3)
    // - Сферическая штампованная крышка корпуса толщиной 0.21 м
    // - Высота сборки реактора с верхним блоком: 19.3 м (от Y = -6.185 м до Y = +13.115 м)
    // - Металлоконструкции шахты верхнего блока и защитный купол
    // - 121 привод СУЗ ШЭМ-3: ступенчатые колонки через THREE.InstancedMesh
    // ========================================================================
    const upperBlockGroup = new THREE.Group();
    upperBlockGroup.name = 'Верхний_блок_ШЭМ3';
    rpvGroup.add(upperBlockGroup);

    // Сферическая штампованная крышка толщиной 0.21 м с опорным фланцем Ø 5.405 м
    const headPoints = [];
    const headSteps = 22;
    const headOuterR = 2.38;
    const headThickness = 0.21; // Спецификация: 0.21 м
    const headApexY = 6.72;

    headPoints.push(new THREE.Vector2(maxFlangeRadius, rpvFlangeTopY));
    headPoints.push(new THREE.Vector2(maxFlangeRadius, rpvFlangeTopY + 0.62));
    headPoints.push(new THREE.Vector2(2.38, rpvFlangeTopY + 0.72));

    for (let i = 0; i <= headSteps; i++) {
      const t = (i / headSteps) * (Math.PI / 2);
      const r = Math.cos(t) * headOuterR;
      const y = (rpvFlangeTopY + 0.62) + Math.sin(t) * (headApexY - (rpvFlangeTopY + 0.62));
      headPoints.push(new THREE.Vector2(r, y));
    }

    for (let i = headSteps; i >= 0; i--) {
      const t = (i / headSteps) * (Math.PI / 2);
      const r = Math.cos(t) * (headOuterR - headThickness);
      const y = (rpvFlangeTopY + 0.62) + Math.sin(t) * (headApexY - headThickness - (rpvFlangeTopY + 0.62));
      headPoints.push(new THREE.Vector2(r, y));
    }
    headPoints.push(new THREE.Vector2(innerRadiusCore, rpvFlangeTopY));
    headPoints.push(new THREE.Vector2(maxFlangeRadius, rpvFlangeTopY));

    const closureHeadGeo = new THREE.LatheGeometry(headPoints, 64);
    closureHeadGeo.computeVertexNormals();
    const closureHeadMesh = new THREE.Mesh(closureHeadGeo, this.MATS.forgedNozzleSteel);
    upperBlockGroup.add(closureHeadMesh);

    // 121 привод СУЗ ШЭМ-3: ступенчатые колонки с чехлами и шаговыми электромагнитными механизмами
    // РЕАЛИЗОВАНО СТРОГО ЧЕРЕЗ THREE.InstancedMesh по гексагональной сетке
    const crdmCount = 121;
    // Нижний чехол с патрубком крышки
    const crdmNozzleGeo = new THREE.CylinderGeometry(0.088, 0.098, 2.35, 12);
    // Блок катушек шагового электромагнитного механизма ШЭМ-3
    const crdmCoilGeo = new THREE.CylinderGeometry(0.106, 0.106, 2.65, 12);
    // Верхний штанговый чехол с датчиком положения
    const crdmUpperTubeGeo = new THREE.CylinderGeometry(0.064, 0.074, 2.15, 10);

    const crdmNozzleInst = new THREE.InstancedMesh(crdmNozzleGeo, this.MATS.forgedSteelSolid, crdmCount);
    const crdmCoilInst = new THREE.InstancedMesh(crdmCoilGeo, this.MATS.motorBlue, crdmCount);
    const crdmUpperInst = new THREE.InstancedMesh(crdmUpperTubeGeo, this.MATS.austeniticSolid, crdmCount);

    for (let i = 0; i < crdmCount; i++) {
      const pt = tvsCoords[i];
      dummy.rotation.set(0, 0, 0);

      dummy.position.set(pt.x, 7.15, pt.z);
      dummy.updateMatrix();
      crdmNozzleInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pt.x, 9.45, pt.z);
      dummy.updateMatrix();
      crdmCoilInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pt.x, 11.55, pt.z);
      dummy.updateMatrix();
      crdmUpperInst.setMatrixAt(i, dummy.matrix);
    }
    upperBlockGroup.add(crdmNozzleInst);
    upperBlockGroup.add(crdmCoilInst);
    upperBlockGroup.add(crdmUpperInst);

    // Металлоконструкции шахты верхнего блока, траверсы, площадки обслуживания и защитный купол (до отм. +13.115 м)
    const lowerTraverse = new THREE.Mesh(
      new THREE.CylinderGeometry(2.28, 2.28, 0.42, 48, 1, true),
      this.MATS.forgedSteelSolid
    );
    lowerTraverse.position.y = 8.15;
    upperBlockGroup.add(lowerTraverse);

    const midPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(2.38, 2.38, 0.28, 48),
      this.MATS.forgedSteelSolid
    );
    midPlatform.position.y = 10.65;
    upperBlockGroup.add(midPlatform);

    // Перфорированная цилиндрическая обечайка шахты верхнего блока
    const upperShaftCage = new THREE.Mesh(
      new THREE.CylinderGeometry(2.34, 2.34, 3.85, 32, 4, true),
      this.MATS.containmentWire
    );
    upperShaftCage.position.y = 10.65;
    upperBlockGroup.add(upperShaftCage);

    // 12 несущих стоек металлоконструкции верхнего блока
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.085, 6.45, 10),
        this.MATS.forgedSteelSolid
      );
      col.position.set(Math.cos(a) * 2.18, 9.55, Math.sin(a) * 2.18);
      upperBlockGroup.add(col);
    }

    // Верхний защитный купол с радиальными ребрами и ограждением (верхняя точка Y = +13.115 м -> общая высота 19.300 м)
    const upperDomeCap = new THREE.Mesh(
      new THREE.ConeGeometry(2.36, 0.65, 36, 1, true),
      this.MATS.thermalInsulation
    );
    upperDomeCap.position.y = 12.45;
    upperBlockGroup.add(upperDomeCap);

    // Ограждение верхней площадки (до отм. Y = +13.115 м)
    const topHandrailRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.035, 10, 48),
      this.MATS.austeniticSolid
    );
    topHandrailRing.rotation.x = Math.PI / 2;
    topHandrailRing.position.y = 13.115;
    upperBlockGroup.add(topHandrailRing);

    const midHandrailRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.03, 10, 48),
      this.MATS.austeniticSolid
    );
    midHandrailRing.rotation.x = Math.PI / 2;
    midHandrailRing.position.y = 12.55;
    upperBlockGroup.add(midHandrailRing);

    this.registerComponent(upperBlockGroup, 'upper_block', new THREE.Vector3(0, 8.8, 0));
    this.tagInteractableHierarchy(upperBlockGroup, 'upper_block');

    // ========================================================================
    // 4. ПЕРВЫЙ КОНТУР (4 СИММЕТРИЧНЫЕ ПЕТЛИ):
    // - Трубопроводы ГЦК Ду-850 (наружный диаметр 1.09 м -> радиус 0.545 м)
    // - 4 горизонтальных парогенератора ПГВ-1000МКП (длина ~14 м, диаметр ~4 м)
    // - 4 главных циркуляционных насосных агрегата ГЦНА-1391
    // ========================================================================
    const loopsMasterGroup = new THREE.Group();
    loopsMasterGroup.name = 'PrimaryCircuit_4Loops';
    rootAssembly.add(loopsMasterGroup);

    const pipeOuterRadius = 0.545; // Наружный диаметр 1.090 м по спецификации

    const addWeldSeams = (curve, parentGroup, count = 4) => {
      const seamGeo = new THREE.TorusGeometry(pipeOuterRadius + 0.025, 0.04, 10, 28);
      for (let i = 1; i <= count; i++) {
        const u = i / (count + 1);
        const pos = curve.getPointAt(u);
        const tangent = curve.getTangentAt(u).normalize();
        const seam = new THREE.Mesh(seamGeo, this.MATS.forgedSteelSolid);
        seam.position.copy(pos);
        seam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
        parentGroup.add(seam);
      }
    };

    loopAngles.forEach((angle, loopIdx) => {
      const dirX = Math.cos(angle);
      const dirZ = Math.sin(angle);
      const perpX = -Math.sin(angle);
      const perpZ = Math.cos(angle);
      const radialExplode = new THREE.Vector3(dirX * 4.5, 0, dirZ * 4.5);

      // ----------------------------------------------------------------------
      // 4.1 Горизонтальный парогенератор ПГВ-1000МКП (длина ~14 м, диаметр ~4 м)
      // ----------------------------------------------------------------------
      const pgvGroup = new THREE.Group();
      pgvGroup.name = `ПГВ_1000МКП_Петля_${loopIdx + 1}`;
      loopsMasterGroup.add(pgvGroup);

      const pgvCenter = new THREE.Vector3(
        dirX * 11.4 + perpX * 1.4,
        3.45,
        dirZ * 11.4 + perpZ * 1.4
      );
      pgvGroup.position.copy(pgvCenter);
      pgvGroup.rotation.y = -angle;

      // Корпус ПГВ-1000МКП через THREE.LatheGeometry (общая длина 14.0 м, диаметр 4.08 м -> радиус 2.04 м)
      const pgvR = 2.04;
      const pgvCylHalf = 5.60; // цилиндрическая часть 11.2 м + 2 эллиптических днища по 1.4 м = 14.0 м ровно
      const pgvHeadDepth = 1.40;
      const pgvLathePts = [];
      const headSegs = 16;

      for (let i = 0; i <= headSegs; i++) {
        const t = (i / headSegs) * (Math.PI / 2);
        const r = Math.sin(t) * pgvR;
        const y = -pgvCylHalf - Math.cos(t) * pgvHeadDepth;
        pgvLathePts.push(new THREE.Vector2(r, y));
      }
      for (let i = 0; i <= headSegs; i++) {
        const t = (i / headSegs) * (Math.PI / 2);
        const r = Math.cos(t) * pgvR;
        const y = pgvCylHalf + Math.sin(t) * pgvHeadDepth;
        pgvLathePts.push(new THREE.Vector2(r, y));
      }

      const pgvShellGeo = new THREE.LatheGeometry(pgvLathePts, 56);
      pgvShellGeo.rotateX(Math.PI / 2); // Горизонтальная ориентация вдоль локальной оси Z
      const pgvShellMesh = new THREE.Mesh(pgvShellGeo, this.MATS.thermalInsulation);
      pgvGroup.add(pgvShellMesh);

      // Кованые бандажные кольца и люки-лазы на эллиптических днищах
      [-5.5, -1.8, 1.8, 5.5].forEach((zBand) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(pgvR + 0.03, 0.05, 12, 48),
          this.MATS.forgedSteelSolid
        );
        ring.position.z = zBand;
        pgvGroup.add(ring);
      });

      [-7.02, 7.02].forEach((zEnd) => {
        const manhole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.48, 0.54, 0.42, 24),
          this.MATS.forgedSteelSolid
        );
        manhole.rotation.x = Math.PI / 2;
        manhole.position.set(0, -0.25, zEnd);
        pgvGroup.add(manhole);
      });

      // Две роликовые седловые опоры ПГВ-1000МКП
      [-3.8, 3.8].forEach((zSup) => {
        const saddle = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 1.65, 0.72),
          this.MATS.forgedSteelSolid
        );
        saddle.position.set(0, -pgvR - 0.65, zSup);
        pgvGroup.add(saddle);
      });

      // Вертикальные коллекторы теплоносителя первого контура (горячий и холодный)
      const colOffsetZ = 1.65;
      [-colOffsetZ, colOffsetZ].forEach((zCol, cIdx) => {
        const collector = new THREE.Mesh(
          new THREE.CylinderGeometry(0.68, 0.68, 4.4, 32),
          this.MATS.forgedNozzleSteel
        );
        collector.position.set(0, -0.65, zCol);
        pgvGroup.add(collector);

        // Верхняя крышка коллектора на корпусе ПГВ
        const topHatch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.74, 0.78, 0.55, 24),
          this.MATS.forgedSteelSolid
        );
        topHatch.position.set(0, pgvR + 0.15, zCol);
        pgvGroup.add(topHatch);
      });

      // Паровые патрубки сверху и горизонтальный паровой коллектор (как на 3D-схеме)
      const steamHeader = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 10.4, 28),
        this.MATS.thermalInsulation
      );
      steamHeader.rotation.x = Math.PI / 2;
      steamHeader.position.set(0, pgvR + 1.35, 0);
      pgvGroup.add(steamHeader);

      for (let s = -4.2; s <= 4.2; s += 2.1) {
        const steamRiser = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.24, 1.38, 16),
          this.MATS.forgedSteelSolid
        );
        steamRiser.position.set(0, pgvR + 0.68, s);
        pgvGroup.add(steamRiser);
      }

      // Внутренний пучок U-образных теплообменных труб из аустенитной стали (виден в режиме X-Ray)
      const uBundleGroup = new THREE.Group();
      for (let layer = -3; layer <= 3; layer++) {
        const uTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 10.6, 16),
          this.MATS.uTubeBundle
        );
        uTube.rotation.x = Math.PI / 2;
        uTube.position.set(layer * 0.44, -0.25 + Math.abs(layer) * 0.11, 0);
        uBundleGroup.add(uTube);
      }
      pgvGroup.add(uBundleGroup);

      this.registerComponent(pgvGroup, 'pgv', radialExplode);
      this.tagInteractableHierarchy(pgvGroup, 'pgv');

      // ----------------------------------------------------------------------
      // 4.2 Главный циркуляционный насосный агрегат ГЦНА-1391
      // - Сферический гидрокорпус внизу (на отметке холодной нитки Y = 1.65 м)
      // - Промежуточный фонарь
      // - Массивный вертикальный цилиндрический электродвигатель сверху
      // ----------------------------------------------------------------------
      const gcnaGroup = new THREE.Group();
      gcnaGroup.name = `ГЦНА_1391_Петля_${loopIdx + 1}`;
      loopsMasterGroup.add(gcnaGroup);

      const gcnaPos = new THREE.Vector3(
        dirX * 9.8 - perpX * 4.85,
        1.65,
        dirZ * 9.8 - perpZ * 4.85
      );
      gcnaGroup.position.copy(gcnaPos);

      // Сферический гидрокорпус внизу
      const sphericalVolute = new THREE.Mesh(
        new THREE.SphereGeometry(1.42, 40, 32),
        this.MATS.forgedNozzleSteel
      );
      sphericalVolute.scale.set(1.0, 0.92, 1.0);
      gcnaGroup.add(sphericalVolute);

      const mainPumpFlange = new THREE.Mesh(
        new THREE.CylinderGeometry(1.38, 1.44, 0.38, 36),
        this.MATS.forgedSteelSolid
      );
      mainPumpFlange.position.y = 1.18;
      gcnaGroup.add(mainPumpFlange);

      // Промежуточный фонарь (стойка статора/уплотнения вала)
      const lanternStand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.98, 1.15, 1.75, 32),
        this.MATS.forgedSteelSolid
      );
      lanternStand.position.y = 2.15;
      gcnaGroup.add(lanternStand);

      // Массивный вертикальный цилиндрический электродвигатель сверху
      const motorBody = new THREE.Mesh(
        new THREE.CylinderGeometry(1.32, 1.32, 3.85, 40),
        this.MATS.motorBlue
      );
      motorBody.position.y = 4.85;
      gcnaGroup.add(motorBody);

      // Охлаждающие ребра и верхний маслобак электродвигателя
      for (let r = 0; r < 18; r++) {
        const ra = (r / 18) * Math.PI * 2;
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.09, 3.35, 0.26),
          this.MATS.austeniticSolid
        );
        rib.position.set(Math.cos(ra) * 1.36, 4.85, Math.sin(ra) * 1.36);
        rib.rotation.y = -ra;
        gcnaGroup.add(rib);
      }

      const motorTopCap = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.32, 0.62, 36),
        this.MATS.forgedSteelSolid
      );
      motorTopCap.position.y = 7.05;
      gcnaGroup.add(motorTopCap);

      // Вращающийся вал и рабочее колесо ГЦНА-1391 (останавливается при window.sim.isPaused === true)
      const impellerGroup = new THREE.Group();
      const shaftMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 5.2, 18),
        this.MATS.austeniticSolid
      );
      shaftMesh.position.y = 2.4;
      impellerGroup.add(shaftMesh);

      for (let b = 0; b < 7; b++) {
        const ba = (b / 7) * Math.PI * 2;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.44, 0.09),
          this.MATS.austeniticSolid
        );
        blade.position.set(Math.cos(ba) * 0.54, 0.0, Math.sin(ba) * 0.54);
        blade.rotation.y = -ba + 0.42;
        impellerGroup.add(blade);
      }
      gcnaGroup.add(impellerGroup);
      this.pumpImpellers.push({ group: impellerGroup, loopIndex: loopIdx });

      this.registerComponent(gcnaGroup, 'gcna', radialExplode.clone().multiplyScalar(1.15));
      this.tagInteractableHierarchy(gcnaGroup, 'gcna');

      // ----------------------------------------------------------------------
      // 4.3 Трубопроводы ГЦК Ду-850 (наружный диаметр 1.090 м -> r = 0.545 м)
      // Плавные радиусные гибы через THREE.TubeGeometry
      // ----------------------------------------------------------------------
      const pipesGroup = new THREE.Group();
      pipesGroup.name = `Трубопроводы_ГЦК_Петля_${loopIdx + 1}`;
      loopsMasterGroup.add(pipesGroup);

      // Горячая нитка: из верхнего яруса патрубков RPV (Y = 3.15 м) к горячему коллектору ПГВ
      const hotNozzleAngle = angle - 0.11;
      const hotStart = new THREE.Vector3(
        Math.cos(hotNozzleAngle) * 3.45,
        upperNozzleY,
        Math.sin(hotNozzleAngle) * 3.45
      );
      const hotCollectorPos = new THREE.Vector3(
        pgvCenter.x + perpX * colOffsetZ,
        pgvCenter.y - 2.65,
        pgvCenter.z + perpZ * colOffsetZ
      );
      const hotMid1 = new THREE.Vector3(
        dirX * 6.8 + perpX * 2.4,
        upperNozzleY,
        dirZ * 6.8 + perpZ * 2.4
      );
      const hotMid2 = new THREE.Vector3(
        hotCollectorPos.x - dirX * 1.1,
        0.55,
        hotCollectorPos.z - dirZ * 1.1
      );

      const hotCurve = new THREE.CatmullRomCurve3([
        hotStart,
        hotMid1,
        hotMid2,
        new THREE.Vector3(hotCollectorPos.x, 0.55, hotCollectorPos.z),
        hotCollectorPos
      ]);
      const hotTube = new THREE.Mesh(
        new THREE.TubeGeometry(hotCurve, 48, pipeOuterRadius, 28, false),
        this.MATS.hotPipeInsulation
      );
      pipesGroup.add(hotTube);
      addWeldSeams(hotCurve, pipesGroup, 4);
      this.createCoolantFlowStream(hotCurve, pipesGroup, true, loopIdx, pipeOuterRadius, 26);

      // Перепускная ("холодная" всасывающая) нитка с U-образным гидрозатвором от холодного коллектора ПГВ к входу ГЦНА-1391
      const coldCollectorPos = new THREE.Vector3(
        pgvCenter.x - perpX * colOffsetZ,
        pgvCenter.y - 2.65,
        pgvCenter.z - perpZ * colOffsetZ
      );
      const crossDip1 = new THREE.Vector3(
        coldCollectorPos.x,
        -0.45,
        coldCollectorPos.z
      );
      const crossDip2 = new THREE.Vector3(
        gcnaPos.x,
        -0.45,
        gcnaPos.z
      );
      const crossEnd = new THREE.Vector3(
        gcnaPos.x,
        gcnaPos.y - 0.95,
        gcnaPos.z
      );

      const crossCurve = new THREE.CatmullRomCurve3([
        coldCollectorPos,
        crossDip1,
        crossDip2,
        crossEnd
      ]);
      const crossTube = new THREE.Mesh(
        new THREE.TubeGeometry(crossCurve, 48, pipeOuterRadius, 28, false),
        this.MATS.coldPipeInsulation
      );
      pipesGroup.add(crossTube);
      addWeldSeams(crossCurve, pipesGroup, 4);
      this.createCoolantFlowStream(crossCurve, pipesGroup, false, loopIdx, pipeOuterRadius, 24);

      // Напорная холодная нитка от сферического корпуса ГЦНА-1391 в нижний ярус патрубков RPV (Y = 1.65 м)
      const coldNozzleAngle = angle + 0.11;
      const coldStart = new THREE.Vector3(
        gcnaPos.x - dirX * 1.15,
        lowerNozzleY,
        gcnaPos.z - dirZ * 1.15
      );
      const coldMid = new THREE.Vector3(
        dirX * 6.4 - perpX * 2.2,
        lowerNozzleY,
        dirZ * 6.4 - perpZ * 2.2
      );
      const coldEnd = new THREE.Vector3(
        Math.cos(coldNozzleAngle) * 3.45,
        lowerNozzleY,
        Math.sin(coldNozzleAngle) * 3.45
      );

      const coldCurve = new THREE.CatmullRomCurve3([coldStart, coldMid, coldEnd]);
      const coldTube = new THREE.Mesh(
        new THREE.TubeGeometry(coldCurve, 44, pipeOuterRadius, 28, false),
        this.MATS.coldPipeInsulation
      );
      pipesGroup.add(coldTube);
      addWeldSeams(coldCurve, pipesGroup, 3);
      this.createCoolantFlowStream(coldCurve, pipesGroup, false, loopIdx, pipeOuterRadius, 24);

      this.registerComponent(pipesGroup, 'loops', radialExplode.clone().multiplyScalar(0.65));
      this.tagInteractableHierarchy(pipesGroup, 'loops');
    });

    // ========================================================================
    // 4.4 КОМПЕНСАТОР ДАВЛЕНИЯ (КД, ОБЪЕМ 79 м³) НА ПЕТЛЕ №4 + ИПУ КД + БАРБОТЕР
    // ========================================================================
    const pressurizerGroup = new THREE.Group();
    pressurizerGroup.name = 'Компенсатор_давления_КД_79м3';
    rootAssembly.add(pressurizerGroup);

    const kdPos = new THREE.Vector3(-8.2, 8.2, 6.4);
    const kdVesselGroup = new THREE.Group();
    kdVesselGroup.position.copy(kdPos);
    pressurizerGroup.add(kdVesselGroup);

    // Цилиндрический корпус КД с эллиптическими днищами через LatheGeometry (объем 79 м³: Ø 3.0 м, высота ~12.8 м)
    const kdR = 1.50;
    const kdCylHalf = 5.10;
    const kdHeadH = 1.25;
    const kdLathePts = [];
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * (Math.PI / 2);
      kdLathePts.push(new THREE.Vector2(Math.sin(t) * kdR, -kdCylHalf - Math.cos(t) * kdHeadH));
    }
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * (Math.PI / 2);
      kdLathePts.push(new THREE.Vector2(Math.cos(t) * kdR, kdCylHalf + Math.sin(t) * kdHeadH));
    }
    const kdVesselMesh = new THREE.Mesh(
      new THREE.LatheGeometry(kdLathePts, 44),
      this.MATS.thermalInsulation
    );
    kdVesselGroup.add(kdVesselMesh);

    // Опорная юбка и блок ТЭН в нижней части КД
    const kdSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(1.32, 1.46, 1.65, 32),
      this.MATS.forgedSteelSolid
    );
    kdSkirt.position.y = -kdCylHalf - 1.25;
    kdVesselGroup.add(kdSkirt);

    // Внутренние трубчатые электронагреватели (ТЭНы) и уровни барботажа (видны в X-Ray)
    for (let h = 0; h < 7; h++) {
      const ha = (h / 7) * Math.PI * 2;
      const r = h === 0 ? 0 : 0.72;
      const heater = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 4.2, 12),
        this.MATS.uTubeBundle
      );
      heater.position.set(Math.cos(ha) * r, -2.2, Math.sin(ha) * r);
      kdVesselGroup.add(heater);
    }

    // Группа импульсно-предохранительных устройств (ИПУ КД) сверху
    for (let v = -1; v <= 1; v++) {
      const ipuValve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.32, 1.35, 16),
        this.MATS.motorBlue
      );
      ipuValve.position.set(v * 0.62, kdCylHalf + kdHeadH + 0.55, 0);
      kdVesselGroup.add(ipuValve);
    }

    // Горизонтальный бак-барботер (Relief tank, см. 3D-схему) и сбросной трубопровод от ИПУ КД
    const reliefTankPos = new THREE.Vector3(-4.2, 2.2, 8.8);
    const reliefTankMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 4.4, 28),
      this.MATS.austeniticSolid
    );
    reliefTankMesh.rotation.z = Math.PI / 2;
    reliefTankMesh.position.copy(reliefTankPos);
    pressurizerGroup.add(reliefTankMesh);

    const ipuDischargeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(kdPos.x, kdPos.y + kdCylHalf + kdHeadH + 0.9, kdPos.z),
      new THREE.Vector3(kdPos.x + 1.8, kdPos.y + kdCylHalf + 0.5, kdPos.z + 1.6),
      new THREE.Vector3(reliefTankPos.x, reliefTankPos.y + 0.85, reliefTankPos.z)
    ]);
    const ipuDischargePipe = new THREE.Mesh(
      new THREE.TubeGeometry(ipuDischargeCurve, 32, 0.14, 14, false),
      this.MATS.austeniticSolid
    );
    pressurizerGroup.add(ipuDischargePipe);

    // Дыхательный трубопровод Ду-350 от днища КД к горячей нитке петли №4
    const surgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(kdPos.x, kdPos.y - kdCylHalf - kdHeadH, kdPos.z),
      new THREE.Vector3(kdPos.x + 1.2, 2.2, kdPos.z - 1.1),
      new THREE.Vector3(-5.8, 2.4, 3.6),
      new THREE.Vector3(-3.8, upperNozzleY, 2.9)
    ]);
    const surgeTube = new THREE.Mesh(
      new THREE.TubeGeometry(surgeCurve, 36, 0.24, 18, false),
      this.MATS.hotPipeInsulation
    );
    pressurizerGroup.add(surgeTube);
    this.createCoolantFlowStream(surgeCurve, pressurizerGroup, true, 1, 0.24, 14);

    // Трубопровод впрыска из холодной нитки в верхнюю паровую подушку КД
    const sprayCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.2, lowerNozzleY, 4.8),
      new THREE.Vector3(-8.8, 4.5, 7.6),
      new THREE.Vector3(kdPos.x - 0.6, kdPos.y + kdCylHalf + 0.4, kdPos.z + 0.8),
      new THREE.Vector3(kdPos.x, kdPos.y + kdCylHalf + kdHeadH * 0.8, kdPos.z)
    ]);
    const sprayTube = new THREE.Mesh(
      new THREE.TubeGeometry(sprayCurve, 36, 0.12, 12, false),
      this.MATS.coldPipeInsulation
    );
    pressurizerGroup.add(sprayTube);

    this.registerComponent(pressurizerGroup, 'pressurizer', new THREE.Vector3(-3.8, 3.2, 3.0));
    this.tagInteractableHierarchy(pressurizerGroup, 'pressurizer');

    // ========================================================================
    // 4.5 ЧЕТЫРЕ ГИДРОЕМКОСТИ САОЗ (ВЕРТИКАЛЬНЫЕ ТОЛСТОСТЕННЫЕ БАКИ ГЕ-1)
    // ========================================================================
    const saozGroup = new THREE.Group();
    saozGroup.name = 'Гидроемкости_САОЗ_4шт';
    rootAssembly.add(saozGroup);

    const saozPositions = [
      { pos: new THREE.Vector3(-11.2, 5.2, -8.8), nozAngle: Math.PI * 1.0 },
      { pos: new THREE.Vector3(-8.8, 5.2, -11.2), nozAngle: Math.PI * 1.5 },
      { pos: new THREE.Vector3(11.2, 5.2, 8.8), nozAngle: 0.0 },
      { pos: new THREE.Vector3(8.8, 5.2, 11.2), nozAngle: Math.PI * 0.5 }
    ];

    saozPositions.forEach((cfg) => {
      const tankUnit = new THREE.Group();
      tankUnit.position.copy(cfg.pos);

      const tR = 1.35;
      const tCylHalf = 3.45;
      const tHeadH = 1.05;
      const tPts = [];
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * (Math.PI / 2);
        tPts.push(new THREE.Vector2(Math.sin(t) * tR, -tCylHalf - Math.cos(t) * tHeadH));
      }
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * (Math.PI / 2);
        tPts.push(new THREE.Vector2(Math.cos(t) * tR, tCylHalf + Math.sin(t) * tHeadH));
      }
      const tankMesh = new THREE.Mesh(
        new THREE.LatheGeometry(tPts, 36),
        this.MATS.saozTankSteel
      );
      tankUnit.add(tankMesh);

      const idBand = new THREE.Mesh(
        new THREE.CylinderGeometry(tR + 0.02, tR + 0.02, 0.52, 36),
        this.MATS.saozBandBlue
      );
      idBand.position.y = 0.85;
      tankUnit.add(idBand);

      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18, 1.32, 1.65, 28),
        this.MATS.forgedSteelSolid
      );
      skirt.position.y = -tCylHalf - 1.15;
      tankUnit.add(skirt);
      saozGroup.add(tankUnit);

      // Линия пассивного залива САОЗ от гидроемкости к патрубку корпуса реактора (Y = 2.40 м)
      const saozPipeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(cfg.pos.x, cfg.pos.y - tCylHalf - tHeadH, cfg.pos.z),
        new THREE.Vector3(cfg.pos.x * 0.62, 2.40, cfg.pos.z * 0.62),
        new THREE.Vector3(Math.cos(cfg.nozAngle) * 2.68, 2.40, Math.sin(cfg.nozAngle) * 2.68)
      ]);
      const saozPipe = new THREE.Mesh(
        new THREE.TubeGeometry(saozPipeCurve, 32, 0.18, 14, false),
        this.MATS.coldPipeInsulation
      );
      saozGroup.add(saozPipe);
    });

    this.registerComponent(saozGroup, 'saoz', new THREE.Vector3(0, 3.5, 0));
    this.tagInteractableHierarchy(saozGroup, 'saoz');

    // ========================================================================
    // 4.6 КОНИЧЕСКАЯ ФЕРМА-ЛОВУШКА РАСПЛАВА (CORE CATCHER / УЛР) ПОД ДНИЩЕМ
    // ========================================================================
    const coriumGroup = new THREE.Group();
    coriumGroup.name = 'Устройство_локализации_расплава_УЛР';
    rootAssembly.add(coriumGroup);

    const ulrTopY = -6.55;
    // Направляющая коническая воронка под днищем реактора
    const guideFunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.75, 1.45, 1.65, 48, 1, true),
      this.MATS.coriumSteel
    );
    guideFunnel.position.y = ulrTopY - 0.65;
    coriumGroup.add(guideFunnel);

    // Конический водоохлаждаемый корпус тигля УЛР
    const catcherCrucible = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 1.75, 3.15, 48),
      this.MATS.coriumSteel
    );
    catcherCrucible.position.y = ulrTopY - 2.85;
    coriumGroup.add(catcherCrucible);

    // Блок кассет жертвенного материала внутри ловушки расплава
    const sacrificialMass = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 1.55, 2.15, 32),
      this.MATS.coriumSacrificial
    );
    sacrificialMass.position.y = ulrTopY - 2.65;
    coriumGroup.add(sacrificialMass);

    // Коническая опорная ферма-ловушка (16 радиальных консольных балок)
    for (let t = 0; t < 16; t++) {
      const ta = (t / 16) * Math.PI * 2;
      const trussBeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 3.25, 0.78),
        this.MATS.forgedSteelSolid
      );
      trussBeam.position.set(Math.cos(ta) * 2.52, ulrTopY - 2.65, Math.sin(ta) * 2.52);
      trussBeam.rotation.y = -ta;
      trussBeam.rotation.x = 0.16;
      coriumGroup.add(trussBeam);
    }

    const foundationPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(3.85, 3.95, 0.48, 56),
      this.MATS.forgedSteelSolid
    );
    foundationPlate.position.y = -11.05;
    coriumGroup.add(foundationPlate);

    this.registerComponent(coriumGroup, 'corium_catcher', new THREE.Vector3(0, -3.2, 0));
    this.tagInteractableHierarchy(coriumGroup, 'corium_catcher');

    // ========================================================================
    // 4.7 ЗАЩИТНАЯ ГЕРМООБОЛОЧКА, ПОЛЯРНЫЙ КРАН И ТЕПЛООБМЕННИКИ СПОТ
    // ========================================================================
    const containmentGroup = new THREE.Group();
    containmentGroup.name = 'Гермооболочка_и_СПОТ';
    rootAssembly.add(containmentGroup);

    const contR = 18.5;
    const contH = 26.0;

    const contShellGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(contR, contR, contH, 56, 1, true),
      this.MATS.containmentGlass
    );
    contShellGlass.position.y = 2.0;
    contShellGlass.userData.ignoreRaycast = true;
    containmentGroup.add(contShellGlass);

    const contShellWire = new THREE.Mesh(
      new THREE.CylinderGeometry(contR + 0.04, contR + 0.04, contH, 36, 6, true),
      this.MATS.containmentWire
    );
    contShellWire.position.y = 2.0;
    contShellWire.userData.ignoreRaycast = true;
    containmentGroup.add(contShellWire);

    const polarCraneRail = new THREE.Mesh(
      new THREE.TorusGeometry(contR - 0.35, 0.22, 16, 96),
      this.MATS.forgedSteelSolid
    );
    polarCraneRail.rotation.x = Math.PI / 2;
    polarCraneRail.position.y = 14.2;
    containmentGroup.add(polarCraneRail);

    for (let sp = 0; sp < 4; sp++) {
      const spa = (sp / 4) * Math.PI * 2 + Math.PI * 0.25;
      const spotUnit = new THREE.Group();
      spotUnit.position.set(Math.cos(spa) * (contR - 1.35), 13.0, Math.sin(spa) * (contR - 1.35));
      spotUnit.rotation.y = -spa;

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 2.8, 3.6),
        this.MATS.forgedSteelSolid
      );
      spotUnit.add(frame);

      for (let tubeIdx = -3; tubeIdx <= 3; tubeIdx++) {
        const finTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 2.4, 12),
          this.MATS.saozBandBlue
        );
        finTube.position.set(0.28, 0, tubeIdx * 0.44);
        spotUnit.add(finTube);
      }
      containmentGroup.add(spotUnit);
    }

    this.registerComponent(containmentGroup, 'containment', new THREE.Vector3(0, 3.8, 0));
    this.tagInteractableHierarchy(containmentGroup, 'containment');
  },

  buildCalloutPins() {
    if (!this.labelsLayer) return;
    this.labelsLayer.innerHTML = '';
    this.pinElements = [];

    Object.entries(VVER_SPECS).forEach(([id, data]) => {
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
      const hits = this.raycaster.intersectObjects(this.interactableMeshes, false);

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
          this.applyComponentHighlight();
          return;
        }
      }

      if (this.state.hoveredId !== null) {
        this.state.hoveredId = null;
        this.canvas.style.cursor = 'grab';
        if (this.hoverTooltip) this.hoverTooltip.classList.remove('visible');
        this.applyComponentHighlight();
      }
    };

    this._boundPointerUp = (e) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      const rect = this.canvas.getBoundingClientRect();
      this.mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const hits = this.raycaster.intersectObjects(this.interactableMeshes, false);
      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId;
        if (compId) {
          this.selectComponent(compId, true);
          this.applyComponentHighlight();
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
      const offset = this.state.exploded ? 1.25 : 1.0;
      this.state.camTargetLook.copy(info.labelPos).multiplyScalar(0.55);
      this.state.camTargetPos.copy(info.camOffset).multiplyScalar(offset);
      this.state.camAnimating = true;
    }
  },

  focusOnNode(nodeId) {
    this.selectComponent(nodeId, true);
    this.applyComponentHighlight();
  },

  applyComponentHighlight() {
    Object.entries(this.componentGroups).forEach(([compId, groups]) => {
      const isHovered = this.state.hoveredId === compId;
      const isSelected = this.state.selectedId === compId;
      groups.forEach((grp) => {
        grp.traverse((child) => {
          if (child.isMesh && child.material && child.material.emissive && !child.userData.ignoreRaycast) {
            if (
              child.material === this.MATS.uTubeBundle ||
              child.material === this.MATS.coriumSacrificial ||
              child.material === this.MATS.fuelAssemblyZircaloy
            ) {
              return;
            }
            if (isHovered) {
              child.material.emissiveIntensity = 0.32;
            } else if (isSelected) {
              child.material.emissiveIntensity = 0.12;
            } else {
              child.material.emissiveIntensity =
                child.material === this.MATS.hotPipeInsulation ? 0.05 :
                child.material === this.MATS.coldPipeInsulation ? 0.04 : 0.0;
            }
          }
        });
      });
    });
  },

  setOverviewMode() {
    this.state.xray = false;
    this.state.exploded = false;
    const btnXray = document.getElementById('btn-view-xray');
    const btnExploded = document.getElementById('btn-view-exploded');
    const btnOverview = document.getElementById('btn-view-overview');
    if (btnXray) btnXray.classList.remove('active');
    if (btnExploded) btnExploded.classList.remove('active');
    if (btnOverview) btnOverview.classList.add('active');

    this.state.camTargetPos.set(24.0, 14.5, 25.0);
    this.state.camTargetLook.set(0, 2.0, 0);
    this.state.camAnimating = true;
    this.selectComponent('rpv', false);
    if (typeof sound !== 'undefined' && sound.click) sound.click(580);
  },

  toggleXray() {
    this.state.xray = !this.state.xray;
    const btnXray = document.getElementById('btn-view-xray');
    const btnOverview = document.getElementById('btn-view-overview');
    if (btnXray) btnXray.classList.toggle('active', this.state.xray);
    if (btnOverview) btnOverview.classList.toggle('active', !this.state.xray && !this.state.exploded);
    if (this.state.xray) {
      this.selectComponent('core', false);
    }
    if (typeof sound !== 'undefined' && sound.click) sound.click(540);
  },

  toggleExploded() {
    this.state.exploded = !this.state.exploded;
    const btnExploded = document.getElementById('btn-view-exploded');
    const btnOverview = document.getElementById('btn-view-overview');
    if (btnExploded) btnExploded.classList.toggle('active', this.state.exploded);
    if (btnOverview) btnOverview.classList.toggle('active', !this.state.xray && !this.state.exploded);
    if (this.state.exploded) {
      this.state.camTargetPos.set(30.0, 18.5, 30.0);
      this.state.camTargetLook.set(0, 2.5, 0);
      this.state.camAnimating = true;
    } else {
      this.state.camTargetPos.set(24.0, 14.5, 25.0);
      this.state.camTargetLook.set(0, 2.0, 0);
      this.state.camAnimating = true;
    }
    if (typeof sound !== 'undefined' && sound.click) sound.click(560);
  },

  toggleFlow(btn) {
    this.state.flowActive = !this.state.flowActive;
    if (btn) btn.classList.toggle('active', this.state.flowActive);
    this.flowSystems.forEach((sys) => {
      sys.pointsObj.visible = this.state.flowActive;
      sys.streamMesh.visible = this.state.flowActive;
    });
    if (typeof sound !== 'undefined' && sound.click) sound.click(520);
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
      this.state.camTargetPos.set(24.0, 14.5, 25.0);
      this.state.camTargetLook.set(0, 2.0, 0);
    } else if (preset === 'vessel' || preset === 'core') {
      this.state.camTargetPos.set(9.0, 2.5, 9.0);
      this.state.camTargetLook.set(0, 0.0, 0);
      this.state.xray = true;
      const btnXray = document.getElementById('btn-view-xray');
      if (btnXray) btnXray.classList.add('active');
    } else if (preset === 'top') {
      this.state.camTargetPos.set(0.01, 38.0, 0.01);
      this.state.camTargetLook.set(0, 0, 0);
    } else if (preset === 'ulr') {
      this.state.camTargetPos.set(11.5, -6.5, 11.5);
      this.state.camTargetLook.set(0, -8.5, 0);
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
    const pct = Math.round((34.0 / Math.max(1, dist)) * 100);
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

  // Вычисление нормированной мощности реактора из window.sim.reactorPower
  _getNormalizedReactorPower() {
    const s = window.sim;
    if (!s) return 1.0;
    if (typeof s.reactorPower === 'number') {
      if (s.reactorPower > 150) return Math.max(0.0, Math.min(1.35, s.reactorPower / 3200.0));
      if (s.reactorPower > 1.5) return Math.max(0.0, Math.min(1.35, s.reactorPower / 100.0));
      return Math.max(0.0, Math.min(1.35, s.reactorPower));
    }
    if (typeof s.thermalPowerMW === 'number') {
      return Math.max(0.0, Math.min(1.35, s.thermalPowerMW / 3200.0));
    }
    return 1.0;
  },

  // Вычисление коэффициента расхода конкретной петли из sim.loopFlow / sim.loops
  _getLoopFlowFactor(loopIdx) {
    const s = window.sim;
    if (!s) return 1.0;
    if (Array.isArray(s.loopFlow) && typeof s.loopFlow[loopIdx] === 'number') {
      const val = s.loopFlow[loopIdx];
      return val > 2.0 ? val / 100.0 : Math.max(0, val);
    }
    if (typeof s.loopFlow === 'number') {
      return s.loopFlow > 2.0 ? s.loopFlow / 100.0 : Math.max(0, s.loopFlow);
    }
    if (Array.isArray(s.loops) && s.loops[loopIdx] && typeof s.loops[loopIdx].flowPct === 'number') {
      return Math.max(0, s.loops[loopIdx].flowPct / 100.0);
    }
    return 1.0;
  },

  // ==========================================================================
  // 6. ФИЗИЧЕСКАЯ СИНХРОНИЗАЦИЯ И ОБНОВЛЕНИЕ КАДРА (60 FPS)
  // ==========================================================================
  render(dtReal = 0.016) {
    if (!this.initialized || this.contextLost) return;
    const dt = Math.min(dtReal, 0.05);

    // Строгая проверка паузы симуляции:
    // Анимация вращения валов ГЦНА и движения теплоносителя ПОЛНОСТЬЮ останавливается при isPaused === true
    const isPaused = Boolean(window.sim && window.sim.isPaused) === true;
    const timeSpeed = (window.sim && typeof window.sim.timeSpeed === 'number')
      ? Math.max(0, window.sim.timeSpeed)
      : 1.0;
    const simDt = isPaused ? 0.0 : dt * timeSpeed;

    this.elapsed += simDt;

    // 1. Плавная интерполяция режима разреза (X-Ray)
    const targetXray = this.state.xray ? 1.0 : 0.0;
    this.state.xrayFactor += (targetXray - this.state.xrayFactor) * Math.min(1, dt * 7.5);

    this.xrayMaterials.forEach((mat) => {
      const op = THREE.MathUtils.lerp(mat.userData.solidOpacity, mat.userData.xrayOpacity, this.state.xrayFactor);
      mat.opacity = op;
      mat.transparent = op < 0.99;
      mat.depthWrite = op > 0.65;
    });

    // 2. Плавная интерполяция взрыв-схемы (Exploded View)
    const targetExplode = this.state.exploded ? 1.0 : 0.0;
    this.state.explodeFactor += (targetExplode - this.state.explodeFactor) * Math.min(1, dt * 6.0);

    this.explodedParts.forEach((grp) => {
      grp.position.lerpVectors(
        grp.userData.basePos,
        grp.userData.basePos.clone().add(grp.userData.explodeOffset),
        this.state.explodeFactor
      );
    });

    // 3. Динамическая эмиссия Черенковского свечения (#00f0ff), завязанная на window.sim.reactorPower
    const pwr = this._getNormalizedReactorPower();
    const harmonic = 0.92 + Math.sin(this.elapsed * 3.0) * 0.08;
    if (this.MATS.cherenkovPhysical) {
      const baseOpacity = (0.12 + 0.36 * pwr) * harmonic;
      this.MATS.cherenkovPhysical.opacity = this.state.xray ? Math.min(0.68, baseOpacity + 0.16) : baseOpacity;
      this.MATS.cherenkovPhysical.emissiveIntensity = (0.35 + 1.65 * pwr) * harmonic;
    }
    if (this.cherenkovPointLight) {
      this.cherenkovPointLight.intensity = (0.4 + 3.8 * pwr) * harmonic;
    }
    if (this.coreWarmLight) {
      this.coreWarmLight.intensity = 0.25 + 1.85 * pwr;
    }

    // Положение кластеров ОР СУЗ
    if (this.controlRodsGroup) {
      const s = window.sim;
      if (s && typeof s.group10Pos === 'number') {
        const rodY = -1.6 + (s.group10Pos / 100.0) * 2.4;
        this.controlRodsGroup.position.y = rodY;
      } else if (!isPaused) {
        this.controlRodsGroup.position.y = Math.sin(this.elapsed * 1.2) * 0.35;
      }
    }

    // 4. Вращение валов и рабочих колес ГЦНА-1391 (строго останавливается при isPaused === true)
    if (!isPaused && simDt > 0) {
      this.pumpImpellers.forEach((imp) => {
        const flowScale = this._getLoopFlowFactor(imp.loopIndex);
        const s = window.sim;
        const rpmScale = (s && Array.isArray(s.loops) && s.loops[imp.loopIndex] && typeof s.loops[imp.loopIndex].rpm === 'number')
          ? (s.loops[imp.loopIndex].rpm / 1000.0)
          : flowScale;
        imp.group.rotation.y += simDt * 10.5 * rpmScale;
      });
    }

    // 5. Движение потоков теплоносителя (мягкие импульсы частиц + смещение UV-координат текстуры)
    if (this.state.flowActive && !isPaused && simDt > 0) {
      // Смещение UV-координат текстуры потока
      this.flowTextures.forEach((ft) => {
        const flowScale = this._getLoopFlowFactor(ft.loopIndex);
        ft.texture.offset.x = (ft.texture.offset.x - simDt * ft.speed * flowScale) % 1.0;
      });

      // Движение мягких световых импульсов полупрозрачных частиц внутри труб
      this.flowSystems.forEach((sys) => {
        const flowScale = this._getLoopFlowFactor(sys.loopIndex);
        if (flowScale <= 0.0001) return;

        const posAttr = sys.pointsObj.geometry.attributes.position;
        const arr = posAttr.array;
        const count = sys.phases.length;

        for (let i = 0; i < count; i++) {
          sys.phases[i] = (sys.phases[i] + simDt * sys.speed * flowScale) % 1.0;
          const pt = sys.curve.getPointAt(sys.phases[i]);
          const ro = sys.radialOffsets[i];
          arr[i * 3] = pt.x + ro.x;
          arr[i * 3 + 1] = pt.y + ro.y;
          arr[i * 3 + 2] = pt.z + ro.z;
        }
        posAttr.needsUpdate = true;
      });
    }

    // 6. Плавный перелет камеры к выбранному узлу
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
      this.controls.update(dt);
    }

    this.renderer.render(this.scene, this.camera);

    // 7. Проекция 3D-выносок в экранные координаты
    if (this.state.labelsVisible && this.labelsLayer) {
      const container = document.getElementById('threeContainer');
      const w = container ? container.clientWidth : 1000;
      const h = container ? container.clientHeight : 650;

      this.pinElements.forEach((pin) => {
        this.projectedVec.copy(pin.baseWorldPos);
        const grpList = this.componentGroups[pin.id];
        if (grpList && grpList.length > 0) {
          const offset = grpList[0].userData.explodeOffset;
          this.projectedVec.addScaledVector(offset, this.state.explodeFactor);
        }

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
    this.flowSystems = [];
    this.flowTextures = [];
    this.pumpImpellers = [];
    this.pinElements = [];
    this.initialized = false;
  },

  // Поддержка лучевого хит-тестинга («Простыми словами» / checkRaycaster)
  checkRaycaster(mx, my, rect) {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.interactiveMeshes, false);
    if (hits.length > 0 && hits[0].object.userData.tooltipInfo) {
      const info = hits[0].object.userData.tooltipInfo;
      this.hoveredMesh = hits[0].object;
      if (typeof populateTooltipDOM === 'function') {
        populateTooltipDOM(info, mx, my, rect);
      }
    } else {
      this.hoveredMesh = null;
      if (typeof tooltipEl !== 'undefined' && tooltipEl) {
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

// Явная фиксация экспорта в глобальный объект window
window.VVEROrbitControls = VVEROrbitControls;
window.VVER_SPECS = VVER_SPECS;
window.threeCtrl = threeCtrl;