// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (проект В-491, ЛАЭС-2)
// views_2d.js — Мнемосхемы 2D-систем (панорама, разрез, 4 петли ГЦК)
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

// Опознавательная окраска сред по ГОСТ 14202-69 (PROJECT_MAP, раздел 4.2)
var GOST_MEDIA = {
  WATER: '#15803D',   // вода: теплоноситель, конденсат, питательная, борированная, техническая
  STEAM: '#DC2626',   // пар
  AIR: '#2563EB',     // воздух
  ALKALI: '#7C3AED',  // щёлочи
  RINGS: '#EAB308',   // жёлтые предупреждающие кольца: радиоактивная среда
  WATER_FILL: 'rgba(21, 128, 61, 0.22)',
  ON: '#DC2626',      // включено / открыто (советская условность)
  OFF: '#16A34A'      // отключено / закрыто
};
window.GOST_MEDIA = GOST_MEDIA;

// Жёлтые кольца поверх уже построенного пути (ctx.stroke() путь не сбрасывает)
function strokeRadioactiveRings(lineWidth) {
  ctx.save();
  ctx.setLineDash([3, 26]);
  ctx.lineCap = 'butt';
  ctx.lineWidth = (lineWidth || 2.6) + 5;
  ctx.strokeStyle = GOST_MEDIA.RINGS;
  ctx.stroke();
  ctx.restore();
}
window.strokeRadioactiveRings = strokeRadioactiveRings;

function getThermalColor(tempC) {
  if (tempC > 350) return THERMAL_COLOR_SCALE.CRITICAL_OVERHEAT;
  if (tempC >= 280) return THERMAL_COLOR_SCALE.REACTOR_CORE;
  if (tempC >= 100) return THERMAL_COLOR_SCALE.HOT_STEAM;
  if (tempC >= 45) return GOST_MEDIA.WATER;
  return GOST_MEDIA.WATER;
}
window.getThermalColor = getThermalColor;

function drawFlowArrow(x, y, angle, color, size = 5.5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.85, -size * 0.65);
  ctx.lineTo(-size * 0.85, size * 0.65);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
window.drawFlowArrow = drawFlowArrow;

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

    function drawEquipmentLabel(title, x, y, align = 'center', color = '#0F172A') {
      ctx.save();
      ctx.font = '600 10.5px "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = align;
      const w = ctx.measureText(title).width;
      const left = align === 'center' ? x - w / 2 : (align === 'right' ? x - w : x);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(left - 4, y - 8, w + 8, 16, 3);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(title, x, y);
      ctx.restore();
    }

    function drawCoreCatcher(cx, topY, width, height, cooling, highlighted) {
      const half = width / 2;
      const shoulderY = topY + height * 0.38;
      const bottomHalf = width * 0.16;
      const outline = (inset) => {
        ctx.beginPath();
        ctx.moveTo(cx - half + inset, topY);
        ctx.lineTo(cx - half + inset, shoulderY);
        ctx.lineTo(cx - bottomHalf + inset * 0.5, topY + height - inset);
        ctx.lineTo(cx + bottomHalf - inset * 0.5, topY + height - inset);
        ctx.lineTo(cx + half - inset, shoulderY);
        ctx.lineTo(cx + half - inset, topY);
      };

      ctx.save();
      outline(0);
      ctx.closePath();
      ctx.fillStyle = cooling ? 'rgba(14, 165, 233, 0.28)' : '#E2E8F0';
      ctx.fill();

      // Жертвенный материал в кассетах внутри корпуса
      outline(6);
      ctx.closePath();
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      for (let y = topY + 7; y < topY + height; y += 7) {
        ctx.beginPath();
        ctx.moveTo(cx - half, y);
        ctx.lineTo(cx + half, y);
        ctx.stroke();
      }
      ctx.restore();

      outline(0);
      ctx.strokeStyle = highlighted ? '#0284C7' : (cooling ? '#16A34A' : '#1E293B');
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - half - 6, topY);
      ctx.lineTo(cx - half + 8, topY);
      ctx.moveTo(cx + half - 8, topY);
      ctx.lineTo(cx + half + 6, topY);
      ctx.stroke();
      ctx.restore();
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

    // ============================================================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ SCADA В ТЕМНО-ГРАФИТОВОЙ ТЕМЕ
    // ============================================================================

    // Вспомогательная функция отрисовки кликабельного узла арматуры / клапана на мнемосхеме [СИСТЕМЫ]
    // Мнемоническое отображение положения: открыта — зеленый (#22c55e) с линией свободного прохода;
    // закрыта — темный графит с перекрестием (#ef4444).
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
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#0284C7' : (isOpen ? '#16A34A' : (statusType === 'danger' ? '#DC2626' : '#1E293B'));
      ctx.lineWidth = isHovered ? 2 : 1.2;
      ctx.stroke();

      // Символ задвижки (два противоположных треугольника / бабочка)
      const vx = x + 15;
      const vy = y + h / 2;

      if (isOpen) {
        // Открыта: заливка зеленым (#22c55e) с линией свободного прохода
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#15803d';
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
        // Закрыта: корпус (#E2E8F0) с перекрестием
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#334155';
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
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(vx - 5, vy - 5);
        ctx.lineTo(vx + 5, vy + 5);
        ctx.moveTo(vx - 5, vy + 5);
        ctx.lineTo(vx + 5, vy - 5);
        ctx.stroke();
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
      ctx.fillText(label, x + 28, y + 13);

      const stateColor = isOpen ? '#16A34A' : (statusType === 'danger' ? '#DC2626' : '#64748B');
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

    // Вспомогательная функция отрисовки SCADA-модуля оборудования в темной теме
    function drawScadaModule(cfg) {
      const { x, y, w, h, title, subtitle, rows, isHovered, statusColor = '#16A34A' } = cfg;
      ctx.save();
      roundRect(ctx, x, y, w, h, 4);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#0284C7' : '#1E293B';
      ctx.lineWidth = isHovered ? 2 : 1.2;
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
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();

      // Статусный LED индикатор
      ctx.beginPath();
      ctx.arc(x + w - 12, y + 12.5, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillText(title, x + 7, y + 12);

      if (subtitle) {
        ctx.fillStyle = '#0284C7';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillText(subtitle, x + 7, y + 21.5);
      }
      ctx.restore();

      if (rows && rows.length > 0) {
        const tableTop = y + headerH + 3;
        const rowH = Math.min(22, (h - headerH - 6) / rows.length);

        rows.forEach((r, idx) => {
          const ry = tableTop + idx * rowH;
          ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F1F5F9';
          ctx.fillRect(x + 3, ry, w - 6, rowH - 1);
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(x + 3, ry, w - 6, rowH - 1);

          ctx.fillStyle = '#334155';
          ctx.font = 'bold 8.5px "Segoe UI", sans-serif';
          ctx.fillText(r.label, x + 6, ry + rowH - 5.5);

          const valStr = String(r.val);
          const unitStr = r.unit ? ' ' + r.unit : '';
          ctx.font = '8px "Segoe UI", sans-serif';
          const unitW = ctx.measureText(unitStr).width;
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          const valW = ctx.measureText(valStr).width;

          const rightEdge = x + w - 6;
          ctx.fillStyle = '#64748B';
          ctx.font = '8px "Segoe UI", sans-serif';
          ctx.fillText(unitStr, rightEdge - unitW, ry + rowH - 5.5);

          ctx.fillStyle = r.color || '#0F172A';
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
      ctx.fillStyle = '#F8FAFC';
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
    // ПАНОРАМНАЯ SCADA-МНЕМОСХЕМА [СИСТЕМЫ] — РУ В-491 (БЕЛОРУССКАЯ АЭС)
    // 1-й Контур: Реактор В-491 (3200 МВт) + 4 петли ГЦК Ду-850 + КД 79 м³ + САОЗ
    // 2-й Контур: ГПК 7.0 МПа + Турбина К-1200 + ТЗВ-1200 + Конденсатор + Деаэратор + ПЭН 225 °C
    // ============================================================================
    // ПРИНЦИПИАЛЬНАЯ ТЕХНОЛОГИЧЕСКАЯ СХЕМА ЭНЕРГОБЛОКА ВВЭР-1200 (Рис. 2.2.1)
    // Векторный P&ID-стиль (ISO/ГОСТ): тонкие линии 1.5–2px, изгибы под 90°,
    // символы арматуры (⋈), насосов (окружность со стрелкой), сосуды с уровнем.
    // ============================================================================
    function renderPanoramicSystemsView() {
      activeHotspots = [];
      window.activeHotspots = activeHotspots;

      // 0. БЕСШОВНЫЙ СВЕТЛЫЙ ХОЛСТ (#FFFFFF) БЕЗ ЧЕРНОЙ РАМКИ
      ctx.save();

      // Верхняя разделительная черта заголовка P&ID
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(15, 24);
      ctx.lineTo(1345, 24);
      ctx.stroke();

      ctx.restore();

      const lateDraws = [];

      // Текущие динамические параметры модели
      const loops = sim.loops || [
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 },
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 },
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 },
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 }
      ];
      const lp1 = loops[0];
      const lp2 = loops[1];
      const steamKgS = 1780 * (sim.feedwaterFlowPct / 100);

      // ========================================================================
      // СТАНДАРТНЫЕ P&ID-СИМВОЛЫ (КЛАПАНЫ, НАСОСЫ, ТРУБОПРОВОДЫ, МЕТКИ)
      // ========================================================================

      // 1. Векторный клапан P&ID: "песочные часы" / бабочка (⋈) со штоком и приводом
      function drawPidValve(cfg) {
        const { x, y, orient = 'h', size = 8, label = '', kks = '', isOpen = true, type = 'motor', statusType = 'norm', onClick = null, tooltip = null } = cfg;
        const isHov = sim.hoveredHotspot && sim.hoveredHotspot.x === x - 12 && sim.hoveredHotspot.y === y - 12;

        ctx.save();
        const strokeCol = isHov ? '#0284C7' : '#1E293B';
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = isHov ? 2.0 : 1.5;

        // Бабочка клапана (два соприкасающихся треугольника)
        ctx.beginPath();
        if (orient === 'h') {
          ctx.moveTo(x - size, y - size * 0.65);
          ctx.lineTo(x, y);
          ctx.lineTo(x - size, y + size * 0.65);
          ctx.closePath();
          ctx.moveTo(x + size, y - size * 0.65);
          ctx.lineTo(x, y);
          ctx.lineTo(x + size, y + size * 0.65);
          ctx.closePath();
        } else {
          ctx.moveTo(x - size * 0.65, y - size);
          ctx.lineTo(x, y);
          ctx.lineTo(x + size * 0.65, y - size);
          ctx.closePath();
          ctx.moveTo(x - size * 0.65, y + size);
          ctx.lineTo(x, y);
          ctx.lineTo(x + size * 0.65, y + size);
          ctx.closePath();
        }
        // Советская условность: красный — открыто, зелёный — закрыто
        ctx.fillStyle = isOpen ? GOST_MEDIA.ON : GOST_MEDIA.OFF;
        ctx.fill();
        ctx.stroke();

        // Шток привода клапана
        const stemLen = 9;
        ctx.beginPath();
        if (orient === 'h') {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - stemLen);
        } else {
          ctx.moveTo(x, y);
          ctx.lineTo(x + stemLen, y);
        }
        ctx.strokeStyle = strokeCol;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Головка привода
        const hx = orient === 'h' ? x : x + stemLen;
        const hy = orient === 'h' ? y - stemLen : y;

        if (type === 'motor') {
          ctx.beginPath();
          ctx.arc(hx, hy - 4, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = '#F8FAFC';
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = strokeCol;
          ctx.font = 'bold 7.5px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('M', hx, hy - 4);
        } else if (type === 'reg') {
          ctx.beginPath();
          ctx.arc(hx, hy - 3, 5.5, Math.PI, 0, false);
          ctx.closePath();
          ctx.fillStyle = '#F8FAFC';
          ctx.fill();
          ctx.stroke();
        } else if (type === 'safety') {
          ctx.beginPath();
          ctx.moveTo(hx - 4, hy - 7);
          ctx.lineTo(hx + 4, hy - 7);
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx, hy - 7);
          ctx.stroke();
        } else if (type === 'check') {
          ctx.beginPath();
          ctx.moveTo(x - size, y + size * 0.65);
          ctx.lineTo(x + size, y - size * 0.65);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(hx - 5, hy - 1);
          ctx.lineTo(hx + 5, hy - 1);
          ctx.stroke();
        }

        // Подпись клапана
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        if (label) {
          ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
          ctx.fillStyle = isHov ? '#0284C7' : '#0F172A';
          ctx.fillText(label, x + (orient === 'h' ? size + 3 : 8), y - 2);
        }
        ctx.restore();

        if (tooltip) {
          const telemFn = typeof tooltip.telemetry === 'function' ? tooltip.telemetry : () => String(tooltip.telemetry || '');
          activeHotspots.push({
            x: x - 12, y: y - 15, w: 24 + (label ? 45 : 0), h: 28,
            title: tooltip.title || label,
            sub: tooltip.sub || kks,
            desc: tooltip.desc || '',
            simple: tooltip.simple || '',
            telemetry: telemFn,
            onClick: onClick
          });
        }
      }

      // 2. Векторный насос P&ID: окружность с внутренним указателем потока и ротором
      function drawPidPump(cfg) {
        const { x, y, r = 13, flowAngle = 0, label = '', kks = '', isRunning = true, rpm = 1000, onClick = null, tooltip = null } = cfg;
        const isHov = sim.hoveredHotspot && Math.hypot(sim.hoveredHotspot.x - x, sim.hoveredHotspot.y - y) <= r + 4;
        const pCol = '#FFFFFF';

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        // Советская условность: красный — работает, зелёный — отключён
        ctx.fillStyle = isRunning ? GOST_MEDIA.ON : GOST_MEDIA.OFF;
        ctx.fill();
        ctx.strokeStyle = isHov ? '#0284C7' : '#1E293B';
        ctx.lineWidth = isHov ? 2.2 : 1.8;
        ctx.stroke();

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(flowAngle);
        ctx.beginPath();
        ctx.moveTo(r - 1, 0);
        ctx.lineTo(-r * 0.45, -r * 0.55);
        ctx.lineTo(-r * 0.45, r * 0.55);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = pCol;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (isRunning && rpm > 50) {
          const spinAng = sim.time * (rpm / 200);
          ctx.beginPath();
          for (let a = 0; a < 3; a++) {
            const ang = spinAng + (a * Math.PI * 2 / 3);
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * (r * 0.65), Math.sin(ang) * (r * 0.65));
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();

        lateDraws.push(() => {
          ctx.save();
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          if (label) {
            ctx.font = 'bold 10px "Segoe UI", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.fillRect(x + r + 2, y - 12, ctx.measureText(label).width + 4, 13);
            ctx.fillStyle = isHov ? '#0284C7' : '#0F172A';
            ctx.fillText(label, x + r + 4, y - 2);
          }
          if (kks || label) {
            const pumpState = isRunning ? `${rpm.toFixed(0)} об/м` : 'ОТКЛ';
            ctx.font = '600 9px "Segoe UI", sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.fillRect(x + r + 2, y, ctx.measureText(pumpState).width + 4, 11);
            ctx.fillStyle = '#334155';
            ctx.fillText(pumpState, x + r + 4, y + 8);
          }
          ctx.restore();
        });
        ctx.restore();

        if (tooltip) {
          const telemFn = typeof tooltip.telemetry === 'function' ? tooltip.telemetry : () => String(tooltip.telemetry || '');
          activeHotspots.push({
            x: x - r - 2, y: y - r - 2, w: r * 2 + (label ? 60 : 4), h: r * 2 + 4,
            r: r + 4,
            title: tooltip.title || label,
            sub: tooltip.sub || kks,
            desc: tooltip.desc || '',
            simple: tooltip.simple || '',
            telemetry: telemFn,
            onClick: onClick
          });
        }
      }

      // 3. Вспомогательный отрисовщик шильдика номера элемента по схеме Рис. 2.2.1
      // ========================================================================
      // 1. ЛЕВАЯ ЧАСТЬ: ЗДАНИЕ РЕАКТОРА И ДВОЙНОЙ КУПОЛ ГЕРМООБОЛОЧКИ (10UJA)
      // ========================================================================
      const domeCx = 375, domeCy = 265;
      const rOuter = 245, rInner = 220;
      const wallBaseY = 515;

      ctx.save();
      // Фундаментная плита здания реактора
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(115, wallBaseY, 530, 16);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(115, wallBaseY, 530, 16);
      // Штриховка бетона
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      for (let bx = 125; bx < 640; bx += 18) {
        ctx.beginPath();
        ctx.moveTo(bx, wallBaseY);
        ctx.lineTo(bx + 12, wallBaseY + 16);
        ctx.stroke();
      }

      // Наружная защитная оболочка (7)
      ctx.beginPath();
      ctx.arc(domeCx, domeCy, rOuter, Math.PI, 0, false);
      ctx.lineTo(domeCx + rOuter, wallBaseY);
      ctx.moveTo(domeCx - rOuter, domeCy);
      ctx.lineTo(domeCx - rOuter, wallBaseY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Внутренняя преднапряженная оболочка (6)
      ctx.beginPath();
      ctx.arc(domeCx, domeCy, rInner, Math.PI, 0, false);
      ctx.lineTo(domeCx + rInner, wallBaseY);
      ctx.moveTo(domeCx - rInner, domeCy);
      ctx.lineTo(domeCx - rInner, wallBaseY);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Спринклерный коллектор (17) под сводом купола
      ctx.beginPath();
      ctx.arc(domeCx, domeCy, 192, Math.PI * 1.08, Math.PI * 1.92, false);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Форсунки распыла
      for (let a = Math.PI * 1.12; a <= Math.PI * 1.88; a += 0.11) {
        const nx = domeCx + Math.cos(a) * 192;
        const ny = domeCy + Math.sin(a) * 192;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx, ny + 6);
        ctx.stroke();
      }
      drawEquipmentLabel('Спринклерный коллектор', domeCx, domeCy - 200);

      ctx.restore();

      // ========================================================================
      // 2. ЦЕНТРАЛЬНЫЙ УЗЕЛ: РЕАКТОР В-491 (1) И ЛОВУШКА РАСПЛАВА (20)
      // ========================================================================
      const rxX = 333, rxW = 84, rxY = 245, rxH = 200;
      const rxMidX = rxX + rxW / 2;
      const isRxHov = sim.hoveredHotspot && sim.hoveredHotspot.x === rxX && sim.hoveredHotspot.y === rxY;

      ctx.save();
      // Верхний блок приводов ШЭМ-3 (ОР СУЗ)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      for (let cx = rxX + 14; cx <= rxX + rxW - 14; cx += 11) {
        ctx.beginPath();
        ctx.moveTo(cx, rxY - 45);
        ctx.lineTo(cx, rxY);
        ctx.stroke();
      }
      ctx.fillStyle = sim.az1Tripped ? '#ef4444' : '#22c55e';
      ctx.fillRect(rxX + 10, rxY - 48, rxW - 20, 3);

      // Сферическая верхняя крышка корпуса реактора
      ctx.beginPath();
      ctx.arc(rxMidX, rxY + 20, rxW / 2, Math.PI, 0, false);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isRxHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Разъем главного фланца
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(rxX - 5, rxY + 18, rxW + 10, 8);
      ctx.strokeRect(rxX - 5, rxY + 18, rxW + 10, 8);

      // Цилиндрический корпус реактора ВВЭР-1200
      ctx.beginPath();
      ctx.rect(rxX, rxY + 26, rxW, rxH - 52);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isRxHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Опускной кольцевой зазор (Downcomer)
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(rxX + 2, rxY + 28, 7, rxH - 58);
      ctx.fillRect(rxX + rxW - 9, rxY + 28, 7, rxH - 58);

      // Внутрикорпусная шахта с перфорированным эллиптическим днищем
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(rxX + 11, rxY + 30, rxW - 22, rxH - 62);
      ctx.setLineDash([]);

      // Активная зона (163 ТВС-2М)
      const coreX = rxX + 16, coreY = rxY + 75, coreW = rxW - 32, coreH = rxH - 120;
      const fluxAlpha = Math.min(0.9, 0.2 + sim.neutronFlux * 0.7);
      const coreGrad = ctx.createLinearGradient(coreX, coreY + coreH, coreX, coreY);
      coreGrad.addColorStop(0, `rgba(2, 132, 199, ${fluxAlpha * 0.75})`);
      coreGrad.addColorStop(0.5, `rgba(245, 158, 11, ${fluxAlpha * 0.75})`);
      coreGrad.addColorStop(1, `rgba(239, 68, 68, ${fluxAlpha * 0.95})`);

      ctx.fillStyle = coreGrad;
      ctx.fillRect(coreX, coreY, coreW, coreH);
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(coreX, coreY, coreW, coreH);

      // Кластеры ОР СУЗ (погружение рабочей группы №12)
      const rodFrac = 1.0 - (sim.group10Pos / 100);
      const rodTipY = coreY + 4 + rodFrac * (coreH - 8);
      ctx.strokeStyle = sim.az1Tripped ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 1.8;
      for (let rx = coreX + 6; rx <= coreX + coreW - 6; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, rxY + 25);
        ctx.lineTo(rx, rodTipY);
        ctx.stroke();
      }

      // Текстовая телеметрия зоны
      ctx.font = 'bold 8.5px monospace';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.fillText('163 ТВС-2М', rxMidX, coreY + coreH / 2 - 4);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`${sim.thermalPowerMW.toFixed(0)} МВт`, rxMidX, coreY + coreH / 2 + 8);
      ctx.textAlign = 'left';

      // Нижнее эллиптическое днище корпуса реактора
      ctx.beginPath();
      ctx.arc(rxMidX, rxY + rxH - 26, rxW / 2, 0, Math.PI, false);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isRxHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      drawEquipmentLabel('Реактор В-491', rxMidX, rxY + 45);

      // Устройство локализации расплава: шире корпуса реактора, под его днищем
      const ulrW = Math.round(rxW * 1.33), ulrH = 44;
      const ulrX = rxMidX - ulrW / 2, ulrY = rxY + rxH + 22;
      const isUlrHov = sim.hoveredHotspot && sim.hoveredHotspot.x === ulrX && sim.hoveredHotspot.y === ulrY;
      drawCoreCatcher(rxMidX, ulrY, ulrW, ulrH, sim.ulrCoolingActive, isUlrHov);
      drawEquipmentLabel('Ловушка', rxMidX, ulrY + 13);
      drawEquipmentLabel('расплава', rxMidX, ulrY + 29);
      ctx.restore();

      activeHotspots.push({
        x: rxX, y: rxY, w: rxW, h: rxH,
        title: 'Реактор ядерный водо-водяной ВВЭР-1200 (Проект В-491)',
        sub: '16.20 МПа • 3200 МВт тепл. • 163 ТВС-2М • Корпус RPV',
        desc: 'Корпус реактора из высокопрочной легированной стали (15Х2МФА-А) внутренним диаметром 4.25 м со сферической крышкой и блоком приводов ШЭМ-3.',
        simple: window.plainExplanations ? window.plainExplanations.reactor : 'Главный ядерный котел АЭС, нагревающий воду до 330 °C.',
        telemetry: () => `Nтепл: ${sim.thermalPowerMW.toFixed(1)} МВт (${((sim.thermalPowerMW / 3200) * 100).toFixed(1)}%) | Твх: ${sim.coreInletTempC.toFixed(1)} °C | Твых: ${sim.coreOutletTempC.toFixed(1)} °C | Гр12: ${sim.group10Pos.toFixed(1)}%`
      });

      activeHotspots.push({
        x: ulrX, y: ulrY, w: ulrW, h: ulrH,
        title: 'Устройство локализации расплава активной зоны (УЛР)',
        sub: 'Пассивная система безопасности Поколения III+ под реактором',
        desc: 'Конический стальной сосуд массой ~150 т с жертвенным материалом (оксиды железа и алюминия) и наружным водяным охлаждением шахты реактора.',
        simple: window.plainExplanations ? window.plainExplanations.ulr : 'Огнеупорная ловушка под реактором на случай тяжелой аварии с расплавлением зоны.',
        telemetry: () => `Статус УЛР: ${sim.ulrCoolingActive ? 'ОХЛАЖДЕНИЕ ВКЛЮЧЕНО' : 'СУХОЕ ОЖИДАНИЕ'}`
      });

      // ========================================================================
      // 3. ПОДВЕШЕННЫЕ ГИДРОЕМКОСТИ САОЗ ПЕРВОЙ СТУПЕНИ (5)
      // ========================================================================
      const saozW = 26, saozH = 75, saozY = 110;
      const saozL_X = rxMidX - 35, saozR_X = rxMidX + 9;
      // Линии ГЕ-1 — в напорную камеру реактора, под активную зону (Поваров и др. 2025, с. 175):
      // обходят корпус снаружи и входят ниже холодных патрубков; пересечения с нитками — без соединения
      const geRoute = (idx, sx) => {
        const side = idx === 0 ? rxX - 7 : rxX + rxW + 7;
        const wall = idx === 0 ? rxX : rxX + rxW;
        const inY = rxY + 175;
        return [[sx + saozW / 2, saozY + saozH], [sx + saozW / 2, rxY - 31], [side, rxY - 31], [side, inY], [wall, inY]];
      };

      [ [saozL_X, '№1'], [saozR_X, '№2'] ].forEach(([sx, tag], idx) => {
        const isHov = sim.hoveredHotspot && sim.hoveredHotspot.x === sx && sim.hoveredHotspot.y === saozY;
        ctx.save();
        roundRect(ctx, sx, saozY, saozW, saozH, 10);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = isHov ? '#0284C7' : '#1E293B';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        const waterH = (saozH - 14) * (sim.saozWaterPct / 100);
        ctx.fillStyle = GOST_MEDIA.WATER_FILL;
        ctx.fillRect(sx + 2, saozY + saozH - 6 - waterH, saozW - 4, waterH);

        ctx.font = 'bold 7.5px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText(tag, sx + saozW / 2, saozY + 16);
        ctx.fillText(`${sim.saozWaterPct.toFixed(0)}%`, sx + saozW / 2, saozY + 28);
        ctx.textAlign = 'left';
        ctx.restore();

        ctx.beginPath();
        geRoute(idx, sx).forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.strokeStyle = GOST_MEDIA.WATER;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        drawPidValve({
          x: sx + saozW / 2, y: saozY + saozH + 18, orient: 'v', size: 6,
          label: '', kks: '', isOpen: sim.saozActive, type: 'check'
        });
      });
      drawEquipmentLabel('ГЕ-1, 4 × 60 м³ (показаны 2)', rxMidX, saozY - 10);

      activeHotspots.push({
        x: saozL_X, y: saozY, w: saozW * 2 + 18, h: saozH,
        title: 'Гидроемкости САОЗ первой ступени (ГЕ-1, KKS JNG50…80)',
        sub: '4 ёмкости по 60 м³ • Азот 5,9 МПа • H₃BO₃ не менее 16 г/кг, не ниже 20 °C',
        desc: 'Пассивная подача борированной воды в реактор при падении давления 1-го контура ниже 5,9 МПа, до включения насосов САОЗ НД.',
        simple: window.plainExplanations ? window.plainExplanations.saoz : 'Аварийные баллоны с борированной водой, которые заливают реактор без электричества.',
        telemetry: () => `Статус САОЗ: ${sim.saozActive ? 'ПОДАЧА ВКЛЮЧЕНА' : 'В ОЖИДАНИИ'} | Запас воды: ${sim.saozWaterPct.toFixed(1)}% | Давление азота: 5,9 МПа`,
        onClick: () => {
          sim.saozActive = !sim.saozActive;
          if (typeof addLog === 'function') addLog(sim.saozActive ? 'Гидроемкости САОЗ открыты!' : 'Клапаны САОЗ закрыты', sim.saozActive ? 'warn' : 'norm');
          if (window.sound && sound.click) sound.click(sim.saozActive ? 520 : 340);
        }
      });

      // ========================================================================
      // 4. КОНТУР ТЕПЛОНОСИТЕЛЯ (1-Й КОНТУР): ПГ (2), ГЦН (3), КД (4), БАРБОТЕР (19)
      // ========================================================================

      // Левый парогенератор ПГ-1 (2)
      const sg1X = 195, sg1Y = 285, sg1W = 95, sg1H = 50;
      const isSg1Hov = sim.hoveredHotspot && sim.hoveredHotspot.x === sg1X && sim.hoveredHotspot.y === sg1Y;
      roundRect(ctx, sg1X, sg1Y, sg1W, sg1H, 12);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isSg1Hov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const sg1LevelPx = Math.min(sg1H - 8, Math.max(6, (lp1.sgLevelM / 3.6) * (sg1H - 12)));
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(sg1X + 4, sg1Y + sg1H - 4 - sg1LevelPx, sg1W - 8, sg1LevelPx);

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(sg1X + 8, sg1Y + sg1H - 20, sg1W - 16, 12);
      ctx.setLineDash([]);
      drawEquipmentLabel('ПГ-1', sg1X + 18, sg1Y + 16);

      // Правый парогенератор ПГ-2 (2)
      const sg2X = 450, sg2Y = 285, sg2W = 95, sg2H = 50;
      const isSg2Hov = sim.hoveredHotspot && sim.hoveredHotspot.x === sg2X && sim.hoveredHotspot.y === sg2Y;
      roundRect(ctx, sg2X, sg2Y, sg2W, sg2H, 12);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isSg2Hov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const sg2LevelPx = Math.min(sg2H - 8, Math.max(6, (lp2.sgLevelM / 3.6) * (sg2H - 12)));
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(sg2X + 4, sg2Y + sg2H - 4 - sg2LevelPx, sg2W - 8, sg2LevelPx);

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(sg2X + 8, sg2Y + sg2H - 20, sg2W - 16, 12);
      ctx.setLineDash([]);
      drawEquipmentLabel('ПГ-2', sg2X + 75, sg2Y + 16);

      // Трубопроводы 1-го контура Ду-850 (280°C–330°C: #EF4444, >350°C: #DC2626, толщина 2.6px + стрелки)
      // ГОСТ 14202: обе нитки — вода; радиоактивная среда отмечена жёлтыми кольцами
      const loop1HotCol = GOST_MEDIA.WATER;
      const loop1ColdCol = GOST_MEDIA.WATER;
      // Левая петля №1:
      ctx.beginPath();
      ctx.moveTo(333, 305);
      ctx.lineTo(290, 305);
      ctx.strokeStyle = loop1HotCol;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      strokeRadioactiveRings(2.8);
      drawFlowArrow(308, 305, Math.PI, loop1HotCol, 5);

      ctx.beginPath();
      ctx.moveTo(195, 320);
      ctx.lineTo(185, 320);
      ctx.lineTo(185, 355);
      ctx.lineTo(210, 355);
      ctx.moveTo(210, 381);
      ctx.lineTo(210, 395);
      ctx.lineTo(333, 395);
      ctx.lineTo(333, 335);
      ctx.strokeStyle = loop1ColdCol;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      strokeRadioactiveRings(2.6);
      drawFlowArrow(275, 395, 0, loop1ColdCol, 5);

      // Насос ГЦНА-1 (3)
      drawPidPump({
        x: 210, y: 368, r: 13, flowAngle: Math.PI / 2,
        label: 'ГЦНА-1', kks: '', isRunning: lp1.pumpOn, rpm: lp1.rpm,
        onClick: () => {
          lp1.pumpOn = !lp1.pumpOn;
          if (typeof addLog === 'function') addLog(`ГЦНА-1 переведен: ${lp1.pumpOn ? 'ВКЛ' : 'ОТКЛ'}`, lp1.pumpOn ? 'ok' : 'warn');
        },
        tooltip: {
          title: 'Главный циркуляционный насос ГЦНА-1391 петли №1',
          sub: 'Подача 22 600 м³/ч • Напор 0,624 МПа • P1 16,20 МПа',
          desc: 'Вертикальный центробежный насос с гидрокамерным уплотнением вала. Обеспечивает прокачку теплоносителя через активную зону.',
          simple: window.plainExplanations ? window.plainExplanations.gcna : 'Мощный насос, который непрерывно гонит горячую воду через реактор.',
          telemetry: () => `ГЦНА-1: ${lp1.pumpOn ? 'В РАБОТЕ' : 'ОТКЛЮЧЕН'} | ${lp1.rpm.toFixed(0)} об/мин | Расход: ≈${(lp1.pumpOn ? 4480 : 500)} кг/с`
        }
      });

      // Правая петля №2:
      ctx.beginPath();
      ctx.moveTo(417, 305);
      ctx.lineTo(450, 305);
      ctx.strokeStyle = loop1HotCol;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      strokeRadioactiveRings(2.8);
      drawFlowArrow(436, 305, 0, loop1HotCol, 5);

      ctx.beginPath();
      ctx.moveTo(545, 320);
      ctx.lineTo(555, 320);
      ctx.lineTo(555, 355);
      ctx.lineTo(530, 355);
      ctx.moveTo(530, 381);
      ctx.lineTo(530, 395);
      ctx.lineTo(417, 395);
      ctx.lineTo(417, 335);
      ctx.strokeStyle = loop1ColdCol;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      strokeRadioactiveRings(2.6);
      drawFlowArrow(470, 395, Math.PI, loop1ColdCol, 5);

      // Насос ГЦНА-2 (3)
      drawPidPump({
        x: 530, y: 368, r: 13, flowAngle: Math.PI / 2,
        label: 'ГЦНА-2', kks: '', isRunning: lp2.pumpOn, rpm: lp2.rpm,
        onClick: () => {
          lp2.pumpOn = !lp2.pumpOn;
          if (typeof addLog === 'function') addLog(`ГЦНА-2 переведен: ${lp2.pumpOn ? 'ВКЛ' : 'ОТКЛ'}`, lp2.pumpOn ? 'ok' : 'warn');
        },
        tooltip: {
          title: 'Главный циркуляционный насос ГЦНА-1391 петли №2',
          sub: 'Подача 22 600 м³/ч • Напор 0,624 МПа • P1 16,20 МПа',
          desc: 'Обеспечивает циркуляцию теплоносителя петли №2.',
          simple: window.plainExplanations ? window.plainExplanations.gcna : 'Второй насос главного циркуляционного контура.',
          telemetry: () => `ГЦНА-2: ${lp2.pumpOn ? 'В РАБОТЕ' : 'ОТКЛЮЧЕН'} | ${lp2.rpm.toFixed(0)} об/мин`
        }
      });

      // Компенсатор давления КД (4)
      const kdX = 262, kdY = 180, kdW = 36, kdH = 85;
      const isKdHov = sim.hoveredHotspot && sim.hoveredHotspot.x === kdX && sim.hoveredHotspot.y === kdY;
      roundRect(ctx, kdX, kdY, kdW, kdH, 12);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isKdHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const kdWaterFrac = Math.min(1.0, Math.max(0.05, sim.pressurizerLevelM / 12.0));
      const kdWaterH = (kdH - 16) * kdWaterFrac;
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(kdX + 3, kdY + kdH - 8 - kdWaterH, kdW - 6, kdWaterH);

      ctx.strokeStyle = sim.heatersPowerKW > 100 ? GOST_MEDIA.ON : '#64748b';
      ctx.lineWidth = 1.2;
      for (let tx = kdX + 7; tx <= kdX + kdW - 7; tx += 6) {
        ctx.beginPath();
        ctx.moveTo(tx, kdY + kdH - 4);
        ctx.lineTo(tx, kdY + kdH - 14);
        ctx.stroke();
      }
      drawEquipmentLabel('КД', kdX + kdW / 2, kdY + 18);

      // Дыхательный трубопровод Ду-350 от горячей нитки (305, 305) к низу КД (280, 265)
      ctx.beginPath();
      ctx.moveTo(305, 305);
      ctx.lineTo(305, 275);
      ctx.lineTo(kdX + kdW / 2, 275);
      ctx.lineTo(kdX + kdW / 2, kdY + kdH);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.0;
      ctx.stroke();
      strokeRadioactiveRings(2.0);

      // Линия впрыска (спрей) из холодной нитки петли 1 (210, 395) вверх в паровую зону КД
      ctx.beginPath();
      ctx.moveTo(235, 395);
      ctx.lineTo(235, kdY + 12);
      ctx.lineTo(kdX, kdY + 12);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      strokeRadioactiveRings(1.6);

      drawPidValve({
        x: 235, y: kdY + 35, orient: 'v', size: 6,
        label: '', kks: '', isOpen: sim.sprayActive, type: 'reg',
        onClick: () => {
          sim.sprayActive = !sim.sprayActive;
          if (typeof addLog === 'function') addLog(sim.sprayActive ? 'Впрыск в КД включен' : 'Впрыск в КД отключен', 'action');
        },
        tooltip: {
          title: 'Клапан впрыска в паровое пространство КД',
          sub: 'Подача из холодной нитки для конденсации пара и снижения P1',
          desc: 'Быстро конденсирует пар в куполе КД при росте давления выше 16.3 МПа.',
          simple: window.plainExplanations ? window.plainExplanations.kd : 'Охлаждающий душ сверху в баке компенсатора давления.',
          telemetry: () => `Впрыск в КД: ${sim.sprayActive ? 'АКТИВЕН' : 'ЗАКРЫТ'}`
        }
      });

      drawEquipmentLabel('Впрыск', 226, kdY + 35, 'right');

      // Барботер КД — прием сброса от ИПУ КД
      const bbX = 170, bbY = 415, bbW = 60, bbH = 34;
      const isBbHov = sim.hoveredHotspot && sim.hoveredHotspot.x === bbX && sim.hoveredHotspot.y === bbY;
      roundRect(ctx, bbX, bbY, bbW, bbH, 8);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isBbHov ? '#0284C7' : (sim.ipuKdOpen ? '#DC2626' : '#1E293B');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(bbX + 3, bbY + 12, bbW - 6, bbH - 15);
      drawEquipmentLabel('Барботер', bbX + bbW / 2, bbY + 14);

      // Линия сброса ИПУ КД в барботер
      ctx.beginPath();
      ctx.moveTo(kdX, kdY + 22);
      ctx.lineTo(kdX - 14, kdY + 22);
      ctx.lineTo(kdX - 14, bbY + 18);
      ctx.lineTo(bbX + bbW, bbY + 18);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      strokeRadioactiveRings(1.8);

      drawPidValve({
        x: kdX - 14, y: kdY + 95, orient: 'v', size: 6,
        label: 'ИПУ КД', kks: '', isOpen: sim.ipuKdOpen, type: 'safety', statusType: sim.ipuKdOpen ? 'danger' : 'norm',
        onClick: () => {
          sim.ipuKdOpen = !sim.ipuKdOpen;
          if (typeof addLog === 'function') addLog(sim.ipuKdOpen ? 'ИПУ КД открыт (аварийный сброс)!' : 'ИПУ КД закрыт', sim.ipuKdOpen ? 'alarm' : 'norm');
        },
        tooltip: {
          title: 'Импульсно-предохранительное устройство КД (ИПУ КД)',
          sub: 'Защита 1-го контура от опасного превышения давления > 17.5 МПа',
          desc: 'Сбрасывает избыточный пар из компенсатора давления под слой воды в бак-барботер.',
          simple: window.plainExplanations ? window.plainExplanations.kd : 'Аварийный предохранительный клапан-свисток на крышке КД.',
          telemetry: () => `ИПУ КД: ${sim.ipuKdOpen ? 'ОТКРЫТ (СБРОС В БАРБОТЕР)' : 'ЗАКРЫТ (НОРМА)'}`
        }
      });

      // Бак-приямок (8) в нижней части гермооболочки
      const sumpX = 505, sumpY = 445, sumpW = 80, sumpH = 55;
      const isSumpHov = sim.hoveredHotspot && sim.hoveredHotspot.x === sumpX && sim.hoveredHotspot.y === sumpY;
      roundRect(ctx, sumpX, sumpY, sumpW, sumpH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isSumpHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(sumpX + 3, sumpY + 16, sumpW - 6, sumpH - 19);

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(sumpX + 6, sumpY + sumpH - 16, sumpW - 12, 10);
      ctx.setLineDash([]);
      drawEquipmentLabel('Бак-приямок', sumpX + sumpW / 2, sumpY + 14);

      activeHotspots.push({
        x: kdX, y: kdY, w: kdW, h: kdH,
        title: 'Компенсатор давления (КД)',
        sub: 'Объём 79 м³ (вода 55 м³) • уровень 8,17 м • ТЭН 2520 кВт',
        desc: 'Поддерживает стабильное давление теплоносителя 16.20 МПа за счет создания равновесной паровой подушки.',
        simple: window.plainExplanations ? window.plainExplanations.kd : 'Большой бак с кипятильником, который держит давление в реакторе.',
        telemetry: () => `P₁: ${sim.primaryPressureMPa.toFixed(2)} МПа | Уровень: ${sim.pressurizerLevelM.toFixed(2)} м | ТЭНы: ${sim.heatersPowerKW} кВт (${sim.heatersMode})`,
        onClick: () => {
          sim.heatersMode = sim.heatersMode === 'AUTO' ? 'MANUAL' : (sim.heatersMode === 'MANUAL' ? 'OFF' : 'AUTO');
          if (typeof addLog === 'function') addLog(`Режим ТЭН КД: ${sim.heatersMode}`, 'action');
        }
      });

      activeHotspots.push({
        x: sg1X, y: sg1Y, w: sg1W, h: sg1H,
        title: 'Парогенератор ПГВ-1000МКП петли №1',
        sub: 'Горизонтальный теплообменник 1-го и 2-го контуров (РУ В-491)',
        desc: '11 000 нержавеющих U-образных трубок 16х1.5 мм. Генерирует 445 кг/с сухого пара при 7.0 МПа.',
        simple: window.plainExplanations ? window.plainExplanations.pgv : 'Теплообменник, где жар реактора варит чистый пар для турбины.',
        telemetry: () => `ПГ-1: Уровень ${lp1.sgLevelM.toFixed(2)} м | P₂: ${sim.steamHeaderPressMPa.toFixed(2)} МПа | Тгор: ${lp1.tHot.toFixed(1)} °C | Тхол: ${lp1.tCold.toFixed(1)} °C`
      });

      activeHotspots.push({
        x: sg2X, y: sg2Y, w: sg2W, h: sg2H,
        title: 'Парогенератор ПГВ-1000МКП петли №2',
        sub: 'Горизонтальный теплообменник 1-го и 2-го контуров (РУ В-491)',
        desc: 'Генерирует пар давлением 7.0 МПа для машинного зала.',
        simple: window.plainExplanations ? window.plainExplanations.pgv : 'Второй парогенератор энергоблока.',
        telemetry: () => `ПГ-2: Уровень ${lp2.sgLevelM.toFixed(2)} м | P₂: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`
      });

      activeHotspots.push({
        x: sumpX, y: sumpY, w: sumpW, h: sumpH,
        title: 'Бак-приямок гермооболочки (запас борированной воды низкой концентрации)',
        sub: 'JNK10BB001, JNK40BB001: 2 × 1000 м³, 16 г/кг',
        desc: 'Сбор теплоносителя при авариях с течью и источник питания насосов САОЗ НД/ВД по замкнутому контуру рециркуляции.',
        simple: 'Огромный бассейн на полу под куполом, откуда насосы качают воду обратно в реактор при аварии.',
        telemetry: () => `Запас воды: 100% | Концентрация бора: 16.0 г/кг`
      });

      // ========================================================================
      // 5. ВНИЗУ: БАКИ И НАСОСЫ АВАРИЙНОГО ВПРЫСКА БОРА (11, 12, 13, 15, 21, 26, 34)
      // ========================================================================
      drawPidPump({
        x: 485, y: 560, r: 12, flowAngle: -Math.PI / 2,
        label: '', kks: '', isRunning: sim.saozActive, rpm: sim.saozActive ? 1500 : 0
      });
      drawEquipmentLabel('НД', 468, 560, 'right');

      drawPidPump({
        x: 540, y: 560, r: 12, flowAngle: -Math.PI / 2,
        label: '', kks: '', isRunning: sim.saozActive, rpm: sim.saozActive ? 3000 : 0
      });
      drawEquipmentLabel('ВД', 557, 560, 'left');
      drawEquipmentLabel('Активная САОЗ: ВД и НД, 4 канала', 500, 650);

      // Всас насосов 11, 12 из приямка (8)
      ctx.beginPath();
      ctx.moveTo(sumpX + sumpW / 2, sumpY + sumpH);
      ctx.lineTo(sumpX + sumpW / 2, 540);
      ctx.lineTo(485, 540);
      ctx.lineTo(485, 548);
      ctx.moveTo(sumpX + sumpW / 2, 540);
      ctx.lineTo(540, 540);
      ctx.lineTo(540, 548);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      strokeRadioactiveRings(1.6);

      // Нагнетание насосов САОЗ в холодную нитку
      ctx.beginPath();
      ctx.moveTo(485, 572);
      ctx.lineTo(485, 605);
      ctx.lineTo(460, 605);
      ctx.lineTo(460, 395);
      ctx.moveTo(540, 572);
      ctx.lineTo(540, 605);
      ctx.lineTo(485, 605);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(460, 395, 3, 0, Math.PI * 2);
      ctx.fillStyle = GOST_MEDIA.WATER;
      ctx.fill();

      // Система аварийного ввода бора: 4 канала, подача в линию САОЗ
      roundRect(ctx, 398, 545, 44, 24, 4);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(401, 553, 38, 13);
      ctx.beginPath();
      ctx.moveTo(420, 569);
      ctx.lineTo(420, 578);
      ctx.moveTo(432, 590);
      ctx.lineTo(460, 590);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      drawPidPump({
        x: 420, y: 590, r: 11, flowAngle: 0,
        label: '', kks: '', isRunning: sim.boronMode > 0, rpm: 1000
      });
      drawEquipmentLabel('Аварийный ввод бора', 392, 590, 'right');

      // Аварийная питательная вода: 4 канала, подача в питательную магистраль
      roundRect(ctx, 618, 552, 44, 24, 4);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(621, 560, 38, 13);
      ctx.beginPath();
      ctx.moveTo(640, 576);
      ctx.lineTo(640, 585);
      ctx.moveTo(640, 609);
      ctx.lineTo(640, 635);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      drawPidPump({
        x: 640, y: 597, r: 11, flowAngle: Math.PI / 2,
        label: '', kks: '', isRunning: sim.feedwaterFlowPct < 10 && !sim.loops.every((l) => !l.pumpOn), rpm: 1500
      });
      drawEquipmentLabel('Аварийная', 656, 590, 'left');
      drawEquipmentLabel('питательная вода', 656, 606, 'left');

      // ========================================================================
      // 6. ПРАВАЯ ЧАСТЬ: МАШИННЫЙ ЗАЛ, ГПАБ (22), ТУРБИНА (45), ТЗВ-1200 (47)
      // (Сдвиг вправо от наружной стены гермооболочки X=620 минимум на 50px)
      // ========================================================================

      // Главные паропроводы острого пара (100°C–280°C: #F59E0B, толщина 2.6px + стрелки)
      const steamY1 = 220, steamY2 = 236;
      ctx.beginPath();
      ctx.moveTo(245, 285);
      ctx.lineTo(245, steamY1);
      ctx.lineTo(685, steamY1);
      ctx.moveTo(495, 285);
      ctx.lineTo(495, steamY2);
      ctx.lineTo(685, steamY2);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      drawFlowArrow(560, steamY1, 0, GOST_MEDIA.STEAM, 5);
      drawFlowArrow(560, steamY2, 0, GOST_MEDIA.STEAM, 5);

      // Гермопроходки через двойную оболочку (сильфонные узлы)
      ctx.fillStyle = '#475569';
      ctx.fillRect(594, steamY1 - 5, 28, 10);
      ctx.fillRect(594, steamY2 - 5, 28, 10);

      // СПОТ В-491: водяное охлаждение, теплообменники в баках аварийного отвода тепла
      const spotColor = '#1E293B';
      ctx.beginPath();
      ctx.moveTo(640, 96);
      ctx.lineTo(640, steamY1);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(596, 80);
      ctx.lineTo(490, 80);
      ctx.lineTo(490, 94);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      roundRect(ctx, 596, 62, 88, 34, 4);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = sim.spotActive ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(599, 70, 82, 23);
      drawEquipmentLabel('Баки аварийного отвода тепла', 640, 52);

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(470, 94, 40, 18);
      ctx.strokeStyle = spotColor;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(470, 94, 40, 18);
      drawEquipmentLabel('СПОТ ЗО', 490, 122);

      drawPidValve({
        x: 640, y: 160, orient: 'v', size: 6,
        label: '', kks: '', isOpen: sim.spotActive, type: 'safety',
        onClick: () => {
          sim.spotActive = !sim.spotActive;
          if (typeof addLog === 'function') addLog(sim.spotActive ? 'СПОТ подключена к парогенераторам' : 'СПОТ отключена', 'info');
        },
        tooltip: {
          title: 'СПОТ ПГ: пассивный отвод тепла через парогенераторы',
          sub: 'В-491: водяное охлаждение, теплообменники в баках',
          desc: 'Пар из парогенераторов конденсируется в теплообменниках, погружённых в баки аварийного отвода тепла, конденсат возвращается в ПГ.',
          telemetry: () => `СПОТ: ${sim.spotActive ? 'В РАБОТЕ' : 'ОЖИДАНИЕ'}`
        }
      });
      drawEquipmentLabel('СПОТ ПГ', 652, 160, 'left');

      // Главный паровой арматурный блок (22) (ГПАБ / БОА)
      const gpabX = 690;
      drawPidValve({
        x: gpabX, y: steamY1, orient: 'h', size: 7,
        label: 'БЗОК-1', kks: '22', isOpen: true, type: 'motor',
        tooltip: {
          title: 'Быстродействующий запорный отсечной клапан (БЗОК, система свежего пара LBA)',
          sub: 'Отсечение главных паропроводов за время менее 5 секунд',
          desc: 'Герметизирует 2-й контур при течи паропровода или разрыве парогенератора.',
          simple: 'Главный аварийный кран на трубе свежего пара на выходе из купола.',
          telemetry: () => `БЗОК: ОТКРЫТ (НОРМА) | Давление пара: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`
        }
      });

      drawPidValve({
        x: gpabX, y: steamY2, orient: 'h', size: 7,
        label: 'БЗОК-2', kks: '22', isOpen: true, type: 'motor'
      });
      drawEquipmentLabel('ГПАБ (БОА)', gpabX + 10, steamY1 - 18);

      // Станция БРУ-А (сброс в атмосферу)
      drawPidValve({
        x: gpabX + 28, y: steamY1 - 32, orient: 'v', size: 6,
        label: 'БРУ-А', kks: '', isOpen: sim.bruAOpen, type: 'safety', statusType: sim.bruAOpen ? 'danger' : 'norm',
        onClick: () => {
          sim.bruAOpen = !sim.bruAOpen;
          if (typeof addLog === 'function') addLog(sim.bruAOpen ? 'БРУ-А открыт (выхлоп пара в атмосферу)!' : 'БРУ-А закрыт', sim.bruAOpen ? 'warn' : 'norm');
        },
        tooltip: {
          title: 'Быстродействующая редукционная установка сброса в атмосферу (БРУ-А)',
          sub: 'Аварийный сброс избыточного пара прямо в атмосферу',
          desc: 'Срабатывает при потере вакуума в конденсаторе или отключении турбины для предотвращения открытия предохранительных клапанов ПГ.',
          simple: 'Клапан аварийного сброса пара на улицу.',
          telemetry: () => `БРУ-А: ${sim.bruAOpen ? 'ОТКРЫТ (СБРОС В АТМОСФЕРУ)' : 'ЗАКРЫТ'}`
        }
      });
      ctx.beginPath();
      ctx.moveTo(gpabX + 28, steamY1);
      ctx.lineTo(gpabX + 28, steamY1 - 42);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Объединенный паропровод острого пара 7.00 МПа в машинный зал
      ctx.beginPath();
      ctx.moveTo(gpabX + 10, steamY1);
      ctx.lineTo(815, steamY1);
      ctx.lineTo(815, steamY2);
      ctx.moveTo(gpabX + 10, steamY2);
      ctx.lineTo(815, steamY2);
      ctx.lineTo(815, 48);
      ctx.lineTo(1000, 48);
      ctx.lineTo(1000, 98);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Стопорно-регулирующий клапан турбины (СК/РК)
      drawPidValve({
        x: 905, y: 48, orient: 'h', size: 7,
        label: '', kks: '', isOpen: sim.turbineValvePct > 10, type: 'reg',
        onClick: () => {
          const next = sim.turbineValvePct >= 90 ? 50 : (sim.turbineValvePct >= 40 ? 0 : 100);
          sim.turbineValvePct = next;
          if (typeof addLog === 'function') addLog(`Клапаны турбины (РК): ${next}%`, next === 0 ? 'warn' : 'action');
        },
        tooltip: {
          title: 'Стопорно-регулирующие клапаны турбины (СК / РК)',
          sub: 'Регулирование расхода свежего пара в цилиндр высокого давления',
          desc: 'Кликните для циклического изменения: 100% -> 50% -> 0% (СТОП).',
          simple: window.plainExplanations ? window.plainExplanations.turbine : 'Главный кран подачи пара на лопатки турбины.',
          telemetry: () => `Открытие РК: ${sim.turbineValvePct.toFixed(0)}% | Давление перед РК: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`
        }
      });

      // Турбина К-1200-6,8/50: на одном валу 2 ЦНД + ЦВД + 2 ЦНД
      const shaftY = 115;
      const cndCenters = [873, 933, 1067, 1127];
      const hpCenterX = 1000;
      ctx.beginPath();
      ctx.moveTo(cndCenters[0] - 27, shaftY);
      ctx.lineTo(1175, shaftY);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Двухпоточный цилиндр: пар входит в центр и расширяется к обоим торцам
      const drawDoubleFlowCylinder = (cx, halfW, topY, bottomY, name) => {
        ctx.beginPath();
        ctx.moveTo(cx - halfW, topY);
        ctx.lineTo(cx - 7, topY + 11);
        ctx.lineTo(cx + 7, topY + 11);
        ctx.lineTo(cx + halfW, topY);
        ctx.lineTo(cx + halfW, bottomY);
        ctx.lineTo(cx + 7, bottomY - 11);
        ctx.lineTo(cx - 7, bottomY - 11);
        ctx.lineTo(cx - halfW, bottomY);
        ctx.closePath();
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.save();
        ctx.font = 'bold 10px "Segoe UI", sans-serif';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, cx, shaftY);
        ctx.restore();
      };

      // Сепаратор-пароперегреватель под ЦВД
      const sppX = 972, sppY = 151, sppW = 56, sppH = 28;
      ctx.beginPath();
      ctx.moveTo(hpCenterX, 137);
      ctx.lineTo(hpCenterX, sppY);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      roundRect(ctx, sppX, sppY, sppW, sppH, 5);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4×СПП', sppX + sppW / 2, sppY + sppH / 2);
      ctx.restore();
      activeHotspots.push({
        x: sppX, y: sppY, w: sppW, h: sppH,
        title: 'Сепаратор-пароперегреватель',
        sub: 'Между ЦВД и ЦНД турбины К-1200-6,8/50',
        desc: 'Отделяет влагу от пара после ЦВД и перегревает его перед подачей в цилиндры низкого давления.',
        telemetry: () => `Nэл: ${sim.electricalPowerMW.toFixed(0)} МВт`
      });

      // Перегретый пар из СПП в середину каждого ЦНД
      const lpHeaderY = 70;
      ctx.beginPath();
      ctx.moveTo(sppX + sppW, sppY + sppH / 2);
      ctx.lineTo(1038, sppY + sppH / 2);
      ctx.lineTo(1038, lpHeaderY);
      ctx.moveTo(cndCenters[0], lpHeaderY);
      ctx.lineTo(cndCenters[3], lpHeaderY);
      cndCenters.forEach((cx) => {
        ctx.moveTo(cx, lpHeaderY);
        ctx.lineTo(cx, 97);
      });
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      drawDoubleFlowCylinder(hpCenterX, 29, 91, 139, 'ЦВД');
      cndCenters.forEach((cx, idx) => {
        drawDoubleFlowCylinder(cx, 27, 86, 144, `ЦНД-${idx + 1}`);
        ctx.beginPath();
        ctx.moveTo(cx - 27, 144);
        ctx.lineTo(cx - 30, 185);
        ctx.lineTo(cx + 30, 185);
        ctx.lineTo(cx + 27, 144);
        ctx.closePath();
        ctx.fillStyle = '#E2E8F0';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      });

      // Корпус Турбогенератора ТЗВ-1200-2 (47)
      const genX = 1175, genY = 82, genW = 85, genH = 68;
      const isGenHov = sim.hoveredHotspot && sim.hoveredHotspot.x === genX && sim.hoveredHotspot.y === genY;
      roundRect(ctx, genX, genY, genW, genH, 10);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isGenHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(genX + genW / 2, genY + genH / 2, 22, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.font = 'bold 8.5px "Segoe UI", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText('ТЗВ-1200-2', genX + 8, genY + 16);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(`${sim.electricalPowerMW.toFixed(0)} МВт`, genX + 8, genY + 36);
      ctx.font = 'bold 7.5px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(`${(sim.turbineRpm / 60).toFixed(2)} Гц • 24 кВ`, genX + 8, genY + 50);

      // Выход в энергосистему (50) — блочный трансформатор и ЛЭП 500 кВ
      const gridX = 1272, gridY = 115;
      ctx.beginPath();
      ctx.moveTo(genX + genW, gridY);
      ctx.lineTo(gridX, gridY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Символ трансформатора (два пересекающихся круга)
      ctx.beginPath();
      ctx.arc(gridX + 10, gridY, 10, 0, Math.PI * 2);
      ctx.arc(gridX + 21, gridY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Опора ЛЭП 500 кВ
      ctx.beginPath();
      ctx.moveTo(gridX + 40, gridY + 22);
      ctx.lineTo(gridX + 49, gridY - 26);
      ctx.lineTo(gridX + 58, gridY + 22);
      ctx.moveTo(gridX + 42, gridY - 14);
      ctx.lineTo(gridX + 56, gridY - 14);
      ctx.moveTo(gridX + 38, gridY - 2);
      ctx.lineTo(gridX + 60, gridY - 2);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Стрелка в сеть 500 кВ
      ctx.beginPath();
      ctx.moveTo(gridX + 58, gridY - 14);
      ctx.lineTo(1352, gridY - 14);
      ctx.lineTo(1344, gridY - 18);
      ctx.moveTo(1352, gridY - 14);
      ctx.lineTo(1344, gridY - 10);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      drawEquipmentLabel('В сеть', 1295, gridY - 26);

      activeHotspots.push({
        x: genX, y: genY, w: genW, h: genH,
        title: 'Турбогенератор ТЗВ-1200-2',
        sub: '1199.8 МВт • 24 кВ • 50 Гц • 3000 об/мин • Водяное охлаждение',
        desc: 'Синхронный трехфазный генератор с полным водяным охлаждением обмоток статора и ротора дистиллятом.',
        simple: window.plainExplanations ? window.plainExplanations.turbine : 'Главный генератор, превращающий вращение вала турбины в электричество для городов.',
        telemetry: () => `Nэл: ${sim.electricalPowerMW.toFixed(1)} МВт | f: ${(sim.turbineRpm / 60).toFixed(2)} Гц | Напряжение: 24 кВ | Ток статора: 31 кА`
      });

      // ========================================================================
      // 7. КОНДЕНСАТОРЫ (42) И КОНДЕНСАТНЫЙ ТРАКТ: КЭН (38, 39), БОУ (41), ПНД (37)
      // ========================================================================
      // Конденсатор под тремя ЦНД: трубные пучки и конденсатосборник
      const cdW = 54, cdH = 65, cdY = 185;
      const cdLeft = cndCenters[0] - cdW / 2 - 4, cdRight = cndCenters[3] + cdW / 2 + 4;
      roundRect(ctx, cdLeft, cdY, cdRight - cdLeft, cdH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(21, 128, 61, 0.45)';
      ctx.lineWidth = 1;
      for (let ty = cdY + 10; ty <= cdY + 40; ty += 6) {
        ctx.beginPath();
        ctx.moveTo(cdLeft + 6, ty);
        ctx.lineTo(cdRight - 6, ty);
        ctx.stroke();
      }
      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(cdLeft + 3, cdY + cdH - 14, cdRight - cdLeft - 6, 11);
      drawEquipmentLabel('Конденсатор', hpCenterX, cdY + 25);

      // Сброс БРУ-К из главного паропровода в конденсатор
      ctx.beginPath();
      ctx.moveTo(815, 236);
      ctx.lineTo(cdLeft, 236);
      ctx.strokeStyle = GOST_MEDIA.STEAM;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      drawPidValve({
        x: 826, y: 236, orient: 'h', size: 6,
        label: '', kks: '', isOpen: sim.bruKOpen, type: 'safety',
        onClick: () => {
          sim.bruKOpen = !sim.bruKOpen;
          if (typeof addLog === 'function') addLog(sim.bruKOpen ? 'БРУ-К открыт (сброс пара в конденсатор)' : 'БРУ-К закрыт', sim.bruKOpen ? 'action' : 'norm');
        },
        tooltip: {
          title: 'Быстродействующая редукционная установка сброса в конденсатор (БРУ-К)',
          sub: 'Сброс избыточного пара при сбросах нагрузки энергоблока',
          desc: 'Сбрасывает свежий пар мимо турбины прямо в пароприемные устройства конденсаторов.',
          simple: 'Байпасный клапан сброса пара в конденсатор в обход турбины.',
          telemetry: () => `БРУ-К: ${sim.bruKOpen ? 'ОТКРЫТ (СБРОС В КОНДЕНСАТОР)' : 'ЗАКРЫТ'}`
        }
      });

      drawEquipmentLabel('БРУ-К', 826, 254);

      // Линия основного конденсата: от конденсаторов к насосам 1-й ступени (38)
      ctx.beginPath();
      ctx.moveTo(995, cdY + cdH);
      ctx.lineTo(995, 272);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Конденсатные насосы 1-й ступени (38) (КЭН-1)
      drawPidPump({
        x: 995, y: 285, r: 11, flowAngle: Math.PI / 2,
        label: '', kks: 'КЭН-1', isRunning: sim.turbineValvePct > 5, rpm: 1500
      });
      drawEquipmentLabel('КЭН-1', 972, 286, 'right');

      // Блочная обессоливающая установка БОУ (41)
      const bouX = 1060, bouY = 270, bouW = 38, bouH = 40;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(bouX, bouY, bouW, bouH);
      ctx.strokeStyle = '#1E293B';
      ctx.strokeRect(bouX, bouY, bouW, bouH);
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#0284C7';
      ctx.fillText('БОУ', bouX + 8, bouY + 18);
      ctx.fillStyle = '#0F172A';
      ctx.font = '7px monospace';
      ctx.fillText('ФИЛЬТРЫ', bouX + 4, bouY + 30);

      // Конденсатные насосы 2-й ступени (39) (КЭН-2)
      drawPidPump({
        x: 895, y: 360, r: 11, flowAngle: Math.PI,
        label: '', kks: 'КЭН-2', isRunning: sim.turbineValvePct > 5, rpm: 1500
      });
      drawEquipmentLabel('КЭН-2', 895, 380);

      // Каскад подогревателей низкого давления ПНД (37)
      const pndYStart = 410;
      for (let i = 0; i < 4; i++) {
        const py = pndYStart + i * 24;
        roundRect(ctx, 850, py, 45, 18, 4);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.font = 'bold 7.5px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.fillText(`ПНД-${4 - i}`, 858, py + 12);
      }
      drawEquipmentLabel('Каскад ПНД', 845, pndYStart + 36, 'right');

      // Линия конденсата через БОУ и КЭН-2 в ПНД и наверх в деаэратор (35)
      ctx.beginPath();
      ctx.moveTo(995, 296);
      ctx.lineTo(995, 325);
      ctx.lineTo(bouX, 325);
      ctx.lineTo(bouX, bouY + bouH / 2);
      ctx.moveTo(bouX + bouW, bouY + bouH / 2);
      ctx.lineTo(1120, bouY + bouH / 2);
      ctx.lineTo(1120, 360);
      ctx.lineTo(906, 360);
      ctx.moveTo(884, 360);
      ctx.lineTo(820, 360);
      ctx.lineTo(820, pndYStart + 80);
      ctx.lineTo(850, pndYStart + 80);
      ctx.moveTo(850, pndYStart + 8);
      ctx.lineTo(834, pndYStart + 8);
      ctx.lineTo(834, 145);
      ctx.lineTo(795, 145);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      drawFlowArrow(815, 145, Math.PI, GOST_MEDIA.WATER, 5);

      // ========================================================================
      // 8. ДЕАЭРАТОР (35), ПЭН (48) И ПОДОГРЕВАТЕЛИ ВЫСОКОГО ДАВЛЕНИЯ ПВД (36)
      // ========================================================================
      // Деаэратор (35) (вертикальная колонка + горизонтальный бак запаса питательной воды)
      const dColX = 748, dColY = 125, dColW = 24, dColH = 30;
      const dTankX2 = 725, dTankY2 = 155, dTankW2 = 70, dTankH2 = 36;
      const isDeaerHov = sim.hoveredHotspot && sim.hoveredHotspot.x === dTankX2 && sim.hoveredHotspot.y === dTankY2;

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(dColX, dColY, dColW, dColH);
      ctx.strokeStyle = '#1E293B';
      ctx.strokeRect(dColX, dColY, dColW, dColH);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1;
      for (let dy = dColY + 6; dy < dColY + dColH - 4; dy += 6) {
        ctx.beginPath(); ctx.moveTo(dColX + 3, dy); ctx.lineTo(dColX + dColW - 3, dy); ctx.stroke();
      }

      roundRect(ctx, dTankX2, dTankY2, dTankW2, dTankH2, 8);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isDeaerHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fillRect(dTankX2 + 3, dTankY2 + 12, dTankW2 - 6, dTankH2 - 15);

      ctx.font = 'bold 8px "Segoe UI", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText('ДЕАЭРАТОР', dTankX2 + 6, dTankY2 + 20);
      ctx.font = 'bold 7.5px monospace';
      ctx.fillStyle = '#0284C7';
      ctx.fillText('0.871 МПа', dTankX2 + 6, dTankY2 + 30);

      activeHotspots.push({
        x: dTankX2, y: dTankY2, w: dTankW2, h: dTankH2,
        title: 'Деаэратор 0,871 МПа (деаэрационная система LAA)',
        sub: 'Деаэрационная колонка + бак запаса питательной воды 160 м³',
        desc: 'Удаляет коррозионно-агрессивные газы (кислород O2 и углекислый газ CO2) из питательной воды при температуре насыщения 178.5 °C.',
        simple: window.plainExplanations ? window.plainExplanations.pen : 'Бак-термос, где из воды вываривают кислород перед подачей в парогенераторы.',
        telemetry: () => `Давление: 0.871 МПа | T: 178.5 °C | Объем бака: 160 м³`
      });

      // Опускная линия от деаэратора к питательным электронасосам ПЭН (48)
      ctx.beginPath();
      ctx.moveTo(dTankX2 + dTankW2 / 2, dTankY2 + dTankH2);
      ctx.lineTo(dTankX2 + dTankW2 / 2, 245);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Питательные электронасосы ПЭН (48)
      drawPidPump({
        x: 760, y: 258, r: 12, flowAngle: Math.PI / 2,
        label: '', kks: 'ПЭН', isRunning: sim.feedwaterFlowPct > 10, rpm: (sim.feedwaterFlowPct / 100) * 3000,
        onClick: () => {
          const next = sim.feedwaterFlowPct >= 90 ? 50 : (sim.feedwaterFlowPct >= 40 ? 0 : 100);
          sim.feedwaterFlowPct = next;
          if (typeof addLog === 'function') addLog(`Подача ПЭН: ${next}%`, next === 0 ? 'alarm' : 'action');
        },
        tooltip: {
          title: 'Питательные электронасосы (ПЭН, система питательной воды LAB)',
          sub: 'Нагнетание 8.8 МПа • Расход до 1780 кг/с • 225 °C',
          desc: 'Кликните для циклического изменения расхода: 100% -> 50% -> 0% (СТОП).',
          simple: window.plainExplanations ? window.plainExplanations.pen : 'Насосы колоссального давления, которые толкают воду обратно в парогенератор.',
          telemetry: () => `Расход ПЭН: ${sim.feedwaterFlowPct.toFixed(0)}% | Gпв: ${steamKgS.toFixed(0)} кг/с | Pнагн: ${(sim.steamHeaderPressMPa + 1.8).toFixed(2)} МПа`
        }
      });
      drawEquipmentLabel('ПЭН', 785, 245);

      // Подогреватели высокого давления: 2 ступени (razdel-2, табл. 2.1.1)
      const pvdYStart = 330;
      ctx.beginPath();
      ctx.moveTo(761, 270);
      ctx.lineTo(761, 415);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const py = pvdYStart + i * 36;
        roundRect(ctx, 745, py, 32, 22, 6);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.font = 'bold 7.5px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.fillText('ПВД', 752, py + 14);
      }
      drawEquipmentLabel('2 × ПВД (225 °C)', 740, pvdYStart + 33, 'right');

      // Напорная магистраль питательной воды 225 °C обратно в парогенераторы
      // От ПВД (760, 415) вниз до Y: 635, влево в реакторное здание, разводка в ПГ-1 и ПГ-2
      ctx.beginPath();
      ctx.moveTo(761, 415);
      ctx.lineTo(761, 635);
      ctx.lineTo(245, 635);
      ctx.lineTo(245, sg1Y + sg1H);
      ctx.moveTo(495, 635);
      ctx.lineTo(495, sg2Y + sg2H);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      drawFlowArrow(620, 635, Math.PI, GOST_MEDIA.WATER, 5);
      drawFlowArrow(370, 635, Math.PI, GOST_MEDIA.WATER, 5);

      drawPidValve({
        x: 245, y: 615, orient: 'v', size: 6,
        label: '', kks: 'JEB11', isOpen: sim.feedwaterFlowPct > 10, type: 'reg'
      });

      drawPidValve({
        x: 495, y: 615, orient: 'v', size: 6,
        label: '', kks: 'JEB21', isOpen: sim.feedwaterFlowPct > 10, type: 'reg'
      });

      // ========================================================================
      // 9. ГРАДИРНЯ (40) И ЦИРКУЛЯЦИОННЫЕ НАСОСЫ (43)
      // ========================================================================
      // Гиперболоидная башенная градирня (40)
      const ctX = 1025, ctY = 410, ctW = 85, ctH = 150;
      const ctMidX = ctX + ctW / 2;
      const isCtHov = sim.hoveredHotspot && sim.hoveredHotspot.x === ctX && sim.hoveredHotspot.y === ctY;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ctX + 12, ctY);
      ctx.quadraticCurveTo(ctMidX - 18, ctY + ctH * 0.45, ctX, ctY + ctH);
      ctx.lineTo(ctX + ctW, ctY + ctH);
      ctx.quadraticCurveTo(ctMidX + 18, ctY + ctH * 0.45, ctX + ctW - 12, ctY);
      ctx.closePath();
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isCtHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(21, 128, 61, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      for (let rx = ctX + 10; rx <= ctX + ctW - 10; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, ctY + ctH - 35);
        ctx.lineTo(rx, ctY + ctH - 6);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.fillStyle = GOST_MEDIA.WATER_FILL;
      ctx.fillRect(ctX + 4, ctY + ctH - 8, ctW - 8, 6);

      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ctMidX - 14, ctY);
      ctx.quadraticCurveTo(ctMidX - 8, ctY - 20, ctMidX - 18, ctY - 32);
      ctx.moveTo(ctMidX, ctY);
      ctx.quadraticCurveTo(ctMidX + 4, ctY - 22, ctMidX, ctY - 36);
      ctx.moveTo(ctMidX + 14, ctY);
      ctx.quadraticCurveTo(ctMidX + 10, ctY - 18, ctMidX + 20, ctY - 30);
      ctx.stroke();
      drawEquipmentLabel('Градирня', ctMidX, ctY + ctH / 2 - 10);
      ctx.restore();

      // Циркуляционные насосы градирни ЦН (43)
      drawPidPump({
        x: 1160, y: 535, r: 13, flowAngle: -Math.PI / 2,
        label: 'ЦН-1', kks: '43', isRunning: true, rpm: 750
      });
      drawPidPump({
        x: 1160, y: 575, r: 13, flowAngle: -Math.PI / 2,
        label: 'ЦН-2', kks: '43', isRunning: true, rpm: 750
      });

      // Контур циркуляционной воды (Ду-2000, холодная вода 10–45°C: #0EA5E9, возврат: #06B6D4):
      ctx.beginPath();
      ctx.moveTo(ctX + ctW, ctY + ctH - 5);
      ctx.lineTo(1135, ctY + ctH - 5);
      ctx.lineTo(1135, 555);
      ctx.lineTo(1160, 555);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(1160, 522);
      ctx.lineTo(1160, 220);
      ctx.lineTo(cdRight, 220);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      drawFlowArrow(1160, 360, -Math.PI / 2, GOST_MEDIA.WATER, 5);

      ctx.beginPath();
      ctx.moveTo(960, cdY + cdH);
      ctx.lineTo(960, ctY + 45);
      ctx.lineTo(ctX + 10, ctY + 45);
      ctx.strokeStyle = GOST_MEDIA.WATER;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      drawFlowArrow(960, 340, Math.PI / 2, GOST_MEDIA.WATER, 5);

      activeHotspots.push({
        x: ctX, y: ctY, w: ctW, h: ctH,
        title: 'Башенная испарительная градирня',
        sub: 'Высота 167 м • Охлаждение циркуляционной воды 2-го контура',
        desc: 'Естественная тяга гиперболоидной железобетонной башни. Охлаждает до 160 000 м³/ч циркуляционной воды за счет частичного испарения.',
        simple: window.plainExplanations ? window.plainExplanations.condenser : 'Огромная коническая башня с паром, охлаждающая воду после конденсатора.',
        telemetry: () => `Tгор: 34.8 °C | Tхол: 24.2 °C | Расход ЦВ: 45 000 кг/с`
      });

      // ========================================================================
      // 10. ДИНАМИЧЕСКИЕ БЕГУЩИЕ МАРКЕРЫ РАСХОДА (ПОТОКИ)
      // ========================================================================
      if (sim.showParticles) {
        // 1. 1-й контур под давлением (280°C–330°C: #EF4444)
        const flowLp1 = (lp1.rpm / 1000) * (lp1.pumpOn ? 1.0 : 0.15);
        if (flowLp1 > 0.05) {
          drawParticlesOnPath([[333, 305], [290, 305]], 3, flowLp1 * 3.6, loop1HotCol, 2.4);
          drawParticlesOnPath([[195, 320], [185, 320], [185, 355], [210, 355]], 3, flowLp1 * 3.6, loop1ColdCol, 2.4);
          drawParticlesOnPath([[210, 381], [210, 395], [333, 395], [333, 335]], 5, flowLp1 * 3.6, loop1ColdCol, 2.4);
        }

        const flowLp2 = (lp2.rpm / 1000) * (lp2.pumpOn ? 1.0 : 0.15);
        if (flowLp2 > 0.05) {
          drawParticlesOnPath([[417, 305], [450, 305]], 3, flowLp2 * 3.6, loop1HotCol, 2.4);
          drawParticlesOnPath([[545, 320], [555, 320], [555, 355], [530, 355]], 3, flowLp2 * 3.6, loop1ColdCol, 2.4);
          drawParticlesOnPath([[530, 381], [530, 395], [417, 395], [417, 335]], 5, flowLp2 * 3.6, loop1ColdCol, 2.4);
        }

        // 2. Главные паропроводы острого пара (100°C–280°C: #F59E0B)
        const flowSteam = (sim.feedwaterFlowPct / 100) * (sim.turbineValvePct / 100);
        if (flowSteam > 0.05) {
          drawParticlesOnPath([[245, 285], [245, steamY1], [685, steamY1]], 5, flowSteam * 4.0, GOST_MEDIA.STEAM, 2.4);
          drawParticlesOnPath([[495, 285], [495, steamY2], [685, steamY2]], 4, flowSteam * 4.0, GOST_MEDIA.STEAM, 2.4);
          drawParticlesOnPath([[gpabX + 10, steamY1], [815, steamY1], [815, 48], [1000, 48], [1000, 98]], 5, flowSteam * 4.2, GOST_MEDIA.STEAM, 2.5);
        }

        // 3. Питательная вода 225 °C (100°C–280°C: #F59E0B)
        const flowFeed = sim.feedwaterFlowPct / 100;
        if (flowFeed > 0.05) {
          drawParticlesOnPath([[dTankX2 + dTankW2 / 2, dTankY2 + dTankH2], [dTankX2 + dTankW2 / 2, 245]], 2, flowFeed * 3.2, GOST_MEDIA.WATER, 2.4);
          drawParticlesOnPath([[760, 415], [760, 635], [245, 635], [245, sg1Y + sg1H]], 8, flowFeed * 3.5, GOST_MEDIA.WATER, 2.5);
          drawParticlesOnPath([[495, 635], [495, sg2Y + sg2H]], 2, flowFeed * 3.5, GOST_MEDIA.WATER, 2.4);
        }

        // 4. Возвратный контур конденсата (45°C–100°C: #06B6D4)
        if (flowFeed > 0.05) {
          drawParticlesOnPath([[834, pndYStart + 8], [834, 145], [795, 145]], 4, flowFeed * 3.2, GOST_MEDIA.WATER, 2.2);
        }

        // 5. Циркуляционная вода градирни (10°C–45°C: #0EA5E9 и возврат #06B6D4)
        drawParticlesOnPath([[ctX + ctW, ctY + ctH - 5], [1135, ctY + ctH - 5], [1135, 555], [1160, 555]], 3, 2.8, GOST_MEDIA.WATER, 2.4);
        drawParticlesOnPath([[1160, 522], [1160, 220], [cdRight, 220]], 5, 3.2, GOST_MEDIA.WATER, 2.4);
        drawParticlesOnPath([[960, cdY + cdH], [960, ctY + 45], [ctX + 10, ctY + 45]], 5, 3.0, GOST_MEDIA.WATER, 2.4);

        // 6. Условные аварийные потоки
        if (sim.saozActive) {
          drawParticlesOnPath(geRoute(0, saozL_X), 4, 4.0, GOST_MEDIA.WATER, 2.4);
          drawParticlesOnPath(geRoute(1, saozR_X), 4, 4.0, GOST_MEDIA.WATER, 2.4);
        }

        if (sim.sprayActive) {
          drawParticlesOnPath([[235, 395], [235, kdY + 12], [kdX, kdY + 12]], 3, 3.2, GOST_MEDIA.WATER, 2.2);
        }

        if (sim.ipuKdOpen) {
          drawParticlesOnPath([[kdX, kdY + 22], [kdX - 14, kdY + 22], [kdX - 14, bbY + 18], [bbX + bbW, bbY + 18]], 4, 4.5, GOST_MEDIA.STEAM, 2.5);
        }

        if (sim.bruKOpen) {
          drawParticlesOnPath([[815, 236], [cdLeft, 236]], 4, 4.0, GOST_MEDIA.STEAM, 2.4);
        }

        if (sim.bruAOpen) {
          drawParticlesOnPath([[gpabX + 28, steamY1], [gpabX + 28, steamY1 - 42]], 2, 4.0, GOST_MEDIA.STEAM, 2.4);
        }
      }

      lateDraws.forEach((draw) => draw());

      // Легенда: окраска сред по ГОСТ 14202-69 и состояния оборудования (левее питательной линии x = 245)
      ctx.save();
      const lgX = 16, lgY = 592, lgW = 214, lgH = 124;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.fillRect(lgX, lgY, lgW, lgH);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(lgX, lgY, lgW, lgH);
      ctx.font = '600 10.5px "Segoe UI", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      [['Вода', GOST_MEDIA.WATER, false], ['Пар', GOST_MEDIA.STEAM, false], ['Радиоактивная среда', GOST_MEDIA.WATER, true]].forEach(([text, col, rings], i) => {
        const y = lgY + 14 + i * 18;
        ctx.beginPath();
        ctx.moveTo(lgX + 10, y);
        ctx.lineTo(lgX + 36, y);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.6;
        ctx.setLineDash([]);
        ctx.stroke();
        if (rings) strokeRadioactiveRings(2.6);
        ctx.fillStyle = '#0F172A';
        ctx.fillText(text, lgX + 44, y);
      });
      [['включено / открыто', GOST_MEDIA.ON], ['отключено / закрыто', GOST_MEDIA.OFF]].forEach(([text, col], i) => {
        const y = lgY + 68 + i * 18;
        ctx.beginPath();
        ctx.arc(lgX + 23, y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.fillStyle = '#0F172A';
        ctx.fillText(text, lgX + 44, y);
      });
      ctx.font = '500 9.5px "Segoe UI", sans-serif';
      ctx.fillStyle = '#64748B';
      ctx.fillText('Окраска сред по ГОСТ 14202-69', lgX + 10, lgY + 112);
      ctx.restore();

      // Заголовки зон поверх схемы (x ≥ 440: левый верхний угол закрыт переключателем «Панорама / Разрез»)
      ctx.save();
      ctx.font = 'bold 10.5px "Segoe UI", sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      [
        ['ПРИНЦИПИАЛЬНАЯ СХЕМА ЭНЕРГОБЛОКА ВВЭР-1200, ПРОЕКТ В-491 (ЛАЭС-2)', 440, 18, '#0F172A'],
        ['ЗДАНИЕ РЕАКТОРА: 1-Й КОНТУР, 16,20 МПа', 440, 38, '#0284C7'],
        ['МАШИННЫЙ ЗАЛ: 2-Й КОНТУР, ПАР 7,00 МПа', 710, 38, '#0284C7']
      ].forEach(([text, x, y, color]) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.fillRect(x - 3, y - 12, ctx.measureText(text).width + 6, 16);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
      });
      ctx.restore();
    }

    // Совместимый псевдоним renderPanoramic
    function renderPanoramic() {
      return renderPanoramicSystemsView();
    }

    // ============================================================================
    // РЕЖИМ 2: РАЗРЕЗ ГЕРМООБОЛОЧКИ В-491 — векторный SVG-экран в containment_view.js.
    // Холст в этом режиме ничего не рисует: схема и реестр лежат поверх него.
    // ============================================================================
    function renderCrossSectionView() {
      activeHotspots = [];
      window.activeHotspots = activeHotspots;
    }

// Явная фиксация экспорта в глобальный объект window
window.roundRect = roundRect;
window.drawParticlesOnPath = drawParticlesOnPath;
window.drawClickableArmature = drawClickableArmature;
window.drawScadaModule = drawScadaModule;
window.drawPipeLabel = drawPipeLabel;
window.renderPanoramicSystemsView = renderPanoramicSystemsView;
window.renderPanoramic = renderPanoramicSystemsView;
window.renderCrossSectionView = renderCrossSectionView;
