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
  const listContainer = document.getElementById('saved-beneficiaries-list');
  const sendSelect = document.getElementById('send-view-recipient-select');

  if (savedBeneficiariesList.length === 0) {
    if (listContainer) {
      listContainer.innerHTML = '<div class="text-muted text-center p-md">No tienes destinatarios guardados aún.</div>';
    }
    if (sendSelect) {
      // NUNCA deshabilitar el select, permitir siempre ir a gestionar/agregar
      sendSelect.innerHTML = `
        <option value="">(Sin destinatarios guardados)</option>
        <option value="manage" style="color: var(--gold); font-weight: bold;">➕ Gestionar / Agregar Nuevo...</option>
      `;
      sendSelect.disabled = false;
    }
    return;
  }

  let optionsHtml = '<option value="">Selecciona un destinatario frecuente...</option>';
  let listHtml = '';

  savedBeneficiariesList.forEach((b, index) => {
    const destName = b.recipientName || 'Sin Nombre';
    const destCode = b.destCode || 'VES';
    optionsHtml += `<option value="${index}">${destName} (${destCode})</option>`;
    
    listHtml += `
      <div class="glass p-sm flex-between" style="border-radius:10px; align-items:center;">
        <div style="cursor:pointer; flex: 1; display:flex; flex-direction:column;" onclick="handleSelectBeneficiaryFromList(${index})">
          <strong class="text-teal">${destName}</strong>
          <small class="text-muted">País: ${destCode}</small>
        </div>
        <button type="button" onclick="deleteSavedBeneficiary(${index})" class="material-icons text-error" style="background:transparent; border:none; cursor:pointer; padding:5px;" title="Eliminar destinatario">
          delete
        </button>
      </div>
    `;
  });

  if (listContainer) {
    listContainer.innerHTML = listHtml;
  }

  if (sendSelect) {
    // Añadir opción de gestión al final por si acaso
    sendSelect.innerHTML = optionsHtml + '<option value="manage" style="font-weight: 700; color: var(--gold);">➕ Agregar / Gestionar Destinatario...</option>';
    sendSelect.disabled = false;
    console.log("[Beneficiaries] Selector de envío actualizado con", savedBeneficiariesList.length, "opciones.");
  }
}

/**
 * Maneja el cambio en el selector de destinatarios de la vista Enviar.
 * Si se elige "manage", redirige a la vista de destinatarios.
 * Si se elige un índice, carga los datos del beneficiario.
 */
function handleSendRecipientSelect(val) {
  if (val === 'manage') {
    showView('destinatarios');
    // Si la vista destinatarios tiene el formulario plegable, podrías abrirlo:
    const details = document.getElementById('add-new-recipient-container');
    if (details) details.open = true;
    
    // Reset select to placeholder
    document.getElementById('send-view-recipient-select').value = "";
    return;
  }
  
  if (val !== "") {
    loadSavedBeneficiary(val);
  }
}

async function deleteSavedBeneficiary(index) {
  const b = savedBeneficiariesList[index];
  if (!b) return;
  const name = b.recipientName || 'el destinatario';
  
  if (confirm(`¿Estás seguro de que deseas eliminar a ${name} permanentemente?`)) {
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

function loadSavedBeneficiary(providedIndex) {
  let index = providedIndex;
  if (index === undefined || index === null) {
    const select = document.getElementById('send-view-recipient-select');
    if (!select) return;
    index = select.value;
  }
  if (index === '') return;
  const b = savedBeneficiariesList[index];
  if (!b) return;

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

    // Si se cargó el destinatario, asegurar que en la vista "Enviar" se refleje la selección también
    const sendSelect = document.getElementById('send-view-recipient-select');
    if (sendSelect && sendSelect.value !== index) {
      sendSelect.value = index;
    }

    _showFillToast(b.recipientName || 'destinatario');
  }, 300);
}



function handleSelectBeneficiaryFromList(index) {
  // Update select view for send
  const sendSelect = document.getElementById('send-view-recipient-select');
  if (sendSelect) {
    sendSelect.value = index;
  }
  
  // Actually load the form fields
  loadSavedBeneficiary(index);
  
  // Transition logic
  if (typeof showView === 'function') {
    showView('send');
  }
}

async function saveNewBeneficiaryFromView() {
  const countryCodeVal = document.getElementById('new-recipient-country').value;
  if (!countryCodeVal) {
    _showFillToast('⚠️ Seleccione un país destino primero');
    return;
  }
  const countryCode = countryCodeVal.toUpperCase();
  
  const txName = document.getElementById('recipient-name') ? document.getElementById('recipient-name').value : '';
  if (!txName || txName.trim() === '') {
     _showFillToast('⚠️ Ingrese el nombre del destinatario');
     return;
  }
  
  const submitBtn = event ? event.target : null;
  if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Guardando...';
  }

  const tx = {
    sender: '',
    name: txName,
  };
  
  if(countryCode === 'VES') {
      tx.vesData = {
          type: document.getElementById('ves-type').value,
          idPrefix: document.getElementById('ves-id-prefix').value,
          id: document.getElementById('ves-id').value,
          bank: document.getElementById('ves-bank').value,
          account: document.getElementById('ves-account').value
      };
  } else if (countryCode === 'COP') {
      tx.copData = {
          docType: document.getElementById('cop-doc-type').value,
          id: document.getElementById('cop-id').value,
          bank: document.getElementById('cop-bank').value,
          account: document.getElementById('cop-account').value
      };
  } else if (countryCode === 'PEN') {
      tx.penData = {
          method: document.getElementById('pen-method').value,
          bank: document.getElementById('pen-bank').value,
          account: document.getElementById('pen-account').value
      };
  } else if (countryCode === 'USA') {
      tx.usaData = {
          type: document.getElementById('usa-zelle-type').value,
          data: document.getElementById('usa-zelle-data').value
      };
  } else if (countryCode === 'ECS') {
      tx.ecsData = {
          id: document.getElementById('ecs-id').value,
          bank: document.getElementById('ecs-bank').value,
          account: document.getElementById('ecs-account').value
      };
  } else if (countryCode === 'CLP') {
      tx.clpData = {
          id: document.getElementById('clp-id').value,
          bank: document.getElementById('clp-bank').value,
          type: document.getElementById('clp-type').value,
          account: document.getElementById('clp-account').value
      };
  }
  
  // mock for saving logic
  const previousDest = destCountry;
  destCountry = { code: countryCode };
  await saveBeneficiaryToProfile(tx);
  destCountry = previousDest;
  
  _showFillToast('✅ Destinatario guardado exitosamente');
  document.getElementById('new-recipient-country').value = '';
  document.getElementById('recipient-name').value = '';
  if (typeof toggleRecipientCountry === 'function') {
      toggleRecipientCountry();
  }

  const detailsEl = document.getElementById('add-new-recipient-container');
  if (detailsEl) {
      detailsEl.removeAttribute('open');
  }
  
  if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar y Usar';
  }
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

