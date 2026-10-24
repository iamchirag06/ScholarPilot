package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Profile;
import com.scholarpilot.backend.models.Scheme;
import com.scholarpilot.backend.repositories.ProfileRepository;
import com.scholarpilot.backend.repositories.SchemeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/schemes")
@CrossOrigin(origins = "*")
public class SchemeController {

    @Autowired
    private SchemeRepository schemeRepo;

    @Autowired
    private ProfileRepository profileRepo;

    @GetMapping("/all")
    public List<Scheme> getAllSchemes() {
        return schemeRepo.findAll();
    }

    // ⚡ THE HARD-RULE MATCHER ⚡
    @GetMapping("/matched/{profileId}")
    public List<Scheme> getMatchedSchemes(@PathVariable UUID profileId) {
        // 1. Get the student's profile
        Profile student = profileRepo.findById(profileId)
                .orElseThrow(() -> new RuntimeException("Profile not found"));

        // 2. Get all schemes from the database
        List<Scheme> allSchemes = schemeRepo.findAll();

        // 3. The Filter Logic
        return allSchemes.stream()
                .filter(scheme -> {
                    // Check Category (Either the scheme is for ALL, or it matches the student)
                    boolean categoryMatch = scheme.getTargetCategory() == null ||
                            scheme.getTargetCategory().equalsIgnoreCase("ALL") ||
                            scheme.getTargetCategory().equalsIgnoreCase(student.getCategory());

                    // Check Income (Either no limit, or student income is below limit)
                    boolean incomeMatch = scheme.getMaxIncome() == null ||
                            student.getAnnualIncome() <= scheme.getMaxIncome();

                    // Check State (Either ALL, or matches student state)
                    boolean stateMatch = scheme.getTargetState() == null ||
                            scheme.getTargetState().equalsIgnoreCase("ALL") ||
                            scheme.getTargetState().equalsIgnoreCase(student.getState());

                    return categoryMatch && incomeMatch && stateMatch;
                })
                .collect(Collectors.toList());
    }
    // 🤝 INTEGRATION ENDPOINT FOR GO & PYTHON 🤝
    // Bharat (Go) will call this with the scraped data
    @PostMapping("/save-from-go")
    public Scheme saveFromGo(@RequestBody Scheme incomingScheme) {

        // 1. Save the raw scraped data to Neon DB (with a temporary summary)
        incomingScheme.setLlmSummary("Generating AI summary...");
        Scheme savedScheme = schemeRepo.save(incomingScheme);

        // 2. (Optional but recommended) Call Deepak's Python API here
        // String aiSummary = restTemplate.postForObject("http://localhost:8000/summarize", savedScheme.getRawEligibilityText(), String.class);
        // savedScheme.setLlmSummary(aiSummary);
        // schemeRepo.save(savedScheme);

        return savedScheme;
    }
}