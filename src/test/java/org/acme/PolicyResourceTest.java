package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.narayana.jta.QuarkusTransaction;
import java.math.BigDecimal;
import org.acme.entity.AmlRule;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class PolicyResourceTest {
    @Test
    void listsPolicyContractsInSelectionOrder() {
        given().when().get("/trade/policies").then().statusCode(200)
                .contentType("application/json")
                .body("size()", equalTo(7))
                .body("id", contains(4, 5, 1, 2, 3, 6, 7))
                .body("[2].currency", equalTo("GBP"))
                .body("[2].threshold", equalTo(10000.0f))
                .body("[2].verdict", equalTo("REJECTED"))
                .body("[2].description", containsString("manual review"));
    }

    @Test
    void readsCurrentDatabaseValues() {
        BigDecimal original = QuarkusTransaction.requiringNew().call(() -> {
            AmlRule rule = AmlRule.findById(1L);
            BigDecimal previous = rule.thresholdAmount;
            rule.thresholdAmount = new BigDecimal("11000.00");
            return previous;
        });
        try {
            given().when().get("/trade/policies").then().statusCode(200)
                    .body("find { it.id == 1 }.threshold", equalTo(11000.0f));
        } finally {
            QuarkusTransaction.requiringNew().run(() -> {
                AmlRule rule = AmlRule.findById(1L);
                rule.thresholdAmount = original;
            });
        }
    }

    @Test
    void documentsAnalysisEnvelopeAndReadOnlyPolicies() {
        var schema = given().accept("application/json").when().get("/q/openapi")
                .then().statusCode(200).extract().jsonPath();
        assertEquals("Check one payment against local demo policies",
                schema.getString("paths.'/trade/analyze'.post.summary"));
        assertEquals("#/components/schemas/AnalysisResponse",
                schema.getString("paths.'/trade/analyze'.post.responses.'503'.content.'application/json'.schema.'$ref'"));
        assertEquals("Read the current local demo policies",
                schema.getString("paths.'/trade/policies'.get.summary"));
        given().when().post("/trade/policies").then().statusCode(405);
    }
}
