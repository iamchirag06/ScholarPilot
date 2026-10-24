package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Profile;
import com.scholarpilot.backend.repositories.ProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

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
}