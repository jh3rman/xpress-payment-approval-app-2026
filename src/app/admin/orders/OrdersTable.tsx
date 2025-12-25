'use client';

import Link from 'next/link';
import { OrderWithRelations } from '@/lib/types/database';
import { formatDate, formatDateTime, timeAgo, cn } from '@/lib/utils';

interface OrdersTableProps {
  orders: OrderWithRelations[];
}

export default function OrdersTable({ orders }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No orders</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new order.</p>
        <div className="mt-6">
          <Link
            href="/admin/orders/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            + New Order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Order Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Approvals
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Viewed
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Messages
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.map((order) => {
            const messageCount = order.messages?.length || 0;
            const lastMessage = order.messages?.[order.messages.length - 1];
            const isCancelled = order.status === 'cancelled';

            return (
              <tr
                key={order.id}
                className={cn(
                  'hover:bg-gray-50 cursor-pointer',
                  isCancelled && 'bg-gray-100'
                )}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {formatDate(order.created_at)}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    <div className={cn('text-sm font-medium', isCancelled && 'line-through')}>
                      {order.customer_email}
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    <div className={cn('text-sm text-gray-900', isCancelled && 'line-through')}>
                      {order.order_title}
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    <StatusBadge status={order.status} />
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    <div className="flex flex-col gap-1">
                      {order.approvals && (
                        <>
                          <ApprovalChip
                            label="Invoice"
                            status={order.approvals.invoice_status}
                          />
                          <ApprovalChip
                            label="Artwork"
                            status={order.approvals.artwork_status}
                          />
                          {order.payment_required && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Payment Missing
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {order.last_viewed_at ? (
                      <div>
                        <div>{timeAgo(order.last_viewed_at)}</div>
                        <div className="text-xs text-gray-400">({order.view_count} views)</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Not viewed</span>
                    )}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <Link href={`/admin/orders/${order.id}`} className="block">
                    {messageCount > 0 ? (
                      <div>
                        <div>{messageCount} messages</div>
                        {lastMessage && (
                          <div className="text-xs text-gray-400">
                            {timeAgo(lastMessage.created_at)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">No messages</span>
                    )}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ApprovalChip({ label, status }: { label: string; status: string }) {
  const colors = {
    pending: 'bg-gray-100 text-gray-800',
    approved: 'bg-green-100 text-green-800',
    changes_requested: 'bg-orange-100 text-orange-800',
  };

  const displayStatus = status === 'changes_requested' ? 'Changes' : status;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {label}: {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
    </span>
  );
}
