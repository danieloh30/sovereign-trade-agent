package org.acme.model;

import java.math.BigDecimal;

/** A decision produced by the local policy tool, never by generated prose. */
public record TradeDecision(Verdict verdict, String message, BigDecimal amount, String currency,
        Long ruleId, BigDecimal threshold) {
    public enum Verdict { CLEARED, WARNING, REJECTED, REVIEW_REQUIRED, ERROR }

    public static TradeDecision review(String message, BigDecimal amount, String currency) {
        return new TradeDecision(Verdict.REVIEW_REQUIRED, message, amount, currency, null, null);
    }
}
