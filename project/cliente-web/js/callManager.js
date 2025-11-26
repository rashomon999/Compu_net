// ============================================
// js/callManager.js - Gestor de Llamadas CORREGIDO
// Sincronización de estado clara y sin carreras
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { audioStreamManager } from './audioStreamManager.js';

const CALL_CONFIG = {
  RING_TIMEOUT: 60000,
  CALL_TIMEOUT: 3600000
};

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
      
      console.log('   ✅ activeCall creado:', this.activeCall);
      
      // Llamar al servidor
      const Ice = window.Ice;
      const callId = await iceClient.initiateCall(
        state.currentUsername,
        targetUser,
        Ice.ChatSystem.CallType.AudioOnly,
        'dummy-sdp'
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
      
      // ✅ CREAR activeCall ANTES de todo
      this.activeCall = {
        id: offer.callId,
        type: 'INCOMING',
        callerId: offer.caller,
        calleeId: state.currentUsername,
        startTime: Date.now(),
        status: 'RINGING',
        offer: offer
      };
      
      console.log('   ✅ activeCall creado:', this.activeCall);
      
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
      
      // ✅ ENVIAR RESPUESTA AL SERVIDOR
      const Ice = window.Ice;
      await iceClient.answerCall(
        this.activeCall.id,
        state.currentUsername,
        'ACCEPTED',
        'dummy-sdp'
      );
      
      // ✅ ACTUALIZAR ESTADO (CRÍTICO)
      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();
      
      console.log('   ✅ Estado actualizado a CONNECTED');
      console.log('   ✅ activeCall:', this.activeCall);
      
      // ✅ INICIAR AUDIO STREAMING
      console.log('   🎤 Iniciando audio streaming...');
      await audioStreamManager.startStreaming();
      console.log('   ✅ Audio streaming iniciado');
      
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
        throw new Error('No hay activeCall para procesar respuesta');
      }

      // ✅ NORMALIZAR STATUS
      let status = this.normalizeStatus(answer.status);
      
      console.log('   📝 Status normalizado:', status);

      this.clearRingTimers();
      
      if (status === 'ACCEPTED') {
        console.log('   ✅ Llamada ACEPTADA');
        
        // Actualizar estado
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
        
        console.log('   ✅ Estado actualizado a CONNECTED');
        
        // ✅ INICIAR AUDIO STREAMING
        console.log('   🎤 Iniciando audio streaming...');
        await audioStreamManager.startStreaming();
        console.log('   ✅ Audio streaming iniciado');
        
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
      console.error('❌ [CALL] Error procesando respuesta:', error);
      throw error;
    }
  }

  // ========================================
  // NORMALIZAR STATUS (ROBUSTO)
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
  // TIMERS VISUALES
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
      
    }, CALL_CONFIG.RING_TIMEOUT);
  }

  setupIncomingRingTimer() {
    this.ringSeconds = 0;
    
    this.ringInterval = setInterval(() => {
      this.ringSeconds++;
    }, 1000);
    
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: No contestaste en 60s');
      
      try {
        const Ice = window.Ice;
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
      
    }, CALL_CONFIG.RING_TIMEOUT);
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
      
      const callInfo = {
        ...this.activeCall,
        totalDuration: this.callDuration
      };
      
      console.log('✅ Llamada finalizada. Duración:', this.callDuration, 's');
      
      this.cleanup();
      
      return callInfo;
      
    } catch (error) {
      console.error('❌ Error finalizando:', error);
      this.cleanup();
    }
  }

  // ========================================
  // UI UPDATES
  // ========================================
  
  updateRingUI(seconds) {
    const el = document.getElementById('outgoingRingTimer');
    if (el) {
      el.textContent = `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
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

  getCallDuration() {
    return this.callDuration;
  }

  getCallStatus() {
    return this.activeCall ? this.activeCall.status : 'IDLE';
  }
}

export const callManager = new CallManager();