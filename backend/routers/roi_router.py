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


SITE_URL     = "https://terianix.ai"
LOGO_URL     = "https://terianix.ai/logo-email.png"
PRODUCT_URL  = "https://terianix.ai/products/award-nomination"
CONTACT_URL  = "https://terianix.ai/contact"
CALC_URL     = "https://terianix.ai/pricing/award-nomination/roi_calculator"


def _months_short(n: float | None) -> str:
    return "n/a" if n is None else f"{n:.1f} mo"


def _highlight(req: "RoiEmailRequest") -> str:
    """Big, cheerful stat chips at the top of the results."""
    if req.roi_percent is not None:
        chips = [
            ("ROI", _pct(req.roi_percent), "#047857"),
            ("Payback", _months_short(req.payback_months), "#6d28d9"),
            ("Annual value", _usd(req.annual_value), "#6d28d9"),
        ]
    else:
        chips = [("Estimated annual value", _usd(req.annual_value), "#6d28d9")]

    width = 100 // len(chips)
    cells = ""
    for label, value, color in chips:
        cells += (
            f'<td width="{width}%" style="padding:6px;" valign="top">'
            '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"'
            ' style="background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;">'
            '<tr><td style="padding:16px 14px;text-align:center;">'
            f'<div style="font-size:11px;font-weight:700;letter-spacing:0.5px;'
            f'text-transform:uppercase;color:#7c3aed;">{label}</div>'
            f'<div style="margin-top:6px;font-size:26px;font-weight:800;color:{color};">{value}</div>'
            '</td></tr></table></td>'
        )
    return (
        '<table width="100%" cellpadding="0" cellspacing="0" role="presentation"'
        ' style="margin:0 0 24px;"><tr>' + cells + "</tr></table>"
    )


def _button(href: str, label: str, primary: bool) -> str:
    if primary:
        style = ("background:#7c3aed;color:#ffffff;border:1px solid #7c3aed;")
    else:
        style = ("background:#ffffff;color:#7c3aed;border:1px solid #c4b5fd;")
    return (
        f'<a href="{href}" style="display:inline-block;{style}'
        "text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;"
        f'border-radius:10px;margin:0 8px 8px 0;">{label}</a>'
    )


def _wrap(title: str, intro: str, req: "RoiEmailRequest") -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f2fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f2fb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:600px;
                    box-shadow:0 4px 16px rgba(76,29,149,.10);">

        <!-- Brand bar -->
        <tr><td style="padding:22px 40px;border-bottom:1px solid #ece9f7;">
          <a href="{SITE_URL}" style="text-decoration:none;">
            <img src="{LOGO_URL}" width="38" height="42" alt="Terianix.ai"
                 style="vertical-align:middle;border:0;">
            <span style="vertical-align:middle;margin-left:12px;font-size:20px;
                         font-weight:800;color:#4c1d95;letter-spacing:-0.3px;">Terianix.ai</span>
          </a>
        </td></tr>

        <!-- Product banner -->
        <tr><td bgcolor="#6d28d9"
                style="background:#6d28d9;background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
                       padding:26px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
            Award Nomination System</h1>
          <p style="margin:6px 0 0;color:#ddd6fe;font-size:13px;line-height:1.5;">
            Monetary employee recognition with an AI integrity engine — fraud, favoritism, and
            collusion caught before payout.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:30px 40px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.5px;
                    text-transform:uppercase;color:#7c3aed;">{title}</p>
          <p style="margin:0 0 22px;font-size:15px;color:#374151;line-height:1.7;">{intro}</p>

          {_highlight(req)}

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                 style="border:1px solid #ede9fe;border-radius:12px;overflow:hidden;margin-bottom:26px;">
            <tr style="background:#f5f3ff;"><td colspan="2"
              style="padding:12px 16px;font-size:11px;font-weight:700;color:#7c3aed;
                     text-transform:uppercase;letter-spacing:0.5px;">Full breakdown</td></tr>
            {_results_rows(req)}
          </table>

          <div style="text-align:center;margin:0 0 24px;">
            {_button(PRODUCT_URL, "Explore the platform →", True)}
            {_button(CONTACT_URL, "Book a walkthrough", False)}
          </div>

          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            Estimate for illustration only, based on your inputs and stated assumptions;
            not a guarantee of results.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #ece9f7;background:#faf9ff;text-align:center;">
          <p style="margin:0;font-size:13px;color:#6b7280;">
            <a href="{SITE_URL}" style="color:#7c3aed;font-weight:700;text-decoration:none;">terianix.ai</a>
            &nbsp;·&nbsp; Award Nomination System
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#b6b0c9;">
            <a href="{CALC_URL}" style="color:#a78bfa;text-decoration:none;">Re-run the ROI calculator</a>
          </p>
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
