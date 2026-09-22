const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const root = path.join(__dirname, '..');
const servicePath = path.join(root, 'src', 'documents', 'document-service.cjs');
const { extractUploadedFile } = require(servicePath);
const server = fs.readFileSync(path.join(root, 'server.cjs'), 'utf8');
const quizController = fs.readFileSync(path.join(root, 'controllers', 'quizController.js'), 'utf8');
const app = fs.readFileSync(path.join(root, '..', 'Frontend', 'app.js'), 'utf8');

function makeZip(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-study-zip-'));
  for (const [name, content] of Object.entries(entries)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const zip = `${dir}.zip`;
  execFileSync('zip', ['-q', '-r', zip, '.'], { cwd: dir });
  fs.rmSync(dir, { recursive: true, force: true });
  return fs.readFileSync(zip);
}

function file(name, data, mimetype = 'application/octet-stream') {
  return { name, size: data.length, mimetype, data };
}

const textMime = {
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.json': 'application/json',
  '.html': 'text/html', '.rtf': 'application/rtf', '.png': 'image/png', '.pdf': 'application/pdf'
};

test('HTML is stripped as HTML instead of being routed through generic text handling', async () => {
  const data = Buffer.from('<html><body><h1>Operating Systems</h1><script>alert(1)</script><p>Processes execute programs.</p></body></html>');
  const result = await extractUploadedFile(file('notes.html', data, 'text/html'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'html');
  assert.match(result.text, /Operating Systems/);
  assert.match(result.text, /Processes execute programs/);
  assert.doesNotMatch(result.text, /<script|alert\(1\)/i);
});

test('XLSX text is extracted without requiring LibreOffice', async () => {
  const data = makeZip({
    '[Content_Types].xml': '<Types/>',
    'xl/sharedStrings.xml': '<sst><si><t>Concept</t></si><si><t>Definition</t></si><si><t>Cache</t></si><si><t>Fast storage</t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c t="s"><v>3</v></c></row></sheetData></worksheet>'
  });
  const result = await extractUploadedFile(file('notes.xlsx', data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'spreadsheet');
  assert.match(result.text, /Concept/);
  assert.match(result.text, /Cache/);
  assert.match(result.text, /Fast storage/);
});

test('DOCX direct XML extraction works when PDF conversion is unavailable', async () => {
  const data = makeZip({ 'word/document.xml': '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Operating Systems</w:t></w:r></w:p><w:p><w:r><w:t>Context switching saves CPU state.</w:t></w:r></w:p></w:body></w:document>' });
  const result = await extractUploadedFile(file('notes.docx', data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'docx');
  assert.match(result.text, /Operating Systems/);
  assert.match(result.text, /Context switching/);
});

test('PPTX direct slide XML extraction works when PDF conversion is unavailable', async () => {
  const data = makeZip({ 'ppt/slides/slide1.xml': '<p:sld xmlns:p="x"><p:cSld><a:p xmlns:a="x"><a:r><a:t>Computer Networks</a:t></a:r></a:p><a:p xmlns:a="x"><a:r><a:t>TCP is reliable.</a:t></a:r></a:p></p:cSld></p:sld>' });
  const result = await extractUploadedFile(file('notes.pptx', data, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'pptx');
  assert.match(result.text, /Computer Networks/);
  assert.match(result.text, /TCP is reliable/);
});

test('RTF control words are removed from study text', async () => {
  const data = Buffer.from(String.raw`{\\rtf1\\ansi Study Note: SQL joins combine rows.}`);
  const result = await extractUploadedFile(file('notes.rtf', data, 'application/rtf'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'rtf');
  assert.match(result.text, /Study Note/);
  assert.doesNotMatch(result.text, /\\rtf1|\\ansi/);
});

test('JSON study files are parsed and normalized instead of being treated as opaque bytes', async () => {
  const data = Buffer.from(JSON.stringify({ topic: 'DBMS', definition: 'Normalization reduces redundancy' }));
  const result = await extractUploadedFile(file('notes.json', data, 'application/json'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'json');
  assert.match(result.text, /Normalization reduces redundancy/);
});

test('Image OCR path produces readable study text when Tesseract is installed', { skip: !fs.existsSync('/usr/bin/tesseract') }, async () => {
  const data = fs.readFileSync(path.join(__dirname, 'fixtures', 'ocr-study-note.png'));
  const result = await extractUploadedFile(file('notes.png', data, 'image/png'), { pdfParser: null, gateway: null });
  assert.equal(result.type, 'image');
  assert.ok(result.text.length >= 20);
});

test('Scanned/text PDF fixture is handled when pdf-parse is installed', async () => {
  let PDFParse;
  try { ({ PDFParse } = require('pdf-parse')); } catch { return; }
  const data = fs.readFileSync(path.join(__dirname, 'fixtures', 'text-study-note.pdf'));
  const result = await extractUploadedFile(file('notes.pdf', data, 'application/pdf'), { pdfParser: PDFParse, gateway: null });
  assert.equal(result.type, 'pdf');
  assert.match(result.text, /Data Structures/);
  assert.match(result.text, /LIFO/);
});

test('HTML route precedes generic text MIME handling', () => {
  const service = fs.readFileSync(servicePath, 'utf8');
  assert.ok(service.indexOf('[".html", ".htm"]') < service.indexOf('mime.startsWith("text/")'));
});

test('Legacy /api/upload accepts the same broad study formats as the Study Pack uploader', () => {
  assert.match(server, /app\.post\("\/api\/upload"/);
  assert.match(server, /req\.files\?\.files \|\| req\.files\?\.file \|\| req\.files\?\.pdf/);
  assert.match(server, /extractUploadedFile\(hydrated, \{ pdfParser: PDFParse, gateway \}\)/);
  assert.doesNotMatch(server, /Only PDF files are supported/);
});

test('Quiz detail endpoint never sends correct answers before submission', () => {
  assert.match(quizController, /findOne\(\{_id:req\.params\.id,userId:req\.user\.id\}\)\.select\("-questions\.correctAnswer"\)/);
});

test('Quiz update still loads correct answers server-side so existing answers cannot be lost', () => {
  const update = quizController.slice(quizController.indexOf('async function updateQuiz'), quizController.indexOf('async function deleteQuiz'));
  assert.doesNotMatch(update, /select\("-questions\.correctAnswer"\)/);
});

test('Frontend does not contain duplicate session-expiry handling', () => {
  const matches = app.match(/session has expired\. Please sign in again/g) || [];
  assert.equal(matches.length, 1);
});

test('Archive entry limits reject oversized Office archives', async () => {
  const entries = {};
  for (let i = 0; i < 501; i++) entries[`xl/worksheets/f${i}.xml`] = '<worksheet/>';
  const data = makeZip(entries);
  await assert.rejects(() => extractUploadedFile(file('bomb.xlsx', data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), { pdfParser: null, gateway: null }), /too many entries|allowed size/i);
});


test('RAG supports multiple uploaded document IDs without collapsing retrieval to the first file', () => {
  const vector = fs.readFileSync(path.join(root, 'src', 'rag', 'vector-store.cjs'), 'utf8');
  const agent = fs.readFileSync(path.join(root, 'src', 'agents', 'rag-agent.cjs'), 'utf8');
  const orchestrator = fs.readFileSync(path.join(root, 'src', 'orchestrator.cjs'), 'utf8');
  const frontend = fs.readFileSync(path.join(root, '..', 'Frontend', 'app.js'), 'utf8');
  assert.match(vector, /documentIds/);
  assert.match(vector, /should\.push/);
  assert.match(agent, /documentIds/);
  assert.match(orchestrator, /documentIds/);
  assert.match(frontend, /documentIds = docs\.map/);
});

test('Study-pack upload no longer has a PDF-only legacy endpoint contract', () => {
  assert.doesNotMatch(server, /Only PDF files are supported/);
  assert.doesNotMatch(server, /No PDF file uploaded/);
});


test('Adaptive learning loop is wired end-to-end without replacing existing learning features', () => {
  const adaptiveService = fs.readFileSync(path.join(root, 'services', 'adaptiveLearningService.js'), 'utf8');
  const adaptiveController = fs.readFileSync(path.join(root, 'controllers', 'adaptiveController.js'), 'utf8');
  const adaptiveRoute = fs.readFileSync(path.join(root, 'routes', 'adaptive.js'), 'utf8');
  const frontend = fs.readFileSync(path.join(root, '..', 'Frontend', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, '..', 'Frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, '..', 'Frontend', 'style.css'), 'utf8');

  assert.match(adaptiveService, /dueFlashcards/);
  assert.match(adaptiveService, /recentQuizScore/);
  assert.match(adaptiveService, /focusTopic/);
  assert.match(adaptiveService, /mode/);
  assert.match(adaptiveService, /canGenerateNextPack/);
  assert.match(adaptiveController, /orchestrator\.planAndExecute/);
  assert.match(adaptiveController, /studyText/);
  assert.match(adaptiveRoute, /router\.get\("\/next"/);
  assert.match(adaptiveRoute, /router\.post\("\/next-pack"/);
  assert.match(server, /app\.use\("\/api\/adaptive", require\("\.\/routes\/adaptive"\)\)/);
  assert.match(frontend, /loadAdaptiveRecommendation/);
  assert.match(frontend, /generateAdaptiveNextPack/);
  assert.match(frontend, /\/api\/adaptive\/next-pack/);
  assert.match(html, /adaptiveDashboardCard/);
  assert.match(html, /LEARN/);
  assert.match(html, /PRACTICE/);
  assert.match(html, /REVISE/);
  assert.match(html, /ADAPT/);
  assert.match(css, /\.adaptive-dashboard-card/);
  assert.match(css, /\.learning-loop/);
});
