// ============================================
// js/auth.js - CORREGIDO: Conectar AudioSubject
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError } from './ui.js';
import { loadRecentChats } from './chats.js';
import { loadGroupsFromICE } from './groups.js';
import { simpleCallManager } from './simpleCallManager.js';
import { simpleAudioStream } from './simpleAudioStream.js';

// ========================================
// LOGIN
// ========================================
export async function login() {
  try {
    const usernameInput = document.getElementById('usernameInput');
    const serverHostInput = document.getElementById('serverHost');
    const serverPortInput = document.getElementById('serverPort');
    
    const username = usernameInput?.value?.trim();
    const serverHost = serverHostInput?.value?.trim() || 'localhost';
    const serverPort = parseInt(serverPortInput?.value) || 10000;
    
    if (!username) {
      showError('⚠️ Ingresa tu nombre de usuario');
      return;
    }
    
    console.log('🔐 Intentando login:', username);
    
    // PASO 1: Conectar servicios principales (Chat, Groups, etc)
    await iceClient.connect(username, serverHost, serverPort);
    console.log('✅ Servicios principales conectados');
    
    // PASO 2: Suscribirse a notificaciones
    try {
      await iceClient.subscribeToNotifications(username, {
        onNewMessage: handleNewMessage,
        onGroupCreated: handleGroupCreated,
        onUserJoinedGroup: handleUserJoinedGroup
      });
      console.log('✅ Notificaciones activas');
    } catch (error) {
      console.warn('⚠️ Notificaciones no disponibles');
    }
    
    // ========================================
    // PASO 3: CONECTAR AUDIOSUBJECT (CRÍTICO)
    // ========================================
    try {
      console.log('🎧 Conectando sistema de llamadas...');
      
      // Callbacks del Observer de audio
      const audioCallbacks = {
        // ✅ RECIBE AUDIO (crítico)
        receiveAudio: (audioData) => {
          console.log('🎵 [AUTH] Audio recibido:', audioData.length, 'bytes');
          // Enviar al reproductor
          simpleAudioStream.receiveAudioChunk(audioData);
        },
        
        // Llamada entrante
        incomingCall: (fromUser) => {
          console.log('📞 [AUTH] Llamada entrante de:', fromUser);
          handleIncomingCall(fromUser);
        },
        
        // Llamada aceptada
        callAccepted: (fromUser) => {
          console.log('✅ [AUTH] Llamada aceptada por:', fromUser);
          handleCallAccepted(fromUser);
        },
        
        // Llamada rechazada
        callRejected: (fromUser) => {
          console.log('❌ [AUTH] Llamada rechazada por:', fromUser);
          handleCallRejected(fromUser);
        },
        
        // Llamada finalizada
        callEnded: (fromUser) => {
          console.log('📞 [AUTH] Llamada finalizada por:', fromUser);
          handleCallEnded(fromUser);
        }
      };
      
      // ✅ CONECTAR AL AUDIOSUBJECT
      const audioSubject = await iceClient.connectToAudioSubject(
        serverHost,
        serverPort,
        username,
        audioCallbacks
      );
      
      console.log('✅ AudioSubject conectado');
      
      // Configurar managers
      simpleCallManager.setAudioSubject(audioSubject, username);
      simpleAudioStream.setAudioSubject(audioSubject, username);
      
      state.callsAvailable = true;
      console.log('✅ Sistema de llamadas ACTIVO');
      
    } catch (error) {
      console.error('❌ Error conectando AudioSubject:', error);
      console.warn('⚠️ Llamadas de audio NO disponibles');
      state.callsAvailable = false;
    }
    
    // PASO 4: Actualizar estado
    state.username = username;
    
    // PASO 5: Cargar datos
    try {
      await loadRecentChats();
      await loadGroupsFromICE();
    } catch (error) {
      console.warn('⚠️ Error cargando datos iniciales:', error);
    }
    
    // PASO 6: Actualizar UI
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    document.getElementById('currentUsername').textContent = username;
    
    console.log('✅ Login exitoso:', username);
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    showError(`Error: ${error.message}`);
  }
}

// ========================================
// LOGOUT
// ========================================
export async function logout() {
  try {
    console.log('👋 Cerrando sesión...');
    
    // Limpiar managers
    simpleCallManager.cleanup();
    simpleAudioStream.cleanup();
    
    // Desconectar de Ice
    await iceClient.disconnect();
    
    // Limpiar estado
    state.username = null;
    state.currentChat = null;
    state.isGroup = false;
    
    // Actualizar UI
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    
    console.log('✅ Sesión cerrada');
    
  } catch (error) {
    console.error('❌ Error en logout:', error);
  }
}

// ========================================
// HANDLERS DE NOTIFICACIONES
// ========================================
function handleNewMessage(message) {
  console.log('📬 Nuevo mensaje:', message);
  
  // Si es para el chat actual, refrescar
  if (state.currentChat) {
    const isChatMessage = 
      (message.recipient === state.currentChat && message.sender === state.username) ||
      (message.sender === state.currentChat && message.recipient === state.username) ||
      (message.isGroup && message.recipient === state.currentChat);
    
    if (isChatMessage) {
      import('./messages.js').then(({ loadMessages }) => loadMessages());
    }
  }
  
  // Actualizar lista de conversaciones
  loadRecentChats();
}

function handleGroupCreated(groupName, creator) {
  console.log('📢 Grupo creado:', groupName, 'por', creator);
  loadGroupsFromICE();
}

function handleUserJoinedGroup(groupName, user) {
  console.log('👥 Usuario se unió a grupo:', user, '→', groupName);
}

// ========================================
// HANDLERS DE LLAMADAS
// ========================================
function handleIncomingCall(fromUser) {
  console.log('📞 [AUTH] Llamada entrante de:', fromUser);
  
  // Mostrar UI de llamada entrante
  import('./callUI.js').then(({ showIncomingCall }) => {
    showIncomingCall(fromUser);
  });
  
  // Recibir llamada en el manager
  simpleCallManager.receiveIncomingCall(fromUser);
}

function handleCallAccepted(fromUser) {
  console.log('✅ [AUTH] Llamada aceptada por:', fromUser);
  
  // Procesar aceptación en el manager
  simpleCallManager.handleCallAccepted(fromUser);
  
  // Actualizar UI
  import('./callUI.js').then(({ showActiveCall }) => {
    showActiveCall(fromUser);
  });
}

function handleCallRejected(fromUser) {
  console.log('❌ [AUTH] Llamada rechazada por:', fromUser);
  
  // Limpiar estado
  simpleCallManager.cleanup();
  simpleAudioStream.cleanup();
  
  // Limpiar UI
  import('./callUI.js').then(({ cleanupCallUI }) => {
    cleanupCallUI();
  });
  
  showError(`${fromUser} rechazó la llamada`);
}

function handleCallEnded(fromUser) {
  console.log('📞 [AUTH] Llamada finalizada por:', fromUser);
  
  // Limpiar managers
  simpleCallManager.cleanup();
  simpleAudioStream.cleanup();
  
  // Limpiar UI
  import('./callUI.js').then(({ cleanupCallUI }) => {
    cleanupCallUI();
  });
}