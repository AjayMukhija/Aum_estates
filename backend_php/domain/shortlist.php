<?php
declare(strict_types=1);

namespace AumEstates\Domain;

final class Shortlist
{
    public static function assertClientText(string $field, ?string $text): void
    {
        if ($text !== null) {
            if (!is_string($text) || mb_strlen($text, 'UTF-8') > 4000) {
                throw new \InvalidArgumentException("Invalid client-facing {$field}");
            }
            if (count(PrivacyGate::scanTextForLeaks($field, $text)) > 0) {
                throw new \DomainException("Confidential content blocked in {$field}");
            }
        }
    }

    public static function projectShortlistItem(array $row): array
    {
        $pub = $row['publication_state'] ?? '';
        $avail = $row['availability_state'] ?? '';

        if (!in_array($pub, ['approved_public', 'private_off_market'], true) || $avail !== 'available') {
            throw new \DomainException('Only available approved or explicitly curated off-market properties may be shared');
        }

        // Off-market sharing is an explicit advisor action, but its public representation
        // must pass the exact same schema and disclosure checks as an ordinary public property.
        $candidate = $row;
        $candidate['publication_state'] = 'approved_public';
        $check = PrivacyGate::validateAndProjectPublicRecord($candidate);
        if (!$check['ok']) {
            throw new \DomainException('Property is not safe for client sharing: ' . implode('; ', $check['errors']));
        }

        self::assertClientText('advisor_commentary', $row['advisor_commentary'] ?? null);

        $record = $check['record'];
        $record['display_price'] = Normalizer::formatPublicPriceDisplay($row);
        $record['is_off_market_curated'] = ($pub === 'private_off_market');
        $record['advisor_commentary'] = $row['advisor_commentary'] ?? null;
        $record['match_score'] = !empty($row['match_score']) ? (int)$row['match_score'] : null;

        return $record;
    }
}
