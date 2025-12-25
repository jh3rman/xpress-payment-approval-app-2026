import { getOrders } from './actions';
import OrdersTable from './OrdersTable';
import Link from 'next/link';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter as any;
  let orders = await getOrders(
    filter && filter !== 'expiring_soon' ? { status: filter } : undefined
  );

  // Calculate counts for filters
  const allOrders = await getOrders();

  // Helper to calculate days left
  const getDaysLeft = (order: any): number | null => {
    if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'archived') {
      return null;
    }
    if (!order.initial_email_sent_at) {
      return null;
    }
    const initialSent = new Date(order.initial_email_sent_at);
    const revivedAt = order.revived_at ? new Date(order.revived_at) : null;
    const timelineStart = revivedAt && revivedAt > initialSent ? revivedAt : initialSent;
    const now = new Date();
    const diffMs = now.getTime() - timelineStart.getTime();
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const autoCancelDays = 20; // Default, should match settings
    return autoCancelDays - daysElapsed;
  };

  const counts = {
    total: allOrders.length,
    pending: allOrders.filter((o) => o.status === 'pending').length,
    completed: allOrders.filter((o) => o.status === 'completed').length,
    cancelled: allOrders.filter((o) => o.status === 'cancelled').length,
    archived: allOrders.filter((o) => o.status === 'archived').length,
    not_sent: allOrders.filter((o) => !o.initial_email_sent_at).length,
    email_issues: allOrders.filter((o) => o.email_issue).length,
    expiring_soon: allOrders.filter((o) => {
      const daysLeft = getDaysLeft(o);
      return daysLeft !== null && daysLeft < 7 && daysLeft >= 0;
    }).length,
  };

  // Apply expiring_soon filter if selected
  if (filter === 'expiring_soon') {
    orders = orders.filter((o) => {
      const daysLeft = getDaysLeft(o);
      return daysLeft !== null && daysLeft < 7 && daysLeft >= 0;
    });
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage customer orders and approvals.
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          + New Order
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterButton href="/admin/orders" label="All" count={counts.total} active={!filter} />
        <FilterButton
          href="/admin/orders?filter=pending"
          label="Pending"
          count={counts.pending}
          active={filter === 'pending'}
        />
        <FilterButton
          href="/admin/orders?filter=completed"
          label="Completed"
          count={counts.completed}
          active={filter === 'completed'}
        />
        <FilterButton
          href="/admin/orders?filter=cancelled"
          label="Cancelled"
          count={counts.cancelled}
          active={filter === 'cancelled'}
        />
        <FilterButton
          href="/admin/orders?filter=archived"
          label="Archived"
          count={counts.archived}
          active={filter === 'archived'}
        />
        <FilterButton
          href="/admin/orders?filter=expiring_soon"
          label="Expiring Soon"
          count={counts.expiring_soon}
          active={filter === 'expiring_soon'}
        />
        <FilterButton
          href="/admin/orders?filter=not_sent"
          label="Not Sent"
          count={counts.not_sent}
          active={filter === 'not_sent'}
        />
        <FilterButton
          href="/admin/orders?filter=email_issues"
          label="Email Issues"
          count={counts.email_issues}
          active={filter === 'email_issues'}
        />
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}

function FilterButton({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 border border-blue-300'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label} <span className="ml-1 text-xs">({count})</span>
    </Link>
  );
}
