import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function Order() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch order details
  useEffect(() => {
    async function fetchOrder() {
      const { data } = await supabase
        .from('orders')
        .select('*, tables(number)')
        .eq('id', orderId)
        .single();
      setOrder(data);
      setLoading(false);
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
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [orderId, router]);

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (!order) return <div className="text-center mt-10">Order not found</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Order Summary - Table {order.tables.number}</h1>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Items</h2>
        <ul>
          {order.items.map((item, index) => (
            <li key={index}>{item.name} - ${item.price.toFixed(2)}</li>
          ))}
        </ul>
        <p className="mt-4">Status: {order.status}</p>
      </div>
    </div>
  );
}