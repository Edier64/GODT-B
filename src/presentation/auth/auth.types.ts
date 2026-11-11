import { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  institutionalIps?: string[];
  sessionId?: string;
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  jti: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  institutionalIps: string[];
}
