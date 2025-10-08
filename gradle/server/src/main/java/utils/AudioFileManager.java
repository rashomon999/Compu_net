
package utils;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class AudioFileManager {
    private static final String AUDIO_DIR = "audio_files";
    
    public AudioFileManager() {
        // Crear directorio de audios si no existe
        try {
            Files.createDirectories(Paths.get(AUDIO_DIR));
            System.out.println("✓ Directorio de audios disponible: " + AUDIO_DIR);
        } catch (IOException e) {
            System.err.println("❌ Error creando directorio de audios: " + e.getMessage());
        }
    }
    
    /**
     * Guarda un archivo de audio y retorna el nombre del archivo guardado
     */
    public String saveAudio(byte[] audioData, String sender, String recipient) {
        try {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));
            String filename = String.format("%s_to_%s_%s.wav", sender, recipient, timestamp);
            Path filePath = Paths.get(AUDIO_DIR, filename);
            
            Files.write(filePath, audioData);
            System.out.println("[💾] Audio guardado: " + filename + " (" + audioData.length + " bytes)");
            
            return filename;
        } catch (IOException e) {
            System.err.println("❌ Error guardando audio: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Carga un archivo de audio por nombre
     */
    public byte[] loadAudio(String filename) {
        try {
            Path filePath = Paths.get(AUDIO_DIR, filename);
            
            if (!Files.exists(filePath)) {
                System.err.println("⚠️  Archivo de audio no encontrado: " + filename);
                return null;
            }
            
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            System.err.println("❌ Error cargando audio: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Elimina un archivo de audio
     */
    public boolean deleteAudio(String filename) {
        try {
            Path filePath = Paths.get(AUDIO_DIR, filename);
            return Files.deleteIfExists(filePath);
        } catch (IOException e) {
            System.err.println("❌ Error eliminando audio: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Lista todos los archivos de audio guardados
     */
    public File[] getAllAudioFiles() {
        File dir = new File(AUDIO_DIR);
        return dir.listFiles((d, name) -> name.endsWith(".wav"));
    }
}