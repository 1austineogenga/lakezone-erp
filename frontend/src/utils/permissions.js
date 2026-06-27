/**
 * Role-based permission matrix.
 * Each role maps to the modules it can access and the actions it can take.
 *
 * Access levels:
 *   'full'    — read + write + admin actions
 *   'write'   — read + create/edit (no delete/approve)
 *   'read'    — view only
 *   'create'  — can only create new items (e.g. raise a requisition)
 *   false     — no access (module hidden)
 */

const PERMISSIONS = {
  system_admin: {
    dashboard: 'full', projects: 'full', procurement: 'full',
    requisitions: 'full', inventory: 'full', assets: 'full',
    crm: 'full', finance: 'full', hr: 'full', fleet: 'full',
    users: 'full',
  },
  managing_director: {
    dashboard: 'full', projects: 'full', procurement: 'full',
    requisitions: 'full', inventory: 'read', assets: 'read',
    crm: 'full', finance: 'read', hr: 'read', fleet: 'read',
    users: 'read',
  },
  general_manager: {
    dashboard: 'full', projects: 'full', procurement: 'full',
    requisitions: 'full', inventory: 'read', assets: 'read',
    crm: 'full', finance: 'read', hr: 'read', fleet: 'read',
    users: 'read',
  },
  finance_officer: {
    dashboard: 'full', projects: 'read', procurement: 'read',
    requisitions: 'full', inventory: 'read', assets: 'read',
    crm: false, finance: 'full', hr: false, fleet: false,
    users: false,
  },
  finance_manager: {  // legacy alias
    dashboard: 'full', projects: 'read', procurement: 'read',
    requisitions: 'full', inventory: 'read', assets: 'read',
    crm: false, finance: 'full', hr: false, fleet: false,
    users: false,
  },
  hr_manager: {
    dashboard: 'full', projects: 'read', procurement: false,
    requisitions: 'full', inventory: false, assets: 'read',
    crm: false, finance: false, hr: 'full', fleet: false,
    users: 'write',
  },
  procurement_officer: {
    dashboard: 'full', projects: 'read', procurement: 'full',
    requisitions: 'full', inventory: 'full', assets: 'read',
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  facility_manager: {
    dashboard: 'full', projects: 'read', procurement: 'read',
    requisitions: 'full', inventory: 'read', assets: 'full',
    crm: false, finance: false, hr: false, fleet: 'read',
    users: false,
  },
  admin_officer: {
    dashboard: 'full', projects: false, procurement: 'read',
    requisitions: 'full', inventory: 'write', assets: 'read',
    crm: 'full', finance: false, hr: false, fleet: false,
    users: false,
  },
  site_manager: {
    dashboard: 'full', projects: 'full', procurement: 'read',
    requisitions: 'write', inventory: 'read', assets: 'read',
    crm: false, finance: 'read', hr: 'read', fleet: 'read',
    users: false,
  },
  project_manager: {  // legacy alias
    dashboard: 'full', projects: 'full', procurement: 'read',
    requisitions: 'write', inventory: 'read', assets: 'read',
    crm: false, finance: 'read', hr: 'read', fleet: 'read',
    users: false,
  },
  site_engineer: {
    dashboard: 'full', projects: 'write', procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  site_foreman: {
    dashboard: 'full', projects: 'write', procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  site_surveyor: {
    dashboard: 'full', projects: 'write', procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  mechanic: {
    dashboard: false, projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: 'read',
    users: false,
  },
  welder: {
    dashboard: false, projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  equipment_operator: {
    dashboard: false, projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  driver: {
    dashboard: false, projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: 'read',
    users: false,
  },
  head_of_security: {
    dashboard: 'read', projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: 'read',
    crm: false, finance: false, hr: false, fleet: 'read',
    users: false,
  },
  surveillance_officer: {
    dashboard: 'read', projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: 'read',
    users: false,
  },
  storekeeper: {
    dashboard: 'full', projects: false, procurement: 'read',
    requisitions: 'full', inventory: 'full', assets: 'read',
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  fleet_manager: {
    dashboard: 'full', projects: 'read', procurement: 'read',
    requisitions: 'write', inventory: false, assets: 'read',
    crm: false, finance: false, hr: false, fleet: 'full',
    users: false,
  },
  chef: {
    dashboard: false, projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  cleaner: {
    dashboard: false, projects: false, procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: false, finance: false, hr: false, fleet: false,
    users: false,
  },
  sales_officer: {
    dashboard: 'full', projects: 'read', procurement: false,
    requisitions: 'create', inventory: false, assets: false,
    crm: 'full', finance: false, hr: false, fleet: false,
    users: false,
  },
}

const DEFAULT = {
  dashboard: false, projects: false, procurement: false,
  requisitions: 'create', inventory: false, assets: false,
  crm: false, finance: false, hr: false, fleet: false, users: false,
}

/**
 * Returns the permission object for a given role.
 */
export function getPermissions(role) {
  return PERMISSIONS[role] || DEFAULT
}

/**
 * Returns true if the role can access the module (any level).
 */
export function canAccess(role, module) {
  const perms = getPermissions(role)
  return !!perms[module]
}

/**
 * Returns true if the role can write/edit in the module.
 */
export function canWrite(role, module) {
  const level = getPermissions(role)[module]
  return ['full', 'write'].includes(level)
}

/**
 * Returns true if the role has full admin access to the module.
 */
export function canAdmin(role, module) {
  return getPermissions(role)[module] === 'full'
}

/**
 * Roles grouped for display in User Management UI.
 */
export const ROLE_GROUPS = [
  {
    label: 'Executive',
    roles: [
      { value: 'managing_director',  label: 'Managing Director' },
      { value: 'general_manager',    label: 'General Manager' },
    ],
  },
  {
    label: 'Administration',
    roles: [
      { value: 'system_admin',       label: 'System Administrator' },
      { value: 'admin_officer',      label: 'Admin Officer' },
    ],
  },
  {
    label: 'Management',
    roles: [
      { value: 'finance_officer',    label: 'Finance Officer' },
      { value: 'hr_manager',         label: 'HR Manager' },
      { value: 'procurement_officer',label: 'Procurement Officer' },
      { value: 'facility_manager',   label: 'Facility Manager' },
      { value: 'fleet_manager',      label: 'Fleet Manager' },
      { value: 'storekeeper',        label: 'Storekeeper' },
    ],
  },
  {
    label: 'Site / Technical',
    roles: [
      { value: 'site_manager',       label: 'Site Manager' },
      { value: 'site_engineer',      label: 'Site Engineer' },
      { value: 'site_foreman',       label: 'Site Foreman' },
      { value: 'site_surveyor',      label: 'Site Surveyor' },
    ],
  },
  {
    label: 'Skilled Trades',
    roles: [
      { value: 'mechanic',           label: 'Mechanic' },
      { value: 'welder',             label: 'Welder' },
    ],
  },
  {
    label: 'Field / Operations',
    roles: [
      { value: 'equipment_operator', label: 'Machine Operator' },
      { value: 'driver',             label: 'Driver' },
      { value: 'head_of_security',   label: 'Head of Security' },
      { value: 'surveillance_officer','label': 'Surveillance Officer' },
    ],
  },
  {
    label: 'Support Staff',
    roles: [
      { value: 'chef',               label: 'Chef' },
      { value: 'cleaner',            label: 'Cleaner' },
    ],
  },
]

export const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles)
