/**
 * ============================================================================
 * ReactorLab // Физико-математическое ядро ВВЭР-1200 (physics_engine.js)
 * Цифровой двойник реакторной установки В-491 (БелАЭС) Поколения III+
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
    ALPHA_BORON: -1400.0,        // α_B ≈ -8 pcm/ppm B (1 г/кг H3BO3 = 175 ppm B); инженерная оценка
    ROD_WORTH_G10: 9.5,          // Дифференциальная эффективность рабочей группы №12 (pcm/%)
    ROD_WORTH_G19: 65.0,         // Дифференциальная эффективность аварийных групп №1-11 (pcm/%)
    XENON_WORTH_FACTOR: 2850.0   // Вес равновесного ксенона, pcm (ρ_Xe = -2850 pcm при Xe/Xe₀ = 1)
  },

  // Номинальные параметры энергоблока ВВЭР-1200 (В-491)
  NOMINAL: {
    THERMAL_POWER_MW: 3200.0,
    ELECTRIC_POWER_MW: 1200.0,
    PRIMARY_PRESSURE_MPA: 16.20,
    CORE_INLET_TEMP_C: 298.2,
    CORE_OUTLET_TEMP_C: 328.9,
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

  // Парогенератор: ε₀ задаёт T_хол = 298.2 °C при T_гор = 328.9 °C и P₂ = 7.0 МПа
  STEAM_GEN: {
    TSAT_NOMINAL_C: 285.83,
    NTU_NOMINAL: 1.2476,
    AUTO_RELIEF_PRESS_MPA: 7.35, // Уставка автоматического сброса пара (БРУ-К)
    AUTO_RELIEF_MW_PER_MPA: 8000.0,
    THERMAL_CAPACITY_MJ_PER_K: 5000.0 // Теплоноситель, вода ПГ и металл контуров, оценка
  },

  // Водообмен СВО при вводе бора / дистиллята: 40 т/ч на ~290 т теплоносителя
  ROD_SPEED_PCT_PER_S: 0.54,     // Привод ШЭМ-3: 20 мм/с при высоте зоны 373 см
  BORON_EXCHANGE_PER_S: 3.8e-5,
  BORON_CONCENTRATE_G_KG: 40.0
};

// ============================================================================
// 2. ГЛОБАЛЬНЫЙ ОБЪЕКТ СОСТОЯНИЯ СИМУЛЯТОРА (sim)
// ============================================================================
var sim = {
  time: 0,
  timeSpeed: 1,
  timeScale: 1,
  viewMode: 'systems',        // 'systems' | 'controls' | 'core' | '3d'
  systemsSubMode: 'panorama', // 'panorama' | 'loops' | 'cross'
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

  // Борное регулирование (СБР) и Ксенон-135
  boronConc: 6.20,            // г/кг H3BO3 (при 6.20 г/кг и Гр12=72.4% реактор критичен)
  boronMode: 0,               // 0 = нейтрально, +1 = ввод бора, -1 = ввод дистиллята
  iodine135: 1.0,             // Относительная концентрация I-135 (1.0 = равновесие на 100%)
  xenon135: 1.0,              // Относительная концентрация Xe-135 (1.0 = равновесие на 100%)

  // Составляющие реактивности (в pcm = 10^-5 Δk/k)
  rhoRods: 0,
  rhoBoron: 0,
  rhoDoppler: 0,
  rhoModerator: 0,
  rhoXenon: 0,
  rhoTotal: 0,

  // Теплогидравлика 1-го контура
  fuelTempC: 680.0,           // Средняя температура топлива UO2 (°C)
  coreInletTempC: 298.2,      // T_вх активной зоны (°C)
  coreOutletTempC: 328.9,     // T_вых активной зоны (°C)
  primaryPressureMPa: 16.20,  // Давление 1-го контура P1 (МПа)
  pressurizerLevelM: 8.40,    // Уровень воды в КД (м, норма 8.4 м)
  heatersMode: 'AUTO',        // 'AUTO' | 'ON' | 'OFF'
  heatersPowerKW: 900,        // Текущая мощность ТЭНов КД (0..2700 кВт)
  sprayActive: false,         // Впрыск холодной воды в паровое пространство КД
  ipuKdOpen: false,           // Открыт ли ИПУ КД (аварийный сброс давления в барботер)
  primaryLeakActive: false,   // Малая течь теплоносителя 1-го контура
  subcoolingMarginC: 19.46,   // Запас до кипения ΔTs в горячих нитках (°C)
  kqMax: 1.27,

  // 4 петли ГЦК и 4 горизонтальных парогенератора ПГВ-1000МКП
  loops: [
    { id: 1, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
    { id: 2, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
    { id: 3, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
    { id: 4, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 }
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
  saozActive: false,          // Гидроемкости САОЗ первой ступени (ГЕ-1)
  saozWaterPct: 100.0,        // Запас борированной воды (16 г/кг) в гидроемкостях (%)
  spotActive: false,          // СПОТ (Система пассивного отвода тепла через дефлекторы)
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
  targetSim.iodine135 = 1.0;
  targetSim.xenon135 = 1.0;
  targetSim.fuelTempC = 680.0;
  targetSim.coreInletTempC = 298.2;
  targetSim.coreOutletTempC = 328.9;
  targetSim.primaryPressureMPa = 16.20;
  targetSim.pressurizerLevelM = 8.40;
  targetSim.heatersMode = 'AUTO';
  targetSim.heatersPowerKW = 900;
  targetSim.subcoolingMarginC = 19.46;
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
    l.tHot = 328.9;
    l.tCold = 298.2;
    l.sgLevelM = 2.10;
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

    // 1. ДВИЖЕНИЕ ОР СУЗ (ШЭМ-3)
    if (sim.az1Tripped) {
      // Гравитационный сброс всех групп ОР СУЗ в активную зону за ~3.5 секунды
      sim.group10Pos = Math.max(0, sim.group10Pos - 28.0 * dt);
      sim.groups1to9Pos = Math.max(0, sim.groups1to9Pos - 28.0 * dt);
    } else {
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
    }

    // 2. СИСТЕМА БОРНОГО РЕГУЛИРОВАНИЯ (СБР) И САОЗ
    // Водообмен: dC/dt = (G/M)·(C_вх − C)
    if (sim.boronMode === 1) {
      sim.boronConc += NUCLEAR_CONSTANTS.BORON_EXCHANGE_PER_S * (NUCLEAR_CONSTANTS.BORON_CONCENTRATE_G_KG - sim.boronConc) * dt;
    } else if (sim.boronMode === -1) {
      sim.boronConc = Math.max(0.0, sim.boronConc - NUCLEAR_CONSTANTS.BORON_EXCHANGE_PER_S * sim.boronConc * dt);
    }

    // Если активны гидроемкости САОЗ, они подают высокоборированную воду (16 г/кг)
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
    // Эффективность рабочей группы №12 (~900 pcm), групп АЗ (~6500 pcm)
    // В номинале: группы АЗ = 100%, Гр. 12 = 72.4% -> rhoRods = 0 pcm
    const rhoG10 = (sim.group10Pos - 72.4) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G10;
    const rhoG19 = (sim.groups1to9Pos - 100.0) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G19;
    sim.rhoRods = rhoG10 + rhoG19;

    // Эффективность борной кислоты: alpha_B = -85 pcm / (г/кг)
    // В номинале C_boron = 6.20 г/кг -> rhoBoron = 0 pcm
    sim.rhoBoron = -(sim.boronConc - 6.20) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_BORON);

    // Допплеровский температурный коэффициент топлива: СТРОГО ОТРИЦАТЕЛЬНЫЙ (-2.8 pcm/°C)
    // В номинале T_fuel = 680 °C -> rhoDoppler = 0 pcm
    sim.rhoDoppler = -(sim.fuelTempC - 680.0) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_DOPPLER);

    // Температурный коэффициент теплоносителя (модератора): СТРОГО ОТРИЦАТЕЛЬНЫЙ (-34.0 pcm/°C)
    // В номинале T_avg = 313.55 °C -> rhoModerator = 0 pcm
    const avgCoolantTempC = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
    // Учет паросодержания при вскипании (void penalty < 0)
    const voidPenalty = sim.subcoolingMarginC < 2.0 ? (2.0 - sim.subcoolingMarginC) * 45.0 : 0;
    sim.rhoModerator = -(avgCoolantTempC - 313.55) * Math.abs(NUCLEAR_CONSTANTS.FEEDBACKS.ALPHA_MODERATOR) - voidPenalty;

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
    for (let i = 0; i < 4; i++) {
      const lp = sim.loops[i];
      if (lp.pumpOn) {
        lp.rpm += (1000 - lp.rpm) * Math.min(1, 0.25 * dt);
      } else {
        // Выбег на маховике: n(t) = n₀ / (1 + t/τ), τ = 30 с; далее естественная циркуляция
        lp.rpm = lp.rpm < 5 ? 0 : lp.rpm - (lp.rpm * lp.rpm / (1000.0 * 30.0)) * dt;
      }
      const natCircPct = 6.8 + 2.2 * ((sim.coreOutletTempC - sim.coreInletTempC) / 30.7);
      lp.flowPct = lp.pumpOn ? (lp.rpm / 1000) * 100 : Math.max(natCircPct, (lp.rpm / 1000) * 100);
      totalLoopFlowPct += lp.flowPct;
    }
    const avgFlowFrac = Math.max(0.065, totalLoopFlowPct / 400.0);

    // Температура топлива UO2 (T_fuel)
    const targetFuelTempC = avgCoolantTempC + (sim.thermalPowerMW / 3200.0) * 366.45;
    sim.fuelTempC += (targetFuelTempC - sim.fuelTempC) * Math.min(1, 1.6 * dt);

    // Перепад температур в активной зоне ΔT = N / (G * Cp)
    const coreDeltaT = (sim.thermalPowerMW / 3200.0) / avgFlowFrac * 30.7;

    // Теплоотвод в 4 горизонтальных парогенераторах ПГВ-1000МКП и через СПОТ
    const spotHeatRemovalMW = sim.spotActive ? 145.0 * Math.max(0.2, (sim.steamTempC - 100) / 185.8) : 0.0;
    const bruKHeatMW = sim.bruKOpen ? 650.0 * (sim.steamHeaderPressMPa / 7.0) : 0.0;
    const bruAHeatMW = sim.bruAOpen ? 480.0 * (sim.steamHeaderPressMPa / 7.0) : 0.0;

    // Потребление пара турбиной К-1200-6,8/50
    const turbineSteamDemandMW = (sim.turbineValvePct / 100.0) * 3200.0 * (sim.steamHeaderPressMPa / 7.0);
    const steamGen = NUCLEAR_CONSTANTS.STEAM_GEN;
    const autoReliefMW = Math.min(3200.0, Math.max(0, sim.steamHeaderPressMPa - steamGen.AUTO_RELIEF_PRESS_MPA) * steamGen.AUTO_RELIEF_MW_PER_MPA);
    const totalSecondarySinkMW = turbineSteamDemandMW + spotHeatRemovalMW + bruKHeatMW + bruAHeatMW + autoReliefMW;

    // Теплота, отданная в ПГ, равна G·cp·(Tгор − Tхол) по каждой петле
    const heatTransferPrimaryToSecondaryMW = sim.loops.reduce((acc, lp) => (
      acc + 800.0 * (Math.max(0.065, lp.flowPct / 100.0)) * ((lp.tHot - lp.tCold) / 30.7)
    ), 0);
    // Избыток тепла греет теплоноситель, воду ПГ и металл вместе: dT = Q / C, dP = dT / (dT_нас/dP)
    const tsatSlope = (calcSaturationTempC(sim.steamHeaderPressMPa + 0.01) - sim.steamTempC) / 0.01;
    const dSteamTemp = (heatTransferPrimaryToSecondaryMW - totalSecondarySinkMW) / steamGen.THERMAL_CAPACITY_MJ_PER_K;
    const dSteamPress = dSteamTemp / Math.max(1.0, tsatSlope);
    sim.steamHeaderPressMPa = Math.max(0.8, Math.min(8.6, sim.steamHeaderPressMPa + dSteamPress * dt));
    sim.steamTempC = calcSaturationTempC(sim.steamHeaderPressMPa);

    // Обновление температур горячей и холодной ниток по всем 4 петлям
    let sumCold = 0;
    let sumColdFlow = 0;
    for (let i = 0; i < 4; i++) {
      const lp = sim.loops[i];
      const loopFlowFactor = Math.max(0.065, lp.flowPct / 100.0);
      // Горячие нитки питаются из общей камеры над зоной: T_вых одна на все петли
      const targetTHot = sim.coreInletTempC + coreDeltaT;
      lp.tHot += (Math.min(365, targetTHot) - lp.tHot) * Math.min(1, 1.5 * dt);

      // Холодная нитка охлаждается в ПГВ-1000МКП до температуры пара + температурный напор
      const sgEff = Math.max(0.15, Math.min(1.0, lp.sgLevelM / 2.1));
      // Эффективность теплообменника ε = 1 − exp(−NTU), NTU ~ G^(−0.65)
      const sgNtu = steamGen.NTU_NOMINAL * Math.pow(loopFlowFactor, -0.65);
      const sgEffectiveness = (1.0 - Math.exp(-sgNtu)) * sgEff;
      const targetTCold = sim.steamTempC + (lp.tHot - sim.steamTempC) * (1.0 - sgEffectiveness);
      lp.tCold += (targetTCold - lp.tCold) * Math.min(1, 1.5 * dt);
      // Смешение в напорной камере: вход в зону взвешен по расходам петель
      sumCold += lp.tCold * loopFlowFactor;
      sumColdFlow += loopFlowFactor;

      // Уровень котловой воды в ПГВ-1000МКП (норма 2.10 м)
      // Регулятор питания держит уровень; feedwaterFlowPct задаёт доступную производительность ПЭН
      // Конденсат СПОТ возвращается в ПГ, поэтому уровень этим отводом не расходуется
      const steamGenOutPct = (Math.max(0, heatTransferPrimaryToSecondaryMW - spotHeatRemovalMW) / 3200.0) * 100.0;
      const feedDemandPct = steamGenOutPct + (2.10 - lp.sgLevelM) * 50.0;
      const feedActualPct = Math.max(0, Math.min(feedDemandPct, sim.feedwaterFlowPct * 1.15));
      const dLevel = (feedActualPct - steamGenOutPct) * 0.0018;
      lp.sgLevelM = Math.max(0.4, Math.min(3.2, lp.sgLevelM + dLevel * dt));
      lp.sgPressMPa = sim.steamHeaderPressMPa + (i * 0.01 - 0.015);
    }

    sim.coreInletTempC = sumCold / sumColdFlow;
    sim.coreOutletTempC = Math.min(370.0, sim.coreInletTempC + coreDeltaT);

    // 7. КОМПЕНСАТОР ДАВЛЕНИЯ (КД) И ДАВЛЕНИЕ 1-ГО КОНТУРА
    // Уровень в КД зависит от средней температуры теплоносителя 1-го контура и течи/САОЗ
    const avgTemp = 0.5 * (sim.coreInletTempC + sim.coreOutletTempC);
    const thermalExpansionLevel = 8.40 + (avgTemp - 313.55) * 0.095;
    let leakDelta = 0;
    if (sim.primaryLeakActive) {
      leakDelta -= 0.14 * dt;
      sim.primaryPressureMPa -= 0.24 * dt;
    }
    if (sim.saozActive && sim.saozWaterPct > 0 && sim.primaryPressureMPa < 6.5) {
      leakDelta += 0.16 * dt;
      sim.primaryPressureMPa += 0.19 * dt;
    }
    sim.pressurizerLevelM = Math.max(1.8, Math.min(11.2, sim.pressurizerLevelM + (thermalExpansionLevel - sim.pressurizerLevelM) * 0.3 * dt + leakDelta));

    // Логика ТЭНов КД
    if (sim.heatersMode === 'AUTO') {
      const pErr = 16.20 - sim.primaryPressureMPa;
      sim.heatersPowerKW = Math.max(0, Math.min(2700, Math.round(900 + pErr * 3200)));
    } else if (sim.heatersMode === 'ON') {
      sim.heatersPowerKW = 2700;
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

    const heaterPressEffect = ((sim.heatersPowerKW - 900) / 1800) * 0.045;
    const sprayPressEffect = sim.sprayActive ? -0.14 : 0;
    const ipuPressEffect = sim.ipuKdOpen ? -0.35 : 0;
    const tempPressEffect = (avgTemp - 313.55) * 0.018;

    const targetP1 = 16.20 + tempPressEffect;
    if (!sim.primaryLeakActive) {
      sim.primaryPressureMPa += ((targetP1 - sim.primaryPressureMPa) * 0.12 + heaterPressEffect + sprayPressEffect + ipuPressEffect) * dt;
    } else {
      sim.primaryPressureMPa += (heaterPressEffect + sprayPressEffect + ipuPressEffect) * dt;
    }
    sim.primaryPressureMPa = Math.max(1.5, Math.min(19.5, sim.primaryPressureMPa));

    // Автоматический запуск гидроемкостей САОЗ при падении P1 < 5.9 МПа
    if (sim.primaryPressureMPa < 5.9 && !sim.saozActive && sim.saozWaterPct > 0) {
      sim.saozActive = true;
      safeLog('ПАССИВНАЯ ЗАЩИТА САОЗ: Давление 1-го контура ниже 5,9 МПа! Открыты обратные клапаны гидроемкостей ГЕ САОЗ.', 'danger');
      triggerAZ1('Снижение давления 1-го контура ниже уставки САОЗ (5,9 МПа)');
    }

    // Запас до кипения ΔTs
    const tSatPrimary = calcSaturationTempC(sim.primaryPressureMPa);
    sim.subcoolingMarginC = Math.max(0, tSatPrimary - sim.coreOutletTempC);

    // 8. АВТОМАТИЧЕСКИЕ УСТАВКИ АВАРИЙНОЙ ЗАЩИТЫ АЗ-1
    if (!sim.az1Tripped) {
      if (sim.thermalPowerMW > 3424.0) { // > 107% Nном
        triggerAZ1('Превышение тепловой мощности реактора > 107% Nном (3424 МВт)');
      } else if (sim.primaryPressureMPa > 17.8) {
        triggerAZ1('Превышение давления в 1-м контуре > 17,8 МПа');
      } else if (sim.subcoolingMarginC < 5.5) {
        triggerAZ1('Снижение запаса до кипения ΔTs в горячих нитках < 5,5 °C');
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
  }
}

// ============================================================================
// 5. ЯВНАЯ ПРИВЯЗКА К ГЛОБАЛЬНОМУ ОБЪЕКТУ (window)
// ============================================================================
if (typeof window !== 'undefined') {
  window.sim = sim;
  window.stepPhysics = stepPhysics;
  window.calcSaturationTempC = calcSaturationTempC;
  window.triggerAZ1 = triggerAZ1;
  window.resetPhysicsToNominal = resetPhysicsToNominal;
  window.NUCLEAR_CONSTANTS = NUCLEAR_CONSTANTS;
}
