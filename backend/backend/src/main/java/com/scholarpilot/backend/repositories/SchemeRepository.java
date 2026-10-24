package com.scholarpilot.backend.repositories;

import com.scholarpilot.backend.models.Scheme;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface SchemeRepository extends JpaRepository<Scheme, UUID> {
}