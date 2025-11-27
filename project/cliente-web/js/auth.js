// ============================================
// js/auth.js - NOTIFICACIONES PRIORITARIAS
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
    await iceClient.connect(username, serverHost, serverPort);
    
    state.currentUsername = username;
    console.log('✅ Conectado a ICE');
    
    // ========================================
    // 🔥 PASO 1: NOTIFICACIONES - PRIMERO Y OBLIGATORIO
    // ========================================
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Suscribiendo a notificaciones...';
    }
    
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  PASO 1: SUSCRIPCIÓN A NOTIFICACIONES    ║');
    console.log('╚═══════════════════════════════════════════╝');
    
    let notificationsOk = false;
    try {
      console.log('📡 Iniciando subscribeToRealTimeNotifications()...');
      await subscribeToRealTimeNotifications(username);
      console.log('✅ subscribeToRealTimeNotifications() COMPLETADO');
      notificationsOk = true;
      
      // Pequeña pausa para asegurar que llegó al servidor
      await new Promise(r => setTimeout(r, 300));
      console.log('✅ Pausa completada, usuario debería estar suscrito');
      
    } catch (err) {
      console.error('❌ ERROR en subscribeToRealTimeNotifications:', err);
      console.error('   Stack:', err.stack);
      
      // ⚠️ NO FALLAR COMPLETAMENTE, solo advertencia
      showError('Advertencia: Error en notificaciones: ' + err.message);
      notificationsOk = false;
    }
    
    console.log('');
    
    // ========================================
    // PASO 2: CARGAR DATOS (chats, grupos)
    // ========================================
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Cargando chats y grupos...';
    }
    
    console.log('📋 Cargando chats y grupos...');
    await loadRecentChatsFromICE();
    await loadGroupsFromICE();
    console.log('✅ Chats y grupos cargados');
    
    // ========================================
    // PASO 3: LLAMADAS (OPCIONAL - si falla, no bloquea)
    // ========================================
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando llamadas...';
    }
    
    console.log('\n📞 Configurando sistema de llamadas...');
    
    const audioCallbacks = {
      receiveAudio: (audioData) => {
        console.log('🔊 [AUTH] Audio recibido:', audioData.length, 'bytes');
        simpleAudioStream.receiveAudio(audioData);
      },
      incomingCall: async (fromUser) => {
        console.log('📞 [AUTH] ¡LLAMADA ENTRANTE!', fromUser);
        
        try {
          await simpleCallManager.receiveIncomingCall(fromUser);
          
          const { showIncomingCallUI } = await import('./callUI.js');
          showIncomingCallUI({ caller: fromUser });
          
        } catch (error) {
          console.error('❌ Error procesando llamada:', error);
        }
      },
      
      callAccepted: async (fromUser) => {
        console.log('✅ [AUTH] Llamada ACEPTADA por:', fromUser);
        
        try {
          await simpleCallManager.handleCallAccepted(fromUser);
          
          const { showActiveCallUI } = await import('./callUI.js');
          showActiveCallUI(fromUser);
          
        } catch (error) {
          console.error('❌ Error:', error);
          const { hideCallUI } = await import('./callUI.js');
          hideCallUI();
          showError('Error al aceptar llamada');
        }
      },
      
      callRejected: async (fromUser) => {
        console.log('❌ [AUTH] Llamada RECHAZADA por:', fromUser);
        
        const { hideCallUI } = await import('./callUI.js');
        hideCallUI();
        showError(`${fromUser} rechazó la llamada`);
        simpleCallManager.cleanup();
      },
      
      callEnded: async (fromUser) => {
        console.log('🔴 [AUTH] Llamada FINALIZADA por:', fromUser);
        
        try {
          simpleAudioStream.cleanup();
          simpleCallManager.cleanup();
          
          const { hideCallUI } = await import('./callUI.js');
          hideCallUI();
          
          showError(`${fromUser} finalizó la llamada`);
          
        } catch (error) {
          console.error('Error limpiando:', error);
        }
      }
    };
    
    let callsOk = false;
    try {
      await iceClient.connectToAudioSubject(
        serverHost,
        serverPort,
        username,
        audioCallbacks
      );
      
      const audioSubject = iceClient.audioSubject;
      simpleCallManager.setAudioSubject(audioSubject, username);
      simpleAudioStream.setAudioSubject(audioSubject, username);
      
      console.log('✅ Sistema de llamadas configurado');
      state.callsAvailable = true;
      callsOk = true;
      
      state.audioSubject = audioSubject;
      state.audioAdapter = iceClient.audioAdapter;
      
    } catch (err) {
      console.warn('⚠️ AudioService no disponible:', err.message);
      state.callsAvailable = false;
      callsOk = false;
    }
    
    // ========================================
    // FINALIZAR: MOSTRAR UI
    // ========================================
    
    showChatInterface();
    
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  ✅ LOGIN COMPLETADO                    ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log('║  Usuario: ' + username.padEnd(32) + '║');
    console.log('║  Notificaciones: ' + (notificationsOk ? '✅ ACTIVAS' : '❌ ERROR').padEnd(30) + '║');
    console.log('║  Llamadas: ' + (callsOk ? '✅ ACTIVAS' : '❌ NO DISPONIBLES').padEnd(30) + '║');
    console.log('╚═══════════════════════════════════════════╝\n');
    
  } catch (err) {
    console.error('❌ Error crítico en login:', err);
    
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
    if (simpleCallManager.isCallActive()) {
      await simpleCallManager.endCall();
    }
    
    if (state.audioSubject && state.currentUsername) {
      try {
        await state.audioSubject.detach(state.currentUsername);
        console.log('👋 Desconectado de AudioSubject');
      } catch (err) {
        console.warn('⚠️ Error desconectando AudioSubject:', err);
      }
    }
    
    if (state.audioAdapter) {
      try {
        await state.audioAdapter.destroy();
      } catch (err) {
        console.warn('⚠️ Error destruyendo adaptador:', err);
      }
    }
    
    state.audioSubject = null;
    state.audioAdapter = null;
    
    await iceClient.disconnect();
    
    console.log('👋 Logout exitoso');
    
  } catch (err) {
    console.error('Error en logout:', err);
  }
}