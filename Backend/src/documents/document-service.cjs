// const crypto = require("crypto");
// const fs = require("fs");
// const os = require("os");
// const path = require("path");
// const { execFile } = require("child_process");
// const { promisify } = require("util");
// const zlib = require("zlib");
// const execFileAsync = promisify(execFile);

// const ZIP_MAX_ENTRIES = Math.max(1, Number(process.env.DOCUMENT_MAX_ARCHIVE_ENTRIES || 500));
// const ZIP_MAX_UNCOMPRESSED = Math.max(1024 * 1024, Number(process.env.DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES || 50 * 1024 * 1024));
// const ZIP_COMMAND_TIMEOUT = Math.max(1000, Number(process.env.DOCUMENT_ARCHIVE_TIMEOUT_MS || 5000));
// const OFFICE_TIMEOUT = Math.max(5000, Number(process.env.DOCUMENT_CONVERSION_TIMEOUT_MS || 30000));
// const OCR_TIMEOUT = Math.max(3000, Number(process.env.DOCUMENT_OCR_TIMEOUT_MS || 20000));
// const MAX_EXTRACTED_CHARS = Math.max(10000, Number(process.env.DOCUMENT_MAX_EXTRACTED_CHARS || 250000));

// function createDocumentId() { return crypto.randomUUID(); }
// function documentError(message, code) { const error = new Error(message); error.code = code; return error; }
// function isDocumentSafetyError(error) { return String(error?.code || "").startsWith("DOCUMENT_ARCHIVE_"); }
// function cleanText(text) {
//   return String(text || "")
//     .replace(/\u0000/g, "")
//     .replace(/[ \t]+/g, " ")
//     .replace(/\n{3,}/g, "\n\n")
//     .trim()
//     .slice(0, MAX_EXTRACTED_CHARS);
// }

// function decodeXmlEntities(text) {
//   return String(text || "")
//     .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
//     .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
//     .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
//     .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
// }

// function xmlToText(xml) {
//   return decodeXmlEntities(String(xml || "")
//     .replace(/<w:tab[^>]*\/>/g, "\t")
//     .replace(/<a:br[^>]*\/>/g, "\n")
//     .replace(/<w:br[^>]*\/>/g, "\n")
//     .replace(/<\/w:p>/g, "\n")
//     .replace(/<\/a:p>/g, "\n")
//     .replace(/<\/p>/g, "\n")
//     .replace(/<[^>]+>/g, " "));
// }

// async function withTempFile(data, extension, fn) {
//   const file = path.join(os.tmpdir(), `smart-study-${crypto.randomUUID()}${extension || ""}`);
//   await fs.promises.writeFile(file, data);
//   try { return await fn(file); }
//   finally { await fs.promises.unlink(file).catch(() => {}); }
// }

// async function withTempDir(prefix, fn) {
//   const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
//   try { return await fn(dir); }
//   finally { await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {}); }
// }

// function findZipEndOfCentralDirectory(data) {
//   const minOffset = Math.max(0, data.length - 0xFFFF - 22);
//   for (let i = data.length - 22; i >= minOffset; i -= 1) {
//     if (data.readUInt32LE(i) === 0x06054b50) return i;
//   }
//   return -1;
// }

// function parseZipEntries(fileData) {
//   if (!Buffer.isBuffer(fileData) || fileData.length < 22) {
//     throw documentError("Document archive is empty or invalid.", "DOCUMENT_ARCHIVE_INVALID");
//   }

//   const eocd = findZipEndOfCentralDirectory(fileData);
//   if (eocd < 0) throw documentError("Document archive is empty or invalid.", "DOCUMENT_ARCHIVE_INVALID");

//   const entryCount = fileData.readUInt16LE(eocd + 10);
//   const centralSize = fileData.readUInt32LE(eocd + 12);
//   const centralOffset = fileData.readUInt32LE(eocd + 16);

//   // ZIP64 is uncommon for Office documents. Reject it clearly rather than
//   // attempting an unsafe partial parse.
//   if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
//     throw documentError("ZIP64 document archives are not supported.", "DOCUMENT_ARCHIVE_INVALID");
//   }
//   if (entryCount > ZIP_MAX_ENTRIES) {
//     throw documentError("Document archive contains too many entries.", "DOCUMENT_ARCHIVE_ENTRY_LIMIT");
//   }
//   if (centralOffset + centralSize > fileData.length) {
//     throw documentError("Document archive has an invalid central directory.", "DOCUMENT_ARCHIVE_INVALID");
//   }

//   const entries = [];
//   let offset = centralOffset;
//   let totalUncompressed = 0;

//   for (let i = 0; i < entryCount; i += 1) {
//     if (offset + 46 > fileData.length || fileData.readUInt32LE(offset) !== 0x02014b50) {
//       throw documentError("Document archive has an invalid entry table.", "DOCUMENT_ARCHIVE_INVALID");
//     }

//     const flags = fileData.readUInt16LE(offset + 8);
//     const method = fileData.readUInt16LE(offset + 10);
//     const compressedSize = fileData.readUInt32LE(offset + 20);
//     const uncompressedSize = fileData.readUInt32LE(offset + 24);
//     const nameLength = fileData.readUInt16LE(offset + 28);
//     const extraLength = fileData.readUInt16LE(offset + 30);
//     const commentLength = fileData.readUInt16LE(offset + 32);
//     const localOffset = fileData.readUInt32LE(offset + 42);
//     const end = offset + 46 + nameLength + extraLength + commentLength;
//     if (end > fileData.length) throw documentError("Document archive has a truncated entry.", "DOCUMENT_ARCHIVE_INVALID");

//     const nameBytes = fileData.subarray(offset + 46, offset + 46 + nameLength);
//     const name = (flags & 0x800 ? nameBytes.toString("utf8") : nameBytes.toString("utf8")).replace(/\\/g, "/");

//     totalUncompressed += uncompressedSize;
//     if (totalUncompressed > ZIP_MAX_UNCOMPRESSED) {
//       throw documentError("Document archive expands beyond the allowed size.", "DOCUMENT_ARCHIVE_SIZE_LIMIT");
//     }
//     entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
//     offset = end;
//   }

//   return { entries, totalUncompressed };
// }

// function readZipEntry(fileData, entry) {
//   const { localOffset, compressedSize, uncompressedSize, method } = entry;
//   if (localOffset + 30 > fileData.length || fileData.readUInt32LE(localOffset) !== 0x04034b50) {
//     throw documentError(`Invalid ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");
//   }

//   const nameLength = fileData.readUInt16LE(localOffset + 26);
//   const extraLength = fileData.readUInt16LE(localOffset + 28);
//   const dataStart = localOffset + 30 + nameLength + extraLength;
//   const dataEnd = dataStart + compressedSize;
//   if (dataEnd > fileData.length) throw documentError(`Truncated ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");

//   const compressed = fileData.subarray(dataStart, dataEnd);
//   let output;
//   if (method === 0) output = Buffer.from(compressed);
//   else if (method === 8) {
//     try { output = zlib.inflateRawSync(compressed); }
//     catch (error) { throw documentError(`Could not decompress ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID"); }
//   } else {
//     throw new Error(`Unsupported ZIP compression method ${method} for ${entry.name}.`);
//   }

//   if (output.length !== uncompressedSize) {
//     throw documentError(`ZIP entry size mismatch: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");
//   }
//   return output;
// }

// async function inspectZip(fileData) {
//   return parseZipEntries(fileData);
// }

// async function unzipText(fileData, entryName) {
//   const { entries } = parseZipEntries(fileData);
//   const normalized = String(entryName).replace(/\\/g, "/");
//   const entry = entries.find(item => item.name === normalized);
//   if (!entry) throw new Error(`ZIP entry not found: ${normalized}`);
//   return readZipEntry(fileData, entry).toString("utf8");
// }

// async function unzipList(fileData) {
//   return parseZipEntries(fileData).entries.map(entry => entry.name);
// }

// async function ocrPdfBuffer(data) {
//   return withTempDir("smart-study-pdf-ocr-", async (dir) => {
//     const pdfPath = path.join(dir, "source.pdf");
//     await fs.promises.writeFile(pdfPath, data);
//     try {
//       await execFileAsync("pdftoppm", ["-f", "1", "-l", String(Math.max(1, Number(process.env.DOCUMENT_OCR_MAX_PAGES || 30))), "-r", "150", "-png", pdfPath, path.join(dir, "page")], { maxBuffer: 5 * 1024 * 1024, timeout: OFFICE_TIMEOUT });
//     } catch (error) {
//       throw new Error(`Scanned PDF rendering failed: ${error.message}`);
//     }
//     const images = (await fs.promises.readdir(dir)).filter((name) => /^page-\d+\.png$/i.test(name)).sort();
//     const segments = [];
//     for (let i = 0; i < images.length; i += 1) {
//       try {
//         const { stdout } = await execFileAsync("tesseract", [path.join(dir, images[i]), "stdout", "--psm", "3"], { maxBuffer: 20 * 1024 * 1024, timeout: OCR_TIMEOUT });
//         const text = cleanText(stdout);
//         if (text) segments.push({ text, metadata: { sourceType: "pdf", page: i + 1, extraction: "ocr" } });
//       } catch {}
//       if (cleanText(segments.map((x) => x.text).join("\n")).length >= MAX_EXTRACTED_CHARS) break;
//     }
//     return segments;
//   });
// }

// async function extractPdfBuffer(data, pdfParser, { ocrFallback = true } = {}) {
//   if (!pdfParser) throw new Error("PDF parser is unavailable.");
//   const parser = new pdfParser({ data });
//   try {
//     const result = await parser.getText();
//     let segments = pdfSegments(result);
//     let text = cleanText(segments.map((s) => s.text).join("\n"));
//     if (ocrFallback && text.length < 40) {
//       try {
//         const ocrSegments = await ocrPdfBuffer(data);
//         const ocrText = cleanText(ocrSegments.map((s) => s.text).join("\n"));
//         if (ocrText.length > text.length) { segments = ocrSegments; text = ocrText; }
//       } catch {}
//     }
//     return { text, pages: result.total || result.numpages || segments.length || null, segments };
//   } finally { try { await parser.destroy(); } catch {} }
// }

// function pdfSegments(result) {
//   if (Array.isArray(result?.pages) && result.pages.length) {
//     return result.pages.map((page, i) => ({
//       text: cleanText(page.text || page.content || page.str || ""),
//       metadata: { sourceType: "pdf", page: i + 1 }
//     })).filter((x) => x.text);
//   }
//   const raw = String(result?.text || "");
//   const parts = raw.split(/\f|\u000c/g).map(cleanText).filter(Boolean);
//   if (parts.length > 1) return parts.map((text, i) => ({ text, metadata: { sourceType: "pdf", page: i + 1 } }));
//   return [{ text: cleanText(raw), metadata: { sourceType: "pdf" } }];
// }

// async function convertOfficeToPdf(file, extension) {
//   return withTempDir("smart-study-office-", async (dir) => {
//     const input = path.join(dir, `source${extension}`);
//     await fs.promises.writeFile(input, file.data);
//     try {
//       await execFileAsync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, input], {
//         maxBuffer: 10 * 1024 * 1024,
//         timeout: OFFICE_TIMEOUT
//       });
//     } catch (error) {
//       throw new Error(`Office document conversion failed. Install LibreOffice/soffice or provide a text-readable file: ${error.message}`);
//     }
//     const pdfPath = path.join(dir, "source.pdf");
//     const pdf = await fs.promises.readFile(pdfPath).catch(() => null);
//     if (!pdf?.length) throw new Error("Office document conversion produced no readable PDF.");
//     return pdf;
//   });
// }

// async function extractOfficeViaPdf(file, pdfParser, extension, type) {
//   const pdf = await convertOfficeToPdf(file, extension);
//   const extracted = await extractPdfBuffer(pdf, pdfParser);
//   return {
//     text: extracted.text,
//     pages: extracted.pages,
//     type,
//     segments: extracted.segments.map((s) => ({ ...s, metadata: { ...s.metadata, sourceType: type } }))
//   };
// }

// async function extractDocx(file, pdfParser) {
//   let xmlText = "";
//   try {
//     const xml = await unzipText(file.data, "word/document.xml");
//     xmlText = cleanText(xmlToText(xml));
//   } catch (error) {
//     if (isDocumentSafetyError(error)) throw error;
//   }
//   try {
//     const rendered = await extractOfficeViaPdf(file, pdfParser, ".docx", "docx");
//     const merged = cleanText([xmlText, rendered.text].filter(Boolean).join("\n"));
//     return { text: merged, pages: rendered.pages, type: "docx", segments: [{ text: merged, metadata: { sourceType: "docx" } }] };
//   } catch (error) {
//     if (xmlText.length >= 40) return { text: xmlText, pages: null, type: "docx", segments: [{ text: xmlText, metadata: { sourceType: "docx" } }] };
//     throw error;
//   }
// }

// async function extractPptx(file, pdfParser) {
//   let xmlSegments = [];
//   try {
//     const entries = await unzipList(file.data);
//     const slides = entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
//       .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)[1]) - Number(b.match(/slide(\d+)\.xml/i)[1]));
//     for (const entry of slides) {
//       const slideNumber = Number(entry.match(/slide(\d+)\.xml/i)[1]);
//       const xml = await unzipText(file.data, entry);
//       const text = cleanText(xmlToText(xml));
//       if (text) xmlSegments.push({ text, metadata: { sourceType: "pptx", slide: slideNumber } });
//     }
//   } catch (error) {
//     if (isDocumentSafetyError(error)) throw error;
//   }

//   let rendered = null;
//   try { rendered = await extractOfficeViaPdf(file, pdfParser, ".pptx", "pptx"); } catch {}

//   const xmlText = cleanText(xmlSegments.map((s) => `Slide ${s.metadata.slide}: ${s.text}`).join("\n"));
//   const renderedText = cleanText(rendered?.text || "");
//   const renderedAddsCoverage = renderedText && (!xmlText || renderedText.length > Math.max(xmlText.length * 1.15, xmlText.length + 120));
//   const merged = cleanText([xmlText, renderedAddsCoverage ? renderedText : ""].filter(Boolean).join("\n"));
//   if (!merged) throw new Error("The PowerPoint contains no readable text. If the slides are image-only, provide slide images or enable LibreOffice/Tesseract for OCR fallback.");
//   const segments = xmlSegments.length ? [...xmlSegments] : [];
//   if (renderedAddsCoverage) segments.push(...(rendered?.segments || []).map(s => ({ ...s, metadata: { ...(s.metadata || {}), sourceType: "pptx-rendered" } })));
//   return { text: merged, pages: rendered?.pages || xmlSegments.length || null, type: "pptx", segments: segments.length ? segments : (rendered?.segments || []) };
// }

// async function extractLegacyOffice(file, pdfParser, extension, type) {
//   return extractOfficeViaPdf(file, pdfParser, extension, type);
// }

// async function extractXlsx(file) {
//   const entries = await unzipList(file.data);
//   const sharedStrings = new Map();
//   if (entries.includes("xl/sharedStrings.xml")) {
//     const xml = await unzipText(file.data, "xl/sharedStrings.xml");
//     const items = String(xml).split(/<si[ >]/i).slice(1).map(x => x.split(/<\/si>/i)[0]);
//     items.forEach((item, index) => sharedStrings.set(index, cleanText(xmlToText(item))));
//   }
//   const sheetEntries = entries.filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort((a,b) => Number(a.match(/sheet(\d+)\.xml/i)[1]) - Number(b.match(/sheet(\d+)\.xml/i)[1]));
//   const segments = [];
//   for (const entry of sheetEntries) {
//     const sheetNumber = Number(entry.match(/sheet(\d+)\.xml/i)[1]);
//     const xml = await unzipText(file.data, entry);
//     const rows = [];
//     const rowMatches = String(xml).match(/<row[\s\S]*?<\/row>/gi) || [];
//     for (const row of rowMatches) {
//       const cells = [];
//       const cellMatches = row.match(/<c\b[\s\S]*?<\/c>/gi) || [];
//       for (const cell of cellMatches) {
//         const type = (cell.match(/\bt="([^"]+)"/i) || [])[1] || "";
//         const value = (cell.match(/<v>([\s\S]*?)<\/v>/i) || [])[1] || "";
//         if (!value && type !== "inlineStr") continue;
//         if (type === "s") cells.push(sharedStrings.get(Number(value)) || value);
//         else if (type === "inlineStr") cells.push(cleanText(xmlToText(cell)));
//         else cells.push(decodeXmlEntities(value));
//       }
//       if (cells.length) rows.push(cells.join(" | "));
//     }
//     const text = cleanText(rows.join("\n"));
//     if (text) segments.push({ text, metadata: { sourceType: "xlsx", sheet: sheetNumber } });
//   }
//   const text = cleanText(segments.map((x) => `Sheet ${x.metadata.sheet}:\n${x.text}`).join("\n\n"));
//   if (!text) throw new Error("The spreadsheet contains no readable cell text.");
//   return { text, pages: sheetEntries.length || null, type: "spreadsheet", segments };
// }

// async function extractOdtLike(file, type) {
//   const entry = type === "odt" ? "content.xml" : "content.xml";
//   const xml = await unzipText(file.data, entry);
//   const text = cleanText(xmlToText(xml));
//   if (!text) throw new Error(`The ${type.toUpperCase()} file contains no readable text.`);
//   return { text, pages: null, type, segments: [{ text, metadata: { sourceType: type } }] };
// }

// function cleanRtf(text) {
//   return cleanText(String(text || "")
//     .replace(/\\'[0-9a-f]{2}/gi, " ")
//     .replace(/\\[a-z]+-?\d* ?/gi, " ")
//     .replace(/[{}]/g, " "));
// }

// async function extractSpreadsheet(file, pdfParser) {
//   const ext = path.extname(file.name).toLowerCase();
//   if (ext === ".xlsx") {
//     try { return await extractXlsx(file); } catch (error) {
//       if (isDocumentSafetyError(error)) throw error;
//       return extractOfficeViaPdf(file, pdfParser, ext, "spreadsheet");
//     }
//   }
//   return extractOfficeViaPdf(file, pdfParser, ext, "spreadsheet");
// }

// async function extractTextLike(file, ext) {
//   const raw = file.data.toString("utf8");
//   const text = ext === "rtf" ? cleanRtf(raw) : ext === "json" ? cleanText(JSON.stringify(JSON.parse(raw), null, 2)) : cleanText(raw);
//   return { text, pages: null, type: ext === "md" ? "md" : ext === "rtf" ? "rtf" : ext === "json" ? "json" : "text", segments: [{ text, metadata: { sourceType: ext } }] };
// }

// async function extractImage(file, gateway) {
//   let visionText = "";
//   if (gateway) {
//     try {
//       const response = await gateway.extractImage({ data: file.data.toString("base64"), mimeType: file.mimetype });
//       visionText = cleanText(response.text);
//     } catch {}
//   }

//   let ocrText = "";
//   try {
//     await withTempFile(file.data, path.extname(file.name || ".png"), async (imagePath) => {
//       const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "--psm", "3"], { maxBuffer: 20 * 1024 * 1024, timeout: OCR_TIMEOUT });
//       ocrText = cleanText(stdout);
//     });
//   } catch {}

//   const text = cleanText([visionText, ocrText].filter(Boolean).join("\n"));
//   if (!text) throw new Error("No readable text could be extracted from the image. Try a clearer image or higher resolution.");
//   return { text, pages: null, type: "image", segments: [{ text, metadata: { sourceType: "image", extraction: visionText && ocrText ? "vision+ocr" : visionText ? "vision" : "ocr" } }] };
// }

// async function extractHtml(file) {
//   const text = cleanText(String(file.data.toString("utf8")).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
//   return { text, pages: null, type: "html", segments: [{ text, metadata: { sourceType: "html" } }] };
// }

// async function extractUploadedFile(file, { pdfParser, gateway } = {}) {
//   if (!file?.data) throw new Error("No file data received.");
//   const mime = String(file.mimetype || "").toLowerCase();
//   const name = file.name || "document";
//   const ext = path.extname(name).toLowerCase();

//   if (mime === "application/pdf" || ext === ".pdf") {
//     const extracted = await extractPdfBuffer(file.data, pdfParser);
//     return { ...extracted, type: "pdf" };
//   }

//   const isZippedOffice = [".docx", ".pptx", ".xlsx", ".ods", ".odt", ".odp"].includes(ext) || /wordprocessingml|presentationml|spreadsheetml|opendocument\./i.test(mime);
//   if (isZippedOffice) await inspectZip(file.data);
//   if (ext === ".docx" || mime.includes("wordprocessingml.document")) return extractDocx(file, pdfParser);
//   if (ext === ".doc" || mime === "application/msword") return extractLegacyOffice(file, pdfParser, ".doc", "doc");
//   if (ext === ".pptx" || mime.includes("presentationml.presentation")) return extractPptx(file, pdfParser);
//   if (ext === ".ppt" || mime === "application/vnd.ms-powerpoint") return extractLegacyOffice(file, pdfParser, ".ppt", "ppt");
//   if ([".xlsx", ".xls", ".ods"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("opendocument.spreadsheet")) return extractSpreadsheet(file, pdfParser);
//   if ([".odt"].includes(ext) || mime.includes("opendocument.text")) { try { return await extractOdtLike(file, "odt"); } catch (error) { if (isDocumentSafetyError(error)) throw error; return extractOfficeViaPdf(file, pdfParser, ext, "odt"); } }
//   if ([".odp"].includes(ext) || mime.includes("opendocument.presentation")) { try { return await extractOdtLike(file, "odp"); } catch (error) { if (isDocumentSafetyError(error)) throw error; return extractOfficeViaPdf(file, pdfParser, ext, "odp"); } }
//   if ([".html", ".htm"].includes(ext) || mime === "text/html") return extractHtml(file);
//   if ([".txt", ".md", ".csv", ".json", ".rtf"].includes(ext) || mime.startsWith("text/")) return extractTextLike(file, ext.slice(1) || "text");
//   if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".tif"].includes(ext)) return extractImage(file, gateway);

//   throw new Error("Unsupported file type. Supported: PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Excel (XLS/XLSX), ODT/ODP, TXT, Markdown, CSV, JSON, HTML, RTF and images.");
// }

// module.exports = { createDocumentId, extractUploadedFile, cleanText };

/// working on this file, but it is currently commented out. The code provides functions for extracting text from various document formats, including PDFs, Office documents, spreadsheets, images, and HTML files. It handles ZIP archives, OCR for scanned PDFs and images, and text cleaning. The main function `extractUploadedFile` determines the file type and calls the appropriate extraction function.

// const crypto = require("crypto");
// const fs = require("fs");
// const os = require("os");
// const path = require("path");
// const { execFile } = require("child_process");
// const { promisify } = require("util");
// const zlib = require("zlib");
// const execFileAsync = promisify(execFile);

// const ZIP_MAX_ENTRIES = Math.max(1, Number(process.env.DOCUMENT_MAX_ARCHIVE_ENTRIES || 500));
// const ZIP_MAX_UNCOMPRESSED = Math.max(1024 * 1024, Number(process.env.DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES || 50 * 1024 * 1024));
// const ZIP_COMMAND_TIMEOUT = Math.max(1000, Number(process.env.DOCUMENT_ARCHIVE_TIMEOUT_MS || 5000));
// const OFFICE_TIMEOUT = Math.max(5000, Number(process.env.DOCUMENT_CONVERSION_TIMEOUT_MS || 30000));
// const OCR_TIMEOUT = Math.max(3000, Number(process.env.DOCUMENT_OCR_TIMEOUT_MS || 20000));
// const MAX_EXTRACTED_CHARS = Math.max(10000, Number(process.env.DOCUMENT_MAX_EXTRACTED_CHARS || 250000));

// function createDocumentId() { return crypto.randomUUID(); }
// function documentError(message, code) { const error = new Error(message); error.code = code; return error; }
// function isDocumentSafetyError(error) { return String(error?.code || "").startsWith("DOCUMENT_ARCHIVE_"); }
// function cleanText(text) {
//   return String(text || "")
//     .replace(/\u0000/g, "")
//     .replace(/[ \t]+/g, " ")
//     .replace(/\n{3,}/g, "\n\n")
//     .trim()
//     .slice(0, MAX_EXTRACTED_CHARS);
// }

// function decodeXmlEntities(text) {
//   return String(text || "")
//     .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
//     .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
//     .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
//     .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
// }

// function xmlToText(xml) {
//   return decodeXmlEntities(String(xml || "")
//     .replace(/<w:tab[^>]*\/>/g, "\t")
//     .replace(/<a:br[^>]*\/>/g, "\n")
//     .replace(/<w:br[^>]*\/>/g, "\n")
//     .replace(/<\/w:p>/g, "\n")
//     .replace(/<\/a:p>/g, "\n")
//     .replace(/<\/p>/g, "\n")
//     .replace(/<[^>]+>/g, " "));
// }

// async function withTempFile(data, extension, fn) {
//   const file = path.join(os.tmpdir(), `smart-study-${crypto.randomUUID()}${extension || ""}`);
//   await fs.promises.writeFile(file, data);
//   try { return await fn(file); }
//   finally { await fs.promises.unlink(file).catch(() => {}); }
// }

// async function withTempDir(prefix, fn) {
//   const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
//   try { return await fn(dir); }
//   finally { await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {}); }
// }

// function findZipEndOfCentralDirectory(data) {
//   const minOffset = Math.max(0, data.length - 0xFFFF - 22);
//   for (let i = data.length - 22; i >= minOffset; i -= 1) {
//     if (data.readUInt32LE(i) === 0x06054b50) return i;
//   }
//   return -1;
// }

// function parseZipEntries(fileData) {
//   if (!Buffer.isBuffer(fileData) || fileData.length < 22) {
//     throw documentError("Document archive is empty or invalid.", "DOCUMENT_ARCHIVE_INVALID");
//   }

//   const eocd = findZipEndOfCentralDirectory(fileData);
//   if (eocd < 0) throw documentError("Document archive is empty or invalid.", "DOCUMENT_ARCHIVE_INVALID");

//   const entryCount = fileData.readUInt16LE(eocd + 10);
//   const centralSize = fileData.readUInt32LE(eocd + 12);
//   const centralOffset = fileData.readUInt32LE(eocd + 16);

//   // ZIP64 is uncommon for Office documents. Reject it clearly rather than
//   // attempting an unsafe partial parse.
//   if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
//     throw documentError("ZIP64 document archives are not supported.", "DOCUMENT_ARCHIVE_INVALID");
//   }
//   if (entryCount > ZIP_MAX_ENTRIES) {
//     throw documentError("Document archive contains too many entries.", "DOCUMENT_ARCHIVE_ENTRY_LIMIT");
//   }
//   if (centralOffset + centralSize > fileData.length) {
//     throw documentError("Document archive has an invalid central directory.", "DOCUMENT_ARCHIVE_INVALID");
//   }

//   const entries = [];
//   let offset = centralOffset;
//   let totalUncompressed = 0;

//   for (let i = 0; i < entryCount; i += 1) {
//     if (offset + 46 > fileData.length || fileData.readUInt32LE(offset) !== 0x02014b50) {
//       throw documentError("Document archive has an invalid entry table.", "DOCUMENT_ARCHIVE_INVALID");
//     }

//     const flags = fileData.readUInt16LE(offset + 8);
//     const method = fileData.readUInt16LE(offset + 10);
//     const compressedSize = fileData.readUInt32LE(offset + 20);
//     const uncompressedSize = fileData.readUInt32LE(offset + 24);
//     const nameLength = fileData.readUInt16LE(offset + 28);
//     const extraLength = fileData.readUInt16LE(offset + 30);
//     const commentLength = fileData.readUInt16LE(offset + 32);
//     const localOffset = fileData.readUInt32LE(offset + 42);
//     const end = offset + 46 + nameLength + extraLength + commentLength;
//     if (end > fileData.length) throw documentError("Document archive has a truncated entry.", "DOCUMENT_ARCHIVE_INVALID");

//     const nameBytes = fileData.subarray(offset + 46, offset + 46 + nameLength);
//     const name = (flags & 0x800 ? nameBytes.toString("utf8") : nameBytes.toString("utf8")).replace(/\\/g, "/");

//     totalUncompressed += uncompressedSize;
//     if (totalUncompressed > ZIP_MAX_UNCOMPRESSED) {
//       throw documentError("Document archive expands beyond the allowed size.", "DOCUMENT_ARCHIVE_SIZE_LIMIT");
//     }
//     entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
//     offset = end;
//   }

//   return { entries, totalUncompressed };
// }

// function readZipEntry(fileData, entry) {
//   const { localOffset, compressedSize, uncompressedSize, method } = entry;
//   if (localOffset + 30 > fileData.length || fileData.readUInt32LE(localOffset) !== 0x04034b50) {
//     throw documentError(`Invalid ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");
//   }

//   const nameLength = fileData.readUInt16LE(localOffset + 26);
//   const extraLength = fileData.readUInt16LE(localOffset + 28);
//   const dataStart = localOffset + 30 + nameLength + extraLength;
//   const dataEnd = dataStart + compressedSize;
//   if (dataEnd > fileData.length) throw documentError(`Truncated ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");

//   const compressed = fileData.subarray(dataStart, dataEnd);
//   let output;
//   if (method === 0) output = Buffer.from(compressed);
//   else if (method === 8) {
//     try { output = zlib.inflateRawSync(compressed); }
//     catch (error) { throw documentError(`Could not decompress ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID"); }
//   } else {
//     throw new Error(`Unsupported ZIP compression method ${method} for ${entry.name}.`);
//   }

//   if (output.length !== uncompressedSize) {
//     throw documentError(`ZIP entry size mismatch: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");
//   }
//   return output;
// }

// async function inspectZip(fileData) {
//   return parseZipEntries(fileData);
// }

// async function unzipText(fileData, entryName) {
//   const { entries } = parseZipEntries(fileData);
//   const normalized = String(entryName).replace(/\\/g, "/");
//   const entry = entries.find(item => item.name === normalized);
//   if (!entry) throw new Error(`ZIP entry not found: ${normalized}`);
//   return readZipEntry(fileData, entry).toString("utf8");
// }

// async function unzipList(fileData) {
//   return parseZipEntries(fileData).entries.map(entry => entry.name);
// }

// async function ocrPdfBuffer(data) {
//   return withTempDir("smart-study-pdf-ocr-", async (dir) => {
//     const pdfPath = path.join(dir, "source.pdf");
//     await fs.promises.writeFile(pdfPath, data);
//     try {
//       await execFileAsync("pdftoppm", ["-f", "1", "-l", String(Math.max(1, Number(process.env.DOCUMENT_OCR_MAX_PAGES || 30))), "-r", "150", "-png", pdfPath, path.join(dir, "page")], { maxBuffer: 5 * 1024 * 1024, timeout: OFFICE_TIMEOUT });
//     } catch (error) {
//       throw new Error(`Scanned PDF rendering failed: ${error.message}`);
//     }
//     const images = (await fs.promises.readdir(dir)).filter((name) => /^page-\d+\.png$/i.test(name)).sort();
//     const segments = [];
//     for (let i = 0; i < images.length; i += 1) {
//       try {
//         const { stdout } = await execFileAsync("tesseract", [path.join(dir, images[i]), "stdout", "--psm", "3"], { maxBuffer: 20 * 1024 * 1024, timeout: OCR_TIMEOUT });
//         const text = cleanText(stdout);
//         if (text) segments.push({ text, metadata: { sourceType: "pdf", page: i + 1, extraction: "ocr" } });
//       } catch {}
//       if (cleanText(segments.map((x) => x.text).join("\n")).length >= MAX_EXTRACTED_CHARS) break;
//     }
//     return segments;
//   });
// }

// async function extractPdfBuffer(data, pdfParser, { ocrFallback = true } = {}) {
//   if (!pdfParser) throw new Error("PDF parser is unavailable.");
//   const parser = new pdfParser({ data });
//   try {
//     const result = await parser.getText();
//     let segments = pdfSegments(result);
//     let text = cleanText(segments.map((s) => s.text).join("\n"));
//     if (ocrFallback && text.length < 40) {
//       try {
//         const ocrSegments = await ocrPdfBuffer(data);
//         const ocrText = cleanText(ocrSegments.map((s) => s.text).join("\n"));
//         if (ocrText.length > text.length) { segments = ocrSegments; text = ocrText; }
//       } catch {}
//     }
//     return { text, pages: result.total || result.numpages || segments.length || null, segments };
//   } finally { try { await parser.destroy(); } catch {} }
// }

// function pdfSegments(result) {
//   if (Array.isArray(result?.pages) && result.pages.length) {
//     return result.pages.map((page, i) => ({
//       text: cleanText(page.text || page.content || page.str || ""),
//       metadata: { sourceType: "pdf", page: i + 1 }
//     })).filter((x) => x.text);
//   }
//   const raw = String(result?.text || "");
//   const parts = raw.split(/\f|\u000c/g).map(cleanText).filter(Boolean);
//   if (parts.length > 1) return parts.map((text, i) => ({ text, metadata: { sourceType: "pdf", page: i + 1 } }));
//   return [{ text: cleanText(raw), metadata: { sourceType: "pdf" } }];
// }

// async function convertOfficeToPdf(file, extension) {
//   return withTempDir("smart-study-office-", async (dir) => {
//     const input = path.join(dir, `source${extension}`);
//     await fs.promises.writeFile(input, file.data);
//     try {
//       await execFileAsync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, input], {
//         maxBuffer: 10 * 1024 * 1024,
//         timeout: OFFICE_TIMEOUT
//       });
//     } catch (error) {
//       throw new Error(`Office document conversion failed. Install LibreOffice/soffice or provide a text-readable file: ${error.message}`);
//     }
//     const pdfPath = path.join(dir, "source.pdf");
//     const pdf = await fs.promises.readFile(pdfPath).catch(() => null);
//     if (!pdf?.length) throw new Error("Office document conversion produced no readable PDF.");
//     return pdf;
//   });
// }

// async function extractOfficeViaPdf(file, pdfParser, extension, type) {
//   const pdf = await convertOfficeToPdf(file, extension);
//   const extracted = await extractPdfBuffer(pdf, pdfParser);
//   return {
//     text: extracted.text,
//     pages: extracted.pages,
//     type,
//     segments: extracted.segments.map((s) => ({ ...s, metadata: { ...s.metadata, sourceType: type } }))
//   };
// }

// async function extractDocx(file, pdfParser) {
//   let xmlText = "";
//   try {
//     const xml = await unzipText(file.data, "word/document.xml");
//     xmlText = cleanText(xmlToText(xml));
//   } catch (error) {
//     if (isDocumentSafetyError(error)) throw error;
//   }
//   try {
//     const rendered = await extractOfficeViaPdf(file, pdfParser, ".docx", "docx");
//     const merged = cleanText([xmlText, rendered.text].filter(Boolean).join("\n"));
//     return { text: merged, pages: rendered.pages, type: "docx", segments: [{ text: merged, metadata: { sourceType: "docx" } }] };
//   } catch (error) {
//     if (xmlText.length >= 40) return { text: xmlText, pages: null, type: "docx", segments: [{ text: xmlText, metadata: { sourceType: "docx" } }] };
//     throw error;
//   }
// }

// async function extractPptx(file, pdfParser) {
//   let xmlSegments = [];
//   try {
//     const entries = await unzipList(file.data);
//     const slides = entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
//       .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)[1]) - Number(b.match(/slide(\d+)\.xml/i)[1]));
//     for (const entry of slides) {
//       const slideNumber = Number(entry.match(/slide(\d+)\.xml/i)[1]);
//       const xml = await unzipText(file.data, entry);
//       const text = cleanText(xmlToText(xml));
//       if (text) xmlSegments.push({ text, metadata: { sourceType: "pptx", slide: slideNumber } });
//     }
//   } catch (error) {
//     if (isDocumentSafetyError(error)) throw error;
//   }

//   let rendered = null;
//   try { rendered = await extractOfficeViaPdf(file, pdfParser, ".pptx", "pptx"); } catch {}

//   const xmlText = cleanText(xmlSegments.map((s) => `Slide ${s.metadata.slide}: ${s.text}`).join("\n"));
//   const renderedText = cleanText(rendered?.text || "");
//   const renderedAddsCoverage = renderedText && (!xmlText || renderedText.length > Math.max(xmlText.length * 1.15, xmlText.length + 120));
//   const merged = cleanText([xmlText, renderedAddsCoverage ? renderedText : ""].filter(Boolean).join("\n"));
//   if (!merged) throw new Error("The PowerPoint contains no readable text. If the slides are image-only, provide slide images or enable LibreOffice/Tesseract for OCR fallback.");
//   const segments = xmlSegments.length ? [...xmlSegments] : [];
//   if (renderedAddsCoverage) segments.push(...(rendered?.segments || []).map(s => ({ ...s, metadata: { ...(s.metadata || {}), sourceType: "pptx-rendered" } })));
//   return { text: merged, pages: rendered?.pages || xmlSegments.length || null, type: "pptx", segments: segments.length ? segments : (rendered?.segments || []) };
// }

// async function extractLegacyOffice(file, pdfParser, extension, type) {
//   return extractOfficeViaPdf(file, pdfParser, extension, type);
// }

// async function extractXlsx(file) {
//   const entries = await unzipList(file.data);
//   const sharedStrings = new Map();
//   if (entries.includes("xl/sharedStrings.xml")) {
//     const xml = await unzipText(file.data, "xl/sharedStrings.xml");
//     const items = String(xml).split(/<si[ >]/i).slice(1).map(x => x.split(/<\/si>/i)[0]);
//     items.forEach((item, index) => sharedStrings.set(index, cleanText(xmlToText(item))));
//   }
//   const sheetEntries = entries.filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort((a,b) => Number(a.match(/sheet(\d+)\.xml/i)[1]) - Number(b.match(/sheet(\d+)\.xml/i)[1]));
//   const segments = [];
//   for (const entry of sheetEntries) {
//     const sheetNumber = Number(entry.match(/sheet(\d+)\.xml/i)[1]);
//     const xml = await unzipText(file.data, entry);
//     const rows = [];
//     const rowMatches = String(xml).match(/<row[\s\S]*?<\/row>/gi) || [];
//     for (const row of rowMatches) {
//       const cells = [];
//       const cellMatches = row.match(/<c\b[\s\S]*?<\/c>/gi) || [];
//       for (const cell of cellMatches) {
//         const type = (cell.match(/\bt="([^"]+)"/i) || [])[1] || "";
//         const value = (cell.match(/<v>([\s\S]*?)<\/v>/i) || [])[1] || "";
//         if (!value && type !== "inlineStr") continue;
//         if (type === "s") cells.push(sharedStrings.get(Number(value)) || value);
//         else if (type === "inlineStr") cells.push(cleanText(xmlToText(cell)));
//         else cells.push(decodeXmlEntities(value));
//       }
//       if (cells.length) rows.push(cells.join(" | "));
//     }
//     const text = cleanText(rows.join("\n"));
//     if (text) segments.push({ text, metadata: { sourceType: "xlsx", sheet: sheetNumber } });
//   }
//   const text = cleanText(segments.map((x) => `Sheet ${x.metadata.sheet}:\n${x.text}`).join("\n\n"));
//   if (!text) throw new Error("The spreadsheet contains no readable cell text.");
//   return { text, pages: sheetEntries.length || null, type: "spreadsheet", segments };
// }

// async function extractOdtLike(file, type) {
//   const entry = type === "odt" ? "content.xml" : "content.xml";
//   const xml = await unzipText(file.data, entry);
//   const text = cleanText(xmlToText(xml));
//   if (!text) throw new Error(`The ${type.toUpperCase()} file contains no readable text.`);
//   return { text, pages: null, type, segments: [{ text, metadata: { sourceType: type } }] };
// }

// function cleanRtf(text) {
//   return cleanText(String(text || "")
//     .replace(/\\'[0-9a-f]{2}/gi, " ")
//     .replace(/\\[a-z]+-?\d* ?/gi, " ")
//     .replace(/[{}]/g, " "));
// }

// async function extractSpreadsheet(file, pdfParser) {
//   const ext = path.extname(file.name).toLowerCase();
//   if (ext === ".xlsx") {
//     try { return await extractXlsx(file); } catch (error) {
//       if (isDocumentSafetyError(error)) throw error;
//       return extractOfficeViaPdf(file, pdfParser, ext, "spreadsheet");
//     }
//   }
//   return extractOfficeViaPdf(file, pdfParser, ext, "spreadsheet");
// }

// async function extractTextLike(file, ext) {
//   const raw = file.data.toString("utf8");
//   const text = ext === "rtf" ? cleanRtf(raw) : ext === "json" ? cleanText(JSON.stringify(JSON.parse(raw), null, 2)) : cleanText(raw);
//   return { text, pages: null, type: ext === "md" ? "md" : ext === "rtf" ? "rtf" : ext === "json" ? "json" : "text", segments: [{ text, metadata: { sourceType: ext } }] };
// }

// async function extractImage(file, gateway) {
//   let visionText = "";
//   if (gateway) {
//     try {
//       const response = await gateway.extractImage({ data: file.data.toString("base64"), mimeType: file.mimetype });
//       visionText = cleanText(response.text);
//     } catch {}
//   }

//   let ocrText = "";
//   try {
//     await withTempFile(file.data, path.extname(file.name || ".png"), async (imagePath) => {
//       const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "--psm", "3"], { maxBuffer: 20 * 1024 * 1024, timeout: OCR_TIMEOUT });
//       ocrText = cleanText(stdout);
//     });
//   } catch {}

//   const text = cleanText([visionText, ocrText].filter(Boolean).join("\n"));
//   if (!text) throw new Error("No readable text could be extracted from the image. Try a clearer image or higher resolution.");
//   return { text, pages: null, type: "image", segments: [{ text, metadata: { sourceType: "image", extraction: visionText && ocrText ? "vision+ocr" : visionText ? "vision" : "ocr" } }] };
// }

// async function extractHtml(file) {
//   const text = cleanText(String(file.data.toString("utf8")).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
//   return { text, pages: null, type: "html", segments: [{ text, metadata: { sourceType: "html" } }] };
// }

// async function extractUploadedFile(file, { pdfParser, gateway } = {}) {
//   if (!file?.data) throw new Error("No file data received.");
//   const mime = String(file.mimetype || "").toLowerCase();
//   const name = file.name || "document";
//   const ext = path.extname(name).toLowerCase();

//   if (mime === "application/pdf" || ext === ".pdf") {
//     const extracted = await extractPdfBuffer(file.data, pdfParser);
//     return { ...extracted, type: "pdf" };
//   }

//   const isZippedOffice = [".docx", ".pptx", ".xlsx", ".ods", ".odt", ".odp"].includes(ext) || /wordprocessingml|presentationml|spreadsheetml|opendocument\./i.test(mime);
//   if (isZippedOffice) await inspectZip(file.data);
//   if (ext === ".docx" || mime.includes("wordprocessingml.document")) return extractDocx(file, pdfParser);
//   if (ext === ".doc" || mime === "application/msword") return extractLegacyOffice(file, pdfParser, ".doc", "doc");
//   if (ext === ".pptx" || mime.includes("presentationml.presentation")) return extractPptx(file, pdfParser);
//   if (ext === ".ppt" || mime === "application/vnd.ms-powerpoint") return extractLegacyOffice(file, pdfParser, ".ppt", "ppt");
//   if ([".xlsx", ".xls", ".ods"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("opendocument.spreadsheet")) return extractSpreadsheet(file, pdfParser);
//   if ([".odt"].includes(ext) || mime.includes("opendocument.text")) { try { return await extractOdtLike(file, "odt"); } catch (error) { if (isDocumentSafetyError(error)) throw error; return extractOfficeViaPdf(file, pdfParser, ext, "odt"); } }
//   if ([".odp"].includes(ext) || mime.includes("opendocument.presentation")) { try { return await extractOdtLike(file, "odp"); } catch (error) { if (isDocumentSafetyError(error)) throw error; return extractOfficeViaPdf(file, pdfParser, ext, "odp"); } }
//   if ([".html", ".htm"].includes(ext) || mime === "text/html") return extractHtml(file);
//   if ([".txt", ".md", ".csv", ".json", ".rtf"].includes(ext) || mime.startsWith("text/")) return extractTextLike(file, ext.slice(1) || "text");
//   if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".tif"].includes(ext)) return extractImage(file, gateway);

//   throw new Error("Unsupported file type. Supported: PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Excel (XLS/XLSX), ODT/ODP, TXT, Markdown, CSV, JSON, HTML, RTF and images.");
// }

// module.exports = { createDocumentId, extractUploadedFile, cleanText };



const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const zlib = require("zlib");
const execFileAsync = promisify(execFile);

const ZIP_MAX_ENTRIES = Math.max(1, Number(process.env.DOCUMENT_MAX_ARCHIVE_ENTRIES || 500));
const ZIP_MAX_UNCOMPRESSED = Math.max(1024 * 1024, Number(process.env.DOCUMENT_MAX_ARCHIVE_UNCOMPRESSED_BYTES || 50 * 1024 * 1024));
const ZIP_COMMAND_TIMEOUT = Math.max(1000, Number(process.env.DOCUMENT_ARCHIVE_TIMEOUT_MS || 5000));
const OFFICE_TIMEOUT = Math.max(5000, Number(process.env.DOCUMENT_CONVERSION_TIMEOUT_MS || 30000));
const OCR_TIMEOUT = Math.max(3000, Number(process.env.DOCUMENT_OCR_TIMEOUT_MS || 20000));
const MAX_EXTRACTED_CHARS = Math.max(10000, Number(process.env.DOCUMENT_MAX_EXTRACTED_CHARS || 250000));

function createDocumentId() { return crypto.randomUUID(); }
function documentError(message, code) { const error = new Error(message); error.code = code; return error; }
function isDocumentSafetyError(error) { return String(error?.code || "").startsWith("DOCUMENT_ARCHIVE_"); }
function cleanText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function xmlToText(xml) {
  return decodeXmlEntities(String(xml || "")
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<a:br[^>]*\/>/g, "\n")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, " "));
}

async function withTempFile(data, extension, fn) {
  const file = path.join(os.tmpdir(), `smart-study-${crypto.randomUUID()}${extension || ""}`);
  await fs.promises.writeFile(file, data);
  try { return await fn(file); }
  finally { await fs.promises.unlink(file).catch(() => {}); }
}

async function withTempDir(prefix, fn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  try { return await fn(dir); }
  finally { await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

function findZipEndOfCentralDirectory(data) {
  const minOffset = Math.max(0, data.length - 0xFFFF - 22);
  for (let i = data.length - 22; i >= minOffset; i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function parseZipEntries(fileData) {
  if (!Buffer.isBuffer(fileData) || fileData.length < 22) {
    throw documentError("Document archive is empty or invalid.", "DOCUMENT_ARCHIVE_INVALID");
  }

  const eocd = findZipEndOfCentralDirectory(fileData);
  if (eocd < 0) throw documentError("Document archive is empty or invalid.", "DOCUMENT_ARCHIVE_INVALID");

  const entryCount = fileData.readUInt16LE(eocd + 10);
  const centralSize = fileData.readUInt32LE(eocd + 12);
  const centralOffset = fileData.readUInt32LE(eocd + 16);

  // ZIP64 is uncommon for Office documents. Reject it clearly rather than
  // attempting an unsafe partial parse.
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw documentError("ZIP64 document archives are not supported.", "DOCUMENT_ARCHIVE_INVALID");
  }
  if (entryCount > ZIP_MAX_ENTRIES) {
    throw documentError("Document archive contains too many entries.", "DOCUMENT_ARCHIVE_ENTRY_LIMIT");
  }
  if (centralOffset + centralSize > fileData.length) {
    throw documentError("Document archive has an invalid central directory.", "DOCUMENT_ARCHIVE_INVALID");
  }

  const entries = [];
  let offset = centralOffset;
  let totalUncompressed = 0;

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > fileData.length || fileData.readUInt32LE(offset) !== 0x02014b50) {
      throw documentError("Document archive has an invalid entry table.", "DOCUMENT_ARCHIVE_INVALID");
    }

    const flags = fileData.readUInt16LE(offset + 8);
    const method = fileData.readUInt16LE(offset + 10);
    const compressedSize = fileData.readUInt32LE(offset + 20);
    const uncompressedSize = fileData.readUInt32LE(offset + 24);
    const nameLength = fileData.readUInt16LE(offset + 28);
    const extraLength = fileData.readUInt16LE(offset + 30);
    const commentLength = fileData.readUInt16LE(offset + 32);
    const localOffset = fileData.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > fileData.length) throw documentError("Document archive has a truncated entry.", "DOCUMENT_ARCHIVE_INVALID");

    const nameBytes = fileData.subarray(offset + 46, offset + 46 + nameLength);
    const name = (flags & 0x800 ? nameBytes.toString("utf8") : nameBytes.toString("utf8")).replace(/\\/g, "/");

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > ZIP_MAX_UNCOMPRESSED) {
      throw documentError("Document archive expands beyond the allowed size.", "DOCUMENT_ARCHIVE_SIZE_LIMIT");
    }
    entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
    offset = end;
  }

  return { entries, totalUncompressed };
}

function readZipEntry(fileData, entry) {
  const { localOffset, compressedSize, uncompressedSize, method } = entry;
  if (localOffset + 30 > fileData.length || fileData.readUInt32LE(localOffset) !== 0x04034b50) {
    throw documentError(`Invalid ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");
  }

  const nameLength = fileData.readUInt16LE(localOffset + 26);
  const extraLength = fileData.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + compressedSize;
  if (dataEnd > fileData.length) throw documentError(`Truncated ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");

  const compressed = fileData.subarray(dataStart, dataEnd);
  let output;
  if (method === 0) output = Buffer.from(compressed);
  else if (method === 8) {
    try { output = zlib.inflateRawSync(compressed); }
    catch (error) { throw documentError(`Could not decompress ZIP entry: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID"); }
  } else {
    throw new Error(`Unsupported ZIP compression method ${method} for ${entry.name}.`);
  }

  if (output.length !== uncompressedSize) {
    throw documentError(`ZIP entry size mismatch: ${entry.name}`, "DOCUMENT_ARCHIVE_INVALID");
  }
  return output;
}

async function inspectZip(fileData) {
  return parseZipEntries(fileData);
}

async function unzipText(fileData, entryName) {
  const { entries } = parseZipEntries(fileData);
  const normalized = String(entryName).replace(/\\/g, "/");
  const entry = entries.find(item => item.name === normalized);
  if (!entry) throw new Error(`ZIP entry not found: ${normalized}`);
  return readZipEntry(fileData, entry).toString("utf8");
}

async function unzipList(fileData) {
  return parseZipEntries(fileData).entries.map(entry => entry.name);
}

async function ocrPdfBuffer(data) {
  return withTempDir("smart-study-pdf-ocr-", async (dir) => {
    const pdfPath = path.join(dir, "source.pdf");
    await fs.promises.writeFile(pdfPath, data);
    try {
      await execFileAsync("pdftoppm", ["-f", "1", "-l", String(Math.max(1, Number(process.env.DOCUMENT_OCR_MAX_PAGES || 30))), "-r", "150", "-png", pdfPath, path.join(dir, "page")], { maxBuffer: 5 * 1024 * 1024, timeout: OFFICE_TIMEOUT });
    } catch (error) {
      throw new Error(`Scanned PDF rendering failed: ${error.message}`);
    }
    const images = (await fs.promises.readdir(dir)).filter((name) => /^page-\d+\.png$/i.test(name)).sort();
    const segments = [];
    for (let i = 0; i < images.length; i += 1) {
      try {
        const { stdout } = await execFileAsync("tesseract", [path.join(dir, images[i]), "stdout", "--psm", "3"], { maxBuffer: 20 * 1024 * 1024, timeout: OCR_TIMEOUT });
        const text = cleanText(stdout);
        if (text) segments.push({ text, metadata: { sourceType: "pdf", page: i + 1, extraction: "ocr" } });
      } catch {}
      if (cleanText(segments.map((x) => x.text).join("\n")).length >= MAX_EXTRACTED_CHARS) break;
    }
    return segments;
  });
}

async function extractPdfBuffer(data, pdfParser, { ocrFallback = true } = {}) {
  if (!pdfParser) throw new Error("PDF parser is unavailable.");
  const parser = new pdfParser({ data });
  try {
    const result = await parser.getText();
    let segments = pdfSegments(result);
    let text = cleanText(segments.map((s) => s.text).join("\n"));
    if (ocrFallback && text.length < 40) {
      try {
        const ocrSegments = await ocrPdfBuffer(data);
        const ocrText = cleanText(ocrSegments.map((s) => s.text).join("\n"));
        if (ocrText.length > text.length) { segments = ocrSegments; text = ocrText; }
      } catch {}
    }
    return { text, pages: result.total || result.numpages || segments.length || null, segments };
  } finally { try { await parser.destroy(); } catch {} }
}

function pdfSegments(result) {
  if (Array.isArray(result?.pages) && result.pages.length) {
    return result.pages.map((page, i) => ({
      text: cleanText(page.text || page.content || page.str || ""),
      metadata: { sourceType: "pdf", page: i + 1 }
    })).filter((x) => x.text);
  }
  const raw = String(result?.text || "");
  const parts = raw.split(/\f|\u000c/g).map(cleanText).filter(Boolean);
  if (parts.length > 1) return parts.map((text, i) => ({ text, metadata: { sourceType: "pdf", page: i + 1 } }));
  return [{ text: cleanText(raw), metadata: { sourceType: "pdf" } }];
}

async function convertOfficeToPdf(file, extension) {
  return withTempDir("smart-study-office-", async (dir) => {
    const input = path.join(dir, `source${extension}`);
    await fs.promises.writeFile(input, file.data);
    try {
      await execFileAsync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", dir, input], {
        maxBuffer: 10 * 1024 * 1024,
        timeout: OFFICE_TIMEOUT
      });
    } catch (error) {
      throw new Error(`Office document conversion failed. Install LibreOffice/soffice or provide a text-readable file: ${error.message}`);
    }
    const pdfPath = path.join(dir, "source.pdf");
    const pdf = await fs.promises.readFile(pdfPath).catch(() => null);
    if (!pdf?.length) throw new Error("Office document conversion produced no readable PDF.");
    return pdf;
  });
}

async function extractOfficeViaPdf(file, pdfParser, extension, type) {
  const pdf = await convertOfficeToPdf(file, extension);
  const extracted = await extractPdfBuffer(pdf, pdfParser);
  return {
    text: extracted.text,
    pages: extracted.pages,
    type,
    segments: extracted.segments.map((s) => ({ ...s, metadata: { ...s.metadata, sourceType: type } }))
  };
}

async function extractDocx(file, pdfParser) {
  let xmlText = "";
  try {
    const xml = await unzipText(file.data, "word/document.xml");
    xmlText = cleanText(xmlToText(xml));
  } catch (error) {
    if (isDocumentSafetyError(error)) throw error;
  }
  try {
    const rendered = await extractOfficeViaPdf(file, pdfParser, ".docx", "docx");
    const merged = cleanText([xmlText, rendered.text].filter(Boolean).join("\n"));
    return { text: merged, pages: rendered.pages, type: "docx", segments: [{ text: merged, metadata: { sourceType: "docx" } }] };
  } catch (error) {
    if (xmlText.length >= 40) return { text: xmlText, pages: null, type: "docx", segments: [{ text: xmlText, metadata: { sourceType: "docx" } }] };
    throw error;
  }
}

async function extractPptx(file, pdfParser) {
  let xmlSegments = [];
  try {
    const entries = await unzipList(file.data);
    const slides = entries.filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => Number(a.match(/slide(\d+)\.xml/i)[1]) - Number(b.match(/slide(\d+)\.xml/i)[1]));
    for (const entry of slides) {
      const slideNumber = Number(entry.match(/slide(\d+)\.xml/i)[1]);
      const xml = await unzipText(file.data, entry);
      const text = cleanText(xmlToText(xml));
      if (text) xmlSegments.push({ text, metadata: { sourceType: "pptx", slide: slideNumber } });
    }
  } catch (error) {
    if (isDocumentSafetyError(error)) throw error;
  }

  let rendered = null;
  try { rendered = await extractOfficeViaPdf(file, pdfParser, ".pptx", "pptx"); } catch {}

  const xmlText = cleanText(xmlSegments.map((s) => `Slide ${s.metadata.slide}: ${s.text}`).join("\n"));
  const renderedText = cleanText(rendered?.text || "");
  const renderedAddsCoverage = renderedText && (!xmlText || renderedText.length > Math.max(xmlText.length * 1.15, xmlText.length + 120));
  const merged = cleanText([xmlText, renderedAddsCoverage ? renderedText : ""].filter(Boolean).join("\n"));
  if (!merged) throw new Error("The PowerPoint contains no readable text. If the slides are image-only, provide slide images or enable LibreOffice/Tesseract for OCR fallback.");
  const segments = xmlSegments.length ? [...xmlSegments] : [];
  if (renderedAddsCoverage) segments.push(...(rendered?.segments || []).map(s => ({ ...s, metadata: { ...(s.metadata || {}), sourceType: "pptx-rendered" } })));
  return { text: merged, pages: rendered?.pages || xmlSegments.length || null, type: "pptx", segments: segments.length ? segments : (rendered?.segments || []) };
}

async function extractLegacyOffice(file, pdfParser, extension, type) {
  return extractOfficeViaPdf(file, pdfParser, extension, type);
}

async function extractXlsx(file) {
  const entries = await unzipList(file.data);
  const sharedStrings = new Map();
  if (entries.includes("xl/sharedStrings.xml")) {
    const xml = await unzipText(file.data, "xl/sharedStrings.xml");
    const items = String(xml).split(/<si[ >]/i).slice(1).map(x => x.split(/<\/si>/i)[0]);
    items.forEach((item, index) => sharedStrings.set(index, cleanText(xmlToText(item))));
  }
  const sheetEntries = entries.filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort((a,b) => Number(a.match(/sheet(\d+)\.xml/i)[1]) - Number(b.match(/sheet(\d+)\.xml/i)[1]));
  const segments = [];
  for (const entry of sheetEntries) {
    const sheetNumber = Number(entry.match(/sheet(\d+)\.xml/i)[1]);
    const xml = await unzipText(file.data, entry);
    const rows = [];
    const rowMatches = String(xml).match(/<row[\s\S]*?<\/row>/gi) || [];
    for (const row of rowMatches) {
      const cells = [];
      const cellMatches = row.match(/<c\b[\s\S]*?<\/c>/gi) || [];
      for (const cell of cellMatches) {
        const type = (cell.match(/\bt="([^"]+)"/i) || [])[1] || "";
        const value = (cell.match(/<v>([\s\S]*?)<\/v>/i) || [])[1] || "";
        if (!value && type !== "inlineStr") continue;
        if (type === "s") cells.push(sharedStrings.get(Number(value)) || value);
        else if (type === "inlineStr") cells.push(cleanText(xmlToText(cell)));
        else cells.push(decodeXmlEntities(value));
      }
      if (cells.length) rows.push(cells.join(" | "));
    }
    const text = cleanText(rows.join("\n"));
    if (text) segments.push({ text, metadata: { sourceType: "xlsx", sheet: sheetNumber } });
  }
  const text = cleanText(segments.map((x) => `Sheet ${x.metadata.sheet}:\n${x.text}`).join("\n\n"));
  if (!text) throw new Error("The spreadsheet contains no readable cell text.");
  return { text, pages: sheetEntries.length || null, type: "spreadsheet", segments };
}

async function extractOdtLike(file, type) {
  const entry = type === "odt" ? "content.xml" : "content.xml";
  const xml = await unzipText(file.data, entry);
  const text = cleanText(xmlToText(xml));
  if (!text) throw new Error(`The ${type.toUpperCase()} file contains no readable text.`);
  return { text, pages: null, type, segments: [{ text, metadata: { sourceType: type } }] };
}

function cleanRtf(text) {
  return cleanText(String(text || "")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " "));
}

async function extractSpreadsheet(file, pdfParser) {
  const ext = path.extname(file.name).toLowerCase();
  if (ext === ".xlsx") {
    try { return await extractXlsx(file); } catch (error) {
      if (isDocumentSafetyError(error)) throw error;
      return extractOfficeViaPdf(file, pdfParser, ext, "spreadsheet");
    }
  }
  return extractOfficeViaPdf(file, pdfParser, ext, "spreadsheet");
}

async function extractTextLike(file, ext) {
  const raw = file.data.toString("utf8");
  const text = ext === "rtf" ? cleanRtf(raw) : ext === "json" ? cleanText(JSON.stringify(JSON.parse(raw), null, 2)) : cleanText(raw);
  return { text, pages: null, type: ext === "md" ? "md" : ext === "rtf" ? "rtf" : ext === "json" ? "json" : "text", segments: [{ text, metadata: { sourceType: ext } }] };
}

async function extractImage(file, gateway) {
  // OCR is the reliable local path for study-pack images. Run it first so an
  // AI vision quota/provider error can never make a readable image fail.
  let ocrText = "";
  let ocrError = null;
  try {
    await withTempFile(file.data, path.extname(file.name || ".png"), async (imagePath) => {
      const { stdout } = await execFileAsync(
        "tesseract",
        [imagePath, "stdout", "--psm", "3"],
        { maxBuffer: 20 * 1024 * 1024, timeout: OCR_TIMEOUT }
      );
      ocrText = cleanText(stdout);
    });
  } catch (error) {
    ocrError = error;
  }

  // Only use vision when OCR did not produce useful text. This avoids duplicate
  // content and keeps image study packs independent of an external vision API.
  let visionText = "";
  if (ocrText.length < 40 && gateway) {
    try {
      const response = await gateway.extractImage({
        data: file.data.toString("base64"),
        mimeType: file.mimetype,
        prompt: "Extract all readable text from this image accurately. Preserve headings, numbered lists, bullet points, formulas, and technical terms. Return only the extracted text."
      });
      visionText = cleanText(response.text);
    } catch {}
  }

  const text = cleanText(ocrText || visionText);
  if (!text) {
    const detail = ocrError?.message ? ` OCR error: ${ocrError.message}` : "";
    throw new Error(`No readable text could be extracted from the image. Try a clearer image or higher resolution.${detail}`);
  }

  return {
    text,
    pages: null,
    type: "image",
    sourceType: "image",
    segments: [{
      text,
      metadata: {
        sourceType: "image",
        extraction: ocrText ? "ocr" : "vision"
      }
    }]
  };
}

async function extractHtml(file) {
  const text = cleanText(String(file.data.toString("utf8")).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  return { text, pages: null, type: "html", segments: [{ text, metadata: { sourceType: "html" } }] };
}

async function extractUploadedFile(file, { pdfParser, gateway } = {}) {
  if (!file?.data) throw new Error("No file data received.");
  const mime = String(file.mimetype || "").toLowerCase();
  const name = file.name || "document";
  const ext = path.extname(name).toLowerCase();

  if (mime === "application/pdf" || ext === ".pdf") {
    const extracted = await extractPdfBuffer(file.data, pdfParser);
    return { ...extracted, type: "pdf" };
  }

  const isZippedOffice = [".docx", ".pptx", ".xlsx", ".ods", ".odt", ".odp"].includes(ext) || /wordprocessingml|presentationml|spreadsheetml|opendocument\./i.test(mime);
  if (isZippedOffice) await inspectZip(file.data);
  if (ext === ".docx" || mime.includes("wordprocessingml.document")) return extractDocx(file, pdfParser);
  if (ext === ".doc" || mime === "application/msword") return extractLegacyOffice(file, pdfParser, ".doc", "doc");
  if (ext === ".pptx" || mime.includes("presentationml.presentation")) return extractPptx(file, pdfParser);
  if (ext === ".ppt" || mime === "application/vnd.ms-powerpoint") return extractLegacyOffice(file, pdfParser, ".ppt", "ppt");
  if ([".xlsx", ".xls", ".ods"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("opendocument.spreadsheet")) return extractSpreadsheet(file, pdfParser);
  if ([".odt"].includes(ext) || mime.includes("opendocument.text")) { try { return await extractOdtLike(file, "odt"); } catch (error) { if (isDocumentSafetyError(error)) throw error; return extractOfficeViaPdf(file, pdfParser, ext, "odt"); } }
  if ([".odp"].includes(ext) || mime.includes("opendocument.presentation")) { try { return await extractOdtLike(file, "odp"); } catch (error) { if (isDocumentSafetyError(error)) throw error; return extractOfficeViaPdf(file, pdfParser, ext, "odp"); } }
  if ([".html", ".htm"].includes(ext) || mime === "text/html") return extractHtml(file);
  if ([".txt", ".md", ".csv", ".json", ".rtf"].includes(ext) || mime.startsWith("text/")) return extractTextLike(file, ext.slice(1) || "text");
  if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".tif"].includes(ext)) return extractImage(file, gateway);

  throw new Error("Unsupported file type. Supported: PDF, Word (DOC/DOCX), PowerPoint (PPT/PPTX), Excel (XLS/XLSX), ODT/ODP, TXT, Markdown, CSV, JSON, HTML, RTF and images.");
}

module.exports = { createDocumentId, extractUploadedFile, cleanText };
