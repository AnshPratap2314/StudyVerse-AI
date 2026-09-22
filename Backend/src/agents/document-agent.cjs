const { Agent } = require("./agent-base.cjs");
class DocumentAgent extends Agent { async execute({file,documentId,documentName,documentType,text,segments,metadata,ownerId}) { return this.rag.ingest({documentId,documentName,documentType,text,segments,metadata,ownerId}); } }
module.exports={DocumentAgent};
