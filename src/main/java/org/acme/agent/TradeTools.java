package org.acme.agent;

import dev.langchain4j.agent.tool.Tool;
import io.opentelemetry.instrumentation.annotations.WithSpan;
import io.opentelemetry.instrumentation.annotations.SpanAttribute;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import org.acme.entity.AmlRule;
import org.acme.client.ErpClient;
import org.acme.model.Customer;
import org.eclipse.microprofile.rest.client.inject.RestClient;

@ApplicationScoped
public class TradeTools {

    @RestClient
    ErpClient erpClient;

    @Tool("Check transaction against FCA anti-money laundering (AML) rules stored in local regulatory database")
    @WithSpan("checkAMLStatus")
    @Transactional
    public String checkAMLStatus(
            @SpanAttribute("transaction.amount") double amount,
            @SpanAttribute("transaction.currency") String currency) {
        // Query local regulatory database for AML rules
        AmlRule rule = AmlRule.findByCurrencyAndAmount(currency, amount);
        
        if (rule != null) {
            return rule.action + ": " + rule.description;
        }
        
        // Default response if no rule found
        return "CLEARED: Transaction within standard sovereign limits.";
    }

    @Tool("Retrieve customer information from Enterprise ERP system")
    @WithSpan("getCustomerInfo")
    public String getCustomerInfo(@SpanAttribute("customer.id") String customerId) {
        try {
            Customer customer = erpClient.getCustomer(customerId);
            return String.format("Customer: %s, Account Type: %s, Risk Level: %s, Credit Limit: %.2f %s, Country: %s",
                customer.name, customer.accountType, customer.riskLevel,
                customer.creditLimit, "GBP", customer.country);
        } catch (Exception e) {
            return "ERROR: Unable to retrieve customer information from ERP system - " + e.getMessage();
        }
    }
}