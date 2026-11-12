/* ==========================================================================
   РАЗРЕЗ ГЕРМООБОЛОЧКИ В-491 (вкладка [СИСТЕМЫ] → «Разрез гермооболочки В-491»)
   Топология по рис. 2.33 «Общая структура систем безопасности проекта РУ В-491
   (ЛАЭС-2)» — Поваров В. П. и др. «АЭС с реакторами типа ВВЭР/PWR», НИЯУ МИФИ, 2025, с. 170. Векторная SVG-схема + реестр оборудования справа.
   Модуль только читает `sim` и камеру холста; физику не меняет.
   ========================================================================== */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VB_W = 1200;
  const VB_H = 720;

  // --------------------------------------------------------------------------
  // 1. СИСТЕМЫ (фильтр реестра)
  // --------------------------------------------------------------------------
  const GROUPS = [
    { id: 'primary', title: 'Первый контур', color: '#0284C7' },
    { id: 'passive', title: 'Пассивная безопасность', color: '#0D9488' },
    { id: 'active', title: 'Активная безопасность', color: '#4F46E5' },
    { id: 'chem', title: 'Бор и химреагенты', color: '#D97706' },
    { id: 'contain', title: 'Локализация и ГО', color: '#475569' }
  ];

  // --------------------------------------------------------------------------
  // 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ СОСТОЯНИЯ
  // --------------------------------------------------------------------------
  const S = () => window.sim || {};
  // Подача САОЗ, ГЕ-1, спринклер и параметры ГО считаются в physics_engine.js (раздел 7); здесь только отображение
  const kgs = (v) => fx((v || 0) * 3.6, 0);   // кг/с → м³/ч (вода ~1000 кг/м³)
  const fmt = (v, d = 1) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—');
  const loopOf = (i) => (S().loops && S().loops[i]) || { pumpOn: false, rpm: 0, flowPct: 0, tHot: 0, tCold: 0, sgLevelM: 0, sgPressMPa: 0 };
  const isLoca = () => !!S().primaryLeakActive;
  const ok = (text) => ({ level: 'ok', text });
  const idle = (text) => ({ level: 'idle', text });
  const struct = (text) => ({ level: 'struct', text });
  const warn = (text) => ({ level: 'warn', text });
  const danger = (text) => ({ level: 'danger', text });
  const active = (text) => ({ level: 'active', text });

  function loopPumpState(i) {
    const l = loopOf(i);
    if (!l.pumpOn && l.rpm > 50) return warn('выбег ротора');
    if (!l.pumpOn) return danger('отключён, естественная циркуляция');
    return ok('в работе');
  }

  function sgState(i) {
    const l = loopOf(i);
    const lvl = l.sgLevelM;
    if (lvl <= 1.8 || lvl >= 3.0) return danger('уровень на уставке закрытия БЗОК');
    if (lvl < 2.4 || lvl > 2.9) return warn('уровень отклонился от 2,70 м');
    return ok('уровень в норме');
  }

  // --------------------------------------------------------------------------
  // 3. РЕЕСТР ОБОРУДОВАНИЯ (номера позиций по рис. 2.33)
  //    pin — положение номерного бейджа на схеме (координаты viewBox)
  // --------------------------------------------------------------------------
  const ITEMS = [
    {
      n: 1, group: 'primary', name: 'Реактор ВВЭР-1200', code: 'Корпус В-491, 163 ТВС-2М',
      purpose: 'Корпус с активной зоной из 163 ТВС-2М; тепловая мощность 3200 МВт. Над крышкой — блок приводов СУЗ (121 привод ШЭМ-3).',
      pin: [612, 280],
      state: () => {
        const s = S();
        if (s.az1Tripped) return danger('АЗ-1 сработала, реактор заглушен');
        if ((typeof s.neutronFlux === 'number' ? s.neutronFlux : 1) < 1e-3) return idle('Подкритическое состояние / МКУ');
        return ok('Работа на мощности');
      }
    },
    {
      n: 2, group: 'primary', name: 'Парогенератор ПГВ-1000МКП', code: 'ПГ-1…4 (в разрезе 2 из 4)',
      purpose: 'Горизонтальный парогенератор коридорной компоновки: теплоноситель 1-го контура отдаёт тепло воде 2-го контура и образует сухой насыщенный пар 7,0 МПа.',
      pin: [286, 252], pin2: [740, 256],
      state: () => {
        const a = sgState(0);
        const b = sgState(1);
        const lvl = [a, b].some((x) => x.level === 'danger') ? 'danger' : [a, b].some((x) => x.level === 'warn') ? 'warn' : 'ok';
        return { level: lvl, text: `ПГ-1: ${a.text}. ПГ-2: ${b.text}` };
      }
    },
    {
      n: 3, group: 'primary', name: 'Главный циркуляционный насос', code: 'ГЦНА-1391 (в разрезе ГЦНА-1 и ГЦНА-2)',
      purpose: 'Прокачивает теплоноситель по петле: холодная нитка → реактор. При обесточивании обеспечивает принудительный расход за счёт инерционного выбега маховика.',
      pin: [300, 404], pin2: [756, 404],
      state: () => {
        const a = loopPumpState(0);
        const b = loopPumpState(1);
        const lvl = [a, b].some((x) => x.level === 'danger') ? 'danger' : [a, b].some((x) => x.level === 'warn') ? 'warn' : 'ok';
        return { level: lvl, text: `ГЦНА-1: ${a.text}. ГЦНА-2: ${b.text}` };
      }
    },
    {
      n: 4, group: 'primary', name: 'Компенсатор давления', code: 'КД, 79 м³',
      purpose: 'Поддерживает давление 1-го контура 16,2 МПа: электронагреватели (ТЭНы) повышают давление, впрыск от холодной нитки конденсирует пар. Подключён дыхательным трубопроводом к горячей нитке петли 1.',
      pin: [348, 172],
      state: () => {
        const s = S();
        if (s.ipuKdOpen) return danger('ИПУ КД открыт, сброс в барботер');
        if (s.primaryPressureMPa < 14.7 || s.primaryPressureMPa > 17.6) return danger('P1 за аварийной уставкой');
        if (s.primaryPressureMPa < 15.7 || s.primaryPressureMPa > 16.6) return warn('P1 отклонилось от 16,2 МПа');
        return ok('P1 в норме');
      }
    },
    {
      n: 5, group: 'passive', name: 'Гидроёмкости САОЗ первой ступени', code: 'ГЕ-1, 4 × 60 м³, KKS JNG50…80',
      purpose: 'Пассивно, под давлением азота (5,9 МПа), подают раствор борной кислоты (не менее 16 г/кг) в напорную камеру реактора, под активную зону, при P1 < 5,9 МПа — до включения насосов САОЗ НД. Ёмкостей второй ступени (ГЕ-2) в проекте В-491 нет.',
      pin: [480, 160], pin2: [576, 160],
      state: () => {
        const s = S();
        if ((s.geFlowKgS || 0) > 0.5) return active(`Разряд: запас ${fmt(s.saozWaterPct, 0)} %, N₂ ${fmt(s.gePressMPa, 2)} МПа`);
        if (s.saozWaterPct < 99) return warn(`Запас ${fmt(s.saozWaterPct, 0)} %`);
        return ok('Готовность: запас 100 %, отсечены обратными клапанами');
      }
    },
    {
      n: 6, group: 'contain', name: 'Внутренняя защитная оболочка', code: 'ВЗО, преднапряжённый ж/б со стальной облицовкой',
      purpose: 'Главный локализующий барьер безопасности из предварительно напряжённого железобетона с герметичной стальной облицовкой 6 мм: удерживает парогазовую смесь и радиоактивные среды при проектных и запроектных авариях.',
      pin: [214, 520],
      state: () => (isLoca() ? warn(`Локализация течи: ${fmt(S().containmentPressMPa, 3)} МПа, ${fmt(S().containmentTempC, 0)} °C`) : struct('Пассивный защитный барьер: герметична'))
    },
    {
      n: 7, group: 'contain', name: 'Наружная защитная оболочка', code: 'НЗО, монолитный ж/б, кольцевой зазор',
      purpose: 'Воспринимает экстремальные внешние воздействия (падение самолёта, ударная волна, ураган). Между ВЗО и НЗО поддерживается разрежение в кольцевом зазоре с очисткой воздуха на фильтрах.',
      pin: [172, 214],
      state: () => struct('Пассивный защитный барьер: разрежение в кольцевом зазоре')
    },
    {
      n: 8, group: 'active', name: 'Бак запаса борированной воды низкой концентрации', code: 'Баки-приямки ГО, 2 × 1000 м³, ≥ 16 г/кг',
      purpose: 'Запас борированной воды внутри гермооболочки для насосов САОЗ НД, САОЗ ВД и спринклерной системы; при аварии с течью принимает теплоноситель из приямка ГО для замкнутой рециркуляции.',
      pin: [826, 480],
      state: () => (isLoca() ? active('Принимает теплоноситель из течи, рециркуляция') : ok('Запас в норме'))
    },
    {
      n: 9, group: 'active', name: 'Спринклерный насос', code: 'Спринклерная система, 4 × 50 %',
      purpose: 'Подаёт охлаждённую борированную воду с добавкой щёлочи и химреагентов в спринклерный коллектор под куполом ВЗО, конденсируя пар, снижая давление и связывая радиоактивный йод.',
      pin: [226, 640],
      state: () => (S().sprinklerActive ? active(`Подача под купол, Pго ${fmt(S().containmentPressMPa, 3)} МПа`) : idle('Резерв: запуск по росту давления в ГО'))
    },
    {
      n: 10, group: 'active', name: 'Теплообменник аварийного расхолаживания', code: 'ТО САОЗ / спринклера, 4 канала, KKS JNB10…40',
      purpose: 'Отводит тепло от воды, забираемой из бака-приямка ГО, в систему технической воды ответственных потребителей перед подачей на всас насосов САОЗ и спринклерной системы.',
      pin: [748, 612],
      state: () => (S().eccsPumpsRunning ? active('Охлаждение воды САОЗ / спринклера') : idle('Резерв'))
    },
    {
      n: 11, group: 'active', name: 'Насос аварийного впрыска низкого давления', code: 'САОЗ НД, 4 × 100 %, KKS JNG1',
      purpose: 'Подаёт большой расход борированной воды (750 м³/ч на канал) в 1-й контур и напорную камеру реактора при большой течи и длительном расхолаживании. Подача начинается при P1 ниже 2,45 МПа, номинальный расход — при 1,47 МПа и ниже (напор 150 м).',
      pin: [548, 626],
      state: () => {
        const s = S();
        if ((s.lpFlowKgS || 0) > 0.5) return active(`Подача ${kgs(s.lpFlowKgS)} м³/ч в холодные нитки и напорную камеру`);
        if (s.eccsPumpsRunning) return warn('Насос в работе на рециркуляцию: P1 выше 2,45 МПа');
        return idle('Резерв: P1 выше 2,45 МПа');
      }
    },
    {
      n: 12, group: 'active', name: 'Насос аварийного впрыска высокого давления', code: 'САОЗ ВД, 4 × 100 %, KKS JND',
      purpose: 'Компенсирует малые и средние течи 1-го контура: подаёт борированную воду (150 м³/ч на канал). Подача начинается при P1 ниже 7,9 МПа, номинальный расход — при 6,37 МПа и ниже (напор 650 м).',
      pin: [624, 626],
      state: () => {
        const s = S();
        if ((s.hpFlowKgS || 0) > 0.5) return active(`Подача ${kgs(s.hpFlowKgS)} м³/ч в 1-й контур и напорную камеру`);
        if (s.eccsPumpsRunning) return warn('Насос в работе на рециркуляцию: P1 выше 7,9 МПа');
        return idle('Резерв: P1 выше 7,9 МПа');
      }
    },
    {
      n: 13, group: 'chem', name: 'Бак борированной воды высокой концентрации', code: 'Баки запаса бора, 2 × 150 м³, 40 г/кг',
      purpose: 'Запас концентрированного раствора борной кислоты (40 г/кг) для аварийного ввода бора и перевода реактора в подкритическое состояние при отказе СУЗ. Один бак обслуживает два канала насосов.',
      pin: [414, 590],
      state: () => ok('Запас в норме')
    },
    {
      n: 14, group: 'chem', name: 'Насос аварийного ввода бора', code: 'Аварийный ввод бора, 4 × 50 %',
      purpose: 'Плунжерный насос высокого давления (напор до 24,5 МПа): подаёт концентрированный раствор борной кислоты (40 г/кг) в холодную нитку 1-го контура при полном давлении контура.',
      pin: [432, 680],
      state: () => (S().boronMode === 1 ? active('Ввод бора в 1-й контур') : idle('Резерв'))
    },
    {
      n: 15, group: 'chem', name: 'Бак подачи химреагентов', code: 'Баки химреагентов, 2 × 15 м³',
      purpose: 'Хранит запас раствора химреагентов для дозирования в спринклерную воду, обеспечивая перевод радиоактивного молекулярного йода в нелетучие ионные соединения.',
      pin: [296, 584],
      state: () => idle('Резерв')
    },
    {
      n: 16, group: 'chem', name: 'Насос подачи химреагентов', code: 'Дозирование реагентов, 4 канала',
      purpose: 'Насос-дозатор: подаёт раствор химреагентов из баков во всасывающий/напорный тракт спринклерных насосов при работе спринклерной системы.',
      pin: [342, 700],
      state: () => (S().sprinklerActive ? active('Дозирование в тракт спринклера') : idle('Резерв'))
    },
    {
      n: 17, group: 'contain', name: 'Спринклерный коллектор', code: 'Кольцевые коллекторы с форсунками под куполом ВЗО',
      purpose: 'Четыре независимых кольцевых коллектора с центробежными форсунками под куполом ВЗО: распыляют охлаждённый борно-щелочной раствор для конденсации пара и осаждения радионуклидов.',
      pin: [528, 100],
      state: () => (S().sprinklerActive ? active('Распыление раствора под куполом') : idle('Сухой, в режиме ожидания'))
    },
    {
      n: 18, group: 'passive', name: 'Пассивные рекомбинаторы водорода', code: 'ПАР, каталитические рекомбинаторы в объёме ВЗО',
      purpose: 'Пассивные автокаталитические рекомбинаторы: беспламенно окисляют водород кислородом воздуха на платино-палладиевом катализаторе без внешних источников питания, исключая детонацию.',
      pin: [468, 111], pin2: [588, 111],
      state: () => (S().ulrCoolingActive || (isLoca() && S().saozWaterPct <= 0) ? active('Работа: рекомбинация водорода в ГО') : ok('Готовность'))
    },
    {
      n: 19, group: 'primary', name: 'Барботер', code: 'Бак-барботер КД',
      purpose: 'Горизонтальный сосуд с запасом охлаждённой воды: принимает, распределяет через сопла и конденсирует пар при срабатывании импульсно-предохранительных устройств (ИПУ КД).',
      pin: [344, 211],
      state: () => (S().ipuKdOpen ? active('Приём пара от ИПУ КД') : ok('Норма'))
    },
    {
      n: 20, group: 'passive', name: 'Устройство локализации расплава', code: 'УЛР («ловушка расплава»)',
      purpose: 'Устанавливается в подреакторном пространстве: принимает, захолаживает и переводит в подкритическое состояние кориум (расплав активной зоны) при тяжёлой запроектной аварии.',
      pin: [612, 524],
      state: () => (S().ulrCoolingActive ? active('Подача охлаждающей воды') : ok('Готовность'))
    },
    {
      n: 21, group: 'chem', name: 'Бак аварийного запаса щёлочи', code: 'Бак запаса щёлочи, 15 м³, 42 % NaOH',
      purpose: 'Запас 42 % раствора гидроксида натрия (NaOH): подаётся насосом (30 м³/ч) во всас спринклерных насосов и баки-приямки при мощности дозы в ГО 100 Гр/ч для поддержания щелочного pH и удержания йода.',
      pin: [190, 650],
      state: () => idle('Резерв')
    },
    {
      n: 22, group: 'contain', name: 'Приямок защитной оболочки', code: 'Приямок ГО с фильтрующими кассетами',
      purpose: 'Нижняя водосборная точка ВЗО с кассетными сетчатыми фильтрами удержания теплоизоляционного дебриса: направляет пролившийся теплоноситель в бак-приямок на рециркуляцию насосами САОЗ и спринклера.',
      pin: [688, 562],
      state: () => (isLoca() ? active('Сбор воды, рециркуляция') : ok('Сухой'))
    },
    {
      n: 23, group: 'contain', name: 'Вентустановка разрежения в кольцевом зазоре', code: 'Аварийная вентиляция межоболочечного пространства',
      purpose: 'Отсасывает воздух из кольцевого зазора между ВЗО и НЗО и направляет его на фильтровальную установку, гарантируя отсутствие неорганизованных протечек мимо фильтров.',
      pin: [56, 406],
      state: () => (isLoca() ? active('Работа: разрежение в зазоре') : idle('Резерв'))
    },
    {
      n: 24, group: 'contain', name: 'Фильтровальная установка', code: 'Аэрозольный и сорбционный йодный фильтр',
      purpose: 'Двухступенчатая газоочистка (высокоэффективные аэрозольные фильтры + угольные сорбционные колонны): улавливает радиоактивные аэрозоли и летучие формы йода из воздуха кольцевого зазора.',
      pin: [56, 468],
      state: () => (isLoca() ? active('Очистка воздуха') : idle('Резерв'))
    },
    {
      n: 25, group: 'contain', name: 'Вентиляционная труба', code: 'Высотная венттруба РО',
      purpose: 'Обеспечивает организованный высотный отвод и рассеивание в атмосфере воздуха после очистки на фильтровальной установке и штатных вентсистемах реакторного отделения.',
      pin: [100, 340],
      state: () => struct('Пассивный конструктив: тракт высотного рассеивания открыт')
    },
    {
      n: 26, group: 'active', name: 'Бак запаса обессоленной воды', code: 'Баки запаса АПЭН, 4 × 700 м³',
      purpose: 'Запас чистого конденсата (4 × 700 м³) для подпитки парогенераторов насосами аварийной питательной воды (АПЭН) при полном обесточивании или потере основных ПЭН.',
      pin: [1110, 452],
      state: () => ok('Запас в норме')
    },
    {
      n: 27, group: 'active', name: 'Аварийный питательный насос', code: 'АПЭН, 4 канала × 150 м³/ч',
      purpose: 'Подаёт обессоленную воду из баков запаса непосредственно в парогенераторы для отвода остаточного тепловыделения при отказе основных питательных насосов (ПЭН).',
      pin: [962, 572],
      state: () => (S().feedwaterFlowPct < 20 && S().thermalPowerMW > 50 ? warn('Требуется подпитка ПГ') : idle('Резерв'))
    },
    {
      n: 28, group: 'passive', name: 'Конденсатор СПОТ ГО', code: 'СПОТ ЗО, 4 канала (16 × 75 м²)',
      purpose: 'Трубчатый теплообменник-конденсатор под куполом ВЗО: конденсирует пар из парогазовой среды гермооболочки и по контуру естественной циркуляции отводит тепло в баки СПОТ (БАОТ).',
      pin: [716, 186],
      state: () => ((S().spotGoHeatMW || 0) > 0.1 ? active(`Отвод тепла из ГО: ${fmt(S().spotGoHeatMW, 1)} МВт`) : ok('Готовность'))
    },
    {
      n: 29, group: 'passive', name: 'Бак СПОТ', code: 'БАОТ, 4 × 538 м³',
      purpose: 'Четыре кольцевых бака аварийного отвода тепла (БАОТ) на куполе НЗО: конечный поглотитель тепла для систем СПОТ ПГ и СПОТ ГО за счёт нагрева и выкипания воды в атмосферу (автономность не менее 24 ч).',
      pin: [1110, 50],
      state: () => (S().spotActive ? active('Приём тепла, испарение') : ok('Запас в норме'))
    },
    {
      n: 30, group: 'passive', name: 'Теплообменник СПОТ', code: 'СПОТ ПГ, 4 канала (72 × 12 м²)',
      purpose: 'Погружной трубчатый теплообменник в баке БАОТ: принимает пар из парогенератора, конденсирует его за счёт кипения воды в БАОТ и возвращает конденсат самотёком в ПГ.',
      pin: [918, 50],
      state: () => (S().spotActive ? active(`Отвод тепла от ПГ, P2 ${fmt(S().steamHeaderPressMPa, 2)} МПа`) : ok('Готовность: клапаны закрыты'))
    }
  ];
  const ITEM_BY_N = new Map(ITEMS.map((it) => [it.n, it]));

  // --------------------------------------------------------------------------
  // 4. ПОСТРОЕНИЕ SVG
  // --------------------------------------------------------------------------
  let svgParts = [];
  const push = (s) => svgParts.push(s);
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');

  // Трубопровод: белая подложка (читаемые пересечения) + цветная линия + слой потока
  // Принадлежность линии к системе (для изоляции чипами)
  const FLOW_SYS = { loop1: 'primary', loop4: 'primary', ipu: 'primary', przSpray: 'primary', saoz: 'passive', spot: 'passive', boron: 'chem', eccs: 'active', sump: 'active', feed: 'active', vent: 'contain', steam: 'secondary', feedMain: 'secondary' };
  function sysOf(cls, opts) {
    if (opts.sys) return opts.sys;
    if (opts.flow === 'spray') return /ctn-cold/.test(cls) ? 'primary' : 'contain';
    if (opts.flow && FLOW_SYS[opts.flow]) return FLOW_SYS[opts.flow];
    if (/ctn-hot|ctn-cold|ctn-relief/.test(cls)) return 'primary';
    if (/ctn-feed/.test(cls)) return 'active';
    return 'chem';
  }

  // Опознавательная окраска по ГОСТ 14202-69: вода — зелёный, пар — красный, воздух — синий, щёлочи — фиолетовый.
  // Жёлтые предупреждающие кольца — радиоактивная среда (1-й контур и рециркуляция из приямка).
  const MEDIA_BY_KEY = {
    steam: 'steam', spotSteam: 'steam', relief: 'steam',
    vent1: 'air', vent2: 'air', vent3: 'air',
    chem1: 'alkali', chem2: 'alkali', alkali: 'alkali'
  };
  const RADIOACTIVE_KEYS = new Set(['hot1', 'cold1a', 'cold1b', 'hot4', 'cold4a', 'cold4b', 'surge', 'przSpray', 'relief',
    'sump1', 'sumpHeader', 'suct9', 'suct11', 'suct12']);

  function pipe(points, cls, opts = {}) {
    const p = pts(points);
    const flowAttr = opts.flow ? ` data-flow="${opts.flow}"` : '';
    const media = MEDIA_BY_KEY[opts.key] || 'water';
    push(`<g class="ctn-line" data-sys="${sysOf(cls, opts)}" data-key="${opts.key || ''}" data-media="${media}">`);
    push(`<polyline class="ctn-halo" points="${p}"/>`);
    push(`<polyline class="ctn-pipe ${cls}" points="${p}"/>`);
    if (RADIOACTIVE_KEYS.has(opts.key)) push(`<polyline class="ctn-rings" points="${p}"/>`);
    if (opts.flow) push(`<polyline class="ctn-flow ${cls}-flow"${flowAttr} points="${p}"/>`);
    push(`<polyline class="ctn-trace" points="${p}"/>`);
    push('</g>');
  }

  function component(n, inner) {
    push(`<g class="ctn-node" data-n="${n}">${inner}</g>`);
  }

  // Насос: окружность со стрелкой направления подачи. dir: 1 — вправо, -1 — влево, 0 — вверх
  function pumpSymbol(cx, cy, r, dir) {
    let tri;
    if (dir === 0) tri = `${cx - r * 0.55},${cy + r * 0.35} ${cx + r * 0.55},${cy + r * 0.35} ${cx},${cy - r * 0.6}`;
    else tri = `${cx - dir * r * 0.4},${cy - r * 0.55} ${cx - dir * r * 0.4},${cy + r * 0.55} ${cx + dir * r * 0.62},${cy}`;
    return `<circle class="ctn-pump" cx="${cx}" cy="${cy}" r="${r}"/><polygon class="ctn-pump-tri" points="${tri}"/>`;
  }

  // Задвижка по ГОСТ 2.785: два встречных треугольника. vertical — для вертикальной линии
  function valve(cx, cy, vertical, id = '', cls = '') {
    const s = 7;
    const d = vertical
      ? `M${cx - s} ${cy - s} L${cx + s} ${cy - s} L${cx - s} ${cy + s} L${cx + s} ${cy + s} Z`
      : `M${cx - s} ${cy - s} L${cx + s} ${cy + s} L${cx + s} ${cy - s} L${cx - s} ${cy + s} Z`;
    return `<path ${id ? `id="${id}"` : ''} class="ctn-valve ${cls}" d="${d}"/>`;
  }

  // Уровень в ёмкости: штриховка среды + чёткая линия зеркала. Высота задаётся долей frac
  function level(id, x, yTop, w, h, frac, hatch, clipId) {
    const y = yTop + h * (1 - frac);
    const clip = clipId ? ` clip-path="url(#${clipId})"` : '';
    return `<g id="${id}" class="ctn-level" data-top="${yTop}" data-h="${h}"${clip}>
      <rect class="ctn-level-fill" x="${x}" y="${y}" width="${w}" height="${h * frac}" fill="url(#${hatch})"/>
      <line class="ctn-level-line" x1="${x}" y1="${y}" x2="${x + w}" y2="${y}"/>
    </g>`;
  }

  // Вертикальный бак с плоским днищем и внутренней перегородкой
  function tankV(id, x, y, w, h, frac, hatch) {
    return `<rect class="ctn-tank" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>` +
      level(id, x + 2, y + 2, w - 4, h - 4, frac, hatch) +
      `<line class="ctn-baffle" x1="${x + w * 0.5}" y1="${y + h * 0.3}" x2="${x + w * 0.5}" y2="${y + h - 2}"/>` +
      `<rect class="ctn-tank-outline" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`;
  }

  // Вертикальный цилиндр с эллиптическими (отбортованными) днищами
  function vesselPath(x, top, w, bottom, dish) {
    const r = w / 2;
    return `M${x} ${top + dish} A${r} ${dish} 0 0 1 ${x + w} ${top + dish} V${bottom - dish} A${r} ${dish} 0 0 1 ${x} ${bottom - dish} Z`;
  }

  function label(x, y, text, anchor = 'middle', cls = '') {
    push(`<text class="ctn-label ${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`);
  }

  function buildSvg() {
    svgParts = [];
    const geX = [412, 452, 604, 644];
    push(`<svg xmlns="${SVG_NS}" class="ctn-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Разрез гермооболочки В-491">`);
    push(`<defs>
      <pattern id="ctnConcrete" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="#E2E8F0"/><line x1="0" y1="0" x2="0" y2="7" stroke="#94A3B8" stroke-width="1"/>
      </pattern>
      <pattern id="ctnHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="#FFFFFF"/><line x1="0" y1="0" x2="0" y2="5" stroke="#334155" stroke-width="1.1"/>
      </pattern>
      <pattern id="ctnWaterHatch" width="6" height="4" patternUnits="userSpaceOnUse">
        <rect width="6" height="4" fill="#F0FDF4"/><line x1="0" y1="2" x2="6" y2="2" stroke="#86EFAC" stroke-width="1"/>
      </pattern>
      <pattern id="ctnAlkaliHatch" width="6" height="4" patternUnits="userSpaceOnUse">
        <rect width="6" height="4" fill="#F5F3FF"/><line x1="0" y1="2" x2="6" y2="2" stroke="#C4B5FD" stroke-width="1"/>
      </pattern>
      <pattern id="ctnBoronHatch" width="6" height="4" patternUnits="userSpaceOnUse">
        <rect width="6" height="4" fill="#F0FDF4"/><line x1="0" y1="2" x2="6" y2="2" stroke="#86EFAC" stroke-width="1"/>
      </pattern>
      <pattern id="ctnLattice" width="5.5" height="68" patternUnits="userSpaceOnUse" x="506" y="394">
        <line x1="0.5" y1="0" x2="0.5" y2="68" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="0.7"/>
      </pattern>
      <!-- Подогрев теплоносителя по высоте АЗ: вход снизу (холодные нитки) -> выход сверху (горячие нитки).
           Цвета стопов пересчитывает refreshCore() по тепловой мощности. -->
      <linearGradient id="coreHeatGradient" x1="0" y1="1" x2="0" y2="0">
        <stop id="ctnHeatStop0" offset="0" stop-color="#0284C7"/>
        <stop id="ctnHeatStop1" offset="0.28" stop-color="#38BDF8"/>
        <stop id="ctnHeatStop2" offset="0.68" stop-color="#EA580C"/>
        <stop id="ctnHeatStop3" offset="1" stop-color="#DC2626"/>
      </linearGradient>
      <clipPath id="ctnRodClip"><rect x="504" y="294" width="48" height="168"/></clipPath>
      <clipPath id="ctnPrzClip"><path d="${vesselPath(364, 148, 30, 300, 15)}"/></clipPath>
      ${geX.map((x, i) => `<clipPath id="ctnGeClip${i}"><path d="${vesselPath(x - 14, 140, 28, 214, 8)}"/></clipPath>`).join('')}
      <clipPath id="ctnCatcherClip"><polygon points="494,527 562,527 554,541 502,541"/></clipPath>
      <clipPath id="ctnSgClipL"><rect x="220" y="284" width="130" height="36" rx="18"/></clipPath>
      <clipPath id="ctnSgClipR"><rect x="706" y="284" width="130" height="36" rx="18"/></clipPath>
      <clipPath id="ctnBubClip"><rect x="222" y="196" width="108" height="30" rx="15"/></clipPath>
    </defs>`);

    push(`<g id="ctnScene">`);

    // ---------- Грунт, здание безопасности, фундамент ----------
    push(`<rect class="ctn-ground" x="0" y="566" width="${VB_W}" height="${VB_H - 566}"/>`);
    push(`<line class="ctn-grade" x1="0" y1="566" x2="${VB_W}" y2="566"/>`);
    push(`<rect class="ctn-building" x="150" y="578" width="756" height="132" rx="3"/>`);
    label(894, 640, 'Здание безопасности', 'end', 'ctn-small ctn-strong');
    label(894, 656, '4 канала, показан один', 'end', 'ctn-small');

    // ---------- Защитные оболочки 6 и 7 (гладкий купол, без дефлектора) ----------
    component(7, `
      <path class="ctn-outer-edge" d="M164 552 V232 A364 200 0 0 1 892 232 V552"/>
      <path class="ctn-outer" d="M164 552 V232 A364 200 0 0 1 892 232 V552"/>
    `);
    push(`<path class="ctn-inner-fill" d="M208 548 V240 A320 176 0 0 1 848 240 V548 Z"/>`);
    component(6, `
      <path class="ctn-inner-edge" d="M204 552 V240 A324 180 0 0 1 852 240 V552"/>
      <path class="ctn-inner" d="M204 552 V240 A324 180 0 0 1 852 240 V552"/>
      <path class="ctn-liner" d="M208 548 V240 A320 176 0 0 1 848 240 V548"/>
    `);
    push(`<rect class="ctn-basemat" x="150" y="548" width="756" height="18" fill="url(#ctnConcrete)"/>`);

    // ---------- Шахта реактора ----------
    push(`<rect x="462" y="300" width="14" height="248" fill="url(#ctnConcrete)" class="ctn-concrete"/>`);
    push(`<rect x="580" y="300" width="14" height="248" fill="url(#ctnConcrete)" class="ctn-concrete"/>`);

    // ---------- Первый контур ----------
    // Петля 1 (слева): горячая нитка → ПГ-1 → холодная нитка → ГЦНА-1 → реактор
    pipe([[498, 334], [335, 334], [335, 320]], 'ctn-hot', { flow: 'loop1', key: 'hot1' });
    pipe([[250, 320], [250, 372], [284, 372]], 'ctn-cold', { flow: 'loop1', key: 'cold1a' });
    pipe([[316, 372], [498, 372]], 'ctn-cold', { flow: 'loop1', key: 'cold1b' });
    // Петля 2 (справа)
    pipe([[558, 334], [721, 334], [721, 320]], 'ctn-hot', { flow: 'loop4', key: 'hot4' });
    pipe([[806, 320], [806, 372], [772, 372]], 'ctn-cold', { flow: 'loop4', key: 'cold4a' });
    pipe([[740, 372], [558, 372]], 'ctn-cold', { flow: 'loop4', key: 'cold4b' });

    // КД: дыхательный трубопровод к горячей нитке, впрыск от холодной нитки, ИПУ → барботер
    pipe([[379, 300], [379, 334]], 'ctn-hot', { sys: 'primary', key: 'surge' });
    pipe([[356, 372], [356, 158], [364, 158]], 'ctn-cold ctn-thin', { flow: 'przSpray', key: 'przSpray' });
    pipe([[379, 148], [379, 140], [312, 140], [312, 196]], 'ctn-relief', { flow: 'ipu', key: 'relief' });

    // ГЕ-1: все 4 линии — в напорную камеру реактора, под активную зону (Поваров и др. 2025, с. 175, рис. 2.35–2.38).
    // Вход ниже разделительного кольца и выше холодных патрубков; пересечение с горячей ниткой — без соединения.
    pipe([[412, 214], [412, 228], [484, 228], [484, 360], [496, 360]], 'ctn-safety', { flow: 'saoz', key: 'geL' });
    pipe([[452, 214], [452, 228]], 'ctn-safety', { flow: 'saoz', key: 'geL' });
    pipe([[644, 214], [644, 228], [572, 228], [572, 360], [560, 360]], 'ctn-safety', { flow: 'saoz', key: 'geR' });
    pipe([[604, 214], [604, 228]], 'ctn-safety', { flow: 'saoz', key: 'geR' });

    // ---------- Второй контур ----------
    pipe([[240, 274], [240, 262], [14, 262]], 'ctn-steam', { flow: 'steam', key: 'steam' });
    push(`<polygon class="ctn-arrow-steam" points="14,262 26,256 26,268"/>`);
    label(30, 252, 'Пар на турбину', 'start', 'ctn-small');
    pipe([[14, 302], [220, 302]], 'ctn-feed', { flow: 'feedMain', key: 'feedMain' });
    push(`<polygon class="ctn-arrow-feed" points="214,302 202,296 202,308"/>`);
    label(30, 292, 'Питательная вода', 'start', 'ctn-small');

    // СПОТ ПГ: пар из ПГ-2 в теплообменник 30, конденсат самотёком обратно
    pipe([[770, 274], [770, 190], [960, 190], [960, 140]], 'ctn-safety', { flow: 'spot', key: 'spotSteam' });
    pipe([[1000, 140], [1000, 206], [800, 206], [800, 284]], 'ctn-safety ctn-thin', { flow: 'spot', key: 'spotCond' });
    // СПОТ ГО: конденсатор 28 ↔ бак 29
    pipe([[750, 152], [900, 152], [900, 100], [930, 100]], 'ctn-safety', { flow: 'spot', key: 'spotGo' });
    pipe([[750, 164], [912, 164], [912, 120], [930, 120]], 'ctn-safety ctn-thin', { flow: 'spot', key: 'spotGo' });

    // Аварийная питательная вода 26 → 27 → ПГ-2
    pipe([[1000, 530], [944, 530]], 'ctn-feed', { sys: 'active', key: 'af1' });
    pipe([[930, 516], [930, 302], [836, 302]], 'ctn-feed', { flow: 'feed', key: 'af2' });

    // ---------- Системы безопасности (бор, САОЗ, спринклер) ----------
    pipe([[250, 636], [250, 604], [186, 604], [186, 170], [258, 170]], 'ctn-safety', { flow: 'spray', key: 'sprinkler' });
    pipe([[318, 632], [318, 690]], 'ctn-safety ctn-thin', { key: 'chem1' });
    pipe([[308, 700], [276, 700], [276, 620], [250, 620]], 'ctn-safety ctn-thin', { key: 'chem2' });
    pipe([[190, 676], [190, 694], [236, 694]], 'ctn-safety ctn-thin', { key: 'alkali' });
    pipe([[380, 640], [380, 672], [396, 672]], 'ctn-safety ctn-thin', { key: 'boron1' });
    pipe([[410, 658], [410, 372]], 'ctn-safety', { flow: 'boron', key: 'boron2' });
    pipe([[560, 636], [560, 600], [650, 600], [650, 372]], 'ctn-safety', { flow: 'eccs', key: 'eccsMain' });
    pipe([[610, 636], [610, 600]], 'ctn-safety', { flow: 'eccs', key: 'eccs12' });
    // Каналы 2 и 4 САОЗ ВД/НД: через напорные линии JNG и линии ГЕ — в напорную камеру (с. 173, 175)
    pipe([[650, 420], [620, 420], [620, 360], [572, 360]], 'ctn-safety', { flow: 'eccs', key: 'eccsGe' });
    push('<circle class="ctn-junction" cx="650" cy="420" r="3.4"/><circle class="ctn-junction" cx="572" cy="360" r="3.4"/>');
    pipe([[720, 564], [720, 610]], 'ctn-safety ctn-thin', { flow: 'sump', key: 'sump1' });
    pipe([[720, 652], [720, 694], [236, 694]], 'ctn-safety ctn-thin', { flow: 'sump', key: 'sumpHeader' });
    pipe([[250, 664], [250, 694]], 'ctn-safety ctn-thin', { sys: 'active', key: 'suct9' });
    pipe([[560, 664], [560, 694]], 'ctn-safety ctn-thin', { sys: 'active', key: 'suct11' });
    pipe([[610, 664], [610, 694]], 'ctn-safety ctn-thin', { sys: 'active', key: 'suct12' });

    // Вентиляция кольцевого зазора 23 → 24 → 25
    pipe([[178, 500], [120, 500]], 'ctn-vent', { flow: 'vent', key: 'vent1' });
    pipe([[80, 486], [80, 472]], 'ctn-vent', { flow: 'vent', key: 'vent2' });
    pipe([[80, 432], [80, 410], [126, 410], [126, 380]], 'ctn-vent', { flow: 'vent', key: 'vent3' });

    // ---------- Арматура ----------
    push(valve(110, 262, false, 'ctnVBzok'));     // БЗОК
    push(valve(110, 302, false, 'ctnVFeed'));     // отсечная на питательной воде
    push(valve(356, 240, true, 'ctnVSpray'));     // впрыск КД
    push(valve(484, 262, true, 'ctnVGe1'));       // обратные клапаны ГЕ-1
    push(valve(572, 262, true, 'ctnVGe2'));
    push(valve(930, 190, false, 'ctnSpotValve')); // СПОТ ПГ
    push(valve(930, 420, true, 'ctnVAfw'));       // аварийная питательная
    push(valve(410, 470, true, 'ctnVBoron'));     // аварийный бор
    push(valve(650, 470, true, 'ctnVEccs'));      // САОЗ ВД/НД
    push(valve(220, 604, false, 'ctnVSprinkler')); // спринклер

    // ---------- 1. Реактор: ступенчатый корпус ВВЭР ----------
    component(1, `
      <rect class="ctn-drive" x="510" y="222" width="36" height="42" rx="2"/>
      <line class="ctn-drive-line" x1="518" y1="226" x2="518" y2="262"/>
      <line class="ctn-drive-line" x1="528" y1="226" x2="528" y2="262"/>
      <line class="ctn-drive-line" x1="538" y1="226" x2="538" y2="262"/>
      <path class="ctn-equip" d="M500 282 A28 18 0 0 1 556 282 Z"/>
      <rect class="ctn-equip ctn-flange" x="490" y="280" width="76" height="12"/>
      <path class="ctn-equip" d="M496 292 H560 V386 L556 394 V470 A28 28 0 0 1 500 470 V394 L496 386 Z"/>
      <line class="ctn-belt" x1="496" y1="320" x2="560" y2="320"/>
      <line class="ctn-belt" x1="496" y1="386" x2="560" y2="386"/>
      <line class="ctn-internals" x1="503" y1="296" x2="503" y2="462"/>
      <line class="ctn-internals" x1="553" y1="296" x2="553" y2="462"/>
      <!-- Активная зона 163 ТВС-2М: y 394…462 (высота 68 ед. = 373 см) -->
      <rect id="ctnCore" class="ctn-core-heat" x="506" y="394" width="44" height="68" fill="url(#coreHeatGradient)"/>
      <rect class="ctn-core" x="506" y="394" width="44" height="68" fill="url(#ctnLattice)"/>
      <!-- ОР СУЗ: наконечник в y = 394 при Н = 373 см; сдвиг вниз = доля введения × 68 -->
      <g id="ctnRods" clip-path="url(#ctnRodClip)">
        <g class="ctn-rod-g ctn-rod-az" data-rod="az"><line class="ctn-rod" x1="512" y1="224" x2="512" y2="394"/></g>
        <g class="ctn-rod-g ctn-rod-az" data-rod="az"><line class="ctn-rod" x1="520" y1="224" x2="520" y2="394"/></g>
        <g class="ctn-rod-g ctn-rod-work" data-rod="work"><line class="ctn-rod" x1="528" y1="224" x2="528" y2="394"/></g>
        <g class="ctn-rod-g ctn-rod-az" data-rod="az"><line class="ctn-rod" x1="536" y1="224" x2="536" y2="394"/></g>
        <g class="ctn-rod-g ctn-rod-az" data-rod="az"><line class="ctn-rod" x1="544" y1="224" x2="544" y2="394"/></g>
      </g>
      <rect class="ctn-core-outline" x="506" y="394" width="44" height="68"/>
      <text class="ctn-core-label" x="528" y="445" text-anchor="middle">163 ТВС-2М</text>
      <text class="ctn-core-label ctn-core-power" id="ctnCorePower" x="528" y="455" text-anchor="middle">3200 МВт</text>
      <rect class="ctn-hit" x="488" y="218" width="80" height="284"/>
    `);

    // ---------- 20. УЛР: направляющая плита-конус и тигель-ловушка ----------
    component(20, `
      <path class="ctn-guide" d="M478 504 L514 518 M578 504 L542 518"/>
      <path class="ctn-catcher" d="M480 522 H576 L566 546 H490 Z" fill="url(#ctnHatch)"/>
      <polygon class="ctn-catcher-cavity" points="494,527 562,527 554,541 502,541"/>
      <rect id="ctnCatcherWater" x="494" y="541" width="68" height="0" fill="url(#ctnWaterHatch)" clip-path="url(#ctnCatcherClip)"/>
      <rect class="ctn-hit" x="474" y="500" width="108" height="48"/>
    `);

    // ---------- 2. Парогенераторы ПГВ-1000МКП ----------
    const sg = (x, domes, clipId, lvlId) => `
      ${domes.map((d) => `<path class="ctn-equip" d="M${d - 14} 286 A14 12 0 0 1 ${d + 14} 286 Z"/>`).join('')}
      <rect class="ctn-equip" x="${x}" y="284" width="130" height="36" rx="18"/>
      ${level(lvlId, x, 284, 130, 36, 0.72, 'ctnWaterHatch', clipId)}
      <rect class="ctn-bundle" x="${x + 16}" y="302" width="98" height="13" rx="6"/>
      <rect class="ctn-collector" x="${x + 25}" y="316" width="10" height="8"/>
      <rect class="ctn-collector" x="${x + 110}" y="316" width="10" height="8"/>
      <rect class="ctn-outline" x="${x}" y="284" width="130" height="36" rx="18"/>
    `;
    component(2, sg(220, [240, 296], 'ctnSgClipL', 'ctnSgLvl1') + sg(706, [770, 820], 'ctnSgClipR', 'ctnSgLvl4') +
      '<rect class="ctn-hit" x="214" y="270" width="142" height="56"/><rect class="ctn-hit" x="700" y="270" width="142" height="56"/>');

    // ---------- 3. ГЦНА ----------
    component(3, `
      <g id="ctnPump1">${pumpSymbol(300, 372, 16, 1)}</g>
      <g id="ctnPump4">${pumpSymbol(756, 372, 16, -1)}</g>
      <rect class="ctn-hit" x="280" y="352" width="40" height="40"/><rect class="ctn-hit" x="736" y="352" width="40" height="40"/>
    `);

    // ---------- 4. КД ----------
    component(4, `
      <path class="ctn-equip" d="${vesselPath(364, 148, 30, 300, 15)}"/>
      ${level('ctnPrzLvl', 364, 148, 30, 152, 0.7, 'ctnWaterHatch', 'ctnPrzClip')}
      <path id="ctnPrzHeaters" class="ctn-heaters" d="M369 290 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5"/>
      <path class="ctn-outline" d="${vesselPath(364, 148, 30, 300, 15)}"/>
      <rect class="ctn-hit" x="358" y="134" width="42" height="170"/>
    `);
    push(valve(345, 140, false, 'ctnIpu'));

    // ---------- 19. Барботер ----------
    component(19, `<rect class="ctn-equip" x="222" y="196" width="108" height="30" rx="15"/>
      ${level('ctnBubLvl', 222, 196, 108, 30, 0.45, 'ctnWaterHatch', 'ctnBubClip')}
      <rect class="ctn-outline" x="222" y="196" width="108" height="30" rx="15"/>`);

    // ---------- 5. ГЕ-1: 4 цилиндра с эллиптическими днищами, азотная подушка сверху ----------
    const ge = (x, i) => `
      <path class="ctn-equip" d="${vesselPath(x - 14, 140, 28, 214, 8)}"/>
      ${level('ctnGeLvl' + i, x - 14, 140, 28, 74, 0.8, 'ctnBoronHatch', 'ctnGeClip' + i)}
      <path class="ctn-outline" d="${vesselPath(x - 14, 140, 28, 214, 8)}"/>
      <text class="ctn-n2" x="${x}" y="156" text-anchor="middle">N₂</text>
    `;
    component(5, geX.map(ge).join(''));
    label(447, 240, 'в напорную', 'middle', 'ctn-tiny');
    label(447, 251, 'камеру', 'middle', 'ctn-tiny');
    label(609, 240, 'в напорную', 'middle', 'ctn-tiny');
    label(609, 251, 'камеру', 'middle', 'ctn-tiny');

    // ---------- 17. Спринклерный коллектор под куполом ----------
    let nozzles = '';
    for (let k = -6; k <= 6; k++) {
      const dx = k * 42;
      const y = 240 - 160 * Math.sqrt(Math.max(0, 1 - (dx / 300) * (dx / 300)));
      nozzles += `<path class="ctn-nozzle" d="M${528 + dx} ${y + 2} l-4 8 h8 z"/>`;
    }
    component(17, `
      <path class="ctn-spray-header" d="M258 170 A300 160 0 0 1 798 170"/>
      <path class="ctn-hit-line" d="M258 170 A300 160 0 0 1 798 170"/>
      <g id="ctnSprayNozzles">${nozzles}</g>
    `);

    // ---------- 18. Пассивные каталитические рекомбинаторы ----------
    const par = (x) => `<path class="ctn-equip" d="M${x} 122 V104 L${x + 6} 100 H${x + 22} L${x + 28} 104 V122 Z"/>
      ${[5, 10, 15, 20].map((o) => `<line class="ctn-par-grid" x1="${x + 2 + o}" y1="106" x2="${x + 2 + o}" y2="119"/>`).join('')}`;
    component(18, par(426) + par(602));

    // ---------- 28. Конденсатор СПОТ ГО ----------
    component(28, `<rect class="ctn-equip" x="684" y="146" width="66" height="24" rx="3"/>
      <path class="ctn-coil" d="M690 158 q6 -8 12 0 t12 0 t12 0 t12 0 t12 0"/>`);

    // ---------- 29/30. Бак СПОТ и теплообменник СПОТ ПГ ----------
    component(29, `
      <rect class="ctn-tank" x="930" y="60" width="160" height="82" rx="4"/>
      ${level('ctnSpotLvl', 932, 62, 156, 78, 0.85, 'ctnWaterHatch')}
      <rect class="ctn-tank-outline" x="930" y="60" width="160" height="82" rx="4"/>
      <path class="ctn-steam-out" d="M1050 56 q6 -10 0 -20 M1070 56 q6 -10 0 -20"/>
    `);
    component(30, `
      <rect class="ctn-equip" x="948" y="88" width="64" height="40" rx="3"/>
      <path class="ctn-coil" d="M954 108 q6 -10 12 0 t12 0 t12 0 t12 0"/>
    `);

    // ---------- 8. Бак запаса бора низкой концентрации и 22. приямок ГО ----------
    component(8, `<rect class="ctn-tank" x="660" y="494" width="180" height="48" rx="3"/>
      ${level('ctnSumpLvl', 662, 496, 176, 44, 0.55, 'ctnBoronHatch')}
      <line class="ctn-baffle" x1="720" y1="508" x2="720" y2="540"/><line class="ctn-baffle" x1="780" y1="508" x2="780" y2="540"/>
      <rect class="ctn-tank-outline" x="660" y="494" width="180" height="48" rx="3"/>`);
    component(22, `<rect class="ctn-tank" x="704" y="548" width="32" height="16" rx="1"/>
      ${level('ctnPitLvl', 706, 550, 28, 12, 0.1, 'ctnBoronHatch')}
      <rect class="ctn-tank-outline" x="704" y="548" width="32" height="16" rx="1"/>`);

    // ---------- Здание безопасности ----------
    component(9, `<g id="ctnPump9">${pumpSymbol(250, 650, 14, 0)}</g>`);
    component(21, tankV('ctnLvl21', 176, 616, 28, 60, 0.75, 'ctnAlkaliHatch'));
    component(15, tankV('ctnLvl15', 300, 596, 36, 36, 0.7, 'ctnAlkaliHatch'));
    component(16, `<g id="ctnPump16">${pumpSymbol(318, 700, 10, -1)}</g>`);
    component(13, tankV('ctnLvl13', 360, 588, 40, 52, 0.8, 'ctnBoronHatch'));
    component(14, `<g id="ctnPump14">${pumpSymbol(410, 672, 14, 0)}</g>`);
    component(11, `<g id="ctnPump11">${pumpSymbol(560, 650, 14, 0)}</g>`);
    component(12, `<g id="ctnPump12">${pumpSymbol(610, 650, 14, 0)}</g>`);
    component(10, `<rect class="ctn-equip" x="704" y="610" width="32" height="42" rx="3"/>
      <path class="ctn-coil" d="M712 616 q8 6 0 12 t0 12 t0 12"/>`);

    // ---------- Вентиляция кольцевого зазора ----------
    push(`<rect class="ctn-aux" x="30" y="380" width="112" height="168" rx="3"/>`);
    component(23, `<rect class="ctn-equip" x="44" y="486" width="76" height="30" rx="3"/>
      <circle class="ctn-fan" cx="82" cy="501" r="9"/><path class="ctn-fan" d="M82 492 L82 510 M73 501 L91 501"/>`);
    component(24, `<rect class="ctn-equip" x="50" y="432" width="60" height="40" rx="3"/>
      <path class="ctn-filter" d="M56 438 L104 466 M56 466 L104 438"/>`);
    component(25, `<rect class="ctn-equip" x="117" y="318" width="18" height="62"/>
      <line class="ctn-filter" x1="117" y1="328" x2="135" y2="328"/>`);

    // ---------- 26/27. Аварийная питательная вода ----------
    component(26, tankV('ctnLvl26', 1000, 470, 110, 78, 0.8, 'ctnWaterHatch'));
    component(27, `<g id="ctnPump27">${pumpSymbol(930, 530, 14, 0)}</g>`);

    // ---------- Подписи узлов ----------
    label(528, 214, 'Реактор', 'middle', 'ctn-name');
    label(285, 346, 'ПГ-1', 'middle', 'ctn-name');
    label(771, 346, 'ПГ-2', 'middle', 'ctn-name');
    label(300, 426, 'ГЦНА-1', 'middle', 'ctn-name');
    label(756, 426, 'ГЦНА-2', 'middle', 'ctn-name');
    label(332, 177, 'КД', 'end', 'ctn-name');
    label(440, 327, 'горячая нитка', 'middle', 'ctn-leg');
    label(455, 389, 'холодная нитка', 'middle', 'ctn-leg');
    label(640, 327, 'горячая нитка', 'middle', 'ctn-leg');
    label(700, 389, 'холодная нитка', 'middle', 'ctn-leg');
    label(276, 190, 'Барботер', 'middle', 'ctn-small');
    label(750, 486, 'Бак-приямок', 'middle', 'ctn-small');
    label(1010, 160, 'Бак СПОТ', 'start', 'ctn-small');
    label(1055, 584, 'Обессоленная вода', 'middle', 'ctn-small');
    label(86, 561, 'Вентиляция зазора', 'middle', 'ctn-small');
    label(452, 530, 'УЛР', 'end', 'ctn-name');
    label(944, 396, 'Аварийная', 'start', 'ctn-small');
    label(944, 410, 'питательная вода', 'start', 'ctn-small');

    // Индикатор течи
    push(`<g id="ctnLeak" class="ctn-leak" style="display:none">
      <circle cx="680" cy="372" r="11"/>
      <path d="M680 384 q-6 10 0 16 q6 -6 0 -16" />
      <text x="680" y="358" text-anchor="middle">ТЕЧЬ</text>
    </g>`);

    // ---------- Легенда: среды по ГОСТ 14202-69 и состояния оборудования ----------
    push(`<g class="ctn-legend-svg" transform="translate(914, 596)">
      <rect class="ctn-legend-box" x="0" y="0" width="282" height="120" rx="4"/>
      <line x1="10" y1="15" x2="34" y2="15" stroke="#15803D" stroke-width="3"/><text x="40" y="19">Вода</text>
      <line x1="10" y1="33" x2="34" y2="33" stroke="#DC2626" stroke-width="3"/><text x="40" y="37">Пар</text>
      <line x1="10" y1="51" x2="34" y2="51" stroke="#2563EB" stroke-width="3"/><text x="40" y="55">Воздух</text>
      <line x1="10" y1="69" x2="34" y2="69" stroke="#7C3AED" stroke-width="3"/><text x="40" y="73">Щёлочи</text>
      <line x1="10" y1="87" x2="34" y2="87" stroke="#15803D" stroke-width="3"/><line x1="10" y1="87" x2="34" y2="87" stroke="#EAB308" stroke-width="8" stroke-dasharray="3 7"/><text x="40" y="91">Радиоактивная среда</text>
      <circle cx="148" cy="15" r="6" fill="#DC2626"/><text x="160" y="19">включено / открыто</text>
      <circle cx="148" cy="33" r="6" fill="#16A34A"/><text x="160" y="37">отключено / закрыто</text>
      <text class="ctn-legend-note" x="10" y="111">Окраска сред по ГОСТ 14202-69</text>
    </g>`);

    // ---------- Номерные бейджи ----------
    push('<g id="ctnPins">');
    ITEMS.forEach((it) => {
      [it.pin, it.pin2].filter(Boolean).forEach(([x, y]) => {
        push(`<g class="ctn-pin" data-n="${it.n}" transform="translate(${x},${y})">
          <circle r="10.5"/><text y="4" text-anchor="middle">${it.n}</text></g>`);
      });
    });
    push('</g>');

    push('</g></svg>');
    return svgParts.join('');
  }

  // --------------------------------------------------------------------------
  // 4а. ТОПОЛОГИЯ: технологические связи между позициями (рёбра графа)
  //     keys — ключи трубопроводов на SVG (data-key), a → b — направление потока
  //     Строка вместо номера — внешняя граница схемы (турбина, ПЭН, кольцевой зазор)
  // --------------------------------------------------------------------------
  const SHORT = {
    1: 'Реактор', 2: 'ПГ', 3: 'ГЦНА', 4: 'КД', 5: 'ГЕ-1', 6: 'ВЗО', 7: 'НЗО', 8: 'Бак-приямок',
    9: 'Спринклерный насос', 10: 'ТО расхолаживания', 11: 'Насос САОЗ НД', 12: 'Насос САОЗ ВД',
    13: 'Бак бора высокой концентрации', 14: 'Насос ввода бора', 15: 'Бак химреагентов', 16: 'Насос химреагентов',
    17: 'Спринклерный коллектор', 18: 'ПАР', 19: 'Барботер', 20: 'УЛР', 21: 'Бак щёлочи', 22: 'Приямок ГО',
    23: 'Вентустановка', 24: 'Фильтровальная установка', 25: 'Венттруба', 26: 'Бак обессоленной воды', 27: 'АПЭН',
    28: 'Конденсатор СПОТ ГО', 29: 'Бак СПОТ', 30: 'ТО СПОТ ПГ'
  };

  const EDGES = [
    { a: 1, b: 2, lb: 'ПГ-1', keys: ['hot1'], name: 'Горячая нитка петли 1, Ду850', loop: true },
    { a: 2, b: 3, la: 'ПГ-1', lb: 'ГЦНА-1', keys: ['cold1a'], name: 'Холодная нитка петли 1 (всас ГЦНА-1), Ду850', loop: true },
    { a: 3, b: 1, la: 'ГЦНА-1', keys: ['cold1b'], name: 'Холодная нитка петли 1 (напор ГЦНА-1), Ду850', loop: true },
    { a: 1, b: 2, lb: 'ПГ-2', keys: ['hot4'], name: 'Горячая нитка петли 2, Ду850', loop: true },
    { a: 2, b: 3, la: 'ПГ-2', lb: 'ГЦНА-2', keys: ['cold4a'], name: 'Холодная нитка петли 2 (всас ГЦНА-2), Ду850', loop: true },
    { a: 3, b: 1, la: 'ГЦНА-2', keys: ['cold4b'], name: 'Холодная нитка петли 2 (напор ГЦНА-2), Ду850', loop: true },
    { a: 1, b: 4, keys: ['surge', 'hot1'], name: 'Соединительный трубопровод КД (от горячей нитки петли 1)', both: true },
    { a: 3, b: 4, la: 'ГЦНА-1', keys: ['przSpray', 'cold1b'], name: 'Впрыск в КД (от напора ГЦНА-1)' },
    { a: 4, b: 19, keys: ['relief'], name: 'Сброс пара от ИПУ КД' },
    { a: 5, b: 1, keys: ['geL'], name: 'Трубопроводы ГЕ-1 JNG50, JNG60 в напорную камеру' },
    { a: 5, b: 1, keys: ['geR'], name: 'Трубопроводы ГЕ-1 JNG70, JNG80 в напорную камеру' },
    { a: 2, la: 'ПГ-1', b: 'турбине', keys: ['steam'], name: 'Паропровод свежего пара' },
    { a: 'ПЭН', b: 2, lb: 'ПГ-1', keys: ['feedMain'], name: 'Питательная вода' },
    { a: 2, la: 'ПГ-2', b: 30, keys: ['spotSteam'], name: 'Пар СПОТ ПГ' },
    { a: 30, b: 2, lb: 'ПГ-2', keys: ['spotCond'], name: 'Конденсат СПОТ ПГ (самотёком)' },
    { a: 30, b: 29, keys: ['spotSteam', 'spotCond'], name: 'Теплопередача от трубчатки ТО СПОТ ПГ к воде бака БАОТ', both: true },
    { a: 28, b: 29, keys: ['spotGo'], name: 'Контур естественной циркуляции СПОТ ГО', both: true },
    { a: 26, b: 27, keys: ['af1'], name: 'Всас аварийного питательного насоса' },
    { a: 27, b: 2, lb: 'ПГ-2', keys: ['af2'], name: 'Аварийная питательная вода' },
    { a: 9, b: 17, keys: ['sprinkler'], name: 'Напорный трубопровод спринклерной системы' },
    { a: 15, b: 16, keys: ['chem1'], name: 'Всас насоса химреагентов' },
    { a: 16, b: 9, keys: ['chem2'], name: 'Дозирование химреагентов в напор спринклерного насоса' },
    { a: 21, b: 9, keys: ['alkali', 'suct9'], name: 'Подача щёлочи во всас спринклерного насоса' },
    { a: 13, b: 14, keys: ['boron1'], name: 'Всас насоса аварийного ввода бора' },
    { a: 14, b: 1, keys: ['boron2', 'cold1b'], name: 'Аварийный ввод бора (в холодную нитку петли 1)' },
    { a: 11, b: 1, keys: ['eccsMain', 'cold4b'], name: 'САОЗ НД, каналы 1, 3 (в холодную нитку)' },
    { a: 11, b: 1, keys: ['eccsMain', 'eccsGe', 'geR'], name: 'САОЗ НД, каналы 2, 4 (через линии ГЕ в напорную камеру)' },
    { a: 12, b: 1, keys: ['eccs12', 'eccsMain', 'cold4b'], name: 'САОЗ ВД, каналы 1, 3 (в холодную нитку)' },
    { a: 12, b: 1, keys: ['eccs12', 'eccsMain', 'eccsGe', 'geR'], name: 'САОЗ ВД, каналы 2, 4 (через линии ГЕ в напорную камеру)' },
    { a: 22, b: 8, keys: ['sump1'], name: 'Слив теплоносителя через приямок ГО в бак запаса НК' },
    { a: 8, b: 10, keys: ['sump1'], name: 'Забор борированной воды из бака-приямка на ТО расхолаживания' },
    { a: 22, b: 10, keys: ['sump1'], name: 'Забор воды из приямка ГО на рециркуляцию' },
    { a: 10, b: 9, keys: ['sumpHeader', 'suct9'], name: 'Всас спринклерного насоса (после ТО расхолаживания)' },
    { a: 10, b: 11, keys: ['sumpHeader', 'suct11'], name: 'Всас насоса САОЗ НД (после ТО расхолаживания)' },
    { a: 10, b: 12, keys: ['sumpHeader', 'suct12'], name: 'Всас насоса САОЗ ВД (после ТО расхолаживания)' },
    { a: 7, la: 'Кольцевой зазор НЗО', b: 23, keys: ['vent1'], name: 'Отсос воздуха из кольцевого зазора' },
    { a: 23, b: 24, keys: ['vent2'], name: 'Подача воздуха на фильтровальную установку' },
    { a: 24, b: 25, keys: ['vent3'], name: 'Выброс очищенного воздуха в венттрубу' }
  ];

  const nodeName = (x) => (typeof x === 'number' ? SHORT[x] : x);
  const endA = (e) => e.la || nodeName(e.a);
  const endB = (e) => e.lb || nodeName(e.b);
  const edgesOf = (n) => EDGES.filter((e) => e.a === n || e.b === n);

  function connectionsOf(n) {
    const inp = [];
    const out = [];
    const both = [];
    edgesOf(n).forEach((e) => {
      if (e.both) {
        both.push(`${e.name} (с: ${e.a === n ? endB(e) : endA(e)})`);
      } else if (e.b === n) inp.push(`${e.name} (от: ${endA(e)})`);
      else out.push(`${e.name} (к: ${endB(e)})`);
    });
    return { inp, out, both };
  }

  // Направленный цикл среди выбранных позиций (замкнутый контур циркуляции)
  function findLoop(sel) {
    const adj = new Map();
    EDGES.forEach((e) => {
      if (!e.loop || !sel.has(e.a) || !sel.has(e.b)) return;
      if (!adj.has(e.a)) adj.set(e.a, new Set());
      adj.get(e.a).add(e.b);
    });
    for (const start of adj.keys()) {
      const stack = [[start, [start]]];
      while (stack.length) {
        const [v, path] = stack.pop();
        for (const w of adj.get(v) || []) {
          if (w === start && path.length > 1) return [...path, start];
          if (!path.includes(w)) stack.push([w, [...path, w]]);
        }
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // 4б. ПАРАМЕТРЫ: строки [параметр (обозначение), значение, единица]
  //     Читаются из sim на каждом обновлении (200 мс)
  // --------------------------------------------------------------------------
  const NOM = {
    POWER_MW: 3200,
    VOL_FLOW_M3_H: 88000,     // расход через реактор при работе 4 ГЦН (Поваров и др. 2025, табл. 2.3)
    MASS_FLOW_T_H: 64500,     // оценка: 88 000 м³/ч × ρ ≈ 0,733 т/м³ (16,2 МПа, 298,6 °C)
    SG_STEAM_T_H: 1602,       // паропроизводительность одного ПГВ-1000МКП (razdel-9, табл. 9.1.4)
    RCP_DP_MPA: 0.624,        // напор ГЦНА-1391 0,624 ± 0,025 МПа (razdel-9, табл. 9.1.5)
    SG_LEVEL_M: 2.70,         // номинальный уровень ПГ 2,70 ± 0,05 м (razdel-2, табл. 2.1.1)
    GE_VOLUME_M3: 240         // 4 × 60 м³
  };
  const fx = (v, d = 1) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—');
  const int = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v).toLocaleString('ru-RU') : '—');
  const avgFlow = () => [0, 1, 2, 3].reduce((a, i) => a + Math.max(0, loopOf(i).flowPct || 0), 0) / 400;
  const sgSteam = (i) => {
    const l = loopOf(i);
    const dT = Math.max(0, (l.tHot || 0) - (l.tCold || 0));
    return NOM.SG_STEAM_T_H * Math.max(0, l.flowPct || 0) / 100 * dT / 31.1;
  };
  const rcpDp = (i) => NOM.RCP_DP_MPA * Math.pow(Math.max(0, loopOf(i).rpm || 0) / 1000, 2);
  const tsat = (p) => (typeof window.calcSaturationTempC === 'function' ? window.calcSaturationTempC(p) : NaN);
  const spotMW = () => {
    const s = S();
    return s.spotActive ? 145 * Math.max(0.2, ((s.steamTempC || 0) - 100) / 185.8) : 0;
  };
  const pumpMode = (i) => {
    const l = loopOf(i);
    if (l.pumpOn) return 'работа';
    return l.rpm > 50 ? 'выбег' : 'откл.';
  };
  const p1Row = () => ['Давление 1-го контура (P1)', fx(S().primaryPressureMPa, 2), 'МПа'];
  const p2Row = () => ['Давление свежего пара (P2)', fx(S().steamHeaderPressMPa, 2), 'МПа'];
  const spotRow = () => ['Отвод тепла СПОТ (Nспот), оценка модели', fx(spotMW(), 1), 'МВт'];

  const PARAMS = {
    1: () => {
      const s = S();
      const f = avgFlow();
      return [
        ['Тепловая мощность (Nтепл)', fx(s.thermalPowerMW, 1), `МВт (${fx(s.thermalPowerMW / NOM.POWER_MW * 100, 1)} %)`],
        ['Температура входа (Tвх)', fx(s.coreInletTempC, 1), '°C'],
        ['Температура выхода (Tвых)', fx(s.coreOutletTempC, 1), '°C'],
        ['Подогрев в АЗ (ΔT)', fx(s.coreOutletTempC - s.coreInletTempC, 1), '°C'],
        ['Объёмный расход при Tвх (G1к)', int(NOM.VOL_FLOW_M3_H * f), 'м³/ч'],
        ['Массовый расход, оценка', int(NOM.MASS_FLOW_T_H * f), 'т/ч'],
        ['Рабочая группа №12 (Hгр12)', fx(s.group10Pos, 1), '% от низа АЗ'],
        ['Реактивность (ρ)', (s.rhoTotal >= 0 ? '+' : '') + fx(s.rhoTotal, 1), 'pcm'],
        ['Неравномерность (Kq макс)', fx(s.kqMax, 2), '']
      ];
    },
    2: () => {
      const s = S();
      const a = loopOf(0);
      const b = loopOf(1);
      return [
        p2Row(),
        ['Температура насыщения (Ts2)', fx(s.steamTempC, 1), '°C'],
        ['Паропроизводительность ПГ-1 (D)', int(sgSteam(0)), 'т/ч (номинал 1 602)'],
        ['Паропроизводительность ПГ-2 (D)', int(sgSteam(1)), 'т/ч'],
        ['Уровень воды ПГ-1 (Hпг)', fx(a.sgLevelM, 2), 'м (номинал 2,70)'],
        ['Уровень воды ПГ-2 (Hпг)', fx(b.sgLevelM, 2), 'м'],
        ['Tгор / Tхол петли 1', `${fx(a.tHot, 1)} / ${fx(a.tCold, 1)}`, '°C'],
        ['Производительность ПЭН (Gпв)', fx(s.feedwaterFlowPct, 0), '%']
      ];
    },
    3: () => [
      ['Частота вращения ГЦНА-1 (n)', int(loopOf(0).rpm), 'об/мин'],
      ['Частота вращения ГЦНА-2 (n)', int(loopOf(1).rpm), 'об/мин'],
      ['Напор ГЦНА-1 (ΔPгцна)', fx(rcpDp(0), 3), 'МПа'],
      ['Напор ГЦНА-2 (ΔPгцна)', fx(rcpDp(1), 3), 'МПа'],
      ['Подача одного ГЦНА (номинал)', '22 600', 'м³/ч'],
      ['Расход петли 1 (Gп)', int(NOM.MASS_FLOW_T_H / 4 * loopOf(0).flowPct / 100), 'т/ч'],
      ['Расход петли 2 (Gп)', int(NOM.MASS_FLOW_T_H / 4 * loopOf(1).flowPct / 100), 'т/ч'],
      ['Режим ГЦНА-1 / ГЦНА-2', `${pumpMode(0)} / ${pumpMode(1)}`, '']
    ],
    4: () => {
      const s = S();
      return [
        p1Row(),
        ['Уровень в КД (Hкд)', fx(s.pressurizerLevelM, 2), 'м (номинал 8,17)'],
        ['Полный объём / объём воды (Vкд)', '79 / 55', 'м³'],
        ['Температура насыщения (Ts1)', fx(tsat(s.primaryPressureMPa), 1), '°C'],
        ['Запас до кипения (ΔTs)', fx(s.subcoolingMarginC, 1), '°C'],
        ['Мощность ТЭН (Nтэн)', int(s.heatersPowerKW), `кВт, ${s.heatersMode === 'AUTO' ? 'авто' : s.heatersMode === 'ON' ? 'вкл.' : 'откл.'}`],
        ['Впрыск / ИПУ КД', `${s.sprayActive ? 'откр.' : 'закр.'} / ${s.ipuKdOpen ? 'откр.' : 'закр.'}`, '']
      ];
    },
    5: () => {
      const s = S();
      return [
        ['Запас борированной воды (Vге)', int(NOM.GE_VOLUME_M3 * (s.saozWaterPct || 0) / 100), 'м³ из 240'],
        ['Давление азота (PN₂)', fx(s.gePressMPa || 5.9, 2), 'МПа (исходное 5,9)'],
        ['Концентрация H₃BO₃ / температура', '≥ 16 / ≥ 20', 'г/кг / °C'],
        ['Число / объём ёмкостей', '4 × 60', 'м³ (4 × 50 %)'],
        p1Row()
      ];
    },
    6: () => [
      ['Конструкция барьера', 'Преднапряжённый ж/б', 'с тросовыми армоканатами'],
      ['Герметичная стальная облицовка (δобл)', '6', 'мм (углеродистая сталь)'],
      ['Давление в ГО (Pго)', fx(S().containmentPressMPa, 3), 'МПа (абс.)'],
      ['Температура среды ГО (Tго)', fx(S().containmentTempC, 1), '°C'],
      ['Свободный объём (Vго)', '64 166', 'м³ ([ARIS])'],
      ['Режим гермообъёма', isLoca() ? 'локализация аварии' : 'штатная герметичность', '']
    ],
    7: () => [
      ['Конструкция барьера', 'Монолитный ж/б', 'защита от внешних воздействий'],
      ['Ширина кольцевого зазора (bзаз)', '1.8', 'м (между ВЗО и НЗО)'],
      ['Давление в кольцевом зазоре (ΔPзаз)', 'разрежение', 'отсос на вентсистему'],
      ['Назначение', 'внешняя защита и сбор протечек', '']
    ],
    8: () => [
      ['Объём баков-приямков (Vбз)', '2 × 1000', 'м³'],
      ['Концентрация H₃BO₃ (Cб)', '≥ 16', 'г/кг'],
      ['Давление в баке', 'атмосферное', 'внутри ВЗО'],
      ['Режим работы', isLoca() ? 'рециркуляция' : 'хранение запаса', '']
    ],
    9: () => [
      ['Конфигурация каналов', '4 × 50', '% (4 независимых канала)'],
      ['Рабочая среда', 'H₃BO₃ + N₂H₄ / NaOH', 'охлаждённый раствор'],
      ['Назначение подачи', 'коллектор под куполом ВЗО', 'конденсация пара и связывание I₂'],
      ['Режим насосов', S().sprinklerActive ? 'в работе' : 'резерв', 'запуск при Pго > 0,13 МПа (◇)'],
      ['Давление в ГО (Pго)', fx(S().containmentPressMPa, 3), 'МПа (абс.)']
    ],
    10: () => [
      ['Обозначение и канальность', '4 канала', 'KKS JNB10…40'],
      ['Тип теплообменника', 'кожухотрубный', 'аварийного расхолаживания'],
      ['Охлаждающая среда', 'промконтур / техвода', 'ответственных потребителей'],
      ['Режим работы', S().eccsPumpsRunning ? 'теплоотвод рециркуляции' : 'резерв', '']
    ],
    11: () => [
      ['Подача насоса (Qнд)', '750', 'м³/ч'],
      ['Напор (Hнд)', '150', 'м вод. ст. (1,47 МПа)'],
      ['Подача в 1-й контур при P₁', '< 2,45', 'МПа'],
      p1Row(),
      ['Подача в 1-й контур (Gнд)', kgs(S().lpFlowKgS), 'м³/ч']
    ],
    12: () => [
      ['Подача насоса (Qвд)', '150', 'м³/ч'],
      ['Напор (Hвд)', '650', 'м вод. ст. (6,37 МПа)'],
      ['Подача в 1-й контур при P₁', '< 7,9', 'МПа'],
      p1Row(),
      ['Подача в 1-й контур (Gвд)', kgs(S().hpFlowKgS), 'м³/ч']
    ],
    13: () => [
      ['Объём баков запаса бора (Vбвк)', '2 × 150', 'м³ (1 бак на 2 канала)'],
      ['Концентрация H₃BO₃ в баках (Cбвк)', '40', 'г/кг'],
      ['Текущий бор в 1-м контуре (Cб)', fx(S().boronConc, 2), 'г/кг']
    ],
    14: () => [
      ['Подача насоса (Qбор)', '14.5', 'м³/ч'],
      ['Напор (Hбор)', '2500', 'м вод. ст. (≈ 24,5 МПа)'],
      ['Бор в 1-м контуре (Cб)', fx(S().boronConc, 2), 'г/кг'],
      ['Режим водообмена', S().boronMode === 1 ? 'ввод бора' : S().boronMode === -1 ? 'дистиллят' : 'нейтральный', '']
    ],
    15: () => [
      ['Объём баков реагентов (Vхим)', '2 × 15', 'м³'],
      ['Рабочий реагент', 'N₂H₄ / NaOH', 'связывание летучего йода'],
      ['Потребитель', 'спринклерная система', 'дозирование через насосы поз. 16']
    ],
    16: () => [
      ['Конфигурация каналов', '4 канала', 'насосы-дозаторы'],
      ['Линия подачи', 'напор спринклера', 'из баков химреагентов поз. 15'],
      ['Режим работы', S().sprinklerActive ? 'в работе' : 'резерв', 'синхронно со спринклером']
    ],
    17: () => [
      ['Конструкция', '4 кольцевых коллектора', 'с центробежными форсунками'],
      ['Размещение', 'под куполом ВЗО', 'верхняя зона гермообъёма'],
      ['Функция при аварии', 'конденсация пара', 'снижение P и вымывание аэрозолей'],
      ['Состояние тракта', S().sprinklerActive ? 'заполнен, распыление' : 'сухой', 'подача от поз. 9']
    ],
    18: () => [
      ['Тип устройств', 'каталитические ПАР', 'беспламенное окисление H₂ + O₂'],
      ['Принцип действия', 'пассивный', 'естественная конвекция без питания'],
      ['Порог старта реакции', '≥ 1.5…2.0', '% об. H₂ в атмосфере ГО'],
      ['Режим ПАР', S().ulrCoolingActive || (isLoca() && S().saozWaterPct <= 0) ? 'рекомбинация водорода' : 'пассивная готовность', '']
    ],
    19: () => [
      ['Клапаны ИПУ КД (ИПУ)', S().ipuKdOpen ? 'открыт' : 'закрыт', '3 шт. на КД'],
      ['Среда в барботере', 'охлаждённая вода', 'конденсация сбрасываемого пара'],
      p1Row()
    ],
    20: () => [
      ['Подача воды в УЛР (Gулр)', S().ulrCoolingActive ? 'включена' : 'отключена', ''],
      ['Уставка открытия подачи воды', '400', '°C в подреакторном пространстве'],
      ['Расход охлаждающей воды', '≈ 3', 'кг/с (из шахты ревизии ВКУ)'],
      ['Жертвенный материал', 'оксидный / стальной', 'разбавление кориума и подкритичность']
    ],
    21: () => [
      ['Объём бака щёлочи (Vщ)', '15', 'м³'],
      ['Состав раствора', '42 % NaOH', 'гидроксид натрия'],
      ['Подача насоса дозирования (Qщ)', '30', 'м³/ч (при дозе в ГО ≥ 100 Гр/ч)'],
      ['Режим', 'резерв', 'подача во всас спринклера']
    ],
    22: () => [
      ['Размещение', 'нижняя отметка ВЗО', 'водосборный коллектор'],
      ['Защита насосов', 'кассетные сетки', 'удержание теплоизоляции и дебриса'],
      ['Состояние приямка', isLoca() ? 'приём течи и рециркуляция' : 'сухой (норма)', '']
    ],
    23: () => [
      ['Конфигурация системы', 'вытяжная аварийная', 'отсос из кольцевого зазора'],
      ['Назначение', 'поддержание разрежения', 'исключение неорганизованных утечек'],
      ['Режим вентустановки', isLoca() ? 'в работе' : 'резерв', '']
    ],
    24: () => [
      ['Ступень I очистки', 'аэрозольные фильтры', 'высокоэффективная тонкая очистка'],
      ['Ступень II очистки', 'сорбционные угольные', 'улавливание молекулярного и органического I₂'],
      ['Эффективность очистки', '≥ 99.9 / 99', '% (аэрозоли / радиоактивный йод)'],
      ['Режим фильтра', isLoca() ? 'фильтрация потока' : 'резерв', '']
    ],
    25: () => [
      ['Назначение сооружения', 'высотное рассеивание', 'отвод очищенного воздуха РО'],
      ['Контроль на выходе', 'радиационный мониторинг', 'аэрозоли, йод, ИРГ'],
      ['Состояние тракта', 'открыт', 'пассивный конструктив']
    ],
    26: () => [
      ['Объём баков запаса (Vобв)', '4 × 700', 'м³ (по 1 баку на канал АПЭН)'],
      ['Рабочая среда', 'обессоленная вода', 'чистый конденсат 2-го контура'],
      ['Потребитель', 'насосы АПЭН (поз. 27)', 'аварийная подпитка ПГ-1…4']
    ],
    27: () => [
      ['Подача насоса (Qапэн)', '150', 'м³/ч (4 канала)'],
      ['Напор (Hапэн)', '900', 'м вод. ст.'],
      ['Уровень ПГ-1 / ПГ-2 (Hпг)', `${fx(loopOf(0).sgLevelM, 2)} / ${fx(loopOf(1).sgLevelM, 2)}`, 'м (номинал 2,70)']
    ],
    28: () => [
      ['Теплообменники-конденсаторы (Fспот.го)', '16 × 75', 'м² (4 канала × 4 шт.)'],
      ['Тип циркуляции контура', 'естественная', 'двухфазная (конденсатор ↔ БАОТ)'],
      ['Отвод тепла из ГО (Nспот.го), оценка модели', fx(S().spotGoHeatMW, 1), 'МВт'],
      ['Температура среды ГО (Tго)', fx(S().containmentTempC, 1), '°C']
    ],
    29: () => [
      ['Баки аварийного отвода тепла (Vбаот)', '4 × 538', 'м³'],
      ['Отметка размещения', 'выше +59,850', 'м (кольцевая галерея на НЗО)'],
      ['Автономность без подпитки (tавт)', '≥ 24', 'ч кипения при проектном теплоотводе'],
      spotRow()
    ],
    30: () => [
      ['Теплообменники расхолаживания (Fспот.пг)', '72 × 12', 'м² (4 канала × 18 шт.)'],
      spotRow(),
      p2Row()
    ]
  };

  function paramsOf(it) {
    const fn = PARAMS[it.n];
    return fn ? fn() : [['Состояние', it.state().text, '']];
  }

  // Плашка состояния в шапке карточки
  const PILL_LABEL = { ok: 'НОРМА', idle: 'РЕЗЕРВ', struct: 'КОНСТРУКТИВ', warn: 'ВНИМАНИЕ', danger: 'АВАРИЯ', active: 'В РАБОТЕ' };
  function pillOf(it) {
    const s = S();
    const st = it.state();
    if (it.n === 1) {
      if (s.az1Tripped) return { level: 'danger', text: 'АЗ-1' };
      if ((s.thermalPowerMW || 0) < 32) return { level: 'idle', text: 'ПОДКРИТИЧЕН' };
      return { level: 'ok', text: `РАБОТА ${Math.round(s.thermalPowerMW / NOM.POWER_MW * 100)}%` };
    }
    if (it.n === 3 && st.level === 'ok') return { level: 'ok', text: 'РАБОТА' };
    if (it.n === 5 && st.level === 'ok') return { level: 'ok', text: 'ГОТОВНОСТЬ' };
    return { level: st.level, text: PILL_LABEL[st.level] || 'НОРМА' };
  }

  // --------------------------------------------------------------------------
  // 5. DOM: схема (строка состояния + выезжающая карточка) и реестр справа
  // --------------------------------------------------------------------------
  let root, stage, sceneG, panel, listEl, tooltip, searchEl;
  let statusEl, flyoutEl, selChipEl, drawerOpenBtn;
  const selected = new Set();
  let activeN = null;          // позиция, показанная в строке состояния и карточке
  let flyoutOpen = false;
  let traceMode = false;
  let hoverN = null;
  const activeGroups = new Set(GROUPS.map((g) => g.id));

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // Элементы интерфейса поверх холста не должны запускать перетаскивание и зум
  const stopCanvas = (node) => ['mousedown', 'click', 'wheel', 'mousemove'].forEach((ev) =>
    node.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'wheel' }));

  function build() {
    const container = document.getElementById('canvasContainer');
    if (!container) return false;

    root = el('div', 'ctn-root');
    root.id = 'containmentView';
    root.setAttribute('aria-label', 'Разрез гермооболочки В-491');

    stage = el('div', 'ctn-stage', buildSvg());
    tooltip = el('div', 'ctn-tooltip');
    stage.appendChild(tooltip);

    // Плавающие элементы в правом верхнем углу схемы
    const corner = el('div', 'ctn-corner');
    selChipEl = el('div', 'ctn-selchip', '<span class="ctn-selchip-text"></span><button type="button" class="ctn-selchip-reset">Сбросить</button>');
    selChipEl.hidden = true;
    selChipEl.querySelector('.ctn-selchip-reset').addEventListener('click', clearSelection);
    drawerOpenBtn = el('button', 'ctn-drawer-open', `☰ Реестр оборудования (${ITEMS.length})`);
    drawerOpenBtn.type = 'button';
    drawerOpenBtn.hidden = true;
    drawerOpenBtn.addEventListener('click', () => setDrawer(true));
    corner.appendChild(selChipEl);
    corner.appendChild(drawerOpenBtn);
    stage.appendChild(corner);

    // Строка состояния выбранной позиции (внизу схемы)
    statusEl = el('div', 'ctn-status');
    statusEl.hidden = true;
    stage.appendChild(statusEl);

    // Выезжающая карточка «Параметры и связи»
    flyoutEl = el('aside', 'ctn-flyout');
    flyoutEl.setAttribute('aria-label', 'Параметры и связи');
    stage.appendChild(flyoutEl);

    [corner, statusEl, flyoutEl].forEach(stopCanvas);

    // Реестр: шапка, поиск, чипы, список с флажками
    panel = el('aside', 'ctn-panel');
    panel.innerHTML = `
      <div class="ctn-panel-inner">
        <div class="ctn-panel-head">
          <div class="ctn-panel-top">
            <div>
              <div class="ctn-panel-title">Реестр оборудования</div>
              <div class="ctn-panel-sub">Позиции по рис. 2.33 • РУ В-491, ЛАЭС-2</div>
            </div>
            <button type="button" class="ctn-collapse" aria-label="Свернуть реестр">⮞ Свернуть</button>
          </div>
          <input class="ctn-search" type="search" placeholder="Поиск: номер или название" aria-label="Поиск оборудования">
          <div class="ctn-chips"></div>
        </div>
        <div class="ctn-list" role="list"></div>
      </div>`;
    searchEl = panel.querySelector('.ctn-search');
    listEl = panel.querySelector('.ctn-list');
    panel.querySelector('.ctn-collapse').addEventListener('click', () => setDrawer(false));

    // Чипы систем: первый клик изолирует систему, дальнейшие добавляют/убирают системы
    const chips = panel.querySelector('.ctn-chips');
    GROUPS.forEach((g) => {
      const b = el('button', 'ctn-chip on', `<i style="background:${g.color}"></i>${g.title}`);
      b.type = 'button';
      b.dataset.group = g.id;
      b.addEventListener('click', () => {
        if (activeGroups.has(g.id) && activeGroups.size === GROUPS.length) {
          activeGroups.clear();
          activeGroups.add(g.id);
        } else if (activeGroups.has(g.id)) {
          activeGroups.delete(g.id);
          if (activeGroups.size === 0) GROUPS.forEach((x) => activeGroups.add(x.id));
        } else {
          activeGroups.add(g.id);
        }
        chips.querySelectorAll('.ctn-chip').forEach((c) => c.classList.toggle('on', activeGroups.has(c.dataset.group)));
        renderList();
        applyHighlight();
      });
      chips.appendChild(b);
    });

    searchEl.addEventListener('input', () => { renderList(); applyHighlight(); });

    root.appendChild(stage);
    root.appendChild(panel);
    container.appendChild(root);
    sceneG = stage.querySelector('#ctnScene');
    stopCanvas(panel);

    // Наведение и выбор на схеме
    const svg = stage.querySelector('svg');
    svg.addEventListener('mousemove', (e) => {
      const node = e.target.closest('[data-n]');
      const n = node ? +node.dataset.n : null;
      if (n !== hoverN) {
        hoverN = n;
        applyHighlight();
      }
      if (n) showTooltip(n, e); else tooltip.style.display = 'none';
    });
    svg.addEventListener('mouseleave', () => { hoverN = null; tooltip.style.display = 'none'; applyHighlight(); });
    svg.addEventListener('click', (e) => {
      const cam = window.canvasCam;
      if (cam && cam.movedDuringDrag) return;
      const node = e.target.closest('[data-n]');
      pick(node ? +node.dataset.n : null, e, true);
    });

    renderList();
    renderSelection();
    return true;
  }

  function setDrawer(open) {
    root.classList.toggle('is-collapsed', !open);
    drawerOpenBtn.hidden = open;
    tooltip.style.display = 'none';
  }

  function matches(it) {
    if (!activeGroups.has(it.group)) return false;
    const q = (searchEl.value || '').trim().toLowerCase();
    if (!q) return true;
    return String(it.n) === q || it.name.toLowerCase().includes(q) || it.code.toLowerCase().includes(q);
  }

  function renderList() {
    listEl.innerHTML = '';
    let shown = 0;
    GROUPS.forEach((g) => {
      const items = ITEMS.filter((it) => it.group === g.id && matches(it));
      if (!items.length) return;
      listEl.appendChild(el('div', 'ctn-group-title', `<i style="background:${g.color}"></i>${g.title}<span>${items.length}</span>`));
      items.forEach((it) => {
        const row = el('div', 'ctn-row', `
          <label class="ctn-check" title="Добавить в выбор"><input type="checkbox" aria-label="Выбрать: ${it.name}"></label>
          <span class="ctn-row-num">${it.n}</span>
          <span class="ctn-row-text"><b>${it.name}</b><small>${it.code}</small></span>
          <span class="ctn-dot" data-state="ok"></span>`);
        row.dataset.n = it.n;
        row.setAttribute('role', 'listitem');
        row.tabIndex = 0;
        const cb = row.querySelector('input');
        cb.checked = selected.has(it.n);
        cb.addEventListener('change', () => toggle(it.n, cb.checked));
        row.querySelector('.ctn-check').addEventListener('click', (e) => e.stopPropagation());
        row.addEventListener('click', (e) => pick(it.n, e, false));
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(it.n, e, false); }
        });
        row.addEventListener('mouseenter', () => { hoverN = it.n; applyHighlight(); });
        row.addEventListener('mouseleave', () => { hoverN = null; applyHighlight(); });
        listEl.appendChild(row);
        shown++;
      });
    });
    if (!shown) listEl.appendChild(el('div', 'ctn-empty', 'Ничего не найдено'));
    applyHighlight();
    refreshStates();
  }

  // Флажок: добавить/убрать позицию, не трогая остальной выбор
  function toggle(n, on) {
    if (on) { selected.add(n); activeN = n; } else selected.delete(n);
    afterSelectionChange();
  }

  // Клик по узлу или строке — одна позиция (Ctrl/Cmd/Shift — добавить/убрать, как флажок)
  function pick(n, e, fromScheme) {
    const additive = e && (e.ctrlKey || e.metaKey || e.shiftKey);
    if (n == null) {
      if (!additive) selected.clear();
    } else if (additive) {
      if (selected.has(n)) selected.delete(n); else { selected.add(n); activeN = n; }
    } else if (selected.size === 1 && selected.has(n)) {
      selected.clear();
    } else {
      selected.clear();
      selected.add(n);
      activeN = n;
    }
    afterSelectionChange();
    if (n != null && fromScheme && selected.has(n)) {
      const row = listEl.querySelector(`.ctn-row[data-n="${n}"]`);
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function clearSelection() {
    selected.clear();
    afterSelectionChange();
  }

  function afterSelectionChange() {
    if (!selected.has(activeN)) activeN = selected.size ? [...selected][selected.size - 1] : null;
    if (!selected.size) flyoutOpen = false;
    listEl.querySelectorAll('.ctn-row').forEach((row) => {
      const cb = row.querySelector('input');
      if (cb) cb.checked = selected.has(+row.dataset.n);
    });
    applyHighlight();
    renderSelection();
  }

  // ---------- Строка состояния, чип выбора и карточка ----------
  const SYMBOL_MAP = {
    'Клапаны ИПУ КД (ИПУ)': 'ИПУ',
    'ИПУ КД (3 шт.)': 'ИПУ',
    'Число / объём ёмкостей': 'ГЕ-1',
    'Конструкция барьера': 'Тип',
    'Конфигурация каналов': 'Каналы',
    'Рабочая среда': 'Среда',
    'Обозначение и канальность': 'KKS',
    'Тип теплообменника': 'Тип ТО',
    'Конструкция': 'Коллектор',
    'Размещение': 'Зона',
    'Тип устройств': 'Тип',
    'Принцип действия': 'Принцип',
    'Среда в барботере': 'Среда',
    'Уставка открытия подачи воды': 'Tуст',
    'Состав раствора': 'Раствор',
    'Защита насосов': 'Фильтры',
    'Конфигурация системы': 'Тип',
    'Назначение': 'Функция',
    'Ступень I очистки': 'I ступ.',
    'Ступень II очистки': 'II ступ.',
    'Назначение сооружения': 'Функция',
    'Контроль на выходе': 'Контроль',
    'Потребитель': 'Потребитель',
    'Тип циркуляции контура': 'Циркуляция',
    'Отметка размещения': 'Отметка'
  };
  const symbolOf = (label) => {
    if (SYMBOL_MAP[label]) return SYMBOL_MAP[label];
    const m = label.match(/\(([^()]+)\)/);
    if (m && !/шт|номинал|оценка|абс|поз/i.test(m[1])) return m[1];
    return label;
  };
  const STATUS_ROWS = { 1: [0, 2], 2: [0, 4], 3: [0, 2], 4: [0, 1], 5: [0, 3], 6: [1, 2], 7: [1, 2], 19: [0, 2], 21: [0, 2], 27: [0, 2], 28: [0, 2], 29: [0, 3], 30: [0, 1] };

  const UNIT_HEAD_RE = /^(МВт|МПа|кВт|°C|м³\/ч|т\/ч|об\/мин|м вод\. ст\.|м³ из 240|м³|м²|мм|м(?=\s|$)|г\/кг\s*\/\s*°C|г\/кг|кг\/с|ч(?=\s|$)|% об\. H₂|%|\bpcm\b)/;
  function statusParams(it) {
    const rows = paramsOf(it);
    const idx = STATUS_ROWS[it.n] || [0, 1];
    return idx.filter((i) => rows[i]).map((i) => {
      const [k, v, u] = rows[i];
      const cleanU = (u || '').replace(/\s*\(.*\)$/, '').trim();
      const um = cleanU.match(UNIT_HEAD_RE);
      return [symbolOf(k), v, um ? um[1] : ''];
    });
  }

  function renderSelection() {
    // Чип «Выбрано: N»
    selChipEl.hidden = selected.size < 2;
    selChipEl.querySelector('.ctn-selchip-text').textContent = `Выбрано: ${selected.size}`;

    // Строка состояния
    if (activeN == null) {
      statusEl.hidden = true;
      statusEl.innerHTML = '';
    } else {
      const it = ITEM_BY_N.get(activeN);
      const list = [...selected];
      const switcher = list.length > 1
        ? `<div class="ctn-st-tabs" role="tablist">${list.map((n) =>
          `<button type="button" role="tab" class="ctn-st-tab${n === activeN ? ' on' : ''}" data-tab="${n}" aria-selected="${n === activeN}" title="${ITEM_BY_N.get(n).name}">${n}</button>`).join('')}</div>`
        : '';
      statusEl.hidden = false;
      statusEl.innerHTML = `
        ${switcher}
        <span class="ctn-row-num">${it.n}</span>
        <b class="ctn-st-name">${it.name}</b>
        <span class="ctn-pill" data-st-pill></span>
        <span class="ctn-st-params">${statusParams(it).map((p, i) =>
          `<span class="ctn-st-param"><span class="ctn-st-sym">${p[0]}:</span> <span class="ctn-val" data-sv="${i}"></span> <span class="ctn-unit">${p[2]}</span></span>`).join('')}</span>
        <span class="ctn-st-actions">
          <button type="button" class="ctn-st-btn ctn-st-more${flyoutOpen ? ' on' : ''}" aria-expanded="${flyoutOpen}">⚙ Параметры и связи ${flyoutOpen ? '▴' : '▾'}</button>
          <button type="button" class="ctn-st-btn ctn-st-close" aria-label="Снять выбор" title="Снять выбор">✕</button>
        </span>`;
      statusEl.querySelectorAll('.ctn-st-tab').forEach((b) => b.addEventListener('click', () => {
        activeN = +b.dataset.tab;
        applyHighlight();
        renderSelection();
      }));
      statusEl.querySelector('.ctn-st-more').addEventListener('click', () => {
        flyoutOpen = !flyoutOpen;
        renderSelection();
      });
      statusEl.querySelector('.ctn-st-close').addEventListener('click', () => {
        if (selected.size > 1) toggle(activeN, false); else clearSelection();
      });
    }

    // Карточка «Параметры и связи»
    flyoutEl.classList.toggle('open', flyoutOpen && activeN != null);
    if (flyoutOpen && activeN != null) {
      flyoutEl.innerHTML = cardHtml(ITEM_BY_N.get(activeN)) + (selected.size > 1 ? summaryHtml() : '');
      flyoutEl.querySelector('.ctn-fly-close').addEventListener('click', () => {
        flyoutOpen = false;
        renderSelection();
      });
      const traceBtn = flyoutEl.querySelector('.ctn-trace-btn');
      if (traceBtn && !traceBtn.disabled) {
        traceBtn.addEventListener('click', (e) => {
          traceMode = !traceMode;
          e.currentTarget.classList.toggle('on', traceMode);
          e.currentTarget.setAttribute('aria-pressed', String(traceMode));
          applyHighlight();
        });
      }
    } else {
      flyoutEl.innerHTML = '';
    }
    refreshStates();
  }

  function cardHtml(it) {
    const conn = connectionsOf(it.n);
    const hasConn = !!(conn.inp.length || conn.out.length || conn.both.length);
    const connHtml = hasConn
      ? `<ul class="ctn-conn-list">
          ${conn.inp.map((t) => `<li><b>Вход:</b> ${t}</li>`).join('')}
          ${conn.out.map((t) => `<li><b>Выход:</b> ${t}</li>`).join('')}
          ${conn.both.map((t) => `<li><b>Связь:</b> ${t}</li>`).join('')}
        </ul>`
      : '<p class="ctn-conn-none">Трубопроводных связей нет (пассивный конструктив)</p>';
    return `
      <div class="ctn-card" data-card="${it.n}">
        <div class="ctn-card-head">
          <span class="ctn-row-num big">${it.n}</span>
          <div class="ctn-card-title">
            <div class="ctn-detail-name">${it.name}</div>
            <div class="ctn-card-meta"><span class="ctn-pill" data-fly-pill></span><span class="ctn-detail-code">${it.code}</span></div>
          </div>
          <button type="button" class="ctn-close ctn-fly-close" aria-label="Закрыть карточку" title="Закрыть карточку">✕</button>
        </div>
        <table class="ctn-table">
          <thead><tr><th>Параметр</th><th>Значение</th></tr></thead>
          <tbody>${paramsOf(it).map(([k], i) => `<tr><td>${k}</td><td><span class="ctn-val" data-pv="${i}"></span> <span class="ctn-unit" data-pu="${i}"></span></td></tr>`).join('')}</tbody>
        </table>
        <div class="ctn-conn">
          <div class="ctn-conn-head">
            <span>Технологические связи</span>
            <button type="button" class="ctn-trace-btn${hasConn && traceMode ? ' on' : ''}" aria-pressed="${hasConn && traceMode}"${hasConn ? '' : ' disabled title="У данной позиции нет трубопроводных связей"'}>⮀ Трассировка связей</button>
          </div>
          ${connHtml}
        </div>
        <details class="ctn-spec">
          <summary>Техническое описание</summary>
          <p>${it.purpose}</p>
        </details>
      </div>`;
  }

  function summaryHtml() {
    const direct = EDGES.filter((e) => selected.has(e.a) && selected.has(e.b));
    const loop = findLoop(selected);
    const loopText = loop
      ? `<span class="ctn-sum-yes">да</span> — ${loop.map((n) => SHORT[n]).join(' → ')}`
      : '<span class="ctn-sum-no">нет</span>';
    return `
      <div class="ctn-summary">
        <div class="ctn-summary-title">Сводка связей контура</div>
        <div class="ctn-summary-row">Замкнутый контур циркуляции: ${loopText}</div>
        ${direct.length
          ? `<ul class="ctn-conn-list">${direct.map((e) => `<li>${endA(e)} ${e.both ? '↔' : '→'} ${endB(e)}: ${e.name}</li>`).join('')}</ul>`
          : '<p class="ctn-conn-none">Прямых трубопроводных связей между выбранными позициями нет.</p>'}
      </div>`;
  }

  // ---------- Подсветка: выбор, трассировка, изоляция систем, поиск ----------
  function applyHighlight() {
    if (!root) return;
    const visible = new Set(ITEMS.filter(matches).map((it) => it.n));
    const isolate = activeGroups.size !== GROUPS.length;
    const filtered = visible.size !== ITEMS.length;
    const hasSel = selected.size > 0;

    // Трассировка: прямые связи выбранных позиций и их соседи
    const traceKeys = new Set();
    const partners = new Set();
    if (traceMode && hasSel) {
      EDGES.forEach((e) => {
        if (!selected.has(e.a) && !selected.has(e.b)) return;
        e.keys.forEach((k) => traceKeys.add(k));
        [e.a, e.b].forEach((x) => { if (typeof x === 'number' && !selected.has(x)) partners.add(x); });
      });
    }

    root.querySelectorAll('svg [data-n]').forEach((node) => {
      const n = +node.dataset.n;
      const sel = selected.has(n);
      let dim = false;
      let off = false;
      let iso = false;
      if (hasSel) dim = !sel && !partners.has(n) && n !== hoverN;
      else if (isolate) { if (visible.has(n)) iso = true; else off = true; }
      else if (filtered) dim = !visible.has(n);
      node.classList.toggle('is-focus', n === hoverN);
      node.classList.toggle('is-selected', sel);
      node.classList.toggle('is-active', sel && n === activeN && selected.size > 1);
      node.classList.toggle('is-partner', partners.has(n));
      node.classList.toggle('is-dim', dim);
      node.classList.toggle('is-off-sys', off);
      node.classList.toggle('is-iso', iso);
    });
    root.querySelectorAll('svg .ctn-line').forEach((line) => {
      const inSys = activeGroups.has(line.dataset.sys);
      const traced = traceKeys.has(line.dataset.key);
      line.classList.toggle('is-trace', traced);
      line.classList.toggle('is-off-sys', isolate && !hasSel && !inSys);
      line.classList.toggle('is-iso', isolate && !hasSel && inSys);
      line.classList.toggle('is-dim', hasSel && !traced);
      line.classList.toggle('is-far', hasSel && traceMode && !traced);
    });
    stage.classList.toggle('has-selection', hasSel);
    listEl.querySelectorAll('.ctn-row').forEach((row) => {
      const n = +row.dataset.n;
      row.classList.toggle('is-hover', n === hoverN);
      row.classList.toggle('is-selected', selected.has(n));
    });
  }

  const STATE_LABEL = { ok: 'Норма', idle: 'Резерв', struct: 'Конструктив', warn: 'Внимание', danger: 'Авария', active: 'В работе' };

  function showTooltip(n, e) {
    const it = ITEM_BY_N.get(n);
    if (!it) return;
    const pill = pillOf(it);
    const ps = paramsOf(it).slice(0, 3);
    tooltip.innerHTML = `<div class="ctn-tt-head"><span class="ctn-row-num">${it.n}</span><b>${it.name}</b></div>
      <div class="ctn-tt-code">${it.code}</div>
      <div class="ctn-tt-pill"><span class="ctn-pill" data-state="${pill.level}">${pill.text}</span></div>
      <table class="ctn-table ctn-table-tt"><tbody>${ps.map(([k, v, u]) => `<tr><td>${k}</td><td><span class="ctn-val">${v}</span> <span class="ctn-unit">${u}</span></td></tr>`).join('')}</tbody></table>`;
    tooltip.style.display = 'block';
    const r = stage.getBoundingClientRect();
    let x = e.clientX - r.left + 16;
    let y = e.clientY - r.top + 16;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 16;
    if (y + th > r.height - 8) y = e.clientY - r.top - th - 16;
    tooltip.style.left = Math.max(8, x) + 'px';
    tooltip.style.top = Math.max(8, y) + 'px';
  }

  // --------------------------------------------------------------------------
  // 6. ЖИВОЕ СОСТОЯНИЕ И АНИМАЦИЯ ПОТОКОВ
  // --------------------------------------------------------------------------
  function setAttr(id, attrs) {
    const node = root.querySelector('#' + id);
    if (!node) return;
    Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
  }

  function setLevel(id, frac) {
    const g = root.querySelector('#' + id);
    if (!g) return;
    const f = Math.max(0, Math.min(1, frac || 0));
    const top = +g.dataset.top;
    const h = +g.dataset.h;
    const y = (top + h * (1 - f)).toFixed(1);
    const rect = g.querySelector('rect');
    const line = g.querySelector('line');
    rect.setAttribute('y', y);
    rect.setAttribute('height', (h * f).toFixed(1));
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
  }

  // Советская/российская условность мнемосхем: красный — включено/открыто, зелёный — отключено/закрыто
  function setPump(id, on, coasting = false) {
    const g = root.querySelector('#' + id);
    if (!g) return;
    g.classList.toggle('is-on', !!on);
    g.classList.toggle('is-coast', !!coasting);
  }

  function setValve(id, open) {
    const v = root.querySelector('#' + id);
    if (v) v.classList.toggle('open', !!open);
  }

  function setFlow(name, on, speedPct) {
    root.querySelectorAll(`.ctn-flow[data-flow="${name}"]`).forEach((p) => {
      p.classList.toggle('on', !!on);
      if (on) {
        const dur = Math.max(0.5, Math.min(6, 1.4 * 100 / Math.max(5, speedPct || 100)));
        p.style.animationDuration = dur.toFixed(2) + 's';
      }
    });
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function refreshStates() {
    if (!root) return;
    ITEMS.forEach((it) => {
      const st = it.state();
      const row = listEl.querySelector(`.ctn-row[data-n="${it.n}"] .ctn-dot`);
      if (row) row.dataset.state = st.level;
      root.querySelectorAll(`.ctn-pin[data-n="${it.n}"]`).forEach((p) => { p.dataset.state = st.level; });
    });
    if (activeN == null) return;
    const it = ITEM_BY_N.get(activeN);
    const pill = pillOf(it);
    stage.querySelectorAll('[data-st-pill], [data-fly-pill]').forEach((p) => {
      p.dataset.state = pill.level;
      setText(p, pill.text);
    });
    statusParams(it).forEach((p, i) => setText(statusEl.querySelector(`[data-sv="${i}"]`), p[1]));
    if (flyoutOpen) {
      paramsOf(it).forEach(([, v, u], i) => {
        setText(flyoutEl.querySelector(`[data-pv="${i}"]`), v);
        setText(flyoutEl.querySelector(`[data-pu="${i}"]`), u);
      });
    }
  }

  // Смешение двух цветов #RRGGBB в пропорции t (0 -> a, 1 -> b)
  function mixHex(a, b, t) {
    const k = Math.max(0, Math.min(1, t));
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) + (((pb >> sh) & 255) - ((pa >> sh) & 255)) * k);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1).toUpperCase();
  }

  const CORE_H = 68; // высота АЗ на схеме, ед. viewBox (373 см)

  function refreshCore(s) {
    // Доля тепловой мощности: номинал — «горячая» зона; после АЗ-1 остаётся остаточное
    // тепловыделение (единицы %), и зона остывает к сине-серому
    const pwr = Math.max(0, Math.min(1.1, (s.thermalPowerMW || 0) / 3200));
    const heat = Math.pow(Math.min(1, pwr), 0.6);
    setAttr('ctnHeatStop0', { 'stop-color': mixHex('#94A3B8', '#0284C7', 0.35 + 0.65 * heat) });
    setAttr('ctnHeatStop1', { 'stop-color': mixHex('#CBD5E1', '#38BDF8', 0.35 + 0.65 * heat) });
    setAttr('ctnHeatStop2', { 'stop-color': mixHex('#CBD5E1', '#EA580C', heat) });
    setAttr('ctnHeatStop3', { 'stop-color': mixHex('#94A3B8', '#DC2626', heat) });
    setText(root.querySelector('#ctnCorePower'), Math.round(s.thermalPowerMW || 0) + ' МВт');

    // Н в % высоты АЗ от низа: 100 % — извлечены, 0 % — полностью введены (при АЗ-1 — все ОР вниз)
    const tripped = !!s.az1Tripped;
    const posWork = tripped ? 0 : (typeof s.group10Pos === 'number' ? s.group10Pos : 100);
    const posAz = tripped ? 0 : (typeof s.groups1to9Pos === 'number' ? s.groups1to9Pos : 100);
    const rods = root.querySelector('#ctnRods');
    if (!rods) return;
    rods.classList.toggle('is-trip', tripped);
    rods.querySelectorAll('.ctn-rod-g').forEach((g) => {
      const pos = g.dataset.rod === 'work' ? posWork : posAz;
      const depth = (1 - Math.max(0, Math.min(100, pos)) / 100) * CORE_H;
      const next = `translateY(${depth.toFixed(1)}px)`;
      if (g.style.transform !== next) g.style.transform = next;
    });
  }

  function refreshScheme() {
    const s = S();
    const running = (typeof s.timeScale === 'number' ? s.timeScale : 1) !== 0;
    root.classList.toggle('is-paused', !running);

    const l1 = loopOf(0);
    const l4 = loopOf(1);
    setFlow('loop1', l1.flowPct > 1, l1.flowPct);
    setFlow('loop4', l4.flowPct > 1, l4.flowPct);
    setPump('ctnPump1', l1.pumpOn, !l1.pumpOn && l1.rpm > 50);
    setPump('ctnPump4', l4.pumpOn, !l4.pumpOn && l4.rpm > 50);

    // Активная зона: цвет подогрева по тепловой мощности, ОР СУЗ по группам и АЗ-1
    refreshCore(s);

    // КД: уровень (номинал 8,17 м из ~12 м высоты)
    setLevel('ctnPrzLvl', (s.pressurizerLevelM || 0) / 12);
    setLevel('ctnSgLvl1', 0.2 + 0.18 * (l1.sgLevelM || 0));
    setLevel('ctnSgLvl4', 0.2 + 0.18 * (l4.sgLevelM || 0));
    root.querySelector('#ctnPrzHeaters').classList.toggle('on', (s.heatersPowerKW || 0) > 50);
    setValve('ctnIpu', !!s.ipuKdOpen);
    setValve('ctnSpotValve', !!s.spotActive);
    setValve('ctnVSpray', !!s.sprayActive);
    setValve('ctnVBzok', true);
    setValve('ctnVFeed', (s.feedwaterFlowPct || 0) > 1);
    setFlow('przSpray', !!s.sprayActive, 80);
    setFlow('ipu', !!s.ipuKdOpen, 100);

    // ГЕ-1
    const ge = Math.max(0, Math.min(1, (s.saozWaterPct || 0) / 100));
    for (let i = 0; i < 4; i++) setLevel('ctnGeLvl' + i, 0.8 * ge);
    const geOn = (s.geFlowKgS || 0) > 0.5;
    setFlow('saoz', geOn, 160);
    setValve('ctnVGe1', geOn);
    setValve('ctnVGe2', geOn);
    root.classList.toggle('saoz-ready', !geOn && ge >= 0.99);

    // Пар, СПОТ, аварийная подпитка
    setFlow('steam', (s.turbineValvePct || 0) > 1 && (s.thermalPowerMW || 0) > 30, Math.max(10, s.turbineValvePct));
    setFlow('spot', !!s.spotActive, 60);
    setFlow('feed', false, 100);
    setFlow('feedMain', (s.feedwaterFlowPct || 0) > 1, Math.max(10, s.feedwaterFlowPct));

    // Аварийные системы при течи
    const loca = isLoca();
    const eccsOn = ((s.hpFlowKgS || 0) + (s.lpFlowKgS || 0)) > 0.5;
    setFlow('boron', s.boronMode === 1, 80);
    setFlow('eccs', eccsOn, 120);
    setFlow('sump', eccsOn, 80);
    setValve('ctnVBoron', s.boronMode === 1);
    setValve('ctnVEccs', eccsOn);
    setValve('ctnVAfw', false);
    setValve('ctnVSprinkler', !!s.sprinklerActive);
    setFlow('spray', !!s.sprinklerActive, 90);
    setPump('ctnPump14', s.boronMode === 1);
    setPump('ctnPump11', !!s.eccsPumpsRunning);
    setPump('ctnPump12', !!s.eccsPumpsRunning);
    setPump('ctnPump9', !!s.sprinklerActive);
    setPump('ctnPump16', !!s.sprinklerActive);
    setPump('ctnPump27', false);
        setFlow('vent', loca, 80);
    root.querySelector('#ctnLeak').style.display = loca ? '' : 'none';
    setLevel('ctnSumpLvl', loca ? 0.75 : 0.55);
    setLevel('ctnPitLvl', loca ? 0.8 : 0.1);
    setLevel('ctnBubLvl', s.ipuKdOpen ? 0.6 : 0.45);

    // УЛР
    setAttr('ctnCatcherWater', { y: s.ulrCoolingActive ? '531' : '541', height: s.ulrCoolingActive ? '10' : '0' });
  }

  // --------------------------------------------------------------------------
  // 7. ЦИКЛ: видимость, масштаб/панорама по камере холста, телеметрия
  // --------------------------------------------------------------------------
  let lastState = 0;
  let visible = false;

  function frame(t) {
    const s = S();
    const show = s.viewMode === 'systems' && s.systemsSubMode === 'cross';
    if (show !== visible) {
      visible = show;
      root.style.display = show ? 'grid' : 'none';
      if (!show) tooltip.style.display = 'none';
    }
    if (show) {
      const cam = window.canvasCam;
      if (cam) {
        const r = stage.getBoundingClientRect();
        const cx = r.width / 2;
        const cy = r.height / 2;
        // Масштаб вокруг центра схемы + панорама; совпадает с кнопками +/−/сброс
        stage.querySelector('svg').style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.zoom})`;
        stage.querySelector('svg').style.transformOrigin = `${cx}px ${cy}px`;
      }
      if (t - lastState > 200) {
        lastState = t;
        refreshScheme();
        refreshStates();
      }
    }
    requestAnimationFrame(frame);
  }

  function init() {
    if (!build()) return;
    root.style.display = 'none';
    refreshScheme();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.containmentView = { items: ITEMS, edges: EDGES, select: (n) => pick(n, null, true), clear: () => clearSelection() };
})();
