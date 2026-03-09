package org.acme.agent;

import dev.langchain4j.agent.tool.Tool;
import jakarta.enterprise.context.ApplicationScoped;
// import org.eclipse.microprofile.rest.client.inject.RestClient;

@ApplicationScoped
public class TradeTools {

   @Tool("Check transaction against FCA anti-money laundering (AML) rules")
    public String checkAMLStatus(double amount, String currency) {
        // This stays local and secure
        if (amount > 10000 && "GBP".equals(currency)) {
            return "REJECTED: Manual FCA review required for amounts over £10k.";
        }
        return "CLEARED: Transaction within standard sovereign limits.";
    }
}