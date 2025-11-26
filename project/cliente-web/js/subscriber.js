// ============================================
// js/subscriber.js - Observer del cliente web
// EXACTO como el profesor (Demo.Observer pattern)
// ============================================

// ✅ CRÍTICO: Heredar de Ice.AudioSystem.AudioObserver
export default class AudioSubscriber extends window.Ice.AudioSystem.AudioObserver {
  constructor(delegate) {
    super();
    this.delegate = delegate;
  }
  
  // ============================================
  // RECEPCIÓN DE AUDIO (como el profesor)
  // ============================================
  
  receiveAudio(data, current) {
    console.log('[WEB] Audio recibido:', data ? data.length : 0, 'bytes');
    
    // Convertir a Uint8Array nativo de JS
    const audioData = data instanceof Uint8Array ? data : new Uint8Array(data);
    
    // Notificar al delegate (que lo pasa al reproductor)
    if (this.delegate.audioCallbacks && this.delegate.audioCallbacks.receiveAudio) {
      this.delegate.audioCallbacks.receiveAudio(audioData);
    } else {
      console.warn('   ⚠️ No hay callback receiveAudio en delegate');
    }
  }
  
  // ============================================
  // EVENTOS DE LLAMADAS (como el profesor)
  // ============================================
  
  incomingCall(fromUser, current) {
    console.log('📞 [WEB] Llamada entrante de:', fromUser);
    
    if (this.delegate.audioCallbacks && this.delegate.audioCallbacks.incomingCall) {
      this.delegate.audioCallbacks.incomingCall(fromUser);
    }
  }
  
  callAccepted(fromUser, current) {
    console.log('✅ [WEB] Llamada aceptada por:', fromUser);
    
    if (this.delegate.audioCallbacks && this.delegate.audioCallbacks.callAccepted) {
      this.delegate.audioCallbacks.callAccepted(fromUser);
    }
  }
  
  callRejected(fromUser, current) {
    console.log('❌ [WEB] Llamada rechazada por:', fromUser);
    
    if (this.delegate.audioCallbacks && this.delegate.audioCallbacks.callRejected) {
      this.delegate.audioCallbacks.callRejected(fromUser);
    }
  }
  
  callEnded(fromUser, current) {
    console.log('📞 [WEB] Llamada finalizada por:', fromUser);
    
    if (this.delegate.audioCallbacks && this.delegate.audioCallbacks.callEnded) {
      this.delegate.audioCallbacks.callEnded(fromUser);
    }
  }
}