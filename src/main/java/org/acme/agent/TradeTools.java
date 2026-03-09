package org.acme.agent;

import dev.langchain4j.agent.tool.Tool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.acme.entity.AmlRule;

@ApplicationScoped
public class TradeTools {

    @Tool("Check transaction against FCA anti-money laundering (AML) rules stored in local regulatory database")
    @Transactional
    public String checkAMLStatus(double amount, String currency) {
        // Query local regulatory database for AML rules
        AmlRule rule = AmlRule.findByCurrencyAndAmount(currency, amount);
        
        if (rule != null) {
            return rule.action + ": " + rule.description;
        }
        
        // Default response if no rule found
        return "CLEARED: Transaction within standard sovereign limits.";
    }
}