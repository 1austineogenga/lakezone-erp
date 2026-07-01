# Lakezone ERP — Claude Code Notes

## Server
- **Path**: `/var/www/html/lakezone-new`
- **Backend**: `/var/www/html/lakezone-new/backend`
- **Frontend**: `/var/www/html/lakezone-new/frontend`
- **Service**: `lakezone.service`
- **Python**: `python3` (not `python`)

## Virtualenv
- **Path**: `/var/www/html/lakezone-new/backend/venv`
- **Python**: `/var/www/html/lakezone-new/backend/venv/bin/python`

## Deploy command
```bash
cd /var/www/html/lakezone-new && git pull origin main && cd frontend && npm run build && sudo systemctl restart lakezone.service
```

## Management commands
```bash
cd /var/www/html/lakezone-new/backend && /var/www/html/lakezone-new/backend/venv/bin/python manage.py <command>
```

## Git workflow
- Development branch: `claude/brave-pascal-tgq7up`
- All PRs merge into **main**
- After merging, deploy always pulls from **main**
- Never push directly to main

## Stack
- Backend: Django REST Framework
- Frontend: React + TanStack Query v5 + Tailwind CSS
- Auth: JWT (SimpleJWT)
- Notifications: in-app (polled 30s) + email via Django send_mail
