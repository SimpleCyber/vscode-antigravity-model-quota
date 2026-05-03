# Antigravity Model Quota Monitor

[![Version](https://img.shields.io/visual-studio-marketplace/v/antigravity.antigravity-model-quota-monitor?color=success&label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=antigravity.antigravity-model-quota-monitor)
[![GitHub stars](https://img.shields.io/github/stars/SimpleCyber/vscode-antigravity-model-quota?style=flat&color=gold)](https://github.com/SimpleCyber/vscode-antigravity-model-quota)
[![GitHub issues](https://img.shields.io/github/issues/SimpleCyber/vscode-antigravity-model-quota)](https://github.com/SimpleCyber/vscode-antigravity-model-quota/issues)
[![License](https://img.shields.io/github/license/SimpleCyber/vscode-antigravity-model-quota)](https://github.com/SimpleCyber/vscode-antigravity-model-quota/blob/main/LICENSE)

VS Code extension for monitoring Google Antigravity AI model quotas directly in your status bar.

<img width="1919" height="1024" alt="image" src="https://github.com/user-attachments/assets/384401dd-0868-4176-997e-4ad54a67bb97" />

<br>

**Features**: Status Bar Monitor · Rich Hover Tooltip · QuickPick Panel · Threshold Indicators · Custom Display Formats
<br>

<img width="1919" height="1073" alt="image" src="https://github.com/user-attachments/assets/182fcab9-7076-4924-86b2-db2e1c4e3a90" />


**Features**: Status Bar Monitor · Rich Hover Tooltip · QuickPick Panel · Threshold Indicators · Custom Display Formats

---

## Features

### Status Bar Display

Keep track of your Antigravity AI model quotas right inside your status bar without breaking your flow. 

Three display formats available, configurable via `agStatusBar.displayFormat`:

| Format | Example |
|--------|---------|
| **Standard** | `🟢 Claude: 80% 🟡 Gemini: 40%` |
| **Compact** | `🟢80% 🟡40%` |
| **Minimal** | `🟢🟡🔴` (Clean & unobtrusive dots only) |

- **Dynamic Colors**: Indicator turns yellow or red based on configurable warning/critical thresholds.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=SimpleCyber/vscode-antigravity-model-quota&type=Date)](https://www.star-history.com/#SimpleCyber/vscode-antigravity-model-quota&Date)
---

### Rich Hover Tooltip

Hover over the status bar item to reveal a rich popup:
- **Organized by Family**: Claude, Gemini, and GPT models cleanly categorized.
- **Visual Progress**: Custom progress bars for an instant understanding of your usage.
- **Precision Metrics**: See exact percentage remaining, credits, and the reset countdown.

---

### Persistent QuickPick Panel

Click the status indicator to open an interactive command panel:
- **Comprehensive View**: Inspect detailed quota info for all supported models.
- **Model Capabilities**: Instantly check capabilities like Text, Code, Image, Video, and Thinking logic.
- **Quick Toggles**: Pin or unpin specific models to your status bar on the fly.
- **Lightning Fast**: Press `Esc` to dismiss and get back to coding.

---

## Usage

1. **Open QuickPick**:
   - Click the status bar indicator
   - Or run `Antigravity: Show Model Quota Details` from the command palette

2. **Refresh**: 
   - Run `Antigravity: Refresh Quota Data` from the command palette
   - Or configure auto-refresh via `agStatusBar.refreshInterval`

---

## Configuration

Tune the monitor to fit your exact workflow in VS Code Settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `agStatusBar.refreshInterval` | `15` | Interval in seconds to refresh quota data (Range: 5-3600) |
| `agStatusBar.displayFormat` | `standard` | Format of the status bar display (`standard`, `compact`, `minimal`) |
| `agStatusBar.warningThreshold` | `60` | Quota drops below this %? The indicator turns **yellow** |
| `agStatusBar.criticalThreshold` | `40` | Quota drops below this %? The indicator turns **red** |
| `agStatusBar.isPremiumUser` | `false` | Whether the user has a premium membership (shows extra models) |

---

## Installation

### VS Code Marketplace
1. `Cmd/Ctrl+Shift+X` to open Extensions panel
2. Search `Antigravity Model Quota Monitor`
3. Click Install

### Build from Source

```bash
# Clone repository
git clone https://github.com/SimpleCyber/vscode-antigravity-model-quota.git
cd vscode-antigravity-model-quota

# Install dependencies
npm install

# Compile
npm run compile

# Package
npm run package
```

Requirements: Node.js v20+, npm v9+

---

## Support

- ⭐ [GitHub Star](https://github.com/SimpleCyber/vscode-antigravity-model-quota)
- 💬 [Report Issues](https://github.com/SimpleCyber/vscode-antigravity-model-quota/issues)

---

## License

[MIT](LICENSE)
