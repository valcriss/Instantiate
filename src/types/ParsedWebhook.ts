export type ParsedWebhook =
  | {
      kind: 'handled'
      payload: import('./MergeRequestPayload').MergeRequestPayload
      forceDeploy: boolean
    }
  | {
      kind: 'skipped'
      reason: string
    }
