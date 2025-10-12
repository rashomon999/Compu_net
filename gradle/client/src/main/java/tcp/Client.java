package tcp;

import java.io.*;
import java.net.Socket;
import java.util.Scanner;

import udp.UDPVoiceClient;

import utils.AudioCapturer;
import utils.AudioPlayer;
 
import utils.VoiceMessage;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public class Client {

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        System.out.print("IP del servidor (Enter para localhost): ");
        String hostInput = sc.nextLine().trim();
        String host = hostInput.isEmpty() ? "localhost" : hostInput;
        int tcpPort = 9090;

        try (Socket socket = new Socket(host, tcpPort)) {
            System.out.println("✓ Conectado al servidor " + host + ":" + tcpPort);

            ObjectOutputStream out = new ObjectOutputStream(socket.getOutputStream());
            ObjectInputStream in = new ObjectInputStream(socket.getInputStream());

            // Leer mensaje inicial del servidor
            Object serverMsg = in.readObject();
            System.out.println(serverMsg);

            // Registrar nombre de usuario
            System.out.print("Tu nombre de usuario: ");
            String username = sc.nextLine();
            out.writeObject("REGISTER " + username);
            out.flush();

            // Leer respuesta de registro
            Object response = in.readObject();
            System.out.println(response);
            
            // Si hay error en el registro, salir
            if (response.toString().startsWith("ERROR")) {
                socket.close();
                sc.close();
                return;
            }

            // Inicializar cliente UDP para llamadas
            UDPVoiceClient voiceClient = new UDPVoiceClient(username, host);
            
            // Cola de mensajes recibidos desde el servidor
            BlockingQueue<String> incoming = new LinkedBlockingQueue<>();

            // Hilo para escuchar mensajes entrantes
            new Thread(() -> {
                try {
                    Object obj;
                    while ((obj = in.readObject()) != null) {
                        if (obj instanceof String text) {
                            incoming.add(text);
                        } else if (obj instanceof VoiceMessage vm) {
                            String groupTag = vm.isGroup() ? "[GRUPO: " + vm.getTarget() + "] " : "";
                            incoming.add("\n🎤 " + groupTag + "Nota de voz de " + vm.getSender() +
                                        " (" + vm.getAudioData().length + " bytes)");
                            AudioPlayer.playAudio(vm.getAudioData());
                        }
                    }
                } catch (Exception e) {
                    incoming.add("✗ Conexión cerrada por el servidor.");
                }
            }).start();

            // Bucle principal del menú
            boolean running = true;
            while (running) {
                // Mostrar mensajes pendientes
                while (!incoming.isEmpty()) {
                    System.out.println(incoming.poll());
                }

                showMainMenu();
                String option = sc.nextLine().trim();

                switch (option) {
                    case "1" -> sendTextMessage(sc, out, username);
                    case "2" -> sendTextToGroup(sc, out, username);
                    case "3" -> sendVoiceNote(sc, out, username);
                    case "4" -> sendVoiceNoteToGroup(sc, out, username);
                    case "5" -> startCall(sc, voiceClient);
                    case "6" -> startGroupCall(sc, voiceClient);
                    case "7" -> voiceClient.endCall();
                    case "8" -> manageGroups(sc, out);
                    case "9" -> viewHistory(sc, out);
                    case "10" -> listUsers(out);
                    case "0" -> {
                        System.out.println("\n✓ Saliendo del chat...");
                        voiceClient.close();
                        running = false;
                    }
                    default -> System.out.println("✗ Opción inválida.");
                }
                
                // Pequeña pausa para mostrar mensajes entrantes
                Thread.sleep(100);
            }

            socket.close();
            sc.close();

        } catch (Exception e) {
            System.err.println("✗ Error en el cliente: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void showMainMenu() {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║         COMPUNET - CHAT MENU          ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("  MENSAJES");
        System.out.println("  1. Enviar mensaje de texto a usuario");
        System.out.println("  2. Enviar mensaje de texto a grupo");
        System.out.println("  3. Enviar nota de voz a usuario");
        System.out.println("  4. Enviar nota de voz a grupo");
        System.out.println("\n  LLAMADAS");
        System.out.println("  5. Iniciar llamada de voz (1-a-1)");
        System.out.println("  6. Iniciar llamada grupal");
        System.out.println("  7. Finalizar llamada");
        System.out.println("\n  GESTIÓN");
        System.out.println("  8. Gestionar grupos");
        System.out.println("  9. Ver historial");
        System.out.println("  10. Listar usuarios conectados");
        System.out.println("  0. Salir");
        System.out.print("\n> Opción: ");
    }

    private static void sendTextMessage(Scanner sc, ObjectOutputStream out, String username) throws IOException {
        System.out.print("\n→ Destinatario: ");
        String target = sc.nextLine().trim();
        if (target.isEmpty()) {
            System.out.println("✗ Destinatario no puede estar vacío");
            return;
        }
        
        System.out.print("→ Mensaje: ");
        String message = sc.nextLine().trim();
        if (message.isEmpty()) {
            System.out.println("✗ Mensaje no puede estar vacío");
            return;
        }

        out.writeObject("MSG_USER " + target + " " + message);
        out.flush();
    }

    private static void sendTextToGroup(Scanner sc, ObjectOutputStream out, String username) throws IOException {
        System.out.print("\n→ Nombre del grupo: ");
        String groupName = sc.nextLine().trim();
        if (groupName.isEmpty()) {
            System.out.println("✗ Nombre del grupo no puede estar vacío");
            return;
        }
        
        System.out.print("→ Mensaje: ");
        String message = sc.nextLine().trim();
        if (message.isEmpty()) {
            System.out.println("✗ Mensaje no puede estar vacío");
            return;
        }

        out.writeObject("MSG_GROUP " + groupName + " " + message);
        out.flush();
    }

    private static void sendVoiceNote(Scanner sc, ObjectOutputStream out, String username) throws IOException {
        System.out.print("\n→ Destinatario: ");
        String target = sc.nextLine().trim();
        if (target.isEmpty()) {
            System.out.println("✗ Destinatario no puede estar vacío");
            return;
        }
        
        System.out.print("→ Duración en segundos (max 30): ");
        String durationStr = sc.nextLine().trim();
        int duration;
        try {
            duration = Integer.parseInt(durationStr);
            if (duration <= 0 || duration > 30) {
                System.out.println("✗ Duración debe estar entre 1 y 30 segundos");
                return;
            }
        } catch (NumberFormatException e) {
            System.out.println("✗ Duración inválida");
            return;
        }

        System.out.println("\n🎤 Grabando nota de voz...");
        byte[] audioData = AudioCapturer.captureAudio(duration);
        
        if (audioData != null && audioData.length > 0) {
            System.out.println("✓ Grabación completada (" + audioData.length + " bytes), enviando...");
            
            VoiceMessage voiceMsg = new VoiceMessage(username, target, audioData, false);
            out.writeObject(voiceMsg);
            out.flush();
            
            System.out.println("✓ Nota de voz enviada");
        } else {
            System.out.println("✗ Error al grabar audio");
        }
    }

    private static void sendVoiceNoteToGroup(Scanner sc, ObjectOutputStream out, String username) throws IOException {
        System.out.print("\n→ Nombre del grupo: ");
        String groupName = sc.nextLine().trim();
        if (groupName.isEmpty()) {
            System.out.println("✗ Nombre del grupo no puede estar vacío");
            return;
        }
        
        System.out.print("→ Duración en segundos (max 30): ");
        String durationStr = sc.nextLine().trim();
        int duration;
        try {
            duration = Integer.parseInt(durationStr);
            if (duration <= 0 || duration > 30) {
                System.out.println("✗ Duración debe estar entre 1 y 30 segundos");
                return;
            }
        } catch (NumberFormatException e) {
            System.out.println("✗ Duración inválida");
            return;
        }

        System.out.println("\n🎤 Grabando nota de voz para el grupo...");
        byte[] audioData = AudioCapturer.captureAudio(duration);
        
        if (audioData != null && audioData.length > 0) {
            System.out.println("✓ Grabación completada (" + audioData.length + " bytes), enviando...");
            
            VoiceMessage voiceMsg = new VoiceMessage(username, groupName, audioData, true);
            out.writeObject(voiceMsg);
            out.flush();
            
            System.out.println("✓ Nota de voz enviada al grupo");
        } else {
            System.out.println("✗ Error al grabar audio");
        }
    }

    private static void startCall(Scanner sc, UDPVoiceClient voiceClient) {
        System.out.print("\n→ Usuario a llamar: ");
        String targetUser = sc.nextLine().trim();
        if (targetUser.isEmpty()) {
            System.out.println("✗ Usuario no puede estar vacío");
            return;
        }
        voiceClient.startCall(targetUser);
    }

    private static void startGroupCall(Scanner sc, UDPVoiceClient voiceClient) {
        System.out.print("\n→ Nombre del grupo: ");
        String groupName = sc.nextLine().trim();
        if (groupName.isEmpty()) {
            System.out.println("✗ Nombre del grupo no puede estar vacío");
            return;
        }
        voiceClient.startGroupCall(groupName);
    }

    private static void manageGroups(Scanner sc, ObjectOutputStream out) throws IOException {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║         GESTIÓN DE GRUPOS             ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("  1. Crear grupo");
        System.out.println("  2. Unirse a grupo");
        System.out.println("  3. Salir de grupo");
        System.out.println("  4. Listar grupos");
        System.out.println("  5. Ver miembros de grupo");
        System.out.println("  0. Volver");
        System.out.print("\n> Opción: ");
        
        String option = sc.nextLine().trim();
        
        switch (option) {
            case "1" -> {
                System.out.print("\n→ Nombre del nuevo grupo: ");
                String groupName = sc.nextLine().trim();
                if (!groupName.isEmpty()) {
                    out.writeObject("CREATE_GROUP " + groupName);
                    out.flush();
                }
            }
            case "2" -> {
                System.out.print("\n→ Nombre del grupo: ");
                String groupName = sc.nextLine().trim();
                if (!groupName.isEmpty()) {
                    out.writeObject("JOIN_GROUP " + groupName);
                    out.flush();
                }
            }
            case "3" -> {
                System.out.print("\n→ Nombre del grupo: ");
                String groupName = sc.nextLine().trim();
                if (!groupName.isEmpty()) {
                    out.writeObject("LEAVE_GROUP " + groupName);
                    out.flush();
                }
            }
            case "4" -> {
                out.writeObject("LIST_GROUPS");
                out.flush();
            }
            case "5" -> {
                System.out.print("\n→ Nombre del grupo: ");
                String groupName = sc.nextLine().trim();
                if (!groupName.isEmpty()) {
                    out.writeObject("LIST_GROUP_MEMBERS " + groupName);
                    out.flush();
                }
            }
            case "0" -> {
                // Volver al menú principal
            }
            default -> System.out.println("✗ Opción inválida");
        }
    }

    private static void viewHistory(Scanner sc, ObjectOutputStream out) throws IOException {
        System.out.println("\n╔════════════════════════════════════════╗");
        System.out.println("║            VER HISTORIAL              ║");
        System.out.println("╚════════════════════════════════════════╝");
        System.out.println("  1. Historial con usuario");
        System.out.println("  2. Historial de grupo");
        System.out.println("  0. Volver");
        System.out.print("\n> Opción: ");
        
        String option = sc.nextLine().trim();
        
        switch (option) {
            case "1" -> {
                System.out.print("\n→ Usuario: ");
                String user = sc.nextLine().trim();
                if (!user.isEmpty()) {
                    out.writeObject("VIEW_HISTORY " + user);
                    out.flush();
                }
            }
            case "2" -> {
                System.out.print("\n→ Grupo: ");
                String group = sc.nextLine().trim();
                if (!group.isEmpty()) {
                    out.writeObject("VIEW_GROUP_HISTORY " + group);
                    out.flush();
                }
            }
            case "0" -> {
                // Volver al menú principal
            }
            default -> System.out.println("✗ Opción inválida");
        }
    }

    private static void listUsers(ObjectOutputStream out) throws IOException {
        out.writeObject("LIST_USERS");
        out.flush();
    }
}
