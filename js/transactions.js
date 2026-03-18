/**
 * Filters the user's transaction history based on the search query and date range.
 * Triggers a re-render of the transactions list with the filtered results.
 */
function filterTransactions() {
  const list = document.getElementById('transaction-list');
  if (!list) return;
  const query = document.getElementById('user-history-search').value.toLowerCase();
  const startDate = document.getElementById('user-history-date-start').value;
  const endDate = document.getElementById('user-history-date-end').value;
  const filtered = userTransactions.filter(tx => {
    const matchesQuery = !query || tx.id.toLowerCase().includes(query) || tx.name.toLowerCase().includes(query) || tx.sender && tx.sender.toLowerCase().includes(query) || tx.amount && tx.amount.toString().toLowerCase().includes(query);
    let matchesDate = true;
    if (startDate || endDate) {
      const txDate = new Date(tx.timestamp?.toMillis ? tx.timestamp.toMillis() : tx.timestamp || tx.date);
      if (startDate && txDate < new Date(startDate + 'T00:00:00')) matchesDate = false;
      if (endDate && txDate > new Date(endDate + 'T23:59:59')) matchesDate = false;
    }
    return matchesQuery && matchesDate;
  });
  renderTransactionsList(filtered);
}

/**
 * Groups an array of transactions by their date.
 * Replaces today's and yesterday's dates with 'Hoy' and 'Ayer' respectively.
 *
 * @param {Array} transactions - The list of transaction objects to group.
 * @returns {Object} An object where keys are date strings and values are arrays of transactions.
 */
function groupTransactionsByDate(transactions) {
  const groups = {};
  const today = new Date().toLocaleDateString('es-ES');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('es-ES');
  transactions.forEach(tx => {
    const dateStr = new Date(tx.timestamp?.toMillis ? tx.timestamp.toMillis() : (tx.timestamp || tx.date)).toLocaleDateString('es-ES');
    let label = dateStr;
    if (dateStr === today) label = 'Hoy'; else if (dateStr === yesterday) label = 'Ayer';
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  return groups;
}

/**
 * Renders the list of transactions grouped by date in the UI.
 *
 * @param {Array} transactions - The list of transaction objects to render.
 */
function renderTransactionsList(transactions) {
  const list = document.getElementById('transaction-list');
  if (!list) return;
  if (!transactions.length) {
    list.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No se encontraron transacciones con los filtros aplicados.</p>`;
    return;
  }
  const groups = groupTransactionsByDate(transactions);
  list.innerHTML = Object.entries(groups).map(([date, txs]) => `
        <div class="date-group-header" style="color: var(--gold); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 1.5rem 0 0.8rem; display: flex; align-items: center; gap: 10px;">
            <span>${date}</span>
            <div style="flex: 1; h: 1px; background: linear-gradient(90deg, var(--glass-border), transparent); height: 1px;"></div>
        </div>
        ${txs.map(tx => {
    let statusLabel = 'Pendiente';
    if (tx.status === 'completed') statusLabel = 'Completado';
    if (tx.status === 'rejected') statusLabel = 'Rechazado';
    if (tx.status === 'expired') statusLabel = 'Expirado';
    let destSummary = '';
    if (tx.vesData) {
      destSummary = `${tx.vesData.bank} | C.I ${tx.vesData.id}`;
      if (tx.bcvUsd) destSummary += ` <br><span style="color: var(--gold); font-size: 0.75rem;">Equiv. BCV: $${tx.bcvUsd} USD</span>`;
    } else if (tx.copData) destSummary = `${tx.copData.bank} | ${tx.copData.id}`; else if (tx.clpData) destSummary = `${tx.clpData.bank} | ${tx.clpData.id}`; else if (tx.usaData) destSummary = `Zelle | ${tx.usaData.data}`;
    return `
                <div class="transaction-card glass" style="${tx.status === 'rejected' ? 'border-left: 4px solid var(--error);' : ''}; margin-bottom: 1rem; padding: 1.2rem; align-items: flex-start;">
                    <div class="recipient-info" style="flex: 1;">
                        <div class="avatar" style="${tx.status === 'rejected' ? 'background: var(--error);' : ''}">${tx.initials || '??'}</div>
                        <div>
                            <strong style="font-size: 1rem; color: white;">${tx.name}</strong><br>
                            <small style="color: var(--text-muted);">${new Date(tx.timestamp?.toMillis ? tx.timestamp.toMillis() : (tx.timestamp || tx.date)).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })}</small>
                            ${destSummary ? `<br><small style="color:var(--accent-teal); font-weight: 500;">${destSummary}</small>` : ''}
                            ${tx.status === 'rejected' ? `<br><small style="color: var(--error); opacity: 0.9;">Motivo: ${tx.reason || 'S/M'}</small>` : ''}
                            <br><small style="color: var(--text-muted); font-family: monospace; font-size: 0.7rem;">ID: ${tx.id}</small>
                            
                            <div style="margin-top: 0.8rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                <button class="btn-signin" style="font-size: 0.65rem; padding: 4px 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 4px;" onclick="toggleReceiptPreview('history-${tx.id}')">
                                    <span class="material-icons" style="font-size: 14px;">visibility</span> Ver Mi Pago
                                </button>
                                <button class="btn-signin" style="font-size: 0.65rem; padding: 4px 8px; border-color: var(--gold); color: var(--gold); display: flex; align-items: center; gap: 4px;" onclick="downloadProofById('img-history-${tx.id}', 'mi_comprobante_${tx.id}.png')">
                                    <span class="material-icons" style="font-size: 14px;">download</span>
                                </button>
                                ${(tx.status === 'completed' || tx.status === 'rejected') && tx.adminProof ? `
                                <button class="btn-signin" style="font-size: 0.65rem; padding: 4px 8px; background: ${tx.status === 'completed' ? 'var(--success)' : 'var(--error)'}; border: none; display: flex; align-items: center; gap: 4px; color: white;" onclick="toggleReceiptPreview('adminproof-hist-${tx.id}')">
                                    <span class="material-icons" style="font-size: 14px;">visibility</span> Respuesta
                                </button>
                                <button class="btn-signin" style="font-size: 0.65rem; padding: 4px 8px; border-color: ${tx.status === 'completed' ? 'var(--success)' : 'var(--error)'}; color: ${tx.status === 'completed' ? 'var(--success)' : 'var(--error)'}; display: flex; align-items: center; gap: 4px;" onclick="downloadProofById('img-adminproof-hist-${tx.id}', 'respuesta_enmsell_${tx.id}.png')">
                                    <span class="material-icons" style="font-size: 14px;">download</span>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <strong style="display: block; color: var(--gold); font-size: 1.1rem;">${tx.amount}</strong>
                        <div class="status-badge status-${tx.status}" style="font-size: 0.65rem; padding: 4px 10px;">${statusLabel}</div>
                    </div>
                    <!-- Previews -->
                    <div id="preview-history-${tx.id}" style="display: none; width: 100%; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                        <p style="font-size: 0.7rem; color: var(--gold); margin-bottom: 0.5rem;">Tu Comprobante:</p>
                        ${tx.proof ? `<img id="img-history-${tx.id}" src="${tx.proof}" style="width: 100%; border-radius: 12px; border: 1px solid var(--gold);">` : '<p style="font-size: 0.7rem; color: var(--text-muted);">Sin comprobante.</p>'}
                    </div>
                    ${(tx.status === 'completed' || tx.status === 'rejected') && tx.adminProof ? `
                    <div id="preview-adminproof-hist-${tx.id}" style="display: none; width: 100%; margin-top: 1rem; border-top: 1px solid ${tx.status === 'completed' ? 'var(--success)' : 'var(--error)'}; padding-top: 1rem;">
                        <p style="font-size: 0.7rem; color: ${tx.status === 'completed' ? 'var(--success)' : 'var(--error)'}; margin-bottom: 0.5rem;">${tx.status === 'completed' ? 'Comprobante de Enmsell:' : 'Comprobante de Rechazo:'}</p>
                        <img id="img-adminproof-hist-${tx.id}" src="${tx.adminProof}" style="width: 100%; border-radius: 12px; border: 1px solid ${tx.status === 'completed' ? 'var(--success)' : 'var(--error)'};">
                    </div>
                    ` : ''}
                </div>`;
  }).join('')}
    `).join('');
}

// Quick Logic Home

/**
 * Handles the selection of an image file for payment proof, compresses it,
 * and sets it up for preview and upload.
 *
 * @param {Event} event - The file input change event.
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      // Compress image to ensure it stays within Firestore limits (<1MB)
      const compressed = await compressImage(e.target.result);
      selectedProofBase64 = compressed;
      const preview = document.getElementById('proof-preview');
      const container = document.getElementById('proof-preview-container');
      if (preview) preview.src = compressed;
      if (container) container.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

// --- Inicio Beneficiarios Frecuentes ---

// --- Fin Beneficiarios Frecuentes ---

/**
 * Collects data from the transfer form, validates it, creates a new transfer record,
 * registers it in Firestore, uploads the payment proof to Storage,
 * and triggers relevant notifications.
 */
async function simulateTransfer() {
  if (!user) {
    openLogin();
    return;
  }
  const amountInput = document.getElementById('send-amount');
  const amount = parseFloat(amountInput ? amountInput.value : 0);
  const sender = document.getElementById('sender-name').value;
  let recipient = "";
  let vesData = null,
    copData = null,
    penData = null,
    usaData = null,
    ecsData = null,
    clpData = null;
  if (destCountry.code === 'VES') {
    const vName = document.getElementById('ves-name').value;
    const vId = document.getElementById('ves-id').value;
    const vBank = document.getElementById('ves-bank').value;
    const vAccount = document.getElementById('ves-account').value;
    const vType = document.getElementById('ves-type').value;
    if (!vName || !vId || !vBank || !vAccount || !sender) {
      alert("Completa todos los datos de transferencia para Venezuela (Nombre, Cédula, Banco y Cuenta/Teléfono)");
      return;
    }
    if (vType === 'mobile' && vAccount.length !== 11) {
      alert("El número de teléfono para Pago Móvil debe tener exactamente 11 dígitos (Ej: 04123456789)");
      return;
    }
    if (vType === 'transfer' && vAccount.length !== 20) {
      alert("El número de cuenta bancaria en Venezuela debe tener exactamente 20 dígitos");
      return;
    }
    recipient = vName;
    vesData = {
      id: vId,
      idPrefix: document.getElementById('ves-id-prefix')?.value || 'V',
      bank: vBank,
      account: vAccount,
      type: vType
    };
  } else if (destCountry.code === 'COP') {
    const cName = document.getElementById('cop-name').value;
    const cDocType = document.getElementById('cop-doc-type').value;
    const cId = document.getElementById('cop-id').value;
    const cBank = document.getElementById('cop-bank').value;
    const cAccount = document.getElementById('cop-account').value;
    if (!cName || !cId || !cBank || !cAccount || !sender) {
      alert("Completa todos los datos de transferencia para Colombia");
      return;
    }
    recipient = cName;
    copData = {
      docType: cDocType,
      id: cId,
      bank: cBank,
      account: cAccount
    };
  } else if (destCountry.code === 'PEN') {
    const pName = document.getElementById('pen-name').value;
    const pMethod = document.getElementById('pen-method').value;
    const pBank = document.getElementById('pen-bank').value;
    const pAccount = document.getElementById('pen-account').value;
    if (!pName || !pAccount || !sender) {
      alert("Completa todos los datos de transferencia para Perú");
      return;
    }
    recipient = pName;
    penData = {
      method: pMethod,
      bank: pMethod === 'Banco' ? pBank : null,
      account: pAccount
    };
  } else if (destCountry.code === 'USD') {
    const uName = document.getElementById('usa-name').value;
    const uType = document.getElementById('usa-zelle-type').value;
    const uData = document.getElementById('usa-zelle-data').value;
    if (!uName || !uData || !sender) {
      alert("Completa todos los campos para el envío a USA");
      return;
    }
    if (uType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(uData)) {
        alert("Por favor ingresa un correo electrónico válido para Zelle");
        return;
      }
    } else {
      if (uData.length < 10) {
        alert("Por favor ingresa un número de teléfono válido para Zelle");
        return;
      }
    }
    recipient = uName;
    usaData = {
      type: uType,
      data: uData
    };
  } else if (destCountry.code === 'ECS') {
    const eName = document.getElementById('ecs-name').value;
    const eId = document.getElementById('ecs-id').value;
    const eBank = document.getElementById('ecs-bank').value;
    const eAccount = document.getElementById('ecs-account').value;
    if (!eName || !eId || !eBank || !eAccount || !sender) {
      alert("Completa todos los datos de transferencia para Ecuador");
      return;
    }
    recipient = eName;
    ecsData = {
      id: eId,
      bank: eBank,
      account: eAccount
    };
  } else if (destCountry.code === 'CLP') {
    const cName = document.getElementById('clp-name').value;
    const cId = document.getElementById('clp-id').value;
    const cBank = document.getElementById('clp-bank').value;
    const cType = document.getElementById('clp-type').value;
    const cAccount = document.getElementById('clp-account').value;
    if (!cName || !cId || !cBank || !cAccount || !cType || !sender) {
      alert("Completa todos los datos de transferencia para Chile");
      return;
    }
    recipient = cName;
    clpData = {
      id: cId,
      bank: cBank,
      type: cType,
      account: cAccount
    };
  } else {
    recipient = document.getElementById('recipient-name').value;
    if (!recipient || !sender) {
      alert("Completa todos los campos (Remitente y Destinatario)");
      return;
    }
  }
  if (!amount) {
    alert("Ingresa un monto válido");
    return;
  }
  if (!selectedProofBase64) {
    alert("Por favor adjunta la foto del comprobante de pago");
    return;
  }

  // Validation for minimum amounts
  let minVal = 0;
  if (sourceCountry.code === 'CLP') {
    minVal = destCountry.minCLP || 0;
  } else if (sourceCountry.code === 'VES') {
    minVal = Math.ceil(20 * AppConfig.bcvNumeric);
  }
  if (amount < minVal) {
    alert(`El monto mínimo de envío es ${minVal.toLocaleString()} ${sourceCountry.code}(equivalente a 20 USD).`);
    return;
  }
  const txNote = document.getElementById('tx-note')?.value || '';
  const tx = {
    name: recipient,
    sender: sender,
    note: txNote,
    vesData: vesData,
    copData: copData,
    penData: penData,
    usaData: usaData,
    ecsData: ecsData,
    clpData: clpData,
    date: new Date().toLocaleDateString('es-ES'),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    amount: `${document.getElementById('receive-amount').value} ${destCountry.code}`,
    sourceAmount: `${amount.toLocaleString()} ${sourceCountry.code}`,
    status: 'pending',
    initials: recipient.substring(0, 2).toUpperCase(),
    proof: "",
    // Will be filled with URL
    userEmail: user.email,
    userId: user.uid
  };

  // Include 6% gain record for Admin
  if (sourceCountry.code === 'VES' && destCountry.code === 'CLP') {
    tx.adminGain = amount / sourceCountry.rate * 0.06; // Gain in CLP
  }

  // Include BCV data for Venezuela
  if (destCountry.code === 'VES') {
    const bcvInput = document.getElementById('ves-usd-input');
    if (bcvInput) {
      tx.bcvUsd = bcvInput.value;
      tx.bcvRate = AppConfig.bcvRate;
    }
  }
  if (typeof db !== 'undefined') {
    const btnConfirm = document.getElementById('btn-confirm-send');
    if (btnConfirm) btnConfirm.innerText = "Subiendo Comprobante...";
    try {
      // 1. Upload receipt to Storage
      const proofUrl = await uploadBase64ToStorage(selectedProofBase64, `receipts/${user.uid}_${Date.now()}.jpg`);
      tx.proof = proofUrl;
      if (btnConfirm) btnConfirm.innerText = "Registrando envío...";

      // 2. Add to Firestore
      const docRef = await db.collection('transfers').add(tx);
      tx.id = docRef.id;
      currentTransfer = tx;

      // Save beneficiary if checkbox is checked
      const saveBtn = document.getElementById('save-beneficiary');
      if (saveBtn && saveBtn.checked) {
        await saveBeneficiaryToProfile(tx);
      }

      // Trigger Admin Notifications
      sendAdminEmail(tx);
      sendTelegramAdmin(tx);
      sendUserNotification(tx, 'Procesando');

      // Reset UI
      selectedProofBase64 = null;
      document.getElementById('proof-preview-container').style.display = 'none';
      document.getElementById('payment-proof').value = '';
      const dropSelect = document.getElementById('saved-beneficiaries-select');
      if (dropSelect) dropSelect.value = '';
      const saveBtnClear = document.getElementById('save-beneficiary');
      if (saveBtnClear) saveBtnClear.checked = false;
      const fieldsToClear = ['ves-name', 'ves-id', 'ves-bank', 'ves-account', 'cop-name', 'cop-id', 'cop-account', 'pen-name', 'pen-account', 'usa-name', 'usa-zelle-data', 'ecs-name', 'ecs-id', 'ecs-account', 'clp-name', 'clp-id', 'clp-account', 'clp-email', 'recipient-name', 'tx-note'];
      fieldsToClear.forEach(f => {
        const el = document.getElementById(f);
        if (el) el.value = '';
      });
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.innerText = "Confirmar Envío";
      }
      alert("¡Envío solicitado con éxito! El administrador revisará tu comprobante en breve.");
      showView('tracking');
    } catch (err) {
      console.error("Critical Error in Transfer:", err);
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.innerText = "Confirmar Envío";
      }
      let userMsg = "Error al completar la transacción. Por favor intenta de nuevo.";
      if (err.message.includes("large") || err.message.includes("size")) userMsg = "Error: El comprobante es demasiado pesado.";
      if (err.message.includes("permission")) userMsg = "Error de permisos. Intenta cerrar sesión y volver a entrar.";
      alert(userMsg + "\nDetalles: " + err.message);
    }
  } else {
    alert("Error: Base de datos no conectada.");
  }
}

/**
 * Subscribes to the user's transaction history in Firestore.
 * Triggers a render of the transactions list upon updates.
 */
function loadTransactions() {
  if (!user || typeof db === 'undefined') return;
  db.collection('transfers').where('userId', '==', user.uid).onSnapshot(snapshot => {
    let txs = [];
    snapshot.forEach(doc => txs.push({
      id: doc.id,
      ...doc.data()
    }));

    // Client-side sort to bypass index requirement
    txs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
    renderTransactionsList(txs);
  }, err => {
    console.error("User History Error:", err);
    // Index required alert handled in updateTrackingUI
  });
}

// Spreadsheet Logic
// Push Notifications Logic

/**
 * Toggles the visibility of a receipt preview container.
 * Smoothly scrolls into view if being opened.
 *
 * @param {string} id - The suffix of the element ID to toggle.
 */
function toggleReceiptPreview(id) {
  const preview = document.getElementById(`preview-${id}`);
  if (!preview) return;
  if (preview.style.display === 'none') {
    preview.style.display = 'block';
    preview.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  } else {
    preview.style.display = 'none';
  }
}

// Helper to download images from DOM id
/**
 * Downloads an image from a given DOM element ID.
 *
 * @param {string} imgId - The ID of the image element.
 * @param {string} filename - The target file name for the download.
 */
async function downloadProofById(imgId, filename) {
  const imgElement = document.getElementById(imgId);
  if (!imgElement || !imgElement.src) {
    alert("Comprobante no disponible en la vista previa.");
    return;
  }
  const proofData = imgElement.src;
  downloadProof(proofData, filename);
}

// Helper to download images (Base64 or URL)
/**
 * Downloads an image given its base64 data or URL.
 *
 * @param {string} proofData - The Base64 encoded string or the URL of the image.
 * @param {string} filename - The target file name for the download.
 */
async function downloadProof(proofData, filename) {
  if (!proofData || proofData === 'undefined') {
    alert("Comprobante no disponible.");
    return;
  }

  // Handle Base64
  if (proofData.startsWith('data:')) {
    try {
      const parts = proofData.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      const blob = new Blob([uInt8Array], {
        type: contentType
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error("Error downloading base64 proof:", e);
      const a = document.createElement('a');
      a.href = proofData;
      a.download = filename;
      a.click();
    }
  }
  // Handle URL
  else {
    try {
      const response = await fetch(proofData);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      console.error("Error downloading URL proof:", e);
      window.open(proofData, '_blank');
    }
  }
}

