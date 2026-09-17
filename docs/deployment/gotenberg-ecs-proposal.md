# Gotenberg on ECS Fargate — Production Runbook (AWS Console)

**Status:** Approved production baseline  
**How to operate this doc:** AWS **Console (GUI) only**. No AWS CLI.  
**Account:** `652821469470` (CashSouk)  
**Region:** **Asia Pacific (Malaysia) `ap-southeast-5`** — set this in the Console top-right **before every step**. A wrong region creates a second, empty set of resources.  
**Cluster:** `default` (this is the live cluster; older docs that say `cashsouk-prod` are stale)  
**Consumers:** Express API (`GOTENBERG_URL` → `POST /forms/libreoffice/convert`) for contract Letter of Offer `.docx` → PDF  
**Local today:** [`docker-compose.gotenberg.yml`](../../docker-compose.gotenberg.yml) on host port `3100`

This runbook matches how CashSouk already runs: JSON task definitions in git, Console for networking/services, GitHub Actions for app rollouts. It does **not** add Terraform, a public hostname, or a TLS certificate authority.

Keep a notepad while you work. You will copy IDs from the live API service and reuse them. Do **not** invent subnets or security groups from this file.

---

## 1. Goal

Run Gotenberg as a private, replaceable Fargate dependency — the same class of thing as RDS: reachable from the API only, never on the public ALB, never on the public internet.

Gotenberg’s own rule: treat it like a database; do not expose it ([Installation](https://gotenberg.dev/docs/getting-started/installation)).

```text
Internet → CloudFront/WAF → ALB → API (api.cashsouk.com)
                                    │
                                    ▼  private VPC
                               Cloud Map DNS
                               gotenberg.cashsouk.internal:3000
                                    │
                                    ▼  SG: TCP 3000 from API SG only
                               Gotenberg ECS service
                               (no public listener, no public hostname)
```

---

## 2. Verdict on the original proposal

The original shape is right. Several production defaults were not.

| Original claim | Verdict | Why |
|----------------|---------|-----|
| Separate Fargate service on cluster `default` | **Keep** | Matches API/portals; LibreOffice RAM stays off API tasks; independent scale and deploy |
| No public ALB host | **Keep** | Gotenberg must not be internet-facing |
| LibreOffice-only image, mirrored to ECR | **Keep** | Office → PDF only; ~40% smaller; no Chromium attack surface ([variants](https://gotenberg.dev/docs/getting-started/installation)) |
| Pin a patch version | **Keep, tighten** | Pin the **ECR digest** in the task definition, not only a floating tag |
| Port 3000, `GET /health` | **Keep** | Documented health route; the image ships `curl` |
| `--api-disable-download-from` | **Keep** | We upload multipart files; remote fetch is unused SSRF |
| `--libreoffice-auto-start=true` | **Keep** | `/health` includes a real LibreOffice process. Local compose does **not** set this today |
| Circuit breaker + rollback | **Keep** | Same as existing services |
| Keep Gotenberg out of the hot app deploy path | **Keep** | Image changes are rare; do not add this to `deploy.yml` |
| Sidecar in the API task | **Reject** | Every API replica would pay LibreOffice RAM for occasional PDFs |
| Lambda Gotenberg variant | **Reject** | Still beta; 6 MB response cap |
| Service Connect **or** Cloud Map | **Choose Cloud Map** | No Service Connect namespace today. Service Connect’s default request timeout is **15s**, which would kill 30–90s LibreOffice converts unless retuned |
| `--api-enable-basic-auth` on private HTTP | **Do not enable** | A password on plaintext HTTP is worse than security-group isolation. Add auth only after east-west TLS |
| `desiredCount: 1` | **Change to 2** | One task is an AZ/deploy outage. LibreOffice is one convert **per task**; that is why we run two tasks, not why we refuse to scale |
| `--api-timeout=120s` with API client 90s | **Invert** | Gotenberg 80s, API 90s, public ALB idle **120s** |
| Alarms optional | **Required** | A silent PDF outage is a production incident |
| Unbounded LibreOffice queue | **Bound it** | Default unlimited queue OOMs under load |

---

## 3. Production baseline (do not improvise these)

| Item | Value | Why |
|------|--------|-----|
| Image | `gotenberg/gotenberg:8.36.0-libreoffice` in ECR, task def uses `@sha256:…` | Patch from 2026-08-14. Recheck [releases](https://github.com/gotenberg/gotenberg/releases) before the first pull |
| ECR | Repo or pull-through name ending in Gotenberg; **scan on push**; pin digest in ECS | Tasks must not pull Docker Hub directly |
| CPU / memory | **1 vCPU / 2 GB** | Same band as the API; above Gotenberg’s K8s floor |
| Storage | Default **20 GiB** ephemeral (leave the extra-storage field empty) | Conversion files are temporary |
| Tasks | **Desired 2**, autoscaling **min 2 / max 4** | Survive one AZ or one rolling replace |
| Subnets | **Same as live API** (copy in preflight) | Multi-AZ without a second network |
| Public IP | **Same as live API** (likely **Turn on**) | How current API/migrate pull ECR. Do not set off until VPC endpoints exist |
| DNS | `http://gotenberg.cashsouk.internal:3000` | Cloud Map A records, TTL 10 seconds |
| Auth | **None** | SG isolation only |
| User | `1001:1001` | Image non-root user `gotenberg` |
| Privileged | Off; do **not** “drop all Linux capabilities” on first launch | Untested with LibreOffice |
| Read-only root | **Off** | Gotenberg/LibreOffice write workspaces |
| Task role | **None** | Gotenberg calls no AWS APIs. Execution role still pulls ECR and writes logs |
| Logs | `/ecs/cashsouk-gotenberg`, 30 days | Matches other `/ecs/cashsouk-*` groups |
| Health | `curl` to `http://127.0.0.1:3000/health` in the **task definition** | ECS ignores a Dockerfile HEALTHCHECK |
| Deploy | Min healthy **100%**, max **200%**, circuit breaker **on**, rollback **on** | New tasks healthy before old ones stop |
| AZ rebalancing | **On** | Spread after an AZ blip |

### 3.1 Command (container override — do not replace the entrypoint)

In the Console this is the container **Command** (JSON array). Leave **Entry point** empty so `tini` still runs.

```json
["gotenberg","--api-timeout=80s","--api-body-limit=10MB","--api-disable-download-from","--libreoffice-auto-start=true","--libreoffice-restart-after=10","--libreoffice-max-queue-size=4","--libreoffice-deny-private-ips","--libreoffice-deny-public-ips","--webhook-disable","--log-std-format=json","--gotenberg-graceful-shutdown-duration=90s"]
```

| Flag | Why |
|------|-----|
| `--api-timeout=80s` | Fail inside Gotenberg **before** the API’s 90s abort |
| `--api-body-limit=10MB` | LO templates are ~210 KB; no unbounded multipart |
| `--api-disable-download-from` | Unused SSRF feature; Gotenberg 8.32 made outbound fetch permissive again |
| `--libreoffice-auto-start=true` | First convert and `/health` include a real LO process |
| `--libreoffice-max-queue-size=4` | Queue-full becomes an error instead of OOM |
| `--libreoffice-deny-private-ips` and `--libreoffice-deny-public-ips` | Block LO fetching embedded remote images |
| `--webhook-disable` | Sync convert only |
| `--log-std-format=json` | CloudWatch Logs Insights |
| `--gotenberg-graceful-shutdown-duration=90s` | Drain one convert before ECS kills the task |

Do **not** add `--api-enable-basic-auth`.

### 3.2 Timeout order (must not invert)

| Layer | Value | Why |
|-------|--------|-----|
| Gotenberg `--api-timeout` | **80s** | Worker stops first |
| API client | **90s** (already in code) | Clean abort if Gotenberg hangs |
| Public ALB idle timeout | **120s** | AWS default is **60s**. A 90s API wait behind 60s is a **504** |
| Gotenberg graceful shutdown | **90s** | Drain one convert |
| ECS Stop timeout | **120s** (Fargate max) | Default 30s would kill a convert in flight |

### 3.3 What the API does today

[`convert-docx-to-pdf.ts`](../../apps/api/src/modules/applications/letter-of-offer/convert-docx-to-pdf.ts) reads only `GOTENBERG_URL` (no auth header). Unset URL → 503 `GOTENBERG_MISSING`. Until you set that env, production PDF download is already a clean 503. **Bring Gotenberg up first**, then the API env.

A timeout today is mapped as 500 `CONVERSION_FAILED`. Treat fixing that (timeout → 503) as a required code follow-up before calling the path done.

---

## 4. Current state

| Piece | Today |
|-------|--------|
| Production Gotenberg | Not deployed |
| `GOTENBERG_URL` on API | Absent from [`infra/ecs-task-definition-api.json`](../../infra/ecs-task-definition-api.json) |
| Live API service | `api-cashsouk-09ff` on cluster `default` |
| Live API task family | `default-api-cashsouk-09ff` |

If you set `GOTENBERG_URL` **only** in the Console and never in git, the next GitHub API deploy will wipe it. After Console wiring, also add the env to the JSON in the repo (or coordinate a deploy that includes it).

---

## 5. Preflight (fill this worksheet)

Open the Console. Region **ap-southeast-5**. Confirm the account is CashSouk (`652821469470`).

Copy these onto paper or a scratch file. Later steps use **your** values, not guesses.

### 5.1 Live API placement

1. Go to **Amazon ECS** → **Clusters** → **default**.
2. Open the **Services** tab → click **api-cashsouk-09ff**.
3. Open **Configuration and networking** (or **Networking**).
4. Write down:
   - **VPC** (id `vpc-…`)
   - **Subnets** (all of them; you need **at least two Availability Zones**)
   - **Security group(s)** on the API tasks (`sg-…`) — this is **API_SG**
   - **Public IP**: Turned on or off  
     (GitHub migrate/API config uses **on**. Match whatever you see here.)
5. Open **Health and metrics** / **Deployments**. Confirm the service is **Active** and tasks are running.
6. Open one **running task** → **Configuration**. Note **Task definition** revision and **Execution role** (expect `ecsTaskExecutionRole`). **Task role** is `ecsTaskRole` for the API; Gotenberg will use **none**.

Confirm subnets span two AZs:

1. **VPC** → **Subnets**.
2. Find each subnet id from step 4.
3. Check **Availability Zone**. If every subnet is the same AZ, stop and fix networking before continuing — two Gotenberg tasks in one AZ is not HA.

### 5.2 VPC DNS (required for Cloud Map)

1. **VPC** → **Your VPCs** → the VPC from §5.1.
2. **Actions** → **Edit VPC settings** (or the **DNS** tab).
3. **DNS resolution** (enableDnsSupport) = **Enabled**.
4. **DNS hostnames** (enableDnsHostnames) = **Enabled**.

If either is off, turn it on **now**. Otherwise `gotenberg.cashsouk.internal` never resolves inside API tasks.

### 5.3 Public ALB idle timeout

The user waits on `api.cashsouk.com` while the API waits on Gotenberg. This timeout is on the **public API load balancer**, not on Gotenberg.

1. Still on the API ECS service, find **Load balancing** → target group name.
2. **EC2** → **Target groups** → that group → **Load balancer** column → open the ALB.
3. ALB → **Attributes** tab → **Idle timeout**.
4. Write down the seconds. Default **60** must become **120** in §6.8.

### 5.4 Roles, logs, discovery, scanning, quota

| Check | Console path | What you want |
|-------|----------------|---------------|
| Execution role | **IAM** → **Roles** → `ecsTaskExecutionRole` | Exists (API already uses it) |
| Existing log groups | **CloudWatch** → **Log groups** → filter `/ecs/cashsouk` | API/portals already have 30-day groups; Gotenberg does not yet |
| Cloud Map | **Cloud Map** → **Namespaces** | Empty or unrelated is fine; you will create `cashsouk.internal` |
| ECR scanning | **Amazon ECR** → **Private registry** → **Scanning** | Basic scan-on-push is the floor; Enhanced/Inspector if the region offers it |
| Container Insights | **ECS** → cluster **default** → **Update cluster** / **Monitoring** | On or Enhanced. Needed for “running task count” alarms |
| Fargate vCPU quota | **Service Quotas** → **AWS Fargate** → **Fargate On-Demand vCPU resource count** | Headroom for **+2 vCPU** (two 1-vCPU tasks) on top of current API/portals |

### 5.5 Worksheet (fill in)

```text
Region:                 ap-southeast-5
Cluster:                default
API service:            api-cashsouk-09ff
VPC:                    vpc-________________
API subnets:            subnet-________ , subnet-________ , subnet-________
API security group:     sg-________________     (API_SG)
API public IP:          ON / OFF
ALB name:               ________________
ALB idle timeout now:   ______ seconds
Execution role:         ecsTaskExecutionRole
```

---

## 6. Setup in the Console (do these in order)

Do not skip. Each step exists because a later step fails, or a later outage is silent, without it.

### 6.1 ECR scanning (registry)

**Why:** Fargate must pull from ECR, not Docker Hub. You will **not** push with a laptop. §6.2 creates a **pull-through cache**; AWS then creates the cached repository on first pull (`docker-hub/gotenberg/gotenberg`). Pinning `@sha256` in the task definition is what makes the running image immutable (cache tags themselves stay mutable).

1. **Amazon ECR** → **Private registry** → **Scanning**.
2. If the region offers **Enhanced scanning** (Inspector), turn it on for this registry or add a rule that matches `docker-hub/gotenberg/*` (and `gotenberg-cashsouk` if you add a promotion repo later).
3. Otherwise leave **Basic** scan-on-push. After the first image appears in §6.7, open it and confirm findings before you pin the digest.

Optional later (CI or a one-off CodeBuild): a separate immutable repo named `gotenberg-cashsouk` for promoted copies. You do **not** need it to finish this Console setup.

### 6.2 Get the Gotenberg image into ECR (no laptop CLI)

The Console cannot upload a Docker image as a file. Use **ECR pull-through cache** so ECS pulls Docker Hub *through* ECR.

**Why:** The task definition must eventually pin a **digest**. Pull-through is how you acquire the image without AWS CLI. After the first successful pull, you copy the digest from ECR and pin it.

1. **Amazon ECR** → **Private registry** → **Pull through cache** → **Add rule**.
2. Upstream: **Docker Hub**.
3. ECR repository prefix: `docker-hub` (or the account default). Remember this prefix.
4. If Docker Hub **rate-limits** anonymous pulls (common), associate a **Secrets Manager** secret with Docker Hub username/password on this rule. Create that secret under **Secrets Manager** first; do not put Gotenberg basic-auth here — this is only Docker Hub.
5. **Save**.

The image URI you will use in the **first** task definition:

```text
652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/docker-hub/gotenberg/gotenberg:8.36.0-libreoffice
```

(If your prefix is not `docker-hub`, substitute it.)

**After the first Gotenberg task is running (§6.7):**

1. **ECR** → the cached repository (`docker-hub/gotenberg/gotenberg`) → **Images**.
2. Copy **Image digest** (`sha256:…`).
3. Create a **new task definition revision** (§6.6) whose image URI is:

```text
652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/docker-hub/gotenberg/gotenberg@sha256:PASTE_DIGEST
```

4. Update the ECS service to that revision.

Pull-through tags stay mutable. **The digest in the task definition** is what makes production immutable.

Do **not** go to §6.7 with HIGH/CRITICAL scan findings unless you record a written exception. Recheck [Gotenberg releases](https://github.com/gotenberg/gotenberg/releases) if 8.36.0 is no longer the current patch.

### 6.3 CloudWatch log group

**Why:** If this group is missing, the task starts then fails in a loop trying to create log streams.

1. **CloudWatch** → **Logs** → **Log groups** → **Create log group**.
2. Name: `/ecs/cashsouk-gotenberg` (exact, including the leading slash).
3. Retention: **30 days** (same as API/portals).
4. **Create**.

### 6.4 Dedicated security group

**Why:** Only the API task security group may open TCP 3000. Portals never talk to Gotenberg. Do not reuse the API SG as Gotenberg’s SG — that would allow every API-SG peer to call it.

1. **VPC** → **Security groups** → **Create security group**.
2. Name: `gotenberg-cashsouk-sg`.
3. Description: `Gotenberg ECS: TCP 3000 from API tasks only`.
4. VPC: the VPC from the worksheet.
5. **Inbound rules** → **Add rule**:
   - Type: **Custom TCP**
   - Port: **3000**
   - Source: **Custom** → paste **API_SG** (`sg-…` from the worksheet), **not** `0.0.0.0/0`, **not** the ALB SG
6. **Outbound rules:** leave the default **All traffic / 0.0.0.0/0** for launch **only if** the API service also has open egress (needed to pull ECR and write logs). Tightening egress is §12, not a launch blocker.
7. Tags: `Name=gotenberg-cashsouk-sg`, `Project=cashsouk`.
8. **Create**. Write down the new `sg-…` as **GOTENBERG_SG**.

### 6.5 Cloud Map namespace (DNS)

**Why:** Cloud Map is the smallest discovery model that matches current infra. TTL **10 seconds** so a dead task leaves DNS before the API’s 90s timeout hangs on a black hole.

Skip creating a namespace if **Cloud Map → Namespaces** already shows a **private DNS** namespace on **this VPC**. Reuse it and only create the `gotenberg` service (or let the ECS wizard do that in §6.7).

To create the namespace yourself:

1. **Cloud Map** → **Namespaces** → **Create namespace**.
2. Namespace name: `cashsouk.internal`.
3. Instance discovery: **API calls and DNS queries in VPCs**.
4. VPC: worksheet VPC.
5. Description: `CashSouk private ECS discovery`.
6. **Create**. Wait until status is **Active** (this is asynchronous).

You do **not** need a public hosted zone. You do **not** create `gotenberg.cashsouk.com`.

`GOTENBERG_URL` will be `http://gotenberg.cashsouk.internal:3000` (no trailing slash).

### 6.6 Register the task definition

**Why:** Health check, stop timeout, non-root user, and flags must live on the **registered** revision. Family name follows live services: `default-gotenberg-cashsouk`.

**Most reliable Console method:** paste JSON (avoids missing Stop timeout / health check in the form).

1. **Amazon ECS** → **Task definitions** → **Create new task definition** → **Create new task definition with JSON**.
2. Paste the JSON below.
3. For the **first** create, set `"image"` to the pull-through **tag** URI from §6.2.
4. After the first healthy pull, **Create new revision** with the **digest** URI.
5. Confirm **Task role** is absent / None. **Task execution role** is `ecsTaskExecutionRole`.
6. **Create**.

```json
{
  "family": "default-gotenberg-cashsouk",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::652821469470:role/service-role/ecsTaskExecutionRole",
  "runtimePlatform": {
    "cpuArchitecture": "X86_64",
    "operatingSystemFamily": "LINUX"
  },
  "containerDefinitions": [
    {
      "name": "gotenberg",
      "image": "652821469470.dkr.ecr.ap-southeast-5.amazonaws.com/docker-hub/gotenberg/gotenberg:8.36.0-libreoffice",
      "essential": true,
      "user": "1001:1001",
      "privileged": false,
      "stopTimeout": 120,
      "portMappings": [
        {
          "name": "gotenberg",
          "containerPort": 3000,
          "protocol": "tcp",
          "appProtocol": "http"
        }
      ],
      "command": [
        "gotenberg",
        "--api-timeout=80s",
        "--api-body-limit=10MB",
        "--api-disable-download-from",
        "--libreoffice-auto-start=true",
        "--libreoffice-restart-after=10",
        "--libreoffice-max-queue-size=4",
        "--libreoffice-deny-private-ips",
        "--libreoffice-deny-public-ips",
        "--webhook-disable",
        "--log-std-format=json",
        "--gotenberg-graceful-shutdown-duration=90s"
      ],
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -fsS -o /dev/null http://127.0.0.1:3000/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cashsouk-gotenberg",
          "awslogs-region": "ap-southeast-5",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

If the execution role ARN path differs (no `service-role/`), copy the ARN from **IAM** → `ecsTaskExecutionRole` → **ARN**.

**If you prefer the form instead of JSON**, set the same values:

| Form field | Value |
|------------|--------|
| Task definition family | `default-gotenberg-cashsouk` |
| Launch type | AWS Fargate |
| OS / Architecture | Linux / **X86_64** |
| CPU | 1 vCPU |
| Memory | 2 GB |
| Task role | **None** |
| Task execution role | `ecsTaskExecutionRole` |
| Container name | `gotenberg` |
| Image URI | pull-through URI, then digest |
| Port mappings | 3000 / TCP / HTTP |
| Command | the JSON array in §3.1 |
| Entry point | empty |
| User | `1001:1001` |
| Privileged | off |
| Read-only root | off |
| Stop timeout | **120** seconds (under additional container config) |
| Health check | Command `CMD-SHELL`, `curl -fsS -o /dev/null http://127.0.0.1:3000/health \|\| exit 1`, interval 30, timeout 5, retries 3, start period 60 |
| Logging | awslogs, group `/ecs/cashsouk-gotenberg`, region `ap-southeast-5`, prefix `ecs` |
| Docker configuration — execute command | **off** (needs a task role we are not giving) |

Sanity before continuing: CPU 1024, memory 2048, `awsvpc`, Fargate, image is ECR (not `docker.io`), health check present, stop timeout 120, no task role.

### 6.7 Create the ECS service (two tasks, no load balancer)

**Why:** Desired **2** is the HA floor. Min healthy **100%** keeps two healthy during a replace (briefly four tasks). Circuit breaker rolls back a bad image. **No load balancer** is how Gotenberg stays off the public internet.

1. **ECS** → cluster **default** → **Services** → **Create**.
2. **Compute options:** Launch type **Fargate**, Platform version **LATEST**.
3. **Deployment configuration:**  
   - Application type: **Service**  
   - Task definition family: `default-gotenberg-cashsouk` (latest revision)  
   - Service name: `gotenberg-cashsouk`  
   - Desired tasks: **2**
4. **Networking:**
   - VPC: worksheet VPC  
   - Subnets: **the same API subnets**  
   - Security group: **GOTENBERG_SG** only (remove the default if the wizard added another)  
   - Public IP: **same as the API** (if API is on, Gotenberg must be on, or the image pull fails)
5. **Load balancing:** **None**. Do not add a target group. Do not pick the CashSouk ALB.
6. **Service Connect:** **Off** (15s default timeout is wrong for LibreOffice).
7. **Service discovery** (Cloud Map): **On**
   - Namespace: `cashsouk.internal` (existing, from §6.5)  
   - Service discovery name / DNS name: `gotenberg`  
   - DNS record type: **A**  
   - TTL: **10**  
   - Health check: **Custom** (ECS container health), failure threshold **1**  
   - Resulting name must be `gotenberg.cashsouk.internal`
8. **Deployment:**
   - Min running tasks: **100%**  
   - Max running tasks: **200%**  
   - Deployment circuit breaker: **Enabled**  
   - Rollback on failure: **Enabled**  
   - Health check grace period: **90** seconds  
   - Availability Zone rebalancing: **Enabled** (on by default for new services; do not turn it off)
9. **Monitoring:** Container Insights inherited from the cluster. Do not enable Execute command.
10. **Create**.

Wait on the service **Deployments** tab until **Primary** rollout is **Completed**, **Running count = 2**, **Desired = 2**.

Then:

1. **Tasks** tab → two tasks **Running**.
2. Open each task → **Health status** **Healthy**, and note **Availability Zone**. They must differ.
3. **CloudWatch** → log group `/ecs/cashsouk-gotenberg` → a stream exists; JSON logs; LibreOffice started; no crash loop.
4. **Cloud Map** → namespace `cashsouk.internal` → service `gotenberg` → **two** instances **Healthy**.

If both tasks are in one AZ: you did not select all API subnets.  
If tasks stop with `CannotPullContainerError`: public IP off, or pull-through/Docker Hub auth, or execution role cannot read ECR.  
If they stay Unhealthy past 90s: command flags wrong, or `/health` failing (check logs).

**Pin the digest now** (end of §6.2): new task definition revision with `@sha256:…` → service **Update** → new revision → wait until rollout Completed again.

### 6.8 Raise the public ALB idle timeout to 120 seconds

**Why:** Default 60s is shorter than the API’s 90s convert wait. Users get 504 while Gotenberg is still working. Gotenberg has no ALB; this is the **existing public** ALB in front of the API.

1. **EC2** → **Load balancers** → the ALB from §5.3.
2. **Attributes** → **Edit**.
3. **Idle timeout:** `120` seconds.
4. Save.

This applies to every host on that ALB (landing, portals, API). 120s idle does not keep extra connections; it only allows a slow request to finish.

### 6.9 Service auto scaling (min 2 / max 4)

**Why:** A CPU alarm must not create a large LibreOffice fleet. Min **2** is the HA floor — never 1.

1. ECS → **gotenberg-cashsouk** → **Update** (or **Service auto scaling**).
2. Use **Application Auto Scaling**.
3. Min tasks: **2**. Max tasks: **4**.
4. Add a **Target tracking** policy:
   - Name: `gotenberg-cpu-70`
   - Metric: **ECSServiceAverageCPUUtilization**
   - Target: **70**
   - Scale-out cooldown: **60** seconds  
   - Scale-in cooldown: **300** seconds
5. Save.

CPU is a proxy for “LibreOffice is busy,” not a perfect queue metric. Do not un-bound `--libreoffice-max-queue-size` to avoid scaling.

### 6.10 First smoke (before touching the API)

**Why:** Do not set `GOTENBERG_URL` until the converter is actually up. Your laptop cannot resolve `gotenberg.cashsouk.internal` (private DNS). A browser curl from home proves nothing.

**Pass criteria without a shell:**

- Two tasks **Healthy** in **two AZs**
- CloudWatch logs show Gotenberg/LibreOffice up, no restart loop
- Cloud Map shows two healthy instances for `gotenberg`
- ECR image scan is not HIGH/CRITICAL (or exception is written down)

**Convert smoke** happens after §6.12, via Admin **Download PDF** / issuer generated-documents. That is the real user path.

Optional, only if the **API** service already has ECS Exec enabled: on an API **Task** → **Execute command** → `curl -fsS http://gotenberg.cashsouk.internal:3000/health` and `/version`. Do not enable Exec on Gotenberg for this baseline (no task role).

### 6.11 Alarms and EventBridge (required)

**Why:** There is no ALB 5xx for this service. Two tasks can still die quietly.

**Container Insights** (if preflight showed it off):

1. **ECS** → cluster **default** → **Update cluster**.
2. Monitoring: **Container Insights** or **Container Insights with enhanced observability**.
3. Enhanced is better; **enabled** is enough for running-task-count.

**SNS topic** (if you do not already have an ops topic):

1. **SNS** → **Topics** → **Create topic** → Standard → name `cashsouk-ops-alerts`.
2. **Create subscription** → Email → your ops inbox → confirm the email.

**Alarms** — **CloudWatch** → **Alarms** → **Create alarm**:

**A. Running tasks below 2**

- Metric: namespace **ECS/ContainerInsights** (not AWS/ECS) → **RunningTaskCount**
- Dimensions: ClusterName = `default`, ServiceName = `gotenberg-cashsouk`
- Statistic: Average, period 1 minute, 3 datapoints
- Condition: **Lower than 2**
- Missing data: **Treat as breaching**
- Action: SNS topic
- Name: `cashsouk-gotenberg-running-lt-2`

If Container Insights was just turned on, wait until the metric appears (often several minutes) before saving, or the alarm sits in Insufficient data.

**B. CPU high**

- Namespace **AWS/ECS** → **CPUUtilization**
- Same cluster/service dimensions
- Average, 1 minute, 10 datapoints **> 85**
- Name: `cashsouk-gotenberg-cpu-high`

**C. Memory high**

- **AWS/ECS** → **MemoryUtilization**
- Average, 1 minute, 5 datapoints **> 80**
- Name: `cashsouk-gotenberg-memory-high`

**EventBridge** — **Amazon EventBridge** → **Rules** → **Create rule**:

**Rule 1 — deploy failed**

- Name: `cashsouk-gotenberg-deploy-failed`
- Event bus: default
- Event pattern (custom):

```json
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Deployment State Change"],
  "detail": {
    "eventName": ["SERVICE_DEPLOYMENT_FAILED"],
    "clusterArn": ["arn:aws:ecs:ap-southeast-5:652821469470:cluster/default"]
  }
}
```

- Target: SNS topic from above.

**Rule 2 — Gotenberg task stopped**

- Name: `cashsouk-gotenberg-task-stopped`
- Pattern:

```json
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Task State Change"],
  "detail": {
    "clusterArn": ["arn:aws:ecs:ap-southeast-5:652821469470:cluster/default"],
    "group": ["service:gotenberg-cashsouk"],
    "lastStatus": ["STOPPED"]
  }
}
```

- Target: same SNS topic.

If the rule fails to publish, add a resource policy on the SNS topic allowing `events.amazonaws.com` to `sns:Publish`.

Also: **Amazon Inspector** / ECR image findings → notification on repository `gotenberg-cashsouk` (or the pull-through repo) for **CRITICAL**. That is how a later LibreOffice CVE becomes a ticket.

Optional: **CloudWatch Logs Insights** on `/ecs/cashsouk-gotenberg` saved query for HTTP 5xx / conversion errors, until OpenTelemetry is added.

### 6.12 Wire the API after Gotenberg is healthy

**Why:** Setting `GOTENBERG_URL` first turns today’s safe 503 into timeouts. Enabling Gotenberg basic auth without API headers would 401 every convert.

**In the Console (immediate):**

1. **ECS** → **Task definitions** → `default-api-cashsouk-09ff` → **Create new revision**.
2. Container **Main** → **Environment variables** → **Add**:
   - Key: `GOTENBERG_URL`
   - Value: `http://gotenberg.cashsouk.internal:3000`  
     (no trailing slash, not a Secret)
3. Do **not** add basic-auth variables.
4. **Create**.
5. **ECS** → **api-cashsouk-09ff** → **Update** → new task definition revision → **Update**. Wait until the API rollout **Completed**.

**In git (so the next GitHub deploy does not wipe it):** add the same env object to [`infra/ecs-task-definition-api.json`](../../infra/ecs-task-definition-api.json). Ship the timeout→503 mapping in [`convert-docx-to-pdf.ts`](../../apps/api/src/modules/applications/letter-of-offer/convert-docx-to-pdf.ts) when you next deploy API code.

Then run §7 through the **admin UI** (Download PDF) and issuer generated-documents PDF.

---

## 7. Acceptance tests

Do not byte-compare PDFs (metadata changes). Check page count, extracted text, and yellow merge highlights. Gotenberg 8.30 changed bundled fonts — layout drift is a contract risk.

| # | Test | Pass |
|---|------|------|
| 1 | ECS tasks Healthy; logs show LO up | Two tasks, two AZs |
| 2 | After API wiring: Admin **Download PDF** | HTTP 200, `%PDF`, layout OK |
| 3 | Issuer `generated-documents?format=pdf` | Same |
| 4 | Largest realistic LO | Finishes; **no ALB 504** |
| 5 | Bad/non-DOCX | 4xx / API 500 `CONVERSION_FAILED` (bad file, not outage) |
| 6 | ECS → Gotenberg → **Update** force new deployment | PDF still works during rollout |
| 7 | Stop one Gotenberg task (Tasks → Stop) | Other task serves; running-count alarm if it stays at 1 |
| 8 | Remove `GOTENBERG_URL` (rollback drill) | 503 `GOTENBERG_MISSING` |
| 9 | Gotenberg SG inbound | **No** `0.0.0.0/0`; **no** ALB SG |
| 10 | DNS | There is **no** public `gotenberg.cashsouk.com` listener |

---

## 8. Later git artifacts (do not need them to click through §6)

Keep Gotenberg **out** of portal/API SHA builds. If you add `infra/ecs-task-definition-gotenberg.json`, exclude it from [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

```yaml
- "infra/ecs-task-definition-*.json"
- "!infra/ecs-task-definition-gotenberg.json"
```

Copy the task-definition JSON from §6.6 into that file once you pin the digest. Align local [`docker-compose.gotenberg.yml`](../../docker-compose.gotenberg.yml) to `8.36.0-libreoffice` and the same flags. Document `GOTENBERG_URL` in [`docs/guides/environment-variables.md`](../guides/environment-variables.md). Optional later: a **workflow_dispatch-only** GitHub Action for Gotenberg image bumps — not on every `apps/**` push.

---

## 9. Click-path order (checklist)

```text
Region ap-southeast-5
  → Worksheet: API VPC, subnets, SG, public IP, ALB idle timeout
  → VPC DNS resolution + hostnames on
  → ECR repo + lifecycle + scanning
  → ECR pull-through cache (Docker Hub)
  → Log group /ecs/cashsouk-gotenberg (30 days)
  → SG gotenberg-cashsouk-sg inbound 3000 from API SG only
  → Cloud Map namespace cashsouk.internal
  → Task definition (tag URI first)
  → ECS service desired 2, no ALB, Cloud Map name gotenberg, circuit breaker
  → Wait: 2 healthy tasks, 2 AZs, logs OK
  → Pin digest on a new task revision; update service
  → ALB idle timeout 120
  → Autoscaling min 2 / max 4
  → Container Insights + 3 alarms + 2 EventBridge rules
  → API task revision: GOTENBERG_URL
  → Admin + issuer PDF
  → Commit GOTENBERG_URL into infra/ecs-task-definition-api.json
```

Never enable Gotenberg auth in the same change as the first `GOTENBERG_URL`.

---

## 10. Rollback (Console)

Gotenberg stores nothing. You only roll back **image + task revision**.

**Bad Gotenberg image / flags**

1. **ECS** → **gotenberg-cashsouk** → **Update**.
2. Task definition: previous **revision** (the last known-good digest).
3. Update. Wait until **Deployments** → Primary **Completed**.

Write the good revision number and digest in the change ticket **before** you promote a new image.

**PDF path causing API incidents**

1. New **API** task definition revision → delete `GOTENBERG_URL`.
2. Update **api-cashsouk-09ff**.
3. Callers return 503 `GOTENBERG_MISSING`. That is the feature flag.

Use cluster **`default`**, not `cashsouk-prod`.

---

## 11. Operations

### 11.1 Patch cadence

Gotenberg can ship security-only releases in a week (8.35 → 8.36). Recheck [releases](https://github.com/gotenberg/gotenberg/releases) **monthly**, and within **7 days** of a security tag.

Console procedure: wait for pull-through to fetch the new tag (or force a new service deployment so ECS pulls) → copy **new** digest from ECR → new task definition revision with `@sha256` → update Gotenberg service → §7 convert checks → keep the previous revision.

### 11.2 Scaling later

| Signal | Action |
|--------|--------|
| Queue-full errors, CPU modest | Raise max tasks slightly, **or** queue size slightly; never unlimited |
| CPU ~70%, latency OK | Leave target tracking |
| Stuck at max 4 with 503s | Check Fargate vCPU quota, then raise max; or §11.3 |
| Memory > 80% | Next Fargate size (more memory) **before** many tiny tasks |

Do **not** use Fargate Spot for the two baseline tasks (interrupt mid-PDF).

### 11.3 When to leave synchronous HTTP

Stay sync for demo/admin/occasional issuer download. Move to SQS + worker when ALB 120s is still not enough, API tasks block on convert, or you need retry after a task death. Then: SQS + DLQ, S3 keys in messages, visibility timeout **> 80s**. Do **not** treat Gotenberg webhooks as a durable queue.

### 11.4 Cost

Two Fargate tasks at 1 vCPU / 2 GB, 24×7, plus Cloud Map and 30-day logs: low tens of USD/month in this region — confirm in the AWS Pricing Calculator. Cloud Map is cheaper than an internal ALB and cheaper than Service Connect TLS (Private CA is about $50/month). Do not buy a Private CA only for this service.

### 11.5 DR

No Gotenberg backup. Durable files are source DOCX and PDFs in **S3**. Multi-AZ covers AZ loss. Cross-region is an optional later project (ECR replication + a second namespace).

---

## 12. Optional upgrades (not launch blockers)

| Upgrade | When |
|---------|------|
| VPC endpoints (ECR, S3, Logs) + Public IP **off** | Compliance wants private-only egress; move API the same way |
| Restrict Gotenberg egress to 443 + DNS | After endpoints exist |
| Service Connect with request timeout ≥ 90s | Many internal services need retries; **must** change the 15s default |
| Service Connect TLS or internal HTTPS ALB | East-west encryption required; **then** add auth |
| ECR managed signing | Promotion must attest the digest |
| OpenTelemetry | Need conversion latency/queue graphs (Prometheus module is deprecated since 8.29) |
| ARM64 / Graviton | Only after PDFs match amd64 |

---

## 13. Out of scope

- Replacing Playwright HTML → PDF (prospectus, CTOS, receipts) with Gotenberg Chromium
- Public conversion API
- Terraform / CDK
- AWS CLI (this runbook is Console-only)

---

## 14. References

- [Gotenberg installation](https://gotenberg.dev/docs/getting-started/installation)
- [Gotenberg configuration](https://gotenberg.dev/docs/configuration)
- [Gotenberg health](https://gotenberg.dev/docs/system/get-health-check)
- [Gotenberg outbound URL filtering](https://gotenberg.dev/docs/outbound-url-filtering)
- [Gotenberg 8.36.0](https://github.com/gotenberg/gotenberg/releases/tag/v8.36.0)
- [ECS service discovery](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-discovery.html)
- [ECS circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html)
- [ECS health checks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/healthcheck.html)
- [ECR pull-through cache](https://docs.aws.amazon.com/AmazonECR/latest/userguide/pull-through-cache.html)
- [Container Insights](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cloudwatch-container-insights.html)
- Local compose: [`docker-compose.gotenberg.yml`](../../docker-compose.gotenberg.yml)
- Convert client: [`convert-docx-to-pdf.ts`](../../apps/api/src/modules/applications/letter-of-offer/convert-docx-to-pdf.ts)
