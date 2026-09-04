// ReAct!! 公式サイト 補助スクリプト

// トップページの活動報告に表示する最新記事の件数
// （この数を増減させると、トップページに表示される記事数が変わります）
var RECENT_POSTS_COUNT = 3;

document.addEventListener("DOMContentLoaded", function () {
  // フッターの年号を自動更新
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  var allPosts = (typeof REACT_POSTS !== "undefined") ? sortPostsDesc(REACT_POSTS) : [];

  // トップページ：活動報告（直近数件＋もっと見るリンク）
  var listEl = document.getElementById("blog-list");
  if (listEl) {
    var recent = allPosts.slice(0, RECENT_POSTS_COUNT);
    renderPosts(listEl, recent);

    var moreLinkWrap = document.getElementById("blog-more-link-wrap");
    if (moreLinkWrap && allPosts.length > RECENT_POSTS_COUNT) {
      moreLinkWrap.hidden = false;
    }
  }

  // 活動報告一覧ページ（年フィルター・キーワード検索つき）
  var archiveListEl = document.getElementById("blog-archive-list");
  if (archiveListEl) {
    initArchivePage(allPosts, archiveListEl);
  }

  // ---------- 以下、内部で使う関数 ----------

  function sortPostsDesc(posts) {
    return posts.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  function renderPosts(container, posts) {
    container.innerHTML = "";
    if (posts.length === 0) {
      var empty = document.createElement("p");
      empty.className = "blog-empty";
      empty.textContent = "該当する記事が見つかりませんでした。";
      container.appendChild(empty);
      return;
    }
    posts.forEach(function (post) {
      container.appendChild(buildPostCard(post));
    });
  }

  function buildPostCard(post) {
    var card = document.createElement("article");
    card.className = "blog-post";

    var dateEl = document.createElement("p");
    dateEl.className = "blog-post-date";
    dateEl.textContent = formatDate(post.date);

    var titleEl = document.createElement("h3");
    titleEl.className = "blog-post-title";
    titleEl.textContent = post.title;

    var bodyEl = document.createElement("p");
    bodyEl.className = "blog-post-body";
    bodyEl.innerHTML = escapeHtml(post.body).replace(/\n/g, "<br>");

    card.appendChild(dateEl);
    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    return card;
  }

  function initArchivePage(posts, listEl) {
    var years = Array.from(new Set(posts.map(function (p) {
      return new Date(p.date).getFullYear();
    }))).sort(function (a, b) { return b - a; });

    var yearFilterEl = document.getElementById("year-filter");
    var searchInputEl = document.getElementById("keyword-search");
    var currentYear = "all";

    if (yearFilterEl) {
      var allBtn = createYearButton("すべて", "all", true);
      yearFilterEl.appendChild(allBtn);
      years.forEach(function (y) {
        yearFilterEl.appendChild(createYearButton(y + "年", String(y), false));
      });

      yearFilterEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-year]");
        if (!btn) return;
        currentYear = btn.getAttribute("data-year");
        Array.prototype.forEach.call(yearFilterEl.querySelectorAll("[data-year]"), function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        applyFilters();
      });
    }

    if (searchInputEl) {
      searchInputEl.addEventListener("input", function () {
        applyFilters();
      });
    }

    function createYearButton(label, value, active) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "year-filter-btn" + (active ? " is-active" : "");
      btn.setAttribute("data-year", value);
      btn.textContent = label;
      return btn;
    }

    function applyFilters() {
      var keyword = searchInputEl ? searchInputEl.value.trim().toLowerCase() : "";
      var filtered = posts.filter(function (p) {
        var matchesYear = currentYear === "all" || String(new Date(p.date).getFullYear()) === currentYear;
        var matchesKeyword = !keyword ||
          p.title.toLowerCase().indexOf(keyword) !== -1 ||
          p.body.toLowerCase().indexOf(keyword) !== -1;
        return matchesYear && matchesKeyword;
      });
      renderPosts(listEl, filtered);
    }

    applyFilters();
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
