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
    private String currentCallTarget; // usuario o grupo

    // Formato de audio con buena calidad
    private static final AudioFormat AUDIO_FORMAT = new AudioFormat(16000.0f, 16, 1, true, false);

    public UDPVoiceClient(String username) throws Exception {
        this.username = username;
        this.socket = new DatagramSocket();

        // Registro en el servidor UDP
        String registerMsg = "REGISTER:" + username;
        byte[] data = registerMsg.getBytes();
        DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(SERVER_HOST), UDP_PORT);
        socket.send(packet);

        System.out.println("✅ Registrado en el servidor UDP de voz");
    }

    // ================== LLAMADAS INDIVIDUALES ==================

    public void startCall(String targetUser) {
        if (inCall) {
            System.out.println("⚠️  Ya estás en una llamada");
            return;
        }

        try {
            currentCallTarget = targetUser;
            
            // Notificar inicio de llamada
            String callMsg = "CALL:" + username + ":" + targetUser;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(SERVER_HOST), UDP_PORT);
            socket.send(packet);

            inCall = true;
            System.out.println("📞 Llamada iniciada con " + targetUser);

            sendThread = new Thread(() -> sendAudio());
            receiveThread = new Thread(() -> receiveAudio());

            sendThread.start();
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("❌ Error iniciando llamada: " + e.getMessage());
        }
    }

    // ================== LLAMADAS GRUPALES ==================

    public void startGroupCall(String groupName) {
        if (inCall) {
            System.out.println("⚠️  Ya estás en una llamada");
            return;
        }

        try {
            currentCallTarget = groupName;
            
            // Notificar inicio de llamada grupal
            String groupCallMsg = "GROUP_CALL:" + username + ":" + groupName;
            byte[] data = groupCallMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, 
                    InetAddress.getByName(SERVER_HOST), UDP_PORT);
            socket.send(packet);

            inCall = true;
            System.out.println("📞 Llamada grupal iniciada con " + groupName);

            sendThread = new Thread(() -> sendAudio());
            receiveThread = new Thread(() -> receiveAudio());

            sendThread.start();
            receiveThread.start();

        } catch (Exception e) {
            System.err.println("❌ Error iniciando llamada grupal: " + e.getMessage());
        }
    }

    // ================== ENVÍO DE AUDIO ==================

    private void sendAudio() {
        try {
            DataLine.Info micInfo = new DataLine.Info(TargetDataLine.class, AUDIO_FORMAT);
            TargetDataLine mic = (TargetDataLine) AudioSystem.getLine(micInfo);
            mic.open(AUDIO_FORMAT);
            mic.start();

            byte[] buffer = new byte[1024];
            InetAddress serverAddr = InetAddress.getByName(SERVER_HOST);

            System.out.println("🎤 Transmitiendo audio...");

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
                System.err.println("❌ Error enviando audio: " + e.getMessage());
        }
    }

    // ================== RECEPCIÓN DE AUDIO ==================

    private void receiveAudio() {
        try {
            DataLine.Info speakerInfo = new DataLine.Info(SourceDataLine.class, AUDIO_FORMAT);
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(speakerInfo);
            speaker.open(AUDIO_FORMAT);
            speaker.start();

            byte[] buffer = new byte[2048];

            System.out.println("🔊 Escuchando audio...");

            while (inCall) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);

                // Si es un mensaje de control (no audio), lo ignoramos
                String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 20)).trim();
                if (header.startsWith("CALL") || header.startsWith("END") || 
                    header.startsWith("REGISTER") || header.startsWith("GROUP"))
                    continue;

                speaker.write(packet.getData(), 0, packet.getLength());
            }

            speaker.drain();
            speaker.close();

        } catch (Exception e) {
            if (inCall)
                System.err.println("❌ Error recibiendo audio: " + e.getMessage());
        }
    }

    // ================== FINALIZAR LLAMADA ==================

    public void endCall() {
        if (!inCall)
            return;

        inCall = false;

        try {
            String endMsg = "END_CALL:" + username;
            byte[] data = endMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length,
                    InetAddress.getByName(SERVER_HOST), UDP_PORT);
            socket.send(packet);
        } catch (Exception e) {
            System.err.println("⚠️  Error finalizando llamada: " + e.getMessage());
        }

        if (currentCallTarget != null) {
            System.out.println("📴 Llamada con " + currentCallTarget + " finalizada");
            currentCallTarget = null;
        }
    }

    public void close() {
        endCall();
        socket.close();
    }
}