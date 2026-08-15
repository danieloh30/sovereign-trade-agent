package org.acme.agent;

import java.util.Map;
import java.util.Optional;

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
        Optional<String> url = ConfigProvider.getConfig()
                .getOptionalValue("grafana.url", String.class);
        return url.orElse("");
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> config() {
        Optional<String> grafanaUrl = ConfigProvider.getConfig()
                .getOptionalValue("grafana.url", String.class);
        Optional<String> otelEndpoint = ConfigProvider.getConfig()
                .getOptionalValue("quarkus.otel.exporter.otlp.endpoint", String.class);
        return Map.of(
                "grafanaUrl", grafanaUrl.orElse(""),
                "otelEndpoint", otelEndpoint.orElse(""));
    }
}
