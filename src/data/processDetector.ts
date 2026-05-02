/**
 * Antigravity Status Bar Monitor — Process Detector (Windows)
 *
 * Detects the running Antigravity language_server process,
 * extracts connection parameters (port + CSRF token), and
 * verifies the connection via HTTPS ping.
 *
 * Ported from the Antigravity Cockpit extension (hunter.ts + strategies.ts).
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';

const execAsync = promisify(exec);

/** Connection parameters extracted from the Antigravity process */
export interface AntigravityConnection {
    port: number;
    csrfToken: string;
}

/** Process candidate found during scanning */
interface ProcessCandidate {
    pid: number;
    extensionPort: number;
    csrfToken: string;
}

// ── Constants ─────────────────────────────────────────

const TARGET_PROCESS = 'language_server_windows_x64.exe';
const API_ENDPOINT = '/exa.language_server_pb.LanguageServerService/GetUnleashData';
const PROCESS_CMD_TIMEOUT_MS = 15_000;
const HTTPS_TIMEOUT_MS = 10_000;

// ── Public API ────────────────────────────────────────

/**
 * Scan for a running Antigravity language server process (Windows only).
 *
 * @param log  Optional logging callback for diagnostic messages.
 * @returns    Connection info or `null` if the process is not found.
 */
export async function detectAntigravityProcess(
    log?: (msg: string) => void,
): Promise<AntigravityConnection | null> {
    const info = log ?? (() => {});

    // Phase 1: Search by process name
    const result = await scanByProcessName(info);
    if (result) {
        return result;
    }

    // Phase 2: Keyword fallback (search for csrf_token in all processes)
    info('[ProcessDetector] Process name search failed, trying keyword search...');
    const fallback = await scanByKeyword(info);
    if (fallback) {
        return fallback;
    }

    info('[ProcessDetector] No Antigravity process found.');
    return null;
}

// ── Internals ─────────────────────────────────────────

/**
 * Check if a command line belongs to an Antigravity process.
 * Must match all three conditions:
 *  1. --extension_server_port
 *  2. --csrf_token
 *  3. --app_data_dir antigravity
 */
function isAntigravityProcess(commandLine: string): boolean {
    return (
        commandLine.includes('--extension_server_port') &&
        commandLine.includes('--csrf_token') &&
        /--app_data_dir\s+antigravity\b/i.test(commandLine)
    );
}

/**
 * Parse PowerShell JSON output into process candidates.
 */
function parseCandidates(stdout: string, log: (m: string) => void): ProcessCandidate[] {
    try {
        // Strip any non-JSON preamble (e.g. from chcp)
        const jsonStart = stdout.indexOf('[');
        const jsonObjStart = stdout.indexOf('{');
        let clean = stdout;
        if (jsonStart >= 0 || jsonObjStart >= 0) {
            const start =
                jsonStart >= 0 && jsonObjStart >= 0
                    ? Math.min(jsonStart, jsonObjStart)
                    : Math.max(jsonStart, jsonObjStart);
            clean = stdout.substring(start);
        }

        let data = JSON.parse(clean.trim());
        if (!Array.isArray(data)) {
            data = [data];
        }

        const candidates: ProcessCandidate[] = [];
        for (const item of data) {
            const cmdLine: string = item.CommandLine || '';
            if (!cmdLine || !isAntigravityProcess(cmdLine)) {
                continue;
            }

            const pid = item.ProcessId;
            if (!pid) {
                continue;
            }

            const portMatch = cmdLine.match(/--extension_server_port[=\s]+(\d+)/);
            const tokenMatch = cmdLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);
            if (!tokenMatch?.[1]) {
                log(`[ProcessDetector] Cannot extract CSRF token from PID ${pid}`);
                continue;
            }

            candidates.push({
                pid,
                extensionPort: portMatch?.[1] ? parseInt(portMatch[1], 10) : 0,
                csrfToken: tokenMatch[1],
            });
        }

        return candidates;
    } catch {
        return [];
    }
}

/**
 * Scan by process name using PowerShell + Get-CimInstance.
 */
async function scanByProcessName(log: (m: string) => void): Promise<AntigravityConnection | null> {
    const maxAttempts = 3;

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const utf8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
            const cmd = `chcp 65001 >nul && powershell -NoProfile -Command "${utf8}Get-CimInstance Win32_Process -Filter 'name=''${TARGET_PROCESS}''' | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;

            const { stdout } = await execAsync(cmd, { timeout: PROCESS_CMD_TIMEOUT_MS });
            if (!stdout?.trim()) {
                continue;
            }

            const candidates = parseCandidates(stdout, log);
            log(`[ProcessDetector] Found ${candidates.length} Antigravity process(es)`);

            for (const c of candidates) {
                const conn = await verifyAndConnect(c, log);
                if (conn) {
                    return conn;
                }
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            log(`[ProcessDetector] Attempt ${i + 1} failed: ${msg}`);
        }
    }
    return null;
}

/**
 * Keyword-based fallback: find any process with csrf_token in its command line.
 */
async function scanByKeyword(log: (m: string) => void): Promise<AntigravityConnection | null> {
    try {
        const utf8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
        const cmd = `chcp 65001 >nul && powershell -NoProfile -Command "${utf8}Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'csrf_token' } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json"`;

        const { stdout } = await execAsync(cmd, { timeout: PROCESS_CMD_TIMEOUT_MS });
        if (!stdout?.trim()) {
            return null;
        }

        const candidates = parseCandidates(stdout, log);
        for (const c of candidates) {
            const conn = await verifyAndConnect(c, log);
            if (conn) {
                return conn;
            }
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`[ProcessDetector] Keyword search failed: ${msg}`);
    }
    return null;
}

/**
 * Given a candidate, find its listening ports and verify one works.
 */
async function verifyAndConnect(
    candidate: ProcessCandidate,
    log: (m: string) => void,
): Promise<AntigravityConnection | null> {
    const ports = await getListeningPorts(candidate.pid, log);
    if (ports.length === 0) {
        return null;
    }

    for (const port of ports) {
        const ok = await pingPort(port, candidate.csrfToken);
        if (ok) {
            log(`[ProcessDetector] ✅ Verified connection on port ${port}`);
            return { port, csrfToken: candidate.csrfToken };
        }
    }
    return null;
}

/**
 * Get listening TCP ports for a given PID.
 */
async function getListeningPorts(pid: number, log: (m: string) => void): Promise<number[]> {
    try {
        const utf8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
        const cmd = `chcp 65001 >nul && powershell -NoProfile -NonInteractive -Command "${utf8}$ports = Get-NetTCPConnection -State Listen -OwningProcess ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort; if ($ports) { $ports | Sort-Object -Unique }"`;

        const { stdout } = await execAsync(cmd, { timeout: PROCESS_CMD_TIMEOUT_MS });

        const ports = new Set<number>();
        const matches = stdout.match(/\b\d{1,5}\b/g) || [];
        for (const v of matches) {
            const p = parseInt(v, 10);
            if (p > 0 && p <= 65535) {
                ports.add(p);
            }
        }
        return Array.from(ports).sort((a, b) => a - b);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`[ProcessDetector] Port detection failed: ${msg}`);
        return [];
    }
}

/**
 * Verify a port by sending an HTTPS POST to the GetUnleashData endpoint.
 */
function pingPort(port: number, csrfToken: string): Promise<boolean> {
    return new Promise((resolve) => {
        const options: https.RequestOptions = {
            hostname: '127.0.0.1',
            port,
            path: API_ENDPOINT,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Codeium-Csrf-Token': csrfToken,
                'Connect-Protocol-Version': '1',
            },
            rejectUnauthorized: false,
            timeout: HTTPS_TIMEOUT_MS,
            agent: false,
        };

        const req = https.request(options, (res) => resolve(res.statusCode === 200));
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.write(JSON.stringify({ wrapper_data: {} }));
        req.end();
    });
}
