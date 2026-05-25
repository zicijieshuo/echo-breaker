import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'echo-breaker.db');

let db: SqlJsDatabase;

// ========== 类型定义 ==========
export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  institution: string | null;
  created_at: string;
}

export interface ClassRow {
  id: number;
  name: string;
  teacher_id: number;
  created_at: string;
}

export interface ClassMemberRow {
  class_id: number;
  student_id: number;
  joined_at: string;
}

export interface CdiRecordRow {
  id: number;
  user_id: number;
  date: string;
  cdi: number;
  duration_score: number;
  copy_score: number;
  consecutive_score: number;
  thought_depth_score: number;
  created_at: string;
}

export interface ThoughtLogSyncRow {
  id: number;
  user_id: number;
  question: string;
  my_thought: string;
  bias_score: number;
  created_at: string;
}

export interface TargetScoreSyncRow {
  id: number;
  user_id: number;
  target_id: string;
  score: number;
  created_at: string;
}

export interface TeacherReportRow {
  id: number;
  student_id: number;
  class_id: number;
  period: string;
  report_data: string;
  teacher_comment: string;
  generated_at: string;
}

export interface LtiDeploymentRow {
  id: number;
  issuer: string;
  client_id: string;
  deployment_id: string;
  platform_name: string;
  key_set_url: string;
  auth_token_url: string;
  auth_login_url: string;
  created_at: string;
}

// ========== 查询辅助 ==========
function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
  const rows = queryAll<T>(sql, params);
  return rows[0];
}

function runSql(sql: string, params: any[] = []): { lastInsertRowId: number; changes: number } {
  db.run(sql, params);
  return {
    lastInsertRowId: getLastInsertRowId(),
    changes: db.getRowsModified()
  };
}

function getLastInsertRowId(): number {
  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  return row ? row.id : 0;
}

// ========== 数据库初始化 ==========
export async function initDatabase(): Promise<SqlJsDatabase> {
  // 确保数据目录存在
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  // 尝试加载已有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  saveDb();

  return db;
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// 持久化数据库到磁盘
let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveDb(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (db) {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
    saveTimer = null;
  }, 500);
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin')),
      institution TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      teacher_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS class_members (
      class_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (class_id, student_id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cdi_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      cdi REAL NOT NULL,
      duration_score REAL NOT NULL,
      copy_score REAL NOT NULL,
      consecutive_score REAL NOT NULL,
      thought_depth_score REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS thought_logs_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      my_thought TEXT NOT NULL,
      bias_score REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS target_scores_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_id TEXT NOT NULL,
      score REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS teacher_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      period TEXT NOT NULL,
      report_data TEXT NOT NULL,
      teacher_comment TEXT NOT NULL DEFAULT '',
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lti_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issuer TEXT NOT NULL,
      client_id TEXT NOT NULL,
      deployment_id TEXT NOT NULL,
      platform_name TEXT NOT NULL,
      key_set_url TEXT NOT NULL,
      auth_token_url TEXT NOT NULL,
      auth_login_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 创建索引
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_cdi_records_user_id ON cdi_records(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_cdi_records_date ON cdi_records(date)',
    'CREATE INDEX IF NOT EXISTS idx_thought_logs_user_id ON thought_logs_sync(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_target_scores_user_id ON target_scores_sync(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_class_members_student_id ON class_members(student_id)',
    'CREATE INDEX IF NOT EXISTS idx_teacher_reports_student_id ON teacher_reports(student_id)',
  ];
  for (const idx of indexes) {
    db.run(idx);
  }

  saveDb();
}

// ========== 预编译语句封装 ==========
// sql.js 使用 prepare/bind/step 模式，这里封装为简洁的函数接口

export const stmts = {
  getUserByEmail: (email: string) => queryOne<UserRow>('SELECT * FROM users WHERE email = ?', [email]),
  getUserById: (id: number) => queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]),
  createUser: (email: string, passwordHash: string, name: string, role: string, institution: string | null) => {
    const result = runSql('INSERT INTO users (email, password_hash, name, role, institution) VALUES (?, ?, ?, ?, ?)', [email, passwordHash, name, role, institution]);
    saveDb();
    return result;
  },
  createClass: (name: string, teacherId: number) => {
    const result = runSql('INSERT INTO classes (name, teacher_id) VALUES (?, ?)', [name, teacherId]);
    saveDb();
    return result;
  },
  getClassById: (id: number) => queryOne<ClassRow>('SELECT * FROM classes WHERE id = ?', [id]),
  getClassesByTeacherId: (teacherId: number) => queryAll<ClassRow>('SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC', [teacherId]),
  addClassMember: (classId: number, studentId: number) => {
    const result = runSql('INSERT OR IGNORE INTO class_members (class_id, student_id) VALUES (?, ?)', [classId, studentId]);
    saveDb();
    return result;
  },
  removeClassMember: (classId: number, studentId: number) => {
    const result = runSql('DELETE FROM class_members WHERE class_id = ? AND student_id = ?', [classId, studentId]);
    saveDb();
    return result;
  },
  getClassMembers: (classId: number) => queryAll<any>(
    `SELECT u.id, u.email, u.name, u.role, u.institution, cm.joined_at
     FROM class_members cm
     JOIN users u ON cm.student_id = u.id
     WHERE cm.class_id = ?
     ORDER BY cm.joined_at DESC`, [classId]
  ),
  getStudentClasses: (studentId: number) => queryAll<ClassRow>(
    `SELECT c.* FROM classes c
     JOIN class_members cm ON c.id = cm.class_id
     WHERE cm.student_id = ?`, [studentId]
  ),
  insertCdiRecord: (userId: number, date: string, cdi: number, durationScore: number, copyScore: number, consecutiveScore: number, thoughtDepthScore: number) => {
    const result = runSql(
      'INSERT INTO cdi_records (user_id, date, cdi, duration_score, copy_score, consecutive_score, thought_depth_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, date, cdi, durationScore, copyScore, consecutiveScore, thoughtDepthScore]
    );
    saveDb();
    return result;
  },
  getCdiRecordsByUserId: (userId: number) => queryAll<CdiRecordRow>('SELECT * FROM cdi_records WHERE user_id = ? ORDER BY date DESC', [userId]),
  insertThoughtLog: (userId: number, question: string, myThought: string, biasScore: number) => {
    const result = runSql(
      'INSERT INTO thought_logs_sync (user_id, question, my_thought, bias_score) VALUES (?, ?, ?, ?)',
      [userId, question, myThought, biasScore]
    );
    saveDb();
    return result;
  },
  getThoughtLogsByUserId: (userId: number) => queryAll<ThoughtLogSyncRow>('SELECT * FROM thought_logs_sync WHERE user_id = ? ORDER BY created_at DESC', [userId]),
  insertTargetScore: (userId: number, targetId: string, score: number) => {
    const result = runSql(
      'INSERT INTO target_scores_sync (user_id, target_id, score) VALUES (?, ?, ?)',
      [userId, targetId, score]
    );
    saveDb();
    return result;
  },
  getTargetScoresByUserId: (userId: number) => queryAll<TargetScoreSyncRow>('SELECT * FROM target_scores_sync WHERE user_id = ? ORDER BY created_at DESC', [userId]),
  insertTeacherReport: (studentId: number, classId: number, period: string, reportData: string, teacherComment: string) => {
    const result = runSql(
      'INSERT INTO teacher_reports (student_id, class_id, period, report_data, teacher_comment) VALUES (?, ?, ?, ?, ?)',
      [studentId, classId, period, reportData, teacherComment]
    );
    saveDb();
    return result;
  },
  getTeacherReportsByStudentId: (studentId: number) => queryAll<TeacherReportRow>('SELECT * FROM teacher_reports WHERE student_id = ? ORDER BY generated_at DESC', [studentId]),
  getLtiDeployment: (issuer: string, clientId: string) => queryOne<LtiDeploymentRow>('SELECT * FROM lti_deployments WHERE issuer = ? AND client_id = ?', [issuer, clientId]),
  insertLtiDeployment: (issuer: string, clientId: string, deploymentId: string, platformName: string, keySetUrl: string, authTokenUrl: string, authLoginUrl: string) => {
    const result = runSql(
      'INSERT INTO lti_deployments (issuer, client_id, deployment_id, platform_name, key_set_url, auth_token_url, auth_login_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [issuer, clientId, deploymentId, platformName, keySetUrl, authTokenUrl, authLoginUrl]
    );
    saveDb();
    return result;
  },
};

// 导出查询辅助函数供路由使用
export { queryAll, queryOne, runSql };
