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
      
      console.log('   ✅ AudioContext creado');

      // 2️⃣ Capturar micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      });
      console.log('   ✅ Micrófono capturado');

      // 3️⃣ Crear pipeline de audio
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.5;
      
      // ✅ CRÍTICO: Buffer pequeño para baja latencia
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // 4️⃣ Conectar pipeline
      source.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      console.log('   ✅ Captura de audio conectada');

      // 5️⃣ Procesar audio capturado
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isStreaming || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0); // Float32Array
        
        // ✅ CONVERSIÓN CORRECTA: Float32 → Uint8 (PCM 8 bits)
        const pcm8 = new Uint8Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          pcm8[i] = Math.floor((sample + 1) * 127.5);
        }

        // Enviar inmediatamente (sin acumular)
        this.sendAudioPacket(pcm8);
      };

      this.isStreaming = true;
      console.log('✅ [AUDIO STREAM] ACTIVO (captura + reproducción)');

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
      // Convertir Uint8Array → Float32Array
      const floatData = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        floatData[i] = (audioData[i] / 127.5) - 1.0;
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