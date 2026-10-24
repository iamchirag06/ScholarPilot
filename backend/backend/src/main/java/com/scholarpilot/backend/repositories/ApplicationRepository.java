package com.scholarpilot.backend.repositories;

import com.scholarpilot.backend.models.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface ApplicationRepository extends JpaRepository<Application, UUID> {
}