// const { Agent } = require("./agent-base.cjs");
const { studyPack: localStudyPack } = require("../local-fallback.cjs");

// function normalizeQuizQuestion(item) {
//   if (!item || typeof item !== "object") return null;

//   const question = String(item.question || "").trim();

//   const options = Array.isArray(item.options)
//     ? item.options
//         .map(x => String(x || "").trim())
//         .filter(Boolean)
//         .slice(0, 10)
//     : [];

//   if (!question || options.length !== 4) return null;

//   const rawAnswer = String(
//     item.answer || item.correctAnswer || ""
//   ).trim();

//   const answer =
//     options.find(option => option === rawAnswer) ||
//     options.find(
//       option => option.toLowerCase() === rawAnswer.toLowerCase()
//     );

//   if (!answer) return null;

//   return {
//     question,
//     options,
//     answer,
//     explanation: String(item.explanation || "").trim(),
//     topic: String(item.topic || "").trim()
//   };
// }

// function parseStudyPackJson(value) {
//   if (value && typeof value === "object") {
//     if (value.text && typeof value.text === "string") {
//       return parseStudyPackJson(value.text);
//     }

//     if (value.output && typeof value.output === "string") {
//       return parseStudyPackJson(value.output);
//     }

//     if (value.content && typeof value.content === "string") {
//       return parseStudyPackJson(value.content);
//     }

//     if (value.parsed && typeof value.parsed === "object") {
//       return value.parsed;
//     }

//     return value;
//   }

//   const raw = String(value || "").trim();

//   if (!raw) {
//     throw new Error(
//       "The study generator returned an empty response."
//     );
//   }

//   const candidates = [];

//   candidates.push(raw);

//   const fencedBlocks = [
//     ...raw.matchAll(
//       /```(?:json|JSON)?\s*([\s\S]*?)\s*```/g
//     )
//   ];

//   for (const match of fencedBlocks) {
//     if (match[1]) {
//       candidates.push(match[1].trim());
//     }
//   }

//   const objectStart = raw.indexOf("{");
//   const objectEnd = raw.lastIndexOf("}");

//   if (objectStart >= 0 && objectEnd > objectStart) {
//     candidates.push(
//       raw.slice(objectStart, objectEnd + 1)
//     );
//   }

//   const arrayStart = raw.indexOf("[");
//   const arrayEnd = raw.lastIndexOf("]");

//   if (arrayStart >= 0 && arrayEnd > arrayStart) {
//     candidates.push(
//       raw.slice(arrayStart, arrayEnd + 1)
//     );
//   }

//   const uniqueCandidates = [
//     ...new Set(candidates.map(x => String(x).trim()))
//   ];

//   for (const candidate of uniqueCandidates) {
//     try {
//       const parsed = JSON.parse(candidate);

//       if (
//         parsed &&
//         typeof parsed === "object"
//       ) {
//         return parsed;
//       }
//     } catch {}
//   }

//   const preview = raw
//     .replace(/\s+/g, " ")
//     .slice(0, 500);

//   const error = new Error(
//     "The study generator returned an invalid study-pack format. Please retry."
//   );

//   error.code = "INVALID_STUDY_PACK_JSON";
//   error.responsePreview = preview;

//   throw error;
// }

// function normalizeStudyPack(value, title) {
//   const source =
//     value && typeof value === "object"
//       ? value
//       : {};

//   const flashcards = Array.isArray(source.flashcards)
//     ? source.flashcards
//         .map(item => ({
//           question: String(
//             item?.question ||
//             item?.front ||
//             ""
//           ).trim(),

//           answer: String(
//             item?.answer ||
//             item?.back ||
//             ""
//           ).trim(),

//           difficulty: [
//             "easy",
//             "medium",
//             "hard"
//           ].includes(
//             String(
//               item?.difficulty || ""
//             ).toLowerCase()
//           )
//             ? String(
//                 item.difficulty
//               ).toLowerCase()
//             : "medium"
//         }))
//         .filter(
//           item =>
//             item.question &&
//             item.answer
//         )
//         .slice(0, 12)
//     : [];

//   const quizSource =
//     Array.isArray(source.quiz)
//       ? source.quiz
//       : Array.isArray(source.questions)
//         ? source.questions
//         : [];

//   const quiz = quizSource
//     .map(normalizeQuizQuestion)
//     .filter(Boolean)
//     .slice(0, 10);

//   const keywordSource =
//     Array.isArray(source.keywords)
//       ? source.keywords
//       : Array.isArray(source.keyPoints)
//         ? source.keyPoints
//         : [];

//   const keywords = [
//     ...new Set(
//       keywordSource
//         .map(x =>
//           String(x || "").trim()
//         )
//         .filter(Boolean)
//     )
//   ].slice(0, 15);

//   const mindmap =
//     source.mindmap &&
//     typeof source.mindmap === "object"
//       ? {
//           mainTopic: String(
//             source.mindmap.mainTopic ||
//             title ||
//             "Study Pack"
//           ).trim(),

//           subTopics: Array.isArray(
//             source.mindmap.subTopics
//           )
//             ? [
//                 ...new Set(
//                   source.mindmap.subTopics
//                     .map(x =>
//                       String(
//                         x || ""
//                       ).trim()
//                     )
//                     .filter(Boolean)
//                 )
//               ].slice(0, 12)
//             : []
//         }
//       : {
//           mainTopic:
//             title || "Study Pack",
//           subTopics: []
//         };

//   return {
//     summary: String(
//       source.summary ||
//       source.overview ||
//       ""
//     ).trim(),

//     keywords,

//     flashcards,

//     quiz,

//     mindmap,

//     memoryTricks: Array.isArray(
//       source.memoryTricks
//     )
//       ? source.memoryTricks
//           .map(x =>
//             String(x || "").trim()
//           )
//           .filter(Boolean)
//           .slice(0, 10)
//       : [],

//     cheatSheet: Array.isArray(
//       source.cheatSheet
//     )
//       ? source.cheatSheet
//           .map(x => ({
//             label: String(
//               x?.label || ""
//             ).trim(),

//             value: String(
//               x?.value || ""
//             ).trim()
//           }))
//           .filter(
//             x =>
//               x.label &&
//               x.value
//           )
//           .slice(0, 15)
//       : [],

//     formulas: Array.isArray(
//       source.formulas
//     )
//       ? source.formulas
//           .map(x => ({
//             name: String(
//               x?.name || ""
//             ).trim(),

//             formula: String(
//               x?.formula || ""
//             ).trim(),

//             note: String(
//               x?.note || ""
//             ).trim()
//           }))
//           .filter(
//             x =>
//               x.name &&
//               x.formula
//           )
//           .slice(0, 15)
//       : [],

//     commonMistakes: Array.isArray(
//       source.commonMistakes
//     )
//       ? source.commonMistakes
//           .map(x =>
//             String(x || "").trim()
//           )
//           .filter(Boolean)
//           .slice(0, 10)
//       : [],

//     examTips: Array.isArray(
//       source.examTips
//     )
//       ? source.examTips
//           .map(x =>
//             String(x || "").trim()
//           )
//           .filter(Boolean)
//           .slice(0, 10)
//       : [],

//     learningMethods: Array.isArray(
//       source.learningMethods
//     )
//       ? source.learningMethods
//           .map(x => ({
//             method: String(
//               x?.method || ""
//             ).trim(),

//             how: String(
//               x?.how || ""
//             ).trim(),

//             when: String(
//               x?.when || ""
//             ).trim()
//           }))
//           .filter(
//             x =>
//               x.method &&
//               x.how
//           )
//           .slice(0, 8)
//       : [],

//     revisionPlan: Array.isArray(
//       source.revisionPlan
//     )
//       ? source.revisionPlan
//           .map(x => ({
//             day: String(
//               x?.day || ""
//             ).trim(),

//             focus: String(
//               x?.focus || ""
//             ).trim(),

//             action: String(
//               x?.action || ""
//             ).trim()
//           }))
//           .filter(
//             x =>
//               x.day &&
//               x.focus &&
//               x.action
//           )
//           .slice(0, 7)
//       : [],

//     practiceQuestions: Array.isArray(
//       source.practiceQuestions
//     )
//       ? source.practiceQuestions
//           .map(x => ({
//             question: String(
//               x?.question || ""
//             ).trim(),

//             answer: String(
//               x?.answer || ""
//             ).trim()
//           }))
//           .filter(
//             x =>
//               x.question &&
//               x.answer
//           )
//           .slice(0, 8)
//       : [],

//     examples: Array.isArray(
//       source.examples
//     )
//       ? source.examples
//           .map(x => ({
//             concept: String(
//               x?.concept || ""
//             ).trim(),

//             example: String(
//               x?.example || ""
//             ).trim()
//           }))
//           .filter(
//             x =>
//               x.concept &&
//               x.example
//           )
//           .slice(0, 8)
//       : []
//   };
// }

// class StudyAgent extends Agent {
//   constructor(deps) {
//     super("study", deps);
//     this.schema = deps.schema;
//   }

//   async execute({
//     text,
//     title = "Study Notes",
//     context = "",
//     task = "study_pack",
//     studyPreferences = {},
//     userId = "anonymous",
//     sessionId = "default"
//   }) {
//     const prompt = `
// You are the Study Agent inside Smart Study AI.

// Task: ${task}

// Document title: ${title}

// Study preferences:
// ${JSON.stringify(
//   studyPreferences || {}
// )}

// Rules:

// - Use the supplied study material/context as the source of truth.
// - Never invent facts not supported by the material.
// - If context is present, prioritize it.
// - Generate a complete, genuinely useful study system.
// - Return ONLY valid JSON.
// - Do not use Markdown code fences.
// - Do not add explanations before or after the JSON.
// - Create up to 12 high-value flashcards.
// - Create up to 10 multiple-choice questions.
// - Every multiple-choice question must have exactly 4 options.
// - The answer must exactly match one of the options.
// - Include useful memory tricks when supported.
// - Include formulas and shortcuts only when supported.
// - Include common mistakes.
// - Include exam tips.
// - Include examples.
// - Include learning methods.
// - Include a 7-day revision plan.
// - Include practice questions.
// - Keep quiz answers in the JSON for backend evaluation.
// - Never invent unsupported facts.

// Return exactly this structure:

// {
//   "summary": "string",
//   "keywords": [],
//   "flashcards": [],
//   "quiz": [],
//   "mindmap": {
//     "mainTopic": "string",
//     "subTopics": []
//   },
//   "memoryTricks": [],
//   "cheatSheet": [],
//   "formulas": [],
//   "commonMistakes": [],
//   "examTips": [],
//   "learningMethods": [],
//   "revisionPlan": [],
//   "practiceQuestions": [],
//   "examples": []
// }

// STUDY MATERIAL:

// ${text || "(none)"}

// RETRIEVED RAG CONTEXT:

// ${context || "(none)"}
// `;

//     const result =
//       await this.gateway.generateSlot(
//         "synthesizer",
//         {
//           task: "study_pack",

//           prompt,

//           schema: this.schema,

//           json: true,

//           maxOutputTokens: 5000,

//           maxRetries: 0,

//           userId,

//           sessionId,

//           budgetKey:
//             `${userId}:${sessionId}`
//         }
//       );

//     const responseValue =
//       result?.text ??
//       result?.parsed ??
//       result?.output ??
//       result?.content ??
//       result;

//     let parsed;

//     try {
//       parsed =
//         parseStudyPackJson(
//           responseValue
//         );
//     } catch (error) {
//       console.error(
//         "[StudyAgent] Study-pack parsing failed:",
//         {
//           provider: result?.provider,
//           model: result?.model,
//           error: error?.message,
//           responsePreview:
//             error?.responsePreview ||
//             String(responseValue || "")
//               .replace(/\s+/g, " ")
//               .slice(0, 500)
//         }
//       );

//       throw error;
//     }

//     const normalized =
//       normalizeStudyPack(
//         parsed,
//         title
//       );

//     if (
//       normalized.flashcards.length < 6 ||
//       normalized.quiz.length < 4 ||
//       !normalized.summary
//     ) {
//       throw new Error(
//         "The study generator returned an incomplete study pack. Please retry with a clearer or more complete source."
//       );
//     }

//     return {
//       ...normalized,

//       metadata: {
//         provider:
//           result?.provider ||
//           "unknown",

//         model:
//           result?.model ||
//           "unknown",

//         latencyMs:
//           result?.latencyMs ||
//           0
//       }
//     };
//   }
// }

// module.exports = {
//   StudyAgent,
//   normalizeStudyPack,
//   parseStudyPackJson
// };

const { Agent } = require("./agent-base.cjs");

function normalizeQuizQuestion(item) {
  if (!item || typeof item !== "object") return null;

  const question = String(item.question || "").trim();

  const options = Array.isArray(item.options)
    ? item.options
        .map(x => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (!question || options.length !== 4) return null;

  const rawAnswer = String(
    item.answer || item.correctAnswer || ""
  ).trim();

  const answer =
    options.find(option => option === rawAnswer) ||
    options.find(
      option => option.toLowerCase() === rawAnswer.toLowerCase()
    );

  if (!answer) return null;

  return {
    question,
    options,
    answer,
    explanation: String(item.explanation || "").trim(),
    topic: String(item.topic || "").trim()
  };
}

function parseStudyPackJson(value) {
  if (value && typeof value === "object") {
    if (value.text && typeof value.text === "string") {
      return parseStudyPackJson(value.text);
    }

    if (value.output && typeof value.output === "string") {
      return parseStudyPackJson(value.output);
    }

    if (value.content && typeof value.content === "string") {
      return parseStudyPackJson(value.content);
    }

    if (value.parsed && typeof value.parsed === "object") {
      return value.parsed;
    }

    return value;
  }

  const raw = String(value || "").trim();

  if (!raw) {
    throw new Error(
      "The study generator returned an empty response."
    );
  }

  const candidates = [];

  candidates.push(raw);

  const fencedBlocks = [
    ...raw.matchAll(
      /```(?:json|JSON)?\s*([\s\S]*?)\s*```/g
    )
  ];

  for (const match of fencedBlocks) {
    if (match[1]) {
      candidates.push(match[1].trim());
    }
  }

  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(
      raw.slice(objectStart, objectEnd + 1)
    );
  }

  const arrayStart = raw.indexOf("[");
  const arrayEnd = raw.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(
      raw.slice(arrayStart, arrayEnd + 1)
    );
  }

  const uniqueCandidates = [
    ...new Set(candidates.map(x => String(x).trim()))
  ];

  for (const candidate of uniqueCandidates) {
    try {
      const parsed = JSON.parse(candidate);

      if (
        parsed &&
        typeof parsed === "object"
      ) {
        return parsed;
      }
    } catch {}
  }

  const preview = raw
    .replace(/\s+/g, " ")
    .slice(0, 500);

  const error = new Error(
    "The study generator returned an invalid study-pack format. Please retry."
  );

  error.code = "INVALID_STUDY_PACK_JSON";
  error.responsePreview = preview;

  throw error;
}

function normalizeStudyPack(value, title) {
  const source =
    value && typeof value === "object"
      ? value
      : {};

  const flashcards = Array.isArray(source.flashcards)
    ? source.flashcards
        .map(item => ({
          question: String(
            item?.question ||
            item?.front ||
            ""
          ).trim(),

          answer: String(
            item?.answer ||
            item?.back ||
            ""
          ).trim(),

          difficulty: [
            "easy",
            "medium",
            "hard"
          ].includes(
            String(
              item?.difficulty || ""
            ).toLowerCase()
          )
            ? String(
                item.difficulty
              ).toLowerCase()
            : "medium"
        }))
        .filter(
          item =>
            item.question &&
            item.answer
        )
        .slice(0, 12)
    : [];

  const quizSource =
    Array.isArray(source.quiz)
      ? source.quiz
      : Array.isArray(source.questions)
        ? source.questions
        : [];

  const quiz = quizSource
    .map(normalizeQuizQuestion)
    .filter(Boolean)
    .slice(0, 10);

  const keywordSource =
    Array.isArray(source.keywords)
      ? source.keywords
      : Array.isArray(source.keyPoints)
        ? source.keyPoints
        : [];

  const keywords = [
    ...new Set(
      keywordSource
        .map(x =>
          String(x || "").trim()
        )
        .filter(Boolean)
    )
  ].slice(0, 15);

  const mindmap =
    source.mindmap &&
    typeof source.mindmap === "object"
      ? {
          mainTopic: String(
            source.mindmap.mainTopic ||
            title ||
            "Study Pack"
          ).trim(),

          subTopics: Array.isArray(
            source.mindmap.subTopics
          )
            ? [
                ...new Set(
                  source.mindmap.subTopics
                    .map(x =>
                      String(
                        x || ""
                      ).trim()
                    )
                    .filter(Boolean)
                )
              ].slice(0, 12)
            : []
        }
      : {
          mainTopic:
            title || "Study Pack",
          subTopics: []
        };

  return {
    summary: String(
      source.summary ||
      source.overview ||
      ""
    ).trim(),

    keywords,

    flashcards,

    quiz,

    mindmap,

    memoryTricks: Array.isArray(
      source.memoryTricks
    )
      ? source.memoryTricks
          .map(x =>
            String(x || "").trim()
          )
          .filter(Boolean)
          .slice(0, 10)
      : [],

    cheatSheet: Array.isArray(
      source.cheatSheet
    )
      ? source.cheatSheet
          .map(x => ({
            label: String(
              x?.label || ""
            ).trim(),

            value: String(
              x?.value || ""
            ).trim()
          }))
          .filter(
            x =>
              x.label &&
              x.value
          )
          .slice(0, 15)
      : [],

    formulas: Array.isArray(
      source.formulas
    )
      ? source.formulas
          .map(x => ({
            name: String(
              x?.name || ""
            ).trim(),

            formula: String(
              x?.formula || ""
            ).trim(),

            note: String(
              x?.note || ""
            ).trim()
          }))
          .filter(
            x =>
              x.name &&
              x.formula
          )
          .slice(0, 15)
      : [],

    commonMistakes: Array.isArray(
      source.commonMistakes
    )
      ? source.commonMistakes
          .map(x =>
            String(x || "").trim()
          )
          .filter(Boolean)
          .slice(0, 10)
      : [],

    examTips: Array.isArray(
      source.examTips
    )
      ? source.examTips
          .map(x =>
            String(x || "").trim()
          )
          .filter(Boolean)
          .slice(0, 10)
      : [],

    learningMethods: Array.isArray(
      source.learningMethods
    )
      ? source.learningMethods
          .map(x => ({
            method: String(
              x?.method || ""
            ).trim(),

            how: String(
              x?.how || ""
            ).trim(),

            when: String(
              x?.when || ""
            ).trim()
          }))
          .filter(
            x =>
              x.method &&
              x.how
          )
          .slice(0, 8)
      : [],

    revisionPlan: Array.isArray(
      source.revisionPlan
    )
      ? source.revisionPlan
          .map(x => ({
            day: String(
              x?.day || ""
            ).trim(),

            focus: String(
              x?.focus || ""
            ).trim(),

            action: String(
              x?.action || ""
            ).trim()
          }))
          .filter(
            x =>
              x.day &&
              x.focus &&
              x.action
          )
          .slice(0, 7)
      : [],

    practiceQuestions: Array.isArray(
      source.practiceQuestions
    )
      ? source.practiceQuestions
          .map(x => ({
            question: String(
              x?.question || ""
            ).trim(),

            answer: String(
              x?.answer || ""
            ).trim()
          }))
          .filter(
            x =>
              x.question &&
              x.answer
          )
          .slice(0, 8)
      : [],

    examples: Array.isArray(
      source.examples
    )
      ? source.examples
          .map(x => ({
            concept: String(
              x?.concept || ""
            ).trim(),

            example: String(
              x?.example || ""
            ).trim()
          }))
          .filter(
            x =>
              x.concept &&
              x.example
          )
          .slice(0, 8)
      : []
  };
}

class StudyAgent extends Agent {
  constructor(deps) {
    super("study", deps);
    this.schema = deps.schema;
  }

  async execute({
    text,
    title = "Study Notes",
    context = "",
    task = "study_pack",
    studyPreferences = {},
    userId = "anonymous",
    sessionId = "default"
  }) {
    const prompt = `
You are the Study Agent inside Smart Study AI.

Task: ${task}

Document title: ${title}

Study preferences:
${JSON.stringify(
  studyPreferences || {}
)}

Rules:

- Use the supplied study material/context as the source of truth.
- Never invent facts not supported by the material.
- If context is present, prioritize it.
- Generate a complete, genuinely useful study system.
- Return ONLY valid JSON.
- Do not use Markdown code fences.
- Do not add explanations before or after the JSON.
- Create up to 12 high-value flashcards.
- Create up to 10 multiple-choice questions.
- Every multiple-choice question must have exactly 4 options.
- The answer must exactly match one of the options.
- Include useful memory tricks when supported.
- Include formulas and shortcuts only when supported.
- Include common mistakes.
- Include exam tips.
- Include examples.
- Include learning methods.
- Include a 7-day revision plan.
- Include practice questions.
- Keep quiz answers in the JSON for backend evaluation.
- Never invent unsupported facts.

Return exactly this structure:

{
  "summary": "string",
  "keywords": [],
  "flashcards": [],
  "quiz": [],
  "mindmap": {
    "mainTopic": "string",
    "subTopics": []
  },
  "memoryTricks": [],
  "cheatSheet": [],
  "formulas": [],
  "commonMistakes": [],
  "examTips": [],
  "learningMethods": [],
  "revisionPlan": [],
  "practiceQuestions": [],
  "examples": []
}

STUDY MATERIAL:

${text || "(none)"}

RETRIEVED RAG CONTEXT:

${context || "(none)"}
`;

    let result;
    try {
      result =
      await this.gateway.generateSlot(
        "synthesizer",
        {
          task: "study_pack",

          prompt,

          // Do not send the strict Gemini response schema here. Gemini rejects
          // array minItems/maxItems constraints in some model/API versions.
          // We validate and normalize the JSON response locally below.
          json: true,

          maxOutputTokens: 5000,

          maxRetries: 0,

          userId,

          sessionId,

          budgetKey:
            `${userId}:${sessionId}`
        }
      );
    } catch (error) {
      console.warn("[StudyAgent] External AI unavailable; using local source-grounded study engine:", error?.message || error);
      return localStudyPack({ text, title, studyPreferences });
    }

    const responseValue =
      result?.text ??
      result?.parsed ??
      result?.output ??
      result?.content ??
      result;

    let parsed;

    try {
      parsed =
        parseStudyPackJson(
          responseValue
        );
    } catch (error) {
      console.error(
        "[StudyAgent] Study-pack parsing failed:",
        {
          provider: result?.provider,
          model: result?.model,
          error: error?.message,
          responsePreview:
            error?.responsePreview ||
            String(responseValue || "")
              .replace(/\s+/g, " ")
              .slice(0, 500)
        }
      );

      console.warn("[StudyAgent] Invalid external study-pack; using local source-grounded engine:", error?.message || error);
      return localStudyPack({ text, title, studyPreferences });
    }

    const normalized =
      normalizeStudyPack(
        parsed,
        title
      );

    if (
      normalized.flashcards.length < 6 ||
      normalized.quiz.length < 4 ||
      !normalized.summary
    ) {
      console.warn("[StudyAgent] Incomplete external study-pack; using local source-grounded engine.");
      return localStudyPack({ text, title, studyPreferences });
    }

    return {
      ...normalized,

      metadata: {
        provider:
          result?.provider ||
          "unknown",

        model:
          result?.model ||
          "unknown",

        latencyMs:
          result?.latencyMs ||
          0
      }
    };
  }
}

module.exports = {
  StudyAgent,
  normalizeStudyPack,
  parseStudyPackJson
};