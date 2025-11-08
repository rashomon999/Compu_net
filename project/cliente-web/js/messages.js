import { API_URL } from './config.js';
import { state } from './state.js';
import { showError } from './ui.js';

export async function loadHistory(target, isGrupo, showLoading = false) {
  const container = document.getElementById('messagesContainer');
  
  if (showLoading) {
    container.innerHTML = '<p style="text-align: center; color: #999;">Cargando...</p>';
  }

  try {
    const url = isGrupo 
      ? `${API_URL}/historial-grupo/${target}?username=${state.currentUsername}`
      : `${API_URL}/historial/${target}?from=${state.currentUsername}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.success && data.historial) {
      if (data.historial.includes('No hay historial')) {
        container.innerHTML = `
          <div class="welcome-message">
            <h3>📭 Sin mensajes</h3>
            <p>Sé el primero en enviar un mensaje</p>
          </div>
        `;
      } else {
        const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
        
        container.innerHTML = `
          <div class="message-history">
            <pre>${data.historial}</pre>
          </div>
        `;
        
        if (wasAtBottom || showLoading) {
          setTimeout(() => container.scrollTop = container.scrollHeight, 10);
        }
      }
    } else {
      container.innerHTML = '<p style="text-align: center; color: #999;">No hay mensajes</p>';
    }
  } catch (err) {
    console.error('Error cargando historial:', err);
    if (showLoading) {
      container.innerHTML = '<p style="text-align: center; color: red;">Error</p>';
    }
  }
}

export async function sendMessage() {
  const message = document.getElementById('messageText').value.trim();
  
  if (!message) return;
  
  if (!state.currentChat) {
    showError('Selecciona un chat primero');
    return;
  }

  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  try {
    const url = state.isGroup ? `${API_URL}/enviar-grupo` : `${API_URL}/enviar`;
    const body = state.isGroup 
      ? { from: state.currentUsername, grupo: state.currentChat, message }
      : { from: state.currentUsername, to: state.currentChat, message };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    
    if (data.success) {
      document.getElementById('messageText').value = '';
      await loadHistory(state.currentChat, state.isGroup, false);
    } else {
      showError(data.error || 'Error al enviar');
    }
  } catch (err) {
    console.error('Error enviando:', err);
    showError('Error de conexión');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    document.getElementById('messageText').focus();
  }
}