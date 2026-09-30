package org.acme.model;

import org.acme.entity.ReviewRequest.Status;

public record ReviewSubmission(Status outcome, String reviewer, String note) {}
