// ============================================
// js/audioStreamManager.js - Audio Streaming PCM Directo por ICE
// Filosofía del profesor: NO WebRTC, solo PCM16 raw
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
    this.isMuted = false;
    
    console.log('🎵 [AUDIO STREAM] Inicializado (modo PCM directo)');
  }

  // ========================================
  // INICIAR CAPTURA DE AUDIO (del micrófono)
  // ========================================
  
  async startStreaming() {
    try {
      console.log('🎤 [STREAM] Iniciando captura de audio...');
      console.log('   Usuario:', state.currentUsername);
      console.log('   isStreaming actual:', this.isStreaming);
      
      // Crear AudioContext si no existe
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100 // Igual que el proyecto del profesor
        });
        console.log('   AudioContext creado: 44.1kHz');
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Solicitar acceso al micrófono
      console.log('   Solicitando micrófono...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });
      
      console.log('   ✅ Micrófono accedido');
      
      // Crear pipeline de audio (IGUAL que el proyecto del profesor)
      const audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0.5; // Volumen 50%
      
      // ScriptProcessor (mismo que usa el profesor en web)
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      
      audioInput.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      
      // Handler de procesamiento (CRÍTICO - igual que el profesor)
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isStreaming) return;
        
        // PASO 1: Obtener datos Float32
        const input = e.inputBuffer.getChannelData(0);
        
        // PASO 2: Aplicar compresión suave (igual que el profesor)
        const compressed = this.applySoftCompression(input);
        
        // PASO 3: Convertir a PCM16 (CRÍTICO)
        const pcm16 = this.floatToPCM16(compressed);
        
        // PASO 4: Acumular en buffer
        this.sendBuffer.push(pcm16);
        
        // PASO 5: Enviar cuando hay suficientes chunks (igual que el profesor)
        if (this.sendBuffer.length >= 8) {
          const merged = this.mergePCM(this.sendBuffer);
          this.sendBuffer = [];
          
          // ✅ ENVIAR DIRECTAMENTE AL SERVIDOR (sin WebRTC)
          this.sendAudioToServer(new Uint8Array(merged.buffer));
        }
      };
      
      this.isStreaming = true;
      console.log('✅ [STREAM] Captura de audio ACTIVA');
      
      return true;
      
    } catch (error) {
      console.error('❌ [STREAM] Error:', error);
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
  // ENVIAR AUDIO AL SERVIDOR (CRÍTICO)
  // ========================================
  
  async sendAudioToServer(audioData) {
    try {
      if (!this.isStreaming) return;
      
      // ✅ DEBUG: Log cada 50 paquetes
      if (!this._audioPacketCount) this._audioPacketCount = 0;
      this._audioPacketCount++;
      
      if (this._audioPacketCount % 50 === 0) {
        console.log(`📤 [STREAM] Enviados ${this._audioPacketCount} paquetes de audio`);
        console.log(`   Último paquete: ${audioData.byteLength} bytes`);
        console.log(`   Usuario: ${state.currentUsername}`);
      }
      
      // ✅ Enviar via Ice (igual que el profesor en sendAudio)
      await iceClient.sendAudioChunk(state.currentUsername, audioData);
      
    } catch (error) {
      // Silenciar errores de timeout para no saturar consola
      if (!error.message.includes('timeout')) {
        console.warn('⚠️ [STREAM] Error enviando:', error.message);
      }
    }
  }

  // ========================================
  // RECIBIR Y REPRODUCIR AUDIO
  // ========================================
  
  async receiveAudioChunk(audioData) {
    try {
      // ✅ DEBUG: Contar paquetes recibidos
      if (!this._receivePacketCount) this._receivePacketCount = 0;
      this._receivePacketCount++;
      
      if (this._receivePacketCount % 50 === 0) {
        console.log(`📥 [STREAM] Recibidos ${this._receivePacketCount} paquetes de audio`);
        console.log(`   Último paquete: ${audioData.byteLength} bytes`);
      }
      
      // Validar AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100
        });
      }
      
      // Resume si está suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // ✅ Convertir PCM16 a Float32 (igual que el profesor)
      const floatArray = this.convertPCM16ToFloat32(audioData);
      
      // Agregar a la cola
      this.receiveQueue.push(floatArray);
      
      // Iniciar reproducción si no está corriendo
      if (!this.isPlaying) {
        this.processReceiveQueue();
      }
      
    } catch (error) {
      console.error('❌ [STREAM] Error recibiendo:', error);
    }
  }

  processReceiveQueue() {
    if (this.receiveQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    
    // Extraer siguiente buffer
    const data = this.receiveQueue.shift();
    
    // Crear AudioBuffer (igual que el profesor)
    const audioBuffer = this.audioContext.createBuffer(
      1, 
      data.length, 
      44100
    );
    audioBuffer.getChannelData(0).set(data);
    
    // Crear source y reproducir
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.start();
    
    // Cuando termina, procesar el siguiente
    source.onended = () => this.processReceiveQueue();
  }

  // ========================================
  // PROCESAMIENTO DE AUDIO (IGUAL QUE EL PROFESOR)
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
      // Little-endian, igual que el profesor
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
      this.gainNode.gain.value = muted ? 0 : 0.5;
      console.log('🎤 [STREAM]', muted ? 'SILENCIADO' : 'ACTIVO');
    }
  }

  // ========================================
  // LIMPIAR
  // ========================================
  
  cleanup() {
    console.log('🧹 [STREAM] Limpiando...');
    
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