import db from '../db'

export type StackStatus = 'running' | 'stopped' | 'error'

export interface StackInfo {
  projectId: string
  ports: Record<string, number>
  mr_id: string
  projectName: string
  mergeRequestName: string
  provider: 'github' | 'gitlab'
  status: StackStatus
  links: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export class StackService {
  static async save(stack: StackInfo): Promise<void> {
    await db.saveStack(stack.projectId, stack.mr_id, stack.projectName, stack.mergeRequestName, stack.ports, stack.provider, stack.status, stack.links)
  }

  static async remove(projectId: string, mr_id: string): Promise<void> {
    await db.removeStack(projectId, mr_id)
  }

  static async getAll(): Promise<StackInfo[]> {
    return await db.getAllStacks()
  }

  static async updateStatus(projectId: string, mrId: string, status: StackStatus): Promise<void> {
    await db.updateStackStatus(projectId, mrId, status)
  }
}
