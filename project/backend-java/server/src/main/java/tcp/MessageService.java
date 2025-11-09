package tcp;

//project\backend-java\server\src\main\java\tcp\MessageService.java

import java.io.PrintWriter;
import java.util.List;
import java.util.Map;
import utils.HistoryManager;

/**
 * Servicio responsable SOLO de enviar mensajes (privados y grupales)
 */
public class MessageService {
    private final HistoryManager history;
    private final Map<String, PrintWriter> clients;

    public MessageService(HistoryManager history, Map<String, PrintWriter> clients) {
        this.history = history;
        this.clients = clients;
    }

    /**
     * Envía un mensaje privado a otro usuario
     */
    public String sendPrivateMessage(String sender, String recipient, String message) {
        // 1. Guardar SIEMPRE en historial
        history.saveMessage(sender, recipient, "TEXT", message, false);
        System.out.println("[MSG] " + sender + " → " + recipient + ": " + message);
        
        // 2. Intentar entrega en tiempo real (si está conectado)
        PrintWriter recipientOut = clients.get(recipient);
        if (recipientOut != null) {
            recipientOut.println("[" + sender + "]: " + message);
        }
        
        // 3. Responder siempre con éxito
        return "SUCCESS: Mensaje enviado a " + recipient;
    }

    /**
     * Envía un mensaje a un grupo
     */
    public String sendGroupMessage(String sender, String groupName, String message) {
        // 1. Validar que el grupo existe
        if (!history.groupExists(groupName)) {
            return "ERROR: El grupo no existe";
        }

        // 2. Validar que el usuario es miembro
        List<String> members = history.getGroupMembers(groupName);
        if (!members.contains(sender)) {
            return "ERROR: No eres miembro del grupo";
        }

        // 3. Enviar a todos los miembros conectados (excepto al emisor)
        int sentCount = 0;
        for (String member : members) {
            if (!member.equals(sender)) {
                PrintWriter memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.println("[" + groupName + "] " + sender + ": " + message);
                    sentCount++;
                }
            }
        }

        // 4. Guardar en historial
        history.saveMessage(sender, groupName, "TEXT", message, true);
        System.out.println("[GROUP] " + sender + " → " + groupName + ": " + message);
        
        return "SUCCESS: Mensaje enviado al grupo (" + sentCount + " miembros)";
    }
}
