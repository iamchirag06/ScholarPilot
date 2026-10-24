package dto

type Scholarship struct {
	ID                string   `json:"id"`
	SourcePortal      string   `json:"sourcePortal"`
	SchemeName        string   `json:"schemeName"`
	Provider          string   `json:"provider"`
	AwardAmount       int      `json:"awardAmount"`
	Deadline          string   `json:"deadline"`
	ApplyLink         string   `json:"applyLink"`
	RawEligibility    string   `json:"rawEligibilityText"`
	LLMSummary        string   `json:"llmSummary"`
	RequiredDocuments []string `json:"requiredDocuments"`
	ConfidenceScore   float64  `json:"confidenceScore"`
}

type ScholarshipList []Scholarship
