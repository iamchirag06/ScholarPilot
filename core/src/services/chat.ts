import { isMockMode, getStoredUserId } from './api.ts';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const SAMPLE_APPLY_RESPONSE = `Hello! I am happy to guide you through the application process for the four scholarships you are eligible for. Since specific application steps can vary slightly by year, the most reliable method is to apply directly through the official portals provided below.

Here is how you can apply for each scheme:

### 1. Central Sector Scheme of Scholarships for College and University Students
*   **Award:** ₹20,000
*   **Deadline:** 31 December 2026
*   **How to Apply:**
    1.  Visit the official portal: [https://scholarships.gov.in/schemes/central-sector](https://scholarships.gov.in/schemes/central-sector)
    2.  Create a login ID if you are a new user.
    3.  Fill in your personal, academic, and financial details.
    4.  Upload the required documents: Income Certificate, Class 12 Marksheet, Aadhaar Card, College Admission Proof, and Bank Passbook.
    5.  Submit the application and save the acknowledgment.

### 2. Bihar Post-Matric Scholarship for SC/ST Students
*   **Award:** ₹35,000
*   **Deadline:** 30 November 2026
*   **How to Apply:**
    1.  Visit the official portal: [https://pmsonline.bih.nic.in](https://pmsonline.bih.nic.in)
    2.  Register using your Aadhaar number and mobile number.
    3.  Select the "Post-Matric Scholarship for SC/ST Students" scheme.
    4.  Enter your academic and caste details.
    5.  Upload the required documents: Caste Certificate, Income Certificate, Residential Certificate (Bihar), Fee Receipt, and Bonafide Certificate.
    6.  Submit the application.

### 3. AICTE Pragati Scholarship for Girl Students (Degree)
*   **Award:** ₹50,000
*   **Deadline:** 15 December 2026
*   **How to Apply:**
    1.  Visit the official portal: [https://www.aicte-india.org/schemes/students-development-schemes/Pragati](https://www.aicte-india.org/schemes/students-development-schemes/Pragati)
    2.  Look for the "Apply Now" or "Student Login" section.
    3.  Register with your email and mobile number.
    4.  Fill in your details, ensuring you select the correct degree program.
    5.  Upload the required documents: AICTE Admission Proof, Income Certificate, Tuition Fee Receipt, and Affidavit (Girl Child).
    6.  Submit the application.

### 4. Post Matric Scholarship to OBC Students - Haryana
*   **Award:** ₹18,000
*   **Deadline:** 20 December 2026
*   **How to Apply:**
    1.  Visit the official portal: [https://harchhatravratti.highereduhry.ac.in](https://harchhatravratti.highereduhry.ac.in)
    2.  Register as a new user using your Aadhaar and mobile number.
    3.  Select the "Post Matric Scholarship for OBC Students" scheme.
    4.  Fill in your personal, academic, and caste details.
    5.  Upload the required documents: Parivar Pehchan Patra, Haryana Domicile Certificate, OBC Caste Certificate, Income Certificate, and Previous Exam Marksheet.
    6.  Submit the application.

### 📝 Important Tips for All Applications:
*   **Prepare Documents in Advance:** Ensure all required documents are scanned clearly and are in PDF or JPG format (as per portal requirements).
*   **Check Eligibility Again:** While you are marked as eligible, double-check specific criteria (like income limits or caste certificates) on each portal before applying.
*   **Keep Acknowledgments:** After submitting each application, download and save the acknowledgment slip or application number. You will need this for tracking.
*   **Bank Details:** Ensure your bank account details (Passbook) are accurate, as scholarships are usually transferred directly to your bank account.

Would you like help understanding any specific document requirement or eligibility detail for one of these schemes?`;

/**
 * Returns the configured chatbot endpoint URL.
 * Defaults to https://unroasted-crib-plenty.ngrok-free.dev/api/chatbot.
 */
export const getChatbotUrl = (): string => {
  const envChatUrl =
    (import.meta as any).env?.NEXT_PUBLIC_CHATBOT_API_URL ??
    (import.meta as any).env?.VITE_CHATBOT_API_URL;
  return envChatUrl || 'https://unroasted-crib-plenty.ngrok-free.dev/api/chatbot';
};

/**
 * Sends a message to the backend chatbot endpoint:
 * URL: https://unroasted-crib-plenty.ngrok-free.dev/api/chatbot
 * Payload:
 * {
 *   "userId": string,
 *   "message": string
 * }
 */
export async function sendChatMessage(userId?: string | null, message: string = ''): Promise<string> {
  const effectiveUserId = userId || getStoredUserId() || '2679645e-6978-4156-82d4-03311dc254ae';
  const cleanMessage = message.trim();
  const payload = {
    userId: effectiveUserId,
    message: cleanMessage,
  };

  // If in mock mode, return realistic response with a simulated delay
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 800));
    return getMockChatResponse(cleanMessage);
  }

  const chatbotUrl = getChatbotUrl();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for LLM generation

    const response = await fetch(chatbotUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let errText = `Chatbot returned status ${response.status}`;
      try {
        const errJson = await response.json();
        errText = errJson.message || errJson.error || JSON.stringify(errJson);
      } catch {
        try {
          const raw = await response.text();
          if (raw) errText = raw;
        } catch {}
      }
      console.warn('Chatbot API returned non-200:', errText);
      throw new Error(errText);
    }

    // Try parsing as JSON first
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (typeof data === 'string' && data.trim()) {
        return data;
      }
      if (data && typeof data === 'object') {
        const text =
          data.response ||
          data.message ||
          data.answer ||
          data.reply ||
          data.content ||
          data.text ||
          data.output;
        if (typeof text === 'string' && text.trim()) {
          return text;
        }
        return JSON.stringify(data, null, 2);
      }
    }

    // Otherwise read as markdown/text
    const textResponse = await response.text();
    if (textResponse && textResponse.trim()) {
      return textResponse;
    }

    return getMockChatResponse(cleanMessage);
  } catch (err: any) {
    console.warn('Chatbot API request unreachable, using fallback advisor response:', err.message);
    return getMockChatResponse(cleanMessage);
  }
}

function getMockChatResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('apply') || q.includes('how') || q.includes('scholarship')) {
    return SAMPLE_APPLY_RESPONSE;
  }

  if (q.includes('document') || q.includes('certificate')) {
    return `### 📄 Essential Documents for Scholarship Applications

Here is the master checklist of documents required across major state & national portals:

1. **Identity & Domicile Proof:**
   * **Aadhaar Card** (Linked with active mobile number for OTP verification)
   * **State Domicile Certificate** (Issued by Revenue / Tehsildar office)

2. **Academic Records:**
   * **Class 10 & 12 Marksheets** (Self-attested copies)
   * **Current College Fee Receipt & Bonafide Certificate**
   * **College ID Card / Admission Letter**

3. **Financial & Reservation Proof:**
   * **Income Certificate** (Issued within the current financial year)
   * **Category Certificate** (SC / ST / OBC / EWS from competent authority)
   * **PwD Disability Certificate** (If applicable, min 40% benchmark)

4. **Disbursement Details:**
   * **Student's Own Bank Passbook** (Aadhaar-seeded bank account, active DBT)

> [!TIP]
> Always upload clean PDF scans under 200KB. Ensure the name spelling on your Aadhaar matches your matriculation certificate exactly!`;
  }

  if (q.includes('deadline') || q.includes('date') || q.includes('last')) {
    return `### ⏰ Upcoming Scholarship Deadlines

Here are the nearest cutoff dates for active state and central welfare schemes:

* **Central Sector Scheme (NSP):** 31 December 2026 (Online portal open)
* **Bihar Post-Matric SC/ST:** 30 November 2026 *(Closing in few weeks!)*
* **AICTE Pragati Degree:** 15 December 2026
* **Haryana Har-Chhatravratti (OBC/SC):** 20 December 2026

*Recommended action: Submit at least 5 days before the deadline to avoid server congestion on state portals.*`;
  }

  return `Hello! I am your ScholarPilot AI Advisor. 

I can help you with:
* Step-by-step application guidance for government and private schemes.
* Document preparation and certificate validation rules.
* Category & income quota limits for NSP, Haryana Har-Chhatravratti, and Bihar PMS.
* Deadline alerts and DBT bank-seeding instructions.

What would you like to know about your matching scholarships?`;
}
