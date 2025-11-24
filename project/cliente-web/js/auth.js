// ============================================
// js/auth.js - Autenticación con CallManager
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
  
  if (!username) {
    showError('Por favor ingresa un nombre de usuario');
    return;
  }

  const btn = document.querySelector('.login-container button');
  const originalText = btn.textContent;
  btn.textContent = 'Conectando a ICE...';
  btn.disabled = true;

  try {
    // PASO 1: Conectar al servidor ICE
    await iceClient.connect(username);
    
    // PASO 2: Guardar estado
    state.currentUsername = username;
    
    // PASO 3: Suscribirse a notificaciones en tiempo real
    await subscribeToRealTimeNotifications(username);
    
    // PASO 4: Intentar suscribirse a eventos de llamadas
    try {
      await subscribeToCallEvents(username);
      console.log('✅ Eventos de llamadas habilitados');
      state.callsAvailable = true;
    } catch (err) {
      console.warn('⚠️ CallService no disponible:', err.message);
      state.callsAvailable = false;
    }
    
    // PASO 5: Mostrar interfaz
    showChatInterface();
    
    // PASO 6: Cargar datos iniciales
    await loadRecentChatsFromICE();
    await loadGroupsFromICE();
    
    console.log('✅ Login exitoso:', username);
    
  } catch (err) {
    console.error('❌ Error en login:', err);
    showError('No se pudo conectar al servidor ICE. ¿Está corriendo en puerto 10000?');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

export async function logout() {
  try {
    // Limpiar cualquier llamada activa
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
        console.log('📞 Llamada entrante de', offer.caller);
        
        const { showIncomingCallUI } = await import('./callUI.js');
        await showIncomingCallUI(offer);
      },
      
      // Respuesta a llamada
      onCallAnswer: async (answer) => {
        console.log('📞 Respuesta de llamada:', answer.status);
        
        const { webrtcManager } = await import('./webrtcManager.js');
        const { showActiveCallUI } = await import('./callUI.js');
        
        await webrtcManager.handleCallAnswer(answer);
        
        if (answer.status === 'ACCEPTED') {
          // El callManager ya gestiona los timers
          callManager.activeCall.status = 'CONNECTED';
          callManager.activeCall.answerTime = Date.now();
          callManager.startDurationTimer();
          
          showActiveCallUI(state.currentChat);
        }
      },
      
      // ICE Candidate
      onRtcCandidate: async (candidate) => {
        console.log('🧊 RTC candidate recibido');
        
        const { webrtcManager } = await import('./webrtcManager.js');
        await webrtcManager.handleIceCandidate(candidate);
      },
      
      // Llamada finalizada
      onCallEnded: async (callId, reason) => {
        console.log('📞 Llamada finalizada:', reason);
        
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