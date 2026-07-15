const generatedOutputPrefixes = [
  '.agents/plugins/',
  '.claude-plugin/',
  '.cursor-plugin/',
  '.github/plugin/',
  'plugins/'
];

const exactMcpPackageSpecPattern =
  /@(?:primevue|primeng|primereact|primeuix)\/mcp@(?![<>=~^*])(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/gu;
const frameworkProductVersionPattern =
  /(?<![0-9A-Za-z.-])(?:5|11|22)\.0\.0(?:-rc\.(?:0|[1-9][0-9]*))?(?![0-9A-Za-z.-])/gu;
const primeuixProductVersionPattern =
  /@primeuix\/mcp@[^\n"'`]*?\b2\.0\.0(?:-rc\.(?:0|[1-9][0-9]*))?\b/gu;

export function isProductVersionLiteralAllowed(relativePath) {
  return relativePath === 'config/plugins.json' ||
    generatedOutputPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

export function findProductVersionLiterals(relativePath, content) {
  if (isProductVersionLiteralAllowed(relativePath)) {
    return [];
  }
  const matches = new Set();
  for (const pattern of [
    exactMcpPackageSpecPattern,
    frameworkProductVersionPattern,
    primeuixProductVersionPattern
  ]) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      matches.add(match[0]);
    }
  }
  return [...matches].sort();
}

export function auditProductVersionLiterals(files) {
  return files.flatMap(({ content, relativePath }) =>
    findProductVersionLiterals(relativePath, content)
      .map((literal) => `${relativePath}: unauthorized PrimeUI MCP product-version literal ${literal}`)
  );
}
