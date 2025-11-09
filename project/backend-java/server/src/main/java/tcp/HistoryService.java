package tcp;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;

//project\backend-java\server\src\main\java\tcp\HistoryService.java

import java.util.List;
import java.util.Map;
import java.util.Set;

import utils.HistoryManager;
import utils.HistoryManager.ChatMessage;

/**
 * Servicio responsable SOLO de consultar historial
 */
public class HistoryService {
    private final HistoryManager history;
// Map para rastrear el último mensaje visto por cada usuario
    
private final Map<String, Long> lastSeenTimestamp = new HashMap<>();

    public HistoryService(HistoryManager history) {
        this.history = history;
    }

    /**
     * 🆕 Obtiene mensajes nuevos para un usuario
     */
    public List<Map<String, String>> getNewMessages(String username) {
        List<HistoryManager.ChatMessage> allMessages = history.getAllMessages();
        long lastSeen = lastSeenTimestamp.getOrDefault(username, 0L);
        
        List<Map<String, String>> newMessages = new ArrayList<>();
        
        for (HistoryManager.ChatMessage msg : allMessages) {
            // Obtener timestamp del mensaje
            long msgTime = parseTimestamp(msg.timestamp);
            
            // Solo incluir si:
            // 1. Es más reciente que el último visto
            // 2. El usuario es el destinatario
            if (msgTime > lastSeen && msg.recipient.equals(username)) {
                Map<String, String> msgData = new HashMap<>();
                msgData.put("from", msg.sender);
                msgData.put("message", msg.content);
                msgData.put("type", msg.type);
                msgData.put("isGroup", String.valueOf(msg.isGroup));
                msgData.put("timestamp", msg.timestamp);
                
                newMessages.add(msgData);
            }
        }
        
        // Actualizar último visto
        if (!newMessages.isEmpty()) {
            lastSeenTimestamp.put(username, System.currentTimeMillis());
        }
        
        return newMessages;
    }
    
    /**
     * 🆕 Marca mensajes como leídos
     */
    public void markAsRead(String username) {
        lastSeenTimestamp.put(username, System.currentTimeMillis());
    }
    
    private long parseTimestamp(String timestamp) {
        try {
            // Formato: "yyyy-MM-dd HH:mm:ss"
            java.time.LocalDateTime dt = java.time.LocalDateTime.parse(
                timestamp, 
                java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            );
            return dt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        } catch (Exception e) {
            return 0;
        }
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



    /**
 * Obtiene la lista de usuarios con los que el usuario ha conversado
 */
public List<String> getRecentConversations(String username) {
    Set<String> contacts = new HashSet<>();
    
    List<ChatMessage> userMessages = history.getUserMessages(username);
    
    for (ChatMessage msg : userMessages) {
        // Solo conversaciones privadas
        if (!msg.isGroup) {
            if (msg.sender.equals(username)) {
                contacts.add(msg.recipient);
            } else {
                contacts.add(msg.sender);
            }
        }
    }
    
    // Convertir a lista y ordenar alfabéticamente
    List<String> result = new ArrayList<>(contacts);
    Collections.sort(result);
    
    return result;
    }

}
