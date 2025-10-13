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
            // Hilo para escuchar mensajes entrantes
// Hilo para escuchar mensajes entrantes (no imprime, solo guarda en la cola)
new Thread(() -> {
    try {
        Object obj;
        while ((obj = in.readObject()) != null) {
            if (obj instanceof String text) {
                incoming.add(text);
            } else if (obj instanceof VoiceMessage vm) {
                incoming.add(" Nota de voz de " + vm.getSender() +
                            " (" + vm.getAudioData().length + " bytes)");
                AudioPlayer.playAudio(vm.getAudioData());
            }
        }
    } catch (Exception e) {
        incoming.add(" Conexión cerrada por el servidor.");
    }
}).start();


            // Bucle principal del menú
            boolean running = true;
            while (running) {
                // Mostrar mensajes pendientes
                while (!incoming.isEmpty()) {
                    System.out.println(incoming.poll());
                }

                System.out.println("\n╔════════════════════════════════╗");
                System.out.println("║         MENÚ PRINCIPAL         ║");
                System.out.println("╚════════════════════════════════╝");
                System.out.println("1. Enviar mensaje de texto");
                System.out.println("2. Enviar nota de voz (grabada)");
                System.out.println("3. Iniciar llamada en tiempo real");
                System.out.println("4. Finalizar llamada");
                System.out.println("5. Listar usuarios conectados");
                System.out.println("6. Historial");
                System.out.println("7. Reproducir audio");
                System.out.println("8. Eliminar mi historial");   
                System.out.println("9. Salir");                    
                System.out.print("\n> Elige una opción: ");
                
                String option = sc.nextLine();

                switch (option) {
                    case "1" -> {
                        System.out.print("Destinatario: ");
                        String target = sc.nextLine();
                        System.out.print("Mensaje: ");
                        String message = sc.nextLine();

                        out.writeObject("MSG_USER " + target + " " + message);
                        out.flush();
                    }

                    case "2" -> {
                        System.out.print("Destinatario: ");
                        String target = sc.nextLine();
                        System.out.print("Duración (segundos): ");
                        int duration = Integer.parseInt(sc.nextLine());

                        System.out.println("\n  Grabando nota de voz...");
                        byte[] audioData = AudioCapturer.captureAudio(duration);
                        
                        if (audioData != null && audioData.length > 0) {
                            System.out.println(" Grabación completada (" + audioData.length + " bytes), enviando...");
                            
                            //  CORRECTO: Enviar objeto VoiceMessage directamente
                            VoiceMessage voiceMsg = new VoiceMessage(username, target, audioData);
                            out.writeObject(voiceMsg);
                            out.flush();
                            
                            System.out.println(" Nota de voz enviada");
                        } else {
                            System.out.println(" Error al grabar audio");
                        }
                    }

                    case "3" -> {
                        System.out.print("Usuario a llamar: ");
                        String targetUser = sc.nextLine();
                        voiceClient.startCall(targetUser);
                    }

                    case "4" -> {
                        voiceClient.endCall();
                    }

                    case "5" -> {
                        out.writeObject("LIST_USERS");
                        out.flush();
                    }

                    case "6" -> {
                    out.writeObject("GET_HISTORY");
                    out.flush();
                    }

                    case "7" -> {
                    // Primero solicitar el historial para ver los archivos disponibles
                    System.out.println("\n Obteniendo lista de audios guardados...");
                    out.writeObject("GET_HISTORY");
                    out.flush();
    
                    // Esperar un momento para que lleguen los mensajes
                    Thread.sleep(500);
    
                    // Mostrar mensajes pendientes (que incluirán el historial)
                    while (!incoming.isEmpty()) {
                    System.out.println(incoming.poll());
                    }
    
                    System.out.println("\n Reproducir audio");
                    System.out.println("Formato del nombre: remitente_to_destinatario_fecha.wav");
                    System.out.print("Nombre del archivo: ");
                    String filename = sc.nextLine().trim();
    
                    if (!filename.isEmpty()) {
                        out.writeObject("GET_AUDIO " + filename);
                        out.flush();
                        System.out.println(" Esperando audio del servidor...");
                    }
                    
                    }

                    case "8" -> {
                    System.out.println("\n  ADVERTENCIA: Esta acción eliminará TODOS tus mensajes y audios");
                    System.out.print("¿Estás seguro? (SI/NO): ");
                    String confirmacion = sc.nextLine().trim().toUpperCase();
    
                    if (confirmacion.equals("SI")) {
                    out.writeObject("DELETE_HISTORY");
                    out.flush();
                    System.out.println(" Eliminando historial...");
                    } else {
                        System.out.println(" Operación cancelada");
                    }
                    }

                    case "9" -> {  // ← Cambiar de "8" a "9"
                        System.out.println(" Saliendo del chat...");
                        voiceClient.close();
                        running = false;
                    }
                    default -> System.out.println(" Opción inválida.");
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
