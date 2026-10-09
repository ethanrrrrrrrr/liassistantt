/** Lia chat frontend: conversations saved locally in this browser. */
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const conversationList = document.getElementById("conversation-list");
const newChatButton = document.getElementById("new-chat-button");
const settingsButton = document.getElementById("settings-button");
const settingsBackdrop = document.getElementById("settings-backdrop");
const closeSettingsButton = document.getElementById("close-settings-button");
const themeSelect = document.getElementById("theme-select");
const exportChatsButton = document.getElementById("export-chats-button");
const clearChatsButton = document.getElementById("clear-chats-button");
const mobileMenuButton = document.getElementById("mobile-menu-button");
const attachImageButton = document.getElementById("attach-image-button");
const imageInput = document.getElementById("image-input");
const imagePreview = document.getElementById("image-preview");
const imagePreviewThumbnail = document.getElementById("image-preview-thumbnail");
const imagePreviewName = document.getElementById("image-preview-name");
const removeImageButton = document.getElementById("remove-image-button");

const CONVERSATIONS_KEY = "lia_conversations_v1";
const CURRENT_CONVERSATION_KEY = "lia_current_conversation_v1";
const SETTINGS_KEY = "lia_settings_v1";
const WELCOME_MESSAGE = "Salut ! Je suis Lia, ton assistant IA. Comment puis-je t’aider aujourd’hui ?";

let isProcessing = false;
let selectedImage = null;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
let conversations = loadConversations();
let settings = loadSettings();
let activeConversationId = localStorage.getItem(CURRENT_CONVERSATION_KEY);
let activeConversation = conversations.find((item) => item.id === activeConversationId);

if (!activeConversation) {
  activeConversation = createConversation();
  conversations.unshift(activeConversation);
  activeConversationId = activeConversation.id;
  persistConversations();
}

let chatHistory = activeConversation.messages;
applyTheme();
renderMessages();
renderConversationList();

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function loadConversations() {
  try {
    const parsed = safeParse(localStorage.getItem(CONVERSATIONS_KEY), []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && Array.isArray(item.messages))
      .map((item) => ({
        id: item.id,
        title: typeof item.title === "string" ? item.title : "Nouvelle conversation",
        updatedAt: Number(item.updatedAt) || Date.now(),
        messages: item.messages.filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string"),
      }));
  } catch (error) {
    console.warn("Impossible de lire les conversations sauvegardées.", error);
    return [];
  }
}

function loadSettings() {
  const saved = safeParse(localStorage.getItem(SETTINGS_KEY), {});
  return { theme: saved && saved.theme === "light" ? "light" : "dark" };
}

function createConversation() {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    title: "Nouvelle conversation",
    updatedAt: Date.now(),
    messages: [{ role: "assistant", content: WELCOME_MESSAGE }],
  };
}

function persistConversations() {
  try {
    activeConversation.messages = chatHistory;
    activeConversation.updatedAt = Date.now();
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
    localStorage.setItem(CURRENT_CONVERSATION_KEY, activeConversationId);
    updateSaveStatus(true);
  } catch (error) {
    console.error("La sauvegarde locale a échoué :", error);
    updateSaveStatus(false);
  }
}

function updateSaveStatus(saved) {
  const status = document.querySelector(".save-status");
  if (!status) return;
  status.innerHTML = saved
    ? '<span class="save-dot"></span> Enregistré'
    : '<span class="save-dot" style="background:#eaa34a"></span> Sauvegarde impossible';
  status.title = saved
    ? "Sauvegardé sur ce navigateur"
    : "Le navigateur n’a pas pu enregistrer les conversations. Vérifie l’espace disponible.";
}

function applyTheme() {
  document.body.dataset.theme = settings.theme;
  themeSelect.value = settings.theme;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (error) { console.warn("Paramètres non sauvegardés", error); }
}

function renderMessages() {
  chatMessages.replaceChildren();
  for (const message of chatHistory) addMessageToChat(message.role, message.content, false);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderConversationList() {
  conversationList.replaceChildren();
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "no-conversations";
    empty.textContent = "Tes conversations apparaîtront ici.";
    conversationList.appendChild(empty);
    return;
  }

  for (const conversation of sorted) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-item${conversation.id === activeConversationId ? " active" : ""}`;
    button.dataset.conversationId = conversation.id;
    const title = document.createElement("span");
    title.className = "conversation-title";
    title.textContent = conversation.title || "Nouvelle conversation";
    const date = document.createElement("span");
    date.className = "conversation-date";
    date.textContent = formatDate(conversation.updatedAt);
    button.append(title, date);
    conversationList.appendChild(button);
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Aujourd’hui";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function updateConversationTitle(message) {
  if (activeConversation.title !== "Nouvelle conversation") return;
  const shortTitle = message.trim().replace(/\s+/g, " ");
  activeConversation.title = shortTitle.length > 34 ? `${shortTitle.slice(0, 34)}…` : shortTitle;
}

function addMessageToChat(role, content, scroll = true, imageDataUrl = null) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  const paragraph = document.createElement("p");
  paragraph.textContent = content;
  messageEl.appendChild(paragraph);
  if (role === "user" && imageDataUrl) {
    const image = document.createElement("img");
    image.className = "message-image";
    image.src = imageDataUrl;
    image.alt = "Photo jointe à ce message";
    messageEl.appendChild(image);
  }
  chatMessages.appendChild(messageEl);
  if (scroll) chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageEl;
}

function startNewConversation() {
  if (isProcessing) return;
  const conversation = createConversation();
  conversations.unshift(conversation);
  activeConversation = conversation;
  activeConversationId = conversation.id;
  chatHistory = activeConversation.messages;
  persistConversations();
  renderMessages();
  renderConversationList();
  userInput.value = "";
  userInput.focus();
  document.body.classList.remove("sidebar-open");
}

function switchConversation(id) {
  if (isProcessing || id === activeConversationId) return;
  const selected = conversations.find((conversation) => conversation.id === id);
  if (!selected) return;
  activeConversation = selected;
  activeConversationId = selected.id;
  chatHistory = activeConversation.messages;
  persistConversations();
  renderMessages();
  renderConversationList();
  document.body.classList.remove("sidebar-open");
}

conversationList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-conversation-id]");
  if (button) switchConversation(button.dataset.conversationId);
});
newChatButton.addEventListener("click", startNewConversation);

function openSettings() {
  settingsBackdrop.hidden = false;
  document.body.classList.remove("sidebar-open");
  closeSettingsButton.focus();
}
function closeSettings() {
  settingsBackdrop.hidden = true;
  settingsButton.focus();
}
settingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", (event) => {
  if (event.target === settingsBackdrop) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!settingsBackdrop.hidden) closeSettings();
    document.body.classList.remove("sidebar-open");
  }
});

themeSelect.addEventListener("change", () => {
  settings.theme = themeSelect.value === "light" ? "light" : "dark";
  applyTheme();
});

exportChatsButton.addEventListener("click", () => {
  const data = {
    exportedAt: new Date().toISOString(),
    app: "Lia",
    conversations,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lia-conversations-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

clearChatsButton.addEventListener("click", () => {
  const confirmed = window.confirm("Supprimer toutes les conversations enregistrées sur ce navigateur ? Cette action est définitive si tu n’as pas exporté de copie.");
  if (!confirmed) return;
  conversations = [createConversation()];
  activeConversation = conversations[0];
  activeConversationId = activeConversation.id;
  chatHistory = activeConversation.messages;
  persistConversations();
  renderMessages();
  renderConversationList();
  closeSettings();
});

mobileMenuButton.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));

function clearSelectedImage() {
  selectedImage = null;
  imageInput.value = "";
  imagePreview.hidden = true;
  imagePreviewThumbnail.removeAttribute("src");
  imagePreviewName.textContent = "";
}

attachImageButton.addEventListener("click", () => {
  if (!isProcessing) imageInput.click();
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files && imageInput.files[0];
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    window.alert("Choisis une image PNG, JPEG ou WebP.");
    clearSelectedImage();
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    window.alert("Cette image dépasse 4 Mo. Choisis une image plus légère.");
    clearSelectedImage();
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    selectedImage = { name: file.name, type: file.type, dataUrl };
    imagePreviewThumbnail.src = dataUrl;
    imagePreviewName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} Mo`;
    imagePreview.hidden = false;
    userInput.focus();
  } catch (error) {
    console.error("Impossible de lire la photo :", error);
    window.alert("Je n’ai pas réussi à lire cette photo. Essaie avec une autre image.");
    clearSelectedImage();
  }
});

removeImageButton.addEventListener("click", clearSelectedImage);

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Fichier image illisible"));
    reader.onerror = () => reject(reader.error || new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

// Send with Enter (Shift+Enter inserts a line break).
userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});
sendButton.addEventListener("click", (event) => {
  event.preventDefault();
  sendMessage();
});

async function sendMessage() {
  const typedMessage = userInput.value.trim();
  if ((!typedMessage && !selectedImage) || isProcessing) return;

  const submittedImage = selectedImage;
  const messageText = typedMessage || "Peux-tu analyser cette image et m’expliquer ce qu’elle montre ?";
  const savedText = submittedImage
    ? `${messageText}\n[Photo jointe : ${submittedImage.name}; l’image elle-même n’est pas conservée dans l’historique local]`
    : messageText;

  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;
  attachImageButton.disabled = true;
  updateConversationTitle(messageText);
  chatHistory.push({ role: "user", content: savedText });
  addMessageToChat("user", messageText, true, submittedImage ? submittedImage.dataUrl : null);
  userInput.value = "";
  clearSelectedImage();
  typingIndicator.classList.add("visible");
  persistConversations();
  renderConversationList();

  let responseText = "";
  let assistantTextEl = null;
  try {
    const assistantMessageEl = document.createElement("div");
    assistantMessageEl.className = "message assistant-message";
    const paragraph = document.createElement("p");
    assistantMessageEl.appendChild(paragraph);
    chatMessages.appendChild(assistantMessageEl);
    assistantTextEl = paragraph;

    // For the current turn, send the clean prompt to the model and pass the image separately.
    const apiMessages = chatHistory.map((item, index) => {
      if (submittedImage && index === chatHistory.length - 1) {
        return { ...item, content: messageText };
      }
      return item;
    });
    const payload = { messages: apiMessages };
    if (submittedImage) payload.image = submittedImage.dataUrl;

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let detail = `erreur ${response.status}`;
      try {
        const errorBody = await response.json();
        if (typeof errorBody.error === "string") detail = errorBody.error;
      } catch (_) {}
      throw new Error(detail);
    }
    if (!response.body) throw new Error("La réponse du serveur est vide.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawDone = false;

    const flushAssistantText = () => {
      assistantTextEl.textContent = responseText;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const parsed = consumeSseEvents(buffer + "\n\n");
        for (const data of parsed.events) {
          if (data === "[DONE]") break;
          const content = parseAssistantContent(data);
          if (content) {
            responseText += content;
            flushAssistantText();
          }
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeSseEvents(buffer);
      buffer = parsed.buffer;
      for (const data of parsed.events) {
        if (data === "[DONE]") {
          sawDone = true;
          buffer = "";
          break;
        }
        const content = parseAssistantContent(data);
        if (content) {
          responseText += content;
          flushAssistantText();
        }
      }
      if (sawDone) break;
    }

    if (responseText.length > 0) {
      chatHistory.push({ role: "assistant", content: responseText });
    } else {
      assistantTextEl.textContent = "Je n’ai reçu aucun texte en réponse. Vérifie le modèle et réessaie.";
      chatHistory.push({ role: "assistant", content: assistantTextEl.textContent });
    }
  } catch (error) {
    console.error("Erreur pendant l’envoi du message :", error);
    const errorMessage = `Désolé, je n’ai pas pu répondre. ${error instanceof Error ? error.message : "Vérifie ta connexion puis réessaie."}`;
    if (assistantTextEl) assistantTextEl.textContent = errorMessage;
    else addMessageToChat("assistant", errorMessage);
    chatHistory.push({ role: "assistant", content: errorMessage });
  } finally {
    typingIndicator.classList.remove("visible");
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    attachImageButton.disabled = false;
    persistConversations();
    renderConversationList();
  }
}

function parseAssistantContent(data) {
  try {
    const jsonData = JSON.parse(data);
    if (typeof jsonData.response === "string") return jsonData.response;
    if (typeof jsonData.choices?.[0]?.delta?.content === "string") return jsonData.choices[0].delta.content;
    return "";
  } catch (error) {
    console.warn("Événement de réponse illisible :", error);
    return "";
  }
}

function consumeSseEvents(buffer) {
  let normalized = buffer.replace(/\r/g, "");
  const events = [];
  let eventEndIndex;
  while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
    const rawEvent = normalized.slice(0, eventEndIndex);
    normalized = normalized.slice(eventEndIndex + 2);
    const dataLines = rawEvent.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
    if (dataLines.length) events.push(dataLines.join("\n"));
  }
  return { events, buffer: normalized };
}
