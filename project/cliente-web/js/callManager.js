// ============================================
// js/callManager.js - Gestor de Llamadas SIMPLIFICADO
// Sin WebRTC, solo PCM directo por Ice
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { audioStreamManager } from './audioStreamManager.js';

class CallManager {
  constructor() {
    this.activeCall = null;
    this.ringTimer = null;
    this.ringInterval = null;
    this.callTimer = null;
    this.callStartTime = null;
    this.callDuration = 0;
    this.ringSeconds = 0;
  }

  // ========================================
  // INICIAR LLAMADA SALIENTE
  // ========================================
  async initiateOutgoingCall(targetUser) {
    try {
      console.log('📞 [CALL] Iniciando llamada a:', targetUser);
      
      // ✅ CREAR activeCall ANTES de todo
      this.activeCall = {
        id: null,
        type: 'OUTGOING',
        callerId: state.currentUsername,
        calleeId: targetUser,
        startTime: Date.now(),
        status: 'INITIATING'
      };
      
      console.log('   ✅ activeCall creado');
      
      // Llamar al servidor (SIN SDP - no se usa WebRTC)
      const Ice = window.Ice;
      const callId = await iceClient.initiateCall(
        state.currentUsername,
        targetUser,
        Ice.ChatSystem.CallType.AudioOnly,
        '' // SDP vacío - no se usa
      );
      
      // Extraer ID
      const finalCallId = callId.startsWith('SUCCESS:') ? callId.substring(8) : callId;
      
      // Actualizar activeCall
      this.activeCall.id = finalCallId;
      this.activeCall.status = 'RINGING';
      
      console.log('   ✅ Llamada iniciada con ID:', finalCallId);
      
      // Setup timer visual
      this.setupOutgoingRingTimer();
      
      return finalCallId;
      
    } catch (error) {
      console.error('❌ [CALL] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // RECIBIR LLAMADA ENTRANTE
  // ========================================
  async receiveIncomingCall(offer) {
    try {
      console.log('📞 [CALL] Llamada entrante de:', offer.caller);
      
      // ✅ CREAR activeCall
      this.activeCall = {
        id: offer.callId,
        type: 'INCOMING',
        callerId: offer.caller,
        calleeId: state.currentUsername,
        startTime: Date.now(),
        status: 'RINGING',
        offer: offer
      };
      
      console.log('   ✅ activeCall creado');
      
      this.setupIncomingRingTimer();
      
      return this.activeCall;
      
    } catch (error) {
      console.error('❌ [CALL] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // ACEPTAR LLAMADA
  // ========================================
  async acceptCall() {
    try {
      if (!this.activeCall || this.activeCall.type !== 'INCOMING') {
        throw new Error('No hay llamada entrante para aceptar');
      }
      
      console.log('✅ [CALL] Aceptando llamada después de', this.ringSeconds, 's');
      
      // Limpiar timers de ring
      this.clearRingTimers();
      
      // ✅ ENVIAR RESPUESTA AL SERVIDOR (sin SDP)
      await iceClient.answerCall(
        this.activeCall.id,
        state.currentUsername,
        'ACCEPTED',
        '' // SDP vacío
      );
      
      // ✅ ACTUALIZAR ESTADO
      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();
      
      console.log('   ✅ Estado: CONNECTED');
      
      // ✅ INICIAR AUDIO STREAMING
      console.log('   🎤 Iniciando audio...');
      await audioStreamManager.startStreaming();
      console.log('   ✅ Audio streaming activo');
      
      // Iniciar contador
      this.startDurationTimer();
      
    } catch (error) {
      console.error('❌ [CALL] Error aceptando:', error);
      throw error;
    }
  }

  // ========================================
  // MANEJAR RESPUESTA DE LLAMADA
  // ========================================
  async handleCallAnswer(answer) {
    try {
      console.log('📥 [CALL] Procesando respuesta:', answer.status);
      
      if (!this.activeCall) {
        throw new Error('No hay activeCall');
      }

      // ✅ NORMALIZAR STATUS
      let status = this.normalizeStatus(answer.status);
      
      console.log('   📝 Status:', status);

      this.clearRingTimers();
      
      if (status === 'ACCEPTED') {
        console.log('   ✅ Llamada ACEPTADA');
        
        // Actualizar estado
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
        
        // ✅ INICIAR AUDIO
        console.log('   🎤 Iniciando audio...');
        await audioStreamManager.startStreaming();
        console.log('   ✅ Audio streaming activo');
        
        // Iniciar contador
        this.startDurationTimer();
        
      } else if (status === 'REJECTED') {
        console.log('   ❌ Llamada RECHAZADA');
        this.activeCall.status = 'REJECTED';
        this.cleanup();
        
      } else {
        console.warn('   ⚠️ Estado desconocido:', status);
      }
      
    } catch (error) {
      console.error('❌ [CALL] Error:', error);
      throw error;
    }
  }

  // ========================================
  // NORMALIZAR STATUS
  // ========================================
  normalizeStatus(status) {
    if (typeof status === 'string') {
      return status.toUpperCase();
    }
    
    if (typeof status === 'number') {
      const map = {
        0: 'RINGING',
        1: 'ACCEPTED',
        2: 'REJECTED',
        3: 'ENDED',
        4: 'BUSY',
        5: 'NOANSWER'
      };
      return map[status] || 'UNKNOWN';
    }
    
    if (status && typeof status === 'object') {
      if (status._name) return status._name.toUpperCase();
      if (status.name) return status.name.toUpperCase();
      if (status._value !== undefined) {
        const map = {
          0: 'RINGING',
          1: 'ACCEPTED',
          2: 'REJECTED',
          3: 'ENDED',
          4: 'BUSY',
          5: 'NOANSWER'
        };
        return map[status._value] || 'UNKNOWN';
      }
    }
    
    return 'UNKNOWN';
  }

  // ========================================
  // RECHAZAR LLAMADA
  // ========================================
  async rejectCall(reason = 'REJECTED') {
    try {
      console.log('❌ [CALL] Rechazando:', reason);
      
      this.clearRingTimers();
      
      if (this.activeCall) {
        await iceClient.answerCall(
          this.activeCall.id,
          state.currentUsername,
          'REJECTED',
          ''
        );
      }
      
      this.cleanup();
      
    } catch (error) {
      console.error('❌ [CALL] Error rechazando:', error);
      this.cleanup();
    }
  }

  // ========================================
  // TIMERS
  // ========================================
  
  setupOutgoingRingTimer() {
    this.ringSeconds = 0;
    
    this.ringInterval = setInterval(() => {
      this.ringSeconds++;
      this.updateRingUI(this.ringSeconds);
    }, 1000);
    
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: Sin respuesta después de 60s');
      
      try {
        await iceClient.endCall(this.activeCall.id, state.currentUsername);
      } catch (err) {
        console.error('Error finalizando:', err);
      }
      
      this.cleanup();
      
    }, 60000);
  }

  setupIncomingRingTimer() {
    this.ringSeconds = 0;
    
    this.ringInterval = setInterval(() => {
      this.ringSeconds++;
    }, 1000);
    
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: No contestaste en 60s');
      
      try {
        await iceClient.answerCall(
          this.activeCall.id,
          state.currentUsername,
          'REJECTED',
          ''
        );
      } catch (err) {
        console.error('Error auto-rechazando:', err);
      }
      
      this.cleanup();
      
    }, 60000);
  }

  startDurationTimer() {
    this.callStartTime = Date.now();
    this.callDuration = 0;
    
    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);
      
      if (window.updateCallDuration) {
        window.updateCallDuration(this.callDuration);
      }
      
    }, 1000);
  }

  updateRingUI(seconds) {
    const el = document.getElementById('outgoingRingTimer');
    if (el) {
      el.textContent = `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    }
  }

  // ========================================
  // FINALIZAR LLAMADA
  // ========================================
  async endCall() {
    try {
      if (!this.activeCall) return;
      
      console.log('📞 Finalizando llamada:', this.activeCall.id);
      
      this.clearAllTimers();
      
      // ✅ DETENER AUDIO
      audioStreamManager.cleanup();
      
      if (this.activeCall.id) {
        try {
          await iceClient.endCall(this.activeCall.id, state.currentUsername);
        } catch (err) {
          console.warn('⚠️ Error notificando fin:', err);
        }
      }
      
      this.activeCall.status = 'ENDED';
      
      console.log('✅ Llamada finalizada. Duración:', this.callDuration, 's');
      
      this.cleanup();
      
    } catch (error) {
      console.error('❌ Error finalizando:', error);
      this.cleanup();
    }
  }

  // ========================================
  // CLEANUP
  // ========================================
  
  clearRingTimers() {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    if (this.ringInterval) clearInterval(this.ringInterval);
    this.ringTimer = null;
    this.ringInterval = null;
    this.ringSeconds = 0;
  }

  clearCallTimer() {
    if (this.callTimer) clearInterval(this.callTimer);
    this.callTimer = null;
  }

  clearAllTimers() {
    this.clearRingTimers();
    this.clearCallTimer();
  }

  cleanup() {
    console.log('🧹 [CALL] Limpiando...');
    this.clearAllTimers();
    this.activeCall = null;
    this.callDuration = 0;
    this.callStartTime = null;
    this.ringSeconds = 0;
  }

  // ========================================
  // GETTERS
  // ========================================
  
  getActiveCall() {
    return this.activeCall;
  }

  isCallActive() {
    return this.activeCall && this.activeCall.status === 'CONNECTED';
  }
}

export const callManager = new CallManager();

// ✅ CRÍTICO: Exponer globalmente para evitar múltiples instancias
if (typeof window !== 'undefined') {
  window._callManager = callManager;
  
  // Debug helper
  window._debugCallManager = () => {
    console.log('📞 [DEBUG] Estado de callManager:');
    console.log('   activeCall:', callManager.activeCall);
    console.log('   isCallActive:', callManager.isCallActive());
    console.log('   callDuration:', callManager.callDuration);
  };
}