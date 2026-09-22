const { GeminiProvider, OpenAIProvider, GroqProvider } = require("./providers.cjs");

function isQuotaOrRateLimit(error) {
  return Number(error?.status) === 429 || /resource_exhausted|quota|rate.?limit|too many requests/i.test(String(error?.message || ""));
}

function isRetryable(error) {
  if (isQuotaOrRateLimit(error)) return false;
  const status = Number(error?.status);
  return !status || status >= 500 || status === 408 || status === 425;
}

class AIGateway {
  constructor() {
    this.providers = {
      gemini: new GeminiProvider(),
      openai: new OpenAIProvider(),
      groq: new GroqProvider()
    };

    // Use the configured Gemini model consistently unless a slot explicitly overrides it.
    // This prevents one request from unexpectedly fanning out across several unavailable/limited models.
    const geminiModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    this.usage = { requests: 0, estimatedUsd: 0, byProvider: {} };
    this.budgets = new Map();
    this.defaultBudgetUsd = Number.isFinite(Number(process.env.AI_BUDGET_USD_PER_SESSION)) ? Math.max(0, Number(process.env.AI_BUDGET_USD_PER_SESSION)) : Infinity;
    this.pricing = {
      gemini: { input: Number(process.env.GEMINI_INPUT_USD_PER_1K || 0.0002), output: Number(process.env.GEMINI_OUTPUT_USD_PER_1K || 0.0008) },
      openai: { input: Number(process.env.OPENAI_INPUT_USD_PER_1K || 0.001), output: Number(process.env.OPENAI_OUTPUT_USD_PER_1K || 0.004) },
      groq: { input: Number(process.env.GROQ_INPUT_USD_PER_1K || 0.0002), output: Number(process.env.GROQ_OUTPUT_USD_PER_1K || 0.0006) }
    };
    this.modelProfiles = {
      gemini: { quality: 3, speed: 2, vision: true },
      openai: { quality: 3, speed: 2, vision: Boolean(process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL) },
      groq: { quality: 2, speed: 3, vision: Boolean(process.env.GROQ_VISION_MODEL) }
    };

    this.modelSlots = {
      router: { provider: process.env.ROUTER_PROVIDER || "gemini", model: process.env.ROUTER_MODEL || geminiModel },
      researcher: { provider: process.env.RESEARCHER_PROVIDER || "gemini", model: process.env.RESEARCHER_MODEL || geminiModel },
      teacher: { provider: process.env.TEACHER_PROVIDER || "gemini", model: process.env.TEACHER_MODEL || geminiModel },
      reasoner: { provider: process.env.REASONER_PROVIDER || "gemini", model: process.env.REASONER_MODEL || geminiModel },
      critic: { provider: process.env.CRITIC_PROVIDER || "gemini", model: process.env.CRITIC_MODEL || geminiModel },
      synthesizer: { provider: process.env.SYNTHESIZER_PROVIDER || "gemini", model: process.env.SYNTHESIZER_MODEL || geminiModel }
    };
    this.modelRegistry = {};
    for (const provider of ["gemini", "openai", "groq"]) {
      const model = this.defaultModel(provider);
      this.modelRegistry[model] = {
        provider,
        input: Number(process.env[`${provider.toUpperCase()}_${model.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_INPUT_USD_PER_1K`] || this.pricing[provider].input),
        output: Number(process.env[`${provider.toUpperCase()}_${model.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_OUTPUT_USD_PER_1K`] || this.pricing[provider].output),
        quality: this.modelProfiles[provider].quality,
        speed: this.modelProfiles[provider].speed,
        vision: this.modelProfiles[provider].vision
      };
    }
  }

  getProvider(name) {
    const provider = this.providers[name];
    if (!provider) throw new Error(`Unknown AI provider: ${name}`);
    if (provider.available && !provider.available()) {
      const error = new Error(`${name} provider is not configured.`);
      error.code = "PROVIDER_NOT_CONFIGURED";
      throw error;
    }
    return provider;
  }

  resolveSlot(slot) { return this.modelSlots[slot] || null; }

  async _generateOnce(options = {}) {
    const slot = options.slot;
    const selected = slot ? this.resolveSlot(slot) : null;
    const providerName = options.provider || selected?.provider || this.chooseCostAwareProvider({ ...options, budgetKey: this.budgetKey(options) });
    const provider = this.getProvider(providerName);
    const model = options.model || selected?.model;
    const started = Date.now();
    const maxRetries = Math.max(0, Math.min(Number(options.maxRetries ?? process.env.AI_MAX_RETRIES ?? 1), 3));
    const requestedBudget = Number.isFinite(Number(options.budgetUsd)) ? Math.max(0, Number(options.budgetUsd)) : Infinity;
    const budgetUsd = this.defaultBudgetUsd === Infinity ? requestedBudget : Math.min(requestedBudget, this.defaultBudgetUsd);
    const effectiveBudgetUsd = budgetUsd === Infinity && process.env.AI_COST_AWARE_ROUTING !== "true" ? Infinity : budgetUsd;
    const expectedOutputTokens = Math.max(1, Number(options.maxOutputTokens || 600));
    const estimatedRequestCost = this.estimateCost(providerName, options.prompt || "", expectedOutputTokens, model);
    const budgetKey = this.budgetKey(options);
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let reservation;
      try {
        reservation = this.reserveBudget(budgetKey, effectiveBudgetUsd, estimatedRequestCost);
        const timeoutMs = Math.max(3000, Number(process.env.AI_PROVIDER_TIMEOUT_MS || 4000));
        const result = await Promise.race([
          provider.generate({ ...options, model }),
          new Promise((_, reject) => setTimeout(() => {
            const timeoutError = new Error(`${providerName} provider request timed out after ${timeoutMs}ms.`);
            timeoutError.status = 504;
            timeoutError.code = "AI_PROVIDER_TIMEOUT";
            timeoutError.provider = providerName;
            reject(timeoutError);
          }, timeoutMs))
        ]);
        const cost = this.recordUsage(providerName, result, options.prompt || "");
        this.settleBudget(budgetKey, reservation, cost);
        return {
          ...result,
          estimatedCostUsd: cost,
          latencyMs: Date.now() - started,
          slot: slot || null,
          attempts: attempt + 1,
          estimatedCostTier: this.costTier(slot || providerName)
        };
      } catch (error) {
        if (reservation) this.releaseBudget(budgetKey, reservation);
        if (error?.code === "AI_BUDGET_EXCEEDED") throw error;
        lastError = error;
        if (!isRetryable(error) || attempt >= maxRetries) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
      }
    }
    throw lastError;
  }

  async generate(options = {}) {
    const selected = options.slot ? this.resolveSlot(options.slot) : null;
    const primaryProvider = options.provider || selected?.provider || this.chooseCostAwareProvider({ ...options, budgetKey: this.budgetKey(options) });
    const primaryOptions = {
      ...options,
      provider: primaryProvider,
      model: options.model || selected?.model
    };

    try {
      return await this._generateOnce(primaryOptions);
    } catch (primaryError) {
      if (primaryError?.code === "AI_BUDGET_EXCEEDED" || options.disableFallback === true) throw primaryError;

      const fallbackErrors = [];
      for (const provider of this.fallbackProviders(primaryProvider)) {
        try {
          return await this._generateOnce({
            ...options,
            provider,
            model: options.fallbackModels?.[provider] || this.defaultModel(provider),
            slot: null,
            maxRetries: 0,
            disableFallback: true
          });
        } catch (fallbackError) {
          fallbackErrors.push({
            provider,
            status: Number(fallbackError?.status) || null,
            code: fallbackError?.code || null,
            message: fallbackError?.message || String(fallbackError)
          });
        }
      }

      const error = new Error(primaryError?.message || "AI provider request failed.");
      const primaryWasQuota = isQuotaOrRateLimit(primaryError);
      error.status = fallbackErrors.length ? 503 : (Number(primaryError?.status) || (primaryWasQuota ? 429 : 503));
      error.code = fallbackErrors.length ? "AI_PROVIDER_UNAVAILABLE" : (primaryError?.code || (primaryWasQuota ? "AI_QUOTA_EXHAUSTED" : "AI_PROVIDER_UNAVAILABLE"));
      error.provider = primaryProvider;
      error.primaryError = primaryError?.message || String(primaryError);
      error.fallbacksTried = fallbackErrors;
      throw error;
    }
  }

  budgetKey(options = {}) {
    const explicit = String(options.budgetKey || "").trim();
    if (explicit) return explicit.slice(0, 300);
    const userId = String(options.userId || "anonymous").trim() || "anonymous";
    const sessionId = String(options.sessionId || "default").trim() || "default";
    return `${userId}:${sessionId}`.slice(0, 300);
  }

  reserveBudget(key, budgetUsd, amount) {
    if (process.env.AI_HARD_BUDGET === "false" || budgetUsd === Infinity) return null;
    const cap = Math.max(0, Number(budgetUsd));
    const requested = Math.max(0, Number(amount) || 0);
    const current = this.budgets.get(key) || { reservedUsd: 0, actualUsd: 0, requests: 0 };
    const remaining = Math.max(0, cap - current.actualUsd - current.reservedUsd);
    if (requested > remaining + 1e-12) {
      const error = new Error(`Estimated AI request cost $${requested.toFixed(6)} exceeds the remaining budget $${remaining.toFixed(6)}.`);
      error.code = "AI_BUDGET_EXCEEDED";
      error.status = 402;
      error.provider = key;
      throw error;
    }
    const reservation = { amount: requested, id: `${Date.now()}_${Math.random().toString(36).slice(2)}` };
    current.reservedUsd += requested;
    current.requests += 1;
    this.budgets.set(key, current);
    return reservation;
  }

  settleBudget(key, reservation, actualCost) {
    if (!reservation) return;
    const current = this.budgets.get(key) || { reservedUsd: 0, actualUsd: 0, requests: 0 };
    current.reservedUsd = Math.max(0, current.reservedUsd - reservation.amount);
    current.actualUsd += Math.max(0, Number(actualCost) || 0);
    this.budgets.set(key, current);
  }

  releaseBudget(key, reservation) {
    if (!reservation) return;
    const current = this.budgets.get(key);
    if (!current) return;
    current.reservedUsd = Math.max(0, current.reservedUsd - reservation.amount);
    this.budgets.set(key, current);
  }

  accountSnapshot(key) {
    const current = this.budgets.get(String(key)) || { reservedUsd: 0, actualUsd: 0, requests: 0 };
    const budgetUsd = this.defaultBudgetUsd === Infinity ? null : this.defaultBudgetUsd;
    return { budgetUsd, reservedUsd: Number(current.reservedUsd.toFixed(8)), actualUsd: Number(current.actualUsd.toFixed(8)), requests: current.requests, remainingUsd: budgetUsd === null ? null : Number(Math.max(0, budgetUsd - current.actualUsd - current.reservedUsd).toFixed(8)) };
  }

  estimateTokens(text = "") { return Math.max(1, Math.ceil(String(text).length / 4)); }
  estimateCost(provider, prompt = "", outputTokens = 600, model = null) {
    const rate = model && this.modelRegistry[model] ? this.modelRegistry[model] : (this.pricing[provider] || { input: 0, output: 0 });
    return (this.estimateTokens(prompt) / 1000) * rate.input + (Math.max(1, Number(outputTokens) || 600) / 1000) * rate.output;
  }

  recordUsage(provider, result, prompt) {
    const usage = result?.usage || {};
    const inputTokens = Number(usage.promptTokenCount ?? usage.prompt_tokens ?? usage.input_tokens ?? this.estimateTokens(prompt));
    const outputTokens = Number(usage.candidatesTokenCount ?? usage.completion_tokens ?? usage.output_tokens ?? this.estimateTokens(result?.text || ""));
    const rates = result?.model && this.modelRegistry[result.model] ? this.modelRegistry[result.model] : (this.pricing[provider] || { input: 0, output: 0 });
    const usd = (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
    this.usage.requests += 1;
    this.usage.estimatedUsd += usd;
    this.usage.byProvider[provider] = (this.usage.byProvider[provider] || 0) + usd;
    return Number(usd.toFixed(8));
  }

  chooseCostAwareProvider({ task = "general", preferredProvider, budgetUsd, prompt = "", expectedOutputTokens = 600, vision = false, budgetKey = "anonymous:default" } = {}) {
    const configured = ["gemini", "openai", "groq"].filter((name) => this.providers[name]?.available() && (!vision || this.modelProfiles[name]?.vision));
    if (!configured.length) {
      const error = new Error(vision ? "No configured multimodal AI provider is available." : "No configured AI provider is available.");
      error.code = vision ? "NO_VISION_PROVIDER" : "NO_AI_PROVIDER";
      error.status = 503;
      throw error;
    }

    const taskName = String(task || "general").toLowerCase();
    const qualityNeeded = ["reasoning", "study", "review", "coding", "interview", "research"].some((x) => taskName.includes(x)) ? 2 : 1;
    const inputTokens = this.estimateTokens(prompt);
    const outputTokens = Math.max(1, Number(expectedOutputTokens) || 600);
    const requestedBudget = Number.isFinite(Number(budgetUsd)) ? Math.max(0, Number(budgetUsd)) : Infinity;
    const budget = this.defaultBudgetUsd === Infinity ? requestedBudget : Math.min(requestedBudget, this.defaultBudgetUsd);
    const account = this.budgets.get(String(budgetKey)) || { reservedUsd: 0, actualUsd: 0 };
    const remaining = budget === Infinity ? Infinity : Math.max(0, budget - account.actualUsd - account.reservedUsd);
    const candidates = configured.map((provider) => {
      const profile = this.modelProfiles[provider] || { quality: 1, speed: 1, vision: false };
      const model = vision ? this.defaultVisionModel(provider) : this.defaultModel(provider);
      const estimatedCost = this.estimateCost(provider, prompt, outputTokens, model);
      return { provider, model, estimatedCost, ...profile, inputTokens, outputTokens };
    });
    const qualityCandidates = candidates.filter((x) => x.quality >= qualityNeeded);
    const pool = qualityCandidates.length ? qualityCandidates : candidates;
    const affordable = pool.filter((x) => x.estimatedCost <= remaining);
    if (!affordable.length && process.env.AI_HARD_BUDGET !== "false" && remaining !== Infinity) {
      const cheapest = [...pool].sort((a,b)=>a.estimatedCost-b.estimatedCost)[0];
      const error = new Error(`No ${vision ? "multimodal " : ""}model can satisfy the remaining AI budget. Cheapest estimate is $${cheapest.estimatedCost.toFixed(6)}.`);
      error.code = "AI_BUDGET_EXCEEDED";
      error.status = 402;
      throw error;
    }
    const usable = affordable.length ? affordable : pool;
    usable.sort((a,b) => ((a.estimatedCost*1000)+(qualityNeeded-a.quality)*10-a.speed*0.1) - ((b.estimatedCost*1000)+(qualityNeeded-b.quality)*10-b.speed*0.1));
    const best = usable[0];
    const tied = usable.filter((x) => Math.abs(x.estimatedCost-best.estimatedCost) < Math.max(0.000001,best.estimatedCost*0.05) && x.quality >= best.quality);
    return preferredProvider && tied.some((x)=>x.provider===preferredProvider) ? preferredProvider : best.provider;
  }

  costTier(slot) {
    const map = { teacher: "low", critic: "low", router: "low", researcher: "medium", reasoner: "medium", synthesizer: "high", gemini: "medium", openai: "medium", groq: "low" };
    return map[slot] || "medium";
  }

  routeSpecialists({ difficulty = "medium", maxAgents = 3, budgetUsd } = {}) {
    if (Number.isFinite(Number(budgetUsd)) && Number(budgetUsd) <= 0.01) return ["teacher"].slice(0, maxAgents);
    if (difficulty === "easy") return ["teacher"].slice(0, maxAgents);
    if (difficulty === "hard") return ["researcher", "teacher", "reasoner"].slice(0, maxAgents);
    return ["researcher", "teacher"].slice(0, maxAgents);
  }

  defaultModel(provider) {
    return {
      gemini: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      openai: process.env.OPENAI_MODEL || "gpt-5-mini",
      groq: process.env.GROQ_MODEL || "openai/gpt-oss-120b"
    }[provider];
  }
  defaultVisionModel(provider) {
    return {
      gemini: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-3.6-flash",
      openai: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
      groq: process.env.GROQ_VISION_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b"
    }[provider];
  }

  fallbackProviders(selectedProvider) {
    const configured = String(process.env.AI_FALLBACK_PROVIDERS || "gemini,openai,groq")
      .split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    return [...new Set(configured)].filter((provider) => provider !== selectedProvider && this.providers[provider]?.available());
  }

  async generateSlot(slot, options = {}) {
    const selected = this.resolveSlot(slot);
    if (!selected) throw new Error(`Unknown model slot: ${slot}`);

    const costAware = process.env.AI_COST_AWARE_ROUTING === "true" || Number.isFinite(Number(options.budgetUsd));
    const budgetUsd = Number.isFinite(Number(options.budgetUsd)) ? Number(options.budgetUsd) : Number(process.env.AI_BUDGET_USD_PER_SESSION || Infinity);
    const budgetKey = this.budgetKey(options);

    if (costAware) {
      const routedProvider = this.chooseCostAwareProvider({
        task: options.task || slot,
        preferredProvider: selected.provider,
        budgetUsd,
        prompt: options.prompt || "",
        expectedOutputTokens: options.maxOutputTokens || 600,
        budgetKey
      });
      return this.generate({
        ...options,
        budgetKey,
        slot: null,
        provider: routedProvider,
        model: options.model || this.defaultModel(routedProvider)
      });
    }

    return this.generate({ ...options, budgetKey, slot });
  }

  async generateMany(slots, optionsFactory) {
    const results = await Promise.allSettled(slots.map((slot) =>
      this.generateSlot(slot, typeof optionsFactory === "function" ? optionsFactory(slot) : optionsFactory)
    ));

    return results.map((item, index) => item.status === "fulfilled"
      ? { slot: slots[index], ok: true, ...item.value }
      : { slot: slots[index], ok: false, error: item.reason?.message || String(item.reason) }
    );
  }

  chooseProvider({ task = "general", preferredProvider } = {}) {
    if (preferredProvider && this.providers[preferredProvider]?.available()) return preferredProvider;
    if (task === "reasoning" && this.providers.groq.available()) return "groq";
    if (task === "review" && this.providers.groq.available()) return "groq";
    if (this.providers.gemini.available()) return "gemini";
    if (this.providers.openai.available()) return "openai";
    if (this.providers.groq.available()) return "groq";
    const error = new Error("No AI provider is configured. Add GEMINI_API_KEY, OPENAI_API_KEY or GROQ_API_KEY to Backend/.env.");
    error.code = "NO_AI_PROVIDER";
    error.status = 503;
    throw error;
  }

  async extractImage({ data, mimeType, prompt = "Explain this image for my studies.", tutorMode = "normal", budgetUsd, userId = "anonymous", sessionId = "default", budgetKey }) {
    const key = budgetKey || `${String(userId)}:${String(sessionId)}`;
    const configuredVision = ["gemini", "openai", "groq"].filter((name) => this.providers[name]?.available() && this.modelProfiles[name]?.vision);
    if (!configuredVision.length) {
      const error = new Error("No configured multimodal AI provider is available.");
      error.code = "NO_VISION_PROVIDER";
      error.status = 503;
      throw error;
    }

    const preferred = this.chooseCostAwareProvider({
      task: "multimodal study",
      preferredProvider: "gemini",
      budgetUsd,
      prompt,
      expectedOutputTokens: 800,
      vision: true,
      budgetKey: key
    });
    const providers = [preferred, ...configuredVision.filter((name) => name !== preferred)];
    const errors = [];

    for (const providerName of providers) {
      const provider = this.getProvider(providerName);
      const model = this.defaultVisionModel(providerName);
      const estimated = this.estimateCost(providerName, prompt, 800, model);
      const requestedBudget = Number.isFinite(Number(budgetUsd)) ? Math.max(0, Number(budgetUsd)) : Infinity;
      const imageBudget = this.defaultBudgetUsd === Infinity ? requestedBudget : Math.min(requestedBudget, this.defaultBudgetUsd);
      let reservation;
      try {
        reservation = this.reserveBudget(key, imageBudget, estimated);
        const timeoutMs = Math.max(3000, Number(process.env.AI_PROVIDER_TIMEOUT_MS || 4000));
        const result = await Promise.race([
          provider.generateImageExtraction({ data, mimeType, model, prompt, tutorMode }),
          new Promise((_, reject) => setTimeout(() => {
            const timeoutError = new Error(`${providerName} vision request timed out after ${timeoutMs}ms.`);
            timeoutError.status = 504;
            timeoutError.code = "AI_PROVIDER_TIMEOUT";
            timeoutError.provider = providerName;
            reject(timeoutError);
          }, timeoutMs))
        ]);
        const cost = this.recordUsage(providerName, result, prompt);
        this.settleBudget(key, reservation, cost);
        return { ...result, provider: providerName, model, estimatedCostUsd: cost };
      } catch (error) {
        if (reservation) this.releaseBudget(key, reservation);
        if (error?.code === "AI_BUDGET_EXCEEDED") throw error;
        errors.push({ provider: providerName, status: Number(error?.status) || null, message: error?.message || String(error) });
      }
    }

    const error = new Error(errors[0]?.message || "No multimodal AI provider could complete the request.");
    error.status = 503;
    error.code = "AI_PROVIDER_UNAVAILABLE";
    error.provider = preferred;
    error.fallbacksTried = errors;
    throw error;
  }

  async embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
    if (this.providers.gemini.available()) {
      try {
        return await this.providers.gemini.embed(texts, taskType);
      } catch (error) {
        // Existing local/Qdrant vectors were created with Gemini embeddings.
        // Do not silently mix a different embedding space into the same index.
        if (!isQuotaOrRateLimit(error)) throw error;
        const fallback = new Error("Gemini embeddings are currently unavailable. Existing document vectors require Gemini embeddings; retry after Gemini quota resets.");
        fallback.status = 503;
        fallback.code = "EMBEDDING_PROVIDER_UNAVAILABLE";
        fallback.provider = "gemini";
        throw fallback;
      }
    }
    const error = new Error("Gemini embeddings are required for the current document index. Configure GEMINI_API_KEY or rebuild the index with another embedding provider.");
    error.status = 503;
    error.code = "EMBEDDING_PROVIDER_UNAVAILABLE";
    error.provider = "gemini";
    throw error;
  }

  status() {
    return {
      providers: {
        gemini: this.providers.gemini.available(),
        openai: this.providers.openai.available(),
        groq: this.providers.groq.available()
      },
      models: this.modelSlots,
      generationModel: this.modelSlots.synthesizer.model,
      embeddingModel: this.providers.gemini.embeddingModel,
      councilSize: Object.keys(this.modelSlots).length,
      fallbackProviders: this.fallbackProviders(""),
      pricing: this.pricing
    };
  }
}

module.exports = { AIGateway };
