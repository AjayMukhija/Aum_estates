<?php
declare(strict_types=1);

/**
 * AUM Estates — Per-property share previews.
 *
 * WHY THIS EXISTS
 * Every call to action on the site ends in WhatsApp, so a shared link is a
 * referral. properties/detail.html is static HTML filled in by JavaScript,
 * and no link-preview crawler runs JavaScript — so a shared dossier showed
 * the generic site card instead of the property. This renders the Open Graph
 * tags server-side for that one URL.
 *
 * DATA SOURCE
 * The published feed (data/public_inventory.json), never the master database.
 * That feed has already passed validateAndProjectPublicRecord, so this class
 * cannot become a new disclosure path: it can only repeat what the site
 * already serves to anyone. It is read-only and holds no DB connection.
 */

namespace AumEstates\Domain;

final class SharePreview
{
    public const SITE_ORIGIN = 'https://aumestates.com';
    public const FALLBACK_IMAGE = '/assets/aum-estates-share.png';
    public const DETAIL_PATH = '/properties/detail.html';

    /**
     * NOTE: there is deliberately no user-agent / crawler test here.
     * Branching on the user agent was the first implementation and it was
     * wrong: Hostinger's CDN caches by URL and varies only on
     * Accept-Encoding, so it served whichever of the two responses it cached
     * first to everyone, differing per edge node. The same link returned a
     * metadata stub to buyers and the full page to crawlers, at random.
     * Every visitor gets one identical response instead.
     */

    /**
     * Locates the published feed. In production the front controller lives in
     * public_html and the feed sits beside it; in local development the site
     * directory is the docroot.
     */
    public static function locateFeed(?string $docRoot): ?string
    {
        $candidates = [];
        if (is_string($docRoot) && $docRoot !== '') {
            $candidates[] = rtrim($docRoot, '/') . '/data/public_inventory.json';
        }
        $candidates[] = __DIR__ . '/../../AUM_ESTATES_Website_For_Hostinger/data/public_inventory.json';
        $candidates[] = __DIR__ . '/../../dist_hostinger/data/public_inventory.json';

        foreach ($candidates as $candidate) {
            $resolved = realpath($candidate);
            if ($resolved !== false && is_file($resolved) && is_readable($resolved)) {
                return $resolved;
            }
        }
        return null;
    }

    /**
     * Finds one published record by property_id or slug. Returns null when the
     * id is unknown — a shared link to a withdrawn listing must not invent a
     * preview for it.
     */
    public static function findRecord(string $feedPath, string $key): ?array
    {
        $raw = @file_get_contents($feedPath);
        if ($raw === false || $raw === '') {
            return null;
        }
        $rows = json_decode($raw, true);
        if (!is_array($rows)) {
            return null;
        }

        $needle = strtolower(trim($key));
        if ($needle === '') {
            return null;
        }

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = strtolower((string)($row['property_id'] ?? ''));
            $slug = strtolower((string)($row['slug'] ?? ''));
            if ($id === $needle || ($slug !== '' && $slug === $needle)) {
                return $row;
            }
        }
        return null;
    }

    /** Human-readable price line, from whichever of the price fields carry data. */
    public static function priceLine(array $row): ?string
    {
        $text = trim((string)($row['price_text'] ?? ''));
        if ($text !== '') {
            return $text;
        }

        $rent = $row['rent_inr_monthly_norm'] ?? null;
        if (is_numeric($rent) && (float)$rent > 0) {
            return 'Rent ₹' . number_format((float)$rent, 0, '.', ',') . ' per month';
        }

        $capital = $row['price_inr_norm'] ?? null;
        if (is_numeric($capital) && (float)$capital > 0) {
            return 'Asking ' . self::formatIndianCurrency((float)$capital);
        }

        $value = $row['price_value'] ?? null;
        $unit = trim((string)($row['price_unit'] ?? ''));
        if (is_numeric($value) && (float)$value > 0 && $unit !== '') {
            return '₹' . rtrim(rtrim(number_format((float)$value, 2, '.', ','), '0'), '.') . ' ' . $unit;
        }

        return null;
    }

    /** ₹ in crore / lakh, the way the market states it. */
    public static function formatIndianCurrency(float $inr): string
    {
        if ($inr >= 10000000) {
            $cr = $inr / 10000000;
            return '₹' . rtrim(rtrim(number_format($cr, 2, '.', ''), '0'), '.') . ' Cr';
        }
        if ($inr >= 100000) {
            $lakh = $inr / 100000;
            return '₹' . rtrim(rtrim(number_format($lakh, 2, '.', ''), '0'), '.') . ' Lakh';
        }
        return '₹' . number_format($inr, 0, '.', ',');
    }

    /** "Sector 82, Gurgaon" — the place, stated once. */
    public static function placeLine(array $row): string
    {
        $parts = [];
        foreach (['sector', 'city'] as $field) {
            $value = trim((string)($row[$field] ?? ''));
            if ($value === '') {
                continue;
            }
            foreach ($parts as $existing) {
                if (strcasecmp($existing, $value) === 0) {
                    continue 2;
                }
            }
            $parts[] = $value;
        }
        return implode(', ', $parts);
    }

    public static function buildMeta(array $row): array
    {
        $id = (string)($row['property_id'] ?? '');
        $name = trim((string)($row['listing_title'] ?? '')) ?: 'Property Particulars';
        $place = self::placeLine($row);
        $title = $place !== '' ? "{$name}, {$place}" : $name;

        // The feed's own url field, trusted only after shape-checking it; an
        // id-built URL otherwise.
        $url = trim((string)($row['url'] ?? ''));
        if (!preg_match('#^https://aumestates\.com/#', $url)) {
            $url = self::SITE_ORIGIN . self::DETAIL_PATH . '?id=' . rawurlencode($id);
        }

        // Description: a preview card shows roughly two lines before it
        // truncates, so the facts a buyer decides on go first. Each candidate
        // is dropped if the description already states it — most descriptions
        // are composed from the same fields, and leading with "Shop /
        // Commercial Unit · 500 sq ft. Shop / Commercial Unit of 500 sq ft
        // in …" wastes the only two lines the card gives.
        $description = trim((string)($row['public_description'] ?? ''));
        $lead = [];

        $config = trim((string)($row['configuration'] ?? ''));
        if ($config !== '' && stripos($description, $config) === false) {
            $lead[] = $config;
        }

        $area = $row['area_value'] ?? null;
        $areaUnit = trim((string)($row['area_unit'] ?? ''));
        if (is_numeric($area) && (float)$area > 0 && $areaUnit !== '') {
            $areaText = rtrim(rtrim(number_format((float)$area, 2, '.', ','), '0'), '.') . ' ' . $areaUnit;
            if (stripos($description, $areaText) === false) {
                $lead[] = $areaText;
            }
        }

        // The price is the one fact worth repeating: it is what the recipient
        // of a forwarded listing looks for first.
        $price = self::priceLine($row);
        if ($price !== null && $price !== '') {
            $lead[] = $price;
        }

        $headline = implode(' · ', $lead);
        if ($headline !== '' && $description !== '') {
            $description = $headline . '. ' . $description;
        } elseif ($headline !== '') {
            $description = $headline . '.';
        }
        if ($description === '') {
            $description = 'Property particulars and advisory details from AUM ESTATES, Gurgaon.';
        }
        $description = self::truncate($description, 300);

        // Real photograph when the record has one. The privacy gate already
        // nulls generic stock placeholders, so image_file is either a genuine
        // photograph of this property or absent.
        $imageFile = trim((string)($row['image_file'] ?? ''));
        if ($imageFile !== '' && preg_match('/^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i', $imageFile)) {
            $image = self::SITE_ORIGIN . '/assets/property-images/' . rawurlencode($imageFile);
            $imageAlt = $name . ' — photograph';
            // Photograph dimensions vary per file, so they are left for the
            // crawler to measure. Declaring wrong ones is worse than none.
            $imageDims = null;
        } else {
            $image = self::SITE_ORIGIN . self::FALLBACK_IMAGE;
            $imageAlt = 'AUM ESTATES — private property advisory, Gurgaon, established 2002';
            $imageDims = ['width' => 1200, 'height' => 630];
        }

        return [
            'title' => self::truncate($title, 90) . ' | AUM ESTATES',
            'description' => $description,
            'url' => $url,
            'image' => $image,
            'image_alt' => $imageAlt,
            'image_dims' => $imageDims
        ];
    }

    /** Cuts at a word boundary so a card never ends mid-word. */
    public static function truncate(string $text, int $limit): string
    {
        if (mb_strlen($text) <= $limit) {
            return $text;
        }
        $cut = mb_substr($text, 0, $limit - 1);
        $lastSpace = mb_strrpos($cut, ' ');
        if ($lastSpace !== false && $lastSpace > $limit * 0.6) {
            $cut = mb_substr($cut, 0, $lastSpace);
        }
        return rtrim($cut, " ,.;:·-") . '…';
    }

    /**
     * Builds the per-property <head> metadata block.
     */
    public static function metaTags(array $meta): string
    {
        $e = static fn (string $v): string => htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        $title = $e($meta['title']);
        $description = $e($meta['description']);
        $url = $e($meta['url']);
        $image = $e($meta['image']);
        $imageAlt = $e($meta['image_alt']);

        $dims = '';
        if (is_array($meta['image_dims'] ?? null)) {
            $w = (int)$meta['image_dims']['width'];
            $h = (int)$meta['image_dims']['height'];
            $dims = "\n  <meta property=\"og:image:width\" content=\"{$w}\" />"
                  . "\n  <meta property=\"og:image:height\" content=\"{$h}\" />";
        }

        return <<<HTML
  <title>{$title}</title>
  <meta name="description" content="{$description}" />
  <link rel="canonical" href="{$url}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="AUM ESTATES" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:title" content="{$title}" />
  <meta property="og:description" content="{$description}" />
  <meta property="og:url" content="{$url}" />
  <meta property="og:image" content="{$image}" />
  <meta property="og:image:alt" content="{$imageAlt}" />{$dims}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{$title}" />
  <meta name="twitter:description" content="{$description}" />
  <meta name="twitter:image" content="{$image}" />
  <meta name="twitter:image:alt" content="{$imageAlt}" />
HTML;
    }

    /**
     * Returns the dossier page with this property's metadata substituted into
     * its head, or null if the page cannot be read or does not look like the
     * page we expect.
     *
     * WHY SUBSTITUTION AND NOT A SEPARATE STUB PAGE
     * The first version of this served crawlers a small metadata-only document
     * and let everyone else have the static file. Hostinger's CDN caches by URL
     * and varies only on Accept-Encoding, so it stored whichever response it
     * saw first and served that to everyone — the same link returned the stub
     * to buyers and the full page to crawlers, at random, per edge node. User
     * agent branching cannot work behind a cache that does not vary on it.
     *
     * So every visitor now gets ONE identical response: the real dossier, with
     * correct metadata. That is cache-safe by construction, and it fixes the
     * browser tab title and Google's indexed title as a side effect.
     */
    public static function renderDossier(string $detailHtmlPath, array $meta): ?string
    {
        $html = @file_get_contents($detailHtmlPath);
        if ($html === false || $html === '') {
            return null;
        }
        if (stripos($html, '</head>') === false) {
            return null;
        }

        // Drop the generic tags the static page carries, then insert this
        // property's. Scoped to the head so page copy is never touched.
        $headEnd = stripos($html, '</head>');
        $head = substr($html, 0, $headEnd);
        $rest = substr($html, $headEnd);

        $head = preg_replace('#[ \t]*<title>.*?</title>\s*#is', '', $head) ?? $head;
        $head = preg_replace(
            '#[ \t]*<meta\s+(?:name|property)="(?:description|og:[a-z:]+|twitter:[a-z:]+)"[^>]*>\s*#is',
            '',
            $head
        ) ?? $head;
        $head = preg_replace('#[ \t]*<link\s+rel="canonical"[^>]*>\s*#is', '', $head) ?? $head;

        return rtrim($head) . "
" . self::metaTags($meta) . $rest;
    }
}
