import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { initDatabase } from './database';
import authRouter from './auth';
import syncRouter from './routes/sync';
import teacherRouter from './routes/teacher';
import ltiRouter from './routes/lti';

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS 配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// 静态文件（教师仪表盘）
app.use('/dashboard', express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/auth', authRouter);
app.use('/api/sync', syncRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/lti', ltiRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'echo-breaker-server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 仪表盘重定向
app.get('/', (_req, res) => {
  res.redirect('/dashboard/dashboard.html');
});

// 404 处理
app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 全局错误处理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
async function start() {
  // 初始化数据库（sql.js 需要 async 初始化）
  await initDatabase();
  console.log('数据库初始化完成');

  app.listen(PORT, () => {
    console.log(`回声破除者服务器已启动`);
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  仪表盘: http://localhost:${PORT}/dashboard/dashboard.html`);
    console.log(`  API: http://localhost:${PORT}/api/health`);
  });
}

start();

export default app;
