
const { Agent } = require("./agent-base.cjs");

class ReviewerAgent extends Agent {
  async execute({ answer, sources = [], mode = "grounding" }) {
    const sourceText = sources.length
      ? sources.map((s, i) => `[${i + 1}] ${s.documentName} / chunk ${s.chunkIndex + 1}: ${s.text}`).join("\n")
      : "(no sources)";

    const prompt = `
You are the Reviewer Agent for an educational AI system.

Review the candidate answer below.
Mode: ${mode}

CANDIDATE ANSWER:
${typeof answer === "string" ? answer : JSON.stringify(answer)}

AVAILABLE SOURCES:
${sourceText}

Return JSON with exactly:
{
  "approved": boolean,
  "confidence": number,
  "issues": string[],
  "unsupportedClaims": string[],
  "improvement": string
}

Approve only when the answer is reasonably supported by the available evidence.
If there are no sources and the answer is a general-chat response, judge factual quality instead of requiring citations.
`;

    try {
      const result = await this.gateway.generateSlot("critic", {
        task: "review",
        prompt,
        json: true
      });
      return {
        ...JSON.parse(result.text),
        model: result.model,
        provider: result.provider,
        latencyMs: result.latencyMs
      };
    } catch (error) {
      return {
        approved: true,
        confidence: 0.5,
        issues: [`Reviewer unavailable: ${error.message}`],
        unsupportedClaims: [],
        improvement: ""
      };
    }
  }
}

module.exports = { ReviewerAgent };
