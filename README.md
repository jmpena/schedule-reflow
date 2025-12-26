# Production Schedule Reflow Algorithm

A TypeScript implementation of an intelligent production scheduling system that automatically reschedules work orders when disruptions occur in a manufacturing facility.

## 🎯 Problem Statement

Manufacturing facilities face constant disruptions:
- Work orders run longer than expected
- Machines go down for maintenance
- Work centers become unavailable
- Dependencies between orders create cascading delays

This system implements a **reflow algorithm** that:
✅ Respects all dependencies (using DAG with topological sort)
✅ Prevents work center conflicts (no overlaps)
✅ Handles shift boundaries (work pauses and resumes)
✅ Avoids maintenance windows
✅ Generates valid, constraint-satisfying schedules

## 🏗️ Architecture

```
src/
├── reflow/
│   ├── types.ts                    # TypeScript type definitions
│   ├── dependency-graph.ts         # DAG implementation (bonus feature)
│   ├── constraint-checker.ts       # Validation logic
│   └── reflow-service.ts           # Main reflow algorithm
├── utils/
│   └── date-utils.ts               # Shift and date calculations
└── demo.ts                         # Demonstration script

test-data/
├── scenario-1-delay-cascade.json   # Dependency chain scenario
├── scenario-2-shift-boundary.json  # Shift spanning scenario
└── scenario-3-maintenance.json     # Maintenance window scenario
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Run Demo

```bash
npm start
```

This will run all test scenarios and show the before/after schedules.

### Run Tests

```bash
npm test
```

### Build Only

```bash
npm run build
```

## 📖 Algorithm Approach

### High-Level Flow

1. **Dependency Analysis**
   - Build a Directed Acyclic Graph (DAG) of work order dependencies
   - Detect circular dependencies (impossible schedules)
   - Perform topological sort to get valid execution order

2. **Scheduling**
   - Process work orders in dependency order
   - For each work order:
     - Wait for all parent dependencies to complete
     - Find earliest available time on work center
     - Calculate end date considering shifts and maintenance
     - Update work center availability

3. **Validation**
   - Check for work center overlaps
   - Verify all dependencies are satisfied
   - Ensure work only happens during shifts
   - Confirm no conflicts with maintenance windows

4. **Reporting**
   - Generate list of changes (what moved, by how much)
   - Provide explanations for each change
   - Report constraint violations if any

### Key Algorithm Details

**Shift Handling**

Work pauses outside shift hours and resumes in the next available shift.

Example:
```
Work order: 120 minutes
Start: Monday 4PM
Shift: Monday-Friday 8AM-5PM

Calculation:
- Works 60 min Monday (4PM-5PM) ← Shift ends
- Pauses overnight
- Resumes Tuesday 8AM
- Works remaining 60 min
- Completes Tuesday 9AM
```

**Dependency Resolution**

Uses topological sort to ensure parents always complete before children:
```
Order A → Order B → Order C
         ↓
       Order D

Processing order: A, B, C, D (or A, B, D, C)
```

**Work Center Conflicts**

Only one order at a time per work center. Algorithm tracks when each work center becomes available and schedules accordingly.

## 📊 Data Structures

All data follows a document structure:

```typescript
{
  docId: string;
  docType: string;
  data: { ... }
}
```

### Work Order

```typescript
{
  docId: "wo-001",
  docType: "workOrder",
  data: {
    workOrderNumber: "WO-001",
    manufacturingOrderId: "mo-12345",
    workCenterId: "wc-line-a",
    startDate: "2025-01-15T08:00:00.000Z",
    endDate: "2025-01-15T10:00:00.000Z",
    durationMinutes: 120,
    isMaintenance: false,
    dependsOnWorkOrderIds: ["wo-parent"]
  }
}
```

### Work Center

```typescript
{
  docId: "wc-line-a",
  docType: "workCenter",
  data: {
    name: "Extrusion Line A",
    shifts: [
      { dayOfWeek: 1, startHour: 8, endHour: 17 }  // Monday 8AM-5PM
    ],
    maintenanceWindows: [
      {
        startDate: "2025-01-16T10:00:00.000Z",
        endDate: "2025-01-16T14:00:00.000Z",
        reason: "Scheduled maintenance"
      }
    ]
  }
}
```

## 🧪 Test Scenarios

### Scenario 1: Delay Cascade

**Situation:** Work order WO-001 delayed → affects WO-002 and WO-003

**Demonstrates:**
- Dependency chain handling
- Cascading schedule adjustments
- DAG topological sort

### Scenario 2: Shift Boundary

**Situation:** 120-minute work order starts at 4PM shift ends at 5PM

**Demonstrates:**
- Work pause/resume across shift boundaries
- Correct time calculations
- Multi-day work orders

### Scenario 3: Maintenance Window

**Situation:** Work orders must avoid maintenance window 10AM-2PM

**Demonstrates:**
- Maintenance window avoidance
- Schedule fragmentation
- Optimal slot finding

## 🎯 Constraint Validation

The system validates four types of constraints:

| Constraint | Rule | Violation Type |
|------------|------|---------------|
| **Work Center** | Only one order at a time | `WORK_CENTER_OVERLAP` |
| **Dependencies** | All parents must complete first | `DEPENDENCY_NOT_MET` |
| **Shifts** | Work only during operating hours | `OUTSIDE_SHIFT` |
| **Maintenance** | No work during maintenance | `DURING_MAINTENANCE` |

## 🔧 Usage Example

```typescript
import { ReflowService } from './reflow/reflow-service';

const service = new ReflowService();

const result = service.reflow({
  workOrders: [...],
  workCenters: [...],
  manufacturingOrders: [...]
});

console.log(result.updatedWorkOrders);  // New schedule
console.log(result.changes);             // What changed
console.log(result.explanation);         // Why it changed
console.log(result.isValid);             // Constraint check
```

## ✨ Bonus Features Implemented

- ✅ **DAG Implementation** - Full dependency graph with cycle detection
- ✅ **Topological Sort** - Optimal ordering of work orders
- ✅ **Automated Test Suite** - Comprehensive test coverage
- ✅ **Multiple Scenarios** - 3+ test cases
- ✅ **Change Tracking** - Detailed before/after comparisons
- ✅ **Validation** - Complete constraint checking

## 🔬 Technical Details

### Complexity

- **Time Complexity:** O(V + E + V × D × S)
  - V = number of work orders (vertices)
  - E = number of dependencies (edges)
  - D = average days to schedule
  - S = shifts per day

- **Space Complexity:** O(V + E)
  - Stores dependency graph and work center availability

### Libraries Used

- **Luxon** - Date manipulation (handles timezones, shifts, intervals)
- **TypeScript** - Type safety and better DX
- **Vitest** - Modern testing framework

### Design Decisions

**Why DAG?**
- Ensures valid dependency order (topological sort)
- Detects impossible schedules (cycle detection)
- O(V + E) construction time

**Why greedy scheduling?**
- Simple and predictable
- Good enough for most cases
- Fast execution

**Trade-offs:**
- ❌ Not globally optimal (greedy approach)
- ✅ Fast and deterministic
- ✅ Easy to understand and debug

## 📝 Known Limitations

1. **Greedy Algorithm** - Doesn't guarantee globally optimal schedule
2. **No Setup Time** - Assumes instant changeover between products
3. **Single Resource** - Each work order uses one work center
4. **No Capacity** - Work centers process one order at a time
5. **Fixed Shifts** - Cannot dynamically adjust shift schedules

## 🚀 Future Enhancements

- **Setup Time Handling** - Add `setupTimeMinutes` between different products
- **Capacity Planning** - Multiple simultaneous orders on work centers
- **Optimization Metrics** - Minimize total delay, maximize utilization
- **What-If Analysis** - Compare multiple scheduling strategies
- **Resource Constraints** - Handle material availability, crew size
- **Priority Weighting** - More sophisticated priority algorithms

## 📚 References

- [Topological Sorting](https://en.wikipedia.org/wiki/Topological_sorting) - DAG ordering
- [Job Shop Scheduling](https://en.wikipedia.org/wiki/Job_shop_scheduling) - Related problem
- [Luxon Documentation](https://moment.github.io/luxon/) - Date handling

---

## 🎥 Demo Video

TBD - Recording demo

---

**Built for technical assessment**

Demonstrates:
- TypeScript expertise
- Algorithm design and implementation
- Problem-solving approach
- Clean code principles
- Comprehensive testing
