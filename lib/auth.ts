import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { hasDb, sql } from "@/lib/db";
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
  return { id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatarHue };
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

/**
 * Find or create a client-role portal account for a booking lead who has no
 * login yet. There's no typed password — access starts from the activation
 * link (a createSession token) emailed right after booking; the random hash
 * here is just a placeholder so password_hash's NOT NULL is satisfied.
 */
export async function findOrCreatePortalUser(input: {
  name: string;
  email: string;
  phone?: string | null;
}): Promise<{ user: SessionUser; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (hasDb) {
    const existing = (await sql`
      SELECT id, role, name, email, avatar_hue FROM users WHERE email = ${email} AND deleted_at IS NULL
    `) as Array<Omit<UserRow, "password_hash">>;
    if (existing[0]) {
      const u = existing[0];
      return { user: toSessionUser({ id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatar_hue }), created: false };
    }
    const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
    const avatarHue = AVATAR_HUES[Math.floor(Math.random() * AVATAR_HUES.length)];
    const rows = (await sql`
      INSERT INTO users (role, name, email, password_hash, avatar_hue, phone)
      VALUES ('client', ${input.name}, ${email}, ${passwordHash}, ${avatarHue}, ${input.phone ?? null})
      RETURNING id, role, name, email, avatar_hue
    `) as Array<Omit<UserRow, "password_hash">>;
    const u = rows[0];
    return { user: toSessionUser({ id: u.id, role: u.role, name: u.name, email: u.email, avatarHue: u.avatar_hue }), created: true };
  }
  const store = mockStore();
  const existing = [...store.users.values()].find((x) => x.email === email && !x.deletedAt);
  if (existing) return { user: toSessionUser(existing), created: false };
  const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
  const now = new Date().toISOString();
  const user: User = {
    id: mockId(),
    role: "client",
    name: input.name,
    email,
    passwordHash,
    avatarHue: AVATAR_HUES[Math.floor(Math.random() * AVATAR_HUES.length)],
    phone: input.phone ?? null,
    timezone: null,
    slug: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  store.users.set(user.id, user);
  return { user: toSessionUser(user), created: true };
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
