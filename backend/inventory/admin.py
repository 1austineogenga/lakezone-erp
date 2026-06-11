from django.contrib import admin
from .models import Store, StockItem, StockLevel, StockTransaction


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ["name", "location", "storekeeper", "is_active"]


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ["item_code", "name", "category", "unit", "reorder_level", "valuation_method"]
    list_filter = ["category", "valuation_method"]
    search_fields = ["item_code", "name"]


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ["item", "store", "quantity_on_hand", "weighted_avg_cost", "last_updated"]
    list_filter = ["store"]


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = [
        "reference_number", "transaction_type", "item", "store",
        "quantity", "unit_cost", "project", "transaction_date",
    ]
    list_filter = ["transaction_type", "store"]
    search_fields = ["reference_number"]
    readonly_fields = ["created_at"]
