// ============================================
// js/auth.js - Autenticación CORREGIDA
// ============================================

import { API_URL } from './config.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChatsFromServer } from './chats.js';
import { loadGroups } from './groups.js';

export async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  
  if (!username) {
    showError('Por favor ingresa un nombre de usuario');
    return;
  }

  // 🔧 Buscar el botón directamente en el DOM
  const btn = document.querySelector('.login-container button');
  const originalText = btn.textContent;
  btn.textContent = 'Conectando...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    const data = await res.json();

    if (data.success) {
      state.currentUsername = username;
      showChatInterface();
      
      // 🆕 PASO 1: Inicializar notificaciones en el servidor
      await initializeNotifications(username);
      
      // PASO 2: Cargar conversaciones desde el servidor
      await loadRecentChatsFromServer();
      
      // PASO 3: Cargar grupos
      loadGroups();
      
      console.log('✓ Login exitoso:', username);
    } else {
      showError(data.error || 'Error al conectar');
    }
  } catch (err) {
    console.error('Error en login:', err);
    showError('No se pudo conectar al servidor');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// 🆕 Nueva función para inicializar el timestamp de notificaciones
async function initializeNotifications(username) {
  try {
    const res = await fetch(`${API_URL}/notificaciones/inicializar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    const data = await res.json();
    
    if (data.success) {
      console.log('✓ Notificaciones inicializadas para', username);
    }
  } catch (err) {
    console.error('⚠️ Error inicializando notificaciones:', err);
    // No bloquear el login por esto
  }
}