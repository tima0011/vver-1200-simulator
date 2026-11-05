// ============================================================================
// ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-491, БелАЭС)
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

function getThermalColor(tempC) {
  if (tempC > 350) return THERMAL_COLOR_SCALE.CRITICAL_OVERHEAT;
  if (tempC >= 280) return THERMAL_COLOR_SCALE.REACTOR_CORE;
  if (tempC >= 100) return THERMAL_COLOR_SCALE.HOT_STEAM;
  if (tempC >= 45) return THERMAL_COLOR_SCALE.RETURN_CONDENSATE;
  return THERMAL_COLOR_SCALE.COLD_COOLING;
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

      // Текстовые заголовки зон P&ID (высококонтрастный #0F172A и акцент #0284C7)
      ctx.font = 'bold 9.5px "Segoe UI", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText('РИС. 2.2.1 — ПРИНЦИПИАЛЬНАЯ ТЕХНОЛОГИЧЕСКАЯ СХЕМА ЭНЕРГОБЛОКА ВВЭР-1200 (В-491)', 20, 16);
      ctx.fillStyle = '#0284C7';
      ctx.fillText('10UJA: ЗДАНИЕ РЕАКТОРА И ГЕРМООБОЛОЧКА (1-Й КОНТУР • 16.20 МПа)', 20, 36);
      ctx.fillText('10UMA: МАШИННЫЙ ЗАЛ И 2-Й КОНТУР (ТУРБИНА К-1200 • ГПК 7.00 МПа • ДЕАЭРАТОР 0.871 МПа)', 710, 36);
      ctx.restore();

      // Текущие динамические параметры модели
      const loops = sim.loops || [
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
        { pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 }
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
        const strokeCol = isHov ? '#0284C7' : (isOpen ? '#16A34A' : (statusType === 'danger' ? '#DC2626' : '#475569'));
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
        ctx.fillStyle = isOpen ? 'rgba(22, 163, 74, 0.18)' : '#E2E8F0';
        ctx.fill();
        ctx.stroke();

        // Линия открытого прохода / перекрестие закрытия
        if (isOpen) {
          ctx.beginPath();
          if (orient === 'h') {
            ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
          } else {
            ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
          }
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
          ctx.moveTo(x - 3, y + 3); ctx.lineTo(x + 3, y - 3);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

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
          ctx.font = 'bold 8px "Segoe UI", sans-serif';
          ctx.fillStyle = isHov ? '#0284C7' : '#0F172A';
          ctx.fillText(label, x + (orient === 'h' ? size + 3 : 8), y - 2);
        }
        if (kks) {
          ctx.font = 'bold 7.5px monospace';
          ctx.fillStyle = isOpen ? '#16A34A' : '#475569';
          ctx.fillText(kks, x + (orient === 'h' ? size + 3 : 8), y + 7);
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
        const pCol = isHov ? '#0284C7' : (isRunning ? '#16A34A' : '#64748B');

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#F8FAFC';
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
        ctx.fillStyle = isRunning ? 'rgba(34, 197, 94, 0.45)' : 'rgba(100, 116, 139, 0.25)';
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
          ctx.strokeStyle = '#16A34A';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();

        if (label) {
          ctx.font = 'bold 8.5px "Segoe UI", sans-serif';
          ctx.fillStyle = isHov ? '#0284C7' : '#0F172A';
          ctx.fillText(label, x + r + 4, y - 2);
        }
        if (kks) {
          ctx.font = 'bold 7.5px monospace';
          ctx.fillStyle = isRunning ? '#16A34A' : '#475569';
          ctx.fillText(isRunning ? `${rpm.toFixed(0)} об/м` : 'ОТКЛ', x + r + 4, y + 8);
        }
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
      function drawItemTag(num, x, y, title = '') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 7.5, 0, Math.PI * 2);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(num), x, y);

        if (title) {
          ctx.textAlign = 'left';
          ctx.font = 'bold 8px "Segoe UI", sans-serif';
          ctx.fillStyle = '#0F172A';
          ctx.fillText(title, x + 10, y);
        }
        ctx.restore();
      }

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

      // Метки оболочек (6) и (7)
      drawItemTag(7, domeCx - rOuter - 2, domeCy - 100);
      drawItemTag(6, domeCx - rInner + 14, domeCy - 90);

      // Вентиляционная труба ВТ (25) слева от контайнмента
      const stackX = 45;
      ctx.beginPath();
      ctx.moveTo(stackX - 16, wallBaseY);
      ctx.lineTo(stackX - 6, 170);
      ctx.lineTo(stackX + 6, 170);
      ctx.lineTo(stackX + 16, wallBaseY);
      ctx.closePath();
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawItemTag(25, stackX, 155, 'Венттруба ВТ-1');

      // Фильтр (24) и вентустановка кольцевого зазора (23)
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(stackX + 22, 440, 24, 18);
      ctx.strokeStyle = '#1E293B';
      ctx.strokeRect(stackX + 22, 440, 24, 18);
      drawItemTag(24, stackX + 34, 430);
      drawPidPump({
        x: stackX + 65, y: 449, r: 9, flowAngle: Math.PI,
        label: '', kks: '23', isRunning: true, rpm: 1500
      });
      drawItemTag(23, stackX + 65, 435);

      // Магистраль разряжения из кольцевого зазора в фильтр и трубу
      ctx.beginPath();
      ctx.moveTo(domeCx - rOuter + 12, 449);
      ctx.lineTo(stackX + 74, 449);
      ctx.moveTo(stackX + 56, 449);
      ctx.lineTo(stackX + 46, 449);
      ctx.moveTo(stackX + 22, 449);
      ctx.lineTo(stackX, 449);
      ctx.lineTo(stackX, 220);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // СПОТ ГО: Теплообменники-конденсаторы под куполом (28) и баки СПОТ (29)
      // Слева:
      ctx.strokeRect(190, 105, 30, 22);
      drawItemTag(28, 205, 95);
      ctx.strokeRect(140, 75, 26, 32);
      drawItemTag(29, 153, 65, 'Бак СПОТ');
      // Справа:
      ctx.strokeRect(530, 105, 30, 22);
      drawItemTag(28, 545, 95);
      ctx.strokeRect(580, 75, 26, 32);
      drawItemTag(29, 593, 65);

      // Спринклерный коллектор (17) под сводом купола
      ctx.beginPath();
      ctx.arc(domeCx, domeCy, 192, Math.PI * 1.08, Math.PI * 1.92, false);
      ctx.strokeStyle = '#38bdf8';
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
      drawItemTag(17, domeCx, domeCy - 200, 'Спринклерный коллектор');

      // Пассивные рекомбинаторы водорода (18)
      [ [250, 95], [315, 75], [435, 75], [500, 95] ].forEach(([rx, ry], idx) => {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(rx - 6, ry - 4, 12, 8);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx - 6, ry - 4, 12, 8);
        if (idx === 1) drawItemTag(18, rx, ry - 12);
      });
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
      ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
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
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(coreX, coreY, coreW, coreH);

      // Кластеры ОР СУЗ (погружение группы №10)
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

      drawItemTag(1, rxMidX, rxY + 45, 'Реактор В-491');

      // Устройство локализации расплава — Кориум-ловушка (20)
      const ulrX = rxMidX - 30, ulrY = rxY + rxH + 6, ulrW = 60, ulrH = 38;
      const isUlrHov = sim.hoveredHotspot && sim.hoveredHotspot.x === ulrX && sim.hoveredHotspot.y === ulrY;

      ctx.beginPath();
      ctx.moveTo(ulrX, ulrY);
      ctx.lineTo(ulrX + 8, ulrY + ulrH);
      ctx.lineTo(ulrX + ulrW - 8, ulrY + ulrH);
      ctx.lineTo(ulrX + ulrW, ulrY);
      ctx.closePath();
      ctx.fillStyle = sim.ulrCoolingActive ? 'rgba(14, 165, 233, 0.25)' : '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isUlrHov ? '#0284C7' : (sim.ulrCoolingActive ? '#16A34A' : '#1E293B');
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Змеевики охлаждающей воды в корпусе ловушки
      ctx.strokeStyle = sim.ulrCoolingActive ? '#38bdf8' : '#475569';
      ctx.lineWidth = 1.2;
      for (let zy = ulrY + 8; zy < ulrY + ulrH - 4; zy += 6) {
        ctx.beginPath();
        ctx.moveTo(ulrX + 6, zy);
        ctx.lineTo(ulrX + ulrW - 6, zy);
        ctx.stroke();
      }
      drawItemTag(20, rxMidX, ulrY + ulrH / 2, 'Ловушка УЛР');
      ctx.restore();

      activeHotspots.push({
        x: rxX, y: rxY, w: rxW, h: rxH,
        title: 'Реактор ядерный водо-водяной ВВЭР-1200 (Проект В-491)',
        sub: '16.20 МПа • 3200 МВт тепл. • 163 ТВС-2М • Корпус RPV',
        desc: 'Корпус реактора из высокопрочной легированной стали (15Х2МФА-А) внутренним диаметром 4.25 м со сферической крышкой и блоком приводов ШЭМ-3.',
        simple: window.plainExplanations ? window.plainExplanations.reactor : 'Главный ядерный котел АЭС, нагревающий воду до 329 °C.',
        telemetry: () => `Nтепл: ${sim.thermalPowerMW.toFixed(1)} МВт (${((sim.thermalPowerMW / 3200) * 100).toFixed(1)}%) | Твх: ${sim.coreInletTempC.toFixed(1)} °C | Твых: ${sim.coreOutletTempC.toFixed(1)} °C | Гр10: ${sim.group10Pos.toFixed(1)}%`
      });

      activeHotspots.push({
        x: ulrX, y: ulrY, w: ulrW, h: ulrH,
        title: 'Устройство локализации расплава активной зоны (УЛР / Кориум-ловушка, KKS JMU)',
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

      [ [saozL_X, 'ГЕ-1'], [saozR_X, 'ГЕ-2'] ].forEach(([sx, tag], idx) => {
        const isHov = sim.hoveredHotspot && sim.hoveredHotspot.x === sx && sim.hoveredHotspot.y === saozY;
        ctx.save();
        roundRect(ctx, sx, saozY, saozW, saozH, 10);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = isHov ? '#0284C7' : (sim.saozActive ? '#16A34A' : '#1E293B');
        ctx.lineWidth = 1.6;
        ctx.stroke();

        const waterH = (saozH - 14) * (sim.saozWaterPct / 100);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
        ctx.fillRect(sx + 2, saozY + saozH - 6 - waterH, saozW - 4, waterH);

        ctx.font = 'bold 7.5px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText(tag, sx + saozW / 2, saozY + 16);
        ctx.fillText(`${sim.saozWaterPct.toFixed(0)}%`, sx + saozW / 2, saozY + 28);
        ctx.textAlign = 'left';
        ctx.restore();

        ctx.beginPath();
        ctx.moveTo(sx + saozW / 2, saozY + saozH);
        ctx.lineTo(sx + saozW / 2, rxY + 30);
        ctx.lineTo(idx === 0 ? rxX + 4 : rxX + rxW - 4, rxY + 30);
        ctx.strokeStyle = sim.saozActive ? '#ec4899' : '#64748b';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        drawPidValve({
          x: sx + saozW / 2, y: saozY + saozH + 18, orient: 'v', size: 6,
          label: '', kks: '', isOpen: sim.saozActive, type: 'check'
        });
      });
      drawItemTag(5, rxMidX, saozY - 10, 'Гидроемкости САОЗ (4x60 м³)');

      activeHotspots.push({
        x: saozL_X, y: saozY, w: saozW * 2 + 18, h: saozH,
        title: 'Гидроемкости первой ступени САОЗ (ГЕ САОЗ-1, KKS JNB10..40)',
        sub: '4 емкости по 60 м³ • Азотная подушка 6.0 МПа • Раствор бора 16 г/кг',
        desc: 'Пассивная гидродинамическая подача борированной воды при падении давления 1-го контура ниже 6.0 МПа (в опускной зазор и верхний пленум реактора).',
        simple: window.plainExplanations ? window.plainExplanations.saoz : 'Аварийные баллоны с борированной водой, которые заливают реактор без электричества.',
        telemetry: () => `Статус САОЗ: ${sim.saozActive ? 'ПОДАЧА ВКЛЮЧЕНА' : 'В ОЖИДАНИИ'} | Запас воды: ${sim.saozWaterPct.toFixed(1)}% | Давление азота: 5.95 МПа`,
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

      const sg1LevelPx = Math.min(sg1H - 8, Math.max(6, (lp1.sgLevelM / 3.0) * (sg1H - 12)));
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.fillRect(sg1X + 4, sg1Y + sg1H - 4 - sg1LevelPx, sg1W - 8, sg1LevelPx);

      ctx.strokeStyle = THERMAL_COLOR_SCALE.REACTOR_CORE;
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(sg1X + 8, sg1Y + sg1H - 20, sg1W - 16, 12);
      ctx.setLineDash([]);
      drawItemTag(2, sg1X + 18, sg1Y + 16, 'ПГВ-1');

      // Правый парогенератор ПГ-2 (2)
      const sg2X = 450, sg2Y = 285, sg2W = 95, sg2H = 50;
      const isSg2Hov = sim.hoveredHotspot && sim.hoveredHotspot.x === sg2X && sim.hoveredHotspot.y === sg2Y;
      roundRect(ctx, sg2X, sg2Y, sg2W, sg2H, 12);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isSg2Hov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const sg2LevelPx = Math.min(sg2H - 8, Math.max(6, (lp2.sgLevelM / 3.0) * (sg2H - 12)));
      ctx.fillStyle = 'rgba(2, 132, 199, 0.35)';
      ctx.fillRect(sg2X + 4, sg2Y + sg2H - 4 - sg2LevelPx, sg2W - 8, sg2LevelPx);

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(sg2X + 8, sg2Y + sg2H - 20, sg2W - 16, 12);
      ctx.setLineDash([]);
      drawItemTag(2, sg2X + 75, sg2Y + 16, 'ПГВ-2');

      // Трубопроводы 1-го контура Ду-850 (280°C–330°C: #EF4444, >350°C: #DC2626, толщина 2.6px + стрелки)
      const loop1HotCol = sim.fuelTempC > 350 && sim.az1Tripped ? THERMAL_COLOR_SCALE.CRITICAL_OVERHEAT : THERMAL_COLOR_SCALE.REACTOR_CORE;
      const loop1ColdCol = THERMAL_COLOR_SCALE.REACTOR_CORE;
      // Левая петля №1:
      ctx.beginPath();
      ctx.moveTo(333, 305);
      ctx.lineTo(290, 305);
      ctx.strokeStyle = loop1HotCol;
      ctx.lineWidth = 2.8;
      ctx.stroke();
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
      drawFlowArrow(275, 395, 0, loop1ColdCol, 5);

      // Насос ГЦН-1 (3)
      drawPidPump({
        x: 210, y: 368, r: 13, flowAngle: Math.PI / 2,
        label: 'ГЦН-1', kks: 'JEC10', isRunning: lp1.pumpOn, rpm: lp1.rpm,
        onClick: () => {
          lp1.pumpOn = !lp1.pumpOn;
          if (typeof addLog === 'function') addLog(`ГЦНА-1 переведен: ${lp1.pumpOn ? 'ВКЛ' : 'ОТКЛ'}`, lp1.pumpOn ? 'ok' : 'warn');
        },
        tooltip: {
          title: 'Главный циркуляционный насос ГЦНА-1391 Петли №1 (KKS JEC10)',
          sub: 'Подача 22 000 м³/ч • Электродвигатель 8000 кВт • Давление 16.20 МПа',
          desc: 'Вертикальный центробежный насос с гидрокамерным уплотнением вала. Обеспечивает прокачку теплоносителя через активную зону.',
          simple: window.plainExplanations ? window.plainExplanations.gcna : 'Мощный насос, который непрерывно гонит горячую воду через реактор.',
          telemetry: () => `ГЦНА-1: ${lp1.pumpOn ? 'В РАБОТЕ' : 'ОТКЛЮЧЕН'} | ${lp1.rpm.toFixed(0)} об/мин | Расход: ${(lp1.pumpOn ? 4400 : 500)} кг/с`
        }
      });
      drawItemTag(3, 210, 396);

      // Правая петля №2:
      ctx.beginPath();
      ctx.moveTo(417, 305);
      ctx.lineTo(450, 305);
      ctx.strokeStyle = loop1HotCol;
      ctx.lineWidth = 2.8;
      ctx.stroke();
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
      drawFlowArrow(470, 395, Math.PI, loop1ColdCol, 5);

      // Насос ГЦН-2 (3)
      drawPidPump({
        x: 530, y: 368, r: 13, flowAngle: Math.PI / 2,
        label: 'ГЦН-2', kks: 'JEC20', isRunning: lp2.pumpOn, rpm: lp2.rpm,
        onClick: () => {
          lp2.pumpOn = !lp2.pumpOn;
          if (typeof addLog === 'function') addLog(`ГЦНА-2 переведен: ${lp2.pumpOn ? 'ВКЛ' : 'ОТКЛ'}`, lp2.pumpOn ? 'ok' : 'warn');
        },
        tooltip: {
          title: 'Главный циркуляционный насос ГЦНА-1391 Петли №2 (KKS JEC20)',
          sub: 'Подача 22 000 м³/ч • 8000 кВт • Давление 16.20 МПа',
          desc: 'Обеспечивает циркуляцию теплоносителя петли №2.',
          simple: window.plainExplanations ? window.plainExplanations.gcna : 'Второй насос главного циркуляционного контура.',
          telemetry: () => `ГЦНА-2: ${lp2.pumpOn ? 'В РАБОТЕ' : 'ОТКЛЮЧЕН'} | ${lp2.rpm.toFixed(0)} об/мин`
        }
      });
      drawItemTag(3, 530, 396);

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
      ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.fillRect(kdX + 3, kdY + kdH - 8 - kdWaterH, kdW - 6, kdWaterH);

      ctx.strokeStyle = sim.heatersPowerKW > 100 ? '#f59e0b' : '#64748b';
      ctx.lineWidth = 1.2;
      for (let tx = kdX + 7; tx <= kdX + kdW - 7; tx += 6) {
        ctx.beginPath();
        ctx.moveTo(tx, kdY + kdH - 4);
        ctx.lineTo(tx, kdY + kdH - 14);
        ctx.stroke();
      }
      drawItemTag(4, kdX + kdW / 2, kdY + 18, 'КД');

      // Дыхательный трубопровод Ду-350 от горячей нитки (305, 305) к низу КД (280, 265)
      ctx.beginPath();
      ctx.moveTo(305, 305);
      ctx.lineTo(305, 275);
      ctx.lineTo(kdX + kdW / 2, 275);
      ctx.lineTo(kdX + kdW / 2, kdY + kdH);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Линия впрыска (спрей) из холодной нитки петли 1 (210, 395) вверх в паровую зону КД
      ctx.beginPath();
      ctx.moveTo(235, 395);
      ctx.lineTo(235, kdY + 12);
      ctx.lineTo(kdX, kdY + 12);
      ctx.strokeStyle = sim.sprayActive ? '#38bdf8' : '#2563eb';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      drawPidValve({
        x: 235, y: kdY + 35, orient: 'v', size: 6,
        label: 'Впрыск', kks: 'JEP20', isOpen: sim.sprayActive, type: 'reg',
        onClick: () => {
          sim.sprayActive = !sim.sprayActive;
          if (typeof addLog === 'function') addLog(sim.sprayActive ? 'Впрыск в КД включен' : 'Впрыск в КД отключен', 'action');
        },
        tooltip: {
          title: 'Клапан впрыска в паровую подушку КД (KKS JEP20)',
          sub: 'Подача из холодной нитки для конденсации пара и снижения P1',
          desc: 'Быстро конденсирует пар в куполе КД при росте давления выше 16.3 МПа.',
          simple: window.plainExplanations ? window.plainExplanations.kd : 'Охлаждающий душ сверху в баке компенсатора давления.',
          telemetry: () => `Впрыск в КД: ${sim.sprayActive ? 'АКТИВЕН' : 'ЗАКРЫТ'}`
        }
      });

      // Барботер КД (19) — прием сброса от ИПУ КД
      const bbX = 215, bbY = 415, bbW = 60, bbH = 34;
      const isBbHov = sim.hoveredHotspot && sim.hoveredHotspot.x === bbX && sim.hoveredHotspot.y === bbY;
      roundRect(ctx, bbX, bbY, bbW, bbH, 8);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isBbHov ? '#0284C7' : (sim.ipuKdOpen ? '#DC2626' : '#1E293B');
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(2, 132, 199, 0.35)';
      ctx.fillRect(bbX + 3, bbY + 12, bbW - 6, bbH - 15);
      drawItemTag(19, bbX + bbW / 2, bbY + 14, 'Барботер');

      // Линия сброса ИПУ КД в барботер
      ctx.beginPath();
      ctx.moveTo(kdX, kdY + 22);
      ctx.lineTo(kdX - 14, kdY + 22);
      ctx.lineTo(kdX - 14, bbY + 18);
      ctx.lineTo(bbX + bbW, bbY + 18);
      ctx.strokeStyle = sim.ipuKdOpen ? '#ef4444' : '#64748b';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      drawPidValve({
        x: kdX - 14, y: kdY + 38, orient: 'v', size: 6,
        label: 'ИПУ КД', kks: 'JEP11', isOpen: sim.ipuKdOpen, type: 'safety', statusType: sim.ipuKdOpen ? 'danger' : 'norm',
        onClick: () => {
          sim.ipuKdOpen = !sim.ipuKdOpen;
          if (typeof addLog === 'function') addLog(sim.ipuKdOpen ? 'ИПУ КД открыт (аварийный сброс)!' : 'ИПУ КД закрыт', sim.ipuKdOpen ? 'alarm' : 'norm');
        },
        tooltip: {
          title: 'Импульсно-предохранительное устройство КД (ИПУ КД, KKS JEP11)',
          sub: 'Защита 1-го контура от опасного превышения давления > 17.5 МПа',
          desc: 'Сбрасывает избыточный пар из компенсатора давления под слой воды в бак-барботер.',
          simple: window.plainExplanations ? window.plainExplanations.kd : 'Аварийный предохранительный клапан-свисток на крышке КД.',
          telemetry: () => `ИПУ КД: ${sim.ipuKdOpen ? 'ОТКРЫТ (СБРОС В БАРБОТЕР)' : 'ЗАКРЫТ (НОРМА)'}`
        }
      });

      // Бак-приямок (8) в нижней части гермооболочки
      const sumpX = 465, sumpY = 445, sumpW = 90, sumpH = 55;
      const isSumpHov = sim.hoveredHotspot && sim.hoveredHotspot.x === sumpX && sim.hoveredHotspot.y === sumpY;
      roundRect(ctx, sumpX, sumpY, sumpW, sumpH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = isSumpHov ? '#0284C7' : '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(2, 132, 199, 0.4)';
      ctx.fillRect(sumpX + 3, sumpY + 16, sumpW - 6, sumpH - 19);

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(sumpX + 6, sumpY + sumpH - 16, sumpW - 12, 10);
      ctx.setLineDash([]);
      drawItemTag(8, sumpX + sumpW / 2, sumpY + 14, 'Бак-приямок');

      activeHotspots.push({
        x: kdX, y: kdY, w: kdW, h: kdH,
        title: 'Компенсатор давления (КД, KKS JEP10)',
        sub: 'Объем 79 м³ • 16.20 МПа • 4 группы ТЭН 2520 кВт',
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
        title: 'Парогенератор ПГВ-1000МКП Петли №1 (KKS JEB10)',
        sub: 'Горизонтальный теплообменник 1-го и 2-го контуров (РУ В-491)',
        desc: '11 000 нержавеющих U-образных трубок 16х1.5 мм. Генерирует 445 кг/с сухого пара при 7.0 МПа.',
        simple: window.plainExplanations ? window.plainExplanations.pgv : 'Теплообменник, где жар реактора варит чистый пар для турбины.',
        telemetry: () => `ПГВ-1: Уровень ${lp1.sgLevelM.toFixed(2)} м | P₂: ${sim.steamHeaderPressMPa.toFixed(2)} МПа | Тгор: ${lp1.tHot.toFixed(1)} °C | Тхол: ${lp1.tCold.toFixed(1)} °C`
      });

      activeHotspots.push({
        x: sg2X, y: sg2Y, w: sg2W, h: sg2H,
        title: 'Парогенератор ПГВ-1000МКП Петли №2 (KKS JEB20)',
        sub: 'Горизонтальный теплообменник 1-го и 2-го контуров (РУ В-491)',
        desc: 'Генерирует пар давлением 7.0 МПа для машинного зала.',
        simple: window.plainExplanations ? window.plainExplanations.pgv : 'Второй парогенератор энергоблока.',
        telemetry: () => `ПГВ-2: Уровень ${lp2.sgLevelM.toFixed(2)} м | P₂: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`
      });

      activeHotspots.push({
        x: sumpX, y: sumpY, w: sumpW, h: sumpH,
        title: 'Бак-приямок гермооболочки (KKS JNK10..40)',
        sub: 'Запас борированной воды низкой концентрации (16 г/кг)',
        desc: 'Сбор теплоносителя при авариях с течью и источник питания насосов САОЗ НД/ВД по замкнутому контуру рециркуляции.',
        simple: 'Огромный бассейн на полу под куполом, откуда насосы качают воду обратно в реактор при аварии.',
        telemetry: () => `Запас воды: 100% | Концентрация бора: 16.0 г/кг`
      });

      // ========================================================================
      // 5. ВНИЗУ: БАКИ И НАСОСЫ АВАРИЙНОГО ВПРЫСКА БОРА (11, 12, 13, 15, 21, 26, 34)
      // ========================================================================
      drawPidPump({
        x: 485, y: 560, r: 12, flowAngle: -Math.PI / 2,
        label: '', kks: 'САОЗ НД', isRunning: sim.saozActive, rpm: sim.saozActive ? 1500 : 0
      });
      drawItemTag(11, 485, 582, 'САОЗ НД');

      drawPidPump({
        x: 540, y: 560, r: 12, flowAngle: -Math.PI / 2,
        label: '', kks: 'САОЗ ВД', isRunning: sim.saozActive, rpm: sim.saozActive ? 3000 : 0
      });
      drawItemTag(12, 540, 582, 'САОЗ ВД');

      // Всас насосов 11, 12 из приямка (8)
      ctx.beginPath();
      ctx.moveTo(sumpX + sumpW / 2, sumpY + sumpH);
      ctx.lineTo(sumpX + sumpW / 2, 540);
      ctx.lineTo(485, 540);
      ctx.lineTo(485, 548);
      ctx.moveTo(sumpX + sumpW / 2, 540);
      ctx.lineTo(540, 540);
      ctx.lineTo(540, 548);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Нагнетание насосов 11, 12 в реактор В-491
      ctx.beginPath();
      ctx.moveTo(485, 572);
      ctx.lineTo(485, 605);
      ctx.lineTo(375, 605);
      ctx.lineTo(375, rxY + rxH);
      ctx.moveTo(540, 572);
      ctx.lineTo(540, 605);
      ctx.strokeStyle = sim.saozActive ? '#ec4899' : '#64748b';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Бак запаса бора высокой концентрации (13) + насос ввода бора (14)
      const bTankX = 270, bTankY = 545, bTankW = 34, bTankH = 50;
      roundRect(ctx, bTankX, bTankY, bTankW, bTankH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.fillRect(bTankX + 2, bTankY + 14, bTankW - 4, bTankH - 16);
      drawItemTag(13, bTankX + bTankW / 2, bTankY + 10);

      drawPidPump({
        x: bTankX + bTankW / 2, y: 620, r: 10, flowAngle: -Math.PI / 2,
        label: '', kks: 'СБР', isRunning: sim.boronMode > 0, rpm: sim.boronMode > 0 ? 1000 : 0
      });
      drawItemTag(14, bTankX + bTankW / 2, 638, 'СБР');

      // Бак подачи химреагентов (15) + насос ввода (16)
      const cTankX = 330, cTankY = 545, cTankW = 30, cTankH = 50;
      roundRect(ctx, cTankX, cTankY, cTankW, cTankH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.fillRect(cTankX + 2, cTankY + 14, cTankW - 4, cTankH - 16);
      drawItemTag(15, cTankX + cTankW / 2, cTankY + 10);

      drawPidPump({
        x: cTankX + cTankW / 2, y: 620, r: 10, flowAngle: -Math.PI / 2,
        label: '', kks: '16', isRunning: false, rpm: 0
      });
      drawItemTag(16, cTankX + cTankW / 2, 638);

      // Бак аварийного запаса щелочи (21)
      const alkTankX = 580, alkTankY = 545, alkTankW = 34, alkTankH = 50;
      roundRect(ctx, alkTankX, alkTankY, alkTankW, alkTankH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.fillRect(alkTankX + 2, alkTankY + 14, alkTankW - 4, alkTankH - 16);
      drawItemTag(21, alkTankX + alkTankW / 2, alkTankY + 10);

      // Бак запаса обессоленной воды (26) + аварийный питательный насос (27)
      const dTankX = 140, dTankY = 545, dTankW = 45, dTankH = 50;
      roundRect(ctx, dTankX, dTankY, dTankW, dTankH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(dTankX + 2, dTankY + 12, dTankW - 4, dTankH - 14);
      drawItemTag(26, dTankX + dTankW / 2, dTankY + 10, 'Бак ОВ');

      drawPidPump({
        x: dTankX + dTankW / 2, y: 620, r: 11, flowAngle: 0,
        label: '', kks: 'АПЭН', isRunning: false, rpm: 0
      });
      drawItemTag(27, dTankX + dTankW / 2, 638, 'АПЭН');

      // Брызгальный бассейн (34)
      const spX = 220, spY = 650, spW = 160, spH = 34;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(spX, spY, spW, spH);
      ctx.strokeStyle = '#1E293B';
      ctx.strokeRect(spX, spY, spW, spH);
      ctx.fillStyle = 'rgba(2, 132, 199, 0.4)';
      ctx.fillRect(spX + 2, spY + 10, spW - 4, spH - 12);

      // Фонтаны брызгального бассейна
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      for (let fx = spX + 16; fx <= spX + spW - 16; fx += 24) {
        ctx.beginPath();
        ctx.moveTo(fx, spY + 10);
        ctx.quadraticCurveTo(fx - 4, spY - 6, fx - 8, spY + 8);
        ctx.moveTo(fx, spY + 10);
        ctx.quadraticCurveTo(fx + 4, spY - 6, fx + 8, spY + 8);
        ctx.stroke();
      }
      drawItemTag(34, spX + spW / 2, spY + 20, 'Брызгальный бассейн');

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
      ctx.strokeStyle = THERMAL_COLOR_SCALE.HOT_STEAM;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      drawFlowArrow(560, steamY1, 0, THERMAL_COLOR_SCALE.HOT_STEAM, 5);
      drawFlowArrow(560, steamY2, 0, THERMAL_COLOR_SCALE.HOT_STEAM, 5);

      // Гермопроходки через двойную оболочку (сильфонные узлы)
      ctx.fillStyle = '#475569';
      ctx.fillRect(594, steamY1 - 5, 28, 10);
      ctx.fillRect(594, steamY2 - 5, 28, 10);

      // Главный паровой арматурный блок (22) (ГПАБ / БОА)
      const gpabX = 690;
      drawPidValve({
        x: gpabX, y: steamY1, orient: 'h', size: 7,
        label: 'БЗОК-1', kks: '22', isOpen: true, type: 'motor',
        tooltip: {
          title: 'Быстродействующий запорный отсечной клапан (БЗОК, KKS LBA10)',
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
      drawItemTag(22, gpabX + 10, steamY1 - 18, 'ГПАБ (БОА)');

      // Станция БРУ-А (сброс в атмосферу)
      drawPidValve({
        x: gpabX + 28, y: steamY1 - 32, orient: 'v', size: 6,
        label: 'БРУ-А', kks: 'LBN', isOpen: sim.bruAOpen, type: 'safety', statusType: sim.bruAOpen ? 'danger' : 'norm',
        onClick: () => {
          sim.bruAOpen = !sim.bruAOpen;
          if (typeof addLog === 'function') addLog(sim.bruAOpen ? 'БРУ-А открыт (выхлоп пара в атмосферу)!' : 'БРУ-А закрыт', sim.bruAOpen ? 'warn' : 'norm');
        },
        tooltip: {
          title: 'Быстродействующая редукционная установка сброса в атмосферу (БРУ-А, KKS LBN)',
          sub: 'Аварийный сброс избыточного пара прямо в атмосферу',
          desc: 'Срабатывает при потере вакуума в конденсаторе или отключении турбины для предотвращения открытия предохранительных клапанов ПГ.',
          simple: 'Клапан аварийного сброса пара на улицу.',
          telemetry: () => `БРУ-А: ${sim.bruAOpen ? 'ОТКРЫТ (СБРОС В АТМОСФЕРУ)' : 'ЗАКРЫТ'}`
        }
      });
      ctx.beginPath();
      ctx.moveTo(gpabX + 28, steamY1);
      ctx.lineTo(gpabX + 28, steamY1 - 42);
      ctx.strokeStyle = sim.bruAOpen ? '#ef4444' : '#64748b';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Объединенный паропровод острого пара 7.00 МПа в машинный зал
      ctx.beginPath();
      ctx.moveTo(gpabX + 10, steamY1);
      ctx.lineTo(815, steamY1);
      ctx.lineTo(815, steamY2);
      ctx.moveTo(gpabX + 10, steamY2);
      ctx.lineTo(815, steamY2);
      ctx.lineTo(815, 115);
      ctx.lineTo(845, 115);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.0;
      ctx.stroke();

      // Стопорно-регулирующий клапан турбины (СК/РК)
      drawPidValve({
        x: 830, y: 115, orient: 'h', size: 7,
        label: 'РК', kks: 'LMA10', isOpen: sim.turbineValvePct > 10, type: 'reg',
        onClick: () => {
          const next = sim.turbineValvePct >= 90 ? 50 : (sim.turbineValvePct >= 40 ? 0 : 100);
          sim.turbineValvePct = next;
          if (typeof addLog === 'function') addLog(`Клапаны турбины (РК): ${next}%`, next === 0 ? 'warn' : 'action');
        },
        tooltip: {
          title: 'Стопорно-регулирующие клапаны турбины (СК / РК, KKS LMA10)',
          sub: 'Регулирование расхода свежего пара в цилиндр высокого давления',
          desc: 'Кликните для циклического изменения: 100% -> 50% -> 0% (СТОП).',
          simple: window.plainExplanations ? window.plainExplanations.turbine : 'Главный кран подачи пара на лопатки турбины.',
          telemetry: () => `Открытие РК: ${sim.turbineValvePct.toFixed(0)}% | Давление перед РК: ${sim.steamHeaderPressMPa.toFixed(2)} МПа`
        }
      });

      // Цилиндр высокого давления ЦВД (45)
      const hpcX = 845, hpcY = 90, hpcW = 55, hpcH = 50;
      ctx.beginPath();
      ctx.moveTo(hpcX, hpcY + 12);
      ctx.lineTo(hpcX + hpcW, hpcY);
      ctx.lineTo(hpcX + hpcW, hpcY + hpcH);
      ctx.lineTo(hpcX, hpcY + hpcH - 12);
      ctx.closePath();
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.font = 'bold 8.5px monospace';
      ctx.fillStyle = '#0F172A';
      ctx.fillText('ЦВД', hpcX + 16, hpcY + hpcH / 2 + 3);
      drawItemTag(45, hpcX + 16, hpcY - 8);

      // Пароперегреватели / СПП (46)
      const sppX = 910, sppY = 48, sppW = 52, sppH = 34;
      roundRect(ctx, sppX, sppY, sppW, sppH, 6);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#D97706';
      ctx.fillText('СПП-1200', sppX + 6, sppY + 16);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 7.5px monospace';
      ctx.fillText('(ПП)', sppX + 18, sppY + 27);
      drawItemTag(46, sppX + sppW / 2, sppY - 8, 'Пароперегреватели');

      // Линии пара от ЦВД в СПП и из СПП в ЦНД (строго под 90°)
      ctx.beginPath();
      ctx.moveTo(hpcX + hpcW, hpcY + 10);
      ctx.lineTo(sppX, hpcY + 10);
      ctx.lineTo(sppX, sppY + sppH / 2);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(sppX + sppW, sppY + sppH / 2);
      ctx.lineTo(970, sppY + sppH / 2);
      ctx.lineTo(970, 85);
      ctx.lineTo(1150, 85);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // 3 цилиндра низкого давления ЦНД-1..3 (45)
      const cndCenters = [995, 1060, 1125];
      cndCenters.forEach((cx, idx) => {
        const cW = 48, cH = 60, cY = 88;
        ctx.beginPath();
        ctx.moveTo(cx - cW / 2 + 8, cY);
        ctx.lineTo(cx + cW / 2 - 8, cY);
        ctx.lineTo(cx + cW / 2, cY + cH);
        ctx.lineTo(cx - cW / 2, cY + cH);
        ctx.closePath();
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.fillText(`ЦНД-${idx + 1}`, cx, cY + cH / 2 + 2);
        ctx.textAlign = 'left';

        // Выхлопной патрубок вниз в конденсатор (42)
        ctx.beginPath();
        ctx.moveTo(cx - 14, cY + cH);
        ctx.lineTo(cx - 14, 185);
        ctx.moveTo(cx + 14, cY + cH);
        ctx.lineTo(cx + 14, 185);
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });

      // Валопровод к турбогенератору ТЗВ-1200-2 (47)
      ctx.beginPath();
      ctx.moveTo(hpcX + hpcW, 115);
      ctx.lineTo(1175, 115);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 6;
      ctx.stroke();

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
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.font = 'bold 8.5px "Segoe UI", sans-serif';
      ctx.fillStyle = '#0F172A';
      ctx.fillText('ТЗВ-1200-2', genX + 8, genY + 16);
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#16A34A';
      ctx.fillText(`${sim.electricalPowerMW.toFixed(0)} МВт`, genX + 8, genY + 36);
      ctx.font = 'bold 7.5px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText(`${(sim.turbineRpm / 60).toFixed(2)} Гц • 24 кВ`, genX + 8, genY + 50);
      drawItemTag(47, genX + genW - 12, genY + 14);

      // Выход в энергосистему (50) — блочный трансформатор и ЛЭП 500 кВ
      const gridX = 1272, gridY = 115;
      ctx.beginPath();
      ctx.moveTo(genX + genW, gridY);
      ctx.lineTo(gridX, gridY);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Символ трансформатора (два пересекающихся круга)
      ctx.beginPath();
      ctx.arc(gridX + 10, gridY, 10, 0, Math.PI * 2);
      ctx.arc(gridX + 21, gridY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
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
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      drawItemTag(50, 1295, gridY - 26, 'В сеть');

      activeHotspots.push({
        x: genX, y: genY, w: genW, h: genH,
        title: 'Турбогенератор ТЗВ-1200-2 (KKS MKA)',
        sub: '1199.8 МВт • 24 кВ • 50 Гц • 3000 об/мин • Водяное охлаждение',
        desc: 'Синхронный трехфазный генератор с полным водяным охлаждением обмоток статора и ротора дистиллятом.',
        simple: window.plainExplanations ? window.plainExplanations.turbine : 'Главный генератор, превращающий вращение вала турбины в электричество для городов.',
        telemetry: () => `Nэл: ${sim.electricalPowerMW.toFixed(1)} МВт | f: ${(sim.turbineRpm / 60).toFixed(2)} Гц | Напряжение: 24 кВ | Ток статора: 31 кА`
      });

      // ========================================================================
      // 7. КОНДЕНСАТОРЫ (42) И КОНДЕНСАТНЫЙ ТРАКТ: КЭН (38, 39), БОУ (41), ПНД (37)
      // ========================================================================
      // 3 корпуса конденсатора (42) под ЦНД
      const cdW = 54, cdH = 65, cdY = 185;
      cndCenters.forEach((cx, idx) => {
        const cdx = cx - cdW / 2;
        roundRect(ctx, cdx, cdY, cdW, cdH, 6);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
        ctx.fillRect(cdx + 3, cdY + 12, cdW - 6, cdH - 26);

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(cdx + 3, cdY + cdH - 12, cdW - 6, 9);
      });
      drawItemTag(42, cndCenters[1], cdY + 25, 'Конденсаторы (4.2 кПа)');

      // Сброс БРУ-К из главного паропровода в конденсатор
      ctx.beginPath();
      ctx.moveTo(815, 236);
      ctx.lineTo(920, 236);
      ctx.lineTo(920, cdY + 10);
      ctx.lineTo(cndCenters[0] - cdW / 2, cdY + 10);
      ctx.strokeStyle = sim.bruKOpen ? '#38bdf8' : '#64748b';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      drawPidValve({
        x: 920, y: 220, orient: 'v', size: 6,
        label: 'БРУ-К', kks: 'LBA20', isOpen: sim.bruKOpen, type: 'safety',
        onClick: () => {
          sim.bruKOpen = !sim.bruKOpen;
          if (typeof addLog === 'function') addLog(sim.bruKOpen ? 'БРУ-К открыт (сброс пара в конденсатор)' : 'БРУ-К закрыт', sim.bruKOpen ? 'action' : 'norm');
        },
        tooltip: {
          title: 'Быстродействующая редукционная установка сброса в конденсатор (БРУ-К, KKS LBA20)',
          sub: 'Сброс избыточного пара при сбросах нагрузки энергоблока',
          desc: 'Сбрасывает свежий пар мимо турбины прямо в пароприемные устройства конденсаторов.',
          simple: 'Байпасный клапан сброса пара в конденсатор в обход турбины.',
          telemetry: () => `БРУ-К: ${sim.bruKOpen ? 'ОТКРЫТ (СБРОС В КОНДЕНСАТОР)' : 'ЗАКРЫТ'}`
        }
      });

      // Линия основного конденсата: от конденсаторов к насосам 1-й ступени (38)
      ctx.beginPath();
      cndCenters.forEach((cx, idx) => {
        ctx.moveTo(cx, cdY + cdH);
        ctx.lineTo(cx, cdY + cdH + 16);
      });
      ctx.lineTo(cndCenters[0], cdY + cdH + 16);
      ctx.strokeStyle = THERMAL_COLOR_SCALE.RETURN_CONDENSATE;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Конденсатные насосы 1-й ступени (38) (КЭН-1)
      drawPidPump({
        x: 995, y: 285, r: 11, flowAngle: Math.PI / 2,
        label: '', kks: 'КЭН-1', isRunning: sim.turbineValvePct > 5, rpm: 1500
      });
      drawItemTag(38, 995, 305, 'КЭН-1');

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
      drawItemTag(41, bouX + bouW / 2, bouY - 8);

      // Конденсатные насосы 2-й ступени (39) (КЭН-2)
      drawPidPump({
        x: 895, y: 360, r: 11, flowAngle: Math.PI,
        label: '', kks: 'КЭН-2', isRunning: sim.turbineValvePct > 5, rpm: 1500
      });
      drawItemTag(39, 895, 380, 'КЭН-2');

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
      drawItemTag(37, 835, pndYStart + 36, 'Каскад ПНД');

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
      ctx.moveTo(895, pndYStart);
      ctx.lineTo(915, pndYStart);
      ctx.lineTo(915, 145);
      ctx.lineTo(795, 145);
      ctx.strokeStyle = THERMAL_COLOR_SCALE.RETURN_CONDENSATE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      drawFlowArrow(860, 145, Math.PI, THERMAL_COLOR_SCALE.RETURN_CONDENSATE, 5);

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
      drawItemTag(35, dTankX2 + dTankW2 - 10, dTankY2 + 10);

      activeHotspots.push({
        x: dTankX2, y: dTankY2, w: dTankW2, h: dTankH2,
        title: 'Деаэратор термический 0.871 МПа (KKS LAB)',
        sub: 'Деаэрационная колонка + бак запаса питательной воды 160 м³',
        desc: 'Удаляет коррозионно-агрессивные газы (кислород O2 и углекислый газ CO2) из питательной воды при температуре насыщения 178.5 °C.',
        simple: window.plainExplanations ? window.plainExplanations.pen : 'Бак-термос, где из воды вываривают кислород перед подачей в парогенераторы.',
        telemetry: () => `Давление: 0.871 МПа | T: 178.5 °C | Объем бака: 160 м³`
      });

      // Опускная линия от деаэратора к питательным электронасосам ПЭН (48)
      ctx.beginPath();
      ctx.moveTo(dTankX2 + dTankW2 / 2, dTankY2 + dTankH2);
      ctx.lineTo(dTankX2 + dTankW2 / 2, 245);
      ctx.strokeStyle = '#0284c7';
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
          title: 'Питательные электронасосы (ПЭН, KKS LAB)',
          sub: 'Нагнетание 8.8 МПа • Расход до 1780 кг/с • 225 °C',
          desc: 'Кликните для циклического изменения расхода: 100% -> 50% -> 0% (СТОП).',
          simple: window.plainExplanations ? window.plainExplanations.pen : 'Насосы колоссального давления, которые толкают воду обратно в парогенератор.',
          telemetry: () => `Расход ПЭН: ${sim.feedwaterFlowPct.toFixed(0)}% | Gпв: ${steamKgS.toFixed(0)} кг/с | Pнагн: ${(sim.steamHeaderPressMPa + 1.8).toFixed(2)} МПа`
        }
      });
      drawItemTag(48, 785, 258, 'ПЭН');

      // Вспомогательный питательный насос АПЭН (49)
      drawPidPump({
        x: 760, y: 295, r: 10, flowAngle: Math.PI / 2,
        label: '', kks: 'АПЭН', isRunning: false, rpm: 0
      });
      drawItemTag(49, 785, 295, 'АПЭН');

      // Каскад подогревателей высокого давления ПВД-5..7 (36)
      const pvdYStart = 330;
      for (let i = 0; i < 3; i++) {
        const py = pvdYStart + i * 28;
        roundRect(ctx, 745, py, 32, 22, 6);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.font = 'bold 7.5px monospace';
        ctx.fillStyle = '#0F172A';
        ctx.fillText(`ПВД-${7 - i}`, 748, py + 14);
      }
      drawItemTag(36, 725, pvdYStart + 35, 'ПВД (225 °C)');

      // Напорная магистраль питательной воды 225 °C обратно в парогенераторы
      // От ПВД (760, 415) вниз до Y: 635, влево в реакторное здание, разводка в ПГ-1 и ПГ-2
      ctx.beginPath();
      ctx.moveTo(760, 415);
      ctx.lineTo(760, 635);
      ctx.lineTo(245, 635);
      ctx.lineTo(245, sg1Y + sg1H);
      ctx.moveTo(495, 635);
      ctx.lineTo(495, sg2Y + sg2H);
      ctx.strokeStyle = THERMAL_COLOR_SCALE.HOT_STEAM;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      drawFlowArrow(620, 635, Math.PI, THERMAL_COLOR_SCALE.HOT_STEAM, 5);
      drawFlowArrow(370, 635, Math.PI, THERMAL_COLOR_SCALE.HOT_STEAM, 5);

      drawPidValve({
        x: 245, y: 615, orient: 'v', size: 6,
        label: 'Питат. клапан', kks: 'JEB11', isOpen: sim.feedwaterFlowPct > 10, type: 'reg'
      });

      drawPidValve({
        x: 495, y: 615, orient: 'v', size: 6,
        label: 'Питат. клапан', kks: 'JEB21', isOpen: sim.feedwaterFlowPct > 10, type: 'reg'
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

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      for (let rx = ctX + 10; rx <= ctX + ctW - 10; rx += 8) {
        ctx.beginPath();
        ctx.moveTo(rx, ctY + ctH - 35);
        ctx.lineTo(rx, ctY + ctH - 6);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.fillStyle = '#0284c7';
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
      drawItemTag(40, ctMidX, ctY + ctH / 2 - 10, 'Градирня');
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
      drawItemTag(43, 1190, 555);

      // Контур циркуляционной воды (Ду-2000, холодная вода 10–45°C: #0EA5E9, возврат: #06B6D4):
      ctx.beginPath();
      ctx.moveTo(ctX + ctW, ctY + ctH - 5);
      ctx.lineTo(1135, ctY + ctH - 5);
      ctx.lineTo(1135, 555);
      ctx.lineTo(1160, 555);
      ctx.strokeStyle = THERMAL_COLOR_SCALE.COLD_COOLING;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(1160, 522);
      ctx.lineTo(1160, 220);
      ctx.lineTo(cndCenters[2] + cdW / 2, 220);
      ctx.strokeStyle = THERMAL_COLOR_SCALE.COLD_COOLING;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      drawFlowArrow(1160, 360, -Math.PI / 2, THERMAL_COLOR_SCALE.COLD_COOLING, 5);

      ctx.beginPath();
      ctx.moveTo(cndCenters[0] - cdW / 2, 210);
      ctx.lineTo(960, 210);
      ctx.lineTo(960, ctY + 45);
      ctx.lineTo(ctX + 10, ctY + 45);
      ctx.strokeStyle = THERMAL_COLOR_SCALE.RETURN_CONDENSATE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      drawFlowArrow(960, 340, Math.PI / 2, THERMAL_COLOR_SCALE.RETURN_CONDENSATE, 5);

      // Насосы техводы неответственных потребителей (33) и потребители машзала (44)
      drawPidPump({
        x: 1245, y: 535, r: 11, flowAngle: -Math.PI / 2,
        label: '', kks: '33', isRunning: true, rpm: 1000
      });
      drawItemTag(33, 1245, 555, 'Насос техводы');

      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(1225, 410, 42, 30);
      ctx.strokeStyle = '#1E293B';
      ctx.strokeRect(1225, 410, 42, 30);
      ctx.font = 'bold 7.5px monospace';
      ctx.fillStyle = '#0F172A';
      ctx.fillText('ТЕПЛООБМ.', 1228, 425);
      ctx.fillText('(44)', 1238, 435);
      drawItemTag(44, 1245, 398);

      activeHotspots.push({
        x: ctX, y: ctY, w: ctW, h: ctH,
        title: 'Башенная испарительная градирня (KKS MAA)',
        sub: 'Высота 167 м • Охлаждение циркуляционной воды 2-го контура',
        desc: 'Естественная тяга гиперболоидной железобетонной башни. Охлаждает до 160 000 м³/ч циркуляционной воды за счет частичного испарения.',
        simple: window.plainExplanations ? window.plainExplanations.condenser : 'Огромная коническая башня с паром, охлаждающая воду после конденсатора.',
        telemetry: () => `Tгор: 36.5 °C | Tхол: 24.2 °C | Расход ЦВ: 45 000 кг/с`
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
          drawParticlesOnPath([[245, 285], [245, steamY1], [685, steamY1]], 5, flowSteam * 4.0, THERMAL_COLOR_SCALE.HOT_STEAM, 2.4);
          drawParticlesOnPath([[495, 285], [495, steamY2], [685, steamY2]], 4, flowSteam * 4.0, THERMAL_COLOR_SCALE.HOT_STEAM, 2.4);
          drawParticlesOnPath([[gpabX + 10, steamY1], [815, steamY1], [815, 115], [845, 115]], 5, flowSteam * 4.2, THERMAL_COLOR_SCALE.HOT_STEAM, 2.5);
        }

        // 3. Питательная вода 225 °C (100°C–280°C: #F59E0B)
        const flowFeed = sim.feedwaterFlowPct / 100;
        if (flowFeed > 0.05) {
          drawParticlesOnPath([[dTankX2 + dTankW2 / 2, dTankY2 + dTankH2], [dTankX2 + dTankW2 / 2, 245]], 2, flowFeed * 3.2, THERMAL_COLOR_SCALE.HOT_STEAM, 2.4);
          drawParticlesOnPath([[760, 415], [760, 635], [245, 635], [245, sg1Y + sg1H]], 8, flowFeed * 3.5, THERMAL_COLOR_SCALE.HOT_STEAM, 2.5);
          drawParticlesOnPath([[495, 635], [495, sg2Y + sg2H]], 2, flowFeed * 3.5, THERMAL_COLOR_SCALE.HOT_STEAM, 2.4);
        }

        // 4. Возвратный контур конденсата (45°C–100°C: #06B6D4)
        if (flowFeed > 0.05) {
          drawParticlesOnPath([[915, pndYStart], [915, 145], [795, 145]], 4, flowFeed * 3.2, THERMAL_COLOR_SCALE.RETURN_CONDENSATE, 2.2);
        }

        // 5. Циркуляционная вода градирни (10°C–45°C: #0EA5E9 и возврат #06B6D4)
        drawParticlesOnPath([[ctX + ctW, ctY + ctH - 5], [1135, ctY + ctH - 5], [1135, 555], [1160, 555]], 3, 2.8, THERMAL_COLOR_SCALE.COLD_COOLING, 2.4);
        drawParticlesOnPath([[1160, 522], [1160, 220], [cndCenters[2] + cdW / 2, 220]], 5, 3.2, THERMAL_COLOR_SCALE.COLD_COOLING, 2.4);
        drawParticlesOnPath([[cndCenters[0] - cdW / 2, 210], [960, 210], [960, ctY + 45], [ctX + 10, ctY + 45]], 5, 3.0, THERMAL_COLOR_SCALE.RETURN_CONDENSATE, 2.4);

        // 6. Условные аварийные потоки
        if (sim.saozActive) {
          drawParticlesOnPath([[saozL_X + saozW / 2, saozY + saozH], [saozL_X + saozW / 2, rxY + 30], [rxX + 4, rxY + 30]], 3, 4.0, '#ec4899', 2.4);
          drawParticlesOnPath([[saozR_X + saozW / 2, saozY + saozH], [saozR_X + saozW / 2, rxY + 30], [rxX + rxW - 4, rxY + 30]], 3, 4.0, '#ec4899', 2.4);
        }

        if (sim.sprayActive) {
          drawParticlesOnPath([[235, 395], [235, kdY + 12], [kdX, kdY + 12]], 3, 3.2, '#38bdf8', 2.2);
        }

        if (sim.ipuKdOpen) {
          drawParticlesOnPath([[kdX, kdY + 22], [kdX - 14, kdY + 22], [kdX - 14, bbY + 18], [bbX + bbW, bbY + 18]], 4, 4.5, '#ef4444', 2.5);
        }

        if (sim.bruKOpen) {
          drawParticlesOnPath([[815, 236], [920, 236], [920, cdY + 10], [cndCenters[0] - cdW / 2, cdY + 10]], 4, 4.0, '#38bdf8', 2.4);
        }

        if (sim.bruAOpen) {
          drawParticlesOnPath([[gpabX + 28, steamY1], [gpabX + 28, steamY1 - 42]], 2, 4.0, '#f59e0b', 2.4);
        }
      }
    }

    // Совместимый псевдоним renderPanoramic
    function renderPanoramic() {
      return renderPanoramicSystemsView();
    }

    // ============================================================================
    // РЕЖИМ 2: ВЕРТИКАЛЬНЫЙ РАЗРЕЗ ЗДАНИЯ РЕАКТОРА И ГЕРМООБОЛОЧКИ 10UJA (В-491)
    // Строгий дизайн-код IAEA SCADA / DARK TECH (#080D14 / #0B0F17)
    // Машинный зал полностью исключен — строго гермозона 10UJA по центру холста
    // Высота здания: 85% высоты Canvas (612px из 720px: от Y=58 до Y=670)
    // ============================================================================
    function renderCrossSectionView() {
      activeHotspots = [];
      window.activeHotspots = activeHotspots;
      const W = 1360, H = 720;

      // Палитра SLATE LIGHT SCADA & ИНЖЕНЕРНАЯ ТЕМПЕРАТУРНАЯ ШКАЛА
      const PAL = {
        bgDeep: '#FFFFFF',
        bgInner: '#F8FAFC',
        wallStroke: '#334155',
        wallSolid: '#475569',
        vesselStroke: '#1E293B',
        textMain: '#0F172A',
        textSub: '#334155',
        hotLeg: THERMAL_COLOR_SCALE.REACTOR_CORE,
        reactorCore: THERMAL_COLOR_SCALE.CRITICAL_OVERHEAT,
        coldLeg: THERMAL_COLOR_SCALE.REACTOR_CORE,
        steam: THERMAL_COLOR_SCALE.HOT_STEAM,
        steamAlt: THERMAL_COLOR_SCALE.HOT_STEAM,
        feedwater: THERMAL_COLOR_SCALE.RETURN_CONDENSATE,
        condensate: THERMAL_COLOR_SCALE.COLD_COOLING,
        safety: THERMAL_COLOR_SCALE.COLD_COOLING,
        statusOk: '#16A34A',
        statusOff: '#64748B',
        statusAlarm: '#DC2626'
      };

      ctx.save();

      // Безопасное получение параметров симуляции
      const p1 = (typeof sim.primaryPressureMPa === 'number' ? sim.primaryPressureMPa : 16.20);
      const przLvl = (typeof sim.pressurizerLevelM === 'number' ? sim.pressurizerLevelM : 8.40);
      const p2 = (typeof sim.steamHeaderPressMPa === 'number' ? sim.steamHeaderPressMPa : 7.00);
      const heatersOn = Boolean(sim.heatersPowerKW > 0 || sim.heatersMode === 'ON');

      // ========================================================================
      // 1. ГЕОМЕТРИЯ ЗДАНИЯ РЕАКТОРА 10UJA (СТРОГО ПО ЦЕНТРУ X=680, ВЫСОТА 85% = 612px)
      // ========================================================================
      const domeCX = W / 2;         // 680 px — строго по центру холста
      const topDomeY = 58;          // Верхняя точка наружного купола
      const groundY = 670;          // Уровень фундаментной плиты 0.000 (670 - 58 = 612px = 85% от 720)
      const outerR = 300;           // Радиус наружной защитной оболочки (НЗО)
      const innerR = 276;           // Радиус внутренней преднапряженной гермооболочки (ВЗО)
      const domeCY = topDomeY + outerR; // Y=358 — центр сферического свода купола

      // Строительные высотные уровни внутри 10UJA:
      const elev000Y = groundY;     //  0.000 — Фундаментная плита и шахта УЛР (Y=670)
      const elev132Y = 532;         // +13.200 — Площадка обслуживания ГЦНА и боксов ПГ (Y=532)
      const elev263Y = 368;         // +26.300 — Перекрытие реакторного зала и ярус ГЕ САОЗ (Y=368)
      const elev650Y = 138;         // +65.000 — Подкупольное пространство и спринклеры (Y=138)

      // Заголовок чертежа
      ctx.fillStyle = PAL.safety;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('10UJA: ВЕРТИКАЛЬНЫЙ РАЗРЕЗ ЗДАНИЯ РЕАКТОРА И ДВОЙНОЙ ГЕРМООБОЛОЧКИ В-491 (БелАЭС)', domeCX, 32);

      // 1.1 Монолитная железобетонная фундаментная плита (отм. 0.000)
      ctx.fillStyle = PAL.bgInner;
      ctx.fillRect(domeCX - outerR - 30, groundY, (outerR + 30) * 2, 22);
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(domeCX - outerR - 30, groundY, (outerR + 30) * 2, 22);

      // Штриховка фундаментной плиты
      ctx.beginPath();
      ctx.strokeStyle = PAL.wallSolid;
      ctx.lineWidth = 1;
      for (let bx = domeCX - outerR - 24; bx < domeCX + outerR + 24; bx += 16) {
        ctx.moveTo(bx, groundY);
        ctx.lineTo(bx - 10, groundY + 22);
      }
      ctx.stroke();

      // 1.2 Наружная защитная оболочка (НЗО) и Внутренняя преднапряженная оболочка (ВЗО)
      ctx.beginPath();
      ctx.moveTo(domeCX - outerR, groundY);
      ctx.lineTo(domeCX - outerR, domeCY);
      ctx.arc(domeCX, domeCY, outerR, Math.PI, 0, false);
      ctx.lineTo(domeCX + outerR, groundY);
      ctx.closePath();
      ctx.fillStyle = PAL.bgInner;
      ctx.fill();
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Стены межоболочечного пространства (заливка бетонных стен между outerR и innerR)
      ctx.beginPath();
      ctx.moveTo(domeCX - innerR, groundY);
      ctx.lineTo(domeCX - innerR, domeCY);
      ctx.arc(domeCX, domeCY, innerR, Math.PI, 0, false);
      ctx.lineTo(domeCX + innerR, groundY);
      ctx.closePath();
      ctx.fillStyle = PAL.bgDeep;
      ctx.fill();
      ctx.strokeStyle = PAL.wallSolid;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Пунктир герметизирующей стальной облицовки ВЗО и кольцевого зазора
      ctx.save();
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(domeCX, domeCY, (outerR + innerR) / 2, Math.PI, 0, false);
      ctx.moveTo(domeCX - (outerR + innerR) / 2, domeCY);
      ctx.lineTo(domeCX - (outerR + innerR) / 2, groundY);
      ctx.moveTo(domeCX + (outerR + innerR) / 2, domeCY);
      ctx.lineTo(domeCX + (outerR + innerR) / 2, groundY);
      ctx.stroke();
      ctx.restore();

      // ========================================================================
      // 2. СТРОИТЕЛЬНЫЕ ОТМЕТКИ ВЫСОТ СЛЕВА И ПЕРЕКРЫТИЯ ЯРУСОВ
      // ========================================================================
      const markLeftX = domeCX - outerR - 145;
      const markLineEndX = domeCX - innerR;

      const elevations = [
        { y: elev650Y, code: '+65.000', desc: 'Подкупольное пространство' },
        { y: elev263Y, code: '+26.300', desc: 'Перекрытие / Реакторный зал' },
        { y: elev132Y, code: '+13.200', desc: 'Площадка обслуживания ГЦК' },
        { y: elev000Y, code: ' 0.000', desc: 'Фундаментная плита' }
      ];

      elevations.forEach((el) => {
        ctx.save();
        // Выносная линия отметки слева
        ctx.strokeStyle = PAL.wallStroke;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(markLeftX, el.y);
        ctx.lineTo(domeCX + innerR, el.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Строительный репер (треугольник высотной отметки по ГОСТ)
        ctx.strokeStyle = PAL.safety;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(markLeftX + 10, el.y);
        ctx.lineTo(markLeftX + 4, el.y - 6);
        ctx.lineTo(markLeftX + 16, el.y - 6);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(markLeftX, el.y);
        ctx.lineTo(markLeftX + 75, el.y);
        ctx.stroke();

        ctx.fillStyle = PAL.safety;
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(el.code, markLeftX + 20, el.y - 4);

        ctx.fillStyle = '#0F172A';
        ctx.font = '9px "Segoe UI", sans-serif';
        ctx.fillText(el.desc, markLeftX, el.y + 13);
        ctx.restore();
      });

      // Межъярусные железобетонные перекрытия на +26.300 и +13.200
      ctx.save();
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = '#E2E8F0';
      // Перекрытие +26.300
      ctx.fillRect(domeCX - innerR + 2, elev263Y, innerR * 2 - 4, 8);
      ctx.strokeRect(domeCX - innerR + 2, elev263Y, innerR * 2 - 4, 8);
      // Площадка +13.200
      ctx.fillRect(domeCX - innerR + 2, elev132Y, innerR * 2 - 4, 8);
      ctx.strokeRect(domeCX - innerR + 2, elev132Y, innerR * 2 - 4, 8);
      ctx.restore();

      // ========================================================================
      // 3. ПОД КУПОЛОМ: СПРИНКЛЕРНЫЕ КОЛЛЕКТОРЫ И КРУГОВОЙ ПОЛЯРНЫЙ КРАН
      // ========================================================================

      // 3.1 Спринклерные коллекторы распыления раствора бора под сводом (#00E5FF)
      const spR = innerR - 14;
      ctx.save();
      ctx.strokeStyle = PAL.safety;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(domeCX, domeCY, spR, Math.PI * 1.12, Math.PI * 1.88, false);
      ctx.stroke();

      // Форсунки и факелы распыления бора
      for (let a = Math.PI * 1.16; a <= Math.PI * 1.84; a += 0.085) {
        const nx = domeCX + Math.cos(a) * spR;
        const ny = domeCY + Math.sin(a) * spR;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx, ny + 7);
        ctx.stroke();

        if (sim.saozActive || sim.primaryLeakActive) {
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nx, ny + 7);
          ctx.lineTo(nx - 6, ny + 22);
          ctx.moveTo(nx, ny + 7);
          ctx.lineTo(nx + 6, ny + 22);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.fillStyle = PAL.safety;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('СПРИНКЛЕРНЫЕ КОЛЛЕКТОРЫ РАСПЫЛЕНИЯ БОРА (JNK)', domeCX, domeCY - spR + 18);
      ctx.restore();

      activeHotspots.push({
        x: domeCX - 180, y: domeCY - spR - 6, w: 360, h: 32,
        title: 'Спринклерная система защитной оболочки (KKS JNK)',
        sub: 'Коллекторы распыления борного раствора и гидразин-гидрата под сводом',
        desc: 'Снижает давление и температуру парогазовой смеси внутри гермооболочки при авариях с течью (LOCA) и связывает радиоактивный йод.',
        telemetry: () => `Статус спринклеров: ${(sim.saozActive || sim.primaryLeakActive) ? 'РАСПЫЛЕНИЕ АКТИВНО' : 'ДЕЖУРНЫЙ РЕЖИМ'} | P_ГО: 0.101 МПа`
      });

      // 3.2 Круговой полярный кран (балка и грузовая тележка г/п 360 т на рельсовом пути)
      const craneY = 205;
      const craneSpan = 238;
      ctx.save();
      // Подкрановые консоли на стене ВЗО
      ctx.fillStyle = PAL.wallSolid;
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.2;
      ctx.fillRect(domeCX - innerR + 18, craneY - 4, 22, 14);
      ctx.strokeRect(domeCX - innerR + 18, craneY - 4, 22, 14);
      ctx.fillRect(domeCX + innerR - 40, craneY - 4, 22, 14);
      ctx.strokeRect(domeCX + innerR - 40, craneY - 4, 22, 14);

      // Главная пролетная ферма-балка полярного крана
      ctx.fillStyle = PAL.bgInner;
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(domeCX - craneSpan, craneY - 12, craneSpan * 2, 12);
      ctx.strokeRect(domeCX - craneSpan, craneY - 12, craneSpan * 2, 12);

      // Диагональная решетка фермы крана
      ctx.beginPath();
      ctx.strokeStyle = PAL.wallSolid;
      ctx.lineWidth = 1;
      for (let kx = domeCX - craneSpan + 8; kx < domeCX + craneSpan - 12; kx += 18) {
        ctx.moveTo(kx, craneY - 12);
        ctx.lineTo(kx + 9, craneY);
        ctx.lineTo(kx + 18, craneY - 12);
      }
      ctx.stroke();

      // Грузовая тележка полярного крана и полиспаст главного гака
      const trolleyX = domeCX - 28, trolleyW = 56, trolleyH = 14;
      ctx.fillStyle = PAL.bgDeep;
      ctx.strokeStyle = PAL.safety;
      ctx.lineWidth = 1.2;
      ctx.fillRect(trolleyX, craneY - 26, trolleyW, trolleyH);
      ctx.strokeRect(trolleyX, craneY - 26, trolleyW, trolleyH);

      // Ходовые катки тележки
      ctx.beginPath();
      ctx.arc(trolleyX + 10, craneY - 12, 3, 0, Math.PI * 2);
      ctx.arc(trolleyX + trolleyW - 10, craneY - 12, 3, 0, Math.PI * 2);
      ctx.fillStyle = PAL.safety;
      ctx.fill();

      // Тросы полиспаста и крюковая подвеска 360 т
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(domeCX - 6, craneY);
      ctx.lineTo(domeCX - 6, craneY + 22);
      ctx.moveTo(domeCX + 6, craneY);
      ctx.lineTo(domeCX + 6, craneY + 22);
      ctx.stroke();

      ctx.strokeStyle = PAL.safety;
      ctx.beginPath();
      ctx.rect(domeCX - 9, craneY + 22, 18, 8);
      ctx.moveTo(domeCX, craneY + 30);
      ctx.arc(domeCX, craneY + 35, 5, -Math.PI / 2, Math.PI, false);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('КРУГОВОЙ ПОЛЯРНЫЙ КРАН Г/П 360/32 Т', domeCX + 125, craneY - 16);
      ctx.restore();

      activeHotspots.push({
        x: domeCX - craneSpan, y: craneY - 28, w: craneSpan * 2, h: 65,
        title: 'Круговой полярный кран реакторного отделения (Г/П 360/32 т)',
        sub: 'Круговой рельсовый путь на отметке +47.500 м под куполом 10UJA',
        desc: 'Предназначен для транспортно-технологических операций с корпусом реактора, верхним блоком ШЭМ-3, парогенераторами и чехлами ТВС.',
        telemetry: () => `Грузоподъемность: 360 т | Положение моста: 0.0° (Парковка)`
      });

      // ========================================================================
      // 4. ВЕРХНИЙ ЯРУС (+26.300): 4 ГИДРОЕМКОСТИ САОЗ 1-Й ОЧЕРЕДИ И СПОТ ГО
      // ========================================================================
      // Теплообменники СПОТ ГО на стенах верхнего яруса
      [
        { x: domeCX - 252, y: 232, name: 'СПОТ-1,2' },
        { x: domeCX + 204, y: 232, name: 'СПОТ-3,4' }
      ].forEach((sp) => {
        ctx.save();
        ctx.strokeStyle = sim.spotActive ? PAL.safety : PAL.wallStroke;
        ctx.lineWidth = 1.2;
        ctx.fillStyle = PAL.bgInner;
        ctx.fillRect(sp.x, sp.y, 48, 44);
        ctx.strokeRect(sp.x, sp.y, 48, 44);

        ctx.beginPath();
        ctx.strokeStyle = sim.spotActive ? PAL.safety : PAL.statusOff;
        for (let yy = sp.y + 8; yy <= sp.y + 36; yy += 7) {
          ctx.moveTo(sp.x + 6, yy);
          ctx.lineTo(sp.x + 42, yy);
        }
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sp.name, sp.x + 24, sp.y - 5);
        ctx.restore();

        activeHotspots.push({
          x: sp.x, y: sp.y - 12, w: 48, h: 60,
          title: 'Теплообменник СПОТ ГО (' + sp.name + ')',
          sub: 'Система пассивного отвода тепла от защитной оболочки и ПГ',
          desc: 'Конденсирует пар и отводит остаточное тепло в воздушные теплообменники снаружи оболочки при полном обесточивании.',
          telemetry: () => `Режим СПОТ: ${sim.spotActive ? 'В РАБОТЕ' : 'ОЖИДАНИЕ'} | P₂: ${p2.toFixed(2)} МПа`
        });
      });

      // 4 гидроемкости САОЗ 1-й очереди на перекрытии +26.300 (ГЕ-1..4, #00E5FF)
      const geY = elev263Y - 78;
      [
        { x: domeCX - 190, name: 'ГЕ-1' },
        { x: domeCX - 138, name: 'ГЕ-2' },
        { x: domeCX + 100, name: 'ГЕ-3' },
        { x: domeCX + 152, name: 'ГЕ-4' }
      ].forEach((ge) => {
        const geW = 38, geH = 76;
        ctx.save();
        roundRect(ctx, ge.x, geY, geW, geH, 10);
        ctx.fillStyle = PAL.bgInner;
        ctx.fill();
        ctx.strokeStyle = PAL.safety;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Уровень раствора борной кислоты 16 г/кг
        const lvlH = (sim.saozWaterPct / 100) * (geH - 20);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
        roundRect(ctx, ge.x + 3, geY + geH - 4 - lvlH, geW - 6, lvlH, 6);
        ctx.fill();

        ctx.fillStyle = PAL.safety;
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ge.name, ge.x + geW / 2, geY - 5);
        ctx.fillStyle = '#0F172A';
        ctx.fillText(Math.round(sim.saozWaterPct) + '%', ge.x + geW / 2, geY + 26);
        ctx.fillStyle = PAL.safety;
        ctx.font = '7.5px "JetBrains Mono", monospace';
        ctx.fillText('5.9МПа', ge.x + geW / 2, geY + 38);

        // Трубопроводы аварийного впрыска от ГЕ САОЗ в реактор (#00E5FF)
        ctx.strokeStyle = sim.saozActive ? PAL.statusOk : PAL.safety;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ge.x + geW / 2, geY + geH);
        ctx.lineTo(ge.x + geW / 2, 412);
        ctx.lineTo(ge.x < domeCX ? domeCX - 44 : domeCX + 44, 412);
        ctx.stroke();
        ctx.restore();

        activeHotspots.push({
          x: ge.x, y: geY - 12, w: geW, h: geH + 14,
          title: 'Гидроемкость 1-й очереди САОЗ (' + ge.name + ', KKS JNB)',
          sub: 'Отметка +26.300 • 60 м³ раствора H₃BO₃ (16 г/кг) под давлением азота 5.9 МПа',
          desc: 'Мгновенно заливает активную зону реактора при падении давления 1-го контура ниже 5.9 МПа без участия внешних источников тока.',
          telemetry: () => `Уровень раствора: ${sim.saozWaterPct.toFixed(1)}% | Клапан: ${sim.saozActive ? 'ОТКРЫТ (ПОДАЧА)' : 'ЗАКРЫТ'}`
        });
      });

      // ========================================================================
      // 5. БАССЕЙН ВЫДЕРЖКИ ТОПЛИВА (БВ) СЛЕВА ОТ ШАХТЫ РЕАКТОРА
      // ========================================================================
      const sfpX = domeCX - 150, sfpY = elev263Y + 8, sfpW = 74, sfpH = 156;
      ctx.save();
      // Бетонные стены бассейна выдержки
      ctx.fillStyle = PAL.bgInner;
      ctx.strokeStyle = PAL.wallSolid;
      ctx.lineWidth = 1.5;
      ctx.fillRect(sfpX - 6, sfpY, sfpW + 12, sfpH + 6);
      ctx.strokeRect(sfpX - 6, sfpY, sfpW + 12, sfpH + 6);

      // Водяной столб борированной воды в БВ
      ctx.fillStyle = 'rgba(0, 172, 193, 0.22)';
      ctx.fillRect(sfpX, sfpY + 12, sfpW, sfpH - 12);
      ctx.strokeStyle = PAL.feedwater;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(sfpX, sfpY + 12, sfpW, sfpH - 12);

      // Стеллажи отработавших тепловыделяющих сборок (ОТВС) на дне БВ
      for (let rx = sfpX + 8; rx <= sfpX + sfpW - 12; rx += 10) {
        ctx.fillStyle = PAL.reactorCore;
        ctx.fillRect(rx, sfpY + sfpH - 46, 6, 40);
        ctx.strokeStyle = PAL.steam;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(rx, sfpY + sfpH - 46, 6, 40);
      }

      ctx.fillStyle = PAL.feedwater;
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('БАССЕЙН ВЫДЕРЖКИ', sfpX + sfpW / 2, sfpY + 26);
      ctx.fillText('ТОПЛИВА (БВ / JCA)', sfpX + sfpW / 2, sfpY + 37);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText('H₃BO₃ 16 г/кг', sfpX + sfpW / 2, sfpY + 50);
      ctx.restore();

      activeHotspots.push({
        x: sfpX - 6, y: sfpY, w: sfpW + 12, h: sfpH + 6,
        title: 'Бассейн выдержки отработавшего ядерного топлива (БВ, KKS JCA)',
        sub: 'Расположен слева от шахты реактора между отм. +13.200 и +26.300',
        desc: 'Обеспечивает хранение и съем остаточного тепловыделения выгруженных кассет ТВС-2М под защитным слоем борированной воды.',
        telemetry: () => `Температура воды БВ: 42.5 °C | Концентрация бора: 16.0 г/кг | Охлаждение: JNA В РАБОТЕ`
      });

      // ========================================================================
      // 6. БЕТОННАЯ ШАХТА РЕАКТОРА ПО ЦЕНТРУ, ОПОРНАЯ ФЕРМА И КОРПУС ВВЭР-1200
      // ========================================================================
      const shaftX = domeCX - 66, shaftY = elev263Y + 8, shaftW = 132, shaftH = groundY - shaftY;
      ctx.save();
      // Стены шахты реактора (биологическая защита)
      ctx.fillStyle = PAL.bgInner;
      ctx.strokeStyle = PAL.wallSolid;
      ctx.lineWidth = 1.5;
      ctx.fillRect(shaftX, shaftY, 18, shaftH);
      ctx.strokeRect(shaftX, shaftY, 18, shaftH);
      ctx.fillRect(shaftX + shaftW - 18, shaftY, 18, shaftH);
      ctx.strokeRect(shaftX + shaftW - 18, shaftY, 18, shaftH);

      // Опорная ферма корпуса реактора в средней части шахты
      const trussY = 442;
      ctx.fillStyle = PAL.wallSolid;
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(shaftX + 12, trussY, 20, 14);
      ctx.strokeRect(shaftX + 12, trussY, 20, 14);
      ctx.fillRect(shaftX + shaftW - 32, trussY, 20, 14);
      ctx.strokeRect(shaftX + shaftW - 32, trussY, 20, 14);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('ОПОРНАЯ ФЕРМА', shaftX - 4, trussY + 10);
      ctx.restore();

      // 6.1 Под днищем корпуса: конус Устройства локализации расплава (УЛР / Кориум-кетчер, #00E5FF)
      const ulrX = domeCX - 42, ulrY = 592, ulrW = 84, ulrH = 72;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ulrX, ulrY);
      ctx.lineTo(ulrX + ulrW, ulrY);
      ctx.lineTo(ulrX + ulrW - 18, ulrY + ulrH);
      ctx.lineTo(ulrX + 18, ulrY + ulrH);
      ctx.closePath();
      ctx.fillStyle = sim.ulrCoolingActive ? 'rgba(0, 229, 255, 0.18)' : PAL.bgInner;
      ctx.fill();
      ctx.strokeStyle = PAL.safety;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ферма-ловушка и кассеты жертвенного материала внутри конуса УЛР
      for (let bx = ulrX + 20; bx <= ulrX + ulrW - 26; bx += 12) {
        ctx.fillStyle = PAL.reactorCore;
        ctx.fillRect(bx, ulrY + 24, 7, 34);
      }

      // Рубашка водяного охлаждения УЛР
      ctx.strokeStyle = PAL.safety;
      ctx.lineWidth = 1;
      for (let zy = ulrY + 10; zy < ulrY + ulrH - 6; zy += 10) {
        ctx.beginPath();
        ctx.moveTo(ulrX + 12, zy);
        ctx.lineTo(ulrX + ulrW - 12, zy);
        ctx.stroke();
      }

      ctx.fillStyle = PAL.safety;
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('УЛР / КОРИУМ-КЕТЧЕР (JMU)', domeCX, ulrY + ulrH - 4);
      ctx.restore();

      activeHotspots.push({
        x: ulrX, y: ulrY, w: ulrW, h: ulrH,
        title: 'Устройство локализации расплава (УЛР / Кориум-кетчер, KKS JMU)',
        sub: 'Под днищем корпуса реактора на отм. 0.000 • Жертвенный материал Fe₂O₃/Al₂O₃',
        desc: 'Конический сосуд в нижней части шахты реактора для приема, удержания и пассивного расхолаживания кориума при тяжелой запроектной аварии.',
        telemetry: () => `Охлаждение УЛР: ${sim.ulrCoolingActive ? 'ПОДАЧА ВОДЫ ВКЛ' : 'СУХАЯ ШАХТА (НОРМА)'}`
      });

      // 6.2 Корпус реактора ВВЭР-1200 (В-491) с верхним блоком ШЭМ-3 и патрубками Ду-850
      const rxX = domeCX - 44, rxY = 382, rxW = 88, rxH = 198;
      ctx.save();
      // Верхний блок и чехлы приводов ШЭМ-3 над перекрытием +26.300
      for (let sx = rxX + 16; sx <= rxX + rxW - 16; sx += 11) {
        ctx.strokeStyle = sim.az1Tripped ? PAL.statusAlarm : PAL.wallStroke;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, rxY + 20);
        ctx.lineTo(sx, rxY - 56);
        ctx.stroke();
      }
      // Опорная плита верхнего блока БЗТ
      ctx.fillStyle = PAL.bgInner;
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(rxX + 8, rxY - 26, rxW - 16, 16);
      ctx.strokeRect(rxX + 8, rxY - 26, rxW - 16, 16);

      // Сферическая крышка и главный разъем корпуса ВВЭР-1200
      ctx.beginPath();
      ctx.arc(domeCX, rxY + 26, rxW / 2, Math.PI, 0, false);
      ctx.fillStyle = PAL.bgInner;
      ctx.fill();
      ctx.strokeStyle = PAL.hotLeg;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Цилиндрический корпус с эллиптическим днищем
      ctx.beginPath();
      ctx.moveTo(rxX, rxY + 26);
      ctx.lineTo(rxX, rxY + rxH - 28);
      ctx.arc(domeCX, rxY + rxH - 28, rxW / 2, Math.PI, 0, true);
      ctx.lineTo(rxX + rxW, rxY + 26);
      ctx.closePath();
      ctx.fillStyle = PAL.bgInner;
      ctx.fill();
      ctx.strokeStyle = PAL.hotLeg;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Фланец главного разъема
      ctx.fillStyle = PAL.wallSolid;
      ctx.strokeStyle = PAL.hotLeg;
      ctx.lineWidth = 1.2;
      ctx.fillRect(rxX - 5, rxY + 22, rxW + 10, 7);
      ctx.strokeRect(rxX - 5, rxY + 22, rxW + 10, 7);

      // Внутрикорпусная шахта и активная зона 163 ТВС-2М (#E65100 / #FF5722)
      const coreX = rxX + 14, coreY = rxY + 72, coreW = rxW - 28, coreH = 82;
      const fluxRatio = Math.min(1.0, Math.max(0.15, sim.thermalPowerMW / 3200));
      ctx.fillStyle = `rgba(230, 81, 0, ${0.35 + fluxRatio * 0.45})`;
      ctx.fillRect(coreX, coreY, coreW, coreH);
      ctx.strokeStyle = PAL.hotLeg;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(coreX, coreY, coreW, coreH);

      // Вертикальные кассеты ТВС-2М и стержни СУЗ
      for (let tx = coreX + 8; tx < coreX + coreW - 4; tx += 11) {
        const isGr10 = (tx === coreX + 30);
        const posPct = isGr10 ? sim.group10Pos : sim.groups1to9Pos;
        const tipY = coreY + ((100 - posPct) / 100) * coreH;
        ctx.strokeStyle = sim.az1Tripped ? PAL.statusAlarm : (isGr10 ? PAL.safety : PAL.statusOk);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, rxY - 10);
        ctx.lineTo(tx, tipY);
        ctx.stroke();
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ВВЭР-1200', domeCX, rxY + 46);
      ctx.fillStyle = PAL.hotLeg;
      ctx.fillText(Math.round(sim.thermalPowerMW) + ' МВт', domeCX, rxY + 58);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.fillText('163 ТВС-2М', domeCX, coreY + coreH + 14);
      ctx.restore();

      activeHotspots.push({
        x: rxX - 8, y: rxY - 56, w: rxW + 16, h: rxH + 60,
        title: 'Корпус реактора ВВЭР-1200 с верхним блоком ШЭМ-3 (KKS JEA)',
        sub: 'Центральная шахта 10UJA • 16.20 МПа • 3200 МВт • Патрубки Ду-850',
        desc: 'Установлен на опорной ферме в центральной бетонной шахте. Содержит 163 ТВС-2М и 121 привод СУЗ.',
        telemetry: () => `Nтепл: ${sim.thermalPowerMW.toFixed(1)} МВт | P₁: ${p1.toFixed(2)} МПа | Твых: ${sim.coreOutletTempC.toFixed(1)} °C | Твх: ${sim.coreInletTempC.toFixed(1)} °C`
      });

      // ========================================================================
      // 7. ПО БОКАМ: БЕТОННЫЕ БОКСЫ ПАРОГЕНЕРАТОРОВ ПГВ-1000МКП, ГЦНА И КД-79
      // ========================================================================
      const boxY = elev263Y + 8, boxH = elev132Y - boxY;
      // Контуры защитных бетонных боксов ПГ/ГЦНА слева и справа от шахты
      ctx.save();
      ctx.strokeStyle = PAL.wallStroke;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(domeCX - innerR + 12, boxY, 198, boxH);
      ctx.strokeRect(domeCX + 66, boxY, 198, boxH);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('БОКС ПГ/ГЦНА ПЕТЕЛЬ 1-2', domeCX - innerR + 18, boxY + 13);
      ctx.textAlign = 'right';
      ctx.fillText('БОКС ПГ/ГЦНА ПЕТЕЛЬ 3-4', domeCX + innerR - 18, boxY + 13);
      ctx.restore();

      // 7.1 Парогенераторы ПГВ-1000МКП в боковых боксах
      [
        { x: domeCX - 252, y: 404, name: 'ПГВ-1000МКП (П1,2)', loopIdx: 0 },
        { x: domeCX + 144, y: 404, name: 'ПГВ-1000МКП (П3,4)', loopIdx: 2 }
      ].forEach((sg) => {
        const sgW = 108, sgH = 58;
        const lp = sim.loops[sg.loopIdx] || { sgLevelM: 2.10, sgPressMPa: 7.00 };
        ctx.save();
        roundRect(ctx, sg.x, sg.y, sgW, sgH, 12);
        ctx.fillStyle = PAL.bgInner;
        ctx.fill();
        ctx.strokeStyle = PAL.wallStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Уровень питательной воды (#00ACC1)
        const sgLvl = (lp.sgLevelM / 2.7) * (sgH - 14);
        ctx.fillStyle = 'rgba(0, 172, 193, 0.25)';
        roundRect(ctx, sg.x + 3, sg.y + sgH - 3 - sgLvl, sgW - 6, sgLvl, 8);
        ctx.fill();

        // Горячий (#FF5722) и холодный (#FB8C00) коллекторы 1-го контура
        const hotColX = sg.x < domeCX ? sg.x + sgW - 22 : sg.x + 12;
        const coldColX = sg.x < domeCX ? sg.x + 12 : sg.x + sgW - 22;
        ctx.fillStyle = PAL.hotLeg;
        ctx.fillRect(hotColX, sg.y + 10, 10, sgH - 20);
        ctx.fillStyle = PAL.coldLeg;
        ctx.fillRect(coldColX, sg.y + 10, 10, sgH - 20);

        // Паровой коллектор сверху ПГ (#FFB300) и выход пара к гермопроходкам
        ctx.strokeStyle = PAL.steam;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sg.x + sgW / 2, sg.y);
        ctx.lineTo(sg.x + sgW / 2, sg.y - 22);
        ctx.lineTo(sg.x < domeCX ? domeCX - innerR + 4 : domeCX + innerR - 4, sg.y - 22);
        ctx.stroke();

        // Подвод питательной воды (#00ACC1)
        ctx.strokeStyle = PAL.feedwater;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sg.x < domeCX ? domeCX - innerR + 4 : domeCX + innerR - 4, sg.y + 24);
        ctx.lineTo(sg.x < domeCX ? sg.x : sg.x + sgW, sg.y + 24);
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sg.name, sg.x + sgW / 2, sg.y - 5);
        ctx.fillStyle = PAL.steam;
        ctx.fillText('P₂: ' + lp.sgPressMPa.toFixed(2) + ' МПа', sg.x + sgW / 2, sg.y + 24);
        ctx.fillStyle = PAL.feedwater;
        ctx.fillText('H: ' + lp.sgLevelM.toFixed(2) + ' м', sg.x + sgW / 2, sg.y + 38);
        ctx.restore();

        activeHotspots.push({
          x: sg.x, y: sg.y - 12, w: sgW, h: sgH + 16,
          title: 'Бокс парогенератора ' + sg.name + ' (KKS JEB)',
          sub: 'Пар 7.0 МПа (285.8 °C) • Питательная вода 225 °C',
          desc: 'Горизонтальный парогенератор в защитном бетонном боксе гермозоны. Отводит тепло от петель ГЦК во 2-й контур.',
          telemetry: () => `Давление пара P₂: ${lp.sgPressMPa.toFixed(2)} МПа | Уровень: ${lp.sgLevelM.toFixed(2)} м`
        });
      });

      // 7.2 Главные циркуляционные насосы ГЦНА-1391 на отм. +13.200
      [
        { x: domeCX - 196, y: 500, name: 'ГЦНА-1,2', loopIdx: 0 },
        { x: domeCX + 196, y: 500, name: 'ГЦНА-3,4', loopIdx: 2 }
      ].forEach((p) => {
        const pr = 17;
        const lp = sim.loops[p.loopIdx] || { rpm: 1000, pumpOn: true, flowPct: 100 };
        const pumpRunning = Boolean(lp.pumpOn);
        const pumpRpm = (typeof lp.rpm === 'number' ? lp.rpm : 1000);
        const statusCol = pumpRunning ? PAL.statusOk : PAL.statusOff;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = PAL.bgInner;
        ctx.fill();
        ctx.strokeStyle = statusCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Выносной электродвигатель ГЦНА сверху
        ctx.fillStyle = PAL.bgDeep;
        ctx.strokeStyle = PAL.wallStroke;
        ctx.lineWidth = 1.2;
        ctx.fillRect(p.x - 9, p.y - pr - 14, 18, 14);
        ctx.strokeRect(p.x - 9, p.y - pr - 14, 18, 14);

        // Вращающееся рабочее колесо
        const spinAng = sim.time * (pumpRpm / 1000) * 8.0;
        ctx.strokeStyle = statusCol;
        ctx.lineWidth = 1.5;
        for (let b = 0; b < 4; b++) {
          const a = spinAng + b * (Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(a) * (pr - 4), p.y + Math.sin(a) * (pr - 4));
          ctx.stroke();
        }

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y + pr + 11);
        ctx.fillStyle = statusCol;
        ctx.fillText(Math.round(pumpRpm) + ' об/м', p.x, p.y + pr + 21);
        ctx.restore();

        activeHotspots.push({
          x: p.x - pr - 4, y: p.y - pr - 16, w: pr * 2 + 8, h: pr * 2 + 42,
          title: 'Главный циркуляционный насосный агрегат (' + p.name + ', KKS JEC)',
          sub: 'Площадка обслуживания +13.200 • Подача 22 000 м³/ч',
          desc: 'Прокачивает теплоноситель холодной нитки (298.2 °C) из парогенератора обратно во входной патрубок Ду-850 реактора.',
          telemetry: () => `Статус: ${pumpRunning ? 'РАБОТА' : 'ОСТАНОВ'} | Обороты: ${Math.round(pumpRpm)} об/мин | Расход: ${lp.flowPct.toFixed(1)}%`
        });
      });

      // 7.3 Компенсатор давления КД-79 (JEP10) в правом боксе
      const kdX = domeCX + 82, kdY = 382, kdW = 34, kdH = 104;
      ctx.save();
      roundRect(ctx, kdX, kdY, kdW, kdH, 10);
      ctx.fillStyle = PAL.bgInner;
      ctx.fill();
      ctx.strokeStyle = PAL.hotLeg;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const kdWaterH = (przLvl / 12.0) * (kdH - 14);
      ctx.fillStyle = 'rgba(255, 87, 34, 0.28)';
      roundRect(ctx, kdX + 3, kdY + kdH - 3 - kdWaterH, kdW - 6, kdWaterH, 6);
      ctx.fill();

      // Блок ТЭНов КД
      ctx.fillStyle = heatersOn ? PAL.statusOk : PAL.statusOff;
      for (let hx = kdX + 6; hx <= kdX + kdW - 9; hx += 7) {
        ctx.fillRect(hx, kdY + kdH - 16, 4, 12);
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('КД 79м³', kdX + kdW / 2, kdY - 5);
      ctx.fillStyle = PAL.hotLeg;
      ctx.fillText(p1.toFixed(1) + 'МПа', kdX + kdW / 2, kdY + 20);
      ctx.restore();

      activeHotspots.push({
        x: kdX, y: kdY - 10, w: kdW, h: kdH + 16,
        title: 'Компенсатор давления 1-го контура (КД-79, KKS JEP10)',
        sub: 'Объем 79 м³ • Номинальное давление 16.20 МПа',
        desc: 'Поддерживает давление в 1-м контуре за счет паровой подушки и электронагревателей мощностью 2520 кВт.',
        telemetry: () => `P₁: ${p1.toFixed(2)} МПа | Уровень: ${przLvl.toFixed(2)} м | ТЭНы: ${heatersOn ? 'ВКЛ' : 'ОТКЛ'}`
      });

      // 7.4 Патрубки и трубопроводы ГЦК Ду-850: горячая нитка (#FF5722) и холодная нитка (#FB8C00)
      const hotLeft = [[domeCX - 44, 418], [domeCX - 154, 418]];
      const hotRight = [[domeCX + 44, 418], [domeCX + 154, 418]];
      ctx.strokeStyle = PAL.hotLeg;
      ctx.lineWidth = 2.6;
      [hotLeft, hotRight].forEach((pts) => {
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        ctx.stroke();
      });
      drawFlowArrow(domeCX - 95, 418, Math.PI, PAL.hotLeg, 5);
      drawFlowArrow(domeCX + 95, 418, 0, PAL.hotLeg, 5);

      // Дыхательный трубопровод КД
      ctx.beginPath();
      ctx.moveTo(kdX + kdW / 2, kdY + kdH);
      ctx.lineTo(kdX + kdW / 2, 496);
      ctx.lineTo(domeCX + 132, 496);
      ctx.lineTo(domeCX + 132, 418);
      ctx.stroke();

      // Холодные нитки Ду-850 (#FB8C00)
      const coldLeft = [
        [domeCX - 236, 462], [domeCX - 236, 500], [domeCX - 213, 500],
        [domeCX - 179, 500], [domeCX - 76, 500], [domeCX - 76, 438], [domeCX - 44, 438]
      ];
      const coldRight = [
        [domeCX + 236, 462], [domeCX + 236, 500], [domeCX + 213, 500],
        [domeCX + 179, 500], [domeCX + 122, 500], [domeCX + 122, 438], [domeCX + 44, 438]
      ];
      ctx.strokeStyle = PAL.coldLeg;
      ctx.lineWidth = 2.6;
      [coldLeft, coldRight].forEach((pts) => {
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
        ctx.stroke();
      });
      drawFlowArrow(domeCX - 125, 500, 0, PAL.coldLeg, 5);
      drawFlowArrow(domeCX + 145, 500, Math.PI, PAL.coldLeg, 5);

      // Бегущие частицы в петлях ГЦК
      drawParticlesOnPath(hotLeft, 3, 3.0, PAL.hotLeg, 2.2);
      drawParticlesOnPath(hotRight, 3, 3.0, PAL.hotLeg, 2.2);
      drawParticlesOnPath(coldLeft, 5, 3.0, PAL.coldLeg, 2.2);
      drawParticlesOnPath(coldRight, 5, 3.0, PAL.coldLeg, 2.2);

      // 7.5 Бак-приямок аварийного запаса борированной воды (JNK) на нижней отметке
      [
        { x: domeCX - 250, y: 562, w: 165, h: 88, name: 'БАК-ПРИЯМОК ГЕРМООБОЛОЧКИ (JNK10..20)' },
        { x: domeCX + 85, y: 562, w: 165, h: 88, name: 'БАК-ПРИЯМОК ГЕРМООБОЛОЧКИ (JNK30..40)' }
      ].forEach((sump) => {
        ctx.save();
        ctx.fillStyle = PAL.bgInner;
        ctx.strokeStyle = PAL.wallSolid;
        ctx.lineWidth = 1.5;
        ctx.fillRect(sump.x, sump.y, sump.w, sump.h);
        ctx.strokeRect(sump.x, sump.y, sump.w, sump.h);

        ctx.fillStyle = 'rgba(0, 229, 255, 0.16)';
        ctx.fillRect(sump.x + 3, sump.y + 24, sump.w - 6, sump.h - 27);
        ctx.strokeStyle = PAL.safety;
        ctx.lineWidth = 1;
        ctx.strokeRect(sump.x + 3, sump.y + 24, sump.w - 6, sump.h - 27);

        ctx.fillStyle = PAL.safety;
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sump.name, sump.x + sump.w / 2, sump.y + 15);
        ctx.fillStyle = '#0F172A';
        ctx.fillText('Запас раствора H₃BO₃ 16 г/кг (Рециркуляция САОЗ)', sump.x + sump.w / 2, sump.y + 56);
        ctx.restore();
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
window.renderPanoramic = renderPanoramicSystemsView;
window.renderCrossSectionView = renderCrossSectionView;
