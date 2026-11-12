// =============================================================================
// ReactorLab — стартовая страница платформы (#hub)
// Обзор направлений ядерных технологий и модулей установок
// (В-491 — активный флагманский модуль, остальные — в разработке).
// Модуль изолирован: только строит разметку в #tab-hub и переключает вкладку
// через window.activateViewMode (main.js). Состояние модели `sim` не читает и не меняет.
// =============================================================================
(function () {
  'use strict';

  const DIRECTIONS = [
    {
      title: 'Ядерная энергетика',
      fallback: 'Ядерная энергетика',
      img: 'img/pillar_fission.jpg',
      alt: 'Ядерная энергетика — свечение Черенкова в активной зоне реактора',
      items: [
        'Нейтронный расчет АЗ',
        'Управление АЭС',
        'Теплогидравлика',
        'Барьеры безопасности'
      ]
    },
    {
      title: 'Термоядерный синтез',
      fallback: 'Термоядерный синтез',
      img: 'img/pillar_fusion.jpg',
      alt: 'Термоядерный синтез — высокотемпературная плазма в токамаке',
      items: [
        'Удержание D-T плазмы',
        'Токамаки и стеллараторы',
        'Первая стенка и дивертор',
        'Сверхпроводящие магниты'
      ]
    },
    {
      title: 'Ускорительная физика и мегасайенс',
      fallback: 'Ускорительная физика',
      img: 'img/pillar_accelerator.jpg',
      alt: 'Ускорительная физика и мегасайенс — детектор на коллайдере частиц',
      items: [
        'Динамика пучков частиц',
        'Синхротроны',
        'Радиационное материаловедение',
        'Коллайдеры'
      ]
    },
    {
      title: 'Ядерная медицина и изотопы',
      fallback: 'Ядерная медицина',
      img: 'img/pillar_medicine.jpg',
      alt: 'Ядерная медицина — комплекс протонной терапии',
      items: [
        'Наработка радионуклидов',
        'Протонная терапия',
        'ПЭТ-диагностика',
        'Стерилизация'
      ]
    }
  ];

  const MODULES = [
    {
      id: 'v491',
      active: true,
      title: 'Энергоблок В-491 (ВВЭР-1200)',
      status: 'Активен',
      img: 'img/v491.jpg',
      alt: 'Энергоблок В-491 ВВЭР-1200',
      fallback: 'ВВЭР-1200 // В-491',
      spec: [
        ['Тип', 'Водо-водяной энергетический (PWR)'],
        ['Nтепл', '3200 МВт(т)'],
        ['Теплоноситель', '16.2 МПа, 298.6 → 329.7 °C'],
        ['Петли', '4 петли (ГЦНА-1391, ПГВ-1000МКП)'],
        ['Безопасность', 'Пассивные (СПОТ, ГЕ-1, УЛР) + 4-канальные активные']
      ],
      chips: ['3D-модель Three.js', '163 кассеты ТВС-2М', 'Кинетика 6 групп', 'Данные по [КН], ЛАЭС-2'],
      action: 'Перейти к моделированию'
    },
    {
      id: 'bn',
      active: false,
      title: 'Быстрый реактор БН-800 / БН-1200',
      status: 'В разработке',
      img: 'img/bn800.jpg',
      alt: 'Реактор на быстрых нейтронах БН-800',
      fallback: 'БН-800 // натрий',
      spec: [
        ['Тип', 'Быстрый натриевый (FBR)'],
        ['Nтепл', '2100 МВт'],
        ['Теплоноситель', 'Жидкий натрий (Na)'],
        ['Задача', 'Замыкание ЯТЦ, МОКС-топливо']
      ],
      action: 'Спецификация в разработке'
    },
    {
      id: 'ktm',
      active: false,
      title: 'Материаловедческий токамак КТМ',
      status: 'В разработке',
      img: 'img/ktm.jpg',
      alt: 'Материаловедческий токамак КТМ',
      fallback: 'КТМ // токамак',
      spec: [
        ['Тип', 'Сферический токамак'],
        ['Ток/Поле', '750 кА / 1.0 Тл'],
        ['Разряд', 'до 5 с'],
        ['Задача', 'Испытание материалов первой стенки для ITER']
      ],
      action: 'Спецификация в разработке'
    }
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function list(items) {
    return `<ul class="hub-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  function renderDirections() {
    return DIRECTIONS.map(d => `
      <article class="hub-card hub-direction">
        <div class="hub-pillar-media" data-fallback="${esc(d.fallback)}">
          <img class="hub-pillar-img" src="${esc(d.img)}" alt="${esc(d.alt)}" decoding="async">
        </div>
        <div class="hub-direction-body">
          <h3 class="hub-card-title">${esc(d.title)}</h3>
          ${list(d.items)}
        </div>
      </article>`).join('');
  }

  function renderModules() {
    return MODULES.map(m => {
      const specTable = `<dl class="hub-spec">${m.spec.map(([k, v]) => `<div class="hub-spec-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
      const chipsHtml = (m.active && Array.isArray(m.chips))
        ? `<ul class="hub-chips" aria-label="Возможности модуля">${m.chips.map(c => `<li class="hub-chip">${esc(c)}</li>`).join('')}</ul>`
        : '';
      const btnHtml = m.active
        ? `<button type="button" class="hub-btn hub-btn-secondary" data-hub-launch="systems">${esc(m.action)} →</button>`
        : `<button type="button" class="hub-btn hub-btn-disabled" disabled>${esc(m.action)}</button>`;
      return `
      <article class="hub-card hub-module${m.active ? ' is-active' : ' is-roadmap'}">
        <div class="hub-banner" data-fallback="${esc(m.fallback)}">
          <img class="hub-banner-img" src="${esc(m.img)}" alt="${esc(m.alt)}" decoding="async">
          <span class="hub-badge${m.active ? ' hub-badge-active' : ''}">${esc(m.status)}</span>
        </div>
        <div class="hub-module-body">
          <h3 class="hub-card-title">${esc(m.title)}</h3>
          ${specTable}
          ${chipsHtml}
          ${btnHtml}
        </div>
      </article>`;
    }).join('');
  }

  function render(root) {
    root.innerHTML = `
      <div class="hub-inner">
        <header class="hub-hero">
          <div class="hub-hero-text">
            <div class="hub-tag">ReactorLab // Цифровые двойники и расчетные модели</div>
            <h1 class="hub-title">Атомная инженерия и моделирование ядерных установок</h1>
            <p class="hub-subtitle">Интерактивная учебно-исследовательская платформа. Комплексный расчет нейтронной кинетики, нестационарных процессов, гидродинамики первого контура и систем безопасности на основе верифицированных физических моделей.</p>
          </div>
        </header>

        <section class="hub-section">
          <h2 class="hub-section-title">Направления ядерных технологий</h2>
          <div class="hub-grid hub-grid-4">${renderDirections()}</div>
        </section>

        <section class="hub-section">
          <h2 class="hub-section-title">Модули установок</h2>
          <div class="hub-grid hub-grid-3">${renderModules()}</div>
        </section>
      </div>`;

    // Фото карточек: если файл не найден — прячем <img>, остаётся нейтральная подложка
    const markBroken = img => {
      const box = img.closest('.hub-banner, .hub-pillar-media');
      if (box) box.classList.add('is-fallback');
    };
    root.addEventListener('error', e => {
      if (e.target && e.target.classList && (e.target.classList.contains('hub-banner-img') || e.target.classList.contains('hub-pillar-img'))) {
        markBroken(e.target);
      }
    }, true);
    root.querySelectorAll('.hub-banner-img, .hub-pillar-img').forEach(img => {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) markBroken(img);
    });

    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-hub-launch]');
      if (!btn) return;
      const target = btn.dataset.hubLaunch;
      if (typeof window.activateViewMode === 'function') {
        window.activateViewMode(target, { updateHash: true });
        if (window.sound && typeof window.sound.click === 'function') window.sound.click(620);
      }
    });
  }

  const root = document.getElementById('tab-hub');
  if (root) render(root);
})();
