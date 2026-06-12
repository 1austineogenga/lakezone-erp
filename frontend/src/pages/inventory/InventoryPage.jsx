import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStockItems, getStockLevels, getTransactions } from '../../api/inventory'
import PageHeader from '../../components/common/PageHeader'
import Table from '../../components/common/Table'
import Badge from '../../components/common/Badge'

const itemColumns = [
  { key: 'code',          label: 'Code' },
  { key: 'name',          label: 'Item Name' },
  { key: 'category',      label: 'Category' },
  { key: 'unit_of_measure', label: 'UOM' },
  { key: 'weighted_avg_cost', label: 'WAC', render: (r) => r.weighted_avg_cost ? `TZS ${Number(r.weighted_avg_cost).toLocaleString()}` : '—' },
  { key: 'is_active',     label: 'Status', render: (r) => <Badge status={r.is_active ? 'active' : 'cancelled'} label={r.is_active ? 'Active' : 'Inactive'} /> },
]

const levelColumns = [
  { key: 'item_name',      label: 'Item' },
  { key: 'store_name',     label: 'Store' },
  { key: 'quantity_on_hand', label: 'On Hand', render: (r) => Number(r.quantity_on_hand).toLocaleString() },
  { key: 'reorder_level',  label: 'Reorder Level' },
  { key: 'is_below_reorder', label: 'Alert', render: (r) => r.is_below_reorder ? <Badge status="pending" label="Low Stock" /> : <Badge status="active" label="OK" /> },
]

const txColumns = [
  { key: 'item_name',      label: 'Item' },
  { key: 'transaction_type', label: 'Type', render: (r) => <Badge status={r.transaction_type === 'in' ? 'active' : 'pending'} label={r.transaction_type?.toUpperCase()} /> },
  { key: 'quantity',       label: 'Qty', render: (r) => Number(r.quantity).toLocaleString() },
  { key: 'unit_cost',      label: 'Unit Cost', render: (r) => r.unit_cost ? `TZS ${Number(r.unit_cost).toLocaleString()}` : '—' },
  { key: 'transaction_date', label: 'Date' },
  { key: 'reference',      label: 'Reference' },
]

export default function InventoryPage() {
  const [tab, setTab] = useState('levels')

  const { data: itemsData  } = useQuery({ queryKey: ['stock-items'],  queryFn: () => getStockItems({ page_size: 100 }) })
  const { data: levelsData } = useQuery({ queryKey: ['stock-levels'], queryFn: () => getStockLevels({ page_size: 100 }) })
  const { data: txData     } = useQuery({ queryKey: ['transactions'], queryFn: () => getTransactions({ page_size: 100 }) })

  const items  = itemsData?.data?.results  ?? []
  const levels = levelsData?.data?.results ?? []
  const txs    = txData?.data?.results     ?? []

  const tabs = [['levels','Stock Levels'], ['items','Items Register'], ['transactions','Transactions']]

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock management and warehouse tracking" />

      {/* Summary pills */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {[
          { label: 'Total Items', value: items.length, color: 'bg-brand-slate' },
          { label: 'Low Stock',   value: levels.filter((l) => l.is_below_reorder).length, color: 'bg-amber-500' },
          { label: 'Transactions', value: txs.length, color: 'bg-brand-red' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} text-white px-4 py-2 rounded-lg text-sm flex gap-3 items-center`}>
            <span className="font-bold text-lg">{s.value}</span>
            <span className="opacity-90">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-brand-red shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'levels'       && <Table columns={levelColumns} data={levels} />}
      {tab === 'items'        && <Table columns={itemColumns}  data={items} />}
      {tab === 'transactions' && <Table columns={txColumns}    data={txs} />}
    </div>
  )
}
