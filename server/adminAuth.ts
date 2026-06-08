import crypto from "node:crypto";
import type { Request, Response } from "express";

const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map<string, number>();

export function isAdminAuthEnabled() {
  return Boolean(process.env.OWNER_PASSWORD || process.env.ADMIN_PASSWORD);
}

export function getAdminAuthStatus(request: Request) {
  if (!isAdminAuthEnabled()) return { required: false, authenticated: true, ownerEmail: getOwnerEmail() };
  return { required: true, authenticated: isValidAdminSession(request), ownerEmail: getOwnerEmail() };
}

export function createAdminSession({ email, password }: { email?: string; password: string }) {
  if (!isAdminAuthEnabled()) return { required: false, authenticated: true, ownerEmail: getOwnerEmail() };
  const ownerEmail = getOwnerEmail();
  const emailMatches = !ownerEmail || !email || email.trim().toLowerCase() === ownerEmail.toLowerCase();
  const passwordMatches = password === (process.env.OWNER_PASSWORD || process.env.ADMIN_PASSWORD);
  if (!emailMatches || !passwordMatches) return { required: true, authenticated: false, ownerEmail };
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + sessionTtlMs);
  return { required: true, authenticated: true, token, ownerEmail };
}

export function requireAdminSession(request: Request, response: Response) {
  if (!isAdminAuthEnabled()) return true;
  if (isValidAdminSession(request)) return true;
  response.status(401).json({ error: "Admin login required." });
  return false;
}

function getOwnerEmail() {
  return process.env.OWNER_EMAIL?.trim() || "";
}

function isValidAdminSession(request: Request) {
  const header = request.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}
