export interface OrchestratorAdapter {
  up(stackPath: string, projectName: string): Promise<void>
  down(stackPath: string, projectName: string): Promise<void>
  checkHealth(projectName: string): Promise<'running' | 'error'>
}
