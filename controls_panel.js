// ============================================================================
// controls_panel.js — ReactorLab // Блочный щит управления ВВЭР-1200 (В-491)
// Посты ВИУР и ВИУТ, системы безопасности и табло сигнализации.
// Органы управления меняют только состояние sim, расчёт выполняет physics_engine.js
// ============================================================================
(function () {
  const REFRESH_MS = 200;
  const CORE_HEIGHT_CM = 373.0;
  const NOMINAL_POWER_MW = 3200.0;

  const updaters = [];
  const onRefresh = (fn) => updaters.push(fn);

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const notify = (message, type = 'info') => {
    if (typeof window.addLog === 'function') window.addLog(message, type);
  };
  const click = (freq = 620) => {
    if (window.sound && typeof window.sound.click === 'function') window.sound.click(freq);
  };

  const section = (parent, title, wide = false) => {
    const box = el('section', 'ctl-section' + (wide ? ' wide' : ''));
    box.appendChild(el('h3', 'ctl-title', title));
    parent.appendChild(box);
    return box;
  };

  const readout = (parent, label, read) => {
    const box = el('div', 'ctl-read');
    box.appendChild(el('span', 'ctl-read-label', label));
    const value = el('b', 'ctl-read-value');
    box.appendChild(value);
    parent.appendChild(box);
    onRefresh(() => {
      const result = read();
      const data = typeof result === 'object' ? result : { text: result };
      value.textContent = data.text;
      value.dataset.state = data.state || '';
    });
  };

  const readoutRow = (parent) => {
    const row = el('div', 'ctl-reads');
    parent.appendChild(row);
    return row;
  };

  const button = (parent, label, onPress, cfg = {}) => {
    const btn = el('button', 'ctl-btn' + (cfg.className ? ' ' + cfg.className : ''), label);
    btn.type = 'button';
    if (cfg.id) btn.id = cfg.id;
    btn.addEventListener('click', () => {
      onPress();
      click(cfg.tone);
      refresh();
    });
    parent.appendChild(btn);
    if (cfg.update) onRefresh(() => cfg.update(btn));
    return btn;
  };

  const toggle = (parent, label, isOn, setOn, cfg = {}) => button(parent, label, () => setOn(!isOn()), {
    ...cfg,
    update: (btn) => {
      btn.classList.toggle('on', isOn());
      if (cfg.update) cfg.update(btn);
    }
  });

  const segmented = (parent, options, current, choose) => {
    const row = el('div', 'ctl-segment');
    options.forEach(([value, label]) => {
      button(row, label, () => choose(value), {
        update: (btn) => btn.classList.toggle('on', current() === value)
      });
    });
    parent.appendChild(row);
    return row;
  };

  const slider = (parent, cfg) => {
    const wrap = el('label', 'ctl-slider');
    const head = el('span', 'ctl-slider-head');
    head.appendChild(el('span', '', cfg.label));
    const valueText = el('b');
    head.appendChild(valueText);
    wrap.appendChild(head);

    const input = el('input');
    input.type = 'range';
    input.min = cfg.min;
    input.max = cfg.max;
    input.step = cfg.step;
    wrap.appendChild(input);
    parent.appendChild(wrap);

    let dragging = false;
    input.addEventListener('pointerdown', () => { dragging = true; });
    window.addEventListener('pointerup', () => { dragging = false; });
    input.addEventListener('input', () => {
      cfg.write(Number(input.value));
      valueText.textContent = cfg.format(Number(input.value));
    });
    input.addEventListener('change', () => {
      if (cfg.logMessage) notify(cfg.logMessage(Number(input.value)));
    });
    onRefresh(() => {
      if (cfg.isDisabled) input.disabled = cfg.isDisabled();
      if (dragging) return;
      const value = cfg.read();
      input.value = value;
      valueText.textContent = cfg.format(value);
    });
    return input;
  };

  const bar = (parent, label, read) => {
    const box = el('div', 'ctl-bar');
    const head = el('span', 'ctl-slider-head');
    head.appendChild(el('span', '', label));
    const valueText = el('b');
    head.appendChild(valueText);
    box.appendChild(head);
    const track = el('div', 'ctl-bar-track');
    const fill = el('div', 'ctl-bar-fill');
    track.appendChild(fill);
    box.appendChild(track);
    parent.appendChild(box);
    onRefresh(() => {
      const data = read();
      valueText.textContent = data.text;
      fill.style.width = `${Math.max(0, Math.min(100, data.pct))}%`;
      fill.dataset.state = data.state || '';
    });
  };

  const holdButton = (parent, label, direction) => {
    const btn = el('button', 'ctl-btn', label);
    btn.type = 'button';
    const release = () => {
      sim.rodCommand = 0;
      btn.classList.remove('on');
    };
    btn.addEventListener('pointerdown', () => {
      if (sim.armEnabled || sim.az1Tripped) return;
      sim.rodCommand = direction;
      btn.classList.add('on');
      click(540);
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    parent.appendChild(btn);
    onRefresh(() => { btn.disabled = sim.armEnabled || sim.az1Tripped; });
  };

  const stateFor = (value, warn, danger) => {
    if (danger(value)) return 'danger';
    return warn(value) ? 'warn' : '';
  };

  // Минимальный запас до кризиса по 163 ТВС
  function minDnbr() {
    if (typeof coreAssemblies === 'undefined' || typeof updateAssemblyTelemetry !== 'function') return 2.0;
    return coreAssemblies.reduce((acc, assembly) => {
      updateAssemblyTelemetry(assembly, sim);
      return Math.min(acc, assembly.dnbr);
    }, Infinity);
  }

  // ==========================================================================
  // ПОСТ ВИУР: РЕАКТОР, СУЗ, БОР, КД, ГЦНА, АЗ-1
  // ==========================================================================
  function buildViur(root) {
    const grid = el('div', 'ctl-grid');
    root.appendChild(grid);

    const state = section(grid, 'Состояние реактора', true);
    const reads = readoutRow(state);
    readout(reads, 'Nтепл', () => ({
      text: `${(sim.thermalPowerMW / NOMINAL_POWER_MW * 100).toFixed(1)} %`,
      state: stateFor(sim.thermalPowerMW, (v) => v > 3264, (v) => v > 3360)
    }));
    readout(reads, 'Реактивность', () => `${sim.rhoTotal >= 0 ? '+' : ''}${sim.rhoTotal.toFixed(1)} pcm`);
    readout(reads, 'P₁', () => ({
      text: `${sim.primaryPressureMPa.toFixed(2)} МПа`,
      state: stateFor(sim.primaryPressureMPa, (v) => v > 16.8 || v < 15.4, (v) => v > 17.6 || v < 14.0)
    }));
    readout(reads, 'Tвых', () => `${sim.coreOutletTempC.toFixed(1)} °C`);

    // Две независимые колонки: секции разной высоты не растягивают друг друга,
    // поэтому пост ВИУР помещается на 1366×768 без прокрутки
    const colLeft = el('div', 'ctl-stack');
    const colRight = el('div', 'ctl-stack');
    grid.appendChild(colLeft);
    grid.appendChild(colRight);

    const arm = section(colLeft, 'Регулятор мощности АРМ');
    toggle(arm, 'АРМ', () => sim.armEnabled, (on) => {
      if (sim.az1Tripped) return;
      sim.armEnabled = on;
      sim.rodCommand = 0;
      notify(on ? 'АРМ включён: мощность поддерживается рабочей группой №12.' : 'АРМ отключён: группа №12 под ручным управлением.', on ? 'ok' : 'warn');
    }, {
      id: 'btnARM',
      update: (btn) => {
        btn.disabled = sim.az1Tripped;
        btn.textContent = sim.armEnabled ? 'АРМ: ВКЛЮЧЁН' : 'АРМ: ОТКЛЮЧЁН';
      }
    });
    slider(arm, {
      label: 'Уставка мощности',
      min: 960, max: 3328, step: 16,
      read: () => sim.armTargetMW,
      write: (value) => {
        sim.armTargetMW = value;
        if (!sim.az1Tripped) sim.turbineValvePct = Math.min(100, value / NOMINAL_POWER_MW * 100);
      },
      format: (value) => `${(value / NOMINAL_POWER_MW * 100).toFixed(0)} %`,
      isDisabled: () => !sim.armEnabled,
      logMessage: (value) => `Уставка АРМ: ${value.toFixed(0)} МВт, турбина переведена на ту же нагрузку.`
    });

    const rods = section(colRight, 'Рабочая группа №12');
    bar(rods, 'Положение', () => ({
      text: `${sim.group10Pos.toFixed(1)} %, ${(sim.group10Pos / 100 * CORE_HEIGHT_CM).toFixed(0)} см`,
      pct: sim.group10Pos
    }));
    const rodButtons = el('div', 'ctl-row');
    rods.appendChild(rodButtons);
    holdButton(rodButtons, 'Вверх', 1);
    holdButton(rodButtons, 'Вниз', -1);
    rods.appendChild(el('p', 'ctl-note', 'Удерживайте кнопку. Доступно при отключённом АРМ.'));

    const azGroups = section(colLeft, 'Группы АЗ №1–11');
    bar(azGroups, 'Положение', () => ({
      text: `${sim.groups1to9Pos.toFixed(1)} %`,
      pct: sim.groups1to9Pos,
      state: sim.groups1to9Pos < 100 ? 'warn' : ''
    }));
    toggle(azGroups, 'Взвести на концевики', () => sim.withdrawing1to9, (on) => {
      if (sim.az1Tripped || sim.groups1to9Pos >= 100) return;
      sim.withdrawing1to9 = on;
      notify(on ? 'Подъём групп АЗ на верхние концевики.' : 'Подъём групп АЗ остановлен.');
    }, {
      update: (btn) => { btn.disabled = sim.az1Tripped || sim.groups1to9Pos >= 100; }
    });

    const boron = section(colRight, 'Борное регулирование');
    readout(boron, 'Концентрация H₃BO₃', () => `${sim.boronConc.toFixed(3)} г/кг`);
    readout(boron, 'Выгорание', () => `${(sim.avgBurnupGWdT || 24.42).toFixed(2)} ГВт·сут/т`);
    readout(boron, 'Xe-135, доля от равновесия', () => sim.xenon135.toFixed(2));
    segmented(boron, [[1, 'Концентрат'], [0, 'Стоп'], [-1, 'Дистиллят']], () => sim.boronMode, (mode) => {
      sim.boronMode = mode;
      notify(mode === 1 ? 'Ввод концентрата борной кислоты.' : (mode === -1 ? 'Ввод дистиллята.' : 'Водообмен остановлен.'));
    });

    const kd = section(grid, 'Компенсатор давления');
    readout(kd, 'Уровень КД', () => ({
      text: `${sim.pressurizerLevelM.toFixed(2)} м`,
      state: stateFor(sim.pressurizerLevelM, (v) => v < 6.5 || v > 10, (v) => v < 4)
    }));
    segmented(kd, [['AUTO', 'ТЭНы авто'], ['ON', 'Вкл'], ['OFF', 'Откл']], () => sim.heatersMode, (mode) => {
      sim.heatersMode = mode;
      notify(`ТЭНы КД: режим ${mode}.`);
    });
    const kdRow = el('div', 'ctl-row');
    kd.appendChild(kdRow);
    toggle(kdRow, 'Впрыск', () => sim.sprayActive, (on) => {
      sim.sprayActive = on;
      notify(on ? 'Впрыск в КД включён.' : 'Впрыск в КД отключён.');
    }, { className: 'equip' });
    toggle(kdRow, 'ИПУ КД', () => sim.ipuKdOpen, (on) => {
      sim.ipuKdOpen = on;
      const ipu = document.getElementById('btnIpuKD');
      if (ipu) ipu.dataset.manual = on ? '1' : '';
      notify(on ? 'ИПУ КД открыт вручную: сброс в барботер.' : 'ИПУ КД закрыт.', on ? 'warn' : 'info');
    }, { id: 'btnIpuKD', className: 'equip' });

    const pumps = section(grid, 'Главные циркуляционные насосы');
    const pumpRow = el('div', 'ctl-pumps');
    pumps.appendChild(pumpRow);
    sim.loops.forEach((loop, index) => {
      toggle(pumpRow, `ГЦНА-${index + 1}`, () => loop.pumpOn, (on) => {
        loop.pumpOn = on;
        notify(`ГЦНА-${index + 1} ${on ? 'включён' : 'отключён'}.`, on ? 'info' : 'warn');
      }, {
        className: 'equip',
        update: (btn) => {
          btn.textContent = `ГЦНА-${index + 1} · ${Math.round(loop.rpm)}`;
          btn.title = `ГЦНА-${index + 1}: ${Math.round(loop.rpm)} об/мин`;
        }
      });
    });

    const protection = section(colLeft, 'Аварийная защита АЗ-1');
    const azRow = el('div', 'ctl-row');
    protection.appendChild(azRow);
    toggle(azRow, 'Крышка кнопки', () => sim.az1CoverOpen, (on) => { sim.az1CoverOpen = on; }, {
      update: (btn) => { btn.textContent = sim.az1CoverOpen ? 'Закрыть крышку' : 'Открыть крышку'; }
    });
    button(azRow, 'АЗ-1', () => {
      if (!sim.az1CoverOpen || sim.az1Tripped) return;
      triggerAZ1('Ручное срабатывание оператором');
      sim.az1CoverOpen = false;
    }, {
      className: 'trip',
      update: (btn) => { btn.disabled = !sim.az1CoverOpen || sim.az1Tripped; }
    });
    button(azRow, 'Вернуть номинал', () => {
      const reset = document.getElementById('btnResetNominal');
      if (reset) reset.click();
    }, {
      update: (btn) => { btn.disabled = !sim.az1Tripped; }
    });
  }

  // ==========================================================================
  // ПОСТ ВИУТ: ТУРБИНА, ПАР, ПИТАНИЕ, ПГ, СИСТЕМЫ БЕЗОПАСНОСТИ
  // ==========================================================================
  function buildViut(root) {
    const grid = el('div', 'ctl-grid');
    root.appendChild(grid);

    const state = section(grid, 'Состояние турбоустановки', true);
    const reads = readoutRow(state);
    readout(reads, 'Nэл', () => `${sim.electricalPowerMW.toFixed(0)} МВт`);
    readout(reads, 'P₂', () => ({
      text: `${sim.steamHeaderPressMPa.toFixed(2)} МПа`,
      state: stateFor(sim.steamHeaderPressMPa, (v) => v > 7.3 || v < 6.0, (v) => v > 8.2 || v < 4.5)
    }));
    readout(reads, 'Частота', () => `${(sim.turbineRpm / 60).toFixed(2)} Гц`);
    readout(reads, 'Tпара', () => `${sim.steamTempC.toFixed(1)} °C`);

    const turbine = section(grid, 'Турбина К-1200-6,8/50');
    slider(turbine, {
      label: 'Открытие регулирующих клапанов',
      min: 0, max: 100, step: 1,
      read: () => sim.turbineValvePct,
      write: (value) => { sim.turbineValvePct = value; },
      format: (value) => `${value.toFixed(0)} %`,
      logMessage: (value) => `Клапаны турбины: ${value.toFixed(0)} %.`
    });
    button(turbine, 'Закрыть стопорные клапаны', () => {
      sim.turbineValvePct = 0;
      notify('Стопорные клапаны турбины закрыты оператором.', 'warn');
    }, { className: 'alert' });

    const steam = section(grid, 'Сброс пара');
    const steamRow = el('div', 'ctl-row');
    steam.appendChild(steamRow);
    // Лампа показывает фактическое положение (автоматика или ручная команда); кнопка — ручное открытие
    toggle(steamRow, 'БРУ-К', () => sim.bruKOpen, () => {
      sim.bruKManual = !sim.bruKManual;
      notify(sim.bruKManual ? 'БРУ-К открыта вручную: сброс пара в конденсатор.' : 'Ручная команда БРУ-К снята, клапан под автоматикой.');
    }, { className: 'equip' });
    toggle(steamRow, 'БРУ-А', () => sim.bruAOpen, () => {
      sim.bruAManual = !sim.bruAManual;
      notify(sim.bruAManual ? 'БРУ-А открыта вручную: сброс пара в атмосферу (ускоренное расхолаживание).' : 'Ручная команда БРУ-А снята, клапан под автоматикой.', sim.bruAManual ? 'warn' : 'info');
    }, { className: 'equip' });
    steam.appendChild(el('p', 'ctl-note', 'Автоматика: БРУ-К 7,3 → 6,9 МПа, БРУ-А 7,7 → 7,3 МПа, ИПУ ПГ 8,7 и 8,9 МПа. Кнопка — ручное открытие. Лампа: красная — открыто, зелёная — закрыто.'));

    const feed = section(grid, 'Питательная вода', true);
    slider(feed, {
      label: 'Производительность ПЭН',
      min: 0, max: 100, step: 1,
      read: () => sim.feedwaterFlowPct,
      write: (value) => { sim.feedwaterFlowPct = value; },
      format: (value) => `${value.toFixed(0)} %`,
      logMessage: (value) => `Производительность ПЭН: ${value.toFixed(0)} %.`
    });

    const sg = section(grid, 'Уровень в парогенераторах', true);
    const sgGrid = el('div', 'ctl-sg');
    sg.appendChild(sgGrid);
    sim.loops.forEach((loop, index) => {
      bar(sgGrid, `ПГ-${index + 1}`, () => ({
        text: `${loop.sgLevelM.toFixed(2)} м`,
        pct: loop.sgLevelM / 3.6 * 100,
        state: stateFor(loop.sgLevelM, (v) => v < 2.4 || v > 2.9, (v) => v <= 1.8 || v >= 3.0)
      }));
    });

    const safety = section(grid, 'Системы безопасности В-491', true);
    const safetyRow = el('div', 'ctl-pumps');
    safety.appendChild(safetyRow);
    // Насосы САОЗ ВД/НД: автозапуск по сигналу САОЗ; кнопка — ручной запуск. Подача — только ниже напора насоса
    toggle(safetyRow, 'САОЗ', () => sim.eccsPumpsRunning, () => {
      sim.eccsManualStart = !sim.eccsManualStart;
      notify(sim.eccsManualStart ? 'Насосы САОЗ ВД и НД запущены вручную; подача в 1-й контур — при P1 ниже 7,9 и 2,45 МПа.' : 'Ручной пуск насосов САОЗ снят.', 'warn');
    }, { className: 'equip' });
    toggle(safetyRow, 'СПОТ', () => sim.spotActive, (on) => {
      sim.spotActive = on;
      notify(on ? 'СПОТ подключена к парогенераторам.' : 'СПОТ отключена.');
    }, { className: 'equip' });
    toggle(safetyRow, 'Охлаждение УЛР', () => sim.ulrCoolingActive, (on) => {
      sim.ulrCoolingActive = on;
      notify(on ? 'Подача воды на охлаждение ловушки расплава.' : 'Охлаждение ловушки отключено.');
    }, { className: 'equip' });
    toggle(safetyRow, 'Течь 1-го контура', () => sim.primaryLeakActive, (on) => {
      if (on) {
        startLoca(NUCLEAR_CONSTANTS.LOCA.BREAK_D_DEFAULT_M);
      } else {
        sim.primaryLeakActive = false;
        notify('Течь 1-го контура изолирована.', 'ok');
      }
    }, { className: 'alert' });
  }

  // ==========================================================================
  // ТАБЛО СИГНАЛИЗАЦИИ И ТРЕНДЫ
  // ==========================================================================
  function buildSignals(root) {
    const eventLog = document.getElementById('eventLog');
    const board = el('div', 'ctl-annunciator');
    root.insertBefore(board, eventLog);
    // Пояснение табло: плитка серая, пока параметр в норме; цвет появляется только при отклонении
    const boardLegend = el('div', 'ctl-alarm-legend');
    boardLegend.innerHTML = '<span><i class="is-norm"></i>норма</span>'
      + '<span><i class="is-warn"></i>предупреждение</span>'
      + '<span><i class="is-danger"></i>авария</span>';
    root.insertBefore(boardLegend, eventLog);

    const alarms = [
      ['АЗ-1', () => (sim.az1Tripped ? 'danger' : '')],
      ['Nтепл > 102%', () => stateFor(sim.thermalPowerMW, (v) => v > 3264, (v) => v > 3360)],
      ['Давление 1-го контура', () => stateFor(sim.primaryPressureMPa, (v) => v > 16.8 || v < 15.4, (v) => v > 17.6 || v < 14.0)],
      ['Запас до кипения', () => stateFor(sim.subcoolingMarginC, (v) => v < 12, (v) => v < 7)],
      ['DNBR', () => stateFor(minDnbr(), (v) => v < 1.5, (v) => v < 1.3)],
      ['Уровень КД', () => stateFor(sim.pressurizerLevelM, (v) => v < 6.5 || v > 10, (v) => v < 4)],
      ['Уровень ПГ', () => stateFor(Math.min(...sim.loops.map((l) => l.sgLevelM)), (v) => v < 2.4, (v) => v <= 1.8)],
      ['Давление пара', () => stateFor(sim.steamHeaderPressMPa, (v) => v > 7.3 || v < 6.0, (v) => v > 8.2 || v < 4.5)],
      ['ГЦНА отключён', () => (sim.loops.some((l) => !l.pumpOn) ? 'danger' : '')],
      ['ПЭН', () => stateFor(sim.feedwaterFlowPct, (v) => v < 50, (v) => v < 10)],
      ['ИПУ КД открыт', () => (sim.ipuKdOpen ? 'danger' : '')],
      ['БРУ открыт', () => (sim.bruKOpen || sim.bruAOpen ? 'warn' : '')],
      ['ИПУ ПГ открыт', () => (sim.ipuSg1Open || sim.ipuSg2Open ? 'danger' : '')],
      ['Течь 1-го контура', () => (sim.primaryLeakActive ? 'danger' : '')],
      ['САОЗ в работе', () => (sim.saozActive ? 'danger' : '')],
      ['Давление в ГО', () => stateFor(sim.containmentPressMPa || 0.1, (v) => v > 0.11, (v) => v > 0.13)],
      ['Спринклер', () => (sim.sprinklerActive ? 'danger' : '')],
      ['СПОТ в работе', () => (sim.spotActive ? 'warn' : '')]
    ];
    alarms.forEach(([label, read]) => {
      const tile = el('div', 'ctl-alarm', label);
      board.appendChild(tile);
      onRefresh(() => { tile.dataset.state = read(); });
    });

    const charts = el('div', 'ctl-charts');
    [
      ['chartPower', 'Реактор'],
      ['chartNeutronics', 'Турбина и сеть'],
      ['chartPressure', 'Давление и запас до кипения']
    ].forEach(([id, title]) => {
      const box = el('div', 'ctl-chart');
      box.appendChild(el('span', 'ctl-chart-title', title));
      const canvas = el('canvas');
      canvas.id = id;
      box.appendChild(canvas);
      charts.appendChild(box);
    });
    root.insertBefore(charts, eventLog);
  }

  function refresh(force = false) {
    if (!force && sim.viewMode !== 'controls') return;
    updaters.forEach((update) => update());
  }
  window.refreshControlsPanel = () => refresh(true);

  function init() {
    const viur = document.querySelector('#panelViur .bshu-panel-content');
    const viut = document.querySelector('#panelViut .bshu-panel-content');
    const telemetry = document.querySelector('#panelTelemetry .bshu-panel-content');
    if (!viur || !viut || !telemetry || typeof sim === 'undefined') return;
    buildViur(viur);
    buildViut(viut);
    buildSignals(telemetry);
    setInterval(refresh, REFRESH_MS);
    refresh();
  }

  init();
})();
