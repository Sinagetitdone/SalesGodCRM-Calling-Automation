import { timingSafeEqual } from "node:crypto";

export function verifyBearerToken(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  if (!authorizationHeader?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorizationHeader.slice(7), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");

  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}
