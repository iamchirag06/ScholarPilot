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

    // ⚡ THE HARD-RULE MATCHER + AI RANKER ⚡
    @GetMapping("/matched/{userId}")
    public List<Scheme> getMatchedSchemes(@PathVariable UUID userId) {
        Profile student = profileRepo.findAll().stream()
                .filter(p -> p.getUserId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Profile not found for this user"));

        List<Scheme> eligibleSchemes = schemeRepo.findAll().stream()
                .filter(scheme -> {

                    // --- RULE 1: STRICT CATEGORY MATCHING ---
                    boolean categoryMatch = scheme.getTargetCategory() == null ||
                            scheme.getTargetCategory().equalsIgnoreCase("ALL") ||
                            scheme.getTargetCategory().equalsIgnoreCase(student.getCategory());

                    // If it's a PWD scheme, the student MUST be disabled
                    if (scheme.getTargetCategory().equalsIgnoreCase("PWD")) {
                        categoryMatch = categoryMatch && Boolean.TRUE.equals(student.getIsDisabled());
                    }

                    // --- RULE 2: STRICT GENDER MATCHING ---
                    boolean genderMatch = scheme.getTargetGender() == null ||
                            scheme.getTargetGender().equalsIgnoreCase("ALL") ||
                            scheme.getTargetGender().equalsIgnoreCase(student.getGender());

                    // --- RULE 3: STRICT STATE MATCHING ---
                    boolean stateMatch = scheme.getTargetState() == null ||
                            scheme.getTargetState().equalsIgnoreCase("ALL") ||
                            scheme.getTargetState().equalsIgnoreCase(student.getState()) ||
                            (scheme.getTargetState().equals("NER") && isNorthEasternState(student.getState()));

                    // --- RULE 4: THE "STRICT OVERRIDE" INCOME LOGIC ---
                    // Default check: Does the student make less than the scheme's max limit?
                    boolean incomeMatch = scheme.getMaxIncome() == null ||
                            student.getAnnualIncome() <= scheme.getMaxIncome();

                    if (incomeMatch) {
                        String cat = student.getCategory().toUpperCase();
                        int income = student.getAnnualIncome();

                        // STRICT OVERRIDE A: SC/ST/OBC Government Schemes
                        // If the scheme is strictly for SC/ST/OBC, and it's a government portal (NSP/SocialJustice)
                        // we strictly enforce the 3.5 Lakh limit, even if the database says 8 Lakh.
                        if ((cat.equals("SC") || cat.equals("ST") || cat.equals("OBC")) &&
                                !scheme.getTargetCategory().equalsIgnoreCase("ALL") &&
                                !scheme.getSourcePortal().contains("Buddy4Study")) {

                            if (income > 350000) {
                                incomeMatch = false; // Strictly reject if income > 3.5L
                            }
                        }

                        // STRICT OVERRIDE B: The "Merit Exception"
                        // If a student has >85% marks, they bypass the income limit for "ALL" category merit schemes
                        if (scheme.getTargetCategory().equalsIgnoreCase("ALL") && student.getMarksPercentage() >= 85.0) {
                            // Do nothing, they pass the income check via merit
                        }
                        // STRICT OVERRIDE C: General Category strict limit for Private Scholarships
                        else if (cat.equals("GENERAL") && scheme.getSourcePortal().contains("Buddy4Study")) {
                            if (income > 600000) {
                                incomeMatch = false; // Private trusts usually cap General category at 6L
                            }
                        }
                    }

                    // The student must pass ALL strict rules
                    return categoryMatch && genderMatch && stateMatch && incomeMatch;
                })
                .collect(Collectors.toList());
        if (eligibleSchemes.isEmpty()) return eligibleSchemes;

        // Call Deepak's Python API for Ranking
        try {
            String pythonRankUrl = "https://unroasted-crib-plenty.ngrok-free.dev/api/rank";

            RankRequest rankRequest = new RankRequest();
            rankRequest.setSchemes(eligibleSchemes);

            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            headers.set("ngrok-skip-browser-warning", "true");

            org.springframework.http.HttpEntity<RankRequest> entity = new org.springframework.http.HttpEntity<>(rankRequest, headers);

            org.springframework.http.ResponseEntity<RankResponse> responseEntity =
                    restTemplate.postForEntity(pythonRankUrl, entity, RankResponse.class);

            RankResponse response = responseEntity.getBody();

            if (response != null && response.getRanked_candidates() != null) {
                java.util.Map<String, Integer> rankMap = new java.util.HashMap<>();
                for (RankedCandidate rc : response.getRanked_candidates()) {
                    rankMap.put(rc.getId(), rc.getRank());
                }

                eligibleSchemes.sort((s1, s2) -> {
                    int rank1 = rankMap.getOrDefault(s1.getId().toString(), 999);
                    int rank2 = rankMap.getOrDefault(s2.getId().toString(), 999);
                    return Integer.compare(rank1, rank2);
                });
            }
        } catch (Exception e) {
            System.out.println("⚠️ Python Ranker API failed. Returning unranked schemes. Error: " + e.getMessage());
        }

        return eligibleSchemes;
    }

    // 🤝 INTEGRATION ENDPOINT FOR GO & PYTHON 🤝
    @PostMapping("/save-from-go")
    public List<Scheme> saveFromGo(@RequestBody GoPayload payload) {
        System.out.println("📥 Received payload from Go: " + payload);

        List<Scheme> savedSchemes = new ArrayList<>();
        if (payload == null || payload.getSchemes() == null) {
            System.out.println("❌ ERROR: Payload or Schemes array is null.");
            return savedSchemes;
        }

        for (Scheme incomingScheme : payload.getSchemes()) {
            System.out.println("Processing scheme: " + incomingScheme.getSchemeName());
            incomingScheme.setLlmSummary("Generating AI summary...");

            try {
                String pythonApiUrl = "https://unroasted-crib-plenty.ngrok-free.dev/api/summarize";

                java.util.Map<String, String> requestBody = new java.util.HashMap<>();
                requestBody.put("raw_text", incomingScheme.getRawEligibilityText());

                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                headers.set("ngrok-skip-browser-warning", "true");

                org.springframework.http.HttpEntity<java.util.Map<String, String>> entity =
                        new org.springframework.http.HttpEntity<>(requestBody, headers);

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

    // 🤖 MOCK AUTO-FILL ENDPOINT FOR DEMO 🤖
    @GetMapping("/{schemeId}/auto-fill/{profileId}")
    public java.util.Map<String, Object> autoFillForm(@PathVariable UUID schemeId, @PathVariable UUID profileId) {
        Profile student = profileRepo.findById(profileId).orElseThrow();

        java.util.Map<String, Object> formFields = new java.util.HashMap<>();
        formFields.put("Full Name", student.getFullName());
        formFields.put("Category", student.getCategory());
        formFields.put("Annual Income", student.getAnnualIncome());
        formFields.put("State", student.getState());
        formFields.put("Course Level", student.getCourseLevel());
        formFields.put("Gender", student.getGender());
        formFields.put("Marks", student.getMarksPercentage());
        formFields.put("Aadhaar (Mock)", "XXXX-XXXX-1234");
        formFields.put("Status", "Pre-filled successfully ✅");

        return formFields;
    }

    // --- HELPER CLASSES ---

    @lombok.Data
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class GoPayload {
        @com.fasterxml.jackson.annotation.JsonProperty("job_id")
        private String job_id;

        @com.fasterxml.jackson.annotation.JsonProperty("schemes")
        private List<Scheme> schemes;
    }

    @lombok.Data
    public static class RankRequest {
        private List<Scheme> schemes;
    }

    @lombok.Data
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class RankResponse {
        private List<RankedCandidate> ranked_candidates;
    }

    @lombok.Data
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class RankedCandidate {
        private String id;
        private Integer rank;
        private Double rank_score;
    }
    // DTO for starting a crawl
    @lombok.Data
    public static class StartCrawlRequest {
        private List<String> urls; // e.g., ["NSP", "Haryana"]
    }

    // DTO for Go's response
    @lombok.Data
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class JobResponse {
        private String job_id;
        private String status;
        private Integer progress;
    }
    private boolean isNorthEasternState(String state) {
        if (state == null) return false;
        String[] neStates = {"Arunachal", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"};
        for (String s : neStates) {
            if (state.toLowerCase().contains(s.toLowerCase())) return true;
        }
        return false;
    }
}