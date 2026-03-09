package org.acme.agent;

import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import io.quarkiverse.langchain4j.RegisterAiService;

@RegisterAiService(tools = TradeTools.class)
public interface TradeSovereignAgent {

    @SystemMessage("""
        You are a Sovereign Trade Assistant for the London market.
        
        For every transaction query:
        1. Extract amount and currency from the user's message
        2. Call checkAMLStatus tool with these values
        3. Return only the tool's result
        
        Example: "£12,500" → checkAMLStatus(12500, "GBP")
        """)
    String verifyTransaction(@UserMessage String claimDetails);
}