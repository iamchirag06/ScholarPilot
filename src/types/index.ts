export type Category = 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS';
export type CourseLevel = 'CLASS_10' | 'CLASS_12' | 'UG' | 'PG' | 'PHD';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type ApplicationStatus = 'ELIGIBLE' | 'APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  token?: string;
}

export interface Profile {
  id?: number | string; // returned by backend after create
  fullName: string;
  category: Category;
  annualIncome: number;
  state: string;
  courseLevel: CourseLevel;
  gender: Gender;
  isDisabled: boolean;
  marksPercentage: number;
}

export interface Scheme {
  id: string;
  source_portal: string;
  scheme_name: string;
  provider: string;
  award_amount: number;
  deadline: string; // YYYY-MM-DD
  apply_link: string;
  raw_eligibility_text: string;
  llm_summary: string;
  required_documents: string[];
  confidence_score: number; // 0.0 - 1.0
  rank_score?: number; // 0 - 100
}

export interface Application {
  id: string;
  user_id: string;
  scheme_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
}

export interface CrawlProgressEvent {
  status: 'crawling' | 'summarizing' | 'done' | 'error';
  progress: number; // 0 - 100
  message?: string;
  schemes_found?: number;
  current_portal?: string;
}

export interface CrawlStartResponse {
  job_id: string;
}
