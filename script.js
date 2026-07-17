// ==========================================================
// NobuChirp script.js
// Основной клиент
// Часть 1/10
// ==========================================================


// ==========================================================
// Supabase подключение
// ==========================================================

const SUPABASE_URL =
"https://iljsednetiogjtowlexo.supabase.co";


const SUPABASE_KEY =
"sb_publishable_gXxOqmU-XXnrVz8FHro2jA_ybG9EQ7O";


const supabaseClient =
window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);



// ==========================================================
// Глобальное состояние приложения
// ==========================================================

const state = {

    currentUser: null,

    session: null,

    currentFeed: "all",

    selectedChirp: null,

    selectedProfile: null,

    selectedImage: null,

    isRegister: false,

    isSubmitting: false

};




// ==========================================================
// Получение элемента
// ==========================================================

function $(id) {

    return document.getElementById(id);

}




// ==========================================================
// Показать элемент
// ==========================================================

function show(element) {

    if (!element) return;

    element.classList.remove(
        "hidden"
    );

}




// ==========================================================
// Скрыть элемент
// ==========================================================

function hide(element) {

    if (!element) return;

    element.classList.add(
        "hidden"
    );

}




// ==========================================================
// Toast уведомления
// ==========================================================

function showToast(message) {


    const container =
        $("toastContainer");


    if (!container) return;



    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "toast";


    toast.textContent =
        message;



    container.appendChild(
        toast
    );



    setTimeout(()=>{

        toast.remove();

    },3000);


}




// ==========================================================
// Защита HTML
// ==========================================================

function escapeHtml(text) {


    if (!text) return "";


    return String(text)

    .replace(
        /&/g,
        "&amp;"
    )

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    )

    .replace(
        /"/g,
        "&quot;"
    )

    .replace(
        /'/g,
        "&#039;"
    );


}





// ==========================================================
// Форматирование даты
// ==========================================================

function formatDate(date) {


    return new Date(date)
    .toLocaleString(
        "ru-RU"
    );


}
// ==========================================================
// Авторизация
// ==========================================================


// Переключение режима вход / регистрация

function setAuthMode(isRegister) {


    state.isRegister =
        isRegister;



    const loginTab =
        $("loginTab");


    const registerTab =
        $("registerTab");


    const submitButton =
        $("authSubmitBtn");



    if(loginTab) {

        loginTab.classList.toggle(
            "active",
            !isRegister
        );

    }



    if(registerTab) {

        registerTab.classList.toggle(
            "active",
            isRegister
        );

    }



    if(submitButton) {

        submitButton.textContent =
            isRegister
            ?
            "Создать аккаунт"
            :
            "Войти";

    }


}







// ==========================================================
// Регистрация
// ==========================================================


async function registerUser() {


    const nickname =
        $("nicknameInput")
        ?.value
        .trim();



    const password =
        $("passwordInput")
        ?.value
        .trim();




    if(
        !nickname ||
        !password
    ) {


        showToast(
            "Заполните все поля"
        );


        return;

    }






    try {



        // Проверяем уникальность ника

        const {data: existingUser} =
            await supabaseClient
            .from("users")
            .select("id")
            .eq(
                "nickname",
                nickname
            )
            .maybeSingle();





        if(existingUser) {


            showToast(
                "Этот ник уже занят"
            );


            return;

        }





        // Создаём пользователя

        const {data,error} =
            await supabaseClient
            .from("users")
            .insert({

                nickname,

                password,

                emoji:
                    "😀",

                bio:
                    "",

                is_admin:
                    false,

                is_verified:
                    false

            })
            .select()
            .single();





        if(error) {

            throw error;

        }





        state.currentUser =
            data;



        saveSession();



        showToast(
            "Аккаунт создан 🎉"
        );



        openApp();




    }
    catch(error) {


        console.error(
            "Register error:",
            error
        );


        showToast(
            "Ошибка регистрации"
        );


    }


}







// ==========================================================
// Вход
// ==========================================================


async function loginUser() {


    const nickname =
        $("nicknameInput")
        ?.value
        .trim();



    const password =
        $("passwordInput")
        ?.value
        .trim();






    if(
        !nickname ||
        !password
    ) {


        showToast(
            "Введите ник и пароль"
        );


        return;

    }





    try {


        const {data,error} =
            await supabaseClient
            .from("users")
            .select("*")
            .eq(
                "nickname",
                nickname
            )
            .eq(
                "password",
                password
            )
            .maybeSingle();





        if(error) {


            throw error;

        }





        if(!data) {


            showToast(
                "Неверный ник или пароль"
            );


            return;

        }





        state.currentUser =
            data;



        saveSession();



        showToast(
            "Вход выполнен ✅"
        );



        openApp();




    }
    catch(error) {


        console.error(
            "Login error:",
            error
        );


        showToast(
            "Ошибка входа"
        );


    }


}







// ==========================================================
// Отправка формы авторизации
// ==========================================================


async function handleAuthSubmit(event) {


    event.preventDefault();



    if(state.isRegister) {


        await registerUser();


    }
    else {


        await loginUser();


    }


}





// ==========================================================
// События авторизации
// ==========================================================


function setupAuthEvents() {


    $("loginTab")
    ?.addEventListener(
        "click",
        ()=>{

            setAuthMode(false);

        }
    );




    $("registerTab")
    ?.addEventListener(
        "click",
        ()=>{

            setAuthMode(true);

        }
    );




    $("authForm")
    ?.addEventListener(
        "submit",
        handleAuthSubmit
    );


}
// ==========================================================
// Сессия пользователя
// ==========================================================


// Сохранение сессии на 7 дней

function saveSession() {


    if(!state.currentUser) {

        return;

    }



    const session = {


        user:
            state.currentUser,


        isAdmin:
            state.currentUser.is_admin,


        expiresAt:
            Date.now()
            +
            7 *
            24 *
            60 *
            60 *
            1000


    };



    localStorage.setItem(

        "nobu_session",

        JSON.stringify(session)

    );



    state.session =
        session;


}








// Загрузка сессии

async function loadSession() {


    try {



        const saved =
            localStorage.getItem(
                "nobu_session"
            );



        if(!saved) {


            showAuth();


            return false;

        }





        const session =
            JSON.parse(saved);





        // Проверяем срок

        if(
            Date.now()
            >
            session.expiresAt
        ) {


            logout();


            return false;

        }







        // Проверяем пользователя в базе

        const {data,error} =
            await supabaseClient
            .from("users")
            .select("*")
            .eq(
                "id",
                session.user.id
            )
            .single();





        if(error || !data) {


            logout();


            return false;

        }






        state.currentUser =
            data;



        state.session =
            session;




        return true;




    }
    catch(error) {


        console.error(
            "Session error:",
            error
        );


        logout();


        return false;


    }


}







// Выход

function logout() {


    localStorage.removeItem(
        "nobu_session"
    );



    state.currentUser =
        null;


    state.session =
        null;




    hide(
        $("app")
    );



    show(
        $("authScreen")
    );



    showToast(
        "Вы вышли"
    );


}







// Показать экран входа

function showAuth() {


    hide(
        $("loadingScreen")
    );


    show(
        $("authScreen")
    );


}







// Открытие приложения

function openApp() {


    hide(
        $("loadingScreen")
    );


    hide(
        $("authScreen")
    );



    show(
        $("app")
    );



    updateMiniProfile();


    loadFeed();


}








// Мини профиль

function updateMiniProfile() {


    const user =
        state.currentUser;



    if(!user) {

        return;

    }




    const emoji =
        $("miniEmoji");


    const nickname =
        $("miniNickname");


    const bio =
        $("miniBio");




    if(emoji) {


        emoji.textContent =
            user.emoji ||
            "😀";


    }





    if(nickname) {


        nickname.textContent =
            user.nickname;


    }






    if(bio) {


        bio.textContent =
            user.bio ||
            "Нет описания";


    }


}








// ==========================================================
// Проверка бана и предупреждения
// ==========================================================


async function checkUserStatus() {


    if(!state.currentUser) {

        return;

    }




    const {data,error} =
        await supabaseClient
        .from("users")
        .select("*")
        .eq(
            "id",
            state.currentUser.id
        )
        .single();





    if(error || !data) {

        return;

    }



    state.currentUser =
        data;




    if(data.is_banned) {


        showBanScreen(
            data
        );


        return;

    }



    if(data.has_warning) {


        showWarningScreen(
            data
        );


    }


}
// ==========================================================
// Экран бана
// ==========================================================


function showBanScreen(user) {


    hide(
        $("app")
    );


    hide(
        $("authScreen")
    );



    show(
        $("banScreen")
    );



    const reason =
        $("banReason");


    const expires =
        $("banExpires");



    if(reason) {


        reason.textContent =
            "Причина: "
            +
            (
                user.ban_reason
                ||
                "Не указана"
            );

    }





    if(expires) {


        if(user.ban_expires_at) {


            expires.textContent =
                "До: "
                +
                formatDate(
                    user.ban_expires_at
                );


        }
        else {


            expires.textContent =
                "Навсегда";

        }

    }


}








// ==========================================================
// Экран предупреждения
// ==========================================================


function showWarningScreen(user) {


    hide(
        $("app")
    );



    show(
        $("warningScreen")
    );




    const message =
        $("warningMessage");



    if(message) {


        message.textContent =
            user.warning_message ||
            "Предупреждение";


    }




    startWarningTimer();


}







// Таймер предупреждения 3 минуты

function startWarningTimer() {


    const button =
        $("warningAcceptBtn");


    const timer =
        $("warningCountdown");



    let seconds =
        180;





    if(button) {


        button.disabled =
            true;


    }






    const interval =
        setInterval(
            ()=>{


                seconds--;





                if(timer) {


                    const min =
                        Math.floor(
                            seconds / 60
                        );


                    const sec =
                        seconds % 60;



                    timer.textContent =

                        String(min)
                        .padStart(2,"0")

                        +
                        ":"

                        +
                        String(sec)
                        .padStart(2,"0");


                }





                if(seconds <= 0) {


                    clearInterval(
                        interval
                    );



                    if(button) {


                        button.disabled =
                            false;


                    }


                }


            },
            1000
        );


}








// Принятие предупреждения

async function acceptWarning() {


    if(!state.currentUser) {

        return;

    }





    await supabaseClient
    .from("users")
    .update({

        has_warning:false,

        warning_message:null,

        warning_expires_at:null

    })
    .eq(
        "id",
        state.currentUser.id
    );





    hide(
        $("warningScreen")
    );



    show(
        $("app")
    );


}








// ==========================================================
// Создание поста
// ==========================================================


async function createChirp() {



    if(
        state.isSubmitting
    ) {


        return;

    }




    if(!state.currentUser) {


        return;

    }





    const content =
        $("chirpInput")
        ?.value
        .trim();






    if(!content && !state.selectedImage) {


        showToast(
            "Напишите текст или добавьте фото"
        );


        return;

    }






    state.isSubmitting =
        true;




    try {


        let imageUrl =
            null;



        if(state.selectedImage) {


            imageUrl =
                await uploadImage(
                    state.selectedImage
                );


        }





        const {error} =
            await supabaseClient
            .from("chirps")
            .insert({

                user_id:
                    state.currentUser.id,


                content,

                image_url:
                    imageUrl,


                is_verified:
                    state.currentUser.is_verified


            });






        if(error) {


            throw error;

        }





        $("chirpInput").value =
            "";



        clearImagePreview();



        showToast(
            "Пост опубликован"
        );



        loadFeed();




    }
    catch(error) {


        console.error(
            error
        );


        showToast(
            "Ошибка публикации"
        );


    }
    finally {


        state.isSubmitting =
            false;


    }


}







// Счётчик символов

function setupCharCounter(){


    const input =
        $("chirpInput");


    const counter =
        $("charCounter");



    if(!input || !counter) {

        return;

    }



    input.addEventListener(
        "input",
        ()=>{


            counter.textContent =
                280 -
                input.value.length;


        }
    );


}
// ==========================================================
// Загрузка изображения в Supabase Storage
// ==========================================================


async function uploadImage(file) {


    try {


        const fileName =

            Date.now()
            +
            "_"
            +
            file.name;



        const {error} =
            await supabaseClient
            .storage
            .from("images")
            .upload(
                fileName,
                file
            );



        if(error) {


            throw error;

        }





        const {data} =
            supabaseClient
            .storage
            .from("images")
            .getPublicUrl(
                fileName
            );




        return data.publicUrl;




    }
    catch(error) {


        console.error(
            "Upload error:",
            error
        );


        throw error;


    }


}








// ==========================================================
// Предпросмотр изображения
// ==========================================================


function setupImageUpload(){


    const input =
        $("imageInput");



    if(!input) {

        return;

    }




    input.addEventListener(
        "change",
        ()=>{


            const file =
                input.files[0];



            if(!file) {

                return;

            }





            state.selectedImage =
                file;



            showImagePreview(
                file
            );


        }
    );


}







function showImagePreview(file){



    const preview =
        $("imagePreview");


    const image =
        $("previewImage");



    if(!preview || !image) {

        return;

    }




    const reader =
        new FileReader();



    reader.onload = ()=>{


        image.src =
            reader.result;



        show(
            preview
        );


    };



    reader.readAsDataURL(
        file
    );


}







function clearImagePreview(){



    state.selectedImage =
        null;



    const preview =
        $("imagePreview");



    const image =
        $("previewImage");



    const input =
        $("imageInput");



    if(preview) {


        hide(
            preview
        );

    }




    if(image) {


        image.src =
            "";

    }




    if(input) {


        input.value =
            "";

    }


}







// ==========================================================
// Загрузка ленты
// ==========================================================


async function loadFeed(){


    try {



        const {data,error} =
            await supabaseClient
            .from("chirps")
            .select(`

                *,

                users(
                    nickname,
                    emoji,
                    is_verified
                )

            `)
            .order(
                "created_at",
                {
                    ascending:false
                }
            );





        if(error) {


            throw error;

        }





        renderFeed(
            data
        );





    }
    catch(error) {


        console.error(
            error
        );


        showToast(
            "Ошибка загрузки ленты"
        );


    }


}








// ==========================================================
// Рендер ленты
// ==========================================================


function renderFeed(chirps){


    const container =
        $("feedContainer");



    if(!container) {

        return;

    }




    container.innerHTML =
        "";





    chirps.forEach(
        chirp=>{


            container.innerHTML +=

                createChirpCard(
                    chirp
                );


        }
    );


}







// ==========================================================
// Карточка поста
// ==========================================================


function createChirpCard(chirp){



    const user =
        chirp.users || {};




    return `

<div class="chirp-card">


<div class="chirp-header">


<span class="emoji">

${user.emoji || "😀"}

</span>



<b>

${escapeHtml(
    user.nickname || "User"
)}

${

user.is_verified

?

" ✓"

:

""

}

</b>



</div>





<div class="chirp-content">

${escapeHtml(
    chirp.content
)}

</div>





${
chirp.image_url

?

`

<img

class="chirp-image"

src="${chirp.image_url}"

>

`

:

""

}






<div class="chirp-actions">


<button

data-action="like"

data-id="${chirp.id}"

>

❤️

</button>



<button

data-action="dislike"

data-id="${chirp.id}"

>

👎

</button>



<button

data-action="comment"

data-id="${chirp.id}"

>

💬

</button>



<button

data-action="rechirp"

data-id="${chirp.id}"

>

🔄

</button>



</div>






<small>

ID:
${chirp.id}

</small>




</div>

`;



}
// ==========================================================
// Взаимодействия с постами
// ==========================================================


// Обработка кликов по постам

function setupChirpActions(){


    const feed =
        $("feedContainer");



    if(!feed) {

        return;

    }



    feed.addEventListener(
        "click",
        async(event)=>{


            const button =
                event.target
                .closest(
                    "button[data-action]"
                );



            if(!button) {

                return;

            }





            const action =
                button.dataset.action;



            const chirpId =
                button.dataset.id;





            if(action === "like"){


                await toggleLike(
                    chirpId
                );


            }




            if(action === "dislike"){


                await toggleDislike(
                    chirpId
                );


            }




            if(action === "rechirp"){


                await createRechirp(
                    chirpId
                );


            }




            if(action === "comment"){


                openComments(
                    chirpId
                );


            }



        }
    );


}







// ==========================================================
// Лайки
// ==========================================================


async function toggleLike(chirpId){


    if(!state.currentUser) {

        return;

    }



    try {



        const {data: exists} =
            await supabaseClient
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





        if(exists){



            await supabaseClient
            .from("likes")
            .delete()
            .eq(
                "id",
                exists.id
            );



            showToast(
                "Лайк убран"
            );



        }
        else {



            // удаляем дизлайк

            await supabaseClient
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





            await supabaseClient
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



    }
    catch(error){


        console.error(
            error
        );


    }



}









// ==========================================================
// Дизлайки
// ==========================================================


async function toggleDislike(chirpId){



    if(!state.currentUser){

        return;

    }




    try {



        const {data: exists} =
            await supabaseClient
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





        if(exists){



            await supabaseClient
            .from("dislikes")
            .delete()
            .eq(
                "id",
                exists.id
            );


        }
        else {



            await supabaseClient
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





            await supabaseClient
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



    }
    catch(error){


        console.error(
            error
        );


    }


}








// ==========================================================
// Репост
// ==========================================================


async function createRechirp(chirpId){



    if(!state.currentUser){

        return;

    }




    try {



        await supabaseClient
        .from("rechirps")
        .insert({

            user_id:
                state.currentUser.id,


            chirp_id:
                chirpId

        });



        showToast(
            "🔄 Репост сделан"
        );



    }
    catch(error){



        console.error(
            error
        );



        showToast(
            "Ошибка репоста"
        );


    }


}
// ==========================================================
// Комментарии
// ==========================================================


let commentsChannel = null;



// Открытие комментариев

async function openComments(chirpId){


    state.selectedChirp =
        chirpId;



    const modal =
        $("commentsModal");



    if(modal){


        show(
            modal
        );


    }



    await loadComments(
        chirpId
    );



    setupCommentsRealtime(
        chirpId
    );


}








// Закрытие комментариев

function closeComments(){



    hide(
        $("commentsModal")
    );



    state.selectedChirp =
        null;



    if(commentsChannel){


        supabaseClient
        .removeChannel(
            commentsChannel
        );


        commentsChannel =
            null;

    }


}







// ==========================================================
// Загрузка комментариев
// ==========================================================


async function loadComments(chirpId){


    try {



        const {data,error} =
            await supabaseClient
            .from("comments")
            .select(`

                *,

                users(
                    nickname,
                    emoji
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





        if(error){


            throw error;


        }





        renderComments(
            data
        );



    }
    catch(error){


        console.error(
            error
        );


    }


}








// Рендер комментариев

function renderComments(comments){


    const box =
        $("commentsList");



    if(!box){

        return;

    }





    box.innerHTML =
        "";





    comments.forEach(
        comment=>{


            box.innerHTML += `

            <div class="comment-item">


                <b>

                ${

                comment.users?.emoji
                ||
                "😀"

                }


                ${

                escapeHtml(
                    comment.users?.nickname
                    ||
                    "User"
                )

                }


                </b>



                <p>

                ${

                escapeHtml(
                    comment.content
                )

                }

                </p>


            </div>

            `;


        }
    );


}









// ==========================================================
// Отправка комментария
// ==========================================================


async function sendComment(){


    if(
        !state.currentUser ||
        !state.selectedChirp
    ){

        return;

    }





    const input =
        $("commentInput");



    const text =
        input
        ?.value
        .trim();





    if(!text){

        return;

    }





    try {



        const {error} =
            await supabaseClient
            .from("comments")
            .insert({

                user_id:
                    state.currentUser.id,


                chirp_id:
                    state.selectedChirp,


                content:
                    text

            });






        if(error){

            throw error;

        }





        input.value =
            "";



        showToast(
            "Комментарий добавлен"
        );



    }
    catch(error){


        console.error(
            error
        );


        showToast(
            "Ошибка комментария"
        );


    }


}









// ==========================================================
// Realtime комментариев
// ==========================================================


function setupCommentsRealtime(chirpId){


    if(commentsChannel){


        supabaseClient
        .removeChannel(
            commentsChannel
        );


    }





    commentsChannel =
        supabaseClient
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
                "chirp_id=eq."+chirpId


            },
            ()=>{


                loadComments(
                    chirpId
                );


            }
        )
        .subscribe();



}







// ==========================================================
// События комментариев
// ==========================================================


function setupCommentEvents(){



    $("closeCommentsModal")
    ?.addEventListener(
        "click",
        closeComments
    );




    $("sendCommentButton")
    ?.addEventListener(
        "click",
        sendComment
    );



}
// ==========================================================
// Профиль пользователя
// ==========================================================



// Открытие профиля


async function openProfile(userId){


    try {



        const {data,error} =
            await supabaseClient
            .from("users")
            .select("*")
            .eq(
                "id",
                userId
            )
            .single();





        if(error){

            throw error;

        }





        state.selectedProfile =
            data;




        renderProfile(
            data
        );





        show(
            $("profileModal")
        );



    }
    catch(error){


        console.error(
            error
        );


    }


}








// Отображение профиля

function renderProfile(user){



    const emoji =
        $("profileEmoji");


    const nickname =
        $("profileNickname");


    const bio =
        $("profileBio");


    const verified =
        $("profileVerified");



    if(emoji){


        emoji.textContent =
            user.emoji ||
            "😀";


    }





    if(nickname){


        nickname.textContent =
            user.nickname;


    }





    if(bio){


        bio.textContent =
            user.bio ||
            "Нет описания";


    }





    if(verified){


        if(user.is_verified){


            show(
                verified
            );


        }
        else{


            hide(
                verified
            );


        }


    }



}









// Закрытие профиля

function closeProfile(){


    hide(
        $("profileModal")
    );


    state.selectedProfile =
        null;


}









// ==========================================================
// Редактирование профиля
// ==========================================================



function openEditProfile(){


    if(
        !state.currentUser
    ){

        return;

    }





    $("emojiInput").value =
        state.currentUser.emoji ||
        "😀";




    $("bioInput").value =
        state.currentUser.bio ||
        "";





    show(
        $("editProfileModal")
    );


}








async function saveProfile(){



    const emoji =
        $("emojiInput")
        ?.value
        .trim();



    const bio =
        $("bioInput")
        ?.value
        .trim();





    try {



        const {error} =
            await supabaseClient
            .from("users")
            .update({

                emoji,

                bio

            })
            .eq(
                "id",
                state.currentUser.id
            );





        if(error){

            throw error;

        }





        state.currentUser.emoji =
            emoji;



        state.currentUser.bio =
            bio;



        updateMiniProfile();




        hide(
            $("editProfileModal")
        );



        renderProfile(
            state.currentUser
        );



        showToast(
            "Профиль обновлён"
        );



    }
    catch(error){


        console.error(
            error
        );


    }


}









// ==========================================================
// Подписки
// ==========================================================



async function toggleFollow(){


    if(
        !state.currentUser ||
        !state.selectedProfile
    ){

        return;

    }






    const target =
        state.selectedProfile.id;





    if(
        target ===
        state.currentUser.id
    ){

        return;

    }





    try {



        const {data:exists} =
            await supabaseClient
            .from("follows")
            .select("id")
            .eq(
                "follower_id",
                state.currentUser.id
            )
            .eq(
                "following_id",
                target
            )
            .maybeSingle();







        if(exists){



            await supabaseClient
            .from("follows")
            .delete()
            .eq(
                "id",
                exists.id
            );



            showToast(
                "Вы отписались"
            );



        }
        else {



            await supabaseClient
            .from("follows")
            .insert({

                follower_id:
                    state.currentUser.id,


                following_id:
                    target


            });



            showToast(
                "Вы подписались"
            );



        }




    }
    catch(error){


        console.error(
            error
        );


    }


}








// События профиля

function setupProfileEvents(){



    $("profileButton")
    ?.addEventListener(
        "click",
        ()=>{


            openProfile(
                state.currentUser.id
            );


        }
    );




    $("closeProfileModal")
    ?.addEventListener(
        "click",
        closeProfile
    );





    $("editProfileButton")
    ?.addEventListener(
        "click",
        openEditProfile
    );





    $("saveProfileButton")
    ?.addEventListener(
        "click",
        saveProfile
    );





    $("followButton")
    ?.addEventListener(
        "click",
        toggleFollow
    );


}
// ==========================================================
// Хештеги и тренды
// ==========================================================



// Получение хештегов из текста

function extractHashtags(text){


    if(!text){

        return [];

    }



    const tags =
        text.match(
            /#[а-яА-Яa-zA-Z0-9_]+/g
        );



    if(!tags){

        return [];

    }



    return tags.map(
        tag =>
        tag.toLowerCase()
    );


}








// Обновление трендов

async function updateTrends(content){



    const hashtags =
        extractHashtags(
            content
        );



    if(
        hashtags.length === 0
    ){

        return;

    }





    try {



        for(
            const hashtag
            of hashtags
        ){



            const {data} =
                await supabaseClient
                .from("trends")
                .select("*")
                .eq(
                    "hashtag",
                    hashtag
                )
                .maybeSingle();






            if(data){



                await supabaseClient
                .from("trends")
                .update({

                    count:
                    data.count + 1,


                    updated_at:
                    new Date()
                    .toISOString()


                })
                .eq(
                    "id",
                    data.id
                );



            }
            else {



                await supabaseClient
                .from("trends")
                .insert({

                    hashtag,

                    count:1,


                    updated_at:
                    new Date()
                    .toISOString()


                });



            }



        }



    }
    catch(error){


        console.error(
            "Trends error:",
            error
        );


    }



}









// Загрузка трендов


async function loadTrends(){



    try {



        const {data,error} =
            await supabaseClient
            .from("trends")
            .select("*")
            .order(
                "count",
                {
                    ascending:false
                }
            )
            .limit(10);





        if(error){

            throw error;

        }




        renderTrends(
            data
        );



    }
    catch(error){


        console.error(
            error
        );


    }


}







// Отображение трендов


function renderTrends(trends){



    const box =
        $("trendsList");



    if(!box){

        return;

    }




    box.innerHTML =
        "";





    trends.forEach(
        trend=>{


            box.innerHTML += `

            <div class="trend-item">


            ${

            escapeHtml(
                trend.hashtag
            )

            }


            <span>

            ${trend.count}

            </span>


            </div>

            `;


        }
    );


}









// ==========================================================
// Жалобы
// ==========================================================



let reportChirpId =
    null;





function openReport(chirpId){



    reportChirpId =
        chirpId;



    show(
        $("reportModal")
    );


}







function closeReport(){


    hide(
        $("reportModal")
    );



    reportChirpId =
        null;


}







async function submitReport(){



    if(
        !state.currentUser ||
        !reportChirpId
    ){

        return;

    }





    const reason =
        $("reportReason")
        ?.value
        .trim();





    if(!reason){


        showToast(
            "Укажите причину"
        );


        return;

    }






    try {



        const {error} =
            await supabaseClient
            .from("reports")
            .insert({

                reporter_id:
                state.currentUser.id,


                chirp_id:
                reportChirpId,


                reason,


                status:
                "pending"


            });





        if(error){

            throw error;

        }





        hide(
            $("reportModal")
        );



        $("reportReason")
        .value =
        "";



        showToast(
            "Жалоба отправлена"
        );



    }
    catch(error){


        console.error(
            error
        );


        showToast(
            "Ошибка отправки"
        );


    }



}







// События жалоб


function setupReportEvents(){



    $("closeReportModal")
    ?.addEventListener(
        "click",
        closeReport
    );




    $("submitReportButton")
    ?.addEventListener(
        "click",
        submitReport
    );


}
// ==========================================================
// Realtime постов
// ==========================================================


let chirpsChannel = null;



function setupChirpsRealtime(){



    if(chirpsChannel){


        supabaseClient
        .removeChannel(
            chirpsChannel
        );


    }






    chirpsChannel =
        supabaseClient
        .channel(
            "chirps-realtime"
        )
        .on(
            "postgres_changes",
            {

                event:"INSERT",

                schema:"public",

                table:"chirps"


            },
            ()=>{


                loadFeed();


            }
        )
        .subscribe();



}









// ==========================================================
// Кнопка выхода
// ==========================================================


function setupLogout(){



    $("logoutButton")
    ?.addEventListener(
        "click",
        logout
    );



}









// ==========================================================
// Предупреждение
// ==========================================================


function setupWarningEvents(){



    $("warningAcceptBtn")
    ?.addEventListener(
        "click",
        acceptWarning
    );



}









// ==========================================================
// Удаление фото
// ==========================================================


function setupImageRemove(){



    $("removeImageButton")
    ?.addEventListener(
        "click",
        clearImagePreview
    );



}









// ==========================================================
// Кнопка публикации
// ==========================================================


function setupPublish(){



    $("publishButton")
    ?.addEventListener(
        "click",
        createChirp
    );



}









// ==========================================================
// Вкладки ленты
// ==========================================================


function setupFeedTabs(){



    document
    .querySelectorAll(
        ".feed-tab"
    )
    .forEach(
        button=>{


            button.addEventListener(
                "click",
                ()=>{


                    state.currentFeed =
                    button.dataset.feed;



                    document
                    .querySelectorAll(
                        ".feed-tab"
                    )
                    .forEach(
                        item=>{

                            item.classList.remove(
                                "active"
                            );

                        }
                    );



                    button.classList.add(
                        "active"
                    );



                    loadFeed();


                }
            );


        }
    );


}









// ==========================================================
// Запуск приложения
// ==========================================================


async function initApp(){



    try {



        setupAuthEvents();


        setupLogout();


        setupWarningEvents();


        setupImageUpload();


        setupImageRemove();


        setupPublish();


        setupCharCounter();


        setupChirpActions();


        setupCommentEvents();


        setupProfileEvents();


        setupReportEvents();


        setupFeedTabs();






        const logged =
            await loadSession();






        if(logged){



            await checkUserStatus();



            openApp();


        }
        else {



            showAuth();


        }






        setInterval(
            checkUserStatus,
            10000
        );





        setupChirpsRealtime();



        loadTrends();





    }
    catch(error){


        console.error(
            "Init error:",
            error
        );


        showToast(
            "Ошибка запуска"
        );


    }


}








// Запуск после загрузки страницы


document.addEventListener(

    "DOMContentLoaded",

    initApp

);