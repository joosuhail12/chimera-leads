import {
  CreateEmailIdentityCommand,
  GetEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

// Initialize SES client
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Trigger email address verification
 * AWS will send a verification email to this address
 */
export async function verifyEmailIdentity(email: string): Promise<void> {
  try {
    const command = new CreateEmailIdentityCommand({
      EmailIdentity: email,
    });
    await sesClient.send(command);
  } catch (error) {
    console.error("Error verifying email identity:", error);
    throw new Error("Failed to trigger email verification");
  }
}

/**
 * Trigger domain verification
 * Returns the verification token that needs to be added as a TXT record
 * Note: SESv2 mainly uses DKIM for domain verification, but we'll return DKIM tokens here.
 */
export async function verifyDomainIdentity(domain: string): Promise<string> {
  try {
    const command = new CreateEmailIdentityCommand({
      EmailIdentity: domain,
    });
    const response = await sesClient.send(command);
    // SESv2 doesn't return a simple verification token like v1. 
    // It returns DKIM tokens. We'll handle this in getDomainDkimTokens.
    // For backward compatibility with the existing function signature, we return empty string.
    return "";
  } catch (error) {
    console.error("Error verifying domain identity:", error);
    throw new Error("Failed to trigger domain verification");
  }
}

/**
 * Get DKIM tokens for domain
 * These need to be added as CNAME records
 */
export async function getDomainDkimTokens(domain: string): Promise<string[]> {
  try {
    const command = new GetEmailIdentityCommand({
      EmailIdentity: domain,
    });
    const response = await sesClient.send(command);
    return response.DkimAttributes?.Tokens || [];
  } catch (error) {
    console.error("Error getting DKIM tokens:", error);
    throw new Error("Failed to get DKIM tokens");
  }
}

/**
 * Check verification status of an email or domain
 */
export async function checkVerificationStatus(identity: string): Promise<{
  verified: boolean;
  status: string;
}> {
  try {
    const command = new GetEmailIdentityCommand({
      EmailIdentity: identity,
    });
    const response = await sesClient.send(command);

    const isVerified = response.VerifiedForSendingStatus === true;
    const status = isVerified ? "Success" : "Pending"; // Simplified mapping

    return {
      verified: isVerified,
      status: status,
    };
  } catch (error) {
    console.error("Error checking verification status:", error);
    throw new Error("Failed to check verification status");
  }
}

/**
 * Delete an identity from SES
 */
export async function deleteIdentity(identity: string): Promise<void> {
  try {
    const command = new DeleteEmailIdentityCommand({
      EmailIdentity: identity,
    });
    await sesClient.send(command);
  } catch (error) {
    console.error("Error deleting identity:", error);
    throw new Error("Failed to delete identity");
  }
}

/**
 * Verify an email or domain based on whether it contains @ symbol
 * Returns DKIM tokens if it's a domain
 */
export async function verifyEmailOrDomain(emailOrDomain: string): Promise<{
  type: "email" | "domain";
  verificationToken?: string;
  dkimTokens?: string[];
}> {
  const isEmail = emailOrDomain.includes("@");

  if (isEmail) {
    await verifyEmailIdentity(emailOrDomain);
    return { type: "email" };
  } else {
    // For domains, we create identity and fetch DKIM tokens
    // In SESv2, CreateEmailIdentity returns DKIM tokens immediately
    try {
      const command = new CreateEmailIdentityCommand({
        EmailIdentity: emailOrDomain,
      });
      const response = await sesClient.send(command);
      const dkimTokens = response.DkimAttributes?.Tokens || [];

      return {
        type: "domain",
        verificationToken: "", // Not used in SESv2 same way
        dkimTokens,
      };
    } catch (error) {
      // If already exists, just get tokens
      const dkimTokens = await getDomainDkimTokens(emailOrDomain);
      return {
        type: "domain",
        verificationToken: "",
        dkimTokens,
      };
    }
  }
}