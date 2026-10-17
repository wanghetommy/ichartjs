import { posix } from 'node:path';

export function packageLinkFailures(files, read) {
  const names = [...files], failures = [];
  for (const file of names.filter(name => name.endsWith('.md'))) {
    const source = read(file);
    const links = [...source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g), ...source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)];
    for (const [, link] of links) {
      const target = link.split(/[?#]/)[0];
      if (!target || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) continue;
      const resolved = posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(target))).replace(/\/$/, '');
      if (!files.has(resolved) && !names.some(name => name.startsWith(`${resolved}/`))) failures.push(`${file}: unpacked package is missing link target ${link}`);
    }
  }
  return failures;
}
