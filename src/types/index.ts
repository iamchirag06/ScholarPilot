export type Category = 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS';
export type CourseLevel = 'CLASS_10' | 'CLASS_12' | 'UG' | 'PG' | 'PHD';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type ApplicationStatus = 'ELIGIBLE' | 'APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  token?: string;
}

export interface Profile {
  user_id: string;
  full_name: string;
  category: Category;
  annual_income: number;
  state: string;
  course_level: CourseLevel;
  gender: Gender;
  is_disabled: boolean;
  marks_percentage: number;
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
