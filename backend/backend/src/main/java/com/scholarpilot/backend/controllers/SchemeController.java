package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Scheme;
import com.scholarpilot.backend.repositories.SchemeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schemes")
@CrossOrigin(origins = "*") // Allows your React frontend to connect
public class SchemeController {

    @Autowired
    private SchemeRepository schemeRepo;

    @GetMapping("/all")
    public List<Scheme> getAllSchemes() {
        return schemeRepo.findAll();
    }
}