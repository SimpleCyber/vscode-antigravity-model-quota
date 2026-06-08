import * as vscode from 'vscode';
import { ModelQuota, StatusBarConfig } from '../data/types';
import {
    generateProgressBar,
    formatPercentage,
    getStatusEmoji,
    getCurrentTimeFormatted,
    formatTimeAgo
} from '../utils/formatting';

/**
 * Builds a clean, simplified Markdown tooltip for the status bar.
 * Removes emojis from group headers and simplifies layout.
 */
export function buildTooltip(models: ModelQuota[], config: StatusBarConfig, lastUpdateTime?: Date): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.supportHtml = true;

    // Header
    tooltip.appendMarkdown('### MODEL QUOTA\n\n');

    if (models.length === 0) {
        tooltip.appendMarkdown('_No models available or process not connected._\n');
        return tooltip;
    }

    // Define fixed sorting order
    const familyOrder: Record<string, number> = {
        'gemini': 1,
        'claude': 2,
        'gpt': 3,
        'other': 4
    };

    // Sort models by family first, then by remaining percentage
    const sortedModels = [...models].sort((a, b) => {
        const familyDiff = (familyOrder[a.family] || 5) - (familyOrder[b.family] || 5);
        if (familyDiff !== 0) return familyDiff;
        return b.remainingPercentage - a.remainingPercentage;
    });

    for (const model of sortedModels) {
        // Get colored emoji based on threshold
        const emoji = getStatusEmoji(model.remainingPercentage, config);
        
        // Percentage formatted to 1 decimal place
        const pct = formatPercentage(model.remainingPercentage);
        
        // Formatted line: 🟢 **Gemini 3.1 Pro**      80.5% remaining      _reset in 2 hours_
        tooltip.appendMarkdown(`${emoji} **${model.label}** &nbsp;&nbsp;&nbsp;&nbsp; _${pct} remaining_ &nbsp;&nbsp;&nbsp;&nbsp; _reset in ${model.timeUntilResetFormatted}_\n\n`);
    }

    tooltip.appendMarkdown('View your available model quota. Quota refreshes periodically based on your plan.\n\n');

    // Footer with commands
    const refreshCmd = `[$(sync) Refresh](command:antigravity.refreshQuota "Refresh Quota Data")`;
    const detailsCmd = `[$(window) Open Dashboard](command:antigravity.showDetails "View Detailed Quota")`;
    
    tooltip.appendMarkdown(`${refreshCmd} &nbsp;&nbsp;&nbsp;&nbsp; ${detailsCmd}`);

    if (lastUpdateTime) {
        tooltip.appendMarkdown(`\n\n---\n_Last Updated: ${formatTimeAgo(lastUpdateTime)}_`);
    }

    return tooltip;
}
