'use client';

import { useState, useEffect } from 'react';
import { OrderWithRelations, Settings } from '@/lib/types/database';
import { formatCents } from '@/lib/utils';
import { updateApprovalStatus } from '@/app/admin/orders/actions';
import { postMessage, getNewMessages } from '@/app/admin/orders/message-actions';

interface CustomerOrderViewProps {
  order: OrderWithRelations;
  settings: Settings | null;
}

export default function CustomerOrderView({ order: initialOrder, settings }: CustomerOrderViewProps) {
  const [order, setOrder] = useState(initialOrder);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(order.messages || []);
  const [submitting, setSubmitting] = useState(false);
  const [requestingRevival, setRequestingRevival] = useState(false);

  // Poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const newMessages = await getNewMessages(order.id, lastMessage.created_at);
        if (newMessages.length > 0) {
          setMessages([...messages, ...newMessages]);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [messages, order.id]);

  const handleApprovalChange = async (type: 'invoice' | 'artwork', status: string) => {
    if (order.status === 'cancelled') {
      alert('Cannot update approvals on cancelled orders');
      return;
    }

    const result = await updateApprovalStatus(order.id, type, status as any, 'customer');
    if (result.success) {
      // Update local state
      if (order.approvals) {
        setOrder({
          ...order,
          approvals: {
            ...order.approvals,
            [type === 'invoice' ? 'invoice_status' : 'artwork_status']: status,
          },
        });
      }
    } else {
      alert(result.error || 'Failed to update approval');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    if (!order.chat_open) {
      alert('Messaging is currently closed for this order');
      return;
    }

    setSubmitting(true);
    const result = await postMessage(order.id, message, 'customer');

    if (result.success && result.message) {
      setMessage('');
      setMessages([...messages, result.message]);
    } else {
      alert(result.error || 'Failed to send message');
    }
    setSubmitting(false);
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    window.open(`/api/download?path=${encodeURIComponent(storagePath)}`, '_blank');
  };

  const handleRequestRevival = async () => {
    const revivalMessage = prompt('Optional message to include with your revival request:');
    if (revivalMessage === null) return; // User cancelled

    setRequestingRevival(true);
    try {
      const response = await fetch(`/api/orders/${order.token}/request-revival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: revivalMessage || undefined }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Revival request submitted successfully. You will be notified when reviewed.');
      } else {
        alert(data.error || 'Failed to submit revival request');
      }
    } catch (error) {
      alert('Failed to submit revival request');
    } finally {
      setRequestingRevival(false);
    }
  };

  const companyName = settings?.company_name || 'XPress Payment & Approvals App';
  const orderAmount = order.order_amount_cents || 0;
  const subtotal = orderAmount;
  const orderTotal = orderAmount;

  const invoiceFiles = order.order_files?.filter((f) => f.file_type === 'invoice') || [];
  const artworkFiles = order.order_files?.filter((f) => f.file_type === 'artwork') || [];

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Company Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Cancelled Banner */}
          {order.status === 'cancelled' && (
            <div className="bg-red-100 border-b-2 border-red-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-900 font-bold text-lg">Order Cancelled</p>
                  <p className="text-red-700 text-sm">
                    This order has been cancelled. You can request to revive it if needed.
                  </p>
                </div>
                <button
                  onClick={handleRequestRevival}
                  disabled={requestingRevival}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium whitespace-nowrap ml-4"
                >
                  {requestingRevival ? 'Requesting...' : 'Request Revival'}
                </button>
              </div>
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Order Title and Amount */}
            <div className="text-center border-b pb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{order.order_title}</h2>
              {order.payment_required && (
                <div className="text-4xl font-bold text-gray-900">
                  {formatCents(orderAmount)}
                </div>
              )}
            </div>

            {/* Subtotal and Order Total */}
            {order.payment_required && (
              <div className="border-b pb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCents(subtotal)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Order total</span>
                  <span className="text-gray-900">{formatCents(orderTotal)}</span>
                </div>
              </div>
            )}

            {/* Files Section */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Files</h3>
              <div className="space-y-2">
                {invoiceFiles.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Invoices:</p>
                    {invoiceFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleDownload(file.storage_path, file.filename)}
                        className="block w-full text-left px-3 py-2 bg-gray-50 rounded text-sm text-blue-600 hover:bg-gray-100"
                      >
                        📄 {file.filename}
                      </button>
                    ))}
                  </div>
                )}
                {artworkFiles.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Artwork:</p>
                    {artworkFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleDownload(file.storage_path, file.filename)}
                        className="block w-full text-left px-3 py-2 bg-gray-50 rounded text-sm text-blue-600 hover:bg-gray-100"
                      >
                        🎨 {file.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Approvals Section */}
            {order.approvals && order.status !== 'cancelled' && (
              <div className="border-b pb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Approvals</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Invoice</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovalChange('invoice', 'approved')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                          order.approvals.invoice_status === 'approved'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalChange('invoice', 'changes_requested')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                          order.approvals.invoice_status === 'changes_requested'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 mb-2">Artwork</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovalChange('artwork', 'approved')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                          order.approvals.artwork_status === 'approved'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleApprovalChange('artwork', 'changes_requested')}
                        className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
                          order.approvals.artwork_status === 'changes_requested'
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Request Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Section */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                Messages {!order.chat_open && <span className="text-sm text-gray-500">(Closed)</span>}
              </h3>
              <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                {messages.length > 0 ? (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded text-sm ${
                        msg.sender === 'customer' ? 'bg-blue-50 ml-8' : 'bg-gray-100 mr-8'
                      }`}
                    >
                      <p className="text-xs text-gray-500 mb-1">
                        {msg.sender === 'customer' ? 'You' : 'Admin'}
                      </p>
                      <p className="text-gray-900">{msg.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>
                )}
              </div>
              {order.chat_open ? (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim() || submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Send
                  </button>
                </form>
              ) : (
                <p className="text-sm text-gray-500 text-center">Messaging is currently closed</p>
              )}
            </div>

            {/* Add a note for the seller (UI only in Phase 1) */}
            <div className="border-b pb-6">
              <textarea
                placeholder="Add a note for the seller"
                rows={3}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              />
            </div>

            {/* Add coupon (UI only in Phase 1) */}
            <div className="border-b pb-6">
              <button
                disabled
                className="flex items-center text-sm text-gray-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Add coupon
              </button>
            </div>

            {/* Express checkout (UI only) */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Express checkout</h3>
              <button
                disabled
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-400"
              >
                <span className="flex items-center">
                  <span className="text-blue-500 font-bold mr-1">G</span>
                  <span className="text-red-500 font-bold mr-1">o</span>
                  <span className="text-yellow-500 font-bold mr-1">o</span>
                  <span className="text-blue-500 font-bold mr-1">g</span>
                  <span className="text-green-500 font-bold mr-1">l</span>
                  <span className="text-red-500 font-bold mr-1">e</span>
                  <span className="ml-2 text-gray-700">Pay</span>
                </span>
              </button>
            </div>

            {/* Contact (UI only) */}
            <div className="border-b pb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select disabled className="px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50">
                    <option>+1 United States</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    disabled
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email address for receipt"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="First name"
                    disabled
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    disabled
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Payment (UI placeholders) */}
            {order.payment_required && (
              <div>
                <div className="flex items-center mb-2">
                  <h3 className="font-semibold text-gray-900">Payment</h3>
                  <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mb-4">All transactions are secure and encrypted</p>

                {/* Credit card placeholder */}
                <div className="border border-black rounded-md p-4 mb-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Credit card</span>
                    <svg className="w-8 h-5" viewBox="0 0 32 20" fill="currentColor">
                      <rect width="32" height="20" rx="2" fill="#333" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center bg-white border border-gray-300 rounded px-3 py-2">
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <rect width="20" height="14" rx="2" fill="#666" />
                      </svg>
                      <span className="text-sm text-gray-400">Card number</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        disabled
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                      />
                      <input
                        type="text"
                        placeholder="CVV"
                        disabled
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Cash App Pay placeholder */}
                <div className="border border-gray-300 rounded-md p-3 mb-3 flex items-center justify-between bg-gray-50">
                  <span className="text-sm">Cash App Pay</span>
                  <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white font-bold text-xs">
                    $
                  </div>
                </div>

                {/* Afterpay placeholder */}
                <div className="border border-gray-300 rounded-md p-3 mb-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">Afterpay</span>
                    <span className="text-sm font-semibold text-black">afterpay</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    4 interest-free installments of {formatCents(Math.round(orderAmount / 4))}
                  </p>
                </div>

                {/* Pay button */}
                <button
                  disabled
                  className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold text-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Pay {formatCents(orderTotal)}
                </button>
              </div>
            )}

            {!order.payment_required && (
              <div className="text-center text-gray-600 py-4">
                <p className="text-sm">No payment required for this order</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600 space-y-2">
          <div className="flex items-center justify-center">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Secure checkout</span>
          </div>

          {/* Company footer */}
          <div className="flex items-center justify-center flex-wrap text-xs">
            {settings?.phone && <span>{settings.phone}</span>}
            {settings?.phone && settings?.email && <span className="mx-2">•</span>}
            {settings?.email && <span>{settings.email}</span>}
            {(settings?.phone || settings?.email) && settings?.website_url && <span className="mx-2">•</span>}
            {settings?.website_url && (
              <a
                href={settings.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {settings.website_url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
