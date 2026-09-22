const { Agent } = require("./agent-base.cjs");
class MemoryAgent extends Agent { constructor({gateway,rag,memory}){super("memory",{gateway,rag});this.memory=memory;} async execute({userId="anonymous",sessionId="default",action="context",message,limit=12}){if(action==="remember"&&message){return await this.memory.addMemory({userId,type:"conversation_fact",key:`fact:${Date.now()}`,value:String(message),source:"user"});}return await this.memory.context(userId,sessionId,limit);} }
module.exports={MemoryAgent};
