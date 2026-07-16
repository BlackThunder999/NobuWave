// ============================
// SUPABASE CONFIG
// ============================
const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O';
const ADMIN_PASSWORD = 'NobuWaveAdmin2024';

// ============================
// GLOBAL STATE
// ============================
let currentUser = null;
let currentScreen = 'feed';
let banCheckInterval = null;
let imageFile = null;
let subscriptions = [];

// ============================
// DOM ELEMENTS
// ============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const splashScreen = $('#splashScreen');
const authScreen = $('#authScreen');
const mainApp = $('#mainApp');
const banScreen = $('#banScreen');
const warningScreen = $('#warningScreen');
const composeModal = $('#composeModal');
const profileModal = $('#profileModal');
const commentsModal = $('#commentsModal');
const adminModal = $('#adminModal');
const editProfileModal = $('#editProfileModal');

const authForm = $('#authForm');
const authUsername = $('#authUsername');
const authPassword = $('#authPassword');
const authError = $('#authError');
const authSubmitBtn = $('#authSubmitBtn');
const authTabs = $$('.auth-tab');

let authMode = 'login';

// ============================
// API HELPERS
// ============================
async function api(method, path, body = null, isStorage = false) {
    const url = isStorage
        ? `${SUPABASE_URL}/storage/v1/object/${path}`
        : `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    };
    if (!isStorage && body !== null && method !== 'DELETE') {
        headers['Content-Type'] = 'application/json';
        headers['Prefer'] = method === 'POST' ? 'return=representation' : 'return=minimal';
    }
    const options = { method, headers };
    if (body && method !== 'DELETE') {
        options.body = isStorage ? body : JSON.stringify(body);
    }
    const res = await fetch(url, options);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API Error ${res.status}: ${errText}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ============================
// INIT
// ============================
function init() {
    const saved = localStorage.getItem('nobuchirp_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        checkBanAndWarnings().then(() => {
            if (!banScreen.style.display || banScreen.style.display === 'none') {
                if (!warningScreen.style.display || warningScreen.style.display === 'none') {
                    showMainApp();
                }
            }
        });
    }
    setTimeout(() => {
        splashScreen.style.display = 'none';
        if (!currentUser) showAuthScreen();
    }, 2000);
}

// ============================
// AUTH
// ============================
function showAuthScreen() {
    authScreen.style.display = 'flex';
    mainApp.style.display = 'none';
}

function showMainApp() {
    authScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    loadFeed();
    startBanCheck();
}

authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        authMode = tab.dataset.tab;
        authSubmitBtn.textContent = authMode === 'login' ? 'Войти' : 'Зарегистрироваться';
        authError.textContent = '';
    });
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = authUsername.value.trim();
    const password = authPassword.value.trim();
    if (!username || !password) {
        authError.textContent = 'Заполните все поля';
        return;
    }
    if (username.length < 2) {
        authError.textContent = 'Никнейм должен быть от 2 символов';
        return;
    }
    if (password.length < 4) {
        authError.textContent = 'Пароль должен быть от 4 символов';
        return;
    }
    authSubmitBtn.disabled = true;
    authError.textContent = '';

    try {
        if (authMode === 'register') {
            const existing = await api('GET', `users?username=eq.${encodeURIComponent(username)}&select=id`);
            if (existing && existing.length > 0) {
                authError.textContent = 'Никнейм уже занят';
                authSubmitBtn.disabled = false;
                return;
            }
            const newUser = await api('POST', 'users', {
                username,
                password,
                avatar_emoji: '👤',
                bio: '',
                is_verified: false,
                is_banned: false,
                streak_count: 0
            });
            if (newUser && newUser.length > 0) {
                currentUser = newUser[0];
            }
        } else {
            const users = await api('GET', `users?username=eq.${encodeURIComponent(username)}&password=eq.${encodeURIComponent(password)}&select=*`);
            if (!users || users.length === 0) {
                authError.textContent = 'Неверный никнейм или пароль';
                authSubmitBtn.disabled = false;
                return;
            }
            currentUser = users[0];
        }

        localStorage.setItem('nobuchirp_user', JSON.stringify(currentUser));
        await checkBanAndWarnings();
        if (banScreen.style.display === 'flex' || warningScreen.style.display === 'flex') {
            authSubmitBtn.disabled = false;
            return;
        }
        showMainApp();
    } catch (err) {
        authError.textContent = 'Ошибка соединения';
    }
    authSubmitBtn.disabled = false;
});

// ============================
// BAN & WARNING CHECKS
// ============================
async function checkBanAndWarnings() {
    if (!currentUser) return;
    try {
        const users = await api('GET', `users?id=eq.${currentUser.id}&select=*`);
        if (users && users.length > 0) {
            const u = users[0];
            currentUser = u;
            localStorage.setItem('nobuchirp_user', JSON.stringify(u));

            if (u.is_banned) {
                const now = new Date();
                if (u.ban_expires && new Date(u.ban_expires) < now) {
                    await api('PATCH', `users?id=eq.${u.id}`, {
                        is_banned: false,
                        ban_reason: null,
                        ban_expires: null
                    });
                    currentUser.is_banned = false;
                    localStorage.setItem('nobuchirp_user', JSON.stringify(currentUser));
                    banScreen.style.display = 'none';
                } else {
                    showBanScreen(u.ban_reason, u.ban_expires);
                    return;
                }
            } else {
                banScreen.style.display = 'none';
            }
        }

        const warnings = await api('GET', `warnings?user_id=eq.${currentUser.id}&is_read=eq.false&order=created_at.desc`);
        if (warnings && warnings.length > 0) {
            showWarningScreen(warnings[0]);
            return;
        } else {
            warningScreen.style.display = 'none';
        }
    } catch (e) {}
}

function startBanCheck() {
    if (banCheckInterval) clearInterval(banCheckInterval);
    banCheckInterval = setInterval(checkBanAndWarnings, 10000);
}

function showBanScreen(reason, expires) {
    banScreen.style.display = 'flex';
    $('#banReason').textContent = `Причина: ${reason || 'Нарушение правил'}`;
    if (expires) {
        const expDate = new Date(expires);
        $('#banExpires').textContent = `Разбан: ${expDate.toLocaleDateString('ru-RU')} ${expDate.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}`;
    } else {
        $('#banExpires').textContent = 'Бан навсегда';
    }
    $('#banRules').innerHTML = `
        <p>📜 Правила:</p>
        <p>1. Без оскорблений<br>2. Без спама<br>3. Без 18+<br>4. Без наркотиков<br>5. Без угроз</p>
    `;
    startCountdown('banTimer', 180);
    mainApp.style.display = 'none';
    authScreen.style.display = 'none';
}

function showWarningScreen(warning) {
    warningScreen.style.display = 'flex';
    $('#warningReason').textContent = `Причина: ${warning.reason || 'Нарушение правил'}`;
    startCountdown('warningTimer', 180, () => {
        $('#warningDismissBtn').disabled = false;
    });
    mainApp.style.display = 'none';
    authScreen.style.display = 'none';
}

$('#warningDismissBtn').addEventListener('click', async () => {
    try {
        const warnings = await api('GET', `warnings?user_id=eq.${currentUser.id}&is_read=eq.false`);
        if (warnings && warnings.length > 0) {
            await api('PATCH', `warnings?id=eq.${warnings[0].id}`, { is_read: true });
        }
    } catch (e) {}
    warningScreen.style.display = 'none';
    showMainApp();
});

function startCountdown(elementId, seconds, callback) {
    const el = $(`#${elementId}`);
    let remaining = seconds;
    el.textContent = formatTime(remaining);
    const interval = setInterval(() => {
        remaining--;
        el.textContent = formatTime(remaining);
        if (remaining <= 0) {
            clearInterval(interval);
            if (callback) callback();
        }
    }, 1000);
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================
// FEED
// ============================
async function loadFeed() {
    const container = $('#feedContainer');
    container.innerHTML = '<div class="feed-loading">Загрузка...</div>';
    try {
        const chirps = await api('GET', 'chirps?order=created_at.desc&limit=50');
        renderChirps(container, chirps || []);
    } catch (e) {
        container.innerHTML = '<div class="feed-loading">Ошибка загрузки</div>';
    }
}

async function loadSubscriptionsFeed() {
    const container = $('#subscriptionsContainer');
    if (subscriptions.length === 0) {
        container.innerHTML = '<p class="empty-feed">Подпишитесь на пользователей, чтобы видеть их посты</p>';
        return;
    }
    container.innerHTML = '<div class="feed-loading">Загрузка...</div>';
    try {
        const ids = subscriptions.map(s => `"${s}"`).join(',');
        const chirps = await api('GET', `chirps?user_id=in.(${ids})&order=created_at.desc&limit=50`);
        renderChirps(container, chirps || []);
    } catch (e) {
        container.innerHTML = '<div class="feed-loading">Ошибка загрузки</div>';
    }
}

function renderChirps(container, chirps) {
    if (chirps.length === 0) {
        container.innerHTML = '<p class="empty-feed">Пока нет постов</p>';
        return;
    }
    container.innerHTML = chirps.map(c => chirpCardHTML(c)).join('');
    attachChirpEvents(container);
}

function chirpCardHTML(c) {
    const time = new Date(c.created_at).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const verifiedIcon = c.is_verified ? ' <span class="verified-badge"><i class="fa-solid fa-circle-check"></i></span>' : '';
    const fireIcon = c.is_fire ? ' <span class="fire-badge">🔥</span>' : '';
    const imageHTML = c.image_url
        ? `<img class="chirp-image" src="${c.image_url}" alt="" loading="lazy" onclick="window.open('${c.image_url}')">`
        : '';
    const contentHTML = c.content.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
    const shortId = c.id.substring(0, 8);

    return `
        <div class="chirp-card" data-id="${c.id}">
            <div class="chirp-header">
                <span class="chirp-avatar">${c.avatar_emoji || '👤'}</span>
                <span class="chirp-username">${escapeHTML(c.username)}${verifiedIcon}${fireIcon}</span>
                <span class="chirp-time">${time}</span>
            </div>
            <div class="chirp-content">${contentHTML}</div>
            ${imageHTML}
            <div class="chirp-actions">
                <button class="chirp-action like-btn" data-chirp="${c.id}">
                    <i class="fa-regular fa-heart"></i> <span>${c.likes || 0}</span>
                </button>
                <button class="chirp-action dislike-btn" data-chirp="${c.id}">
                    <i class="fa-regular fa-thumbs-down"></i> <span>${c.dislikes || 0}</span>
                </button>
                <button class="chirp-action rechirp-btn" data-chirp="${c.id}">
                    <i class="fa-solid fa-retweet"></i> <span>${c.rechirps || 0}</span>
                </button>
                <button class="chirp-action comment-btn" data-chirp="${c.id}">
                    <i class="fa-regular fa-comment"></i>
                </button>
                <button class="chirp-action report-btn" data-chirp="${c.id}">
                    <i class="fa-regular fa-flag"></i>
                </button>
            </div>
            <span class="chirp-id" data-id="${c.id}" title="Копировать ID">#${shortId}</span>
        </div>
    `;
}

function attachChirpEvents(container) {
    container.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', () => handleLike(btn.dataset.chirp));
    });
    container.querySelectorAll('.dislike-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDislike(btn.dataset.chirp));
    });
    container.querySelectorAll('.rechirp-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRechirp(btn.dataset.chirp));
    });
    container.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', () => openComments(btn.dataset.chirp));
    });
    container.querySelectorAll('.report-btn').forEach(btn => {
        btn.addEventListener('click', () => handleReport(btn.dataset.chirp));
    });
    container.querySelectorAll('.chirp-id').forEach(el => {
        el.addEventListener('click', () => {
            navigator.clipboard.writeText(el.dataset.id);
            showToast('ID скопирован');
        });
    });
}

// ============================
// ACTIONS
// ============================
async function handleLike(chirpId) {
    if (!currentUser) return;
    try {
        const existing = await api('GET', `likes?user_id=eq.${currentUser.id}&chirp_id=eq.${chirpId}`);
        if (existing && existing.length > 0) {
            await api('DELETE', `likes?id=eq.${existing[0].id}`);
            await api('PATCH', `chirps?id=eq.${chirpId}`, { likes: await getCount('likes', chirpId) });
        } else {
            await api('POST', 'likes', { user_id: currentUser.id, chirp_id: chirpId });
            await api('DELETE', `dislikes?user_id=eq.${currentUser.id}&chirp_id=eq.${chirpId}`);
            const likesCount = await getCount('likes', chirpId);
            const dislikesCount = await getCount('dislikes', chirpId);
            await api('PATCH', `chirps?id=eq.${chirpId}`, { likes: likesCount, dislikes: dislikesCount });
        }
        refreshCurrentScreen();
    } catch (e) {}
}

async function handleDislike(chirpId) {
    if (!currentUser) return;
    try {
        const existing = await api('GET', `dislikes?user_id=eq.${currentUser.id}&chirp_id=eq.${chirpId}`);
        if (existing && existing.length > 0) {
            await api('DELETE', `dislikes?id=eq.${existing[0].id}`);
            await api('PATCH', `chirps?id=eq.${chirpId}`, { dislikes: await getCount('dislikes', chirpId) });
        } else {
            await api('POST', 'dislikes', { user_id: currentUser.id, chirp_id: chirpId });
            await api('DELETE', `likes?user_id=eq.${currentUser.id}&chirp_id=eq.${chirpId}`);
            const likesCount = await getCount('likes', chirpId);
            const dislikesCount = await getCount('dislikes', chirpId);
            await api('PATCH', `chirps?id=eq.${chirpId}`, { likes: likesCount, dislikes: dislikesCount });
        }
        refreshCurrentScreen();
    } catch (e) {}
}

async function handleRechirp(chirpId) {
    if (!currentUser) return;
    try {
        const existing = await api('GET', `rechirps?user_id=eq.${currentUser.id}&chirp_id=eq.${chirpId}`);
        if (existing && existing.length > 0) {
            showToast('Вы уже делали речирп');
            return;
        }
        await api('POST', 'rechirps', { user_id: currentUser.id, chirp_id: chirpId });
        await api('PATCH', `chirps?id=eq.${chirpId}`, { rechirps: await getCount('rechirps', chirpId) });
        refreshCurrentScreen();
    } catch (e) {}
}

async function getCount(table, chirpId) {
    try {
        const res = await api('GET', `${table}?chirp_id=eq.${chirpId}&select=id`);
        return res ? res.length : 0;
    } catch (e) { return 0; }
}

function refreshCurrentScreen() {
    if (currentScreen === 'feed') loadFeed();
    else if (currentScreen === 'subscriptions') loadSubscriptionsFeed();
}

// ============================
// COMPOSE
// ============================
$('#composeNavBtn').addEventListener('click', openCompose);
$('#composeClose').addEventListener('click', closeCompose);
$('#composeContent').addEventListener('input', () => {
    $('#charCount').textContent = $('#composeContent').value.length;
});
$('#composeImage').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        imageFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            $('#composePreviewImg').src = ev.target.result;
            $('#composePreview').style.display = 'inline-block';
        };
        reader.readAsDataURL(imageFile);
    }
});
$('#removePreview').addEventListener('click', () => {
    imageFile = null;
    $('#composeImage').value = '';
    $('#composePreview').style.display = 'none';
});
$('#composeSubmit').addEventListener('click', submitChirp);

function openCompose() {
    if (!currentUser) return;
    composeModal.style.display = 'flex';
    $('#composeContent').value = '';
    $('#charCount').textContent = '0';
    imageFile = null;
    $('#composeImage').value = '';
    $('#composePreview').style.display = 'none';
    $('#composeContent').focus();
}

function closeCompose() {
    composeModal.style.display = 'none';
}

async function submitChirp() {
    const content = $('#composeContent').value.trim();
    if (!content) { showToast('Напишите текст'); return; }
    if (content.length > 280) { showToast('Максимум 280 символов'); return; }
    if (!currentUser) return;

    const submitBtn = $('#composeSubmit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        let imageUrl = null;
        if (imageFile) {
            const filePath = `chirps/${currentUser.id}/${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            await api('POST', `images/${filePath}`, imageFile, true);
            imageUrl = `${SUPABASE_URL}/storage/v1/object/public/images/${filePath}`;
        }

        const hashtags = (content.match(/#(\w+)/g) || []).map(h => h.toLowerCase());
        const today = new Date().toISOString().split('T')[0];

        // Streak check
        let isFire = false;
        let streakCount = currentUser.streak_count || 0;
        if (currentUser.last_post_date) {
            const lastDate = new Date(currentUser.last_post_date);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (currentUser.last_post_date === yesterday.toISOString().split('T')[0]) {
                streakCount++;
                if (streakCount >= 2) isFire = true;
            } else if (currentUser.last_post_date !== today) {
                streakCount = 1;
            }
        } else {
            streakCount = 1;
        }

        await api('POST', 'chirps', {
            user_id: currentUser.id,
            username: currentUser.username,
            avatar_emoji: currentUser.avatar_emoji || '👤',
            content,
            image_url: imageUrl,
            likes: 0,
            dislikes: 0,
            rechirps: 0,
            hashtags,
            is_fire: isFire,
            is_verified: currentUser.is_verified || false
        });

        await api('PATCH', `users?id=eq.${currentUser.id}`, {
            streak_count: streakCount,
            last_post_date: today
        });

        // Update trends
        for (const tag of hashtags) {
            const existing = await api('GET', `trends?hashtag=eq.${encodeURIComponent(tag)}`);
            if (existing && existing.length > 0) {
                await api('PATCH', `trends?id=eq.${existing[0].id}`, {
                    count: existing[0].count + 1,
                    updated_at: new Date().toISOString()
                });
            } else {
                await api('POST', 'trends', { hashtag: tag, count: 1 });
            }
        }

        currentUser.streak_count = streakCount;
        currentUser.last_post_date = today;
        localStorage.setItem('nobuchirp_user', JSON.stringify(currentUser));

        closeCompose();
        loadFeed();
        showToast('Опубликовано!');
    } catch (e) {
        showToast('Ошибка публикации');
    }
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-feather"></i> Чирикнуть';
}

// ============================
// COMMENTS
// ============================
async function openComments(chirpId) {
    commentsModal.style.display = 'flex';
    $('#commentsModalContent').innerHTML = '<div class="feed-loading">Загрузка...</div>';
    try {
        const chirp = await api('GET', `chirps?id=eq.${chirpId}&select=*`);
        const comments = await api('GET', `comments?chirp_id=eq.${chirpId}&order=created_at.asc`);
        const chirpData = chirp ? chirp[0] : null;
        $('#commentsModalContent').innerHTML = `
            <div class="modal-header">
                <h3>Комментарии</h3>
                <button class="modal-close" onclick="document.getElementById('commentsModal').style.display='none'">&times;</button>
            </div>
            ${chirpData ? `<div class="comment-item"><span class="comment-user">${escapeHTML(chirpData.username)}</span><p class="comment-text">${escapeHTML(chirpData.content.substring(0, 100))}</p></div>` : ''}
            <div id="commentsList">
                ${(comments || []).map(c => `
                    <div class="comment-item">
                        <span class="comment-user">${escapeHTML(c.username)}</span>
                        <p class="comment-text">${escapeHTML(c.content)}</p>
                    </div>
                `).join('')}
            </div>
            <div class="comment-input-row">
                <input type="text" id="commentInput" placeholder="Написать комментарий..." maxlength="280">
                <button id="submitCommentBtn" data-chirp="${chirpId}">Отправить</button>
            </div>
        `;
        $('#submitCommentBtn').addEventListener('click', async () => {
            const input = $('#commentInput');
            const text = input.value.trim();
            if (!text) return;
            const btn = $('#submitCommentBtn');
            btn.disabled = true;
            try {
                await api('POST', 'comments', {
                    chirp_id: chirpId,
                    user_id: currentUser.id,
                    username: currentUser.username,
                    content: text
                });
                input.value = '';
                openComments(chirpId);
            } catch (e) {
                showToast('Ошибка');
            }
            btn.disabled = false;
        });
    } catch (e) {
        $('#commentsModalContent').innerHTML = '<p>Ошибка загрузки</p>';
    }
}

// ============================
// REPORT
// ============================
async function handleReport(chirpId) {
    const reason = prompt('Причина жалобы:');
    if (!reason) return;
    try {
        await api('POST', 'reports', {
            from_user: currentUser.id,
            from_username: currentUser.username,
            chirp_id: chirpId,
            reason
        });
        showToast('Жалоба отправлена');
    } catch (e) {
        showToast('Ошибка');
    }
}

// ============================
// PROFILE
// ============================
$('#headerProfileBtn').addEventListener('click', () => openProfile(currentUser.id));

async function openProfile(userId) {
    profileModal.style.display = 'flex';
    $('#profileModalContent').innerHTML = '<div class="feed-loading">Загрузка...</div>';
    try {
        const users = await api('GET', `users?id=eq.${userId}&select=*`);
        if (!users || users.length === 0) { $('#profileModalContent').innerHTML = '<p>Пользователь не найден</p>'; return; }
        const user = users[0];

        const followersCount = await api('GET', `follows?following_id=eq.${userId}&select=id`);
        const followingCount = await api('GET', `follows?follower_id=eq.${userId}&select=id`);
        const chirpsCount = await api('GET', `chirps?user_id=eq.${userId}&select=id`);

        const isOwnProfile = currentUser && currentUser.id === userId;
        const isFollowing = subscriptions.includes(userId);
        const verifiedIcon = user.is_verified ? ' <span class="verified-badge"><i class="fa-solid fa-circle-check"></i></span>' : '';

        let actionBtn = '';
        if (isOwnProfile) {
            actionBtn = `<button class="profile-btn edit" id="profileEditBtn">✏️ Редактировать</button>
                         <button class="profile-btn info" id="profileAdminBtn">⚙️ Админка</button>`;
        } else {
            actionBtn = isFollowing
                ? `<button class="profile-btn unfollow" id="profileFollowBtn" data-user="${userId}">Отписаться</button>`
                : `<button class="profile-btn follow" id="profileFollowBtn" data-user="${userId}">Подписаться</button>`;
        }

        $('#profileModalContent').innerHTML = `
            <div class="modal-header">
                <h3>Профиль</h3>
                <button class="modal-close" onclick="document.getElementById('profileModal').style.display='none'">&times;</button>
            </div>
            <span class="profile-avatar-large">${user.avatar_emoji || '👤'}</span>
            <div class="profile-username">${escapeHTML(user.username)}${verifiedIcon}</div>
            <p class="profile-bio">${escapeHTML(user.bio || '')}</p>
            <div class="profile-stats">
                <div class="profile-stat"><span class="count">${chirpsCount ? chirpsCount.length : 0}</span><span class="label">Посты</span></div>
                <div class="profile-stat"><span class="count">${followersCount ? followersCount.length : 0}</span><span class="label">Подписчики</span></div>
                <div class="profile-stat"><span class="count">${followingCount ? followingCount.length : 0}</span><span class="label">Подписки</span></div>
            </div>
            ${actionBtn}
            <div class="profile-chirps" id="profileChirpsList">
                <h4>Посты пользователя</h4>
                <div class="feed-loading">Загрузка...</div>
            </div>
        `;

        if (isOwnProfile) {
            $('#profileEditBtn').addEventListener('click', openEditProfile);
            $('#profileAdminBtn').addEventListener('click', openAdminPanel);
        } else {
            $('#profileFollowBtn').addEventListener('click', () => toggleFollow(userId));
        }

        const userChirps = await api('GET', `chirps?user_id=eq.${userId}&order=created_at.desc&limit=20`);
        $('#profileChirpsList').innerHTML = '<h4>Посты пользователя</h4>';
        if (userChirps && userChirps.length > 0) {
            $('#profileChirpsList').innerHTML += userChirps.map(c => chirpCardHTML(c)).join('');
            attachChirpEvents($('#profileChirpsList'));
        } else {
            $('#profileChirpsList').innerHTML += '<p style="color:#888;font-size:13px;">Нет постов</p>';
        }
    } catch (e) {
        $('#profileModalContent').innerHTML = '<p>Ошибка загрузки</p>';
    }
}

async function toggleFollow(userId) {
    try {
        const existing = await api('GET', `follows?follower_id=eq.${currentUser.id}&following_id=eq.${userId}`);
        if (existing && existing.length > 0) {
            await api('DELETE', `follows?id=eq.${existing[0].id}`);
            subscriptions = subscriptions.filter(id => id !== userId);
        } else {
            await api('POST', 'follows', { follower_id: currentUser.id, following_id: userId });
            subscriptions.push(userId);
        }
        openProfile(userId);
    } catch (e) {}
}

async function loadSubscriptions() {
    if (!currentUser) return;
    try {
        const follows = await api('GET', `follows?follower_id=eq.${currentUser.id}&select=following_id`);
        subscriptions = follows ? follows.map(f => f.following_id) : [];
    } catch (e) {
        subscriptions = [];
    }
}

// ============================
// EDIT PROFILE
// ============================
function openEditProfile() {
    editProfileModal.style.display = 'flex';
    $('#editAvatarEmoji').value = currentUser.avatar_emoji || '👤';
    $('#editBio').value = currentUser.bio || '';
}
$('#editProfileClose').addEventListener('click', () => { editProfileModal.style.display = 'none'; });
$('#saveProfileBtn').addEventListener('click', async () => {
    const avatarEmoji = $('#editAvatarEmoji').value.trim() || '👤';
    const bio = $('#editBio').value.trim();
    try {
        await api('PATCH', `users?id=eq.${currentUser.id}`, { avatar_emoji: avatarEmoji, bio });
        currentUser.avatar_emoji = avatarEmoji;
        currentUser.bio = bio;
        localStorage.setItem('nobuchirp_user', JSON.stringify(currentUser));
        $('#headerAvatar').textContent = avatarEmoji;
        editProfileModal.style.display = 'none';
        profileModal.style.display = 'none';
        showToast('Профиль обновлён');
    } catch (e) {
        showToast('Ошибка');
    }
});

// ============================
// ADMIN
// ============================
function openAdminPanel() {
    const password = prompt('Введите пароль администратора:');
    if (password !== ADMIN_PASSWORD) { showToast('Неверный пароль'); return; }
    adminModal.style.display = 'flex';
    loadAdminData();
}

async function loadAdminData() {
    $('#adminModalContent').innerHTML = '<div class="feed-loading">Загрузка...</div>';
    try {
        const reports = await api('GET', 'reports?order=created_at.desc&limit=30');
        const bans = await api('GET', 'users?is_banned=eq.true&select=*');

        let reportsHTML = (reports || []).map(r => `
            <div style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:12px;">
                <b>${escapeHTML(r.from_username)}</b> → пост <code>${r.chirp_id ? r.chirp_id.substring(0,8) : '?'}</code><br>
                Причина: ${escapeHTML(r.reason)}<br>
                <button class="admin-btn danger" onclick="deleteChirpAdmin('${r.chirp_id}')">Удалить пост</button>
            </div>
        `).join('') || '<p style="color:#888;">Нет жалоб</p>';

        let bansHTML = (bans || []).map(b => `
            <div style="padding:8px 0;border-bottom:1px solid #2a2a2a;font-size:12px;">
                <b>${escapeHTML(b.username)}</b> — ${escapeHTML(b.ban_reason || '')}<br>
                До: ${b.ban_expires ? new Date(b.ban_expires).toLocaleDateString('ru-RU') : 'Навсегда'}<br>
                <button class="admin-btn success" onclick="unbanUserAdmin('${b.id}')">Разбанить</button>
            </div>
        `).join('') || '<p style="color:#888;">Нет банов</p>';

        $('#adminModalContent').innerHTML = `
            <div class="modal-header">
                <h3>⚙️ Админ-панель</h3>
                <button class="modal-close" onclick="document.getElementById('adminModal').style.display='none'">&times;</button>
            </div>
            <div class="admin-section">
                <h4>🔨 Бан пользователя</h4>
                <div class="admin-row">
                    <input type="text" id="adminBanUsername" placeholder="Никнейм">
                    <select id="adminBanDuration">
                        <option value="1">1 день</option>
                        <option value="7">7 дней</option>
                        <option value="30">30 дней</option>
                        <option value="forever">Навсегда</option>
                    </select>
                </div>
                <input type="text" class="admin-input" id="adminBanReason" placeholder="Причина бана">
                <button class="admin-btn danger" id="adminBanBtn">Забанить</button>
            </div>
            <div class="admin-section">
                <h4>⚠️ Предупреждение</h4>
                <input type="text" class="admin-input" id="adminWarnUsername" placeholder="Никнейм">
                <input type="text" class="admin-input" id="adminWarnReason" placeholder="Причина">
                <button class="admin-btn warn" id="adminWarnBtn">Предупредить</button>
            </div>
            <div class="admin-section">
                <h4>✅ Верификация</h4>
                <input type="text" class="admin-input" id="adminVerifyUsername" placeholder="Никнейм">
                <button class="admin-btn info" id="adminVerifyBtn">Выдать галочку</button>
            </div>
            <div class="admin-section">
                <h4>🗑️ Удалить пост</h4>
                <input type="text" class="admin-input" id="adminDeletePostId" placeholder="ID поста">
                <button class="admin-btn danger" id="adminDeletePostBtn">Удалить</button>
            </div>
            <div class="admin-section">
                <h4>🔍 Просмотр профиля</h4>
                <input type="text" class="admin-input" id="adminViewProfile" placeholder="Никнейм">
                <button class="admin-btn info" id="adminViewProfileBtn">Смотреть</button>
            </div>
            <div class="admin-section">
                <h4>📋 Жалобы</h4>
                ${reportsHTML}
            </div>
            <div class="admin-section">
                <h4>🚫 Активные баны</h4>
                ${bansHTML}
            </div>
        `;

        $('#adminBanBtn').addEventListener('click', async () => {
            const username = $('#adminBanUsername').value.trim();
            const duration = $('#adminBanDuration').value;
            const reason = $('#adminBanReason').value.trim();
            if (!username) return;
            const users = await api('GET', `users?username=eq.${encodeURIComponent(username)}&select=*`);
            if (!users || users.length === 0) { showToast('Пользователь не найден'); return; }
            const userId = users[0].id;
            let banExpires = null;
            if (duration !== 'forever') {
                const d = new Date();
                d.setDate(d.getDate() + parseInt(duration));
                banExpires = d.toISOString();
            }
            await api('PATCH', `users?id=eq.${userId}`, {
                is_banned: true,
                ban_reason: reason,
                ban_expires: banExpires
            });
            showToast('Пользователь забанен');
            loadAdminData();
        });

        $('#adminWarnBtn').addEventListener('click', async () => {
            const username = $('#adminWarnUsername').value.trim();
            const reason = $('#adminWarnReason').value.trim();
            if (!username) return;
            const users = await api('GET', `users?username=eq.${encodeURIComponent(username)}&select=*`);
            if (!users || users.length === 0) { showToast('Пользователь не найден'); return; }
            await api('POST', 'warnings', {
                user_id: users[0].id,
                username: users[0].username,
                reason
            });
            showToast('Предупреждение выдано');
            loadAdminData();
        });

        $('#adminVerifyBtn').addEventListener('click', async () => {
            const username = $('#adminVerifyUsername').value.trim();
            if (!username) return;
            const users = await api('GET', `users?username=eq.${encodeURIComponent(username)}&select=*`);
            if (!users || users.length === 0) { showToast('Пользователь не найден'); return; }
            await api('PATCH', `users?id=eq.${users[0].id}`, { is_verified: true });
            showToast('Галочка выдана');
            loadAdminData();
        });

        $('#adminDeletePostBtn').addEventListener('click', async () => {
            const postId = $('#adminDeletePostId').value.trim();
            if (!postId) return;
            await api('DELETE', `chirps?id=eq.${postId}`);
            showToast('Пост удалён');
            loadAdminData();
        });

        $('#adminViewProfileBtn').addEventListener('click', async () => {
            const username = $('#adminViewProfile').value.trim();
            if (!username) return;
            const users = await api('GET', `users?username=eq.${encodeURIComponent(username)}&select=*`);
            if (!users || users.length === 0) { showToast('Пользователь не найден'); return; }
            adminModal.style.display = 'none';
            openProfile(users[0].id);
        });
    } catch (e) {
        $('#adminModalContent').innerHTML = '<p>Ошибка</p>';
    }
}

async function deleteChirpAdmin(chirpId) {
    if (!chirpId) return;
    await api('DELETE', `chirps?id=eq.${chirpId}`);
    showToast('Пост удалён');
    loadAdminData();
}

async function unbanUserAdmin(userId) {
    await api('PATCH', `users?id=eq.${userId}`, {
        is_banned: false,
        ban_reason: null,
        ban_expires: null
    });
    showToast('Пользователь разбанен');
    loadAdminData();
}

// Expose to global for inline onclick
window.deleteChirpAdmin = deleteChirpAdmin;
window.unbanUserAdmin = unbanUserAdmin;

// ============================
// TRENDS
// ============================
async function loadTrends() {
    const container = $('#trendsContainer');
    container.innerHTML = '<div class="feed-loading">Загрузка...</div>';
    try {
        const trends = await api('GET', 'trends?order=count.desc&limit=20');
        if (!trends || trends.length === 0) {
            container.innerHTML = '<p class="empty-feed">Нет трендов</p>';
            return;
        }
        container.innerHTML = trends.map(t => `
            <div class="trend-item">
                <span class="trend-hashtag">${t.hashtag}</span>
                <span class="trend-count">${t.count} упоминаний</span>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p class="empty-feed">Ошибка</p>';
    }
}

// ============================
// NAVIGATION
// ============================
$$('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        switchScreen(screen);
    });
});

function switchScreen(screen) {
    currentScreen = screen;
    $$('.screen').forEach(s => s.classList.remove('active'));
    $$('.nav-btn[data-screen]').forEach(b => b.classList.remove('active'));
    $(`#screen-${screen}`).classList.add('active');
    const navBtn = document.querySelector(`.nav-btn[data-screen="${screen}"]`);
    if (navBtn) navBtn.classList.add('active');

    if (screen === 'feed') loadFeed();
    else if (screen === 'subscriptions') loadSubscriptionsFeed();
    else if (screen === 'trends') loadTrends();
}

// ============================
// MODAL BACKDROP CLICKS
// ============================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        composeModal.style.display = 'none';
        profileModal.style.display = 'none';
        commentsModal.style.display = 'none';
        adminModal.style.display = 'none';
        editProfileModal.style.display = 'none';
    }
});

// ============================
// UTILS
// ============================
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2300);
}

// ============================
// REALTIME (POLLING)
// ============================
let lastFeedUpdate = Date.now();
setInterval(async () => {
    if (currentScreen === 'feed' && mainApp.style.display === 'flex') {
        try {
            const chirps = await api('GET', `chirps?order=created_at.desc&limit=1`);
            if (chirps && chirps.length > 0) {
                const latestTime = new Date(chirps[0].created_at).getTime();
                if (latestTime > lastFeedUpdate) {
                    lastFeedUpdate = latestTime;
                    loadFeed();
                }
            }
        } catch (e) {}
    }
}, 5000);

// ============================
// STARTUP
// ============================
init();
loadSubscriptions();

// Update header avatar
setTimeout(() => {
    if (currentUser) {
        $('#headerAvatar').textContent = currentUser.avatar_emoji || '👤';
    }
}, 100);