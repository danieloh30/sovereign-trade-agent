package org.acme.agent;

import dev.langchain4j.agent.tool.ReturnBehavior;
import dev.langchain4j.agent.tool.Tool;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import jakarta.enterprise.context.RequestScoped;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.ArrayList;
import java.util.List;
import org.acme.entity.AmlRule;
import org.acme.model.TradeDecision;
import org.acme.model.TradeDecision.Verdict;

@RequestScoped
public class TradeTools {
    // Request scope isolates concurrent checks; only an executed tool can add a decision.
    private final List<TradeDecision> decisions = new ArrayList<>();

    public void reset() {
        decisions.clear();
    }

    public TradeDecision verifiedDecision() {
        return decisions.size() == 1 ? decisions.getFirst()
                : TradeDecision.review("Could not verify one transaction. Specify one amount and currency, then retry.", null, null);
    }

    @Tool(value = "Check one transaction amount and ISO currency against local demo AML policies",
            returnBehavior = ReturnBehavior.IMMEDIATE)
    @WithSpan("checkAMLStatus")
    @Transactional
    public String checkAMLStatus(
            @SpanAttribute("transaction.amount") double amount,
            @SpanAttribute("transaction.currency") String currency) {
        var decision = evaluate(amount, currency);
        decisions.add(decision);
        return decision.verdict() + ": " + decision.message();
    }

    @Transactional
    public TradeDecision evaluate(double amount, String currency) {
        String normalized = currency == null ? "" : currency.strip().toUpperCase(Locale.ROOT);
        if (!Double.isFinite(amount)) {
            return TradeDecision.review("Provide a finite, positive transaction amount.", null, normalized);
        }
        BigDecimal value = BigDecimal.valueOf(amount);
        if (value.signum() <= 0 || value.stripTrailingZeros().scale() > 2
                || value.compareTo(new BigDecimal("999999999999999.99")) > 0) {
            return TradeDecision.review("Provide a positive amount with at most two decimal places.", value, normalized);
        }
        if (normalized.isEmpty()) {
            return TradeDecision.review("Specify the transaction currency.", value, normalized);
        }
        AmlRule rule = AmlRule.findByCurrencyAndAmount(normalized, value);
        if (rule == null) {
            return TradeDecision.review("No local policy covers this currency and amount. Manual review required.",
                    value, normalized);
        }
        return new TradeDecision(Verdict.valueOf(rule.action), rule.description, value, normalized,
                rule.id, rule.thresholdAmount);
    }
}
