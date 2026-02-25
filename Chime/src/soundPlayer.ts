import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { exec } from 'child_process';

/**
 * Available sound types for the chime extension.
 */
export type SoundType = 'chime' | 'bell' | 'ping' | 'success' | 'alert' | 'prompt';

interface ToneConfig {
    frequency: number;
    duration: number;
    fadeIn: number;
    fadeOut: number;
    harmonics?: { ratio: number; amplitude: number }[];
}

/**
 * Generates WAV audio data programmatically and plays it using
 * platform-specific system commands. No external audio files or
 * npm audio packages required.
 */
export class SoundPlayer {
    private readonly soundCache = new Map<string, string>();
    private readonly soundDir: string;
    private isPlaying = false;

    constructor(storagePath: string) {
        this.soundDir = path.join(storagePath, 'sounds');
    }

    /**
     * Play a notification sound of the given type and volume.
     * Sounds are generated as WAV files on first use and cached.
     * Concurrent play requests are dropped (no overlapping sounds).
     */
    async play(soundType: SoundType, volume: number = 0.5): Promise<void> {
        if (this.isPlaying) {
            return; // Don't overlap sounds
        }

        this.isPlaying = true;
        try {
            const cacheKey = `${soundType}-${Math.round(volume * 100)}`;
            let filePath = this.soundCache.get(cacheKey);

            if (!filePath || !fs.existsSync(filePath)) {
                filePath = this.generateSound(soundType, volume);
                this.soundCache.set(cacheKey, filePath);
            }

            await this.playFile(filePath);
        } finally {
            this.isPlaying = false;
        }
    }

    // ── WAV Generation ────────────────────────────────────────────

    private generateSound(soundType: SoundType, volume: number): string {
        if (!fs.existsSync(this.soundDir)) {
            fs.mkdirSync(this.soundDir, { recursive: true });
        }

        const sampleRate = 22050;
        const buffer = this.createWavBuffer(soundType, sampleRate, volume);
        const filePath = path.join(this.soundDir, `${soundType}-${Math.round(volume * 100)}.wav`);
        fs.writeFileSync(filePath, buffer);
        return filePath;
    }

    private createWavBuffer(soundType: SoundType, sampleRate: number, volume: number): Buffer {
        const tones = this.getTones(soundType);
        const totalSamples = tones.reduce(
            (sum, t) => sum + Math.floor(t.duration * sampleRate),
            0
        );

        const dataSize = totalSamples * 2; // 16-bit mono PCM
        const buffer = Buffer.alloc(44 + dataSize);

        // ── RIFF / WAV header (44 bytes) ──
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write('WAVE', 8);
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16);          // Sub-chunk size
        buffer.writeUInt16LE(1, 20);           // PCM format
        buffer.writeUInt16LE(1, 22);           // Mono
        buffer.writeUInt32LE(sampleRate, 24);  // Sample rate
        buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
        buffer.writeUInt16LE(2, 32);           // Block align
        buffer.writeUInt16LE(16, 34);          // Bits per sample
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);

        // ── PCM sample data ──
        let offset = 44;
        for (const tone of tones) {
            const samples = Math.floor(tone.duration * sampleRate);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const envelope = this.envelope(i, samples, sampleRate, tone.fadeIn, tone.fadeOut);

                // Fundamental frequency
                let sample = Math.sin(2 * Math.PI * tone.frequency * t) * envelope * volume;

                // Harmonic overtones for richer timbre
                if (tone.harmonics) {
                    for (const h of tone.harmonics) {
                        sample +=
                            Math.sin(2 * Math.PI * tone.frequency * h.ratio * t) *
                            h.amplitude *
                            envelope *
                            volume;
                    }
                }

                const clamped = Math.max(-1, Math.min(1, sample)) * 32767;
                buffer.writeInt16LE(Math.round(clamped), offset);
                offset += 2;
            }
        }

        return buffer;
    }

    /**
     * Attempt to normalize total amplitude given harmonics so we don't clip.
     */
    private getTones(soundType: SoundType): ToneConfig[] {
        switch (soundType) {
            // Pleasant ascending three-note arpeggio (C6 → E6 → G6)
            case 'chime':
                return [
                    {
                        frequency: 1047,
                        duration: 0.12,
                        fadeIn: 0.008,
                        fadeOut: 0.09,
                        harmonics: [
                            { ratio: 2, amplitude: 0.25 },
                            { ratio: 3, amplitude: 0.08 },
                        ],
                    },
                    {
                        frequency: 1319,
                        duration: 0.12,
                        fadeIn: 0.008,
                        fadeOut: 0.10,
                        harmonics: [{ ratio: 2, amplitude: 0.2 }],
                    },
                    {
                        frequency: 1568,
                        duration: 0.22,
                        fadeIn: 0.008,
                        fadeOut: 0.18,
                        harmonics: [
                            { ratio: 2, amplitude: 0.25 },
                            { ratio: 3, amplitude: 0.08 },
                        ],
                    },
                ];

            // Rich bell strike with long decay (A5)
            case 'bell':
                return [
                    {
                        frequency: 880,
                        duration: 0.45,
                        fadeIn: 0.004,
                        fadeOut: 0.40,
                        harmonics: [
                            { ratio: 2, amplitude: 0.40 },
                            { ratio: 3, amplitude: 0.20 },
                            { ratio: 4.2, amplitude: 0.08 },
                        ],
                    },
                ];

            // Short clean ping (C6)
            case 'ping':
                return [
                    {
                        frequency: 1047,
                        duration: 0.10,
                        fadeIn: 0.004,
                        fadeOut: 0.08,
                        harmonics: [{ ratio: 2, amplitude: 0.15 }],
                    },
                ];

            // Cheerful ascending major triad (G5 → B5 → D6)
            case 'success':
                return [
                    {
                        frequency: 784,
                        duration: 0.10,
                        fadeIn: 0.008,
                        fadeOut: 0.07,
                        harmonics: [{ ratio: 2, amplitude: 0.25 }],
                    },
                    {
                        frequency: 988,
                        duration: 0.10,
                        fadeIn: 0.008,
                        fadeOut: 0.07,
                        harmonics: [{ ratio: 2, amplitude: 0.25 }],
                    },
                    {
                        frequency: 1175,
                        duration: 0.18,
                        fadeIn: 0.008,
                        fadeOut: 0.14,
                        harmonics: [{ ratio: 2, amplitude: 0.25 }],
                    },
                ];

            // Two-tone alternating alert (G5 → E5 → G5)
            case 'alert':
                return [
                    { frequency: 784, duration: 0.09, fadeIn: 0.004, fadeOut: 0.04 },
                    { frequency: 659, duration: 0.09, fadeIn: 0.004, fadeOut: 0.04 },
                    { frequency: 784, duration: 0.14, fadeIn: 0.004, fadeOut: 0.10 },
                ];

            // Gentle rising two-note nudge (E5 → A5) — "I need you"
            case 'prompt':
                return [
                    {
                        frequency: 659,
                        duration: 0.15,
                        fadeIn: 0.01,
                        fadeOut: 0.10,
                        harmonics: [
                            { ratio: 2, amplitude: 0.15 },
                            { ratio: 3, amplitude: 0.05 },
                        ],
                    },
                    {
                        frequency: 880,
                        duration: 0.25,
                        fadeIn: 0.01,
                        fadeOut: 0.20,
                        harmonics: [
                            { ratio: 2, amplitude: 0.15 },
                            { ratio: 3, amplitude: 0.05 },
                        ],
                    },
                ];

            default:
                return [
                    { frequency: 880, duration: 0.18, fadeIn: 0.008, fadeOut: 0.14 },
                ];
        }
    }

    private envelope(
        sampleIdx: number,
        totalSamples: number,
        sampleRate: number,
        fadeInSec: number,
        fadeOutSec: number,
    ): number {
        const fadeInSamples = Math.floor(fadeInSec * sampleRate);
        const fadeOutSamples = Math.floor(fadeOutSec * sampleRate);
        const fadeOutStart = totalSamples - fadeOutSamples;

        if (sampleIdx < fadeInSamples) {
            return sampleIdx / fadeInSamples;
        }
        if (sampleIdx > fadeOutStart) {
            const progress = (sampleIdx - fadeOutStart) / fadeOutSamples;
            // Exponential decay for more natural sound
            return Math.max(0, (1 - progress) * (1 - progress));
        }
        return 1;
    }

    // ── Platform Playback ─────────────────────────────────────────

    private playFile(filePath: string): Promise<void> {
        return new Promise((resolve) => {
            const platform = os.platform();
            let command: string;

            switch (platform) {
                case 'win32':
                    // Use .NET SoundPlayer via PowerShell
                    command = `powershell -NoProfile -NonInteractive -Command "(New-Object System.Media.SoundPlayer '${filePath.replace(/'/g, "''")}').PlaySync()"`;
                    break;
                case 'darwin':
                    command = `afplay "${filePath}"`;
                    break;
                case 'linux':
                    // Try PulseAudio first, fall back to ALSA
                    command = `paplay "${filePath}" 2>/dev/null || aplay "${filePath}" 2>/dev/null`;
                    break;
                default:
                    resolve();
                    return;
            }

            exec(command, { timeout: 10000 }, (error) => {
                if (error) {
                    console.warn(`Copilot Chime: sound playback failed — ${error.message}`);
                }
                resolve(); // Always resolve; don't break the extension if audio fails
            });
        });
    }

    // ── Cleanup ───────────────────────────────────────────────────

    dispose(): void {
        try {
            if (fs.existsSync(this.soundDir)) {
                const files = fs.readdirSync(this.soundDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.soundDir, file));
                }
                fs.rmdirSync(this.soundDir);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}
