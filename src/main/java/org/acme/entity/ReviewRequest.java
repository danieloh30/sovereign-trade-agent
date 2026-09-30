package org.acme.entity;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.acme.model.TradeDecision.Verdict;

@Entity
@Table(name = "review_requests")
public class ReviewRequest extends PanacheEntity {
    public enum Status { PENDING, APPROVED, DECLINED }

    @Column(nullable = false, length = 2000)
    public String query;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Status status;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Verdict policyVerdict;
    public String policyMessage;
    @Column(precision = 19, scale = 2)
    public BigDecimal amount;
    public String currency;
    public Long ruleId;
    @Column(precision = 19, scale = 2)
    public BigDecimal threshold;
    public String model;
    public String analysisTraceId;
    @Column(nullable = false)
    public Instant createdAt;
    @Column(length = 80)
    public String reviewer;
    @Column(length = 1000)
    public String note;
    public Instant reviewedAt;
    public String reviewTraceId;
}
