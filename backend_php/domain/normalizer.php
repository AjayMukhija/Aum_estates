<?php
declare(strict_types=1);

namespace AumEstates\Domain;

final class Normalizer
{
    private const UNIT_CODE_REGEX = '/\b[A-Z]-\d{3,4}\b/';

    private const FLOOR_MARKERS = [
        'GF' => 'Ground Floor',
        'FF' => 'First Floor',
        'SF' => 'Second Floor',
        'TF' => 'Third Floor'
    ];

    private const CATEGORY_NOUNS = [
        'apartment' => 'apartment',
        'builder-floor' => 'builder floor',
        'villa' => 'villa',
        'plot' => 'plot',
        'commercial' => 'commercial property',
        'farmhouse' => 'farmhouse'
    ];

    private const GENERIC_TYPE = '/^(residential|commercial|property|other)$/i';

    /**
     * Stock filler standing in for a photograph. Mirrors
     * GENERIC_PLACEHOLDER_IMAGES in backend/domain/normalizer.js — these
     * nine files are byte-identical placeholders, not pictures of the
     * property, so the public feed reports no photograph and the front end
     * draws a neutral panel instead.
     */
    public const GENERIC_PLACEHOLDER_IMAGES = [
        'apartment.jpg', 'builder-floor.jpg', 'building.jpg', 'commercial.jpg',
        'office.jpg', 'plot.jpg', 'plot-land-user.jpg', 'shop.jpg',
        'sushant-lok-plot.jpg', 'villa.jpg',
    ];

    public static function isGenericPlaceholderImage($file): bool
    {
        return is_string($file)
            && in_array(strtolower(trim($file)), self::GENERIC_PLACEHOLDER_IMAGES, true);
    }

    /**
     * House style for buyer-facing text. The PHP twin of
     * normalizePublicVocabulary in backend/domain/normalizer.js: the API
     * projects straight from the master, so without this the same trade
     * shorthand the static feed no longer carries would still reach any
     * client reading /api/public/properties.
     */
    public static function normalizePublicVocabulary(?string $value): ?string
    {
        if (!is_string($value) || $value === '') {
            return $value;
        }

        $out = $value;
        $out = preg_replace('/\bservants?[\s-]*(?:quarters?|qtrs?)\b/i', 'Staff Quarters', $out);
        $out = preg_replace('/\bservants?[\s-]*rooms?\b/i', 'Staff Room', $out);
        $out = preg_replace('/\bservants?\b/i', 'Staff Room', $out);
        $out = preg_replace('/\bnaksha\s*pass(?:ed)?\b/i', 'Sanctioned Plan', $out);
        $out = preg_replace('/\bnaksha\b/i', 'Building Plan', $out);
        $out = preg_replace('/\bsq\.?\s*ft\.?\b/i', 'sq ft', $out);
        $out = preg_replace('/\bsq\.?\s*yds?\.?\b/i', 'sq yd', $out);
        $out = preg_replace('/\bsq\.?\s*m(?:tr)?s?\.?\b/i', 'sq m', $out);
        $out = preg_replace('/\b(\d+)\s*bhk\b/i', '$1 BHK', $out);
        $out = preg_replace('/\brepresentative\s+reference\s+photographs?\b/i', 'Representative image', $out);
        $out = preg_replace('/\brepresentative\s+(?:visual|photographs?)\b/i', 'Representative image', $out);
        // "Unspecified" is the worksheet's empty cell; it reaches public text
        // through micro_location ("Unspecified DLF Phase 1"), which the
        // composed description folds into its place phrase.
        $out = preg_replace('/\bunspecified\b/i', ' ', $out);
        // Removing it leaves the locality stated twice, comma- or space-separated.
        $out = preg_replace('/\b([\w][\w\s.&\x{2019}\'-]{3,40}?)(?:,\s*|\s+)\1\b/iu', '$1', $out);
        $out = preg_replace('/\s{2,}/', ' ', $out);
        $out = preg_replace('/,\s*(?=[;,.])/', '', $out);
        $out = preg_replace('/\s+,/', ',', $out);
        $out = preg_replace('/\s+([;,.])/', '$1', $out);

        return trim($out);
    }

    public static function cleanWhitespace(?string $val): ?string
    {
        if ($val === null) {
            return null;
        }
        $s = trim(preg_replace('/\s+/u', ' ', (string)$val));
        return $s === '' ? null : $s;
    }

    public static function normText(?string $s): string
    {
        $text = (string)($s ?? '');
        $text = mb_strtolower($text, 'UTF-8');
        $text = str_replace('&', ' and ', $text);
        $text = preg_replace('/[^a-z0-9+]+/i', ' ', $text);
        return trim($text);
    }

    public static function slugify(?string $str): string
    {
        $text = (string)($str ?? '');
        $text = mb_strtolower($text, 'UTF-8');
        $text = str_replace('&', 'and', $text);
        $text = preg_replace('/[^a-z0-9]+/i', '-', $text);
        $text = trim($text, '-');
        return mb_substr($text, 0, 96, 'UTF-8');
    }

    public static function normalizeAreaSqFt($areaValue, $areaUnit = 'sq ft'): ?int
    {
        if ($areaValue === null || $areaValue === '' || !is_numeric($areaValue)) {
            return null;
        }
        $n = (float)$areaValue;
        if (!is_finite($n) || $n <= 0) {
            return null;
        }
        $u = mb_strtolower(trim((string)($areaUnit ?? 'sq ft')), 'UTF-8');

        if (preg_match('/\b(acre|acres)\b/i', $u)) {
            return (int)round($n * 43560);
        }
        if (preg_match('/\b(kanal|kanals)\b/i', $u)) {
            return (int)round($n * 5445);
        }
        if (preg_match('/\b(marla|marlas)\b/i', $u)) {
            return (int)round($n * 272.25);
        }
        if (preg_match('/\b(sq\s*m|sq\s*mtr|sqm|meter|metre)\b/i', $u)) {
            return (int)round($n * 10.7639);
        }
        if (preg_match('/\b(sq\s*yd|sq\s*yard|sq\s*yards|yard|yards|gaj)\b/i', $u)) {
            return (int)round($n * 9);
        }
        return (int)round($n);
    }

    public static function areaInSqYd($areaValue, $areaUnit, ?int $areaSqFtNorm): ?float
    {
        if ($areaValue !== null && $areaValue !== '' && is_numeric($areaValue)) {
            $n = (float)$areaValue;
            $u = mb_strtolower((string)($areaUnit ?? ''), 'UTF-8');
            if (is_finite($n) && $n > 0 && preg_match('/\b(sq\s*yd|sq\s*yard|sq\s*yards|gaj)\b/i', $u)) {
                return $n;
            }
        }
        if ($areaSqFtNorm !== null && $areaSqFtNorm > 0) {
            return $areaSqFtNorm / 9.0;
        }
        return null;
    }

    public static function parsePriceFromText(?string $priceText): ?int
    {
        if (!$priceText) {
            return null;
        }
        $s = (string)$priceText;
        if (preg_match('/per\s*sq|\/\s*sq|lakh\/sq|lac\/sq/i', $s)) {
            return null;
        }
        if (preg_match('/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)\b/i', $s, $m)) {
            $val = (float)$m[1];
            if (is_finite($val) && $val > 0 && $val < 5000) {
                return (int)round($val * 1e7);
            }
        }
        if (preg_match('/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i', $s, $m)) {
            $val = (float)$m[1];
            if (is_finite($val) && $val > 0) {
                return (int)round($val * 1e5);
            }
        }
        return null;
    }

    public static function normalizePriceInr(array $params): ?int
    {
        $priceValue = $params['priceValue'] ?? $params['price_value'] ?? null;
        $priceUnit = $params['priceUnit'] ?? $params['price_unit'] ?? null;
        $priceText = $params['priceText'] ?? $params['price_text'] ?? null;
        $transactionType = $params['transactionType'] ?? $params['transaction_type'] ?? null;
        $areaValue = $params['areaValue'] ?? $params['area_value'] ?? null;
        $areaUnit = $params['areaUnit'] ?? $params['area_unit'] ?? null;
        $areaSqFtNorm = $params['areaSqFtNorm'] ?? $params['area_sqft_norm'] ?? null;

        $tx = mb_strtolower((string)($transactionType ?? ''), 'UTF-8');
        $isPureRent = (str_contains($tx, 'rent') || str_contains($tx, 'lease')) && !str_contains($tx, 'sale');
        if ($isPureRent) {
            return null;
        }

        $sqFt = $areaSqFtNorm ?? self::normalizeAreaSqFt($areaValue, $areaUnit);
        $sqYd = self::areaInSqYd($areaValue, $areaUnit, $sqFt);
        $hasVal = $priceValue !== null && $priceValue !== '' && is_numeric($priceValue);
        $v = $hasVal ? (float)$priceValue : null;
        $u = mb_strtolower(trim((string)($priceUnit ?? '')), 'UTF-8');

        if ($v !== null && is_finite($v) && $v > 0) {
            // Per Sq Yd rates
            if (preg_match('/sq\s*yd|sq\s*yard/i', $u)) {
                $ratePerSqYd = $v;
                if (preg_match('/\bcr/i', $u)) {
                    $ratePerSqYd = $v * 1e7;
                } elseif (preg_match('/\b(lakh|lac)/i', $u)) {
                    $ratePerSqYd = $v * 1e5;
                }
                if ($sqYd && $sqYd > 0) {
                    return (int)round($ratePerSqYd * $sqYd);
                }
                return null;
            }

            // Per Sq Ft rates
            if (preg_match('/sq\s*ft/i', $u)) {
                $ratePerSqFt = $v;
                if (preg_match('/\bcr/i', $u)) {
                    $ratePerSqFt = $v * 1e7;
                } elseif (preg_match('/\b(lakh|lac)/i', $u)) {
                    $ratePerSqFt = $v * 1e5;
                }
                if ($sqFt && $sqFt > 0) {
                    return (int)round($ratePerSqFt * $sqFt);
                }
                return null;
            }

            // Total amounts
            if ($u === 'cr' || preg_match('/\bcrore/i', $u)) {
                return (int)round($v * 1e7);
            }
            if (preg_match('/\b(lakh|lac)/i', $u)) {
                return (int)round($v * 1e5);
            }
            if ($u === 'inr' || $u === 'total' || $u === 'inr onwards') {
                return (int)round($v < 500 ? $v * 1e7 : $v);
            }

            // Heuristic when unit is null or empty
            if ($u === '') {
                if ($v <= 500) {
                    return (int)round($v * 1e7);
                }
                if ($v >= 100000) {
                    return (int)round($v);
                }
            }
        }

        return self::parsePriceFromText($priceText);
    }

    public static function normalizeRentInr(array $params): ?int
    {
        $rentValue = $params['rentValue'] ?? $params['rent_value'] ?? null;
        $rentUnit = $params['rentUnit'] ?? $params['rent_unit'] ?? null;
        $priceValue = $params['priceValue'] ?? $params['price_value'] ?? null;
        $priceUnit = $params['priceUnit'] ?? $params['price_unit'] ?? null;
        $transactionType = $params['transactionType'] ?? $params['transaction_type'] ?? null;
        $areaSqFtNorm = $params['areaSqFtNorm'] ?? $params['area_sqft_norm'] ?? null;

        $tx = mb_strtolower((string)($transactionType ?? ''), 'UTF-8');
        if (!str_contains($tx, 'rent') && !str_contains($tx, 'lease')) {
            return null;
        }

        $hasRv = $rentValue !== null && $rentValue !== '' && is_numeric($rentValue);
        $rv = $hasRv ? (float)$rentValue : null;
        $ru = mb_strtolower(trim((string)($rentUnit ?? '')), 'UTF-8');
        if ($rv !== null && is_finite($rv) && $rv > 0) {
            if (preg_match('/\b(lakh|lac)/i', $ru)) {
                return (int)round($rv * 1e5);
            }
            if (preg_match('/\bcr/i', $ru)) {
                return (int)round($rv * 1e7);
            }
            if (preg_match('/sq\s*ft/i', $ru) && $areaSqFtNorm) {
                return (int)round($rv * $areaSqFtNorm);
            }
            return (int)round($rv);
        }

        $hasPv = $priceValue !== null && $priceValue !== '' && is_numeric($priceValue);
        $pv = $hasPv ? (float)$priceValue : null;
        $pu = mb_strtolower(trim((string)($priceUnit ?? '')), 'UTF-8');
        if ($pv !== null && is_finite($pv) && $pv > 0) {
            if (preg_match('/sq\s*ft/i', $pu) && $areaSqFtNorm) {
                return (int)round($pv * $areaSqFtNorm);
            }
            if (preg_match('/\b(lakh|lac)/i', $pu)) {
                return (int)round($pv * 1e5);
            }
            if ($pv >= 5000) {
                return (int)round($pv);
            }
        }

        return null;
    }

    public static function formatInr($amount): string
    {
        if ($amount === null || $amount === '' || !is_numeric($amount)) {
            return '';
        }
        $n = (float)$amount;
        if (!is_finite($n) || $n <= 0) {
            return '';
        }
        if ($n >= 1e7) {
            $cr = $n / 1e7;
            $formatted = fmod($cr, 1.0) == 0.0 ? sprintf('%.0f', $cr) : rtrim(sprintf('%.2f', $cr), '0');
            return "₹{$formatted} Cr";
        }
        if ($n >= 1e5) {
            $lakh = $n / 1e5;
            $formatted = fmod($lakh, 1.0) == 0.0 ? sprintf('%.0f', $lakh) : sprintf('%.1f', $lakh);
            return "₹{$formatted} Lakh";
        }
        return '₹' . number_format((float)round($n));
    }

    public static function cleanListingTitle(?string $title, ?string $projectName = null): string
    {
        $base = self::stripUnitCodes(self::cleanWhitespace($title)) ?? self::cleanWhitespace($projectName) ?? 'Gurugram Property Mandate';
        $res = preg_replace('/\b(?:unit|flat|(?:plot|house)\s*(?:no\.?|number))\s*#?\s*\d+[A-Z0-9\/-]*\b/i', '', $base);
        $res = preg_replace('/\s{2,}/u', ' ', $res);
        $res = preg_replace('/\s+MP$/i', '', $res);
        $res = preg_replace('/\s+OC tower$/i', ' (OC Received)', $res);
        $res = preg_replace('/\s+#\d+$/i', '', $res);
        $res = preg_replace('/\s*;\s*\d+(?:\.\d+)?%\s*brokerage.*$/i', '', $res);
        // Worksheet residue, mirroring cleanListingTitle in
        // backend/domain/normalizer.js: the empty-cell marker, internal
        // option numbering, the locality it leaves stated twice, and
        // survey-grade decimals.
        $res = preg_replace('/\bunspecified\b/i', ' ', $res);
        $res = preg_replace('/\s*[-\x{2013}]\s*option\s*\d+\b/iu', '', $res);
        $res = preg_replace('/\b([\w][\w\s.&\x{2019}\'-]{3,40}?)\s+\1\b/iu', '$1', $res);
        $res = preg_replace('/\b(\d+)\.\d+(\s*sq\s*(?:yd|ft|m))\b/i', '$1$2', $res);
        $res = preg_replace('/\s{2,}/u', ' ', $res);
        $res = preg_replace('/\s+([;,.])/u', '$1', $res);
        $res = preg_replace('/^[\s;,.\-]+|[\s;,.\-]+$/u', '', $res);
        return trim($res);
    }

    /**
     * price_text is printed as the price on every card. PHP twin of
     * normalizePublicPriceText in backend/domain/normalizer.js: a value with
     * no number in it ("MP", "Confirm unit", "Price not supplied") is a
     * worksheet note, not a price, and internal asides about where a figure
     * came from are dropped.
     */
    public static function normalizePublicPriceText(?string $priceText, ?string $transactionType = null): ?string
    {
        $text = self::cleanWhitespace($priceText);
        if ($text === null || $text === '') {
            return null;
        }

        $isRental = preg_match('/rent|lease/i', (string)$transactionType)
            || preg_match('/\brent\b/i', $text);
        $onRequest = $isRental ? 'Rent on Request' : 'Price on Request';

        $stripped = self::cleanWhitespace(
            preg_replace('/\s*\((?:[^)]*\b(?:source|messages?|differ|verify|wording)\b[^)]*)\)/i', '', $text)
        );

        if ($stripped === null || $stripped === '' || !preg_match('/\d/', $stripped)) {
            return $onRequest;
        }
        if (preg_match('/^price\s*on\s*(?:request|call)$/i', $stripped)) {
            return $onRequest;
        }

        return $stripped;
    }

    public static function formatPublicPriceDisplay(array $record): string
    {
        $tx = mb_strtolower((string)($record['transaction_type'] ?? ''), 'UTF-8');
        $isPureRent = (str_contains($tx, 'rent') || str_contains($tx, 'lease')) && !str_contains($tx, 'sale');
        if ($isPureRent && !empty($record['rent_inr_monthly_norm'])) {
            return self::formatInr($record['rent_inr_monthly_norm']) . ' / month';
        }

        if (!empty($record['price_text'])) {
            $s = trim((string)$record['price_text']);
            if (preg_match('/^(mp|market\s*rates?)$/i', $s)) {
                return 'Market Price on Request';
            }
            if (preg_match('/^price\s*on\s*(call|request)$/i', $s)) {
                return 'Price on Request';
            }
            if (!preg_match('/confirm\s*unit|keys\s*in\s*hand|cheque|white|black|brokerage|commission|verify|not\s*supplied/i', $s)) {
                return $s;
            }
        }

        if (isset($record['price_value']) && $record['price_value'] !== '' && is_numeric($record['price_value'])) {
            $u = mb_strtolower((string)($record['price_unit'] ?? ''), 'UTF-8');
            if (str_contains($u, 'sq')) {
                return trim("₹{$record['price_value']} {$record['price_unit']}");
            }
            if ($u === 'cr' || str_contains($u, 'crore')) {
                return "₹{$record['price_value']} Cr";
            }
            if (str_contains($u, 'lakh') || str_contains($u, 'lac')) {
                return "₹{$record['price_value']} Lakh";
            }
        }

        if (!empty($record['price_inr_norm'])) {
            return self::formatInr($record['price_inr_norm']);
        }
        if (!empty($record['rent_inr_monthly_norm'])) {
            return self::formatInr($record['rent_inr_monthly_norm']) . ' / month';
        }

        return 'Price on Request';
    }

    public static function classifyCategory(array $record): string
    {
        $p = self::normText($record['property_type'] ?? '');
        $c = self::normText($record['configuration'] ?? '');
        $t = self::normText(implode(' ', array_filter([
            $record['listing_title'] ?? null,
            $record['project_name'] ?? null,
            $record['inventory_category'] ?? null
        ])));
        $combined = "{$p} {$c}";

        if (preg_match('/\b(plot|plots|land|farm land|hospital land)\b/i', $p) ||
            preg_match('/\b(plot|plots|land)\b/i', $c) ||
            preg_match('/\b(plot|plots|land)\b/i', $t)) {
            return 'plot';
        }
        if (preg_match('/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory|booth|hospital|healthcare|guest house|hotel|building)\b/i', $combined)) {
            return 'commercial';
        }
        if (preg_match('/\b(farmhouse|farm house)\b/i', "{$combined} {$t}")) {
            return 'farmhouse';
        }
        if (preg_match('/\b(builder floor|builder floors|floor|floors)\b/i', $combined)) {
            return 'builder-floor';
        }
        if (preg_match('/\b(villa|villas|house|houses|kothi|kothis)\b/i', $combined)) {
            return 'villa';
        }
        if (preg_match('/\b(apartment|apartments|flat|flats|condo|condominium|penthouse)\b/i', $combined)) {
            return 'apartment';
        }
        return 'apartment';
    }

    public static function classifyCorridor(array $record): string
    {
        $hay = self::normText(implode(' ', array_filter([
            $record['city'] ?? null,
            $record['locality'] ?? null,
            $record['sector'] ?? null,
            $record['micro_location'] ?? null,
            $record['project_name'] ?? null,
            $record['listing_title'] ?? null
        ])));

        if (preg_match('/\b(goa|arrossim|majorda|narve|piedade|divar|tiswadi|asya|sukoon)\b/i', $hay)) {
            return 'South Goa';
        }
        if (preg_match('/\b(dlf phase 1|dlf phase 2|dlf phase 3|dlf phase 4|dlf phase 5|dlf 1|dlf 2|dlf 3|dlf 4|dlf 5|dlf exclusive|dlf grove|dlf the grove|ridgewood|regency park|oakwood|trinity|wellington|beverley|silver oaks|dlf city)\b/i', $hay)) {
            return 'DLF Phase 1–5';
        }
        if (preg_match('/\b(golf course road|belaire|park place|magnolias|camellias|aralias|crest|carlton|westend|vipul belmonte|parsvnath exotica|paras quartier|gwal pahari|valley view|suncity|palm springs|verandas|laburnum|godrej miraya|sector 42|sector 43|sector 53|sector 54|sector 26|sector 27|sector 28)\b/i', $hay)) {
            return 'Golf Course Road';
        }
        if (preg_match('/\b(golf course ext|extension road|spr|southern peripheral|arbour|aureva|elevate|pioneer|presidia|araya|ireo|aravalli|aravallis|m3m golf|m3m heights|m3m latitude|birla navya|adani samsara|anant raj|anantraj|emerald|heritage one|tata raisina|paras irene|florett|smartworld|aspen|whiteland|urban oasis|omara|lamborghini|green oaks|nitara|sector 55|sector 56|sector 57|sector 58|sector 59|sector 60|sector 61|sector 62|sector 63|sector 63a|sector 64|sector 65|sector 66|sector 67|sector 68|sector 69|sector 70|sector 70a|sector 71|sector 72)\b/i', $hay)) {
            return 'Golf Course Ext & SPR';
        }
        if (preg_match('/\b(dwarka expressway|new gurgaon|sobha aranya|sobha city|m3m capital|godrej meridian|indiabulls enigma|bptp amstoria|signature global|vatika inxt|bestech ananda|saan verdante|tripundra|bijwasan|sector 37c|sector 37d|sector 76|sector 77|sector 78|sector 79|sector 80|sector 81|sector 82|sector 83|sector 84|sector 85|sector 86|sector 88|sector 89|sector 90|sector 91|sector 92|sector 93|sector 95|sector 99|sector 102|sector 103|sector 104|sector 106|sector 108|sector 109|sector 110|sector 111|sector 112|sector 113|sector 114)\b/i', $hay)) {
            return 'Dwarka Expressway & New Gurgaon';
        }
        if (preg_match('/\b(nirvana|sohna road|south city 2|malibu|mayfield|fresco|blossom|harmony|close north|close south|uppal southend|vipul world|rosewood|ardee|orchid island|orchid ivy|eldeco|uniworld|bestech parkview|palladians|arcadia|rodeo drive|universal trade|vantage aura|palm terrace|palm floors|greenwood|sector 33|sector 38|sector 39|sector 40|sector 45|sector 46|sector 47|sector 48|sector 49|sector 50|sector 51|sector 52)\b/i', $hay)) {
            return 'Nirvana Country & Sohna Road';
        }
        if (preg_match('/\b(sushant lok|south city 1|udyog vihar|palam vihar|mg road|sahara mall|enkay|shukrana|sector 14|sector 15|sector 17|sector 21|sector 22|sector 23|sector 29|sector 30|sector 31|sector 32)\b/i', $hay)) {
            return 'Sushant Lok & Central Gurgaon';
        }

        return 'Gurugram Central & Other';
    }

    public static function resolveRepresentativeImage(array $record): string
    {
        $cat = $record['category'] ?? self::classifyCategory($record);
        if ($cat === 'plot') {
            return 'plot-land-user.jpg';
        }

        $name = self::normText(implode(' ', array_filter([
            $record['listing_title'] ?? null,
            $record['project_name'] ?? null,
            $record['locality'] ?? null,
            $record['micro_location'] ?? null,
            $record['sector'] ?? null,
            $record['public_description'] ?? null,
            $record['key_features'] ?? null
        ])));

        $rules = [
            ['/sector 46 guest house|guest house/i', 'commercial.jpg'],
            ['/asya smartliving|sukoon/i', 'sukoon-asya-project-photo.jpg'],
            ['/puri the aravallis|puri aravallis|puri the aravalli/i', 'puri-the-aravalis.jpg'],
            ['/privana/i', 'privana.jpg'],
            ['/sobha aranya/i', 'sobha-aranya.jpg'],
            ['/indiabulls enigma/i', 'indiabulls-enigma.jpg'],
            ['/paras irene/i', 'paras-irene.jpg'],
            ['/eldeco mansionz|eldeco mansions/i', 'eldeco-mansionz.jpg'],
            ['/uniworld garden 1/i', 'uniworld-garden-1.jpg'],
            ['/tata raisina/i', 'tata-raisina.webp'],
            ['/paras the florett/i', 'paras-the-florett.jpg'],
            ['/ireo uptown/i', 'ireo-uptown.jpg'],
            ['/the aspen|aspen green|whiteland/i', 'the-aspen.webp'],
            ['/pioneer araya|\baraya\b/i', 'pioneer-araya.jpg'],
            ['/smartworld sky arc/i', 'smartworld-sky-arc.webp'],
            ['/\bharmony\b/i', 'harmony.jpg'],
            ['/urban oasis/i', 'urban-oasis.jpg'],
            ['/palm terrace select|palm terraces select/i', 'palm-terrace-select.jpeg'],
            ['/pioneer presidia/i', 'pioneer-presidia.jpg'],
            ['/ridgewood estate|rigdewood estate/i', 'ridgewood-estate.jpg'],
            ['/arrossim|south goa/i', 'arrossim.jpg'],
            ['/sushant lok 1 a block 350 sq yd upper ground/i', 'sushant-lok-1-a-block-350-upper-ground.jpg'],
            ['/shukrana homes/i', 'shukrana-homes.jpg'],
            ['/sushant lok/i', 'sushant-lok.jpg'],
            ['/m3m capital/i', 'm3m-capital-113.webp'],
            ['/south city 2/i', 'south-city-2.jpg'],
            ['/close north/i', 'close-north.jpg'],
            ['/close south/i', 'close-south.jpg'],
            ['/vipul world/i', 'vipul-world.jpg'],
            ['/godrej meridian|godrej meridien|godrej miraya/i', 'godrej-meridian.jpg'],
            ['/malibu towne|malibu town/i', 'malibu-towne.jpg'],
            ['/paras quartier/i', 'paras-quartier.jpg'],
            ['/heritage one/i', 'heritage-one.jpg'],
            ['/orchid island|orchid ivy/i', 'orchid-island.jpg'],
            ['/dlf exclusive floor/i', 'dlf-exclusive-floors.jpg'],
            ['/omaxe the nile/i', 'omaxe-the-nile.jpeg'],
            ['/uppal southend|uppal south end/i', 'uppal-southend.jpg'],
            ['/m3m heights/i', 'm3m-heights.jpg'],
            ['/ireo grand arch/i', 'ireo-grand-arch.jpg'],
            ['/signature global deluxe/i', 'signature-global-deluxe-dxp.webp'],
            ['/dlf the belaire|dlf belaire/i', 'dlf-the-belaire.webp'],
            ['/elevate by hines|conscient elevate|elevate hines/i', 'elevate-by-hines.webp'],
            ['/dlf park place/i', 'dlf-park-place.jpg'],
            ['/dlf westend heights/i', 'dlf-westend-heights.jpg'],
            ['/dlf carlton estate/i', 'dlf-carlton-estate.jpg'],
            ['/dlf arbour|dlf the arbour/i', 'dlf-arbour.jpg'],
            ['/dlf grove|dlf the grove/i', 'dlf-grove.jpg'],
            ['/adani samsara/i', 'adani-samsara.jpg'],
            ['/anant raj|anantraj/i', 'anant-raj.jpg'],
            ['/birla navya/i', 'birla-navya.jpg'],
            ['/blossom 2/i', 'blossom-2.jpg'],
            ['/bptp freedom/i', 'bptp-freedom.jpg']
        ];

        foreach ($rules as [$regex, $file]) {
            if (preg_match($regex, $name)) {
                return $file;
            }
        }

        $fallbacks = [
            'villa' => 'villa.jpg',
            'farmhouse' => 'villa.jpg',
            'builder-floor' => 'builder-floor.jpg',
            'apartment' => 'apartment.jpg',
            'plot' => 'plot-land-user.jpg',
            'commercial' => 'commercial.jpg'
        ];

        return $fallbacks[$cat] ?? 'apartment.jpg';
    }

    public static function parseBedroomsInt($bedrooms, $configuration = null, $listingTitle = null): ?int
    {
        if ($bedrooms !== null && $bedrooms !== '') {
            if (preg_match('/(\d+)/', (string)$bedrooms, $m)) {
                return (int)$m[1];
            }
        }
        $combined = "{$configuration} {$listingTitle}";
        if (preg_match('/\b(\d+)\s*bhk\b/i', $combined, $bhk)) {
            return (int)$bhk[1];
        }
        return null;
    }

    public static function stripUnitCodes(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }
        $s = preg_replace('/\bunit\s+[A-Z]-\d{3,4}\b/i', '', (string)$text);
        $s = preg_replace(self::UNIT_CODE_REGEX, '', $s);
        $s = preg_replace('/\s+([;,.])/u', '$1', $s);
        $s = preg_replace('/\s{2,}/u', ' ', $s);
        return self::cleanWhitespace($s);
    }

    public static function containsUnitCode(?string $text): bool
    {
        if ($text === null) {
            return false;
        }
        return (bool)preg_match(self::UNIT_CODE_REGEX, (string)$text);
    }

    public static function extractFloorMarker(?string $title): ?string
    {
        if (preg_match('/\((GF|FF|SF|TF)\)\s*$/i', (string)($title ?? ''), $m)) {
            $key = strtoupper($m[1]);
            return self::FLOOR_MARKERS[$key] ?? null;
        }
        return null;
    }

    public static function stripFloorMarker(?string $title): ?string
    {
        $res = preg_replace('/\((?:GF|FF|SF|TF)\)\s*$/i', '', (string)($title ?? ''));
        return self::cleanWhitespace($res);
    }

    public static function formatFloorLabel(?string $floorLabel): string
    {
        $raw = self::cleanWhitespace($floorLabel);
        if (!$raw) {
            return '';
        }
        $key = strtoupper($raw);
        if (isset(self::FLOOR_MARKERS[$key])) {
            return self::FLOOR_MARKERS[$key];
        }
        if (preg_match('/floor/i', $raw)) {
            return $raw;
        }
        if (str_contains($raw, '+')) {
            return $raw;
        }
        if (preg_match('/^(?:ground|upper ground|lower ground|basement|stilt|terrace)$/i', $raw)) {
            return "{$raw} Floor";
        }
        if (preg_match('/^\d+(?:st|nd|rd|th)$/i', $raw)) {
            return "{$raw} Floor";
        }
        return $raw;
    }

    public static function formatAreaPhrase(array $row): string
    {
        $value = $row['area_value'] ?? null;
        $unit = self::cleanWhitespace($row['area_unit'] ?? null);
        if ($value === null || $value === '' || !$unit || !is_numeric($value)) {
            return '';
        }
        $num = (float)$value;
        if (!is_finite($num) || $num <= 0) {
            return '';
        }
        $shown = fmod($num, 1.0) == 0.0 ? sprintf('%.0f', $num) : (string)$num;
        $unitNorm = mb_strtolower($unit, 'UTF-8');
        $unitNorm = preg_replace('/\bsq\s*yards?\b/i', 'sq yd', $unitNorm);
        $unitNorm = preg_replace('/\bsq\s*(?:ft|feet)\b/i', 'sq ft', $unitNorm);
        return "{$shown} {$unitNorm}";
    }

    public static function formatPlacePhrase(array $row): string
    {
        $locality = self::cleanWhitespace($row['locality'] ?? null);
        $sector = self::cleanWhitespace($row['sector'] ?? null);
        $city = self::cleanWhitespace($row['city'] ?? null);
        $parts = [];

        $push = function (?string $value) use (&$parts) {
            $v = self::cleanWhitespace($value);
            if ($v) {
                foreach ($parts as $p) {
                    if (mb_strtolower($p, 'UTF-8') === mb_strtolower($v, 'UTF-8')) {
                        return;
                    }
                }
                $parts[] = $v;
            }
        };

        $push($locality);
        if ($sector && !preg_match('/sector/i', $locality ?? '')) {
            $push(preg_match('/^\d/', $sector) ? "Sector {$sector}" : $sector);
        }
        if ($city) {
            $alreadyHas = false;
            foreach ($parts as $p) {
                if (str_contains(mb_strtolower($p, 'UTF-8'), mb_strtolower($city, 'UTF-8'))) {
                    $alreadyHas = true;
                    break;
                }
            }
            if (!$alreadyHas) {
                $push($city);
            }
        }
        return implode(', ', $parts);
    }

    public static function composePublicDescription(?array $row): string
    {
        if (!$row) {
            return '';
        }
        $config = self::cleanWhitespace($row['configuration'] ?? null);
        $typeRaw = self::cleanWhitespace($row['property_type'] ?? null);
        $cat = self::cleanWhitespace($row['category'] ?? null);
        $noun = ($typeRaw && !preg_match(self::GENERIC_TYPE, $typeRaw))
            ? mb_strtolower($typeRaw, 'UTF-8')
            : (self::CATEGORY_NOUNS[$cat ?? ''] ?? 'property');

        $area = self::formatAreaPhrase($row);
        $place = self::formatPlacePhrase($row);
        if (!$place && !$area) {
            return '';
        }

        $lead = '';
        $nounWords = array_filter(preg_split('/\s+/u', $noun), fn($w) => mb_strlen($w) > 3);
        $configNamesNoun = false;
        if ($config) {
            foreach ($nounWords as $w) {
                if (preg_match('/\b' . preg_quote($w, '/') . '/i', $config)) {
                    $configNamesNoun = true;
                    break;
                }
            }
        }

        if ($config) {
            $lead .= $configNamesNoun ? $config : "{$config} {$noun}";
        } else {
            $lead .= $noun;
        }

        if ($area) {
            $lead .= " of {$area}";
        }
        if ($place) {
            $lead .= " in {$place}";
        }

        $sentences = [ucfirst($lead) . '.'];

        $floor = self::formatFloorLabel($row['floor_label'] ?? null);
        if ($floor) {
            $sentences[] = "{$floor}.";
        }

        $corridor = self::cleanWhitespace($row['corridor'] ?? null);
        if ($corridor && !str_contains(mb_strtolower($place ?: '', 'UTF-8'), mb_strtolower($corridor, 'UTF-8'))) {
            $sentences[] = "Located on the {$corridor} corridor.";
        }

        $facing = self::cleanWhitespace($row['facing'] ?? null);
        if ($facing && !preg_match('/conflict|\/|\bor\b|\?/i', $facing)) {
            $facingClean = self::cleanWhitespace(preg_replace('/\s*facing\s*$/i', '', $facing));
            $sentences[] = "{$facingClean} facing.";
        }

        $txn = self::cleanWhitespace($row['transaction_type'] ?? null);
        if (preg_match('/rent|lease/i', $txn ?? '')) {
            $sentences[] = 'Offered on lease.';
        } elseif (preg_match('/sale|resale/i', $txn ?? '')) {
            $sentences[] = 'Offered for sale.';
        }

        return self::cleanWhitespace(implode(' ', $sentences)) ?? '';
    }
}
