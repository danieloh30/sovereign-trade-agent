package org.acme.agent;

import dev.langchain4j.agent.tool.Tool;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.rest.client.inject.RestClient;

@ApplicationScoped
public class TradeTools {

    @Tool("Check if a trade claim complies with SG-TRADE-2026 regulations")
    public String checkCompliance(String claimId) {
        // In a real demo, this calls a local SQL DB or a secure internal API
        return "Claim " + claimId + ": COMPLIANT (Regulation SG-v2.1)";
    }

    @Tool("Fetch shipment status from the internal Enterprise ERP")
    public String getERPShipmentStatus(String trackingNumber) {
        return "Shipment " + trackingNumber + " is currently at Port of Singapore (PSA).";
    }
}