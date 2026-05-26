const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");
require('dotenv').config({ path: '.env.local' });

async function setCors() {
  const bucketName = process.env.AWS_S3_BUCKET_NAME || 'fmc-gallery-images-production';
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'ap-south-1';

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  const corsRules = {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "HEAD"],
        AllowedOrigins: ["*"],
        ExposeHeaders: []
      }
    ]
  };

  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: corsRules
    }));
    console.log("✅ Success! CORS rules applied to bucket.");
  } catch (error) {
    console.error("❌ Failed to set CORS:");
    console.error(error);
  }
}
setCors();
