package org.acme.agent;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import org.acme.model.ReviewResponse;
import org.acme.model.ReviewSubmission;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;

@Path("/trade/reviews")
@Produces(MediaType.APPLICATION_JSON)
public class ReviewResource {
    @Inject HumanReviewAgent reviews;

    @GET
    @Operation(summary = "List the latest 50 human review requests")
    public List<ReviewResponse> list() {
        return reviews.recentRequests();
    }

    @GET
    @Path("/{id}")
    @Operation(summary = "Read a human review request and its original policy evidence")
    @APIResponse(responseCode = "200", description = "Human review request and original policy evidence",
            content = @Content(schema = @Schema(implementation = ReviewResponse.class)))
    @APIResponse(responseCode = "404", description = "Review request not found")
    public ReviewResponse get(@PathParam("id") long id) {
        return reviews.getRequest(id);
    }

    @POST
    @Path("/{id}/decision")
    @Consumes(MediaType.APPLICATION_JSON)
    @Operation(summary = "Record a human approval or decline",
            description = "Demo reviewer identity is self-reported. A name and note are required. The original policy verdict is preserved and no payment is executed. An identical retry returns the original decision; a conflicting decision returns 409.")
    @APIResponse(responseCode = "200", description = "Recorded human decision and original policy evidence",
            content = @Content(schema = @Schema(implementation = ReviewResponse.class)))
    @APIResponse(responseCode = "400", description = "Invalid outcome, reviewer, or note")
    @APIResponse(responseCode = "404", description = "Review request not found")
    @APIResponse(responseCode = "409", description = "Request already has a different human decision")
    public ReviewResponse decide(@PathParam("id") long id, ReviewSubmission submission) {
        return reviews.recordDecision(id, submission);
    }
}
