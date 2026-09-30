package org.acme.agent;

import io.opentelemetry.api.trace.Span;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.acme.model.AnalysisResponse;
import org.acme.model.TradeDecision;
import org.acme.model.PolicyRule;
import org.acme.entity.AmlRule;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.jboss.logging.Logger;

@Path("/trade")
@Produces(MediaType.APPLICATION_JSON)
public class TradeResource {
    private static final Logger LOG = Logger.getLogger(TradeResource.class);
    @Inject TradeAnalyzer analyzer;
    @Inject HumanReviewAgent reviews;
    @ConfigProperty(name = "quarkus.langchain4j.ollama.chat-model.model-id") String model;

    @POST
    @Path("/analyze")
    @Consumes(MediaType.TEXT_PLAIN)
    @Operation(summary = "Check one payment against local demo policies",
            description = "The local model extracts an amount and currency. The policy tool supplies the verdict; no payment is executed. REJECTED is the legacy code for manual review under a matched policy and creates a pending human review identified by reviewRequestId. REVIEW_REQUIRED means the transaction or policy match could not be verified and does not create an approvable request.")
    @RequestBody(required = true, content = @Content(mediaType = MediaType.TEXT_PLAIN,
            schema = @Schema(type = org.eclipse.microprofile.openapi.annotations.enums.SchemaType.STRING),
            example = "Check a £12,500 GBP payment from London Tech Ltd."))
    @APIResponse(responseCode = "200", description = "Policy decision, including cases requiring review",
            content = @Content(schema = @Schema(implementation = AnalysisResponse.class)))
    @APIResponse(responseCode = "400", description = "Blank or oversized input",
            content = @Content(schema = @Schema(implementation = AnalysisResponse.class)))
    @APIResponse(responseCode = "503", description = "Analysis dependency unavailable",
            content = @Content(schema = @Schema(implementation = AnalysisResponse.class)))
    public Response analyze(String userPrompt) {
        long start = System.nanoTime();
        if (userPrompt == null || userPrompt.isBlank() || userPrompt.length() > 2000) {
            return response(400, error("Enter one transaction using 1–2,000 characters."), start);
        }
        try {
            String query = userPrompt.strip();
            var decision = analyzer.analyze(query);
            var context = Span.current().getSpanContext();
            Long reviewRequestId = reviews.requestReview(query, decision, model,
                    context.isValid() ? context.getTraceId() : null);
            return response(200, decision, start, reviewRequestId);
        } catch (RuntimeException e) {
            LOG.error("Transaction analysis failed; inspect the request trace for details", e);
            return response(503, error("Analysis unavailable. Check Ollama and PostgreSQL, then retry."), start);
        }
    }

    @GET
    @Path("/policies")
    @Transactional
    @Operation(summary = "Read the current local demo policies",
            description = "Illustrative policies from PostgreSQL, ordered by currency and descending threshold. For a positive amount, the highest matching inclusive threshold wins. Unsupported currencies require review.")
    public List<PolicyRule> policies() {
        return AmlRule.<AmlRule>list("order by currency, thresholdAmount desc, id").stream()
                .map(rule -> new PolicyRule(rule.id, rule.currency, rule.thresholdAmount,
                        TradeDecision.Verdict.valueOf(rule.action), rule.description))
                .toList();
    }

    private TradeDecision error(String message) {
        return new TradeDecision(TradeDecision.Verdict.ERROR, message, null, null, null, null);
    }

    private Response response(int status, TradeDecision decision, long start) {
        return response(status, decision, start, null);
    }

    private Response response(int status, TradeDecision decision, long start, Long reviewRequestId) {
        var context = Span.current().getSpanContext();
        return Response.status(status).entity(new AnalysisResponse(decision, model,
                context.isValid() ? context.getTraceId() : null,
                (System.nanoTime() - start) / 1_000_000, reviewRequestId)).build();
    }
}
