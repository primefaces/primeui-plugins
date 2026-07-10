const secretPatterns = [
  {
    label: 'private key material',
    pattern: new RegExp(['-----BEGIN ', '(?:RSA|EC|OPENSSH|DSA)', ' PRIVATE KEY-----'].join(''))
  },
  {
    label: 'GitHub access token',
    pattern: new RegExp(['\\bgh', '[pousr]_[A-Za-z0-9]{36,}\\b'].join(''))
  },
  {
    label: 'GitHub fine-grained access token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/
  },
  {
    label: 'npm access token',
    pattern: /\bnpm_[A-Za-z0-9]{36,}\b/
  },
  {
    label: 'OpenAI API key',
    pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/
  },
  {
    label: 'AWS access key',
    pattern: new RegExp(['\\bAK', 'IA[0-9A-Z]{16}\\b'].join(''))
  },
  {
    label: 'assigned credential value',
    pattern: /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][A-Za-z0-9+/_=-]{16,}["']/i
  }
];

export function detectSecretKinds(content) {
  return secretPatterns
    .filter(({ pattern }) => pattern.test(content))
    .map(({ label }) => label);
}
