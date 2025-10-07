package udp;

import javax.sound.sampled.*;
import java.net.*;

public class UDPVoiceClient {
    private static final String SERVER_HOST = "localhost";
    private static final int UDP_PORT = 9091;
    private DatagramSocket socket;
    private String username;
    private boolean inCall = false;
    private Thread sendThread;
    private Thread receiveThread;

    public UDPVoiceClient(String username) throws Exception {
        this.username = username;
        this.socket = new DatagramSocket();
        
        // Registrarse en el servidor UDP
        String registerMsg = "REGISTER:" + username;
        byte[] data = registerMsg.getBytes();
        DatagramPacket packet = new DatagramPacket(
            data, data.length,
            InetAddress.getByName(SERVER_HOST), UDP_PORT
        );
        socket.send(packet);
        System.out.println("✅ Registrado en servidor UDP de voz");
    }

    public void startCall(String targetUser) {
        if (inCall) {
            System.out.println("❌ Ya estás en una llamada");
            return;
        }

        try {
            // Notificar inicio de llamada
            String callMsg = "CALL:" + username + ":" + targetUser;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(
                data, data.length,
                InetAddress.getByName(SERVER_HOST), UDP_PORT
            );
            socket.send(packet);

            inCall = true;
            System.out.println("📞 Llamada iniciada con " + targetUser);
            System.out.println("🎤 Hablando... (presiona CTRL+C para colgar)");

            // Thread para enviar audio
            sendThread = new Thread(() -> sendAudio());
            sendThread.start();

            // Thread para recibir audio
            receiveThread = new Thread(() -> receiveAudio());
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("❌ Error iniciando llamada: " + e.getMessage());
        }
    }

    private void sendAudio() {
        try {
            AudioFormat format = new AudioFormat(8000, 16, 1, true, true);
            DataLine.Info info = new DataLine.Info(TargetDataLine.class, format);
            TargetDataLine microphone = (TargetDataLine) AudioSystem.getLine(info);
            
            microphone.open(format);
            microphone.start();

            byte[] buffer = new byte[512]; // Paquetes pequeños para baja latencia

            while (inCall) {
                int bytesRead = microphone.read(buffer, 0, buffer.length);
                
                if (bytesRead > 0) {
                    // Preparar mensaje: AUDIO:username:audioData
                    String header = "AUDIO:" + username + ":";
                    byte[] headerBytes = header.getBytes();
                    byte[] packet = new byte[headerBytes.length + bytesRead];
                    
                    System.arraycopy(headerBytes, 0, packet, 0, headerBytes.length);
                    System.arraycopy(buffer, 0, packet, headerBytes.length, bytesRead);

                    DatagramPacket udpPacket = new DatagramPacket(
                        packet, packet.length,
                        InetAddress.getByName(SERVER_HOST), UDP_PORT
                    );
                    socket.send(udpPacket);
                }
            }

            microphone.stop();
            microphone.close();

        } catch (Exception e) {
            if (inCall) {
                System.err.println("❌ Error enviando audio: " + e.getMessage());
            }
        }
    }

    private void receiveAudio() {
        try {
            AudioFormat format = new AudioFormat(8000, 16, 1, true, true);
            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(info);
            
            speaker.open(format);
            speaker.start();

            byte[] buffer = new byte[4096];

            while (inCall) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.setSoTimeout(5000); // 5 segundos timeout
                
                try {
                    socket.receive(packet);
                    
                    String message = new String(packet.getData(), 0, packet.getLength());
                    
                    if (message.startsWith("AUDIO:")) {
                        // Extraer audio del mensaje
                        String[] parts = message.split(":", 3);
                        if (parts.length >= 3) {
                            byte[] audioData = parts[2].getBytes();
                            speaker.write(audioData, 0, audioData.length);
                        }
                    } else if (message.startsWith("INCOMING_CALL:")) {
                        String caller = message.split(":")[1];
                        System.out.println("\n📞 LLAMADA ENTRANTE de " + caller);
                    }
                } catch (SocketTimeoutException e) {
                    // Continue esperando
                }
            }

            speaker.drain();
            speaker.stop();
            speaker.close();

        } catch (Exception e) {
            if (inCall) {
                System.err.println("❌ Error recibiendo audio: " + e.getMessage());
            }
        }
    }

    public void endCall() {
        if (!inCall) return;
        
        inCall = false;
        
        try {
            String endMsg = "END_CALL:" + username;
            byte[] data = endMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(
                data, data.length,
                InetAddress.getByName(SERVER_HOST), UDP_PORT
            );
            socket.send(packet);
        } catch (Exception e) {
            System.err.println("❌ Error finalizando llamada: " + e.getMessage());
        }

        System.out.println("🔴 Llamada finalizada");
    }

    public void close() {
        endCall();
        socket.close();
    }

    // Método main para probar llamadas independientemente
    public static void main(String[] args) throws Exception {
        System.out.print("Tu nombre de usuario: ");
        String username = new java.util.Scanner(System.in).nextLine();
        
        UDPVoiceClient client = new UDPVoiceClient(username);
        
        System.out.print("Llamar a: ");
        String target = new java.util.Scanner(System.in).nextLine();
        
        client.startCall(target);
        
        // Mantener vivo
        System.out.println("Presiona ENTER para colgar...");
        System.in.read();
        
        client.endCall();
        client.close();
    }
}