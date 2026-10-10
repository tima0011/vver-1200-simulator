/**
 * ATOMIC CORE — SPA Router
 * Hash-based lightweight router managing screen transitions without page reloads
 * Tabs: #anatomy, #control, #physics
 */

window.AppRouter = (function () {
  const routes = {
    anatomy: {
      title: "Анатомия реактора | ATOMIC CORE",
      render: function (viewport) {
        if (window.AnatomyView && typeof window.AnatomyView.render === "function") {
          window.AnatomyView.render(viewport);
        }
      }
    },
    control: {
      title: "Пульт оператора | ATOMIC CORE",
      render: function (viewport) {
        renderControlRoomPreview(viewport);
      }
    },
    physics: {
      title: "Физика на пальцах | ATOMIC CORE",
      render: function (viewport) {
        renderPhysicsGuidePreview(viewport);
      }
    }
  };

  /**
   * Initializes router listeners and opens initial route
   */
  function init() {
    window.addEventListener("hashchange", handleHashChange);
    // Handle initial route
    const currentHash = window.location.hash.replace("#", "") || "anatomy";
    navigate(currentHash);
  }

  /**
   * Navigates to target route ID
   */
  function navigate(routeId) {
    const validRoute = routes[routeId] ? routeId : "anatomy";
    if (window.location.hash !== `#${validRoute}`) {
      window.location.hash = `#${validRoute}`;
    } else {
      executeRoute(validRoute);
    }
  }

  /**
   * Route handler executed on hash change
   */
  function handleHashChange() {
    const rawHash = window.location.hash.replace("#", "");
    const routeId = routes[rawHash] ? rawHash : "anatomy";
    executeRoute(routeId);
  }

  /**
   * Executes view rendering and updates navigation bar state
   */
  function executeRoute(routeId) {
    const viewport = document.getElementById("app-viewport");
    if (!viewport) return;

    const routeConfig = routes[routeId];
    if (!routeConfig) return;

    // Update document title
    document.title = routeConfig.title;

    // Update Active Navigation Tab classes
    const navTabs = document.querySelectorAll(".nav-tab");
    navTabs.forEach(tab => {
      const tabTarget = tab.getAttribute("data-route");
      if (tabTarget === routeId) {
        tab.classList.add("active");
        tab.setAttribute("aria-current", "page");
      } else {
        tab.classList.remove("active");
        tab.removeAttribute("aria-current");
      }
    });

    // Clean viewport & render screen
    viewport.innerHTML = "";
    routeConfig.render(viewport);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  /**
   * Screen: "Пульт оператора" (Interactive Operator Console Preview)
   */
  function renderControlRoomPreview(viewport) {
    viewport.innerHTML = `
      <div class="anatomy-viewport view-enter">
        <header class="anatomy-toolbar">
          <div class="anatomy-title-group">
            <span class="anatomy-screen-tag" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: var(--status-emerald);">SCADA СИСТЕМА</span>
            <h1 class="anatomy-screen-title">Блочный щит управления (БЩУ-1) <span>| Пульт ведущего инженера управления реактором (ВИУР)</span></h1>
          </div>
          <div class="toolbar-controls">
            <button class="filter-btn active" id="btn-sound-alarm">Тест сигнализации</button>
          </div>
        </header>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 0.5rem;">
          <!-- Panel 1: Neutronics & Reactivity -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
              <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan); font-weight: 700;">ПАНЕЛЬ 01: НЕЙТРОННЫЙ ПОТОК</span>
              <span class="status-badge" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">В НОРМЕ</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.85rem; margin-bottom: 0.35rem;">
                  <span style="color: var(--text-secondary)">Тепловая мощность N_тепл</span>
                  <span style="color: #ffffff; font-weight: 700;" id="power-display">100.0 % (3200 МВт)</span>
                </div>
                <div style="background: rgba(255,255,255,0.06); height: 10px; border-radius: 5px; overflow: hidden;">
                  <div id="power-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--accent-cyan), #38bdf8); transition: width 0.3s ease;"></div>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.8rem; background: rgba(14, 20, 33, 0.6); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-subtle);">
                <div>
                  <div style="color: var(--text-muted); font-size: 0.7rem;">Период разгона Т_р</div>
                  <div style="font-weight: 700; color: #ffffff;">∞ (Стационар)</div>
                </div>
                <div>
                  <div style="color: var(--text-muted); font-size: 0.7rem;">Реактивность ρ</div>
                  <div style="font-weight: 700; color: var(--status-emerald);">0.00 β_эфф</div>
                </div>
                <div>
                  <div style="color: var(--text-muted); font-size: 0.7rem;">Запас до кризиса</div>
                  <div style="font-weight: 700; color: var(--accent-cyan);">1.84 DNBR</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel 2: Primary Circuit Hydraulics -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
              <span style="font-family: var(--font-mono); font-size: 0.8rem; color: #c084fc; font-weight: 700;">ПАНЕЛЬ 02: ПЕРВЫЙ КОНТУР И ПЭН</span>
              <span class="status-badge" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">4 ПЕТЛИ ОНЛАЙН</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Давление в КД</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">16.20 <span class="metric-cell-unit">МПа</span></span>
                <span class="metric-cell-trend">±0.02 МПа</span>
              </div>
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Т_вход реактора</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">298.2 <span class="metric-cell-unit">°C</span></span>
                <span class="metric-cell-trend">Холодная петля</span>
              </div>
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Т_выход реактора</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">328.6 <span class="metric-cell-unit">°C</span></span>
                <span class="metric-cell-trend">Горячая нитка</span>
              </div>
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Расход ГЦНА (общий)</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">86 400 <span class="metric-cell-unit">м³/ч</span></span>
                <span class="metric-cell-trend">Норма</span>
              </div>
            </div>
          </div>

          <!-- Panel 3: Secondary Circuit & Turbogenerator -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
              <span style="font-family: var(--font-mono); font-size: 0.8rem; color: #38bdf8; font-weight: 700;">ПАНЕЛЬ 03: ВТОРОЙ КОНТУР И СЕТЬ</span>
              <span class="status-badge" style="padding: 0.2rem 0.5rem; font-size: 0.7rem;">СИНХРОНИЗИРОВАН</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="metric-hud-cell">
                <span class="metric-cell-label">P пара перед турбиной</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">6.98 <span class="metric-cell-unit">МПа</span></span>
                <span class="metric-cell-trend">Сухой насыщенный</span>
              </div>
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Обороты вала турбины</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">3 000 <span class="metric-cell-unit">об/мин</span></span>
                <span class="metric-cell-trend">50.00 Гц точн.</span>
              </div>
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Мощность генератора</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">1 198 <span class="metric-cell-unit">МВт</span></span>
                <span class="metric-cell-trend">В сеть 500 кВ</span>
              </div>
              <div class="metric-hud-cell">
                <span class="metric-cell-label">Вакуум в конденсаторе</span>
                <span class="metric-cell-val" style="font-size: 1.15rem;">0.0042 <span class="metric-cell-unit">МПа</span></span>
                <span class="metric-cell-trend">96% вакуум</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Interactive Reactor Power Throttle -->
        <div class="schematic-card" style="padding: 1.5rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; color: #ffffff;">Регулятор мощности реактора (АРМ)</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary);">Перемещение 10-й рабочей группы стержней СУЗ для регулирования тепловыделения</p>
            </div>
            <button class="filter-btn" id="btn-reset-power" style="border: 1px solid var(--border-subtle)">Вернуть 100%</button>
          </div>
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <input type="range" id="power-slider" min="0" max="104" value="100" style="flex: 1; accent-color: var(--accent-cyan); height: 6px; cursor: pointer;">
            <span style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--accent-cyan); min-width: 80px;" id="power-slider-val">100 %</span>
          </div>
        </div>
      </div>
    `;

    // Interactive slider logic for control screen
    const slider = viewport.querySelector("#power-slider");
    const sliderVal = viewport.querySelector("#power-slider-val");
    const powerBar = viewport.querySelector("#power-bar");
    const powerDisplay = viewport.querySelector("#power-display");
    const resetBtn = viewport.querySelector("#btn-reset-power");
    const alarmBtn = viewport.querySelector("#btn-sound-alarm");

    function updatePower(val) {
      if (sliderVal) sliderVal.textContent = val + " %";
      if (powerBar) powerBar.style.width = val + "%";
      if (powerDisplay) powerDisplay.textContent = val + ".0 % (" + Math.round(3200 * (val / 100)) + " МВт)";
    }

    if (slider) {
      slider.addEventListener("input", (e) => {
        updatePower(e.target.value);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (slider) {
          slider.value = 100;
          updatePower(100);
        }
      });
    }

    if (alarmBtn) {
      alarmBtn.addEventListener("click", () => {
        const orig = alarmBtn.textContent;
        alarmBtn.textContent = "СИГНАЛ БЩУ ИСПРАВЕН (СИРЕНА ОК)";
        alarmBtn.style.color = "var(--status-emerald)";
        setTimeout(() => {
          alarmBtn.textContent = orig;
          alarmBtn.style.color = "";
        }, 2000);
      });
    }
  }

  /**
   * Screen: "Физика на пальцах" (Interactive Reactor Physics Guide)
   */
  function renderPhysicsGuidePreview(viewport) {
    viewport.innerHTML = `
      <div class="anatomy-viewport view-enter">
        <header class="anatomy-toolbar">
          <div class="anatomy-title-group">
            <span class="anatomy-screen-tag" style="background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.4); color: #c084fc;">БАЗОВЫЙ КУРС</span>
            <h1 class="anatomy-screen-title">Физика реакторов ВВЭР на пальцах <span>| Фундаментальные законы нейтронной физики и термодинамики</span></h1>
          </div>
        </header>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem; margin-top: 0.5rem;">
          <!-- Card 1: Chain Reaction & U-235 -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="background: rgba(56, 189, 248, 0.15); color: var(--accent-cyan); font-family: var(--font-mono); padding: 0.35rem 0.65rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">01</span>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #ffffff;">Цепная реакция деления</h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
              Ядро ²³⁵U поглощает тепловой нейтрон, превращаясь в нестабильное ²³⁶U, которое через 10⁻¹⁴ секунды делится на два осколка (например, Барий и Криптон) с выделением <strong>~200 МэВ</strong> энергии и 2–3 быстрых нейтронов. Если хотя бы ровно один из них вызовет следующее деление, реактор находится в <em>критическом</em> (стабильном) состоянии (коэффициент размножения K_eff = 1.000).
            </p>
            <div style="background: rgba(8, 12, 20, 0.6); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 0.78rem; color: var(--accent-cyan-light);">
              ²³⁵U + n_терм → X + Y + (2.43) n_быстр + 200 МэВ
            </div>
          </div>

          <!-- Card 2: Water as Moderator and Coolant -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="background: rgba(16, 185, 129, 0.15); color: var(--status-emerald); font-family: var(--font-mono); padding: 0.35rem 0.65rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">02</span>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #ffffff;">Замедление: роль воды</h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
              Нейтроны рождаются быстрыми (энергия ~2 МэВ, скорость 20 000 км/с). Вероятность деления ²³⁵U быстрым нейтроном ничтожна. В ВВЭР вода служит <strong>замедлителем</strong>: легкие ядра водорода (протоны) имеют массу, близкую к нейтрону. Сталкиваясь с ними, как бильярдные шары, нейтроны за 18–20 соударений замедляются до тепловых энергий (0.025 эВ), где захват ураном эффективнее в сотни раз!
            </p>
            <div style="background: rgba(8, 12, 20, 0.6); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 0.78rem; color: var(--status-emerald);">
              Отрицательный паровой эффект: вскипание воды = потеря замедлителя = реактор сам гаснет!
            </div>
          </div>

          <!-- Card 3: Doppler Effect & Inherent Safety -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="background: rgba(245, 158, 11, 0.15); color: var(--status-amber); font-family: var(--font-mono); padding: 0.35rem 0.65rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">03</span>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #ffffff;">Эффект Доплера (Самозащита)</h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
              При случайном перегреве топлива атомы ²³⁸U начинают сильнее колебаться от теплового движения. За счет эффекта Доплера резонансные пики захвата нейтронов ураном-238 расширяются. Уран-238 начинает жадно поглощать нейтроны без деления, автоматически снижая реактивность. Это явление делает реактор ВВЭР <strong>внутренне самозащищенным</strong> на уровне законов природы: он физически не может разогнаться при росте температуры.
            </p>
            <div style="background: rgba(8, 12, 20, 0.6); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 0.78rem; color: var(--status-amber);">
              Доплеровский температурный коэффициент реактивности: dρ/dT_топл < 0
            </div>
          </div>

          <!-- Card 4: Xenon Pit (Иодная яма) -->
          <div class="schematic-card" style="padding: 1.5rem; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="background: rgba(244, 63, 94, 0.15); color: #fda4af; font-family: var(--font-mono); padding: 0.35rem 0.65rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">04</span>
              <h2 style="font-size: 1.15rem; font-weight: 700; color: #ffffff;">Ксеноновое отравление («Иодная яма»)</h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; line-height: 1.6;">
              При делении образуется радиоактивный Иод-135 (T_1/2 = 6.6 ч), распадающийся в Ксенон-135 — сильнейший нейтронный «яд» в природе (сечение захвата 2.6·10⁶ барн). На номинальной мощности ксенон непрерывно выгорает в нейтронном потоке. Но при резком снижении мощности или останове реактора выгорание прекращается, а накопленный иод продолжает распадаться в ксенон. Реактор попадает в «иодную яму», из которой его категорически запрещено выводить до распада ксенона (24–36 часов).
            </p>
            <div style="background: rgba(8, 12, 20, 0.6); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 0.78rem; color: #fda4af);">
              Пик отравления ксеноном достигается через ~8–10 часов после остановки реактора.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return {
    init,
    navigate
  };
})();
