/* ==========================================================
   NobuChirp
   script.js
   Версия 2.0
   ========================================================== */

// ==========================================================
// Supabase
// ==========================================================

const SUPABASE_URL =
    "https://iljsednetiogjtowlexo.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O";

const supabase =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

// ==========================================================
// Константы
// ==========================================================

const SESSION_KEY = "nobuchirp_session";

const ADMIN_PASSWORD =
    "NobuWaveAdmin2024";

const SESSION_LIFETIME =
    7 * 24 * 60 * 60 * 1000;

const WARNING_TIME =
    3 * 60 * 1000;

const CHECK_INTERVAL =
    10000;

const MAX_POST_LENGTH = 280;

// ==========================================================
// Глобальное состояние
// ==========================================================

const state = {

    currentUser: null,

    currentFeed: "all",

    currentProfile: null,

    selectedImage: null,

    selectedChirpId: null,

    selectedReportId: null,

    selectedCommentsId: null,

    isSubmitting: false,

    chirps: [],

    trends: [],

    reports: [],

    comments: [],

    realtime: {

        chirps: null,

        comments: null

    },

    timers: {

        warning: null,

        refresh: null

    }

};

// ==========================================================
// DOM
// ==========================================================

const elements = {

    loading:
        document.getElementById("loadingScreen"),

    app:
        document.getElementById("app"),

    auth:
        document.getElementById("authScreen"),

    ban:
        document.getElementById("banScreen"),

    warning:
        document.getElementById("warningScreen"),

    toast:
        document.getElementById("toastContainer"),

    authForm:
        document.getElementById("authForm"),

    loginTab:
        document.getElementById("loginTab"),

    registerTab:
        document.getElementById("registerTab"),

    nickname:
        document.getElementById("nicknameInput"),

    password:
        document.getElementById("passwordInput"),

    authButton:
        document.getElementById("authSubmitBtn"),

    logout:
        document.getElementById("logoutButton"),

    adminButton:
        document.getElementById("adminButton"),

    profileButton:
        document.getElementById("profileButton"),

    chirpInput:
        document.getElementById("chirpInput"),

    publishButton:
        document.getElementById("publishButton"),

    imageInput:
        document.getElementById("imageInput"),

    imagePreview:
        document.getElementById("imagePreview"),

    previewImage:
        document.getElementById("previewImage"),

    removeImage:
        document.getElementById("removeImageButton"),

    charCounter:
        document.getElementById("charCounter"),

    feed:
        document.getElementById("feedContainer"),

    trends:
        document.getElementById("trendsList")

};

// ==========================================================
// Вспомогательные функции
// ==========================================================

const qs = (id) =>
    document.getElementById(id);

const sleep = (ms) =>
    new Promise(resolve =>
        setTimeout(resolve, ms)
    );

function escapeHtml(text = "") {

    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

}

function formatDate(date) {

    if (!date) {

        return "";

    }

    return new Date(date)
        .toLocaleString(
            "ru-RU",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

}

function show(element) {

    if (!element) return;

    element.classList.remove("hidden");

}

function hide(element) {

    if (!element) return;

    element.classList.add("hidden");

}

function showToast(message) {

    const toast =
        document.createElement("div");

    toast.className = "toast";

    toast.textContent = message;

    elements.toast.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}

// ==========================================================
// Работа с сессией
// ==========================================================

function saveSession(user) {

    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({

            user,

            expiresAt:
                Date.now() +
                SESSION_LIFETIME

        })

    );

}

function loadSession() {

    try {

        const session =
            JSON.parse(
                localStorage.getItem(
                    SESSION_KEY
                )
            );

        if (!session) {

            return null;

        }

        if (
            Date.now() >
            session.expiresAt
        ) {

            localStorage.removeItem(
                SESSION_KEY
            );

            return null;

        }

        return session.user;

    } catch {

        return null;

    }

}

function clearSession() {

    localStorage.removeItem(
        SESSION_KEY
    );

}
// ==========================================================
// API
// ==========================================================

const api = {

    async getUserById(id) {

        const { data, error } =
            await supabase
                .from("users")
                .select("*")
                .eq("id", id)
                .single();

        if (error) throw error;

        return data;

    },

    async getUserByNickname(nickname) {

        const { data, error } =
            await supabase
                .from("users")
                .select("*")
                .eq("nickname", nickname)
                .maybeSingle();

        if (error) throw error;

        return data;

    },

    async createUser(user) {

        const { data, error } =
            await supabase
                .from("users")
                .insert(user)
                .select()
                .single();

        if (error) throw error;

        return data;

    },

    async updateUser(id, values) {

        const { error } =
            await supabase
                .from("users")
                .update(values)
                .eq("id", id);

        if (error) throw error;

    }

};

// ==========================================================
// Авторизация
// ==========================================================

let loginMode = true;

function updateAuthUI() {

    if (loginMode) {

        elements.loginTab.classList.add("active");
        elements.registerTab.classList.remove("active");

        elements.authButton.textContent =
            "Войти";

    } else {

        elements.registerTab.classList.add("active");
        elements.loginTab.classList.remove("active");

        elements.authButton.textContent =
            "Создать аккаунт";

    }

}

async function login() {

    const nickname =
        elements.nickname.value.trim();

    const password =
        elements.password.value;

    if (!nickname || !password) {

        showToast(
            "Заполните все поля"
        );

        return;

    }

    try {

        const user =
            await api.getUserByNickname(
                nickname
            );

        if (!user) {

            showToast(
                "Пользователь не найден"
            );

            return;

        }

        if (
            user.password !== password
        ) {

            showToast(
                "Неверный пароль"
            );

            return;

        }

        state.currentUser = user;

        saveSession(user);

        await initializeApp();

    } catch (error) {

        console.error(error);

        showToast(
            "Ошибка входа"
        );

    }

}

async function register() {

    const nickname =
        elements.nickname.value.trim();

    const password =
        elements.password.value;

    if (
        nickname.length < 3
    ) {

        showToast(
            "Минимум 3 символа"
        );

        return;

    }

    if (
        password.length < 4
    ) {

        showToast(
            "Минимум 4 символа"
        );

        return;

    }

    try {

        const exists =
            await api.getUserByNickname(
                nickname
            );

        if (exists) {

            showToast(
                "Такой ник уже существует"
            );

            return;

        }

        const user =
            await api.createUser({

                nickname,

                password,

                emoji: "😀",

                bio: "",

                is_admin: false,

                is_verified: false,

                is_banned: false,

                ban_reason: null,

                ban_expires_at: null,

                has_warning: false,

                warning_message: null,

                warning_expires_at: null,

                streak: 0

            });

        state.currentUser = user;

        saveSession(user);

        showToast(
            "Аккаунт создан"
        );

        await initializeApp();

    } catch (error) {

        console.error(error);

        showToast(
            "Ошибка регистрации"
        );

    }

}

// ==========================================================
// Обработчики авторизации
// ==========================================================

elements.loginTab.addEventListener(
    "click",
    () => {

        loginMode = true;

        updateAuthUI();

    }
);

elements.registerTab.addEventListener(
    "click",
    () => {

        loginMode = false;

        updateAuthUI();

    }
);

elements.authForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        if (loginMode) {

            await login();

        } else {

            await register();

        }

    }
);

elements.logout.addEventListener(
    "click",
    () => {

        clearSession();

        location.reload();

    }
);
// ==========================================================
// Инициализация приложения
// ==========================================================

async function initializeApp() {

    try {

        show(elements.loading);

        hide(elements.auth);

        hide(elements.app);

        await refreshCurrentUser();

        if (!state.currentUser) {

            clearSession();

            hide(elements.loading);

            show(elements.auth);

            return;

        }

        await handleModerationState();

        if (state.currentUser.is_banned) {

            hide(elements.loading);

            return;

        }

        updateMiniProfile();

        await loadStatistics();

        await loadTrends();

        await loadFeed();

        initializeRealtime();

        startRefreshTimer();

        hide(elements.loading);

        show(elements.app);

        if (state.currentUser.is_admin) {

            show(elements.adminButton);

        } else {

            hide(elements.adminButton);

        }

    } catch (error) {

        console.error(error);

        hide(elements.loading);

        show(elements.auth);

        showToast("Ошибка запуска приложения");

    }

}

// ==========================================================
// Восстановление пользователя
// ==========================================================

async function refreshCurrentUser() {

    if (!state.currentUser?.id) {

        return;

    }

    try {

        state.currentUser =
            await api.getUserById(
                state.currentUser.id
            );

        saveSession(
            state.currentUser
        );

    } catch (error) {

        console.error(error);

    }

}

// ==========================================================
// Проверка бана / предупреждения
// ==========================================================

async function handleModerationState() {

    const user =
        state.currentUser;

    if (!user) {

        return;

    }

    hide(elements.ban);

    hide(elements.warning);

    if (user.is_banned) {

        show(elements.ban);

        qs("banReason").textContent =
            user.ban_reason ||
            "Причина не указана";

        qs("banExpires").textContent =
            user.ban_expires_at
                ? formatDate(
                    user.ban_expires_at
                )
                : "Навсегда";

        return;

    }

    if (!user.has_warning) {

        return;

    }

    show(elements.warning);

    qs("warningMessage").textContent =
        user.warning_message ||
        "Вам вынесено предупреждение.";

    await startWarningTimer();

}

// ==========================================================
// Таймер предупреждения
// ==========================================================

async function startWarningTimer() {

    const button =
        qs("warningAcceptBtn");

    const counter =
        qs("warningCountdown");

    button.disabled = true;

    if (state.timers.warning) {

        clearInterval(
            state.timers.warning
        );

    }

    let expires;

    if (
        state.currentUser.warning_expires_at
    ) {

        expires =
            new Date(
                state.currentUser
                    .warning_expires_at
            ).getTime();

    } else {

        expires =
            Date.now() +
            WARNING_TIME;

    }

    function update() {

        const left =
            Math.max(
                0,
                expires - Date.now()
            );

        const total =
            Math.floor(
                left / 1000
            );

        const minutes =
            String(
                Math.floor(
                    total / 60
                )
            ).padStart(2, "0");

        const seconds =
            String(
                total % 60
            ).padStart(2, "0");

        counter.textContent =
            `${minutes}:${seconds}`;

        if (left <= 0) {

            clearInterval(
                state.timers.warning
            );

            button.disabled =
                false;

        }

    }

    update();

    state.timers.warning =
        setInterval(
            update,
            1000
        );

}

qs("warningAcceptBtn")
.addEventListener(
    "click",
    async () => {

        try {

            await api.updateUser(
                state.currentUser.id,
                {

                    has_warning:
                        false,

                    warning_message:
                        null,

                    warning_expires_at:
                        null

                }
            );

            state.currentUser =
                await api.getUserById(
                    state.currentUser.id
                );

            hide(elements.warning);

            showToast(
                "Предупреждение принято"
            );

        } catch (error) {

            console.error(error);

            showToast(
                "Не удалось снять предупреждение"
            );

        }

    }
);

// ==========================================================
// Автообновление
// ==========================================================

function startRefreshTimer() {

    if (state.timers.refresh) {

        clearInterval(
            state.timers.refresh
        );

    }

    state.timers.refresh =
        setInterval(
            async () => {

                await refreshCurrentUser();

                await handleModerationState();

            },
            CHECK_INTERVAL
        );

}

// ==========================================================
// Автовход
// ==========================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        updateAuthUI();

        const session =
            loadSession();

        if (!session) {

            hide(elements.loading);

            show(elements.auth);

            return;

        }

        state.currentUser =
            session;

        await initializeApp();

    }
);
// ==========================================================
// Создание постов (Chirps)
// ==========================================================

// Счетчик символов

elements.chirpInput.addEventListener(
    "input",
    () => {

        const length =
            elements.chirpInput.value.length;

        elements.charCounter.textContent =
            `${MAX_POST_LENGTH - length}`;

    }
);


// ==========================================================
// Выбор изображения
// ==========================================================

elements.imageInput.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];

        if (!file) {

            return;

        }


        if (
            !file.type.startsWith("image/")
        ) {

            showToast(
                "Можно загрузить только изображение"
            );

            return;

        }


        state.selectedImage =
            file;


        const reader =
            new FileReader();


        reader.onload = e => {

            elements.previewImage.src =
                e.target.result;

            show(
                elements.imagePreview
            );

        };


        reader.readAsDataURL(file);

    }
);


// ==========================================================
// Удаление изображения
// ==========================================================

elements.removeImage.addEventListener(
    "click",
    () => {

        state.selectedImage =
            null;

        elements.imageInput.value =
            "";

        hide(
            elements.imagePreview
        );

        elements.previewImage.src =
            "";

    }
);


// ==========================================================
// Загрузка изображения в Storage
// ==========================================================

async function uploadImage(file) {

    if (!file) {

        return null;

    }


    try {

        const extension =
            file.name
                .split(".")
                .pop();


        const filename =
            `${Date.now()}-${crypto.randomUUID()}.${extension}`;


        const { error } =
            await supabase
                .storage
                .from("images")
                .upload(
                    filename,
                    file
                );


        if (error) {

            throw error;

        }


        const { data } =
            supabase
                .storage
                .from("images")
                .getPublicUrl(
                    filename
                );


        return data.publicUrl;


    } catch(error) {

        console.error(error);

        throw error;

    }

}


// ==========================================================
// Обновление streak
// ==========================================================

async function updateStreak() {

    const user =
        state.currentUser;


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    const last =
        user.last_post_date;


    let streak =
        user.streak || 0;


    if (!last) {

        streak = 1;

    } else {


        const lastDate =
            new Date(last);


        const diff =
            Math.floor(
                (
                    new Date(today)
                    -
                    lastDate
                )
                /
                (
                    1000 *
                    60 *
                    60 *
                    24
                )
            );


        if (diff === 1) {

            streak++;

        } else if (diff > 1) {

            streak = 1;

        }

    }


    await api.updateUser(
        user.id,
        {

            streak,

            last_post_date:
                today

        }
    );


    state.currentUser.streak =
        streak;


    state.currentUser.last_post_date =
        today;

}


// ==========================================================
// Извлечение хештегов
// ==========================================================

function extractHashtags(text) {

    const matches =
        text.match(
            /#[\p{L}\p{N}_]+/gu
        );


    if (!matches) {

        return [];

    }


    return [
        ...new Set(matches)
    ];

}


// ==========================================================
// Обновление трендов
// ==========================================================

async function updateTrends(text) {

    const tags =
        extractHashtags(text);


    for (const tag of tags) {


        const clean =
            tag.toLowerCase();


        const { data } =
            await supabase
                .from("trends")
                .select("*")
                .eq(
                    "hashtag",
                    clean
                )
                .maybeSingle();


        if (data) {


            await supabase
                .from("trends")
                .update({

                    count:
                        data.count + 1,

                    updated_at:
                        new Date()

                })
                .eq(
                    "id",
                    data.id
                );


        } else {


            await supabase
                .from("trends")
                .insert({

                    hashtag:
                        clean,

                    count:
                        1

                });


        }

    }

}


// ==========================================================
// Публикация поста
// ==========================================================

async function createChirp() {


    if (state.isSubmitting) {

        return;

    }


    const content =
        elements.chirpInput.value
            .trim();


    if (!content) {

        showToast(
            "Введите текст"
        );

        return;

    }


    state.isSubmitting =
        true;


    elements.publishButton.disabled =
        true;


    try {


        const imageUrl =
            await uploadImage(
                state.selectedImage
            );


        await updateStreak();


        const { error } =
            await supabase
                .from("chirps")
                .insert({

                    user_id:
                        state.currentUser.id,

                    content,

                    image_url:
                        imageUrl,

                    is_verified:
                        state.currentUser
                            .is_verified

                });


        if (error) {

            throw error;

        }


        await updateTrends(
            content
        );


        elements.chirpInput.value =
            "";

        elements.charCounter.textContent =
            MAX_POST_LENGTH;


        state.selectedImage =
            null;


        elements.imageInput.value =
            "";


        hide(
            elements.imagePreview
        );


        showToast(
            "Пост опубликован"
        );


    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка публикации"
        );


    } finally {


        state.isSubmitting =
            false;


        elements.publishButton.disabled =
            false;


    }

}


elements.publishButton.addEventListener(
    "click",
    createChirp
);
// ==========================================================
// Загрузка ленты
// ==========================================================

async function loadFeed() {

    try {

        let query =
            supabase
                .from("chirps")
                .select(`
                    *,
                    users(
                        id,
                        nickname,
                        emoji,
                        is_verified,
                        streak
                    )
                `)
                .order(
                    "created_at",
                    {
                        ascending:false
                    }
                );


        if (
            state.currentFeed === "following"
        ) {

            const follows =
                await getFollowingIds();


            if (
                follows.length === 0
            ) {

                renderEmptyFeed(
                    "Вы пока ни на кого не подписаны"
                );

                return;

            }


            query =
                query.in(
                    "user_id",
                    follows
                );

        }


        const { data, error } =
            await query;


        if (error) {

            throw error;

        }


        state.chirps =
            data || [];


        renderFeed();


    } catch(error) {

        console.error(error);

        showToast(
            "Ошибка загрузки ленты"
        );

    }

}


// ==========================================================
// Получение подписок
// ==========================================================

async function getFollowingIds() {

    const { data, error } =
        await supabase
            .from("follows")
            .select(
                "following_id"
            )
            .eq(
                "follower_id",
                state.currentUser.id
            );


    if (error) {

        throw error;

    }


    return data.map(
        item =>
            item.following_id
    );

}


// ==========================================================
// Пустая лента
// ==========================================================

function renderEmptyFeed(text) {

    elements.feed.innerHTML =
        `

        <div class="sidebar-block">

            ${text}

        </div>

        `;

}


// ==========================================================
// Отрисовка ленты
// ==========================================================

function renderFeed() {


    elements.feed.innerHTML =
        "";


    if (
        state.chirps.length === 0
    ) {

        renderEmptyFeed(
            "Постов пока нет"
        );

        return;

    }


    state.chirps.forEach(
        chirp => {

            elements.feed
                .appendChild(
                    createChirpElement(
                        chirp
                    )
                );

        }
    );

}


// ==========================================================
// Создание карточки поста
// ==========================================================

function createChirpElement(chirp) {


    const article =
        document.createElement(
            "article"
        );


    article.className =
        "chirp";


    if (
        chirp.users?.streak >= 2
    ) {

        article.classList.add(
            "streak"
        );

    }


    const verified =
        chirp.is_verified
            ? `<span class="verified-badge">✓</span>`
            : "";


    const image =
        chirp.image_url
            ?
            `
            <img
                class="chirp-image"
                src="${chirp.image_url}"
                alt="image"
            >
            `
            :
            "";


    const hashtags =
        convertHashtags(
            chirp.content
        );


    article.innerHTML =
        `

        <div class="chirp-header">

            <div class="chirp-user">

                <span>
                    ${chirp.users?.emoji || "😀"}
                </span>

                <span>
                    ${escapeHtml(
                        chirp.users?.nickname ||
                        "Unknown"
                    )}
                    ${verified}
                </span>

            </div>


            <span
                class="post-id"
                data-id="${chirp.id}"
            >
                #${chirp.id}
            </span>

        </div>


        <div class="chirp-content">

            ${hashtags}

        </div>


        ${image}


        <div class="chirp-actions">


            <button
                class="action-btn like-btn"
                data-id="${chirp.id}"
            >
                ❤️
                <span>
                    0
                </span>
            </button>


            <button
                class="action-btn dislike-btn"
                data-id="${chirp.id}"
            >
                👎
                <span>
                    0
                </span>
            </button>


            <button
                class="action-btn rechirp-btn"
                data-id="${chirp.id}"
            >
                🔄
                <span>
                    0
                </span>
            </button>


            <button
                class="action-btn comment-btn"
                data-id="${chirp.id}"
            >
                💬
            </button>


        </div>

        `;


    setupChirpButtons(
        article
    );


    return article;

}


// ==========================================================
// Хештеги
// ==========================================================

function convertHashtags(text) {


    const safe =
        escapeHtml(text);


    return safe.replace(
        /#[\p{L}\p{N}_]+/gu,
        tag =>
            `
            <span
                class="hashtag"
                data-tag="${tag}"
            >
                ${tag}
            </span>
            `
    );

}


// ==========================================================
// Кнопки поста
// ==========================================================

function setupChirpButtons(card) {


    const idButtons =
        card.querySelectorAll(
            ".post-id"
        );


    idButtons.forEach(
        btn => {

            btn.addEventListener(
                "click",
                async () => {

                    await navigator
                        .clipboard
                        .writeText(
                            btn.dataset.id
                        );

                    showToast(
                        "ID скопирован"
                    );

                }
            );

        }
    );


    card.querySelectorAll(
        ".comment-btn"
    )
    .forEach(
        btn => {

            btn.addEventListener(
                "click",
                () => {

                    openComments(
                        btn.dataset.id
                    );

                }
            );

        }
    );


    card.querySelectorAll(
        ".like-btn"
    )
    .forEach(
        btn => {

            btn.addEventListener(
                "click",
                () =>
                    toggleLike(
                        btn.dataset.id
                    )
            );

        }
    );


    card.querySelectorAll(
        ".dislike-btn"
    )
    .forEach(
        btn => {

            btn.addEventListener(
                "click",
                () =>
                    toggleDislike(
                        btn.dataset.id
                    )
            );

        }
    );


    card.querySelectorAll(
        ".rechirp-btn"
    )
    .forEach(
        btn => {

            btn.addEventListener(
                "click",
                () =>
                    createRechirp(
                        btn.dataset.id
                    )
            );

        }
    );


}
// ==========================================================
// ЛАЙКИ
// ==========================================================

async function toggleLike(chirpId) {

    try {

        const { data: existing } =
            await supabase
                .from("likes")
                .select("id")
                .eq(
                    "user_id",
                    state.currentUser.id
                )
                .eq(
                    "chirp_id",
                    chirpId
                )
                .maybeSingle();


        if (existing) {

            await supabase
                .from("likes")
                .delete()
                .eq(
                    "id",
                    existing.id
                );

            showToast(
                "Лайк убран"
            );

        } else {


            await supabase
                .from("dislikes")
                .delete()
                .eq(
                    "user_id",
                    state.currentUser.id
                )
                .eq(
                    "chirp_id",
                    chirpId
                );


            await supabase
                .from("likes")
                .insert({

                    user_id:
                        state.currentUser.id,

                    chirp_id:
                        chirpId

                });


            showToast(
                "❤️ Лайк"
            );

        }


        await loadFeed();


    } catch(error) {

        console.error(error);

        showToast(
            "Ошибка лайка"
        );

    }

}


// ==========================================================
// ДИЗЛАЙКИ
// ==========================================================

async function toggleDislike(chirpId) {


    try {


        const { data: existing } =
            await supabase
                .from("dislikes")
                .select("id")
                .eq(
                    "user_id",
                    state.currentUser.id
                )
                .eq(
                    "chirp_id",
                    chirpId
                )
                .maybeSingle();



        if (existing) {


            await supabase
                .from("dislikes")
                .delete()
                .eq(
                    "id",
                    existing.id
                );


            showToast(
                "Дизлайк убран"
            );


        } else {


            await supabase
                .from("likes")
                .delete()
                .eq(
                    "user_id",
                    state.currentUser.id
                )
                .eq(
                    "chirp_id",
                    chirpId
                );


            await supabase
                .from("dislikes")
                .insert({

                    user_id:
                        state.currentUser.id,

                    chirp_id:
                        chirpId

                });


            showToast(
                "👎 Дизлайк"
            );

        }


        await loadFeed();


    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка дизлайка"
        );


    }

}


// ==========================================================
// Репосты
// ==========================================================

async function createRechirp(chirpId) {


    try {


        const { data: exists } =
            await supabase
                .from("rechirps")
                .select("id")
                .eq(
                    "user_id",
                    state.currentUser.id
                )
                .eq(
                    "chirp_id",
                    chirpId
                )
                .maybeSingle();



        if (exists) {


            showToast(
                "Вы уже сделали Rechirp"
            );


            return;

        }



        const { error } =
            await supabase
                .from("rechirps")
                .insert({

                    user_id:
                        state.currentUser.id,

                    chirp_id:
                        chirpId

                });



        if (error) {

            throw error;

        }



        showToast(
            "🔄 Репост создан"
        );


        await loadFeed();



    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка репоста"
        );


    }

}


// ==========================================================
// Получение статистики поста
// ==========================================================

async function getChirpStats(chirpId) {


    try {


        const [
            likes,
            dislikes,
            rechirps
        ] =
        await Promise.all([


            supabase
                .from("likes")
                .select(
                    "id",
                    {
                        count:"exact"
                    }
                )
                .eq(
                    "chirp_id",
                    chirpId
                ),


            supabase
                .from("dislikes")
                .select(
                    "id",
                    {
                        count:"exact"
                    }
                )
                .eq(
                    "chirp_id",
                    chirpId
                ),


            supabase
                .from("rechirps")
                .select(
                    "id",
                    {
                        count:"exact"
                    }
                )
                .eq(
                    "chirp_id",
                    chirpId
                )

        ]);



        return {

            likes:
                likes.count || 0,

            dislikes:
                dislikes.count || 0,

            rechirps:
                rechirps.count || 0

        };


    } catch(error) {


        console.error(error);


        return {

            likes:0,

            dislikes:0,

            rechirps:0

        };


    }

}


// ==========================================================
// Обновление счетчиков
// ==========================================================

async function updateChirpCounters() {


    const cards =
        document.querySelectorAll(
            ".chirp"
        );



    for (
        const card of cards
    ) {


        const id =
            card
                .querySelector(
                    ".post-id"
                )
                ?.dataset.id;



        if (!id) continue;



        const stats =
            await getChirpStats(
                id
            );



        const like =
            card.querySelector(
                ".like-btn span"
            );


        const dislike =
            card.querySelector(
                ".dislike-btn span"
            );


        const rechirp =
            card.querySelector(
                ".rechirp-btn span"
            );



        if (like)
            like.textContent =
                stats.likes;


        if (dislike)
            dislike.textContent =
                stats.dislikes;


        if (rechirp)
            rechirp.textContent =
                stats.rechirps;


    }


}


// Обновляем счетчики после загрузки

setInterval(
    updateChirpCounters,
    5000
);
// ==========================================================
// КОММЕНТАРИИ
// ==========================================================

async function openComments(chirpId) {

    state.selectedCommentsId =
        chirpId;

    const modal =
        document.getElementById(
            "commentsModal"
        );

    if (!modal) {

        return;

    }


    show(modal);


    await loadComments(
        chirpId
    );


    setupCommentsRealtime(
        chirpId
    );

}


// ==========================================================
// Загрузка комментариев
// ==========================================================

async function loadComments(chirpId) {


    const container =
        document.getElementById(
            "commentsList"
        );


    if (!container) {

        return;

    }


    try {


        const { data, error } =
            await supabase
                .from("comments")
                .select(`
                    *,
                    users(
                        nickname,
                        emoji,
                        is_verified
                    )
                `)
                .eq(
                    "chirp_id",
                    chirpId
                )
                .order(
                    "created_at",
                    {
                        ascending:true
                    }
                );



        if (error) {

            throw error;

        }



        container.innerHTML =
            "";



        if (
            !data ||
            data.length === 0
        ) {


            container.innerHTML =
                `
                <div class="comment">
                    Комментариев пока нет
                </div>
                `;


            return;

        }



        data.forEach(
            comment => {


                const verified =
                    comment.users
                    ?.is_verified
                    ?
                    "✓"
                    :
                    "";



                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "comment";



                div.innerHTML =
                    `

                    <b>
                        ${
                            comment.users
                            ?.emoji || "😀"
                        }

                        ${
                            escapeHtml(
                                comment.users
                                ?.nickname ||
                                "User"
                            )
                        }

                        <span class="verified-badge">
                            ${verified}
                        </span>

                    </b>


                    <p>
                        ${
                            escapeHtml(
                                comment.content
                            )
                        }
                    </p>


                    <small>
                        ${
                            formatDate(
                                comment.created_at
                            )
                        }
                    </small>

                    `;



                container.appendChild(
                    div
                );


            }
        );



    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка загрузки комментариев"
        );


    }

}


// ==========================================================
// Отправка комментария
// ==========================================================

async function sendComment() {


    const input =
        document.getElementById(
            "commentInput"
        );



    if (!input) {

        return;

    }



    const text =
        input.value.trim();



    if (!text) {


        showToast(
            "Введите комментарий"
        );


        return;

    }



    if (
        !state.selectedCommentsId
    ) {


        return;

    }



    try {


        const { error } =
            await supabase
                .from("comments")
                .insert({

                    user_id:
                        state.currentUser.id,


                    chirp_id:
                        state.selectedCommentsId,


                    content:
                        text

                });



        if (error) {

            throw error;

        }



        input.value =
            "";



        await loadComments(
            state.selectedCommentsId
        );


    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка комментария"
        );


    }

}


// ==========================================================
// Realtime комментариев
// ==========================================================

function setupCommentsRealtime(
    chirpId
) {


    if (
        state.realtime.comments
    ) {


        supabase
            .removeChannel(
                state.realtime.comments
            );


    }



    state.realtime.comments =
        supabase
            .channel(
                "comments-" + chirpId
            )
            .on(
                "postgres_changes",
                {

                    event:"*",

                    schema:"public",

                    table:"comments",

                    filter:
                        `chirp_id=eq.${chirpId}`

                },

                async () => {


                    await loadComments(
                        chirpId
                    );


                }
            )
            .subscribe();


}


// ==========================================================
// Закрытие комментариев
// ==========================================================

const closeComments =
    document.getElementById(
        "closeCommentsModal"
    );


if (closeComments) {


    closeComments.addEventListener(
        "click",
        () => {


            const modal =
                document.getElementById(
                    "commentsModal"
                );


            hide(modal);



            if (
                state.realtime.comments
            ) {


                supabase
                    .removeChannel(
                        state.realtime.comments
                    );


            }


        }
    );


}



const sendCommentButton =
    document.getElementById(
        "sendCommentButton"
    );


if (sendCommentButton) {


    sendCommentButton.addEventListener(
        "click",
        sendComment
    );


}
// ==========================================================
// ПРОФИЛЬ
// ==========================================================

async function openProfile(userId = null) {

    try {

        let user;


        if (userId) {

            user =
                await api.getUserById(
                    userId
                );

        } else {

            user =
                state.currentUser;

        }


        state.currentProfile =
            user;


        const modal =
            document.getElementById(
                "profileModal"
            );


        if (!modal) {

            return;

        }


        const emoji =
            document.getElementById(
                "profileEmoji"
            );


        const nickname =
            document.getElementById(
                "profileNickname"
            );


        const verified =
            document.getElementById(
                "profileVerified"
            );


        const bio =
            document.getElementById(
                "profileBio"
            );



        if (emoji)
            emoji.textContent =
                user.emoji || "😀";


        if (nickname)
            nickname.textContent =
                user.nickname;



        if (verified) {

            if (user.is_verified) {

                show(verified);

            } else {

                hide(verified);

            }

        }



        if (bio)
            bio.textContent =
                user.bio ||
                "Нет описания";



        await loadUserPosts(
            user.id
        );



        updateProfileButtons();



        show(modal);



    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка профиля"
        );


    }

}


// ==========================================================
// Кнопки профиля
// ==========================================================

function updateProfileButtons() {


    const edit =
        document.getElementById(
            "editProfileButton"
        );


    const follow =
        document.getElementById(
            "followButton"
        );



    if (
        !state.currentProfile
    ) {

        return;

    }



    if (
        state.currentProfile.id ===
        state.currentUser.id
    ) {


        show(edit);


        hide(follow);


    } else {


        hide(edit);


        show(follow);


        checkFollowStatus();


    }

}


// ==========================================================
// Мини профиль
// ==========================================================

function updateMiniProfile() {


    const emoji =
        document.getElementById(
            "miniEmoji"
        );


    const nickname =
        document.getElementById(
            "miniNickname"
        );


    const bio =
        document.getElementById(
            "miniBio"
        );



    if (emoji)
        emoji.textContent =
            state.currentUser.emoji ||
            "😀";


    if (nickname)
        nickname.textContent =
            state.currentUser.nickname;


    if (bio)
        bio.textContent =
            state.currentUser.bio ||
            "Нет описания";

}


// ==========================================================
// Посты пользователя
// ==========================================================

async function loadUserPosts(userId) {


    const container =
        document.getElementById(
            "profilePosts"
        );



    if (!container) {

        return;

    }



    try {


        const { data, error } =
            await supabase
                .from("chirps")
                .select(`
                    *,
                    users(
                        nickname,
                        emoji,
                        is_verified,
                        streak
                    )
                `)
                .eq(
                    "user_id",
                    userId
                )
                .order(
                    "created_at",
                    {
                        ascending:false
                    }
                );



        if (error) {

            throw error;

        }



        container.innerHTML =
            "";



        data.forEach(
            post => {


                container.appendChild(
                    createChirpElement(
                        post
                    )
                );


            }
        );



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// Редактирование профиля
// ==========================================================

const editButton =
    document.getElementById(
        "editProfileButton"
    );


if (editButton) {


    editButton.addEventListener(
        "click",
        () => {


            const modal =
                document.getElementById(
                    "editProfileModal"
                );


            const emoji =
                document.getElementById(
                    "emojiInput"
                );


            const bio =
                document.getElementById(
                    "bioInput"
                );


            if (emoji)
                emoji.value =
                    state.currentUser.emoji;


            if (bio)
                bio.value =
                    state.currentUser.bio;


            show(modal);


        }
    );

}


// ==========================================================
// Сохранение профиля
// ==========================================================

const saveProfile =
    document.getElementById(
        "saveProfileButton"
    );


if (saveProfile) {


    saveProfile.addEventListener(
        "click",
        async () => {


            try {


                const emoji =
                    document.getElementById(
                        "emojiInput"
                    ).value;


                const bio =
                    document.getElementById(
                        "bioInput"
                    ).value;



                await api.updateUser(
                    state.currentUser.id,
                    {

                        emoji,

                        bio

                    }
                );



                await refreshCurrentUser();



                updateMiniProfile();



                hide(
                    document.getElementById(
                        "editProfileModal"
                    )
                );



                showToast(
                    "Профиль обновлён"
                );



            } catch(error) {


                console.error(error);


            }


        }
    );


}
// ==========================================================
// ПОДПИСКИ
// ==========================================================

async function checkFollowStatus() {


    const button =
        document.getElementById(
            "followButton"
        );


    if (!button ||
        !state.currentProfile) {

        return;

    }



    try {


        const { data } =
            await supabase
                .from("follows")
                .select("id")
                .eq(
                    "follower_id",
                    state.currentUser.id
                )
                .eq(
                    "following_id",
                    state.currentProfile.id
                )
                .maybeSingle();



        if (data) {


            button.textContent =
                "Отписаться";


            button.dataset.following =
                "true";


        } else {


            button.textContent =
                "Подписаться";


            button.dataset.following =
                "false";


        }



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// Подписаться / Отписаться
// ==========================================================

const followButton =
    document.getElementById(
        "followButton"
    );


if (followButton) {


    followButton.addEventListener(
        "click",
        async () => {


            try {


                const following =
                    followButton.dataset.following ===
                    "true";



                if (following) {


                    await supabase
                        .from("follows")
                        .delete()
                        .eq(
                            "follower_id",
                            state.currentUser.id
                        )
                        .eq(
                            "following_id",
                            state.currentProfile.id
                        );



                    showToast(
                        "Вы отписались"
                    );


                } else {


                    await supabase
                        .from("follows")
                        .insert({

                            follower_id:
                                state.currentUser.id,


                            following_id:
                                state.currentProfile.id

                        });



                    showToast(
                        "Вы подписались"
                    );


                }



                await checkFollowStatus();



            } catch(error) {


                console.error(error);


                showToast(
                    "Ошибка подписки"
                );


            }


        }
    );


}


// ==========================================================
// Открытие профиля
// ==========================================================

const profileButton =
    document.getElementById(
        "profileButton"
    );


if (profileButton) {


    profileButton.addEventListener(
        "click",
        () => {

            openProfile();

        }
    );


}


const closeProfile =
    document.getElementById(
        "closeProfileModal"
    );


if (closeProfile) {


    closeProfile.addEventListener(
        "click",
        () => {


            hide(
                document.getElementById(
                    "profileModal"
                )
            );


        }
    );


}


// ==========================================================
// ТРЕНДЫ
// ==========================================================

async function loadTrends() {


    try {


        const { data, error } =
            await supabase
                .from("trends")
                .select("*")
                .order(
                    "count",
                    {
                        ascending:false
                    }
                )
                .limit(20);



        if (error) {

            throw error;

        }



        state.trends =
            data || [];



        renderTrends();



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// Отображение трендов
// ==========================================================

function renderTrends() {


    const container =
        elements.trends;



    if (!container) {

        return;

    }



    container.innerHTML =
        "";



    if (
        state.trends.length === 0
    ) {


        container.innerHTML =
            `
            <div>
                Трендов пока нет
            </div>
            `;


        return;

    }



    state.trends.forEach(
        trend => {


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "trend-item";


            item.innerHTML =
                `

                <span
                    class="hashtag"
                    data-tag="${trend.hashtag}"
                >
                    ${trend.hashtag}
                </span>

                <small>
                    ${trend.count}
                </small>

                `;



            item
                .querySelector(".hashtag")
                .addEventListener(
                    "click",
                    () => {

                        searchHashtag(
                            trend.hashtag
                        );

                    }
                );



            container.appendChild(
                item
            );


        }
    );


}


// ==========================================================
// Поиск по хештегу
// ==========================================================

async function searchHashtag(tag) {


    try {


        const { data, error } =
            await supabase
                .from("chirps")
                .select(`
                    *,
                    users(
                        nickname,
                        emoji,
                        is_verified,
                        streak
                    )
                `)
                .ilike(
                    "content",
                    `%${tag}%`
                )
                .order(
                    "created_at",
                    {
                        ascending:false
                    }
                );



        if (error) {

            throw error;

        }



        state.chirps =
            data || [];



        renderFeed();



    } catch(error) {


        console.error(error);


    }

}
// ==========================================================
// ЖАЛОБЫ
// ==========================================================

async function openReportModal(chirpId) {

    state.selectedChirpId =
        chirpId;


    const modal =
        document.getElementById(
            "reportModal"
        );


    if (modal) {

        show(modal);

    }

}


// ==========================================================
// Отправка жалобы
// ==========================================================

async function sendReport() {


    const reason =
        document.getElementById(
            "reportReason"
        )
        ?.value
        .trim();



    if (!reason) {


        showToast(
            "Укажите причину"
        );


        return;

    }



    try {


        const { error } =
            await supabase
                .from("reports")
                .insert({

                    reporter_id:
                        state.currentUser.id,


                    chirp_id:
                        state.selectedChirpId,


                    reason,


                    status:
                        "pending"

                });



        if (error) {

            throw error;

        }



        hide(
            document.getElementById(
                "reportModal"
            )
        );



        showToast(
            "Жалоба отправлена"
        );



    } catch(error) {


        console.error(error);


        showToast(
            "Ошибка жалобы"
        );


    }

}



const reportSubmit =
    document.getElementById(
        "submitReportButton"
    );


if (reportSubmit) {


    reportSubmit.addEventListener(
        "click",
        sendReport
    );


}


// ==========================================================
// Кнопка закрытия жалобы
// ==========================================================

const closeReport =
    document.getElementById(
        "closeReportModal"
    );


if (closeReport) {


    closeReport.addEventListener(
        "click",
        () => {


            hide(
                document.getElementById(
                    "reportModal"
                )
            );


        }
    );


}


// ==========================================================
// АДМИН-ПАНЕЛЬ
// ==========================================================

function openAdminPanel() {


    if (
        !state.currentUser?.is_admin
    ) {


        showToast(
            "Нет доступа"
        );


        return;

    }



    const modal =
        document.getElementById(
            "adminModal"
        );


    if (modal) {

        show(modal);

    }


}



const adminButton =
    document.getElementById(
        "adminButton"
    );


if (adminButton) {


    adminButton.addEventListener(
        "click",
        openAdminPanel
    );


}


// ==========================================================
// Проверка админ-пароля
// ==========================================================

async function checkAdminPassword() {


    const input =
        document.getElementById(
            "adminPasswordInput"
        );



    if (
        !input ||
        input.value !== ADMIN_PASSWORD
    ) {


        showToast(
            "Неверный пароль"
        );


        return false;

    }



    return true;


}


// ==========================================================
// Поиск пользователя админом
// ==========================================================

async function adminSearchUser() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    const nickname =
        document.getElementById(
            "adminUserSearch"
        )
        ?.value
        .trim();



    if (!nickname) {

        return;

    }



    try {


        const user =
            await api.getUserByNickname(
                nickname
            );



        if (!user) {


            showToast(
                "Пользователь не найден"
            );


            return;

        }



        state.currentProfile =
            user;



        renderAdminUser(
            user
        );



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// Отображение пользователя в админке
// ==========================================================

function renderAdminUser(user) {


    const box =
        document.getElementById(
            "adminUserInfo"
        );



    if (!box) {

        return;

    }



    box.innerHTML =
        `

        <div class="sidebar-block">

            <h3>
                ${user.emoji || "😀"}
                ${user.nickname}
            </h3>


            <p>
                ID: ${user.id}
            </p>


            <p>
                Верификация:
                ${
                    user.is_verified
                    ? "✓"
                    : "нет"
                }
            </p>


            <p>
                Бан:
                ${
                    user.is_banned
                    ? "Да"
                    : "Нет"
                }
            </p>


        </div>

        `;


}
// ==========================================================
// АДМИН: ВЕРИФИКАЦИЯ
// ==========================================================

async function toggleVerification() {

    if (
        !(await checkAdminPassword())
    ) {

        return;

    }


    const user =
        state.currentProfile;


    if (!user) {

        showToast(
            "Пользователь не выбран"
        );

        return;

    }


    try {

        await api.updateUser(
            user.id,
            {

                is_verified:
                    !user.is_verified

            }
        );


        showToast(
            user.is_verified
                ? "Галочка снята"
                : "Пользователь подтверждён"
        );


        state.currentProfile =
            await api.getUserById(
                user.id
            );


        renderAdminUser(
            state.currentProfile
        );


    } catch(error) {

        console.error(error);

    }

}


// ==========================================================
// АДМИН: БАН
// ==========================================================

async function adminBanUser(permanent = false) {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }


    const user =
        state.currentProfile;


    if (!user) {

        return;

    }


    const reason =
        document.getElementById(
            "adminBanReason"
        )
        ?.value
        ||
        "Нарушение правил";


    let expires = null;


    if (!permanent) {


        const days =
            Number(
                document.getElementById(
                    "adminBanDays"
                )
                ?.value
            )
            || 1;


        expires =
            new Date(
                Date.now()
                +
                days *
                24 *
                60 *
                60 *
                1000
            )
            .toISOString();

    }



    try {


        await api.updateUser(
            user.id,
            {

                is_banned:true,

                ban_reason:reason,

                ban_expires_at:expires

            }
        );



        showToast(
            "Пользователь заблокирован"
        );



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// АДМИН: РАЗБАН
// ==========================================================

async function adminUnbanUser() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }


    const user =
        state.currentProfile;


    if (!user) {

        return;

    }


    try {


        await api.updateUser(
            user.id,
            {

                is_banned:false,

                ban_reason:null,

                ban_expires_at:null

            }
        );


        showToast(
            "Пользователь разблокирован"
        );


    } catch(error) {

        console.error(error);

    }

}


// ==========================================================
// АДМИН: ПРЕДУПРЕЖДЕНИЕ
// ==========================================================

async function adminWarningUser() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }


    const user =
        state.currentProfile;


    if (!user) {

        return;

    }


    const message =
        document.getElementById(
            "adminWarningText"
        )
        ?.value
        ||
        "Предупреждение";


    const expires =
        new Date(
            Date.now()
            +
            WARNING_TIME
        )
        .toISOString();



    try {


        await api.updateUser(
            user.id,
            {

                has_warning:true,

                warning_message:
                    message,

                warning_expires_at:
                    expires

            }
        );



        showToast(
            "Предупреждение выдано"
        );



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// АДМИН: Удаление поста
// ==========================================================

async function adminDeleteChirp() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    const input =
        document.getElementById(
            "adminDeletePostId"
        );



    const id =
        input?.value;



    if (!id) {


        showToast(
            "Введите ID поста"
        );


        return;

    }



    try {


        await supabase
            .from("chirps")
            .delete()
            .eq(
                "id",
                id
            );


        showToast(
            "Пост удалён"
        );



        await loadFeed();



    } catch(error) {


        console.error(error);


    }

}


// ==========================================================
// АДМИН: Жалобы
// ==========================================================

async function loadReports() {


    try {


        const { data,error } =
            await supabase
                .from("reports")
                .select(`
                    *,
                    users(
                        nickname
                    )
                `)
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending:false
                    }
                );



        if(error) {

            throw error;

        }



        state.reports =
            data || [];



        renderReports();



    } catch(error) {


        console.error(error);


    }

}



function renderReports() {


    const container =
        document.getElementById(
            "reportsContainer"
        );


    if(!container) {

        return;

    }



    container.innerHTML =
        "";



    state.reports.forEach(
        report => {


            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "comment";


            div.innerHTML =
                `

                <b>
                    Жалоба #${report.id}
                </b>

                <p>
                    ${escapeHtml(
                        report.reason
                    )}
                </p>

                <button
                    class="dismiss-report"
                    data-id="${report.id}"
                >
                    Отклонить
                </button>

                `;


            container.appendChild(
                div
            );


        }
    );


}
// ==========================================================
// Отклонение жалобы
// ==========================================================

document.addEventListener(
    "click",
    async event => {


        if (
            event.target.classList
            .contains(
                "dismiss-report"
            )
        ) {


            const id =
                event.target.dataset.id;


            try {


                await supabase
                    .from("reports")
                    .update({

                        status:
                            "dismissed"

                    })
                    .eq(
                        "id",
                        id
                    );


                showToast(
                    "Жалоба отклонена"
                );


                await loadReports();


            } catch(error) {


                console.error(error);


            }


        }


    }
);


// ==========================================================
// REALTIME ПОСТОВ
// ==========================================================

function initializeRealtime() {


    if (
        state.realtime.chirps
    ) {


        supabase
            .removeChannel(
                state.realtime.chirps
            );


    }



    state.realtime.chirps =
        supabase
            .channel(
                "chirps-live"
            )
            .on(
                "postgres_changes",
                {

                    event:"INSERT",

                    schema:"public",

                    table:"chirps"

                },

                async () => {


                    await loadFeed();


                }
            )
            .subscribe();


}


// ==========================================================
// Переключение вкладок
// ==========================================================

document.querySelectorAll(
    ".feed-tab"
)
.forEach(
    tab => {


        tab.addEventListener(
            "click",
            async () => {


                document
                    .querySelectorAll(
                        ".feed-tab"
                    )
                    .forEach(
                        item =>
                            item.classList
                            .remove(
                                "active"
                            )
                    );


                tab.classList.add(
                    "active"
                );


                state.currentFeed =
                    tab.dataset.feed;



                if (
                    state.currentFeed ===
                    "trends"
                ) {


                    await loadTrends();


                    return;

                }



                await loadFeed();


            }
        );


    }
);


// ==========================================================
// Закрытие всех модальных окон
// ==========================================================

document
    .querySelectorAll(
        ".modal-close"
    )
    .forEach(
        button => {


            button.addEventListener(
                "click",
                () => {


                    const modal =
                        button.closest(
                            ".modal"
                        );


                    hide(
                        modal
                    );


                }
            );


        }
);


// ==========================================================
// Админ кнопки
// ==========================================================

const adminSearch =
    document.getElementById(
        "adminSearchButton"
    );


if(adminSearch) {


    adminSearch.addEventListener(
        "click",
        adminSearchUser
    );

}


const verifyButton =
    document.getElementById(
        "adminVerifyButton"
    );


if(verifyButton) {


    verifyButton.addEventListener(
        "click",
        toggleVerification
    );

}


const banButton =
    document.getElementById(
        "adminBanButton"
    );


if(banButton) {


    banButton.addEventListener(
        "click",
        () =>
            adminBanUser(false)
    );

}


const permanentBanButton =
    document.getElementById(
        "adminPermanentBanButton"
    );


if(permanentBanButton) {


    permanentBanButton.addEventListener(
        "click",
        () =>
            adminBanUser(true)
    );

}


const unbanButton =
    document.getElementById(
        "adminUnbanButton"
    );


if(unbanButton) {


    unbanButton.addEventListener(
        "click",
        adminUnbanUser
    );

}


const warningButton =
    document.getElementById(
        "adminWarningButton"
    );


if(warningButton) {


    warningButton.addEventListener(
        "click",
        adminWarningUser
    );

}


const deletePostButton =
    document.getElementById(
        "adminDeleteButton"
    );


if(deletePostButton) {


    deletePostButton.addEventListener(
        "click",
        adminDeleteChirp
    );

}


// ==========================================================
// Экспорт для отладки
// ==========================================================

window.NobuChirp = {

    state,

    loadFeed,

    openProfile,

    loadReports

};