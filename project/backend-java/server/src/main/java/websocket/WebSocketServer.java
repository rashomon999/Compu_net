package websocket;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import tcp.*;
import utils.HistoryManager;

import java.net.InetSocketAddress;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket Server - Alternativa moderna a TCP
 * Proporciona comunicación bidireccional en tiempo real
 */
public class CompunetWebSocketServer extends WebSocketServer {
    private static final int WS_PORT = 8080;
    private final Map<String, WebSocket> clients = new ConcurrentHashMap<>();
    private final HistoryManager history;
    private final Gson gson;
    
    // Servicios reutilizables del servidor TCP
    private final MessageService messageService;
    private final GroupService groupService;
    private final HistoryService historyService;
    private final UserService userService;

    public CompunetWebSocketServer(HistoryManager history) {
        super(new InetSocketAddress(WS_PORT));
        this.history = history;
        this.gson = new Gson();
        
        // Inicializar servicios compartidos
        Map<String, org.java_websocket.WebSocket> dummyClients = new ConcurrentHashMap<>();
        this.messageService = new MessageService(history, new ConcurrentHashMap<>());
        this.groupService = new GroupService(history);
        this.historyService = new HistoryService(history);
        this.userService = new UserService(new ConcurrentHashMap<>());
        
        setConnectionLostTimeout(0);
        setReuseAddr(true);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("[WS] Nueva conexión: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String username = getUsername(conn);
        if (username != null) {
            clients.remove(username);
            System.out.println("[WS-] " + username + " desconectado");
            broadcastUserStatusChange(username, "offline");
        }
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            JsonObject request = JsonParser.parseString(message).getAsJsonObject();
            String command = request.get("command").getAsString();
            
            System.out.println("[WS] Comando recibido: " + command);

            switch (command) {
                case "REGISTER" -> handleWebSocketRegister(conn, request);
                case "MSG_USER" -> handleWebSocketPrivateMessage(conn, request);
                case "MSG_GROUP" -> handleWebSocketGroupMessage(conn, request);
                case "CREATE_GROUP" -> handleWebSocketCreateGroup(conn, request);
                case "JOIN_GROUP" -> handleWebSocketJoinGroup(conn, request);
                case "LIST_USERS" -> handleWebSocketListUsers(conn);
                case "LIST_GROUPS" -> handleWebSocketListGroups(conn);
                case "VIEW_HISTORY" -> handleWebSocketViewHistory(conn, request);
                default -> sendJsonResponse(conn, false, "Comando desconocido: " + command);
            }
        } catch (Exception e) {
            sendJsonResponse(conn, false, "Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("[WS ERROR] " + ex.getMessage());
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("[WS] WebSocket Server iniciado en puerto " + WS_PORT);
        System.out.println("[WS] Conecta con: ws://localhost:" + WS_PORT);
    }

    // ========== HANDLERS DE COMANDOS ==========

    private void handleWebSocketRegister(WebSocket conn, JsonObject request) {
        String username = request.get("username").getAsString().trim();

        if (username.isEmpty() || clients.containsKey(username)) {
            sendJsonResponse(conn, false, "Usuario ya existe o inválido");
            return;
        }

        clients.put(username, conn);
        conn.setAttachment(username);
        
        JsonObject data = new JsonObject();
        data.addProperty("username", username);
        sendJsonResponse(conn, true, "Registrado como " + username, data);
        
        System.out.println("[WS+] Usuario registrado: " + username);
        broadcastUserStatusChange(username, "online");
    }

    private void handleWebSocketPrivateMessage(WebSocket conn, JsonObject request) {
        String sender = getUsername(conn);
        String recipient = request.get("recipient").getAsString();
        String text = request.get("message").getAsString();

        if (sender == null) {
            sendJsonResponse(conn, false, "No registrado");
            return;
        }

        messageService.sendPrivateMessage(sender, recipient, text);

        JsonObject messageData = new JsonObject();
        messageData.addProperty("from", sender);
        messageData.addProperty("to", recipient);
        messageData.addProperty("text", text);
        messageData.addProperty("timestamp", System.currentTimeMillis());

        // Enviar confirmación al remitente
        sendJsonResponse(conn, true, "Mensaje enviado", messageData);

        // Enviar mensaje al destinatario si está conectado
        WebSocket recipientConn = clients.get(recipient);
        if (recipientConn != null && recipientConn.isOpen()) {
            JsonObject notification = new JsonObject();
            notification.addProperty("type", "message_received");
            notification.add("data", messageData);
            recipientConn.send(gson.toJson(notification));
        }
    }

    private void handleWebSocketGroupMessage(WebSocket conn, JsonObject request) {
        String sender = getUsername(conn);
        String groupName = request.get("groupName").getAsString();
        String text = request.get("message").getAsString();

        if (sender == null) {
            sendJsonResponse(conn, false, "No registrado");
            return;
        }

        messageService.sendGroupMessage(sender, groupName, text);

        JsonObject messageData = new JsonObject();
        messageData.addProperty("from", sender);
        messageData.addProperty("group", groupName);
        messageData.addProperty("text", text);
        messageData.addProperty("timestamp", System.currentTimeMillis());

        sendJsonResponse(conn, true, "Mensaje de grupo enviado", messageData);

        // Broadcast a todos los usuarios (se filtran después)
        broadcastGroupMessage(messageData);
    }

    private void handleWebSocketCreateGroup(WebSocket conn, JsonObject request) {
        String creator = getUsername(conn);
        String groupName = request.get("groupName").getAsString();

        if (creator == null) {
            sendJsonResponse(conn, false, "No registrado");
            return;
        }

        String result = groupService.createGroup(groupName, creator);
        boolean success = result.startsWith("SUCCESS");

        JsonObject data = new JsonObject();
        data.addProperty("groupName", groupName);
        data.addProperty("creator", creator);

        sendJsonResponse(conn, success, result, data);
    }

    private void handleWebSocketJoinGroup(WebSocket conn, JsonObject request) {
        String username = getUsername(conn);
        String groupName = request.get("groupName").getAsString();

        if (username == null) {
            sendJsonResponse(conn, false, "No registrado");
            return;
        }

        String result = groupService.joinGroup(groupName, username);
        boolean success = result.startsWith("SUCCESS");

        JsonObject data = new JsonObject();
        data.addProperty("groupName", groupName);
        data.addProperty("username", username);

        sendJsonResponse(conn, success, result, data);
    }

    private void handleWebSocketListUsers(WebSocket conn) {
        List<String> users = new ArrayList<>(clients.keySet());
        
        JsonObject data = new JsonObject();
        data.add("users", gson.toJsonTree(users));
        
        sendJsonResponse(conn, true, "Usuarios conectados", data);
    }

    private void handleWebSocketListGroups(WebSocket conn) {
        String result = groupService.listAllGroups();
        
        JsonObject data = new JsonObject();
        data.addProperty("groups", result);
        
        sendJsonResponse(conn, true, result, data);
    }

    private void handleWebSocketViewHistory(WebSocket conn, JsonObject request) {
        String username = getUsername(conn);
        String otherUser = request.get("otherUser").getAsString();

        if (username == null) {
            sendJsonResponse(conn, false, "No registrado");
            return;
        }

        String result = historyService.getConversationHistory(username, otherUser);
        
        JsonObject data = new JsonObject();
        data.addProperty("history", result);
        
        sendJsonResponse(conn, true, result, data);
    }

    // ========== UTILIDADES ==========

    private String getUsername(WebSocket conn) {
        Object attachment = conn.getAttachment();
        return attachment instanceof String ? (String) attachment : null;
    }

    private void sendJsonResponse(WebSocket conn, boolean success, String message) {
        sendJsonResponse(conn, success, message, null);
    }

    private void sendJsonResponse(WebSocket conn, boolean success, String message, JsonObject data) {
        if (!conn.isOpen()) return;

        JsonObject response = new JsonObject();
        response.addProperty("success", success);
        response.addProperty("message", message);
        if (data != null) {
            response.add("data", data);
        }

        conn.send(gson.toJson(response));
    }

    private void broadcastUserStatusChange(String username, String status) {
        JsonObject notification = new JsonObject();
        notification.addProperty("type", "user_status");
        notification.addProperty("username", username);
        notification.addProperty("status", status);

        String json = gson.toJson(notification);
        broadcast(json);
    }

    private void broadcastGroupMessage(JsonObject messageData) {
        JsonObject notification = new JsonObject();
        notification.addProperty("type", "group_message");
        notification.add("data", messageData);

        broadcast(gson.toJson(notification));
    }

    public Map<String, WebSocket> getClients() {
        return clients;
    }
}
