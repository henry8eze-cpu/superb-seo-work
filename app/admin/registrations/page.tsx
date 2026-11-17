import { requireAdmin } from '@/app/actions/auth'
import { buildRegistrationWhere } from '@/lib/admin-filters'
import { prisma } from '@/lib/prisma'
import { Pagination } from '@/components/ui/pagination'
import { Search } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Registrations | Admin Dashboard',
}

const PAGE_SIZE = 20

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-800',
  CONTACTED: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  ENROLLED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Pending',
  CONTACTED: 'Contacted',
  ACCEPTED: 'Approved',
  ON_HOLD: 'On Hold',
  ENROLLED: 'Enrolled',
  REJECTED: 'Rejected',
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; level?: string; page?: string }>
}) {
  await requireAdmin()
  const params = await searchParams

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const filters = {
    search: params.search?.trim() || undefined,
    status: params.status || undefined,
    level: params.level || undefined,
  }
  const where = buildRegistrationWhere(filters)

  const [registrations, totalCount] = await Promise.all([
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.registration.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const buildHref = (targetPage: number) => {
    const qs = new URLSearchParams()
    if (filters.search) qs.set('search', filters.search)
    if (filters.status) qs.set('status', filters.status)
    if (filters.level) qs.set('level', filters.level)
    qs.set('page', String(targetPage))
    return `/admin/registrations?${qs.toString()}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-dark-gray mb-2">
          Registrations
        </h2>
        <p className="text-muted-foreground">
          Manage and track student applications
        </p>
      </div>

      {/* Filters */}
      <form className="bg-white rounded-lg shadow-soft p-6 flex flex-col md:flex-row gap-4" method="get">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            name="search"
            defaultValue={filters.search}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <select
          name="status"
          defaultValue={filters.status || ''}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">All Status</option>
          <option value="NEW">Pending</option>
          <option value="CONTACTED">Contacted</option>
          <option value="ACCEPTED">Approved</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="ENROLLED">Enrolled</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          name="level"
          defaultValue={filters.level || ''}
          className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white"
        >
          <option value="">All Levels</option>
          <option value="A1">A1</option>
          <option value="A2">A2</option>
          <option value="B1">B1</option>
          <option value="B2">B2</option>
          <option value="C1">C1</option>
          <option value="C2">C2</option>
        </select>

        <button
          type="submit"
          className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-opacity-90 transition-all font-medium"
        >
          Filter
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cream border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-dark-gray">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {registrations.length > 0 ? (
                registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    className="border-b border-border hover:bg-cream transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-dark-gray">
                      {reg.fullName}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {reg.email}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {reg.phone}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {reg.germanLevel || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          STATUS_STYLES[reg.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {STATUS_LABELS[reg.status] || reg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {reg.createdAt.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/registrations/${reg.id}`}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No registrations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
          buildHref={buildHref}
        />
      </div>
    </div>
  )
}
