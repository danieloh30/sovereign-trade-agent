package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.acme.agent.HumanReviewAgent;
import org.acme.model.TradeDecision;
import org.acme.model.TradeDecision.Verdict;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
class ReviewResourceTest {
    @Inject HumanReviewAgent agent;

    private TradeDecision decision(Verdict verdict, Long ruleId) {
        return new TradeDecision(verdict, "Demo policy requires manual review.", new BigDecimal("12500.00"),
                "GBP", ruleId, new BigDecimal("10000.00"));
    }

    private long request() {
        return agent.requestReview("Check a £12,500 GBP payment.", decision(Verdict.REJECTED, 1L),
                "llama3.2", "12345678901234567890123456789012");
    }

    private Map<String, String> submission(String outcome, String reviewer, String note) {
        return Map.of("outcome", outcome, "reviewer", reviewer, "note", note);
    }

    @Test
    void humanApprovalPreservesTheOriginalPolicyEvidence() {
        long id = request();
        given().get("/trade/reviews/{id}", id).then().statusCode(200)
                .body("status", equalTo("PENDING"))
                .body("query", equalTo("Check a £12,500 GBP payment."))
                .body("decision.verdict", equalTo("REJECTED"))
                .body("decision.ruleId", equalTo(1))
                .body("analysisTraceId", equalTo("12345678901234567890123456789012"))
                .body("reviewedAt", nullValue());
        given().contentType("application/json").body(submission("APPROVED", " Daniel ", " Vendor verified. "))
                .post("/trade/reviews/{id}/decision", id).then().statusCode(200)
                .body("status", equalTo("APPROVED"))
                .body("reviewer", equalTo("Daniel"))
                .body("note", equalTo("Vendor verified."))
                .body("reviewedAt", notNullValue())
                .body("decision.verdict", equalTo("REJECTED"))
                .body("decision.amount", equalTo(12500.0f));
        given().get("/trade/reviews").then().statusCode(200)
                .body("find { it.id == " + id + " }.status", equalTo("APPROVED"));
        given().get("/trade/reviews/{id}", id).then().statusCode(200)
                .body("status", equalTo("APPROVED"));
    }

    @Test
    void identicalRetriesAreIdempotentAndConflictingDecisionsAreRejected() {
        long id = request();
        var body = submission("DECLINED", "Reviewer", "Supplier details could not be verified.");
        String firstTime = given().contentType("application/json").body(body)
                .post("/trade/reviews/{id}/decision", id).then().statusCode(200)
                .extract().path("reviewedAt");
        given().contentType("application/json").body(body)
                .post("/trade/reviews/{id}/decision", id).then().statusCode(200)
                .body("reviewedAt", equalTo(firstTime));
        given().contentType("application/json").body(submission("APPROVED", "Other reviewer", "Override."))
                .post("/trade/reviews/{id}/decision", id).then().statusCode(409);
        given().get("/trade/reviews/{id}", id).then().statusCode(200)
                .body("status", equalTo("DECLINED"))
                .body("reviewer", equalTo("Reviewer"));
    }

    @Test
    void incompleteOrInvalidHumanDecisionsLeaveTheRequestPending() {
        long id = request();
        var bodies = new Object[]{null, submission("PENDING", "Reviewer", "Note"),
                submission("APPROVED", " ", "Note"), submission("DECLINED", "Reviewer", " "),
                submission("APPROVED", "x".repeat(81), "Note"),
                submission("APPROVED", "Reviewer", "x".repeat(1001))};
        for (Object body : bodies) {
            given().contentType("application/json").body(body == null ? "null" : body)
                    .post("/trade/reviews/{id}/decision", id).then().statusCode(400);
        }
        given().get("/trade/reviews/{id}", id).then().statusCode(200)
                .body("status", equalTo("PENDING"));
    }

    @Test
    void concurrentReviewersCannotOverwriteEachOther() throws Exception {
        long id = request();
        var approval = CompletableFuture.supplyAsync(() -> given().contentType("application/json")
                .body(submission("APPROVED", "First", "Verified."))
                .post("/trade/reviews/{id}/decision", id).statusCode());
        var decline = CompletableFuture.supplyAsync(() -> given().contentType("application/json")
                .body(submission("DECLINED", "Second", "Not verified."))
                .post("/trade/reviews/{id}/decision", id).statusCode());
        int a = approval.get(10, TimeUnit.SECONDS);
        int b = decline.get(10, TimeUnit.SECONDS);
        assertTrue((a == 200 && b == 409) || (a == 409 && b == 200));
    }

    @ParameterizedTest
    @EnumSource(value = Verdict.class, names = {"CLEARED", "WARNING", "REVIEW_REQUIRED", "ERROR"})
    void onlyMatchedManualReviewPoliciesCreateRequests(Verdict verdict) {
        assertNull(agent.requestReview("Check a payment.", decision(verdict, 1L), "model", null));
    }

    @Test
    void aMissingRuleCannotCreateAnApprovableRequest() {
        assertNull(agent.requestReview("Unverified payment.", decision(Verdict.REJECTED, null), "model", null));
    }

    @Test
    void missingReviewRequestsReturnNotFound() {
        given().get("/trade/reviews/999999999").then().statusCode(404);
        given().contentType("application/json").body(submission("APPROVED", "Reviewer", "Verified."))
                .post("/trade/reviews/999999999/decision").then().statusCode(404);
    }
}
