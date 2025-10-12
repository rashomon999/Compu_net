package udp;

import javax.sound.sampled.*;
import java.net.*;

public class UDPVoiceClient {
    private final String serverHost;
    private static final int UDP_PORT = 9091;

    private DatagramSocket socket;
    private String username;
    private boolean inCall = false;
    private Thread sendThread;
    private Thread receiveThread;
    private String currentGroupCall = null;

    private static final AudioFormat AUDIO_FORMAT = new AudioFormat(16000.0f, 16, 1, true, false);

    public UDPVoiceClient(String username, String serverHost) throws Exception {
        this.username = username;
        this.serverHost = serverHost;
        this.socket = new DatagramSocket();

        // Registro en el servidor UDP
        String registerMsg = "REGISTER:" + username;
        byte[] data = registerMsg.getBytes();
        DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(serverHost), UDP_PORT);
        socket.send(packet);

        System.out.println("✓ Registrado en el servidor UDP de voz (" + serverHost + ")");
    }

    public void startCall(String targetUser) {
        if (inCall) {
            System.out.println("✗ Ya estás en una llamada");
            return;
        }

        try {
            // Notificar inicio de llamada
            String callMsg = "CALL:" + username + ":" + targetUser;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(serverHost), UDP_PORT);
            socket.send(packet);

            inCall = true;
            System.out.println("✓ Llamada iniciada con " + targetUser);

            sendThread = new Thread(() -> sendAudio());
            receiveThread = new Thread(() -> receiveAudio());

            sendThread.start();
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("✗ Error iniciando llamada: " + e.getMessage());
        }
    }

    public void startGroupCall(String groupName) {
        if (inCall) {
            System.out.println("✗ Ya estás en una llamada");
            return;
        }

        try {
            // Notificar inicio de llamada grupal
            String callMsg = "GROUP_CALL:" + username + ":" + groupName;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(serverHost), UDP_PORT);
            socket.send(packet);

            inCall = true;
            currentGroupCall = groupName;
            System.out.println("✓ Llamada grupal iniciada en: " + groupName);

            sendThread = new Thread(() -> sendAudio());
            receiveThread = new Thread(() -> receiveAudio());

            sendThread.start();
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("✗ Error iniciando llamada grupal: " + e.getMessage());
        }
    }

    private void sendAudio() {
        try {
            DataLine.Info micInfo = new DataLine.Info(TargetDataLine.class, AUDIO_FORMAT);
            TargetDataLine mic = (TargetDataLine) AudioSystem.getLine(micInfo);
            mic.open(AUDIO_FORMAT);
            mic.start();

            byte[] buffer = new byte[1024];
            InetAddress serverAddr = InetAddress.getByName(serverHost);

            while (inCall) {
                int bytesRead = mic.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    DatagramPacket packet = new DatagramPacket(buffer, bytesRead, serverAddr, UDP_PORT);
                    socket.send(packet);
                }
            }

            mic.stop();
            mic.close();

        } catch (Exception e) {
            if (inCall)
                System.err.println("✗ Error enviando audio: " + e.getMessage());
        }
    }

    private void receiveAudio() {
        try {
            DataLine.Info speakerInfo = new DataLine.Info(SourceDataLine.class, AUDIO_FORMAT);
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(speakerInfo);
            speaker.open(AUDIO_FORMAT);
            speaker.start();

            byte[] buffer = new byte[2048];

            while (inCall) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);

                // Si es un mensaje de control (no audio), lo mostramos
                String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 30)).trim();
                if (header.startsWith("CALL") || header.startsWith("END") || 
                    header.startsWith("REGISTER") || header.startsWith("GROUP")) {
                    if (header.startsWith("GROUP_CALL_JOIN:")) {
                        String[] parts = header.split(":");
                        System.out.println("\n[Llamada] " + parts[1] + " se unió a la llamada grupal");
                    } else if (header.startsWith("GROUP_CALL_LEAVE:")) {
                        String[] parts = header.split(":");
                        System.out.println("\n[Llamada] " + parts[1] + " salió de la llamada grupal");
                    }
                    continue;
                }

                speaker.write(packet.getData(), 0, packet.getLength());
            }

            speaker.drain();
            speaker.close();

        } catch (Exception e) {
            if (inCall)
                System.err.println("✗ Error recibiendo audio: " + e.getMessage());
        }
    }

    public void endCall() {
        if (!inCall)
            return;

        inCall = false;

        try {
            if (currentGroupCall != null) {
                String endMsg = "END_GROUP_CALL:" + username + ":" + currentGroupCall;
                byte[] data = endMsg.getBytes();
                DatagramPacket packet = new DatagramPacket(data, data.length,
                        InetAddress.getByName(serverHost), UDP_PORT);
                socket.send(packet);
                currentGroupCall = null;
            } else {
                String endMsg = "END_CALL:" + username;
                byte[] data = endMsg.getBytes();
                DatagramPacket packet = new DatagramPacket(data, data.length,
                        InetAddress.getByName(serverHost), UDP_PORT);
                socket.send(packet);
            }
        } catch (Exception e) {
            System.err.println("✗ Error finalizando llamada: " + e.getMessage());
        }

        System.out.println("✓ Llamada finalizada");
    }

    public void close() {
        endCall();
        socket.close();
    }
}
