package utils;

import javax.sound.sampled.*;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;

public class AudioPlayer {
    
    public static void playFile(String filename) {
        try {
            File file = new File(filename);
            if (!file.exists()) {
                System.err.println(" Archivo no encontrado: " + file.getAbsolutePath());
                return;
            }

            byte[] data = java.nio.file.Files.readAllBytes(file.toPath());
            playAudio(data);

        } catch (IOException e) {
            System.err.println(" Error leyendo el archivo: " + e.getMessage());
        }
    }

    public static void playAudio(byte[] audioData) {
        if (audioData == null || audioData.length == 0) {
            System.err.println(" No hay datos de audio para reproducir");
            return;
        }
        
        System.out.println(" Reproduciendo audio: " + audioData.length + " bytes");
        
        try {
            // Mismo formato que AudioCapturer usa
            AudioFormat format = AudioCapturer.AUDIO_FORMAT;
            
            ByteArrayInputStream bais = new ByteArrayInputStream(audioData);
            AudioInputStream audioStream = new AudioInputStream(
                bais, format, audioData.length / format.getFrameSize()
            );
            
            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            if (!AudioSystem.isLineSupported(info)) {
                System.err.println(" Línea de audio no soportada");
                return;
            }
            
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(info);
            speaker.open(format);
            speaker.start();
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            int totalBytesRead = 0;
            
            while ((bytesRead = audioStream.read(buffer, 0, buffer.length)) != -1) {
                speaker.write(buffer, 0, bytesRead);
                totalBytesRead += bytesRead;
            }
            
            speaker.drain();
            speaker.close();
            audioStream.close();
            
            System.out.println(" Reproducción completada (" + totalBytesRead + " bytes)");
            
        } catch (LineUnavailableException e) {
            System.err.println(" Altavoz no disponible. Revisa los dispositivos de audio del sistema.");
        } catch (Exception e) {
            System.err.println(" Error reproduciendo audio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Método de prueba
    public static void main(String[] args) {
        System.out.println(" Probando reproducción de audio...");
        System.out.println(" Primero graba 3 segundos...");
        
        byte[] audio = AudioCapturer.captureAudio(3);
        
        if (audio != null) {
            System.out.println("\n Ahora reproduciendo...");
            try {
                Thread.sleep(500); // Pequeña pausa
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            playAudio(audio);
        } else {
            System.out.println(" No se pudo capturar audio para reproducir");
        }
    }
}