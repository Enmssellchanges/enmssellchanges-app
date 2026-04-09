/**
 * @file auth.js
 * @description Gestiona todo el ciclo de autenticación del usuario.
 *   - Listener de `onAuthStateChanged` que actualiza el estado global `user`
 *   - Login con Google (popup)
 *   - Login con teléfono vía SMS (reCAPTCHA invisible)
 *   - UI dinámica post-login/logout (nav, avatar, botón admin)
 *   - Carga y guardado del perfil del usuario en Firestore
 *   - Carga dinámica del script admin.js solo para el administrador
 */

// ── Listener de estado de autenticación ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (typeof auth !== 'undefined' && auth) {
        auth.onAuthStateChanged(firebaseUser => {
            if (firebaseUser) {
                // Check for admin email (case insensitive for safety). Safely check if email exists (for phone auth)
                const isAdmin = firebaseUser.email ? firebaseUser.email.toLowerCase() === APP_CONSTANTS.ADMIN_EMAIL : false;

                user = {
                    name: firebaseUser.displayName || firebaseUser.phoneNumber || 'Usuario',
                    email: firebaseUser.email,
                    photo: firebaseUser.photoURL,
                    uid: firebaseUser.uid,
                    isAdmin: isAdmin
                };
                updateAuthUI();
                loadUserProfile();

                // requestNotificationPermission(); // Removed to prevent browser auto-block

                // Auto-seed data only for the authorized admin
                if (isAdmin && db) {
                    db.collection('settings').doc('countries').get().then(doc => {
                        if (!doc.exists) {
                            db.collection('settings').doc('countries').set({ list: defaultCountries });
                        }
                    });
                }

                // Start polling active market monitors (for everyone now)
                if (typeof initBinanceMonitor === 'function') {
                    initBinanceMonitor();
                }

                // Trigger rate auto-update just in case monitors finished fetching before auth resolved
                if (typeof tryAutoUpdateRates === 'function') {
                    tryAutoUpdateRates();
                } else if (typeof autoUpdateRatesFromMonitors === 'function') {
                    setTimeout(() => autoUpdateRatesFromMonitors(), 1000); // Fallback
                }
            } else {
                user = null;
                resetAuthUI();
            }
        });
    }
});

// ── Modal de Login ──────────────────────────────────────────────────────────────────

function openLogin() {
    document.getElementById('login-modal').style.display = 'flex';
    toggleLoginMode();

    // Pre-fill last used phone number
    const savedCountry = localStorage.getItem('enmsell_phone_country');
    const savedPhone = localStorage.getItem('enmsell_phone_number');
    if (savedCountry) {
        const sel = document.getElementById('phone-country-select');
        if (sel) sel.value = savedCountry;
    }
    if (savedPhone) {
        const inp = document.getElementById('phone-login-input');
        if (inp) inp.value = savedPhone;
    }
}

function closeLogin() {
    document.getElementById('login-modal').style.display = 'none';
    
    // Reset login state when closing
    const phoneSection = document.getElementById('phone-login-section');
    const otpSection = document.getElementById('phone-otp-section');
    const createPwdSection = document.getElementById('create-password-section');
    
    if (phoneSection) phoneSection.style.display = 'block';
    if (otpSection) otpSection.style.display = 'none';
    if (createPwdSection) createPwdSection.style.display = 'none';
    
    const otpInput = document.getElementById('phone-otp-input');
    if (otpInput) otpInput.value = '';
    const loginPwd = document.getElementById('login-password-input');
    if (loginPwd) loginPwd.value = '';
    const createPwd1 = document.getElementById('create-password-input');
    if (createPwd1) createPwd1.value = '';
    const createPwd2 = document.getElementById('create-password-confirm');
    if (createPwd2) createPwd2.value = '';
    
    toggleLoginMode();
}

function toggleLoginMode() {
    window.authMode = 'login';
    const titleEl = document.getElementById('modal-main-title');
    const subEl = document.getElementById('modal-main-subtitle');
    const hintEl = document.getElementById('register-hint');
    const loginHintEl = document.getElementById('login-hint');
    const pwdContainer = document.getElementById('login-password-container');
    const btnMain = document.getElementById('btn-login-main');
    const errorMsg = document.getElementById('login-error-msg');
    
    if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.innerText = "";
    }
    
    if (titleEl) titleEl.innerText = "Iniciar Sesión";
    if (subEl) subEl.innerText = "Ingresa tu número para entrar a tu billetera";
    if (hintEl) hintEl.style.display = "block";
    if (loginHintEl) loginHintEl.style.display = "none";
    if (pwdContainer) pwdContainer.style.display = "block";
    if (btnMain) btnMain.innerText = "Iniciar sesión";
}

function toggleRegisterMode() {
    window.authMode = 'register';
    const titleEl = document.getElementById('modal-main-title');
    const subEl = document.getElementById('modal-main-subtitle');
    const hintEl = document.getElementById('register-hint');
    const loginHintEl = document.getElementById('login-hint');
    const pwdContainer = document.getElementById('login-password-container');
    const btnMain = document.getElementById('btn-login-main');
    const errorMsg = document.getElementById('login-error-msg');

    if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.innerText = "";
    }

    if (titleEl) titleEl.innerText = "Registrarse";
    if (subEl) subEl.innerText = "Ingresa tu número para crear tu cuenta";
    if (hintEl) hintEl.style.display = "none";
    if (loginHintEl) loginHintEl.style.display = "block";
    if (pwdContainer) pwdContainer.style.display = "none";
    if (btnMain) btnMain.innerText = "Continuar";
    
    document.getElementById('phone-login-input').focus();
}

// ── Autenticación por Teléfono (SMS / OTP) ───────────────────────────────────────────────
var phoneConfirmationResult = null;
var recaptchaVerifier = null;

/**
 * Inicializa o reinicializa el reCAPTCHA invisible de Firebase.
 * Destruye correctamente cualquier widget previo antes de crear uno nuevo
 * para evitar el error "reCAPTCHA has already been rendered in this element".
 */
function setupRecaptcha() {
    // 1. Destruir el verificador de Firebase si existe
    if (recaptchaVerifier) {
        try { recaptchaVerifier.clear(); } catch (e) { console.warn('reCAPTCHA clear:', e); }
        recaptchaVerifier = null;
    }

    // 2. Reemplazar el nodo del contenedor por uno completamente nuevo.
    //    Limpiar innerHTML NO es suficiente: Firebase registra el widget
    //    contra el nodo original y vuelve a lanzar "already rendered"
    //    al intentar crear un nuevo RecaptchaVerifier en él.
    const oldContainer = document.getElementById('recaptcha-container');
    if (oldContainer && oldContainer.parentNode) {
        const newContainer = document.createElement('div');
        newContainer.id = 'recaptcha-container';
        oldContainer.parentNode.replaceChild(newContainer, oldContainer);
    }

    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: () => { }
    });
    recaptchaVerifier.render().catch(err => console.warn('reCAPTCHA render:', err));
}

async function submitAuthAction() {
    const isLogin = window.authMode !== 'register';
    const countrySelect = document.getElementById('phone-country-select');
    const phoneInput = document.getElementById('phone-login-input');
    const pwdInput = document.getElementById('login-password-input');
    const btn = document.getElementById('btn-login-main');
    const errorMsg = document.getElementById('login-error-msg');

    if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.innerText = "";
    }

    function showError(msg) {
        if (errorMsg) {
            errorMsg.innerText = msg;
            errorMsg.style.display = "block";
        } else {
            alert(msg);
        }
    }

    if (!phoneInput || !phoneInput.value.trim()) {
        showError('Por favor ingresa tu número de teléfono.');
        return;
    }

    let countryCode = countrySelect.value;
    if (countryCode === '+1-US') countryCode = '+1';

    window.currentPhoneNumber = countryCode + phoneInput.value.trim();
    // Creamos email sintético sin el signo '+'
    window.currentSyntheticEmail = `${window.currentPhoneNumber.replace('+', '')}@enmssell.com`;

    if (isLogin) {
        if (!pwdInput || !pwdInput.value) {
            showError('Por favor ingresa tu contraseña.');
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons spin" style="font-size:16px; vertical-align:middle;">autorenew</span> Verificando...';
        
        try {
            await firebase.auth().signInWithEmailAndPassword(window.currentSyntheticEmail, pwdInput.value);
            closeLogin();
        } catch (e) {
            console.error(e);
            showError("Contraseña incorrecta o usuario no registrado.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Iniciar sesión";
        }
    } else {
        // Flujo de Registro
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons spin" style="font-size:16px; vertical-align:middle;">autorenew</span> Verificando...';

        try {
            const methods = await firebase.auth().fetchSignInMethodsForEmail(window.currentSyntheticEmail);
            if (methods.includes('password')) {
                showError("Este número ya está registrado. Por favor, inicia sesión.");
                toggleLoginMode();
                btn.disabled = false;
                btn.innerText = "Iniciar sesión";
            } else {
                sendOTP();
                // We re-enable it in case SMS fails or returns quickly
                setTimeout(() => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerText = "Continuar";
                    }
                }, 1000);
            }
        } catch (e) {
            console.error("Error validando usuario:", e);
            sendOTP();
            btn.disabled = false;
            btn.innerText = "Continuar";
        }
    }
}

/**
 * Función interna para enviar el SMS utilizando recaptcha
 */
function sendOTP() {
    setupRecaptcha();

    // Guardamos el número
    const countrySelect = document.getElementById('phone-country-select');
    const phoneInput = document.getElementById('phone-login-input');
    localStorage.setItem('enmsell_phone_country', countrySelect.value);
    localStorage.setItem('enmsell_phone_number', phoneInput.value.trim());

    firebase.auth().signInWithPhoneNumber(window.currentPhoneNumber, recaptchaVerifier)
        .then(confirmationResult => {
            phoneConfirmationResult = confirmationResult;
            const phoneLoginSection = document.getElementById('phone-login-section');
            const createPwdSection = document.getElementById('create-password-section');
            const otpSection = document.getElementById('phone-otp-section');
            const otpInput = document.getElementById('phone-otp-input');
            if (phoneLoginSection) phoneLoginSection.style.display = 'none';
            if (createPwdSection) createPwdSection.style.display = 'none';
            if (otpSection) otpSection.style.display = 'block';
            if (otpInput) otpInput.focus();
        })
        .catch(err => {
            console.error('SMS error:', err);
            let msg = 'Error al enviar el SMS. ';
            if (err.code === 'auth/invalid-phone-number') msg += 'El número de teléfono no es válido.';
            else if (err.code === 'auth/too-many-requests') msg += 'Demasiados intentos. Espera unos minutos.';
            else if (err.code === 'auth/quota-exceeded') msg += 'Se alcanzó el límite de SMS. Intenta más tarde.';
            else msg += err.message;
            alert(msg);
            // Destruir el widget correctamente para permitir un nuevo intento
            if (recaptchaVerifier) {
                try { recaptchaVerifier.clear(); } catch (e) {}
                recaptchaVerifier = null;
            }
            const container = document.getElementById('recaptcha-container');
            if (container) container.innerHTML = '';
        });
}

function handleForgotPassword() {
    const countrySelect = document.getElementById('phone-country-select');
    const phoneInput = document.getElementById('phone-login-input');
    const errorMsg = document.getElementById('login-error-msg');

    if (!phoneInput || !phoneInput.value.trim()) {
        if (errorMsg) {
            errorMsg.innerText = 'Ingresa tu número de teléfono para restablecer la contraseña.';
            errorMsg.style.display = 'block';
        } else {
            alert('Ingresa tu número de teléfono.');
        }
        return;
    }

    let countryCode = countrySelect ? countrySelect.value : '+56';
    if (countryCode === '+1-US') countryCode = '+1';

    window.currentPhoneNumber = countryCode + phoneInput.value.trim();
    window.currentSyntheticEmail = `${window.currentPhoneNumber.replace('+', '')}@enmssell.com`;

    sendOTP();
}

async function handlePasswordLogin() {
    // This is kept here to not break anything calling it, but it's largely superseded by submitAuthAction()
    const pwd = document.getElementById('login-password-input').value;
    if (!pwd) {
        alert("Ingresa tu contraseña.");
        return;
    }

    const btn = document.getElementById('btn-login-main'); // the new button
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Verificando...";
    }

    try {
        await firebase.auth().signInWithEmailAndPassword(window.currentSyntheticEmail, pwd);
        closeLogin();
    } catch (e) {
        console.error(e);
        alert("Contraseña incorrecta o usuario no encontrado.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Iniciar sesión";
        }
    }
}

/**
 * Verifica el código OTP. Si es correcto, asocia el email sintético
 * si aún no lo tiene, y lleva al usuario a crear su contraseña.
 */
function handlePhoneVerifyCode() {
    const otpInput = document.getElementById('phone-otp-input');
    if (!otpInput || !otpInput.value.trim() || otpInput.value.length < 6) {
        alert('Ingresa el código de 6 dígitos.');
        return;
    }

    if (!phoneConfirmationResult) {
        alert('Error: No hay un código pendiente. Intenta enviar el SMS nuevamente.');
        return;
    }

    phoneConfirmationResult.confirm(otpInput.value.trim())
        .then(async (result) => {
            // No llamamos updateEmail aquí: linkWithCredential en el siguiente paso lo maneja
            const otpSection = document.getElementById('phone-otp-section');
            const createPwdSection = document.getElementById('create-password-section');
            if (otpSection) otpSection.style.display = 'none';
            if (createPwdSection) createPwdSection.style.display = 'block';

            phoneConfirmationResult = null;
            recaptchaVerifier = null;
        })
        .catch(err => {
            console.error('OTP error:', err);
            if (err.code === 'auth/invalid-verification-code') {
                alert('El código ingresado es incorrecto. Revisa e intenta de nuevo.');
            } else {
                alert('Error al verificar el código: ' + err.message);
            }
        });
}

async function handleCreatePassword() {
    const pwd1 = document.getElementById('create-password-input').value;
    const pwd2 = document.getElementById('create-password-confirm').value;

    if (!pwd1 || pwd1.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    if (pwd1 !== pwd2) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    const btn = document.getElementById('btn-create-password');
    if (btn) { btn.disabled = true; btn.innerText = "Guardando..."; }

    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        alert("Error: sesión no encontrada. Intenta de nuevo.");
        if (btn) { btn.disabled = false; btn.innerText = "Guardar Contraseña"; }
        return;
    }

    const email = window.currentSyntheticEmail;

    try {
        // Verificar si ya tiene proveedor email/password vinculado
        const hasEmailProvider = currentUser.providerData.some(p => p.providerId === 'password');

        if (hasEmailProvider) {
            // Flujo de restablecimiento: solo actualizar la contraseña
            await currentUser.updatePassword(pwd1);
        } else {
            // Flujo de registro: vincular email sintético + contraseña como nuevo proveedor
            const credential = firebase.auth.EmailAuthProvider.credential(email, pwd1);
            await currentUser.linkWithCredential(credential);
        }

        closeLogin();
    } catch (e) {
        console.error("Error al guardar contraseña:", e);
        if (e.code === 'auth/requires-recent-login') {
            alert("Por seguridad, vuelve a verificar tu número para cambiar la contraseña.");
        } else if (e.code === 'auth/email-already-in-use') {
            alert("Este número ya tiene una cuenta. Por favor inicia sesión con tu contraseña.");
        } else {
            alert("Error al guardar la contraseña: " + e.message);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "Guardar Contraseña"; }
    }
}

// ── Autenticación con Google ─────────────────────────────────────────────────────────────
var isLoggingIn = false;

/**
 * Inicia el flujo de autenticación con Google usando un popup.
 * Previene multiples llamadas simultáneas con la flag `isLoggingIn`.
 * Ignora los errores de popup cancelado por el usuario.
 */
function handleGoogleLogin() {

    // Forzar el estado a false para asegurar que no esté bloqueado permanentemente
    if (isLoggingIn) {
        console.warn("Estaba bloqueado por isLoggingIn. Liberando...");
        isLoggingIn = false;
    }

    if (typeof firebase === 'undefined') {
        alert("Error: Firebase no está cargado correctamente.");
        return;
    }

    if (window.location.protocol === 'file:') {
        alert("El inicio de sesión no funciona abriendo el archivo directamente. Usa un servidor local.");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    isLoggingIn = true;

    firebase.auth().signInWithPopup(provider).then(result => {

        closeLogin();
    }).catch(error => {
        if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
            alert("Hubo un error al iniciar sesión: " + error.message);
        }
        console.error("Error en login:", error);
    }).finally(() => {
        isLoggingIn = false;
    });
}

// ── Actualización de la UI de autenticación ──────────────────────────────────────────────

/**
 * Actualiza la barra de navegación para mostrar el avatar, nombre y botón
 * de salida del usuario autenticado. Carga el script de admin si el usuario
 * tiene el rol de administrador.
 */
function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem;">
        <div id="nav-notifications-bell" style="position: relative; cursor: pointer; display: flex; align-items: center; margin-right: 0.5rem;" onclick="handleNotificationBellClick()">
            <span class="material-icons" style="font-size: 24px; color: var(--gold-light);">notifications</span>
            <span id="nav-notifications-badge" style="display: none; position: absolute; top: -5px; right: -5px; background: var(--error); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">0</span>
        </div>
        <img src="${user.photo || 'https://via.placeholder.com/35'}" style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid var(--gold); cursor: pointer;" onclick="showView('profile')">
        <span class="user-name-display" style="font-weight: 600; cursor: pointer;" onclick="showView('profile')">Hola, ${user.name || 'Usuario'}</span>
        <button class="btn-signin" style="padding: 0.4rem 1rem;" onclick="handleLogout()">Salir</button>
    </div>
        `;
    }

    // Update Mobile Account button to go to profile instead of login
    const mobAccount = document.getElementById('mob-account');
    if (mobAccount) {
        mobAccount.setAttribute('onclick', "showView('profile')");
    }
    if (user.isAdmin) {
        const adminNav = document.getElementById('nav-admin');
        if (adminNav) adminNav.style.display = 'inline-block';
        const mobAdminNav = document.getElementById('mob-admin');
        if (mobAdminNav) mobAdminNav.style.display = 'flex';
        
        if (!document.getElementById('admin-script')) {
            const script = document.createElement('script');
            script.id = 'admin-script';
            script.src = `js/admin.js?v=${APP_CONSTANTS.ADMIN_SCRIPT_VERSION}`;
            script.defer = true;
            document.body.appendChild(script);
        }
    }
}

/**
 * Restaura la barra de navegación al estado de usuario anónimo:
 * muestra el botón "Iniciar Sesión", oculta el nav de admin
 * y redirige al home si estaba en una vista protegida.
 */
function resetAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `<button class="btn-signin" onclick="openLogin()">Iniciar sesión</button>`;
    }
    const adminNav = document.getElementById('nav-admin');
    if (adminNav) adminNav.style.display = 'none';
    const mobAdminNav = document.getElementById('mob-admin');
    if (mobAdminNav) mobAdminNav.style.display = 'none';

    // Redirect home on logout
    if (!user) {
        const homeEl = document.getElementById('view-home');
        if (homeEl && homeEl.style.display === 'none') {
            showView('home');
        }
    }

    // Restore Mobile Account button to open login
    const mobAccount = document.getElementById('mob-account');
    if (mobAccount) {
        mobAccount.setAttribute('onclick', "openLogin()");
    }
}

// ── Perfil de usuario ──────────────────────────────────────────────────────────────────

/**
 * Carga el perfil del usuario desde Firestore y actualiza los campos
 * de la vista Profile y el formulario de envío (nombre del remitente).
 * También carga la lista de beneficiarios si la función está disponible.
 *
 * @async
 * @returns {Promise<void>}
 */
async function loadUserProfile() {
    if (!user || !user.uid) return;
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        const pic = document.getElementById('profile-pic');
        const initials = document.getElementById('profile-initials');
        const nameDisplay = document.getElementById('profile-name-display');
        const emailDisplay = document.getElementById('profile-email-display');

        const nameInput = document.getElementById('user-full-name');
        const phoneInput = document.getElementById('user-phone');
        const rutInput = document.getElementById('user-rut');
        const soundInput = document.getElementById('user-notification-sound');

        // Pre-fill sender-name in the payment form
        const senderNameField = document.getElementById('sender-name');
        // Only fill if the user hasn't manually edited it
        if (senderNameField && !senderNameField.dataset.userEdited) {
            if (doc.exists) {
                senderNameField.value = doc.data().fullName || user.name || '';
            } else {
                senderNameField.value = user.name || '';
            }
        }

        if (doc.exists) {
            const data = doc.data();
            if (nameInput) nameInput.value = data.fullName || user.name || '';
            if (phoneInput) phoneInput.value = data.phone || '';
            if (rutInput) rutInput.value = data.rut || '';
            if (soundInput) soundInput.value = data.notificationSound || 'default';

            if (nameDisplay) nameDisplay.innerText = data.fullName || user.name || 'Usuario';
            if (emailDisplay) emailDisplay.innerText = user.email || '';
        } else {
            if (nameInput) nameInput.value = user.name || '';
            if (nameDisplay) nameDisplay.innerText = user.name || 'Usuario';
            if (emailDisplay) emailDisplay.innerText = user.email || '';
        }

        if (user.photo && pic) {
            pic.src = user.photo;
            pic.style.display = 'block';
            if (initials) initials.style.display = 'none';
        } else if (initials) {
            if (pic) pic.style.display = 'none';
            initials.style.display = 'flex';
            initials.innerText = (user.name || 'U').substring(0, 2).toUpperCase();
        }

        if (typeof loadUserBeneficiaries === 'function') {
            loadUserBeneficiaries();
        }

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

/**
 * Persiste los datos del perfil del usuario (nombre, teléfono, RUT/Cedúnla)
 * en Firestore usando merge para no sobrescribir otros campos.
 *
 * @async
 * @returns {Promise<void>}
 */
async function saveUserProfile() {
    if (!user || !user.uid) return;
    const nameEl = document.getElementById('user-full-name');
    const phoneEl = document.getElementById('user-phone');
    const rutEl = document.getElementById('user-rut');
    const soundEl = document.getElementById('user-notification-sound');

    const profile = {
        fullName: nameEl ? nameEl.value : '',
        phone: phoneEl ? phoneEl.value : '',
        rut: rutEl ? rutEl.value : '',
        notificationSound: soundEl ? soundEl.value : 'default',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('users').doc(user.uid).set(profile, { merge: true });
        alert("¡Perfil guardado con éxito!");
        loadUserProfile();
    } catch (err) {
        console.error("Error saving profile:", err);
        alert("Ocurrió un error al guardar los datos.");
    }
}

// ── Logout ─────────────────────────────────────────────────────────────────────

/**
 * Cierra la sesión del usuario en Firebase y muestra el modal de confirmación
 * de sesión cerrada si existe en el DOM.
 */
function handleLogout() {
    if (auth) {
        auth.signOut().then(() => {

            const modal = document.getElementById('logout-modal');
            if (modal) {
                modal.style.display = 'flex';
            } else {
                showView('home');
            }
        }).catch(err => {
            console.error("Error al cerrar sesión:", err);
        });
    }
}

/**
 * Cierra el modal de sesión cerrada y redirige al home.
 */
function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) modal.style.display = 'none';
    showView('home');
}

/**
 * Muestra u oculta la contraseña en los campos de input.
 */
window.togglePasswordVisibility = function(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.innerText = 'visibility';
    } else {
        input.type = 'password';
        icon.innerText = 'visibility_off';
    }
};
