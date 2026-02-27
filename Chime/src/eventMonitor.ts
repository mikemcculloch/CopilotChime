import * as vscode from 'vscode';
import { SoundPlayer, SoundType } from './soundPlayer';

/**
 * Monitors VS Code events and plays chime sounds when relevant
 * Copilot-related activity completes or needs user interaction.
 *
 * Detection methods:
 *  1. Terminal shell execution end (debounced) — agent-mode commands
 *  2. Manual commands via Command Palette
 *  3. Language Model Tool invocations (see chimeTool.ts)
 */
export class EventMonitor implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly soundPlayer: SoundPlayer;
    private readonly statusBarItem: vscode.StatusBarItem;
    private readonly log: (msg: string) => void;

    private terminalDebounceTimer: ReturnType<typeof setTimeout> | undefined;
    private approvalNudgeTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(soundPlayer: SoundPlayer, outputChannel?: { appendLine(msg: string): void }) {
        this.soundPlayer = soundPlayer;
        this.log = outputChannel
            ? (msg) => outputChannel.appendLine(`[EventMonitor] ${msg}`)
            : (msg) => console.log(`[EventMonitor] ${msg}`);

        // Status bar toggle button
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100,
        );
        this.statusBarItem.command = 'copilotChime.toggle';
        this.updateStatusBar();
        this.statusBarItem.show();

        // React to config changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('copilotChime')) {
                    this.updateStatusBar();
                }
            }),
        );

        // Wire up terminal monitors
        this.registerTerminalMonitor();
    }

    // ── Public API (called by commands & chimeTool) ───────────────

    async playComplete(): Promise<void> {
        this.log('playComplete()');
        const cfg = this.cfg();
        await this.soundPlayer.play(cfg.completeSound, cfg.volume);
    }

    async playAttention(): Promise<void> {
        this.log('playAttention()');
        const cfg = this.cfg();
        await this.soundPlayer.play(cfg.attentionSound, cfg.volume);
    }

    async playPrompt(): Promise<void> {
        this.log('playPrompt()');
        const cfg = this.cfg();
        await this.soundPlayer.play(cfg.promptSound, cfg.volume);
    }

    toggle(): void {
        const config = vscode.workspace.getConfiguration('copilotChime');
        const current = config.get<boolean>('enabled', true);
        config.update('enabled', !current, vscode.ConfigurationTarget.Global);
        this.updateStatusBar();
        vscode.window.showInformationMessage(
            `Copilot Chime: ${!current ? 'Enabled' : 'Disabled'}`,
        );
    }

    async configure(): Promise<void> {
        const config = vscode.workspace.getConfiguration('copilotChime');

        interface ToggleItem extends vscode.QuickPickItem {
            key: string;
            soundKey?: string;
        }

        const onTerminal = config.get<boolean>('onTerminalComplete', true);
        const onToolComplete = config.get<boolean>('onToolComplete', true);
        const onToolAttention = config.get<boolean>('onToolAttention', false);
        const onToolPrompt = config.get<boolean>('onToolPrompt', true);
        const onCommandApproval = config.get<boolean>('onCommandApproval', true);
        const completeSound = config.get<SoundType>('completeSound', 'chime');
        const attentionSound = config.get<SoundType>('attentionSound', 'bell');
        const promptSound = config.get<SoundType>('promptSound', 'prompt');

        const items: ToggleItem[] = [
            {
                label: '$(terminal) Terminal Completion',
                description: `sound: ${completeSound}`,
                detail: 'Chime when terminal commands finish (agent mode)',
                picked: onTerminal,
                key: 'onTerminalComplete',
            },
            {
                label: '$(check) Tool — Completion',
                description: `sound: ${completeSound}`,
                detail: 'Chime when Copilot calls #chime with type "complete"',
                picked: onToolComplete,
                key: 'onToolComplete',
            },
            {
                label: '$(comment-discussion) Tool — Prompt',
                description: `sound: ${promptSound}`,
                detail: 'Chime when Copilot needs user interaction, input, or approval',
                picked: onToolPrompt,
                key: 'onToolPrompt',
            },
            {
                label: '$(bell-dot) Tool — Attention',
                description: `sound: ${attentionSound}`,
                detail: 'Chime when Copilot calls #chime with type "attention"',
                picked: onToolAttention,
                key: 'onToolAttention',
            },
            {
                label: '$(terminal-bash) Command Approval',
                description: `sound: ${promptSound}`,
                detail: 'Chime when Copilot is likely waiting for terminal command approval',
                picked: onCommandApproval,
                key: 'onCommandApproval',
            },
        ];

        const picked = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Check the chime types you want enabled',
            title: 'Copilot Chime — Configure',
        });

        if (picked) {
            const pickedKeys = new Set(picked.map((p) => p.key));
            await config.update('onTerminalComplete', pickedKeys.has('onTerminalComplete'), vscode.ConfigurationTarget.Global);
            await config.update('onToolComplete', pickedKeys.has('onToolComplete'), vscode.ConfigurationTarget.Global);
            await config.update('onToolPrompt', pickedKeys.has('onToolPrompt'), vscode.ConfigurationTarget.Global);
            await config.update('onToolAttention', pickedKeys.has('onToolAttention'), vscode.ConfigurationTarget.Global);
            await config.update('onCommandApproval', pickedKeys.has('onCommandApproval'), vscode.ConfigurationTarget.Global);

            // Offer to change sounds for the enabled types
            const soundOptions: { label: string; value: string }[] = [
                { label: 'Keep current sounds', value: 'keep' },
            ];
            if (pickedKeys.has('onTerminalComplete') || pickedKeys.has('onToolComplete')) {
                soundOptions.push({ label: 'Change completion sound...', value: 'complete' });
            }
            if (pickedKeys.has('onToolPrompt')) {
                soundOptions.push({ label: 'Change prompt sound...', value: 'prompt' });
            }
            if (pickedKeys.has('onToolAttention')) {
                soundOptions.push({ label: 'Change attention sound...', value: 'attention' });
            }

            if (soundOptions.length > 1) {
                const changeSound = await vscode.window.showQuickPick(
                    soundOptions,
                    { placeHolder: 'Want to change the sound for any chime type?', title: 'Copilot Chime — Sounds' },
                );

                if (changeSound && changeSound.value !== 'keep') {
                    await this.pickSound(changeSound.value as 'complete' | 'attention' | 'prompt');
                }
            }

            this.updateStatusBar();
            vscode.window.showInformationMessage(
                `Copilot Chime: ${picked.map((p) => p.label.replace(/\$\([^)]+\) /, '')).join(', ')} enabled`,
            );
        }
    }

    private async pickSound(type: 'complete' | 'attention' | 'prompt'): Promise<void> {
        const config = vscode.workspace.getConfiguration('copilotChime');
        const settingKeys: Record<string, string> = {
            complete: 'completeSound',
            attention: 'attentionSound',
            prompt: 'promptSound',
        };
        const defaults: Record<string, SoundType> = {
            complete: 'chime',
            attention: 'bell',
            prompt: 'prompt',
        };
        const settingKey = settingKeys[type];
        const current = config.get<SoundType>(settingKey, defaults[type]);

        const allSounds: SoundType[] = ['chime', 'bell', 'ping', 'success', 'alert', 'prompt', 'aybabtu'];

        const soundDescriptions: Record<string, string> = {
            chime: 'Pleasant ascending three-note arpeggio',
            bell: 'Rich bell strike with long decay',
            ping: 'Short, clean single-note ping',
            success: 'Cheerful ascending major triad',
            alert: 'Two-tone alternating alert',
            prompt: 'Gentle rising two-note nudge',
            aybabtu: 'All Your Base — dramatic minor arpeggio',
        };

        const items = allSounds.map((s) => ({
            label: s === current ? `$(check) ${s}` : `     ${s}`,
            description: soundDescriptions[s],
            value: s,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: `Current ${type} sound: ${current}`,
            title: `Copilot Chime — ${type === 'complete' ? 'Completion' : type === 'prompt' ? 'Prompt' : 'Attention'} Sound`,
        });

        if (picked) {
            await config.update(settingKey, picked.value, vscode.ConfigurationTarget.Global);
            // Preview the sound
            const volume = config.get<number>('volume', 0.5);
            await this.soundPlayer.play(picked.value, volume);
        }
    }

    async setVolume(): Promise<void> {
        const config = vscode.workspace.getConfiguration('copilotChime');
        const current = config.get<number>('volume', 0.5);
        const levels = [
            { label: '$(mute) Mute',     description: '0%',   value: 0.0 },
            { label: '$(debug-step-out) Very Low', description: '10%',  value: 0.1 },
            { label: '$(debug-step-out) Low',      description: '25%',  value: 0.25 },
            { label: '$(unmute) Medium',  description: '50%',  value: 0.5 },
            { label: '$(unmute) High',    description: '75%',  value: 0.75 },
            { label: '$(unmute) Max',     description: '100%', value: 1.0 },
        ];

        // Mark the current level
        const items = levels.map((l) => ({
            ...l,
            description: l.value === current
                ? `${l.description}  $(check) current`
                : l.description,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: `Current volume: ${Math.round(current * 100)}% — pick a new level`,
            title: 'Copilot Chime Volume',
        });

        if (picked) {
            await config.update('volume', picked.value, vscode.ConfigurationTarget.Global);
            this.updateStatusBar();

            // Play a preview at the new volume so the user can hear the level
            if (picked.value > 0) {
                const cfg = this.cfg();
                await this.soundPlayer.play(cfg.completeSound, picked.value);
            }
        }
    }

    // ── Terminal Monitoring ───────────────────────────────────────

    private registerTerminalMonitor(): void {
        // Cancel any pending chime when a new command starts
        if (vscode.window.onDidStartTerminalShellExecution) {
            this.disposables.push(
                vscode.window.onDidStartTerminalShellExecution(() => {
                    if (this.terminalDebounceTimer) {
                        clearTimeout(this.terminalDebounceTimer);
                        this.terminalDebounceTimer = undefined;
                    }
                    if (this.approvalNudgeTimer) {
                        clearTimeout(this.approvalNudgeTimer);
                        this.approvalNudgeTimer = undefined;
                    }
                }),
            );
        }

        // Debounced chime after terminal commands finish
        if (vscode.window.onDidEndTerminalShellExecution) {
            this.disposables.push(
                vscode.window.onDidEndTerminalShellExecution(() => {
                    const cfg = this.cfg();
                    if (!cfg.enabled || !cfg.onTerminalComplete) {
                        return;
                    }

                    // Reset debounce timer on each completion so rapid
                    // sequential commands only produce one chime.
                    if (this.terminalDebounceTimer) {
                        clearTimeout(this.terminalDebounceTimer);
                    }

                    this.log(`terminal debounce started (${cfg.terminalDebounceMs}ms)`);
                    this.terminalDebounceTimer = setTimeout(async () => {
                        this.terminalDebounceTimer = undefined;
                        this.log('terminal debounce fired — playing chime');
                        await this.soundPlayer.play(cfg.completeSound, cfg.volume);

                        // After the completion chime, start a secondary timer
                        // to nudge the user if Copilot is likely waiting for
                        // terminal command approval.
                        if (cfg.onCommandApproval) {
                            this.log(`approval nudge started (${cfg.commandApprovalDelayMs}ms)`);
                            this.approvalNudgeTimer = setTimeout(async () => {
                                this.approvalNudgeTimer = undefined;
                                const freshCfg = this.cfg();
                                if (freshCfg.enabled && freshCfg.onCommandApproval) {
                                    this.log('approval nudge fired — playing prompt chime');
                                    await this.soundPlayer.play(freshCfg.promptSound, freshCfg.volume);
                                }
                            }, cfg.commandApprovalDelayMs);
                        }
                    }, cfg.terminalDebounceMs);
                }),
            );
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private cfg() {
        const config = vscode.workspace.getConfiguration('copilotChime');
        return {
            enabled: config.get<boolean>('enabled', true),
            onTerminalComplete: config.get<boolean>('onTerminalComplete', true),
            onToolComplete: config.get<boolean>('onToolComplete', true),
            onToolAttention: config.get<boolean>('onToolAttention', false),
            onToolPrompt: config.get<boolean>('onToolPrompt', true),
            onCommandApproval: config.get<boolean>('onCommandApproval', true),
            commandApprovalDelayMs: config.get<number>('commandApprovalDelayMs', 8000),
            terminalDebounceMs: config.get<number>('terminalDebounceMs', 3000),
            volume: config.get<number>('volume', 0.1),
            completeSound: config.get<SoundType>('completeSound', 'chime'),
            attentionSound: config.get<SoundType>('attentionSound', 'bell'),
            promptSound: config.get<SoundType>('promptSound', 'prompt'),
        };
    }

    private updateStatusBar(): void {
        const config = vscode.workspace.getConfiguration('copilotChime');
        const enabled = config.get<boolean>('enabled', true);
        const volume = config.get<number>('volume', 0.5);
        const volPct = Math.round(volume * 100);

        if (enabled) {
            this.statusBarItem.text = `$(bell) Chime ${volPct}%`;
            this.statusBarItem.tooltip = `Copilot Chime is ON — Volume: ${volPct}% (click to toggle)`;
        } else {
            this.statusBarItem.text = '$(mute) Chime OFF';
            this.statusBarItem.tooltip = 'Copilot Chime is OFF (click to toggle)';
        }
    }

    // ── Disposal ──────────────────────────────────────────────────

    dispose(): void {
        if (this.terminalDebounceTimer) {
            clearTimeout(this.terminalDebounceTimer);
        }
        if (this.approvalNudgeTimer) {
            clearTimeout(this.approvalNudgeTimer);
        }
        this.statusBarItem.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
