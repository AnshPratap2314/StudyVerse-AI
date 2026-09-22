const { Agent } = require("./agent-base.cjs");
class RAGAgent extends Agent { async execute({query,documentId,documentIds,topK=6,ownerId}) { const sources=await this.rag.retrieve(query,{documentId,documentIds,topK,ownerId}); return {sources,context:this.rag.buildContext(sources)}; } }
module.exports={RAGAgent};
