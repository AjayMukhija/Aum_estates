<?php
declare(strict_types=1);

namespace AumEstates\Domain;

use AumEstates\Config;

final class PrivacyGate
{
    public const PROPERTY_ID_REGEX = '/^[A-Z0-9][A-Z0-9-]{2,47}$/';

    /**
     * Machine values, not prose — the twin of VERBATIM_STRING_FIELDS in
     * backend/domain/privacy_gate.js. The prose pass sentence-cases each
     * clause, which turned every slug into "Aum-web-000001-…" and every url
     * into "Https://aumestates.com/…".
     */
    public const VERBATIM_STRING_FIELDS = [
        'property_id',
        'project_id',
        'slug',
        'url',
        'image_file',
        'last_verified'
    ];

    /**
     * Extracts all candidate 10-digit Indian phone numbers (contiguous, spaced, or hyphenated)
     * while ignoring currency strings prefixed by ₹ / Rs / INR.
     */
    public static function findPrivatePhones(?string $text): array
    {
        if ($text === null || $text === '') {
            return [];
        }
        $leaks = [];
        $re = '/(?:₹|rs\.?\s*|inr\s*)?(?:\+?91[\s.-]?|0)?([6-9]\d(?:[\s.-]?\d){8})\b/iu';
        if (preg_match_all($re, $text, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $full = trim($match[0]);
                if (preg_match('/^(?:₹|rs|inr)/i', $full)) {
                    continue;
                }
                $digits = preg_replace('/\D/', '', $match[1]);
                if (strlen($digits) === 10 && !in_array($digits, Config::OFFICIAL_PHONES, true)) {
                    $leaks[] = $digits;
                }
            }
        }
        return array_values(array_unique($leaks));
    }

    /**
     * Stateless leak scanner across any candidate public field value.
     * Returns an array of leak violation associative arrays; empty array means clean.
     */
    public static function scanTextForLeaks(string $field, $value): array
    {
        $violations = [];
        if ($value === null) {
            return $violations;
        }

        if (is_int($value) || is_float($value)) {
            $asDigits = (string)(int)abs($value);
            // Flag suspicious 10-digit mobile numbers smuggled in non-INR numeric fields
            if (
                !in_array($field, ['price_inr_norm', 'rent_inr_monthly_norm', 'price_value', 'rent_value'], true) &&
                preg_match('/^[6-9]\d{9}$/', $asDigits) &&
                !in_array($asDigits, Config::OFFICIAL_PHONES, true)
            ) {
                $violations[] = [
                    'field' => $field,
                    'rule' => 'Numeric Private Phone Number',
                    'excerpt' => $asDigits
                ];
            }
            return $violations;
        }

        if (!is_string($value)) {
            if ($field === 'things_to_confirm' && is_array($value)) {
                foreach ($value as $idx => $entry) {
                    $subLeaks = self::scanTextForLeaks("{$field}[{$idx}]", (string)($entry ?? ''));
                    foreach ($subLeaks as $l) {
                        $violations[] = $l;
                    }
                }
                return $violations;
            }
            $violations[] = [
                'field' => $field,
                'rule' => 'Disallowed Non-Primitive Value',
                'excerpt' => gettype($value)
            ];
            return $violations;
        }

        $privatePhones = self::findPrivatePhones($value);
        foreach ($privatePhones as $phone) {
            $violations[] = [
                'field' => $field,
                'rule' => 'Private Phone Number',
                'excerpt' => $phone
            ];
        }

        // Email addresses (allow official @aumestates.com)
        if (preg_match_all('/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/u', $value, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $domain = mb_strtolower($m[1], 'UTF-8');
                if ($domain !== 'aumestates.com') {
                    $violations[] = [
                        'field' => $field,
                        'rule' => 'Private Email Address',
                        'excerpt' => $m[0]
                    ];
                }
            }
        }

        // PAN card format
        if (preg_match_all('/\b[A-Z]{5}[0-9]{4}[A-Z]\b/u', $value, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $violations[] = [
                    'field' => $field,
                    'rule' => 'PAN Identifier',
                    'excerpt' => $m[0]
                ];
            }
        }

        // Brokerage & Commission terms
        if (preg_match('/\b(?:commission|brokerage|broker\s*cut|payout|sub[\s-]*broker)\b/i', $value)) {
            $violations[] = [
                'field' => $field,
                'rule' => 'Internal Brokerage / Commission Note',
                'excerpt' => mb_substr($value, 0, 80, 'UTF-8')
            ];
        }

        // Cheque / Cash / White-Black payment terms (word-bounded so "Whiteland" never false-triggers)
        if (
            preg_match('/\b(?:cheque|cash\s*component|cash\s*deal|cash\s*ratio|white\s*deal|black\s*deal|black\s*component)\b/i', $value) ||
            preg_match('/\b\d{1,3}\s*%\s*(?:cheque|cash|white|black)\b/i', $value) ||
            preg_match('/\b\d{1,2}\s*[\/:]\s*\d{1,2}\s*(?:white|black|cheque|cash)\b/i', $value)
        ) {
            $violations[] = [
                'field' => $field,
                'rule' => 'Private Payment / Cheque-Cash Structure',
                'excerpt' => mb_substr($value, 0, 80, 'UTF-8')
            ];
        }

        // Owner identity / keys / unverified raw broker notes
        if (preg_match('/\b(?:owner\s*name|owner\s*mob|owner\s*phone|owner\s*contact|contact\s*seller|keys\s*in\s*hand|source\s*wording)\b/i', $value)) {
            $violations[] = [
                'field' => $field,
                'rule' => 'Internal Seller / Broker Handling Note',
                'excerpt' => mb_substr($value, 0, 80, 'UTF-8')
            ];
        }

        return $violations;
    }

    /**
     * Separates sensitive commercial/payment/broker clauses out of legacy semi-public strings
     * so they are preserved inside property_private and cleanly removed from public fields.
     */
    /**
     * Removes sourcing provenance from buyer-facing text. PHP twin of
     * stripSourcingProvenance in backend/domain/privacy_gate.js.
     *
     * quarantineSensitiveClauses only runs at intake, and the API projects
     * live rows straight out of the master, so "Broker asking price X" was
     * still reaching /api/public/properties even after the static feed was
     * cleaned. A rewrite rather than a leak rule, for the same reason as in
     * the Node gate: flagging it would fail and drop a third of the
     * inventory instead of publishing it cleanly.
     */
    public static function stripSourcingProvenance(?string $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return $value;
        }

        $endedWithPeriod = (bool)preg_match('/\.\s*$/', $value);
        $kept = [];

        foreach (preg_split('/\s*;\s*/', $value) as $rawPart) {
            $part = preg_replace('/\.\s*$/', '', trim($rawPart));
            if ($part === '') {
                continue;
            }
            if (preg_match('/^separate\s+broker\s+record$/i', $part)) {
                continue;
            }
            if (preg_match('/^broker[-\s]?(?:sourced|listed|quoted)\b[^;]*\binventory$/i', $part)) {
                continue;
            }

            $part = preg_replace('/^broker(?:[-\s]*quoted)?\s+asking\s+price\b/i', 'Asking price', $part);
            $part = preg_replace('/^broker[-\s]?(?:sourced|listed|quoted)\s+/i', '', $part);
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            // Each clause reads as its own statement in this telegraphic
            // style, so every one is capitalised. Identifier fields never
            // reach here; see VERBATIM_STRING_FIELDS.
            $kept[] = ucfirst($part);
        }

        if (count($kept) === 0) {
            return null;
        }

        $out = implode('; ', $kept);
        if ($endedWithPeriod && !str_ends_with($out, '.')) {
            $out .= '.';
        }

        return $out;
    }

    public static function quarantineSensitiveClauses(array $record): array
    {
        $paymentNotes = [];
        $advisorNotes = [];

        $cleanClauseList = function (?string $text) use (&$paymentNotes, &$advisorNotes): ?string {
            if (!$text || !is_string($text)) {
                return null;
            }
            $parts = preg_split('/\s*;\s*|\.\s+(?=[A-Z0-9₹])/u', $text);
            $kept = [];

            foreach ($parts as $rawPart) {
                $part = trim(rtrim($rawPart, '.'));
                if (!$part) {
                    continue;
                }
                if (preg_match('/\b(?:cheque|white\s*deal|black\s*deal|cash\s*component|cash\s*ratio)\b/i', $part)) {
                    $paymentNotes[] = $part;
                    continue;
                }
                if (preg_match('/\b(?:commission|brokerage|broker\s*cut|payout|keys\s*in\s*hand|source\s*wording|owner\s*mob|owner\s*name)\b/i', $part) || str_contains($part, 'VERIFY')) {
                    $advisorNotes[] = $part;
                    continue;
                }
                if (count(self::findPrivatePhones($part)) > 0) {
                    $advisorNotes[] = $part;
                    continue;
                }
                $kept[] = $part;
            }

            if (empty($kept)) {
                return null;
            }
            return implode('; ', $kept);
        };

        $cleanedPriceText = Normalizer::cleanWhitespace($record['price_text'] ?? null);
        if ($cleanedPriceText) {
            if (preg_match('/source\s*wording|verify|keys\s*in\s*hand|max\s*cheque|^cheque/i', $cleanedPriceText)) {
                if (preg_match('/cheque/i', $cleanedPriceText)) {
                    $paymentNotes[] = "Original price note: {$cleanedPriceText}";
                } else {
                    $advisorNotes[] = "Original price note: {$cleanedPriceText}";
                }
                $cleanedPriceText = 'Price on Request';
            } elseif (preg_match('/cheque|white\s*deal|cash/i', $cleanedPriceText)) {
                $paymentNotes[] = "Original price note: {$cleanedPriceText}";
                $cleanAmount = preg_replace('/\([^)]*(?:cheque|white|cash)[^)]*\)/i', '', $cleanedPriceText);
                $cleanAmount = explode(';', $cleanAmount)[0];
                $cleanAmount = preg_replace('/\b(?:Demand|Asking)\s*/i', '', $cleanAmount);
                $cleanAmount = preg_replace('/\b(?:full|max|\d+%)\s*cheque.*$/i', '', $cleanAmount);
                $cleanAmount = trim($cleanAmount);
                $cleanedPriceText = ($cleanAmount && preg_match('/(?:₹|\d)\s*(?:Cr|Lakh|Lac)/i', $cleanAmount))
                    ? $cleanAmount
                    : 'Price on Request';
            } elseif (preg_match('/^price\s*on\s*call$/i', $cleanedPriceText)) {
                $cleanedPriceText = 'Price on Request';
            }
        }

        $cleanedKeyFeatures = $cleanClauseList($record['key_features'] ?? null);
        $cleanedPublicFeatures = $cleanClauseList($record['public_features'] ?? null);
        $cleanedPublicDescription = $cleanClauseList($record['public_description'] ?? null);

        $finalDesc = null;
        if ($cleanedPublicDescription) {
            $finalDesc = str_ends_with($cleanedPublicDescription, '.') ? $cleanedPublicDescription : "{$cleanedPublicDescription}.";
        }

        return [
            'cleaned' => [
                'price_text' => $cleanedPriceText,
                'key_features' => $cleanedKeyFeatures,
                'public_features' => $cleanedPublicFeatures,
                'public_description' => $finalDesc
            ],
            'extractedPaymentNotes' => !empty($paymentNotes) ? implode(' | ', array_values(array_unique($paymentNotes))) : null,
            'extractedAdvisorNotes' => !empty($advisorNotes) ? implode(' | ', array_values(array_unique($advisorNotes))) : null
        ];
    }

    /**
     * Validates and projects a Master DB property row into an airtight Public Listing DTO.
     */
    public static function validateAndProjectPublicRecord(array $row): array
    {
        $errors = [];

        // 1. Strict publication & availability gate
        $pubState = $row['publication_state'] ?? 'draft';
        $availState = $row['availability_state'] ?? 'available';
        if ($pubState !== 'approved_public') {
            $errors[] = "Record " . ($row['property_id'] ?? '(unknown)') . " is not approved for public export (publication_state=\"{$pubState}\")";
        }
        if ($availState !== 'available') {
            $errors[] = "Record " . ($row['property_id'] ?? '(unknown)') . " is not publicly available (availability_state=\"{$availState}\")";
        }

        // 2. Strict ID & required title check
        $id = Normalizer::cleanWhitespace($row['property_id'] ?? null);
        if (!$id || !preg_match(self::PROPERTY_ID_REGEX, $id)) {
            $errors[] = "Invalid property_id format: \"" . ($row['property_id'] ?? '') . "\"";
        }

        $title = Normalizer::cleanWhitespace($row['listing_title'] ?? null) ?? Normalizer::cleanWhitespace($row['project_name'] ?? null);
        if (!$title) {
            $errors[] = "Record " . ($id ?? '(unknown)') . " is missing both listing_title and project_name";
        }

        // 3. Project strictly whitelisted public fields with primitive type checks
        $projected = [];
        $numericSet = array_flip(Config::NUMERIC_PUBLIC_FIELDS);

        foreach (Config::ALLOWED_PUBLIC_FIELDS as $field) {
            $val = $row[$field] ?? null;

            if ($field === 'listing_title') {
                $val = Normalizer::cleanListingTitle(Normalizer::stripFloorMarker((string)$val), $row['project_name'] ?? null);
            }
            if ($field === 'public_description') {
                if (Normalizer::containsUnitCode((string)$val)) {
                    $val = Normalizer::stripUnitCodes((string)$val);
                    if ($val && !preg_match('/^[A-Z0-9]/', $val)) {
                        $rebuilt = Normalizer::composePublicDescription($row);
                        $parts = array_filter(array_map(fn($p) => Normalizer::cleanWhitespace($p), array_slice(explode(';', $val), 1)));
                        $residual = implode('; ', $parts);
                        $combined = Normalizer::cleanWhitespace(implode(' ', array_filter([$rebuilt, $residual])));
                        $val = $combined ?: $rebuilt;
                    }
                }
                if (!Normalizer::cleanWhitespace((string)$val)) {
                    $val = Normalizer::composePublicDescription($row) ?: null;
                }
            }
            if ($field === 'url') {
                $val = "https://aumestates.com/properties/detail.html?id=" . rawurlencode($id ?? '');
            }
            // Stock filler is not a photograph of the property.
            if ($field === 'image_file' && Normalizer::isGenericPlaceholderImage($val)) {
                $val = null;
            }
            if ($field === 'image_file' && $val !== null && !preg_match('/^[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp|svg|avif)$/i', (string)$val)) {
                $errors[] = 'Invalid public image filename';
            }
            if ($field === 'slug') {
                $val = Normalizer::slugify("{$id}-" . Normalizer::cleanListingTitle($row['listing_title'] ?? null, $row['project_name'] ?? null));
            }

            if ($field === 'status') {
                $val = $availState === 'available' ? 'Available' : $availState;
            }

            if ($field === 'things_to_confirm') {
                if (is_string($val)) {
                    $decoded = json_decode($val, true);
                    if (is_array($decoded)) {
                        $parsedItems = [];
                        foreach ($decoded as $item) {
                            if (!is_string($item)) {
                                $errors[] = 'things_to_confirm must contain only strings';
                            } else {
                                $cleaned = Normalizer::cleanWhitespace($item);
                                if ($cleaned) {
                                    $parsedItems[] = $cleaned;
                                }
                            }
                        }
                        $val = $parsedItems;
                    } else {
                        $cleaned = Normalizer::cleanWhitespace($val);
                        $val = $cleaned ? [$cleaned] : [];
                    }
                } elseif (is_array($val)) {
                    $parsedItems = [];
                    foreach ($val as $item) {
                        if (!is_string($item)) {
                            $errors[] = 'things_to_confirm must contain only strings';
                        } else {
                            $cleaned = Normalizer::cleanWhitespace($item);
                            if ($cleaned) {
                                $parsedItems[] = $cleaned;
                            }
                        }
                    }
                    $val = $parsedItems;
                } else {
                    $val = [];
                }
                $projected[$field] = $val;
            } elseif (isset($numericSet[$field])) {
                if ($val === null || $val === '') {
                    $projected[$field] = null;
                } elseif (is_array($val) || is_object($val)) {
                    $errors[] = "Field \"{$field}\" cannot be an object/array";
                    $projected[$field] = null;
                } else {
                    $num = is_int($val) || is_float($val) ? $val : (is_numeric($val) ? (float)$val : null);
                    if ($num === null || !is_finite($num) || $num < 0) {
                        $errors[] = "Field \"{$field}\" must be a non-negative finite number (got \"{$val}\")";
                        $projected[$field] = null;
                    } else {
                        $projected[$field] = (str_contains((string)$field, 'norm') || $field === 'bedrooms_int') ? (int)round($num) : $num;
                    }
                }
            } else {
                if ($val === null || $val === '') {
                    $projected[$field] = null;
                } elseif (is_array($val) || is_object($val)) {
                    $errors[] = "Field \"{$field}\" must be a primitive string, got object";
                    $projected[$field] = null;
                } else {
                    // Scrubbed on every projection, not just at intake, so the
                    // API cannot serve wording the static feed no longer carries.
                    // Identifiers skip the prose pass entirely; see
                    // VERBATIM_STRING_FIELDS.
                    if (in_array($field, self::VERBATIM_STRING_FIELDS, true)) {
                        $scrubbed = Normalizer::cleanWhitespace((string)$val);
                    } else {
                        $scrubbed = Normalizer::normalizePublicVocabulary(
                            self::stripSourcingProvenance(Normalizer::cleanWhitespace((string)$val))
                        );
                    }
                    if (($scrubbed === null || $scrubbed === '') && $field === 'public_description') {
                        $scrubbed = Normalizer::composePublicDescription($row) ?: null;
                    }
                    if ($field === 'price_text') {
                        $scrubbed = Normalizer::normalizePublicPriceText($scrubbed, $row['transaction_type'] ?? null);
                    }
                    $projected[$field] = ($scrubbed === '') ? null : $scrubbed;
                }
            }

            // 4. Run stateless privacy leak scan on projected value
            $leaks = self::scanTextForLeaks($field, $projected[$field]);
            foreach ($leaks as $leak) {
                $excerpt = $leak['excerpt'];
                $errors[] = "[PRIVACY LEAK] " . ($id ?? '(unknown)') . ".{$leak['field']} triggered {$leak['rule']}: \"{$excerpt}\"";
            }
        }

        return [
            'ok' => empty($errors),
            'errors' => $errors,
            'record' => empty($errors) ? $projected : null
        ];
    }
}
