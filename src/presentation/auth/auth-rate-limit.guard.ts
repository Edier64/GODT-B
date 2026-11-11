import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

interface RateBucket {
  count: number;
  resetAt: number;
}

const MAX_RATE_BUCKETS = 10_000;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly maxAttempts: number;
  private readonly maxAttemptsPerIp: number;
  private readonly windowMs: number;
  private readonly enabled: boolean;
  private readonly trustProxy: boolean;

  constructor(private readonly config: ConfigService) {
    const maxRaw = Number(this.config.get<string>("AUTH_RATE_LIMIT_MAX", "10"));
    const ipMaxRaw = Number(this.config.get<string>("AUTH_RATE_LIMIT_IP_MAX", "30"));
    const winRaw = Number(this.config.get<string>("AUTH_RATE_LIMIT_WINDOW_MS", "60000"));
    this.maxAttempts = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 10;
    this.maxAttemptsPerIp =
      Number.isFinite(ipMaxRaw) && ipMaxRaw >= this.maxAttempts
        ? ipMaxRaw
        : this.maxAttempts * 3;
    this.windowMs = Number.isFinite(winRaw) && winRaw > 0 ? winRaw : 60_000;
    this.enabled = this.config.get<string>("AUTH_RATE_LIMIT_ENABLED", "true") !== "false";
    this.trustProxy =
      (this.config.get<string>("TRUST_PROXY", "false") || "false").trim().toLowerCase() === "true";
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const forwardedFor = this.trustProxy
      ? (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      : undefined;
    const ip = forwardedFor || req.ip || req.socket?.remoteAddress || "unknown";
    const bodyEmail =
      req.body && typeof req.body === "object" && typeof (req.body as Record<string, unknown>).email === "string"
        ? ((req.body as Record<string, unknown>).email as string).trim().toLowerCase()
        : "";
    const emailKey = `${req.path}:${ip}:${bodyEmail || "anon"}`;
    const ipKey = `${req.path}:ip:${ip}`;

    const now = Date.now();
    this.pruneExpired(now);

    this.consumeBucket(ipKey, this.maxAttemptsPerIp, now);
    this.consumeBucket(emailKey, this.maxAttempts, now);
    return true;
  }

  private consumeBucket(key: string, limit: number, now: number): void {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      if (this.buckets.size >= MAX_RATE_BUCKETS) {
        const oldestKey = this.buckets.keys().next().value;
        if (oldestKey) {
          this.buckets.delete(oldestKey);
        }
      }
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    if (existing.count >= limit) {
      throw new HttpException(
        "Demasiados intentos de autenticación. Espere unos segundos antes de intentar nuevamente.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
  }

  private pruneExpired(now: number): void {
    if (this.buckets.size < 500) {
      return;
    }
    for (const [k, v] of this.buckets.entries()) {
      if (v.resetAt <= now) {
        this.buckets.delete(k);
      }
    }
  }
}

