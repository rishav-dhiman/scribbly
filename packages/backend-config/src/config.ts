// 🔐 Single source of truth for the JWT signing secret, shared by both backends.
// dotenv loads the .env file from the app's working directory when this is imported.
import "dotenv/config";

// 💥 Fail fast at boot instead of signing/verifying tokens with "undefined"
const secret = process.env.JWT_SECRET;
if (!secret) {
    throw new Error("JWT_SECRET is not set - check your .env file");
}
export const SECRET: string = secret;
