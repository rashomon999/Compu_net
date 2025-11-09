// ============================================
// js/ui.js - Funciones de interfaz
// ============================================
import { state } from './state.js';

export function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = '⚠️ ' + message;
  
  const container = document.querySelector('.login-container .section') || 
                   document.querySelector('.chat-container');
  
  const oldError = container.querySelector('.error-message');
  if (oldError) oldError.remove();
  
  container.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

export function updateChatHeader(title, subtitle) {
  const header = document.getElementById('chatHeader');
  header.innerHTML = `
    <div class="chat-info">
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
  `;
}

export function showMessageInput() {
  document.getElementById('messageInputContainer').classList.remove('hidden');
}

export function hideMessageInput() {
  document.getElementById('messageInputContainer').classList.add('hidden');
}

export function showChatInterface() {
  document.getElementById('currentUsername').textContent = state.currentUsername;
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('chatContainer').classList.remove('hidden');
}

export function showLoginInterface() {
  document.getElementById('loginContainer').classList.remove('hidden');
  document.getElementById('chatContainer').classList.add('hidden');
}

export function resetMainContent() {
  updateChatHeader('Bienvenido 👋', 'Selecciona un chat o crea uno nuevo');
  hideMessageInput();
  document.getElementById('messagesContainer').innerHTML = `
    <div class="welcome-message">
      <h3>🎉 Comienza a chatear</h3>
      <p>Selecciona una conversación del sidebar o inicia una nueva</p>
      <ul>
        <li>Abre un chat con otro usuario</li>
        <li>Crea o únete a grupos</li>
        <li>Envía mensajes y consulta el historial</li>
      </ul>
    </div>
  `;
}
