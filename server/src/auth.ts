import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { stmts } from './database';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'echo-breaker-dev-secret';
const TOKEN_EXPIRY = '7d';
const BCRYPT_SALT_ROUNDS = 10;

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ========== 中间件 ==========

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供认证令牌' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: '令牌无效或已过期' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: '未认证' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: '权限不足' });
      return;
    }
    next();
  };
}

// ========== 路由 ==========

// 注册
router.post('/register', (req: Request, res: Response): void => {
  const { email, password, name, role, institution } = req.body;

  if (!email || !password || !name || !role) {
    res.status(400).json({ error: '缺少必填字段: email, password, name, role' });
    return;
  }

  if (!['student', 'teacher', 'admin'].includes(role)) {
    res.status(400).json({ error: '角色必须是 student, teacher 或 admin' });
    return;
  }

  // 检查邮箱是否已存在
  const existing = stmts.getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: '该邮箱已被注册' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);

  try {
    const result = stmts.createUser(email, passwordHash, name, role, institution || null);
    const userId = result.lastInsertRowId;

    const token = jwt.sign(
      { userId: Number(userId), email, role } as JwtPayload,
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: userId, email, name, role, institution: institution || null }
    });
  } catch (err: any) {
    res.status(500).json({ error: '注册失败: ' + err.message });
  }
});

// 登录
router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: '缺少邮箱或密码' });
    return;
  }

  const user = stmts.getUserByEmail(email) as any;

  if (!user) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: '邮箱或密码错误' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role } as JwtPayload,
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    message: '登录成功',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institution: user.institution
    }
  });
});

// 验证令牌
router.post('/verify', verifyToken, (req: Request, res: Response): void => {
  const user = stmts.getUserById(req.user!.userId) as any;

  if (!user) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }

  res.json({
    valid: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      institution: user.institution
    }
  });
});

export default router;
