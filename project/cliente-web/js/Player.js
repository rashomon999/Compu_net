// ============================================
// js/Player.js - Sistema de Llamadas COMPLETO
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';

class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.currentTarget = null;
    this.mediaStream = null;
    this.processor = null;
    this.sendBuffer = [];
    this.bufferQueue = [];
    this.isPlaying = false;
    this.isStreaming = false;
    this.callModal = null;
    this.callTimerInterval = null;
  }

  // ========================================
  // ✅ INICIALIZAR - REGISTRAR CALLBACKS
  // ========================================
  init() {
    console.log('🎵 [PLAYER] Inicializando AudioPlayer');
    
    // ✅ CRÍTICO: Registrar callbacks INMEDIATAMENTE
    iceClient.onIncomingCall((fromUser) => {
      console.log('📞 [PLAYER] Llamada entrante de:', fromUser);
      this.showIncomingCallModal(fromUser);
    });

    iceClient.onCallAccepted((byUser) => {
      console.log('✅ [PLAYER] Llamada aceptada por:', byUser);
      this.handleCallAccepted(byUser);
    });

    iceClient.onCallRejected((byUser) => {
      console.log('❌ [PLAYER] Llamada rechazada por:', byUser);
      alert(`${byUser} rechazó la llamada`);
      this.cleanup();
    });

    iceClient.onCallColgada((byUser) => {
      console.log('📴 [PLAYER] Llamada colgada por:', byUser);
      alert(`${byUser} colgó la llamada`);
      this.cleanup();
    });

    iceClient.onReceiveAudio((audioData) => {
      this.playAudio(audioData);
    });
    
    console.log('✅ [PLAYER] Callbacks registrados');
  }

  // ========================================
  // 📞 INICIAR LLAMADA (CALLER)
  // ========================================
  async startCall(targetUser) {
    if (this.isStreaming) {
      alert('Ya hay una llamada activa');
      return;
    }

    if (!targetUser) {
      alert('Selecciona un usuario para llamar');
      return;
    }

    try {
      console.log('📞 [PLAYER] Iniciando llamada a:', targetUser);
      
      this.currentTarget = targetUser;
      
      // Mostrar modal de "llamando..."
      this.showOutgoingCallModal(targetUser);
      
      // ✅ PASO 1: Enviar señal de inicio al servidor
      await iceClient.startCall(state.currentUsername, targetUser);
      console.log('✅ [PLAYER] Señal de llamada enviada');
      
      // ✅ PASO 2: Ya NO iniciamos grabación aquí
      // Esperamos a que el otro usuario ACEPTE
      
    } catch (error) {
      console.error('❌ [PLAYER] Error iniciando llamada:', error);
      alert('Error al iniciar llamada: ' + error.message);
      this.cleanup();
    }
  }

  // ========================================
  // ✅ MANEJAR ACEPTACIÓN (CALLER)
  // ========================================
  async handleCallAccepted(byUser) {
    console.log('✅ [PLAYER] Procesando aceptación de:', byUser);
    
    try {
      // Cerrar modal de "llamando"
      this.closeModal();
      
      // Iniciar captura de audio
      await this.startRecording();
      
      // Mostrar modal de llamada activa
      this.showActiveCallModal(byUser);
      
      console.log('✅ [PLAYER] Llamada establecida con:', byUser);
      
    } catch (error) {
      console.error('❌ [PLAYER] Error en handleCallAccepted:', error);
      alert('Error estableciendo llamada');
      this.cleanup();
    }
  }

  // ========================================
  // ✅ ACEPTAR LLAMADA (CALLEE)
  // ========================================
  async acceptCall(fromUser) {
    try {
      console.log('✅ [PLAYER] Aceptando llamada de:', fromUser);
      
      // ✅ PASO 1: Enviar señal de aceptación
      await iceClient.acceptCall(fromUser, state.currentUsername);
      console.log('   ✅ Señal enviada');
      
      // ✅ PASO 2: Establecer target
      this.currentTarget = fromUser;
      
      // ✅ PASO 3: Iniciar captura de audio
      await this.startRecording();
      console.log('   ✅ Grabación iniciada');
      
      // ✅ PASO 4: Mostrar UI de llamada activa
      this.showActiveCallModal(fromUser);
      console.log('   ✅ UI actualizada');
      
    } catch (error) {
      console.error('❌ [PLAYER] Error aceptando llamada:', error);
      alert('Error al aceptar llamada');
      this.cleanup();
    }
  }

  // ========================================
  // ❌ RECHAZAR LLAMADA
  // ========================================
  async rejectCall(fromUser) {
    try {
      console.log('❌ [PLAYER] Rechazando llamada de:', fromUser);
      await iceClient.rejectCall(fromUser, state.currentUsername);
      this.closeModal();
    } catch (error) {
      console.error('Error rechazando llamada:', error);
    }
  }

  // ========================================
  // 🎤 CAPTURA Y ENVÍO DE AUDIO
  // ========================================
  async startRecording() {
    if (this.mediaStream) {
      console.warn('⚠️ [PLAYER] Ya hay grabación activa');
      return;
    }

    try {
      console.log('🎤 [PLAYER] Iniciando captura de audio...');
      
      // Crear AudioContext
      this.audioContext = new AudioContext({ sampleRate: 44100 });
      await this.audioContext.resume();
      
      // Obtener micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('   ✅ Micrófono capturado');
      
      // Crear nodos de audio
      const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.5;

      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      audioInput.connect(gainNode);
      gainNode.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // ✅ Procesar y enviar audio
      this.processor.onaudioprocess = (e) => {
        if (!this.currentTarget || !this.isStreaming) return;

        const input = e.inputBuffer.getChannelData(0);
        const boosted = this.applySoftCompression(input);
        const pcm16 = this.floatToPCM16(boosted);
        
        this.sendBuffer.push(pcm16);

        // Enviar cada 8 chunks (~180ms de audio)
        if (this.sendBuffer.length >= 8) {
          const merged = this.mergePCM(this.sendBuffer);
          this.sendBuffer = [];
          
          // ✅ Enviar via ICE
          iceClient.sendAudio(state.currentUsername, new Uint8Array(merged.buffer));
        }
      };

      this.isStreaming = true;
      console.log('✅ [PLAYER] Captura de audio iniciada');
      
    } catch (error) {
      console.error('❌ [PLAYER] Error iniciando grabación:', error);
      
      if (error.name === 'NotAllowedError') {
        alert('❌ Permiso de micrófono denegado');
      } else if (error.name === 'NotFoundError') {
        alert('❌ No se encontró micrófono');
      } else {
        alert('❌ Error al acceder al micrófono: ' + error.message);
      }
      
      this.cleanup();
      throw error;
    }
  }

  stopRecording() {
    console.log('🛑 [PLAYER] Deteniendo captura de audio');
    
    this.isStreaming = false;
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.sendBuffer = [];
  }

  // ========================================
  // 🔊 REPRODUCCIÓN DE AUDIO REMOTO
  // ========================================
  playAudio(byteArray) {
    if (!byteArray || byteArray.length === 0) return;
    
    try {
      const floatArray = this.convertPCM16ToFloat32(byteArray);
      this.bufferQueue.push(floatArray);
      
      if (!this.isPlaying) {
        this.processQueue();
      }
    } catch (error) {
      console.error('❌ [PLAYER] Error reproduciendo audio:', error);
    }
  }

  processQueue() {
    if (this.bufferQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const data = this.bufferQueue.shift();

    // Crear AudioContext si no existe
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 44100 });
    }

    try {
      const audioBuffer = this.audioContext.createBuffer(1, data.length, 44100);
      audioBuffer.getChannelData(0).set(data);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      source.onended = () => this.processQueue();
    } catch (error) {
      console.error('❌ [PLAYER] Error en processQueue:', error);
      this.isPlaying = false;
    }
  }

  // ========================================
  // 🔧 UTILIDADES DE CONVERSIÓN
  // ========================================
  applySoftCompression(buffer) {
    const threshold = 0.65;
    const ratio = 4.0;
    const out = new Float32Array(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      let v = buffer[i];
      if (Math.abs(v) > threshold) {
        v = Math.sign(v) * (threshold + (Math.abs(v) - threshold) / ratio);
      }
      out[i] = v;
    }
    
    return out;
  }

  floatToPCM16(float32) {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }

  mergePCM(chunks) {
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Int16Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    return merged;
  }

  convertPCM16ToFloat32(byteArray) {
    const view = new DataView(byteArray.buffer);
    const floatBuffer = new Float32Array(byteArray.byteLength / 2);
    
    for (let i = 0; i < floatBuffer.length; i++) {
      floatBuffer[i] = view.getInt16(i * 2, true) / 32768;
    }
    
    return floatBuffer;
  }

  // ========================================
  // 🎨 UI MODALES
  // ========================================
  
  showIncomingCallModal(fromUser) {
    console.log('🎨 [PLAYER] Mostrando modal de llamada entrante');
    this.closeModal();

    this.callModal = document.createElement('div');
    this.callModal.className = 'call-modal incoming';
    this.callModal.innerHTML = `
      <div class="call-modal-content">
        <div class="call-icon pulsing">📞</div>
        <h3>Llamada entrante</h3>
        <p class="caller-name">${fromUser}</p>
        <div class="call-actions">
          <button class="btn-accept" id="acceptBtn">✅ Aceptar</button>
          <button class="btn-reject" id="rejectBtn">❌ Rechazar</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.callModal);

    document.getElementById('acceptBtn').onclick = () => {
      this.acceptCall(fromUser);
    };

    document.getElementById('rejectBtn').onclick = () => {
      this.rejectCall(fromUser);
    };
  }

  showOutgoingCallModal(targetUser) {
    console.log('🎨 [PLAYER] Mostrando modal de llamada saliente');
    this.closeModal();

    this.callModal = document.createElement('div');
    this.callModal.className = 'call-modal outgoing';
    this.callModal.innerHTML = `
      <div class="call-modal-content">
        <div class="call-icon">📞</div>
        <h3>Llamando a</h3>
        <p class="caller-name">${targetUser}</p>
        <div class="spinner"></div>
        <p class="call-status">Esperando respuesta...</p>
        <div class="call-actions">
          <button class="btn-end" id="cancelBtn">❌ Cancelar</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.callModal);

    document.getElementById('cancelBtn').onclick = () => {
      this.endCall();
    };
  }

  showActiveCallModal(targetUser) {
    console.log('🎨 [PLAYER] Mostrando modal de llamada activa');
    this.closeModal();

    this.callModal = document.createElement('div');
    this.callModal.className = 'call-modal active';
    this.callModal.innerHTML = `
      <div class="call-modal-content">
        <div class="call-icon active">📞</div>
        <h3>En llamada con</h3>
        <p class="caller-name">${targetUser}</p>
        <p class="call-timer" id="callTimer">00:00</p>
        <div class="call-actions">
          <button class="btn-end" id="hangupBtn">❌ Colgar</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.callModal);

    document.getElementById('hangupBtn').onclick = () => {
      this.endCall();
    };

    // Timer
    let seconds = 0;
    this.callTimerInterval = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timerEl = document.getElementById('callTimer');
      if (timerEl) {
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  closeModal() {
    if (this.callModal) {
      this.callModal.remove();
      this.callModal = null;
    }

    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
  }

  // ========================================
  // 📴 COLGAR LLAMADA
  // ========================================
  async endCall() {
    if (!this.currentTarget) {
      this.cleanup();
      return;
    }

    try {
      console.log('📞 [PLAYER] Colgando llamada con:', this.currentTarget);
      await iceClient.colgar(state.currentUsername, this.currentTarget);
    } catch (error) {
      console.error('Error colgando:', error);
    }

    this.cleanup();
  }

  cleanup() {
    console.log('🧹 [PLAYER] Limpiando recursos');
    
    this.stopRecording();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.currentTarget = null;
    this.bufferQueue = [];
    this.isPlaying = false;
    
    this.closeModal();
  }
}

// Exportar instancia única
export const audioPlayer = new AudioPlayer();