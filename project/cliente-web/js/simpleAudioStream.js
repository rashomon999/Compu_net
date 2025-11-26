// ============================================
// js/simpleAudioStream.js - VERSIÓN BIDIRECCIONAL
// Captura del micrófono + Reproducción de audio
// ============================================

class SimpleAudioStream {
  constructor() {
    this.audioSubject = null;
    this.username = null;

    // === REPRODUCCIÓN ===
    this.audioContext = null;
    this.playQueue = [];
    this.isPlaying = false;

    // === CAPTURA ===
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.isMuted = false;

    this.active = false;

    console.log('🎤 [AUDIO STREAM] Inicializado');
  }

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;
    console.log('🎤 [AUDIO STREAM] Configurado para:', username);
  }

  isActive() {
    return this.active;
  }

  // ========================================
  // INICIAR STREAMING BIDIRECCIONAL
  // ========================================
  async startStreaming() {
    if (this.active) {
      console.log('🎤 [AUDIO STREAM] Ya activo');
      return;
    }

    console.log('🎤 [AUDIO STREAM] Activando...');

    try {
      // 1️⃣ Crear AudioContext
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      console.log('   ✅ AudioContext creado');

      // 2️⃣ Capturar micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      console.log('   ✅ Micrófono capturado');

      // 3️⃣ Conectar micrófono al AudioContext
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // 4️⃣ Crear procesador de audio (captura PCM)
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.active) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convertir Float32Array → Uint8Array (PCM 8 bits)
        const pcm8 = new Uint8Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm8[i] = Math.floor((s + 1) * 127.5);
        }

        // Enviar al servidor via Ice
        this.sendAudioPacket(pcm8);
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      console.log('   ✅ Captura de audio conectada');

      this.active = true;
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
    if (!this.audioSubject || !this.active) return;

    try {
      // Convertir Uint8Array a Ice.ByteSeq
      const iceByteSeq = Array.from(pcm8Data);
      
      await this.audioSubject.sendAudio(this.username, iceByteSeq);
      
    } catch (error) {
      // Silenciar errores de red frecuentes
      if (!error.message?.includes('timeout')) {
        console.error('❌ Error enviando audio:', error);
      }
    }
  }

  // ========================================
  // RECIBIR Y REPRODUCIR AUDIO
  // ========================================
  receiveAudio(bytes) {
    if (!this.active || !bytes || bytes.length === 0) return;

    // Convertir Ice.ByteSeq → Float32Array
    const floatData = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      floatData[i] = bytes[i] / 128.0 - 1.0;
    }

    this.playQueue.push(floatData);
    if (!this.isPlaying) this.playNext();
  }

  async playNext() {
    if (this.playQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;

    const data = this.playQueue.shift();
    const buffer = this.audioContext.createBuffer(1, data.length, 48000);
    buffer.copyToChannel(data, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();

    source.onended = () => this.playNext();
  }

  // ========================================
  // CONTROL DE MICRÓFONO
  // ========================================
  toggleMute(muted) {
    this.isMuted = muted;
    console.log('🎤', muted ? 'SILENCIADO' : 'ACTIVO');
  }

  // ========================================
  // CLEANUP
  // ========================================
  cleanup() {
    console.log('🧹 [AUDIO STREAM] Cleanup');

    this.active = false;

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
  }
}

export const simpleAudioStream = new SimpleAudioStream();

if (typeof window !== 'undefined') {
  window.simpleAudioStream = simpleAudioStream;
}