import { Ice } from "ice"
import Chat from "chat" // Declared the Chat variable

class IceChatClient {
  constructor() {
    this.communicator = null
    this.chatService = null
    this.observer = null
    this.username = null
    this.messageCallbacks = []
    this.voiceCallbacks = []
    this.groupUpdateCallbacks = []
  }

  async connect(serverHost = "localhost", serverPort = 9099) {
    try {
      console.log("[v0] Connecting to Ice server...")

      // Initialize Ice communicator
      this.communicator = Ice.initialize()

      // Create proxy to ChatService
      const proxyString = `ChatService:ws -h ${serverHost} -p ${serverPort}`
      const base = this.communicator.stringToProxy(proxyString)
      this.chatService = await Chat.ChatServicePrx.checkedCast(base)

      if (!this.chatService) {
        throw new Error("Invalid proxy")
      }

      console.log("[v0] Connected to Ice server successfully")
      return true
    } catch (error) {
      console.error("[v0] Failed to connect to Ice server:", error)
      throw error
    }
  }

  async registerUser(username) {
    try {
      this.username = username

      // Create observer implementation
      this.observer = new ChatObserverImpl(
        (sender, message, isGroup) => {
          this.messageCallbacks.forEach((cb) => cb(sender, message, isGroup))
        },
        (sender, audioData, isGroup) => {
          this.voiceCallbacks.forEach((cb) => cb(sender, audioData, isGroup))
        },
        (groupName, action) => {
          this.groupUpdateCallbacks.forEach((cb) => cb(groupName, action))
        },
      )

      // Create adapter for callbacks
      const adapter = await this.communicator.createObjectAdapter("")
      const observerProxy = adapter.addWithUUID(this.observer)
      await adapter.activate()

      // Register with server
      const success = await this.chatService.registerUser(username, observerProxy)

      if (success) {
        console.log("[v0] User registered:", username)
      }

      return success
    } catch (error) {
      console.error("[v0] Failed to register user:", error)
      throw error
    }
  }

  async sendMessage(recipient, message, isGroup = false) {
    try {
      const success = await this.chatService.sendMessage(this.username, recipient, message, isGroup)
      console.log("[v0] Message sent:", { recipient, message, isGroup, success })
      return success
    } catch (error) {
      console.error("[v0] Failed to send message:", error)
      throw error
    }
  }

  async sendVoiceMessage(recipient, audioData, isGroup = false) {
    try {
      const success = await this.chatService.sendVoiceMessage(this.username, recipient, Array.from(audioData), isGroup)
      console.log("[v0] Voice message sent:", { recipient, size: audioData.length, isGroup, success })
      return success
    } catch (error) {
      console.error("[v0] Failed to send voice message:", error)
      throw error
    }
  }

  async createGroup(groupName) {
    try {
      const success = await this.chatService.createGroup(groupName, this.username)
      console.log("[v0] Group created:", { groupName, success })
      return success
    } catch (error) {
      console.error("[v0] Failed to create group:", error)
      throw error
    }
  }

  async joinGroup(groupName) {
    try {
      const success = await this.chatService.joinGroup(groupName, this.username)
      console.log("[v0] Joined group:", { groupName, success })
      return success
    } catch (error) {
      console.error("[v0] Failed to join group:", error)
      throw error
    }
  }

  async getConversationHistory(otherUser) {
    try {
      const messages = await this.chatService.getConversationHistory(this.username, otherUser)
      return messages
    } catch (error) {
      console.error("[v0] Failed to get conversation history:", error)
      throw error
    }
  }

  async getGroupHistory(groupName) {
    try {
      const messages = await this.chatService.getGroupHistory(groupName)
      return messages
    } catch (error) {
      console.error("[v0] Failed to get group history:", error)
      throw error
    }
  }

  async getAllGroups() {
    try {
      const groups = await this.chatService.getAllGroups()
      return groups
    } catch (error) {
      console.error("[v0] Failed to get groups:", error)
      throw error
    }
  }

  onMessage(callback) {
    this.messageCallbacks.push(callback)
  }

  onVoiceMessage(callback) {
    this.voiceCallbacks.push(callback)
  }

  onGroupUpdate(callback) {
    this.groupUpdateCallbacks.push(callback)
  }

  async disconnect() {
    try {
      if (this.username && this.chatService) {
        await this.chatService.unregisterUser(this.username)
      }

      if (this.communicator) {
        await this.communicator.destroy()
      }

      console.log("[v0] Disconnected from Ice server")
    } catch (error) {
      console.error("[v0] Error disconnecting:", error)
    }
  }
}

// Observer implementation for receiving callbacks
class ChatObserverImpl extends Chat.ChatObserver {
  constructor(onMessage, onVoice, onGroupUpdate) {
    super()
    this.onMessageCallback = onMessage
    this.onVoiceCallback = onVoice
    this.onGroupUpdateCallback = onGroupUpdate
  }

  receiveMessage(sender, message, isGroup, current) {
    console.log("[v0] Received message:", { sender, message, isGroup })
    this.onMessageCallback(sender, message, isGroup)
  }

  receiveVoiceData(sender, audioData, isGroup, current) {
    console.log("[v0] Received voice data:", { sender, size: audioData.length, isGroup })
    this.onVoiceCallback(sender, new Uint8Array(audioData), isGroup)
  }

  notifyGroupUpdate(groupName, action, current) {
    console.log("[v0] Group update:", { groupName, action })
    this.onGroupUpdateCallback(groupName, action)
  }
}

export default IceChatClient
