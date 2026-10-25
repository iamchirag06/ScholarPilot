package com.scholarpilot.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "schemes")
@Data
public class Scheme {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private UUID id;

    @Column(columnDefinition = "TEXT")
    private String sourcePortal;

    @Column(columnDefinition = "TEXT")
    private String schemeName;

    @Column(columnDefinition = "TEXT")
    private String provider;

    private Integer awardAmount;
    private LocalDate deadline;

    @Column(columnDefinition = "TEXT")
    private String applyLink;

    @Column(columnDefinition = "TEXT")
    private String rawEligibilityText;

    @Column(columnDefinition = "TEXT")
    private String llmSummary;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> requiredDocuments;

    private Double confidenceScore;
    private String targetCategory;
    private Integer maxIncome;
    private String targetState;

    private String targetGender; // "FEMALE", "MALE", or "ALL"
}