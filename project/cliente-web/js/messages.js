
// ============================================
// js/messages.js - Mensajería con ICE + Audio
// ============================================

import { iceClient } from './iceClient.js';
import { state } from './state.js';
import { showError } from './ui.js';
import { playVoiceNote } from './audioUI.js';

/**
 * Parsea el historial de texto y detecta notas de voz
 */
function parseHistoryWithAudio(historyText) {
  const lines = historyText.split('\n').filter(line => line.trim());
  const messages = [];
  
  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s*([←→])\s*([^:]+):\s*(.+)$/);
    
    if (match) {
      const [, timestamp, direction, sender, content] = match;
      const audioMatch = content.match(/\[AUDIO_FILE:([^\]]+)\]/);
      
      messages.push({
        timestamp,
        direction,
        sender: sender.trim(),
        content: content.trim(),
        isAudio: !!audioMatch,
        audioFile: audioMatch ? audioMatch[1] : null,
        originalLine: line
      });
    } else {
      messages.push({
        isHeader: true,
        content: line
      });
    }
  }
  
  return messages;
}

/**
 * Renderiza el historial con soporte para notas de voz
 */
function renderHistory(historyText) {
  const messages = parseHistoryWithAudio(historyText);
  const container = document.createElement('div');
  container.className = 'message-history';
  
  messages.forEach(msg => {
    if (msg.isHeader) {
      const header = document.createElement('div');
      header.className = 'history-header';
      header.textContent = msg.content;
      container.appendChild(header);
    } else if (msg.isAudio) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.direction === '→' ? 'sent' : 'received'}`;
      
      messageDiv.innerHTML = `
        <div class="message-info">
          <span class="timestamp">[${msg.timestamp}]</span>
          <span class="sender">${msg.direction} ${msg.sender}</span>
        </div>
        <div class="voice-note-container">
          <button class="voice-note-button" data-audio="${msg.audioFile}">
            <span class="play-icon">▶️</span>
            <span class="voice-label">🎤 Nota de voz</span>
            <span class="duration">${msg.timestamp.split(' ')[1]}</span>
          </button>
        </div>
      `;
      
      const button = messageDiv.querySelector('.voice-note-button');
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.querySelector('.play-icon').textContent = '⏳';
        button.querySelector('.voice-label').textContent = 'Reproduciendo...';
        
        try {
          await playVoiceNote(msg.audioFile);
        } catch (error) {
          console.error('Error reproduciendo:', error);
          alert('No se pudo reproducir la nota de voz');
        } finally {
          button.disabled = false;
          button.querySelector('.play-icon').textContent = '▶️';
          button.querySelector('.voice-label').textContent = '🎤 Nota de voz';
        }
      });
      
      container.appendChild(messageDiv);
    } else {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${msg.direction === '→' ? 'sent' : 'received'}`;
      
      messageDiv.innerHTML = `
        <div class="message-info">
          <span class="timestamp">[${msg.timestamp}]</span>
          <span class="sender">${msg.direction} ${msg.sender}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
      `;
      
      container.appendChild(messageDiv);
    }
  });
  
  return container;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Verifica si el usuario está cerca del fondo del chat
 */
function isNearBottom(container, threshold = 150) {
  if (!container) return false;
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

/**
 * Scrollea al fondo del chat
 */
function scrollToBottom(container, smooth = false) {
  if (!container) return;
  
  // Usar requestAnimationFrame para asegurar que el DOM se ha actualizado
  requestAnimationFrame(() => {
    if (smooth) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  });
}

/**
 * Muestra botón para ir al fondo cuando hay mensajes nuevos
 */
function showScrollToBottomButton(container) {
  let button = document.getElementById('scrollToBottomButton');
  
  if (!button) {
    button = document.createElement('button');
    button.id = 'scrollToBottomButton';
    button.className = 'scroll-to-bottom-btn';
    button.innerHTML = '↓ Nuevos mensajes';
    button.onclick = () => {
      scrollToBottom(container, true);
      button.classList.add('hidden');
    };
    container.parentElement.appendChild(button);
  }
  
  if (!isNearBottom(container)) {
    button.classList.remove('hidden');
  }
}

function hideScrollToBottomButton() {
  const button = document.getElementById('scrollToBottomButton');
  if (button) {
    button.classList.add('hidden');
  }
}

/**
 * Carga el historial del chat con manejo inteligente de scroll
 */
export async function loadHistory(target, isGroup, showLoading = false) {
  const container = document.getElementById('messagesContainer');
  
  if (!container) {
    console.error('❌ Container de mensajes no encontrado');
    return;
  }
  
  if (showLoading) {
    container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Cargando...</p>';
  }

  try {
    let historyText;
    
    if (isGroup) {
      historyText = await iceClient.getGroupHistory(target, state.currentUsername);
    } else {
      historyText = await iceClient.getConversationHistory(state.currentUsername, target);
    }
    
    // Manejar errores
    if (historyText.startsWith('ERROR:')) {
      const errorMsg = historyText.replace('ERROR:', '').trim();
      
      if (errorMsg.toLowerCase().includes('no eres miembro')) {
        container.innerHTML = `
          <div class="welcome-message">
            <h3>🚫 Acceso Denegado</h3>
            <p>No eres miembro de este grupo</p>
          </div>
        `;
        showError('No eres miembro de este grupo');
      } else {
        container.innerHTML = `
          <div class="welcome-message">
            <h3>⚠️ Error</h3>
            <p>${errorMsg}</p>
          </div>
        `;
      }
      return;
    }
    
    // Sin mensajes
    if (historyText.includes('No hay historial')) {
      container.innerHTML = `
        <div class="welcome-message">
          <h3>🔭 Sin mensajes</h3>
          <p>Sé el primero en enviar un mensaje</p>
        </div>
      `;
      return;
    }
    
    // ✅ LÓGICA MEJORADA DE SCROLL
    const wasNearBottom = showLoading || isNearBottom(container);
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;
    
    // Renderizar mensajes
    container.innerHTML = '';
    const historyElement = renderHistory(historyText);
    container.appendChild(historyElement);
    
    // Esperar a que el DOM se actualice completamente
    setTimeout(() => {
      if (showLoading) {
        // Primera carga o cambio de chat: ir al fondo
        scrollToBottom(container, false);
        hideScrollToBottomButton();
      } else if (wasNearBottom) {
        // Usuario estaba en el fondo: mantenerlo ahí
        scrollToBottom(container, true);
        hideScrollToBottomButton();
      } else {
        // Usuario estaba leyendo arriba: mantener posición
        const newScrollHeight = container.scrollHeight;
        const heightDifference = newScrollHeight - previousScrollHeight;
        
        if (heightDifference > 0) {
          container.scrollTop = previousScrollTop + heightDifference;
          showScrollToBottomButton(container);
        }
      }
    }, 100);
    
    // Listener de scroll para ocultar botón al llegar al fondo
    container.onscroll = () => {
      if (isNearBottom(container)) {
        hideScrollToBottomButton();
      }
    };
    
  } catch (err) {
    console.error('❌ Error cargando historial:', err);
    if (showLoading) {
      container.innerHTML = `
        <div class="welcome-message">
          <h3>⚠️ Error de Conexión</h3>
          <p>No se pudo cargar el historial</p>
          <p style="font-size: 0.85em; color: #999;">${err.message}</p>
        </div>
      `;
    }
  }
}

/**
 * Envía un mensaje de texto
 */
export async function sendMessage() {
  const textarea = document.getElementById('messageText');
  const message = textarea.value.trim();
  
  if (!message) return;
  
  if (!state.currentChat) {
    showError('Selecciona un chat primero');
    return;
  }

  const btn = document.querySelector('#sendMessageButton');
  const originalText = btn.textContent;
  btn.textContent = 'Enviando...';
  btn.disabled = true;

  try {
    let result;
    
    if (state.isGroup) {
      result = await iceClient.sendGroupMessage(
        state.currentUsername, 
        state.currentChat, 
        message
      );
    } else {
      result = await iceClient.sendPrivateMessage(
        state.currentUsername, 
        state.currentChat, 
        message
      );
    }
    
    if (result.startsWith('SUCCESS')) {
      // Limpiar input
      textarea.value = '';
      
      // Ajustar altura del textarea
      textarea.style.height = 'auto';
      
      // Recargar historial
      await loadHistory(state.currentChat, state.isGroup, false);
      
      // Enfocar input
      textarea.focus();
    } else {
      showError(result.replace('ERROR:', '').trim());
    }
    
  } catch (err) {
    console.error('❌ Error enviando mensaje:', err);
    showError('Error de conexión al enviar mensaje');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}