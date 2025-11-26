// js/simpleCallManager.js - Versión corregida (formato código)
// - Asegúrate de reemplazar tu archivo actual por este contenido exactamente.
// - Usa los nombres de método del servidor tal como en AudioSubject.ice:
//     startCall(caller, callee), acceptCall(caller, callee), rejectCall(caller, callee), hangup(caller, callee)
// - Este archivo añade guards, logging y pequeños delays para evitar race-conditions.

import { simpleAudioStream } from './simpleAudioStream.js';

class SimpleCallManager {
  constructor() {
    this.activeCall = null;
    this.ringTimer = null;
    this.callTimer = null;
    this.callStartTime = null;
    this.callDuration = 0;
    this.audioSubject = null;
    this.username = null;

    console.log('📞 [SIMPLE CALL] Inicializado');
  }

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;
    // pasar contexto al audio stream
    if (simpleAudioStream && typeof simpleAudioStream.setAudioSubject === 'function') {
      simpleAudioStream.setAudioSubject(audioSubject, username);
    }
    console.log('✅ [SIMPLE CALL] AudioSubject configurado para', username);
  }

  async initiateOutgoingCall(targetUser) {
    try {
      console.log('📞 [SIMPLE CALL] Iniciando llamada a:', targetUser);

      if (!this.audioSubject) throw new Error('AudioSubject no configurado');

      // intento no crítico de verificar usuarios conectados
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

      // enviar startCall en orden (caller, callee)
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

  // util: pequeño delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========================================
  // ACEPTAR LLAMADA (callee)
  // ========================================
  async acceptCall() {
    try {
      if (!this.activeCall || this.activeCall.type !== 'INCOMING') {
        throw new Error('No hay llamada entrante para aceptar');
      }

      console.log('✅ [SIMPLE CALL] Aceptando llamada de:', this.activeCall.callerId);

      this.clearRingTimer();

      // llamar acceptCall(caller, callee)
      await this.audioSubject.acceptCall(this.activeCall.callerId, this.username);
      console.log('   ✅ acceptCall enviada al servidor (caller, callee)');

      // dar tiempo al servidor para propagar (evitar race)
      await this.delay(200);

      // iniciar streaming si no está activo
      if (!simpleAudioStream.isActive()) {
        console.log('   🎤 Iniciando audio (callee) después de acceptCall...');
        await simpleAudioStream.startStreaming();
        console.log('   ✅ Audio streaming activo (callee)');
      } else {
        console.log('   ⚠️ Audio ya activo (callee) — no se inicia de nuevo');
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

  // ========================================
  // HANDLER: cuando el caller recibe confirmacion (callAccepted)
  // El caller inicia streaming aquí
  // ========================================
  async handleCallAccepted(fromUser) {
    try {
      console.log('📥 [SIMPLE CALL] handleCallAccepted por:', fromUser);

      this.clearRingTimer();

      if (this.activeCall) {
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
      } else {
        // Si caller no tenía activeCall (caso raro) — crear un placeholder mínimo
        this.activeCall = {
          type: 'OUTGOING',
          callerId: this.username,
          calleeId: fromUser,
          startTime: Date.now(),
          status: 'CONNECTED',
          answerTime: Date.now()
        };
        console.warn('⚠️ [SIMPLE CALL] activeCall inexistente, creado placeholder (caller)');
      }

      // Iniciar audio si no está activo
      if (!simpleAudioStream.isActive()) {
        console.log('   🎤 Iniciando audio (caller) en handleCallAccepted...');
        await simpleAudioStream.startStreaming();
        console.log('   ✅ Audio streaming activo (caller)');
      } else {
        console.log('   ⚠️ Audio ya activo (caller) — no se inicia');
      }

      this.startDurationTimer();
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error handleCallAccepted:', error);
      throw error;
    }
  }

  // ========================================
  // RECHAZAR LLAMADA
  // ========================================
  async rejectCall() {
    try {
      if (!this.activeCall) {
        console.log('❌ [SIMPLE CALL] rejectCall: no hay activeCall');
        return;
      }

      console.log('❌ [SIMPLE CALL] Rechazando llamada');

      this.clearRingTimer();

      // IMPORTANTE: usar mismo orden (caller, callee)
      if (this.activeCall.type === 'INCOMING') {
        try {
          await this.audioSubject.rejectCall(this.activeCall.callerId, this.username);
          console.log('   ✅ rejectCall enviada al servidor (caller, callee)');
        } catch (err) {
          console.warn('   ⚠️ Error enviando rejectCall:', err);
        }
      }

      this.cleanup();
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error rejectCall:', error);
      this.cleanup();
    }
  }

  // ========================================
  // TERMINAR LLAMADA (fin)
  // ========================================
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

      // detener audio local
      try {
        simpleAudioStream.cleanup();
      } catch (err) {
        console.warn('⚠️ Error limpiando audio local:', err);
      }

      // notificar al servidor usando hangup(caller, callee) — enviar en orden según sea quien llama
      try {
        // enviar con el orden (this.username, otherUser) — el servidor interpretará
        await this.audioSubject.hangup(this.username, otherUser);
        console.log('   ✅ hangup enviada al servidor');
      } catch (err) {
        console.warn('   ⚠️ Error notificando hangup:', err);
      }

      this.cleanup();
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error endCall:', error);
      this.cleanup();
    }
  }

  // TIMERS / UTILIDADES
  setupRingTimer() {
    this.clearRingTimer();
    this.ringTimer = setTimeout(async () => {
      console.log('⏱️ [SIMPLE CALL] Ring timeout');
      if (this.activeCall && this.activeCall.type === 'OUTGOING') {
        await this.endCall();
      } else if (this.activeCall && this.activeCall.type === 'INCOMING') {
        await this.rejectCall();
      }
    }, 60000); // 60s
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
