package com.scholarpilot.backend.config;

import com.scholarpilot.backend.models.Scheme;
import com.scholarpilot.backend.repositories.SchemeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Order(1) // Run this before the DataSeeder
public class DataCleanupRunner implements CommandLineRunner {

    @Autowired
    private SchemeRepository schemeRepo;

    @Override
    public void run(String... args) throws Exception {
        List<Scheme> schemes = schemeRepo.findAll();
        if (schemes.isEmpty()) return;

        System.out.println("🧹 Auto-tagging " + schemes.size() + " schemes based on raw text...");

        for (Scheme scheme : schemes) {
            String rawText = (scheme.getRawEligibilityText() != null ? scheme.getRawEligibilityText() : "") + " " +
                    (scheme.getLlmSummary() != null ? scheme.getLlmSummary() : "");
            String lowerText = rawText.toLowerCase();

            // 1. Determine Category
            if (lowerText.contains("scheduled caste") || lowerText.contains(" sc ")) scheme.setTargetCategory("SC");
            else if (lowerText.contains("scheduled tribe") || lowerText.contains(" st ")) scheme.setTargetCategory("ST");
            else if (lowerText.contains("obc") || lowerText.contains("other backward")) scheme.setTargetCategory("OBC");
            else if (lowerText.contains("minority") || lowerText.contains("muslim") || lowerText.contains("christian")) scheme.setTargetCategory("MINORITY");
            else if (lowerText.contains("specially-abled") || lowerText.contains("disabilit") || lowerText.contains("divyang")) scheme.setTargetCategory("PWD");
            else scheme.setTargetCategory("ALL");

            // 2. Determine Gender
            if (lowerText.contains("female") || lowerText.contains("girl") || lowerText.contains("women") || lowerText.contains("kanya")) {
                scheme.setTargetGender("FEMALE");
            } else {
                scheme.setTargetGender("ALL");
            }

            // 3. Extract Income Limit (Regex)
            // Looks for patterns like "4.5 lakh", "2,50,000", "8.00 lakh"
            Pattern incomePattern = Pattern.compile("(?:rs\\.?|inr|₹)?\\s*(\\d+(?:\\.\\d+)?)\\s*(lakh|lakhs|000)?", Pattern.CASE_INSENSITIVE);
            Matcher matcher = incomePattern.matcher(rawText);
            Integer foundIncome = null;
            while (matcher.find()) {
                String number = matcher.group(1);
                String unit = matcher.group(2) != null ? matcher.group(2).toLowerCase() : "";

                if (unit.contains("lakh")) {
                    foundIncome = (int) (Double.parseDouble(number) * 100000);
                } else if (number.length() >= 5) { // e.g., 250000
                    foundIncome = Integer.parseInt(number);
                }

                if (foundIncome != null && foundIncome > 10000) break;
            }
            if (foundIncome != null) {
                scheme.setMaxIncome(foundIncome);
            }

            // 4. Determine State (Simple matching)
            if (lowerText.contains("haryana")) scheme.setTargetState("Haryana");
            else if (lowerText.contains("delhi")) scheme.setTargetState("Delhi");
            else if (lowerText.contains("north eastern") || lowerText.contains("ner") || lowerText.contains("assam")) scheme.setTargetState("NER");
            else if (lowerText.contains("jammu") || lowerText.contains("kashmir") || lowerText.contains("ladakh")) scheme.setTargetState("J&K");
            else scheme.setTargetState("ALL");

            schemeRepo.save(scheme);
        }
        System.out.println("✅ Auto-tagging complete! Data is ready for matching.");
    }
}