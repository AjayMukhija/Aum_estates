<?php
declare(strict_types=1);

/**
 * AUM Estates — CLI Admin Account Provisioner
 *
 * Usage:
 *   php backend_php/bin/setup_admin.php --generate
 *   AUM_ADMIN_PASSWORD='…' php backend_php/bin/setup_admin.php
 *   php backend_php/bin/setup_admin.php --help
 *
 * This is the script the principal runs on the live host to create or rotate
 * their own sign-in. It previously differed from scripts/setup_admin.js in
 * three ways that mattered on a shared host:
 *
 *   1. getopt() ignores unrecognised flags, and the script fell back to
 *      generating a password whenever none was supplied. So `--help`, or any
 *      typo, silently rotated the principal credential. Arguments are now
 *      validated against the known set and a password source must be chosen
 *      explicitly.
 *   2. Rotating the password left every existing session alive, so a stolen
 *      session cookie survived the rotation meant to kill it. Sessions for the
 *      account are now deleted in the same transaction, and the rotation is
 *      written to the audit log.
 *   3. The password was echoed to stdout, where it lands in shell history and
 *      in the hosting panel's terminal scrollback. A generated password is now
 *      written to an owner-only file instead and never printed.
 */

namespace AumEstates\Bin;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../auth/auth.php';

use AumEstates\Config;
use AumEstates\Db\Connection;
use AumEstates\Auth\Auth;

const USAGE = <<<TXT
AUM Estates — principal/advisor account provisioner

  php backend_php/bin/setup_admin.php --generate [--email …] [--name …] [--role …]
  AUM_ADMIN_PASSWORD='at least 16 characters' php backend_php/bin/setup_admin.php [--email …]

Options
  --generate         Create a strong random password and write it to an
                     owner-only credentials file. Nothing is printed.
  --email ADDRESS    Account to create or update (default ajay@aumestates.com).
  --name NAME        Full name on the account (default Ajay Mukhija).
  --role ROLE        principal | advisor | analyst (default principal).
  --help             Show this text and exit without touching the database.

Supply exactly one password source: --generate, or AUM_ADMIN_PASSWORD in the
environment. Running with neither is refused rather than silently rotating the
credential. Re-running on an existing account replaces the password and signs
every open session out.
TXT;

$longOptions = ['email:', 'password:', 'generate', 'name:', 'role:', 'help'];
$options = getopt('', $longOptions, $restIndex);

// getopt() stops at the first thing it does not understand and silently drops
// the rest, so anything left over is a typo or an unsupported flag. Refuse it
// instead of carrying on with defaults that rotate a live credential.
$known = ['email', 'password', 'generate', 'name', 'role', 'help'];
$unknown = [];
foreach (array_slice($argv, 1) as $token) {
    if (!str_starts_with($token, '--')) continue;
    $name = explode('=', substr($token, 2), 2)[0];
    if ($name !== '' && !in_array($name, $known, true)) $unknown[] = $token;
}
// PHP's getopt() drops a long option it does not know without a word of
// complaint, so --generte would have fallen through to the defaults.
$leftover = array_merge($unknown, array_slice($argv, $restIndex));
if ($leftover !== []) {
    fwrite(STDERR, "Unrecognised argument: {$leftover[0]}\n\n" . USAGE . "\n");
    exit(2);
}

if (isset($options['help'])) {
    echo USAGE . "\n";
    exit(0);
}

$email = trim((string)($options['email'] ?? 'ajay@aumestates.com'));
$fullName = trim((string)($options['name'] ?? 'Ajay Mukhija'));
$role = (string)($options['role'] ?? 'principal');

$validRoles = ['principal', 'advisor', 'analyst'];
if (!in_array($role, $validRoles, true)) {
    fwrite(STDERR, "Unknown role '{$role}'. Permitted: " . implode(', ', $validRoles) . "\n");
    exit(1);
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "A valid --email address is required.\n");
    exit(1);
}

// --password on the command line is visible in `ps` and in shell history to
// every other account on a shared host, so it is no longer accepted.
if (isset($options['password'])) {
    fwrite(STDERR, "--password is not accepted: the value is visible in the process list on shared hosting.\nUse --generate, or set AUM_ADMIN_PASSWORD in the environment.\n");
    exit(2);
}

$generate = isset($options['generate']);
$envPassword = (string)(getenv('AUM_ADMIN_PASSWORD') ?: '');

if ($generate && $envPassword !== '') {
    fwrite(STDERR, "Choose one password source: --generate or AUM_ADMIN_PASSWORD, not both.\n");
    exit(2);
}
if (!$generate && $envPassword === '') {
    fwrite(STDERR, "Refusing to rotate a credential by accident.\nPass --generate, or set AUM_ADMIN_PASSWORD to a new password of at least 16 characters.\nRun with --help for the full usage.\n");
    exit(2);
}

if ($generate) {
    // 30 random bytes, base64url — the same strength scripts/setup_admin.js uses.
    $password = rtrim(strtr(base64_encode(random_bytes(30)), '+/', '-_'), '=');
} else {
    $password = $envPassword;
    if (mb_strlen($password, 'UTF-8') < 16) {
        fwrite(STDERR, "AUM_ADMIN_PASSWORD must be at least 16 characters.\n");
        exit(2);
    }
    if (str_starts_with($password, 'AumAdvisory@')) {
        fwrite(STDERR, "That is the shape of a previously generated password. Choose a new one.\n");
        exit(2);
    }
}

$hash = Auth::hashPassword($password);
$pdo = Connection::getPdo();
$nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

$result = Connection::withTransaction($pdo, function (\PDO $db) use ($email, $fullName, $role, $hash, $nowIso) {
    $stmt = $db->prepare('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        // password_salt is written as '' rather than NULL: the legacy SQLite
        // schema declares the column NOT NULL, and NULL aborts provisioning
        // there. Modern password_hash digests carry their own salt.
        $up = $db->prepare('
            UPDATE users
            SET full_name = ?, role = ?, password_hash = ?, password_salt = ?, is_active = 1
            WHERE user_id = ?
        ');
        $up->execute([$fullName, $role, $hash, '', $user['user_id']]);
        $userId = (int)$user['user_id'];
        $created = false;
    } else {
        $ins = $db->prepare('
            INSERT INTO users (email, full_name, role, password_hash, password_salt, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        ');
        $ins->execute([$email, $fullName, $role, $hash, '', $nowIso]);
        $userId = (int)$db->lastInsertId();
        $created = true;
    }

    // A rotation that leaves the old sessions valid does not revoke anything.
    $revoke = $db->prepare('DELETE FROM sessions WHERE user_id = ?');
    $revoke->execute([$userId]);
    $revoked = $revoke->rowCount();

    Connection::recordAuditLog($db, [
        'actorLabel' => 'cli_admin_setup',
        'entityType' => 'user',
        'entityId' => (string)$userId,
        'action' => $created ? 'provision_account' : 'rotate_credential',
        'summary' => ($created ? 'Provisioned' : 'Rotated')
            . " {$role} credential for {$email}; {$revoked} session(s) revoked"
    ]);

    return ['userId' => $userId, 'created' => $created, 'revoked' => $revoked];
});

$verb = $result['created'] ? 'Provisioned' : 'Updated';
echo "{$verb} account for {$email} (user_id: {$result['userId']}, role: {$role}).\n";
echo "Revoked {$result['revoked']} existing session(s).\n";

if ($generate) {
    $paths = Config::getPaths();
    $dir = is_dir($paths['db_dir']) ? $paths['db_dir'] : $paths['backend_php'];
    $file = rtrim($dir, '/') . '/admin-credentials.json';

    // Create with 0600 before anything is written, so the secret is never
    // briefly world-readable on a shared host.
    $fh = fopen($file, 'c');
    if ($fh === false) {
        fwrite(STDERR, "Account updated, but the credentials file could not be opened at {$file}.\nRe-run with --generate once the path is writable.\n");
        exit(1);
    }
    chmod($file, 0600);
    ftruncate($fh, 0);
    fwrite($fh, json_encode(['email' => $email, 'password' => $password], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    fclose($fh);

    echo "Generated password written to {$file} (owner access only). It is not printed here.\n";
} else {
    echo "Password taken from AUM_ADMIN_PASSWORD.\n";
}
