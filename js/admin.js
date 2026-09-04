// ReAct!! 管理者ページ 補助スクリプト
// GitHubの個人アクセストークンを使って、ブラウザから直接
// このリポジトリのファイルを更新することで「投稿・編集・削除」を実現しています。

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
  var manageView = document.getElementById("manage-view");
  var tokenInput = document.getElementById("token-input");
  var loginBtn = document.getElementById("login-btn");
  var loginError = document.getElementById("login-error");
  var logoutBtn = document.getElementById("logout-btn");
  var postForm = document.getElementById("post-form");
  var formTitle = document.getElementById("form-title");
  var editingNote = document.getElementById("editing-note");
  var cancelEditBtn = document.getElementById("cancel-edit-btn");
  var titleInput = document.getElementById("title-input");
  var dateInput = document.getElementById("date-input");
  var authorInput = document.getElementById("author-input");
  var bodyInput = document.getElementById("body-input");
  var imageInput = document.getElementById("image-input");
  var imagePreview = document.getElementById("image-preview");
  var currentImageNote = document.getElementById("current-image-note");
  var submitBtn = document.getElementById("submit-btn");
  var submitStatus = document.getElementById("submit-status");
  var postsSearchInput = document.getElementById("posts-search-input");
  var postsListEl = document.getElementById("posts-list");

  if (!loginView) return; // このページ専用スクリプト（他ページでは何もしない）

  // 今日の日付をデフォルト値にする
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  var token = null;
  var editingId = null; // nullなら新規投稿、値があればその記事を編集中
  var allPostsCache = [];

  // ---------- ログイン状態の初期化 ----------
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
    manageView.hidden = true;
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
        manageView.hidden = false;
        loadPostsList();
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

  // ---------- 編集モードの開始・終了 ----------
  function startEdit(post) {
    editingId = post.id;
    titleInput.value = post.title;
    dateInput.value = post.date;
    authorInput.value = post.author || "";
    bodyInput.value = post.body;
    imageInput.value = "";
    imagePreview.hidden = true;
    currentImageNote.hidden = !post.image;

    formTitle.textContent = "活動報告を編集する";
    submitBtn.textContent = "更新する";
    editingNote.hidden = false;
    setStatus("", false);

    adminView.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function endEdit() {
    editingId = null;
    postForm.reset();
    dateInput.value = new Date().toISOString().slice(0, 10);
    imagePreview.hidden = true;
    currentImageNote.hidden = true;

    formTitle.textContent = "活動報告を投稿する";
    submitBtn.textContent = "投稿する";
    editingNote.hidden = true;
  }

  cancelEditBtn.addEventListener("click", endEdit);

  // ---------- 投稿・更新処理 ----------
  postForm.addEventListener("submit", function (e) {
    e.preventDefault();
    submitBtn.disabled = true;
    setStatus(editingId ? "更新しています..." : "投稿しています...", false);

    var inputTitle = titleInput.value.trim();
    var inputDate = dateInput.value;
    var inputAuthor = authorInput.value.trim();
    var inputBody = bodyInput.value;
    var imageFile = imageInput.files[0];

    (imageFile ? uploadImage(imageFile, inputDate) : Promise.resolve(undefined))
      .then(function (uploadedImagePath) {
        setStatus("記事データを更新しています...", false);
        return fetchCurrentPosts().then(function (result) {
          var posts = result.posts;

          if (editingId) {
            var idx = posts.findIndex(function (p) { return p.id === editingId; });
            if (idx === -1) throw new Error("post_not_found");
            posts[idx].title = inputTitle;
            posts[idx].date = inputDate;
            posts[idx].author = inputAuthor;
            posts[idx].body = inputBody;
            if (uploadedImagePath !== undefined) posts[idx].image = uploadedImagePath;
          } else {
            posts.unshift({
              id: inputDate + "-" + Math.random().toString(36).slice(2, 8),
              date: inputDate,
              author: inputAuthor,
              title: inputTitle,
              body: inputBody,
              image: uploadedImagePath || null
            });
          }

          return writePosts(posts, result.sha,
            (editingId ? "活動報告を編集: " : "活動報告を追加: ") + inputTitle);
        });
      })
      .then(function () {
        setStatus(editingId ? "更新しました！サイトへの反映まで1分ほどかかります。" : "投稿しました！サイトへの反映まで1分ほどかかります。", true);
        endEdit();
        submitBtn.disabled = false;
        loadPostsList();
      })
      .catch(function (err) {
        console.error(err);
        setStatus("処理に失敗しました。通信環境をご確認のうえ、もう一度お試しください。", false, true);
        submitBtn.disabled = false;
      });
  });

  function setStatus(msg, success, isError) {
    if (!msg) {
      submitStatus.hidden = true;
      return;
    }
    submitStatus.hidden = false;
    submitStatus.textContent = msg;
    submitStatus.className = "admin-status" + (success ? " is-success" : "") + (isError ? " is-error" : "");
  }

  // ---------- 投稿一覧の読み込み・検索・削除 ----------
  function loadPostsList() {
    postsListEl.innerHTML = '<p class="admin-help">読み込み中...</p>';
    fetchCurrentPosts()
      .then(function (result) {
        allPostsCache = sortPostsDesc(result.posts);
        renderPostsList(allPostsCache);
      })
      .catch(function (err) {
        console.error(err);
        postsListEl.innerHTML = '<p class="admin-help">読み込みに失敗しました。</p>';
      });
  }

  postsSearchInput.addEventListener("input", function () {
    var keyword = postsSearchInput.value.trim().toLowerCase();
    if (!keyword) {
      renderPostsList(allPostsCache);
      return;
    }
    var filtered = allPostsCache.filter(function (p) {
      return p.title.toLowerCase().indexOf(keyword) !== -1 ||
        p.body.toLowerCase().indexOf(keyword) !== -1 ||
        p.date.indexOf(keyword) !== -1;
    });
    renderPostsList(filtered);
  });

  function renderPostsList(posts) {
    postsListEl.innerHTML = "";
    if (posts.length === 0) {
      postsListEl.innerHTML = '<p class="admin-help">該当する記事がありません。</p>';
      return;
    }
    posts.forEach(function (post) {
      var row = document.createElement("div");
      row.className = "admin-post-row";

      var info = document.createElement("div");
      info.className = "admin-post-row-info";
      var titleLine = document.createElement("p");
      titleLine.className = "admin-post-row-title";
      titleLine.textContent = post.title;
      var metaLine = document.createElement("p");
      metaLine.className = "admin-post-row-meta";
      metaLine.textContent = post.date + (post.author ? "　｜　" + post.author : "");
      info.appendChild(titleLine);
      info.appendChild(metaLine);

      var actions = document.createElement("div");
      actions.className = "admin-post-row-actions";

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "admin-row-btn";
      editBtn.textContent = "編集";
      editBtn.addEventListener("click", function () { startEdit(post); });

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "admin-row-btn admin-row-btn-danger";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", function () { deletePost(post); });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(info);
      row.appendChild(actions);
      postsListEl.appendChild(row);
    });
  }

  function deletePost(post) {
    var ok = window.confirm('「' + post.title + '」を削除します。元に戻せません。よろしいですか？');
    if (!ok) return;

    setStatus("削除しています...", false);
    fetchCurrentPosts()
      .then(function (result) {
        var posts = result.posts.filter(function (p) { return p.id !== post.id; });
        return writePosts(posts, result.sha, "活動報告を削除: " + post.title);
      })
      .then(function () {
        setStatus("削除しました。サイトへの反映まで1分ほどかかります。", true);
        if (editingId === post.id) endEdit();
        loadPostsList();
      })
      .catch(function (err) {
        console.error(err);
        setStatus("削除に失敗しました。もう一度お試しください。", false, true);
      });
  }

  function sortPostsDesc(posts) {
    return posts.slice().sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
  }

  // ---------- 画像のアップロード（リサイズ・圧縮つき） ----------
  function uploadImage(file, dateForFilename) {
    return resizeImage(file).then(function (resizedDataUrl) {
      var filename = dateForFilename + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
      var base64 = resizedDataUrl.split(",")[1];
      return githubRequest(token, "contents/" + IMAGE_DIR + "/" + filename, {
        method: "PUT",
        body: {
          message: "活動報告の写真を追加: " + filename,
          content: base64,
          branch: GITHUB_BRANCH
        }
      }).then(function () {
        return IMAGE_DIR + "/" + filename;
      });
    });
  }

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

  // ---------- 記事データの取得・保存 ----------
  function fetchCurrentPosts() {
    return githubRequest(token, "contents/" + DATA_PATH, { method: "GET" }).then(function (fileInfo) {
      var posts = [];
      try {
        posts = JSON.parse(utf8Base64Decode(fileInfo.content));
      } catch (e) {
        posts = [];
      }
      return { posts: posts, sha: fileInfo.sha };
    });
  }

  function writePosts(posts, sha, message) {
    return githubRequest(token, "contents/" + DATA_PATH, {
      method: "PUT",
      body: {
        message: message,
        content: utf8Base64Encode(JSON.stringify(posts, null, 2)),
        sha: sha,
        branch: GITHUB_BRANCH
      }
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
