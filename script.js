(function() {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    const KEYS = {
        nick: 'nobu_nickname',
        uid: 'nobu_user_id',
        verified: 'nobu_verified',
        avatar: 'nobu_avatar',
        lastPost: 'nobu_last_post_time'
    };

    const $ = (id) => document.getElementById(id);
    const dom = {
        nicknameDisplay: $('nicknameDisplay'),
        nicknameText: $('nicknameText'),
        avatarInitial: $('avatarInitial'),
        avatarCircle: $('avatarCircle'),
        editBtn: $('editNicknameBtn'),
        editor: $('nicknameEditor'),
        input: $('nicknameInput'),
        saveBtn: $('saveNicknameBtn'),
        cancelBtn: $('cancelNicknameBtn'),
        composerAvatar: document.querySelector('.composer-avatar'),
        composerAvatarInitial: $('composerAvatarInitial'),
        composerNickname: $('composerNickname'),
        textarea: $('postTextarea'),
        charCount: $('charCount'),
        publishBtn: $('publishBtn'),
        composerError: $('composerError'),
        composerErrorText: $('composerErrorText'),
        feed: $('postsFeed'),
        loading: $('feedLoading'),
        empty: $('feedEmpty'),
        error: $('feedError'),
        errorText: $('feedErrorText'),
        retryBtn: $('retryBtn'),
        statusDot: $('statusDot'),
        statusText: $('statusText')
    };

    let currentNickname = '';
    let currentUserId = '';
    let isPublishing = false;
    let isAdmin = false;
    let isVerified = false;
    let avatarUrl = null;
    let likedPostIds = new Set();
    let bannedUserIds = new Set();
    let selectedImage = null;
    let realtimeChannel = null;
    let refreshInterval = null;
    let bansInterval = null;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[m]);
    }

    function uid() {
        let id = localStorage.getItem(KEYS.uid);
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            id = crypto.randomUUID();
            localStorage.setItem(KEYS.uid, id);
        }
        return id;
    }

    async function loadBans() {
        const { data } = await supabase.from('banned_users').select('user_id');
        bannedUserIds = new Set(data ? data.map(r => r.user_id) : []);
    }

    function updateUI() {
        const nick = currentNickname || 'Гость';
        dom.nicknameText.textContent = nick;
        dom.composerNickname.textContent = nick;

        const badge = dom.composerNickname.querySelector('.verified-badge');
        if (isVerified && !badge) {
            const span = document.createElement('span');
            span.className = 'verified-badge';
            span.innerHTML = '<i class="fas fa-check"></i>';
            dom.composerNickname.appendChild(span);
        } else if (!isVerified && badge) {
            badge.remove();
        }

        if (avatarUrl) {
            dom.avatarCircle.style.backgroundImage = `url(${avatarUrl})`;
            dom.avatarCircle.classList.add('has-image');
            dom.avatarInitial.textContent = '';
            dom.composerAvatar.style.backgroundImage = `url(${avatarUrl})`;
            dom.composerAvatar.style.backgroundSize = 'cover';
            dom.composerAvatarInitial.textContent = '';
        } else {
            dom.avatarCircle.style.backgroundImage = '';
            dom.avatarCircle.classList.remove('has-image');
            dom.avatarInitial.textContent = nick.charAt(0).toUpperCase();
            dom.composerAvatar.style.backgroundImage = '';
            dom.composerAvatarInitial.textContent = nick.charAt(0).toUpperCase();
        }

        const preview = document.getElementById('avatarPreviewInEditor');
        if (preview) {
            if (avatarUrl) {
                preview.style.backgroundImage = `url(${avatarUrl})`;
                preview.classList.add('has-image');
                preview.textContent = '';
            } else {
                preview.style.backgroundImage = '';
                preview.classList.remove('has-image');
                preview.textContent = nick.charAt(0).toUpperCase();
            }
        }

        const blocked = bannedUserIds.has(currentUserId);
        const hasContent = dom.textarea.value.trim().length > 0 || selectedImage;
        const lastTime = parseInt(localStorage.getItem(KEYS.lastPost) || '0');
        const canPost = Date.now() - lastTime >= 5000;
        dom.publishBtn.disabled = blocked || !hasContent || !currentNickname || isPublishing || !canPost;

        if (blocked) {
            dom.composerError.classList.remove('hidden');
            dom.composerErrorText.textContent = 'Вы заблокированы';
        } else if (!canPost && hasContent) {
            dom.composerError.classList.remove('hidden');
            dom.composerErrorText.textContent = 'Подождите 5 секунд';
        } else {
            dom.composerError.classList.add('hidden');
        }
    }

    function formatDate(d) {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date)) return '';
        const diff = Math.floor((Date.now() - date) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff/60)} мин. назад`;
        if (diff < 86400) return `${Math.floor(diff/3600)} ч. назад`;
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    async function publish() {
        if (isPublishing || bannedUserIds.has(currentUserId)) return;
        const content = dom.textarea.value.trim();
        if (!content && !selectedImage) return;

        isPublishing = true;
        dom.publishBtn.disabled = true;
        dom.composerError.classList.add('hidden');

        try {
            let imageUrl = null;
            if (selectedImage) {
                const path = `post-images/${currentUserId}_${Date.now()}.${selectedImage.name.split('.').pop()}`;
                const { error: uploadErr } = await supabase.storage
                    .from('post-images')
                    .upload(path, selectedImage);
                if (uploadErr) throw uploadErr;
                const { data: urlData } = supabase.storage
                    .from('post-images')
                    .getPublicUrl(path);
                imageUrl = urlData.publicUrl;
            }

            const { error: insertErr } = await supabase.from('posts').insert({
                user_id: currentUserId,
                nickname: currentNickname,
                content: content,
                likes: 0,
                verified: isVerified,
                image_url: imageUrl
            });
            if (insertErr) throw insertErr;

            localStorage.setItem(KEYS.lastPost, Date.now().toString());
            dom.textarea.value = '';
            selectedImage = null;
            document.querySelector('.image-preview-container')?.classList.remove('active');
            loadPosts();
        } catch (e) {
            console.error(e);
            dom.composerError.classList.remove('hidden');
            dom.composerErrorText.textContent = 'Ошибка: ' + (e.message || 'неизвестная');
        } finally {
            isPublishing = false;
            updateUI();
        }
    }

    function createCard(post) {
        if (bannedUserIds.has(post.user_id)) return null;
        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.dataset.userId = post.user_id;
        const verifiedBadge = post.verified ? '<span class="verified-badge"><i class="fas fa-check"></i></span>' : '';
        const liked = likedPostIds.has(post.id);
        card.innerHTML = `
            <div class="post-header">
                <div class="post-avatar">${esc(post.nickname?.charAt(0) || '?')}</div>
                <div class="post-author-info">
                    <span class="post-nickname">${esc(post.nickname||'Гость')}${verifiedBadge}</span>
                    <span class="post-time">${formatDate(post.created_at)}</span>
                </div>
            </div>
            ${post.content?`<div class="post-content">${esc(post.content)}</div>`:''}
            ${post.image_url?`<div class="post-image"><img src="${esc(post.image_url)}" alt="post image"></div>`:''}
            <div class="post-actions">
                <button class="like-btn ${liked?'liked':''}">
                    <i class="fas fa-heart"></i> <span class="like-count">${post.likes||0}</span>
                </button>
            </div>`;
        card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id, card.querySelector('.like-btn')));
        return card;
    }

    async function toggleLike(postId, btn) {
        const liked = likedPostIds.has(postId);
        const countEl = btn.querySelector('.like-count');
        let count = parseInt(countEl.textContent) || 0;
        btn.classList.toggle('liked', !liked);
        countEl.textContent = liked ? Math.max(0, count-1) : count+1;
        likedPostIds[liked ? 'delete' : 'add'](postId);
        if (liked) await supabase.from('likes').delete().match({ post_id: postId, user_id: currentUserId });
        else await supabase.from('likes').insert({ post_id: postId, user_id: currentUserId });
    }

    async function loadUserLikes() {
        if (!currentUserId) return;
        const { data } = await supabase.from('likes').select('post_id').eq('user_id', currentUserId);
        likedPostIds = new Set(data ? data.map(r => r.post_id) : []);
    }

    async function loadPosts() {
        dom.loading.classList.remove('hidden');
        dom.error.classList.add('hidden');
        dom.empty.classList.add('hidden');
        const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        dom.feed.querySelectorAll('.post-card').forEach(c => c.remove());
        dom.loading.classList.add('hidden');
        if (!data || data.length === 0) { dom.empty.classList.remove('hidden'); return; }
        data.forEach(post => {
            const card = createCard(post);
            if (card) dom.feed.appendChild(card);
        });
    }

    function setupImageUpload() {
        const composerBody = document.querySelector('.composer-body');
        const toolbar = document.createElement('div');
        toolbar.className = 'composer-toolbar';
        const attachBtn = document.createElement('button');
        attachBtn.className = 'attach-btn';
        attachBtn.innerHTML = '<i class="fas fa-image"></i>';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        const previewImg = document.createElement('img');
        previewImg.className = 'image-preview';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        previewContainer.appendChild(previewImg);
        previewContainer.appendChild(removeBtn);
        toolbar.appendChild(attachBtn);
        composerBody.insertBefore(previewContainer, composerBody.querySelector('.composer-footer'));
        composerBody.insertBefore(toolbar, previewContainer);

        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                selectedImage = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => {
                    previewImg.src = ev.target.result;
                    previewContainer.classList.add('active');
                };
                reader.readAsDataURL(e.target.files[0]);
                updateUI();
            }
        });
        removeBtn.addEventListener('click', () => {
            selectedImage = null;
            previewContainer.classList.remove('active');
            updateUI();
        });
    }

    function setupAvatarEditor() {
        const editor = dom.editor;
        const area = document.createElement('div');
        area.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px;';
        area.innerHTML = `
            <div id="avatarPreviewInEditor" style="width:50px;height:50px;border-radius:50%;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;background-size:cover;background-position:center;border:2px solid #333;"></div>
            <input type="file" id="avatarFileInput" accept="image/*" style="display:none">
            <button id="avatarUploadBtn" style="background:#1a1a1a;border:1px solid #333;color:#999;padding:6px 14px;border-radius:20px;cursor:pointer;font-size:0.8rem;"><i class="fas fa-camera"></i> Сменить аватар</button>
        `;
        editor.insertBefore(area, editor.querySelector('.save-nickname-btn').parentNode);
        document.getElementById('avatarUploadBtn').addEventListener('click', () => document.getElementById('avatarFileInput').click());
        document.getElementById('avatarFileInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                try {
                    const file = e.target.files[0];
                    const path = `avatars/${currentUserId}_avatar.${file.name.split('.').pop()}`;
                    await supabase.storage.from('post-images').upload(path, file, { upsert: true });
                    const { data } = supabase.storage.from('post-images').getPublicUrl(path);
                    avatarUrl = data.publicUrl;
                    localStorage.setItem(KEYS.avatar, avatarUrl);
                    updateUI();
                } catch (err) {
                    alert('Не удалось загрузить аватар: ' + err.message);
                }
            }
        });
    }

    function setupAdmin() {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'admin-toggle-btn';
        toggleBtn.innerHTML = '<i class="fas fa-shield-haltered"></i>';
        document.body.appendChild(toggleBtn);

        const modal = document.createElement('div');
        modal.className = 'admin-modal';
        modal.innerHTML = `
            <h3>Админ-панель</h3>
            <input type="password" id="adminPasswordInput" placeholder="Пароль">
            <button id="adminLoginBtn">Войти</button>
            <div id="adminError" style="color:red;display:none;">Неверный пароль</div>
            <div id="bannedList" style="margin-top:10px;display:none;"></div>
        `;
        document.body.appendChild(modal);

        toggleBtn.addEventListener('click', () => modal.classList.toggle('active'));
        document.getElementById('adminLoginBtn').addEventListener('click', async () => {
            if (document.getElementById('adminPasswordInput').value === 'nobuadmin2024') {
                isAdmin = true;
                modal.classList.remove('active');
                await renderBannedList();
                document.getElementById('bannedList').style.display = 'block';
            } else {
                document.getElementById('adminError').style.display = 'block';
            }
        });

        async function renderBannedList() {
            const container = document.getElementById('bannedList');
            const { data } = await supabase.from('banned_users').select('*');
            container.innerHTML = '<h4>🚫 Заблокированные</h4>';
            if (!data || data.length === 0) {
                container.innerHTML += '<p>Нет</p>';
                return;
            }
            data.forEach(entry => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;';
                row.innerHTML = `<span>${esc(entry.nickname||'Без ника')}</span>`;
                const unbanBtn = document.createElement('button');
                unbanBtn.textContent = 'Разблокировать';
                unbanBtn.className = 'unblock-btn';
                unbanBtn.addEventListener('click', async () => {
                    await supabase.from('banned_users').delete().match({ user_id: entry.user_id });
                    bannedUserIds.delete(entry.user_id);
                    await loadPosts();
                    await renderBannedList();
                });
                row.appendChild(unbanBtn);
                container.appendChild(row);
            });
        }
    }

    async function init() {
        currentUserId = uid();
        currentNickname = localStorage.getItem(KEYS.nick) || '';
        isVerified = localStorage.getItem(KEYS.verified) === 'true';
        avatarUrl = localStorage.getItem(KEYS.avatar);
        await loadBans();
        await loadUserLikes();
        updateUI();
        if (!currentNickname) {
            dom.nicknameDisplay.classList.add('hidden');
            dom.editor.classList.remove('hidden');
        }

        setupImageUpload();
        setupAvatarEditor();
        setupAdmin();

        dom.editBtn.addEventListener('click', () => {
            dom.nicknameDisplay.classList.add('hidden');
            dom.editor.classList.remove('hidden');
            dom.input.value = currentNickname;
            updateUI();
        });
        dom.saveBtn.addEventListener('click', () => {
            const nick = dom.input.value.trim();
            if (!nick) return;
            if (nick === 'NobuSocial') {
                const pw = prompt('Пароль верификации:');
                isVerified = (pw === 'NobuSocialAdmin2024');
                localStorage.setItem(KEYS.verified, isVerified);
                if (!isVerified && pw !== null) alert('Неверный пароль!');
            } else {
                isVerified = false;
                localStorage.setItem(KEYS.verified, 'false');
            }
            currentNickname = nick;
            localStorage.setItem(KEYS.nick, nick);
            updateUI();
            dom.editor.classList.add('hidden');
            dom.nicknameDisplay.classList.remove('hidden');
        });
        dom.cancelBtn.addEventListener('click', () => {
            if (!currentNickname) return;
            dom.editor.classList.add('hidden');
            dom.nicknameDisplay.classList.remove('hidden');
        });
        dom.textarea.addEventListener('input', () => {
            dom.charCount.textContent = dom.textarea.value.length;
            updateUI();
        });
        dom.publishBtn.addEventListener('click', publish);
        dom.retryBtn.addEventListener('click', loadPosts);

        await loadPosts();

        realtimeChannel = supabase.channel('posts-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
                const card = createCard(payload.new);
                if (card) {
                    dom.feed.insertBefore(card, dom.feed.firstChild);
                    dom.empty.classList.add('hidden');
                }
            })
            .subscribe();

        refreshInterval = setInterval(loadPosts, 5000);
        bansInterval = setInterval(loadBans, 10000);

        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterval);
            clearInterval(bansInterval);
            if (realtimeChannel) supabase.removeChannel(realtimeChannel);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();