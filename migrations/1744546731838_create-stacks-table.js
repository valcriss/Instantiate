/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('stacks', {
    id: 'id',
    project_id: { type: 'text', notNull: true },
    mr_id: { type: 'text', notNull: true },
    project_name: { type: 'text', notNull: true },
    merge_request_name: { type: 'text', notNull: true },
    ports: { type: 'jsonb', notNull: true },
    provider: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    links: { type: 'jsonb', notNull: true },
    updated_at: { type: 'timestamp', default: pgm.func('now()') },
    created_at: { type: 'timestamp', default: pgm.func('now()') }
  })

  pgm.addConstraint('stacks', 'st_unique_project_id_mr_id', {
    unique: ['project_id', 'mr_id']
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('stacks')
}
