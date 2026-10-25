# Deterministic Eligibility & Recommendation Ranking Engine

## 1. Deterministic Eligibility Engine (Non-LLM)

### 1.1 Tri-State Evaluation Philosophy
Every candidate scholarship is evaluated against the student's profile across 8 mandatory rules. Each rule is assigned one of three mutually exclusive states:
* **`PASS`**: The student's verified profile fact satisfies the scheme's rule.
* **`FAIL`**: The student's verified profile fact explicitly violates the scheme's rule.
* **`UNKNOWN`**: A required attribute is missing from the student profile, or an eligibility parameter is missing or unverified in the scheme record.

> **CRITICAL RULE:** Missing values are **NEVER** interpreted as a pass. A missing fact yields `UNKNOWN`.

### 1.2 Evaluated Rules
1. **Annual Family Income:** Evaluated against `income_limit_inr`.
   * Income $\le$ limit $\rightarrow$ `PASS`
   * Income $>$ limit $\rightarrow$ `FAIL`
   * Income unprovided $\rightarrow$ `UNKNOWN`
2. **Education Level:** Evaluated against `education_levels` list.
3. **Course Eligibility:** Evaluated against `courses` list.
4. **Social Category:** Evaluated against `category_rules` list.
5. **State / Scope:**
   * If `scope == "CENTRAL"`, automatically `PASS` (open across India).
   * If state-restricted, requires student `state` in `eligible_states`.
6. **Minimum Academic Marks:** Evaluated against `minimum_marks_percent`.
7. **Disability Status:** Evaluated for schemes specifically targeted to PwD/Divyangjan students.
8. **Gender Specificity:** Evaluated for schemes specifically targeted to female students (e.g., AICTE Pragati, Begum Hazrat Mahal).

### 1.3 Overall Status Synthesis
* **`NOT_ELIGIBLE`**: If **any** evaluated mandatory rule is `FAIL`.
* **`NEEDS_REVIEW`**: If no rules `FAIL`, but at least one rule is `UNKNOWN`, or `scheme.verification_status == 'NEEDS_REVIEW'`.
* **`ELIGIBLE`**: If **all** applicable mandatory rules are `PASS` and scheme is `VERIFIED`.

---

## 2. Multi-Factor Transparent Ranking Formula

Candidate schemes are scored transparently on a normalized scale of **0.00 to 100.00**:

$$\text{Final Score} = \left( w_{\text{sem}} \cdot S_{\text{semantic}} + w_{\text{cov}} \cdot S_{\text{coverage}} + w_{\text{awd}} \cdot S_{\text{award}} + w_{\text{urg}} \cdot S_{\text{urgency}} \right) \times M_{\text{status}}$$

### 2.1 Formula Weights
* **$w_{\text{sem}} = 0.35$ (Semantic Fit):** Normalized vector similarity from Qdrant retrieval scaled to 0–100.
* **$w_{\text{cov}} = 0.25$ (Rule Match Coverage):**
  $$S_{\text{coverage}} = \frac{N_{\text{passed}}}{N_{\text{applicable\_rules}}} \times 100$$
* **$w_{\text{awd}} = 0.20$ (Financial Award Benefit):**
  Logarithmic scale mapping ₹0 to ₹2,00,000+ onto 0–100:
  $$S_{\text{award}} = \min\left(100.0, \frac{\log_{10}(\text{amount} + 1)}{\log_{10}(200000)} \times 100.0\right)$$
* **$w_{\text{urg}} = 0.20$ (Deadline Urgency):**
  * $\le 14$ days remaining: $100.0$ (highest priority)
  * $15 - 60$ days remaining: $85.0$
  * $> 60$ days remaining: $70.0$
  * Expired deadline: $0.0$

### 2.2 Status Multipliers ($M_{\text{status}}$)
* **`ELIGIBLE`**: $1.0$ (full score retained)
* **`NEEDS_REVIEW`**: $0.80$ (penalized so verified eligible schemes always outrank unverified ones)
* **`NOT_ELIGIBLE`**: $0.0$ (forced to zero; hidden from default view)
