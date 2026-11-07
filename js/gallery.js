/* gallery.js - Icon helper + Lightbox (xem ảnh, phóng to/thu nhỏ, chuyển ảnh) */
(function () {
  "use strict";

  /* ---------- Icons (Lucide-style, inline SVG, không cần tải thư viện) ---------- */
  const ICONS = {
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    "zoom-in": '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
    "zoom-out": '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>',
    "external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    "alert-circle": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
  };

  function icon(name) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }

  function renderIcons(root) {
    (root || document).querySelectorAll("i[data-icon]").forEach(function (el) {
      if (el.dataset.done) return;
      el.innerHTML = icon(el.dataset.icon);
      el.dataset.done = "1";
    });
  }

  /* ---------- Lightbox ---------- */
  const MIN_ZOOM = 1, MAX_ZOOM = 5, STEP = 0.5;

  const el = {};
  let items = [];     // [{name, src}]
  let index = 0;
  let scale = 1, tx = 0, ty = 0;
  let lastFocus = null;

  function qs(id) { return document.getElementById(id); }

  function initLightbox() {
    el.box = qs("lightbox");
    el.stage = qs("lb-stage");
    el.img = qs("lb-img");
    el.name = qs("lb-name");
    el.count = qs("lb-count");
    el.spinner = qs("lb-spinner");
    el.error = qs("lb-error");
    el.zoomIn = qs("lb-zoom-in");
    el.zoomOut = qs("lb-zoom-out");
    el.reset = qs("lb-reset");
    el.close = qs("lb-close");
    el.prev = qs("lb-prev");
    el.next = qs("lb-next");
    el.original = qs("lb-original");
    el.download = qs("lb-download");

    el.close.addEventListener("click", close);
    el.prev.addEventListener("click", function () { go(-1); });
    el.next.addEventListener("click", function () { go(1); });
    el.zoomIn.addEventListener("click", function () { setScale(scale + STEP); });
    el.zoomOut.addEventListener("click", function () { setScale(scale - STEP); });
    el.reset.addEventListener("click", function () { setScale(1); });
    el.download.addEventListener("click", function (e) {
      e.preventDefault();
      downloadImage(items[index].src, items[index].name);
    });

    // Bấm vào vùng nền (ngoài ảnh) để đóng khi chưa zoom
    el.stage.addEventListener("click", function (e) {
      if (e.target === el.stage && scale === 1 && !moved) close();
    });

    // Phím tắt
    document.addEventListener("keydown", function (e) {
      if (el.box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "+" || e.key === "=") setScale(scale + STEP);
      else if (e.key === "-") setScale(scale - STEP);
      else if (e.key === "0") setScale(1);
      else if (e.key === "Tab") trapFocus(e);
    });

    // Lăn chuột để zoom
    el.stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      setScale(scale + (e.deltaY < 0 ? STEP : -STEP));
    }, { passive: false });

    // Double click / double tap để zoom
    el.stage.addEventListener("dblclick", function () {
      setScale(scale > 1 ? 1 : 2.5);
    });

    initPointerGestures();

    el.img.addEventListener("load", function () {
      el.spinner.hidden = true;
      el.error.hidden = true;
      el.img.classList.add("ready");
    });
    el.img.addEventListener("error", function () {
      el.spinner.hidden = true;
      el.img.classList.remove("ready");
      el.error.hidden = false;
    });
  }

  function trapFocus(e) {
    const focusables = el.box.querySelectorAll("button:not(:disabled), a[href]");
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ----- Kéo (pan) + pinch zoom bằng Pointer Events ----- */
  const pointers = new Map();
  let startDist = 0, startScale = 1;
  let panStart = null;
  let moved = false;

  function initPointerGestures() {
    el.stage.addEventListener("pointerdown", function (e) {
      el.stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 1) {
        panStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      } else if (pointers.size === 2) {
        startDist = pointerDistance();
        startScale = scale;
        panStart = null;
      }
    });

    el.stage.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && startDist > 0) {
        moved = true;
        setScale(startScale * (pointerDistance() / startDist));
      } else if (pointers.size === 1 && panStart && scale > 1) {
        const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        tx = panStart.tx + dx;
        ty = panStart.ty + dy;
        clampPan();
        applyTransform();
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);

      // Vuốt ngang để chuyển ảnh khi chưa zoom
      if (wasSingle && panStart && scale === 1 && e.type === "pointerup") {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          moved = true;
          go(dx < 0 ? 1 : -1);
        }
      }
      if (pointers.size < 2) startDist = 0;
      if (pointers.size === 1) {
        const p = pointers.values().next().value;
        panStart = { x: p.x, y: p.y, tx: tx, ty: ty };
      } else {
        panStart = null;
      }
      // reset cờ moved sau một nhịp để click không bị nuốt nhầm
      setTimeout(function () { moved = false; }, 0);
    }
    el.stage.addEventListener("pointerup", endPointer);
    el.stage.addEventListener("pointercancel", endPointer);
  }

  function pointerDistance() {
    const pts = Array.from(pointers.values());
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function clampPan() {
    // Giới hạn kéo để ảnh không bị trôi hẳn ra ngoài màn hình
    const w = el.img.clientWidth * scale;
    const h = el.img.clientHeight * scale;
    const maxX = Math.max(0, (w - el.stage.clientWidth) / 2);
    const maxY = Math.max(0, (h - el.stage.clientHeight) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function setScale(value) {
    scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
    if (scale === 1) { tx = 0; ty = 0; }
    clampPan();
    applyTransform();
  }

  function applyTransform() {
    el.img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    el.reset.textContent = Math.round(scale * 100) + "%";
    el.zoomIn.disabled = scale >= MAX_ZOOM;
    el.zoomOut.disabled = scale <= MIN_ZOOM;
    el.stage.style.cursor = scale > 1 ? "grab" : "zoom-in";
  }

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    scale = 1; tx = 0; ty = 0;
    applyTransform();

    el.name.textContent = item.name;
    el.count.textContent = (index + 1) + " / " + items.length;
    el.original.href = item.src;
    el.download.href = item.src;
    el.download.setAttribute("download", fileName(item.src));

    el.prev.disabled = el.next.disabled = items.length < 2;

    el.error.hidden = true;
    el.spinner.hidden = false;
    el.img.classList.remove("ready");
    el.img.alt = item.name;
    el.img.src = item.src;

    // Tải trước ảnh kế bên để chuyển ảnh mượt hơn
    if (items.length > 1) {
      [index + 1, index - 1].forEach(function (n) {
        const p = new Image();
        p.src = items[(n + items.length) % items.length].src;
      });
    }
  }

  function go(step) {
    if (items.length < 2) return;
    show(index + step);
  }

  function open(list, start) {
    if (!el.box) initLightbox();
    items = list;
    lastFocus = document.activeElement;
    el.box.hidden = false;
    document.body.classList.add("no-scroll");
    show(start || 0);
    el.close.focus();
  }

  function close() {
    el.box.hidden = true;
    document.body.classList.remove("no-scroll");
    el.img.removeAttribute("src");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- Tải ảnh ---------- */
  function fileName(src) {
    try { return decodeURIComponent(src.split("?")[0].split("/").pop()) || "dap-an.png"; }
    catch (e) { return "dap-an.png"; }
  }

  // Dùng fetch + blob để buộc trình duyệt tải xuống (thuộc tính download đơn thuần
  // đôi khi không hoạt động trên iOS Safari). Nếu fetch lỗi thì mở ảnh ở tab mới.
  function downloadImage(src, name) {
    const fname = fileName(src);
    fetch(src)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
      .then(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      })
      .catch(function () { window.open(src, "_blank", "noopener"); });
  }

  window.Gallery = {
    icon: icon,
    renderIcons: renderIcons,
    open: open,
    close: close,
    download: downloadImage
  };

  document.addEventListener("DOMContentLoaded", function () {
    renderIcons();
    initLightbox();
  });
})();
