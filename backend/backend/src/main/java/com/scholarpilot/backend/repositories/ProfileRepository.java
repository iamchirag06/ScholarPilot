package com.scholarpilot.backend.repositories;

import com.scholarpilot.backend.models.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    // Spring Boot will automatically write the SQL query for this!
    Optional<Profile> findByFullNameAndState(String fullName, String state);
}