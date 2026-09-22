const { Agent } = require("./agent-base.cjs");
class ResearchAgent extends Agent { async execute({question,sources=[]}) { const prompt=`You are the Research Agent. Use only the supplied sources. Extract concise evidence and source numbers.\nQUESTION:\n${question}\nSOURCES:\n${sources.map((s,i)=>`[${i+1}] ${s.documentName}: ${s.text}`).join("\n\n")}`;return this.gateway.generateSlot("researcher",{prompt,json:false}); } }
module.exports={ResearchAgent};
