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
  ADMIN_SCRIPT_VERSION: '10.4',

  // ── Contacto / Soporte ──────────────────────────────────────────────────────
  // Número de WhatsApp con prefijo de país (sin espacios ni guiones).
  WHATSAPP_NUMBER: '56950628724',

  // ── Notificaciones Push (Firebase Cloud Messaging) ──────────────────────────
  // Clave pública VAPID generada en la consola de Firebase > Cloud Messaging.
  FCM_VAPID_KEY: 'BB9P-4noUBBoTSK5T8NbqhsNhP_6tHZVOq7a9vY_RZQItqeP-pwqHKB6lTAnABXUXBJfFT43H6DfeMGCVAynggQ',

  // ── Firebase Configuration ──────────────────────────────────────────────────
  // Configuración pública del proyecto. Restringir la API key por dominio
  // en Google Cloud Console > APIs & Services > Credentials.
  FIREBASE_CONFIG: {
    projectId: 'enmssellchanges-premium',
    appId: '1:591347469322:web:aadf4993968d3cbf57e3f3',
    storageBucket: 'enmssellchanges-premium.firebasestorage.app',
    apiKey: 'AIzaSyDjZnv2KSnmpiptFzkMceHz1r08-WeVBZs',
    authDomain: 'enmssellchanges-premium.firebaseapp.com',
    messagingSenderId: '591347469322',
    measurementId: 'G-1VV3QWHZ20'
  },

  // ── Mapa de divisas → países (fallback para display) ────────────────────────
  // Usado como fallback en ui.js getCountryName() cuando country.name no existe.
  COUNTRY_NAME_MAP: {
    'CLP': 'Chile',
    'VES': 'Venezuela',
    'COP': 'Colombia',
    'PEN': 'Perú',
    'USD': 'USA',
    'ECS': 'Ecuador'
  },

};

// Congela el objeto para evitar modificaciones accidentales en tiempo de ejecución.
Object.freeze(APP_CONSTANTS);
