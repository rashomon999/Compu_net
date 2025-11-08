package tcp;

import java.io.*;
import java.net.Socket;
import java.util.Map;
import utils.HistoryManager;
 
/**
 * Handler REFACTORIZADO - Solo maneja I/O y delega a servicios
 * ANTES: 280 líneas | DESPUÉS: ~120 líneas
 */
public class TextClientHandler implements Runnable {
    private final Socket socket;
    private final Map<String, PrintWriter> clients;
    private final HistoryManager history;
    
    // ========== SERVICIOS (Inyección de Dependencias) ==========
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
        out.println("Bienvenido al servidor de chat");
    }

    private boolean registerUser() throws IOException {
        String registerCmd = in.readLine();
        
        if (registerCmd == null || !registerCmd.startsWith("REGISTER ")) {
            return false;
        }
        
        username = registerCmd.substring(9).trim();
        
        if (username.isEmpty() || clients.containsKey(username)) {
            out.println("ERROR: Usuario ya existe o inválido");
            socket.close();
            return false;
        }

        synchronized (clients) {
            clients.put(username, out);
        }

        out.println("Registrado como " + username);
        System.out.println("[+] Usuario registrado: " + username);
        return true;
    }

    // ========== PROCESAMIENTO DE COMANDOS ==========
    
    private void processCommands() throws IOException {
        String command;
        while ((command = in.readLine()) != null) {
            System.out.println("[" + username + "] Comando: " + command);
            processCommand(command);
        }
    }

    private void processCommand(String command) {
        try {
            String[] parts = command.split(" ", 3);
            if (parts.length == 0) return;

            String response = switch (parts[0]) {
                case "MSG_USER" -> 
                    parts.length >= 3 
                        ? messageService.sendPrivateMessage(username, parts[1], parts[2])
                        : "ERROR: Formato incorrecto";
                        
                case "MSG_GROUP" -> 
                    parts.length >= 3 
                        ? messageService.sendGroupMessage(username, parts[1], parts[2])
                        : "ERROR: Formato incorrecto";
                        
                case "CREATE_GROUP" -> 
                    parts.length >= 2 
                        ? groupService.createGroup(parts[1], username)
                        : "ERROR: Formato incorrecto";
                        
                case "JOIN_GROUP" -> 
                    parts.length >= 2 
                        ? groupService.joinGroup(parts[1], username)
                        : "ERROR: Formato incorrecto";
                        
                case "LIST_GROUPS" -> 
                    groupService.listAllGroups();
                    
                case "LIST_USERS" -> 
                    userService.listConnectedUsers(username);
                    
                case "VIEW_HISTORY" -> 
                    parts.length >= 2 
                        ? historyService.getConversationHistory(username, parts[1])
                        : "ERROR: Formato incorrecto";
                        
                case "VIEW_GROUP_HISTORY" -> 
                    parts.length >= 2 
                        ? historyService.getGroupHistory(parts[1])
                        : "ERROR: Formato incorrecto";
                        
                default -> "ERROR: Comando desconocido";
            };
            
            out.println(response);
            
        } catch (Exception e) {
            out.println("ERROR: " + e.getMessage());
            e.printStackTrace();
        }
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