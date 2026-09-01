import axios from "axios";
import crypto from "crypto";
import { envVars } from "../config/env";

interface InitiateResponse {
  status: string;
  status_message?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
  [key: string]: unknown;
}

export const initiateSession = async (
  payload: Record<string, string>
): Promise<InitiateResponse> => {
  const body = new URLSearchParams({
    store_id: envVars.SSL_STORE_ID,
    store_passwd: envVars.SSL_STORE_PASS,
    currency: "BDT",
    ...payload,
  });

  const { data } = await axios.post<InitiateResponse>(
    envVars.SSL_PAYMENT_API,
    body.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    }
  );

  return data;
};

interface ValidationResponse {
  status: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  currency_amount?: string;
  currency_type?: string;
  [key: string]: unknown;
}

export const verifyTransaction = async (
  valId: string
): Promise<ValidationResponse> => {
  const params = new URLSearchParams({
    val_id: valId,
    store_id: envVars.SSL_STORE_ID,
    store_passwd: envVars.SSL_STORE_PASS,
    format: "json",
    v: "1",
  });

  const { data } = await axios.get<ValidationResponse>(
    `${envVars.SSL_VALIDATION_API}?${params.toString()}`,
    { timeout: 15000 }
  );

  return data;
};

export const verifySignature = (
  body: Record<string, string>,
  verifyKey: string | undefined,
  verifySign: string | undefined
): boolean => {
  if (!verifyKey || !verifySign) {
    return false;
  }

  const keys = verifyKey.split(",");

  const data: Record<string, string> = {};
  for (const key of keys) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  data["store_passwd"] = crypto
    .createHash("md5")
    .update(envVars.SSL_STORE_PASS)
    .digest("hex");

  const sortedKeys = Object.keys(data).sort(); // alphabetical, matches PHP ksort

  const signString = sortedKeys.map((key) => `${key}=${data[key]}`).join("&");
  const expected = crypto.createHash("md5").update(signString).digest("hex");

  return expected === verifySign;
};
