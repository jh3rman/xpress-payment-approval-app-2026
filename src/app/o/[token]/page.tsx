import { getOrderByToken, trackOrderView } from '@/app/admin/orders/actions';
import { getSettings } from '@/app/admin/settings/actions';
import { notFound } from 'next/navigation';
import CustomerOrderView from './CustomerOrderView';
import { cookies } from 'next/headers';

export default async function CustomerOrderPage({ params }: { params: { token: string } }) {
  const order = await getOrderByToken(params.token);
  const settings = await getSettings();

  if (!order) {
    return <OrderNotFound />;
  }

  // Track view (with cookie-based debouncing handled server-side)
  const cookieStore = await cookies();
  const lastViewCookie = cookieStore.get(`viewed_${params.token}`);
  const shouldTrack = !lastViewCookie ||
    (Date.now() - parseInt(lastViewCookie.value)) > 600000; // 10 minutes

  if (shouldTrack) {
    await trackOrderView(params.token);
    // Set cookie (would need to be done in middleware or client-side in real app)
  }

  return <CustomerOrderView order={order} settings={settings} />;
}

function OrderNotFound() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Not Found</h1>
        <p className="text-gray-600">
          This link has expired or is invalid. Please check your email for the correct link or contact us for assistance.
        </p>
      </div>
    </div>
  );
}
