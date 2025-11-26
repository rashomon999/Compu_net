// ============================================
// js/auth.js - Autenticación CORREGIDA
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
    console.log(`🔌 Conectando a ${serverHost}:${serverPort}`);
    await iceClient.connect(username, serverHost, serverPort);
    
    state.currentUsername = username;
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando notificaciones...';
    }
    
    // Suscribirse a notificaciones
    await subscribeToRealTimeNotifications(username);
    
    // ✅ SUSCRIBIRSE A EVENTOS DE LLAMADA
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
      errorMsg = `No se pudo conectar a ${serverHost}:${serverPort}\n\nVerifica que:\n• El servidor esté corriendo\n• La dirección IP sea correcta\n• El firewall permita conexiones`;
    } else if (err.message.includes('timeout')) {
      errorMsg = `Timeout conectando a ${serverHost}:${serverPort}`;
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
// SUSCRIPCIÓN A EVENTOS DE LLAMADA
// ========================================

async function subscribeToCallEvents(username) {
  try {
    console.log('📞 Suscribiendo a eventos de llamadas...');
    
    await iceClient.subscribeToCallEvents(username, {
      
      // ✅ LLAMADA ENTRANTE
      onIncomingCall: async (offer) => {
        console.log('📞 [AUTH] ¡LLAMADA ENTRANTE!');
        console.log('   De:', offer.caller);
        console.log('   CallID:', offer.callId);
        
        try {
          const { showIncomingCallUI } = await import('./callUI.js');
          await showIncomingCallUI(offer);
        } catch (error) {
          console.error('❌ [AUTH] Error mostrando UI de llamada:', error);
        }
      },
      
      // ✅ RESPUESTA DE LLAMADA (MUY IMPORTANTE)
      onCallAnswer: async (answer) => {
  console.log('📞 [AUTH] RESPUESTA DE LLAMADA RECIBIDA');
  console.log('   CallID:', answer.callId);
  console.log('   Status RAW:', answer.status);
  
  try {
    // ✅ Usar instancia global
    const callManager = window._callManager;
    
    if (!callManager) {
      console.error('❌ [AUTH] callManager no está inicializado');
      return;
    }
    
    // ✅ Verificar activeCall
    const activeCall = callManager.getActiveCall();
    
    if (!activeCall) {
      console.warn('⚠️ [AUTH] No hay activeCall - La llamada se canceló o finalizó');
      return;
    }
    
    if (activeCall.id !== answer.callId) {
      console.warn('⚠️ [AUTH] CallID no coincide:', activeCall.id, '!==', answer.callId);
      return;
    }
    
    console.log('   ✅ activeCall válido:', activeCall);
    
    // Procesar respuesta
    await callManager.handleCallAnswer(answer);
    
    // ✅ ACTUALIZAR UI
    if (activeCall.type === 'OUTGOING' && activeCall.status === 'CONNECTED') {
      console.log('✅ [AUTH] Mostrando UI de llamada activa');
      const { showActiveCallUI } = await import('./callUI.js');
      showActiveCallUI(activeCall.calleeId);
    }
    
  } catch (error) {
    console.error('❌ [AUTH] Error:', error);
    const { hideCallUI } = await import('./callUI.js');
    hideCallUI();
    showError('Error en la llamada');
  }
},
      
      // ✅ AUDIO CHUNKS (NUEVO)
      onAudioChunk: async (chunk) => {
        if (!chunk || !chunk.data) {
          console.warn('⚠️ [AUTH] Chunk de audio inválido');
          return;
        }
        
        try {
          const { audioStreamManager } = await import('./audioStreamManager.js');
          
          // Convertir a Uint8Array si es necesario
          const audioData = chunk.data instanceof Uint8Array 
            ? chunk.data 
            : new Uint8Array(chunk.data);
          
          await audioStreamManager.receiveAudioChunk(audioData);
        } catch (error) {
          console.error('❌ [AUTH] Error procesando audio:', error);
        }
      },
      
      // RTC Candidate (ya no se usa pero mantener)
      onRtcCandidate: async (candidate) => {
        console.log('⚠️ [AUTH] RTC candidate (ignorado)');
      },
      
      // ✅ LLAMADA FINALIZADA
      onCallEnded: async (callId, reason) => {
        console.log('📞 [AUTH] Llamada finalizada:', reason);
        
        try {
          const { hideCallUI } = await import('./callUI.js');
          const { audioStreamManager } = await import('./audioStreamManager.js');
          
          audioStreamManager.cleanup();
          await callManager.endCall();
          hideCallUI();
          
          showError(`Llamada finalizada: ${reason}`);
        } catch (error) {
          console.error('Error limpiando llamada:', error);
        }
      }
    });
    
  } catch (error) {
    throw new Error('CallService no disponible: ' + error.message);
  }
}