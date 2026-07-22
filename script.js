// ==================== КОНФИГУРАЦИЯ ====================
const SUPABASE_URL = 'https://iljsednetiogjtowlexo.supabase.co'
const SUPABASE_KEY = 'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
const ADMIN_EMAIL = 'nobuqrspaceeee@outlook.com'
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const EMAILJS = {
    enabled: true,
    publicKey: 'gXxOqmU-XXnrVz8FHro2jA',
    serviceId: 'service_yixc9cg',
    templateVerify: 'template_4mj9a5o',
    templateNotify: 'template_t5dw8ot'
}

if (EMAILJS.enabled) emailjs.init(EMAILJS.publicKey)

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentUser = null
let lastPostTime = 0
let selectedMediaFile = null
let selectedMediaType = null
let pendingEmail = null

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', () => {
    const s = localStorage.getItem('nobuqr_session')
    if (s && Date.now() < JSON.parse(s).expiry) {
        currentUser = JSON.parse(s).user
        showApp()
    }
})

function showApp() {
    document.getElementById('authScreen').classList.remove('active')
    document.getElementById('feedScreen').classList.add('active')
    document.getElementById('mainHeader').style.display = 'flex'
    document.getElementById('bottomNav').style.display = 'flex'
    if (currentUser?.is_admin) {
        document.getElementById('adminNavBtn').style.display = 'block'
    }
    loadFeed()
}

// ==================== НАВИГАЦИЯ ====================
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
    document.getElementById(name).classList.add('active')
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
    event.target.classList.add('active')
    if (name === 'feedScreen') loadFeed()
    if (name === 'profileScreen') loadProfile(currentUser?.id)
}

function showAuthTab(tab) {
    document.getElementById('loginForm').classList.toggle('active', tab === 'login')
    document.getElementById('registerForm').classList.toggle('active', tab === 'register')
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login')
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register')
}

// ==================== АВТОРИЗАЦИЯ ====================
async function handleLogin(e) {
    e.preventDefault()
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value

    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single()

    if (error || !user) return alert('❌ Пользователь не найден')
    if (user.password_hash !== btoa(password)) return alert('❌ Неверный пароль')
    if (!user.email_verified) return alert('❌ Подтвердите email. Проверьте почту.')
    if (user.is_banned) {
        if (user.ban_expires && new Date(user.ban_expires) < new Date()) {
            await supabase.from('users').update({ is_banned: false, ban_reason: null, ban_expires: null }).eq('id', user.id)
        } else {
            return alert('🚫 Аккаунт заблокирован: ' + user.ban_reason)
        }
    }

    localStorage.setItem('nobuqr_session', JSON.stringify({ user, expiry: Date.now() + 86400000 }))
    currentUser = user
    showApp()
}

async function handleRegister(e) {
    e.preventDefault()
    const email = document.getElementById('regEmail').value.trim()
    const nickname = document.getElementById('regNickname').value.trim()
    const password = document.getElementById('regPassword').value
    const birth = document.getElementById('regBirth').value

    if (!email || !nickname || !password || !birth) return alert('❌ Заполните все поля')
    if (!document.getElementById('acceptTerms').checked) return alert('❌ Примите условия')
    if (Math.floor((Date.now() - new Date(birth)) / 31557600000) < 10) return alert('❌ Минимум 10 лет')
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\-\.]+$/.test(nickname)) return alert('❌ Недопустимый никнейм')
    if (password.length < 6) return alert('❌ Пароль минимум 6 символов')

    const ip = await (await fetch('https://api.ipify.org?format=json')).json()
    const { error } = await supabase.from('users').insert([{
        email, nickname, password_hash: btoa(password),
        date_of_birth: birth, ip_address: ip.ip
    }])

    if (error) return alert('❌ Ошибка: ' + error.message)

    const code = genCode()
    await supabase.from('users').update({
        verification_code: code,
        verification_code_expires: new Date(Date.now() + 600000).toISOString()
    }).eq('email', email)

    await sendEmail('code', {
        email, code,
        subject: 'Подтверждение',
        title: '🔐 Код подтверждения',
        message: `Здравствуйте, ${nickname}! Ваш код:`,
        expires: '10 минут'
    })

    pendingEmail = email
    document.getElementById('registerForm').style.display = 'none'
    document.getElementById('verifySection').style.display = 'block'
    document.getElementById('verifyEmail').textContent = email
    alert('📧 Код отправлен на ' + email)
}

async function verifyEmail() {
    const code = document.getElementById('verifyCode').value
    const { data: u } = await supabase.from('users').select('*').eq('email', pendingEmail).single()

    if (!u || u.verification_code !== code) return alert('❌ Неверный код')
    if (new Date(u.verification_code_expires) < new Date()) return alert('❌ Код истёк')

    await supabase.from('users').update({ email_verified: true, verification_code: null, verification_code_expires: null }).eq('id', u.id)
    await sendEmail('notify', {
        email: u.email,
        subject: 'Добро пожаловать!',
        title: '🎉 Добро пожаловать!',
        content: `<p>Привет, <strong>${u.nickname}</strong>!</p><p>Вы успешно зарегистрировались в NOBUQR.SPACE!</p>`
    })

    alert('✅ Готово! Войдите.')
    location.reload()
}

function logout() {
    localStorage.removeItem('nobuqr_session')
    location.reload()
}

// ==================== ПОЧТА ====================
function genCode() { return Math.floor(100000 + Math.random() * 900000).toString() }

async function sendEmail(type, params) {
    if (!EMAILJS.enabled) return false
    try {
        const tid = type === 'code' ? EMAILJS.templateVerify : EMAILJS.templateNotify
        const tp = type === 'code' ? {
            subject: params.subject, title: params.title, message: params.message,
            code: params.code, expires: params.expires || '10 минут', to_email: params.email
        } : {
            subject: params.subject, color: params.color || '#1d9bf0', title: params.title,
            bg: params.bg || '#f0f8ff', content: params.content, to_email: params.email
        }
        await emailjs.send(EMAILJS.serviceId, tid, tp)
        return true
    } catch (e) { return false }
}

// ==================== ПОСТЫ ====================
function countChars() {
    const len = document.getElementById('postText').value.length
    document.getElementById('charCount').textContent = len + '/280'
    document.getElementById('postBtn').disabled = len === 0
}

function pickMedia(type) {
    document.getElementById(type === 'image' ? 'imageInput' : 'videoInput').click()
}

function previewFile(type) {
    const file = document.getElementById(type === 'image' ? 'imageInput' : 'videoInput').files[0]
    if (!file) return
    selectedMediaFile = file
    selectedMediaType = type
    const reader = new FileReader()
    reader.onload = e => {
        document.getElementById('mediaPreview').style.display = 'block'
        document.getElementById('mediaPreview').innerHTML = type === 'image'
            ? `<img src="${e.target.result}">`
            : `<video src="${e.target.result}" controls></video>`
    }
    reader.readAsDataURL(file)
}

async function createPost() {
    const content = document.getElementById('postText').value.trim()
    if (!content && !selectedMediaFile) return
    if (Date.now() - lastPostTime < 30000) return alert('⏳ Подождите 30 секунд')

    let img = null, vid = null, mt = 'none'
    if (selectedMediaFile) {
        const bucket = selectedMediaType === 'image' ? 'images' : 'videos'
        const path = `${currentUser.id}/${Date.now()}_${selectedMediaFile.name}`
        const { error } = await supabase.storage.from(bucket).upload(path, selectedMediaFile)
        if (!error) {
            const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
            if (selectedMediaType === 'image') { img = url; mt = 'image' }
            else { vid = url; mt = 'video' }
        }
    }

    await supabase.from('chirps').insert([{
        user_id: currentUser.id,
        content: content || '📷',
        image_url: img, video_url: vid,
        media_type: mt
    }])

    lastPostTime = Date.now()
    document.getElementById('postText').value = ''
    document.getElementById('mediaPreview').style.display = 'none'
    document.getElementById('charCount').textContent = '0/280'
    document.getElementById('postBtn').disabled = true
    selectedMediaFile = null
    loadFeed()
}

async function loadFeed() {
    const { data: posts } = await supabase.from('chirps')
        .select('*, users:user_id(nickname, emoji, is_verified)')
        .order('created_at', { ascending: false }).limit(50)

    const container = document.getElementById('postsContainer')
    if (!posts?.length) {
        container.innerHTML = '<div class="empty">Нет постов. Будьте первым!</div>'
        return
    }

    container.innerHTML = posts.map(p => {
        const u = p.users
        let media = ''
        if (p.media_type === 'image') media = `<div class="post-media"><img src="${p.image_url}"></div>`
        if (p.media_type === 'video') media = `<div class="post-media"><video src="${p.video_url}" controls></video></div>`
        return `
            <div class="post">
                <div class="post-header">
                    <div class="post-avatar">${u.emoji}</div>
                    <div>
                        <div class="post-user">${u.nickname} ${u.is_verified ? '<span class="verified">✓</span>' : ''}</div>
                        <div class="post-time">${new Date(p.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                </div>
                ${p.content !== '📷' ? `<div class="post-content">${p.content}</div>` : ''}
                ${media}
                <div class="post-actions">
                    <button class="post-action" onclick="toggleLike('${p.id}')">❤️</button>
                    <button class="post-action" onclick="showComments('${p.id}')">💬</button>
                    <button class="post-action" onclick="reportPost('${p.id}')">🚩</button>
                </div>
            </div>`
    }).join('')
}

// ==================== ЛАЙКИ ====================
async function toggleLike(cid) {
    if (!currentUser) return
    const { data: ex } = await supabase.from('likes').select('*').eq('user_id', currentUser.id).eq('chirp_id', cid).single()
    if (ex) await supabase.from('likes').delete().eq('id', ex.id)
    else await supabase.from('likes').insert([{ user_id: currentUser.id, chirp_id: cid }])
    loadFeed()
}

// ==================== КОММЕНТАРИИ ====================
async function showComments(cid) {
    const { data: comments } = await supabase.from('comments').select('*, users:user_id(nickname)').eq('chirp_id', cid).order('created_at')
    let h = '<h3>Комментарии</h3>'
    if (comments?.length) {
        comments.forEach(c => h += `<div style="padding:8px 0;border-bottom:1px solid var(--border);"><strong>${c.users.nickname}</strong>: ${c.content}</div>`)
    } else h += '<p style="color:var(--text2)">Нет комментариев</p>'
    h += `<textarea id="commentText" placeholder="Ваш комментарий..." style="margin-top:10px;"></textarea><button class="btn" style="margin-top:8px;" onclick="addComment('${cid}')">Отправить</button>`
    document.getElementById('modalBody').innerHTML = h
    document.getElementById('modal').style.display = 'flex'
    document.getElementById('modal').classList.add('active')
}

async function addComment(cid) {
    const text = document.getElementById('commentText').value.trim()
    if (!text) return
    await supabase.from('comments').insert([{ user_id: currentUser.id, chirp_id: cid, content: text }])
    closeModal()
    loadFeed()
}

// ==================== ЖАЛОБЫ ====================
async function reportPost(cid) {
    if (!currentUser) return alert('Войдите')
    const reason = prompt('Причина жалобы:')
    if (!reason) return
    await supabase.from('reports').insert([{ reporter_id: currentUser.id, chirp_id: cid, reason }])
    alert('✅ Жалоба отправлена')
}

// ==================== ПОИСК ====================
async function searchHash() {
    const q = document.getElementById('searchInput').value.trim()
    if (!q) { document.getElementById('searchResults').innerHTML = ''; return }
    const { data } = await supabase.from('chirps').select('*, users:user_id(nickname, emoji, is_verified)').ilike('content', `%#${q}%`).order('created_at', { ascending: false })
    document.getElementById('searchResults').innerHTML = data?.length
        ? data.map(p => `<div class="post"><div class="post-content"><strong>${p.users.nickname}</strong>: ${p.content}</div></div>`).join('')
        : '<div class="empty">Ничего не найдено</div>'
}

// ==================== ПРОФИЛЬ ====================
async function loadProfile(uid) {
    if (!uid) return
    const { data: u } = await supabase.from('users').select('*').eq('id', uid).single()
    if (!u) return
    document.getElementById('profileCard').innerHTML = `
        <div class="auth-card" style="text-align:center;">
            <div style="font-size:60px;">${u.emoji}</div>
            <h2>${u.nickname} ${u.is_verified ? '<span class="verified">✓</span>' : ''}</h2>
            <p style="color:var(--text2)">${u.bio || 'Нет описания'}</p>
        </div>`
    const { data: posts } = await supabase.from('chirps').select('*, users:user_id(nickname, emoji, is_verified)').eq('user_id', uid).order('created_at', { ascending: false })
    document.getElementById('profilePosts').innerHTML = posts?.length
        ? posts.map(p => `<div class="post"><div class="post-content">${p.content}</div>${p.media_type === 'image' ? `<div class="post-media"><img src="${p.image_url}"></div>` : ''}${p.media_type === 'video' ? `<div class="post-media"><video src="${p.video_url}" controls></video></div>` : ''}</div>`).join('')
        : '<div class="empty">Нет постов</div>'
}

// ==================== АДМИНКА ====================
function adminLogin() {
    if (document.getElementById('adminPass').value === 'NobuQRAdmin2025!') {
        document.getElementById('adminLoginForm').style.display = 'none'
        document.getElementById('adminPanel').style.display = 'block'
        loadAdmin('users')
    } else alert('❌ Неверный пароль')
}

async function loadAdmin(section) {
    const c = document.getElementById('adminData')
    if (section === 'users') {
        const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
        c.innerHTML = data.map(u => `
            <div class="admin-item">
                <strong>${u.nickname}</strong> (${u.email})<br>
                IP: ${u.ip_address}<br>
                ${u.is_banned ? '🔴 Забанен' : '🟢 Активен'} ${u.is_verified ? '✓' : ''}<br>
                <button class="btn-sm" onclick="verifyUser('${u.id}')">✓</button>
                <button class="btn-sm btn-danger" onclick="banUser('${u.id}')">Бан</button>
            </div>`).join('')
    }
    // Остальные разделы по аналогии...
}

async function verifyUser(id) {
    const { data } = await supabase.from('users').select('is_verified').eq('id', id).single()
    await supabase.from('users').update({ is_verified: !data.is_verified }).eq('id', id)
    loadAdmin('users')
}

async function banUser(id) {
    const reason = prompt('Причина:')
    if (!reason) return
    await supabase.from('users').update({ is_banned: true, ban_reason: reason }).eq('id', id)
    loadAdmin('users')
}

function massReset() {
    if (confirm('Сбросить ВСЕ сессии?')) { localStorage.clear(); alert('Готово') }
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function closeModal() {
    document.getElementById('modal').style.display = 'none'
    document.getElementById('modal').classList.remove('active')
}

function showDoc(type) {
    const docs = {
        terms: '<h2>Условия использования</h2><p>Запрещены оскорбления, спам, 18+. Администрация может банить. Пользователь отвечает за свои посты.</p>',
        privacy: '<h2>Конфиденциальность</h2><p>Собираем email, ник, IP. Не передаём третьим лицам. Данные на серверах Supabase.</p>',
        rules: '<h2>Правила</h2><p>1. Будьте вежливы<br>2. Без спама<br>3. Без 18+<br>4. Уважайте других</p>'
    }
    document.getElementById('modalBody').innerHTML = docs[type] || ''
    document.getElementById('modal').style.display = 'flex'
    document.getElementById('modal').classList.add('active')
}

function showResetPassword() {
    document.getElementById('resetSection').style.display = 'block'
}

async function sendResetCode() {
    const email = document.getElementById('resetEmail').value.trim()
    if (!email) return alert('Введите email')
    const code = genCode()
    await supabase.from('users').update({ reset_code: code, reset_code_expires: new Date(Date.now() + 300000).toISOString() }).eq('email', email)
    await sendEmail('code', { email, code, subject: 'Сброс пароля', title: '🔑 Восстановление', message: 'Ваш код:', expires: '5 минут' })
    alert('📧 Код отправлен')
}