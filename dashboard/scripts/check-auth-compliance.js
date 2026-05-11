#!/usr/bin/env node

/**
 * Authentication Compliance Checker
 * 
 * Quick script to detect authentication issues in the codebase
 * Run with: node scripts/check-auth-compliance.js
 */

import fs from 'fs';
import path from 'path';

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

console.log(`${colors.bold}🔐 Authentication Compliance Checker${colors.reset}\n`);

const serviceDirectories = [
  'src/hooks',
  'src/services', 
  'src/lib',
  'src/components',
];

let totalViolations = 0;

function findFiles(dir, extensions = ['.ts', '.tsx']) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      files.push(...findFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.name.endsWith(ext)) && 
               !item.name.includes('.test.') && 
               !item.name.includes('.spec.')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const violations = [];

  // Skip auth utilities file
  if (filePath.includes('supabase-auth-utils.ts')) {
    return violations;
  }

  // Skip files that don't use Supabase
  if (!content.includes('supabase')) {
    return violations;
  }

  // Check for direct supabase.auth.getUser() usage
  if (content.includes('supabase.auth.getUser()') || content.includes('.auth.getUser()')) {
    violations.push({
      type: 'DIRECT_AUTH_CALL',
      message: 'Direct supabase.auth.getUser() usage detected',
      severity: 'error'
    });
  }

  // Check for direct supabase.auth.getSession() without proper handling
  if (content.includes('supabase.auth.getSession()')) {
    violations.push({
      type: 'DIRECT_SESSION_CALL', 
      message: 'Direct supabase.auth.getSession() usage detected',
      severity: 'warning'
    });
  }

  // Check for direct database calls without authentication wrapper
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('supabase.from(') && !isWithinAuthWrapper(content, index)) {
      violations.push({
        type: 'UNAUTH_DB_CALL',
        message: `Direct supabase.from() usage without authentication wrapper (line ${index + 1})`,
        severity: 'error',
        line: index + 1
      });
    }
  });

  // Check if file imports authentication utilities when using Supabase
  const hasAuthImport = content.includes('withAuthentication') || 
                       content.includes('requireAuthentication');
  
  if (!hasAuthImport && content.includes('supabase.from(')) {
    violations.push({
      type: 'MISSING_AUTH_IMPORT',
      message: 'Missing authentication utility imports',
      severity: 'warning'
    });
  }

  return violations.map(v => ({ ...v, file: relativePath }));
}

function isWithinAuthWrapper(content, lineIndex) {
  const lines = content.split('\n');
  
  // Look backwards for withAuthentication call
  for (let i = lineIndex; i >= 0; i--) {
    if (lines[i].includes('withAuthentication(')) {
      return true;
    }
    // Stop looking if we hit a function boundary
    if (lines[i].includes('function ') || 
        lines[i].includes('const ') || 
        lines[i].includes('export ') ||
        lines[i].includes('async ')) {
      break;
    }
  }
  
  return false;
}

function printViolations(violations) {
  if (violations.length === 0) {
    console.log(`${colors.green}✅ No authentication violations found!${colors.reset}`);
    return;
  }

  console.log(`${colors.red}❌ Found ${violations.length} authentication violation(s):${colors.reset}\n`);

  const groupedViolations = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {});

  Object.entries(groupedViolations).forEach(([file, fileViolations]) => {
    console.log(`${colors.bold}📄 ${file}${colors.reset}`);
    
    fileViolations.forEach(violation => {
      const icon = violation.severity === 'error' ? '🚨' : '⚠️';
      const color = violation.severity === 'error' ? colors.red : colors.yellow;
      
      console.log(`  ${icon} ${color}${violation.message}${colors.reset}`);
      
      if (violation.line) {
        console.log(`     Line: ${violation.line}`);
      }
    });
    
    console.log('');
  });
}

function printRecommendations() {
  console.log(`${colors.blue}💡 Recommendations:${colors.reset}`);
  console.log(`
1. Replace direct auth calls with utilities:
   ${colors.green}// ❌ Don't do this${colors.reset}
   const { data: { user } } = await supabase.auth.getUser();
   
   ${colors.green}// ✅ Do this instead${colors.reset}
   const user = await requireAuthentication();

2. Wrap database operations:
   ${colors.green}// ❌ Don't do this${colors.reset}
   const { data } = await supabase.from('table').select('*');
   
   ${colors.green}// ✅ Do this instead${colors.reset}
   const data = await withAuthentication(async (user) => {
     return await supabase.from('table').select('*').eq('user_id', user.id);
   }, 'operationName');

3. Import authentication utilities:
   ${colors.green}import { withAuthentication, requireAuthentication } from '@/lib/supabase-auth-utils';${colors.reset}
`);
}

// Main execution
console.log('Scanning service files...\n');

let allViolations = [];

serviceDirectories.forEach(dir => {
  const files = findFiles(dir);
  console.log(`📂 Checking ${files.length} files in ${dir}`);
  
  files.forEach(file => {
    const violations = checkFile(file);
    allViolations.push(...violations);
  });
});

console.log(`\n📊 Scanned ${serviceDirectories.reduce((acc, dir) => acc + findFiles(dir).length, 0)} files\n`);

totalViolations = allViolations.length;

printViolations(allViolations);

if (totalViolations > 0) {
  printRecommendations();
  console.log(`${colors.red}❌ Authentication compliance check failed with ${totalViolations} violation(s)${colors.reset}`);
  process.exit(1);
} else {
  console.log(`${colors.green}🎉 All files are authentication compliant!${colors.reset}`);
  process.exit(0);
}