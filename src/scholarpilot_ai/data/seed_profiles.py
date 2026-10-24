"""Synthetic test student profiles for deterministic testing and acceptance validation."""

from typing import List, Dict, Any

SEED_PROFILES: List[Dict[str, Any]] = [
    {
        # Persona: Arjun (from Project Presentation Slide 4)
        "id": "prof-arjun-001",
        "user_id": "usr-auth-arjun-99",
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "SC",
        "annual_family_income_inr": 180000,
        "marks_percent": 78.0,
        "disability": False,
        "gender": "MALE",
        "consent_to_process_profile": True,
    },
    {
        # Persona: Riya (from Project Presentation Slide 4)
        "id": "prof-riya-002",
        "user_id": "usr-auth-riya-88",
        "state": "HR",
        "education_level": "CLASS_12",
        "course": "BA",
        "category": "OBC",
        "annual_family_income_inr": 160000,
        "marks_percent": 82.0,
        "disability": False,
        "gender": "FEMALE",
        "consent_to_process_profile": True,
    },
    {
        # Persona: Priya (Female B.Tech student eligible for Pragati)
        "id": "prof-priya-003",
        "user_id": "usr-auth-priya-77",
        "state": "UP",
        "education_level": "UG",
        "course": "BTECH",
        "category": "GEN",
        "annual_family_income_inr": 350000,
        "marks_percent": 74.0,
        "disability": False,
        "gender": "FEMALE",
        "consent_to_process_profile": True,
    },
    {
        # Persona: High income student (fails income ceiling on low-income schemes)
        "id": "prof-wealthy-004",
        "user_id": "usr-auth-wealthy-66",
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "GEN",
        "annual_family_income_inr": 2500000,  # 25 Lakhs
        "marks_percent": 95.0,
        "disability": False,
        "gender": "MALE",
        "consent_to_process_profile": True,
    },
    {
        # Persona: Student with missing income & marks (evaluates to NEEDS_REVIEW / UNKNOWN)
        "id": "prof-incomplete-005",
        "user_id": "usr-auth-incomplete-55",
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "SC",
        "annual_family_income_inr": None,
        "marks_percent": None,
        "disability": False,
        "gender": "NOT_PROVIDED",
        "consent_to_process_profile": True,
    },
]
