// ============================================
// js/simpleCallManager.js - CORREGIDO
// ✅ Orden correcto de parámetros
// ✅ Timeout limpiado correctamente
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
      
      // Setup timer de 60 segundos
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
      
      // Setup timer de 60 segundos
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
      
      // ✅ CRÍTICO: LIMPIAR TIMEOUT ANTES DE ACEPTAR
      this.clearRingTimer();
      
      console.log('╔══════════════════════════════════════════╗');
      console.log('║  ORDEN DE PARÁMETROS acceptCall         ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log('║  SERVIDOR ESPERA:                        ║');
      console.log('║  acceptCall(quien_acepta, quien_llamó)   ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log('║  ENVIANDO:                               ║');
      console.log('║  fromUser (yo):      ', this.username.padEnd(20), '║');
      console.log('║  toUser (el otro):   ', this.activeCall.callerId.padEnd(20), '║');
      console.log('╚══════════════════════════════════════════╝');
      
      // ✅ CORRECCIÓN: ORDEN CORRECTO
      // El servidor espera: acceptCall(quien_acepta, quien_llamó)
      await this.audioSubject.acceptCall(
        this.username,              // Luis (quien ACEPTA) - YO
        this.activeCall.callerId    // Maria (quien LLAMÓ) - EL OTRO
      );
      
      console.log('   ✅ acceptCall enviado correctamente');
      
      // Actualizar estado
      this.activeCall.status = 'CONNECTED';
      this.activeCall.answerTime = Date.now();
      
      // Iniciar audio
      console.log('   🎤 Iniciando audio...');
      await simpleAudioStream.startStreaming();
      console.log('   ✅ Audio streaming activo');
      
      // Iniciar contador
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
      console.log('╔══════════════════════════════════════════╗');
      console.log('║  LLAMADA ACEPTADA                        ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log('║  Aceptada por:', fromUser.padEnd(20), '║');
      console.log('║  Yo:          ', this.username.padEnd(20), '║');
      console.log('╚══════════════════════════════════════════╝');
      
      // ✅ CRÍTICO: LIMPIAR TIMEOUT
      this.clearRingTimer();
      
      // ✅ Asegurar que activeCall existe
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
        // Actualizar estado
        this.activeCall.status = 'CONNECTED';
        this.activeCall.answerTime = Date.now();
      }
      
      console.log('   📝 Estado final de activeCall:', this.activeCall);
      
      // Iniciar audio
      console.log('   🎤 Iniciando streaming de audio...');
      await simpleAudioStream.startStreaming();
      console.log('   ✅ Audio streaming ACTIVO');
      
      // Iniciar contador
      this.startDurationTimer();
      
      console.log('   🔊 Llamada completamente establecida');
      
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
      if (!this.activeCall) {
        console.warn('⚠️ [SIMPLE CALL] No hay llamada para rechazar');
        return;
      }
      
      console.log('❌ [SIMPLE CALL] Rechazando llamada');
      
      // ✅ CRÍTICO: LIMPIAR TIMEOUT
      this.clearRingTimer();
      
      if (this.activeCall.type === 'INCOMING') {
        // ✅ CORRECTO: (yo, el_otro)
        await this.audioSubject.rejectCall(
          this.username,              // quien rechaza (yo)
          this.activeCall.callerId    // quien llamó (el otro)
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
      if (!this.activeCall) {
        console.warn('⚠️ [SIMPLE CALL] No hay llamada activa');
        return;
      }
      
      console.log('📞 [SIMPLE CALL] Finalizando llamada');
      
      const otherUser = this.activeCall.type === 'OUTGOING' 
        ? this.activeCall.calleeId 
        : this.activeCall.callerId;
      
      // ✅ CRÍTICO: LIMPIAR TODOS LOS TIMERS
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
    // ✅ CRÍTICO: Limpiar timer anterior si existe
    this.clearRingTimer();
    
    console.log('⏱️  [SIMPLE CALL] Configurando timeout de 60s');
    
    this.ringTimer = setTimeout(async () => {
      console.log('❌ Timeout: Sin respuesta después de 60s');
      console.log('   Estado actual:', this.activeCall?.status);
      
      // ✅ SOLO actuar si NO está conectado
      if (!this.activeCall || this.activeCall.status !== 'CONNECTED') {
        if (this.activeCall && this.activeCall.type === 'OUTGOING') {
          await this.endCall();
        } else if (this.activeCall && this.activeCall.type === 'INCOMING') {
          await this.rejectCall();
        }
      } else {
        console.log('   ℹ️ Llamada ya conectada, ignorando timeout');
      }
      
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
  
  clearRingTimer() {
    if (this.ringTimer) {
      console.log('🧹 [SIMPLE CALL] Limpiando ring timer');
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
    console.log('🧹 [SIMPLE CALL] Limpiando todos los timers');
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

// Exponer globalmente
if (typeof window !== 'undefined') {
  window._simpleCallManager = simpleCallManager;
}