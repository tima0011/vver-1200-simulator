/**
 * ============================================================================
 * ReactorLab // Физико-математическое ядро ВВЭР-1200 (physics_engine.js)
 * Цифровой двойник реакторной установки В-491 (ЛАЭС-2) Поколения III+
 * ============================================================================
 * Модуль объединяет:
 *  - Фундаментальные константы ядерной физики (6 групп запаздывающих нейтронов, ксенон);
 *  - Динамику точечной кинетики нейтронов с учетом предшественников;
 *  - Температурные и мощностные обратные связи (Доплер, плотность теплоносителя, бор);
 *  - Нестационарное отравление ксеноном-135 и кинетику йодной ямы;
 *  - Теплогидравлику 4 петель ГЦК и парогенераторов ПГВ-1000МКП (T_нас по IAPWS-IF97);
 *  - Модель компенсатора давления (КД) и систем пассивной безопасности (САОЗ, СПОТ);
 *  - Пошаговое численное интегрирование stepPhysics(dtReal) при 60 FPS.
 */

// ============================================================================
// 1. КОНСТАНТЫ ЯДЕРНОЙ ФИЗИКИ И ТЕПЛОГИДРАВЛИКИ
// ============================================================================
const NUCLEAR_CONSTANTS = {
  // Эффективная доля запаздывающих нейтронов и время жизни мгновенных нейтронов
  BETA_EFF: 0.0065,              // β_эфф = 650 pcm (0.65%) для активной зоны ВВЭР-1200
  LAMBDA_PROMPT: 3.5e-5,          // Λ = 35 мкс — время генерации мгновенных нейтронов в H2O

  // Параметры 6 групп ядер-предшественников запаздывающих нейтронов (U-235)
  DELAYED_GROUPS: [
    { group: 1, beta: 0.000215, lambda: 0.0124, halfLife: 55.72, nuclide: "Br-87" },
    { group: 2, beta: 0.001424, lambda: 0.0305, halfLife: 22.72, nuclide: "I-137" },
    { group: 3, beta: 0.001274, lambda: 0.1110, halfLife: 6.22,  nuclide: "I-138" },
    { group: 4, beta: 0.002568, lambda: 0.3010, halfLife: 2.30,  nuclide: "Br-89" },
    { group: 5, beta: 0.000748, lambda: 1.1400, halfLife: 0.61,  nuclide: "Rb-91" },
    { group: 6, beta: 0.000271, lambda: 3.0100, halfLife: 0.23,  nuclide: "As-85" }
  ],

  // Нестационарное отравление Ксеноном-135 и Йодом-135
  XENON_CONSTANTS: {
    SIGMA_XE: 2.65e6,            // Микросечение радиационного захвата Xe-135 (барн)
    YIELD_IODINE: 0.061,         // γ_I = 6.1% — кумулятивный выход I-135 при делении U-235
    YIELD_XENON: 0.0028,         // γ_Xe = 0.28% — прямой выход Xe-135 при делении
    LAMBDA_IODINE: 2.93e-5,      // λ_I = ln2 / T_1/2, T_1/2 = 6.57 ч
    LAMBDA_XENON: 2.11e-5,       // λ_Xe = ln2 / T_1/2, T_1/2 = 9.14 ч
    BURNUP_RATIO: 2.57,          // σ_Xe·Φ₀ / λ_Xe на номинале (Φ₀ ≈ 2·10¹³ н/см²·с)
    NOMINAL_POISONING_PCM: 2850  // Стационарное отравление на 100% мощности (pcm)
  },

  // Температурные и мощностные коэффициенты реактивности
  FEEDBACKS: {
    ALPHA_DOPPLER: -2.8,         // α_D = -2.8 pcm/°C (температурный коэффициент топлива)
    ALPHA_MODERATOR: -34.0,      // α_mod = -34.0 pcm/°C (температурный коэффициент теплоносителя)
    ALPHA_BORON: -1400.0,        // α_B ≈ -8 pcm/ppm B (1 г/кг H3BO3 = 175 ppm B); оценка модели
    // Имена G10/G19 и sim.group10Pos/groups1to9Pos исторические: это группа №12 и группы №1–11. На экран не выводить.
    // Эффективность принята линейной по ходу (реальная интегральная кривая S-образная), оценка модели (◇).
    ROD_WORTH_G10: 9.5,          // Дифференциальная эффективность рабочей группы №12 (pcm/%)
    ROD_WORTH_G19: 65.0,         // Дифференциальная эффективность аварийных групп №1-11 (pcm/%)
    XENON_WORTH_FACTOR: 2850.0   // Вес равновесного ксенона, pcm (ρ_Xe = -2850 pcm при Xe/Xe₀ = 1)
  },

  // Номинальные параметры энергоблока ВВЭР-1200 (В-491)
  NOMINAL: {
    THERMAL_POWER_MW: 3200.0,
    ELECTRIC_POWER_MW: 1200.0,
    PRIMARY_PRESSURE_MPA: 16.20,
    CORE_INLET_TEMP_C: 298.6,     // Поваров и др. 2025, табл. 2.3 (В-491, ЛАЭС-2)
    CORE_OUTLET_TEMP_C: 329.7,
    FUEL_TEMP_C: 680.0,
    STEAM_HEADER_PRESSURE_MPA: 7.00,
    BORON_CONC_G_KG: 6.20,
    GROUP10_POS_PCT: 72.4,
    GROUPS1TO9_POS_PCT: 100.0
  },

  // Остаточное тепловыделение: подгонка кривой Вэя-Вигнера суммой экспонент
  DECAY_HEAT: {
    NOMINAL_MW: 215.0,           // 6.7% Nном на установившейся мощности
    FISSION_NOMINAL_MW: 2985.0,  // Мгновенная часть мощности при Φ = 1
    FRACTIONS: [0.39621, 0.24574, 0.13167, 0.11105, 0.03148, 0.08385],
    LAMBDAS: [0.35, 0.03, 0.003, 0.0003, 0.00003, 0.000002]
  },

  // Парогенератор: ε₀ задаёт T_хол = 298.6 °C при T_гор = 329.7 °C и P₂ = 7.0 МПа
  STEAM_GEN: {
    TSAT_NOMINAL_C: 285.83,
    NTU_NOMINAL: 1.2341,
    LEVEL_NOMINAL_M: 2.70,       // Номинальный уровень в ПГВ-1000МКП 2,70 ± 0,05 м (razdel-2, табл. 2.1.1)
    THERMAL_CAPACITY_MJ_PER_K: 5000.0 // Теплоноситель, вода ПГ и металл контуров, оценка
  },

  // Паросброс 2-го контура по [ТЦ] с. 15–17. Мощность сброса считается по расходу пара:
  // номинал 3200 МВт ↔ 6408 т/ч, т. е. 0,4994 МВт на 1 т/ч (энтальпия пара минус питательной воды)
  STEAM_DUMP: {
    MW_PER_TPH: 3200.0 / 6408.0,
    PROP_BAND_MPA: 0.4,          // зона пропорционального регулирования клапана (◇)
    BRU_K: { OPEN: 7.3, CLOSE: 6.8, SET: 6.9, CAP_TPH: 8 * 510 },   // 8 × 510 т/ч, в конденсатор
    BRU_A: { OPEN: 7.7, CLOSE: 6.95, SET: 7.3, CAP_TPH: 4 * 1000 }, // 4 × 1000 т/ч, в атмосферу
    IPU_1: { OPEN: 8.7, CLOSE: 7.85, CAP_TPH: 4 * 1050 },           // 1-я ступень ИПУ ПГ (по одному на ПГ)
    IPU_2: { OPEN: 8.9, CLOSE: 7.85, CAP_TPH: 4 * 1050 },           // 2-я ступень ИПУ ПГ
    P2_MAX_MPA: 9.6
  },

  // Течь 1-го контура (LOCA). Объёмы — [ARIS] табл. 3, [Р9]; уставки САОЗ — PROJECT_MAP 3.3.
  // Значения с пометкой ◇ — оценки модели, в источниках по В-491 не найдены.
  LOCA: {
    LOOPS_VOLUME_M3: 290.0,      // теплоноситель 1-го контура без КД, [ARIS] табл. 3
    RHO_NOMINAL: 705.0,          // кг/м³ при 16,2 МПа и 314 °C (IAPWS-IF97)
    KD_AREA_M2: 55.0 / 8.17,     // сечение КД из объёма воды 55 м³ при уровне 8,17 м (◇)
    KD_STEAM_M3_NOMINAL: 79.0 - 55.0,
    KD_EMPTY_M: 0.5,             // уровень, ниже которого паровая подушка КД потеряна (◇)
    PRIMARY_VOLUME_M3: 290.0 + 79.0,  // контур вместе с КД — объём насыщенной смеси
    UA_SG_MW_PER_K: 127.0,       // UA четырёх ПГ на номинале: 3200 МВт / среднелогарифм. напор 25,2 К
    BREAK_D_DEFAULT_M: 0.10,     // течь, задаваемая кнопкой на БЩУ, — Ду 100 (◇)
    BREAK_D_SCENARIO_M: 0.20,    // течь в сценарии 5 — Ду 200 (◇)
    CD: 0.61,                    // коэффициент расхода кромки
    TWO_PHASE_FACTOR: 0.35,      // снижение расхода при запирании двухфазного потока (◇)
    FLASH_FACTOR: 0.30,          // доля упругого сжатия пара КД, не компенсированная вскипанием (◇)
    CP_PRIMARY: 5.5,             // кДж/(кг·К) при 290–330 °C
    GE_COUNT: 4,
    GE_WATER_M3: 50.0,           // вода в одной ГЕ-1 из 60 м³ (◇; 4 × 60 м³ — [КН] с. 177)
    GE_GAS_M3: 10.0,             // азотная подушка одной ГЕ-1 (◇)
    GE_P0_MPA: 5.9,              // [КН] с. 177
    GE_CDA_M2: 0.012,            // эффективное сечение линии одной ГЕ-1 (◇)
    GE_WATER_T_C: 30.0,          // не ниже 20 °C по [КН] с. 177; принято 30 °C (◇)
    ECCS_SIGNAL_P1_MPA: 13.7,    // сигнал запуска насосов САОЗ по снижению P1 (◇)
    HP: { SHUTOFF_MPA: 7.9, RATED_MPA: 6.37, FLOW_KG_S: 4 * 150.0 / 3.6 },   // JND: 4 × 150 м³/ч, напор 650 м
    LP: { SHUTOFF_MPA: 2.45, RATED_MPA: 1.47, FLOW_KG_S: 4 * 750.0 / 3.6 },  // JNG-1: 4 × 750 м³/ч, напор 150 м
    ECCS_WATER_T_C: 40.0,        // вода баков-приямков (◇)
    ECCS_BORON_G_KG: 16.0        // баки-приямки и ГЕ-1, 16 г/кг ([КН] с. 174, 177)
  },

  // Гермооболочка: свободный объём — [ARIS]; теплоёмкость конструкций, теплообмен, уставка спринклера — ◇
  CONTAINMENT: {
    FREE_VOLUME_M3: 64166.4,
    P0_MPA: 0.100,
    T0_C: 40.0,
    WALL_UA_MW_PER_K: 4.0,       // конденсация на облицовке и конструкциях (◇)
    WALL_C_MJ_PER_K: 8000.0,     // теплоёмкость прогреваемого слоя конструкций (◇)
    SPRAY_SIGNAL_MPA: 0.13,      // запуск спринклера (JMN) при +0,03 МПа изб. (◇)
    SPRAY_KG_S: 280.0,           // 2 канала из 4 × 50 % (◇)
    SPRAY_T_C: 40.0,
    SPOT_UA_MW_PER_K: 0.6,       // СПОТ ГО (JMP), 16 × 75 м², оценка (◇)
    SPOT_START_C: 60.0
  },

  // Водообмен СВО при вводе бора / дистиллята: 40 т/ч на ~290 т теплоносителя
  ROD_SPEED_PCT_PER_S: 0.54,     // Привод ШЭМ-3: 20 мм/с при высоте зоны 373 см
  BORON_EXCHANGE_PER_S: 3.8e-5,
  BORON_CONCENTRATE_G_KG: 40.0   // баки JDH 2 × 150 м³, 40 г/кг (Поваров и др. 2025, с. 172–173)
};

// ============================================================================
// 2. ГЛОБАЛЬНЫЙ ОБЪЕКТ СОСТОЯНИЯ СИМУЛЯТОРА (sim)
// ============================================================================
var sim = {
  time: 0,
  timeSpeed: 1,
  timeScale: 1,
  viewMode: 'systems',        // 'systems' | 'controls' | 'core' | '3d'
  systemsSubMode: 'cross',    // 'cross' (единственный вид); 'panorama' | 'loops' — скрыты
  eduMode: true,
  showParticles: true,
  isEngineeringMode: false,

  // Нейтронная кинетика и реактивность
  thermalPowerMW: 3200.0,     // Номинал 3200 МВт
  nominalPowerMW: 3200.0,
  neutronFlux: 1.0,           // Относительный поток нейтронов (1.0 = 100%)
  precursors: 1.0,            // Концентрация запаздывающих нейтронов
  decayHeatMW: 215.0,         // Остаточное тепловыделение продуктов деления (6.7% Nном)

  // ОР СУЗ и АРМ (ШЭМ-3)
  group10Pos: 72.4,           // Рабочая группа №12 (0% = внизу, 100% = вверху; 72.4% ≈ 270 см)
  groups1to9Pos: 100.0,       // Группы АЗ №1-11 (0%..100%)
  withdrawing1to9: false,     // Идет ли подъем групп АЗ
  armEnabled: true,           // Автоматический регулятор мощности
  armTargetMW: 3200.0,        // Уставка АРМ (МВт)
  az1Tripped: false,          // Сигнал аварийной защиты АЗ-1
  az1CoverOpen: false,        // Откинута ли крышка кнопки АЗ-1
  rodCommand: 0,              // Ручное управление группой №12: +1 вверх, -1 вниз

  // Борное регулирование (СБР), Ксенон-135 и выгорание кампании
  boronConc: 6.20,            // г/кг H3BO3 (при 6.20 г/кг и Гр12=72.4% реактор критичен)
  criticalBoronConc: 6.20,    // Критическая концентрация H3BO3 с учетом выгорания топлива (г/кг)
  boronMode: 0,               // 0 = нейтрально, +1 = ввод бора, -1 = ввод дистиллята
  iodine135: 1.0,             // Относительная концентрация I-135 (1.0 = равновесие на 100%)
  xenon135: 1.0,              // Относительная концентрация Xe-135 (1.0 = равновесие на 100%)
  operationalDays: 0.0,       // Эффективные сутки работы топливной загрузки (эфф. сут)
  avgBurnupGWdT: 24.42,       // Среднее выгорание топлива по активной зоне (ГВт·сут/т)
  scramElapsedSeconds: 0.0,   // Время расхолаживания после срабатывания АЗ-1 (с)

  // Составляющие реактивности (в pcm = 10^-5 Δk/k)
  rhoRods: 0,
  rhoBoron: 0,
  rhoDoppler: 0,
  rhoModerator: 0,
  rhoXenon: 0,
  rhoTotal: 0,

  // Теплогидравлика 1-го контура
  fuelTempC: 680.0,           // Средняя температура топлива UO2 (°C)
  coreInletTempC: 298.6,      // T_вх активной зоны (°C)
  coreOutletTempC: 329.7,     // T_вых активной зоны (°C)
  primaryPressureMPa: 16.20,  // Давление 1-го контура P1 (МПа)
  pressurizerLevelM: 8.17,    // Уровень воды в КД (м, норма 8,17 ± 0,15 м, razdel-9, табл. 9.1.6)
  heatersMode: 'AUTO',        // 'AUTO' | 'ON' | 'OFF'
  heatersPowerKW: 900,        // Текущая мощность ТЭНов КД (0..2520 кВт, razdel-9, табл. 9.1.6)
  sprayActive: false,         // Впрыск холодной воды в паровое пространство КД
  ipuKdOpen: false,           // Открыт ли ИПУ КД (аварийный сброс давления в барботер)
  primaryLeakActive: false,   // Малая течь теплоносителя 1-го контура
  subcoolingMarginC: 18.66,   // Запас до кипения ΔTs в горячих нитках (°C)
  kqMax: 1.27,

  // 4 петли ГЦК и 4 горизонтальных парогенератора ПГВ-1000МКП
  loops: [
    { id: 1, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 },
    { id: 2, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 },
    { id: 3, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 },
    { id: 4, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 329.7, tCold: 298.6, sgLevelM: 2.70, sgPressMPa: 7.00 }
  ],

  // 2-й контур и турбоагрегат К-1200-6,8/50
  steamHeaderPressMPa: 7.00,  // Давление в ГПК (МПа)
  steamTempC: 285.83,         // Температура насыщенного пара (°C)
  feedwaterFlowPct: 100.0,    // Производительность ПЭН (%)
  turbineValvePct: 100.0,     // Открытие РК турбины (%)
  turbineRpm: 3000,           // Обороты ротора (3000 об/мин = 50 Гц)
  electricalPowerMW: 1200.0,  // Электрическая мощность ТЗВ-1200-2 (МВт)
  bruKOpen: false,            // БРУ-К (сброс пара в конденсатор)
  bruAOpen: false,            // БРУ-А (сброс пара в атмосферу)

  // Системы пассивной и активной безопасности Поколения III+ (В-491)
  acPower: true,              // Электропитание собственных нужд (false — полное обесточивание)
  saozActive: false,          // Идёт подача САОЗ (ГЕ-1, ВД или НД) — рассчитывается
  eccsManualStart: false,     // Ручной запуск насосов САОЗ ВД/НД оператором
  saozWaterPct: 100.0,        // Запас борированной воды (не менее 16 г/кг, Поваров и др. 2025, с. 177) в гидроемкостях (%)
  spotActive: false,          // СПОТ ПГ (JNB), водоохлаждаемая: конденсация пара в ТОАР, баки БАОТ (В-491)
  ulrCoolingActive: false,    // Подача охлаждающей воды в шахту УЛР (ловушки расплава)

  // Картограмма активной зоны
  selectedAssemblyId: 82,     // Выбранная кассета (по умолчанию центральная №82)
  hoveredHotspot: null
};

// ============================================================================
// 3. ТЕПЛОФИЗИЧЕСКИЕ И КИНЕТИЧЕСКИЕ РАСЧЕТНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Расчет температуры насыщения воды по стандарту IAPWS-IF97
 * @param {number} pMPa - абсолютное давление (МПа)
 * @returns {number} температура насыщения (°C)
 */
function calcSaturationTempC(pMPa) {
  // Обратное уравнение области 4 IAPWS-IF97: при 7.0 МПа 285.83 °C, при 16.2 МПа 348.36 °C
  const p = Math.max(0.2, Math.min(22.0, pMPa));
  const beta = Math.pow(p, 0.25);
  const E = beta * beta - 0.17073846940092e2 * beta + 0.14915108613530e2;
  const F = 0.11670521452767e4 * beta * beta + 0.12020824702470e5 * beta - 0.48232657361591e4;
  const G = -0.72421316703206e6 * beta * beta - 0.32325550322333e7 * beta + 0.40511340542057e6;
  const D = (2.0 * G) / (-F - Math.sqrt(F * F - 4.0 * E * G));
  const n9 = -0.23855557567849;
  const n10 = 0.65017534844798e3;
  const sum = n10 + D;
  return (sum - Math.sqrt(sum * sum - 4.0 * (n9 + n10 * D))) / 2.0 - 273.15;
}

/**
 * Давление насыщения воды по температуре (прямое уравнение области 4 IAPWS-IF97), МПа
 */
function calcSaturationPressureMPa(tC) {
  const T = Math.max(1.0, Math.min(373.0, tC)) + 273.15;
  const n = [0, 0.11670521452767e4, -0.72421316703206e6, -0.17073846940092e2, 0.12020824702470e5,
    -0.32325550322333e7, 0.14915108613530e2, -0.48232657361591e4, 0.40511340542057e6,
    -0.23855557567849, 0.65017534844798e3];
  const th = T + n[9] / (T - n[10]);
  const A = th * th + n[1] * th + n[2];
  const B = n[3] * th * th + n[4] * th + n[5];
  const C = n[6] * th * th + n[7] * th + n[8];
  return Math.pow((2 * C) / (-B + Math.sqrt(B * B - 4 * A * C)), 4);
}

// Таблица насыщения воды (T °C; P МПа; v' и v'' м³/кг; h' и h'' кДж/кг) — стандартные таблицы IAPWS-IF97
const SAT_TABLE = [
  [100, 0.1014, 0.001044, 1.6720, 419.1, 2675.6],
  [120, 0.1987, 0.001060, 0.8913, 503.8, 2706.0],
  [140, 0.3615, 0.001080, 0.5085, 589.2, 2733.5],
  [160, 0.6182, 0.001102, 0.3071, 675.5, 2757.4],
  [180, 1.0028, 0.001127, 0.1938, 763.1, 2777.2],
  [200, 1.5549, 0.001157, 0.1272, 852.3, 2792.0],
  [220, 2.3196, 0.001190, 0.08609, 943.6, 2801.1],
  [240, 3.3469, 0.001229, 0.05970, 1037.6, 2803.0],
  [260, 4.6923, 0.001276, 0.04220, 1135.0, 2796.6],
  [280, 6.4166, 0.001332, 0.03017, 1236.9, 2779.9],
  [300, 8.5879, 0.001404, 0.02167, 1345.0, 2749.6],
  [320, 11.284, 0.001499, 0.01549, 1462.2, 2700.6],
  [340, 14.601, 0.001638, 0.01080, 1594.5, 2621.8],
  [350, 16.529, 0.001741, 0.008803, 1671.0, 2563.6]
];

// Свойства насыщения при температуре tC: линейная интерполяция по таблице (v'' — по логарифму)
function satProps(tC) {
  const T = Math.max(100, Math.min(350, tC));
  let i = 0;
  while (i < SAT_TABLE.length - 2 && SAT_TABLE[i + 1][0] < T) i++;
  const a = SAT_TABLE[i];
  const b = SAT_TABLE[i + 1];
  const k = (T - a[0]) / (b[0] - a[0]);
  const lin = (j) => a[j] + (b[j] - a[j]) * k;
  const P = calcSaturationPressureMPa(T);
  const vf = lin(2);
  const vg = Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * k);
  const hf = lin(4);
  const hg = lin(5);
  return { P, vf, vg, hf, hg, uf: hf - P * 1000 * vf, ug: hg - P * 1000 * vg };
}

// Температура насыщенной смеси по удельному объёму v (м³/кг) и удельной внутренней энергии u (кДж/кг):
// ищем T, при которой паросодержание из энергии и из объёма совпадают
function solveSaturatedMixture(v, u) {
  const f = (T) => {
    const p = satProps(T);
    const x = (u - p.uf) / (p.ug - p.uf);
    return p.vf + x * (p.vg - p.vf) - v;
  };
  let lo = 100;
  let hi = 350;
  if (f(lo) * f(hi) > 0) return f(hi) > 0 ? hi : lo;
  for (let it = 0; it < 40; it++) {
    const mid = 0.5 * (lo + hi);
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  const T = 0.5 * (lo + hi);
  const p = satProps(T);
  return { T, x: Math.max(0, Math.min(1, (u - p.uf) / (p.ug - p.uf))), props: p };
}

// Энтальпия насыщенной воды и теплота парообразования (аппроксимации, кДж/кг; погрешность < 2 % до 330 °C)
function waterEnthalpyKJkg(tC) { return 4.18 * tC + 0.0011 * tC * tC; }
function latentHeatKJkg(tC) { return 2257.0 * Math.pow(Math.max(0, (374.0 - Math.min(373.0, tC))) / 274.0, 0.38); }

/**
 * Сброс состояния систем безопасности, течи и гермооболочки к исходному (номинал)
 */
function resetSafetyState(target = sim) {
  const L = NUCLEAR_CONSTANTS.LOCA;
  const CT = NUCLEAR_CONSTANTS.CONTAINMENT;
  target.acPower = true;
  target.breakDiameterM = 0;
  target.breakFlowKgS = 0;
  target.primarySaturated = false;
  target.primaryMassT = L.LOOPS_VOLUME_M3 * L.RHO_NOMINAL / 1000.0;
  target.primaryInventoryPct = 100.0;
  target.primaryQuality = 0;
  target.primaryLiquidFrac = 1;
  target.primaryMixMassKg = 0;
  target.primaryMixEnergyKJ = 0;
  target.primaryMixH = 0;
  target.primaryMixRho = 0;
  target.sgHeatMW = 3200;
  target.geWaterM3 = L.GE_WATER_M3;
  target.gePressMPa = L.GE_P0_MPA;
  target.geFlowKgS = 0;
  target.hpFlowKgS = 0;
  target.lpFlowKgS = 0;
  target.eccsSignal = false;
  target.eccsManualStart = false;
  target.eccsPumpsRunning = false;
  target.saozActive = false;
  target.saozWaterPct = 100.0;
  target.containmentTempC = CT.T0_C;
  target.containmentWallTempC = CT.T0_C;
  target.containmentPressMPa = CT.P0_MPA;
  target.sprinklerActive = false;
  target.spotGoHeatMW = 0;
  target.bruKAuto = false;
  target.bruAAuto = false;
  target.bruKManual = false;
  target.bruAManual = false;
  target.bruKOpen = false;
  target.bruAOpen = false;
  target.ipuSg1Open = false;
  target.ipuSg2Open = false;
  target.steamDumpMW = 0;
  target.safetyEvents = {};
}

// Число с десятичной запятой для сообщений журнала
function ru(v, d) { return Number(v).toFixed(d).replace('.', ','); }

function noteSafetyEvent(key, message, type = 'danger') {
  if (!sim.safetyEvents) sim.safetyEvents = {};
  if (sim.safetyEvents[key]) return;
  sim.safetyEvents[key] = true;
  safeLog(message, type);
}

/**
 * Исходное событие «полное обесточивание»: потеря собственных нужд, включая резервные дизель-генераторы
 */
function startBlackout() {
  sim.acPower = false;
  safeLog('ИСХОДНОЕ СОБЫТИЕ: полное обесточивание энергоблока (собственные нужды и резервные источники). ГЦНА на выбеге, ПЭН, ТЭНы КД и активные системы безопасности без питания.', 'danger');
}

/**
 * Исходное событие «течь 1-го контура» эквивалентным диаметром dM (м)
 */
function startLoca(dM) {
  sim.primaryLeakActive = true;
  sim.breakDiameterM = dM || NUCLEAR_CONSTANTS.LOCA.BREAK_D_DEFAULT_M;
  safeLog(`ИСХОДНОЕ СОБЫТИЕ: течь 1-го контура эквивалентным диаметром Ду ${Math.round(sim.breakDiameterM * 1000)} на холодной нитке петли 1.`, 'danger');
}

/**
 * Безопасная отправка сообщения в журнал БЩУ (если UI инициализирован)
 */
function safeLog(message, type = 'info') {
  if (typeof addLog === 'function') {
    addLog(message, type);
  } else if (typeof window !== 'undefined' && typeof window.addLog === 'function') {
    window.addLog(message, type);
  }
}

/**
 * Срабатывание аварийной защиты первого рода (АЗ-1)
 * @param {string} reason - причина срабатывания защиты
 */
function triggerAZ1(reason) {
  if (sim.az1Tripped) return;
  sim.az1Tripped = true;
  sim.armEnabled = false;
  sim.withdrawing1to9 = false;
  sim.turbineValvePct = 0.0; // Защита закрывает стопорные клапаны турбины

  const btnARM = typeof document !== 'undefined' ? document.getElementById('btnARM') : null;
  if (btnARM) {
    btnARM.classList.remove('active');
    btnARM.textContent = 'АРМ: ОТКЛ (АЗ-1)';
  }

  safeLog(`СРАБАТЫВАНИЕ АЗ-1! Причина: ${reason}. Сброс всех 121 кластеров ОР СУЗ в активную зону под собственным весом (< 4 с).`, 'danger');

  if (typeof sound !== 'undefined' && typeof sound.alarmAZ1 === 'function') {
    sound.alarmAZ1();
  } else if (typeof window !== 'undefined' && window.sound && typeof window.sound.alarmAZ1 === 'function') {
    window.sound.alarmAZ1();
  }
}

/**
 * Инициализация / сброс параметров физического состояния реактора
 * @param {string} preset - ключ пресета ('nominal' | 'startup' | 'xenon' | 'blackout' | 'loca')
 */
function resetPhysicsToNominal(targetSim = sim) {
  targetSim.az1Tripped = false;
  targetSim.withdrawing1to9 = false;
  targetSim.armEnabled = true;
  targetSim.armTargetMW = 3200.0;
  targetSim.boronMode = 0;
  targetSim.sprayActive = false;
  targetSim.ipuKdOpen = false;
  targetSim.primaryLeakActive = false;
  targetSim.bruKOpen = false;
  targetSim.bruAOpen = false;
  targetSim.saozActive = false;
  targetSim.saozWaterPct = 100.0;
  targetSim.spotActive = false;
  targetSim.ulrCoolingActive = false;
  resetSafetyState(targetSim);

  targetSim.thermalPowerMW = 3200.0;
  targetSim.nominalPowerMW = 3200.0;
  targetSim.neutronFlux = 1.0;
  targetSim.precursors = 1.0;
  targetSim.decayHeatMW = NUCLEAR_CONSTANTS.DECAY_HEAT.NOMINAL_MW;
  targetSim.delayedPrecursors = null;
  targetSim.decayGroups = null;
  targetSim.group10Pos = 72.4;
  targetSim.groups1to9Pos = 100.0;
  targetSim.boronConc = 6.20;
  targetSim.criticalBoronConc = 6.20;
  targetSim.iodine135 = 1.0;
  targetSim.xenon135 = 1.0;
  targetSim.operationalDays = 0.0;
  targetSim.avgBurnupGWdT = 24.42;
  targetSim.scramElapsedSeconds = 0.0;
  if (typeof initCoreCartogram === 'function') {
    initCoreCartogram();
  } else if (typeof window !== 'undefined' && typeof window.initCoreCartogram === 'function') {
    window.initCoreCartogram();
  }
  targetSim.fuelTempC = 680.0;
  targetSim.coreInletTempC = 298.6;
  targetSim.coreOutletTempC = 329.7;
  targetSim.primaryPressureMPa = 16.20;
  targetSim.pressurizerLevelM = 8.17;
  targetSim.heatersMode = 'AUTO';
  targetSim.heatersPowerKW = 900;
  targetSim.subcoolingMarginC = 18.66;
  targetSim.steamHeaderPressMPa = 7.00;
  targetSim.steamTempC = calcSaturationTempC(7.00);
  targetSim.feedwaterFlowPct = 100.0;
  targetSim.turbineValvePct = 100.0;
  targetSim.turbineRpm = 3000;
  targetSim.electricalPowerMW = 1200.0;

  targetSim.loops.forEach(l => {
    l.pumpOn = true;
    l.rpm = 1000;
    l.flowPct = 100;
    l.tHot = 329.7;
    l.tCold = 298.6;
    l.sgLevelM = NUCLEAR_CONSTANTS.STEAM_GEN.LEVEL_NOMINAL_M;
    l.sgPressMPa = 7.00;
  });
}

// ============================================================================
// 4. ГЛАВНЫЙ ИНТЕГРАТОР ФИЗИКИ (stepPhysics)
// ============================================================================
/**
 * Шаг численного интегрирования физико-математической модели ВВЭР-1200
 * @param {number} dtReal - реальное время кадра в секундах
 */
function stepPhysics(dtReal) {
  const scale = (typeof sim.timeScale === 'number') ? sim.timeScale : sim.timeSpeed;
  if (scale === 0) return;

  // Ограничиваем шаг и выполняем подинтегральные шаги для абсолютной численной устойчивости
  const totalSimDt = Math.min(dtReal, 0.05) * scale;
  // Шаг не больше 0.02 с: быстрые связи (мгновенный скачок, ТЭНы, АРМ) иначе теряют устойчивость
  const subSteps = Math.max(4, Math.ceil(totalSimDt / 0.02));
  const dt = totalSimDt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    sim.time += dt;
    sim.operationalDays = (typeof sim.operationalDays === 'number' ? sim.operationalDays : 0.0) + dt / 86400.0;

    // 1. ДВИЖЕНИЕ ОР СУЗ (ШЭМ-3)
    if (sim.az1Tripped) {
      // Гравитационный сброс всех групп ОР СУЗ в активную зону за ~3.5 секунды
      sim.group10Pos = Math.max(0, sim.group10Pos - 28.0 * dt);
      sim.groups1to9Pos = Math.max(0, sim.groups1to9Pos - 28.0 * dt);
      sim.scramElapsedSeconds = (typeof sim.scramElapsedSeconds === 'number' ? sim.scramElapsedSeconds : 0.0) + dt;
    } else {
      sim.scramElapsedSeconds = 0.0;
      if (sim.withdrawing1to9 && sim.groups1to9Pos < 100) {
        sim.groups1to9Pos = Math.min(100, sim.groups1to9Pos + NUCLEAR_CONSTANTS.ROD_SPEED_PCT_PER_S * dt);
        if (sim.groups1to9Pos >= 100) {
          sim.withdrawing1to9 = false;
          safeLog('Группы ОР СУЗ №1–11 выведены на верхний концевик (100%).', 'ok');
        }
      }
      // Работа АРМ (Автоматический регулятор мощности)
      if (sim.armEnabled && sim.groups1to9Pos > 85) {
        const powerErrMW = sim.armTargetMW - sim.thermalPowerMW;
        const rateErr = -sim.rhoTotal * 2.2;
        const rodSpeed = NUCLEAR_CONSTANTS.ROD_SPEED_PCT_PER_S;
        const rodVel = Math.max(-rodSpeed, Math.min(rodSpeed, (powerErrMW * 0.008 + rateErr * 0.015)));
        sim.group10Pos = Math.max(5, Math.min(100, sim.group10Pos + rodVel * dt));
      } else if (sim.rodCommand) {
        sim.group10Pos = Math.max(0, Math.min(100, sim.group10Pos + sim.rodCommand * NUCLEAR_CONSTANTS.ROD_SPEED_PCT_PER_S * dt));
      }
      // Турбина следует за уставкой АРМ: регулирующие клапаны набирают / сбрасывают нагрузку 3 %/мин (◇)
      if (sim.armEnabled && sim.acPower !== false) {
        const valveTarget = Math.max(0, Math.min(104, sim.armTargetMW / 3200.0 * 100.0));
        const maxStep = 0.05 * dt;
        sim.turbineValvePct += Math.max(-maxStep, Math.min(maxStep, valveTarget - sim.turbineValvePct));
      }
    }

    // Блокировка разбавления: рабочая группа на нижнем пределе регулирования или сработала АЗ-1 (◇)
    if (sim.boronMode === -1 && (sim.az1Tripped || (sim.armEnabled && sim.group10Pos <= 20.0))) {
      sim.boronMode = 0;
      safeLog(sim.az1Tripped
        ? 'БЛОКИРОВКА СБР: при АЗ-1 ввод дистиллята прекращён.'
        : 'БЛОКИРОВКА СБР: рабочая группа №12 опустилась до 20 % — ввод дистиллята прекращён, АРМ не может компенсировать дальнейшее разбавление.', 'warn');
    }

    // 2. СИСТЕМА БОРНОГО РЕГУЛИРОВАНИЯ (СБР) И САОЗ
    // Водообмен: dC/dt = (G/M)·(C_вх − C)
    if (sim.boronMode === 1) {
      sim.boronConc += NUCLEAR_CONSTANTS.BORON_EXCHANGE_PER_S * (NUCLEAR_CONSTANTS.BORON_CONCENTRATE_G_KG - sim.boronConc) * dt;
    } else if (sim.boronMode === -1) {
      sim.boronConc = Math.max(0.0, sim.boronConc - NUCLEAR_CONSTANTS.BORON_EXCHANGE_PER_S * sim.boronConc * dt);
    }

    // Если активны гидроемкости САОЗ, они подают борированную воду (не менее 16 г/кг — Поваров и др. 2025, с. 177)
    if (sim.saozActive && sim.saozWaterPct > 0) {
      sim.saozWaterPct = Math.max(0, sim.saozWaterPct - 1.2 * dt);
      sim.boronConc = Math.min(16.0, sim.boronConc + (16.0 - sim.boronConc) * 0.06 * dt);
    }

    // 3. ДИНАМИКА КСЕНОНА-135 (ЙОДНАЯ ЯМА)
    // Концентрации отнесены к равновесию на 100%: при Φ = 1 I = 1 и Xe = 1
    const xenon = NUCLEAR_CONSTANTS.XENON_CONSTANTS;
    const iodineShare = xenon.YIELD_IODINE / (xenon.YIELD_IODINE + xenon.YIELD_XENON);
    const dI = xenon.LAMBDA_IODINE * (sim.neutronFlux - sim.iodine135);
    const dXe = xenon.LAMBDA_XENON * (
      (1.0 + xenon.BURNUP_RATIO) * (iodineShare * sim.iodine135 + (1.0 - iodineShare) * sim.neutronFlux)
      - (1.0 + xenon.BURNUP_RATIO * sim.neutronFlux) * sim.xenon135
    );
    sim.iodine135 = Math.max(0.05, Math.min(3.0, sim.iodine135 + dI * dt));
    sim.xenon135 = Math.max(0.05, Math.min(2.8, sim.xenon135 + dXe * dt));

    // 4. РАСЧЕТ БАЛАНСА РЕАКТИВНОСТИ ВВЭР-1200 (ВНУТРЕННЯЯ САМОЗАЩИЩЕННОСТЬ ПВР)
    // Эффективность рабочей группы №12 (9,5 pcm/% хода), групп АЗ №1–11 (65 pcm/%, ~6500 pcm)
    // В номинале: группы АЗ = 100%, Гр. 12 = 72.4% -> rhoRods = 0 pcm
    const rhoG10 = (sim.group10Pos - 72.4) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G10;
    const rhoG19 = (sim.groups1to9Pos - 100.0) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G19;
    sim.rhoRods = rhoG10 + rhoG19;

    // Эффективность борной кислоты: alpha_B = -1400 pcm / (г/кг H3BO3) ≈ -8 pcm/ppm B
    // В номинале C_boron = criticalBoronConc (6.20 г/кг в начале, снижается до ~0.50 г/кг по мере выгорания) -> rhoBoron = 0 pcm
    const refBoron = (typeof sim.criticalBoronConc === 'number') ? sim.criticalBoronConc : 6.20;
    sim.rhoBoron = -(sim.boronConc - refBoron) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_BORON);

    // Доплеровский температурный коэффициент топлива: СТРОГО ОТРИЦАТЕЛЬНЫЙ (-2.8 pcm/°C)
    // В номинале T_fuel = 680 °C -> rhoDoppler = 0 pcm
    sim.rhoDoppler = -(sim.fuelTempC - 680.0) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_DOPPLER);

    // Температурный коэффициент теплоносителя (модератора): СТРОГО ОТРИЦАТЕЛЬНЫЙ (-34.0 pcm/°C)
    // В номинале T_avg = 314.15 °C -> rhoModerator = 0 pcm
    const avgCoolantTempC = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
    // Учет паросодержания при вскипании (void penalty < 0)
    const voidPenalty = sim.subcoolingMarginC < 2.0 ? (2.0 - sim.subcoolingMarginC) * 45.0 : 0;
    sim.rhoModerator = -(avgCoolantTempC - 314.15) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_MODERATOR) - voidPenalty;

    // Отравление Ксеноном-135 (в номинале Xe = 1.0 -> 0 pcm отн. номинального запаса)
    sim.rhoXenon = -(sim.xenon135 - 1.0) * NUCLEAR_CONSTANTS.FEEDBACKS.XENON_WORTH_FACTOR;

    sim.rhoTotal = sim.rhoRods + sim.rhoBoron + sim.rhoDoppler + sim.rhoModerator + sim.rhoXenon;

    // 5. ТОЧЕЧНАЯ КИНЕТИКА НЕЙТРОНОВ
    // Эффективная доля запаздывающих нейтронов для ВВЭР-1200 beta_eff = 650 pcm (0.0065)
    const rhoClamped = Math.max(-8000, Math.min(580, sim.rhoTotal));
    const rhoAbs = rhoClamped * 1e-5;
    const beta = NUCLEAR_CONSTANTS.BETA_EFF;
    const delayedGroups = NUCLEAR_CONSTANTS.DELAYED_GROUPS;
    // Сценарий задаёт sim.precursors одним числом: раскладываем его по 6 группам
    if (!sim.delayedPrecursors || Math.abs(sim.precursors - sim.precursorsSynced) > 1e-9) {
      sim.delayedPrecursors = delayedGroups.map(() => sim.precursors);
    }
    // Приближение мгновенного скачка: n = Σ(β_i·c_i) / (β − ρ)
    const delayedSource = delayedGroups.reduce((acc, g, i) => acc + g.beta * sim.delayedPrecursors[i], 0);
    const targetFlux = Math.max(0.0001, delayedSource / Math.max(0.0008 * beta / 0.0065, beta - rhoAbs));
    sim.neutronFlux += (targetFlux - sim.neutronFlux) * Math.min(1.0, 9.0 * dt);
    sim.neutronFlux = Math.max(0.00005, Math.min(1.35, sim.neutronFlux));
    delayedGroups.forEach((g, i) => {
      sim.delayedPrecursors[i] += g.lambda * (sim.neutronFlux - sim.delayedPrecursors[i]) * dt;
    });
    sim.precursors = delayedGroups.reduce((acc, g, i) => acc + g.beta * sim.delayedPrecursors[i], 0) / beta;
    sim.precursorsSynced = sim.precursors;

    // Остаточное тепловыделение: каждая группа стремится к своей доле от текущего деления
    const decay = NUCLEAR_CONSTANTS.DECAY_HEAT;
    if (!sim.decayGroups || Math.abs(sim.decayHeatMW - sim.decaySynced) > 1e-6) {
      sim.decayGroups = decay.FRACTIONS.map((f) => f * sim.decayHeatMW);
    }
    decay.LAMBDAS.forEach((l, i) => {
      const equilibrium = decay.FRACTIONS[i] * decay.NOMINAL_MW * sim.neutronFlux;
      sim.decayGroups[i] += (equilibrium - sim.decayGroups[i]) * (1.0 - Math.exp(-l * dt));
    });
    sim.decayHeatMW = sim.decayGroups.reduce((acc, v) => acc + v, 0);
    sim.decaySynced = sim.decayHeatMW;

    const fissionPowerMW = decay.FISSION_NOMINAL_MW * sim.neutronFlux;
    sim.thermalPowerMW = fissionPowerMW + sim.decayHeatMW;

    // 6. ТЕПЛОГИДРАВЛИКА 4 ПЕТЕЛЬ ГЦК И АКТИВНОЙ ЗОНЫ
    let totalLoopFlowPct = 0;
    if (sim.acPower === false) {
      sim.loops.forEach((lp) => { lp.pumpOn = false; });
      sim.feedwaterFlowPct = 0;
      sim.turbineValvePct = 0;
      if (!sim.az1Tripped) triggerAZ1('Обесточивание: потеря питания ГЦНА и ПЭН');
      if (!sim.spotActive) {
        sim.spotActive = true;
        noteSafetyEvent('spot', 'СПОТ ПГ (JNB): открыта арматура пассивного отвода тепла от ПГ к теплообменникам в баках БАОТ.', 'warn');
      }
    }
    for (let i = 0; i < 4; i++) {
      const lp = sim.loops[i];
      if (lp.pumpOn) {
        lp.rpm += (1000 - lp.rpm) * Math.min(1, 0.25 * dt);
      } else {
        // Выбег на маховике: n(t) = n₀ / (1 + t/τ), τ = 30 с; далее естественная циркуляция
        lp.rpm = lp.rpm < 5 ? 0 : lp.rpm - (lp.rpm * lp.rpm / (1000.0 * 30.0)) * dt;
      }
      const natCircPct = 6.8 + 2.2 * ((sim.coreOutletTempC - sim.coreInletTempC) / 31.1);
      lp.flowPct = lp.pumpOn ? (lp.rpm / 1000) * 100 : Math.max(natCircPct, (lp.rpm / 1000) * 100);
      totalLoopFlowPct += lp.flowPct;
    }
    const avgFlowFrac = Math.max(0.065, totalLoopFlowPct / 400.0);

    // Температура топлива UO2 (T_fuel)
    const targetFuelTempC = avgCoolantTempC + (sim.thermalPowerMW / 3200.0) * 366.45;
    sim.fuelTempC += (targetFuelTempC - sim.fuelTempC) * Math.min(1, 1.6 * dt);

    // Перепад температур в активной зоне ΔT = N / (G * Cp)
    const coreDeltaT = (sim.thermalPowerMW / 3200.0) / avgFlowFrac * 31.1;

    // Теплоотвод в 4 горизонтальных парогенераторах ПГВ-1000МКП и через СПОТ
    const spotHeatRemovalMW = sim.spotActive ? 145.0 * Math.max(0.2, (sim.steamTempC - 100) / 185.8) : 0.0;

    // Потребление пара турбиной К-1200-6,8/50
    const turbineSteamDemandMW = (sim.turbineValvePct / 100.0) * 3200.0 * (sim.steamHeaderPressMPa / 7.0);
    const steamGen = NUCLEAR_CONSTANTS.STEAM_GEN;

    // Автоматика паросброса по [ТЦ]: БРУ-К (в конденсатор, нужен вакуум и питание), БРУ-А (в атмосферу), ИПУ ПГ
    const SD = NUCLEAR_CONSTANTS.STEAM_DUMP;
    const p2 = sim.steamHeaderPressMPa;
    const hasAC = sim.acPower !== false;
    if (hasAC && !sim.bruKAuto && p2 > SD.BRU_K.OPEN) {
      sim.bruKAuto = true;
      safeLog(`АВТОМАТИКА: давление пара ${ru(p2, 2)} МПа > 7,3 МПа — открыта БРУ-К (поддержание 6,9 МПа).`, 'warn');
    }
    if (sim.bruKAuto && (p2 < SD.BRU_K.CLOSE || !hasAC)) sim.bruKAuto = false;
    if (hasAC && !sim.bruAAuto && p2 > SD.BRU_A.OPEN) {
      sim.bruAAuto = true;
      safeLog(`АВТОМАТИКА: давление пара ${ru(p2, 2)} МПа > 7,7 МПа — открыта БРУ-А (поддержание 7,3 МПа).`, 'warn');
    }
    if (sim.bruAAuto && (p2 < SD.BRU_A.CLOSE || !hasAC)) sim.bruAAuto = false;
    if (!sim.ipuSg1Open && p2 > SD.IPU_1.OPEN) {
      sim.ipuSg1Open = true;
      safeLog(`ИПУ ПГ 1-й ступени открыты: давление пара ${ru(p2, 2)} МПа > 8,7 МПа.`, 'danger');
    }
    if (sim.ipuSg1Open && p2 < SD.IPU_1.CLOSE) sim.ipuSg1Open = false;
    if (!sim.ipuSg2Open && p2 > SD.IPU_2.OPEN) {
      sim.ipuSg2Open = true;
      safeLog(`ИПУ ПГ 2-й ступени открыты: давление пара ${ru(p2, 2)} МПа > 8,9 МПа.`, 'danger');
    }
    if (sim.ipuSg2Open && p2 < SD.IPU_2.CLOSE) sim.ipuSg2Open = false;
    const band = (set) => Math.max(0, Math.min(1, (p2 - set) / SD.PROP_BAND_MPA));
    const bruKFrac = hasAC ? (sim.bruKManual ? 1 : (sim.bruKAuto ? band(SD.BRU_K.SET) : 0)) : 0;
    const bruAFrac = hasAC ? (sim.bruAManual ? 1 : (sim.bruAAuto ? band(SD.BRU_A.SET) : 0)) : 0;
    sim.bruKOpen = bruKFrac > 0.01;
    sim.bruAOpen = bruAFrac > 0.01;
    const pScale = p2 / 7.0;
    const steamDumpMW = (bruKFrac * SD.BRU_K.CAP_TPH + bruAFrac * SD.BRU_A.CAP_TPH
      + (sim.ipuSg1Open ? SD.IPU_1.CAP_TPH : 0) + (sim.ipuSg2Open ? SD.IPU_2.CAP_TPH : 0)) * SD.MW_PER_TPH * pScale;
    sim.steamDumpMW = steamDumpMW;
    const totalSecondarySinkMW = turbineSteamDemandMW + spotHeatRemovalMW + steamDumpMW;

    // Теплота, отданная в ПГ, равна G·cp·(Tгор − Tхол) по каждой петле
    let heatTransferPrimaryToSecondaryMW = sim.loops.reduce((acc, lp) => (
      acc + 800.0 * (Math.max(0.065, lp.flowPct / 100.0)) * ((lp.tHot - lp.tCold) / 31.1)
    ), 0);
    if (sim.primarySaturated) {
      // Насыщенный контур при естественной циркуляции (в т. ч. конденсационный режим): Q = UA·(T_1к − T_s);
      // при T_1к < T_s ПГ отдаёт тепло обратно в 1-й контур
      const flowFactor = Math.max(0.3, Math.min(1.0, Math.pow(avgFlowFrac, 0.65)));
      heatTransferPrimaryToSecondaryMW = NUCLEAR_CONSTANTS.LOCA.UA_SG_MW_PER_K * flowFactor
        * Math.max(0.15, Math.min(1.0, sim.loops[0].sgLevelM / steamGen.LEVEL_NOMINAL_M))
        * (sim.coreOutletTempC - sim.steamTempC);
      // Обратный перенос (ПГ греет 1-й контур) слабый: циркуляция через трубки ПГ при этом почти прекращается (◇ 10 %)
      if (heatTransferPrimaryToSecondaryMW < 0) heatTransferPrimaryToSecondaryMW *= 0.10;
    }
    sim.sgHeatMW = heatTransferPrimaryToSecondaryMW;
    // Избыток тепла греет теплоноситель, воду ПГ и металл вместе: dT = Q / C, dP = dT / (dT_нас/dP)
    const tsatSlope = (calcSaturationTempC(sim.steamHeaderPressMPa + 0.01) - sim.steamTempC) / 0.01;
    const dSteamTemp = (heatTransferPrimaryToSecondaryMW - totalSecondarySinkMW) / steamGen.THERMAL_CAPACITY_MJ_PER_K;
    const dSteamPress = dSteamTemp / Math.max(1.0, tsatSlope);
    sim.steamHeaderPressMPa = Math.max(0.8, Math.min(SD.P2_MAX_MPA, sim.steamHeaderPressMPa + dSteamPress * dt));
    sim.steamTempC = calcSaturationTempC(sim.steamHeaderPressMPa);

    // Обновление температур горячей и холодной ниток по всем 4 петлям
    let sumCold = 0;
    let sumColdFlow = 0;
    for (let i = 0; i < 4; i++) {
      const lp = sim.loops[i];
      const loopFlowFactor = Math.max(0.065, lp.flowPct / 100.0);
      // Горячие нитки питаются из общей камеры над зоной: T_вых одна на все петли
      const targetTHot = sim.coreInletTempC + coreDeltaT;
      if (!sim.primarySaturated) lp.tHot += (Math.min(365, targetTHot) - lp.tHot) * Math.min(1, 1.5 * dt);

      // Холодная нитка охлаждается в ПГВ-1000МКП до температуры пара + температурный напор
      const sgEff = Math.max(0.15, Math.min(1.0, lp.sgLevelM / steamGen.LEVEL_NOMINAL_M));
      // Эффективность теплообменника ε = 1 − exp(−NTU), NTU ~ G^(−0.65)
      const sgNtu = steamGen.NTU_NOMINAL * Math.pow(loopFlowFactor, -0.65);
      const sgEffectiveness = (1.0 - Math.exp(-sgNtu)) * sgEff;
      const targetTCold = sim.steamTempC + (lp.tHot - sim.steamTempC) * (1.0 - sgEffectiveness);
      if (!sim.primarySaturated) lp.tCold += (targetTCold - lp.tCold) * Math.min(1, 1.5 * dt);
      // Смешение в напорной камере: вход в зону взвешен по расходам петель
      sumCold += lp.tCold * loopFlowFactor;
      sumColdFlow += loopFlowFactor;

      // Уровень котловой воды в ПГВ-1000МКП (норма 2,70 м)
      // Регулятор питания держит уровень; feedwaterFlowPct задаёт доступную производительность ПЭН
      // Конденсат СПОТ возвращается в ПГ, поэтому уровень этим отводом не расходуется
      const steamGenOutPct = (Math.max(0, heatTransferPrimaryToSecondaryMW - spotHeatRemovalMW) / 3200.0) * 100.0;
      const feedDemandPct = steamGenOutPct + (steamGen.LEVEL_NOMINAL_M - lp.sgLevelM) * 50.0;
      const feedActualPct = Math.max(0, Math.min(feedDemandPct, sim.feedwaterFlowPct * 1.15));
      const dLevel = (feedActualPct - steamGenOutPct) * 0.0018;
      lp.sgLevelM = Math.max(0.4, Math.min(3.6, lp.sgLevelM + dLevel * dt));
      lp.sgPressMPa = sim.steamHeaderPressMPa + (i * 0.01 - 0.015);
    }

    if (!sim.primarySaturated) {
      sim.coreInletTempC = sumCold / sumColdFlow;
      sim.coreOutletTempC = Math.min(370.0, sim.coreInletTempC + coreDeltaT);
    }

    // 7. КОМПЕНСАТОР ДАВЛЕНИЯ, ЗАПАС ТЕПЛОНОСИТЕЛЯ, ТЕЧЬ, САОЗ И ГЕРМООБОЛОЧКА
    const L = NUCLEAR_CONSTANTS.LOCA;
    const CT = NUCLEAR_CONSTANTS.CONTAINMENT;
    if (typeof sim.primaryMassT !== 'number') resetSafetyState(sim);
    const avgTemp = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
    const p1 = sim.primaryPressureMPa;
    const massNomT = L.LOOPS_VOLUME_M3 * L.RHO_NOMINAL / 1000.0;

    // 7.1 Расход через разрыв: G = Cd·A·√(2ρΔP), в режиме насыщения — с поправкой на запирание двухфазного потока
    let breakKgS = 0;
    if (sim.primaryLeakActive) {
      if (!sim.breakDiameterM) sim.breakDiameterM = L.BREAK_D_DEFAULT_M;
      const area = Math.PI * sim.breakDiameterM * sim.breakDiameterM / 4.0;
      const dPpa = Math.max(0, p1 - sim.containmentPressMPa) * 1e6;
      const rho = sim.primarySaturated ? Math.max(30.0, sim.primaryMixRho || 600.0) : L.RHO_NOMINAL;
      breakKgS = L.CD * area * (sim.primarySaturated ? L.TWO_PHASE_FACTOR : 1.0) * Math.sqrt(2 * rho * dPpa);
    }
    sim.breakFlowKgS = breakKgS;

    // 7.2 Гидроёмкости ГЕ-1: обратные клапаны открываются, когда P1 ниже давления азота
    let geKgS = 0;
    if (sim.geWaterM3 > 0) {
      const gasM3 = L.GE_GAS_M3 + (L.GE_WATER_M3 - sim.geWaterM3);
      sim.gePressMPa = L.GE_P0_MPA * L.GE_GAS_M3 / gasM3;        // изотермическое расширение азота
      const dPge = sim.gePressMPa - p1;
      if (dPge > 0) {
        geKgS = L.GE_COUNT * L.GE_CDA_M2 * Math.sqrt(2 * 1000.0 * dPge * 1e6);
        geKgS = Math.min(geKgS, sim.geWaterM3 * L.GE_COUNT * 1000.0 / dt);
        sim.geWaterM3 = Math.max(0, sim.geWaterM3 - geKgS / (1000.0 * L.GE_COUNT) * dt);
        noteSafetyEvent('ge1', `ГЕ-1 (JNG50…80): P1 = ${ru(p1, 2)} МПа ниже давления азота — открыты обратные клапаны, подача в напорную камеру (16 г/кг H₃BO₃).`);
      }
    }
    sim.geFlowKgS = geKgS;
    sim.saozWaterPct = sim.geWaterM3 / L.GE_WATER_M3 * 100.0;

    // 7.3 Активная САОЗ: сигнал по снижению P1 или росту давления в ГО; подача по напорной характеристике насоса
    if (!sim.eccsSignal && (p1 < L.ECCS_SIGNAL_P1_MPA || sim.containmentPressMPa > CT.SPRAY_SIGNAL_MPA)) {
      sim.eccsSignal = true;
      safeLog(sim.acPower === false
        ? `СИГНАЛ САОЗ (P1 = ${ru(p1, 2)} МПа), но насосы ВД/НД без питания — работают только пассивные системы.`
        : `СИГНАЛ САОЗ: P1 = ${ru(p1, 2)} МПа. Запущены насосы САОЗ ВД (JND) и НД (JNG-1); подача начнётся при P1 < 7,9 и < 2,45 МПа.`, 'danger');
    }
    sim.eccsPumpsRunning = sim.acPower !== false && (sim.eccsSignal || sim.eccsManualStart);
    const pumpCurve = (c) => (p1 >= c.SHUTOFF_MPA ? 0
      : c.FLOW_KG_S * Math.min(1, Math.sqrt((c.SHUTOFF_MPA - p1) / (c.SHUTOFF_MPA - c.RATED_MPA))));
    const hpKgS = sim.eccsPumpsRunning ? pumpCurve(L.HP) : 0;
    const lpKgS = sim.eccsPumpsRunning ? pumpCurve(L.LP) : 0;
    if (hpKgS > 0) noteSafetyEvent('hp', `САОЗ ВД (JND): P1 = ${ru(p1, 2)} МПа < 7,9 МПа — подача в 1-й контур.`);
    if (lpKgS > 0) noteSafetyEvent('lp', `САОЗ НД (JNG-1): P1 = ${ru(p1, 2)} МПа < 2,45 МПа — подача в 1-й контур.`);
    sim.hpFlowKgS = hpKgS;
    sim.lpFlowKgS = lpKgS;
    const pumpedKgS = hpKgS + lpKgS;
    const injectKgS = pumpedKgS + geKgS;
    sim.saozActive = injectKgS > 0.5;

    // 7.4 Бор: смешение подаваемого раствора 16 г/кг с теплоносителем
    if (injectKgS > 0) {
      const massKg = Math.max(20000, sim.primaryMassT * 1000.0);
      sim.boronConc += injectKgS * (L.ECCS_BORON_G_KG - sim.boronConc) / massKg * dt;
    }

    // 7.5 Уровень в КД и запас теплоносителя
    const outVolM3s = breakKgS / L.RHO_NOMINAL;
    const inVolM3s = injectKgS / 1000.0;
    const thermalExpansionLevel = 8.17 + (avgTemp - 314.15) * 0.095;
    if (!sim.primarySaturated) {
      sim.pressurizerLevelM += ((thermalExpansionLevel - sim.pressurizerLevelM) * 0.3 * (sim.primaryLeakActive ? 0 : 1)
        - (outVolM3s - inVolM3s) / L.KD_AREA_M2) * dt;
      sim.pressurizerLevelM = Math.max(0, Math.min(11.2, sim.pressurizerLevelM));
      sim.primaryInventoryPct = (massNomT + sim.pressurizerLevelM * L.KD_AREA_M2 * 0.6) / (massNomT + 33.0) * 100.0;
    }

    // 7.6 ТЭНы КД (без питания не работают)
    if (sim.acPower === false) {
      sim.heatersPowerKW = 0;
    } else if (sim.heatersMode === 'AUTO') {
      const pErr = 16.20 - p1;
      sim.heatersPowerKW = Math.max(0, Math.min(2520, Math.round(900 + pErr * 3200)));
    } else if (sim.heatersMode === 'ON') {
      sim.heatersPowerKW = 2520;
    } else {
      sim.heatersPowerKW = 0;
    }

    // Автоматическое открытие ИПУ КД при P1 > 18.1 МПа
    const ipuBtn = typeof document !== 'undefined' ? document.getElementById('btnIpuKD') : null;
    if (sim.primaryPressureMPa > 18.1 && !sim.ipuKdOpen) {
      sim.ipuKdOpen = true;
      safeLog('АВТОМАТИКА КД: Давление 1-го контура превысило 18,1 МПа! Открыт клапан ИПУ КД.', 'warn');
    } else if (sim.primaryPressureMPa < 16.5 && sim.ipuKdOpen && (!ipuBtn || !ipuBtn.dataset.manual)) {
      sim.ipuKdOpen = false;
    }

    // 7.7 Давление 1-го контура
    if (!sim.primarySaturated) {
      const heaterPressEffect = ((sim.heatersPowerKW - 900) / 1800) * 0.045;
      const sprayPressEffect = sim.sprayActive ? -0.14 : 0;
      const ipuPressEffect = sim.ipuKdOpen ? -0.35 : 0;
      const tempPressEffect = (avgTemp - 314.15) * 0.018;
      const targetP1 = 16.20 + tempPressEffect;
      if (!sim.primaryLeakActive) {
        sim.primaryPressureMPa += ((targetP1 - sim.primaryPressureMPa) * 0.12 + heaterPressEffect + sprayPressEffect + ipuPressEffect) * dt;
      } else {
        // Паровая подушка КД расширяется при уходе воды: dP = −γ·P·dV/V_пара, часть компенсирует вскипание
        const steamM3 = Math.max(4.0, L.KD_STEAM_M3_NOMINAL + (8.17 - sim.pressurizerLevelM) * L.KD_AREA_M2);
        const dPdt = -1.13 * sim.primaryPressureMPa / steamM3 * (outVolM3s - inVolM3s) * L.FLASH_FACTOR;
        sim.primaryPressureMPa += (dPdt + heaterPressEffect + sprayPressEffect + ipuPressEffect) * dt;
      }
      sim.primaryPressureMPa = Math.max(0.1, Math.min(19.5, sim.primaryPressureMPa));
      const pSatOut = calcSaturationPressureMPa(sim.coreOutletTempC);
      if (sim.primaryPressureMPa <= pSatOut + 0.02 || sim.pressurizerLevelM <= L.KD_EMPTY_M) {
        sim.primarySaturated = true;
        sim.primaryPressureMPa = Math.max(sim.primaryPressureMPa, pSatOut);
        // Масса: контур + оставшаяся вода КД; энергия — смесь при T_нас(P1) с этой массой в объёме 369 м³
        const kdWaterKg = sim.pressurizerLevelM * L.KD_AREA_M2 * 600.0;
        sim.primaryMixMassKg = massNomT * 1000.0 + kdWaterKg;
        // Энергия — по фактической средней температуре теплоносителя (недогретая вода), а не по давлению КД
        const ps = satProps(Math.min(345, avgTemp));
        sim.primaryMixEnergyKJ = sim.primaryMixMassKg * ps.uf;
        sim.primaryMixH = ps.hf;
        noteSafetyEvent('sat', sim.pressurizerLevelM <= L.KD_EMPTY_M
          ? `КД опорожнён (уровень ${ru(sim.pressurizerLevelM, 2)} м): паровая подушка потеряна, давление 1-го контура определяется насыщением теплоносителя.`
          : `Теплоноситель 1-го контура достиг насыщения при ${ru(sim.primaryPressureMPa, 2)} МПа: давление далее следует за температурой.`, 'danger');
      }
    } else {
      // Насыщенный 1-й контур (контур + КД, V = 369 м³): уравнения сохранения массы и энергии смеси
      //   dM/dt = G_САОЗ − G_разрыв,  dU/dt = N − Q_ПГ + G_САОЗ·h_САОЗ − G_разрыв·h_смеси
      // T и паросодержание x находятся из v = V/M и u = U/M по таблице насыщения; P1 = P_нас(T)
      const tGe = waterEnthalpyKJkg(L.GE_WATER_T_C);
      const tEccs = waterEnthalpyKJkg(L.ECCS_WATER_T_C);
      const hMix = sim.primaryMixH || waterEnthalpyKJkg(sim.coreOutletTempC);
      const dMkg = (injectKgS - breakKgS) * dt;
      const dUkJ = ((sim.thermalPowerMW - (sim.sgHeatMW || 0)) * 1000.0
        + pumpedKgS * tEccs + geKgS * tGe - breakKgS * hMix) * dt;
      sim.primaryMixMassKg = Math.max(20000, sim.primaryMixMassKg + dMkg);
      sim.primaryMixEnergyKJ += dUkJ;
      // Контур полностью заполнен водой: больше воды не вмещается, подача САОЗ уравновешивается течью
      const uNow = sim.primaryMixEnergyKJ / sim.primaryMixMassKg;
      const vfNow = satProps(Math.min(345, sim.coreOutletTempC)).vf;
      const massFullKg = L.PRIMARY_VOLUME_M3 / vfNow;
      if (sim.primaryMixMassKg > massFullKg) {
        sim.primaryMixMassKg = massFullKg;
        sim.primaryMixEnergyKJ = uNow * massFullKg;
      }
      const st = solveSaturatedMixture(L.PRIMARY_VOLUME_M3 / sim.primaryMixMassKg, sim.primaryMixEnergyKJ / sim.primaryMixMassKg);
      sim.primaryQuality = st.x;
      sim.primaryMixH = st.props.hf + st.x * (st.props.hg - st.props.hf);
      sim.primaryMixRho = sim.primaryMixMassKg / L.PRIMARY_VOLUME_M3;
      // Объёмная доля воды в контуре — «коллапсированный» уровень, по нему видно осушение зоны
      sim.primaryLiquidFrac = Math.min(1, (1 - st.x) * st.props.vf * sim.primaryMixMassKg / L.PRIMARY_VOLUME_M3);
      sim.primaryInventoryPct = sim.primaryMixMassKg / ((massNomT + 33.0) * 1000.0) * 100.0;
      sim.primaryMassT = sim.primaryMixMassKg / 1000.0;
      sim.pressurizerLevelM = Math.max(0, Math.min(11.2, (sim.primaryLiquidFrac - 0.80) / 0.20 * 8.17));
      const tSat = st.T;
      sim.coreOutletTempC = tSat;
      sim.coreInletTempC = tSat;
      sim.loops.forEach((lp) => { lp.tHot = tSat; lp.tCold = tSat; });
      sim.primaryPressureMPa = Math.max(sim.containmentPressMPa + 0.01, st.props.P);
      if (sim.primaryLiquidFrac < 0.45) {
        noteSafetyEvent('uncover', `Объёмная доля воды в 1-м контуре ${Math.round(sim.primaryLiquidFrac * 100)} % — угроза осушения активной зоны.`, 'danger');
      }
      if (sim.loops.some((lp) => lp.pumpOn)) {
        sim.loops.forEach((lp) => { lp.pumpOn = false; });
        noteSafetyEvent('rcpTrip', 'Отключение ГЦНА-1…4 при потере запаса до кипения (◇ защита модели): переход на естественную циркуляцию.', 'danger');
      }
    }

    // 7.8 Гермооболочка: давление воздуха и насыщенного пара; приток энергии из разрыва, стоки — конструкции, спринклер, СПОТ ГО
    const tc = sim.containmentTempC;
    const tcK = tc + 273.15;
    const t0K = CT.T0_C + 273.15;
    const pAir0 = CT.P0_MPA - calcSaturationPressureMPa(CT.T0_C);
    const airKg = pAir0 * 1000.0 * CT.FREE_VOLUME_M3 / (0.287 * t0K);
    const hOut = sim.primarySaturated ? (sim.primaryMixH || waterEnthalpyKJkg(sim.coreOutletTempC)) : waterEnthalpyKJkg(sim.coreOutletTempC);
    const qInMW = breakKgS * Math.max(0, hOut - waterEnthalpyKJkg(tc)) / 1000.0;
    const qWallMW = CT.WALL_UA_MW_PER_K * (tc - sim.containmentWallTempC);
    if (!sim.sprinklerActive && sim.acPower !== false && sim.containmentPressMPa > CT.SPRAY_SIGNAL_MPA) {
      sim.sprinklerActive = true;
      safeLog(`СПРИНКЛЕРНАЯ СИСТЕМА (JMN): давление в ГО ${ru(sim.containmentPressMPa, 3)} МПа > 0,13 МПа — подача раствора под купол.`, 'danger');
    }
    const qSprayMW = sim.sprinklerActive ? CT.SPRAY_KG_S * 4.19 * Math.max(0, tc - CT.SPRAY_T_C) / 1000.0 : 0;
    const qSpotMW = tc > CT.SPOT_START_C ? CT.SPOT_UA_MW_PER_K * (tc - CT.SPOT_START_C) : 0;
    sim.spotGoHeatMW = qSpotMW;
    const dPsat = (calcSaturationPressureMPa(tc + 0.5) - calcSaturationPressureMPa(tc - 0.5)) * 1000.0;   // кПа/К
    const steamKgPerK = dPsat * CT.FREE_VOLUME_M3 / (0.4615 * tcK);
    const cAtmMJperK = (airKg * 0.718 + steamKgPerK * latentHeatKJkg(tc)) / 1000.0;
    sim.containmentTempC += (qInMW - qWallMW - qSprayMW - qSpotMW) / Math.max(50.0, cAtmMJperK) * dt;
    sim.containmentWallTempC += qWallMW / CT.WALL_C_MJ_PER_K * dt;
    sim.containmentPressMPa = pAir0 * (sim.containmentTempC + 273.15) / t0K + calcSaturationPressureMPa(sim.containmentTempC);

    // Запас до кипения ΔTs
    const tSatPrimary = calcSaturationTempC(sim.primaryPressureMPa);
    sim.subcoolingMarginC = Math.max(0, tSatPrimary - sim.coreOutletTempC);

    // 8. АВТОМАТИЧЕСКИЕ УСТАВКИ АВАРИЙНОЙ ЗАЩИТЫ АЗ-1
    if (!sim.az1Tripped) {
      // Уставки АЗ для В-491 в источниках сайта не найдены (PROJECT_MAP 3.2, ⚠): значения — оценка модели (◇)
      if (sim.thermalPowerMW > 3424.0) { // > 107% Nном
        triggerAZ1('Превышение тепловой мощности реактора > 107% Nном (3424 МВт; уставка модели)');
      } else if (sim.primaryPressureMPa > 17.8) {
        triggerAZ1('Превышение давления в 1-м контуре > 17,8 МПа (уставка модели)');
      } else if (sim.subcoolingMarginC < 5.5) {
        triggerAZ1('Снижение запаса до кипения ΔTs на выходе из реактора < 5,5 °C (уставка модели)');
      }
    }

    // 9. ЭЛЕКТРИЧЕСКАЯ МОЩНОСТЬ ТУРБОГЕНЕРАТОРА ТЗВ-1200-2
    const targetElecMW = Math.max(0, (turbineSteamDemandMW / 3200.0) * 1200.0 * Math.min(1.0, sim.thermalPowerMW / Math.max(100, turbineSteamDemandMW)));
    sim.electricalPowerMW += (targetElecMW - sim.electricalPowerMW) * Math.min(1, 2.0 * dt);
    sim.turbineRpm = sim.turbineValvePct > 2 ? 3000 : Math.max(0, sim.turbineRpm - 180 * dt);
  }

  // 10. ОБНОВЛЕНИЕ ПАРАМЕТРОВ 163 ТВС ДЛЯ КАРТОГРАММЫ
  const assemblies = (typeof coreAssemblies !== 'undefined') ? coreAssemblies : ((typeof window !== 'undefined' && window.coreAssemblies) ? window.coreAssemblies : []);
  if (assemblies && assemblies.length > 0) {
    let maxKq = 0;
    const g10Factor = 1.0 - 0.16 * ((100 - sim.group10Pos) / 100);
    const g19Factor = 1.0 - 0.35 * ((100 - sim.groups1to9Pos) / 100);
    for (let i = 0; i < assemblies.length; i++) {
      const a = assemblies[i];
      let localDepression = 1.0;
      if (a.hasRod) {
        if (a.rodGroup === 12) localDepression = g10Factor;
        else localDepression = g19Factor;
      }
      a.currentKq = a.baseKq * localDepression;
    }
    // Стержни перераспределяют поле, но среднее Kq по зоне остаётся равным 1
    const kqMean = assemblies.reduce((acc, a) => acc + a.currentKq, 0) / assemblies.length;
    for (let i = 0; i < assemblies.length; i++) {
      const a = assemblies[i];
      a.currentKq /= kqMean;
      if (a.currentKq > maxKq) maxKq = a.currentKq;
      a.powerMW = (sim.thermalPowerMW / assemblies.length) * a.currentKq;
      a.outletTemp = sim.coreInletTempC + (sim.coreOutletTempC - sim.coreInletTempC) * a.currentKq;
    }
    sim.kqMax = maxKq;
    sim.avgBurnupGWdT = Number((assemblies.reduce((acc, a) => acc + (a.burnupMWd || 0), 0) / assemblies.length).toFixed(2));
  }
}

/**
 * Дискретный макро-шаг моделирования (Таймскип: +8ч, +1м, +6м, +12м)
 * Аналитически пересчитывает йодную яму (I-135 / Xe-135), выгорание топлива (ГВт·сут/т),
 * критическую концентрацию борной кислоты H3BO3, перераспределение поля Kq и кривую расхолаживания.
 * @param {string} skipKey - '8h' | '1m' | '6m' | '12m'
 */
function applyTimeSkip(skipKey) {
  const configs = {
    '8h':  { days: 8.0 / 24.0, seconds: 8 * 3600,       months: 0,  label: '+8 часов (Йодная яма / Ксенон)' },
    '1m':  { days: 30.0,       seconds: 30 * 86400,     months: 1,  label: '+1 месяц (Выгорание топлива)' },
    '6m':  { days: 180.0,      seconds: 180 * 86400,    months: 6,  label: '+6 месяцев (Середина кампании — МАК)' },
    '12m': { days: 365.0,      seconds: 365 * 86400,    months: 12, label: '+12 месяцев (Конец кампании — КАК)' }
  };
  const cfg = configs[skipKey];
  if (!cfg) return;

  sim.time += cfg.seconds;
  sim.operationalDays = (typeof sim.operationalDays === 'number' ? sim.operationalDays : 0.0) + cfg.days;
  if (typeof sim.criticalBoronConc !== 'number') {
    sim.criticalBoronConc = 6.20;
  }

  const xenon = NUCLEAR_CONSTANTS.XENON_CONSTANTS;
  const iodineShare = xenon.YIELD_IODINE / (xenon.YIELD_IODINE + xenon.YIELD_XENON);
  const assemblies = (typeof coreAssemblies !== 'undefined')
    ? coreAssemblies
    : ((typeof window !== 'undefined' && window.coreAssemblies) ? window.coreAssemblies : []);

  if (sim.az1Tripped) {
    // --- РЕЖИМ АКТИВНОЙ АЗ-1: ПОДКРИТИЧНОСТЬ И ОСТАТОЧНОЕ ТЕПЛОВЫДЕЛЕНИЕ (ВЭЙ-ВИГНЕР) ---
    sim.group10Pos = 0.0;
    sim.groups1to9Pos = 0.0;
    sim.armEnabled = false;
    sim.neutronFlux = 0.00005;
    sim.precursors = 0.00005;
    if (Array.isArray(sim.delayedPrecursors)) {
      sim.delayedPrecursors = sim.delayedPrecursors.map(() => 0.00005);
    }
    sim.scramElapsedSeconds = (typeof sim.scramElapsedSeconds === 'number' && sim.scramElapsedSeconds > 0 ? sim.scramElapsedSeconds : 10.0) + cfg.seconds;

    // Интегрирование ОДУ I-135 и Xe-135 при нулевом потоке нейтронов (распад I-135 в пик Xe-135 и последующий распад)
    const integrateSec = Math.min(cfg.seconds, 15 * 86400);
    const stepDt = 20.0;
    const nSteps = Math.ceil(integrateSec / stepDt);
    const dt = integrateSec / nSteps;
    for (let i = 0; i < nSteps; i++) {
      const dI = xenon.LAMBDA_IODINE * (0.0 - sim.iodine135);
      const dXe = xenon.LAMBDA_XENON * (
        (1.0 + xenon.BURNUP_RATIO) * (iodineShare * sim.iodine135) - sim.xenon135
      );
      sim.iodine135 = Math.max(0.05, Math.min(3.0, sim.iodine135 + dI * dt));
      sim.xenon135 = Math.max(0.05, Math.min(2.8, sim.xenon135 + dXe * dt));
    }

    // Расчет кривой остаточного тепловыделения (многогрупповая экспонента + формула Вэя-Вигнера)
    const decay = NUCLEAR_CONSTANTS.DECAY_HEAT;
    if (!sim.decayGroups) {
      sim.decayGroups = decay.FRACTIONS.map(f => f * sim.decayHeatMW);
    }
    decay.LAMBDAS.forEach((l, idx) => {
      sim.decayGroups[idx] *= Math.exp(-l * cfg.seconds);
    });
    const groupSumMW = sim.decayGroups.reduce((acc, v) => acc + v, 0);
    const tCool = Math.max(10.0, sim.scramElapsedSeconds);
    const tOp = 365.0 * 86400.0;
    const wayWignerMW = 3200.0 * 0.066 * (Math.pow(tCool, -0.2) - Math.pow(tCool + tOp, -0.2));
    sim.decayHeatMW = Math.max(1.5, Math.max(groupSumMW, wayWignerMW));
    sim.decayGroups = decay.FRACTIONS.map(f => f * sim.decayHeatMW);
    sim.decaySynced = sim.decayHeatMW;
    sim.thermalPowerMW = sim.decayHeatMW;
    sim.electricalPowerMW = 0.0;
    sim.turbineValvePct = 0.0;
    sim.turbineRpm = 0;

    // Расхолаживание теплоносителя 1-го и 2-го контуров
    const coolFrac = Math.min(1.0, sim.decayHeatMW / 215.0);
    sim.steamHeaderPressMPa = Number(Math.max(0.8, 0.8 + 6.0 * coolFrac).toFixed(2));
    sim.steamTempC = calcSaturationTempC(sim.steamHeaderPressMPa);
    sim.coreInletTempC = Number((sim.steamTempC + 2.5 * coolFrac).toFixed(1));
    sim.coreOutletTempC = Number((sim.coreInletTempC + Math.max(1.2, 24.0 * coolFrac)).toFixed(1));
    sim.fuelTempC = Number((0.5 * (sim.coreInletTempC + sim.coreOutletTempC) + 38.0 * coolFrac).toFixed(1));
    sim.loops.forEach((lp, idx) => {
      lp.tCold = sim.coreInletTempC;
      lp.tHot = sim.coreOutletTempC;
      lp.sgPressMPa = sim.steamHeaderPressMPa + (idx * 0.01 - 0.015);
    });
    const tSatP1 = calcSaturationTempC(sim.primaryPressureMPa);
    sim.subcoolingMarginC = Math.max(0, tSatP1 - sim.coreOutletTempC);

    safeLog(`ТАЙМСКИП [${cfg.label}] (РЕЖИМ АЗ-1): Подкритическое расхолаживание (+${cfg.days.toFixed(1)} сут). Nост = ${sim.decayHeatMW.toFixed(1)} МВт (${(sim.decayHeatMW / 32.0).toFixed(2)}% Nном), Xe-135 = ${sim.xenon135.toFixed(2)} отн. ед., Tвых = ${sim.coreOutletTempC.toFixed(1)} °C.`, 'warn');
  } else {
    // --- ЭНЕРГЕТИЧЕСКИЙ РЕЖИМ РАБОТЫ НА МОЩНОСТИ ---
    const powerFrac = Math.max(0.05, sim.thermalPowerMW / 3200.0);

    if (skipKey === '8h') {
      // Шаг интегрирования уравнений Йода-135 и Ксенона-135 вперед на +8 часов (28800 с)
      // На стационарной мощности I/Xe уже в равновесии и за 8 ч не меняются: переходный процесс
      // появляется только после изменения мощности (см. сценарий 3), а не придумывается таймскипом.
      const stepDt = 10.0;
      const nSteps = Math.ceil(cfg.seconds / stepDt);
      const fluxForXe = sim.neutronFlux;
      for (let i = 0; i < nSteps; i++) {
        const dI = xenon.LAMBDA_IODINE * (fluxForXe - sim.iodine135);
        const dXe = xenon.LAMBDA_XENON * (
          (1.0 + xenon.BURNUP_RATIO) * (iodineShare * sim.iodine135 + (1.0 - iodineShare) * fluxForXe)
          - (1.0 + xenon.BURNUP_RATIO * fluxForXe) * sim.xenon135
        );
        sim.iodine135 = Math.max(0.05, Math.min(3.0, sim.iodine135 + dI * stepDt));
        sim.xenon135 = Math.max(0.05, Math.min(2.8, sim.xenon135 + dXe * stepDt));
      }

      const deltaBurnup8h = 0.0416 * cfg.days * powerFrac;
      if (assemblies && assemblies.length > 0) {
        assemblies.forEach(a => {
          a.burnupMWd = Number((a.burnupMWd + deltaBurnup8h * a.currentKq).toFixed(2));
          a.burnup = `${a.campaignYear}-й год (${a.burnupMWd.toFixed(1)} МВт·сут/кг)`;
        });
      }

      // Автоматическая борная компенсация СБР для удержания критичности в йодной яме
      const avgCoolant = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
      const rhoDop = -(sim.fuelTempC - 680.0) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_DOPPLER);
      const rhoMod = -(avgCoolant - 314.15) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_MODERATOR);
      const rhoXe = -(sim.xenon135 - 1.0) * NUCLEAR_CONSTANTS.FEEDBACKS.XENON_WORTH_FACTOR;
      const rhoRods = (sim.group10Pos - 72.4) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G10 +
                      (sim.groups1to9Pos - 100.0) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G19;
      const nonBoronRho = rhoDop + rhoMod + rhoXe + rhoRods;
      const alphaB = Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_BORON);
      const newBoron = sim.criticalBoronConc + nonBoronRho / alphaB;
      sim.boronConc = Number(Math.max(0.50, Math.min(12.0, newBoron)).toFixed(2));

      safeLog(`ТАЙМСКИП [${cfg.label}]: Шаг +8 ч выполнен (наработка ${sim.operationalDays.toFixed(1)} сут). Йод-135 = ${sim.iodine135.toFixed(2)}, Ксенон-135 = ${sim.xenon135.toFixed(2)} отн. ед. (ρ_Xe = ${Math.round(rhoXe)} pcm), C(H₃BO₃) = ${sim.boronConc.toFixed(2)} г/кг.`, 'info');
    } else {
      // --- МАКРО-ШАГ ВЫГОРАНИЯ КАМПАНИИ (+1, +6, +12 МЕСЯЦЕВ) ---
      // 1. Увеличение среднего выгорания топлива (ГВт·сут/т = МВт·сут/кг)
      const deltaBurnupAvg = 0.0416 * cfg.days * Math.max(0.25, powerFrac);

      // 2. Снижение базовой критической концентрации борной кислоты H3BO3 по мере выгорания (до 0.50 г/кг в КАК)
      const boronDepletionMap = {
        '1m':  0.65,
        '6m':  3.20,
        '12m': 5.70
      };
      const boronDrop = (boronDepletionMap[skipKey] || 0.65) * Math.max(0.5, powerFrac);
      sim.criticalBoronConc = Number(Math.max(0.50, sim.criticalBoronConc - boronDrop).toFixed(2));

      // 3. Стационарное равновесие I-135 и Xe-135 на текущей мощности
      sim.iodine135 = Math.max(0.05, Math.min(3.0, sim.neutronFlux));
      sim.xenon135 = Math.max(0.05, Math.min(2.8,
        ((1.0 + xenon.BURNUP_RATIO) * sim.neutronFlux) / (1.0 + xenon.BURNUP_RATIO * sim.neutronFlux)
      ));

      // Установка текущей концентрации бора СБР с учетом температурных/ксеноновых поправок относительно criticalBoronConc
      const avgCoolant = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
      const rhoDop = -(sim.fuelTempC - 680.0) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_DOPPLER);
      const rhoMod = -(avgCoolant - 314.15) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_MODERATOR);
      const rhoXe = -(sim.xenon135 - 1.0) * NUCLEAR_CONSTANTS.FEEDBACKS.XENON_WORTH_FACTOR;
      const rhoRods = (sim.group10Pos - 72.4) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G10 +
                      (sim.groups1to9Pos - 100.0) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G19;
      const nonBoronRho = rhoDop + rhoMod + rhoXe + rhoRods;
      const alphaB = Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_BORON);
      sim.boronConc = Number(Math.max(0.50, Math.min(12.0, sim.criticalBoronConc + nonBoronRho / alphaB)).toFixed(2));

      // 4. Асимптотическое выравнивание (уплощение) радиального поля Kq за счет более быстрого выгорания центральных ТВС
      if (assemblies && assemblies.length > 0) {
        const currentSpread = Math.max(...assemblies.map(a => a.baseKq)) - 1.0;
        const minTargetSpread = 0.105; // Асимптотический предел уплощения поля в КАК (Kq_max ≈ 1.11)
        const rawFlatten = Math.exp(-0.038 * cfg.months * Math.max(0.5, powerFrac));
        const effectiveFlatten = currentSpread > minTargetSpread
          ? Math.max(minTargetSpread / currentSpread, rawFlatten)
          : 1.0;

        for (let i = 0; i < assemblies.length; i++) {
          const a = assemblies[i];
          a.burnupMWd = Number(Math.min(68.0, a.burnupMWd + deltaBurnupAvg * a.currentKq).toFixed(2));
          a.burnup = `${a.campaignYear}-й год (${a.burnupMWd.toFixed(1)} МВт·сут/кг)`;
          a.baseKq = 1.0 + (a.baseKq - 1.0) * effectiveFlatten;
        }
        const meanBase = assemblies.reduce((acc, a) => acc + a.baseKq, 0) / assemblies.length;
        for (let i = 0; i < assemblies.length; i++) {
          assemblies[i].baseKq = Number((assemblies[i].baseKq / meanBase).toFixed(3));
        }
      }
    }
  }

  // Пересчет поля Kq по 163 ТВС и среднего выгорания зоны
  if (assemblies && assemblies.length > 0) {
    let maxKq = 0;
    let totalBurnup = 0;
    const g10Factor = 1.0 - 0.16 * ((100 - sim.group10Pos) / 100);
    const g19Factor = 1.0 - 0.35 * ((100 - sim.groups1to9Pos) / 100);
    for (let i = 0; i < assemblies.length; i++) {
      const a = assemblies[i];
      let localDepression = 1.0;
      if (a.hasRod) {
        localDepression = (a.rodGroup === 12) ? g10Factor : g19Factor;
      }
      a.currentKq = a.baseKq * localDepression;
      totalBurnup += a.burnupMWd;
    }
    const kqMean = assemblies.reduce((acc, a) => acc + a.currentKq, 0) / assemblies.length;
    for (let i = 0; i < assemblies.length; i++) {
      const a = assemblies[i];
      a.currentKq /= kqMean;
      if (a.currentKq > maxKq) maxKq = a.currentKq;
      a.powerMW = (sim.thermalPowerMW / assemblies.length) * a.currentKq;
      a.outletTemp = sim.coreInletTempC + (sim.coreOutletTempC - sim.coreInletTempC) * a.currentKq;
      if (typeof updateAssemblyTelemetry === 'function') {
        updateAssemblyTelemetry(a, sim);
      }
    }
    sim.kqMax = maxKq;
    sim.avgBurnupGWdT = Number((totalBurnup / assemblies.length).toFixed(2));
  }

  // Пересчет составляющих реактивности
  const rhoG10 = (sim.group10Pos - 72.4) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G10;
  const rhoG19 = (sim.groups1to9Pos - 100.0) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G19;
  sim.rhoRods = rhoG10 + rhoG19;
  sim.rhoBoron = -(sim.boronConc - sim.criticalBoronConc) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_BORON);
  sim.rhoDoppler = -(sim.fuelTempC - 680.0) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_DOPPLER);
  const avgCoolantTempC = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
  const voidPenalty = sim.subcoolingMarginC < 2.0 ? (2.0 - sim.subcoolingMarginC) * 45.0 : 0;
  sim.rhoModerator = -(avgCoolantTempC - 314.15) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_MODERATOR) - voidPenalty;
  sim.rhoXenon = -(sim.xenon135 - 1.0) * NUCLEAR_CONSTANTS.FEEDBACKS.XENON_WORTH_FACTOR;
  sim.rhoTotal = sim.rhoRods + sim.rhoBoron + sim.rhoDoppler + sim.rhoModerator + sim.rhoXenon;

  if (!sim.az1Tripped && skipKey !== '8h') {
    safeLog(`ТАЙМСКИП [${cfg.label}]: Наработка +${cfg.days.toFixed(0)} эфф. сут (всего ${sim.operationalDays.toFixed(1)} сут). Среднее выгорание: ${sim.avgBurnupGWdT.toFixed(2)} ГВт·сут/т, C(H₃BO₃) = ${sim.boronConc.toFixed(2)} г/кг, Kq_max = ${sim.kqMax.toFixed(2)}.`, 'ok');
  }

  // Мгновенное обновление всех экранов интерфейса (DOM, графики, Canvas, БЩУ, картограмма)
  if (typeof window !== 'undefined') {
    if (typeof window.updateDOMTelemetry === 'function') window.updateDOMTelemetry();
    if (typeof window.sampleCharts === 'function') window.sampleCharts(performance.now(), true);
    if (typeof window.renderCanvas === 'function') window.renderCanvas(0.016);
    if (typeof window.refreshControlsPanel === 'function') window.refreshControlsPanel();
    if (assemblies && assemblies.length > 0 && typeof syncCoreInfoPanelDOM === 'function' && typeof getAssemblyRodState === 'function') {
      const selFA = assemblies.find(item => item.id === (sim.selectedAssemblyId || 82)) || assemblies[81] || assemblies[0];
      syncCoreInfoPanelDOM(selFA, getAssemblyRodState(selFA, sim));
    }
  }
}

// ============================================================================
// 5. ЯВНАЯ ПРИВЯЗКА К ГЛОБАЛЬНОМУ ОБЪЕКТУ (window)
// ============================================================================
if (typeof window !== 'undefined') {
  window.sim = sim;
  window.stepPhysics = stepPhysics;
  window.applyTimeSkip = applyTimeSkip;
  window.calcSaturationTempC = calcSaturationTempC;
  window.calcSaturationPressureMPa = calcSaturationPressureMPa;
  window.resetSafetyState = resetSafetyState;
  window.startBlackout = startBlackout;
  window.startLoca = startLoca;
  window.triggerAZ1 = triggerAZ1;
  window.resetPhysicsToNominal = resetPhysicsToNominal;
  window.NUCLEAR_CONSTANTS = NUCLEAR_CONSTANTS;
}
