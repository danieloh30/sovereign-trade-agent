package org.acme.model;

import java.time.Instant;
import org.acme.entity.ReviewRequest;
import org.acme.entity.ReviewRequest.Status;

public record ReviewResponse(Long id, String query, TradeDecision decision, String model,
        String analysisTraceId, Status status, Instant createdAt, String reviewer,
        String note, Instant reviewedAt, String reviewTraceId) {
    public static ReviewResponse from(ReviewRequest request) {
        return new ReviewResponse(request.id, request.query,
                new TradeDecision(request.policyVerdict, request.policyMessage, request.amount,
                        request.currency, request.ruleId, request.threshold),
                request.model, request.analysisTraceId, request.status, request.createdAt,
                request.reviewer, request.note, request.reviewedAt, request.reviewTraceId);
    }
}
