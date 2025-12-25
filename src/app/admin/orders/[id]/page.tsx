import { getOrderById } from '../actions';
import { notFound } from 'next/navigation';
import OrderDetailView from './OrderDetailView';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await getOrderById(params.id);

  if (!order) {
    notFound();
  }

  return <OrderDetailView order={order} />;
}
