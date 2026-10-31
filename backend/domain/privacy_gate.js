'use strict';

const { OFFICIAL_PHONES, ALLOWED_PUBLIC_FIELDS } = require('../config');
const { cleanWhitespace } = require('./normalizer');

const PROPERTY_ID_REGEX = /^[A-Z0-9][A-Z0-9-]{2,47}$/;

const NUMERIC_PUBLIC_FIELDS = new Set([
  'area_value',
  'area_sqft_norm',
  'price_value',
  'price_inr_norm',
  'rent_value',
  'rent_inr_monthly_norm'
]);

const STRING_PUBLIC_FIELDS = new Set(
  ALLOWED_PUBLIC_FIELDS.filter((f) => !NUMERIC_PUBLIC_FIELDS.has(f) && f !== 'things_to_confirm')
);

/**
 * Extracts all candidate 10-digit Indian phone numbers (contiguous, spaced, or hyphenated)
 * while ignoring currency strings prefixed by ₹ / Rs / INR.
 */
function findPrivatePhones(text) {
  if (typeof text !== 'string' || !text) return [];
  const leaks = [];
  // Match optional +91 / 0 prefix followed by 10 digits starting with 6-9, allowing single space/dot/dash separators
  const re = /(?:₹|rs\.?\s*|inr\s*)?(?:\+?91[\s.-]?|0)?([6-9]\d(?:[\s.-]?\d){8})\b/gi;
  for (const match of text.matchAll(re)) {
    const full = match[0];
    if (/^(?:₹|rs|inr)/i.test(full.trim())) continue;
    const digits = match[1].replace(/\D/g, '');
    if (digits.length === 10 && !OFFICIAL_PHONES.includes(digits)) {
      leaks.push(digits);
    }
  }
  return leaks;
}

/**
 * Stateless leak scanner across any candidate public field value.
 * Returns an array of leak violation objects; empty array means clean.
 */
function scanTextForLeaks(field, value) {
  const violations = [];
  if (value == null) return violations;

  if (typeof value === 'number') {
    const asDigits = String(Math.trunc(Math.abs(value)));
    // Flag suspicious 10-digit mobile numbers smuggled in non-INR numeric fields
    if (
      !['price_inr_norm', 'rent_inr_monthly_norm', 'price_value', 'rent_value'].includes(field) &&
      /^[6-9]\d{9}$/.test(asDigits) &&
      !OFFICIAL_PHONES.includes(asDigits)
    ) {
      violations.push({
        field,
        rule: 'Numeric Private Phone Number',
        excerpt: asDigits
      });
    }
    return violations;
  }

  if (typeof value !== 'string') {
    if (field === 'things_to_confirm' && Array.isArray(value)) {
      value.forEach((entry, idx) => {
        violations.push(...scanTextForLeaks(`${field}[${idx}]`, String(entry ?? '')));
      });
      return violations;
    }
    violations.push({
      field,
      rule: 'Disallowed Non-Primitive Value',
      excerpt: typeof value
    });
    return violations;
  }

  const privatePhones = findPrivatePhones(value);
  for (const phone of privatePhones) {
    violations.push({
      field,
      rule: 'Private Phone Number',
      excerpt: phone
    });
  }

  // Email addresses (allow official @aumestates.com)
  for (const m of value.matchAll(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
    const domain = m[1].toLowerCase();
    if (domain !== 'aumestates.com') {
      violations.push({ field, rule: 'Private Email Address', excerpt: m[0] });
    }
  }

  // PAN card format
  for (const m of value.matchAll(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g)) {
    violations.push({ field, rule: 'PAN Identifier', excerpt: m[0] });
  }

  // Brokerage & Commission terms
  if (/\b(?:commission|brokerage|broker\s*cut|payout|sub[\s-]*broker)\b/i.test(value)) {
    violations.push({ field, rule: 'Internal Brokerage / Commission Note', excerpt: value.slice(0, 80) });
  }

  // Cheque / Cash / White-Black payment terms (word-bounded so "Whiteland" never false-triggers)
  if (
    /\b(?:cheque|cash\s*component|cash\s*deal|cash\s*ratio|white\s*deal|black\s*deal|black\s*component)\b/i.test(value) ||
    /\b\d{1,3}\s*%\s*(?:cheque|cash|white|black)\b/i.test(value) ||
    /\b\d{1,2}\s*[\/:]\s*\d{1,2}\s*(?:white|black|cheque|cash)\b/i.test(value)
  ) {
    violations.push({ field, rule: 'Private Payment / Cheque-Cash Structure', excerpt: value.slice(0, 80) });
  }

  // Owner identity / keys / unverified raw broker notes
  if (/\b(?:owner\s*name|owner\s*mob|owner\s*phone|owner\s*contact|contact\s*seller|keys\s*in\s*hand|source\s*wording)\b/i.test(value)) {
    violations.push({ field, rule: 'Internal Seller / Broker Handling Note', excerpt: value.slice(0, 80) });
  }

  return violations;
}

/**
 * Separates sensitive commercial/payment/broker clauses out of legacy semi-public strings
 * so they are preserved inside `property_private` and cleanly removed from public fields.
 */
function quarantineSensitiveClauses(record) {
  const paymentNotes = [];
  const advisorNotes = [];

  const cleanClauseList = (text) => {
    if (!text || typeof text !== 'string') return null;
    // Split on semicolons or sentence periods that delimit clauses
    const parts = text.split(/\s*;\s*|\.\s+(?=[A-Z0-9₹])/);
    const kept = [];

    for (const rawPart of parts) {
      const part = rawPart.replace(/\.$/, '').trim();
      if (!part) continue;

      if (/\b(?:cheque|white\s*deal|black\s*deal|cash\s*component|cash\s*ratio)\b/i.test(part)) {
        paymentNotes.push(part);
        continue;
      }
      if (/\b(?:commission|brokerage|broker\s*cut|payout|keys\s*in\s*hand|source\s*wording|owner\s*mob|owner\s*name)\b/i.test(part) || /\bVERIFY\b/.test(part)) {
        advisorNotes.push(part);
        continue;
      }
      if (findPrivatePhones(part).length > 0) {
        advisorNotes.push(part);
        continue;
      }
      kept.push(part);
    }

    if (kept.length === 0) return null;
    return kept.join('; ');
  };

  let cleanedPriceText = cleanWhitespace(record.price_text);
  if (cleanedPriceText) {
    if (/source\s*wording|verify|keys\s*in\s*hand|max\s*cheque|^cheque/i.test(cleanedPriceText)) {
      if (/cheque/i.test(cleanedPriceText)) paymentNotes.push(`Original price note: ${cleanedPriceText}`);
      else advisorNotes.push(`Original price note: ${cleanedPriceText}`);
      cleanedPriceText = 'Price on Request';
    } else if (/cheque|white\s*deal|cash/i.test(cleanedPriceText)) {
      paymentNotes.push(`Original price note: ${cleanedPriceText}`);
      // Keep clean rupee demand if present before semicolon/parenthesis
      const cleanAmount = cleanedPriceText
        .replace(/\([^)]*(?:cheque|white|cash)[^)]*\)/gi, '')
        .split(';')[0]
        .replace(/\b(?:Demand|Asking)\s*/i, '')
        .replace(/\b(?:full|max|\d+%)\s*cheque.*$/i, '')
        .trim();
      cleanedPriceText = cleanAmount && /(?:₹|\d)\s*(?:Cr|Lakh|Lac)/i.test(cleanAmount)
        ? cleanAmount
        : 'Price on Request';
    } else if (/^price\s*on\s*call$/i.test(cleanedPriceText)) {
      cleanedPriceText = 'Price on Request';
    }
  }

  const cleanedKeyFeatures = cleanClauseList(record.key_features);
  const cleanedPublicFeatures = cleanClauseList(record.public_features);
  const cleanedPublicDescription = cleanClauseList(record.public_description);

  return {
    cleaned: {
      price_text: cleanedPriceText,
      key_features: cleanedKeyFeatures,
      public_features: cleanedPublicFeatures,
      public_description: cleanedPublicDescription
        ? (cleanedPublicDescription.endsWith('.') ? cleanedPublicDescription : `${cleanedPublicDescription}.`)
        : null
    },
    extractedPaymentNotes: [...new Set(paymentNotes)].join(' | ') || null,
    extractedAdvisorNotes: [...new Set(advisorNotes)].join(' | ') || null
  };
}

/**
 * Validates and projects a Master DB property row into an airtight Public Listing DTO.
 * Throws or returns errors if ANY schema rule, publication boundary, or privacy check fails.
 */
function validateAndProjectPublicRecord(row) {
  const errors = [];

  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { ok: false, errors: ['Record must be a plain object'], record: null };
  }

  // 1. Strict publication & availability gate
  const pubState = row.publication_state || 'draft';
  const availState = row.availability_state || 'available';
  if (pubState !== 'approved_public') {
    errors.push(`Record ${row.property_id || '(unknown)'} is not approved for public export (publication_state="${pubState}")`);
  }
  if (availState !== 'available') {
    errors.push(`Record ${row.property_id || '(unknown)'} is not publicly available (availability_state="${availState}")`);
  }

  // 2. Strict ID & required title check
  const id = cleanWhitespace(row.property_id);
  if (!id || !PROPERTY_ID_REGEX.test(id)) {
    errors.push(`Invalid property_id format: "${row.property_id}"`);
  }

  const title = cleanWhitespace(row.listing_title) || cleanWhitespace(row.project_name);
  if (!title) {
    errors.push(`Record ${id || '(unknown)'} is missing both listing_title and project_name`);
  }

  // 3. Project strictly whitelisted public fields with primitive type checks
  const projected = {};
  for (const field of ALLOWED_PUBLIC_FIELDS) {
    let val = row[field];

    if (field === 'status') {
      val = availState === 'available' ? 'Available' : availState;
    }

    if (field === 'things_to_confirm') {
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          val = Array.isArray(parsed) ? parsed.map((x) => cleanWhitespace(x)).filter(Boolean) : [];
        } catch {
          val = val ? [cleanWhitespace(val)] : [];
        }
      } else if (Array.isArray(val)) {
        val = val.map((x) => cleanWhitespace(x)).filter(Boolean);
      } else {
        val = [];
      }
      projected[field] = val;
    } else if (NUMERIC_PUBLIC_FIELDS.has(field)) {
      if (val == null || val === '') {
        projected[field] = null;
      } else if (typeof val === 'object') {
        errors.push(`Field "${field}" cannot be an object/array`);
        projected[field] = null;
      } else {
        const num = Number(val);
        if (!Number.isFinite(num) || num < 0) {
          errors.push(`Field "${field}" must be a non-negative finite number (got "${val}")`);
          projected[field] = null;
        } else {
          projected[field] = num;
        }
      }
    } else if (STRING_PUBLIC_FIELDS.has(field)) {
      if (val == null || val === '') {
        projected[field] = null;
      } else if (typeof val === 'object') {
        errors.push(`Field "${field}" must be a primitive string, got object`);
        projected[field] = null;
      } else {
        projected[field] = cleanWhitespace(String(val));
      }
    }

    // 4. Run stateless privacy leak scan on projected value
    const leaks = scanTextForLeaks(field, projected[field]);
    for (const leak of leaks) {
      errors.push(`[PRIVACY LEAK] ${id || '(unknown)'}.${leak.field} triggered ${leak.rule}: "${leak.excerpt}"`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    record: errors.length === 0 ? projected : null
  };
}

module.exports = {
  PROPERTY_ID_REGEX,
  NUMERIC_PUBLIC_FIELDS,
  STRING_PUBLIC_FIELDS,
  findPrivatePhones,
  scanTextForLeaks,
  quarantineSensitiveClauses,
  validateAndProjectPublicRecord
};
