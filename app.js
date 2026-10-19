(function () {
  "use strict";
  var cfg = window.AIRLINE;
  var RAW = window.MOVIES || [];
  var KEY = "ifeguide:" + cfg.id;

  // ---------- storage ----------
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object") return { watch: s.watch || {}, seen: s.seen || {}, custom: s.custom || [] };
    } catch (e) {}
    return { watch: {}, seen: {}, custom: [] };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  var state = load();

  // ---------- data ----------
  function slug(t, y) { return (t + "-" + (y || "")).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
  function sortKey(t) {
    return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^[^a-z0-9]+/, "");
  }
  function letterOf(k) { var c = k.charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; }

  function build() {
    var list = RAW.map(function (r) {
      return { t: r[0], y: r[1], c: r[2], g: r[3], d: r[4], cast: r[5], imdb: r[6], rt: r[7], isNew: !!r[8], dur: r[9] || "", custom: false };
    });
    state.custom.forEach(function (m) { list.push(Object.assign({}, m, { custom: true })); });
    list.forEach(function (m) { m.id = slug(m.t, m.y); m.k = sortKey(m.t); m.L = letterOf(m.k); });
    list.sort(function (a, b) {
      var al = a.L === "#" ? 0 : 1, bl = b.L === "#" ? 0 : 1;
      if (al !== bl) return al - bl;
      return a.k < b.k ? -1 : a.k > b.k ? 1 : (a.y || 0) - (b.y || 0);
    });
    return list;
  }
  var films = build();

  // ---------- DOM ----------
  var $ = function (s) { return document.querySelector(s); };
  var listEl = $("#list"), searchEl = $("#search"), alphaEl = $("#alpha"), popEl = $("#alphaPop");
  var view = "all", query = "", openId = null;

  var ICON_BOOKMARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  var ICON_BOOKMARK_ON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function matches(m) {
    if (view === "watch" && !state.watch[m.id]) return false;
    if (view === "seen" && !state.seen[m.id]) return false;
    if (view === "new" && !m.isNew) return false;
    if (!query) return true;
    var hay = (m.t + " " + (m.cast || "") + " " + (m.g || "")).toLowerCase();
    return query.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function ratingsHTML(m) {
    var imdb = m.imdb != null && m.imdb !== ""
      ? '<span class="r r-imdb"><b>IMDb</b>' + Number(m.imdb).toFixed(1) + "</span>"
      : '<span class="r r-imdb na"><b>IMDb</b>n/a</span>';
    var rt = m.rt != null && m.rt !== ""
      ? '<span class="r r-rt"><b aria-hidden="true">🍅</b>' + m.rt + "%</span>"
      : '<span class="r r-rt na"><b aria-hidden="true">🍅</b>n/a</span>';
    return imdb + rt;
  }

  function cardHTML(m) {
    var w = !!state.watch[m.id], s = !!state.seen[m.id];
    var meta = [m.y, m.c && m.c !== "NotRated" ? m.c : "", m.dur, m.g].filter(Boolean).join(", ");
    var q = encodeURIComponent(m.t + (m.y ? " " + m.y : ""));
    return '<article class="film' + (s ? " is-watched" : "") + (openId === m.id ? " open" : "") + '" data-id="' + m.id + '">' +
      '<div class="film-main">' +
        '<button class="film-body" data-act="toggle" aria-expanded="' + (openId === m.id) + '">' +
          '<div class="film-title">' + esc(m.t) + (m.isNew ? '<span class="badge-new">New</span>' : "") + "</div>" +
          '<div class="meta">' + esc(meta) + "</div>" +
          '<div class="ratings">' + ratingsHTML(m) + "</div>" +
        "</button>" +
        '<div class="actions">' +
          '<button class="act watch" data-act="watch" aria-pressed="' + w + '" aria-label="' + (w ? "Remove from watch list" : "Add to watch list") + '">' + (w ? ICON_BOOKMARK_ON : ICON_BOOKMARK) + "</button>" +
          '<button class="act seen" data-act="seen" aria-pressed="' + s + '" aria-label="' + (s ? "Mark as not watched" : "Mark as watched") + '">' + ICON_CHECK + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="details">' +
        (m.d ? "<p>" + esc(m.d) + "</p>" : '<p class="cast">No description yet.</p>') +
        (m.cast ? '<p class="cast"><strong>Cast:</strong> ' + esc(m.cast) + "</p>" : "") +
        '<div class="links">' +
          '<a href="https://www.imdb.com/find/?q=' + q + '" target="_blank" rel="noopener">IMDb page</a>' +
          '<a href="https://www.rottentomatoes.com/search?search=' + encodeURIComponent(m.t) + '" target="_blank" rel="noopener">Rotten Tomatoes</a>' +
          (m.custom ? '<button class="danger" data-act="delete">Delete movie</button>' : "") +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function render() {
    var shown = films.filter(matches);
    var html = "", last = null, letters = [];
    shown.forEach(function (m) {
      if (m.L !== last) {
        last = m.L; letters.push(m.L);
        html += '<h2 class="letter" id="L-' + (m.L === "#" ? "num" : m.L) + '">' + m.L + "</h2>";
      }
      html += cardHTML(m);
    });
    if (!shown.length) {
      var msg = view === "watch" ? "Your watch list is empty. Tap the bookmark on any film to add it."
        : view === "seen" ? "Nothing marked as watched yet. Tap the tick on a film once you’ve seen it."
        : query ? "No films match “" + esc(query) + "”. Try a shorter search."
        : "No films here yet.";
      html = '<p class="empty">' + msg + "</p>";
    }
    listEl.innerHTML = html;
    alphaEl.innerHTML = letters.map(function (l) { return "<span>" + l + "</span>"; }).join("");
    alphaEl.style.display = letters.length > 3 ? "" : "none";
    $("#c-all").textContent = films.length;
    $("#c-new").textContent = films.filter(function (m) { return m.isNew; }).length;
    $("#c-watch").textContent = films.filter(function (m) { return state.watch[m.id]; }).length;
    $("#c-seen").textContent = films.filter(function (m) { return state.seen[m.id]; }).length;
  }

  function updateCard(id) {
    var el = listEl.querySelector('[data-id="' + id + '"]');
    var m = films.find(function (f) { return f.id === id; });
    if (!m) return;
    if ((view === "watch" || view === "seen") && !matches(m)) { render(); return; }
    if (el) el.outerHTML = cardHTML(m);
    $("#c-watch").textContent = films.filter(function (f) { return state.watch[f.id]; }).length;
    $("#c-seen").textContent = films.filter(function (f) { return state.seen[f.id]; }).length;
  }

  listEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var card = btn.closest(".film"), id = card.dataset.id, act = btn.dataset.act;
    if (act === "toggle") {
      openId = openId === id ? null : id;
      var prev = listEl.querySelector(".film.open");
      if (prev && prev !== card) { prev.classList.remove("open"); prev.querySelector(".film-body").setAttribute("aria-expanded", "false"); }
      card.classList.toggle("open", openId === id);
      btn.setAttribute("aria-expanded", String(openId === id));
    } else if (act === "watch") {
      if (state.watch[id]) delete state.watch[id]; else state.watch[id] = 1;
      save(); updateCard(id);
    } else if (act === "seen") {
      if (state.seen[id]) delete state.seen[id]; else state.seen[id] = 1;
      save(); updateCard(id);
    } else if (act === "delete") {
      if (!confirm("Delete this movie from the list?")) return;
      state.custom = state.custom.filter(function (m) { return slug(m.t, m.y) !== id; });
      delete state.watch[id]; delete state.seen[id];
      save(); films = build(); render();
    }
  });

  // tabs
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      view = t.dataset.view;
      document.querySelectorAll(".tab").forEach(function (o) { o.setAttribute("aria-selected", String(o === t)); });
      render(); window.scrollTo(0, 0);
    });
  });

  // search
  var timer;
  searchEl.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { query = searchEl.value.trim().toLowerCase(); render(); window.scrollTo(0, 0); }, 120);
  });

  // header height for sticky offsets
  function setHead() {
    document.documentElement.style.setProperty("--head", $(".top").offsetHeight + "px");
  }
  window.addEventListener("resize", setHead);

  // alphabet scrubber
  var popTimer;
  function jump(clientY) {
    var spans = alphaEl.children;
    for (var i = 0; i < spans.length; i++) {
      var r = spans[i].getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom || (i === spans.length - 1 && clientY > r.bottom) || (i === 0 && clientY < r.top)) {
        var L = spans[i].textContent;
        var target = document.getElementById("L-" + (L === "#" ? "num" : L));
        if (target) {
          var y = target.getBoundingClientRect().top + window.scrollY - $(".top").offsetHeight - (parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0);
          window.scrollTo(0, y);
        }
        popEl.textContent = L; popEl.classList.add("show");
        clearTimeout(popTimer);
        popTimer = setTimeout(function () { popEl.classList.remove("show"); }, 500);
        return;
      }
    }
  }
  alphaEl.addEventListener("touchstart", function (e) { jump(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  alphaEl.addEventListener("touchmove", function (e) { jump(e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  alphaEl.addEventListener("click", function (e) { jump(e.clientY); });

  // add movie dialog
  var dlg = $("#addDlg"), form = $("#addForm");
  $("#addBtn").addEventListener("click", function () { form.reset(); dlg.showModal(); });
  $("#addCancel").addEventListener("click", function () { dlg.close(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements, t = f.title.value.trim();
    if (!t) return;
    var num = function (v) { v = String(v).trim(); return v === "" ? null : Number(v); };
    state.custom.push({
      t: t, y: num(f.year.value), c: "", g: f.genre.value.trim(),
      d: f.desc.value.trim(), cast: f.cast.value.trim(),
      imdb: num(f.imdb.value), rt: num(f.rt.value), isNew: f.isnew.checked
    });
    save(); films = build(); dlg.close(); render();
  });

  setHead();
  render();
  requestAnimationFrame(setHead);

  // offline support
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
