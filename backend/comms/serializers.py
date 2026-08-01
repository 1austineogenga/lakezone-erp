from rest_framework import serializers
from .models import Conversation, ConversationParticipant, Message, MessageAttachment, MessageReadReceipt


class MessageAttachmentSerializer(serializers.ModelSerializer):
    file = serializers.FileField(use_url=True)

    class Meta:
        model = MessageAttachment
        fields = ['id', 'filename', 'file', 'file_size', 'uploaded_at']


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    read_by = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'body', 'created_at', 'attachments', 'read_by']

    def get_sender(self, obj):
        return {
            'id': str(obj.sender.id),
            'full_name': obj.sender.get_full_name(),
        }

    def get_read_by(self, obj):
        return list(
            obj.read_receipts.select_related('user').values_list('user__first_name', flat=False)
            .order_by('read_at')
        )

    def get_read_by(self, obj):
        return [
            receipt.user.get_full_name()
            for receipt in obj.read_receipts.select_related('user').all()
        ]


class ConversationListSerializer(serializers.ModelSerializer):
    creator = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'subject', 'conversation_type', 'creator',
            'is_reply_disabled', 'created_at', 'updated_at',
            'participant_count', 'unread_count', 'last_message',
        ]

    def get_creator(self, obj):
        return {
            'id': str(obj.creator.id),
            'full_name': obj.creator.get_full_name(),
        }

    def get_participant_count(self, obj):
        return obj.participants.count()

    def get_unread_count(self, obj):
        user = self.context['request'].user
        read_message_ids = MessageReadReceipt.objects.filter(
            user=user,
            message__conversation=obj,
        ).values_list('message_id', flat=True)
        return obj.messages.exclude(id__in=read_message_ids).exclude(sender=user).count()

    def get_last_message(self, obj):
        last = obj.messages.order_by('-created_at').first()
        if not last:
            return None
        return {
            'body': last.body[:100],
            'sender': last.sender.get_full_name(),
            'created_at': last.created_at,
        }


class ConversationDetailSerializer(ConversationListSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    participants = serializers.SerializerMethodField()

    class Meta(ConversationListSerializer.Meta):
        fields = ConversationListSerializer.Meta.fields + ['messages', 'participants']

    def get_participants(self, obj):
        return [
            {
                'id': str(p.user.id),
                'full_name': p.user.get_full_name(),
                'role_display': p.user.get_role_display(),
            }
            for p in obj.participants.select_related('user').all()
        ]
