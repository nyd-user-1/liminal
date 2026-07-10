import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { hasDb, sql } from "@/lib/db";
import { headshotFor } from "@/lib/headshots";
import { mockId, mockStore } from "@/lib/mock";
import type { AvatarHue, Role, User } from "@/lib/types";

// Cookie-session auth. With a DB: users + sessions tables, bcrypt hashes.
// Without: the seeded demo users in lib/mock (brendan@liminal.demo /
// casey@liminal.demo, password "demo") and an in-memory sessions map.

export const SESSION_COOKIE = "liminal_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  avatarHue: AvatarHue;
  photoUrl: string | null;
}

/** Thrown by requireUser/requireRole; API routes map it to a JSON response. */
export class AuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

type UserRow = {
  id: string;
  role: Role;
  name: string;
  email: string;
  password_hash: string;
  avatar_hue: AvatarHue;
};

function toSessionUser(u: { id: string; role: Role; name: string; email: string; avatarHue: AvatarHue }): SessionUser {
  return { id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatarHue, photoUrl: headshotFor(u.id) };
}

/** Check email/password against the users table (or mock users). */
export async function verifyCredentials(email: string, password: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return null;
  if (hasDb) {
    const rows = (await sql`
      SELECT id, role, name, email, password_hash, avatar_hue
      FROM users WHERE email = ${normalized} AND deleted_at IS NULL
    `) as UserRow[];
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) return null;
    return toSessionUser({ id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatar_hue });
  }
  const u = [...mockStore().users.values()].find((x) => x.email === normalized && !x.deletedAt);
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return null;
  return toSessionUser(u);
}

/** Create a session row and return the cookie value + expiry. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  if (hasDb) {
    await sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt.toISOString()})`;
  } else {
    mockStore().sessions.set(token, { token, userId, expiresAt: expiresAt.toISOString() });
  }
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  if (hasDb) await sql`DELETE FROM sessions WHERE token = ${token}`;
  else mockStore().sessions.delete(token);
}

const AVATAR_HUES: AvatarHue[] = ["teal", "amber", "pink", "blue"];

// ── portal account lifecycle ────────────────────────────────────────────────
// Booking with a new email creates a client + a portal login (unusable random
// password) and emails a one-time set-password link (see createPasswordToken
// / consumePasswordToken below); "forgot password" reuses the same token
// flow with purpose "reset". The emailed token is never itself a session
// credential — it only ever unlocks setting a real password, then a fresh
// session is minted through the normal login path. That's deliberate: unlike
// a magic link built on a live session token, a leaked/pre-fetched email
// (mail relay logs, browser history, a security scanner that follows links)
// can't hand over standing account access — the token is single-use and can
// only set a password, nothing else.

export async function findUserByEmail(email: string): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (hasDb) {
    const rows = (await sql`
      SELECT id, role, name, email, avatar_hue FROM users
      WHERE email = ${normalized} AND deleted_at IS NULL
    `) as Array<Omit<UserRow, "password_hash">>;
    const u = rows[0];
    return u ? toSessionUser({ id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatar_hue }) : null;
  }
  const u = [...mockStore().users.values()].find((x) => x.email === normalized && !x.deletedAt);
  return u ? toSessionUser(u) : null;
}

/**
 * Ensure a booking lead has a portal login: create a client-role user with an
 * unusable random password hash (real password comes later via
 * createPasswordToken) and link clients.user_id. Returns null when the email
 * already belongs to a non-client user.
 */
export async function ensureClientPortalUser(input: {
  clientId: string;
  email: string;
  name: string;
  phone?: string | null;
}): Promise<{ userId: string; created: boolean } | null> {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) return existing.role === "client" ? { userId: existing.id, created: false } : null;

  const unusable = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const avatarHue = AVATAR_HUES[Math.floor(Math.random() * AVATAR_HUES.length)];
  if (hasDb) {
    const rows = (await sql`
      INSERT INTO users (role, name, email, password_hash, avatar_hue, phone)
      VALUES ('client', ${input.name}, ${email}, ${unusable}, ${avatarHue}, ${input.phone ?? null})
      RETURNING id
    `) as Array<{ id: string }>;
    await sql`UPDATE clients SET user_id = ${rows[0].id}, updated_at = now() WHERE id = ${input.clientId} AND user_id IS NULL`;
    return { userId: rows[0].id, created: true };
  }
  const store = mockStore();
  const client = store.clients.get(input.clientId);
  if (!client) return null;
  const now = new Date().toISOString();
  const user: User = {
    id: mockId(),
    role: "client",
    name: input.name,
    email,
    passwordHash: unusable,
    avatarHue,
    phone: input.phone ?? null,
    timezone: null,
    slug: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  store.users.set(user.id, user);
  if (!client.userId) store.clients.set(client.id, { ...client, userId: user.id, updatedAt: now });
  return { userId: user.id, created: true };
}

const TOKEN_TTL_H = { set: 7 * 24, reset: 2 } as const;

/** Mint a one-time set/reset-password token and return the raw token (caller builds the URL). */
export async function createPasswordToken(userId: string, purpose: "set" | "reset"): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_H[purpose] * 60 * 60 * 1000).toISOString();
  if (hasDb) {
    await sql`INSERT INTO password_tokens (token, user_id, purpose, expires_at) VALUES (${token}, ${userId}, ${purpose}, ${expiresAt})`;
  } else {
    mockStore().passwordTokens.set(token, {
      token,
      userId,
      purpose,
      expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString(),
    });
  }
  return token;
}

/** Validate + burn a token; returns the user id, or null when invalid/expired/already used. */
export async function consumePasswordToken(token: string): Promise<string | null> {
  if (!token) return null;
  if (hasDb) {
    const rows = (await sql`
      UPDATE password_tokens SET used_at = now()
      WHERE token = ${token} AND used_at IS NULL AND expires_at > now()
      RETURNING user_id
    `) as Array<{ user_id: string }>;
    return rows[0]?.user_id ?? null;
  }
  const t = mockStore().passwordTokens.get(token);
  if (!t || t.usedAt || new Date(t.expiresAt) < new Date()) return null;
  mockStore().passwordTokens.set(token, { ...t, usedAt: new Date().toISOString() });
  return t.userId;
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  if (hasDb) {
    await sql`UPDATE users SET password_hash = ${hash}, updated_at = now() WHERE id = ${userId}`;
    return;
  }
  const u = mockStore().users.get(userId);
  if (u) mockStore().users.set(userId, { ...u, passwordHash: hash, updatedAt: new Date().toISOString() });
}

/** Session user from the request cookie, or null. */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (hasDb) {
    const rows = (await sql`
      SELECT u.id, u.role, u.name, u.email, u.avatar_hue
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > now() AND u.deleted_at IS NULL
    `) as Array<Omit<UserRow, "password_hash">>;
    const u = rows[0];
    return u ? toSessionUser({ id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatar_hue }) : null;
  }
  const session = mockStore().sessions.get(token);
  if (!session || new Date(session.expiresAt) < new Date()) return null;
  const u = mockStore().users.get(session.userId);
  return u && !u.deletedAt ? toSessionUser(u) : null;
}

/** Guard: signed-in user or 401. Call at the top of every API route/page loader. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new AuthError("Sign in required.", 401);
  return user;
}

/**
 * Guard: signed-in user with one of `roles`, or 401/403.
 * "admin" also satisfies a "practitioner" requirement (staff superuser).
 */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  const ok = roles.includes(user.role) || (user.role === "admin" && roles.includes("practitioner"));
  if (!ok) throw new AuthError(`This action requires the ${roles.join(" or ")} role.`, 403);
  return user;
}
