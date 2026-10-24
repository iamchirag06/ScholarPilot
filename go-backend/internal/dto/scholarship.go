package dto

type Scholarship struct {
	ID                string   `json:"id"`
	SourcePortal      string   `json:"source_portal"`
	SchemeName        string   `json:"scheme_name"`
	Provider          string   `json:"provider"`
	AwardAmount       int64    `json:"award_amount"`
	Deadline          string   `json:"deadline"`
	ApplyLink         string   `json:"apply_link"`
	RawEligibility    string   `json:"raw_eligibility_text"`
	LLMSummary        string   `json:"llm_summary"`
	RequiredDocuments []string `json:"required_documents"`
	ConfidenceScore   float64  `json:"confidence_score"`
}
