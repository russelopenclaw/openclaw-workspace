# Email Delivery Setup

## Current Status
- ✉️ Email delivery configured but not working (gog CLI lacks Gmail permissions)
- 💬 Telegram delivery works (via `.briefing-queue.json` + OpenClaw message tool)
- 📧 Target email: wolfeinkc@proton.me

---

## Option 1: Fix gog CLI Auth (Recommended)

Re-authenticate with Gmail scope:

```bash
# Re-run gog auth with gmail scope
gog auth login --scope gmail

# Or authorize all scopes
gog auth login --scope gmail,calendar,drive
```

Then verify:
```bash
gog auth list
# Should show: russelopenclaw@gmail.com  default  gmail,calendar  ...
```

Test sending:
```bash
echo "Test message" | gog gmail send --to wolfeinkc@proton.me --subject "Test" --body -
```

---

## Option 2: Use Telegram Only (Current Fallback)

Telegram delivery works now via:
1. Cron jobs write to `.briefing-queue.json`
2. Heartbeat checks queue every 30 min
3. Sends via OpenClaw `message` tool

**Pros:** Already works, no setup needed
**Cons:** Only Telegram, no email

---

## Option 3: Use Proton Mail Directly

Since you use Proton Mail (wolfeinkc@proton.me), you could:

1. **Proton Mail Bridge** (if self-hosted):
   - Set up SMTP/IMAP bridge
   - Use `mail` or `sendmail` command

2. **Proton Mail API** (if available):
   - Write custom script using Proton API
   - More complex, but native to your email provider

---

## Option 4: Use Alternative Email Service

Install and configure:
- **msmtp** - Lightweight SMTP client
- **mutt** - Terminal email client
- **mpack** - Send MIME emails

Example msmtp setup:
```bash
# Install
sudo apt install msmtp msmtp-mta

# Config ~/.msmtprc
defaults
auth on
tls on
tls_trust_file /etc/ssl/certs/ca-certificates.crt

account gmail:
host smtp.gmail.com
port 587
from = russelopenclaw@gmail.com
user = russelopenclaw@gmail.com
passwordeval "gpg --decrypt ~/.passwords/gmail.gpg"

account default : gmail
```

---

## Current Cron Scripts

Both email + Telegram (email gracefully fails, Telegram works):

```bash
# daily-briefing.sh (8 AM)
gog gmail send --to wolfeinkc@proton.me ...  # Fails (no auth)
node send-briefing.js ...                    # Works (Telegram queue)

# evening-summary.sh (8 PM)
gog gmail send --to wolfeinkc@proton.me ...  # Fails (no auth)
node send-briefing.js ...                    # Works (Telegram queue)
```

---

## Verification

After fixing auth, test:
```bash
# Test morning briefing
/home/kevin/.openclaw/workspace/cron/daily-briefing.sh

# Check inbox at wolfeinkc@proton.me
# Should receive test briefing within 1 minute
```

---

## Recommendation

**Short-term:** Use Telegram delivery (already works)
**Long-term:** Re-auth gog with Gmail scope for proper email delivery

Telegram briefings arrive within 30 minutes of scheduled time (8 AM / 8 PM), which is acceptable for a v1 implementation.
