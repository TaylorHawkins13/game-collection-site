// Builds a full CSV backup of a user's collection. Column order mirrors
// the import template (lib/csvImport.js) so an exported file can be
// re-imported as-is, plus a few extra read-only/newer columns (market
// price, trophy fields, created_at) that aren't part of the import schema
// but are worth having in a backup.

export const EXPORT_COLUMNS = [
  'title',
  'item_type',
  'platforms',
  'region',
  'genre',
  'barcode',
  'tags',
  'cover',
  'ownership',
  'condition',
  'copy_type',
  'completeness',
  'price',
  'purchase_date',
  'play_status',
  'rating',
  'notes',
  'series',
  'issue_number',
  'publisher',
  'writer',
  'artist',
  'grade',
  'is_variant',
  'variant_notes',
  'format',
  'edition',
  'card_set',
  'card_number',
  'player_name',
  'fully_completed',
  'market_price',
  'trophy_platinum',
  'trophy_completion',
  'created_at',
];

function cell(game, col) {
  const v = game[col];
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(';');
  return v;
}

export function gamesToCsvRows(games) {
  return games.map((g) => {
    const row = {};
    EXPORT_COLUMNS.forEach((col) => {
      row[col] = cell(g, col);
    });
    return row;
  });
}
