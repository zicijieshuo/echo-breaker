import { Router, Request, Response } from 'express';

const router = Router();

// LTI 1.3 平台配置信息（基础结构）
const LTI_CONFIG = {
  // LTI 1.3 所需的 URL
  target_link_uri: process.env.LTI_TARGET_LINK_URI || 'http://localhost:3001/api/lti/launch',
  oidc_initiation_url: process.env.LTI_OIDC_URL || 'http://localhost:3001/api/lti/login',
  public_jwk_url: process.env.LTI_JWK_URL || 'http://localhost:3001/api/lti/keys',
  // 支持的 LTI 版本
  versions: ['1.3.0'],
  // 支持的消息类型
  message_types: ['LtiResourceLinkRequest', 'LtiDeepLinkingRequest'],
};

// 获取 LTI 配置（用于平台注册）
router.get('/config', (_req: Request, res: Response): void => {
  res.json({
    title: '回声破除者 - Echo Breaker',
    description: '批判性思维训练与认知偏差破除工具',
    target_link_uri: LTI_CONFIG.target_link_uri,
    oidc_initiation_url: LTI_CONFIG.oidc_initiation_url,
    public_jwk_url: LTI_CONFIG.public_jwk_url,
    scopes: [
      'openid',
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    ],
    claims: [
      'iss',
      'sub',
      'aud',
      'exp',
      'iat',
      'nonce',
      'name',
      'email',
      'given_name',
      'family_name',
      'https://purl.imsglobal.org/spec/lti/claim/message_type',
      'https://purl.imsglobal.org/spec/lti/claim/version',
      'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
      'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
      'https://purl.imsglobal.org/spec/lti/claim/resource_link',
      'https://purl.imsglobal.org/spec/lti/claim/roles',
      'https://purl.imsglobal.org/spec/lti/claim/context',
    ],
    extensions: {
      'https://purl.imsglobal.org/spec/lti/claim/custom': {
        teacher_id: '$Teacher.id',
        class_id: '$CourseSection.id',
      }
    }
  });
});

// LTI 1.3 OIDC 登录发起
router.post('/login', (req: Request, res: Response): void => {
  const { iss, login_hint, target_link_uri, lti_message_hint } = req.body;

  if (!iss || !login_hint) {
    res.status(400).json({ error: '缺少 iss 或 login_hint 参数' });
    return;
  }

  // 生成 state 和 nonce 用于防重放攻击
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);

  // TODO: 在生产环境中，需要从数据库查找已注册的 LTI 平台部署信息
  // const deployment = getStatements().getLtiDeployment.get(iss, client_id);

  // 构建重定向到平台的认证 URL
  const authLoginUrl = req.body.auth_login_url || 'https://example.platform.com/auth';

  const redirectUrl = new URL(authLoginUrl);
  redirectUrl.searchParams.set('scope', 'openid');
  redirectUrl.searchParams.set('response_type', 'id_token');
  redirectUrl.searchParams.set('response_mode', 'form_post');
  redirectUrl.searchParams.set('prompt', 'none');
  redirectUrl.searchParams.set('client_id', req.body.client_id || 'echo-breaker-client');
  redirectUrl.searchParams.set('redirect_uri', LTI_CONFIG.target_link_uri);
  redirectUrl.searchParams.set('login_hint', login_hint);
  redirectUrl.searchParams.set('state', state);
  redirectUrl.searchParams.set('nonce', nonce);

  if (lti_message_hint) {
    redirectUrl.searchParams.set('lti_message_hint', lti_message_hint);
  }

  // TODO: 在生产环境中，需要将 state 和 nonce 存入会话/数据库以供回调验证

  res.json({
    redirect_url: redirectUrl.toString(),
    state,
    nonce,
    message: 'LTI OIDC 登录发起成功，请将用户重定向至 redirect_url'
  });
});

// LTI 1.3 回调处理
router.post('/callback', (req: Request, res: Response): void => {
  const { id_token, state } = req.body;

  if (!id_token || !state) {
    res.status(400).json({ error: '缺少 id_token 或 state 参数' });
    return;
  }

  // TODO: 完整的 LTI 1.3 ID Token 验证流程:
  // 1. 验证 state 与之前发起登录时一致
  // 2. 解码 JWT id_token
  // 3. 验证签名（使用平台的公钥/JWKS）
  // 4. 验证 iss, aud, exp, iat, nonce 等声明
  // 5. 提取用户信息和课程上下文
  // 6. 自动创建/关联用户账号
  // 7. 重定向到教师仪表盘

  res.json({
    message: 'LTI 回调已接收（验证逻辑待实现）',
    note: '完整 LTI 1.3 签名验证需要在生产环境中实现',
    received: {
      state,
      has_id_token: !!id_token
    }
  });
});

// JWK 公钥端点（供 LTI 平台验证签名用）
router.get('/keys', (_req: Request, res: Response): void => {
  // TODO: 在生产环境中，需要生成 RSA 密钥对并返回公钥
  res.json({
    keys: [],
    note: 'JWK 公钥尚未配置，请在生产环境中设置 RSA 密钥对'
  });
});

// 辅助函数
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default router;
