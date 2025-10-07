package utils;

import javax.sound.sampled.*;
import java.io.ByteArrayOutputStream;

public class AudioCapturer {
    
    public static byte[] captureAudio(int durationSeconds) {
        try {
            // Formato de audio: 16kHz, 16 bits, mono
            AudioFormat format = new AudioFormat(16000, 16, 1, true, true);
            
            DataLine.Info info = new DataLine.Info(TargetDataLine.class, format);
            
            if (!AudioSystem.isLineSupported(info)) {
                System.err.println("❌ Línea de audio no soportada");
                return null;
            }
            
            TargetDataLine microphone = (TargetDataLine) AudioSystem.getLine(info);
            
            microphone.open(format);
            microphone.start();
            
            System.out.println("🎙️  Grabando...");
            
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            
            long startTime = System.currentTimeMillis();
            long duration = durationSeconds * 1000L;
            
            while (System.currentTimeMillis() - startTime < duration) {
                int bytesRead = microphone.read(buffer, 0, buffer.length);
                out.write(buffer, 0, bytesRead);
                
                // Mostrar progreso
                long elapsed = System.currentTimeMillis() - startTime;
                int secondsElapsed = (int) (elapsed / 1000);
                if (secondsElapsed < durationSeconds && elapsed % 1000 < 100) {
                    System.out.print(".");
                }
            }
            
            System.out.println(" ✅ Grabación completa!");
            
            microphone.stop();
            microphone.close();
            
            return out.toByteArray();
            
        } catch (LineUnavailableException e) {
            System.err.println("❌ Error: Micrófono no disponible");
            System.err.println("   Verifica los permisos del sistema");
            return null;
        } catch (Exception e) {
            System.err.println("❌ Error capturando audio: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    // Método de prueba
    public static void main(String[] args) {
        System.out.println("Probando captura de audio...");
        System.out.println("Grabando 3 segundos...");
        
        byte[] audio = captureAudio(3);
        
        if (audio != null) {
            System.out.println("✅ Audio capturado: " + audio.length + " bytes");
        } else {
            System.out.println("❌ Falló la captura");
        }
    }
}