// ============================================
// js/auth.js - Autenticación con Suscripción a Llamadas
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';
import { subscribeToRealTimeNotifications } from './notifications.js';

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
    
    // ✅ Suscribirse a notificaciones push
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Configurando notificaciones...';
    }
    await subscribeToRealTimeNotifications(username);
    
    // ⚡ Suscribirse a eventos de llamadas
    try {
      await subscribeToCallEvents(username);
      console.log('✅ Eventos de llamadas habilitados');
      state.callsAvailable = true;
    } catch (err) {
      console.warn('⚠️ CallService no disponible:', err.message);
      state.callsAvailable = false;
    }
    
    // Mostrar interfaz
    if (statusEl) {
      statusEl.querySelector('.status-text').textContent = 'Cargando datos...';
    }
    showChatInterface();
    
    // Cargar chats y grupos
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
    // Limpiar cualquier llamada activa
    const { audioPlayer } = await import('./Player.js');
    if (audioPlayer && audioPlayer.currentTarget) {
      await audioPlayer.cleanup();
    }
    
    await iceClient.disconnect();
    console.log('👋 Logout exitoso');
  } catch (err) {
    console.error('Error en logout:', err);
  }
}

// ========================================
// ⚡ SUSCRIPCIÓN A EVENTOS DE LLAMADAS
// ========================================

async function subscribeToCallEvents(username) {
  try {
    await iceClient.subscribeToCallEvents(username);
    
    // Inicializar Player
    const { audioPlayer } = await import('./Player.js');
    audioPlayer.init();
    
    console.log('✅ Sistema de llamadas inicializado');
    
  } catch (error) {
    throw new Error('CallService no disponible: ' + error.message);
  }
}