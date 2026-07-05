import logging
import os

logger = logging.getLogger(__name__)

_app = None


def _get_app():
    global _app
    if _app is not None:
        return _app
    creds_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    if not creds_path or not os.path.exists(creds_path):
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(creds_path)
        _app = firebase_admin.initialize_app(cred)
    except Exception as exc:
        logger.error("Firebase init failed: %s", exc)
        _app = None
    return _app


def send_push(tokens, title, message, link=""):
    if not tokens:
        return
    app = _get_app()
    if app is None:
        return
    try:
        from firebase_admin import messaging
        msgs = [
            messaging.Message(
                notification=messaging.Notification(title=title, body=message),
                data={"link": link} if link else {},
                token=token,
            )
            for token in tokens
        ]
        response = messaging.send_each(msgs)
        if response.failure_count:
            logger.warning("FCM: %d of %d messages failed", response.failure_count, len(msgs))
    except Exception as exc:
        logger.error("FCM send failed: %s", exc)
