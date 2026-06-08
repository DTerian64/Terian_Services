const screens = [
  "catalog",
  "detail",
  "connection",
  "discovery",
  "scope",
  "preview",
  "mapping",
  "schedule",
  "activate",
  "instance"
];

const screenTitles = {
  catalog: "Connector Catalog",
  detail: "Connector Detail",
  connection: "Source Connection Setup",
  discovery: "Metadata Discovery",
  scope: "Ingestion Scope",
  preview: "Governance Preview",
  mapping: "Ontology Mapping",
  schedule: "Schedule & Processing",
  activate: "Review & Activate",
  instance: "Connector Instance Detail"
};

const connectors = {
  workday: {
    name: "Workday HCM",
    instance: "Workday Production",
    category: "HR / Employee",
    provider: "Workday",
    stage: "GA",
    manifest: "v1.0.0",
    status: "Not configured",
    sync: "Scheduled batch",
    auth: "Client credentials",
    owner: "People Operations",
    dataOwner: "hr-data-owner@contoso.com",
    techOwner: "hris-admin@contoso.com",
    domains: ["Employee", "Organization", "Location", "Worker Lifecycle"],
    objects: [
      ["worker", "Employee", "Include", "18,420"],
      ["supervisory_org", "OrganizationUnit", "Include", "840"],
      ["job_profile", "Role", "Include", "312"],
      ["location", "Location", "Include", "62"],
      ["worker_lifecycle_event", "Event", "Include", "96,102"]
    ],
    hidden: ["compensation", "personal_information"],
    fields: [
      ["worker_id", "Employee.identifier", "Yes", "Accepted"],
      ["employee_status", "Employee.status", "Yes", "Accepted"],
      ["manager_worker_id", "Employee.managerIdentifier", "Yes", "Accepted"],
      ["supervisory_org_id", "OrganizationUnit.identifier", "Yes", "Accepted"],
      ["work_email", "Employee.workEmail", "No", "Hash"],
      ["location_id", "Location.identifier", "No", "Suggested"]
    ],
    relationships: ["ReportsTo", "BelongsToOrg", "LocatedAt"],
    scopeFilters: ["Worker status", "Supervisory organization", "Region", "Location", "Lifecycle event date"],
    previewRows: [
      ["Employee", "18,420", "Graph"],
      ["OrganizationUnit", "840", "Graph"],
      ["Location", "62", "Graph"],
      ["WorkerLifecycleEvent", "96,102", "Operational"]
    ],
    sample: [
      ["worker_id", "W12345"],
      ["employee_status", "Active"],
      ["manager_worker_id", "W48721"],
      ["supervisory_org_id", "SO-0142"]
    ],
    scheduleMode: "Scheduled batch",
    evidenceLine: "Free text: excluded",
    warning: "Hidden Workday objects are not available to tenant admins."
  },
  awards: {
    name: "Award Nominations",
    instance: "Corporate Awards FY26",
    category: "Custom Applications",
    provider: "Tenant Custom App",
    stage: "Preview",
    manifest: "v0.9.0",
    status: "Draft exists",
    sync: "Manual import, scheduled batch",
    auth: "API key",
    owner: "Corporate Awards",
    dataOwner: "awards-owner@contoso.com",
    techOwner: "custom-app-admin@contoso.com",
    domains: ["Recognition", "Approval", "Employee Event", "Semantic Evidence"],
    objects: [
      ["award_nomination", "RecognitionEvent", "Include", "12,480"],
      ["nominee", "Employee", "Include", "9,120"],
      ["nominator", "Employee", "Include", "8,760"],
      ["nomination_approval", "Approval", "Include", "10,430"],
      ["award_category", "RecognitionCategory", "Include", "32"],
      ["justification_text", "EvidenceText", "SemanticEvidence", "12,480"],
      ["attachment", "EvidenceAttachment", "Exclude", "Unknown"]
    ],
    hidden: [],
    fields: [
      ["nomination_id", "RecognitionEvent.identifier", "Yes", "Accepted"],
      ["nominee_worker_id", "Employee.identifier", "Yes", "Accepted"],
      ["nominator_worker_id", "Employee.identifier", "Yes", "Accepted"],
      ["submitted_at", "Event.timestamp", "Yes", "Accepted"],
      ["award_category_id", "RecognitionCategory.identifier", "Yes", "Accepted"],
      ["approval_status", "Approval.status", "No", "Suggested"],
      ["approver_worker_id", "Approval.actor", "No", "Suggested"],
      ["justification_text", "Evidence.text", "No", "SemanticEvidence"]
    ],
    relationships: ["NominatedBy", "NominatedFor", "ApprovedBy", "BelongsToCategory"],
    scopeFilters: ["Award category", "Submission date", "Approval status", "Business unit", "Nominee region"],
    previewRows: [
      ["RecognitionEvent", "12,480", "Graph"],
      ["Approval", "10,430", "Graph"],
      ["Employee references", "17,880", "Graph"],
      ["Justification text", "12,480", "Vector"]
    ],
    sample: [
      ["nomination_id", "NOM-109823"],
      ["nominee_worker_id", "W12345"],
      ["nominator_worker_id", "W48721"],
      ["award_category", "Innovation"],
      ["justification_text", "Included as governed semantic evidence"]
    ],
    scheduleMode: "Scheduled batch",
    evidenceLine: "Justification text: semantic evidence",
    warning: "Semantic evidence retention requires policy approval."
  }
};

const state = {
  screen: "catalog",
  connectorKey: "workday",
  category: "All",
  tested: false,
  approved: false,
  mapped: false
};

const root = document.getElementById("screen-root");
const title = document.getElementById("screen-title");

function connector() {
  return connectors[state.connectorKey];
}

function setScreen(next) {
  state.screen = next;
  render();
}

function nextScreen() {
  const index = screens.indexOf(state.screen);
  setScreen(screens[Math.min(index + 1, screens.length - 1)]);
}

function previousScreen() {
  const index = screens.indexOf(state.screen);
  setScreen(screens[Math.max(index - 1, 0)]);
}

function badge(text, tone = "") {
  return `<span class="pill ${tone}">${text}</span>`;
}

function actionRow(primaryLabel = "Continue") {
  return `
    <div class="actions">
      <button class="button secondary" type="button" data-action="back">Back</button>
      <button class="button" type="button" data-action="next">${primaryLabel}</button>
    </div>
  `;
}

function progressPanel(current) {
  const items = [
    ["Catalog selected", current === "catalog"],
    ["Connector reviewed", current === "detail"],
    ["Connection tested", current === "connection"],
    ["Metadata discovered", current === "discovery"],
    ["Scope defined", current === "scope"],
    ["Governance previewed", current === "preview"],
    ["Mappings validated", current === "mapping"],
    ["Schedule configured", current === "schedule"],
    ["Activation ready", current === "activate"]
  ];

  return `
    <aside class="side-panel">
      <h3>Setup progress</h3>
      <ul class="progress-list">
        ${items.map(([label, active]) => `<li class="${active ? "current" : ""}"><span>${label}</span><span>${active ? "Current" : "Pending"}</span></li>`).join("")}
      </ul>
      <hr>
      <h3>Selected connector</h3>
      <ul class="detail-list">
        <li><span>Name</span><strong>${connector().name}</strong></li>
        <li><span>Manifest</span><strong>${connector().manifest}</strong></li>
        <li><span>Owner</span><strong>${connector().owner}</strong></li>
      </ul>
    </aside>
  `;
}

function connectorCard(key) {
  const item = connectors[key];
  const selected = state.connectorKey === key ? "selected" : "";
  return `
    <article class="connector-card ${selected}">
      <div class="card-top">
        <div>
          <h3>${item.name}</h3>
          <div class="muted">${item.category} · ${item.provider}</div>
        </div>
        ${badge(item.stage, item.stage === "GA" ? "green" : "amber")}
      </div>
      <ul class="domain-list">
        <li><span>Domains</span><strong>${item.domains.join(", ")}</strong></li>
        <li><span>Sync</span><strong>${item.sync}</strong></li>
        <li><span>Status</span><strong>${item.status}</strong></li>
      </ul>
      <button class="button" type="button" data-select="${key}">${item.status === "Draft exists" ? "Resume setup" : "View details"}</button>
    </article>
  `;
}

function renderCatalog() {
  return `
    <div class="toolbar">
      <input class="search" type="search" value="" placeholder="Search connectors, domains, providers">
      <div class="tabs">
        ${["All", "HR / Employee", "Custom Applications", "Identity", "Finance", "Procurement"].map((tab) => `
          <button class="tab ${state.category === tab ? "active" : ""}" type="button" data-category="${tab}">${tab}</button>
        `).join("")}
      </div>
    </div>
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Available connectors</h2>
            <p class="muted">Select a platform-approved connector or custom application template.</p>
          </div>
          <button class="button secondary" type="button">New custom from template</button>
        </div>
        <div class="connector-grid">
          ${connectorCard("workday")}
          ${connectorCard("awards")}
          ${placeholderCard("Entra ID", "Identity & Access", "Users, groups, access changes", "Not configured")}
          ${placeholderCard("Coupa Procurement", "Procurement", "Vendors, invoices, approvals", "Preview")}
        </div>
      </section>
      <aside class="side-panel">
        <h3>Catalog policy</h3>
        <ul class="check-list">
          <li><span>Custom apps</span><strong>Approved templates only</strong></li>
          <li><span>Workday sensitive objects</span><strong>Hidden</strong></li>
          <li><span>Version source</span><strong>Catalog manifest</strong></li>
          <li><span>Runtime source</span><strong>Operational DB</strong></li>
        </ul>
      </aside>
    </div>
  `;
}

function placeholderCard(name, category, domains, status) {
  return `
    <article class="connector-card">
      <div class="card-top">
        <div>
          <h3>${name}</h3>
          <div class="muted">${category}</div>
        </div>
        ${badge(status, status === "Preview" ? "amber" : "")}
      </div>
      <ul class="domain-list">
        <li><span>Domains</span><strong>${domains}</strong></li>
        <li><span>Sync</span><strong>Scheduled batch</strong></li>
        <li><span>Status</span><strong>${status}</strong></li>
      </ul>
      <button class="button secondary" type="button">View details</button>
    </article>
  `;
}

function renderDetail() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>${item.name}</h2>
            <p class="muted">${item.category} connector · Provider: ${item.provider} · Manifest ${item.manifest}</p>
          </div>
          ${badge(item.stage, item.stage === "GA" ? "green" : "amber")}
        </div>
        <div class="metrics">
          <div class="metric"><span class="muted">Data domains</span><span class="metric-value">${item.domains.length}</span></div>
          <div class="metric"><span class="muted">Sync modes</span><span class="metric-value">${item.sync.includes(",") ? "2" : "1"}</span></div>
          <div class="metric"><span class="muted">Auth</span><span class="metric-value">${item.auth}</span></div>
        </div>
        <h3 class="section-title">Visible source objects</h3>
        ${objectTable(item.objects.filter((row) => row[2] !== "Exclude"))}
        ${item.hidden.length ? `<h3 class="section-title">Hidden by platform policy</h3><p class="muted">${item.hidden.join(", ")} are not visible in setup, discovery, preview, or mapping.</p>` : ""}
        <div class="actions">
          <button class="button secondary" type="button" data-action="back">Back to catalog</button>
          <button class="button" type="button" data-action="next">Configure connector</button>
        </div>
      </section>
      ${progressPanel("detail")}
    </div>
  `;
}

function objectTable(rows) {
  return `
    <table>
      <thead><tr><th>Source object</th><th>Integrity concept</th><th>Default</th><th>Estimated records</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderConnection() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Source connection</h2>
            <p class="muted">Create the tenant connector instance and test access before discovery.</p>
          </div>
          ${badge(state.tested ? "Connected" : "Not tested", state.tested ? "green" : "amber")}
        </div>
        <div class="form-grid">
          <label class="form-row">Display name<input class="field" value="${item.instance}"></label>
          <label class="form-row">Environment<select><option>Production</option><option>Sandbox</option><option>Test</option></select></label>
          <label class="form-row">Owning business unit<input class="field" value="${item.owner}"></label>
          <label class="form-row">Authentication<select><option>${item.auth}</option><option>OAuth2</option><option>Manual upload</option><option>SFTP key</option></select></label>
          <label class="form-row">Data owner<input class="field" value="${item.dataOwner}"></label>
          <label class="form-row">Technical owner<input class="field" value="${item.techOwner}"></label>
          <label class="form-row full">${state.connectorKey === "workday" ? "Workday tenant URL" : "Application base URL"}<input class="field" value="${state.connectorKey === "workday" ? "https://wd2-impl-services.workday.com/contoso" : "https://awards.contoso.com/api"}"></label>
        </div>
        <div class="actions">
          <button class="button secondary" type="button" data-action="back">Back</button>
          <button class="button secondary" type="button" data-action="test">Test connection</button>
          <button class="button" type="button" data-action="next">Continue</button>
        </div>
      </section>
      ${progressPanel("connection")}
    </div>
  `;
}

function renderDiscovery() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Metadata discovery</h2>
            <p class="muted">Snapshot captured from ${item.name}. Hidden platform objects stay hidden.</p>
          </div>
          <button class="button secondary" type="button">Run discovery</button>
        </div>
        <div class="summary-band">
          <div class="summary-item"><span class="muted">Objects</span><strong class="metric-value">${item.objects.length}</strong></div>
          <div class="summary-item"><span class="muted">Required fields</span><strong class="metric-value">All found</strong></div>
          <div class="summary-item"><span class="muted">Relationships</span><strong class="metric-value">${item.relationships.length}</strong></div>
          <div class="summary-item"><span class="muted">Warnings</span><strong class="metric-value">${state.connectorKey === "awards" ? "1" : "0"}</strong></div>
        </div>
        <h3 class="section-title">Discovery inventory</h3>
        ${objectTable(item.objects)}
        ${item.hidden.length ? `<p class="footer-note">Hidden by policy: ${item.hidden.join(", ")}.</p>` : ""}
        ${actionRow("Continue to scope")}
      </section>
      ${progressPanel("discovery")}
    </div>
  `;
}

function renderScope() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Ingestion scope</h2>
            <p class="muted">Define the governed contract for what can enter Integrity Sentinel.</p>
          </div>
          ${badge(item.evidenceLine, state.connectorKey === "awards" ? "amber" : "")}
        </div>
        <div class="split">
          <div>
            <h3 class="section-title">Included objects</h3>
            <div class="toggle-row">
              ${item.objects.map((row) => `<label class="toggle"><input type="checkbox" ${row[2] !== "Exclude" ? "checked" : ""} ${row[2] === "Exclude" ? "disabled" : ""}>${row[0]}</label>`).join("")}
            </div>
          </div>
          <div>
            <h3 class="section-title">Filters</h3>
            <ul class="detail-list">
              ${item.scopeFilters.map((filter) => `<li><span>${filter}</span><strong>Configured</strong></li>`).join("")}
            </ul>
          </div>
        </div>
        ${state.connectorKey === "awards" ? `<p class="footer-note">Justification text is included as governed semantic evidence. Attachments remain excluded.</p>` : `<p class="footer-note">Compensation and personal information do not appear in this screen.</p>`}
        ${actionRow("Preview scoped data")}
      </section>
      ${progressPanel("scope")}
    </div>
  `;
}

function renderPreview() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Governance preview</h2>
            <p class="muted">Review estimated ingestion, target stores, and policy warnings.</p>
          </div>
          ${badge(state.approved ? "Approved" : "Review required", state.approved ? "green" : "amber")}
        </div>
        <div class="split">
          <div>
            <table>
              <thead><tr><th>Type</th><th>Count</th><th>Target store</th></tr></thead>
              <tbody>${item.previewRows.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td></tr>`).join("")}</tbody>
            </table>
          </div>
          <div class="record-preview">
            <strong>Sample normalized record</strong>
            ${item.sample.map(([key, value]) => `<code>${key}: ${value}</code>`).join("")}
          </div>
        </div>
        <h3 class="section-title">Validation</h3>
        <ul class="check-list">
          <li><span>Required identifiers</span><strong>Found</strong></li>
          <li><span>Tenant boundary</span><strong>Confirmed</strong></li>
          <li><span>Audit logging</span><strong>Enabled</strong></li>
          <li><span>Policy note</span><strong>${item.warning}</strong></li>
        </ul>
        <div class="actions">
          <button class="button secondary" type="button" data-action="back">Back</button>
          <button class="button secondary" type="button" data-action="approve">Approve scope</button>
          <button class="button" type="button" data-action="next">Continue to mapping</button>
        </div>
      </section>
      ${progressPanel("preview")}
    </div>
  `;
}

function renderMapping() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Ontology mapping</h2>
            <p class="muted">Accept suggested mappings or override fields before activation.</p>
          </div>
          ${badge(state.mapped ? "Validated" : "Needs validation", state.mapped ? "green" : "amber")}
        </div>
        <table>
          <thead><tr><th>Source field</th><th>Integrity concept</th><th>Required</th><th>Status</th></tr></thead>
          <tbody>${item.fields.map((row) => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join("")}</tbody>
        </table>
        <h3 class="section-title">Relationships</h3>
        <div class="toggle-row">${item.relationships.map((rel) => `<span class="pill">${rel}</span>`).join("")}</div>
        <div class="actions">
          <button class="button secondary" type="button" data-action="back">Back</button>
          <button class="button secondary" type="button" data-action="map">Validate mapping</button>
          <button class="button" type="button" data-action="next">Continue</button>
        </div>
      </section>
      ${progressPanel("mapping")}
    </div>
  `;
}

function renderSchedule() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Schedule and processing</h2>
            <p class="muted">Choose cadence, backfill, failure handling, and downstream processing.</p>
          </div>
          ${badge(item.scheduleMode)}
        </div>
        <div class="form-grid">
          <label class="form-row">Run mode<select><option>${item.scheduleMode}</option><option>Run once</option><option>Event stream</option></select></label>
          <label class="form-row">Time zone<select><option>America/Los_Angeles</option><option>America/New_York</option><option>UTC</option></select></label>
          <label class="form-row">Frequency<select><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>
          <label class="form-row">Time<input class="field" value="02:00 AM"></label>
          <label class="form-row">Backfill start<input class="field" value="Jan 1, 2026"></label>
          <label class="form-row">Failure handling<select><option>Retry, then quarantine</option><option>Stop run</option><option>Skip invalid records</option></select></label>
        </div>
        <h3 class="section-title">Downstream processing</h3>
        <div class="toggle-row">
          <label class="toggle"><input type="checkbox" checked>Update graph</label>
          <label class="toggle"><input type="checkbox" checked>Run risk scoring</label>
          <label class="toggle"><input type="checkbox" checked>Generate alerts</label>
          <label class="toggle"><input type="checkbox" checked>Enable AI summaries</label>
        </div>
        ${state.connectorKey === "awards" ? `<p class="footer-note">Vector store semantic evidence processing remains enabled because justification text is in scope.</p>` : ""}
        ${actionRow("Review configuration")}
      </section>
      ${progressPanel("schedule")}
    </div>
  `;
}

function renderActivate() {
  const item = connector();
  return `
    <div class="layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Review and activate</h2>
            <p class="muted">Final setup review before the connector can run.</p>
          </div>
          ${badge(state.approved && state.mapped ? "Ready" : "Blocked", state.approved && state.mapped ? "green" : "red")}
        </div>
        <div class="summary-band">
          <div class="summary-item"><span class="muted">Connector</span><strong class="metric-value">${item.name}</strong></div>
          <div class="summary-item"><span class="muted">Manifest</span><strong class="metric-value">${item.manifest}</strong></div>
          <div class="summary-item"><span class="muted">Scope</span><strong class="metric-value">Configured</strong></div>
          <div class="summary-item"><span class="muted">Schedule</span><strong class="metric-value">Daily</strong></div>
        </div>
        <h3 class="section-title">Activation checklist</h3>
        <ul class="check-list">
          <li><span>Connection configured</span><strong>Complete</strong></li>
          <li><span>Metadata discovered</span><strong>Complete</strong></li>
          <li><span>Scope approved</span><strong>${state.approved ? "Complete" : "Required"}</strong></li>
          <li><span>Mappings validated</span><strong>${state.mapped ? "Complete" : "Required"}</strong></li>
          <li><span>Audit logging</span><strong>Enabled</strong></li>
        </ul>
        <div class="actions">
          <button class="button secondary" type="button" data-action="back">Back</button>
          <button class="button" type="button" data-action="next" ${state.approved && state.mapped ? "" : "disabled"}>Activate connector</button>
        </div>
      </section>
      ${progressPanel("activate")}
    </div>
  `;
}

function renderInstance() {
  const item = connector();
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>${item.instance}</h2>
          <p class="muted">Active · Connected · ${item.manifest} · Last sync: May 14, 2026 2:04 AM PT</p>
        </div>
        <div class="topbar-actions">
          <button class="button secondary" type="button">Pause</button>
          <button class="button" type="button">Run now</button>
        </div>
      </div>
      <div class="metrics">
        <div class="metric"><span class="muted">Health</span><span class="metric-value">Connected</span></div>
        <div class="metric"><span class="muted">Last run</span><span class="metric-value">${state.connectorKey === "workday" ? "18,420 workers" : "12,480 events"}</span></div>
        <div class="metric"><span class="muted">Next run</span><span class="metric-value">May 15, 2:00 AM</span></div>
      </div>
      <h3 class="section-title">Migration tasks</h3>
      <table>
        <thead><tr><th>Status</th><th>Target</th><th>Required action</th><th>Impact</th></tr></thead>
        <tbody>
          <tr><td>Pending</td><td>${state.connectorKey === "workday" ? "v1.1.0" : "v1.0.0"}</td><td>Review</td><td>${state.connectorKey === "workday" ? "New lifecycle field" : "Template policy update"}</td></tr>
          <tr><td>Not needed</td><td>${item.manifest}</td><td>None</td><td>Current version active</td></tr>
        </tbody>
      </table>
      <div class="actions">
        <button class="button secondary" type="button" data-action="catalog">Back to catalog</button>
        <button class="button" type="button">Open ingestion monitor</button>
      </div>
    </section>
  `;
}

function render() {
  title.textContent = screenTitles[state.screen];
  document.querySelectorAll(".step").forEach((step) => {
    step.classList.toggle("is-active", step.dataset.screen === state.screen);
  });

  const templates = {
    catalog: renderCatalog,
    detail: renderDetail,
    connection: renderConnection,
    discovery: renderDiscovery,
    scope: renderScope,
    preview: renderPreview,
    mapping: renderMapping,
    schedule: renderSchedule,
    activate: renderActivate,
    instance: renderInstance
  };

  root.innerHTML = templates[state.screen]();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  if (target.dataset.screen) {
    setScreen(target.dataset.screen);
    return;
  }

  if (target.dataset.select) {
    state.connectorKey = target.dataset.select;
    setScreen("detail");
    return;
  }

  if (target.dataset.category) {
    state.category = target.dataset.category;
    render();
    return;
  }

  const action = target.dataset.action;
  if (action === "next") nextScreen();
  if (action === "back") previousScreen();
  if (action === "catalog") setScreen("catalog");
  if (action === "test") {
    state.tested = true;
    render();
  }
  if (action === "approve") {
    state.approved = true;
    render();
  }
  if (action === "map") {
    state.mapped = true;
    render();
  }
});

document.getElementById("save-draft").addEventListener("click", () => {
  const previous = document.querySelector(".status-pill").textContent;
  document.querySelector(".status-pill").textContent = "Draft saved";
  window.setTimeout(() => {
    document.querySelector(".status-pill").textContent = previous;
  }, 1400);
});

render();
