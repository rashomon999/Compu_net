// ============================================
// js/auth.js - Autenticación con AudioSubject
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
    // 🆕 CONECTAR AL AUDIOSUBJECT (LLAMADAS)
    // ========================================
    try {
      console.log('📞 Conectando a AudioSubject...');
      
      if (statusEl) {
        statusEl.querySelector('.status-text').textContent = 'Configurando llamadas...';
      }
      
      const Ice = window.Ice;
      
      // PASO 1: Verificar que AudioSystem esté disponible
      if (!Ice.AudioSystem) {
        throw new Error('AudioSystem.js no está cargado');
      }
      
      // PASO 2: Conectar al AudioSubject (servidor)
      const audioProxy = iceClient.communicator.stringToProxy(
        `AudioService:ws -h ${serverHost} -p ${serverPort}`
      );
      
      const audioSubject = await Ice.AudioSystem.AudioSubjectPrx.checkedCast(audioProxy);
      
      if (!audioSubject) {
        throw new Error('No se pudo conectar a AudioService');
      }
      
      console.log('   ✅ AudioSubject conectado');
      
      // PASO 3: Crear adaptador para recibir callbacks
      const audioAdapter = await iceClient.communicator.createObjectAdapter("");
      
      console.log('   ✅ Adaptador creado');
      
      // PASO 4: Crear el Observer (callbacks del cliente)
      const observerObj = {
        // Recibir audio en tiempo real
        receiveAudio: (data) => {
          // Convertir a Uint8Array
          const audioData = data instanceof Uint8Array 
            ? data 
            : new Uint8Array(data);
          
          // Enviar al stream manager para reproducir
          simpleAudioStream.receiveAudioChunk(audioData);
        },
        
        // Llamada entrante
        incomingCall: async (fromUser) => {
          console.log('📞 [AUTH] ¡LLAMADA ENTRANTE de:', fromUser);
          
          try {
            // Crear registro de llamada
            await simpleCallManager.receiveIncomingCall(fromUser);
            
            // Mostrar UI
            const { showIncomingCallUI } = await import('./callUI.js');
            showIncomingCallUI({ caller: fromUser });
            
          } catch (error) {
            console.error('❌ Error procesando llamada entrante:', error);
          }
        },
        
        // Llamada aceptada
        callAccepted: async (fromUser) => {
          console.log('✅ [AUTH] Llamada ACEPTADA por:', fromUser);
          
          try {
            // Procesar aceptación
            await simpleCallManager.handleCallAccepted(fromUser);
            
            // Mostrar UI de llamada activa
            const { showActiveCallUI } = await import('./callUI.js');
            showActiveCallUI(fromUser);
            
          } catch (error) {
            console.error('❌ Error procesando aceptación:', error);
            const { hideCallUI } = await import('./callUI.js');
            hideCallUI();
            showError('Error al aceptar la llamada');
          }
        },
        
        // Llamada rechazada
        callRejected: async (fromUser) => {
          console.log('❌ [AUTH] Llamada RECHAZADA por:', fromUser);
          
          const { hideCallUI } = await import('./callUI.js');
          hideCallUI();
          showError(`${fromUser} rechazó la llamada`);
          
          // Limpiar estado
          simpleCallManager.cleanup();
        },
        
        // Llamada finalizada
        callEnded: async (fromUser) => {
          console.log('📞 [AUTH] Llamada FINALIZADA por:', fromUser);
          
          try {
            // Limpiar audio
            simpleAudioStream.cleanup();
            
            // Limpiar estado de llamada
            simpleCallManager.cleanup();
            
            // Ocultar UI
            const { hideCallUI } = await import('./callUI.js');
            hideCallUI();
            
            showError(`${fromUser} finalizó la llamada`);
            
          } catch (error) {
            console.error('Error limpiando llamada:', error);
          }
        }
      };
      
      console.log('   ✅ Observer creado');
      
      // PASO 5: Crear proxy del Observer
      const observerProxy = audioAdapter.add(
        new Ice.AudioSystem.AudioObserver(observerObj),
        new Ice.Identity(Ice.generateUUID(), "")
      );
      
      console.log('   ✅ Proxy creado');
      
      // PASO 6: Activar adaptador
      await audioAdapter.activate();
      
      console.log('   ✅ Adaptador activado');
      
      // PASO 7: Registrarse en el servidor
      await audioSubject.attach(username, observerProxy);
      
      console.log('   ✅ Registrado en servidor');
      
      // PASO 8: Configurar managers con el AudioSubject
      simpleCallManager.setAudioSubject(audioSubject, username);
      simpleAudioStream.setAudioSubject(audioSubject, username);
      
      console.log('✅ Sistema de llamadas ACTIVO');
      state.callsAvailable = true;
      
      // Guardar para cleanup
      state.audioSubject = audioSubject;
      state.audioAdapter = audioAdapter;
      
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