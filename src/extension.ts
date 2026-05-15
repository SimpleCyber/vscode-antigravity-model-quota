/**
 * Antigravity Status Bar Monitor — Extension Entry Point
 * 
 * Activates on VS Code startup, creates the status bar monitor,
 * and sets up periodic quota data refreshes using real data from the Antigravity language server.
 */

import * as vscode from 'vscode';
import { StatusBarConfig } from './data/types';
import { RealQuotaProvider } from './data/realQuotaProvider';
import { StatusBarManager } from './statusBar/statusBarManager';
import { showDetailsQuickPick } from './commands/detailsCommand';

// ── State ────────────────────────────────────────────
let statusBarManager: StatusBarManager;
let dataProvider: RealQuotaProvider;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let outputChannel: vscode.OutputChannel;
let extensionContext: vscode.ExtensionContext;

/**
 * Extension activation.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    extensionContext = context;
    outputChannel = vscode.window.createOutputChannel('Antigravity Status Bar');
    outputChannel.appendLine('🚀 Antigravity Status Bar Monitor activating...');

    // Load configuration
    const config = loadConfig(context);

    // Initialize data provider with logging
    dataProvider = new RealQuotaProvider((msg) => outputChannel.appendLine(msg));

    // Initialize status bar
    statusBarManager = new StatusBarManager(context, config);

    // ── Register Commands ────────────────────────────

    // Show Details (persistent QuickPick on click)
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity.showDetails', async () => {
            const models = statusBarManager.getLastModels();
            const currentConfig = statusBarManager.getConfig();

            if (!dataProvider.isConnected) {
                vscode.window.showWarningMessage('Not connected to Antigravity. Please ensure Windsurf/Antigravity is running.');
                // Try to reconnect
                await refreshQuota();
            }

            if (models.length === 0 && dataProvider.isConnected) {
                vscode.window.showInformationMessage('No model data available yet. Refreshing...');
                await refreshQuota();
                return;
            }

            const newPinnedIds = await showDetailsQuickPick(
                models, 
                currentConfig,
                async () => {
                    await refreshQuota();
                    statusBarManager.showTemporaryMessage('$(check) Quota Data Refreshed');
                },
                async (viewMode) => {
                    statusBarManager.setPopupViewMode(viewMode);
                    await saveViewMode(context, viewMode);
                }
            );

            if (newPinnedIds !== undefined) {
                // Save pinned models
                statusBarManager.setPinnedModels(newPinnedIds);
                await savePinnedModels(context, newPinnedIds);
                outputChannel.appendLine(`📌 Pinned models updated: ${newPinnedIds.join(', ') || '(none)'}`);

                // Refresh display (if connection still active)
                if (dataProvider.isConnected) {
                    await refreshQuota();
                }
                
                statusBarManager.showTemporaryMessage('$(check) Yes, it has been updated');
            }
        }),
    );

    // Refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravity.refreshQuota', async () => {
            statusBarManager.setLoading();
            await refreshQuota();
            statusBarManager.showTemporaryMessage('$(check) Quota Refreshed');
            outputChannel.appendLine('🔄 Manual refresh triggered');
        }),
    );

    // ── Listen for config changes ────────────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('agStatusBar')) {
                const newConfig = loadConfig(context);
                statusBarManager.updateConfig(newConfig);
                restartRefreshTimer(newConfig.refreshInterval);
                outputChannel.appendLine('⚙️ Configuration updated');
            }
        }),
    );

    // ── Initial data fetch ───────────────────────────
    statusBarManager.setLoading();
    await refreshQuota();

    // ── Start periodic refresh ───────────────────────
    startRefreshTimer(config.refreshInterval);

    outputChannel.appendLine(`✅ Antigravity Status Bar Monitor active (refresh every ${config.refreshInterval}s)`);
}

/**
 * Extension deactivation.
 */
export function deactivate(): void {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
    }
    dataProvider?.disconnect();
    outputChannel?.appendLine('Antigravity Status Bar Monitor deactivated');
    outputChannel?.dispose();
}

// ── Internal helpers ─────────────────────────────────

/**
 * Fetch quota data and update the status bar.
 */
async function refreshQuota(): Promise<void> {
    try {
        const isConnected = await dataProvider.connect();
        
        if (!isConnected) {
            statusBarManager.setNotConnected();
            outputChannel.appendLine('⚠️ Antigravity process not found. Waiting for it to start...');
            return;
        }

        const [models, credits] = await Promise.all([
            dataProvider.fetchQuota(),
            dataProvider.getCredits(),
        ]);
        
        if (models.length > 0) {
            statusBarManager.update(models, credits);
        } else {
            // Handle edge case where we're connected but got no models back
            statusBarManager.setError('No models returned from server');
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        statusBarManager.setError(message);
        outputChannel.appendLine(`❌ Refresh failed: ${message}`);
    }
}

/**
 * Load extension configuration from VS Code settings + persisted state.
 */
function loadConfig(context: vscode.ExtensionContext): StatusBarConfig {
    const vsConfig = vscode.workspace.getConfiguration('agStatusBar');

    // Load pinned models from workspace state (persisted across sessions)
    // Removed old mock defaults since we're using real IDs now
    const pinnedModelIds = context.globalState.get<string[]>('pinnedModelIds') ?? [];
    
    // Load preferred view mode
    const popupViewMode = context.globalState.get<'flat' | 'grouped'>('popupViewMode') ?? 'grouped';

    return {
        refreshInterval: vsConfig.get<number>('refreshInterval', 15), // faster default for real usage
        displayFormat: vsConfig.get<'standard' | 'compact' | 'minimal'>('displayFormat', 'standard'),
        warningThreshold: vsConfig.get<number>('warningThreshold', 60),
        criticalThreshold: vsConfig.get<number>('criticalThreshold', 40),
        pinnedModelIds,
        isPremiumUser: vsConfig.get<boolean>('isPremiumUser', true), // Assume true for now to see all models
        popupViewMode,
    };
}

/**
 * Persist pinned model IDs to workspace state.
 */
async function savePinnedModels(context: vscode.ExtensionContext, ids: string[]): Promise<void> {
    await context.globalState.update('pinnedModelIds', ids);
}

/**
 * Persist view mode choice to workspace state.
 */
async function saveViewMode(context: vscode.ExtensionContext, mode: 'flat' | 'grouped'): Promise<void> {
    await context.globalState.update('popupViewMode', mode);
}

/**
 * Start the periodic refresh timer.
 */
function startRefreshTimer(intervalSeconds: number): void {
    refreshTimer = setInterval(() => {
        refreshQuota();
    }, intervalSeconds * 1000);
}

/**
 * Restart the refresh timer with a new interval.
 */
function restartRefreshTimer(intervalSeconds: number): void {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    startRefreshTimer(intervalSeconds);
}
