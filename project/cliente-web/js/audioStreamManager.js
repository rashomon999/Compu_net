// ============================================
// js/audioStreamManager.js - Audio Streaming Directo por ICE
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
    this.sourceNode = null;
    this.gainNode = null;
    this.isMuted = false;
    
    console.log('🎵 [AUDIO STREAM] Inicializado');
  }

  // ========================================
  // INICIAR CAPTURA DE AUDIO (del micrófono)
  // ========================================
  
  async startStreaming() {
    try {
      console.log('🎤 [STREAM] Iniciando captura de audio...');
      
      // Crear AudioContext si no existe
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
        console.log('   AudioContext creado: ' + this.audioContext.sampleRate + ' Hz');
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        console.log('   Reanudando AudioContext...');
        await this.audioContext.resume();
      }
      
      // Solicitar acceso al micrófono
      console.log('   Solicitando acceso al micrófono...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        } 
      });
      
      console.log('   ✅ Micrófono accedido');
      
      // Crear pipeline de audio
      const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.8;
      
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      audioInput.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Handler de procesamiento
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isStreaming) return;
        
        const input = e.inputBuffer.getChannelData(0);
        const compressed = this.applySoftCompression(input);
        const pcm16 = this.floatToPCM16(compressed);
        
        this.sendBuffer.push(pcm16);
        
        if (this.sendBuffer.length >= 4) {
          const merged = this.mergePCM(this.sendBuffer);
          this.sendBuffer = [];
          this.sendAudioToServer(new Uint8Array(merged.buffer));
        }
      };
      
      this.isStreaming = true;
      console.log('✅ [STREAM] Captura de audio ACTIVA');
      
      return true;
      
    } catch (error) {
      console.error('❌ [STREAM] Error:', error);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Permiso de micrófono denegado');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No se encontró micrófono');
      }
      
      throw error;
    }
  }

  // ========================================
  // DETENER CAPTURA
  // ========================================
  
  stopStreaming() {
    console.log('🛑 [STREAM] Deteniendo captura...');
    
    this.isStreaming = false;
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    this.sendBuffer = [];
    console.log('✅ [STREAM] Captura detenida');
  }

  // ========================================
  // ENVIAR AUDIO AL SERVIDOR
  // ========================================
  
  async sendAudioToServer(audioData) {
    try {
      if (!this.isStreaming) return;
      await iceClient.sendAudioChunk(state.currentUsername, audioData);
    } catch (error) {
      if (!error.message.includes('timeout')) {
        console.warn('⚠️ [STREAM] Error enviando audio:', error.message);
      }
    }
  }

  // ========================================
  // RECIBIR Y REPRODUCIR AUDIO
  // ========================================
  
  async receiveAudioChunk(audioData) {
    try {
      console.log('🔊 [STREAM] Audio recibido:', audioData.byteLength, 'bytes');
      
      // Validar que audioContext esté inicializado
      if (!this.audioContext) {
        console.warn('⚠️ [STREAM] AudioContext no inicializado, creando...');
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        console.log('   Reanudando AudioContext para reproducción...');
        await this.audioContext.resume();
      }
      
      // Convertir PCM16 a Float32
      const floatArray = this.convertPCM16ToFloat32(audioData);
      
      // Agregar a la cola
      this.receiveQueue.push(floatArray);
      
      console.log('   📥 Agregado a queue (total:', this.receiveQueue.length, ')');
      
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
    
    const data = this.receiveQueue.shift();
    
    const audioBuffer = this.audioContext.createBuffer(
      1, 
      data.length, 
      this.audioContext.sampleRate
    );
    audioBuffer.getChannelData(0).set(data);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.start();
    source.onended = () => this.processReceiveQueue();
  }

  // ========================================
  // PROCESAMIENTO DE AUDIO
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

  floatToPCM16(float32) {
    const pcm16 = new Int16Array(float32.length);
    
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    
    return pcm16;
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
  // CONTROLES
  // ========================================
  
  toggleMute(muted) {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 0.8;
      console.log('🎤 [STREAM] Audio:', muted ? 'SILENCIADO' : 'ACTIVO');
    }
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  // ========================================
  // LIMPIAR
  // ========================================
  
  cleanup() {
    console.log('🧹 [STREAM] Limpiando recursos...');
    
    this.stopStreaming();
    this.receiveQueue = [];
    this.isPlaying = false;
    this.isMuted = false;
    
    console.log('✅ [STREAM] Limpieza completada');
  }

  isActive() {
    return this.isStreaming;
  }
}

export const audioStreamManager = new AudioStreamManager();