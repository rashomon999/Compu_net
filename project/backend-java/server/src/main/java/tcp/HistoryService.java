package tcp;

import java.util.List;
import utils.HistoryManager;
import utils.HistoryManager.ChatMessage;

/**
 * Servicio responsable SOLO de consultar historial
 */
public class HistoryService {
    private final HistoryManager history;

    public HistoryService(HistoryManager history) {
        this.history = history;
    }

    /**
     * Obtiene el historial de conversación con otro usuario
     */
    public String getConversationHistory(String currentUser, String otherUser) {
        List<ChatMessage> messages = history.getConversationHistory(currentUser, otherUser);
        
        if (messages.isEmpty()) {
            return "No hay historial con " + otherUser;
        }
        
        StringBuilder sb = new StringBuilder("Historial con " + otherUser + ":\n");
        for (ChatMessage msg : messages) {
            String direction = msg.sender.equals(currentUser) ? "→" : "←";
            sb.append("[").append(msg.timestamp).append("] ")
              .append(direction).append(" ")
              .append(msg.sender).append(": ")
              .append(msg.content).append("\n");
        }
        
        return sb.toString().trim();
    }

    /**
     * Obtiene el historial de un grupo
     */
    public String getGroupHistory(String groupName) {
        if (!history.groupExists(groupName)) {
            return "ERROR: El grupo no existe";
        }

        List<ChatMessage> messages = history.getGroupHistory(groupName);
        
        if (messages.isEmpty()) {
            return "No hay historial en el grupo";
        }
        
        StringBuilder sb = new StringBuilder("Historial del grupo " + groupName + ":\n");
        for (ChatMessage msg : messages) {
            sb.append("[").append(msg.timestamp).append("] ")
              .append(msg.sender).append(": ")
              .append(msg.content).append("\n");
        }
        
        return sb.toString().trim();
    }
}