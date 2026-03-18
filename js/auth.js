document.addEventListener('DOMContentLoaded', () => {
    if (typeof auth !== 'undefined' && auth) {
        auth.onAuthStateChanged(firebaseUser => {
            if (firebaseUser) {
                // Check for admin email (case insensitive for safety). Safely check if email exists (for phone auth)
                const isAdmin = firebaseUser.email ? firebaseUser.email.toLowerCase() === 'enmssellchanges@gmail.com' : false;

                user = {
                    name: firebaseUser.displayName || firebaseUser.phoneNumber || 'Usuario',
                    email: firebaseUser.email,
                    photo: firebaseUser.photoURL,
                    uid: firebaseUser.uid,
                    isAdmin: isAdmin
                };
                updateAuthUI();
                loadUserProfile();

                requestNotificationPermission();

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

function openLogin() {
    document.getElementById('login-modal').style.display = 'flex';
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
    // Reset phone login state when closing
    const otpSection = document.getElementById('phone-otp-section');
    const phoneSection = document.getElementById('phone-login-section');
    if (otpSection) otpSection.style.display = 'none';
    if (phoneSection) phoneSection.style.display = 'block';
    const otpInput = document.getElementById('phone-otp-input');
    if (otpInput) otpInput.value = '';
}

// ── Phone Auth ────────────────────────────────────────────────────────────────
var phoneConfirmationResult = null;
var recaptchaVerifier = null;

function setupRecaptcha() {
    if (recaptchaVerifier) return; // Already set up
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: () => { console.log('reCAPTCHA solved'); }
    });
    recaptchaVerifier.render().catch(err => console.warn('reCAPTCHA render:', err));
}

function handlePhoneSendCode() {
    const countrySelect = document.getElementById('phone-country-select');
    const phoneInput = document.getElementById('phone-login-input');
    const btn = document.getElementById('btn-send-sms');

    if (!phoneInput || !phoneInput.value.trim()) {
        alert('Por favor ingresa tu número de teléfono.');
        return;
    }

    let countryCode = countrySelect.value;
    // Handle USA special case
    if (countryCode === '+1-US') countryCode = '+1';

    const fullNumber = countryCode + phoneInput.value.trim();

    setupRecaptcha();

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons spin" style="font-size:16px; vertical-align:middle;">autorenew</span> Enviando...';

    firebase.auth().signInWithPhoneNumber(fullNumber, recaptchaVerifier)
        .then(confirmationResult => {
            phoneConfirmationResult = confirmationResult;
            // Remember phone for next time
            localStorage.setItem('enmsell_phone_country', countrySelect.value);
            localStorage.setItem('enmsell_phone_number', phoneInput.value.trim());
            // Show OTP input
            document.getElementById('phone-login-section').style.display = 'none';
            document.getElementById('phone-otp-section').style.display = 'block';
            document.getElementById('phone-otp-input').focus();
        })
        .catch(err => {
            console.error('SMS error:', err);
            let msg = 'Error al enviar el SMS. ';
            if (err.code === 'auth/invalid-phone-number') msg += 'El número de teléfono no es válido.';
            else if (err.code === 'auth/too-many-requests') msg += 'Demasiados intentos. Espera unos minutos.';
            else if (err.code === 'auth/quota-exceeded') msg += 'Se alcanzó el límite de SMS. Intenta más tarde.';
            else msg += err.message;
            alert(msg);
            // Reset reCAPTCHA for retry
            recaptchaVerifier = null;
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:middle; margin-right:4px;">sms</span> Enviar Código SMS';
        });
}

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
        .then(() => {
            closeLogin();
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

var isLoggingIn = false;
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

function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1rem;">
        <img src="${user.photo || 'https://via.placeholder.com/35'}" style="width: 35px; height: 35px; border-radius: 50%; border: 2px solid var(--gold); cursor: pointer;" onclick="showView('profile')">
        <span class="user-name-display" style="font-weight: 600; cursor: pointer;" onclick="showView('profile')">${user.name}</span>
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
    }
}

function resetAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `<button class="btn-signin" onclick="openLogin()">Iniciar Sesión</button>`;
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

async function saveUserProfile() {
    if (!user || !user.uid) return;
    const nameEl = document.getElementById('user-full-name');
    const phoneEl = document.getElementById('user-phone');
    const rutEl = document.getElementById('user-rut');

    const profile = {
        fullName: nameEl ? nameEl.value : '',
        phone: phoneEl ? phoneEl.value : '',
        rut: rutEl ? rutEl.value : '',
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

function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) modal.style.display = 'none';
    showView('home');
}
