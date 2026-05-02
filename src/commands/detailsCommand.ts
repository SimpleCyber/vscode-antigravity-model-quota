/**
 * Antigravity Status Bar Monitor — Details Command (Persistent QuickPick)
 * 
 * Opens a persistent QuickPick panel that shows all model quotas.
 * Users can select/deselect models to pin them to the status bar.
 * Matches the clean aesthetic of the Antigravity Cockpit UI.
 */

import * as vscode from 'vscode';
import { ModelQuota, StatusBarConfig, ModelFamily } from '../data/types';
import {
    getStatusIcon,
    generateProgressBar,
    formatPercentage
} from '../utils/formatting';

const FAMILY_ORDER: ModelFamily[] = ['claude', 'gemini', 'gpt', 'other'];

interface ModelQuickPickItem extends vscode.QuickPickItem {
    modelId: string;
    isPinned: boolean;
    family: ModelFamily;
    isSeparator?: boolean;
}

// Custom UI Buttons
const REFRESH_BUTTON: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('sync'),
    tooltip: 'Refresh Quota Data'
};

const VIEW_FLAT_BUTTON: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('list-flat'),
    tooltip: 'Switch to Flat View'
};

const VIEW_GROUPED_BUTTON: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('list-tree'),
    tooltip: 'Switch to Grouped View'
};

/**
 * Show the persistent details QuickPick.
 * Returns an object with pinned models and any configuration changes.
 */
export async function showDetailsQuickPick(
    models: ModelQuota[],
    config: StatusBarConfig,
    onRefreshRequested: () => void,
    onViewModeChanged: (mode: 'flat' | 'grouped') => void
): Promise<string[] | undefined> {
    return new Promise<string[] | undefined>((resolve) => {
        const qp = vscode.window.createQuickPick<ModelQuickPickItem>();
        qp.title = '🚀 Antigravity Model Quotas';
        qp.placeholder = 'Select models to pin to the status bar. Press Escape to close.';
        qp.canSelectMany = true;
        qp.matchOnDescription = true;
        qp.matchOnDetail = true;
        
        let viewMode = config.popupViewMode || 'grouped';
        
        // Setup initial buttons
        qp.buttons = [
            REFRESH_BUTTON,
            viewMode === 'flat' ? VIEW_GROUPED_BUTTON : VIEW_FLAT_BUTTON
        ];

        // Build items
        const updateItems = () => {
            const items = viewMode === 'flat' 
                ? buildFlatItems(models, config)
                : buildGroupedItems(models, config);
            qp.items = items;
            qp.selectedItems = items.filter(i => i.isPinned && !i.isSeparator);
        };
        
        updateItems();

        let lastSelectedIds = new Set(config.pinnedModelIds);

        qp.onDidChangeSelection((selected) => {
            lastSelectedIds = new Set(selected.map(i => i.modelId));
        });

        // Handle button clicks
        qp.onDidTriggerButton((btn) => {
            if (btn === REFRESH_BUTTON) {
                onRefreshRequested();
                // Optionally show a quick feedback
                vscode.window.showInformationMessage('Refreshing Antigravity quota data...');
            } else if (btn === VIEW_FLAT_BUTTON) {
                viewMode = 'flat';
                onViewModeChanged('flat');
                qp.buttons = [REFRESH_BUTTON, VIEW_GROUPED_BUTTON];
                updateItems();
            } else if (btn === VIEW_GROUPED_BUTTON) {
                viewMode = 'grouped';
                onViewModeChanged('grouped');
                qp.buttons = [REFRESH_BUTTON, VIEW_FLAT_BUTTON];
                updateItems();
            }
        });

        qp.onDidHide(() => {
            const result = Array.from(lastSelectedIds);
            resolve(result);
            qp.dispose();
        });

        qp.show();
    });
}

/**
 * Build a flat list of models, ordered by remaining percentage.
 */
function buildFlatItems(models: ModelQuota[], config: StatusBarConfig): ModelQuickPickItem[] {
    const items: ModelQuickPickItem[] = [];
    const sorted = [...models].sort((a, b) => a.remainingPercentage - b.remainingPercentage);

    for (const model of sorted) {
        items.push(createModelItem(model, config));
    }

    return items;
}

/**
 * Build grouped list of models by family.
 */
function buildGroupedItems(models: ModelQuota[], config: StatusBarConfig): ModelQuickPickItem[] {
    const items: ModelQuickPickItem[] = [];
    const grouped = new Map<ModelFamily, ModelQuota[]>();

    for (const model of models) {
        const group = grouped.get(model.family) ?? [];
        group.push(model);
        grouped.set(model.family, group);
    }

    for (const family of FAMILY_ORDER) {
        const familyModels = grouped.get(family);
        if (!familyModels || familyModels.length === 0) {
            continue;
        }

        const familyLabel = familyModels[0].familyLabel;

        items.push({
            label: familyLabel,
            kind: vscode.QuickPickItemKind.Separator,
            modelId: '',
            isPinned: false,
            family,
            isSeparator: true,
        });

        // Sort models within group by percentage
        familyModels.sort((a, b) => a.remainingPercentage - b.remainingPercentage);

        for (const model of familyModels) {
            items.push(createModelItem(model, config));
        }
    }

    return items;
}

/**
 * Create a clean, Cockpit-style item for a single model.
 */
function createModelItem(model: ModelQuota, config: StatusBarConfig): ModelQuickPickItem {
    const icon = getStatusIcon(model.remainingPercentage, config);
    const pinIcon = model.isPinned ? '$(pinned)' : '$(circle-outline)';
    const pct = formatPercentage(model.remainingPercentage);
    const bar = generateProgressBar(model.remainingPercentage);
    
    // Clean label layout
    // $(pinned) $(pass-filled) Claude 3.5 Sonnet
    const label = `${pinIcon} ${icon} ${model.shortLabel}`;
    
    // Clean detail layout
    //     ▓▓▓▓▓▓▓▓░░ 80.5% | Reset: 2h 15m (07:30)
    const detail = `    ${bar} ${pct} | Reset: ${model.timeUntilResetFormatted} (${model.resetTimeDisplay})`;

    return {
        label,
        detail,
        modelId: model.id,
        isPinned: model.isPinned,
        family: model.family,
        picked: model.isPinned,
    };
}
