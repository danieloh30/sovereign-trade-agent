package org.acme.agent;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.acme.model.TradeDecision;

@ApplicationScoped
public class TradeAnalyzer {
    @Inject TradeSovereignAgent agent;
    @Inject TradeTools tools;

    public TradeDecision analyze(String prompt) {
        tools.reset();
        agent.verifyTransaction(prompt);
        // Ignore generated prose. Only the request-scoped policy tool supplies the verdict.
        return tools.verifiedDecision();
    }
}
