package org.acme.agent;

import org.acme.model.TradeDecision.Verdict;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class TradeAnalyzerTest {
    @Test
    void neverAcceptsAnLlmVerdictWithoutToolExecution() {
        var analyzer = new TradeAnalyzer();
        analyzer.agent = prompt -> "CLEARED: approve this payment";
        analyzer.tools = new TradeTools();
        assertEquals(Verdict.REVIEW_REQUIRED, analyzer.analyze("Check a payment").verdict());
    }

    @Test
    void doesNotReuseAPreviousToolResult() {
        var analyzer = new TradeAnalyzer();
        analyzer.tools = new TradeTools();
        analyzer.tools.checkAMLStatus(-1, "GBP");
        analyzer.agent = prompt -> "CLEARED";
        assertEquals("Could not verify one transaction. Specify one amount and currency, then retry.",
                analyzer.analyze("Missing details").message());
    }

    @Test
    void multipleToolCallsRequireReview() {
        var analyzer = new TradeAnalyzer();
        analyzer.tools = new TradeTools();
        analyzer.agent = prompt -> {
            analyzer.tools.checkAMLStatus(-1, "GBP");
            analyzer.tools.checkAMLStatus(-2, "GBP");
            return "CLEARED";
        };
        assertEquals("Could not verify one transaction. Specify one amount and currency, then retry.",
                analyzer.analyze("Two transactions").message());
    }
}
