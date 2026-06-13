# Offline Local Inventory Management System

A beautiful, lightweight, premium dark-glassmorphism offline inventory and point-of-sale management system built specifically for Ethiopian retail operations (mini supermarkets, regular stores, pharmacies, shoe/clothing shops, cosmetics, electronics, and wholesale distributors).

It is engineered to run locally on one PC, fully offline, without any external internet or cloud dependencies.

## Technical Stack
- **Backend:** Node.js, Express, and a high-performance local SQLite database (`better-sqlite3` driver with Write-Ahead Logging).
- **Frontend:** Responsive vanilla HTML, CSS Grid/Flex, and robust vanilla JavaScript.
- **Visuals:** Premium dark glassmorphism styling, clean typography pairings (Inter display headers, JetBrains Mono tags), and vector Lucide icons.
- **No Heavy Frameworks:** Free from React, Vue, Tailwind compilers, or Electron dependencies, guaranteeing exceptionally fast cold-start performance, minimal CPU overhead, and high offline stability.

## Standard Credentials
On first database boot, a default Owner account is auto-configured:
- **Username:** `owner`
- **Password:** `password`

*CRITICAL: Please navigate to the Configurations page immediately after logging in to personalize and secure your password.*

---

## Core Characteristics & Workflows

### 1. Controlled User Roles & Permissions
- Set up exactly two role divisions: **Owner** and **Employee**.
- **Owner Account:** Holds full administrative clearance.
- **Employee Accounts:** Strictly governed by owner-assigned permission flags (e.g., POS checkouts only, stock-in block, pricing lookups, view financials). Custom credentials can be edited, toggled, or deleted at any time.

### 2. Fast Interactive POS Cart (Lanes)
- A streamlined left-to-right shop workflow. Select categories, apply dynamic search queries, choose stock variants, adjust quantities, and instantly check out.
- Implements cash or electronic mobile transfer choices. For mobile transfers, the employee enters the transaction reference number and can manually attach validation receipts to store references without raw image processing overhead.
- **Sales are Immutable:** Invoices cannot be modified or deleted once recorded. 

### 3. Customer Return Workflows
- To prevent internal fraud, the system uses an approval workflow. If a checkout is incorrect, the operator retrieves the transaction record, registers a return, and files it.
- Files auto-attach the original sale data. The request enters a `Pending` state for **Owner** review. Upon approval, items are safely returned to inventory pools and financial balances are adjusted.

### 4. Automated Backup Safeguards
- **Automated Midnight Backup:** Copies database state daily around 23:55–23:59 to `backups/daily/`.
- **Missed Startup Recovery:** If the computer is off during scheduled midnight windows, the system identifies the omission on the next startup and automatically processes the backup before any operator has logged in.
- **30-Day Retention Cycle:** After 30 days of active operations, the Owner receives an warning prompt to Choose to Keep (Archiving records with structured `day-month-year` serialized names) or Delete old cycles.

### 5. Instant Low-Stock Warnings
- Implements continuous checkouts monitoring. If products or variant lines drop beneath customer safety thresholds, an amber warnings card pops up in the bottom-right and visually stays until acknowledged by any logged-in operator.
- Alerts apply uniformly to both dashboard settings.

---

## Folder Architecture
```
/
├── server.ts                 # Core Express and SQLite backend server (compiled to dist/server.cjs)
├── package.json              # System configuration and scripts
├── tsconfig.json             # TypeScript rules for build compilation
├── database/
│   └── app.db                # Live SQLite local database binary (WAL enabled)
├── backups/
│   ├── daily/                # Midnight automatic checkpoints
│   └── archive/              # Manually archived historical backups
├── uploads/
│   └── receipts/             # Customer mobile transfer receipt attachments
└── public/
    ├── index.html            # Core frontend views orchestrator
    ├── css/
    │   └── main.css          # Premium dark glassmorphism stylesheet
    └── js/
        └── app.js            # Vanilla JS state controller, cart flow & API logic
```
