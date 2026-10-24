package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Application;
import com.scholarpilot.backend.repositories.ApplicationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/applications")
@CrossOrigin(origins = "*")
public class ApplicationController {

    @Autowired
    private ApplicationRepository appRepo;

    // Abhishek will call this when the user clicks "Apply" or "Track"
    @PostMapping("/create")
    public Application createApplication(@RequestBody Application application) {
        application.setAppliedAt(LocalDateTime.now());
        return appRepo.save(application);
    }

    // Abhishek will call this to update the status on the Kanban board
    @PutMapping("/{id}/status")
    public Application updateStatus(@PathVariable UUID id, @RequestParam String newStatus) {
        Application app = appRepo.findById(id).orElseThrow();
        app.setStatus(newStatus);
        return appRepo.save(app);
    }

    // Get all applications for a specific user
    @GetMapping("/user/{userId}")
    public List<Application> getUserApplications(@PathVariable UUID userId) {
        return appRepo.findAll().stream()
                .filter(app -> app.getUserId().equals(userId))
                .toList();
    }
}