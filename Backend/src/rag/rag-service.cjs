const crypto = require("crypto");

function localEmbedding(text, dimensions = 768) {
  const vector = new Array(dimensions).fill(0);
  const tokens = String(text || "").toLowerCase().match(/[a-z0-9_]+/g) || [];
  if (!tokens.length) return vector;
  for (const token of tokens) {
    const digest = crypto.createHash("sha256").update(token).digest();
    for (let i = 0; i < 4; i++) {
      const index = digest.readUInt16BE(i * 2) % dimensions;
      const sign = digest[i + 8] % 2 === 0 ? 1 : -1;
      vector[index] += sign * (1 + Math.min(token.length, 12) / 12);
    }
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

class RAGService {
  constructor({ gateway, vectorStore }) { this.gateway = gateway; this.vectorStore = vectorStore; }

  chunkText(text, { chunkSize = 1200, overlap = 180 } = {}) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    const out = [];
    let start = 0;
    while (start < clean.length) {
      const end = Math.min(clean.length, start + chunkSize);
      const chunk = clean.slice(start, end).trim();
      if (chunk.length >= 40) out.push(chunk);
      if (end >= clean.length) break;
      start = Math.max(end - overlap, start + 1);
    }
    return out;
  }

  chunkSegments(segments, text) {
    const list = Array.isArray(segments) && segments.length ? segments : [{ text, metadata: {} }];
    const out = [];
    for (const segment of list) {
      for (const chunk of this.chunkText(segment.text)) {
        out.push({ text: chunk, metadata: { ...(segment.metadata || {}) } });
      }
    }
    return out;
  }

  async embedWithFallback(texts, taskType) {
    const values = Array.isArray(texts) ? texts : [texts];
    const dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768);
    // Local embeddings are the reliable default. Set USE_REMOTE_EMBEDDINGS=true
    // only when Gemini embeddings are intentionally available and reachable.
    if (process.env.USE_REMOTE_EMBEDDINGS !== "true") {
      return values.map((text) => localEmbedding(text, dimensions));
    }
    try {
      return await Promise.race([
        this.gateway.embed(values, taskType),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Remote embedding request timed out.")), Number(process.env.EMBEDDING_TIMEOUT_MS || 8000)))
      ]);
    } catch (error) {
      console.warn(`⚠️ Remote embeddings unavailable; using local deterministic embeddings: ${error.message}`);
      return values.map((text) => localEmbedding(text, dimensions));
    }
  }

  async ingest({ documentId, documentName, documentType, text, segments, metadata = {}, ownerId }) {
    if (!text || text.trim().length < 40) throw new Error("Document does not contain enough readable text.");
    const chunks = this.chunkSegments(segments, text);
    const embeddings = [];
    for (let i = 0; i < chunks.length; i += 24) {
      embeddings.push(...await this.embedWithFallback(chunks.slice(i, i + 24).map((x) => x.text), "RETRIEVAL_DOCUMENT"));
    }
    const createdAt = Date.now();
    const records = chunks.map((chunk, i) => ({
      id: crypto.randomUUID(), documentId, ownerId, documentName, documentType,
      chunkIndex: i, text: chunk.text, embedding: embeddings[i], createdAt,
      metadata: { ...metadata, ...chunk.metadata }
    }));
    await this.vectorStore.removeDocument(documentId);
    await this.vectorStore.addMany(records);
    return { documentId, documentName, chunks: records.length, createdAt };
  }

  async retrieve(query, options = {}) {
    const [queryVector] = await this.embedWithFallback([query], "RETRIEVAL_QUERY");
    if (!queryVector?.length) throw new Error("Could not create a query embedding.");
    return (await this.vectorStore.search(queryVector, options)).map(({ embedding, ...item }) => item);
  }

  buildContext(results) {
    return results.map((item, i) => `[SOURCE ${i + 1}]\nDocument: ${item.documentName}\nChunk: ${item.chunkIndex + 1}\n${item.metadata?.page ? `Page: ${item.metadata.page}\n` : ""}${item.metadata?.slide ? `Slide: ${item.metadata.slide}\n` : ""}${item.metadata?.section ? `Section: ${item.metadata.section}\n` : ""}Relevance: ${Number(item.score || 0).toFixed(4)}\nContent: ${item.text}`).join("\n\n");
  }

  formatSources(results) {
    return results.map((source, i) => ({
      source: i + 1,
      documentId: source.documentId,
      document: source.documentName,
      chunk: source.chunkIndex + 1,
      page: source.metadata?.page || null,
      slide: source.metadata?.slide || null,
      section: source.metadata?.section || null,
      relevance: Number((source.score || 0).toFixed(4)),
      excerpt: source.text.slice(0, 320)
    }));
  }
}

module.exports = { RAGService, localEmbedding };
