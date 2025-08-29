# Test Documentation

This folder contains comprehensive tests for the Endorser API, with detailed scenarios for plan management, JWT claims, and change detection functionality.

## Controller Endorser 6 Tests

The `controller-endorser-6-plans-totals.js` test file creates a sequence of plan JWTs that evolve over time, providing rich test data for validating the `plansLastUpdatedBetween` endpoint and related functionality.

### Timeline Overview

```mermaid
gantt
    title Plan-Creation Timeline in Test 6
    dateFormat X
    axisFormat %s
    
    section First Plan (User 1)
    Created firstPlanIdInternal             :milestone, m1, 1, 0d
    Updated firstPlanClaim2IdInternal       :milestone, m2, 3, 0d  
    Edited firstPlanClaim3IdInternal        :milestone, m3, 21, 0d

    section Second Plan (User 1)
    Created secondPlanIdInternal            :milestone, m4, 5, 0d

    section Child Plan (User 2)
    Created planBy2...Claim1IdInternal      :milestone, m5, 7, 0d
    Updated fulfills planBy2...Claim2IdInternal  :milestone, m6, 9, 0d
    Removed fulfills planBy2...Claim3IdInternal  :milestone, m7, 11, 0d

    section BVC Plan (User 1)
    Created bvcPlanLastClaimId              :milestone, m8, 13, 0d

    section Test Plan (User 1)
    Created testPlanIdInternal              :milestone, m9, 23, 0d
    Updated testPlanSecondClaimId           :milestone, m10, 25, 0d
```

### Detailed JWT Evolution Graph

```mermaid
graph TD
    subgraph "First Plan Evolution (User 1)"
        A1["firstPlanIdInternal<br/>Line 208: Initial Creation<br/>Test: 'v2 insert plan without ID'<br/>handleId: firstPlanIdExternal"] 
        A2["firstPlanClaim2IdInternal<br/>Line 485: Update desc + location<br/>Test: 'v2 update plan description & location'<br/>lastClaimId: firstPlanIdInternal<br/>handleId: firstPlanIdExternal"]
        A3["firstPlanClaim3IdInternal<br/>Line 3322: Update description only<br/>Test: 'v3 update plan description'<br/>lastClaimId: firstPlanClaim2IdInternal<br/>handleId: firstPlanIdExternal"]
        A1 --> A2
        A2 --> A3
    end

    subgraph "Second Plan (User 1)"
        B1["secondPlanIdInternal<br/>Line 578: Creation with external ID<br/>Test: 'v2 insert plan with external ID'<br/>handleId: secondPlanIdExternal"]
    end

    subgraph "Child Plan Evolution (User 2)"
        C1["planBy2FulfillsBy1Claim1IdInternal<br/>Line 795: Initial Creation<br/>Test: 'make child plan that fulfills another'<br/>handleId: planBy2FulfillsBy1Claim1IdExternal<br/>fulfills: firstPlanClaim2IdInternal"]
        C2["planBy2FulfillsBy1Claim2IdInternal<br/>Line 958: Update fulfills link<br/>Test: 'update child plan and update fulfills'<br/>lastClaimId: planBy2FulfillsBy1Claim1IdInternal<br/>fulfills: firstPlanClaim2IdInternal"]
        C3["planBy2FulfillsBy1Claim3IdInternal<br/>Line 993: Remove fulfills link<br/>Test: 'update plan and remove fulfills'<br/>lastClaimId: planBy2FulfillsBy1Claim2IdInternal<br/>fulfills: undefined"]
        C1 --> C2
        C2 --> C3
    end

    subgraph "Test Plan Evolution (User 1)"
        D1["testPlanIdInternal<br/>Line 3401: Initial Creation<br/>Test: 'create test plan for testing'<br/>handleId: testPlanIdExternal"]
        D2["testPlanSecondClaimId<br/>Line 3452: Update description<br/>Test: 'update the test plan'<br/>lastClaimId: testPlanIdInternal<br/>handleId: testPlanIdExternal"]
        D1 --> D2
    end

    subgraph "BVC Plan (User 1)"
        E1["bvcPlanLastClaimId<br/>Line 1080: Creation<br/>Test: 'insert BVC plan'<br/>handleId: not captured in variable"]
    end

    A2 -.->|references| A1
    A3 -.->|references| A2
    C1 -.->|fulfills| A2
    C2 -.->|fulfills| A2
    D2 -.->|references| D1
```
