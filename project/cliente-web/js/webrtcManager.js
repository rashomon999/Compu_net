// ============================================
// js/webrtcManager.js - Gestor WebRTC CON AUDIO REMOTO FUNCIONANDO
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
      
      // ✅ PASO 1: Obtener stream local
      console.log('🎤 [WebRTC] Solicitando acceso al micrófono...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall
      });
      console.log('✅ [WebRTC] Stream local obtenido');
      
      // ✅ PASO 2: Crear PeerConnection
      console.log('🔗 [WebRTC] Creando PeerConnection...');
      await this.createPeerConnection();
      console.log('✅ [WebRTC] PeerConnection creada');
      
      // ✅ PASO 3: Agregar tracks
      this.localStream.getTracks().forEach(track => {
        console.log('📎 [WebRTC] Agregando track:', track.kind);
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      // ✅ PASO 4: Crear offer
      console.log('📝 [WebRTC] Creando offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ [WebRTC] Local description establecida');
      
      // ✅ PASO 5: Enviar offer al servidor ICE
      console.log('📤 [WebRTC] Enviando offer al servidor...');
      const callType = isVideoCall ? 'VIDEO' : 'AUDIO';
      const result = await iceClient.initiateCall(
        state.currentUsername,
        targetUser,
        callType,
        offer.sdp
      );
      
      // ⚡ CRÍTICO: Extraer solo el ID, removiendo "SUCCESS:" si existe
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
      
      // Aceptar llamada
      this.currentCallId = offer.callId;
      this.isInitiator = false;
      
      // Obtener stream local
      console.log('🎤 [WebRTC] Solicitando acceso al micrófono...');
      
      const Ice = window.Ice;
      const isVideoCall = (offer.callType === Ice.ChatSystem.CallType.Video);
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoCall
      });
      
      // Crear PeerConnection
      await this.createPeerConnection();
      
      // Agregar tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
      
      // Establecer remote description
      console.log('📥 [WebRTC] Estableciendo remote description...');
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({
          type: 'offer',
          sdp: offer.sdp
        })
      );
      
      // Crear answer
      console.log('📝 [WebRTC] Creando answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // ⚡ CRÍTICO: Enviar answer con status ACCEPTED (no Ringing)
      console.log('📤 [WebRTC] Enviando answer con status ACCEPTED...');
      await iceClient.answerCall(
        offer.callId,
        state.currentUsername,
        'ACCEPTED',  // ⚡ DEBE ser 'ACCEPTED', NO 'Ringing'
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
      
      if (answer.status !== 'ACCEPTED') {
        console.log('❌ [WebRTC] Llamada rechazada');
        this.cleanup();
        return;
      }
      
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
      
      // Procesar ICE candidates pendientes
      if (this.iceCandidateQueue.length > 0) {
        console.log('🧊 [WebRTC] Procesando', this.iceCandidateQueue.length, 'candidates pendientes');
        for (const candidate of this.iceCandidateQueue) {
          await this.peerConnection.addIceCandidate(candidate);
        }
        this.iceCandidateQueue = [];
      }
      
      console.log('✅ [WebRTC] Respuesta procesada correctamente');
      
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
      
      // Si aún no tenemos remote description, encolar
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
    
    // ICE Candidate
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
    
    // Connection State
    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 [WebRTC] Connection state:', this.peerConnection.connectionState);
      
      if (this.peerConnection.connectionState === 'connected') {
        console.log('✅ [WebRTC] Conexión establecida exitosamente');
      }
      
      if (this.peerConnection.connectionState === 'failed') {
        console.error('❌ [WebRTC] Conexión falló');
      }
    };
    
    // ✅ CRÍTICO: Remote Stream con audio
    this.peerConnection.ontrack = (event) => {
      console.log('📡 [WebRTC] Track remoto recibido:', event.track.kind);
      console.log('   - Track ID:', event.track.id);
      console.log('   - Track enabled:', event.track.enabled);
      console.log('   - Track readyState:', event.track.readyState);
      console.log('   - Streams:', event.streams.length);
      
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      this.remoteStream.addTrack(event.track);
      
      // ✅ SOLUCIÓN: Llamar setupRemoteAudio() cuando llegue el track
      if (event.track.kind === 'audio') {
        console.log('🔊 [WebRTC] Configurando reproducción de audio remoto...');
        this.setupRemoteAudio();
      }
    };
  }

  // ========================================
  // ✅ CONFIGURAR AUDIO REMOTO
  // ========================================
  
  setupRemoteAudio() {
    console.log('🔊 [WebRTC] Configurando audio remoto...');
    
    // Limpiar elemento anterior si existe
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause();
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement.remove();
      this.remoteAudioElement = null;
    }
    
    // Crear elemento de audio
    this.remoteAudioElement = document.createElement('audio');
    this.remoteAudioElement.id = 'remoteAudio';
    this.remoteAudioElement.autoplay = true;
    this.remoteAudioElement.playsInline = true;
    
    // ✅ IMPORTANTE: Asignar stream
    this.remoteAudioElement.srcObject = this.remoteStream;
    
    // Adjuntar al DOM (necesario en algunos navegadores)
    document.body.appendChild(this.remoteAudioElement);
    
    // Intentar reproducir
    this.remoteAudioElement.play()
      .then(() => {
        console.log('✅ [WebRTC] Audio remoto reproduciéndose');
        console.log('   Tracks:', this.remoteStream.getTracks().map(t => 
          `${t.kind} - enabled:${t.enabled} - state:${t.readyState}`
        ));
        
        // Verificar volumen
        console.log('   Volumen:', this.remoteAudioElement.volume);
        console.log('   Muted:', this.remoteAudioElement.muted);
      })
      .catch(err => {
        console.error('❌ [WebRTC] Error reproduciendo:', err);
        
        // Intentar solución de fallback
        if (err.name === 'NotAllowedError') {
          console.warn('⚠️ Autoplay bloqueado. Necesita interacción del usuario.');
          
          // Crear botón temporal para activar audio
          const unlockBtn = document.createElement('button');
          unlockBtn.textContent = '🔊 Activar Audio';
          unlockBtn.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 40px;
            font-size: 18px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            z-index: 10000;
          `;
          
          unlockBtn.onclick = () => {
            this.remoteAudioElement.play();
            unlockBtn.remove();
          };
          
          document.body.appendChild(unlockBtn);
        }
      });
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
    
    // ✅ Limpiar audio remoto
    if (this.remoteAudioElement) {
      this.remoteAudioElement.pause();
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement.remove();
      this.remoteAudioElement = null;
      console.log('🔇 Audio remoto eliminado');
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