import { getSettings } from '../../settings/actions';
import NewOrderForm from './NewOrderForm';

export default async function NewOrderPage() {
  const settings = await getSettings();

  const defaultFromEmail = settings?.default_from_email || '';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Order</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload files and create a new order for customer approval.
        </p>
      </div>
      <NewOrderForm defaultFromEmail={defaultFromEmail} />
    </div>
  );
}
