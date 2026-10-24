package com.scholarpilot.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "applications")
@Data
public class Application {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId; // Links to the Profile ID
    private UUID schemeId; // Links to the Scheme ID
    private String status; // ELIGIBLE, APPLIED, APPROVED
    private LocalDateTime appliedAt;
}