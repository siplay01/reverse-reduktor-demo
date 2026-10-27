/* Demo app: hash routes, no data sent anywhere. Data: window.DATA (data.js), settings: window.SITE (config.js). */
(function () {
  const D = window.DATA, S = window.SITE;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: state lives for this page only */ } }
  };
  const fmtRub = n => n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }).replace(/\s/g, " ") + " ₽";
  const tel = "tel:" + S.phone.replace(/[^\d+]/g, "");

  // Designation key: same rules as scripts/normalize_catalog.py, plus dashes ignored for search
  const LAT = "CBXAEHKMOPTYcxaeopy", CYR = "СВХАЕНКМОРТУсхаеору";
  const norm = s => String(s).replace(/[CBXAEHKMOPTYcxaeopy]/g, c => CYR[LAT.indexOf(c)]).toUpperCase().replace(/[‐-―−]/g, "-").replace(/\s+/g, "");
  const loose = s => norm(s).replace(/-/g, "");

  const MODELS = {
    units: { name: "Реверс-редукторы в сборе", short: "В сборе" },
    rr300: { name: "РР-300 (СБ525-01-13), гидравлический", short: "РР-300" },
    rr238: { name: "РР-238 (СБ238-25-01-13), гидравлический", short: "РР-238" },
    "3d6": { name: "3Д6 (СБ525-00-4), механический", short: "3Д6" },
    "3d12": { name: "3Д12 (СБ1225-00-5), механический", short: "3Д12" }
  };
  const byId = Object.fromEntries(D.products.map(p => [p.id, p]));
  const nodeByFig = Object.fromEntries(D.nodes.map(n => [n.figure, n]));
  const draftByFig = Object.fromEntries(D.drafts.map(n => [n.figure, n]));
  const unitOf = m => D.products.find(p => p.model === "units" && p.name.includes(MODELS[m].short));
  const title = p => p.name.replace(p.sku, "").trim() || p.name;

  /* ---------- request list (positions only, no personal data) ---------- */
  let req = store.get("req", []);
  const saveReq = () => { store.set("req", req); renderReqCount(); };
  function addReq(item) {
    const ex = req.find(r => r.key === item.key);
    if (ex) ex.qty += item.qty; else req.push(item);
    saveReq(); toast(`Добавлено в заявку: ${item.sku || item.designation}`);
  }
  function renderReqCount() { const el = $("#req-count"); if (el) el.textContent = req.length ? String(req.length) : ""; }
  let toastTimer;
  function toast(t) {
    let el = $(".toast"); if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
    el.textContent = t; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 2600);
  }

  /* ---------- cookie consent + Yandex Metrika (loads only after "Принять все" and only when SITE.metrikaId is set) ---------- */
  let consent = store.get("consent", null);
  function loadMetrika() {
    if (!S.metrikaId || !consent || !consent.analytics || window.ym) return;
    // standard Metrika tag; appended to <head> because shell() replaces <body> and its script tags
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); }; window.ym.l = 1 * new Date();
    const k = document.createElement("script"); k.async = true; k.src = "https://mc.yandex.ru/metrika/tag.js"; document.head.append(k);
    window.ym(S.metrikaId, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }
  function cookieBanner(show) {
    let el = $(".cookie");
    if (!show) { if (el) el.remove(); document.body.classList.remove("has-cookie"); return; }
    if (el) return;
    el = document.createElement("section"); el.className = "cookie"; el.setAttribute("aria-label", "Уведомление о cookie");
    el.innerHTML = `<p>Мы используем cookie: обязательные для работы сайта (список заявки) и, с вашего согласия, Яндекс Метрику для статистики посещений. Подробнее в <a href="#/legal/cookies">политике cookie</a>.</p>
      <div class="cookie-actions"><button class="btn" data-consent="all">Принять все</button><button class="btn ghost" data-consent="necessary">Только необходимые</button></div>`;
    document.body.append(el); document.body.classList.add("has-cookie");
  }
  function setConsent(all) {
    consent = { analytics: all, date: new Date().toISOString().slice(0, 10) };
    store.set("consent", consent); cookieBanner(false); loadMetrika();
  }

  /* ---------- shared bits ---------- */
  function priceHtml(p) {
    return p && p.pa ? `<span class="pricebox"><span class="price">${fmtRub(p.pa)}</span><span class="price-note">${esc(S.priceNote)}</span></span>`
      : '<span class="pricebox"><span class="price">По запросу</span></span>';
  }
  function imgHtml(p, cls = "") {
    const i = p.img[0];
    return i ? `<img class="${cls}" src="${esc(i.f)}" alt="${esc(p.name)}" loading="lazy">` : '<div class="noimg"><span>Фото по запросу</span></div>';
  }
  const crumbs = items => `<nav class="crumbs" aria-label="Навигация">${items.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join('<span aria-hidden="true">/</span>')}</nav>`;
  const parseHash = () => {
    const [path, qs] = location.hash.replace(/^#/, "").split("?");
    return { parts: (path || "/").split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
  };
  const go = h => { location.hash = h; };
  const searchForm = (id, value = "", hidden = "") => `<form class="search" role="search" data-search>
      <label class="sr" for="${id}">Поиск по обозначению или названию</label>
      <input id="${id}" name="q" value="${esc(value)}" placeholder="Например, 525-16-110 или полумуфта" autocomplete="off" enterkeyhint="search">${hidden}
      <button class="btn">Найти</button></form>`;
  const requisites = () => `<dl class="kv">
      <dt>Организация</dt><dd>${esc(S.operator)}</dd><dt>ИНН / КПП</dt><dd class="nums">${S.inn} / ${S.kpp}</dd><dt>ОГРН</dt><dd class="nums">${S.ogrn}</dd>
      <dt>Адрес</dt><dd>${esc(S.address)}</dd><dt>Телефон</dt><dd><a href="${tel}">${esc(S.phone)}</a></dd><dt>E-mail</dt><dd><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></dd></dl>`;

  /* ---------- pages ---------- */
  function home() {
    const tile = (m, img, sub) => `<a class="model-tile" href="#/model/${m}"><span class="mt-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}</span>
      <span class="mt-body"><b>${MODELS[m].short}</b><span class="muted">${sub}</span></span></a>`;
    const count = m => D.products.filter(p => p.model === m).length;
    const u = m => (unitOf(m) || { img: [] }).img[0]?.f;
    return `
    <section class="hero-band"><div class="wrap hero">
      <div class="hero-text">
        <p class="eyebrow">Поставка, ремонт, запасные части</p>
        <h1>Судовые реверс-редукторы РР-300, РР-238, 3Д6, 3Д12 и запчасти к ним</h1>
        <p class="lead">Подберём деталь по обозначению или по рисунку узла из каталога, отремонтируем реверс-редуктор или муфту сцепления, отправим в любой регион России.</p>
        ${searchForm("q-home")}
        <div class="hero-cta"><a class="btn" href="#/catalog">Каталог запчастей</a><a class="btn ghost" href="${tel}">${esc(S.phone)}</a></div>
      </div>
      <figure class="hero-img"><img src="img/site/hero-rr300-pair.jpg" alt="Два реверс-редуктора РР-300 после сборки в цехе" width="1400" height="1050" fetchpriority="high"></figure>
    </div></section>
    <div class="wrap">
      <ul class="facts">
        <li><b>РКО</b><span>Свидетельство о признании №\u00a006483: дефектация и капитальный ремонт реверс-редукторов</span></li>
        <li><b>12 мес.</b><span>гарантия на реверс-редукторы</span></li>
        <li><b>${D.products.length}</b><span>позиций в каталоге запчастей</span></li>
        <li><b>РФ</b><span>доставка транспортной компанией по всей России</span></li>
      </ul>
      <div class="sec-head"><h2>Наша продукция</h2><a href="#/products">Все модели</a></div>
      <div class="models">
        ${tile("rr300", "img/site/rr300-flange.jpg", `СБ525-01-13 · 10 исполнений · ${count("rr300")} запчастей`)}
        ${tile("rr238", u("rr238"), "СБ238-25-01-13 · под ЯМЗ-238")}
        ${tile("3d6", u("3d6"), `СБ525-00-4 · ${count("3d6")} запчастей`)}
        ${tile("3d12", u("3d12"), `СБ1225-00-5 · ${count("3d12")} запчастей`)}
      </div>
    </div>
    <section class="parts-band"><div class="wrap">
      <h2>Запчасти: два способа найти нужную</h2>
      <div class="paths">
        <div class="path"><span class="step">1</span><h3>Знаю обозначение</h3><p>Введите номер с детали или из каталога. Латинские и русские буквы, пробелы и дефисы не важны.</p><a class="btn" href="#/catalog">Открыть каталог</a></div>
        <div class="path"><span class="step">2</span><h3>Знаю модель и узел</h3><p>Выберите исполнение РР-300 и рисунок узла: таблица покажет позиции и количество для вашего исполнения.</p><a class="btn" href="#/model/rr300">Узлы РР-300</a></div>
      </div>
    </div></section>
    <div class="wrap">
      <div class="sec-head"><h2>Услуги</h2><a href="#/services">Подробнее</a></div>
      <div class="svc">
        <a href="#/services" class="svc-item"><h3>Ремонт реверс-редукторов</h3><p>Дефектация, капитальный ремонт и сборка РР-300, РР-238, 3Д6, 3Д12.</p></a>
        <a href="#/services" class="svc-item"><h3>Муфты сцепления</h3><p>Гидравлические СБ525-01-14 и механические СБ1226-00-2.</p></a>
        <a href="#/services" class="svc-item"><h3>Рулевые машины РГ</h3><p>Капитальный ремонт РГ-0,25, РГ-0,63, РГ-1,6.</p></a>
      </div>
      <h2>Как оформить заказ</h2>
      <ol class="steps">
        <li><b>Заявка</b><span>Соберите позиции из каталога или пришлите перечень обозначений.</span></li>
        <li><b>Согласование</b><span>Менеджер уточнит применяемость, наличие и сроки, рассчитает стоимость.</span></li>
        <li><b>Оплата</b><span>По счёту на расчётный счёт после подтверждения заявки.</span></li>
        <li><b>Отгрузка</b><span>Отправим транспортной компанией в ваш регион.</span></li>
      </ol>
      <div class="cta"><div><h2>Нужна консультация по подбору?</h2><p>Позвоните или напишите: поможем определить исполнение и нужные детали.</p></div>
        <div class="cta-actions"><a class="btn" href="${tel}">${esc(S.phone)}</a><a class="btn ghost" href="mailto:${esc(S.email)}">${esc(S.email)}</a></div></div>
    </div>`;
  }

  function catalog(q) {
    const text = (q.get("q") || "").trim(), model = q.get("m") || "", page = Math.max(1, +q.get("p") || 1);
    const tk = loose(text), tl = text.toLowerCase();
    let items = D.products.filter(p => !model || p.model === model);
    if (text) items = items.filter(p => loose(p.sku).includes(tk) || p.name.toLowerCase().includes(tl));
    items.sort((a, b) => (text && loose(a.sku) === tk ? -1 : 0) - (text && loose(b.sku) === tk ? -1 : 0) || a.sku.localeCompare(b.sku, "ru", { numeric: true }));
    const pages = Math.max(1, Math.ceil(items.length / S.pageSize)), cur = Math.min(page, pages);
    const slice = items.slice((cur - 1) * S.pageSize, cur * S.pageSize);
    const link = o => "#/catalog?" + new URLSearchParams(Object.entries({ q: text, m: model, p: cur, ...o }).filter(([, v]) => v && v !== 1)).toString();
    const cnt = m => D.products.filter(p => (!m || p.model === m) && (!text || loose(p.sku).includes(tk) || p.name.toLowerCase().includes(tl))).length;
    const dense = document.documentElement.dataset.variant === "b";
    const results = !slice.length ? `<div class="empty"><h3>Ничего не найдено</h3><p>По запросу «${esc(text)}» в каталоге нет позиций. Проверьте обозначение или <a href="#/request">отправьте запрос по обозначению</a>: деталь подберут вручную.</p></div>`
      : dense ? `<div class="table-scroll"><table class="list cat-table"><thead><tr><th>Обозначение</th><th>Наименование</th><th>Модель</th><th class="num">Цена за ед.</th><th><span class="sr">Действие</span></th></tr></thead><tbody>
          ${slice.map(p => `<tr><td class="sku"><a href="#/p/${p.id}">${esc(p.sku)}</a></td><td class="nm">${esc(title(p))}</td><td class="md">${MODELS[p.model].short}</td><td class="num">${priceHtml(p)}</td><td class="act"><button class="btn small" data-add="${p.id}">В заявку</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="grid">${slice.map(p => `<article class="card"><a class="cover" href="#/p/${p.id}" tabindex="-1" aria-hidden="true">${imgHtml(p)}</a>
          <div class="body"><span class="sku">${esc(p.sku)}</span><a class="ttl" href="#/p/${p.id}">${esc(title(p))}</a><span class="badge">${MODELS[p.model].short}</span>
          <div class="buyrow">${priceHtml(p)}<button class="btn small" data-add="${p.id}">В заявку</button></div></div></article>`).join("")}</div>`;
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Запасные части"]])}
      <h1>Каталог запчастей</h1>
      ${searchForm("q-cat", text, model ? `<input type="hidden" name="m" value="${model}">` : "")}
      <p class="muted count">Найдено: ${items.length}. Цены ${esc(S.priceNote)}; наличие и срок поставки подтверждает менеджер.</p>
      <div class="cat-layout">
        <div class="filters" role="group" aria-label="Модель">
          <button data-href="${link({ m: "", p: 1 })}" aria-pressed="${!model}">Все модели <span class="n">${cnt("")}</span></button>
          ${Object.entries(MODELS).map(([k, m]) => `<button data-href="${link({ m: k, p: 1 })}" aria-pressed="${model === k}">${m.short} <span class="n">${cnt(k)}</span></button>`).join("")}
        </div>
        <div class="cat-results">${results}
          ${pages > 1 ? `<nav class="pager" aria-label="Страницы">${cur > 1 ? `<a class="btn ghost small" href="${link({ p: cur - 1 })}">Назад</a>` : ""}
            ${Array.from({ length: pages }, (_, i) => i + 1).map(i => `<a class="btn small ${i === cur ? "" : "ghost"}" href="${link({ p: i })}" ${i === cur ? 'aria-current="page"' : ""}>${i}</a>`).join("")}
            ${cur < pages ? `<a class="btn ghost small" href="${link({ p: cur + 1 })}">Далее</a>` : ""}</nav>` : ""}
        </div></div></div>`;
  }

  function product(id) {
    const p = byId[id]; if (!p) return notFound();
    const uses = p.uses.map(u => `<li><a href="#/node/${u.figure}">Рис. ${u.figure}. ${esc(nodeByFig[u.figure].title)}</a>, позиция ${u.pos}</li>`);
    const drafts = p.draft.map(f => `<li><a href="#/node/${f}">Рис. ${f}. ${esc(draftByFig[f].title)}</a></li>`);
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Запасные части", "#/catalog"], [MODELS[p.model].short, `#/catalog?m=${p.model}`], [p.sku]])}
      <div class="prod">
        <div class="gallery"><div class="main-img" id="main-img">${imgHtml(p)}</div>
          ${p.img.length > 1 ? `<div class="thumbs">${p.img.map((im, i) => `<button data-thumb="${esc(im.f)}" aria-pressed="${i === 0}" aria-label="Фото ${i + 1}"><img src="${esc(im.f)}" alt=""></button>`).join("")}</div>` : ""}
        </div>
        <div class="prod-info">
          <span class="badge">${MODELS[p.model].short}</span>
          <h1>${esc(title(p))}</h1>
          <dl class="kv"><dt>Обозначение</dt><dd class="sku">${esc(p.sku)}</dd><dt>Модель</dt><dd>${MODELS[p.model].name}</dd></dl>
          <div class="buy">
            <div class="buy-price"><span class="muted">Цена за ед.</span>${priceHtml(p)}</div>
            <div class="buy-row">
              <div class="stepper"><button type="button" data-step="-1" aria-label="Меньше">&minus;</button><label class="sr" for="qty">Количество</label><input id="qty" type="number" min="1" value="1" inputmode="numeric"><button type="button" data-step="1" aria-label="Больше">+</button></div>
              <button class="btn grow" data-add="${p.id}" data-qty-from="#qty">Добавить в заявку</button>
            </div>
            <p class="foot">Наличие, срок поставки и итоговую цену подтверждает менеджер в ответе на заявку.</p>
          </div>
          ${p.text ? `<h2>Описание</h2><p>${esc(p.text.replace(/\s+,\s*/g, ", "))}</p>` : ""}
          ${uses.length || drafts.length ? `<h2>Где применяется</h2><ul class="uses">${uses.join("")}${drafts.join("")}</ul>` : ""}
        </div></div></div>`;
  }

  function modelPage(m) {
    if (m === "rr300") {
      const nodes = Array.from({ length: 26 }, (_, i) => i + 1);
      return `<div class="wrap">${crumbs([["Главная", "#/"], ["Наша продукция", "#/products"], ["РР-300"]])}
        <div class="model-head"><div>
          <h1>Реверс-редуктор РР-300 (СБ525-01-13)</h1>
          <p class="lead">Гидравлический реверс-редуктор для судовых дизелей. Исполнения различаются передаточным отношением, направлением вращения ведущего вала и соединительной муфтой.</p>
          <dl class="kv"><dt>Мощность</dt><dd>220 кВт (300 л.с.); для части исполнений 110 кВт (150 л.с.)</dd>
            <dt>Частота вращения</dt><dd>1500 об/мин номинальная, включение от 600 об/мин</dd>
            <dt>Передаточное отношение</dt><dd>передний ход 1:2,04 или 1:2,95; задний ход 1:2,04, 1:2,95 или 1:2,18</dd>
            <dt>Масса сухая</dt><dd>430 кг (алюминиевый фланец), 450 кг (чугунный)</dd>
            <dt>Масло в гидросистеме</dt><dd>12-13 л</dd></dl>
          <p class="hero-cta"><a class="btn" href="#/catalog?m=rr300">Запчасти РР-300</a><a class="btn ghost" href="#/docs">Руководство по эксплуатации</a></p>
        </div><figure class="model-img"><img src="img/site/rr300-side.jpg" alt="Реверс-редуктор РР-300" loading="lazy"></figure></div>
        <h2>Исполнения</h2>
        <div class="table-scroll"><table class="list"><thead><tr><th>Обозначение</th><th>Вращение</th><th>Мощность</th><th>Передний ход</th><th>Задний ход</th><th>Муфта</th></tr></thead><tbody>
          ${D.variants.map(v => `<tr><td class="sku">${v.full}</td><td>${v.rot}</td><td class="nums">${v.hp} л.с.</td><td class="nums">${v.fwd}</td><td class="nums">${v.rev}</td><td>${v.fingers}-пальцевая</td></tr>`).join("")}</tbody></table></div>
        <h2>Узлы по каталогу деталей</h2>
        <p class="muted">Выберите рисунок: откроется схема узла и спецификация. Для ${D.nodes.length} узлов таблица пересчитывает количество под выбранное исполнение.</p>
        <div class="figs">${nodes.map(f => { const n = nodeByFig[f], d = draftByFig[f]; return `<a class="fig" href="#/node/${f}"><span class="fig-n">${f}</span><span>${esc((n || d).title)}</span>${n ? '<span class="badge ok">таблица</span>' : ""}</a>`; }).join("")}</div></div>`;
    }
    const info = {
      rr238: ["Реверс-редуктор РР-238 (СБ238-25-01-13)", "Гидравлический реверс-редуктор для силовых установок с дизелями ЯМЗ-238 и их модификациями. Применяется на судах различного назначения: от рабочих катеров до буксиров и рыболовецких судов."],
      "3d6": ["Реверс-редуктор 3Д6 (СБ525-00-4)", "Механический реверс-редуктор в составе дизель-редукторных агрегатов с двигателями 3Д6."],
      "3d12": ["Реверс-редуктор 3Д12 (СБ1225-00-5)", "Механический реверс-редуктор для работы с двигателями 3Д12 на буксирах, судах портового флота, траулерах, пассажирских и грузопассажирских судах."]
    }[m];
    if (!info) return notFound();
    const unit = unitOf(m);
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Наша продукция", "#/products"], [MODELS[m].short]])}
      <div class="model-head"><div><h1>${info[0]}</h1><p class="lead">${info[1]}</p>
        ${unit ? `<div class="buy"><div class="buy-price"><span class="muted">Реверс-редуктор в сборе</span>${priceHtml(unit)}</div><div class="buy-row"><a class="btn ghost" href="#/p/${unit.id}">Карточка</a><button class="btn grow" data-add="${unit.id}">Добавить в заявку</button></div></div>` : ""}
        <p class="hero-cta"><a class="btn" href="#/catalog?m=${m}">Запчасти ${MODELS[m].short}</a></p></div>
        ${unit && unit.img[0] ? `<figure class="model-img"><img src="${esc(unit.img[0].f)}" alt="${esc(info[0])}" loading="lazy"></figure>` : ""}</div></div>`;
  }

  function nodePage(fig, q) {
    const n = nodeByFig[fig], d = draftByFig[fig];
    if (!n && !d) return notFound();
    const head = crumbs([["Главная", "#/"], ["РР-300", "#/model/rr300"], ["Рис. " + fig]]);
    if (!n) {
      const prods = d.products.map(id => byId[id]);
      return `<div class="wrap">${head}<h1>Рис. ${fig}. ${esc(d.title)}</h1>
        <div class="note">Интерактивная таблица этого узла готовится. Ниже страницы каталога деталей (стр. ${d.catalog_pages.join(" и ")}): позиции и количество смотрите по спецификации. Если нужной детали нет в списке, отправьте запрос по обозначению.</div>
        ${prods.length ? `<h2>Позиции узла в каталоге</h2><ul class="plist">${prods.map(p => `<li><a href="#/p/${p.id}"><span class="sku">${esc(p.sku)}</span> ${esc(title(p))}</a>${priceHtml(p)}<button class="btn small" data-add="${p.id}">В заявку</button></li>`).join("")}</ul>` : ""}
        <div class="scan-pair"><figure><figcaption>Рисунок</figcaption><a href="${d.drawing}" target="_blank" rel="noopener"><img src="${d.drawing}" alt="Рис. ${fig}, страница каталога" loading="lazy"></a></figure>
        <figure><figcaption>Спецификация</figcaption><a href="${d.spec}" target="_blank" rel="noopener"><img src="${d.spec}" alt="Спецификация к рис. ${fig}" loading="lazy"></a></figure></div></div>`;
    }
    const multi = n.variants.length > 1;
    const vi = Math.max(0, n.variants.indexOf(q.get("v") || "-"));
    const showAll = q.get("all") === "1";
    const vname = n.variants[vi] === "-" ? n.base : n.base + n.variants[vi];
    const vinfo = n.base === "СБ525-01-13" ? D.variants.find(v => v.code === n.variants[vi]) : null;
    const applies = r => r.qty[vi] !== null;
    const range = r => { // human label of where a row applies when it differs between versions
      if (!multi || r.qty.every(x => x === r.qty[0])) return "";
      const on = n.variants.filter((_, i) => r.qty[i] !== null);
      return `только исп. ${on.map(c => c === "-" ? "базовое" : c).join(", ")}`;
    };
    const rows = n.rows.filter(r => showAll || applies(r));
    const hidden = n.rows.length - rows.length;
    const link = o => `#/node/${fig}?` + new URLSearchParams(Object.entries({ v: n.variants[vi], all: showAll ? "1" : "", ...o }).filter(([, v]) => v)).toString();
    return `<div class="wrap">${head}
      <h1>Рис. ${fig}. ${esc(n.title)}</h1>
      <p class="muted">Узел ${esc(n.base)}, каталог деталей РР-300, стр. ${n.catalog_pages[1]}. <a href="${n.spec}" target="_blank" rel="noopener">Скан спецификации</a></p>
      <div class="node">
        <figure class="drawing"><a href="${n.drawing}" target="_blank" rel="noopener"><img src="${n.drawing}" alt="Рис. ${fig}. ${esc(n.title)}: схема с номерами позиций"></a><figcaption class="foot">Номера на схеме соответствуют столбцу «Поз.». Нажмите, чтобы открыть в полном размере.</figcaption></figure>
        <div class="node-main">
          <div class="node-tools">
            ${multi ? `<div class="field"><label for="var">Исполнение</label>
              <select id="var" data-nav>${n.variants.map((c, i) => `<option value="${link({ v: c })}" ${i === vi ? "selected" : ""}>${c === "-" ? n.base + " (базовое)" : n.base + c}</option>`).join("")}</select></div>` : ""}
            ${multi ? `<label class="check"><input type="checkbox" data-nav-check="${link({ all: showAll ? "" : "1" })}" ${showAll ? "checked" : ""}> Показать позиции других исполнений</label>` : ""}
          </div>
          ${vinfo ? `<p class="muted vinfo">${esc(vname)}: вращение ${vinfo.rot}, ${vinfo.hp} л.с., передний ход ${vinfo.fwd}, задний ${vinfo.rev}, ${vinfo.fingers}-пальцевая муфта.</p>` : ""}
          ${!rows.length ? `<div class="empty">Узел не входит в исполнение ${esc(vname)}. Выберите другое исполнение.</div>` : `
          <div class="table-scroll"><table class="list spec"><thead><tr><th>Поз.</th><th>Обозначение</th><th>Наименование</th><th class="num">Кол-во в узле</th><th class="num">Цена за ед.</th><th><span class="sr">Действие</span></th></tr></thead><tbody>
          ${rows.map(r => {
            const p = r.product ? byId[r.product] : null, na = !applies(r), rg = range(r);
            return `<tr class="${na ? "na" : ""}"><td class="pos">${r.pos}</td>
              <td class="sku">${p ? `<a href="#/p/${p.id}">${esc(r.designation)}</a>` : esc(r.designation)}${r.note ? `<sup title="Примечание ${r.note}">${r.note}</sup>` : ""}</td>
              <td class="nm">${esc(r.name)}${rg ? `<span class="badge warn">${rg}</span>` : ""}</td>
              <td class="num qtycell" data-l="В узле">${na ? "не входит" : r.qty[vi] + " шт."}</td>
              <td class="num pricecell" data-l="Цена">${priceHtml(p)}</td>
              <td class="act">${na ? "" : `<button class="btn small ${p ? "" : "ghost"}" data-add-row="${fig}|${r.pos}|${vi}" aria-label="В заявку: поз. ${r.pos}, ${esc(r.designation)}">В заявку</button>`}</td></tr>`;
          }).join("")}</tbody></table></div>`}
          ${hidden ? `<p class="foot">Скрыто позиций других исполнений: ${hidden}.</p>` : ""}
          ${Object.keys(n.footnotes).length ? `<div class="foot">${Object.entries(n.footnotes).map(([k, t]) => `<p><sup>${k}</sup> ${esc(t)}</p>`).join("")}</div>` : ""}
          <p class="foot">«БЧ»: покупное изделие по стандарту. В заявку добавляется количество из узла; его можно изменить в заявке.</p>
        </div></div></div>`;
  }

  function products() {
    const row = (m, img, sub) => `<a class="model-tile" href="#/model/${m}"><span class="mt-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}</span><span class="mt-body"><b>${MODELS[m].name}</b><span class="muted">${sub}</span></span></a>`;
    const u = m => (unitOf(m) || { img: [] }).img[0]?.f;
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Наша продукция"]])}<h1>Наша продукция</h1>
      <div class="models">${row("rr300", "img/site/rr300-flange.jpg", "10 исполнений, каталог узлов")}${row("rr238", u("rr238"), "под двигатели ЯМЗ-238")}${row("3d6", u("3d6"), "для двигателей 3Д6")}${row("3d12", u("3d12"), "для двигателей 3Д12")}</div>
      <p class="hero-cta"><a class="btn ghost" href="#/catalog?m=units">Реверс-редукторы в сборе в каталоге</a></p></div>`;
  }

  function services() {
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Услуги"]])}<h1>Услуги</h1>
      <div class="svc-page">
        <section><h2>Ремонт судовых реверс-редукторов</h2><p>Дефектация и капитальный ремонт РР-300, РР-238, 3Д6, 3Д12 по согласованной с Российским Классификационным Обществом документации: диагностика, разборка, замена изношенных деталей, сборка.</p></section>
        <section><h2>Ремонт муфт сцепления</h2><p>Гидравлические муфты СБ525-01-14 и механические СБ1226-00-2: полная разборка, дефектовка с составлением ведомости, восстановление.</p></section>
        <section><h2>Ремонт рулевых гидравлических машин серии РГ</h2><p>РГ-0,25; РГ-0,63; РГ-1,6. Диагностика, дефектация, замена цилиндров, золотников, плунжеров и шестерён, ремонт гидрораспределителей и насосных узлов.</p></section>
        <section><h2>Изготовление деталей</h2><p>Изготовление и ремонт изделий судового машиностроения по согласованной документации, по чертежам и образцам заказчика.</p></section>
        <section><h2>Техническая документация</h2><p>Разработка технической документации на изделия судового машиностроения.</p></section>
        <section><h2>Консультации</h2><p>Подбор деталей и исполнения, вопросы монтажа и эксплуатации.</p></section>
      </div>
      <div class="cta"><div><h2>Обсудить ремонт</h2><p>Опишите оборудование и неисправность, менеджер рассчитает сроки и стоимость.</p></div><div class="cta-actions"><a class="btn" href="${tel}">${esc(S.phone)}</a><a class="btn ghost" href="#/request">Оставить заявку</a></div></div></div>`;
  }

  function docs() {
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Техническая документация"]])}<h1>Техническая документация</h1>
      <h2>Руководство по эксплуатации РР-300.РЭ</h2>
      <p>Реверс-редукторы РР-300 (СБ525-01-13) и РР-238 (СБ238-25-01-13): устройство, монтаж, эксплуатация, техническое обслуживание. PDF, 24 страницы.</p>
      <p class="hero-cta"><a class="btn" href="docs/rr300-re.pdf" target="_blank" rel="noopener">Открыть PDF</a><a class="btn ghost" href="docs/rr300-re.pdf" download>Скачать</a></p>
      <iframe class="doc-frame" src="docs/rr300-re.pdf" title="Руководство по эксплуатации РР-300.РЭ" loading="lazy"></iframe>
      <h2>Каталог деталей РР-300</h2><p>26 рисунков узлов со спецификациями. <a href="#/model/rr300">Перейти к узлам</a></p>
      <div class="thumb-grid">${["p008", "p004", "p007"].map(s => `<a href="img/scans/${s}.jpg" target="_blank" rel="noopener"><img src="img/scans/${s}.jpg" alt="Страница каталога РР-300" loading="lazy"></a>`).join("")}</div>
      <h2>Иллюстрации из руководства</h2>
      <div class="thumb-grid">${["0a8ea9568454a659.png", "26513f5832caeb7a.jpg", "607db9feaf7523ad.jpg", "b87bed81148b5ba7.png", "c9365a5d09280cf9.png", "cd00e05476ad9914.jpg", "d260ad0d869ee1cd.jpg", "d28a26ba6accb767.jpg"].map(f => `<a href="img/diagrams/${f}" target="_blank" rel="noopener"><img src="img/diagrams/${f}" alt="Иллюстрация из руководства РР-300" loading="lazy"></a>`).join("")}</div></div>`;
  }

  function about() {
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["О компании"]])}<h1>О компании</h1>
      <div class="about">
        <div>
          <p class="lead">${esc(S.operator)} (Барнаул) поставляет судовые реверс-редукторы РР-300, РР-238, 3Д6, 3Д12 и запасные части к ним, ремонтирует реверс-редукторы, муфты сцепления и рулевые гидравлические машины.</p>
          <p>Российское Классификационное Общество признаёт за ${esc(S.operator)} возможность выполнять:</p>
          <ul><li>разработку технической документации на изделия судового машиностроения;</li>
            <li>дефектацию и капитальный ремонт судовых реверс-редукторов по согласованной с РКО документации;</li>
            <li>изготовление и ремонт изделий судового машиностроения по согласованной с РКО документации.</li></ul>
          <p>Работаем с судовладельцами и ремонтными предприятиями по всей России. На реверс-редукторы действует гарантия 12 месяцев.</p>
          <h2>Реквизиты</h2>${requisites()}
        </div>
        <figure class="cert"><a href="img/site/rko-06483.jpg" target="_blank" rel="noopener"><img src="img/site/rko-06483.jpg" alt="Свидетельство о признании РКО № 06483, ООО «Дело»" loading="lazy"></a>
          <figcaption><b>Свидетельство о признании № 06483</b><br>Российское Классификационное Общество, Западно-Сибирский филиал. Дата вступления в силу 11.06.2024, дата окончания действия 11.06.2026.</figcaption></figure>
      </div></div>`;
  }

  function delivery() {
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Доставка и оплата"]])}<h1>Доставка и оплата</h1>
      <div class="svc-page">
        <section><h2>Доставка</h2><p>По всей России любой удобной транспортной компанией. Стоимость рассчитывается индивидуально: вид транспорта (автомобильный или авиа), вес груза, удалённость пункта назначения.</p></section>
        <section><h2>Оплата</h2><p>Безналичный расчёт на расчётный счёт после согласования заявки с менеджером.</p></section>
      </div>
      <h2>Как оформить заказ</h2>
      <ol class="steps">
        <li><b>Заявка</b><span>Соберите позиции из каталога или пришлите перечень обозначений.</span></li>
        <li><b>Согласование</b><span>Менеджер уточнит детали и рассчитает стоимость.</span></li>
        <li><b>Оплата</b><span>Перевод на расчётный счёт после подтверждения заявки.</span></li>
        <li><b>Получение</b><span>Организуем отправку в ваш регион.</span></li>
      </ol></div>`;
  }

  function contacts() {
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Контакты"]])}<h1>Контакты</h1>
      <div class="contact-cards">
        <a class="cc" href="${tel}"><span class="muted">Телефон</span><b>${esc(S.phone)}</b></a>
        <a class="cc" href="mailto:${esc(S.email)}"><span class="muted">E-mail</span><b>${esc(S.email)}</b></a>
        <a class="cc" href="https://yandex.ru/maps/?text=${encodeURIComponent(S.address)}" target="_blank" rel="noopener"><span class="muted">Адрес</span><b>${esc(S.address)}</b><span class="foot">Открыть на Яндекс Картах</span></a>
      </div>
      <h2>Реквизиты</h2>${requisites()}</div>`;
  }

  function legal(sub) {
    const op = `${esc(S.operator)} (ОГРН ${S.ogrn}, ИНН ${S.inn}, адрес: ${esc(S.address)})`;
    const tabs = [["", "Политика ПДн"], ["consent", "Согласие"], ["cookies", "Cookie"], ["seller", "Сведения о продавце"]];
    const body = {
      "": `<h2>Политика обработки персональных данных</h2>
        <p><b>1. Оператор.</b> ${op}, e-mail для обращений: <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>.</p>
        <p><b>2. Цели и данные.</b> 2.1. Обработка заявки посетителя и подготовка коммерческого предложения: наименование организации, фамилия и имя контактного лица, телефон, e-mail, текст комментария, перечень запрашиваемых позиций. 2.2. Заключение и исполнение договора поставки или ремонта. 2.3. Обеспечение работы и безопасности сайта: IP-адрес, сведения о браузере, дата и время запроса. 2.4. Статистика посещений (Яндекс Метрика) при наличии согласия посетителя.</p>
        <p><b>3. Основания.</b> Согласие субъекта (п. 1 ч. 1 ст. 6 152-ФЗ) для целей 2.1 и 2.4; заключение и исполнение договора (п. 5) для цели 2.2; законный интерес оператора (п. 7) для цели 2.3.</p>
        <p><b>4. Действия.</b> Сбор, запись, систематизация, хранение, уточнение, использование, удаление. Распространение не осуществляется.</p>
        <p><b>5. Обработчики.</b> По поручению оператора данные обрабатывают хостинг-провайдер и почтовый сервис; серверы находятся в Российской Федерации.</p>
        <p><b>6. Сроки.</b> Заявки, не завершившиеся договором: 12 месяцев. По договорам: срок действия договора и срок хранения документов по закону.</p>
        <p><b>7. Права субъекта.</b> Получить сведения об обработке, потребовать уточнения, блокирования или уничтожения данных, отозвать согласие письмом на e-mail оператора. Оператор отвечает в течение 10 рабочих дней.</p>
        <p><b>8. Защита.</b> Шифрование соединения (HTTPS), разграничение доступа, резервное копирование на серверах в РФ.</p>`,
      consent: `<h2>Согласие на обработку персональных данных</h2>
        <p>Отправляя заявку на сайте, я даю ${op} согласие на обработку моих персональных данных: фамилии, имени, телефона, e-mail, наименования организации и текста заявки, с целью рассмотрения заявки и подготовки коммерческого предложения. Согласие распространяется на сбор, запись, хранение, использование и удаление данных, в том числе с поручением обработки хостинг-провайдеру и почтовому сервису. Согласие действует 12 месяцев и может быть отозвано письмом на <a href="mailto:${esc(S.email)}">${esc(S.email)}</a>.</p>`,
      cookies: `<h2>Политика использования cookie</h2>
        <p><b>Обязательные.</b> Локальное хранилище браузера: список заявки, выбранный вариант оформления и ваш выбор по cookie. Эти данные хранятся только на вашем устройстве и на сервер не передаются.</p>
        <p><b>Аналитические (по согласию).</b> Яндекс Метрика (ООО «Яндекс»): обезличенная статистика посещений, cookie _ym_uid, _ym_d и другие. Счётчик загружается только после нажатия «Принять все».</p>
        <p>Вы можете изменить решение в любой момент: <button class="btn small ghost" data-consent="reset">Настройки cookie</button></p>
        <p class="foot">Ваш текущий выбор: ${consent ? (consent.analytics ? "все cookie" : "только необходимые") + ", " + esc(consent.date) : "не сделан"}.</p>`,
      seller: `<h2>Сведения о продавце</h2>${requisites()}<p class="foot">Цены на сайте указаны ${esc(S.priceNote)}, носят справочный характер и не являются публичной офертой (ст. 437 ГК РФ).</p>`
    }[sub || ""];
    if (body === undefined) return notFound();
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Правовая информация"]])}<h1>Правовая информация</h1>
      <nav class="tabs" aria-label="Документы">${tabs.map(([k, t]) => `<a href="#/legal${k ? "/" + k : ""}" ${(sub || "") === k ? 'aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <div class="doc">${body}</div></div>`;
  }

  function request() {
    const line = r => { const p = r.id ? byId[r.id] : null; return `${p ? p.sku : r.designation}  ${p ? title(p) : r.name}  ${r.qty} шт.${r.from ? "  (" + r.from + ")" : ""}`; };
    return `<div class="wrap">${crumbs([["Главная", "#/"], ["Заявка"]])}<h1>Заявка на коммерческое предложение</h1>
      <div class="req-grid"><div>
        ${!req.length ? `<div class="empty"><h3>Заявка пуста</h3><p>Добавьте позиции из <a href="#/catalog">каталога</a> или из таблицы <a href="#/model/rr300">узла РР-300</a>.</p></div>` : `
        <div class="table-scroll"><table class="list req-table"><thead><tr><th>Обозначение</th><th>Наименование</th><th>К заказу, шт.</th><th class="num">Цена за ед.</th><th><span class="sr">Удалить</span></th></tr></thead><tbody>
        ${req.map((r, i) => { const p = r.id ? byId[r.id] : null; return `<tr><td class="sku">${p ? `<a href="#/p/${p.id}">${esc(p.sku)}</a>` : esc(r.designation)}</td>
          <td class="nm">${esc(p ? title(p) : r.name)}${r.from ? `<span class="foot">${esc(r.from)}${r.nodeQty ? `, в узле ${r.nodeQty} шт.` : ""}</span>` : ""}${p ? "" : '<span class="badge">запрос по обозначению</span>'}</td>
          <td class="q"><label class="sr" for="rq${i}">Количество</label><input id="rq${i}" type="number" min="1" value="${r.qty}" data-req-qty="${i}" inputmode="numeric"></td>
          <td class="num">${priceHtml(p)}</td><td class="act"><button class="btn small ghost" data-req-del="${i}">Удалить</button></td></tr>`; }).join("")}
        </tbody></table></div>
        <p class="hero-cta"><button class="btn ghost" data-req-copy>Скопировать перечень</button><button class="btn ghost" data-req-clear>Очистить</button></p>
        <textarea id="req-text" class="sr" aria-hidden="true" tabindex="-1">${esc(req.map(line).join("\n"))}</textarea>`}
      </div>
      <form class="buy req-form" data-demo-form novalidate>
        <h3>Контактные данные</h3>
        <p class="note">Демо-версия: заявка никуда не отправляется и не сохраняется. На рабочем сайте она придёт на почту компании.</p>
        ${["Организация", "Контактное лицо", "Телефон", "E-mail"].map((l, i) => `<div class="field"><label for="f${i}">${l}</label><input id="f${i}" ${i === 2 ? 'type="tel"' : i === 3 ? 'type="email"' : ""} autocomplete="off"></div>`).join("")}
        <div class="field"><label for="f9">Комментарий: судно, двигатель, заводской номер</label><textarea id="f9" rows="3"></textarea></div>
        <label class="check"><input type="checkbox" id="f-consent"> <span>Даю <a href="#/legal/consent">согласие на обработку персональных данных</a> и подтверждаю, что ознакомлен с <a href="#/legal">политикой</a></span></label>
        <button class="btn">Отправить заявку</button>
      </form></div></div>`;
  }

  function notFound() { return `<div class="wrap"><h1>Страница не найдена</h1><p><a href="#/">На главную</a> или <a href="#/catalog">в каталог</a>.</p></div>`; }

  /* ---------- router ---------- */
  const NAV = [["#/products", "Продукция"], ["#/catalog", "Запчасти"], ["#/services", "Услуги"], ["#/docs", "Документация"], ["#/about", "О компании"], ["#/delivery", "Доставка"], ["#/contacts", "Контакты"]];
  function render() {
    const { parts, q } = parseHash(), [a, b] = parts;
    const html = !a ? home() : a === "catalog" ? catalog(q) : a === "p" ? product(b) : a === "model" ? modelPage(b) : a === "node" ? nodePage(+b, q)
      : a === "products" ? products() : a === "services" ? services() : a === "docs" ? docs() : a === "request" ? request()
      : a === "about" ? about() : a === "delivery" ? delivery() : a === "contacts" ? contacts() : a === "legal" ? legal(b) : notFound();
    $("main").innerHTML = html;
    const section = "#/" + ({ p: "catalog", model: "products", node: "products" }[a] || a);
    document.querySelectorAll("nav.main a").forEach(el => el.getAttribute("href") === section ? el.setAttribute("aria-current", "page") : el.removeAttribute("aria-current"));
    const h1 = $("main h1"); document.title = (h1 && a ? h1.textContent + " | " : "") + S.name;
    $("nav.main").classList.remove("open"); $(".menu-toggle").setAttribute("aria-expanded", "false");
    if (window.ym && S.metrikaId) window.ym(S.metrikaId, "hit", location.href);
  }

  function shell() {
    const forced = new URLSearchParams(location.search).get("v"); // index.html?v=a | ?v=b opens a variant directly
    if (forced === "a" || forced === "b") store.set("variant", forced);
    const v = forced === "a" || forced === "b" ? forced : store.get("variant", "a");
    document.documentElement.dataset.variant = v;
    document.body.innerHTML = `
      <button class="skip" data-skip>К содержанию</button>
      <div class="topline"><div class="wrap"><span class="tl-info">${esc(S.operator)} · Барнаул · доставка по России</span>
        <span class="vswitch" role="group" aria-label="Вариант дизайна"><span class="vs-l">Дизайн:</span><button data-variant="a" aria-pressed="${v === "a"}">А: графит</button><button data-variant="b" aria-pressed="${v === "b"}">Б: белый</button></span>
        <span class="tl-contacts"><a href="${tel}">${esc(S.phone)}</a><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></span></div></div>
      <header class="site"><div class="wrap">
        <a class="brand" href="#/"><span class="mark" aria-hidden="true">РР</span><span class="brand-t"><b>${esc(S.name)}</b><span>${esc(S.tagline)}</span></span></a>
        <nav class="main" id="nav" aria-label="Основное меню">${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</nav>
        <a class="req-link btn" href="#/request" aria-label="Заявка">Заявка <span id="req-count" class="cnt"></span></a>
        <button class="menu-toggle" aria-expanded="false" aria-controls="nav" aria-label="Меню"><span></span><span></span><span></span></button>
      </div></header>
      <main id="main" tabindex="-1"></main>
      <footer class="site"><div class="wrap">
        <div class="f-grid">
          <div><a class="brand" href="#/"><span class="mark" aria-hidden="true">РР</span><span class="brand-t"><b>${esc(S.name)}</b><span>${esc(S.tagline)}</span></span></a>
            <p>Поставка и ремонт судовых реверс-редукторов РР-300, РР-238, 3Д6, 3Д12.</p></div>
          <div><h4>Каталог</h4><a href="#/model/rr300">РР-300</a><a href="#/model/rr238">РР-238</a><a href="#/model/3d6">3Д6</a><a href="#/model/3d12">3Д12</a><a href="#/catalog">Все запчасти</a></div>
          <div><h4>Компания</h4><a href="#/about">О компании</a><a href="#/services">Услуги</a><a href="#/docs">Документация</a><a href="#/delivery">Доставка и оплата</a><a href="#/contacts">Контакты</a></div>
          <div><h4>Контакты</h4><a href="${tel}">${esc(S.phone)}</a><a href="mailto:${esc(S.email)}">${esc(S.email)}</a><span>${esc(S.address)}</span></div>
        </div>
        <div class="f-bottom"><span>© ${new Date().getFullYear()} ${esc(S.operator)}, ИНН ${S.inn}, ОГРН ${S.ogrn}</span>
          <span><a href="#/legal">Политика ПДн</a><a href="#/legal/cookies">Cookie</a><a href="#/legal/seller">Сведения о продавце</a></span></div>
        <p class="f-demo">Демонстрационная версия сайта. Цены ${esc(S.priceNote)} носят справочный характер и не являются публичной офертой.</p>
      </div></footer>`;
    renderReqCount();
    if (!consent) cookieBanner(true); else loadMetrika();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.skip !== undefined) { $("main").focus(); return; }
    if (t.dataset.variant) { store.set("variant", t.dataset.variant); document.documentElement.dataset.variant = t.dataset.variant; document.querySelectorAll(".vswitch button").forEach(b => b.setAttribute("aria-pressed", b.dataset.variant === t.dataset.variant)); render(); }
    else if (t.dataset.consent) { if (t.dataset.consent === "reset") cookieBanner(true); else { setConsent(t.dataset.consent === "all"); if (parseHash().parts[0] === "legal") render(); } }
    else if (t.classList.contains("menu-toggle")) { const n = $("nav.main"); n.classList.toggle("open"); t.setAttribute("aria-expanded", n.classList.contains("open")); }
    else if (t.dataset.href) go(t.dataset.href.slice(1));
    else if (t.dataset.step) { const i = $("#qty"); i.value = Math.max(1, (parseInt(i.value, 10) || 1) + +t.dataset.step); }
    else if (t.dataset.add) {
      const p = byId[t.dataset.add], qi = t.dataset.qtyFrom ? $(t.dataset.qtyFrom) : null;
      addReq({ key: p.id, id: p.id, sku: p.sku, qty: Math.max(1, parseInt(qi?.value, 10) || 1) });
    } else if (t.dataset.addRow) {
      const [fig, pos, vi] = t.dataset.addRow.split("|").map(Number), n = nodeByFig[fig], r = n.rows[pos - 1];
      const vname = n.variants[vi] === "-" ? n.base : n.base + n.variants[vi];
      const from = `рис. ${fig}, поз. ${pos}${n.variants.length > 1 ? ", исп. " + vname : ""}`;
      addReq(r.product ? { key: r.product, id: r.product, sku: byId[r.product].sku, qty: r.qty[vi], nodeQty: r.qty[vi], from }
        : { key: `des:${r.designation}|${r.name}`, designation: r.designation, name: r.name, qty: r.qty[vi], nodeQty: r.qty[vi], from });
    } else if (t.dataset.thumb) {
      $("#main-img img").src = t.dataset.thumb; t.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === t));
    } else if (t.dataset.reqDel !== undefined) { req.splice(+t.dataset.reqDel, 1); saveReq(); render(); }
    else if (t.dataset.reqClear !== undefined) { req = []; saveReq(); render(); }
    else if (t.dataset.reqCopy !== undefined) {
      const txt = $("#req-text").value;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Перечень скопирован"), () => toast("Не удалось скопировать: выделите таблицу вручную"));
    }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.nav !== undefined) go(t.value.slice(1));
    else if (t.dataset.navCheck) go(t.dataset.navCheck.slice(1));
    else if (t.dataset.reqQty !== undefined) { req[+t.dataset.reqQty].qty = Math.max(1, parseInt(t.value, 10) || 1); t.value = req[+t.dataset.reqQty].qty; saveReq(); }
  });
  document.addEventListener("submit", e => {
    const f = e.target; e.preventDefault();
    if (f.hasAttribute("data-demo-form")) { // demo: nothing is sent or stored
      if (!$("#f-consent").checked) { toast("Отметьте согласие на обработку персональных данных"); return; }
      toast("Демо-версия: заявка не отправлена. На рабочем сайте она придёт на почту компании."); return;
    }
    if (!f.hasAttribute("data-search")) return;
    const fd = new FormData(f);
    go("/catalog?" + new URLSearchParams([...fd].filter(([, v]) => v)).toString());
  });
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

  shell(); render();
  window.__app = { norm, loose }; // used by tests
})();
