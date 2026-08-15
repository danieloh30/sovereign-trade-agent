package org.acme.agent;

import java.util.List;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.microprofile.config.ConfigProvider;

@Path("/trade/config")
public class ConfigResource {

    private static final List<String> GRAFANA_PROPERTIES = List.of(
            "grafana.url",
            "quarkus.grafana.url",
            "quarkus.observability.lgtm.grafana-url",
            "grafana.endpoint");

    @GET
    @Path("/grafana-url")
    @Produces(MediaType.TEXT_PLAIN)
    public String grafanaUrl() {
        var config = ConfigProvider.getConfig();
        for (String key : GRAFANA_PROPERTIES) {
            var val = config.getOptionalValue(key, String.class);
            if (val.isPresent() && !val.get().isBlank()) {
                return val.get();
            }
        }

        // Derive from OTLP endpoint: LGTM container exposes Grafana on port 3000,
        // mapped to the same host but different port. Try known port offset pattern.
        var otlp = config.getOptionalValue("quarkus.otel.exporter.otlp.endpoint", String.class);
        if (otlp.isPresent()) {
            for (String prefix : List.of("quarkus.otel.exporter.otlp.")) {
                for (String prop : config.getPropertyNames()) {
                    if (prop.startsWith("grafana") || prop.contains("grafana")) {
                        var v = config.getOptionalValue(prop, String.class);
                        if (v.isPresent() && !v.get().isBlank()) {
                            return v.get();
                        }
                    }
                }
            }
        }

        return "";
    }
}
