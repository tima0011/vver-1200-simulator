/**
 * ============================================================================
 * ReactorLab // Физико-математическое ядро ВВЭР-1200 (physics_engine.js)
 * Цифровой двойник реакторной установки В-392М Поколения III+
 * ============================================================================
 * Модуль объединяет:
 *  - Фундаментальные константы ядерной физики (6 групп запаздывающих нейтронов, ксенон);
 *  - Динамику точечной кинетики нейтронов с учетом предшественников;
 *  - Температурные и мощностные обратные связи (Доплер, плотность теплоносителя, бор);
 *  - Нестационарное отравление ксеноном-135 и кинетику йодной ямы;
 *  - Теплогидравлику 4 петель ГЦК и парогенераторов ПГВ-1000МКП по стандарту IAPWS-IF97;
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
    LAMBDA_IODINE: 2.87e-5,      // λ_I = 2.87e-5 с^-1 (T_1/2 = 6.57 ч)
    LAMBDA_XENON: 2.09e-5,       // λ_Xe = 2.09e-5 с^-1 (T_1/2 = 9.14 ч)
    NOMINAL_POISONING_PCM: 2850  // Стационарное отравление на 100% мощности (pcm)
  },

  // Температурные и мощностные коэффициенты реактивности
  FEEDBACKS: {
    ALPHA_DOPPLER: -2.8,         // α_D = -2.8 pcm/°C (температурный коэффициент топлива)
    ALPHA_MODERATOR: -34.0,      // α_mod = -34.0 pcm/°C (температурный коэффициент теплоносителя)
    ALPHA_BORON: -85.0,          // α_B = -85.0 pcm / (г/кг H3BO3)
    ROD_WORTH_G10: 9.5,          // Дифференциальная эффективность рабочей группы №10 (pcm/%)
    ROD_WORTH_G19: 65.0,         // Дифференциальная эффективность аварийных групп №1-9 (pcm/%)
    XENON_WORTH_FACTOR: 397.5    // Коэффициент пересчета относительного ксенона в pcm (2650 * 0.15)
  },

  // Номинальные параметры энергоблока ВВЭР-1200 (В-392М)
  NOMINAL: {
    THERMAL_POWER_MW: 3200.0,
    ELECTRIC_POWER_MW: 1200.0,
    PRIMARY_PRESSURE_MPA: 16.20,
    CORE_INLET_TEMP_C: 298.2,
    CORE_OUTLET_TEMP_C: 328.9,
    FUEL_TEMP_C: 680.0,
    STEAM_HEADER_PRESSURE_MPA: 7.00,
    BORON_CONC_G_KG: 6.20,
    GROUP10_POS_PCT: 80.0,
    GROUPS1TO9_POS_PCT: 100.0
  }
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
  decayHeatMW: 195.0,         // Остаточное тепловыделение продуктов деления (~6.1% Nном)

  // ОР СУЗ и АРМ (ШЭМ-3)
  group10Pos: 80.0,           // Рабочая группа №10 (0% = внизу, 100% = вверху)
  groups1to9Pos: 100.0,       // Группы №1-9 (0%..100%)
  withdrawing1to9: false,     // Идет ли подъем групп 1-9
  armEnabled: true,           // Автоматический регулятор мощности
  armTargetMW: 3200.0,        // Уставка АРМ (МВт)
  az1Tripped: false,          // Сигнал аварийной защиты АЗ-1
  az1CoverOpen: false,        // Откинута ли крышка кнопки АЗ-1

  // Борное регулирование (СБР) и Ксенон-135
  boronConc: 6.20,            // г/кг H3BO3 (при 6.20 г/кг и Гр10=80% реактор критичен)
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
  subcoolingMarginC: 19.5,    // Запас до кипения ΔTs в горячих нитках (°C)
  kqMax: 1.25,

  // 4 петли ГЦК и 4 горизонтальных парогенератора ПГВ-1000МКП
  loops: [
    { id: 1, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
    { id: 2, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
    { id: 3, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 },
    { id: 4, pumpOn: true, rpm: 1000, flowPct: 100, tHot: 328.9, tCold: 298.2, sgLevelM: 2.10, sgPressMPa: 7.00 }
  ],

  // 2-й контур и турбоагрегат К-1200-6,8/50
  steamHeaderPressMPa: 7.00,  // Давление в ГПК (МПа)
  steamTempC: 285.8,          // Температура насыщенного пара (°C)
  feedwaterFlowPct: 100.0,    // Производительность ПЭН (%)
  turbineValvePct: 100.0,     // Открытие РК турбины (%)
  turbineRpm: 3000,           // Обороты ротора (3000 об/мин = 50 Гц)
  electricalPowerMW: 1200.0,  // Электрическая мощность ТЗВ-1200-2 (МВт)
  bruKOpen: false,            // БРУ-К (сброс пара в конденсатор)
  bruAOpen: false,            // БРУ-А (сброс пара в атмосферу)

  // Системы пассивной и активной безопасности Поколения III+ (В-392М)
  saozActive: false,          // Гидроемкости САОЗ первой/второй ступени
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
  const p = Math.max(0.2, pMPa);
  return 179.88 * Math.pow(p, 0.2378); // При 16.2 МПа ~ 348.4 °C, при 7.0 МПа ~ 285.8 °C
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
  targetSim.decayHeatMW = 195.0;
  targetSim.group10Pos = 80.0;
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
  targetSim.subcoolingMarginC = 19.5;
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
  const subSteps = scale > 10 ? 12 : 4;
  const dt = totalSimDt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    sim.time += dt;

    // 1. ДВИЖЕНИЕ ОР СУЗ (ШЭМ-3)
    if (sim.az1Tripped) {
      // Гравитационный сброс всех групп ОР СУЗ в активную зону за ~3.5 секунды
      sim.group10Pos = Math.max(0, sim.group10Pos - 32.0 * dt);
      sim.groups1to9Pos = Math.max(0, sim.groups1to9Pos - 32.0 * dt);
    } else {
      if (sim.withdrawing1to9 && sim.groups1to9Pos < 100) {
        sim.groups1to9Pos = Math.min(100, sim.groups1to9Pos + 4.5 * dt);
        if (sim.groups1to9Pos >= 100) {
          sim.withdrawing1to9 = false;
          safeLog('Группы ОР СУЗ №1–9 выведены на верхний концевик (100%).', 'ok');
        }
      }
      // Работа АРМ (Автоматический регулятор мощности)
      if (sim.armEnabled && sim.groups1to9Pos > 85) {
        const powerErrMW = sim.armTargetMW - sim.thermalPowerMW;
        const rateErr = -sim.rhoTotal * 2.2;
        const rodVel = Math.max(-2.5, Math.min(2.5, (powerErrMW * 0.008 + rateErr * 0.015)));
        sim.group10Pos = Math.max(5, Math.min(100, sim.group10Pos + rodVel * dt));
      }
    }

    // 2. СИСТЕМА БОРНОГО РЕГУЛИРОВАНИЯ (СБР) И САОЗ
    if (sim.boronMode === 1) {
      // Ввод концентрата борной кислоты H3BO3 (40 г/кг)
      sim.boronConc = Math.min(16.0, sim.boronConc + 0.045 * dt);
    } else if (sim.boronMode === -1) {
      // Ввод чистого дистиллята (разбавление бора)
      sim.boronConc = Math.max(0.0, sim.boronConc - 0.038 * dt);
    }

    // Если активны гидроемкости САОЗ (ГЕ-1..3), они подают высокоборированную воду (16 г/кг)
    if (sim.saozActive && sim.saozWaterPct > 0) {
      sim.saozWaterPct = Math.max(0, sim.saozWaterPct - 1.2 * dt);
      sim.boronConc = Math.min(16.0, sim.boronConc + (16.0 - sim.boronConc) * 0.06 * dt);
    }

    // 3. ДИНАМИКА КСЕНОНА-135 (ЙОДНАЯ ЯМА)
    // В равновесии при потоке Ф=1.0: I=1.0, Xe=1.0
    const dI = (sim.neutronFlux - sim.iodine135) * 0.012;
    const dXe = (0.85 * sim.iodine135 + 0.15 * sim.neutronFlux - (0.28 + 0.72 * sim.neutronFlux) * sim.xenon135) * 0.018;
    sim.iodine135 = Math.max(0.05, Math.min(3.0, sim.iodine135 + dI * dt));
    sim.xenon135 = Math.max(0.05, Math.min(2.8, sim.xenon135 + dXe * dt));

    // 4. РАСЧЕТ БАЛАНСА РЕАКТИВНОСТИ ВВЭР-1200 (ВНУТРЕННЯЯ САМОЗАЩИЩЕННОСТЬ ПВР)
    // Эффективность рабочей группы №10 (~900 pcm), групп 1-9 (~6500 pcm)
    // В номинале: Гр. 1-9 = 100%, Гр. 10 = 80% -> rhoRods = 0 pcm
    const rhoG10 = (sim.group10Pos - 80.0) * NUCLEAR_CONSTANTS.FEEDBACKS.ROD_WORTH_G10;
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
    const lambda = 0.085;
    // Квазистационарное приближение мгновенного скачка + динамика предшественников
    const targetFlux = Math.max(0.0001, sim.precursors * (beta / Math.max(0.0008, beta - rhoAbs)));
    sim.neutronFlux += (targetFlux - sim.neutronFlux) * Math.min(1.0, 9.0 * dt);
    sim.precursors += lambda * (sim.neutronFlux - sim.precursors) * dt;
    sim.neutronFlux = Math.max(0.00005, Math.min(1.35, sim.neutronFlux));

    // Остаточное энерговыделение продуктов деления (~6.1% от номинала, спадает после останова)
    const targetDecayMW = 195.0 * sim.neutronFlux + 22.0;
    sim.decayHeatMW += (targetDecayMW - sim.decayHeatMW) * 0.04 * dt;

    const fissionPowerMW = 3005.0 * sim.neutronFlux;
    sim.thermalPowerMW = fissionPowerMW + sim.decayHeatMW;

    // 6. ТЕПЛОГИДРАВЛИКА 4 ПЕТЕЛЬ ГЦК И АКТИВНОЙ ЗОНЫ
    let totalLoopFlowPct = 0;
    for (let i = 0; i < 4; i++) {
      const lp = sim.loops[i];
      if (lp.pumpOn) {
        lp.rpm += (1000 - lp.rpm) * Math.min(1, 1.8 * dt);
      } else {
        // Выбег ГЦНА-1391 на маховике и переход на естественную циркуляцию (ЕЦ ~7.5% расхода)
        lp.rpm = Math.max(0, lp.rpm - 120 * dt);
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
    const totalSecondarySinkMW = turbineSteamDemandMW + spotHeatRemovalMW + bruKHeatMW + bruAHeatMW;

    // Баланс энергии 2-го контура (давление в ГПК и температура насыщения)
    const heatTransferPrimaryToSecondaryMW = (avgCoolantTempC - sim.steamTempC) * (3200.0 / 27.75) * Math.pow(avgFlowFrac, 0.35);
    const dSteamPress = (heatTransferPrimaryToSecondaryMW - totalSecondarySinkMW) * 0.00024;
    sim.steamHeaderPressMPa = Math.max(0.8, Math.min(8.6, sim.steamHeaderPressMPa + dSteamPress * dt));
    sim.steamTempC = calcSaturationTempC(sim.steamHeaderPressMPa);

    // Обновление температур горячей и холодной ниток по всем 4 петлям
    let sumCold = 0;
    for (let i = 0; i < 4; i++) {
      const lp = sim.loops[i];
      const loopFlowFactor = Math.max(0.07, lp.flowPct / 100.0);
      const targetTHot = sim.coreInletTempC + (sim.thermalPowerMW / 3200.0) / loopFlowFactor * 30.7;
      lp.tHot += (Math.min(365, targetTHot) - lp.tHot) * Math.min(1, 1.5 * dt);

      // Холодная нитка охлаждается в ПГВ-1000МКП до температуры пара + температурный напор
      const sgEff = Math.max(0.15, Math.min(1.0, lp.sgLevelM / 2.1));
      const targetTCold = sim.steamTempC + (lp.tHot - sim.steamTempC) * (1.0 - 0.712 * sgEff);
      lp.tCold += (targetTCold - lp.tCold) * Math.min(1, 1.5 * dt);
      sumCold += lp.tCold;

      // Уровень котловой воды в ПГВ-1000МКП (норма 2.10 м)
      const steamGenOutPct = (heatTransferPrimaryToSecondaryMW / 3200.0) * 100.0;
      const dLevel = (sim.feedwaterFlowPct - steamGenOutPct) * 0.0018;
      lp.sgLevelM = Math.max(0.4, Math.min(3.2, lp.sgLevelM + dLevel * dt));
      lp.sgPressMPa = sim.steamHeaderPressMPa + (i * 0.01 - 0.015);
    }

    sim.coreInletTempC = sumCold / 4.0;
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

    // Автоматический запуск гидроемкостей САОЗ ГЕ-1..3 при падении P1 < 5.9 МПа
    if (sim.primaryPressureMPa < 5.9 && !sim.saozActive && sim.saozWaterPct > 0) {
      sim.saozActive = true;
      safeLog('ПАССИВНАЯ ЗАЩИТА САОЗ: Давление 1-го контура ниже 5,9 МПа! Открыты обратные клапаны гидроемкостей ГЕ-1, ГЕ-2, ГЕ-3.', 'danger');
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
        if (a.rodGroup === 10) localDepression = g10Factor;
        else localDepression = g19Factor;
      }
      a.currentKq = a.baseKq * localDepression;
      if (a.currentKq > maxKq) maxKq = a.currentKq;
      a.powerMW = (sim.thermalPowerMW / 163.0) * a.currentKq;
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
