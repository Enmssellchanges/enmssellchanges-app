# 🗺️ ENMSSELLCHANGES — Mapa de Arquitectura

> Referencia rápida para localizar cualquier función o sección del proyecto.
> Actualizado: 2026-04-02

---

## 📁 Estructura de Archivos

```
Antigravity/
├── index.html               ← Toda la UI (1 solo archivo HTML, ~1400 líneas)
├── js/
│   ├── api.js               ← Llamadas a Firebase Cloud Functions (admin email, Telegram, notificaciones push)
│   ├── auth.js              ← Autenticación Google, login modal, perfil de usuario
│   ├── beneficiaries.js     ← Gestión de destinatarios frecuentes (guardar, cargar, renderizar)
│   ├── calculator.js        ← Cálculo de tasas, widget Home y formulario Enviar
│   ├── transactions.js      ← Historial, simulación de transferencia, comprobantes
│   └── ui.js                ← Navegación, selectores de país/banco, notificaciones, temas
├── css/
│   └── style.css            ← Estilos globales (variables CSS, componentes, responsive)
├── assets/
│   └── img/                 ← Logos de bancos (logo-bcv.webp, logo-santander.png, logo-estado.png...)
└── firebase.json / .firebaserc / firestore.rules / storage.rules
```

---

## 📄 js/beneficiaries.js

| Función | Qué hace | Línea aprox. |
|---|---|---|
| `loadUserBeneficiaries()` | Carga beneficiarios desde Firestore al inicio de sesión | 4 |
| `renderBeneficiariesDropdown()` | Actualiza el `<select>` de la vista Send y la lista en Destinatarios | 17 |
| `handleSendRecipientSelect(val)` | Maneja cambio en el selector de destinatario en vista Send | 74 |
| `deleteSavedBeneficiary(index)` | Elimina un beneficiario de Firestore y re-renderiza | 91 |
| `_fillField(id, value)` | **Helper clave**: llena campos con prefijo `send-` y `manage-` automáticamente. Soporta `<select>` con búsqueda parcial (fix: compatibilidad con datos antiguos) | 114 |
| `_showFillToast(msg)` | Muestra un toast flotante de confirmación/error | 151 |
| `loadSavedBeneficiary(index)` | **Función principal**: mapea datos del objeto beneficiario a los campos del formulario Send (hidden fields) | 166 |
| `handleSelectBeneficiaryFromList(index)` | Maneja click en tarjeta de destinatario desde vista Destinatarios → redirige a Send | 311 |
| `saveNewBeneficiaryFromView()` | Guarda un nuevo destinatario desde el formulario de la vista Destinatarios | 327 |
| `saveBeneficiaryToProfile(tx)` | Escribe el beneficiario en Firestore (`users/{uid}/beneficiaries`) | 458 |

### ⚠️ Reglas importantes
- `_fillField` intenta llenar `id`, `send-{id}` y `manage-{id}` a la vez.
- Los datos del beneficiario están en formato anidado: `b.vesData`, `b.copData`, etc. Pero los datos **viejos** guardados anteriormente usan campos planos: `b.id`, `b.bank`, `b.account`. `loadSavedBeneficiary` soporta ambos formatos.
- Siempre llamar `calculate()` **antes** de llenar campos con `_fillField`, ya que `calculate()` muestra/oculta los bloques por país.

---

## 📄 js/calculator.js

| Función | Qué hace | Línea aprox. |
|---|---|---|
| `debouncedCalculate()` | Versión debounced (300ms) de `calculate()`, para el input de envío | 17 |
| `debouncedCalculateQuick()` | Versión debounced de `calculateQuick()`, para el widget Home | 26 |
| `calculateQuick(reverse)` | Calcula monto en el widget Home (no la vista Send) | 70 |
| `calculate(reverse)` | **Función principal**: calcula monto en vista Send Y muestra/oculta campos por país destino | 170 |
| `calculateBCVSend()` | Actualiza monto VES desde el input USD-BCV en vista Send | 322 |
| `calculateBCVQuick()` | Actualiza monto VES desde el input USD-BCV en widget Home | 299 |
| `calculateMonitorSend()` | Actualiza monto VES desde el input USD-Monitor en vista Send | 364 |
| `calculateMonitorQuick()` | Actualiza monto VES desde el input USD-Monitor en widget Home | 342 |
| `renderHomeRates()` | Renderiza tarjetas de tasas del día en la vista Home | 384 |
| `renderBCV()` | Actualiza label de tasa BCV | 419 |
| `renderMonitor()` | Actualiza label de tasa Monitor | 427 |
| `toggleCountryList(pickerType)` | Abre modal de selección de país para `source`, `dest`, `quick-source`, `quick-dest` | 440 |
| `updateCountryUI(prefix, c)` | Actualiza la bandera y el código visible del selector | 472 |
| `selectCountry(code)` | Aplica la selección de país desde el modal y recalcula | 485 |

### Variables globales clave
- `sourceCountry` / `destCountry` — País origen/destino de la **vista Send**
- `quickSourceCountry` / `quickDestCountry` — País origen/destino del **widget Home**
- `AppConfig` — Objeto con `countries[]`, `bcvRate`, `bcvNumeric`, `monitorRate`, `monitorNumeric` (viene de Firestore vía `api.js`)

---

## 📄 js/transactions.js

| Función | Qué hace | Línea aprox. |
|---|---|---|
| `filterTransactions()` | Filtra historial por búsqueda de texto y rango de fechas | 5 |
| `groupTransactionsByDate(transactions)` | Agrupa transacciones por fecha para la UI | 31 |
| `renderTransactionsList(transactions)` | Renderiza las tarjetas de historial agrupadas por fecha | 50 |
| `handleFileSelect(event)` | Maneja la selección de imagen del comprobante, comprime y previsualiza | 133 |
| `handleContinueToDestinatarios()` | Valida monto mínimo y transiciona a la vista Destinatarios | 153 |
| `simulateTransfer()` | **Función principal del flujo de pago**: valida todos los campos por país, crea registro en Firestore, sube comprobante a Storage, dispara notificaciones | 195 |
| `loadTransactions()` | Suscribe en tiempo real al historial del usuario en Firestore | 477 |
| `toggleReceiptPreview(id)` | Muestra/oculta la imagen del comprobante en tarjeta de historial | 504 |
| `downloadProofById(imgId, filename)` | Descarga imagen desde un elemento `<img>` por ID | 525 |
| `downloadProof(proofData, filename)` | Descarga imagen Base64 o URL | 542 |

### ⚠️ Reglas de validación en `simulateTransfer()`
- **VES**: requiere `send-recipient-name`, `send-ves-id`, `send-ves-bank`, `send-ves-account`. Pago Móvil = 11 dígitos. Transferencia = 20 dígitos.
- **COP**: requiere `send-recipient-name`, `send-cop-id`, `send-cop-bank`, `send-cop-account`.
- **PEN**: requiere `send-recipient-name`, `send-pen-account`.
- **USD (Zelle)**: requiere `send-recipient-name`, `send-usa-zelle-data`. Email validado con regex.
- **ECS**: requiere `send-recipient-name`, `send-ecs-id`, `send-ecs-bank`, `send-ecs-account`.
- **CLP**: requiere `send-recipient-name`, `send-clp-id`, `send-clp-bank`, `send-clp-type`, `send-clp-account`.

---

## 📄 js/ui.js

| Función | Qué hace | Línea aprox. |
|---|---|---|
| `getCountryLabel(country)` | Devuelve nombre legible del país | 21 |
| `updateConnectionStatus()` | Actualiza chip de conexión Cloud/Offline | 32 |
| `showView(view)` | **Función de navegación**: muestra vista, oculta las demás, verifica auth | 61 |
| `selectVesType(type, context, clearValue)` | Actualiza botones Pago Móvil / Transferencia y maxLength del campo | 120 |
| `toggleRecipientCountry(context)` | Muestra/oculta campos de país en formulario de destinatario | 180 |
| `toggleCopType(context)` | Adapta campo Colombia entre Nequi (tel) y Bancolombia (cuenta) | 200 |
| `togglePenType(context)` | Adapta campo Perú entre Yape/Plin (tel) y Banco (cuenta) | 221 |
| `toggleUsaType(context)` | Adapta campo USA entre teléfono y email Zelle | 243 |
| `handleUsaZelleInput(input, context)` | Filtra input Zelle a sólo dígitos cuando tipo = teléfono | 264 |
| `startNewPayment()` | Valida mínimo en Home y transiciona a vista Send | 279 |
| `renderUserAccounts()` | Renderiza cuentas bancarias del servicio en vista Send (onSnapshot) | 324 |
| `copyAccountData(...)` | Copia datos de cuenta al portapapeles | 381 |
| `updateTransferLogo(pfx, context)` | Muestra logo del banco seleccionado | 410 |
| `getBankLogo(bankName)` | Resuelve URL del logo de un banco por nombre | 433 |
| `requestNotificationPermission()` | Solicita permiso de notificaciones push y guarda token FCM | 484 |
| `showToast(title, message)` | Muestra notificación toast en primer plano | 541 |
| `copyToClipboard(text, btn)` | Copia texto y anima el botón con feedback | 560 |
| `renderAccountData(data, isHistory)` | Construye HTML de tarjeta de cuenta destino copiable | 584 |
| `initTheme()` / `toggleTheme()` / `applyTheme()` | Sistema de temas (default/modern/light) con localStorage | 641 |
| `openPromoModal()` / `closePromoModal()` | Modal promocional | 666 |
| `openMoreMenu()` / `closeMoreMenu()` | Menú "Más" del nav | 694 |
| `openBankAccountsModal()` / `closeBankAccountsModal()` | Modal global de cuentas bancarias | 729 |
| `openPrivacyModal()` / `openTermsModal()` | Modales legales | 744 |
| `renderGlobalBankAccounts()` | Renderiza cuentas en el modal global | 772 |
| `openNotificationSettingsModal()` | Abre modal de configuración de notificaciones | 822 |
| `updateNotificationSettingsUI()` | Actualiza estado visual del modal de notificaciones | 836 |
| `loadNotificationSoundPreference()` | Carga preferencia de sonido desde localStorage / Firestore | 913 |
| `saveNotificationSoundFromSettings(value)` | Guarda preferencia de sonido | 934 |
| `playNotificationSoundByPreference(pref)` | Reproduce el tono de notificación seleccionado | 1038 |

---

## 🗂️ index.html — Mapa de Secciones

Busca con `Ctrl+F` el string en corchetes para saltar a esa sección:

| Anchor | Qué contiene |
|---|---|
| `[HEAD]` | Meta tags, fuentes Google, CSS |
| `[NAV]` | Barra navegación superior con links y estado de conexión |
| `[VISTA: HOME]` | Sección principal: héroe, calculadora rápida y tasas del día |
| `[VISTA: SEND]` | Formulario de nuevo envío con calculadora, cuentas bancarias del servicio, selector de destinatario y ghost fields ocultos |
| `[SEND: HIDDEN FIELDS]` | Inputs ocultos (`send-*`) que `simulateTransfer()` lee para procesar el pago. Uno por país. |
| `[VISTA: DESTINATARIOS]` | Gestión de destinatarios frecuentes (agregar/listar/eliminar) |
| `[VISTA: HISTORY]` | Historial de transacciones del usuario |
| `[VISTA: TRACKING]` | Seguimiento en tiempo real del último envío |
| `[VISTA: PROFILE]` | Perfil del usuario y preferencias |
| `[VISTA: ADMIN]` | Panel de administración |
| `[ADMIN: CUENTAS]` | Editor de cuentas bancarias del servicio |
| `[ADMIN: TASAS]` | Editor de tasas de cambio |
| `[ADMIN: PUSH]` | Envío de notificaciones push masivas |
| `[ADMIN: PROMOCION]` | Configuración de modal promocional |
| `[ADMIN: BINANCE]` | Monitores de Binance P2P |
| `[FOOTER]` | Horarios y términos |
| `[MODAL: PROMO]` | Modal de imagen promocional |
| `[MODAL: REJECT]` | Modal de rechazo de transacción (admin) |
| `[MODAL: CONFIRM]` | Modal de autorización de transacción (admin) |
| `[MODAL: LOGIN]` | Modal de inicio de sesión |
| `[MODAL: COUNTRY]` | Modal selector de país (fuente/destino) |
| `[MODAL: USER-HISTORY]` | Modal de historial de usuario (admin) |
| `[MODAL: LOGOUT]` | Modal de cierre de sesión |
| `[MOBILE NAV]` | Barra de navegación inferior para móvil |
| `[SCRIPTS]` | Carga de scripts Firebase y módulos JS |

---

## 🔑 Claves de Diseño

### Prefijos de contexto (`send-` vs `manage-`)
- `send-*` → campos en la **vista Send** (usados por `simulateTransfer()`)
- `manage-*` → campos en la **vista Destinatarios** (usados por `saveNewBeneficiaryFromView()`)
- Todas las funciones de UI aceptan un parámetro `context = 'send' | 'manage'`

### Variables globales de estado
```js
user            // objeto Firebase Auth del usuario logueado
destCountry     // país destino activo en la vista Send
sourceCountry   // país origen activo en la vista Send
AppConfig       // configuración en tiempo real desde Firestore
savedBeneficiariesList  // array de beneficiarios del usuario
currentTransfer // objeto de la última transferencia procesada
selectedProofBase64  // imagen del comprobante (Base64) pendiente de subir
```

### Flujo principal de un pago
```
startNewPayment() → showView('send') → [usuario selecciona destinatario]
→ handleSendRecipientSelect() → loadSavedBeneficiary() → [llena ghost fields]
→ simulateTransfer() → uploadBase64ToStorage() → db.collection('transfers').add()
→ sendAdminEmail() + sendTelegramAdmin() → showView('tracking')
```
