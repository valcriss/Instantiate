import { getOrchestratorAdapter } from '../../src/orchestrators'
import { DockerComposeAdapter } from '../../src/orchestrators/DockerComposeAdapter'
import { DockerSwarmAdapter } from '../../src/orchestrators/DockerSwarmAdapter'
import { KubernetesAdapter } from '../../src/orchestrators/KubernetesAdapter'

describe('getOrchestratorAdapter', () => {
  it('returns compose adapter by default', () => {
    expect(getOrchestratorAdapter()).toBeInstanceOf(DockerComposeAdapter)
  })

  it('returns the specified adapter', () => {
    expect(getOrchestratorAdapter('swarm')).toBeInstanceOf(DockerSwarmAdapter)
    expect(getOrchestratorAdapter('kubernetes')).toBeInstanceOf(KubernetesAdapter)
  })

  it('falls back to compose for unknown type', () => {
    expect(getOrchestratorAdapter('foo')).toBeInstanceOf(DockerComposeAdapter)
  })
})
