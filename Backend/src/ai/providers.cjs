const { GoogleGenAI } = require("@google/genai");

function providerError(provider, status, message, code = null) {
  const error = new Error(message || `${provider} request failed (${status}).`);
  error.status = Number(status) || 500;
  error.provider = provider;
  error.code = code || (error.status === 429 ? "AI_QUOTA_EXHAUSTED" : "AI_PROVIDER_ERROR");
  return error;
}

function apiError(provider, response, payload, fallback) {
  const status = Number(response?.status) || 500;
  const message = payload?.error?.message || payload?.message || fallback;
  return providerError(provider, status, message);
}

function markGeminiError(error) {
  const message = String(error?.message || error || "Gemini request failed.");
  const status = Number(error?.status || error?.statusCode) || (/RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(message) ? 429 : 500);
  error.status = status;
  error.provider = "gemini";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(message)) {
    error.code = "AI_QUOTA_EXHAUSTED";
  } else if (!error.code) {
    error.code = "AI_PROVIDER_ERROR";
  }
  return error;
}

class GeminiProvider {
  constructor() {
    this.name = "gemini";
    this.model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    this.embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  available() {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async generate({ prompt, schema, json = false, model, temperature, thinkingLevel, tools, systemInstruction }) {
    if (!this.available()) throw providerError(this.name, 503, "GEMINI_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");

    const config = {};
    if (schema) {
      config.responseMimeType = "application/json";
      config.responseSchema = schema;
    } else if (json) {
      config.responseMimeType = "application/json";
    }
    if (tools) config.tools = tools;
    if (systemInstruction) config.systemInstruction = systemInstruction;

    try {
      const response = await this.ai.models.generateContent({
        model: model || this.model,
        contents: prompt,
        config
      });

      const text = response?.text?.trim();
      if (!text) throw providerError(this.name, 502, "Gemini returned an empty response.");

      const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk) => chunk?.web || chunk?.retrievedContext || null)
        .filter(Boolean)
        .map((item) => ({
          title: String(item.title || item.name || "Web source").trim(),
          url: String(item.uri || item.url || "").trim(),
          snippet: String(item.snippet || "").trim()
        }))
        .filter((item) => /^https?:\/\//i.test(item.url));

      return {
        text,
        provider: this.name,
        model: model || this.model,
        usage: response?.usageMetadata || null,
        sources,
        citations: sources.map((source, index) => ({ index: index + 1, title: source.title, url: source.url }))
      };
    } catch (error) {
      throw markGeminiError(error);
    }
  }

  async generateImageExtraction({ data, mimeType, model, prompt = "Explain this image for my studies.", tutorMode = "normal" }) {
    if (!this.available()) throw providerError(this.name, 503, "GEMINI_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");

    try {
      const response = await this.ai.models.generateContent({
        model: model || this.model,
        contents: [{
          parts: [
            { text: `${prompt}\nTutor mode: ${tutorMode}. Extract useful visual/educational information and answer from the image. Do not invent details that are not visible.` },
            { inlineData: { mimeType, data } }
          ]
        }]
      });
      const text = response?.text?.trim();
      if (!text) throw providerError(this.name, 502, "Gemini returned no text for the image.");
      return { text, provider: this.name, model: model || this.model, usage: response?.usageMetadata || null };
    } catch (error) {
      throw markGeminiError(error);
    }
  }

  async embed(texts, taskType = "RETRIEVAL_DOCUMENT") {
    if (!this.available()) throw providerError(this.name, 503, "GEMINI_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");
    const values = Array.isArray(texts) ? texts : [texts];
    const dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768);

    try {
      const response = await this.ai.models.embedContent({
        model: this.embeddingModel,
        contents: values,
        config: {
          taskType,
          outputDimensionality: dimensions
        }
      });
      return (response.embeddings || []).map((item) => item.values || []);
    } catch (error) {
      throw markGeminiError(error);
    }
  }
}

class OpenAIProvider {
  constructor() {
    this.name = "openai";
    this.model = process.env.OPENAI_MODEL || "gpt-5-mini";
    this.apiKey = process.env.OPENAI_API_KEY;
  }

  available() {
    return Boolean(this.apiKey);
  }

  async generate({ prompt, json = false, model }) {
    if (!this.available()) throw providerError(this.name, 503, "OPENAI_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");
    const body = {
      model: model || this.model,
      messages: [
        { role: "system", content: "You are a careful specialist in the Smart Study AI multi-model system." },
        { role: "user", content: prompt }
      ]
    };
    if (json) body.response_format = { type: "json_object" };

    let response;
    let data;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body)
      });
      data = await response.json();
    } catch (error) {
      error.provider = this.name;
      error.status = Number(error?.status) || 503;
      error.code = error.code || "AI_PROVIDER_ERROR";
      throw error;
    }

    if (!response.ok) throw apiError(this.name, response, data, `OpenAI request failed (${response.status}).`);
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw providerError(this.name, 502, "OpenAI returned an empty response.");
    return { text, provider: this.name, model: model || this.model, usage: data?.usage || null };
  }

  async generateImageExtraction({ data, mimeType, model, prompt = "Explain this image for my studies.", tutorMode = "normal" }) {
    if (!this.available()) throw providerError(this.name, 503, "OPENAI_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");
    const visionModel = model || process.env.OPENAI_VISION_MODEL || this.model;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: visionModel, messages: [{ role: "system", content: "You are a careful multimodal study tutor. Do not invent visual facts." }, { role: "user", content: [{ type: "text", text: `${prompt} Tutor mode: ${tutorMode}.` }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } }] }] })
    });
    const payload = await response.json();
    if (!response.ok) throw apiError(this.name, response, payload, `OpenAI vision request failed (${response.status}).`);
    const text = payload?.choices?.[0]?.message?.content?.trim();
    if (!text) throw providerError(this.name, 502, "OpenAI returned an empty vision response.");
    return { text, provider: this.name, model: visionModel, usage: payload?.usage || null };
  }
}

class GroqProvider {
  constructor() {
    this.name = "groq";
    this.model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    this.apiKey = process.env.GROQ_API_KEY;
  }

  available() {
    return Boolean(this.apiKey);
  }

  async generate({ prompt, json = false, model, reasoningEffort }) {
    if (!this.available()) throw providerError(this.name, 503, "GROQ_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");
    const body = {
      model: model || this.model,
      messages: [
        { role: "system", content: "You are a specialist in the Smart Study AI multi-model council." },
        { role: "user", content: prompt }
      ]
    };
    if (json) body.response_format = { type: "json_object" };
    if (reasoningEffort) body.reasoning_effort = reasoningEffort;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw apiError(this.name, response, data, `Groq request failed (${response.status}).`);
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw providerError(this.name, 502, "Groq returned an empty response.");
    return { text, provider: this.name, model: model || this.model, usage: data?.usage || null };
  }

  async generateImageExtraction({ data, mimeType, model, prompt = "Explain this image for my studies.", tutorMode = "normal" }) {
    if (!this.available()) throw providerError(this.name, 503, "GROQ_API_KEY is not configured.", "PROVIDER_NOT_CONFIGURED");
    const visionModel = model || process.env.GROQ_VISION_MODEL;
    if (!visionModel) throw providerError(this.name, 503, "GROQ_VISION_MODEL is not configured for image chat.", "VISION_MODEL_NOT_CONFIGURED");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: visionModel, messages: [{ role: "system", content: "You are a careful multimodal study tutor. Do not invent visual facts." }, { role: "user", content: [{ type: "text", text: `${prompt} Tutor mode: ${tutorMode}.` }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } }] }] })
    });
    const payload = await response.json();
    if (!response.ok) throw apiError(this.name, response, payload, `Groq vision request failed (${response.status}).`);
    const text = payload?.choices?.[0]?.message?.content?.trim();
    if (!text) throw providerError(this.name, 502, "Groq returned an empty vision response.");
    return { text, provider: this.name, model: visionModel, usage: payload?.usage || null };
  }
}

module.exports = { GeminiProvider, OpenAIProvider, GroqProvider };
