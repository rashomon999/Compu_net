// ============================================
// js/callUI.js - UI de Llamadas (COMPLETO)
// ============================================

// ✅ EXPORTAR initiateCall AL INICIO
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
    
    showOutgoingCallUI(targetUser);
    modalShown = true;
    updateCallStatus('Solicitando permisos de micrófono...');
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    if (!document.getElementById('outgoingCallModal')) {
      throw new Error('Modal de llamada fue cerrado prematuramente');
    }
    
    updateCallStatus('Estableciendo conexión...');
    
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

// ✅ EXPORTAR showIncomingCallUI
export async function showIncomingCallUI(offer) {
  try {
    console.log('📞 [UI] Mostrando llamada entrante de:', offer.caller);
    
    const { callManager } = await import('./callManager.js');
    await callManager.receiveIncomingCall(offer);
    
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
    
    document.getElementById('acceptCallBtn').onclick = async () => {
      console.log('✅ [UI] Usuario aceptó');
      
      try {
        await callManager.acceptCall();
        hideIncomingCallUI();
        showActiveCallUI(offer.caller);
      } catch (error) {
        console.error('❌ Error aceptando:', error);
        hideCallUI();
        const { showError } = await import('./ui.js');
        showError('Error al aceptar la llamada');
      }
    };
    
    document.getElementById('rejectCallBtn').onclick = async () => {
      console.log('❌ [UI] Usuario rechazó');
      
      try {
        await callManager.rejectCall('USER_REJECTED');
        hideIncomingCallUI();
      } catch (error) {
        console.error('Error rechazando:', error);
        hideIncomingCallUI();
      }
    };
    
    playRingtone();
    
  } catch (error) {
    console.error('❌ Error mostrando llamada:', error);
    const { showError } = await import('./ui.js');
    showError('Error al recibir llamada');
  }
}

// ✅ EXPORTAR showActiveCallUI
export function showActiveCallUI(otherUser) {
  console.log('📞 [UI] Mostrando llamada activa con:', otherUser);
  
  hideIncomingCallUI();
  hideOutgoingCallUI();
  
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
    const { audioStreamManager } = await import('./audioStreamManager.js');
    isMuted = !isMuted;
    audioStreamManager.toggleMute(isMuted);
    muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🎤 Micrófono';
  };
  
  document.getElementById('endCallBtn').onclick = async () => {
    console.log('🔚 [UI] Finalizando llamada');
    const { callManager } = await import('./callManager.js');
    await callManager.endCall();
    hideCallUI();
  };
}

// ✅ EXPORTAR hideCallUI
export function hideCallUI() {
  console.log('🧹 [UI] Limpiando todas las UIs');
  
  hideIncomingCallUI();
  hideOutgoingCallUI();
  
  const activeModal = document.getElementById('activeCallModal');
  if (activeModal) {
    activeModal.remove();
  }
  
  stopRingtone();
  console.log('✅ [UI] Limpieza completa');
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

let ringtoneAudio = null;

function playRingtone() {
  try {
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

// ✅ EXPORTAR updateCallDuration para uso global
window.updateCallDuration = (seconds) => {
  const timerEl = document.getElementById('callTimer');
  if (timerEl) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};