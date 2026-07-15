const NobuWave = (() => {
    const supabase = window.supabase.createClient(
        'https://iljsednetiogjtowlexo.supabase.co',
        'sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O'
    );

    let currentUser = null;
    let activeChat = null;
    const app = document.getElementById('app');

    const html = (s, ...v) => s.reduce((a, c, i) => a + c + (v[i] !== undefined ? String(v[i]).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]) : ''), '');

    // ========== ВХОД ==========
    const renderLogin = () => {
        app.innerHTML = html`
            <div class="auth-container">
                <div class="auth-card">
                    <div class="auth-logo">
                        <div class="logo-icon"><i class="fa-solid fa-feather"></i></div>
                        <h1>Nobu<span>Wave</span></h1>
                    </div>
                    <input type="text" id="loginUsername" class="auth-input" placeholder="Придумайте никнейм">
                    <button class="auth-btn" id="loginBtn">Войти в NobuWave</button>
                </div>
            </div>
        `;
        document.getElementById('loginBtn').addEventListener('click', async () => {
            const username = document.getElementById('loginUsername').value.trim();
            if (!username) return;
            let { data: user } = await supabase.from('users').select('*').eq('username', username).single();
            if (!user) {
                const { data: newUser } = await supabase.from('users').insert({ username, display_name: username }).select().single();
                user = newUser;
            }
            currentUser = user;
            localStorage.setItem('nobu_user', JSON.stringify(user));
            await supabase.from('users').update({ is_online: true }).eq('id', user.id);
            renderApp();
        });
    };

    // ========== ОСНОВНОЙ ИНТЕРФЕЙС ==========
    const renderApp = () => {
        app.innerHTML = `
            <div class="app-container">
                <div class="header">
                    <div class="header-title">
                        <div class="logo-icon"><i class="fa-solid fa-feather"></i></div>
                        NobuWave
                    </div>
                    <div class="header-actions">
                        <button class="icon-btn" id="newChatBtn"><i class="fa-solid fa-plus"></i></button>
                        <button class="icon-btn" id="scheduledBtn"><i class="fa-solid fa-clock"></i></button>
                        <button class="icon-btn" id="profileBtn"><i class="fa-solid fa-user"></i></button>
                    </div>
                </div>
                <div class="tabs">
                    <button class="tab active" data-tab="chats">💬 Чаты</button>
                    <button class="tab" data-tab="letters">📮 Письма</button>
                </div>
                <div class="chat-list" id="chatList"></div>
            </div>
        `;
        loadChats();
        setupNavigation();
        document.getElementById('newChatBtn').addEventListener('click', showNewChatModal);
        document.getElementById('scheduledBtn').addEventListener('click', showScheduledModal);
        document.getElementById('profileBtn').addEventListener('click', showProfileModal);
    };

    // ========== ЗАГРУЗКА ЧАТОВ ==========
    const loadChats = async () => {
        const { data: members } = await supabase.from('chat_members').select('chat_id').eq('user_id', currentUser.id);
        const chatIds = members?.map(m => m.chat_id) || [];
        if (chatIds.length === 0) {
            document.getElementById('chatList').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Нет чатов. Нажмите + чтобы создать</div>';
            return;
        }
        const { data: chats } = await supabase.from('chats').select('*').in('id', chatIds).order('created_at', { ascending: false });
        document.getElementById('chatList').innerHTML = chats?.map(chat => `
            <div class="chat-item" data-chat-id="${chat.id}">
                <div class="chat-avatar">${chat.is_group ? '👥' : '👤'}</div>
                <div class="chat-info">
                    <div class="chat-name">${chat.name || 'Чат'}</div>
                    <div class="chat-last">Нажмите, чтобы открыть</div>
                </div>
            </div>
        `).join('') || '<div style="text-align:center;padding:40px">Нет чатов</div>';
        document.querySelectorAll('.chat-item').forEach(el => {
            el.addEventListener('click', () => openChat(el.dataset.chatId));
        });
    };

    // ========== ОТКРЫТЬ ЧАТ ==========
    const openChat = async (chatId) => {
        const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
        activeChat = chat;
        app.innerHTML = `
            <div class="chat-view">
                <div class="chat-header">
                    <button class="back-btn" id="backBtn"><i class="fa-solid fa-arrow-left"></i></button>
                    <div class="chat-avatar" style="width:36px;height:36px;font-size:1.2rem">${chat.is_group ? '👥' : '👤'}</div>
                    <div style="flex:1;font-weight:600">${chat.name || 'Чат'}</div>
                </div>
                <div class="messages-list" id="messagesList"></div>
                <div class="input-area">
                    <input type="text" id="messageInput" placeholder="Сообщение...">
                    <button class="send-btn" id="sendBtn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        document.getElementById('backBtn').addEventListener('click', () => renderApp());
        document.getElementById('sendBtn').addEventListener('click', sendMessage);
        document.getElementById('messageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
        loadMessages(chatId);
        supabase.channel(`chat-${chatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, () => loadMessages(chatId)).subscribe();
    };

    const loadMessages = async (chatId) => {
        const { data } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
        const list = document.getElementById('messagesList');
        list.innerHTML = data?.map(msg => `
            <div class="message ${msg.user_id === currentUser.id ? 'mine' : 'theirs'}">
                ${msg.user_id !== currentUser.id ? `<div class="message-sender">${msg.username || 'Пользователь'}</div>` : ''}
                <div>${msg.content || ''}</div>
                ${msg.image_url ? `<img src="${msg.image_url}" class="message-image" style="max-width:200px;border-radius:10px;margin-top:4px">` : ''}
                <div class="message-time">${new Date(msg.created_at).toLocaleTimeString().slice(0,5)}</div>
            </div>
        `).join('') || '<div style="text-align:center;color:var(--text-secondary);padding:20px">Нет сообщений</div>';
        list.scrollTop = list.scrollHeight;
    };

    const sendMessage = async () => {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        if (!content || !activeChat) return;
        await supabase.from('messages').insert({
            chat_id: activeChat.id,
            user_id: currentUser.id,
            username: currentUser.username,
            content
        });
        input.value = '';
    };

    // ========== МОДАЛЬНЫЕ ОКНА ==========
    const showNewChatModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>Новый чат</h3>
                <input type="text" id="newChatUsername" class="modal-input" placeholder="Никнейм собеседника">
                <button class="modal-btn" id="createChatBtn">Создать чат</button>
                <button class="modal-btn secondary" id="closeModalBtn">Отмена</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('createChatBtn').addEventListener('click', async () => {
            const username = document.getElementById('newChatUsername').value.trim();
            if (!username) return;
            const { data: otherUser } = await supabase.from('users').select('*').eq('username', username).single();
            if (!otherUser) { alert('Пользователь не найден'); return; }
            const { data: chat } = await supabase.from('chats').insert({ name: `${currentUser.username} & ${otherUser.username}` }).select().single();
            await supabase.from('chat_members').insert([{ chat_id: chat.id, user_id: currentUser.id }, { chat_id: chat.id, user_id: otherUser.id }]);
            overlay.remove();
            renderApp();
        });
    };

    const showScheduledModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>⏰ Отложенное сообщение</h3>
                <input type="text" id="scheduledUsername" class="modal-input" placeholder="Никнейм получателя">
                <input type="text" id="scheduledContent" class="modal-input" placeholder="Текст сообщения">
                <input type="datetime-local" id="scheduledTime" class="modal-input">
                <button class="modal-btn" id="scheduleBtn">Запланировать</button>
                <button class="modal-btn secondary" id="closeScheduledBtn">Отмена</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeScheduledBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('scheduleBtn').addEventListener('click', async () => {
            const username = document.getElementById('scheduledUsername').value.trim();
            const content = document.getElementById('scheduledContent').value.trim();
            const time = document.getElementById('scheduledTime').value;
            if (!username || !content || !time) return alert('Заполните все поля');
            const { data: otherUser } = await supabase.from('users').select('*').eq('username', username).single();
            if (!otherUser) return alert('Пользователь не найден');
            // Находим или создаём чат
            let { data: chat } = await supabase.from('chats').select('id').eq('name', `${currentUser.username} & ${otherUser.username}`).single();
            if (!chat) {
                const { data: newChat } = await supabase.from('chats').insert({ name: `${currentUser.username} & ${otherUser.username}` }).select().single();
                chat = newChat;
                await supabase.from('chat_members').insert([{ chat_id: chat.id, user_id: currentUser.id }, { chat_id: chat.id, user_id: otherUser.id }]);
            }
            await supabase.from('scheduled_messages').insert({
                chat_id: chat.id,
                user_id: currentUser.id,
                content,
                scheduled_for: new Date(time).toISOString()
            });
            alert('Сообщение запланировано!');
            overlay.remove();
        });
    };

    const showProfileModal = () => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3>Профиль</h3>
                <p style="font-size:1.2rem;font-weight:600;text-align:center">${currentUser.username}</p>
                <p style="color:var(--text-secondary);text-align:center;margin:10px 0">Выберите эмодзи:</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${['👤','😀','😎','🤖','👽','🦊','🐼','🎃','💎','🔥','🌈','⚡','🌟','🍕','🎉'].map(e => `<span style="font-size:2rem;cursor:pointer" class="emoji-opt">${e}</span>`).join('')}</div>
                <button class="modal-btn secondary" id="logoutBtn" style="margin-top:16px;color:#ff4757">Выйти</button>
                <button class="modal-btn secondary" id="closeProfileBtn">Закрыть</button>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeProfileBtn').addEventListener('click', () => overlay.remove());
        document.getElementById('logoutBtn').addEventListener('click', () => { supabase.from('users').update({ is_online: false }).eq('id', currentUser.id); localStorage.removeItem('nobu_user'); location.reload(); });
        overlay.querySelectorAll('.emoji-opt').forEach(el => {
            el.addEventListener('click', async () => {
                await supabase.from('users').update({ avatar_emoji: el.textContent }).eq('id', currentUser.id);
                overlay.remove();
            });
        });
    };

    const setupNavigation = () => {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    };

    // ========== ЗАПУСК ==========
    const init = async () => {
        const saved = localStorage.getItem('nobu_user');
        if (saved) {
            currentUser = JSON.parse(saved);
            await supabase.from('users').update({ is_online: true }).eq('id', currentUser.id);
            renderApp();
        } else {
            renderLogin();
        }
        window.addEventListener('beforeunload', () => {
            if (currentUser) supabase.from('users').update({ is_online: false }).eq('id', currentUser.id);
        });
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => NobuWave.init());