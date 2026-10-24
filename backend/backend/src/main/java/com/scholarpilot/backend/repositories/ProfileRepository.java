package com.scholarpilot.backend.repositories;

import com.scholarpilot.backend.models.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {
}