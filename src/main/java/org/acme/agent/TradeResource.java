package org.acme.agent;

import io.opentelemetry.api.trace.Span;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.acme.model.AnalysisResponse;
import org.acme.model.TradeDecision;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@Path("/trade")
@Produces(MediaType.APPLICATION_JSON)
public class TradeResource {
    private static final Logger LOG = Logger.getLogger(TradeResource.class);
    @Inject TradeAnalyzer analyzer;
    @ConfigProperty(name = "quarkus.langchain4j.ollama.chat-model.model-id") String model;

    @POST
    @Path("/analyze")
    @Consumes(MediaType.TEXT_PLAIN)
    public Response analyze(String userPrompt) {
        long start = System.nanoTime();
        if (userPrompt == null || userPrompt.isBlank() || userPrompt.length() > 2000) {
            return response(400, error("Enter one transaction using 1–2,000 characters."), start);
        }
        try {
            return response(200, analyzer.analyze(userPrompt.strip()), start);
        } catch (RuntimeException e) {
            LOG.error("Transaction analysis failed; inspect the request trace for details", e);
            return response(503, error("Analysis unavailable. Check Ollama and PostgreSQL, then retry."), start);
        }
    }

    private TradeDecision error(String message) {
        return new TradeDecision(TradeDecision.Verdict.ERROR, message, null, null, null, null);
    }

    private Response response(int status, TradeDecision decision, long start) {
        var context = Span.current().getSpanContext();
        return Response.status(status).entity(new AnalysisResponse(decision, model,
                context.isValid() ? context.getTraceId() : null,
                (System.nanoTime() - start) / 1_000_000)).build();
    }
}
