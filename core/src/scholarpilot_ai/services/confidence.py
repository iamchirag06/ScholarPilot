"""Confidence scoring and data quality analysis for scholarship source text.

Detects malformed, truncated, or suspicious text crawled by data crawlers (e.g. TinyFish),
normalizes whitespace, extracts factual eligibility signals, and computes a transparent
data-quality confidence score (0.0 - 1.0).
"""

import re
import html
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class QualityAssessment(BaseModel):
    is_valid: bool
    normalized_text: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    warnings: List[str] = Field(default_factory=list)
    detected_facts: Dict[str, Any] = Field(default_factory=dict)
    is_truncated: bool = False
    is_suspicious: bool = False


class DataQualityAnalyzer:
    """Evaluates raw scraped text quality and computes grounded confidence scores."""

    # Common scraper failure indicators
    ERROR_INDICATORS = [
        "404 not found",
        "page not found",
        "access denied",
        "403 forbidden",
        "error 500",
        "bad gateway",
        "service unavailable",
        "cloudflare",
        "please enable javascript",
        "under maintenance",
        "session expired",
    ]

    @classmethod
    def normalize_text(cls, raw_text: str) -> str:
        """Strip control characters, unescape HTML, and normalize excessive whitespace."""
        if not raw_text:
            return ""

        # Unescape HTML entities
        text = html.unescape(raw_text)

        # Remove control characters (preserve newline and tab)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", text)

        # Normalize unicode spaces to standard space
        text = re.sub(r"[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]", " ", text)

        # Normalize lines
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]

        # Collapse excessive blank lines to at most two
        collapsed_lines: List[str] = []
        consecutive_empty = 0
        for line in lines:
            if not line:
                consecutive_empty += 1
                if consecutive_empty <= 2:
                    collapsed_lines.append("")
            else:
                consecutive_empty = 0
                collapsed_lines.append(line)

        return "\n".join(collapsed_lines).strip()

    @classmethod
    def detect_truncation(cls, text: str) -> bool:
        """Check if source text ends abruptly mid-sentence or contains truncation markers."""
        if not text:
            return False

        stripped = text.strip()
        # Trailing ellipsis
        if stripped.endswith("...") or stripped.endswith("…"):
            return True

        # Ends with dangling conjunction or preposition
        dangling = [
            "and", "or", "the", "with", "for", "in", "to", "of", "whose",
            "which", "that", "including", "such as", "required", "eligible"
        ]
        last_word = stripped.split()[-1].lower().rstrip(",;:-")
        if last_word in dangling:
            return True

        # Long text without terminal punctuation (. ! ?)
        if len(stripped) > 100 and stripped[-1] not in ".!?\":'":
            return True

        return False

    @classmethod
    def extract_factual_signals(cls, text: str) -> Dict[str, Any]:
        """Extract structured eligibility signals using regex pattern matching."""
        lower = text.lower()
        facts: Dict[str, Any] = {
            "income_limit": None,
            "categories": [],
            "education_levels": [],
            "courses": [],
            "minimum_marks": None,
            "deadline": None,
            "required_documents": [],
            "domicile_state": None,
        }

        # 1. Income limit detection
        income_pattern = re.compile(
            r"(?:income|ceiling|earning)[^.\n\r;]{0,50}?(?:rs\.?|inr|₹)?\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]+)?|\d+(?:\.\d+)?\s*(?:lakh|lakhs|lac|lacs)?)\s*(?:per\s*(?:annum|year|month)|p\.?a\.?|per\s*annum)?|(?:rs\.?|inr|₹)\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]+)?|\d+(?:\.\d+)?\s*(?:lakh|lakhs|lac|lacs)?)[^.\n\r;]{0,30}?(?:income|ceiling)",
            re.IGNORECASE,
        )
        income_match = income_pattern.search(text)
        if income_match:
            facts["income_limit"] = income_match.group(0).strip()

        # 2. Categories
        category_keywords = {
            "SC": [r"\bsc\b", r"scheduled\s*caste"],
            "ST": [r"\bst\b", r"scheduled\s*tribe"],
            "OBC": [r"\bobc\b", r"other\s*backward\s*class"],
            "EWS": [r"\bews\b", r"economically\s*weaker"],
            "Minority": [r"\bminority\b", r"\bminorities\b", r"\bmuslim\b", r"\bchristian\b", r"\bsikh\b", r"\bjain\b"],
            "PwD": [r"\bpwd\b", r"disability", r"disabled", r"divyangjan", r"physically\s*handicapped"],
            "Female": [r"\bgirl\b", r"\bgirls\b", r"\bfemale\b", r"\bwomen\b", r"\bwoman\b"],
            "General": [r"\bgeneral\b", r"\bopen\s*category\b", r"\bur\b"],
        }
        for cat, patterns in category_keywords.items():
            for pat in patterns:
                if re.search(pat, lower):
                    if cat not in facts["categories"]:
                        facts["categories"].append(cat)
                    break

        # 3. Education levels & courses
        edu_keywords = {
            "Class 10 / Matric": [r"class\s*10", r"10th", r"matric", r"secondary\s*school"],
            "Class 12 / Intermediate": [r"class\s*12", r"12th", r"intermediate", r"higher\s*secondary", r"10\+2"],
            "UG": [r"\bug\b", r"undergraduate", r"graduation", r"bachelor", r"b\.tech", r"btech", r"b\.e\.", r"b\.sc", r"bsc", r"b\.com", r"bcom", r"ba\b", r"bba"],
            "PG": [r"\bpg\b", r"postgraduate", r"post\s*graduation", r"master", r"m\.tech", r"mtech", r"m\.sc", r"msc", r"mba", r"mca"],
            "Diploma": [r"diploma", r"polytechnic"],
            "PhD": [r"ph\.?d", r"doctorate", r"research\s*fellow"],
        }
        for edu, patterns in edu_keywords.items():
            for pat in patterns:
                if re.search(pat, lower):
                    facts["education_levels"].append(edu)
                    break

        # 4. Minimum marks / academic criteria
        marks_match = re.search(
            r"(\d{2}(?:\.\d+)?)\s*%\s*(?:marks|percentage|aggregate)?|(?:minimum|at\s*least)\s*(\d{2}(?:\.\d+)?)\s*%",
            lower,
        )
        if marks_match:
            facts["minimum_marks"] = marks_match.group(1) or marks_match.group(2) + "%"

        # 5. Deadline
        deadline_match = re.search(
            r"(?:deadline|last\s*date|closing\s*date|apply\s*before|valid\s*up\s*to)[^.\n\r;]{0,30}?\b([0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}|[0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{4})\b",
            lower,
        )
        if deadline_match:
            facts["deadline"] = deadline_match.group(1).strip()

        # 6. Required Documents
        doc_keywords = {
            "income_certificate": [r"income\s*certificate"],
            "caste_certificate": [r"caste\s*certificate", r"community\s*certificate"],
            "marksheet": [r"marksheet", r"mark\s*sheet", r"grade\s*card", r"transcript"],
            "domicile_certificate": [r"domicile\s*certificate", r"residential\s*certificate"],
            "aadhaar_card": [r"aadhaar", r"aadhar"],
            "bonafide_certificate": [r"bonafide\s*certificate", r"enrollment\s*certificate", r"college\s*id"],
            "bank_passbook": [r"bank\s*passbook", r"bank\s*account", r"cancelled\s*cheque"],
            "fee_receipt": [r"fee\s*receipt", r"admission\s*receipt"],
        }
        for doc_name, patterns in doc_keywords.items():
            for pat in patterns:
                if re.search(pat, lower):
                    facts["required_documents"].append(doc_name)
                    break

        return facts

    @classmethod
    def analyze(cls, raw_text: str, max_length: int = 25000) -> QualityAssessment:
        """Run complete data quality audit and generate confidence score and warnings."""
        if not raw_text or not raw_text.strip():
            return QualityAssessment(
                is_valid=False,
                normalized_text="",
                confidence_score=0.0,
                warnings=["Source text is empty or contains only whitespace."],
                detected_facts={},
                is_truncated=False,
                is_suspicious=True,
            )

        normalized = cls.normalize_text(raw_text)
        warnings: List[str] = []
        is_suspicious = False

        # Safe bounding
        if len(normalized) > max_length:
            normalized = normalized[:max_length]
            warnings.append(f"Source text exceeded safe limit and was bounded to {max_length} characters.")

        # Check for scraper error pages
        lower = normalized.lower()
        for err in cls.ERROR_INDICATORS:
            if err in lower:
                warnings.append(f"Potential crawler failure or error page detected: '{err}'.")
                is_suspicious = True

        # Check text length / substance
        if len(normalized) < 40:
            warnings.append("Source text is unusually short (< 40 characters) and may lack actionable eligibility criteria.")
            is_suspicious = True

        # Check for truncation
        is_truncated = cls.detect_truncation(normalized)
        if is_truncated:
            warnings.append("Source text appears to be truncated or cut off mid-sentence.")

        # Extract factual eligibility signals
        facts = cls.extract_factual_signals(normalized)

        # Baseline score calculation based on structured signal presence
        # Base confidence for non-empty text: 0.15
        score = 0.15

        if facts["income_limit"]:
            score += 0.20
        else:
            warnings.append("No explicit family income ceiling detected in source text.")

        if facts["categories"]:
            score += 0.20
        else:
            warnings.append("No specific social category restrictions detected (may be open to all).")

        if facts["education_levels"]:
            score += 0.20
        else:
            warnings.append("No explicit education level or course restriction detected.")

        if facts["required_documents"]:
            score += 0.10
        else:
            warnings.append("No required documents list detected.")

        if facts["deadline"]:
            score += 0.10
        else:
            warnings.append("No application deadline detected in source text.")

        if len(normalized) >= 150:
            score += 0.05

        # Penalties for truncation or suspicious content
        if is_truncated:
            score -= 0.15
        if is_suspicious:
            score -= 0.30

        # Clamp between 0.05 and 1.0 (if valid text)
        confidence_score = round(max(0.05, min(1.0, score)), 2)

        return QualityAssessment(
            is_valid=True,
            normalized_text=normalized,
            confidence_score=confidence_score,
            warnings=warnings,
            detected_facts=facts,
            is_truncated=is_truncated,
            is_suspicious=is_suspicious,
        )
