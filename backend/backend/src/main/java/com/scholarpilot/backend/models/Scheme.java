package com.scholarpilot.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore; // <-- ADD THIS IMPORT
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;

@Entity
@Table(name = "schemes")
@Data
public class Scheme {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @JsonIgnore // <-- ADD THIS LINE! It tells Spring: "Ignore the ID coming from Go, we will generate our own."
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

    @Convert(converter = StringListConverter.class)
    private List<String> requiredDocuments;
    private Double confidenceScore;

    private String targetCategory;
    private Integer maxIncome;
    private String targetState;
}