
// function createAnalysisSchema(Type) {
//   return {
//     type: Type.OBJECT,
//     properties: {
//       summary: { type: Type.STRING, description: "A concise four-sentence summary." },
//       keywords: {
//         type: Type.ARRAY,
//         items: { type: Type.STRING },
//         description: "Exactly 15 important keywords."
//       },
//       flashcards: {
//         type: Type.ARRAY,
//         minItems  : 6,
//         maxItems  : 12,
//         items: {
//           type: Type.OBJECT,
//           properties: {
//             question: { type: Type.STRING },
//             answer: { type: Type.STRING }
//           },
//           required: ["question", "answer"]
//         },
//         description: "Between 6 and 12 useful flashcards."
//       },
//       quiz: {
//         type: Type.ARRAY,
//         minItems: 4,
//         maxItems: 10,
//         items: {
//           type: Type.OBJECT,
//           properties: {
//             question: { type: Type.STRING },
//             options: { type: Type.ARRAY, minItems: 4, maxItems: 4, items: { type: Type.STRING } },
//             answer: { type: Type.STRING }
//           },
//           required: ["question", "options", "answer"]
//         },
//         description: "Between 4 and 10 MCQs with exactly 4 options each."
//       },
//       mindmap: {
//         type: Type.OBJECT,
//         properties: {
//           mainTopic: { type: Type.STRING },
//           subTopics: { type: Type.ARRAY, items: { type: Type.STRING } }
//         },
//         required: ["mainTopic", "subTopics"]
//       },
//       memoryTricks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Useful, clearly labeled memory aids or mnemonics." },
//       cheatSheet: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["label", "value"] } },
//       formulas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, formula: { type: Type.STRING }, note: { type: Type.STRING } }, required: ["name", "formula"] } },
//       commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
//       examTips: { type: Type.ARRAY, items: { type: Type.STRING } },
//       learningMethods: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { method: { type: Type.STRING }, how: { type: Type.STRING }, when: { type: Type.STRING } }, required: ["method", "how"] } },
//       revisionPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, focus: { type: Type.STRING }, action: { type: Type.STRING } }, required: ["day", "focus", "action"] } },
//       practiceQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ["question", "answer"] } },
//       examples: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, example: { type: Type.STRING } }, required: ["concept", "example"] } }
//     },
//     required: ["summary", "keywords", "flashcards", "quiz", "mindmap", "memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]
//   };
// }

// module.exports = { createAnalysisSchema };


function createAnalysisSchema(Type) {
  return {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "A concise four-sentence summary." },
      keywords: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Exactly 15 important keywords."
      },
      flashcards: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING }
          },
          required: ["question", "answer"]
        },
        description: "Between 6 and 12 useful flashcards."
      },
      quiz: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING }
          },
          required: ["question", "options", "answer"]
        },
        description: "Between 4 and 10 MCQs with exactly 4 options each."
      },
      mindmap: {
        type: Type.OBJECT,
        properties: {
          mainTopic: { type: Type.STRING },
          subTopics: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["mainTopic", "subTopics"]
      },
      memoryTricks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Useful, clearly labeled memory aids or mnemonics." },
      cheatSheet: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }, required: ["label", "value"] } },
      formulas: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, formula: { type: Type.STRING }, note: { type: Type.STRING } }, required: ["name", "formula"] } },
      commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
      examTips: { type: Type.ARRAY, items: { type: Type.STRING } },
      learningMethods: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { method: { type: Type.STRING }, how: { type: Type.STRING }, when: { type: Type.STRING } }, required: ["method", "how"] } },
      revisionPlan: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { day: { type: Type.STRING }, focus: { type: Type.STRING }, action: { type: Type.STRING } }, required: ["day", "focus", "action"] } },
      practiceQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ["question", "answer"] } },
      examples: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { concept: { type: Type.STRING }, example: { type: Type.STRING } }, required: ["concept", "example"] } }
    },
    required: ["summary", "keywords", "flashcards", "quiz", "mindmap", "memoryTricks", "cheatSheet", "formulas", "commonMistakes", "examTips", "learningMethods", "revisionPlan", "practiceQuestions", "examples"]
  };
}

module.exports = { createAnalysisSchema };

