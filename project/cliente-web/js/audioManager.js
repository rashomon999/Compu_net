// ============================================
// js/audioManager.js - Gestión de notas de voz
// Ubicación: cliente-web/js/audioManager.js
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';

class AudioManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingStartTime = null;
    this.maxRecordingTime = 30000; // 30 segundos máximo
  }

  // ========================================
  // GRABACIÓN DE NOTAS DE VOZ
  // ========================================

  async startRecording() {
    try {
      console.log('🎤 Iniciando grabación...');
      
      // Solicitar permiso del micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      // Configurar MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      console.log('  Formato de audio:', mimeType);
      
      this.audioChunks = [];
      this.recordingStartTime = Date.now();
      
      // Evento cuando hay datos disponibles
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      // Iniciar grabación
      this.mediaRecorder.start(100); // Recolectar cada 100ms
      this.isRecording = true;
      
      console.log('✅ Grabación iniciada');
      
      // Auto-detener después del tiempo máximo
      setTimeout(() => {
        if (this.isRecording) {
          console.log('⏱️ Tiempo máximo alcanzado, deteniendo...');
          this.stopRecording();
        }
      }, this.maxRecordingTime);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error iniciando grabación:', error);
      
      if (error.name === 'NotAllowedError') {
        alert('❌ Permiso de micrófono denegado. Por favor, permite el acceso.');
      } else if (error.name === 'NotFoundError') {
        alert('❌ No se encontró micrófono.');
      } else {
        alert('❌ Error al acceder al micrófono: ' + error.message);
      }
      
      return false;
    }
  }

  async stopRecording() {
    if (!this.isRecording) {
      console.warn('⚠️ No hay grabación activa');
      return null;
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = async () => {
        try {
          const duration = Date.now() - this.recordingStartTime;
          console.log(`⏱️ Duración: ${(duration / 1000).toFixed(1)}s`);
          
          // Crear blob de audio
          const mimeType = this.mediaRecorder.mimeType;
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          console.log(`📦 Audio capturado: ${audioBlob.size} bytes (${mimeType})`);
          
          // Validar tamaño mínimo
          if (audioBlob.size < 1000) {
            throw new Error('Audio demasiado corto (menos de 1KB)');
          }
          
          // Limpiar recursos
          this.isRecording = false;
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
          this.audioChunks = [];
          
          resolve(audioBlob);
          
        } catch (error) {
          console.error('❌ Error procesando audio:', error);
          reject(error);
        }
      };
      
      this.mediaRecorder.stop();
    });
  }

  cancelRecording() {
    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.isRecording = false;
      this.audioChunks = [];
      console.log('🚫 Grabación cancelada');
    }
  }

  // ========================================
  // ENVÍO VIA ICE
  // ========================================

  async sendVoiceNote(target, isGroup = false) {
    try {
      // Detener grabación y obtener blob
      const audioBlob = await this.stopRecording();
      
      if (!audioBlob) {
        throw new Error('No hay audio para enviar');
      }
      
      console.log('📤 Enviando nota de voz via ICE...');
      
      // Convertir a Base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      console.log(`  Base64 generado: ${base64Audio.length} caracteres`);
      
      // Enviar via ICE
      const result = await iceClient.saveVoiceNote(
        state.currentUsername,
        target,
        base64Audio,
        isGroup
      );
      
      if (result.startsWith('SUCCESS')) {
        console.log('✅ Nota de voz enviada exitosamente');
        return true;
      } else {
        throw new Error(result);
      }
      
    } catch (error) {
      console.error('❌ Error enviando nota de voz:', error);
      throw error;
    }
  }

  // ========================================
  // REPRODUCCIÓN
  // ========================================

  async playVoiceNote(audioFileRef) {
    try {
      console.log('🔊 Reproduciendo nota de voz:', audioFileRef);
      
      // Obtener audio desde servidor via ICE
      const base64Audio = await iceClient.getVoiceNote(audioFileRef);
      
      if (!base64Audio || base64Audio.length === 0) {
        throw new Error('Audio no encontrado o vacío');
      }
      
      console.log(`  Audio recibido: ${base64Audio.length} caracteres Base64`);
      
      // Convertir Base64 a Blob
      const audioBlob = this.base64ToBlob(base64Audio);
      
      // Crear URL temporal
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Crear elemento de audio y reproducir
      const audio = new Audio(audioUrl);
      
      audio.onloadedmetadata = () => {
        console.log(`  Duración: ${audio.duration.toFixed(1)}s`);
      };
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        console.log('✅ Reproducción completada');
      };
      
      audio.onerror = (error) => {
        console.error('❌ Error reproduciendo audio:', error);
        URL.revokeObjectURL(audioUrl);
        throw new Error('Error reproduciendo audio');
      };
      
      await audio.play();
      console.log('▶️ Reproduciendo...');
      
      return audio;
      
    } catch (error) {
      console.error('❌ Error cargando/reproduciendo nota de voz:', error);
      throw error;
    }
  }

  // ========================================
  // UTILIDADES
  // ========================================

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onloadend = () => {
        // Extraer solo la parte Base64 (después de la coma)
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  base64ToBlob(base64String, mimeType = 'audio/webm') {
    try {
      // Decodificar Base64
      const byteCharacters = atob(base64String);
      const byteArrays = [];
      
      // Convertir a array de bytes
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      
      const byteArray = new Uint8Array(byteArrays);
      
      // Crear Blob
      return new Blob([byteArray], { type: mimeType });
      
    } catch (error) {
      console.error('Error convirtiendo Base64 a Blob:', error);
      throw error;
    }
  }

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm'; // Fallback
  }

  isCurrentlyRecording() {
    return this.isRecording;
  }

  getRecordingTime() {
    if (!this.isRecording) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }
}

// Exportar instancia única
export const audioManager = new AudioManager();