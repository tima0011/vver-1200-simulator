// ============================================================================
// core_cartogram.js — ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-491)
// Точная картограмма активной зоны (163 ТВС-2М) и групп ОР СУЗ (Bank 1–12)
// Эталонная схема: Figure 2 — VVER-1200 Reactor core with control rod banks
// ============================================================================

// 1. ЭТАЛОННАЯ БАЗА ПРИНАДЛЕЖНОСТИ 163 ТВС-2М К ГРУППАМ ОР СУЗ (BANK 1..12)
// Нумерация строго от 1 до 163 по горизонтальным рядам снизу вверх (слева направо):
// Ряд 1 (нижний, r = +7): ТВС 1..6
// Ряд 8 (центральный, r = 0): ТВС 76..88 (ТВС 82 — центр активной зоны)
// Ряд 15 (верхний, r = -7): ТВС 158..163
// null — белые ячейки (ТВС без приводов ОР СУЗ, 42 шт.); 1..12 — группы ОР СУЗ (121 шт.)
const EXACT_FA_BANK_MAP = {
  // Ряд 1 (r = +7): 1..6
  1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
  // Ряд 2 (r = +6): 7..15
  7: null, 8: null, 9: 2, 10: 9, 11: 5, 12: 10, 13: 1, 14: null, 15: null,
  // Ряд 3 (r = +5): 16..25
  16: null, 17: 1, 18: 11, 19: 4, 20: 1, 21: 3, 22: 8, 23: 11, 24: 2, 25: null,
  // Ряд 4 (r = +4): 26..36
  26: null, 27: 10, 28: 8, 29: 6, 30: 7, 31: 12, 32: 7, 33: 6, 34: 4, 35: 9, 36: null,
  // Ряд 5 (r = +3): 37..48
  37: null, 38: 5, 39: 3, 40: 7, 41: 2, 42: 5, 43: 4, 44: 2, 45: 7, 46: 1, 47: 5, 48: null,
  // Ряд 6 (r = +2): 49..61
  49: null, 50: 9, 51: 1, 52: 12, 53: 4, 54: 10, 55: 8, 56: 9, 57: 5, 58: 12, 59: 3, 60: 10, 61: null,
  // Ряд 7 (r = +1): 62..75
  62: null, 63: 2, 64: 4, 65: 7, 66: 5, 67: 8, 68: 3, 69: 3, 70: 8, 71: 4, 72: 7, 73: 8, 74: 1, 75: null,
  // Ряд 8 (r = 0, ось симметрии I-III): 76..88
  76: null, 77: 11, 78: 6, 79: 2, 80: 9, 81: 3, 82: 11, 83: 3, 84: 10, 85: 2, 86: 6, 87: 11, 88: null,
  // Ряд 9 (r = -1): 89..102
  89: null, 90: 1, 91: 8, 92: 7, 93: 4, 94:8, 95: 3, 96: 3, 97: 8, 98: 5, 99: 7, 100: 4, 101: 2, 102: null,
  // Ряд 10 (r = -2): 103..115
  103: null, 104: 10, 105: 3, 106: 12, 107: 5, 108: 10, 109: 8, 110: 9, 111: 4, 112: 12, 113: 1, 114: 9, 115: null,
  // Ряд 11 (r = -3): 116..127
  116: null, 117: 5, 118: 1, 119: 7, 120: 2, 121: 4, 122: 5, 123: 2, 124: 7, 125: 3, 126: 5, 127: null,
  // Ряд 12 (r = -4): 128..138
  128: null, 129: 9, 130: 4, 131: 6, 132: 7, 133: 12, 134: 7, 135: 6, 136: 8, 137: 10, 138: null,
  // Ряд 13 (r = -5): 139..148
  139: null, 140: 2, 141: 11, 142: 8, 143: 3, 144: 1, 145: 4, 146: 11, 147: 1, 148: null,
  // Ряд 14 (r = -6): 149..157
  149: null, 150: null, 151: 1, 152: 10, 153: 5, 154: 9, 155: 2, 156: null, 157: null,
  // Ряд 15 (r = -7): 158..163
  158: null, 159: null, 160: null, 161: null, 162: null, 163: null
};

// Цветовая палитра групп ОР СУЗ 1..12 (Стандарт Slate Light SCADA — высокий контраст)
const BANK_PALETTE = {
  0:  { fill: '#F1F5F9', text: '#0F172A', stroke: '#CBD5E1', name: 'Без ПС СУЗ' },
  1:  { fill: '#BAE6FD', text: '#0F172A', stroke: '#0284C7', name: 'Группа 1 (АЗ / КГ)' },
  2:  { fill: '#E2E8F0', text: '#0F172A', stroke: '#64748B', name: 'Группа 2 (АЗ / КГ)' },
  3:  { fill: '#FED7AA', text: '#0F172A', stroke: '#EA580C', name: 'Группа 3 (АЗ / КГ)' },
  4:  { fill: '#99F6E4', text: '#0F172A', stroke: '#0D9488', name: 'Группа 4 (АЗ / КГ)' },
  5:  { fill: '#FEF08A', text: '#0F172A', stroke: '#CA8A04', name: 'Группа 5 (АЗ / КГ)' },
  6:  { fill: '#FDBA74', text: '#0F172A', stroke: '#C2410C', name: 'Группа 6 (АЗ / КГ)' },
  7:  { fill: '#C7D2FE', text: '#0F172A', stroke: '#4F46E5', name: 'Группа 7 (АЗ / КГ)' },
  8:  { fill: '#A7F3D0', text: '#0F172A', stroke: '#059669', name: 'Группа 8 (АЗ / КГ)' },
  9:  { fill: '#3B82F6', text: '#FFFFFF', stroke: '#1D4ED8', name: 'Группа 9 (АЗ / КГ)' },
  10: { fill: '#E11D48', text: '#FFFFFF', stroke: '#9F1239', name: 'Группа 10 (Рабочая АРМ)' },
  11: { fill: '#10B981', text: '#FFFFFF', stroke: '#047857', name: 'Группа 11 (АЗ / РГ)' },
  12: { fill: '#7C3AED', text: '#FFFFFF', stroke: '#5B21B6', name: 'Группа 12 (АЗ / РГ)' }
};

// Геометрические константы картограммы (базовый холст 1160 x 720)
const CORE_GRID_LAYOUT = {
  centerX: 392,
  centerY: 382,
  hexR: 20.2
};

// Текущий слой отображения картограммы:
// 'banks'     — [Группы СУЗ 1-12] (активен по умолчанию)
// 'kq'        — [Тепловая карта Kq]
// 'insertion' — [Погружение стержней]
var coreLayerMode = 'banks';
if (typeof window !== 'undefined') {
  window.coreLayerMode = coreLayerMode;
}

// Массив 163 ТВС-2М
var coreAssemblies = [];

function initCoreCartogram() {
  coreAssemblies.length = 0;

  // Перебор рядов строго снизу вверх (r от +7 до -7) и слева направо (q от -7 до +7)
  // Условие гексагональной решетки ВВЭР-1200: q^2 + r^2 + q*r <= 43 -> ровно 163 ячейки
  let faId = 1;
  let rowNumber = 1;

  for (let r = 7; r >= -7; r--) {
    const rowQ = [];
    for (let q = -7; q <= 7; q++) {
      if (q * q + r * r + q * r <= 43) {
        rowQ.push(q);
      }
    }

    for (let colIdx = 0; colIdx < rowQ.length; colIdx++) {
      const q = rowQ[colIdx];
      const id = faId++;
      const dist = Math.sqrt(q * q + r * r + q * r);
      const bank = Object.prototype.hasOwnProperty.call(EXACT_FA_BANK_MAP, id)
        ? EXACT_FA_BANK_MAP[id]
        : null;
      const hasRod = bank !== null;
      const rodGroup = bank !== null ? bank : 0;

      // Профилирование обогащения и базового коэффициента неравномерности Kq
      let enrichment = 4.40;
      let burnup = '1-й год (Свежая)';
      let gadoliniumPins = 6;
      if (dist < 2.6) {
        enrichment = 3.60;
        burnup = '3-й год (28.4 МВт·сут/кг)';
        gadoliniumPins = 0;
      } else if (dist < 5.1) {
        enrichment = 4.20;
        burnup = '2-й год (16.2 МВт·сут/кг)';
        gadoliniumPins = 6;
      } else {
        enrichment = 4.95;
        burnup = '1-й год (Свежая + Gd₂O₃)';
        gadoliniumPins = 12;
      }

      // Базовый профиль энерговыделения Kq (в центре и среднем кольце 1.08..1.29, на периферии 0.72..0.92)
      const radialShape = dist > 5.8
        ? 0.74 + (6.6 - dist) * 0.16
        : 1.24 - 0.032 * dist + 0.045 * Math.cos(dist * 0.95);
      const deterministicMod = ((id * 17 + rowNumber * 7) % 11 - 5) * 0.006;
      const baseKq = Math.max(0.68, Math.min(1.31, radialShape + deterministicMod));

      const colInRow = colIdx + 1;
      const rowStr = String(rowNumber).padStart(2, '0');
      const colStr = String(colInRow).padStart(2, '0');

      coreAssemblies.push({
        id: id,
        q: q,
        r: r,
        dist: dist,
        rowNumber: rowNumber,
        colInRow: colInRow,
        coordLabel: `${rowStr}-${colStr} (q=${q >= 0 ? '+' + q : q}, r=${r >= 0 ? '+' + r : r})`,
        bank: bank,
        hasRod: hasRod,
        rodGroup: rodGroup,
        enrichment: enrichment,
        burnup: burnup,
        gadoliniumPins: gadoliniumPins,
        baseKq: baseKq,
        currentKq: baseKq,
        powerMW: 19.63 * baseKq,
        outletTemp: 298.2 + 30.7 * baseKq,
        deltaT: 30.7 * baseKq,
        dnbr: 2.15,
        cladTempC: 342.0,
        insertionPct: 0.0,
        insertionCm: 0.0
      });
    }
    rowNumber++;
  }

  // По умолчанию выбираем центральную ТВС №82 (q=0, r=0, Bank 11)
  if (typeof sim !== 'undefined' && (!sim.selectedAssemblyId || sim.selectedAssemblyId < 1 || sim.selectedAssemblyId > 163)) {
    sim.selectedAssemblyId = 82;
  }
}

initCoreCartogram();

// ============================================================================
// 2. РАСЧЕТ ТЕЛЕМЕТРИИ ТВС И ЦВЕТОВЫХ СЛОЕВ
// ============================================================================

// Физическое погружение стержня СУЗ для конкретной ТВС (0% = полностью извлечен на ВВЭР БЩУ? Внимание:
// В физическом ядре sim.group10Pos = 80% означает высоту от низа активной зоны (80% извлечено, 20% погружено).
// Возвращает { heightPct: 0..100 (от низа), depthPct: 0..100 (погружение сверху), depthCm: 0..373 })
function getAssemblyRodState(assembly, simState) {
  const s = simState || (typeof window !== 'undefined' ? window.sim : null);
  const coreHeightCm = (typeof NUCLEAR_CONSTANTS !== 'undefined' && NUCLEAR_CONSTANTS.CORE_HEIGHT_M)
    ? NUCLEAR_CONSTANTS.CORE_HEIGHT_M * 100.0
    : 373.0;

  if (!assembly || !assembly.bank) {
    return {
      hasRod: false,
      bank: null,
      heightPct: 100.0,
      depthPct: 0.0,
      depthCm: 0.0,
      heightCm: coreHeightCm
    };
  }

  let heightPct = 100.0;
  if (s) {
    if (s.az1Tripped) {
      heightPct = 0.0;
    } else if (assembly.bank === 10) {
      heightPct = typeof s.group10Pos === 'number' ? s.group10Pos : 80.0;
    } else if (assembly.bank >= 1 && assembly.bank <= 9) {
      heightPct = typeof s.groups1to9Pos === 'number' ? s.groups1to9Pos : 100.0;
    } else {
      // Группы 11 и 12 на мощности находятся на верхнем концевике (100% от низа = 0% погружения),
      // при срабатывании АЗ-1 или глубоком вводе — синхронно с группами 1-9
      heightPct = typeof s.groups1to9Pos === 'number' ? s.groups1to9Pos : 100.0;
    }
  }

  heightPct = Math.max(0.0, Math.min(100.0, heightPct));
  const depthPct = 100.0 - heightPct; // Погружение стержня сверху в активную зону (0..100%)
  const depthCm = (depthPct / 100.0) * coreHeightCm;
  const heightCm = (heightPct / 100.0) * coreHeightCm;

  return {
    hasRod: true,
    bank: assembly.bank,
    heightPct: heightPct,
    depthPct: depthPct,
    depthCm: depthCm,
    heightCm: heightCm
  };
}

// Обновление полной телеметрии ТВС от физического ядра window.sim
function updateAssemblyTelemetry(assembly, simState) {
  const s = simState || (typeof window !== 'undefined' ? window.sim : null);
  const inletT = s && typeof s.coreInletTempC === 'number' ? s.coreInletTempC : 298.2;
  const outletT = s && typeof s.coreOutletTempC === 'number' ? s.coreOutletTempC : 328.9;
  const thermalMW = s && typeof s.thermalPowerMW === 'number' ? s.thermalPowerMW : 3200.0;
  const p1 = s && typeof s.primaryPressureMPa === 'number' ? s.primaryPressureMPa : 16.20;

  let avgFlowPct = 100.0;
  if (s && Array.isArray(s.loops) && s.loops.length > 0) {
    avgFlowPct = s.loops.reduce((acc, lp) => acc + (lp.flowPct || 0), 0) / s.loops.length;
  }
  const flowFrac = Math.max(0.08, avgFlowPct / 100.0);

  const rodState = getAssemblyRodState(assembly, s);
  assembly.insertionPct = rodState.depthPct;
  assembly.insertionCm = rodState.depthCm;

  const kq = typeof assembly.currentKq === 'number' ? assembly.currentKq : assembly.baseKq;
  const coreAvgDeltaT = Math.max(0.2, outletT - inletT);
  const deltaT = coreAvgDeltaT * kq;
  const faOutletT = Math.min(370.0, inletT + deltaT);
  const faPowerMW = (thermalMW / 163.0) * kq;

  // Температура оболочки твэла (сплав Э110, наружная стенка): T_вх + ΔT + пленочный перепад ΔT_пл
  const powerFrac = Math.max(0.01, thermalMW / 3200.0);
  const filmDropC = (14.8 * powerFrac * kq) / Math.pow(flowFrac, 0.65);
  const cladTempC = Math.min(650.0, faOutletT + filmDropC);

  // Запас до кризиса теплообмена (DNBR, в номинале ~1.85..2.45, предел безопасности > 1.30)
  const pressFactor = Math.max(0.65, p1 / 16.20);
  const heatFluxRatio = Math.max(0.12, powerFrac * kq);
  const dnbr = Math.max(0.85, Math.min(4.95, (2.28 * Math.pow(flowFrac, 0.72) * pressFactor) / heatFluxRatio));

  assembly.powerMW = faPowerMW;
  assembly.outletTemp = faOutletT;
  assembly.deltaT = deltaT;
  assembly.cladTempC = cladTempC;
  assembly.dnbr = dnbr;

  return rodState;
}

// Спектральная цветовая карта Kq по новой инженерной температурной шкале (Slate Light SCADA):
// - Низкое Kq (< 0.85): ледяной лазурный #0EA5E9
// - Номинал Kq (0.85 - 1.10): глубокий циан #06B6D4
// - Повышенное Kq (1.10 - 1.25): янтарный #F59E0B
// - Пиковое Kq (> 1.25): сигнальный коралловый #EF4444
// - Локальный перегрев (> 1.35 или Tобол > 350°C): глубокий кармин #DC2626
function getKqLayerStyle(kq, cladTempC = 0) {
  if (kq >= 1.35 || cladTempC > 350.0) {
    return { fill: '#DC2626', text: '#FFFFFF', stroke: '#991B1B' }; // Локальный перегрев (#DC2626)
  } else if (kq > 1.25) {
    return { fill: '#EF4444', text: '#FFFFFF', stroke: '#B91C1C' }; // Пиковое Kq (> 1.25, #EF4444)
  } else if (kq >= 1.10) {
    return { fill: '#F59E0B', text: '#0F172A', stroke: '#B45309' }; // Повышенное Kq (1.10 - 1.25, #F59E0B)
  } else if (kq >= 0.85) {
    return { fill: '#06B6D4', text: '#0F172A', stroke: '#0E7490' }; // Номинал Kq (0.85 - 1.10, #06B6D4)
  }
  return { fill: '#0EA5E9', text: '#FFFFFF', stroke: '#0369A1' };   // Низкое Kq (< 0.85, #0EA5E9)
}

// Цветовая карта физического погружения стержней СУЗ (0..100%, стандарт Slate Light SCADA)
function getInsertionLayerStyle(assembly, rodState) {
  if (!assembly.bank) {
    return { fill: '#F1F5F9', text: '#64748B', stroke: '#CBD5E1' };
  }
  const depth = rodState.depthPct; // 0..100% погружения сверху
  if (assembly.bank === 10) {
    // Особый акцент на рабочей группе №10 (АРМ)
    if (depth > 60) {
      return { fill: '#DC2626', text: '#FFFFFF', stroke: '#991B1B' };
    } else if (depth > 5) {
      return { fill: '#E11D48', text: '#FFFFFF', stroke: '#9F1239' };
    }
    return { fill: '#FDA4AF', text: '#0F172A', stroke: '#E11D48' };
  }
  // Группы 1..9, 11, 12
  if (depth >= 85) {
    return { fill: '#EF4444', text: '#FFFFFF', stroke: '#B91C1C' }; // Полное погружение (АЗ-1)
  } else if (depth >= 25) {
    return { fill: '#F59E0B', text: '#0F172A', stroke: '#B45309' }; // Частичное погружение
  }
  return { fill: '#0EA5E9', text: '#FFFFFF', stroke: '#0284C7' };   // На верхнем концевике (0% погружения)
}

// HiDPI / Retina фикс для холста картограммы активной зоны
function resizeCoreCanvas(targetCanvas, targetCtx) {
  const cnv = targetCanvas || (typeof window !== 'undefined' ? window.simCanvas : null);
  const context = targetCtx || (typeof window !== 'undefined' ? window.ctx : null);
  if (!cnv || !context || typeof cnv.getBoundingClientRect !== 'function') return;
  const container = (typeof window !== 'undefined' && window.canvasContainer) ? window.canvasContainer : cnv;
  const rect = container.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  cnv.width = Math.round(rect.width * dpr);
  cnv.height = Math.round(rect.height * dpr);
  cnv.style.width = rect.width + 'px';
  cnv.style.height = rect.height + 'px';
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ============================================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ГЕОМЕТРИИ И ХИТ-ТЕСТИНГА
// ============================================================================

function getAssemblyScreenCoords(assembly) {
  const sqrt3 = Math.sqrt(3);
  const hexR = CORE_GRID_LAYOUT.hexR;
  const cx = CORE_GRID_LAYOUT.centerX + hexR * sqrt3 * (assembly.q + assembly.r / 2);
  const cy = CORE_GRID_LAYOUT.centerY + hexR * 1.5 * assembly.r;
  return { x: cx, y: cy, r: hexR };
}

function drawPointyHexPath(ctx, cx, cy, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const vx = cx + radius * Math.cos(angle);
    const vy = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

function hitTestCoreAssembly(wx, wy) {
  const hitRadiusSq = Math.pow(CORE_GRID_LAYOUT.hexR * 0.92, 2);
  for (let i = 0; i < coreAssemblies.length; i++) {
    const a = coreAssemblies[i];
    const pos = getAssemblyScreenCoords(a);
    const dx = wx - pos.x;
    const dy = wy - pos.y;
    if (dx * dx + dy * dy <= hitRadiusSq) {
      return a;
    }
  }
  return null;
}

function selectCoreAssembly(assemblyId) {
  if (typeof sim !== 'undefined') {
    sim.selectedAssemblyId = assemblyId;
  }
}

function setCoreLayerMode(mode) {
  if (mode === 'banks' || mode === 'kq' || mode === 'insertion') {
    coreLayerMode = mode;
    if (typeof window !== 'undefined') {
      window.coreLayerMode = mode;
    }
  }
}

// Синхронизация DOM-контейнера #coreInfoPanel (создается скрытым/доступным в DOM для инспекции и автотестов)
function syncCoreInfoPanelDOM(activeAssembly, rodState) {
  if (typeof document === 'undefined' || !activeAssembly) return;
  let panel = document.getElementById('coreInfoPanel');
  if (!panel) {
    const host = document.getElementById('canvasContainer') || document.body;
    panel = document.createElement('aside');
    panel.id = 'coreInfoPanel';
    panel.className = 'core-info-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'position:absolute;right:12px;top:52px;width:320px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;color:#0F172A;pointer-events:none;opacity:0;z-index:-1;';
    host.appendChild(panel);
  }

  const bankStr = activeAssembly.bank
    ? `Группа №${activeAssembly.bank}${activeAssembly.bank === 10 ? ' (Рабочая АРМ)' : ''}`
    : 'Без привода СУЗ (bank: null)';
  const rodDepthStr = activeAssembly.bank
    ? `${rodState.depthCm.toFixed(1)} см (${rodState.depthPct.toFixed(1)}% погруж. / Н=${rodState.heightPct.toFixed(1)}%)`
    : '0.0 см (ПС СУЗ отсутствует)';

  const kqCol = activeAssembly.currentKq > 1.25 ? '#DC2626' : (activeAssembly.currentKq >= 1.10 ? '#D97706' : '#16A34A');
  const dnbrCol = activeAssembly.dnbr < 1.35 ? '#DC2626' : (activeAssembly.dnbr < 1.65 ? '#D97706' : '#16A34A');
  const cladCol = activeAssembly.cladTempC > 350 ? '#DC2626' : (activeAssembly.cladTempC > 340 ? '#D97706' : '#16A34A');

  panel.dataset.assemblyId = String(activeAssembly.id);
  panel.dataset.bank = activeAssembly.bank !== null ? String(activeAssembly.bank) : 'null';
  panel.innerHTML =
    `<div class="cip-title">ТВС-2М №${activeAssembly.id}</div>` +
    `<div class="cip-row"><span>Координата в решетке:</span><b>Ряд ${activeAssembly.coordLabel}</b></div>` +
    `<div class="cip-row"><span>Группа СУЗ:</span><b>${bankStr}</b></div>` +
    `<div class="cip-row"><span>Положение стержня:</span><b>${rodDepthStr}</b></div>` +
    `<div class="cip-row"><span>Коэффициент Kq:</span><b style="color:${kqCol}">${activeAssembly.currentKq.toFixed(3)}</b></div>` +
    `<div class="cip-row"><span>Тепловая мощность:</span><b>${activeAssembly.powerMW.toFixed(2)} МВт</b></div>` +
    `<div class="cip-row"><span>Перепад температур ΔT:</span><b>+${activeAssembly.deltaT.toFixed(1)} °C (выход ${activeAssembly.outletTemp.toFixed(1)} °C)</b></div>` +
    `<div class="cip-row"><span>Запас до кризиса кипения (DNBR):</span><b style="color:${dnbrCol}">${activeAssembly.dnbr.toFixed(2)}</b></div>` +
    `<div class="cip-row"><span>Температура оболочки твэлов:</span><b style="color:${cladCol}">${activeAssembly.cladTempC.toFixed(1)} °C</b></div>`;
}

// ============================================================================
// 4. ГЛАВНАЯ ФУНКЦИЯ ОТРИСОВКИ КАРТОГРАММЫ АКТИВНОЙ ЗОНЫ (1160 x 720)
// ============================================================================

function renderCoreCartogramView() {
  if (typeof ctx === 'undefined' || !ctx) return;
  if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
    activeHotspots.length = 0;
  }

  const s = (typeof sim !== 'undefined') ? sim : (typeof window !== 'undefined' ? window.sim : {});
  const cx = CORE_GRID_LAYOUT.centerX;
  const cy = CORE_GRID_LAYOUT.centerY;
  const hexR = CORE_GRID_LAYOUT.hexR;

  // --------------------------------------------------------------------------
  // 4.1. СВЕТЛАЯ ПОДЛОЖКА КАРТОЧКИ (SLATE LIGHT SCADA: #FFFFFF, БЕЗ ЧЕРНОГО ФОНА)
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 1160, 720);

  // Тонкая инженерная координатная сетка (#64748B с низкой непрозрачностью)
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.10)';
  ctx.lineWidth = 1;
  for (let gx = 40; gx < 780; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 58);
    ctx.lineTo(gx, 656);
    ctx.stroke();
  }
  for (let gy = 60; gy < 656; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(20, gy);
    ctx.lineTo(766, gy);
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // 4.2. ВЕРХНЯЯ ПАНЕЛЬ ЗАГОЛОВКА И ПЕРЕКЛЮЧАТЕЛИ 3 СЛОЕВ ОТОБРАЖЕНИЯ
  // --------------------------------------------------------------------------
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(18, 12, 748, 44, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 12.5px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('КАРТОГРАММА АКТИВНОЙ ЗОНЫ ВВЭР-1200 (163 ТВС-2М)', 30, 31);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.fillText('Figure 2: Reactor core with control rod banks (Bank 1–12 • 121 ПС СУЗ)', 30, 47);

  // 3 кнопки-тумблера слоев картограммы
  const layerButtons = [
    { id: 'banks', label: '[Группы СУЗ 1-12]', x: 382, w: 124 },
    { id: 'kq', label: '[Тепловая карта Kq]', x: 512, w: 124 },
    { id: 'insertion', label: '[Погружение стержней]', x: 642, w: 116 }
  ];

  layerButtons.forEach(btn => {
    const isActive = coreLayerMode === btn.id;
    ctx.fillStyle = isActive ? 'rgba(2, 132, 199, 0.12)' : '#FFFFFF';
    ctx.strokeStyle = isActive ? '#0284C7' : '#CBD5E1';
    ctx.lineWidth = isActive ? 1.5 : 1.0;
    ctx.beginPath();
    ctx.roundRect(btn.x, 19, btn.w, 30, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isActive ? '#0284C7' : '#475569';
    ctx.font = (isActive ? '700 ' : '600 ') + '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, btn.x + btn.w / 2, 38);

    if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
      activeHotspots.push({
        x: btn.x,
        y: 19,
        w: btn.w,
        h: 30,
        title: `Слой картограммы: ${btn.label}`,
        sub: 'Переключатель режима визуализации 163 ТВС-2М',
        desc: 'Нажмите для переключения цветового слоя картограммы активной зоны.',
        simple: 'Позволяет переключаться между схемой групп стержней СУЗ, картой мощности Kq и глубиной погружения стержней.',
        telemetry: () => `Активный слой: ${coreLayerMode.toUpperCase()}`,
        onClick: () => setCoreLayerMode(btn.id)
      });
    }
  });

  // --------------------------------------------------------------------------
  // 4.3. КОНТУР КОРПУСА РЕАКТОРА, ВЫГОРОДКИ, ОСИ I-III / II-IV И ПЕТЛИ RCP-1..4
  // --------------------------------------------------------------------------
  const outerBarrelR = hexR * 13.75; // ~278 px

  // Внешнее кольцо корпуса реактора и внутреннее кольцо шахты/выгородки (#475569 / #334155)
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, outerBarrelR + 14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(cx, cy, outerBarrelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Оси симметрии I — III (горизонтальная) и IV — II (вертикальная) в контрастном цвете #475569 / #0F172A
  ctx.save();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.4;

  // Горизонтальная ось I — III
  ctx.beginPath();
  ctx.moveTo(cx - outerBarrelR - 62, cy);
  ctx.lineTo(cx - outerBarrelR + 8, cy);
  ctx.moveTo(cx + outerBarrelR - 8, cy);
  ctx.lineTo(cx + outerBarrelR + 62, cy);
  ctx.stroke();

  // Вертикальная ось IV — II
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerBarrelR - 38);
  ctx.lineTo(cx, cy - outerBarrelR + 10);
  ctx.moveTo(cx, cy + outerBarrelR - 10);
  ctx.lineTo(cx, cy + outerBarrelR + 38);
  ctx.stroke();

  // Римские цифры осей I, II, III, IV (#0F172A)
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 14px "Times New Roman", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('I', cx - outerBarrelR - 38, cy + 16);
  ctx.fillText('III', cx + outerBarrelR + 38, cy - 14);
  ctx.fillText('IV', cx - 16, cy - outerBarrelR - 24);
  ctx.fillText('II', cx + 16, cy + outerBarrelR + 24);
  ctx.restore();

  // Отрисовка 4 направлений петель ГЦК (RCP-1, RCP-2, RCP-3, RCP-4) и угловых секторов 20°30' и 34°30'
  const loopsGeometry = [
    // RCP-4: верхняя левая петля (20°30' выше оси I)
    {
      label: 'RCP-4',
      sub: 'Петля №4 (20°30\')',
      angleDeg: 180 + 20.5,
      arcStartDeg: 180,
      arcEndDeg: 200.5,
      angleText: "20°30'",
      loopIdx: 3
    },
    // RCP-1: нижняя левая петля (34°30' ниже оси I)
    {
      label: 'RCP-1',
      sub: 'Петля №1 (34°30\')',
      angleDeg: 180 - 34.5,
      arcStartDeg: 145.5,
      arcEndDeg: 180,
      angleText: "34°30'",
      loopIdx: 0
    },
    // RCP-3: верхняя правая петля (34°30' выше оси III)
    {
      label: 'RCP-3',
      sub: 'Петля №3 (34°30\')',
      angleDeg: -34.5,
      arcStartDeg: -34.5,
      arcEndDeg: 0,
      angleText: "34°30'",
      loopIdx: 2
    },
    // RCP-2: нижняя правая петля (20°30' ниже оси III)
    {
      label: 'RCP-2',
      sub: 'Петля №2 (20°30\')',
      angleDeg: 20.5,
      arcStartDeg: 0,
      arcEndDeg: 20.5,
      angleText: "20°30'",
      loopIdx: 1
    }
  ];

  loopsGeometry.forEach(lp => {
    const rad = (lp.angleDeg * Math.PI) / 180;
    const rOuter = outerBarrelR + 56;
    const rInner = outerBarrelR + 4;
    const x1 = cx + rOuter * Math.cos(rad);
    const y1 = cy + rOuter * Math.sin(rad);
    const x2 = cx + rInner * Math.cos(rad);
    const y2 = cy + rInner * Math.sin(rad);

    const loopObj = s.loops && s.loops[lp.loopIdx] ? s.loops[lp.loopIdx] : { pumpOn: true, flowPct: 100 };
    const arrowColor = loopObj.pumpOn ? '#0284C7' : '#64748B';

    ctx.save();
    // Стрелка направления входа петли RCP (#0284C7 / #475569)
    ctx.strokeStyle = arrowColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Наконечник стрелки у границы зоны
    const headLen = 8.5;
    const headAng = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(headAng - 0.38), y2 - headLen * Math.sin(headAng - 0.38));
    ctx.lineTo(x2 - headLen * Math.cos(headAng + 0.38), y2 - headLen * Math.sin(headAng + 0.38));
    ctx.closePath();
    ctx.fill();

    // Размерная дуга угла (20°30' / 34°30') в цвете #475569
    const arcR = outerBarrelR + 40;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, (lp.arcStartDeg * Math.PI) / 180, (lp.arcEndDeg * Math.PI) / 180);
    ctx.stroke();

    // Подпись угла (#475569)
    const midDeg = (lp.arcStartDeg + lp.arcEndDeg) / 2;
    const midRad = (midDeg * Math.PI) / 180;
    const txAngle = cx + (arcR + 22) * Math.cos(midRad);
    const tyAngle = cy + (arcR + 22) * Math.sin(midRad);
    ctx.fillStyle = '#475569';
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lp.angleText, txAngle, tyAngle);

    // Подпись RCP-1..4 (#0F172A)
    const lblX = cx + (rOuter + 14) * Math.cos(rad);
    const lblY = cy + (rOuter + 14) * Math.sin(rad) + (lp.angleDeg > 0 && lp.angleDeg < 180 ? 10 : -10);
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 12.5px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(lp.label, lblX, lblY);
    ctx.restore();
  });

  // --------------------------------------------------------------------------
  // 4.4. ЭТАЛОННАЯ ВЫНОСКА-КЛЮЧ ЯЧЕЙКИ В ЛЕВОМ ВЕРХНЕМ УГЛУ (КАК НА FIGURE 2)
  // --------------------------------------------------------------------------
  ctx.save();
  const keyX = 56;
  const keyY = 98;
  const keyR = 22;
  drawPointyHexPath(ctx, keyX, keyY, keyR);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('9', keyX, keyY - 6);
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.fillText('2', keyX, keyY + 7);

  // Линии-выноски и подписи (#0F172A / #475569)
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 10.5px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('— Номер ТВС (1..163)', keyX + 28, keyY - 6);
  ctx.fillStyle = '#475569';
  ctx.fillText('— Номер группы СУЗ (1..12)', keyX + 28, keyY + 8);
  ctx.restore();

  // --------------------------------------------------------------------------
  // 4.5. ОТРИСОВКА 163 ГЕКСАГОНАЛЬНЫХ ЯЧЕЕК ТВС-2М
  // --------------------------------------------------------------------------
  const hoveredId = (s.hoveredHotspot && s.hoveredHotspot.assemblyId) ? s.hoveredHotspot.assemblyId : null;
  const selectedId = s.selectedAssemblyId || 82;

  for (let i = 0; i < coreAssemblies.length; i++) {
    const a = coreAssemblies[i];
    const rodState = updateAssemblyTelemetry(a, s);
    const pos = getAssemblyScreenCoords(a);

    // Выбор цветовой схемы и текста в зависимости от активного слоя
    let cellStyle;
    let bottomText = '';

    if (coreLayerMode === 'banks') {
      const bankKey = a.bank !== null ? a.bank : 0;
      cellStyle = BANK_PALETTE[bankKey] || BANK_PALETTE[0];
      bottomText = a.bank !== null ? String(a.bank) : '';
    } else if (coreLayerMode === 'kq') {
      cellStyle = getKqLayerStyle(a.currentKq, a.cladTempC);
      // В режиме [Тепловая карта Kq] выводим ТОЛЬКО номер кассеты
      bottomText = '';
    } else {
      cellStyle = getInsertionLayerStyle(a, rodState);
      // В режиме [Погружение стержней] процент погружения выводим ТОЛЬКО для реально погруженных групп (>0%)
      const roundedDepth = Math.round(rodState.depthPct);
      bottomText = (a.bank !== null && roundedDepth > 0) ? `${roundedDepth}%` : '';
    }

    const isSelected = a.id === selectedId;
    const isHovered = a.id === hoveredId;

    ctx.save();
    drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
    ctx.fillStyle = cellStyle.fill;
    ctx.fill();

    if (isSelected || isHovered) {
      ctx.strokeStyle = isSelected ? '#0284C7' : '#0F172A';
      ctx.lineWidth = isSelected ? 2.4 : 1.8;
    } else {
      ctx.strokeStyle = cellStyle.stroke || '#CBD5E1';
      ctx.lineWidth = 1.0;
    }
    ctx.stroke();

    // Чистая контрастная типографика внутри гексагона:
    ctx.fillStyle = cellStyle.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (coreLayerMode === 'kq') {
      ctx.font = '600 10px "JetBrains Mono", "Segoe UI", monospace';
      ctx.fillText(String(a.id), pos.x, pos.y);
    } else if (bottomText !== '') {
      ctx.font = '700 10px "JetBrains Mono", "Segoe UI", monospace';
      ctx.fillText(String(a.id), pos.x, pos.y - 5.0);

      ctx.font = '700 9px "JetBrains Mono", "Segoe UI", monospace';
      ctx.fillText(bottomText, pos.x, pos.y + 6.0);
    } else {
      ctx.font = '700 10px "JetBrains Mono", "Segoe UI", monospace';
      ctx.fillText(String(a.id), pos.x, pos.y);
    }
    ctx.restore();

    // Регистрация хитбокса ТВС для наведения и клика
    if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
      const bankLabel = a.bank ? `Группа СУЗ №${a.bank}` : 'Без привода СУЗ';
      activeHotspots.push({
        x: pos.x,
        y: pos.y,
        r: hexR * 0.9,
        assemblyId: a.id,
        title: `ТВС-2М №${a.id} (${bankLabel})`,
        sub: `Координата: Ряд ${a.coordLabel} • Топливо ${a.enrichment.toFixed(2)}% U-235`,
        desc: a.bank
          ? `Тепловыделяющая сборка оснащена 18 направляющими каналами ПС СУЗ (Группа №${a.bank}). Погружение стержня: ${rodState.depthCm.toFixed(1)} см (${rodState.depthPct.toFixed(1)}%).`
          : 'Периферийная/промежуточная тепловыделяющая сборка ТВС-2М без привода ОР СУЗ.',
        simple: 'Каждая шестигранная кассета ТВС-2М содержит 312 твэлов с таблетками диоксида урана UO₂.',
        telemetry: () =>
          `Kq: ${a.currentKq.toFixed(3)} | ΔT: +${a.deltaT.toFixed(1)} °C | DNBR: ${a.dnbr.toFixed(2)} | Tобол: ${a.cladTempC.toFixed(1)} °C`
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4.6. НИЖНЯЯ ЛЕГЕНДА СЛОЯ ПОД КАРТОГРАММОЙ (#F8FAFC с тонким бордером #E2E8F0)
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(18, 662, 748, 44, 8);
  ctx.fill();
  ctx.stroke();

  if (coreLayerMode === 'banks') {
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ГРУППЫ СУЗ:', 28, 684);

    for (let b = 0; b <= 12; b++) {
      const pal = BANK_PALETTE[b];
      const bx = 112 + b * 49;
      const by = 672;
      ctx.fillStyle = pal.fill;
      ctx.strokeStyle = pal.stroke;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.roundRect(bx, by, 43, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = pal.text;
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b === 0 ? 'Б/СУЗ' : `Гр.${b}`, bx + 21.5, by + 12.5);
    }
  } else if (coreLayerMode === 'kq') {
    const kqStops = [
      { lbl: '< 0.85 (Низкое)', col: '#0EA5E9', txt: '#FFFFFF' },
      { lbl: '0.85–1.10 (Номинал)', col: '#06B6D4', txt: '#0F172A' },
      { lbl: '1.10–1.25 (Повыш.)', col: '#F59E0B', txt: '#0F172A' },
      { lbl: '> 1.25 (Пик Kq)', col: '#EF4444', txt: '#FFFFFF' },
      { lbl: 'Перегрев (>1.35)', col: '#DC2626', txt: '#FFFFFF' }
    ];
    kqStops.forEach((st, idx) => {
      const sx = 28 + idx * 145;
      ctx.fillStyle = st.col;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sx, 672, 136, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = st.txt;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.lbl, sx + 68, 684);
    });
  } else {
    const insStops = [
      { lbl: 'Гр.10 АРМ (В работе)', col: '#E11D48', txt: '#FFFFFF' },
      { lbl: '0% погруж. (Вверх)', col: '#0EA5E9', txt: '#FFFFFF' },
      { lbl: 'Частичное погружение', col: '#F59E0B', txt: '#0F172A' },
      { lbl: '100% погружение (АЗ-1)', col: '#EF4444', txt: '#FFFFFF' },
      { lbl: 'ТВС без ПС СУЗ', col: '#F1F5F9', txt: '#0F172A' }
    ];
    insStops.forEach((st, idx) => {
      const sx = 28 + idx * 145;
      ctx.fillStyle = st.col;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sx, 672, 136, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = st.txt;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.lbl, sx + 68, 684);
    });
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // 4.7. БОКОВАЯ ИНФО-ПАНЕЛЬ ТЕЛЕМЕТРИИ ТВС (#coreInfoPanel) СПРАВА
  // --------------------------------------------------------------------------
  // Карточка #FFFFFF с границей 1px solid #E2E8F0 и скруглением 8px
  const activeId = hoveredId !== null ? hoveredId : selectedId;
  const activeFA = coreAssemblies.find(item => item.id === activeId) || coreAssemblies[81] || coreAssemblies[0];
  const activeRod = getAssemblyRodState(activeFA, s);

  syncCoreInfoPanelDOM(activeFA, activeRod);

  const px = 782;
  const py = 12;
  const pw = 360;
  const ph = 694;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 8);
  ctx.fill();
  ctx.stroke();

  // Верхняя акцентная полоса панели
  const headerBankKey = activeFA.bank !== null ? activeFA.bank : 0;
  const headerPal = BANK_PALETTE[headerBankKey] || BANK_PALETTE[0];
  ctx.fillStyle = activeFA.bank === 10 ? '#E11D48' : '#0284C7';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, 4, [8, 8, 0, 0]);
  ctx.fill();

  // Заголовок боковой панели (#coreInfoPanel)
  ctx.fillStyle = '#64748B';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ИНФО-ПАНЕЛЬ КАССЕТЫ // #coreInfoPanel', px + 16, py + 24);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(`ТВС-2М №${activeFA.id}`, px + 16, py + 48);

  // Бейдж группы СУЗ справа в шапке
  ctx.fillStyle = headerPal.fill;
  ctx.strokeStyle = headerPal.stroke;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(px + pw - 144, py + 28, 128, 26, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = headerPal.text;
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    activeFA.bank !== null ? `ГРУППА СУЗ №${activeFA.bank}` : 'БЕЗ ПРИВОДА СУЗ',
    px + pw - 80,
    py + 45
  );

  // Статус выбора (Клик / Наведение курсора)
  ctx.textAlign = 'left';
  ctx.fillStyle = hoveredId !== null ? '#0284C7' : '#64748B';
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.fillText(
    hoveredId !== null
      ? `● Режим обзора курсором (Клик фиксирует ТВС №${activeFA.id})`
      : `● Зафиксирована ТВС №${activeFA.id} (Наведите курсор на любую ячейку)`,
    px + 16,
    py + 68
  );

  // Разделитель
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 16, py + 78);
  ctx.lineTo(px + pw - 16, py + 78);
  ctx.stroke();

  // 6 ОБЯЗАТЕЛЬНЫХ КАРТОЧЕК ТЕЛЕМЕТРИИ ТВС (норма — #16A34A, предупреждение — #D97706, авария — #DC2626)
  const dnbrStatusColor = activeFA.dnbr < 1.35 ? '#DC2626' : (activeFA.dnbr < 1.65 ? '#D97706' : '#16A34A');
  const kqStatusColor = activeFA.currentKq > 1.25 ? '#DC2626' : (activeFA.currentKq >= 1.10 ? '#D97706' : '#16A34A');
  const cladStatusColor = activeFA.cladTempC > 350 ? '#DC2626' : (activeFA.cladTempC > 340 ? '#D97706' : '#16A34A');

  const telemetryRows = [
    {
      label: '1. НОМЕР ТВС И КООРДИНАТА В РЕШЕТКЕ',
      val: `ТВС №${activeFA.id} • Ряд ${activeFA.coordLabel}`,
      sub: `Радиус от оси зоны: R = ${(activeFA.dist * 23.6).toFixed(0)} мм (шаг 236 мм)`,
      accent: '#0284C7',
      valColor: '#0F172A'
    },
    {
      label: '2. ГРУППА СУЗ И ПОГРУЖЕНИЕ СТЕРЖНЯ',
      val: activeFA.bank !== null
        ? `Группа №${activeFA.bank} • Погружение: ${activeRod.depthCm.toFixed(1)} см (${activeRod.depthPct.toFixed(1)}%)`
        : 'Без ОР СУЗ (bank: null) • Погружение: 0.0 см',
      sub: activeFA.bank !== null
        ? `Высота от низа АЗ: ${activeRod.heightCm.toFixed(1)} см из 373.0 см (${activeRod.heightPct.toFixed(1)}%)`
        : 'В направляющих каналах размещены имитаторы / СВП',
      accent: activeFA.bank === 10 ? '#E11D48' : '#0284C7',
      valColor: '#0F172A'
    },
    {
      label: '3. КОЭФФИЦИЕНТ НЕРАВНОМЕРНОСТИ (Kq)',
      val: `Kq = ${activeFA.currentKq.toFixed(3)} отн. ед.`,
      sub: `Тепловая мощность кассеты: ${activeFA.powerMW.toFixed(2)} МВт (Макс по зоне: ${(s.kqMax || 1.31).toFixed(2)})`,
      accent: kqStatusColor,
      valColor: kqStatusColor
    },
    {
      label: '4. ПОДОГРЕВ ТЕПЛОНОСИТЕЛЯ В ТВС (ΔT)',
      val: `ΔT = +${activeFA.deltaT.toFixed(1)} °C`,
      sub: `Вход: ${(s.coreInletTempC || 298.2).toFixed(1)} °C → Выход из ТВС: ${activeFA.outletTemp.toFixed(1)} °C`,
      accent: '#D97706',
      valColor: '#0F172A'
    },
    {
      label: '5. ЗАПАС ДО КРИЗИСА КИПЕНИЯ (DNBR)',
      val: `DNBR = ${activeFA.dnbr.toFixed(2)}`,
      sub: activeFA.dnbr >= 1.30
        ? 'Норма безопасности (Проектный предел DNBR > 1.30)'
        : 'ВНИМАНИЕ! Снижение запаса до кризиса теплообмена!',
      accent: dnbrStatusColor,
      valColor: dnbrStatusColor
    },
    {
      label: '6. ТЕМПЕРАТУРА ОБОЛОЧКИ ТВЭЛОВ (Э110)',
      val: `Tобол = ${activeFA.cladTempC.toFixed(1)} °C`,
      sub: `Топливный сердечник UO₂ (средн.): ${Math.round(s.fuelTempC || 680)} °C • Обогащение ${activeFA.enrichment.toFixed(2)}%`,
      accent: cladStatusColor,
      valColor: cladStatusColor
    }
  ];

  let ry = py + 88;
  const cardH = 66;
  const cardGap = 7;

  telemetryRows.forEach(item => {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px + 16, ry, pw - 32, cardH, 6);
    ctx.fill();
    ctx.stroke();

    // Левый цветовой маркер статуса
    ctx.fillStyle = item.accent;
    ctx.fillRect(px + 16, ry, 3.5, cardH);

    // Заголовок блока: глубокий сланец #0F172A
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, px + 26, ry + 16);

    // Значение телеметрии: четкий моноширинный шрифт #0F172A с цветовой маркировкой статуса
    ctx.fillStyle = item.valColor || '#0F172A';
    ctx.font = '700 12.5px "JetBrains Mono", monospace';
    ctx.fillText(item.val, px + 26, ry + 36);

    // Вторичные параметры, формулы, размерности: нейтральный серый #64748B
    ctx.fillStyle = '#64748B';
    ctx.font = '500 10px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(item.sub, px + 26, ry + 54);

    ry += cardH + cardGap;
  });

  // --------------------------------------------------------------------------
  // 4.8. ВИЗУАЛЬНАЯ ШКАЛА ПОГРУЖЕНИЯ СТЕРЖНЯ СУЗ В АКТИВНУЮ ЗОНУ (ВНИЗУ ПАНЕЛИ)
  // --------------------------------------------------------------------------
  const barBoxY = ry + 4;
  const barBoxH = py + ph - barBoxY - 12;

  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px + 16, barBoxY, pw - 32, barBoxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ПОЛОЖЕНИЕ ОР СУЗ В КАССЕТЕ (ВЫСОТА 373 СМ):', px + 26, barBoxY + 18);

  // Горизонтальная шкала погружения стержня сверху вниз (0..100%)
  const trackX = px + 26;
  const trackY = barBoxY + 28;
  const trackW = pw - 52;
  const trackH = 18;

  ctx.fillStyle = '#E2E8F0';
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.roundRect(trackX, trackY, trackW, trackH, 4);
  ctx.fill();
  ctx.stroke();

  if (activeFA.bank !== null && activeRod.depthPct > 0.1) {
    const fillW = Math.max(4, (activeRod.depthPct / 100.0) * trackW);
    ctx.fillStyle = activeFA.bank === 10 ? 'rgba(225, 29, 72, 0.25)' : 'rgba(2, 132, 199, 0.25)';
    ctx.beginPath();
    ctx.roundRect(trackX, trackY, fillW, trackH, 4);
    ctx.fill();
  }

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    activeFA.bank !== null
      ? `ПОГРУЖЕНИЕ: ${activeRod.depthCm.toFixed(1)} см (${activeRod.depthPct.toFixed(1)}%)  |  ИЗВЛЕЧЕНО: ${activeRod.heightPct.toFixed(1)}%`
      : 'ПРИВОД ШЭМ-3 ОТСУТСТВУЕТ (СВОБОДНАЯ ТВС)',
    trackX + trackW / 2,
    trackY + 12.5
  );

  // Сводка по общему положению групп в реакторе (#64748B)
  ctx.fillStyle = '#64748B';
  ctx.font = '500 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  const g10Val = typeof s.group10Pos === 'number' ? s.group10Pos : 80.0;
  const g19Val = typeof s.groups1to9Pos === 'number' ? s.groups1to9Pos : 100.0;
  ctx.fillText(
    `Реактор В-491: Раб. группа №10 Н=${g10Val.toFixed(1)}% (${((100 - g10Val) * 3.73).toFixed(0)} см) • Группы АЗ №1–9 Н=${g19Val.toFixed(1)}%`,
    px + 26,
    trackY + 34
  );

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// 5. ЯВНЫЙ ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ (window)
// ============================================================================
if (typeof window !== 'undefined') {
  window.EXACT_FA_BANK_MAP = EXACT_FA_BANK_MAP;
  window.BANK_PALETTE = BANK_PALETTE;
  window.coreAssemblies = coreAssemblies;
  window.initCoreCartogram = initCoreCartogram;
  window.resizeCoreCanvas = resizeCoreCanvas;
  window.renderCoreCartogramView = renderCoreCartogramView;
  window.hitTestCoreAssembly = hitTestCoreAssembly;
  window.selectCoreAssembly = selectCoreAssembly;
  window.setCoreLayerMode = setCoreLayerMode;
}
