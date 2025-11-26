// ============================================
// js/simpleAudioStream.js - VERSIÓN FUNCIONAL
// Audio bidireccional sobre Ice (Subject / Observer)
// SIN WEBRTC
// ============================================

class SimpleAudioStream {
  constructor() {
    this.audioSubject = null;
    this.username = null;

    this.audioContext = null;
    this.playQueue = [];
    this.isPlaying = false;

    this.active = false;
  }

  setAudioSubject(audioSubject, username) {
    this.audioSubject = audioSubject;
    this.username = username;

    console.log("🎤 [AUDIO STREAM] Configurado para:", username);
  }

  isActive() {
    return this.active;
  }

  async startStreaming() {
    if (this.active) {
      console.log("🎤 [AUDIO STREAM] Ya activo");
      return;
    }

    console.log("🎤 [AUDIO STREAM] Activando...");

    // Crear audio context
    this.audioContext = new AudioContext({ sampleRate: 48000 });

    // Registrar callback para recibir paquetes
    if (this.audioSubject && typeof this.audioSubject.setAudioCallback === "function") {
      this.audioSubject.setAudioCallback((bytes) => {
        this.enqueuePacket(bytes);
      });
    }

    this.active = true;
    console.log("🎤 [AUDIO STREAM] ACTIVADO");
  }

  enqueuePacket(bytes) {
    if (!bytes || bytes.length === 0) return;

    // Convertimos a float32 PCM normalizado
    const floatData = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      floatData[i] = bytes[i] / 128.0 - 1.0; // PCM 8 bits → float32
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

  cleanup() {
    console.log("🧹 [AUDIO STREAM] Cleanup");

    this.active = false;

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    this.playQueue = [];
    this.isPlaying = false;
  }
}

export const simpleAudioStream = new SimpleAudioStream();

// Exponer global
if (typeof window !== "undefined") {
  window.simpleAudioStream = simpleAudioStream;
}
