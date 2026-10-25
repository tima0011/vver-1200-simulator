// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-392М)
// core_cartogram.js — Картограмма активной зоны 163 ТВС и паспорт кассеты ТВС-2М
// ============================================================================

// --- 1. ГЕНЕРАЦИЯ ГЕОМЕТРИИ АКТИВНОЙ ЗОНЫ 163 ТВС (ТОЧНАЯ РЕШЕТКА ВВЭР-1200) ---
var coreAssemblies = [];
    (function buildAuthentic163Core() {
      // В осевых гексагональных координатах (q, r) условие q^2 + r^2 + q*r <= 43
      // дает СТРОГО 163 шестигранных ТВС с идеальной симметрией 60 градусов ВВЭР-1200!
      // А условие q^2 + r^2 + q*r <= 31 дает СТРОГО 121 ТВС с кластерами ОР СУЗ!
      let idCounter = 1;
      for (let r = -7; r <= 7; r++) {
        for (let q = -7; q <= 7; q++) {
          const distSq = q * q + r * r + q * r;
          if (distSq <= 43) {
            const hasRod = distSq <= 31;
            let rodGroup = 0;
            if (hasRod) {
              // Распределяем 121 кластер ОР СУЗ по 10 группам симметрично радиусу
              if (distSq === 0) rodGroup = 10; // Центральная ТВС
              else if (distSq === 7 || distSq === 21) rodGroup = 10; // Рабочая группа №10 (13 кластеров)
              else if (distSq === 1) rodGroup = 1;
              else if (distSq === 3) rodGroup = 2;
              else if (distSq === 4) rodGroup = 3;
              else if (distSq === 9) rodGroup = 4;
              else if (distSq === 12) rodGroup = 5;
              else if (distSq === 13) rodGroup = 6;
              else if (distSq === 16 || distSq === 19) rodGroup = 7;
              else if (distSq === 25 || distSq === 27) rodGroup = 8;
              else rodGroup = 9;
            }
            // Профиль обогащения ТВС-2М по 235U (от 3.6% в центре до 4.95% на периферии для выравнивания поля)
            const normR = Math.sqrt(distSq / 43);
            const enrichment = distSq >= 36 ? 4.95 : (distSq >= 19 ? 4.40 : 3.95);
            // Базовый коэффициент неравномерности энерговыделения Kq (плавный радиальный поток нейтронов)
            const baseKq = +(1.22 - 0.38 * Math.pow(normR, 2.0)).toFixed(3);

            coreAssemblies.push({
              id: idCounter++,
              q,
              r,
              distSq,
              normR,
              hasRod,
              rodGroup,
              enrichment,
              baseKq,
              currentKq: baseKq,
              outletTemp: 328.9,
              powerMW: 3200 / 163
            });
          }
        }
      }

      // Реалистичная схема 3-годичной кампании топлива и теплового поля СВРК ВВЭР-1200:
      //  - Непрерывный спад потока нейтронов от центра (~1.22) к выгородке (~0.84)
      //  - Мягкая вариация выгорания (+- 0.03...0.05) вместо ступенчатого шума
      //  - Локальное плавное затенение от введенных стержней СУЗ (рабочая группа №10: -0.10...-0.15)
      const kqHash = (q, r, salt) => {
        const s = Math.sin(q * 127.1 + r * 311.7 + salt * 74.7) * 43758.5453;
        return s - Math.floor(s);
      };
      const loadPosSet = new Set(coreAssemblies.map(a => a.q + ',' + a.r));
      const loadDirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
      const g10PosSet = new Set(coreAssemblies.filter(a => a.rodGroup === 10).map(a => a.q + ',' + a.r));

      coreAssemblies.forEach(a => {
        const onBelt = loadDirs.some(d => !loadPosSet.has((a.q + d[0]) + ',' + (a.r + d[1])));
        let year;
        if (onBelt) {
          year = 3;
        } else {
          const c = (((a.q - a.r) % 3) + 3) % 3;
          if (c === 0) year = 1;
          else if (c === 1) year = 2;
          else year = (((a.q % 2) + 2) % 2 === 0) ? 1 : 2;
        }

        // 1. Базовое непрерывное нейтронное поле (радиальный спад от центра 1.22 к выгородке 0.84)
        const radialFlux = 1.22 - 0.38 * Math.pow(a.normR, 2.0);

        // 2. Мягкая вариация выгорания (+- 0.03...0.05)
        const burnupDelta = (year === 1 ? +0.035 : (year === 3 ? -0.035 : 0.005)) +
                            (kqHash(a.q, a.r, 7) - 0.5) * 0.02;

        // 3. Локальное плавное затенение стержней СУЗ (группа №10: -0.10...-0.15)
        let rodDepression = 0;
        if (a.rodGroup === 10) {
          rodDepression = -0.11;
        } else if (loadDirs.some(d => g10PosSet.has((a.q + d[0]) + ',' + (a.r + d[1])))) {
          rodDepression = -0.03;
        }

        const kq = +(radialFlux + burnupDelta + rodDepression).toFixed(3);

        a.campaignYear = year;
        a.enrichment = year === 1 ? 4.95 : (year === 2 ? 4.40 : 3.95);
        a.baseKq = kq;
        a.currentKq = kq;
      });
      window.coreAssemblies = coreAssemblies;
    })();

// ============================================================================
    // РЕЖИМ [CORE]: 2D ГЕКСАГОНАЛЬНАЯ КАРТОГРАММА 163 ТВС С ПРОФИЛЕМ ВЫГОРАНИЯ И ПАСПОРТОМ
    // ============================================================================
    // --- Тепловая палитра картограммы (SCADA): четыре четких диапазона Kq ---
    // --- Плавная тепловая палитра картограммы (СВРК / LERP) ---
    const CORE_KQ_MIN = 0.82;
    const CORE_KQ_MAX = 1.30;

    // Ключевые физические опоры градиента поля энерговыделения:
    //  * Kq <= 0.88: холодный матовый стальной (#334155)
    //  * Kq = 1.00:  спокойный титаново-серый (#64748b)
    //  * Kq = 1.15:  благородный теплый янтарь (#d97706)
    //  * Kq >= 1.25: глубокий карминово-красный (#b91c1c)
    const CORE_HEAT_STOPS = [
      { kq: 0.88, r: 0x33, g: 0x41, b: 0x55 }, // #334155
      { kq: 1.00, r: 0x64, g: 0x74, b: 0x8b }, // #64748b
      { kq: 1.15, r: 0xd9, g: 0x77, b: 0x06 }, // #d97706
      { kq: 1.25, r: 0xb9, g: 0x1c, b: 0x1c }  // #b91c1c
    ];

    function getCoreHeatRgb(kq) {
      if (kq <= CORE_HEAT_STOPS[0].kq) {
        const s = CORE_HEAT_STOPS[0];
        return [s.r, s.g, s.b];
      }
      const last = CORE_HEAT_STOPS[CORE_HEAT_STOPS.length - 1];
      if (kq >= last.kq) {
        return [last.r, last.g, last.b];
      }
      for (let i = 0; i < CORE_HEAT_STOPS.length - 1; i++) {
        const s0 = CORE_HEAT_STOPS[i];
        const s1 = CORE_HEAT_STOPS[i + 1];
        if (kq <= s1.kq) {
          const t = Math.max(0, Math.min(1, (kq - s0.kq) / (s1.kq - s0.kq)));
          const r = Math.round(s0.r + (s1.r - s0.r) * t);
          const g = Math.round(s0.g + (s1.g - s0.g) * t);
          const b = Math.round(s0.b + (s1.b - s0.b) * t);
          return [r, g, b];
        }
      }
      return [last.r, last.g, last.b];
    }

    function coreHeatColor(kq) {
      const [r, g, b] = getCoreHeatRgb(kq);
      return `rgb(${r},${g},${b})`;
    }

    function coreHeatTextColor(kq) {
      const [r, g, b] = getCoreHeatRgb(kq);
      // Адаптивная яркость (ITU-R BT.601 / WCAG):
      // белый #ffffff на темных/красных/синих (lum < 125), темный #0f172a на светлом янтаре (lum >= 125)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return lum >= 125 ? '#0f172a' : '#ffffff';
    }

    function coreHeatBand(kq) {
      return {
        color: coreHeatColor(kq),
        text: coreHeatTextColor(kq)
      };
    }

    function coreWrapText(c, text, x, y, maxW, lineH) {
      const words = text.split(' ');
      let line = '';
      let yy = y;
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (c.measureText(test).width > maxW && line) {
          c.fillText(line, x, yy);
          line = w;
          yy += lineH;
        } else {
          line = test;
        }
      });
      if (line) {
        c.fillText(line, x, yy);
        yy += lineH;
      }
      return yy;
    }

    function renderCoreCartogramView() {
      activeHotspots = window.activeHotspots || [];
      activeHotspots.length = 0;
      window.activeHotspots = activeHotspots;
      const isEngineeringMode = (typeof window !== 'undefined' && window.isEngineeringMode !== undefined)
        ? window.isEngineeringMode
        : (typeof sim !== 'undefined' && sim ? sim.isEngineeringMode : false);
      // Центрирование картограммы строго посередине левой рабочей области (базовый холст 1160x720)
      const centerX = 355;
      const centerY = 352;
      const hexR = 19.4;
      const sqrt3 = Math.sqrt(3);
      const MONO = 'Consolas, "Courier New", monospace';
      const SANS = '"Segoe UI", Roboto, sans-serif';
      const TWO_PI = Math.PI * 2;

      // Индексы ряда (R) и колонки (C) каждой ТВС для паспорта (вычисляются один раз)
      if (coreAssemblies[0].rowIdx === undefined) {
        const rowCounters = {};
        coreAssemblies.forEach(a => {
          rowCounters[a.r] = (rowCounters[a.r] || 0) + 1;
          a.rowIdx = a.r + 8;
          a.colIdx = rowCounters[a.r];
        });
      }

      const cells = coreAssemblies.map(a => ({
        a,
        x: centerX + hexR * sqrt3 * (a.q + a.r / 2),
        y: centerY + hexR * 1.5 * a.r
      }));

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 13.5px ${SANS}`;
      ctx.fillText('КАРТОГРАММА АКТИВНОЙ ЗОНЫ ВВЭР-1200 (163 ТВС-2М • 121 КЛАСТЕР ОР СУЗ)', 75, 22);

      // ---------------------------------------------------------------------
      // КОРПУС РЕАКТОРА, ШАХТА И ВЫГОРОДКА (снаружи внутрь)
      // ---------------------------------------------------------------------
      const R_FILL = 244;     // пространство между выгородкой и обечайкой шахты
      const R_BARREL = 252;   // внешний радиус обечайки шахты (корзины)
      const R_DOWN = 264;     // внешний радиус опускного зазора
      const R_VESSEL = 274;   // внешний радиус стенки корпуса
      const R_FLANGE = 298;   // внешний радиус фланца
      const R_STUD = 286;     // окружность шпилек главного разъема

      // Фланец корпуса (конструкционная сталь, радиальный металлический градиент)
      const flangeGrad = ctx.createRadialGradient(centerX, centerY, R_VESSEL, centerX, centerY, R_FLANGE);
      flangeGrad.addColorStop(0, '#64748b');
      flangeGrad.addColorStop(0.45, '#a3b0c2');
      flangeGrad.addColorStop(1, '#475569');
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_FLANGE, 0, TWO_PI);
      ctx.arc(centerX, centerY, R_VESSEL, 0, TWO_PI, true);
      ctx.fillStyle = flangeGrad;
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_FLANGE, 0, TWO_PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_VESSEL, 0, TWO_PI);
      ctx.stroke();

      // 54 шпильки главного уплотнения
      for (let i = 0; i < 54; i++) {
        const ang = (i / 54) * TWO_PI - Math.PI / 2;
        const sx = centerX + R_STUD * Math.cos(ang);
        const sy = centerY + R_STUD * Math.sin(ang);
        ctx.beginPath();
        ctx.arc(sx, sy, 2.3, 0, TWO_PI);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 0.9, 0, TWO_PI);
        ctx.fillStyle = '#334155';
        ctx.fill();
      }

      // Стенка корпуса
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_VESSEL, 0, TWO_PI);
      ctx.arc(centerX, centerY, R_DOWN, 0, TWO_PI, true);
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Кольцевой опускной зазор (теплоноситель холодных ниток)
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_DOWN, 0, TWO_PI);
      ctx.arc(centerX, centerY, R_BARREL, 0, TWO_PI, true);
      ctx.fillStyle = '#dbeafe';
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Обечайка шахты (корзина активной зоны)
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_BARREL, 0, TWO_PI);
      ctx.arc(centerX, centerY, R_FILL, 0, TWO_PI, true);
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Внутренняя полость шахты вокруг выгородки
      ctx.beginPath();
      ctx.arc(centerX, centerY, R_FILL, 0, TWO_PI);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Риски направлений 4 петель ГЦК на внешнем фланце + стрелки входа в опускной зазор
      // (азимут отсчитывается по часовой стрелке от верхней точки)
      const loopMarks = [
        { deg: 0, label: '0° (П1)' },
        { deg: 90, label: '90° (П2)' },
        { deg: 180, label: '180° (П3)' },
        { deg: 270, label: '270° (П4)' }
      ];
      loopMarks.forEach((m, i) => {
        const ang = (m.deg - 90) * Math.PI / 180;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const lp = sim.loops[i];
        const loopCol = lp.pumpOn ? '#1d4ed8' : '#b45309';

        // стрелка потока (вход в опускной зазор, направление к оси реактора)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(R_BARREL + 1.5, 0);
        ctx.lineTo(R_DOWN - 1.5, -4.2);
        ctx.lineTo(R_DOWN - 1.5, 4.2);
        ctx.closePath();
        ctx.fillStyle = loopCol;
        ctx.fill();
        ctx.restore();

        // тонкая риска на внешнем краю фланца
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(centerX + (R_FLANGE - 7) * cosA, centerY + (R_FLANGE - 7) * sinA);
        ctx.lineTo(centerX + (R_FLANGE + 9) * cosA, centerY + (R_FLANGE + 9) * sinA);
        ctx.stroke();

        // микро-подпись (на боковых рисках повернута вдоль касательной)
        ctx.save();
        ctx.translate(centerX + (R_FLANGE + 14) * cosA, centerY + (R_FLANGE + 14) * sinA);
        if (m.deg === 90) ctx.rotate(Math.PI / 2);
        else if (m.deg === 270) ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#64748b';
        ctx.font = `9px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.label, 0, 0);
        ctx.restore();
      });

      // Выгородка (baffle): стальная грань, повторяющая ступенчатый контур 163 ТВС
      const coreSet = new Set(coreAssemblies.map(a => a.q + ',' + a.r));
      const hexDirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
      const baffleSegs = [];
      cells.forEach(c => {
        for (let k = 0; k < 6; k++) {
          if (!coreSet.has((c.a.q + hexDirs[k][0]) + ',' + (c.a.r + hexDirs[k][1]))) {
            const a1 = (Math.PI / 180) * (60 * k - 30);
            const a2 = (Math.PI / 180) * (60 * k + 30);
            baffleSegs.push([
              c.x + hexR * Math.cos(a1), c.y + hexR * Math.sin(a1),
              c.x + hexR * Math.cos(a2), c.y + hexR * Math.sin(a2)
            ]);
          }
        }
      });
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      [[17, '#1e293b'], [12, '#64748b'], [5, '#a3b0c2']].forEach(st => {
        ctx.beginPath();
        baffleSegs.forEach(s => {
          ctx.moveTo(s[0], s[1]);
          ctx.lineTo(s[2], s[3]);
        });
        ctx.lineWidth = st[0];
        ctx.strokeStyle = st[1];
        ctx.stroke();
      });
      ctx.restore();

      // ---------------------------------------------------------------------
      // 163 ТВС: плавная заливка по Kq + хит-тест
      // ---------------------------------------------------------------------
      const hexPath = (x, y, R) => {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI / 180) * (60 * k - 30);
          const vx = x + R * Math.cos(ang);
          const vy = y + R * Math.sin(ang);
          if (k === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      };

      cells.forEach(c => {
        const a = c.a;
        const x = c.x;
        const y = c.y;
        const kq = a.currentKq;
        const textCol = coreHeatTextColor(kq);

        hexPath(x, y, hexR - 0.6);
        ctx.fillStyle = coreHeatColor(kq);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (a.hasRod) {
          ctx.beginPath();
          ctx.arc(x, y - 8, 2.5, 0, TWO_PI);
          if (a.rodGroup === 10) {
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1;
          } else {
            ctx.strokeStyle = textCol;
            ctx.lineWidth = 1.1;
          }
          ctx.stroke();
        }

        ctx.fillStyle = textCol;
        ctx.font = `bold 9.2px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillText(kq.toFixed(2), x, a.hasRod ? y + 8 : y + 3.6);
        ctx.textAlign = 'left';

        const rodPos = a.hasRod ? (a.rodGroup === 10 ? sim.group10Pos : sim.groups1to9Pos) : null;
        activeHotspots.push({
          x, y, r: hexR * 0.866,
          assemblyId: a.id,
          title: `Тепловыделяющая сборка ТВС-2М №${a.id}`,
          sub: `Позиция R-${String(a.rowIdx).padStart(2, '0')}, C-${String(a.colIdx).padStart(2, '0')} • Обогащение ²³⁵U: ${a.enrichment}% • ${a.campaignYear}-й год (${a.burnupMWd} МВт·сут/кгU)`,
          desc: a.hasRod
            ? `Оснащена кластером поглощающих стержней ОР СУЗ (Группа №${a.rodGroup}${a.rodGroup === 10 ? ' — Рабочая группа АРМ' : ''}).`
            : 'Периферийная ТВС без привода ОР СУЗ с профилированным обогащением топлива.',
          simple: plainExplanations.tvs,
          telemetry: () => `Kq: ${a.currentKq.toFixed(3)} | Выгорание: ${a.burnupMWd} МВт·сут/кгU | Nтвс: ${a.powerMW.toFixed(2)} МВт | Tвых: ${a.outletTemp.toFixed(1)} °C${a.hasRod ? ` | СУЗ: ${rodPos.toFixed(1)}%` : ''}`
        });
      });

      // Подсветка наведенной и выбранной кассеты (поверх соседей, видна на любой заливке)
      cells.forEach(c => {
        const isHovered = sim.hoveredHotspot && sim.hoveredHotspot.assemblyId === c.a.id;
        if (isHovered && sim.selectedAssemblyId !== c.a.id) {
          hexPath(c.x, c.y, hexR - 0.6);
          ctx.strokeStyle = '#0ea5e9';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      });
      cells.forEach(c => {
        if (sim.selectedAssemblyId === c.a.id) {
          hexPath(c.x, c.y, hexR - 0.6);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 3.6;
          ctx.stroke();
          hexPath(c.x, c.y, hexR - 0.6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      // ---------------------------------------------------------------------
      // ЛЕГЕНДА: плавная шкала Kq (непрерывный градиент СВРК)
      // ---------------------------------------------------------------------
      const legX0 = 84;
      const legX1 = 336;
      const legBarY = 658;
      const legBarH = 12;
      const legMin = 0.84;
      const legMax = 1.28;
      const legScale = (v) => legX0 + ((v - legMin) / (legMax - legMin)) * (legX1 - legX0);

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText('ШКАЛА Kq', 18, legBarY + 9);

      // Непрерывный градиент шкалы СВРК
      const legGrad = ctx.createLinearGradient(legX0, 0, legX1, 0);
      legGrad.addColorStop(0, coreHeatColor(legMin));
      legGrad.addColorStop(Math.max(0, Math.min(1, (0.88 - legMin) / (legMax - legMin))), '#334155');
      legGrad.addColorStop(Math.max(0, Math.min(1, (1.00 - legMin) / (legMax - legMin))), '#64748b');
      legGrad.addColorStop(Math.max(0, Math.min(1, (1.15 - legMin) / (legMax - legMin))), '#d97706');
      legGrad.addColorStop(Math.max(0, Math.min(1, (1.25 - legMin) / (legMax - legMin))), '#b91c1c');
      legGrad.addColorStop(1, coreHeatColor(legMax));

      ctx.fillStyle = legGrad;
      ctx.fillRect(legX0, legBarY, legX1 - legX0, legBarH);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(legX0, legBarY, legX1 - legX0, legBarH);

      // Риски и подписи ключевых уровней Kq
      const legTicks = [
        { v: 0.88, label: '0.88' },
        { v: 1.00, label: '1.00' },
        { v: 1.15, label: '1.15' },
        { v: 1.25, label: '1.25' }
      ];
      ctx.font = `9px ${MONO}`;
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      legTicks.forEach(t => {
        const tx = legScale(t.v);
        ctx.beginPath();
        ctx.moveTo(tx, legBarY + legBarH);
        ctx.lineTo(tx, legBarY + legBarH + 4);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(t.label, tx, legBarY + legBarH + 14);
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = `9px ${MONO}`;
      ctx.fillText('Kq = q(ТВС) / q(средн. по зоне), отн. ед.', 390, legBarY + 9);

      // ---------------------------------------------------------------------
      // ПАСПОРТ ВЫБРАННОЙ ТВС (контрольный терминал)
      // ---------------------------------------------------------------------
      const sel = coreAssemblies.find(a => a.id === sim.selectedAssemblyId) || coreAssemblies[81];
      const cardX = 680, cardY = 58, cardW = 415, cardH = 600;
      const padX = 14;
      const innerW = cardW - 2 * padX;
      const leftX = cardX + padX;
      const rightX = cardX + cardW - padX;
      const rodPosSel = sel.hasRod ? (sel.rodGroup === 10 ? sim.group10Pos : sim.groups1to9Pos) : 100;
      const insertionPct = sel.hasRod ? 100 - rodPosSel : 0;
      const ringNo = Math.max(Math.abs(sel.q), Math.abs(sel.r), Math.abs(sel.q + sel.r));
      const rowTag = 'R-' + String(sel.rowIdx).padStart(2, '0');
      const colTag = 'C-' + String(sel.colIdx).padStart(2, '0');
      const powerFrac = Math.max(0, sim.thermalPowerMW / 3200);

      // Расчетный запас до кризиса теплообмена (оценка DNBR по локальной тепловой нагрузке)
      const avgFlowFrac = Math.max(0.065, sim.loops.reduce((s, l) => s + l.flowPct, 0) / 400);
      const pFactor = Math.pow(Math.max(0.2, sim.primaryPressureMPa) / 16.2, 0.6);
      const subFactor = Math.sqrt(Math.max(0.3, Math.min(1.5, sim.subcoolingMarginC / 19.5)));
      const qRel = Math.max(0.05, sel.currentKq * Math.max(powerFrac, 0.05));
      const dnbr = Math.min(9.99, 2.05 * pFactor * subFactor * Math.sqrt(avgFlowFrac) / Math.pow(qRel, 0.8));
      const kReserve = dnbr / 1.30;

      // Корпус карточки
      roundRect(ctx, cardX, cardY, cardW, cardH, 6);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, 6);
      ctx.clip();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cardX, cardY, cardW, 34);
      ctx.restore();
      roundRect(ctx, cardX, cardY, cardW, cardH, 6);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Шапка: моноширинный заголовок
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 11.5px ${MONO}`;
      ctx.fillText(`ТВС-2М • ПОЗИЦИЯ [${rowTag}, ${colTag}] • СБОРКА №${String(sel.id).padStart(3, '0')}`, leftX, cardY + 21.5);
      ctx.beginPath();
      ctx.arc(rightX - 2, cardY + 17, 3, 0, TWO_PI);
      ctx.fillStyle = '#22c55e';
      ctx.fill();

      // Статус-бейдж (компактный тег)
      let stLabel = 'НОМИНАЛЬНАЯ НАГРУЗКА';
      let stCol = '#15803d';
      if (sel.currentKq < 0.90) {
        stLabel = 'ПЕРИФЕРИЯ • НИЗКАЯ НАГРУЗКА';
        stCol = '#475569';
      } else if (sel.currentKq > 1.25) {
        stLabel = 'ПИКОВАЯ НАГРУЗКА';
        stCol = '#991b1b';
      } else if (sel.currentKq > 1.10) {
        stLabel = 'ПОВЫШЕННАЯ НАГРУЗКА';
        stCol = '#b45309';
      }
      ctx.font = `bold 9.5px ${MONO}`;
      const tagW = ctx.measureText(stLabel).width + 24;
      roundRect(ctx, leftX, cardY + 44, tagW, 19, 3);
      ctx.fillStyle = stCol + '1a';
      ctx.fill();
      ctx.strokeStyle = stCol;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = stCol;
      ctx.fillRect(leftX + 8, cardY + 50, 6, 6);
      ctx.fillText(stLabel, leftX + 19, cardY + 57.2);

      ctx.font = `9px ${MONO}`;
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText(isEngineeringMode ? 'РЕЖИМ: ИНЖЕНЕРНЫЙ' : 'РЕЖИМ: ОЗНАКОМИТЕЛЬНЫЙ', rightX, cardY + 57);
      ctx.textAlign = 'left';

      const sectionTitle = (text, y) => {
        ctx.font = `bold 9.5px ${MONO}`;
        ctx.fillStyle = '#334155';
        ctx.fillText(text, leftX, y);
        const w = ctx.measureText(text).width;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftX + w + 8, y - 3.5);
        ctx.lineTo(rightX, y - 3.5);
        ctx.stroke();
      };

      if (!isEngineeringMode) {
        // =====================================================================
        // ОЗНАКОМИТЕЛЬНЫЙ РЕЖИМ
        // =====================================================================
        sectionTitle('ОПЕРАТИВНЫЕ ПАРАМЕТРЫ', cardY + 86);

        const tileGap = 8;
        const tileW = (innerW - 2 * tileGap) / 3;
        const tileY = cardY + 96;
        const tiles = [
          { label: 'ТЕПЛОВЫДЕЛЕНИЕ', value: sel.powerMW.toFixed(2), unit: 'МВт' },
          { label: 'ТЕМПЕРАТУРА НА ВЫХОДЕ', value: sel.outletTemp.toFixed(1), unit: '°C' },
          { label: 'ГОД РАБОТЫ ТОПЛИВА', value: `${sel.campaignYear}-й`, unit: 'из 3' }
        ];
        tiles.forEach((t, i) => {
          const tx = leftX + i * (tileW + tileGap);
          roundRect(ctx, tx, tileY, tileW, 60, 3);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#334155';
          ctx.fillRect(tx + 1, tileY, tileW - 2, 2.5);
          ctx.fillStyle = '#64748b';
          ctx.font = `8px ${MONO}`;
          ctx.fillText(t.label, tx + 8, tileY + 18);
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold 19px ${MONO}`;
          ctx.fillText(t.value, tx + 8, tileY + 44);
          const vw = ctx.measureText(t.value).width;
          ctx.fillStyle = '#475569';
          ctx.font = `10px ${SANS}`;
          ctx.fillText(t.unit, tx + 12 + vw, tileY + 44);
        });

        // Прогресс-бар выработки ресурса
        const resourcePct = Math.min(100, Math.round((sel.burnupMWd / 55.0) * 100));
        sectionTitle('ВЫРАБОТКА РЕСУРСА КАССЕТЫ', cardY + 184);
        const barY = cardY + 194;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(leftX, barY, innerW, 10);
        ctx.fillStyle = resourcePct > 75 ? '#b45309' : '#334155';
        ctx.fillRect(leftX, barY, innerW * resourcePct / 100, 10);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftX, barY, innerW, 10);
        ctx.strokeStyle = '#f8fafc';
        for (let q = 1; q < 4; q++) {
          ctx.beginPath();
          ctx.moveTo(leftX + innerW * q / 4, barY);
          ctx.lineTo(leftX + innerW * q / 4, barY + 10);
          ctx.stroke();
        }
        ctx.font = `9.5px ${MONO}`;
        ctx.fillStyle = '#475569';
        ctx.fillText(`Кампания: ${sel.campaignYear}-й год из 3`, leftX, barY + 24);
        ctx.textAlign = 'right';
        ctx.fillText(`Использовано: ${resourcePct} %`, rightX, barY + 24);
        ctx.textAlign = 'left';

        // Справка инженера
        sectionTitle('СПРАВКА ИНЖЕНЕРА', cardY + 244);
        const helpY = cardY + 254;
        roundRect(ctx, leftX, helpY, innerW, 162, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.fillRect(leftX, helpY, 3, 162);

        ctx.fillStyle = '#1e293b';
        ctx.font = `10px ${SANS}`;
        const kqTxt = sel.currentKq.toFixed(2).replace('.', ',');
        const kqNote = sel.currentKq > 1.10
          ? 'Значение выше среднего: кассета расположена в центральной области зоны с повышенной плотностью потока нейтронов.'
          : (sel.currentKq < 0.90
            ? 'Значение ниже среднего: периферийная кассета, на положение которой влияет утечка нейтронов из активной зоны.'
            : 'Значение близко к среднему: кассета работает в проектном диапазоне энерговыделения.');
        const rodNote = sel.hasRod
          ? `Кассета оснащена кластером ОР СУЗ (группа №${sel.rodGroup}); текущее погружение — ${insertionPct.toFixed(1)} %.`
          : 'Привод ОР СУЗ в кассете отсутствует; компенсация реактивности выполняется борным регулированием.';
        let hy = helpY + 20;
        hy = coreWrapText(ctx, 'Кассета ТВС-2М содержит 312 твэлов с таблетками UO₂ в циркониевой оболочке. Теплоноситель первого контура (давление 16,2 МПа) омывает пучок снизу вверх и отводит тепловую энергию деления.', leftX + 12, hy, innerW - 22, 14) + 4;
        hy = coreWrapText(ctx, `Kq = ${kqTxt} — отношение энерговыделения кассеты к среднему значению по активной зоне (1,00). ${kqNote}`, leftX + 12, hy, innerW - 22, 14) + 4;
        coreWrapText(ctx, rodNote, leftX + 12, hy, innerW - 22, 14);

        // Расположение кассеты в активной зоне (миниатюра)
        sectionTitle('РАСПОЛОЖЕНИЕ В АКТИВНОЙ ЗОНЕ', cardY + 438);
        const mS = 0.33;
        const mOx = leftX + 80;
        const mOy = cardY + 520;
        const mR = hexR * mS * 0.95;
        coreAssemblies.forEach(a => {
          const mx = mOx + hexR * mS * sqrt3 * (a.q + a.r / 2);
          const my = mOy + hexR * mS * 1.5 * a.r;
          hexPath(mx, my, mR);
          ctx.fillStyle = coreHeatColor(a.currentKq);
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
        {
          const smx = mOx + hexR * mS * sqrt3 * (sel.q + sel.r / 2);
          const smy = mOy + hexR * mS * 1.5 * sel.r;
          hexPath(smx, smy, mR + 0.6);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.4;
          ctx.stroke();
          hexPath(smx, smy, mR + 0.6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        const infoItems = [
          ['ПОЗИЦИЯ В РЕШЕТКЕ', `${rowTag} / ${colTag}`],
          ['ГЕКСАГОНАЛЬНОЕ КОЛЬЦО', `${ringNo} из 7`],
          ['УДАЛЕНИЕ ОТ ОСИ ЗОНЫ', `${(0.236 * Math.sqrt(sel.distSq)).toFixed(2)} м`],
          ['ОР СУЗ', sel.hasRod ? `группа №${sel.rodGroup}` : 'отсутствует'],
          ['НАГРУЗКА Kq', sel.currentKq.toFixed(2)]
        ];
        infoItems.forEach((it, i) => {
          const iy = cardY + 462 + i * 27;
          ctx.fillStyle = '#64748b';
          ctx.font = `8px ${MONO}`;
          ctx.fillText(it[0], cardX + 196, iy);
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold 11.5px ${MONO}`;
          ctx.fillText(it[1], cardX + 196, iy + 13);
        });
      } else {
        // =====================================================================
        // ИНЖЕНЕРНЫЙ РЕЖИМ
        // =====================================================================
        sectionTitle('ЯДЕРНО-ФИЗИЧЕСКАЯ СПЕЦИФИКАЦИЯ', cardY + 86);
        const kResCol = kReserve >= 1.2 ? '#15803d' : (kReserve >= 1.0 ? '#b45309' : '#991b1b');
        const specRows = [
          ['Обогащение по ²³⁵U', `${sel.enrichment.toFixed(2)} %`, '#0f172a'],
          ['Глубина выгорания', `${sel.burnupMWd.toFixed(1)} МВт·сут/кгU`, '#0f172a'],
          ['Покассетный коэффициент Kq', sel.currentKq.toFixed(3), '#0f172a'],
          ['Запас до кризиса DNBR (Kзап)', `${dnbr.toFixed(2)}  (Kзап = ${kReserve.toFixed(2)})`, kResCol],
          ['Тепловая мощность кассеты', `${sel.powerMW.toFixed(2)} МВт`, '#0f172a'],
          ['T теплоносителя вх / вых', `${sim.coreInletTempC.toFixed(1)} / ${sel.outletTemp.toFixed(1)} °C`, '#0f172a'],
          ['Год топливной кампании', `${sel.campaignYear}-й из 3`, '#0f172a']
        ];
        const specY = cardY + 94;
        const rowH = 19;
        roundRect(ctx, leftX, specY, innerW, rowH * specRows.length, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        specRows.forEach((r, i) => {
          if (i % 2 === 0) {
            ctx.fillStyle = '#eef2f7';
            ctx.fillRect(leftX + 1, specY + i * rowH, innerW - 2, rowH);
          }
          ctx.fillStyle = '#475569';
          ctx.font = `10px ${SANS}`;
          ctx.fillText(r[0], leftX + 8, specY + i * rowH + 13);
          ctx.fillStyle = r[2];
          ctx.font = `bold 10.5px ${MONO}`;
          ctx.textAlign = 'right';
          ctx.fillText(r[1], rightX - 8, specY + i * rowH + 13);
          ctx.textAlign = 'left';
        });
        roundRect(ctx, leftX, specY, innerW, rowH * specRows.length, 3);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 12-слойный высотный профиль Kz (H = 3730 мм)
        sectionTitle('ВЫСОТНЫЙ ПРОФИЛЬ Kz • 12 СЛОЕВ • H = 3730 мм', cardY + 244);
        const layers = 12;
        const layerH = 13.5;
        const yTop = cardY + 276;
        const panelY = cardY + 252;
        roundRect(ctx, leftX, panelY, innerW, 200, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();

        const barX = leftX + 46;
        const barW = 200;
        const kzColX = barX + barW + 10;
        const burnColX = barX + barW + 52;
        ctx.font = `8px ${MONO}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText('H, м', leftX + 6, panelY + 14);
        ctx.fillText('ЭНЕРГОВЫДЕЛЕНИЕ Kz', barX, panelY + 14);
        ctx.fillText('Kz', kzColX, panelY + 14);
        ctx.fillText('МВт·сут/кгU', burnColX, panelY + 14);
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(leftX + 6, panelY + 19);
        ctx.lineTo(rightX - 6, panelY + 19);
        ctx.stroke();

        const rodInsFrac = insertionPct / 100;
        for (let l = 0; l < layers; l++) {
          const normZ = (l + 0.5) / layers;
          const ly = yTop - 4 + l * layerH;
          const heightM = (1 - normZ) * 3.73;
          const rodMask = (sel.hasRod && normZ < rodInsFrac) ? 0.48 : 1.0;
          const axialKz = Math.sin(normZ * Math.PI) * 1.32 * rodMask;
          const layerBurnup = sel.burnupMWd * (0.65 + 0.55 * Math.sin(normZ * Math.PI));

          ctx.fillStyle = '#64748b';
          ctx.font = `8.5px ${MONO}`;
          ctx.fillText(heightM.toFixed(2), leftX + 6, ly + 9.5);

          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(barX, ly + 1.5, barW, layerH - 3);
          const kzW = Math.min(1, (axialKz * Math.max(powerFrac, 0.02)) / 1.4) * barW;
          ctx.fillStyle = coreHeatColor(axialKz);
          ctx.fillRect(barX, ly + 1.5, kzW, layerH - 3);

          if (sel.hasRod && normZ < rodInsFrac) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(barX - 7, ly + 2, 3, layerH - 4);
          }

          ctx.fillStyle = '#0f172a';
          ctx.font = `bold 8.5px ${MONO}`;
          ctx.fillText(axialKz.toFixed(2), kzColX, ly + 9.5);
          ctx.fillStyle = '#475569';
          ctx.font = `8.5px ${MONO}`;
          ctx.fillText(layerBurnup.toFixed(1), burnColX + 8, ly + 9.5);
        }
        ctx.fillStyle = '#64748b';
        ctx.font = `8px ${MONO}`;
        ctx.fillText('▌ — участок, занятый кластером ПЭЛ ОР СУЗ', leftX + 6, panelY + 193);

        // Положение органов СУЗ
        sectionTitle('ПОЛОЖЕНИЕ ОРГАНОВ СУЗ', cardY + 472);
        if (sel.hasRod) {
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold 10.5px ${MONO}`;
          ctx.fillText(sel.rodGroup === 10 ? 'ГРУППА №10 • РАБОЧАЯ (АРМ)' : `ГРУППА №${sel.rodGroup} • АВАРИЙНАЯ ЗАЩИТА`, leftX, cardY + 494);
          ctx.textAlign = 'right';
          ctx.fillText(`ПОГРУЖЕНИЕ ${insertionPct.toFixed(1)} %`, rightX, cardY + 494);
          ctx.textAlign = 'left';

          const gY = cardY + 502;
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(leftX, gY, innerW, 16);
          ctx.fillStyle = sel.rodGroup === 10 ? '#1d4ed8' : '#334155';
          ctx.fillRect(leftX, gY, innerW * insertionPct / 100, 16);
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.strokeRect(leftX, gY, innerW, 16);
          ctx.font = `8.5px ${MONO}`;
          ctx.fillStyle = '#475569';
          [0, 25, 50, 75, 100].forEach(v => {
            const tx = leftX + innerW * v / 100;
            ctx.strokeStyle = '#64748b';
            ctx.beginPath();
            ctx.moveTo(tx, gY + 16);
            ctx.lineTo(tx, gY + 21);
            ctx.stroke();
            ctx.textAlign = v === 0 ? 'left' : (v === 100 ? 'right' : 'center');
            ctx.fillText(v === 100 ? '100 %' : String(v), tx, gY + 31);
          });
          ctx.textAlign = 'left';
          ctx.fillStyle = '#64748b';
          ctx.font = `8.5px ${MONO}`;
          ctx.fillText('0 % — извлечен (верх зоны) • 100 % — погружен (низ зоны)', leftX, gY + 47);
        } else {
          ctx.fillStyle = '#475569';
          ctx.font = `10px ${SANS}`;
          coreWrapText(ctx, 'ТВС без привода ОР СУЗ. Управление реактивностью в данной позиции осуществляется борным регулированием (концентрация H₃BO₃ в теплоносителе).', leftX, cardY + 496, innerW, 14);
        }
      }

      ctx.restore();
    }

// -----------------------------------------------------------------------------
// ХИТ-ТЕСТИНГ И ПРОГРАММНЫЙ ВЫБОР КАССЕТ ТВС
// -----------------------------------------------------------------------------
function hitTestCoreAssembly(wx, wy) {
  const centerX = 355;
  const centerY = 352;
  const hexR = 19.4;
  const sqrt3 = Math.sqrt(3);
  for (let i = 0; i < coreAssemblies.length; i++) {
    const a = coreAssemblies[i];
    const ax = centerX + hexR * sqrt3 * (a.q + a.r / 2);
    const ay = centerY + hexR * 1.5 * a.r;
    const dSq = (wx - ax) * (wx - ax) + (wy - ay) * (wy - ay);
    if (dSq <= hexR * hexR) {
      return a;
    }
  }
  return null;
}

function selectCoreAssembly(id) {
  const targetId = Math.max(1, Math.min(163, id));
  if (typeof sim !== 'undefined') {
    sim.selectedAssemblyId = targetId;
  }
  if (typeof window !== 'undefined' && window.sim) {
    window.sim.selectedAssemblyId = targetId;
  }
  return targetId;
}

// -----------------------------------------------------------------------------
// ЯВНЫЙ ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ WINDOW
// -----------------------------------------------------------------------------
window.coreAssemblies = coreAssemblies;
window.CORE_KQ_MIN = CORE_KQ_MIN;
window.CORE_KQ_MAX = CORE_KQ_MAX;
window.CORE_HEAT_STOPS = CORE_HEAT_STOPS;
window.getCoreHeatRgb = getCoreHeatRgb;
window.coreHeatColor = coreHeatColor;
window.coreHeatTextColor = coreHeatTextColor;
window.coreHeatBand = coreHeatBand;
window.coreWrapText = coreWrapText;
window.renderCoreCartogramView = renderCoreCartogramView;
window.hitTestCoreAssembly = hitTestCoreAssembly;
window.selectCoreAssembly = selectCoreAssembly;
