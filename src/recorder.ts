// Rolling-buffer recorder: keeps only the last N minutes of chunked video,
// so "export last 5/10 min" doesn't require recording continuously to disk.

interface Chunk {
  blob: Blob;
  t: number;
}

export class RollingRecorder {
  private recorder: MediaRecorder;
  private chunks: Chunk[] = [];
  private maxSeconds: number;
  private chunkSeconds = 5;

  constructor(canvas: HTMLCanvasElement, audioStream: MediaStream, maxMinutes = 10) {
    this.maxSeconds = maxMinutes * 60;
    const videoStream = canvas.captureStream(30);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    this.recorder = new MediaRecorder(combined, { mimeType: pickMimeType() });
    this.recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      this.chunks.push({ blob: e.data, t: performance.now() / 1000 });
      this.trim();
    };
  }

  private trim() {
    const now = performance.now() / 1000;
    while (this.chunks.length && now - this.chunks[0].t > this.maxSeconds) {
      this.chunks.shift();
    }
  }

  start() {
    this.recorder.start(this.chunkSeconds * 1000);
  }

  stop() {
    this.recorder.stop();
  }

  /** Export whatever is currently in the buffer as a single downloadable file. */
  exportBuffer(filename = `loom-${Date.now()}.webm`) {
    const blob = new Blob(
      this.chunks.map((c) => c.blob),
      { type: this.recorder.mimeType },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  bufferedSeconds(): number {
    if (!this.chunks.length) return 0;
    return performance.now() / 1000 - this.chunks[0].t;
  }
}

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}
