'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OrderWithRelations, RevivalRequest } from '@/lib/types/database';
import { formatDateTime, formatCents } from '@/lib/utils';
import { updateOrderStatus, updateApprovalStatus } from '../actions';
import { postMessage } from '../message-actions';
import { getRevivalRequests, approveRevivalRequest, rejectRevivalRequest } from '../revival-actions';

interface OrderDetailViewProps {
  order: OrderWithRelations;
}

export default function OrderDetailView({ order: initialOrder }: OrderDetailViewProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revivalRequests, setRevivalRequests] = useState<RevivalRequest[]>([]);
  const [sendingReminder, setSendingReminder] = useState(false);

  const customerUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/o/${order.token}`;

  // Load revival requests
  useEffect(() => {
    const loadRevivalRequests = async () => {
      const requests = await getRevivalRequests(order.id);
      setRevivalRequests(requests);
    };
    loadRevivalRequests();
  }, [order.id]);

  const copyUrl = () => {
    navigator.clipboard.writeText(customerUrl);
  };

  const handleStatusChange = async (newStatus: string) => {
    const confirmed = confirm(`Change order status to ${newStatus}?`);
    if (!confirmed) return;

    const result = await updateOrderStatus(order.id, newStatus as any);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to update status');
    }
  };

  const handleApprovalChange = async (type: 'invoice' | 'artwork', status: string) => {
    const result = await updateApprovalStatus(order.id, type, status as any, 'admin');
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to update approval');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    const result = await postMessage(order.id, message, 'admin');

    if (result.success) {
      setMessage('');
      router.refresh();
    } else {
      alert(result.error || 'Failed to send message');
    }
    setSubmitting(false);
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    const response = await fetch(`/api/download?path=${encodeURIComponent(storagePath)}`);
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } else {
      alert('Failed to download file');
    }
  };

  const handleSendReminder = async () => {
    if (!confirm('Send a reminder email to the customer?')) return;

    setSendingReminder(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/send-reminder`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Reminder sent successfully');
        router.refresh();
      } else {
        alert(data.error || 'Failed to send reminder');
      }
    } catch (error) {
      alert('Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleApproveRevival = async (requestId: string) => {
    const notes = prompt('Optional admin notes:');
    if (notes === null) return; // User cancelled

    const result = await approveRevivalRequest(requestId, notes || undefined);
    if (result.success) {
      alert('Revival request approved. Order timeline has been reset.');
      router.refresh();
    } else {
      alert(result.error || 'Failed to approve revival request');
    }
  };

  const handleRejectRevival = async (requestId: string) => {
    const notes = prompt('Optional rejection reason:');
    if (notes === null) return; // User cancelled

    const result = await rejectRevivalRequest(requestId, notes || undefined);
    if (result.success) {
      alert('Revival request rejected.');
      router.refresh();
    } else {
      alert(result.error || 'Failed to reject revival request');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{order.order_title}</h1>
          <p className="mt-1 text-sm text-gray-500">Created {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/admin/orders/new?duplicate=${order.id}`)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
          >
            Duplicate
          </button>
          {order.initial_email_sent_at && order.status !== 'cancelled' && order.status !== 'completed' && (
            <button
              onClick={handleSendReminder}
              disabled={sendingReminder}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 text-sm"
            >
              {sendingReminder ? 'Sending...' : 'Send Reminder'}
            </button>
          )}
          <select
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Customer URL */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Link</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 px-4 py-2 rounded text-sm break-all">
            {customerUrl}
          </code>
          <button
            onClick={copyUrl}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Email</dt>
              <dd className="text-gray-900">{order.customer_email}</dd>
            </div>
            {order.cc_emails && order.cc_emails.length > 0 && (
              <div>
                <dt className="font-medium text-gray-500">CC</dt>
                <dd className="text-gray-900">{order.cc_emails.join(', ')}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-gray-500">From Email</dt>
              <dd className="text-gray-900">{order.from_email}</dd>
            </div>
          </dl>
        </div>

        {/* Payment Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Settings</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Payment Required</dt>
              <dd className="text-gray-900">{order.payment_required ? 'Yes' : 'No'}</dd>
            </div>
            {order.payment_required && (
              <>
                <div>
                  <dt className="font-medium text-gray-500">Amount</dt>
                  <dd className="text-gray-900 text-lg font-bold">
                    {order.order_amount_cents ? formatCents(order.order_amount_cents) : '$0.00'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Allow Tip</dt>
                  <dd className="text-gray-900">{order.allow_tip ? 'Yes' : 'No'}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Files */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Files</h2>
        <div className="space-y-2">
          {order.order_files?.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                <p className="text-xs text-gray-500">
                  {file.file_type === 'invoice' ? 'Invoice' : 'Artwork'}
                </p>
              </div>
              <button
                onClick={() => handleDownload(file.storage_path, file.filename)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Approvals */}
      {order.approvals && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Approvals</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Status</h3>
              <div className="flex gap-2">
                {['pending', 'approved', 'changes_requested'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleApprovalChange('invoice', status)}
                    className={`px-3 py-1 rounded text-sm ${
                      order.approvals?.invoice_status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {status === 'changes_requested' ? 'Changes' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Artwork Status</h3>
              <div className="flex gap-2">
                {['pending', 'approved', 'changes_requested'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleApprovalChange('artwork', status)}
                    className={`px-3 py-1 rounded text-sm ${
                      order.approvals?.artwork_status === status
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {status === 'changes_requested' ? 'Changes' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revival Requests */}
      {revivalRequests.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revival Requests</h2>
          <div className="space-y-4">
            {revivalRequests.map((request) => (
              <div
                key={request.id}
                className={`border rounded-lg p-4 ${
                  request.status === 'pending'
                    ? 'border-yellow-300 bg-yellow-50'
                    : request.status === 'approved'
                    ? 'border-green-300 bg-green-50'
                    : 'border-red-300 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(request.created_at)}
                      </span>
                    </div>
                    {request.requester_message && (
                      <p className="text-sm text-gray-700 mb-2">
                        <strong>Message:</strong> {request.requester_message}
                      </p>
                    )}
                    {request.admin_notes && (
                      <p className="text-sm text-gray-600">
                        <strong>Admin notes:</strong> {request.admin_notes}
                      </p>
                    )}
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApproveRevival(request.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectRevival(request.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Messages {!order.chat_open && <span className="text-sm text-red-600">(Closed)</span>}
        </h2>
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {order.messages && order.messages.length > 0 ? (
            order.messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.sender === 'admin' ? 'bg-blue-50 ml-12' : 'bg-gray-100 mr-12'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">
                    {msg.sender === 'admin' ? 'Admin' : 'Customer'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(msg.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{msg.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No messages yet</p>
          )}
        </div>
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!message.trim() || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      {/* Internal Notes */}
      {order.internal_notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Internal Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.internal_notes}</p>
        </div>
      )}

      {/* View Stats */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">View Statistics</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="font-medium text-gray-500">First Viewed</dt>
            <dd className="text-gray-900">{order.first_viewed_at ? formatDateTime(order.first_viewed_at) : 'Never'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Last Viewed</dt>
            <dd className="text-gray-900">{order.last_viewed_at ? formatDateTime(order.last_viewed_at) : 'Never'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">View Count</dt>
            <dd className="text-gray-900">{order.view_count}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
