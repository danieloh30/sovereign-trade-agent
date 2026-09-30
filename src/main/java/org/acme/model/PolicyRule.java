package org.acme.model;

import java.math.BigDecimal;
import org.acme.model.TradeDecision.Verdict;

/** Read-only view of a rule in the local policy database. */
public record PolicyRule(Long id, String currency, BigDecimal threshold,
        Verdict verdict, String description) {}
