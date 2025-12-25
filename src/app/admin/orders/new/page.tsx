import { getSettings } from '../../settings/actions';
import { getOrderById } from '../actions';
import NewOrderForm from './NewOrderForm';

interface NewOrderPageProps {
  searchParams: Promise<{ duplicate?: string }>;
}

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const settings = await getSettings();
  const params = await searchParams;
  const defaultFromEmail = settings?.default_from_email || '';

  // Handle duplicate functionality
  let prefillData = undefined;
  let isDuplicate = false;

  if (params.duplicate) {
    const order = await getOrderById(params.duplicate);
    if (order) {
      isDuplicate = true;
      prefillData = {
        customer_email: order.customer_email,
        cc_emails: order.cc_emails?.join(', ') || '',
        order_title: `${order.order_title} (Copy)`,
        internal_notes: order.internal_notes || '',
        from_email: order.from_email,
        payment_required: order.payment_required,
        order_amount_cents: order.order_amount_cents,
        allow_tip: order.allow_tip,
      };
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {isDuplicate ? 'Duplicate Order' : 'Create New Order'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {isDuplicate
            ? 'Creating a copy of an existing order. Files must be uploaded again.'
            : 'Upload files and create a new order for customer approval.'}
        </p>
      </div>
      <NewOrderForm defaultFromEmail={defaultFromEmail} prefillData={prefillData} />
    </div>
  );
}
