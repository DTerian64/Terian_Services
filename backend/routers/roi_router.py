"""
roi_router.py
─────────────
POST /api/roi/email

Lead capture for the Award Nomination ROI calculator. When a prospect clicks
"Email me these results", the browser POSTs their inputs + computed outputs here
and we:

  1. Email the PROSPECT a branded copy of their own results (the promised action).
  2. Email the Terian team an internal lead notification.
  3. Persist a lead document to CosmosDB (client_communications container).

All three steps are best-effort and independent: a failure in one is logged and
never blocks the others, so the prospect still gets their results even if the
CRM write hiccups.

Environment (shared with contact_router):
  SMTP_USER, SMTP_PASSWORD, SMTP_HOST (default smtppro.zoho.com)
  CONTACT_NOTIFY_EMAIL      — internal lead inbox (defaults to SMTP_USER)
  AZURE_COSMOS_ENDPOINT, AZURE_COSMOS_DATABASE
  AZURE_CLIENT_ID           — UAMI client id (ACA), else DefaultAzureCredential
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import uuid
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential, ManagedIdentityCredential
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────

_COSMOS_ENDPOINT = os.getenv("AZURE_COSMOS_ENDPOINT", "")
_COSMOS_DATABASE = os.getenv("AZURE_COSMOS_DATABASE", "terian-services")
_CONTAINER_NAME  = "client_communications"

_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
_NOTIFY_TO     = os.getenv("CONTACT_NOTIFY_EMAIL", _SMTP_USER)
_FROM_NAME     = "Terian Services"
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtppro.zoho.com")
_SMTP_PORT     = 587


# ── Schema ────────────────────────────────────────────────────────────────────

class RoiEmailRequest(BaseModel):
    email: EmailStr
    company: str = ""

    # Inputs (for context in the emails / CRM)
    employees: int
    annual_budget: float
    plan: str
    payroll_enabled: bool = True
    overrun_enabled: bool = False

    # Computed outputs
    annual_value: float
    fraud_prevented: float
    payroll_saved: float = 0.0
    overrun_avoided: float = 0.0
    annual_cost: float | None = None
    net_benefit: float | None = None
    roi_percent: float | None = None
    payback_months: float | None = None


class RoiEmailResponse(BaseModel):
    ok: bool
    id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    if client_id:
        return ManagedIdentityCredential(client_id=client_id)
    return DefaultAzureCredential()


def _usd(n: float | None) -> str:
    if n is None:
        return "—"
    return "${:,.0f}".format(n)


def _pct(n: float | None) -> str:
    return "n/a" if n is None else f"{round(n)}%"


def _months(n: float | None) -> str:
    return "n/a" if n is None else f"{n:.1f} months"


async def _save_to_cosmos(doc: dict) -> None:
    if not _COSMOS_ENDPOINT:
        logger.warning("roi_router: AZURE_COSMOS_ENDPOINT not set — skipping Cosmos write")
        return
    async with _credential() as credential:
        async with CosmosClient(_COSMOS_ENDPOINT, credential=credential) as client:
            db = client.get_database_client(_COSMOS_DATABASE)
            container = db.get_container_client(_CONTAINER_NAME)
            await container.create_item(doc)
            logger.info("roi_router: Cosmos lead write succeeded — id=%s", doc.get("id"))


def _results_rows(req: RoiEmailRequest) -> str:
    """Shared HTML table rows describing the estimate."""
    rows = [
        ("Employees", f"{req.employees:,}"),
        ("Annual recognition budget", _usd(req.annual_budget)),
        ("Plan", req.plan),
        ("", ""),
        ("Fraud &amp; abuse prevented", _usd(req.fraud_prevented)),
    ]
    if req.payroll_enabled:
        rows.append(("Payroll automation saved", _usd(req.payroll_saved)))
    if req.overrun_enabled:
        rows.append(("Budget-overrun avoided", _usd(req.overrun_avoided)))
    rows += [
        ("Estimated annual value", _usd(req.annual_value)),
        ("Annual subscription cost", _usd(req.annual_cost)),
        ("Net annual benefit", _usd(req.net_benefit)),
        ("ROI", _pct(req.roi_percent)),
        ("Payback", _months(req.payback_months)),
    ]
    html = ""
    for label, value in rows:
        if label == "" and value == "":
            html += '<tr><td colspan="2" style="padding:6px 16px;"></td></tr>'
            continue
        html += (
            '<tr style="border-top:1px solid #e5e7eb;">'
            f'<td style="padding:10px 16px;color:#6b7280;font-size:13px;">{label}</td>'
            f'<td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;text-align:right;">{value}</td>'
            "</tr>"
        )
    return html


def _wrap(title: str, intro: str, req: RoiEmailRequest) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:560px;">
        <tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:32px 40px;">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">{title}</h1>
          <p style="margin:6px 0 0;color:#ddd6fe;font-size:13px;">Award Nomination System · terianix.ai</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.7;">{intro}</p>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
            <tr style="background:#f9fafb;"><td colspan="2"
              style="padding:12px 16px;font-size:11px;font-weight:700;color:#6b7280;
                     text-transform:uppercase;letter-spacing:0.5px;">Your ROI estimate</td></tr>
            {_results_rows(req)}
          </table>
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            Estimate for illustration only, based on your inputs and stated assumptions;
            not a guarantee of results.
          </p>
        </td></tr>
        <tr><td style="padding:16px 40px;border-top:1px solid #e5e7eb;background:#f9fafb;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Terian Services · terianix.ai</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _send_sync(to_addr: str, subject: str, html: str) -> None:
    """Blocking SMTP send — called via asyncio.to_thread."""
    if not _SMTP_PASSWORD:
        logger.warning("roi_router: SMTP_PASSWORD not set — skipping email to %s", to_addr)
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{_FROM_NAME} <{_SMTP_USER}>"
    msg["To"]      = to_addr
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.starttls()
        server.login(_SMTP_USER, _SMTP_PASSWORD)
        server.sendmail(_SMTP_USER, [to_addr], msg.as_string())
    logger.info("roi_router: email sent to %s (subject=%s)", to_addr, subject)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/api/roi/email", response_model=RoiEmailResponse)
async def roi_email(req: RoiEmailRequest) -> RoiEmailResponse:
    """
    Email a prospect their ROI results, notify the Terian team, and log the lead.
    All steps are best-effort; returns 200 {"ok": true, "id": "<uuid>"}.
    """
    lead_id = str(uuid.uuid4())

    # 1. Prospect copy — the promised action.
    prospect_html = _wrap(
        "Your Award Nomination ROI estimate",
        "Thanks for trying the ROI calculator. Here are the results you requested — "
        "yours to share with your team. Reply any time and we'll set up a walkthrough.",
        req,
    )
    try:
        await asyncio.to_thread(
            _send_sync, req.email,
            "Your Award Nomination System ROI estimate", prospect_html,
        )
    except Exception as exc:
        logger.warning("roi_router: prospect email failed for %s: %s", req.email, exc)

    # 2. Internal lead notification.
    if _NOTIFY_TO:
        internal_html = _wrap(
            "New ROI calculator lead",
            f"New lead from <b>{req.email}</b>"
            + (f" ({req.company})" if req.company else "")
            + ". Their estimate is below.",
            req,
        )
        try:
            await asyncio.to_thread(
                _send_sync, _NOTIFY_TO,
                f"[ROI Calculator] New lead from {req.email}", internal_html,
            )
        except Exception as exc:
            logger.warning("roi_router: internal notification failed: %s", exc)

    # 3. Persist lead (best-effort).
    doc = {
        "id":           lead_id,
        "name":         req.email.split("@")[0],
        "email":        req.email,
        "company":      req.company,
        "inquiry":      "ROI Calculator",
        "source":       "roi-calculator",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "employees": req.employees,
            "annual_budget": req.annual_budget,
            "plan": req.plan,
            "payroll_enabled": req.payroll_enabled,
            "overrun_enabled": req.overrun_enabled,
        },
        "results": {
            "annual_value": req.annual_value,
            "fraud_prevented": req.fraud_prevented,
            "payroll_saved": req.payroll_saved,
            "overrun_avoided": req.overrun_avoided,
            "annual_cost": req.annual_cost,
            "net_benefit": req.net_benefit,
            "roi_percent": req.roi_percent,
            "payback_months": req.payback_months,
        },
    }
    try:
        await _save_to_cosmos(doc)
    except Exception as exc:
        logger.warning("roi_router: Cosmos lead write failed for id=%s: %s", lead_id, exc)

    return RoiEmailResponse(ok=True, id=lead_id)
