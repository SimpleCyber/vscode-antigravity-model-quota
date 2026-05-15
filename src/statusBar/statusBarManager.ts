/**
 * Antigravity Status Bar Monitor — Status Bar Manager
 * 
 * Creates and manages status bar items that display model quota information.
 * Shows pinned models in the status bar and provides rich hover tooltips.
 */

import * as vscode from 'vscode';
import { ModelQuota, StatusBarConfig } from '../data/types';
import { getStatusIcon } from '../utils/formatting';
import { buildTooltip } from './tooltipBuilder';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private lastModels: ModelQuota[] = [];
    private lastCredits: number = 0;
    private config: StatusBarConfig;
    private temporaryMessageTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(context: vscode.ExtensionContext, config: StatusBarConfig) {
        this.config = config;

        // Create the main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100,
        );
        this.statusBarItem.command = 'antigravity.showDetails';
        this.statusBarItem.text = '$(rocket) Loading...';
        this.statusBarItem.name = 'Antigravity Model Monitor';
        this.statusBarItem.show();

        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Update the status bar with new quota data.
     */
    public update(models: ModelQuota[], credits: number): void {
        // Filter out premium models if user is not premium
        const filteredModels = models.filter(m => !m.isPremium || this.config.isPremiumUser);

        this.lastModels = filteredModels;
        this.lastCredits = credits;

        // Apply pinned state from config
        for (const model of filteredModels) {
            model.isPinned = this.config.pinnedModelIds.includes(model.id);
        }

        // Update status bar text
        this.updateStatusBarText(filteredModels);

        // Update hover tooltip
        this.statusBarItem.tooltip = buildTooltip(filteredModels, this.config);
    }

    /**
     * Update the config and refresh display.
     */
    public updateConfig(config: StatusBarConfig): void {
        this.config = config;
        if (this.lastModels.length > 0) {
            this.update(this.lastModels, this.lastCredits);
        }
    }

    /**
     * Get the list of pinned model IDs.
     */
    public getPinnedModelIds(): string[] {
        return [...this.config.pinnedModelIds];
    }

    /**
     * Set pinned model IDs and refresh.
     */
    public setPinnedModels(ids: string[]): void {
        this.config.pinnedModelIds = ids;
        if (this.lastModels.length > 0) {
            this.update(this.lastModels, this.lastCredits);
        }
    }

    /**
     * Set the popup view mode (flat vs grouped).
     */
    public setPopupViewMode(mode: 'flat' | 'grouped'): void {
        this.config.popupViewMode = mode;
    }

    /**
     * Get the last known models.
     */
    public getLastModels(): ModelQuota[] {
        return this.lastModels;
    }

    /**
     * Get the current config.
     */
    public getConfig(): StatusBarConfig {
        return this.config;
    }

    /**
     * Show a loading state.
     */
    public setLoading(): void {
        this.statusBarItem.text = '$(sync~spin) Syncing...';
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * Show a temporary confirmation message.
     */
    public showTemporaryMessage(message: string, durationMs: number = 3000): void {
        if (this.temporaryMessageTimer) {
            clearTimeout(this.temporaryMessageTimer);
        }

        const originalText = this.statusBarItem.text;
        const originalColor = this.statusBarItem.backgroundColor;

        this.statusBarItem.text = message;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');

        this.temporaryMessageTimer = setTimeout(() => {
            this.statusBarItem.text = originalText;
            this.statusBarItem.backgroundColor = originalColor;
            this.temporaryMessageTimer = undefined;
        }, durationMs);
    }

    /**
     * Show a not-connected state.
     */
    public setNotConnected(): void {
        this.statusBarItem.text = '$(debug-disconnect) Not Connected';
        this.statusBarItem.tooltip = 'Antigravity language server is not running or not found. Make sure Windsurf/Antigravity is active.';
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * Show an error state.
     */
    public setError(message: string): void {
        this.statusBarItem.text = '$(error) Quota Error';
        this.statusBarItem.tooltip = message;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    /**
     * Build the status bar text based on pinned models and display format.
     */
    private updateStatusBarText(models: ModelQuota[]): void {
        let displayModels = models.filter(m => this.config.pinnedModelIds.includes(m.id));
        
        if (displayModels.length === 0) {
            // Default models if nothing is pinned yet
            const defaultLabels = ['Gemini 3.1 Pro High', 'Gemini 3 Flash', 'Thinking Cloud Opus 4.6'];
            displayModels = models.filter(m => defaultLabels.includes(m.label));
        }

        if (displayModels.length === 0) {
            displayModels = this.getLowestQuotaModels(models, 3);
        }

        if (displayModels.length === 0) {
            this.statusBarItem.text = '$(rocket) No models';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }

        const parts: string[] = [];

        for (const model of displayModels) {
            const text = this.formatModelText(model);
            if (text) {
                parts.push(text);
            }
        }

        this.statusBarItem.text = parts.join('  ');
        this.statusBarItem.backgroundColor = undefined;
    }

    /**
     * Format a single model's text for the status bar.
     */
    private formatModelText(model: ModelQuota): string {
        const icon = getStatusIcon(model.remainingPercentage, this.config);
        const pct = `${Math.floor(model.remainingPercentage)}%`;

        switch (this.config.displayFormat) {
            case 'minimal':
                return icon;
            case 'compact':
                return `${icon}${pct}`;
            case 'standard':
            default:
                return `${icon} ${model.shortLabel}: ${pct}`;
        }
    }

    /**
     * Get the N models with lowest remaining quota.
     */
    private getLowestQuotaModels(models: ModelQuota[], count: number): ModelQuota[] {
        return [...models]
            .sort((a, b) => a.remainingPercentage - b.remainingPercentage)
            .slice(0, count);
    }
}
