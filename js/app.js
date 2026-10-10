/**
 * ATOMIC CORE — Main Application Entry Point
 * Bootstraps SPA, initializes router, live telemetry loop, global mode switcher & interactions
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Top Navigation Tab click handlers
  const navTabs = document.querySelectorAll(".nav-tab");
  navTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const route = tab.getAttribute("data-route");
      if (route && window.AppRouter) {
        window.AppRouter.navigate(route);
      }
    });
  });

  // 2. Initialize Global Mode Switcher in Header ([ SCADA Инженерия ] / [ Вся суть на пальцах ])
  setupGlobalModeSwitcher();

  // 3. Start Live Reactor Telemetry micro-fluctuation loop (SCADA feel)
  startLiveTelemetryTicker();

  // 4. Setup Global Keyboard Shortcuts
  setupKeyboardShortcuts();

  // 5. Initialize Router (Loads #anatomy by default)
  if (window.AppRouter) {
    window.AppRouter.init();
  }
});

/**
 * Global Mode Switcher: wires up header segmented buttons
 */
function setupGlobalModeSwitcher() {
  const toggleContainer = document.getElementById("global-mode-toggle");
  if (!toggleContainer) return;

  const modeButtons = toggleContainer.querySelectorAll(".mode-btn");
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetMode = btn.getAttribute("data-mode");
      if (!targetMode) return;

      // Update active state on buttons
      modeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Notify Anatomy View if loaded
      if (window.AnatomyView && typeof window.AnatomyView.setGlobalMode === "function") {
        window.AnatomyView.setGlobalMode(targetMode);
      }
    });
  });
}

/**
 * Simulates micro-fluctuations in real-time SCADA telemetry
 * Creates an authentic living control-room atmosphere
 */
function startLiveTelemetryTicker() {
  const powerEl = document.getElementById("header-val-power");
  const pressureEl = document.getElementById("header-val-pressure");

  if (!powerEl || !pressureEl) return;

  setInterval(() => {
    // Thermal power minor fluctuation around 3200 MW (± 1.2 MW)
    const basePower = 3200;
    const powerDelta = (Math.random() * 2.4 - 1.2).toFixed(1);
    const currentPower = (basePower + parseFloat(powerDelta)).toFixed(1);
    powerEl.innerHTML = `${currentPower} <span>МВт(т)</span>`;

    // Primary pressure minor fluctuation around 16.20 MPa (± 0.03 MPa)
    const basePress = 16.20;
    const pressDelta = (Math.random() * 0.04 - 0.02).toFixed(2);
    const currentPress = (basePress + parseFloat(pressDelta)).toFixed(2);
    pressureEl.innerHTML = `${currentPress} <span>МПа</span>`;
  }, 3500);
}

/**
 * Global Keyboard shortcuts for power users:
 * 1: Анатомия, 2: Пульт оператора, 3: Физика, M: Переключение режима (SCADA / На пальцах)
 */
function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    // Ignore when focus is inside an input or textarea
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    if (e.key === "1") {
      window.AppRouter.navigate("anatomy");
    } else if (e.key === "2") {
      window.AppRouter.navigate("control");
    } else if (e.key === "3") {
      window.AppRouter.navigate("physics");
    } else if (e.key.toLowerCase() === "m") {
      // Toggle mode
      if (window.AnatomyView && typeof window.AnatomyView.getGlobalMode === "function") {
        const nextMode = window.AnatomyView.getGlobalMode() === "scada" ? "simple" : "scada";
        window.AnatomyView.setGlobalMode(nextMode);
      }
    }
  });
}
