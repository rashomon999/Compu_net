// ============================================
// js/callUI.js - CORRECCIÓN: Pasar webrtcManager siempre
// ============================================

import { webrtcManager } from './webrtcManager.js';
import { callManager } from './callManager.js';
import { state } from './state.js';
import { showError } from './ui.js';

// ========================================
// INICIAR LLAMADA
// ========================================

export async function initiateCall(targetUser) {
  if (!targetUser) {
    showError('⚠️ Selecciona un chat primero');
    return;
  }
  
  if (state.isGroup) {
    showError('⚠️ Las llamadas solo están disponibles para chats privados');
    return;
  }
  
  if (state.callsAvailable === false) {
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
    
    // ✅ CRÍTICO: Pasar webrtcManager al callManager
    await callManager.initiateOutgoingCall(targetUser, webrtcManager);
    
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

// ========================================
// MOSTRAR LLAMADA SALIENTE
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
        // ✅ CRÍTICO: Pasar webrtcManager al endCall
        await callManager.endCall(webrtcManager);
      } catch (error) {
        console.error('Error cancelando:', error);
      } finally {
        hideCallUI();
      }
    };
  }
}

// ========================================
// ACTUALIZAR ESTADO DE LLAMADA
// ========================================

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

// ========================================
// MOSTRAR LLAMADA ENTRANTE
// ========================================

export async function showIncomingCallUI(offer) {
  try {
    console.log('📞 [CALL UI] Mostrando llamada entrante de:', offer.caller);
    
    // ✅ CRÍTICO: Pasar webrtcManager a receiveIncomingCall
    await callManager.receiveIncomingCall(offer, webrtcManager);
    
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
      console.log('✅ [CALL UI] Usuario aceptó llamada');
      try {
        // ✅ CRÍTICO: Pasar webrtcManager a acceptCall
        await callManager.acceptCall(webrtcManager);
        hideIncomingCallUI();
        showActiveCallUI(offer.caller);
      } catch (error) {
        console.error('❌ Error aceptando llamada:', error);
        hideCallUI();
        showError('Error al aceptar la llamada');
      }
    };
    
    document.getElementById('rejectCallBtn').onclick = async () => {
      console.log('❌ [CALL UI] Usuario rechazó llamada');
      try {
        // ✅ CRÍTICO: Pasar webrtcManager a rejectCall
        await callManager.rejectCall(webrtcManager, 'USER_REJECTED');
        hideIncomingCallUI();
      } catch (error) {
        console.error('Error rechazando:', error);
        hideIncomingCallUI();
      }
    };
    
    playRingtone();
    
  } catch (error) {
    console.error('❌ Error mostrando llamada entrante:', error);
    showError('Error al recibir llamada');
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

// ========================================
// MOSTRAR LLAMADA ACTIVA
// ========================================

export function showActiveCallUI(otherUser) {
  console.log('📞 [CALL UI] Mostrando UI de llamada activa con:', otherUser);
  
  // Limpiar modales anteriores
  hideIncomingCallUI();
  hideOutgoingCallUI();
  
  // Verificar que realmente hay una llamada conectada
  if (!callManager.isCallActive()) {
    console.warn('⚠️ [CALL UI] Intentando mostrar UI activa sin llamada conectada');
  }
  
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
  console.log('✅ [CALL UI] Modal de llamada activa mostrado');
  
  // Botón de mute
  const muteBtn = document.getElementById('muteBtn');
  let isMuted = false;
  muteBtn.onclick = () => {
    isMuted = !isMuted;
    webrtcManager.toggleAudio(!isMuted);
    muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🎤 Micrófono';
  };
  
  // Botón de finalizar
  document.getElementById('endCallBtn').onclick = async () => {
    console.log('🔚 [CALL UI] Usuario finalizó llamada');
    // ✅ CRÍTICO: Pasar webrtcManager al endCall
    await callManager.endCall(webrtcManager);
    hideCallUI();
  };
}

// ========================================
// OCULTAR TODAS LAS UI
// ========================================

export function hideCallUI() {
  console.log('🧹 [CALL UI] Limpiando TODAS las UIs de llamada');
  
  hideIncomingCallUI();
  hideOutgoingCallUI();
  
  const activeModal = document.getElementById('activeCallModal');
  if (activeModal) {
    console.log('🧹 [CALL UI] Eliminando modal de llamada activa');
    activeModal.remove();
  }
  
  stopRingtone();
  console.log('✅ [CALL UI] Todas las UIs limpiadas');
}

// ========================================
// SONIDO DE LLAMADA
// ========================================

let ringtoneAudio = null;

function playRingtone() {
  console.log('🔔 Reproduciendo tono de llamada');
  
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
    } catch (error) {
      console.error('Error deteniendo ringtone:', error);
    }
    ringtoneAudio = null;
  }
  
  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

// ========================================
// CALLBACKS GLOBALES
// ========================================

window.onCallTimeout = (callInfo) => {
  console.log('⏱️ Llamada sin respuesta:', callInfo);
  hideCallUI();
  showError(`❌ ${callInfo.callee} no respondió después de ${callInfo.ringDuration || 60} segundos`);
};

window.onIncomingCallTimeout = (callInfo) => {
  console.log('⏱️ Llamada entrante sin respuesta:', callInfo);
  hideCallUI();
  showError(`❌ No respondiste la llamada de ${callInfo.caller}`);
};

window.updateCallDuration = (seconds) => {
  const timerEl = document.getElementById('callTimer');
  if (timerEl) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};

window.onCallEnded = () => {
  console.log('📞 Evento de llamada finalizada recibido');
  hideCallUI();
};