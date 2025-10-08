package tcp;

import utils.AudioCapturer;
import utils.AudioPlayer;
import udp.UDPVoiceClient;

import java.io.*;
import java.net.*;
import java.util.Scanner;
import java.util.Base64;

public class Client {
    public static void main(String[] args) throws Exception {
        String host = (args.length > 0) ? args[0] : "localhost";
        int port = (args.length > 1) ? Integer.parseInt(args[1]) : 9090;

        Socket socket = new Socket(host, port);
        BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        PrintWriter out = new PrintWriter(socket.getOutputStream(), true);
        Scanner sc = new Scanner(System.in);

        // Login
        String serverMsg = in.readLine();
        System.out.println(serverMsg);
        String username = sc.nextLine();
        out.println("REGISTER " + username); // Enviar comando de registro
        String response = in.readLine();
        if (response != null && response.startsWith("ERROR")) {
            System.out.println(response);
            socket.close();
            return;
        }

        // Inicializar cliente de voz UDP
        UDPVoiceClient voiceClient = new UDPVoiceClient(username);

        // Thread para recibir mensajes del servidor TCP
        new Thread(() -> {
            try {
                String resp;
                while ((resp = in.readLine()) != null) {
                    if (resp.startsWith("VOICE_FROM")) {
                        String[] parts = resp.split(" ", 3);
                        if (parts.length >= 3) {
                            String sender = parts[1];
                            byte[] audio = Base64.getDecoder().decode(parts[2]);
                            System.out.println("\n🎤 Nota de voz recibida de " + sender);
                            AudioPlayer.playAudio(audio);
                        }
                    } else {
                        System.out.println("\n" + resp);
                    }
                }
            } catch (IOException e) {
                System.out.println(" Conexión cerrada.");
            }
        }).start();

        // Menú unificado
        while (true) {
            System.out.println("\n--------------------------------------");
            System.out.println("           CHAT - MENÚ PRINCIPAL");
            System.out.println("--------------------------------------");
            System.out.println("1. Crear grupo de chat");
            System.out.println("2. Enviar mensaje de texto a usuario o grupo");
            System.out.println("3. Enviar nota de voz a usuario o grupo");
            System.out.println("4. Realizar llamada a usuario o grupo");
            System.out.println("5. Ver historial de conversación");
            System.out.println("6. Agregar usuario");
            System.out.println("7. Listar usuarios conectados");
            System.out.println("8. Salir");
            System.out.println("--------------------------------------");
            System.out.print("Elige opción: ");

            int op;
            try {
                op = Integer.parseInt(sc.nextLine());
            } catch (NumberFormatException e) {
                System.out.println(" Opción inválida.");
                continue;
            }

            if (op == 8) {
                voiceClient.close();
                socket.close();
                System.out.println(" ¡Hasta luego!");
                break;
            }

            switch (op) {
                case 1:
                    System.out.print("Nombre del grupo: ");
                    String groupName = sc.nextLine();
                    out.println("CREATE_GROUP " + groupName);
                    Thread.sleep(200);
                    break;

                case 2:
                    System.out.print("Destino (usuario o group:grupo): ");
                    String target = sc.nextLine();
                    System.out.print("Mensaje: ");
                    String message = sc.nextLine();
                    if (target.contains("group:")) {
                        out.println("MSG_GROUP " + target.replace("group:", "") + " " + message);
                    } else {
                        out.println("MSG_USER " + target + " " + message);
                    }
                    Thread.sleep(200);
                    break;

                case 3:
                    System.out.print("Destino (usuario o group:grupo): ");
                    String audioTarget = sc.nextLine();
                    System.out.print("Duración (segundos): ");
                    int duration = Integer.parseInt(sc.nextLine());
                    System.out.println("  Grabando en 3... 2... 1...");

                    byte[] audioData = AudioCapturer.captureAudio(duration);
                    if (audioData != null) {
                        String base64 = Base64.getEncoder().encodeToString(audioData);
                        if (audioTarget.startsWith("group:")) {
                            out.println("VOICE_GROUP " + audioTarget.replace("group:", "") + " " + base64);
                            System.out.println(" Nota de voz enviada al grupo " + audioTarget.replace("group:", ""));
                        } else {
                            out.println("VOICE_USER " + audioTarget + " " + base64);
                            System.out.println(" Nota de voz enviada a " + audioTarget);
                        }
                    } else {
                        System.out.println("Error grabando audio");
                    }
                    Thread.sleep(200);
                    break;

                case 4:
                    System.out.print("Destino (usuario o group:grupo): ");
                    String callTarget = sc.nextLine();
                    voiceClient.startCall(callTarget);
                    System.out.println(" Llamada iniciada. Presiona ENTER para colgar...");
                    sc.nextLine();
                    voiceClient.endCall();
                    break;

                case 5:
                    System.out.print("Ver historial con (usuario o group:grupo): ");
                    String historyTarget = sc.nextLine();
                    out.println("GET_HISTORY " + historyTarget);
                    Thread.sleep(500);
                    break;

                case 6:
                    System.out.print("Nombre del usuario a agregar: ");
                    String newUser = sc.nextLine();
                    out.println("ADD_USER " + newUser);
                    Thread.sleep(200);
                    break;

                case 7:
                    out.println("LIST_USERS");
                    Thread.sleep(200);
                    break;

                default:
                    System.out.println("❌ Opción no válida");
            }
        }
    }
}