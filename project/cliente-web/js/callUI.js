// ============================================
// js/callUI.js - SECCIÓN CRÍTICA
// Actualizar estos métodos en tu callUI.js existente
// ============================================

// ⚠️ REEMPLAZAR tu showIncomingCallUI con esta:
export async function showIncomingCallUI(offer) {
  try {
    console.log('📞 [UI] Mostrando llamada entrante de:', offer.caller);
    
    // ✅ Primero: configurar la llamada en callManager
    const { callManager } = await import('./callManager.js');
    await callManager.receiveIncomingCall(offer);
    
    // ✅ Mostrar modal
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
    
    // ✅ ACEPTAR
    document.getElementById('acceptCallBtn').onclick = async () => {
      console.log('✅ [UI] Usuario aceptó');
      
      try {
        // 1. Aceptar en callManager (inicia audio)
        await callManager.acceptCall();
        
        // 2. Ocultar modal entrante
        hideIncomingCallUI();
        
        // 3. Mostrar UI activa
        showActiveCallUI(offer.caller);
        
      } catch (error) {
        console.error('❌ Error aceptando:', error);
        hideCallUI();
        const { showError } = await import('./ui.js');
        showError('Error al aceptar la llamada');
      }
    };
    
    // ✅ RECHAZAR
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

// ⚠️ REEMPLAZAR tu showActiveCallUI con esta:
export function showActiveCallUI(otherUser) {
  console.log('📞 [UI] Mostrando llamada activa con:', otherUser);
  
  hideIncomingCallUI();
  
  const { callManager } = require('./callManager.js');
  if (!callManager.isCallActive()) {
    console.warn('⚠️ Llamada no está realmente activa');
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
  console.log('✅ [UI] Modal activo mostrado');
  
  // MUTE
  const muteBtn = document.getElementById('muteBtn');
  let isMuted = false;
  
  muteBtn.onclick = async () => {
    const { audioStreamManager } = await import('./audioStreamManager.js');
    isMuted = !isMuted;
    audioStreamManager.toggleMute(isMuted);
    muteBtn.textContent = isMuted ? '🔇 Silenciado' : '🎤 Micrófono';
  };
  
  // END CALL
  document.getElementById('endCallBtn').onclick = async () => {
    console.log('🔚 [UI] Finalizando llamada');
    const { callManager } = await import('./callManager.js');
    await callManager.endCall();
    hideCallUI();
  };
}

// ⚠️ MANTENER igual:
function hideIncomingCallUI() {
  const modal = document.getElementById('incomingCallModal');
  if (modal) {
    console.log('🧹 Ocultando modal entrante');
    modal.remove();
  }
  stopRingtone();
}

export function hideCallUI() {
  console.log('🧹 [UI] Limpiando todas las UIs');
  
  hideIncomingCallUI();
  
  const activeModal = document.getElementById('activeCallModal');
  if (activeModal) {
    activeModal.remove();
  }
  
  const outgoingModal = document.getElementById('outgoingCallModal');
  if (outgoingModal) {
    outgoingModal.remove();
  }
  
  stopRingtone();
  console.log('✅ [UI] Limpieza completa');
}

// ⚠️ MANTENER igual:
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

window.updateCallDuration = (seconds) => {
  const timerEl = document.getElementById('callTimer');
  if (timerEl) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};