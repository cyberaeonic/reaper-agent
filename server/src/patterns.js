// Secret detectors ported from the original REAPER Go scanner (reaper.go).
// Email harvesting was intentionally dropped: this build is defensive only.
export const PATTERNS = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL' },
  { name: 'AWS Secret Key', regex: /(?:aws_secret_access_key)\s*[:=\s]+['"]?([A-Za-z0-9/+=]{40})['"]?/gi, severity: 'CRITICAL', entropy: true },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'CRITICAL' },
  { name: 'GitHub Token', regex: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g, severity: 'CRITICAL' },
  { name: 'GitHub App Token', regex: /ghu_[A-Za-z0-9]{36}/g, severity: 'CRITICAL' },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g, severity: 'HIGH' },
  { name: 'Discord Bot Token', regex: /[MNO][a-zA-Z\d_-]{23,25}\.[a-zA-Z\d_-]{6}\.[a-zA-Z\d_-]{27}/g, severity: 'CRITICAL' },
  { name: 'Stripe Secret Key', regex: /sk_live_[A-Za-z0-9]{24}/g, severity: 'CRITICAL' },
  { name: 'Stripe Publishable Key', regex: /pk_live_[A-Za-z0-9]{24}/g, severity: 'HIGH' },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*/g, severity: 'HIGH', entropy: true },
  { name: 'PostgreSQL URL', regex: /postgres(?:ql)?:\/\/[^/\s:]+:[^/\s@]+@[^/\s]+\/\w+/g, severity: 'CRITICAL' },
  { name: 'MySQL URL', regex: /mysql:\/\/[^/\s:]+:[^/\s@]+@[^/\s]+\/\w+/g, severity: 'CRITICAL' },
  { name: 'MongoDB URL', regex: /mongodb(?:\+srv)?:\/\/[^/\s:]+:[^/\s@]+@[^/\s]+\/\w+/g, severity: 'CRITICAL' },
  { name: 'Redis URL', regex: /redis:\/\/[^:@\s]+:[^@\s]+@[^:\s]+:[0-9]+/g, severity: 'HIGH' },
  { name: 'RSA Private Key', regex: /-----BEGIN RSA PRIVATE KEY-----\s+[A-Za-z0-9+\/=\s]{40,}/g, severity: 'CRITICAL' },
  { name: 'SSH Private Key', regex: /-----BEGIN OPENSSH PRIVATE KEY-----\s+[A-Za-z0-9+\/=\s]{40,}/g, severity: 'CRITICAL' },
  { name: 'EC Private Key', regex: /-----BEGIN EC PRIVATE KEY-----\s+[A-Za-z0-9+\/=\s]{40,}/g, severity: 'CRITICAL' },
  { name: 'Generic Password', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"\s]{8,50})['"]/gi, severity: 'HIGH' },
  { name: 'Generic API Key', regex: /(?:api[_-]?key|apikey|api_token|secret|token)\s*[:=]\s*['"]?([A-Za-z0-9]{20,50})['"]?/gi, severity: 'HIGH', entropy: true },
  { name: 'Azure Connection String', regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g, severity: 'CRITICAL' },
  { name: 'Twilio API Key', regex: /SK[0-9a-fA-F]{32}/g, severity: 'HIGH' },
  { name: 'SendGrid API Key', regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g, severity: 'HIGH' },
  { name: 'OpenAI API Key', regex: /sk-[A-Za-z0-9]{48}/g, severity: 'CRITICAL', entropy: true },
  { name: 'Telegram Bot Token', regex: /[0-9]{8,10}:[A-Za-z0-9_-]{35}/g, severity: 'CRITICAL' },
  { name: 'GitLab Token', regex: /glpat-[A-Za-z0-9\-_]{20}/g, severity: 'HIGH' },
  { name: 'Docker Hub Token', regex: /dckr_pat_[A-Za-z0-9\-_]{32}/g, severity: 'HIGH' },
  { name: 'NPM Token', regex: /npm_[A-Za-z0-9]{36}/g, severity: 'HIGH' },
  { name: 'Pulumi API Key', regex: /pul-[a-f0-9]{40}/g, severity: 'HIGH' },
  { name: 'DigitalOcean Token', regex: /dops_v1_[a-zA-Z0-9]{64}/g, severity: 'HIGH' },
  { name: 'Alibaba Cloud Key', regex: /LTAI[A-Za-z0-9]{16,20}/g, severity: 'HIGH' },
];

export function shannonEntropy(s) {
  const freq = {};
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  let h = 0;
  for (const c of Object.values(freq)) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export const maskSecret = (s) =>
  s.length <= 8 ? '****' : `${s.slice(0, 4)}${'*'.repeat(Math.min(s.length - 8, 12))}${s.slice(-4)}`;

// Scan text and return raw matches (raw values never leave the server process).
export function detect(text) {
  const out = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(new RegExp(p.regex.source, p.regex.flags))) {
      const secret = m[1] || m[0];
      if (p.entropy && shannonEntropy(secret) < 3.5) continue;
      out.push({ type: p.name, severity: p.severity, secret, index: m.index });
    }
  }
  return out;
}
