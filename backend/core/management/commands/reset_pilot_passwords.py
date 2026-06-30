import secrets
import string
from django.core.management.base import BaseCommand
from core.models import User


ALPHABET = string.ascii_letters + string.digits + '!@#$%'


def gen_password():
    return ''.join(secrets.choice(ALPHABET) for _ in range(12))


class Command(BaseCommand):
    help = 'Reset passwords for all active users for pilot rollout and print credentials'

    def add_arguments(self, parser):
        parser.add_argument(
            '--role', type=str, default=None,
            help='Only reset users with this role (optional)'
        )

    def handle(self, *args, **options):
        role_filter = options.get('role')
        qs = User.objects.filter(is_active=True)
        if role_filter:
            qs = qs.filter(role=role_filter)
        qs = qs.order_by('role', 'first_name')

        self.stdout.write(self.style.SUCCESS(
            f'\n{"="*70}\n  LAKE ZONE ERP — PILOT LOGIN CREDENTIALS\n{"="*70}'
        ))
        self.stdout.write(f'{"NAME":<30} {"EMAIL":<35} {"ROLE":<25} {"PASSWORD":<15}')
        self.stdout.write('-' * 105)

        updated = 0
        for user in qs:
            pwd = gen_password()
            user.set_password(pwd)
            user.must_change_password = True
            user.save(update_fields=['password', 'must_change_password'])
            name = user.get_full_name() or user.email
            self.stdout.write(f'{name:<30} {user.email:<35} {user.role:<25} {pwd:<15}')
            updated += 1

        self.stdout.write('-' * 105)
        self.stdout.write(self.style.SUCCESS(
            f'\n✓ {updated} user(s) reset. All users will be prompted to change password on first login.\n'
        ))
