class AudioPlayer {
  constructor() {
    this.audioContext = null
    this.queue = []
    this.isPlaying = false
  }

  initialize() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    console.log("[v0] Audio player initialized")
  }

  async play(audioData) {
    try {
      // Decode audio data
      const audioBlob = new Blob([audioData], { type: "audio/webm" })
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

      // Create source
      const source = this.audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.audioContext.destination)

      // Play
      source.start(0)
      console.log("[v0] Playing audio")

      return new Promise((resolve) => {
        source.onended = () => {
          console.log("[v0] Audio playback finished")
          resolve()
        }
      })
    } catch (error) {
      console.error("[v0] Failed to play audio:", error)
      throw error
    }
  }

  async playQueue(audioData) {
    this.queue.push(audioData)

    if (!this.isPlaying) {
      this.processQueue()
    }
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const audioData = this.queue.shift()

    try {
      await this.play(audioData)
    } catch (error) {
      console.error("[v0] Error playing from queue:", error)
    }

    this.processQueue()
  }

  release() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.queue = []
    this.isPlaying = false
    console.log("[v0] Audio player released")
  }
}

export default AudioPlayer
