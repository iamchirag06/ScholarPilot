package com.scholarpilot.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.Map;
import java.util.HashMap;

@Entity
@Table(name = "profiles")
@Data
public class Profile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String fullName;
    private String category; // GENERAL, OBC, SC, ST, EWS
    private Integer annualIncome;
    private String state;
    private String courseLevel; // CLASS_10, CLASS_12, UG, PG
    private String gender;
    private Boolean isDisabled;
    private Double marksPercentage;

    // Inside Profile.java, add this:
    @Column(unique = true, nullable = false)
    private UUID userId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> documents = new HashMap<>();
}