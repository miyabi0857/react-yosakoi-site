// ReAct!! 公式サイト 補助スクリプト
// フッターの年号を自動更新するだけの、ごく小さなスクリプトです。

document.addEventListener("DOMContentLoaded", function () {
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
