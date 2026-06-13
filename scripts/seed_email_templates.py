"""
seed_email_templates.py
────────────────────────
One-off script to upsert the per-service email templates into the CosmosDB
email_templates container.

Each document is one email template, identified by `template_type` (which is
also used as the document `id`), following the convention:

    <service-slug>-<template-name>

Template names (one set per service):
    corporate-heads-up-email   — internal notification to sales@ (Email #1)
    user-welcome-email         — requester welcome / confirmation (Email #2)
    user-presentation-email    — onboarding deck delivery (Email #3)

Tokens
  Subjects and html_body strings use lowercase {{token}} placeholders,
  substituted server-side by services/email_template_service.py:

    {{first_name}}      {{full_name}}       {{org_name}}
    {{email}}           {{industry}}        {{user_count}}
    {{use_case}}        {{tier_interest}}   {{engagement_type}}
    {{account_id}}      {{engagement_id}}

  Unmatched tokens are left as-is in the rendered output, so a missing
  token is easy to spot during testing.

The corresponding engagement_details documents (scripts/seed_engagement.py)
reference these template_type values in their `notifications` block, along
with `sending_corporation` — the display name used in the email's From:
header. Both services currently send through the same Zoho mailbox
(SMTP_USER); only the display name and template content differ per service.

Run locally (requires az login or AZURE_COSMOS_KEY env var):

    python seed_email_templates.py

Run against a specific endpoint:

    AZURE_COSMOS_ENDPOINT=https://... python seed_email_templates.py

The script uses upsert_item so it is safe to re-run — it will overwrite
the existing document with the latest version defined below.
"""

from __future__ import annotations

import asyncio
import json
import os

from azure.cosmos.aio import CosmosClient
from azure.identity.aio import DefaultAzureCredential

from dotenv import load_dotenv
load_dotenv()

_CONTAINER = "email_templates"


# ─────────────────────────────────────────────────────────────────────────────
# Award Nomination — Terianix.ai branding (purple)
# ─────────────────────────────────────────────────────────────────────────────

AWARD_CORPORATE_HEADS_UP = {
    "id": "award-nomination-corporate-heads-up-email",
    "template_type": "award-nomination-corporate-heads-up-email",
    "service": "Award Nomination",
    "label": "corporate-heads-up-email",
    "subject": "[New Engagement] {{org_name}} — {{engagement_type}}",
    "html_body": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Engagement Request</h1>
            <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;">
              terianix.ai
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Contact</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">Name</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{full_name}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{{email}}" style="color:#0d9488;text-decoration:none;">{{email}}</a>
                </td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{org_name}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Industry</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{{industry}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Est. Users</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{user_count}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Engagement</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#8b5cf6;">{{engagement_type}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Tier Interest</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{tier_interest}}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Notes</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #8b5cf6;border-radius:6px;padding:16px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">{{use_case}}</div>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              Account ID: {{account_id}}<br>
              Engagement ID: {{engagement_id}}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terianix.ai · terianix.ai
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>""",
}

AWARD_USER_WELCOME = {
    "id": "award-nomination-user-welcome-email",
    "template_type": "award-nomination-user-welcome-email",
    "service": "Award Nomination",
    "label": "user-welcome-email",
    "subject": "Welcome to Terianix.ai — we've received your request",
    "html_body": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">Welcome to Terianix.ai</h1>
            <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;">
              terianix.ai
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.6;">
              Hi {{first_name}},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for reaching out — we're glad you're here. We've received your engagement
              request for <strong style="color:#111827;">{{org_name}}</strong> and our team
              will be in touch shortly to discuss next steps.
            </p>

            <!-- Summary card -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Your Request Summary</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:140px;">Engagement</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#8b5cf6;">{{engagement_type}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Tier</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{tier_interest}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{{org_name}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Est. Users</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{{user_count}}</td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              We're preparing a personalised overview of how Terianix.ai can address your
              needs. You'll receive it via a follow-up email shortly — keep an eye on your inbox.
            </p>

            <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
              In the meantime, feel free to reach us at
              <a href="mailto:sales@terian-services.com"
                 style="color:#8b5cf6;text-decoration:none;">sales@terian-services.com</a>
              with any questions.
            </p>

            <p style="margin:28px 0 0;font-size:15px;color:#374151;line-height:1.6;">
              Warm regards,<br>
              <strong style="color:#111827;">The Terianix.ai Team</strong>
            </p>

            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;">
              Reference: {{engagement_id}}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terianix.ai · terianix.ai
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>""",
}

AWARD_USER_PRESENTATION = {
    "id": "award-nomination-user-presentation-email",
    "template_type": "award-nomination-user-presentation-email",
    "service": "Award Nomination",
    "label": "user-presentation-email",
    "subject": "Your Terianix.ai onboarding overview — {{org_name}}",
    "html_body": """<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Your Onboarding Overview</h1>
            <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;">terianix.ai</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.6;">Hi {{first_name}},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Please find attached your personalised onboarding overview of the Terianix.ai
              <strong style="color:#111827;">Award Nomination</strong> platform for
              <strong style="color:#111827;">{{org_name}}</strong>.
              The deck covers the system capabilities and engagement tiers, and will serve as
              the foundation for our first meeting, expected in the coming days.
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Our team will be in touch within <strong>two business days</strong> to schedule
              a brief discovery call. If you have any questions before then, don't hesitate to
              reach us at
              <a href="mailto:sales@terian-services.com" style="color:#8b5cf6;text-decoration:none;">
                sales@terian-services.com</a>.
            </p>
            <p style="margin:28px 0 0;font-size:15px;color:#374151;line-height:1.6;">
              Looking forward to working with you,<br>
              <strong style="color:#111827;">The Terianix.ai Team</strong>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Terianix.ai · terianix.ai</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>""",
}


# ─────────────────────────────────────────────────────────────────────────────
# Contract Services — Terian Services branding (teal)
# ─────────────────────────────────────────────────────────────────────────────

CONTRACT_CORPORATE_HEADS_UP = {
    "id": "contract-services-corporate-heads-up-email",
    "template_type": "contract-services-corporate-heads-up-email",
    "service": "Contract Services",
    "label": "corporate-heads-up-email",
    "subject": "[New Engagement] {{org_name}} — {{engagement_type}}",
    "html_body": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">New Engagement Request</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">
              terian-services.com
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Contact</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:130px;">Name</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{full_name}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Email</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;">
                  <a href="mailto:{{email}}" style="color:#0d9488;text-decoration:none;">{{email}}</a>
                </td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{org_name}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Industry</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{{industry}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Est. Users</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{user_count}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Engagement</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0d9488;">{{engagement_type}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Tier Interest</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{tier_interest}}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Notes</p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #0d9488;border-radius:6px;padding:16px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">{{use_case}}</div>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              Account ID: {{account_id}}<br>
              Engagement ID: {{engagement_id}}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terian Services · terian-services.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>""",
}

CONTRACT_USER_WELCOME = {
    "id": "contract-services-user-welcome-email",
    "template_type": "contract-services-user-welcome-email",
    "service": "Contract Services",
    "label": "user-welcome-email",
    "subject": "Welcome to Terian Services — we've received your request",
    "html_body": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);
                     padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;
                       letter-spacing:-0.3px;">Welcome to Terian Services</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">
              terian-services.com
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">

            <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.6;">
              Hi {{first_name}},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Thank you for reaching out — we're glad you're here. We've received your
              Contract Services request for <strong style="color:#111827;">{{org_name}}</strong>
              and our team will be in touch shortly to discuss next steps.
            </p>

            <!-- Summary card -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb;border-radius:8px;
                          overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td colspan="2"
                    style="padding:12px 16px;font-size:11px;font-weight:700;
                           color:#6b7280;text-transform:uppercase;
                           letter-spacing:0.5px;">Your Request Summary</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;width:140px;">Engagement</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#0d9488;">{{engagement_type}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Tier</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#111827;">{{tier_interest}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Organization</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{{org_name}}</td>
              </tr>
              <tr style="border-top:1px solid #e5e7eb;background:#f9fafb;">
                <td style="padding:10px 16px;color:#6b7280;font-size:13px;">Est. Users</td>
                <td style="padding:10px 16px;font-size:13px;color:#111827;">{{user_count}}</td>
              </tr>
            </table>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              We're preparing a short intro presentation covering how this engagement typically
              runs — scope, timeline, and payment milestones. You'll receive it via a follow-up
              email shortly, and it'll be the starting point for our kickoff meeting.
            </p>

            <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
              In the meantime, feel free to reach us at
              <a href="mailto:sales@terian-services.com"
                 style="color:#0d9488;text-decoration:none;">sales@terian-services.com</a>
              with any questions.
            </p>

            <p style="margin:28px 0 0;font-size:15px;color:#374151;line-height:1.6;">
              Warm regards,<br>
              <strong style="color:#111827;">The Terian Services Team</strong>
            </p>

            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;">
              Reference: {{engagement_id}}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;
                     background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Terian Services · terian-services.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>""",
}

CONTRACT_USER_PRESENTATION = {
    "id": "contract-services-user-presentation-email",
    "template_type": "contract-services-user-presentation-email",
    "service": "Contract Services",
    "label": "user-presentation-email",
    "subject": "Your Terian Services onboarding overview — {{org_name}}",
    "html_body": """<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:580px;">

        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Your Onboarding Overview</h1>
            <p style="margin:6px 0 0;color:#99f6e4;font-size:13px;">terian-services.com</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#111827;line-height:1.6;">Hi {{first_name}},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Please find attached the intro presentation for your
              <strong style="color:#111827;">{{engagement_type}}</strong> engagement with
              <strong style="color:#111827;">{{org_name}}</strong>.
              It covers how the engagement is scoped, how payment milestones work, and what
              happens next — and will be the starting point for our kickoff meeting.
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              Our team will be in touch within <strong>two business days</strong> to schedule
              that kickoff meeting. If you have any questions before then, don't hesitate to
              reach us at
              <a href="mailto:sales@terian-services.com" style="color:#0d9488;text-decoration:none;">
                sales@terian-services.com</a>.
            </p>
            <p style="margin:28px 0 0;font-size:15px;color:#374151;line-height:1.6;">
              Looking forward to working with you,<br>
              <strong style="color:#111827;">The Terian Services Team</strong>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 40px;border-top:1px solid #e5e7eb;background:#f9fafb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Terian Services · terian-services.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>""",
}


TEMPLATES = [
    AWARD_CORPORATE_HEADS_UP,
    AWARD_USER_WELCOME,
    AWARD_USER_PRESENTATION,
    CONTRACT_CORPORATE_HEADS_UP,
    CONTRACT_USER_WELCOME,
    CONTRACT_USER_PRESENTATION,
]


async def seed() -> None:
    endpoint = os.environ.get("AZURE_COSMOS_ENDPOINT", "")
    database_name = os.environ.get("AZURE_COSMOS_DATABASE", "terian-services")

    if not endpoint:
        raise SystemExit(
            "AZURE_COSMOS_ENDPOINT is not set. "
            "Export it or add it to your .env file."
        )

    print(f"Connecting to {endpoint} …")
    async with DefaultAzureCredential() as credential:
        async with CosmosClient(endpoint, credential=credential) as client:
            container = (
                client
                .get_database_client(database_name)
                .get_container_client(_CONTAINER)
            )
            for template in TEMPLATES:
                result = await container.upsert_item(body=template)
                print(f"Upserted: id={result['id']}  service={result['service']}")


if __name__ == "__main__":
    asyncio.run(seed())
