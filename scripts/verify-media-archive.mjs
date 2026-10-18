import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const archive = fileURLToPath(new URL('../research/media-resilience/sources/', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) {
  throw Error('Invalid media source archive manifest');
}
const listed = new Set(); let bytes = 0;
for (const entry of manifest.files) {
  if (typeof entry.path !== 'string' || path.isAbsolute(entry.path)
    || entry.path.split('/').some(p => p === '..' || p === '.' || !p)
    || !entry.path.endsWith('.js') || listed.has(entry.path)) throw Error('Invalid or duplicate archive path');
  const parts = entry.path.split('/');
  if (parts.length !== 5 || parts[0] !== entry.stage || parts[1] !== entry.site
    || parts[2] !== entry.version || parts[3] !== 'js') throw Error('Archive metadata/path mismatch');
  const file = path.join(archive, entry.path);
  if (!fs.lstatSync(file).isFile()) throw Error('Archive entry must be a regular file');
  const source = fs.readFileSync(file);
  if (source.length !== entry.bytes || crypto.createHash('sha256').update(source).digest('hex') !== entry.sha256) {
    throw Error('Original source bytes changed: ' + entry.path);
  }
  listed.add(entry.path); bytes += source.length;
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) throw Error('Symlinks are not allowed in the source archive');
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.js') && !listed.has(path.relative(archive, file).split(path.sep).join('/'))) {
      throw Error('Unlisted original JS file: ' + file);
    }
  }
}
walk(archive);
if (listed.size !== manifest.totalFiles || bytes !== manifest.totalBytes) throw Error('Archive totals mismatch');
console.log('Verified ' + listed.size + ' original JS files (' + bytes + ' bytes); SHA-256 matches the archive manifest.');
