// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-392М)
// main.js — Главный диспетчер UI, обработчики событий, звук, телеметрия и mainLoop
// ============================================================================

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

    document.getElementById('btnClearLog').addEventListener('click', () => {
      eventLogEl.innerHTML = '';
      addLog('Оперативный журнал БЩУ очищен оператором.', 'info');
    });

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
    coreAssemblies.forEach(a => {
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
      if (sim.viewMode === 'systems' && sim.systemsSubMode === 'panorama') {
        return { w: 1360, h: 720 };
      }
      return { w: 1160, h: 720 };
    }

    function resizeSimCanvas() {
      const r = canvasContainer.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const dpr = window.devicePixelRatio || 1;
      simCanvas.width = Math.floor(r.width * dpr);
      simCanvas.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
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

    function renderTheorySection(tabKey) {
      const contentEl = document.getElementById('theoryDrawerContent');
      if (!contentEl) return;

      if (tabKey === 'sources') {
        let html = `
          <div class="theory-section-lead" style="border-left-color:#15803d;">
            <div style="font-size:10px; font-weight:700; color:#15803d; text-transform:uppercase; font-family:var(--font-mono); margin-bottom:3px;">
              АКАДЕМИЧЕСКАЯ БАЗА & АРХИВЫ БЩУ
            </div>
            <div style="font-weight:700; color:#0f172a; margin-bottom:4px; font-size:12.5px;">
              📚 Первоисточники, Нормативная База и Видеоматериалы БЩУ
            </div>
            <div>
              Фундаментальные учебники МИФИ, технологический регламент серийного энергоблока Нововоронежской АЭС-2 (В-392М), стандарты безопасности МАГАТЭ и обучающие видеокурсы работы операторов на полномасштабном тренажере.
            </div>
          </div>

          <div style="font-size:10.5px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin-top:6px;">
            1. Обучающие видеоматериалы и видеоразбор работы БЩУ
          </div>

          <div class="theory-card" style="border-left:3px solid #dc2626; background:#ffffff;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="theory-badge" style="color:#dc2626;">ВИДЕОКУРС // ПОЛНОМАСШТАБНЫЙ ТРЕНАЖЕР БЩУ</span>
              <span style="font-size:9.5px; background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:3px; font-weight:600;">ПМТ В-392М</span>
            </div>
            <div style="font-weight:700; color:#0f172a; font-size:12px; margin-top:2px;">
              Видеоразбор работы оперативного персонала блочного щита управления (ВИУР, ВИУТ, НСБ)
            </div>
            <div style="font-size:11px; line-height:1.45; color:#334155;">
              Практический видеокурс учебно-тренировочного центра АЭС: разбор эргономики пультов операторов ВВЭР-1200, работы с мнемосхемой 4 петель ГЦК, процедур компенсации нестационарного ксенонового отравления при маневрировании мощностью и регламентов парирования нештатных ситуаций (малые течи 1-го контура, обесточивание с вводом пассивного расхолаживания СПОТ).
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; padding:8px 10px; font-size:10.5px; color:#475569; display:flex; flex-direction:column; gap:4px;">
              <div><b>Состав видеоразбора:</b></div>
              <div>• <b>Пульт ВИУР:</b> управление 121 кластером ОР СУЗ, рабочей группой №10 (АРМ), контроль подкритичности и расчетного периода разгона T.</div>
              <div>• <b>Пульт ВИУТ:</b> поддержание уровней в парогенераторах ПГВ-1000МКП, ведение турбоагрегата К-1200-6,8/50 и питательных насосов ПЭН.</div>
              <div>• <b>Мнемосхема систем безопасности:</b> контроль гидроемкостей САОЗ, шиберов СПОТ и охлаждения шахты ловушки расплава УЛР.</div>
            </div>
            <div style="margin-top:6px;">
              <a href="https://www.rosatom.ru/about-nuclear-industry/" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:6px; background:#dc2626; color:#ffffff; padding:7px 14px; border-radius:4px; text-decoration:none; font-size:11px; font-weight:600;">
                ▶ Смотреть видеоразбор и медиаархив тренажера
              </a>
            </div>
          </div>

          <div style="font-size:10.5px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin-top:6px;">
            2. Академические учебники и регламентная литература
          </div>
        `;

        if (window.REACTOR_THEORY && window.REACTOR_THEORY.primarySources) {
          window.REACTOR_THEORY.primarySources.filter(s => s.type !== 'video_archive').forEach((src, idx) => {
            html += `
              <div class="theory-card" style="border-left:3px solid #1d4ed8;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="theory-badge">${src.id === 'dementiev' ? 'БИБЛИОТЕКА МИФИ' : (src.id === 'nvaes_reglament' ? 'РЕГЛАМЕНТ РОСЭНЕРГОАТОМА' : (src.id === 'iaea_ssg54' ? 'СТАНДАРТ МАГАТЭ' : 'ТЕХНИЧЕСКИЙ УЧЕБНИК'))}</span>
                  <span style="font-size:9.5px; color:#64748b; font-family:var(--font-mono);">№0${idx + 1}</span>
                </div>
                <div style="font-weight:700; color:#0f172a; font-size:11.5px; margin-top:2px;">
                  ${escapeHtml(src.author)} «${escapeHtml(src.title)}»
                </div>
                <div style="font-size:10.5px; color:#475569;">
                  ${escapeHtml(src.details)}
                </div>
                <div style="font-size:10.5px; background:#f1f5f9; padding:6px 8px; border-radius:3px; color:#1e40af; border:1px solid #cbd5e1; margin-top:3px;">
                  <b>Область применения в ReactorLab:</b> ${escapeHtml(src.scope)}
                </div>
              </div>
            `;
          });
        }

        contentEl.innerHTML = html;
        contentEl.scrollTop = 0;
        return;
      }

      if (!window.REACTOR_THEORY || !window.REACTOR_THEORY.sections) return;
      const section = window.REACTOR_THEORY.sections[tabKey];
      if (!section) return;

      let html = `
        <div class="theory-section-lead">
          <div style="font-size:10px; font-weight:700; color:#1d4ed8; text-transform:uppercase; font-family:var(--font-mono); margin-bottom:3px;">
            ${escapeHtml(section.badge || 'ТЕОРЕТИЧЕСКИЙ БАЗИС')}
          </div>
          <div style="font-weight:700; color:#0f172a; margin-bottom:4px; font-size:12.5px;">${escapeHtml(section.title)}</div>
          <div>${escapeHtml(section.summary)}</div>
        </div>
      `;

      if (section.equations && section.equations.length > 0) {
        html += `<div style="font-size:10.5px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Математические уравнения модели</div>`;
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

      // Живая расчетная плашка параметров реактора для текущего раздела
      if (tabKey === 'kinetics') {
        html += `
          <div class="theory-live-panel">
            <div class="theory-live-header">
              <span class="theory-live-indicator"></span>
              <span>ТЕКУЩИЕ ПАРАМЕТРЫ РЕАКТОРА (LIVE SCADA)</span>
            </div>
            <div class="theory-live-grid">
              <div class="theory-live-item">
                <span class="theory-live-lbl">Суммарная реактивность ρ</span>
                <span id="liveRhoTotal" class="theory-live-val">0.0 pcm</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Эффективная доля β_эфф</span>
                <span id="liveBetaEff" class="theory-live-val">0.0065 (650 pcm)</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Период разгона T</span>
                <span id="livePeriodT" class="theory-live-val">∞ (Стационар)</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Относительный поток Φ</span>
                <span id="liveNeutronFlux" class="theory-live-val">100.0%</span>
              </div>
            </div>
          </div>
        `;
      } else if (tabKey === 'feedbacks') {
        html += `
          <div class="theory-live-panel">
            <div class="theory-live-header">
              <span class="theory-live-indicator"></span>
              <span>ТЕКУЩИЕ ПАРАМЕТРЫ РЕАКТОРА (LIVE SCADA)</span>
            </div>
            <div class="theory-live-grid">
              <div class="theory-live-item">
                <span class="theory-live-lbl">Доплер топлива (ρ_dop)</span>
                <span id="liveRhoDoppler" class="theory-live-val">0.0 pcm</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Температура топлива T_f</span>
                <span id="liveFuelTemp" class="theory-live-val">680.0 °C</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Замедлитель (ρ_mod)</span>
                <span id="liveRhoModerator" class="theory-live-val">0.0 pcm</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Ср. температура воды T_m</span>
                <span id="liveModTemp" class="theory-live-val">313.6 °C</span>
              </div>
              <div class="theory-live-item full-width">
                <span class="theory-live-lbl">Суммарный температурный дефект (ρ_dop + ρ_mod)</span>
                <span id="liveRhoFeedbackTotal" class="theory-live-val">0.0 pcm (Отрицательный демпфер)</span>
              </div>
            </div>
          </div>
        `;
      } else if (tabKey === 'poisoning') {
        html += `
          <div class="theory-live-panel">
            <div class="theory-live-header">
              <span class="theory-live-indicator"></span>
              <span>ТЕКУЩИЕ ПАРАМЕТРЫ РЕАКТОРА (LIVE SCADA)</span>
            </div>
            <div class="theory-live-grid">
              <div class="theory-live-item">
                <span class="theory-live-lbl">Отравление Xe-135 (ρ_xe)</span>
                <span id="liveRhoXenon" class="theory-live-val">0.0 pcm</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Концентрация Xe-135</span>
                <span id="liveXeConc" class="theory-live-val">1.000 отн. ед.</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Концентрация I-135</span>
                <span id="liveIConc" class="theory-live-val">1.000 отн. ед.</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Потенциал ямы при останове</span>
                <span id="livePitDepth" class="theory-live-val">-1650 pcm</span>
              </div>
              <div class="theory-live-item full-width">
                <span class="theory-live-lbl">Запас до дна йодной ямы (ОЗР)</span>
                <span id="liveXenonMargin" class="theory-live-val">+5800 pcm (ОЗР стабилен)</span>
              </div>
            </div>
          </div>
        `;
      } else if (tabKey === 'thermohydraulics') {
        html += `
          <div class="theory-live-panel">
            <div class="theory-live-header">
              <span class="theory-live-indicator"></span>
              <span>ТЕКУЩИЕ ПАРАМЕТРЫ РЕАКТОРА (LIVE SCADA)</span>
            </div>
            <div class="theory-live-grid">
              <div class="theory-live-item">
                <span class="theory-live-lbl">Тепловая мощность 1 контура Q₁</span>
                <span id="liveThermalQ1" class="theory-live-val">3200.0 МВт</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Паропроизводительность 2 контура</span>
                <span id="liveSteamFlow" class="theory-live-val">6400 т/ч</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Давление контуров P₁ / P₂</span>
                <span id="livePressures" class="theory-live-val">16.20 / 7.00 МПа</span>
              </div>
              <div class="theory-live-item">
                <span class="theory-live-lbl">Запас до кипения (Subcooling)</span>
                <span id="liveSubcooling" class="theory-live-val">19.5 °C</span>
              </div>
            </div>
          </div>
        `;
      }

      if (section.parameters && section.parameters.length > 0) {
        html += `<div style="font-size:10.5px; font-weight:700; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Ключевые физические параметры и константы</div>`;
        html += `
          <table class="theory-params-table">
            <thead>
              <tr>
                <th style="width:80px;">Символ</th>
                <th style="width:130px;">Значение</th>
                <th>Физический смысл</th>
              </tr>
            </thead>
            <tbody>
        `;
        section.parameters.forEach(p => {
          html += `
            <tr>
              <td class="theory-param-sym">${escapeHtml(p.symbol)}</td>
              <td class="theory-param-val">${escapeHtml(p.value)}</td>
              <td>${escapeHtml(p.desc)}</td>
            </tr>
          `;
        });
        html += `
            </tbody>
          </table>
        `;
      }

      if (section.description) {
        html += `
          <div style="font-size:11px; line-height:1.45; color:#334155; background:#f1f5f9; border-radius:4px; padding:10px; border:1px solid #cbd5e1;">
            <b style="color:#0f172a;">Инженерное примечание:</b> ${escapeHtml(section.description)}
          </div>
        `;
      }

      contentEl.innerHTML = html;
      contentEl.scrollTop = 0;
      updateTheoryDrawerLiveTelemetry();
    }

    // Функция обновления живых расчетных значений в открытой шторке теории
    function updateTheoryDrawerLiveTelemetry() {
      const drawer = document.getElementById('theoryDrawer');
      if (!drawer || !drawer.classList.contains('open')) return;

      if (currentTheoryTab === 'kinetics') {
        const elRho = document.getElementById('liveRhoTotal');
        const elBeta = document.getElementById('liveBetaEff');
        const elPeriod = document.getElementById('livePeriodT');
        const elFlux = document.getElementById('liveNeutronFlux');

        if (elRho) {
          const rhoVal = sim.rhoTotal;
          elRho.textContent = (rhoVal >= 0 ? '+' : '') + rhoVal.toFixed(1) + ' pcm';
          elRho.style.color = Math.abs(rhoVal) < 2 ? '#15803d' : (rhoVal > 0 ? '#b91c1c' : '#1d4ed8');
        }
        if (elBeta) elBeta.textContent = '0.0065 (650 pcm)';
        if (elPeriod) {
          if (Math.abs(sim.rhoTotal) < 0.2) {
            elPeriod.textContent = '∞ (Стационар)';
            elPeriod.style.color = '#15803d';
          } else if (sim.rhoTotal > 0) {
            const rhoFrac = sim.rhoTotal * 1e-5;
            const p = (0.0065 - rhoFrac) / (0.085 * rhoFrac + 3.5e-5);
            elPeriod.textContent = p > 9999 ? '> 9999 с' : (p.toFixed(1) + ' с');
            elPeriod.style.color = p < 20 ? '#b91c1c' : '#b45309';
          } else {
            const rhoFrac = sim.rhoTotal * 1e-5;
            const p = (0.0065 - rhoFrac) / (0.085 * rhoFrac - 3.5e-5);
            elPeriod.textContent = p < -9999 ? '< -9999 с' : (p.toFixed(1) + ' с');
            elPeriod.style.color = '#1d4ed8';
          }
        }
        if (elFlux) elFlux.textContent = (sim.neutronFlux * 100).toFixed(1) + ' %';
      } else if (currentTheoryTab === 'feedbacks') {
        const elDop = document.getElementById('liveRhoDoppler');
        const elFuelT = document.getElementById('liveFuelTemp');
        const elMod = document.getElementById('liveRhoModerator');
        const elModT = document.getElementById('liveModTemp');
        const elFbTot = document.getElementById('liveRhoFeedbackTotal');

        if (elDop) {
          elDop.textContent = (sim.rhoDoppler >= 0 ? '+' : '') + sim.rhoDoppler.toFixed(1) + ' pcm';
          elDop.style.color = sim.rhoDoppler <= 0 ? '#15803d' : '#b45309';
        }
        if (elFuelT) elFuelT.textContent = sim.fuelTempC.toFixed(1) + ' °C';
        if (elMod) {
          elMod.textContent = (sim.rhoModerator >= 0 ? '+' : '') + sim.rhoModerator.toFixed(1) + ' pcm';
          elMod.style.color = sim.rhoModerator <= 0 ? '#15803d' : '#b45309';
        }
        if (elModT) {
          const avgT = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
          elModT.textContent = avgT.toFixed(1) + ' °C';
        }
        if (elFbTot) {
          const fbTot = sim.rhoDoppler + sim.rhoModerator;
          elFbTot.textContent = (fbTot >= 0 ? '+' : '') + fbTot.toFixed(1) + ' pcm';
          elFbTot.style.color = fbTot <= 0 ? '#15803d' : '#b45309';
        }
      } else if (currentTheoryTab === 'poisoning') {
        const elRhoXe = document.getElementById('liveRhoXenon');
        const elXe = document.getElementById('liveXeConc');
        const elI = document.getElementById('liveIConc');
        const elPit = document.getElementById('livePitDepth');
        const elMargin = document.getElementById('liveXenonMargin');

        if (elRhoXe) {
          elRhoXe.textContent = (sim.rhoXenon >= 0 ? '+' : '') + sim.rhoXenon.toFixed(1) + ' pcm';
          elRhoXe.style.color = sim.rhoXenon < -500 ? '#b91c1c' : '#0f172a';
        }
        if (elXe) elXe.textContent = sim.xenon135.toFixed(3) + ' отн. ед.';
        if (elI) elI.textContent = sim.iodine135.toFixed(3) + ' отн. ед.';
        const pitDepthPcm = Math.round(1650 * sim.iodine135);
        if (elPit) elPit.textContent = `-${pitDepthPcm} pcm`;
        if (elMargin) {
          const marginPcm = Math.round(6500 + (sim.group10Pos / 100) * 950 - pitDepthPcm);
          elMargin.textContent = `${marginPcm > 0 ? '+' : ''}${marginPcm} pcm (${marginPcm > 0 ? 'ОЗР достаточен' : 'СТОЯНКА В ЯМЕ!'})`;
          elMargin.style.color = marginPcm > 0 ? '#15803d' : '#b91c1c';
        }
      } else if (currentTheoryTab === 'thermohydraulics') {
        const elQ1 = document.getElementById('liveThermalQ1');
        const elSteam = document.getElementById('liveSteamFlow');
        const elPress = document.getElementById('livePressures');
        const elSub = document.getElementById('liveSubcooling');

        if (elQ1) elQ1.textContent = `${sim.thermalPowerMW.toFixed(1)} МВт (${((sim.thermalPowerMW / 3200) * 100).toFixed(1)}%)`;
        if (elSteam) {
          const steamTh = (sim.thermalPowerMW / 3200.0) * 6400.0;
          elSteam.textContent = `${Math.round(steamTh)} т/ч (${Math.round(steamTh / 3.6)} кг/с)`;
        }
        if (elPress) {
          elPress.textContent = `P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа / P₂: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`;
        }
        if (elSub) {
          elSub.textContent = `ΔTs = ${sim.subcoolingMarginC.toFixed(1)} °C (${sim.subcoolingMarginC > 10 ? 'DNBR > 1.30' : 'КРИЗИС!'})`;
          elSub.style.color = sim.subcoolingMarginC > 10 ? '#15803d' : '#b91c1c';
        }
      }
    }

    function renderTheorySources() {
      if (!window.REACTOR_THEORY || !window.REACTOR_THEORY.primarySources) return;
      const listEl = document.getElementById('theorySourcesList');
      if (!listEl) return;

      let html = '';
      window.REACTOR_THEORY.primarySources.forEach((src, idx) => {
        html += `
          <div class="theory-source-item">
            <div class="theory-source-title">${idx + 1}. ${escapeHtml(src.author)} «${escapeHtml(src.title)}»</div>
            <div style="font-size:10px; color:#475569; margin-top:2px;">${escapeHtml(src.details)}</div>
            ${src.scope ? `<div style="font-size:9.5px; color:#1d4ed8; margin-top:2px; font-family:var(--font-mono);">Применение: ${escapeHtml(src.scope)}</div>` : ''}
          </div>
        `;
      });
      listEl.innerHTML = html;
    }

    function switchTheoryTab(tabKey) {
      currentTheoryTab = tabKey;
      document.querySelectorAll('.theory-tab').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theory-tab') === tabKey);
      });
      renderTheorySection(tabKey);
      sound.click(580);
    }

    // Инициализация справочника ReactorLab
    renderTheorySection('kinetics');
    renderTheorySources();

    // Обработчики кликов по вкладкам боковой шторки
    document.querySelectorAll('.theory-tab').forEach(btn => {
      btn.addEventListener('click', e => {
        const tabKey = e.currentTarget.getAttribute('data-theory-tab');
        if (tabKey) switchTheoryTab(tabKey);
      });
    });

    const theoryDrawerEl = document.getElementById('theoryDrawer');
    const theoryBackdropEl = document.getElementById('theoryBackdrop');
    const btnOpenTheoryEl = document.getElementById('btnOpenTheory');
    const btnCloseTheoryEl = document.getElementById('btnCloseTheory');
    const btnAcademicToggleEl = document.getElementById('btnAcademicToggle');

    function openTheoryDrawer() {
      if (theoryDrawerEl) theoryDrawerEl.classList.add('open');
      if (theoryBackdropEl) theoryBackdropEl.classList.add('open');
      sound.click(610);
    }

    function closeTheoryDrawer() {
      if (theoryDrawerEl) theoryDrawerEl.classList.remove('open');
      if (theoryBackdropEl) theoryBackdropEl.classList.remove('open');
      sound.click(610);
    }

    if (btnOpenTheoryEl) {
      btnOpenTheoryEl.addEventListener('click', () => {
        if (theoryDrawerEl && theoryDrawerEl.classList.contains('open')) {
          closeTheoryDrawer();
        } else {
          openTheoryDrawer();
        }
      });
    }

    if (btnCloseTheoryEl) {
      btnCloseTheoryEl.addEventListener('click', closeTheoryDrawer);
    }

    if (theoryBackdropEl) {
      theoryBackdropEl.addEventListener('click', closeTheoryDrawer);
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && theoryDrawerEl && theoryDrawerEl.classList.contains('open')) {
        closeTheoryDrawer();
      }
    });

    // Переключатель между ознакомительным и инженерным режимом
    var isEngineeringMode = false;
    window.isEngineeringMode = isEngineeringMode;

    if (btnAcademicToggleEl) {
      btnAcademicToggleEl.addEventListener('click', () => {
        isEngineeringMode = !isEngineeringMode;
        sim.isEngineeringMode = isEngineeringMode;
        window.isEngineeringMode = isEngineeringMode;

        if (isEngineeringMode) {
          // Инженерный режим: строгий синий индикатор со значком атома, появление кнопки теории
          btnAcademicToggleEl.classList.add('engineering-mode');
          const label = btnAcademicToggleEl.querySelector('.mode-label');
          if (label) label.textContent = '⚛ Режим: Инженерный';
          if (btnOpenTheoryEl) btnOpenTheoryEl.style.display = 'inline-flex';

          sim.eduMode = false;
          document.body.classList.remove('edu-enabled');

          console.log('ReactorLab: Математический модуль и инженерный базис ВВЭР-1200 готовы к работе.');
          console.log('ReactorLab: Активен инженерный режим SCADA [В-392М]. Справочник доступен через кнопку «📐 Инженерный базис».');
          addLog('Инженерный режим активен: развернут академический базис кинетики и IAPWS-IF97.', 'info');
        } else {
          // Ознакомительный режим (по умолчанию): зеленый бейдж, подсказки, кнопка теории скрыта
          btnAcademicToggleEl.classList.remove('engineering-mode');
          const label = btnAcademicToggleEl.querySelector('.mode-label');
          if (label) label.textContent = '🌱 Режим: Ознакомительный';
          if (btnOpenTheoryEl) btnOpenTheoryEl.style.display = 'none';

          closeTheoryDrawer();

          sim.eduMode = true;
          document.body.classList.add('edu-enabled');
          addLog('Включен ознакомительный режим: активированы пояснения понятным языком.', 'info');
        }

        const simpleEl = document.getElementById('ttSimple');
        if (simpleEl) simpleEl.style.display = sim.eduMode ? 'block' : 'none';
        sound.click(640);
      });
    }

    // Подрежимы экрана [SYSTEMS]
    function setSystemsSubMode(subMode) {
      sim.systemsSubMode = subMode;
      cam.x = 0;
      cam.y = 0;
      cam.zoom = 1.0;
      document.getElementById('hudZoom').textContent = '100%';
      document.getElementById('btnSubPanorama').classList.toggle('active', subMode === 'panorama');
      document.getElementById('btnSubLoops').classList.toggle('active', subMode === 'loops');
      document.getElementById('btnSubCross').classList.toggle('active', subMode === 'cross');
      const ribbon = document.getElementById('stagesRibbon');
      if (ribbon) ribbon.style.display = (subMode === 'panorama' && sim.viewMode === 'systems') ? 'grid' : 'none';
      sound.click(610);
    }
    document.getElementById('btnSubPanorama').addEventListener('click', () => setSystemsSubMode('panorama'));
    document.getElementById('btnSubLoops').addEventListener('click', () => setSystemsSubMode('loops'));
    document.getElementById('btnSubCross').addEventListener('click', () => setSystemsSubMode('cross'));

    // Главные переключатели 4 полноэкранных режимов ([SYSTEMS], [CONTROLS], [CORE], [3D TWIN])
    document.querySelectorAll('.view-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.view;
        sim.viewMode = mode;
        cam.x = 0;
        cam.y = 0;
        cam.zoom = 1.0;
        canvasContainer.style.cursor = (mode === 'core') ? 'default' : 'grab';

        const viewportScreen = document.getElementById('viewportScreen');
        const controlsScreen = document.getElementById('controlsScreen');
        const isControls = mode === 'controls';
        const is3D = mode === '3d';
        const isSystems = mode === 'systems';

        controlsScreen.classList.toggle('active', isControls);
        viewportScreen.style.display = isControls ? 'none' : 'flex';

        document.getElementById('systemsSubSwitch').style.display = isSystems ? 'flex' : 'none';
        const ribbon = document.getElementById('stagesRibbon');
        if (ribbon) ribbon.style.display = (isSystems && sim.systemsSubMode === 'panorama') ? 'grid' : 'none';
        document.getElementById('canvasOverlayTop').style.display = is3D ? 'none' : 'flex';
        const viewCtrlEl = document.getElementById('canvasViewControls');
        if (viewCtrlEl) viewCtrlEl.style.display = (mode === 'core') ? 'none' : '';
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
        } else {
          // Перерисовка мини-графиков на экране [CONTROLS]
          lastChartSampleTime = 0;
          sampleCharts(performance.now());
        }
        sound.click(620);
      });
    });

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

      if (found) {
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
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Строгая инженерная координатная сетка
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
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
        } else if (sim.systemsSubMode === 'loops') {
          renderFourLoopsPlanView();
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

      document.getElementById('kpiThermal').textContent = `${sim.thermalPowerMW.toFixed(1)} МВт (${pctNom.toFixed(1)}%)`;
      document.getElementById('kpiElec').textContent = `${sim.electricalPowerMW.toFixed(1)} МВт`;
      document.getElementById('kpiP1').textContent = `${sim.primaryPressureMPa.toFixed(2)} МПа`;
      document.getElementById('kpiSubcool').textContent = `${sim.subcoolingMarginC.toFixed(1)} °C`;
      document.getElementById('kpiBoron').textContent = `${sim.boronConc.toFixed(2)} г/кг`;
      const rhoSign = sim.rhoTotal >= 0 ? '+' : '';
      document.getElementById('kpiReactivity').textContent = `${rhoSign}${sim.rhoTotal.toFixed(1)} pcm`;
      document.getElementById('kpiFreq').textContent = `${freqHz.toFixed(2)} Гц`;
      document.getElementById('kpiP2').textContent = `${sim.steamHeaderPressMPa.toFixed(2)} МПа`;

      // Телеметрия Поста №2 (Турбина и Сеть)
      document.getElementById('post2ElecMW').textContent = `${sim.electricalPowerMW.toFixed(1)} МВт`;
      document.getElementById('post2FreqRpm').textContent = `${freqHz.toFixed(2)} Гц (${Math.round(sim.turbineRpm)} об/мин)`;
      document.getElementById('post2SteamState').textContent = `${sim.steamHeaderPressMPa.toFixed(2)} МПа / ${sim.steamTempC.toFixed(1)} °C`;
      document.getElementById('post2BruState').textContent = (sim.bruKOpen || sim.bruAOpen)
        ? `ОТКРЫТ: ${sim.bruKOpen ? 'БРУ-К ' : ''}${sim.bruAOpen ? 'БРУ-А' : ''}`
        : 'Клапаны закрыты';

      // Бейдж режима работы реактора
      const badge = document.getElementById('modeBadge');
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

      // Диагностика 4 петель ГЦК
      for (let i = 0; i < 4; i++) {
        const lp = sim.loops[i];
        const card = document.getElementById(`loopCard${i}`);
        const dot = document.getElementById(`loopDot${i}`);
        card.classList.toggle('off', !lp.pumpOn);
        dot.className = 'status-dot ' + (lp.pumpOn ? '' : 'off');
        document.getElementById(`l${i}_rpm`).textContent = `${Math.round(lp.rpm)} об/м`;
        document.getElementById(`l${i}_psg`).textContent = `${lp.sgPressMPa.toFixed(2)} МПа`;
        document.getElementById(`l${i}_th`).textContent = `${lp.tHot.toFixed(1)} °C`;
        document.getElementById(`l${i}_tc`).textContent = `${lp.tCold.toFixed(1)} °C`;
        document.getElementById(`l${i}_lvl`).textContent = `${lp.sgLevelM.toFixed(2)} м`;
        document.getElementById(`l${i}_flw`).textContent = `${lp.flowPct.toFixed(0)} %`;
      }

      // Нижний HUD баланса реактивности
      const fmtSigned = v => (v >= 0 ? '+' : '') + Math.round(v);
      document.getElementById('hudRhoRods').textContent = fmtSigned(sim.rhoRods);
      document.getElementById('hudRhoBoron').textContent = fmtSigned(sim.rhoBoron);
      document.getElementById('hudRhoDoppler').textContent = fmtSigned(sim.rhoDoppler);
      document.getElementById('hudRhoMod').textContent = fmtSigned(sim.rhoModerator);
      document.getElementById('hudRhoXe').textContent = fmtSigned(sim.rhoXenon);
      document.getElementById('hudTfuel').textContent = `${Math.round(sim.fuelTempC)} °C`;
      document.getElementById('hudKqMax').textContent = sim.kqMax.toFixed(2);

      // Синхронизация элементов управления
      document.getElementById('valGroup10').textContent = `${sim.group10Pos.toFixed(1)} %`;
      document.getElementById('sliderGroup10').value = sim.group10Pos;
      document.getElementById('valGroups19').textContent = `${sim.groups1to9Pos.toFixed(1)} %`;
      document.getElementById('valPressurizer').textContent = `${sim.pressurizerLevelM.toFixed(2)} м / ${sim.heatersPowerKW} кВт`;
      document.getElementById('valSAOZ').textContent = sim.saozActive
        ? `ПОДАЧА В РЕАКТОР (${sim.saozWaterPct.toFixed(0)}%)`
        : 'Ожидание (P₁ < 5.9 МПа)';
      document.getElementById('valULR').textContent = sim.ulrCoolingActive
        ? 'ОХЛАЖДЕНИЕ ШАХТЫ ВКЛ'
        : 'Сухая шахта (Норма)';

      // Обновление живой телеметрии в открытой шторке теории
      updateTheoryDrawerLiveTelemetry();
    }

    // --- 9. ОБРАБОТЧИКИ МОДУЛЬНОГО ПУЛЬТА УПРАВЛЕНИЯ [CONTROLS] ---
    document.getElementById('sliderGroup10').addEventListener('input', e => {
      if (sim.az1Tripped) return;
      sim.group10Pos = parseFloat(e.target.value);
      if (sim.armEnabled) {
        sim.armEnabled = false;
        const btn = document.getElementById('btnARM');
        btn.classList.remove('active');
        btn.textContent = 'АРМ: РУЧНОЙ';
        addLog('Автоматический регулятор мощности (АРМ) переведен в ручной режим оператором.', 'info');
      }
    });

    document.querySelectorAll('[data-rodstep]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (sim.az1Tripped) {
          addLog('Перемещение ОР СУЗ заблокировано сигналом АЗ-1! Выполните деблокировку АЗ-1.', 'warn');
          return;
        }
        const step = parseFloat(btn.dataset.rodstep);
        sim.group10Pos = Math.max(0, Math.min(100, sim.group10Pos + step));
        sound.click(580);
      });
    });

    document.getElementById('btnWithdraw19').addEventListener('click', () => {
      if (sim.az1Tripped) {
        addLog('Невозможно поднять группы №1–9 при активном сигнале АЗ-1! Сначала нажмите «Деблокировка АЗ-1».', 'warn');
        return;
      }
      sim.withdrawing1to9 = true;
      addLog('Начат плавный подъем групп ОР СУЗ №1–9 приводами ШЭМ-3 до верхнего концевика (100%).', 'info');
      sound.click(640);
    });

    document.getElementById('btnARM').addEventListener('click', e => {
      if (sim.az1Tripped) return;
      sim.armEnabled = !sim.armEnabled;
      e.currentTarget.classList.toggle('active', sim.armEnabled);
      e.currentTarget.textContent = sim.armEnabled ? 'АРМ: ВКЛЮЧЕН' : 'АРМ: РУЧНОЙ';
      addLog(sim.armEnabled ? `Включен Автоматический регулятор мощности (АРМ). Уставка: ${sim.armTargetMW} МВт.` : 'АРМ отключен. Управление группой №10 ОР СУЗ переведено в ручной режим.', 'info');
      sound.click(600);
    });

    document.getElementById('sliderArmTarget').addEventListener('input', e => {
      sim.armTargetMW = parseFloat(e.target.value);
      document.getElementById('valArmTarget').textContent = `${sim.armTargetMW} МВт`;
    });

    const btnBoronInject = document.getElementById('btnBoronInject');
    const btnBoronDilute = document.getElementById('btnBoronDilute');
    const valBoronFlow = document.getElementById('valBoronFlow');

    btnBoronInject.addEventListener('click', () => {
      sim.boronMode = sim.boronMode === 1 ? 0 : 1;
      btnBoronInject.classList.toggle('warn-active', sim.boronMode === 1);
      btnBoronDilute.classList.remove('active');
      valBoronFlow.textContent = sim.boronMode === 1 ? 'Ввод бора (+H₃BO₃)' : 'Нейтрально';
      if (sim.boronMode === 1) addLog('СБР: Открыт клапан подачи концентрата борной кислоты H₃BO₃ в 1-й контур.', 'warn');
      sound.click(510);
    });

    btnBoronDilute.addEventListener('click', () => {
      sim.boronMode = sim.boronMode === -1 ? 0 : -1;
      btnBoronDilute.classList.toggle('active', sim.boronMode === -1);
      btnBoronInject.classList.remove('warn-active');
      valBoronFlow.textContent = sim.boronMode === -1 ? 'Разбавление (Дистиллят)' : 'Нейтрально';
      if (sim.boronMode === -1) addLog('СБР: Открыта подача чистого дистиллята на подпитку 1-го контура (разбавление бора).', 'info');
      sound.click(590);
    });

    document.querySelectorAll('[data-pump]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.pump, 10);
        sim.loops[idx].pumpOn = !sim.loops[idx].pumpOn;
        btn.classList.toggle('active', sim.loops[idx].pumpOn);
        addLog(`ГЦНА-${idx + 1} (Петля №${idx + 1}): ${sim.loops[idx].pumpOn ? 'ВКЛЮЧЕН в работу' : 'ОТКЛЮЧЕН (переход петли на выбег и естественную циркуляцию)'}.`, sim.loops[idx].pumpOn ? 'ok' : 'warn');
        sound.click(480);
      });
    });

    document.getElementById('btnHeatersMode').addEventListener('click', e => {
      const modes = ['AUTO', 'ON', 'OFF'];
      const labels = { AUTO: 'ТЭНы КД: АВТО', ON: 'ТЭНы КД: ВКЛ 2700', OFF: 'ТЭНы КД: ВЫКЛ' };
      const nextIdx = (modes.indexOf(sim.heatersMode) + 1) % modes.length;
      sim.heatersMode = modes[nextIdx];
      e.currentTarget.textContent = labels[sim.heatersMode];
      e.currentTarget.classList.toggle('active', sim.heatersMode !== 'OFF');
      sound.click(550);
    });

    document.getElementById('btnSprayKD').addEventListener('click', e => {
      sim.sprayActive = !sim.sprayActive;
      e.currentTarget.classList.toggle('active', sim.sprayActive);
      addLog(sim.sprayActive ? 'КД: Открыт клапан впрыска холодного теплоносителя в паровую подушку КД.' : 'КД: Клапан впрыска в КД закрыт.', 'info');
      sound.click(560);
    });

    document.getElementById('btnIpuKD').addEventListener('click', e => {
      sim.ipuKdOpen = !sim.ipuKdOpen;
      e.currentTarget.dataset.manual = sim.ipuKdOpen ? '1' : '';
      e.currentTarget.classList.toggle('danger-active', sim.ipuKdOpen);
      addLog(sim.ipuKdOpen ? 'КД: Принудительно открыт импульсный предохранительный клапан ИПУ КД (сброс пара в барботажный бак)!' : 'КД: Клапан ИПУ КД закрыт.', sim.ipuKdOpen ? 'warn' : 'info');
      sound.click(500);
    });

    document.getElementById('btnLeakLoop1').addEventListener('click', e => {
      sim.primaryLeakActive = !sim.primaryLeakActive;
      e.currentTarget.classList.toggle('danger-active', sim.primaryLeakActive);
      addLog(sim.primaryLeakActive ? 'ВНИМАНИЕ! Зафиксирована разгерметизация (течь) 1-го контура в Петле №1! Снижение давления P₁.' : 'Течь 1-го контура локализована и устранена.', sim.primaryLeakActive ? 'danger' : 'ok');
      sound.click(420);
    });

    document.getElementById('sliderFeedwater').addEventListener('input', e => {
      sim.feedwaterFlowPct = parseFloat(e.target.value);
      document.getElementById('valFeedwater').textContent = `${sim.feedwaterFlowPct} %`;
    });

    document.getElementById('sliderTurbineValve').addEventListener('input', e => {
      sim.turbineValvePct = parseFloat(e.target.value);
      document.getElementById('valTurbineValve').textContent = `${sim.turbineValvePct} %`;
    });

    document.querySelectorAll('[data-turbpreset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.turbpreset);
        sim.turbineValvePct = val;
        document.getElementById('sliderTurbineValve').value = val;
        document.getElementById('valTurbineValve').textContent = `${val} %`;
        addLog(`Турбина К-1200-6,8/50: Клапан впуска пара (РК) установлен на ${val}%.`, 'info');
        sound.click(560);
      });
    });

    document.getElementById('btnBruK').addEventListener('click', e => {
      sim.bruKOpen = !sim.bruKOpen;
      e.currentTarget.classList.toggle('active', sim.bruKOpen);
      addLog(sim.bruKOpen ? '2-й контур: Открыт клапан БРУ-К (сброс пара из ГПК в конденсатор турбины).' : '2-й контур: Клапан БРУ-К закрыт.', 'info');
      sound.click(530);
    });

    document.getElementById('btnBruA').addEventListener('click', e => {
      sim.bruAOpen = !sim.bruAOpen;
      e.currentTarget.classList.toggle('warn-active', sim.bruAOpen);
      addLog(sim.bruAOpen ? '2-й контур: Открыты клапаны БРУ-А (сброс пара в атмосферу)!' : '2-й контур: Клапаны БРУ-А закрыты.', sim.bruAOpen ? 'warn' : 'info');
      sound.click(530);
    });

    document.getElementById('btnTriggerSAOZ').addEventListener('click', e => {
      sim.saozActive = !sim.saozActive;
      e.currentTarget.classList.toggle('active', sim.saozActive);
      addLog(sim.saozActive ? 'Ручной пуск гидроемкостей САОЗ ГЕ-1, ГЕ-2, ГЕ-3! Подача раствора борной кислоты (16 г/кг) в реактор.' : 'Клапаны гидроемкостей САОЗ закрыты.', sim.saozActive ? 'warn' : 'info');
      sound.click(490);
    });

    document.getElementById('btnToggleSPOT').addEventListener('click', e => {
      sim.spotActive = !sim.spotActive;
      e.currentTarget.classList.toggle('active', sim.spotActive);
      e.currentTarget.textContent = sim.spotActive ? 'Шиберы СПОТ: ОТКР' : 'Шиберы СПОТ: ЗАКР';
      addLog(sim.spotActive ? 'Открыты воздушные шиберы СПОТ (Система пассивного отвода тепла через теплообменники защитной оболочки).' : 'Шиберы СПОТ переведены в положение ожидания.', 'ok');
      sound.click(540);
    });

    document.getElementById('btnFloodULR').addEventListener('click', e => {
      sim.ulrCoolingActive = !sim.ulrCoolingActive;
      e.currentTarget.classList.toggle('active', sim.ulrCoolingActive);
      addLog(sim.ulrCoolingActive ? 'Открыта подача охлаждающей воды из баков ГА-1 в шахту Устройства локализации расплава (УЛР).' : 'Подача воды в шахту УЛР прекращена.', 'info');
      sound.click(520);
    });

    document.getElementById('btnAzCover').addEventListener('click', e => {
      sim.az1CoverOpen = !sim.az1CoverOpen;
      e.currentTarget.classList.toggle('open', sim.az1CoverOpen);
      e.currentTarget.textContent = sim.az1CoverOpen ? 'Закрыть крышку' : 'Откинуть крышку';
      document.getElementById('az1Shield').classList.toggle('lifted', sim.az1CoverOpen);
      sound.click(440);
    });

    document.getElementById('btnTriggerAZ1').addEventListener('click', () => {
      if (!sim.az1CoverOpen) return;
      triggerAZ1('Ручное нажатие кнопки АЗ-1 оператором БЩУ');
    });

    document.getElementById('btnResetAZ1').addEventListener('click', () => {
      if (!sim.az1Tripped) {
        addLog('Сигнал АЗ-1 отсутствует. Деблокировка не требуется.', 'info');
        return;
      }
      sim.az1Tripped = false;
      addLog('Сигнал АЗ-1 деблокирован оператором. Приводы ШЭМ-3 готовы к подъему групп ОР СУЗ.', 'ok');
      sound.click(680);
    });

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

      // Сброс визуального состояния кнопок
      btnBoronInject.classList.remove('warn-active');
      btnBoronDilute.classList.remove('active');
      valBoronFlow.textContent = 'Нейтрально';
      document.getElementById('btnSprayKD').classList.remove('active');
      document.getElementById('btnIpuKD').classList.remove('danger-active');
      document.getElementById('btnLeakLoop1').classList.remove('danger-active');
      document.getElementById('btnBruK').classList.remove('active');
      document.getElementById('btnBruA').classList.remove('warn-active');
      document.getElementById('btnTriggerSAOZ').classList.remove('active');
      document.getElementById('btnToggleSPOT').classList.remove('active');
      document.getElementById('btnToggleSPOT').textContent = 'Шиберы СПОТ: ЗАКР';
      document.getElementById('btnFloodULR').classList.remove('active');

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
        sim.loops.forEach((l, i) => {
          l.pumpOn = true; l.rpm = 1000; l.flowPct = 100; l.tHot = 328.9; l.tCold = 298.2; l.sgLevelM = 2.10; l.sgPressMPa = 7.00;
          document.getElementById(`btnPump${i}`).classList.add('active');
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
        sim.boronMode = -1; // Включен ввод дистиллята для компенсации подъема мощности
        btnBoronDilute.classList.add('active');
        valBoronFlow.textContent = 'Разбавление (Дистиллят)';
        sim.loops.forEach((l, i) => {
          l.pumpOn = true; l.rpm = 1000; l.flowPct = 100; l.tHot = 288.0; l.tCold = 286.0; l.sgLevelM = 2.05; l.sgPressMPa = 6.75;
          document.getElementById(`btnPump${i}`).classList.add('active');
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
        btnBoronDilute.classList.add('active');
        valBoronFlow.textContent = 'Разбавление (Дистиллят)';
        sim.loops.forEach((l, i) => {
          l.pumpOn = true; l.rpm = 1000; l.flowPct = 100; l.tHot = 301.5; l.tCold = 291.0; l.sgLevelM = 2.10; l.sgPressMPa = 6.90;
          document.getElementById(`btnPump${i}`).classList.add('active');
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
        document.getElementById('btnToggleSPOT').classList.add('active');
        document.getElementById('btnToggleSPOT').textContent = 'Шиберы СПОТ: ОТКР';
        sim.loops.forEach((l, i) => {
          l.pumpOn = false; l.rpm = 180; l.flowPct = 8.5; l.tHot = 319.5; l.tCold = 292.0; l.sgLevelM = 1.98; l.sgPressMPa = 6.85;
          document.getElementById(`btnPump${i}`).classList.remove('active');
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
        document.getElementById('btnLeakLoop1').classList.add('danger-active');
        document.getElementById('btnTriggerSAOZ').classList.add('active');
        document.getElementById('btnToggleSPOT').classList.add('active');
        document.getElementById('btnToggleSPOT').textContent = 'Шиберы СПОТ: ОТКР';
        document.getElementById('btnFloodULR').classList.add('active');
        sim.loops.forEach((l, i) => {
          l.pumpOn = false; l.rpm = 0; l.flowPct = 7.5; l.tHot = 276.0; l.tCold = 258.0; l.sgLevelM = 2.02; l.sgPressMPa = 5.60;
          document.getElementById(`btnPump${i}`).classList.remove('active');
        });
        addLog('СЦЕНАРИЙ 5: Тест пассивных систем безопасности В-392М (течь 1-го контура). Открыты обратные клапаны гидроемкостей САОЗ ГЕ-1..3, СПОТ и охлаждение шахты УЛР!', 'danger');
      }

      // Синхронизируем ползунки с новыми значениями сценария
      document.getElementById('sliderArmTarget').value = sim.armTargetMW;
      document.getElementById('valArmTarget').textContent = `${sim.armTargetMW} МВт`;
      document.getElementById('sliderFeedwater').value = sim.feedwaterFlowPct;
      document.getElementById('valFeedwater').textContent = `${sim.feedwaterFlowPct} %`;
      document.getElementById('sliderTurbineValve').value = sim.turbineValvePct;
      document.getElementById('valTurbineValve').textContent = `${sim.turbineValvePct} %`;
      const btnArm = document.getElementById('btnARM');
      btnArm.classList.toggle('active', sim.armEnabled);
      btnArm.textContent = sim.armEnabled ? 'АРМ: ВКЛЮЧЕН' : 'АРМ: ОТКЛ';
    }

    document.getElementById('scenarioSelect').addEventListener('change', e => {
      applyScenario(e.target.value);
      sound.click(640);
    });

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
      resizeSimCanvas();
      addLog('Система верхнего блочного уровня БЩУ ВВЭР-1200 (проект В-392М) успешно инициализирована.', 'ok');
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
window.renderCanvas = typeof renderCanvas !== 'undefined' ? renderCanvas : null;
window.updateDOMTelemetry = typeof updateDOMTelemetry !== 'undefined' ? updateDOMTelemetry : null;
window.applyScenario = typeof applyScenario !== 'undefined' ? applyScenario : null;
window.mainLoop = typeof mainLoop !== 'undefined' ? mainLoop : null;
