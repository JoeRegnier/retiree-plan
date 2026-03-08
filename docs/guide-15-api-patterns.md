# API Patterns and Architecture

## Purpose and Role

The API is a NestJS application that sits between the database (Prisma/SQLite) and the frontend. Its responsibilities are: authenticating requests, reading and writing data via Prisma, mapping DB records into engine inputs, calling the appropriate finance-engine functions, and returning well-typed JSON responses.

**API root:** `apps/api/src/`  
**Tech stack:** NestJS 11, Prisma 6, SQLite (dev) / PostgreSQL (prod), Zod validation

---

## Module Structure

Each feature domain is a NestJS module in its own directory:

```
apps/api/src/
├── main.ts                    # NestJS bootstrap, global pipes, CORS, port
├── app.module.ts              # Root module — imports all feature modules
├── auth/                      # JWT auth (signup, login, guards)
├── households/                # Household + member CRUD
├── accounts/                  # Account + real estate CRUD
├── scenarios/                 # Scenario CRUD
├── projections/               # Projection execution (calls engine)
├── simulations/               # Monte Carlo + backtest execution
├── goals/                     # Goal CRUD + evaluation  
├── milestones/                # Milestone CRUD
├── estate/                    # Estate calculation
├── market-data/               # Assumptions + market data refresh
└── prisma/                    # PrismaService (database connection)
```

Each feature module contains:
- `*.module.ts` — NestJS module declaration (imports, providers, controllers)
- `*.controller.ts` — HTTP route handlers
- `*.service.ts` — Business logic (calls Prisma, calls engine)

---

## Standard Module Pattern

### Controller

```typescript
// households.controller.ts
@Controller('households')
@UseGuards(JwtAuthGuard)       // All routes require authentication
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.householdsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.householdsService.findOne(id, user.id);
  }

  @Post()
  create(@Body() dto: CreateHouseholdDto, @CurrentUser() user: User) {
    return this.householdsService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHouseholdDto,
    @CurrentUser() user: User,
  ) {
    return this.householdsService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.householdsService.remove(id, user.id);
  }
}
```

### Service

```typescript
// households.service.ts
@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    return this.prisma.household.findMany({
      where: { userId },
      include: { members: true },
    });
  }

  async findOne(id: string, userId: string) {
    const household = await this.prisma.household.findFirst({
      where: { id, userId },  // Always filter by userId — broken access control prevention
    });
    if (!household) throw new NotFoundException('Household not found');
    return household;
  }
  
  // create, update, remove follow same pattern
}
```

---

## Security Pattern: Always Filter by `userId`

**This is the most important security rule in the API.** Every database query that returns user data must include `where: { userId }` or a relation that ensures the requesting user owns the data. Never query without user scope.

```typescript
// ✅ Correct — user can only access their own data
const account = await this.prisma.account.findFirst({
  where: { id, household: { userId } },
});

// ❌ Wrong — any authenticated user can see any account
const account = await this.prisma.account.findFirst({
  where: { id },
});
```

NestJS's `@CurrentUser()` decorator extracts the authenticated user from the JWT payload. The `JwtAuthGuard` handles the cryptographic verification.

---

## Authentication

**File:** `apps/api/src/auth/`

JWT-based authentication:
1. `POST /auth/register` — Creates `User` record, returns JWT access token
2. `POST /auth/login` — Validates credentials, returns JWT access token
3. `POST /auth/refresh` — Accepts refresh token, returns new access token

The JWT contains `{ sub: userId, email }`. The `JwtStrategy` passport strategy decodes and validates the token on each request.

Guards:
- `JwtAuthGuard` — Used on `@UseGuards` decorator at controller or route level; requires a valid JWT
- Applied globally via `APP_GUARD` in `app.module.ts` so all routes are protected by default

---

## DTO (Data Transfer Object) Validation

DTOs are TypeScript classes that define the shape of request bodies. They use class-validator's `@IsString()`, `@IsNumber()`, `@IsOptional()` decorators to validate incoming data. NestJS's global `ValidationPipe` (set in `main.ts`) runs validation automatically on every request body.

```typescript
// create-scenario.dto.ts
import { IsNumber, IsString, Min, Max, IsOptional } from 'class-validator';

export class CreateScenarioDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(50) @Max(95)
  retirementAge: number;

  @IsNumber()
  @Min(55) @Max(120)
  endAge: number;

  @IsNumber()
  @Min(0) @Max(0.2)
  inflationRate: number;

  @IsOptional()
  @IsNumber()
  rrspAnnualContribution?: number;
}
```

Validation errors return a `400 Bad Request` with details of which fields failed and why. No manual validation code is needed in service methods.

---

## Projections Service — `buildProjectionPayload`

The most complex service in the API. It assembles a complete `CashFlowInput` from database records.

```typescript
// projections.service.ts
@Injectable()
export class ProjectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async runProjection(scenarioId: string, userId: string): Promise<ProjectionYear[]> {
    // 1. Load everything needed
    const scenario = await this.prisma.scenario.findFirst({
      where: { id: scenarioId, household: { userId } },
      include: {
        household: {
          include: {
            members: true,
            accounts: true,
            incomeSources: true,
            expenses: true,
            milestones: true,
            realEstate: true,
          },
        },
      },
    });
    if (!scenario) throw new NotFoundException();

    // 2. Map to CashFlowInput
    const input = this.buildProjectionPayload(scenario);

    // 3. Run the engine
    return runCashFlowProjection(input);
  }

  private buildProjectionPayload(scenario: ScenarioWithRelations): CashFlowInput {
    const { household } = scenario;
    const primaryMember = household.members[0];

    // Aggregate accounts by type
    const rrspBalance = sumAccountsByType(household.accounts, ['RRSP', 'RRIF']);
    const tfsaBalance = sumAccountsByType(household.accounts, ['TFSA']);
    const nonRegBalance = sumAccountsByType(household.accounts, ['NON_REG']);
    const cashBalance = sumAccountsByType(household.accounts, ['CASH']);

    // Map income sources
    const incomeSources = mapIncomeSources(household.incomeSources);

    // Map real estate rental income to income sources
    const rentalIncomes = mapRentalIncome(household.realEstate, primaryMember.currentAge);

    // Map milestones
    const milestoneInput = mapMilestones(household.milestones, primaryMember.currentAge);

    return {
      currentAge: primaryMember.currentAge,
      retirementAge: scenario.retirementAge,
      endAge: scenario.endAge,
      province: household.province as Province,
      employmentIncome: primaryMember.employmentIncome,
      incomeSources: [...incomeSources, ...rentalIncomes],
      annualExpenses: sumExpenses(household.expenses),
      inflationRate: scenario.inflationRate,
      nominalReturnRate: scenario.nominalReturnRate,
      rrspBalance,
      tfsaBalance,
      nonRegBalance,
      cashBalance,
      cppStartAge: scenario.cppStartAge,
      cppBenefitFraction: primaryMember.cppBenefitFraction ?? 0.75,
      oasStartAge: scenario.oasStartAge,
      glidePathSteps: (scenario.glidePath as GlidePathStep[]) ?? undefined,
      spendingPhases: (scenario.spendingPhases as SpendingPhase[]) ?? undefined,
      // Milestones are applied to specific projection years — see milestone mapping
    };
  }
}
```

---

## Error Handling

Standard NestJS HTTP exceptions are used throughout:

```typescript
throw new NotFoundException('Scenario not found');
throw new BadRequestException('Retirement age must be after current age');
throw new ForbiddenException('You do not have access to this household');
throw new UnauthorizedException();            // From JWT guard
throw new InternalServerErrorException();     // Unexpected engine errors
```

A global exception filter in `main.ts` ensures all unhandled errors return a consistent JSON shape:
```json
{
  "statusCode": 404,
  "message": "Scenario not found",
  "error": "Not Found"
}
```

Engine errors (e.g. invalid input causing NaN values) are caught in the service layer before they reach the controller.

---

## Prisma Patterns

**PrismaService** (`apps/api/src/prisma/prisma.service.ts`) is a singleton injected into all services. It wraps `PrismaClient` and handles connection lifecycle.

**Always use transactions** when creating related records:

```typescript
const household = await this.prisma.$transaction(async (tx) => {
  const hh = await tx.household.create({ data: householdData });
  await tx.householdMember.create({ data: { ...memberData, householdId: hh.id } });
  return hh;
});
```

**Include relations explicitly** — Prisma does not eager-load relations by default:

```typescript
const scenario = await this.prisma.scenario.findFirst({
  where: { id },
  include: {
    household: {
      include: { members: true, accounts: true }
    }
  }
});
```

**Schema migrations:**
```bash
npx prisma migrate dev --name description-of-change   # Create migration file
npx prisma generate                                     # Regenerate Prisma client
```

Run these from the repo root where `prisma/schema.prisma` lives.

---

## Market Data Module

The `market-data` module serves market assumptions and checks whether they need updating.

```typescript
// market-data.controller.ts
@Get('assumptions')
getCurrentAssumptions() {
  return this.marketDataService.getCurrentAssumptions();
}

@Post('refresh-check')
checkForRefresh() {
  return this.marketDataService.checkForRefresh();
  // Returns: { needsRefresh: boolean, lastRefreshDate: string, updatedLimits: {} }
}
```

`getCurrentAssumptions()` returns the `CAPITAL_MARKET_ASSUMPTIONS` constants from `packages/shared`. It does not hit an external API — all assumptions are stored as constants. The "refresh" concept is about alerting the user to check whether limits have been updated annually by CRA, not about automatically fetching new data.

---

## AI-Assisted Coding Quick Reference

**When adding a new API endpoint:**
1. Add the method to the appropriate service file (e.g. `scenarios.service.ts`)
2. Add the route to the controller with the correct HTTP verb and path
3. Add a DTO class if the endpoint accepts a request body with validation decorators
4. Ensure the where clause includes `userId` scope for security

**When adding a new Prisma model:**
1. Add the model to `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add-model-name`
3. Run `npx prisma generate` to regenerate the client
4. Add the corresponding Zod schema in `packages/shared/src/schemas/`
5. Create the NestJS module (controller + service) following the standard pattern

**When the engine returns unexpected values:**
- Check that `buildProjectionPayload` is correctly mapping all fields — a missing required field silently defaults to `0` or `undefined`
- Log the full `CashFlowInput` before calling `runCashFlowProjection` when debugging
- Rule out a DB-level issue: verify `prisma.account.findMany({ where: { householdId } })` returns the expected records

**What NOT to do:**
- Do not call Prisma directly in controllers — Prisma belongs in services
- Do not omit `userId` from `where` clauses — this is a broken access control vulnerability
- Do not add financial calculations to service methods — calculations belong in the engine
- Do not use `findFirstOrThrow` without first checking user ownership — it has no userId filter
- Do not use `@nestjs/config` environment variables for financial constants — they belong in `packages/shared/src/constants/`
