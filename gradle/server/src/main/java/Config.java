/**
 * Clase Config: Representa la configuración básica del cliente o servidor.
 * 
 * Esta clase se utiliza para almacenar los parámetros de conexión necesarios 
 * para establecer comunicación dentro del sistema, incluyendo la dirección del 
 * host y el puerto asociado.
 * 
 * Es una clase simple tipo *POJO* (Plain Old Java Object) que encapsula los 
 * valores y provee métodos getter y setter.
 */

public class Config {
    private String host;
    private int port;

    //Crea una nueva configuración con el host y puerto especificados.
    public Config(String host, int port) {
        this.host = host;
        this.port = port;
    }

    public String getHost() {
        return host;
    }
    public int getPort() {
        return port;
    }

    public void setHost(String host) {
        this.host = host;
    }
    public void setPort(int port) {
        this.port = port;
    }

}
