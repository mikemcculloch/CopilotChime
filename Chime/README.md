# Copilot Chime 🔔

**Never miss a Copilot prompt again.** Copilot Chime plays audio notifications when GitHub Copilot completes a task, needs your input, or finishes running terminal commands — even when VS Code isn't focused.

Step away from your desk while Copilot works. You'll hear it when it's done or when it needs you.

## Features

### 🎵 `#chime` — Language Model Tool

Copilot Chime registers as a **Language Model Tool** that Copilot can call directly. Just reference `#chime` in your prompts:

```
Fix the failing tests and #chime when you're done.
```

```
Refactor this module. Use #chime if you need my input.
```

Copilot automatically plays the right notification:
- **Completion chime** — when it finishes your task
- **Prompt chime** — when it needs your approval, input, or has a question
- **Attention chime** — for general alerts

### 🖥️ Terminal Completion Detection

When Copilot **agent mode** runs commands in the terminal, Copilot Chime detects when they finish and plays a notification. Multiple rapid commands are debounced so you only hear one chime when the batch completes.

### 🔊 Volume Control

Use `Copilot Chime: Set Volume` from the Command Palette to pick a volume level. The current volume is displayed in the status bar.

### ⚙️ Per-Type Toggle

Use `Copilot Chime: Configure Chimes` to enable or disable individual chime types:
- Terminal completion chimes
- Tool completion chimes
- Tool prompt chimes
- Tool attention chimes

### 🔕 Quick Toggle

Click the **🔔 Chime** indicator in the status bar to toggle all sounds on or off.

## Sounds

| Name      | Description                              | Default for       |
| --------- | ---------------------------------------- | ----------------- |
| `chime`   | Pleasant ascending three-note arpeggio   | Completion         |
| `bell`    | Rich bell strike with long decay         | Attention          |
| `prompt`  | Gentle rising two-note nudge             | Prompt             |
| `ping`    | Short, clean single-note ping            | —                  |
| `success` | Cheerful ascending major triad           | —                  |
| `alert`   | Two-tone alternating alert               | —                  |

All sounds are **generated programmatically** — no external audio files required. Each sound can be previewed and reassigned in the configuration.

## Commands

| Command                              | Description                        |
| ------------------------------------ | ---------------------------------- |
| `Copilot Chime: Toggle Sounds On/Off`| Master on/off toggle               |
| `Copilot Chime: Set Volume`          | Pick a volume level (10%–100%)     |
| `Copilot Chime: Configure Chimes`    | Enable/disable individual chime types |
| `Copilot Chime: Play Completion Sound` | Test the completion sound        |
| `Copilot Chime: Play Attention Sound`  | Test the attention sound         |

## Settings

| Setting                           | Default   | Description                                      |
| --------------------------------- | --------- | ------------------------------------------------ |
| `copilotChime.enabled`            | `true`    | Master on/off switch                             |
| `copilotChime.volume`             | `0.1`     | Volume level (0.0 – 1.0)                        |
| `copilotChime.onTerminalComplete` | `true`    | Chime when terminal commands finish              |
| `copilotChime.onToolComplete`     | `true`    | Chime on `#chime` complete calls                 |
| `copilotChime.onToolPrompt`       | `true`    | Chime when Copilot needs user input              |
| `copilotChime.onToolAttention`    | `false`   | Chime on `#chime` attention calls                |
| `copilotChime.terminalDebounceMs` | `3000`    | Debounce interval (ms) for rapid terminal events |
| `copilotChime.completeSound`      | `chime`   | Sound for task completion                        |
| `copilotChime.attentionSound`     | `bell`    | Sound for attention needed                       |
| `copilotChime.promptSound`        | `prompt`  | Sound for user interaction needed                |

## Requirements

- **VS Code 1.96+** (for Language Model Tool API)
- **GitHub Copilot Chat extension** (for `#chime` tool references)

### Platform Audio Support

| Platform | Playback Method                       |
| -------- | ------------------------------------- |
| Windows  | PowerShell `System.Media.SoundPlayer` |
| macOS    | `afplay`                              |
| Linux    | `paplay` (PulseAudio) or `aplay`     |

## Getting Started

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hatchetsoftwarellc.copilot-chime)
2. Open GitHub Copilot Chat
3. Add `#chime` to any prompt — Copilot will notify you when it's done

## How It Works

1. **Sound Generation** — WAV audio is synthesized from sine waves with harmonic overtones, cached to disk on first play.
2. **Terminal Monitoring** — Listens to `onDidEndTerminalShellExecution` events with a configurable debounce timer.
3. **LM Tool** — Registers `copilotChime-notify` as a Language Model Tool. When Copilot determines it should notify the user, it calls the tool and a chime plays.
4. **Cross-platform Playback** — Spawns a platform-specific subprocess to play the cached WAV file.

## Development

```bash
cd Chime
npm install
npm run compile
```

Press **F5** to launch the Extension Development Host.

## License

MIT
