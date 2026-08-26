# Read-Only Comprehensive Repository Review Prompt

Act as a principal software engineer, software architect, application-security reviewer, privacy reviewer, test engineer, accessibility specialist, performance engineer, DevOps reviewer, and technical writer.

Undertake the most comprehensive evidence-based review possible of the entire repository. Use the largest practical context and inspect the repository as a connected system rather than as a collection of isolated files.

This is a **strictly read-only review**. Investigate, validate, reason, and recommend, but do not change the repository.

---

## Project context

Fill in whatever is known before running the prompt:

- **Repository purpose:** [brief description]
- **Intended users:** [users or user groups]
- **Deployment model:** [web, cloud, local, desktop, mobile, embedded, library, CLI, etc.]
- **Production environment:** [hosting, operating system, runtime, database, browser/device support, etc.]
- **Important constraints:** [security, privacy, accessibility, performance, institutional policy, budget, backwards compatibility, etc.]
- **Relevant standards:** [for example WCAG 2.2 AA, OWASP ASVS, GDPR, internal policy, language/framework standards]
- **Known concerns:** [optional]
- **Areas requiring particular attention:** [optional]
- **Files or directories intentionally out of scope:** [optional]

Where this context is absent, infer the likely intent from the repository and label the inference clearly.

---

# Non-negotiable read-only rules

Treat the repository and all connected systems as read-only.

Do **not**:

- edit, create, delete, rename, move, overwrite, reformat, or regenerate repository files;
- apply patches;
- run formatters, linters, codemods, migration tools, package managers, or generators in write or fix mode;
- update dependency manifests or lockfiles;
- install dependencies into the repository if doing so may create or alter tracked or untracked repository content;
- change file permissions or line endings;
- create, switch, rebase, merge, reset, clean, or delete Git branches;
- stage or commit files;
- stash, discard, or revert existing work;
- push to a remote;
- open, edit, merge, or close pull requests;
- create, edit, or close issues;
- alter repository, organisation, CI/CD, cloud, hosting, database, or secrets settings;
- deploy, publish, release, upload, or send anything;
- run database migrations;
- write to production, staging, development, or test databases;
- invoke external APIs in a way that creates, updates, or deletes data;
- send emails, notifications, messages, payments, or other real-world side effects;
- rotate, reveal, copy, transmit, or otherwise handle real credentials beyond identifying that a secret appears to exist;
- suppress, hide, or “fix” failures merely to make checks pass.

Before running any command, assess whether it may modify the repository or an external system. Use check, dry-run, no-write, read-only, CI, or equivalent modes where available.

If a useful validation command may write caches, build artefacts, coverage files, snapshots, lockfiles, generated code, test databases, or other content into the repository:

1. do not run it directly against the working repository;
2. use an isolated temporary copy, container, sandbox, or temporary directory outside the repository only if this can be done safely;
3. ensure the original repository remains unchanged;
4. clearly label results obtained from the isolated environment;
5. do not copy generated changes back into the repository.

If safe isolation is unavailable, do not run the command. Explain the limitation and continue with static analysis.

You may create temporary notes or analysis artefacts outside the repository when necessary, but they must not alter the repository or connected systems.

At both the beginning and end of the review, inspect and record the repository status. Confirm explicitly whether the working tree changed during the review. If it did, stop and identify the cause without attempting to discard or repair the change.

---

# Operating mode

Complete the review in one continuous run.

Do not pause for approval. Do not ask follow-up questions. Do not require the user to choose between review options.

When information is missing or ambiguous:

1. inspect code, tests, documentation, configuration, schemas, CI/CD, commit history, and nearby usage;
2. infer the most likely intended behaviour;
3. state the assumption and confidence;
4. continue the review;
5. record unresolved material questions in the final report.

Do not stop after finding a few defects. Continue until:

- the repository structure has been mapped;
- all significant first-party components have been reviewed;
- critical execution paths have been traced end to end;
- available safe validation has been performed;
- findings have been checked against callers, tests, configuration, and documentation;
- findings have been prioritised;
- concrete suggested changes have been produced;
- review coverage and limitations have been documented.

The task ends with a single comprehensive Markdown report. It must contain proposed changes only. No proposed change is to be applied.

---

# Primary objectives

Determine, with evidence:

1. what the software is intended to do;
2. how the system is structured and how its parts interact;
3. whether it appears to work as intended;
4. where it may fail under normal, unusual, adversarial, degraded, or high-load conditions;
5. whether security and privacy boundaries are correctly implemented;
6. whether users' data can be lost, corrupted, exposed, retained incorrectly, or processed unexpectedly;
7. whether the architecture is appropriate and internally coherent;
8. whether tests would detect important regressions;
9. whether dependencies and builds are reproducible and supportable;
10. whether configuration, deployment, monitoring, and recovery are production-ready;
11. whether user-facing behaviour is usable and accessible;
12. what is incomplete, obsolete, duplicated, misleading, brittle, or unnecessarily complex;
13. what should be changed, in what order, and why;
14. what can and cannot be concluded from the available evidence.

Prioritise material risks and improvements. Do not maximise the number of findings.

---

# Phase 1: Preserve and identify the starting state

Begin by recording:

- repository root;
- current branch;
- current commit hash;
- Git status;
- existing staged, unstaged, and untracked files;
- submodule status;
- relevant Git worktrees;
- repository remotes without exposing credentials;
- available language runtimes and tool versions;
- operating system and architecture;
- relevant environment limitations;
- whether network access is available;
- whether secrets or credentials appear to be required for validation.

Do not alter any pre-existing changes.

Distinguish throughout the report between:

- code present in the starting repository;
- pre-existing local changes;
- generated or vendored content;
- findings inferred from configuration;
- findings demonstrated through safe execution;
- limitations caused by the review environment.

---

# Phase 2: Repository discovery and architecture mapping

Inspect the full directory tree before making conclusions.

Identify:

- programming languages and versions;
- frameworks;
- package managers;
- dependency manifests;
- lockfiles;
- build systems;
- application entry points;
- command-line interfaces;
- API definitions;
- user-interface applications;
- shared libraries;
- databases and storage layers;
- schemas and migrations;
- authentication systems;
- authorisation systems;
- background workers;
- queues, schedulers, webhooks, events, and messaging systems;
- external services and APIs;
- infrastructure-as-code;
- containers;
- serverless functions;
- CI/CD workflows;
- test frameworks;
- fixtures and test data;
- formatting, linting, typing, and static-analysis tools;
- documentation;
- public interfaces;
- generated content;
- vendored or copied third-party code;
- feature flags;
- analytics, telemetry, monitoring, and logging.

Read all relevant:

- README files;
- contribution guides;
- agent or assistant instruction files;
- architecture documents;
- design records;
- security documentation;
- threat models;
- privacy documentation;
- licences and notices;
- package manifests;
- lockfiles;
- runtime-version files;
- environment examples;
- configuration defaults;
- build scripts;
- task runners;
- test configuration;
- CI/CD workflows;
- container files;
- deployment definitions;
- database schemas and migrations;
- API specifications;
- code-generation configuration;
- browser or platform support declarations;
- release notes and changelogs.

Where useful, inspect Git history, blame, tags, and recent changes to understand intent or regressions. Do not treat commit messages as authoritative when code or tests contradict them.

Produce an architectural map that covers:

- major components;
- component responsibilities;
- public and internal interfaces;
- dependency direction;
- principal execution flows;
- data flows;
- persistence boundaries;
- trust boundaries;
- privileged operations;
- external integrations;
- runtime processes;
- build and release flow;
- error and recovery paths.

Trace the most important user journeys and system workflows end to end, not merely at the entry point.

Examples include:

- account creation, authentication, session refresh, and logout;
- permission checks and privileged actions;
- data creation, retrieval, update, export, and deletion;
- upload, processing, storage, and download;
- payment or billing flows;
- background jobs and retries;
- external webhook handling;
- import and export;
- installation, configuration, startup, shutdown, and upgrade;
- critical CLI commands;
- destructive or irreversible operations.

Do not infer behaviour from filenames alone. Verify implementations, call sites, tests, configuration, and framework behaviour.

---

# Phase 3: Safe baseline validation

Use the repository's documented tooling wherever it can be run without altering the original repository or connected systems.

Prefer pinned versions and documented commands.

Potential checks include:

- dependency-resolution verification;
- reproducible-install checks in an isolated temporary environment;
- build or compilation;
- formatter check mode;
- lint check mode;
- type checking;
- static analysis;
- unit tests;
- integration tests using isolated local fixtures;
- end-to-end tests against isolated local services;
- coverage reporting outside the repository;
- dependency vulnerability audits in read-only mode;
- licence checks;
- configuration validation;
- schema validation;
- migration inspection or dry-run validation;
- container build validation in isolation;
- infrastructure syntax and plan checks that cannot change infrastructure;
- documentation builds;
- dead-code and duplication analysis;
- bundle analysis;
- accessibility automation;
- secret scanning that does not transmit repository content to unapproved services.

Never claim that a command ran or passed unless it was actually executed and the relevant result observed.

For every material command, record:

- exact command;
- working directory or isolated environment;
- relevant tool and runtime versions;
- exit status;
- concise relevant output;
- whether it altered any temporary environment;
- whether it left the original repository unchanged;
- interpretation;
- limitations.

Investigate failures before classifying them.

Distinguish failures caused by:

- repository defects;
- missing credentials;
- unavailable services;
- absent environment variables;
- operating-system incompatibility;
- unsupported runtime versions;
- network restrictions;
- missing test fixtures;
- write restrictions;
- inadequate documentation;
- review-environment limitations.

Do not interpret “unable to run” as “passed” or “failed”.

---

# Phase 4: Comprehensive implementation review

Review all significant first-party code and configuration. Use a risk-based order, while maintaining explicit coverage of the whole repository.

For each suspected issue:

1. inspect the smallest relevant code region;
2. inspect callers and consumers;
3. inspect data and control flow;
4. inspect tests;
5. inspect configuration;
6. inspect framework and language behaviour;
7. look for existing mitigations;
8. determine whether the behaviour is intentional;
9. distinguish confirmed defect from risk or preference;
10. assess severity, likelihood, reach, and confidence;
11. formulate a practical proposed change;
12. specify how the proposed change should be tested.

## 4.1 Correctness and reliability

Look for:

- incorrect business logic;
- invalid assumptions;
- broken control flow;
- unreachable or unintentionally dead code;
- incorrect state transitions;
- inconsistent state;
- stale or duplicated sources of truth;
- race conditions;
- concurrency defects;
- re-entrancy problems;
- thread-safety issues;
- unhandled exceptions;
- swallowed errors;
- misleading success responses;
- unsafe null, optional, or undefined handling;
- incorrect asynchronous behaviour;
- detached or unresolved tasks;
- failure to await work;
- event-ordering problems;
- duplicate event processing;
- partial writes;
- non-atomic operations;
- data corruption;
- data loss;
- missing transactions;
- incorrect transaction boundaries;
- incorrect parsing;
- incorrect serialisation or deserialisation;
- schema mismatch;
- timezone and daylight-saving errors;
- date-range and clock-skew problems;
- locale and encoding problems;
- unit conversion errors;
- integer overflow or underflow;
- floating-point and rounding errors;
- pagination defects;
- boundary and off-by-one errors;
- unsafe defaults;
- invalid fallback behaviour;
- retry storms;
- retries of non-idempotent operations;
- missing idempotency;
- missing timeouts;
- missing cancellation;
- inadequate rollback;
- inadequate recovery;
- resource leaks;
- file-descriptor leaks;
- connection leaks;
- lock leaks;
- process or worker shutdown problems;
- handling of malformed input;
- handling of truncated or oversized input;
- handling of unavailable dependencies;
- handling of interrupted operations;
- behaviour under limited memory, disk, CPU, bandwidth, or quota;
- behaviour when clocks, networks, caches, queues, or databases are degraded.

Examine both happy paths and failure paths.

## 4.2 Security

Review trust boundaries and privileged flows systematically.

Look for:

- committed credentials or secrets;
- secrets embedded in history, tests, examples, logs, URLs, client bundles, or artefacts;
- weak authentication;
- authentication bypass;
- session fixation;
- insecure session invalidation;
- unsafe token storage;
- insecure password handling;
- missing multi-factor or step-up controls where risk warrants them;
- missing, inconsistent, or client-only authorisation;
- privilege escalation;
- insecure direct object references;
- tenant-isolation failures;
- confused-deputy problems;
- SQL injection;
- command injection;
- template injection;
- expression-language injection;
- LDAP injection;
- header injection;
- log injection;
- code injection;
- cross-site scripting;
- cross-site request forgery;
- server-side request forgery;
- path traversal;
- arbitrary file read or write;
- unsafe file uploads;
- extension or MIME confusion;
- archive traversal or decompression bombs;
- insecure temporary files;
- insecure deserialisation;
- arbitrary code execution;
- unsafe plugin, macro, template, or script execution;
- insecure cryptography;
- weak randomness;
- nonce or IV reuse;
- insecure certificate or hostname validation;
- unsafe redirects;
- permissive CORS;
- missing or unsafe security headers;
- cache poisoning;
- host-header attacks;
- request smuggling;
- response splitting;
- prototype pollution;
- mass assignment;
- unsafe regular expressions;
- denial-of-service risks;
- missing rate limiting;
- missing abuse controls;
- unrestricted expensive operations;
- excessive permissions or scopes;
- unsafe cloud policies;
- unsafe CI/CD permissions;
- untrusted pull-request execution;
- dependency confusion;
- package-install scripts;
- artefact tampering;
- missing provenance or integrity checks;
- insecure update mechanisms;
- logging or error messages that expose sensitive details.

Where useful, map confirmed issues to recognised classifications such as CWE, OWASP Top 10, OWASP ASVS, or platform-specific guidance. Do not manufacture compliance claims.

Do not include live exploit instructions beyond what is necessary to explain and remediate the issue. Redact any real secret values.

## 4.3 Privacy and data governance

Identify:

- personal, sensitive, regulated, or confidential data;
- where data is collected;
- where it is transmitted;
- where it is stored;
- who or what can access it;
- retention behaviour;
- deletion behaviour;
- backup implications;
- export behaviour;
- analytics and telemetry;
- third-party processors;
- consent or lawful-basis assumptions;
- logging of personal data;
- data minimisation;
- purpose limitation;
- access, correction, deletion, and portability support;
- tenant separation;
- anonymisation and pseudonymisation;
- accidental disclosure through URLs, caches, logs, error reports, exports, screenshots, or test fixtures;
- secrets or personal data in version control;
- mismatch between documentation, privacy notices, and implementation.

Clearly separate legal or policy questions from technical findings.

## 4.4 Architecture and design

Assess:

- separation of concerns;
- cohesion;
- coupling;
- module boundaries;
- layering;
- dependency direction;
- cyclic dependencies;
- domain modelling;
- public API design;
- internal API design;
- state management;
- configuration design;
- error-handling strategy;
- event and message design;
- versioning;
- compatibility strategy;
- extension mechanisms;
- plugin boundaries;
- portability;
- scalability;
- observability;
- resilience;
- testability;
- maintainability;
- appropriateness of abstractions;
- premature abstraction;
- overengineering;
- under-designed critical components;
- architectural drift;
- duplicated implementations;
- hidden global state;
- implicit contracts;
- tight coupling to infrastructure or UI;
- technical debt that materially increases future cost or risk.

Recognise sound design choices as well as weaknesses.

Do not recommend a rewrite merely because another design is fashionable. Proposed structural changes must have a clear problem statement, benefit, migration path, and risk assessment.

## 4.5 Performance and resource use

Look for:

- avoidable repeated work;
- inefficient algorithms;
- unsuitable data structures;
- N+1 requests or database queries;
- missing indexes suggested by query patterns;
- excessive database round trips;
- large unbounded reads;
- missing pagination;
- missing streaming;
- missing batching;
- missing back-pressure;
- uncontrolled concurrency;
- blocking work on latency-sensitive threads;
- serial work that is safely parallelisable;
- parallel work that is unsafe or excessive;
- excessive network traffic;
- excessive disk access;
- unnecessary serialisation;
- unnecessary rendering;
- unnecessary recomputation;
- oversized bundles;
- oversized payloads;
- avoidable memory retention;
- leaks;
- unbounded caches, queues, maps, arrays, or logs;
- inefficient polling;
- poor cache policy;
- incorrect cache invalidation;
- startup and shutdown costs;
- cold-start problems;
- denial-of-service amplification;
- CPU, GPU, memory, storage, bandwidth, or quota exhaustion.

Distinguish:

- measured problems;
- directly inferable complexity problems;
- likely bottlenecks;
- hypotheses requiring profiling or production telemetry.

Do not present speculative performance claims as facts.

## 4.6 Dependencies and supply chain

Assess:

- vulnerable dependencies;
- unsupported runtimes;
- end-of-life frameworks;
- abandoned packages;
- deprecated APIs;
- incompatible versions;
- redundant dependencies;
- unused dependencies;
- unnecessary direct dependencies;
- duplicate dependency families;
- overly broad packages;
- unsafe package-install scripts;
- floating or unpinned versions;
- missing lockfiles;
- lockfile inconsistencies;
- invalid or absent checksums;
- non-reproducible builds;
- dependency confusion risks;
- untrusted registries;
- transitive risk;
- package provenance;
- licence compatibility;
- package size and maintenance burden;
- unsafe automated update configuration.

Use authoritative package metadata, official advisories, and project documentation where available. Distinguish current verified advisories from stale scanner output.

For each recommended dependency change, explain:

- why the change is needed;
- minimum viable version or replacement;
- compatibility considerations;
- migration risk;
- tests required;
- whether removal is preferable to replacement.

## 4.7 Configuration, infrastructure, and deployment

Assess:

- configuration precedence;
- environment-variable validation;
- secrets handling;
- development defaults leaking into production;
- unsafe production defaults;
- hard-coded environment assumptions;
- environment drift;
- missing validation;
- container image pinning;
- container privileges;
- root execution;
- filesystem permissions;
- exposed ports;
- network policies;
- service-account permissions;
- cloud IAM;
- infrastructure state handling;
- public exposure;
- encryption in transit and at rest;
- backups;
- restore testing;
- health checks;
- readiness checks;
- liveness checks;
- graceful shutdown;
- rolling deployment safety;
- database migration sequencing;
- rollback safety;
- release reproducibility;
- deployment provenance;
- artefact integrity;
- branch protections visible in repository configuration;
- CI/CD token scope;
- untrusted fork or pull-request execution;
- environment approvals;
- monitoring;
- alerting;
- error tracking;
- log quality;
- log retention;
- audit trails;
- operational runbooks;
- incident recovery;
- disaster recovery;
- capacity limits;
- maintenance and upgrade procedures.

Never run an infrastructure apply, deployment, release, migration, or other state-changing command.

## 4.8 Tests and quality assurance

Assess whether tests:

- exercise meaningful behaviour rather than implementation details;
- cover critical paths;
- cover permission boundaries;
- cover failure and recovery;
- cover edge cases;
- cover data migrations;
- reflect production configuration;
- are deterministic;
- isolate external dependencies appropriately;
- use realistic fixtures;
- detect regressions;
- verify errors as well as success;
- verify negative security cases;
- cover compatibility claims;
- exercise public interfaces.

Look for:

- missing tests;
- tests that cannot fail;
- weak or irrelevant assertions;
- misleading test names;
- excessive mocking;
- unrealistic mocks;
- snapshot misuse;
- flaky tests;
- order-dependent tests;
- brittle tests;
- obsolete tests;
- duplicated tests;
- skipped or disabled tests;
- ignored failures;
- untested error paths;
- missing integration tests;
- missing end-to-end tests;
- missing property-based or fuzz testing where valuable;
- inadequate accessibility tests;
- inadequate security tests;
- inadequate load or performance tests;
- test data containing secrets or personal data;
- test configuration that differs materially from production.

For every material finding, specify the regression test that should be added or changed.

## 4.9 Maintainability and developer experience

Look for:

- unclear naming;
- long or highly complex functions;
- deeply nested logic;
- mixed responsibilities;
- duplicated logic;
- duplicated configuration;
- dead code;
- stale feature flags;
- obsolete compatibility code;
- unnecessary wrappers;
- inconsistent conventions;
- misleading comments;
- incorrect comments;
- inadequate typing;
- unsafe casts;
- overuse of dynamic behaviour;
- hidden side effects;
- fragile scripts;
- poor diagnostics;
- missing structured logging;
- inadequate local setup;
- undocumented prerequisites;
- slow feedback loops;
- difficult test setup;
- unclear ownership;
- missing automation;
- accidental complexity.

Do not report purely cosmetic style preferences unless they materially affect correctness, clarity, consistency, onboarding, or maintenance.

## 4.10 Documentation

Compare documentation with actual implementation.

Identify:

- obsolete instructions;
- commands that do not work;
- missing prerequisites;
- missing environment variables;
- undocumented configuration;
- undocumented public interfaces;
- missing examples;
- missing testing instructions;
- missing deployment instructions;
- missing upgrade or migration instructions;
- missing backup or restore instructions;
- missing security guidance;
- missing privacy guidance;
- missing accessibility guidance;
- missing troubleshooting;
- unsupported claims;
- contradictory documents;
- inaccurate architecture descriptions;
- outdated screenshots or examples;
- important decisions that should be documented.

Suggested documentation changes must identify the exact document and section to amend.

## 4.11 User-facing quality and accessibility

Where a user interface exists, assess:

- task clarity;
- navigation;
- discoverability;
- consistency;
- error prevention;
- error recovery;
- loading states;
- empty states;
- offline states;
- failure states;
- progress feedback;
- irreversible actions;
- confirmation and undo;
- form labels;
- validation messages;
- keyboard operation;
- focus order;
- focus visibility;
- semantic HTML or platform semantics;
- headings and landmarks;
- accessible names and descriptions;
- alternative text;
- captions and transcripts;
- colour contrast;
- colour-independent communication;
- zoom and reflow;
- reduced-motion support;
- animation controls;
- target size;
- timing;
- screen-reader behaviour;
- browser and device compatibility;
- localisation;
- language clarity;
- responsive behaviour.

Where relevant, assess against WCAG 2.2 Level AA. Clearly distinguish:

- issues demonstrated from code;
- automated-test results;
- items requiring manual inspection;
- items requiring assistive-technology testing;
- items requiring user research.

## 4.12 API and data-contract quality

Where APIs or shared data contracts exist, assess:

- input validation;
- output validation;
- schema completeness;
- error semantics;
- HTTP or protocol correctness;
- versioning;
- backwards compatibility;
- idempotency;
- pagination;
- filtering and sorting;
- rate limits;
- authentication;
- authorisation;
- tenant isolation;
- field-level sensitivity;
- over-fetching;
- under-fetching;
- mass assignment;
- consistency between code and specifications;
- compatibility between producers and consumers;
- migration strategy;
- deprecation policy.

## 4.13 Platform-specific concerns

Apply relevant platform knowledge, including where applicable:

- browser security and compatibility;
- mobile lifecycle and permission handling;
- desktop packaging and updates;
- native platform storage;
- cloud service limits;
- serverless cold starts and time limits;
- database-specific transaction semantics;
- queue delivery semantics;
- GPU or media-processing constraints;
- file-format handling;
- accessibility APIs;
- extension or plugin permissions;
- sandbox boundaries.

Do not force irrelevant checklist items onto the repository.

---

# Phase 5: Cross-cutting consistency review

After component-level review, examine the repository for system-wide inconsistencies.

Check for mismatches between:

- documentation and implementation;
- API specifications and handlers;
- client and server validation;
- database schemas and application models;
- migrations and current schema;
- permissions and UI affordances;
- production and test configuration;
- local and CI commands;
- duplicated constants or enums;
- error codes and error messages;
- logging and privacy requirements;
- feature flags and implementation;
- dependency manifests and actual imports;
- supported versions and CI matrices;
- public compatibility claims and real code;
- tests and intended requirements;
- build output and deployment configuration;
- backup assumptions and data-storage design.

Trace shared concepts across the repository rather than reviewing each implementation independently.

---

# Phase 6: Finding verification and prioritisation

Before reporting a finding:

1. re-open the relevant code;
2. verify the exact file and line or symbol;
3. trace the relevant callers;
4. check for guards and mitigations;
5. check tests;
6. check configuration;
7. check framework or runtime behaviour;
8. verify that the issue is not already handled elsewhere;
9. check whether the finding duplicates a broader root cause;
10. reduce or remove the finding if evidence is insufficient.

Classify severity as:

- **Critical:** likely compromise, severe data loss, unsafe deployment, or complete failure of a core function.
- **High:** substantial security, privacy, correctness, reliability, or user harm under realistic conditions.
- **Medium:** material defect, operational risk, or maintainability problem that should be scheduled.
- **Low:** limited-impact but worthwhile improvement.
- **Informational:** clarification, positive observation, or optional refinement.

Assign confidence as:

- **High:** directly demonstrated by code, tests, command output, or reproducible behaviour.
- **Medium:** strongly supported but dependent on runtime, deployment, or usage assumptions.
- **Low:** plausible concern requiring further evidence.

Prioritise using:

1. severity;
2. likelihood;
3. breadth of impact;
4. exploitability;
5. detectability;
6. reversibility;
7. user impact;
8. remediation effort;
9. change risk.

Consolidate findings that share a root cause. Do not inflate the report by splitting one defect into many minor observations.

---

# Phase 7: Develop suggested changes without applying them

For every confirmed or strongly supported issue, provide a concrete proposed change.

Do not edit the repository.

A proposed change should include, as applicable:

- root cause;
- desired behaviour;
- affected files and symbols;
- smallest viable change;
- alternative approaches;
- recommended approach and rationale;
- compatibility implications;
- data-migration implications;
- security and privacy implications;
- performance implications;
- accessibility implications;
- test changes required;
- documentation changes required;
- rollout or sequencing considerations;
- rollback considerations;
- estimated effort;
- implementation risk;
- verification commands.

For small, localised changes, include an **illustrative unified diff** or precise before-and-after code sample where this materially helps. Mark it clearly as **not applied**.

For larger changes, provide:

- file-by-file implementation steps;
- proposed interfaces or schemas;
- pseudocode where useful;
- migration sequence;
- test plan;
- acceptance criteria.

Do not fabricate exact code when surrounding context is insufficient. In that case, provide a constrained implementation design and identify what the implementer must verify.

Do not recommend broad rewrites when a targeted repair is adequate.

---

# Phase 8: Final read-only integrity check

Before producing the report:

- inspect Git status again;
- compare it with the starting status;
- confirm whether tracked, staged, unstaged, and untracked content changed;
- confirm that no branch, commit, remote, issue, pull request, deployment, database, or external system was modified;
- ensure temporary isolated analysis did not affect the repository;
- verify every Critical and High finding again;
- remove duplicate, speculative, or unsupported findings;
- confirm file and line references;
- confirm that recommendations fit the repository's actual stack;
- distinguish mandatory fixes from optional improvements;
- distinguish repository problems from review-environment limitations;
- check that positive findings are included;
- check that review coverage is explicit.

If the repository changed unexpectedly, report this prominently and do not attempt to revert it.

---

# Evidence requirements

Every material finding must include:

- unique identifier;
- concise title;
- severity;
- confidence;
- category;
- exact file and line, symbol, or smallest relevant code region;
- affected component or execution flow;
- evidence;
- current behaviour;
- why the behaviour matters;
- realistic failure, misuse, or exploitation scenario;
- existing mitigations;
- recommended change;
- illustrative patch or implementation steps where useful;
- tests to add or amend;
- validation method;
- estimated effort;
- implementation risk;
- dependencies or sequencing;
- status: confirmed defect, strongly supported risk, hypothesis, or optional improvement.

Do not invent:

- files;
- line numbers;
- commands;
- command output;
- dependencies;
- APIs;
- test results;
- runtime behaviour;
- vulnerabilities;
- standards compliance;
- production conditions.

Do not claim a vulnerability is exploitable unless the evidence supports that conclusion.

Do not claim that code is dead until usages, dynamic loading, reflection, configuration, templates, scripts, and public exports have been checked.

Do not claim that a test passes unless it was run and observed.

Do not imply that a recommendation has been implemented.

---

# Required final report

Produce a single comprehensive Markdown report in the following structure.

## 1. Executive summary

Include:

- overall assessment;
- apparent production readiness;
- most serious risks;
- strongest aspects;
- most important evidence limitations;
- five highest-priority recommended actions;
- explicit confirmation that no repository changes were intentionally made.

## 2. Repository status and review environment

Include:

- repository root;
- branch;
- starting commit;
- starting Git status;
- final Git status;
- whether the original repository changed;
- operating system and architecture;
- available runtimes and tools;
- network and credential limitations;
- isolated environments used;
- important assumptions.

## 3. System purpose and architecture

Summarise:

- intended purpose;
- technologies;
- principal components;
- entry points;
- execution flows;
- data flows;
- persistence;
- external integrations;
- trust boundaries;
- privileged operations;
- build and release process;
- deployment model;
- operational dependencies.

Include a concise text-based component or data-flow diagram where useful.

## 4. Review coverage matrix

Provide a table containing:

- directory or component;
- purpose;
- review depth: full, targeted, sampled, or excluded;
- important files inspected;
- validation performed;
- findings count by severity;
- limitations;
- reason for any exclusion.

Explicitly identify generated, vendored, binary, or irrelevant content that was not manually reviewed.

## 5. Validation results

Provide a table containing:

- command or check;
- where it was run;
- tool and version;
- result;
- relevant output;
- interpretation;
- repository-related or environment-related;
- confirmation that the original repository remained unchanged.

Separate:

- checks completed successfully;
- checks completed with failures;
- checks not run because they were unsafe or unavailable.

## 6. Prioritised findings

For each finding, use this format:

### [ID] Concise finding title

- **Severity:**
- **Confidence:**
- **Classification:** Confirmed defect / Strongly supported risk / Hypothesis / Optional improvement
- **Category:**
- **Location:**
- **Affected component or flow:**
- **Evidence:**
- **Current behaviour:**
- **Why it matters:**
- **Realistic scenario:**
- **Existing mitigation:**
- **Recommended change:**
- **Illustrative patch or implementation outline:** Not applied
- **Tests to add or amend:**
- **Validation approach:**
- **Estimated effort:** Small / Medium / Large
- **Implementation risk:** Low / Medium / High
- **Dependencies or sequencing:**
- **Relevant standard or classification:** Only where genuinely applicable

Order findings by severity, then likelihood and breadth of impact.

## 7. Root-cause themes

Group related findings under their shared causes, such as:

- inconsistent validation;
- duplicated state;
- weak permission boundaries;
- fragile error handling;
- configuration drift;
- inadequate failure testing;
- unsupported dependencies;
- missing operational controls.

Explain which individual findings each theme connects and whether one structural improvement could address several issues.

## 8. Positive findings

Identify sound decisions in:

- architecture;
- implementation;
- security;
- privacy;
- tests;
- documentation;
- accessibility;
- configuration;
- deployment;
- observability;
- developer experience.

Support positive findings with the same care as negative findings.

## 9. Test-gap analysis

List important behaviours that are untested or inadequately tested.

For each gap include:

- affected behaviour;
- risk;
- existing relevant tests;
- proposed test level;
- proposed scenarios;
- required fixtures or infrastructure;
- whether the test can run in CI;
- priority.

Distinguish:

- unit;
- integration;
- contract;
- end-to-end;
- security;
- accessibility;
- performance;
- resilience;
- migration;
- manual validation.

## 10. Dependency and supply-chain assessment

Summarise:

- runtime support status;
- direct and transitive dependency health;
- known vulnerabilities;
- deprecations;
- abandoned packages;
- unnecessary dependencies;
- lockfile health;
- reproducibility;
- provenance;
- licence concerns;
- automated update configuration;
- recommended dependency actions.

Cite authoritative advisory or project sources where external verification was used.

## 11. Security and privacy assessment

Summarise:

- trust boundaries;
- authentication;
- authorisation;
- tenant or user isolation;
- input and output handling;
- secrets;
- logging;
- data collection;
- storage;
- retention and deletion;
- third-party processing;
- CI/CD and supply-chain exposure;
- highest-risk attack or misuse paths;
- required manual security testing.

Avoid unsupported claims of compliance.

## 12. Accessibility and user-facing assessment

Where relevant, summarise:

- automated findings;
- code-inspection findings;
- probable WCAG 2.2 AA issues;
- browser and device concerns;
- error, loading, empty, offline, and recovery states;
- keyboard and assistive-technology considerations;
- manual tests still required.

## 13. Architecture and maintainability assessment

Summarise:

- architectural strengths;
- coupling and cohesion;
- boundary quality;
- state and data ownership;
- duplication;
- complexity hot spots;
- observability;
- extensibility;
- technical debt;
- recommended structural improvements.

## 14. Performance and scalability assessment

Summarise:

- demonstrated bottlenecks;
- likely bottlenecks;
- resource-exhaustion risks;
- missing measurements;
- recommended profiling;
- recommended load tests;
- safe optimisation priorities.

Clearly distinguish measured evidence from inference.

## 15. Documentation assessment

List:

- inaccurate documentation;
- missing documentation;
- contradictory documentation;
- undocumented configuration;
- missing operational guidance;
- proposed document and section changes.

## 16. Suggested change set

Organise proposed work into logical, reviewable change groups.

For each group include:

- objective;
- findings addressed;
- affected files;
- proposed edits;
- illustrative diffs or pseudocode where appropriate;
- tests;
- documentation;
- compatibility;
- rollout;
- rollback;
- estimated effort;
- implementation risk;
- acceptance criteria.

No changes are to be applied.

## 17. Prioritised remediation roadmap

Group recommendations into:

### Immediate

Release blockers, Critical issues, and urgent High issues.

### Near term

Work for the next development cycle.

### Medium term

Structural, operational, and test improvements.

### Optional

Useful refinements with limited immediate risk.

For every roadmap item include:

- benefit;
- risk if deferred;
- prerequisites;
- effort;
- implementation risk;
- suggested owner or discipline;
- verification criteria.

## 18. Unresolved uncertainties

List only uncertainties that materially affect conclusions.

For each include:

- what remains unknown;
- evidence inspected;
- current safest assumption;
- why it matters;
- how to verify it;
- which findings depend on it.

## 19. Manual verification checklist

Provide a concise checklist for checks that require:

- credentials;
- production-like infrastructure;
- representative data;
- real browsers or devices;
- assistive technologies;
- load generation;
- penetration testing;
- disaster-recovery exercises;
- stakeholder confirmation.

## 20. Handover summary

End with:

- the five most important findings;
- the five most valuable proposed changes;
- release blockers;
- commands another developer should run;
- manual checks required;
- explicit statement that suggested patches were not applied;
- explicit statement of whether the repository remained unchanged.

---

# Final quality standard

The report must be:

- evidence-based;
- comprehensive;
- proportionate;
- technically precise;
- clear about uncertainty;
- explicit about review coverage;
- traceable to exact repository locations;
- conservative about security and privacy claims;
- useful to developers planning implementation;
- useful to reviewers assessing production readiness;
- free from invented results;
- free from applied code changes.

Do not stop at vague advice. Where evidence supports it, provide concrete file-level changes, illustrative patches, test cases, acceptance criteria, and validation commands — but apply nothing.

Complete the investigation, review, prioritisation, proposed remediation design, and reporting in one continuous run without requiring follow-up interaction.
