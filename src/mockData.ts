import { Profile, Scheme, Application, User } from './types/index.ts';

export const DEMO_USER: User = {
  id: 'usr-riya-2026',
  email: 'riya.sharma@example.edu.in',
  fullName: 'Riya',
  token: 'mock-jwt-token-scholarpilot-riya-2026',
};

export const DEMO_PROFILE: Profile = {
  id: 'usr-riya-2026',
  fullName: 'Riya',
  category: 'SC',
  annualIncome: 200000,
  state: 'Haryana',
  courseLevel: 'UG',
  gender: 'FEMALE',
  isDisabled: false,
  marksPercentage: 78.0,
};

export const MOCK_SCHEMES: Scheme[] = [
  {
    id: 'uuid-5555-6666',
    source_portal: 'Private Trust',
    scheme_name: 'Reliance Foundation Undergraduate Scholarship',
    provider: 'Reliance Foundation',
    award_amount: 200000,
    deadline: '2026-12-05',
    apply_link: 'https://www.scholarships.reliancefoundation.org',
    raw_eligibility_text: 'Open to first-year undergraduate students across India with a household income of less than 15 lakhs per annum.',
    llm_summary: 'If you are a 1st-year UG student and your family earns under ₹15 Lakh, you can get up to ₹2 Lakh.',
    required_documents: ['Class 12 Marksheet', 'Income Proof', 'College ID'],
    confidence_score: 0.99,
    rank_score: 99,
  },
  {
    id: 'uuid-3333-4444',
    source_portal: 'Haryana State',
    scheme_name: 'Haryana Post Matric Scholarship for SC Students',
    provider: 'Haryana Welfare Dept',
    award_amount: 15000,
    deadline: '2026-11-15',
    apply_link: 'https://harchhatravratti.highereduhry.ac.in',
    raw_eligibility_text: "The scheme is open for SC students who are domicile of Haryana and whose parents' annual income is less than 2.5 lakhs.",
    llm_summary: 'For SC students living in Haryana with family income under ₹2.5 Lakh.',
    required_documents: ['Haryana Domicile', 'SC Certificate', 'Income Certificate'],
    confidence_score: 0.92,
    rank_score: 98,
  },
  {
    id: 'uuid-1111-2222',
    source_portal: 'NSP',
    scheme_name: 'Central Sector Scheme of Scholarship for College and University Students',
    provider: 'Ministry of Education',
    award_amount: 12000,
    deadline: '2026-10-31',
    apply_link: 'https://scholarships.gov.in/csss',
    raw_eligibility_text: 'Scholarships will be awarded to the meritorious students who are in the top 20 percentile of successful candidates in the relevant stream in Class 12.',
    llm_summary: 'You need to be in the top 20% of your Class 12 board exams to get this ₹12,000/year scholarship.',
    required_documents: ['Class 12 Marksheet', 'Aadhaar', 'Bank Passbook'],
    confidence_score: 0.98,
    rank_score: 95,
  },
  {
    id: 'uuid-7777-8888',
    source_portal: 'NSP',
    scheme_name: 'AICTE Pragati Scholarship for Girls',
    provider: 'AICTE',
    award_amount: 50000,
    deadline: '2026-10-28',
    apply_link: 'https://www.aicte-india.org/schemes/students-development-schemes',
    raw_eligibility_text: 'Girl candidates admitted to first year of degree/diploma course in AICTE approved institution. Family income less than 8 lakhs.',
    llm_summary: 'A ₹50,000 scholarship for girls studying engineering/diploma. Family income must be under ₹8 Lakh.',
    required_documents: ['Admission Proof', 'Income Certificate', 'Aadhaar'],
    confidence_score: 0.88,
    rank_score: 91,
  },
  {
    id: 'uuid-9999-0000',
    source_portal: 'Delhi State',
    scheme_name: 'Delhi Merit cum Means Scholarship',
    provider: 'Delhi Govt',
    award_amount: 25000,
    deadline: '2026-11-10',
    apply_link: 'http://edistrict.delhigovt.nic.in',
    raw_eligibility_text: 'For students belonging to SC/ST/OBC/Minority residing in Delhi. Family income limit is 2 lakhs. Must have 60% in previous exam.',
    llm_summary: 'For Delhi residents (SC/ST/OBC) with family income under ₹2 Lakh and 60%+ marks.',
    required_documents: ['Delhi Domicile', 'Category Certificate', 'Marksheet'],
    confidence_score: 0.91,
    rank_score: 74,
  },
];

export const INITIAL_APPLICATIONS: Application[] = [
  {
    id: 'app-1',
    user_id: 'usr-riya-2026',
    scheme_id: 'uuid-5555-6666',
    status: 'ELIGIBLE',
    applied_at: null,
  },
  {
    id: 'app-2',
    user_id: 'usr-riya-2026',
    scheme_id: 'uuid-3333-4444',
    status: 'APPLIED',
    applied_at: '2026-10-20T10:30:00Z',
  },
  {
    id: 'app-3',
    user_id: 'usr-riya-2026',
    scheme_id: 'uuid-1111-2222',
    status: 'PENDING',
    applied_at: '2026-10-18T14:15:00Z',
  },
  {
    id: 'app-4',
    user_id: 'usr-riya-2026',
    scheme_id: 'uuid-7777-8888',
    status: 'ELIGIBLE',
    applied_at: null,
  },
  {
    id: 'app-5',
    user_id: 'usr-riya-2026',
    scheme_id: 'uuid-9999-0000',
    status: 'ELIGIBLE',
    applied_at: null,
  },
];

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export function formatINR(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹' + new Intl.NumberFormat('en-IN').format(val);
}

export function formatINRWords(val?: number | string | null): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : Number(val) || 0;
  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(1).replace(/\.0$/, '');
    return `${formatINR(num)} · ${cr} Crore`;
  }
  if (num >= 100000) {
    const lk = (num / 100000).toFixed(1).replace(/\.0$/, '');
    return `${formatINR(num)} · ${lk} Lakh`;
  }
  if (num >= 1000) {
    const th = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${formatINR(num)} · ${th} Thousand`;
  }
  return formatINR(num);
}

export function getStoredUsername(): string {
  if (typeof window === 'undefined') return '';
  try {
    const directKeys = [
      'scholarpilot_username',
      'username',
      'user_name',
      'name',
      'fullName',
    ];
    for (const key of directKeys) {
      const val = localStorage.getItem(key);
      if (val && typeof val === 'string' && val.trim() && val.trim().toLowerCase() !== 'riya') {
        return val.trim();
      }
    }

    const objKeys = ['user', 'scholarpilot_user', 'currentUser', 'auth'];
    for (const key of objKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const found =
            parsed.username ||
            parsed.fullName ||
            parsed.full_name ||
            parsed.name ||
            parsed.email;
          if (found && typeof found === 'string' && found.trim() && found.trim().toLowerCase() !== 'riya') {
            return found.trim();
          }
        } catch {
          if (raw.trim() && raw.trim().toLowerCase() !== 'riya') {
            return raw.trim();
          }
        }
      }
    }
  } catch {}
  return '';
}

export function getDeadlineUrgency(deadlineStr?: string | null): {
  daysLeft: number;
  label: string;
  color: string;
  bg: string;
} {
  if (!deadlineStr || typeof deadlineStr !== 'string' || !deadlineStr.trim()) {
    return { daysLeft: 30, label: 'Ongoing Scheme', color: '#2F8F6B', bg: '#EDF8F3' };
  }
  const target = new Date(deadlineStr);
  if (isNaN(target.getTime())) {
    return { daysLeft: 30, label: deadlineStr.trim(), color: '#2F8F6B', bg: '#EDF8F3' };
  }
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { daysLeft, label: 'Deadline closed', color: '#5E5A52', bg: '#F1EFEA' };
  }
  if (daysLeft <= 7) {
    return { daysLeft, label: `${daysLeft}d left (Closing soon!)`, color: '#D64545', bg: '#FDECEB' };
  }
  if (daysLeft <= 21) {
    return { daysLeft, label: `${daysLeft} days remaining`, color: '#E0A12B', bg: '#FEF8EA' };
  }
  return { daysLeft, label: `${daysLeft} days remaining`, color: '#2F8F6B', bg: '#EDF8F3' };
}

export function formatDisplayName(name?: string | null): string {
  if (!name || !name.trim()) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length === 0) return '';
      const rest = part.slice(1);
      const formattedRest = part === part.toUpperCase() ? rest.toLowerCase() : rest;
      return part.charAt(0).toUpperCase() + formattedRest;
    })
    .join(' ');
}

