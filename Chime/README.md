# Copilot Chime 🔔

A VS Code extension that plays pleasant chime sounds when GitHub Copilot completes a task or needs your attention.

## Features

### 🎵 Language Model Tool — `#chime`

The flagship feature. Copilot Chime registers as a **Language Model Tool** that Copilot can call directly. Reference it in your chat prompts:

```
Fix the failing tests and #chime when you're done.
```

```
Refactor this module. Use #chime if you need my input.
```

Copilot will automatically play a notification chime when it finishes or needs you.

### 🖥️ Terminal Completion Detection

When Copilot **agent mode** runs commands in the terminal, Copilot Chime detects when they finish and plays a notification sound. Multiple rapid commands are debounced so you only hear one chime when the batch completes.

### 🔕 Quick Toggle

Click the **$(bell) Chime** indicator in the status bar to toggle sounds on or off. You can also use the Command Palette:

- **Copilot Chime: Toggle Sounds On/Off**
- **Copilot Chime: Play Completion Sound**
- **Copilot Chime: Play Attention Sound**

## Sounds

| Name      | Description                              | Default for       |
| --------- | ---------------------------------------- | ------------------ |
| `chime`   | Pleasant ascending three-note arpeggio   | Completion         |
| `bell`    | Rich bell strike with long decay         | Attention          |
| `ping`    | Short, clean single-note ping            | —                  |
| `success` | Cheerful ascending major triad           | —                  |
| `alert`   | Two-tone alternating alert               | —                  |

All sounds are generated programmatically — no external audio files required.

## Settings

| Setting                          | Default  | Description                                      |
| -------------------------------- | -------- | ------------------------------------------------ |
| `copilotChime.enabled`           | `true`   | Master on/off switch                             |
| `copilotChime.onTerminalComplete`| `true`   | Chime when terminal commands finish              |
| `copilotChime.terminalDebounceMs`| `3000`   | Debounce interval (ms) for rapid terminal events |
| `copilotChime.volume`            | `0.5`    | Volume level (0.0 – 1.0)                        |
| `copilotChime.completeSound`     | `chime`  | Sound for task completion                        |
| `copilotChime.attentionSound`    | `bell`   | Sound for attention/interaction needed           |

## Requirements

- **VS Code 1.96+** (for Language Model Tool API)
- **GitHub Copilot Chat extension** (for `#chime` tool references)

### Platform Audio Support

| Platform | Playback method                     |
| -------- | ----------------------------------- |
| Windows  | PowerShell `System.Media.SoundPlayer` |
| macOS    | `afplay`                            |
| Linux    | `paplay` (PulseAudio) or `aplay`   |

## Development

```bash
cd Chime
npm install
npm run compile
```

Press **F5** to launch the Extension Development Host and test the extension.

## How It Works

1. **Sound Generation** — WAV audio is generated in-memory from sine waves with harmonic overtones and cached to disk on first play.
2. **Terminal Monitoring** — Listens to `onDidEndTerminalShellExecution` events. A debounce timer ensures rapid sequential commands produce only one chime.
3. **LM Tool** — Registers `copilotChime-notify` as a Language Model Tool. When Copilot's model determines it should notify the user, it calls the tool and a chime plays.
4. **Cross-platform Playback** — Spawns a platform-specific subprocess to play the cached WAV file.

## License

MIT
