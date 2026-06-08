/**
 * Antigravity Status Bar Monitor — Formatting Utilities
 */

import { QuotaLevel, StatusBarConfig } from '../data/types';

/**
 * Format milliseconds into a human-readable countdown string.
 * e.g., 8100000 → "2h 15m"
 */
export function formatTimeUntilReset(ms: number): string {
    if (ms <= 0) {
        return 'now';
    }

    const totalMinutes = Math.floor(ms / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days} days`);
    }
    if (hours > 0) {
        parts.push(`${hours} hours`);
    }
    if (days === 0 && minutes > 0) {
        parts.push(`${minutes} minutes`);
    }

    return parts.length > 0 ? parts.join(', ') : 'now';
}

/**
 * Format a Date into a local time string.
 * e.g., Date → "17:30"
 */
export function formatResetTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Get the status codicon icon based on percentage and thresholds.
 * Uses VS Code codicon identifiers for a clean, native look.
 */
export function getStatusIcon(percentage: number, config: StatusBarConfig): string {
    return getStatusEmoji(percentage, config);
}

/**
 * Get a colored emoji indicator for MarkdownString tooltips
 * (codicons aren't supported in MarkdownString).
 */
export function getStatusEmoji(percentage: number, config: StatusBarConfig): string {
    if (percentage <= 0) {
        return '🔴';
    }
    if (percentage <= config.criticalThreshold) {
        return '🔴';
    }
    if (percentage <= config.warningThreshold) {
        return '🟡';
    }
    return '🟢';
}

/**
 * Get the QuotaLevel enum from percentage.
 */
export function getQuotaLevel(percentage: number, config: StatusBarConfig): QuotaLevel {
    if (percentage <= 0) {
        return QuotaLevel.Depleted;
    }
    if (percentage <= config.criticalThreshold) {
        return QuotaLevel.Critical;
    }
    if (percentage <= config.warningThreshold) {
        return QuotaLevel.Warning;
    }
    return QuotaLevel.Normal;
}

export function generateProgressBar(percentage: number, length: number = 20): string {
    const clamped = Math.max(0, Math.min(100, percentage));
    const fillAmount = Math.round((clamped / 100) * length);
    const filled = '█'.repeat(fillAmount);
    const empty = '░'.repeat(length - fillAmount);
    return filled + empty;
}

/**
 * Format a number with locale-aware separators.
 * e.g., 1250 → "1,250"
 */
export function formatCredits(value: number): string {
    if (!Number.isFinite(value)) {
        return '--';
    }
    return Math.round(value).toLocaleString();
}

/**
 * Format a percentage with 1 decimal place.
 * e.g., 80.456 → "80.5%"
 */
export function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
}

/**
 * Get the current time formatted as HH:MM.
 */
export function getCurrentTimeFormatted(): string {
    const now = new Date();
    return formatResetTime(now);
}

/**
 * Get capability badges for a model.
 */
export function getCapabilityBadges(capabilities: { text: boolean; image: boolean; video: boolean; thinking: boolean; code: boolean }): string {
    const badges: string[] = [];
    if (capabilities.text) { badges.push('📝 Text'); }
    if (capabilities.code) { badges.push('💻 Code'); }
    if (capabilities.image) { badges.push('🖼️ Image'); }
    if (capabilities.video) { badges.push('🎬 Video'); }
    if (capabilities.thinking) { badges.push('🧠 Thinking'); }
    return badges.join(' · ');
}

/**
 * Format a relative time string (e.g., "12 seconds ago")
 */
export function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) {
        return `${Math.max(0, seconds)} seconds ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}
