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

        String host = "localhost";
        int tcpPort = 9090;

        try (Socket socket = new Socket(host, tcpPort)) {
            System.out.println(" Conectado al servidor " + host + ":" + tcpPort);

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

            // Inicializar cliente UDP para llamadas
            UDPVoiceClient voiceClient = new UDPVoiceClient(username);
            // Cola de mensajes recibidos desde el servidor
            BlockingQueue<String> incoming = new LinkedBlockingQueue<>();

            // Hilo para escuchar mensajes entrantes
            new Thread(() -> {
    try {
        Object obj;
        while ((obj = in.readObject()) != null) {
            if (obj instanceof String text) {
                System.out.println("\n" + text);
            } else if (obj instanceof VoiceMessage vm) {
                System.out.println("\n🎤 Nota de voz de " + vm.getSender() +
                                   " (" + vm.getAudioData().length + " bytes)");
                AudioPlayer.playAudio(vm.getAudioData());
            }
            System.out.print("> "); // muestra el prompt de nuevo
        }
    } catch (Exception e) {
        System.out.println(" Conexión cerrada por el servidor.");
    }
}).start();



            // Bucle principal para enviar mensajes
            boolean running = true;
            while (running) {
                while (!incoming.isEmpty()) {
                    System.out.println(incoming.poll());
                }

                System.out.println("\n╔════════════════════════════════╗");
                System.out.println("║         MENÚ PRINCIPAL         ║");
                System.out.println("╚════════════════════════════════╝");
                System.out.println("1. Enviar mensaje a usuario");
                System.out.println("2. Enviar nota de voz a usuario");
                System.out.println("3. Llamada a usuario");
                System.out.println("4. Finalizar llamada");
                System.out.println("5. Listar usuarios conectados");
                System.out.println("6. GRUPOS");
                System.out.println("7. Salir");
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
                        menuGrupos(sc, out, username, voiceClient);
                    }

                    case "7" -> {
                        System.out.println(" Saliendo del chat...");
                        voiceClient.close();
                        running = false;
                    }

                    default -> System.out.println(" Opción inválida.");
                }
            }

            socket.close();
            sc.close();

        } catch (Exception e) {
            System.err.println(" Error en el cliente: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void menuGrupos(Scanner sc, ObjectOutputStream out, String username, UDPVoiceClient voiceClient) throws IOException {
        boolean inGruposMenu = true;
        while (inGruposMenu) {
            System.out.println("\n╔════════════════════════════════╗");
            System.out.println("║       MENÚ DE GRUPOS           ║");
            System.out.println("╚════════════════════════════════╝");
            System.out.println("1. Crear grupo");
            System.out.println("2. Unirse a grupo");
            System.out.println("3. Listar mis grupos");
            System.out.println("4. Enviar mensaje a grupo");
            System.out.println("5. Enviar nota de voz a grupo");
            System.out.println("6. Iniciar llamada grupal");
            System.out.println("7. Ver miembros del grupo");
            System.out.println("8. Volver al menú principal");
            System.out.print("\n> Elige una opción: ");

            String opcion = sc.nextLine();

            switch (opcion) {
                case "1" -> {
                    System.out.print("Nombre del grupo: ");
                    String groupName = sc.nextLine();
                    out.writeObject("CREATE_GROUP " + groupName);
                    out.flush();
                }

                case "2" -> {
                    System.out.print("Nombre del grupo al que unirse: ");
                    String groupName = sc.nextLine();
                    out.writeObject("JOIN_GROUP " + groupName);
                    out.flush();
                }

                case "3" -> {
                    out.writeObject("LIST_GROUPS");
                    out.flush();
                }

                case "4" -> {
                    System.out.print("Nombre del grupo: ");
                    String groupName = sc.nextLine();
                    System.out.print("Mensaje: ");
                    String message = sc.nextLine();
                    out.writeObject("MSG_GROUP " + groupName + " " + message);
                    out.flush();
                }

                case "5" -> {
                    System.out.print("Nombre del grupo: ");
                    String groupName = sc.nextLine();
                    System.out.print("Duración (segundos): ");
                    int duration = Integer.parseInt(sc.nextLine());

                    System.out.println("\n  Grabando nota de voz...");
                    byte[] audioData = AudioCapturer.captureAudio(duration);
                    
                    if (audioData != null && audioData.length > 0) {
                        System.out.println(" Grabación completada, enviando...");
                        VoiceMessage voiceMsg = new VoiceMessage(username, groupName, audioData);
                        out.writeObject(voiceMsg);
                        out.flush();
                        System.out.println(" Nota de voz enviada al grupo");
                    } else {
                        System.out.println(" Error al grabar audio");
                    }
                }

                case "6" -> {
                    System.out.print("Nombre del grupo para llamada: ");
                    String groupName = sc.nextLine();
                    System.out.println(" Iniciando llamada grupal con " + groupName + "...");
                    voiceClient.startGroupCall(groupName);
                }

                case "7" -> {
                    System.out.print("Nombre del grupo: ");
                    String groupName = sc.nextLine();
                    out.writeObject("LIST_GROUP_MEMBERS " + groupName);
                    out.flush();
                }

                case "8" -> {
                    inGruposMenu = false;
                }

                default -> System.out.println(" Opción inválida.");
            }
        }
    }
}