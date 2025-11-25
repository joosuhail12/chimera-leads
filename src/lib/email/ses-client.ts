import { SESv2Client } from "@aws-sdk/client-sesv2";

let cachedClient: SESv2Client | null = null;

function getRegion() {
  return process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1";
}

export function getSesClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const region = getRegion();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  cachedClient = new SESv2Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined,
  });

  return cachedClient;
}
