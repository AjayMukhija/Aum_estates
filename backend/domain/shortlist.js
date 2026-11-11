'use strict';

const { validateAndProjectPublicRecord, scanTextForLeaks } = require('./privacy_gate');
const { formatPublicPriceDisplay } = require('./normalizer');

function assertClientText(field, text) {
  if (text != null && (typeof text !== 'string' || text.length > 4000)) {
    throw Object.assign(new Error(`Invalid client-facing ${field}`), { statusCode: 422 });
  }
  if (scanTextForLeaks(field, text).length) {
    throw Object.assign(new Error(`Confidential content blocked in ${field}`), { statusCode: 422 });
  }
}

function projectShortlistItem(row) {
  if (!row || !['approved_public', 'private_off_market'].includes(row.publication_state) || row.availability_state !== 'available') {
    throw Object.assign(new Error('Only available approved or explicitly curated off-market properties may be shared'), { statusCode: 422 });
  }
  // Off-market sharing is an explicit advisor action, but its text must pass the
  // exact same schema and disclosure checks as an ordinary public property.
  const check = validateAndProjectPublicRecord({ ...row, publication_state: 'approved_public' });
  if (!check.ok) throw Object.assign(new Error('Property is not safe for client sharing'), { statusCode: 422 });
  assertClientText('advisor_commentary', row.advisor_commentary);
  return {
    ...check.record,
    display_price: formatPublicPriceDisplay(row),
    is_off_market_curated: row.publication_state === 'private_off_market',
    advisor_commentary: row.advisor_commentary || null,
    match_score: row.match_score || null
  };
}

module.exports = { assertClientText, projectShortlistItem };
