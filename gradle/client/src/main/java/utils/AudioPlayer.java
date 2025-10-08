package utils;

import javax.sound.sampled.*;
import java.io.ByteArrayInputStream;

public class AudioPlayer {
    
    public static void playAudio(byte[] audioData) {
        try {
            // Mismo formato que el capturer
            AudioFormat format = new AudioFormat(16000, 16, 1, true, true);
            
            ByteArrayInputStream bais = new ByteArrayInputStream(audioData);
            AudioInputStream audioStream = new AudioInputStream(
                bais, format, audioData.length / format.getFrameSize()
            );
            
            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            
            if (!AudioSystem.isLineSupported(info)) {
                System.err.println("Línea de audio no soportada para reproducción");
                return;
            }
            
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(info);
            
            speaker.open(format);
            speaker.start();
            
            System.out.println(" Reproduciendo...");
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            
            while ((bytesRead = audioStream.read(buffer, 0, buffer.length)) != -1) {
                speaker.write(buffer, 0, bytesRead);
            }
            
            speaker.drain();
            speaker.close();
            audioStream.close();
            
            System.out.println(" Reproducción completada");
            
        } catch (LineUnavailableException e) {
            System.err.println(" Error: Altavoz no disponible");
            System.err.println("   Verifica los dispositivos de audio del sistema");
        } catch (Exception e) {
            System.err.println(" Error reproduciendo audio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // Método de prueba
    public static void main(String[] args) {
        System.out.println("Probando reproducción de audio...");
        System.out.println("Primero graba 3 segundos...");
        
        byte[] audio = AudioCapturer.captureAudio(3);
        
        if (audio != null) {
            System.out.println("\nAhora reproduciendo...");
            playAudio(audio);
        }
    }
}