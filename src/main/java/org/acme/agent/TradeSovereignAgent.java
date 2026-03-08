package org.acme.agent;

import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import io.quarkiverse.langchain4j.RegisterAiService;
import jakarta.enterprise.context.ApplicationScoped;

@RegisterAiService
@ApplicationScoped
public interface TradeSovereignAgent {

    @SystemMessage("""
        You are a Sovereign Trade Assistant for the Singaporean market. 
        You have access to local regulatory tools and the internal ERP.
        Analyze the user's trade claim. If information is missing, use your tools.
        Always ensure data remains within the 'SG-LOCAL' boundary.
        """)
    String processClaim(@UserMessage String claimDetails);
}