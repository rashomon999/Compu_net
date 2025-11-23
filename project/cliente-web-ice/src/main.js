import IceChatClient from "./ice-client.js"
import AudioRecorder from "./audio-recorder.js"
import AudioPlayer from "./audio-player.js"

// Global state
const state = {
  client: null,
  audioRecorder: null,
  audioPlayer: null,
  username: null,
  currentChat: null,
  isGroup: false,
  isRecording: false,
}

// Initialize Ice client
async function initializeClient() {
  try {
    state.client = new IceChatClient()
    await state.client.connect("localhost", 9099)

    // Set up message callback
    state.client.onMessage((sender, message, isGroup) => {
      displayReceivedMessage(sender, message, isGroup)
    })

    // Set up voice message callback
    state.client.onVoiceMessage(async (sender, audioData, isGroup) => {
      displayReceivedVoiceMessage(sender, isGroup)
      if (state.audioPlayer) {
        await state.audioPlayer.playQueue(audioData)
      }
    })

    // Set up group update callback
    state.client.onGroupUpdate((groupName, action) => {
      console.log("[v0] Group update:", groupName, action)
      loadGroups()
    })

    console.log("[v0] Client initialized")
  } catch (error) {
    console.error("[v0] Failed to initialize client:", error)
    alert("Error conectando al servidor Ice. Verifique que el servidor esté corriendo.")
  }
}

// Login function
async function login() {
  const usernameInput = document.getElementById("usernameInput")
  const username = usernameInput.value.trim()

  if (!username) {
    alert("Por favor ingresa un nombre de usuario")
    return
  }

  try {
    if (!state.client) {
      await initializeClient()
    }

    const success = await state.client.registerUser(username)

    if (success) {
      state.username = username

      // Initialize audio
      state.audioRecorder = new AudioRecorder()
      state.audioPlayer = new AudioPlayer()
      state.audioPlayer.initialize()

      // Show chat interface
      document.getElementById("loginContainer").classList.add("hidden")
      document.getElementById("chatContainer").classList.remove("hidden")
      document.getElementById("currentUsername").textContent = username

      // Load initial data
      await loadGroups()

      console.log("[v0] Login successful:", username)
    } else {
      alert("Error al registrar usuario")
    }
  } catch (error) {
    console.error("[v0] Login failed:", error)
    alert("Error al conectar: " + error.message)
  }
}

// Send message function
async function sendMessage() {
  const messageInput = document.getElementById("messageText")
  const message = messageInput.value.trim()

  if (!message || !state.currentChat) {
    return
  }

  try {
    await state.client.sendMessage(state.currentChat, message, state.isGroup)

    // Display sent message
    displaySentMessage(message)
    messageInput.value = ""
  } catch (error) {
    console.error("[v0] Failed to send message:", error)
    alert("Error enviando mensaje")
  }
}

// Toggle voice recording
async function toggleVoiceRecording() {
  const btn = document.getElementById("voiceRecordBtn")

  if (!state.isRecording) {
    try {
      if (!state.audioRecorder.stream) {
        await state.audioRecorder.initialize()
      }

      state.audioRecorder.startRecording()
      state.isRecording = true
      btn.textContent = "⏹️"
      btn.classList.add("recording")
    } catch (error) {
      console.error("[v0] Failed to start recording:", error)
      alert("Error al acceder al micrófono")
    }
  } else {
    try {
      const audioData = await state.audioRecorder.stopRecording()
      state.isRecording = false
      btn.textContent = "🎤"
      btn.classList.remove("recording")

      // Send voice message
      if (state.currentChat) {
        await state.client.sendVoiceMessage(state.currentChat, audioData, state.isGroup)
        displaySentVoiceMessage()
      }
    } catch (error) {
      console.error("[v0] Failed to stop recording:", error)
      alert("Error grabando audio")
    }
  }
}

// Open chat
async function openChat() {
  const input = document.getElementById("newChatUser")
  const username = input.value.trim()

  if (!username) {
    return
  }

  state.currentChat = username
  state.isGroup = false

  // Update UI
  document.getElementById("chatHeader").innerHTML = `
    <div class="chat-info">
      <h2>💬 ${username}</h2>
      <p>Chat privado</p>
    </div>
  `

  document.getElementById("messageInputContainer").classList.remove("hidden")

  // Load history
  try {
    const messages = await state.client.getConversationHistory(username)
    displayHistory(messages)
  } catch (error) {
    console.error("[v0] Failed to load history:", error)
  }

  input.value = ""
}

// Create group
async function createGroup() {
  const input = document.getElementById("newGroupName")
  const groupName = input.value.trim()

  if (!groupName) {
    return
  }

  try {
    const success = await state.client.createGroup(groupName)

    if (success) {
      alert("Grupo creado exitosamente")
      await loadGroups()
      input.value = ""
    } else {
      alert("El grupo ya existe")
    }
  } catch (error) {
    console.error("[v0] Failed to create group:", error)
    alert("Error creando grupo")
  }
}

// Join group
async function joinGroup() {
  const input = document.getElementById("joinGroupName")
  const groupName = input.value.trim()

  if (!groupName) {
    return
  }

  try {
    const success = await state.client.joinGroup(groupName)

    if (success) {
      alert("Te has unido al grupo")
      await loadGroups()
      input.value = ""
    } else {
      alert("El grupo no existe")
    }
  } catch (error) {
    console.error("[v0] Failed to join group:", error)
    alert("Error uniéndose al grupo")
  }
}

// Load groups
async function loadGroups() {
  try {
    const groups = await state.client.getAllGroups()
    const groupsList = document.getElementById("groupsList")

    if (groups.length === 0) {
      groupsList.innerHTML = '<p class="empty-state">No hay grupos disponibles</p>'
      return
    }

    groupsList.innerHTML = groups
      .map(
        (group) => `
      <div class="conversation-item" onclick="openGroupChat('${group.name}')">
        <div class="conversation-avatar">👥</div>
        <div class="conversation-info">
          <strong>${group.name}</strong>
          <span>${group.members.length} miembros</span>
        </div>
      </div>
    `,
      )
      .join("")
  } catch (error) {
    console.error("[v0] Failed to load groups:", error)
  }
}

// Open group chat
async function openGroupChat(groupName) {
  state.currentChat = groupName
  state.isGroup = true

  // Update UI
  document.getElementById("chatHeader").innerHTML = `
    <div class="chat-info">
      <h2>👥 ${groupName}</h2>
      <p>Chat grupal</p>
    </div>
  `

  document.getElementById("messageInputContainer").classList.remove("hidden")

  // Load history
  try {
    const messages = await state.client.getGroupHistory(groupName)
    displayHistory(messages)
  } catch (error) {
    console.error("[v0] Failed to load group history:", error)
  }
}

// Display functions
function displaySentMessage(message) {
  const container = document.getElementById("messagesContainer")
  const messageEl = document.createElement("div")
  messageEl.className = "message sent"
  messageEl.innerHTML = `
    <div class="message-content">${message}</div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `
  container.appendChild(messageEl)
  container.scrollTop = container.scrollHeight
}

function displayReceivedMessage(sender, message, isGroup) {
  if (isGroup && sender === state.username) return
  if (!isGroup && sender !== state.currentChat) return

  const container = document.getElementById("messagesContainer")
  const messageEl = document.createElement("div")
  messageEl.className = "message received"
  messageEl.innerHTML = `
    <div class="message-sender">${sender}</div>
    <div class="message-content">${message}</div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `
  container.appendChild(messageEl)
  container.scrollTop = container.scrollHeight
}

function displaySentVoiceMessage() {
  const container = document.getElementById("messagesContainer")
  const messageEl = document.createElement("div")
  messageEl.className = "message sent"
  messageEl.innerHTML = `
    <div class="message-content">🎤 Nota de voz</div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `
  container.appendChild(messageEl)
  container.scrollTop = container.scrollHeight
}

function displayReceivedVoiceMessage(sender, isGroup) {
  if (isGroup && sender === state.username) return
  if (!isGroup && sender !== state.currentChat) return

  const container = document.getElementById("messagesContainer")
  const messageEl = document.createElement("div")
  messageEl.className = "message received"
  messageEl.innerHTML = `
    <div class="message-sender">${sender}</div>
    <div class="message-content">🎤 Nota de voz</div>
    <div class="message-time">${new Date().toLocaleTimeString()}</div>
  `
  container.appendChild(messageEl)
  container.scrollTop = container.scrollHeight
}

function displayHistory(messages) {
  const container = document.getElementById("messagesContainer")
  container.innerHTML = ""

  messages.forEach((msg) => {
    const isSent = msg.sender === state.username
    const messageEl = document.createElement("div")
    messageEl.className = `message ${isSent ? "sent" : "received"}`

    const content = msg.type === 1 ? "🎤 Nota de voz" : msg.content // 1 = VOICE

    messageEl.innerHTML = `
      ${!isSent ? `<div class="message-sender">${msg.sender}</div>` : ""}
      <div class="message-content">${content}</div>
      <div class="message-time">${msg.timestamp}</div>
    `
    container.appendChild(messageEl)
  })

  container.scrollTop = container.scrollHeight
}

function logout() {
  if (state.client) {
    state.client.disconnect()
  }

  if (state.audioRecorder) {
    state.audioRecorder.release()
  }

  if (state.audioPlayer) {
    state.audioPlayer.release()
  }

  state.username = null
  state.currentChat = null

  document.getElementById("chatContainer").classList.add("hidden")
  document.getElementById("loginContainer").classList.remove("hidden")
}

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"))
  document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"))

  if (tab === "chats") {
    document.querySelectorAll(".tab")[0].classList.add("active")
    document.getElementById("chatsTab").classList.add("active")
  } else {
    document.querySelectorAll(".tab")[1].classList.add("active")
    document.getElementById("gruposTab").classList.add("active")
    loadGroups()
  }
}

// Export functions to window for HTML onclick handlers
window.login = login
window.sendMessage = sendMessage
window.toggleVoiceRecording = toggleVoiceRecording
window.openChat = openChat
window.createGroup = createGroup
window.joinGroup = joinGroup
window.openGroupChat = openGroupChat
window.logout = logout
window.switchTab = switchTab

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  initializeClient()
})
