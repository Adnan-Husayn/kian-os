import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hash a plaintext password with bcrypt (12 rounds). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Constant-time-ish bcrypt comparison of a plaintext password and a hash. */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
