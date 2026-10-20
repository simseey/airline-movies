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
  var PKEY = KEY + ":posters";
  var posters = {};
  try { posters = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) {}
  function savePosters() { try { localStorage.setItem(PKEY, JSON.stringify(posters)); } catch (e) {} }

  // ---------- data ----------
  function slug(t, y) { return (t + "-" + (y || "")).toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
  function sortKey(t) {
    return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^[^a-z0-9]+/, "");
  }
  function letterOf(k) { var c = k.charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; }

  function build() {
    var list = RAW.map(function (r) {
      return { t: r[0], y: r[1], c: r[2], g: r[3], d: r[4], cast: r[5], imdb: r[6], rt: r[7], isNew: !!r[8], dur: r[9] || "", poster: r[10] || "", leaving: !!r[11], custom: false };
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

  // ---------- shared watch list / watched (across all airlines) ----------
  var SKEY = "ifeguide:shared";
  var shared = { watch: {}, seen: {} };
  function loadShared() {
    try { var x = JSON.parse(localStorage.getItem(SKEY)); if (x) shared = { watch: x.watch || {}, seen: x.seen || {} }; } catch (e) {}
  }
  function saveShared() { try { localStorage.setItem(SKEY, JSON.stringify(shared)); } catch (e) {} }
  // Same film can be titled slightly differently by each airline, so match on a normalised title + year (±1).
  function fkey(m) {
    var t = String(m.t).toLowerCase().replace(/’/g, "'").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var y = m.y || "";
    var paren = t.match(/\((\d{4})\)/); if (paren) { if (!y) y = +paren[1]; t = t.replace(paren[0], ""); }
    t = t.replace(/^(disney's|stephen king's|dr\. seuss')\s+/, "")
         .replace(/star wars: episode [ivx]+ - /, "star wars: ")
         .replace("dune: part one", "dune").replace("sorcerer's stone", "philosopher's stone")
         .replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");
    return { n: t, y: y ? +y : "" };
  }
  function variants(m) {
    var k = fkey(m), out = [k.n + "|" + k.y];
    if (k.y) out.push(k.n + "|" + (k.y - 1), k.n + "|" + (k.y + 1), k.n + "|");
    return out;
  }
  function has(map, m) { return variants(m).some(function (v) { return map[v]; }); }
  function setFlag(map, m, on) {
    variants(m).forEach(function (v) { delete map[v]; });
    if (on) { var k = fkey(m); map[k.n + "|" + k.y] = 1; }
  }
  loadShared();
  // One-off move of marks saved by earlier versions, which were stored per airline.
  // Runs on every page for all three airlines, so it doesn't matter which page is opened first.
  function keyFromId(id) {
    var mm = String(id).match(/^(.*?)-(\d{4})?$/); if (!mm) return null;
    var y = mm[2] ? +mm[2] : "";
    var n = mm[1].replace(/-/g, " ").trim();
    if (y && n.slice(-5) === " " + y) n = n.slice(0, -5);
    n = n.replace(/^(disney s|stephen king s|dr seuss)\s+/, "").replace(/^star wars episode [ivx]+ /, "star wars ")
         .replace(/^dune part one$/, "dune").replace("sorcerer s stone", "philosopher s stone").replace(/^the /, "");
    return n + "|" + y;
  }
  (function migrate() {
    var changed = false;
    ["airnz", "ba", "sq"].forEach(function (a) {
      var k = "ifeguide:" + a, old;
      try { old = JSON.parse(localStorage.getItem(k)); } catch (e) { old = null; }
      if (!old) return;
      var moved = false;
      ["watch", "seen"].forEach(function (f) {
        Object.keys(old[f] || {}).forEach(function (id) {
          var m = a === cfg.id ? films.find(function (x) { return x.id === id; }) : null;
          if (m) setFlag(shared[f], m, true);
          else { var kk = keyFromId(id); if (kk) shared[f][kk] = 1; }
          moved = true;
        });
        old[f] = {};
      });
      if (moved) { changed = true; try { localStorage.setItem(k, JSON.stringify(old)); } catch (e) {} }
    });
    if (changed) { saveShared(); state = load(); }
  })();
  function isW(m) { return has(shared.watch, m); }
  function isS(m) { return has(shared.seen, m); }

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
    if (view === "watch" && !isW(m)) return false;
    if (view === "seen" && !isS(m)) return false;
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

  var HUES = { Action: 8, Thriller: 350, Horror: 330, Crime: 20, Comedy: 42, Romance: 340, Drama: 215,
    Animation: 165, Family: 140, Fantasy: 275, "Sci-Fi": 195, Adventure: 30, Documentary: 100, Music: 300,
    Musical: 300, Biography: 230, History: 35, War: 60, Sport: 120, Western: 25, Mystery: 255, Concert: 300 };
  function hueFor(m) {
    var g = (m.g || "").split(",")[0].trim();
    if (HUES[g] != null) return HUES[g];
    var h = 0; for (var i = 0; i < m.t.length; i++) h = (h * 31 + m.t.charCodeAt(i)) % 360; return h;
  }
  function initials(t) {
    var w = t.replace(/^(the|a|an)\s+/i, "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/);
    return ((w[0] || "").charAt(0) + (w[1] ? w[1].charAt(0) : "")).toUpperCase();
  }
  function thumbHTML(m) {
    var url = posters[m.id] || m.poster;
    return '<div class="thumb" style="--h:' + hueFor(m) + '" aria-hidden="true"><span>' + esc(initials(m.t)) + "</span>" +
      (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + "</div>";
  }

  function cardHTML(m) {
    var w = isW(m), s = isS(m);
    var meta = [m.y, m.c && m.c !== "NotRated" ? m.c : "", m.dur, m.g].filter(Boolean).join(", ");
    var q = encodeURIComponent(m.t + (m.y ? " " + m.y : ""));
    return '<article class="film' + (s ? " is-watched" : "") + (openId === m.id ? " open" : "") + '" data-id="' + m.id + '">' +
      '<button class="film-body" data-act="toggle" aria-expanded="' + (openId === m.id) + '">' +
        thumbHTML(m) +
        '<div class="film-text">' +
          '<div class="film-title">' + esc(m.t) + (m.isNew ? '<span class="badge-new">New</span>' : "") + (m.leaving ? '<span class="badge-leave">Leaving soon</span>' : "") + "</div>" +
          '<div class="meta">' + esc(meta) + "</div>" +
          (m.d ? '<p class="desc">' + esc(m.d) + "</p>" : "") +
        "</div>" +
      "</button>" +
      '<div class="film-foot">' +
        '<div class="ratings">' + ratingsHTML(m) + "</div>" +
        '<div class="actions">' +
          '<button class="act watch" data-act="watch" aria-pressed="' + w + '" aria-label="' + (w ? "Remove from watch list" : "Add to watch list") + '">' + (w ? ICON_BOOKMARK_ON : ICON_BOOKMARK) + "</button>" +
          '<button class="act seen" data-act="seen" aria-pressed="' + s + '" aria-label="' + (s ? "Mark as not watched" : "Mark as watched") + '">' + ICON_CHECK + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="details">' +
        (m.cast ? '<p class="cast"><strong>Cast:</strong> ' + esc(m.cast) + "</p>" : '<p class="cast">No cast details yet.</p>') +
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
    $("#c-watch").textContent = films.filter(isW).length;
    $("#c-seen").textContent = films.filter(isS).length;
  }

  function updateCard(id) {
    var el = listEl.querySelector('[data-id="' + id + '"]');
    var m = films.find(function (f) { return f.id === id; });
    if (!m) return;
    if ((view === "watch" || view === "seen") && !matches(m)) { render(); return; }
    if (el) el.outerHTML = cardHTML(m);
    $("#c-watch").textContent = films.filter(isW).length;
    $("#c-seen").textContent = films.filter(isS).length;
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
      var fw = films.find(function (f) { return f.id === id; });
      setFlag(shared.watch, fw, !isW(fw)); saveShared(); updateCard(id);
    } else if (act === "seen") {
      var fs = films.find(function (f) { return f.id === id; });
      setFlag(shared.seen, fs, !isS(fs)); saveShared(); updateCard(id);
    } else if (act === "delete") {
      if (!confirm("Delete this movie from the list?")) return;
      state.custom = state.custom.filter(function (m) { return slug(m.t, m.y) !== id; });
      var fd = films.find(function (f) { return f.id === id; });
      if (fd) { setFlag(shared.watch, fd, false); setFlag(shared.seen, fd, false); saveShared(); }
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

  // ---------- posters ----------
  var pBtn = $("#posterBtn"), pStatus = $("#posterStatus");
  function norm(t) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function cleanTitle(t) { return t.replace(/[“”"™]/g, "").replace(/\s+Reo M[aā]ori$/i, "").replace(/\s*\(\d{4}\)$/, "").trim(); }
  function lookup(m) {
    var title = cleanTitle(m.t);
    var q = title + (m.y ? " " + m.y : "") + " film";
    var url = "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=0&gsrlimit=1" +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=240&pilicense=any&gsrsearch=" + encodeURIComponent(q);
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var pages = j && j.query && j.query.pages; if (!pages) return "";
      var p = pages[Object.keys(pages)[0]];
      if (!p || !p.thumbnail) return "";
      var words = norm(title).split(" ").filter(function (x) { return x.length > 2 && ["the", "and", "movie"].indexOf(x) === -1; });
      var pt = norm(p.title);
      if (words.length && !words.some(function (x) { return pt.indexOf(x) !== -1; })) return "";
      return p.thumbnail.source;
    }).catch(function () { return null; });
  }
  function cacheImage(url) {
    if (!("caches" in window) || !url) return Promise.resolve();
    return caches.open("flight-films-posters").then(function (c) {
      return c.match(url).then(function (hit) { if (!hit) return c.add(url).catch(function () { return fetch(url, { mode: "no-cors" }).then(function (r) { return c.put(url, r); }); }).catch(function () {}); });
    }).catch(function () {});
  }
  function updatePosterUI() {
    var have = films.filter(function (m) { return posters[m.id] || m.poster; }).length;
    if (pStatus) pStatus.textContent = have ? have + " of " + films.length + " films have posters saved." : "Posters are not downloaded yet.";
    if (pBtn) pBtn.textContent = "Reload all posters";
  }
  // Fetch posters automatically in the background whenever online.
  var running = false;
  function setThumb(m) {
    var card = listEl.querySelector('[data-id="' + m.id + '"] .thumb');
    if (card) card.outerHTML = thumbHTML(m);
  }
  function fetchPosters(force) {
    if (running || !navigator.onLine) { if (!navigator.onLine && force) pStatus.textContent = "Connect to the internet to load posters."; return; }
    var queue = films.filter(function (m) { return !m.custom && !m.poster && (force || !(m.id in posters)); });
    if (!queue.length) { updatePosterUI(); return; }
    running = true; if (pBtn) pBtn.disabled = true;
    var total = queue.length, done = 0, found = 0, failed = 0;
    var bar = $("#posterBar");
    function show() {
      var msg = "Loading posters… " + done + " of " + total;
      if (bar) { bar.textContent = msg; bar.hidden = false; }
      pStatus.textContent = msg;
    }
    show();
    function next() {
      var m = queue.shift(); if (!m) return Promise.resolve();
      return lookup(m).then(function (url) {
        if (url === null) failed++;
        else { posters[m.id] = url; if (url) { found++; setThumb(m); } }
        return url ? cacheImage(url) : null;
      }).then(function () {
        done++; show();
        if (done % 20 === 0) savePosters();
        if (done === 12 && failed === 12) { queue.length = 0; }
        return next();
      });
    }
    var workers = []; for (var i = 0; i < 4; i++) workers.push(next());
    Promise.all(workers).then(function () {
      savePosters(); running = false; if (pBtn) pBtn.disabled = false;
      if (bar) bar.hidden = true;
      updatePosterUI();
      if (failed && !found) {
        pStatus.textContent = "Couldn’t reach Wikipedia to load posters. They’ll try again next time you open this page online.";
        if (bar) { bar.textContent = "Posters couldn’t load. They’ll retry next time you’re online."; bar.hidden = false; }
      }
    });
  }
  if (pBtn) pBtn.addEventListener("click", function () { fetchPosters(true); });
  window.addEventListener("online", function () { fetchPosters(false); });

  window.addEventListener("pageshow", function (e) { if (e.persisted) { loadShared(); render(); } });
  window.addEventListener("storage", function (e) { if (e.key === SKEY) { loadShared(); render(); } });

  setHead();
  render();
  updatePosterUI();
  setTimeout(function () { fetchPosters(false); }, 800);
  if (navigator.onLine) setTimeout(function () {
    var list = films.filter(function (m) { return m.poster; }).map(function (m) { return m.poster; });
    (function step(i) { if (i >= list.length) return; Promise.all(list.slice(i, i + 6).map(cacheImage)).then(function () { step(i + 6); }); })(0);
  }, 2500);
  requestAnimationFrame(setHead);

  // offline support
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
