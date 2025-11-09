package tcp;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
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
     * 🆕 Obtiene mensajes nuevos para un usuario (CORREGIDO)
     */
    public List<Map<String, String>> getNewMessages(String username) {
        List<HistoryManager.ChatMessage> allMessages = history.getAllMessages();
        long lastSeen = lastSeenTimestamp.getOrDefault(username, 0L);
        
        List<Map<String, String>> newMessages = new ArrayList<>();
        long maxTimestamp = lastSeen;
        
        for (HistoryManager.ChatMessage msg : allMessages) {
            // Obtener timestamp del mensaje
            long msgTime = parseTimestamp(msg.timestamp);
            
            // Solo incluir si:
            // 1. Es más reciente que el último visto
            // 2. El usuario es el destinatario (y no el emisor)
            // 3. Es un mensaje privado O es un grupo donde el usuario es miembro
            boolean isRecipient = msg.recipient.equals(username) && !msg.sender.equals(username);
            boolean isGroupMessage = msg.isGroup && history.getGroupMembers(msg.recipient).contains(username) 
                                    && !msg.sender.equals(username);
            
            if (msgTime > lastSeen && (isRecipient || isGroupMessage)) {
                Map<String, String> msgData = new HashMap<>();
                msgData.put("from", msg.sender);
                msgData.put("to", msg.recipient);
                msgData.put("message", msg.content);
                msgData.put("type", msg.type);
                msgData.put("isGroup", String.valueOf(msg.isGroup));
                msgData.put("timestamp", msg.timestamp);
                
                newMessages.add(msgData);
                
                // Actualizar el timestamp máximo
                if (msgTime > maxTimestamp) {
                    maxTimestamp = msgTime;
                }
            }
        }
        
        // Solo actualizar último visto si realmente hay mensajes nuevos
        if (!newMessages.isEmpty()) {
            lastSeenTimestamp.put(username, maxTimestamp);
            System.out.println("[📬] " + username + " tiene " + newMessages.size() + " mensajes nuevos");
        }
        
        return newMessages;
    }
    
    /**
     * 🆕 Marca mensajes como leídos (actualiza timestamp manualmente)
     */
    public void markAsRead(String username) {
        lastSeenTimestamp.put(username, System.currentTimeMillis());
        System.out.println("[✓] " + username + " marcó mensajes como leídos");
    }
    
    /**
     * 🆕 Inicializa el timestamp para un usuario (llamar después del login)
     */
    public void initializeUser(String username) {
        if (!lastSeenTimestamp.containsKey(username)) {
            lastSeenTimestamp.put(username, System.currentTimeMillis());
            System.out.println("[🔔] Notificaciones inicializadas para " + username);
        }
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
            System.err.println("[⚠️] Error parseando timestamp: " + timestamp);
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