package org.acme;

import jakarta.inject.Inject;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import org.acme.agent.TradeSovereignAgent;

@Path("/trade")
public class TradeResourceTest {

    @Inject
    TradeSovereignAgent agent;

    @POST
    @Path("/analyze")
    public String analyze(String userPrompt) {
        return agent.processClaim(userPrompt);
    }
}
