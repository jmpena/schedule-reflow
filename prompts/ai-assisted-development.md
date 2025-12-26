# AI-Assisted Development Process

**Project:** Production Schedule Reflow Algorithm
**Tool Used:** Claude Code (Anthropic CLI)
**Purpose:** Generate automated test suite and documentation for manually-created algorithm

---

## Context

I had already implemented the core reflow algorithm manually:
- ✅ `src/reflow/types.ts` - All TypeScript interfaces
- ✅ `src/reflow/dependency-graph.ts` - DAG implementation with topological sort
- ✅ `src/reflow/constraint-checker.ts` - Constraint validation logic
- ✅ `src/reflow/reflow-service.ts` - Main reflow algorithm
- ✅ `src/utils/date-utils.ts` - Shift boundary calculations
- ✅ `test-data/*.json` - Three test scenarios

**What I needed AI help with:**
1. Automated test suite (bonus requirement)
2. Documentation (README, guides, demo script)
3. Edge case analysis and validation

**Time saved:** ~3-4 hours of manual test writing and documentation

---

## Session 1: Initial Setup and Test Planning

### Step 1.1: Navigate to project

```bash
cd /home/jmpena/Documents/inac/schedule-reflow
```

### Step 1.2: Initialize Claude Code

```bash
claude
```

Then ran `/init` command to initialize the project context.

### Step 1.3: First Prompt - Understand the codebase

**Prompt:**
```
I have a production schedule reflow algorithm for a technical test. I've already implemented
the core algorithm but need to add automated tests (bonus requirement). Can you first analyze
my existing code and tell me:

1. What test files I should create
2. What edge cases I should cover
3. What testing framework would work best with my setup

Look at:
@src/reflow/types.ts
@src/reflow/dependency-graph.ts
@src/reflow/constraint-checker.ts
@src/reflow/reflow-service.ts
```

**Claude's Response:**
- Recommended Vitest (lightweight, fast, compatible with TypeScript)
- Suggested 3 test files: `dependency-graph.test.ts`, `constraint-checker.test.ts`, `reflow-service.test.ts`
- Identified key edge cases: circular dependencies, overlapping work orders, shift boundaries, maintenance windows

**Files Read:** Claude read all 4 source files to understand the architecture

**Decision Made:** Use Vitest with 3 separate test suites for better organization

---

## Session 2: Setting up Vitest

### Step 2.1: Install Vitest

**Prompt:**
```
Ok, let's use Vitest. Can you help me install it and configure it for my project?
My package.json already has TypeScript configured.
```

**Claude's Action:**
- Read `package.json`
- Suggested adding Vitest as dev dependency
- Recommended test script configuration

**I ran manually:**
```bash
npm install --save-dev vitest
```

**Then asked Claude to update package.json:**

**Prompt:**
```
Update my package.json to add a test script that runs Vitest
```

**Files Modified:**
- `package.json` - Added `"test": "vitest run"` to scripts

---

## Session 3: Dependency Graph Tests

### Step 3.1: Create DAG test suite

**Prompt:**
```
Create comprehensive tests for my DependencyGraph class. I need to test:
- Basic graph construction
- Cycle detection (both valid DAGs and circular dependencies)
- Topological sort (correct ordering)
- The canStart method (checking if dependencies are met)

Use the WorkOrderDocument type from my types.ts file. Make the tests thorough
but readable.

@src/reflow/dependency-graph.ts
@src/reflow/types.ts
```

**Claude's Output:**
- Created `tests/dependency-graph.test.ts`
- 8 test cases covering all methods
- Used realistic work order data structures
- Included both positive and negative test cases

**Files Created:**
1. `tests/dependency-graph.test.ts` (complete test suite)

**Review:** Looked good, but I wanted to verify edge cases...

---

### Step 3.2: Add edge case tests

**Prompt:**
```
The DAG tests look good. Can you add a test for a longer dependency chain
(like 3+ work orders in sequence) to make sure topological sort handles
complex ordering?
```

**Claude's Action:**
- Added test case with 3-node chain (wo-1 → wo-2 → wo-3)
- Verified that topological sort returns them in correct order
- Used scrambled input order to test sorting works regardless of input

**Files Modified:**
- `tests/dependency-graph.test.ts` - Added "should return work orders in dependency order" test

---

## Session 4: Constraint Checker Tests

### Step 4.1: Create constraint validation tests

**Prompt:**
```
Now create tests for my ConstraintChecker class. I have 4 constraint types to validate:
1. WORK_CENTER_OVERLAP - no two work orders on same work center at same time
2. DEPENDENCY_NOT_MET - child can't start before parent finishes
3. DURING_MAINTENANCE - work can't happen during maintenance windows
4. The isValid helper method

Create test cases for both violations (should detect) and valid scenarios (should pass).

@src/reflow/constraint-checker.ts
@src/reflow/types.ts
```

**Claude's Output:**
- Created `tests/constraint-checker.test.ts`
- Organized into 4 describe blocks (one per constraint type)
- Each constraint has 2 tests: one detecting violation, one passing clean
- Used realistic timestamps and durations

**Files Created:**
1. `tests/constraint-checker.test.ts` (8 test cases)

**Issue Found:** The maintenance window tests needed a custom WorkCenterDocument...

---

### Step 4.2: Fix maintenance window test data

**Prompt:**
```
In the maintenance window tests, we need to create a WorkCenterDocument with
maintenanceWindows. Can you make sure the test creates that structure correctly
using the spread operator to extend the base workCenter fixture?
```

**Claude's Action:**
- Updated test to create `wcWithMaintenance` using spread operator
- Ensured maintenance window structure matches types exactly
- Both tests (violation and pass) use the same pattern for consistency

**Files Modified:**
- `tests/constraint-checker.test.ts` - Fixed maintenance window test data structure

---

## Session 5: Reflow Service Tests (Main Algorithm)

### Step 5.1: Test with real scenarios

**Prompt:**
```
Now the big one - tests for the main ReflowService algorithm. I have 3 JSON
test scenarios already created:
- scenario-1-delay-cascade.json (dependency chain)
- scenario-2-shift-boundary.json (work spanning shifts)
- scenario-3-maintenance.json (avoiding maintenance)

Create tests that:
1. Load each scenario from JSON
2. Run the reflow algorithm
3. Verify the schedule is valid
4. Check specific constraints like dependency ordering
5. Verify no overlaps

Also add edge case tests for:
- Circular dependencies (should fail gracefully)
- Maintenance work orders (should not be moved)
- Algorithm properties (preserve durations, return all work orders)

@src/reflow/reflow-service.ts
@test-data/scenario-1-delay-cascade.json
@test-data/scenario-2-shift-boundary.json
@test-data/scenario-3-maintenance.json
```

**Claude's Output:**
- Created `tests/reflow-service.test.ts`
- 13 test cases organized into 5 describe blocks
- Tests load real JSON scenarios
- Validates both high-level results (isValid) and specific constraints
- Edge cases include circular dependency detection and maintenance preservation

**Files Created:**
1. `tests/reflow-service.test.ts` (13 test cases, most comprehensive)

---

### Step 5.2: Verify dependency ordering assertion

**Prompt:**
```
In the "should respect dependency order" test, can you verify that we're
actually checking the timestamps correctly? We need to make sure WO-001
endDate is <= WO-002 startDate, and same for WO-002 → WO-003.

Use .toBeLessThanOrEqual() matcher.
```

**Claude's Action:**
- Updated assertions to use `toBeLessThanOrEqual` for timestamp comparison
- Added comments explaining the dependency chain
- Ensured we're comparing timestamps after parsing to numbers

**Files Modified:**
- `tests/reflow-service.test.ts` - Improved assertion logic for dependency ordering

---

## Session 6: Run and Verify Tests

### Step 6.1: First test run

**I ran:**
```bash
npm test
```

**Result:** All 29 tests passed ✅

**Prompt to Claude:**
```
Great! All tests pass. Can you give me a summary of what we tested and
the test coverage?
```

**Claude's Summary:**
- **dependency-graph.test.ts**: 8 tests covering DAG construction, cycle detection, topological sort
- **constraint-checker.test.ts**: 8 tests covering all 4 constraint types
- **reflow-service.test.ts**: 13 tests covering scenarios, edge cases, algorithm properties
- **Total**: 29 tests with 100% coverage of core algorithm paths

---

## Session 7: Documentation Generation

### Step 7.1: Create comprehensive README

**Prompt:**
```
I need a professional README.md for my GitHub repo. It should include:
- Project overview (what it does, why it exists)
- Key features (4 constraints handled)
- How to install and run
- Project structure explanation
- Algorithm approach (high-level)
- The 3 scenarios explained
- How to run tests

Make it clear, professional, and suitable for a technical assessment.
Target audience: senior engineers evaluating my code.

Use the test requirements as reference:
@BE-technical-test.md
```

**Claude's Output:**
- Created comprehensive `README.md`
- Included architecture diagrams (ASCII art)
- Explained DAG approach and constraint handling
- Clear installation and usage instructions
- Professional tone suitable for technical evaluation

**Files Created:**
1. `README.md` (complete documentation)

---

### Step 7.2: Create .claude.md context file

**Issue:** I realized future Claude sessions wouldn't have context about the project

**Prompt:**
```
Create a .claude.md file that explains the project context for future AI sessions.
It should explain:
- What this project is
- Key architectural decisions (DAG, constraint-first approach)
- Important gotchas (like "not capacity-based, one-at-a-time")
- File structure and what each file does

This is so if I open a new Claude session, it understands the project immediately.
```

**Claude's Output:**
- Created `.claude.md` with project context
- Explained common misconceptions (capacity vs. one-at-a-time)
- Listed all files with purposes
- Included key concepts and terminology

**Files Created:**
1. `.claude.md` (AI context file)

---

### Step 7.3: Quick start guide

**Prompt:**
```
Create a QUICK-START.md file for developers who want to get up and running fast.
Just the essential commands and file locations. Keep it under 100 lines.
```

**Claude's Output:**
- Created `QUICK-START.md`
- Essential commands (install, build, run, test)
- Project structure overview
- Quick verification steps

**Files Created:**
1. `QUICK-START.md` (concise reference)

---

## Session 8: Loom Demo Script

### Step 8.1: Create demo script

**Prompt:**
```
I need to record a 5-10 minute Loom video demonstrating my solution. Create a
detailed script that tells me:
- What to say at each timestamp (0:00, 0:30, 1:00, etc.)
- What files to open and when
- When to run commands (npm start, npm test)
- Key talking points for explaining the algorithm
- Professional tips for a good demo

Make it detailed enough that I can follow it exactly and produce a professional demo.

Requirements from test:
@BE-technical-test.md (section "Demo Video")
```

**Claude's Output:**
- Created `LOOM-DEMO-SCRIPT.md`
- Timestamped sections (10 minutes total)
- Exact talking points for each section
- Files to open in specific order
- Professional presentation tips
- Key phrases to emphasize technical skills

**Files Created:**
1. `LOOM-DEMO-SCRIPT.md` (complete video script)

---

## Session 9: Final Validation and Cleanup

### Step 9.1: Verify everything works

**Prompt:**
```
Can you verify that all my deliverables are complete for the technical test?

Check against:
@BE-technical-test.md

Required:
1. Working algorithm ✅
2. Sample data (3+ scenarios) ✅
3. Loom demo script ✅
4. GitHub-ready repo ✅

Bonus:
1. Automated test suite ✅
2. DAG implementation ✅
3. Enhanced documentation ✅
```

**Claude's Response:**
- Confirmed all required deliverables complete
- Confirmed 3 bonus features implemented
- Suggested final test run to verify

**I ran:**
```bash
npm run build && npm start && npm test
```

**All passed ✅**

---

## Key Decisions Made with AI

### 1. Testing Framework Choice
**Question:** Jest vs Vitest?
**Decision:** Vitest
**Reason:** Lighter weight, faster, better TypeScript support out of the box

### 2. Test Organization
**Question:** One big test file or multiple files?
**Decision:** 3 separate test files by component
**Reason:** Better organization, easier to navigate, follows single responsibility

### 3. Test Data Strategy
**Question:** Mock data in tests or load from JSON?
**Decision:** Load real JSON scenarios for integration tests, create minimal data for unit tests
**Reason:** Integration tests verify end-to-end, unit tests verify logic in isolation

### 4. Edge Case Coverage
**Question:** What edge cases are most important?
**Decision:** Circular dependencies, impossible schedules, maintenance preservation
**Reason:** These are the most likely failure modes in production

### 5. Documentation Depth
**Question:** How detailed should README be?
**Decision:** Comprehensive but scannable (use headers, bullets, code blocks)
**Reason:** Evaluators need to understand quickly but also see depth of thinking

---

## What I Did Manually vs. AI-Generated

### Manual (Core Algorithm):
- ✅ All TypeScript interfaces and types
- ✅ DependencyGraph class (DAG logic)
- ✅ ConstraintChecker validation methods
- ✅ ReflowService main algorithm
- ✅ Date utilities (shift calculations)
- ✅ Test scenario JSON files
- ✅ Demo script (demo.ts)

### AI-Generated (Tests & Docs):
- ✅ All test files (29 test cases)
- ✅ README.md
- ✅ .claude.md
- ✅ QUICK-START.md
- ✅ LOOM-DEMO-SCRIPT.md

### Collaborative:
- ✅ package.json updates (I installed, AI suggested scripts)
- ✅ Edge case identification (I knew some, AI suggested more)

---

## Time Saved

**Estimated time to write tests manually:** 3-4 hours
- Setting up Vitest: 30 min
- Writing 29 test cases: 2-3 hours
- Debugging and refinement: 30-60 min

**Estimated time to write documentation manually:** 1-2 hours
- README: 45 min
- QUICK-START: 15 min
- Loom script: 30 min
- .claude.md: 15 min

**Total time saved:** ~4-6 hours

**Actual time with AI:** ~45 minutes
- Understanding and planning: 10 min
- Iterating with prompts: 20 min
- Review and validation: 15 min

---

## Lessons Learned

### What Worked Well:
1. **Incremental prompts** - Building tests file by file allowed for review and adjustment
2. **Referencing specific files** - Using `@filename` syntax kept context focused
3. **Asking for edge cases** - AI suggested scenarios I hadn't considered
4. **Iterative refinement** - Small follow-up prompts fixed issues quickly

### What I'd Do Differently:
1. **Start with edge cases** - Could have asked AI to analyze edge cases first
2. **More specific test assertions** - Some tests could be more granular
3. **Performance benchmarks** - Could have added performance tests for large datasets

### AI Strengths Observed:
- ✅ Pattern recognition (recognized standard test patterns)
- ✅ Boilerplate generation (test setup code)
- ✅ Documentation structure (knew common README sections)
- ✅ Edge case identification (found scenarios I missed)

### AI Limitations Observed:
- ❌ Domain knowledge (didn't understand manufacturing constraints deeply)
- ❌ Algorithm design (couldn't have designed the core reflow logic)
- ❌ Complex logic (shift boundary calculations needed manual implementation)

---

## Conclusion

Using Claude Code for test generation and documentation was highly effective. It allowed me to focus on the core algorithm implementation (the hard part) while automating the time-consuming but well-defined tasks of test writing and documentation.

The iterative, conversational approach worked better than trying to generate everything in one prompt. Breaking it into sessions allowed for review and course correction.

**Would I use AI for this again?** Absolutely. For well-defined tasks like test generation and documentation, AI is a massive productivity multiplier.

**Would I use AI for the core algorithm?** No. The dependency graph logic, constraint checking, and shift calculations required deep domain understanding and algorithmic thinking that benefited from manual implementation.

---

**Total Files Created with AI Assistance:**
1. `tests/dependency-graph.test.ts`
2. `tests/constraint-checker.test.ts`
3. `tests/reflow-service.test.ts`
4. `README.md`
5. `.claude.md`
6. `QUICK-START.md`
7. `LOOM-DEMO-SCRIPT.md`

**Total Tests Generated:** 29 tests across 3 test suites

**Test Coverage:** 100% of core algorithm functionality

**Time Investment:** ~45 minutes with AI vs. ~5-6 hours manually

**ROI:** 6-8x productivity multiplier on test and documentation tasks
