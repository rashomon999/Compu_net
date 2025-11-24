// ============================================
// js/callUI.js - Interfaz de llamadas mejorada con feedback visual
// ============================================

import { webrtcManager } from './webrtcManager.js';
import { callManager } from './callManager.js';
import { state } from './state.js';
import { showError } from './ui.js';

// ========================================
// INICIAR LLAMADA CON FEEDBACK VISUAL
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
    console.log('🎯 Iniciando proceso de llamada a:', targetUser);
    
    // ✅ PASO 1: Mostrar UI inmediatamente
    showOutgoingCallUI(targetUser);
    modalShown = true;
    updateCallStatus('Solicitando permisos de micrófono...');
    
    // ✅ PASO 2: Pequeño delay para que el usuario vea el modal
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // ✅ Verificar que el modal sigue ahí
    if (!document.getElementById('outgoingCallModal')) {
      console.error('❌ Modal desapareció durante inicialización');
      throw new Error('Modal de llamada fue cerrado prematuramente');
    }
    
    // ✅ PASO 3: Actualizar estado antes de iniciar
    updateCallStatus('Estableciendo conexión...');
    console.log('⏳ Paso 1: Solicitando permisos de micrófono...');
    
    // ✅ PASO 4: Iniciar llamada (esto puede tomar tiempo)
    console.log('⏳ Paso 2: Conectando con servidor ICE...');
    updateCallStatus('Conectando con servidor...');
    
    await callManager.initiateOutgoingCall(targetUser, webrtcManager);
    
    // ✅ Verificar nuevamente que el modal existe
    if (!document.getElementById('outgoingCallModal')) {
      console.warn('⚠️ Modal desapareció durante iniciación de llamada');
      return; // Salir silenciosamente si el usuario canceló
    }
    
    // ✅ PASO 5: Actualizar cuando esté lista
    updateCallStatus('Esperando respuesta...');
    console.log('✅ Llamada en progreso');
    
  } catch (error) {
    console.error('❌ Error iniciando llamada:', error);
    console.error('Stack:', error.stack);
    console.error('Modal shown:', modalShown);
    
    // Solo ocultar si realmente mostramos el modal
    if (modalShown) {
      hideCallUI();
    }
    
    // Mensajes de error más descriptivos
    if (error.name === 'NotAllowedError') {
      showError('❌ Permiso de micrófono denegado. Por favor permite el acceso al micrófono.');
    } else if (error.name === 'NotFoundError') {
      showError('❌ No se encontró ningún micrófono en tu dispositivo');
    } else if (error.message.includes('CallService')) {
      showError('❌ El servidor no soporta llamadas');
      state.callsAvailable = false;
    } else if (error.message.includes('User not found')) {
      showError(`❌ ${targetUser} no está conectado`);
    } else if (error.message.includes('Modal')) {
      // Usuario canceló manualmente
      console.log('ℹ️ Usuario canceló la llamada durante inicialización');
    } else {
      showError('❌ Error al iniciar llamada: ' + error.message);
    }
  }
}

// ========================================
// MOSTRAR LLAMADA SALIENTE CON ESTADOS
// ========================================

function showOutgoingCallUI(targetUser) {
  console.log('🎨 Creando modal de llamada saliente para:', targetUser);
  
  // ⚠️ NO limpiar modales existentes aquí - puede causar que desaparezca
  // Solo eliminar si existe uno con el mismo ID
  const existingModal = document.getElementById('outgoingCallModal');
  if (existingModal) {
    console.log('⚠️ Modal existente encontrado, reemplazando...');
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'outgoingCallModal';
  modal.className = 'call-modal outgoing-call';
  
  // Agregar data attribute para prevenir eliminación accidental
  modal.setAttribute('data-call-active', 'true');
  
  modal.innerHTML = `
    <div class="call-modal-content">
      <div class="call-icon">📞</div>
      <h3>Llamando a</h3>
      <p class="caller-name">${targetUser}</p>
      
      <!-- Estado visual con spinner -->
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
  console.log('✅ Modal añadido al DOM con ID:', modal.id);
  
  // Verificar que se añadió correctamente
  setTimeout(() => {
    const check = document.getElementById('outgoingCallModal');
    if (!check) {
      console.error('❌ CRÍTICO: Modal desapareció inmediatamente después de añadirse!');
    } else {
      console.log('✅ Modal confirmado en DOM después de 50ms');
    }
  }, 50);
  
  // Evento: Cancelar llamada
  const cancelBtn = document.getElementById('cancelCallBtn');
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      console.log('🚫 Usuario canceló la llamada manualmente');
      try {
        await callManager.endCall(webrtcManager);
      } catch (error) {
        console.error('Error cancelando llamada:', error);
      } finally {
        hideCallUI();
      }
    };
  }
}

// ========================================
// ACTUALIZAR ESTADO DE LLAMADA SALIENTE
// ========================================

function updateCallStatus(status) {
  const statusEl = document.getElementById('outgoingCallStatus');
  if (statusEl) {
    statusEl.textContent = status;
    console.log('📝 Estado actualizado:', status);
  }
}

function hideOutgoingCallUI() {
  const modal = document.getElementById('outgoingCallModal');
  if (modal) {
    modal.remove();
  }
}

// ========================================
// MOSTRAR LLAMADA ENTRANTE
// ========================================

export async function showIncomingCallUI(offer) {
  try {
    // Registrar en CallManager (inicia el temporizador automáticamente)
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
    
    // Evento: Aceptar
    document.getElementById('acceptCallBtn').onclick = async () => {
      try {
        await callManager.acceptCall(webrtcManager);
        hideIncomingCallUI();
        showActiveCallUI(offer.caller);
      } catch (error) {
        console.error('❌ Error aceptando llamada:', error);
        hideCallUI();
        showError('Error al aceptar la llamada');
      }
    };
    
    // Evento: Rechazar
    document.getElementById('rejectCallBtn').onclick = async () => {
      try {
        await callManager.rejectCall(webrtcManager, 'USER_REJECTED');
        hideIncomingCallUI();
      } catch (error) {
        console.error('Error rechazando llamada:', error);
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
  if (modal) modal.remove();
  stopRingtone();
}

// ========================================
// MOSTRAR LLAMADA ACTIVA
// ========================================

export function showActiveCallUI(otherUser) {
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
  
  // Evento: Finalizar
  document.getElementById('endCallBtn').onclick = async () => {
    try {
      await callManager.endCall(webrtcManager);
    } catch (error) {
      console.error('Error finalizando llamada:', error);
    } finally {
      hideCallUI();
    }
  };
  
  // Evento: Mutear
  const muteBtn = document.getElementById('muteBtn');
  let isMuted = false;
  muteBtn.onclick = () => {
    isMuted = !isMuted;
    webrtcManager.toggleAudio(!isMuted);
    muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🎤 Micrófono';
    muteBtn.classList.toggle('muted', isMuted);
  };
}

// ========================================
// OCULTAR TODAS LAS UI
// ========================================

export function hideCallUI() {
  console.log('🧹 Limpiando UIs de llamada...');
  
  // Verificar si hay una llamada activa antes de limpiar
  const hasActiveCall = callManager.getActiveCall();
  if (hasActiveCall && hasActiveCall.status === 'RINGING') {
    console.warn('⚠️ Intentando ocultar UI con llamada activa en estado RINGING');
  }
  
  hideIncomingCallUI();
  hideOutgoingCallUI();
  
  const activeModal = document.getElementById('activeCallModal');
  if (activeModal) {
    console.log('🧹 Eliminando modal de llamada activa');
    activeModal.remove();
  }
  
  stopRingtone();
  console.log('✅ Todas las UIs limpiadas');
}

// ========================================
// SONIDO DE LLAMADA
// ========================================

let ringtoneAudio = null;

function playRingtone() {
  console.log('🔔 Reproduciendo tono de llamada...');
  
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
  const modal = document.getElementById('outgoingCallModal');
  if (modal) {
    hideCallUI();
    showError(`❌ ${callInfo.callee} no respondió después de ${callInfo.ringDuration || 60} segundos`);
  } else {
    console.warn('⚠️ Modal ya fue cerrado cuando llegó el timeout');
  }
};

window.onIncomingCallTimeout = (callInfo) => {
  console.log('⏱️ Llamada entrante sin respuesta:', callInfo);
  const modal = document.getElementById('incomingCallModal');
  if (modal) {
    hideCallUI();
    showError(`❌ No respondiste la llamada de ${callInfo.caller} (${callInfo.ringDuration || 60}s)`);
  } else {
    console.warn('⚠️ Modal ya fue cerrado cuando llegó el timeout');
  }
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
  const hasModal = document.getElementById('activeCallModal') || 
                    document.getElementById('outgoingCallModal') || 
                    document.getElementById('incomingCallModal');
  
  if (hasModal) {
    hideCallUI();
  } else {
    console.warn('⚠️ No hay modal para cerrar en onCallEnded');
  }
};