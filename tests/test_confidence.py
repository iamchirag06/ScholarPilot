"""Automated unit tests for data quality and confidence scoring service."""

import pytest
from src.scholarpilot_ai.services.confidence import DataQualityAnalyzer


def test_confidence_empty_or_whitespace_input():
    """Empty or whitespace text must return is_valid=False and confidence_score=0.0."""
    res_empty = DataQualityAnalyzer.analyze("")
    assert res_empty.is_valid is False
    assert res_empty.confidence_score == 0.0
    assert len(res_empty.warnings) > 0

    res_spaces = DataQualityAnalyzer.analyze("   \n\t  \r  ")
    assert res_spaces.is_valid is False
    assert res_spaces.confidence_score == 0.0


def test_confidence_valid_rich_text():
    """Rich scholarship text with income, category, and deadline should receive high confidence."""
    text = (
        "Post-Matric Scholarship Scheme for SC and ST students in Bihar. "
        "Eligible applicants must be enrolled in full-time UG or B.Tech courses. "
        "Family income ceiling is not exceeding Rs. 2,50,000 per annum. "
        "Minimum marks required in Class 12 is 60%. "
        "Required documents include caste certificate, income certificate, and marksheet. "
        "Application deadline is 2026-11-30. Apply on the state scholarship portal."
    )
    res = DataQualityAnalyzer.analyze(text)
    assert res.is_valid is True
    assert res.confidence_score >= 0.70
    assert res.is_truncated is False
    assert res.is_suspicious is False

    facts = res.detected_facts
    assert facts["income_limit"] is not None
    assert "SC" in facts["categories"]
    assert "ST" in facts["categories"]
    assert "UG" in facts["education_levels"]
    assert facts["deadline"] == "2026-11-30"
    assert "caste_certificate" in facts["required_documents"]
    assert "income_certificate" in facts["required_documents"]


def test_confidence_detects_truncation():
    """Truncated text ending with ellipsis or dangling word must be flagged."""
    text_ellipsis = "Eligible students must have family income below Rs 200000 and belong to..."
    res = DataQualityAnalyzer.analyze(text_ellipsis)
    assert res.is_truncated is True
    assert any("truncated" in w.lower() for w in res.warnings)

    text_dangling = "Eligible students must submit caste certificate and income certificate for"
    res_dangling = DataQualityAnalyzer.analyze(text_dangling)
    assert res_dangling.is_truncated is True


def test_confidence_detects_scraper_error_pages():
    """Error pages such as 404 Not Found must be flagged as suspicious and penalized."""
    text_404 = "HTTP 404 Not Found. The scholarship notification page you requested was not found on this server."
    res = DataQualityAnalyzer.analyze(text_404)
    assert res.is_suspicious is True
    assert any("error page" in w.lower() for w in res.warnings)
    assert res.confidence_score < 0.40


def test_confidence_detects_short_text():
    """Text under 40 characters lacks sufficient eligibility criteria."""
    short_text = "NSP Scholarship 2026 open."
    res = DataQualityAnalyzer.analyze(short_text)
    assert res.is_suspicious is True
    assert any("short" in w.lower() for w in res.warnings)


def test_text_normalization_cleans_excess_whitespace():
    """Normalizer collapses multiple spaces, unescapes HTML, and limits blank lines."""
    raw = "Scholarship &amp; Grants\n\n\n\nFor   SC/ST\tstudents.&#39;s portal."
    normalized = DataQualityAnalyzer.normalize_text(raw)
    assert "&amp;" not in normalized
    assert "&" in normalized
    assert "'" in normalized
    assert "   " not in normalized


def test_confidence_bounded_text():
    """Excessively long text is safely bounded to max length with a warning."""
    huge_text = "Scholarship eligibility criteria text. " * 1000
    res = DataQualityAnalyzer.analyze(huge_text, max_length=500)
    assert len(res.normalized_text) == 500
    assert any("bounded" in w.lower() for w in res.warnings)
