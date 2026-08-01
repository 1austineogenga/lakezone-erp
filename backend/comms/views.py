from django.utils import timezone
from django.db.models import Q, Subquery, OuterRef, Exists
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Conversation, ConversationParticipant, Message,
    MessageAttachment, MessageReadReceipt,
)
from .serializers import ConversationListSerializer, ConversationDetailSerializer

from notifications.models import Notification
from core.models import User

BROADCAST_ALL_ROLES = {'system_admin', 'md', 'hr', 'admin', 'finance',
                       'managing_director', 'hr_manager', 'admin_officer', 'finance_officer', 'finance_manager'}
BROADCAST_OPS_ROLES = {'site_manager'}


def _create_notifications(participants, creator, subject, body):
    notifs = []
    for user in participants:
        if user.id == creator.id:
            continue
        notifs.append(Notification(
            recipient=user,
            type=Notification.Type.GENERAL,
            title=f"New message: {subject}",
            message=f"{creator.get_full_name()}: {body[:100]}",
        ))
    if notifs:
        Notification.objects.bulk_create(notifs)


def _handle_attachments(request, message):
    for f in request.FILES.getlist('attachments'):
        MessageAttachment.objects.create(
            message=message,
            file=f,
            filename=f.name,
            file_size=f.size,
        )


class ConversationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationListSerializer

    def get_queryset(self):
        user = self.request.user
        folder = self.request.query_params.get('folder')
        conv_type = self.request.query_params.get('type')

        if folder == 'archived':
            return Conversation.objects.filter(
                participants__user=user,
                participants__is_archived=True,
            ).distinct()

        if folder == 'sent':
            return Conversation.objects.filter(
                creator=user,
                participants__user=user,
                participants__is_archived=False,
            ).distinct()

        if conv_type == 'broadcast':
            return Conversation.objects.filter(
                conversation_type='broadcast',
                participants__user=user,
                participants__is_archived=False,
            ).distinct()

        # Default inbox: not broadcast, not archived, user is participant
        return Conversation.objects.filter(
            participants__user=user,
            participants__is_archived=False,
        ).exclude(conversation_type='broadcast').distinct()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        return ctx

    def create(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        subject = data.get('subject', '').strip()
        body = data.get('body', '').strip()
        conv_type = data.get('conversation_type', 'direct')
        is_reply_disabled = data.get('is_reply_disabled', False)
        broadcast_scope = data.get('broadcast_scope', 'all')
        recipient_ids = data.get('recipient_ids', [])

        if not subject or not body:
            return Response({'detail': 'subject and body are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Broadcast permission validation
        if conv_type == 'broadcast':
            user_role = user.role
            if user_role in BROADCAST_ALL_ROLES:
                pass  # can use any scope
            elif user_role in BROADCAST_OPS_ROLES:
                if broadcast_scope != 'operations':
                    return Response(
                        {'detail': 'Site managers can only broadcast to Operations department.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                return Response(
                    {'detail': 'You do not have permission to send broadcast messages.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif conv_type == 'direct':
            if len(recipient_ids) != 1:
                return Response({'detail': 'Direct messages require exactly 1 recipient.'}, status=status.HTTP_400_BAD_REQUEST)
        elif conv_type == 'group':
            if len(recipient_ids) < 1:
                return Response({'detail': 'Group messages require at least 1 recipient.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create conversation
        conversation = Conversation.objects.create(
            subject=subject,
            creator=user,
            conversation_type=conv_type,
            is_reply_disabled=is_reply_disabled,
        )

        # Add creator as participant
        ConversationParticipant.objects.create(conversation=conversation, user=user)

        # Determine participants
        if conv_type == 'broadcast':
            if broadcast_scope == 'all':
                recipients = User.objects.filter(is_active=True).exclude(id=user.id)
            else:  # operations
                recipients = User.objects.filter(
                    is_active=True,
                    department__name__iexact='Operations',
                ).exclude(id=user.id)
            ConversationParticipant.objects.bulk_create([
                ConversationParticipant(conversation=conversation, user=r)
                for r in recipients
            ], ignore_conflicts=True)
        else:
            recipients = User.objects.filter(id__in=recipient_ids, is_active=True)
            for r in recipients:
                ConversationParticipant.objects.get_or_create(conversation=conversation, user=r)

        # Create first message
        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            body=body,
        )

        # Handle attachments
        _handle_attachments(request, message)

        # Create notifications
        _create_notifications(list(recipients), user, subject, body)

        serializer = self.get_serializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationDetailSerializer

    def get_queryset(self):
        return Conversation.objects.filter(
            participants__user=self.request.user,
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # Mark all unread messages as read
        existing_read_ids = MessageReadReceipt.objects.filter(
            user=user,
            message__conversation=instance,
        ).values_list('message_id', flat=True)

        unread_messages = instance.messages.exclude(id__in=existing_read_ids).exclude(sender=user)
        receipts = [MessageReadReceipt(message=m, user=user) for m in unread_messages]
        if receipts:
            MessageReadReceipt.objects.bulk_create(receipts, ignore_conflicts=True)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ConversationArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            participant = ConversationParticipant.objects.get(
                conversation_id=pk,
                user=request.user,
            )
        except ConversationParticipant.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        participant.is_archived = True
        participant.archived_at = timezone.now()
        participant.save(update_fields=['is_archived', 'archived_at'])
        return Response({'detail': 'Conversation archived.'})


class ConversationReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            participant = ConversationParticipant.objects.get(
                conversation_id=pk,
                user=user,
            )
        except ConversationParticipant.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        conversation = participant.conversation

        if conversation.is_reply_disabled:
            return Response(
                {'detail': 'Replies are disabled for this conversation.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        body = request.data.get('body', '').strip()
        if not body:
            return Response({'detail': 'body is required.'}, status=status.HTTP_400_BAD_REQUEST)

        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            body=body,
        )

        _handle_attachments(request, message)

        # Update conversation updated_at
        conversation.save()

        # Notify other participants
        other_participants = User.objects.filter(
            conversation_participants__conversation=conversation,
        ).exclude(id=user.id)
        _create_notifications(list(other_participants), user, conversation.subject, body)

        from .serializers import MessageSerializer
        serializer = MessageSerializer(message, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Conversations where user is participant and has at least one unread message
        read_ids_subq = MessageReadReceipt.objects.filter(
            user=user,
            message__conversation=OuterRef('pk'),
        )
        unread_msg_subq = Message.objects.filter(
            conversation=OuterRef('pk'),
        ).exclude(
            sender=user,
        ).exclude(
            Exists(MessageReadReceipt.objects.filter(message=OuterRef('pk'), user=user))
        )

        count = Conversation.objects.filter(
            participants__user=user,
            participants__is_archived=False,
        ).filter(
            Exists(unread_msg_subq)
        ).distinct().count()

        return Response({'count': count})
