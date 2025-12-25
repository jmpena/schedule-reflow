/**
 * Demo script to showcase the reflow algorithm
 * Loads test scenarios and demonstrates the scheduling
 */

import { ReflowService } from './reflow/reflow-service';
import { ReflowInput } from './reflow/types';
import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function printHeader(text: string) {
  console.log('\n' + colors.bright + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.bright + colors.cyan + text + colors.reset);
  console.log(colors.bright + colors.cyan + '='.repeat(80) + colors.reset + '\n');
}

function printSection(text: string) {
  console.log('\n' + colors.bright + colors.blue + text + colors.reset);
  console.log(colors.blue + '-'.repeat(80) + colors.reset);
}

function loadScenario(filename: string): any {
  const filepath = path.join(__dirname, '..', 'test-data', filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(content);
}

function runScenario(scenarioFile: string) {
  const scenario = loadScenario(scenarioFile);

  printHeader(`${scenario.name}`);
  console.log(colors.yellow + 'Description:' + colors.reset);
  console.log(scenario.description);

  printSection('Input Data');
  console.log(`Work Centers: ${scenario.workCenters.length}`);
  scenario.workCenters.forEach((wc: any) => {
    console.log(`  - ${wc.data.name} (${wc.docId})`);
    console.log(`    Shifts: ${wc.data.shifts.map((s: any) =>
      `Day ${s.dayOfWeek}: ${s.startHour}:00-${s.endHour}:00`).join(', ')}`);
    if (wc.data.maintenanceWindows.length > 0) {
      console.log(`    Maintenance: ${wc.data.maintenanceWindows.length} window(s)`);
      wc.data.maintenanceWindows.forEach((mw: any) => {
        console.log(`      • ${mw.startDate} to ${mw.endDate}`);
        if (mw.reason) console.log(`        Reason: ${mw.reason}`);
      });
    }
  });

  console.log(`\nWork Orders: ${scenario.workOrders.length}`);
  scenario.workOrders.forEach((wo: any) => {
    const deps = wo.data.dependsOnWorkOrderIds.length > 0
      ? ` (depends on: ${wo.data.dependsOnWorkOrderIds.join(', ')})`
      : '';
    console.log(`  - ${wo.data.workOrderNumber}${deps}`);
    console.log(`    Duration: ${wo.data.durationMinutes} minutes`);
    console.log(`    Original: ${wo.data.startDate} to ${wo.data.endDate}`);
  });

  printSection('Running Reflow Algorithm...');

  const input: ReflowInput = {
    workOrders: scenario.workOrders,
    workCenters: scenario.workCenters,
    manufacturingOrders: scenario.manufacturingOrders,
  };

  const service = new ReflowService();
  const result = service.reflow(input);

  printSection('Results');
  console.log(result.explanation);

  if (result.changes.length > 0) {
    printSection('Changes Made');
    // Group changes by work order
    const changesByOrder = new Map<string, any[]>();
    result.changes.forEach(change => {
      if (!changesByOrder.has(change.workOrderId)) {
        changesByOrder.set(change.workOrderId, []);
      }
      changesByOrder.get(change.workOrderId)!.push(change);
    });

    changesByOrder.forEach((changes, orderId) => {
      const woNumber = changes[0].workOrderNumber;
      console.log(`\n${colors.yellow}${woNumber}:${colors.reset}`);

      changes.forEach(change => {
        const delayText = change.delayMinutes > 0
          ? colors.red + `+${Math.round(change.delayMinutes)} min` + colors.reset
          : colors.green + 'on time' + colors.reset;

        console.log(`  ${change.field}: ${change.oldValue}`);
        console.log(`            → ${change.newValue} (${delayText})`);
        console.log(`  Reason: ${change.reason}`);
      });
    });
  } else {
    console.log(colors.green + '✓ No changes needed - schedule is already optimal' + colors.reset);
  }

  printSection('Updated Schedule');
  result.updatedWorkOrders.forEach(wo => {
    console.log(`\n${wo.data.workOrderNumber}:`);
    console.log(`  Start:    ${wo.data.startDate}`);
    console.log(`  End:      ${wo.data.endDate}`);
    console.log(`  Duration: ${wo.data.durationMinutes} minutes`);
    console.log(`  Work Center: ${wo.data.workCenterId}`);
  });

  if (result.isValid) {
    console.log('\n' + colors.green + colors.bright + '✓ VALID SCHEDULE' + colors.reset);
  } else {
    console.log('\n' + colors.red + colors.bright + '✗ INVALID SCHEDULE' + colors.reset);
    if (result.violations && result.violations.length > 0) {
      console.log('\nViolations:');
      result.violations.forEach(v => {
        console.log(`  ${colors.red}✗${colors.reset} ${v}`);
      });
    }
  }
}

// Main execution
function main() {
  console.log(colors.bright + colors.cyan);
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║         Production Schedule Reflow - Algorithm Demonstration             ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const scenarios = [
    'scenario-1-delay-cascade.json',
    'scenario-2-shift-boundary.json',
    'scenario-3-maintenance.json',
  ];

  scenarios.forEach((scenarioFile, index) => {
    runScenario(scenarioFile);

    if (index < scenarios.length - 1) {
      console.log('\n\n');
    }
  });

  printHeader('Demo Complete');
  console.log('All scenarios have been processed.');
  console.log('\nKey features demonstrated:');
  console.log('  ✓ Dependency management (DAG with topological sort)');
  console.log('  ✓ Work center conflict prevention');
  console.log('  ✓ Shift boundary handling (pause/resume)');
  console.log('  ✓ Maintenance window avoidance');
  console.log('  ✓ Constraint validation');
  console.log('');
}

main();
