import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Session, User } from "@supabase/supabase-js";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";
import { createSupabaseUserClient, isSupabaseAuthConfigured } from "@/lib/supabase-auth";
import type { AppRole, AuthenticatedUser, TeamMember } from "@/lib/types";

export const AUTH_ACCESS_COOKIE = "search_leeds_access_token";
export const AUTH_REFRESH_COOKIE = "search_leeds_refresh_token";

type TeamMemberRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type AppSession = {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  user: User;
  member: AuthenticatedUser;
};

function mapTeamMemberRow(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAuthenticatedUser(member: TeamMember): AuthenticatedUser {
  return {
    id: member.id,
    email: member.email,
    fullName: member.fullName,
    role: member.role,
    isActive: member.isActive,
    mustChangePassword: member.mustChangePassword,
  };
}

function extractDisplayName(user: User) {
  const email = user.email?.trim().toLowerCase() || "";
  const metadataName =
    String(user.user_metadata?.full_name || user.user_metadata?.name || "")
      .trim()
      .replace(/\s+/g, " ") || "";

  if (metadataName) {
    return metadataName;
  }

  if (email.includes("@")) {
    return email.split("@")[0];
  }

  return "Usuario";
}

export async function resolveAuthorizedMember(user: User): Promise<AuthenticatedUser | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data: memberRow, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<TeamMemberRow>();

  if (error) {
    throw error;
  }

  if (memberRow) {
    return mapAuthenticatedUser(mapTeamMemberRow(memberRow));
  }

  const { count, error: countError } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    return null;
  }

  const { data: createdRow, error: createError } = await supabase
    .from("team_members")
    .insert([
      {
        id: user.id,
        email: user.email?.trim().toLowerCase() || "",
        full_name: extractDisplayName(user),
        role: "admin",
        is_active: true,
        must_change_password: false,
      },
    ])
    .select("*")
    .single<TeamMemberRow>();

  if (createError) {
    throw createError;
  }

  return mapAuthenticatedUser(mapTeamMemberRow(createdRow));
}

export function isAuthReady() {
  return isSupabaseConfigured() && isSupabaseAuthConfigured();
}

export async function getAppSession(): Promise<AppSession | null> {
  if (!isAuthReady()) {
    return null;
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_ACCESS_COOKIE)?.value || "";
  const refreshToken = cookieStore.get(AUTH_REFRESH_COOKIE)?.value || "";

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  const member = await resolveAuthorizedMember(data.user);

  if (!member || !member.isActive) {
    return null;
  }

  return {
    userId: data.user.id,
    accessToken,
    refreshToken: refreshToken || undefined,
    user: data.user,
    member,
  };
}

export async function requireAppSession() {
  const session = await getAppSession();

  if (!session) {
    throw new Error("AUTH_REQUIRED");
  }

  return session;
}

export function requireRole(session: AppSession, role: AppRole) {
  if (session.member.role !== role) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireAppSession();
  return requireRole(session, "admin");
}

export async function requireLeadAccess(leadId: string) {
  const session = await requireAppSession();
  const supabase = createSupabaseUserClient(session.accessToken);
  const { data, error } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

export function setAuthCookies(response: NextResponse, session: Session) {
  const isProduction = process.env.NODE_ENV === "production";
  const accessMaxAge = session.expires_in ? Math.max(session.expires_in, 60 * 30) : 60 * 60 * 8;
  const refreshMaxAge = 60 * 60 * 24 * 30;

  response.cookies.set(AUTH_ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: accessMaxAge,
  });

  response.cookies.set(AUTH_REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(AUTH_ACCESS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(AUTH_REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
