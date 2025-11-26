// ============================================
// js/simpleAudioStream.js - VERSIÓN OPTIMIZADA
// ✅ Mejor calidad de audio
// ✅ Sin desfases
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

    // === REPRODUCCIÓN MEJORADA ===
    this.playQueue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0; // ✅ Para sincronización precisa

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
          autoGainControl: true, // ✅ Cambiado a true
          sampleRate: 44100
        }
      });
      console.log('   ✅ Micrófono capturado');

      // 3️⃣ Crear pipeline de audio
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.8; // ✅ Aumentado para mejor volumen
      
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
        if (packetCount === 0) {
          console.log('🎙️ [AUDIO] Primera captura de audio detectada');
        }

        if (!this.isStreaming || this.isMuted) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // ✅ CONVERSIÓN PCM16 OPTIMIZADA
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp entre -1 y 1
          const s = Math.max(-1, Math.min(1, inputData[i]));
          // Conversión con mejor precisión
          pcm16[i] = Math.round(s < 0 ? s * 32768 : s * 32767);
        }

        sendBuffer.push(pcm16);

        // Enviar cuando hay 4 chunks (✅ Reducido para menor latencia)
        if (sendBuffer.length >= 4) {
          packetCount++;
          
          const merged = this.mergePCM16(sendBuffer);
          sendBuffer = [];
          
          const uint8View = new Uint8Array(merged.buffer);
          
          if (packetCount % 10 === 0) {
            console.log(`📤 [AUDIO] Enviando paquete #${packetCount} (${uint8View.length} bytes)`);
          }
          
          this.sendAudioPacket(uint8View);
        }
      };

      // ✅ Inicializar timer de reproducción
      this.nextPlayTime = this.audioContext.currentTime;

      console.log('✅ [AUDIO STREAM] ACTIVO (captura + reproducción)');

    } catch (error) {
      console.error('❌ [AUDIO STREAM] Error activando:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // MERGE PCM16
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
    if (!this.audioSubject || !this.isStreaming) {
      return;
    }

    try {
      await this.audioSubject.sendAudio(this.username, pcm8Data);
    } catch (error) {
      if (!error.message?.includes('timeout')) {
        console.error('❌ Error enviando audio:', error);
      }
    }
  }

  // ========================================
  // ✅ RECEPCIÓN Y REPRODUCCIÓN MEJORADAS
  // ========================================
  receiveAudio(audioData) {
    if (!this.isStreaming || !audioData || audioData.length === 0) return;

    try {
      // ✅ CONVERSIÓN CORREGIDA (Little Endian)
      const uint8Array = audioData instanceof Uint8Array 
        ? audioData 
        : new Uint8Array(audioData);
      
      // Convertir bytes → Int16Array
      const pcm16 = new Int16Array(uint8Array.length / 2);
      for (let i = 0; i < pcm16.length; i++) {
        // Little-endian: byte bajo primero
        const lowByte = uint8Array[i * 2];
        const highByte = uint8Array[i * 2 + 1];
        pcm16[i] = (highByte << 8) | lowByte;
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

  // ✅ REPRODUCCIÓN CON SINCRONIZACIÓN PRECISA
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

    // Crear source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // ✅ PROGRAMAR REPRODUCCIÓN EN EL MOMENTO EXACTO
    const now = this.audioContext.currentTime;
    
    if (this.nextPlayTime < now) {
      // Si nos atrasamos, resetear
      this.nextPlayTime = now;
    }
    
    source.start(this.nextPlayTime);
    
    // Actualizar próximo tiempo
    this.nextPlayTime += audioBuffer.duration;

    // Continuar con el siguiente
    source.onended = () => this.playNext();
  }

  // ========================================
  // CONTROL DE MICRÓFONO
  // ========================================
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.8;
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
    this.nextPlayTime = 0;
  }
}

export const simpleAudioStream = new SimpleAudioStream();

if (typeof window !== 'undefined') {
  window.simpleAudioStream = simpleAudioStream;
}