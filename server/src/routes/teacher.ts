import { Router, Request, Response } from 'express';
import { verifyToken, requireRole } from '../auth';
import { stmts } from '../database';

const router = Router();

// 所有教师路由需要认证 + 教师角色
router.use(verifyToken);
router.use(requireRole('teacher', 'admin'));

// 获取教师的班级列表
router.get('/classes', (req: Request, res: Response): void => {
  try {
    const classes = stmts.getClassesByTeacherId(req.user!.userId);
    res.json(classes);
  } catch (err: any) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

// 创建班级
router.post('/classes', (req: Request, res: Response): void => {
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: '班级名称不能为空' });
    return;
  }

  try {
    const result = stmts.createClass(name, req.user!.userId);
    res.status(201).json({
      message: '班级创建成功',
      id: result.lastInsertRowId,
      name,
      teacher_id: req.user!.userId
    });
  } catch (err: any) {
    res.status(500).json({ error: '创建失败: ' + err.message });
  }
});

// 添加学生到班级
router.post('/classes/:classId/students', (req: Request, res: Response): void => {
  const classId = parseInt(req.params.classId, 10);
  const { student_id } = req.body;

  if (isNaN(classId) || !student_id) {
    res.status(400).json({ error: '缺少班级ID或学生ID' });
    return;
  }

  try {
    // 验证班级属于当前教师
    const cls = stmts.getClassById(classId) as any;
    if (!cls) {
      res.status(404).json({ error: '班级不存在' });
      return;
    }
    if (cls.teacher_id !== req.user!.userId) {
      res.status(403).json({ error: '无权操作此班级' });
      return;
    }

    // 验证学生存在
    const student = stmts.getUserById(student_id) as any;
    if (!student) {
      res.status(404).json({ error: '学生不存在' });
      return;
    }
    if (student.role !== 'student') {
      res.status(400).json({ error: '只能添加学生角色的用户' });
      return;
    }

    stmts.addClassMember(classId, student_id);
    res.json({ message: '学生已添加到班级' });
  } catch (err: any) {
    res.status(500).json({ error: '添加失败: ' + err.message });
  }
});

// 从班级移除学生
router.delete('/classes/:classId/students/:studentId', (req: Request, res: Response): void => {
  const classId = parseInt(req.params.classId, 10);
  const studentId = parseInt(req.params.studentId, 10);

  if (isNaN(classId) || isNaN(studentId)) {
    res.status(400).json({ error: '无效的ID' });
    return;
  }

  try {
    const cls = stmts.getClassById(classId) as any;
    if (!cls || cls.teacher_id !== req.user!.userId) {
      res.status(403).json({ error: '无权操作此班级' });
      return;
    }

    stmts.removeClassMember(classId, studentId);
    res.json({ message: '学生已从班级移除' });
  } catch (err: any) {
    res.status(500).json({ error: '移除失败: ' + err.message });
  }
});

// 获取班级学生列表
router.get('/classes/:classId/students', (req: Request, res: Response): void => {
  const classId = parseInt(req.params.classId, 10);
  if (isNaN(classId)) {
    res.status(400).json({ error: '无效的班级ID' });
    return;
  }

  try {
    const cls = stmts.getClassById(classId) as any;
    if (!cls || cls.teacher_id !== req.user!.userId) {
      res.status(403).json({ error: '无权查看此班级' });
      return;
    }

    const students = stmts.getClassMembers(classId);
    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

// 生成班级报告
router.get('/classes/:classId/report', (req: Request, res: Response): void => {
  const classId = parseInt(req.params.classId, 10);
  if (isNaN(classId)) {
    res.status(400).json({ error: '无效的班级ID' });
    return;
  }

  try {
    const cls = stmts.getClassById(classId) as any;
    if (!cls || cls.teacher_id !== req.user!.userId) {
      res.status(403).json({ error: '无权查看此班级' });
      return;
    }

    const students = stmts.getClassMembers(classId) as any[];

    const report = students.map(student => {
      const cdiRecords = stmts.getCdiRecordsByUserId(student.id) as any[];
      const thoughtLogs = stmts.getThoughtLogsByUserId(student.id) as any[];
      const targetScores = stmts.getTargetScoresByUserId(student.id) as any[];

      const avgCdi = cdiRecords.length > 0
        ? cdiRecords.reduce((sum: number, r: any) => sum + r.cdi, 0) / cdiRecords.length
        : 0;

      const avgBiasScore = thoughtLogs.length > 0
        ? thoughtLogs.reduce((sum: number, l: any) => sum + l.bias_score, 0) / thoughtLogs.length
        : 0;

      const avgTargetScore = targetScores.length > 0
        ? targetScores.reduce((sum: number, s: any) => sum + s.score, 0) / targetScores.length
        : 0;

      return {
        student: {
          id: student.id,
          name: student.name,
          email: student.email
        },
        summary: {
          cdi_count: cdiRecords.length,
          avg_cdi: Math.round(avgCdi * 100) / 100,
          thought_log_count: thoughtLogs.length,
          avg_bias_score: Math.round(avgBiasScore * 100) / 100,
          target_score_count: targetScores.length,
          avg_target_score: Math.round(avgTargetScore * 100) / 100
        },
        cdi_trend: cdiRecords.map((r: any) => ({
          date: r.date,
          cdi: r.cdi,
          duration_score: r.duration_score,
          copy_score: r.copy_score,
          consecutive_score: r.consecutive_score,
          thought_depth_score: r.thought_depth_score
        })).reverse(),
        recent_thoughts: thoughtLogs.slice(0, 5).map((l: any) => ({
          question: l.question,
          bias_score: l.bias_score,
          created_at: l.created_at
        }))
      };
    });

    res.json({
      class: { id: cls.id, name: cls.name },
      student_count: students.length,
      report
    });
  } catch (err: any) {
    res.status(500).json({ error: '报告生成失败: ' + err.message });
  }
});

// 保存教师报告
router.post('/reports', (req: Request, res: Response): void => {
  const { student_id, class_id, period, report_data, teacher_comment } = req.body;

  if (!student_id || !class_id || !period) {
    res.status(400).json({ error: '缺少必填字段: student_id, class_id, period' });
    return;
  }

  try {
    const cls = stmts.getClassById(class_id) as any;
    if (!cls || cls.teacher_id !== req.user!.userId) {
      res.status(403).json({ error: '无权操作此班级' });
      return;
    }

    const result = stmts.insertTeacherReport(
      student_id,
      class_id,
      period,
      JSON.stringify(report_data || {}),
      teacher_comment || ''
    );

    res.status(201).json({
      message: '报告已保存',
      id: result.lastInsertRowId
    });
  } catch (err: any) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

// 获取学生的报告
router.get('/reports/:studentId', (req: Request, res: Response): void => {
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(studentId)) {
    res.status(400).json({ error: '无效的学生ID' });
    return;
  }

  try {
    const reports = stmts.getTeacherReportsByStudentId(studentId) as any[];

    // 解析 report_data JSON
    const parsed = reports.map(r => ({
      ...r,
      report_data: JSON.parse(r.report_data)
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

export default router;
