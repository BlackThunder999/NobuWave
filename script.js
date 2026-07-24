var supabase;
var currentUser = null;
var lastPostTime = 0;
var lastCommentTime = 0;
var lastPostText = '';
var lastCommentText = '';
var adminPass;

(function init() {
  var p1 = 'N0b';
  var p2 = 'uSp@';
  var p3 = 'ce2024';
  adminPass = p1 + p2 + p3;

  supabase = window.supabase.createClient(
    'https://iljsednetiogjtowlexo.supabase.co',
    'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
  );

  checkExistingSession();
})();

// ========== ХЕШИРОВАНИЕ ПАРОЛЯ С СОЛЬЮ (SHA-256) ==========
function generateSalt() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var salt = '';
  for (var i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

function sha256(str) {
  var buffer = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buffer).then(function(hash) {
    return Array.from(new Uint8Array(hash)).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  });
}

function hashPassword(password, salt) {
  return sha256(password + salt);
}

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

// ========== ЗАЩИТА ОТ СПАМА ==========
function hasRepeatingChars(text, maxRepeat) {
  if (!text) return false;
  var count = 1;
  for (var i = 1; i < text.length; i++) {
    if (text[i].toLowerCase() === text[i-1].toLowerCase()) {
      count++;
      if (count > maxRepeat) return true;
    } else {
      count = 1;
    }
  }
  return false;
}

function isAllCaps(text) {
  if (!text || text.length < 4) return false;
  var letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (letters.length === 0) return false;
  var caps = letters.replace(/[^A-ZА-ЯЁ]/g, '');
  return (caps.length / letters.length) > 0.7;
}

function isRepeatingPattern(text) {
  if (!text || text.length < 4) return false;
  for (var len = 1; len <= 3; len++) {
    if (text.length >= len * 3) {
      var pattern = text.substring(0, len).toLowerCase();
      var matches = true;
      for (var i = 1; i < Math.floor(text.length / len); i++) {
        var chunk = text.substring(i * len, (i + 1) * len).toLowerCase();
        if (chunk !== pattern && chunk.length === len) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
  }
  return false;
}

function hasOnlyRepeatingNick(text) {
  if (!text || text.length < 3) return false;
  var first = text[0].toLowerCase();
  for (var i = 1; i < text.length; i++) {
    if (text[i].toLowerCase() !== first) return false;
  }
  return true;
}

function containsAds(text) {
  var adWords = ['купить', 'продам', 'скидка', 'реклама', 'заходи', 'дешево', 'заработок', 'бизнес', 'раскрутка', 'накрутка'];
  var lower = text.toLowerCase();
  for (var i = 0; i < adWords.length; i++) {
    if (lower.indexOf(adWords[i]) !== -1) return true;
  }
  return false;
}

function validatePostText(text) {
  if (!text || text.trim().length === 0) return '';
  text = text.trim();
  if (text.length < 2) return 'Текст слишком короткий';
  if (hasRepeatingChars(text, 5)) return 'Слишком много повторяющихся символов';
  if (isRepeatingPattern(text)) return 'Обнаружен спам-паттерн. Напишите что-то осмысленное';
  if (isAllCaps(text)) return 'Пожалуйста, не используйте ЗАГЛАВНЫЕ БУКВЫ для всего текста';
  if (!currentUser.verified && (containsURL(text) || containsAds(text))) {
    return 'Реклама и ссылки разрешены только верифицированным пользователям';
  }
  return '';
}

function validateNickname(nick) {
  if (!nick || nick.trim().length < 2) return 'Никнейм слишком короткий';
  if (hasOnlyRepeatingNick(nick)) return 'Никнейм не может состоять из одной буквы';
  if (hasRepeatingChars(nick, 3)) return 'Никнейм содержит слишком много повторяющихся символов';
  return '';
}

// ========== РЕГИСТРАЦИЯ ==========
function registerStep1() {
  var agree = document.getElementById('agree-checkbox');
  if (!agree || !agree.checked) {
    alert('Необходимо согласиться с условиями, политикой и правилами');
    return;
  }

  var email = document.getElementById('reg-email').value.trim();
  var nickname = document.getElementById('reg-nickname').value.trim();
  var password = document.getElementById('reg-password').value;
  var birthdate = document.getElementById('reg-birthdate').value;

  if (!email || !nickname || !password || !birthdate) {
    alert('Заполните все поля');
    return;
  }

  var age = calculateAge(birthdate);
  if (age < 10) {
    alert('Вам должно быть не менее 10 лет');
    return;
  }

  if (containsBadWords(nickname)) {
    alert('Никнейм содержит недопустимые слова');
    return;
  }

  var nickError = validateNickname(nickname);
  if (nickError) {
    alert(nickError);
    return;
  }

  getIP(function(ip) {
    supabase.from('banned_ips').select('*').eq('ip', ip).gt('banned_until', new Date().toISOString())
    .then(function(banRes) {
      if (banRes.data && banRes.data.length > 0) {
        alert('Регистрация с вашего IP временно запрещена');
        return;
      }

      supabase.from('users').select('id').eq('email', email).single()
      .then(function(checkRes) {
        if (checkRes.data) {
          alert('Этот email уже зарегистрирован');
          return;
        }

        // Генерируем соль и хешируем с ней пароль
        var salt = generateSalt();
        hashPassword(password, salt).then(function(hashedPassword) {
          supabase.from('users').insert({
            email: email,
            nickname: nickname,
            password: hashedPassword,
            salt: salt,
            birth_date: birthdate,
            ip: ip,
            verified: false
          }).then(function(response) {
            if (response.error) {
              alert('Ошибка регистрации: ' + response.error.message);
            } else {
              alert('Регистрация успешна! Теперь войдите.');
              closeModal('register-modal');
              openModal('login-modal');
            }
          });
        });
      });
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
    supabase.from('banned_ips').select('*').eq('ip', ip).gt('banned_until', new Date().toISOString())
    .then(function(banRes) {
      if (banRes.data && banRes.data.length > 0) {
        alert('Ваш IP заблокирован');
        return;
      }

      // Сначала получаем пользователя по email
      supabase.from('users').select('*').eq('email', email).single()
      .then(function(userRes) {
        if (userRes.error || !userRes.data) {
          alert('Неверный email или пароль');
          return;
        }
        var user = userRes.data;

        // Хешируем введённый пароль с солью пользователя
        hashPassword(password, user.salt).then(function(hashedInput) {
          if (hashedInput !== user.password) {
            alert('Неверный email или пароль');
            return;
          }

          if (user.banned_until && new Date(user.banned_until) > new Date()) {
            alert('Ваш аккаунт заблокирован до ' + new Date(user.banned_until).toLocaleString());
            return;
          }

          supabase.from('users').update({ ip: ip }).eq('id', user.id).then(function(){});
          currentUser = user;
          saveSession(user.id);
          closeModal('login-modal');
          showMainApp();
          loadFeed();
        });
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
function resetPassword() {
  var email = document.getElementById('reset-email').value.trim();
  if (!email) {
    alert('Введите email');
    return;
  }
  alert('Заявка на сброс пароля отправлена. Администратор свяжется с вами по email: ' + email);
  closeModal('reset-password-modal');
}

// ========== ПОСТЫ ==========
function openPostModal() {
  if (!currentUser) return;
  document.getElementById('post-text').value = '';
  document.getElementById('post-preview').innerHTML = '';
  document.getElementById('post-spam-warning').style.display = 'none';

  var mediaArea = document.getElementById('media-upload-area');
  var age = calculateAge(currentUser.birth_date);
  if (age >= 18) {
    mediaArea.innerHTML = '<div class="file-upload">' +
      '<label>Фото <input type="file" id="post-image" accept="image/*" onchange="previewMedia(\'image\')"></label>' +
      '<label>Видео <input type="file" id="post-video" accept="video/*" onchange="previewMedia(\'video\')"></label>' +
      '</div>';
  } else {
    mediaArea.innerHTML = '<p style="color:#ffd700;">Вам нет 18 лет. Загрузка фото и видео запрещена.</p>';
  }
  openModal('post-modal');
}

function previewMedia(type) {
  var input = document.getElementById('post-' + type);
  var previewDiv = document.getElementById('post-preview');
  if (input && input.files && input.files[0]) {
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

  if (text) {
    var spamError = validatePostText(text);
    if (spamError) {
      document.getElementById('post-spam-warning').textContent = spamError;
      document.getElementById('post-spam-warning').style.display = 'block';
      return;
    }
  }

  if (text && text === lastPostText) {
    document.getElementById('post-spam-warning').textContent = 'Нельзя отправлять одинаковые посты подряд';
    document.getElementById('post-spam-warning').style.display = 'block';
    return;
  }

  var now = Date.now();
  if (now - lastPostTime < 30000) {
    alert('Подождите 30 секунд перед следующим постом');
    return;
  }

  if (text.length > 280) {
    alert('Текст слишком длинный');
    return;
  }

  text = filterBadWords(text);
  text = filterContactInfo(text);

  if (!currentUser.verified && (containsURL(text) || containsAds(text))) {
    document.getElementById('post-spam-warning').textContent = 'Реклама запрещена. Пройдите верификацию.';
    document.getElementById('post-spam-warning').style.display = 'block';
    return;
  }

  var uploadPromise = Promise.resolve({ image_url: null, video_url: null });
  if (imageFile) uploadPromise = uploadMedia(imageFile, 'images');
  else if (videoFile) uploadPromise = uploadMedia(videoFile, 'videos');

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
      lastPostText = text;
      document.getElementById('post-spam-warning').style.display = 'none';
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
    if (res.error) { alert('Ошибка загрузки ленты'); return; }
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
      var idSpan = '<span class="chirp-id">ID:' + chirp.id.substring(0,8) + '</span>';
      var header = '<div class="chirp-header"><div class="chirp-avatar">' + chirp.users.nickname.charAt(0).toUpperCase() + '</div><div><span class="chirp-nickname">' + chirp.users.nickname + '</span>' + (chirp.users.verified ? '<span class="verified-badge">✓</span>' : '') + '</div></div>';
      var textHtml = '<div class="chirp-text">' + hashtagLinks(chirp.text) + '</div>';
      var mediaHtml = '';
      if (chirp.image_url) mediaHtml += '<div class="chirp-media"><img src="' + chirp.image_url + '" alt="image"></div>';
      if (chirp.video_url) mediaHtml += '<div class="chirp-media"><video src="' + chirp.video_url + '" controls></video></div>';
      var actions = '<div class="chirp-actions"><span onclick="likeChirp(\'' + chirp.id + '\', this)">❤️ <span class="like-count">0</span></span><span onclick="openComments(\'' + chirp.id + '\')">💬 0</span><span onclick="openReport(\'' + chirp.id + '\')">⚠️</span></div>';
      card.innerHTML = idSpan + header + textHtml + mediaHtml + actions;
      container.appendChild(card);
      updateCounts(chirp.id, card);
      checkIfLiked(chirp.id, card.querySelector('.chirp-actions span'));
    })(chirps[i]);
  }
}

function updateCounts(chirpId, card) {
  supabase.from('likes').select('id', { count: 'exact' }).eq('chirp_id', chirpId).then(function(res) {
    var countSpan = card.querySelector('.like-count');
    if (countSpan) countSpan.textContent = res.count;
  });
  supabase.from('comments').select('id', { count: 'exact' }).eq('chirp_id', chirpId).then(function(res) {
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
      supabase.from('likes').delete().eq('id', res.data.id).then(function() { updateLikeDisplay(chirpId, element); });
    } else {
      supabase.from('likes').insert({ user_id: currentUser.id, chirp_id: chirpId }).then(function() { updateLikeDisplay(chirpId, element); });
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
      if (likeRes.data) element.classList.add('liked');
      else element.classList.remove('liked');
    });
  });
}

function checkIfLiked(chirpId, element) {
  if (!currentUser) return;
  supabase.from('likes').select('id').eq('user_id', currentUser.id).eq('chirp_id', chirpId).single()
  .then(function(res) { if (res.data) element.classList.add('liked'); });
}

// ========== КОММЕНТАРИИ ==========
function openComments(chirpId) {
  if (!currentUser) return;
  window.currentChirpId = chirpId;
  document.getElementById('comment-input').value = '';
  document.getElementById('comment-spam-warning').style.display = 'none';
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
  if (text === lastCommentText) {
    document.getElementById('comment-spam-warning').textContent = 'Нельзя отправлять одинаковые комментарии подряд';
    document.getElementById('comment-spam-warning').style.display = 'block';
    return;
  }
  var now = Date.now();
  if (now - lastCommentTime < 10000) {
    document.getElementById('comment-spam-warning').textContent = 'Подождите 10 секунд';
    document.getElementById('comment-spam-warning').style.display = 'block';
    return;
  }
  supabase.from('comments').insert({ chirp_id: window.currentChirpId, user_id: currentUser.id, text: text })
  .then(function(res) {
    if (res.error) alert('Ошибка: ' + res.error.message);
    else {
      lastCommentTime = Date.now();
      lastCommentText = text;
      document.getElementById('comment-input').value = '';
      document.getElementById('comment-spam-warning').style.display = 'none';
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
  supabase.from('reports').insert({ chirp_id: window.reportChirpId, reporter_id: currentUser.id, reason: reason })
  .then(function(res) {
    if (res.error) alert('Ошибка отправки жалобы');
    else { alert('Жалоба отправлена'); closeModal('report-modal'); }
  });
}

// ========== ПОИСК ==========
function onSearchInput() {
  var query = document.getElementById('search-input').value.trim();
  if (!query || !query.startsWith('#')) { document.getElementById('search-results').innerHTML = ''; return; }
  var tag = query.substring(1);
  supabase.from('chirps').select('*, users!inner(nickname, verified)').ilike('text', '%#' + tag + '%')
  .order('created_at', { ascending: false }).then(function(res) {
    if (res.data) renderChirps(res.data, 'search-results');
  });
}

// ========== ПРОФИЛЬ ==========
function showProfile(userId) {
  if (!currentUser) return;
  supabase.from('users').select('*').eq('id', userId).single().then(function(userRes) {
    if (userRes.error) return;
    var user = userRes.data;
    var profileScreen = document.getElementById('screen-profile');
    profileScreen.innerHTML = '<div class="glass-card"><h2>' + user.nickname + (user.verified ? ' <span class="verified-badge">✓</span>' : '') + '</h2><p>' + (user.bio || '') + '</p><button class="btn-small" onclick="toggleFollow(\'' + user.id + '\')">' + (isFollowing(user.id) ? 'Отписаться' : 'Подписаться') + '</button></div><div id="profile-chirps"></div>';
    switchScreen('profile');
    loadProfileChirps(user.id);
  });
}

function loadProfileChirps(userId) {
  supabase.from('chirps').select('*, users!inner(nickname, verified)').eq('user_id', userId)
  .order('created_at', { ascending: false }).then(function(res) { renderChirps(res.data, 'profile-chirps'); });
}

function toggleFollow(userId) {
  if (!currentUser) return;
  supabase.from('follows').select('*').eq('follower_id', currentUser.id).eq('followed_id', userId).single()
  .then(function(res) {
    if (res.data) supabase.from('follows').delete().eq('id', res.data.id).then(function() { showProfile(userId); });
    else supabase.from('follows').insert({ follower_id: currentUser.id, followed_id: userId }).then(function() { showProfile(userId); });
  });
}

function isFollowing(userId) { return false; }

// ========== АДМИН-ПАНЕЛЬ ==========
function openAdminAccess() { document.getElementById('admin-pass-input').value = ''; openModal('admin-login-modal'); }

function adminLogin() {
  if (document.getElementById('admin-pass-input').value === adminPass) { closeModal('admin-login-modal'); openModal('admin-panel-modal'); switchAdminTab('users'); }
  else alert('Неверный пароль');
}

function switchAdminTab(tab) {
  var content = document.getElementById('admin-tab-content');
  if (tab === 'users') { content.innerHTML = '<input type="text" id="admin-user-search" class="input" placeholder="Поиск по нику или email" oninput="adminSearchUsers()"><div id="admin-users-list"></div>'; adminSearchUsers(); }
  else if (tab === 'reports') { content.innerHTML = '<div id="admin-reports-list"></div>'; loadAdminReports(); }
  else if (tab === 'messages') { content.innerHTML = '<div id="admin-messages-list"></div>'; loadAdminMessages(); }
}

function adminSearchUsers() {
  var query = document.getElementById('admin-user-search') ? document.getElementById('admin-user-search').value.trim() : '';
  var req = supabase.from('users').select('*').order('created_at');
  if (query) req = req.or('nickname.ilike.%' + query + '%,email.ilike.%' + query + '%');
  req.then(function(res) {
    var list = document.getElementById('admin-users-list');
    list.innerHTML = '';
    if (res.data) {
      for (var i = 0; i < res.data.length; i++) {
        var u = res.data[i];
        var age = calculateAge(u.birth_date);
        var warns = u.warns || 0;
        var div = document.createElement('div');
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '10px';
        div.innerHTML = '<b>' + u.nickname + '</b> (' + u.email + ') Возраст: ' + age + ' Предупреждений: ' + warns + ' ' + (u.verified ? '✓' : '') +
          ' <button class="btn-small" onclick="toggleVerify(\'' + u.id + '\')">Верификация</button>' +
          ' <button class="btn-small" onclick="warnUser(\'' + u.id + '\')">Предупредить</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'1h\')">Бан 1ч</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'24h\')">Бан 24ч</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'7d\')">Бан 7д</button>' +
          ' <button class="btn-small" onclick="banUser(\'' + u.id + '\', \'forever\')">Навсегда</button>' +
          ' <button class="btn-small" onclick="banUserIP(\'' + u.id + '\')">Бан по IP</button>' +
          ' <button class="btn-small btn-danger" onclick="destroyAccount(\'' + u.id + '\')">Снос</button>';
        list.appendChild(div);
      }
    }
  });
}

function warnUser(userId) {
  supabase.from('users').select('warns').eq('id', userId).single().then(function(res) {
    var currentWarns = (res.data && res.data.warns) ? res.data.warns : 0;
    var newWarns = currentWarns + 1;
    supabase.from('users').update({ warns: newWarns }).eq('id', userId).then(function() {
      if (newWarns >= 3) {
        var until = new Date(Date.now() + 86400000);
        supabase.from('users').update({ banned_until: until.toISOString() }).eq('id', userId).then(function() {
          alert('Пользователь получил 3 предупреждения и забанен на 24 часа');
        });
      } else {
        alert('Вынесено предупреждение. Всего: ' + newWarns);
      }
      adminSearchUsers();
    });
  });
}

function toggleVerify(userId) {
  supabase.from('users').select('verified').eq('id', userId).single().then(function(res) {
    supabase.from('users').update({ verified: !res.data.verified }).eq('id', userId).then(function() { adminSearchUsers(); });
  });
}

function banUser(userId, duration) {
  var until;
  if (duration === '1h') until = new Date(Date.now() + 3600000);
  else if (duration === '24h') until = new Date(Date.now() + 86400000);
  else if (duration === '7d') until = new Date(Date.now() + 604800000);
  else until = new Date('2099-01-01');
  supabase.from('users').update({ banned_until: until.toISOString() }).eq('id', userId).then(function() {
    alert('Пользователь забанен');
    adminSearchUsers();
  });
}

function banUserIP(userId) {
  supabase.from('users').select('ip').eq('id', userId).single().then(function(res) {
    if (res.data && res.data.ip) {
      supabase.from('banned_ips').insert({ ip: res.data.ip, reason: 'Бан пользователя #' + userId, banned_until: new Date('2099-01-01').toISOString() }).then(function() { alert('IP ' + res.data.ip + ' забанен'); });
    }
  });
}

function destroyAccount(userId) {
  if (!confirm('Вы уверены? Аккаунт будет уничтожен, все посты удалены, IP забанен навсегда.')) return;
  supabase.from('users').select('ip').eq('id', userId).single().then(function(userRes) {
    var ip = userRes.data ? userRes.data.ip : null;
    supabase.from('users').update({ banned_until: new Date('2099-01-01').toISOString() }).eq('id', userId).then(function() {
      if (ip) supabase.from('banned_ips').insert({ ip: ip, reason: 'Снос аккаунта #' + userId, banned_until: new Date('2099-01-01').toISOString() }).then(function(){});
      supabase.from('chirps').delete().eq('user_id', userId).then(function() { alert('Аккаунт уничтожен'); adminSearchUsers(); });
    });
  });
}

function deleteChirpById() {
  var id = document.getElementById('delete-post-id').value.trim();
  if (!id) return;
  supabase.from('chirps').delete().eq('id', id).then(function(res) {
    if (res.error) alert('Ошибка удаления: ' + res.error.message);
    else alert('Пост ' + id + ' удалён');
    document.getElementById('delete-post-id').value = '';
  });
}

function loadAdminReports() {
  supabase.from('reports').select('*, chirps(text, user_id, id), users!reporter_id(nickname)').order('created_at', { ascending: false })
  .then(function(res) {
    var list = document.getElementById('admin-reports-list');
    list.innerHTML = '';
    if (res.data) {
      for (var i = 0; i < res.data.length; i++) {
        var r = res.data[i];
        var div = document.createElement('div');
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '10px';
        div.innerHTML = '<b>От:</b> ' + r.users.nickname + '<br><b>Пост (ID):</b> ' + (r.chirps ? r.chirps.text + ' (' + r.chirps.id + ')' : 'удалён') + '<br><b>Причина:</b> ' + r.reason + '<br>' +
          '<button class="btn-small" onclick="deleteChirp(\'' + r.chirp_id + '\')">Удалить пост</button> ' +
          '<button class="btn-small" onclick="dismissReport(\'' + r.id + '\')">Отклонить</button>';
        list.appendChild(div);
      }
    }
  });
}

function deleteChirp(chirpId) { supabase.from('chirps').delete().eq('id', chirpId).then(function() { alert('Пост удалён'); loadAdminReports(); }); }
function dismissReport(reportId) { supabase.from('reports').delete().eq('id', reportId).then(function() { loadAdminReports(); }); }

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
  supabase.from('admin_messages').insert({ user_id: currentUser ? currentUser.id : null, message: message })
  .then(function(res) { if (res.error) alert('Ошибка'); else { alert('Сообщение отправлено'); closeModal('contact-modal'); } });
}

// ========== ДОКУМЕНТЫ ==========
function openDoc(type) {
  var docText = '';
  if (type === 'terms') {
    docText = '<h2>Условия использования NOBUQR.SPACE</h2>' +
      '<p><b>1. Общие положения.</b> Регистрируясь, вы соглашаетесь с настоящими Условиями. Сервис предназначен для лиц от 10 лет. Загрузка фото и видео разрешена только с 18 лет.</p>' +
      '<p><b>2. Обязанности пользователя.</b> Вы обязуетесь: не публиковать незаконный контент; не оскорблять других; не размещать порнографию, сцены насилия, экстремистские материалы; не спамить; не вводить в заблуждение относительно своего возраста.</p>' +
      '<p><b>3. Права администрации.</b> Мы вправе удалять любой контент, временно или навсегда блокировать аккаунты, банить по IP без объяснения причин. При подозрении на нарушение закона данные передаются правоохранительным органам.</p>' +
      '<p><b>4. Отказ от ответственности.</b> Сервис предоставляется «как есть». Администрация не несёт ответственности за ущерб, моральный вред, упущенную выгоду, повреждение устройств, возникшие в результате использования сервиса. Пользователь самостоятельно несёт полную ответственность за публикуемый контент.</p>' +
      '<p><b>5. Защита от судебных исков.</b> Создавая аккаунт, вы отказываетесь от любых претензий и судебных исков к владельцам, администраторам, хостинг-провайдерам сервиса. Все споры решаются путём переговоров. Если переговоры невозможны — спор рассматривается по месту нахождения владельца сервиса.</p>' +
      '<p><b>6. Изменения.</b> Условия могут меняться в любое время без уведомления. Продолжение использования означает согласие с новой редакцией.</p>';
  } else if (type === 'privacy') {
    docText = '<h2>Политика конфиденциальности</h2>' +
      '<p><b>1. Сбор данных.</b> Мы собираем: email, никнейм, дату рождения, IP-адрес. Пароль хранится исключительно в виде криптографического хеша (SHA-256 с солью).</p>' +
      '<p><b>2. Использование.</b> Данные используются исключительно для работы сервиса: авторизация, восстановление пароля, предотвращение нарушений, выявление мультиаккаунтов.</p>' +
      '<p><b>3. Хранение.</b> Данные хранятся в базе Supabase на европейских серверах. Ваш пароль не может быть восстановлен в исходном виде, только заменён администратором.</p>' +
      '<p><b>4. Передача третьим лицам.</b> Данные не продаются и не передаются, кроме случаев: запрос государственных органов; предотвращение преступлений; защита наших прав.</p>' +
      '<p><b>5. Cookie и localStorage.</b> Мы используем localStorage для хранения сессии (24 часа). Файлы cookie не используются.</p>' +
      '<p><b>6. Удаление данных.</b> Вы можете запросить удаление аккаунта через форму обратной связи или email: nobuqrspaceeee@outlook.com. Данные удаляются в течение 30 дней.</p>' +
      '<p><b>7. Защита.</b> Мы принимаем разумные меры для защиты данных, но не гарантируем абсолютную безопасность. В случае утечки мы уведомим вас по email.</p>';
  } else if (type === 'rules') {
    docText = '<h2>Правила сообщества NOBUQR.SPACE</h2>' +
      '<ol><li><b>Уважение.</b> Оскорбления, травля, дискриминация по любому признаку запрещены.</li>' +
      '<li><b>Контент 18+.</b> Порнография, эротика, откровенные сцены запрещены. Сервис 10+, но медиа — строго с 18.</li>' +
      '<li><b>Спам.</b> Массовая рассылка, реклама без согласования, боты запрещены. Автоматическая система удаляет рекламные посты.</li>' +
      '<li><b>Насилие и экстремизм.</b> Запрещены призывы к насилию, терроризм, разжигание ненависти.</li>' +
      '<li><b>Чужие данные.</b> Не публикуйте личную информацию других людей без их согласия.</li>' +
      '<li><b>Обход бана.</b> Создание новых аккаунтов для обхода бана запрещено. Карается сносом всех аккаунтов и вечным баном по IP.</li>' +
      '<li><b>Возраст.</b> Загрузка фото/видео только с 18 лет. Нарушение — снос аккаунта.</li>' +
      '<li><b>Предупреждения.</b> Система выносит предупреждения за нарушения. 3 предупреждения = бан на 24 часа.</li>' +
      '<li><b>Санкции.</b> Предупреждение → бан 1 час → бан 24 часа → бан 7 дней → бан навсегда → снос аккаунта + бан IP.</li>' +
      '<li><b>Обжалование.</b> Через форму обратной связи или nobuqrspaceeee@outlook.com. Решение администрации окончательное.</li></ol>' +
      '<p>Нарушая правила, вы соглашаетесь с применением любых санкций на усмотрение администрации.</p>';
  }
  document.getElementById('doc-text').innerHTML = docText;
  openModal('doc-modal');
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function calculateAge(birthDateStr) {
  var birth = new Date(birthDateStr);
  var now = new Date();
  var age = now.getFullYear() - birth.getFullYear();
  var monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function containsBadWords(text) { var bad = ['бля', 'хуй', 'пизд', 'ебан', 'залуп']; for (var i=0;i<bad.length;i++) if (text.toLowerCase().indexOf(bad[i])!==-1) return true; return false; }
function filterBadWords(text) { var bad = ['бля', 'хуй', 'пизд', 'ебан', 'залуп']; for (var i=0;i<bad.length;i++) { var reg=new RegExp(bad[i],'gi'); text=text.replace(reg,'***'); } return text; }
function filterContactInfo(text) { text=text.replace(/\+?\d{10,}/g,'[номер скрыт]'); text=text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,'[email скрыт]'); return text; }
function containsURL(text) { return /https?:\/\/\S+/i.test(text); }

function getIP(callback) {
  fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){callback(d.ip);}).catch(function(){callback('0.0.0.0');});
}

function loadUserProfile(userId) {
  supabase.from('users').select('*').eq('id', userId).single().then(function(res) {
    if (res.error || !res.data) { clearSession(); showAuthScreen(); return; }
    currentUser = res.data;
    showMainApp();
    loadFeed();
  });
}

function switchScreen(screenName) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
  document.getElementById('screen-' + screenName).classList.add('active');
  if (screenName === 'home') loadFeed();
}

// Глобальные функции
window.openModal = openModal;
window.closeModal = closeModal;
window.registerStep1 = registerStep1;
window.login = login;
window.logout = logout;
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
window.warnUser = warnUser;
window.banUser = banUser;
window.banUserIP = banUserIP;
window.destroyAccount = destroyAccount;
window.deleteChirpById = deleteChirpById;
window.deleteChirp = deleteChirp;
window.dismissReport = dismissReport;
window.sendContact = sendContact;
window.openDoc = openDoc;
window.switchScreen = switchScreen;