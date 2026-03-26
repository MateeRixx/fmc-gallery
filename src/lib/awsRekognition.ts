import {
  CreateCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition";

const awsRegion = process.env.AWS_REGION || "us-east-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const collectionId = process.env.AWS_REKOGNITION_COLLECTION_ID || "fmc-gallery-faces";

function createRekognitionClient() {
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials missing: set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
  }

  return new RekognitionClient({
    region: awsRegion,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getAwsCollectionId() {
  return collectionId;
}

export async function ensureCollectionExists() {
  const rekognition = createRekognitionClient();
  try {
    await rekognition.send(
      new CreateCollectionCommand({
        CollectionId: collectionId,
      })
    );
    return { created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Check for various forms of "collection already exists" errors
    if (
      message.includes("ResourceAlreadyExistsException") ||
      message.includes("already exists") ||
      (error as any)?.name === "ResourceAlreadyExistsException"
    ) {
      return { created: false };
    }
    throw error;
  }
}

export type IndexedAwsFace = {
  awsFaceId: string;
  bbox: { x: number; y: number; width: number; height: number };
  qualityScore: number;
};

export async function indexFacesFromImageBytes(params: {
  imageBytes: Uint8Array;
  externalImageId: string;
  maxFaces?: number;
}) {
  const rekognition = createRekognitionClient();
  await ensureCollectionExists();

  const response = await rekognition.send(
    new IndexFacesCommand({
      CollectionId: collectionId,
      Image: { Bytes: params.imageBytes },
      ExternalImageId: params.externalImageId,
      MaxFaces: params.maxFaces ?? 10,
      QualityFilter: "AUTO",
      DetectionAttributes: [],
    })
  );

  const faces: IndexedAwsFace[] = (response.FaceRecords || [])
    .map((record) => {
      const face = record.Face;
      if (!face?.FaceId) return null;

      return {
        awsFaceId: face.FaceId,
        bbox: {
          x: face.BoundingBox?.Left ?? 0,
          y: face.BoundingBox?.Top ?? 0,
          width: face.BoundingBox?.Width ?? 0,
          height: face.BoundingBox?.Height ?? 0,
        },
        qualityScore: (record.FaceDetail?.Confidence ?? face.Confidence ?? 0) / 100,
      };
    })
    .filter((row): row is IndexedAwsFace => row !== null);

  return faces;
}

export async function searchFacesByFaceId(params: {
  awsFaceId: string;
  similarityThreshold: number;
  maxFaces?: number;
}) {
  const rekognition = createRekognitionClient();

  const response = await rekognition.send(
    new SearchFacesCommand({
      CollectionId: collectionId,
      FaceId: params.awsFaceId,
      FaceMatchThreshold: params.similarityThreshold,
      MaxFaces: params.maxFaces ?? 100,
    })
  );

  return (response.FaceMatches || [])
    .map((match) => {
      const matchedFaceId = match.Face?.FaceId;
      const similarity = match.Similarity;
      if (!matchedFaceId || typeof similarity !== "number") {
        return null;
      }

      return {
        awsFaceId: matchedFaceId,
        similarity,
      };
    })
    .filter((row): row is { awsFaceId: string; similarity: number } => row !== null);
}
