<?php
declare(strict_types=1);

namespace AumEstates\Domain;

final class IntakeParser
{
    private const KNOWN_PROJECTS = [
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
     * Pass 2 extracts & quarantines seller/broker phones, floor prices, exact units,
     * commission splits, and payment notes into privateVault.
     */
    public static function parseWhatsAppBroadcast(string $rawText, array $options = []): array
    {
        $text = trim($rawText);
        if (!$text) {
            throw new \InvalidArgumentException('WhatsApp message text cannot be empty');
        }

        // --- PASS 2 FIRST: Extract & Quarantine Sensitive Entities ---
        $phones = PrivacyGate::findPrivatePhones($text);
        $emailMatch = null;
        if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $text, $em)) {
            $emailMatch = $em[0];
        }

        // Contact person
        $contactPerson = null;
        if (preg_match('/(?:keys?\s*(?:with|at)|call|contact|broker|owner)\s*[:\-]?\s*([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){0,2})/u', $text, $cnm)) {
            $contactPerson = Normalizer::cleanWhitespace($cnm[1]);
        }

        // Exact unit / plot
        $exactUnitNo = null;
        if (preg_match('/\b(Tower\s*[A-Z0-9-]+\s*[,\/#-]?\s*(?:Unit|Flat|Apt|#)?\s*[A-Z0-9-]{2,6})\b/i', $text, $um)) {
            $exactUnitNo = Normalizer::cleanWhitespace($um[1]);
        } elseif (preg_match('/\b((?:Unit|Flat|Plot|House|Villa|Shop|Office)\s*(?:No\.?|#)?\s*[A-Z0-9\/-]{1,10})\b/i', $text, $um)) {
            $exactUnitNo = Normalizer::cleanWhitespace($um[1]);
        }

        // Internal floor / closer price
        $internalFloorInr = null;
        if (preg_match('/\b(?:closer|bottom|final|floor\s*price|min(?:imum)?|net\s*to\s*owner|last)\s*(?:around|at|@|:)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac)?\b/i', $text, $cm)) {
            $val = (float)$cm[1];
            $unit = mb_strtolower($cm[2] ?? 'cr', 'UTF-8');
            if (is_finite($val) && $val > 0) {
                $internalFloorInr = str_starts_with($unit, 'l') ? (int)round($val * 1e5) : (int)round($val * 1e7);
            }
        }

        // Commission terms
        $commissionTerms = null;
        if (preg_match('/\b(\d+(?:\.\d+)?\s*%\s*(?:side[\s-]*by[\s-]*side|brokerage|commission|cut|payout)|side[\s-]*by[\s-]*side|no\s*brokerage|direct\s*deal)\b/i', $text, $comm)) {
            $commissionTerms = Normalizer::cleanWhitespace($comm[1]);
        }

        // Cheque / payment notes
        $paymentNotes = null;
        if (preg_match('/\b((?:\d{1,3}\s*[:\/]\s*\d{1,3}|\d{1,3}\s*%|full|max|all|flexible)\s*(?:cheque|white|cash)(?:\s*(?:deal|ratio|payment|flexible|terms))?|(?:cheque|white)\s*(?:flexible|terms|deal|payment))\b/i', $text, $paym)) {
            $paymentNotes = Normalizer::cleanWhitespace($paym[1]);
        }

        // --- PASS 1: Extract Structural Public Specifications ---
        $isRent = (bool)preg_match('/\b(for\s*rent|for\s*lease|lease|rental|rent\s*(?:@|is|asking|demand)|per\s*month|\/\s*month|pm\b)\b/i', $text) && !preg_match('/\bpre[\s-]*leased\s*for\s*sale\b/i', $text);
        $transactionType = $isRent ? 'Rent' : 'Sale';

        // Sector
        $sector = null;
        if (preg_match('/\b(?:sector|sec)\.?\s*(\d{1,3}[A-Za-z]?)\b/i', $text, $secm)) {
            $sector = "Sector {$secm[1]}";
        }

        // Project Name
        $projectName = null;
        foreach (self::KNOWN_PROJECTS as $proj) {
            if (stripos($text, $proj) !== false) {
                $projectName = $proj;
                break;
            }
        }

        // Configuration / Bedrooms
        $configuration = null;
        $bedrooms = null;
        if (preg_match('/\b(\d+)\s*(?:bhk|bedroom|bed)\b/i', $text, $bm)) {
            $bedrooms = (string)(int)$bm[1];
            $configuration = "{$bm[1]} BHK";
            if (preg_match('/\b(\d+)\s*bhk\s*\+\s*(servant|study|pooja|lounge)\b/i', $text, $bmExt)) {
                $configuration = "{$bmExt[1]} BHK + " . ucfirst(mb_strtolower($bmExt[2], 'UTF-8'));
            }
        } elseif (preg_match('/\b(penthouse|studio|duplex)\b/i', $text, $cm)) {
            $configuration = ucfirst(mb_strtolower($cm[1], 'UTF-8'));
        }

        // Property Type
        $propertyType = 'Apartment';
        if (preg_match('/\b(plot|plots|land)\b/i', $text)) {
            $propertyType = 'Plot';
        } elseif (preg_match('/\b(builder\s*floor|independent\s*floor|floor)\b/i', $text)) {
            $propertyType = 'Builder Floor';
        } elseif (preg_match('/\b(villa|kothi|independent\s*house)\b/i', $text)) {
            $propertyType = 'Villa';
        } elseif (preg_match('/\b(commercial|office|retail|shop|sco)\b/i', $text)) {
            $propertyType = 'Commercial';
        }

        // Area Value & Unit
        $areaValue = null;
        $areaUnit = 'Sq Ft';
        if (preg_match('/(\d+(?:\.\d+)?)\s*(sq\s*(?:ft|feet|yd|yard|yards|mtr|meter)|gaj|marla|kanal|acre|acres)\b/i', $text, $am)) {
            $areaValue = (float)$am[1];
            $unitRaw = mb_strtolower($am[2], 'UTF-8');
            if (str_contains($unitRaw, 'yd') || str_contains($unitRaw, 'yard') || str_contains($unitRaw, 'gaj')) {
                $areaUnit = 'Sq Yards';
            } elseif (str_contains($unitRaw, 'kanal')) {
                $areaUnit = 'Kanal';
            } elseif (str_contains($unitRaw, 'marla')) {
                $areaUnit = 'Marla';
            } elseif (str_contains($unitRaw, 'acre')) {
                $areaUnit = 'Acre';
            } elseif (str_contains($unitRaw, 'mtr') || str_contains($unitRaw, 'meter')) {
                $areaUnit = 'Sq Mtr';
            } else {
                $areaUnit = 'Sq Ft';
            }
        }

        // Floor label
        $floorLabel = null;
        if (preg_match('/\b(ground|first|second|third|fourth|top|higher|lower|middle)\s*floor\b/i', $text, $fm)) {
            $floorLabel = ucfirst(mb_strtolower($fm[1], 'UTF-8')) . ' Floor';
        } elseif (preg_match('/\b(gf|ff|sf|tf)\b/i', $text, $fm)) {
            $map = ['gf' => 'Ground Floor', 'ff' => 'First Floor', 'sf' => 'Second Floor', 'tf' => 'Third Floor'];
            $floorLabel = $map[mb_strtolower($fm[1], 'UTF-8')] ?? null;
        }

        // Facing
        $facing = null;
        if (preg_match('/\b(north|south|east|west|north[\s-]*east|north[\s-]*west|south[\s-]*east|south[\s-]*west)\s*facing\b/i', $text, $fcm)) {
            $facing = ucfirst(mb_strtolower($fcm[1], 'UTF-8'));
        }

        // Asking Price
        $priceValue = null;
        $priceUnit = null;
        $priceText = null;
        $rentValue = null;
        $rentUnit = null;

        $textWithoutCloser = preg_replace('/\b(?:closer|bottom|final|floor\s*price|min(?:imum)?|net\s*to\s*owner|last)\s*(?:around|at|@|:)?\s*(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(cr|crore|lakh|lac)?\b/i', '', $text);

        $askCr = null;
        if (preg_match('/(?:asking|demand|price|rate|@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)\b/i', $textWithoutCloser, $mCr)) {
            $askCr = $mCr;
        }
        $askLakh = null;
        if (preg_match('/(?:asking|demand|price|rate|@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i', $textWithoutCloser, $mLk)) {
            $askLakh = $mLk;
        }

        if ($isRent) {
            if ($askLakh) {
                $rentValue = (float)$askLakh[1];
                $rentUnit = 'Lakh / month';
            } elseif ($askCr) {
                $rentValue = (float)$askCr[1] * 100;
                $rentUnit = 'Lakh / month';
            }
        } else {
            if (preg_match('/(?:@|₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac)s?\s*(?:\/|per)\s*sq\.?\s*yd/i', $textWithoutCloser, $perSqYd)) {
                $priceValue = (float)$perSqYd[1];
                $priceUnit = 'Lakh/sq yd';
                $priceText = "₹{$priceValue} Lakh/sq yd";
            } elseif ($askCr) {
                $priceValue = (float)$askCr[1];
                $priceUnit = 'Cr';
                $priceText = "₹{$priceValue} Cr";
            } elseif ($askLakh) {
                $priceValue = (float)$askLakh[1];
                $priceUnit = 'Lakh';
                $priceText = "₹{$priceValue} Lakh";
            }
        }

        $areaSqFtNorm = Normalizer::normalizeAreaSqFt($areaValue, $areaUnit);
        $priceInrNorm = Normalizer::normalizePriceInr([
            'priceValue' => $priceValue,
            'priceUnit' => $priceUnit,
            'priceText' => $priceText,
            'transactionType' => $transactionType,
            'areaValue' => $areaValue,
            'areaUnit' => $areaUnit,
            'areaSqFtNorm' => $areaSqFtNorm
        ]);
        $rentInrNorm = Normalizer::normalizeRentInr([
            'rentValue' => $rentValue,
            'rentUnit' => $rentUnit,
            'priceValue' => $priceValue,
            'priceUnit' => $priceUnit,
            'transactionType' => $transactionType,
            'areaSqFtNorm' => $areaSqFtNorm
        ]);

        $highlights = [];
        if ($floorLabel) $highlights[] = $floorLabel;
        if ($facing) $highlights[] = "{$facing} orientation";
        if (preg_match('/\bcorner\b/i', $text)) $highlights[] = 'Corner positioning';
        if (preg_match('/\bpark\s*facing\b/i', $text) && (!$facing || !preg_match('/park/i', $facing))) $highlights[] = 'Park facing';
        if (preg_match('/\b(semi[\s-]*furnished|fully\s*furnished|unfurnished)\b/i', $text, $furnMatch)) {
            $highlights[] = $furnMatch[1];
        }
        if (preg_match('/\b([1-5])\s*(?:car\s*)?park(?:ing)?s?\b/i', $text, $parkSlots)) {
            $highlights[] = "{$parkSlots[1]} dedicated car parkings";
        }

        $titleParts = array_filter([
            $projectName ?: ($sector ?: 'Gurugram Mandate'),
            $configuration ?: $propertyType,
            $areaValue ? "{$areaValue} {$areaUnit}" : null
        ]);
        $listingTitle = Normalizer::cleanListingTitle(implode(' · ', $titleParts), $projectName);

        $descLeadParts = array_filter([
            ($configuration ?: $propertyType) . ' mandate',
            $projectName ? "at {$projectName}" : null,
            $sector ? "({$sector}, Gurugram)" : 'in Gurugram'
        ]);
        $publicDescription = implode(' ', $descLeadParts) . '.';

        $draft = [
            'publication_state' => 'pending_approval',
            'availability_state' => 'available',
            'project_name' => $projectName,
            'city' => 'Gurgaon',
            'locality' => $projectName ?: ($sector ?: 'Gurgaon'),
            'sector' => $sector,
            'micro_location' => $sector ?: $projectName,
            'property_type' => $propertyType,
            'transaction_type' => $transactionType,
            'listing_title' => $listingTitle,
            'configuration' => $configuration,
            'bedrooms' => $bedrooms,
            'bedrooms_int' => Normalizer::parseBedroomsInt($bedrooms, $configuration, $listingTitle),
            'area_value' => $areaValue,
            'area_unit' => $areaUnit,
            'area_sqft_norm' => $areaSqFtNorm,
            'floor_label' => $floorLabel,
            'facing' => $facing,
            'price_value' => $priceValue,
            'price_unit' => $priceUnit,
            'price_text' => $priceText ?: ($priceInrNorm ? Normalizer::formatInr($priceInrNorm) : null),
            'price_inr_norm' => $priceInrNorm,
            'rent_value' => $rentValue,
            'rent_unit' => $rentUnit,
            'rent_inr_monthly_norm' => $rentInrNorm,
            'key_features' => !empty($highlights) ? implode('; ', $highlights) : null,
            'public_description' => $publicDescription
        ];

        $draft['category'] = Normalizer::classifyCategory($draft);
        $draft['corridor'] = Normalizer::classifyCorridor($draft);
        $draft['image_file'] = Normalizer::resolveRepresentativeImage($draft);
        $draft['slug'] = Normalizer::slugify($listingTitle);

        $privateVault = [
            'broker_name_cache' => $contactPerson,
            'broker_phone_cache' => isset($phones[0]) ? ('+91 ' . substr($phones[0], 0, 5) . ' ' . substr($phones[0], 5)) : null,
            'owner_email_cache' => $emailMatch,
            'source_group_name' => $options['sourceGroup'] ?? $options['source_group'] ?? 'WhatsApp Broadcast Intake',
            'exact_unit_or_plot_no' => $exactUnitNo,
            'internal_floor_price_inr' => $internalFloorInr,
            'commission_terms' => $commissionTerms,
            'payment_structure_notes' => $paymentNotes,
            'raw_whatsapp_text' => $text,
            'internal_advisor_notes' => count($phones) > 1
                ? ('Additional phones extracted: ' . implode(', ', array_slice($phones, 1)))
                : 'Parsed via Two-Pass WhatsApp Intake; review before public approval.'
        ];

        return [
            'publicDraft' => $draft,
            'privateVault' => $privateVault,
            'quarantineSummary' => [
                'phonesQuarantined' => $phones,
                'exactUnitQuarantined' => $exactUnitNo,
                'floorPriceQuarantined' => $internalFloorInr ? Normalizer::formatInr($internalFloorInr) : null,
                'commissionQuarantined' => $commissionTerms,
                'paymentNotesQuarantined' => $paymentNotes
            ]
        ];
    }

    /**
     * Parses CSV or TSV string into associative rows using the header row
     */
    public static function parseCsvText(string $text, string $delimiter = ','): array
    {
        $lines = preg_split('/\r\n|\r|\n/u', trim($text));
        if (empty($lines)) {
            return [];
        }

        $headers = null;
        $rows = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $parsed = str_getcsv($line, $delimiter, '"', "\\");
            if ($headers === null) {
                $headers = array_map(fn($h) => trim((string)$h), $parsed);
                continue;
            }

            $row = [];
            foreach ($headers as $idx => $header) {
                $row[$header] = isset($parsed[$idx]) ? trim($parsed[$idx]) : '';
            }
            $rows[] = $row;
        }

        return $rows;
    }

    private static function colLettersToIndex(string $letters): int
    {
        $idx = 0;
        $letters = strtoupper($letters);
        for ($i = 0; $i < strlen($letters); $i++) {
            $idx = $idx * 26 + (ord($letters[$i]) - 64);
        }
        return $idx - 1;
    }

    /**
     * Parses an unencrypted .xlsx buffer into rows using built-in ZipArchive and XML parsing
     */
    public static function parseXlsxBuffer(string $buffer): array
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'xlsx_');
        file_put_contents($tempFile, $buffer);

        $zip = new \ZipArchive();
        if ($zip->open($tempFile) !== true) {
            @unlink($tempFile);
            throw new \RuntimeException('Failed to open .xlsx archive');
        }

        $sharedStrings = [];
        $sstXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($sstXml !== false) {
            if (preg_match_all('/<si\b[^>]*>(.*?)<\/si>/s', $sstXml, $siMatches)) {
                foreach ($siMatches[1] as $si) {
                    if (preg_match_all('/<t\b[^>]*>(.*?)<\/t>/s', $si, $tMatches)) {
                        $texts = array_map('html_entity_decode', $tMatches[1]);
                        $sharedStrings[] = implode('', $texts);
                    } else {
                        $sharedStrings[] = '';
                    }
                }
            }
        }

        $sheetXml = false;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (preg_match('/^xl\/worksheets\/sheet\d+\.xml$/i', $name)) {
                $sheetXml = $zip->getFromIndex($i);
                break;
            }
        }

        $zip->close();
        @unlink($tempFile);

        if ($sheetXml === false) {
            throw new \RuntimeException('No worksheet XML found inside .xlsx workbook');
        }

        $rows = [];
        if (preg_match_all('/<row\b[^>]*>(.*?)<\/row>/s', $sheetXml, $rMatches)) {
            foreach ($rMatches[1] as $rowContent) {
                $rowArr = [];
                if (preg_match_all('/<c\b([^>]*)>(.*?)<\/c>/s', $rowContent, $cMatches, PREG_SET_ORDER)) {
                    foreach ($cMatches as $c) {
                        $attrs = $c[1];
                        $cellBody = $c[2];

                        $cellRef = '';
                        if (preg_match('/r="([A-Z]+)\d+"/i', $attrs, $refMatch)) {
                            $cellRef = $refMatch[1];
                        }
                        $isString = preg_match('/t="s"/i', $attrs);

                        $val = '';
                        if (preg_match('/<v>(.*?)<\/v>/s', $cellBody, $vMatch)) {
                            $rawVal = trim($vMatch[1]);
                            if ($isString) {
                                $strIdx = (int)$rawVal;
                                $val = $sharedStrings[$strIdx] ?? '';
                            } else {
                                $val = $rawVal;
                            }
                        } elseif (preg_match('/<is><t\b[^>]*>(.*?)<\/t><\/is>/s', $cellBody, $isMatch)) {
                            $val = html_entity_decode($isMatch[1]);
                        }

                        $colIdx = $cellRef !== '' ? self::colLettersToIndex($cellRef) : count($rowArr);
                        $rowArr[$colIdx] = trim((string)$val);
                    }
                }

                if (!empty(array_filter($rowArr, fn($x) => $x !== '' && $x !== null))) {
                    $maxKey = !empty($rowArr) ? max(array_keys($rowArr)) : -1;
                    $dense = [];
                    for ($k = 0; $k <= $maxKey; $k++) {
                        $dense[$k] = $rowArr[$k] ?? '';
                    }
                    $rows[] = $dense;
                }
            }
        }

        if (count($rows) < 2) {
            return [];
        }

        $headers = array_map(fn($h) => trim((string)$h), $rows[0]);
        $result = [];
        for ($i = 1; $i < count($rows); $i++) {
            $vals = $rows[$i];
            $obj = [];
            foreach ($headers as $idx => $h) {
                if ($h !== '') {
                    $obj[$h] = $vals[$idx] ?? '';
                }
            }
            $result[] = $obj;
        }
        return $result;
    }

    /**
     * Parses spreadsheet or tabular import payload (json, csv, tsv, or base64 xlsx)
     */
    public static function parseImportPayload(array $payload): array
    {
        $format = strtolower((string)($payload['format'] ?? ''));
        $contentBase64 = $payload['contentBase64'] ?? $payload['content_base64'] ?? '';
        $text = $payload['text'] ?? null;

        if ($format === 'xlsx' || (!empty($contentBase64) && $text === null)) {
            $buf = base64_decode((string)$contentBase64, true);
            if ($buf !== false) {
                return self::parseXlsxBuffer($buf);
            }
        }

        $str = $text !== null ? (string)$text : (string)base64_decode((string)$contentBase64);
        $trimmed = trim($str);
        if ($format === 'json' || str_starts_with($trimmed, '[')) {
            $parsed = json_decode($trimmed, true);
            if (!is_array($parsed)) {
                throw new \InvalidArgumentException('JSON import must be an array of records');
            }
            return $parsed;
        }

        $firstLine = explode("\n", $str)[0] ?? '';
        $delimiter = ($format === 'tsv' || str_contains($firstLine, "\t")) ? "\t" : ",";
        return self::parseCsvText($str, $delimiter);
    }

    /**
     * Normalizes an imported row from spreadsheet/JSON into master DB public and private records
     */
    public static function normalizeImportedRow(array $rawRow, string $fallbackId): array
    {
        $normKeyMap = [];
        foreach ($rawRow as $k => $v) {
            $nk = strtolower(preg_replace('/[^a-z0-9]+/i', '_', trim((string)$k)));
            $nk = trim($nk, '_');
            $normKeyMap[$nk] = $v;
        }

        if (isset($rawRow['public_listing_data']) && is_array($rawRow['public_listing_data'])) {
            foreach ($rawRow['public_listing_data'] as $k => $v) {
                $normKeyMap[strtolower((string)$k)] = $v;
            }
        }
        if (isset($rawRow['_private_broker_metadata']) && is_array($rawRow['_private_broker_metadata'])) {
            foreach ($rawRow['_private_broker_metadata'] as $k => $v) {
                $normKeyMap[strtolower((string)$k)] = $v;
            }
        }

        $pick = function (...$keys) use (&$normKeyMap) {
            foreach ($keys as $k) {
                if (isset($normKeyMap[$k]) && $normKeyMap[$k] !== null && $normKeyMap[$k] !== '') {
                    return $normKeyMap[$k];
                }
            }
            return null;
        };

        $propertyId = Normalizer::cleanWhitespace((string)($pick('property_id', 'id', 'mandate_id', 'ref_id') ?? $fallbackId));
        $rawVis = strtolower((string)($pick('publication_state', 'visibility', 'public_visibility') ?? ''));
        $explicitApproved = $pick('publication_approved');

        $publicationState = 'pending_approval';
        if ($explicitApproved === false || $explicitApproved === 'false' || in_array($rawVis, ['private', 'private_off_market', 'no'], true)) {
            $publicationState = 'private_off_market';
        } elseif ($rawVis === 'draft') {
            $publicationState = 'draft';
        } elseif (in_array($rawVis, ['approved_public', 'public', 'yes'], true)) {
            $publicationState = 'approved_public';
        }

        $rawAvail = strtolower((string)($pick('availability_state', 'status') ?? 'available'));
        $availabilityState = 'available';
        if (str_contains($rawAvail, 'sold')) {
            $availabilityState = 'sold';
        } elseif (str_contains($rawAvail, 'lease') && !str_contains($rawAvail, 'available')) {
            $availabilityState = 'leased';
        } elseif (str_contains($rawAvail, 'offer')) {
            $availabilityState = 'under_offer';
        } elseif (str_contains($rawAvail, 'withdraw')) {
            $availabilityState = 'withdrawn';
        }

        $rawPublic = [
            'price_text' => $pick('price_text', 'asking_price_text', 'display_price'),
            'key_features' => $pick('key_features', 'highlights', 'features'),
            'public_features' => $pick('public_features', 'amenities'),
            'public_description' => $pick('public_description', 'description')
        ];
        $quarantined = PrivacyGate::quarantineSensitiveClauses($rawPublic);
        $cleaned = $quarantined['cleaned'];
        $extractedPaymentNotes = $quarantined['extractedPaymentNotes'];
        $extractedAdvisorNotes = $quarantined['extractedAdvisorNotes'];

        $projectName = Normalizer::cleanWhitespace((string)$pick('project_name', 'project', 'building_name'));
        $listingTitle = Normalizer::cleanListingTitle((string)$pick('listing_title', 'title', 'website_display_name'), $projectName);
        $rawArea = $pick('area_value', 'area', 'size');
        $areaValue = is_numeric($rawArea) ? (float)$rawArea : null;
        $areaUnit = Normalizer::cleanWhitespace((string)$pick('area_unit', 'unit', 'size_unit')) ?: ($areaValue ? 'Sq Ft' : null);
        $transactionType = Normalizer::cleanWhitespace((string)$pick('transaction_type', 'transaction', 'purpose')) ?: 'Sale';

        $rawPrice = $pick('price_value', 'price', 'asking_price');
        $priceValue = is_numeric($rawPrice) ? (float)$rawPrice : null;
        $priceUnit = Normalizer::cleanWhitespace((string)$pick('price_unit')) ?: (($priceValue && $priceValue < 500) ? 'Cr' : null);

        $rawRent = $pick('rent_value', 'monthly_rent', 'rent');
        $rentValue = is_numeric($rawRent) ? (float)$rawRent : null;
        $rentUnit = Normalizer::cleanWhitespace((string)$pick('rent_unit')) ?: ($rentValue ? 'per month' : null);

        $areaSqFtNorm = Normalizer::normalizeAreaSqFt($areaValue, $areaUnit);
        $priceInrNorm = Normalizer::normalizePriceInr([
            'priceValue' => $priceValue,
            'priceUnit' => $priceUnit,
            'priceText' => $cleaned['price_text'],
            'transactionType' => $transactionType,
            'areaValue' => $areaValue,
            'areaUnit' => $areaUnit,
            'areaSqFtNorm' => $areaSqFtNorm
        ]);
        $rentInrNorm = Normalizer::normalizeRentInr([
            'rentValue' => $rentValue,
            'rentUnit' => $rentUnit,
            'priceValue' => $priceValue,
            'priceUnit' => $priceUnit,
            'transactionType' => $transactionType,
            'areaSqFtNorm' => $areaSqFtNorm
        ]);

        $configuration = Normalizer::cleanWhitespace((string)$pick('configuration', 'bhk', 'unit_type'));
        $bedrooms = $pick('bedrooms') !== null ? (string)$pick('bedrooms') : null;

        $publicRecord = [
            'property_id' => $propertyId,
            'publication_state' => $publicationState,
            'availability_state' => $availabilityState,
            'project_name' => $projectName,
            'city' => Normalizer::cleanWhitespace((string)$pick('city')) ?: 'Gurgaon',
            'locality' => Normalizer::cleanWhitespace((string)$pick('locality', 'location', 'area_name')),
            'sector' => Normalizer::cleanWhitespace((string)$pick('sector')),
            'micro_location' => Normalizer::cleanWhitespace((string)$pick('micro_location')),
            'property_type' => Normalizer::cleanWhitespace((string)$pick('property_type', 'type')) ?: 'Apartment',
            'transaction_type' => $transactionType,
            'listing_title' => $listingTitle,
            'configuration' => $configuration,
            'bedrooms' => $bedrooms,
            'bedrooms_int' => Normalizer::parseBedroomsInt($bedrooms, $configuration, $listingTitle),
            'bathrooms' => $pick('bathrooms') !== null ? (string)$pick('bathrooms') : null,
            'area_value' => $areaValue,
            'area_unit' => $areaUnit,
            'area_sqft_norm' => $areaSqFtNorm,
            'floor_label' => Normalizer::cleanWhitespace((string)$pick('floor_label', 'floor')),
            'total_floors' => Normalizer::cleanWhitespace((string)$pick('total_floors')),
            'facing' => Normalizer::cleanWhitespace((string)$pick('facing')),
            'road_width' => Normalizer::cleanWhitespace((string)$pick('road_width')),
            'furnishing' => Normalizer::cleanWhitespace((string)$pick('furnishing')),
            'possession_status' => Normalizer::cleanWhitespace((string)$pick('possession_status')),
            'price_value' => $priceValue,
            'price_unit' => $priceUnit,
            'price_text' => $cleaned['price_text'],
            'price_inr_norm' => $priceInrNorm,
            'rent_value' => $rentValue,
            'rent_unit' => $rentUnit,
            'rent_inr_monthly_norm' => $rentInrNorm,
            'key_features' => $cleaned['key_features'],
            'public_description' => $cleaned['public_description'],
            'public_features' => $cleaned['public_features'],
            'verification_status' => Normalizer::cleanWhitespace((string)$pick('verification_status')) ?: 'Availability to be confirmed',
            'last_verified' => Normalizer::cleanWhitespace((string)$pick('last_verified')) ?: gmdate('Y-m-d')
        ];

        $publicRecord['category'] = Normalizer::classifyCategory($publicRecord);
        $publicRecord['corridor'] = Normalizer::classifyCorridor($publicRecord);
        $publicRecord['image_file'] = Normalizer::cleanWhitespace((string)$pick('image_file')) ?: Normalizer::resolveRepresentativeImage($publicRecord);
        $publicRecord['slug'] = Normalizer::cleanWhitespace((string)$pick('slug')) ?: Normalizer::slugify("{$propertyId}-{$listingTitle}");
        $publicRecord['url'] = "https://aumestates.com/properties/detail.html?id=" . rawurlencode($propertyId);

        $rawFloor = $pick('internal_floor_price', 'internal_floor_price_inr', 'floor_price', 'minimum_price');
        $floorInr = null;
        if ($rawFloor !== null && is_numeric($rawFloor)) {
            $fn = (float)$rawFloor;
            if ($fn > 0) {
                $floorInr = $fn < 500 ? (int)round($fn * 1e7) : (int)round($fn);
            }
        }

        $paymentNotes = array_filter([
            Normalizer::cleanWhitespace((string)$pick('payment_structure_notes', 'cheque_cash_ratio')),
            $extractedPaymentNotes
        ]);
        $advisorNotes = array_filter([
            Normalizer::cleanWhitespace((string)$pick('internal_advisor_notes', 'internal_notes')),
            $extractedAdvisorNotes
        ]);

        $privateRecord = [
            'property_id' => $propertyId,
            'owner_name_cache' => Normalizer::cleanWhitespace((string)$pick('owner_name', 'seller_name', 'landlord_name')),
            'owner_phone_cache' => Normalizer::cleanWhitespace((string)$pick('owner_contact', 'owner_phone', 'owner_mobile', 'seller_phone')),
            'owner_email_cache' => Normalizer::cleanWhitespace((string)$pick('owner_email', 'seller_email')),
            'broker_name_cache' => Normalizer::cleanWhitespace((string)$pick('broker_name', 'source_broker', 'channel_partner')),
            'broker_phone_cache' => Normalizer::cleanWhitespace((string)$pick('broker_phone', 'broker_contact', 'broker_mobile')),
            'source_group_name' => Normalizer::cleanWhitespace((string)$pick('source_group', 'source_group_name', 'source_reference')),
            'exact_unit_or_plot_no' => Normalizer::cleanWhitespace((string)$pick('exact_unit_or_plot_no', 'exact_unit_no', 'unit_no', 'plot_no', 'flat_no')),
            'internal_floor_price_inr' => $floorInr,
            'commission_terms' => Normalizer::cleanWhitespace((string)$pick('commission_terms', 'broker_commission_percent', 'brokerage')),
            'payment_structure_notes' => !empty($paymentNotes) ? implode(' | ', $paymentNotes) : null,
            'encumbrance_notes' => Normalizer::cleanWhitespace((string)$pick('encumbrance_notes', 'hsvp_encumbrance_status')),
            'raw_whatsapp_text' => Normalizer::cleanWhitespace((string)$pick('raw_whatsapp_text', 'source_message_raw', 'original_message')),
            'internal_advisor_notes' => !empty($advisorNotes) ? implode(' | ', $advisorNotes) : null
        ];

        return ['publicRecord' => $publicRecord, 'privateRecord' => $privateRecord];
    }
}
