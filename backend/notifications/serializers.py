from rest_framework import serializers
from .models import Notification, ScheduledAction, ActionComment


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "message", "link", "is_read", "created_at"]
        read_only_fields = ["id", "type", "title", "message", "link", "created_at"]


class ActionCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)

    class Meta:
        model  = ActionComment
        fields = '__all__'
        read_only_fields = ['author', 'created_at']


class ScheduledActionSerializer(serializers.ModelSerializer):
    created_by_name  = serializers.CharField(source='created_by.get_full_name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    comments         = ActionCommentSerializer(many=True, read_only=True)
    is_overdue       = serializers.SerializerMethodField()

    class Meta:
        model  = ScheduledAction
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_is_overdue(self, obj):
        from datetime import date
        return obj.status not in ('completed', 'cancelled') and obj.due_date < date.today()
