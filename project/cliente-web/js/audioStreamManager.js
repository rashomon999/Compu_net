// ============================================
// js/audioStreamManager.js - Audio Streaming Directo por ICE
// Inspirado en el enfoque del profesor, sin WebRTC
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';

class AudioStreamManager {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.isStreaming = false;
    this.sendBuffer = [];
    this.receiveQueue = [];
    this.isPlaying = false;
    this.gainNode = null;
    
    console.log('🎵 AudioStreamManager inicializado');
  }

  // ========================================
  // INICIAR CAPTURA DE AUDIO
  // ========================================
  
  async startStreaming() {
    try {
      console.log('🎤 [STREAM] Iniciando captura de audio...');
      
      // Crear AudioContext si no existe
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000 // Mismo que el profesor (más eficiente que 44100)
        });
        console.log('   AudioContext creado: ' + this.audioContext.sampleRate + ' Hz');
      }
      
      // Resume el contexto (requerido por navegadores)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Solicitar acceso al micrófono
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('   ✅ Micrófono accedido');
      
      // Crear nodos de audio
      const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Crear nodo de ganancia (volumen)
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.8; // 80% volumen
      
      // Crear procesador de script (2048 samples)
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      // Conectar pipeline
      audioInput.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Handler de procesamiento de audio
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isStreaming) return;
        
        // Obtener datos de entrada (Float32)
        const input = e.inputBuffer.getChannelData(0);
        
        // Aplicar compresión suave (como el profesor)
        const compressed = this.applySoftCompression(input);
        
        // Convertir a PCM16
        const pcm16 = this.floatToPCM16(compressed);
        
        // Acumular en buffer
        this.sendBuffer.push(pcm16);
        
        // Enviar cuando hay suficientes chunks (similar al profesor)
        if (this.sendBuffer.length >= 4) { // Enviar cada ~185ms
          const merged = this.mergePCM(this.sendBuffer);
          this.sendBuffer = [];
          
          // Enviar al servidor via ICE
          this.sendAudioToServer(new Uint8Array(merged.buffer));
        }
      };
      
      this.isStreaming = true;
      console.log('✅ [STREAM] Captura de audio activa');
      
      return true;
      
    } catch (error) {
      console.error('❌ [STREAM] Error iniciando captura:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Permiso de micrófono denegado');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No se encontró micrófono');
      }
      
      throw error;
    }
  }

  // ========================================
  // DETENER CAPTURA DE AUDIO
  // ========================================
  
  stopStreaming() {
    console.log('🛑 [STREAM] Deteniendo captura...');
    
    this.isStreaming = false;
    
    // Desconectar procesador
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    // Detener stream del micrófono
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Limpiar buffers
    this.sendBuffer = [];
    
    console.log('✅ [STREAM] Captura detenida');
  }

  // ========================================
  // ENVIAR AUDIO AL SERVIDOR
  // ========================================
  
  async sendAudioToServer(audioData) {
    try {
      // Enviar via ICE (nuevo método sendAudioChunk)
      await iceClient.sendAudioChunk(state.currentUsername, audioData);
    } catch (error) {
      console.error('❌ [STREAM] Error enviando audio:', error);
    }
  }

  // ========================================
  // RECIBIR Y REPRODUCIR AUDIO
  // ========================================
  
  async receiveAudioChunk(audioData) {
    try {
      // Convertir PCM16 a Float32
      const floatArray = this.convertPCM16ToFloat32(audioData);
      
      // Agregar a la cola
      this.receiveQueue.push(floatArray);
      
      // Iniciar reproducción si no está corriendo
      if (!this.isPlaying) {
        this.processReceiveQueue();
      }
    } catch (error) {
      console.error('❌ [STREAM] Error recibiendo audio:', error);
    }
  }

  processReceiveQueue() {
    if (this.receiveQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    
    // Extraer el siguiente buffer
    const data = this.receiveQueue.shift();
    
    // Crear AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, data.length, this.audioContext.sampleRate);
    audioBuffer.getChannelData(0).set(data);
    
    // Crear source node
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    // Reproducir
    source.start();
    
    // Cuando termina, procesar el siguiente
    source.onended = () => this.processReceiveQueue();
  }

  // ========================================
  // PROCESAMIENTO DE AUDIO
  // ========================================
  
  // Compresión dinámica suave (del profesor)
  applySoftCompression(buffer) {
    const threshold = 0.65;
    const ratio = 4.0;
    const out = new Float32Array(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      let v = buffer[i];
      // Si supera el umbral, comprime
      if (Math.abs(v) > threshold) {
        v = Math.sign(v) * (threshold + (Math.abs(v) - threshold) / ratio);
      }
      out[i] = v;
    }
    
    return out;
  }

  // Merge múltiples chunks PCM16
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

  // Convierte Float32 (-1.0 a 1.0) a PCM16 (-32768 a 32767)
  floatToPCM16(float32) {
    const pcm16 = new Int16Array(float32.length);
    
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i])); // Clamp
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    
    return pcm16;
  }

  // Convierte PCM16 a Float32
  convertPCM16ToFloat32(byteArray) {
    const view = new DataView(byteArray.buffer);
    const floatBuffer = new Float32Array(byteArray.byteLength / 2);
    
    for (let i = 0; i < floatBuffer.length; i++) {
      // Lee Int16 en little-endian, normaliza a [-1, 1]
      floatBuffer[i] = view.getInt16(i * 2, true) / 32768;
    }
    
    return floatBuffer;
  }

  // ========================================
  // CONTROLES
  // ========================================
  
  toggleMute(muted) {
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.8;
      console.log('🎤 Audio local:', muted ? 'silenciado' : 'activado');
    }
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // ========================================
  // LIMPIAR RECURSOS
  // ========================================
  
  cleanup() {
    console.log('🧹 [STREAM] Limpiando recursos...');
    
    this.stopStreaming();
    this.receiveQueue = [];
    this.isPlaying = false;
    
    // NO cerrar audioContext para poder reutilizarlo
    
    console.log('✅ [STREAM] Recursos limpiados');
  }

  // ========================================
  // GETTERS
  // ========================================
  
  isActive() {
    return this.isStreaming;
  }

  getAudioContext() {
    return this.audioContext;
  }
}

// Exportar instancia única
export const audioStreamManager = new AudioStreamManager();