// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (проект В-491, ЛАЭС-2)
// view_3d.js — Модуль 3D WebGL / Three.js PBR визуализации (threeCtrl)
// Модель реактора: GLB-ассет vver1200_rpv.glb (docs/blender/vver1200_reactor_v491.py, размеры по [ПР]: высота в сборе 19,41 м, корпус 11,185 м, фланец Ø4,585 м)
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
// Геометрия модели: высота в сборе 19,41 м (корпус 11,185 + верхний блок 8,225), начало координат — низ днища
// ============================================================================
const VVER_SPECS = {
  rpv: {
    tag: 'РЕАКТОРНАЯ УСТАНОВКА В-491',
    title: 'Корпус реактора ВВЭР-1200',
    desc: 'Вертикальный цилиндрический сосуд из стали 15Х2НМФА с внутренней антикоррозионной наплавкой: фланец, две обечайки зоны патрубков, опорная обечайка, две цилиндрические обечайки и эллиптическое днище. Рабочее давление 16,2 МПа, расчётные 17,64 МПа и 350 °C.',
    specs: [
      ['Высота корпуса', '11,185 м'],
      ['Ø внутр. / наруж. (зона АЗ)', '4,250 / 4,645 м'],
      ['Ø фланца', '4,585 м'],
      ['Стенка + наплавка', '197,5 + 9 мм']
    ],
    camOffset: [15.0, 9.0, 17.0],
    labelPos: [0, 1.4, 2.25],
    hot: false
  },
  upper_block: {
    tag: 'СИСТЕМА УПРАВЛЕНИЯ И ЗАЩИТЫ',
    title: 'Верхний блок и 121 привод ШЭМ-3',
    desc: 'Эллиптическая крышка толщиной 320 мм с 121 патрубком СУЗ и 18 патрубками ВРК, металлоконструкция на шести штангах, воздушный коллектор охлаждения приводов и траверса. На патрубках СУЗ — шаговые электромагнитные приводы ШЭМ-3.',
    specs: [
      ['Приводы СУЗ', '121 ШЭМ-3'],
      ['Патрубки ВРК', '18'],
      ['Падение ОР СУЗ при АЗ', '1,2–4,0 с'],
      ['Высота / масса', '8,22 м / 137 т']
    ],
    camOffset: [11.0, 19.0, 13.0],
    labelPos: [0, 17.6, 1.95],
    hot: true
  },
  flange: {
    tag: 'ГЕРМЕТИЧНЫЙ ФЛАНЕЦ КОРПУСА',
    title: 'Главный разъем и 54 шпильки М170',
    desc: 'Разъём корпуса и крышки реактора. Уплотняется двумя прутковыми прокладками в кольцевых канавках фланца; плотность контролируется по давлению в полости между прокладками.',
    specs: [
      ['Шпильки разъёма', '54 × М170×6'],
      ['Ø фланца корпуса / крышки', '4,585 / 4,580 м'],
      ['Уплотнение', '2 прутковые прокладки'],
      ['Контроль', 'протечки межпрокладочной полости']
    ],
    camOffset: [8.5, 13.0, 9.5],
    labelPos: [0, 12.15, 2.07],
    hot: false
  },
  nozzles: {
    tag: 'ПЕРВЫЙ КОНТУР ТЕПЛОНОСИТЕЛЯ',
    title: 'Патрубки Ду-850 ГЦТ',
    desc: 'Двухъярусная зона врезки 8 патрубков главного циркуляционного трубопровода (4 горячие нитки DN850 верхнего яруса и 4 холодные нитки DN850 нижнего яруса).',
    specs: [
      ['Количество патрубков', '8 шт. (4 гор. + 4 хол.)'],
      ['Внутренний диаметр', 'Ду-850 (850 мм)'],
      ['Расход через реактор', '88 000 м³/ч'],
      ['Размер по патрубкам', '5,260 м']
    ],
    camOffset: [10.0, 10.5, 9.0],
    labelPos: [2.46, 7.535, 0.92], // холодный патрубок ГЦНА-2 (−20°30′)
    hot: true
  },
  barrel: {
    tag: 'ВНУТРИКОРПУСНЫЕ УСТРОЙСТВА',
    title: 'Шахта реактора (ВКУ)',
    desc: 'Шахта внутрикорпусная из стали 08Х18Н10Т разделяет опускной поток теплоносителя (кольцевой зазор между корпусом и шахтой) и подъёмный поток через активную зону. Несёт вес ТВС, выгородки и БЗТ; перфорированное днище с опорами фиксирует хвостовики 163 ТВС и выравнивает поток на входе в зону.',
    specs: [
      ['Материал', '08Х18Н10Т'],
      ['Опоры ТВС', '163, шаг 236 мм'],
      ['Опирание', 'бурт фланца корпуса'],
      ['Высота / масса', '10,87 м / 76 т']
    ],
    camOffset: [10.0, 8.0, 12.0],
    labelPos: [0, 3.3, 1.75],
    hot: false,
    internal: true
  },
  shroud: {
    tag: 'ВЫГОРОДКА И АКТИВНАЯ ЗОНА',
    title: 'Выгородка и 163 ТВС-2М',
    desc: 'Выгородка из четырёх колец стали 08Х18Н10Т повторяет контур 163 ТВС (зазор 4 мм) и перекрывает всю высоту активной зоны. Вместе с теплоносителем и шахтой снижает поток и флюенс быстрых нейтронов на корпус и уменьшает протечки мимо зоны.',
    specs: [
      ['Высота / масса', '4,45 м / 38 т'],
      ['Материал', '08Х18Н10Т, 4 кольца'],
      ['ТВС', '163 ТВС-2М'],
      ['Высота АЗ (топливо)', 'H = 3,73 м']
    ],
    camOffset: [8.5, 7.5, 9.5],
    labelPos: [0, 5.2, 1.64],
    hot: true,
    internal: true
  },
  core: {
    tag: 'АКТИВНАЯ ЗОНА ВВЭР-1200',
    title: 'Активная зона: 163 ТВС-2М',
    desc: 'Монолитный массив 163 бесчехловых ТВС-2М. Циркониевые твэлы сплава Э110, топливо — таблетки UO2 с профилированным обогащением до 4,95% по U-235.',
    specs: [
      ['Количество ТВС', '163 шт. ТВС-2М'],
      ['Количество твэлов', '312 шт. в каждой ТВС'],
      ['Материал оболочек', 'Сплав циркония Э110'],
      ['Высота ТВС / топлива', '4,570 / 3,730 м']
    ],
    camOffset: [8.0, 7.0, 9.0],
    labelPos: [0, 7.0, 1.0],
    hot: true,
    showPin: false
  },
  bzt: {
    tag: 'ВЕРХНИЕ ВКУ И СУЗ',
    title: 'Блок защитных труб (БЗТ)',
    desc: 'Фиксирует и поджимает головки 163 ТВС при уплотнении главного разъёма, совмещает каналы ПС СУЗ и СВРД. 121 направляющий каркас защищает ПС СУЗ и штанги приводов от потока теплоносителя на выходе из зоны; перфорированная опорная обечайка выравнивает поток на выходе.',
    specs: [
      ['Высота / масса', '7,46 м / 70 т'],
      ['Направляющие каркасы', '121 ПС СУЗ'],
      ['Каналы СВРД', '54'],
      ['Функция', 'поджатие головок ТВС']
    ],
    camOffset: [9.0, 12.0, 10.5],
    labelPos: [0, 9.9, 1.62],
    hot: false,
    internal: true
  },

  // Режим «Оборудование РУ» (модель vver1200_primary_circuit.glb)
  eq_overview: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Реакторная установка: 4 петли',
    desc: 'Компоновка оборудования первого контура и систем безопасности. Нажмите на узел на схеме или в списке, чтобы открыть его отдельно.',
    specs: [
      ['Петли ГЦК', '4'],
      ['Источник 3D-модели', 'АЭМ-технологии, aemtech.ru']
    ],
    nodes: ['eq_reactor', 'eq_sg', 'eq_rcp', 'eq_pressurizer', 'eq_bubbler', 'eq_saoz', 'eq_catcher', 'eq_loop', 'eq_pipes'],
    showPin: false
  },
  eq_reactor: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Реактор В-491',
    desc: 'Центральный элемент установки. Подробная модель корпуса и внутрикорпусных устройств доступна в основном режиме 3D-сцены.',
    specs: [
      ['Высота с верхним блоком', '19,41 м'],
      ['Давление', '16,2 МПа']
    ],
    showPin: false
  },
  eq_sg: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Парогенератор ПГВ-1000МКП',
    desc: 'Горизонтальный теплообменник. Теплоноситель первого контура нагревает и испаряет воду второго контура, не смешиваясь с ней.',
    specs: [
      ['Количество', '4 шт.'],
      ['Контур', 'Первый / второй']
    ],
    showPin: false
  },
  eq_rcp: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Главный циркуляционный насос ГЦНА-1391',
    desc: 'Вертикальный насос, прокачивающий теплоноситель через реактор и парогенератор своей петли.',
    specs: [
      ['Количество', '4 шт.'],
      ['Контур', 'Первый']
    ],
    showPin: false
  },
  eq_pressurizer: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Компенсатор давления',
    desc: 'Вертикальный сосуд с паровой подушкой, поддерживающий давление первого контура и сглаживающий его колебания.',
    specs: [
      ['Объём', '79 м³'],
      ['Количество', '1 шт.']
    ],
    showPin: false
  },
  eq_bubbler: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Барботер',
    desc: 'Горизонтальная ёмкость, принимающая и конденсирующая пар при срабатывании импульсных предохранительных устройств компенсатора давления.',
    specs: [
      ['Количество', '1 шт.'],
      ['Связан с', 'Компенсатором давления']
    ],
    showPin: false
  },
  eq_saoz: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Гидроёмкости САОЗ',
    desc: 'Ёмкости системы аварийного охлаждения зоны с раствором бора. При падении давления в первом контуре раствор поступает в реактор.',
    specs: [
      ['Количество', '4 шт.'],
      ['Тип системы', 'Безопасность']
    ],
    showPin: false
  },
  eq_catcher: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Устройство локализации расплава',
    desc: 'Конструкция под днищем реактора, рассчитанная на удержание и охлаждение расплава активной зоны при тяжёлой аварии.',
    specs: [
      ['Расположение', 'Под корпусом реактора'],
      ['Тип системы', 'Безопасность']
    ],
    showPin: false
  },
  eq_loop: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Главный циркуляционный трубопровод',
    desc: 'Трубопроводы Ду-850, соединяющие реактор, парогенератор и ГЦНА в одну из четырёх петель первого контура.',
    specs: [
      ['Условный проход', 'Ду-850'],
      ['Количество петель', '4']
    ],
    showPin: false
  },
  eq_pipes: {
    tag: 'ОБОРУДОВАНИЕ РУ',
    title: 'Трубопроводы систем безопасности',
    desc: 'Соединительные линии между гидроёмкостями и реактором.',
    specs: [
      ['Назначение', 'Подача раствора бора'],
      ['Тип системы', 'Безопасность']
    ],
    showPin: false
  }
};

// Сопоставление узлов GLB (имена после санитизации GLTFLoader) с карточками VVER_SPECS.
// PBR-материалы задаются в самом GLB (исходник docs/blender/VVER1200_primary_circuit.blend).
const EQUIPMENT_PARTS = [
  { match: /^reactor/, id: 'eq_reactor' },
  { match: /^D_02/, id: 'eq_sg' },
  { match: /^D_03/, id: 'eq_rcp' },
  { match: /^D_04/, id: 'eq_pressurizer' },
  { match: /^D_05/, id: 'eq_bubbler' },
  { match: /^D_08/, id: 'eq_catcher' },
  { match: /^Hydraulic_capacity_SAOZ/, id: 'eq_saoz' },
  { match: /^Pipeline_(Hot|Cold)/, id: 'eq_loop' },
  { match: /^Pipeline/, id: 'eq_pipes' }
];

const EQUIPMENT_NODE_LABELS = {
  eq_reactor: 'Реактор',
  eq_sg: 'Парогенератор',
  eq_rcp: 'ГЦНА',
  eq_pressurizer: 'Компенсатор давления',
  eq_bubbler: 'Барботер',
  eq_saoz: 'Гидроёмкости САОЗ',
  eq_catcher: 'УЛР',
  eq_loop: 'ГЦТ',
  eq_pipes: 'Трубопроводы безопасности'
};

const EQUIPMENT_SCALE = 4.19; // модель «Вся установка» (aemtech): реактор 3.99 ед. → ≈16,7 м в сцене; масштаб условный, точная модель реактора — vver1200_rpv.glb (19,41 м)
const EQUIPMENT_VIEWS = {
  iso: { pos: [44, 34, 53], look: [0, 15, 0] },
  vessel: { pos: [18, 15, 20], look: [0, 8.36, 0] },
  top: { pos: [0.01, 110, 0.01], look: [0, 15, 0] },
  ulr: { pos: [18, -2, 20], look: [0, -2, 0] }
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
  envGroup: null,
  equipmentModel: null,
  equipmentMeshes: [],
  equipmentMaterials: {},
  detailMeshes: [],
  equipmentEnvironment: null,
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
    exploded: false,
    equipmentMode: false,
    detailId: null
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
      // Корпус и верхний блок — один меш GLB: при разборке их разделяет горизонтальная плоскость отсечения
      this.renderer.localClippingEnabled = true;

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

      this.initialized = true;
      this.showReactor();

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
      /* Карточка инспектора 3D: Slate Light (вьюпорт Three.js остаётся тёмным) */
      #vver-info-card {
        width: 325px; max-width: calc(100% - 32px); max-height: calc(100% - 32px); overflow-y: auto;
        box-sizing: border-box; padding: 12px 14px; border-radius: 8px; background: #FFFFFF;
        border: 1px solid #C4C4C4; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); color: #0F172A;
        pointer-events: auto; transition: opacity 0.25s ease, transform 0.25s ease;
      }
      #vver-info-card.hidden { opacity: 0; pointer-events: none; transform: translateY(-8px) scale(0.98); display: none; }
      .vver-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
      .vver-card-header > div { min-width: 0; }
      .vver-card-tag {
        display: inline-block; max-width: 100%; font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
        padding: 2px 7px; border-radius: 5px; background: #F2F2F2; color: #64748B; border: 1px solid #C4C4C4;
        margin-bottom: 4px; overflow-wrap: anywhere;
      }
      .vver-card-title { font-size: 14px; font-weight: 700; color: #0F172A; line-height: 1.3; overflow-wrap: anywhere; }
      .vver-card-close {
        background: #FFFFFF; border: 1px solid #C4C4C4; color: #64748B;
        width: 24px; height: 24px; padding: 0; border-radius: 6px; cursor: pointer; font-size: 12px; line-height: 1;
        display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease;
      }
      .vver-card-close:hover { background: #F2F2F2; border-color: #94A3B8; color: #0F172A; }
      .vver-card-desc { font-size: 11.5px; line-height: 1.45; color: #334155; margin-bottom: 10px; }
      .vver-specs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; border-top: 1px solid #E5E5E5; padding-top: 8px; }
      .vver-spec-item { min-width: 0; background: #F2F2F2; border: 1px solid #E5E5E5; border-radius: 6px; padding: 5px 8px; }
      .vver-node-btn { color: #0F172A; font-family: inherit; font-size: 11px; font-weight: 600; text-align: left; cursor: pointer; border-color: #C4C4C4; }
      .vver-node-btn:hover { border-color: #0284C7; color: #0284C7; background: #FFFFFF; }
      .vver-spec-label { font-size: 9.5px; color: #64748B; text-transform: uppercase; letter-spacing: 0.03em; }
      .vver-spec-val { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: #0F172A; margin-top: 2px; overflow-wrap: anywhere; }
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

    // Сетка технологической разметки на нулевой отметке
    const gridHelper = new THREE.GridHelper(48, 48, 0x1e3a5f, 0x102136);
    gridHelper.position.y = 0.0;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.35;
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
      ring.position.y = 0.01;
      envGroup.add(ring);
    });

    this.scene.add(envGroup);
    this.envGroup = envGroup;
  },

  // ==========================================================================
  // РЕЖИМ «ОБОРУДОВАНИЕ РУ» (ОТДЕЛЬНАЯ МОДЕЛЬ, ЗАГРУЖАЕТСЯ ПО ЗАПРОСУ)
  // ==========================================================================
  loadEquipmentAsset() {
    if (this.equipmentModel) return Promise.resolve(this.equipmentModel);
    if (typeof THREE.GLTFLoader === 'undefined' || typeof THREE.DRACOLoader === 'undefined') {
      return Promise.reject(new Error('GLTFLoader или DRACOLoader недоступны'));
    }

    const draco = new THREE.DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/');
    const loader = new THREE.GLTFLoader();
    loader.setDRACOLoader(draco);

    return new Promise((resolve, reject) => {
      loader.load('./vver1200_primary_circuit.glb', (gltf) => {
        const model = gltf.scene;
        model.name = 'VVER1200_Primary_Circuit_GLB';
        model.scale.setScalar(EQUIPMENT_SCALE);
        model.position.y = 8.36; // центр реактора совпадает с центром корпуса основной сцены

        model.traverse((child) => {
          if (!child.isMesh) return;
          const part = EQUIPMENT_PARTS.find((p) => p.match.test(child.name));
          const id = part ? part.id : 'eq_pipes';

          // Отдельная копия на узел: подсветка не должна задевать другие узлы с тем же материалом
          const key = id + ':' + child.material.uuid;
          if (!this.equipmentMaterials[key]) {
            const material = child.material.clone();
            material.userData.componentId = id;
            material.envMapIntensity = 0.45;
            this.equipmentMaterials[key] = material;
          }
          child.material = this.equipmentMaterials[key];
          child.userData.componentId = id;

          const spec = VVER_SPECS[id];
          child.userData.tooltipInfo = {
            title: spec.title,
            sub: spec.tag,
            desc: spec.desc,
            simple: spec.desc,
            telemetry: () => `${spec.specs[0][0]}: ${spec.specs[0][1]} | ${spec.specs[1][0]}: ${spec.specs[1][1]}`
          };
          this.equipmentMeshes.push(child);
        });

        model.visible = false;
        this.scene.add(model);
        this.equipmentModel = model;
        draco.dispose();
        resolve(model);
      }, undefined, (err) => {
        draco.dispose();
        reject(err);
      });
    });
  },

  async startEquipmentOverview() {
    this.applyViewState();
    try {
      await this.loadEquipmentAsset();
      this.showOverview();
    } catch (err) {
      // Без модели оборудования (например, file://) остаётся сцена корпуса реактора
      console.warn('Не удалось загрузить модель оборудования РУ:', err);
      if (typeof addLog === 'function') addLog('3D: не удалось загрузить модель оборудования РУ.', 'warn');
      this.state.equipmentMode = false;
      this.applyViewState();
      this.selectComponent('rpv', false);
    }
  },

  async showOverview() {
    if (this.state.xray) this.setXRay(false);
    if (this.explodedTarget > 0 || this.explodedProgress > 0) this.setExploded(0, true);

    if (!this.equipmentModel) {
      try {
        await this.loadEquipmentAsset();
      } catch (err) {
        console.warn('Не удалось загрузить модель оборудования РУ:', err);
        if (typeof addLog === 'function') addLog('3D: не удалось загрузить модель оборудования РУ.', 'warn');
        this.showReactor();
        return;
      }
    }

    this.state.equipmentMode = true;
    this.state.detailId = null;
    if (this.equipmentMeshes) {
      this.equipmentMeshes.forEach((mesh) => { mesh.visible = true; });
    }
    this.applyViewState();
    this.selectComponent('eq_overview', false);
    this.setPreset('iso');
  },

  showReactor() {
    this.state.equipmentMode = false;
    this.state.detailId = null;
    this.applyViewState();
    this.selectComponent('rpv', false);
    this.setPreset('iso');
  },

  updateToolbarButtons() {
    const isReactor = !this.state.equipmentMode;
    const btnReactor = document.getElementById('btnThreeReactor');
    const btnOverview = document.getElementById('btnThreeOverview');
    if (btnReactor) btnReactor.classList.toggle('active', isReactor);
    if (btnOverview) btnOverview.classList.toggle('active', !isReactor);
    const arBtn = document.getElementById('btnThreeAutoRotate');
    if (arBtn && this.controls) arBtn.classList.toggle('active', Boolean(this.controls.autoRotate));
    // Разборка относится только к сцене корпуса реактора
    const explodeGroup = document.getElementById('threeExplodeGroup');
    if (explodeGroup) explodeGroup.style.display = isReactor ? 'flex' : 'none';
  },

  // Отдельный экран узла. Реактор открывает подробную сцену корпуса,
  // остальные узлы показываются по одному экземпляру из группы.
  showNode(componentId) {
    if (!this.equipmentModel || !VVER_SPECS[componentId]) return;
    this.state.detailId = componentId;

    if (componentId === 'eq_reactor') {
      this.showReactor();
    } else {
      const node = this.equipmentMeshes.find((mesh) => mesh.userData.componentId === componentId);
      if (!node) return;
      // Петля ГЦТ состоит из двух мешей: горячей и холодной нитки с одним номером
      const loopNumber = componentId === 'eq_loop' ? node.name.slice(-2) : null;
      this.detailMeshes = this.equipmentMeshes.filter((mesh) => mesh === node
        || (loopNumber && mesh.userData.componentId === componentId && mesh.name.endsWith(loopNumber)));
      this.state.equipmentMode = true;
      this.equipmentMeshes.forEach((mesh) => { mesh.visible = this.detailMeshes.includes(mesh); });
      this.applyViewState();
      this.selectComponent(componentId, false);
      this.frameNode();
    }
    if (typeof sound !== 'undefined' && sound.click) sound.click(560);
  },

  frameNode() {
    if (!this.detailMeshes.length) return;
    this.equipmentModel.updateMatrixWorld(true);
    const box = new THREE.Box3();
    this.detailMeshes.forEach((mesh) => box.expandByObject(mesh));
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const halfFovTan = Math.tan((this.camera.fov * Math.PI) / 360);
    const distance = (radius / (halfFovTan * Math.min(1, this.camera.aspect))) * 1.15;

    this.state.camTargetLook.copy(center);
    this.state.camTargetPos.copy(center).add(new THREE.Vector3(0.6, 0.4, 0.7).normalize().multiplyScalar(distance));
    this.state.camAnimating = true;
    this.updateHudZoom();
  },

  // Карта отражений: без неё металлы с высоким metalness выглядят почти чёрными
  getEquipmentEnvironment() {
    if (this.equipmentEnvironment || !this.renderer) return this.equipmentEnvironment;

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x475569);
    const panel = (color, y, size) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      );
      mesh.position.y = y;
      mesh.rotation.x = Math.PI / 2;
      envScene.add(mesh);
    };
    panel(0xffffff, 6, 8);
    panel(0x0f172a, -6, 14);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.equipmentEnvironment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    return this.equipmentEnvironment;
  },

  // Карта отражений сцены корпуса: две высокие светлые полосы по бокам и мягкий верх —
  // на цилиндре корпуса появляются вертикальные блики, как у металла на фото, вместо ровной серости
  getReactorEnvironment() {
    if (this.reactorEnvironment || !this.renderer) return this.reactorEnvironment;
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x1c232d);
    const strip = (color, x, z, w, h, rotY) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      );
      mesh.position.set(x, 0, z);
      mesh.rotation.y = rotY;
      envScene.add(mesh);
    };
    strip(0xffffff, -7, 2, 2.2, 16, Math.PI / 2);     // левая полоса
    strip(0xdfe8f2, 7, -2, 2.2, 16, -Math.PI / 2);    // правая полоса
    strip(0x8fa3b8, 0, -8, 10, 4, 0);                 // мягкий задний свет
    const top = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0x9aa9ba, side: THREE.DoubleSide }));
    top.position.y = 7;
    top.rotation.x = Math.PI / 2;
    envScene.add(top);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.reactorEnvironment = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
    return this.reactorEnvironment;
  },

  applyViewState() {
    const { equipmentMode, detailId } = this.state;
    const isOverview = equipmentMode && !detailId;
    const isReactor = !equipmentMode;

    if (this.equipmentModel) this.equipmentModel.visible = equipmentMode;
    if (this.rpvModel) this.rpvModel.visible = isReactor;
    if (this.envGroup) this.envGroup.visible = isReactor;
    if (this.scene) {
      this.scene.fog = equipmentMode ? null : new THREE.FogExp2(0x070c14, 0.0085);
      // Карта отражений в обоих режимах: без неё металл корпуса и ВКУ выглядит почти чёрным
      this.scene.environment = equipmentMode ? this.getEquipmentEnvironment() : this.getReactorEnvironment();
      if (this.renderer) this.renderer.toneMappingExposure = equipmentMode ? 0.72 : 0.95;
    }
    if (this.controls) this.controls.maxDistance = equipmentMode ? 130.0 : 95.0;

    this.updateLabelsVisibility();
    this.setEquipmentHighlight(null);
    this.state.hoveredId = null;
    if (this.canvas) this.canvas.style.cursor = 'grab';
    if (this.hoverTooltip) this.hoverTooltip.classList.remove('visible');

    this.updateToolbarButtons();

    const help = document.getElementById('threeHelpBadge');
    if (help) {
      help.textContent = 'ЛКМ — вращение • ПКМ — сдвиг • колесо — масштаб'
        + (isOverview ? ' • клик по узлу — отдельный экран' : isReactor ? ' • клик по узлу — карточка' : '');
    }
  },

  setEquipmentHighlight(componentId) {
    Object.values(this.equipmentMaterials).forEach((mat) => {
      const on = mat.userData.componentId === componentId;
      mat.emissive.setHex(on ? 0x0284c7 : 0x000000);
      mat.emissiveIntensity = on ? 0.45 : 0;
    });
  },

  updateLabelsVisibility() {
    if (!this.labelsLayer) return;
    this.labelsLayer.classList.toggle('hidden', !this.state.labelsVisible || this.state.equipmentMode);
  },

  raycastMeshes() {
    if (!this.state.equipmentMode) return this.interactableMeshes;
    return this.state.detailId ? [] : this.equipmentMeshes;
  },

  loadReactorAsset() {
    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('THREE.GLTFLoader не найден! Ожидание загрузки скрипта...');
      return;
    }

    const loader = new THREE.GLTFLoader();
    if (typeof THREE.DRACOLoader !== 'undefined') {
      // Модель собрана скриптом docs/blender/vver1200_reactor_v491.py со сжатием Draco
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/');
      loader.setDRACOLoader(draco);
    }
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
          bzt: gltf.scene.getObjectByName('RPV_BZT'),
          upper: gltf.scene.getObjectByName('RPV_Upper_Block')
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
          'RPV_BZT': { id: 'bzt', spec: VVER_SPECS.bzt },
          'RPV_Upper_Block': { id: 'upper_block', spec: VVER_SPECS.upper_block }
        };
        // Меш с несколькими материалами приходит из GLB группой примитивов: узел ищем по предку
        const mappingOf = (obj) => {
          for (let o = obj; o; o = o.parent) {
            if (specMap[o.name]) return specMap[o.name];
          }
          return { id: 'rpv', spec: VVER_SPECS.rpv };
        };

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const mapping = mappingOf(child);
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
        if (window.vverModel.upper) this.componentGroups['upper_block'] = [window.vverModel.upper];

        this.rpvModel = model;
        model.visible = !this.state.equipmentMode;
        this.scene.add(model);
        this.prepareExplodeLayers();

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
    model.visible = !this.state.equipmentMode;
    this.scene.add(model);
    this.prepareExplodeLayers();

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
      const hits = this.filterClipHits(this.raycaster.intersectObjects(this.raycastMeshes(), true));

      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId;
        if (compId && VVER_SPECS[compId]) {
          if (this.state.equipmentMode && this.state.hoveredId !== compId) this.setEquipmentHighlight(compId);
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
        if (this.state.equipmentMode) this.setEquipmentHighlight(null);
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
      const hits = this.filterClipHits(this.raycaster.intersectObjects(this.raycastMeshes(), true));
      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId;
        if (compId) {
          if (this.state.equipmentMode) this.showNode(compId);
          else this.selectComponent(compId, true);
        }
      }
    };

    this.canvas.addEventListener('pointerdown', this._boundPointerDown);
    this.canvas.addEventListener('pointermove', this._boundPointerMove);
    this.canvas.addEventListener('pointerup', this._boundPointerUp);

    const btnOverview = document.getElementById('btnThreeOverview');
    if (btnOverview) {
      btnOverview.addEventListener('click', () => {
        this.showOverview();
        if (typeof sound !== 'undefined' && sound.click) sound.click(580);
      });
    }

    const btnReactor = document.getElementById('btnThreeReactor');
    if (btnReactor) {
      btnReactor.addEventListener('click', () => {
        this.showReactor();
        if (typeof sound !== 'undefined' && sound.click) sound.click(580);
      });
    }

    const autoRotBtn = document.getElementById('btnThreeAutoRotate');
    if (autoRotBtn) {
      autoRotBtn.addEventListener('click', () => this.toggleAutoRotate());
    }

    const explodeBtn = document.getElementById('btnThreeExplode');
    if (explodeBtn) {
      explodeBtn.addEventListener('click', () => this.toggleExploded());
    }
    const xrayBtn = document.getElementById('btnThreeXRay');
    if (xrayBtn) {
      xrayBtn.addEventListener('click', () => this.toggleXRay());
    }
    const explodeRange = document.getElementById('threeExplodeRange');
    if (explodeRange) {
      explodeRange.addEventListener('input', () => this.setExploded(Number(explodeRange.value) / 100));
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
      (info.nodes || []).forEach((nodeId) => {
        const nodeBtn = document.createElement('button');
        nodeBtn.type = 'button';
        nodeBtn.className = 'vver-spec-item vver-node-btn';
        nodeBtn.textContent = EQUIPMENT_NODE_LABELS[nodeId];
        nodeBtn.addEventListener('click', () => this.showNode(nodeId));
        this.cardSpecsEl.appendChild(nodeBtn);
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
      const dx = this.explodeOffsetFor(componentId, this.explodedProgress);
      this.state.camTargetLook.copy(info.labelPos);
      this.state.camTargetPos.copy(info.camOffset);
      this.state.camTargetLook.x += dx;
      this.state.camTargetPos.x += dx;
      if (componentId === 'core') {
        const dy = this.EXPLODE_CORE_LIFT * Math.max(0, Math.min(1, this.explodedProgress || 0));
        this.state.camTargetLook.y += dy;
        this.state.camTargetPos.y += dy;
      }
      this.state.camAnimating = true;
    }
  },

  focusOnNode(nodeId) {
    this.selectComponent(nodeId, true);
  },

  setOverviewMode() {
    this.state.camTargetPos.set(17.0, 17.0, 24.0);
    this.state.camTargetLook.set(0, 9.7, 0);
    this.state.camAnimating = true;
    this.selectComponent('rpv', false);
    if (typeof sound !== 'undefined' && sound.click) sound.click(580);
  },

  toggleLabels(btn) {
    this.state.labelsVisible = !this.state.labelsVisible;
    if (btn) btn.classList.toggle('active', this.state.labelsVisible);
    this.updateLabelsVisibility();
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
    if (this.state.equipmentMode && this.state.detailId) {
      this.frameNode();
      return;
    }
    const equipmentView = this.state.equipmentMode
      ? EQUIPMENT_VIEWS[preset === 'overview' ? 'iso' : preset === 'bottom' ? 'ulr' : preset === 'core' ? 'vessel' : preset]
      : null;
    if (equipmentView) {
      this.state.camTargetPos.set(...equipmentView.pos);
      this.state.camTargetLook.set(...equipmentView.look);
    } else if (preset === 'iso' || preset === 'overview') {
      this.state.camTargetPos.set(17.0, 17.0, 24.0);
      this.state.camTargetLook.set(0, 9.7, 0);
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
    const m = window.vverModel || {};
    // Внешние слои: корпус (вместе со шпильками разъёма) и верхний блок. ВКУ, выгородка, ТВС и БЗТ не трогаются.
    [m.vessel, m.upper || this.upperBlock].forEach((layer) => {
      if (!layer) return;
      layer.traverse((child) => {
        if (!child.isMesh || child.userData.isXrayEdges) return;
        if (!child.userData.solidMaterial) {
          child.userData.solidMaterial = child.material;
          // Отдельная копия материала: общие материалы GLB не должны «просвечивать» у внутренних узлов
          const xm = child.material.clone();
          xm.transparent = true;
          xm.opacity = 0.16;
          xm.depthWrite = false;
          child.userData.xrayMaterial = xm;
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(child.geometry, 25),
            new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.35, depthWrite: false })
          );
          edges.userData.isXrayEdges = true;
          edges.raycast = () => {};
          edges.visible = false;
          child.add(edges);
          child.userData.xrayEdges = edges;
        }
        child.material = this.state.xray ? child.userData.xrayMaterial : child.userData.solidMaterial;
        child.userData.xrayEdges.visible = this.state.xray;
        child.renderOrder = this.state.xray ? 2 : 0;
        child.castShadow = !this.state.xray;
      });
    });

    const btn = document.getElementById('btnThreeXRay');
    if (btn) {
      btn.classList.toggle('active', this.state.xray);
      btn.setAttribute('aria-pressed', this.state.xray ? 'true' : 'false');
    }
    return this.state.xray;
  },

  toggleXRay() {
    const res = this.setXRay(!this.state.xray);
    if (typeof sound !== 'undefined' && sound.click) sound.click(580);
    return res;
  },

  // --------------------------------------------------------------------------
  // ПОСЛОЙНАЯ РАЗБОРКА КОРПУСА ВБОК (ось X). Слои при полной разборке:
  //   корпус  ←  шахта (ВКУ)  ←  [выгородка + 163 ТВС]  →  БЗТ  →  верхний блок с ШЭМ-3
  // --------------------------------------------------------------------------
  EXPLODE_CUT_Y: 10.4, // главный разъём: фланцы корпуса и крышки (10,0…10,8 м по высоте модели)
  EXPLODE_X: { vessel: -12.0, barrel: -5.2, shroud: 0, core: 0, bzt: 5.2, upper: 10.6 },
  EXPLODE_CORE_LIFT: 4.9, // подъём сборки ТВС над выгородкой при полной разборке, м
  // Узел инспектора → слой, за которым следует выноска и камера
  EXPLODE_LAYER_OF: {
    rpv: 'vessel', flange: 'vessel', nozzles: 'vessel', barrel: 'barrel',
    shroud: 'shroud', core: 'core', bzt: 'bzt', upper_block: 'upper'
  },

  explodeOffsetFor(componentId, progress) {
    const layer = this.EXPLODE_LAYER_OF[componentId];
    if (!layer) return 0;
    return (this.EXPLODE_X[layer] || 0) * Math.max(0, Math.min(1, progress || 0));
  },

  // Верхний блок (крышка + 121 привод ШЭМ-3) отделяется от корпуса копией меша с отсечением выше разъёма
  prepareExplodeLayers() {
    const m = window.vverModel;
    if (!m || !m.vessel || this.upperBlock) return;
    if (m.upper) {
      // Новая модель (vver1200_reactor_v491.py): верхний блок — отдельный объект
      this.upperBlock = m.upper;
      this.layerBaseX = {
        vessel: m.vessel.position.x,
        barrel: m.barrel ? m.barrel.position.x : 0,
        shroud: m.shroud ? m.shroud.position.x : 0,
        core: m.core ? m.core.position.x : 0,
        bzt: m.bzt ? m.bzt.position.x : 0,
        upper: m.upper.position.x
      };
      this.applyExploded(this.explodedProgress);
      return;
    }
    const cutY = this.EXPLODE_CUT_Y;
    const keepBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), cutY);
    const keepAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), -cutY);
    const clip = (mesh, plane) => {
      const src = mesh.material;
      const one = (mat) => {
        const c = mat.clone();
        c.clippingPlanes = [plane];
        c.clipShadows = true;
        c.side = THREE.DoubleSide; // видна внутренняя поверхность на срезе
        return c;
      };
      mesh.material = Array.isArray(src) ? src.map(one) : one(src);
    };

    const upper = m.vessel.clone(true);
    upper.name = 'RPV_Upper_Block';
    m.vessel.traverse((o) => {
      if (!o.isMesh) return;
      clip(o, keepBelow);
      o.userData.clipMaxY = cutY;
    });
    const spec = VVER_SPECS.upper_block;
    upper.traverse((o) => {
      if (!o.isMesh) return;
      clip(o, keepAbove);
      o.userData.clipMinY = cutY;
      o.userData.componentId = 'upper_block';
      o.userData.tooltipInfo = {
        title: spec.title, sub: spec.tag, desc: spec.desc, simple: spec.desc,
        telemetry: () => `${spec.specs[0][0]}: ${spec.specs[0][1]}`
      };
      this.interactableMeshes.push(o);
      this.interactiveMeshes.push(o);
    });
    m.vessel.parent.add(upper);
    this.upperBlock = upper;
    this.componentGroups.upper_block = [upper];
    this.layerBaseX = {
      vessel: m.vessel.position.x,
      barrel: m.barrel ? m.barrel.position.x : 0,
      shroud: m.shroud ? m.shroud.position.x : 0,
      core: m.core ? m.core.position.x : 0,
      bzt: m.bzt ? m.bzt.position.x : 0,
      upper: upper.position.x
    };
    this.applyExploded(this.explodedProgress);
  },

  // Отбрасывает попадания луча в отсечённую (невидимую) часть корпуса или верхнего блока
  filterClipHits(hits) {
    return hits.filter((h) => {
      const u = h.object.userData;
      if (this.state.xray && u.xrayMaterial) return false;
      if (u.clipMaxY !== undefined && h.point.y > u.clipMaxY + 0.02) return false;
      if (u.clipMinY !== undefined && h.point.y < u.clipMinY - 0.02) return false;
      return true;
    });
  },

  setExploded(progress, immediate = false) {
    const val = Math.max(0.0, Math.min(1.0, typeof progress === 'number' ? progress : (progress ? 1.0 : 0.0)));
    const wasAssembled = this.explodedTarget < 0.01;
    this.explodedTarget = val;
    this.state.exploded = val > 0.01;

    if (immediate) {
      this.explodedProgress = val;
      this.applyExploded(val);
    }

    // Камера: при начале разборки — общий план всех слоёв, при сборке — обратно к корпусу
    if (!immediate && !this.state.equipmentMode) {
      if (wasAssembled && val >= 0.01) {
        this.state.camTargetLook.set(2.2, 9.2, 0); // сдвиг вправо: справа сцену частично закрывает карточка узла
        this.state.camTargetPos.set(5.5, 15.0, 40.0);
        this.state.camAnimating = true;
      } else if (!wasAssembled && val < 0.01) {
        this.setPreset('iso');
      }
    }

    const range = document.getElementById('threeExplodeRange');
    if (range && Number(range.value) !== Math.round(val * 100)) range.value = String(Math.round(val * 100));
    const btn = document.getElementById('btnThreeExplode');
    if (btn) {
      btn.classList.toggle('active', val > 0.5);
      btn.setAttribute('aria-pressed', val > 0.5 ? 'true' : 'false');
      btn.textContent = val > 0.5 ? 'Собрать' : 'Разобрать';
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
    const m = window.vverModel;
    const k = Math.max(0, Math.min(1, progress));
    const base = this.layerBaseX || {};
    const X = this.EXPLODE_X;
    const place = (obj, layer) => { if (obj) obj.position.x = (base[layer] || 0) + X[layer] * k; };
    place(m.vessel, 'vessel');
    place(m.barrel, 'barrel');
    place(m.shroud, 'shroud');
    place(m.core, 'core');
    // 163 ТВС поднимаются из выгородки вверх, иначе зону за выгородкой не видно
    if (m.core) {
      if (this.coreBaseY === undefined) this.coreBaseY = m.core.position.y;
      m.core.position.y = this.coreBaseY + this.EXPLODE_CORE_LIFT * k;
    }
    place(m.bzt, 'bzt');
    place(this.upperBlock, 'upper');

    // Выноски едут вместе со своими слоями
    (this.pinElements || []).forEach((pin) => {
      const spec = VVER_SPECS[pin.id];
      if (!spec || !spec.labelPos) return;
      pin.baseWorldPos.copy(spec.labelPos);
      pin.baseWorldPos.x += this.explodeOffsetFor(pin.id, k);
      if (pin.id === 'core') pin.baseWorldPos.y += this.EXPLODE_CORE_LIFT * k;
    });
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
      // Иначе VVEROrbitControls.update() возвращает камеру на прежнюю орбиту
      if (this.controls.syncFromCamera) this.controls.syncFromCamera();
      if (
        this.camera.position.distanceTo(this.state.camTargetPos) < 0.08 &&
        this.controls.target.distanceTo(this.state.camTargetLook) < 0.05
      ) {
        this.state.camAnimating = false;
        if (this.controls.syncFromCamera) this.controls.syncFromCamera();
      }
    }

    if (this.controls && this.controls.update) {
      this.controls.update(isPaused || this.state.camAnimating ? 0.0 : dt);
    }

    this.renderer.render(this.scene, this.camera);

    // Проекция 3D-выносок в экранные координаты DOM
    if (this.state.labelsVisible && this.labelsLayer) {
      const container = document.getElementById('threeContainer');
      const w = container ? container.clientWidth : 1000;
      const h = container ? container.clientHeight : 650;

      const insideVisible = this.explodedProgress > 0.35 || this.state.xray;
      this.pinElements.forEach((pin) => {
        this.projectedVec.copy(pin.baseWorldPos);
        this.projectedVec.project(this.camera);

        const spec = VVER_SPECS[pin.id];
        if ((spec && spec.internal && !insideVisible) || this.projectedVec.z > 1.0 || this.projectedVec.z < -1.0) {
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
    this.envGroup = null;
    this.equipmentModel = null;
    this.equipmentMeshes = [];
    this.equipmentMaterials = {};
    this.detailMeshes = [];
    this.equipmentEnvironment = null;
    this.state.equipmentMode = true;
    this.state.detailId = null;
    this.explodedProgress = 0.0;
    this.explodedTarget = 0.0;
    this.initialized = false;
  },

  // Поддержка лучевого хит-тестинга («Простыми словами» / checkRaycaster)
  checkRaycaster(mx, my, rect) {
    if (!this.raycaster || !this.camera) return;
    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hits = this.filterClipHits(this.raycaster.intersectObjects(this.state.equipmentMode ? this.raycastMeshes() : this.interactiveMeshes, true));
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