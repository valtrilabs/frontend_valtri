import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function Order() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch order details
  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, created_at, table_id, items, status, tables(number)')
          .eq('id', orderId)
          .single();
        if (error) {
          console.error('Fetch order error:', error.message);
          throw error;
        }
        if (data.status === 'paid') {
          localStorage.removeItem('orderId');
          router.replace('/blocked');
          return;
        }
        setOrder(data);
        setLoading(false);
      } catch (err) {
        console.error('Fetch order failed:', err.message);
        setError('Failed to load order. The order may not exist or you lack access.');
        setLoading(false);
        setTimeout(() => {
          localStorage.removeItem('orderId');
          router.replace('/blocked');
        }, 3000);
      }
    }
    fetchOrder();
  }, [orderId, router]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!orderId) return;
    const subscription = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          if (payload.new.status === 'paid') {
            localStorage.removeItem('orderId');
            router.replace('/blocked');
          } else {
            setOrder(payload.new);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [orderId, router]);

  // Add more items
  const addMoreItems = () => {
    if (order && order.status === 'pending') {
      localStorage.setItem('appendOrder', JSON.stringify({
        orderId,
        items: order.items,
      }));
      router.push(`/table/${order.table_id}`);
    }
  };

  // Calculate total
  const total = order?.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) || 0;

  if (loading) return <div className="text-center mt-10" role="status">Loading order...</div>;
  if (error) return <div className="text-center mt-10 text-red-500" role="alert">{error} Redirecting...</div>;
  if (!order) return <div className="text-center mt-10" role="alert">Order not found</div>;

  const formattedDate = new Date(order.created_at).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4" aria-label={`Order Summary for Table ${order.tables.number}`}>
        Order Summary - Table {order.tables.number}
      </h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-4">
          <p className="text-lg font-semibold">Order #{order.order_number || order.id}</p>
          <p className="text-sm text-gray-500">Placed on {formattedDate}</p>
          <p className="text-sm text-gray-500">Table {order.tables?.number || order.table_id}</p>
        </div>
        <p className="text-green-600 font-semibold mb-4">
          Thank you for ordering! Please wait 10 minutes for your order to arrive.
        </p>
        <h2 className="font-semibold text-lg mb-2">Items</h2>
        <ul className="mb-4">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between">
              <span>
                {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
              </span>
              <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="font-semibold">Total: ₹{total.toFixed(2)}</p>
        <p className="mt-4">Status: {order.status}</p>
        {order.status === 'pending' && (
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={addMoreItems}
            aria-label="Add more items to order"
          >
            Add More Items
          </button>
        )}
      </div>
    </div>
  );
}