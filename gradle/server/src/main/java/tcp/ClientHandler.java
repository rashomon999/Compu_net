package tcp;

import utils.HistoryManager;
import utils.VoiceMessage;

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
            out.writeObject("Ingresa tu nombre de usuario:");
            out.flush();

            Object inputObj = in.readObject();
            if (inputObj instanceof String input && input.startsWith("REGISTER ")) {
                username = input.split(" ", 2)[1].trim();
                if (username.isEmpty() || clients.containsKey(username)) {
                    out.writeObject("ERROR: Nombre de usuario inválido o ya en uso");
                    out.flush();
                    socket.close();
                    return;
                }

                synchronized (clients) {
                    clients.put(username, out);
                }


                // 🔹 Esperar un momento para que el servidor muestre sus mensajes antes del menú
            try {
            Thread.sleep(1500); // 1.5 segundos
            } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            }

            out.writeObject("Registrado como " + username);
            out.flush();

                
             

            //broadcast("[Servidor]: " + username + " se ha unido al chat");
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
                case "MSG_USER":
                    if (parts.length >= 3) sendTextToUser(parts[1], parts[2]);
                    break;

                case "MSG_GROUP":
                    if (parts.length >= 3) sendTextToGroup(parts[1], parts[2]);
                    break;

                case "LIST_USERS":
                    listUsers();
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

                case "LIST_GROUP_MEMBERS":
                    if (parts.length >= 2) listGroupMembers(parts[1]);
                    break;

                default:
                    out.writeObject("ERROR: Comando desconocido '" + cmd + "'");
                    out.flush();
            }
        } catch (Exception e) {
            try {
                out.writeObject("ERROR: " + e.getMessage());
                out.flush();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
        }
    }

    // ================== MENSAJES DE TEXTO ==================

    private void sendTextToUser(String targetUser, String message) throws IOException {
        ObjectOutputStream targetOut = clients.get(targetUser);
        if (targetOut != null) {
            targetOut.writeObject("[" + username + "]: " + message);
            targetOut.flush();

            
        // 🔹 Esperar un momento para que el servidor muestre sus mensajes antes del menú
            try {
            Thread.sleep(1500); // 1.5 segundos
            } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            }

            out.writeObject("✅ Mensaje enviado a " + targetUser);
            out.flush();

            history.saveMessage(username, targetUser, "TEXT", message, false);
        } else {
            out.writeObject("❌ ERROR: Usuario " + targetUser + " no conectado");
            out.flush();
        }
    }

    private void sendTextToGroup(String groupName, String message) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject("❌ ERROR: Grupo " + groupName + " no existe");
            out.flush();
            return;
        }

        List<String> members = history.getGroupMembers(groupName);
        int sent = 0;

        for (String member : members) {
            if (!member.equals(username)) {
                ObjectOutputStream memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.writeObject("[" + groupName + "] " + username + ": " + message);
                    memberOut.flush();
                    sent++;
                }
            }
        }

        out.writeObject("✅ Mensaje enviado a " + groupName + " (" + sent + " miembros conectados)");
        out.flush();

        history.saveMessage(username, groupName, "TEXT", message, true);
    }

    // ================== MENSAJES DE VOZ ==================

    private void processVoiceMessage(VoiceMessage voiceMsg) {
        try {
            String target = voiceMsg.getTarget();
            
            // Detectar si es un grupo o un usuario
            if (history.groupExists(target)) {
                // Es un grupo
                processGroupVoiceMessage(voiceMsg, target);
            } else {
                // Es un usuario
                processUserVoiceMessage(voiceMsg, target);
            }
        } catch (IOException e) {
            System.err.println("Error enviando nota de voz: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void processUserVoiceMessage(VoiceMessage voiceMsg, String targetUser) throws IOException {
        ObjectOutputStream targetOut = clients.get(targetUser);

        System.out.println("[🎤] " + username + " → " + targetUser +
                " (audio: " + voiceMsg.getAudioData().length + " bytes)");

        // Guardar en historial
        history.saveVoiceMessage(username, targetUser, voiceMsg.getAudioData(), false);

        if (targetOut != null) {
            targetOut.writeObject(voiceMsg);
            targetOut.flush();
            out.writeObject("✅ Nota de voz enviada a " + targetUser);
        } else {
            out.writeObject("⚠️  Usuario " + targetUser + " no conectado (guardado en historial)");
        }

        out.flush();
    }

    private void processGroupVoiceMessage(VoiceMessage voiceMsg, String groupName) throws IOException {
        List<String> members = history.getGroupMembers(groupName);
        int sent = 0;

        System.out.println("[🎤] " + username + " → GRUPO " + groupName +
                " (audio: " + voiceMsg.getAudioData().length + " bytes)");

        for (String member : members) {
            if (!member.equals(username)) {
                ObjectOutputStream memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.writeObject(voiceMsg);
                    memberOut.flush();
                    sent++;
                }
            }
        }

        // Guardar en historial
        history.saveVoiceMessage(username, groupName, voiceMsg.getAudioData(), true);

        out.writeObject("✅ Nota de voz enviada al grupo " + groupName + " (" + sent + " miembros)");
        out.flush();
    }

    // ================== GESTIÓN DE GRUPOS ==================

    private void createGroup(String groupName) throws IOException {
        if (history.createGroup(groupName, username)) {
            out.writeObject("✅ Grupo '" + groupName + "' creado exitosamente");
            broadcast("[Servidor]: " + username + " creó el grupo " + groupName);
        } else {
            out.writeObject("❌ ERROR: El grupo '" + groupName + "' ya existe");
        }
        out.flush();
    }

    private void joinGroup(String groupName) throws IOException {
        if (history.groupExists(groupName)) {
            if (history.addUserToGroup(groupName, username)) {
                out.writeObject("✅ Te has unido al grupo '" + groupName + "'");
                broadcastToGroup(groupName, "[Servidor]: " + username + " se unió al grupo");
            } else {
                out.writeObject("⚠️  Ya eres miembro del grupo '" + groupName + "'");
            }
        } else {
            out.writeObject("❌ ERROR: El grupo '" + groupName + "' no existe");
        }
        out.flush();
    }

    private void listGroups() throws IOException {
        Set<String> groups = history.getAllGroups();
        
        if (groups.isEmpty()) {
            out.writeObject("No hay grupos disponibles");
        } else {
            StringBuilder sb = new StringBuilder("📁 Grupos disponibles:\n");
            for (String group : groups) {
                List<String> members = history.getGroupMembers(group);
                sb.append("  • ").append(group).append(" (").append(members.size()).append(" miembros)\n");
            }
            out.writeObject(sb.toString());
        }
        out.flush();
    }

    private void listGroupMembers(String groupName) throws IOException {
        if (!history.groupExists(groupName)) {
            out.writeObject("❌ ERROR: El grupo '" + groupName + "' no existe");
        } else {
            List<String> members = history.getGroupMembers(groupName);
            StringBuilder sb = new StringBuilder("👥 Miembros de '" + groupName + "':\n");
            for (String member : members) {
                String status = clients.containsKey(member) ? "🟢 online" : "🔴 offline";
                sb.append("  • ").append(member).append(" ").append(status).append("\n");
            }
            out.writeObject(sb.toString());
        }
        out.flush();
    }

    // ================== UTILIDADES ==================

    private void listUsers() throws IOException {
        String userList = String.join(", ", clients.keySet());
        out.writeObject("👥 Usuarios conectados: " + (userList.isEmpty() ? "Ninguno" : userList));
        out.flush();
    }

    private void broadcast(String message) throws IOException {
    // Solo enviar mensajes del servidor
    if (!message.startsWith("[Servidor]:")) {
        return; // Evitar difundir mensajes de usuarios
    }

    for (ObjectOutputStream writer : clients.values()) {
        writer.writeObject(message);
        writer.flush();
    }
    }


    private void broadcastToGroup(String groupName, String message) throws IOException {
    List<String> members = history.getGroupMembers(groupName);
    if (members == null || members.isEmpty()) {
        return; // Ningún miembro en el grupo
    }

    for (String member : members) {
        ObjectOutputStream memberOut = clients.get(member);
        if (memberOut != null) {
            memberOut.writeObject(message);
            memberOut.flush();
        }
    }
    }


    private void disconnect() {
        if (username != null) {
            clients.remove(username);
            try {
                broadcast("[Servidor]: " + username + " se desconectó");
            } catch (IOException e) {
                e.printStackTrace();
            }
            System.out.println("[-] " + username + " desconectado");
        }
        try { socket.close(); } catch (IOException e) { e.printStackTrace(); }
        }
    }