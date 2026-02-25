import * as vscode from 'vscode';
import { EventMonitor } from './eventMonitor';

/**
 * Input schema accepted by the copilotChime-notify Language Model Tool.
 */
interface ChimeToolInput {
    type: 'complete' | 'attention' | 'prompt';
    message?: string;
}

/**
 * A Language Model Tool that Copilot (or any LM-based chat participant)
 * can call to play a notification chime for the user.
 *
 * Users can reference it in chat with `#chime`, e.g.:
 *   "Fix the failing tests and #chime when you're done."
 *
 * Copilot will also call it automatically when its model determines
 * user notification is appropriate (based on the modelDescription in
 * package.json).
 */
export class ChimeNotifyTool implements vscode.LanguageModelTool<ChimeToolInput> {
    constructor(
        private readonly eventMonitor: EventMonitor,
    ) {}

    /**
     * Called by the language model to actually play the chime.
     */
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ChimeToolInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { type = 'complete', message } = options.input;

        const config = vscode.workspace.getConfiguration('copilotChime');
        const enabled = config.get<boolean>('enabled', true);

        if (enabled) {
            if (type === 'prompt') {
                const onToolPrompt = config.get<boolean>('onToolPrompt', true);
                if (onToolPrompt) {
                    await this.eventMonitor.playPrompt();
                }
            } else if (type === 'attention') {
                const onToolAttention = config.get<boolean>('onToolAttention', false);
                if (onToolAttention) {
                    await this.eventMonitor.playAttention();
                }
            } else {
                const onToolComplete = config.get<boolean>('onToolComplete', true);
                if (onToolComplete) {
                    await this.eventMonitor.playComplete();
                }
            }
        }

        // Show an information message alongside the chime when one is provided
        if (message) {
            vscode.window.showInformationMessage(`🔔 ${message}`);
        }

        const labels: Record<string, string> = {
            complete: 'Completion chime',
            attention: 'Attention chime',
            prompt: 'Prompt chime',
        };
        const label = labels[type] ?? 'Chime';
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
                `${label} played successfully.${message ? ` Message: ${message}` : ''}`,
            ),
        ]);
    }

    /**
     * Provides a brief status message shown in the chat while the tool runs.
     */
    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ChimeToolInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        const type = options.input.type ?? 'complete';
        const messages: Record<string, string> = {
            complete: 'Playing completion chime…',
            attention: 'Playing attention chime…',
            prompt: 'Playing prompt chime — user interaction needed…',
        };
        return {
            invocationMessage: messages[type] ?? 'Playing chime…',
        };
    }
}
