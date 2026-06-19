// content.js - Guard against double injection
if (!window.__lingoLensLoaded) {
  window.__lingoLensLoaded = true;

  let panel = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "explain") {
      showPanel(request.text, request.language, request.style, request.apiKey, request.provider);
      sendResponse({ ok: true });
    }
  });

  function showPanel(text, language, style, apiKey, provider) {
    if (panel) { panel.remove(); panel = null; }

    const providerLabel = { gemini: "Gemini", groq: "Groq / Llama" }[provider] || "AI";

    panel = document.createElement("div");
    panel.id = "lingolens-panel";
    panel.innerHTML = `
      <div class="ll-header">
        <div class="ll-title">
          <span class="ll-logo">🔍</span>
          <span class="ll-name">LingoLens AI</span>
          <span class="ll-lang-badge">${language}</span>
        </div>
        <div class="ll-controls">
          <button class="ll-btn-icon ll-minimize" title="Minimize">−</button>
          <button class="ll-btn-icon ll-close" title="Close">✕</button>
        </div>
      </div>
      <div class="ll-body">
        <div class="ll-selected-text">
          <span class="ll-label">Selected text</span>
          <span class="ll-snippet">${truncate(text, 120)}</span>
        </div>
        <div class="ll-result">
          <div class="ll-loading">
            <div class="ll-spinner"></div>
            <span>Explaining in ${language}…</span>
          </div>
        </div>
      </div>
      <div class="ll-footer">
        <span class="ll-powered">via ${providerLabel} · Free</span>
        <button class="ll-copy-btn" style="display:none">Copy</button>
      </div>
    `;

    document.body.appendChild(panel);
    makeDraggable(panel);

    panel.querySelector(".ll-close").addEventListener("click", () => { panel.remove(); panel = null; });

    let minimized = false;
    panel.querySelector(".ll-minimize").addEventListener("click", () => {
      const body = panel.querySelector(".ll-body");
      const footer = panel.querySelector(".ll-footer");
      minimized = !minimized;
      body.style.display = minimized ? "none" : "";
      footer.style.display = minimized ? "none" : "";
      panel.querySelector(".ll-minimize").textContent = minimized ? "+" : "−";
    });

    chrome.runtime.sendMessage(
      { action: "callAI", text, language, style, apiKey, provider },
      (response) => {
        if (!panel) return;
        const resultEl = panel.querySelector(".ll-result");
        const copyBtn = panel.querySelector(".ll-copy-btn");
        if (response?.success) {
          resultEl.innerHTML = renderMarkdown(response.explanation);
          copyBtn.style.display = "block";
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(response.explanation);
            copyBtn.textContent = "Copied!";
            setTimeout(() => copyBtn.textContent = "Copy", 2000);
          });
        } else {
          resultEl.innerHTML = `<div class="ll-error">⚠️ ${response?.error || "Unknown error."}</div>`;
        }
      }
    );
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  function renderMarkdown(text) {
    return text
      .replace(/^## (.+)$/gm, '<h3 class="ll-md-h3">$1</h3>')
      .replace(/^### (.+)$/gm, '<h4 class="ll-md-h4">$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n\n+/g, '</p><p class="ll-md-p">')
      .replace(/^(?!<)/, '<p class="ll-md-p">')
      .replace(/([^>])$/, '$1</p>');
  }

  function makeDraggable(el) {
    const header = el.querySelector(".ll-header");
    header.style.cursor = "grab";
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".ll-btn-icon")) return;
      isDragging = true;
      const rect = el.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      header.style.cursor = "grabbing";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - dragOffsetX));
      const y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - dragOffsetY));
      el.style.right = "auto"; el.style.bottom = "auto";
      el.style.left = x + "px"; el.style.top = y + "px";
    });
    document.addEventListener("mouseup", () => { isDragging = false; header.style.cursor = "grab"; });
  }
}
