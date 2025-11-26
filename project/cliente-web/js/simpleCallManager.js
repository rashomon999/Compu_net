// ============================================
// js/simpleCallManager.js - Gestor de Llamadas SIMPLIFICADO
// VERSIÓN CORREGIDA CON SINGLETON
// ============================================

import { simpleAudioStream } from './simpleAudioStream.js';

// ------------------------------------------------------------------
// 🛡️ FIX: SINGLETON (evita doble inicialización y errores aleatorios)
// ------------------------------------------------------------------
let _instance = null;

class SimpleCallManager {
  constructor() {

    if (_instance) return _instance;  // 🔥 FIX REAL

    // === NADA DE TU LÓGICA INTERNA SE TOCA ===
    this.activeCall = null;
    this.ringTimer = null;
    this.callTimer = null;
    this.callStartTime = null;
    this.callDuration = 0;
    this.audioSubject = null;
    this.username = null;

    console.log('📞 [SIMPLE CALL] Inicializado');

    _instance = this;
  }

  // ========================================
  // CONFIGURACIÓN
  // ========================================

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;

    simpleAudioStream.setAudioSubject(audioSubject, username);

    console.log('✅ [SIMPLE CALL] AudioSubject configurado');
  }

  // ========================================
  // INICIAR SALIENTE
  // ========================================

  async initiateOutgoingCall(targetUser) {
    try {
      console.log('📞 [SIMPLE CALL] Iniciando llamada a:', targetUser);

      if (!this.audioSubject) throw new Error('AudioSubject no configurado');

      try {
        const connected = await this.audioSubject.getConnectedUsers();
        if (!connected.includes(targetUser)) {
          throw new Error(`${targetUser} no está conectado`);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo verificar usuarios conectados:', err);
      }

      this.activeCall = {
        type: 'OUTGOING',
        callerId: this.username,
        calleeId: targetUser,
        startTime: Date.now(),
        status: 'RINGING'
      };

      console.log('   ✅ activeCall creado');

      await this.audioSubject.startCall(this.username, targetUser);

      console.log('   ✅ Llamada enviada al servidor');

      this.setupRingTimer();
      return true;

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // ENTRANTE
  // ========================================

  async receiveIncomingCall(fromUser) {
    try {
      console.log('📞 [SIMPLE CALL] Llamada entrante de:', fromUser);

      this.activeCall = {
        type: 'INCOMING',
        callerId: fromUser,
        calleeId: this.username,
        startTime: Date.now(),
        status: 'RINGING'
      };

      console.log('   ✅ activeCall creado');

      this.setupRingTimer();
      return this.activeCall;

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // ACEPTAR (CALLEE)
  // ========================================

  async acceptCall() {
    try {
      if (!this.activeCall || this.activeCall.type !== 'INCOMING')
        throw new Error('No hay llamada entrante para aceptar');

      console.log('✅ [SIMPLE CALL] Aceptando llamada de:', this.activeCall.callerId);

      this.clearRingTimer();

      await this.audioSubject.acceptCall(
        this.activeCall.callerId, // quien llamó
        this.username              // quien acepta
      );

      console.log('   ✅ Aceptación enviada al servidor');

      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();

      console.log('   🎤 Iniciando audio...');
      await simpleAudioStream.startStreaming();
      console.log('   ✅ Audio streaming activo');

      this.startDurationTimer();
      return true;

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error aceptando:', error);
      throw error;
    }
  }

  // ========================================
  // CALLER RECIBE CONFIRMACIÓN
  // ========================================

  async handleCallAccepted(fromUser) {
    try {
      console.log('📥 [SIMPLE CALL] Llamada ACEPTADA por:', fromUser);

      this.clearRingTimer();

      if (this.activeCall) {
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
      }

      console.log('   🎤 Iniciando audio...');
      await simpleAudioStream.startStreaming();
      console.log('   ✅ Audio streaming activo');

      this.startDurationTimer();

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error:', error);
      throw error;
    }
  }

  // ========================================
  // RECHAZAR
  // ========================================

  async rejectCall() {
    try {
      if (!this.activeCall) return;

      console.log('❌ [SIMPLE CALL] Rechazando llamada');

      this.clearRingTimer();

      if (this.activeCall.type === 'INCOMING') {
        await this.audioSubject.rejectCall(
          this.username,
          this.activeCall.callerId
        );
      }

      this.cleanup();

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error rechazando:', error);
      this.cleanup();
    }
  }

  // ========================================
  // FINALIZAR LLAMADA
  // ========================================

  async endCall() {
    try {
      if (!this.activeCall) return;

      console.log('📞 [SIMPLE CALL] Finalizando llamada');

      const otherUser =
        this.activeCall.type === 'OUTGOING'
          ? this.activeCall.calleeId
          : this.activeCall.callerId;

      this.clearAllTimers();
      simpleAudioStream.cleanup();

      try {
        await this.audioSubject.hangup(this.username, otherUser);
      } catch (err) {
        console.warn('⚠️ Error notificando fin:', err);
      }

      console.log('✅ Llamada finalizada. Duración:', this.callDuration, 's');
      this.cleanup();

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error finalizando:', error);
      this.cleanup();
    }
  }

  // ========================================
  // TIMERS
  // ========================================

  setupRingTimer() {
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: Sin respuesta después de 60s');

      if (this.activeCall?.type === 'OUTGOING') {
        await this.endCall();
      } else if (this.activeCall?.type === 'INCOMING') {
        await this.rejectCall();
      }

    }, 60000);
  }

  startDurationTimer() {
    this.callStartTime = Date.now();
    this.callDuration = 0;

    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);

      if (window.updateCallDuration)
        window.updateCallDuration(this.callDuration);

    }, 1000);
  }

  clearRingTimer() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
    }
  }

  clearCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
  }

  clearAllTimers() {
    this.clearRingTimer();
    this.clearCallTimer();
  }

  // ========================================
  // CLEANUP
  // ========================================

  cleanup() {
    console.log('🧹 [SIMPLE CALL] Limpiando...');
    this.clearAllTimers();
    this.activeCall = null;
    this.callDuration = 0;
    this.callStartTime = null;
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

export const simpleCallManager = new SimpleCallManager();

if (typeof window !== 'undefined') {
  window._simpleCallManager = simpleCallManager;
}
