class Agent {
  constructor(nameOrDeps = "agent", maybeDeps = {}) {
    // Support both styles used by agents:
    //   super("study", deps)
    //   inherited constructor with new Agent({ gateway, rag })
    const deps = (nameOrDeps && typeof nameOrDeps === "object") ? nameOrDeps : (maybeDeps || {});
    this.name = typeof nameOrDeps === "string" ? nameOrDeps : (this.constructor.name || "agent").replace(/Agent$/, "").toLowerCase();
    this.gateway = deps.gateway;
    this.rag = deps.rag;
  }

  async execute() {
    throw new Error(`${this.name} agent must implement execute().`);
  }
}

module.exports = { Agent };
