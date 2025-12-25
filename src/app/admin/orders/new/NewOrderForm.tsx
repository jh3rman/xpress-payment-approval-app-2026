'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder } from '../actions';
import { isValidEmail, parseEmails, formatCents } from '@/lib/utils';

interface NewOrderFormProps {
  defaultFromEmail: string;
  prefillData?: {
    customer_email?: string;
    cc_emails?: string;
    order_title?: string;
    internal_notes?: string;
    from_email?: string;
    payment_required?: boolean;
    order_amount_cents?: number;
    allow_tip?: boolean;
  };
}

type FileUpload = {
  file: File;
  type: 'invoice' | 'artwork';
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  storage_path?: string;
};

export default function NewOrderForm({ defaultFromEmail, prefillData }: NewOrderFormProps) {
  const router = useRouter();

  // Form state
  const [customerEmail, setCustomerEmail] = useState(prefillData?.customer_email || '');
  const [ccEmails, setCcEmails] = useState(prefillData?.cc_emails || '');
  const [orderTitle, setOrderTitle] = useState(prefillData?.order_title || '');
  const [internalNotes, setInternalNotes] = useState(prefillData?.internal_notes || '');
  const [fromEmail, setFromEmail] = useState(prefillData?.from_email || defaultFromEmail);
  const [paymentRequired, setPaymentRequired] = useState(prefillData?.payment_required || false);
  const [orderAmount, setOrderAmount] = useState(
    prefillData?.order_amount_cents ? (prefillData.order_amount_cents / 100).toFixed(2) : ''
  );
  const [allowTip, setAllowTip] = useState(prefillData?.allow_tip || false);

  // File upload state
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdOrderToken, setCreatedOrderToken] = useState<string | null>(null);

  // Validation
  const isValidForm = (): boolean => {
    if (!customerEmail || !isValidEmail(customerEmail)) return false;
    if (!orderTitle.trim()) return false;
    if (!fromEmail || !isValidEmail(fromEmail)) return false;
    if (files.length === 0) return false;
    if (files.some((f) => !f.uploaded)) return false;
    if (paymentRequired) {
      const amount = parseFloat(orderAmount);
      if (isNaN(amount) || amount <= 0) return false;
    }
    return true;
  };

  // Handle file selection
  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'artwork') => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: FileUpload[] = selectedFiles.map((file) => ({
      file,
      type,
      uploading: false,
      uploaded: false,
    }));
    setFiles([...files, ...newFiles]);
  };

  // Upload files to server
  const uploadFiles = async () => {
    setUploading(true);
    setError(null);

    try {
      const uploadPromises = files.map(async (fileUpload, index) => {
        if (fileUpload.uploaded) return; // Skip already uploaded

        setFiles((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], uploading: true };
          return updated;
        });

        const formData = new FormData();
        formData.append('file', fileUpload.file);
        formData.append('type', fileUpload.type);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

        setFiles((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            uploading: false,
            uploaded: true,
            storage_path: result.path,
          };
          return updated;
        });
      });

      await Promise.all(uploadPromises);
      setUploading(false);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  // Remove file
  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // Create order
  const handleCreateOrder = async (sendEmail: boolean) => {
    if (!isValidForm()) return;

    setCreating(true);
    setError(null);

    try {
      const ccEmailsList = parseEmails(ccEmails);
      const orderAmountCents = paymentRequired ? Math.round(parseFloat(orderAmount) * 100) : null;

      const uploadedFiles = files
        .filter((f) => f.uploaded && f.storage_path)
        .map((f) => ({
          filename: f.file.name,
          storage_path: f.storage_path!,
          file_type: f.type,
        }));

      const result = await createOrder({
        customer_email: customerEmail,
        cc_emails: ccEmailsList,
        order_title: orderTitle,
        internal_notes: internalNotes,
        from_email: fromEmail,
        payment_required: paymentRequired,
        order_amount_cents: orderAmountCents,
        allow_tip: allowTip,
        files: uploadedFiles,
      });

      if (!result.success || !result.order) {
        throw new Error(result.error || 'Failed to create order');
      }

      setSuccess(true);
      setCreatedOrderToken(result.order.token);

      if (sendEmail) {
        // Send initial email (Phase 2)
        try {
          const emailResponse = await fetch(`/api/orders/${result.order.id}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resend: false }),
          });

          const emailResult = await emailResponse.json();

          if (!emailResult.success) {
            setError(`Order created, but email failed: ${emailResult.error}`);
          }
        } catch (emailError) {
          setError('Order created, but email failed to send.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  // Copy URL to clipboard
  const copyUrl = () => {
    if (createdOrderToken) {
      const url = `${window.location.origin}/o/${createdOrderToken}`;
      navigator.clipboard.writeText(url);
    }
  };

  if (success && createdOrderToken) {
    const customerUrl = `${window.location.origin}/o/${createdOrderToken}`;
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Created!</h2>
          <p className="text-gray-600">Share this URL with your customer:</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <code className="text-sm text-gray-800 flex-1 break-all">{customerUrl}</code>
            <button
              onClick={copyUrl}
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex-shrink-0"
            >
              Copy
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Status: <span className="ml-2 font-semibold">Not Sent</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/admin/orders')}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            View All Orders
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
      className="space-y-6"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Customer Information */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-1">
              Customer Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="customer_email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="customer@example.com"
            />
          </div>

          <div>
            <label htmlFor="cc_emails" className="block text-sm font-medium text-gray-700 mb-1">
              CC Emails (comma-separated)
            </label>
            <input
              type="text"
              id="cc_emails"
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="person1@example.com, person2@example.com"
            />
          </div>
        </div>
      </section>

      {/* Order Details */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Details</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="order_title" className="block text-sm font-medium text-gray-700 mb-1">
              Order Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="order_title"
              value={orderTitle}
              onChange={(e) => setOrderTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Invoice #12345 - Customer Name"
            />
          </div>

          <div>
            <label htmlFor="internal_notes" className="block text-sm font-medium text-gray-700 mb-1">
              Internal Notes
            </label>
            <textarea
              id="internal_notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notes visible only to admins..."
            />
          </div>

          <div>
            <label htmlFor="from_email" className="block text-sm font-medium text-gray-700 mb-1">
              From Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="from_email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Payment Settings */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="payment_required"
              checked={paymentRequired}
              onChange={(e) => {
                setPaymentRequired(e.target.checked);
                if (!e.target.checked) {
                  setAllowTip(false);
                }
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="payment_required" className="ml-2 block text-sm text-gray-900">
              Payment Required
            </label>
          </div>

          {paymentRequired && (
            <>
              <div>
                <label htmlFor="order_amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Order Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    id="order_amount"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    step="0.01"
                    min="0.01"
                    required
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allow_tip"
                  checked={allowTip}
                  onChange={(e) => setAllowTip(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="allow_tip" className="ml-2 block text-sm text-gray-900">
                  Allow Tip
                </label>
              </div>
            </>
          )}
        </div>
      </section>

      {/* File Uploads */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          File Uploads <span className="text-red-500">*</span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">At least one file is required to create an order.</p>

        <div className="space-y-4">
          {/* Invoice Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Files</label>
            <input
              type="file"
              onChange={(e) => handleFileAdd(e, 'invoice')}
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Artwork Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Artwork Files</label>
            <input
              type="file"
              onChange={(e) => handleFileAdd(e, 'artwork')}
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Files:</h3>
              <div className="space-y-2">
                {files.map((fileUpload, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{fileUpload.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {fileUpload.type === 'invoice' ? 'Invoice' : 'Artwork'} •{' '}
                        {(fileUpload.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {fileUpload.uploading && (
                        <span className="text-xs text-blue-600">Uploading...</span>
                      )}
                      {fileUpload.uploaded && (
                        <span className="text-xs text-green-600">✓ Uploaded</span>
                      )}
                      {!fileUpload.uploaded && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {files.length > 0 && !files.every((f) => f.uploaded) && (
                <button
                  type="button"
                  onClick={uploadFiles}
                  disabled={uploading || files.every((f) => f.uploaded)}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading Files...' : 'Upload Files'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => handleCreateOrder(false)}
          disabled={!isValidForm() || creating}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {creating ? 'Creating...' : 'Create Order'}
        </button>
        <button
          type="button"
          onClick={() => handleCreateOrder(true)}
          disabled={!isValidForm() || creating}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {creating ? 'Creating...' : 'Create & Send Email'}
        </button>
      </div>

      {!isValidForm() && files.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Please upload all files and fill in all required fields to create the order.
        </p>
      )}
    </form>
  );
}
