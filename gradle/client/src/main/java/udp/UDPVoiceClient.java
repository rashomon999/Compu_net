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
        DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(SERVER_HOST), UDP_PORT);
        socket.send(packet);
        System.out.println(" Registrado en servidor UDP de voz");
    }

    public void startCall(String targetUser) {
        if (inCall) {
            System.out.println(" Ya estás en una llamada");
            return;
        }

        try {
            // Notificar inicio de llamada
            String callMsg = "CALL:" + username + ":" + targetUser;
            byte[] data = callMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length, InetAddress.getByName(SERVER_HOST), UDP_PORT);
            socket.send(packet);

            inCall = true;
            System.out.println(" Llamada iniciada con " + targetUser);

            // Thread para enviar audio
            sendThread = new Thread(this::sendAudio);
            sendThread.start();

            // Thread para recibir audio
            receiveThread = new Thread(this::receiveAudio);
            receiveThread.start();

        } catch (Exception e) {
            System.err.println(" Error iniciando llamada: " + e.getMessage());
        }
    }

    private void sendAudio() {
        try {
            AudioFormat format = new AudioFormat(8000, 16, 1, true, true);
            TargetDataLine mic = AudioSystem.getTargetDataLine(format);
            mic.open(format);
            mic.start();

            byte[] buffer = new byte[512];

            while (inCall) {
                int bytesRead = mic.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    byte[] header = ("AUDIO:" + username + ":").getBytes();
                    byte[] packetData = new byte[header.length + bytesRead];
                    System.arraycopy(header, 0, packetData, 0, header.length);
                    System.arraycopy(buffer, 0, packetData, header.length, bytesRead);

                    DatagramPacket packet = new DatagramPacket(packetData, packetData.length,
                            InetAddress.getByName(SERVER_HOST), UDP_PORT);
                    socket.send(packet);
                }
            }

            mic.stop();
            mic.close();
        } catch (Exception e) {
            if (inCall) System.err.println("Error enviando audio: " + e.getMessage());
        }
    }

    private void receiveAudio() {
        try {
            AudioFormat format = new AudioFormat(8000, 16, 1, true, true);
            SourceDataLine speaker = AudioSystem.getSourceDataLine(format);
            speaker.open(format);
            speaker.start();

            byte[] buffer = new byte[4096];

            while (inCall) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);

                String header = new String(packet.getData(), 0, Math.min(packet.getLength(), 100));
                if (header.startsWith("AUDIO:")) {
                    // Saltar los primeros bytes del header
                    int headerLen = header.indexOf(":", header.indexOf(":") + 1) + 1;
                    int audioLen = packet.getLength() - headerLen;
                    speaker.write(packet.getData(), headerLen, audioLen);
                } else if (header.startsWith("INCOMING_CALL:")) {
                    String caller = header.split(":")[1];
                    System.out.println("\n LLAMADA ENTRANTE de " + caller);
                }
            }

            speaker.drain();
            speaker.close();
        } catch (Exception e) {
            if (inCall) System.err.println("Error recibiendo audio: " + e.getMessage());
        }
    }

    public void endCall() {
        if (!inCall) return;

        inCall = false;

        try {
            String endMsg = "END_CALL:" + username;
            byte[] data = endMsg.getBytes();
            DatagramPacket packet = new DatagramPacket(data, data.length,
                    InetAddress.getByName(SERVER_HOST), UDP_PORT);
            socket.send(packet);
        } catch (Exception e) {
            System.err.println("Error finalizando llamada: " + e.getMessage());
        }

        System.out.println(" Llamada finalizada");
    }

    public void close() {
        endCall();
        socket.close();
    }
}
