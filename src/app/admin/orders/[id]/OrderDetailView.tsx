'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderWithRelations } from '@/lib/types/database';
import { formatDateTime, formatCents } from '@/lib/utils';
import { updateOrderStatus, updateApprovalStatus } from '../actions';
import { postMessage } from '../message-actions';

interface OrderDetailViewProps {
  order: OrderWithRelations;
}

export default function OrderDetailView({ order: initialOrder }: OrderDetailViewProps) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const customerUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/o/${order.token}`;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{order.order_title}</h1>
          <p className="mt-1 text-sm text-gray-500">Created {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
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
