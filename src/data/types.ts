/**
 * Antigravity Status Bar Monitor — Type Definitions
 */

/** Quota health level */
export enum QuotaLevel {
    Normal = 'normal',
    Warning = 'warning',
    Critical = 'critical',
    Depleted = 'depleted',
}

/** Model family for grouping */
export type ModelFamily = 'claude' | 'gemini' | 'gpt' | 'other';

/** Capabilities a model may support */
export interface ModelCapabilities {
    text: boolean;
    image: boolean;
    video: boolean;
    thinking: boolean;
    code: boolean;
}

/** Single model's quota information */
export interface ModelQuota {
    /** Unique model identifier */
    id: string;
    /** Human-readable label */
    label: string;
    /** Short display name for status bar */
    shortLabel: string;
    /** Model family grouping */
    family: ModelFamily;
    /** Family display name */
    familyLabel: string;
    /** Remaining percentage (0-100) */
    remainingPercentage: number;
    /** Whether quota is fully exhausted */
    isExhausted: boolean;
    /** Reset time as Date */
    resetTime: Date;
    /** Milliseconds until reset */
    timeUntilReset: number;
    /** Formatted time until reset (e.g., "2h 15m") */
    timeUntilResetFormatted: string;
    /** Formatted reset time (e.g., "17:30") */
    resetTimeDisplay: string;
    /** Model capabilities */
    capabilities: ModelCapabilities;
    /** Whether this model is pinned to the status bar */
    isPinned: boolean;
    /** Optional tag (e.g., "New", "Popular") */
    tag?: string;
    /** Whether this model is only for premium users */
    isPremium: boolean;
    /** Whether this model supports image input */
    supportsImages?: boolean;
    /** Whether this model is recommended by the server */
    isRecommended?: boolean;
}

/** User configuration for the extension */
export interface StatusBarConfig {
    /** Refresh interval in seconds */
    refreshInterval: number;
    /** Display format: 'standard' | 'compact' | 'minimal' */
    displayFormat: 'standard' | 'compact' | 'minimal';
    /** Warning threshold percentage */
    warningThreshold: number;
    /** Critical threshold percentage */
    criticalThreshold: number;
    /** IDs of models pinned to the status bar */
    pinnedModelIds: string[];
    /** Whether the user has a premium membership */
    isPremiumUser: boolean;
    /** View mode for the popup: 'flat' for individual models, 'grouped' for quota families */
    popupViewMode: 'flat' | 'grouped';
}

/** Data provider interface */
export interface QuotaDataProvider {
    /** Fetch all model quotas */
    fetchQuota(): Promise<ModelQuota[]>;
    /** Get available credits */
    getCredits(): Promise<number>;
}
