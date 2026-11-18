(function () {
  "use strict";

  const data = window.ANIME_DATA;
  if (!data) return;

  const sections = data.sections;

  const $ = (selector) => document.querySelector(selector);

  function isLive(item) {
    return !item.expiresAt || Date.parse(item.expiresAt) > Date.now();
  }

  function countText(section, count) {
    const unit = section.countUnit || ["entry", "entries"];
    return `${count} ${count === 1 ? unit[0] : unit[1]}`;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const navLabels = {
    "currently-watching": "Now",
    queue: "Queue",
    peak: "Peak",
    "perfect-10": "Perfect 10",
    "top-95": "Top 9.5",
    "loved-9": "Loved 9",
    "liked-8": "Liked 8",
    mid: "Mid",
    dropped: "Dropped",
    "not-watched": "Not yet",
    "one-piece": "One Piece",
    "live-action": "Live action",
    totals: "Totals",
    taste: "Taste"
  };

  const allCards = new Map();
  data.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (isLive(item)) allCards.set(item.id, item);
    });
  });

  function posterMarkup(item, eager) {
    const badge = item.badge ? `<span class="badge">${esc(item.badge)}</span>` : "";
    const percent =
      Array.isArray(item.progress) && item.progress[1] > 0
        ? Math.min(100, (item.progress[0] / item.progress[1]) * 100)
        : null;
    const progress =
      percent === null
        ? ""
        : `<span class="progress" aria-hidden="true"><span style="width:${percent.toFixed(2)}%"></span></span>`;

    if (item.image) {
      return `<span class="poster">
        <img src="${esc(item.image)}" alt="${esc(item.title)} poster" ${eager ? "" : 'loading="lazy"'} width="700" height="1050" decoding="async">
        ${badge}${progress}
      </span>`;
    }

    return `<span class="poster poster--empty">
      <span class="empty-mark" aria-hidden="true">${esc(item.emptyMark)}</span>
      <span class="empty-label">${esc(item.emptyLabel)}</span>
      ${badge}${progress}
    </span>`;
  }

  function cardMarkup(item, eager) {
    return `<button class="card" type="button" data-card="${esc(item.id)}"${item.expiresAt ? ` data-expires="${esc(item.expiresAt)}"` : ""} aria-label="Open details for ${esc(item.title)}">
      ${posterMarkup(item, eager)}
      <span class="card-title">${esc(item.shortTitle || item.title)}</span>
      <span class="card-meta">${esc(item.meta)}</span>
    </button>`;
  }

  function renderShell() {
    $("#profile").textContent = data.meta.profile;
    $("#time-note").textContent = data.meta.timeNote;
    $("#hero-date").textContent = data.meta.date;

    $("#hero-stats").innerHTML = data.heroStats
      .map(
        (stat) => `<div class="stat">
          <strong>${esc(stat.value)}</strong>
          <span>${esc(stat.label)}</span>
        </div>`
      )
      .join("");

    const navItems = [
      ...data.sections.map((section, index) => ({
        id: section.id,
        label: navLabels[section.id] || section.title,
        num: String(index + 1).padStart(2, "0")
      })),
      { id: "totals", label: navLabels.totals, num: String(data.sections.length + 1).padStart(2, "0") },
      { id: "taste", label: navLabels.taste, num: String(data.sections.length + 2).padStart(2, "0") }
    ];

    $("#nav").innerHTML = navItems
      .map(
        (item) => `<a href="#${esc(item.id)}"><span class="nav-num" aria-hidden="true">${esc(item.num)}</span>${esc(item.label)}</a>`
      )
      .join("");
  }

  function renderSections() {
    const host = $("#sections");
    host.innerHTML = data.sections
      .map((section, sectionIndex) => {
        const classes = ["section"];
        if (section.feature) classes.push("section--feature");
        if (section.muted) classes.push("section--muted");

        const items = section.items.filter(isLive);
        const cards = items
          .map((item, index) => cardMarkup(item, sectionIndex === 0 && index < 8))
          .join("");

        return `<section class="${classes.join(" ")}" id="${esc(section.id)}" style="--accent:${esc(section.accent)}">
          <header class="section-head">
            <div class="section-kicker">${String(sectionIndex + 1).padStart(2, "0")}</div>
            <div class="section-heading">
              <h2>${esc(section.title)}</h2>
              ${section.subtitle ? `<p>${esc(section.subtitle)}</p>` : ""}
            </div>
            <div class="section-count">${esc(items.length === section.items.length ? section.tag : countText(section, items.length))}</div>
          </header>
          <div class="grid">${cards}</div>
          ${section.footer ? `<p class="section-footnote">${esc(section.footer)}</p>` : ""}
        </section>`;
      })
      .join("");
  }

  function renderTotals() {
    $("#total-stats").innerHTML = data.totals.stats
      .map(
        (stat) => `<div class="stat-card">
          <strong>${esc(stat.value)}</strong>
          <span>${esc(stat.label)}</span>
        </div>`
      )
      .join("");

    const hoursStat = data.totals.stats.find((stat) => /hours/i.test(stat.label));
    if (hoursStat) $("#bars-total").textContent = `${hoursStat.value} hours total`;

    const max = Math.max(...data.totals.bars.map((bar) => bar.hours));
    $("#bars").innerHTML = data.totals.bars
      .map(
        (bar) => `<div class="bar-row" style="--accent:${esc(bar.accent)}">
          <span class="bar-label">${esc(bar.label)}</span>
          <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${((bar.hours / max) * 100).toFixed(2)}%"></span></span>
          <span class="bar-value">${esc(bar.display)}</span>
        </div>`
      )
      .join("");

    $("#total-notes").innerHTML = data.totals.notes
      .map((note) => `<li>${esc(note)}</li>`)
      .join("");
  }

  function renderTaste() {
    $("#taste-yes").innerHTML = data.taste.yes.map((item) => `<li>${esc(item)}</li>`).join("");
    $("#taste-no").innerHTML = data.taste.no.map((item) => `<li>${esc(item)}</li>`).join("");
    $("#taste-note").textContent = data.taste.note;
  }

  const modal = $("#modal");
  const panel = modal.querySelector(".modal-panel");
  const banner = $("#modal-banner");
  const heroEmpty = $("#modal-hero-empty");
  const posterHost = $("#modal-poster");
  let lastFocused = null;
  let closeTimer = null;
  let currentCardId = null;

  function formatLabel(format) {
    if (!format) return "";
    if (format === "MOVIE") return "Film";
    if (format === "TV") return "TV";
    if (format === "ONA") return "ONA";
    if (format === "OVA") return "OVA";
    if (format === "SPECIAL") return "Special";
    return format.charAt(0) + format.slice(1).toLowerCase();
  }

  function chip(text, extraClass) {
    return `<span class="chip${extraClass ? " " + extraClass : ""}">${esc(text)}</span>`;
  }

  function openModal(id) {
    const item = allCards.get(id);
    if (!item) return;
    currentCardId = id;

    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }

    lastFocused = document.activeElement;
    panel.style.setProperty("--accent", item.accent);
    modal.hidden = false;
    document.body.classList.add("no-scroll");

    if (item.banner) {
      banner.src = item.banner;
      banner.alt = `${item.title} key art`;
      banner.hidden = false;
      heroEmpty.classList.remove("is-visible");
      heroEmpty.innerHTML = "";
    } else {
      banner.removeAttribute("src");
      banner.hidden = true;
      heroEmpty.classList.add("is-visible");
      heroEmpty.innerHTML = `<span class="empty-mark" aria-hidden="true">${esc(item.emptyMark)}</span>`;
    }

    if (item.image) {
      posterHost.classList.remove("is-empty");
      posterHost.innerHTML = `<img src="${esc(item.image)}" alt="${esc(item.title)} poster" width="700" height="1050">`;
    } else {
      posterHost.classList.add("is-empty");
      posterHost.innerHTML = `<span class="empty-mark" aria-hidden="true">${esc(item.emptyMark)}</span><span class="empty-label">${esc(item.emptyLabel)}</span>`;
    }

    $("#modal-section").textContent = item.sectionTitle;
    $("#modal-title").textContent = item.title;
    $("#modal-alt").textContent = item.alt || "";

    const chips = [item.meta];
    const format = formatLabel(item.info.format);
    if (format && item.info.year) chips.push(`${format} · ${item.info.year}`);
    else if (format) chips.push(format);
    (item.info.genres || []).slice(0, 3).forEach((genre) => chips.push(genre));

    $("#modal-chips").innerHTML = chips
      .map((text, index) => chip(text, index >= 4 ? "chip--genre" : ""))
      .join("");

    const noteBlock = $("#modal-note");
    if (item.note) {
      noteBlock.hidden = false;
      $("#modal-note-text").textContent = item.note;
    } else {
      noteBlock.hidden = true;
    }

    const aboutBlock = $(".modal-about");
    if (item.synopsis) {
      aboutBlock.hidden = false;
      $("#modal-synopsis").textContent = item.synopsis;
    } else {
      aboutBlock.hidden = true;
    }

    const gallery = $("#modal-gallery");
    const galleryGrid = $("#gallery-grid");
    const pictures = [];
    if (item.image) pictures.push({ src: item.image, label: "Poster" });
    if (item.banner && item.banner !== item.image) pictures.push({ src: item.banner, label: "Key art" });

    if (pictures.length) {
      gallery.hidden = false;
      galleryGrid.classList.toggle("is-single", pictures.length === 1);
      galleryGrid.innerHTML = pictures
        .map(
          (picture) => `<a class="gallery-item" href="${esc(picture.src)}" target="_blank" rel="noopener">
            <img src="${esc(picture.src)}" alt="${esc(item.title)} ${esc(picture.label.toLowerCase())}" loading="lazy">
            <span>${esc(picture.label)}</span>
          </a>`
        )
        .join("");
    } else {
      gallery.hidden = true;
    }

    const foot = $("#modal-foot");
    const native = item.info.native || item.info.romaji || "";
    const hasNative = Boolean(native && native !== item.title);
    const hasLink = Boolean(item.info.siteUrl);
    const nativeLine = hasNative ? `<span class="native">${esc(native)}</span>` : "<span></span>";
    const link = hasLink
      ? `<a href="${esc(item.info.siteUrl)}" target="_blank" rel="noopener">View on AniList ↗</a>`
      : "";
    foot.hidden = !hasNative && !hasLink;
    foot.innerHTML = `${nativeLine}${link}`;

    panel.scrollTop = 0;
    modal.querySelector(".modal-close").focus({ preventScroll: true });
  }

  function closeModal() {
    if (modal.hidden) return;
    currentCardId = null;
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    if (banner.src) banner.removeAttribute("src");
    posterHost.innerHTML = "";
    $("#gallery-grid").innerHTML = "";
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
  }

  function setupModal() {
    $("#sections").addEventListener("click", (event) => {
      const card = event.target.closest("[data-card]");
      if (card) openModal(card.dataset.card);
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
        (element) => element.offsetParent !== null
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function setupNavHighlight() {
    const sections = [...document.querySelectorAll("main section[id]")];
    const links = new Map(
      [...document.querySelectorAll(".nav a")].map((link) => [link.getAttribute("href").slice(1), link])
    );

    let ticking = false;

    function update() {
      const marker = window.scrollY + 150;
      let currentId = sections.length ? sections[0].id : null;

      const atBottom =
        Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;

      if (atBottom) {
        currentId = sections.length ? sections[sections.length - 1].id : currentId;
      } else {
        for (const section of sections) {
          if (section.offsetTop <= marker) currentId = section.id;
        }
      }

      links.forEach((link, id) => {
        const active = id === currentId;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
  }

  function setupCountdowns() {
    const nodes = [...document.querySelectorAll("[data-expires]")];
    if (!nodes.length) return;

    function updateSectionCount(section) {
      if (!section) return;
      const countEl = section.querySelector(".section-count");
      const grid = section.querySelector(".grid");
      if (!countEl || !grid) return;
      const source = sections.find((entry) => entry.id === section.id);
      countEl.textContent = countText(source || {}, grid.querySelectorAll(".card").length);
    }

    function removeExpired(node) {
      const card = node.closest(".card");
      if (!card) {
        node.remove();
        return;
      }
      const id = card.dataset.card;
      const section = card.closest("section");
      card.remove();
      node.remove();
      if (currentCardId === id) closeModal();
      updateSectionCount(section);
    }

    function tick() {
      nodes.forEach((node) => {
        if (!node.isConnected) return;
        const remaining = Date.parse(node.dataset.expires) - Date.now();
        if (remaining <= 0) removeExpired(node);
      });
    }

    tick();
    window.setInterval(tick, 1000);
  }

  renderShell();
  renderSections();
  renderTotals();
  renderTaste();
  setupModal();
  setupNavHighlight();
  setupCountdowns();
})();
