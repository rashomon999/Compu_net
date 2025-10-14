package utils;

import java.io.Serializable;

public class VoiceMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private String sender;
    private String target; // usuario o grupo
    private byte[] audioData;
    private boolean isGroup;

    public VoiceMessage(String sender, String target, byte[] audioData) {
        this(sender, target, audioData, false);
    }

    public VoiceMessage(String sender, String target, byte[] audioData, boolean isGroup) {
        this.sender = sender;
        this.target = target;
        this.audioData = audioData;
        this.isGroup = isGroup;
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

    public boolean isGroup() {
        return isGroup;
    }

    @Override
    public String toString() {
        return "VoiceMessage{" +
                "sender='" + sender + '\'' +
                ", target='" + target + '\'' +
                ", isGroup=" + isGroup +
                ", audioBytes=" + (audioData == null ? 0 : audioData.length) +
                '}';
    }
}
