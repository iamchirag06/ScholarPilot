package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Profile;
import com.scholarpilot.backend.models.Scheme;
import com.scholarpilot.backend.repositories.ProfileRepository;
import com.scholarpilot.backend.repositories.SchemeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
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
    @Autowired
    private RestTemplate restTemplate;

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

    // 2. Update his controller method to this:
    @PostMapping("/save-from-go")
    public List<Scheme> saveFromGo(@RequestBody GoPayload payload) {

        List<Scheme> savedSchemes = new ArrayList<>();

        // Loop through the array of schemes sent by Bharat
        for (Scheme incomingScheme : payload.getSchemes()) {

            incomingScheme.setLlmSummary("Generating AI summary...");

            // Note: You might want to remove this first save, and only save once at the end
            // Scheme savedScheme = schemeRepo.save(incomingScheme);

            try {
                // 1. Use Deepak's Ngrok URL
                String pythonApiUrl = "https://unroasted-crib-plenty.ngrok-free.dev/api/summarize";

                // 2. Create the request body
                java.util.Map<String, String> requestBody = new java.util.HashMap<>();
                requestBody.put("raw_text", incomingScheme.getRawEligibilityText());

                // 3. Create headers to bypass the Ngrok warning page
                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                headers.set("ngrok-skip-browser-warning", "true"); // <--- CRITICAL LINE

                // 4. Wrap body and headers in HttpEntity
                org.springframework.http.HttpEntity<java.util.Map<String, String>> entity =
                        new org.springframework.http.HttpEntity<>(requestBody, headers);

                // 5. Send the request
                org.springframework.http.ResponseEntity<java.util.Map> responseEntity =
                        restTemplate.postForEntity(pythonApiUrl, entity, java.util.Map.class);

                java.util.Map response = responseEntity.getBody();

                if (response != null && response.containsKey("summary")) {
                    incomingScheme.setLlmSummary((String) response.get("summary"));
                } else {
                    incomingScheme.setLlmSummary("AI summary unavailable.");
                }
            } catch (Exception e) {
                System.out.println("⚠️ Python API failed. Error: " + e.getMessage());
                incomingScheme.setLlmSummary("Error generating summary.");
            }

            savedSchemes.add(schemeRepo.save(incomingScheme));
        }

        return savedSchemes;
    }
    @lombok.Data
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class GoPayload {
        @com.fasterxml.jackson.annotation.JsonProperty("job_id")
        private String job_id;

        @com.fasterxml.jackson.annotation.JsonProperty("schemes")
        private List<Scheme> schemes;
    }
}