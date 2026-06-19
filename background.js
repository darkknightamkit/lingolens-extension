// background.js - LingoLens AI (Free APIs Only)

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lingolens-explain",
    title: "🔍 Explain with LingoLens AI",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "lingolens-explain" || !info.selectionText) return;

  chrome.storage.sync.get(["provider", "geminiKey", "groqKey", "language", "style"], async (s) => {
    const provider = s.provider || "gemini";
    const apiKey = provider === "gemini" ? (s.geminiKey || "") : (s.groqKey || "");

    const payload = {
      action: "explain",
      text: info.selectionText,
      provider,
      apiKey,
      language: s.language || "Hindi",
      style: s.style || "simple"
    };

    // Inject scripts first, then send message
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    } catch (e) { /* already injected */ }

    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch (e) { /* already injected */ }

    // Small delay to let content script initialize
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, payload, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("LingoLens: could not reach content script:", chrome.runtime.lastError.message);
        }
      });
    }, 100);
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callAI") {
    callAI(request.provider, request.text, request.language, request.style, request.apiKey)
      .then(result => sendResponse({ success: true, explanation: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

function buildPrompt(text, language, style) {
  const styleMap = {
    simple: "Explain in very simple everyday terms.",
    summary: "Give a short bulleted TL;DR summary.",
    detailed: "Give a deep, thorough explanation of all concepts.",
    kid: "Explain like the reader is a 10-year-old, using fun analogies."
  };
  const system = `You are an expert translator and tutor for Indian regional languages.
Target Language: ${language}
Style: ${styleMap[style] || styleMap.simple}

Reply in clean Markdown with exactly these three sections:
## मुख्य अर्थ | Direct Meaning
(Translate or summarise in ${language})
## आसान व्याख्या | Simple Explanation
(Explain the meaning in ${language})
## मुख्य शब्द | Key Words
(List 2-3 key terms with meanings in ${language})

Use warm, polite, authentic ${language}. Be concise.`;

  const user = `Explain this text in ${language}:\n---\n${text}\n---`;
  return { system, user };
}

async function callAI(provider, text, language, style, apiKey) {
  if (!apiKey) throw new Error("No API key found. Please open LingoLens popup and add your free API key.");

  const { system, user } = buildPrompt(text, language, style);

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || `Gemini error ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";

  } else if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || `Groq error ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "No response.";
  }

  throw new Error("Unknown provider.");
}
