// ============================================
// js/auth.js - Autenticación con Audio Streaming
// SIN WebRTC - Solo streaming directo por ICE
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';
import { subscribeToRealTimeNotifications } from './notifications.js';
import { callManager } from './callManager.js';

export async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  const serverHost = document.getElementById('serverHostInput')?.value.trim() || 'localhost';
  const serverPort = parseInt(document.getElementById('serverPortInput')?.value) || 10000;
  
  if (!username) {
    showError('Por favor ingresa un nombre de usuario');
    return;
  }
  
  if (serverPort < 1 || serverPort > 65535) {
    showError('Puerto inválido (debe estar entre 1 y 65535)');
    return;
  }

  const btn = document.getElementById('loginButton');
  const statusEl = document.getElementById('connectionStatus');
  const originalText = btn.textContent;
  
  btn.textContent = 'Conectando...';
  btn.disabled = true;
  
  if (statusEl) {
    statusEl.classList.remove('hidden', 'error');
    statusEl.classList.add('connecting');
    statusEl.querySelector('.status-text').textContent = `Conectando a ${serverHost}:${serverPort}...`;
  }

  try {
    console.log(`🔌 Intentando conectar a ${serverHost}:${serverPort}`);
    await iceClient.connect(username, serverHost, serverPort);
    
    state.currentUsername = username;
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando notificaciones...';
    }
    await subscribeToRealTimeNotifications(username);
    
    try {
      await subscribeToCallEvents(username);
      console.log('✅ Eventos de llamadas habilitados');
      state.callsAvailable = true;
    } catch (err) {
      console.warn('⚠️ CallService no disponible:', err.message);
      state.callsAvailable = false;
    }
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Cargando datos...';
    }
    showChatInterface();
    
    await loadRecentChatsFromICE();
    await loadGroupsFromICE();
    
    console.log('✅ Login exitoso:', username);
    
  } catch (err) {
    console.error('❌ Error en login:', err);
    
    let errorMsg = 'No se pudo conectar al servidor ICE';
    
    if (err.message.includes('ChatService')) {
      errorMsg = `No se pudo conectar a ${serverHost}:${serverPort}\n\nVerifica que:\n• El servidor esté corriendo\n• La dirección IP sea correcta\n• El firewall permita conexiones al puerto ${serverPort}`;
    } else if (err.message.includes('timeout')) {
      errorMsg = `Timeout conectando a ${serverHost}:${serverPort}\n\n¿El servidor está corriendo?`;
    } else {
      errorMsg = err.message;
    }
    
    showError(errorMsg);
    
    if (statusEl) {
      statusEl.classList.remove('connecting');
      statusEl.classList.add('error');
      statusEl.querySelector('.status-icon').textContent = '❌';
      statusEl.querySelector('.status-text').textContent = 'Error de conexión';
    }
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    
    if (statusEl && iceClient.isClientConnected()) {
      statusEl.classList.add('hidden');
    }
  }
}

export async function logout() {
  try {
    if (callManager.isCallActive()) {
      await callManager.endCall();
    }
    
    await iceClient.disconnect();
    console.log('👋 Logout exitoso');
  } catch (err) {
    console.error('Error en logout:', err);
  }
}

// ========================================
// SUSCRIPCIÓN A EVENTOS DE LLAMADAS
// ========================================

async function subscribeToCallEvents(username) {
  try {
    await iceClient.subscribeToCallEvents(username, {
      
      // Llamada entrante
      onIncomingCall: async (offer) => {
        console.log('📞 [AUTH] Llamada entrante de', offer.caller);
        
        const { showIncomingCallUI } = await import('./callUI.js');
        await showIncomingCallUI(offer);
      },
      
      // ⚡ Respuesta de llamada (con normalización robusta)
      onCallAnswer: async (answer) => {
        console.log('📞 [AUTH] Respuesta de llamada recibida');
        console.log('   📋 Datos completos del answer:', answer);
        console.log('   📋 Status RAW:', answer.status);
        console.log('   📋 Status type:', typeof answer.status);
        
        // ⚡ NORMALIZACIÓN ULTRA-ROBUSTA
        let normalizedStatus = null;
        
        if (typeof answer.status === 'string') {
          normalizedStatus = answer.status;
          console.log('   ✅ Status es string:', normalizedStatus);
          
        } else if (typeof answer.status === 'number') {
          const statusMap = {
            0: 'Ringing',
            1: 'Accepted',
            2: 'Rejected',
            3: 'Ended',
            4: 'Busy',
            5: 'NoAnswer'
          };
          normalizedStatus = statusMap[answer.status] || 'Unknown';
          console.log('   ✅ Status convertido de número', answer.status, '→', normalizedStatus);
          
        } else if (answer.status && typeof answer.status === 'object') {
          if (answer.status._name) {
            normalizedStatus = answer.status._name;
            console.log('   ✅ Status extraído de enum._name:', normalizedStatus);
          } else if (answer.status.name) {
            normalizedStatus = answer.status.name;
            console.log('   ✅ Status extraído de enum.name:', normalizedStatus);
          } else if (answer.status._value !== undefined) {
            const statusMap = {
              0: 'Ringing',
              1: 'Accepted',
              2: 'Rejected',
              3: 'Ended',
              4: 'Busy',
              5: 'NoAnswer'
            };
            normalizedStatus = statusMap[answer.status._value] || 'Unknown';
            console.log('   ✅ Status convertido desde _value:', normalizedStatus);
          } else {
            normalizedStatus = String(answer.status);
            console.log('   ⚠️ Status convertido a string:', normalizedStatus);
          }
        }
        
        // ⚡ CRÍTICO: Convertir a MAYÚSCULAS para comparación
        if (normalizedStatus) {
          normalizedStatus = normalizedStatus.toUpperCase();
        } else {
          console.error('❌ No se pudo normalizar el status');
          normalizedStatus = 'UNKNOWN';
        }
        
        console.log('   🎯 Status FINAL normalizado:', normalizedStatus);
        
        // ⚡ IGNORAR "Ringing" (estado transitorio)
        if (normalizedStatus === 'RINGING') {
          console.log('ℹ️ [AUTH] Estado Ringing ignorado (esperando respuesta final)');
          return;
        }
        
        try {
          const { showActiveCallUI, hideCallUI } = await import('./callUI.js');
          
          if (normalizedStatus === 'ACCEPTED') {
            console.log('✅ [AUTH] Llamada ACEPTADA - Procesando...');
            
            // ⚡ CRÍTICO: Procesar en callManager (sin webrtcManager)
            await callManager.handleCallAnswer(answer);
            
            // Mostrar UI solo para llamada saliente
            const activeCall = callManager.getActiveCall();
            console.log('   📋 activeCall después de handleAnswer:', activeCall);
            
            if (activeCall && activeCall.type === 'OUTGOING') {
              console.log('   📱 Mostrando UI de llamada activa');
              showActiveCallUI(activeCall.calleeId);
            } else {
              console.log('   ℹ️ No mostrar UI (es llamada entrante o no hay activeCall)');
            }
            
          } else if (normalizedStatus === 'REJECTED') {
            console.log('❌ [AUTH] Llamada RECHAZADA');
            hideCallUI();
            showError(`${state.currentChat} rechazó la llamada`);
            
          } else if (normalizedStatus === 'BUSY') {
            console.log('📵 [AUTH] Usuario ocupado');
            hideCallUI();
            showError(`${state.currentChat} está ocupado en otra llamada`);
            
          } else if (normalizedStatus === 'NOANSWER') {
            console.log('⏱️ [AUTH] Sin respuesta');
            hideCallUI();
            showError(`${state.currentChat} no respondió la llamada`);
            
          } else if (normalizedStatus === 'ENDED') {
            console.log('📞 [AUTH] Llamada finalizada');
            hideCallUI();
            
          } else {
            console.warn('⚠️ [AUTH] Estado no manejado:', {
              original: answer.status,
              normalized: normalizedStatus
            });
          }
          
        } catch (error) {
          console.error('❌ [AUTH] Error procesando respuesta:', error);
          console.error('   Stack trace:', error.stack);
          
          const { hideCallUI } = await import('./callUI.js');
          hideCallUI();
          showError('Error procesando respuesta de llamada');
        }
      },
      
      // ⚡ NUEVO: Audio chunks (en lugar de RTC candidates)
      onAudioChunk: async (chunk) => {
        console.log('🎵 [AUTH] Audio chunk recibido:', chunk.data.length, 'bytes');
        
        try {
          const { audioStreamManager } = await import('./audioStreamManager.js');
          
          // Convertir a Uint8Array si es necesario
          const audioData = chunk.data instanceof Uint8Array 
            ? chunk.data 
            : new Uint8Array(chunk.data);
          
          await audioStreamManager.receiveAudioChunk(audioData);
        } catch (error) {
          console.error('❌ [AUTH] Error procesando audio chunk:', error);
        }
      },
      
      // ⚠️ RTC Candidate - Ya no se usa pero mantener para compatibilidad
      onRtcCandidate: async (candidate) => {
        console.log('⚠️ [AUTH] RTC candidate recibido pero ya no se usa con streaming directo');
      },
      
      // Llamada finalizada
      onCallEnded: async (callId, reason) => {
        console.log('📞 [AUTH] Llamada finalizada:', reason);
        
        const { hideCallUI } = await import('./callUI.js');
        const { audioStreamManager } = await import('./audioStreamManager.js');
        
        audioStreamManager.cleanup();
        await callManager.endCall();
        hideCallUI();
        
        showError(`Llamada finalizada: ${reason}`);
      }
    });
    
  } catch (error) {
    throw new Error('CallService no disponible: ' + error.message);
  }
}