"""
Middleware that stores the current request user in thread-local storage
so audit signals can reference it without needing the request object.
"""
from .audit_signals import set_audit_user


class AuditUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            set_audit_user(user)
        else:
            set_audit_user(None)
        try:
            return self.get_response(request)
        finally:
            set_audit_user(None)
