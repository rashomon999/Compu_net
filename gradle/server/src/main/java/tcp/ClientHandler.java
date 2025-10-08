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

                out.writeObject("Registrado como " + username);
                out.flush();
                broadcast("[Servidor]: " + username + " se ha unido al chat");
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
                    // ✅ CORRECTO: Recibir y reenviar VoiceMessage directamente
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

    // ✅ NUEVO: Procesar VoiceMessage como objeto
    private void processVoiceMessage(VoiceMessage voiceMsg) {
        try {
            String targetUser = voiceMsg.getTarget();
            ObjectOutputStream targetOut = clients.get(targetUser);
            
            if (targetOut != null) {
                System.out.println("[🎤] " + username + " → " + targetUser + 
                                 " (audio: " + voiceMsg.getAudioData().length + " bytes)");
                
                // Reenviar el VoiceMessage directamente
                targetOut.writeObject(voiceMsg);
                targetOut.flush();

                out.writeObject("✅ Nota de voz enviada a " + targetUser);
                out.flush();

                history.saveMessage(username, targetUser, "VOICE",
                        "[Audio " + voiceMsg.getAudioData().length + " bytes]", false);
            } else {
                out.writeObject("ERROR: Usuario " + targetUser + " no conectado");
                out.flush();
            }
        } catch (IOException e) {
            System.err.println("Error enviando nota de voz: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // ==========================
    // Métodos auxiliares
    // ==========================

    private void sendTextToUser(String targetUser, String message) throws IOException {
        ObjectOutputStream targetOut = clients.get(targetUser);
        if (targetOut != null) {
            targetOut.writeObject("[" + username + "]: " + message);
            targetOut.flush();

            out.writeObject("Mensaje enviado a " + targetUser);
            out.flush();

            history.saveMessage(username, targetUser, "TEXT", message, false);
        } else {
            out.writeObject("ERROR: Usuario " + targetUser + " no conectado");
            out.flush();
        }
    }

    private void sendTextToGroup(String groupName, String message) throws IOException {
        List<String> members = history.getGroupMembers(groupName);
        for (String member : members) {
            if (!member.equals(username)) {
                ObjectOutputStream memberOut = clients.get(member);
                if (memberOut != null) {
                    memberOut.writeObject("[" + groupName + "] " + username + ": " + message);
                    memberOut.flush();
                }
            }
        }
        out.writeObject("Mensaje enviado al grupo " + groupName);
        out.flush();
        history.saveMessage(username, groupName, "TEXT", message, true);
    }

    private void listUsers() throws IOException {
        String userList = String.join(", ", clients.keySet());
        out.writeObject("Usuarios conectados: " + (userList.isEmpty() ? "Ninguno" : userList));
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
                broadcast(username + " se ha desconectado");
            } catch (IOException e) {
                e.printStackTrace();
            }
            System.out.println("[-] " + username + " desconectado");
        }
        try { socket.close(); } catch (IOException e) { e.printStackTrace(); }
    }
}