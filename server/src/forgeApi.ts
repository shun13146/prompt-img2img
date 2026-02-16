import { readFile, writeFile, mkdir } from "fs/promises";
import { resolve, basename, extname } from "path";
import type { GenerationSettings } from "@sd-prompt/shared";

export interface ForgeImg2ImgRequest {
  init_images: string[]; // base64 encoded
  prompt: string;
  negative_prompt: string;
  steps: number;
  sampler_name: string;
  cfg_scale: number;
  width: number;
  height: number;
  denoising_strength: number;
  n_iter: number;
  batch_size: number;
  override_settings?: Record<string, unknown>;
  alwayson_scripts?: Record<string, unknown>;
}

export interface ForgeImg2ImgResponse {
  images: string[]; // base64 encoded
  parameters: Record<string, unknown>;
  info: string; // JSON string
}

export interface ForgeProgressResponse {
  progress: number; // 0.0 - 1.0
  eta_relative: number;
  state: {
    skipped: boolean;
    interrupted: boolean;
    stopping_generation: boolean;
    job: string;
    job_count: number;
    job_no: number;
    sampling_step: number;
    sampling_steps: number;
  };
  current_image: string | null; // base64 preview
}

export class ForgeApi {
  constructor(private baseUrl: string) {}

  /** Check if Forge is reachable */
  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/ping`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Get available checkpoint models */
  async getModels(): Promise<{ title: string; model_name: string }[]> {
    const res = await fetch(`${this.baseUrl}/sdapi/v1/sd-models`);
    if (!res.ok) throw new Error(`Forge API error: ${res.status}`);
    return res.json();
  }

  /** Get available samplers */
  async getSamplers(): Promise<{ name: string }[]> {
    const res = await fetch(`${this.baseUrl}/sdapi/v1/samplers`);
    if (!res.ok) throw new Error(`Forge API error: ${res.status}`);
    return res.json();
  }

  /** Get current generation progress */
  async getProgress(): Promise<ForgeProgressResponse> {
    const res = await fetch(`${this.baseUrl}/sdapi/v1/progress`);
    if (!res.ok) throw new Error(`Forge API error: ${res.status}`);
    return res.json();
  }

  /** Read an image file and return base64 + dimensions */
  async readImage(imagePath: string): Promise<{ base64: string; width: number; height: number }> {
    const buf = await readFile(imagePath);
    const base64 = buf.toString("base64");
    const dims = getImageDimensions(buf);
    return { base64, ...dims };
  }

  /** Save base64 image to file, returns the saved path */
  async saveImage(
    base64Data: string,
    outputFolder: string,
    filename: string
  ): Promise<string> {
    await mkdir(outputFolder, { recursive: true });
    const outputPath = resolve(outputFolder, filename);
    const buf = Buffer.from(base64Data, "base64");
    await writeFile(outputPath, buf);
    return outputPath;
  }

  /** Execute img2img generation */
  async img2img(request: ForgeImg2ImgRequest): Promise<ForgeImg2ImgResponse> {
    const res = await fetch(`${this.baseUrl}/sdapi/v1/img2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Forge img2img failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  /** Build the full img2img request from our queue item data */
  buildRequest(params: {
    sourceImageBase64: string;
    sourceWidth: number;
    sourceHeight: number;
    prompt: string;
    negativePrompt: string;
    settings: GenerationSettings;
    checkpointModel?: string;
  }): ForgeImg2ImgRequest {
    const req: ForgeImg2ImgRequest = {
      init_images: [params.sourceImageBase64],
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      steps: params.settings.steps,
      sampler_name: params.settings.sampler,
      cfg_scale: params.settings.cfg_scale,
      width: params.sourceWidth,
      height: params.sourceHeight,
      denoising_strength: params.settings.denoising_strength,
      n_iter: params.settings.n_iter || 8,
      batch_size: 1,
    };

    // Override checkpoint model if specified
    if (params.checkpointModel) {
      req.override_settings = {
        sd_model_checkpoint: params.checkpointModel,
      };
    }

    // ADetailer if configured
    if (params.settings.adetailer) {
      req.alwayson_scripts = {
        ADetailer: {
          args: [
            true,  // enabled
            false, // skip_img2img
            {
              ad_model: params.settings.adetailer.model,
              ad_prompt: params.settings.adetailer.prompt,
              ad_negative_prompt: params.settings.adetailer.negative_prompt,
            },
          ],
        },
      };
    }

    return req;
  }

  /** Generate output filename from source image path and queue item id */
  makeOutputFilename(sourceImagePath: string, itemId: string): string {
    const ext = extname(sourceImagePath) || ".png";
    const base = basename(sourceImagePath, ext);
    return `${base}_${itemId}${ext}`;
  }
}

/** Read image dimensions from file buffer (PNG/JPEG/WebP) without external deps */
function getImageDimensions(buf: Buffer): { width: number; height: number } {
  // PNG: bytes 16-23
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 marker
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) { offset++; continue; }
      const marker = buf[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      if (marker === 0xd9) break; // EOI
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  // WebP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    if (buf.toString("ascii", 12, 16) === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (buf.toString("ascii", 12, 16) === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  // Fallback
  return { width: 512, height: 768 };
}
