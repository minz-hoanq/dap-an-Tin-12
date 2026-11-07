/* app.js - Đọc library.json, vẽ trang chủ / trang chi tiết, tìm kiếm, điều hướng bằng hash */
(function () {
  "use strict";

  const DATA_URL = "data/library.json";
  const app = document.getElementById("app");
  let folders = [];
  let searchTerm = "";

  /* ---------- Tiện ích ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Bỏ dấu tiếng Việt để tìm "trang 50", "bai thuc hanh" đều khớp
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ")
      .trim();
  }

  function folderPath(f) {
    let p = f.path || "";
    if (p && !p.endsWith("/")) p += "/";
    return p;
  }

  // encodeURI để tên file có dấu cách / tiếng Việt vẫn hoạt động; đường dẫn tương đối (không bắt đầu bằng "/")
  function imageSrc(f, img) {
    return encodeURI(folderPath(f).replace(/^\/+/, "") + img.file);
  }

  function getFolder(id) {
    return folders.find(function (f) { return f.id === id; });
  }

  function setTitle(t) {
    document.title = t ? t + " · IT12 Answer Library" : "IT12 Answer Library";
  }

  /* ---------- Tải dữ liệu ---------- */
  function loadData() {
    return fetch(DATA_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.folders)) throw new Error("library.json thiếu mảng \"folders\"");
        folders = data.folders.map(function (f) {
          f.images = Array.isArray(f.images) ? f.images : [];
          return f;
        });
      });
  }

  /* ---------- Trang chủ ---------- */
  function renderHome() {
    setTitle("");
    window.scrollTo(0, 0);
    app.innerHTML =
      '<section class="hero">' +
        "<h1>IT12 <span>Answer</span> Library</h1>" +
        "<p>Thư viện hình ảnh đáp án các bài thực hành Tin học 12.</p>" +
        '<div class="search">' + Gallery.icon("search") +
          '<input id="search" type="search" placeholder="Tìm kiếm bài thực hành..." autocomplete="off" aria-label="Tìm kiếm bài thực hành" value="' + esc(searchTerm) + '">' +
        "</div>" +
      "</section>" +
      '<p class="section-meta" id="result-meta"></p>' +
      '<div id="folder-list"></div>';

    const input = document.getElementById("search");
    input.addEventListener("input", function () {
      searchTerm = input.value;
      renderFolderList();
    });
    renderFolderList();
  }

  function matchFolder(f, q) {
    if (!q) return { ok: true, hits: [] };
    const words = q.split(" ");
    const folderText = norm([f.name, f.description, f.id].join(" "));
    const folderOk = words.every(function (w) { return folderText.indexOf(w) !== -1; });

    const hits = f.images.filter(function (img) {
      const t = norm(img.name + " " + img.file + " " + folderText);
      return words.every(function (w) { return t.indexOf(w) !== -1; });
    });
    return { ok: folderOk || hits.length > 0, hits: folderOk ? [] : hits };
  }

  function renderFolderList() {
    const list = document.getElementById("folder-list");
    const meta = document.getElementById("result-meta");
    const q = norm(searchTerm);

    if (!folders.length) {
      meta.textContent = "";
      list.innerHTML = emptyState("folder", "Chưa có bài thực hành nào", "Hãy thêm thư mục vào file data/library.json.");
      return;
    }

    const results = folders
      .map(function (f) { return { f: f, m: matchFolder(f, q) }; })
      .filter(function (r) { return r.m.ok; });

    if (!results.length) {
      meta.textContent = "";
      list.innerHTML = emptyState("search", "Không tìm thấy bài thực hành phù hợp.", "Thử từ khóa khác, ví dụ: \"trang 50\" hoặc \"bài 1\".");
      return;
    }

    meta.textContent = q
      ? "Tìm thấy " + results.length + " bài thực hành"
      : folders.length + " bài thực hành";

    list.innerHTML = '<div class="folder-grid">' + results.map(function (r) {
      const f = r.f;
      const hit = r.m.hits.length
        ? '<div class="hit">Khớp ảnh: ' + esc(r.m.hits.slice(0, 3).map(function (i) { return i.name; }).join(", ")) + (r.m.hits.length > 3 ? "…" : "") + "</div>"
        : "";
      return '<a class="folder-card" href="#/folder/' + encodeURIComponent(f.id) + '">' +
        '<span class="folder-icon">' + Gallery.icon("folder") + "</span>" +
        "<h3>" + esc(f.name) + "</h3>" +
        (f.description ? '<p class="desc">' + esc(f.description) + "</p>" : "") +
        '<span class="meta">' + f.images.length + " ảnh</span>" + hit +
      "</a>";
    }).join("") + "</div>";
  }

  function emptyState(icon, title, text, withBack) {
    return '<div class="state-box">' + Gallery.icon(icon) +
      "<h2>" + esc(title) + "</h2><p>" + esc(text) + "</p>" +
      (withBack ? '<a class="btn primary" href="#/">' + Gallery.icon("arrow-left") + " Về trang chủ</a>" : "") +
      "</div>";
  }

  /* ---------- Trang chi tiết ---------- */
  function renderFolder(id) {
    const f = getFolder(id);
    window.scrollTo(0, 0);
    if (!f) {
      setTitle("Không tìm thấy");
      app.innerHTML = emptyState("alert-circle", "Không tìm thấy bài thực hành này", "Đường dẫn có thể đã thay đổi hoặc bị xóa.", true);
      return;
    }
    setTitle(f.name);

    const items = f.images.map(function (img) {
      return { name: img.name, src: imageSrc(f, img) };
    });

    app.innerHTML =
      '<a class="btn" href="#/">' + Gallery.icon("arrow-left") + " Quay lại</a>" +
      '<div class="detail-head">' +
        "<h1>" + esc(f.name) + "</h1>" +
        (f.description ? "<p>" + esc(f.description) + "</p>" : "") +
        '<span class="badge">' + items.length + " ảnh</span>" +
      "</div>" +
      (items.length
        ? '<div class="gallery" id="gallery">' + items.map(function (it, i) {
            return '<article class="shot">' +
              '<button class="thumb" type="button" data-open="' + i + '" aria-label="Xem ảnh ' + esc(it.name) + '">' +
                '<img src="' + esc(it.src) + '" alt="' + esc(it.name) + '" loading="lazy" decoding="async">' +
                '<span class="thumb-error">' + Gallery.icon("image") + "Không tải được ảnh</span>" +
              "</button>" +
              '<div class="shot-body">' +
                '<h3 class="shot-name" title="' + esc(it.name) + '">' + esc(it.name) + "</h3>" +
                '<div class="shot-actions">' +
                  '<button class="btn" type="button" data-open="' + i + '">' + Gallery.icon("eye") + " Xem ảnh</button>" +
                  '<button class="btn primary" type="button" data-download="' + i + '">' + Gallery.icon("download") + " Tải xuống</button>" +
                "</div>" +
              "</div>" +
            "</article>";
          }).join("") + "</div>"
        : emptyState("image", "Thư mục này chưa có ảnh", "Hãy thêm ảnh vào library.json."));

    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    // Placeholder -> ảnh thật / báo lỗi (sự kiện load/error không nổi bọt nên bắt ở từng ảnh)
    gallery.querySelectorAll(".thumb img").forEach(function (img) {
      const thumb = img.parentElement;
      if (img.complete && img.naturalWidth) thumb.classList.add("loaded");
      else if (img.complete) thumb.classList.add("error");
      img.addEventListener("load", function () { thumb.classList.add("loaded"); });
      img.addEventListener("error", function () { thumb.classList.add("error"); });
    });

    gallery.addEventListener("click", function (e) {
      const openBtn = e.target.closest("[data-open]");
      const dlBtn = e.target.closest("[data-download]");
      if (openBtn) Gallery.open(items, Number(openBtn.dataset.open));
      else if (dlBtn) {
        const it = items[Number(dlBtn.dataset.download)];
        Gallery.download(it.src, it.name);
      }
    });
  }

  /* ---------- Điều hướng (hash routing: chạy tốt trên GitHub Pages) ---------- */
  function route() {
    if (!document.getElementById("lightbox").hidden) Gallery.close();
    const hash = location.hash || "#/";
    const m = hash.match(/^#\/folder\/(.+)$/);
    if (m) renderFolder(decodeURIComponent(m[1]));
    else renderHome();
  }

  function showLoadError(err) {
    const isFile = location.protocol === "file:";
    app.innerHTML = emptyState(
      "alert-circle",
      "Không đọc được dữ liệu",
      isFile
        ? "Bạn đang mở file trực tiếp (file://) nên trình duyệt chặn đọc JSON. Hãy chạy bằng máy chủ cục bộ (xem README) hoặc mở trên GitHub Pages."
        : "Kiểm tra file data/library.json (đúng cú pháp JSON, đúng đường dẫn). Chi tiết: " + err.message
    );
  }

  window.addEventListener("hashchange", route);

  loadData().then(route).catch(showLoadError);
})();
