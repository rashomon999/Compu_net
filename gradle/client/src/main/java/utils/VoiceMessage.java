package utils;

import java.io.Serializable;

/**
 * Representa un mensaje de voz (nota de audio) que puede ser enviado
 * entre usuarios o dentro de un grupo de chat. Esta clase es serializable,
 * lo que permite enviarla a través de sockets TCP como un objeto completo.
 *
 * Atributos principales:
 * 
 *   sender: nombre del usuario que envía el mensaje.
 *   target: destinatario del mensaje (usuario o grupo).
 *   audioData: arreglo de bytes que contiene el audio grabado.
 *   isGroup: indica si el mensaje es grupal o individual.
 *
 * Ejemplo de uso:
 *     VoiceMessage msg = new VoiceMessage("Carlos", "Grupo1", audioBytes, true);
 *     outputStream.writeObject(msg);
 */

public class VoiceMessage implements Serializable {

    //Identificador de versión para la serialización.
    private static final long serialVersionUID = 1L;
    //Usuario que envía el mensaje de voz.
    private String sender;
    //Usuario o grupo destinatario del mensaje.
    private String target; 
    //Contenido del audio en formato de bytes.
    private byte[] audioData;
    //Indica si el mensaje pertenece a un grupo o es individual.
    private boolean isGroup;

    /**
     * Constructor de un mensaje de voz individual.
     *
     * @param sender usuario que envía el mensaje.
     * @param target destinatario del mensaje.
     * @param audioData bytes del audio.
     */
    public VoiceMessage(String sender, String target, byte[] audioData) {
        this(sender, target, audioData, false);
    }

    /**
     * Constructor completo del mensaje de voz.
     *
     * @param sender usuario que envía el mensaje.
     * @param target destinatario del mensaje (usuario o grupo).
     * @param audioData bytes del audio.
     * @param isGroup indica si el mensaje es grupal.
     */
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

    //@return los datos de audio en bytes.
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
                ", audioBytes=" + audioData.length +
                '}';
    }
}
