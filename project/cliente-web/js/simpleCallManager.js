// js/simpleCallManager.js - VERSIÓN CORREGIDA CON SINGLETON
// NO SE MODIFICA NINGUNA LÓGICA DE LLAMADAS
// SOLO SE AGREGA UN GUARD CONTRA DOBLE INSTANCIA

import { simpleAudioStream } from './simpleAudioStream.js';

// -----------------------------------------------------------
// 🛡️ FIX IMPORTANTE: Singleton guard
// -----------------------------------------------------------
let _instance = null;

class SimpleCallManager {
  constructor() {

    if (_instance) return _instance;     // <<---- FIX REAL (NO MAS DOBLE INSTANCIA)

    this.activeCall = null;
    this.ringTimer = null;
    this.callTimer = null;
    this.callStartTime = null;
    this.callDuration = 0;
    this.audioSubject = null;
    this.username = null;

    console.log('📞 [SIMPLE CALL] Inicializado');

    _instance = this; // registrar instancia única
  }

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;

    if (simpleAudioStream && typeof simpleAudioStream.setAudioSubject === 'function') {
      simpleAudioStream.setAudioSubject(audioSubject, username);
    }
    console.log('✅ [SIMPLE CALL] AudioSubject configurado para', username);
  }

  async initiateOutgoingCall(targetUser) {
    try {
      console.log('📞 [SIMPLE CALL] Iniciando llamada a:', targetUser);

      if (!this.audioSubject) throw new Error('AudioSubject no configurado');

      try {
        const connected = await this.audioSubject.getConnectedUsers();
        if (!Array.isArray(connected) || !connected.includes(targetUser)) {
          console.warn('⚠️ [SIMPLE CALL] El target no aparece en connectedUsers:', targetUser);
        }
      } catch (err) {
        console.warn('⚠️ [SIMPLE CALL] No se pudo verificar connectedUsers:', err);
      }

      this.activeCall = {
        type: 'OUTGOING',
        callerId: this.username,
        calleeId: targetUser,
        startTime: Date.now(),
        status: 'RINGING'
      };

      console.log('   ✅ activeCall creado (OUTGOING)');

      await this.audioSubject.startCall(this.username, targetUser);
      console.log('   ✅ startCall enviada al servidor');

      this.setupRingTimer();
      return true;

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error initiateOutgoingCall:', error);
      this.cleanup();
      throw error;
    }
  }

  async receiveIncomingCall(fromUser) {
    try {
      console.log('📥 [SIMPLE CALL] receiveIncomingCall de:', fromUser);

      this.activeCall = {
        type: 'INCOMING',
        callerId: fromUser,
        calleeId: this.username,
        startTime: Date.now(),
        status: 'RINGING'
      };

      this.setupRingTimer();
      return this.activeCall;
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error receiveIncomingCall:', error);
      this.cleanup();
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async acceptCall() {
    try {
      if (!this.activeCall || this.activeCall.type !== 'INCOMING') {
        throw new Error('No hay llamada entrante para aceptar');
      }

      console.log('✅ [SIMPLE CALL] Aceptando llamada de:', this.activeCall.callerId);

      this.clearRingTimer();

      await this.audioSubject.acceptCall(this.activeCall.callerId, this.username);
      console.log('   ✅ acceptCall enviada al servidor');

      await this.delay(200);

      if (!simpleAudioStream.isActive()) {
        console.log('   🎤 Iniciando audio (callee) después de acceptCall...');
        await simpleAudioStream.startStreaming();
        console.log('   ✅ Audio streaming activo (callee)');
      }

      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();

      this.startDurationTimer();
      return true;

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error acceptCall:', error);
      throw error;
    }
  }

  async handleCallAccepted(fromUser) {
    try {
      console.log('📥 [SIMPLE CALL] handleCallAccepted por:', fromUser);

      this.clearRingTimer();

      if (!this.activeCall) {
        this.activeCall = {
          type: 'OUTGOING',
          callerId: this.username,
          calleeId: fromUser,
          startTime: Date.now(),
          status: 'CONNECTED',
          answerTime: Date.now()
        };
        console.warn('⚠️ [SIMPLE CALL] activeCall inexistente, creado placeholder (caller)');
      } else {
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
      }

      if (!simpleAudioStream.isActive()) {
        console.log('   🎤 Iniciando audio (caller) en handleCallAccepted...');
        await simpleAudioStream.startStreaming();
        console.log('   ✅ Audio streaming activo (caller)');
      }

      this.startDurationTimer();

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error handleCallAccepted:', error);
      throw error;
    }
  }

  async rejectCall() {
    try {
      if (!this.activeCall) {
        console.log('❌ [SIMPLE CALL] rejectCall: no hay activeCall');
        return;
      }

      console.log('❌ [SIMPLE CALL] Rechazando llamada');

      this.clearRingTimer();

      if (this.activeCall.type === 'INCOMING') {
        await this.audioSubject.rejectCall(this.activeCall.callerId, this.username);
        console.log('   ✅ rejectCall enviada al servidor');
      }

      this.cleanup();

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error rejectCall:', error);
      this.cleanup();
    }
  }

  async endCall() {
    try {
      if (!this.activeCall) {
        console.log('📞 [SIMPLE CALL] endCall: no hay activeCall');
        return;
      }

      console.log('📞 [SIMPLE CALL] Finalizando llamada');

      const otherUser = this.activeCall.type === 'OUTGOING'
        ? this.activeCall.calleeId
        : this.activeCall.callerId;

      this.clearAllTimers();

      try {
        simpleAudioStream.cleanup();
      } catch (err) {
        console.warn('⚠️ Error limpiando audio local:', err);
      }

      try {
        await this.audioSubject.hangup(this.username, otherUser);
        console.log('   ✅ hangup enviada al servidor');
      } catch (err) {
        console.warn('⚠️ Error notificando hangup:', err);
      }

      this.cleanup();

    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error endCall:', error);
      this.cleanup();
    }
  }

  setupRingTimer() {
    this.clearRingTimer();
    this.ringTimer = setTimeout(async () => {
      console.log('⏱️ [SIMPLE CALL] Ring timeout');

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
    this.clearCallTimer();

    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);
      if (window.updateCallDuration) window.updateCallDuration(this.callDuration);
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

  cleanup() {
    console.log('🧹 [SIMPLE CALL] cleanup');
    this.clearAllTimers();
    this.activeCall = null;
    this.callDuration = 0;
    this.callStartTime = null;
  }

  getActiveCall() {
    return this.activeCall;
  }

  isCallActive() {
    return !!(this.activeCall && this.activeCall.status === 'CONNECTED');
  }
}

export const simpleCallManager = new SimpleCallManager();

if (typeof window !== 'undefined') {
  window._simpleCallManager = simpleCallManager;
}
