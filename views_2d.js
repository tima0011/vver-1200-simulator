// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-392М)
// views_2d.js — Мнемосхемы 2D-систем (панорама, разрез, 4 петли ГЦК)
// ============================================================================

// Глобальная синхронизация с контекстом холста и хотспотами
var activeHotspots = window.activeHotspots || [];

function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawParticlesOnPath(points, count, speed, color, radius = 3.2) {
      if (!sim.showParticles || points.length < 2 || speed <= 0.01) return;
      const segLengths = [];
      let totalLen = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i + 1][0] - points[i][0];
        const dy = points[i + 1][1] - points[i][1];
        const l = Math.hypot(dx, dy);
        segLengths.push(l);
        totalLen += l;
      }
      if (totalLen < 1) return;

      ctx.save();
      ctx.fillStyle = color;
      for (let i = 0; i < count; i++) {
        const phase = ((sim.time * speed * 0.18 + i / count) % 1 + 1) % 1;
        let targetDist = phase * totalLen;
        for (let s = 0; s < segLengths.length; s++) {
          if (targetDist <= segLengths[s] || s === segLengths.length - 1) {
            const frac = segLengths[s] > 0 ? targetDist / segLengths[s] : 0;
            const px = points[s][0] + (points[s + 1][0] - points[s][0]) * frac;
            const py = points[s][1] + (points[s + 1][1] - points[s][1]) * frac;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          targetDist -= segLengths[s];
        }
      }
      ctx.restore();
    }

    // Вспомогательная функция отрисовки кликабельного узла арматуры / клапана на мнемосхеме [СИСТЕМЫ]
    // Мнемоническое отображение положения: задвижка открыта — заливка зеленым (#15803d) с линией прохода; закрыта — темно-серый корпус с перекрестием.
    function drawClickableArmature(x, y, w, h, label, stateText, statusType, tooltipCfg, onClickFn) {
      const isHovered = sim.hoveredHotspot && sim.hoveredHotspot.x === x && sim.hoveredHotspot.y === y;

      const isOpen = stateText.includes('ОТКРЫТ') ||
        stateText.includes('ВКЛЮЧЕН') ||
        stateText.includes('ПОДАЧА') ||
        stateText.includes('В РАБОТЕ') ||
        statusType === 'norm' ||
        (statusType === 'warn' && (sim.saozActive || sim.bruAOpen || sim.feedwaterFlowPct > 10 || sim.turbineValvePct > 10)) ||
        (statusType === 'danger' && sim.ipuKdOpen);

      ctx.save();
      roundRect(ctx, x, y, w, h, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#0284c7' : (isOpen ? '#15803d' : '#64748b');
      ctx.lineWidth = isHovered ? 2 : 1.2;
      ctx.stroke();

      // Символ задвижки (два противоположных треугольника / бабочка)
      const vx = x + 15;
      const vy = y + h / 2;

      if (isOpen) {
        // Открыта: заливка зеленым (#15803d) с линией прохода
        ctx.fillStyle = '#15803d';
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(vx - 7, vy - 6);
        ctx.lineTo(vx, vy);
        ctx.lineTo(vx - 7, vy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vx + 7, vy - 6);
        ctx.lineTo(vx, vy);
        ctx.lineTo(vx + 7, vy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Линия свободного прохода
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(vx - 8, vy);
        ctx.lineTo(vx + 8, vy);
        ctx.stroke();
      } else {
        // Закрыта: темно-серый корпус (#334155) с перекрестием
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(vx - 7, vy - 6);
        ctx.lineTo(vx, vy);
        ctx.lineTo(vx - 7, vy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vx + 7, vy - 6);
        ctx.lineTo(vx, vy);
        ctx.lineTo(vx + 7, vy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Перекрестие (X)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(vx - 5, vy - 5);
        ctx.lineTo(vx + 5, vy + 5);
        ctx.moveTo(vx - 5, vy + 5);
        ctx.lineTo(vx + 5, vy - 5);
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
      ctx.fillText(label, x + 28, y + 13);

      const stateColor = isOpen ? '#15803d' : (statusType === 'danger' ? '#dc2626' : '#64748b');
      ctx.fillStyle = stateColor;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(stateText, x + 28, y + 25);
      ctx.restore();

      const telemFn = typeof tooltipCfg.telemetry === 'function' ? tooltipCfg.telemetry : () => String(tooltipCfg.telemetry || '');
      activeHotspots.push({
        x, y, w, h,
        title: tooltipCfg.title,
        sub: tooltipCfg.sub,
        desc: tooltipCfg.desc,
        simple: tooltipCfg.simple,
        telemetry: telemFn,
        onClick: onClickFn
      });
    }

    // Вспомогательная функция отрисовки SCADA-модуля оборудования
    function drawScadaModule(cfg) {
      const { x, y, w, h, title, subtitle, rows, isHovered, statusColor = '#22c55e' } = cfg;
      ctx.save();
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#0284c7' : '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      const headerH = 25;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + w - 4, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + 4);
      ctx.lineTo(x + w, y + headerH);
      ctx.lineTo(x, y + headerH);
      ctx.lineTo(x, y + 4);
      ctx.quadraticCurveTo(x, y, x + 4, y);
      ctx.closePath();
      ctx.fillStyle = '#334155';
      ctx.fill();

      // Статусный LED индикатор
      ctx.beginPath();
      ctx.arc(x + w - 12, y + 12.5, 4, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillText(title, x + 7, y + 12);

      if (subtitle) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillText(subtitle, x + 7, y + 21.5);
      }
      ctx.restore();

      if (rows && rows.length > 0) {
        const tableTop = y + headerH + 3;
        const rowH = Math.min(22, (h - headerH - 6) / rows.length);

        rows.forEach((r, idx) => {
          const ry = tableTop + idx * rowH;
          ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f1f5f9';
          ctx.fillRect(x + 3, ry, w - 6, rowH - 1);
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(x + 3, ry, w - 6, rowH - 1);

          ctx.fillStyle = '#475569';
          ctx.font = 'bold 8.5px "Segoe UI", sans-serif';
          ctx.fillText(r.label, x + 6, ry + rowH - 5.5);

          const valStr = String(r.val);
          const unitStr = r.unit ? ' ' + r.unit : '';
          ctx.font = '8px "Segoe UI", sans-serif';
          const unitW = ctx.measureText(unitStr).width;
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          const valW = ctx.measureText(valStr).width;

          const rightEdge = x + w - 6;
          ctx.fillStyle = '#64748b';
          ctx.font = '8px "Segoe UI", sans-serif';
          ctx.fillText(unitStr, rightEdge - unitW, ry + rowH - 5.5);

          ctx.fillStyle = r.color || '#0f172a';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText(valStr, rightEdge - unitW - valW, ry + rowH - 5.5);
        });
      }
      ctx.restore();
    }

    // Метка над технологическим трубопроводом
    function drawPipeLabel(text, x, y, color) {
      ctx.save();
      ctx.font = 'bold 9px "Segoe UI", sans-serif';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x - 4, y - 11, tw + 8, 15, 3);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    // ============================================================================
    // ПАНОРАМНАЯ МНЕМОСХЕМА [СИСТЕМЫ] В СТИЛЕ ТРЕНАЖЕРА МАГАТЭ (СЛЕВА НАПРАВО)
    // Реактор -> КД -> Парогенераторы (ПГВ) -> ГПК -> Турбина -> Конденсатор -> ПЭН
    // ============================================================================
    function renderPanoramicSystemsView() {
      // 0. Зонирование контуров (Реакторное отделение и Машинный зал)
      ctx.save();
      roundRect(ctx, 25, 60, 620, 640, 6);
      ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillText('ГЕРМООБОЛОЧКА (1-Й КОНТУР • РЕАКТОРНОЕ ОТДЕЛЕНИЕ)', 38, 78);

      roundRect(ctx, 655, 60, 680, 640, 6);
      ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillText('МАШИННЫЙ ЗАЛ (2-Й КОНТУР • ТУРБОУСТАНОВКА И КОНДЕНСАТОР)', 668, 78);
      ctx.setLineDash([]);
      ctx.restore();

      const activePumpsCount = sim.loops ? sim.loops.filter(l => l.pumpOn).length : 4;
      const avgSgLevel = sim.loops ? sim.loops.reduce((s, l) => s + l.sgLevelM, 0) / 4 : 2.10;
      const avgRpm = sim.loops ? sim.loops.reduce((s, l) => s + l.rpm, 0) / 4 : 1000;
      const primaryFlowKgS = sim.loops ? sim.loops.reduce((s, l) => s + (l.pumpOn ? 4400 : 500), 0) : 17600;
      const steamKgS = 1780 * (sim.feedwaterFlowPct / 100);

      // ==========================================================================
      // ТЕХНОЛОГИЧЕСКИЕ ТРУБОПРОВОДЫ (ОРТОГОНАЛЬНАЯ РАЗВОДКА ПОД 90°, ТОЛЩИНА 5px)
      // ==========================================================================
      ctx.save();
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';

      // 1) Горячая нитка Ду850 (Твых): Реактор (230, 310) -> ПГВ (460, 310)
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(230, 310);
      ctx.lineTo(460, 310);
      ctx.stroke();

      // Дыхательный трубопровод к КД: от горячей нитки (345, 310) вверх в дно КД (345, 273)
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(345, 310);
      ctx.lineTo(345, 273);
      ctx.stroke();

      // 2) Линия впрыска в КД (из холодной нитки): (420, 495) -> вверх к КД (420, 180) -> в КД (420, 180)
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(420, 495);
      ctx.lineTo(420, 180);
      ctx.lineTo(418, 180);
      ctx.stroke();

      // 3) Сброс ИПУ КД в барботер: от верха КД (345, 118) -> вверх (345, 92) -> влево (245, 92)
      ctx.strokeStyle = sim.ipuKdOpen ? '#dc2626' : '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(345, 118);
      ctx.lineTo(345, 92);
      ctx.lineTo(160, 92);
      ctx.stroke();

      // 4) Холодная нитка Ду850 (Твх): ПГВ (545, 410) -> ГЦНА (545, 440), выход ГЦНА (460, 495) -> Реактор (230, 495)
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(545, 410);
      ctx.lineTo(545, 440);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(460, 495);
      ctx.lineTo(230, 495);
      ctx.stroke();

      // 5) Паропровод свежего пара ГПК (P2, Tнас): ПГВ (545, 195) -> (545, 160) -> ГПК (675, 160)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(545, 195);
      ctx.lineTo(545, 160);
      ctx.lineTo(675, 160);
      ctx.stroke();

      // От ГПК к Турбине: ГПК (825, 160) -> Турбина (920, 160) -> вниз в турбину (920, 180)
      ctx.beginPath();
      ctx.moveTo(825, 160);
      ctx.lineTo(920, 160);
      ctx.lineTo(920, 180);
      ctx.stroke();

      // Линия сброса пара БРУ-К из ГПК (745, 240) -> вниз (745, 275) -> вправо в конденсатор (1115, 275)
      if (sim.bruKOpen) {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(745, 240);
        ctx.lineTo(745, 275);
        ctx.lineTo(1115, 275);
        ctx.stroke();
      }

      // 6) Выхлоп пара из Турбины в Конденсатор: Турбина (1070, 270) -> Конденсатор (1115, 270)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(1070, 270);
      ctx.lineTo(1115, 270);
      ctx.stroke();

      // 7) Питательная вода от ПЭН (225 °C): Конденсатор (1215, 360) -> ПЭН (1215, 440)
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(1215, 360);
      ctx.lineTo(1215, 440);
      ctx.stroke();

      // Нагнетание ПЭН: (1215, 585) -> вниз (1215, 635) -> влево (545, 635) -> вверх в ПГВ (545, 410)
      ctx.beginPath();
      ctx.moveTo(1215, 585);
      ctx.lineTo(1215, 635);
      ctx.lineTo(545, 635);
      ctx.lineTo(545, 410);
      ctx.stroke();

      ctx.restore();

      // ==========================================================================
      // ТЕКСТОВЫЕ МЕТКИ НАД МАГИСТРАЛЯМИ
      // ==========================================================================
      drawPipeLabel('«Горячая нитка Ду850 (Твых)»', 242, 303, '#dc2626');
      drawPipeLabel('«Холодная нитка Ду850 (Твх)»', 242, 488, '#1d4ed8');
      drawPipeLabel('«Линия впрыска КД»', 345, 450, '#0284c7');
      drawPipeLabel('«Сброс ИПУ КД в барботер»', 125, 87, sim.ipuKdOpen ? '#dc2626' : '#475569');
      drawPipeLabel('«Свежий пар ГПК (P2, Tнас)»', 475, 153, '#475569');
      drawPipeLabel('«Питательная вода от ПЭН (225 °C)»', 760, 628, '#0284c7');

      // ==========================================================================
      // ПОТОКИ ЧАСТИЦ (АНИМАЦИЯ ТЕХНОЛОГИЧЕСКИХ СРЕД)
      // ==========================================================================
      const flowPrimary = (activePumpsCount / 4);
      drawParticlesOnPath([[230, 310], [460, 310]], 6, flowPrimary * 3.2, '#dc2626', 3.0);
      drawParticlesOnPath([[545, 410], [545, 440]], 3, flowPrimary * 3.2, '#1d4ed8', 3.0);
      drawParticlesOnPath([[460, 495], [230, 495]], 6, flowPrimary * 3.2, '#1d4ed8', 3.0);

      const flowSteam = (sim.feedwaterFlowPct / 100) * (sim.turbineValvePct / 100);
      drawParticlesOnPath([[545, 195], [545, 160], [675, 160]], 5, flowSteam * 3.6, '#94a3b8', 2.8);
      drawParticlesOnPath([[825, 160], [920, 160], [920, 180]], 4, flowSteam * 3.6, '#94a3b8', 2.8);
      drawParticlesOnPath([[1070, 270], [1115, 270]], 3, flowSteam * 2.5, '#cbd5e1', 2.5);

      const flowFeed = sim.feedwaterFlowPct / 100;
      drawParticlesOnPath([[1215, 360], [1215, 440]], 3, flowFeed * 3.0, '#0284c7', 2.8);
      drawParticlesOnPath([[1215, 585], [1215, 635], [545, 635], [545, 410]], 10, flowFeed * 3.0, '#0284c7', 2.8);

      if (sim.sprayActive) {
        drawParticlesOnPath([[420, 495], [420, 180], [418, 180]], 4, 1.8, '#0284c7', 2.2);
      }

      // ==========================================================================
      // МОДУЛЬ 1: РЕАКТОР ВВЭР-1200
      // ==========================================================================
      const rxX = 50, rxY = 195, rxW = 180, rxH = 250;
      const isRxHov = sim.hoveredHotspot && sim.hoveredHotspot.x === rxX && sim.hoveredHotspot.y === rxY;
      const rxStatus = sim.az1Active ? '#dc2626' : (sim.thermalPowerMW > 3300 ? '#f59e0b' : '#22c55e');

      drawScadaModule({
        x: rxX, y: rxY, w: rxW, h: rxH,
        title: 'ВВЭР-1200 // РЕАКТОР',
        subtitle: 'РУ В-392М • 163 ТВС',
        statusColor: rxStatus,
        isHovered: isRxHov,
        rows: [
          { label: 'Nтепл (мощность)', val: sim.thermalPowerMW.toFixed(0), unit: 'МВт', color: '#dc2626' },
          { label: 'Уровень мощности', val: (sim.thermalPowerMW / 32).toFixed(1), unit: '%', color: '#dc2626' },
          { label: 'P₁ (давление 1к)', val: sim.primaryPressureMPa.toFixed(2), unit: 'МПа' },
          { label: 'Твых (гор. нитка)', val: sim.coreOutletTempC.toFixed(1), unit: '°C', color: '#dc2626' },
          { label: 'Твх (хол. нитка)', val: sim.coreInletTempC.toFixed(1), unit: '°C', color: '#1d4ed8' },
          { label: 'Расход G₁', val: primaryFlowKgS.toFixed(0), unit: 'кг/с' },
          { label: 'ОР СУЗ (Гр.10)', val: sim.group10Pos.toFixed(1), unit: '%', color: '#15803d' },
          { label: 'Бор H3BO3', val: sim.boronConc.toFixed(2), unit: 'г/кг' }
        ]
      });

      activeHotspots.push({
        x: rxX, y: rxY, w: rxW, h: rxH,
        title: 'Реактор ВВЭР-1200 (В-392М)',
        sub: 'Ядерная паропроизводящая установка (ЯППУ)',
        desc: 'Водо-водяной энергетический реактор тепловой мощностью 3200 МВт. Активная зона из 163 ТВС с низкообогащенным диоксидом урана UO₂.',
        simple: plainExplanations.reactor,
        telemetry: () => `Nтепл: ${sim.thermalPowerMW.toFixed(0)} МВт | P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа | Tвых: ${sim.coreOutletTempC.toFixed(1)} °C | Бор: ${sim.boronConc.toFixed(2)} г/кг`
      });

      // Гидроемкости САОЗ (ГЕ-1..4) слева от реактора
      ctx.save();
      roundRect(ctx, 16, 215, 26, 110, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const saozH = Math.max(4, 98 * (sim.saozWaterPct / 100));
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(18, 321 - saozH, 22, saozH);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.save();
      ctx.translate(22, 230);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('САОЗ ГЕ', 0, 0);
      ctx.restore();
      ctx.restore();

      // УЛР (Ловушка расплава) под реактором
      const ulrX = 50, ulrY = 455, ulrW = 180, ulrH = 52;
      const isUlrHov = sim.hoveredHotspot && sim.hoveredHotspot.x === ulrX && sim.hoveredHotspot.y === ulrY;
      drawScadaModule({
        x: ulrX, y: ulrY, w: ulrW, h: ulrH,
        title: 'УЛР // ЛОВУШКА РАСПЛАВА',
        subtitle: 'БЕТОННАЯ ШАХТА',
        statusColor: '#22c55e',
        isHovered: isUlrHov,
        rows: [
          { label: 'Состояние шахты', val: 'Сухая (Норма)', unit: '', color: '#15803d' },
          { label: 'Охлаждение водой', val: sim.ulrCoolingActive ? 'ПОДАЧА ВКЛ' : 'Ожидание', unit: '', color: sim.ulrCoolingActive ? '#15803d' : '#64748b' }
        ]
      });

      activeHotspots.push({
        x: ulrX, y: ulrY, w: ulrW, h: ulrH,
        title: 'Устройство локализации расплава (УЛР)',
        sub: 'Тяжелая авария • Удержание кориума',
        desc: 'Коническая ловушка под корпусом реактора, заполненная жертвенным материалом (оксиды железа и алюминия) для связывания и охлаждения расплава.',
        simple: plainExplanations.ulr,
        telemetry: () => `Статус УЛР: ${sim.ulrCoolingActive ? 'ОХЛАЖДЕНИЕ ВКЛЮЧЕНО' : 'СУХОЕ ОЖИДАНИЕ'}`
      });

      // Арматура реактора: СПОТ, САОЗ, Охлаждение УЛР
      drawClickableArmature(
        35, 110, 185, 34,
        'ШИБЕРЫ СПОТ (КУПОЛ)',
        sim.spotActive ? 'ОТКРЫТЫ (ТЕПЛООТВОД)' : 'ЗАКРЫТЫ (ОЖИДАНИЕ)',
        sim.spotActive ? 'norm' : 'idle',
        {
          title: 'Система пассивного отвода тепла (СПОТ)',
          sub: '4 канала пассивного охлаждения через теплообменники',
          desc: 'СПОТ отводит тепло от защитной оболочки в атмосферу естественной циркуляцией воздуха без электропитания.',
          simple: plainExplanations.spot,
          telemetry: () => `Шиберы СПОТ: ${sim.spotActive ? 'ОТКРЫТЫ' : 'ЗАКРЫТЫ'}`
        },
        () => {
          sim.spotActive = !sim.spotActive;
          addLog(sim.spotActive ? 'Шиберы СПОТ открыты (пассивный отвод тепла)' : 'Шиберы СПОТ закрыты', sim.spotActive ? 'action' : 'norm');
          sound.click(sim.spotActive ? 680 : 380);
        }
      );

      drawClickableArmature(
        35, 150, 185, 34,
        'КЛАПАН ГЕ САОЗ (16 г/кг)',
        sim.saozActive ? `ПОДАЧА В ЗОНУ (${sim.saozWaterPct.toFixed(0)}%)` : 'ЗАКРЫТ (P₁ > 5.9 МПа)',
        sim.saozActive ? 'warn' : 'idle',
        {
          title: 'Обратные клапаны гидроемкостей САОЗ ГЕ-1..4',
          sub: 'Пассивная часть системы аварийного охлаждения',
          desc: 'При падении давления в 1-м контуре ниже 5.9 МПа гидроемкости под давлением азота впрыскивают борный раствор прямо в реактор.',
          simple: plainExplanations.saoz,
          telemetry: () => `Статус САОЗ: ${sim.saozActive ? 'ПОДАЧА АКТИВНА' : 'В ОЖИДАНИИ'} | Запас: ${sim.saozWaterPct.toFixed(1)}%`
        },
        () => {
          sim.saozActive = !sim.saozActive;
          addLog(sim.saozActive ? 'Клапаны гидроемкостей САОЗ открыты оператором' : 'Клапаны САОЗ закрыты', sim.saozActive ? 'warn' : 'norm');
          sound.click(sim.saozActive ? 520 : 340);
        }
      );

      drawClickableArmature(
        50, 514, 180, 34,
        'ОХЛАЖДЕНИЕ ШАХТЫ УЛР',
        sim.ulrCoolingActive ? 'ПОДАЧА ВОДЫ АКТИВНА' : 'КЛАПАН ЗАКРЫТ',
        sim.ulrCoolingActive ? 'norm' : 'idle',
        {
          title: 'Охлаждение Устройства локализации расплава (УЛР)',
          sub: 'Подача охлаждающей воды в шахту ловушки',
          desc: 'Обеспечивает затопление внешнего корпуса ловушки и кристаллизацию кориума.',
          simple: plainExplanations.ulr,
          telemetry: () => `Статус УЛР: ${sim.ulrCoolingActive ? 'ОХЛАЖДЕНИЕ ВКЛЮЧЕНО' : 'СУХОЕ ОЖИДАНИЕ'}`
        },
        () => {
          sim.ulrCoolingActive = !sim.ulrCoolingActive;
          addLog(sim.ulrCoolingActive ? 'Подача охлаждающей воды в УЛР открыта' : 'Охлаждение УЛР отключено', sim.ulrCoolingActive ? 'action' : 'norm');
          sound.click(sim.ulrCoolingActive ? 580 : 320);
        }
      );

      // ==========================================================================
      // МОДУЛЬ 2: КОМПЕНСАТОР ДАВЛЕНИЯ (КД) (РАСПОЛОЖЕН НАД ГОРЯЧЕЙ НИТКОЙ)
      // ==========================================================================
      const kdX = 270, kdY = 118, kdW = 150, kdH = 155;
      const isKdHov = sim.hoveredHotspot && sim.hoveredHotspot.x === kdX && sim.hoveredHotspot.y === kdY;
      const kdStatus = sim.primaryPressureMPa < 15.5 || sim.primaryPressureMPa > 16.6 ? '#f59e0b' : '#22c55e';

      drawScadaModule({
        x: kdX, y: kdY, w: kdW, h: kdH,
        title: 'КД // КОМПЕНСАТОР',
        subtitle: 'ОБЪЕМ 79 м³ • P=16.0 МПа',
        statusColor: kdStatus,
        isHovered: isKdHov,
        rows: [
          { label: 'Pкд (давление)', val: sim.primaryPressureMPa.toFixed(2), unit: 'МПа' },
          { label: 'Lкд (уровень)', val: sim.pressurizerLevelM.toFixed(2), unit: 'м' },
          { label: 'Qтэн (нагрев)', val: sim.heatersPowerKW.toFixed(0), unit: 'кВт' },
          { label: 'Режим ТЭНов', val: sim.heatersMode, unit: '' },
          { label: 'Впрыск из х/н', val: sim.sprayActive ? 'ВКЛЮЧЕН' : 'ЗАКРЫТ', unit: '', color: sim.sprayActive ? '#15803d' : '#64748b' },
          { label: 'ИПУ КД (сброс)', val: sim.ipuKdOpen ? 'ОТКРЫТ!' : 'НОРМА', unit: '', color: sim.ipuKdOpen ? '#dc2626' : '#15803d' }
        ]
      });

      activeHotspots.push({
        x: kdX, y: kdY, w: kdW, h: kdH,
        title: 'Компенсатор давления (КД)',
        sub: 'Поддержание давления P₁ = 16.0 МПа',
        desc: 'Вертикальный сосуд объемом 79 м³. Водяной объем с электронагревателями (ТЭН 2520 кВт) и паровая подушка с узлом впрыска теплоносителя.',
        simple: plainExplanations.kd,
        telemetry: () => `P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа | Уровень: ${sim.pressurizerLevelM.toFixed(2)} м | ТЭНы: ${sim.heatersPowerKW} кВт (${sim.heatersMode})`
      });

      // Арматура КД: ИПУ (сверху КД), Впрыск и ТЭНы (снизу под горячей ниткой)
      drawClickableArmature(
        270, 55, 150, 32,
        'КЛАПАН ИПУ КД (СБРОС)',
        sim.ipuKdOpen ? 'ОТКРЫТ (СБРОС P₁!)' : 'ЗАКРЫТ (НОРМА)',
        sim.ipuKdOpen ? 'danger' : 'idle',
        {
          title: 'Импульсное предохранительное устройство (ИПУ КД)',
          sub: 'Защита 1-го контура от сверхдавления (сброс в барботер)',
          desc: 'Сбрасывает пар в барботер при аварийном росте P₁ свыше 17.5 МПа.',
          simple: plainExplanations.kd,
          telemetry: () => `ИПУ КД: ${sim.ipuKdOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ'} | P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа`
        },
        () => {
          sim.ipuKdOpen = !sim.ipuKdOpen;
          addLog(sim.ipuKdOpen ? 'ИПУ КД принудительно открыт оператором!' : 'ИПУ КД закрыт', sim.ipuKdOpen ? 'alarm' : 'norm');
          sound.click(sim.ipuKdOpen ? 750 : 350);
        }
      );

      drawClickableArmature(
        270, 335, 150, 34,
        'ВПРЫСК В КД (ОХЛАЖД.)',
        sim.sprayActive ? 'ВПРЫСК ВКЛЮЧЕН' : 'КЛАПАН ЗАКРЫТ',
        sim.sprayActive ? 'norm' : 'idle',
        {
          title: 'Клапан впрыска в Компенсатор давления',
          sub: 'Подача воды из холодной нитки в паровую фазу КД',
          desc: 'Конденсирует паровую подушку и быстро снижает избыточное давление.',
          simple: plainExplanations.kd,
          telemetry: () => `Впрыск в КД: ${sim.sprayActive ? 'АКТИВЕН (Снижение P₁)' : 'ЗАКРЫТ'}`
        },
        () => {
          sim.sprayActive = !sim.sprayActive;
          addLog(sim.sprayActive ? 'Впрыск в КД включен' : 'Впрыск в КД отключен', 'action');
          sound.click(sim.sprayActive ? 620 : 360);
        }
      );

      drawClickableArmature(
        270, 378, 150, 34,
        'РЕЖИМ ТЭНов КД',
        `${sim.heatersMode} (${sim.heatersPowerKW} кВт)`,
        sim.heatersMode !== 'OFF' ? 'warn' : 'idle',
        {
          title: 'Блок электронагревателей КД (ТЭНы)',
          sub: '2520 кВт трубчатых нагревателей в донной части',
          desc: 'Переключение режимов: АВТО / РУЧНОЙ (100%) / ОТКЛ.',
          simple: plainExplanations.kd,
          telemetry: () => `Режим ТЭНов: ${sim.heatersMode} | Мощность: ${sim.heatersPowerKW} кВт`
        },
        () => {
          sim.heatersMode = sim.heatersMode === 'AUTO' ? 'MANUAL' : (sim.heatersMode === 'MANUAL' ? 'OFF' : 'AUTO');
          addLog(`Режим ТЭН КД изменен: ${sim.heatersMode}`, 'action');
          sound.click(500);
        }
      );

      // ==========================================================================
      // МОДУЛЬ 3: ПАРОГЕНЕРАТОРЫ ПГВ-1000МКП (4 ПЕТЛИ)
      // ==========================================================================
      const sgX = 460, sgY = 195, sgW = 170, sgH = 215;
      const isSgHov = sim.hoveredHotspot && sim.hoveredHotspot.x === sgX && sim.hoveredHotspot.y === sgY;
      const sgStatus = avgSgLevel < 1.9 || avgSgLevel > 2.6 ? '#f59e0b' : '#22c55e';

      drawScadaModule({
        x: sgX, y: sgY, w: sgW, h: sgH,
        title: 'ПГВ-1000МКП // 4 ПГ',
        subtitle: '2-Й КОНТУР • ГОРИЗОНТ.',
        statusColor: sgStatus,
        isHovered: isSgHov,
        rows: [
          { label: 'P₂ (давление пара)', val: sim.steamHeaderPressMPa.toFixed(2), unit: 'МПа' },
          { label: 'Tнас (темп. пара)', val: sim.steamTempC.toFixed(1), unit: '°C' },
          { label: 'Lпг (уровень воды)', val: avgSgLevel.toFixed(2), unit: 'м' },
          { label: 'Dпар (расход пара)', val: steamKgS.toFixed(0), unit: 'кг/с' },
          { label: 'xпар (качество)', val: '99.8', unit: '%' },
          { label: 'Твх 1-го контура', val: sim.coreOutletTempC.toFixed(1), unit: '°C', color: '#dc2626' },
          { label: 'Твых 1-го контура', val: sim.coreInletTempC.toFixed(1), unit: '°C', color: '#1d4ed8' }
        ]
      });

      activeHotspots.push({
        x: sgX, y: sgY, w: sgW, h: sgH,
        title: 'Парогенераторы ПГВ-1000МКП (4 петли)',
        sub: 'Граница 1-го и 2-го контуров станции',
        desc: 'Горизонтальные парогенераторы с погруженным трубным пучком из 11 000 нержавеющих U-образных трубок. Производят сухой насыщенный пар 7.0 МПа.',
        simple: plainExplanations.pgv,
        telemetry: () => `P₂ пара: ${sim.steamHeaderPressMPa.toFixed(2)} МПа | Уровень: ${avgSgLevel.toFixed(2)} м | Tгор: ${sim.coreOutletTempC.toFixed(1)} °C → Tхол: ${sim.coreInletTempC.toFixed(1)} °C`
      });

      // ==========================================================================
      // МОДУЛЬ 4: ГЦНА-1391 (4 ЦИРКУЛЯЦИОННЫХ НАСОСА)
      // ==========================================================================
      const mcpX = 460, mcpY = 440, mcpW = 170, mcpH = 145;
      const isMcpHov = sim.hoveredHotspot && sim.hoveredHotspot.x === mcpX && sim.hoveredHotspot.y === mcpY;
      const mcpStatus = activePumpsCount === 4 ? '#22c55e' : (activePumpsCount > 0 ? '#f59e0b' : '#dc2626');

      drawScadaModule({
        x: mcpX, y: mcpY, w: mcpW, h: mcpH,
        title: 'ГЦНА-1391 // НАСОСЫ',
        subtitle: '4 АГРЕГАТА ГЦК',
        statusColor: mcpStatus,
        isHovered: isMcpHov,
        rows: [
          { label: 'В работе', val: `${activePumpsCount}/4`, unit: 'шт', color: activePumpsCount === 4 ? '#15803d' : '#d97706' },
          { label: 'Обороты n', val: avgRpm.toFixed(0), unit: 'об/мин' },
          { label: 'Расход G₁', val: primaryFlowKgS.toFixed(0), unit: 'кг/с' },
          { label: 'ΔP нагнетания', val: (0.58 * (activePumpsCount / 4)).toFixed(2), unit: 'МПа' }
        ]
      });

      activeHotspots.push({
        x: mcpX, y: mcpY, w: mcpW, h: mcpH,
        title: 'Главные циркуляционные насосы ГЦНА-1391',
        sub: 'Прокачка теплоносителя через активную зону',
        desc: '4 насосных агрегата с электродвигателями по 8 МВт и водяным уплотнением вала. Номинальная подача 22 000 м³/ч на агрегат.',
        simple: plainExplanations.gcna,
        telemetry: () => `Работает насосов: ${activePumpsCount} из 4 | Ср. обороты: ${Math.round(avgRpm)} об/мин`
      });

      // Управление ГЦНА
      drawClickableArmature(
        460, 595, 170, 34,
        'ПРИВОДЫ ГЦНА-1..4',
        activePumpsCount === 4 ? 'ВСЕ 4 В РАБОТЕ (100%)' : `ВКЛЮЧЕНО: ${activePumpsCount}/4 (ЕЦ)`,
        activePumpsCount === 4 ? 'norm' : 'warn',
        {
          title: 'Управление Главными циркуляционными насосами (ГЦНА-1..4)',
          sub: 'Принудительная и естественная циркуляция 1-го контура',
          desc: 'Кликните, чтобы последовательно отключить/включить насосы ГЦНА и пронаблюдать переход на естественную циркуляцию.',
          simple: plainExplanations.gcna,
          telemetry: () => `Активные ГЦНА: ${activePumpsCount}/4`
        },
        () => {
          const allOn = sim.loops.every(l => l.pumpOn);
          sim.loops.forEach((l, i) => {
            l.pumpOn = !allOn;
            const btn = document.getElementById(`btnPump${i}`);
            if (btn) btn.classList.toggle('active', l.pumpOn);
          });
          addLog(allOn ? 'С мнемосхемы [СИСТЕМЫ] отключены ГЦНА-1..4 (переход на выбег и ЕЦ).' : 'С мнемосхемы [СИСТЕМЫ] включены все четыре ГЦНА-1..4.', allOn ? 'warn' : 'ok');
          sound.click(allOn ? 420 : 540);
        }
      );

      // ==========================================================================
      // МОДУЛЬ 5: ГПК // ГЛАВНЫЙ ПАРОВОЙ КОЛЛЕКТОР
      // ==========================================================================
      const gpkX = 675, gpkY = 145, gpkW = 150, gpkH = 95;
      const isGpkHov = sim.hoveredHotspot && sim.hoveredHotspot.x === gpkX && sim.hoveredHotspot.y === gpkY;

      drawScadaModule({
        x: gpkX, y: gpkY, w: gpkW, h: gpkH,
        title: 'ГПК // ПАРОВОЙ КОЛЛЕКТОР',
        subtitle: `P₂=${sim.steamHeaderPressMPa.toFixed(2)} МПа`,
        statusColor: '#22c55e',
        isHovered: isGpkHov,
        rows: [
          { label: 'Pпар (в коллекторе)', val: sim.steamHeaderPressMPa.toFixed(2), unit: 'МПа' },
          { label: 'Клапан БРУ-К', val: sim.bruKOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ', unit: '', color: sim.bruKOpen ? '#15803d' : '#64748b' },
          { label: 'Клапан БРУ-А', val: sim.bruAOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ', unit: '', color: sim.bruAOpen ? '#d97706' : '#64748b' }
        ]
      });

      activeHotspots.push({
        x: gpkX, y: gpkY, w: gpkW, h: gpkH,
        title: 'Главный паровой коллектор (ГПК)',
        sub: 'Сбор свежего пара от 4 парогенераторов',
        desc: 'Объединяет пар от 4 ПГВ и направляет его к стопорно-регулирующим клапанам турбины, а также на сбросные станции БРУ-К и БРУ-А.',
        simple: plainExplanations.gpk,
        telemetry: () => `Давление в ГПК: ${sim.steamHeaderPressMPa.toFixed(2)} МПа | Температура пара: ${sim.steamTempC.toFixed(1)} °C`
      });

      // Арматура БРУ-К и БРУ-А
      drawClickableArmature(
        660, 255, 168, 34,
        'КЛАПАН БРУ-К (В КОНД.)',
        sim.bruKOpen ? 'ОТКРЫТ (СБРОС ПАРА)' : 'ЗАКРЫТ (НОРМА)',
        sim.bruKOpen ? 'norm' : 'idle',
        {
          title: 'Быстродействующая редукционная установка БРУ-К',
          sub: 'Сброс пара в конденсатор турбины мимо проточной части',
          desc: 'Сбрасывает избыточный пар в конденсатор при сбросе электрической нагрузки блока.',
          simple: plainExplanations.bruk,
          telemetry: () => `Статус БРУ-К: ${sim.bruKOpen ? 'ОТКРЫТ (Сброс в конденсатор)' : 'ЗАКРЫТ'}`
        },
        () => {
          sim.bruKOpen = !sim.bruKOpen;
          addLog(sim.bruKOpen ? 'Клапан БРУ-К открыт (сброс пара в конденсатор)' : 'Клапан БРУ-К закрыт', sim.bruKOpen ? 'action' : 'norm');
          sound.click(sim.bruKOpen ? 640 : 370);
        }
      );

      drawClickableArmature(
        660, 298, 168, 34,
        'КЛАПАН БРУ-А (АТМОСФ.)',
        sim.bruAOpen ? 'ОТКРЫТ (ВЫХЛОП!)' : 'ЗАКРЫТ (НОРМА)',
        sim.bruAOpen ? 'warn' : 'idle',
        {
          title: 'Быстродействующая редукционная установка БРУ-А',
          sub: 'Аварийный сброс пара в атмосферу при потере конденсатора',
          desc: 'Предохраняет парогенераторы от сверхдавления при отсутствии вакуума в конденсаторе.',
          simple: plainExplanations.brua,
          telemetry: () => `Статус БРУ-А: ${sim.bruAOpen ? 'ОТКРЫТ (Сброс в атмосферу)' : 'ЗАКРЫТ'}`
        },
        () => {
          sim.bruAOpen = !sim.bruAOpen;
          addLog(sim.bruAOpen ? 'Клапан БРУ-А открыт (выхлоп в атмосферу!)' : 'Клапан БРУ-А закрыт', sim.bruAOpen ? 'warn' : 'norm');
          sound.click(sim.bruAOpen ? 700 : 360);
        }
      );

      // ==========================================================================
      // МОДУЛЬ 6: ТУРБИНА К-1200-6,8/50 + ГЕНЕРАТОР ТЗВ-1200-2
      // ==========================================================================
      const turbX = 855, turbY = 180, turbW = 215, turbH = 230;
      const isTurbHov = sim.hoveredHotspot && sim.hoveredHotspot.x === turbX && sim.hoveredHotspot.y === turbY;
      const turbStatus = sim.electricalPowerMW > 1100 ? '#22c55e' : (sim.electricalPowerMW > 100 ? '#f59e0b' : '#dc2626');

      drawScadaModule({
        x: turbX, y: turbY, w: turbW, h: turbH,
        title: 'ТУРБИНА К-1200-6,8/50',
        subtitle: 'ГЕНЕРАТОР ТЗВ-1200-2 • 3000 ОБ/МИН',
        statusColor: turbStatus,
        isHovered: isTurbHov,
        rows: [
          { label: 'Nэл (мощность)', val: sim.electricalPowerMW.toFixed(1), unit: 'МВт', color: '#15803d' },
          { label: 'Частота сети f', val: (sim.turbineRpm / 60).toFixed(2), unit: 'Гц' },
          { label: 'Обороты вала n', val: sim.turbineRpm.toFixed(0), unit: 'об/мин' },
          { label: 'Клапан РК (пар)', val: sim.turbineValvePct.toFixed(0), unit: '%', color: '#15803d' },
          { label: 'P₀ перед РК', val: (sim.steamHeaderPressMPa * 0.96).toFixed(2), unit: 'МПа' },
          { label: 'КПД брутто', val: '35.8', unit: '%' },
          { label: 'Коэффициент cos φ', val: '0.85', unit: 'о.е.' }
        ]
      });

      activeHotspots.push({
        x: turbX, y: turbY, w: turbW, h: turbH,
        title: 'Турбогенератор К-1200-6,8/50 + ТЗВ-1200-2',
        sub: 'Машинный зал • Генерация электроэнергии',
        desc: 'Быстроходная паровая турбина со скоростью вращения 3000 об/мин (один ЦВД и три ЦНД) и синхронный трехфазный генератор 1200 МВт с водяным охлаждением статора.',
        simple: plainExplanations.turbine,
        telemetry: () => `Электрическая мощность: ${sim.electricalPowerMW.toFixed(1)} МВт | Обороты: ${Math.round(sim.turbineRpm)} об/мин`
      });

      // Регулирующий клапан турбины (РК)
      drawClickableArmature(
        870, 126, 185, 34,
        'КЛАПАН ПАРА ТУРБИНЫ (РК)',
        `ОТКРЫТ НА ${sim.turbineValvePct.toFixed(0)} %`,
        sim.turbineValvePct > 10 ? 'norm' : 'warn',
        {
          title: 'Стопорно-регулирующие клапаны турбины (РК)',
          sub: 'Регулирование расхода пара в проточную часть',
          desc: 'Кликните для циклического изменения уставки открытия РК (100% -> 50% -> 0% Стоп).',
          simple: plainExplanations.turbine,
          telemetry: () => `Открытие РК: ${sim.turbineValvePct.toFixed(0)}% | Nэлектр: ${sim.electricalPowerMW.toFixed(1)} МВт`
        },
        () => {
          const next = sim.turbineValvePct >= 90 ? 50 : (sim.turbineValvePct >= 40 ? 0 : 100);
          sim.turbineValvePct = next;
          addLog(`Клапаны турбины (РК) переведены в положение ${next}%`, next === 0 ? 'warn' : 'action');
          sound.click(next > 0 ? 590 : 380);
        }
      );

      // ==========================================================================
      // МОДУЛЬ 7: КОНДЕНСАТОР ТУРБИНЫ
      // ==========================================================================
      const condX = 1115, condY = 180, condW = 200, condH = 180;
      const isCondHov = sim.hoveredHotspot && sim.hoveredHotspot.x === condX && sim.hoveredHotspot.y === condY;

      drawScadaModule({
        x: condX, y: condY, w: condW, h: condH,
        title: 'КОНДЕНСАТОР ТУРБИНЫ',
        subtitle: 'ОХЛАЖДЕНИЕ ЦВ • ВАКУУМ',
        statusColor: '#22c55e',
        isHovered: isCondHov,
        rows: [
          { label: 'Pконд (вакуум)', val: '4.2', unit: 'кПа' },
          { label: 'Tконд (насыщение)', val: '29.8', unit: '°C' },
          { label: 'Lкб (уровень воды)', val: '1.45', unit: 'м' },
          { label: 'Gов (цирк. вода)', val: '45000', unit: 'м³/ч' },
          { label: 'Tов вх / вых', val: '18.0 / 27.2', unit: '°C' }
        ]
      });

      activeHotspots.push({
        x: condX, y: condY, w: condW, h: condH,
        title: 'Конденсатор турбины К-1200-6,8/50',
        sub: 'Конденсация отработавшего пара и создание глубокого вакуума',
        desc: 'Поверхностный теплообменник с титановыми трубками, через которые прокачивается охлаждающая вода от башенных градирен. Поддерживает вакуум ~4.2 кПа.',
        simple: plainExplanations.condenser,
        telemetry: () => `Давление в конденсаторе: 4.2 кПа | Прием БРУ-К: ${sim.bruKOpen ? 'АКТИВЕН' : 'НЕТ'}`
      });

      // ==========================================================================
      // МОДУЛЬ 8: ПЭН // ПИТАТЕЛЬНЫЕ ЭЛЕКТРОНАСОСЫ
      // ==========================================================================
      const penX = 1115, penY = 440, penW = 200, penH = 145;
      const isPenHov = sim.hoveredHotspot && sim.hoveredHotspot.x === penX && sim.hoveredHotspot.y === penY;
      const penStatus = sim.feedwaterFlowPct > 10 ? '#22c55e' : '#dc2626';

      drawScadaModule({
        x: penX, y: penY, w: penW, h: penH,
        title: 'ПЭН // ПИТАТЕЛЬНЫЕ НАСОСЫ',
        subtitle: 'ТРАКТ 225 °C • Pнагн=8.8 МПа',
        statusColor: penStatus,
        isHovered: isPenHov,
        rows: [
          { label: 'Подача ПЭН', val: sim.feedwaterFlowPct.toFixed(0), unit: '%', color: sim.feedwaterFlowPct > 10 ? '#15803d' : '#d97706' },
          { label: 'Расход Gпв', val: steamKgS.toFixed(0), unit: 'кг/с' },
          { label: 'Tпв (питат. вода)', val: '225.0', unit: '°C' },
          { label: 'Pнагнетания', val: (sim.steamHeaderPressMPa + 1.8).toFixed(2), unit: 'МПа' }
        ]
      });

      activeHotspots.push({
        x: penX, y: penY, w: penW, h: penH,
        title: 'Питательные электронасосы (ПЭН)',
        sub: 'Возврат конденсата и питательной воды в парогенераторы',
        desc: 'Насосные агрегаты высокого давления с подогревателями высокого давления (ПВД), обеспечивающими подачу воды при температуре 225 °C.',
        simple: plainExplanations.pen,
        telemetry: () => `Подача ПЭН: ${sim.feedwaterFlowPct.toFixed(0)}% | Ср. уровень в ПГВ: ${avgSgLevel.toFixed(2)} м`
      });

      // Регулирование ПЭН
      drawClickableArmature(
        1115, 595, 200, 34,
        'ПОДАЧА НАСОСОВ ПЭН',
        `РАСХОД ВОДЫ: ${sim.feedwaterFlowPct.toFixed(0)} %`,
        sim.feedwaterFlowPct > 10 ? 'norm' : 'warn',
        {
          title: 'Регулирование подачи питательных насосов (ПЭН)',
          sub: 'Управление уровнем воды в парогенераторах ПГВ-1000МКП',
          desc: 'Кликните для циклического изменения подачи питательной воды (100% -> 50% -> 0% СТОП).',
          simple: plainExplanations.pen,
          telemetry: () => `Расход питательной воды: ${sim.feedwaterFlowPct.toFixed(0)}%`
        },
        () => {
          const next = sim.feedwaterFlowPct >= 90 ? 50 : (sim.feedwaterFlowPct >= 40 ? 0 : 100);
          sim.feedwaterFlowPct = next;
          addLog(`Подача питательных насосов ПЭН установлена: ${next}%`, next === 0 ? 'alarm' : 'action');
          sound.click(next > 0 ? 560 : 350);
        }
      );
    }


    // ============================================================================
    // РЕЖИМ 1: ТЕХНОЛОГИЧЕСКАЯ СХЕМА 1-ГО И 2-ГО КОНТУРОВ (РАЗРЕЗ В-392М)
    // ============================================================================
    function renderCrossSectionView() {
      activeHotspots = [];

      // 1. ДВОЙНАЯ ЗАЩИТНАЯ ГЕРМООБОЛОЧКА (КОНТАЙНМЕНТ В-392М)
      ctx.save();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 5;
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(55, 650);
      ctx.lineTo(55, 220);
      ctx.arc(340, 220, 285, Math.PI, 0, false);
      ctx.lineTo(625, 650);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Внутренняя стальная облицовка гермооболочки
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.moveTo(65, 644);
      ctx.lineTo(65, 220);
      ctx.arc(340, 220, 275, Math.PI, 0, false);
      ctx.lineTo(615, 644);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillText('ДВОЙНАЯ ЗАЩИТНАЯ ГЕРМООБОЛОЧКА (ПРОЕКТ В-392М)', 200, 668);
      ctx.restore();

      // 2. СИСТЕМА ПАССИВНОГО ОТВОДА ТЕПЛА (СПОТ) В КУПОЛЕ ГЕРМООБОЛОЧКИ
      const spotColor = sim.spotActive ? '#1d4ed8' : '#475569';
      [
        { x: 115, y: 115, label: 'СПОТ-1 (Теплообменник)' },
        { x: 515, y: 115, label: 'СПОТ-2 (Теплообменник)' }
      ].forEach((sp, idx) => {
        ctx.save();
        roundRect(ctx, sp.x, sp.y, 54, 78, 6);
        ctx.fillStyle = sim.spotActive ? 'rgba(29, 78, 216, 0.08)' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Змеевик СПОТ и тяговая труба наружу купола
        ctx.strokeStyle = spotColor;
        ctx.lineWidth = 1.5;
        for (let y = sp.y + 14; y <= sp.y + 62; y += 12) {
          ctx.beginPath();
          ctx.moveTo(sp.x + 8, y);
          ctx.lineTo(sp.x + 46, y);
          ctx.stroke();
        }
        // Воздуховод с шибером
        ctx.beginPath();
        ctx.moveTo(sp.x + 27, sp.y);
        ctx.lineTo(sp.x + 27, sp.y - 36);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(idx === 0 ? 'СПОТ-1..2' : 'СПОТ-3..4', sp.x + 2, sp.y + 92);
        if (sim.spotActive) {
          ctx.fillStyle = '#15803d';
          ctx.fillText('ОТВОД ПАРА', sp.x - 4, sp.y - 42);
        }
        ctx.restore();

        activeHotspots.push({
          x: sp.x - 5, y: sp.y - 40, w: 65, h: 135,
          title: 'Система пассивного отвода тепла (СПОТ)',
          sub: '4 канала воздушных теплообменников (В-392М)',
          desc: 'При полном обесточивании АЭС отводит остаточное тепло от парогенераторов ПГВ-1000МКП за счет естественной циркуляции пара и атмосферного воздуха неограниченное время.',
          telemetry: () => `Статус шиберов: ${sim.spotActive ? 'ОТКРЫТЫ (Активный теплоотвод)' : 'ЗАКРЫТЫ (Ожидание)'} | P₂: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`
        });
      });

      // 3. ГИДРОЕМКОСТИ САОЗ (ГЕ-1, ГЕ-2, ГЕ-3)
      [
        { x: 88, y: 255, name: 'ГЕ-1 САОЗ' },
        { x: 145, y: 255, name: 'ГЕ-2 САОЗ' }
      ].forEach(ge => {
        ctx.save();
        roundRect(ctx, ge.x, ge.y, 44, 96, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Уровень борированной воды (16 г/кг)
        const hWater = (sim.saozWaterPct / 100) * 66;
        ctx.fillStyle = 'rgba(29, 78, 216, 0.15)';
        roundRect(ctx, ge.x + 3, ge.y + 92 - hWater, 38, hWater, 8);
        ctx.fill();

        // Линия подачи в корпус реактора с обратным клапаном
        ctx.strokeStyle = sim.saozActive ? '#15803d' : '#1d4ed8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ge.x + 22, ge.y + 96);
        ctx.lineTo(ge.x + 22, 382);
        ctx.lineTo(290, 382);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(ge.name, ge.x + 2, ge.y - 6);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${Math.round(sim.saozWaterPct)}%`, ge.x + 11, ge.y + 52);
        ctx.restore();

        if (sim.saozActive && sim.saozWaterPct > 0) {
          drawParticlesOnPath([[ge.x + 22, ge.y + 96], [ge.x + 22, 382], [290, 382]], 6, 2.5, '#15803d', 3);
        }

        activeHotspots.push({
          x: ge.x, y: ge.y, w: 44, h: 96,
          title: `Гидроемкость пассивной САОЗ (${ge.name})`,
          sub: 'Давление азотной подушки 5,9 МПа • H₃BO₃ 16 г/кг',
          desc: 'Пассивная система аварийного охлаждения активной зоны. При падении давления в 1-м контуре ниже 5,9 МПа обратные клапаны открываются автоматически без участия внешних источников тока.',
          telemetry: () => `Запас раствора бора: ${sim.saozWaterPct.toFixed(1)}% | Клапан: ${sim.saozActive ? 'ОТКРЫТ (Впрыск в реактор)' : 'ЗАКРЫТ'}`
        });
      });

      // 4. УСТРОЙСТВО ЛОКАЛИЗАЦИИ РАСПЛАВА (УЛР — «ЛОВУШКА РАСПЛАВА») ПОД РЕАКТОРОМ
      ctx.save();
      // Бетонная шахта реактора
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.rect(275, 515, 130, 125);
      ctx.fill();
      ctx.stroke();

      // Конический корпус ловушки расплава (УЛР) с жертвенным материалом
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(290, 540);
      ctx.lineTo(390, 540);
      ctx.lineTo(368, 622);
      ctx.lineTo(312, 622);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ферма-консоль и блоки жертвенного материала (Fe2O3 + Al2O3 + Gd2O3)
      for (let bx = 315; bx <= 355; bx += 14) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(bx, 582, 10, 28);
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('УЛР («ЛОВУШКА РАСПЛАВА»)', 273, 636);
      ctx.restore();

      activeHotspots.push({
        x: 275, y: 515, w: 130, h: 125,
        title: 'Устройство локализации расплава (УЛР)',
        sub: 'Ключевая система безопасности проекта В-392М (Поколение III+)',
        desc: 'Установлена на дне бетонной шахты строго под корпусом реактора ВВЭР-1200. Содержит кассеты жертвенного материала (оксиды железа, алюминия и гадолиния) для приема, охлаждения и перевода кориума в подкритическое состояние.',
        telemetry: () => `Статус шахты УЛР: ${sim.ulrCoolingActive ? 'ЗАПОЛНЕНА ОХЛАЖДАЮЩЕЙ ВОДОЙ' : 'СУХОЕ ОЖИДАНИЕ (НОРМА)'}`
      });

      // 5. ТРУБОПРОВОДЫ ГЛАВНОГО ЦИРКУЛЯЦИОННОГО КОНТУРА (ГОРЯЧИЕ И ХОЛОДНЫЕ НИТКИ)
      const flowSpeed = (sim.loops.reduce((s, l) => s + l.flowPct, 0) / 400) * 3.5;

      // Левая петля (символизирует Петли №1–2) и Правая петля (Петли №3–4 с КД)
      // Горячие нитки (насыщенный термический красный #dc2626, 328.9 °C)
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Левая горячая нитка (от реактора к левому ПГВ-1000МКП)
      const leftHotPath = [[290, 355], [225, 355], [225, 420]];
      ctx.beginPath();
      ctx.moveTo(290, 355);
      ctx.lineTo(225, 355);
      ctx.lineTo(225, 420);
      ctx.stroke();

      // Правая горячая нитка (от реактора к правому ПГВ-1000МКП)
      const rightHotPath = [[390, 355], [465, 355], [465, 420]];
      ctx.beginPath();
      ctx.moveTo(390, 355);
      ctx.lineTo(465, 355);
      ctx.lineTo(465, 420);
      ctx.stroke();

      // Холодные нитки (насыщенный холодный синий #1d4ed8, 298.2 °C, через ГЦНА-1391 обратно в реактор)
      ctx.strokeStyle = '#1d4ed8';
      const leftColdPath = [[140, 465], [140, 495], [245, 495], [245, 392], [290, 392]];
      ctx.beginPath();
      leftColdPath.forEach((p, idx) => idx === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.stroke();

      const rightColdPath = [[550, 465], [550, 495], [435, 495], [435, 392], [390, 392]];
      ctx.beginPath();
      rightColdPath.forEach((p, idx) => idx === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.stroke();
      ctx.restore();

      // Частицы потока в горячих и холодных нитках
      drawParticlesOnPath(leftHotPath, 5, flowSpeed, '#dc2626', 3.2);
      drawParticlesOnPath(rightHotPath, 5, flowSpeed, '#dc2626', 3.2);
      drawParticlesOnPath(leftColdPath, 8, flowSpeed, '#1d4ed8', 3.2);
      drawParticlesOnPath(rightColdPath, 8, flowSpeed, '#1d4ed8', 3.2);

      // 6. ГОРИЗОНТАЛЬНЫЕ ПАРОГЕНЕРАТОРЫ ПГВ-1000МКП (ЛЕВЫЙ И ПРАВЫЙ БЛОКИ)
      [
        { x: 92, y: 405, w: 155, h: 66, name: 'ПГВ-1000МКП (ПГ-1,2)', loopIdx: 0 },
        { x: 442, y: 405, w: 155, h: 66, name: 'ПГВ-1000МКП (ПГ-3,4)', loopIdx: 3 }
      ].forEach(sg => {
        const lp = sim.loops[sg.loopIdx];
        ctx.save();
        roundRect(ctx, sg.x, sg.y, sg.w, sg.h, 24);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Водяной объем 2-го контура в ПГВ
        const lvlRatio = Math.max(0.15, Math.min(0.88, lp.sgLevelM / 2.8));
        const waterH = sg.h * lvlRatio;
        ctx.save();
        roundRect(ctx, sg.x + 2, sg.y + 2, sg.w - 4, sg.h - 4, 22);
        ctx.clip();
        ctx.fillStyle = 'rgba(29, 78, 216, 0.12)';
        ctx.fillRect(sg.x, sg.y + sg.h - waterH, sg.w, waterH);

        // Теплообменный пучок U-образных трубок 1-го контура внутри ПГВ
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
        ctx.lineWidth = 1.4;
        for (let ty = sg.y + 24; ty <= sg.y + 56; ty += 6) {
          ctx.beginPath();
          ctx.moveTo(sg.x + 18, ty);
          ctx.lineTo(sg.x + sg.w - 18, ty);
          ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(sg.name, sg.x + 18, sg.y + 16);
        ctx.fillStyle = '#0f172a';
        ctx.font = '9px monospace';
        ctx.fillText(`P₂=${lp.sgPressMPa.toFixed(2)} МПа | H=${lp.sgLevelM.toFixed(2)} м`, sg.x + 14, sg.y + 36);
        ctx.restore();

        activeHotspots.push({
          x: sg.x, y: sg.y, w: sg.w, h: sg.h,
          title: `Горизонтальный парогенератор ${sg.name}`,
          sub: 'ПГВ-1000МКП • Поверхность теплообмена 6115 м² (10978 труб)',
          desc: 'Передает тепло от радиоактивного теплоносителя 1-го контура к питательной воде 2-го контура, генерируя сухой насыщенный пар давлением 7,0 МПа при температуре 285,8 °C.',
          telemetry: () => `Давление пара: ${lp.sgPressMPa.toFixed(2)} МПа | Уровень воды: ${lp.sgLevelM.toFixed(2)} м | T_гор: ${lp.tHot.toFixed(1)} °C → T_хол: ${lp.tCold.toFixed(1)} °C`
        });
      });

      // 7. ГЛАВНЫЕ ЦИРКУЛЯЦИОННЫЕ НАСОСНЫЕ АГРЕГАТЫ (ГЦНА-1391)
      [
        { x: 192, y: 495, name: 'ГЦНА-1,2', loopIdx: 0 },
        { x: 488, y: 495, name: 'ГЦНА-3,4', loopIdx: 3 }
      ].forEach(p => {
        const lp = sim.loops[p.loopIdx];
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Вращающаяся крыльчатка ГЦНА-1391
        const angle = sim.time * (lp.rpm / 1000) * 9.0;
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.strokeStyle = lp.pumpOn ? '#1d4ed8' : '#b45309';
        ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(13, 4);
          ctx.stroke();
        }
        ctx.restore();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(p.name, p.x - 24, p.y + 32);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(`${Math.round(lp.rpm)} об/м`, p.x - 26, p.y + 43);

        activeHotspots.push({
          x: p.x - 22, y: p.y - 22, w: 44, h: 44,
          title: `Главный циркуляционный насос ${p.name} (ГЦНА-1391)`,
          sub: 'Мощность электродвигателя 6700 кВт • Подача 21400 м³/ч',
          desc: 'Обеспечивает принудительную циркуляцию теплоносителя 1-го контура через активную зону реактора. Снабжен маховиком для плавного выбега и перехода на естественную циркуляцию при обесточивании.',
          telemetry: () => `Статус: ${lp.pumpOn ? 'В РАБОТЕ' : 'ВЫБЕГ / ЕЦ'} | Обороты: ${Math.round(lp.rpm)} об/мин | Расход петли: ${lp.flowPct.toFixed(1)}%`
        });
      });

      // 8. КОМПЕНСАТОР ДАВЛЕНИЯ (КД) НА 4-Й ПЕТЛЕ
      const kdX = 438, kdY = 215, kdW = 48, kdH = 115;
      ctx.save();
      // Трубопровод дыхательной линии от горячей нитки петли №4 к КД
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(455, 355);
      ctx.lineTo(455, kdY + kdH);
      ctx.stroke();

      // Сосуд КД
      roundRect(ctx, kdX, kdY, kdW, kdH, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Уровень воды и паровая подушка в КД
      const kdWaterRatio = Math.max(0.15, Math.min(0.92, sim.pressurizerLevelM / 11.0));
      const kdWaterH = (kdH - 8) * kdWaterRatio;
      ctx.fillStyle = 'rgba(29, 78, 216, 0.15)';
      roundRect(ctx, kdX + 3, kdY + kdH - 4 - kdWaterH, kdW - 6, kdWaterH, 12);
      ctx.fill();

      // Блок электронагревателей (ТЭНы КД) в нижней части КД
      ctx.strokeStyle = sim.heatersPowerKW > 100 ? '#b91c1c' : '#475569';
      ctx.lineWidth = 2;
      for (let hx = kdX + 10; hx <= kdX + 38; hx += 7) {
        ctx.beginPath();
        ctx.moveTo(hx, kdY + kdH - 6);
        ctx.lineTo(hx, kdY + kdH - 22);
        ctx.stroke();
      }

      // Впрыск холодной воды сверху в паровую подушку КД
      if (sim.sprayActive) {
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.5;
        for (let a = -0.35; a <= 0.35; a += 0.35) {
          ctx.beginPath();
          ctx.moveTo(kdX + kdW / 2, kdY + 6);
          ctx.lineTo(kdX + kdW / 2 + a * 26, kdY + 28);
          ctx.stroke();
        }
      }

      // ИПУ КД (на макушке КД)
      if (sim.ipuKdOpen) {
        ctx.fillStyle = '#b91c1c';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('СБРОС ИПУ КД!', kdX - 12, kdY - 18);
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('КД', kdX + 16, kdY - 6);
      ctx.fillStyle = '#0f172a';
      ctx.font = '9px monospace';
      ctx.fillText(`${sim.primaryPressureMPa.toFixed(1)} МПа`, kdX + 3, kdY + 32);
      ctx.fillText(`${sim.pressurizerLevelM.toFixed(1)} м`, kdX + 9, kdY + 46);
      ctx.restore();

      activeHotspots.push({
        x: kdX, y: kdY, w: kdW, h: kdH,
        title: 'Компенсатор давления (КД)',
        sub: 'Объем 79 м³ • Блок ТЭНов 2700 кВт • ИПУ КД',
        desc: 'Поддерживает номинальное давление 1-го контура 16,2 МПа за счет баланса воды и паровой подушки. При росте давления включается впрыск холодной воды, при снижении — электронагреватели (ТЭНы).',
        telemetry: () => `Давление P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа | Уровень КД: ${sim.pressurizerLevelM.toFixed(2)} м | Мощность ТЭНов: ${sim.heatersPowerKW} кВт`
      });

      // 9. КОРПУС РЕАКТОРА ВВЭР-1200 (В-392М) В ЦЕНТРЕ ШАХТЫ
      const rxX = 290, rxY = 235, rxW = 100, rxH = 265;
      ctx.save();

      // Верхний блок с приводами ШЭМ-3 (шаговые электромагнитные приводы ОР СУЗ)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      for (let cx = rxX + 14; cx <= rxX + rxW - 14; cx += 12) {
        ctx.fillRect(cx - 3, rxY - 58, 6, 58);
        ctx.strokeRect(cx - 3, rxY - 58, 6, 58);
      }

      // Основной цилиндрический корпус реактора со сферическим днищем
      roundRect(ctx, rxX, rxY, rxW, rxH, 38);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Динамическое свечение Вавилова-Черенкова в активной зоне (зависит от нейтронного потока)
      const coreY = rxY + 115;
      const coreH = 108;
      const cherenkovAlpha = Math.max(0.08, Math.min(0.85, sim.neutronFlux * 0.75));
      const coreGrad = ctx.createRadialGradient(rxX + rxW / 2, coreY + coreH / 2, 6, rxX + rxW / 2, coreY + coreH / 2, 65);
      coreGrad.addColorStop(0, `rgba(29, 78, 216, ${cherenkovAlpha})`);
      coreGrad.addColorStop(0.55, `rgba(56, 189, 248, ${cherenkovAlpha * 0.65})`);
      coreGrad.addColorStop(1, 'rgba(241, 245, 249, 0.1)');
      ctx.fillStyle = coreGrad;
      roundRect(ctx, rxX + 8, coreY - 6, rxW - 16, coreH + 12, 10);
      ctx.fill();

      // Кассеты активной зоны (163 ТВС-2М в вертикальном разрезе)
      const fuelHeatRatio = Math.max(0, Math.min(1, (sim.fuelTempC - 290) / 700));
      for (let col = 0; col < 7; col++) {
        const fx = rxX + 14 + col * 11;
        let cCol;
        if (fuelHeatRatio < 0.25) cCol = '#cbd5e1';
        else if (fuelHeatRatio < 0.65) cCol = '#fef08a';
        else cCol = '#f97316';
        ctx.fillStyle = cCol;
        ctx.fillRect(fx, coreY, 8, coreH);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(fx, coreY, 8, coreH);
      }

      // Кластеры поглощающих стержней ОР СУЗ (Группы 1-9 и Рабочая группа №10), опускающиеся сверху
      for (let col = 0; col < 7; col++) {
        const rxColX = rxX + 18 + col * 11;
        const isGroup10 = (col === 1 || col === 3 || col === 5);
        const posPct = isGroup10 ? sim.group10Pos : sim.groups1to9Pos;
        const rodTipY = coreY + ((100 - posPct) / 100) * coreH;

        ctx.strokeStyle = isGroup10 ? '#1d4ed8' : '#b45309';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(rxColX, rxY + 18);
        ctx.lineTo(rxColX, rodTipY);
        ctx.stroke();
      }

      // Четкая информационная плашка реактора в светлой теме
      roundRect(ctx, rxX + 6, rxY + 12, rxW - 12, 58, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ВВЭР-1200', rxX + rxW / 2, rxY + 28);
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${Math.round(sim.thermalPowerMW)} МВт (100%)`, rxX + rxW / 2, rxY + 43);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(`Гр10:${Math.round(sim.group10Pos)}% | P₁:16.2 МПа`, rxX + rxW / 2, rxY + 58);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText('163 ТВС-2М', rxX + 18, coreY + coreH + 18);
      ctx.restore();

      activeHotspots.push({
        x: rxX, y: rxY - 58, w: rxW, h: rxH + 58,
        title: 'Реактор ВВЭР-1200 (Проект В-392М)',
        sub: 'Тепловая мощность 3200 МВт • 163 ТВС-2М • 121 кластер ОР СУЗ (ШЭМ-3)',
        desc: 'Водо-водяной энергетический реактор под давлением Поколения III+. Обладает внутренней самозащищенностью благодаря отрицательным температурным коэффициентам реактивности топлива (эффект Допплера) и теплоносителя.',
        telemetry: () => `Nтепл: ${sim.thermalPowerMW.toFixed(1)} МВт | Tвх: ${sim.coreInletTempC.toFixed(1)} °C | Tвых: ${sim.coreOutletTempC.toFixed(1)} °C | ОР СУЗ Гр.10: ${sim.group10Pos.toFixed(1)}%`
      });

      // ==========================================================================
      // 10. МАШИННЫЙ ЗАЛ (2-Й КОНТУР: ГПК, БРУ-К/А, ТУРБИНА К-1200-6,8/50, ТЗВ-1200-2, КОНДЕНСАТОР, ПЭН)
      // ==========================================================================
      ctx.save();
      // Контур здания машинного зала (светлый конструкционный бетон #f1f5f9 с границей #64748b)
      roundRect(ctx, 650, 75, 425, 575, 8);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.fillText('МАШИННЫЙ ЗАЛ (2-Й КОНТУР • ТУРБОАГРЕГАТ К-1200-6,8/50)', 685, 668);

      // Паропроводы свежего пара от ПГВ-1000МКП к Главному паровому коллектору (ГПК)
      const steamPathToGPK = [[515, 405], [515, 165], [705, 165]];
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      steamPathToGPK.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.stroke();
      drawParticlesOnPath(steamPathToGPK, 8, (sim.thermalPowerMW / 3200) * 3.8, '#cbd5e1', 3.0);

      // Главный паровой коллектор (ГПК) + БРУ-А и БРУ-К
      roundRect(ctx, 685, 135, 130, 56, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('ГПК (ПАР 2 КОНТ.)', 698, 154);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`P₂=${sim.steamHeaderPressMPa.toFixed(2)} МПа | ${sim.steamTempC.toFixed(1)}°C`, 693, 174);

      // Индикация БРУ-А и БРУ-К
      ctx.fillStyle = sim.bruAOpen ? '#b91c1c' : '#64748b';
      ctx.fillText(`БРУ-А: ${sim.bruAOpen ? 'СБРОС!' : 'ЗАКР'}`, 688, 125);
      ctx.fillStyle = sim.bruKOpen ? '#1d4ed8' : '#64748b';
      ctx.fillText(`БРУ-К: ${sim.bruKOpen ? 'СБРОС!' : 'ЗАКР'}`, 762, 125);

      activeHotspots.push({
        x: 685, y: 115, w: 130, h: 78,
        title: 'Главный паровой коллектор (ГПК) и БРУ-К / БРУ-А',
        sub: 'Давление свежего пара 7,0 МПа • Температура 285,8 °C',
        desc: 'Объединяет паропроводы от 4 парогенераторов ПГВ-1000МКП и направляет пар через стопорно-регулирующие клапаны (СК/РК) на турбину К-1200-6,8/50. Оснащен БРУ-К и БРУ-А для сброса избытка пара.',
        telemetry: () => `Давление ГПК: ${sim.steamHeaderPressMPa.toFixed(2)} МПа | БРУ-К: ${sim.bruKOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ'} | БРУ-А: ${sim.bruAOpen ? 'ОТКРЫТ' : 'ЗАКРЫТ'}`
      });

      // Паропровод от ГПК к ЦВД/ЦНД турбины К-1200-6,8/50
      const gpkToTurbine = [[750, 191], [750, 265]];
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(750, 191);
      ctx.lineTo(750, 265);
      ctx.stroke();
      if (sim.turbineValvePct > 2) {
        drawParticlesOnPath(gpkToTurbine, 4, (sim.turbineValvePct / 100) * 4.0, '#cbd5e1', 3.0);
      }

      // Цилиндры паровой турбины К-1200-6,8/50 (ЦВД + 2 ЦНД)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      // Трапеция ЦВД/ЦНД
      ctx.beginPath();
      ctx.moveTo(685, 275);
      ctx.lineTo(835, 250);
      ctx.lineTo(835, 340);
      ctx.lineTo(685, 315);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Вал к генератору ТЗВ-1200-2
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(835, 295);
      ctx.lineTo(885, 295);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('ТУРБИНА К-1200-6,8/50', 696, 292);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`РК: ${Math.round(sim.turbineValvePct)}% | ${Math.round(sim.turbineRpm)} об/м`, 696, 308);

      activeHotspots.push({
        x: 685, y: 250, w: 150, h: 90,
        title: 'Паровая турбина К-1200-6,8/50',
        sub: 'Быстроходная (3000 об/мин, 50 Гц) • Мощность 1200 МВт',
        desc: 'Однохвальная паровая турбина со схемой ЦВД + 2×ЦНД и промежуточной сепарацией и перегревом пара (СПП). Преобразует тепловую энергию пара 7,0 МПа во вращение ротора генератора.',
        telemetry: () => `Обороты ротора: ${Math.round(sim.turbineRpm)} об/мин | Открытие РК: ${sim.turbineValvePct.toFixed(0)}% | Электрическая мощность: ${sim.electricalPowerMW.toFixed(1)} МВт`
      });

      // Электрогенератор ТЗВ-1200-2 (с полным водяным охлаждением)
      roundRect(ctx, 885, 255, 165, 80, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('ГЕНЕРАТОР ТЗВ-1200-2', 902, 282);
      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${sim.electricalPowerMW.toFixed(1)} МВт (24 кВ)`, 902, 304);
      ctx.fillStyle = '#0f172a';
      ctx.font = '9px monospace';
      ctx.fillText('ВЫДАЧА В ЭНЕРГОСИСТЕМУ 500 кВ', 895, 322);

      activeHotspots.push({
        x: 885, y: 255, w: 165, h: 80,
        title: 'Турбогенератор ТЗВ-1200-2',
        sub: 'Трехфазный синхронный генератор • 1200 МВт • 24 кВ • 50 Гц',
        desc: 'Генератор серии ТЗВ с полным водяным охлаждением обмоток статора и ротора (взрывопожаробезопасное исполнение без водорода).',
        telemetry: () => `Активная мощность Nэ: ${sim.electricalPowerMW.toFixed(1)} МВт | Частота сети: ${(sim.turbineRpm / 60).toFixed(1)} Гц`
      });

      // Конденсатор турбины под ЦНД
      roundRect(ctx, 685, 385, 165, 85, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Сброс отработавшего пара из ЦНД в конденсатор
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(765, 340);
      ctx.lineTo(765, 385);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('КОНДЕНСАТОР ТУРБИНЫ', 705, 415);
      ctx.fillStyle = '#0f172a';
      ctx.font = '9px monospace';
      ctx.fillText('Вакуум: 4,2 кПа | Tконд: 30°C', 698, 435);
      ctx.fillText('Охлаждение от градирен', 705, 452);

      activeHotspots.push({
        x: 685, y: 385, w: 165, h: 85,
        title: 'Конденсатор турбины К-1200-6,8/50',
        sub: 'Давление в конденсаторе ~4,2 кПа',
        desc: 'Конденсирует отработавший в турбине пар (а также пар при открытии БРУ-К) в основной конденсат, который затем через систему регенерации и деаэратор подается питательными насосами обратно в ПГВ-1000МКП.',
        telemetry: () => `Расход питательной воды: ${sim.feedwaterFlowPct.toFixed(0)}% | БРУ-К: ${sim.bruKOpen ? 'ПРИЕМ ПАРА' : 'ЗАКРЫТ'}`
      });

      // Питательные электронасосы (ПЭН / ПТН) и тракт питательной воды обратно в ПГВ-1000МКП
      const fwPath = [[765, 470], [765, 560], [515, 560], [515, 471]];
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      fwPath.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.stroke();
      if (sim.feedwaterFlowPct > 2) {
        drawParticlesOnPath(fwPath, 9, (sim.feedwaterFlowPct / 100) * 3.5, '#1d4ed8', 3.0);
      }

      // Иконка ПЭН
      ctx.beginPath();
      ctx.arc(685, 560, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('ПЭН/ПТН', 663, 594);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${Math.round(sim.feedwaterFlowPct)}%`, 674, 564);

      activeHotspots.push({
        x: 663, y: 538, w: 45, h: 45,
        title: 'Питательные насосные агрегаты (ПТН / ПЭН)',
        sub: 'Подача питательной воды (225 °C) в 4 парогенератора ПГВ-1000МКП',
        desc: 'Обеспечивают поддержание номинального уровня котловой воды (2,10 м) во всех четырех горизонтальных парогенераторах 2-го контура.',
        telemetry: () => `Производительность ПЭН: ${sim.feedwaterFlowPct.toFixed(0)}% | Ср. уровень в ПГВ: ${(sim.loops.reduce((s, l) => s + l.sgLevelM, 0) / 4).toFixed(2)} м`
      });

      ctx.restore();
    }

    // ============================================================================
    // РЕЖИМ 2: СХЕМА 4 ПЕТЕЛЬ ГЦК (ВИД СВЕРХУ)
    // ============================================================================
    function renderFourLoopsPlanView() {
      activeHotspots = [];
      const cx = 550, cy = 360;

      ctx.save();

      // Светлый технологический фон темы (#cbd5e1)
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 1160, 720);

      // Заголовок схемы (смещен на y=52 для исключения перекрытия панелью инструментов)
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13.5px "Segoe UI", sans-serif';
      ctx.fillText('СИММЕТРИЧНАЯ КОМПОНОВКА 4 ПЕТЕЛЬ ГЛАВНОГО ЦИРКУЛЯЦИОННОГО КОНТУРА (ВИД СВЕРХУ)', 225, 52);

      // Окружность защитной оболочки: контур стальной #475569 с мягкой светлой заливкой #e2e8f0
      ctx.beginPath();
      ctx.arc(cx, cy, 305, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Внутренний контур стальной облицовки гермооболочки
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, 296, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4 петли под углами 45°, 135°, 225°, 315°
      const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];

      angles.forEach((ang, idx) => {
        const lp = sim.loops[idx];
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const perpX = -sin;
        const perpY = cos;

        // Координаты горизонтального парогенератора ПГВ-1000МКП и насоса ГЦНА-1391
        const sgX = cx + cos * 185 + perpX * 32;
        const sgY = cy + sin * 185 + perpY * 32;
        const pumpX = cx + cos * 170 - perpX * 68;
        const pumpY = cy + sin * 170 - perpY * 68;

        // Горячая нитка (из реактора в ПГВ-1000МКП) — насыщенный горячий красный #dc2626
        const hotPath = [
          [cx + cos * 58, cy + sin * 58],
          [sgX, sgY]
        ];
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hotPath[0][0], hotPath[0][1]);
        ctx.lineTo(hotPath[1][0], hotPath[1][1]);
        ctx.stroke();

        // Холодная нитка (из ПГВ-1000МКП через ГЦНА-1391 обратно в реактор) — насыщенный холодный синий #1d4ed8
        const coldPath = [
          [sgX - perpX * 26, sgY - perpY * 26],
          [pumpX, pumpY],
          [cx + cos * 58 - perpX * 18, cy + sin * 58 - perpY * 18]
        ];
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        coldPath.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        ctx.stroke();

        // Частицы в петле
        const spd = (lp.flowPct / 100) * 3.2;
        drawParticlesOnPath(hotPath, 5, spd, '#f97316', 3.4);
        drawParticlesOnPath(coldPath, 6, spd, '#38bdf8', 3.4);

        // Отрисовка горизонтального ПГВ-1000МКП — белый корпус #ffffff с окантовкой 2px #334155
        ctx.save();
        ctx.translate(sgX, sgY);
        ctx.rotate(ang + Math.PI / 2);
        roundRect(ctx, -68, -28, 136, 56, 22);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Пучок теплообменных труб
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
        ctx.lineWidth = 1.4;
        for (let y = -14; y <= 14; y += 7) {
          ctx.beginPath();
          ctx.moveTo(-48, y);
          ctx.lineTo(48, y);
          ctx.stroke();
        }
        ctx.restore();

        // Подпись ПГВ-1000МКП — четкий темный текст #0f172a
        const sgOffsets = [
          { titleY: sgY - 36, teleX: sgX - 5, teleY: sgY + 44 }, // Петля 1
          { titleY: sgY - 36, teleX: sgX + 12, teleY: sgY + 44 }, // Петля 2
          { titleY: sgY - 36, teleX: sgX + 12, teleY: sgY + 44 }, // Петля 3
          { titleY: sgY - 36, teleX: sgX - 5, teleY: sgY + 44 }  // Петля 4
        ];
        const sgOff = sgOffsets[idx];

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`ПЕТЛЯ №${idx + 1} • ПГВ-${idx + 1}`, sgX, sgOff.titleY);
        ctx.fillStyle = '#0f172a';
        ctx.font = '10px monospace';
        ctx.fillText(`Tг=${lp.tHot.toFixed(1)}°C | P₂=${lp.sgPressMPa.toFixed(2)} МПа`, sgOff.teleX, sgOff.teleY);
        ctx.restore();

        activeHotspots.push({
          x: sgX, y: sgY, r: 48,
          title: `Парогенератор ПГВ-1000МКП (Петля №${idx + 1})`,
          sub: `Горизонтальный парогенератор ПГ-${idx + 1} • Паропроизводительность 1600 т/ч`,
          desc: 'Воспринимает тепло от горячей нитки петли ГЦК и вырабатывает насыщенный пар 7,0 МПа для главного парового коллектора турбины.',
          telemetry: () => `T_гор: ${lp.tHot.toFixed(1)} °C | T_хол: ${lp.tCold.toFixed(1)} °C | Уровень ПГ-${idx + 1}: ${lp.sgLevelM.toFixed(2)} м | P пара: ${lp.sgPressMPa.toFixed(2)} МПа`
        });

        // Отрисовка ГЦНА-1391 — белый корпус #ffffff с окантовкой 2px #334155
        ctx.save();
        ctx.beginPath();
        ctx.arc(pumpX, pumpY, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Крыльчатка
        ctx.translate(pumpX, pumpY);
        ctx.rotate(sim.time * (lp.rpm / 1000) * 8.0);
        ctx.strokeStyle = lp.pumpOn ? '#1d4ed8' : '#b45309';
        ctx.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(15, 5);
          ctx.stroke();
        }
        ctx.restore();

        // Подпись ГЦНА-1391 — четкий темный текст #0f172a (смещение с учетом квадранта)
        const pumpOffsets = [
          { x: pumpX - 42, y: pumpY + 36 }, // Петля 1 (влево-вниз)
          { x: pumpX - 34, y: pumpY - 32 }, // Петля 2 (влево-вверх, вне корпуса ПГ-2)
          { x: pumpX + 38, y: pumpY - 32 }, // Петля 3 (вправо-вверх, вне корпуса ПГ-3)
          { x: pumpX + 42, y: pumpY + 36 }  // Петля 4 (вправо-вниз)
        ];
        const pOff = pumpOffsets[idx];

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`ГЦНА-${idx + 1} (${Math.round(lp.rpm)} об/м)`, pOff.x, pOff.y);
        ctx.restore();

        activeHotspots.push({
          x: pumpX, y: pumpY, r: 26,
          title: `Главный циркуляционный насос ГЦНА-${idx + 1} (ГЦНА-1391)`,
          sub: `Петля ГЦК №${idx + 1} • Холодная нитка (${lp.tCold.toFixed(1)} °C)`,
          desc: 'Перекачивает охлажденный в парогенераторе теплоноситель обратно во входной патрубок реактора ВВЭР-1200.',
          telemetry: () => `Статус: ${lp.pumpOn ? 'ВКЛЮЧЕН' : 'ОТКЛЮЧЕН (ЕЦ)'} | Обороты: ${Math.round(lp.rpm)} об/мин | Расход: ${lp.flowPct.toFixed(1)}%`
        });

        // На 4-й петле рисуем подключенный Компенсатор давления (КД)
        if (idx === 3) {
          const kdPlanX = cx - 235;
          const kdPlanY = cy + 25;
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(cx + cos * 110, cy + sin * 110);
          ctx.lineTo(kdPlanX, kdPlanY);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(kdPlanX, kdPlanY, 28, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('КД (ПЕТЛЯ №4)', kdPlanX, kdPlanY - 34);
          ctx.fillStyle = '#b91c1c';
          ctx.fillText(`${sim.primaryPressureMPa.toFixed(2)} МПа`, kdPlanX, kdPlanY + 4);
          ctx.restore();

          activeHotspots.push({
            x: kdPlanX, y: kdPlanY, r: 28,
            title: 'Компенсатор давления (КД на Петле №4)',
            sub: 'Подключен дыхательным трубопроводом к горячей нитке Петли №4',
            desc: 'Поддерживает давление 16,2 МПа во всем 1-м контуре.',
            telemetry: () => `P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа | Уровень: ${sim.pressurizerLevelM.toFixed(2)} м | ТЭНы: ${sim.heatersPowerKW} кВт`
          });
        }
      });

      // Центральный корпус реактора ВВЭР-1200 (Вид сверху) — светлый #ffffff с окантовкой 2.5px #334155
      ctx.beginPath();
      ctx.arc(cx, cy, 64, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Свечение Черенкова в центре
      const radGlow = ctx.createRadialGradient(cx, cy, 5, cx, cy, 56);
      radGlow.addColorStop(0, `rgba(59, 130, 246, ${Math.min(0.65, sim.neutronFlux * 0.6)})`);
      radGlow.addColorStop(1, 'rgba(241, 245, 249, 0.2)');
      ctx.fillStyle = radGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, 56, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('ВВЭР-1200', cx, cy - 6);
      ctx.fillStyle = '#1d4ed8';
      ctx.fillText(`${Math.round(sim.thermalPowerMW)} МВт`, cx, cy + 10);
      ctx.restore();

      activeHotspots.push({
        x: cx, y: cy, r: 64,
        title: 'Корпус реактора ВВЭР-1200 (Центральная ось)',
        sub: '4 входных и 4 выходных патрубка Ду 850 мм',
        desc: 'Кликните на вкладку «Картограмма активной зоны (163 ТВС)», чтобы детально исследовать каждую из 163 тепловыделяющих сборок.',
        telemetry: () => `Nтепл: ${sim.thermalPowerMW.toFixed(1)} МВт | ΔT зоны: ${(sim.coreOutletTempC - sim.coreInletTempC).toFixed(1)} °C`
      });

      ctx.restore();
    }

// Явная фиксация экспорта в глобальный объект window
window.roundRect = roundRect;
window.drawParticlesOnPath = drawParticlesOnPath;
window.drawClickableArmature = drawClickableArmature;
window.drawScadaModule = drawScadaModule;
window.drawPipeLabel = drawPipeLabel;
window.renderPanoramicSystemsView = renderPanoramicSystemsView;
window.renderCrossSectionView = renderCrossSectionView;
window.renderFourLoopsPlanView = renderFourLoopsPlanView;
