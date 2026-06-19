// popup.js - Free API providers

const providerMeta = {
  gemini: {
    label: "Gemini API Key",
    placeholder: "AIza…",
    hint: "Sign in with Google → Create API key → Copy & paste here. No billing required.",
    link: "https://aistudio.google.com/app/apikey",
    linkText: "Get free key →"
  },
  groq: {
    label: "Groq API Key",
    placeholder: "gsk_…",
    hint: "Free account at console.groq.com → API Keys → Create. 14,400 requests/day free.",
    link: "https://console.groq.com",
    linkText: "Get free key →"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const languageSelect = document.getElementById("language");
  const styleSelect = document.getElementById("style");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const keyLabel = document.getElementById("keyLabel");
  const keyHint = document.getElementById("keyHint");
  const getKeyLink = document.getElementById("getKeyLink");
  const eyeBtn = document.getElementById("eyeBtn");
  const cards = document.querySelectorAll(".provider-card");

  let currentProvider = "gemini";
  const keyCache = { gemini: "", groq: "" };

  // Load saved settings
  chrome.storage.sync.get(["provider", "geminiKey", "groqKey", "language", "style"], (data) => {
    currentProvider = data.provider || "gemini";
    keyCache.gemini = data.geminiKey || "";
    keyCache.groq = data.groqKey || "";
    setActiveCard(currentProvider);
    if (data.language) languageSelect.value = data.language;
    if (data.style) styleSelect.value = data.style;
  });

  function setActiveCard(provider) {
    cards.forEach(c => c.classList.toggle("active", c.dataset.provider === provider));
    const meta = providerMeta[provider];
    keyLabel.textContent = meta.label;
    apiKeyInput.placeholder = meta.placeholder;
    keyHint.textContent = meta.hint;
    getKeyLink.href = meta.link;
    getKeyLink.textContent = meta.linkText;
    apiKeyInput.value = keyCache[provider] || "";
    currentProvider = provider;
  }

  cards.forEach(card => {
    card.addEventListener("click", () => {
      keyCache[currentProvider] = apiKeyInput.value.trim();
      setActiveCard(card.dataset.provider);
    });
  });

  // Show/hide key
  let shown = false;
  eyeBtn.addEventListener("click", () => {
    shown = !shown;
    apiKeyInput.type = shown ? "text" : "password";
    eyeBtn.textContent = shown ? "🙈" : "👁";
  });

  // Save
  saveBtn.addEventListener("click", () => {
    keyCache[currentProvider] = apiKeyInput.value.trim();
    chrome.storage.sync.set({
      provider: currentProvider,
      geminiKey: keyCache.gemini,
      groqKey: keyCache.groq,
      language: languageSelect.value,
      style: styleSelect.value
    }, () => {
      status.classList.add("success");
      setTimeout(() => status.classList.remove("success"), 3000);
    });
  });
});
