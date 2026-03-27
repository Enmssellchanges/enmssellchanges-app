/**
 * @file config.js
 * @description Constantes centralizadas de la aplicación Enmssellchanges.
 *
 * INSTRUCCIONES DE USO:
 *   - Este archivo debe cargarse ANTES que cualquier otro módulo JS.
 *   - Toda cadena de texto "hardcodeada" que pueda cambiar en producción
 *     (correo del admin, número de WhatsApp, clave VAPID, versión de caché)
 *     debe residir aquí.
 *   - NO almacenar secretos que no deban ser visibles en el cliente
 *     (tokens de backend, contraseñas, etc.). Esos van en Cloud Functions.
 *
 * HISTORIAL DE CAMBIOS:
 *   v1.0 — 2026-03-27 — Creación inicial, unificando constantes dispersas.
 */

const APP_CONSTANTS = {

  // ── Administración ──────────────────────────────────────────────────────────
  // Email del administrador principal. Se compara en auth.js y admin.js.
  ADMIN_EMAIL: 'enmssellchanges@gmail.com',

  // Versión del script admin.js — incrementar al publicar cambios en ese archivo.
  // Formato: 'js/admin.js?v=X.X' — el parámetro bust de caché se genera automáticamente.
  ADMIN_SCRIPT_VERSION: '10.4',

  // ── Contacto / Soporte ──────────────────────────────────────────────────────
  // Número de WhatsApp con prefijo de país (sin espacios ni guiones).
  WHATSAPP_NUMBER: '56950628724',

  // ── Notificaciones Push (Firebase Cloud Messaging) ──────────────────────────
  // Clave pública VAPID generada en la consola de Firebase > Cloud Messaging.
  // Cambiar si se regenera el par de claves en Firebase.
  FCM_VAPID_KEY: 'BB9P-4noUBBoTSK5T8NbqhsNhP_6tHZVOq7a9vY_RZQItqeP-pwqHKB6lTAnABXUXBJfFT43H6DfeMGCVAynggQ',

};

// Congela el objeto para evitar modificaciones accidentales en tiempo de ejecución.
Object.freeze(APP_CONSTANTS);
