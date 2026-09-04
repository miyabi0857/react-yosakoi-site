// ReAct!! 公式サイト 補助スクリプト

document.addEventListener("DOMContentLoaded", function () {
  // フッターの年号を自動更新
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // 活動報告（ブログ）を posts-data.js のデータから描画する
  var listEl = document.getElementById("blog-list");
  if (listEl && typeof REACT_POSTS !== "undefined") {
    var posts = REACT_POSTS.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    if (posts.length === 0) {
      listEl.innerHTML = '<p class="blog-empty">まだ記事がありません。近日公開予定です。</p>';
      return;
    }

    posts.forEach(function (post) {
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
      listEl.appendChild(card);
    });
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
