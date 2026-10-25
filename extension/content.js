/**
 * ScholarPilot Chrome Extension - Content Script
 * 
 * Inspects official scholarship portal DOM, communicates with extension popup,
 * safely fills supported inputs (supporting React/standard HTML), and provides
 * clear visual feedback without automatic form submission.
 */

(function () {
  console.log("[ScholarPilot] Content script loaded on:", window.location.href);

  // Track student manual edits so we never overwrite their manual input
  document.addEventListener(
    "input",
    (e) => {
      const target = e.target;
      if (target && target.matches && target.matches("input, select, textarea")) {
        if (!target.dataset.spAutoFilled) {
          target.dataset.spUserEdited = "true";
        }
      }
    },
    true
  );

  // Check URL query parameters for session handoff from ScholarPilot frontend
  // (e.g. ?sp_session=sess_123 or #sp_session=sess_123)
  try {
    const urlObj = new URL(window.location.href);
    const spSession =
      urlObj.searchParams.get("sp_session") ||
      urlObj.searchParams.get("scholarpilot_session");
    if (spSession) {
      chrome.storage.local.set({ activeSessionId: spSession });
      // Notify background to update badge
      chrome.runtime.sendMessage({
        type: "UPDATE_BADGE",
        text: "READY",
        color: "#10b981",
      });
      // Clean query parameter from URL bar to prevent session leakage
      urlObj.searchParams.delete("sp_session");
      urlObj.searchParams.delete("scholarpilot_session");
      window.history.replaceState({}, document.title, urlObj.toString());
    }
  } catch (err) {
    // ignore
  }

  // Listen for actions from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCAN_FORM") {
      const detectedFields = scanFormFields();
      sendResponse({
        success: true,
        url: window.location.href,
        title: document.title,
        fields: detectedFields,
      });
      return false;
    }

    if (message.type === "APPLY_AUTOFILL") {
      const result = executeAutofill(message.matchedFields, message.overwriteEdited);
      sendResponse({ success: true, report: result });
      return false;
    }

    if (message.type === "HIGHLIGHT_MANUAL_FIELDS") {
      highlightManualReviewFields(message.manualFields || []);
      sendResponse({ success: true });
      return false;
    }
  });

  /**
   * Scan DOM for all actionable input, select, and textarea elements.
   */
  function scanFormFields() {
    const elements = Array.from(
      document.querySelectorAll("input, select, textarea")
    );
    const results = [];

    for (const el of elements) {
      // Skip hidden, submit, button, and reset controls
      const type = (el.type || "text").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) {
        continue;
      }

      // Skip invisible elements
      if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
        continue;
      }

      const id = el.id || "";
      const name = el.name || "";
      const label = findLabelForElement(el);
      const placeholder = el.placeholder || "";
      const ariaLabel = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || "";

      let options = [];
      if (el.tagName.toLowerCase() === "select") {
        options = Array.from(el.options).map((opt) => opt.text.trim());
      }

      results.push({
        id: id,
        name: name,
        label: label,
        type: el.tagName.toLowerCase() === "select" ? "select" : type,
        placeholder: placeholder,
        ariaLabel: ariaLabel,
        options: options,
        currentValue: el.value || "",
      });
    }

    return results;
  }

  /**
   * Resolve best human-readable label associated with an element.
   */
  function findLabelForElement(el) {
    if (el.id) {
      const explicitLabel = document.querySelector(`label[for="${el.id}"]`);
      if (explicitLabel && explicitLabel.innerText.trim()) {
        return explicitLabel.innerText.trim();
      }
    }

    // Check parent label
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.innerText.trim()) {
      return parentLabel.innerText.trim();
    }

    // Check preceding sibling or table cell
    const prev = el.previousElementSibling;
    if (prev && prev.innerText && prev.innerText.trim().length < 50) {
      return prev.innerText.trim();
    }

    const cell = el.closest("td");
    if (cell && cell.previousElementSibling) {
      const labelCell = cell.previousElementSibling;
      if (labelCell.innerText && labelCell.innerText.trim().length < 60) {
        return labelCell.innerText.trim();
      }
    }

    return el.placeholder || el.getAttribute("aria-label") || el.name || el.id || "";
  }

  /**
   * Safely fill DOM fields using React-compatible synthetic events.
   */
  function executeAutofill(matchedFields, overwriteEdited = false) {
    let filledCount = 0;
    let skippedCount = 0;
    const manualFieldsToHighlight = [];

    for (const match of matchedFields) {
      if (match.requiresManualReview || !match.valueToFill) {
        if (match.fieldName || match.fieldId) {
          manualFieldsToHighlight.push(match.fieldName || match.fieldId);
        }
        continue;
      }

      // Locate element by ID or Name
      let el = null;
      if (match.fieldId) {
        el = document.getElementById(match.fieldId);
      }
      if (!el && match.fieldName) {
        el = document.querySelector(`[name="${CSS.escape(match.fieldName)}"]`);
      }

      if (!el) continue;

      // Do not overwrite user manual edits unless explicitly requested
      if (el.dataset.spUserEdited === "true" && !overwriteEdited) {
        skippedCount++;
        continue;
      }

      const val = String(match.valueToFill);

      // Handle standard inputs and selects
      if (el.tagName.toLowerCase() === "select") {
        setSelectValue(el, val);
      } else if (el.type === "checkbox") {
        el.checked = val.toLowerCase() === "yes" || val === "true" || val === "1";
        dispatchInputEvents(el);
      } else if (el.type === "radio") {
        const radios = document.querySelectorAll(`[name="${CSS.escape(el.name)}"]`);
        for (const r of radios) {
          if (r.value.toLowerCase() === val.toLowerCase() || r.id.toLowerCase().includes(val.toLowerCase())) {
            r.checked = true;
            dispatchInputEvents(r);
            markFieldSuccess(r);
            break;
          }
        }
      } else {
        setNativeInputValue(el, val);
      }

      markFieldSuccess(el);
      filledCount++;
    }

    return {
      totalRequested: matchedFields.length,
      successfullyFilled: filledCount,
      skippedAlreadyEdited: skippedCount,
      manualReviewRequired: manualFieldsToHighlight,
    };
  }

  /**
   * Set value through React/Vue/native input prototype to trigger virtual DOM state updates.
   */
  function setNativeInputValue(el, value) {
    const prototype = Object.getPrototypeOf(el);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    dispatchInputEvents(el);
  }

  /**
   * Match and set select element option.
   */
  function setSelectValue(selectEl, targetValue) {
    const targetClean = targetValue.trim().lowerCase ? targetValue.trim().toLowerCase() : String(targetValue);
    let matchedIndex = -1;

    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optVal = (opt.value || "").toLowerCase();
      const optText = (opt.text || "").toLowerCase();

      if (optVal === targetClean || optText === targetClean) {
        matchedIndex = i;
        break;
      }
      if (optText.includes(targetClean) || targetClean.includes(optText)) {
        matchedIndex = i;
      }
    }

    if (matchedIndex >= 0) {
      selectEl.selectedIndex = matchedIndex;
      dispatchInputEvents(selectEl);
    }
  }

  function dispatchInputEvents(el) {
    el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true, cancelable: true }));
  }

  function markFieldSuccess(el) {
    el.dataset.spAutoFilled = "true";
    el.style.border = "2px solid #10b981";
    el.style.backgroundColor = "#f0fdf4";
    el.title = "ScholarPilot Autofilled (Verified Profile Fact)";
  }

  function highlightManualReviewFields(fieldIdentifiers) {
    for (const ident of fieldIdentifiers) {
      let el = document.getElementById(ident) || document.querySelector(`[name="${CSS.escape(ident)}"]`);
      if (el) {
        el.style.border = "2px solid #f59e0b";
        el.style.backgroundColor = "#fffbeb";
        el.title = "ScholarPilot: Requires Manual Student Entry";
      }
    }
  }
})();
