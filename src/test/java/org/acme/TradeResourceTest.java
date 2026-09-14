package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class TradeResourceTest {
    @ParameterizedTest
    @CsvSource({"12500,GBP,REJECTED,1", "7500,GBP,WARNING,2", "3200,GBP,CLEARED,3", "9000,EUR,CLEARED,5"})
    void returnsVerifiedToolDecisions(int amount, String currency, String verdict, int ruleId) {
        given().contentType("text/plain")
                .body("Check AML status for a " + amount + " " + currency + " transaction.")
                .when().post("/trade/analyze")
                .then().statusCode(200).contentType("application/json")
                .body("decision.verdict", equalTo(verdict))
                .body("decision.ruleId", equalTo(ruleId))
                .body("decision.currency", equalTo(currency))
                .body("decision.amount", equalTo((float) amount))
                .body("model", not(emptyOrNullString()))
                .body("durationMs", greaterThanOrEqualTo(0));
    }

    @Test
    void rejectsInvalidPromptsBeforeCallingTheModel() {
        for (String prompt : new String[]{"", "   ", "x".repeat(2001)}) {
            given().contentType("text/plain").body(prompt)
                    .when().post("/trade/analyze")
                    .then().statusCode(400).body("decision.verdict", equalTo("ERROR"));
        }
    }
}
