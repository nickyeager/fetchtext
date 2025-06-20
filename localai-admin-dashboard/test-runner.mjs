#!/usr/bin/env node
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('Starting test runner...');

const child = spawn('npx', ['vitest', 'run', 'src/__tests__/features/documents/TemplateGallery.test.tsx'], {
  cwd: __dirname,
  stdio: 'pipe'
});

let output = '';
let errorOutput = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.error(text);
});

child.on('close', (code) => {
  console.log(`\nTest process exited with code ${code}`);
  console.log('=== STDOUT ===');
  console.log(output);
  console.log('=== STDERR ===');
  console.log(errorOutput);
});

setTimeout(() => {
  console.log('Terminating test after 30 seconds...');
  child.kill('SIGTERM');
}, 30000);
