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
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, tables(number)')
          .eq('id', orderId)
          .single();
        if (error) throw error;
        setOrder(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load order. Please try again.');
        setLoading(false);
      }
    }
    if (orderId) fetchOrder();
  }, [orderId]);

  // Subscribe to realtime updates
  useEffect(() => {
    const subscription = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          if (payload.new.status === 'paid') {
            localStorage.removeItem('orderId');
            router.push('/blocked');
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
  const total = order?.items.reduce((sum, item) => sum + item.price, 0) || 0;

  if (loading) return <div className="text-center mt-10" role="status">Loading order...</div>;
  if (error) return <div className="text-center mt-10 text-red-500" role="alert">{error}</div>;
  if (!order) return <div className="text-center mt-10" role="alert">Order not found</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4" aria-label={`Order Summary for Table ${order.tables.number}`}>
        Order Summary - Table {order.tables.number}
      </h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-green-600 font-semibold mb-4">
          Thank you for ordering! Please wait 10 minutes for your order to arrive.
        </p>
        <h2 className="font-semibold text-lg mb-2">Items</h2>
        <ul className="mb-4">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between">
              <span>{item.name}</span>
              <span>₹{item.price.toFixed(2)}</span>
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