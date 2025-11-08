import { API_URL } from './config.js';
import { state } from './state.js';
import { showError, showChatInterface } from './ui.js';
import { loadRecentChats } from './chats.js';
import { loadGroups } from './groups.js';

export async function login() {
  const username = document.getElementById('usernameInput').value.trim();
  
  if (!username) {
    showError('Por favor ingresa un nombre de usuario');
    return;
  }

  const btn = event.target;
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
      loadRecentChats();
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

