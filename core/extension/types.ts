/**
 * ScholarPilot Extension TypeScript Type Definitions
 */

export interface FormFieldItem {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  placeholder?: string;
  options?: string[];
  ariaLabel?: string;
  currentValue?: string;
}

export interface AutofillFieldValue {
  value: any;
  source: string;
  verificationStatus: string;
}

export interface AutofillSessionPayload {
  sessionId: string;
  schemeId: string;
  schemeName: string;
  studentId: string;
  applicationUrl: string;
  fieldValues: Record<string, AutofillFieldValue>;
  missingFields: string[];
  manualReviewFields: string[];
  unsupportedFields: string[];
  expiresAt: string;
  instructions: string;
}

export interface MatchedFieldItem {
  fieldId?: string;
  fieldName?: string;
  label?: string;
  matchedProfileKey?: string;
  valueToFill: any;
  confidence: number;
  requiresManualReview: boolean;
  reason?: string;
}

export interface FormMappingResult {
  schemeId: string;
  matchedFields: MatchedFieldItem[];
  unmatchedFields: string[];
  missingRequiredFields: string[];
  totalFieldsDetected: number;
  mappedFieldsCount: number;
}

export interface AutofillReport {
  totalDetected: number;
  successfullyFilled: number;
  manualReviewRequired: string[];
  skippedAlreadyFilled: number;
  unsupportedControls: number;
}
