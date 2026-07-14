(function() {
    'use strict';

    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    // ==================== DOM CACHE ====================
    const DOM = {
        // Profile
        profileBadge: document.getElementById('profileBadge'),
        profileAvatar: document.getElementById('profileAvatar'),
        profileInitial: document.getElementById('profileInitial'),
        profileName: document.getElementById('profileName'),
        profileEditBtn: document.getElementById('profileEditBtn'),
        profileEditorOverlay: document.getElementById('profileEditorOverlay'),
        profileEditorAvatar: document.getElementById('profileEditorAvatar'),
        profileEditorInitial: document.getElementById('profileEditorInitial'),
        avatarFileInput: document.getElementById('avatarFileInput'),
        nicknameInput: document.getElementById('nicknameInput'),
        cancelProfileBtn: document.getElementById('cancelProfileBtn'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        profileEditorError: document.getElementById('profileEditorError'),
        // Composer
        composerAvatar: document.getElementById('composerAvatar'),
        composerInitial: document.getElementById('composerInitial'),
        composerLabel: document.getElementById('composerLabel'),
        postTextarea: document.getElementById('postTextarea'),
        charCounter: document.getElementById('charCounter'),
        publishBtn: document.getElementById('publishBtn'),
        attachImageBtn: document.getElementById('attachImageBtn'),
        imageFileInput: document.getElementById('imageFileInput'),
        imagePreviewContainer: document.getElementById('imagePreviewContainer'),
        imagePreview: document.getElementById('imagePreview'),
        removeImageBtn: document.getElementById('removeImageBtn'),
        composerError: document.getElementById('composerError'),
        composerErrorText: document.getElementById('composerErrorText'),
        // Feed
        postsFeed: document.getElementById('postsFeed'),
        feedLoading: document.getElementById('feedLoading'),
        feedEmpty: document.getElementById('feedEmpty'),
        feedError: document.getElementById('feedError'),
        retryBtn: document.getElementById('retryBtn'),
        statusDot: document.getElementById('statusDot'),
        statusText: document.getElementById('statusText'),
    };

    // ==================== STATE ====================
    const state = {
        userId: null,
        nickname: '',
        avatarUrl: null,
        isPublishing: false,
        isAdmin: false,
        likedPostIds: new Set(),
        bannedUserIds: new Set(),
        selectedImage: null,
    };

    // ==================== UTILS ====================
    const html = (strings, ...values) => {
        const escaped = values.map(v => {
            if (v === null || v === undefined) return '';
            return String(v).replace(/[&<>"']/g, m => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            })[m]);
        });
        return strings.reduce((acc, str, i) => acc + str + (escaped[i] || ''), '');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (diff < 60) return 'только что';
        if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
        return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    const getOrCreateUserId = () => {
        let id = localStorage.getItem('nobu_user_id');
        if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
            id = crypto.randomUUID();
            localStorage.setItem('nobu_user_id', id);
        }
        return id;
    };

    // ==================== UI UPDATES ====================
    const updateProfileUI = () => {
        const name = state.nickname || 'Гость';
        const initial = name.charAt(0).toUpperCase();
        
        DOM.profileName.textContent = name;
        DOM.profileInitial.textContent = initial;
        DOM.composerInitial.textContent = initial;
        
        if (state.avatarUrl) {
            DOM.profileAvatar.style.backgroundImage = `url(${state.avatarUrl})`;
            DOM.profileAvatar.classList.add('has-image');
            DOM.profileInitial.textContent = '';
            DOM.composerAvatar.style.backgroundImage = `url(${state.avatarUrl})`;
            DOM.composerAvatar.style.backgroundSize = 'cover';
            DOM.composerInitial.textContent = '';
            DOM.profileEditorAvatar.style.backgroundImage = `url(${state.avatarUrl})`;
            DOM.profileEditorAvatar.classList.add('has-image');
            DOM.profileEditorInitial.textContent = '';
        } else {
            DOM.profileAvatar.style.backgroundImage = '';
            DOM.profileAvatar.classList.remove('has-image');
            DOM.profileInitial.textContent = initial;
            DOM.composerAvatar.style.backgroundImage = '';
            DOM.composerInitial.textContent = initial;
            DOM.profileEditorAvatar.style.backgroundImage = '';
            DOM.profileEditorAvatar.classList.remove('has-image');
            DOM.profileEditorInitial.textContent = initial;
        }
    };

    const updatePublishButton = () => {
        const hasContent = DOM.postTextarea.value.trim().length > 0 || state.selectedImage;
        const blocked = state.bannedUserIds.has(state.userId);
        DOM.publishBtn.disabled = blocked || !hasContent || state.isPublishing;
        
        if (blocked) {
            DOM.composerError.classList.remove('hidden');
            DOM.composerErrorText.textContent = 'Ваш аккаунт заблокирован';
        } else {
            DOM.composerError.classList.add('hidden');
        }
    };

    const updateCharCounter = () => {
        const len = DOM.postTextarea.value.length;
        DOM.charCounter.textContent = `${len} / 500`;
    };

    // ==================== DATA LAYER ====================
    const loadBannedUsers = async () => {
        const { data } = await supabase.from('banned_users').select('user_id');
        state.bannedUserIds = new Set(data ? data.map(r => r.user_id) : []);
        updatePublishButton();
    };

    const loadUserLikes = async () => {
        if (!state.userId) return;
        const { data } = await supabase.from('likes').select('post_id').eq('user_id', state.userId);
        state.likedPostIds = new Set(data ? data.map(r => r.post_id) : []);
    };

    const loadPosts = async () => {
        DOM.feedLoading.classList.remove('hidden');
        DOM.feedEmpty.classList.add('hidden');
        DOM.feedError.classList.add('hidden');
        
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        DOM.postsFeed.querySelectorAll('.post-card').forEach(c => c.remove());
        DOM.feedLoading.classList.add('hidden');
        
        if (error || !data || data.length === 0) {
            DOM.feedEmpty.classList.remove('hidden');
            return;
        }
        
        data.forEach(post => {
            if (state.bannedUserIds.has(post.user_id)) return;
            const card = createPostCard(post);
            if (card) DOM.postsFeed.appendChild(card);
        });
    };

    const createPostCard = (post) => {
        const card = document.createElement('article');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.dataset.userId = post.user_id;
        
        const isLiked = state.likedPostIds.has(post.id);
        
        card.innerHTML = `
            <div class="post-card-header">
                <div class="post-card-avatar">${html`${post.nickname?.charAt(0) || '?'}`}</div>
                <div class="post-card-author">
                    <span class="post-card-nickname">${html`${post.nickname || 'Гость'}`}</span>
                    <span class="post-card-time">${formatDate(post.created_at)}</span>
                </div>
            </div>
            ${post.content ? `<div class="post-card-content">${html`${post.content}`}</div>` : ''}
            ${post.image_url ? `<div class="post-card-image"><img src="${html`${post.image_url}`}" alt="Изображение" loading="lazy"></div>` : ''}
            <div class="post-card-actions">
                <button class="like-btn ${isLiked ? 'is-liked' : ''}" data-post-id="${post.id}">
                    <i class="fa-solid fa-heart"></i>
                    <span>${post.likes || 0}</span>
                </button>
            </div>
        `;
        
        const likeBtn = card.querySelector('.like-btn');
        likeBtn.addEventListener('click', () => toggleLike(post.id, likeBtn));
        
        return card;
    };

    const toggleLike = async (postId, btn) => {
        const isLiked = state.likedPostIds.has(postId);
        const countSpan = btn.querySelector('span');
        const currentCount = parseInt(countSpan.textContent, 10);
        
        if (isLiked) {
            state.likedPostIds.delete(postId);
            btn.classList.remove('is-liked');
            countSpan.textContent = Math.max(0, currentCount - 1);
            await supabase.from('likes').delete().match({ post_id: postId, user_id: state.userId });
        } else {
            state.likedPostIds.add(postId);
            btn.classList.add('is-liked');
            countSpan.textContent = currentCount + 1;
            await supabase.from('likes').insert({ post_id: postId, user_id: state.userId });
        }
    };

    const publishPost = async () => {
        if (state.isPublishing || state.bannedUserIds.has(state.userId)) return;
        
        const content = DOM.postTextarea.value.trim();
        if (!content && !state.selectedImage) return;
        
        state.isPublishing = true;
        DOM.publishBtn.disabled = true;
        
        try {
            let imageUrl = null;
            if (state.selectedImage) {
                const ext = state.selectedImage.name.split('.').pop();
                const path = `posts/${state.userId}_${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('post-images')
                    .upload(path, state.selectedImage);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage
                    .from('post-images')
                    .getPublicUrl(path);
                imageUrl = urlData.publicUrl;
            }
            
            const { error: insertError } = await supabase.from('posts').insert({
                user_id: state.userId,
                nickname: state.nickname || 'Гость',
                content: content || '',
                likes: 0,
                image_url: imageUrl,
            });
            
            if (insertError) throw insertError;
            
            DOM.postTextarea.value = '';
            state.selectedImage = null;
            DOM.imagePreviewContainer.classList.add('hidden');
            updateCharCounter();
            loadPosts();
        } catch (err) {
            console.error('Publish error:', err);
            DOM.composerError.classList.remove('hidden');
            DOM.composerErrorText.textContent = 'Не удалось опубликовать пост';
        } finally {
            state.isPublishing = false;
            updatePublishButton();
        }
    };

    // ==================== IMAGE HANDLING ====================
    const setupImageUpload = () => {
        DOM.attachImageBtn.addEventListener('click', () => DOM.imageFileInput.click());
        
        DOM.imageFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            
            state.selectedImage = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                DOM.imagePreview.src = ev.target.result;
                DOM.imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
            updatePublishButton();
        });
        
        DOM.removeImageBtn.addEventListener('click', () => {
            state.selectedImage = null;
            DOM.imageFileInput.value = '';
            DOM.imagePreviewContainer.classList.add('hidden');
            updatePublishButton();
        });
    };

    // ==================== PROFILE EDITOR ====================
    const setupProfileEditor = () => {
        DOM.profileBadge.addEventListener('click', () => {
            DOM.profileEditorOverlay.classList.remove('hidden');
            DOM.nicknameInput.value = state.nickname;
            updateProfileUI();
        });
        
        DOM.cancelProfileBtn.addEventListener('click', () => {
            DOM.profileEditorOverlay.classList.add('hidden');
        });
        
        DOM.profileEditorOverlay.addEventListener('click', (e) => {
            if (e.target === DOM.profileEditorOverlay) {
                DOM.profileEditorOverlay.classList.add('hidden');
            }
        });
        
        DOM.avatarFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const ext = file.name.split('.').pop();
                const path = `avatars/${state.userId}.${ext}`;
                const { error } = await supabase.storage
                    .from('post-images')
                    .upload(path, file, { upsert: true });
                if (error) throw error;
                
                const { data: urlData } = supabase.storage
                    .from('post-images')
                    .getPublicUrl(path);
                
                state.avatarUrl = urlData.publicUrl;
                localStorage.setItem('nobu_avatar', state.avatarUrl);
                updateProfileUI();
            } catch (err) {
                console.error('Avatar upload error:', err);
                DOM.profileEditorError.classList.remove('hidden');
                DOM.profileEditorError.textContent = 'Не удалось загрузить фото';
                setTimeout(() => DOM.profileEditorError.classList.add('hidden'), 3000);
            }
        });
        
        DOM.saveProfileBtn.addEventListener('click', () => {
            const newNickname = DOM.nicknameInput.value.trim();
            if (!newNickname) {
                DOM.profileEditorError.classList.remove('hidden');
                DOM.profileEditorError.textContent = 'Введите никнейм';
                return;
            }
            
            state.nickname = newNickname;
            localStorage.setItem('nobu_nickname', state.nickname);
            updateProfileUI();
            DOM.profileEditorOverlay.classList.add('hidden');
        });
    };

    // ==================== ADMIN ====================
    const setupAdmin = () => {
        const fab = document.createElement('button');
        fab.className = 'admin-fab';
        fab.innerHTML = '<i class="fa-solid fa-shield-halved"></i>';
        fab.setAttribute('aria-label', 'Админ-панель');
        document.body.appendChild(fab);
        
        const panel = document.createElement('div');
        panel.className = 'admin-panel';
        panel.innerHTML = `
            <h3 class="admin-panel-title">Администрирование</h3>
            <input type="password" class="admin-panel-input" id="adminPasswordInput" placeholder="Пароль" autocomplete="off">
            <button class="btn btn-primary" id="adminLoginBtn" style="width:100%;">Войти</button>
            <div class="admin-panel-error" id="adminError">Неверный пароль</div>
            <div class="admin-panel-section" id="adminBannedSection" style="display:none;">
                <h4>Заблокированные пользователи</h4>
                <div id="adminBannedList"></div>
            </div>
        `;
        document.body.appendChild(panel);
        
        fab.addEventListener('click', () => {
            panel.classList.toggle('is-open');
        });
        
        document.getElementById('adminLoginBtn').addEventListener('click', async () => {
            const password = document.getElementById('adminPasswordInput').value;
            if (password === 'nobuadmin2024') {
                state.isAdmin = true;
                fab.classList.add('is-active');
                panel.classList.remove('is-open');
                document.getElementById('adminPasswordInput').value = '';
                document.getElementById('adminError').style.display = 'none';
                document.getElementById('adminBannedSection').style.display = 'block';
                addAdminButtonsToCards();
                await renderBannedUsers();
            } else {
                document.getElementById('adminError').style.display = 'block';
            }
        });
        
        const renderBannedUsers = async () => {
            const { data } = await supabase.from('banned_users').select('*').order('created_at', { ascending: false });
            const container = document.getElementById('adminBannedList');
            
            if (!data || data.length === 0) {
                container.innerHTML = '<p style="color:#555;font-size:0.85rem;">Список пуст</p>';
                return;
            }
            
            container.innerHTML = data.map(entry => `
                <div class="admin-banned-item">
                    <span>${entry.nickname || entry.user_id}</span>
                    <button class="admin-unban-btn" data-user-id="${entry.user_id}">Разблокировать</button>
                </div>
            `).join('');
            
            container.querySelectorAll('.admin-unban-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userId;
                    await supabase.from('banned_users').delete().match({ user_id: userId });
                    state.bannedUserIds.delete(userId);
                    await loadPosts();
                    await renderBannedUsers();
                });
            });
        };
        
        const addAdminButtonsToCards = () => {
            document.querySelectorAll('.post-card').forEach(card => {
                const header = card.querySelector('.post-card-header');
                
                if (!card.querySelector('.admin-delete-btn')) {
                    const delBtn = document.createElement('button');
                    delBtn.className = 'admin-delete-btn';
                    delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                    delBtn.addEventListener('click', async () => {
                        if (!confirm('Удалить этот пост?')) return;
                        await supabase.from('posts').delete().match({ id: card.dataset.postId });
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.95)';
                        setTimeout(() => card.remove(), 200);
                    });
                    header.appendChild(delBtn);
                }
                
                if (!card.querySelector('.admin-block-btn')) {
                    const blockBtn = document.createElement('button');
                    blockBtn.className = 'admin-block-btn';
                    blockBtn.innerHTML = '<i class="fa-solid fa-ban"></i>';
                    blockBtn.addEventListener('click', async () => {
                        const userId = card.dataset.userId;
                        const nickname = card.querySelector('.post-card-nickname').textContent;
                        if (!confirm(`Заблокировать пользователя ${nickname}?`)) return;
                        await supabase.from('banned_users').upsert({ user_id: userId, nickname: nickname });
                        state.bannedUserIds.add(userId);
                        document.querySelectorAll(`.post-card[data-user-id="${userId}"]`).forEach(c => {
                            c.style.opacity = '0';
                            setTimeout(() => c.remove(), 200);
                        });
                        await renderBannedUsers();
                    });
                    header.appendChild(blockBtn);
                }
            });
        };
    };

    // ==================== INIT ====================
    const init = async () => {
        state.userId = getOrCreateUserId();
        state.nickname = localStorage.getItem('nobu_nickname') || '';
        state.avatarUrl = localStorage.getItem('nobu_avatar') || null;
        
        updateProfileUI();
        updateCharCounter();
        
        if (!state.nickname) {
            DOM.profileEditorOverlay.classList.remove('hidden');
        }
        
        setupImageUpload();
        setupProfileEditor();
        setupAdmin();
        
        await Promise.all([loadBannedUsers(), loadUserLikes(), loadPosts()]);
        
        DOM.postTextarea.addEventListener('input', () => {
            updateCharCounter();
            updatePublishButton();
        });
        
        DOM.publishBtn.addEventListener('click', publishPost);
        DOM.retryBtn.addEventListener('click', loadPosts);
        
        setInterval(loadPosts, 5000);
        setInterval(loadBannedUsers, 10000);
        
        supabase.channel('posts-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
                loadPosts();
            })
            .subscribe();
    };
    
    document.addEventListener('DOMContentLoaded', init);
})();