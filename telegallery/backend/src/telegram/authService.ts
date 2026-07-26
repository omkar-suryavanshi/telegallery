import { Api, TelegramClient } from "telegram";
import { computeCheck } from "telegram/Password";
import { StringSession } from "telegram/sessions";
import { env } from "../config/env";
import {
  createPendingClient,
  detachPendingLogin,
  discardPendingLogin,
  getPendingLogin,
  registerPendingLogin,
} from "./clientRegistry";

export class TwoFactorRequiredError extends Error {
  constructor(public loginToken: string) {
    super("Two-factor password required");
  }
}

export interface LoginResult {
  sessionString: string;
  userId: string; // Telegram user id
  phone: string;
  /** Live, authenticated client — caller is responsible for calling client.disconnect() when done. */
  client: TelegramClient;
}

/**
 * Step 1: send an OTP code to the given phone number.
 * Returns a loginToken the frontend must pass to the verify step.
 */
export async function sendLoginCode(phone: string): Promise<{ loginToken: string }> {
  const client = createPendingClient();
  await client.connect();

  const result = await client.sendCode(
    { apiId: env.TELEGRAM_API_ID, apiHash: env.TELEGRAM_API_HASH },
    phone
  );

  const loginToken = registerPendingLogin(client, phone, result.phoneCodeHash);
  return { loginToken };
}

/**
 * Step 2: verify the OTP. If the account has 2FA enabled, throws
 * TwoFactorRequiredError — the caller should then call verifyPassword() with the
 * same loginToken and the user's cloud password.
 */
export async function verifyLoginCode(loginToken: string, code: string): Promise<LoginResult> {
  const pending = getPendingLogin(loginToken);
  if (!pending) throw new Error("Login session expired or not found. Please request a new code.");

  try {
    const result = await pending.client.invoke(
      new Api.auth.SignIn({
        phoneNumber: pending.phone,
        phoneCodeHash: pending.phoneCodeHash,
        phoneCode: code,
      })
    );

    return finalizeLogin(loginToken, result);
  } catch (err: any) {
    if (err?.errorMessage === "SESSION_PASSWORD_NEEDED") {
      // Do NOT discard the pending client — we need it for the password step.
      throw new TwoFactorRequiredError(loginToken);
    }
    discardPendingLogin(loginToken);
    throw err;
  }
}

/**
 * Step 3 (only if the account has Two-Step Verification enabled): verify the
 * cloud password using Telegram's SRP protocol.
 */
export async function verifyLoginPassword(loginToken: string, password: string): Promise<LoginResult> {
  const pending = getPendingLogin(loginToken);
  if (!pending) throw new Error("Login session expired or not found. Please request a new code.");

  try {
    const passwordInfo = await pending.client.invoke(new Api.account.GetPassword());
    const srpCheck = await computeCheck(passwordInfo, password);
    const result = await pending.client.invoke(new Api.auth.CheckPassword({ password: srpCheck }));
    return finalizeLogin(loginToken, result);
  } catch (err) {
    discardPendingLogin(loginToken);
    throw err;
  }
}

function finalizeLogin(loginToken: string, authResult: any): LoginResult {
  const pendingBeforeDetach = getPendingLogin(loginToken)!;
  const phone = pendingBeforeDetach.phone;

  // Detach from the pending map WITHOUT disconnecting — the caller now owns this
  // authenticated client for the rest of the request (e.g. to create the storage channel).
  const client = detachPendingLogin(loginToken)!;
  const sessionString = (client.session as StringSession).save() as unknown as string;
  const user = authResult.user;

  return {
    sessionString,
    userId: user.id.toString(),
    phone,
    client,
  };
}
