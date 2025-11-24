// ============================================
// js/audioUI.js - Funciones de UI para audio
// ============================================

import { audioManager } from './audioManager.js';
import { state } from './state.js';
import { loadHistory } from './messages.js';

let recordingTimer = null;

// ========================================
// NOTAS DE VOZ
// ========================================

export async function toggleRecording() {
  if (!state.currentChat) {
    alert('⚠️ Selecciona un chat primero');
    return;
  }

  const recordButton = document.getElementById('recordButton');
  const timerDisplay = document.getElementById('recordingTimer');
  const cancelButton = document.getElementById('cancelButton');

  if (audioManager.isCurrentlyRecording()) {
    // DETENER Y ENVIAR grabación
    recordButton.disabled = true;
    recordButton.textContent = '⏳ Enviando...';

    try {
      const success = await audioManager.sendVoiceNote(
        state.currentChat,
        state.isGroup
      );

      if (success) {
        console.log('✅ Nota de voz enviada');
        // Recargar historial para mostrar la nota
        setTimeout(() => {
          loadHistory(state.currentChat, state.isGroup, false);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error enviando nota de voz:', error);
      alert('Error al enviar la nota de voz: ' + error.message);
    }

    // Resetear UI
    recordButton.textContent = '🎤 Grabar nota de voz';
    recordButton.disabled = false;
    recordButton.classList.remove('recording');
    timerDisplay.classList.add('hidden');
    cancelButton.classList.add('hidden');
    
    clearInterval(recordingTimer);
    
  } else {
    // INICIAR grabación
    const started = await audioManager.startRecording();
    
    if (started) {
      recordButton.textContent = '⏹️ Detener y enviar';
      recordButton.classList.add('recording');
      timerDisplay.classList.remove('hidden');
      cancelButton.classList.remove('hidden');
      timerDisplay.textContent = '0:00';

      // Iniciar contador visual
      const startTime = Date.now();
      recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Auto-detener a los 30 segundos
        if (elapsed >= 30) {
          toggleRecording();
        }
      }, 100);
    }
  }
}

export function cancelRecording() {
  audioManager.cancelRecording();
  
  const recordButton = document.getElementById('recordButton');
  const timerDisplay = document.getElementById('recordingTimer');
  const cancelButton = document.getElementById('cancelButton');
  
  recordButton.textContent = '🎤 Grabar nota de voz';
  recordButton.classList.remove('recording');
  recordButton.disabled = false;
  timerDisplay.classList.add('hidden');
  cancelButton.classList.add('hidden');
  
  clearInterval(recordingTimer);
  
  console.log('🚫 Grabación cancelada');
}

// ========================================
// MENÚ DE AUDIO
// ========================================

export function toggleAudioMenu() {
  const audioControls = document.getElementById('audioControls');
  
  if (audioControls.classList.contains('hidden')) {
    showAudioControls();
  } else {
    hideAudioControls();
  }
}

export function showAudioControls() {
  document.getElementById('audioControls').classList.remove('hidden');
}

export function hideAudioControls() {
  document.getElementById('audioControls').classList.add('hidden');
  
  // Si hay grabación activa, cancelarla
  if (audioManager.isCurrentlyRecording()) {
    cancelRecording();
  }
}

// ========================================
// REPRODUCIR NOTA DE VOZ
// ========================================

export async function playVoiceNote(audioFileRef) {
  try {
    console.log('🔊 Reproduciendo nota de voz:', audioFileRef);
    await audioManager.playVoiceNote(audioFileRef);
  } catch (error) {
    console.error('❌ Error reproduciendo:', error);
    throw error; // Re-lanzar para que messages.js lo maneje
  }
}

// ✅ Exportar también para uso global (compatibilidad)
if (typeof window !== 'undefined') {
  window.playVoiceNote = playVoiceNote;
}