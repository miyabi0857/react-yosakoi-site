// ReAct!! 管理者ページ 補助スクリプト
// GitHubの個人アクセストークンを使って、ブラウザから直接
// このリポジトリのファイルを更新することで「投稿」を実現しています。

(function () {
  "use strict";

  // ▼このサイトのリポジトリ情報（サイトを移転する場合はここを変更してください）
  var GITHUB_OWNER = "miyabi0857";
  var GITHUB_REPO = "react-yosakoi-site";
  var GITHUB_BRANCH = "main";
  var DATA_PATH = "js/posts-data.json";
  var IMAGE_DIR = "assets/blog";

  var TOKEN_STORAGE_KEY = "react_admin_token";

  var loginView = document.getElementById("login-view");
  var adminView = document.getElementById("admin-view");
  var tokenInput = document.getElementById("token-input");
  var loginBtn = document.getElementById("login-btn");
  var loginError = document.getElementById("login-error");
  var logoutBtn = document.getElementById("logout-btn");
  var postForm = document.getElementById("post-form");
  var titleInput = document.getElementById("title-input");
  var dateInput = document.getElementById("date-input");
  var authorInput = document.getElementById("author-input");
  var bodyInput = document.getElementById("body-input");
  var imageInput = document.getElementById("image-input");
  var imagePreview = document.getElementById("image-preview");
  var submitBtn = document.getElementById("submit-btn");
  var submitStatus = document.getElementById("submit-status");

  if (!loginView) return; // このページ専用スクリプト（他ページでは何もしない）

  // 今日の日付をデフォルト値にする
  if (dateInput) {
    var today = new Date();
    dateInput.value = today.toISOString().slice(0, 10);
  }

  // ---------- ログイン状態の初期化 ----------
  var token = null;
  try {
    token = localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    // localStorageが使えない環境（プライベートモード等）
  }
  if (token) {
    validateAndShowAdmin(token, true);
  }

  // ---------- ログイン ----------
  loginBtn.addEventListener("click", function () {
    var value = tokenInput.value.trim();
    if (!value) return;
    setLoginError("");
    loginBtn.disabled = true;
    loginBtn.textContent = "確認中...";
    validateAndShowAdmin(value, false).then(function (ok) {
      loginBtn.disabled = false;
      loginBtn.textContent = "ログイン";
      if (ok) {
        try { localStorage.setItem(TOKEN_STORAGE_KEY, value); } catch (e) {}
      }
    });
  });

  logoutBtn.addEventListener("click", function () {
    try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch (e) {}
    token = null;
    adminView.hidden = true;
    loginView.hidden = false;
    tokenInput.value = "";
  });

  function validateAndShowAdmin(candidateToken, silent) {
    return githubRequest(candidateToken, "", { method: "GET" })
      .then(function (repo) {
        if (!repo || !repo.permissions || !repo.permissions.push) {
          throw new Error("no_write_access");
        }
        token = candidateToken;
        loginView.hidden = true;
        adminView.hidden = false;
        return true;
      })
      .catch(function (err) {
        if (!silent) {
          if (err && err.message === "no_write_access") {
            setLoginError("このトークンには書き込み権限がありません。トークンの作り方をもう一度ご確認ください。");
          } else {
            setLoginError("ログインできませんでした。トークンが正しいかご確認ください。");
          }
        }
        try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch (e) {}
        return false;
      });
  }

  function setLoginError(msg) {
    if (!msg) {
      loginError.hidden = true;
      loginError.textContent = "";
    } else {
      loginError.hidden = false;
      loginError.textContent = msg;
    }
  }

  // ---------- 画像プレビュー ----------
  imageInput.addEventListener("change", function () {
    var file = imageInput.files[0];
    if (!file) {
      imagePreview.hidden = true;
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      imagePreview.src = e.target.result;
      imagePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  });

  // ---------- 投稿処理 ----------
  postForm.addEventListener("submit", function (e) {
    e.preventDefault();
    submitBtn.disabled = true;
    setStatus("投稿しています...", false);

    var newPost = {
      id: dateInput.value + "-" + Math.random().toString(36).slice(2, 8),
      date: dateInput.value,
      author: authorInput.value.trim(),
      title: titleInput.value.trim(),
      body: bodyInput.value,
      image: null
    };

    var imageFile = imageInput.files[0];

    (imageFile ? resizeImage(imageFile) : Promise.resolve(null))
      .then(function (resizedDataUrl) {
        if (!resizedDataUrl) return null;
        var ext = "jpg";
        var filename = newPost.id + "." + ext;
        var base64 = resizedDataUrl.split(",")[1];
        setStatus("写真をアップロードしています...", false);
        return githubRequest(token, "contents/" + IMAGE_DIR + "/" + filename, {
          method: "PUT",
          body: {
            message: "活動報告の写真を追加: " + filename,
            content: base64,
            branch: GITHUB_BRANCH
          }
        }).then(function () {
          newPost.image = IMAGE_DIR + "/" + filename;
        });
      })
      .then(function () {
        setStatus("記事データを更新しています...", false);
        return githubRequest(token, "contents/" + DATA_PATH, { method: "GET" });
      })
      .then(function (fileInfo) {
        var currentPosts = [];
        try {
          currentPosts = JSON.parse(utf8Base64Decode(fileInfo.content));
        } catch (e) {
          currentPosts = [];
        }
        currentPosts.unshift(newPost);

        return githubRequest(token, "contents/" + DATA_PATH, {
          method: "PUT",
          body: {
            message: "活動報告を追加: " + newPost.title,
            content: utf8Base64Encode(JSON.stringify(currentPosts, null, 2)),
            sha: fileInfo.sha,
            branch: GITHUB_BRANCH
          }
        });
      })
      .then(function () {
        setStatus("投稿しました！サイトへの反映まで1分ほどかかります。", true);
        postForm.reset();
        if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
        imagePreview.hidden = true;
        submitBtn.disabled = false;
      })
      .catch(function (err) {
        console.error(err);
        setStatus("投稿に失敗しました。通信環境をご確認のうえ、もう一度お試しください。", false, true);
        submitBtn.disabled = false;
      });
  });

  function setStatus(msg, success, isError) {
    submitStatus.hidden = false;
    submitStatus.textContent = msg;
    submitStatus.className = "admin-status" + (success ? " is-success" : "") + (isError ? " is-error" : "");
  }

  // ---------- 画像のリサイズ・圧縮（サイズを抑えて安定してアップロードするため） ----------
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var maxWidth = 1600;
          var scale = Math.min(1, maxWidth / img.width);
          var canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------- GitHub API 呼び出し ----------
  function githubRequest(useToken, path, options) {
    options = options || {};
    var url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
      (path ? "/" + path : "");
    var fetchOptions = {
      method: options.method || "GET",
      headers: {
        "Authorization": "token " + useToken,
        "Accept": "application/vnd.github+json"
      }
    };
    if (options.body) {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(options.body);
    }
    return fetch(url, fetchOptions).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (errBody) {
          var e = new Error((errBody && errBody.message) || ("HTTP " + res.status));
          e.status = res.status;
          throw e;
        });
      }
      return res.json();
    });
  }

  // ---------- UTF-8対応の Base64 変換 ----------
  function utf8Base64Decode(base64) {
    var binary = atob(base64.replace(/\n/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function utf8Base64Encode(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
})();
