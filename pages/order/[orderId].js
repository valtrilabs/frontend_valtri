import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { format, add } from 'date-fns';

export default function Order() {
  const router = useRouter();
  const { orderId } = router.query;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to convert UTC to IST
  const formatToIST = (date) => {
    const utcDate = new Date(date);
    const istDate = add(utcDate, { hours: 5, minutes: 30 });
    return format(istDate, 'dd/MM/yyyy, hh:mm a');
  };

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

  // Calculate total
  const total = order?.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0) || 0;

  if (loading) return <div className="text-center mt-10" role="status">Loading order...</div>;
  if (error) return <div className="text-center mt-10 text-red-500" role="alert">{error} Redirecting...</div>;
  if (!order) return <div className="text-center mt-10" role="alert">Order not found</div>;

  const formattedDate = formatToIST(order.created_at);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4" aria-label={`Order Summary for Table ${order.tables.number}`}>
        Order Summary - Table {order.tables.number}
      </h1>
      {/* <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-4">
          <p className="text-lg font-semibold">Order No: #{order.order_number || order.id}</p>
          <p className="text-sm text-gray-500">Date and Time: {formattedDate}</p>
          <p className="text-sm text-gray-500">Table Number: {order.tables?.number || order.table_id}</p>
        </div>
        <p className="text-green-600 font-semibold text-lg mb-2"> Thank you for ordering! Please wait 10 minutes for your order to arrive.</p>
        <p className="text-gray-700 text-sm">To edit your current order or to order new items, please contact our waiter.</p>
        <h2 className="font-semibold text-lg mb-2">Ordered Items</h2>
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
      </div> */}

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
  <div className="mb-2">
    <p className="text-lg font-semibold">Order No: #{order.order_number || order.id}</p>
    <p className="text-sm text-gray-500">Date and Time: {formattedDate}</p>
    <p className="text-sm text-gray-500">Table Number: {order.tables?.number || order.table_id}</p>
  </div>

  {/* Thank you message */}
  <div>
    <p className="text-green-600 font-semibold text-lg mb-1">
      Thank you for ordering! Please wait 10 minutes for your order to arrive.
    </p>
    <p className="text-gray-600 text-sm mb-4">
      To edit your current order or to order new items, please contact our waiter.
    </p>
  </div>

  {/* Ordered items */}
  <div>
    <h2 className="font-semibold text-lg mb-2">Ordered Items</h2>
    <ul className="space-y-1 mb-4">
      {order.items.map((item, index) => (
        <li key={index} className="flex justify-between text-gray-800">
          <span>
            {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
          </span>
          <span>₹{(item.price * (item.quantity || 1)).toFixed(2)}</span>
        </li>
      ))}
    </ul>
    <p className="font-semibold text-lg text-black">Total: ₹{total.toFixed(2)}</p>
    <p className="text-sm text-gray-700 mt-2">Status: {order.status}</p>
  </div>
</div>



    </div>
  );
}