
// --- Inicio Beneficiarios Frecuentes ---
let savedBeneficiariesList = [];
let _editingBeneficiaryIndex = null; // null = modo agregar, number = modo editar

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
        <button type="button" onclick="editSavedBeneficiary(${index})" class="material-icons" style="background:transparent; border:none; cursor:pointer; padding:5px; color: var(--gold);" title="Editar destinatario">
          edit
        </button>
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
  // Intentar llenar el ID original y también las variantes con prefijos
  const prefixes = ['', 'manage-', 'send-'];
  let found = false;

  prefixes.forEach(pfx => {
    const el = document.getElementById(pfx + id);
    if (el) {
      if (el.tagName.toLowerCase() === 'select') {
        // Try strict match first
        let match = Array.from(el.options).find(opt => opt.value === value);
        if (!match && value) {
          // Try case-insensitive partial match
          match = Array.from(el.options).find(opt =>
            opt.value.toLowerCase().includes(String(value).toLowerCase()) ||
            String(value).toLowerCase().includes(opt.value.toLowerCase())
          );
        }
        if (match) {
          el.value = match.value;
        } else {
          // Fallback if no match
          el.value = (value === null || value === undefined) ? '' : value;
        }
      } else {
        el.value = (value === null || value === undefined) ? '' : value;
      }
      found = true;
    }
  });

  if (!found && id !== 'send-recipient-name' && id !== 'manage-recipient-name') {
    console.warn('[Beneficiary] Campo no encontrado (revisar IDs):', id);
  }
}

// Helper: show a brief visual toast for debug/confirmation
function _showFillToast(msg) {
  let toast = document.getElementById('_fill_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_fill_toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--gold);color:#000;padding:10px 20px;border-radius:20px;font-weight:700;font-size:0.85rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);transition:opacity 0.5s;';
    document.body.appendChild(toast);
  }
  const prefix = msg.includes('⚠️') ? '' : '✅ ';
  toast.textContent = prefix + msg;
  console.log('[Beneficiary Toast]', msg);
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

  // Fill the unified name fields in BOTH views
  _fillField('send-recipient-name', b.recipientName || b.name || '');
  _fillField('manage-recipient-name', b.recipientName || b.name || '');

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

      // selectVesType sets button styles AND clears ves-account — call it with false to preserve data
      if (typeof selectVesType === 'function') {
        selectVesType(vesType, 'manage', false);
        selectVesType(vesType, 'send', false);
      }


      _fillField('ves-id', vesId);
      const prefixElManage = document.getElementById('manage-ves-id-prefix');
      if (prefixElManage && vesIdPfx) prefixElManage.value = vesIdPfx;
      const prefixElSend = document.getElementById('send-ves-id-prefix');
      if (prefixElSend && vesIdPfx) prefixElSend.value = vesIdPfx;

      _fillField('ves-bank', vesBank);
      if (vesBank) {
        updateTransferLogo('ves', 'manage');
        updateTransferLogo('ves', 'send');
      }
      // Set account LAST — selectVesType() clears it
      _fillField('ves-account', vesAcct);

    } else if (destCode === 'COP') {
      const cd = b.copData || {};

      _fillField('cop-doc-type', cd.docType || 'CC');
      _fillField('cop-id', cd.id || '');
      _fillField('cop-bank', cd.bank || '');
      if (typeof toggleCopType === 'function') {
        toggleCopType('manage');
        toggleCopType('send');
      }
      if (cd.bank) {
        updateTransferLogo('cop', 'manage');
        updateTransferLogo('cop', 'send');
      }
      _fillField('cop-account', cd.account || '');

    } else if (destCode === 'PEN') {
      const pd = b.penData || {};

      _fillField('pen-method', pd.method || 'Yape');
      if (typeof togglePenType === 'function') {
        togglePenType('manage');
        togglePenType('send');
      }
      if (pd.method === 'Banco' && pd.bank) {
        _fillField('pen-bank', pd.bank);
        updateTransferLogo('pen', 'manage');
        updateTransferLogo('pen', 'send');
      }
      _fillField('pen-account', pd.account || '');

    } else if (destCode === 'USD') {
      const ud = b.usaData || {};

      _fillField('usa-zelle-type', ud.type || 'phone');
      if (typeof toggleUsaType === 'function') {
        toggleUsaType('manage');
        toggleUsaType('send');
      }
      _fillField('usa-zelle-data', ud.data || '');

    } else if (destCode === 'ECS') {
      const ed = b.ecsData || {};

      _fillField('ecs-id', ed.id || '');
      _fillField('ecs-bank', ed.bank || '');
      if (ed.bank) {
        updateTransferLogo('ecs', 'manage');
        updateTransferLogo('ecs', 'send');
      }
      _fillField('ecs-account', ed.account || '');

    } else if (destCode === 'CLP') {
      const ld = b.clpData || {};

      _fillField('clp-id', ld.id || '');
      _fillField('clp-bank', ld.bank || '');
      _fillField('clp-type', ld.type || '');
      if (ld.bank) {
        updateTransferLogo('clp', 'manage');
        updateTransferLogo('clp', 'send');
      }
      _fillField('clp-account', ld.account || '');

    } else {
      _fillField('send-recipient-name', b.recipientName || '');
      _fillField('manage-recipient-name', b.recipientName || '');
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

/**
 * Abre el formulario de destinatarios en modo edición pre-rellenando todos los campos.
 * Compatible con datos guardados en formato antiguo (plano) y nuevo (anidado).
 * @param {number} index - Índice del beneficiario en savedBeneficiariesList
 */
function editSavedBeneficiary(index) {
  const b = savedBeneficiariesList[index];
  if (!b) return;

  _editingBeneficiaryIndex = index;

  // Abrir panel y actualizar títulos
  const detailsEl = document.getElementById('add-new-recipient-container');
  if (detailsEl) detailsEl.open = true;
  const titleEl = document.getElementById('manage-form-title');
  if (titleEl) titleEl.textContent = 'Editar Destinatario';
  const iconEl = document.getElementById('manage-form-icon');
  if (iconEl) iconEl.textContent = 'edit';
  const saveBtn = document.getElementById('manage-save-btn');
  if (saveBtn) saveBtn.textContent = 'Actualizar Contacto';
  const cancelBtn = document.getElementById('manage-cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  // Resolver código de país — soporta formato nuevo (destCode) y antiguo (country/code)
  const rawCode = (b.destCode || b.country || b.code || 'VES').toUpperCase();
  // El select usa valores en minúsculas
  const countrySelectVal = rawCode === 'USD' ? 'usa' : rawCode.toLowerCase();

  const countrySelect = document.getElementById('manage-recipient-country');
  if (countrySelect) {
    countrySelect.value = countrySelectVal;
    // Dispara la lógica de mostrar/ocultar campos
    if (typeof toggleRecipientCountry === 'function') toggleRecipientCountry('manage');
  }

  // Rellenar nombre
  const nameField = document.getElementById('manage-recipient-name');
  if (nameField) nameField.value = b.recipientName || b.name || '';

  // --- Helper para leer valor soportando ambos formatos ---
  const _get = (nested, flatFallbacks) => {
    if (nested !== undefined && nested !== null) return nested;
    for (const k of flatFallbacks) {
      if (b[k] !== undefined && b[k] !== null) return b[k];
    }
    return '';
  };

  // Esperar a que toggleRecipientCountry haya renderizado los campos
  setTimeout(() => {
    if (rawCode === 'VES') {
      const d = b.vesData || {};
      const vesType = _get(d.type, ['type', 'vesType']);
      const vesIdPrefix = _get(d.idPrefix, ['idPrefix', 'id_prefix', 'prefix']);
      const vesId = _get(d.id, ['id']);
      const vesBank = _get(d.bank, ['bank']);
      const vesAccount = _get(d.account, ['account', 'phone']);

      if (typeof selectVesType === 'function') selectVesType(vesType || 'mobile', 'manage', false);
      const typeEl = document.getElementById('manage-ves-type');
      if (typeEl && vesType) typeEl.value = vesType;
      const prefixEl = document.getElementById('manage-ves-id-prefix');
      if (prefixEl && vesIdPrefix) prefixEl.value = vesIdPrefix;
      const idEl = document.getElementById('manage-ves-id');
      if (idEl) idEl.value = vesId || '';
      const bankEl = document.getElementById('manage-ves-bank');
      if (bankEl && vesBank) {
        bankEl.value = vesBank;
        // fuzzy fallback si no coincide exacto
        if (bankEl.value !== vesBank) {
          const opts = Array.from(bankEl.options);
          const match = opts.find(o => o.value.toLowerCase().includes(vesBank.toLowerCase()) || vesBank.toLowerCase().includes(o.value.toLowerCase()));
          if (match) bankEl.value = match.value;
        }
        if (typeof updateTransferLogo === 'function') updateTransferLogo('manage-ves', 'manage');
      }
      const accountEl = document.getElementById('manage-ves-account');
      if (accountEl) accountEl.value = vesAccount || '';

    } else if (rawCode === 'COP') {
      const d = b.copData || {};
      const _s = (nested, flat) => _get(nested, [flat]);
      const docTypeEl = document.getElementById('manage-cop-doc-type');
      if (docTypeEl) docTypeEl.value = _s(d.docType, 'docType') || 'CC';
      const idEl = document.getElementById('manage-cop-id');
      if (idEl) idEl.value = _s(d.id, 'id') || '';
      const bankEl = document.getElementById('manage-cop-bank');
      if (bankEl) bankEl.value = _s(d.bank, 'bank') || '';
      const accountEl = document.getElementById('manage-cop-account');
      if (accountEl) accountEl.value = _s(d.account, 'account') || '';

    } else if (rawCode === 'PEN') {
      const d = b.penData || {};
      const methodEl = document.getElementById('manage-pen-method');
      if (methodEl) methodEl.value = d.method || b.method || 'yape';
      const bankEl = document.getElementById('manage-pen-bank');
      if (bankEl) bankEl.value = d.bank || b.bank || '';
      const accountEl = document.getElementById('manage-pen-account');
      if (accountEl) accountEl.value = d.account || b.account || b.phone || '';

    } else if (rawCode === 'USD' || rawCode === 'USA') {
      const d = b.usaData || {};
      const typeEl = document.getElementById('manage-usa-zelle-type');
      if (typeEl) typeEl.value = d.type || b.type || 'email';
      const dataEl = document.getElementById('manage-usa-zelle-data');
      if (dataEl) dataEl.value = d.data || b.data || b.email || b.phone || '';

    } else if (rawCode === 'ECS') {
      const d = b.ecsData || {};
      const idEl = document.getElementById('manage-ecs-id');
      if (idEl) idEl.value = d.id || b.id || '';
      const bankEl = document.getElementById('manage-ecs-bank');
      if (bankEl) bankEl.value = d.bank || b.bank || '';
      const accountEl = document.getElementById('manage-ecs-account');
      if (accountEl) accountEl.value = d.account || b.account || '';

    } else if (rawCode === 'CLP') {
      const d = b.clpData || {};
      const idEl = document.getElementById('manage-clp-id');
      if (idEl) idEl.value = d.id || b.id || '';
      const bankEl = document.getElementById('manage-clp-bank');
      if (bankEl) bankEl.value = d.bank || b.bank || '';
      const typeEl = document.getElementById('manage-clp-type');
      if (typeEl) typeEl.value = d.type || b.type || 'Cuenta Vista';
      const accountEl = document.getElementById('manage-clp-account');
      if (accountEl) accountEl.value = d.account || b.account || '';
    }

    // Scroll al formulario
    detailsEl && detailsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

/**
 * Cancela el modo edición y restablece el formulario a modo 'Agregar'.
 */
function cancelEditBeneficiary() {
  _editingBeneficiaryIndex = null;
  const titleEl = document.getElementById('manage-form-title');
  if (titleEl) titleEl.textContent = 'Agregar Nuevo Destinatario';
  const iconEl = document.getElementById('manage-form-icon');
  if (iconEl) iconEl.textContent = 'person_add';
  const saveBtn = document.getElementById('manage-save-btn');
  if (saveBtn) saveBtn.textContent = 'Guardar y Usar';
  const cancelBtn = document.getElementById('manage-cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  // Cerrar y limpiar formulario
  const countryEl = document.getElementById('manage-recipient-country');
  if (countryEl) { countryEl.value = ''; }
  const nameEl = document.getElementById('manage-recipient-name');
  if (nameEl) nameEl.value = '';
  if (typeof toggleRecipientCountry === 'function') toggleRecipientCountry('manage');
  const detailsEl = document.getElementById('add-new-recipient-container');
  if (detailsEl) detailsEl.removeAttribute('open');
}

async function saveNewBeneficiaryFromView() {
  const countryCodeVal = document.getElementById('manage-recipient-country').value;
  if (!countryCodeVal) {
    _showFillToast('⚠️ Seleccione un país destino primero');
    return;
  }
  const countryCode = countryCodeVal.toUpperCase();

  let txName = document.getElementById('manage-recipient-name')?.value || '';

  if (!txName || txName.trim() === '') {
    _showFillToast('⚠️ Ingrese el nombre del destinatario');
    // Highlight the name field and focus it
    const nameField = document.getElementById('manage-recipient-name');
    if (nameField) {
      nameField.style.borderColor = 'var(--error)';
      nameField.style.boxShadow = '0 0 0 2px rgba(239,68,68,0.3)';
      nameField.focus();
      nameField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Remove highlight after 3 seconds
      setTimeout(() => {
        nameField.style.borderColor = '';
        nameField.style.boxShadow = '';
      }, 3000);
    }
    return;
  }

  if (countryCode === 'VES') {
    const vesType = document.getElementById('manage-ves-type').value;
    const vesAccountRaw = document.getElementById('manage-ves-account').value;
    const vesAccount = vesAccountRaw.replace(/[^0-9]/g, '');
    if (vesType === 'mobile' && vesAccount.length !== 11) {
      _showFillToast('⚠️ El número de Pago Móvil debe tener exactamente 11 dígitos');
      const accountField = document.getElementById('manage-ves-account');
      if (accountField) {
        accountField.style.borderColor = 'var(--error)';
        accountField.focus();
        setTimeout(() => accountField.style.borderColor = '', 3000);
      }
      return;
    }
    if (vesType === 'transfer' && vesAccount.length !== 20) {
      _showFillToast('⚠️ El número de cuenta debe tener exactamente 20 dígitos');
      const accountField = document.getElementById('manage-ves-account');
      if (accountField) {
        accountField.style.borderColor = 'var(--error)';
        accountField.focus();
        setTimeout(() => accountField.style.borderColor = '', 3000);
      }
      return;
    }
  }

  const submitBtn = document.getElementById('manage-save-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  const tx = {
    sender: '',
    name: txName,
  };

  if (countryCode === 'VES') {
    const vesAccountRaw = document.getElementById('manage-ves-account').value;
    tx.vesData = {
      type: document.getElementById('manage-ves-type').value,
      idPrefix: document.getElementById('manage-ves-id-prefix').value,
      id: document.getElementById('manage-ves-id').value,
      bank: document.getElementById('manage-ves-bank').value,
      account: vesAccountRaw.replace(/[^0-9]/g, '')
    };
  } else if (countryCode === 'COP') {
    tx.copData = {
      docType: document.getElementById('manage-cop-doc-type').value,
      id: document.getElementById('manage-cop-id').value,
      bank: document.getElementById('manage-cop-bank').value,
      account: document.getElementById('manage-cop-account').value
    };
  } else if (countryCode === 'PEN') {
    tx.penData = {
      method: document.getElementById('manage-pen-method').value,
      bank: document.getElementById('manage-pen-bank').value,
      account: document.getElementById('manage-pen-account').value
    };
  } else if (countryCode === 'USA') {
    tx.usaData = {
      type: document.getElementById('manage-usa-zelle-type').value,
      data: document.getElementById('manage-usa-zelle-data').value
    };
  } else if (countryCode === 'ECS') {
    tx.ecsData = {
      id: document.getElementById('manage-ecs-id').value,
      bank: document.getElementById('manage-ecs-bank').value,
      account: document.getElementById('manage-ecs-account').value
    };
  } else if (countryCode === 'CLP') {
    tx.clpData = {
      id: document.getElementById('manage-clp-id').value,
      bank: document.getElementById('manage-clp-bank').value,
      type: document.getElementById('manage-clp-type').value,
      account: document.getElementById('manage-clp-account').value
    };
  }

  const previousDest = destCountry;
  destCountry = { code: countryCode === 'USA' ? 'USD' : countryCode };

  const isEditing = _editingBeneficiaryIndex !== null;

  if (isEditing) {
    // Actualizar en la posición original en lugar de crear uno nuevo
    await updateBeneficiaryInProfile(tx, _editingBeneficiaryIndex);
  } else {
    await saveBeneficiaryToProfile(tx);
  }

  destCountry = previousDest;

  _showFillToast(isEditing ? '✅ Destinatario actualizado exitosamente' : '✅ Destinatario guardado exitosamente');

  // Resetear formulario
  document.getElementById('manage-recipient-country').value = '';
  document.getElementById('manage-recipient-name').value = '';
  if (typeof toggleRecipientCountry === 'function') {
    toggleRecipientCountry('manage');
  }

  const detailsEl = document.getElementById('add-new-recipient-container');
  if (detailsEl) {
    detailsEl.removeAttribute('open');
  }

  // Resetear estado y UI del botón
  cancelEditBeneficiary();
  if (submitBtn) {
    submitBtn.disabled = false;
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
/**
 * Actualiza un beneficiario existente en la posición dada sin cambiar el orden de la lista.
 * Reemplaza todos los campos con los nuevos datos en formato actualizado.
 * @param {Object} tx - Objeto de transacción con los nuevos datos.
 * @param {number} index - Índice en savedBeneficiariesList a reemplazar.
 */
async function updateBeneficiaryInProfile(tx, index) {
  if (!user || typeof db === 'undefined') return;
  if (index === null || index === undefined || index < 0) return;

  const updatedBeneficiary = {
    senderName: tx.sender || '',
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

  // Reemplazar en la posición original, conservando el orden
  const updatedList = [...savedBeneficiariesList];
  updatedList[index] = updatedBeneficiary;

  try {
    await db.collection('users').doc(user.uid).set({
      beneficiaries: updatedList
    }, { merge: true });
    savedBeneficiariesList = updatedList;
    renderBeneficiariesDropdown();
  } catch (err) {
    console.error('Error actualizando beneficiario:', err);
    _showFillToast('❌ Error al actualizar. Intenta de nuevo.');
  }
}
// --- Fin Beneficiarios Frecuentes ---

