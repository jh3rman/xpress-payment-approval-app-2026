'use client';

import { useState } from 'react';
import Link from 'next/link';

type ActivityLog = {
  id: string;
  order_id: string;
  event_type: string;
  metadata: any;
  created_at: string;
  orders?: { order_title: string; token: string } | null;
};

type EmailAttempt = {
  id: string;
  order_id: string;
  email_type: string;
  to_emails: string[];
  provider_message_id: string | null;
  status: string;
  error: any;
  created_at: string;
  updated_at: string;
  orders?: { order_title: string; token: string } | null;
};

type Props = {
  activityLogs: ActivityLog[];
  emailAttempts: EmailAttempt[];
};

export function SystemLogsView({ activityLogs, emailAttempts }: Props) {
  const [activeTab, setActiveTab] = useState<'activity' | 'email'>('activity');
  const [activityFilter, setActivityFilter] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');

  // Filter activity logs by event type
  const filteredActivityLogs = activityFilter
    ? activityLogs.filter((log) =>
        log.event_type.toLowerCase().includes(activityFilter.toLowerCase())
      )
    : activityLogs;

  // Filter email attempts by status
  const filteredEmailAttempts = emailStatusFilter
    ? emailAttempts.filter((email) => email.status === emailStatusFilter)
    : emailAttempts;

  // Get unique email statuses for filter dropdown
  const emailStatuses = Array.from(
    new Set(emailAttempts.map((e) => e.status))
  ).sort();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">System Logs</h1>
        <p className="text-gray-600">
          Last 200 activity logs and email attempts for troubleshooting
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Activity Logs ({activityLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-blue-600 text-blue-600 font-medium'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Email Attempts ({emailAttempts.length})
          </button>
        </div>
      </div>

      {/* Activity Logs Tab */}
      {activeTab === 'activity' && (
        <div>
          {/* Filter */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Filter by event type..."
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg w-full max-w-md"
            />
          </div>

          {/* Activity Logs Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Event Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredActivityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No activity logs found
                    </td>
                  </tr>
                ) : (
                  filteredActivityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {log.event_type}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.orders ? (
                          <Link
                            href={`/admin/orders/${log.order_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {log.orders.order_title}
                          </Link>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {Object.keys(log.metadata || {}).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600">
                              View metadata
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-w-md">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-gray-400">Empty</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredActivityLogs.length > 0 && (
            <p className="mt-4 text-sm text-gray-500">
              Showing {filteredActivityLogs.length} of {activityLogs.length} activity logs
            </p>
          )}
        </div>
      )}

      {/* Email Attempts Tab */}
      {activeTab === 'email' && (
        <div>
          {/* Filter */}
          <div className="mb-4">
            <select
              value={emailStatusFilter}
              onChange={(e) => setEmailStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Statuses</option>
              {emailStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Email Attempts Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Recipients
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmailAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No email attempts found
                    </td>
                  </tr>
                ) : (
                  filteredEmailAttempts.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(email.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">
                        {email.email_type}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            email.status === 'delivered'
                              ? 'bg-green-100 text-green-800'
                              : email.status === 'sent'
                              ? 'bg-blue-100 text-blue-800'
                              : email.status === 'failed' ||
                                email.status === 'bounced'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {email.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {email.orders ? (
                          <Link
                            href={`/admin/orders/${email.order_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {email.orders.order_title}
                          </Link>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {email.to_emails.join(', ')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {email.error ? (
                          <details className="cursor-pointer">
                            <summary className="text-red-600">
                              View error
                            </summary>
                            <pre className="mt-2 p-2 bg-red-50 rounded text-xs overflow-auto max-w-md">
                              {JSON.stringify(email.error, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredEmailAttempts.length > 0 && (
            <p className="mt-4 text-sm text-gray-500">
              Showing {filteredEmailAttempts.length} of {emailAttempts.length} email attempts
            </p>
          )}
        </div>
      )}
    </div>
  );
}
