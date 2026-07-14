(function() {
    'use strict';

    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    const $ = (id) => document.getElementById(id);
    const DOM = {
        authOverlay: $('authOverlay'), appContainer: $('appContainer'),
        loginForm: $('loginForm'), registerForm: $('registerForm'),
        loginEmail: $('loginEmail'), loginPassword: $('loginPassword'), loginError: $('loginError'),
        regNickname: $('regNickname'), regEmail: $('regEmail'), regPassword: $('regPassword'), regError: $('regError'),
        userAvatar: $('userAvatar'), userInitial: $('userInitial'), userName: $('userName'),
        composerAvatar: $('composerAvatar'), composerInitial: $('composerInitial'),
        postTextarea: $('postTextarea'), charCounter: $('charCounter'), publishBtn: $('publishBtn'),
        composerError: $('composerError'), composerErrorText: $('composerErrorText'),
        postsFeed: $('postsFeed'), feedLoading: $('feedLoading'), feedEmpty: $('feedEmpty'), feedError: $('feedError'),
        retryBtn: $('retryBtn'), profileModal: $('profileModal'),
        modalAvatar: $('modalAvatar'), modalInitial: $('modalInitial'), modalNickname: $('modalNickname'),
        modalBio: $('modalBio'), imagePreview: $('imagePreview'), previewImg: $('previewImg'),
        screenHome: $('screenHome'), screenProfile: $('screenProfile'), screenMyPosts: $('screenMyPosts'),
        profileContainer: $('profileContainer'), myPostsFeed: $('myPostsFeed'),
        myPostsLoading: $('myPostsLoading'), myPostsEmpty: $('myPostsEmpty'),
        navItems: document.querySelectorAll('.nav-item')
    };

    let currentUser = null, profile = null, isPublishing = false, isAdmin = false;
    let likedPostIds = new Set(), bannedUserIds = new Set(), selectedImage = null;
    let currentScreen = 'home';

    const esc = (s) => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    const fmtDate = (d) => {
        if (!d) return '';
        const diff = Math.floor((Date.now() - new Date(d)) / 1000);
        if (diff < 60) return 'сейчас';
        if (diff < 3600) return Math.floor(diff/60) + 'м';
        if (diff < 86400) return Math.floor(diff/3600) + 'ч';
        return new Date(d).toLocaleDateString('ru-RU', {day:'numeric',month:'short'});
    };

    // ========== AUTH ==========
    async function checkSession() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { currentUser = user; await loadProfile(); showApp(); }
        else showAuth();
    }
    async function loadProfile(userId = null) {
        const id = userId || currentUser.id;
        const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
        if (!userId) profile = data || { nickname: currentUser.email?.split('@')[0] || 'User', avatar_url: null, bio: '', role: 'user' };
        return data || { nickname: 'Гость', avatar_url: null, bio: '', role: 'user' };
    }
    function updateAllUI() {
        if (!profile) return;
        const nick = profile?.nickname || 'Гость';
        DOM.userName.textContent = nick;
        const initial = nick.charAt(0).toUpperCase();
        DOM.userInitial.textContent = initial;
        DOM.composerInitial.textContent = initial;
        DOM.modalInitial.textContent = initial;
        if (profile?.avatar_url) {
            DOM.userAvatar.style.backgroundImage = `url(${profile.avatar_url})`;
            DOM.userAvatar.classList.add('has-image'); DOM.userInitial.textContent = '';
            DOM.composerAvatar.style.backgroundImage = `url(${profile.avatar_url})`;
            DOM.composerAvatar.style.backgroundSize = 'cover'; DOM.composerInitial.textContent = '';
            DOM.modalAvatar.style.backgroundImage = `url(${profile.avatar_url})`;
            DOM.modalAvatar.classList.add('has-image'); DOM.modalInitial.textContent = '';
        } else {
            DOM.userAvatar.style.backgroundImage = ''; DOM.userAvatar.classList.remove('has-image'); DOM.userInitial.textContent = initial;
            DOM.composerAvatar.style.backgroundImage = ''; DOM.composerInitial.textContent = initial;
            DOM.modalAvatar.style.backgroundImage = ''; DOM.modalAvatar.classList.remove('has-image'); DOM.modalInitial.textContent = initial;
        }
        updatePublishBtn();
    }
    function showApp() { DOM.authOverlay.classList.add('hidden'); DOM.appContainer.classList.remove('hidden'); initApp(); }
    function showAuth() { DOM.authOverlay.classList.remove('hidden'); DOM.appContainer.classList.add('hidden'); }

    // Регистрация с Confirm email
    DOM.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.auth.signUp({
            email: DOM.regEmail.value,
            password: DOM.regPassword.value,
            options: {
                data: {
                    nickname: DOM.regNickname.value || DOM.regEmail.value.split('@')[0]
                }
            }
        });
        if (error) {
            DOM.regError.style.color = '#f66';
            DOM.regError.textContent = error.message;
            return;
        }
        if (data.user) {
            // Создаём профиль сразу (даже до подтверждения email)
            await supabase.from('profiles').insert({
                id: data.user.id,
                nickname: DOM.regNickname.value || DOM.regEmail.value.split('@')[0],
                bio: '',
                role: 'user'
            });
            // Показываем сообщение о подтверждении
            DOM.regError.style.color = '#0c0';
            DOM.regError.textContent = '✅ Аккаунт создан! Проверьте почту для подтверждения.';
            DOM.registerForm.reset();
        }
    });

    DOM.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email: DOM.loginEmail.value,
            password: DOM.loginPassword.value
        });
        if (error) {
            if (error.message === 'Email not confirmed') {
                DOM.loginError.textContent = '❌ Почта не подтверждена. Проверьте почту.';
            } else {
                DOM.loginError.textContent = error.message;
            }
        } else {
            checkSession();
        }
    });

    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const isLogin = tab.dataset.tab === 'login';
            DOM.loginForm.classList.toggle('hidden', !isLogin);
            DOM.registerForm.classList.toggle('hidden', isLogin);
            DOM.loginError.textContent = '';
            DOM.regError.textContent = '';
        });
    });
    $('logoutBtn').addEventListener('click', async () => { await supabase.auth.signOut(); currentUser = null; profile = null; showAuth(); });

    // ========== PROFILE EDITOR ==========
    $('userSettingsBtn').addEventListener('click', () => {
        DOM.profileModal.classList.remove('hidden');
        DOM.modalNickname.value = profile?.nickname || '';
        DOM.modalBio.value = profile?.bio || '';
        updateAllUI();
    });
    $('modalCancel').addEventListener('click', () => DOM.profileModal.classList.add('hidden'));
    DOM.profileModal.addEventListener('click', (e) => { if (e.target === DOM.profileModal) DOM.profileModal.classList.add('hidden'); });
    $('modalAvatarInput').addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const path = `avatars/${currentUser.id}.${file.name.split('.').pop()}`;
        await supabase.storage.from('post-images').upload(path, file, { upsert: true });
        const { data } = supabase.storage.from('post-images').getPublicUrl(path);
        profile.avatar_url = data.publicUrl;
        await supabase.from('profiles').upsert({ id: currentUser.id, avatar_url: profile.avatar_url });
        updateAllUI();
    });
    $('modalSave').addEventListener('click', async () => {
        const nick = DOM.modalNickname.value.trim();
        const bio = DOM.modalBio.value.trim();
        if (!nick) return;
        profile.nickname = nick;
        profile.bio = bio;
        await supabase.from('profiles').upsert({ id: currentUser.id, nickname: nick, bio: bio });
        updateAllUI();
        DOM.profileModal.classList.add('hidden');
    });

    // ========== SCREENS & NAVIGATION ==========
    function switchScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screenMap = { home: DOM.screenHome, profile: DOM.screenProfile, myPosts: DOM.screenMyPosts };
        if (screenMap[screen]) screenMap[screen].classList.add('active');
        currentScreen = screen;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screen);
        });
        if (screen === 'home') loadPosts();
        else if (screen === 'myPosts') loadMyPosts();
    }
    DOM.navItems.forEach(item => {
        item.addEventListener('click', () => switchScreen(item.dataset.screen));
    });

    async function loadMyPosts() {
        if (!currentUser) return;
        DOM.myPostsLoading.classList.remove('hidden');
        DOM.myPostsEmpty.classList.add('hidden');
        const { data } = await supabase.from('posts').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
        DOM.myPostsFeed.querySelectorAll('.post-card').forEach(c => c.remove());
        DOM.myPostsLoading.classList.add('hidden');
        if (!data || data.length === 0) { DOM.myPostsEmpty.classList.remove('hidden'); return; }
        data.forEach(post => {
            const card = createPostCard(post);
            if (card) DOM.myPostsFeed.appendChild(card);
        });
    }

    async function openProfile(userId) {
        switchScreen('profile');
        const prof = await loadProfile(userId);
        const { count: postsCount } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
        const { data: likesData } = await supabase.from('posts').select('likes').eq('user_id', userId);
        const totalLikes = likesData ? likesData.reduce((sum, p) => sum + (p.likes || 0), 0) : 0;
        const count = postsCount || 0;
        const isOwn = currentUser && userId === currentUser.id;
        const roleText = prof.role === 'admin' ? 'Администратор' : (prof.role === 'moderator' ? 'Модератор' : 'Пользователь');

        DOM.profileContainer.innerHTML = `
            <div class="profile-header-card">
                <div class="profile-avatar-large ${prof.avatar_url ? 'has-image' : ''}" style="background-image: ${prof.avatar_url ? `url(${prof.avatar_url})` : 'none'}">
                    ${!prof.avatar_url ? (prof.nickname || '?').charAt(0).toUpperCase() : ''}
                </div>
                <div class="profile-nickname-large">${esc(prof.nickname || 'Гость')}</div>
                <div class="profile-bio">${esc(prof.bio || '')}</div>
                <div class="profile-stats">
                    <div class="profile-stat"><span class="profile-stat-value">${count}</span> постов</div>
                    <div class="profile-stat"><span class="profile-stat-value">${totalLikes}</span> лайков</div>
                </div>
                <div class="profile-role">${roleText}</div>
                ${isOwn ? `<div class="profile-actions"><button class="profile-btn primary" id="openProfileEditor">Редактировать</button></div>` : ''}
            </div>
            <div class="profile-posts">
                <h3 class="profile-section-title">Посты</h3>
                <div class="feed-list" id="profilePostsFeed"></div>
            </div>`;

        const { data: posts } = await supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        const feed = document.getElementById('profilePostsFeed');
        if (posts && posts.length > 0) {
            posts.forEach(post => {
                const card = createPostCard(post);
                if (card) feed.appendChild(card);
            });
        } else {
            feed.innerHTML = '<p style="color:#555;">Нет постов</p>';
        }

        if (isOwn) {
            document.getElementById('openProfileEditor').addEventListener('click', () => {
                DOM.profileModal.classList.remove('hidden');
                DOM.modalNickname.value = prof.nickname || '';
                DOM.modalBio.value = prof.bio || '';
            });
        }
    }

    function createPostCard(post) {
        if (bannedUserIds.has(post.user_id)) return null;
        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.dataset.userId = post.user_id;
        card.innerHTML = `
            <div class="post-card-header">
                <div class="post-card-avatar" data-user-id="${post.user_id}">${esc(post.nickname?.charAt(0)||'?')}</div>
                <div>
                    <span class="post-card-nickname" data-user-id="${post.user_id}">${esc(post.nickname||'Гость')}</span>
                    <span class="post-card-time">${fmtDate(post.created_at)}</span>
                </div>
            </div>
            ${post.content?`<div class="post-card-text">${esc(post.content)}</div>`:''}
            ${post.image_url?`<div class="post-card-img"><img src="${esc(post.image_url)}"></div>`:''}
            <div class="post-card-actions">
                <button class="like-btn ${likedPostIds.has(post.id)?'liked':''}"><i class="fa-solid fa-heart"></i> <span>${post.likes||0}</span></button>
            </div>`;
        card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id, card.querySelector('.like-btn')));
        card.querySelector('.post-card-avatar').addEventListener('click', () => openProfile(post.user_id));
        card.querySelector('.post-card-nickname').addEventListener('click', () => openProfile(post.user_id));
        return card;
    }

    async function toggleLike(pid, btn) {
        const liked = likedPostIds.has(pid);
        likedPostIds[liked?'delete':'add'](pid);
        btn.classList.toggle('liked', !liked);
        const span = btn.querySelector('span');
        span.textContent = parseInt(span.textContent) + (liked?-1:1);
        if (liked) await supabase.from('likes').delete().match({post_id:pid,user_id:currentUser.id});
        else await supabase.from('likes').insert({post_id:pid,user_id:currentUser.id});
    }

    async function loadPosts() {
        DOM.feedLoading.classList.remove('hidden'); DOM.feedEmpty.classList.add('hidden'); DOM.feedError.classList.add('hidden');
        const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false});
        DOM.postsFeed.querySelectorAll('.post-card').forEach(c=>c.remove());
        DOM.feedLoading.classList.add('hidden');
        if (!data||!data.length) { DOM.feedEmpty.classList.remove('hidden'); return; }
        data.forEach(p => { const c = createPostCard(p); if(c) DOM.postsFeed.appendChild(c); });
    }

    async function publish() {
        if (isPublishing || !currentUser) return;
        const txt = DOM.postTextarea.value.trim();
        if (!txt && !selectedImage) return;
        isPublishing = true; DOM.publishBtn.disabled = true;
        try {
            let img = null;
            if (selectedImage) {
                const path = `posts/${currentUser.id}_${Date.now()}.${selectedImage.name.split('.').pop()}`;
                await supabase.storage.from('post-images').upload(path, selectedImage);
                img = supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl;
            }
            await supabase.from('posts').insert({ user_id: currentUser.id, nickname: profile?.nickname || currentUser.email?.split('@')[0], content: txt, likes: 0, image_url: img });
            DOM.postTextarea.value = ''; selectedImage = null; DOM.imagePreview.classList.add('hidden');
            DOM.charCounter.textContent = '0 / 500'; loadPosts();
        } catch(e) { console.error(e); }
        isPublishing = false; updatePublishBtn();
    }

    function updatePublishBtn() {
        DOM.publishBtn.disabled = (!DOM.postTextarea.value.trim() && !selectedImage) || isPublishing || bannedUserIds.has(currentUser?.id);
    }

    $('attachBtn').addEventListener('click', () => $('imageInput').click());
    $('imageInput').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            selectedImage = e.target.files[0];
            const r = new FileReader();
            r.onload = ev => { DOM.previewImg.src = ev.target.result; DOM.imagePreview.classList.remove('hidden'); };
            r.readAsDataURL(e.target.files[0]); updatePublishBtn();
        }
    });
    $('removePreviewBtn').addEventListener('click', () => { selectedImage = null; DOM.imagePreview.classList.add('hidden'); updatePublishBtn(); });

    async function loadBans() {
        const { data } = await supabase.from('banned_users').select('user_id');
        bannedUserIds = new Set(data ? data.map(r => r.user_id) : []);
    }
    async function loadLikes() {
        if (!currentUser) return;
        const { data } = await supabase.from('likes').select('post_id').eq('user_id', currentUser.id);
        likedPostIds = new Set(data ? data.map(r => r.post_id) : []);
    }

    function setupAdmin() {
        const fab = document.createElement('button'); fab.className = 'admin-fab'; fab.innerHTML = '<i class="fa-solid fa-shield-halved"></i>'; document.body.appendChild(fab);
        const panel = document.createElement('div'); panel.className = 'admin-panel';
        panel.innerHTML = `<h3>Админ</h3><input type="password" id="adminPw" placeholder="Пароль"><button class="admin-login-btn" id="adminLogin">Войти</button><div id="adminErr" style="color:red;display:none;">Неверный</div><div id="bannedList" style="margin-top:10px;"></div>`;
        document.body.appendChild(panel);
        fab.addEventListener('click', () => panel.classList.toggle('active'));
        $('adminLogin').addEventListener('click', async () => {
            if ($('adminPw').value === 'nobuadmin2024') { isAdmin = true; panel.classList.remove('active'); await renderBanned(); addAdminButtons(); }
        });
        async function renderBanned() {
            const { data } = await supabase.from('banned_users').select('*');
            const list = $('bannedList'); list.innerHTML = '<h4>Заблокированные</h4>';
            if (!data||!data.length) { list.innerHTML += '<p>Нет</p>'; return; }
            data.forEach(e => {
                const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;';
                row.innerHTML = `<span>${esc(e.nickname||'?')}</span><button class="unban-btn">Разбанить</button>`;
                row.querySelector('.unban-btn').addEventListener('click', async () => {
                    await supabase.from('banned_users').delete().match({user_id:e.user_id});
                    bannedUserIds.delete(e.user_id); loadPosts(); loadMyPosts(); renderBanned();
                });
                list.appendChild(row);
            });
        }
    }
    function addAdminButtons() {
        document.querySelectorAll('.post-card').forEach(card => {
            if (card.querySelector('.admin-delete-btn')) return;
            const header = card.querySelector('.post-card-header');
            const delBtn = document.createElement('button');
            delBtn.className = 'admin-delete-btn'; delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.style.cssText = 'background:none;border:none;color:#666;cursor:pointer;margin-left:auto;';
            delBtn.addEventListener('click', async () => {
                if (confirm('Удалить пост?')) {
                    await supabase.from('posts').delete().match({ id: card.dataset.postId });
                    card.remove();
                }
            });
            header.appendChild(delBtn);
            const banBtn = document.createElement('button');
            banBtn.className = 'admin-block-btn'; banBtn.innerHTML = '<i class="fa-solid fa-ban"></i>';
            banBtn.style.cssText = 'background:none;border:none;color:#666;cursor:pointer;';
            banBtn.addEventListener('click', async () => {
                const userId = card.dataset.userId;
                const nickname = card.querySelector('.post-card-nickname').textContent;
                if (confirm(`Заблокировать ${nickname}?`)) {
                    await supabase.from('banned_users').upsert({ user_id: userId, nickname: nickname });
                    bannedUserIds.add(userId);
                    document.querySelectorAll(`.post-card[data-user-id="${userId}"]`).forEach(c => c.remove());
                    await renderBanned();
                }
            });
            header.appendChild(banBtn);
        });
    }

    function initApp() {
        loadBans(); loadLikes(); loadPosts(); setupAdmin();
        DOM.postTextarea.addEventListener('input', () => { DOM.charCounter.textContent = DOM.postTextarea.value.length + ' / 500'; updatePublishBtn(); });
        DOM.publishBtn.addEventListener('click', publish);
        $('retryBtn').addEventListener('click', loadPosts);
        setInterval(() => { if (currentScreen === 'home') loadPosts(); }, 5000);
        setInterval(loadBans, 10000);
        supabase.channel('posts').on('postgres_changes',{event:'INSERT',schema:'public',table:'posts'}, () => {
            if (currentScreen === 'home') loadPosts();
            if (currentScreen === 'myPosts') loadMyPosts();
        }).subscribe();
        switchScreen('home');
    }

    checkSession();
})();