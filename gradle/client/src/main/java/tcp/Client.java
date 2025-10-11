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


            // Bucle principal para enviar mensajes
            boolean running = true;
            while (running) {
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
            }

            socket.close();
            sc.close();

        } catch (Exception e) {
            System.err.println(" Error en el cliente: " + e.getMessage());
            e.printStackTrace();
        }
    }
}