class Metrics {
  constructor() { this.startedAt = Date.now(); this.users = new Map(); this.global = { requests: 0, successes: 0, failures: 0, agentRuns: 0 }; }
  request(success, userId = "system") {
    const key = String(userId || "system");
    const item = this.users.get(key) || { requests: 0, successes: 0, failures: 0, agentRuns: 0 };
    item.requests++; success ? item.successes++ : item.failures++;
    this.users.set(key, item);
    this.global.requests++; success ? this.global.successes++ : this.global.failures++;
  }
  agent(userId = "system") {
    const key = String(userId || "system"); const item = this.users.get(key) || { requests: 0, successes: 0, failures: 0, agentRuns: 0 };
    item.agentRuns++; this.users.set(key, item); this.global.agentRuns++;
  }
  snapshot(userId = "system") {
    const item = this.users.get(String(userId || "system")) || { requests: 0, successes: 0, failures: 0, agentRuns: 0 };
    return { uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000), ...item };
  }
}
module.exports = { Metrics };
