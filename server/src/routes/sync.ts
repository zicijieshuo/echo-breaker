import { Router, Request, Response } from 'express';
import { verifyToken } from '../auth';
import { stmts, getDatabase, saveDb } from '../database';

const router = Router();

// 所有同步路由需要认证
router.use(verifyToken);

// 上传 CDI 记录
router.post('/cdi', (req: Request, res: Response): void => {
  const { date, cdi, duration_score, copy_score, consecutive_score, thought_depth_score } = req.body;
  const userId = req.user!.userId;

  if (!date || cdi === undefined) {
    res.status(400).json({ error: '缺少必填字段: date, cdi' });
    return;
  }

  try {
    const result = stmts.insertCdiRecord(
      userId,
      date,
      cdi,
      duration_score || 0,
      copy_score || 0,
      consecutive_score || 0,
      thought_depth_score || 0
    );
    res.status(201).json({ message: 'CDI记录已保存', id: result.lastInsertRowId });
  } catch (err: any) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

// 获取用户的 CDI 历史
router.get('/cdi/:userId', (req: Request, res: Response): void => {
  const targetUserId = parseInt(req.params.userId, 10);
  if (isNaN(targetUserId)) {
    res.status(400).json({ error: '无效的用户ID' });
    return;
  }

  // 教师可查看任何学生，学生只能查看自己
  if (req.user!.role === 'student' && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: '权限不足' });
    return;
  }

  try {
    const records = stmts.getCdiRecordsByUserId(targetUserId);
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

// 上传思维日志
router.post('/thought-log', (req: Request, res: Response): void => {
  const { question, my_thought, bias_score } = req.body;
  const userId = req.user!.userId;

  if (!question || !my_thought) {
    res.status(400).json({ error: '缺少必填字段: question, my_thought' });
    return;
  }

  try {
    const result = stmts.insertThoughtLog(userId, question, my_thought, bias_score || 0);
    res.status(201).json({ message: '思维日志已保存', id: result.lastInsertRowId });
  } catch (err: any) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

// 获取用户的思维日志
router.get('/thought-logs/:userId', (req: Request, res: Response): void => {
  const targetUserId = parseInt(req.params.userId, 10);
  if (isNaN(targetUserId)) {
    res.status(400).json({ error: '无效的用户ID' });
    return;
  }

  if (req.user!.role === 'student' && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: '权限不足' });
    return;
  }

  try {
    const logs = stmts.getThoughtLogsByUserId(targetUserId);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

// 上传目标分数
router.post('/target-score', (req: Request, res: Response): void => {
  const { target_id, score } = req.body;
  const userId = req.user!.userId;

  if (!target_id || score === undefined) {
    res.status(400).json({ error: '缺少必填字段: target_id, score' });
    return;
  }

  try {
    const result = stmts.insertTargetScore(userId, target_id, score);
    res.status(201).json({ message: '目标分数已保存', id: result.lastInsertRowId });
  } catch (err: any) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

// 获取用户的目标分数
router.get('/target-scores/:userId', (req: Request, res: Response): void => {
  const targetUserId = parseInt(req.params.userId, 10);
  if (isNaN(targetUserId)) {
    res.status(400).json({ error: '无效的用户ID' });
    return;
  }

  if (req.user!.role === 'student' && req.user!.userId !== targetUserId) {
    res.status(403).json({ error: '权限不足' });
    return;
  }

  try {
    const scores = stmts.getTargetScoresByUserId(targetUserId);
    res.json(scores);
  } catch (err: any) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

// 全量同步 - 一次性上传所有数据
router.post('/full', (req: Request, res: Response): void => {
  const { cdi_records, thought_logs, target_scores } = req.body;
  const userId = req.user!.userId;

  if (!cdi_records && !thought_logs && !target_scores) {
    res.status(400).json({ error: '至少需要提供一种数据类型' });
    return;
  }

  try {
    const inserted = { cdi: 0, thoughts: 0, scores: 0 };

    if (Array.isArray(cdi_records)) {
      for (const r of cdi_records) {
        stmts.insertCdiRecord(
          userId,
          r.date,
          r.cdi || 0,
          r.duration_score || 0,
          r.copy_score || 0,
          r.consecutive_score || 0,
          r.thought_depth_score || 0
        );
        inserted.cdi++;
      }
    }

    if (Array.isArray(thought_logs)) {
      for (const l of thought_logs) {
        stmts.insertThoughtLog(
          userId,
          l.question,
          l.my_thought,
          l.bias_score || 0
        );
        inserted.thoughts++;
      }
    }

    if (Array.isArray(target_scores)) {
      for (const s of target_scores) {
        stmts.insertTargetScore(userId, s.target_id, s.score);
        inserted.scores++;
      }
    }

    res.status(201).json({
      message: '全量同步完成',
      inserted
    });
  } catch (err: any) {
    res.status(500).json({ error: '同步失败: ' + err.message });
  }
});

export default router;
