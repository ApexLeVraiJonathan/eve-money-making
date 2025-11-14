/**
 * Generate Plan JSON
 * 
 * Parses plan.md and generates JSON that can be pasted into Swagger UI.
 * Does NOT commit to the API - just outputs the JSON.
 * 
 * Usage:
 *   npx ts-node scripts/generate-plan-json.ts --file ../../../docs/plan.md [--output plan-payload.json]
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@eve/prisma';

const prisma = new PrismaClient();

interface ParsedPackage {
  destinationStation: string;
  items: Array<{ name: string; quantity: number }>;
}

interface ParsedPlan {
  packages: ParsedPackage[];
}

// Known station IDs for common trading hubs
const STATION_MAP: Record<string, number> = {
  'Rens VI - Moon 8 - Brutor Tribe Treasury': 60004588,
  'Hek VIII - Moon 12 - Boundless Creation Factory': 60005686,
  'Amarr VIII (Oris) - Emperor Family Academy': 60008494,
  'Jita IV - Moon 4 - Caldari Navy Assembly Plant': 60003760,
};

function parsePlanFile(filePath: string): ParsedPlan {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const packages: ParsedPackage[] = [];
  let currentStation: string | null = null;
  let currentItems: Array<{ name: string; quantity: number }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Station header
    if (line.startsWith('##')) {
      currentStation = line.substring(2).trim();
      currentItems = [];
      continue;
    }
    
    // Package separator or empty line
    if (line === '---' || line === '') {
      if (currentStation && currentItems.length > 0) {
        packages.push({
          destinationStation: currentStation,
          items: [...currentItems],
        });
        currentItems = [];
      }
      continue;
    }
    
    // Item line: "Item Name Quantity"
    if (currentStation && line.length > 0) {
      // Split by last space to get quantity
      const lastSpaceIdx = line.lastIndexOf(' ');
      if (lastSpaceIdx > 0) {
        const itemName = line.substring(0, lastSpaceIdx).trim();
        const quantityStr = line.substring(lastSpaceIdx + 1).trim();
        const quantity = parseInt(quantityStr, 10);
        
        if (!isNaN(quantity) && quantity > 0) {
          currentItems.push({ name: itemName, quantity });
        }
      }
    }
  }
  
  // Add last package if exists
  if (currentStation && currentItems.length > 0) {
    packages.push({
      destinationStation: currentStation,
      items: [...currentItems],
    });
  }
  
  return { packages };
}

async function getTypeByName(typeName: string): Promise<{ id: number; volume: number } | null> {
  // Try exact match first
  const exact = await prisma.typeId.findFirst({
    where: { name: { equals: typeName, mode: 'insensitive' } },
    select: { id: true, volume: true },
  });
  
  if (exact) {
    return {
      id: exact.id,
      volume: exact.volume ? Number(exact.volume) : 1.0,
    };
  }
  
  // Try fuzzy match
  const fuzzy = await prisma.typeId.findFirst({
    where: { name: { contains: typeName, mode: 'insensitive' } },
    select: { id: true, volume: true },
  });
  
  if (fuzzy) {
    return {
      id: fuzzy.id,
      volume: fuzzy.volume ? Number(fuzzy.volume) : 1.0,
    };
  }
  
  return null;
}

async function buildPlanResult(parsedPlan: ParsedPlan) {
  console.log('\n📦 Building plan result...\n');
  
  const packages = [];
  let packageIndex = 0;
  
  for (const pkg of parsedPlan.packages) {
    const stationId = STATION_MAP[pkg.destinationStation];
    if (!stationId) {
      console.warn(`⚠️  Unknown station: ${pkg.destinationStation}, skipping package`);
      continue;
    }
    
    console.log(`\n📍 Package ${packageIndex + 1} → ${pkg.destinationStation} (ID: ${stationId})`);
    
    const items = [];
    for (const item of pkg.items) {
      const typeData = await getTypeByName(item.name);
      if (!typeData) {
        console.warn(`  ⚠️  Could not find typeId for: ${item.name}, skipping`);
        continue;
      }
      
      // Use placeholder values for pricing since we don't have the original plan data
      const unitCost = 1000;
      const unitProfit = 100;
      const unitVolume = typeData.volume;
      
      items.push({
        typeId: typeData.id,
        name: item.name,
        units: item.quantity,
        unitCost,
        unitProfit,
        unitVolume,
        spendISK: unitCost * item.quantity,
        profitISK: unitProfit * item.quantity,
        volumeM3: unitVolume * item.quantity,
      });
      
      console.log(`  ✓ ${item.name} x${item.quantity}`);
    }
    
    if (items.length === 0) {
      console.warn(`  ⚠️  No valid items in package, skipping`);
      continue;
    }
    
    const spendISK = items.reduce((sum, it) => sum + it.spendISK, 0);
    const grossProfitISK = items.reduce((sum, it) => sum + it.profitISK, 0);
    const shippingISK = 1000000;
    const usedCapacityM3 = items.reduce((sum, it) => sum + it.volumeM3, 0);
    
    packages.push({
      packageIndex: packageIndex++,
      destinationStationId: stationId,
      destinationName: pkg.destinationStation,
      items,
      spendISK,
      grossProfitISK,
      shippingISK,
      netProfitISK: grossProfitISK - shippingISK,
      usedCapacityM3,
      efficiency: grossProfitISK / Math.max(spendISK, 1),
    });
  }
  
  const totalSpendISK = packages.reduce((sum, p) => sum + p.spendISK, 0);
  const totalGrossProfitISK = packages.reduce((sum, p) => sum + p.grossProfitISK, 0);
  const totalShippingISK = packages.reduce((sum, p) => sum + p.shippingISK, 0);
  
  return {
    packages,
    totalSpendISK,
    totalGrossProfitISK,
    totalShippingISK,
    totalNetProfitISK: totalGrossProfitISK - totalShippingISK,
    itemExposureByDest: {},
    destSpend: {},
    notes: ['Restored from plan.md file'],
  };
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && idx < process.argv.length - 1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const filePath = getArg('--file');
  const outputPath = getArg('--output');
  const memo = getArg('--memo') || 'Plan restored from file';
  
  if (!filePath) {
    console.error('❌ Missing required argument: --file');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/generate-plan-json.ts --file PATH [--output PATH] [--memo MEMO]');
    process.exit(1);
  }
  
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }
  
  console.log('\n🔄 Generating plan JSON from file...');
  console.log(`   File: ${resolvedPath}`);
  
  try {
    // Parse the file
    const parsedPlan = parsePlanFile(resolvedPath);
    console.log(`\n✓ Parsed ${parsedPlan.packages.length} packages from file`);
    
    // Build PlanResult structure
    const planResult = await buildPlanResult(parsedPlan);
    console.log(`\n✓ Built plan result with ${planResult.packages.length} packages`);
    console.log(`   Total items: ${planResult.packages.reduce((sum, p) => sum + p.items.length, 0)}`);
    
    // Build final payload for the commit endpoint
    const payload = {
      request: { restored: true },
      result: planResult,
      memo,
    };
    
    const jsonOutput = JSON.stringify(payload, null, 2);
    
    if (outputPath) {
      const resolvedOutput = path.resolve(outputPath);
      fs.writeFileSync(resolvedOutput, jsonOutput, 'utf-8');
      console.log(`\n✅ JSON written to: ${resolvedOutput}\n`);
    } else {
      console.log('\n📋 Copy this JSON and paste it into Swagger UI at POST /arbitrage/commit:\n');
      console.log('=' .repeat(80));
      console.log(jsonOutput);
      console.log('='.repeat(80));
      console.log('\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

