package org.acme.client;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;
import org.acme.model.Customer;
import org.acme.model.Transaction;

@Path("/api/v1")
@RegisterRestClient(configKey = "erp-api")
public interface ErpClient {

    @GET
    @Path("/customers/{customerId}")
    Customer getCustomer(@PathParam("customerId") String customerId);

    @GET
    @Path("/transactions/{transactionId}")
    Transaction getTransaction(@PathParam("transactionId") String transactionId);
}