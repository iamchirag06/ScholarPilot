package com.scholarpilot.backend.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/crawl")
@CrossOrigin(origins = "*")
public class CrawlController {

    @Autowired
    private RestTemplate restTemplate;

    // NOTE: Replace this with Bharat's Go Ngrok URL if he is not running locally!
    private final String GO_BACKEND_URL = "https://scholarpilot-7cep.onrender.com";

    // 1. React calls this to start the crawl
    @PostMapping("/start")
    public ResponseEntity<?> startCrawl(@RequestBody Map<String, Object> requestBody) {
        try {
            // Forward the request to Bharat's Go backend
            String goUrl = GO_BACKEND_URL + "/api/crawl";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(goUrl, entity, Map.class);
            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            System.out.println("⚠️ Failed to reach Go backend: " + e.getMessage());
            // Hackathon fallback: If Go is down, return a fake job ID so the frontend doesn't crash
            Map<String, String> fallback = new HashMap<>();
            fallback.put("job_id", "mock-job-123");
            fallback.put("status", "mock_running");
            return ResponseEntity.ok(fallback);
        }
    }

    // 2. React polls this to get progress
    @GetMapping("/status/{jobId}")
    public ResponseEntity<?> getCrawlStatus(@PathVariable String jobId) {
        try {
            // Ask Bharat's Go backend for the status
            String goUrl = GO_BACKEND_URL + "/api/crawl/status/" + jobId;

            ResponseEntity<Map> response = restTemplate.getForEntity(goUrl, Map.class);
            return ResponseEntity.ok(response.getBody());

        } catch (Exception e) {
            System.out.println("⚠️ Failed to fetch status from Go: " + e.getMessage());
            // Hackathon fallback: Fake progress
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("job_id", jobId);
            fallback.put("status", "completed");
            fallback.put("progress", 100);
            return ResponseEntity.ok(fallback);
        }
    }
}