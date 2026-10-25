# ScholarPilot Chrome Extension (Manifest V3)

Intelligent Scholarship Form Discovery & Autofill Assistant.

## Capabilities

1. **Official Portal Form Detection:** Automatically recognizes fields across major Indian scholarship portals including National Scholarship Portal (NSP), Bihar Post-Matric Scholarship (PMS), and AICTE Pragati.
2. **Safe Form Autofill:** Securely auto-fills verified student profile facts (Name, DOB, Gender, Category, State, Income, Academic Marks, Course) using standard DOM events so dynamic React/Angular/Vue forms recognize changes.
3. **Sensitive Field Protection:** Flags government IDs, Aadhaar numbers, and bank account credentials for student manual entry.
4. **Replay & Hijack Prevention:** Short-lived single-use authorization tokens bound to the authenticated student and selected scholarship scheme.

## How to Install in Google Chrome or Edge

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `ScholarPilot/extension` directory.
5. The **ScholarPilot - Intelligent Scholarship Autofill** extension will now be active in your browser.

## Workflow

1. In the ScholarPilot Dashboard, select a recommended scholarship and click **Fill Application**.
2. ScholarPilot validates your eligibility and pre-configures a secure autofill session.
3. Click **Proceed to Official Website**. The portal opens in a new tab.
4. Click the ScholarPilot extension icon in your Chrome toolbar.
5. Click **Autofill Supported Fields**. Supported fields will be populated with a green border.
6. Complete any remaining sensitive numbers (Aadhaar, Bank Account, Captcha) and submit the application manually!
