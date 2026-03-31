function loadAdminData() {

    showToast("🕒 ACTUALIZANDO", "Obteniendo datos de la nube...");
    fetchBinanceP2P(); // Refresh rates too
    if (typeof fetchMonitorRate === 'function') fetchMonitorRate(); // Refresh monitor too
    const pendingList = document.getElementById('admin-pending-list');
    const historyList = document.getElementById('admin-history-list');
    if (typeof db === 'undefined') return;

    if (typeof loadPromoData === 'function') {
        loadPromoData();
    }

    // Clear existing listeners to avoid leaks/duplicates
    if (adminPendingUnsubscribe) adminPendingUnsubscribe();
    if (adminHistoryUnsubscribe) adminHistoryUnsubscribe();

    // Fetch Pending
    if (pendingList) {
        adminPendingUnsubscribe = db.collection('transfers').where('status', '==', 'pending').onSnapshot(snapshot => {
            let pending = [];
            snapshot.forEach(doc => pending.push({ id: doc.id, ...doc.data() }));

            pendingList.innerHTML = pending.length ? pending.map(tx => `
                <div class="transaction-card glass" style="flex-direction: column; align-items: stretch; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                        <div class="recipient-info" style="flex: 1; min-width: 250px;">
                            <div class="avatar">${tx.initials || '??'}</div>
                            <div>
                                <strong>${tx.name}</strong> - Recibe: ${tx.amount}${tx.bcvUsd ? ` <br><small style="color:var(--gold);">Equiv. BCV: $${tx.bcvUsd} USD</small>` : ''}<br>
                                <small style="color:var(--text-muted);">Enviado: ${tx.sourceAmount || 'CLP'}${tx.adminGain ? ` | Ganancia: $${Math.round(tx.adminGain).toLocaleString()} CLP` : ''}</small><br>
                                <small>Remitente: ${tx.sender}</small><br>
                                <small style="color:var(--gold); font-family: monospace;">Usuario: ${tx.userEmail || 'N/A'}</small>
                                <button class="btn-signin" style="font-size: 0.65rem; padding: 2px 6px; margin-left: 8px; border-color: var(--accent-teal); color: var(--accent-teal);" onclick="viewUserHistory('${tx.userEmail || ''}')">Ver Historial</button>
                                ${tx.note ? `<div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(255,193,7,0.1); border-left: 3px solid #ffc107; font-size: 0.8rem; border-radius: 4px;"><strong>Nota:</strong> ${tx.note}</div>` : ''}

                                 <div style="margin-top: 1rem; display: flex; gap: 0.8rem;">
                                     <button class="btn-signin" style="font-size: 0.7rem; padding: 6px 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; gap: 4px;" onclick="toggleReceiptPreview('admin-${tx.id}')">
                                         <span class="material-icons" style="font-size: 16px;">visibility</span> Vista Previa
                                     </button>
                                     <button class="btn-signin" style="font-size: 0.7rem; padding: 6px 12px; border-color: var(--gold); color: var(--gold); display: flex; align-items: center; gap: 4px;" onclick="downloadProofById('img-admin-${tx.id}', 'recibo_${tx.sender.replace(/\s+/g, '_')}_pending.png')">
                                         <span class="material-icons" style="font-size: 16px;">download</span> Descargar
                                     </button>
                                 </div>
                             </div>
                         </div>
                         <div style="flex: 1.5; min-width: 250px; background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                             <div style="font-size: 0.75rem; font-weight: 800; color: var(--accent-teal); margin-bottom: 0.8rem; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 0.5rem;">
                                 <span class="material-icons" style="font-size: 16px;">account_balance</span> Datos del Destinatario
                             </div>
                              ${tx.vesData ? renderAccountData({ ...tx.vesData, name: tx.name }) : ''}
                              ${tx.copData ? renderAccountData({ ...tx.copData, name: tx.name }) : ''}
                              ${tx.penData ? renderAccountData({ ...tx.penData, name: tx.name }) : ''}
                              ${tx.usaData ? renderAccountData({ ...tx.usaData, name: tx.name, bank: 'Zelle' }) : ''}
                              ${tx.ecsData ? renderAccountData({ ...tx.ecsData, name: tx.name }) : ''}
                              ${tx.clpData ? renderAccountData({ ...tx.clpData, name: tx.name }) : ''}
                         </div>
                         <div style="display: flex; gap: 0.5rem; align-items: center;">
                             <button class="btn-primary" style="width: auto; padding: 0.5rem 1rem;" onclick="authorizeTx('${tx.id}')">Autorizar</button>
                             <button class="btn-primary" style="width: auto; padding: 0.5rem 1rem; background: var(--error);" onclick="openRejectModal('${tx.id}')">Rechazar</button>
                         </div>
                     </div>
                    <!-- Inline Preview Container -->
                    <div id="preview-admin-${tx.id}" style="display: none; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                        <img id="img-admin-${tx.id}" src="${tx.proof}" style="width: 100%; border-radius: 12px; border: 1px solid var(--gold); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    </div>
                </div>
            `).join('') : '<p style="color: var(--text-muted);">Sin pagos pendientes.</p>';
        });
    }

    // Fetch History (Completed/Rejected)
    if (historyList) {
        adminHistoryUnsubscribe = db.collection('transfers').where('status', 'in', ['completed', 'rejected', 'expired'])
            .onSnapshot(snapshot => {
                adminHistoryData = [];
                snapshot.forEach(doc => adminHistoryData.push({ id: doc.id, ...doc.data() }));

                // Client-side sort to bypass index requirement
                adminHistoryData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

                renderAdminHistory();
            }, err => {
                console.error("Admin History Listen Error:", err);
                if (err.message.includes("index")) {
                    historyList.innerHTML = `<p style="font-size: 0.7rem; color: var(--error);">Error: Falta crear índice en Firestore para ordenar las transacciones.</p>`;
                }
            });
    }

    const accList = document.getElementById('admin-accounts-list');
    if (accList) {
        if (typeof window.renderAdminAccounts !== 'function') {
            window.renderAdminAccounts = function () {
                const accounts = typeof window.AppConfig !== 'undefined' ? window.AppConfig.accounts : [];
                const accListEl = document.getElementById('admin-accounts-list');
                if (accListEl) {
                    accListEl.innerHTML = accounts.length ? accounts.map((a, index) => `
                        <div class="transaction-card glass" style="flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                <div>
                                    <strong style="color: var(--gold);">${a.bank}</strong><br>
                                    <small>${a.name} | ${a.number}</small>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="status-badge" style="background: var(--accent-teal); color: black; border: none; cursor: pointer; padding: 4px 10px;" onclick="editAccount(${index})">Editar</button>
                                    <button class="status-badge" style="background: var(--error); color: white; border: none; cursor: pointer; padding: 4px 10px;" onclick="deleteAccount(${index})">Eliminar</button>
                                </div>
                            </div>
                        </div>
                    `).join('') : '<p style="padding: 1rem; color: var(--text-muted); text-align: center;">Sin cuentas guardadas.</p>';
                }
            };
        }
        window.renderAdminAccounts();
    }
    renderRatesEditor();
}

function addBankAccount() {
    const editIndex = parseInt(document.getElementById('edit-acc-index').value);
    const fields = ['name', 'id', 'bank', 'number', 'type', 'email'];
    const data = {};

    let allValid = true;
    fields.forEach(f => {
        const val = document.getElementById(`new-acc-${f}`).value;
        if (!val) allValid = false;
        data[f] = val;
    });

    if (!allValid) {
        alert("Por favor completa todos los campos de la cuenta."); return;
    }

    if (typeof db !== 'undefined') {
        db.collection('settings').doc('accounts').get().then(doc => {
            let accounts = doc.exists ? (doc.data().list || []) : [];

            if (editIndex >= 0) {
                accounts[editIndex] = data;
                alert("Cuenta bancaria actualizada exitosamente.");
            } else {
                accounts.push(data);
                alert("Cuenta bancaria agregada exitosamente.");
            }

            db.collection('settings').doc('accounts').set({ list: accounts }).then(() => {
                cancelEditAccount(); // Reset form and state
            });
        });
    }
}

function editAccount(index) {
    if (typeof db === 'undefined') return;

    db.collection('settings').doc('accounts').get().then(doc => {
        if (!doc.exists) return;
        const accounts = doc.data().list || [];
        const a = accounts[index];
        if (!a) return;

        document.getElementById('edit-acc-index').value = index;
        ['name', 'id', 'bank', 'number', 'type', 'email'].forEach(f => {
            document.getElementById(`new-acc-${f}`).value = a[f] || '';
        });

        const btnSave = document.getElementById('btn-save-account');
        const btnCancel = document.getElementById('btn-cancel-edit');
        if (btnSave) {
            btnSave.innerText = "Actualizar Cuenta Bancaria";
            btnSave.style.background = "var(--accent-teal)";
            btnSave.style.color = "black";
        }
        if (btnCancel) btnCancel.style.display = "inline-block";

        updateAdminLogoPreview(a.bank);
        // Scroll to editor
        document.getElementById('admin-accounts-editor').scrollIntoView({ behavior: 'smooth' });
    });
}

function cancelEditAccount() {
    document.getElementById('edit-acc-index').value = "-1";
    ['name', 'id', 'bank', 'number', 'type', 'email'].forEach(f => {
        document.getElementById(`new-acc-${f}`).value = '';
    });

    const btnSave = document.getElementById('btn-save-account');
    const btnCancel = document.getElementById('btn-cancel-edit');
    if (btnSave) {
        btnSave.innerText = "Agregar Cuenta Bancaria";
        btnSave.style.background = "";
        btnSave.style.color = "";
    }
    if (btnCancel) btnCancel.style.display = "none";

    const logoPreview = document.getElementById('admin-logo-preview');
    if (logoPreview) logoPreview.style.display = "none";
}

function deleteAccount(index) {
    if (!confirm("¿Seguro que deseas eliminar esta cuenta?")) return;
    if (typeof db !== 'undefined') {
        db.collection('settings').doc('accounts').get().then(doc => {
            let accounts = doc.exists ? (doc.data().list || []) : [];
            accounts.splice(index, 1);
            db.collection('settings').doc('accounts').set({ list: accounts });
        });
    }
}

function updateAdminLogoPreview(bankName) {
    const container = document.getElementById('admin-logo-preview');
    const img = container.querySelector('img');
    if (!bankName) {
        container.style.display = 'none';
        return;
    }
    img.src = getBankLogo(bankName);
    container.style.display = 'flex';
}


function authorizeTx(id) {
    txToAuthorize = id;
    adminProofBase64 = null;
    document.getElementById('admin-proof-upload').value = '';
    document.getElementById('admin-proof-preview-container').style.display = 'none';
    const msgElement = document.getElementById('admin-message');
    if (msgElement) msgElement.value = '';
    document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    txToAuthorize = null;
    const msgElement = document.getElementById('admin-message');
    if (msgElement) msgElement.value = '';
}

// Reject Modal Logic
function openRejectModal(id) {
    txToReject = id;
    adminProofBase64 = null;
    document.getElementById('reject-proof-upload').value = '';
    document.getElementById('reject-proof-preview-container').style.display = 'none';
    const reasonElement = document.getElementById('reject-reason');
    if (reasonElement) reasonElement.value = '';
    document.getElementById('reject-modal').style.display = 'flex';
}

function closeRejectModal() {
    document.getElementById('reject-modal').style.display = 'none';
    txToReject = null;
}

async function handleRejectProofSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            const compressed = await compressImage(e.target.result);
            adminProofBase64 = compressed;
            const preview = document.getElementById('reject-proof-preview');
            const container = document.getElementById('reject-proof-preview-container');
            if (preview && container) {
                preview.src = compressed;
                container.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

async function confirmRejection(btn) {
    if (typeof db !== 'undefined' && txToReject) {
        const originalText = btn ? btn.innerText : "Confirmar Rechazo";
        const reason = document.getElementById('reject-reason').value;

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = "Rechazando...";
            }

            const doc = await db.collection('transfers').doc(txToReject).get();
            if (doc.exists) {
                const txData = doc.data();

                let adminProofUrl = "";
                if (adminProofBase64) {
                    adminProofUrl = await uploadBase64ToStorage(adminProofBase64, `rejections/${txToReject}_reject_${Date.now()}.jpg`, { userId: txData.userId });
                }

                await db.collection('transfers').doc(txToReject).update({
                    status: 'rejected',
                    adminProof: adminProofUrl,
                    reason: reason || "Motivo no especificado"
                });

                if (typeof sendUserNotification === 'function') {
                    sendUserNotification({ ...txData, id: txToReject, reason: reason }, 'rejected');
                }

                alert("Transacción rechazada y notificada correctamente.");
                closeRejectModal();
            }
        } catch (e) {
            console.error("Error in confirmation of rejection:", e);
            alert("Error al procesar el rechazo.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }
    }
}

// uploadBase64ToStorage moved to api.js for global access and security metadata

async function handleAdminProofSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function (e) {
            // Compress before storing
            const compressed = await compressImage(e.target.result);
            adminProofBase64 = compressed;

            const preview = document.getElementById('admin-proof-preview');
            if (preview) {
                preview.src = compressed;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

let currentAdminFilteredData = [];

function renderAdminHistory(filteredData = null) {
    const list = document.getElementById('admin-history-list');
    const bulkBtn = document.getElementById('admin-bulk-actions');
    if (!list) return;

    let data = filteredData || adminHistoryData.slice(0, 50);
    currentAdminFilteredData = data;

    // Show bulk delete button if we have filters active (date or search)
    if (bulkBtn) {
        const hasFilters = document.getElementById('admin-history-search').value ||
            document.getElementById('admin-history-date-start').value ||
            document.getElementById('admin-history-date-end').value;
        bulkBtn.style.display = (hasFilters && data.length) ? 'flex' : 'none';
    }

    if (!data.length) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No se encontraron registros.</p>';
        return;
    }

    const groups = groupTransactionsByDate(data);

    list.innerHTML = Object.entries(groups).map(([date, txs]) => `
        <div class="date-group-header" style="color: var(--gold); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 1.2rem 0 0.6rem; display: flex; align-items: center; gap: 8px;">
            <span>${date}</span>
            <div style="flex: 1; h: 1px; background: rgba(255,255,255,0.05); height: 1px;"></div>
        </div>
        ${txs.map(tx => {
        const statusColor = tx.status === 'completed' ? 'var(--success)' : (tx.status === 'rejected' ? 'var(--error)' : 'var(--text-muted)');
        return `
            <div class="transaction-card glass" style="opacity: 1; font-size: 0.8rem; padding: 1rem; margin-bottom: 0.7rem; border-left: 3px solid ${statusColor}; flex-direction: column; align-items: stretch;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div class="recipient-info" style="flex: 1;">
                        <div class="avatar" style="width: 35px; height: 35px; font-size: 0.8rem; background: ${statusColor}22; color: ${statusColor};">${tx.initials || '??'}</div>
                        <div>
                            <strong style="color: white; font-size: 0.9rem;">${tx.name}</strong><br>
                            <small style="display: block; color: var(--text-muted); margin: 2px 0;">${new Date(tx.timestamp?.toMillis ? tx.timestamp.toMillis() : (tx.timestamp || tx.date)).toLocaleString('es-ES')} | <b style="color:var(--gold)">${tx.amount}</b></small>
                            <small style="display: block; color: var(--accent-teal); font-family: monospace; font-size: 0.7rem; letter-spacing: 0.5px;">ID: ${tx.id}</small>
                            <small style="display: block; color: var(--gold); font-family: monospace; font-size: 0.7rem; margin-top: 4px;">Usuario: ${tx.userEmail || 'N/A'}</small>
                            <button class="btn-signin" style="font-size: 0.6rem; padding: 2px 6px; margin-top: 4px; border-color: var(--accent-teal); color: var(--accent-teal);" onclick="viewUserHistory('${tx.userEmail || ''}')">Ver Historial</button>
                            ${tx.status === 'rejected' ? `<div style="margin-top: 8px; padding: 6px; background: rgba(239, 68, 68, 0.05); border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.1); color: #ff9999; font-size: 0.75rem;"><b>Razón:</b> ${tx.reason || 'Sin motivo'}</div>` : ''}
                            
                            <div style="margin-top: 10px; padding: 8px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                                 <div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 5px; text-transform: uppercase;">Cuenta de Destino</div>
                                 ${tx.vesData ? renderAccountData({ ...tx.vesData, name: tx.name }, true) : ''}
                                 ${tx.copData ? renderAccountData({ ...tx.copData, name: tx.name }, true) : ''}
                                 ${tx.penData ? renderAccountData({ ...tx.penData, name: tx.name }, true) : ''}
                                 ${tx.usaData ? renderAccountData({ ...tx.usaData, name: tx.name, bank: 'Zelle' }, true) : ''}
                                 ${tx.ecsData ? renderAccountData({ ...tx.ecsData, name: tx.name }, true) : ''}
                                 ${tx.clpData ? renderAccountData({ ...tx.clpData, name: tx.name }, true) : ''}
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; gap: 6px; min-width: 140px;">
                        <span style="color: ${statusColor}; font-weight: 800; font-size: 0.75rem; letter-spacing: 1px;">${tx.status.toUpperCase()}</span>
                        <div style="display: flex; gap: 4px; justify-content: flex-end;">
                            <button class="btn-signin" style="font-size: 0.6rem; padding: 4px 6px; background: rgba(255,255,255,0.05); flex: 1;" onclick="toggleReceiptPreview('adminhist-${tx.id}')" title="Vista Previa Recibo">
                                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">visibility</span>
                            </button>
                            <button class="btn-signin" style="font-size: 0.6rem; padding: 4px 6px; border-color: var(--gold); color: var(--gold); flex: 1;" onclick="downloadProofById('img-adminhist-${tx.id}', 'recibo_${tx.id}.png')" title="Descargar Recibo">
                                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">download</span>
                            </button>
                            <button class="btn-signin" style="font-size: 0.6rem; padding: 4px 6px; border-color: var(--error); color: var(--error); flex: 1;" onclick="deleteTransactionAdmin('${tx.id}')" title="Eliminar Registro">
                                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">delete</span>
                            </button>
                        </div>
                        ${tx.adminProof ? `
                        <div style="display: flex; gap: 4px;">
                             <button class="btn-signin" style="font-size: 0.65rem; padding: 4px 8px; background: rgba(${tx.status === 'rejected' ? '239, 68, 68' : '16, 185, 129'}, 0.1); border-color: ${tx.status === 'rejected' ? 'var(--error)' : 'var(--success)'}; color: ${tx.status === 'rejected' ? 'var(--error)' : 'var(--success)'}; flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="toggleReceiptPreview('adminhist-${tx.id}_admin')">
                                <span class="material-icons" style="font-size: 14px;">${tx.status === 'rejected' ? 'receipt_long' : 'admin_panel_settings'}</span> ${tx.status === 'rejected' ? 'Recibo Rechazo' : 'Recibo Admin'}
                            </button>
                            <button class="btn-signin" style="font-size: 0.6rem; padding: 4px 6px; border-color: ${tx.status === 'rejected' ? 'var(--error)' : 'var(--success)'}; color: ${tx.status === 'rejected' ? 'var(--error)' : 'var(--success)'};" onclick="downloadProofById('img-adminhist-${tx.id}_admin', '${tx.status === 'rejected' ? 'recibo_rechazo' : 'comprobante_admin'}_${tx.id}.png')" title="Descargar Comprobante">
                                <span class="material-icons" style="font-size: 14px; vertical-align: middle;">download</span>
                            </button>
                        </div>` : ''}
                    </div>
                </div>
                <!-- Previews -->
                <div id="preview-adminhist-${tx.id}" style="display: none; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                    <p style="font-size: 0.7rem; color: var(--gold); margin-bottom: 0.5rem;">Recibo de Usuario:</p>
                    ${tx.proof ? `<img id="img-adminhist-${tx.id}" src="${tx.proof}" style="width: 100%; border-radius: 12px; border: 1px solid var(--gold);">` : 'Sin imagen.'}
                </div>
                ${tx.adminProof ? `
                <div id="preview-adminhist-${tx.id}_admin" style="display: none; margin-top: 1rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                    <p style="font-size: 0.7rem; color: ${tx.status === 'rejected' ? 'var(--error)' : 'var(--success)'}; margin-bottom: 0.5rem;">${tx.status === 'rejected' ? 'Recibo Rechazo:' : 'Comprobante Admin:'}</p>
                    <img id="img-adminhist-${tx.id}_admin" src="${tx.adminProof}" style="width: 100%; border-radius: 12px; border: 1px solid ${tx.status === 'rejected' ? 'var(--error)' : 'var(--success)'};">
                </div>` : ''}
            </div>`;
    }).join('')}
    `).join('');
}

function filterAdminHistory() {
    const list = document.getElementById('admin-history-list');
    if (!list) return;

    const query = document.getElementById('admin-history-search').value.toLowerCase();
    const startDate = document.getElementById('admin-history-date-start').value;
    const endDate = document.getElementById('admin-history-date-end').value;

    const filtered = adminHistoryData.filter(tx => {
        const matchesQuery = !query ||
            tx.id.toLowerCase().includes(query) ||
            tx.name.toLowerCase().includes(query) ||
            (tx.amount && tx.amount.toString().toLowerCase().includes(query));

        let matchesDate = true;
        if (startDate || endDate) {
            const txDate = new Date(tx.timestamp?.toMillis ? tx.timestamp.toMillis() : (tx.timestamp || tx.date));
            if (startDate && txDate < new Date(startDate + 'T00:00:00')) matchesDate = false;
            if (endDate && txDate > new Date(endDate + 'T23:59:59')) matchesDate = false;
        }

        return matchesQuery && matchesDate;
    });

    renderAdminHistory(filtered);
}

async function deleteTransactionArtifacts(txId) {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro y sus imágenes de la nube? Esta acción no se puede deshacer.')) return;

    try {
        const txDoc = await db.collection('transfers').doc(txId).get();
        if (!txDoc.exists) throw new Error('Transacción no encontrada');

        const tx = txDoc.data();

        // Delete images from Storage
        if (tx.proof && tx.proof.startsWith('http')) {
            try { await storage.refFromURL(tx.proof).delete(); } catch (e) { console.warn("Error deleting user proof:", e); }
        }
        if (tx.adminProof && tx.adminProof.startsWith('http')) {
            try { await storage.refFromURL(tx.adminProof).delete(); } catch (e) { console.warn("Error deleting admin proof:", e); }
        }

        // Delete from Firestore
        await db.collection('transfers').doc(txId).delete();
        alert('Transacción eliminada con éxito.');
        loadAdminData(); // Refresh history
    } catch (err) {
        console.error("Error deleting transaction:", err);
        alert('Error al eliminar la transacción: ' + err.message);
    }
}

async function deleteTransactionAdmin(id) {
    if (!confirm("¿Estás seguro de eliminar este registro permanentemente?")) return;
    try {
        const doc = await db.collection('transfers').doc(id).get();
        if (doc.exists) {
            const tx = doc.data();
            if (tx.proof && tx.proof.startsWith('http')) {
                try { await storage.refFromURL(tx.proof).delete(); } catch (e) { }
            }
            if (tx.adminProof && tx.adminProof.startsWith('http')) {
                try { await storage.refFromURL(tx.adminProof).delete(); } catch (e) { }
            }
            await db.collection('transfers').doc(id).delete();
            alert("Registro eliminado exitosamente.");
            loadAdminData();
        }
    } catch (e) {
        console.error("Error deleting transaction:", e);
        alert("Error al eliminar el registro.");
    }
}

async function bulkDeleteAdminSelection() {
    const count = currentAdminFilteredData.length;
    if (count === 0) return;
    if (!confirm(`¿Estás seguro de eliminar los ${count} registros filtrados y todas sus imágenes de la nube?`)) return;

    try {
        const batch = db.batch();
        let deletedCount = 0;

        for (const tx of currentAdminFilteredData) {
            // Eliminar de Storage
            if (tx.proof && tx.proof.startsWith('http')) {
                try { await storage.refFromURL(tx.proof).delete(); } catch (e) { }
            }
            if (tx.adminProof && tx.adminProof.startsWith('http')) {
                try { await storage.refFromURL(tx.adminProof).delete(); } catch (e) { }
            }

            // Agregar al batch para eliminar documento
            const docRef = db.collection('transfers').doc(tx.id);
            batch.delete(docRef);
            deletedCount++;

            // Ejecutar batch cada 500 operaciones (límite de Firestore)
            if (deletedCount % 500 === 0) {
                await batch.commit();
            }
        }

        // Ejecutar las operaciones restantes en el batch
        if (deletedCount % 500 !== 0) {
            await batch.commit();
        }

        alert(`Se eliminaron ${deletedCount} registros exitosamente.`);
        document.getElementById('admin-history-search').value = '';
        filterAdminHistory();
        loadAdminData();
    } catch (e) {
        console.error("Error bulk deleting:", e);
        alert("Ocurrió un error al eliminar los registros por lote.");
    }
}

async function viewUserHistory(email) {
    if (!email) {
        alert("Este usuario no tiene un email registrado.");
        return;
    }

    document.getElementById('user-history-email').innerText = email;
    const list = document.getElementById('user-history-list');
    list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">Cargando historial...</p>';
    document.getElementById('user-history-modal').style.display = 'flex';

    try {
        const snapshot = await db.collection('transfers')
            .where('userEmail', '==', email)
            .get();

        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">No se encontraron transacciones para este usuario.</p>';
            return;
        }

        let txs = [];
        snapshot.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));

        // Client-side sort to bypass index requirement
        txs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="user-history-select-all" onchange="toggleAllUserHistorySelect(this)">
                    <span style="color: white; font-size: 0.9rem;">Seleccionar Todas</span>
                </label>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <span style="color: var(--accent-teal); font-size: 0.85rem; font-weight: bold;">Total: ${txs.length}</span>
                    <button class="btn-primary" style="background: var(--error); padding: 0.5rem 1rem; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;" onclick="deleteSelectedUserHistory()">
                        <span class="material-icons" style="font-size: 16px;">delete</span> Eliminar Seleccionadas
                    </button>
                </div>
            </div>
            <div id="user-history-items-container">
        `;

        txs.forEach(tx => {
            const statusColor = tx.status === 'completed' ? 'var(--success)' : (tx.status === 'rejected' ? 'var(--error)' : (tx.status === 'pending' ? 'var(--gold)' : 'var(--text-muted)'));

            html += `
            <div class="user-history-item" data-id="${tx.id}" data-proof="${tx.proof || ''}" data-adminproof="${tx.adminProof || ''}" style="background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 1rem; border-left: 3px solid ${statusColor};">
                <input type="checkbox" class="user-history-checkbox" value="${tx.id}" style="width: 18px; height: 18px; cursor: pointer;">
                <div style="flex: 1;">
                    <strong style="color: white; font-size: 0.9rem;">${tx.name}</strong><br>
                    <small style="color: var(--text-muted);">${new Date(tx.timestamp?.toMillis ? tx.timestamp.toMillis() : (tx.timestamp || tx.date)).toLocaleString('es-ES')}</small><br>
                    <span style="color: var(--gold); font-weight: bold; font-size: 0.8rem;">${tx.amount}</span><br>
                    <span style="color: var(--text-muted); font-size: 0.7rem; font-family: monospace;">ID: ${tx.id}</span>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                    <span style="color: ${statusColor}; font-weight: 800; font-size: 0.75rem; letter-spacing: 1px; text-transform: uppercase;">${tx.status}</span>
                </div>
            </div>`;
        });
        html += '</div>';

        list.innerHTML = html;
    } catch (e) {
        console.error("Error fetching user history:", e);
        list.innerHTML = '<p style="text-align: center; color: var(--error); padding: 1rem;">Error al cargar el historial.</p>';
    }
}

function toggleAllUserHistorySelect(source) {
    const checkboxes = document.querySelectorAll('.user-history-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

async function deleteSelectedUserHistory() {
    const selectedItems = Array.from(document.querySelectorAll('.user-history-item'))
        .filter(item => item.querySelector('.user-history-checkbox').checked);

    if (selectedItems.length === 0) {
        alert("Selecciona al menos una transacción para eliminar.");
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar las ${selectedItems.length} transacciones seleccionadas? Esta acción no se puede deshacer.`)) return;

    try {
        const batch = db.batch();
        let deletedCount = 0;

        for (const item of selectedItems) {
            const id = item.getAttribute('data-id');
            const proof = item.getAttribute('data-proof');
            const adminProof = item.getAttribute('data-adminproof');

            // Eliminar de Storage
            if (proof && proof.startsWith('http')) {
                try { await storage.refFromURL(proof).delete(); } catch (e) { }
            }
            if (adminProof && adminProof.startsWith('http')) {
                try { await storage.refFromURL(adminProof).delete(); } catch (e) { }
            }

            // Agregar al batch para eliminar documento
            const docRef = db.collection('transfers').doc(id);
            batch.delete(docRef);
            deletedCount++;

            // Ejecutar batch cada 500 operaciones (límite de Firestore)
            if (deletedCount % 500 === 0) {
                await batch.commit();
            }
        }

        // Ejecutar las operaciones restantes en el batch
        if (deletedCount % 500 !== 0) {
            await batch.commit();
        }

        alert(`Se eliminaron ${deletedCount} registros exitosamente.`);
        // Reload the modal for the currently viewed user
        const email = document.getElementById('user-history-email').innerText;
        viewUserHistory(email);
        // Refresh the background admin lists
        loadAdminData();
    } catch (e) {
        console.error("Error bulk deleting user history:", e);
        alert("Ocurrió un error al eliminar los registros por lote.");
    }
}

function closeUserHistoryModal() {
    document.getElementById('user-history-modal').style.display = 'none';
}

function toggleAdminHistory() {
    const container = document.getElementById('admin-history-container');
    const icon = document.getElementById('history-toggle-icon');
    if (!container || !icon) return;

    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    icon.style.transition = 'transform 0.3s ease';
}

async function confirmAuthorization(btn) {
    if (!adminProofBase64) {
        alert("Por favor sube el comprobante de pago para el cliente.");
        return;
    }

    if (typeof db !== 'undefined' && txToAuthorize) {
        const originalText = btn ? btn.innerText : "Autorizar";
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerText = "Subiendo...";
            }

            const doc = await db.collection('transfers').doc(txToAuthorize).get();
            if (doc.exists) {
                const txData = doc.data();
                const adminProofUrl = await uploadBase64ToStorage(adminProofBase64, `admin_proofs/${txToAuthorize}_${Date.now()}.jpg`, { userId: txData.userId });

                await db.collection('transfers').doc(txToAuthorize).update({
                    status: 'completed',
                    adminProof: adminProofUrl
                });
                const adminMsg = document.getElementById('admin-message').value;
                sendUserNotification({ ...txData, id: txToAuthorize, reason: adminMsg }, 'completed');
                alert("Pago autorizado y comprobante enviado al usuario.");
                closeConfirmModal();
            }
        } catch (e) {
            console.error("Error authorizing:", e);
            alert("Error al autorizar pago: " + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }
    }
}

// Spreadsheet logic was removed to simplify the app.

function renderRatesEditor() {
    const editor = document.getElementById('admin-rates-editor');
    if (!editor) return;

    let bcvHtml = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 12px; border: 1px solid var(--gold); margin-bottom: 1rem;">
        <div class="flex-center gap-sm">
            <img src="assets/img/logo-bcv.webp?v=2" width="20" style="object-fit: contain;">
            <span class="font-bold text-teal" style="font-size: 0.9rem;">DOLAR BCV</span>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
                <small style="color: var(--gold); font-size: 0.65rem;">Tasa Oficial (Bs/USD)</small>
                <input type="number" step="0.0001" value="${typeof AppConfig !== 'undefined' && AppConfig.bcvNumeric ? AppConfig.bcvNumeric : 0}" id="bcv-manual-rate-input" class="search-bar" style="margin:0; width: 100%; padding: 0.4rem 0.4rem; font-size: 0.85rem; border-color: var(--gold); box-sizing: border-box;">
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
                <small style="color: var(--gold); font-size: 0.65rem;">Factor Ganancia</small>
                <input type="number" step="0.01" value="${typeof AppConfig !== 'undefined' && AppConfig.adminFactor ? AppConfig.adminFactor : 0.94}" id="admin-factor-input" class="search-bar" style="margin:0; width: 100%; padding: 0.4rem 0.4rem; font-size: 0.85rem; border-color: var(--gold); box-sizing: border-box;">
            </div>
        </div>
    </div>
    `;

    let monitorHtml = `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 12px; border: 1px solid var(--accent); margin-bottom: 1rem;">
        <div class="flex-center gap-sm">
            <img src="assets/img/logo-monitor.webp?v=2" width="20" style="object-fit: contain; border-radius: 50%;">
            <span class="font-bold text-teal" style="font-size: 0.9rem;">DOLAR PARALELO</span>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
                <small style="color: var(--accent); font-size: 0.65rem;">Tasa (Bs/USD)</small>
                <input type="number" step="0.0001" value="${typeof AppConfig !== 'undefined' && AppConfig.monitorNumeric ? AppConfig.monitorNumeric : 0}" id="monitor-manual-rate-input" class="search-bar" style="margin:0; width: 100%; padding: 0.4rem 0.4rem; font-size: 0.85rem; border-color: var(--accent); box-sizing: border-box;">
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
                <button type="button" class="btn-signin" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: var(--accent); color: white;" onclick="if(typeof fetchMonitorRate === 'function') fetchMonitorRate().then(val => { if(val) document.getElementById('monitor-manual-rate-input').value = val; })">Extraer Yadio</button>
            </div>
        </div>
    </div>
    `;

    editor.innerHTML = bcvHtml + monitorHtml + AppConfig.countries.map((c, index) => `
    <div style="display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 12px;">
    <div style="display: flex; align-items: center; gap: 1rem;">
        <img src="${c.flag}" width="20">
            <span style="width: 50px; font-weight: 600;">${c.code}</span>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
                <small style="color: var(--text-muted); font-size: 0.65rem;">Tasa de Cambio</small>
                <input type="number" step="0.0001" value="${c.rate.toFixed((c.code === 'USD' || c.code === 'ECS') ? 6 : 4)}" id="rate-input-${index}" class="search-bar" style="margin:0; width: 100%; padding: 0.4rem 0.4rem; font-size: 0.85rem; box-sizing: border-box;">
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.2rem;">
                <small style="color: var(--text-muted); font-size: 0.65rem;">Mínimo (CLP)</small>
                <input type="number" value="${c.minCLP || 0}" id="min-input-${index}" class="search-bar" style="margin:0; width: 100%; padding: 0.4rem 0.4rem; font-size: 0.85rem; box-sizing: border-box;">
            </div>
    </div>
        </div>
        `).join('');
}

function parseLocalFloat(valStr) {
    if (!valStr) return 0;
    let s = valStr.toString();
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(/,/g, '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function saveNewRates() {
    const bcvInput = document.getElementById('bcv-manual-rate-input');
    const factorInput = document.getElementById('admin-factor-input');
    const monitorInput = document.getElementById('monitor-manual-rate-input');

    // 1. Parse manual values
    if (bcvInput) {
        const val = parseLocalFloat(bcvInput.value);
        if (val > 0) {
            AppConfig.bcvNumeric = val;
            AppConfig.bcvRate = val.toString().replace('.', ',');
        }
    }

    if (monitorInput) {
        const mVal = parseLocalFloat(monitorInput.value);
        if (mVal > 0) {
            AppConfig.monitorNumeric = mVal;
            AppConfig.monitorRate = mVal.toString().replace('.', ',');
        }
    }

    let tempFactor = typeof AppConfig !== 'undefined' && AppConfig.adminFactor ? AppConfig.adminFactor : 0.94;
    if (factorInput) {
        const factorVal = parseLocalFloat(factorInput.value);
        if (factorVal > 0) {
            tempFactor = factorVal;
            AppConfig.adminFactor = tempFactor;
        }
    }

    // 2. Parse Country Rates 
    AppConfig.countries.forEach((c, index) => {
        const rateInput = document.getElementById(`rate-input-${index}`);
        const minInput = document.getElementById(`min-input-${index}`);
        if (rateInput) c.rate = parseLocalFloat(rateInput.value);
        if (minInput) c.minCLP = parseLocalFloat(minInput.value);
    });

    if (typeof window.FirebaseAPI !== 'undefined' && typeof db !== 'undefined') {
        window.FirebaseAPI.saveRates(AppConfig.countries, AppConfig.bcvRate, AppConfig.bcvNumeric, tempFactor, AppConfig.monitorRate, AppConfig.monitorNumeric)
            .then(() => {
                alert("Todas las tasas actualizadas correctamente en la nube.");
                if (typeof renderHomeRates === 'function') renderHomeRates();
                if (typeof calculateQuick === 'function') calculateQuick();
                if (typeof calculate === 'function') calculate();
            }).catch(err => {
                console.error("Error saving rates to Firestore:", err);
                alert("Error al guardar en la nube. Se guardó localmente.");
                localStorage.setItem('managed_countries', JSON.stringify(countries));
            });
    } else {
        localStorage.setItem('managed_countries', JSON.stringify(countries));
        alert("Tasas actualizadas localmente (Base de datos no conectada).");
        if (typeof renderHomeRates === 'function') renderHomeRates();
        if (typeof calculateQuick === 'function') calculateQuick();
    }
}

function autoCalculateRates() {
    // Manually trigger the auto update
    if (!user || (!user.isAdmin && user.email !== 'enmssellchanges@gmail.com')) {
        alert("Solo el administrador puede automatizar tasas.");
        return;
    }
    autoUpdateRatesFromMonitors(true);
}

// Llama al auto-update de manera segura sin race conditions
function tryAutoUpdateRates() {
    if (typeof window.binanceFetchComplete === 'undefined' || !window.binanceFetchComplete) return;
    autoUpdateRatesFromMonitors(false);
}

function autoUpdateRatesFromMonitors(isManual = false) {
    if (typeof window.binancePrices === 'undefined' || !window.binancePrices['CLP']) {
        if (isManual) alert("Por favor espera a que carguen los monitores de referencia (Binance P2P) antes de calcular.");
        return;
    }

    const clpMonitor = window.binancePrices['CLP'];
    let hasCalculated = false;

    if (typeof AppConfig === 'undefined' || !AppConfig.countries) return;

    AppConfig.countries.forEach((c, index) => {
        let calculatedRate = 0;

        if (c.code === 'CLP') {
            calculatedRate = 1.0;
        } else {
            const monitorPrice = window.binancePrices[c.code];
            if (monitorPrice && clpMonitor > 0) {
                const factor = AppConfig.adminFactor ? AppConfig.adminFactor : 0.94;
                calculatedRate = (monitorPrice / clpMonitor) * factor;
            }
        }

        if (calculatedRate > 0) {
            const rateInput = document.getElementById(`rate-input-${index}`);
            if (rateInput && Math.abs(c.rate - calculatedRate) > 0.00001) {
                rateInput.value = calculatedRate.toFixed((c.code === 'USD' || c.code === 'ECS') ? 6 : 4);
                rateInput.style.transition = "background-color 0.3s ease";
                rateInput.style.backgroundColor = "rgba(46, 204, 113, 0.4)";
                setTimeout(() => { rateInput.style.backgroundColor = "" }, 2000);
            }
            if (Math.abs(c.rate - calculatedRate) > 0.00001) {
                c.rate = calculatedRate;
                hasCalculated = true;
            }
        }
    });

    if (hasCalculated) {
        if (typeof window.FirebaseAPI !== 'undefined' && typeof db !== 'undefined') {
            window.FirebaseAPI.saveRates(
                AppConfig.countries,
                AppConfig.bcvRate,
                AppConfig.bcvNumeric,
                AppConfig.adminFactor,
                AppConfig.monitorRate,
                AppConfig.monitorNumeric
            ).then(() => {
                if (isManual) alert("Tasas mundiales calculadas y guardadas. Cambios en vivo.");
                else if (typeof showToast === 'function') showToast("Sincronización Automática", "Tasas y Monitores guardados en vivo");
            }).catch(err => {
                console.error("Error auto-guardar Binance:", err);
                if (isManual) alert("Error guardando actualización automática: " + err.message);
            });
        }
    } else {
        if (isManual) alert("No hubo cambios en tasas mundiales.");
    }
}

// Independent Yadio Auto-Sync loop
function autoUpdateYadioMonitor(isManual = false) {
    if (typeof fetchMonitorRate !== 'function' || typeof db === 'undefined') return;

    fetchMonitorRate().then(monitorVal => {
        if (monitorVal && Math.abs((window.AppConfig ? window.AppConfig.monitorNumeric : 0) - monitorVal) > 0.00001) {
            const monitorInput = document.getElementById('monitor-manual-rate-input');
            if (monitorInput) monitorInput.value = monitorVal;
            const isoTime = new Date().toISOString();
            db.collection('settings').doc('monitor').set({
                rate: monitorVal.toString().replace('.', ','),
                numeric: monitorVal,
                lastUpdate: isoTime
            }).then(() => {
                if (isManual) alert("Tasa Monitor Yadio actualizada y guardada.");
            });
        } else {
            if (isManual) alert("La Tasa Monitor ya está sincronizada.");
        }
    }).catch(e => {
        console.warn("Background monitor fetch failed", e);
        if (isManual) alert("Fallo al obtener Tasa Monitor: " + e.message);
    });
}

// ── Promo Push Notifications ──────────────────────────────────────────────────
async function sendPromoNotification() {
    const title = document.getElementById('promo-title').value.trim();
    const body = document.getElementById('promo-body').value.trim();
    const btn = document.getElementById('btn-send-promo');
    const result = document.getElementById('promo-result');

    if (!title || !body) {
        alert('Ingresa un título y un mensaje para la notificación.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons spin" style="font-size:16px; vertical-align:middle;">autorenew</span> Enviando...';

    try {
        const sendPromo = firebase.functions().httpsCallable('sendPromoNotification');
        const res = await sendPromo({ title, body });
        const data = res.data;
        result.style.display = 'block';
        result.style.background = 'rgba(16, 185, 129, 0.15)';
        result.style.color = 'var(--success)';
        result.innerText = `✅ Notificación enviada a ${data.sent} de ${data.total} usuarios.`;
        document.getElementById('promo-title').value = '';
        document.getElementById('promo-body').value = '';
    } catch (err) {
        console.error('Error sending promo:', err);
        result.style.display = 'block';
        result.style.background = 'rgba(239, 68, 68, 0.15)';
        result.style.color = 'var(--error)';
        result.innerText = '❌ Error: ' + (err.message || 'Fallo al enviar.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons" style="font-size:16px; vertical-align:middle; margin-right:4px;">campaign</span> Enviar Notificación';
    }
}

// ==========================================
// PANTALLA PROMOCIONAL (MODAL INICIAL)
// ==========================================

let promoImageFile = null;

function handlePromoImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast("⚠️ ATENCIÓN", "La imagen es muy grande. Intenta con una menor a 2MB.", true);
        return;
    }

    promoImageFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('promo-image-preview');
        const container = document.getElementById('promo-preview-container');
        preview.src = e.target.result;
        container.style.display = 'block';
    }
    reader.readAsDataURL(file);
}

async function savePromoData() {
    const expirationInput = document.getElementById('promo-expiration').value;
    const linkInput = document.getElementById('promo-link').value;
    const btn = document.getElementById('btn-save-promo');

    if (!expirationInput) {
        alert("Debes seleccionar una fecha y hora de expiración.");
        return;
    }

    const expDate = new Date(expirationInput);
    if (expDate <= new Date()) {
        alert("La fecha de expiración debe ser en el futuro.");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons spin" style="font-size:16px; vertical-align:middle; margin-right:4px;">autorenew</span> Guardando...';

        let imageUrl = null;

        // Si hay una nueva imagen seleccionada, subirla
        if (promoImageFile) {
            const storageRef = firebase.storage().ref();
            const promoRef = storageRef.child(`promos/promo_${Date.now()}_${promoImageFile.name.replace(/[^a-zA-Z0-9.]/g, '')}`);
            const snapshot = await promoRef.put(promoImageFile);
            imageUrl = await snapshot.ref.getDownloadURL();
        } else {
            // Si no hay imagen nueva, conservar la que ya está si existe
            const previewImg = document.getElementById('promo-image-preview');
            if (previewImg.src && !previewImg.src.startsWith('data:')) {
                imageUrl = previewImg.src;
            }
        }

        if (!imageUrl) {
            alert("Debes seleccionar una imagen para la promoción.");
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons" style="font-size:16px; margin-right:4px;">save</span> Guardar Promoción';
            return;
        }

        await db.doc('settings/promotion').set({
            imageUrl: imageUrl,
            expiresAt: firebase.firestore.Timestamp.fromDate(expDate),
            link: linkInput || "",
            active: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast("✅ EXITO", "Promoción guardada correctamente.");
        loadPromoData(); // Recargar la vista

    } catch (error) {
        console.error("Error guardando promoción:", error);
        alert("Error al guardar la promoción: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons" style="font-size:16px; margin-right:4px;">save</span> Guardar Promoción';
    }
}

async function deleteCurrentPromo() {
    if (!confirm("¿Seguro que deseas eliminar/desactivar la promoción actual?")) return;

    try {
        const btn = document.getElementById('btn-delete-promo');
        btn.disabled = true;
        btn.innerText = "Eliminando...";

        await db.doc('settings/promotion').update({
            active: false
        });

        // Limpiar formulario
        document.getElementById('promo-image-upload').value = "";
        document.getElementById('promo-expiration').value = "";
        document.getElementById('promo-link').value = "";
        document.getElementById('promo-preview-container').style.display = "none";
        document.getElementById('promo-image-preview').src = "";
        promoImageFile = null;
        
        btn.style.display = "none";

        showToast("✅ EXITO", "Promoción desactivada.");

    } catch (error) {
        console.error("Error eliminando promoción:", error);
        alert("Error: " + error.message);
        document.getElementById('btn-delete-promo').disabled = false;
        document.getElementById('btn-delete-promo').innerText = "Desactivar / Eliminar";
    }
}

function loadPromoData() {
    db.doc('settings/promotion').get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.active) {
                // Set image preview
                const preview = document.getElementById('promo-image-preview');
                const container = document.getElementById('promo-preview-container');
                if (data.imageUrl) {
                    preview.src = data.imageUrl;
                    container.style.display = 'block';
                }

                // Set expiration date (format: YYYY-MM-DDTHH:MM)
                if (data.expiresAt) {
                    const date = data.expiresAt.toDate();
                    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
                    document.getElementById('promo-expiration').value = localISOTime;
                }

                if (data.link) {
                    document.getElementById('promo-link').value = data.link;
                }

                document.getElementById('btn-delete-promo').style.display = "inline-flex";
            }
        }
    }).catch(err => {
        console.error("Error loading promo data:", err);
    });
}
