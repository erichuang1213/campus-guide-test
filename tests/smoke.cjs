const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['admin.html', 'candidates.html', 'feedback.html', 'index.html', 'menus.html', 'place.html', 'regions.html', 'submit-feedback.html'];

for (const page of pages) {
  const scripts = [...read(page).matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
  for (const [index, script] of scripts.entries()) {
    if (!script[2].trim()) continue;
    try {
      if (script[1].includes('module')) new vm.SourceTextModule(script[2]);
      else new vm.Script(script[2]);
    } catch (error) {
      throw new Error(`${page} script ${index + 1}: ${error.message}`);
    }
  }
}
new vm.SourceTextModule(read('backend.js'));
new vm.SourceTextModule(read('admin-guard.js'));

assert.doesNotMatch(read('supabase/schema.sql'), /^\+$/m, 'SQL schema must not contain a diff marker');
assert.doesNotMatch(read('submit-feedback.html'), /localStorage\.setItem/, 'feedback must not report local-only success');
assert.doesNotMatch(read('index.html'), /geolocation\.getCurrentPosition\s*=/, 'location logic must not monkey-patch browser APIs');
assert.match(read('candidates.html'), /id:c\.id/, 'candidate promotion must retain a stable ID');
assert.match(read('menus.html'), /if\(dirty&&!confirm/, 'switching menu stores must warn about unsaved edits');
console.log(`Smoke checks passed: ${pages.length} pages, backend modules, SQL and workflow invariants.`);
