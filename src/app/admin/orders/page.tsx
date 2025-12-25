export default function OrdersPage() {
  return (
    <div className="bg-white shadow rounded-lg p-8 text-center">
      <div className="max-w-md mx-auto">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h2 className="mt-4 text-2xl font-bold text-gray-900">Orders Page</h2>
        <p className="mt-2 text-gray-600">
          Coming in Phase 1
        </p>
        <p className="mt-4 text-sm text-gray-500">
          This page will allow you to create and manage customer orders, upload files,
          track approvals, and monitor payment status.
        </p>
      </div>
    </div>
  );
}
