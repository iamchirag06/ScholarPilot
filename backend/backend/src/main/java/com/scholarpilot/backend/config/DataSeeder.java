package com.scholarpilot.backend.config;

import com.scholarpilot.backend.models.Scheme;
import com.scholarpilot.backend.repositories.SchemeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private SchemeRepository schemeRepo;

    @Override
    public void run(String... args) throws Exception {
        if (schemeRepo.count() == 0) {
            Scheme s1 = new Scheme();
            s1.setSourcePortal("NSP");
            s1.setSchemeName("Central Sector Scheme of Scholarship");
            s1.setProvider("Ministry of Education");
            s1.setAwardAmount(12000);
            s1.setDeadline(LocalDate.parse("2026-10-31"));
            s1.setApplyLink("https://scholarships.gov.in/csss");
            s1.setLlmSummary("You need to be in the top 20% of your Class 12 board exams to get this ₹12,000/year scholarship.");
            s1.setTargetCategory("ALL");
            s1.setMaxIncome(800000);
            s1.setTargetState("ALL");
            schemeRepo.save(s1);

            Scheme s2 = new Scheme();
            s2.setSourcePortal("Haryana State");
            s2.setSchemeName("Haryana Post Matric Scholarship for SC Students");
            s2.setProvider("Haryana Welfare Dept");
            s2.setAwardAmount(15000);
            s2.setDeadline(LocalDate.parse("2026-11-15"));
            s2.setApplyLink("https://harchhatravratti.highereduhry.ac.in");
            s2.setLlmSummary("For SC students living in Haryana with family income under ₹2.5 Lakh.");
            s2.setTargetCategory("SC");
            s2.setMaxIncome(250000);
            s2.setTargetState("Haryana");
            schemeRepo.save(s2);

            System.out.println("✅ Mock Schemes seeded to Neon DB!");

        }
    }
}