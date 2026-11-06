// ============================================================================
// core_cartogram.js — ReactorLab // Цифровой двойник ВВЭР-1200 (Проект В-491)
// Точная картограмма активной зоны (163 ТВС-2М) и групп ОР СУЗ (Bank 1–12)
// Эталонная схема групп ОР СУЗ: Figure 2 (VVER-1200 reactor core with control rod banks)
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

// Стационарная 4-годичная топливная загрузка (по картограмме проекта, перенесена вручную).
// Запись ячейки: год, тип, выгорание МВт·сут/кг. Типы: a Z49, A Z49A2, B Z49B6, D Z40D2.
// Ряды r = -7..0 слева направо; нижняя половина получается поворотом на 180°.
const FUEL_LOADING_ROWS = {
  '-7': '4B50.69 4B50.61 1a 1a 4A49.29 4A51.57',
  '-6': '4A51.57 4a46.83 1B 1A 4a46.72 1A 1B 4a46.83 4B50.69',
  '-5': '4A49.29 1B 2a13.83 3B35.39 3a31.85 3a31.76 3B35.27 2a13.83 1B 4B50.61',
  '-4': '1a 1A 3B35.27 2A18.66 2B17.20 2a13.81 2B17.21 2A18.66 3B35.39 1A 1a',
  '-3': '1a 4a46.72 3a31.76 2B17.21 2D18.29 3A36.94 3D34.51 2D18.29 2B17.20 3a31.85 4a46.72 1a',
  '-2': '4B50.61 1A 3a31.85 2a13.81 3D34.51 2A18.67 1D 2A18.67 3A36.94 2a13.81 3a31.76 1A 4A49.29',
  '-1': '4B50.69 1B 3B35.39 2B17.20 3A36.94 1D 3A36.07 3A36.07 1D 3D34.51 2B17.21 3B35.27 1B 4A51.57',
  '0': '4a46.83 2a13.83 2A18.66 2D18.29 2A18.67 3A36.07 4D48.22 3A36.07 2A18.67 2D18.29 2A18.66 2a13.83 4a46.83'
};
const FUEL_TYPES = {
  a: { name: 'Z49', enrichment: 4.9, reactivity: 1.0 },
  A: { name: 'Z49A2', enrichment: 4.9, reactivity: 0.97 },
  B: { name: 'Z49B6', enrichment: 4.9, reactivity: 0.94 },
  D: { name: 'Z40D2', enrichment: 4.0, reactivity: 0.90 }
};
const FUEL_YEAR_STYLE = {
  1: { fill: '#FFFFFF', text: '#0F172A', stroke: '#64748B', label: 'ТВС 1 года' },
  2: { fill: '#FDE68A', text: '#0F172A', stroke: '#B45309', label: 'ТВС 2 года' },
  3: { fill: '#7DD3FC', text: '#0F172A', stroke: '#0284C7', label: 'ТВС 3 года' },
  4: { fill: '#86EFAC', text: '#0F172A', stroke: '#16A34A', label: 'ТВС 4 года' }
};
// Относительная размножающая способность кассеты по году работы (инженерная оценка)
const FUEL_YEAR_REACTIVITY = { 1: 1.25, 2: 1.14, 3: 0.93, 4: 0.70 };

function buildFuelLoadingMap() {
  const map = new Map();
  Object.entries(FUEL_LOADING_ROWS).forEach(([rowKey, rowText]) => {
    const r = Number(rowKey);
    const rowQ = [];
    for (let q = -7; q <= 7; q++) {
      if (q * q + r * r + q * r <= 43) rowQ.push(q);
    }
    rowText.split(' ').forEach((entry, idx) => {
      const cell = {
        year: Number(entry[0]),
        type: FUEL_TYPES[entry[1]],
        burnup: Number(entry.slice(2) || 0)
      };
      map.set(rowQ[idx] + ',' + r, cell);
      map.set((-rowQ[idx]) + ',' + (-r), cell);
    });
  });
  return map;
}

// Цветовая палитра групп ОР СУЗ 1..12 (Стандарт Slate Light SCADA — высокий контраст)
const BANK_PALETTE = {
  0:  { fill: '#F1F5F9', text: '#0F172A', stroke: '#CBD5E1', name: 'Без ПС СУЗ' },
  1:  { fill: '#BAE6FD', text: '#0F172A', stroke: '#0284C7', name: 'Группа 1 (АЗ)' },
  2:  { fill: '#E2E8F0', text: '#0F172A', stroke: '#64748B', name: 'Группа 2 (АЗ)' },
  3:  { fill: '#FED7AA', text: '#0F172A', stroke: '#EA580C', name: 'Группа 3 (АЗ)' },
  4:  { fill: '#99F6E4', text: '#0F172A', stroke: '#0D9488', name: 'Группа 4 (АЗ)' },
  5:  { fill: '#FEF08A', text: '#0F172A', stroke: '#CA8A04', name: 'Группа 5 (АЗ)' },
  6:  { fill: '#FDBA74', text: '#0F172A', stroke: '#C2410C', name: 'Группа 6 (АЗ)' },
  7:  { fill: '#C7D2FE', text: '#0F172A', stroke: '#4F46E5', name: 'Группа 7 (АЗ)' },
  8:  { fill: '#A7F3D0', text: '#0F172A', stroke: '#059669', name: 'Группа 8 (АЗ)' },
  9:  { fill: '#3B82F6', text: '#FFFFFF', stroke: '#1D4ED8', name: 'Группа 9 (АЗ)' },
  10: { fill: '#E11D48', text: '#FFFFFF', stroke: '#9F1239', name: 'Группа 10 (АЗ)' },
  11: { fill: '#10B981', text: '#FFFFFF', stroke: '#047857', name: 'Группа 11 (АЗ)' },
  12: { fill: '#7C3AED', text: '#FFFFFF', stroke: '#5B21B6', name: 'Группа 12 (Рабочая АРМ)' }
};

// Рабочая регулирующая группа; её положение хранится в sim.group10Pos
const WORKING_BANK = 12;

// Геометрические константы картограммы (базовый холст 1160 x 720)
const CORE_GRID_LAYOUT = {
  centerX: 392,
  centerY: 382,
  hexR: 20.2
};

// Текущий слой отображения картограммы:
// 'banks'     — [Группы СУЗ 1-12] (активен по умолчанию)
// 'fuel'      — [Загрузка] годы работы и выгорание ТВС
// 'kq'        — [Тепловая карта Kq]
// 'insertion' — [Погружение стержней]
var coreLayerMode = 'banks';
var selectedBank = null; // Селективно выбранная группа СУЗ (1..12 или null)

if (typeof window !== 'undefined') {
  window.coreLayerMode = coreLayerMode;
  window.selectedBank = selectedBank;
}

function toggleBankSelection(bankId) {
  if (selectedBank === bankId) {
    selectedBank = null;
  } else {
    selectedBank = bankId;
  }
  if (typeof window !== 'undefined') {
    window.selectedBank = selectedBank;
  }
  syncCoreLegendDOM();
  if (typeof window !== 'undefined' && window.sound && typeof window.sound.click === 'function') {
    window.sound.click(640);
  }
  if (typeof window !== 'undefined' && typeof window.renderCanvas === 'function') {
    window.renderCanvas(0.016);
  }
}

function syncCoreLegendDOM() {
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('coreLegendBar');
  if (!bar) return;
  const buttons = bar.querySelectorAll('[data-bank]');
  buttons.forEach(btn => {
    const b = parseInt(btn.getAttribute('data-bank'), 10);
    btn.classList.toggle('active', selectedBank === b);
  });
}

// Массив 163 ТВС-2М
var coreAssemblies = [];

// Форма поля Kq
const KQ_REFLECTOR = 0.35;
const KQ_SELF_WEIGHT = 0.62;
const KQ_SPREAD = 0.90;

function initCoreCartogram() {
  coreAssemblies.length = 0;

  // Перебор рядов строго снизу вверх (r от +7 до -7) и слева направо (q от -7 до +7)
  // Условие гексагональной решетки ВВЭР-1200: q^2 + r^2 + q*r <= 43 -> ровно 163 ячейки
  let faId = 1;
  let rowNumber = 1;
  const fuelMap = buildFuelLoadingMap();

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

      const fuel = fuelMap.get(q + ',' + r);
      const enrichment = fuel.type.enrichment;
      const burnup = `${fuel.year}-й год (${fuel.burnup.toFixed(1)} МВт·сут/кг)`;

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
        fuelType: fuel.type.name,
        fuelTypeFactor: fuel.type.reactivity,
        campaignYear: fuel.year,
        burnupMWd: fuel.burnup,
        baseKq: 1.0,
        currentKq: 1.0,
        powerMW: 19.63,
        outletTemp: 328.9,
        deltaT: 30.7,
        dnbr: 2.15,
        cladTempC: 342.0,
        insertionPct: 0.0,
        insertionCm: 0.0
      });
    }
    rowNumber++;
  }

  // Поле Kq из загрузки: кассета × утечка к выгородке, затем сглаживание по 6 соседям
  const assemblyAt = new Map(coreAssemblies.map(a => [a.q + ',' + a.r, a]));
  coreAssemblies.forEach(a => {
    const leakage = 1.0 - 0.42 * Math.pow(a.dist / Math.sqrt(43), 3);
    a.localKq = FUEL_YEAR_REACTIVITY[a.campaignYear] * a.fuelTypeFactor * leakage;
  });
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  coreAssemblies.forEach(a => {
    const neighbourSum = neighbours.reduce((acc, [dq, dr]) => {
      const n = assemblyAt.get((a.q + dq) + ',' + (a.r + dr));
      return acc + (n ? n.localKq : KQ_REFLECTOR);
    }, 0);
    a.smoothKq = KQ_SELF_WEIGHT * a.localKq + (1.0 - KQ_SELF_WEIGHT) * neighbourSum / 6.0;
  });
  // Нормировка на среднее 1.000; сжатие размаха держит пик в пределах 1.24–1.30
  const meanKq = coreAssemblies.reduce((acc, a) => acc + a.smoothKq, 0) / coreAssemblies.length;

  coreAssemblies.forEach(a => {
    const exactKq = Number((1.0 + (a.smoothKq / meanKq - 1.0) * KQ_SPREAD).toFixed(3));
    a.baseKq = exactKq;
    a.currentKq = exactKq;
    a.powerMW = (3200.0 / 163.0) * exactKq;
    a.deltaT = 30.7 * exactKq;
    a.outletTemp = 298.2 + a.deltaT;
  });

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
// В физическом ядре sim.group10Pos — положение рабочей группы №12 от низа активной зоны (72.4% ≈ 270 см).
// 
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
    } else if (assembly.bank === WORKING_BANK) {
      heightPct = typeof s.group10Pos === 'number' ? s.group10Pos : 72.4;
    } else {
      // Группы АЗ на мощности находятся на верхнем концевике (100% от низа = 0% погружения)
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
  const filmDropC = (7.8 * powerFrac * kq) / Math.pow(flowFrac, 0.65);
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

// Цветовая шкала Kq (среднее Kq = 1.000)
function getKqLayerStyle(kq) {
  if (kq >= 1.24) {
    return { fill: '#E11D48', text: '#FFFFFF', stroke: '#9F1239' }; // Пиковые ТВС
  } else if (kq >= 1.15) {
    return { fill: '#F59E0B', text: '#0F172A', stroke: '#B45309' }; // Повышенное энерговыделение
  } else if (kq >= 0.86) {
    return { fill: '#0284C7', text: '#FFFFFF', stroke: '#0369A1' }; // Основная зона
  }
  return { fill: '#38BDF8', text: '#0F172A', stroke: '#0284C7' };   // Выгоревшие и краевые ТВС
}

// Температура оболочки: красный цвет только при кризисе теплообмена
function getCladStatusColor(assembly) {
  if (assembly.dnbr < 1.30) return '#DC2626';
  return assembly.cladTempC > 350 ? '#D97706' : '#16A34A';
}

// Цветовая карта физического погружения стержней СУЗ (0..100%, стандарт Slate Light SCADA)
function getInsertionLayerStyle(assembly, rodState) {
  if (!assembly.bank) {
    return { fill: '#F1F5F9', text: '#64748B', stroke: '#CBD5E1' };
  }
  const depth = rodState.depthPct; // 0..100% погружения сверху
  // Пороги и цвета совпадают с легендой слоя (раздел 4.6)
  if (depth >= 99) {
    return { fill: '#EF4444', text: '#FFFFFF', stroke: '#B91C1C' }; // Полное погружение (АЗ-1)
  }
  if (depth < 1) {
    return { fill: '#0EA5E9', text: '#FFFFFF', stroke: '#0284C7' }; // На верхнем концевике
  }
  if (assembly.bank === WORKING_BANK) {
    return { fill: '#E11D48', text: '#FFFFFF', stroke: '#9F1239' }; // Рабочая группа в зоне
  }
  return { fill: '#F59E0B', text: '#0F172A', stroke: '#B45309' };   // Частичное погружение
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
  if (mode === 'banks' || mode === 'fuel' || mode === 'kq' || mode === 'insertion') {
    coreLayerMode = mode;
    if (typeof window !== 'undefined') {
      window.coreLayerMode = mode;
      const coreLegend = document.getElementById('coreLegendBar');
      if (coreLegend) {
        coreLegend.style.display = (window.sim && window.sim.viewMode === 'core' && mode === 'banks') ? 'flex' : 'none';
      }
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
    ? `Группа №${activeAssembly.bank}${activeAssembly.bank === WORKING_BANK ? ' (Рабочая АРМ)' : ''}`
    : 'Без привода СУЗ (bank: null)';
  const rodDepthStr = activeAssembly.bank
    ? `${rodState.depthCm.toFixed(1)} см (${rodState.depthPct.toFixed(1)}% / Н=${rodState.heightPct.toFixed(1)}%)`
    : '0.0 см (ПС СУЗ отсутствует)';

  const kqCol = activeAssembly.currentKq >= 1.24 ? '#E11D48' : (activeAssembly.currentKq >= 1.15 ? '#D97706' : '#0284C7');
  const dnbrCol = activeAssembly.dnbr >= 1.30 ? '#16A34A' : '#DC2626';
  const cladCol = getCladStatusColor(activeAssembly);
  const badgeLabel = activeAssembly.bank ? `ГРУППА СУЗ №${activeAssembly.bank}` : 'БЕЗ ПРИВОДА СУЗ';

  panel.dataset.assemblyId = String(activeAssembly.id);
  panel.dataset.bank = activeAssembly.bank !== null ? String(activeAssembly.bank) : 'null';
  panel.innerHTML =
    `<div class="cip-header">` +
      `<div class="cip-title">ТВС-2М №${activeAssembly.id}</div>` +
      `<div class="cip-badge">${badgeLabel}</div>` +
    `</div>` +
    `<div class="cip-section">` +
      `<div class="cip-section-title">[ПОЛОЖЕНИЕ В РЕШЕТКЕ]</div>` +
      `<div class="cip-row"><span>Загрузка:</span><b>${activeAssembly.fuelType} • ${activeAssembly.burnup}</b></div>` +
      `<div class="cip-row"><span>Координаты в решетке:</span><b>Ряд ${activeAssembly.coordLabel}</b></div>` +
      `<div class="cip-row"><span>Радиус R от оси:</span><b>${(activeAssembly.dist * 236).toFixed(0)} мм</b></div>` +
    `</div>` +
    `<div class="cip-section">` +
      `<div class="cip-section-title">[ПРИВОД ШЭМ-3]</div>` +
      `<div class="cip-row"><span>Номер группы СУЗ:</span><b>${bankStr}</b></div>` +
      `<div class="cip-row"><span>Статус погружения:</span><b>${rodDepthStr}</b></div>` +
    `</div>` +
    `<div class="cip-section">` +
      `<div class="cip-section-title">[НЕЙТРОННО-ТЕПЛОВАЯ ФИЗИКА]</div>` +
      `<div class="cip-row"><span>Коэффициент Kq:</span><b style="color:${kqCol}">${activeAssembly.currentKq.toFixed(3)}</b></div>` +
      `<div class="cip-row"><span>Тепловая мощность ТВС:</span><b>${activeAssembly.powerMW.toFixed(2)} МВт</b></div>` +
      `<div class="cip-row"><span>Подогрев ΔT:</span><b>+${activeAssembly.deltaT.toFixed(1)} °C</b></div>` +
    `</div>` +
    `<div class="cip-section">` +
      `<div class="cip-section-title">[ПРЕДЕЛЫ БЕЗОПАСНОСТИ]</div>` +
      `<div class="cip-row"><span>Запас DNBR:</span><b style="color:${dnbrCol}">${activeAssembly.dnbr.toFixed(2)}</b></div>` +
      `<div class="cip-row"><span>Температура оболочки ТВЭЛ:</span><b style="color:${cladCol}">${activeAssembly.cladTempC.toFixed(1)} °C</b></div>` +
    `</div>`;
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
  ctx.fillText('КАРТОГРАММА АКТИВНОЙ ЗОНЫ ВВЭР-1200', 30, 31);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.fillText('163 ТВС-2М • 121 ПС СУЗ • 12 групп', 30, 47);

  // 3 кнопки-тумблера слоев картограммы
  const layerButtons = [
    { id: 'banks', label: '[Группы СУЗ]', x: 402, w: 90 },
    { id: 'fuel', label: '[Загрузка]', x: 496, w: 76 },
    { id: 'kq', label: '[Карта Kq]', x: 576, w: 76 },
    { id: 'insertion', label: '[Погружение]', x: 656, w: 100 }
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
  // 4.3. КОНТУР КОРПУСА РЕАКТОРА, ВЫГОРОДКИ, ОСИ I-III / II-IV И ПЕТЛИ ГЦНА-1..4
  // --------------------------------------------------------------------------
  // Угловые ТВС заканчиваются на ~250 px от центра; оба кольца помещаются над легендой (y = 662)
  const outerBarrelR = hexR * 12.67; // ~256 px
  const barrelGap = 8;

  // Внешнее кольцо корпуса реактора и внутреннее кольцо шахты/выгородки (#475569 / #334155)
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, outerBarrelR + barrelGap, 0, Math.PI * 2);
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
  ctx.lineTo(cx, 660);
  ctx.stroke();

  // Римские цифры осей I, II, III, IV (#0F172A)
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 14px "Times New Roman", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('I', cx - outerBarrelR - 72, cy);
  ctx.fillText('III', cx + outerBarrelR + 76, cy);
  ctx.fillText('IV', cx - 16, cy - outerBarrelR - 26);
  ctx.fillText('II', cx + 14, 654);
  ctx.restore();

  // Отрисовка 4 направлений петель ГЦК (ГЦНА-1, ГЦНА-2, ГЦНА-3, ГЦНА-4) и угловых секторов 20°30' и 34°30'
  const loopsGeometry = [
    // ГЦНА-4: верхняя левая петля (20°30' выше оси I)
    {
      label: 'ГЦНА-4',
      sub: 'Петля №4 (20°30\')',
      angleDeg: 180 + 20.5,
      arcStartDeg: 180,
      arcEndDeg: 200.5,
      angleText: "20°30'",
      loopIdx: 3
    },
    // ГЦНА-1: нижняя левая петля (34°30' ниже оси I)
    {
      label: 'ГЦНА-1',
      sub: 'Петля №1 (34°30\')',
      angleDeg: 180 - 34.5,
      arcStartDeg: 145.5,
      arcEndDeg: 180,
      angleText: "34°30'",
      loopIdx: 0
    },
    // ГЦНА-3: верхняя правая петля (34°30' выше оси III)
    {
      label: 'ГЦНА-3',
      sub: 'Петля №3 (34°30\')',
      angleDeg: -34.5,
      arcStartDeg: -34.5,
      arcEndDeg: 0,
      angleText: "34°30'",
      loopIdx: 2
    },
    // ГЦНА-2: нижняя правая петля (20°30' ниже оси III)
    {
      label: 'ГЦНА-2',
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
    const rInner = outerBarrelR + barrelGap + 2;
    const x1 = cx + rOuter * Math.cos(rad);
    const y1 = cy + rOuter * Math.sin(rad);
    const x2 = cx + rInner * Math.cos(rad);
    const y2 = cy + rInner * Math.sin(rad);

    const loopObj = s.loops && s.loops[lp.loopIdx] ? s.loops[lp.loopIdx] : { pumpOn: true, flowPct: 100 };
    const arrowColor = loopObj.pumpOn ? '#0284C7' : '#64748B';

    ctx.save();
    // Стрелка направления входа петли (#0284C7 / #475569)
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

    // Подпись ГЦНА-1..4 (#0F172A)
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
  ctx.fillStyle = '#E2E8F0';
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('9', keyX, keyY - 6);

  ctx.beginPath();
  ctx.arc(keyX, keyY + 7, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 9px "JetBrains Mono", monospace';
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

    const isSelected = a.id === selectedId;
    const isHovered = a.id === hoveredId;

    ctx.save();

    if (coreLayerMode === 'banks') {
      const isSelectedGroup = (selectedBank !== null && a.bank === selectedBank);
      const isDimmed = (selectedBank !== null && !isSelectedGroup);

      if (isDimmed) {
        ctx.globalAlpha = 0.35;
      }

      if (isSelectedGroup) {
        // Подсвеченные кассеты выбранной группы: акцентный синий #0284C7, белый текст #FFFFFF
        drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
        ctx.fillStyle = '#0284C7';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#0F172A' : (isHovered ? '#0284C7' : '#0369A1');
        ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(a.id), pos.x, pos.y - 5.0);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y + 6.0, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#0369A1';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.fillStyle = '#0284C7';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillText(String(a.bank), pos.x, pos.y + 6.0);
      } else if (a.hasRod) {
        // ТВС с СУЗ (по умолчанию): фон #E2E8F0, тонкая контрастная окантовка #64748B, темная цифра группы внутри круга (#0F172A)
        drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
        ctx.fillStyle = '#E2E8F0';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#0284C7' : (isHovered ? '#0F172A' : '#64748B');
        ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.0;
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(a.id), pos.x, pos.y - 5.0);

        ctx.beginPath();
        ctx.arc(pos.x, pos.y + 6.0, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillText(String(a.bank), pos.x, pos.y + 6.0);
      } else {
        // ТВС без СУЗ: фон #F8FAFC, граница #CBD5E1, номер кассеты #475569
        drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#0284C7' : (isHovered ? '#0F172A' : '#CBD5E1');
        ctx.lineWidth = (isSelected || isHovered) ? 2.2 : 1.0;
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(a.id), pos.x, pos.y);
      }
    } else if (coreLayerMode === 'fuel') {
      const cellStyle = FUEL_YEAR_STYLE[a.campaignYear];
      drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
      ctx.fillStyle = cellStyle.fill;
      ctx.fill();
      ctx.strokeStyle = (isSelected || isHovered) ? '#0F172A' : cellStyle.stroke;
      ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.0;
      ctx.stroke();

      // Номер кассеты и выгорание под ним
      ctx.fillStyle = cellStyle.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillText(String(a.id), pos.x, pos.y - 5.0);
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.fillText(a.burnupMWd.toFixed(1), pos.x, pos.y + 6.0);
    } else if (coreLayerMode === 'kq') {
      const cellStyle = getKqLayerStyle(a.currentKq, a.cladTempC);
      drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
      ctx.fillStyle = cellStyle.fill;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#0F172A' : (isHovered ? '#0F172A' : (cellStyle.stroke || '#CBD5E1'));
      ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.0;
      ctx.stroke();

      // Номер кассеты и значение Kq под ним
      ctx.fillStyle = cellStyle.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillText(String(a.id), pos.x, pos.y - 5.0);
      ctx.font = '600 8.5px "JetBrains Mono", monospace';
      ctx.fillText(a.currentKq.toFixed(2), pos.x, pos.y + 6.0);
    } else {
      // Режим [Погружение стержней]
      const cellStyle = getInsertionLayerStyle(a, rodState);
      drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
      ctx.fillStyle = cellStyle.fill;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#0284C7' : (isHovered ? '#0F172A' : (cellStyle.stroke || '#CBD5E1'));
      ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.0;
      ctx.stroke();

      ctx.fillStyle = cellStyle.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const roundedDepth = Math.round(rodState.depthPct);
      const bottomText = (a.bank !== null && roundedDepth > 0) ? `${roundedDepth}%` : '';
      if (bottomText !== '') {
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillText(String(a.id), pos.x, pos.y - 5.0);
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillText(bottomText, pos.x, pos.y + 6.0);
      } else {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillText(String(a.id), pos.x, pos.y);
      }
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
          : 'Тепловыделяющая сборка ТВС-2М без привода ОР СУЗ.',
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

    let curX = 114;
    for (let b = 1; b <= 12; b++) {
      const isWorking = (b === WORKING_BANK);
      const bw = isWorking ? 136 : 43;
      const bx = curX;
      const by = 672;
      curX += bw + 3.5;

      const isBankSelected = (selectedBank === b);
      ctx.fillStyle = isBankSelected ? '#0284C7' : '#FFFFFF';
      ctx.strokeStyle = isBankSelected ? '#0369A1' : (isWorking ? '#64748B' : '#CBD5E1');
      ctx.lineWidth = isBankSelected ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isBankSelected ? '#FFFFFF' : '#0F172A';
      ctx.font = (isWorking ? '700 9px ' : '700 9.5px ') + '"JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isWorking ? `Гр. ${b} (РАБОЧАЯ)` : `Гр.${b}`, bx + bw / 2, by + 12.5);

      if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
        activeHotspots.push({
          x: bx,
          y: by,
          w: bw,
          h: 24,
          bankId: b,
          title: isWorking ? `Группа СУЗ №${b} [РАБОЧАЯ]` : `Группа СУЗ №${b}`,
          sub: isWorking ? 'Рабочая регулирующая группа (АРМ)' : 'Стержни аварийной защиты (верхний концевик)',
          desc: isBankSelected ? 'Повторный клик — сброс селекции' : `Нажмите для подсветки кассет Группы №${b}`,
          simple: 'Селективная подсветка кассет выбранной группы на картограмме.',
          telemetry: () => (selectedBank === b ? 'ВЫБРАНА' : 'НЕ АКТИВНА'),
          onClick: () => toggleBankSelection(b)
        });
      }
    }
  } else if (coreLayerMode === 'fuel') {
    [1, 2, 3, 4].forEach((year, idx) => {
      const style = FUEL_YEAR_STYLE[year];
      const count = coreAssemblies.filter(a => a.campaignYear === year).length;
      const sx = 28 + idx * 180;
      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sx, 672, 172, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = style.text;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${style.label}: ${count} шт.`, sx + 86, 684);
    });
  } else if (coreLayerMode === 'kq') {
    const kqStops = [
      { lbl: '< 0.86 (Выгоревшие, край)', col: '#38BDF8', txt: '#0F172A' },
      { lbl: '0.86–1.14 (Основная зона)', col: '#0284C7', txt: '#FFFFFF' },
      { lbl: '1.15–1.23 (Повышенный Kq)', col: '#F59E0B', txt: '#0F172A' },
      { lbl: '1.24–1.30 (Пиковые ТВС)', col: '#E11D48', txt: '#FFFFFF' }
    ];
    kqStops.forEach((st, idx) => {
      const sx = 28 + idx * 180;
      ctx.fillStyle = st.col;
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sx, 672, 172, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = st.txt;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.lbl, sx + 86, 684);
    });
  } else {
    const insStops = [
      { lbl: 'Гр.12 АРМ (В работе)', col: '#E11D48', txt: '#FFFFFF' },
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

  // Верхняя акцентная синяя полоска
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, 4, [8, 8, 0, 0]);
  ctx.fill();

  // Заголовок боковой панели (#coreInfoPanel)
  ctx.fillStyle = '#64748B';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ИНФО-ПАНЕЛЬ КАССЕТЫ // #coreInfoPanel', px + 16, py + 22);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(`ТВС-2М №${activeFA.id}`, px + 16, py + 46);

  // Строгий монохромный SCADA-бейдж (#1E293B, белый текст, шрифт Inter tabular-nums)
  const badgeW = 140;
  const badgeH = 26;
  const badgeX = px + pw - badgeW - 16;
  const badgeY = py + 26;
  ctx.fillStyle = '#1E293B';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    activeFA.bank !== null ? `ГРУППА СУЗ №${activeFA.bank}` : 'БЕЗ ПРИВОДА СУЗ',
    badgeX + badgeW / 2,
    badgeY + badgeH / 2
  );

  // Статус выбора
  ctx.textAlign = 'left';
  ctx.fillStyle = hoveredId !== null ? '#0284C7' : '#64748B';
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.fillText(
    hoveredId !== null
      ? `● Режим обзора курсором (Клик фиксирует ТВС №${activeFA.id})`
      : `● Зафиксирована ТВС №${activeFA.id} (Кликните по любой кассете)`,
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

  // 4 ЧЕТКИХ БЛОКА С КОМПАКТНОЙ СЕТКОЙ КЛЮЧ-ЗНАЧЕНИЕ (БЕЗ НУМЕРАЦИИ "1.", "2.", "3."):
  const kqColor = activeFA.currentKq >= 1.24 ? '#E11D48' : (activeFA.currentKq >= 1.15 ? '#D97706' : '#0284C7');
  const dnbrColor = activeFA.dnbr >= 1.30 ? '#16A34A' : '#DC2626';
  const cladColor = getCladStatusColor(activeFA);

  const sections = [
    {
      title: '[ПОЛОЖЕНИЕ В РЕШЕТКЕ]',
      rows: [
        { k: 'Загрузка:', v: `${activeFA.fuelType} • ${activeFA.burnup}`, col: '#0F172A' },
        { k: 'Координаты в решетке:', v: `Ряд ${activeFA.coordLabel}`, col: '#0F172A' },
        { k: 'Радиус R от оси зоны:', v: `R = ${(activeFA.dist * 236).toFixed(0)} мм (R/R₀ = ${(activeFA.dist / Math.sqrt(43)).toFixed(2)})`, col: '#0F172A' }
      ]
    },
    {
      title: '[ПРИВОД ШЭМ-3]',
      rows: [
        { k: 'Номер группы СУЗ:', v: activeFA.bank !== null ? `Группа №${activeFA.bank}${activeFA.bank === WORKING_BANK ? ' (Рабочая АРМ)' : ''}` : 'Без привода СУЗ (bank: null)', col: '#0F172A' },
        { k: 'Статус погружения:', v: activeFA.bank !== null ? `${activeRod.depthCm.toFixed(1)} см (${activeRod.depthPct.toFixed(1)}%)` : '0.0 см (ПС СУЗ отсутствует)', col: '#0F172A' },
        { k: 'Высота от низа зоны:', v: activeFA.bank !== null ? `${activeRod.heightCm.toFixed(1)} см (Н=${activeRod.heightPct.toFixed(1)}%)` : '373.0 см (100%)', col: '#0F172A' }
      ]
    },
    {
      title: '[НЕЙТРОННО-ТЕПЛОВАЯ ФИЗИКА]',
      rows: [
        { k: 'Коэффициент Kq:', v: `${activeFA.currentKq.toFixed(3)} отн. ед.`, col: kqColor },
        { k: 'Тепловая мощность ТВС:', v: `${activeFA.powerMW.toFixed(2)} МВт`, col: '#0F172A' },
        { k: 'Подогрев теплоносителя ΔT:', v: `+${activeFA.deltaT.toFixed(1)} °C (вых. ${activeFA.outletTemp.toFixed(1)} °C)`, col: '#0F172A' }
      ]
    },
    {
      title: '[ПРЕДЕЛЫ БЕЗОПАСНОСТИ]',
      rows: [
        { k: 'Запас до кризиса DNBR:', v: `${activeFA.dnbr.toFixed(2)}`, col: dnbrColor },
        { k: 'Статус запаса DNBR:', v: activeFA.dnbr >= 1.30 ? 'В норме (DNBR ≥ 1.30)' : 'ВНИМАНИЕ! DNBR < 1.30', col: dnbrColor },
        { k: 'Температура оболочки Tоб:', v: `${activeFA.cladTempC.toFixed(1)} °C (Э110)`, col: cladColor }
      ]
    }
  ];

  let sy = py + 86;
  const secH = 96;
  const secGap = 7;

  sections.forEach(sec => {
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px + 16, sy, pw - 32, secH, 6);
    ctx.fill();
    ctx.stroke();

    // Левый акцентный синий штрих
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(px + 16, sy, 3, secH);

    // Заголовок секции: чистый синий #0284C7
    ctx.fillStyle = '#0284C7';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(sec.title, px + 26, sy + 17);

    // 3 строки данных:
    let ry = sy + 35;
    sec.rows.forEach(r => {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 10.5px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(r.k, px + 26, ry);

      ctx.fillStyle = r.col;
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(r.v, px + pw - 26, ry);

      ry += 20;
    });

    sy += secH + secGap;
  });

  // --------------------------------------------------------------------------
  // 4.8. ВИЗУАЛЬНАЯ ШКАЛА ПОГРУЖЕНИЯ СТЕРЖНЯ СУЗ В АКТИВНУЮ ЗОНУ (ВНИЗУ ПАНЕЛИ)
  // --------------------------------------------------------------------------
  const barBoxY = sy + 3;
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
    ctx.fillStyle = activeFA.bank === WORKING_BANK ? 'rgba(2, 132, 199, 0.35)' : 'rgba(2, 132, 199, 0.25)';
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
  const workingPos = typeof s.group10Pos === 'number' ? s.group10Pos : 72.4;
  const g19Val = typeof s.groups1to9Pos === 'number' ? s.groups1to9Pos : 100.0;
  [
    'СВОДКА ПО РЕАКТОРУ В-491:',
    `Рабочая группа №${WORKING_BANK}: Н=${workingPos.toFixed(1)}% (${(workingPos * 3.73).toFixed(0)} см от низа АЗ)`,
    `Группы АЗ №1–11: Н=${g19Val.toFixed(1)}%`
  ].forEach((line, idx) => {
    ctx.fillText(line, px + 26, trackY + 36 + idx * 18);
  });

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
  window.selectedBank = selectedBank;
  window.toggleBankSelection = toggleBankSelection;
}
