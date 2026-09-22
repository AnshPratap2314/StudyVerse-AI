const STOPWORDS = new Set(`a an and are as at be by for from has have how i if in is it its of on or that the their this to was were what when where which who why with you your`.split(/\s+/));

function clean(text = "") { return String(text || "").replace(/\s+/g, " ").trim(); }
function sentences(text) { return String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(clean).filter(x => x.length >= 35); }
function words(text) { return clean(text).toLowerCase().match(/[a-zA-Z][a-zA-Z0-9+#.-]{2,}/g) || []; }
function keywords(text, limit = 15) {
  const counts = new Map();
  for (const w of words(text)) { const k = w.toLowerCase().replace(/[^a-z0-9+#.-]/g, ""); if (!k || STOPWORDS.has(k) || k.length < 4) continue; counts.set(k, (counts.get(k)||0)+1); }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([k])=>k);
}
function sourceSummary(text) {
  const s = sentences(text); if (!s.length) return clean(text).slice(0,900) || "No readable source material was provided.";
  return s.slice(0,5).join(" ").slice(0,1800);
}
function topicFrom(title, text) { return clean(title).replace(/\.[^.]+$/, "") || keywords(text,1)[0] || "Study material"; }

function studyPack({ text = "", title = "Study Notes", studyPreferences = {} } = {}) {
  const source = clean(text).slice(0,60000);
  const s = sentences(source);
  const keys = keywords(source, 15);
  const topic = topicFrom(title, source);
  const base = s.length ? s : [source].filter(Boolean);
  const flashcards = Array.from({length:12}, (_,i) => {
    const sentence = base[i % base.length] || `Review the main idea of ${topic}.`;
    const key = keys[i % Math.max(keys.length,1)] || topic;
    return { question:`What does the source explain about ${key}?`, answer:sentence, difficulty:i<4?'easy':i<9?'medium':'hard' };
  });
  const quiz = Array.from({length:10}, (_,i) => {
    const sentence = base[i % base.length] || `The source focuses on ${topic}.`;
    const key = keys[i % Math.max(keys.length,1)] || topic;
    const distractors = [
      `The source does not discuss ${key}.`,
      `The source states the opposite of this idea.`,
      `This point is unrelated to ${topic}.`
    ];
    return { question:`According to the source, which statement best represents the discussion of ${key}?`, options:[sentence,...distractors], answer:sentence, explanation:`The source states: ${sentence}`, topic };
  });
  const subTopics = keys.slice(0,8);
  return {
    summary: sourceSummary(source),
    keywords: keys,
    flashcards,
    quiz,
    mindmap:{mainTopic:topic,subTopics},
    memoryTricks: keys.slice(0,6).map((k,i)=>`Recall ${k} by linking it to the source sentence ${i+1}.`),
    cheatSheet: keys.slice(0,10).map(k=>({label:k,value:`Review the source passages containing “${k}”.`})),
    formulas: [],
    commonMistakes:["Do not rely on memory alone; compare answers with the supplied source.","Watch for definitions and conditions that change the meaning of a concept.","Separate examples from the general rule stated in the source."],
    examTips:["Start with the definitions and key terms identified in the source.","Use active recall with the generated flashcards.","Re-check every answer against the original material."],
    learningMethods:[
      {method:"Active recall",how:"Answer the flashcards without looking at the source first.",when:"First revision"},
      {method:"Teach-back",how:"Explain each key topic in your own words.",when:"After recall"},
      {method:"Spaced revision",how:"Revisit missed concepts after a delay.",when:"Daily"}
    ],
    revisionPlan:Array.from({length:7},(_,i)=>({day:`Day ${i+1}`,focus:keys[i%Math.max(keys.length,1)]||topic,action:i===0?"Read and annotate the source.":i<4?"Use flashcards and practice questions.":"Review mistakes and explain the topic from memory."})),
    practiceQuestions:base.slice(0,8).map((x,i)=>({question:`Explain the key idea in source point ${i+1} in your own words.`,answer:x})),
    examples:base.slice(0,8).map((x,i)=>({concept:keys[i%Math.max(keys.length,1)]||topic,example:x})),
    metadata:{provider:"local-fallback",model:"local-study-engine",latencyMs:0,reason:"External AI providers were unavailable; source-grounded local study generation was used.",preferences:studyPreferences}
  };
}

function interviewQuestions({role="Software Engineer",level="entry",topic="general"}={}) {
  const r=clean(role)||"Software Engineer", l=clean(level)||"entry", t=clean(topic)||"general";
  const templates=[
    [`Explain the most important concept in ${t} that a ${l}-level ${r} should understand.`,"technical"],
    [`Describe how you would solve a practical ${t} problem in a ${r} project.`,"problem-solving"],
    [`What trade-offs would you consider when choosing an approach for ${t}?`,"scenario"],
    [`Tell me about how you would debug or improve a difficult issue related to ${t}.`,"technical"],
    [`How would you explain ${t} to a teammate who is new to the topic?`,"behavioral"]
  ];
  return {questions:templates.map(([question,type],i)=>({question,type,evaluationCriteria:["Correctness and technical understanding","Clear reasoning and communication","Practical awareness and trade-offs"],modelAnswer:`A strong ${l}-level answer should define the concept, explain the reasoning, give a practical example, and mention relevant trade-offs or limitations. Keep the answer grounded in ${t}.`,followUps:[`What would you change if the requirements became more strict?`,`How would you test your approach?`],number:i+1}))};
}

function evaluateInterview({question="",answer="",role="Software Engineer"}={}) {
  const a=clean(answer), q=clean(question); const len=a.split(/\s+/).filter(Boolean).length;
  const score=Math.max(1,Math.min(10,Math.round(4+Math.min(len,120)/20+(a.includes("because")?1:0)+(a.includes("example")?1:0))));
  return {strengths:[len>=30?"The answer provides enough detail to evaluate your reasoning.":"The answer is concise and directly addresses the question.",a.includes("example")?"You included a practical example.":"Try adding a concrete example."],improvements:[len<30?"Add more explanation and a concrete example.":"Make the reasoning more structured: concept → approach → example → trade-off.","Mention how you would test or validate the proposed approach."],scoreOutOf10:score,improvedAnswer:a?`${a}\n\nImprove it by adding the key concept, your reasoning, one concrete example, and a testing/validation step.`:"Start with a direct definition, then explain your approach with an example.",followUpQuestion:"What edge case or trade-off would you consider next?",role,question,provider:"local-fallback"};
}

function imageExplanation({ocrText="",prompt="Explain this image for my studies."}={}) {
  const text=clean(ocrText); return {text:text?`I could read the following text from the image:\n\n${text}\n\nStudy explanation:\n- Identify the main topic from the visible text.\n- Break the content into definitions, steps, examples, and important terms.\n- Use the extracted text as the source of truth; visual details that are not readable cannot be verified.\n\nYour request: ${clean(prompt)}`:`I could not reliably read text from this image. Please upload a clearer/higher-resolution image. Visual facts that cannot be read are not guessed.`,provider:"local-fallback",model:"local-ocr-engine"};
}

function chatFallback({question="",sourceText=""}={}) {
  const source=clean(sourceText); const relevant=source ? sentences(source).filter(s=>words(s).some(w=>clean(question).toLowerCase().includes(w))).slice(0,4) : [];
  if(relevant.length) return `Based on the supplied material:\n\n${relevant.map(x=>`- ${x}`).join("\n")}\n\nFor a deeper generated explanation, an external AI provider must be available.`;
  return `I received your question: “${clean(question)}”. The external AI providers are currently unavailable, so I will not invent an answer. Please check the configured provider connection or quota and try again.`;
}
function localAiJson(prompt = "") {
  const p = String(prompt || "");
  const lower = p.toLowerCase();
  if (lower.includes("evaluate this interview answer")) {
    const question=(p.match(/Question:\s*([\s\S]*?)\s*Candidate answer:/i)||[])[1]||"Interview question";
    const answer=(p.match(/Candidate answer:\s*([\s\S]*)/i)||[])[1]||"";
    const role=(p.match(/for a ([^ ]+(?: [^ ]+)*) candidate/i)||[])[1]||"Software Engineer";
    return evaluateInterview({question,answer,role});
  }
  if (lower.includes("email-to-productivity agent")) {
    const subject = (p.match(/SUBJECT:([^\n]*)/i)||[])[1] || "Email";
    const body = (p.match(/BODY:([\s\S]*)/i)||[])[1] || "";
    const actionRequired = /urgent|deadline|due|action|required|submit|meeting|interview/i.test(`${subject} ${body}`);
    return {category: actionRequired ? "action_required" : "informational", summary: clean(body).slice(0,400) || clean(subject), tasks: actionRequired ? [{title:`Review: ${clean(subject).slice(0,100)}`,priority:/urgent|deadline/i.test(`${subject} ${body}`)?"high":"medium",dueDate:null}] : [], deadlines:[], actionRequired};
  }
  if (lower.includes("micro-video lesson")) {
    const topic=(p.match(/Topic:\s*([^\.\n]+)/i)||[])[1]||"Study topic";
    const material=(p.match(/Study material:\s*([\s\S]*)/i)||[])[1]||"";
    const ss=sentences(material).slice(0,5);
    const slides=Array.from({length:Math.max(3,Math.min(6,ss.length||3))},(_,i)=>({title:i===0?`Introduction to ${clean(topic)}`:`Key idea ${i}`,body:ss[i]||`Review the main concepts of ${clean(topic)} from your study material.`,visualPrompt:`Simple educational visual for ${clean(topic)}.`,durationSeconds:30}));
    return {title:`${clean(topic)} — Study Lesson`,learningObjectives:[`Understand the main ideas of ${clean(topic)}`,"Recall the important terms and relationships","Practice explaining the topic in your own words"],script:ss.join(" ")||`Review the main concepts of ${clean(topic)}.`,slides,quiz:[{question:`What is the main topic of this lesson?`,options:[clean(topic),"An unrelated topic","A random example","None of these"],answer:clean(topic)}],narration:slides.map(x=>x.body)};
  }
  if (lower.includes("senior developer and coding mentor")) {
    const lang=(p.match(/Language:\s*([^\n]+)/i)||[])[1]||"JavaScript";
    const problem=(p.match(/Problem:\s*([^\n]*)/i)||[])[1]||"";
    const code=(p.match(/Existing code:\s*([\s\S]*?)\nRelevant indexed project context:/i)||[])[1]||"";
    let solution=code.trim() || `// External AI is unavailable.\n// Re-submit the problem when an AI provider is reachable.`;
    return {explanation:problem?`The local fallback received this ${lang} problem: ${clean(problem)}. It preserves your input without inventing a solution while the external coding model is unavailable.` : "Your supplied code was received. Review it with the notes below.",approach:["Read the requirements and constraints.","Break the problem into small testable steps.","Validate edge cases before optimizing."],solution,complexity:"Depends on the algorithm; verify time and space complexity after choosing the approach.",testCases:["Normal input","Empty or minimal input","Boundary/edge input"],debuggingNotes:["Use small reproducible inputs and inspect intermediate values."]};
  }
  if (lower.includes("adaptive student study plan")) {
    const exam=(p.match(/Exam date:\s*([^\n]+)/i)||[])[1]||new Date(Date.now()+7*86400000).toISOString();
    const days=Math.max(1,Math.min(30,Number((p.match(/Days remaining:\s*(\d+)/i)||[])[1]||7)));
    const subjects=((p.match(/Subjects:\s*([^\n]+)/i)||[])[1]||"General").split(",").map(clean).filter(Boolean);
    const weak=((p.match(/Weak topics:\s*([^\n]+)/i)||[])[1]||"").split(",").map(clean).filter(Boolean);
    const mins=Math.max(30,Math.round(Number((p.match(/Available hours\/day:\s*([\d.]+)/i)||[])[1]||2)*60));
    return {overview:"A source-independent fallback plan using spaced review, active recall and mixed practice.",priorities:[...(weak.length?weak:subjects)].slice(0,8),days:Array.from({length:Math.min(days,14)},(_,i)=>({day:i+1,date:new Date(Date.now()+i*86400000).toISOString(),subject:subjects[i%Math.max(subjects.length,1)]||"General",topic:weak[i%Math.max(weak.length,1)]||"Core concepts",tasks:["Review key concepts","Practice active recall","Record mistakes"],durationMinutes:mins,reason:"Balanced revision and practice",checkpoint:"Explain the topic without notes."}))};
  }
  if (lower.includes("create a practical study plan")) {
    const goal=(p.match(/Goal:\s*([^\n]+)/i)||[])[1]||"Study"; const days=Math.max(1,Math.min(30,Number((p.match(/Days:\s*(\d+)/i)||[])[1]||7))); const hours=Number((p.match(/Hours per day:\s*([\d.]+)/i)||[])[1]||2); return {overview:`Fallback plan for ${clean(goal)}.`,days:Array.from({length:days},(_,i)=>({day:i+1,focus:i%2?"Practice":"Learn",tasks:["Study the topic","Use active recall","Review mistakes"],durationMinutes:Math.round(hours*60),milestone:i===days-1?"Final review":"Checkpoint"}))};
  }
  if (lower.includes("collaborative quiz")) {
    const topic=(p.match(/about\s+(.+?)\. Return JSON/i)||[])[1]||"the topic"; const questions=Array.from({length:5},(_,i)=>({question:`What should you review first about ${clean(topic)}?`,options:["Core definitions","An unrelated topic","Random facts","Nothing"],answer:"Core definitions",explanation:"Start with the definitions and verify them against the shared study material.",difficulty:"medium",topic:clean(topic)})); return {questions};
  }
  if (lower.includes("ai tutor inside a collaborative study room")) {
    const q=(p.match(/QUESTION:([^\n]+)/i)||[])[1]||"your question"; return {answer:`For “${clean(q)}”, start by identifying the relevant concept in the room notes and shared documents. The external tutor is unavailable, so no unsupported facts are added.`,keyPoints:["Use the shared room notes as the source of truth.","Break the problem into smaller steps.","Verify the result with an example."],followUp:"What part of the problem is most unclear?"};
  }
  if (lower.includes("strict ats resume evaluator")) {
    return {summary:"Local fallback review: the resume was received, but an external ATS model is unavailable.",overallScore:0,atsScore:0,strengths:["Resume text was successfully received."],gaps:["A full ATS semantic comparison requires an external AI provider."],atsKeywords:[],rewrittenBullets:[],formattingIssues:["Review formatting manually for consistent headings and bullets."],roleMatch:[],nextSteps:["Retry when an AI provider is available."]};
  }
  return {answer:"External AI is currently unavailable. The request was received successfully; retry when an AI provider is reachable."};
}

module.exports={studyPack,interviewQuestions,evaluateInterview,imageExplanation,chatFallback,localAiJson,clean};
