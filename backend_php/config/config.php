<?php
declare(strict_types=1);

/**
 * AUM Estates PHP Backend — Configuration and Environment Definitions
 */

namespace AumEstates;

final class Config
{
    public const APP_NAME = 'AUM Estates Advisory & Private Client CRM';
    public const APP_VERSION = '2.0.0-php';

    // Property ID pattern
    public const PROPERTY_ID_REGEX = '/^AUM-[A-Z0-9]+-\d+$/i';

    // Official contacts
    public const OFFICIAL_PHONES = ['9873813595', '9811157018'];
    public const OFFICIAL_WHATSAPP = '919873813595';
    public const OFFICIAL_DIRECT_LINE = '+919811157018';

    // Publication & Domain States
    public const PUBLICATION_STATES = [
        'draft',
        'pending_approval',
        'approved_public',
        'private_off_market',
        'archived'
    ];

    public const AVAILABILITY_STATES = [
        'available',
        'under_offer',
        'sold',
        'leased',
        'withdrawn'
    ];

    public const VERIFICATION_STATES = [
        'verified_direct',
        'recently_reverified',
        'needs_confirmation',
        'stale_reverify_due'
    ];

    public const LEAD_STAGES = [
        'new_inquiry',
        'qualified',
        'shortlist_shared',
        'site_visit_scheduled',
        'offer_negotiation',
        'documentation',
        'closed_won',
        'closed_lost'
    ];

    public const CONTACT_TYPES = [
        'buyer',
        'seller_owner',
        'channel_broker',
        'family_office',
        'tenant',
        'developer'
    ];

    // Canonical public fields emitted to public_inventory.json / .js
    public const ALLOWED_PUBLIC_FIELDS = [
        'property_id',
        'status',
        'project_id',
        'project_name',
        'locality',
        'sector',
        'city',
        'micro_location',
        'corridor',
        'property_type',
        'category',
        'transaction_type',
        'listing_title',
        'configuration',
        'bedrooms',
        'bathrooms',
        'area_value',
        'area_unit',
        'area_sqft_norm',
        'facing',
        'road_width',
        'floor_label',
        'price_value',
        'price_unit',
        'price_text',
        'price_inr_norm',
        'rent_value',
        'rent_unit',
        'rent_inr_monthly_norm',
        'furnishing',
        'possession_status',
        'key_features',
        'public_description',
        'public_features',
        'image_file',
        'image_label',
        'verification_status',
        'last_verified',
        'things_to_confirm',
        'slug',
        'url'
    ];

    public const NUMERIC_PUBLIC_FIELDS = [
        'area_value',
        'area_sqft_norm',
        'price_value',
        'price_inr_norm',
        'rent_value',
        'rent_inr_monthly_norm'
    ];

    // Server & Auth configuration
    public const SESSION_COOKIE_NAME = 'aum_session';
    public const SESSION_TTL_HOURS = 72;
    public const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB (for spreadsheets)

    /**
     * Load key=value pairs from backend_php/.env if present (without overriding real env vars)
     */
    private static bool $envLoaded = false;

    public static function loadEnv(): void
    {
        if (self::$envLoaded) {
            return;
        }
        self::$envLoaded = true;
        $envFile = dirname(__DIR__) . '/.env';
        if (!is_file($envFile) || !is_readable($envFile)) {
            return;
        }
        $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            return;
        }
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $trimmed, 2);
            $key = trim($k);
            $val = trim($v);
            if (strlen($val) >= 2 && (($val[0] === '"' && $val[strlen($val) - 1] === '"') || ($val[0] === "'" && $val[strlen($val) - 1] === "'"))) {
                $val = substr($val, 1, -1);
            }
            if ($key !== '' && getenv($key) === false && !isset($_ENV[$key])) {
                putenv("{$key}={$val}");
                $_ENV[$key] = $val;
            }
        }
    }

    public static function env(string $key, ?string $default = null): ?string
    {
        self::loadEnv();
        if (isset($_ENV[$key]) && $_ENV[$key] !== false) {
            return (string)$_ENV[$key];
        }
        $val = getenv($key);
        return $val !== false ? (string)$val : $default;
    }

    /**
     * Resolve absolute paths (supports both Hostinger deployment layout and local repo layout)
     */
    public static function getPaths(): array
    {
        self::loadEnv();
        $rootDir = realpath(__DIR__ . '/../..') ?: dirname(__DIR__, 2);
        $backendPhpDir = realpath(__DIR__ . '/..') ?: dirname(__DIR__);

        $defaultReleases = is_dir($rootDir . '/private_master_store')
            ? ($rootDir . '/private_master_store/releases')
            : ($backendPhpDir . '/releases');

        $defaultDataDir = is_dir($rootDir . '/public_html/data')
            ? ($rootDir . '/public_html/data')
            : ($rootDir . '/AUM_ESTATES_Website_For_Hostinger/data');

        $defaultCrmUiDir = is_dir($rootDir . '/public_html/crm')
            ? ($rootDir . '/public_html/crm')
            : ($rootDir . '/backend/crm-ui');

        $releasesDir = self::env('AUM_RELEASES_DIR', $defaultReleases);
        $dbDir = self::env('AUM_DB_DIR', $rootDir . '/private_master_store/db');
        $sqliteFile = self::env('AUM_DB_PATH', $dbDir . '/aum_master_crm.sqlite');
        $hostingerDataDir = self::env('AUM_HOSTINGER_DATA_DIR', $defaultDataDir);
        $crmUiDir = self::env('AUM_CRM_UI_DIR', $defaultCrmUiDir);

        return [
            'root' => $rootDir,
            'backend_php' => $backendPhpDir,
            'releases_dir' => $releasesDir,
            'db_dir' => $dbDir,
            'sqlite_file' => $sqliteFile,
            'hostinger_data_dir' => $hostingerDataDir,
            'crm_ui_dir' => $crmUiDir,
            'log_file' => self::env('AUM_LOG_FILE', $backendPhpDir . '/logs/app.log')
        ];
    }

    /**
     * Resolve database credentials
     */
    public static function getDatabaseConfig(): array
    {
        self::loadEnv();
        return [
            'driver' => self::env('AUM_DB_DRIVER', 'mysql'), // 'mysql' for MariaDB/MySQL, 'sqlite' for local fallback
            'host' => self::env('AUM_DB_HOST', '127.0.0.1'),
            'port' => (int)(self::env('AUM_DB_PORT', '3306')),
            'database' => self::env('AUM_DB_NAME', 'aum_crm'),
            'username' => self::env('AUM_DB_USER', 'root'),
            'password' => self::env('AUM_DB_PASS', ''),
            'charset' => 'utf8mb4',
            'sqlite_path' => self::env('AUM_DB_PATH', self::getPaths()['sqlite_file'])
        ];
    }

    public static function getPublicOrigin(): string
    {
        self::loadEnv();
        if ($env = self::env('AUM_PUBLIC_ORIGIN')) {
            return rtrim($env, '/');
        }
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
                 (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
                 ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'aumestates.com';
        return "{$proto}://{$host}";
    }

    public static function isSecureCookie(): bool
    {
        self::loadEnv();
        $configured = self::env('AUM_COOKIE_SECURE');
        if ($configured !== null && $configured !== '') {
            return filter_var($configured, FILTER_VALIDATE_BOOLEAN);
        }
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
               (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    }
}
