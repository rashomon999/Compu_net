package tcp;

import utils.HistoryManager;
import utils.VoiceMessage;
import utils.MessageProtocol;

import java.io.*;
import java.net.Socket;
import java.util.*;

public class ClientHandler implements Runnable {
    private Socket socket;
    private String username;
    private ObjectOutputStream out;
    private ObjectInputStream in;
    private Map<String, ObjectOutputStream> clients;
    private HistoryManager history;

    public ClientHandler(Socket socket, Map<String, ObjectOutputStream> clients, HistoryManager history) {
        this.socket = socket;
        this.clients = clients;
        this.history = history;
    }

    @Override
    public void run() {
        try {
            out = new ObjectOutputStream(socket.getOutputStream());
            in = new ObjectInputStream(socket.getInputStream());

            // Solicitar registro
            out.writeObject("Bienvenido al servidor de chat");
            out.flush();

            Object inputObj = in.readObject();
            if (inputObj instanceof String input && input.startsWith("REGISTER ")) {
                username = input.split(" ", 2)[1].trim();
                if (username.isEmpty() || clients.containsKey(username)) {
                    out.writeObject(MessageProtocol.buildError("Nombre de usuario inválido o ya en uso"));
                    out.flush();
                    socket.close();
                    return;
                }

                synchronized (clients) {
                    clients.put(username, out);
                }

                out.writeObject(MessageProtocol.buildSuccess("Registrado como " + username));
                out.flush();
                broadcast(MessageProtocol.buildInfo(username + " se ha unido al chat"));
            } else {
                socket.close();
                return;
            }

            System.out.println("[+] " + username + " conectado desde " + socket.getInetAddress());

            // Escucha de comandos y objetos del cliente
            Object obj;
            while ((obj = in.readObject()) != null) {
                if (obj instanceof String cmdLine) {
                    processCommand(cmdLine);
                } else if (obj instanceof VoiceMessage voiceMsg) {
                    processVoiceMessage(voiceMsg);
                }
            }

        } catch (IOException | ClassNotFoundException e) {
            System.err.println("Error con cliente " + username + ": " + e.getMessage());
        } finally {
            disconnect();
        }
    }

    private void processCommand(String command) {
        String[] parts = command.split(" ", 3);
        if (parts.length == 0) return;
        String cmd = parts[0];

        try {
            switch (cmd) {
                case MessageProtocol.MSG_USER:
                    if (parts.length >= 3) sendTextToUser(parts[1], parts[2]);
                    break;

                case MessageProtocol.MSG_GROUP:
                    if (parts.length >= 3) sendTextToGroup(parts[1], parts[2]);
                    break;

                case MessageProtocol.CREATE_GROUP:
                    if (parts.length >= 2) createGroup(parts[1]);
                    break;

                case MessageProtocol.JOIN_GROUP:
                    if (parts.length >= 2) joinGroup(parts[1]);
                    break;

                case MessageProtocol.LEAVE_GROUP:
                    if (parts.length >= 2) leaveGroup(parts[1]);
                    break;

                case MessageProtocol.LIST_GROUPS:
                    listGroups();
                    break;

                case MessageProtocol.LIST_GROUP_MEMBERS:
                    if (parts.length >= 2) listGroupMembers(parts[1]);
                    break;

                case MessageProtocol.LIST_USERS:
                    listUsers();
                    break;

                case MessageProtocol.VIEW_HISTORY:
                    if (parts.length >= 2) viewHistory(parts[1]);
                    break;

                case MessageProtocol.VIEW_GROUP_HISTORY:
                    if (parts.length >= 2) viewGroupHistory(parts[1]);
                    break;

                default:
                    out.writeObject(MessageProtocol.buildError("Comando desconocido '" + cmd + "'"));
                    out.flush();
            }
        } catch (Exception e) {
            try {
                out.writeObject(MessageProtocol.buildError(e.getMessage()));
                out.flush();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
    }

    /**
     * Procesa y guarda mensajes de voz con persistencia de archivo
     */
    private void processVoiceMessage(VoiceMessage voiceMsg) {
        try {
            String target = voiceMsg.getTarget();
            boolean isGroup = voiceMsg.isGroup();
            
            if (isGroup) {
                // Send voice note to group
                if (!history.groupExists(target)) {
                    out.writeObject(MessageProtocol.buildError("El grupo " + target + " no existe"));
                    out.flush();
                    return;
                }
                
                List<String> members = history.getGroupMembers(target);
                if (!members.contains(username)) {
                    out.writeObject(MessageProtocol.buildError("No eres miembro del grupo " + target));
                    out.flush();
                    return;
                }
                
                int sentCount = 0;
                for (String member : members) {
                    if (!member.equals(username)) {
                        ObjectOutputStream memberOut = clients.get(member);
                        if (memberOut != null) {
                            memberOut.writeObject(voiceMsg);
                            memberOut.flush();
                            sentCount++;
                        }
                    }
                }
                
                history.saveVoiceMessage(username, target, voiceMsg.getAudioData(), true);
                out.writeObject(MessageProtocol.buildSuccess("Nota de voz enviada al grupo " + target + " (" + sentCount + " miembros)"));
                out.flush();
                
                System.out.println("[🎤] " + username + " → [GRUPO: " + target + "] (audio: " + voiceMsg.getAudioData().length + " bytes)");
                
            } else {
                // Send voice note to user
                ObjectOutputStream targetOut = clients.get(target);
                
                if (targetOut != null) {
                    System.out.println("[🎤] " + username + " → " + target + " (audio: " + voiceMsg.getAudioData().length + " bytes)");
                    
                    history.saveVoiceMessage(username, target, voiceMsg.getAudioData(), false);
                    
                    targetOut.writeObject(voiceMsg);
                    targetOut.flush();

                    out.writeObject(MessageProtocol.buildSuccess("Nota de voz enviada a " + target));
                    out.flush();
                } else {
                    out.writeObject(MessageProtocol.buildError("Usuario " + target + " no conectado"));
                    out.flush();
                    
                    history.saveVoiceMessage(username, target, voiceMsg.getAudioData(), false);
                }
            }
        } catch (IOException e) {
            System.err.println("Error enviando nota de voz: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendTextToUser(String targetUser, String message) throws IOException {
        ObjectOutputStream targetOut = clients.get(targetUser);
        if (targetOut != null) {
            targetOut.writeObject("[" + username + "]: " + message);
            targetOut.flush();

            out.writeObject(MessageProtocol.buildSuccess("Mensaje enviado a " + targetUser));
            out.flush();

            history.saveMessage(username, targetUser, MessageProtocol.TYPE_TEXT, message, false);
        } else {
            out.writeObject(MessageProtocol.buildError("Usuario " + targetUser + " no conectado"));
            out.flush();
        }
    }

    private void sendTextToGroup(String groupName, String message) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject(MessageProtocol.buildError("El grupo " + groupName + " no existe"));
            out.flush();
            return;
        }

        List<String> members = history.getGroupMembers(groupName);
        if (!members.contains(username)) {
            out.writeObject(MessageProtocol.buildError("No eres miembro del grupo " + groupName));
            out.flush();
            return;
        }

        int sentCount = 0;
        for (String member : members) {
            if (!member.equals(username)) {
                ObjectOutputStream memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.writeObject("[" + groupName + "] " + username + ": " + message);
                    memberOut.flush();
                    sentCount++;
                }
            }
        }
        
        out.writeObject(MessageProtocol.buildSuccess("Mensaje enviado al grupo " + groupName + " (" + sentCount + " miembros)"));
        out.flush();
        history.saveMessage(username, groupName, MessageProtocol.TYPE_TEXT, message, true);
    }

    private void createGroup(String groupName) throws IOException {
        if (history.createGroup(groupName, username)) {
            out.writeObject(MessageProtocol.buildSuccess("Grupo '" + groupName + "' creado exitosamente"));
            out.flush();
        } else {
            out.writeObject(MessageProtocol.buildError("El grupo '" + groupName + "' ya existe"));
            out.flush();
        }
    }

    private void joinGroup(String groupName) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject(MessageProtocol.buildError("El grupo '" + groupName + "' no existe"));
            out.flush();
            return;
        }

        if (history.addUserToGroup(groupName, username)) {
            out.writeObject(MessageProtocol.buildSuccess("Te has unido al grupo '" + groupName + "'"));
            out.flush();
            
            // Notify group members
            List<String> members = history.getGroupMembers(groupName);
            for (String member : members) {
                if (!member.equals(username)) {
                    ObjectOutputStream memberOut = clients.get(member);
                    if (memberOut != null) {
                        memberOut.writeObject(MessageProtocol.buildInfo(username + " se ha unido al grupo " + groupName));
                        memberOut.flush();
                    }
                }
            }
        } else {
            out.writeObject(MessageProtocol.buildError("Error al unirse al grupo"));
            out.flush();
        }
    }

    private void leaveGroup(String groupName) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject(MessageProtocol.buildError("El grupo '" + groupName + "' no existe"));
            out.flush();
            return;
        }

        if (history.removeUserFromGroup(groupName, username)) {
            out.writeObject(MessageProtocol.buildSuccess("Has salido del grupo '" + groupName + "'"));
            out.flush();
            
            // Notify remaining members
            List<String> members = history.getGroupMembers(groupName);
            for (String member : members) {
                ObjectOutputStream memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.writeObject(MessageProtocol.buildInfo(username + " ha salido del grupo " + groupName));
                    memberOut.flush();
                }
            }
        } else {
            out.writeObject(MessageProtocol.buildError("No eres miembro del grupo '" + groupName + "'"));
            out.flush();
        }
    }

    private void listGroups() throws IOException {
        Set<String> groups = history.getAllGroups();
        if (groups.isEmpty()) {
            out.writeObject(MessageProtocol.buildInfo("No hay grupos creados"));
        } else {
            StringBuilder sb = new StringBuilder("Grupos disponibles:\n");
            for (String group : groups) {
                List<String> members = history.getGroupMembers(group);
                sb.append("  - ").append(group).append(" (").append(members.size()).append(" miembros)\n");
            }
            out.writeObject(sb.toString());
        }
        out.flush();
    }

    private void listGroupMembers(String groupName) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject(MessageProtocol.buildError("El grupo '" + groupName + "' no existe"));
            out.flush();
            return;
        }

        List<String> members = history.getGroupMembers(groupName);
        StringBuilder sb = new StringBuilder("Miembros del grupo '" + groupName + "':\n");
        for (String member : members) {
            String status = clients.containsKey(member) ? " (online)" : " (offline)";
            sb.append("  - ").append(member).append(status).append("\n");
        }
        out.writeObject(sb.toString());
        out.flush();
    }

    private void viewHistory(String otherUser) throws IOException {
        List<HistoryManager.ChatMessage> messages = history.getConversationHistory(username, otherUser);
        
        if (messages.isEmpty()) {
            out.writeObject(MessageProtocol.buildInfo("No hay historial con " + otherUser));
        } else {
            StringBuilder sb = new StringBuilder("Historial con " + otherUser + ":\n");
            sb.append("═══════════════════════════════════════\n");
            for (HistoryManager.ChatMessage msg : messages) {
                String direction = msg.sender.equals(username) ? "→" : "←";
                String content = msg.type.equals("VOICE") ? "🎤 [NOTA DE VOZ]" : msg.content;
                sb.append(String.format("[%s] %s %s: %s\n", msg.timestamp, direction, msg.sender, content));
            }
            sb.append("═══════════════════════════════════════");
            out.writeObject(sb.toString());
        }
        out.flush();
    }

    private void viewGroupHistory(String groupName) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject(MessageProtocol.buildError("El grupo '" + groupName + "' no existe"));
            out.flush();
            return;
        }

        List<HistoryManager.ChatMessage> messages = history.getGroupHistory(groupName);
        
        if (messages.isEmpty()) {
            out.writeObject(MessageProtocol.buildInfo("No hay historial en el grupo " + groupName));
        } else {
            StringBuilder sb = new StringBuilder("Historial del grupo " + groupName + ":\n");
            sb.append("═══════════════════════════════════════\n");
            for (HistoryManager.ChatMessage msg : messages) {
                String content = msg.type.equals("VOICE") ? "🎤 [NOTA DE VOZ]" : msg.content;
                sb.append(String.format("[%s] %s: %s\n", msg.timestamp, msg.sender, content));
            }
            sb.append("═══════════════════════════════════════");
            out.writeObject(sb.toString());
        }
        out.flush();
    }

    private void listUsers() throws IOException {
        StringBuilder sb = new StringBuilder("Usuarios conectados:\n");
        for (String user : clients.keySet()) {
            if (!user.equals(username)) {
                sb.append("  - ").append(user).append("\n");
            }
        }
        out.writeObject(sb.toString());
        out.flush();
    }

    private void broadcast(String message) throws IOException {
        for (ObjectOutputStream writer : clients.values()) {
            writer.writeObject(message);
            writer.flush();
        }
    }

    private void disconnect() {
        if (username != null) {
            clients.remove(username);
            try {
                broadcast(MessageProtocol.buildInfo(username + " se ha desconectado"));
            } catch (IOException e) {
                e.printStackTrace();
            }
            System.out.println("[-] " + username + " desconectado");
        }
        try { socket.close(); } catch (IOException e) { e.printStackTrace(); }
    }
}
