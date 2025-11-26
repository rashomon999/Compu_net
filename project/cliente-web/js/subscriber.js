// ============================================
// js/subscriber.js - Observer CORREGIDO
// EXACTO como Demo.Observer del profesor
// ============================================

export default class AudioSubscriber extends window.Ice.AudioSystem.AudioObserver {
  constructor(delegate) {
    super();
    this.delegate = delegate;
    console.log('🎤 [SUBSCRIBER] Inicializado');
  }
  
  // ============================================
  // ✅ CRÍTICO: Métodos deben coincidir con AudioSubject.ice
  // ============================================
  
  receiveAudio(data, current) {
    console.log('🔊 [SUBSCRIBER] receiveAudio llamado:', data?.length || 0, 'bytes');
    
    try {
      // Convertir a Uint8Array nativo
      const audioData = data instanceof Uint8Array ? data : new Uint8Array(data);
      
      // Notificar al simpleAudioStream para reproducir
      if (this.delegate.audioCallbacks?.receiveAudio) {
        this.delegate.audioCallbacks.receiveAudio(audioData);
      } else {
        console.warn('   ⚠️ No hay callback receiveAudio');
      }
    } catch (error) {
      console.error('❌ [SUBSCRIBER] Error en receiveAudio:', error);
    }
  }
  
  incomingCall(fromUser, current) {
    console.log('📞 [SUBSCRIBER] incomingCall llamado:', fromUser);
    
    try {
      if (this.delegate.audioCallbacks?.incomingCall) {
        this.delegate.audioCallbacks.incomingCall(fromUser);
      } else {
        console.warn('   ⚠️ No hay callback incomingCall');
      }
    } catch (error) {
      console.error('❌ [SUBSCRIBER] Error en incomingCall:', error);
    }
  }
  
  callAccepted(fromUser, current) {
    console.log('✅ [SUBSCRIBER] callAccepted llamado:', fromUser);
    
    try {
      if (this.delegate.audioCallbacks?.callAccepted) {
        this.delegate.audioCallbacks.callAccepted(fromUser);
      } else {
        console.warn('   ⚠️ No hay callback callAccepted');
      }
    } catch (error) {
      console.error('❌ [SUBSCRIBER] Error en callAccepted:', error);
    }
  }
  
  callRejected(fromUser, current) {
    console.log('❌ [SUBSCRIBER] callRejected llamado:', fromUser);
    
    try {
      if (this.delegate.audioCallbacks?.callRejected) {
        this.delegate.audioCallbacks.callRejected(fromUser);
      } else {
        console.warn('   ⚠️ No hay callback callRejected');
      }
    } catch (error) {
      console.error('❌ [SUBSCRIBER] Error en callRejected:', error);
    }
  }
  
  callEnded(fromUser, current) {
    console.log('🔴 [SUBSCRIBER] callEnded llamado:', fromUser);
    
    try {
      if (this.delegate.audioCallbacks?.callEnded) {
        this.delegate.audioCallbacks.callEnded(fromUser);
      } else {
        console.warn('   ⚠️ No hay callback callEnded');
      }
    } catch (error) {
      console.error('❌ [SUBSCRIBER] Error en callEnded:', error);
    }
  }
}