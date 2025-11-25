// ============================================
// js/auth.js - CORREGIDO: Manejo de respuesta de llamada
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
      
      // ✅ CORREGIDO: Respuesta a llamada
      onCallAnswer: async (answer) => {
        console.log('📞 [AUTH] Respuesta de llamada recibida:', answer.status);
        console.log('   Call ID:', answer.callId);
        console.log('   SDP presente:', !!answer.sdp);
        
        try {
          const { webrtcManager } = await import('./webrtcManager.js');
          const { showActiveCallUI, hideCallUI } = await import('./callUI.js');
          
          if (answer.status === 'ACCEPTED') {
            console.log('✅ [AUTH] Llamada ACEPTADA - Procesando...');
            
            // ✅ CRÍTICO: Llamar a callManager para manejar la transición
            await callManager.handleCallAnswer(answer, webrtcManager);
            
            // ✅ Mostrar UI de llamada activa SOLO para el caller
            const activeCall = callManager.getActiveCall();
            if (activeCall && activeCall.type === 'OUTGOING') {
              console.log('📱 [AUTH] Mostrando UI de llamada activa');
              showActiveCallUI(activeCall.calleeId);
            }
            
          } else if (answer.status === 'REJECTED') {
            console.log('❌ [AUTH] Llamada RECHAZADA');
            hideCallUI();
            showError(`${state.currentChat} rechazó la llamada`);
            
          } else {
            console.warn('⚠️ [AUTH] Estado de respuesta desconocido:', answer.status);
          }
          
        } catch (error) {
          console.error('❌ [AUTH] Error procesando respuesta:', error);
          const { hideCallUI } = await import('./callUI.js');
          hideCallUI();
          showError('Error procesando respuesta de llamada');
        }
      },
      
      // ICE Candidate
      onRtcCandidate: async (candidate) => {
        console.log('🧊 [AUTH] RTC candidate recibido');
        
        const { webrtcManager } = await import('./webrtcManager.js');
        await webrtcManager.handleIceCandidate(candidate);
      },
      
      // Llamada finalizada
      onCallEnded: async (callId, reason) => {
        console.log('📞 [AUTH] Llamada finalizada:', reason);
        
        const { hideCallUI } = await import('./callUI.js');
        const { webrtcManager } = await import('./webrtcManager.js');
        
        webrtcManager.cleanup();
        await callManager.endCall();
        hideCallUI();
        
        showError(`Llamada finalizada: ${reason}`);
      }
    });
    
  } catch (error) {
    throw new Error('CallService no disponible: ' + error.message);
  }
}