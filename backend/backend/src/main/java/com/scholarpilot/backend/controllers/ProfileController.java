package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Profile;
import com.scholarpilot.backend.repositories.ProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/profiles")
@CrossOrigin(origins = "*")
public class ProfileController {

    @Autowired
    private ProfileRepository profileRepo;

    @PostMapping("/create")
    public Profile createProfile(@RequestBody Profile profile) {
        return profileRepo.save(profile);
    }
    // Fetch the user's profile so the frontend can display it or auto-fill forms
    @GetMapping("/{id}")
    public Profile getProfile(@PathVariable UUID id) {
        return profileRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Profile not found"));
    }
    // Fetch all profiles (FOR DEVELOPMENT/TESTING ONLY)
    @GetMapping("/all")
    public java.util.List<Profile> getAllProfiles() {
        return profileRepo.findAll();
    }
    // Update an existing profile
    @PutMapping("/{id}")
    public Profile updateProfile(@PathVariable UUID id, @RequestBody Profile updatedProfile) {
        // 1. Find the existing profile in Neon DB
        Profile existingProfile = profileRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Profile not found with id: " + id));

        // 2. Update the fields (only if they are provided in the request)
        if (updatedProfile.getFullName() != null) existingProfile.setFullName(updatedProfile.getFullName());
        if (updatedProfile.getCategory() != null) existingProfile.setCategory(updatedProfile.getCategory());
        if (updatedProfile.getAnnualIncome() != null) existingProfile.setAnnualIncome(updatedProfile.getAnnualIncome());
        if (updatedProfile.getState() != null) existingProfile.setState(updatedProfile.getState());
        if (updatedProfile.getCourseLevel() != null) existingProfile.setCourseLevel(updatedProfile.getCourseLevel());
        if (updatedProfile.getGender() != null) existingProfile.setGender(updatedProfile.getGender());
        if (updatedProfile.getIsDisabled() != null) existingProfile.setIsDisabled(updatedProfile.getIsDisabled());
        if (updatedProfile.getMarksPercentage() != null) existingProfile.setMarksPercentage(updatedProfile.getMarksPercentage());

        // 3. Save the updated profile back to the database
        return profileRepo.save(existingProfile);
    }
}