/**
 * Antigravity Status Bar Monitor — Real Quota Data Provider
 *
 * Connects to the local Antigravity language server process via HTTPS
 * and fetches actual model quota data through the GetUserStatus API.
 *
 * Falls back to a "not connected" state when the process is unavailable.
 */

import * as https from 'https';
import { ModelQuota, ModelFamily, QuotaDataProvider, ModelCapabilities } from './types';
import { formatTimeUntilReset, formatResetTime } from '../utils/formatting';
import { detectAntigravityProcess, AntigravityConnection } from './processDetector';

// ── API types (subset of Cockpit's shared/types.ts) ──

interface QuotaInfo {
    remainingFraction?: number;
    resetTime: string;
}

interface ModelOrAlias {
    model: string;
}

interface ClientModelConfig {
    label: string;
    modelOrAlias?: ModelOrAlias;
    quotaInfo?: QuotaInfo;
    supportsImages?: boolean;
    isRecommended?: boolean;
    tagTitle?: string;
    supportedMimeTypes?: Record<string, boolean>;
}

interface ModelSortGroup {
    modelLabels: string[];
}

interface ClientModelSort {
    name: string;
    groups: ModelSortGroup[];
}

interface PlanInfo {
    monthlyPromptCredits?: number;
    monthlyFlowCredits?: number;
    [key: string]: unknown;
}

interface PlanStatus {
    planInfo?: PlanInfo;
    availablePromptCredits?: number;
    availableFlowCredits?: number;
}

interface UserStatus {
    name?: string;
    email?: string;
    planStatus?: PlanStatus;
    cascadeModelConfigData?: {
        clientModelConfigs: ClientModelConfig[];
        clientModelSorts?: ClientModelSort[];
    };
}

interface ServerUserStatusResponse {
    userStatus: UserStatus;
    message?: string;
}

// ── Provider ──────────────────────────────────────────

const GET_USER_STATUS = '/exa.language_server_pb.LanguageServerService/GetUserStatus';
const HTTPS_TIMEOUT_MS = 10_000;

/**
 * Resolves the model family based on the model label.
 */
function resolveFamily(label: string, modelId: string): { family: ModelFamily; familyLabel: string } {
    const lower = (label + ' ' + modelId).toLowerCase();
    if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus')) {
        return { family: 'claude', familyLabel: 'Claude' };
    }
    if (lower.includes('gemini')) {
        return { family: 'gemini', familyLabel: 'Gemini' };
    }
    if (lower.includes('gpt') || lower.includes('openai')) {
        return { family: 'gpt', familyLabel: 'GPT / OpenAI' };
    }
    return { family: 'other', familyLabel: 'Other' };
}

/**
 * Build a short label from the full model label.
 */
function buildShortLabel(label: string): string {
    // Abbreviate common patterns
    return label
        .replace(/\s*\(.*?\)\s*/g, '')   // Remove parenthetical notes
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 3)
        .join(' ');
}

/**
 * Remap server labels to user-preferred display names.
 */
function remapLabel(label: string): string {
    const lower = label.toLowerCase();
    
    // Gemini
    if (lower.includes('gemini')) {
        if (lower.includes('high')) return 'Gemini 3.1 Pro High';
        if (lower.includes('low') || lower.includes('pro')) return 'Gemini 3.1 Pro Low';
        if (lower.includes('flash')) return 'Gemini 3 Flash';
        return 'Gemini 3.1 Pro High';
    }
    
    // Claude
    if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('opus')) {
        if (lower.includes('sonnet')) return 'Cloud Sonnet 4.6';
        if (lower.includes('opus')) return 'Thinking Cloud Opus 4.6';
        return 'Cloud Sonnet 4.6';
    }
    
    // GPT
    if (lower.includes('gpt') || lower.includes('o3') || lower.includes('o4')) {
        return 'Thinking GPT OSS 120 Billion Medium';
    }
    
    return label;
}

/**
 * Infer capabilities from model metadata.
 */
function inferCapabilities(config: ClientModelConfig): ModelCapabilities {
    const mimeTypes = config.supportedMimeTypes ?? {};
    const hasImage = config.supportsImages === true || Object.keys(mimeTypes).some(k => k.startsWith('image/'));
    const hasVideo = Object.keys(mimeTypes).some(k => k.startsWith('video/'));
    const label = config.label.toLowerCase();
    const hasThinking = label.includes('thinking');
    return {
        text: true,
        image: hasImage,
        video: hasVideo,
        thinking: hasThinking,
        code: true,
    };
}

/**
 * Real data provider that connects to the local Antigravity language server.
 */
export class RealQuotaProvider implements QuotaDataProvider {
    private connection: AntigravityConnection | null = null;
    private lastCredits: number = 0;
    private logFn: (msg: string) => void;

    constructor(log?: (msg: string) => void) {
        this.logFn = log ?? (() => {});
    }

    /**
     * Whether the provider is currently connected to the Antigravity process.
     */
    get isConnected(): boolean {
        return this.connection !== null;
    }

    /**
     * Attempt to (re)connect to the Antigravity language server process.
     */
    async connect(): Promise<boolean> {
        this.connection = await detectAntigravityProcess(this.logFn);
        return this.connection !== null;
    }

    /**
     * Disconnect (reset state).
     */
    disconnect(): void {
        this.connection = null;
    }

    /**
     * Fetch all model quotas from the running Antigravity process.
     */
    async fetchQuota(): Promise<ModelQuota[]> {
        if (!this.connection) {
            const connected = await this.connect();
            if (!connected) {
                return [];
            }
        }

        try {
            const response = await this.transmit<ServerUserStatusResponse>(
                this.connection!.port,
                this.connection!.csrfToken,
                GET_USER_STATUS,
                {
                    metadata: {
                        ideName: 'antigravity',
                        extensionName: 'antigravity',
                        locale: 'en',
                    },
                },
            );

            return this.parseResponse(response);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logFn(`[RealQuotaProvider] Fetch failed: ${msg}`);
            // Connection might be stale; reset
            this.connection = null;
            return [];
        }
    }

    /**
     * Get available credits from the most recent response.
     */
    async getCredits(): Promise<number> {
        return this.lastCredits;
    }

    // ── Internal helpers ──────────────────────────────

    /**
     * Parse the ServerUserStatusResponse into ModelQuota[].
     */
    private parseResponse(data: ServerUserStatusResponse): ModelQuota[] {
        if (!data?.userStatus) {
            if (data?.message) {
                this.logFn(`[RealQuotaProvider] Server error: ${data.message}`);
            }
            return [];
        }

        const status = data.userStatus;

        // Extract credits
        const plan = status.planStatus?.planInfo;
        const available = status.planStatus?.availablePromptCredits;
        if (available !== undefined && Number.isFinite(available)) {
            this.lastCredits = Math.max(0, Number(available));
        }

        // Parse model configs
        const configs = status.cascadeModelConfigData?.clientModelConfigs ?? [];
        const modelSorts = status.cascadeModelConfigData?.clientModelSorts ?? [];

        // Build sort order from the server's recommended ordering
        const sortOrderMap = new Map<string, number>();
        if (modelSorts.length > 0) {
            let index = 0;
            for (const group of modelSorts[0].groups) {
                for (const label of group.modelLabels) {
                    sortOrderMap.set(label, index++);
                }
            }
        }

        const now = Date.now();

        const models: ModelQuota[] = configs
            .filter((m): m is ClientModelConfig & { quotaInfo: NonNullable<ClientModelConfig['quotaInfo']> } =>
                !!m.quotaInfo,
            )
            .map((m) => {
                let resetTime = new Date(m.quotaInfo.resetTime);
                if (Number.isNaN(resetTime.getTime())) {
                    resetTime = new Date(now + 24 * 60 * 60 * 1000);
                }
                const delta = Math.max(0, resetTime.getTime() - now);

                const fraction = m.quotaInfo.remainingFraction;
                const pct = fraction !== undefined ? fraction * 100 : 0;

                const modelId = m.modelOrAlias?.model || 'unknown';
                const { family, familyLabel } = resolveFamily(m.label, modelId);

                const remappedLabel = remapLabel(m.label);

                return {
                    id: modelId,
                    label: remappedLabel,
                    shortLabel: buildShortLabel(remappedLabel),
                    family,
                    familyLabel,
                    remainingPercentage: Math.round(pct * 100) / 100,
                    isExhausted: fraction === 0,
                    resetTime,
                    timeUntilReset: delta,
                    timeUntilResetFormatted: formatTimeUntilReset(delta),
                    resetTimeDisplay: formatResetTime(resetTime),
                    capabilities: inferCapabilities(m),
                    isPinned: false, // managed by StatusBarManager
                    tag: m.tagTitle,
                    isPremium: false,
                    supportsImages: m.supportsImages,
                    isRecommended: m.isRecommended,
                };
            });

        // Sort using server-provided order, then alphabetical fallback
        models.sort((a, b) => {
            const iA = sortOrderMap.get(a.label);
            const iB = sortOrderMap.get(b.label);
            if (iA !== undefined && iB !== undefined) { return iA - iB; }
            if (iA !== undefined) { return -1; }
            if (iB !== undefined) { return 1; }
            return a.label.localeCompare(b.label);
        });

        this.logFn(`[RealQuotaProvider] Parsed ${models.length} models`);
        return models;
    }

    /**
     * Send an HTTPS POST to the language server.
     */
    private transmit<T>(port: number, csrfToken: string, endpoint: string, payload: object): Promise<T> {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);

            const opts: https.RequestOptions = {
                hostname: '127.0.0.1',
                port,
                path: endpoint,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'Connect-Protocol-Version': '1',
                    'X-Codeium-Csrf-Token': csrfToken,
                },
                rejectUnauthorized: false,
                timeout: HTTPS_TIMEOUT_MS,
                agent: false,
            };

            const req = https.request(opts, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => (responseBody += chunk));
                res.on('end', () => {
                    if (!responseBody?.trim()) {
                        reject(new Error('Empty response from server'));
                        return;
                    }
                    try {
                        resolve(JSON.parse(responseBody) as T);
                    } catch {
                        reject(new Error('Failed to parse server response'));
                    }
                });
            });

            req.on('error', (e) => reject(new Error(`Connection failed: ${e.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            req.write(body);
            req.end();
        });
    }
}
