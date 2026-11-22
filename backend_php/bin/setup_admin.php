<?php
declare(strict_types=1);

/**
 * AUM Estates — CLI Admin Account Provisioner
 * Usage: php backend_php/bin/setup_admin.php [--email ajay@aumestates.com] [--password secret] [--generate]
 */

namespace AumEstates\Bin;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../db/connection.php';
require_once __DIR__ . '/../auth/auth.php';

use AumEstates\Db\Connection;
use AumEstates\Auth\Auth;

$options = getopt('', ['email::', 'password::', 'generate', 'name::', 'role::']);

$email = $options['email'] ?? 'ajay@aumestates.com';
$fullName = $options['name'] ?? 'Ajay Mukhija';
$role = $options['role'] ?? 'principal';
$validRoles = ['principal', 'advisor', 'analyst'];
if (!in_array($role, $validRoles, true)) {
    fwrite(STDERR, "Unknown role '{$role}'. Permitted: " . implode(', ', $validRoles) . "\n");
    exit(1);
}

$password = $options['password'] ?? null;
if (isset($options['generate']) || !$password) {
    // Generate secure random password
    $password = 'AumAdvisory@' . bin2hex(random_bytes(4)) . '!';
}

$hash = Auth::hashPassword($password);
$pdo = Connection::getPdo();

$stmt = $pdo->prepare('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)');
$stmt->execute([$email]);
$user = $stmt->fetch();

$nowIso = gmdate('Y-m-d\TH:i:s.v\Z');

if ($user) {
    // password_salt is written as '' rather than NULL: the legacy SQLite schema
    // declares the column NOT NULL, and NULL aborts provisioning there. Modern
    // password_hash digests carry their own salt, so the column is unused.
    $up = $pdo->prepare('
        UPDATE users
        SET full_name = ?,
            role = ?,
            password_hash = ?,
            password_salt = ?,
            is_active = 1
        WHERE user_id = ?
    ');
    $up->execute([$fullName, $role, $hash, '', $user['user_id']]);
    echo "Successfully updated account for: {$email} (user_id: {$user['user_id']})\n";
} else {
    $ins = $pdo->prepare('
        INSERT INTO users (email, full_name, role, password_hash, password_salt, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
    ');
    $ins->execute([$email, $fullName, $role, $hash, '', $nowIso]);
    $newId = $pdo->lastInsertId();
    echo "Successfully provisioned fresh account for: {$email} (user_id: {$newId})\n";
}

echo "Role: {$role}\n";
echo "Password: {$password}\n";
