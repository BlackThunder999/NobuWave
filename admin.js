// ==========================================================
// NobuChirp admin.js
// Админ-панель
// ==========================================================


// Пароль администратора
const ADMIN_PASSWORD =
    "NobuWaveAdmin2024";


// Выбранный пользователь в админке
let adminSelectedUser = null;


// ==========================================================
// Проверка админского пароля
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
            "Неверный пароль администратора"
        );


        return false;

    }


    return true;

}




// ==========================================================
// Открытие админ-панели
// ==========================================================

function openAdminPanel() {


    if (
        !state.currentUser ||
        !state.currentUser.is_admin
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





// ==========================================================
// Поиск пользователя
// ==========================================================

async function adminSearchUser() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    const nickname =
        document
        .getElementById(
            "adminUserSearch"
        )
        ?.value
        .trim();



    if (!nickname) {


        showToast(
            "Введите никнейм"
        );


        return;

    }



    try {


        const { data, error } =
            await supabase
            .from("users")
            .select("*")
            .eq(
                "nickname",
                nickname
            )
            .single();



        if (error) {

            throw error;

        }



        adminSelectedUser =
            data;



        renderAdminUser(
            data
        );



    } catch(error) {


        console.error(
            error
        );


        showToast(
            "Пользователь не найден"
        );


    }


}




// ==========================================================
// Отображение пользователя
// ==========================================================

function renderAdminUser(
    user
) {


    const box =
        document.getElementById(
            "adminUserInfo"
        );



    if (!box) {

        return;

    }



    box.innerHTML = `

        <div class="admin-user-card">


            <h3>
                ${user.emoji || "😀"}
                ${user.nickname}
            </h3>


            <p>
                ID:
                ${user.id}
            </p>


            <p>
                Галочка:
                ${
                    user.is_verified
                    ? "✅"
                    : "❌"
                }
            </p>


            <p>
                Бан:
                ${
                    user.is_banned
                    ? "🚫"
                    : "Нет"
                }
            </p>


        </div>

    `;


}
// ==========================================================
// Верификация пользователя
// ==========================================================

async function toggleVerification() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    if (!adminSelectedUser) {


        showToast(
            "Сначала найдите пользователя"
        );


        return;

    }



    try {


        const newStatus =
            !adminSelectedUser.is_verified;



        const { error } =
            await supabase
            .from("users")
            .update({

                is_verified:
                    newStatus

            })
            .eq(
                "id",
                adminSelectedUser.id
            );



        if (error) {

            throw error;

        }



        adminSelectedUser.is_verified =
            newStatus;



        renderAdminUser(
            adminSelectedUser
        );



        showToast(

            newStatus
            ?
            "Галочка выдана ✅"
            :
            "Галочка снята"

        );



    } catch(error) {


        console.error(
            error
        );


        showToast(
            "Ошибка изменения статуса"
        );


    }


}





// ==========================================================
// Бан пользователя
// ==========================================================

async function adminBanUser(
    permanent = false
) {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    if (!adminSelectedUser) {


        showToast(
            "Пользователь не выбран"
        );


        return;

    }



    const reason =
        document
        .getElementById(
            "adminBanReason"
        )
        ?.value
        ||
        "Нарушение правил";



    let expires =
        null;



    if (!permanent) {


        const days =
            Number(
                document
                .getElementById(
                    "adminBanDays"
                )
                ?.value
            )
            ||
            1;



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


        const { error } =
            await supabase
            .from("users")
            .update({

                is_banned:
                    true,


                ban_reason:
                    reason,


                ban_expires_at:
                    expires

            })
            .eq(
                "id",
                adminSelectedUser.id
            );



        if (error) {

            throw error;

        }



        showToast(
            permanent
            ?
            "Выдан вечный бан 🚫"
            :
            "Пользователь заблокирован"
        );



    } catch(error) {


        console.error(
            error
        );


        showToast(
            "Ошибка бана"
        );


    }


}





// ==========================================================
// Разбан пользователя
// ==========================================================

async function adminUnbanUser() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    if (!adminSelectedUser) {


        return;

    }



    try {


        const { error } =
            await supabase
            .from("users")
            .update({

                is_banned:
                    false,


                ban_reason:
                    null,


                ban_expires_at:
                    null

            })
            .eq(
                "id",
                adminSelectedUser.id
            );



        if (error) {

            throw error;

        }



        showToast(
            "Пользователь разблокирован"
        );



    } catch(error) {


        console.error(
            error
        );


    }


}
// ==========================================================
// Выдача предупреждения
// ==========================================================

async function adminWarningUser() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    if (!adminSelectedUser) {


        showToast(
            "Пользователь не выбран"
        );


        return;

    }



    const message =
        document
        .getElementById(
            "adminWarningText"
        )
        ?.value
        ||
        "Нарушение правил NobuChirp";



    try {


        const { error } =
            await supabase
            .from("users")
            .update({

                has_warning:
                    true,


                warning_message:
                    message,


                warning_expires_at:
                    new Date(

                        Date.now()
                        +
                        3 *
                        60 *
                        1000

                    )
                    .toISOString()

            })
            .eq(
                "id",
                adminSelectedUser.id
            );



        if (error) {

            throw error;

        }



        showToast(
            "Предупреждение выдано ⚠️"
        );



    } catch(error) {


        console.error(
            error
        );


        showToast(
            "Ошибка предупреждения"
        );


    }


}





// ==========================================================
// Удаление поста по ID
// ==========================================================

async function adminDeleteChirp() {


    if (
        !(await checkAdminPassword())
    ) {

        return;

    }



    const chirpId =
        document
        .getElementById(
            "adminDeletePostId"
        )
        ?.value
        .trim();



    if (!chirpId) {


        showToast(
            "Введите ID поста"
        );


        return;

    }



    try {


        const { error } =
            await supabase
            .from("chirps")
            .delete()
            .eq(
                "id",
                chirpId
            );



        if (error) {

            throw error;

        }



        showToast(
            "Пост удалён 🗑️"
        );



    } catch(error) {


        console.error(
            error
        );


        showToast(
            "Ошибка удаления"
        );


    }


}





// ==========================================================
// Загрузка жалоб
// ==========================================================

async function loadReports() {


    try {


        const { data, error } =
            await supabase
            .from("reports")
            .select("*")
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



        if (error) {

            throw error;

        }



        const container =
            document
            .getElementById(
                "reportsContainer"
            );



        if (!container) {

            return;

        }



        container.innerHTML = "";



        data.forEach(
            report => {


                container.innerHTML += `

                <div class="report-card">


                    <h4>
                    Жалоба #${report.id}
                    </h4>


                    <p>
                    Пост:
                    ${report.chirp_id}
                    </p>


                    <p>
                    Причина:
                    ${report.reason}
                    </p>



                    <button
                    class="dismiss-report"
                    data-id="${report.id}"
                    >

                    Отклонить

                    </button>


                </div>

                `;


            }
        );



    } catch(error) {


        console.error(
            error
        );


    }


}





// ==========================================================
// Отклонение жалобы
// ==========================================================

async function dismissReport(
    id
) {


    try {


        const { error } =
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



        if (error) {

            throw error;

        }



        showToast(
            "Жалоба отклонена"
        );



        loadReports();



    } catch(error) {


        console.error(
            error
        );


    }


}
// ==========================================================
// Обработчики кнопок админ-панели
// ==========================================================


document.addEventListener(
    "DOMContentLoaded",
    () => {



    const adminButton =
        document.getElementById(
            "adminButton"
        );



    if (adminButton) {


        adminButton.addEventListener(
            "click",
            () => {

                openAdminPanel();

            }
        );


    }





    const searchButton =
        document.getElementById(
            "adminSearchButton"
        );



    if (searchButton) {


        searchButton.addEventListener(
            "click",
            adminSearchUser
        );


    }





    const verifyButton =
        document.getElementById(
            "adminVerifyButton"
        );



    if (verifyButton) {


        verifyButton.addEventListener(
            "click",
            toggleVerification
        );


    }





    const banButton =
        document.getElementById(
            "adminBanButton"
        );



    if (banButton) {


        banButton.addEventListener(
            "click",
            () => {

                adminBanUser(false);

            }
        );


    }





    const permanentBanButton =
        document.getElementById(
            "adminPermanentBanButton"
        );



    if (permanentBanButton) {


        permanentBanButton.addEventListener(
            "click",
            () => {

                adminBanUser(true);

            }
        );


    }





    const unbanButton =
        document.getElementById(
            "adminUnbanButton"
        );



    if (unbanButton) {


        unbanButton.addEventListener(
            "click",
            adminUnbanUser
        );


    }





    const warningButton =
        document.getElementById(
            "adminWarningButton"
        );



    if (warningButton) {


        warningButton.addEventListener(
            "click",
            adminWarningUser
        );


    }





    const deleteButton =
        document.getElementById(
            "adminDeleteButton"
        );



    if (deleteButton) {


        deleteButton.addEventListener(
            "click",
            adminDeleteChirp
        );


    }





    const reportsContainer =
        document.getElementById(
            "reportsContainer"
        );



    if (reportsContainer) {


        reportsContainer.addEventListener(
            "click",
            (event)=>{


                const button =
                    event.target
                    .closest(
                        ".dismiss-report"
                    );



                if (!button) {

                    return;

                }



                const id =
                    button.dataset.id;



                dismissReport(id);


            }
        );


    }




});





// ==========================================================
// Экспорт функций
// Для использования из script.js
// ==========================================================


window.adminFunctions = {


    openAdminPanel,

    adminSearchUser,

    toggleVerification,

    adminBanUser,

    adminUnbanUser,

    adminWarningUser,

    adminDeleteChirp,

    loadReports,

    dismissReport


};