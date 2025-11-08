package tcp;

import java.io.*;
import java.net.Socket;
import java.util.*;
import utils.HistoryManager;

public class TextClientHandler implements Runnable {
    private Socket socket;
    private String username;
    private PrintWriter out;
    private BufferedReader in;
    private Map<String, PrintWriter> clients;
    private HistoryManager history;

    public TextClientHandler(Socket socket, Map<String, PrintWriter> clients, HistoryManager history) {
        this.socket = socket;
        this.clients = clients;
        this.history = history;
    }

    @Override
    public void run() {
        try {
            out = new PrintWriter(socket.getOutputStream(), true);
            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));

            // Mensaje de bienvenida
            out.println("Bienvenido al servidor de chat");

            // Registro de usuario
            String registerCmd = in.readLine();
            if (registerCmd != null && registerCmd.startsWith("REGISTER ")) {
                username = registerCmd.substring(9).trim();
                
                if (username.isEmpty() || clients.containsKey(username)) {
                    out.println("ERROR: Usuario ya existe o inválido");
                    socket.close();
                    return;
                }

                synchronized (clients) {
                    clients.put(username, out);
                }

                out.println("Registrado como " + username);
                System.out.println("[+] Usuario registrado: " + username);

                // Procesar comandos
                String command;
                while ((command = in.readLine()) != null) {
                    System.out.println("[" + username + "] Comando: " + command);
                    processCommand(command);
                }
            }

        } catch (IOException e) {
            System.err.println("Error con cliente " + username + ": " + e.getMessage());
        } finally {
            disconnect();
        }
    }

    private void processCommand(String command) {
        try {
            String[] parts = command.split(" ", 3);
            if (parts.length == 0) return;

            String cmd = parts[0];

            switch (cmd) {
                case "MSG_USER":
                    if (parts.length >= 3) sendMessageToUser(parts[1], parts[2]);
                    break;

                case "MSG_GROUP":
                    if (parts.length >= 3) sendMessageToGroup(parts[1], parts[2]);
                    break;

                case "CREATE_GROUP":
                    if (parts.length >= 2) createGroup(parts[1]);
                    break;

                case "JOIN_GROUP":
                    if (parts.length >= 2) joinGroup(parts[1]);
                    break;

                case "LIST_GROUPS":
                    listGroups();
                    break;

                case "LIST_USERS":
                    listUsers();
                    break;

                case "VIEW_HISTORY":
                    if (parts.length >= 2) viewHistory(parts[1]);
                    break;

                case "VIEW_GROUP_HISTORY":
                    if (parts.length >= 2) viewGroupHistory(parts[1]);
                    break;

                default:
                    out.println("ERROR: Comando desconocido");
            }
        } catch (Exception e) {
            out.println("ERROR: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendMessageToUser(String targetUser, String message) {
    // SIEMPRE guardar el mensaje en el historial
    history.saveMessage(username, targetUser, "TEXT", message, false);
    System.out.println("[MSG] " + username + " → " + targetUser + ": " + message);
    
    // Intentar entregar si está conectado (opcional)
    PrintWriter targetOut = clients.get(targetUser);
    if (targetOut != null) {
        targetOut.println("[" + username + "]: " + message);
    }
    
    // Responder SIEMPRE con éxito
    out.println("SUCCESS: Mensaje enviado a " + targetUser);
}

    private void sendMessageToGroup(String groupName, String message) {
        if (!history.groupExists(groupName)) {
            out.println("ERROR: El grupo no existe");
            return;
        }

        List<String> members = history.getGroupMembers(groupName);
        if (!members.contains(username)) {
            out.println("ERROR: No eres miembro del grupo");
            return;
        }

        int sentCount = 0;
        for (String member : members) {
            if (!member.equals(username)) {
                PrintWriter memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.println("[" + groupName + "] " + username + ": " + message);
                    sentCount++;
                }
            }
        }

        out.println("SUCCESS: Mensaje enviado al grupo (" + sentCount + " miembros)");
        history.saveMessage(username, groupName, "TEXT", message, true);
        System.out.println("[GROUP] " + username + " → " + groupName + ": " + message);
    }

    private void createGroup(String groupName) {
        if (history.createGroup(groupName, username)) {
            out.println("SUCCESS: Grupo '" + groupName + "' creado");
            System.out.println("[GROUP] Creado: " + groupName + " por " + username);
        } else {
            out.println("ERROR: El grupo ya existe");
        }
    }

    private void joinGroup(String groupName) {
        if (!history.groupExists(groupName)) {
            out.println("ERROR: El grupo no existe");
            return;
        }

        if (history.addUserToGroup(groupName, username)) {
            out.println("SUCCESS: Te has unido al grupo '" + groupName + "'");
            System.out.println("[GROUP] " + username + " se unió a " + groupName);
        } else {
            out.println("ERROR: Error al unirse al grupo");
        }
    }

    private void listGroups() {
        Set<String> groups = history.getAllGroups();
        if (groups.isEmpty()) {
            out.println("No hay grupos creados");
        } else {
            StringBuilder sb = new StringBuilder("Grupos disponibles:\n");
            for (String group : groups) {
                List<String> members = history.getGroupMembers(group);
                sb.append("- ").append(group).append(" (").append(members.size()).append(" miembros)\n");
            }
            out.println(sb.toString().trim());
        }
    }

    private void listUsers() {
        StringBuilder sb = new StringBuilder("Usuarios conectados:\n");
        for (String user : clients.keySet()) {
            if (!user.equals(username)) {
                sb.append("- ").append(user).append("\n");
            }
        }
        out.println(sb.toString().trim());
    }

    private void viewHistory(String otherUser) {
        List<HistoryManager.ChatMessage> messages = history.getConversationHistory(username, otherUser);
        
        if (messages.isEmpty()) {
            out.println("No hay historial con " + otherUser);
        } else {
            StringBuilder sb = new StringBuilder("Historial con " + otherUser + ":\n");
            for (HistoryManager.ChatMessage msg : messages) {
                String direction = msg.sender.equals(username) ? "→" : "←";
                sb.append("[").append(msg.timestamp).append("] ")
                  .append(direction).append(" ")
                  .append(msg.sender).append(": ")
                  .append(msg.content).append("\n");
            }
            out.println(sb.toString().trim());
        }
    }

    private void viewGroupHistory(String groupName) {
        if (!history.groupExists(groupName)) {
            out.println("ERROR: El grupo no existe");
            return;
        }

        List<HistoryManager.ChatMessage> messages = history.getGroupHistory(groupName);
        
        if (messages.isEmpty()) {
            out.println("No hay historial en el grupo");
        } else {
            StringBuilder sb = new StringBuilder("Historial del grupo " + groupName + ":\n");
            for (HistoryManager.ChatMessage msg : messages) {
                sb.append("[").append(msg.timestamp).append("] ")
                  .append(msg.sender).append(": ")
                  .append(msg.content).append("\n");
            }
            out.println(sb.toString().trim());
        }
    }

    private void disconnect() {
        if (username != null) {
            clients.remove(username);
            System.out.println("[-] " + username + " desconectado");
        }
        try { socket.close(); } catch (IOException e) { }
    }
} 