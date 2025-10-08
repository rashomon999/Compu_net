package utils;

import java.io.Serializable;

public class VoiceMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private String sender;
    private String target; // usuario o grupo
    private byte[] audioData;

    public VoiceMessage(String sender, String target, byte[] audioData) {
        this.sender = sender;
        this.target = target;
        this.audioData = audioData;
    }

    public String getSender() {
        return sender;
    }

    public String getTarget() {
        return target;
    }

    public byte[] getAudioData() {
        return audioData;
    }

    @Override
    public String toString() {
        return "VoiceMessage{" +
                "sender='" + sender + '\'' +
                ", target='" + target + '\'' +
                ", audioBytes=" + audioData.length +
                '}';
    }
}
