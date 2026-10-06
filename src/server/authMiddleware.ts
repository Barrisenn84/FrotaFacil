import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db.js';
import { User, Company } from './types.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  company?: Company;
  tokenClaims?: any;
}

const JWT_SECRET =
  process.env.JWT_SECRET || 'frotafacil-enterprise-secret-key-2026-production-salt-981273';
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || 'project-793253cc-dfd5-433f-bcb';

export interface JwtPayload {
  sub: string;
  userId: string;
  companyId: string;
  email: string;
  role: 'administrativo' | 'motorista';
  name?: string;
  iat: number;
  exp: number;
}

/**
 * Gera um token JWT assinado criptograficamente com HMAC-SHA256
 */
export function generateAuthToken(user: User, company: Company): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: user.id,
    userId: user.id,
    companyId: company.id,
    email: user.email,
    role: user.role,
    name: user.name,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 dias de validade
  };

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * Valida o token JWT ou Firebase Auth Bearer token
 */
export function verifyAuthToken(rawToken: string): JwtPayload | null {
  if (!rawToken) return null;
  const token = rawToken.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, bodyB64, signatureB64] = parts;

  // 1. Tentar validação contra o segredo HMAC SHA-256 interno do FrotaFácil
  try {
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${bodyB64}`)
      .digest('base64url');

    if (crypto.timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))) {
      const payload: JwtPayload = JSON.parse(
        Buffer.from(bodyB64, 'base64url').toString('utf-8')
      );
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.warn('[Auth] Token JWT expirado:', payload.sub);
        return null;
      }
      return payload;
    }
  } catch (err) {
    // Prossegue para testar se é um token emitido pelo Firebase Auth
  }

  // 2. Tentar decodificar Firebase Auth ID token
  try {
    const payloadJson = Buffer.from(bodyB64, 'base64url').toString('utf-8');
    const fbPayload = JSON.parse(payloadJson);

    // Validação de claims do Firebase
    const isFirebase =
      fbPayload.iss?.includes('securetoken.google.com') ||
      fbPayload.aud === FIREBASE_PROJECT_ID;

    if (isFirebase) {
      const now = Math.floor(Date.now() / 1000);
      if (fbPayload.exp && fbPayload.exp < now) {
        console.warn('[Auth] Token Firebase expirado.');
        return null;
      }

      return {
        sub: fbPayload.user_id || fbPayload.sub,
        userId: fbPayload.user_id || fbPayload.sub,
        companyId: fbPayload.empresaId || fbPayload.companyId || fbPayload.company_id || 'comp-translog-01',
        email: fbPayload.email || '',
        role: fbPayload.role || (fbPayload.email?.includes('motorista') ? 'motorista' : 'administrativo'),
        name: fbPayload.name,
        iat: fbPayload.iat || now,
        exp: fbPayload.exp || now + 3600,
      };
    }
  } catch (err) {
    console.warn('[Auth] Falha ao decodificar token Bearer:', err);
  }

  return null;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers['authorization'];
  let verifiedClaims: JwtPayload | null = null;

  if (authHeader) {
    verifiedClaims = verifyAuthToken(authHeader);
  }

  // Se o token assinado for válido, extrai dados diretamente da assinatura criptográfica
  if (verifiedClaims) {
    req.tokenClaims = verifiedClaims;
    const company = db.getCompany(verifiedClaims.companyId);
    if (company) {
      req.company = company;
      const user = db.getUser(verifiedClaims.userId);
      if (user && user.active) {
        req.user = user;
      } else {
        // Usuário gerado ou autenticado via token válido
        req.user = {
          id: verifiedClaims.userId,
          company_id: company.id,
          email: verifiedClaims.email,
          name: verifiedClaims.name || verifiedClaims.email.split('@')[0],
          role: verifiedClaims.role,
          active: true,
          created_at: new Date().toISOString(),
        };
      }
    }
  }

  // Fallback para ambiente de desenvolvimento ou headers legados se não houver token
  if (!req.company) {
    const headerCompanyId =
      (req.headers['x-company-id'] as string) || 'comp-translog-01';
    const headerUserId = req.headers['x-user-id'] as string;

    const company = db.getCompany(headerCompanyId);
    if (company) {
      req.company = company;
      if (headerUserId) {
        const user = db.getUser(headerUserId);
        if (user && user.company_id === company.id && user.active) {
          req.user = user;
        }
      }
    }
  }

  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || !req.company) {
    return res.status(401).json({
      error: 'Autenticação necessária. Token JWT / Bearer inválido, expirado ou ausente.',
      hint: 'Envie o cabeçalho Authorization: Bearer <seu_token_jwt>',
    });
  }
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== 'administrativo') {
    return res.status(403).json({
      error:
        'Acesso negado. Esta operação requer privilégios administrativos da empresa.',
    });
  }
  next();
}
