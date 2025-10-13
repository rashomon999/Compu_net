package utils;

import java.io.Serializable;

/**
 * Clase que representa un mensaje de voz dentro del sistema de chat.
 * 
 * Esta clase se utiliza para encapsular la información necesaria para enviar o recibir 
 * mensajes de audio entre usuarios o grupos, incluyendo los datos binarios del sonido,
 * el remitente, el destinatario y si el mensaje pertenece a un grupo.
 * 
 * Es serializable para permitir su envío a través de sockets o su persistencia en disco.
 */
public class VoiceMessage implements Serializable {
    private static final long serialVersionUID = 1L;

    private String sender;
    private String target; // usuario o grupo
    private byte[] audioData;
    private boolean isGroup;

    //Crea un nuevo mensaje de voz entre dos usuarios.
    public VoiceMessage(String sender, String target, byte[] audioData) {
        this(sender, target, audioData, false);
    }

    //Crea un nuevo mensaje de voz (ya sea privado o grupal).
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
