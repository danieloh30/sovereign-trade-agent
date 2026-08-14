package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
public class TradeResourceTest {

    @Test
    void analyzeTransactionReturnsResponse() {
        given()
            .contentType("text/plain")
            .body("Check AML status for a £12,500 GBP transaction")
            .when()
            .post("/trade/analyze")
            .then()
            .statusCode(200)
            .body(notNullValue());
    }

    @Test
    void analyzeTransactionWithEmptyBodyReturns400or200() {
        given()
            .contentType("text/plain")
            .body("")
            .when()
            .post("/trade/analyze")
            .then()
            .statusCode(200);
    }
}
