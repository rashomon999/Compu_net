// ============================================
// js/callUI.js - AGREGAR ESTO AL INICIO DEL ARCHIVO
// ============================================

// ✅ EXPORTAR ESTAS FUNCIONES (deben estar al inicio)
export async function initiateCall(targetUser) {
  if (!targetUser) {
    const { showError } = await import('./ui.js');
    showError('⚠️ Selecciona un chat primero');
    return;
  }
  
  const { state } = await import('./state.js');
  if (state.isGroup) {
    const { showError } = await import('./ui.js');
    showError('⚠️ Las llamadas solo están disponibles para chats privados');
    return;
  }
  
  if (state.callsAvailable === false) {
    const { showError } = await import('./ui.js');
    showError('❌ Las llamadas no están disponibles en el servidor');
    return;
  }
  
  let modalShown = false;
  
  try {
    console.log('🎯 [CALL UI] Iniciando proceso de llamada a:', targetUser);
    
    // Mostrar UI inmediatamente
    showOutgoingCallUI(targetUser);
    modalShown = true;
    updateCallStatus('Solicitando permisos de micrófono...');
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (!document.getElementById('outgoingCallModal')) {
      throw new Error('Modal de llamada fue cerrado prematuramente');
    }
    
    updateCallStatus('Estableciendo conexión...');
    
    // Iniciar llamada
    const { callManager } = await import('./callManager.js');
    await callManager.initiateOutgoingCall(targetUser);
    
    if (!document.getElementById('outgoingCallModal')) {
      console.warn('⚠️ Modal desapareció durante iniciación');
      return;
    }
    
    updateCallStatus('Esperando respuesta...');
    console.log('✅ [CALL UI] Llamada en progreso, esperando respuesta');
    
  } catch (error) {
    console.error('❌ [CALL UI] Error:', error);
    
    if (modalShown) {
      hideCallUI();
    }
    
    const { showError } = await import('./ui.js');
    
    if (error.name === 'NotAllowedError') {
      showError('❌ Permiso de micrófono denegado');
    } else if (error.name === 'NotFoundError') {
      showError('❌ No se encontró ningún micrófono');
    } else if (error.message.includes('CallService')) {
      showError('❌ El servidor no soporta llamadas');
      state.callsAvailable = false;
    } else if (error.message.includes('User not found')) {
      showError(`❌ ${targetUser} no está conectado`);
    } else if (error.message.includes('Modal')) {
      console.log('ℹ️ Usuario canceló la llamada');
    } else {
      showError('❌ Error al iniciar llamada: ' + error.message);
    }
  }
}

// ✅ Mantener estas funciones que ya existen
export async function showIncomingCallUI(offer) {
  // ... tu código existente
}

export function showActiveCallUI(otherUser) {
  // ... tu código existente
}

export function hideCallUI() {
  // ... tu código existente
}

// ========================================
// FUNCIONES INTERNAS (no exportadas)
// ========================================

function showOutgoingCallUI(targetUser) {
  console.log('🎨 [CALL UI] Mostrando modal de llamada saliente');
  
  const existingModal = document.getElementById('outgoingCallModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'outgoingCallModal';
  modal.className = 'call-modal outgoing-call';
  modal.setAttribute('data-call-active', 'true');
  
  modal.innerHTML = `
    <div class="call-modal-content">
      <div class="call-icon">📞</div>
      <h3>Llamando a</h3>
      <p class="caller-name">${targetUser}</p>
      
      <div class="call-status-container">
        <div class="spinner"></div>
        <p class="call-status" id="outgoingCallStatus">Iniciando llamada...</p>
      </div>
      
      <p class="call-ring-timer" id="outgoingRingTimer" style="opacity: 0.7;">0 segundos</p>
      
      <div class="call-actions">
        <button class="btn-end-call" id="cancelCallBtn">
          ❌ Cancelar
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const cancelBtn = document.getElementById('cancelCallBtn');
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      console.log('🚫 [CALL UI] Usuario canceló la llamada');
      try {
        const { callManager } = await import('./callManager.js');
        await callManager.endCall();
      } catch (error) {
        console.error('Error cancelando:', error);
      } finally {
        hideCallUI();
      }
    };
  }
}

function updateCallStatus(status) {
  const statusEl = document.getElementById('outgoingCallStatus');
  if (statusEl) {
    statusEl.textContent = status;
    console.log('📝 [CALL UI] Estado actualizado:', status);
  }
}

function hideOutgoingCallUI() {
  const modal = document.getElementById('outgoingCallModal');
  if (modal) {
    console.log('🧹 [CALL UI] Ocultando modal de llamada saliente');
    modal.remove();
  }
}

function hideIncomingCallUI() {
  const modal = document.getElementById('incomingCallModal');
  if (modal) {
    console.log('🧹 [CALL UI] Ocultando modal de llamada entrante');
    modal.remove();
  }
  stopRingtone();
}

// Rest del código existente...