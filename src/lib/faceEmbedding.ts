export type DetectedFace = {
  embedding: number[];
  bbox: { x: number; y: number; width: number; height: number };
  quality_score: number;
};

const MODEL_URIS = [
  "/models/face-api",
  "https://justadudewhohacks.github.io/face-api.js/models",
] as const;

let modelsReadyPromise: Promise<boolean> | null = null;

async function loadModelsFromUri(faceapi: typeof import("@vladmandic/face-api"), uri: string): Promise<void> {
  console.log(`[FaceDetection] Attempting to load models from: ${uri}`);
  await faceapi.nets.tinyFaceDetector.loadFromUri(uri);
  await faceapi.nets.faceLandmark68Net.loadFromUri(uri);
  await faceapi.nets.faceRecognitionNet.loadFromUri(uri);
  console.log(`[FaceDetection] ✅ Successfully loaded all models from: ${uri}`);
}

export async function prepareFaceEmbeddingModels(): Promise<boolean> {
  if (modelsReadyPromise) {
    return modelsReadyPromise;
  }

  modelsReadyPromise = (async () => {
    try {
      console.log("[FaceDetection] Initializing TensorFlow.js...");
      const tf = await import("@tensorflow/tfjs");
      console.log(`[FaceDetection] TensorFlow.js version: ${tf.version.tfjs}`);

      try {
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("[FaceDetection] ✅ Using WebGL backend (GPU acceleration)");
      } catch (webglError) {
        console.warn("[FaceDetection] ⚠️ WebGL backend failed, falling back to CPU:", webglError);
        await tf.setBackend("cpu");
        await tf.ready();
        console.log("[FaceDetection] ⚠️ Using CPU backend (slower performance expected)");
      }

      const faceapi = await import("@vladmandic/face-api");

      for (const uri of MODEL_URIS) {
        try {
          await loadModelsFromUri(faceapi, uri);
          console.log("[FaceDetection] ✅ Face detection models ready!");
          return true;
        } catch (modelError) {
          console.warn(`[FaceDetection] Failed to load from ${uri}:`, modelError);
          // Try next URI
        }
      }

      console.error("[FaceDetection] ❌ Face models could not be loaded from any configured URI");
      return false;
    } catch (error) {
      console.error("[FaceDetection] ❌ Failed to initialize face embedding models:", error);
      return false;
    }
  })();

  return modelsReadyPromise;
}

function fileToImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractFaceEmbeddings(file: File): Promise<DetectedFace[]> {
  const ready = await prepareFaceEmbeddingModels();
  if (!ready) {
    console.error("[FaceDetection] Models not ready, cannot extract faces");
    return [];
  }

  const faceapi = await import("@vladmandic/face-api");
  const image = await fileToImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("[FaceDetection] Failed to get canvas context");
    return [];
  }

  ctx.drawImage(image, 0, 0);

  const detections = await faceapi
    .detectAllFaces(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.45,
      })
    )
    .withFaceLandmarks()
    .withFaceDescriptors();

  console.log(`[FaceDetection] Detected ${detections.length} face(s) in image`);

  if (!detections.length) {
    return [];
  }

  return detections.map((detection) => {
    const box = detection.detection.box;
    const descriptor = Array.from(detection.descriptor);

    // L2 normalize the embedding vector for better cosine similarity
    let norm = 0;
    for (let i = 0; i < descriptor.length; i++) {
      norm += descriptor[i] * descriptor[i];
    }
    norm = Math.sqrt(norm);

    const normalizedDescriptor = norm > 0 ? descriptor.map(v => v / norm) : descriptor;

    return {
      embedding: normalizedDescriptor,
      bbox: {
        x: box.x / canvas.width,
        y: box.y / canvas.height,
        width: box.width / canvas.width,
        height: box.height / canvas.height,
      },
      quality_score: detection.detection.score,
    };
  });
}
