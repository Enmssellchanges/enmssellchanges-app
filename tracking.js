function updateTrackingUI(providedTxs = null) {
  const container = document.getElementById('tracking-content');
  if (!container) return;
  if (!user) {
    container.innerHTML = `<p style="padding: 2rem; text-align: center; color: var(--text-muted);">Inicia sesión para rastrear tus envíos.</p>`;
    return;
  }
  const renderTrackingData = txs => {
    // We show PENDING shipments first, then others
    const pendingTxs = txs.filter(t => t.status === 'pending');
    const recentTxs = txs.filter(t => t.status !== 'pending').slice(0, 2);
    const allVisible = [...pendingTxs, ...recentTxs];
    if (allVisible.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <span class="material-icons" style="font-size: 48px; color: var(--glass-border); margin-bottom: 1rem;">local_shipping</span>
                    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">No tienes envíos activos en este momento.</p>
                    <button class="btn-primary" style="width: auto; padding: 0.8rem 2rem;" onclick="showView('send')">Realizar un Envío</button>
                </div>
            `;
      return;
    }
    container.innerHTML = allVisible.map(tx => {
      const isPending = tx.status === 'pending';
      const isCompleted = tx.status === 'completed';
      const isRejected = tx.status === 'rejected';
      let statusLabel = isPending ? 'En Proceso' : isCompleted ? 'Completado' : 'Rechazado';
      let statusColor = isPending ? 'var(--gold)' : isCompleted ? 'var(--success)' : 'var(--error)';
      return `
                <div class="glass" style="margin-bottom: 1.5rem; padding: 1.5rem; border-left: 4px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.2rem;">
                        <div>
                            <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 4px;">Estado del Envío</div>
                            <div style="font-size: 1.2rem; font-weight: 800; color: ${statusColor}; display: flex; align-items: center; gap: 0.5rem;">
                                ${isPending ? '<span class="material-icons" style="font-size: 18px; animation: spin 2s linear infinite;">sync</span>' : ''}
                                ${statusLabel}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Monto a Recibir</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: white;">${tx.amount}</div>
                        </div>
                    </div>

                    <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1rem; margin-bottom: 1.2rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                            <span style="color: var(--text-muted);">Destinatario:</span>
                            <span style="font-weight: 600;">${tx.name}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                            <span style="color: var(--text-muted);">Fecha:</span>
                            <span>${tx.date}</span>
                        </div>
                    </div>

                    ${isPending ? `
                        <div style="font-size: 0.8rem; color: var(--accent-teal); background: rgba(0, 243, 255, 0.05); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(0, 243, 255, 0.1);">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-icons" style="font-size: 16px;">info</span>
                                El administrador está verificando tu comprobante. El pago se acreditará pronto.
                            </div>
                        </div>
                    ` : ''}

                    ${isRejected ? `
                        <div style="font-size: 0.8rem; color: var(--error); background: rgba(239, 68, 68, 0.05); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.1);">
                            <strong>Motivo:</strong> ${tx.reason || 'Datos incorrectos o comprobante inválido.'}
                        </div>
                    ` : ''}

                    ${(isCompleted || isRejected) && tx.adminProof ? `
                        <div style="margin-top: 1.2rem; display: flex; flex-direction: column; gap: 0.8rem;">
                            <div style="font-size: 0.75rem; color: ${isCompleted ? 'var(--success)' : 'var(--error)'}; font-weight: 600; display: flex; align-items: center; gap: 0.4rem;">
                                <span class="material-icons" style="font-size: 16px;">${isCompleted ? 'check_circle' : 'cancel'}</span> 
                                ${isCompleted ? 'Transferencia completada por Enmsell' : 'Comprobante de rechazo (Enmsell)'}
                            </div>
                            <div style="display: flex; gap: 0.8rem;">
                                <button class="btn-primary" style="flex: 1; font-size: 0.8rem; padding: 0.8rem; background: ${isCompleted ? 'var(--success)' : 'var(--error)'}; border: none; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" onclick="toggleReceiptPreview('adminproof-user-${tx.id}')">
                                    <span class="material-icons">visibility</span> VER COMPROBANTE
                                </button>
                                <button class="btn-signin" style="padding: 0.8rem; border-color: ${isCompleted ? 'var(--success)' : 'var(--error)'}; color: ${isCompleted ? 'var(--success)' : 'var(--error)'};" onclick="downloadProofById('img-adminproof-user-${tx.id}', 'comprobante_enmsell_${tx.id}.png')">
                                    <span class="material-icons">download</span>
                                </button>
                            </div>
                            <div id="preview-adminproof-user-${tx.id}" style="display: none; border: 1px solid ${isCompleted ? 'var(--success)' : 'var(--error)'}; border-radius: 12px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.5); margin-top: 0.5rem;">
                                <img id="img-adminproof-user-${tx.id}" src="${tx.adminProof}" style="width: 100%; display: block;">
                            </div>
                        </div>
                    ` : ''}

                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Tu comprobante:</span>
                            <div style="display: flex; gap: 0.6rem;">
                                <button class="btn-signin" style="font-size: 0.7rem; padding: 5px 10px; background: rgba(255,255,255,0.03);" onclick="toggleReceiptPreview('user-${tx.id}')">
                                    <span class="material-icons" style="font-size: 14px; vertical-align: middle;">visibility</span> VISTA PREVIA
                                </button>
                                <button class="btn-signin" style="font-size: 0.7rem; padding: 5px 10px; border-color: var(--gold); color: var(--gold);" onclick="downloadProofById('img-user-${tx.id}', 'mi_pago_${tx.id}.png')">
                                    <span class="material-icons" style="font-size: 14px; vertical-align: middle;">download</span>
                                </button>
                            </div>
                        </div>
                        <!-- Inline Preview -->
                        <div id="preview-user-${tx.id}" style="display: none; border: 1px solid var(--gold); border-radius: 12px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.5);">
                            <img id="img-user-${tx.id}" src="${tx.proof}" style="width: 100%; display: block;">
                        </div>
                    </div>
                </div>
            `;
    }).join('');
  };
  if (providedTxs) {
    renderTrackingData(providedTxs);
  } else {
    // Fallback or full listener if called without data
    db.collection('transfers').where('userId', '==', user.uid).orderBy('timestamp', 'desc').onSnapshot(snapshot => {
      let txs = [];
      snapshot.forEach(doc => txs.push({
        id: doc.id,
        ...doc.data()
      }));
      renderTrackingData(txs);
    }, err => {
      // If index fails, try without ordering
      db.collection('transfers').where('userId', '==', user.uid).onSnapshot(s => {
        let txs = [];
        s.forEach(doc => txs.push({
          id: doc.id,
          ...doc.data()
        }));
        txs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        renderTrackingData(txs);
      });
    });
  }
}

function retryTransfer() {
  if (!currentTransfer) return;
  document.getElementById('sender-name').value = currentTransfer.sender;
  if (currentTransfer.vesData) {
    document.getElementById('ves-type').value = currentTransfer.vesData.type || 'transfer';
    toggleVesType();
    document.getElementById('ves-name').value = currentTransfer.name;
    document.getElementById('ves-id').value = currentTransfer.vesData.id;
    document.getElementById('ves-bank').value = currentTransfer.vesData.bank;
    document.getElementById('ves-account').value = currentTransfer.vesData.account;
  } else if (currentTransfer.copData) {
    document.getElementById('cop-name').value = currentTransfer.name;
    document.getElementById('cop-doc-type').value = currentTransfer.copData.docType;
    document.getElementById('cop-id').value = currentTransfer.copData.id;
    document.getElementById('cop-bank').value = currentTransfer.copData.bank;
    toggleCopType();
    document.getElementById('cop-account').value = currentTransfer.copData.account;
  } else if (currentTransfer.penData) {
    document.getElementById('pen-name').value = currentTransfer.name;
    document.getElementById('pen-method').value = currentTransfer.penData.method;
    togglePenType();
    if (currentTransfer.penData.method === 'Banco') {
      document.getElementById('pen-bank').value = currentTransfer.penData.bank;
    }
    document.getElementById('pen-account').value = currentTransfer.penData.account;
  } else if (currentTransfer.usaData) {
    document.getElementById('usa-name').value = currentTransfer.name;
    document.getElementById('usa-zelle-type').value = currentTransfer.usaData.type;
    toggleUsaType();
    document.getElementById('usa-zelle-data').value = currentTransfer.usaData.data;
  } else if (currentTransfer.ecsData) {
    document.getElementById('ecs-name').value = currentTransfer.name;
    document.getElementById('ecs-id').value = currentTransfer.ecsData.id;
    document.getElementById('ecs-bank').value = currentTransfer.ecsData.bank;
    document.getElementById('ecs-account').value = currentTransfer.ecsData.account;
  } else {
    document.getElementById('recipient-name').value = currentTransfer.name;
  }
  const amountVal = currentTransfer.amount.split(' ')[0].replace(/,/g, '');
  document.getElementById('send-amount').value = amountVal;
  showView('send');
}

