package org.acme.agent;

import java.util.TreeMap;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.microprofile.config.ConfigProvider;

@Path("/trade/config")
public class ConfigResource {

    @GET
    @Path("/grafana-url")
    @Produces(MediaType.TEXT_PLAIN)
    public String grafanaUrl() {
        var config = ConfigProvider.getConfig();
        for (String prop : config.getPropertyNames()) {
            if (prop.toLowerCase().contains("grafana")) {
                var val = config.getOptionalValue(prop, String.class);
                if (val.isPresent() && val.get().startsWith("http")) {
                    return val.get();
                }
            }
        }
        return "";
    }

    @GET
    @Path("/debug-config")
    @Produces(MediaType.APPLICATION_JSON)
    public TreeMap<String, String> debugConfig() {
        var config = ConfigProvider.getConfig();
        var result = new TreeMap<String, String>();
        for (String prop : config.getPropertyNames()) {
            if (prop.toLowerCase().contains("grafana")
                    || prop.toLowerCase().contains("lgtm")
                    || prop.toLowerCase().contains("otel")
                    || prop.toLowerCase().contains("observ")) {
                config.getOptionalValue(prop, String.class)
                        .ifPresent(v -> result.put(prop, v));
            }
        }
        return result;
    }
}
