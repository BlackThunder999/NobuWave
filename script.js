// Глобальные переменные
var supabase;
var emailjs;
var currentUser = null;
var lastPostTime = 0;
var adminPass;

// Инициализация
(function init() {
  var p1 = 'N0b';
  var p2 = 'uSp@';
  var p3 = 'ce2024';
  adminPass = p1 + p2 + p3;

  supabase = window.supabase.createClient(
    'https://iljsednetiogjtowlexo.supabase.co',
    'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
  );

  emailjs.init('DzhZxt9yx1xb1_1xL');

  checkExistingSession();
})();

// ========== СЕССИИ ==========
function checkExistingSession() {
  var sessionData = localStorage.getItem('nobuqr_session');
  if (sessionData) {
    try {
      var session = JSON.parse(sessionData);
      if (session.userId && session.expires && Date.now() < session.expires) {
        loadUserProfile(session.userId);
      } else {
        localStorage.removeItem('nobuqr_session');
        showAuthScreen();
      }
    } catch (e) {
      localStorage.removeItem('nobuqr_session');
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
}

function saveSession(userId) {
  var expires = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem('nobuqr_session', JSON.stringify({ userId: userId, expires: expires }));
}

function clearSession() {
  localStorage.removeItem('nobuqr_session');
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

function showMainApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  switchScreen('home');
}

// ========== МОДАЛЬНЫЕ ОКНА ==========
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ========== РЕГИСТРАЦИЯ ==========
function registerStep1() {
  var email = document.getElementById('reg-email').value.trim();
  var nickname = document.getElementById('reg-nickname').value.trim();
  var password = document.getElementById('reg-password').value;
  var birthdate = document.getElementById('reg-birthdate').value;

  if (!email || !nickname || !password || !birthdate) {
    alert('Заполните все поля');
    return;
  }

  // Проверка возраста (не менее 10 лет)
  var age = calculateAge(birthdate);
  if (age < 10) {
    alert('Вам должно быть не менее 10 лет');
    return;
  }

  if (containsBadWords(nickname)) {
    alert('Никнейм содержит недопустимые слова');
    return;
  }

  // Проверка IP перед регистрацией
  getIP(function(ip) {
    supabase.from('banned_ips').select('*').eq('ip', ip).gt('banned_until', new Date().toISOString())
    .then(function(banRes) {
      if (banRes.data && banRes.data.length > 0) {
        alert('Регистрация с вашего IP временно запрещена');
        return;
      }

      var code = Math.floor(100000 + Math.random() * 900000).toString();
      sessionStorage.setItem('reg_email', email);
      sessionStorage.setItem('reg_nickname', nickname);
      sessionStorage.setItem('reg_password', password);
      sessionStorage.setItem('reg_birthdate', birthdate);
      sessionStorage.setItem('reg_code', code);

      emailjs.send('service_yixc9cg', 'template_4mj9a5o', {
        to_email: email,
        code: code
      }).then(function() {
        closeModal('register-modal');
        openModal('verify-modal');
      }).catch(function(error) {
        alert('Ошибка отправки кода: ' + JSON.stringify(error));
      });
    });
  });
}

function verifyCode() {
  var enteredCode = document.getElementById('verify-code').value.trim();
  var storedCode = sessionStorage.getItem('reg_code');

  if (enteredCode !== storedCode) {
    alert('Неверный код');
    return;
  }

  var email = sessionStorage.getItem('reg_email');
  var nickname = sessionStorage.getItem('reg_nickname');
  var password = sessionStorage.getItem('reg_password');
  var birthdate = sessionStorage.getItem('reg_birthdate');

  getIP(function(ip) {
    supabase.from('users').insert({
      email: email,
      nickname: nickname,
      password: password,
      birth_date: birthdate,
      ip: ip,
      verified: false
    }).then(function(response) {
      if (response.error) {
        alert('Ошибка регистрации: ' + response.error.message);
      } else {
        alert('Регистрация успешна! Теперь войдите.');
        sessionStorage.clear();
        closeModal('verify-modal');
        openModal('login-modal');
      }
    });
  });
}

// ========== ВХОД ==========
function login() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;

  if (!email || !password) {
    alert('Введите email и пароль');
    return;
  }

  getIP(function(ip) {
    // Проверка бана IP
    supabase.from('banned_ips').select('*').eq('ip', ip).gt('banned_until', new Date().toISOString())
    .then(function(banRes) {
      if (banRes.data && banRes.data.length > 0) {
        alert('Ваш IP заблокирован');
        return;
      }

      supabase.from('users').select('*').eq('email', email).eq('password', password).single()
      .then(function(userRes) {
        if (userRes.error || !userRes.data) {
          alert('Неверный email или пароль');
          return;
        }
        var user = userRes.data;

        if (user.banned_until && new Date(user.banned_until) > new Date()) {
          alert('Ваш аккаунт заблокирован до ' + new Date(user.banned_until).toLocaleString());
          return;
        }

        // Обновить IP
        supabase.from('users').update({ ip: ip }).eq('id', user.id).then(function(){});

        currentUser = user;
        saveSession(user.id);
        closeModal('login-modal');
        showMainApp();
        loadFeed();
      });
    });
  });
}

function logout() {
  clearSession();
  currentUser = null;
  showAuthScreen();
}

// ========== ВОССТАНОВЛЕНИЕ ПАРОЛЯ ==========
function sendResetCode() {
  var email = document.getElementById('reset-email').value.trim();
  if (!email) {
    alert('Введите email');
    return;
  }

  supabase.from('users').select('id').eq('email', email).single()
  .then(function(res) {
    if (res.error || !res.data) {
      alert('Пользователь с таким email не найден');
      return;
    }
    var code = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem('reset_email', email);
    sessionStorage.setItem('reset_code', code);

    emailjs.send('service_yixc9cg', 'template_4mj9a5o', {
      to_email: email,
      code: code
    }).then(function() {
      document.getElementById('reset-step1').style.display = 'none';
      document.getElementById('reset-step2').style.display = 'block';
    }).catch(function(error) {
      alert('Ошибка отправки кода: ' + JSON.stringify(error));
    });
  });
}

function resetPassword() {
  var code = document.getElementById('reset-code').value.trim();
  var newPass = document.getElementById('reset-new-password').value;
  var storedCode = sessionStorage.getItem('reset_code');
  var email = sessionStorage.getItem('reset_email');

  if (code !== storedCode) {
    alert('Неверный код');
    return;
  }
  if (!newPass) {
    alert('Введите новый пароль');
    return;
  }

  supabase.from('users').update({ password: newPass }).eq('email', email)
  .then(function(res) {
    if (res.error) {
      alert('Ошибка смены пароля: ' + res.error.message);
    } else {
      alert('Пароль успешно изменён');
      sessionStorage.removeItem('reset_code');
      sessionStorage.removeItem('reset_email');
      closeModal('reset-password-modal');
    }
  });
}

// ========== ПОСТЫ ==========
function openPostModal() {
  if (!currentUser) return;
  document.getElementById('post-text').value = '';
  document.getElementById('post-preview').innerHTML = '';

  var mediaArea = document.getElementById('media-upload-area');
  var age = calculateAge(currentUser.birth_date);
  if (age >= 18) {
    mediaArea.innerHTML = '<div class="file-upload">' +
      '<label>Фото <input type="file" id="post-image" accept="image/*" onchange="previewMedia(\'image\')"></label>' +
      '<label>Видео <input type="file" id="post-video" accept="video/*" onchange="previewMedia(\'video\')"></label>' +
      '</div>';
  } else {
    mediaArea.innerHTML = '<p style="color:#ffd700;">Вам нет 18 лет, загрузка медиа запрещена</p>';
  }
  openModal('post-modal');
}

function previewMedia(type) {
  var input = document.getElementById('post-' + type);
  var previewDiv = document.getElementById('post-preview');
  if (input.files && input.files[0]) {
    var file = input.files[0];
    var url = URL.createObjectURL(file);
    if (type === 'image') {
      previewDiv.innerHTML = '<img src="' + url + '" style="max-width:100%; border-radius:10px;">';
    } else {
      previewDiv.innerHTML = '<video src="' + url + '" controls style="max-width:100%; border-radius:10px;"></video>';
    }
  }
}

function createChirp() {
  if (!currentUser) return;
  var text = document.getElementById('post-text').value.trim();
  var imageFile = document.getElementById('post-image') ? document.getElementById('post-image').files[0] : null;
  var videoFile = document.getElementById('post-video') ? document.getElementById('post-video').files[0] : null;

  if (!text && !imageFile && !videoFile) {
    alert('Пост не может быть пустым');
    return;
  }
  if (text.length > 280) {
    alert('Текст слишком длинный');
    return;
  }

  var now = Date.now();
  if (now - lastPostTime < 30000) {
    alert('Подождите 30 секунд перед следующим постом');
    return;
  }

  text = filterBadWords(text);
  text = filterContactInfo(text);

  if (!currentUser.verified && containsURL(text)) {
    alert('Только верифицированные пользователи могут публиковать ссылки');
    return;
  }

  var uploadPromise = Promise.resolve({ image_url: null, video_url: null });
  if (imageFile) {
    uploadPromise = uploadMedia(imageFile, 'images');
  } else if (videoFile) {
    uploadPromise = uploadMedia(videoFile, 'videos');
  }

  uploadPromise.then(function(urls) {
    supabase.from('chirps').insert({
      user_id: currentUser.id,
      text: text,
      image_url: urls.image_url,
      video_url: urls.video_url
    }).then(function(res) {
      if (res.error) {
        alert('Ошибка публикации: ' + res.error.message);
        return;
      }
      lastPostTime = Date.now();
      closeModal('post-modal');
      loadFeed();
    });
  }).catch(function(err) {
    alert('Ошибка загрузки медиа: ' + err.message);
  });
}

function uploadMedia(file, bucket) {
  var fileExt = file.name.split('.').pop();
  var fileName = Date.now() + '_' + Math.random().toString(36).substring(2) + '.' + fileExt;
  return supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  }).then(function(uploadRes) {
    if (uploadRes.error) throw uploadRes.error;
    var publicUrl = supabase.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
    var result = {};
    if (bucket === 'images') result.image_url = publicUrl;
    else result.video_url = publicUrl;
    return result;
  });
}

// ========== ЛЕНТА ==========
function loadFeed() {
  if (!currentUser) return;
  supabase.from('chirps').select('*, users!inner(nickname, verified)').order('created_at', { ascending: false })
  .then(function(res) {
    if (res.error) {
      alert('Ошибка загрузки ленты');
      return;
    }
    renderChirps(res.data, 'screen-home');
  });
}

function renderChirps(chirps, containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!chirps || chirps.length === 0) {
    container.innerHTML = '<p style="color:#8b98a5;">Нет постов</p>';
    return;
  }

  for (var i = 0; i < chirps.length; i++) {
    (function(chirp) {
      var card = document.createElement('div');
      card.className = 'chirp-card';

      var header = '<div class="chirp-header">' +
        '<div class="chirp-avatar">' + chirp.users.nickname.charAt(0).toUpperCase() + '</div>' +
        '<div><span class="chirp-nickname">' + chirp.users.nickname + '</span>' +
        (chirp.users.verified ? '<span class="verified-badge">✓</span>' : '') +
        '</div></div>';

      var textHtml = '<div class="chirp-text">' + hashtagLinks(chirp.text) + '</div>';

      var mediaHtml = '';
      if (chirp.image_url) {
        mediaHtml += '<div class="chirp-media"><img src="' + chirp.image_url + '" alt="image"></div>';
      }
      if (chirp.video_url) {
        mediaHtml += '<div class="chirp-media"><video src="' + chirp.video_url + '" controls></video></div>';
      }

      var actions = '<div class="chirp-actions">' +
        '<span onclick="likeChirp(\'' + chirp.id + '\', this)">❤️ <span class="like-count">0</span></span>' +
        '<span onclick="openComments(\'' + chirp.id + '\')">💬 0</span>' +
        '<span onclick="openReport(\'' + chirp.id + '\')">⚠️</span>' +
        '</div>';

      card.innerHTML = header + textHtml + mediaHtml + actions;
      container.appendChild(card);

      // Обновить счетчики лайков и комментариев
      updateCounts(chirp.id, card);
      checkIfLiked(chirp.id, card.querySelector('.chirp-actions span'));
    })(chirps[i]);
  }
}

function updateCounts(chirpId, card) {
  supabase.from('likes').select('id', { count: 'exact' }).eq('chirp_id', chirpId)
  .then(function(res) {
    var countSpan = card.querySelector('.like-count');
    if (countSpan) countSpan.textContent = res.count;
  });
  supabase.from('comments').select('id', { count: 'exact' }).eq('chirp_id', chirpId)
  .then(function(res) {
    var commentSpan = card.querySelectorAll('.chirp-actions span')[1];
    if (commentSpan) commentSpan.innerHTML = '💬 ' + res.count;
  });
}

function hashtagLinks(text) {
  return text.replace(/#(\w+)/g, '<span class="link" onclick="searchHashtag(\'$1\')">#$1</span>');
}

function searchHashtag(tag) {
  switchScreen('search');
  document.getElementById('search-input').value = '#' + tag;
  onSearchInput();
}

function likeChirp(chirpId, element) {
  if (!currentUser) return;
  supabase.from('likes').select('*').eq('user_id', currentUser.id).eq('chirp_id', chirpId).single()
  .then(function(res) {
    if (res.data) {
      supabase.from('likes').delete().eq('id', res.data.id).then(function() {
        updateLikeDisplay(chirpId, element);
      });
    } else {
      supabase.from('likes').insert({ user_id: currentUser.id, chirp_id: chirpId }).then(function() {
        updateLikeDisplay(chirpId, element);
      });
    }
  });
}

function updateLikeDisplay(chirpId, element) {
  supabase.from('likes').select('id', { count: 'exact' }).eq('chirp_id', chirpId)
  .then(function(res) {
    var countSpan = element.querySelector('.like-count');
    if (countSpan) countSpan.textContent = res.count;
    supabase.from('likes').select('id').eq('user_id', currentUser.id).eq('chirp_id', chirpId).single()
    .then(function(likeRes) {
      if (likeRes.data) {
        element.classList.add('liked');
      } else {
        element.classList.remove('liked');
      }
    });
  });
}

function checkIfLiked(chirpId, element) {
  if (!currentUser) return;
  supabase.from('likes').select('id').eq('user_id', currentUser.id).eq('chirp_id', chirpId).single()
  .then(function(res) {
    if (res.data) {
      element.classList.add('liked');
    }
  });
}

// ========== КОММЕНТАРИИ ==========
function openComments(chirpId) {
  if (!currentUser) return;
  window.currentChirpId = chirpId;
  document.getElementById('comment-input').value = '';
  loadComments(chirpId);
  openModal('comments-modal');
}

function loadComments(chirpId) {
  supabase.from('comments').select('*, users(nickname)').eq('chirp_id', chirpId).order('created_at', { ascending: true })
  .then(function(res) {
    var list = document.getElementById('comments-list');
    list.innerHTML = '';
    if (res.data) {
      for (var i = 0; i < res.data.length; i++) {
        var com = res.data[i];
        var div = document.createElement('div');
        div.style.marginBottom = '8px';
        div.innerHTML = '<b>' + com.users.nickname + '</b>: ' + com.text;
        list.appendChild(div);
      }
    }
  });
}

function submitComment() {
  var text = document.getElementById('comment-input').value.trim();
  if (!text) return;
  supabase.from('comments').insert({
    chirp_id: window.currentChirpId,
    user_id: currentUser.id,
    text: text
  }).then(function(res) {
    if (res.error) {
      alert('Ошибка: ' + res.error.message);
    } else {
      document.getElementById('comment-input').value = '';
      loadComments(window.currentChirpId);
    }
  });
}

// ========== ЖАЛОБЫ ==========
function openReport(chirpId) {
  if (!currentUser) return;
  window.reportChirpId = chirpId;
  document.getElementById('report-reason').value = '';
  openModal('report-modal');
}

function submitReport() {
  var reason = document.getElementById('report-reason').value.trim();
  if (!reason) return;
  supabase.from('reports').insert({
    chirp_id: window.reportChirpId,
    reporter_id: currentUser.id,
    reason: reason
  }).then(function(res) {
    if (res.error) {
      alert('Ошибка отправки жалобы');
    } else {
      alert('Жалоба отправлена');
      closeModal('report-modal');
    }
  });
}

// ========== ПОИСК ==========
function onSearchInput() {
  var query = document.getElementById('search-input').value.trim();
  if (!query || !query.startsWith('#')) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }
  var tag = query.substring(1);
  supabase.from('chirps').select('*, users!inner(nickname, verified)').ilike('text', '%#' + tag + '%')
  .order('created_at', { ascending: false })
  .then(function(res) {
    if (res.data) {
      renderChirps(res.data, 'search-results');
    }
  });
}

// ========== ПРОФИЛЬ ==========
function showProfile(userId) {
  if (!currentUser) return;
  supabase.from('users').select('*').eq('id', userId).single().then(function(userRes) {
    if (userRes.error) return;
    var user = userRes.data;
    var profileScreen = document.getElementById('screen-profile');
    profileScreen.innerHTML = '<div class="glass-card">' +
      '<h2>' + user.nickname + (user.verified ? ' <span class="verified-badge">✓</span>' : '') + '</h2>' +
      '<p>' + (user.bio || '') + '</p>' +
      '<button class="btn-small" onclick="toggleFollow(\'' + user.id + '\')">' +
        (isFollowing(user.id) ? 'Отписаться' : 'Подписаться') +
      '</button>' +
      '</div><div id="profile-chirps"></div>';

    switchScreen('profile');
    loadProfileChirps(user.id);
  });
}

function loadProfileChirps(userId) {
  supabase.from('chirps').select('*, users!inner(nickname, verified)').eq('user_id', userId)
  .order('created_at', { ascending: false })
  .then(function(res) {
    renderChirps(res.data, 'profile-chirps');
  });
}

function toggleFollow(userId) {
  if (!currentUser) return;
  supabase.from('follows').select('*').eq('follower_id', currentUser.id).eq('followed_id', userId).single()
  .then(function(res) {
    if (res.data) {
      supabase.from('follows').delete().eq('id', res.data.id).then(function() {
        showProfile(userId);
      });
    } else {
      supabase.from('follows').insert({ follower_id: currentUser.id, followed_id: userId }).then(function() {
        showProfile(userId);
      });
    }
  });
}

function isFollowing(userId) {
  // Упрощённо, можно доработать
  return false;
}

// ========== АДМИН-ПАНЕЛЬ ==========
function openAdminAccess() {
  document.getElementById('admin-pass-input').value = '';
  openModal('admin-login-modal');
}

function adminLogin() {
  var inputPass = document.getElementById('admin-pass-input').value;
  if (inputPass === adminPass) {
    closeModal('admin-login-modal');
    openModal('admin-panel-modal');
    switchAdminTab('users');
  } else {
    alert('Неверный пароль');
  }
}

function switchAdminTab(tab) {
  var content = document.getElementById('admin-tab-content');
  if (tab === 'users') {
    content.innerHTML = '<input type="text" id="admin-user-search" class="input" placeholder="Поиск по нику или email" oninput="adminSearchUsers()">' +
      '<div id="admin-users-list"></div>';
    adminSearchUsers();
  } else if (tab === 'reports') {
    content.innerHTML = '<div id="admin-reports-list"></div>';
    loadAdminReports();
  } else if (tab === 'messages') {
    content.innerHTML = '<div id="admin-messages-list"></div>';
    loadAdminMessages();
  }
}

function adminSearchUsers() {
  var query = document.getElementById('admin-user-search') ? document.getElementById('admin-user-search').value.trim() : '';
  var req = supabase.from('users').select('*').order('created_at');
  if (query) {
    req = req.or('nickname.ilike.%' + query + '%,email.ilike.%' + query + '%');
  }
  req.then(function(res) {
    var list = document.getElementById('admin-users-list');
    list.innerHTML = '';
    if (res.data) {
      for (var i = 0; i < res.data.length; i++) {
        var u = res.data[i];
        var age = calculateAge(u.birth_date);
        var div = document.createElement('div');
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '10px';
        div.innerHTML = '<b>' + u.nickname + '</b> (' + u.email + ') ' +
          'Возраст: ' + age + ' ' +
          (u.verified ? '✓' : '') +
          ' <button class="btn-small" onclick="toggleVerify(\'' + u.id + '\')">Верификация</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'1h\')">Бан 1ч</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'24h\')">Бан 24ч</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'7d\')">Бан 7д</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'forever\')">Навсегда</button>' +
          ' <button class="btn-small" onclick="banUserIP(\'' + u.id + '\')">Бан по IP</button>' +
          ' <button class="btn-small" style="background:#e0245e;" onclick="destroyAccount(\'' + u.id + '\')">Снос аккаунта</button>';
        list.appendChild(div);
      }
    }
  });
}

function toggleVerify(userId) {
  supabase.from('users').select('verified').eq('id', userId).single().then(function(res) {
    var newVerified = !res.data.verified;
    supabase.from('users').update({ verified: newVerified }).eq('id', userId).then(function() {
      adminSearchUsers();
    });
  });
}

function banUser(userId, duration) {
  var until;
  if (duration === '1h') until = new Date(Date.now() + 3600000);
  else if (duration === '24h') until = new Date(Date.now() + 86400000);
  else if (duration === '7d') until = new Date(Date.now() + 604800000);
  else until = new Date('2099-01-01');

  supabase.from('users').update({ banned_until: until.toISOString() }).eq('id', userId).then(function() {
    supabase.from('users').select('email,nickname').eq('id', userId).single().then(function(uRes) {
      if (uRes.data) {
        emailjs.send('service_yixc9cg', 'template_t5dw8ot', {
          to_email: uRes.data.email,
          nickname: uRes.data.nickname,
          ban_reason: 'Нарушение правил',
          ban_until: until.toLocaleString()
        }).catch(function(){});
      }
    });
    alert('Пользователь забанен');
    adminSearchUsers();
  });
}

function banUserIP(userId) {
  supabase.from('users').select('ip').eq('id', userId).single().then(function(res) {
    if (res.data && res.data.ip) {
      supabase.from('banned_ips').insert({
        ip: res.data.ip,
        reason: 'Бан пользователя #' + userId,
        banned_until: new Date('2099-01-01').toISOString()
      }).then(function() {
        alert('IP ' + res.data.ip + ' забанен');
      });
    }
  });
}

function destroyAccount(userId) {
  if (!confirm('Вы уверены, что хотите полностью уничтожить аккаунт? Это удалит все посты, лайки, комментарии и добавит IP в бан навсегда.')) return;

  supabase.from('users').select('ip').eq('id', userId).single().then(function(userRes) {
    var ip = userRes.data ? userRes.data.ip : null;

    // 1. Бан навсегда
    supabase.from('users').update({ banned_until: new Date('2099-01-01').toISOString() }).eq('id', userId)
    .then(function() {
      // 2. Бан IP навсегда
      if (ip) {
        supabase.from('banned_ips').insert({
          ip: ip,
          reason: 'Снос аккаунта #' + userId,
          banned_until: new Date('2099-01-01').toISOString()
        }).then(function(){});
      }

      // 3. Удаление всех постов (каскадно удалятся лайки, комментарии, жалобы)
      supabase.from('chirps').delete().eq('user_id', userId).then(function() {
        alert('Аккаунт уничтожен');
        adminSearchUsers();
      });
    });
  });
}

function loadAdminReports() {
  supabase.from('reports').select('*, chirps(text, user_id), users!reporter_id(nickname)').order('created_at', { ascending: false })
  .then(function(res) {
    var list = document.getElementById('admin-reports-list');
    list.innerHTML = '';
    if (res.data) {
      for (var i = 0; i < res.data.length; i++) {
        var r = res.data[i];
        var div = document.createElement('div');
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '10px';
        div.innerHTML = '<b>Жалоба от:</b> ' + r.users.nickname + '<br>' +
          '<b>Пост:</b> ' + (r.chirps ? r.chirps.text : 'удалён') + '<br>' +
          '<b>Причина:</b> ' + r.reason + '<br>' +
          '<button class="btn-small" onclick="deleteChirp(\'' + r.chirp_id + '\')">Удалить пост</button>' +
          '<button class="btn-small" onclick="dismissReport(\'' + r.id + '\')">Отклонить</button>';
        list.appendChild(div);
      }
    }
  });
}

function deleteChirp(chirpId) {
  supabase.from('chirps').delete().eq('id', chirpId).then(function() {
    alert('Пост удалён');
    loadAdminReports();
  });
}

function dismissReport(reportId) {
  supabase.from('reports').delete().eq('id', reportId).then(function() {
    loadAdminReports();
  });
}

function loadAdminMessages() {
  supabase.from('admin_messages').select('*, users(nickname)').order('created_at', { ascending: false })
  .then(function(res) {
    var list = document.getElementById('admin-messages-list');
    list.innerHTML = '';
    if (res.data) {
      for (var i = 0; i < res.data.length; i++) {
        var msg = res.data[i];
        var div = document.createElement('div');
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '10px';
        div.innerHTML = '<b>От:</b> ' + msg.users.nickname + '<br>' + msg.message;
        list.appendChild(div);
      }
    }
  });
}

// ========== ОБРАТНАЯ СВЯЗЬ ==========
function sendContact() {
  var message = document.getElementById('contact-message').value.trim();
  if (!message) return;
  supabase.from('admin_messages').insert({
    user_id: currentUser ? currentUser.id : null,
    message: message
  }).then(function(res) {
    if (res.error) {
      alert('Ошибка');
    } else {
      alert('Сообщение отправлено');
      closeModal('contact-modal');
    }
  });
}

// ========== ДОКУМЕНТЫ ==========
function openDoc(type) {
  var docText = '';
  if (type === 'terms') {
    docText = '<h2>Условия использования</h2>' +
      '<p>Запрещены оскорбления, спам, контент 18+. Администрация может банить и удалять контент. Пользователь отвечает за свои посты. Администрация не несёт ответственности за контент пользователей. Условия могут меняться.</p>';
  } else if (type === 'privacy') {
    docText = '<h2>Политика конфиденциальности</h2>' +
      '<p>Собираем: email, ник, дату рождения, IP. Используем только для работы сервиса. Не передаём третьим лицам. Хранение в Supabase (европейские серверы). Вы можете запросить удаление данных. Используем куки (localStorage). Контакты: nobuqrspaceeee@outlook.com</p>';
  } else if (type === 'rules') {
    docText = '<h2>Правила сообщества</h2>' +
      '<ol><li>Будьте вежливы</li><li>Без спама</li><li>Без порнографии</li><li>Без дискриминации</li><li>Без угроз</li><li>Уважайте чужие права</li><li>Не выдавайте себя за других</li><li>Реклама только с разрешения</li><li>Следуйте указаниям модераторов</li><li>Наслаждайтесь общением</li></ol>' +
      '<p>Санкции: предупреждение, бан 1ч/24ч/7д/навсегда. Обжалование: через форму обратной связи или nobuqrspaceeee@outlook.com</p>';
  }
  document.getElementById('doc-text').innerHTML = docText;
  openModal('doc-modal');
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function calculateAge(birthDateStr) {
  var birth = new Date(birthDateStr);
  var now = new Date();
  var age = now.getFullYear() - birth.getFullYear();
  var monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function containsBadWords(text) {
  var badWords = ['бля', 'хуй', 'пизд', 'ебан', 'залуп'];
  for (var i = 0; i < badWords.length; i++) {
    if (text.toLowerCase().indexOf(badWords[i]) !== -1) return true;
  }
  return false;
}

function filterBadWords(text) {
  var badWords = ['бля', 'хуй', 'пизд', 'ебан', 'залуп'];
  for (var i = 0; i < badWords.length; i++) {
    var reg = new RegExp(badWords[i], 'gi');
    text = text.replace(reg, '***');
  }
  return text;
}

function filterContactInfo(text) {
  text = text.replace(/\+?\d{10,}/g, '[номер скрыт]');
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email скрыт]');
  return text;
}

function containsURL(text) {
  return /https?:\/\/\S+/i.test(text);
}

function getIP(callback) {
  fetch('https://api.ipify.org?format=json')
    .then(function(response) { return response.json(); })
    .then(function(data) { callback(data.ip); })
    .catch(function() { callback('0.0.0.0'); });
}

function loadUserProfile(userId) {
  supabase.from('users').select('*').eq('id', userId).single().then(function(res) {
    if (res.error || !res.data) {
      clearSession();
      showAuthScreen();
      return;
    }
    currentUser = res.data;
    showMainApp();
    loadFeed();
  });
}

function switchScreen(screenName) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  document.getElementById('screen-' + screenName).classList.add('active');
  if (screenName === 'home') loadFeed();
}

// Глобальные функции
window.openModal = openModal;
window.closeModal = closeModal;
window.registerStep1 = registerStep1;
window.verifyCode = verifyCode;
window.login = login;
window.logout = logout;
window.sendResetCode = sendResetCode;
window.resetPassword = resetPassword;
window.openPostModal = openPostModal;
window.previewMedia = previewMedia;
window.createChirp = createChirp;
window.likeChirp = likeChirp;
window.openComments = openComments;
window.submitComment = submitComment;
window.openReport = openReport;
window.submitReport = submitReport;
window.onSearchInput = onSearchInput;
window.searchHashtag = searchHashtag;
window.showProfile = showProfile;
window.toggleFollow = toggleFollow;
window.openAdminAccess = openAdminAccess;
window.adminLogin = adminLogin;
window.switchAdminTab = switchAdminTab;
window.adminSearchUsers = adminSearchUsers;
window.toggleVerify = toggleVerify;
window.banUser = banUser;
window.banUserIP = banUserIP;
window.destroyAccount = destroyAccount;
window.deleteChirp = deleteChirp;
window.dismissReport = dismissReport;
window.sendContact = sendContact;
window.openDoc = openDoc;
window.switchScreen = switchScreen;