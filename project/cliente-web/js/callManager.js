// ============================================
// js/callManager.js - CORREGIDO: Transiciones de estado
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';

const CALL_CONFIG = {
  RING_TIMEOUT: 60000,
  CALL_TIMEOUT: 3600000,
  WARNING_TIME: 45000
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
  
  async initiateOutgoingCall(targetUser, webrtcManager) {
    try {
      console.log('📞 [SALIENTE] Iniciando llamada a', targetUser);
      
      this.activeCall = {
        id: null,
        type: 'OUTGOING',
        callerId: state.currentUsername,
        calleeId: targetUser,
        startTime: Date.now(),
        status: 'RINGING',
        duration: 0
      };
      
      // Iniciar WebRTC
      const callId = await webrtcManager.initiateCall(targetUser, false);
      this.activeCall.id = callId;
      
      console.log('✅ [SALIENTE] Llamada iniciada con ID:', callId);
      
      // Configurar timeout visual
      this.setupOutgoingRingTimer();
      
      return callId;
      
    } catch (error) {
      console.error('❌ [SALIENTE] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // MANEJAR RESPUESTA (LLAMADO POR auth.js)
  // ========================================
  
  async handleCallAnswer(answer, webrtcManager) {
    try {
      console.log('📥 [CALL MANAGER] Procesando respuesta:', answer.status);
      
      if (!this.activeCall) {
        console.warn('⚠️ No hay llamada activa para procesar respuesta');
        return;
      }

      // ✅ Normalizar status
      let normalizedStatus = answer.status;
      if (typeof answer.status === 'number') {
        const statusMap = { 0: 'Ringing', 1: 'Accepted', 2: 'Rejected', 3: 'Ended', 4: 'Busy', 5: 'NoAnswer' };
        normalizedStatus = statusMap[answer.status];
      } else if (typeof answer.status === 'object' && answer.status.name) {
        normalizedStatus = answer.status.name;
      }
      
      console.log('📝 [CALL MANAGER] Status normalizado:', normalizedStatus);

      // ✅ CRÍTICO: Limpiar timers de ring
      this.clearRingTimers();
      
      if (normalizedStatus === 'Accepted' || normalizedStatus === 'ACCEPTED' || normalizedStatus === 1) {
        console.log('✅ [CALL MANAGER] Llamada ACEPTADA, cambiando a CONNECTED');
        
        // Cambiar estado
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
        this.activeCall.ringDuration = this.ringSeconds;
        
        // Procesar SDP en WebRTC
        await webrtcManager.handleCallAnswer(answer);
        
        // Iniciar contador de duración
        this.startDurationTimer();
        
        console.log('✅ [CALL MANAGER] Transición a CONNECTED completada');
        
      } else if (normalizedStatus === 'Rejected' || normalizedStatus === 'REJECTED' || normalizedStatus === 2) {
        console.log('❌ [CALL MANAGER] Llamada RECHAZADA');
        this.activeCall.status = 'REJECTED';
        this.cleanup();
        
      } else {
        console.warn('⚠️ [CALL MANAGER] Estado desconocido:', { original: answer.status, normalized: normalizedStatus });
      }
      
    } catch (error) {
      console.error('❌ [CALL MANAGER] Error procesando respuesta:', error);
      throw error;
    }
  }

  // ========================================
  // TEMPORIZADOR VISUAL PARA LLAMADA SALIENTE
  // ========================================
  
  setupOutgoingRingTimer() {
    this.ringSeconds = 0;
    
    this.ringInterval = setInterval(() => {
      this.ringSeconds++;
      this.updateRingUI(this.ringSeconds);
      
      if (this.ringSeconds > 45) {
        this.setRingUIColor('#ff9500');
      }
      
      if (this.ringSeconds > 55) {
        this.setRingUIColor('#ff3b30');
      }
      
    }, 1000);
    
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: Sin respuesta después de 60 segundos');
      
      this.activeCall.status = 'NO_ANSWER';
      
      try {
        const { webrtcManager } = await import('./webrtcManager.js');
        await webrtcManager.endCall();
      } catch (err) {
        console.error('Error finalizando llamada:', err);
      }
      
      if (window.onCallTimeout) {
        window.onCallTimeout({
          caller: state.currentUsername,
          callee: this.activeCall.calleeId,
          reason: 'NO_ANSWER',
          ringDuration: this.ringSeconds
        });
      }
      
      this.cleanup();
      
    }, CALL_CONFIG.RING_TIMEOUT);
  }

  // ========================================
  // RECIBIR LLAMADA ENTRANTE
  // ========================================
  
  async receiveIncomingCall(offer, webrtcManager) {
    try {
      console.log('📞 [ENTRANTE] Llamada de', offer.caller);
      
      this.activeCall = {
        id: offer.callId,
        type: 'INCOMING',
        callerId: offer.caller,
        calleeId: state.currentUsername,
        startTime: Date.now(),
        status: 'RINGING',
        duration: 0,
        offer: offer
      };
      
      this.setupIncomingRingTimer();
      
      return this.activeCall;
      
    } catch (error) {
      console.error('❌ [ENTRANTE] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // TEMPORIZADOR PARA LLAMADA ENTRANTE
  // ========================================
  
  setupIncomingRingTimer() {
    this.ringSeconds = 0;
    
    this.ringInterval = setInterval(() => {
      this.ringSeconds++;
      
      const remaining = 60 - this.ringSeconds;
      this.updateIncomingRingUI(this.ringSeconds, remaining);
      
      if (remaining <= 15) {
        this.setIncomingRingUIColor('#ff9500');
      }
      
      if (remaining <= 5) {
        this.setIncomingRingUIColor('#ff3b30');
      }
      
    }, 1000);
    
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: No contestaste en 60 segundos');
      
      this.activeCall.status = 'NO_ANSWER';
      
      try {
        const { webrtcManager } = await import('./webrtcManager.js');
        await webrtcManager.answerCall(this.activeCall.offer, false);
        await iceClient.endCall(this.activeCall.id, state.currentUsername);
      } catch (err) {
        console.error('Error rechazando automáticamente:', err);
      }
      
      if (window.onIncomingCallTimeout) {
        window.onIncomingCallTimeout({
          caller: this.activeCall.callerId,
          reason: 'USER_NO_ANSWER',
          ringDuration: this.ringSeconds
        });
      }
      
      this.cleanup();
      
    }, CALL_CONFIG.RING_TIMEOUT);
  }

  // ========================================
  // ACEPTAR LLAMADA
  // ========================================
  
  async acceptCall(webrtcManager) {
    try {
      if (!this.activeCall || this.activeCall.type !== 'INCOMING') {
        throw new Error('No hay llamada entrante para aceptar');
      }
      
      console.log('✅ [ACEPTAR] Usuario aceptó después de', this.ringSeconds, 'segundos');
      
      // Limpiar timers de sonar
      this.clearRingTimers();
      
      // Responder
      await webrtcManager.answerCall(this.activeCall.offer, true);
      
      // Actualizar estado
      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();
      this.activeCall.ringDuration = this.ringSeconds;
      
      // Iniciar contador de duración
      this.startDurationTimer();
      
      console.log('✅ [ACEPTAR] Llamada CONECTADA');
      
    } catch (error) {
      console.error('❌ [ACEPTAR] Error:', error);
      throw error;
    }
  }

  // ========================================
  // RECHAZAR LLAMADA
  // ========================================
  
  async rejectCall(webrtcManager, reason = 'REJECTED') {
    try {
      console.log('❌ [RECHAZAR] Llamada rechazada:', reason);
      
      this.clearRingTimers();
      
      if (this.activeCall && this.activeCall.offer) {
        await webrtcManager.answerCall(this.activeCall.offer, false);
      }
      
      this.activeCall.status = 'REJECTED';
      this.activeCall.rejectReason = reason;
      
      if (this.activeCall.id && this.activeCall.type === 'INCOMING') {
        try {
          await iceClient.endCall(this.activeCall.id, state.currentUsername);
        } catch (err) {
          console.warn('⚠️ Error notificando rechazo:', err);
        }
      }
      
      this.cleanup();
      
    } catch (error) {
      console.error('❌ [RECHAZAR] Error:', error);
      this.cleanup();
    }
  }

  // ========================================
  // TEMPORIZADOR DE DURACIÓN
  // ========================================
  
  startDurationTimer() {
    this.callStartTime = Date.now();
    this.callDuration = 0;
    
    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);
      
      if (window.updateCallDuration) {
        window.updateCallDuration(this.callDuration);
      }
      
      if (this.callDuration >= CALL_CONFIG.CALL_TIMEOUT / 1000) {
        console.log('⏱️ Límite máximo de duración alcanzado');
        this.endCall();
      }
      
    }, 1000);
  }

  // ========================================
  // FINALIZAR LLAMADA
  // ========================================
  
  async endCall(webrtcManager = null) {
    try {
      if (!this.activeCall) return;
      
      console.log('📞 Finalizando llamada:', this.activeCall.id);
      
      this.clearAllTimers();
      
      if (webrtcManager) {
        await webrtcManager.endCall();
      }
      
      if (this.activeCall.id) {
        try {
          await iceClient.endCall(this.activeCall.id, state.currentUsername);
        } catch (err) {
          console.warn('⚠️ Error notificando fin:', err);
        }
      }
      
      this.activeCall.status = 'ENDED';
      this.activeCall.endTime = Date.now();
      
      const callInfo = {
        ...this.activeCall,
        totalDuration: this.callDuration,
        ringDuration: this.ringSeconds
      };
      
      console.log('✅ Llamada finalizada. Duración:', this.callDuration, 's');
      
      this.cleanup();
      
      return callInfo;
      
    } catch (error) {
      console.error('❌ Error finalizando llamada:', error);
      this.cleanup();
    }
  }

  // ========================================
  // ACTUALIZAR UI
  // ========================================
  
  updateRingUI(seconds) {
    const timerEl = document.getElementById('outgoingRingTimer');
    if (timerEl) {
      timerEl.textContent = `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    }
  }

  setRingUIColor(color) {
    const timerEl = document.getElementById('outgoingRingTimer');
    if (timerEl) {
      timerEl.style.color = color;
    }
  }

  updateIncomingRingUI(elapsed, remaining) {
    const timerEl = document.getElementById('incomingRingTimer');
    if (timerEl) {
      timerEl.textContent = `${remaining} segundo${remaining !== 1 ? 's' : ''} restantes`;
    }
  }

  setIncomingRingUIColor(color) {
    const timerEl = document.getElementById('incomingRingTimer');
    if (timerEl) {
      timerEl.style.color = color;
    }
  }

  // ========================================
  // LIMPIAR TIMERS
  // ========================================
  
  clearRingTimers() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
    
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    
    this.ringSeconds = 0;
  }

  clearCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  clearAllTimers() {
    this.clearRingTimers();
    this.clearCallTimer();
  }

  cleanup() {
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

  getRingDuration() {
    return this.ringSeconds;
  }

  getCallStatus() {
    return this.activeCall ? this.activeCall.status : 'IDLE';
  }
}

export const callManager = new CallManager();