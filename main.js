// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-491, БелАЭС)
// main.js — Главный диспетчер UI, обработчики событий, звук, телеметрия и mainLoop
// ============================================================================

// Инженерная температурная шкала теплоносителя (Slate Light SCADA)
var THERMAL_COLOR_SCALE = window.THERMAL_COLOR_SCALE || {
  COLD_COOLING: '#0EA5E9',     // 10°C – 45°C: Ледяной лазурный (водозабор, градирни, подпитка)
  RETURN_CONDENSATE: '#06B6D4',// 45°C – 100°C: Глубокий циан (конденсат, возврат охлажденной воды)
  HOT_STEAM: '#F59E0B',        // 100°C – 280°C: Янтарный (2-й контур, паропроводы от ПГ к турбине)
  REACTOR_CORE: '#EF4444',     // 280°C – 330°C: Сигнальный коралловый (1-й контур под давлением, корпус, ГЦТ)
  CRITICAL_OVERHEAT: '#DC2626' // > 350°C: Глубокий кармин (аварийные уставки и перегрев ТВЭЛ)
};
window.THERMAL_COLOR_SCALE = THERMAL_COLOR_SCALE;

// Геометрия 163 ТВС активной зоны ВВЭР-1200 вынесена в core_cartogram.js

    // --- 3. ЖУРНАЛ СОБЫТИЙ БЩУ ---
    const eventLogEl = document.getElementById('eventLog');
    function addLog(message, type = 'info') {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + (type === 'warn' ? 'warn' : type === 'danger' ? 'danger' : type === 'ok' ? 'ok' : '');
      entry.innerHTML = `<span class="log-time">[${hh}:${mm}:${ss}]</span>${message}`;
      eventLogEl.prepend(entry);
      while (eventLogEl.children.length > 60) {
        eventLogEl.removeChild(eventLogEl.lastChild);
      }
    }

    const btnClearLog = document.getElementById('btnClearLog');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        if (eventLogEl) eventLogEl.innerHTML = '';
        addLog('Оперативный журнал БЩУ очищен оператором.', 'info');
      });
    }

    // --- 4. ПРОЦЕДУРНЫЙ ЗВУКОВОЙ ДВИЖОК (WEB AUDIO API) ---
    const sound = {

      enabled: false,
      ctx: null,
      pumpOsc: null,
      pumpGain: null,
      steamNoiseGain: null,

      init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Гул ГЦНА-1391 и турбоагрегата (50 Гц + гармоника 100 Гц)
        this.pumpOsc = this.ctx.createOscillator();
        this.pumpOsc.type = 'sawtooth';
        this.pumpOsc.frequency.value = 50;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 140;

        this.pumpGain = this.ctx.createGain();
        this.pumpGain.gain.value = 0.0;

        this.pumpOsc.connect(filter);
        filter.connect(this.pumpGain);
        this.pumpGain.connect(this.ctx.destination);
        this.pumpOsc.start();

        // Белый шум для шипения пара (БРУ-А / БРУ-К / ИПУ КД)
        const bufferSize = this.ctx.sampleRate * 2;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1100;

        this.steamNoiseGain = this.ctx.createGain();
        this.steamNoiseGain.gain.value = 0.0;

        whiteNoise.connect(bandpass);
        bandpass.connect(this.steamNoiseGain);
        this.steamNoiseGain.connect(this.ctx.destination);
        whiteNoise.start();
      },

      toggle() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.enabled = !this.enabled;
        const btn = document.getElementById('btnAudio');
        btn.textContent = this.enabled ? 'ЗВУК: ВКЛ' : 'ЗВУК: ВЫКЛ';
        btn.classList.toggle('active', this.enabled);
        if (!this.enabled && this.pumpGain && this.steamNoiseGain) {
          this.pumpGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
          this.steamNoiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        } else {
          this.click(660);
        }
      },

      click(freq = 520) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.08, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.055);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
      },

      alarmAZ1() {
        if (!this.enabled || !this.ctx) return;
        const now = this.ctx.currentTime;
        for (let i = 0; i < 4; i++) {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now + i * 0.22);
          osc.frequency.setValueAtTime(620, now + i * 0.22 + 0.1);
          g.gain.setValueAtTime(0.09, now + i * 0.22);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.22 + 0.2);
          osc.connect(g);
          g.connect(this.ctx.destination);
          osc.start(now + i * 0.22);
          osc.stop(now + i * 0.22 + 0.21);
        }
      },

      updateContinuous() {
        if (!this.enabled || !this.ctx) return;
        const avgFlow = sim.loops.reduce((s, l) => s + l.flowPct, 0) / 400;
        const humLevel = 0.015 + 0.035 * avgFlow * (sim.thermalPowerMW / 3200);
        this.pumpOsc.frequency.setTargetAtTime(42 + 20 * avgFlow, this.ctx.currentTime, 0.1);
        this.pumpGain.gain.setTargetAtTime(humLevel, this.ctx.currentTime, 0.15);

        const isVenting = sim.bruAOpen || sim.bruKOpen || sim.ipuKdOpen || sim.primaryLeakActive;
        this.steamNoiseGain.gain.setTargetAtTime(isVenting ? 0.065 : 0.0, this.ctx.currentTime, 0.1);
      }
    };

    window.sound = sound;
    document.getElementById('btnAudio').addEventListener('click', () => sound.toggle());


    // Дополняем каждую из 163 кассет данными кампании и глубины выгорания для паспорта ТВС
    const activeAssemblies = (typeof coreAssemblies !== 'undefined') ? coreAssemblies : (window.coreAssemblies || []);
    activeAssemblies.forEach(a => {
      if (!a.campaignYear) a.campaignYear = a.enrichment < 4.1 ? 3 : (a.enrichment < 4.6 ? 2 : 1);
      a.burnupMWd = +((a.campaignYear * 14.2 - a.normR * 4.5 + Math.sin(a.id) * 1.2).toFixed(1));
    });

    // Словарь понятных объяснений «Простыми словами» для всех узлов (включая 3D-сцену)
    const plainExplanations = {
      reactor: 'Реактор — это «сердце» станции. Внутри него урановое топливо делится и выделяет огромное количество тепла, нагревая воду 1-го контура почти до 329 °C.',
      core: 'Активная зона — это 163 шестигранных кассеты с урановыми таблетками. Чем выше поток нейтронов, тем сильнее греется топливо и ярче голубое свечение Черенкова.',
      drives: 'Приводы СУЗ удерживают поглощающие стержни над зоной. При опасности они обесточиваются, и стержни под собственным весом падают вниз за 3–4 секунды, мгновенно глуша реактор.',
      kd: 'Компенсатор давления (КД) работает как «паровая подушка» в скороварке: он держит давление 160 атмосфер (16,2 МПа), чтобы вода в реакторе не закипала даже при 329 °C.',
      pgv: 'Парогенератор (ПГВ) — это гигантский теплообменник. Радиоактивная вода 1-го контура течет внутри 11 тысяч тонких трубок и через их стенки кипятит чистую воду 2-го контура, превращая её в пар, но не смешиваясь с ней.',
      gcna: 'Главный циркуляционный насос (ГЦНА) — мощнейший насос с тяжелым маховиком, который непрерывно прокачивает горячую воду через реактор и парогенераторы.',
      gpk: 'Главный паровой коллектор (ГПК) собирает чистый пар от всех четырех парогенераторов в одну магистраль, чтобы направить его на лопатки паровой турбины.',
      bruk: 'БРУ-К — это предохранительный клапан, который при резком снижении нагрузки турбины сбрасывает лишний пар прямо в конденсатор, чтобы не поднималось давление в парогенераторах.',
      brua: 'БРУ-А — аварийный клапан сброса чистого пара из 2-го контура в атмосферу, если конденсатор не может принять избыток пара.',
      turbine: 'Паровая турбина работает как ветряк: струя пара под давлением 70 атмосфер раскручивает её лопатки со скоростью 50 оборотов в секунду (3000 об/мин).',
      generator: 'Генератор сидит на одном валу с турбиной и превращает механическое вращение в электрический ток мощностью 1200 МВт для городов и заводов.',
      condenser: 'Конденсатор охлаждает отработавший после турбины пар холодной водой из градирен, снова превращая пар в жидкую воду для повторного цикла.',
      pen: 'Питательные электронасосы (ПЭН) под высоким давлением закачивают остывшую воду из конденсатора обратно в парогенераторы, замыкая 2-й контур.',
      saoz: 'САОЗ — пассивная «скорая помощь» реактора. Это баки с водой и борной кислотой под давлением азота: если давление в реакторе упадет из-за течи, клапаны откроются сами без электричества и зальют зону.',
      spot: 'СПОТ — система пассивного отвода тепла. Даже если на станции полностью пропадет электричество, пар из парогенераторов будет охлаждаться уличным воздухом в теплообменниках на куполе.',
      ulr: 'Ловушка расплава (УЛР) — стальная воронка со специальным керамическим наполнителем под днищем реактора. При самой тяжелой запроектной аварии она удержит и остудит расплав внутри здания.',
      tvs: 'Каждая шестигранная кассета ТВС-2М содержит 312 тонких циркониевых трубочек (твэлов) с таблетками диоксида урана. Вода проходит снизу вверх вдоль твэлов и забирает тепло.'
    };

    function resolvePlainText(title, explicitSimple) {
      if (explicitSimple) return explicitSimple;
      const t = (title || '').toLowerCase();
      if (t.includes('гпк') || t.includes('коллектор')) return plainExplanations.gpk;
      if (t.includes('бру-к')) return plainExplanations.bruk;
      if (t.includes('бру-а')) return plainExplanations.brua;
      if (t.includes('компенсатор') || t.includes('кд')) return plainExplanations.kd;
      if (t.includes('пэн') || t.includes('питательн')) return plainExplanations.pen;
      if (t.includes('саоз') || t.includes('гидроемк')) return plainExplanations.saoz;
      if (t.includes('спот')) return plainExplanations.spot;
      if (t.includes('улр') || t.includes('ловушк')) return plainExplanations.ulr;
      if (t.includes('парогенератор') || t.includes('пгв')) return plainExplanations.pgv;
      if (t.includes('гцна') || t.includes('циркуляционн')) return plainExplanations.gcna;
      if (t.includes('турбин')) return plainExplanations.turbine;
      if (t.includes('генератор') || t.includes('тзв')) return plainExplanations.generator;
      if (t.includes('конденсатор')) return plainExplanations.condenser;
      if (t.includes('привод') || t.includes('шэм')) return plainExplanations.drives;
      if (t.includes('твс') || t.includes('сборк')) return plainExplanations.tvs;
      if (t.includes('активная зона')) return plainExplanations.core;
      return plainExplanations.reactor;
    }

    // --- 6. ПЕРСОНАЛЬНЫЕ МИНИ-ГРАФИКИ 3 ПОСТОВ УПРАВЛЕНИЯ (REAL-TIME CHARTS) ---
    const chartHistory = {
      maxPoints: 180,
      powerTh: [],
      powerEl: [],
      armSet: [],
      rodG10: [],
      xenon: [],
      turbValve: [],
      gridFreq: [],
      p1: [],
      p2: [],
      subcool: []
    };

    for (let i = 0; i < chartHistory.maxPoints; i++) {
      chartHistory.powerTh.push(3200);
      chartHistory.powerEl.push(1200);
      chartHistory.armSet.push(3200);
      chartHistory.rodG10.push(80);
      chartHistory.xenon.push(1.0);
      chartHistory.turbValve.push(100);
      chartHistory.gridFreq.push(50.0);
      chartHistory.p1.push(16.2);
      chartHistory.p2.push(7.0);
      chartHistory.subcool.push(19.5);
    }

    let lastChartSampleTime = 0;
    function sampleCharts(nowMs) {
      if (nowMs - lastChartSampleTime < 140 || sim.timeSpeed === 0) return;
      lastChartSampleTime = nowMs;

      const pushCap = (arr, val) => {
        arr.push(val);
        if (arr.length > chartHistory.maxPoints) arr.shift();
      };

      const freqHz = sim.turbineRpm / 60.0;
      pushCap(chartHistory.powerTh, sim.thermalPowerMW);
      pushCap(chartHistory.powerEl, sim.electricalPowerMW);
      pushCap(chartHistory.armSet, sim.armTargetMW);
      pushCap(chartHistory.rodG10, sim.group10Pos);
      pushCap(chartHistory.xenon, sim.xenon135);
      pushCap(chartHistory.turbValve, sim.turbineValvePct);
      pushCap(chartHistory.gridFreq, freqHz);
      pushCap(chartHistory.p1, sim.primaryPressureMPa);
      pushCap(chartHistory.p2, sim.steamHeaderPressMPa);
      pushCap(chartHistory.subcool, sim.subcoolingMarginC);

      // Пост 1: Реактор и СУЗ
      drawMultiChart('chartPower', [
        { data: chartHistory.powerTh, min: 0, max: 3600, color: '#f97316', width: 1.9 },
        { data: chartHistory.armSet, min: 0, max: 3600, color: '#f59e0b', width: 1.2, dashed: true },
        { data: chartHistory.rodG10, min: 0, max: 100, color: '#38bdf8', width: 1.5 },
        { data: chartHistory.xenon, min: 0, max: 2.5, color: '#a78bfa', width: 1.4 }
      ]);

      // Пост 2: Турбина и Сеть
      drawMultiChart('chartNeutronics', [
        { data: chartHistory.powerEl, min: 0, max: 1400, color: '#10b981', width: 1.9 },
        { data: chartHistory.turbValve, min: 0, max: 110, color: '#cbd5e1', width: 1.5 },
        { data: chartHistory.gridFreq, min: 0, max: 55, color: '#38bdf8', width: 1.4 }
      ]);

      // Пост 3: 1-й контур и Давление
      drawMultiChart('chartPressure', [
        { data: chartHistory.p1, min: 0, max: 20, color: '#f97316', width: 1.9 },
        { data: chartHistory.p2, min: 0, max: 20, color: '#38bdf8', width: 1.5 },
        { data: chartHistory.subcool, min: 0, max: 50, color: '#10b981', width: 1.5 }
      ]);
    }

    function drawMultiChart(canvasId, seriesList) {
      const c = document.getElementById(canvasId);
      if (!c) return;
      const rect = c.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      if (c.width !== Math.floor(rect.width) || c.height !== Math.floor(rect.height)) {
        c.width = Math.floor(rect.width);
        c.height = Math.floor(rect.height);
      }
      const ctxC = c.getContext('2d');
      const w = c.width;
      const h = c.height;
      ctxC.clearRect(0, 0, w, h);

      ctxC.strokeStyle = 'rgba(30, 41, 59, 0.7)';
      ctxC.lineWidth = 1;
      ctxC.beginPath();
      for (let y = 22; y < h; y += 22) {
        ctxC.moveTo(0, y);
        ctxC.lineTo(w, y);
      }
      for (let x = 0; x < w; x += 48) {
        ctxC.moveTo(x, 0);
        ctxC.lineTo(x, h);
      }
      ctxC.stroke();

      seriesList.forEach(s => {
        const arr = s.data;
        if (arr.length < 2) return;
        ctxC.save();
        ctxC.strokeStyle = s.color;
        ctxC.lineWidth = s.width || 1.5;
        if (s.dashed) ctxC.setLineDash([4, 3]);
        ctxC.beginPath();
        for (let i = 0; i < arr.length; i++) {
          const x = (i / (chartHistory.maxPoints - 1)) * w;
          const norm = (arr[i] - s.min) / (s.max - s.min);
          const y = h - 5 - Math.max(0, Math.min(1, norm)) * (h - 26);
          if (i === 0) ctxC.moveTo(x, y);
          else ctxC.lineTo(x, y);
        }
        ctxC.stroke();
        ctxC.restore();
      });
    }

    // --- ПАЛИТРА SCADA: СВЕТЛАЯ ТЕМА IAEA SCADA (ПРОМЫШЛЕННЫЙ СТАНДАРТ БЩУ АЭС) ---
    const SCADA_THEME = {
      bg: '#cbd5e1',            // Светлый стальной фон подложки
      grid: '#94a3b8',          // Сетка координат
      panelBg: '#ffffff',       // Светлые корпуса оборудования (#ffffff)
      border: '#475569',        // Темная окантовка 2px solid #475569
      textMain: '#0f172a',      // Четкие черные надписи (#0f172a)
      textMuted: '#475569',     // Матовый серый
      primaryCoolant: '#1d4ed8',// Насыщенный холодный синий (#1d4ed8)
      hotLeg: '#dc2626',        // Горячий красный (#dc2626)
      coldLeg: '#1d4ed8',       // Насыщенный холодный синий (#1d4ed8)
      steam: '#64748b',         // Паровой тракт
      feedwater: '#1d4ed8',     // Питательная вода
      statusOk: '#15803d',      // Норма
      statusWarn: '#b45309',    // Предупреждение
      statusAlarm: '#b91c1c'    // Авария
    };

    // --- 7. ЦЕНТРАЛЬНАЯ ИНТЕРАКТИВНАЯ 2D ВИЗУАЛИЗАЦИЯ (HTML5 CANVAS) ---
    const simCanvas = document.getElementById('simCanvas');
    const ctx = simCanvas.getContext('2d');
    const canvasContainer = document.getElementById('canvasContainer');
    const tooltipEl = document.getElementById('canvasTooltip');
    window.simCanvas = simCanvas;
    window.ctx = ctx;
    window.canvasContainer = canvasContainer;
    window.tooltipEl = tooltipEl;

    const cam = {
      x: 0,
      y: 0,
      zoom: 1.0,
      dragging: false,
      movedDuringDrag: false,
      startX: 0,
      startY: 0,
      mouseX: 0,
      mouseY: 0,
      worldX: 0,
      worldY: 0
    };

    var activeHotspots = [];
    window.activeHotspots = activeHotspots;

    function getBaseSceneSize() {
      if (sim.viewMode === 'systems') {
        return { w: 1360, h: 720 };
      }
      return { w: 1160, h: 720 };
    }

    function resizeSimCanvas() {
      const rect = canvasContainer.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = window.devicePixelRatio || 1;
      simCanvas.width = Math.round(rect.width * dpr);
      simCanvas.height = Math.round(rect.height * dpr);
      simCanvas.style.width = rect.width + 'px';
      simCanvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const setupCanvas = resizeSimCanvas;
    const resizeCanvas = resizeSimCanvas;
    window.setupCanvas = setupCanvas;
    window.resizeCanvas = resizeCanvas;
    window.resizeSimCanvas = resizeSimCanvas;
    window.addEventListener('resize', resizeSimCanvas);
    resizeSimCanvas();

    canvasContainer.addEventListener('mousedown', e => {
      if (sim.viewMode === 'core') return;
      cam.dragging = true;
      cam.movedDuringDrag = false;
      cam.startX = e.clientX - cam.x;
      cam.startY = e.clientY - cam.y;
    });

    window.addEventListener('mouseup', () => {
      cam.dragging = false;
    });

    canvasContainer.addEventListener('mousemove', e => {
      const rect = canvasContainer.getBoundingClientRect();
      cam.mouseX = e.clientX - rect.left;
      cam.mouseY = e.clientY - rect.top;

      if (cam.dragging && sim.viewMode !== 'core') {
        const nx = e.clientX - cam.startX;
        const ny = e.clientY - cam.startY;
        if (Math.hypot(nx - cam.x, ny - cam.y) > 4) cam.movedDuringDrag = true;
        cam.x = nx;
        cam.y = ny;
      }

      const isCore = (sim.viewMode === 'core');
      const sz = getBaseSceneSize();
      const curZoom = isCore ? 1.0 : cam.zoom;
      const curPanX = isCore ? 0 : cam.x;
      const curPanY = isCore ? 0 : cam.y;
      const scaleFit = Math.min(rect.width / sz.w, rect.height / sz.h) * curZoom;
      const offsetX = (rect.width - sz.w * scaleFit) / 2 + curPanX;
      const offsetY = (rect.height - sz.h * scaleFit) / 2 + curPanY;

      cam.worldX = (cam.mouseX - offsetX) / scaleFit;
      cam.worldY = (cam.mouseY - offsetY) / scaleFit;

      checkHotspotHover(rect);
    });

    canvasContainer.addEventListener('mouseleave', () => {
      tooltipEl.style.display = 'none';
      sim.hoveredHotspot = null;
    });

    canvasContainer.addEventListener('click', (e) => {
      if (sim.viewMode !== 'core' && cam.movedDuringDrag) return;
      const rect = canvasContainer.getBoundingClientRect();
      const isCore = (sim.viewMode === 'core');
      const sz = getBaseSceneSize();
      const curZoom = isCore ? 1.0 : cam.zoom;
      const curPanX = isCore ? 0 : cam.x;
      const curPanY = isCore ? 0 : cam.y;
      const scaleFit = Math.min(rect.width / sz.w, rect.height / sz.h) * curZoom;
      const offsetX = (rect.width - sz.w * scaleFit) / 2 + curPanX;
      const offsetY = (rect.height - sz.h * scaleFit) / 2 + curPanY;
      const wx = (e.clientX - rect.left - offsetX) / scaleFit;
      const wy = (e.clientY - rect.top - offsetY) / scaleFit;

      let targetSpot = sim.hoveredHotspot;
      if (!targetSpot) {
        for (let i = activeHotspots.length - 1; i >= 0; i--) {
          const h = activeHotspots[i];
          if (h.r) {
            const dx = wx - h.x;
            const dy = wy - h.y;
            if (dx * dx + dy * dy <= h.r * h.r) {
              targetSpot = h;
              break;
            }
          } else if (wx >= h.x && wx <= h.x + h.w && wy >= h.y && wy <= h.y + h.h) {
            targetSpot = h;
            break;
          }
        }
      }

      if (targetSpot) {
        if (typeof targetSpot.onClick === 'function') {
          targetSpot.onClick();
          sound.click(680);
          return;
        }
        if (targetSpot.assemblyId) {
          sim.selectedAssemblyId = targetSpot.assemblyId;
          sound.click(740);
        }
      }
    });

    canvasContainer.addEventListener('wheel', e => {
      e.preventDefault();
      if (sim.viewMode === 'core') return;
      if (sim.viewMode === '3d') {
        threeCtrl.zoomWheel(e.deltaY);
        return;
      }
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      cam.zoom = Math.max(0.55, Math.min(3.2, cam.zoom * factor));
      document.getElementById('hudZoom').textContent = Math.round(cam.zoom * 100) + '%';
    }, { passive: false });

    document.getElementById('btnZoomIn').addEventListener('click', () => {
      if (sim.viewMode === 'core') return;
      if (sim.viewMode === '3d') {
        threeCtrl.zoomStep(-1);
        return;
      }
      cam.zoom = Math.min(3.2, cam.zoom * 1.18);
      document.getElementById('hudZoom').textContent = Math.round(cam.zoom * 100) + '%';
    });

    document.getElementById('btnZoomOut').addEventListener('click', () => {
      if (sim.viewMode === 'core') return;
      if (sim.viewMode === '3d') {
        threeCtrl.zoomStep(1);
        return;
      }
      cam.zoom = Math.max(0.55, cam.zoom / 1.18);
      document.getElementById('hudZoom').textContent = Math.round(cam.zoom * 100) + '%';
    });

    document.getElementById('btnResetView').addEventListener('click', () => {
      if (sim.viewMode === '3d') {
        threeCtrl.setPreset('iso');
        return;
      }
      cam.x = 0;
      cam.y = 0;
      cam.zoom = 1.0;
      document.getElementById('hudZoom').textContent = '100%';
    });

    document.getElementById('btnToggleParticles').addEventListener('click', e => {
      sim.showParticles = !sim.showParticles;
      e.currentTarget.classList.toggle('active', sim.showParticles);
    });

    // --- ИНЖЕНЕРНЫЙ И АКАДЕМИЧЕСКИЙ РЕЖИМ (ReactorLab // theory_data.js) ---
    let currentTheoryTab = 'kinetics';

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderMathInTheory() {
      const el = document.getElementById('modalTheory') || document.getElementById('theoryDrawer');
      if (typeof renderMathInElement === 'function' && el) {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      }
    }

    function renderTheorySection(tabKey) {
      const contentEl = document.getElementById('theoryDrawerContent');
      if (!contentEl) return;

      if (tabKey === 'sources') {
        let html = `
          <div class="theory-section-lead">
            <div style="font-size:10px; font-weight:700; color:#0284C7; text-transform:uppercase; margin-bottom:3px;">
              НОРМАТИВНО-ТЕХНИЧЕСКАЯ БАЗА &amp; АКАДЕМИЧЕСКИЕ ИСТОЧНИКИ
            </div>
            <div style="font-weight:700; color:#0F172A; margin-bottom:4px; font-size:13px;">
              📚 Проектная, нормативная и академическая литература РУ В-491 (ВВЭР-1200)
            </div>
            <div style="color:#64748B;">
              Официальная проектно-конструкторская документация ОКБ «Гидропресс», отчеты по обоснованию безопасности АЭС-2006, стандарты безопасности МАГАТЭ и академические труды НИЯУ МИФИ.
            </div>
          </div>

          <!-- Официальный обучающий видеоматериал по РУ ВВЭР-1200 -->
          <div class="theory-card" style="background:#FFFFFF; border:1px solid #E2E8F0; border-radius:6px; padding:16px 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <span class="theory-org-badge">[ВИДЕОМАТЕРИАЛ]</span>
              <span style="font-size:10px; color:#64748B; font-weight:600;">ВВЭР-1200 / АЭС-2006</span>
            </div>
            <div style="font-weight:700; color:#0F172A; font-size:13.5px; line-height:1.4;">
              «Конструкция и компоновка реакторной установки ВВЭР-1200»
            </div>
            <div style="font-size:12px; color:#334155; line-height:1.5;">
              3D-визуализация оборудования реакторного отделения, корпуса реактора, парогенераторов ПГВ-1000МКП и систем пассивной безопасности.
            </div>
            <div style="margin-top:6px;">
              <a href="https://www.youtube.com/watch?v=xbFMs2_Ek3o" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:8px; background:#0284C7; color:#FFFFFF; padding:8px 16px; border-radius:6px; text-decoration:none; font-size:11.5px; font-weight:700; transition:background-color 0.15s ease;">
                ▶ Смотреть видеоматериал (YouTube) ↗
              </a>
            </div>
          </div>

          <div style="font-size:11px; font-weight:700; color:#0F172A; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">
            Проектная и нормативная документация
          </div>

          <div class="theory-sources-grid">
        `;

        const sources = (window.REACTOR_THEORY && window.REACTOR_THEORY.primarySources) || [];
        sources.forEach((src) => {
          html += `
            <div class="theory-card">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="theory-org-badge">[${escapeHtml(src.badge)}]</span>
              </div>
              <div style="font-weight:700; color:#0F172A; font-size:13px; line-height:1.45;">
                «${escapeHtml(src.title)}»
              </div>
              <div style="font-size:11.5px; color:#64748B; line-height:1.4;">
                <b style="color:#0F172A;">${escapeHtml(src.orgLabel || 'Организация')}:</b> ${escapeHtml(src.organization || src.authors || '')}
              </div>
              <div style="font-size:11.5px; background:#F1F5F9; padding:10px 12px; border-radius:6px; color:#0F172A; border:1px solid #E2E8F0; line-height:1.45;">
                <b style="color:#0284C7;">Применение в модели:</b> ${escapeHtml(src.application || src.note || '')}
              </div>
            </div>
          `;
        });

        html += `</div>`;
        contentEl.innerHTML = html;
        contentEl.scrollTop = 0;
        return;
      }

      if (!window.REACTOR_THEORY || !window.REACTOR_THEORY.sections) return;
      const section = window.REACTOR_THEORY.sections[tabKey];
      if (!section) return;

      let html = `
        <div class="theory-section-lead">
          <div style="font-size:10px; font-weight:700; color:#0284C7; text-transform:uppercase; margin-bottom:3px;">
            ${escapeHtml(section.badge || 'ТЕОРЕТИЧЕСКИЙ БАЗИС')}
          </div>
          <div style="font-weight:700; color:#0F172A; margin-bottom:4px; font-size:13.5px;">${escapeHtml(section.title)}</div>
          <div style="color:#64748B;">${escapeHtml(section.summary)}</div>
        </div>
      `;

      if (section.equations && section.equations.length > 0) {
        html += `<div style="font-size:11px; font-weight:700; color:#0F172A; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Математические уравнения модели</div>`;
        section.equations.forEach(eq => {
          html += `
            <div class="theory-card">
              <div class="theory-card-header">${escapeHtml(eq.name)}</div>
              <div class="theory-formula-box">${escapeHtml(eq.formula)}</div>
              <div class="theory-explanation">${escapeHtml(eq.explanation)}</div>
            </div>
          `;
        });
      }

      if (section.parameters && section.parameters.length > 0) {
        const tableTitles = {
          kinetics: "ПАРАМЕТРЫ ЗАПАЗДЫВАЮЩИХ НЕЙТРОНОВ И ВРЕМЕНИ ЖИЗНИ (В-491)",
          feedbacks: "ДИФФЕРЕНЦИАЛЬНЫЕ КОЭФФИЦИЕНТЫ И ЭФФЕКТЫ РЕАКТИВНОСТИ",
          poisoning: "ХАРАКТЕРИСТИКИ ИЗОТОПОВ И ПАРАМЕТРЫ ЙОДНОЙ ЯМЫ",
          thermohydraulics: "НОМИНАЛЬНЫЕ ЭКСПЛУАТАЦИОННЫЕ ПАРАМЕТРЫ КОНТУРОВ РУ В-491"
        };
        const titleText = section.tableTitle || tableTitles[tabKey] || "КЛЮЧЕВЫЕ ФИЗИЧЕСКИЕ ПАРАМЕТРЫ";
        html += `<div class="theory-table-title" style="font-size:11px; font-weight:700; color:#0F172A; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">${escapeHtml(titleText)}</div>`;
        html += `
          <div class="theory-table-card">
            <table class="theory-params-table">
              <thead>
                <tr>
                  <th style="width:160px;">Символ</th>
                  <th style="width:240px;">Значение</th>
                  <th>Физический смысл и размерность</th>
                </tr>
              </thead>
              <tbody>
        `;
        section.parameters.forEach(p => {
          html += `
            <tr>
              <td class="theory-param-sym">${escapeHtml(p.symbol)}</td>
              <td class="theory-param-val">${escapeHtml(p.value)}</td>
              <td class="theory-param-desc">${escapeHtml(p.desc)}</td>
            </tr>
          `;
        });
        html += `
              </tbody>
            </table>
          </div>
        `;
      }

      contentEl.innerHTML = html;
      contentEl.scrollTop = 0;
      renderMathInTheory();
    }

    // Функция обновления живых расчетных значений в открытой шторке теории (LIVE SCADA блок удален)
    function updateTheoryDrawerLiveTelemetry() {
      // Блок LIVE SCADA удален из теоретического окна в пользу строгого академического справочника
    }

    function renderTheorySources() {
      // Нижний паразитный блок первоисточников удален — первоисточники доступны во вкладке «Источники & Архивы»
    }

    function switchTheoryTab(tabKey) {
      currentTheoryTab = tabKey;
      document.querySelectorAll('.theory-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theory-tab') === tabKey);
      });
      renderTheorySection(tabKey);
      renderMathInTheory();
      sound.click(580);
    }

    // Инициализация справочника ReactorLab
    renderTheorySection('kinetics');
    renderMathInTheory();
    window.addEventListener('load', () => {
      renderMathInTheory();
    });

    // Обработчики кликов по вкладкам боковой шторки
    document.querySelectorAll('.theory-tab').forEach(btn => {
      btn.addEventListener('click', e => {
        const tabKey = e.currentTarget.getAttribute('data-theory-tab');
        if (tabKey) switchTheoryTab(tabKey);
      });
    });

    const theoryDrawerEl = document.getElementById('modalTheory') || document.getElementById('theoryDrawer');
    const theoryBackdropEl = document.getElementById('theoryBackdrop');
    const btnOpenTheoryEl = document.getElementById('btnOpenTheory');
    const btnCloseTheoryEl = document.getElementById('btnCloseTheory');

    // Инженерный режим SCADA включен постоянно (ознакомительный режим удален)
    var isEngineeringMode = true;
    window.isEngineeringMode = true;
    if (typeof sim !== 'undefined') {
      sim.eduMode = false;
      sim.isEngineeringMode = true;
    }
    const simpleTooltipEl = document.getElementById('ttSimple');
    if (simpleTooltipEl) simpleTooltipEl.style.display = 'none';

    // --- URL HASH-РОУТИНГ (#systems, #controls, #core, #model3d, #theory) ---
    const VIEW_TO_HASH = {
      systems: '#systems',
      controls: '#controls',
      core: '#core',
      '3d': '#model3d'
    };

    const HASH_TO_VIEW = {
      '#systems': 'systems',
      '#controls': 'controls',
      '#core': 'core',
      '#model3d': '3d',
      '#3d': '3d'
    };

    let lastActiveViewHash = '#systems';

    function updateUrlHash(targetHash) {
      if (window.location.hash !== targetHash) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', targetHash);
        } else {
          window.location.hash = targetHash;
        }
      }
    }

    function openTheoryDrawer(updateHash = true) {
      const modalTheory = document.getElementById('modalTheory') || theoryDrawerEl;
      if (modalTheory) modalTheory.classList.add('open');
      if (theoryBackdropEl) theoryBackdropEl.classList.add('open');
      renderMathInTheory();
      if (updateHash) {
        updateUrlHash('#theory');
      }
      sound.click(610);
    }

    function closeTheoryDrawer(restoreHash = true) {
      const modalTheory = document.getElementById('modalTheory') || theoryDrawerEl;
      if (modalTheory) modalTheory.classList.remove('open');
      if (theoryBackdropEl) theoryBackdropEl.classList.remove('open');
      if (restoreHash && (window.location.hash || '').toLowerCase() === '#theory') {
        updateUrlHash(lastActiveViewHash || '#systems');
      }
      sound.click(610);
    }

    if (btnOpenTheoryEl) {
      btnOpenTheoryEl.addEventListener('click', () => {
        if (theoryDrawerEl && theoryDrawerEl.classList.contains('open')) {
          closeTheoryDrawer(true);
        } else {
          openTheoryDrawer(true);
        }
      });
    }

    if (btnCloseTheoryEl) {
      btnCloseTheoryEl.addEventListener('click', () => closeTheoryDrawer(true));
    }

    if (theoryBackdropEl) {
      theoryBackdropEl.addEventListener('click', () => closeTheoryDrawer(true));
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && theoryDrawerEl && theoryDrawerEl.classList.contains('open')) {
        closeTheoryDrawer(true);
      }
    });

    // Подрежимы экрана [SYSTEMS]
    function setSystemsSubMode(subMode) {
      sim.systemsSubMode = subMode;
      cam.x = 0;
      cam.y = 0;
      cam.zoom = 1.0;
      document.getElementById('hudZoom').textContent = '100%';
      document.getElementById('btnSubPanorama').classList.toggle('active', subMode === 'panorama');
      document.getElementById('btnSubCross').classList.toggle('active', subMode === 'cross');
      const ribbon = document.getElementById('stagesRibbon');
      if (ribbon) ribbon.style.display = (subMode === 'panorama' && sim.viewMode === 'systems') ? 'grid' : 'none';
      sound.click(610);
    }
    document.getElementById('btnSubPanorama').addEventListener('click', () => setSystemsSubMode('panorama'));
    document.getElementById('btnSubCross').addEventListener('click', () => setSystemsSubMode('cross'));

    // Активация одного из 4 полноэкранных режимов ([СИСТЕМЫ], [УПРАВЛЕНИЕ], [АКТИВНАЯ ЗОНА], [3D МОДЕЛЬ])
    function activateViewMode(mode, options = {}) {
      const normalizedMode = VIEW_TO_HASH[mode] ? mode : 'systems';
      const shouldUpdateHash = options.updateHash !== false;

      document.querySelectorAll('.view-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.view === normalizedMode);
      });

      sim.viewMode = normalizedMode;
      lastActiveViewHash = VIEW_TO_HASH[normalizedMode] || '#systems';

      if (shouldUpdateHash) {
        if (theoryDrawerEl && theoryDrawerEl.classList.contains('open')) {
          theoryDrawerEl.classList.remove('open');
          if (theoryBackdropEl) theoryBackdropEl.classList.remove('open');
        }
        updateUrlHash(lastActiveViewHash);
      }

      cam.x = 0;
      cam.y = 0;
      cam.zoom = 1.0;
      canvasContainer.style.cursor = (normalizedMode === 'core') ? 'default' : 'grab';

      const viewportScreen = document.getElementById('viewportScreen');
      const controlsScreen = document.getElementById('controlsScreen');
      const isControls = normalizedMode === 'controls';
      const is3D = normalizedMode === '3d';
      const isSystems = normalizedMode === 'systems';
      const isCore = normalizedMode === 'core';

      controlsScreen.classList.toggle('active', isControls);
      viewportScreen.style.display = isControls ? 'none' : 'flex';

      document.getElementById('systemsSubSwitch').style.display = isSystems ? 'flex' : 'none';
      const ribbon = document.getElementById('stagesRibbon');
      if (ribbon) ribbon.style.display = (isSystems && sim.systemsSubMode === 'panorama') ? 'grid' : 'none';
      document.getElementById('canvasOverlayTop').style.display = (is3D || isCore) ? 'none' : 'flex';
      const viewCtrlEl = document.getElementById('canvasViewControls');
      if (viewCtrlEl) viewCtrlEl.style.display = isCore ? 'none' : '';
      const hudBottomEl = document.querySelector('.canvas-hud-bottom');
      if (hudBottomEl) hudBottomEl.style.display = isCore ? 'none' : 'flex';

      document.getElementById('threeContainer').style.display = is3D ? 'block' : 'none';
      document.getElementById('threeToolbar').style.display = is3D ? 'flex' : 'none';
      document.getElementById('threeHelpBadge').style.display = is3D ? 'block' : 'none';
      document.getElementById('simCanvas').style.display = is3D ? 'none' : 'block';
      tooltipEl.style.display = 'none';

      if (is3D) {
        threeCtrl.ensureInitialized();
        threeCtrl.resize();
        threeCtrl.updateHudZoom();
      } else if (!isControls) {
        document.getElementById('webglErrorBanner').style.display = 'none';
        resizeSimCanvas();
        document.getElementById('hudZoom').textContent = '100%';
        renderCanvas(0.016);
      } else {
        lastChartSampleTime = 0;
        sampleCharts(performance.now());
      }
    }

    function applyHashRoute() {
      const rawHash = (window.location.hash || '').trim().toLowerCase();
      if (rawHash === '#theory') {
        activateViewMode(sim.viewMode || 'systems', { updateHash: false });
        openTheoryDrawer(false);
        return;
      }

      if (theoryDrawerEl && theoryDrawerEl.classList.contains('open')) {
        closeTheoryDrawer(false);
      }

      const targetMode = HASH_TO_VIEW[rawHash] || 'systems';
      const canonicalHash = VIEW_TO_HASH[targetMode] || '#systems';
      activateViewMode(targetMode, { updateHash: false });
      if (rawHash !== canonicalHash && rawHash !== '#3d') {
        updateUrlHash(canonicalHash);
      }
    }

    // Главные переключатели 4 полноэкранных режимов ([СИСТЕМЫ], [УПРАВЛЕНИЕ], [АКТИВНАЯ ЗОНА], [3D МОДЕЛЬ])
    document.querySelectorAll('.view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activateViewMode(btn.dataset.view, { updateHash: true });
        sound.click(620);
      });
    });

    window.addEventListener('hashchange', applyHashRoute);
    window.addEventListener('DOMContentLoaded', applyHashRoute);
    applyHashRoute();

    function populateTooltipDOM(info, mx, my, rect) {
      tooltipEl.style.display = 'block';
      document.getElementById('ttTitle').textContent = info.title;
      document.getElementById('ttSub').textContent = info.sub;
      document.getElementById('ttDesc').textContent = info.desc;
      const simpleEl = document.getElementById('ttSimple');
      if (sim.eduMode) {
        simpleEl.style.display = 'block';
        const plain = resolvePlainText(info.title, info.simple);
        simpleEl.innerHTML = `<b>Простыми словами:</b> ${plain}`;
      } else {
        simpleEl.style.display = 'none';
      }
      document.getElementById('ttTelemetry').textContent = info.telemetry();

      let tx = mx + 16;
      let ty = my + 16;
      if (tx + 355 > rect.width) tx = Math.max(8, mx - 360);
      if (ty + 185 > rect.height) ty = Math.max(8, my - 185);
      tooltipEl.style.left = tx + 'px';
      tooltipEl.style.top = ty + 'px';
    }

    function checkHotspotHover(rect) {
      if (sim.viewMode === '3d' || sim.viewMode === 'controls') return;
      let found = null;
      for (let i = activeHotspots.length - 1; i >= 0; i--) {
        const h = activeHotspots[i];
        if (h.r) {
          const dx = cam.worldX - h.x;
          const dy = cam.worldY - h.y;
          if (dx * dx + dy * dy <= h.r * h.r) {
            found = h;
            break;
          }
        } else if (
          cam.worldX >= h.x &&
          cam.worldX <= h.x + h.w &&
          cam.worldY >= h.y &&
          cam.worldY <= h.y + h.h
        ) {
          found = h;
          break;
        }
      }

      sim.hoveredHotspot = found;
      canvasContainer.style.cursor = found && (found.onClick || found.assemblyId) ? 'pointer' : (sim.viewMode === 'core' ? 'default' : (cam.dragging ? 'grabbing' : 'grab'));

      if (found && sim.viewMode !== 'core') {
        populateTooltipDOM(found, cam.mouseX, cam.mouseY, rect);
      } else {
        tooltipEl.style.display = 'none';
      }
    }

    // 2D мнемосхемы систем (панорама, разрез, 4 петли, вспомогательные функции) вынесены в views_2d.js

        // Модуль картограммы активной зоны и паспорта ТВС вынесен в core_cartogram.js

        // 3D WebGL / Three.js модуль (threeCtrl, VVEROrbitControls, VVER_SPECS) вынесен в view_3d.js

    // ГЛАВНАЯ ФУНКЦИЯ РЕНДЕРИНГА ХОЛСТА
    function renderCanvas(dtReal = 0.016) {
      if (sim.viewMode === '3d') {
        threeCtrl.updateAndRender(dtReal);
        return;
      }
      if (sim.viewMode === 'controls') {
        return;
      }
      const rect = canvasContainer.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (simCanvas.width !== targetW || simCanvas.height !== targetH) {
        simCanvas.width = targetW;
        simCanvas.height = targetH;
        simCanvas.style.width = rect.width + 'px';
        simCanvas.style.height = rect.height + 'px';
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Строгая инженерная координатная сетка (Slate Light SCADA #64748B)
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.14)';
      ctx.lineWidth = 1;
      const isCore = (sim.viewMode === 'core');
      const curZoom = isCore ? 1.0 : cam.zoom;
      const curPanX = isCore ? 0 : cam.x;
      const curPanY = isCore ? 0 : cam.y;

      const gridStep = 36 * curZoom;
      const ox = ((curPanX % gridStep) + gridStep) % gridStep;
      const oy = ((curPanY % gridStep) + gridStep) % gridStep;
      ctx.beginPath();
      for (let x = ox; x < rect.width; x += gridStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
      }
      for (let y = oy; y < rect.height; y += gridStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
      }
      ctx.stroke();
      ctx.restore();

      const sz = getBaseSceneSize();
      const scaleFit = Math.min(rect.width / sz.w, rect.height / sz.h) * curZoom;
      const offsetX = (rect.width - sz.w * scaleFit) / 2 + curPanX;
      const offsetY = (rect.height - sz.h * scaleFit) / 2 + curPanY;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scaleFit, scaleFit);

      if (sim.viewMode === 'systems') {
        if (sim.systemsSubMode === 'panorama') {
          renderPanoramicSystemsView();
        } else {
          renderCrossSectionView();
        }
      } else if (sim.viewMode === 'core') {
        renderCoreCartogramView();
      }

      ctx.restore();
    }

    // --- 8. ОБНОВЛЕНИЕ ТЕЛЕМЕТРИИ DOM И ИНТЕРФЕЙСА БЩУ ---
    function updateDOMTelemetry() {
      const pctNom = (sim.thermalPowerMW / 3200.0) * 100.0;
      const freqHz = sim.turbineRpm / 60.0;

      const kpiThermal = document.getElementById('kpiThermal');
      if (kpiThermal) kpiThermal.textContent = `${sim.thermalPowerMW.toFixed(1)} МВт (${pctNom.toFixed(1)}%)`;
      const kpiElec = document.getElementById('kpiElec');
      if (kpiElec) kpiElec.textContent = `${sim.electricalPowerMW.toFixed(1)} МВт`;
      const kpiP1 = document.getElementById('kpiP1');
      if (kpiP1) kpiP1.textContent = `${sim.primaryPressureMPa.toFixed(2)} МПа`;
      const kpiSubcool = document.getElementById('kpiSubcool');
      if (kpiSubcool) kpiSubcool.textContent = `${sim.subcoolingMarginC.toFixed(1)} °C`;
      const kpiBoron = document.getElementById('kpiBoron');
      if (kpiBoron) kpiBoron.textContent = `${sim.boronConc.toFixed(2)} г/кг`;
      const rhoSign = sim.rhoTotal >= 0 ? '+' : '';
      const kpiReactivity = document.getElementById('kpiReactivity');
      if (kpiReactivity) kpiReactivity.textContent = `${rhoSign}${sim.rhoTotal.toFixed(1)} pcm`;
      const kpiFreq = document.getElementById('kpiFreq');
      if (kpiFreq) kpiFreq.textContent = `${freqHz.toFixed(2)} Гц`;
      const kpiP2 = document.getElementById('kpiP2');
      if (kpiP2) kpiP2.textContent = `${sim.steamHeaderPressMPa.toFixed(2)} МПа`;

      // Бейдж режима работы реактора в шапке SCADA
      const badge = document.getElementById('modeBadge');
      if (badge) {
        badge.className = 'mode-badge';
        if (sim.az1Tripped) {
          badge.textContent = 'АВАРИЙНАЯ ЗАЩИТА АЗ-1 (ОСТАНОВ)';
          badge.classList.add('danger');
        } else if (sim.saozActive) {
          badge.textContent = 'РАБОТА САОЗ (ПОДАЧА ГЕ-1..3)';
          badge.classList.add('danger');
        } else if (sim.spotActive && !sim.loops[0].pumpOn) {
          badge.textContent = 'ОБЕСТОЧИВАНИЕ • РЕЖИМ СПОТ (ЕЦ)';
          badge.classList.add('warn');
        } else if (pctNom < 5.0) {
          badge.textContent = 'МКУ (МИНИМАЛЬНО КОНТРОЛИРУЕМЫЙ УРОВЕНЬ)';
          badge.classList.add('warn');
        } else if (pctNom < 92.0) {
          badge.textContent = `ЭНЕРГЕТИЧЕСКИЙ РЕЖИМ (${pctNom.toFixed(0)}% Nном)`;
        } else {
          badge.textContent = 'НОМИНАЛЬНЫЙ РЕЖИМ (100% Nном)';
        }
      }

      // Нижний HUD баланса реактивности (на холсте СИСТЕМЫ)
      const fmtSigned = v => (v >= 0 ? '+' : '') + Math.round(v);
      const hudRhoRods = document.getElementById('hudRhoRods');
      if (hudRhoRods) hudRhoRods.textContent = fmtSigned(sim.rhoRods);
      const hudRhoBoron = document.getElementById('hudRhoBoron');
      if (hudRhoBoron) hudRhoBoron.textContent = fmtSigned(sim.rhoBoron);
      const hudRhoDoppler = document.getElementById('hudRhoDoppler');
      if (hudRhoDoppler) hudRhoDoppler.textContent = fmtSigned(sim.rhoDoppler);
      const hudRhoMod = document.getElementById('hudRhoMod');
      if (hudRhoMod) hudRhoMod.textContent = fmtSigned(sim.rhoModerator);
      const hudRhoXe = document.getElementById('hudRhoXe');
      if (hudRhoXe) hudRhoXe.textContent = fmtSigned(sim.rhoXenon);
      const hudTfuel = document.getElementById('hudTfuel');
      if (hudTfuel) hudTfuel.textContent = `${Math.round(sim.fuelTempC)} °C`;
      const hudKqMax = document.getElementById('hudKqMax');
      if (hudKqMax) hudKqMax.textContent = sim.kqMax.toFixed(2);

      // Обновление живой телеметрии в открытой шторке теории
      updateTheoryDrawerLiveTelemetry();
    }

    // --- 9. УПРАВЛЕНИЕ СКОРОСТЬЮ МОДЕЛИРОВАНИЯ ---
    document.querySelectorAll('[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const spd = parseInt(btn.dataset.speed, 10);
        sim.timeSpeed = spd;
        sim.timeScale = spd;
        document.querySelectorAll('[data-speed]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sound.click(600);
      });
    });

    // --- 10. ПРЕДУСТАНОВЛЕННЫЕ СЦЕНАРИИ И ЭКСПЛУАТАЦИОННЫЕ РЕЖИМЫ ---
    function applyScenario(scenarioKey) {
      // Сброс общих флагов
      sim.az1Tripped = false;
      sim.withdrawing1to9 = false;
      sim.boronMode = 0;
      sim.sprayActive = false;
      sim.ipuKdOpen = false;
      sim.primaryLeakActive = false;
      sim.bruKOpen = false;
      sim.bruAOpen = false;
      sim.saozActive = false;
      sim.saozWaterPct = 100.0;
      sim.spotActive = false;
      sim.ulrCoolingActive = false;

      if (scenarioKey === 'nominal') {
        sim.thermalPowerMW = 3200.0;
        sim.neutronFlux = 1.0;
        sim.precursors = 1.0;
        sim.decayHeatMW = 195.0;
        sim.group10Pos = 80.0;
        sim.groups1to9Pos = 100.0;
        sim.armEnabled = true;
        sim.armTargetMW = 3200.0;
        sim.boronConc = 6.20;
        sim.iodine135 = 1.0;
        sim.xenon135 = 1.0;
        sim.fuelTempC = 680.0;
        sim.coreInletTempC = 298.2;
        sim.coreOutletTempC = 328.9;
        sim.primaryPressureMPa = 16.20;
        sim.pressurizerLevelM = 8.40;
        sim.steamHeaderPressMPa = 7.00;
        sim.feedwaterFlowPct = 100;
        sim.turbineValvePct = 100;
        sim.electricalPowerMW = 1200.0;
        sim.loops.forEach(l => {
          l.pumpOn = true; l.rpm = 1000; l.flowPct = 100; l.tHot = 328.9; l.tCold = 298.2; l.sgLevelM = 2.10; l.sgPressMPa = 7.00;
        });
        addLog('СЦЕНАРИЙ 1: Загружен стационарный номинальный режим энергоблока ВВЭР-1200 (100% Nном — 3200 МВт тепл. / 1200 МВт электр.).', 'ok');
      } else if (scenarioKey === 'startup') {
        sim.thermalPowerMW = 96.0; // 3% МКУ
        sim.neutronFlux = 0.025;
        sim.precursors = 0.025;
        sim.decayHeatMW = 16.0;
        sim.group10Pos = 48.0;
        sim.groups1to9Pos = 100.0;
        sim.armEnabled = true;
        sim.armTargetMW = 1600.0; // Подъем до 50% мощности
        sim.boronConc = 7.35;
        sim.iodine135 = 0.08;
        sim.xenon135 = 0.08;
        sim.fuelTempC = 315.0;
        sim.coreInletTempC = 286.0;
        sim.coreOutletTempC = 288.0;
        sim.primaryPressureMPa = 15.80;
        sim.pressurizerLevelM = 7.20;
        sim.steamHeaderPressMPa = 6.75;
        sim.feedwaterFlowPct = 50;
        sim.turbineValvePct = 50;
        sim.electricalPowerMW = 35.0;
        sim.boronMode = -1; // Ввод чистого дистиллята для подъема мощности
        sim.loops.forEach(l => {
          l.pumpOn = true; l.rpm = 1000; l.flowPct = 100; l.tHot = 288.0; l.tCold = 286.0; l.sgLevelM = 2.05; l.sgPressMPa = 6.75;
        });
        addLog('СЦЕНАРИЙ 2: Выход на МКУ и подъем мощности до 1600 МВт (50% Nном). Включен ввод чистого дистиллята и АРМ.', 'info');
      } else if (scenarioKey === 'xenon') {
        sim.thermalPowerMW = 1100.0;
        sim.neutronFlux = 0.30;
        sim.precursors = 0.30;
        sim.decayHeatMW = 110.0;
        sim.group10Pos = 86.0;
        sim.groups1to9Pos = 100.0;
        sim.armEnabled = true;
        sim.armTargetMW = 960.0; // 30% Nном
        sim.boronConc = 5.45;
        sim.iodine135 = 1.25; // Высокий запас I-135 после сброса нагрузки со 100% до 30%
        sim.xenon135 = 1.48;  // Растущий пик Ксенона-135 (йодная яма)
        sim.fuelTempC = 435.0;
        sim.coreInletTempC = 291.0;
        sim.coreOutletTempC = 301.5;
        sim.primaryPressureMPa = 16.10;
        sim.pressurizerLevelM = 7.90;
        sim.steamHeaderPressMPa = 6.90;
        sim.feedwaterFlowPct = 35;
        sim.turbineValvePct = 32;
        sim.electricalPowerMW = 360.0;
        sim.boronMode = -1;
        sim.loops.forEach(l => {
          l.pumpOn = true; l.rpm = 1000; l.flowPct = 100; l.tHot = 301.5; l.tCold = 291.0; l.sgLevelM = 2.10; l.sgPressMPa = 6.90;
        });
        addLog('СЦЕНАРИЙ 3: Ксеноновый переходный процесс (разгрузка со 100% до 30% Nном). Удерживайте критичность разбавлением борной кислоты!', 'warn');
      } else if (scenarioKey === 'blackout') {
        // Полное обесточивание энергоблока: останов всех 4 ГЦНА, срабатывание АЗ-1, открытие шиберов СПОТ
        sim.thermalPowerMW = 215.0;
        sim.neutronFlux = 0.002;
        sim.precursors = 0.01;
        sim.decayHeatMW = 208.0;
        sim.az1Tripped = true;
        sim.group10Pos = 0.0;
        sim.groups1to9Pos = 0.0;
        sim.armEnabled = false;
        sim.boronConc = 6.80;
        sim.fuelTempC = 335.0;
        sim.coreInletTempC = 292.0;
        sim.coreOutletTempC = 319.5;
        sim.primaryPressureMPa = 15.65;
        sim.pressurizerLevelM = 7.80;
        sim.steamHeaderPressMPa = 6.85;
        sim.feedwaterFlowPct = 0;
        sim.turbineValvePct = 0;
        sim.electricalPowerMW = 0.0;
        sim.spotActive = true;
        sim.loops.forEach(l => {
          l.pumpOn = false; l.rpm = 180; l.flowPct = 8.5; l.tHot = 319.5; l.tCold = 292.0; l.sgLevelM = 1.98; l.sgPressMPa = 6.85;
        });
        addLog('СЦЕНАРИЙ 4: Полное обесточивание энергоблока! Отключены ГЦНА-1..4 и ПЭН, сработала АЗ-1. Установлена естественная циркуляция в 4 петлях и отвод тепла через СПОТ.', 'warn');
      } else if (scenarioKey === 'loca') {
        // Течь 1-го контура, падение давления P1, автоматическое срабатывание ГЕ САОЗ и охлаждение УЛР
        sim.thermalPowerMW = 185.0;
        sim.neutronFlux = 0.001;
        sim.precursors = 0.005;
        sim.decayHeatMW = 182.0;
        sim.az1Tripped = true;
        sim.group10Pos = 0.0;
        sim.groups1to9Pos = 0.0;
        sim.armEnabled = false;
        sim.boronConc = 10.50;
        sim.fuelTempC = 328.0;
        sim.coreInletTempC = 258.0;
        sim.coreOutletTempC = 276.0;
        sim.primaryPressureMPa = 5.45;
        sim.pressurizerLevelM = 3.60;
        sim.steamHeaderPressMPa = 5.60;
        sim.feedwaterFlowPct = 15;
        sim.turbineValvePct = 0;
        sim.electricalPowerMW = 0.0;
        sim.primaryLeakActive = true;
        sim.saozActive = true;
        sim.spotActive = true;
        sim.ulrCoolingActive = true;
        sim.loops.forEach(l => {
          l.pumpOn = false; l.rpm = 0; l.flowPct = 7.5; l.tHot = 276.0; l.tCold = 258.0; l.sgLevelM = 2.02; l.sgPressMPa = 5.60;
        });
        addLog('СЦЕНАРИЙ 5: Тест пассивных систем безопасности В-491 (течь 1-го контура). Открыты обратные клапаны гидроемкостей САОЗ ГЕ-1..3, СПОТ и охлаждение шахты УЛР!', 'danger');
      }
    }

    const scenarioSelect = document.getElementById('scenarioSelect');
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', e => {
        applyScenario(e.target.value);
        sound.click(640);
      });
    }

    // --- 11. ГЛАВНЫЙ ЦИКЛ СИМУЛЯЦИИ (60 FPS) ---
    let lastFrameTime = performance.now();

    function mainLoop(now) {
      const dtReal = (now - lastFrameTime) / 1000.0;
      lastFrameTime = now;

      stepPhysics(dtReal);
      updateDOMTelemetry();
      sampleCharts(now);
      renderCanvas(dtReal);
      sound.updateContinuous();

      requestAnimationFrame(mainLoop);
    }

    window.onload = function () {
      applyHashRoute();
      resizeSimCanvas();
      addLog('Система верхнего блочного уровня БЩУ ВВЭР-1200 (проект В-491, БелАЭС) успешно инициализирована.', 'ok');
      addLog('Энергоблок работает в стационарном номинальном режиме: Nтепл = 3200 МВт, Nэлектр = 1200 МВт, P₁ = 16,2 МПа, Гр.10 ОР СУЗ = 80%.', 'info');
      requestAnimationFrame(mainLoop);
    };

// -----------------------------------------------------------------------------
// ЯВНЫЙ ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ WINDOW
// -----------------------------------------------------------------------------
window.sound = typeof sound !== 'undefined' ? sound : null;
window.cam = typeof cam !== 'undefined' ? cam : null;
window.simCanvas = typeof simCanvas !== 'undefined' ? simCanvas : null;
window.ctx = typeof ctx !== 'undefined' ? ctx : null;
window.canvasContainer = typeof canvasContainer !== 'undefined' ? canvasContainer : null;
window.tooltipEl = typeof tooltipEl !== 'undefined' ? tooltipEl : null;
window.activeHotspots = typeof activeHotspots !== 'undefined' ? activeHotspots : null;
window.addLog = typeof addLog !== 'undefined' ? addLog : null;
window.setSystemsSubMode = typeof setSystemsSubMode !== 'undefined' ? setSystemsSubMode : null;
window.activateViewMode = typeof activateViewMode !== 'undefined' ? activateViewMode : null;
window.applyHashRoute = typeof applyHashRoute !== 'undefined' ? applyHashRoute : null;
window.renderCanvas = typeof renderCanvas !== 'undefined' ? renderCanvas : null;
window.updateDOMTelemetry = typeof updateDOMTelemetry !== 'undefined' ? updateDOMTelemetry : null;
window.applyScenario = typeof applyScenario !== 'undefined' ? applyScenario : null;
window.mainLoop = typeof mainLoop !== 'undefined' ? mainLoop : null;
