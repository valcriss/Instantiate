export function sanitizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '')
    .toLowerCase()
}

export function buildStackName(projectName: string, mergeRequestName: string): string {
  const project = sanitizeName(projectName)
  const mr = sanitizeName(mergeRequestName)
  let stack = ''
  if (project && mr) {
    stack = `${project}-${mr}`
  } else if (project) {
    stack = project
  } else {
    stack = mr
  }
  stack = stack.replace(/-+/g, '-')
  if (stack.length > 63) {
    stack = stack.slice(0, 63)
    stack = stack.replace(/-+$/g, '')
  }
  return stack
}
