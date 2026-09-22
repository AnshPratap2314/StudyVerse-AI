// function safeJson(text, fallback = {}) { try { return JSON.parse(text); } catch { return fallback; } }

// class Orchestrator {
//   constructor({gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}) { Object.assign(this,{gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}); this.maxAgents=Math.max(1,Number(process.env.MAX_AGENT_CALLS||3)); this.maxSources=Math.max(1,Number(process.env.MAX_RAG_SOURCES||8)); }

//   async plan({goal,hasDocument=false,contextMode="auto",userId="anonymous",sessionId="default"}) {
//     const prompt=`You are the Router/Orchestrator for Smart Study AI. Return JSON only: {"workflow":"study_pack|document_chat|chat","needsRag":boolean,"difficulty":"easy|medium|hard","specialists":["researcher","teacher","reasoner"],"reason":"short"}. Context mode: ${contextMode}. Document questions need RAG. General questions may use general knowledge. Prefer the smallest useful council.`;
//     try {
//       const r=await this.gateway.generateSlot("router",{prompt:`${prompt}\nUSER GOAL:\n${goal}\nHAS DOCUMENT:${hasDocument}`,userId,sessionId,budgetKey:`${userId}:${sessionId}`});
//       const p=safeJson(r.text,{}); const difficulty=["easy","medium","hard"].includes(p.difficulty)?p.difficulty:"medium";
//       let specialists=this.gateway.routeSpecialists({difficulty,maxAgents:this.maxAgents});
//       if(Array.isArray(p.specialists)&&p.specialists.length) specialists=p.specialists.filter(x=>["researcher","teacher","reasoner"].includes(x)).slice(0,this.maxAgents);
//       if(!specialists.length) specialists=["teacher"];
//       const workflow=contextMode==="general"?"chat":contextMode==="study"&&hasDocument?"study_pack":contextMode==="document"&&hasDocument?"document_chat":(["study_pack","document_chat","chat"].includes(p.workflow)?p.workflow:(hasDocument?"document_chat":"chat"));
//       return {workflow,needsRag:Boolean(hasDocument && (contextMode!=="general")),difficulty,specialists,reason:p.reason||"Router decision",model:r.model};
//     } catch {
//       return {workflow:contextMode==="study"&&hasDocument?"study_pack":hasDocument&&contextMode!=="general"?"document_chat":"chat",needsRag:Boolean(hasDocument&&contextMode!=="general"),difficulty:"medium",specialists:this.gateway.routeSpecialists({difficulty:"medium",maxAgents:this.maxAgents}),reason:"Router fallback"};
//     }
//   }

//   async planAndExecute(args){
//     const isStudyPack = String(args.contextMode || "auto") === "study" && Boolean(args.documentId || (Array.isArray(args.documentIds) && args.documentIds.length) || args.text);
//     if (isStudyPack) {
//       const plan = { workflow: "study_pack", needsRag: true, difficulty: args.studyPreferences?.difficulty === "hard" ? "hard" : args.studyPreferences?.difficulty === "easy" ? "easy" : "medium", specialists: [], reason: "Direct study-pack generation to minimize provider calls and preserve quota.", model: this.gateway.modelSlots.synthesizer.model };
//       return { ...await this.execute({ ...args, type: "study_pack", plan }), plan };
//     }
//     const plan=await this.plan({goal:args.goal,hasDocument:Boolean(args.documentId||(Array.isArray(args.documentIds)&&args.documentIds.length)||args.text),contextMode:args.contextMode||"auto",userId:args.userId||"anonymous",sessionId:args.sessionId||"default"});
//     return {...await this.execute({...args,type:plan.workflow,plan}),plan};
//   }

//   memoryText(memory){if(!memory)return "";const history=memory.history||[];const facts=memory.memories||[];const prefs=memory.preferences||{};return [`RECENT CONVERSATION:\n${history.map(x=>`${x.role}: ${x.content}`).join("\n")}`,`SAVED FACTS:\n${facts.map(x=>`${x.key}: ${x.value}`).join("\n")}`,`PREFERENCES:\n${JSON.stringify(prefs)}`].join("\n\n");}

//   async council({question,context,sources,specialists,mode,memoryContext="",tutorMode="normal",userId="anonymous",sessionId="default"}) {
//     const sourceText=sources.length?sources.map((s,i)=>`[${i+1}] ${s.documentName}${s.metadata?.page?` page ${s.metadata.page}`:""}${s.metadata?.slide?` slide ${s.metadata.slide}`:""}\n${s.text}`).join("\n\n"):"(no retrieved document sources)";
//     const prompts={researcher:"You are the evidence researcher. For document mode, use only supplied sources. For general mode, provide careful relevant knowledge and mark uncertainty.",teacher:"You are the teaching specialist. Explain clearly for a student. Do not invent details from documents.",reasoner:"You are the reasoning specialist. Check assumptions, contradictions and limitations."};
//     const results=await this.gateway.generateMany(specialists.slice(0,this.maxAgents),(slot)=>({prompt:`${prompts[slot]}\nMODE:${mode}\nQUESTION:\n${question}\n${memoryContext}\nSOURCES:\n${sourceText}\nRAG CONTEXT:\n${context||"none"}`,json:false,maxRetries:2,userId,sessionId,budgetKey:`${userId}:${sessionId}`}));
//     const successful=results.filter(x=>x.ok); const specialistContext=successful.map(r=>`### ${r.slot}\n${r.text}`).join("\n\n");
//     const critic=await this.gateway.generateSlot("critic",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`Review the candidate response evidence. Return JSON only: {"approved":boolean,"confidence":number,"issues":string[],"unsupportedClaims":string[],"bestPoints":string[]}.\nQUESTION:${question}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}`,json:true}).catch(e=>({text:JSON.stringify({approved:true,confidence:.5,issues:[e.message],unsupportedClaims:[],bestPoints:[]}),model:"unavailable",provider:"fallback"}));
//     const tutorInstructions={beginner:"Use simple language and tiny steps.",normal:"Teach clearly and directly.",socratic:"Guide with questions and reveal the answer after reasoning.",exam:"Focus on exam scoring, definitions, formulas and common traps.",interview:"Teach like an interview coach and include follow-up thinking.",revision:"Use concise active-recall and rapid revision structure."}[tutorMode]||"Teach clearly and directly.";
//     const grounding=mode==="document_chat"?"Use ONLY the supplied document sources for factual claims. If evidence is insufficient, say so.":"Answer using general knowledge plus the conversation context. Do not pretend general knowledge came from documents.";
//     const final=await this.gateway.generateSlot("synthesizer",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`You are the Final Synthesizer for a real student-facing learning product. ${grounding}\nReturn a polished, copy-ready Markdown answer, not JSON. Never mention being an AI, the model, the prompt, agents, orchestration, or internal processing. Do not produce filler such as "Sure!" or "As an AI". Answer the student's actual question first. Use short headings, bullets, numbered steps, tables only when useful, and fenced code blocks for code. Preserve exact technical terms, formulas and commands when they are supported by the evidence. For programming questions, give code that can be copied directly and then explain it briefly. For conceptual questions, include a direct definition, explanation, a concrete example, and a short takeaway when appropriate. If the available evidence is insufficient, say exactly what is missing instead of inventing facts. Tutor mode: ${tutorMode}. ${tutorInstructions}\nQUESTION:${question}\nMEMORY:${memoryContext}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}\nCRITIC:${critic.text}`});
//     return {reply:final.text,specialistResults:results,critic:safeJson(critic.text,{approved:true,confidence:.5,issues:[],unsupportedClaims:[],bestPoints:[]}),modelsUsed:[{role:"router",model:this.gateway.modelSlots.router.model},...successful.map(r=>({role:r.slot,model:r.model})),{role:"critic",model:critic.model},{role:"synthesizer",model:final.model}]};
//   }

//   async execute({type="chat",question,text,title,documentId,documentIds=[],userId="anonymous",sessionId="default",topK=6,plan,contextMode="auto",tutorMode="normal",studyPreferences={}}) {
//     const started=Date.now(); const memory=await this.memoryAgent.execute({userId,sessionId,action:"context",limit:12});
//     if(question)await this.memory.addMessage({userId,sessionId,role:"user",content:question,metadata:{type,documentId:documentId||null}});

//     if(type==="study_pack"){
//       if (!this.studyAgent) throw Object.assign(new Error("The study-pack LLM is not configured."), { code: "NO_STUDY_GENERATOR", status: 503 });
//       const ragResults=await this.ragAgent.execute({query:text||question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
//       const sourceMaterial = String(text || "").slice(0, 60000);
//       const study=await this.studyAgent.execute({
//         text: sourceMaterial,
//         title: title || "Study Notes",
//         context: String(ragResults.context || "").slice(0, 50000),
//         task:"Generate the complete validated study pack in one high-quality LLM pass. Prioritize correctness, coverage and practical student usefulness.",
//         studyPreferences
//       });
//       await this.memory.addMessage({userId,sessionId,role:"assistant",content:JSON.stringify(study),metadata:{type}});
//       return {success:true,type,...study,sources:this.rag.formatSources(ragResults.sources),review:{approved:true,confidence:1,issues:[],unsupportedClaims:[],bestPoints:[]},memoryUsed:true,orchestration:{task:type,agents:["memory","rag","study"],modelsUsed:[{role:"synthesizer",model:study.metadata?.model || this.gateway.modelSlots.synthesizer.model}],latencyMs:Date.now()-started,parallelBranches:1,userId,sessionId}};
//     }

//     if(type==="document_chat"){
//       const ragResults=await this.ragAgent.execute({query:question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
//       const council=await this.council({userId,sessionId,question,context:ragResults.context,sources:ragResults.sources,specialists:plan?.specialists?.length?plan.specialists:["researcher","teacher"],mode:"document_chat",memoryContext:this.memoryText(memory),tutorMode});
//       await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type,sources:ragResults.sources.map(s=>s.documentId)}});
//       return {success:true,type,reply:council.reply,sources:this.rag.formatSources(ragResults.sources),review:council.critic,memoryUsed:true,orchestration:{task:type,agents:["router","memory","document","rag",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
//     }

//     const council=await this.council({userId,sessionId,question,context:"",sources:[],specialists:plan?.specialists?.length?plan.specialists:["teacher"],mode:"general_chat",memoryContext:this.memoryText(memory),tutorMode});
//     await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type:"chat"}});
//     return {success:true,type:"chat",reply:council.reply,review:council.critic,memoryUsed:true,orchestration:{task:"chat",agents:["router","memory",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
//   }
// }
// module.exports={Orchestrator};


/// 2nd and working images not
// function safeJson(text, fallback = {}) { try { return JSON.parse(text); } catch { return fallback; } }

// class Orchestrator {
//   constructor({gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}) { Object.assign(this,{gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}); this.maxAgents=Math.max(1,Number(process.env.MAX_AGENT_CALLS||3)); this.maxSources=Math.max(1,Number(process.env.MAX_RAG_SOURCES||8)); }

//   async plan({goal,hasDocument=false,contextMode="auto",userId="anonymous",sessionId="default"}) {
//     const prompt=`You are the Router/Orchestrator for Smart Study AI. Return JSON only: {"workflow":"study_pack|document_chat|chat","needsRag":boolean,"difficulty":"easy|medium|hard","specialists":["researcher","teacher","reasoner"],"reason":"short"}. Context mode: ${contextMode}. Document questions need RAG. General questions may use general knowledge. Prefer the smallest useful council.`;
//     try {
//       const r=await this.gateway.generateSlot("router",{prompt:`${prompt}\nUSER GOAL:\n${goal}\nHAS DOCUMENT:${hasDocument}`,userId,sessionId,budgetKey:`${userId}:${sessionId}`});
//       const p=safeJson(r.text,{}); const difficulty=["easy","medium","hard"].includes(p.difficulty)?p.difficulty:"medium";
//       let specialists=this.gateway.routeSpecialists({difficulty,maxAgents:this.maxAgents});
//       if(Array.isArray(p.specialists)&&p.specialists.length) specialists=p.specialists.filter(x=>["researcher","teacher","reasoner"].includes(x)).slice(0,this.maxAgents);
//       if(!specialists.length) specialists=["teacher"];
//       const workflow=contextMode==="general"?"chat":contextMode==="study"&&hasDocument?"study_pack":contextMode==="document"&&hasDocument?"document_chat":(["study_pack","document_chat","chat"].includes(p.workflow)?p.workflow:(hasDocument?"document_chat":"chat"));
//       return {workflow,needsRag:Boolean(hasDocument && (contextMode!=="general")),difficulty,specialists,reason:p.reason||"Router decision",model:r.model};
//     } catch {
//       return {workflow:contextMode==="study"&&hasDocument?"study_pack":hasDocument&&contextMode!=="general"?"document_chat":"chat",needsRag:Boolean(hasDocument&&contextMode!=="general"),difficulty:"medium",specialists:this.gateway.routeSpecialists({difficulty:"medium",maxAgents:this.maxAgents}),reason:"Router fallback"};
//     }
//   }

//   async planAndExecute(args){
//     const isStudyPack = String(args.contextMode || "auto") === "study" && Boolean(args.documentId || (Array.isArray(args.documentIds) && args.documentIds.length) || args.text);
//     if (isStudyPack) {
//       const plan = { workflow: "study_pack", needsRag: true, difficulty: args.studyPreferences?.difficulty === "hard" ? "hard" : args.studyPreferences?.difficulty === "easy" ? "easy" : "medium", specialists: [], reason: "Direct study-pack generation to minimize provider calls and preserve quota.", model: this.gateway.modelSlots.synthesizer.model };
//       return { ...await this.execute({ ...args, type: "study_pack", plan }), plan };
//     }
//     const plan=await this.plan({goal:args.goal,hasDocument:Boolean(args.documentId||(Array.isArray(args.documentIds)&&args.documentIds.length)||args.text),contextMode:args.contextMode||"auto",userId:args.userId||"anonymous",sessionId:args.sessionId||"default"});
//     return {...await this.execute({...args,type:plan.workflow,plan}),plan};
//   }

//   memoryText(memory){if(!memory)return "";const history=memory.history||[];const facts=memory.memories||[];const prefs=memory.preferences||{};return [`RECENT CONVERSATION:\n${history.map(x=>`${x.role}: ${x.content}`).join("\n")}`,`SAVED FACTS:\n${facts.map(x=>`${x.key}: ${x.value}`).join("\n")}`,`PREFERENCES:\n${JSON.stringify(prefs)}`].join("\n\n");}

//   async council({question,context,sources,specialists,mode,memoryContext="",tutorMode="normal",userId="anonymous",sessionId="default"}) {
//     const sourceText=sources.length?sources.map((s,i)=>`[${i+1}] ${s.documentName}${s.metadata?.page?` page ${s.metadata.page}`:""}${s.metadata?.slide?` slide ${s.metadata.slide}`:""}\n${s.text}`).join("\n\n"):"(no retrieved document sources)";
//     const prompts={researcher:"You are the evidence researcher. For document mode, use only supplied sources. For general mode, provide careful relevant knowledge and mark uncertainty.",teacher:"You are the teaching specialist. Explain clearly for a student. Do not invent details from documents.",reasoner:"You are the reasoning specialist. Check assumptions, contradictions and limitations."};
//     const results=await this.gateway.generateMany(specialists.slice(0,this.maxAgents),(slot)=>({prompt:`${prompts[slot]}\nMODE:${mode}\nQUESTION:\n${question}\n${memoryContext}\nSOURCES:\n${sourceText}\nRAG CONTEXT:\n${context||"none"}`,json:false,maxRetries:2,userId,sessionId,budgetKey:`${userId}:${sessionId}`}));
//     const successful=results.filter(x=>x.ok); const specialistContext=successful.map(r=>`### ${r.slot}\n${r.text}`).join("\n\n");
//     const critic=await this.gateway.generateSlot("critic",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`Review the candidate response evidence. Return JSON only: {"approved":boolean,"confidence":number,"issues":string[],"unsupportedClaims":string[],"bestPoints":string[]}.\nQUESTION:${question}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}`,json:true}).catch(e=>({text:JSON.stringify({approved:true,confidence:.5,issues:[e.message],unsupportedClaims:[],bestPoints:[]}),model:"unavailable",provider:"fallback"}));
//     const tutorInstructions={beginner:"Use simple language and tiny steps.",normal:"Teach clearly and directly.",socratic:"Guide with questions and reveal the answer after reasoning.",exam:"Focus on exam scoring, definitions, formulas and common traps.",interview:"Teach like an interview coach and include follow-up thinking.",revision:"Use concise active-recall and rapid revision structure."}[tutorMode]||"Teach clearly and directly.";
//     const grounding=mode==="document_chat"?"Use ONLY the supplied document sources for factual claims. If evidence is insufficient, say so.":"Answer using general knowledge plus the conversation context. Do not pretend general knowledge came from documents.";
//     const final=await this.gateway.generateSlot("synthesizer",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`You are the Final Synthesizer for a real student-facing learning product. ${grounding}\nReturn a polished, copy-ready Markdown answer, not JSON. Never mention being an AI, the model, the prompt, agents, orchestration, or internal processing. Do not produce filler such as "Sure!" or "As an AI". Answer the student's actual question first. Use short headings, bullets, numbered steps, tables only when useful, and fenced code blocks for code. Preserve exact technical terms, formulas and commands when they are supported by the evidence. For programming questions, give code that can be copied directly and then explain it briefly. For conceptual questions, include a direct definition, explanation, a concrete example, and a short takeaway when appropriate. If the available evidence is insufficient, say exactly what is missing instead of inventing facts. Tutor mode: ${tutorMode}. ${tutorInstructions}\nQUESTION:${question}\nMEMORY:${memoryContext}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}\nCRITIC:${critic.text}`});
//     return {reply:final.text,specialistResults:results,critic:safeJson(critic.text,{approved:true,confidence:.5,issues:[],unsupportedClaims:[],bestPoints:[]}),modelsUsed:[{role:"router",model:this.gateway.modelSlots.router.model},...successful.map(r=>({role:r.slot,model:r.model})),{role:"critic",model:critic.model},{role:"synthesizer",model:final.model}]};
//   }

//   async execute({type="chat",question,text,title,documentId,documentIds=[],userId="anonymous",sessionId="default",topK=6,plan,contextMode="auto",tutorMode="normal",studyPreferences={}}) {
//     const started=Date.now(); const memory=await this.memoryAgent.execute({userId,sessionId,action:"context",limit:12});
//     if(question)await this.memory.addMessage({userId,sessionId,role:"user",content:question,metadata:{type,documentId:documentId||null}});

//     if(type==="study_pack"){
//       if (!this.studyAgent) throw Object.assign(new Error("The study-pack LLM is not configured."), { code: "NO_STUDY_GENERATOR", status: 503 });
//       let ragResults = { sources: [], context: "" };
//       try {
//         ragResults = await this.ragAgent.execute({query:text||question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
//       } catch (ragError) {
//         // Study-pack generation must still work when the optional vector index is
//         // unavailable. The uploaded/pasted source text remains the primary source.
//         console.warn("[Orchestrator] RAG unavailable for study pack; continuing with source text:", ragError?.message || ragError);
//       }
//       const sourceMaterial = String(text || "").slice(0, 60000);
//       const study=await this.studyAgent.execute({
//         text: sourceMaterial,
//         title: title || "Study Notes",
//         context: String(ragResults.context || "").slice(0, 50000),
//         task:"Generate the complete validated study pack in one high-quality LLM pass. Prioritize correctness, coverage and practical student usefulness.",
//         studyPreferences
//       });
//       await this.memory.addMessage({userId,sessionId,role:"assistant",content:JSON.stringify(study),metadata:{type}});
//       return {success:true,type,...study,sources:this.rag.formatSources(ragResults.sources),review:{approved:true,confidence:1,issues:[],unsupportedClaims:[],bestPoints:[]},memoryUsed:true,orchestration:{task:type,agents:["memory","rag","study"],modelsUsed:[{role:"synthesizer",model:study.metadata?.model || this.gateway.modelSlots.synthesizer.model}],latencyMs:Date.now()-started,parallelBranches:1,userId,sessionId}};
//     }

//     if(type==="document_chat"){
//       const ragResults=await this.ragAgent.execute({query:question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
//       const council=await this.council({userId,sessionId,question,context:ragResults.context,sources:ragResults.sources,specialists:plan?.specialists?.length?plan.specialists:["researcher","teacher"],mode:"document_chat",memoryContext:this.memoryText(memory),tutorMode});
//       await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type,sources:ragResults.sources.map(s=>s.documentId)}});
//       return {success:true,type,reply:council.reply,sources:this.rag.formatSources(ragResults.sources),review:council.critic,memoryUsed:true,orchestration:{task:type,agents:["router","memory","document","rag",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
//     }

//     const council=await this.council({userId,sessionId,question,context:"",sources:[],specialists:plan?.specialists?.length?plan.specialists:["teacher"],mode:"general_chat",memoryContext:this.memoryText(memory),tutorMode});
//     await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type:"chat"}});
//     return {success:true,type:"chat",reply:council.reply,review:council.critic,memoryUsed:true,orchestration:{task:"chat",agents:["router","memory",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
//   }
// }
// module.exports={Orchestrator};

//3rd working image not

// function safeJson(text, fallback = {}) { try { return JSON.parse(text); } catch { return fallback; } }

// class Orchestrator {
//   constructor({gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}) { Object.assign(this,{gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}); this.maxAgents=Math.max(1,Number(process.env.MAX_AGENT_CALLS||3)); this.maxSources=Math.max(1,Number(process.env.MAX_RAG_SOURCES||8)); }

//   async plan({goal,hasDocument=false,contextMode="auto",userId="anonymous",sessionId="default"}) {
//     const prompt=`You are the Router/Orchestrator for Smart Study AI. Return JSON only: {"workflow":"study_pack|document_chat|chat","needsRag":boolean,"difficulty":"easy|medium|hard","specialists":["researcher","teacher","reasoner"],"reason":"short"}. Context mode: ${contextMode}. Document questions need RAG. General questions may use general knowledge. Prefer the smallest useful council.`;
//     try {
//       const r=await this.gateway.generateSlot("router",{prompt:`${prompt}\nUSER GOAL:\n${goal}\nHAS DOCUMENT:${hasDocument}`,userId,sessionId,budgetKey:`${userId}:${sessionId}`});
//       const p=safeJson(r.text,{}); const difficulty=["easy","medium","hard"].includes(p.difficulty)?p.difficulty:"medium";
//       let specialists=this.gateway.routeSpecialists({difficulty,maxAgents:this.maxAgents});
//       if(Array.isArray(p.specialists)&&p.specialists.length) specialists=p.specialists.filter(x=>["researcher","teacher","reasoner"].includes(x)).slice(0,this.maxAgents);
//       if(!specialists.length) specialists=["teacher"];
//       const workflow=contextMode==="general"?"chat":contextMode==="study"&&hasDocument?"study_pack":contextMode==="document"&&hasDocument?"document_chat":(["study_pack","document_chat","chat"].includes(p.workflow)?p.workflow:(hasDocument?"document_chat":"chat"));
//       return {workflow,needsRag:Boolean(hasDocument && (contextMode!=="general")),difficulty,specialists,reason:p.reason||"Router decision",model:r.model};
//     } catch {
//       return {workflow:contextMode==="study"&&hasDocument?"study_pack":hasDocument&&contextMode!=="general"?"document_chat":"chat",needsRag:Boolean(hasDocument&&contextMode!=="general"),difficulty:"medium",specialists:this.gateway.routeSpecialists({difficulty:"medium",maxAgents:this.maxAgents}),reason:"Router fallback"};
//     }
//   }

//   async planAndExecute(args){
//     const isStudyPack = String(args.contextMode || "auto") === "study" && Boolean(args.documentId || (Array.isArray(args.documentIds) && args.documentIds.length) || args.text);
//     if (isStudyPack) {
//       const plan = { workflow: "study_pack", needsRag: true, difficulty: args.studyPreferences?.difficulty === "hard" ? "hard" : args.studyPreferences?.difficulty === "easy" ? "easy" : "medium", specialists: [], reason: "Direct study-pack generation to minimize provider calls and preserve quota.", model: this.gateway.modelSlots.synthesizer.model };
//       return { ...await this.execute({ ...args, type: "study_pack", plan }), plan };
//     }
//     const plan=await this.plan({goal:args.goal,hasDocument:Boolean(args.documentId||(Array.isArray(args.documentIds)&&args.documentIds.length)||args.text),contextMode:args.contextMode||"auto",userId:args.userId||"anonymous",sessionId:args.sessionId||"default"});
//     return {...await this.execute({...args,type:plan.workflow,plan}),plan};
//   }

//   memoryText(memory){if(!memory)return "";const history=memory.history||[];const facts=memory.memories||[];const prefs=memory.preferences||{};return [`RECENT CONVERSATION:\n${history.map(x=>`${x.role}: ${x.content}`).join("\n")}`,`SAVED FACTS:\n${facts.map(x=>`${x.key}: ${x.value}`).join("\n")}`,`PREFERENCES:\n${JSON.stringify(prefs)}`].join("\n\n");}

//   async council({question,context,sources,specialists,mode,memoryContext="",tutorMode="normal",userId="anonymous",sessionId="default"}) {
//     const sourceText=sources.length?sources.map((s,i)=>`[${i+1}] ${s.documentName}${s.metadata?.page?` page ${s.metadata.page}`:""}${s.metadata?.slide?` slide ${s.metadata.slide}`:""}\n${s.text}`).join("\n\n"):"(no retrieved document sources)";
//     const prompts={researcher:"You are the evidence researcher. For document mode, use only supplied sources. For general mode, provide careful relevant knowledge and mark uncertainty.",teacher:"You are the teaching specialist. Explain clearly for a student. Do not invent details from documents.",reasoner:"You are the reasoning specialist. Check assumptions, contradictions and limitations."};
//     const results=await this.gateway.generateMany(specialists.slice(0,this.maxAgents),(slot)=>({prompt:`${prompts[slot]}\nMODE:${mode}\nQUESTION:\n${question}\n${memoryContext}\nSOURCES:\n${sourceText}\nRAG CONTEXT:\n${context||"none"}`,json:false,maxRetries:2,userId,sessionId,budgetKey:`${userId}:${sessionId}`}));
//     const successful=results.filter(x=>x.ok); const specialistContext=successful.map(r=>`### ${r.slot}\n${r.text}`).join("\n\n");
//     const critic=await this.gateway.generateSlot("critic",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`Review the candidate response evidence. Return JSON only: {"approved":boolean,"confidence":number,"issues":string[],"unsupportedClaims":string[],"bestPoints":string[]}.\nQUESTION:${question}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}`,json:true}).catch(e=>({text:JSON.stringify({approved:true,confidence:.5,issues:[e.message],unsupportedClaims:[],bestPoints:[]}),model:"unavailable",provider:"fallback"}));
//     const tutorInstructions={beginner:"Use simple language and tiny steps.",normal:"Teach clearly and directly.",socratic:"Guide with questions and reveal the answer after reasoning.",exam:"Focus on exam scoring, definitions, formulas and common traps.",interview:"Teach like an interview coach and include follow-up thinking.",revision:"Use concise active-recall and rapid revision structure."}[tutorMode]||"Teach clearly and directly.";
//     const grounding=mode==="document_chat"?"Use ONLY the supplied document sources for factual claims. If evidence is insufficient, say so.":"Answer using general knowledge plus the conversation context. Do not pretend general knowledge came from documents.";
//     const final=await this.gateway.generateSlot("synthesizer",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`You are the Final Synthesizer for a real student-facing learning product. ${grounding}\nReturn a polished, copy-ready Markdown answer, not JSON. Never mention being an AI, the model, the prompt, agents, orchestration, or internal processing. Do not produce filler such as "Sure!" or "As an AI". Answer the student's actual question first. Use short headings, bullets, numbered steps, tables only when useful, and fenced code blocks for code. Preserve exact technical terms, formulas and commands when they are supported by the evidence. For programming questions, give code that can be copied directly and then explain it briefly. For conceptual questions, include a direct definition, explanation, a concrete example, and a short takeaway when appropriate. If the available evidence is insufficient, say exactly what is missing instead of inventing facts. Tutor mode: ${tutorMode}. ${tutorInstructions}\nQUESTION:${question}\nMEMORY:${memoryContext}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}\nCRITIC:${critic.text}`});
//     return {reply:final.text,specialistResults:results,critic:safeJson(critic.text,{approved:true,confidence:.5,issues:[],unsupportedClaims:[],bestPoints:[]}),modelsUsed:[{role:"router",model:this.gateway.modelSlots.router.model},...successful.map(r=>({role:r.slot,model:r.model})),{role:"critic",model:critic.model},{role:"synthesizer",model:final.model}]};
//   }

//   async execute({type="chat",question,text,title,documentId,documentIds=[],userId="anonymous",sessionId="default",topK=6,plan,contextMode="auto",tutorMode="normal",studyPreferences={}}) {
//     const started=Date.now(); const memory=await this.memoryAgent.execute({userId,sessionId,action:"context",limit:12});
//     if(question)await this.memory.addMessage({userId,sessionId,role:"user",content:question,metadata:{type,documentId:documentId||null}});

//     if(type==="study_pack"){
//       if (!this.studyAgent) throw Object.assign(new Error("The study-pack LLM is not configured."), { code: "NO_STUDY_GENERATOR", status: 503 });
//       let ragResults = { sources: [], context: "" };
//       const studyTitle = String(title || "");
//       const isImageStudy = /\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(studyTitle);
//       if (!isImageStudy) {
//         try {
//           ragResults = await this.ragAgent.execute({query:text||question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
//         } catch (ragError) {
//           // RAG is optional for study packs. The supplied source text remains
//           // authoritative, so a vector-store failure must never block generation.
//           console.warn("[Orchestrator] RAG unavailable for study pack; continuing with source text:", ragError?.message || ragError);
//         }
//       }
//       const sourceMaterial = String(text || "").slice(0, 60000);
//       const study=await this.studyAgent.execute({
//         text: sourceMaterial,
//         title: title || "Study Notes",
//         context: String(ragResults.context || "").slice(0, 50000),
//         task:"Generate the complete validated study pack in one high-quality LLM pass. Prioritize correctness, coverage and practical student usefulness.",
//         studyPreferences
//       });
//       await this.memory.addMessage({userId,sessionId,role:"assistant",content:JSON.stringify(study),metadata:{type}});
//       return {success:true,type,...study,sources:this.rag.formatSources(ragResults.sources),review:{approved:true,confidence:1,issues:[],unsupportedClaims:[],bestPoints:[]},memoryUsed:true,orchestration:{task:type,agents:["memory","rag","study"],modelsUsed:[{role:"synthesizer",model:study.metadata?.model || this.gateway.modelSlots.synthesizer.model}],latencyMs:Date.now()-started,parallelBranches:1,userId,sessionId}};
//     }

//     if(type==="document_chat"){
//       const ragResults=await this.ragAgent.execute({query:question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
//       const council=await this.council({userId,sessionId,question,context:ragResults.context,sources:ragResults.sources,specialists:plan?.specialists?.length?plan.specialists:["researcher","teacher"],mode:"document_chat",memoryContext:this.memoryText(memory),tutorMode});
//       await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type,sources:ragResults.sources.map(s=>s.documentId)}});
//       return {success:true,type,reply:council.reply,sources:this.rag.formatSources(ragResults.sources),review:council.critic,memoryUsed:true,orchestration:{task:type,agents:["router","memory","document","rag",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
//     }

//     const council=await this.council({userId,sessionId,question,context:"",sources:[],specialists:plan?.specialists?.length?plan.specialists:["teacher"],mode:"general_chat",memoryContext:this.memoryText(memory),tutorMode});
//     await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type:"chat"}});
//     return {success:true,type:"chat",reply:council.reply,review:council.critic,memoryUsed:true,orchestration:{task:"chat",agents:["router","memory",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
//   }
// }
// module.exports={Orchestrator};





function safeJson(text, fallback = {}) { try { return JSON.parse(text); } catch { return fallback; } }

class Orchestrator {
  constructor({gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}) { Object.assign(this,{gateway,rag,studyAgent,reviewerAgent,memoryAgent,ragAgent,documentAgent,researchAgent,memory}); this.maxAgents=Math.max(1,Number(process.env.MAX_AGENT_CALLS||3)); this.maxSources=Math.max(1,Number(process.env.MAX_RAG_SOURCES||8)); }

  async plan({goal,hasDocument=false,contextMode="auto",userId="anonymous",sessionId="default"}) {
    const prompt=`You are the Router/Orchestrator for Smart Study AI. Return JSON only: {"workflow":"study_pack|document_chat|chat","needsRag":boolean,"difficulty":"easy|medium|hard","specialists":["researcher","teacher","reasoner"],"reason":"short"}. Context mode: ${contextMode}. Document questions need RAG. General questions may use general knowledge. Prefer the smallest useful council.`;
    try {
      const r=await this.gateway.generateSlot("router",{prompt:`${prompt}\nUSER GOAL:\n${goal}\nHAS DOCUMENT:${hasDocument}`,userId,sessionId,budgetKey:`${userId}:${sessionId}`});
      const p=safeJson(r.text,{}); const difficulty=["easy","medium","hard"].includes(p.difficulty)?p.difficulty:"medium";
      let specialists=this.gateway.routeSpecialists({difficulty,maxAgents:this.maxAgents});
      if(Array.isArray(p.specialists)&&p.specialists.length) specialists=p.specialists.filter(x=>["researcher","teacher","reasoner"].includes(x)).slice(0,this.maxAgents);
      if(!specialists.length) specialists=["teacher"];
      const workflow=contextMode==="general"?"chat":contextMode==="study"&&hasDocument?"study_pack":contextMode==="document"&&hasDocument?"document_chat":(["study_pack","document_chat","chat"].includes(p.workflow)?p.workflow:(hasDocument?"document_chat":"chat"));
      return {workflow,needsRag:Boolean(hasDocument && (contextMode!=="general")),difficulty,specialists,reason:p.reason||"Router decision",model:r.model};
    } catch {
      return {workflow:contextMode==="study"&&hasDocument?"study_pack":hasDocument&&contextMode!=="general"?"document_chat":"chat",needsRag:Boolean(hasDocument&&contextMode!=="general"),difficulty:"medium",specialists:this.gateway.routeSpecialists({difficulty:"medium",maxAgents:this.maxAgents}),reason:"Router fallback"};
    }
  }

  async planAndExecute(args){
    const isStudyPack = String(args.contextMode || "auto") === "study" && Boolean(args.documentId || (Array.isArray(args.documentIds) && args.documentIds.length) || args.text);
    if (isStudyPack) {
      const plan = { workflow: "study_pack", needsRag: true, difficulty: args.studyPreferences?.difficulty === "hard" ? "hard" : args.studyPreferences?.difficulty === "easy" ? "easy" : "medium", specialists: [], reason: "Direct study-pack generation to minimize provider calls and preserve quota.", model: this.gateway.modelSlots.synthesizer.model };
      return { ...await this.execute({ ...args, type: "study_pack", plan }), plan };
    }
    const plan=await this.plan({goal:args.goal,hasDocument:Boolean(args.documentId||(Array.isArray(args.documentIds)&&args.documentIds.length)||args.text),contextMode:args.contextMode||"auto",userId:args.userId||"anonymous",sessionId:args.sessionId||"default"});
    return {...await this.execute({...args,type:plan.workflow,plan}),plan};
  }

  memoryText(memory){if(!memory)return "";const history=memory.history||[];const facts=memory.memories||[];const prefs=memory.preferences||{};return [`RECENT CONVERSATION:\n${history.map(x=>`${x.role}: ${x.content}`).join("\n")}`,`SAVED FACTS:\n${facts.map(x=>`${x.key}: ${x.value}`).join("\n")}`,`PREFERENCES:\n${JSON.stringify(prefs)}`].join("\n\n");}

  async council({question,context,sources,specialists,mode,memoryContext="",tutorMode="normal",userId="anonymous",sessionId="default"}) {
    const sourceText=sources.length?sources.map((s,i)=>`[${i+1}] ${s.documentName}${s.metadata?.page?` page ${s.metadata.page}`:""}${s.metadata?.slide?` slide ${s.metadata.slide}`:""}\n${s.text}`).join("\n\n"):"(no retrieved document sources)";
    const prompts={researcher:"You are the evidence researcher. For document mode, use only supplied sources. For general mode, provide careful relevant knowledge and mark uncertainty.",teacher:"You are the teaching specialist. Explain clearly for a student. Do not invent details from documents.",reasoner:"You are the reasoning specialist. Check assumptions, contradictions and limitations."};
    const results=await this.gateway.generateMany(specialists.slice(0,this.maxAgents),(slot)=>({prompt:`${prompts[slot]}\nMODE:${mode}\nQUESTION:\n${question}\n${memoryContext}\nSOURCES:\n${sourceText}\nRAG CONTEXT:\n${context||"none"}`,json:false,maxRetries:2,userId,sessionId,budgetKey:`${userId}:${sessionId}`}));
    const successful=results.filter(x=>x.ok); const specialistContext=successful.map(r=>`### ${r.slot}\n${r.text}`).join("\n\n");
    const critic=await this.gateway.generateSlot("critic",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`Review the candidate response evidence. Return JSON only: {"approved":boolean,"confidence":number,"issues":string[],"unsupportedClaims":string[],"bestPoints":string[]}.\nQUESTION:${question}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}`,json:true}).catch(e=>({text:JSON.stringify({approved:true,confidence:.5,issues:[e.message],unsupportedClaims:[],bestPoints:[]}),model:"unavailable",provider:"fallback"}));
    const tutorInstructions={beginner:"Use simple language and tiny steps.",normal:"Teach clearly and directly.",socratic:"Guide with questions and reveal the answer after reasoning.",exam:"Focus on exam scoring, definitions, formulas and common traps.",interview:"Teach like an interview coach and include follow-up thinking.",revision:"Use concise active-recall and rapid revision structure."}[tutorMode]||"Teach clearly and directly.";
    const grounding=mode==="document_chat"?"Use ONLY the supplied document sources for factual claims. If evidence is insufficient, say so.":"Answer using general knowledge plus the conversation context. Do not pretend general knowledge came from documents.";
    const final=await this.gateway.generateSlot("synthesizer",{userId,sessionId,budgetKey:`${userId}:${sessionId}`,prompt:`You are the Final Synthesizer for a real student-facing learning product. ${grounding}\nReturn a polished, copy-ready Markdown answer, not JSON. Never mention being an AI, the model, the prompt, agents, orchestration, or internal processing. Do not produce filler such as "Sure!" or "As an AI". Answer the student's actual question first. Use short headings, bullets, numbered steps, tables only when useful, and fenced code blocks for code. Preserve exact technical terms, formulas and commands when they are supported by the evidence. For programming questions, give code that can be copied directly and then explain it briefly. For conceptual questions, include a direct definition, explanation, a concrete example, and a short takeaway when appropriate. If the available evidence is insufficient, say exactly what is missing instead of inventing facts. Tutor mode: ${tutorMode}. ${tutorInstructions}\nQUESTION:${question}\nMEMORY:${memoryContext}\nSOURCES:${sourceText}\nSPECIALISTS:${specialistContext}\nCRITIC:${critic.text}`});
    return {reply:final.text,specialistResults:results,critic:safeJson(critic.text,{approved:true,confidence:.5,issues:[],unsupportedClaims:[],bestPoints:[]}),modelsUsed:[{role:"router",model:this.gateway.modelSlots.router.model},...successful.map(r=>({role:r.slot,model:r.model})),{role:"critic",model:critic.model},{role:"synthesizer",model:final.model}]};
  }

  async execute({type="chat",question,text,title,documentId,documentIds=[],documentType="",sourceType="",userId="anonymous",sessionId="default",topK=6,plan,contextMode="auto",tutorMode="normal",studyPreferences={}}) {
    const started=Date.now(); const memory=await this.memoryAgent.execute({userId,sessionId,action:"context",limit:12});
    if(question)await this.memory.addMessage({userId,sessionId,role:"user",content:question,metadata:{type,documentId:documentId||null}});

    if(type==="study_pack"){
      if (!this.studyAgent) throw Object.assign(new Error("The study-pack LLM is not configured."), { code: "NO_STUDY_GENERATOR", status: 503 });
      let ragResults = { sources: [], context: "" };
      const studyTitle = String(title || "");
      const declaredSourceType = String(sourceType || documentType || "").toLowerCase();
      const isImageStudy = declaredSourceType === "image" ||
        /\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(studyTitle) ||
        /(?:^|[\s_-])(image|screenshot|photo|scan)(?:$|[\s_.-])/i.test(studyTitle);
      if (!isImageStudy) {
        try {
          ragResults = await this.ragAgent.execute({query:text||question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
        } catch (ragError) {
          // RAG is optional for study packs. The supplied source text remains
          // authoritative, so a vector-store failure must never block generation.
          console.warn("[Orchestrator] RAG unavailable for study pack; continuing with source text:", ragError?.message || ragError);
        }
      }
      const sourceMaterial = String(text || "").slice(0, 60000);
      const study=await this.studyAgent.execute({
        text: sourceMaterial,
        title: title || "Study Notes",
        context: String(ragResults.context || "").slice(0, 50000),
        task:"Generate the complete validated study pack in one high-quality LLM pass. Prioritize correctness, coverage and practical student usefulness.",
        studyPreferences
      });
      await this.memory.addMessage({userId,sessionId,role:"assistant",content:JSON.stringify(study),metadata:{type}});
      return {success:true,type,...study,sources:this.rag.formatSources(ragResults.sources),review:{approved:true,confidence:1,issues:[],unsupportedClaims:[],bestPoints:[]},memoryUsed:true,orchestration:{task:type,agents:["memory",...(isImageStudy ? [] : ["rag"]),"study"],modelsUsed:[{role:"synthesizer",model:study.metadata?.model || this.gateway.modelSlots.synthesizer.model}],latencyMs:Date.now()-started,parallelBranches:1,userId,sessionId}};
    }

    if(type==="document_chat"){
      const ragResults=await this.ragAgent.execute({query:question,documentId,documentIds,topK:Math.min(topK,this.maxSources),ownerId:userId});
      const council=await this.council({userId,sessionId,question,context:ragResults.context,sources:ragResults.sources,specialists:plan?.specialists?.length?plan.specialists:["researcher","teacher"],mode:"document_chat",memoryContext:this.memoryText(memory),tutorMode});
      await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type,sources:ragResults.sources.map(s=>s.documentId)}});
      return {success:true,type,reply:council.reply,sources:this.rag.formatSources(ragResults.sources),review:council.critic,memoryUsed:true,orchestration:{task:type,agents:["router","memory","document","rag",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
    }

    const council=await this.council({userId,sessionId,question,context:"",sources:[],specialists:plan?.specialists?.length?plan.specialists:["teacher"],mode:"general_chat",memoryContext:this.memoryText(memory),tutorMode});
    await this.memory.addMessage({userId,sessionId,role:"assistant",content:council.reply,metadata:{type:"chat"}});
    return {success:true,type:"chat",reply:council.reply,review:council.critic,memoryUsed:true,orchestration:{task:"chat",agents:["router","memory",...council.specialistResults.filter(x=>x.ok).map(x=>x.slot),"critic","synthesizer"],modelsUsed:council.modelsUsed,latencyMs:Date.now()-started,parallelBranches:council.specialistResults.filter(x=>x.ok).length,userId,sessionId}};
  }
}
module.exports={Orchestrator};

