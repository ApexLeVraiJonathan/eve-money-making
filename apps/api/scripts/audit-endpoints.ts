#!/usr/bin/env tsx
/**
 * Endpoint Security Audit Script
 * 
 * Scans all NestJS controllers and reports:
 * - Endpoints without @Public() decorator (protected by default via global guard)
 * - Endpoints with @Roles() decorator (role-based access control)
 * - Public endpoints (should be reviewed)
 * 
 * Usage: pnpm exec tsx apps/api/scripts/audit-endpoints.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface EndpointInfo {
  file: string;
  controller: string;
  method: string;
  route: string;
  isPublic: boolean;
  roles: string[];
  line: number;
}

const srcDir = path.join(__dirname, '../src');
const controllerFiles: string[] = [];

// Find all controller files
function findControllers(dir: string) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findControllers(filePath);
    } else if (file.endsWith('.controller.ts')) {
      controllerFiles.push(filePath);
    }
  }
}

// Parse a controller file for endpoint information
function parseController(filePath: string): EndpointInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const endpoints: EndpointInfo[] = [];
  
  let controllerName = '';
  let controllerRoute = '';
  let currentIsPublic = false;
  let currentRoles: string[] = [];
  let currentMethod = '';
  let currentRoute = '';
  
  // Extract controller name and route
  const controllerMatch = content.match(/@Controller\('([^']*)'\)\s+export\s+class\s+(\w+)/);
  if (controllerMatch) {
    controllerRoute = controllerMatch[1];
    controllerName = controllerMatch[2];
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for decorators
    if (line.includes('@Public()')) {
      currentIsPublic = true;
    }
    
    const rolesMatch = line.match(/@Roles\('([^']+)'\)/);
    if (rolesMatch) {
      currentRoles.push(rolesMatch[1]);
    }
    
    // Check for HTTP method decorators
    const methodMatch = line.match(/@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/);
    if (methodMatch) {
      currentMethod = methodMatch[1];
      currentRoute = methodMatch[2] || '';
      
      // Look ahead for the method name
      let methodName = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const methodNameMatch = lines[j].match(/^\s*(?:async\s+)?(\w+)\s*\(/);
        if (methodNameMatch) {
          methodName = methodNameMatch[1];
          break;
        }
      }
      
      endpoints.push({
        file: path.relative(srcDir, filePath),
        controller: controllerName,
        method: `${currentMethod} /${controllerRoute}${currentRoute ? '/' + currentRoute : ''}`,
        route: methodName,
        isPublic: currentIsPublic,
        roles: [...currentRoles],
        line: i + 1,
      });
      
      // Reset current state
      currentIsPublic = false;
      currentRoles = [];
      currentMethod = '';
      currentRoute = '';
    }
  }
  
  return endpoints;
}

// Main audit
function auditEndpoints() {
  console.log('🔍 Scanning for controller files...\n');
  
  findControllers(srcDir);
  console.log(`Found ${controllerFiles.length} controller files\n`);
  
  const allEndpoints: EndpointInfo[] = [];
  
  for (const file of controllerFiles) {
    const endpoints = parseController(file);
    allEndpoints.push(...endpoints);
  }
  
  // Categorize endpoints
  const publicEndpoints = allEndpoints.filter(e => e.isPublic);
  const protectedEndpoints = allEndpoints.filter(e => !e.isPublic && e.roles.length === 0);
  const roleBasedEndpoints = allEndpoints.filter(e => e.roles.length > 0);
  
  // Report
  console.log('📊 Endpoint Security Audit Report');
  console.log('='.repeat(80));
  console.log(`\nTotal endpoints: ${allEndpoints.length}`);
  console.log(`  - Public (⚠️  review): ${publicEndpoints.length}`);
  console.log(`  - Protected (auth required): ${protectedEndpoints.length}`);
  console.log(`  - Role-based: ${roleBasedEndpoints.length}`);
  
  if (publicEndpoints.length > 0) {
    console.log('\n\n⚠️  PUBLIC ENDPOINTS (No authentication required):');
    console.log('-'.repeat(80));
    for (const endpoint of publicEndpoints) {
      console.log(`  ${endpoint.method}`);
      console.log(`    File: ${endpoint.file}:${endpoint.line}`);
      console.log(`    Handler: ${endpoint.route}()`);
      console.log('');
    }
  }
  
  if (roleBasedEndpoints.length > 0) {
    console.log('\n\n🔒 ROLE-BASED ENDPOINTS:');
    console.log('-'.repeat(80));
    const byRole = roleBasedEndpoints.reduce((acc, e) => {
      for (const role of e.roles) {
        if (!acc[role]) acc[role] = [];
        acc[role].push(e);
      }
      return acc;
    }, {} as Record<string, EndpointInfo[]>);
    
    for (const [role, endpoints] of Object.entries(byRole)) {
      console.log(`\n  Role: ${role} (${endpoints.length} endpoints)`);
      for (const endpoint of endpoints) {
        console.log(`    - ${endpoint.method} (${endpoint.file}:${endpoint.line})`);
      }
    }
  }
  
  console.log('\n\n✅ Protected Endpoints:', protectedEndpoints.length);
  console.log('   These require authentication via CompositeAuthGuard (cookie or Bearer token)\n');
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(80));
  
  if (publicEndpoints.length > 0) {
    console.log('  - Review all public endpoints to ensure they should be unauthenticated');
    console.log('  - Consider rate limiting for public endpoints');
  }
  
  if (roleBasedEndpoints.length > 0) {
    console.log('  - Verify role-based endpoints have proper RolesGuard applied');
  }
  
  console.log('  - All non-public endpoints are protected by CompositeAuthGuard');
  console.log('  - Health check endpoint should remain public');
  console.log('  - Consider adding request logging for sensitive endpoints\n');
}

// Run audit
try {
  auditEndpoints();
} catch (error) {
  console.error('Error running audit:', error);
  process.exit(1);
}

