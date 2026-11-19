import { normalizeProviderStatus } from "./adapter-contract.js";

/**
 * Development-only simulator.
 *
 * This adapter does NOT download, install, or execute uploaded bot code.
 * State is held in memory and disappears when the API process restarts.
 * Never present simulated status/logs as a real deployment.
 */
export function createSimulationAdapter() {
  const projects = new Map();

  function key(project) {
    if (!project?.id || !project?.owner_id) {
      throw new TypeError("An authorized project record is required.");
    }
    return String(project.id);
  }

  function getOrCreate(project) {
    const id = key(project);
    if (!projects.has(id)) {
      projects.set(id, {
        status: "stopped",
        lines: [{
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Simulation ready. No bot code has been executed."
        }]
      });
    }
    return projects.get(id);
  }

  function addLine(state, level, message) {
    state.lines.push({
      timestamp: new Date().toISOString(),
      level,
      message
    });
    if (state.lines.length > 100) state.lines.shift();
  }

  async function transition(project, status, message) {
    const state = getOrCreate(project);
    state.status = normalizeProviderStatus(status);
    addLine(state, "info", message);
    return {
      provider: "simulation",
      simulated: true,
      projectId: String(project.id),
      status: state.status
    };
  }

  return {
    async capabilities() {
      return {
        provider: "simulation",
        simulated: true,
        executesCustomerCode: false,
        runtimes: ["nodejs"],
        logs: true,
        environmentVariables: false,
        persistentStorage: false
      };
    },

    async start(project) {
      return transition(
        project,
        "running",
        "SIMULATION ONLY: start requested; no process was launched."
      );
    },

    async stop(project) {
      return transition(
        project,
        "stopped",
        "SIMULATION ONLY: stop requested; no process was running."
      );
    },

    async restart(project) {
      return transition(
        project,
        "running",
        "SIMULATION ONLY: restart requested; no process was launched."
      );
    },

    async status(project) {
      const state = getOrCreate(project);
      return {
        provider: "simulation",
        simulated: true,
        projectId: String(project.id),
        status: normalizeProviderStatus(state.status)
      };
    },

    async logs(project, options = {}) {
      const state = getOrCreate(project);
      const limit = Math.max(1, Math.min(Number(options.limit) || 50, 100));
      return {
        provider: "simulation",
        simulated: true,
        lines: state.lines.slice(-limit),
        nextCursor: null
      };
    }
  };
}
