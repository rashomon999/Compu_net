// ============================================
// js/auth.js - Autenticación con AudioSubject CORREGIDO
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
    
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando notificaciones...';
    }
    
    // Suscribirse a notificaciones
    await subscribeToRealTimeNotifications(username);
    
    // ========================================
    // 🔥 CONECTAR AL AUDIOSUBJECT (LLAMADAS) - VERSIÓN CORREGIDA
    // ========================================
    try {
      console.log('📞 Configurando sistema de llamadas...');
      
      if (statusEl) {
        statusEl.querySelector('.status-text').textContent = 'Configurando llamadas...';
      }
      
      // ✅ Callbacks para eventos de llamadas
      const audioCallbacks = {
        // Recibir audio en tiempo real
        receiveAudio: (audioData) => {
    console.log('🔊 [AUTH] Audio recibido:', audioData.length, 'bytes');
    simpleAudioStream.receiveAudio(audioData);  // ✅ CORRECTO
  },
        // Llamada entrante
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
        
        // Llamada aceptada
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
        
        // Llamada rechazada
        callRejected: async (fromUser) => {
          console.log('❌ [AUTH] Llamada RECHAZADA por:', fromUser);
          
          const { hideCallUI } = await import('./callUI.js');
          hideCallUI();
          showError(`${fromUser} rechazó la llamada`);
          simpleCallManager.cleanup();
        },
        
        // Llamada finalizada
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
      
      // ⬅️ AQUÍ: REEMPLAZAR TODO EL BLOQUE DESDE "PASO 1" HASTA "PASO 8"
      // BORRAR DESDE LA LÍNEA QUE DICE "// PASO 1: Verificar que AudioSystem..."
      // HASTA LA LÍNEA QUE DICE "console.log('   ✅ Registrado en servidor');"
      // Y REEMPLAZAR CON ESTO:
      
      // ✅ CONECTAR con el método corregido de iceClient
      // En auth.js, línea ~140:
await iceClient.connectToAudioSubject(
  serverHost,
  serverPort,
  username,
  audioCallbacks
);
      
      // ✅ Configurar managers con el AudioSubject
      const audioSubject = iceClient.audioSubject;  // ⬅️ Obtener desde iceClient
      simpleCallManager.setAudioSubject(audioSubject, username);
      simpleAudioStream.setAudioSubject(audioSubject, username);
      
      console.log('✅ Sistema de llamadas ACTIVO');
      state.callsAvailable = true;
      
      // Guardar para cleanup
      state.audioSubject = audioSubject;
      state.audioAdapter = iceClient.audioAdapter;  // ⬅️ Obtener desde iceClient
      
    } catch (err) {
      console.warn('⚠️ AudioService no disponible:', err.message);
      console.warn('   Las llamadas no estarán disponibles');
      state.callsAvailable = false;
    }
    
    // ========================================
    // FINALIZAR LOGIN
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
    
    // Desconectar del AudioSubject
    if (state.audioSubject && state.currentUsername) {
      try {
        await state.audioSubject.detach(state.currentUsername);
        console.log('👋 Desconectado de AudioSubject');
      } catch (err) {
        console.warn('⚠️ Error desconectando AudioSubject:', err);
      }
    }
    
    // Destruir adaptador
    if (state.audioAdapter) {
      try {
        await state.audioAdapter.destroy();
      } catch (err) {
        console.warn('⚠️ Error destruyendo adaptador:', err);
      }
    }
    
    // Limpiar estado
    state.audioSubject = null;
    state.audioAdapter = null;
    
    // Desconectar Ice
    await iceClient.disconnect();
    
    console.log('👋 Logout exitoso');
    
  } catch (err) {
    console.error('Error en logout:', err);
  }
}