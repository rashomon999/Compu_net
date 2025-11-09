package tcp;

import java.io.*;
import java.net.Socket;
import java.util.List;
import java.util.Map;
import utils.HistoryManager;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * Handler REFACTORIZADO - Comunicación mediante JSON
 */
public class TextClientHandler implements Runnable {
    private final Socket socket;
    private final Map<String, PrintWriter> clients;
    private final HistoryManager history;
    private final Gson gson;
    
    // ========== SERVICIOS ==========
    private final MessageService messageService;
    private final GroupService groupService;
    private final HistoryService historyService;
    private final UserService userService;
    
    private String username;
    private PrintWriter out;
    private BufferedReader in;

    public TextClientHandler(Socket socket, Map<String, PrintWriter> clients, HistoryManager history) {
        this.socket = socket;
        this.clients = clients;
        this.history = history;
        this.gson = new Gson();
        
        // Inicializar servicios
        this.messageService = new MessageService(history, clients);
        this.groupService = new GroupService(history);
        this.historyService = new HistoryService(history);
        this.userService = new UserService(clients);
    }

    @Override
    public void run() {
        try {
            initializeStreams();
            
            if (registerUser()) {
                processCommands();
            }
            
        } catch (IOException e) {
            System.err.println("Error con cliente " + username + ": " + e.getMessage());
        } finally {
            disconnect();
        }
    }

    // ========== INICIALIZACIÓN ==========
    
    private void initializeStreams() throws IOException {
        out = new PrintWriter(socket.getOutputStream(), true);
        in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        
        // Enviar mensaje de bienvenida en JSON
        sendJsonResponse(true, "Bienvenido al servidor de chat", null);
    }

    private boolean registerUser() throws IOException {
        String jsonLine = in.readLine();
        
        if (jsonLine == null) {
            return false;
        }
        
        try {
            JsonObject request = JsonParser.parseString(jsonLine).getAsJsonObject();
            String command = request.get("command").getAsString();
            
            if (!"REGISTER".equals(command)) {
                sendJsonResponse(false, "Comando REGISTER esperado", null);
                return false;
            }
            
            username = request.get("username").getAsString().trim();
            
            if (username.isEmpty() || clients.containsKey(username)) {
                sendJsonResponse(false, "Usuario ya existe o inválido", null);
                socket.close();
                return false;
            }

            synchronized (clients) {
                clients.put(username, out);
            }

            sendJsonResponse(true, "Registrado como " + username, 
                           Map.of("username", username));
            System.out.println("[+] Usuario registrado: " + username);
            return true;
            
        } catch (Exception e) {
            sendJsonResponse(false, "JSON inválido: " + e.getMessage(), null);
            return false;
        }
    }

    // ========== PROCESAMIENTO DE COMANDOS ==========
    
    private void processCommands() throws IOException {
        String jsonLine;
        while ((jsonLine = in.readLine()) != null) {
            System.out.println("[" + username + "] Recibido: " + jsonLine);
            processJsonCommand(jsonLine);
        }
    }

    private void processJsonCommand(String jsonLine) {
        try {
            JsonObject request = JsonParser.parseString(jsonLine).getAsJsonObject();
            String command = request.get("command").getAsString();
            
            System.out.println("[" + username + "] Comando: " + command);

            switch (command) {
                case "MSG_USER" -> handlePrivateMessage(request);
                case "MSG_GROUP" -> handleGroupMessage(request);
                case "CREATE_GROUP" -> handleCreateGroup(request);
                case "JOIN_GROUP" -> handleJoinGroup(request);
                case "LEAVE_GROUP" -> handleLeaveGroup(request);
                case "LIST_GROUPS" -> handleListGroups();
                case "LIST_USER_GROUPS" -> handleListUserGroups(); // 🆕 AGREGAR ESTA LÍNEA
                case "LIST_GROUP_MEMBERS" -> handleListGroupMembers(request);
                case "LIST_USERS" -> handleListUsers();
                case "VIEW_HISTORY" -> handleViewHistory(request);
                case "VIEW_GROUP_HISTORY" -> handleViewGroupHistory(request);
                case "GET_RECENT_CONVERSATIONS" -> handleGetRecentConversations();
                case "GET_NEW_MESSAGES" -> handleGetNewMessages(); // 🆕 NUEVO
                case "MARK_AS_READ" -> handleMarkAsRead(); // 🆕 NUEVO
                default -> sendJsonResponse(false, "Comando desconocido: " + command, null);
            }
            
        } catch (Exception e) {
            sendJsonResponse(false, "Error procesando comando: " + e.getMessage(), null);
            e.printStackTrace();
        }
    }

    // ========== HANDLERS DE COMANDOS ==========
    
    private void handleGetNewMessages() {
    List<Map<String, String>> newMessages = historyService.getNewMessages(username);
    
    sendJsonResponse(true, " ", Map.of(
        "messages", newMessages,
        "count", newMessages.size()
    ));
}

private void handleMarkAsRead() {
    historyService.markAsRead(username);
    sendJsonResponse(true, "Mensajes marcados como leídos", null);
}

    private void handleGetRecentConversations() {
        List<String> conversations = historyService.getRecentConversations(username);
    
        sendJsonResponse(true, "Conversaciones recientes", Map.of(
            "conversations", conversations
   
        ));
    }
    private void handlePrivateMessage(JsonObject request) {
        String recipient = request.get("recipient").getAsString();
        String message = request.get("message").getAsString();
        
        String result = messageService.sendPrivateMessage(username, recipient, message);
        boolean success = result.startsWith("SUCCESS");
        
        sendJsonResponse(success, result, Map.of(
            "from", username,
            "to", recipient,
            "message", message,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    private void handleGroupMessage(JsonObject request) {
        String groupName = request.get("groupName").getAsString();
        String message = request.get("message").getAsString();
        
        String result = messageService.sendGroupMessage(username, groupName, message);
        boolean success = result.startsWith("SUCCESS");
        
        sendJsonResponse(success, result, Map.of(
            "from", username,
            "group", groupName,
            "message", message,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    private void handleCreateGroup(JsonObject request) {
        String groupName = request.get("groupName").getAsString();
        
        String result = groupService.createGroup(groupName, username);
        boolean success = result.startsWith("SUCCESS");
        
        sendJsonResponse(success, result, Map.of(
            "groupName", groupName,
            "creator", username
        ));
    }
    
    private void handleJoinGroup(JsonObject request) {
        String groupName = request.get("groupName").getAsString();
        
        String result = groupService.joinGroup(groupName, username);
        boolean success = result.startsWith("SUCCESS");
        
        sendJsonResponse(success, result, Map.of(
            "groupName", groupName,
            "username", username
        ));
    }
    
    private void handleLeaveGroup(JsonObject request) {
        String groupName = request.get("groupName").getAsString();
        
        // Implementar en GroupService si no existe
        sendJsonResponse(true, "Funcionalidad pendiente", null);
    }
    
    private void handleListGroups() {
        String result = groupService.listAllGroups();
        sendJsonResponse(true, result, null);
    }
    
    private void handleListGroupMembers(JsonObject request) {
        String groupName = request.get("groupName").getAsString();
        
        if (!groupService.groupExists(groupName)) {
            sendJsonResponse(false, "El grupo no existe", null);
            return;
        }
        
        // Implementar en GroupService
        sendJsonResponse(true, "Funcionalidad pendiente", null);
    }
    
    private void handleListUsers() {
        String result = userService.listConnectedUsers(username);
        sendJsonResponse(true, result, null);
    }
    
    private void handleViewHistory(JsonObject request) {
        String otherUser = request.get("otherUser").getAsString();
        
        String result = historyService.getConversationHistory(username, otherUser);
        sendJsonResponse(true, result, null);
    }
    
    // En TextClientHandler.java - Reemplazar el método handleViewGroupHistory existente

private void handleViewGroupHistory(JsonObject request) {
    String groupName = request.get("groupName").getAsString();
    
    // 🔒 Verificar que el grupo existe
    if (!groupService.groupExists(groupName)) {
        sendJsonResponse(false, "ERROR: El grupo no existe", null);
        return;
    }
    
    // 🔒 Verificar membresía ANTES de mostrar historial
    List<String> members = history.getGroupMembers(groupName);
    if (!members.contains(username)) {
        sendJsonResponse(false, "ERROR: No eres miembro de este grupo", null);
        System.out.println("[⚠️] " + username + " intentó ver historial de " + 
                         groupName + " sin ser miembro");
        return;
    }
    
    // Solo si es miembro, devolver historial
    String result = historyService.getGroupHistory(groupName);
    sendJsonResponse(true, result, null);
}
 private void handleListUserGroups() {
    // 🆕 Listar solo grupos donde el usuario ES miembro
    String result = groupService.listUserGroups(username);
    sendJsonResponse(true, result, null);
}

    // ========== UTILIDADES ==========
    
    private void sendJsonResponse(boolean success, String message, Map<String, Object> data) {
        JsonObject response = new JsonObject();
        response.addProperty("success", success);
        response.addProperty("message", message);
        
        if (data != null) {
            JsonObject dataObj = gson.toJsonTree(data).getAsJsonObject();
            response.add("data", dataObj);
        }
        
        String jsonResponse = gson.toJson(response);
        out.println(jsonResponse);
        System.out.println("[→] " + username + ": " + jsonResponse);
    }


    
    // ========== DESCONEXIÓN ==========
    
    private void disconnect() {
        if (username != null) {
            clients.remove(username);
            System.out.println("[-] " + username + " desconectado");
        }
        try { 
            socket.close(); 
        } catch (IOException e) {
            // Ignorar errores al cerrar
        }
    }
}