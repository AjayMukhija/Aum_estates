'use strict';

const zlib = require('node:zlib');
const {
  cleanWhitespace,
  slugify,
  normalizeAreaSqFt,
  normalizePriceInr,
  normalizeRentInr,
  cleanListingTitle,
  classifyCategory,
  classifyCorridor,
  resolveRepresentativeImage,
  parseBedroomsInt,
  formatInr
} = require('./normalizer');
const { findPrivatePhones, quarantineSensitiveClauses } = require('./privacy_gate');

const KNOWN_PROJECTS = [
  'DLF The Camellias', 'DLF The Magnolias', 'DLF The Aralias', 'DLF The Crest',
  'DLF The Belaire', 'DLF Park Place', 'DLF The Arbour', 'DLF The Grove',
  'DLF Exclusive Floors', 'DLF Carlton Estate', 'DLF Westend Heights',
  'DLF Regency Park', 'DLF Ridgewood Estate', 'DLF Trinity Towers', 'DLF Wellington Estate',
  'Conscient Elevate', 'Puri The Aravallis', 'Pioneer Araya', 'Pioneer Presidia',
  'Ireo Grand Arch', 'Ireo Uptown', 'Ireo City', 'M3M Golf Estate', 'M3M Capital', 'M3M Heights',
  'Sobha Aranya', 'Tata Raisina Residency', 'Paras Quartier', 'Paras Irene', 'Paras The Florett',
  'Birla Navya', 'Adani Samsara', 'Anant Raj Estate', 'Whiteland The Aspen',
  'Smartworld Sky Arc', 'Eldeco Mansionz', 'Nirvana Country', 'South City 2', 'South City 1',
  'Sushant Lok 1', 'Sushant Lok 2', 'Sushant Lok 3', 'Malibu Towne', 'Uppal Southend',
  'Vipul Belmonte', 'Vipul World', 'Central Park Resorts', 'Godrej Miraya', 'Godrej Meridian',
  'Heritage One', 'Urban Oasis', 'Close North', 'Close South', 'Orchid Island', 'Orchid Ivy',
  'Palm Springs', 'Emaar Palm Drive', 'Emaar Emerald Hills', 'Indiabulls Enigma'
];

/**
 * Two-Pass Raw WhatsApp Broadcast Parser:
 * Pass 1 extracts clean structural public specs.
 * Pass 2 extracts & quarantines seller/broker phones, closer/floor prices, exact unit numbers,
 * commission splits, and cheque/cash notes into `privateVault`.
 */
function parseWhatsAppBroadcast(rawText, options = {}) {
  const text = String(rawText || '').trim();
  if (!text) {
    throw new Error('WhatsApp message text cannot be empty');
  }

  // --- PASS 2 FIRST: Extract & Quarantine Sensitive Entities ---
  const phones = findPrivatePhones(text);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

  // Extract contact / broker name near call / keys / contact
  let contactPerson = null;
  const contactNameMatch = text.match(/(?:keys?\s*(?:with|at)|call|contact|broker|owner)\s*[:\-]?\s*([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){0,2})/);
  if (contactNameMatch) {
    contactPerson = cleanWhitespace(contactNameMatch[1]);
  }

  // Extract exact unit / tower / plot number
  let exactUnitNo = null;
  const unitMatches = [
    text.match(/\b(Tower\s*[A-Z0-9-]+\s*[,/#-]?\s*(?:Unit|Flat|Apt|#)?\s*[A-Z0-9-]{2,6})\b/i),
    text.match(/\b((?:Unit|Flat|Plot|House|Villa|Shop|Office)\s*(?:No\.?|#)?\s*[A-Z0-9/-]{1,10})\b/i)
  ].find(Boolean);
  if (unitMatches) {
    exactUnitNo = cleanWhitespace(unitMatches[1]);
  }

  // Extract internal floor / closer / bottom price
  let internalFloorInr = null;
  const closerMatch = text.match(/\b(?:closer|bottom|final|floor\s*price|min(?:imum)?|net\s*to\s*owner|last)\s*(?:around|at|@|:)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac)?\b/i);
  if (closerMatch) {
    const val = Number(closerMatch[1]);
    const unit = (closerMatch[2] || 'cr').toLowerCase();
    if (Number.isFinite(val) && val > 0) {
      internalFloorInr = unit.startsWith('l') ? Math.round(val * 1e5) : Math.round(val * 1e7);
    }
  }

  // Extract brokerage / commission terms
  let commissionTerms = null;
  const commMatch = text.match(/\b(\d+(?:\.\d+)?\s*%\s*(?:side[\s-]*by[\s-]*side|brokerage|commission|cut|payout)|side[\s-]*by[\s-]*side|no\s*brokerage|direct\s*deal)\b/i);
  if (commMatch) {
    commissionTerms = cleanWhitespace(commMatch[1]);
  }

  // Extract cheque / payment terms
  let paymentNotes = null;
  const payMatch = text.match(/\b((?:\d{1,3}\s*[:/]\s*\d{1,3}|\d{1,3}\s*%|full|max|all|flexible)\s*(?:cheque|white|cash)(?:\s*(?:deal|ratio|payment|flexible|terms))?|(?:cheque|white)\s*(?:flexible|terms|deal|payment))\b/i);
  if (payMatch) {
    paymentNotes = cleanWhitespace(payMatch[1]);
  }

  // --- PASS 1: Extract Structural Public Specifications ---
  const isRent = /\b(for\s*rent|for\s*lease|lease|rental|rent\s*(?:@|is|asking|demand)|per\s*month|\/\s*month|pm\b)\b/i.test(text) && !/\bpre[\s-]*leased\s*for\s*sale\b/i.test(text);
  const transactionType = isRent ? 'Rent' : 'Sale';

  // Sector
  let sector = null;
  const secMatch = text.match(/\b(?:sector|sec)\.?\s*(\d{1,3}[A-Za-z]?)\b/i);
  if (secMatch) {
    sector = `Sector ${secMatch[1].toUpperCase()}`;
  }

  // Project Name
  let projectName = null;
  const lower = text.toLowerCase();
  for (const kp of KNOWN_PROJECTS) {
    const alias = kp.toLowerCase().replace(/^dlf\s+the\s+/, 'dlf ');
    if (lower.includes(kp.toLowerCase()) || lower.includes(alias)) {
      projectName = kp;
      break;
    }
  }
  if (!projectName) {
    const dlfPhase = text.match(/\b(DLF\s*Phase\s*[1-5])\b/i);
    if (dlfPhase) projectName = dlfPhase[1].replace(/\s+/g, ' ');
  }
  if (!projectName) {
    const firstChunk = text.split(/[|\n,;]/)[0].trim();
    const cleanedFirst = firstChunk
      .replace(/\b(?:available|for\s*sale|for\s*rent|urgent|direct|inventory|mandate)\b/gi, '')
      .trim();
    if (cleanedFirst.length >= 3 && cleanedFirst.length <= 48) {
      projectName = cleanedFirst;
    }
  }

  // Configuration & Bedrooms
  let configuration = null;
  let bedrooms = null;
  const bhkMatch = text.match(/\b(\d)\s*BHK(?:\s*\+\s*(?:S|SQ|Servant|Study|Store|Lounge|Office|Staff)(?:\s*\+\s*(?:Servant|Study|Staff))?)?/i);
  if (bhkMatch) {
    bedrooms = bhkMatch[1];
    configuration = bhkMatch[0]
      .replace(/\+\s*S\b/i, '+ Servant')
      .replace(/\+\s*SQ\b/i, '+ Servant')
      .replace(/bhk/i, 'BHK')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Property Type
  let propertyType = 'Apartment';
  if (/\b(plot|hsvp|huda\s*plot|land)\b/i.test(text)) propertyType = 'Plot';
  else if (/\b(builder\s*floor|independent\s*floor|upper\s*ground|stilt)\b/i.test(text)) propertyType = 'Builder Floor';
  else if (/\b(villa|kothi|independent\s*house|simplex|duplex\s*villa)\b/i.test(text)) propertyType = 'Villa';
  else if (/\b(farm\s*house|farmhouse)\b/i.test(text)) propertyType = 'Farmhouse';
  else if (/\b(office|shop|retail|sco|commercial|pre[\s-]*leased|warehouse|showroom)\b/i.test(text)) propertyType = 'Commercial';

  // Area & Unit
  let areaValue = null;
  let areaUnit = null;
  const areaMatch = text.match(/\b(\d{2,6}(?:\.\d+)?)\s*(sq\.?\s*ft\.?|sqft|sq\.?\s*yd\.?|sq\.?\s*yards?|sqyd|gaj|marla|acres?|sq\.?\s*mtr?)\b/i);
  if (areaMatch) {
    areaValue = Number(areaMatch[1]);
    const rawU = areaMatch[2].toLowerCase();
    if (/yd|yard|gaj/.test(rawU)) areaUnit = 'Sq Yards';
    else if (/marla/.test(rawU)) areaUnit = 'Marla';
    else if (/acre/.test(rawU)) areaUnit = 'Acres';
    else if (/mtr|sq\s*m/.test(rawU)) areaUnit = 'Sq Mtr';
    else areaUnit = 'Sq Ft';
  }

  // Facing & Floor
  let facing = null;
  const facingMatch = text.match(/\b(North[\s-]*East|North[\s-]*West|South[\s-]*East|South[\s-]*West|NE|NW|SE|SW|East|West|North|South|Park|Golf|Aravalli|Club)\s*(?:facing|view)\b/i);
  if (facingMatch) {
    const mapDir = { NE: 'North-East', NW: 'North-West', SE: 'South-East', SW: 'South-West' };
    const token = facingMatch[1].toUpperCase();
    facing = mapDir[token] || facingMatch[1].replace(/\s+/g, '-');
  }

  let floorLabel = null;
  const floorMatch = text.match(/\b(Higher\s*Floor|Middle\s*Floor|Mid\s*Floor|Lower\s*Floor|Upper\s*Ground|Ground\s*Floor|Top\s*Floor|Penthouse)\b/i);
  if (floorMatch) {
    floorLabel = cleanWhitespace(floorMatch[1]);
  }

  // Asking Price / Rent (excluding closer/floor price phrase)
  const textWithoutCloser = text.replace(/\b(?:closer|bottom|final|floor\s*price|min(?:imum)?|net\s*to\s*owner)\s*(?:around|at|@|:)?\s*(?:₹|rs\.?)?\s*\d+(?:\.\d+)?\s*(?:cr|crore|lakh|lac)?/gi, '');
  let priceValue = null;
  let priceUnit = null;
  let priceText = null;
  let rentValue = null;
  let rentUnit = null;

  if (isRent) {
    const rentLakh = textWithoutCloser.match(/(?:asking|demand|rent|@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac)s?(?:\s*(?:pm|per\s*month|\/\s*m))?/i);
    const rentRaw = textWithoutCloser.match(/(?:asking|demand|rent|@|₹|rs\.?)\s*([\d,]{4,9})(?:\s*(?:pm|per\s*month|\/\s*m))?/i);
    if (rentLakh) {
      rentValue = Math.round(Number(rentLakh[1]) * 1e5);
      rentUnit = 'per month';
    } else if (rentRaw) {
      rentValue = Number(rentRaw[1].replace(/,/g, ''));
      rentUnit = 'per month';
    }
  } else {
    const askCr = textWithoutCloser.match(/(?:asking|demand|price|@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|crores)\b/i);
    const askLakh = textWithoutCloser.match(/(?:asking|demand|price|@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs)\b(?!\s*\/\s*sq)/i);
    const perSqYd = textWithoutCloser.match(/(?:@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(lakh|lac)s?\s*(?:\/|per)\s*sq\.?\s*yd/i);
    if (perSqYd) {
      priceValue = Number(perSqYd[1]);
      priceUnit = 'Lakh/sq yd';
      priceText = `₹${priceValue} Lakh/sq yd`;
    } else if (askCr) {
      priceValue = Number(askCr[1]);
      priceUnit = 'Cr';
      priceText = `₹${priceValue} Cr`;
    } else if (askLakh) {
      priceValue = Number(askLakh[1]);
      priceUnit = 'Lakh';
      priceText = `₹${priceValue} Lakh`;
    }
  }

  const areaSqFtNorm = normalizeAreaSqFt(areaValue, areaUnit);
  const priceInrNorm = normalizePriceInr({
    priceValue,
    priceUnit,
    priceText,
    transactionType,
    areaValue,
    areaUnit,
    areaSqFtNorm
  });
  const rentInrNorm = normalizeRentInr({
    rentValue,
    rentUnit,
    priceValue,
    priceUnit,
    transactionType,
    areaSqFtNorm
  });

  // Safe public highlights (strictly derived from verified structural tokens, never raw unvetted free text)
  const highlights = [];
  if (floorLabel) highlights.push(floorLabel);
  if (facing) highlights.push(`${facing} orientation`);
  if (/\bcorner\b/i.test(text)) highlights.push('Corner positioning');
  if (/\bpark\s*facing\b/i.test(text) && (!facing || !/park/i.test(facing))) highlights.push('Park facing');
  if (/\b(?:semi[\s-]*furnished|fully\s*furnished|unfurnished)\b/i.test(text)) {
    highlights.push(text.match(/\b(semi[\s-]*furnished|fully\s*furnished|unfurnished)\b/i)[1]);
  }
  const parkSlots = text.match(/\b([1-5])\s*(?:car\s*)?park(?:ing)?s?\b/i);
  if (parkSlots) highlights.push(`${parkSlots[1]} dedicated car parkings`);

  const titleParts = [
    projectName || sector || 'Gurugram Mandate',
    configuration || propertyType,
    areaValue ? `${areaValue} ${areaUnit}` : null
  ].filter(Boolean);
  const listingTitle = cleanListingTitle(titleParts.join(' · '), projectName);

  const draft = {
    publication_state: 'pending_approval',
    availability_state: 'available',
    project_name: projectName,
    city: 'Gurgaon',
    locality: projectName || sector || 'Gurgaon',
    sector,
    micro_location: sector || projectName,
    property_type: propertyType,
    transaction_type: transactionType,
    listing_title: listingTitle,
    configuration,
    bedrooms,
    bedrooms_int: parseBedroomsInt(bedrooms, configuration, listingTitle),
    area_value: areaValue,
    area_unit: areaUnit,
    area_sqft_norm: areaSqFtNorm,
    floor_label: floorLabel,
    facing,
    price_value: priceValue,
    price_unit: priceUnit,
    price_text: priceText || (priceInrNorm ? formatInr(priceInrNorm) : null),
    price_inr_norm: priceInrNorm,
    rent_value: rentValue,
    rent_unit: rentUnit,
    rent_inr_monthly_norm: rentInrNorm,
    key_features: highlights.join('; ') || null,
    public_description: [
      `${configuration || propertyType} mandate`,
      projectName ? `at ${projectName}` : null,
      sector ? `(${sector}, Gurugram)` : 'in Gurugram'
    ].filter(Boolean).join(' ') + '.'
  };

  draft.category = classifyCategory(draft);
  draft.corridor = classifyCorridor(draft);
  draft.image_file = resolveRepresentativeImage(draft);
  draft.slug = slugify(listingTitle);

  const privateVault = {
    broker_name_cache: contactPerson,
    broker_phone_cache: phones[0] ? `+91 ${phones[0].slice(0, 5)} ${phones[0].slice(5)}` : null,
    owner_email_cache: emailMatch ? emailMatch[0] : null,
    source_group_name: options.sourceGroup || 'WhatsApp Broadcast Intake',
    exact_unit_or_plot_no: exactUnitNo,
    internal_floor_price_inr: internalFloorInr,
    commission_terms: commissionTerms,
    payment_structure_notes: paymentNotes,
    raw_whatsapp_text: text,
    internal_advisor_notes: phones.length > 1
      ? `Additional phones extracted: ${phones.slice(1).join(', ')}`
      : 'Parsed via Two-Pass WhatsApp Intake; review before public approval.'
  };

  return {
    publicDraft: draft,
    privateVault,
    quarantineSummary: {
      phonesQuarantined: phones,
      exactUnitQuarantined: exactUnitNo,
      floorPriceQuarantined: internalFloorInr ? formatInr(internalFloorInr) : null,
      commissionQuarantined: commissionTerms,
      paymentNotesQuarantined: paymentNotes
    }
  };
}

// ============================================================================
// Zero-Dependency Tabular Importer: JSON, CSV, TSV, and Native .XLSX (ZIP+XML)
// ============================================================================

function parseCsvText(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      if (ch === '\r') i++;
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((v) => v !== '')) rows.push(row);
  }
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = vals[idx] ?? '';
    });
    return obj;
  });
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function unzipEntries(buffer) {
  const entries = new Map();
  // Locate End of Central Directory (EOCD: 0x06054b50)
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid .xlsx archive (ZIP EOCD not found)');

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  let ptr = cdOffset;
  for (let n = 0; n < totalEntries; n++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;
    const compression = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');

    const lhNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const lhExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const rawData = buffer.subarray(dataStart, dataStart + compSize);

    if (compression === 0) {
      entries.set(name, rawData);
    } else if (compression === 8) {
      entries.set(name, zlib.inflateRawSync(rawData));
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function colLettersToIndex(letters) {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function parseXlsxBuffer(buffer) {
  const entries = unzipEntries(buffer);
  const sharedStrings = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const sstXml = entries.get('xl/sharedStrings.xml').toString('utf8');
    for (const si of sstXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const texts = [...si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1]));
      sharedStrings.push(texts.join(''));
    }
  }

  const sheetKey = [...entries.keys()].find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k))
    || [...entries.keys()].find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
  if (!sheetKey) throw new Error('No worksheet XML found inside .xlsx workbook');

  const sheetXml = entries.get(sheetKey).toString('utf8');
  const rows = [];

  for (const rMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowArr = [];
    for (const cMatch of rMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cMatch[1];
      const inner = cMatch[2];
      const refMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : rowArr.length;
      const cellType = typeMatch ? typeMatch[1] : '';

      let val = '';
      if (cellType === 'inlineStr') {
        const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        val = tMatch ? decodeXmlEntities(tMatch[1]) : '';
      } else {
        const vMatch = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
        if (vMatch) {
          const rawV = decodeXmlEntities(vMatch[1]);
          val = cellType === 's' ? (sharedStrings[Number(rawV)] ?? '') : rawV;
        }
      }
      rowArr[colIdx] = String(val).trim();
    }
    if (rowArr.some((x) => x && x !== '')) rows.push(rowArr);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h || '').trim());
  return rows.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = vals[idx] ?? '';
    });
    return obj;
  });
}

function parseImportPayload({ format, contentBase64, text }) {
  const fmt = String(format || '').toLowerCase();
  if (fmt === 'xlsx' || (contentBase64 && !text)) {
    const buf = Buffer.from(contentBase64, 'base64');
    return parseXlsxBuffer(buf);
  }
  const str = text != null ? String(text) : Buffer.from(contentBase64 || '', 'base64').toString('utf8');
  if (fmt === 'json' || str.trim().startsWith('[')) {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) throw new Error('JSON import must be an array of records');
    return parsed;
  }
  const delimiter = fmt === 'tsv' || (str.split('\n')[0] || '').includes('\t') ? '\t' : ',';
  return parseCsvText(str, delimiter);
}

/**
 * Normalizes an arbitrary spreadsheet/JSON row into Master DB `{ publicRecord, privateRecord }`,
 * mapping both snake_case and human-friendly Excel column headers and quarantining leaks.
 */
function normalizeImportedRow(rawRow, fallbackId) {
  const normKeyMap = {};
  for (const [k, v] of Object.entries(rawRow || {})) {
    const nk = k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    normKeyMap[nk] = v;
  }
  // Support nested BACKEND_SYSTEM_SPECIFICATION shape (`public_listing_data` + `_private_broker_metadata`)
  if (rawRow.public_listing_data && typeof rawRow.public_listing_data === 'object') {
    for (const [k, v] of Object.entries(rawRow.public_listing_data)) {
      normKeyMap[k.toLowerCase()] = v;
    }
  }
  if (rawRow._private_broker_metadata && typeof rawRow._private_broker_metadata === 'object') {
    for (const [k, v] of Object.entries(rawRow._private_broker_metadata)) {
      normKeyMap[k.toLowerCase()] = v;
    }
  }

  const pick = (...keys) => {
    for (const k of keys) {
      if (normKeyMap[k] !== undefined && normKeyMap[k] !== null && normKeyMap[k] !== '') {
        return normKeyMap[k];
      }
    }
    return null;
  };

  const propertyId = cleanWhitespace(pick('property_id', 'id', 'mandate_id', 'ref_id')) || fallbackId;
  const rawVis = String(pick('publication_state', 'visibility', 'public_visibility') || '').toLowerCase();
  const explicitApproved = pick('publication_approved');

  let publicationState = 'pending_approval';
  if (explicitApproved === false || explicitApproved === 'false' || rawVis === 'private' || rawVis === 'private_off_market' || rawVis === 'no') {
    publicationState = 'private_off_market';
  } else if (rawVis === 'draft') {
    publicationState = 'draft';
  } else if (rawVis === 'approved_public' || rawVis === 'public' || rawVis === 'yes') {
    publicationState = 'approved_public';
  }

  const rawAvail = String(pick('availability_state', 'status') || 'available').toLowerCase();
  let availabilityState = 'available';
  if (rawAvail.includes('sold')) availabilityState = 'sold';
  else if (rawAvail.includes('lease') && !rawAvail.includes('available')) availabilityState = 'leased';
  else if (rawAvail.includes('offer')) availabilityState = 'under_offer';
  else if (rawAvail.includes('withdraw')) availabilityState = 'withdrawn';

  const rawPublic = {
    price_text: pick('price_text', 'asking_price_text', 'display_price'),
    key_features: pick('key_features', 'highlights', 'features'),
    public_features: pick('public_features', 'amenities'),
    public_description: pick('public_description', 'description')
  };
  const { cleaned, extractedPaymentNotes, extractedAdvisorNotes } = quarantineSensitiveClauses(rawPublic);

  const projectName = cleanWhitespace(pick('project_name', 'project', 'building_name'));
  const listingTitle = cleanListingTitle(pick('listing_title', 'title', 'website_display_name'), projectName);
  const areaValue = pick('area_value', 'area', 'size') != null ? Number(pick('area_value', 'area', 'size')) : null;
  const areaUnit = cleanWhitespace(pick('area_unit', 'unit', 'size_unit')) || (areaValue ? 'Sq Ft' : null);
  const transactionType = cleanWhitespace(pick('transaction_type', 'transaction', 'purpose')) || 'Sale';
  const priceValue = pick('price_value', 'price', 'asking_price') != null ? Number(pick('price_value', 'price', 'asking_price')) : null;
  const priceUnit = cleanWhitespace(pick('price_unit')) || (priceValue && priceValue < 500 ? 'Cr' : null);
  const rentValue = pick('rent_value', 'monthly_rent', 'rent') != null ? Number(pick('rent_value', 'monthly_rent', 'rent')) : null;
  const rentUnit = cleanWhitespace(pick('rent_unit')) || (rentValue ? 'per month' : null);

  const areaSqFtNorm = normalizeAreaSqFt(areaValue, areaUnit);
  const priceInrNorm = normalizePriceInr({
    priceValue,
    priceUnit,
    priceText: cleaned.price_text,
    transactionType,
    areaValue,
    areaUnit,
    areaSqFtNorm
  });
  const rentInrNorm = normalizeRentInr({
    rentValue,
    rentUnit,
    priceValue,
    priceUnit,
    transactionType,
    areaSqFtNorm
  });

  const configuration = cleanWhitespace(pick('configuration', 'bhk', 'unit_type'));
  const bedrooms = pick('bedrooms') != null ? String(pick('bedrooms')) : null;

  const publicRecord = {
    property_id: propertyId,
    publication_state: publicationState,
    availability_state: availabilityState,
    project_name: projectName,
    city: cleanWhitespace(pick('city')) || 'Gurgaon',
    locality: cleanWhitespace(pick('locality', 'location', 'area_name')),
    sector: cleanWhitespace(pick('sector')),
    micro_location: cleanWhitespace(pick('micro_location')),
    property_type: cleanWhitespace(pick('property_type', 'type')) || 'Apartment',
    transaction_type: transactionType,
    listing_title: listingTitle,
    configuration,
    bedrooms,
    bedrooms_int: parseBedroomsInt(bedrooms, configuration, listingTitle),
    bathrooms: pick('bathrooms') != null ? String(pick('bathrooms')) : null,
    area_value: Number.isFinite(areaValue) ? areaValue : null,
    area_unit: areaUnit,
    area_sqft_norm: areaSqFtNorm,
    floor_label: cleanWhitespace(pick('floor_label', 'floor')),
    total_floors: cleanWhitespace(pick('total_floors')),
    facing: cleanWhitespace(pick('facing')),
    road_width: cleanWhitespace(pick('road_width')),
    furnishing: cleanWhitespace(pick('furnishing')),
    possession_status: cleanWhitespace(pick('possession_status')),
    price_value: Number.isFinite(priceValue) ? priceValue : null,
    price_unit: priceUnit,
    price_text: cleaned.price_text,
    price_inr_norm: priceInrNorm,
    rent_value: Number.isFinite(rentValue) ? rentValue : null,
    rent_unit: rentUnit,
    rent_inr_monthly_norm: rentInrNorm,
    key_features: cleaned.key_features,
    public_description: cleaned.public_description,
    public_features: cleaned.public_features,
    verification_status: cleanWhitespace(pick('verification_status')) || 'Availability to be confirmed',
    last_verified: cleanWhitespace(pick('last_verified')) || new Date().toISOString().slice(0, 10)
  };

  publicRecord.category = classifyCategory(publicRecord);
  publicRecord.corridor = classifyCorridor(publicRecord);
  publicRecord.image_file = cleanWhitespace(pick('image_file')) || resolveRepresentativeImage(publicRecord);
  publicRecord.slug = cleanWhitespace(pick('slug')) || slugify(`${propertyId}-${listingTitle}`);
  publicRecord.url = `https://aumestates.com/properties/detail.html?id=${encodeURIComponent(propertyId)}`;

  const rawFloor = pick('internal_floor_price', 'internal_floor_price_inr', 'floor_price', 'minimum_price');
  let floorInr = null;
  if (rawFloor != null) {
    const fn = Number(rawFloor);
    if (Number.isFinite(fn) && fn > 0) {
      floorInr = fn < 500 ? Math.round(fn * 1e7) : Math.round(fn);
    }
  }

  const privateRecord = {
    property_id: propertyId,
    owner_name_cache: cleanWhitespace(pick('owner_name', 'seller_name', 'landlord_name')),
    owner_phone_cache: cleanWhitespace(pick('owner_contact', 'owner_phone', 'owner_mobile', 'seller_phone')),
    owner_email_cache: cleanWhitespace(pick('owner_email', 'seller_email')),
    broker_name_cache: cleanWhitespace(pick('broker_name', 'source_broker', 'channel_partner')),
    broker_phone_cache: cleanWhitespace(pick('broker_phone', 'broker_contact', 'broker_mobile')),
    source_group_name: cleanWhitespace(pick('source_group', 'source_group_name', 'source_reference')),
    exact_unit_or_plot_no: cleanWhitespace(pick('exact_unit_or_plot_no', 'unit_no', 'plot_no', 'flat_no')),
    internal_floor_price_inr: floorInr,
    commission_terms: cleanWhitespace(pick('commission_terms', 'broker_commission_percent', 'brokerage')),
    payment_structure_notes: [
      cleanWhitespace(pick('payment_structure_notes', 'cheque_cash_ratio')),
      extractedPaymentNotes
    ].filter(Boolean).join(' | ') || null,
    encumbrance_notes: cleanWhitespace(pick('encumbrance_notes', 'hsvp_encumbrance_status')),
    raw_whatsapp_text: cleanWhitespace(pick('raw_whatsapp_text', 'source_message_raw', 'original_message')),
    internal_advisor_notes: [
      cleanWhitespace(pick('internal_advisor_notes', 'internal_notes')),
      extractedAdvisorNotes
    ].filter(Boolean).join(' | ') || null
  };

  return { publicRecord, privateRecord };
}

module.exports = {
  parseWhatsAppBroadcast,
  parseCsvText,
  parseXlsxBuffer,
  parseImportPayload,
  normalizeImportedRow
};
