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
  0:  { fill: '#F1F5F9', text: '#0F172A', stroke: '#C4C4C4', name: 'Без ПС СУЗ' },
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
// 'kq'   — «Тепловыделение Kq» (по умолчанию); флажок coreShowYear добавляет год загрузки 1..4
// 'rods' — «Органы СУЗ»: группы АЗ 1–11, рабочая группа №12, положение Н
var coreLayerMode = 'kq';
var coreShowYear = false;
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
  if (typeof window !== 'undefined' && window.sound && typeof window.sound.click === 'function') {
    window.sound.click(640);
  }
  if (typeof window !== 'undefined' && typeof window.renderCanvas === 'function') {
    window.renderCanvas(0.016);
  }
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
        outletTemp: 329.7,
        deltaT: 31.1,
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
    a.deltaT = 31.1 * exactKq;
    a.outletTemp = 298.6 + a.deltaT;
  });

  if (typeof sim !== 'undefined') {
    const avgB = coreAssemblies.reduce((acc, a) => acc + (a.burnupMWd || 0), 0) / coreAssemblies.length;
    sim.avgBurnupGWdT = Number(avgB.toFixed(2));
    sim.kqMax = Math.max(...coreAssemblies.map(a => a.currentKq));
    if (!sim.selectedAssemblyId || sim.selectedAssemblyId < 1 || sim.selectedAssemblyId > 163) {
      sim.selectedAssemblyId = 82;
    }
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
  const inletT = s && typeof s.coreInletTempC === 'number' ? s.coreInletTempC : 298.6;
  const outletT = s && typeof s.coreOutletTempC === 'number' ? s.coreOutletTempC : 329.7;
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

// Слой «Органы СУЗ»: цвет кассеты — принадлежность к группе ОР СУЗ (Slate Light)
// Карточка уровня 1 на холсте: белая заливка, рамка #C4C4C4 и мягкая тень (как box-shadow в CSS)
function drawSurfaceCard(context, x, y, w, h, fill) {
  context.save();
  context.shadowColor = 'rgba(15, 23, 42, 0.10)';
  context.shadowBlur = 4;
  context.shadowOffsetY = 1;
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(x, y, w, h, 8);
  context.fill();
  context.restore();
  context.strokeStyle = '#C4C4C4';
  context.lineWidth = 1.2;
  context.beginPath();
  context.roundRect(x, y, w, h, 8);
  context.stroke();
}

function getRodLayerStyle(assembly) {
  if (!assembly.bank) {
    return { fill: '#F1F5F9', text: '#64748B', stroke: '#E2E8F0' };    // ТВС без ОР СУЗ
  }
  if (assembly.bank === WORKING_BANK) {
    return { fill: '#D97706', text: '#0F172A', stroke: '#B45309' };    // Рабочая группа №12
  }
  return { fill: '#0284C7', text: '#FFFFFF', stroke: '#0369A1' };      // Группы АЗ №1–11
}

// Столбик положения ОР СУЗ в ячейке: низ зоны внизу, тёмная часть — стержень, введённый сверху до отметки Н
function drawRodPositionBar(context, x, yTop, height, heightPct, color) {
  const w = 3.2;
  context.fillStyle = '#FFFFFF';
  context.fillRect(x, yTop, w, height);
  const inserted = height * (1.0 - Math.max(0, Math.min(100, heightPct)) / 100.0);
  if (inserted > 0.3) {
    context.fillStyle = color;
    context.fillRect(x, yTop, w, inserted);
  }
  context.strokeStyle = color;
  context.lineWidth = 0.6;
  context.strokeRect(x, yTop, w, height);
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
  // Старые имена слоёв ('banks', 'insertion', 'fuel') сводятся к двум режимам
  const map = { kq: 'kq', fuel: 'kq', rods: 'rods', banks: 'rods', insertion: 'rods' };
  if (!map[mode]) return;
  coreLayerMode = map[mode];
  if (mode === 'fuel') coreShowYear = true;
  if (typeof window !== 'undefined') {
    window.coreLayerMode = coreLayerMode;
    if (typeof window.renderCanvas === 'function') window.renderCanvas(0.016);
  }
}

function toggleCoreYearLabels() {
  coreShowYear = !coreShowYear;
  if (typeof window !== 'undefined' && typeof window.renderCanvas === 'function') {
    window.renderCanvas(0.016);
  }
}

// Подписи паспорта ТВС: общие для холста и скрытого DOM-дубля
function getAssemblyPassport(a, rodState) {
  const kq = a.currentKq;
  const bankText = a.bank
    ? (a.bank === WORKING_BANK ? '№12 (рабочая, АРМ)' : `№${a.bank} (аварийная защита)`)
    : 'нет ОР СУЗ в этой ТВС';
  const posText = a.bank
    ? `${rodState.heightCm.toFixed(0)} см (${rodState.heightPct.toFixed(1)} %)`
    : '—';
  return {
    badge: a.bank ? (a.bank === WORKING_BANK ? 'РАБОЧАЯ ГРУППА №12' : `ГРУППА АЗ №${a.bank}`) : 'БЕЗ ОР СУЗ',
    sections: [
      {
        title: 'Положение и загрузка',
        rows: [
          { k: 'Тип ТВС, год работы', v: `${a.fuelType}, ${a.campaignYear}-й год` },
          { k: 'Выгорание', v: `${a.burnupMWd.toFixed(1)} МВт·сут/кгU` },
          { k: 'Ячейка решётки', v: `ряд ${String(a.coordLabel).split(' (')[0]}` },
          { k: 'Расстояние от оси зоны', v: `${(a.dist * 236).toFixed(0)} мм` }
        ]
      },
      {
        title: 'ОР СУЗ (привод ШЭМ-3)',
        rows: [
          { k: 'Группа', v: bankText },
          { k: 'Положение Н от низа зоны', v: posText }
        ]
      },
      {
        title: 'Тепловыделение',
        rows: [
          { k: 'Kq по ТВС', v: kq.toFixed(3), col: kq >= 1.24 ? '#E11D48' : (kq >= 1.15 ? '#D97706' : '#0284C7') },
          { k: 'Мощность ТВС', v: `${a.powerMW.toFixed(2)} МВт` },
          { k: 'Подогрев / T на выходе', v: `+${a.deltaT.toFixed(1)} / ${a.outletTemp.toFixed(1)} °C` }
        ]
      },
      {
        title: 'Пределы безопасности (модель)',
        rows: [
          { k: 'Kзк (DNBR), допуск ≥ 1.30', v: a.dnbr.toFixed(2), col: a.dnbr >= 1.30 ? '#16A34A' : '#DC2626' },
          { k: 'T оболочки твэла (Э110)', v: `${a.cladTempC.toFixed(1)} °C`, col: getCladStatusColor(a) }
        ]
      }
    ]
  };
}

// Синхронизация DOM-контейнера #coreInfoPanel (скрытый дубль паспорта для инспекции и автотестов)
function syncCoreInfoPanelDOM(activeAssembly, rodState) {
  if (typeof document === 'undefined' || !activeAssembly) return;
  let panel = document.getElementById('coreInfoPanel');
  if (!panel) {
    const host = document.getElementById('canvasContainer') || document.body;
    panel = document.createElement('aside');
    panel.id = 'coreInfoPanel';
    panel.className = 'core-info-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'position:absolute;right:12px;top:52px;width:320px;background:#FFFFFF;border:1px solid #C4C4C4;border-radius:8px;color:#0F172A;pointer-events:none;opacity:0;z-index:-1;';
    host.appendChild(panel);
  }
  const passport = getAssemblyPassport(activeAssembly, rodState);
  panel.dataset.assemblyId = String(activeAssembly.id);
  panel.dataset.bank = activeAssembly.bank !== null ? String(activeAssembly.bank) : 'null';
  panel.innerHTML =
    `<div class="cip-header">` +
      `<div class="cip-title">Паспорт ТВС: ТВС-2М №${activeAssembly.id}</div>` +
      `<div class="cip-badge">${passport.badge}</div>` +
    `</div>` +
    passport.sections.map(sec =>
      `<div class="cip-section"><div class="cip-section-title">${sec.title}</div>` +
      sec.rows.map(r => `<div class="cip-row"><span>${r.k}:</span><b>${r.v}</b></div>`).join('') +
      `</div>`
    ).join('');
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
  ctx.fillStyle = '#DDDDDD'; // уровень 0: нейтральная серая подложка
  ctx.fillRect(0, 0, 1160, 720);
  drawSurfaceCard(ctx, 18, 60, 748, 596, '#FFFFFF'); // уровень 1: карточка картограммы

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
  drawSurfaceCard(ctx, 18, 12, 748, 44, '#FFFFFF');

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 12.5px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('КАРТОГРАММА АКТИВНОЙ ЗОНЫ ВВЭР-1200', 30, 31);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.fillText('163 ТВС-2М • 121 ПС СУЗ • 12 групп', 30, 47);

  // Переключатель двух слоёв картограммы
  const layerButtons = [
    { id: 'kq', label: 'Тепловыделение Kq', x: 466, w: 152 },
    { id: 'rods', label: 'Органы СУЗ', x: 624, w: 132 }
  ];

  layerButtons.forEach(btn => {
    const isActive = coreLayerMode === btn.id;
    ctx.fillStyle = isActive ? 'rgba(2, 132, 199, 0.12)' : '#FFFFFF';
    ctx.strokeStyle = isActive ? '#0284C7' : '#C4C4C4';
    ctx.lineWidth = isActive ? 1.5 : 1.0;
    ctx.beginPath();
    ctx.roundRect(btn.x, 19, btn.w, 30, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isActive ? '#0284C7' : '#475569';
    ctx.font = (isActive ? '700 ' : '600 ') + '11px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, 34);
    ctx.textBaseline = 'alphabetic';

    if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
      activeHotspots.push({
        x: btn.x,
        y: 19,
        w: btn.w,
        h: 30,
        title: `Режим картограммы: ${btn.label}`,
        sub: 'Отображение 163 ТВС-2М',
        desc: btn.id === 'kq'
          ? 'Цвет кассеты — коэффициент неравномерности энерговыделения по ТВС (Kq).'
          : 'Цвет кассеты — группа ОР СУЗ; столбик в ячейке — положение Н от низа зоны.',
        simple: 'Два режима: где в зоне выделяется больше тепла и где стоят органы регулирования.',
        telemetry: () => (coreLayerMode === btn.id ? 'ВКЛЮЧЁН' : 'НЕ АКТИВЕН'),
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
  const keyRods = coreLayerMode === 'rods';
  drawPointyHexPath(ctx, keyX, keyY, keyR);
  ctx.fillStyle = keyRods ? '#0284C7' : '#E2E8F0';
  ctx.fill();
  ctx.strokeStyle = keyRods ? '#0369A1' : '#64748B';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const keyShift = keyRods ? -3 : 0;
  ctx.fillStyle = keyRods ? '#FFFFFF' : '#0F172A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 10.5px "JetBrains Mono", monospace';
  ctx.fillText('82', keyX + keyShift, keyY - 6);
  ctx.font = '600 9px "JetBrains Mono", monospace';
  ctx.fillText(keyRods ? '11' : '0.92', keyX + keyShift, keyY + 7);
  if (keyRods) {
    drawRodPositionBar(ctx, keyX + 11, keyY - 10, 20, 72.4, '#0F172A');
  } else if (coreShowYear) {
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.fillText('4', keyX + 14, keyY - 6);
  }

  const keyLines = keyRods
    ? ['— номер ТВС (1..163)', '— номер группы СУЗ (1..12)', '— столбик: введённая часть ОР СУЗ']
    : ['— номер ТВС (1..163)', '— Kq кассеты'].concat(coreShowYear ? ['— год загрузки (1..4)'] : []);
  ctx.textAlign = 'left';
  ctx.font = '600 10.5px "Inter", "Segoe UI", sans-serif';
  keyLines.forEach((line, idx) => {
    ctx.fillStyle = idx === 0 ? '#0F172A' : '#475569';
    ctx.fillText(line, keyX + 28, keyY - 6 + idx * 14);
  });
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

    if (coreLayerMode === 'rods') {
      // Слой «Органы СУЗ»: группы АЗ 1–11 — синие, рабочая №12 — янтарная, без ОР СУЗ — серые
      const isSelectedGroup = (selectedBank !== null && a.bank === selectedBank);
      if (selectedBank !== null && !isSelectedGroup) {
        ctx.globalAlpha = 0.3;
      }
      const cellStyle = getRodLayerStyle(a);
      drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
      ctx.fillStyle = cellStyle.fill;
      ctx.fill();
      ctx.strokeStyle = (isSelected || isHovered) ? '#0F172A' : cellStyle.stroke;
      ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.0;
      ctx.stroke();

      ctx.fillStyle = cellStyle.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (a.bank) {
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.fillText(String(a.id), pos.x - 3, pos.y - 5.0);
        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.fillText(String(a.bank), pos.x - 3, pos.y + 6.0);
        drawRodPositionBar(ctx, pos.x + 10.5, pos.y - 9, 18, rodState.heightPct, '#0F172A');
      } else {
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillText(String(a.id), pos.x, pos.y);
      }
    } else {
      // Слой «Тепловыделение Kq»
      const cellStyle = getKqLayerStyle(a.currentKq);
      drawPointyHexPath(ctx, pos.x, pos.y, hexR - 0.6);
      ctx.fillStyle = cellStyle.fill;
      ctx.fill();
      ctx.strokeStyle = (isSelected || isHovered) ? '#0F172A' : (cellStyle.stroke || '#C4C4C4');
      ctx.lineWidth = (isSelected || isHovered) ? 2.4 : 1.0;
      ctx.stroke();

      // Номер кассеты и значение Kq под ним
      ctx.fillStyle = cellStyle.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText(String(a.id), pos.x, pos.y - 5.5);
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(a.currentKq.toFixed(2), pos.x, pos.y + 6.5);

      // Флажок «Подпись: год загрузки» — маленькая цифра 1..4 в правом углу ячейки
      if (coreShowYear) {
        ctx.font = '700 7.5px "JetBrains Mono", monospace';
        ctx.fillText(String(a.campaignYear), pos.x + 13, pos.y - 5.0);
      }
    }

    ctx.restore();

    // Регистрация хитбокса ТВС для наведения и клика
    if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
      const bankLabel = a.bank ? `группа СУЗ №${a.bank}` : 'без ОР СУЗ';
      activeHotspots.push({
        x: pos.x,
        y: pos.y,
        r: hexR * 0.9,
        assemblyId: a.id,
        title: `ТВС-2М №${a.id} (${bankLabel})`,
        sub: `Ячейка: ряд ${String(a.coordLabel).split(' (')[0]} • ${a.fuelType}, ${a.campaignYear}-й год • ${a.enrichment.toFixed(2)} % U-235`,
        desc: a.bank
          ? `ТВС-2М с 18 направляющими каналами для ОР СУЗ (группа №${a.bank}). Положение ОР СУЗ: Н = ${rodState.heightCm.toFixed(0)} см от низа зоны (${rodState.heightPct.toFixed(1)} %).`
          : 'ТВС-2М без органа регулирования СУЗ.',
        simple: 'Каждая шестигранная кассета ТВС-2М содержит 312 твэлов с таблетками диоксида урана UO₂.',
        telemetry: () =>
          `Kq: ${a.currentKq.toFixed(3)} | ΔT: +${a.deltaT.toFixed(1)} °C | Kзк (DNBR): ${a.dnbr.toFixed(2)} | Tоб: ${a.cladTempC.toFixed(1)} °C`
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4.6. НИЖНЯЯ ЛЕГЕНДА СЛОЯ ПОД КАРТОГРАММОЙ (белая карточка, рамка #C4C4C4, тень)
  // --------------------------------------------------------------------------
  ctx.save();
  drawSurfaceCard(ctx, 18, 662, 748, 44, '#FFFFFF');

  const legendChip = (x, w, fill, stroke, textCol, label, strokeW) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeW || 1;
    ctx.beginPath();
    ctx.roundRect(x, 672, w, 24, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = textCol;
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, 684.5);
  };
  const legendLabel = (text, x) => {
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 10px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, 684.5);
  };

  if (coreLayerMode === 'kq') {
    legendLabel('Kq:', 30);
    [
      { lbl: '< 0.86', kq: 0.80 },
      { lbl: '0.86–1.14', kq: 1.00 },
      { lbl: '1.15–1.23', kq: 1.20 },
      { lbl: '≥ 1.24', kq: 1.30 }
    ].forEach((st, idx) => {
      const style = getKqLayerStyle(st.kq);
      legendChip(56 + idx * 92, 88, style.fill, style.stroke, style.text, st.lbl);
    });

    // Флажок «Подпись: год загрузки»
    const cbX = 566;
    ctx.fillStyle = coreShowYear ? '#0284C7' : '#FFFFFF';
    ctx.strokeStyle = coreShowYear ? '#0369A1' : '#94A3B8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cbX, 677, 14, 14, 3);
    ctx.fill();
    ctx.stroke();
    if (coreShowYear) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cbX + 3.5, 684);
      ctx.lineTo(cbX + 6.2, 687);
      ctx.lineTo(cbX + 10.8, 680.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#0F172A';
    ctx.font = '600 10.5px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Подпись: год загрузки', cbX + 21, 684.5);
    if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
      activeHotspots.push({
        x: cbX - 4,
        y: 672,
        w: 196,
        h: 24,
        title: 'Подпись: год загрузки',
        sub: '4-годичная топливная загрузка: 42 + 42 + 42 + 37 ТВС',
        desc: 'Добавляет в угол каждой кассеты год её работы в зоне (1..4).',
        simple: 'Свежее топливо (1-й год) обычно даёт больше тепла, выгоревшее (4-й год) — меньше.',
        telemetry: () => (coreShowYear ? 'ПОДПИСИ ВКЛЮЧЕНЫ' : 'ПОДПИСИ ВЫКЛЮЧЕНЫ'),
        onClick: () => toggleCoreYearLabels()
      });
    }
  } else {
    legendLabel('Группа:', 30);
    const chips = [];
    for (let b = 1; b <= 11; b++) chips.push({ b, x: 78 + (b - 1) * 31, w: 28, label: String(b) });
    chips.push({ b: WORKING_BANK, x: 78 + 11 * 31, w: 92, label: '12 рабочая' });
    chips.forEach(ch => {
      const style = getRodLayerStyle({ bank: ch.b });
      const isSel = selectedBank === ch.b;
      ctx.save();
      if (selectedBank !== null && !isSel) ctx.globalAlpha = 0.35;
      legendChip(ch.x, ch.w, style.fill, isSel ? '#0F172A' : style.stroke, style.text, ch.label, isSel ? 2 : 1);
      ctx.restore();
      if (typeof activeHotspots !== 'undefined' && Array.isArray(activeHotspots)) {
        activeHotspots.push({
          x: ch.x,
          y: 672,
          w: ch.w,
          h: 24,
          bankId: ch.b,
          title: ch.b === WORKING_BANK ? 'Группа СУЗ №12 (рабочая)' : `Группа СУЗ №${ch.b} (аварийная защита)`,
          sub: ch.b === WORKING_BANK ? 'Регулирующая группа, управляется АРМ' : 'Стержни АЗ на верхнем концевике',
          desc: isSel ? 'Повторный щелчок снимает подсветку' : `Щёлкните, чтобы подсветить кассеты группы №${ch.b}`,
          simple: 'Подсветка кассет выбранной группы на картограмме.',
          telemetry: () => (selectedBank === ch.b ? 'ВЫБРАНА' : 'НЕ ВЫБРАНА'),
          onClick: () => toggleBankSelection(ch.b)
        });
      }
    });
    const noneX = 78 + 11 * 31 + 98;
    const noneStyle = getRodLayerStyle({ bank: null });
    legendChip(noneX, 84, noneStyle.fill, '#C4C4C4', '#475569', 'без ОР СУЗ');

    // Пояснение к столбику положения
    const noteX = noneX + 94;
    drawRodPositionBar(ctx, noteX, 675, 18, 60, '#0F172A');
    ctx.fillStyle = '#475569';
    ctx.font = '500 10px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('введённая часть ОР', noteX + 9, 684.5);
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // 4.7. БОКОВАЯ ИНФО-ПАНЕЛЬ ТЕЛЕМЕТРИИ ТВС (#coreInfoPanel) СПРАВА
  // --------------------------------------------------------------------------
  const activeId = hoveredId !== null ? hoveredId : selectedId;
  const activeFA = coreAssemblies.find(item => item.id === activeId) || coreAssemblies[81] || coreAssemblies[0];
  const activeRod = getAssemblyRodState(activeFA, s);

  syncCoreInfoPanelDOM(activeFA, activeRod);
  const passport = getAssemblyPassport(activeFA, activeRod);

  const px = 782;
  const py = 12;
  const pw = 360;
  const ph = 694;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  drawSurfaceCard(ctx, px, py, pw, ph, '#FFFFFF');

  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, 4, [8, 8, 0, 0]);
  ctx.fill();

  // Заголовок паспорта
  ctx.fillStyle = '#64748B';
  ctx.font = '700 10px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ПАСПОРТ ТВС', px + 16, py + 24);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(`ТВС-2М №${activeFA.id}`, px + 16, py + 46);

  // Бейдж группы ОР СУЗ в цветах слоя «Органы СУЗ»
  const badgeStyle = activeFA.bank ? getRodLayerStyle(activeFA) : { fill: '#F1F5F9', text: '#475569', stroke: '#C4C4C4' };
  const badgeW = 150;
  const badgeX = px + pw - badgeW - 16;
  const badgeY = py + 22;
  ctx.fillStyle = badgeStyle.fill;
  ctx.strokeStyle = badgeStyle.stroke;
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, 26, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = badgeStyle.text;
  ctx.font = '700 10px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(passport.badge, badgeX + badgeW / 2, badgeY + 13);
  ctx.textBaseline = 'alphabetic';

  // Состояние выбора
  ctx.textAlign = 'left';
  ctx.fillStyle = hoveredId !== null ? '#0284C7' : '#64748B';
  ctx.font = '500 10px "Inter", "Segoe UI", sans-serif';
  ctx.fillText(
    hoveredId !== null
      ? 'Наведение: щелчок закрепит эту ТВС'
      : 'Закреплена. Щёлкните другую кассету, чтобы сменить',
    px + 16,
    py + 66
  );

  ctx.strokeStyle = '#C4C4C4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + 16, py + 76);
  ctx.lineTo(px + pw - 16, py + 76);
  ctx.stroke();

  // Секции паспорта: заголовок 20 px, строка 18 px
  let sy = py + 86;
  const rowH = 18;
  const secGap = 6;
  passport.sections.forEach(sec => {
    const secH = 26 + sec.rows.length * rowH;
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#C4C4C4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px + 16, sy, pw - 32, secH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(px + 16, sy, 3, secH);

    ctx.fillStyle = '#0369A1';
    ctx.font = '700 10.5px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sec.title, px + 26, sy + 16);

    let ry = sy + 34;
    sec.rows.forEach(r => {
      ctx.fillStyle = '#64748B';
      ctx.font = '500 10.5px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(r.k, px + 26, ry);
      ctx.fillStyle = r.col || '#0F172A';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(r.v, px + pw - 26, ry);
      ry += rowH;
    });
    sy += secH + secGap;
  });

  // Положение ОР СУЗ в кассете: шкала от низа зоны (слева) до верха (справа)
  const rodBoxY = sy;
  const rodBoxH = 64;
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#C4C4C4';
  ctx.beginPath();
  ctx.roundRect(px + 16, rodBoxY, pw - 32, rodBoxH, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0369A1';
  ctx.font = '700 10.5px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ОР СУЗ в кассете (высота зоны 373 см)', px + 26, rodBoxY + 16);

  const trackX = px + 26;
  const trackY = rodBoxY + 24;
  const trackW = pw - 52;
  const trackH = 14;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#C4C4C4';
  ctx.beginPath();
  ctx.roundRect(trackX, trackY, trackW, trackH, 3);
  ctx.fill();
  ctx.stroke();
  if (activeFA.bank) {
    const tipX = trackX + trackW * activeRod.heightPct / 100.0;
    if (tipX < trackX + trackW - 0.5) {
      ctx.fillStyle = getRodLayerStyle(activeFA).fill;
      ctx.fillRect(tipX, trackY + 1, trackX + trackW - tipX - 1, trackH - 2);
    }
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tipX, trackY - 3);
    ctx.lineTo(tipX, trackY + trackH + 3);
    ctx.stroke();
  }
  ctx.fillStyle = '#64748B';
  ctx.font = '500 9.5px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('низ зоны', trackX, trackY + trackH + 13);
  ctx.textAlign = 'right';
  ctx.fillText('верх зоны', trackX + trackW, trackY + trackH + 13);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 9.5px "JetBrains Mono", monospace';
  ctx.fillText(
    activeFA.bank
      ? `Н = ${activeRod.heightCm.toFixed(0)} см, введено ${activeRod.depthCm.toFixed(0)} см`
      : 'в этой ТВС нет ОР СУЗ',
    trackX + trackW / 2,
    trackY + trackH + 13
  );

  // Состояние зоны — у нижнего края панели
  const workingPos = typeof s.group10Pos === 'number' ? s.group10Pos : 72.4;
  const g19Val = typeof s.groups1to9Pos === 'number' ? s.groups1to9Pos : 100.0;
  const avgBurn = typeof s.avgBurnupGWdT === 'number' ? s.avgBurnupGWdT : 24.42;
  const bConc = typeof s.boronConc === 'number' ? s.boronConc : 6.20;
  const kqMaxVal = typeof s.kqMax === 'number' ? s.kqMax : 1.27;
  const zoneLines = [
    `Kq max = ${kqMaxVal.toFixed(2)} · H₃BO₃ = ${bConc.toFixed(2)} г/кг`,
    `Выгорание ${avgBurn.toFixed(1)} ГВт·сут/т · ${(s.operationalDays || 0).toFixed(1)} эфф. сут`,
    `Гр. 12: Н = ${(workingPos * 3.73).toFixed(0)} см · гр. 1–11: Н = ${(g19Val * 3.73).toFixed(0)} см`
  ];
  const zoneH = 24 + zoneLines.length * 16;
  const zoneY = Math.max(rodBoxY + rodBoxH + secGap, py + ph - 12 - zoneH);
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#C4C4C4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px + 16, zoneY, pw - 32, zoneH, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0369A1';
  ctx.font = '700 10.5px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Состояние зоны', px + 26, zoneY + 16);
  ctx.fillStyle = '#334155';
  ctx.font = '500 9.5px "JetBrains Mono", monospace';
  zoneLines.forEach((line, idx) => {
    ctx.fillText(line, px + 26, zoneY + 33 + idx * 16);
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
  window.toggleCoreYearLabels = toggleCoreYearLabels;
  window.selectedBank = selectedBank;
  window.toggleBankSelection = toggleBankSelection;
  window.updateAssemblyTelemetry = updateAssemblyTelemetry;
  window.getAssemblyRodState = getAssemblyRodState;
  window.syncCoreInfoPanelDOM = syncCoreInfoPanelDOM;
}
