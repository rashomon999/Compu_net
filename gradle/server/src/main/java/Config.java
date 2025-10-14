public class Config {
    private String host;
    private int port;

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
