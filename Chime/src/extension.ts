import * as vscode from 'vscode';
import { SoundPlayer } from './soundPlayer';
import { EventMonitor } from './eventMonitor';
import { ChimeNotifyTool } from './chimeTool';

export function activate(context: vscode.ExtensionContext): void {
    const storagePath = context.globalStorageUri.fsPath;
    const soundPlayer = new SoundPlayer(storagePath);
    const eventMonitor = new EventMonitor(soundPlayer);

    // ── Language Model Tool ──────────────────────────────────
    // Copilot (and other LM participants) can call this tool to
    // play a chime. Users reference it with #chime in chat.
    const chimeTool = new ChimeNotifyTool(eventMonitor);
    context.subscriptions.push(
        vscode.lm.registerTool('copilotChime-notify', chimeTool),
    );

    // ── Commands ─────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('copilotChime.playComplete', () =>
            eventMonitor.playComplete(),
        ),
        vscode.commands.registerCommand('copilotChime.playAttention', () =>
            eventMonitor.playAttention(),
        ),
        vscode.commands.registerCommand('copilotChime.toggle', () =>
            eventMonitor.toggle(),
        ),
        vscode.commands.registerCommand('copilotChime.setVolume', () =>
            eventMonitor.setVolume(),
        ),
        vscode.commands.registerCommand('copilotChime.configure', () =>
            eventMonitor.configure(),
        ),
    );

    // ── Cleanup ──────────────────────────────────────────────
    context.subscriptions.push(eventMonitor);
    context.subscriptions.push({ dispose: () => soundPlayer.dispose() });
}

export function deactivate(): void {
    // Disposed via subscriptions
}
