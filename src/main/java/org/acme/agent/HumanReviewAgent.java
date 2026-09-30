package org.acme.agent;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.acme.entity.ReviewRequest;
import org.acme.entity.ReviewRequest.Status;
import org.acme.model.ReviewResponse;
import org.acme.model.ReviewSubmission;
import org.acme.model.TradeDecision;
import org.acme.model.TradeDecision.Verdict;

/** Deterministic human handoff coordinator; it never generates a human decision with an LLM. */
@ApplicationScoped
public class HumanReviewAgent {
    @Transactional
    @WithSpan("requestHumanReview")
    public Long requestReview(String query, TradeDecision decision, String model, String analysisTraceId) {
        if (decision.verdict() != Verdict.REJECTED || decision.ruleId() == null) return null;
        var request = new ReviewRequest();
        request.query = query;
        request.status = Status.PENDING;
        request.policyVerdict = decision.verdict();
        request.policyMessage = decision.message();
        request.amount = decision.amount();
        request.currency = decision.currency();
        request.ruleId = decision.ruleId();
        request.threshold = decision.threshold();
        request.model = model;
        request.analysisTraceId = analysisTraceId;
        request.createdAt = Instant.now();
        request.persist();
        Span.current().setAttribute("review.request.id", request.id);
        return request.id;
    }

    @Transactional
    public List<ReviewResponse> recentRequests() {
        return ReviewRequest.<ReviewRequest>find("order by createdAt desc, id desc")
                .range(0, 49).list().stream().map(ReviewResponse::from).toList();
    }

    @Transactional
    public ReviewResponse getRequest(long id) {
        ReviewRequest request = ReviewRequest.findById(id);
        if (request == null) throw problem(404, "Review request not found.");
        return ReviewResponse.from(request);
    }

    @Transactional
    @WithSpan("recordHumanDecision")
    public ReviewResponse recordDecision(long id, ReviewSubmission submission) {
        if (submission == null || (submission.outcome() != Status.APPROVED && submission.outcome() != Status.DECLINED)
                || submission.reviewer() == null || submission.reviewer().isBlank() || submission.reviewer().length() > 80
                || submission.note() == null || submission.note().isBlank() || submission.note().length() > 1000) {
            throw problem(400, "Choose approve or decline and provide a reviewer name (1–80 characters) and note (1–1,000 characters).");
        }
        String reviewer = submission.reviewer().strip();
        String note = submission.note().strip();
        ReviewRequest request = ReviewRequest.findById(id, LockModeType.PESSIMISTIC_WRITE);
        if (request == null) throw problem(404, "Review request not found.");
        if (request.status != Status.PENDING) {
            // Retrying an identical decision after a network failure must not overwrite its audit trail.
            if (request.status == submission.outcome() && Objects.equals(request.reviewer, reviewer)
                    && Objects.equals(request.note, note)) return ReviewResponse.from(request);
            throw problem(409, "This request already has a human decision. Refresh to see it.");
        }
        request.status = submission.outcome();
        request.reviewer = reviewer;
        request.note = note;
        request.reviewedAt = Instant.now();
        var context = Span.current().getSpanContext();
        request.reviewTraceId = context.isValid() ? context.getTraceId() : null;
        Span.current().setAttribute("review.request.id", id);
        Span.current().setAttribute("review.outcome", request.status.name());
        return ReviewResponse.from(request);
    }

    private WebApplicationException problem(int status, String message) {
        return new WebApplicationException(Response.status(status).entity(Map.of("message", message)).build());
    }
}
