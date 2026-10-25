package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.User;
import com.scholarpilot.backend.repositories.UserRepository;
import com.scholarpilot.backend.security.JwtUtil;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private JwtUtil jwtUtil;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequest request) {
        if (userRepo.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists!");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setFullName(request.getName());
        user.setPassword(request.getPassword()); // Note: Use BCrypt in production!
        userRepo.save(user);

        String token = jwtUtil.generateToken(user.getEmail());
        return ResponseEntity.ok(new AuthResponse(token, user.getFullName(), user.getId().toString()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Optional<User> userOpt = userRepo.findByEmail(request.getEmail());

        if (userOpt.isPresent() && userOpt.get().getPassword().equals(request.getPassword())) {
            User user = userOpt.get();
            String token = jwtUtil.generateToken(user.getEmail());
            return ResponseEntity.ok(new AuthResponse(token, user.getFullName(), user.getId().toString()));
        }

        return ResponseEntity.status(401).body("Invalid email or password");
    }

    // --- DTOs ---
    @Data public static class SignupRequest { private String email; private String name; private String password; }
    @Data public static class LoginRequest { private String email; private String password; }
    @Data public static class AuthResponse {
        private String token;
        private String name;
        private String userId;
        public AuthResponse(String token, String name, String userId) {
            this.token = token; this.name = name; this.userId = userId;
        }
    }
}