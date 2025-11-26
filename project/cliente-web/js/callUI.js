// ============================================
// js/callUI.js - UI de Llamadas CORREGIDA
// ✅ SIN DUPLICAR MODALES
// ============================================

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
    
    // ✅ CRÍTICO: Limpiar modales previos
    hideAllCallModals();
    
    showOutgoingCallUI(targetUser);
    modalShown = true;
    updateCallStatus('Solicitando permisos de micrófono...');
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (!document.getElementById('outgoingCallModal')) {
      throw new Error('Modal de llamada fue cerrado prematuramente');
    }
    
    updateCallStatus('Estableciendo conexión...');
    
    const { simpleCallManager } = await import('./simpleCallManager.js');
    await simpleCallManager.initiateOutgoingCall(targetUser);
    
    if (!document.getElementById('outgoingCallModal')) {
      console.warn('⚠️ Modal desapareció durante iniciación');
      return;
    }
    
    updateCallStatus('Esperando respuesta...');
    console.log('✅ [CALL UI] Llamada en progreso, esperando respuesta');
    
  } catch (error) {
    console.error('❌ [CALL UI] Error:', error);
    
    if (modalShown) {
      hideAllCallModals();
    }
    
    const { showError } = await import('./ui.js');
    
    if (error.name === 'NotAllowedError') {
      showError('❌ Permiso de micrófono denegado');
    } else if (error.name === 'NotFoundError') {
      showError('❌ No se encontró ningún micrófono');
    } else if (error.message.includes('AudioSubject')) {
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

export async function showIncomingCallUI(offer) {
  try {
    console.log('📞 [UI] Mostrando llamada entrante de:', offer.caller);
    
    // ✅ CRÍTICO: NO duplicar modales
    hideAllCallModals();
    
    const { simpleCallManager } = await import('./simpleCallManager.js');
    await simpleCallManager.receiveIncomingCall(offer.caller);
    
    const modal = document.createElement('div');
    modal.id = 'incomingCallModal';
    modal.className = 'call-modal incoming-call';
    
    modal.innerHTML = `
      <div class="call-modal-content">
        <div class="call-icon pulsing">📞</div>
        <h3>Llamada entrante</h3>
        <p class="caller-name">${offer.caller}</p>
        <p class="call-type">Llamada de audio</p>
        <p class="call-ring-timer" id="incomingRingTimer">60 segundos restantes</p>
        
        <div class="call-actions">
          <button class="btn-accept-call" id="acceptCallBtn">
            ✅ Aceptar
          </button>
          <button class="btn-reject-call" id="rejectCallBtn">
            ❌ Rechazar
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // ✅ USAR: Variables finales para evitar closure issues
    const caller = offer.caller;
    
    document.getElementById('acceptCallBtn').onclick = async () => {
      console.log('✅ [UI] Usuario aceptó');
      
      try {
        await simpleCallManager.acceptCall();
        hideAllCallModals();
        showActiveCallUI(caller);
      } catch (error) {
        console.error('❌ Error aceptando:', error);
        hideAllCallModals();
        const { showError } = await import('./ui.js');
        showError('Error al aceptar la llamada');
      }
    };
    
    document.getElementById('rejectCallBtn').onclick = async () => {
      console.log('❌ [UI] Usuario rechazó');
      
      try {
        await simpleCallManager.rejectCall();
        hideAllCallModals();
      } catch (error) {
        console.error('Error rechazando:', error);
        hideAllCallModals();
      }
    };
    
    playRingtone();
    
  } catch (error) {
    console.error('❌ Error mostrando llamada:', error);
    const { showError } = await import('./ui.js');
    showError('Error al recibir llamada');
  }
}

export function showActiveCallUI(otherUser) {
  console.log('📞 [UI] Mostrando llamada activa con:', otherUser);
  
  // ✅ CRÍTICO: Limpiar otros modales
  hideAllCallModals();
  
  const modal = document.createElement('div');
  modal.id = 'activeCallModal';
  modal.className = 'call-modal active-call';
  
  modal.innerHTML = `
    <div class="call-modal-content">
      <div class="call-header">
        <div class="call-icon active">📞</div>
        <h3>En llamada con</h3>
        <p class="caller-name">${otherUser}</p>
        <p class="call-timer" id="callTimer">00:00</p>
      </div>
      
      <div class="call-controls">
        <button class="btn-call-control" id="muteBtn" title="Silenciar">
          🎤 Micrófono
        </button>
        
        <button class="btn-end-call" id="endCallBtn">
          ❌ Finalizar
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  console.log('✅ [UI] Modal activo mostrado');
  
  const muteBtn = document.getElementById('muteBtn');
  let isMuted = false;
  
  muteBtn.onclick = async () => {
    const { simpleAudioStream } = await import('./simpleAudioStream.js');
    isMuted = !isMuted;
    simpleAudioStream.toggleMute(isMuted);
    muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🎤 Micrófono';
  };
  
  document.getElementById('endCallBtn').onclick = async () => {
    console.log('🔚 [UI] Finalizando llamada');
    const { simpleCallManager } = await import('./simpleCallManager.js');
    await simpleCallManager.endCall();
    hideAllCallModals();
  };
}

// ✅ NUEVA FUNCIÓN: Eliminar TODOS los modales de llamadas
function hideAllCallModals() {
  console.log('🧹 [UI] Limpiando todas las UIs de llamadas');
  
  const modals = [
    document.getElementById('incomingCallModal'),
    document.getElementById('outgoingCallModal'),
    document.getElementById('activeCallModal')
  ];
  
  modals.forEach(modal => {
    if (modal) {
      console.log('   Removiendo:', modal.id);
      modal.remove();
    }
  });
  
  stopRingtone();
}

export function hideCallUI() {
  console.log('🧹 [UI] Limpiando UI de llamadas');
  hideAllCallModals();
}

function showOutgoingCallUI(targetUser) {
  console.log('🎨 [CALL UI] Mostrando modal de llamada saliente');
  
  // ✅ CRÍTICO: Remover cualquier modal existente primero
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
        const { simpleCallManager } = await import('./simpleCallManager.js');
        await simpleCallManager.endCall();
      } catch (error) {
        console.error('Error cancelando:', error);
      } finally {
        hideAllCallModals();
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

let ringtoneAudio = null;

function playRingtone() {
  try {
    // Detener ringtone anterior si existe
    if (ringtoneAudio) {
      stopRingtone();
    }
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.2;
    
    oscillator.start();
    
    if (navigator.vibrate) {
      navigator.vibrate([500, 500, 500, 500]);
    }
    
    ringtoneAudio = { oscillator, audioContext };
  } catch (error) {
    console.error('Error reproduciendo ringtone:', error);
  }
}

function stopRingtone() {
  if (ringtoneAudio) {
    try {
      ringtoneAudio.oscillator.stop();
      ringtoneAudio.audioContext.close();
    } catch (error) {}
    ringtoneAudio = null;
  }
  
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

window.updateCallDuration = (seconds) => {
  const timerEl = document.getElementById('callTimer');
  if (timerEl) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};