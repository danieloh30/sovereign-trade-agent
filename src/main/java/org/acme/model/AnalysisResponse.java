package org.acme.model;

public record AnalysisResponse(TradeDecision decision, String model, String traceId, long durationMs) {}
