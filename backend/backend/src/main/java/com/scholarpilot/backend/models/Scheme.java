package com.scholarpilot.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "schemes")
@Data
public class Scheme {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String sourcePortal;
    private String schemeName;
    private String provider;
    private Integer awardAmount;
    private LocalDate deadline;
    private String applyLink;

    @Column(columnDefinition = "TEXT")
    private String rawEligibilityText;

    @Column(columnDefinition = "TEXT")
    private String llmSummary;

    private String requiredDocuments;
    private Double confidenceScore;

    // Java's Hard-Rule Matching Fields
    private String targetCategory; // "ALL", "OBC", etc.
    private Integer maxIncome;
    private String targetState; // "ALL", "Haryana", etc.
}