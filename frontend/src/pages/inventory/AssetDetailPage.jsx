import { useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, PrinterIcon, ExclamationTriangleIcon, ShieldCheckIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { getAsset } from '../../api/inventory'

const CATEGORY_LABELS = {
  machinery:        'Machinery & Plant',
  vehicles:         'Vehicles (Cars/SUVs/Double Cabs)',
  trucks_tracks:    'Trucks & Tracks',
  it_equipment:     'IT Equipment',
  furniture:        'Furniture & Fittings',
  office_equipment: 'Office Equipment',
  tools:            'Tools & Equipment',
  communication:    'Communication Equipment',
  safety:           'Safety Equipment',
  other:            'Other',
}

const STATUS_LABELS = {
  operational:    'Operational',
  functional:     'Functional',
  non_operational:'Non-Operational',
  undetermined:   'Undetermined',
  active:         'Active',
  under_repair:   'Under Repair',
  disposed:       'Disposed',
  lost:           'Lost',
}

function certBadge(expiry, status) {
  if (status === 'expired') return 'bg-red-100 text-red-700 border-red-200'
  if (status === 'not_in_system') return 'bg-gray-100 text-gray-500 border-gray-200'
  if (!expiry) return 'bg-gray-50 text-gray-400 border-gray-200'
  const days = Math.ceil((new Date(expiry) - new Date()) / 86400000)
  if (days < 0) return 'bg-red-100 text-red-700 border-red-200'
  if (days <= 30) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

function daysLabel(expiry) {
  if (!expiry) return null
  const days = Math.ceil((new Date(expiry) - new Date()) / 86400000)
  if (days < 0) return `Expired ${Math.abs(days)} days ago`
  if (days === 0) return 'Expires today'
  return `${days} days remaining`
}

function Section({ title, icon: Icon, colorClass = 'bg-gray-50 border-gray-200 text-gray-700', children }) {
  return (
    <div className={`rounded-2xl border p-5 ${colorClass}`}>
      <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-4">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, value, mono = false }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-xs font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function CertSection({ title, certNo, policyNo, policyType, insurer, chassis, commencement, expiry, status, authority, issued, deviceSerial }) {
  const badge = certBadge(expiry, status)
  const days = daysLabel(expiry)

  return (
    <div className={`rounded-2xl border p-5 ${badge}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheckIcon className="h-3.5 w-3.5" /> {title}
        </h3>
        <div className="text-right text-xs font-semibold">
          {status && <div className="uppercase">{status.replace(/_/g, ' ')}</div>}
          {days && <div>{days}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        <Field label="Certificate No." value={certNo} mono />
        <Field label="Policy No." value={policyNo} mono />
        <Field label="Policy Type" value={policyType} />
        <Field label="Insurer" value={insurer} />
        <Field label="Chassis Number" value={chassis} mono />
        <Field label="Device Serial No." value={deviceSerial} mono />
        <Field label="Issuing Authority" value={authority} />
        <Field label="Commencement Date" value={commencement} />
        <Field label="Issue Date" value={issued} />
        <Field label="Expiry Date" value={expiry} />
      </div>
      {!certNo && !policyNo && !expiry && !status && (
        <p className="text-xs italic opacity-60">No certificate details recorded.</p>
      )}
    </div>
  )
}

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const printRef = useRef()

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    )
  }

  if (isError || !asset) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-sm">Asset not found.</p>
        <button onClick={() => navigate('/assets')} className="mt-3 text-xs text-brand-red font-medium hover:underline">← Back to Assets</button>
      </div>
    )
  }

  const isMachine = asset.category === 'machinery'
  const isVehicle = asset.category === 'vehicles'
  const isTruck   = asset.category === 'trucks_tracks'

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { box-shadow: none !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 no-print">
        <button onClick={() => navigate('/assets')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-slate font-medium">
          <ArrowLeftIcon className="h-4 w-4" /> Back to Assets
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-slate text-white text-xs font-semibold rounded-xl hover:opacity-90">
          <PrinterIcon className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div ref={printRef} className="space-y-4 print-page">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg">{asset.asset_code}</span>
                <span className="text-xs bg-brand-slate text-white px-2.5 py-1 rounded-lg font-medium">
                  {CATEGORY_LABELS[asset.category] ?? asset.category}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                  asset.status === 'operational' || asset.status === 'active' ? 'bg-green-100 text-green-700' :
                  asset.status === 'non_operational' ? 'bg-red-100 text-red-700' :
                  asset.status === 'under_repair' ? 'bg-amber-100 text-amber-700' :
                  asset.status === 'undetermined' ? 'bg-gray-100 text-gray-500' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {STATUS_LABELS[asset.status] ?? asset.status}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-brand-slate">{asset.name}</h1>
              {asset.registration_plate && (
                <p className="text-base font-mono text-gray-500 mt-1">{asset.registration_plate}</p>
              )}
            </div>
            <div className="text-right text-xs text-gray-400 space-y-1">
              <p>Department: <span className="font-semibold text-gray-700">{asset.department}</span></p>
              {asset.assigned_to && <p>Assigned to: <span className="font-semibold text-gray-700">{asset.assigned_to}</span></p>}
              {asset.location && <p>Location: <span className="font-semibold text-gray-700">{asset.location}</span></p>}
              <p className="mt-2 text-[10px]">Printed: {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Basic Details */}
        <Section title="Asset Details" colorClass="bg-white border-gray-100 text-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Make / Model" value={asset.make_model} />
            <Field label="Serial Number" value={asset.serial_number} mono />
            <Field label="Condition" value={asset.condition ? asset.condition.charAt(0).toUpperCase() + asset.condition.slice(1) : null} />
            <Field label="Location / Site" value={asset.location} />
            <Field label="Purchase Date" value={asset.purchase_date} />
            <Field label="Purchase Value" value={Number(asset.purchase_value) > 0 ? `KES ${Number(asset.purchase_value).toLocaleString()}` : null} />
            <Field label="Current Value" value={Number(asset.current_value) > 0 ? `KES ${Number(asset.current_value).toLocaleString()}` : null} />
          </div>
        </Section>

        {/* Machine service */}
        {isMachine && asset.hours_to_next_service != null && (
          <Section title="Service Information" icon={WrenchScrewdriverIcon} colorClass="bg-orange-50 border-orange-200 text-orange-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Hours to Next Service" value={`${asset.hours_to_next_service} hrs`} />
            </div>
          </Section>
        )}

        {/* Vehicle service */}
        {(isVehicle || isTruck) && asset.kms_to_next_service != null && (
          <Section title="Service Information" icon={WrenchScrewdriverIcon} colorClass="bg-purple-50 border-purple-200 text-purple-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
              <Field label="KMs to Next Service" value={`${Number(asset.kms_to_next_service).toLocaleString()} km`} />
              {asset.insurance_chassis_number && <Field label="Chassis Number" value={asset.insurance_chassis_number} mono />}
            </div>
          </Section>
        )}

        {/* Insurance Certificate */}
        {(isVehicle || isTruck) && (
          <CertSection
            title="Insurance Certificate"
            certNo={asset.insurance_cert_number}
            policyNo={asset.insurance_policy_number}
            policyType={asset.insurance_policy_type}
            insurer={asset.insurance_insurer}
            chassis={asset.insurance_chassis_number}
            commencement={asset.insurance_commencement_date}
            expiry={asset.insurance_expiry}
            status={null}
          />
        )}

        {/* Inspection Certificate */}
        {isTruck && (
          <CertSection
            title="Inspection Certificate"
            certNo={asset.inspection_cert_number}
            authority={asset.inspection_issuing_authority}
            issued={asset.inspection_cert_issue_date}
            expiry={asset.inspection_cert_expiry}
            status={asset.inspection_cert_status}
          />
        )}

        {/* Speed Governor Certificate */}
        {isTruck && (
          <CertSection
            title="Speed Governor Certificate"
            certNo={asset.speed_governor_cert_number}
            deviceSerial={asset.speed_governor_device_serial}
            authority={asset.speed_governor_issuing_authority}
            issued={asset.speed_governor_cert_issue_date}
            expiry={asset.speed_governor_cert_expiry}
            status={asset.speed_governor_cert_status}
          />
        )}

        {/* Defects */}
        {asset.current_defects && (
          <Section title="Current Defects" icon={ExclamationTriangleIcon} colorClass="bg-red-50 border-red-200 text-red-700">
            <p className="text-xs text-red-800 whitespace-pre-line leading-relaxed">{asset.current_defects}</p>
          </Section>
        )}

        {/* Requirements */}
        {asset.requirements && (
          <Section title="Requirements / Parts Needed" colorClass="bg-amber-50 border-amber-200 text-amber-700">
            <p className="text-xs text-amber-800 whitespace-pre-line leading-relaxed">{asset.requirements}</p>
          </Section>
        )}

        {/* Notes */}
        {asset.notes && (
          <Section title="Additional Notes" colorClass="bg-white border-gray-100 text-gray-600">
            <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{asset.notes}</p>
          </Section>
        )}

        {/* Print footer */}
        <div className="hidden print:block text-center text-[10px] text-gray-400 mt-8 pt-4 border-t border-gray-200">
          Lake Zone Enterprises Ltd — Enterprise Resource Planning System · {new Date().toLocaleString()}
        </div>
      </div>
    </>
  )
}
