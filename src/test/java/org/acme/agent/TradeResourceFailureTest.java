package org.acme.agent;

import org.acme.model.AnalysisResponse;
import org.acme.model.TradeDecision;
import org.acme.model.TradeDecision.Verdict;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TradeResourceFailureTest {
    @Test
    void dependencyFailureReturnsARetryMessageWithoutInternalDetails() {
        var resource = new TradeResource();
        resource.model = "test-model";
        resource.analyzer = new TradeAnalyzer() {
            @Override
            public TradeDecision analyze(String prompt) {
                throw new IllegalStateException("internal-connection-details");
            }
        };
        try (var response = resource.analyze("Check a 12500 GBP payment.")) {
            assertEquals(503, response.getStatus());
            var body = (AnalysisResponse) response.getEntity();
            assertEquals(Verdict.ERROR, body.decision().verdict());
            assertTrue(body.decision().message().contains("retry"));
            assertFalse(body.decision().message().contains("internal-connection-details"));
            assertNull(body.decision().ruleId());
        }
    }
}
