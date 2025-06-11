import { DockerComposeAdapter } from './DockerComposeAdapter'
import { DockerSwarmAdapter } from './DockerSwarmAdapter'
import { KubernetesAdapter } from './KubernetesAdapter'
import { OrchestratorAdapter } from './OrchestratorAdapter'

const adapters: Record<string, OrchestratorAdapter> = {
  compose: new DockerComposeAdapter(),
  swarm: new DockerSwarmAdapter(),
  kubernetes: new KubernetesAdapter()
}

export function getOrchestratorAdapter(type = 'compose'): OrchestratorAdapter {
  return adapters[type] || adapters.compose
}
