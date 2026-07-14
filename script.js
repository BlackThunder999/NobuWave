(function() {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    const $ = (id) => document.getElementById(id);
    
    const nicknameDisplay = $('nicknameDisplay');
    const nicknameText = $('nicknameText');
    const avatarInitial = $('avatarInitial');
    const avatarCircle = $('avatarCircle');
    const editNicknameBtn = $('editNicknameBtn');
    const nicknameEditor = $('nicknameEditor');
    const nicknameInput = $('nicknameInput');
    const saveNicknameBtn = $('saveNicknameBtn');
    const cancelNicknameBtn = $('cancelNicknameBtn');
    const composerAvatar = document.querySelector('.composer-avatar');
    const composerAvatarInitial = $('composerAvatarInitial');
    const composerNickname = $('composerNickname');
    const postTextarea = $('postTextarea');
    const charCount = $('charCount');
    const publishBtn = $('publishBtn');
    const composerError = $('composerError');
    const composerErrorText = $('composerErrorText');
    const postsFeed = $('postsFeed');
    const feedLoading = $('feedLoading');
    const feedEmpty = $('feedEmpty');
    const feedError = $('feedError');
    const feedErrorText = $('feedErrorText');
    const retryBtn = $('retryBtn');
    const statusDot = $('statusDot');
    const statusText = $('statusText');

    let currentNickname = '';
    let currentUserId = '';
    let isPublishing = false;
    let isAdmin = false;
    let isVerified = false;
    let currentAvatarUrl = null;
    let likedPostIds = new Set();
    let bannedUserIds = new Set();
    let selectedImageFile = null;
    let refreshInterval = null;
    let realtimeChannel = null;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
    }

    function uid() {
        let id = localStorage.getItem('nobu_user_id');
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            id = crypto.randomUUID();
            localStorage.setItem('nobu_user_id', id);
        }
        return id;
    }

    function loadBans() {
        supabase.from('banned_users').select('user_id').then(({data}) => {
            bannedUserIds = new Set(data ? data.map(r=>r.user_id) : []);
        });
    }

    function updateUI() {
        const nick = currentNickname || 'Гость';
        nicknameText.textContent = nick;
        composerNickname.textContent = nick;
        if (currentAvatarUrl) {
            avatarCircle.style.backgroundImage = `url(${currentAvatarUrl})`;
            avatarCircle.classList.add('has-image');
            avatarInitial.textContent = '';
            composerAvatar.style.backgroundImage = `url(${currentAvatarUrl})`;
            composerAvatar.style.backgroundSize = 'cover';
            composerAvatarInitial.textContent = '';
        } else {
            avatarCircle.style.backgroundImage = '';
            avatarCircle.classList.remove('has-image');
            avatarInitial.textContent = nick.charAt(0).toUpperCase();
            composerAvatar.style.backgroundImage = '';
            composerAvatarInitial.textContent = nick.charAt(0).toUpperCase();
        }
        const badge = composerNickname.querySelector('.verified-badge');
        if (isVerified && !badge) {
            const b = document.createElement('span');
            b.className = 'verified-badge';
            b.innerHTML = '<i class="fas fa-check"></i>';
            composerNickname.appendChild(b);
        } else if (!isVerified && badge) badge.remove();
    }

    function canPost() {
        const last = parseInt(localStorage.getItem('nobu_last_post_time')||'0');
        return Date.now() - last >= 5000;
    }

    async function loadPosts() {
        feedLoading.classList.remove('hidden');
        const {data} = await supabase.from('posts').select('*').order('created_at', {ascending: false});
        postsFeed.querySelectorAll('.post-card').forEach(c=>c.remove());
        feedLoading.classList.add('hidden');
        if (!data || data.length === 0) { feedEmpty.classList.remove('hidden'); return; }
        feedEmpty.classList.add('hidden');
        data.forEach(post => {
            if (bannedUserIds.has(post.user_id)) return;
            const card = document.createElement('div');
            card.className = 'post-card';
            card.dataset.postId = post.id;
            card.dataset.userId = post.user_id;
            card.dataset.nickname = post.nickname;
            card.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar">${esc(post.nickname?.charAt(0)||'?')}</div>
                    <div class="post-author-info">
                        <span class="post-nickname">${esc(post.nickname||'Гость')}${post.verified?'<span class="verified-badge"><i class="fas fa-check"></i></span>':''}</span>
                        <span class="post-time">${formatDate(post.created_at)}</span>
                    </div>
                </div>
                ${post.content?`<div class="post-content">${esc(post.content)}</div>`:''}
                ${post.image_url?`<div class="post-image"><img src="${esc(post.image_url)}"></div>`:''}
                <div class="post-actions">
                    <button class="like-btn ${likedPostIds.has(post.id)?'liked':''}">
                        <i class="fas fa-heart"></i> <span>${post.likes||0}</span>
                    </button>
                </div>`;
            card.querySelector('.like-btn').addEventListener('click', () => toggleLike(post.id, card.querySelector('.like-btn')));
            postsFeed.appendChild(card);
        });
    }

    async function toggleLike(postId, btn) {
        const liked = likedPostIds.has(postId);
        const countEl = btn.querySelector('span');
        let c = parseInt(countEl.textContent)||0;
        btn.classList.toggle('liked', !liked);
        countEl.textContent = liked ? Math.max(0,c-1) : c+1;
        likedPostIds[liked?'delete':'add'](postId);
        if (liked) await supabase.from('likes').delete().match({post_id:postId,user_id:currentUserId});
        else await supabase.from('likes').insert({post_id:postId,user_id:currentUserId});
    }

    function formatDate(d) {
        if (!d) return '';
        const diff = Math.floor((Date.now() - new Date(d))/1000);
        if (diff<60) return 'только что';
        if (diff<3600) return `${Math.floor(diff/60)} мин. назад`;
        if (diff<86400) return `${Math.floor(diff/3600)} ч. назад`;
        return new Date(d).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    }

    async function publish() {
        if (isPublishing || bannedUserIds.has(currentUserId)) return;
        const text = postTextarea.value.trim();
        if (!text && !selectedImageFile) return;
        if (!canPost()) { composerError.classList.remove('hidden'); composerErrorText.textContent='Подождите 5 сек'; return; }
        isPublishing = true;
        publishBtn.disabled = true;
        try {
            let img = null;
            if (selectedImageFile) {
                const path = `post-images/${currentUserId}_${Date.now()}.${selectedImageFile.name.split('.').pop()}`;
                await supabase.storage.from('post-images').upload(path, selectedImageFile);
                const {data} = supabase.storage.from('post-images').getPublicUrl(path);
                img = data.publicUrl;
            }
            await supabase.from('posts').insert({
                user_id: currentUserId, nickname: currentNickname,
                content: text, likes: 0, verified: isVerified, image_url: img
            });
            localStorage.setItem('nobu_last_post_time', Date.now().toString());
            postTextarea.value = ''; selectedImageFile = null;
            composerError.classList.add('hidden');
            loadPosts();
        } catch(e) { console.error(e); }
        isPublishing = false;
        publishBtn.disabled = false;
    }

    // Инициализация
    currentUserId = uid();
    currentNickname = localStorage.getItem('nobu_nickname') || '';
    isVerified = localStorage.getItem('nobu_verified') === 'true';
    currentAvatarUrl = localStorage.getItem('nobu_avatar');
    updateUI();
    if (!currentNickname) { nicknameDisplay.classList.add('hidden'); nicknameEditor.classList.remove('hidden'); }

    editNicknameBtn.addEventListener('click', () => {
        nicknameDisplay.classList.add('hidden');
        nicknameEditor.classList.remove('hidden');
        nicknameInput.value = currentNickname;
    });
    saveNicknameBtn.addEventListener('click', () => {
        const nick = nicknameInput.value.trim();
        if (!nick) return;
        if (nick === 'NobuSocial') {
            const pw = prompt('Пароль верификации:');
            isVerified = pw === 'NobuSocialAdmin2024';
            localStorage.setItem('nobu_verified', isVerified);
        } else { isVerified = false; }
        currentNickname = nick;
        localStorage.setItem('nobu_nickname', nick);
        updateUI();
        nicknameEditor.classList.add('hidden');
        nicknameDisplay.classList.remove('hidden');
    });
    cancelNicknameBtn.addEventListener('click', () => {
        if (!currentNickname) return;
        nicknameEditor.classList.add('hidden');
        nicknameDisplay.classList.remove('hidden');
    });
    publishBtn.addEventListener('click', publish);
    postTextarea.addEventListener('input', () => {
        $('charCount').textContent = postTextarea.value.length;
    });
    retryBtn.addEventListener('click', loadPosts);

    loadBans();
    loadPosts();
    refreshInterval = setInterval(loadPosts, 5000);
    setInterval(loadBans, 10000);

    // Realtime
    realtimeChannel = supabase.channel('posts-realtime')
        .on('postgres_changes', {event:'INSERT', schema:'public', table:'posts'}, payload => {
            if (!bannedUserIds.has(payload.new.user_id)) {
                const card = document.createElement('div');
                card.className = 'post-card';
                card.innerHTML = `<div class="post-header"><div class="post-avatar">${esc(payload.new.nickname?.charAt(0)||'?')}</div></div>`;
                postsFeed.insertBefore(card, postsFeed.firstChild);
                feedEmpty.classList.add('hidden');
                loadPosts();
            }
        })
        .subscribe();

    window.addEventListener('beforeunload', () => {
        clearInterval(refreshInterval);
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    });
})();