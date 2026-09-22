// const API = window.location.protocol === "file:" ? "http://localhost:5050" : "";
// const TOKEN_KEY = "smartStudyToken";
// const USER_KEY = "smartStudyUser";

// const $ = (selector) => document.querySelector(selector);
// const $$ = (selector) => [...document.querySelectorAll(selector)];

// let currentUser = null;
// let lastAiAnswer = "";
// let currentInterview = null;
// let interviewQuestions = [];
// let currentInterviewIndex = 0;
// let roomSocket = null;
// let recognition = null;
// let noteTimer = null;
// let selectedChatImage = null;
// let lastReminders = new Set();
// let lastRoomId = "";
// let lastRoomInviteToken = "";
// let currentTutorMode = "normal";
// let flashcardsCache = [];
// let flashcardFilter = "due";
// let currentQuiz = null;
// let currentQuizIndex = 0;
// let currentQuizAnswers = {};

// function token() {
//   return localStorage.getItem(TOKEN_KEY) || "";
// }

// function esc(value = "") {
//   return String(value).replace(/[&<>"']/g, (char) => ({
//     "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
//   }[char]));
// }

// function friendlyError(error, fallback = "Something went wrong. Please try again.") {
//   const message = String(error?.message || error || fallback);
//   if (error?.status === 402 || /AI_BUDGET_EXCEEDED|exceed the AI budget/i.test(message)) {
//     return "This study generation reached the AI budget for the current session. Start a new session or increase AI_BUDGET_USD_PER_SESSION in Backend/.env.";
//   }
//   if (error?.status === 429 || /quota|resource_exhausted|rate.?limit/i.test(message)) {
//     return "The external AI provider is currently unavailable. Smart Study AI will use its built-in local fallback where supported; retry when the provider quota is available for richer AI generation.";
//   }
//   if (/401|unauthorized|authentication token/i.test(message)) {
//     return "Your session has expired. Please sign in again.";
//   }
//   if (/failed to fetch|networkerror|load failed/i.test(message)) {
//     return "The backend cannot be reached. Make sure Smart Study AI is running at http://localhost:5050.";
//   }
//   return message || fallback;
// }

// async function api(path, options = {}) {
//   const headers = { ...(options.headers || {}) };
//   if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
//     headers["Content-Type"] = "application/json";
//   }
//   const accessToken = token();
//   if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

//   let response;
//   try {
//     response = await fetch(`${API}${path}`, {
//       ...options,
//       headers,
//       credentials: "include"
//     });
//   } catch (error) {
//     throw new Error(friendlyError(error));
//   }

//   const text = await response.text();
//   let data = {};
//   try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

//   if (!response.ok) {
//     const error = new Error(data.error || data.message || `Request failed (${response.status})`);
//     error.status = response.status;
//     error.code = data.code;
//     if (response.status === 401 && !path.startsWith("/api/auth/")) {
//       await clearSession("Your session expired. Please sign in again.");
//     }
//     throw error;
//   }
//   return data;
// }

// function setBusy(button, busy, busyText = "Working…") {
//   if (!button) return;
//   if (busy) {
//     button.dataset.originalText = button.textContent;
//     button.disabled = true;
//     button.classList.add("is-loading");
//     button.textContent = busyText;
//   } else {
//     button.disabled = false;
//     button.classList.remove("is-loading");
//     button.textContent = button.dataset.originalText || button.textContent;
//     delete button.dataset.originalText;
//   }
// }

// function toast(message, kind = "info") {
//   const element = $("#toast");
//   if (!element) return;
//   element.textContent = message;
//   element.dataset.kind = kind;
//   element.classList.add("show");
//   clearTimeout(toast.timer);
//   toast.timer = setTimeout(() => element.classList.remove("show"), 4200);
// }

// function setAuthMessage(message = "", kind = "error") {
//   const element = $("#authMessage");
//   if (!element) return;
//   element.textContent = message;
//   element.dataset.kind = kind;
//   element.classList.toggle("show", Boolean(message));
// }

// function setAuthMode(mode) {
//   const register = mode === "register";
//   $("#authMode").value = mode;
//   $("#authNameWrap").classList.toggle("hidden", !register);
//   $("#authName").required = register;
//   $("#authSubmit").textContent = register ? "Create account" : "Sign in";
//   $("#authTitle").textContent = register ? "Create your study workspace" : "Welcome back";
//   $("#authSubtitle").textContent = register
//     ? "Build one private learning space for AI study, projects and productivity."
//     : "Continue your learning session across study, research and productivity tools.";
//   $("#loginTab").classList.toggle("active", !register);
//   $("#registerTab").classList.toggle("active", register);
//   setAuthMessage("");
//   if ($("#forgotPasswordBtn")) $("#forgotPasswordBtn").classList.toggle("hidden", register);
//   if ($("#resetPanel")) $("#resetPanel").classList.add("hidden");
// }

// function showAuth(message = "") {
//   document.body.classList.add("auth-only");
//   $("#authScreen").classList.remove("hidden");
//   $("#appShell").classList.add("hidden");
//   setAuthMode($("#authMode").value || "login");
//   if (message) setAuthMessage(message);
// }

// function showApp(user) {
//   currentUser = user || JSON.parse(localStorage.getItem(USER_KEY) || "null");
//   document.body.classList.remove("auth-only");
//   $("#authScreen").classList.add("hidden");
//   $("#appShell").classList.remove("hidden");
//   $("#userName").textContent = currentUser?.name || "Student";
//   $("#userEmail").textContent = currentUser?.email || "";
//   $("#avatar").textContent = (currentUser?.name || "S").trim().charAt(0).toUpperCase();
// }

// async function clearSession(message = "") {
//   if (roomSocket) {
//     try { roomSocket.close(); } catch {}
//     roomSocket = null;
//   }
//   localStorage.removeItem(TOKEN_KEY);
//   localStorage.removeItem(USER_KEY);
//   currentUser = null;
//   if (message) showAuth(message);
// }

// async function submitAuth(event) {
//   event.preventDefault();
//   const mode = $("#authMode").value;
//   const submit = $("#authSubmit");
//   const body = {
//     email: $("#authEmail").value.trim(),
//     password: $("#authPassword").value
//   };
//   if (mode === "register") body.name = $("#authName").value.trim();

//   if (mode === "register" && body.name.length < 2) {
//     setAuthMessage("Please enter your name.");
//     return;
//   }
//   if (!/^\S+@\S+\.\S+$/.test(body.email)) {
//     setAuthMessage("Enter a valid email address.");
//     return;
//   }
//   if (body.password.length < 6) {
//     setAuthMessage("Password must be at least 6 characters.");
//     return;
//   }

//   setBusy(submit, true, mode === "register" ? "Creating…" : "Signing in…");
//   setAuthMessage("");
//   try {
//     const data = await api(`/api/auth/${mode === "register" ? "register" : "login"}`, {
//       method: "POST",
//       body: JSON.stringify(body)
//     });
//     localStorage.setItem(TOKEN_KEY, data.token);
//     localStorage.setItem(USER_KEY, JSON.stringify(data.user));
//     showApp(data.user);
//     $("#authForm").reset();
//     await bootAuthenticatedApp();
//     toast(mode === "register" ? "Account created successfully." : "Signed in successfully.", "success");
//   } catch (error) {
//     setAuthMessage(friendlyError(error));
//   } finally {
//     setBusy(submit, false);
//   }
// }

// async function validateSession() {
//   if (!token()) {
//     showAuth();
//     return false;
//   }
//   try {
//     const data = await api("/api/auth/me");
//     localStorage.setItem(USER_KEY, JSON.stringify(data.user));
//     showApp(data.user);
//     return true;
//   } catch {
//     await clearSession();
//     showAuth("Please sign in to continue.");
//     return false;
//   }
// }

// async function logout() {
//   try {
//     if (token()) await api("/api/auth/logout", { method: "POST" });
//   } catch {}
//   await clearSession();
//   showAuth("You have been signed out.", "success");
// }

// function go(id) {
//   const target = $(`#${id}`);
//   if (!target) return;
//   $$(".section").forEach((section) => section.classList.toggle("active", section.id === id));
//   $$(".nav").forEach((button) => button.classList.toggle("active", button.dataset.section === id));
//   $("#mobileNav").classList.remove("open");
//   window.scrollTo({ top: 0, behavior: "smooth" });
// }

// function applyTheme() {
//   const theme = localStorage.getItem("theme") || "dark";
//   document.body.classList.toggle("light", theme === "light");
//   $("#themeToggle").textContent = theme === "light" ? "☀" : "☾";
// }

// async function status() {
//   try {
//     const data = await api("/api/integrations/status");
//     $("#connectionStatus").textContent = data.connected ? "Google connected" : "Google not connected";
//     $("#connectionStatus").className = `status-pill ${data.connected ? "ok" : "neutral"}`;
//     $("#connectionStatus").title = `Gmail: ${data.gmail ? "ready" : "off"} · Calendar: ${data.calendar ? "ready" : "off"}`;
//   } catch {
//     $("#connectionStatus").textContent = "Backend offline";
//     $("#connectionStatus").className = "status-pill danger";
//   }
// }

// async function loadDashboardSummary() {
//   try {
//     const data = await api("/api/dashboard");
//     const dashboard = data.data;
//     const overview = dashboard.overview || {};
//     $("#welcomeTitle").textContent = `Welcome, ${dashboard.user?.name || currentUser?.name || "Student"}`;
//     $("#statStudy").textContent = `${overview.todayStudyTimeMinutes || 0} min`;
//     $("#statQuiz").textContent = `${overview.averageQuizScore || 0}%`;
//     $("#statCards").textContent = String(overview.flashcardsDue || 0);
//     $("#statProgress").textContent = `${overview.dailyProgress || 0}%`;
//     const weak = dashboard.weakTopics || [];
//     $("#weakTopicSummary").textContent = weak.length ? `Focus next: ${weak[0].name}` : "No weak topics detected yet";
//   } catch (error) {
//     if (error.status !== 401) console.warn("Dashboard summary unavailable", error);
//   }
// }

// async function loadAdaptiveRecommendation() {
//   const title = $("#adaptiveTitle");
//   const reason = $("#adaptiveReason");
//   const badge = $("#adaptiveModeBadge");
//   const dataBox = $("#adaptiveData");
//   const button = $("#adaptiveNextPackBtn");
//   if (!title || !reason || !badge || !dataBox || !button) return;
//   try {
//     const response = await api("/api/adaptive/next");
//     const data = response.data || {};
//     const mode = String(data.mode || "learn").toUpperCase();
//     title.textContent = data.focusTopic ? `Next: ${data.focusTopic}` : "Your next study move";
//     reason.textContent = data.reason || data.nextAction || "Keep building your learning streak.";
//     badge.textContent = mode;
//     badge.dataset.mode = String(data.mode || "learn");
//     const ld = data.learningData || {};
//     dataBox.innerHTML = [
//       `<span><b>${Number(data.mastery || 0)}%</b> focus mastery</span>`,
//       `<span><b>${Number(ld.dueFlashcards || 0)}</b> due cards</span>`,
//       `<span><b>${Number(ld.weakTopics || 0)}</b> weak topics</span>`,
//       `<span><b>${ld.recentQuizAverage == null ? "—" : `${ld.recentQuizAverage}%`}</b> quiz avg</span>`
//     ].join("");
//     button.disabled = false;
//     button.title = data.canGenerateNextPack ? "Use your latest saved study material to build the next adaptive pack" : "Create a study pack first";
//     button.textContent = data.canGenerateNextPack ? "Build next study pack" : "Create first study pack";
//     button.dataset.adaptiveMode = data.mode || "learn";
//     button.dataset.canGenerate = String(Boolean(data.canGenerateNextPack));
//   } catch (error) {
//     if (error.status !== 401) {
//       reason.textContent = friendlyError(error);
//       dataBox.innerHTML = '<span>Adaptive data unavailable right now.</span>';
//       button.disabled = true;
//     }
//   }
// }

// async function generateAdaptiveNextPack() {
//   const button = $("#adaptiveNextPackBtn");
//   if (!button || button.disabled) return;
//   if (button.dataset.canGenerate === "false") { go("packs"); $("#studyText")?.focus(); toast("Create your first study pack from notes or a file, then the adaptive engine can build the next one.", "info"); return; }
//   setBusy(button, true, "Adapting…");
//   try {
//     const response = await api("/api/adaptive/next-pack", { method: "POST", body: JSON.stringify({}) });
//     const result = response.data?.analysis || response.data || {};
//     const sourceTitle = response.sourceSession?.title || "Adaptive Study Pack";
//     result.sourceText = String(response.sourceText || "");
//     result.flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
//     result.quiz = Array.isArray(result.quiz || result.questions) ? (result.quiz || result.questions) : [];
//     result.keywords = Array.isArray(result.keywords || result.keyPoints) ? (result.keywords || result.keyPoints) : [];
//     result.mindmap = result.mindmap || { mainTopic: sourceTitle, subTopics: [] };
//     for (const key of ["memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]) result[key] = Array.isArray(result[key]) ? result[key] : [];
//     const saved = await saveStudyArtifacts(result, sourceTitle, response.sourceSession?.documentId || "");
//     renderStudyPack({ analysis: result, saved, adaptive: response.recommendation });
//     go("packs");
//     toast(`Adaptive pack ready · focused on ${response.recommendation?.focusTopic || "your next topic"}.`, "success");
//     await loadAdaptiveRecommendation();
//   } catch (error) {
//     toast(friendlyError(error), "error");
//   } finally {
//     setBusy(button, false);
//   }
// }

// async function loadTodos() {
//   try {
//     const data = await api("/api/todos");
//     const todos = Array.isArray(data.todos) ? data.todos : [];
//     $("#todoList").innerHTML = todos.length ? todos.map((todo) => `
//       <div class="list-item todo-item ${todo.completed ? "done" : ""}">
//         <label class="todo-main">
//           <input type="checkbox" data-id="${esc(todo.id)}" ${todo.completed ? "checked" : ""} aria-label="Mark ${esc(todo.title)} complete">
//           <span><b>${esc(todo.title)}</b><small>${todo.dueDate ? `Due ${esc(todo.dueDate)} · ` : ""}${esc(todo.priority)}</small></span>
//         </label>
//         <button class="icon-btn danger-btn" data-delete-todo="${esc(todo.id)}" aria-label="Delete task">×</button>
//       </div>`).join("") : '<div class="empty-state">No tasks yet. Add your first study task above.</div>';
//     const open = todos.filter((todo) => !todo.completed).length;
//     const completed = todos.length - open;
//     $("#todoStats").textContent = `${open} open · ${completed} completed`;
//     $$("[data-id]").forEach((checkbox) => {
//       checkbox.onchange = async () => {
//         try {
//           await api(`/api/todos/${encodeURIComponent(checkbox.dataset.id)}`, {
//             method: "PATCH",
//             body: JSON.stringify({ completed: checkbox.checked })
//           });
//           await loadTodos();
//         } catch (error) { toast(friendlyError(error), "error"); }
//       };
//     });
//     $$("[data-delete-todo]").forEach((button) => {
//       button.onclick = async () => {
//         try {
//           await api(`/api/todos/${encodeURIComponent(button.dataset.deleteTodo)}`, { method: "DELETE" });
//           await loadTodos();
//         } catch (error) { toast(friendlyError(error), "error"); }
//       };
//     });
//   } catch (error) {
//     $("#todoList").innerHTML = '<div class="empty-state">Tasks are temporarily unavailable.</div>';
//     if (error.status !== 401) toast(friendlyError(error), "error");
//   }
// }

// async function submitTodo(event) {
//   event.preventDefault();
//   const button = $("#todoForm button[type=submit]");
//   const title = $("#todoTitle").value.trim();
//   if (!title) return;
//   setBusy(button, true, "Adding…");
//   try {
//     await api("/api/todos", {
//       method: "POST",
//       body: JSON.stringify({
//         title,
//         dueDate: $("#todoDueDate").value || null,
//         priority: $("#todoPriority").value
//       })
//     });
//     $("#todoForm").reset();
//     await loadTodos();
//   } catch (error) { toast(friendlyError(error), "error"); }
//   finally { setBusy(button, false); }
// }

// function renderInlineMarkdown(value = "") {
//   let html = esc(value);
//   html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
//   html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
//   html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
//   html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
//   html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
//   return html;
// }

// function renderMarkdown(value = "") {
//   const lines = String(value).replace(/\r\n?/g, "\n").trim().split("\n");
//   if (!lines.length || !lines.join("").trim()) return "";
//   const html = [];
//   let paragraph = [];
//   let listType = null;
//   let listItems = [];
//   let codeLines = null;
//   let codeLanguage = "code";

//   const flushParagraph = () => {
//     if (!paragraph.length) return;
//     html.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
//     paragraph = [];
//   };
//   const flushList = () => {
//     if (!listItems.length) return;
//     html.push(`<${listType}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${listType}>`);
//     listItems = [];
//     listType = null;
//   };
//   const flushCode = () => {
//     if (!codeLines) return;
//     const code = codeLines.join("\n");
//     html.push(`<div class="code-answer"><div class="code-answer-head"><span>${esc(codeLanguage)}</span><button type="button" class="copy-code" data-code="${esc(code)}">Copy</button></div><pre>${esc(code)}</pre></div>`);
//     codeLines = null;
//     codeLanguage = "code";
//   };

//   for (const rawLine of lines) {
//     const line = rawLine.trimEnd();
//     if (line.startsWith("```")) {
//       if (codeLines) flushCode();
//       else { flushParagraph(); flushList(); codeLanguage = line.slice(3).trim() || "code"; codeLines = []; }
//       continue;
//     }
//     if (codeLines) { codeLines.push(line); continue; }
//     if (!line.trim()) { flushParagraph(); flushList(); continue; }

//     const heading = line.match(/^(#{1,3})\s+(.+)$/);
//     if (heading) { flushParagraph(); flushList(); const level = heading[1].length + 1; html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`); continue; }
//     const quote = line.match(/^>\s+(.+)$/);
//     if (quote) { flushParagraph(); flushList(); html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`); continue; }
//     const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
//     const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
//     if (ordered || unordered) {
//       const nextType = ordered ? "ol" : "ul";
//       if (listType && listType !== nextType) flushList();
//       flushParagraph();
//       listType = nextType;
//       listItems.push((ordered || unordered)[1]);
//       continue;
//     }
//     flushList();
//     paragraph.push(line);
//   }
//   if (codeLines) flushCode();
//   flushParagraph();
//   flushList();
//   return html.join("");
// }

// function addChat(text, who = "ai", meta = {}) {
//   if (!text) return;
//   const element = document.createElement("article");
//   element.className = `msg ${who === "user" ? "user" : "ai"}`;
//   if (who === "user") {
//     element.textContent = String(text);
//   } else {
//     const sourceLabel = meta.sources?.length ? "Based on your study material" : "LLM tutor response";
//     element.innerHTML = `<div class="msg-head"><span>${esc(sourceLabel)}</span><button type="button" class="copy-answer">Copy answer</button></div><div class="msg-content">${renderMarkdown(text)}</div>`;
//     const copyButton = element.querySelector(".copy-answer");
//     copyButton.onclick = async () => {
//       try { await navigator.clipboard.writeText(String(text)); copyButton.textContent = "Copied"; setTimeout(() => { copyButton.textContent = "Copy answer"; }, 1400); }
//       catch { toast("Copy is unavailable in this browser.", "error"); }
//     };
//     element.querySelectorAll(".copy-code").forEach((button) => {
//       button.onclick = async () => {
//         try { await navigator.clipboard.writeText(button.dataset.code || ""); button.textContent = "Copied"; setTimeout(() => { button.textContent = "Copy"; }, 1400); }
//         catch { toast("Copy is unavailable in this browser.", "error"); }
//       };
//     });
//   }
//   $("#chatBox").appendChild(element);
//   $("#chatBox").scrollTop = $("#chatBox").scrollHeight;
// }

// function showAiError(error, container = $("#chatBox")) {
//   const message = friendlyError(error);
//   const element = document.createElement("div");
//   element.className = "msg error-message";
//   element.innerHTML = `<strong>AI service unavailable</strong><br>${esc(message)}`;
//   container.appendChild(element);
//   container.scrollTop = container.scrollHeight;
//   toast(message, "error");
// }

// async function sendChat() {
//   const input = $("#userInput");
//   const button = $("#sendBtn");
//   const question = input.value.trim();
//   if (!question && !selectedChatImage) return;
//   const mode = currentTutorMode;
//   const image = selectedChatImage;
//   input.value = "";
//   addChat(image ? `${question || "Explain this image"} 📷 ${image.name}` : question, "user");
//   setBusy(button, true, image ? "Analyzing image…" : "Thinking…");

//   try {
//     let data;
//     let lastError;

//     for (let attempt = 1; attempt <= (image ? 2 : 1); attempt += 1) {
//       try {
//         if (image) {
//           const form = new FormData();
//           form.append("question", question || "Explain this image for my studies. Give a clear, detailed explanation of what is visible.");
//           form.append("sessionId", "default");
//           form.append("tutorMode", mode);
//           form.append("image", image);
//           data = await api("/api/ai/chat/multimodal", { method: "POST", body: form });
//         } else {
//           data = await api("/api/ai/chat", {
//             method: "POST",
//             body: JSON.stringify({ question, contextMode: "general", tutorMode: mode })
//           });
//         }
//         if (data?.reply) break;
//       } catch (error) {
//         lastError = error;
//         if (attempt < (image ? 2 : 1)) await new Promise(resolve => setTimeout(resolve, 700));
//       }
//     }

//     if (!data?.reply) throw lastError || new Error("The AI did not return an answer.");

//     lastAiAnswer = data.reply;
//     addChat(lastAiAnswer, "ai", { sources: data.sources || [] });

//     if (image) {
//       selectedChatImage = null;
//       const imageInput = $("#chatImageInput");
//       const preview = $("#imagePreviewName");
//       if (imageInput) imageInput.value = "";
//       if (preview) preview.textContent = "";
//     }
//     return true;
//   } catch (error) {
//     // Keep the selected image so the user can retry without selecting it again.
//     showAiError(error);
//     return false;
//   } finally {
//     setBusy(button, false);
//   }
// }

// async function saveStudyArtifacts(result, title, documentId) {
//   const flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
//   const quiz = Array.isArray(result.quiz) ? result.quiz : [];
//   if (!flashcards.length && !quiz.length) return { sessionId: null, savedCards: 0, savedQuiz: false };
//   let sessionId = null;
//   try {
//     const session = await api("/api/sessions", {
//       method: "POST",
//       body: JSON.stringify({
//         title: title || "Study Pack",
//         documentName: title || "Study Notes",
//         documentId: /^[a-f0-9]{24}$/i.test(String(documentId || "")) ? documentId : undefined,
//         studyText: String(result.sourceText || "").slice(0, 100000),
//         summary: result.summary || "",
//         keywords: Array.isArray(result.keywords) ? result.keywords : [],
//         flashcards: flashcards.map(x => ({ question: String(x.question || x.front || "Question"), answer: String(x.answer || x.back || "") })),
//         quiz: quiz.map(x => ({ question: String(x.question || "Question"), options: Array.isArray(x.options) ? x.options : [], answer: String(x.answer || "") })),
//         mindmap: result.mindmap || { mainTopic: title || "Study Pack", subTopics: [] },
//         memoryTricks: Array.isArray(result.memoryTricks) ? result.memoryTricks : [],
//         cheatSheet: Array.isArray(result.cheatSheet) ? result.cheatSheet : [],
//         formulas: Array.isArray(result.formulas) ? result.formulas : [],
//         commonMistakes: Array.isArray(result.commonMistakes) ? result.commonMistakes : [],
//         examTips: Array.isArray(result.examTips) ? result.examTips : [],
//         learningMethods: Array.isArray(result.learningMethods) ? result.learningMethods : [],
//         revisionPlan: Array.isArray(result.revisionPlan) ? result.revisionPlan : [],
//         practiceQuestions: Array.isArray(result.practiceQuestions) ? result.practiceQuestions : [],
//         examples: Array.isArray(result.examples) ? result.examples : []
//       })
//     });
//     sessionId = session.session?._id || session.data?._id || null;
//   } catch (error) {
//     console.warn("Study session persistence failed", error);
//   }
//   let savedCards = 0;
//   for (const card of flashcards) {
//     try {
//       await api("/api/flashcards", { method: "POST", body: JSON.stringify({
//         question: String(card.question || card.front || "Question").trim(),
//         answer: String(card.answer || card.back || "").trim(),
//         topic: title || "Study Pack",
//         sessionId: sessionId || undefined,
//         documentId: /^[a-f0-9]{24}$/i.test(String(documentId || "")) ? documentId : undefined,
//         difficulty: ["easy", "medium", "hard"].includes(String(card.difficulty || "").toLowerCase()) ? String(card.difficulty).toLowerCase() : "medium"
//       }) });
//       savedCards++;
//     } catch (error) { console.warn("Flashcard persistence failed", error); }
//   }
//   let savedQuiz = false;
//   if (quiz.length) {
//     const questions = quiz.map(item => {
//       const options = Array.isArray(item.options) ? item.options.map(String).slice(0, 4) : [];
//       const answer = String(item.answer || item.correctAnswer || "");
//       return { question: String(item.question || "Question"), options, correctAnswer: options.includes(answer) ? answer : options[0] || answer, explanation: String(item.explanation || ""), topic: title || "Study Pack" };
//     }).filter(q => q.options.length === 4 && q.correctAnswer);
//     if (questions.length) {
//       try {
//         await api("/api/quizzes", { method: "POST", body: JSON.stringify({ title: title || "Study Quiz", topic: title || "Study Pack", sessionId: sessionId || undefined, documentId: /^[a-f0-9]{24}$/i.test(String(documentId || "")) ? documentId : undefined, questions }) });
//         savedQuiz = true;
//       } catch (error) { console.warn("Quiz persistence failed", error); }
//     }
//   }
//   return { sessionId, savedCards, savedQuiz };
// }

// async function generateStudyPack() {
//   const text = $("#studyText").value.trim();
//   const button = $("#analyzeBtn");
//   setBusy(button, true, "Building pack…");
//   $("#analysisOutput").innerHTML = '<div class="loading-card"><b>Building your study pack…</b><p>Reading the material, extracting concepts, writing recall cards and preparing a practice quiz.</p></div>';
//   try {
//     let sourceText = text;
//     let documentId;
//     let documentIds = [];
//     const files = [...(Array.from($("#pdfInput")?.files || []))];
//     if (!sourceText && files.length) {
//       for (const item of files) if (item.size > 15 * 1024 * 1024) throw new Error(`${item.name} is larger than 15 MB.`);
//       const form = new FormData();
//       files.forEach((item) => form.append("files", item));
//       const upload = await api("/api/documents/upload", { method: "POST", body: form });
//       const docs = upload.documents || [];
//       const failed = upload.errors || [];
//       sourceText = docs.map((item) => `# ${item.title || item.documentName || "Document"}\n${item.text || ""}`).join("\n\n");
//       documentIds = docs.map(item => item.documentId).filter(Boolean);
//       documentId = documentIds[0];
//       if (!sourceText.trim()) {
//         const detail = failed.map((item) => `${item.title || "File"}: ${item.error || "could not be read"}`).join("\n");
//         throw new Error(detail || "No readable content was extracted from the selected files.");
//       }
//       if (failed.length) toast(`${failed.length} file(s) could not be read. The readable files will still be used.`, "error");
//     }
//     if (sourceText.length < 50) throw new Error("Add at least 50 characters of notes or choose a readable file.");
//     const studyPreferences = {
//       style: $("#packStyle")?.value || "balanced",
//       difficulty: $("#packDifficulty")?.value || "adaptive",
//       targetExam: $("#packExam")?.value.trim() || "",
//       focus: $("#packFocus")?.value.trim() || ""
//     };
//     const data = await api("/api/ai/task", { method: "POST", body: JSON.stringify({ goal: "Create the best possible source-grounded study pack: summary, concept map, cheat sheet, formulas or rules when supported, memory tricks, common mistakes, exam tips, active-learning methods, revision plan, examples, 12 flashcards, 10 four-option practice questions and short-answer checks.", text: sourceText, title: files.map(x => x.name).join(", ") || "Study Notes", documentId, documentIds, contextMode: "study", studyPreferences }) });
//     const result = data.analysis || data;
//     result.sourceText = sourceText;
//     result.flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
//     result.quiz = Array.isArray(result.quiz || result.questions) ? (result.quiz || result.questions) : [];
//     result.keywords = Array.isArray(result.keywords || result.keyPoints) ? (result.keywords || result.keyPoints) : [];
//     result.mindmap = result.mindmap || { mainTopic: files.map(x => x.name).join(", ") || "Study Notes", subTopics: [] };
//     for (const key of ["memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]) result[key] = Array.isArray(result[key]) ? result[key] : [];
//     const saved = await saveStudyArtifacts(result, files.map(x => x.name).join(", ") || "Study Notes", documentId);
//     renderStudyPack({ ...data, analysis: result, saved });
//     toast(`Study pack ready · ${saved.savedCards} flashcards${saved.savedQuiz ? " · quiz saved" : ""}.`, "success");
//   } catch (error) {
//     $("#analysisOutput").innerHTML = `<div class="error-card"><strong>Study pack could not be generated.</strong><p>${esc(friendlyError(error))}</p></div>`;
//     toast(friendlyError(error), "error");
//   } finally { setBusy(button, false); }
// }

// function renderStudyPack(data) {
//   const result = data.analysis || data;
//   const summary = result.summary || result.overview || result.reply || "";
//   const keywords = Array.isArray(result.keywords || result.keyPoints) ? (result.keywords || result.keyPoints) : [];
//   const flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
//   const quiz = Array.isArray(result.quiz || result.questions) ? (result.quiz || result.questions) : [];
//   const mindmap = result.mindmap || {};
//   const memoryTricks = result.memoryTricks || [];
//   const cheatSheet = result.cheatSheet || [];
//   const formulas = result.formulas || [];
//   const commonMistakes = result.commonMistakes || [];
//   const examTips = result.examTips || [];
//   const learningMethods = result.learningMethods || [];
//   const revisionPlan = result.revisionPlan || [];
//   const practiceQuestions = result.practiceQuestions || [];
//   const examples = result.examples || [];
//   const escList = (items) => items.map(x => `<li>${esc(x)}</li>`).join("");
//   const methods = learningMethods.map(x => `<article class="method-card"><b>${esc(x.method)}</b><p>${esc(x.how)}</p>${x.when ? `<small>${esc(x.when)}</small>` : ""}</article>`).join("");
//   const revision = revisionPlan.map(x => `<article class="revision-day"><span>${esc(x.day)}</span><div><b>${esc(x.focus)}</b><p>${esc(x.action)}</p></div></article>`).join("");
//   const formulaRows = formulas.map(x => `<div class="formula-row"><b>${esc(x.name)}</b><code>${esc(x.formula)}</code>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>`).join("");
//   const cheatRows = cheatSheet.map(x => `<div class="cheat-row"><b>${esc(x.label)}</b><span>${esc(x.value)}</span></div>`).join("");
//   const exampleRows = examples.map(x => `<article class="example-card"><b>${esc(x.concept)}</b><p>${esc(x.example)}</p></article>`).join("");
//   const practiceRows = practiceQuestions.map((x,i) => `<article class="practice-card"><span>${i+1}</span><div><b>${esc(x.question)}</b><p>${esc(x.answer)}</p></div></article>`).join("");
//   const quizPreview = quiz.slice(0, 10).map((item, i) => `<article class="generated-card quiz-preview"><span>${i + 1}</span><div><b>${esc(item.question || "Question")}</b><small>${(item.options || []).map((x, n) => `${String.fromCharCode(65+n)}. ${esc(x)}`).join(" · ")}</small></div></article>`).join("");
//   const cardPreview = flashcards.slice(0, 12).map((item, i) => `<article class="generated-card"><span>${i + 1}</span><div><b>${esc(item.question || item.front || "Question")}</b><p>${esc(item.answer || item.back || "")}</p><small>${esc(item.difficulty || "medium")} · active recall</small></div></article>`).join("");
//   const completion = Math.min(100, Math.round(([summary, keywords.length, flashcards.length >= 6, quiz.length >= 4, mindmap.subTopics?.length, memoryTricks.length, cheatSheet.length, formulas.length, commonMistakes.length, examTips.length, learningMethods.length, revisionPlan.length, examples.length].filter(Boolean).length / 13) * 100));
//   const adaptive = data.adaptive || null;
//   const adaptiveBanner = adaptive ? `<section class="adaptive-pack-banner"><div><span class="eyebrow">ADAPTIVE NEXT STEP</span><h3>${esc(adaptive.focusTopic || "Next topic")}</h3><p>${esc(adaptive.reason || adaptive.nextAction || "Your next pack is selected from your learning data.")}</p></div><button id="packAdaptiveNext" class="primary">Continue with adaptive learning →</button></section>` : "";
//   $("#analysisOutput").innerHTML = `
//     <div class="pack-result-head"><div><span class="eyebrow">BEST STUDY PACK · ${completion}% READY</span><h2>${esc(result.title || "Your study pack")}</h2><p>${data.saved?.savedCards || 0} flashcards saved · ${data.saved?.savedQuiz ? "practice quiz saved" : "quiz not saved"}</p></div><div class="pack-actions"><button id="openPackCards" class="secondary">Review flashcards</button><button id="openPackQuiz" class="primary" ${data.saved?.savedQuiz ? "" : "disabled"}>Take quiz</button></div></div>
//     <div class="pack-progress"><span style="width:${completion}%"></span></div>
//     <div class="learning-loop compact-loop" aria-label="Study pack flow"><span class="active">LEARN</span><i>→</i><span>PRACTICE</span><i>→</i><span>REVISE</span><i>→</i><span>ADAPT</span></div>
//     ${adaptiveBanner}
//     <div class="result-grid">
//       ${summary ? `<section class="result-block featured"><div class="result-label">1 · CORE SUMMARY</div><div class="pack-summary">${renderMarkdown(summary)}</div></section>` : ""}
//       ${keywords.length ? `<section class="result-block"><div class="result-label">2 · KEY CONCEPTS</div><div class="chips">${keywords.slice(0, 15).map(item => `<span class="pill">${esc(item)}</span>`).join("")}</div></section>` : ""}
//       ${mindmap.subTopics?.length ? `<section class="result-block full"><div class="result-label">3 · CONCEPT MAP</div><h3>${esc(mindmap.mainTopic || "Main topic")}</h3><div class="topic-map">${mindmap.subTopics.map(x => `<span>${esc(x)}</span>`).join("")}</div></section>` : ""}
//       ${cheatRows ? `<section class="result-block"><div class="result-label">4 · QUICK CHEAT SHEET</div><div class="cheat-sheet">${cheatRows}</div></section>` : ""}
//       ${formulas ? `<section class="result-block"><div class="result-label">5 · FORMULAS / RULES</div><div class="formula-sheet">${formulaRows || '<p class="muted">No formulas or rules were supported by this material.</p>'}</div></section>` : ""}
//       ${memoryTricks.length ? `<section class="result-block full memory-block"><div class="result-label">6 · MEMORY TRICKS & SHORTCUTS</div><p class="muted">These are learning aids generated from the material, not extra source facts.</p><div class="trick-grid">${memoryTricks.map((x,i) => `<article class="trick-card"><span>${i+1}</span><p>${esc(x)}</p></article>`).join("")}</div></section>` : ""}
//       ${commonMistakes.length ? `<section class="result-block"><div class="result-label">7 · COMMON MISTAKES</div><ul class="study-list warning-list">${escList(commonMistakes)}</ul></section>` : ""}
//       ${examTips.length ? `<section class="result-block"><div class="result-label">8 · EXAM / INTERVIEW TIPS</div><ul class="study-list">${escList(examTips)}</ul></section>` : ""}
//       ${methods ? `<section class="result-block full"><div class="result-label">9 · HOW TO LEARN THIS</div><div class="method-grid">${methods}</div></section>` : ""}
//       ${exampleRows ? `<section class="result-block full"><div class="result-label">10 · CONCRETE EXAMPLES</div><div class="example-grid">${exampleRows}</div></section>` : ""}
//       <section class="result-block full"><div class="result-label">11 · ACTIVE-RECALL FLASHCARDS · ${flashcards.length}</div>${cardPreview || '<p class="muted">No flashcards were returned.</p>'}</section>
//       <section class="result-block full"><div class="result-label">12 · PRACTICE QUIZ · ${quiz.length}</div>${quizPreview || '<p class="muted">No quiz questions were returned.</p>'}</section>
//       ${practiceRows ? `<section class="result-block full"><div class="result-label">13 · SHORT-ANSWER CHECKS</div><div class="practice-grid">${practiceRows}</div></section>` : ""}
//       ${revision ? `<section class="result-block full"><div class="result-label">14 · 7-DAY REVISION ROUTE</div><div class="revision-grid">${revision}</div></section>` : ""}
//     </div>`;
//   $("#openPackCards").onclick = () => { go("flashcards"); loadFlashcards(); };
//   $("#openPackQuiz").onclick = async () => { go("quizzes"); await loadQuizzes(); };
//   if ($("#packAdaptiveNext")) $("#packAdaptiveNext").onclick = generateAdaptiveNextPack;
// }
// const tutorModeCopy = {
//   normal: ["Normal tutor", "Clear explanations, examples and practical next steps."],
//   beginner: ["Beginner tutor", "Simple language, small steps and no assumed background."],
//   socratic: ["Socratic tutor", "Guiding questions first, with the answer revealed after reasoning."],
//   exam: ["Exam tutor", "Definitions, scoring points, common traps and exam-style thinking."],
//   interview: ["Interview tutor", "Practice concise answers, follow-up questions and reasoning."],
//   revision: ["Revision tutor", "Active recall, compact notes and quick checks for memory."]
// };
// function setTutorMode(mode) {
//   currentTutorMode = mode;
//   $$("[data-tutor-mode]").forEach(button => button.classList.toggle("active", button.dataset.tutorMode === mode));
//   const copy = tutorModeCopy[mode] || tutorModeCopy.normal;
//   if ($("#tutorHeading")) $("#tutorHeading").textContent = copy[0];
//   if ($("#tutorModeDescription")) $("#tutorModeDescription").textContent = copy[1];
// }

// async function loadFlashcards() {
//   const workspace = $("#flashcardWorkspace");
//   if (!workspace) return;
//   workspace.innerHTML = '<div class="loading-card">Loading your review queue…</div>';
//   try {
//     const endpoint = flashcardFilter === "due" ? "/api/flashcards/due" : "/api/flashcards?limit=100";
//     const data = await api(endpoint);
//     flashcardsCache = data.data || [];
//     renderFlashcardWorkspace();
//     loadFlashcardAnalytics();
//   } catch (error) { workspace.innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
// }

// function renderFlashcardWorkspace() {
//   const workspace = $("#flashcardWorkspace");
//   const cards = flashcardsCache;
//   const due = cards.filter(c => new Date(c.nextReviewAt) <= new Date()).length;
//   $("#flashcardProgress").textContent = `${cards.length} ${flashcardFilter === "due" ? "due" : "active"} cards · ${due} ready now`;
//   if (!cards.length) { workspace.innerHTML = '<div class="empty-state large-empty"><h3>No cards in this queue</h3><p>Generate a study pack first, then come back here for spaced repetition.</p><button class="primary" id="emptyCardsGo">Create study pack</button></div>'; $("#emptyCardsGo").onclick = () => go("packs"); return; }
//   const card = cards[0];
//   workspace.innerHTML = `<article class="flashcard" id="activeFlashcard"><div class="flashcard-meta"><span>${esc(card.topic || "General")}</span><span>${esc(card.knowledgeStatus || "unknown")}</span></div><button class="flashcard-face" id="flashcardReveal" aria-expanded="false"><span class="flashcard-label">QUESTION</span><strong>${esc(card.question)}</strong><small>Click to reveal the answer</small></button><div id="flashcardAnswer" class="flashcard-answer hidden"><span class="flashcard-label">ANSWER</span><p>${esc(card.answer)}</p></div><div class="review-actions"><button class="review-btn again" data-rating="Again">Again<small>Reset</small></button><button class="review-btn" data-rating="Hard">Hard<small>Short interval</small></button><button class="review-btn" data-rating="Good">Good<small>Keep pace</small></button><button class="review-btn easy" data-rating="Easy">Easy<small>Long interval</small></button></div><div class="knowledge-actions"><button class="secondary" id="markKnown">✓ I know this</button><button class="secondary" id="markUnknown">↺ Need more practice</button></div></article>`;
//   $("#flashcardReveal").onclick = () => { $("#flashcardAnswer").classList.toggle("hidden"); $("#flashcardReveal").setAttribute("aria-expanded", String(!$("#flashcardAnswer").classList.contains("hidden"))); };
//   $$(".review-btn").forEach(button => button.onclick = () => reviewFlashcard(card._id, button.dataset.rating));
//   $("#markKnown").onclick = () => setCardKnowledge(card._id, "known");
//   $("#markUnknown").onclick = () => setCardKnowledge(card._id, "unknown");
// }
// async function loadFlashcardAnalytics() {
//   const chart = $("#flashcardAnalytics");
//   if (!chart) return;
//   try {
//     const data = await api("/api/analytics/flashcards");
//     const d = data.data || {};
//     const total = Math.max(1, Number(d.total || 0));
//     const rows = [
//       ["Known", Number(d.known || 0)],
//       ["Due", Number(d.due || 0)],
//       ["Reviewed", Number(d.reviewed || 0)],
//       ["Learning", Math.max(0, Number(d.total || 0) - Number(d.known || 0))]
//     ];
//     const max = Math.max(1, ...rows.map(x => x[1]));
//     chart.innerHTML = `<div class="mastery-chart">${rows.map(([label,value]) => `<div class="chart-row"><span>${label}</span><div class="chart-track"><i style="width:${Math.round(value/max*100)}%"></i></div><b>${value}</b></div>`).join("")}</div><div class="rating-strip">${Object.entries(d.byRating || {}).map(([label,value]) => `<span><b>${esc(label)}</b> ${Number(value)||0}</span>`).join("")}</div><p class="muted">${Number(d.due||0)} cards are ready now. Review honestly to improve the next interval.</p>`;
//   } catch { chart.innerHTML = '<p class="muted">Learning analytics will appear after your first reviews.</p>'; }
// }

// async function reviewFlashcard(id, rating) { try { await api(`/api/flashcards/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ rating }) }); flashcardsCache = flashcardsCache.slice(1); renderFlashcardWorkspace(); toast(`Rated ${rating}. Next card ready.`, "success"); } catch (error) { toast(friendlyError(error), "error"); } }
// async function setCardKnowledge(id, knowledgeStatus) { try { await api(`/api/flashcards/${encodeURIComponent(id)}/knowledge`, { method: "POST", body: JSON.stringify({ knowledgeStatus }) }); flashcardsCache = flashcardsCache.slice(1); renderFlashcardWorkspace(); toast(knowledgeStatus === "known" ? "Marked as known." : "Marked for more practice.", "success"); } catch (error) { toast(friendlyError(error), "error"); } }

// async function loadQuizzes() {
//   const library = $("#quizLibrary");
//   if (!library) return;
//   library.innerHTML = '<div class="loading-card">Loading your quizzes…</div>';
//   try {
//     const data = await api("/api/quizzes");
//     const quizzes = data.data || [];
//     loadQuizAnalytics();
//     library.innerHTML = quizzes.length ? quizzes.map(q => `<article class="quiz-library-card"><div><span class="eyebrow">${q.questions?.length || 0} QUESTIONS</span><h3>${esc(q.title || "Study Quiz")}</h3><p>${esc(q.topic || "General")}</p><small>${new Date(q.createdAt).toLocaleDateString()}</small></div><button class="primary take-quiz" data-id="${esc(q._id)}">Take quiz</button></article>`).join("") : '<div class="empty-state large-empty"><h3>Your quiz library is empty</h3><p>Generate a study pack to create a quiz from your own material.</p><button class="primary" id="emptyQuizGo">Create study pack</button></div>';
//     $$(".take-quiz").forEach(button => button.onclick = () => startQuiz(button.dataset.id));
//     if ($("#emptyQuizGo")) $("#emptyQuizGo").onclick = () => go("packs");
//   } catch (error) { library.innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
// }
// async function loadQuizAnalytics() {
//   const target = $("#quizAnalytics");
//   if (!target) return;
//   try {
//     const data = await api("/api/analytics/quiz-performance");
//     const rows = (data.data || []).slice(-8);
//     if (!rows.length) { target.innerHTML = '<p class="muted">Take your first quiz to build a performance trend.</p>'; return; }
//     const max = 100;
//     target.innerHTML = `<div class="quiz-trend">${rows.map((x,i) => { const score=Math.max(0,Math.min(100,Number(x.percentage||0))); return `<div class="quiz-bar-wrap"><span>${score}%</span><div class="quiz-bar"><i style="height:${score}%"></i></div><small>Q${i+1}</small></div>`; }).join("")}</div><div class="insight-line"><b>${Math.round(rows.reduce((a,x)=>a+Number(x.percentage||0),0)/rows.length)}%</b> average across your latest ${rows.length} attempts <span>·</span> ${rows[rows.length-1].percentage ?? 0}% most recent</div>`;
//   } catch { target.innerHTML = '<p class="muted">Quiz analytics are temporarily unavailable.</p>'; }
// }

// async function startQuiz(id) {
//   try { const data = await api(`/api/quizzes/${encodeURIComponent(id)}`); currentQuiz = data.data; currentQuizIndex = 0; currentQuizAnswers = {}; $("#quizLibrary").classList.add("hidden"); $("#quizRunner").classList.remove("hidden"); renderQuizQuestion(); } catch (error) { toast(friendlyError(error), "error"); }
// }
// function renderQuizQuestion() {
//   const runner = $("#quizRunner"); const questions = currentQuiz?.questions || []; const q = questions[currentQuizIndex];
//   if (!q) return;
//   const selected = currentQuizAnswers[String(q._id)] || "";
//   runner.innerHTML = `<div class="quiz-runner-card"><div class="quiz-runner-top"><div><span class="eyebrow">QUESTION ${currentQuizIndex + 1} OF ${questions.length}</span><h2>${esc(currentQuiz.title || "Study Quiz")}</h2></div><span class="quiz-counter">${currentQuizIndex + 1}/${questions.length}</span></div><div class="quiz-question"><h3>${esc(q.question)}</h3><div class="quiz-options">${q.options.map((option, i) => `<button class="quiz-option ${selected === option ? "selected" : ""}" data-option="${esc(option)}"><span>${String.fromCharCode(65+i)}</span>${esc(option)}</button>`).join("")}</div></div><div class="quiz-runner-actions"><button id="exitQuiz" class="secondary">Back to quizzes</button><div><button id="prevQuiz" class="secondary" ${currentQuizIndex === 0 ? "disabled" : ""}>← Previous</button>${currentQuizIndex < questions.length - 1 ? '<button id="nextQuiz" class="primary">Next →</button>' : '<button id="submitQuiz" class="primary">Submit quiz</button>'}</div></div></div>`;
//   $$(".quiz-option").forEach(btn => btn.onclick = () => { currentQuizAnswers[String(q._id)] = btn.dataset.option; renderQuizQuestion(); });
//   $("#prevQuiz").onclick = () => { currentQuizIndex--; renderQuizQuestion(); };
//   if ($("#nextQuiz")) $("#nextQuiz").onclick = () => { if (!currentQuizAnswers[String(q._id)]) return toast("Choose an answer first.", "error"); currentQuizIndex++; renderQuizQuestion(); };
//   if ($("#submitQuiz")) $("#submitQuiz").onclick = submitQuiz;
//   $("#exitQuiz").onclick = exitQuiz;
// }
// async function submitQuiz() {
//   const unanswered = (currentQuiz.questions || []).filter(q => !currentQuizAnswers[String(q._id)]).length;
//   if (unanswered) return toast(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered.`, "error");
//   try {
//     const answers = currentQuiz.questions.map(q => ({ questionId: q._id, selectedAnswer: currentQuizAnswers[String(q._id)] }));
//     const data = await api(`/api/quiz-attempts/${encodeURIComponent(currentQuiz._id)}`, { method: "POST", body: JSON.stringify({ answers }) });
//     const result = data.data;
//     $("#quizRunner").innerHTML = `<div class="quiz-result-card"><span class="eyebrow">QUIZ COMPLETE</span><div class="score-ring"><strong>${result.percentage}%</strong><span>${result.score}/${result.totalQuestions}</span></div><h2>${result.percentage >= 80 ? "Strong result" : result.percentage >= 60 ? "Good progress" : "Keep practising"}</h2><p>${result.percentage >= 80 ? "You have a solid grasp of this set. Review the missed questions once more." : "Use the feedback to decide what to revise next."}</p><div class="result-actions"><button id="reviewQuizAgain" class="primary">Try again</button><button id="backQuizLibrary" class="secondary">Back to quiz library</button><button id="goFlashcardsAfterQuiz" class="secondary">Review flashcards</button></div></div>`;
//     $("#reviewQuizAgain").onclick = () => { currentQuizIndex = 0; currentQuizAnswers = {}; renderQuizQuestion(); };
//     $("#backQuizLibrary").onclick = exitQuiz;
//     $("#goFlashcardsAfterQuiz").onclick = () => { exitQuiz(); go("flashcards"); loadFlashcards(); };
//     loadDashboardSummary();
//   } catch (error) { toast(friendlyError(error), "error"); }
// }
// function exitQuiz() { currentQuiz = null; $("#quizRunner").classList.add("hidden"); $("#quizLibrary").classList.remove("hidden"); loadQuizzes(); }

// async function connectGoogle(service) {
//   try {
//     const data = await api(`/api/google/auth?service=${encodeURIComponent(service)}`);
//     window.location.href = data.url;
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function loadMail() {
//   try {
//     const data = await api(`/api/gmail/messages?maxResults=12&q=${encodeURIComponent($("#emailSearch").value.trim())}`);
//     $("#emailList").innerHTML = data.messages?.length ? data.messages.map((message) => `
//       <article class="list-item"><b>${esc(message.subject)}</b><small>${esc(message.from)} · ${esc(message.date)}</small><p>${esc(message.snippet)}</p><details><summary>Read</summary><p>${esc(message.body)}</p></details></article>`).join("") : '<div class="empty-state">No messages found.</div>';
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function sendMail() {
//   const button = $("#sendMail");
//   setBusy(button, true, "Sending…");
//   try {
//     await api("/api/gmail/send", { method: "POST", body: JSON.stringify({
//       to: $("#mailTo").value.trim(), subject: $("#mailSubject").value.trim(), body: $("#mailBody").value.trim()
//     }) });
//     toast("Email sent successfully.", "success");
//     $("#mailBody").value = "";
//   } catch (error) { toast(friendlyError(error), "error"); }
//   finally { setBusy(button, false); }
// }

// async function loadEvents() {
//   try {
//     const data = await api("/api/calendar/events");
//     $("#eventList").innerHTML = data.events?.length ? data.events.map((event) => `
//       <article class="list-item"><b>${esc(event.title)}</b><small>${event.start ? new Date(event.start).toLocaleString() : ""}${event.end ? ` → ${new Date(event.end).toLocaleString()}` : ""}</small><p>${esc(event.description)}</p><button class="secondary" data-delete-event="${esc(event.id)}">Delete</button></article>`).join("") : '<div class="empty-state">No events found in the next 30 days.</div>';
//     $$('[data-delete-event]').forEach((button) => {
//       button.onclick = async () => {
//         try { await api(`/api/calendar/events/${encodeURIComponent(button.dataset.deleteEvent)}`, { method: "DELETE" }); await loadEvents(); }
//         catch (error) { toast(friendlyError(error), "error"); }
//       };
//     });
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function createEvent() {
//   const start = $("#eventStart").value;
//   const end = $("#eventEnd").value;
//   if (!$("#eventTitle").value.trim() || !start || !end) return toast("Title, start and end are required.", "error");
//   try {
//     await api("/api/calendar/events", { method: "POST", body: JSON.stringify({
//       title: $("#eventTitle").value.trim(), description: $("#eventDescription").value.trim(), location: $("#eventLocation").value.trim(), start, end
//     }) });
//     toast("Calendar event created.", "success");
//     ["#eventTitle", "#eventLocation", "#eventStart", "#eventEnd", "#eventDescription"].forEach((id) => $(id).value = "");
//     await loadEvents();
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// function safeExternalUrl(value) {
//   try { const url = new URL(String(value || ""), window.location.href); return ["http:", "https:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; }
// }

// async function research() {
//   const query = $("#researchQuery").value.trim();
//   if (!query) return toast("Enter a research topic.", "error");
//   const button = $("#researchBtn");
//   setBusy(button, true, "Researching…");
//   $("#researchAnswer").innerHTML = '<div class="loading-card">Searching current sources…</div>';
//   try {
//     const data = await api("/api/research", { method: "POST", body: JSON.stringify({ query }) });
//     $("#researchAnswer").textContent = data.answer || "No answer was returned.";
//     $("#researchSources").innerHTML = data.sources?.length ? `<h3>Sources</h3>${data.sources.map((source) => `<a class="source" target="_blank" rel="noopener noreferrer" href="${esc(safeExternalUrl(source.url))}">${esc(source.title || source.url)}</a>`).join("")}` : '<p class="muted">No source metadata was returned.</p>';
//   } catch (error) {
//     $("#researchAnswer").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`;
//   } finally { setBusy(button, false); }
// }

// async function createRoom() {
//   try {
//     const data = await api("/api/rooms", { method: "POST", body: "{}" });
//     $("#roomCode").value = data.roomId;
//     if ($("#roomInviteToken")) $("#roomInviteToken").value = data.inviteToken || "";
//     lastRoomInviteToken = data.inviteToken || "";
//     lastRoomId = data.roomId;
//     joinRoom(data.roomId, lastRoomInviteToken);
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// function renderMembers(members = []) {
//   $("#members").innerHTML = members.map((member) => `<span class="member-chip">${esc(member.name)}</span>`).join("");
// }

// function addRoomChat(message) {
//   const element = document.createElement("div");
//   element.className = "msg";
//   element.innerHTML = `<b>${esc(message.name)}</b><br>${esc(message.text)}`;
//   $("#roomChat").appendChild(element);
//   $("#roomChat").scrollTop = $("#roomChat").scrollHeight;
// }

// function renderRoom(room) {
//   renderMembers(room.members || []);
//   $("#roomChat").innerHTML = "";
//   (room.messages || []).forEach(addRoomChat);
//   $("#sharedNotes").value = room.notes || "";
//   renderRoomShared(room);
// }

// async function joinRoom(code, inviteToken = "") {
//   const normalized = String(code || "").trim().toUpperCase();
//   lastRoomId = normalized;
//   const name = $("#roomName").value.trim() || currentUser?.name || "Student";
//   if (!normalized) return toast("Enter a room code.", "error");
//   const suppliedInvite = String(inviteToken || $("#roomInviteToken")?.value || "").trim();
//   try { await api(`/api/rooms/${encodeURIComponent(normalized)}/join`, { method: "POST", body: JSON.stringify({ inviteToken: suppliedInvite }) }); }
//   catch (error) { return toast(friendlyError(error), "error"); }
//   if (roomSocket) try { roomSocket.close(); } catch {}
//   const protocol = location.protocol === "https:" ? "wss" : "ws";
//   roomSocket = new WebSocket(`${protocol}://${location.host}/ws?room=${encodeURIComponent(normalized)}&name=${encodeURIComponent(name)}`);
//   $("#roomStatus").textContent = `Connecting to ${normalized}…`;
//   roomSocket.onopen = () => { roomSocket.send(JSON.stringify({ type: "auth", token: token() })); $("#roomStatus").textContent = `Authenticating ${normalized}…`; };
//   roomSocket.onmessage = (event) => {
//     try {
//       const message = JSON.parse(event.data);
//       if (message.type === "snapshot") renderRoom(message.room);
//       if (message.type === "members") renderMembers(message.members);
//       if (message.type === "chat") addRoomChat(message.message);
//       if (message.type === "notes") $("#sharedNotes").value = message.notes;
//       if (message.type === "documents" || message.type === "quizzes") renderRoomShared({ documents: message.documents || [], quizzes: message.quizzes || [] });
//     } catch { toast("Received an invalid room message.", "error"); }
//   };
//   roomSocket.onerror = () => { $("#roomStatus").textContent = "Connection error"; };
//   roomSocket.onclose = () => { $("#roomStatus").textContent = "Room disconnected"; };
// }

// function sendRoomMessage() {
//   const text = $("#roomMessage").value.trim();
//   if (!text) return;
//   if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return toast("Join a study room first.", "error");
//   roomSocket.send(JSON.stringify({ type: "chat", text }));
//   $("#roomMessage").value = "";
// }

// function sendSharedNotes() {
//   if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
//   roomSocket.send(JSON.stringify({ type: "notes", notes: $("#sharedNotes").value }));
// }

// function speakText(text) {
//   if (!text) return toast("There is no AI answer to speak yet.", "error");
//   if (!("speechSynthesis" in window)) return toast("Text-to-speech is not supported in this browser.", "error");
//   speechSynthesis.cancel();
//   const utterance = new SpeechSynthesisUtterance(String(text));
//   utterance.lang = "en-US";
//   utterance.rate = 1;
//   utterance.onstart = () => $("#voiceState").textContent = "Speaking…";
//   utterance.onend = () => $("#voiceState").textContent = "Ready";
//   utterance.onerror = () => { $("#voiceState").textContent = "Ready"; toast("Speech output failed.", "error"); };
//   speechSynthesis.speak(utterance);
// }


// async function searchVoiceWeb(query) {
//   const text = String(query || "").trim();

//   if (!text) {
//     return;
//   }

//   console.log("[VOICE SEARCH] Query:", text);

//   const googleUrl =
//     `https://www.google.com/search?q=${encodeURIComponent(text)}`;

//   const wikiSearchUrl =
//     `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(text)}`;

//   addChat(text, "user");

//   const searchUrl =
//     `https://en.wikipedia.org/w/api.php` +
//     `?action=query` +
//     `&list=search` +
//     `&srsearch=${encodeURIComponent(text)}` +
//     `&format=json` +
//     `&origin=*` +
//     `&utf8=1` +
//     `&srlimit=5`;

//   const response = await fetch(searchUrl, {
//     method: "GET",
//     headers: {
//       Accept: "application/json"
//     }
//   });

//   if (!response.ok) {
//     throw new Error(`Wikipedia search failed (${response.status})`);
//   }

//   const data = await response.json();

//   const results = Array.isArray(data?.query?.search)
//     ? data.query.search
//     : [];

//   console.log("[VOICE SEARCH] Wikipedia results:", results);

//   if (!results.length) {
//     addChat(
//       [
//         "## I couldn't find a matching result",
//         "",
//         `I couldn't find a useful Wikipedia article for **${text}**.`,
//         "",
//         "You can continue the search here:",
//         `- [Search Google for "${text}"](${googleUrl})`,
//         `- [Search Wikipedia for "${text}"](${wikiSearchUrl})`
//       ].join("\n"),
//       "ai"
//     );
//     return;
//   }

//   /*
//    * Fetch summaries for the best few results. This makes voice search
//    * return an actual useful answer instead of only returning a title.
//    */
//   const articles = [];

//   for (const result of results.slice(0, 3)) {
//     const title = String(result?.title || "").trim();

//     if (!title) continue;

//     const pageName = title.replace(/ /g, "_");

//     const pageUrl =
//       `https://en.wikipedia.org/wiki/${encodeURIComponent(pageName)}`;

//     let summary = "";

//     try {
//       const summaryResponse = await fetch(
//         `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`,
//         {
//           headers: {
//             Accept: "application/json"
//           }
//         }
//       );

//       if (summaryResponse.ok) {
//         const summaryData = await summaryResponse.json();
//         summary = String(summaryData?.extract || "").trim();
//       }
//     } catch (error) {
//       console.warn(
//         "[VOICE SEARCH] Could not load summary:",
//         title,
//         error
//       );
//     }

//     if (!summary) {
//       summary = String(result?.snippet || "")
//         .replace(/<[^>]*>/g, "")
//         .trim();
//     }

//     articles.push({
//       title,
//       summary,
//       url: pageUrl
//     });
//   }

//   const primary = articles[0];

//   const related = articles
//     .slice(1)
//     .map(
//       (article) =>
//         `- [${article.title}](${article.url})${article.summary ? ` — ${article.summary}` : ""}`
//     )
//     .join("\n");

//   const answer = [
//     `## ${primary?.title || text}`,
//     "",
//     primary?.summary ||
//       "I found a relevant Wikipedia result, but a summary was not available.",
//     "",
//     primary?.url
//       ? `**Source:** [Wikipedia — ${primary.title}](${primary.url})`
//       : "",
//     "",
//     related ? "### Related results\n" + related : "",
//     "",
//     "### Search online",
//     `- [Search Google for "${text}"](${googleUrl})`,
//     `- [Search Wikipedia for "${text}"](${wikiSearchUrl})`
//   ]
//     .filter(Boolean)
//     .join("\n");

//   const voiceAnswer = ensureVoiceAnswerContainer();
//   if (voiceAnswer) voiceAnswer.innerHTML = renderMarkdown(answer);

//   addChat(answer, "ai", {
//     sources: primary?.url
//       ? [
//           {
//             title: "Wikipedia",
//             url: primary.url
//           }
//         ]
//       : []
//   });

//   console.log("[VOICE SEARCH] Answer added");
// }

// function ensureVoiceAnswerContainer() {
//   let element = $("#voiceAnswer");
//   if (element) return element;
//   const transcript = $("#voiceTranscript");
//   if (!transcript) return null;
//   element = document.createElement("div");
//   element.id = "voiceAnswer";
//   element.className = "rich voice-answer";
//   transcript.parentElement.appendChild(element);
//   return element;
// }

// function startRecognition() {
//   const SpeechRecognition =
//     window.SpeechRecognition ||
//     window.webkitSpeechRecognition;

//   if (!SpeechRecognition) {
//     toast(
//       "Voice recognition is not supported in this browser. Please use the latest Chrome or Edge.",
//       "error"
//     );
//     return;
//   }

//   /*
//    * Do not start another recognition instance while one is already active.
//    */
//   if (recognition) {
//     console.log("[VOICE] Already running");
//     return;
//   }

//   const speech = new SpeechRecognition();

//   recognition = speech;

//   /*
//    * en-IN works well for Indian English. The recognition service can
//    * occasionally fail to return a result, so we retry once with en-US.
//    */
//   let languageAttempt = 0;
//   let finalTranscript = "";
//   let interimTranscript = "";
//   let finished = false;
//   let hadError = false;

//   const languages = ["en-IN", "en-US"];

//   const setVoiceState = (state, transcript = "") => {
//     const stateElement = $("#voiceState");
//     const transcriptElement = $("#voiceTranscript");

//     if (stateElement) {
//       stateElement.textContent = state;
//     }

//     if (transcriptElement && transcript) {
//       transcriptElement.textContent = transcript;
//     }
//   };

//   const clearRecognition = () => {
//     if (recognition === speech) {
//       recognition = null;
//     }
//   };

//   speech.lang = languages[languageAttempt];
//   speech.continuous = false;
//   speech.interimResults = true;
//   speech.maxAlternatives = 3;

//   console.log(
//     "[VOICE] Starting recognition with language:",
//     speech.lang
//   );

//   speech.onstart = () => {
//     console.log("[VOICE] STARTED");
//     setVoiceState("Listening…", "Speak now…");
//     toast("Listening… speak now.", "info");
//   };

//   speech.onaudiostart = () => {
//     console.log("[VOICE] AUDIO START");
//   };

//   speech.onsoundstart = () => {
//     console.log("[VOICE] SOUND START");
//   };

//   speech.onspeechstart = () => {
//     console.log("[VOICE] SPEECH START");
//     setVoiceState(
//       "Hearing you…",
//       finalTranscript || interimTranscript || "Listening…"
//     );
//   };

//   speech.onresult = (event) => {
//     let newFinal = "";
//     let newInterim = "";

//     for (let i = event.resultIndex; i < event.results.length; i++) {
//       const result = event.results[i];

//       if (!result || !result[0]) continue;

//       const transcript = String(
//         result[0].transcript || ""
//       ).trim();

//       if (!transcript) continue;

//       if (result.isFinal) {
//         newFinal += transcript + " ";
//       } else {
//         newInterim += transcript + " ";
//       }
//     }

//     newFinal = newFinal.trim();
//     newInterim = newInterim.trim();

//     if (newFinal) {
//       finalTranscript = `${finalTranscript} ${newFinal}`.trim();
//     }

//     interimTranscript = newInterim;

//     const currentText =
//       `${finalTranscript} ${interimTranscript}`.trim();

//     console.log("[VOICE] RESULT:", currentText);

//     if (currentText) {
//       setVoiceState("Got it…", currentText);
//     }
//   };

//   speech.onerror = (event) => {
//     hadError = true;

//     console.error(
//       "[VOICE] ERROR:",
//       event.error,
//       event.message || ""
//     );

//     const errorMessages = {
//       "not-allowed":
//         "Microphone permission was denied. Allow microphone access for this website and try again.",

//       "audio-capture":
//         "No microphone could be accessed. Check your Windows microphone settings.",

//       "network":
//         "The browser speech service could not be reached. Check your internet connection and try again.",

//       "service-not-allowed":
//         "The browser speech-recognition service is unavailable.",

//       "no-speech":
//         "I didn't hear anything. Please speak after the microphone starts."
//     };

//     /*
//      * Do not immediately show an error for a normal aborted event.
//      */
//     if (event.error !== "aborted") {
//       toast(
//         errorMessages[event.error] ||
//           `Voice recognition error: ${event.error}`,
//         "error"
//       );
//     }
//   };

//   speech.onspeechend = () => {
//     console.log("[VOICE] SPEECH END");
//   };

//   speech.onend = () => {
//     console.log("[VOICE] END");

//     const query =
//       `${finalTranscript} ${interimTranscript}`.trim();

//     /*
//      * If the browser returned no transcript, retry once using en-US.
//      * This handles Chrome speech-service cases where en-IN starts but
//      * closes without producing a result.
//      */
//     if (
//       !query &&
//       languageAttempt < languages.length - 1 &&
//       !finished
//     ) {
//       console.warn(
//         "[VOICE] No transcript. Retrying with:",
//         languages[languageAttempt + 1]
//       );

//       languageAttempt++;

//       /*
//        * Reuse the same SpeechRecognition instance for one retry.
//        * This avoids losing the event handlers or leaving a stale
//        * recognition object behind.
//        */
//       setTimeout(() => {
//         if (finished || recognition !== speech) return;

//         finalTranscript = "";
//         interimTranscript = "";
//         hadError = false;

//         speech.lang = languages[languageAttempt];

//         console.log(
//           "[VOICE] RETRY START:",
//           speech.lang
//         );

//         try {
//           speech.start();
//         } catch (error) {
//           console.error(
//             "[VOICE] RETRY FAILED:",
//             error
//           );

//           clearRecognition();
//           setVoiceState("Ready");
//           toast(
//             error.message || "Could not restart voice recognition.",
//             "error"
//           );
//         }
//       }, 250);

//       return;
//     }

//     clearRecognition();

//     if (finished) return;

//     finished = true;

//     if (!query) {
//       setVoiceState(
//         "Ready",
//         "Press the microphone and speak."
//       );

//       if (!hadError) {
//         toast(
//           "No speech was detected. Please try again.",
//           "error"
//         );
//       }

//       return;
//     }

//     console.log(
//       "[VOICE] FINAL QUERY:",
//       query
//     );

//     setVoiceState("Searching…", query);

//     /*
//      * IMPORTANT:
//      * Voice search does NOT call sendChat().
//      * Therefore it does not use the Gemini/AI quota.
//      */
//     searchVoiceWeb(query)
//       .then(() => {
//         setVoiceState("Ready", query);
//         console.log("[VOICE] Search completed");
//       })
//       .catch((error) => {
//         console.error(
//           "[VOICE] Search failed:",
//           error
//         );

//         setVoiceState("Ready", query);

//         toast(
//           "I understood your voice, but the online search failed.",
//           "error"
//         );
//       });
//   };

//   try {
//     speech.start();
//   } catch (error) {
//     console.error(
//       "[VOICE] START FAILED:",
//       error
//     );

//     clearRecognition();

//     setVoiceState("Ready");

//     toast(
//       error.message || "Could not start microphone.",
//       "error"
//     );
//   }
// }

// async function searchVideos() {
//   const query = $("#videoSearchQuery")?.value.trim() || $("#videoQuery").value.trim();
//   if (!query) return toast("Enter a topic.", "error");
//   const button = $("#videoBtn");
//   setBusy(button, true, "Finding…");
//   $("#videoList").innerHTML = '<div class="loading-card">Finding educational videos…</div>';
//   try {
//     const data = await api(`/api/videos?q=${encodeURIComponent(query)}`);
//     const videos = data.videos || [];
//     if (!videos.length) {
//       const url = data.searchUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " educational")}`;
//       $("#videoList").innerHTML = `<article class="video video-fallback"><div class="video-body"><span class="eyebrow">YOUTUBE SEARCH</span><h3>Educational videos for “${esc(query)}”</h3><p>${esc(data.note || "Open YouTube to continue your search.")}</p><a class="primary" target="_blank" rel="noopener noreferrer" href="${esc(url)}">Open YouTube results →</a></div></article>`;
//       return;
//     }
//     $("#videoList").innerHTML = videos.map((video) => {
//       const match = String(video.url || "").match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
//       const media = match
//         ? `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(match[1])}" title="${esc(video.title || "Educational video")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
//         : video.thumbnail ? `<img src="${esc(video.thumbnail)}" alt="${esc(video.title || "Educational video")}" loading="lazy">` : '<div class="video-placeholder">Educational video</div>';
//       return `<article class="video">${media}<div class="video-body"><b>${esc(video.title || "Educational video")}</b><small>${esc(video.channel || "Educational source")}</small><p>${esc(video.description || "")}</p><a class="secondary" target="_blank" rel="noopener noreferrer" href="${esc(video.url || "#")}">Open video →</a></div></article>`;
//     }).join("");
//   } catch (error) {
//     $("#videoList").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`;
//   } finally { setBusy(button, false); }
// }

// async function solveCode() {
//   const button = $("#solveCode");
//   const problem = $("#codeProblem").value.trim();
//   const code = $("#codeInput").value.trim();
//   if (!problem && !code) return toast("Enter a problem or paste code.", "error");
//   setBusy(button, true, "Analyzing…");
//   try {
//     const data = await api("/api/coding/solve", { method: "POST", body: JSON.stringify({ language: $("#codeLanguage").value, problem, code }) });
//     const result = data.result || {};
//     $("#codeOutput").innerHTML = `<h3>Explanation</h3><p>${esc(result.explanation || "")}</p><h3>Approach</h3>${(result.approach || []).map((item) => `<div>• ${esc(item)}</div>`).join("")}<h3>Solution</h3><pre>${esc(result.solution || "")}</pre><h3>Complexity</h3><p>${esc(result.complexity || "")}</p>${(result.testCases || []).length ? `<h3>Suggested tests</h3>${result.testCases.map((item) => `<div>• ${esc(typeof item === "string" ? item : JSON.stringify(item))}</div>`).join("")}` : ""}`;
//   } catch (error) { $("#codeOutput").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
//   finally { setBusy(button, false); }
// }

// async function newInterviewQuestion() {
//   const button = $("#newQuestion");
//   if (!button) return;
//   setBusy(button, true, "Generating 5 questions…");
//   const role = $("#interviewRole")?.value.trim() || "Software Engineer";
//   const level = $("#interviewLevel")?.value || "entry";
//   const topic = $("#interviewTopic")?.value.trim() || "general";
//   try {
//     const data = await api("/api/interview/question", {
//       method: "POST",
//       body: JSON.stringify({ role, level, topic })
//     });
//     let questions = Array.isArray(data?.result?.questions) ? data.result.questions : [];
//     if (!questions.length && data?.result?.question) questions = [data.result];
//     questions = questions.filter(item => item && String(item.question || "").trim()).slice(0, 5).map((item, index) => ({
//       question: String(item.question || "").trim(),
//       type: String(item.type || "Interview question").trim(),
//       evaluationCriteria: Array.isArray(item.evaluationCriteria) ? item.evaluationCriteria : [],
//       modelAnswer: String(item.modelAnswer || "").trim(),
//       followUps: Array.isArray(item.followUps) ? item.followUps : [],
//       number: index + 1
//     }));
//     if (questions.length < 5) throw new Error(`The interview service returned ${questions.length} questions instead of 5. Please try again.`);
//     interviewQuestions = questions;
//     currentInterviewIndex = 0;
//     currentInterview = questions[0];
//     if ($("#interviewAnswer")) $("#interviewAnswer").value = "";
//     if ($("#interviewFeedback")) $("#interviewFeedback").innerHTML = "";
//     const output = $("#interviewQuestion");
//     if (!output) return;
//     output.innerHTML = `<div class="interview-question-list">${questions.map((item, index) => `
//       <article class="card interview-question-card ${index === 0 ? "active" : ""}" data-interview-index="${index}">
//         <div class="card-title-row"><div><span class="eyebrow">QUESTION ${index + 1} OF 5</span><h3>${esc(item.type)}</h3></div>
//         <button type="button" class="secondary interview-select" data-interview-index="${index}">${index === 0 ? "Selected" : "Answer this"}</button></div>
//         <p>${esc(item.question)}</p>
//         ${item.evaluationCriteria.length ? `<details><summary>Evaluation criteria</summary>${item.evaluationCriteria.map(x => `<div>• ${esc(x)}</div>`).join("")}</details>` : ""}
//       </article>`).join("")}</div>`;
//     $$(".interview-select").forEach(button => { button.onclick = () => selectInterviewQuestion(Number(button.dataset.interviewIndex)); });
//     toast("5 interview questions generated.", "success");
//   } catch (error) {
//     interviewQuestions = [];
//     currentInterview = null;
//     const output = $("#interviewQuestion");
//     if (output) output.innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`;
//   } finally {
//     setBusy(button, false);
//   }
// }

// function selectInterviewQuestion(index) {
//   if (!interviewQuestions[index]) return;
//   currentInterviewIndex = index;
//   currentInterview = interviewQuestions[index];
//   if ($("#interviewAnswer")) $("#interviewAnswer").value = "";
//   if ($("#interviewFeedback")) $("#interviewFeedback").innerHTML = "";
//   $$(".interview-question-card").forEach(card => card.classList.toggle("active", Number(card.dataset.interviewIndex) === index));
//   $$(".interview-select").forEach(button => { button.textContent = Number(button.dataset.interviewIndex) === index ? "Selected" : "Answer this"; });
// }

// async function evaluateInterview() {
//   if (!currentInterview) return toast("Generate 5 interview questions first.", "error");
//   const answer = $("#interviewAnswer")?.value.trim() || "";
//   if (!answer) return toast("Write your answer first.", "error");
//   const button = $("#evaluateAnswer");
//   setBusy(button, true, "Evaluating…");
//   try {
//     const data = await api("/api/interview/evaluate", { method: "POST", body: JSON.stringify({ role: $("#interviewRole").value, question: currentInterview.question, answer }) });
//     const result = data.result || {};
//     $("#interviewFeedback").innerHTML = `<h3>Score: ${esc(result.scoreOutOf10 ?? "—")}/10</h3><h4>Strengths</h4>${(result.strengths || []).map((item) => `<div>• ${esc(item)}</div>`).join("")}<h4>Improvements</h4>${(result.improvements || []).map((item) => `<div>• ${esc(item)}</div>`).join("")}<h4>Improved answer</h4><p>${esc(result.improvedAnswer || "")}</p><h4>Follow-up</h4><p>${esc(result.followUpQuestion || "")}</p>`;
//   } catch (error) { $("#interviewFeedback").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
//   finally { setBusy(button, false); }
// }

// async function bootAuthenticatedApp() {
//   setTutorMode(currentTutorMode);
//   await Promise.all([loadDashboardSummary(), loadAdaptiveRecommendation(), loadTodos()]);
//   await Promise.allSettled([status(), loadDashboardSummary(), loadTodos(), loadReminders()]);
//   checkNotifications();
//   clearInterval(window.smartStudyReminderTimer);
//   window.smartStudyReminderTimer = setInterval(checkNotifications, 60000);
//   const params = new URLSearchParams(window.location.search);
//   const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
//   const resetToken = hashParams.get("resetToken") || params.get("resetToken");
//   if (resetToken) {
//     $("#resetPanel").classList.remove("hidden");
//     $("#resetToken").value = resetToken;
//     toast("Password reset link loaded. Choose a new password.", "success");
//     window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/([?&])resetToken=[^&]*/i, "").replace(/[?&]$/, "") );
//     if (window.location.hash) window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
//   }
//   if (params.get("google") === "connected") {
//     toast("Google connected successfully.", "success");
//     window.history.replaceState({}, document.title, window.location.pathname);
//   }
// }

// async function requestPasswordReset() {
//   const email = $("#resetEmail").value.trim() || $("#authEmail").value.trim();
//   if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Enter the account email first.", "error");
//   try {
//     const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
//     $("#resetToken").value = data.resetToken || "";
//     toast(data.resetToken ? "Reset token created. It expires in 15 minutes." : data.message, "success");
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function performPasswordReset() {
//   const tokenValue = $("#resetToken").value.trim();
//   const password = $("#resetNewPassword").value;
//   if (!tokenValue || password.length < 6) return toast("Enter the reset token and a password of at least 6 characters.", "error");
//   try {
//     await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: tokenValue, password }) });
//     $("#resetPanel").classList.add("hidden");
//     $("#authPassword").value = password;
//     toast("Password reset. Sign in with your new password.", "success");
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function generateAdaptivePlan() {
//   const button = $("#adaptivePlanBtn"); setBusy(button, true, "Planning…");
//   try {
//     const subjects = $("#planSubjects").value.split(",").map(x => x.trim()).filter(Boolean);
//     const weakTopics = $("#planWeakTopics").value.split(",").map(x => x.trim()).filter(Boolean);
//     const data = await api("/api/study-plan/adaptive", { method: "POST", body: JSON.stringify({ goal: $("#planGoal").value.trim(), examDate: $("#planExamDate").value, availableHours: Number($("#planHours").value), subjects, weakTopics }) });
//     const result = data.result || {};
//     $("#adaptivePlanOutput").innerHTML = `<h3>${esc(result.overview || "Adaptive plan created")}</h3><div class="chips">${(result.priorities || []).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</div>${(result.days || []).slice(0, 14).map(d => `<article class="plan-day"><b>${esc(d.date || d.day || "Day")}: ${esc(d.subject || "Study")} · ${esc(d.topic || "Revision")}</b><small>${esc(d.reason || "")}</small><p>${(d.tasks || []).map(esc).join(" · ")}</p><span>${esc(d.durationMinutes || 0)} min</span></article>`).join("")}`;
//     toast("Adaptive plan saved to your learning system.", "success");
//   } catch (error) { $("#adaptivePlanOutput").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
//   finally { setBusy(button, false); }
// }

// async function loadReminders() {
//   try {
//     const data = await api("/api/reminders");
//     const list = data.reminders || [];
//     $("#reminderList").innerHTML = list.length ? list.map(r => `<div class="list-item ${r.completed ? "done" : ""}"><b>${esc(r.title)}</b><small>${new Date(r.dueAt).toLocaleString()}</small><button class="icon-btn" data-reminder-id="${esc(r.id)}">✓</button></div>`).join("") : '<div class="empty-state">No reminders yet.</div>';
//     $$('[data-reminder-id]').forEach(btn => btn.onclick = async () => { await api(`/api/reminders/${encodeURIComponent(btn.dataset.reminderId)}`, { method: "PATCH", body: JSON.stringify({ completed: true }) }); await loadReminders(); });
//   } catch {}
// }

// async function addReminder() {
//   try {
//     const value = $("#reminderAt").value;
//     if (!value) return toast("Choose a reminder time.", "error");
//     await api("/api/reminders", { method: "POST", body: JSON.stringify({ title: $("#reminderTitle").value.trim(), dueAt: new Date(value).toISOString() }) });
//     $("#reminderTitle").value = ""; $("#reminderAt").value = ""; await loadReminders(); toast("Reminder added.", "success");
//     if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
//   } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function checkNotifications() {
//   if (!currentUser) return;
//   try {
//     const data = await api("/api/notifications/due");
//     for (const item of data.notifications || []) {
//       if (lastReminders.has(item.id)) continue;
//       lastReminders.add(item.id);
//       toast(`Reminder: ${item.title}`, "info");
//       if ("Notification" in window && Notification.permission === "granted") new Notification("Smart Study AI", { body: item.title });
//     }
//   } catch {}
// }

// async function triageEmail() {
//   const button = $("#triageMail"); setBusy(button, true, "AI triaging…");
//   try {
//     const data = await api("/api/gmail/triage", { method: "POST", body: JSON.stringify({ maxResults: 10 }) });
//     const items = data.extracted || [];
//     const deadlines = items.flatMap(x => x.deadlines || []).filter(x => x.date);
//     $("#emailTriageOutput").innerHTML = `<h3>${esc(data.processed || 0)} emails analyzed</h3>${items.map(x => `<article class="mail-triage"><b>${esc(x.subject)}</b><small>${esc(x.category || "general")}</small><p>${esc(x.summary || "")}</p><div>${(x.tasks || []).map(t => `<span class="pill">Task: ${esc(t.title)}</span>`).join("")}</div>${(x.deadlines || []).map(d => `<span class="pill">Deadline: ${esc(d.title)} · ${esc(d.date)}</span>`).join("")}</article>`).join("")}${deadlines.length ? `<button id="triageCalendarBtn" class="secondary">Create ${deadlines.length} calendar events</button>` : ""}`;
//     if (deadlines.length) $("#triageCalendarBtn").onclick = async () => { try { const out = await api("/api/gmail/triage-to-calendar", { method: "POST", body: JSON.stringify({ deadlines }) }); toast(`${out.created?.length || 0} calendar events created.`, "success"); } catch (error) { toast(friendlyError(error), "error"); } };
//     await loadTodos();
//   } catch (error) { $("#emailTriageOutput").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
//   finally { setBusy(button, false); }
// }

// function renderRoomShared(room) {
//   const docs = room.documents || []; const quizzes = room.quizzes || [];
//   $("#roomSharedContent").innerHTML = `<h3>Shared documents</h3>${docs.length ? docs.map(d => `<div class="list-item"><b>${esc(d.title)}</b><small>${esc(d.documentId)}</small></div>`).join("") : '<p class="muted">No shared documents.</p>'}<h3>Shared quizzes</h3>${quizzes.length ? quizzes.slice().reverse().map(q => `<div class="list-item"><b>${esc(q.topic)}</b><small>${q.questions?.length || 0} questions</small></div>`).join("") : '<p class="muted">No shared quizzes.</p>'}`;
// }

// async function shareRoomDocument() {
//   if (!lastRoomId) return toast("Join a room first.", "error");
//   const id = $("#roomDocumentId").value.trim(); if (!id) return toast("Enter a document ID.", "error");
//   try { const data = await api(`/api/rooms/${encodeURIComponent(lastRoomId)}/documents`, { method: "POST", body: JSON.stringify({ documentId: id, title: $("#roomDocumentTitle").value.trim() || "Shared document" }) }); renderRoomShared(data); } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function createRoomQuiz() {
//   if (!lastRoomId) return toast("Join a room first.", "error");
//   try { const data = await api(`/api/rooms/${encodeURIComponent(lastRoomId)}/quizzes`, { method: "POST", body: JSON.stringify({ topic: $("#roomQuizTopic").value.trim() || "General study", count: 5 }) }); renderRoomShared({ documents: [], quizzes: [data.quiz] }); toast("Shared quiz created.", "success"); } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function askRoomTutor() {
//   if (!lastRoomId) return toast("Join a room first.", "error");
//   const question = window.prompt("What should the room AI explain?"); if (!question) return;
//   try { const data = await api(`/api/rooms/${encodeURIComponent(lastRoomId)}/tutor`, { method: "POST", body: JSON.stringify({ question }) }); $("#roomSharedContent").insertAdjacentHTML("afterbegin", `<article class="ai-callout"><b>Room AI</b><p>${esc(data.answer?.answer || "")}</p>${(data.answer?.keyPoints || []).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</article>`); } catch (error) { toast(friendlyError(error), "error"); }
// }

// async function generateVideoLesson() {
//   const button = $("#generateVideoBtn");
//   const topic = $("#videoQuery").value.trim();
//   const material = $("#videoMaterial").value.trim();
//   if (!topic && !material) return toast("Enter a topic or paste study material first.", "error");
//   setBusy(button, true, "Creating lesson…");
//   try {
//     const data = await api("/api/videos/generate", { method: "POST", body: JSON.stringify({ topic, material, language: currentUser?.preferredLanguage || "English" }) });
//     renderLessonPlayer(data.lesson); toast("Interactive AI lesson created.", "success");
//   } catch (error) { $("#generatedVideo").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
//   finally { setBusy(button, false); }
// }

// function renderLessonPlayer(lesson) {
//   let index = 0;
//   const slides = Array.isArray(lesson.slides) && lesson.slides.length ? lesson.slides : [{ title: lesson.title || "AI lesson", body: lesson.script || "" }];
//   const render = () => {
//     const slide = slides[index];
//     $("#generatedVideo").innerHTML = `<div class="lesson-stage"><div class="lesson-stage-top"><span class="eyebrow">LLM LESSON · ${index + 1}/${slides.length}</span><span class="trust-badge">Generated from your topic/material</span></div><h2>${esc(slide.title || lesson.title)}</h2><div class="lesson-body">${renderMarkdown(slide.body || "")}</div><div class="lesson-controls"><button id="lessonPrev" class="secondary" ${index === 0 ? "disabled" : ""}>← Previous</button><button id="lessonCopy" class="secondary">Copy slide</button><button id="lessonSpeak" class="primary">🔊 Narrate</button><button id="lessonNext" class="secondary" ${index === slides.length - 1 ? "disabled" : ""}>Next →</button></div></div><div class="lesson-objectives"><b>Learning objectives</b><div class="chips">${(lesson.learningObjectives || []).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</div></div>`;
//     $("#lessonPrev").onclick = () => { index = Math.max(0, index - 1); render(); };
//     $("#lessonNext").onclick = () => { index = Math.min(slides.length - 1, index + 1); render(); };
//     $("#lessonSpeak").onclick = () => speakText(slide.body || lesson.script || "");
//     $("#lessonCopy").onclick = async () => { try { await navigator.clipboard.writeText(`${slide.title || lesson.title}\n\n${slide.body || ""}`); $("#lessonCopy").textContent = "Copied"; setTimeout(() => $("#lessonCopy").textContent = "Copy slide", 1400); } catch { toast("Copy is unavailable in this browser.", "error"); } };
//   };
//   render();
// }

// async function runCode() {
//   const button = $("#runCode"); setBusy(button, true, "Running…");
//   try { const data = await api("/api/coding/run", { method: "POST", body: JSON.stringify({ language: $("#codeLanguage").value, code: $("#codeInput").value }) }); $("#runOutput").textContent = `${data.stdout || ""}${data.stderr ? `\n${data.stderr}` : ""}` || "Process completed with no output."; } catch (error) { $("#runOutput").textContent = friendlyError(error); } finally { setBusy(button, false); }
// }

// function bindEvents() {
//   $$(".nav").forEach((button) => button.addEventListener("click", () => go(button.dataset.section)));
//   $$('[data-go]').forEach((button) => button.addEventListener("click", () => go(button.dataset.go)));
//   $("#loginTab").onclick = () => setAuthMode("login");
//   $("#forgotPasswordBtn").onclick = () => $("#resetPanel").classList.toggle("hidden");
//   $("#requestReset").onclick = requestPasswordReset;
//   $("#resetPasswordBtn").onclick = performPasswordReset;
//   $("#registerTab").onclick = () => setAuthMode("register");
//   $("#authForm").onsubmit = submitAuth;
//   $("#togglePassword").onclick = () => {
//     const field = $("#authPassword");
//     field.type = field.type === "password" ? "text" : "password";
//     $("#togglePassword").textContent = field.type === "password" ? "Show" : "Hide";
//   };
//   $("#logout").onclick = logout;
//   $("#themeToggle").onclick = () => {
//     const light = !document.body.classList.contains("light");
//     localStorage.setItem("theme", light ? "light" : "dark");
//     applyTheme();
//   };
//   $("#mobileMenuToggle").onclick = () => $("#mobileNav").classList.toggle("open");
//   $("#refreshDashboard").onclick = () => Promise.all([loadDashboardSummary(), loadAdaptiveRecommendation(), loadTodos()]);
//   $("#adaptiveRefreshBtn").onclick = loadAdaptiveRecommendation;
//   $("#adaptiveNextPackBtn").onclick = generateAdaptiveNextPack;
//   $("#openDashboardPage").onclick = () => { window.location.href = "/dashboard.html"; };
//   $("#todoForm").onsubmit = submitTodo;
//   $("#refreshTodosBtn").onclick = loadTodos;
//   $("#sendBtn").onclick = sendChat;
//   if ($("#chatImageInput")) $("#chatImageInput").onchange = (event) => {
//     const file = event.target.files?.[0] || null;
//     selectedChatImage = file && String(file.type || "").startsWith("image/") && file.size <= 10 * 1024 * 1024 ? file : null;
//     if (file && !selectedChatImage) toast(file.size > 10 * 1024 * 1024 ? "Image must be smaller than 10 MB." : "Please choose an image file.", "error");
//     const preview = $("#imagePreviewName");
//     if (preview) preview.textContent = selectedChatImage ? selectedChatImage.name : "";
//   };
//   $("#userInput").onkeydown = (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); } };
//   $("#analyzeBtn").onclick = generateStudyPack;
//   $("#adaptivePlanBtn").onclick = generateAdaptivePlan;
//   $("#refreshFlashcards").onclick = loadFlashcards;
//   $("#refreshQuizzes").onclick = loadQuizzes;
//   $("#refreshQuizInsights").onclick = loadQuizAnalytics;
//   $("#reviewDueOnly").onclick = () => { flashcardFilter = "due"; $("#reviewDueOnly").classList.add("active-filter"); $("#reviewAllCards").classList.remove("active-filter"); loadFlashcards(); };
//   $("#reviewAllCards").onclick = () => { flashcardFilter = "all"; $("#reviewAllCards").classList.add("active-filter"); $("#reviewDueOnly").classList.remove("active-filter"); loadFlashcards(); };
//   $("#addReminder").onclick = addReminder;
//   $("#triageMail").onclick = triageEmail;
//   $("#shareRoomDocument").onclick = shareRoomDocument;
//   $("#createRoomQuiz").onclick = createRoomQuiz;
//   $("#askRoomTutor").onclick = askRoomTutor;
//   $("#generateVideoBtn").onclick = generateVideoLesson;
//   $("#runCode").onclick = runCode;
//   $$(`[data-tutor-mode]`).forEach((button) => button.onclick = () => { setTutorMode(button.dataset.tutorMode); go("tutor"); });
//   $("#connectGmail").onclick = () => connectGoogle("gmail");
//   $("#connectCalendar").onclick = () => connectGoogle("calendar");
//   $("#loadMail").onclick = loadMail;
//   $("#sendMail").onclick = sendMail;
//   $("#loadEvents").onclick = loadEvents;
//   $("#createEvent").onclick = createEvent;
//   $("#researchBtn").onclick = research;
//   $("#createRoom").onclick = createRoom;
//   $("#joinRoom").onclick = () => joinRoom($("#roomCode").value);
//   $("#sendRoomMessage").onclick = sendRoomMessage;
//   $("#roomMessage").onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); sendRoomMessage(); } };
//   $("#sharedNotes").oninput = () => { clearTimeout(noteTimer); noteTimer = setTimeout(sendSharedNotes, 250); };
//   $("#voiceStart").onclick = startRecognition;
//   $("#micBtn").onclick = startRecognition;
//   $("#voiceSpeakLast").onclick = () => speakText(lastAiAnswer);
//   $("#videoBtn").onclick = searchVideos;
//   $$(".tab").forEach((tab) => tab.onclick = () => {
//     $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
//     $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab.dataset.tab));
//   });
//   $("#solveCode").onclick = solveCode;
//   $("#newQuestion").onclick = newInterviewQuestion;
//   $("#evaluateAnswer").onclick = evaluateInterview;
// }

// async function init() {
//   applyTheme();
//   bindEvents();
//   setAuthMode("login");
//   await validateSession();
//   if (currentUser) await bootAuthenticatedApp();
// }

// document.addEventListener("DOMContentLoaded", init);



//testing

const API = window.location.protocol === "file:" ? "http://localhost:5050" : "";
const TOKEN_KEY = "smartStudyToken";
const USER_KEY = "smartStudyUser";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let currentUser = null;
let lastAiAnswer = "";
let currentInterview = null;
let interviewQuestions = [];
let currentInterviewIndex = 0;
let roomSocket = null;
let recognition = null;
let noteTimer = null;
let selectedChatImage = null;
let lastReminders = new Set();
let lastRoomId = "";
let lastRoomInviteToken = "";
let currentTutorMode = "normal";
let flashcardsCache = [];
let flashcardFilter = "due";
let currentQuiz = null;
let currentQuizIndex = 0;
let currentQuizAnswers = {};

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  const message = String(error?.message || error || fallback);
  if (error?.status === 402 || /AI_BUDGET_EXCEEDED|exceed the AI budget/i.test(message)) {
    return "This study generation reached the AI budget for the current session. Start a new session or increase AI_BUDGET_USD_PER_SESSION in Backend/.env.";
  }
  if (error?.status === 429 || /quota|resource_exhausted|rate.?limit/i.test(message)) {
    return "The external AI provider is currently unavailable. Smart Study AI will use its built-in local fallback where supported; retry when the provider quota is available for richer AI generation.";
  }
  if (/401|unauthorized|authentication token/i.test(message)) {
    return "Your session has expired. Please sign in again.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "The backend cannot be reached. Make sure Smart Study AI is running at http://localhost:5050.";
  }
  return message || fallback;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const accessToken = token();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers,
      credentials: "include"
    });
  } catch (error) {
    throw new Error(friendlyError(error));
  }

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data.code;
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      await clearSession("Your session expired. Please sign in again.");
    }
    throw error;
  }
  return data;
}

function setBusy(button, busy, busyText = "Working…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function toast(message, kind = "info") {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 4200);
}

function setAuthMessage(message = "", kind = "error") {
  const element = $("#authMessage");
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
  element.classList.toggle("show", Boolean(message));
}

function setAuthMode(mode) {
  const register = mode === "register";
  $("#authMode").value = mode;
  $("#authNameWrap").classList.toggle("hidden", !register);
  $("#authName").required = register;
  $("#authSubmit").textContent = register ? "Create account" : "Sign in";
  $("#authTitle").textContent = register ? "Create your study workspace" : "Welcome back";
  $("#authSubtitle").textContent = register
    ? "Build one private learning space for AI study, projects and productivity."
    : "Continue your learning session across study, research and productivity tools.";
  $("#loginTab").classList.toggle("active", !register);
  $("#registerTab").classList.toggle("active", register);
  setAuthMessage("");
  if ($("#forgotPasswordBtn")) $("#forgotPasswordBtn").classList.toggle("hidden", register);
  if ($("#resetPanel")) $("#resetPanel").classList.add("hidden");
}

function showAuth(message = "") {
  document.body.classList.add("auth-only");
  $("#authScreen").classList.remove("hidden");
  $("#appShell").classList.add("hidden");
  setAuthMode($("#authMode").value || "login");
  if (message) setAuthMessage(message);
}

function showApp(user) {
  currentUser = user || JSON.parse(localStorage.getItem(USER_KEY) || "null");
  document.body.classList.remove("auth-only");
  $("#authScreen").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  $("#userName").textContent = currentUser?.name || "Student";
  $("#userEmail").textContent = currentUser?.email || "";
  $("#avatar").textContent = (currentUser?.name || "S").trim().charAt(0).toUpperCase();
}

async function clearSession(message = "") {
  if (roomSocket) {
    try { roomSocket.close(); } catch {}
    roomSocket = null;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
  if (message) showAuth(message);
}

async function submitAuth(event) {
  event.preventDefault();
  const mode = $("#authMode").value;
  const submit = $("#authSubmit");
  const body = {
    email: $("#authEmail").value.trim(),
    password: $("#authPassword").value
  };
  if (mode === "register") body.name = $("#authName").value.trim();

  if (mode === "register" && body.name.length < 2) {
    setAuthMessage("Please enter your name.");
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(body.email)) {
    setAuthMessage("Enter a valid email address.");
    return;
  }
  if (body.password.length < 6) {
    setAuthMessage("Password must be at least 6 characters.");
    return;
  }

  setBusy(submit, true, mode === "register" ? "Creating…" : "Signing in…");
  setAuthMessage("");
  try {
    const data = await api(`/api/auth/${mode === "register" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    showApp(data.user);
    $("#authForm").reset();
    await bootAuthenticatedApp();
    toast(mode === "register" ? "Account created successfully." : "Signed in successfully.", "success");
  } catch (error) {
    setAuthMessage(friendlyError(error));
  } finally {
    setBusy(submit, false);
  }
}

async function validateSession() {
  if (!token()) {
    showAuth();
    return false;
  }
  try {
    const data = await api("/api/auth/me");
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    showApp(data.user);
    return true;
  } catch {
    await clearSession();
    showAuth("Please sign in to continue.");
    return false;
  }
}

async function logout() {
  try {
    if (token()) await api("/api/auth/logout", { method: "POST" });
  } catch {}
  await clearSession();
  showAuth("You have been signed out.", "success");
}

function go(id) {
  const target = $(`#${id}`);
  if (!target) return;
  $$(".section").forEach((section) => section.classList.toggle("active", section.id === id));
  $$(".nav").forEach((button) => button.classList.toggle("active", button.dataset.section === id));
  $("#mobileNav").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyTheme() {
  const theme = localStorage.getItem("theme") || "dark";
  document.body.classList.toggle("light", theme === "light");
  $("#themeToggle").textContent = theme === "light" ? "☀" : "☾";
}

async function status() {
  try {
    const data = await api("/api/integrations/status");
    $("#connectionStatus").textContent = data.connected ? "Google connected" : "Google not connected";
    $("#connectionStatus").className = `status-pill ${data.connected ? "ok" : "neutral"}`;
    $("#connectionStatus").title = `Gmail: ${data.gmail ? "ready" : "off"} · Calendar: ${data.calendar ? "ready" : "off"}`;
  } catch {
    $("#connectionStatus").textContent = "Backend offline";
    $("#connectionStatus").className = "status-pill danger";
  }
}

async function loadDashboardSummary() {
  try {
    const data = await api("/api/dashboard");
    const dashboard = data.data;
    const overview = dashboard.overview || {};
    $("#welcomeTitle").textContent = `Welcome, ${dashboard.user?.name || currentUser?.name || "Student"}`;
    $("#statStudy").textContent = `${overview.todayStudyTimeMinutes || 0} min`;
    $("#statQuiz").textContent = `${overview.averageQuizScore || 0}%`;
    $("#statCards").textContent = String(overview.flashcardsDue || 0);
    $("#statProgress").textContent = `${overview.dailyProgress || 0}%`;
    const weak = dashboard.weakTopics || [];
    $("#weakTopicSummary").textContent = weak.length ? `Focus next: ${weak[0].name}` : "No weak topics detected yet";
  } catch (error) {
    if (error.status !== 401) console.warn("Dashboard summary unavailable", error);
  }
}

async function loadAdaptiveRecommendation() {
  const title = $("#adaptiveTitle");
  const reason = $("#adaptiveReason");
  const badge = $("#adaptiveModeBadge");
  const dataBox = $("#adaptiveData");
  const button = $("#adaptiveNextPackBtn");
  if (!title || !reason || !badge || !dataBox || !button) return;
  try {
    const response = await api("/api/adaptive/next");
    const data = response.data || {};
    const mode = String(data.mode || "learn").toUpperCase();
    title.textContent = data.focusTopic ? `Next: ${data.focusTopic}` : "Your next study move";
    reason.textContent = data.reason || data.nextAction || "Keep building your learning streak.";
    badge.textContent = mode;
    badge.dataset.mode = String(data.mode || "learn");
    const ld = data.learningData || {};
    dataBox.innerHTML = [
      `<span><b>${Number(data.mastery || 0)}%</b> focus mastery</span>`,
      `<span><b>${Number(ld.dueFlashcards || 0)}</b> due cards</span>`,
      `<span><b>${Number(ld.weakTopics || 0)}</b> weak topics</span>`,
      `<span><b>${ld.recentQuizAverage == null ? "—" : `${ld.recentQuizAverage}%`}</b> quiz avg</span>`
    ].join("");
    button.disabled = false;
    button.title = data.canGenerateNextPack ? "Use your latest saved study material to build the next adaptive pack" : "Create a study pack first";
    button.textContent = data.canGenerateNextPack ? "Build next study pack" : "Create first study pack";
    button.dataset.adaptiveMode = data.mode || "learn";
    button.dataset.canGenerate = String(Boolean(data.canGenerateNextPack));
  } catch (error) {
    if (error.status !== 401) {
      reason.textContent = friendlyError(error);
      dataBox.innerHTML = '<span>Adaptive data unavailable right now.</span>';
      button.disabled = true;
    }
  }
}

async function generateAdaptiveNextPack() {
  const button = $("#adaptiveNextPackBtn");
  if (!button || button.disabled) return;
  if (button.dataset.canGenerate === "false") { go("packs"); $("#studyText")?.focus(); toast("Create your first study pack from notes or a file, then the adaptive engine can build the next one.", "info"); return; }
  setBusy(button, true, "Adapting…");
  try {
    const response = await api("/api/adaptive/next-pack", { method: "POST", body: JSON.stringify({}) });
    const result = response.data?.analysis || response.data || {};
    const sourceTitle = response.sourceSession?.title || "Adaptive Study Pack";
    result.sourceText = String(response.sourceText || "");
    result.flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
    result.quiz = Array.isArray(result.quiz || result.questions) ? (result.quiz || result.questions) : [];
    result.keywords = Array.isArray(result.keywords || result.keyPoints) ? (result.keywords || result.keyPoints) : [];
    result.mindmap = result.mindmap || { mainTopic: sourceTitle, subTopics: [] };
    for (const key of ["memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]) result[key] = Array.isArray(result[key]) ? result[key] : [];
    const saved = await saveStudyArtifacts(result, sourceTitle, response.sourceSession?.documentId || "");
    renderStudyPack({ analysis: result, saved, adaptive: response.recommendation });
    go("packs");
    toast(`Adaptive pack ready · focused on ${response.recommendation?.focusTopic || "your next topic"}.`, "success");
    await loadAdaptiveRecommendation();
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    setBusy(button, false);
  }
}

async function loadTodos() {
  try {
    const data = await api("/api/todos");
    const todos = Array.isArray(data.todos) ? data.todos : [];
    $("#todoList").innerHTML = todos.length ? todos.map((todo) => `
      <div class="list-item todo-item ${todo.completed ? "done" : ""}">
        <label class="todo-main">
          <input type="checkbox" data-id="${esc(todo.id)}" ${todo.completed ? "checked" : ""} aria-label="Mark ${esc(todo.title)} complete">
          <span><b>${esc(todo.title)}</b><small>${todo.dueDate ? `Due ${esc(todo.dueDate)} · ` : ""}${esc(todo.priority)}</small></span>
        </label>
        <button class="icon-btn danger-btn" data-delete-todo="${esc(todo.id)}" aria-label="Delete task">×</button>
      </div>`).join("") : '<div class="empty-state">No tasks yet. Add your first study task above.</div>';
    const open = todos.filter((todo) => !todo.completed).length;
    const completed = todos.length - open;
    $("#todoStats").textContent = `${open} open · ${completed} completed`;
    $$("[data-id]").forEach((checkbox) => {
      checkbox.onchange = async () => {
        try {
          await api(`/api/todos/${encodeURIComponent(checkbox.dataset.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ completed: checkbox.checked })
          });
          await loadTodos();
        } catch (error) { toast(friendlyError(error), "error"); }
      };
    });
    $$("[data-delete-todo]").forEach((button) => {
      button.onclick = async () => {
        try {
          await api(`/api/todos/${encodeURIComponent(button.dataset.deleteTodo)}`, { method: "DELETE" });
          await loadTodos();
        } catch (error) { toast(friendlyError(error), "error"); }
      };
    });
  } catch (error) {
    $("#todoList").innerHTML = '<div class="empty-state">Tasks are temporarily unavailable.</div>';
    if (error.status !== 401) toast(friendlyError(error), "error");
  }
}

async function submitTodo(event) {
  event.preventDefault();
  const button = $("#todoForm button[type=submit]");
  const title = $("#todoTitle").value.trim();
  if (!title) return;
  setBusy(button, true, "Adding…");
  try {
    await api("/api/todos", {
      method: "POST",
      body: JSON.stringify({
        title,
        dueDate: $("#todoDueDate").value || null,
        priority: $("#todoPriority").value
      })
    });
    $("#todoForm").reset();
    await loadTodos();
  } catch (error) { toast(friendlyError(error), "error"); }
  finally { setBusy(button, false); }
}

function renderInlineMarkdown(value = "") {
  let html = esc(value);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  return html;
}

function renderMarkdown(value = "") {
  const lines = String(value).replace(/\r\n?/g, "\n").trim().split("\n");
  if (!lines.length || !lines.join("").trim()) return "";
  const html = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];
  let codeLines = null;
  let codeLanguage = "code";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<${listType}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${listType}>`);
    listItems = [];
    listType = null;
  };
  const flushCode = () => {
    if (!codeLines) return;
    const code = codeLines.join("\n");
    html.push(`<div class="code-answer"><div class="code-answer-head"><span>${esc(codeLanguage)}</span><button type="button" class="copy-code" data-code="${esc(code)}">Copy</button></div><pre>${esc(code)}</pre></div>`);
    codeLines = null;
    codeLanguage = "code";
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (codeLines) flushCode();
      else { flushParagraph(); flushList(); codeLanguage = line.slice(3).trim() || "code"; codeLines = []; }
      continue;
    }
    if (codeLines) { codeLines.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); const level = heading[1].length + 1; html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`); continue; }
    const quote = line.match(/^>\s+(.+)$/);
    if (quote) { flushParagraph(); flushList(); html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`); continue; }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
    if (ordered || unordered) {
      const nextType = ordered ? "ol" : "ul";
      if (listType && listType !== nextType) flushList();
      flushParagraph();
      listType = nextType;
      listItems.push((ordered || unordered)[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  if (codeLines) flushCode();
  flushParagraph();
  flushList();
  return html.join("");
}

function addChat(text, who = "ai", meta = {}) {
  if (!text) return;
  const element = document.createElement("article");
  element.className = `msg ${who === "user" ? "user" : "ai"}`;
  if (who === "user") {
    element.textContent = String(text);
  } else {
    const sourceLabel = meta.sources?.length ? "Based on your study material" : "LLM tutor response";
    element.innerHTML = `<div class="msg-head"><span>${esc(sourceLabel)}</span><button type="button" class="copy-answer">Copy answer</button></div><div class="msg-content">${renderMarkdown(text)}</div>`;
    const copyButton = element.querySelector(".copy-answer");
    copyButton.onclick = async () => {
      try { await navigator.clipboard.writeText(String(text)); copyButton.textContent = "Copied"; setTimeout(() => { copyButton.textContent = "Copy answer"; }, 1400); }
      catch { toast("Copy is unavailable in this browser.", "error"); }
    };
    element.querySelectorAll(".copy-code").forEach((button) => {
      button.onclick = async () => {
        try { await navigator.clipboard.writeText(button.dataset.code || ""); button.textContent = "Copied"; setTimeout(() => { button.textContent = "Copy"; }, 1400); }
        catch { toast("Copy is unavailable in this browser.", "error"); }
      };
    });
  }
  $("#chatBox").appendChild(element);
  $("#chatBox").scrollTop = $("#chatBox").scrollHeight;
}

function showAiError(error, container = $("#chatBox")) {
  const message = friendlyError(error);
  const element = document.createElement("div");
  element.className = "msg error-message";
  element.innerHTML = `<strong>AI service unavailable</strong><br>${esc(message)}`;
  container.appendChild(element);
  container.scrollTop = container.scrollHeight;
  toast(message, "error");
}

async function sendChat() {
  const input = $("#userInput");
  const button = $("#sendBtn");
  const question = input.value.trim();
  if (!question && !selectedChatImage) return;
  const mode = currentTutorMode;
  const image = selectedChatImage;
  input.value = "";
  addChat(image ? `${question || "Explain this image"} 📷 ${image.name}` : question, "user");
  setBusy(button, true, image ? "Analyzing image…" : "Thinking…");

  try {
    let data;
    let lastError;

    for (let attempt = 1; attempt <= (image ? 2 : 1); attempt += 1) {
      try {
        if (image) {
          const form = new FormData();
          form.append("question", question || "Explain this image for my studies. Give a clear, detailed explanation of what is visible.");
          form.append("sessionId", "default");
          form.append("tutorMode", mode);
          form.append("image", image);
          data = await api("/api/ai/chat/multimodal", { method: "POST", body: form });
        } else {
          data = await api("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({ question, contextMode: "general", tutorMode: mode })
          });
        }
        if (data?.reply) break;
      } catch (error) {
        lastError = error;
        if (attempt < (image ? 2 : 1)) await new Promise(resolve => setTimeout(resolve, 700));
      }
    }

    if (!data?.reply) throw lastError || new Error("The AI did not return an answer.");

    lastAiAnswer = data.reply;
    addChat(lastAiAnswer, "ai", { sources: data.sources || [] });

    if (image) {
      selectedChatImage = null;
      const imageInput = $("#chatImageInput");
      const preview = $("#imagePreviewName");
      if (imageInput) imageInput.value = "";
      if (preview) preview.textContent = "";
    }
    return true;
  } catch (error) {
    // Keep the selected image so the user can retry without selecting it again.
    showAiError(error);
    return false;
  } finally {
    setBusy(button, false);
  }
}

async function saveStudyArtifacts(result, title, documentId) {
  const flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
  const quiz = Array.isArray(result.quiz) ? result.quiz : [];
  if (!flashcards.length && !quiz.length) return { sessionId: null, savedCards: 0, savedQuiz: false };
  let sessionId = null;
  try {
    const session = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        title: title || "Study Pack",
        documentName: title || "Study Notes",
        documentId: /^[a-f0-9]{24}$/i.test(String(documentId || "")) ? documentId : undefined,
        studyText: String(result.sourceText || "").slice(0, 100000),
        summary: result.summary || "",
        keywords: Array.isArray(result.keywords) ? result.keywords : [],
        flashcards: flashcards.map(x => ({ question: String(x.question || x.front || "Question"), answer: String(x.answer || x.back || "") })),
        quiz: quiz.map(x => ({ question: String(x.question || "Question"), options: Array.isArray(x.options) ? x.options : [], answer: String(x.answer || "") })),
        mindmap: result.mindmap || { mainTopic: title || "Study Pack", subTopics: [] },
        memoryTricks: Array.isArray(result.memoryTricks) ? result.memoryTricks : [],
        cheatSheet: Array.isArray(result.cheatSheet) ? result.cheatSheet : [],
        formulas: Array.isArray(result.formulas) ? result.formulas : [],
        commonMistakes: Array.isArray(result.commonMistakes) ? result.commonMistakes : [],
        examTips: Array.isArray(result.examTips) ? result.examTips : [],
        learningMethods: Array.isArray(result.learningMethods) ? result.learningMethods : [],
        revisionPlan: Array.isArray(result.revisionPlan) ? result.revisionPlan : [],
        practiceQuestions: Array.isArray(result.practiceQuestions) ? result.practiceQuestions : [],
        examples: Array.isArray(result.examples) ? result.examples : []
      })
    });
    sessionId = session.session?._id || session.data?._id || null;
  } catch (error) {
    console.warn("Study session persistence failed", error);
  }
  let savedCards = 0;
  for (const card of flashcards) {
    try {
      await api("/api/flashcards", { method: "POST", body: JSON.stringify({
        question: String(card.question || card.front || "Question").trim(),
        answer: String(card.answer || card.back || "").trim(),
        topic: title || "Study Pack",
        sessionId: sessionId || undefined,
        documentId: /^[a-f0-9]{24}$/i.test(String(documentId || "")) ? documentId : undefined,
        difficulty: ["easy", "medium", "hard"].includes(String(card.difficulty || "").toLowerCase()) ? String(card.difficulty).toLowerCase() : "medium"
      }) });
      savedCards++;
    } catch (error) { console.warn("Flashcard persistence failed", error); }
  }
  let savedQuiz = false;
  if (quiz.length) {
    const questions = quiz.map(item => {
      const options = Array.isArray(item.options) ? item.options.map(String).slice(0, 4) : [];
      const answer = String(item.answer || item.correctAnswer || "");
      return { question: String(item.question || "Question"), options, correctAnswer: options.includes(answer) ? answer : options[0] || answer, explanation: String(item.explanation || ""), topic: title || "Study Pack" };
    }).filter(q => q.options.length === 4 && q.correctAnswer);
    if (questions.length) {
      try {
        await api("/api/quizzes", { method: "POST", body: JSON.stringify({ title: title || "Study Quiz", topic: title || "Study Pack", sessionId: sessionId || undefined, documentId: /^[a-f0-9]{24}$/i.test(String(documentId || "")) ? documentId : undefined, questions }) });
        savedQuiz = true;
      } catch (error) { console.warn("Quiz persistence failed", error); }
    }
  }
  return { sessionId, savedCards, savedQuiz };
}

let browserOcrPromise = null;

async function loadBrowserOCR() {
  if (window.Tesseract) return window.Tesseract;
  if (browserOcrPromise) return browserOcrPromise;
  browserOcrPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-studyverse-ocr="tesseract"]');
    if (existing) {
      existing.addEventListener('load', () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR library loaded without Tesseract.')));
      existing.addEventListener('error', () => reject(new Error('Could not load the browser OCR library.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.async = true;
    script.dataset.studyverseOcr = 'tesseract';
    script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR library loaded without Tesseract.'));
    script.onerror = () => reject(new Error('Could not load the browser OCR library. Check your internet connection.'));
    document.head.appendChild(script);
  });
  try { return await browserOcrPromise; }
  catch (error) { browserOcrPromise = null; throw error; }
}

async function extractImageTextInBrowser(file) {
  const Tesseract = await loadBrowserOCR();
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (message) => {
      if (message?.status === 'recognizing text' && Number.isFinite(message.progress)) {
        const percent = Math.round(message.progress * 100);
        const output = $('#analysisOutput');
        if (output) output.innerHTML = `<div class="loading-card"><b>Reading ${esc(file.name)}…</b><p>OCR progress: ${percent}%</p></div>`;
      }
    }
  });
  const text = String(result?.data?.text || '').replace(/\r/g, '').trim();
  if (text.length < 20) throw new Error(`${file.name}: OCR could not find enough readable text in this image.`);
  return text;
}

async function generateStudyPack() {
  const text = $("#studyText").value.trim();
  const button = $("#analyzeBtn");
  setBusy(button, true, "Building pack…");
  $("#analysisOutput").innerHTML = '<div class="loading-card"><b>Building your study pack…</b><p>Reading the material, extracting concepts, writing recall cards and preparing a practice quiz.</p></div>';
  try {
    let sourceText = text;
    let documentId;
    let documentIds = [];
    const files = [...(Array.from($("#pdfInput")?.files || []))];
    if (!sourceText && files.length) {
      for (const item of files) if (item.size > 15 * 1024 * 1024) throw new Error(`${item.name} is larger than 15 MB.`);

      // Keep PDF/Office/text uploads on their existing server extraction path.
      // Images use browser OCR so this study-pack flow does not depend on a
      // server-installed tesseract binary or the multimodal chat route.
      const imageFiles = files.filter((item) => String(item.type || "").startsWith("image/"));
      const documentFiles = files.filter((item) => !String(item.type || "").startsWith("image/"));

      const extractedParts = [];

      if (documentFiles.length) {
        const form = new FormData();
        documentFiles.forEach((item) => form.append("files", item));
        const upload = await api("/api/documents/upload", { method: "POST", body: form });
        const docs = upload.documents || [];
        const failed = upload.errors || [];
        extractedParts.push(...docs.map((item) => `# ${item.title || item.documentName || "Document"}\n${item.text || ""}`));
        documentIds = docs.map(item => item.documentId).filter(Boolean);
        documentId = documentIds[0];
        if (failed.length) toast(`${failed.length} document file(s) could not be read. The readable files will still be used.`, "error");
      }

      for (const imageFile of imageFiles) {
        const imageText = await extractImageTextInBrowser(imageFile);
        extractedParts.push(`# ${imageFile.name}\n${imageText}`);
      }

      sourceText = extractedParts.filter(Boolean).join("\n\n");
      if (!sourceText.trim()) throw new Error("No readable content was extracted from the selected files.");
    }
    if (sourceText.length < 50) throw new Error("Add at least 50 characters of notes or choose a readable file.");
    const studyPreferences = {
      style: $("#packStyle")?.value || "balanced",
      difficulty: $("#packDifficulty")?.value || "adaptive",
      targetExam: $("#packExam")?.value.trim() || "",
      focus: $("#packFocus")?.value.trim() || ""
    };
    const data = await api("/api/ai/task", { method: "POST", body: JSON.stringify({ goal: "Create the best possible source-grounded study pack: summary, concept map, cheat sheet, formulas or rules when supported, memory tricks, common mistakes, exam tips, active-learning methods, revision plan, examples, 12 flashcards, 10 four-option practice questions and short-answer checks.", text: sourceText, title: files.map(x => x.name).join(", ") || "Study Notes", documentId, documentIds, contextMode: "study", studyPreferences }) });
    const result = data.analysis || data;
    result.sourceText = sourceText;
    result.flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
    result.quiz = Array.isArray(result.quiz || result.questions) ? (result.quiz || result.questions) : [];
    result.keywords = Array.isArray(result.keywords || result.keyPoints) ? (result.keywords || result.keyPoints) : [];
    result.mindmap = result.mindmap || { mainTopic: files.map(x => x.name).join(", ") || "Study Notes", subTopics: [] };
    for (const key of ["memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]) result[key] = Array.isArray(result[key]) ? result[key] : [];
    const saved = await saveStudyArtifacts(result, files.map(x => x.name).join(", ") || "Study Notes", documentId);
    renderStudyPack({ ...data, analysis: result, saved });
    toast(`Study pack ready · ${saved.savedCards} flashcards${saved.savedQuiz ? " · quiz saved" : ""}.`, "success");
  } catch (error) {
    $("#analysisOutput").innerHTML = `<div class="error-card"><strong>Study pack could not be generated.</strong><p>${esc(friendlyError(error))}</p></div>`;
    toast(friendlyError(error), "error");
  } finally { setBusy(button, false); }
}

function renderStudyPack(data) {
  const result = data.analysis || data;
  const summary = result.summary || result.overview || result.reply || "";
  const keywords = Array.isArray(result.keywords || result.keyPoints) ? (result.keywords || result.keyPoints) : [];
  const flashcards = Array.isArray(result.flashcards) ? result.flashcards : [];
  const quiz = Array.isArray(result.quiz || result.questions) ? (result.quiz || result.questions) : [];
  const mindmap = result.mindmap || {};
  const memoryTricks = result.memoryTricks || [];
  const cheatSheet = result.cheatSheet || [];
  const formulas = result.formulas || [];
  const commonMistakes = result.commonMistakes || [];
  const examTips = result.examTips || [];
  const learningMethods = result.learningMethods || [];
  const revisionPlan = result.revisionPlan || [];
  const practiceQuestions = result.practiceQuestions || [];
  const examples = result.examples || [];
  const escList = (items) => items.map(x => `<li>${esc(x)}</li>`).join("");
  const methods = learningMethods.map(x => `<article class="method-card"><b>${esc(x.method)}</b><p>${esc(x.how)}</p>${x.when ? `<small>${esc(x.when)}</small>` : ""}</article>`).join("");
  const revision = revisionPlan.map(x => `<article class="revision-day"><span>${esc(x.day)}</span><div><b>${esc(x.focus)}</b><p>${esc(x.action)}</p></div></article>`).join("");
  const formulaRows = formulas.map(x => `<div class="formula-row"><b>${esc(x.name)}</b><code>${esc(x.formula)}</code>${x.note ? `<small>${esc(x.note)}</small>` : ""}</div>`).join("");
  const cheatRows = cheatSheet.map(x => `<div class="cheat-row"><b>${esc(x.label)}</b><span>${esc(x.value)}</span></div>`).join("");
  const exampleRows = examples.map(x => `<article class="example-card"><b>${esc(x.concept)}</b><p>${esc(x.example)}</p></article>`).join("");
  const practiceRows = practiceQuestions.map((x,i) => `<article class="practice-card"><span>${i+1}</span><div><b>${esc(x.question)}</b><p>${esc(x.answer)}</p></div></article>`).join("");
  const quizPreview = quiz.slice(0, 10).map((item, i) => `<article class="generated-card quiz-preview"><span>${i + 1}</span><div><b>${esc(item.question || "Question")}</b><small>${(item.options || []).map((x, n) => `${String.fromCharCode(65+n)}. ${esc(x)}`).join(" · ")}</small></div></article>`).join("");
  const cardPreview = flashcards.slice(0, 12).map((item, i) => `<article class="generated-card"><span>${i + 1}</span><div><b>${esc(item.question || item.front || "Question")}</b><p>${esc(item.answer || item.back || "")}</p><small>${esc(item.difficulty || "medium")} · active recall</small></div></article>`).join("");
  const completion = Math.min(100, Math.round(([summary, keywords.length, flashcards.length >= 6, quiz.length >= 4, mindmap.subTopics?.length, memoryTricks.length, cheatSheet.length, formulas.length, commonMistakes.length, examTips.length, learningMethods.length, revisionPlan.length, examples.length].filter(Boolean).length / 13) * 100));
  const adaptive = data.adaptive || null;
  const adaptiveBanner = adaptive ? `<section class="adaptive-pack-banner"><div><span class="eyebrow">ADAPTIVE NEXT STEP</span><h3>${esc(adaptive.focusTopic || "Next topic")}</h3><p>${esc(adaptive.reason || adaptive.nextAction || "Your next pack is selected from your learning data.")}</p></div><button id="packAdaptiveNext" class="primary">Continue with adaptive learning →</button></section>` : "";
  $("#analysisOutput").innerHTML = `
    <div class="pack-result-head"><div><span class="eyebrow">BEST STUDY PACK · ${completion}% READY</span><h2>${esc(result.title || "Your study pack")}</h2><p>${data.saved?.savedCards || 0} flashcards saved · ${data.saved?.savedQuiz ? "practice quiz saved" : "quiz not saved"}</p></div><div class="pack-actions"><button id="openPackCards" class="secondary">Review flashcards</button><button id="openPackQuiz" class="primary" ${data.saved?.savedQuiz ? "" : "disabled"}>Take quiz</button></div></div>
    <div class="pack-progress"><span style="width:${completion}%"></span></div>
    <div class="learning-loop compact-loop" aria-label="Study pack flow"><span class="active">LEARN</span><i>→</i><span>PRACTICE</span><i>→</i><span>REVISE</span><i>→</i><span>ADAPT</span></div>
    ${adaptiveBanner}
    <div class="result-grid">
      ${summary ? `<section class="result-block featured"><div class="result-label">1 · CORE SUMMARY</div><div class="pack-summary">${renderMarkdown(summary)}</div></section>` : ""}
      ${keywords.length ? `<section class="result-block"><div class="result-label">2 · KEY CONCEPTS</div><div class="chips">${keywords.slice(0, 15).map(item => `<span class="pill">${esc(item)}</span>`).join("")}</div></section>` : ""}
      ${mindmap.subTopics?.length ? `<section class="result-block full"><div class="result-label">3 · CONCEPT MAP</div><h3>${esc(mindmap.mainTopic || "Main topic")}</h3><div class="topic-map">${mindmap.subTopics.map(x => `<span>${esc(x)}</span>`).join("")}</div></section>` : ""}
      ${cheatRows ? `<section class="result-block"><div class="result-label">4 · QUICK CHEAT SHEET</div><div class="cheat-sheet">${cheatRows}</div></section>` : ""}
      ${formulas ? `<section class="result-block"><div class="result-label">5 · FORMULAS / RULES</div><div class="formula-sheet">${formulaRows || '<p class="muted">No formulas or rules were supported by this material.</p>'}</div></section>` : ""}
      ${memoryTricks.length ? `<section class="result-block full memory-block"><div class="result-label">6 · MEMORY TRICKS & SHORTCUTS</div><p class="muted">These are learning aids generated from the material, not extra source facts.</p><div class="trick-grid">${memoryTricks.map((x,i) => `<article class="trick-card"><span>${i+1}</span><p>${esc(x)}</p></article>`).join("")}</div></section>` : ""}
      ${commonMistakes.length ? `<section class="result-block"><div class="result-label">7 · COMMON MISTAKES</div><ul class="study-list warning-list">${escList(commonMistakes)}</ul></section>` : ""}
      ${examTips.length ? `<section class="result-block"><div class="result-label">8 · EXAM / INTERVIEW TIPS</div><ul class="study-list">${escList(examTips)}</ul></section>` : ""}
      ${methods ? `<section class="result-block full"><div class="result-label">9 · HOW TO LEARN THIS</div><div class="method-grid">${methods}</div></section>` : ""}
      ${exampleRows ? `<section class="result-block full"><div class="result-label">10 · CONCRETE EXAMPLES</div><div class="example-grid">${exampleRows}</div></section>` : ""}
      <section class="result-block full"><div class="result-label">11 · ACTIVE-RECALL FLASHCARDS · ${flashcards.length}</div>${cardPreview || '<p class="muted">No flashcards were returned.</p>'}</section>
      <section class="result-block full"><div class="result-label">12 · PRACTICE QUIZ · ${quiz.length}</div>${quizPreview || '<p class="muted">No quiz questions were returned.</p>'}</section>
      ${practiceRows ? `<section class="result-block full"><div class="result-label">13 · SHORT-ANSWER CHECKS</div><div class="practice-grid">${practiceRows}</div></section>` : ""}
      ${revision ? `<section class="result-block full"><div class="result-label">14 · 7-DAY REVISION ROUTE</div><div class="revision-grid">${revision}</div></section>` : ""}
    </div>`;
  $("#openPackCards").onclick = () => { go("flashcards"); loadFlashcards(); };
  $("#openPackQuiz").onclick = async () => { go("quizzes"); await loadQuizzes(); };
  if ($("#packAdaptiveNext")) $("#packAdaptiveNext").onclick = generateAdaptiveNextPack;
}
const tutorModeCopy = {
  normal: ["Normal tutor", "Clear explanations, examples and practical next steps."],
  beginner: ["Beginner tutor", "Simple language, small steps and no assumed background."],
  socratic: ["Socratic tutor", "Guiding questions first, with the answer revealed after reasoning."],
  exam: ["Exam tutor", "Definitions, scoring points, common traps and exam-style thinking."],
  interview: ["Interview tutor", "Practice concise answers, follow-up questions and reasoning."],
  revision: ["Revision tutor", "Active recall, compact notes and quick checks for memory."]
};
function setTutorMode(mode) {
  currentTutorMode = mode;
  $$("[data-tutor-mode]").forEach(button => button.classList.toggle("active", button.dataset.tutorMode === mode));
  const copy = tutorModeCopy[mode] || tutorModeCopy.normal;
  if ($("#tutorHeading")) $("#tutorHeading").textContent = copy[0];
  if ($("#tutorModeDescription")) $("#tutorModeDescription").textContent = copy[1];
}

async function loadFlashcards() {
  const workspace = $("#flashcardWorkspace");
  if (!workspace) return;
  workspace.innerHTML = '<div class="loading-card">Loading your review queue…</div>';
  try {
    const endpoint = flashcardFilter === "due" ? "/api/flashcards/due" : "/api/flashcards?limit=100";
    const data = await api(endpoint);
    flashcardsCache = data.data || [];
    renderFlashcardWorkspace();
    loadFlashcardAnalytics();
  } catch (error) { workspace.innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
}

function renderFlashcardWorkspace() {
  const workspace = $("#flashcardWorkspace");
  const cards = flashcardsCache;
  const due = cards.filter(c => new Date(c.nextReviewAt) <= new Date()).length;
  $("#flashcardProgress").textContent = `${cards.length} ${flashcardFilter === "due" ? "due" : "active"} cards · ${due} ready now`;
  if (!cards.length) { workspace.innerHTML = '<div class="empty-state large-empty"><h3>No cards in this queue</h3><p>Generate a study pack first, then come back here for spaced repetition.</p><button class="primary" id="emptyCardsGo">Create study pack</button></div>'; $("#emptyCardsGo").onclick = () => go("packs"); return; }
  const card = cards[0];
  workspace.innerHTML = `<article class="flashcard" id="activeFlashcard"><div class="flashcard-meta"><span>${esc(card.topic || "General")}</span><span>${esc(card.knowledgeStatus || "unknown")}</span></div><button class="flashcard-face" id="flashcardReveal" aria-expanded="false"><span class="flashcard-label">QUESTION</span><strong>${esc(card.question)}</strong><small>Click to reveal the answer</small></button><div id="flashcardAnswer" class="flashcard-answer hidden"><span class="flashcard-label">ANSWER</span><p>${esc(card.answer)}</p></div><div class="review-actions"><button class="review-btn again" data-rating="Again">Again<small>Reset</small></button><button class="review-btn" data-rating="Hard">Hard<small>Short interval</small></button><button class="review-btn" data-rating="Good">Good<small>Keep pace</small></button><button class="review-btn easy" data-rating="Easy">Easy<small>Long interval</small></button></div><div class="knowledge-actions"><button class="secondary" id="markKnown">✓ I know this</button><button class="secondary" id="markUnknown">↺ Need more practice</button></div></article>`;
  $("#flashcardReveal").onclick = () => { $("#flashcardAnswer").classList.toggle("hidden"); $("#flashcardReveal").setAttribute("aria-expanded", String(!$("#flashcardAnswer").classList.contains("hidden"))); };
  $$(".review-btn").forEach(button => button.onclick = () => reviewFlashcard(card._id, button.dataset.rating));
  $("#markKnown").onclick = () => setCardKnowledge(card._id, "known");
  $("#markUnknown").onclick = () => setCardKnowledge(card._id, "unknown");
}
async function loadFlashcardAnalytics() {
  const chart = $("#flashcardAnalytics");
  if (!chart) return;
  try {
    const data = await api("/api/analytics/flashcards");
    const d = data.data || {};
    const total = Math.max(1, Number(d.total || 0));
    const rows = [
      ["Known", Number(d.known || 0)],
      ["Due", Number(d.due || 0)],
      ["Reviewed", Number(d.reviewed || 0)],
      ["Learning", Math.max(0, Number(d.total || 0) - Number(d.known || 0))]
    ];
    const max = Math.max(1, ...rows.map(x => x[1]));
    chart.innerHTML = `<div class="mastery-chart">${rows.map(([label,value]) => `<div class="chart-row"><span>${label}</span><div class="chart-track"><i style="width:${Math.round(value/max*100)}%"></i></div><b>${value}</b></div>`).join("")}</div><div class="rating-strip">${Object.entries(d.byRating || {}).map(([label,value]) => `<span><b>${esc(label)}</b> ${Number(value)||0}</span>`).join("")}</div><p class="muted">${Number(d.due||0)} cards are ready now. Review honestly to improve the next interval.</p>`;
  } catch { chart.innerHTML = '<p class="muted">Learning analytics will appear after your first reviews.</p>'; }
}

async function reviewFlashcard(id, rating) { try { await api(`/api/flashcards/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ rating }) }); flashcardsCache = flashcardsCache.slice(1); renderFlashcardWorkspace(); toast(`Rated ${rating}. Next card ready.`, "success"); } catch (error) { toast(friendlyError(error), "error"); } }
async function setCardKnowledge(id, knowledgeStatus) { try { await api(`/api/flashcards/${encodeURIComponent(id)}/knowledge`, { method: "POST", body: JSON.stringify({ knowledgeStatus }) }); flashcardsCache = flashcardsCache.slice(1); renderFlashcardWorkspace(); toast(knowledgeStatus === "known" ? "Marked as known." : "Marked for more practice.", "success"); } catch (error) { toast(friendlyError(error), "error"); } }

async function loadQuizzes() {
  const library = $("#quizLibrary");
  if (!library) return;
  library.innerHTML = '<div class="loading-card">Loading your quizzes…</div>';
  try {
    const data = await api("/api/quizzes");
    const quizzes = data.data || [];
    loadQuizAnalytics();
    library.innerHTML = quizzes.length ? quizzes.map(q => `<article class="quiz-library-card"><div><span class="eyebrow">${q.questions?.length || 0} QUESTIONS</span><h3>${esc(q.title || "Study Quiz")}</h3><p>${esc(q.topic || "General")}</p><small>${new Date(q.createdAt).toLocaleDateString()}</small></div><button class="primary take-quiz" data-id="${esc(q._id)}">Take quiz</button></article>`).join("") : '<div class="empty-state large-empty"><h3>Your quiz library is empty</h3><p>Generate a study pack to create a quiz from your own material.</p><button class="primary" id="emptyQuizGo">Create study pack</button></div>';
    $$(".take-quiz").forEach(button => button.onclick = () => startQuiz(button.dataset.id));
    if ($("#emptyQuizGo")) $("#emptyQuizGo").onclick = () => go("packs");
  } catch (error) { library.innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
}
async function loadQuizAnalytics() {
  const target = $("#quizAnalytics");
  if (!target) return;
  try {
    const data = await api("/api/analytics/quiz-performance");
    const rows = (data.data || []).slice(-8);
    if (!rows.length) { target.innerHTML = '<p class="muted">Take your first quiz to build a performance trend.</p>'; return; }
    const max = 100;
    target.innerHTML = `<div class="quiz-trend">${rows.map((x,i) => { const score=Math.max(0,Math.min(100,Number(x.percentage||0))); return `<div class="quiz-bar-wrap"><span>${score}%</span><div class="quiz-bar"><i style="height:${score}%"></i></div><small>Q${i+1}</small></div>`; }).join("")}</div><div class="insight-line"><b>${Math.round(rows.reduce((a,x)=>a+Number(x.percentage||0),0)/rows.length)}%</b> average across your latest ${rows.length} attempts <span>·</span> ${rows[rows.length-1].percentage ?? 0}% most recent</div>`;
  } catch { target.innerHTML = '<p class="muted">Quiz analytics are temporarily unavailable.</p>'; }
}

async function startQuiz(id) {
  try { const data = await api(`/api/quizzes/${encodeURIComponent(id)}`); currentQuiz = data.data; currentQuizIndex = 0; currentQuizAnswers = {}; $("#quizLibrary").classList.add("hidden"); $("#quizRunner").classList.remove("hidden"); renderQuizQuestion(); } catch (error) { toast(friendlyError(error), "error"); }
}
function renderQuizQuestion() {
  const runner = $("#quizRunner"); const questions = currentQuiz?.questions || []; const q = questions[currentQuizIndex];
  if (!q) return;
  const selected = currentQuizAnswers[String(q._id)] || "";
  runner.innerHTML = `<div class="quiz-runner-card"><div class="quiz-runner-top"><div><span class="eyebrow">QUESTION ${currentQuizIndex + 1} OF ${questions.length}</span><h2>${esc(currentQuiz.title || "Study Quiz")}</h2></div><span class="quiz-counter">${currentQuizIndex + 1}/${questions.length}</span></div><div class="quiz-question"><h3>${esc(q.question)}</h3><div class="quiz-options">${q.options.map((option, i) => `<button class="quiz-option ${selected === option ? "selected" : ""}" data-option="${esc(option)}"><span>${String.fromCharCode(65+i)}</span>${esc(option)}</button>`).join("")}</div></div><div class="quiz-runner-actions"><button id="exitQuiz" class="secondary">Back to quizzes</button><div><button id="prevQuiz" class="secondary" ${currentQuizIndex === 0 ? "disabled" : ""}>← Previous</button>${currentQuizIndex < questions.length - 1 ? '<button id="nextQuiz" class="primary">Next →</button>' : '<button id="submitQuiz" class="primary">Submit quiz</button>'}</div></div></div>`;
  $$(".quiz-option").forEach(btn => btn.onclick = () => { currentQuizAnswers[String(q._id)] = btn.dataset.option; renderQuizQuestion(); });
  $("#prevQuiz").onclick = () => { currentQuizIndex--; renderQuizQuestion(); };
  if ($("#nextQuiz")) $("#nextQuiz").onclick = () => { if (!currentQuizAnswers[String(q._id)]) return toast("Choose an answer first.", "error"); currentQuizIndex++; renderQuizQuestion(); };
  if ($("#submitQuiz")) $("#submitQuiz").onclick = submitQuiz;
  $("#exitQuiz").onclick = exitQuiz;
}
async function submitQuiz() {
  const unanswered = (currentQuiz.questions || []).filter(q => !currentQuizAnswers[String(q._id)]).length;
  if (unanswered) return toast(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered.`, "error");
  try {
    const answers = currentQuiz.questions.map(q => ({ questionId: q._id, selectedAnswer: currentQuizAnswers[String(q._id)] }));
    const data = await api(`/api/quiz-attempts/${encodeURIComponent(currentQuiz._id)}`, { method: "POST", body: JSON.stringify({ answers }) });
    const result = data.data;
    $("#quizRunner").innerHTML = `<div class="quiz-result-card"><span class="eyebrow">QUIZ COMPLETE</span><div class="score-ring"><strong>${result.percentage}%</strong><span>${result.score}/${result.totalQuestions}</span></div><h2>${result.percentage >= 80 ? "Strong result" : result.percentage >= 60 ? "Good progress" : "Keep practising"}</h2><p>${result.percentage >= 80 ? "You have a solid grasp of this set. Review the missed questions once more." : "Use the feedback to decide what to revise next."}</p><div class="result-actions"><button id="reviewQuizAgain" class="primary">Try again</button><button id="backQuizLibrary" class="secondary">Back to quiz library</button><button id="goFlashcardsAfterQuiz" class="secondary">Review flashcards</button></div></div>`;
    $("#reviewQuizAgain").onclick = () => { currentQuizIndex = 0; currentQuizAnswers = {}; renderQuizQuestion(); };
    $("#backQuizLibrary").onclick = exitQuiz;
    $("#goFlashcardsAfterQuiz").onclick = () => { exitQuiz(); go("flashcards"); loadFlashcards(); };
    loadDashboardSummary();
  } catch (error) { toast(friendlyError(error), "error"); }
}
function exitQuiz() { currentQuiz = null; $("#quizRunner").classList.add("hidden"); $("#quizLibrary").classList.remove("hidden"); loadQuizzes(); }

async function connectGoogle(service) {
  try {
    const data = await api(`/api/google/auth?service=${encodeURIComponent(service)}`);
    window.location.href = data.url;
  } catch (error) { toast(friendlyError(error), "error"); }
}

async function loadMail() {
  try {
    const data = await api(`/api/gmail/messages?maxResults=12&q=${encodeURIComponent($("#emailSearch").value.trim())}`);
    $("#emailList").innerHTML = data.messages?.length ? data.messages.map((message) => `
      <article class="list-item"><b>${esc(message.subject)}</b><small>${esc(message.from)} · ${esc(message.date)}</small><p>${esc(message.snippet)}</p><details><summary>Read</summary><p>${esc(message.body)}</p></details></article>`).join("") : '<div class="empty-state">No messages found.</div>';
  } catch (error) { toast(friendlyError(error), "error"); }
}

async function sendMail() {
  const button = $("#sendMail");
  setBusy(button, true, "Sending…");
  try {
    await api("/api/gmail/send", { method: "POST", body: JSON.stringify({
      to: $("#mailTo").value.trim(), subject: $("#mailSubject").value.trim(), body: $("#mailBody").value.trim()
    }) });
    toast("Email sent successfully.", "success");
    $("#mailBody").value = "";
  } catch (error) { toast(friendlyError(error), "error"); }
  finally { setBusy(button, false); }
}

async function loadEvents() {
  try {
    const data = await api("/api/calendar/events");
    $("#eventList").innerHTML = data.events?.length ? data.events.map((event) => `
      <article class="list-item"><b>${esc(event.title)}</b><small>${event.start ? new Date(event.start).toLocaleString() : ""}${event.end ? ` → ${new Date(event.end).toLocaleString()}` : ""}</small><p>${esc(event.description)}</p><button class="secondary" data-delete-event="${esc(event.id)}">Delete</button></article>`).join("") : '<div class="empty-state">No events found in the next 30 days.</div>';
    $$('[data-delete-event]').forEach((button) => {
      button.onclick = async () => {
        try { await api(`/api/calendar/events/${encodeURIComponent(button.dataset.deleteEvent)}`, { method: "DELETE" }); await loadEvents(); }
        catch (error) { toast(friendlyError(error), "error"); }
      };
    });
  } catch (error) { toast(friendlyError(error), "error"); }
}

async function createEvent() {
  const start = $("#eventStart").value;
  const end = $("#eventEnd").value;
  if (!$("#eventTitle").value.trim() || !start || !end) return toast("Title, start and end are required.", "error");
  try {
    await api("/api/calendar/events", { method: "POST", body: JSON.stringify({
      title: $("#eventTitle").value.trim(), description: $("#eventDescription").value.trim(), location: $("#eventLocation").value.trim(), start, end
    }) });
    toast("Calendar event created.", "success");
    ["#eventTitle", "#eventLocation", "#eventStart", "#eventEnd", "#eventDescription"].forEach((id) => $(id).value = "");
    await loadEvents();
  } catch (error) { toast(friendlyError(error), "error"); }
}

function safeExternalUrl(value) {
  try { const url = new URL(String(value || ""), window.location.href); return ["http:", "https:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; }
}

async function research() {
  const query = $("#researchQuery").value.trim();
  if (!query) return toast("Enter a research topic.", "error");
  const button = $("#researchBtn");
  setBusy(button, true, "Researching…");
  $("#researchAnswer").innerHTML = '<div class="loading-card">Searching current sources…</div>';
  try {
    const data = await api("/api/research", { method: "POST", body: JSON.stringify({ query }) });
    $("#researchAnswer").textContent = data.answer || "No answer was returned.";
    $("#researchSources").innerHTML = data.sources?.length ? `<h3>Sources</h3>${data.sources.map((source) => `<a class="source" target="_blank" rel="noopener noreferrer" href="${esc(safeExternalUrl(source.url))}">${esc(source.title || source.url)}</a>`).join("")}` : '<p class="muted">No source metadata was returned.</p>';
  } catch (error) {
    $("#researchAnswer").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`;
  } finally { setBusy(button, false); }
}

async function createRoom() {
  try {
    const data = await api("/api/rooms", { method: "POST", body: "{}" });
    $("#roomCode").value = data.roomId;
    if ($("#roomInviteToken")) $("#roomInviteToken").value = data.inviteToken || "";
    lastRoomInviteToken = data.inviteToken || "";
    lastRoomId = data.roomId;
    joinRoom(data.roomId, lastRoomInviteToken);
  } catch (error) { toast(friendlyError(error), "error"); }
}

function renderMembers(members = []) {
  $("#members").innerHTML = members.map((member) => `<span class="member-chip">${esc(member.name)}</span>`).join("");
}

function addRoomChat(message) {
  const element = document.createElement("div");
  element.className = "msg";
  element.innerHTML = `<b>${esc(message.name)}</b><br>${esc(message.text)}`;
  $("#roomChat").appendChild(element);
  $("#roomChat").scrollTop = $("#roomChat").scrollHeight;
}

function renderRoom(room) {
  renderMembers(room.members || []);
  $("#roomChat").innerHTML = "";
  (room.messages || []).forEach(addRoomChat);
  $("#sharedNotes").value = room.notes || "";
  renderRoomShared(room);
}

async function joinRoom(code, inviteToken = "") {
  const normalized = String(code || "").trim().toUpperCase();
  lastRoomId = normalized;
  const name = $("#roomName").value.trim() || currentUser?.name || "Student";
  if (!normalized) return toast("Enter a room code.", "error");
  const suppliedInvite = String(inviteToken || $("#roomInviteToken")?.value || "").trim();
  try { await api(`/api/rooms/${encodeURIComponent(normalized)}/join`, { method: "POST", body: JSON.stringify({ inviteToken: suppliedInvite }) }); }
  catch (error) { return toast(friendlyError(error), "error"); }
  if (roomSocket) try { roomSocket.close(); } catch {}
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  roomSocket = new WebSocket(`${protocol}://${location.host}/ws?room=${encodeURIComponent(normalized)}&name=${encodeURIComponent(name)}`);
  $("#roomStatus").textContent = `Connecting to ${normalized}…`;
  roomSocket.onopen = () => { roomSocket.send(JSON.stringify({ type: "auth", token: token() })); $("#roomStatus").textContent = `Authenticating ${normalized}…`; };
  roomSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "snapshot") renderRoom(message.room);
      if (message.type === "members") renderMembers(message.members);
      if (message.type === "chat") addRoomChat(message.message);
      if (message.type === "notes") $("#sharedNotes").value = message.notes;
      if (message.type === "documents" || message.type === "quizzes") renderRoomShared({ documents: message.documents || [], quizzes: message.quizzes || [] });
    } catch { toast("Received an invalid room message.", "error"); }
  };
  roomSocket.onerror = () => { $("#roomStatus").textContent = "Connection error"; };
  roomSocket.onclose = () => { $("#roomStatus").textContent = "Room disconnected"; };
}

function sendRoomMessage() {
  const text = $("#roomMessage").value.trim();
  if (!text) return;
  if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return toast("Join a study room first.", "error");
  roomSocket.send(JSON.stringify({ type: "chat", text }));
  $("#roomMessage").value = "";
}

function sendSharedNotes() {
  if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
  roomSocket.send(JSON.stringify({ type: "notes", notes: $("#sharedNotes").value }));
}

function speakText(text) {
  if (!text) return toast("There is no AI answer to speak yet.", "error");
  if (!("speechSynthesis" in window)) return toast("Text-to-speech is not supported in this browser.", "error");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.onstart = () => $("#voiceState").textContent = "Speaking…";
  utterance.onend = () => $("#voiceState").textContent = "Ready";
  utterance.onerror = () => { $("#voiceState").textContent = "Ready"; toast("Speech output failed.", "error"); };
  speechSynthesis.speak(utterance);
}


async function searchVoiceWeb(query) {
  const text = String(query || "").trim();

  if (!text) {
    return;
  }

  console.log("[VOICE SEARCH] Query:", text);

  const googleUrl =
    `https://www.google.com/search?q=${encodeURIComponent(text)}`;

  const wikiSearchUrl =
    `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(text)}`;

  addChat(text, "user");

  const searchUrl =
    `https://en.wikipedia.org/w/api.php` +
    `?action=query` +
    `&list=search` +
    `&srsearch=${encodeURIComponent(text)}` +
    `&format=json` +
    `&origin=*` +
    `&utf8=1` +
    `&srlimit=5`;

  const response = await fetch(searchUrl, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia search failed (${response.status})`);
  }

  const data = await response.json();

  const results = Array.isArray(data?.query?.search)
    ? data.query.search
    : [];

  console.log("[VOICE SEARCH] Wikipedia results:", results);

  if (!results.length) {
    addChat(
      [
        "## I couldn't find a matching result",
        "",
        `I couldn't find a useful Wikipedia article for **${text}**.`,
        "",
        "You can continue the search here:",
        `- [Search Google for "${text}"](${googleUrl})`,
        `- [Search Wikipedia for "${text}"](${wikiSearchUrl})`
      ].join("\n"),
      "ai"
    );
    return;
  }

  /*
   * Fetch summaries for the best few results. This makes voice search
   * return an actual useful answer instead of only returning a title.
   */
  const articles = [];

  for (const result of results.slice(0, 3)) {
    const title = String(result?.title || "").trim();

    if (!title) continue;

    const pageName = title.replace(/ /g, "_");

    const pageUrl =
      `https://en.wikipedia.org/wiki/${encodeURIComponent(pageName)}`;

    let summary = "";

    try {
      const summaryResponse = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageName)}`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = String(summaryData?.extract || "").trim();
      }
    } catch (error) {
      console.warn(
        "[VOICE SEARCH] Could not load summary:",
        title,
        error
      );
    }

    if (!summary) {
      summary = String(result?.snippet || "")
        .replace(/<[^>]*>/g, "")
        .trim();
    }

    articles.push({
      title,
      summary,
      url: pageUrl
    });
  }

  const primary = articles[0];

  const related = articles
    .slice(1)
    .map(
      (article) =>
        `- [${article.title}](${article.url})${article.summary ? ` — ${article.summary}` : ""}`
    )
    .join("\n");

  const answer = [
    `## ${primary?.title || text}`,
    "",
    primary?.summary ||
      "I found a relevant Wikipedia result, but a summary was not available.",
    "",
    primary?.url
      ? `**Source:** [Wikipedia — ${primary.title}](${primary.url})`
      : "",
    "",
    related ? "### Related results\n" + related : "",
    "",
    "### Search online",
    `- [Search Google for "${text}"](${googleUrl})`,
    `- [Search Wikipedia for "${text}"](${wikiSearchUrl})`
  ]
    .filter(Boolean)
    .join("\n");

  const voiceAnswer = ensureVoiceAnswerContainer();
  if (voiceAnswer) voiceAnswer.innerHTML = renderMarkdown(answer);

  addChat(answer, "ai", {
    sources: primary?.url
      ? [
          {
            title: "Wikipedia",
            url: primary.url
          }
        ]
      : []
  });

  console.log("[VOICE SEARCH] Answer added");
}

function ensureVoiceAnswerContainer() {
  let element = $("#voiceAnswer");
  if (element) return element;
  const transcript = $("#voiceTranscript");
  if (!transcript) return null;
  element = document.createElement("div");
  element.id = "voiceAnswer";
  element.className = "rich voice-answer";
  transcript.parentElement.appendChild(element);
  return element;
}

function startRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    toast(
      "Voice recognition is not supported in this browser. Please use the latest Chrome or Edge.",
      "error"
    );
    return;
  }

  /*
   * Do not start another recognition instance while one is already active.
   */
  if (recognition) {
    console.log("[VOICE] Already running");
    return;
  }

  const speech = new SpeechRecognition();

  recognition = speech;

  /*
   * en-IN works well for Indian English. The recognition service can
   * occasionally fail to return a result, so we retry once with en-US.
   */
  let languageAttempt = 0;
  let finalTranscript = "";
  let interimTranscript = "";
  let finished = false;
  let hadError = false;

  const languages = ["en-IN", "en-US"];

  const setVoiceState = (state, transcript = "") => {
    const stateElement = $("#voiceState");
    const transcriptElement = $("#voiceTranscript");

    if (stateElement) {
      stateElement.textContent = state;
    }

    if (transcriptElement && transcript) {
      transcriptElement.textContent = transcript;
    }
  };

  const clearRecognition = () => {
    if (recognition === speech) {
      recognition = null;
    }
  };

  speech.lang = languages[languageAttempt];
  speech.continuous = false;
  speech.interimResults = true;
  speech.maxAlternatives = 3;

  console.log(
    "[VOICE] Starting recognition with language:",
    speech.lang
  );

  speech.onstart = () => {
    console.log("[VOICE] STARTED");
    setVoiceState("Listening…", "Speak now…");
    toast("Listening… speak now.", "info");
  };

  speech.onaudiostart = () => {
    console.log("[VOICE] AUDIO START");
  };

  speech.onsoundstart = () => {
    console.log("[VOICE] SOUND START");
  };

  speech.onspeechstart = () => {
    console.log("[VOICE] SPEECH START");
    setVoiceState(
      "Hearing you…",
      finalTranscript || interimTranscript || "Listening…"
    );
  };

  speech.onresult = (event) => {
    let newFinal = "";
    let newInterim = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];

      if (!result || !result[0]) continue;

      const transcript = String(
        result[0].transcript || ""
      ).trim();

      if (!transcript) continue;

      if (result.isFinal) {
        newFinal += transcript + " ";
      } else {
        newInterim += transcript + " ";
      }
    }

    newFinal = newFinal.trim();
    newInterim = newInterim.trim();

    if (newFinal) {
      finalTranscript = `${finalTranscript} ${newFinal}`.trim();
    }

    interimTranscript = newInterim;

    const currentText =
      `${finalTranscript} ${interimTranscript}`.trim();

    console.log("[VOICE] RESULT:", currentText);

    if (currentText) {
      setVoiceState("Got it…", currentText);
    }
  };

  speech.onerror = (event) => {
    hadError = true;

    console.error(
      "[VOICE] ERROR:",
      event.error,
      event.message || ""
    );

    const errorMessages = {
      "not-allowed":
        "Microphone permission was denied. Allow microphone access for this website and try again.",

      "audio-capture":
        "No microphone could be accessed. Check your Windows microphone settings.",

      "network":
        "The browser speech service could not be reached. Check your internet connection and try again.",

      "service-not-allowed":
        "The browser speech-recognition service is unavailable.",

      "no-speech":
        "I didn't hear anything. Please speak after the microphone starts."
    };

    /*
     * Do not immediately show an error for a normal aborted event.
     */
    if (event.error !== "aborted") {
      toast(
        errorMessages[event.error] ||
          `Voice recognition error: ${event.error}`,
        "error"
      );
    }
  };

  speech.onspeechend = () => {
    console.log("[VOICE] SPEECH END");
  };

  speech.onend = () => {
    console.log("[VOICE] END");

    const query =
      `${finalTranscript} ${interimTranscript}`.trim();

    /*
     * If the browser returned no transcript, retry once using en-US.
     * This handles Chrome speech-service cases where en-IN starts but
     * closes without producing a result.
     */
    if (
      !query &&
      languageAttempt < languages.length - 1 &&
      !finished
    ) {
      console.warn(
        "[VOICE] No transcript. Retrying with:",
        languages[languageAttempt + 1]
      );

      languageAttempt++;

      /*
       * Reuse the same SpeechRecognition instance for one retry.
       * This avoids losing the event handlers or leaving a stale
       * recognition object behind.
       */
      setTimeout(() => {
        if (finished || recognition !== speech) return;

        finalTranscript = "";
        interimTranscript = "";
        hadError = false;

        speech.lang = languages[languageAttempt];

        console.log(
          "[VOICE] RETRY START:",
          speech.lang
        );

        try {
          speech.start();
        } catch (error) {
          console.error(
            "[VOICE] RETRY FAILED:",
            error
          );

          clearRecognition();
          setVoiceState("Ready");
          toast(
            error.message || "Could not restart voice recognition.",
            "error"
          );
        }
      }, 250);

      return;
    }

    clearRecognition();

    if (finished) return;

    finished = true;

    if (!query) {
      setVoiceState(
        "Ready",
        "Press the microphone and speak."
      );

      if (!hadError) {
        toast(
          "No speech was detected. Please try again.",
          "error"
        );
      }

      return;
    }

    console.log(
      "[VOICE] FINAL QUERY:",
      query
    );

    setVoiceState("Searching…", query);

    /*
     * IMPORTANT:
     * Voice search does NOT call sendChat().
     * Therefore it does not use the Gemini/AI quota.
     */
    searchVoiceWeb(query)
      .then(() => {
        setVoiceState("Ready", query);
        console.log("[VOICE] Search completed");
      })
      .catch((error) => {
        console.error(
          "[VOICE] Search failed:",
          error
        );

        setVoiceState("Ready", query);

        toast(
          "I understood your voice, but the online search failed.",
          "error"
        );
      });
  };

  try {
    speech.start();
  } catch (error) {
    console.error(
      "[VOICE] START FAILED:",
      error
    );

    clearRecognition();

    setVoiceState("Ready");

    toast(
      error.message || "Could not start microphone.",
      "error"
    );
  }
}

async function searchVideos() {
  const query = $("#videoSearchQuery")?.value.trim() || $("#videoQuery").value.trim();
  if (!query) return toast("Enter a topic.", "error");
  const button = $("#videoBtn");
  setBusy(button, true, "Finding…");
  $("#videoList").innerHTML = '<div class="loading-card">Finding educational videos…</div>';
  try {
    const data = await api(`/api/videos?q=${encodeURIComponent(query)}`);
    const videos = data.videos || [];
    if (!videos.length) {
      const url = data.searchUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(query + " educational")}`;
      $("#videoList").innerHTML = `<article class="video video-fallback"><div class="video-body"><span class="eyebrow">YOUTUBE SEARCH</span><h3>Educational videos for “${esc(query)}”</h3><p>${esc(data.note || "Open YouTube to continue your search.")}</p><a class="primary" target="_blank" rel="noopener noreferrer" href="${esc(url)}">Open YouTube results →</a></div></article>`;
      return;
    }
    $("#videoList").innerHTML = videos.map((video) => {
      const match = String(video.url || "").match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
      const media = match
        ? `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(match[1])}" title="${esc(video.title || "Educational video")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
        : video.thumbnail ? `<img src="${esc(video.thumbnail)}" alt="${esc(video.title || "Educational video")}" loading="lazy">` : '<div class="video-placeholder">Educational video</div>';
      return `<article class="video">${media}<div class="video-body"><b>${esc(video.title || "Educational video")}</b><small>${esc(video.channel || "Educational source")}</small><p>${esc(video.description || "")}</p><a class="secondary" target="_blank" rel="noopener noreferrer" href="${esc(video.url || "#")}">Open video →</a></div></article>`;
    }).join("");
  } catch (error) {
    $("#videoList").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`;
  } finally { setBusy(button, false); }
}

async function solveCode() {
  const button = $("#solveCode");
  const problem = $("#codeProblem").value.trim();
  const code = $("#codeInput").value.trim();
  if (!problem && !code) return toast("Enter a problem or paste code.", "error");
  setBusy(button, true, "Analyzing…");
  try {
    const data = await api("/api/coding/solve", { method: "POST", body: JSON.stringify({ language: $("#codeLanguage").value, problem, code }) });
    const result = data.result || {};
    $("#codeOutput").innerHTML = `<h3>Explanation</h3><p>${esc(result.explanation || "")}</p><h3>Approach</h3>${(result.approach || []).map((item) => `<div>• ${esc(item)}</div>`).join("")}<h3>Solution</h3><pre>${esc(result.solution || "")}</pre><h3>Complexity</h3><p>${esc(result.complexity || "")}</p>${(result.testCases || []).length ? `<h3>Suggested tests</h3>${result.testCases.map((item) => `<div>• ${esc(typeof item === "string" ? item : JSON.stringify(item))}</div>`).join("")}` : ""}`;
  } catch (error) { $("#codeOutput").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
  finally { setBusy(button, false); }
}

async function newInterviewQuestion() {
  const button = $("#newQuestion");
  if (!button) return;
  setBusy(button, true, "Generating 5 questions…");
  const role = $("#interviewRole")?.value.trim() || "Software Engineer";
  const level = $("#interviewLevel")?.value || "entry";
  const topic = $("#interviewTopic")?.value.trim() || "general";
  try {
    const data = await api("/api/interview/question", {
      method: "POST",
      body: JSON.stringify({ role, level, topic })
    });
    let questions = Array.isArray(data?.result?.questions) ? data.result.questions : [];
    if (!questions.length && data?.result?.question) questions = [data.result];
    questions = questions.filter(item => item && String(item.question || "").trim()).slice(0, 5).map((item, index) => ({
      question: String(item.question || "").trim(),
      type: String(item.type || "Interview question").trim(),
      evaluationCriteria: Array.isArray(item.evaluationCriteria) ? item.evaluationCriteria : [],
      modelAnswer: String(item.modelAnswer || "").trim(),
      followUps: Array.isArray(item.followUps) ? item.followUps : [],
      number: index + 1
    }));
    if (questions.length < 5) throw new Error(`The interview service returned ${questions.length} questions instead of 5. Please try again.`);
    interviewQuestions = questions;
    currentInterviewIndex = 0;
    currentInterview = questions[0];
    if ($("#interviewAnswer")) $("#interviewAnswer").value = "";
    if ($("#interviewFeedback")) $("#interviewFeedback").innerHTML = "";
    const output = $("#interviewQuestion");
    if (!output) return;
    output.innerHTML = `<div class="interview-question-list">${questions.map((item, index) => `
      <article class="card interview-question-card ${index === 0 ? "active" : ""}" data-interview-index="${index}">
        <div class="card-title-row"><div><span class="eyebrow">QUESTION ${index + 1} OF 5</span><h3>${esc(item.type)}</h3></div>
        <button type="button" class="secondary interview-select" data-interview-index="${index}">${index === 0 ? "Selected" : "Answer this"}</button></div>
        <p>${esc(item.question)}</p>
        ${item.evaluationCriteria.length ? `<details><summary>Evaluation criteria</summary>${item.evaluationCriteria.map(x => `<div>• ${esc(x)}</div>`).join("")}</details>` : ""}
      </article>`).join("")}</div>`;
    $$(".interview-select").forEach(button => { button.onclick = () => selectInterviewQuestion(Number(button.dataset.interviewIndex)); });
    toast("5 interview questions generated.", "success");
  } catch (error) {
    interviewQuestions = [];
    currentInterview = null;
    const output = $("#interviewQuestion");
    if (output) output.innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`;
  } finally {
    setBusy(button, false);
  }
}

function selectInterviewQuestion(index) {
  if (!interviewQuestions[index]) return;
  currentInterviewIndex = index;
  currentInterview = interviewQuestions[index];
  if ($("#interviewAnswer")) $("#interviewAnswer").value = "";
  if ($("#interviewFeedback")) $("#interviewFeedback").innerHTML = "";
  $$(".interview-question-card").forEach(card => card.classList.toggle("active", Number(card.dataset.interviewIndex) === index));
  $$(".interview-select").forEach(button => { button.textContent = Number(button.dataset.interviewIndex) === index ? "Selected" : "Answer this"; });
}

async function evaluateInterview() {
  if (!currentInterview) return toast("Generate 5 interview questions first.", "error");
  const answer = $("#interviewAnswer")?.value.trim() || "";
  if (!answer) return toast("Write your answer first.", "error");
  const button = $("#evaluateAnswer");
  setBusy(button, true, "Evaluating…");
  try {
    const data = await api("/api/interview/evaluate", { method: "POST", body: JSON.stringify({ role: $("#interviewRole").value, question: currentInterview.question, answer }) });
    const result = data.result || {};
    $("#interviewFeedback").innerHTML = `<h3>Score: ${esc(result.scoreOutOf10 ?? "—")}/10</h3><h4>Strengths</h4>${(result.strengths || []).map((item) => `<div>• ${esc(item)}</div>`).join("")}<h4>Improvements</h4>${(result.improvements || []).map((item) => `<div>• ${esc(item)}</div>`).join("")}<h4>Improved answer</h4><p>${esc(result.improvedAnswer || "")}</p><h4>Follow-up</h4><p>${esc(result.followUpQuestion || "")}</p>`;
  } catch (error) { $("#interviewFeedback").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
  finally { setBusy(button, false); }
}

async function bootAuthenticatedApp() {
  setTutorMode(currentTutorMode);
  await Promise.all([loadDashboardSummary(), loadAdaptiveRecommendation(), loadTodos()]);
  await Promise.allSettled([status(), loadDashboardSummary(), loadTodos(), loadReminders()]);
  checkNotifications();
  clearInterval(window.smartStudyReminderTimer);
  window.smartStudyReminderTimer = setInterval(checkNotifications, 60000);
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const resetToken = hashParams.get("resetToken") || params.get("resetToken");
  if (resetToken) {
    $("#resetPanel").classList.remove("hidden");
    $("#resetToken").value = resetToken;
    toast("Password reset link loaded. Choose a new password.", "success");
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/([?&])resetToken=[^&]*/i, "").replace(/[?&]$/, "") );
    if (window.location.hash) window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
  if (params.get("google") === "connected") {
    toast("Google connected successfully.", "success");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function requestPasswordReset() {
  const email = $("#resetEmail").value.trim() || $("#authEmail").value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Enter the account email first.", "error");
  try {
    const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    $("#resetToken").value = data.resetToken || "";
    toast(data.resetToken ? "Reset token created. It expires in 15 minutes." : data.message, "success");
  } catch (error) { toast(friendlyError(error), "error"); }
}

async function performPasswordReset() {
  const tokenValue = $("#resetToken").value.trim();
  const password = $("#resetNewPassword").value;
  if (!tokenValue || password.length < 6) return toast("Enter the reset token and a password of at least 6 characters.", "error");
  try {
    await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: tokenValue, password }) });
    $("#resetPanel").classList.add("hidden");
    $("#authPassword").value = password;
    toast("Password reset. Sign in with your new password.", "success");
  } catch (error) { toast(friendlyError(error), "error"); }
}

async function generateAdaptivePlan() {
  const button = $("#adaptivePlanBtn"); setBusy(button, true, "Planning…");
  try {
    const subjects = $("#planSubjects").value.split(",").map(x => x.trim()).filter(Boolean);
    const weakTopics = $("#planWeakTopics").value.split(",").map(x => x.trim()).filter(Boolean);
    const data = await api("/api/study-plan/adaptive", { method: "POST", body: JSON.stringify({ goal: $("#planGoal").value.trim(), examDate: $("#planExamDate").value, availableHours: Number($("#planHours").value), subjects, weakTopics }) });
    const result = data.result || {};
    $("#adaptivePlanOutput").innerHTML = `<h3>${esc(result.overview || "Adaptive plan created")}</h3><div class="chips">${(result.priorities || []).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</div>${(result.days || []).slice(0, 14).map(d => `<article class="plan-day"><b>${esc(d.date || d.day || "Day")}: ${esc(d.subject || "Study")} · ${esc(d.topic || "Revision")}</b><small>${esc(d.reason || "")}</small><p>${(d.tasks || []).map(esc).join(" · ")}</p><span>${esc(d.durationMinutes || 0)} min</span></article>`).join("")}`;
    toast("Adaptive plan saved to your learning system.", "success");
  } catch (error) { $("#adaptivePlanOutput").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
  finally { setBusy(button, false); }
}

async function loadReminders() {
  try {
    const data = await api("/api/reminders");
    const list = data.reminders || [];
    $("#reminderList").innerHTML = list.length ? list.map(r => `<div class="list-item ${r.completed ? "done" : ""}"><b>${esc(r.title)}</b><small>${new Date(r.dueAt).toLocaleString()}</small><button class="icon-btn" data-reminder-id="${esc(r.id)}">✓</button></div>`).join("") : '<div class="empty-state">No reminders yet.</div>';
    $$('[data-reminder-id]').forEach(btn => btn.onclick = async () => { await api(`/api/reminders/${encodeURIComponent(btn.dataset.reminderId)}`, { method: "PATCH", body: JSON.stringify({ completed: true }) }); await loadReminders(); });
  } catch {}
}

async function addReminder() {
  try {
    const value = $("#reminderAt").value;
    if (!value) return toast("Choose a reminder time.", "error");
    await api("/api/reminders", { method: "POST", body: JSON.stringify({ title: $("#reminderTitle").value.trim(), dueAt: new Date(value).toISOString() }) });
    $("#reminderTitle").value = ""; $("#reminderAt").value = ""; await loadReminders(); toast("Reminder added.", "success");
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  } catch (error) { toast(friendlyError(error), "error"); }
}

async function checkNotifications() {
  if (!currentUser) return;
  try {
    const data = await api("/api/notifications/due");
    for (const item of data.notifications || []) {
      if (lastReminders.has(item.id)) continue;
      lastReminders.add(item.id);
      toast(`Reminder: ${item.title}`, "info");
      if ("Notification" in window && Notification.permission === "granted") new Notification("Smart Study AI", { body: item.title });
    }
  } catch {}
}

async function triageEmail() {
  const button = $("#triageMail"); setBusy(button, true, "AI triaging…");
  try {
    const data = await api("/api/gmail/triage", { method: "POST", body: JSON.stringify({ maxResults: 10 }) });
    const items = data.extracted || [];
    const deadlines = items.flatMap(x => x.deadlines || []).filter(x => x.date);
    $("#emailTriageOutput").innerHTML = `<h3>${esc(data.processed || 0)} emails analyzed</h3>${items.map(x => `<article class="mail-triage"><b>${esc(x.subject)}</b><small>${esc(x.category || "general")}</small><p>${esc(x.summary || "")}</p><div>${(x.tasks || []).map(t => `<span class="pill">Task: ${esc(t.title)}</span>`).join("")}</div>${(x.deadlines || []).map(d => `<span class="pill">Deadline: ${esc(d.title)} · ${esc(d.date)}</span>`).join("")}</article>`).join("")}${deadlines.length ? `<button id="triageCalendarBtn" class="secondary">Create ${deadlines.length} calendar events</button>` : ""}`;
    if (deadlines.length) $("#triageCalendarBtn").onclick = async () => { try { const out = await api("/api/gmail/triage-to-calendar", { method: "POST", body: JSON.stringify({ deadlines }) }); toast(`${out.created?.length || 0} calendar events created.`, "success"); } catch (error) { toast(friendlyError(error), "error"); } };
    await loadTodos();
  } catch (error) { $("#emailTriageOutput").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
  finally { setBusy(button, false); }
}

function renderRoomShared(room) {
  const docs = room.documents || []; const quizzes = room.quizzes || [];
  $("#roomSharedContent").innerHTML = `<h3>Shared documents</h3>${docs.length ? docs.map(d => `<div class="list-item"><b>${esc(d.title)}</b><small>${esc(d.documentId)}</small></div>`).join("") : '<p class="muted">No shared documents.</p>'}<h3>Shared quizzes</h3>${quizzes.length ? quizzes.slice().reverse().map(q => `<div class="list-item"><b>${esc(q.topic)}</b><small>${q.questions?.length || 0} questions</small></div>`).join("") : '<p class="muted">No shared quizzes.</p>'}`;
}

async function shareRoomDocument() {
  if (!lastRoomId) return toast("Join a room first.", "error");
  const id = $("#roomDocumentId").value.trim(); if (!id) return toast("Enter a document ID.", "error");
  try { const data = await api(`/api/rooms/${encodeURIComponent(lastRoomId)}/documents`, { method: "POST", body: JSON.stringify({ documentId: id, title: $("#roomDocumentTitle").value.trim() || "Shared document" }) }); renderRoomShared(data); } catch (error) { toast(friendlyError(error), "error"); }
}

async function createRoomQuiz() {
  if (!lastRoomId) return toast("Join a room first.", "error");
  try { const data = await api(`/api/rooms/${encodeURIComponent(lastRoomId)}/quizzes`, { method: "POST", body: JSON.stringify({ topic: $("#roomQuizTopic").value.trim() || "General study", count: 5 }) }); renderRoomShared({ documents: [], quizzes: [data.quiz] }); toast("Shared quiz created.", "success"); } catch (error) { toast(friendlyError(error), "error"); }
}

async function askRoomTutor() {
  if (!lastRoomId) return toast("Join a room first.", "error");
  const question = window.prompt("What should the room AI explain?"); if (!question) return;
  try { const data = await api(`/api/rooms/${encodeURIComponent(lastRoomId)}/tutor`, { method: "POST", body: JSON.stringify({ question }) }); $("#roomSharedContent").insertAdjacentHTML("afterbegin", `<article class="ai-callout"><b>Room AI</b><p>${esc(data.answer?.answer || "")}</p>${(data.answer?.keyPoints || []).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</article>`); } catch (error) { toast(friendlyError(error), "error"); }
}

async function generateVideoLesson() {
  const button = $("#generateVideoBtn");
  const topic = $("#videoQuery").value.trim();
  const material = $("#videoMaterial").value.trim();
  if (!topic && !material) return toast("Enter a topic or paste study material first.", "error");
  setBusy(button, true, "Creating lesson…");
  try {
    const data = await api("/api/videos/generate", { method: "POST", body: JSON.stringify({ topic, material, language: currentUser?.preferredLanguage || "English" }) });
    renderLessonPlayer(data.lesson); toast("Interactive AI lesson created.", "success");
  } catch (error) { $("#generatedVideo").innerHTML = `<div class="error-card">${esc(friendlyError(error))}</div>`; }
  finally { setBusy(button, false); }
}

function renderLessonPlayer(lesson) {
  let index = 0;
  const slides = Array.isArray(lesson.slides) && lesson.slides.length ? lesson.slides : [{ title: lesson.title || "AI lesson", body: lesson.script || "" }];
  const render = () => {
    const slide = slides[index];
    $("#generatedVideo").innerHTML = `<div class="lesson-stage"><div class="lesson-stage-top"><span class="eyebrow">LLM LESSON · ${index + 1}/${slides.length}</span><span class="trust-badge">Generated from your topic/material</span></div><h2>${esc(slide.title || lesson.title)}</h2><div class="lesson-body">${renderMarkdown(slide.body || "")}</div><div class="lesson-controls"><button id="lessonPrev" class="secondary" ${index === 0 ? "disabled" : ""}>← Previous</button><button id="lessonCopy" class="secondary">Copy slide</button><button id="lessonSpeak" class="primary">🔊 Narrate</button><button id="lessonNext" class="secondary" ${index === slides.length - 1 ? "disabled" : ""}>Next →</button></div></div><div class="lesson-objectives"><b>Learning objectives</b><div class="chips">${(lesson.learningObjectives || []).map(x => `<span class="pill">${esc(x)}</span>`).join("")}</div></div>`;
    $("#lessonPrev").onclick = () => { index = Math.max(0, index - 1); render(); };
    $("#lessonNext").onclick = () => { index = Math.min(slides.length - 1, index + 1); render(); };
    $("#lessonSpeak").onclick = () => speakText(slide.body || lesson.script || "");
    $("#lessonCopy").onclick = async () => { try { await navigator.clipboard.writeText(`${slide.title || lesson.title}\n\n${slide.body || ""}`); $("#lessonCopy").textContent = "Copied"; setTimeout(() => $("#lessonCopy").textContent = "Copy slide", 1400); } catch { toast("Copy is unavailable in this browser.", "error"); } };
  };
  render();
}

async function runCode() {
  const button = $("#runCode"); setBusy(button, true, "Running…");
  try { const data = await api("/api/coding/run", { method: "POST", body: JSON.stringify({ language: $("#codeLanguage").value, code: $("#codeInput").value }) }); $("#runOutput").textContent = `${data.stdout || ""}${data.stderr ? `\n${data.stderr}` : ""}` || "Process completed with no output."; } catch (error) { $("#runOutput").textContent = friendlyError(error); } finally { setBusy(button, false); }
}

function bindEvents() {
  $$(".nav").forEach((button) => button.addEventListener("click", () => go(button.dataset.section)));
  $$('[data-go]').forEach((button) => button.addEventListener("click", () => go(button.dataset.go)));
  $("#loginTab").onclick = () => setAuthMode("login");
  $("#forgotPasswordBtn").onclick = () => $("#resetPanel").classList.toggle("hidden");
  $("#requestReset").onclick = requestPasswordReset;
  $("#resetPasswordBtn").onclick = performPasswordReset;
  $("#registerTab").onclick = () => setAuthMode("register");
  $("#authForm").onsubmit = submitAuth;
  $("#togglePassword").onclick = () => {
    const field = $("#authPassword");
    field.type = field.type === "password" ? "text" : "password";
    $("#togglePassword").textContent = field.type === "password" ? "Show" : "Hide";
  };
  $("#logout").onclick = logout;
  $("#themeToggle").onclick = () => {
    const light = !document.body.classList.contains("light");
    localStorage.setItem("theme", light ? "light" : "dark");
    applyTheme();
  };
  $("#mobileMenuToggle").onclick = () => $("#mobileNav").classList.toggle("open");
  $("#refreshDashboard").onclick = () => Promise.all([loadDashboardSummary(), loadAdaptiveRecommendation(), loadTodos()]);
  $("#adaptiveRefreshBtn").onclick = loadAdaptiveRecommendation;
  $("#adaptiveNextPackBtn").onclick = generateAdaptiveNextPack;
  $("#openDashboardPage").onclick = () => { window.location.href = "/dashboard.html"; };
  $("#todoForm").onsubmit = submitTodo;
  $("#refreshTodosBtn").onclick = loadTodos;
  $("#sendBtn").onclick = sendChat;
  if ($("#chatImageInput")) $("#chatImageInput").onchange = (event) => {
    const file = event.target.files?.[0] || null;
    selectedChatImage = file && String(file.type || "").startsWith("image/") && file.size <= 10 * 1024 * 1024 ? file : null;
    if (file && !selectedChatImage) toast(file.size > 10 * 1024 * 1024 ? "Image must be smaller than 10 MB." : "Please choose an image file.", "error");
    const preview = $("#imagePreviewName");
    if (preview) preview.textContent = selectedChatImage ? selectedChatImage.name : "";
  };
  $("#userInput").onkeydown = (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); } };
  $("#analyzeBtn").onclick = generateStudyPack;
  $("#adaptivePlanBtn").onclick = generateAdaptivePlan;
  $("#refreshFlashcards").onclick = loadFlashcards;
  $("#refreshQuizzes").onclick = loadQuizzes;
  $("#refreshQuizInsights").onclick = loadQuizAnalytics;
  $("#reviewDueOnly").onclick = () => { flashcardFilter = "due"; $("#reviewDueOnly").classList.add("active-filter"); $("#reviewAllCards").classList.remove("active-filter"); loadFlashcards(); };
  $("#reviewAllCards").onclick = () => { flashcardFilter = "all"; $("#reviewAllCards").classList.add("active-filter"); $("#reviewDueOnly").classList.remove("active-filter"); loadFlashcards(); };
  $("#addReminder").onclick = addReminder;
  $("#triageMail").onclick = triageEmail;
  $("#shareRoomDocument").onclick = shareRoomDocument;
  $("#createRoomQuiz").onclick = createRoomQuiz;
  $("#askRoomTutor").onclick = askRoomTutor;
  $("#generateVideoBtn").onclick = generateVideoLesson;
  $("#runCode").onclick = runCode;
  $$(`[data-tutor-mode]`).forEach((button) => button.onclick = () => { setTutorMode(button.dataset.tutorMode); go("tutor"); });
  $("#connectGmail").onclick = () => connectGoogle("gmail");
  $("#connectCalendar").onclick = () => connectGoogle("calendar");
  $("#loadMail").onclick = loadMail;
  $("#sendMail").onclick = sendMail;
  $("#loadEvents").onclick = loadEvents;
  $("#createEvent").onclick = createEvent;
  $("#researchBtn").onclick = research;
  $("#createRoom").onclick = createRoom;
  $("#joinRoom").onclick = () => joinRoom($("#roomCode").value);
  $("#sendRoomMessage").onclick = sendRoomMessage;
  $("#roomMessage").onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); sendRoomMessage(); } };
  $("#sharedNotes").oninput = () => { clearTimeout(noteTimer); noteTimer = setTimeout(sendSharedNotes, 250); };
  $("#voiceStart").onclick = startRecognition;
  $("#micBtn").onclick = startRecognition;
  $("#voiceSpeakLast").onclick = () => speakText(lastAiAnswer);
  $("#videoBtn").onclick = searchVideos;
  $$(".tab").forEach((tab) => tab.onclick = () => {
    $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab.dataset.tab));
  });
  $("#solveCode").onclick = solveCode;
  $("#newQuestion").onclick = newInterviewQuestion;
  $("#evaluateAnswer").onclick = evaluateInterview;
}

async function init() {
  applyTheme();
  bindEvents();
  setAuthMode("login");
  await validateSession();
  if (currentUser) await bootAuthenticatedApp();
}

document.addEventListener("DOMContentLoaded", init);