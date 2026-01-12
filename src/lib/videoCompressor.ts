import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export type CompressionQuality = "alta" | "media" | "baixa";

export interface CompressionProgress {
  phase: "loading" | "compressing" | "finalizing";
  progress: number;
  message: string;
}

interface QualitySettings {
  scale: number;
  crf: number;
  preset: string;
}

const qualitySettings: Record<CompressionQuality, QualitySettings> = {
  alta: {
    scale: 720,
    crf: 23,
    preset: "fast",
  },
  media: {
    scale: 480,
    crf: 28,
    preset: "fast",
  },
  baixa: {
    scale: 360,
    crf: 32,
    preset: "fast",
  },
};

let ffmpeg: FFmpeg | null = null;
let isLoading = false;

async function loadFFmpeg(onProgress: (progress: CompressionProgress) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) {
    return ffmpeg;
  }

  if (isLoading) {
    // Wait for the existing load to complete
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (ffmpeg && ffmpeg.loaded) {
      return ffmpeg;
    }
  }

  isLoading = true;

  try {
    ffmpeg = new FFmpeg();

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

    onProgress({
      phase: "loading",
      progress: 10,
      message: "Carregando compressor de vídeo...",
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    onProgress({
      phase: "loading",
      progress: 100,
      message: "Compressor carregado!",
    });

    return ffmpeg;
  } finally {
    isLoading = false;
  }
}

export async function compressVideo(
  file: File,
  quality: CompressionQuality,
  onProgress: (progress: CompressionProgress) => void
): Promise<File> {
  const settings = qualitySettings[quality];

  // Load FFmpeg
  const ff = await loadFFmpeg(onProgress);

  onProgress({
    phase: "compressing",
    progress: 0,
    message: "Preparando vídeo para compressão...",
  });

  // Set up progress handler
  ff.on("progress", ({ progress }) => {
    const percent = Math.round(progress * 100);
    onProgress({
      phase: "compressing",
      progress: percent,
      message: `Comprimindo vídeo... ${percent}%`,
    });
  });

  // Write input file
  const inputName = "input.mp4";
  const outputName = "output.mp4";

  await ff.writeFile(inputName, await fetchFile(file));

  onProgress({
    phase: "compressing",
    progress: 5,
    message: "Iniciando compressão...",
  });

  // Run FFmpeg compression
  // -vf scale: resize to target height, -2 keeps aspect ratio
  // -crf: quality (lower = better, 18-28 is good for web)
  // -preset: encoding speed (fast is good balance)
  // -c:a aac: re-encode audio to AAC for compatibility
  await ff.exec([
    "-i",
    inputName,
    "-vf",
    `scale=-2:${settings.scale}`,
    "-c:v",
    "libx264",
    "-crf",
    settings.crf.toString(),
    "-preset",
    settings.preset,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart", // Optimize for web streaming
    outputName,
  ]);

  onProgress({
    phase: "finalizing",
    progress: 95,
    message: "Finalizando...",
  });

  // Read output file
  const data = await ff.readFile(outputName);

  // Clean up
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  // Handle different return types from readFile
  let blobData: BlobPart;
  if (typeof data === "string") {
    // If it's a string, convert to ArrayBuffer
    const encoder = new TextEncoder();
    blobData = encoder.encode(data);
  } else {
    // It's already Uint8Array
    blobData = new Uint8Array(data);
  }
  
  const compressedBlob = new Blob([blobData], { type: "video/mp4" });
  const compressedFile = new File(
    [compressedBlob],
    file.name.replace(/\.[^/.]+$/, "_compressed.mp4"),
    { type: "video/mp4" }
  );

  onProgress({
    phase: "finalizing",
    progress: 100,
    message: "Compressão concluída!",
  });

  return compressedFile;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function estimateCompressedSize(
  originalSize: number,
  quality: CompressionQuality
): string {
  // Rough estimates based on typical compression ratios
  const ratios: Record<CompressionQuality, number> = {
    alta: 0.15, // ~15% of original
    media: 0.08, // ~8% of original
    baixa: 0.04, // ~4% of original
  };

  const estimatedBytes = originalSize * ratios[quality];
  return formatFileSize(estimatedBytes);
}
