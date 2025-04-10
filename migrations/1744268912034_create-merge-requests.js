/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.createTable('merge_requests', {
        id: 'id',
        mr_id: { type: 'integer', notNull: true, unique: true },
        repo: { type: 'text', notNull: true },
        status: { type: 'text', notNull: true },
        created_at: { type: 'timestamp', default: pgm.func('NOW()') },
        updated_at: { type: 'timestamp', default: pgm.func('NOW()') },
    })

    pgm.createTable('exposed_ports', {
        id: 'id',
        mr_id: { type: 'integer', notNull: true, references: '"merge_requests"', onDelete: 'cascade' },
        service: { type: 'text', notNull: true },
        name: { type: 'text', notNull: true },
        internal_port: { type: 'integer', notNull: true },
        external_port: { type: 'integer', notNull: true, unique: true }
    })
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('exposed_ports')
    pgm.dropTable('merge_requests')
};
