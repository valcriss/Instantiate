/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
exports.shorthands = undefined

exports.up = (pgm) => {
  pgm.addColumn('merge_requests', {
    comment_id: { type: 'text' }
  })
}

exports.down = (pgm) => {
  pgm.dropColumn('merge_requests', 'comment_id')
}
