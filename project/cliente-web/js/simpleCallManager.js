// ============================================
// js/simpleCallManager.js - CORREGIDO
// ✅ SIN timeout que corta llamadas activas
// ✅ Solo timeout para llamadas SIN respuesta
// ============================================

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
  // INICIAR LLAMADA SALIENTE
  // ========================================
  async initiateOutgoingCall(targetUser) {
    try {
      console.log('📞 [SIMPLE CALL] Iniciando llamada a:', targetUser);
      
      if (!this.audioSubject) {
        throw new Error('AudioSubject no configurado');
      }
      
      // Verificar si el usuario está conectado
      try {
        const connectedUsers = await this.audioSubject.getConnectedUsers();
        if (!connectedUsers.includes(targetUser)) {
          throw new Error(`${targetUser} no está conectado`);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo verificar usuarios conectados:', err);
      }
      
      // Crear registro de llamada
      this.activeCall = {
        type: 'OUTGOING',
        callerId: this.username,
        calleeId: targetUser,
        startTime: Date.now(),
        status: 'RINGING'
      };
      
      console.log('   ✅ activeCall creado');
      
      // Llamar al servidor
      await this.audioSubject.startCall(this.username, targetUser);
      
      console.log('   ✅ Llamada enviada al servidor');
      
      // ✅ Setup timer SOLO para esperar respuesta (no para llamada activa)
      this.setupRingTimer();
      
      return true;
      
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // RECIBIR LLAMADA ENTRANTE
  // ========================================
  
  async receiveIncomingCall(fromUser) {
    try {
      console.log('📞 [SIMPLE CALL] Llamada entrante de:', fromUser);
      
      // Crear registro de llamada
      this.activeCall = {
        type: 'INCOMING',
        callerId: fromUser,
        calleeId: this.username,
        startTime: Date.now(),
        status: 'RINGING'
      };
      
      console.log('   ✅ activeCall creado');
      
      // ✅ Timer para auto-rechazar si no responde en 60s
      this.setupRingTimer();
      
      return this.activeCall;
      
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error:', error);
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
      
      console.log('✅ [SIMPLE CALL] Aceptando llamada de:', this.activeCall.callerId);
      
      // ✅ CRÍTICO: Detener timer de ring ANTES de continuar
      this.clearRingTimer();
      
      await this.audioSubject.acceptCall(
        this.activeCall.callerId,
        this.username
      );
      
      console.log('   ✅ acceptCall enviado al servidor');
      
      // Actualizar estado
      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();
      
      // Iniciar audio
      console.log('   🎤 Iniciando audio...');
      await simpleAudioStream.startStreaming();
      console.log('   ✅ Audio streaming activo');
      
      // ✅ Iniciar contador de duración (SIN timeout)
      this.startDurationTimer();
      
      return true;
      
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error aceptando:', error);
      throw error;
    }
  }

  // ========================================
  // MANEJAR RESPUESTA DE LLAMADA
  // ========================================
  async handleCallAccepted(fromUser) {
    try {
      console.log('╔═══════════════════════════════════════╗');
      console.log('║  LLAMADA ACEPTADA                     ║');
      console.log('╠═══════════════════════════════════════╣');
      console.log('║  Aceptada por:', fromUser.padEnd(20), '║');
      console.log('║  Yo:          ', this.username.padEnd(20), '║');
      console.log('╚═══════════════════════════════════════╝');
      
      // ✅ CRÍTICO: Detener timer de ring
      this.clearRingTimer();
      
      // Asegurar que activeCall existe
      if (!this.activeCall) {
        console.warn('   ⚠️ activeCall no existe, creando...');
        this.activeCall = {
          type: 'OUTGOING',
          callerId: this.username,
          calleeId: fromUser,
          startTime: Date.now(),
          status: 'CONNECTED',
          answerTime: Date.now()
        };
      } else {
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
      }
      
      console.log('   📝 Estado final de activeCall:', this.activeCall);
      
      // Iniciar audio
      console.log('   🎤 Iniciando streaming de audio...');
      await simpleAudioStream.startStreaming();
      console.log('   ✅ Audio streaming ACTIVO');
      
      // ✅ Iniciar contador (sin timeout)
      this.startDurationTimer();
      
      console.log('   📊 Llamada completamente establecida');
      
    } catch (error) {
      console.error('❌ [SIMPLE CALL] Error en handleCallAccepted:', error);
      throw error;
    }
  }
  
  // ========================================
  // RECHAZAR LLAMADA
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
      
      const otherUser = this.activeCall.type === 'OUTGOING' 
        ? this.activeCall.calleeId 
        : this.activeCall.callerId;
      
      this.clearAllTimers();
      
      // Detener audio
      simpleAudioStream.cleanup();
      
      // Notificar al servidor
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
    // ✅ Solo para llamadas SIN respuesta (RINGING)
    this.ringTimer = setTimeout(async () => {
      console.log('⏰ Timeout: Sin respuesta después de 60s');
      
      // ✅ SOLO cortar si sigue en RINGING
      if (this.activeCall && this.activeCall.status === 'RINGING') {
        if (this.activeCall.type === 'OUTGOING') {
          await this.endCall();
        } else if (this.activeCall.type === 'INCOMING') {
          await this.rejectCall();
        }
      }
      
    }, 60000); // 60 segundos
  }
  
  startDurationTimer() {
    this.callStartTime = Date.now();
    this.callDuration = 0;
    
    // ✅ Este timer NO corta la llamada, solo actualiza el contador
    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor((Date.now() - this.callStartTime) / 1000);
      
      if (window.updateCallDuration) {
        window.updateCallDuration(this.callDuration);
      }
      
    }, 1000);
  }
  
  clearRingTimer() {
    if (this.ringTimer) {
      clearTimeout(this.ringTimer);
      this.ringTimer = null;
      console.log('   ✅ Ring timer cancelado');
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