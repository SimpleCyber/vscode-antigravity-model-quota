/**
 * Antigravity Status Bar Monitor — Mock Quota Data Provider
 * 
 * Provides realistic demo data for all major AI model families.
 * Values drift slightly on each fetch to simulate real-time quota usage.
 */

import { ModelQuota, ModelFamily, QuotaDataProvider, ModelCapabilities } from './types';
import { formatTimeUntilReset, formatResetTime } from '../utils/formatting';

interface ModelSeed {
    id: string;
    label: string;
    shortLabel: string;
    family: ModelFamily;
    familyLabel: string;
    basePercentage: number;
    resetOffsetMs: number;
    capabilities: ModelCapabilities;
    tag?: string;
    isPremium: boolean;
}

const MODEL_SEEDS: ModelSeed[] = [
    {
        id: 'gemini-3.1-pro-high',
        label: 'Gemini 3.1 Pro High',
        shortLabel: 'Gem Pro↑',
        family: 'gemini',
        familyLabel: 'Gemini',
        basePercentage: 8,
        resetOffsetMs: 1 * 60 * 60 * 1000,
        capabilities: { text: true, image: true, video: true, thinking: true, code: true },
        isPremium: false,
    },
    {
        id: 'gemini-3.1-pro-low',
        label: 'Gemini 3.1 Pro Low',
        shortLabel: 'Gem Pro↓',
        family: 'gemini',
        familyLabel: 'Gemini',
        basePercentage: 55,
        resetOffsetMs: 2 * 60 * 60 * 1000,
        capabilities: { text: true, image: true, video: true, thinking: true, code: true },
        isPremium: false,
    },
    {
        id: 'gemini-3-flash',
        label: 'Gemini 3 Flash',
        shortLabel: 'Gem Flash',
        family: 'gemini',
        familyLabel: 'Gemini',
        basePercentage: 92,
        resetOffsetMs: 4 * 60 * 60 * 1000,
        capabilities: { text: true, image: true, video: false, thinking: false, code: true },
        isPremium: false,
    },
    {
        id: 'cloud-sonnet-4.6',
        label: 'Cloud Sonnet 4.6',
        shortLabel: 'Sonnet',
        family: 'claude',
        familyLabel: 'Claude',
        basePercentage: 78,
        resetOffsetMs: 2 * 60 * 60 * 1000,
        capabilities: { text: true, image: true, video: false, thinking: false, code: true },
        isPremium: false,
    },
    {
        id: 'cloud-opus-4.6',
        label: 'Cloud Opus 4.6',
        shortLabel: 'Opus',
        family: 'claude',
        familyLabel: 'Claude',
        basePercentage: 15,
        resetOffsetMs: 1 * 60 * 60 * 1000,
        capabilities: { text: true, image: true, video: false, thinking: true, code: true },
        isPremium: true,
        tag: 'Premium',
    },
    {
        id: 'thinking-gpt-oss-120b',
        label: 'Thinking GPT OSS 120B Medium',
        shortLabel: 'GPT OSS',
        family: 'gpt',
        familyLabel: 'GPT / OpenAI',
        basePercentage: 42,
        resetOffsetMs: 3 * 60 * 60 * 1000,
        capabilities: { text: true, image: false, video: false, thinking: true, code: true },
        isPremium: true,
        tag: 'Premium',
    }
];

/**
 * Mock data provider that returns realistic quota data.
 * Values drift slightly on each call to simulate real-time changes.
 */
export class MockQuotaProvider implements QuotaDataProvider {
    private driftAmplitude = 3; // max random drift per fetch
    private lastValues: Map<string, number> = new Map();
    private credits = 1250;
    
    get isConnected(): boolean { return true; }
    async connect(): Promise<boolean> { return true; }
    disconnect(): void {}

    async fetchQuota(): Promise<ModelQuota[]> {
        const now = Date.now();

        return MODEL_SEEDS.map((seed) => {
            // Get or initialize the last known percentage
            let currentPct = this.lastValues.get(seed.id) ?? seed.basePercentage;

            // Apply small random drift (simulates usage)
            const drift = (Math.random() - 0.6) * this.driftAmplitude; // slightly biased downward
            currentPct = Math.max(0, Math.min(100, currentPct + drift));
            this.lastValues.set(seed.id, currentPct);

            const resetTime = new Date(now + seed.resetOffsetMs);
            const isExhausted = currentPct <= 0;

            return {
                id: seed.id,
                label: seed.label,
                shortLabel: seed.shortLabel,
                family: seed.family,
                familyLabel: seed.familyLabel,
                remainingPercentage: Math.round(currentPct * 100) / 100,
                isExhausted,
                resetTime,
                timeUntilReset: seed.resetOffsetMs,
                timeUntilResetFormatted: formatTimeUntilReset(seed.resetOffsetMs),
                resetTimeDisplay: formatResetTime(resetTime),
                capabilities: seed.capabilities,
                isPinned: false, // managed by StatusBarManager
                tag: seed.tag,
                isPremium: seed.isPremium,
            };
        });
    }

    async getCredits(): Promise<number> {
        // Simulate slight credit changes
        this.credits = Math.max(0, this.credits + (Math.random() - 0.5) * 10);
        return Math.round(this.credits);
    }
}
