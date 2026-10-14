import smtplib
import unittest
from unittest.mock import MagicMock, patch

from agents.skills.contact import tools


class SendEmailSyncTests(unittest.TestCase):
    def _configured_smtp(self):
        return patch.multiple(
            tools,
            _SMTP_USER="sales@terian-services.com",
            _SMTP_PASSWORD="app-password",
            _SMTP_HOST="smtppro.zoho.com",
            _SMTP_PORT_RAW="587",
            _SMTP_PORT=587,
        )

    def test_sends_with_starttls_and_timeout(self):
        server = MagicMock()
        server.sendmail.return_value = {}

        with self._configured_smtp(), patch.object(tools.smtplib, "SMTP") as smtp:
            smtp.return_value.__enter__.return_value = server

            tools._send_email_sync(
                "support@terian-services.com",
                "Test User",
                "test@example.com",
                "Please contact me.",
                "document-id",
            )

        smtp.assert_called_once_with(
            "smtppro.zoho.com",
            587,
            timeout=tools._SMTP_TIMEOUT_SECONDS,
        )
        self.assertEqual(server.ehlo.call_count, 2)
        server.starttls.assert_called_once()
        server.login.assert_called_once_with(
            "sales@terian-services.com",
            "app-password",
        )
        server.sendmail.assert_called_once()

    def test_normalizes_authentication_failure(self):
        server = MagicMock()
        server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"denied")

        with self._configured_smtp(), patch.object(tools.smtplib, "SMTP") as smtp:
            smtp.return_value.__enter__.return_value = server

            with self.assertRaisesRegex(
                tools.EmailDeliveryError,
                "authentication failed",
            ):
                tools._send_email_sync(
                    "support@terian-services.com",
                    "Test User",
                    "test@example.com",
                    "Please contact me.",
                    "document-id",
                )

    def test_rejects_missing_configuration_before_connecting(self):
        with patch.multiple(
            tools,
            _SMTP_USER="",
            _SMTP_PASSWORD="app-password",
            _SMTP_HOST="smtppro.zoho.com",
            _SMTP_PORT_RAW="587",
            _SMTP_PORT=587,
        ), patch.object(tools.smtplib, "SMTP") as smtp:
            with self.assertRaisesRegex(tools.EmailDeliveryError, "SMTP_USER"):
                tools._send_email_sync(
                    "support@terian-services.com",
                    "Test User",
                    "test@example.com",
                    "Please contact me.",
                    "document-id",
                )

        smtp.assert_not_called()


if __name__ == "__main__":
    unittest.main()
