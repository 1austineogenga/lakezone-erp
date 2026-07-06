import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import {
  PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon,
  MagnifyingGlassIcon, ExclamationTriangleIcon,
  ArrowsRightLeftIcon, DocumentTextIcon, UserIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  getStockItems, createStockItem, updateStockItem,
  getTransactions, createTransaction, getLowStockItems, getStores,
  getStoreItems, getStoreRequests, createStoreRequest,
  approveStoreRequest, rejectStoreRequest, dispatchStoreRequest,
  receiveStoreRequest, returnStoreRequest, cancelStoreRequest,
} from '../../api/inventory'
import usePermissions from '../../hooks/usePermissions'
import useAuthStore from '../../store/authStore'
import api from '../../api/client'
import { getEmployees } from '../../api/hr'

// ── Constants ─────────────────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)

const INV_PAGE_SIZE = 12

// Maps each role to its store name (null = all stores)
const ROLE_STORE_MAP = {
  facility_manager:     'General Store',
  general_manager:      'General Store',
  equipment_operator:   'General Store',
  driver:               'General Store',
  head_of_security:     'General Store',
  surveillance_officer: 'General Store',
  cleaner:              'General Store',
  storekeeper:          'General Store',
  fleet_manager:        'General Store',
  procurement_officer:  'General Store',
  admin_officer:        'Admin Store',
  sales_officer:        'Admin Store',
  hr_manager:           'Admin Store',
  finance_officer:      'Admin Store',
  finance_manager:      'Admin Store',
  system_admin:         null, // all stores, full rights
  chef:                 'Kitchen Store',
  site_manager:         'Site Store',
  site_engineer:        'Site Store',
  site_foreman:         'Site Store',
  site_surveyor:        'Site Store',
  mechanic:             'Site Store',
  welder:               'Site Store',
  project_manager:      'Site Store',
  managing_director:    null, // all stores, view-only
}

function InvPageNav({ page, total, onChange }) {
  const totalPages = Math.ceil(total / INV_PAGE_SIZE)
  if (totalPages <= 1) return null
  const start = (page - 1) * INV_PAGE_SIZE + 1
  const end   = Math.min(page * INV_PAGE_SIZE, total)
  return (
    <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5">
      <p className="text-xs text-gray-600">{start}–{end} of {total} items</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors
              ${p === page ? 'bg-brand-red text-white border-brand-red' : 'border-gray-200 text-gray-600 hover:border-brand-red hover:text-brand-red'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

const CATEGORY_LABELS = {
  office_consumables:    'Office Consumables',
  stationery:            'Stationery',
  furniture:             'Furniture & Fittings',
  cleaning:              'Cleaning Supplies',
  kitchen:               'Kitchen / Canteen',
  food_ingredients:      'Food & Ingredients',
  construction_materials:'Construction Materials',
  road_materials:        'Road Materials',
  spare_parts:           'Spare Parts',
  vehicle_parts:         'Vehicle Spare Parts',
  fuel:                  'Fuel & Lubricants',
  ppe_safety:            'PPE & Safety',
  tools:                 'Tools & Equipment',
  electronics:           'Electronics',
  networking:            'Networking Equipment',
  software_license:      'Software & Licenses',
  uniforms:              'Uniforms & Clothing',
  other:                 'Other',
}

const TX_LABELS = {
  grn: 'Received',
  issue: 'Issued',
  transfer: 'Transfer',
  return: 'Return',
  adjustment: 'Adjustment',
}

const TX_COLORS = {
  grn: 'bg-green-100 text-green-700',
  issue: 'bg-blue-100 text-blue-700',
  transfer: 'bg-purple-100 text-purple-700',
  return: 'bg-amber-100 text-amber-700',
  adjustment: 'bg-gray-100 text-gray-600',
}

const TABS = [
  { key: 'items',    label: 'Items' },
  { key: 'requests', label: 'Requests' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'issue',    label: 'Issue' },
  { key: 'receive',  label: 'Receive' },
  { key: 'history',  label: 'History' },
  { key: 'lowstock', label: 'Low Stock' },
]

const SR_STATUS_COLORS = {
  submitted:  'bg-yellow-100 text-yellow-700',
  approved:   'bg-blue-100 text-blue-700',
  rejected:   'bg-red-100 text-red-700',
  dispatched: 'bg-purple-100 text-purple-700',
  received:   'bg-green-100 text-green-700',
  returned:   'bg-amber-100 text-amber-700',
  cancelled:  'bg-gray-100 text-gray-500',
}

const SR_STATUS_LABELS = {
  submitted:  'Submitted',
  approved:   'Approved',
  rejected:   'Rejected',
  dispatched: 'Dispatched',
  received:   'Received',
  returned:   'Returned',
  cancelled:  'Cancelled',
}

// ── Input style ───────────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white'

// ── Store-specific item configs ───────────────────────────────────────────────

const STORE_ITEM_CONFIGS = {
  'IT Store': {
    headerBg: '#1e40af',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    cardSelected: 'border-blue-500 bg-blue-50 ring-1 ring-blue-400',
    categoryGroups: [
      { label: 'Devices', items: [
        { value: 'electronics',      icon: '💻', label: 'Computers & Laptops',    hint: 'Laptops, desktops, servers, tablets' },
        { value: 'electronics',      icon: '🖥️', label: 'Displays & Peripherals', hint: 'Monitors, printers, scanners, projectors' },
        { value: 'electronics',      icon: '📷', label: 'AV & Cameras',           hint: 'Webcams, projectors, speakers, TVs' },
      ]},
      { label: 'Infrastructure', items: [
        { value: 'networking',       icon: '🌐', label: 'Networking Equipment',   hint: 'Routers, switches, cables, access points' },
        { value: 'electronics',      icon: '⚡', label: 'Power & UPS',            hint: 'UPS units, surge protectors, batteries' },
      ]},
      { label: 'Software & Supplies', items: [
        { value: 'software_license', icon: '📋', label: 'Software & Licenses',    hint: 'OS, antivirus, Office, subscriptions' },
        { value: 'electronics',      icon: '🖨️', label: 'IT Consumables',         hint: 'Toner, ink, cables, flash drives, adapters' },
      ]},
      { label: 'Other', items: [
        { value: 'other',            icon: '📦', label: 'Other IT Items',         hint: '' },
      ]},
    ],
    units: ['pcs', 'sets', 'licences', 'boxes', 'rolls', 'metres'],
    suggestions: ['Laptop', 'Desktop Computer', 'Monitor', 'Printer', 'Keyboard', 'Mouse', 'Router', 'Network Switch', 'UPS', 'Toner Cartridge', 'Ink Cartridge', 'Flash Drive', 'External Hard Drive', 'Network Cable', 'HDMI Cable', 'Power Strip', 'Webcam', 'Headset', 'Projector', 'Server', 'Tablet', 'Antivirus License', 'Microsoft Office License', 'Patch Panel', 'Access Point', 'IP Camera', 'NAS Storage'],
  },
  'Admin Store': {
    headerBg: '#6d28d9',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    cardSelected: 'border-purple-500 bg-purple-50 ring-1 ring-purple-400',
    categoryGroups: [
      { label: 'Office Supplies', items: [
        { value: 'office_consumables', icon: '📎', label: 'Office Consumables',   hint: 'Paper, pens, folders, tape, clips, envelopes' },
        { value: 'stationery',         icon: '✏️', label: 'Stationery',           hint: 'Notebooks, diaries, binders, files' },
      ]},
      { label: 'Furnishings & Wear', items: [
        { value: 'furniture',          icon: '🪑', label: 'Furniture & Fittings', hint: 'Desks, chairs, shelves, cabinets, partitions' },
        { value: 'uniforms',           icon: '👔', label: 'Uniforms & Clothing',  hint: 'Staff uniforms, branded wear, ID lanyards' },
      ]},
      { label: 'Facilities', items: [
        { value: 'cleaning',           icon: '🧹', label: 'Cleaning Supplies',    hint: 'Detergents, mops, disinfectants, trash bags' },
        { value: 'kitchen',            icon: '☕', label: 'Kitchen / Canteen',    hint: 'Tea, coffee, sugar, cups, utensils' },
      ]},
      { label: 'Other', items: [
        { value: 'other',              icon: '📦', label: 'Other',                hint: '' },
      ]},
    ],
    units: ['pcs', 'reams', 'boxes', 'packets', 'sets', 'rolls', 'pairs', 'bags'],
    suggestions: ['A4 Printing Paper', 'Ballpoint Pens', 'Stapler', 'Staples', 'Folders', 'Binder Clips', 'Sticky Notes', 'Rubber Bands', 'Envelopes', 'Whiteboard Markers', 'Flip Chart Paper', 'Tippex', 'Scotch Tape', 'Office Chair', 'Filing Cabinet', 'Desk', 'Bookshelf', 'Staff Uniform', 'Dishwashing Soap', 'Tissue Paper', 'Hand Sanitizer', 'Tea Bags', 'Coffee', 'Sugar', 'Creamer', 'Garbage Bags', 'Air Freshener', 'Mop & Bucket'],
  },
  'General Store': {
    headerBg: '#15803d',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    cardSelected: 'border-green-600 bg-green-50 ring-1 ring-green-500',
    categoryGroups: [
      { label: 'Spare Parts', items: [
        { value: 'vehicle_parts',         icon: '🚗', label: 'Vehicle Spare Parts',    hint: 'Engine parts, filters, belts, tyres, batteries' },
        { value: 'spare_parts',           icon: '⚙️', label: 'Machinery Spare Parts',  hint: 'Pumps, bearings, seals, hydraulic parts' },
      ]},
      { label: 'Materials & Tools', items: [
        { value: 'construction_materials',icon: '🧱', label: 'Construction Materials', hint: 'Cement, iron sheets, pipes, timber, paint' },
        { value: 'tools',                 icon: '🔧', label: 'Tools & Equipment',      hint: 'Hand tools, power tools, measuring instruments' },
      ]},
      { label: 'Safety & Operations', items: [
        { value: 'fuel',                  icon: '⛽', label: 'Fuel & Lubricants',      hint: 'Petrol, diesel, engine oil, grease, coolant' },
        { value: 'ppe_safety',            icon: '🦺', label: 'PPE & Safety',           hint: 'Helmets, gloves, boots, reflectors, harnesses' },
        { value: 'cleaning',              icon: '🧹', label: 'Cleaning Supplies',      hint: 'Mops, detergents, brooms, disinfectants' },
      ]},
      { label: 'Other', items: [
        { value: 'other',                 icon: '📦', label: 'Other',                  hint: '' },
      ]},
    ],
    units: ['pcs', 'litres', 'kg', 'metres', 'sets', 'boxes', 'drums', 'rolls', 'bags', 'tonnes'],
    suggestions: ['Engine Oil', 'Diesel Fuel', 'Petrol', 'Hydraulic Oil', 'Grease', 'Coolant', 'Air Filter', 'Oil Filter', 'Fuel Filter', 'V-Belt', 'Tyre', 'Battery', 'Spark Plug', 'Brake Pads', 'Safety Helmet', 'Safety Boots', 'Reflective Vest', 'Work Gloves', 'Safety Goggles', 'Cement', 'Iron Sheets', 'PVC Pipes', 'Welding Rods', 'Paint', 'Sandpaper', 'Spanner Set', 'Hammer', 'Drill Bits'],
  },
  'Kitchen Store': {
    headerBg: '#c2410c',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-700',
    cardSelected: 'border-orange-500 bg-orange-50 ring-1 ring-orange-400',
    categoryGroups: [
      { label: 'Food & Beverages', items: [
        { value: 'food_ingredients', icon: '🌾', label: 'Food Ingredients',        hint: 'Flour, rice, cooking oil, sugar, salt, spices' },
        { value: 'food_ingredients', icon: '🥛', label: 'Dairy & Beverages',       hint: 'Milk, tea, coffee, juices, water, creamer' },
        { value: 'food_ingredients', icon: '🥦', label: 'Fresh Produce',           hint: 'Vegetables, fruits, bread, eggs, meat' },
      ]},
      { label: 'Kitchen Operations', items: [
        { value: 'kitchen',          icon: '🍳', label: 'Cooking Supplies',        hint: 'Cooking oil, condiments, vinegar, spices' },
        { value: 'tools',            icon: '🔪', label: 'Kitchen Equipment',       hint: 'Pots, pans, knives, utensils, appliances' },
      ]},
      { label: 'Hygiene & Disposables', items: [
        { value: 'cleaning',         icon: '🧼', label: 'Cleaning & Hygiene',      hint: 'Dish soap, sanitizer, gloves, cleaning cloths' },
        { value: 'kitchen',          icon: '🥡', label: 'Disposables & Packaging', hint: 'Plates, cups, cling film, foil, paper bags' },
      ]},
      { label: 'Other', items: [
        { value: 'other',            icon: '📦', label: 'Other',                   hint: '' },
      ]},
    ],
    units: ['kg', 'litres', 'packets', 'bags', 'boxes', 'pcs', 'rolls', 'sets', 'tubes', 'bales'],
    suggestions: ['Wheat Flour', 'Rice', 'Cooking Oil', 'Sugar', 'Salt', 'Tea Bags', 'Coffee', 'Milk Powder', 'Tomato Paste', 'Onions', 'Potatoes', 'Maize Flour', 'Butter / Margarine', 'Dish Soap', 'Hand Soap', 'Paper Towels', 'Foil Paper', 'Plastic Bags', 'Disposable Plates', 'Cups', 'Washing Powder', 'Vinegar', 'Soy Sauce', 'Pepper', 'Vegetable Oil', 'Bread'],
  },
  'Site Store': {
    headerBg: '#b45309',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    cardSelected: 'border-amber-600 bg-amber-50 ring-1 ring-amber-500',
    categoryGroups: [
      { label: 'Road Construction', items: [
        { value: 'road_materials',        icon: '🛣️', label: 'Road Materials',          hint: 'Bitumen, aggregates, gravel, sand, murram, emulsion' },
        { value: 'construction_materials',icon: '🏗️', label: 'Structural Materials',    hint: 'Cement, steel bars, culverts, timber, pipes' },
      ]},
      { label: 'Equipment & Parts', items: [
        { value: 'fuel',                  icon: '⛽', label: 'Fuel & Lubricants',        hint: 'Diesel, petrol, engine oil, hydraulic oil, grease' },
        { value: 'spare_parts',           icon: '⚙️', label: 'Equipment Spare Parts',   hint: 'Grader, dozer, compactor, excavator, roller parts' },
        { value: 'tools',                 icon: '🔧', label: 'Tools & Small Equipment',  hint: 'Hand tools, levels, measuring tapes, shovels' },
      ]},
      { label: 'Safety & Consumables', items: [
        { value: 'ppe_safety',            icon: '🦺', label: 'PPE & Safety',             hint: 'Helmets, boots, vests, goggles, ear muffs' },
        { value: 'other',                 icon: '🔩', label: 'Site Consumables',         hint: 'Bolts, nuts, washers, cable ties, marking paint' },
      ]},
      { label: 'Other', items: [
        { value: 'other',                 icon: '📦', label: 'Other',                    hint: '' },
      ]},
    ],
    units: ['kg', 'tonnes', 'litres', 'metres', 'm³', 'pcs', 'bags', 'drums', 'sets', 'rolls'],
    suggestions: ['Diesel Fuel', 'Bitumen', 'Crushed Stone (Aggregate)', 'Sand', 'Gravel', 'Murram', 'Bitumen Emulsion', 'Cement', 'Steel Bars (TMT)', 'Culvert Pipes', 'Timber', 'Engine Oil', 'Hydraulic Oil', 'Grease', 'Safety Helmet', 'Safety Boots', 'Reflective Vest', 'Work Gloves', 'Safety Goggles', 'Grader Blade', 'Engine Filter', 'Hydraulic Filter', 'V-Belt', 'Battery', 'Marking Paint', 'Road Signs'],
  },
}

const DEFAULT_STORE_CONFIG = {
  headerBg: '#1a2332',
  badgeBg: 'bg-gray-100',
  badgeText: 'text-gray-600',
  cardSelected: 'border-brand-red bg-red-50 ring-1 ring-brand-red',
  categoryGroups: [
    { label: 'All Categories', items: [
      { value: 'office_consumables',    icon: '📎', label: 'Office Consumables',    hint: '' },
      { value: 'stationery',            icon: '✏️', label: 'Stationery',            hint: '' },
      { value: 'furniture',             icon: '🪑', label: 'Furniture & Fittings',  hint: '' },
      { value: 'construction_materials',icon: '🧱', label: 'Construction Materials',hint: '' },
      { value: 'road_materials',        icon: '🛣️', label: 'Road Materials',        hint: '' },
      { value: 'vehicle_parts',         icon: '🚗', label: 'Vehicle Spare Parts',   hint: '' },
      { value: 'spare_parts',           icon: '⚙️', label: 'Spare Parts',           hint: '' },
      { value: 'fuel',                  icon: '⛽', label: 'Fuel & Lubricants',     hint: '' },
      { value: 'ppe_safety',            icon: '🦺', label: 'PPE & Safety',          hint: '' },
      { value: 'tools',                 icon: '🔧', label: 'Tools & Equipment',     hint: '' },
      { value: 'electronics',           icon: '💻', label: 'Electronics',           hint: '' },
      { value: 'networking',            icon: '🌐', label: 'Networking Equipment',  hint: '' },
      { value: 'software_license',      icon: '📋', label: 'Software & Licenses',   hint: '' },
      { value: 'food_ingredients',      icon: '🌾', label: 'Food & Ingredients',    hint: '' },
      { value: 'kitchen',               icon: '☕', label: 'Kitchen / Canteen',     hint: '' },
      { value: 'cleaning',              icon: '🧹', label: 'Cleaning Supplies',     hint: '' },
      { value: 'uniforms',              icon: '👔', label: 'Uniforms & Clothing',   hint: '' },
      { value: 'other',                 icon: '📦', label: 'Other',                 hint: '' },
    ]},
  ],
  units: ['pcs', 'reams', 'boxes', 'kg', 'litres', 'metres', 'pairs', 'sets', 'rolls', 'bags', 'tubes', 'packets', 'drums', 'bales', 'tonnes'],
  suggestions: [],
}

function getStoreConfig(storeName) {
  return STORE_ITEM_CONFIGS[storeName] || DEFAULT_STORE_CONFIG
}

// ── Add Item Modal ─────────────────────────────────────────────────────────────

function AddItemModal({ onClose, editItem, activeStoreId, storeName, departments }) {
  const cfg = getStoreConfig(storeName)
  const defaultCategory = cfg.categoryGroups[0]?.items[0]?.value || 'other'

  const qc = useQueryClient()
  const [form, setForm] = useState(editItem ? {
    name:             editItem.name              || '',
    category:         editItem.category          || defaultCategory,
    unit:             editItem.unit              || '',
    reorder_level:    editItem.reorder_level != null ? String(parseFloat(editItem.reorder_level)) : '',
    description:      editItem.description       || '',
    valuation_method: editItem.valuation_method  || 'wac',
    department:       editItem.department         || '',
    is_active:        editItem.is_active != null ? editItem.is_active : true,
  } : {
    name: '', category: defaultCategory, unit: '', reorder_level: '',
    description: '', valuation_method: 'wac', department: '', is_active: true,
  })

  // track selected card label separately since multiple cards can share a value
  const firstCard = cfg.categoryGroups[0]?.items[0]
  const [selectedCardLabel, setSelectedCardLabel] = useState(() => {
    if (editItem) {
      for (const g of cfg.categoryGroups) {
        const found = g.items.find(i => i.value === editItem.category)
        if (found) return found.label
      }
    }
    return firstCard?.label || ''
  })

  const [openingQty,  setOpeningQty]  = useState('')
  const [openingCost, setOpeningCost] = useState('')
  const hasOpening = !editItem && Number(openingQty) > 0

  const datalistId = 'item-name-suggestions'

  const itemMut = useMutation({
    mutationFn: async (data) => {
      const itemRes = editItem
        ? await updateStockItem(editItem.id, data)
        : await createStockItem(data)
      const newItem = itemRes.data
      if (hasOpening) {
        if (!activeStoreId) throw new Error('No active store selected.')
        await createTransaction({
          transaction_type: 'grn',
          item: newItem.id,
          store: activeStoreId,
          quantity: Number(openingQty),
          unit_cost: Number(openingCost || 0),
          transaction_date: new Date().toISOString().slice(0, 10),
          notes: 'Opening stock entry',
        })
      }
      return newItem
    },
    onSuccess: () => {
      toast.success(editItem ? 'Item updated' : `Item added${hasOpening ? ' with opening stock' : ''}`)
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      const msg = e.message || d?.store?.[0] || d?.name?.[0] || d?.detail || JSON.stringify(d) || 'Failed to save item'
      toast.error(msg)
    },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const canSubmit = form.name.trim() && form.unit.trim() && form.category

  const selectCategory = (item) => {
    set('category', item.value)
    setSelectedCardLabel(item.label)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0"
          style={{ backgroundColor: cfg.headerBg }}>
          <div>
            <h2 className="text-white font-bold text-base">
              {editItem ? 'Edit Stock Item' : 'New Stock Item'}
            </h2>
            <p className="text-white/60 text-xs mt-0.5">
              {storeName || 'Inventory'} · fill in the details below
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Item Name with autocomplete ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Item Name <span className="text-brand-red">*</span>
            </label>
            <input
              autoFocus
              list={datalistId}
              className={inp}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={cfg.suggestions.length ? `e.g. ${cfg.suggestions[0]}, ${cfg.suggestions[1]}…` : 'Enter item name…'}
            />
            {cfg.suggestions.length > 0 && (
              <datalist id={datalistId}>
                {cfg.suggestions.map(s => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>

          {/* ── Category card picker ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-3">
              Category <span className="text-brand-red">*</span>
            </label>
            <div className="space-y-3">
              {cfg.categoryGroups.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.items.map(item => {
                      const isSelected = selectedCardLabel === item.label && form.category === item.value
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => selectCategory(item)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? cfg.cardSelected
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-xl leading-none shrink-0 mt-0.5">{item.icon}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold leading-tight ${isSelected ? 'text-gray-800' : 'text-gray-700'}`}>
                              {item.label}
                            </p>
                            {item.hint && (
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight truncate">{item.hint}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* Show selected badge */}
            {form.category && (
              <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}>
                <span>Selected:</span>
                <span>{CATEGORY_LABELS[form.category] || form.category}</span>
              </div>
            )}
          </div>

          {/* ── Unit of Measure ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Unit of Measure <span className="text-brand-red">*</span>
            </label>
            <input
              className={inp}
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              placeholder="Type or pick below…"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cfg.units.map(u => (
                <button key={u} type="button" onClick={() => set('unit', u)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors
                    ${form.unit === u
                      ? 'bg-brand-red text-white border-brand-red'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* ── Item code (edit only) ── */}
          {editItem && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Item Code</span>
              <span className="font-mono text-sm font-bold text-brand-slate ml-1">{editItem.item_code}</span>
            </div>
          )}

          {/* ── Reorder + Description ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reorder Alert Level</label>
              <input type="number" min="0" className={inp} value={form.reorder_level}
                onChange={e => set('reorder_level', e.target.value)} placeholder="e.g. 5" />
              <p className="text-[10px] text-gray-400 mt-1">Alert when stock falls below this</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className={inp} value={form.description}
                onChange={e => set('description', e.target.value)} placeholder="Brief notes, spec, brand…" />
            </div>
          </div>

          {/* ── Valuation + Department ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Valuation Method</label>
              <select className={inp} value={form.valuation_method} onChange={e => set('valuation_method', e.target.value)}>
                <option value="wac">Weighted Average Cost</option>
                <option value="fifo">FIFO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Department <span className="text-gray-400 font-normal">(optional)</span></label>
              <select className={inp} value={form.department || ''} onChange={e => set('department', e.target.value || null)}>
                <option value="">— All departments —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* ── Active toggle (edit only) ── */}
          {editItem && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="is_active_chk" checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red" />
              <label htmlFor="is_active_chk" className="text-xs font-semibold text-gray-600">Item is Active</label>
              {!form.is_active && <span className="text-[11px] text-red-500 ml-1">Hidden from issue / receive</span>}
            </div>
          )}

          {/* ── Opening stock (new only) ── */}
          {!editItem && (
            <div className="border border-dashed border-indigo-200 rounded-xl p-4 bg-indigo-50/40 space-y-3">
              <p className="text-xs font-bold text-indigo-700">
                Opening Stock
                <span className="font-normal text-indigo-500 ml-1">(optional — skip if stock is 0)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                  <input type="number" min="0" step="any" className={inp} value={openingQty}
                    onChange={e => setOpeningQty(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit Cost (KES)</label>
                  <input type="number" min="0" step="any" className={inp} value={openingCost}
                    onChange={e => setOpeningCost(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              {hasOpening && (
                <p className="text-[11px] text-indigo-600">
                  Will record a GRN of <strong>{openingQty}</strong> {form.unit || 'units'}
                  {openingCost ? ` @ KES ${Number(openingCost).toLocaleString()} each` : ''}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => {
              const payload = {
                ...form,
                reorder_level: form.reorder_level === '' ? 0 : Number(form.reorder_level),
                department: form.department || null,
              }
              itemMut.mutate(payload)
            }}
            disabled={itemMut.isPending || !canSubmit}
            className="flex-1 text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: cfg.headerBg }}>
            {itemMut.isPending ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Adjust Stock Modal ────────────────────────────────────────────────────────

function AdjustStockModal({ item, activeStoreId, onClose }) {
  const qc = useQueryClient()
  const currentStock = Number(item.current_stock ?? 0)
  const currentCost  = Number(item.weighted_avg_cost ?? 0)
  const [newQty, setNewQty]     = useState(String(currentStock))
  const [unitCost, setUnitCost] = useState(currentCost > 0 ? String(currentCost) : '')
  const [notes, setNotes]       = useState('')

  const costChanged = unitCost !== '' && Number(unitCost) !== currentCost
  const diff = Number(newQty) - currentStock
  const diffLabel = diff === 0
    ? (costChanged ? 'Qty unchanged — cost update only' : 'No change')
    : diff > 0 ? `+${diff} (stock will increase)`
    : `${diff} (stock will decrease)`
  const diffColor = diff === 0
    ? (costChanged ? 'text-indigo-500' : 'text-gray-400')
    : diff > 0 ? 'text-green-600' : 'text-red-600'

  const adjMut = useMutation({
    mutationFn: () => createTransaction({
      transaction_type: 'adjustment',
      item: item.id,
      store: activeStoreId,
      quantity: Number(newQty),
      unit_cost: unitCost !== '' ? Number(unitCost) : Number(item.weighted_avg_cost || 0),
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: notes || (diff === 0
        ? `Unit cost updated to KES ${unitCost}`
        : `Stock adjusted from ${currentStock} to ${newQty} ${item.unit}`),
    }),
    onSuccess: () => {
      toast.success('Stock adjusted successfully')
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.detail || d?.quantity?.[0] || JSON.stringify(d) || 'Adjustment failed')
    },
  })

  const canSave = newQty !== '' && !isNaN(Number(newQty)) && Number(newQty) >= 0 && (diff !== 0 || costChanged)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">

        {/* Header */}
        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Adjust Stock</h2>
            <p className="text-white/50 text-xs mt-0.5 font-mono">{item.item_code} — {item.name}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Current stock display */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-xs text-gray-500 font-semibold">Current Stock</span>
            <span className="text-lg font-extrabold text-brand-slate">{currentStock.toLocaleString()} <span className="text-xs font-normal text-gray-400">{item.unit}</span></span>
          </div>

          {/* New quantity + Unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">New Quantity <span className="text-brand-red">*</span></label>
              <input
                type="number" min="0" step="any"
                className={inp}
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                autoFocus
              />
              <p className={`text-[11px] mt-1.5 font-semibold ${diffColor}`}>{diffLabel}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Cost (KES)</label>
              <input
                type="number" min="0" step="any"
                className={inp}
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                placeholder={currentCost > 0 ? `Current: ${currentCost.toLocaleString()}` : '0.00'}
              />
              <p className="text-[10px] text-gray-400 mt-1">Updates weighted avg cost</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason / Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Physical count correction, damaged goods…" />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => adjMut.mutate()}
            disabled={adjMut.isPending || !canSave}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
            {adjMut.isPending ? 'Saving…' : 'Save Adjustment'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Request Items Modal (any employee) ───────────────────────────────────────

function RequestItemsModal({ onClose, stores }) {
  const qc = useQueryClient()
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [form, setForm] = useState({ item: '', quantity: '', justification: '' })

  const { data: storeItems = [], isFetching: fetchingItems } = useQuery({
    queryKey: ['store-browse-items', selectedStoreId],
    queryFn: () => getStoreItems(selectedStoreId),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!selectedStoreId,
  })

  const createMut = useMutation({
    mutationFn: (d) => createStoreRequest(d),
    onSuccess: () => {
      toast.success('Store request submitted')
      qc.invalidateQueries({ queryKey: ['store-requests-outgoing'] })
      onClose()
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.detail || d?.item?.[0] || d?.quantity_requested?.[0] || 'Failed to submit request')
    },
  })

  const canSubmit = selectedStoreId && form.item && form.quantity && form.justification.trim()
  const selectedItem = storeItems.find(i => String(i.id) === String(form.item))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        <div className="bg-brand-slate rounded-t-2xl px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-base">Request Items from Store</h2>
            <p className="text-white/50 text-xs mt-0.5">Select a store and the item you need</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl font-bold leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Store picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Store <span className="text-brand-red">*</span></label>
            <select className={inp} value={selectedStoreId}
              onChange={e => { setSelectedStoreId(e.target.value); setForm(f => ({ ...f, item: '' })) }}>
              <option value="">— Select a store —</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Item picker */}
          {selectedStoreId && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Item <span className="text-brand-red">*</span></label>
              {fetchingItems ? (
                <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : storeItems.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No items found in this store.</p>
              ) : (
                <>
                  <select className={inp} value={form.item}
                    onChange={e => setForm(f => ({ ...f, item: e.target.value }))}>
                    <option value="">— Select an item —</option>
                    {storeItems.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.item_code}) — {Number(i.stock_in_store).toLocaleString()} {i.unit} in stock
                      </option>
                    ))}
                  </select>
                  {selectedItem && (
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      <span className="text-gray-500">In stock:</span>
                      <span className={`font-semibold ${Number(selectedItem.stock_in_store) === 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {Number(selectedItem.stock_in_store).toLocaleString()} {selectedItem.unit}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Requested <span className="text-brand-red">*</span></label>
            <input type="number" min="0.01" step="any" className={inp}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="0" />
            {selectedItem && form.quantity && Number(form.quantity) > Number(selectedItem.stock_in_store) && (
              <p className="text-[11px] text-amber-600 mt-1">⚠ Requested qty exceeds current stock — storekeeper may approve a partial quantity.</p>
            )}
          </div>

          {/* Justification */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Justification <span className="text-brand-red">*</span></label>
            <textarea rows={3} className={`${inp} resize-none`}
              value={form.justification}
              onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
              placeholder="Explain why you need this item (e.g. Site works — Thika Road, replacing damaged equipment…)" />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => createMut.mutate({ item: form.item, quantity_requested: Number(form.quantity), source_store: selectedStoreId, justification: form.justification })}
            disabled={createMut.isPending || !canSubmit}
            className="flex-1 bg-brand-red text-white text-sm font-bold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90">
            {createMut.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.role || ''

  // MD is read-only across all stores; everyone else has write access to their store
  const isReadOnly  = role === 'managing_director'
  // MD and system_admin see all stores (tab bar); others see only their own store
  const showAllStores = role === 'managing_director' || role === 'system_admin'

  const [tab, setTab]             = useState('items')
  const [activeStore, setActiveStore] = useState(null)
  const [search, setSearch]         = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterCat, setFilterCat]   = useState('')
  const [itemPage, setItemPage]     = useState(1)
  const resetItemPage = () => setItemPage(1)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [adjustItem, setAdjustItem] = useState(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [srAction, setSrAction] = useState(null) // { type, req } for inline action modals

  // Issue form
  const [issueForm, setIssueForm] = useState({
    item: '', quantity: '', issued_to: '', issued_to_name: '', notes: '', date: today,
  })

  // Receive form
  const [receiveForm, setReceiveForm] = useState({
    item: '', quantity: '', unit_cost: '', notes: '', date: today, supplier: '',
  })

  // History filters
  const [hDateFrom, setHDateFrom] = useState('')
  const [hDateTo, setHDateTo]     = useState('')
  const [hType, setHType]         = useState('')
  const [hItem, setHItem]         = useState('')
  const [hSearch, setHSearch]     = useState('')

  const qc = useQueryClient()

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: stores = [], isLoading: loadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: getStores,
    select: r => r.data?.results ?? r.data ?? [],
  })

  // Initialise activeStore once stores are loaded
  useEffect(() => {
    if (!stores.length) return
    if (activeStore) return // already set
    if (showAllStores) {
      setActiveStore(stores[0])
    } else {
      const storeName = ROLE_STORE_MAP[role]
      const match = stores.find(s => s.name === storeName)
      setActiveStore(match || stores[0])
    }
  }, [stores]) // eslint-disable-line react-hooks/exhaustive-deps

  const storeParam = activeStore ? { store: activeStore.id } : {}

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items', activeStore?.id],
    queryFn: () => getStockItems({ page_size: 500, ...storeParam }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!activeStore,
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['stock-transactions', activeStore?.id],
    queryFn: () => getTransactions({ page_size: 500, ...storeParam }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!activeStore,
  })

  const { data: lowStock = [] } = useQuery({
    queryKey: ['low-stock', activeStore?.id],
    queryFn: () => getLowStockItems(storeParam),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: !!activeStore,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      let results = [], page = 1, hasMore = true
      while (hasMore) {
        const r = await getEmployees({ is_active: true, page_size: 200, page })
        const data = r.data?.results ?? r.data ?? []
        results = results.concat(data)
        hasMore = !!r.data?.next
        page++
      }
      return results
    },
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/auth/departments/'),
    select: r => r.data?.results ?? r.data ?? [],
  })

  // Determine if the current user is a storekeeper (has write access to some store)
  const isStorekeeper = !isReadOnly && !!ROLE_STORE_MAP[role]

  // Incoming requests to my store (storekeeper view)
  const { data: incomingRequests = [], refetch: refetchIncoming } = useQuery({
    queryKey: ['store-requests-incoming'],
    queryFn: () => getStoreRequests({ view: 'incoming', page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
    enabled: isStorekeeper,
  })

  // My own submitted requests
  const { data: myRequests = [], refetch: refetchMine } = useQuery({
    queryKey: ['store-requests-outgoing'],
    queryFn: () => getStoreRequests({ view: 'outgoing', page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  // Items dispatched to me, pending receipt confirmation
  const { data: pendingReceipts = [], refetch: refetchReceipts } = useQuery({
    queryKey: ['store-requests-receipts'],
    queryFn: () => getStoreRequests({ view: 'receipts', page_size: 200 }),
    select: r => r.data?.results ?? r.data ?? [],
  })

  // ── Mutations ────────────────────────────────────────────────────────────────

  const issueMut = useMutation({
    mutationFn: createTransaction,
    onSuccess: (_, vars) => {
      const item = items.find(i => String(i.id) === String(vars.item))
      const recipient = vars.issued_to_name ||
        employees.find(e => String(e.user) === String(vars.issued_to))?.full_name ||
        'recipient'
      toast.success(`Issued ${vars.quantity} units of ${item?.name ?? 'item'} to ${recipient}`)
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      setIssueForm({ item: '', quantity: '', issued_to: '', issued_to_name: '', notes: '', date: today })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.non_field_errors?.[0] || d?.detail || JSON.stringify(d) || 'Issue failed')
    },
  })

  const receiveMut = useMutation({
    mutationFn: createTransaction,
    onSuccess: (_, vars) => {
      const item = items.find(i => String(i.id) === String(vars.item))
      toast.success(`Received ${vars.quantity} units of ${item?.name ?? 'item'}`)
      qc.invalidateQueries({ queryKey: ['stock-items'] })
      qc.invalidateQueries({ queryKey: ['stock-transactions'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      setReceiveForm({ item: '', quantity: '', unit_cost: '', notes: '', date: today, supplier: '' })
    },
    onError: e => {
      const d = e.response?.data
      toast.error(d?.non_field_errors?.[0] || d?.detail || JSON.stringify(d) || 'Receive failed')
    },
  })

  // ── Derived data ─────────────────────────────────────────────────────────────

  const visibleStores = useMemo(() => {
    if (showAllStores) return stores
    const storeName = ROLE_STORE_MAP[role]
    return stores.filter(s => s.name === storeName)
  }, [stores, role, showAllStores])

  const totalValue = useMemo(() =>
    items.reduce((s, i) => s + Number(i.current_stock) * Number(i.weighted_avg_cost || 0), 0),
  [items])

  const issuesThisMonth = useMemo(() => {
    const now = new Date()
    return transactions.filter(tx => {
      if (tx.transaction_type !== 'issue') return false
      const d = new Date(tx.transaction_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [transactions])

  const filteredItems = useMemo(() =>
    items.filter(i => {
      const matchSearch = !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.item_code || '').toLowerCase().includes(search.toLowerCase())
      const matchStore = !filterStore ||
        (i.stock_levels || []).some(sl => String(sl.store) === String(filterStore) || String(sl.store_name) === filterStore)
      const matchCat = !filterCat || i.category === filterCat
      return matchSearch && matchStore && matchCat
    }),
  [items, search, filterStore, filterCat])

  const pendingIncomingCount = incomingRequests.filter(r => ['submitted', 'approved'].includes(r.status)).length
  const pendingReceiptsCount = pendingReceipts.length

  const safeItemPage = Math.min(itemPage, Math.max(1, Math.ceil(filteredItems.length / INV_PAGE_SIZE)))
  const pagedItems   = filteredItems.slice((safeItemPage - 1) * INV_PAGE_SIZE, safeItemPage * INV_PAGE_SIZE)

  const filteredHistory = useMemo(() =>
    transactions.filter(tx => {
      if (hType && tx.transaction_type !== hType) return false
      if (hItem && String(tx.item) !== String(hItem)) return false
      if (hDateFrom && tx.transaction_date < hDateFrom) return false
      if (hDateTo && tx.transaction_date > hDateTo + 'T23:59:59') return false
      if (hSearch) {
        const q = hSearch.toLowerCase()
        const match =
          (tx.item_name || '').toLowerCase().includes(q) ||
          (tx.reference_number || '').toLowerCase().includes(q) ||
          (tx.issued_to_display || tx.issued_to_name || '').toLowerCase().includes(q) ||
          (tx.processed_by_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    }),
  [transactions, hType, hItem, hDateFrom, hDateTo, hSearch])

  // ── Issue submit ─────────────────────────────────────────────────────────────

  const handleIssue = () => {
    if (!issueForm.item || !issueForm.quantity) {
      toast.error('Item and quantity are required')
      return
    }
    if (!issueForm.issued_to && !issueForm.issued_to_name.trim()) {
      toast.error('Please select a system user or enter a recipient name')
      return
    }
    const selectedItem = items.find(i => String(i.id) === String(issueForm.item))
    const payload = {
      transaction_type: 'issue',
      item: issueForm.item,
      store: activeStore?.id,
      quantity: Number(issueForm.quantity),
      unit_cost: Number(selectedItem?.weighted_avg_cost || 0),
      issued_to: issueForm.issued_to || undefined,
      issued_to_name: issueForm.issued_to_name.trim() || undefined,
      transaction_date: issueForm.date,
      notes: issueForm.notes,
      reference_number: '',
    }
    issueMut.mutate(payload)
  }

  // ── Receive submit ────────────────────────────────────────────────────────────

  const handleReceive = () => {
    if (!receiveForm.item || !receiveForm.quantity || !receiveForm.unit_cost) {
      toast.error('Item, quantity and unit cost are required')
      return
    }
    const payload = {
      transaction_type: 'grn',
      item: receiveForm.item,
      store: activeStore?.id,
      quantity: Number(receiveForm.quantity),
      unit_cost: Number(receiveForm.unit_cost),
      transaction_date: receiveForm.date,
      notes: receiveForm.notes
        ? `${receiveForm.supplier ? 'Supplier: ' + receiveForm.supplier + '. ' : ''}${receiveForm.notes}`
        : receiveForm.supplier ? 'Supplier: ' + receiveForm.supplier : '',
      reference_number: '',
    }
    receiveMut.mutate(payload)
  }

  // ── Loading state while stores haven't loaded yet ─────────────────────────────

  if (loadingStores || (stores.length > 0 && !activeStore)) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-brand-slate">Inventory</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            {activeStore ? `${activeStore.name} · Stock management` : 'Stock management'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-brand-red text-brand-red text-xs font-semibold rounded-xl hover:bg-red-50 relative">
            <ArrowUpTrayIcon className="h-4 w-4" /> Request Items
            {pendingReceiptsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingReceiptsCount}
              </span>
            )}
          </button>
          {!isReadOnly && (
            <button
              onClick={() => setShowAddItem(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white text-xs font-semibold rounded-xl hover:opacity-90">
              <PlusIcon className="h-4 w-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Store tab bar — shown for MD and system_admin only */}
      {showAllStores && visibleStores.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {visibleStores.map(s => (
            <button key={s.id}
              onClick={() => { setActiveStore(s); setFilterStore('') }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors
                ${activeStore?.id === s.id
                  ? 'bg-brand-slate text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <DocumentTextIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Items</p>
            <p className="text-lg font-bold text-brand-slate">{items.length}</p>
            <p className="text-xs text-gray-600">in catalog</p>
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
            <ArrowsRightLeftIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Stock Value</p>
            <p className="text-lg font-bold text-brand-slate">
              KES {totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-600">estimated value</p>
          </div>
        </div>

        {/* Issues This Month */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <ArrowUpTrayIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Issues This Month</p>
            <p className="text-lg font-bold text-brand-slate">{issuesThisMonth}</p>
            <p className="text-xs text-gray-600">transactions</p>
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${lowStock.length > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
            <ExclamationTriangleIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-gray-600">Low Stock</p>
            <p className={`text-lg font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-brand-slate'}`}>{lowStock.length}</p>
            <p className="text-xs text-gray-600">items at/below reorder</p>
          </div>
        </div>
      </div>

      {/* Tab panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-100 px-5 pt-4 gap-5 overflow-x-auto">
          {TABS.filter(t => isReadOnly ? !['issue', 'receive'].includes(t.key) : true).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`pb-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-brand-red text-brand-red'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
              {t.key === 'lowstock' && lowStock.length > 0 && (
                <span className="ml-1.5 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{lowStock.length}</span>
              )}
              {t.key === 'requests' && pendingIncomingCount > 0 && (
                <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{pendingIncomingCount}</span>
              )}
              {t.key === 'receipts' && pendingReceiptsCount > 0 && (
                <span className="ml-1.5 bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{pendingReceiptsCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── TAB: Items ───────────────────────────────────────────────────── */}
          {tab === 'items' && (
            <div className="space-y-4">
              {/* Filters row */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => { setSearch(e.target.value); resetItemPage() }}
                    placeholder="Search name or code…"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red" />
                </div>
                {showAllStores && (
                  <select
                    value={filterStore}
                    onChange={e => { setFilterStore(e.target.value); resetItemPage() }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
                    <option value="">All Stores</option>
                    {visibleStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <select
                  value={filterCat}
                  onChange={e => { setFilterCat(e.target.value); resetItemPage() }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white">
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {!isReadOnly && (
                  <button
                    onClick={() => setTab('issue')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 text-gray-600 ml-auto">
                    <ArrowUpTrayIcon className="h-3.5 w-3.5" /> Issue Stock
                  </button>
                )}
              </div>

              {/* Table */}
              {loadingItems ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <DocumentTextIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No items found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <InvPageNav page={safeItemPage} total={filteredItems.length} onChange={setItemPage} />
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Code', 'Name', 'Category', 'Unit', 'In Stock', 'Reorder', 'Unit Cost', 'Value', 'Status', ''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pagedItems.map(item => {
                        const stock = Number(item.current_stock)
                        const reorder = Number(item.reorder_level ?? 0)
                        const wac = Number(item.weighted_avg_cost || 0)
                        const isOut = stock === 0
                        const isLow = stock > 0 && stock <= reorder
                        const canAct = !isReadOnly
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <Link to={`/inventory/${item.id}`} className="font-mono text-brand-red hover:underline text-xs">
                                {item.item_code}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-800">{item.name}</td>
                            <td className="px-3 py-2.5 text-gray-600">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                            <td className="px-3 py-2.5 text-gray-600">{item.unit}</td>
                            <td className={`px-3 py-2.5 font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-700'}`}>
                              {stock.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{reorder.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-gray-600">
                              {wac > 0 ? `KES ${wac.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {wac > 0
                                ? `KES ${(stock * wac).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                isOut ? 'bg-red-100 text-red-700' :
                                isLow ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {isOut ? 'Out of Stock' : isLow ? 'Low' : 'OK'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {canAct && (
                                  <button
                                    onClick={() => {
                                      setIssueForm(f => ({ ...f, item: String(item.id) }))
                                      setTab('issue')
                                    }}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                                    Issue
                                  </button>
                                )}
                                {canAct && (
                                  <button
                                    onClick={() => setAdjustItem(item)}
                                    className="px-2 py-1 text-xs border border-amber-200 rounded hover:bg-amber-50 text-amber-700 font-medium">
                                    Adjust
                                  </button>
                                )}
                                {canAct && (
                                  <button
                                    onClick={() => setEditItem(item)}
                                    className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                                    Edit
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                  <InvPageNav page={safeItemPage} total={filteredItems.length} onChange={setItemPage} />
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Requests ────────────────────────────────────────────────── */}
          {tab === 'requests' && (
            <StoreRequestsTab
              isStorekeeper={isStorekeeper}
              incomingRequests={incomingRequests}
              myRequests={myRequests}
              refetchIncoming={refetchIncoming}
              refetchMine={refetchMine}
              onNewRequest={() => setShowRequestModal(true)}
              qc={qc}
            />
          )}

          {/* ── TAB: Receipts ─────────────────────────────────────────────────── */}
          {tab === 'receipts' && (
            <StoreReceiptsTab
              receipts={pendingReceipts}
              refetch={refetchReceipts}
              qc={qc}
            />
          )}

          {/* ── TAB: Issue ───────────────────────────────────────────────────── */}
          {tab === 'issue' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-brand-slate uppercase tracking-wide">Issue Stock to Person</h2>
                  <div className="mt-2 border-b border-gray-100" />
                </div>

                {/* Item */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item *</label>
                  <select
                    className={inp}
                    value={issueForm.item}
                    onChange={e => setIssueForm(f => ({ ...f, item: e.target.value }))}>
                    <option value="">— Select item —</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.item_code}) — {Number(i.current_stock).toLocaleString()} {i.unit} in stock
                      </option>
                    ))}
                  </select>
                  {issueForm.item && (() => {
                    const sel = items.find(i => String(i.id) === String(issueForm.item))
                    return sel ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Current stock: <span className="font-semibold text-gray-700">{Number(sel.current_stock).toLocaleString()} {sel.unit}</span>
                      </p>
                    ) : null
                  })()}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={inp}
                    value={issueForm.quantity}
                    onChange={e => setIssueForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0" />
                </div>

                {/* Employee */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> Issued To (Employee)</span>
                  </label>
                  <select
                    className={inp}
                    value={issueForm.issued_to || issueForm.issued_to_name}
                    onChange={e => {
                      const val = e.target.value
                      const emp = employees.find(em => String(em.id) === val)
                      if (emp) {
                        setIssueForm(f => ({
                          ...f,
                          issued_to: emp.user ? String(emp.user) : '',
                          issued_to_name: emp.user ? '' : emp.full_name,
                        }))
                      } else {
                        setIssueForm(f => ({ ...f, issued_to: '', issued_to_name: '' }))
                      }
                    }}>
                    <option value="">— Select employee —</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name}{emp.employee_number ? ` (${emp.employee_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-b border-gray-100" />
                  <span className="text-xs text-gray-600 font-medium">— OR —</span>
                  <div className="flex-1 border-b border-gray-100" />
                </div>

                {/* External recipient */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Name (External)</label>
                  <input
                    className={inp}
                    value={issueForm.issued_to_name}
                    onChange={e => setIssueForm(f => ({ ...f, issued_to_name: e.target.value, issued_to: '' }))}
                    placeholder="Enter name if not in system" />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    className={inp}
                    value={issueForm.date}
                    onChange={e => setIssueForm(f => ({ ...f, date: e.target.value }))} />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    className={`${inp} resize-none`}
                    value={issueForm.notes}
                    onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes or purpose" />
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    onClick={handleIssue}
                    disabled={issueMut.isPending || !issueForm.item || !issueForm.quantity}
                    className="w-full flex items-center justify-center gap-2 bg-brand-red text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 hover:opacity-90">
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    {issueMut.isPending ? 'Processing…' : 'Issue Stock →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Receive ─────────────────────────────────────────────────── */}
          {tab === 'receive' && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-brand-slate uppercase tracking-wide">Receive Stock (Goods Received)</h2>
                  <div className="mt-2 border-b border-gray-100" />
                </div>

                {/* Item */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item *</label>
                  <select
                    className={inp}
                    value={receiveForm.item}
                    onChange={e => setReceiveForm(f => ({ ...f, item: e.target.value }))}>
                    <option value="">— Select item —</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.item_code})</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className={inp}
                    value={receiveForm.quantity}
                    onChange={e => setReceiveForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0" />
                </div>

                {/* Unit Cost */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit Cost (KES) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inp}
                    value={receiveForm.unit_cost}
                    onChange={e => setReceiveForm(f => ({ ...f, unit_cost: e.target.value }))}
                    placeholder="0.00" />
                </div>

                {/* Supplier */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supplier / Source</label>
                  <input
                    className={inp}
                    value={receiveForm.supplier}
                    onChange={e => setReceiveForm(f => ({ ...f, supplier: e.target.value }))}
                    placeholder="Supplier name or source" />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                  <input
                    type="date"
                    className={inp}
                    value={receiveForm.date}
                    onChange={e => setReceiveForm(f => ({ ...f, date: e.target.value }))} />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    className={`${inp} resize-none`}
                    value={receiveForm.notes}
                    onChange={e => setReceiveForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes" />
                </div>

                {/* Submit */}
                <div className="pt-1">
                  <button
                    onClick={handleReceive}
                    disabled={receiveMut.isPending || !receiveForm.item || !receiveForm.quantity || !receiveForm.unit_cost}
                    className="w-full flex items-center justify-center gap-2 bg-brand-red text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 hover:opacity-90">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {receiveMut.isPending ? 'Processing…' : 'Record Receipt →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: History ─────────────────────────────────────────────────── */}
          {tab === 'history' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hDateFrom}
                  onChange={e => setHDateFrom(e.target.value)}
                  placeholder="Date from" />
                <input
                  type="date"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hDateTo}
                  onChange={e => setHDateTo(e.target.value)}
                  placeholder="Date to" />
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hType}
                  onChange={e => setHType(e.target.value)}>
                  <option value="">All Types</option>
                  {Object.entries(TX_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red bg-white"
                  value={hItem}
                  onChange={e => setHItem(e.target.value)}>
                  <option value="">All Items</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-red"
                    placeholder="Search…"
                    value={hSearch}
                    onChange={e => setHSearch(e.target.value)} />
                </div>
              </div>

              {/* Table */}
              {filteredHistory.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <DocumentTextIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Date', 'Type', 'Item', 'Qty', 'Issued To / Source', 'Recorded By', 'Notes', 'Ref'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredHistory.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                            {new Date(tx.transaction_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_COLORS[tx.transaction_type] ?? 'bg-gray-100 text-gray-600'}`}>
                              {TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{tx.item_name}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-700">{Number(tx.quantity).toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-gray-600">{tx.issued_to_display || tx.issued_to_name || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{tx.processed_by_name || '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate" title={tx.notes}>{tx.notes || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{tx.reference_number || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-gray-600">{filteredHistory.length} transaction{filteredHistory.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Low Stock ───────────────────────────────────────────────── */}
          {tab === 'lowstock' && (
            <div>
              {lowStock.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <ExclamationTriangleIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">All stock levels are healthy.</p>
                  <p className="text-xs mt-1">No items are at or below their reorder level.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-4">{lowStock.length} item{lowStock.length !== 1 ? 's' : ''} require restocking</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lowStock.map(item => {
                      const stock = Number(item.current_stock)
                      const reorder = Number(item.reorder_level ?? 0)
                      const pct = reorder > 0 ? Math.min((stock / reorder) * 100, 100) : 0
                      const isOut = stock === 0
                      return (
                        <div key={item.id}
                          className={`rounded-xl border p-4 ${isOut ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div>
                              <p className="font-semibold text-sm text-gray-800 leading-tight">{item.name}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{item.item_code} · {item.unit}</p>
                            </div>
                            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isOut ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs mb-2">
                            <span className="text-gray-600">Stock: <strong className={isOut ? 'text-red-600' : 'text-amber-600'}>{stock.toLocaleString()}</strong></span>
                            <span className="text-gray-600">/ reorder: {reorder.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-white rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isOut ? 'bg-red-400' : 'bg-amber-400'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => {
                                setReceiveForm(f => ({ ...f, item: String(item.id) }))
                                setTab('receive')
                              }}
                              className="mt-3 w-full text-xs font-medium py-1.5 rounded-lg border border-brand-red text-brand-red hover:bg-red-50 transition-colors">
                              + Receive Stock
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {(showAddItem || editItem) && (
        <AddItemModal
          editItem={editItem}
          activeStoreId={activeStore?.id}
          storeName={activeStore?.name}
          departments={departments}
          onClose={() => { setShowAddItem(false); setEditItem(null) }} />
      )}
      {adjustItem && (
        <AdjustStockModal
          item={adjustItem}
          activeStoreId={activeStore?.id}
          onClose={() => setAdjustItem(null)} />
      )}
      {showRequestModal && (
        <RequestItemsModal
          stores={stores}
          onClose={() => setShowRequestModal(false)} />
      )}
    </div>
  )
}

// ── Store Requests Tab ────────────────────────────────────────────────────────

function StoreRequestsTab({ isStorekeeper, incomingRequests, myRequests, refetchIncoming, refetchMine, onNewRequest, qc }) {
  const [view, setView]           = useState(isStorekeeper ? 'incoming' : 'mine')
  const [actionModal, setActionModal] = useState(null) // { type, req }

  const list = view === 'incoming' ? incomingRequests : myRequests

  const mutOpts = (successMsg, refetch) => ({
    onSuccess: () => { toast.success(successMsg); refetch(); setActionModal(null) },
    onError: e => toast.error(e.response?.data?.detail || 'Action failed'),
  })

  const approveMut  = useMutation({ mutationFn: ({ id, d }) => approveStoreRequest(id, d),  ...mutOpts('Request approved', refetchIncoming) })
  const rejectMut   = useMutation({ mutationFn: ({ id, d }) => rejectStoreRequest(id, d),   ...mutOpts('Request rejected', refetchIncoming) })
  const dispatchMut = useMutation({ mutationFn: ({ id, d }) => dispatchStoreRequest(id, d), ...mutOpts('Dispatched', () => { refetchIncoming(); qc.invalidateQueries({ queryKey: ['stock-items'] }) }) })
  const cancelMut   = useMutation({ mutationFn: ({ id }) => cancelStoreRequest(id),         ...mutOpts('Request cancelled', refetchMine) })

  const [approveForm, setApproveForm] = useState({ qty: '', notes: '' })
  const [rejectForm,  setRejectForm]  = useState({ reason: '' })

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {isStorekeeper && (
            <button onClick={() => setView('incoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'incoming' ? 'bg-white shadow text-brand-slate' : 'text-gray-500 hover:text-gray-700'}`}>
              Incoming Requests
            </button>
          )}
          <button onClick={() => setView('mine')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === 'mine' ? 'bg-white shadow text-brand-slate' : 'text-gray-500 hover:text-gray-700'}`}>
            My Requests
          </button>
        </div>
        <button onClick={onNewRequest}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-lg hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> New Request
        </button>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <DocumentTextIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{view === 'incoming' ? 'No requests for your store.' : 'You have no requests yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(req => (
            <div key={req.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-brand-red">{req.reference}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SR_STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-500'}`}>
                      {SR_STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mt-1">{req.item_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {req.quantity_requested} {req.item_unit} requested
                    {req.quantity_approved ? ` · ${req.quantity_approved} approved` : ''}
                    {' · '}{req.source_store_name}
                    {view === 'incoming' && ` · from ${req.requested_by_name}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 italic truncate max-w-xs">{req.justification}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap shrink-0">
                  {/* Storekeeper actions on incoming */}
                  {view === 'incoming' && req.status === 'submitted' && (
                    <>
                      <button onClick={() => { setApproveForm({ qty: String(req.quantity_requested), notes: '' }); setActionModal({ type: 'approve', req }) }}
                        className="px-2.5 py-1 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">Approve</button>
                      <button onClick={() => { setRejectForm({ reason: '' }); setActionModal({ type: 'reject', req }) }}
                        className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700">Reject</button>
                    </>
                  )}
                  {view === 'incoming' && req.status === 'approved' && (
                    <button
                      onClick={() => dispatchMut.mutate({ id: req.id, d: {} })}
                      disabled={dispatchMut.isPending}
                      className="px-2.5 py-1 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50">
                      {dispatchMut.isPending ? '…' : 'Mark Dispatched'}
                    </button>
                  )}
                  {/* Requester actions on own requests */}
                  {view === 'mine' && ['submitted', 'approved'].includes(req.status) && (
                    <button
                      onClick={() => cancelMut.mutate({ id: req.id })}
                      disabled={cancelMut.isPending}
                      className="px-2.5 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              {req.rejection_reason && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">Rejected: {req.rejection_reason}</p>
              )}
              {req.storekeeper_notes && (
                <p className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">Note: {req.storekeeper_notes}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-2">
                {new Date(req.requested_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Approve modal */}
      {actionModal?.type === 'approve' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-brand-slate">Approve Request</h3>
            <p className="text-xs text-gray-500">{actionModal.req.item_name} — {actionModal.req.requested_by_name}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity to Approve</label>
              <input type="number" min="0.01" step="any" className={inp}
                value={approveForm.qty} onChange={e => setApproveForm(f => ({ ...f, qty: e.target.value }))} />
              <p className="text-[10px] text-gray-400 mt-1">Requested: {actionModal.req.quantity_requested} {actionModal.req.item_unit}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notes (optional)</label>
              <input className={inp} value={approveForm.notes} onChange={e => setApproveForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes for the requester…" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approveMut.mutate({ id: actionModal.req.id, d: { quantity_approved: Number(approveForm.qty), storekeeper_notes: approveForm.notes } })}
                disabled={approveMut.isPending || !approveForm.qty}
                className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded-xl disabled:opacity-50">
                {approveMut.isPending ? '…' : 'Approve'}
              </button>
              <button onClick={() => setActionModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {actionModal?.type === 'reject' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-brand-slate">Reject Request</h3>
            <p className="text-xs text-gray-500">{actionModal.req.item_name} — {actionModal.req.requested_by_name}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Rejection <span className="text-brand-red">*</span></label>
              <textarea rows={3} className={`${inp} resize-none`} value={rejectForm.reason}
                onChange={e => setRejectForm({ reason: e.target.value })} placeholder="Explain why this request is being rejected…" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => rejectMut.mutate({ id: actionModal.req.id, d: { rejection_reason: rejectForm.reason } })}
                disabled={rejectMut.isPending || !rejectForm.reason.trim()}
                className="flex-1 bg-red-600 text-white text-sm font-bold py-2 rounded-xl disabled:opacity-50">
                {rejectMut.isPending ? '…' : 'Reject'}
              </button>
              <button onClick={() => setActionModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Store Receipts Tab ────────────────────────────────────────────────────────

function StoreReceiptsTab({ receipts, refetch, qc }) {
  const [receiveModal, setReceiveModal] = useState(null) // req
  const [returnModal,  setReturnModal]  = useState(null) // req
  const [receiveQty,   setReceiveQty]   = useState('')
  const [returnReason, setReturnReason] = useState('')

  const mutOpts = (msg) => ({
    onSuccess: () => { toast.success(msg); refetch(); qc.invalidateQueries({ queryKey: ['stock-items'] }); setReceiveModal(null); setReturnModal(null) },
    onError: e => toast.error(e.response?.data?.detail || 'Action failed'),
  })

  const receiveMut = useMutation({ mutationFn: ({ id, d }) => receiveStoreRequest(id, d), ...mutOpts('Receipt confirmed — stock updated') })
  const returnMut  = useMutation({ mutationFn: ({ id, d }) => returnStoreRequest(id, d),  ...mutOpts('Items returned to store') })

  if (receipts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <ArrowDownTrayIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">No pending receipts.</p>
        <p className="text-xs mt-1 text-gray-400">Items dispatched to you will appear here for confirmation.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{receipts.length} item{receipts.length !== 1 ? 's' : ''} dispatched to you — please confirm receipt.</p>
      {receipts.map(req => (
        <div key={req.id} className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-purple-700">{req.reference}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Awaiting Receipt</span>
              </div>
              <p className="text-sm font-semibold text-gray-800 mt-1">{req.item_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {req.quantity_approved} {req.item_unit} dispatched from {req.source_store_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 italic">{req.justification}</p>
              {req.dispatched_at && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Dispatched: {new Date(req.dispatched_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setReceiveQty(String(req.quantity_approved)); setReceiveModal(req) }}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                Confirm Receipt
              </button>
              <button
                onClick={() => { setReturnReason(''); setReturnModal(req) }}
                className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50">
                Return
              </button>
            </div>
          </div>
          {req.storekeeper_notes && (
            <p className="mt-2 text-xs text-blue-600 bg-blue-100 rounded-lg px-3 py-1.5">Storekeeper note: {req.storekeeper_notes}</p>
          )}
        </div>
      ))}

      {/* Confirm receipt modal */}
      {receiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-brand-slate">Confirm Receipt</h3>
            <p className="text-xs text-gray-500">{receiveModal.item_name}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Actually Received</label>
              <input type="number" min="0.01" step="any" className={inp}
                value={receiveQty} onChange={e => setReceiveQty(e.target.value)} />
              <p className="text-[10px] text-gray-400 mt-1">Dispatched qty: {receiveModal.quantity_approved} {receiveModal.item_unit}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => receiveMut.mutate({ id: receiveModal.id, d: { quantity_received: Number(receiveQty) } })}
                disabled={receiveMut.isPending || !receiveQty}
                className="flex-1 bg-green-600 text-white text-sm font-bold py-2 rounded-xl disabled:opacity-50">
                {receiveMut.isPending ? '…' : 'Confirm'}
              </button>
              <button onClick={() => setReceiveModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Return modal */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-brand-slate">Return Items</h3>
            <p className="text-xs text-gray-500">{returnModal.item_name} — {returnModal.quantity_approved} {returnModal.item_unit}</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Return <span className="text-brand-red">*</span></label>
              <textarea rows={3} className={`${inp} resize-none`} value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="e.g. Wrong item delivered, items damaged, no longer needed…" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => returnMut.mutate({ id: returnModal.id, d: { return_reason: returnReason } })}
                disabled={returnMut.isPending || !returnReason.trim()}
                className="flex-1 bg-red-600 text-white text-sm font-bold py-2 rounded-xl disabled:opacity-50">
                {returnMut.isPending ? '…' : 'Return Items'}
              </button>
              <button onClick={() => setReturnModal(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
