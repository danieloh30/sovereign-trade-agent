package org.acme.agent;

import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;

@Path("/trade")
public class TradeResource {

    @Inject TradeSovereignAgent agent;

    @POST
    @Path("/analyze")
    public String analyze(String userPrompt) {
        return agent.verifyTransaction(userPrompt);
    }
}