/**
 * ScholarPilot Chrome Extension - Popup Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const schemeName = document.getElementById("schemeName");
  const sessionMeta = document.getElementById("sessionMeta");
  const manualSessionBox = document.getElementById("manualSessionBox");
  const manualSessionInput = document.getElementById("manualSessionInput");
  const btnLoadSession = document.getElementById("btnLoadSession");
  const statDetected = document.getElementById("statDetected");
  const statMapped = document.getElementById("statMapped");
  const fieldsList = document.getElementById("fieldsList");
  const previewBox = document.getElementById("previewBox");
  const btnAutofill = document.getElementById("btnAutofill");
  const btnText = document.getElementById("btnText");
  const btnScanAgain = document.getElementById("btnScanAgain");

  let currentTab = null;
  let activeSessionData = null;
  let detectedFormFields = [];
  let mappedFields = [];

  // Query active tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  // Load stored state
  const store = await chrome.storage.local.get(["activeSession", "activeSessionId", "backendUrl"]);
  const backendUrl = store.backendUrl || "http://localhost:8000";

  // Try to load active session data
  if (store.activeSession) {
    activeSessionData = store.activeSession;
    renderSession(activeSessionData);
  } else if (store.activeSessionId) {
    await fetchSession(store.activeSessionId, backendUrl);
  } else {
    manualSessionBox.style.display = "flex";
    sessionMeta.textContent = "No active session detected. Start from ScholarPilot portal or enter session ID.";
  }

  // Scan current page
  await scanCurrentPage();

  btnLoadSession.addEventListener("click", async () => {
    const sId = manualSessionInput.value.trim();
    if (sId) {
      await fetchSession(sId, backendUrl);
      await scanCurrentPage();
    }
  });

  btnScanAgain.addEventListener("click", async () => {
    await scanCurrentPage();
  });

  btnAutofill.addEventListener("click", async () => {
    if (!currentTab || !currentTab.id || mappedFields.length === 0) return;

    btnAutofill.disabled = true;
    btnText.textContent = "Filling Fields...";

    try {
      chrome.tabs.sendMessage(
        currentTab.id,
        {
          type: "APPLY_AUTOFILL",
          matchedFields: mappedFields,
          overwriteEdited: false,
        },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            btnText.textContent = "Autofill Error";
            alert("Could not communicate with the page. Please refresh the page and try again.");
            btnAutofill.disabled = false;
            return;
          }

          const rep = response.report;
          btnText.textContent = `Completed (${rep.successfullyFilled} filled)`;
          statusBadge.textContent = "FILLED";
          statusBadge.style.backgroundColor = "rgba(16, 185, 129, 0.3)";

          alert(
            `Autofill Complete!\n\n` +
            `• Successfully filled: ${rep.successfullyFilled} field(s)\n` +
            `• Skipped already modified: ${rep.skippedAlreadyEdited} field(s)\n` +
            `• Manual review required: ${rep.manualReviewRequired.length} field(s) (highlighted in amber)\n\n` +
            `Please review all fields on the official portal before submitting!`
          );
        }
      );
    } catch (err) {
      btnText.textContent = "Error";
      btnAutofill.disabled = false;
    }
  });

  async function fetchSession(sessionId, baseUrl) {
    schemeName.textContent = "Loading Session...";
    sessionMeta.textContent = `Fetching authorization for session ${sessionId.slice(0, 12)}...`;

    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "FETCH_SESSION", sessionId: sessionId, backendUrl: baseUrl },
          (resp) => resolve(resp)
        );
      });

      if (res && res.success && res.data) {
        activeSessionData = res.data;
        await chrome.storage.local.set({ activeSession: activeSessionData, activeSessionId: sessionId });
        renderSession(activeSessionData);
        manualSessionBox.style.display = "none";
      } else {
        schemeName.textContent = "Session Unavailable";
        sessionMeta.textContent = res ? res.error : "Failed to load session payload.";
        manualSessionBox.style.display = "flex";
      }
    } catch (err) {
      schemeName.textContent = "Connection Error";
      sessionMeta.textContent = err.message;
      manualSessionBox.style.display = "flex";
    }
  }

  function renderSession(session) {
    statusBadge.textContent = "SESSION ACTIVE";
    statusBadge.style.backgroundColor = "rgba(59, 130, 246, 0.25)";
    statusBadge.style.color = "#93c5fd";
    statusBadge.style.border = "1px solid rgba(59, 130, 246, 0.4)";

    schemeName.textContent = session.schemeName || `Scheme ${session.schemeId}`;
    sessionMeta.textContent = `Student ID: ${session.studentId} • Token: ${session.sessionId.slice(0, 10)}...`;
  }

  async function scanCurrentPage() {
    if (!currentTab || !currentTab.id) return;

    statDetected.textContent = "...";
    statMapped.textContent = "...";

    chrome.tabs.sendMessage(
      currentTab.id,
      { type: "SCAN_FORM" },
      async (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          statDetected.textContent = "0";
          statMapped.textContent = "0";
          btnAutofill.disabled = true;
          return;
        }

        detectedFormFields = response.fields || [];
        statDetected.textContent = detectedFormFields.length;

        // Map detected fields against active session
        if (activeSessionData && detectedFormFields.length > 0) {
          await mapFieldsWithBackend(detectedFormFields, activeSessionData);
        } else if (detectedFormFields.length > 0) {
          statMapped.textContent = "Awaiting Session";
          btnAutofill.disabled = true;
        } else {
          statMapped.textContent = "0";
          btnAutofill.disabled = true;
        }
      }
    );
  }

  async function mapFieldsWithBackend(fields, session) {
    try {
      const payload = {
        schemeId: session.schemeId,
        formFields: fields,
        userId: session.studentId,
      };

      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "MAP_FIELDS", payload: payload, backendUrl: backendUrl },
          (resp) => resolve(resp)
        );
      });

      if (res && res.success && res.data) {
        const mapping = res.data;
        mappedFields = mapping.matchedFields || [];
        const fillableCount = mappedFields.filter((m) => !m.requiresManualReview && m.valueToFill).length;

        statMapped.textContent = fillableCount;
        renderFieldPreview(mappedFields);

        if (fillableCount > 0) {
          btnAutofill.disabled = false;
          btnText.textContent = `Autofill ${fillableCount} Supported Fields`;
        } else {
          btnAutofill.disabled = true;
          btnText.textContent = "No Fillable Fields Detected";
        }
      }
    } catch (err) {
      console.error("[ScholarPilot] Mapping error:", err);
    }
  }

  function renderFieldPreview(matches) {
    if (!matches || matches.length === 0) {
      previewBox.style.display = "none";
      return;
    }

    fieldsList.innerHTML = "";
    previewBox.style.display = "block";

    for (const m of matches) {
      const row = document.createElement("div");
      row.className = "field-row";

      const keySpan = document.createElement("span");
      keySpan.className = "field-key";
      keySpan.textContent = m.label || m.fieldName || m.fieldId || "field";

      const valSpan = document.createElement("span");
      valSpan.className = "field-val";
      if (m.requiresManualReview) {
        valSpan.textContent = "⚠️ Manual Entry Required";
        valSpan.style.color = "#f59e0b";
      } else {
        valSpan.textContent = m.valueToFill !== undefined ? String(m.valueToFill) : "—";
      }

      row.appendChild(keySpan);
      row.appendChild(valSpan);
      fieldsList.appendChild(row);
    }
  }
});
