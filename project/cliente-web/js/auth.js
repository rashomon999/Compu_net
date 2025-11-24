// ============================================
// js/auth.js - AutenticaciÃ³n con ICE
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChatsFromICE } from './chats.js';
import { loadGroupsFromICE } from './groups.js';
import { subscribeToRealTimeNotifications } from './notifications.js';

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
    
    // PASO 4: Mostrar interfaz
    showChatInterface();
    
    // PASO 5: Cargar datos iniciales
    await loadRecentChatsFromICE();
    await loadGroupsFromICE();
    
    console.log('âœ… Login exitoso con ICE:', username);
    
  } catch (err) {
    console.error('âŒ Error en login:', err);
    showError('No se pudo conectar al servidor ICE. Â¿EstÃ¡ corriendo en puerto 10000?');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

export async function logout() {
  try {
    await iceClient.disconnect();
    console.log('ðŸ‘‹ Logout exitoso');
  } catch (err) {
    console.error('Error en logout:', err);
  }
}