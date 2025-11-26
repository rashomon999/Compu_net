// ============================================
// js/simpleAudioStream.js - VERSIÓN OPTIMIZADA SIN DESFASE
// ✅ Latencia mínima (< 50ms)
// ✅ Sin colas que crezcan
// ✅ Reproducción directa con Web Audio API
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

    // === REPRODUCCIÓN OPTIMIZADA ===
    this.nextPlayTime = 0; // Para sincronización precisa
    this.bufferDuration = 0.046; // Duración de cada buffer (2048/44100)

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
        sampleRate: 44100,
        latencyHint: 'interactive' // ✅ CRÍTICO: Minimiza latencia
      });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('   ✅ AudioContext creado (latency:', this.audioContext.baseLatency, 's)');

      // 2️⃣ Capturar micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // ✅ Desactivar para evitar cortes
          sampleRate: 44100,
          channelCount: 1
        }
      });
      console.log('   ✅ Micrófono capturado');

      // 3️⃣ Crear pipeline de audio
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      
      // ✅ Buffer MÁS PEQUEÑO para menor latencia
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      // 4️⃣ Conectar pipeline
      source.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      console.log('   ✅ Captura de audio conectada');

      // Marcar como activo ANTES de onaudioprocess
      this.isStreaming = true;

      let packetCount = 0;

      // 5️⃣ Procesar audio capturado - ✅ SIN ACUMULAR
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isStreaming || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // ✅ CONVERSIÓN PCM16 OPTIMIZADA
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = Math.round(s < 0 ? s * 32768 : s * 32767);
        }

        // ✅ ENVIAR INMEDIATAMENTE (SIN ACUMULAR)
        const uint8View = new Uint8Array(pcm16.buffer);
        
        if (packetCount % 20 === 0) {
          console.log(`📤 [AUDIO] Paquete #${packetCount} (${uint8View.length} bytes, ${inputData.length} samples)`);
        }
        packetCount++;
        
        this.sendAudioPacket(uint8View);
      };

      // ✅ Inicializar timer de reproducción
      this.nextPlayTime = this.audioContext.currentTime;

      console.log('✅ [AUDIO STREAM] ACTIVO (latencia ~46ms)');

    } catch (error) {
      console.error('❌ [AUDIO STREAM] Error activando:', error);
      this.cleanup();
      throw error;
    }
  }

  // ========================================
  // ENVIAR AUDIO AL SERVIDOR
  // ========================================
  async sendAudioPacket(pcm8Data) {
    if (!this.audioSubject || !this.isStreaming) return;

    try {
      await this.audioSubject.sendAudio(this.username, pcm8Data);
    } catch (error) {
      if (!error.message?.includes('timeout')) {
        console.error('❌ Error enviando audio:', error);
      }
    }
  }

  // ========================================
  // ✅ RECEPCIÓN Y REPRODUCCIÓN DIRECTA (SIN COLA)
  // ========================================
  receiveAudio(audioData) {
    if (!this.isStreaming || !audioData || audioData.length === 0) return;

    try {
      // ✅ CONVERSIÓN CORRECTA (Little Endian)
      const uint8Array = audioData instanceof Uint8Array 
        ? audioData 
        : new Uint8Array(audioData);
      
      // Bytes → Int16Array (little-endian)
      const pcm16 = new Int16Array(uint8Array.length / 2);
      for (let i = 0; i < pcm16.length; i++) {
        const lowByte = uint8Array[i * 2];
        const highByte = uint8Array[i * 2 + 1];
        // ✅ Combinar bytes correctamente
        pcm16[i] = (highByte << 8) | lowByte;
        // Manejar signo
        if (pcm16[i] > 32767) pcm16[i] -= 65536;
      }
      
      // Int16 → Float32 para reproducción
      const floatData = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        floatData[i] = pcm16[i] / 32768.0;
      }

      // ✅ REPRODUCIR DIRECTAMENTE (SIN COLA)
      this.playImmediately(floatData);
      
    } catch (error) {
      console.error('❌ Error procesando audio recibido:', error);
    }
  }

  // ✅ REPRODUCCIÓN INMEDIATA CON SINCRONIZACIÓN PRECISA
  playImmediately(floatData) {
    if (!this.audioContext) return;

    // Crear buffer de audio
    const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 44100);
    audioBuffer.copyToChannel(floatData, 0);

    // Crear source
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // ✅ SINCRONIZACIÓN PRECISA
    const now = this.audioContext.currentTime;
    
    // Si el siguiente tiempo está muy atrás, resetear
    if (this.nextPlayTime < now - 0.1) {
      console.warn('⚠️ Reseteo de timeline de audio (desfase detectado)');
      this.nextPlayTime = now;
    }
    
    // Si está muy adelante (más de 200ms), ajustar
    if (this.nextPlayTime > now + 0.2) {
      console.warn('⚠️ Timeline muy adelantado, ajustando');
      this.nextPlayTime = now + 0.05;
    }
    
    // Programar reproducción
    source.start(Math.max(this.nextPlayTime, now));
    
    // Actualizar próximo tiempo
    this.nextPlayTime = Math.max(this.nextPlayTime, now) + audioBuffer.duration;
  }

  // ========================================
  // CONTROL DE MICRÓFONO
  // ========================================
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1.0;
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

    this.isMuted = false;
    this.gainNode = null;
    this.nextPlayTime = 0;
  }
}

export const simpleAudioStream = new SimpleAudioStream();

if (typeof window !== 'undefined') {
  window.simpleAudioStream = simpleAudioStream;
}