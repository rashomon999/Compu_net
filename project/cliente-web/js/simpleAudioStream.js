// ============================================
// js/simpleAudioStream.js - VERSIÓN FUNCIONAL
// ============================================

class SimpleAudioStream {
  constructor() {
    this.audioSubject = null;
    this.username = null;

    // === CAPTURA ===
    this.mediaStream = null;
    this.audioContext = null;
    this.scriptProcessor = null;
    this.gainNode = null;
    this.isMuted = false;
    this.isStreaming = false;

    // === REPRODUCCIÓN ===
    this.playQueue = [];
    this.isPlaying = false;

    console.log('🎤 [AUDIO STREAM] Inicializado');
  }

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;
    console.log('🎤 [AUDIO STREAM] Configurado para:', username);
  }

  isActive() {
    return this.isStreaming;
  }

  // ========================================
  // INICIAR STREAMING BIDIRECCIONAL
  // ========================================
  async startStreaming() {
    if (this.isStreaming) {
      console.log('🎤 [AUDIO STREAM] Ya activo');
      return;
    }

    console.log('🎤 [AUDIO STREAM] Activando...');

    try {
      // 1️⃣ Crear AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ 
        sampleRate: 44100 
      });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('   ✅ AudioContext creado (estado:', this.audioContext.state + ')');

      // 2️⃣ Capturar micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100
        }
      });
      console.log('   ✅ Micrófono capturado');

      // 3️⃣ Crear pipeline de audio
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.5;
      
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      // 4️⃣ Conectar pipeline
      source.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      console.log('   ✅ Captura de audio conectada');

      // Marcar como activo ANTES de onaudioprocess
      this.isStreaming = true;

      // Buffer para acumular
      let sendBuffer = [];
      let packetCount = 0;

      // 5️⃣ Procesar audio capturado
      this.scriptProcessor.onaudioprocess = (e) => {
        // ✅ LOG DE DIAGNÓSTICO
        if (packetCount === 0) {
          console.log('🎙️ [AUDIO] Primera captura de audio detectada');
          console.log('   isStreaming:', this.isStreaming);
          console.log('   isMuted:', this.isMuted);
          console.log('   audioSubject:', !!this.audioSubject);
          console.log('   username:', this.username);
        }

        if (!this.isStreaming) {
          console.warn('⚠️ [AUDIO] Captura detectada pero isStreaming=false');
          return;
        }
        
        if (this.isMuted) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // ✅ CONVERSIÓN PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        sendBuffer.push(pcm16);

        // Enviar cuando hay 8 chunks
        if (sendBuffer.length >= 8) {
          packetCount++;
          
          const merged = this.mergePCM16(sendBuffer);
          sendBuffer = [];
          
          const uint8View = new Uint8Array(merged.buffer);
          
          // ✅ LOG cada 10 paquetes
          if (packetCount % 10 === 0) {
            console.log(`📤 [AUDIO] Enviando paquete #${packetCount} (${uint8View.length} bytes)`);
          }
          
          this.sendAudioPacket(uint8View);
        }
      };

      console.log('✅ [AUDIO STREAM] ACTIVO (captura + reproducción)');
      console.log('   🎤 Escuchando entrada de micrófono...');

    } catch (error) {
      console.error('❌ [AUDIO STREAM] Error activando:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // MERGE PCM16 (de tu versión funcional)
  // ========================================
  mergePCM16(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    
    return merged;
  }

  // ========================================
  // ENVIAR AUDIO AL SERVIDOR
  // ========================================
  async sendAudioPacket(pcm8Data) {
    if (!this.audioSubject) {
      console.error('❌ [AUDIO] No hay audioSubject configurado');
      return;
    }
    
    if (!this.isStreaming) {
      console.warn('⚠️ [AUDIO] isStreaming es false');
      return;
    }

    try {
      // ✅ Ice.js requiere Uint8Array DIRECTO
      await this.audioSubject.sendAudio(this.username, pcm8Data);
      
    } catch (error) {
      if (!error.message?.includes('timeout')) {
        console.error('❌ Error enviando audio:', error);
      }
    }
  }

  // ========================================
  // RECIBIR Y REPRODUCIR AUDIO
  // ========================================
  receiveAudio(audioData) {
    if (!this.isStreaming || !audioData || audioData.length === 0) return;

    try {
      // ✅ Convertir bytes a Int16Array primero
      const view = new DataView(audioData.buffer || audioData);
      const pcm16 = new Int16Array(view.byteLength / 2);
      
      for (let i = 0; i < pcm16.length; i++) {
        pcm16[i] = view.getInt16(i * 2, true); // little-endian
      }
      
      // Convertir Int16 → Float32 para reproducción
      const floatData = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        floatData[i] = pcm16[i] / 32768.0;
      }

      this.playQueue.push(floatData);
      
      if (!this.isPlaying) {
        this.playNext();
      }
      
    } catch (error) {
      console.error('❌ Error procesando audio recibido:', error);
    }
  }

  async playNext() {
    if (this.playQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;

    const data = this.playQueue.shift();

    // Crear buffer de audio
    const audioBuffer = this.audioContext.createBuffer(1, data.length, 44100);
    audioBuffer.copyToChannel(data, 0);

    // Reproducir
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();

    // Continuar con el siguiente
    source.onended = () => this.playNext();
  }

  // ========================================
  // CONTROL DE MICRÓFONO
  // ========================================
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.5;
    }
    console.log('🎤', muted ? 'SILENCIADO' : 'ACTIVO');
  }

  // ========================================
  // CLEANUP
  // ========================================
  cleanup() {
    console.log('🧹 [AUDIO STREAM] Cleanup');

    this.isStreaming = false;

    // Detener captura
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Desconectar procesador
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    // Cerrar contexto
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    this.playQueue = [];
    this.isPlaying = false;
    this.isMuted = false;
    this.gainNode = null;
  }
}

export const simpleAudioStream = new SimpleAudioStream();

if (typeof window !== 'undefined') {
  window.simpleAudioStream = simpleAudioStream;
}