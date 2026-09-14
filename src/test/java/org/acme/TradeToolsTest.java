package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.acme.agent.TradeTools;
import org.acme.model.TradeDecision.Verdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class TradeToolsTest {
    @Inject TradeTools tools;

    @ParameterizedTest
    @CsvSource({
        "0.01,GBP,CLEARED,3", "4999.99,GBP,CLEARED,3", "5000,GBP,WARNING,2",
        "5000.01,GBP,WARNING,2", "9999.99,GBP,WARNING,2", "10000,GBP,REJECTED,1",
        "10000.01,GBP,REJECTED,1", "12500,GBP,REJECTED,1", "7500,GBP,WARNING,2",
        "3200,GBP,CLEARED,3", "9000,EUR,CLEARED,5", "14999.99,EUR,CLEARED,5",
        "15000,EUR,REJECTED,4", "15000.01,EUR,REJECTED,4", "14999.99,USD,CLEARED,7",
        "15000,USD,REJECTED,6", "15000.01,USD,REJECTED,6"
    })
    void boundaries(double amount, String currency, Verdict verdict, long ruleId) {
        var decision = tools.evaluate(amount, currency);
        assertEquals(verdict, decision.verdict());
        assertEquals(ruleId, decision.ruleId());
        assertNotNull(decision.threshold());
    }

    @Test
    void normalizesCurrency() {
        var result = tools.evaluate(12500, " gbp ");
        assertEquals("GBP", result.currency());
        assertEquals(Verdict.REJECTED, result.verdict());
    }

    @Test
    void unsupportedAndMissingCurrenciesRequireReview() {
        for (String currency : new String[]{"JPY", "CHF", "", null}) {
            var result = tools.evaluate(12500, currency);
            assertEquals(Verdict.REVIEW_REQUIRED, result.verdict());
            assertNull(result.ruleId());
        }
    }

    @ParameterizedTest
    @ValueSource(doubles = {-1, 0, 1.001, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, 1e18})
    void invalidAmountsRequireReview(double amount) {
        assertEquals(Verdict.REVIEW_REQUIRED, tools.evaluate(amount, "GBP").verdict());
    }
}
