package tcp;

import utils.HistoryManager;
import java.io.*;
import java.net.Socket;
import java.util.*;

public class ClientHandler implements Runnable {
    private Socket socket;
    private String username;
    private PrintWriter out;
    private BufferedReader in;
    private Map<String, PrintWriter> clients;
    private HistoryManager history;

    public ClientHandler(Socket socket, Map<String, PrintWriter> clients, HistoryManager history) {
        this.socket = socket;
        this.clients = clients;
        this.history = history;
    }

    @Override
    public void run() {
        try {
            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);

            // Solicitar y registrar nombre de usuario
            out.println("Ingresa tu nombre de usuario:");
            String input = in.readLine();
            if (input != null && input.startsWith("REGISTER ")) {
                username = input.split(" ", 2)[1].trim();
                if (username.isEmpty() || clients.containsKey(username)) {
                    out.println(" ERROR: Nombre de usuario inválido o ya en uso");
                    socket.close();
                    return;
                }
                synchronized (clients) {
                    clients.put(username, out);
                }
                out.println(" Registrado como " + username);
                broadcast(username + " se ha unido al chat");
            } else {
                socket.close();
                return;
            }

            System.out.println("[+] " + username + " conectado desde " + socket.getInetAddress());

            // Procesar comandos
            String line;
            while ((line = in.readLine()) != null) {
                processCommand(line);
            }

        } catch (IOException e) {
            System.err.println("Error con cliente " + username);
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
                case "CREATE_GROUP":
                    if (parts.length >= 2) {
                        String groupName = parts[1];
                        boolean created = history.createGroup(groupName, username);
                        if (created) {
                            out.println(" Grupo '" + groupName + "' creado exitosamente");
                        } else {
                            out.println(" ERROR: El grupo '" + groupName + "' ya existe");
                        }
                    }
                    break;

                case "ADD_TO_GROUP":
                    if (parts.length >= 3) {
                        String groupName = parts[1];
                        String userToAdd = parts[2];
                        if (history.groupExists(groupName)) {
                            history.addUserToGroup(groupName, userToAdd);
                            out.println("Usuario " + userToAdd + " añadido a " + groupName);
                            PrintWriter targetOut = clients.get(userToAdd);
                            if (targetOut != null) {
                                targetOut.println(" Has sido añadido al grupo: " + groupName);
                            }
                        } else {
                            out.println(" ERROR: El grupo no existe");
                        }
                    }
                    break;

                case "MSG_USER":
                    if (parts.length >= 3) {
                        String targetUser = parts[1];
                        String message = parts[2];
                        PrintWriter targetOut = clients.get(targetUser);
                        if (targetOut != null) {
                            targetOut.println(" [" + username + "]: " + message);
                            out.println(" Mensaje enviado a " + targetUser);
                            history.saveMessage(username, targetUser, "TEXT", message, false);
                        } else {
                            out.println(" ERROR: Usuario " + targetUser + " no conectado");
                        }
                    }
                    break;

                case "MSG_GROUP":
                    if (parts.length >= 3) {
                        String groupName = parts[1];
                        String message = parts[2];
                        List<String> members = history.getGroupMembers(groupName);
                        if (!members.isEmpty()) {
                            for (String member : members) {
                                if (!member.equals(username)) {
                                    PrintWriter memberOut = clients.get(member);
                                    if (memberOut != null) {
                                        memberOut.println("👥 [" + groupName + "] " + username + ": " + message);
                                    }
                                }
                            }
                            out.println("Mensaje enviado al grupo " + groupName);
                            history.saveMessage(username, groupName, "TEXT", message, true);
                        } else {
                            out.println(" ERROR: El grupo no existe o está vacío");
                        }
                    }
                    break;

                case "VOICE_USER":
                    if (parts.length >= 3) {
                        String targetUser = parts[1];
                        String audioBase64 = parts[2];
                        PrintWriter targetOut = clients.get(targetUser);
                        if (targetOut != null) {
                            targetOut.println("VOICE_FROM " + username + " " + audioBase64);
                            out.println(" Nota de voz enviada a " + targetUser);
                            history.saveMessage(username, targetUser, "VOICE", "[Audio " + audioBase64.length() + " bytes]", false);
                        } else {
                            out.println(" ERROR: Usuario no conectado");
                        }
                    }
                    break;

                case "VOICE_GROUP":
                    if (parts.length >= 3) {
                        String groupName = parts[1];
                        String audioBase64 = parts[2];
                        List<String> members = history.getGroupMembers(groupName);
                        if (!members.isEmpty()) {
                            for (String member : members) {
                                if (!member.equals(username)) {
                                    PrintWriter memberOut = clients.get(member);
                                    if (memberOut != null) {
                                        memberOut.println("VOICE_FROM " + username + " " + audioBase64);
                                    }
                                }
                            }
                            out.println(" Nota de voz enviada al grupo " + groupName);
                            history.saveMessage(username, groupName, "VOICE", "[Audio " + audioBase64.length() + " bytes]", true);
                        } else {
                            out.println(" ERROR: El grupo no existe");
                        }
                    }
                    break;

                case "GET_HISTORY":
                    if (parts.length >= 2) {
                        String target = parts[1];
                        List<HistoryManager.ChatMessage> msgs;
                        if (history.groupExists(target)) {
                            msgs = history.getGroupHistory(target);
                        } else {
                            msgs = history.getConversationHistory(username, target);
                        }
                        out.println("\n╔════════════════════════════════════╗");
                        out.println("║   HISTORIAL CON " + target);
                        out.println("╚════════════════════════════════════╝");
                        if (msgs.isEmpty()) {
                            out.println("No hay mensajes registrados");
                        } else {
                            for (HistoryManager.ChatMessage msg : msgs) {
                                out.println(msg.toString());
                            }
                        }
                        out.println("════════════════════════════════════");
                    }
                    break;

                case "ADD_USER":
                    if (parts.length >= 2) {
                        String newUser = parts[1];
                        if (!clients.containsKey(newUser)) {
                            out.println(" ERROR: El usuario " + newUser + " no está conectado");
                        } else {
                            // Aquí podrías agregar lógica para invitar o notificar al usuario
                            out.println(" Usuario " + newUser + " está disponible para interacción");
                            PrintWriter targetOut = clients.get(newUser);
                            if (targetOut != null) {
                                targetOut.println( username + " te ha agregado como contacto");
                            }
                        }
                    }
                    break;

                case "LIST_USERS":
                    String userList = String.join(", ", clients.keySet());
                    out.println("👥 Usuarios conectados: " + (userList.isEmpty() ? "Ninguno" : userList));
                    break;

                default:
                    out.println(" ERROR: Comando desconocido '" + cmd + "'");
            }
        } catch (Exception e) {
            out.println(" ERROR: " + e.getMessage());
        }
    }

    private void broadcast(String message) {
        for (PrintWriter writer : clients.values()) {
            writer.println(message);
        }
    }

    private void disconnect() {
        if (username != null) {
            clients.remove(username);
            broadcast(username + " se ha desconectado");
            System.out.println("[-] " + username + " desconectado");
        }
        try {
            socket.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}