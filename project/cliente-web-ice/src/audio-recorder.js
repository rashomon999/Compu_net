class AudioRecorder {
  constructor() {
    this.mediaRecorder = null
    this.audioChunks = []
    this.stream = null
    this.isRecording = false
  }

  async initialize() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log("[v0] Microphone access granted")
      return true
    } catch (error) {
      console.error("[v0] Failed to get microphone access:", error)
      throw error
    }
  }

  startRecording() {
    if (!this.stream) {
      throw new Error("Audio recorder not initialized")
    }

    this.audioChunks = []
    this.mediaRecorder = new MediaRecorder(this.stream)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.start()
    this.isRecording = true
    console.log("[v0] Recording started")
  }

  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error("Not recording"))
        return
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" })
          const arrayBuffer = await audioBlob.arrayBuffer()
          const audioData = new Uint8Array(arrayBuffer)

          this.isRecording = false
          console.log("[v0] Recording stopped, size:", audioData.length)

          resolve(audioData)
        } catch (error) {
          reject(error)
        }
      }

      this.mediaRecorder.stop()
    })
  }

  release() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    console.log("[v0] Audio recorder released")
  }
}

export default AudioRecorder
