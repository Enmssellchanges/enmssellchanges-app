/**
 * @file calculator.js
 * @description Lógica de cálculo de montos y tasas de cambio.
 *   - Debouncing para evitar cálculos en cada pulsación de tecla
 *   - Cálculo normal (send / receive) para el widget home y el formulario de envío
 *   - Cálculo inverso (reverse) cuando el usuario edita el campo destino
 *   - Cálculo de equivalencia BCV y Monitor para Venezuela
 *   - Renderizado de tarjetas de tasas en la vista Home
 *   - Selector de país (modal)
 */

// ── Debouncers ───────────────────────────────────────────────────────────────
// Prevé cálculos redundantes mientras el usuario escribe.
// Prevents the UI from recalculating on every single keystroke.
let calcTimeout = null;

window.debouncedCalculate = function (reverse = false) {
  if (calcTimeout) clearTimeout(calcTimeout);
  calcTimeout = setTimeout(() => {
    if (typeof calculate === 'function') calculate(reverse);
  }, 300);
};

let quickCalcTimeout = null;

window.debouncedCalculateQuick = function (reverse = false) {
  if (quickCalcTimeout) clearTimeout(quickCalcTimeout);
  quickCalcTimeout = setTimeout(() => {
    if (typeof calculateQuick === 'function') calculateQuick(reverse);
  }, 300);
};

let bcvCalcTimeout = null;
let monitorCalcTimeout = null;

window.debouncedCalculateBCVSend = function () {
  if (bcvCalcTimeout) clearTimeout(bcvCalcTimeout);
  bcvCalcTimeout = setTimeout(() => {
    if (typeof calculateBCVSend === 'function') calculateBCVSend();
  }, 300);
};

window.debouncedCalculateMonitorSend = function () {
  if (monitorCalcTimeout) clearTimeout(monitorCalcTimeout);
  monitorCalcTimeout = setTimeout(() => {
    if (typeof calculateMonitorSend === 'function') calculateMonitorSend();
  }, 300);
};

let quickBcvCalcTimeout = null;
let quickMonitorCalcTimeout = null;

window.debouncedCalculateBCVQuick = function () {
  if (quickBcvCalcTimeout) clearTimeout(quickBcvCalcTimeout);
  quickBcvCalcTimeout = setTimeout(() => {
    if (typeof calculateBCVQuick === 'function') calculateBCVQuick();
  }, 300);
};

window.debouncedCalculateMonitorQuick = function () {
  if (quickMonitorCalcTimeout) clearTimeout(quickMonitorCalcTimeout);
  quickMonitorCalcTimeout = setTimeout(() => {
    if (typeof calculateMonitorQuick === 'function') calculateMonitorQuick();
  }, 300);
};

// ── Cálculos ─────────────────────────────────────────────────────────────────

/**
 * Calcula el monto a recibir (o a enviar) en el widget rápido de la página Home.
 * Actualiza la etiqueta de mínimo, el estado del botón y el equivalente BCV/Monitor.
 *
 * @param {boolean} [reverse=false] - Si true, calcula el monto de origen a partir del destino.
 */
function calculateQuick(reverse = false) {
  const sendInput = document.getElementById('quick-send-amount');
  const receiveInput = document.getElementById('quick-receive-amount');
  const minLabel = document.getElementById('quick-min-label');
  const rateText = document.getElementById('quick-rate');
  if (!sendInput || !receiveInput) return;
  let sRate = quickSourceCountry.code === 'CLP' ? 1.0 : quickSourceCountry.rate;
  let dRate = quickDestCountry.code === 'CLP' ? 1.0 : quickDestCountry.rate;
  let rate = dRate / sRate;

  // Apply 6% fee if sending from Venezuela to Chile
  if (quickSourceCountry.code === 'VES' && quickDestCountry.code === 'CLP') {
    rate *= 0.94;
  }
  if (reverse) {
    const val = parseFloat(receiveInput.value) || 0;
    sendInput.value = Math.ceil(val / rate);
  } else {
    const val = parseFloat(sendInput.value) || 0;
    receiveInput.value = Math.floor(val * rate);
  }

  // Update Label
  let minVal = 0;
  if (quickSourceCountry.code === 'CLP') {
    minVal = quickDestCountry.minCLP || 0;
    if (minLabel) minLabel.innerText = `Mínimo: $${minVal.toLocaleString()} CLP`;
  } else if (quickSourceCountry.code === 'VES') {
    minVal = Math.ceil(20 * AppConfig.bcvNumeric);
    if (minLabel) minLabel.innerText = `Mínimo: Bs.${minVal.toLocaleString()}(20 USD)`;
  } else {
    if (minLabel) minLabel.innerText = "Tasa Preferencial";
  }

  // Visual Warning & Button State
  const val = parseFloat(sendInput.value) || 0;
  const isTooLow = val > 0 && val < minVal || val <= 0;
  if (val > 0 && val < minVal) {
    if (minLabel) minLabel.style.color = 'var(--error)';
    sendInput.style.color = 'var(--error)';
  } else {
    if (minLabel) minLabel.style.color = 'var(--text-muted)';
    sendInput.style.color = 'white';
  }
  const quickBtn = document.getElementById('btn-quick-send');
  if (quickBtn) quickBtn.disabled = isTooLow;
  let decQ = (quickDestCountry.code === 'USD' || quickDestCountry.code === 'ECS' || quickSourceCountry.code === 'USD' || quickSourceCountry.code === 'ECS') ? 7 : 6;
  if (rateText) rateText.innerText = `1 ${getCountryLabel(quickSourceCountry)} = ${rate.toFixed(decQ)} ${getCountryLabel(quickDestCountry)}`;

  // Quick BCV Equivalency
  const quickBcvInfo = document.getElementById('quick-ves-bcv-info');
  const quickMonitorInfo = document.getElementById('quick-ves-monitor-info');
  const isVesInvolved = quickDestCountry.code === 'VES' || quickSourceCountry.code === 'VES';
  if (isVesInvolved) {
    if (quickBcvInfo) quickBcvInfo.style.display = 'flex';
    if (quickMonitorInfo) quickMonitorInfo.style.display = 'flex';
    const vesAmount = quickSourceCountry.code === 'VES' ? parseFloat(sendInput.value) || 0 : parseFloat(receiveInput.value) || 0;

    // BCV
    const usdEquiv = (vesAmount / AppConfig.bcvNumeric).toFixed(2);
    const usdInput = document.getElementById('quick-ves-usd-input');
    const formulaDisplay = document.getElementById('quick-ves-bcv-formula');
    if (usdInput && document.activeElement !== usdInput) {
      usdInput.value = usdEquiv;
    }
    const bcvDisp = document.getElementById('bcv-rate-display');
    if (bcvDisp) bcvDisp.innerText = AppConfig.bcvRate + " Bs / USD";
    if (formulaDisplay) formulaDisplay.innerText = `Cálculo: Bs.${vesAmount.toLocaleString()} / ${AppConfig.bcvRate}`;

    // Monitor
    if (AppConfig.monitorNumeric > 0) {
      const monitorEquiv = (vesAmount / AppConfig.monitorNumeric).toFixed(2);
      const monitorUsdInput = document.getElementById('quick-ves-monitor-input');
      const monitorFormula = document.getElementById('quick-ves-monitor-formula');
      if (monitorUsdInput && document.activeElement !== monitorUsdInput) {
        monitorUsdInput.value = monitorEquiv;
      }
      const monitorDisp = document.getElementById('monitor-rate-display');
      if (monitorDisp) monitorDisp.innerText = AppConfig.monitorRate + " Bs / USD";
      if (monitorFormula) monitorFormula.innerText = `Cálculo: Bs.${vesAmount.toLocaleString()} / ${AppConfig.monitorRate}`;
    }

  } else {
    if (quickBcvInfo) quickBcvInfo.style.display = 'none';
    if (quickMonitorInfo) quickMonitorInfo.style.display = 'none';
  }
}

/**
 * Calcula el monto a recibir (o a enviar) en el formulario de envío (vista Send).
 * También gestiona la visibilidad de los campos específicos por país destino
 * (VES, COP, PEN, USD, ECS, CLP) y el equivalente BCV/Monitor.
 *
 * @param {boolean} [reverse=false] - Si true, calcula el monto de origen a partir del destino.
 */
function calculate(reverse = false) {
  const sendInput = document.getElementById('send-amount');
  const receiveInput = document.getElementById('receive-amount');
  const minLabel = document.getElementById('min-label');
  const rateText = document.getElementById('current-rate');
  if (!sendInput || !receiveInput) return;
  let sRate = sourceCountry.code === 'CLP' ? 1.0 : sourceCountry.rate;
  let dRate = destCountry.code === 'CLP' ? 1.0 : destCountry.rate;
  let rate = dRate / sRate;

  // Apply 6% fee if sending from Venezuela to Chile
  if (sourceCountry.code === 'VES' && destCountry.code === 'CLP') {
    rate *= 0.94;
  }
  if (reverse) {
    const val = parseFloat(receiveInput.value) || 0;
    sendInput.value = Math.ceil(val / rate);
  } else {
    const val = parseFloat(sendInput.value) || 0;
    receiveInput.value = Math.floor(val * rate);
  }

  // Update Label
  let minVal = 0;
  if (sourceCountry.code === 'CLP') {
    minVal = destCountry.minCLP || 0;
    if (minLabel) minLabel.innerText = `Mínimo: $${minVal.toLocaleString()} ${getCountryLabel(sourceCountry)}`;
  } else if (sourceCountry.code === 'VES') {
    minVal = Math.ceil(20 * AppConfig.bcvNumeric);
    if (minLabel) minLabel.innerText = `Mínimo: Bs.${minVal.toLocaleString()}(20 USD)`;
  } else {
    if (minLabel) minLabel.innerText = "Tasa Preferencial";
  }

  // Visual Warning & Button State
  const val = parseFloat(sendInput.value) || 0;
  const isTooLow = val > 0 && val < minVal || val <= 0;
  if (val > 0 && val < minVal) {
    if (minLabel) minLabel.style.color = 'var(--error)';
    sendInput.style.color = 'var(--error)';
  } else {
    if (minLabel) minLabel.style.color = 'var(--text-muted)';
    sendInput.style.color = 'white';
  }
  let dec = (destCountry.code === 'USD' || destCountry.code === 'ECS' || sourceCountry.code === 'USD' || sourceCountry.code === 'ECS') ? 8 : 6;
  if (rateText) rateText.innerText = `1 ${sourceCountry.code} = ${rate.toFixed(dec)} ${destCountry.code}`;
  const confirmBtn = document.getElementById('btn-confirm-send');
  if (confirmBtn) confirmBtn.disabled = isTooLow;

  // Toggle Venezuela/Colombia/Peru/USA/Ecuador Fields
  const vesFields = document.getElementById('send-ves-fields');
  const copFields = document.getElementById('send-cop-fields');
  const penFields = document.getElementById('send-pen-fields');
  const usaFields = document.getElementById('send-usa-fields');
  const ecsFields = document.getElementById('send-ecs-fields');
  const clpFields = document.getElementById('send-clp-fields');

  // Hide all first
  if (vesFields) vesFields.style.display = 'none';
  if (copFields) copFields.style.display = 'none';
  if (penFields) penFields.style.display = 'none';
  if (usaFields) usaFields.style.display = 'none';
  if (ecsFields) ecsFields.style.display = 'none';
  if (clpFields) clpFields.style.display = 'none';

  if (destCountry.code === 'VES') {
    if (vesFields) vesFields.style.display = 'grid';
  } else if (destCountry.code === 'COP') {
    if (copFields) copFields.style.display = 'grid';
  } else if (destCountry.code === 'PEN') {
    if (penFields) penFields.style.display = 'grid';
  } else if (destCountry.code === 'USD') {
    if (usaFields) usaFields.style.display = 'grid';
  } else if (destCountry.code === 'ECS') {
    if (ecsFields) ecsFields.style.display = 'grid';
  } else if (destCountry.code === 'CLP') {
    if (clpFields) clpFields.style.display = 'grid';
  }
  renderUserAccounts();
  const countryCodes = ['VES', 'COP', 'PEN', 'USD', 'ECS', 'CLP'];
  countryCodes.forEach(code => {
    if (destCountry.code === code) updateTransferLogo(code.toLowerCase());
  });
  let decS = (destCountry.code === 'USD' || destCountry.code === 'ECS' || sourceCountry.code === 'USD' || sourceCountry.code === 'ECS') ? 7 : 6;
  if (rateText) rateText.innerText = `1 ${getCountryLabel(sourceCountry)} = ${rate.toFixed(decS)} ${getCountryLabel(destCountry)}`;

  // BCV Equivalency for Venezuela
  const vesBcvInfo = document.getElementById('ves-bcv-info');
  const vesMonitorInfo = document.getElementById('ves-monitor-info');
  const isVesInvolvedForm = destCountry.code === 'VES' || sourceCountry.code === 'VES';
  if (isVesInvolvedForm) {
    if (vesBcvInfo) vesBcvInfo.style.display = 'flex';
    if (vesMonitorInfo) vesMonitorInfo.style.display = 'flex';
    const vesAmount = sourceCountry.code === 'VES' ? parseFloat(sendInput.value) || 0 : parseFloat(receiveInput.value) || 0;

    // BCV
    const usdEquiv = (vesAmount / AppConfig.bcvNumeric).toFixed(2);
    const usdInput = document.getElementById('ves-usd-input');
    const rateSmall = document.getElementById('ves-bcv-rate-small');
    const formulaDisplay = document.getElementById('ves-bcv-formula');
    if (usdInput && document.activeElement !== usdInput) {
      usdInput.value = usdEquiv;
    }
    if (rateSmall) rateSmall.innerText = `Tasa: ${AppConfig.bcvRate}`;
    if (formulaDisplay) formulaDisplay.innerText = `Cálculo: Bs.${vesAmount.toLocaleString()} / ${AppConfig.bcvRate}`;

    // Monitor
    if (AppConfig.monitorNumeric > 0) {
      const monitorUsdEquiv = (vesAmount / AppConfig.monitorNumeric).toFixed(2);
      const monitorUsdInput = document.getElementById('ves-monitor-usd-input');
      const monitorRateSmall = document.getElementById('ves-monitor-rate-small');
      const monitorFormulaDisplay = document.getElementById('ves-monitor-formula');
      if (monitorUsdInput && document.activeElement !== monitorUsdInput) {
        monitorUsdInput.value = monitorUsdEquiv;
      }
      if (monitorRateSmall) monitorRateSmall.innerText = `Tasa: ${AppConfig.monitorRate}`;
      if (monitorFormulaDisplay) monitorFormulaDisplay.innerText = `Cálculo: Bs.${vesAmount.toLocaleString()} / ${AppConfig.monitorRate}`;
    }

  } else {
    if (vesBcvInfo) vesBcvInfo.style.display = 'none';
    if (vesMonitorInfo) vesMonitorInfo.style.display = 'none';
  }
}

/**
 * Actualiza el campo de monto de VES según el valor en USD (BCV) en el widget Home.
 * Llama a `calculateQuick` para recalcular el monto CLP resultante.
 */
function calculateBCVQuick() {
  const bcvDisp = document.getElementById('bcv-rate-display');
  const quickVesBcvInfo = document.getElementById('quick-ves-bcv-info');
  const quickVesUsdInput = document.getElementById('quick-ves-usd-input');
  const sendInput = document.getElementById('quick-send-amount');
  const receiveInput = document.getElementById('quick-receive-amount');
  if (!quickVesUsdInput || !sendInput || !receiveInput) return;
  if (bcvDisp) bcvDisp.innerText = AppConfig.bcvRate + " Bs/USD";
  const usdVal = parseFloat(quickVesUsdInput.value) || 0;
  const vesVal = Math.floor(usdVal * AppConfig.bcvNumeric);
  if (quickSourceCountry.code === 'VES') {
    sendInput.value = vesVal;
    calculateQuick(false); // Calculate CLP from VES (VES is source)
  } else {
    receiveInput.value = vesVal;
    calculateQuick(true); // Calculate CLP from VES (VES is dest)
  }
}

/**
 * Actualiza el campo de monto de VES según el valor en USD (BCV) en el formulario de envío.
 * Llama a `calculate` para recalcular el monto CLP resultante.
 */
function calculateBCVSend() {
  const usdInput = document.getElementById('ves-usd-input');
  const sendInput = document.getElementById('send-amount');
  const receiveInput = document.getElementById('receive-amount');
  if (!usdInput || !sendInput || !receiveInput) return;
  const usdVal = parseFloat(usdInput.value) || 0;
  const vesVal = Math.floor(usdVal * AppConfig.bcvNumeric);
  if (sourceCountry.code === 'VES') {
    sendInput.value = vesVal;
    calculate(false);
  } else {
    receiveInput.value = vesVal;
    calculate(true);
  }
}

/**
 * Actualiza el monto de VES según el valor en USD (Dólar Paralelo) en el widget Home.
 * Llama a `calculateQuick` para recalcular el monto CLP resultante.
 */
function calculateMonitorQuick() {
  const monitorDisp = document.getElementById('monitor-rate-display');
  const quickVesMonitorInput = document.getElementById('quick-ves-monitor-input');
  const sendInput = document.getElementById('quick-send-amount');
  const receiveInput = document.getElementById('quick-receive-amount');
  if (!quickVesMonitorInput || !sendInput || !receiveInput) return;
  if (monitorDisp) monitorDisp.innerText = AppConfig.monitorRate + " Bs / USD";
  const usdVal = parseFloat(quickVesMonitorInput.value) || 0;
  const vesVal = Math.floor(usdVal * AppConfig.monitorNumeric);
  if (quickSourceCountry.code === 'VES') {
    sendInput.value = vesVal;
    calculateQuick(false); // Calculate CLP from VES (VES is source)
  } else {
    receiveInput.value = vesVal;
    calculateQuick(true); // Calculate CLP from VES (VES is dest)
  }
}

/**
 * Actualiza el monto de VES según el valor en USD (Dólar Paralelo) en el formulario de envío.
 * Llama a `calculate` para recalcular el monto CLP resultante.
 */
function calculateMonitorSend() {
  const usdInput = document.getElementById('ves-monitor-usd-input');
  const sendInput = document.getElementById('send-amount');
  const receiveInput = document.getElementById('receive-amount');
  if (!usdInput || !sendInput || !receiveInput) return;
  const usdVal = parseFloat(usdInput.value) || 0;
  const vesVal = Math.floor(usdVal * AppConfig.monitorNumeric);
  if (sourceCountry.code === 'VES') {
    sendInput.value = vesVal;
    calculate(false);
  } else {
    receiveInput.value = vesVal;
    calculate(true);
  }
}

/**
 * Renderiza las tarjetas de tasas del día en la cuadrícula de la vista Home.
 * Lee los países desde `AppConfig.countries` (excluyendo CLP).
 */
function renderHomeRates() {
  const grid = document.getElementById('home-rates-grid');
  if (!grid) return;
  grid.innerHTML = AppConfig.countries.slice(1).map(c => `
    <div class="home-rate-card glass">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.8rem;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <img src="${c.flag}" style="width: 20px; height: 14px; border-radius: 2px; box-shadow: 0 0 5px rgba(0,0,0,0.5);">
                    <div style="font-weight: 700; font-size: 0.9rem; color: white;">${getCountryLabel(c)}</div>
                </div>
                ${c.code === 'USD' ? '<span class="status-badge" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-violet); padding: 2px 6px; font-size: 0.6rem;">Zelle</span>' : ''}
            </div>
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--gold); letter-spacing: -0.5px;">
                ${(() => {
      let dec = 2; // default
      if (c.code === 'VES') dec = 4;
      else if (c.code === 'COP') dec = 3;
      else if (c.code === 'PEN' || c.code === 'USD' || c.code === 'ECS') dec = 5;
      return c.rate.toLocaleString('es-CL', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
      });
    })()}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem;">
                <span style="font-size: 0.7rem; color: var(--text-muted);">Mínimo: $${(c.minCLP || 0).toLocaleString('es-CL')} CLP</span>
                <span class="material-icons" style="font-size: 14px; color: var(--text-muted); opacity: 0.5;">trending_up</span>
            </div>
        </div >
    `).join('');
}

/**
 * Actualiza el texto que muestra la tasa oficial BCV en el widget Home.
 */
function renderBCV() {
  const el = document.getElementById('bcv-rate-display');
  if (el) el.innerText = `${AppConfig.bcvRate} Bs / USD`;
}

/**
 * Actualiza el texto que muestra la tasa del Dólar Paralelo (Monitor) en el widget Home.
 */
function renderMonitor() {
  const el = document.getElementById('monitor-rate-display');
  if (el) el.innerText = `${AppConfig.monitorRate} Bs / USD`;
}

let activePicker = 'source';

/**
 * Abre el modal de selección de país filtrando las opciones disponibles
 * según el picker que lo invocó (source, dest, quick-source, quick-dest).
 *
 * @param {'source'|'dest'|'quick-source'|'quick-dest'} pickerType - Identificador del selector activo.
 */
function toggleCountryList(pickerType) {
  activePicker = pickerType;
  const list = document.getElementById('country-list');
  let filtered = [];
  if (pickerType === 'source' || pickerType === 'quick-source') {
    filtered = AppConfig.countries.filter(c => c.code === 'CLP' || c.code === 'VES');
  } else {
    const curSource = pickerType === 'dest' || pickerType === 'source' ? sourceCountry : quickSourceCountry;
    if (curSource.code === 'VES') {
      filtered = AppConfig.countries.filter(c => c.code === 'CLP');
    } else {
      filtered = AppConfig.countries.filter(c => c.code !== 'CLP');
    }
  }
  list.innerHTML = filtered.map(c => `
  <div class="country-item" onclick="selectCountry('${c.code}')">
    <img src="${c.flag}" width="30">
    <div>
      <div style="font-weight: 600;">${c.name}</div>
      <div style="font-size: 0.8rem; color: var(--text-muted);">${c.code}</div>
    </div>
  </div>
    `).join('');
  document.getElementById('country-modal').style.display = 'flex';
}

/**
 * Actualiza la bandera y el código de moneda en el selector visual de la UI.
 *
 * @param {string} prefix - Prefijo del elemento (ej: 'source', 'dest', 'quick-source', 'quick-dest').
 * @param {Object} c - Objeto país con propiedades { flag, code, name }.
 */
function updateCountryUI(prefix, c) {
  const flag = document.getElementById(`${prefix}-flag`);
  const codeText = document.getElementById(`${prefix}-code`);
  if (flag) flag.src = c.flag;
  if (codeText) codeText.innerText = c.code;
}

/**
 * Selecciona un país desde el modal y actualiza el estado y la UI del picker activo.
 * Aplica reglas de restricción (VES solo puede ir a/desde CLP).
 *
 * @param {string} code - Código ISO de moneda del país seleccionado (ej: 'CLP', 'VES').
 */
function selectCountry(code) {
  const country = AppConfig.countries.find(c => c.code === code);
  if (!country) return;
  if (activePicker === 'source') {
    sourceCountry = country;
    if (sourceCountry.code === 'VES' && destCountry.code !== 'CLP') {
      destCountry = AppConfig.countries.find(c => c.code === 'CLP');
      updateCountryUI('dest', destCountry);
    } else if (sourceCountry.code === 'CLP' && destCountry.code === 'CLP') {
      destCountry = AppConfig.countries.find(c => c.code === 'VES') || AppConfig.countries[2]; // Default to VES
      updateCountryUI('dest', destCountry);
    }
    updateCountryUI('source', sourceCountry);
    calculate();
  } else if (activePicker === 'dest') {
    destCountry = country;
    updateCountryUI('dest', destCountry);
    calculate();
  } else if (activePicker === 'quick-source') {
    quickSourceCountry = country;
    if (quickSourceCountry.code === 'VES' && quickDestCountry.code !== 'CLP') {
      quickDestCountry = AppConfig.countries.find(c => c.code === 'CLP');
      updateCountryUI('quick-dest', quickDestCountry);
    } else if (quickSourceCountry.code === 'CLP' && quickDestCountry.code === 'CLP') {
      quickDestCountry = AppConfig.countries.find(c => c.code === 'VES') || AppConfig.countries[2]; // Default to VES
      updateCountryUI('quick-dest', quickDestCountry);
    }
    updateCountryUI('quick-source', quickSourceCountry);
    calculateQuick();
  } else if (activePicker === 'quick-dest') {
    quickDestCountry = country;
    updateCountryUI('quick-dest', quickDestCountry);
    calculateQuick();
  }
  document.getElementById('country-modal').style.display = 'none';
}

