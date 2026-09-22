const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { VectorStore } = require("../src/rag/vector-store.cjs");
const { localEmbedding } = require("../src/rag/rag-service.cjs");

test("Local vector store isolates documents by owner", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-study-rag-"));
  const store = new VectorStore(path.join(dir, "vectors.json"));
  const vector = localEmbedding("machine learning notes", 32);
  store.addMany([
    { id: "a", documentId: "doc-a", ownerId: "user-a", documentName: "A", documentType: "text", chunkIndex: 0, text: "A content", embedding: vector, createdAt: 1, metadata: {} },
    { id: "b", documentId: "doc-b", ownerId: "user-b", documentName: "B", documentType: "text", chunkIndex: 0, text: "B content", embedding: vector, createdAt: 2, metadata: {} }
  ]);
  assert.deepEqual(store.listDocuments("user-a").map((x) => x.id), ["doc-a"]);
  assert.deepEqual(store.listDocuments("user-b").map((x) => x.id), ["doc-b"]);
  assert.equal(store.search(vector, { ownerId: "user-a", topK: 10 }).every((x) => x.ownerId === "user-a"), true);
  assert.equal(store.search(vector, { ownerId: "user-a", documentId: "doc-b", topK: 10 }).length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Local deterministic embeddings are stable and normalized", () => {
  const first = localEmbedding("Graph algorithms and BFS", 64);
  const second = localEmbedding("Graph algorithms and BFS", 64);
  assert.equal(first.length, 64);
  assert.deepEqual(first, second);
  const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test("Qdrant creates payload indexes required for owner/document filters", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith(`/collections/test_collection`)) return new Response(JSON.stringify({ result: { status: "green" } }), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith(`/collections/test_collection/index?wait=true`)) return new Response(JSON.stringify({ result: true }), { status: 200, headers: { "content-type": "application/json" } });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const { QdrantVectorStore } = require("../src/rag/vector-store.cjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-study-qdrant-"));
    const local = new VectorStore(path.join(dir, "vectors.json"));
    const store = new QdrantVectorStore(local, { url: "https://qdrant.example", collection: "test_collection" });
    await store.ensureCollection(32);
    const indexCalls = calls.filter((call) => call.url.endsWith("/collections/test_collection/index?wait=true"));
    assert.equal(indexCalls.length, 2);
    const fields = indexCalls.map((call) => JSON.parse(call.options.body).field_name).sort();
    assert.deepEqual(fields, ["documentId", "ownerId"]);
    fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    global.fetch = originalFetch;
  }
});

test("Qdrant filtered-search index failures fall back to owner-scoped local search", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ status: { error: "Index required but not found for ownerId" } }), { status: 400, headers: { "content-type": "application/json" } });
  try {
    const { QdrantVectorStore } = require("../src/rag/vector-store.cjs");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-study-qdrant-fallback-"));
    const local = new VectorStore(path.join(dir, "vectors.json"));
    const vector = localEmbedding("machine learning", 32);
    local.addMany([
      { id: "a", documentId: "doc-a", ownerId: "user-a", documentName: "A", documentType: "text", chunkIndex: 0, text: "machine learning", embedding: vector, createdAt: 1, metadata: {} },
      { id: "b", documentId: "doc-b", ownerId: "user-b", documentName: "B", documentType: "text", chunkIndex: 0, text: "machine learning", embedding: vector, createdAt: 2, metadata: {} }
    ]);
    const store = new QdrantVectorStore(local, { url: "https://qdrant.example", collection: "test_collection" });
    const result = await store.search(vector, { ownerId: "user-a", documentId: "doc-a", topK: 5 });
    assert.equal(result.length, 1);
    assert.equal(result[0].ownerId, "user-a");
    assert.equal(result[0].documentId, "doc-a");
    fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    global.fetch = originalFetch;
  }
});
