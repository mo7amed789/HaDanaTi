import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database';

export const JWT_SECRET = process.env.JWT_SECRET || 'hadanaty-super-secure-jwt-secret-cairo-2026';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isPlatformOwner: boolean;
  activeMembership?: {
    id: string;
    nurseryId: string;
    nurseryName: string;
    role: 'admin' | 'teacher' | 'parent';
  };
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  nurseryId?: string;
  membership?: {
    id: string;
    nurseryId: string;
    role: 'admin' | 'teacher' | 'parent';
  };
}

export function generateToken(payload: { userId: string; activeNurseryId?: string; activeRole?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.hadanaty_token) {
    token = req.cookies.hadanaty_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      activeNurseryId?: string;
      activeRole?: string;
    };

    const user = db.prepare(`
      SELECT id, email, full_name, phone, is_platform_owner
      FROM users
      WHERE id = ?
    `).get(decoded.userId) as {
      id: string;
      email: string;
      full_name: string;
      phone: string;
      is_platform_owner: number;
    } | undefined;

    if (!user) {
      return res.status(401).json({ error: 'المستخدم غير موجود' });
    }

    // Resolve user's active membership
    let activeMembership: AuthenticatedUser['activeMembership'] = undefined;
    if (decoded.activeNurseryId && decoded.activeRole) {
      const membership = db.prepare(`
        SELECT m.id, m.nursery_id, m.role, n.name as nursery_name
        FROM nursery_memberships m
        JOIN nurseries n ON n.id = m.nursery_id
        WHERE m.user_id = ? AND m.nursery_id = ? AND m.role = ? AND m.is_active = 1
      `).get(user.id, decoded.activeNurseryId, decoded.activeRole) as {
        id: string;
        nursery_id: string;
        role: 'admin' | 'teacher' | 'parent';
        nursery_name: string;
      } | undefined;

      if (membership) {
        activeMembership = {
          id: membership.id,
          nurseryId: membership.nursery_id,
          nurseryName: membership.nursery_name,
          role: membership.role,
        };
      }
    }

    // If no active membership in token or it's invalid, pick the user's first available active membership
    if (!activeMembership && !user.is_platform_owner) {
      const firstMembership = db.prepare(`
        SELECT m.id, m.nursery_id, m.role, n.name as nursery_name
        FROM nursery_memberships m
        JOIN nurseries n ON n.id = m.nursery_id
        WHERE m.user_id = ? AND m.is_active = 1
        LIMIT 1
      `).get(user.id) as {
        id: string;
        nursery_id: string;
        role: 'admin' | 'teacher' | 'parent';
        nursery_name: string;
      } | undefined;

      if (firstMembership) {
        activeMembership = {
          id: firstMembership.id,
          nurseryId: firstMembership.nursery_id,
          nurseryName: firstMembership.nursery_name,
          role: firstMembership.role,
        };
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      isPlatformOwner: Boolean(user.is_platform_owner),
      activeMembership,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'جلسة الدخول منتهية الصلاحية أو غير صالحة' });
  }
}

/**
 * Enforces platform owner access (e.g. managing nurseries, plans, SaaS subscriptions).
 * Note: Platform owners DO NOT have automatic read/write access to private child data!
 */
export function requirePlatformOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isPlatformOwner) {
    return res.status(403).json({ error: 'هذا الإجراء مخصص لمدير المنصة فقط' });
  }
  next();
}

/**
 * Strictly isolates tenant access. Verifies that the user has an active membership
 * in the target nursery with one of the allowed roles.
 */
export function requireNurseryRole(allowedRoles: Array<'admin' | 'teacher' | 'parent'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
    }

    // Determine target nursery ID from params, headers, or query
    const targetNurseryId =
      req.params.nurseryId ||
      (req.headers['x-nursery-id'] as string) ||
      (req.query.nurseryId as string) ||
      req.user.activeMembership?.nurseryId;

    if (!targetNurseryId) {
      return res.status(400).json({ error: 'معرّف الحضانة مطلوب للتحقق من الصلاحيات' });
    }

    // Check membership in the database for absolute security (never trust client claim alone)
    const membership = db.prepare(`
      SELECT id, nursery_id, role, is_active
      FROM nursery_memberships
      WHERE user_id = ? AND nursery_id = ? AND is_active = 1
    `).get(req.user.id, targetNurseryId) as {
      id: string;
      nursery_id: string;
      role: 'admin' | 'teacher' | 'parent';
      is_active: number;
    } | undefined;

    if (!membership) {
      return res.status(403).json({ error: 'ليس لديك صلاحية الوصول إلى بيانات هذه الحضانة' });
    }

    if (!allowedRoles.includes(membership.role)) {
      return res.status(403).json({ error: 'دورك الحالي لا يسمح بتنفيذ هذه العملية' });
    }

    req.nurseryId = targetNurseryId;
    req.membership = {
      id: membership.id,
      nurseryId: membership.nursery_id,
      role: membership.role,
    };

    next();
  };
}

/**
 * Helper to record audit events in the audit log table
 */
export function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  nurseryId: string | null = null,
  details: Record<string, unknown> = {}
) {
  try {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, nursery_id, user_id, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, nurseryId, userId, action, entityType, entityId, JSON.stringify(details), now);
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}
