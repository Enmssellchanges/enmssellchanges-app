// --- Inicio Beneficiarios Frecuentes ---
let savedBeneficiariesList = [];

async function loadUserBeneficiaries() {
  if (!user || typeof db === 'undefined') return;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().beneficiaries) {
      savedBeneficiariesList = doc.data().beneficiaries;
      renderBeneficiariesDropdown();
    }
  } catch (err) {
    console.error("Error cargando beneficiarios:", err);
  }
}

function renderBeneficiariesDropdown() {
  const container = document.getElementById('saved-beneficiaries-container');
  const select = document.getElementById('saved-beneficiaries-select');
  const actions = document.getElementById('beneficiary-actions');
  if (!container || !select) return;

  if (savedBeneficiariesList.length === 0) {
    container.style.display = 'block';
    select.innerHTML = '<option value="">No tienes destinatarios guardados aún</option>';
    select.disabled = true;
    if (actions) actions.innerHTML = '';
    return;
  }

  let optionsHtml = '<option value="">Selecciona un destinatario frecuente...</option>';
  savedBeneficiariesList.forEach((b, index) => {
    const destName = b.recipientName || 'Sin Nombre';
    optionsHtml += `<option value="${index}">${destName}</option>`;
  });
  select.innerHTML = optionsHtml;
  select.disabled = false;
  container.style.display = 'block';

  // Inject delete button + confirmation panel directly — no dynamic show/hide needed
  if (actions) {
    actions.innerHTML = `
      <div style="display:flex; gap:0.5rem; margin-top:0.4rem;">
        <button type="button" id="btn-delete-beneficiary" onclick="deleteSavedBeneficiary()"
          style="padding:0.5rem 0.8rem; border-radius:10px; border:1.5px solid var(--error);
                 background:rgba(239,68,68,0.1); color:var(--error); cursor:pointer;
                 font-size:0.78rem; font-weight:700; display:flex; align-items:center; gap:4px; transition:all 0.2s;">
          <span class="material-icons" style="font-size:15px;">delete</span> Eliminar seleccionado
        </button>
      </div>
      <div id="delete-beneficiary-confirm"
        style="display:none; margin-top:0.6rem; background:rgba(239,68,68,0.1);
               border:1px solid var(--error); border-radius:10px; padding:0.6rem 0.8rem;
               font-size:0.8rem; color:var(--error);">
        <strong id="delete-beneficiary-name"></strong> será eliminado permanentemente. ¿Confirmar?
        <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
          <button type="button" onclick="confirmDeleteBeneficiary()"
            style="flex:1; padding:0.5rem; border-radius:8px; border:none;
                   background:var(--error); color:white; font-weight:700; font-size:0.78rem; cursor:pointer;">
            ✓ Sí, eliminar
          </button>
          <button type="button" onclick="cancelDeleteBeneficiary()"
            style="flex:1; padding:0.5rem; border-radius:8px; border:1px solid rgba(255,255,255,0.2);
                   background:transparent; color:var(--text-muted); font-weight:700; font-size:0.78rem; cursor:pointer;">
            Cancelar
          </button>
        </div>
      </div>`;
  }
}

// Show confirmation panel — reads currently selected option from dropdown
function deleteSavedBeneficiary() {
  const select = document.getElementById('saved-beneficiaries-select');
  const index = select.value;
  if (index === '') {
    _showFillToast('⚠️ Selecciona un destinatario primero');
    return;
  }
  const b = savedBeneficiariesList[index];
  if (!b) return;
  const nameEl = document.getElementById('delete-beneficiary-name');
  if (nameEl) nameEl.textContent = b.recipientName || 'el destinatario';
  const panel = document.getElementById('delete-beneficiary-confirm');
  if (panel) panel.style.display = 'block';
}

// Cancel deletion
function cancelDeleteBeneficiary() {
  const panel = document.getElementById('delete-beneficiary-confirm');
  if (panel) panel.style.display = 'none';
}

// Confirm and execute deletion from Firestore + local list
async function confirmDeleteBeneficiary() {
  const select = document.getElementById('saved-beneficiaries-select');
  const index = parseInt(select.value);
  if (isNaN(index)) return;
  const b = savedBeneficiariesList[index];
  const name = b ? (b.recipientName || 'el destinatario') : 'el destinatario';

  savedBeneficiariesList.splice(index, 1);

  try {
    if (user && typeof db !== 'undefined') {
      await db.collection('users').doc(user.uid).set(
        { beneficiaries: savedBeneficiariesList },
        { merge: true }
      );
    }
  } catch (err) {
    console.error('Error eliminando beneficiario:', err);
  }

  renderBeneficiariesDropdown();
  _showFillToast('🗑️ ' + name + ' eliminado');
}

// Helper: safely set a value on an element by ID, with logging
function _fillField(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('[Beneficiary] Campo no encontrado:', id);
    return;
  }
  if (value === null || value === undefined || value === '') {
    console.warn('[Beneficiary] Valor vacío para campo:', id);
    return;
  }
  el.value = value;

}

// Helper: show a brief visual toast for debug/confirmation
function _showFillToast(name) {
  let toast = document.getElementById('_fill_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_fill_toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--gold);color:#000;padding:10px 20px;border-radius:20px;font-weight:700;font-size:0.85rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:opacity 0.5s;';
    document.body.appendChild(toast);
  }
  toast.textContent = '✅ Datos de ' + name + ' cargados';
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function loadSavedBeneficiary() {
  const select = document.getElementById('saved-beneficiaries-select');
  const index = select.value;
  if (index === '') return;
  const b = savedBeneficiariesList[index];
  if (!b) return;

  // Set sender name (only if user hasn't manually typed something)
  if (b.senderName) {
    const senderField = document.getElementById('sender-name');
    if (senderField && !senderField.dataset.userEdited) {
      senderField.value = b.senderName;
    }
  }

  // Set destination country — ALWAYS use AppConfig.countries (live rates from Firestore)
  // NEVER use the stale global `countries` array (has default rate=0.05, not the live rate!)
  const destCode = b.destCode || 'VES';
  if (destCountry.code !== destCode) {
    // Only reassign if we're actually changing country
    const liveCountries = (window.AppConfig && window.AppConfig.countries) ? window.AppConfig.countries : countries;
    const targetCountry = liveCountries.find(c => c.code === destCode);
    if (targetCountry) {
      destCountry = targetCountry;
      updateCountryUI('dest', destCountry);
    }
  }
  // calculate() shows/hides per-country fields — call it and then fill after it finishes
  calculate();

  // Wait for calculate() to show the correct country form fields, then fill them in
  setTimeout(() => {

    if (destCode === 'VES') {
      // Support BOTH old format (fields at top level) AND new format (nested in vesData)
      const vd = b.vesData || {};
      // Old format stored keys directly on `b`: b.id, b.bank, b.account, b.phone, b.type
      const vesType = vd.type || b.type || 'mobile';
      const vesId = vd.id || b.id || '';
      const vesBank = vd.bank || b.bank || '';
      const vesAcct = vd.account || b.account || b.phone || '';
      const vesIdPfx = vd.idPrefix || b.idPrefix || '';

      // selectVesType sets button styles AND clears ves-account — call it first
      if (typeof selectVesType === 'function') selectVesType(vesType);

      _fillField('ves-name', b.recipientName || b.name || '');
      _fillField('ves-id', vesId);
      const prefixEl = document.getElementById('ves-id-prefix');
      if (prefixEl && vesIdPfx) prefixEl.value = vesIdPfx;
      _fillField('ves-bank', vesBank);
      if (vesBank) updateTransferLogo('ves');
      // Set account LAST — selectVesType() clears it
      _fillField('ves-account', vesAcct);

    } else if (destCode === 'COP') {
      const cd = b.copData || {};
      _fillField('cop-name', b.recipientName || '');
      _fillField('cop-doc-type', cd.docType || 'CC');
      _fillField('cop-id', cd.id || '');
      _fillField('cop-bank', cd.bank || '');
      if (typeof toggleCopType === 'function') toggleCopType();
      if (cd.bank) updateTransferLogo('cop');
      _fillField('cop-account', cd.account || '');

    } else if (destCode === 'PEN') {
      const pd = b.penData || {};
      _fillField('pen-name', b.recipientName || '');
      _fillField('pen-method', pd.method || 'Yape');
      if (typeof togglePenType === 'function') togglePenType();
      if (pd.method === 'Banco' && pd.bank) {
        _fillField('pen-bank', pd.bank);
        updateTransferLogo('pen');
      }
      _fillField('pen-account', pd.account || '');

    } else if (destCode === 'USD') {
      const ud = b.usaData || {};
      _fillField('usa-name', b.recipientName || '');
      _fillField('usa-zelle-type', ud.type || 'phone');
      if (typeof toggleUsaType === 'function') toggleUsaType();
      _fillField('usa-zelle-data', ud.data || '');

    } else if (destCode === 'ECS') {
      const ed = b.ecsData || {};
      _fillField('ecs-name', b.recipientName || '');
      _fillField('ecs-id', ed.id || '');
      _fillField('ecs-bank', ed.bank || '');
      if (ed.bank) updateTransferLogo('ecs');
      _fillField('ecs-account', ed.account || '');

    } else if (destCode === 'CLP') {
      const ld = b.clpData || {};
      _fillField('clp-name', b.recipientName || '');
      _fillField('clp-id', ld.id || '');
      _fillField('clp-bank', ld.bank || '');
      _fillField('clp-type', ld.type || '');
      if (ld.bank) updateTransferLogo('clp');
      _fillField('clp-account', ld.account || '');

    } else {
      _fillField('recipient-name', b.recipientName || '');
    }

    _showFillToast(b.recipientName || 'destinatario');
  }, 300);
}

async function saveBeneficiaryToProfile(tx) {
  if (!user || typeof db === 'undefined') return;

  // Create new beneficiary record
  const newBeneficiary = {
    senderName: tx.sender,
    recipientName: tx.name,
    destCode: destCountry ? destCountry.code : 'VES',
    vesData: tx.vesData || null,
    copData: tx.copData || null,
    penData: tx.penData || null,
    usaData: tx.usaData || null,
    ecsData: tx.ecsData || null,
    clpData: tx.clpData || null,
    timestamp: new Date().getTime()
  };

  // Filter out identical existing paths to avoid exact duplicates
  const filteredList = savedBeneficiariesList.filter(b => {
    // Simple comparison ignoring timestamp
    return !(b.recipientName === newBeneficiary.recipientName && b.destCode === newBeneficiary.destCode && b.senderName === newBeneficiary.senderName);
  });
  filteredList.unshift(newBeneficiary); // add to top
  // Limit to 30 saved beneficiaries tops
  if (filteredList.length > 30) {
    filteredList.pop();
  }
  try {
    await db.collection('users').doc(user.uid).set({
      beneficiaries: filteredList
    }, {
      merge: true
    });
    savedBeneficiariesList = filteredList;
    renderBeneficiariesDropdown();
  } catch (err) {
    console.error("Error saving beneficiary:", err);
  }
}
// --- Fin Beneficiarios Frecuentes ---

