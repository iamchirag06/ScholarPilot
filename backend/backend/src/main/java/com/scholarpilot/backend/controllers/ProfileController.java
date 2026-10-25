package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Profile;
import com.scholarpilot.backend.repositories.ProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;
import java.io.IOException;
import java.util.UUID;

import java.util.UUID;

@RestController
@RequestMapping("/api/profiles")
@CrossOrigin(origins = "*")
public class ProfileController {


    // Inject Cloudinary
    @Autowired
    private Cloudinary cloudinary;
    @Autowired
    private ProfileRepository profileRepo;

    // 🚀 Upload Document Endpoint
    @PostMapping("/{id}/upload-document")
    public Profile uploadDocument(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            @RequestParam("docType") String docType) throws IOException {

        Profile profile = profileRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Profile not found"));

        // 1. Upload to Cloudinary
        Map uploadResult = cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap(
                "resource_type", "auto",
                "public_id", "user_docs/" + id + "_" + docType + "_" + System.currentTimeMillis()
        ));

        String secureUrl = (String) uploadResult.get("secure_url");

        // 2. Add to the Map (Do not overwrite!)
        Map<String, String> currentDocs = profile.getDocuments();
        if (currentDocs == null) {
            currentDocs = new HashMap<>();
        }
        currentDocs.put(docType, secureUrl); // e.g., currentDocs.put("aadhaar", "https://...")

        profile.setDocuments(currentDocs);
        return profileRepo.save(profile);
    }

    @PostMapping("/create")
    public Profile createProfile(@RequestBody Profile profile) {
        return profileRepo.save(profile);
    }

    // Fetch profile by Profile ID OR User ID
    @GetMapping("/{id}")
    public Profile getProfile(@PathVariable String id) {
        // Try to find by Profile ID first
        try {
            UUID profileId = UUID.fromString(id);
            java.util.Optional<Profile> profileById = profileRepo.findById(profileId);
            if (profileById.isPresent()) {
                return profileById.get();
            }
        } catch (IllegalArgumentException e) {
            // It wasn't a valid UUID, ignore and try userId
        }

        // If not found by Profile ID, try to find by User ID
        try {
            UUID userId = UUID.fromString(id);
            return profileRepo.findAll().stream()
                    .filter(p -> p.getUserId().equals(userId))
                    .findFirst()
                    .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                            org.springframework.http.HttpStatus.NOT_FOUND, "Profile not found for ID: " + id));
        } catch (IllegalArgumentException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid UUID format: " + id);
        }
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
        if (updatedProfile.getMarksPercentage() != null)
            existingProfile.setMarksPercentage(updatedProfile.getMarksPercentage());

        // 3. Save the updated profile back to the database
        return profileRepo.save(existingProfile);
    }
}