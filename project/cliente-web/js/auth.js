// ============================================
// js/auth.js - Autenticación con AudioSubject CORREGIDA
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';
import { subscribeToRealTimeNotifications } from './notifications.js';
import { simpleCallManager } from './simpleCallManager.js';
import { simpleAudioStream } from './simpleAudioStream.js';

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
    
    // PASO 1: Conectar servicios básicos (Chat, Groups, etc.)
    await iceClient.connect(username, serverHost, serverPort);
    state.currentUsername = username;
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando notificaciones...';
    }
    
    // PASO 2: Suscribirse a notificaciones
    await subscribeToRealTimeNotifications(username);
    
    // ========================================
    // PASO 3: CONECTAR AUDIOSUBJECT (LLAMADAS)
    // ========================================
    try {
      console.log('📞 Conectando a AudioSubject...');
      
      if (statusEl) {
        statusEl.querySelector('.status-text').textContent = 'Configurando llamadas...';
      }
      
      // ✅ CALLBACKS SIGUIENDO EL ENFOQUE DEL PROFESOR
      const audioSubject = await iceClient.connectToAudioSubject(
        serverHost,
        serverPort,
        username,
        {
          // ✅ CALLBACK 1: Recibir audio en tiempo real
          receiveAudio: (audioData) => {
            console.log('[AUTH CALLBACK] receiveAudio:', audioData.length, 'bytes');
            // ✅ CRÍTICO: Llamar al método correcto
            simpleAudioStream.receiveAudioChunk(audioData);
          },
          
          // ✅ CALLBACK 2: Llamada entrante
          incomingCall: async (fromUser) => {
            console.log('📞 [AUTH] Llamada entrante de:', fromUser);
            
            try {
              // Crear oferта de llamada compatible
              const offer = {
                caller: fromUser,
                callType: 'AudioOnly'
              };
              
              const { showIncomingCallUI } = await import('./callUI.js');
              showIncomingCallUI(offer);
              
            } catch (error) {
              console.error('❌ Error mostrando llamada entrante:', error);
            }
          },
          
          // ✅ CALLBACK 3: Llamada aceptada
          callAccepted: async (fromUser) => {
            console.log('✅ [AUTH] Llamada aceptada por:', fromUser);
            
            try {
              await simpleCallManager.handleCallAccepted(fromUser);
              
              const { showActiveCallUI } = await import('./callUI.js');
              showActiveCallUI(fromUser);
              
            } catch (error) {
              console.error('❌ Error en callAccepted:', error);
            }
          },
          
          // ✅ CALLBACK 4: Llamada rechazada
          callRejected: async (fromUser) => {
            console.log('❌ [AUTH] Llamada rechazada por:', fromUser);
            
            try {
              const { hideCallUI } = await import('./callUI.js');
              hideCallUI();
              
              showError(`${fromUser} rechazó la llamada`);
              simpleCallManager.cleanup();
              
            } catch (error) {
              console.error('❌ Error en callRejected:', error);
            }
          },
          
          // ✅ CALLBACK 5: Llamada finalizada
          callEnded: async (fromUser) => {
            console.log('📞 [AUTH] Llamada finalizada por:', fromUser);
            
            try {
              // Limpiar audio
              simpleAudioStream.cleanup();
              simpleCallManager.cleanup();
              
              const { hideCallUI } = await import('./callUI.js');
              hideCallUI();
              
              showError(`${fromUser} finalizó la llamada`);
              
            } catch (error) {
              console.error('❌ Error en callEnded:', error);
            }
          }
        }
      );
      
      // Configurar managers con el AudioSubject
      simpleCallManager.setAudioSubject(audioSubject, username);
      simpleAudioStream.setAudioSubject(audioSubject, username);
      
      console.log('✅ Sistema de llamadas ACTIVO');
      state.callsAvailable = true;
      
    } catch (err) {
      console.warn('⚠️ AudioService no disponible:', err.message);
      state.callsAvailable = false;
    }
    
    // ========================================
    // PASO 4: FINALIZAR LOGIN
    // ========================================
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
    // Limpiar llamada activa si existe
    if (simpleCallManager.isCallActive()) {
      await simpleCallManager.endCall();
    }
    
    // Desconectar AudioSubject
    await iceClient.disconnectFromAudioSubject(state.currentUsername);
    
    // Desconectar Ice
    await iceClient.disconnect();
    
    console.log('👋 Logout exitoso');
    
  } catch (err) {
    console.error('Error en logout:', err);
  }
}