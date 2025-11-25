// ============================================
// js/webrtcManager.js - CORREGIDO: Audio remoto funcionando
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';

class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallId = null;
    this.isInitiator = false;
    this.iceCandidateQueue = [];
    this.remoteAudioElement = null;
  }

  // ========================================
  // INICIAR LLAMADA
  // ========================================
  
  async initiateCall(targetUser, isVideoCall = false) {
    try {
      console.log('📞 [WebRTC] Iniciando llamada a', targetUser);
      
      console.log('🎤 [WebRTC] Solicitando acceso al micrófono...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall
      });
      console.log('✅ [WebRTC] Stream local obtenido');
      
      console.log('🔗 [WebRTC] Creando PeerConnection...');
      await this.createPeerConnection();
      console.log('✅ [WebRTC] PeerConnection creada');
      
      this.localStream.getTracks().forEach(track => {
        console.log('📎 [WebRTC] Agregando track:', track.kind);
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      console.log('📝 [WebRTC] Creando offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ [WebRTC] Local description establecida');
      
      console.log('📤 [WebRTC] Enviando offer al servidor...');
      const callType = isVideoCall ? 'VIDEO' : 'AUDIO';
      const result = await iceClient.initiateCall(
        state.currentUsername,
        targetUser,
        callType,
        offer.sdp
      );
      
      const callId = result.startsWith('SUCCESS:') ? result.substring(8) : result;
      
      this.currentCallId = callId;
      this.isInitiator = true;
      
      console.log('✅ [WebRTC] Llamada iniciada con ID:', callId);
      
      return callId;
      
    } catch (error) {
      console.error('❌ [WebRTC] Error en initiateCall:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // RESPONDER LLAMADA
  // ========================================
  
  async answerCall(offer, accept) {
    try {
      console.log('📞 [WebRTC] Respondiendo llamada:', accept ? 'ACEPTAR' : 'RECHAZAR');
      
      if (!accept) {
        await iceClient.answerCall(
          offer.callId,
          state.currentUsername,
          'REJECTED',
          ''
        );
        this.cleanup();
        return;
      }
      
      this.currentCallId = offer.callId;
      this.isInitiator = false;
      
      console.log('🎤 [WebRTC] Solicitando acceso al micrófono...');
      
      const Ice = window.Ice;
      const isVideoCall = (offer.callType === Ice.ChatSystem.CallType.Video);
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall
      });
      
      await this.createPeerConnection();
      
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      console.log('📥 [WebRTC] Estableciendo remote description...');
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: 'offer',
          sdp: offer.sdp
        })
      );
      
      console.log('📝 [WebRTC] Creando answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('📤 [WebRTC] Enviando answer con status ACCEPTED...');
      await iceClient.answerCall(
        offer.callId,
        state.currentUsername,
        'ACCEPTED',
        answer.sdp
      );
      
      console.log('✅ [WebRTC] Llamada aceptada exitosamente');
      
    } catch (error) {
      console.error('❌ [WebRTC] Error respondiendo llamada:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // MANEJAR RESPUESTA DE LLAMADA
  // ========================================

  async handleCallAnswer(answer) {
    try {
      console.log('📥 [WebRTC] Procesando respuesta:', answer.status);
      
      let normalizedStatus = answer.status;
      
      if (typeof answer.status === 'object' && answer.status._name) {
        normalizedStatus = answer.status._name;
      } else if (typeof answer.status === 'number') {
        const statusMap = { 0: 'Ringing', 1: 'Accepted', 2: 'Rejected', 3: 'Ended', 4: 'Busy', 5: 'NoAnswer' };
        normalizedStatus = statusMap[answer.status];
      }
      
      // Convertir a mayúsculas
      normalizedStatus = normalizedStatus.toUpperCase();
      
      console.log('✅ [WebRTC] Status final normalizado:', normalizedStatus);
      
      if (normalizedStatus === 'ACCEPTED') {
        console.log('✅ [WebRTC] Llamada ACEPTADA');
        
        if (!this.peerConnection) {
          console.error('❌ [WebRTC] No hay PeerConnection activa');
          return;
        }
        
        console.log('📝 [WebRTC] Estableciendo remote description...');
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            type: 'answer',
            sdp: answer.sdp
          })
        );
        
        if (this.iceCandidateQueue.length > 0) {
          console.log('🧊 [WebRTC] Procesando', this.iceCandidateQueue.length, 'candidates pendientes');
          for (const candidate of this.iceCandidateQueue) {
            await this.peerConnection.addIceCandidate(candidate);
          }
          this.iceCandidateQueue = [];
        }
        
        console.log('✅ [WebRTC] Respuesta procesada correctamente');
        
      } else if (normalizedStatus === 'REJECTED') {
        console.log('❌ [WebRTC] Llamada RECHAZADA');
        this.cleanup();
      }
      
    } catch (error) {
      console.error('❌ [WebRTC] Error procesando respuesta:', error);
      throw error;
    }
  }

  // ========================================
  // MANEJAR ICE CANDIDATE
  // ========================================
  
  async handleIceCandidate(candidateData) {
    try {
      if (!this.peerConnection) {
        console.warn('⚠️ [WebRTC] No hay PeerConnection, ignorando candidate');
        return;
      }
      
      const candidate = new RTCIceCandidate({
        candidate: candidateData.candidate,
        sdpMid: candidateData.sdpMid,
        sdpMLineIndex: candidateData.sdpMLineIndex
      });
      
      if (!this.peerConnection.remoteDescription) {
        console.log('🧊 [WebRTC] Encolando candidate (sin remote description aún)');
        this.iceCandidateQueue.push(candidate);
        return;
      }
      
      console.log('🧊 [WebRTC] Agregando ICE candidate');
      await this.peerConnection.addIceCandidate(candidate);
      
    } catch (error) {
      console.error('❌ [WebRTC] Error agregando ICE candidate:', error);
    }
  }

  // ========================================
  // CREAR PEER CONNECTION
  // ========================================
  
  async createPeerConnection() {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    this.peerConnection = new RTCPeerConnection(config);
    
    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate && this.currentCallId) {
        console.log('🧊 [WebRTC] Enviando ICE candidate');
        try {
          await iceClient.sendRtcCandidate(
            this.currentCallId,
            state.currentUsername,
            event.candidate.candidate,
            event.candidate.sdpMid,
            event.candidate.sdpMLineIndex
          );
        } catch (error) {
          console.error('❌ Error enviando ICE candidate:', error);
        }
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 [WebRTC] Connection state:', this.peerConnection.connectionState);
      
      if (this.peerConnection.connectionState === 'connected') {
        console.log('✅ [WebRTC] Conexión establecida exitosamente');
      }
      
      if (this.peerConnection.connectionState === 'failed') {
        console.error('❌ [WebRTC] Conexión falló');
      }
    };
    
    this.peerConnection.ontrack = (event) => {
      console.log('📡 [WebRTC] Track remoto recibido:', event.track.kind);
      console.log('   - Track ID:', event.track.id);
      console.log('   - Track enabled:', event.track.enabled);
      console.log('   - Track readyState:', event.track.readyState);
      
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      this.remoteStream.addTrack(event.track);
      
      if (event.track.kind === 'audio') {
        console.log('🔊 [WebRTC] Configurando reproducción de audio remoto...');
        // ⚡ CRÍTICO: Esperar un momento para que el stream esté completamente listo
        setTimeout(() => this.setupRemoteAudio(), 500);
      }
    };
  }

  // ========================================
  // ✅ CONFIGURAR AUDIO REMOTO - CORREGIDO
  // ========================================
  setupRemoteAudio() {
    console.log('🔊 [WebRTC] setupRemoteAudio iniciado');

    // Limpiar elemento anterior
    if (this.remoteAudioElement) {
      try {
        this.remoteAudioElement.pause();
        this.remoteAudioElement.srcObject = null;
        this.remoteAudioElement.remove();
      } catch (e) {
        console.warn('Error limpiando audio anterior:', e);
      }
      this.remoteAudioElement = null;
    }

    if (!this.remoteStream) {
      console.error('❌ [WebRTC] remoteStream no está definido');
      return;
    }

    const audioTracks = this.remoteStream.getAudioTracks();
    console.log('🎵 [WebRTC] Audio tracks disponibles:', audioTracks.length);

    if (audioTracks.length === 0) {
      console.error('❌ [WebRTC] No hay tracks de audio en remoteStream');
      return;
    }

    audioTracks.forEach((track, i) => {
      console.log(`   Track ${i}:`, {
        id: track.id,
        enabled: track.enabled,
        readyState: track.readyState,
        muted: track.muted
      });
    });

    // ⚡ CREAR elemento Audio (no HTMLAudioElement directamente)
    this.remoteAudioElement = new Audio();
    this.remoteAudioElement.autoplay = true;
    this.remoteAudioElement.controls = false;
    this.remoteAudioElement.muted = false;
    this.remoteAudioElement.volume = 1.0;
    
    // ⚡ CRÍTICO: Agregar al DOM (algunos navegadores lo requieren)
    this.remoteAudioElement.style.display = 'none';
    this.remoteAudioElement.id = 'remoteAudio_' + Date.now();
    document.body.appendChild(this.remoteAudioElement);
    
    // ⚡ Asignar stream
    this.remoteAudioElement.srcObject = this.remoteStream;

    // Event listeners
    this.remoteAudioElement.onloadedmetadata = () => {
      console.log('📊 [WebRTC] Metadata cargada del audio remoto');
    };

    this.remoteAudioElement.onplaying = () => {
      console.log('▶️ [WebRTC] Audio remoto REPRODUCIENDO');
    };

    this.remoteAudioElement.onerror = (e) => {
      console.error('❌ [WebRTC] Error en elemento audio:', e);
    };

    // ⚡ FORZAR reproducción con manejo de promesa
    const playPromise = this.remoteAudioElement.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('✅ [WebRTC] Audio remoto reproduciéndose correctamente');
          console.log('   📊 Estado final:', {
            paused: this.remoteAudioElement.paused,
            muted: this.remoteAudioElement.muted,
            volume: this.remoteAudioElement.volume,
            readyState: this.remoteAudioElement.readyState
          });
        })
        .catch(error => {
          console.error('❌ [WebRTC] Error al reproducir audio:', error);
          
          if (error.name === 'NotAllowedError') {
            console.warn('⚠️ Autoplay bloqueado por navegador');
            this.showAudioUnlockButton();
          }
        });
    }
    
    // ⚡ VERIFICACIÓN adicional después de 1 segundo
    setTimeout(() => {
      if (this.remoteAudioElement) {
        console.log('🔍 [WebRTC] Verificación de audio después de 1s:');
        console.log('   Paused:', this.remoteAudioElement.paused);
        console.log('   Muted:', this.remoteAudioElement.muted);
        console.log('   Volume:', this.remoteAudioElement.volume);
        console.log('   CurrentTime:', this.remoteAudioElement.currentTime);
        
        if (this.remoteAudioElement.paused) {
          console.warn('⚠️ Audio está pausado, reintentando play()...');
          this.remoteAudioElement.play().catch(e => {
            console.error('Error en retry:', e);
            this.showAudioUnlockButton();
          });
        }
      }
    }, 1000);
  }

  // ⚡ NUEVO: Botón de desbloqueo de audio
  showAudioUnlockButton() {
    // Evitar duplicados
    const existing = document.getElementById('unlockAudioBtn');
    if (existing) return;
    
    const button = document.createElement('button');
    button.id = 'unlockAudioBtn';
    button.textContent = '🔊 Activar Audio Remoto';
    button.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      padding: 20px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      animation: pulse 2s infinite;
    `;
    
    button.onclick = () => {
      if (this.remoteAudioElement) {
        this.remoteAudioElement.play()
          .then(() => {
            console.log('✅ Audio desbloqueado manualmente');
            button.remove();
          })
          .catch(err => {
            console.error('❌ No se pudo desbloquear:', err);
            alert('No se pudo activar el audio. Verifica los permisos del navegador.');
          });
      } else {
        button.remove();
      }
    };
    
    document.body.appendChild(button);
    
    // Auto-eliminar después de 15 segundos
    setTimeout(() => {
      if (button.parentNode) {
        button.remove();
      }
    }, 15000);
  }

  // ========================================
  // FINALIZAR LLAMADA
  // ========================================
  
  async endCall() {
    console.log('📞 [WebRTC] Finalizando llamada');
    
    if (this.currentCallId) {
      try {
        await iceClient.endCall(this.currentCallId, state.currentUsername);
      } catch (error) {
        console.error('Error notificando fin de llamada:', error);
      }
    }
    
    this.cleanup();
    console.log('✅ [WebRTC] Llamada finalizada');
  }

  // ========================================
  // CONTROLES
  // ========================================
  
  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      console.log('🎤 Audio local:', enabled ? 'activado' : 'silenciado');
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      console.log('📹 Video:', enabled ? 'activado' : 'desactivado');
    }
  }

  // ========================================
  // LIMPIAR RECURSOS
  // ========================================
  
  cleanup() {
    console.log('🧹 [WebRTC] Limpiando recursos...');
    
    if (this.remoteAudioElement) {
      try {
        this.remoteAudioElement.pause();
        this.remoteAudioElement.srcObject = null;
        this.remoteAudioElement.remove();
      } catch (e) {
        console.warn('Error limpiando audio remoto:', e);
      }
      this.remoteAudioElement = null;
      console.log('🔇 Audio remoto eliminado');
    }
    
    // Limpiar botón de desbloqueo si existe
    const unlockBtn = document.getElementById('unlockAudioBtn');
    if (unlockBtn) {
      unlockBtn.remove();
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Track local detenido:', track.kind);
      });
      this.localStream = null;
    }
    
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.currentCallId = null;
    this.isInitiator = false;
    this.iceCandidateQueue = [];
    
    console.log('✅ [WebRTC] Recursos limpiados');
  }

  // ========================================
  // GETTERS
  // ========================================
  
  isCallActive() {
    return this.peerConnection !== null && 
           this.peerConnection.connectionState === 'connected';
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }
}

export const webrtcManager = new WebRTCManager();