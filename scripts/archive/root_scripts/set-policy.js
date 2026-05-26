const { S3Client, PutBucketPolicyCommand } = require("@aws-sdk/client-s3");
require('dotenv').config({ path: '.env.local' });

async function setPolicy() {
  const bucketName = process.env.AWS_S3_BUCKET_NAME || 'fmc-gallery-images-production';
  const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'ap-south-1';

  console.log(`Setting public read policy for bucket: ${bucketName} in ${region}...`);

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  });

  const readOnlyPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucketName}/*`
      }
    ]
  };

  try {
    await s3.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(readOnlyPolicy)
    }));
    console.log("✅ Success! The bucket policy has been applied. Images are now readable.");
  } catch (error) {
    console.error("❌ Failed to set policy:");
    console.error(error.message);
  }
}

setPolicy();
